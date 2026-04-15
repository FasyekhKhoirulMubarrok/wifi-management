import { redirect } from "next/navigation";
import { getCurrentAdmin, getAccessibleLocationIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/components/admin/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RevenueChart, type RevenueDataPoint } from "@/components/admin/RevenueChart";
import { ActiveUsersChart, type LocationUserData } from "@/components/admin/ActiveUsersChart";
import {
  Users,
  Wallet,
  MapPin,
  Ticket,
  AlertTriangle,
  WifiOff,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

// ─── data fetching ───────────────────────────────────────────────────────────

async function getDashboardData(locationIds: number[] | null) {
  const locationFilter =
    locationIds !== null
      ? { locationId: { in: locationIds } }
      : {};

  const now       = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ago30days  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ── metric counts (parallel) ───────────────────────────────────────────

  const [
    activeVouchers,
    activeSubscribers,
    totalLocations,
    todayVouchers,
    todaySubscribers,
    locations,
    expiringVouchers,
    expiringSubscribers,
    rawVoucherRevenue,
    rawSubscriberRevenue,
  ] = await Promise.all([
    // Active vouchers
    db.voucher.count({
      where: { ...locationFilter, status: "active", OR: [{ expiredAt: null }, { expiredAt: { gt: now } }] },
    }),

    // Active subscribers
    db.subscriber.count({
      where: { ...locationFilter, status: "active", OR: [{ expiredAt: null }, { expiredAt: { gt: now } }] },
    }),

    // Total locations (super_admin: all, admin_lokasi: assigned)
    locationIds !== null
      ? Promise.resolve(locationIds.length)
      : db.location.count({ where: { isActive: true } }),

    // Today's activated vouchers with package prices
    db.voucher.findMany({
      where: { ...locationFilter, status: { not: "unused" }, usedAt: { gte: todayStart } },
      include: { package: { select: { price: true } } },
    }),

    // Today's activated subscribers
    db.subscriber.findMany({
      where: { ...locationFilter, activatedAt: { gte: todayStart } },
      include: { package: { select: { price: true } } },
    }),

    // Locations list with active-user counts
    db.location.findMany({
      where: locationIds !== null ? { id: { in: locationIds } } : { isActive: true },
      select: {
        id: true, name: true, isActive: true,
        vouchers:    { where: { status: "active", OR: [{ expiredAt: null }, { expiredAt: { gt: now } }] }, select: { id: true } },
        subscribers: { where: { status: "active", OR: [{ expiredAt: null }, { expiredAt: { gt: now } }] }, select: { id: true } },
      },
      orderBy: { name: "asc" },
    }),

    // Vouchers expiring within 24h
    db.voucher.count({
      where: {
        ...locationFilter,
        status:    "active",
        expiredAt: { gte: now, lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      },
    }),

    // Subscribers expiring within 24h
    db.subscriber.count({
      where: {
        ...locationFilter,
        status:    "active",
        expiredAt: { gte: now, lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      },
    }),

    // 30-day voucher revenue (by activation date)
    db.voucher.findMany({
      where: { ...locationFilter, status: { not: "unused" }, usedAt: { gte: ago30days } },
      select: { usedAt: true, package: { select: { price: true } } },
      orderBy: { usedAt: "asc" },
    }),

    // 30-day subscriber revenue (by activation date)
    db.subscriber.findMany({
      where: { ...locationFilter, activatedAt: { gte: ago30days } },
      select: { activatedAt: true, package: { select: { price: true } } },
      orderBy: { activatedAt: "asc" },
    }),
  ]);

  // ── revenue today ──────────────────────────────────────────────────────

  const revenueToday =
    todayVouchers.reduce((s, v) => s + Number(v.package.price), 0) +
    todaySubscribers.reduce((s, v) => s + Number(v.package.price), 0);

  // ── 30-day revenue chart ───────────────────────────────────────────────

  const revenueByDay = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
    revenueByDay.set(key, 0);
  }

  for (const v of rawVoucherRevenue) {
    if (!v.usedAt) continue;
    const key = v.usedAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
    if (revenueByDay.has(key)) {
      revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(v.package.price));
    }
  }
  for (const s of rawSubscriberRevenue) {
    const key = s.activatedAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
    if (revenueByDay.has(key)) {
      revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(s.package.price));
    }
  }

  const revenueChartData: RevenueDataPoint[] = Array.from(revenueByDay.entries()).map(
    ([date, revenue]) => ({ date, revenue }),
  );

  // ── active users per location ──────────────────────────────────────────

  const activeUsersPerLocation: LocationUserData[] = locations.map((loc) => ({
    name:  loc.name.length > 16 ? loc.name.slice(0, 14) + "…" : loc.name,
    users: loc.vouchers.length + loc.subscribers.length,
  }));

  // ── alerts ─────────────────────────────────────────────────────────────

  const alerts: { type: "warning" | "danger"; message: string }[] = [];
  if (expiringVouchers > 0)
    alerts.push({ type: "warning", message: `${expiringVouchers} voucher akan expired dalam 24 jam` });
  if (expiringSubscribers > 0)
    alerts.push({ type: "warning", message: `${expiringSubscribers} subscriber akan expired dalam 24 jam` });
  const offlineLocations = locations.filter((l) => !l.isActive);
  if (offlineLocations.length > 0)
    alerts.push({ type: "danger", message: `${offlineLocations.length} lokasi tidak aktif: ${offlineLocations.map((l) => l.name).join(", ")}` });

  return {
    activeUsers:  activeVouchers + activeSubscribers,
    revenueToday,
    totalLocations,
    activeVouchers,
    locations,
    revenueChartData,
    activeUsersPerLocation,
    alerts,
  };
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  let admin;
  try {
    admin = await getCurrentAdmin();
  } catch {
    redirect("/admin/login");
  }

  const locationIds = await getAccessibleLocationIds(admin.id);
  const data        = await getDashboardData(locationIds);

  const isSuperAdmin = admin.role === "super_admin";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={isSuperAdmin ? "Ringkasan semua lokasi" : "Ringkasan lokasi Anda"}
      />

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm border
                ${alert.type === "danger"
                  ? "bg-red-500/10 border-red-500/20 text-red-300"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="User Aktif"
          value={data.activeUsers.toLocaleString("id-ID")}
          description="Voucher + subscriber"
          icon={<Users className="w-4 h-4" />}
          variant="default"
        />
        <MetricCard
          title="Pendapatan Hari Ini"
          value={fmtIDR(data.revenueToday)}
          description="Berdasarkan aktivasi"
          icon={<Wallet className="w-4 h-4" />}
          variant="success"
        />
        <MetricCard
          title={isSuperAdmin ? "Total Lokasi" : "Lokasi Anda"}
          value={data.totalLocations}
          description={isSuperAdmin ? "Lokasi aktif" : "Lokasi ter-assign"}
          icon={<MapPin className="w-4 h-4" />}
          variant="warning"
        />
        <MetricCard
          title="Voucher Aktif"
          value={data.activeVouchers.toLocaleString("id-ID")}
          description="Voucher sedang digunakan"
          icon={<Ticket className="w-4 h-4" />}
          variant="default"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue chart */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-white mb-1">Pendapatan 30 Hari</h3>
          <p className="text-xs text-slate-500 mb-4">
            Total berdasarkan tanggal aktivasi
          </p>
          <div className="h-56">
            <RevenueChart data={data.revenueChartData} />
          </div>
        </div>

        {/* Active users per location */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-white mb-1">User Aktif per Lokasi</h3>
          <p className="text-xs text-slate-500 mb-4">
            Voucher + subscriber aktif saat ini
          </p>
          <div className="h-56">
            <ActiveUsersChart data={data.activeUsersPerLocation} />
          </div>
        </div>
      </div>

      {/* Locations table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h3 className="text-sm font-medium text-white">Status Lokasi</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Nama Lokasi
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Voucher Aktif
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Subscriber Aktif
                </th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Total User
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.locations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    <WifiOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Tidak ada lokasi yang dapat diakses
                  </td>
                </tr>
              )}
              {data.locations.map((loc) => (
                <tr key={loc.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-5 py-3 font-medium text-white">{loc.name}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={loc.isActive ? "online" : "offline"} />
                  </td>
                  <td className="px-5 py-3 text-right text-slate-300 tabular-nums">
                    {loc.vouchers.length}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-300 tabular-nums">
                    {loc.subscribers.length}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-white tabular-nums">
                    {loc.vouchers.length + loc.subscribers.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
