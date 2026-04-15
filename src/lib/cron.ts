import cron from "node-cron";
import { db } from "./db";
import { pingRouter } from "./ping";
import { notifyAllAdmins, notifyUser } from "./push";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfYesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Write a cron execution record to admin_logs using first super_admin as actor. */
async function logCron(name: string, status: "success" | "error", description?: string) {
  try {
    const admin = await db.admin.findFirst({
      where:  { role: "super_admin" },
      select: { id: true },
    });
    if (!admin) return;
    await db.adminLog.create({
      data: {
        adminId:     admin.id,
        action:      `cron:${name}`,
        description: description ?? status,
      },
    });
  } catch {
    // Logging failure is non-fatal
  }
}

// ── Job 1: Delete yesterday's trial sessions at midnight ─────────────────────

function scheduleTrialCleanup() {
  cron.schedule("0 0 * * *", async () => {
    try {
      const result = await db.trialSession.deleteMany({
        where: { usedAt: { lt: startOfToday() } },
      });
      await logCron("trial_cleanup", "success", `Deleted ${result.count} expired trial sessions`);
    } catch (err) {
      await logCron("trial_cleanup", "error", String(err));
    }
  });
}

// ── Job 2: Quota threshold alerts every 15 minutes ───────────────────────────

function scheduleQuotaAlerts() {
  cron.schedule("*/15 * * * *", async () => {
    try {
      const subscribers = await db.subscriber.findMany({
        where: {
          status:  "active",
          package: { quotaLimitMb: { not: null } },
        },
        select: {
          id:          true,
          username:    true,
          quotaUsedMb: true,
          package:     { select: { quotaLimitMb: true } },
        },
      });

      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

      for (const sub of subscribers) {
        const limit = Number(sub.package.quotaLimitMb);
        const used  = Number(sub.quotaUsedMb);
        const pct   = limit > 0 ? (used / limit) * 100 : 0;

        let threshold: "80" | "90" | null = null;
        if (pct >= 90)      threshold = "90";
        else if (pct >= 80) threshold = "80";
        if (!threshold) continue;

        // Deduplicate: skip if already notified for this threshold in the last 24h
        const recent = await db.adminLog.findFirst({
          where: { action: `cron:quota_alert_${sub.id}_${threshold}`, createdAt: { gte: cutoff } },
        });
        if (recent) continue;

        const leftMb = Math.round((limit - used) / 1);
        await notifyUser(String(sub.id), {
          title: "Peringatan Kuota",
          body:  `Kuota Anda sudah terpakai ${threshold}%. Sisa ≈ ${leftMb} MB`,
          url:   "/portal/status",
        });
        await logCron(
          `quota_alert_${sub.id}_${threshold}`,
          "success",
          `Sent ${threshold}% quota alert to ${sub.username}`,
        );
      }
    } catch (err) {
      await logCron("quota_alerts", "error", String(err));
    }
  });
}

// ── Job 3: Router ping every 5 minutes ───────────────────────────────────────

function scheduleRouterPing() {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const locations = await db.location.findMany({
        where:  { isActive: true },
        select: { id: true, name: true, mikrotikIp: true },
      });

      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

      for (const loc of locations) {
        const online = await pingRouter(loc.mikrotikIp);
        if (online) continue;

        // Deduplicate: only alert once per 24h per location
        const recent = await db.adminLog.findFirst({
          where: { action: `cron:router_offline_${loc.id}`, createdAt: { gte: cutoff } },
        });
        if (recent) continue;

        await notifyAllAdmins({
          title: "Router Offline",
          body:  `Router di ${loc.name} (${loc.mikrotikIp}) tidak dapat dijangkau`,
          url:   "/admin/monitoring",
        });
        await logCron(
          `router_offline_${loc.id}`,
          "success",
          `Notified admins: router ${loc.name} offline`,
        );
      }
    } catch (err) {
      await logCron("router_ping", "error", String(err));
    }
  });
}

// ── Job 4: Daily report at 07:00 ─────────────────────────────────────────────

function scheduleDailyReport() {
  cron.schedule("0 7 * * *", async () => {
    try {
      const yesterday = startOfYesterday();

      const [voucherCount, subCount] = await Promise.all([
        db.voucher.count({
          where: { status: { not: "unused" }, usedAt: { gte: yesterday } },
        }),
        db.subscriber.count({
          where: { activatedAt: { gte: yesterday } },
        }),
      ]);

      type RevenueRow = { total: string };
      const [row] = await db.$queryRaw<RevenueRow[]>`
        SELECT (
          COALESCE((
            SELECT SUM(p.price)
            FROM vouchers v
            JOIN packages p ON p.id = v.package_id
            WHERE v.used_at >= ${yesterday} AND v.status != 'unused'
          ), 0) +
          COALESCE((
            SELECT SUM(p.price)
            FROM subscribers s
            JOIN packages p ON p.id = s.package_id
            WHERE s.activated_at >= ${yesterday}
          ), 0)
        ) AS total
      `;
      const revenue = Number(row?.total ?? 0);

      await notifyAllAdmins({
        title: "Laporan Harian",
        body: [
          `Voucher terjual: ${voucherCount}`,
          `Subscriber baru: ${subCount}`,
          `Pendapatan: Rp ${revenue.toLocaleString("id-ID")}`,
        ].join(" | "),
        url: "/admin/reports",
      });

      await logCron("daily_report", "success",
        `v=${voucherCount} s=${subCount} rev=${revenue}`);
    } catch (err) {
      await logCron("daily_report", "error", String(err));
    }
  });
}

// ── Job 5: Mark expired subscribers & vouchers every hour ────────────────────

function scheduleExpiredChecker() {
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();

      const [expiredSubs, expiredVouchers] = await Promise.all([
        db.subscriber.updateMany({
          where: { expiredAt: { lt: now }, status: "active" },
          data:  { status: "expired" },
        }),
        db.voucher.updateMany({
          where: { expiredAt: { lt: now }, status: "active" },
          data:  { status: "expired" },
        }),
      ]);

      await logCron(
        "expired_checker",
        "success",
        `Expired: ${expiredSubs.count} subscribers, ${expiredVouchers.count} vouchers`,
      );
    } catch (err) {
      await logCron("expired_checker", "error", String(err));
    }
  });
}

/** Register all cron jobs. Call once at server startup. */
export function scheduleCronJobs(): void {
  scheduleTrialCleanup();
  scheduleQuotaAlerts();
  scheduleRouterPing();
  scheduleDailyReport();
  scheduleExpiredChecker();
}
