import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken } from "@/lib/auth";

async function requireSuperAdmin(request: NextRequest) {
  const token = extractToken(request);
  if (!token) return null;
  try {
    const { session } = await validateSession(token);
    if (session.userType !== "admin") return null;
    const admin = await db.admin.findUnique({
      where:  { id: parseInt(session.userId) },
      select: { id: true, role: true },
    });
    if (!admin || admin.role !== "super_admin") return null;
    return admin;
  } catch { return null; }
}

/**
 * GET /api/admin/settings/cron-status
 * Returns list of planned cron jobs and their last-run status from admin_logs.
 */
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  // Planned cron jobs (will be implemented in Phase 13)
  const CRON_JOBS = [
    { name: "expire-vouchers",     label: "Expire Voucher Kadaluarsa",    schedule: "Setiap menit" },
    { name: "expire-subscribers",  label: "Expire Subscriber Kadaluarsa", schedule: "Setiap jam" },
    { name: "expire-trials",       label: "Cleanup Trial Kadaluarsa",     schedule: "Setiap 5 menit" },
    { name: "session-log-sync",    label: "Sinkronisasi Session Log",     schedule: "Setiap 15 menit" },
    { name: "push-notification",   label: "Kirim Push Notification",      schedule: "Setiap jam" },
    { name: "daily-backup",        label: "Backup Database Harian",       schedule: "Setiap hari 02:00" },
  ];

  try {
    // Try to find last run for each cron via admin_logs
    const logs = await db.adminLog.findMany({
      where:   { action: { startsWith: "CRON_" } },
      orderBy: { createdAt: "desc" },
      take:    100,
    });

    const lastRunMap = new Map<string, { createdAt: Date; description: string | null }>();
    for (const log of logs) {
      const jobName = log.action.replace("CRON_", "").toLowerCase().replace(/_/g, "-");
      if (!lastRunMap.has(jobName)) lastRunMap.set(jobName, log);
    }

    const jobs = CRON_JOBS.map((job) => {
      const last = lastRunMap.get(job.name);
      return {
        name:        job.name,
        label:       job.label,
        schedule:    job.schedule,
        lastRunAt:   last?.createdAt ?? null,
        lastStatus:  last ? "success" : "never",
        description: last?.description ?? null,
      };
    });

    return NextResponse.json({ ok: true, jobs });
  } catch (err) {
    console.error("[settings/cron-status GET]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
