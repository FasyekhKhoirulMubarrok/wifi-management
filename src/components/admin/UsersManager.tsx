"use client";

import { useState, useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, RefreshCw, Search, ChevronDown, Clock, WifiOff,
  RotateCcw, Trash2, Edit, ChevronLeft, ChevronRight,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

// ─── shared types ─────────────────────────────────────────────────────────────

interface PackageOption  { id: number; name: string }
interface LocationOption { id: number; name: string }

interface SubscriberRow {
  id:          number;
  username:    string;
  name:        string | null;
  status:      "active" | "expired" | "blocked";
  quotaUsedMb: string;
  activatedAt: string | null;
  expiredAt:   string | null;
  createdAt:   string;
  package:     { id: number; name: string; quotaLimitMb: string | null; timeLimitDays: number | null };
  location:    { id: number; name: string };
}

interface ActiveUser {
  username:    string;
  name:        string | null;
  framedIp:    string | null;
  callingMac:  string | null;
  nasIp:       string | null;
  location:    { id: number; name: string } | null;
  startTime:   string | null;
  sessionSecs: number;
  inputMb:     number;
  outputMb:    number;
  quotaUsedMb: string | null;
  quotaLimitMb: string | null;
}

interface Pagination { total: number; page: number; pages: number }

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}

function fmtMb(mb: number | string | null) {
  if (mb === null || mb === undefined) return "∞";
  const n = typeof mb === "string" ? Number(mb) : mb;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} GB`;
  return `${n.toFixed(0)} MB`;
}

// ─── main component ───────────────────────────────────────────────────────────

export function UsersManager({
  packages,
  locations,
}: {
  packages:  PackageOption[];
  locations: LocationOption[];
}) {
  const [tab, setTab] = useState<"subscribers" | "active">("subscribers");

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit mb-6">
        {(["subscribers", "active"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t === "subscribers" ? "Langganan" : "User Aktif Sekarang"}
          </button>
        ))}
      </div>

      {tab === "subscribers"
        ? <SubscribersTab packages={packages} locations={locations} />
        : <ActiveUsersTab />
      }
    </div>
  );
}

// ─── Subscribers Tab ──────────────────────────────────────────────────────────

function SubscribersTab({
  packages, locations,
}: {
  packages:  PackageOption[];
  locations: LocationOption[];
}) {
  const router = useRouter();
  const [rows,       setRows]       = useState<SubscriberRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, pages: 1 });
  const [loading,    setLoading]    = useState(false);

  // Filters
  const [search,     setSearch]     = useState("");
  const [statusF,    setStatusF]    = useState("");
  const [packageF,   setPackageF]   = useState("");
  const [locationF,  setLocationF]  = useState("");
  const [page,       setPage]       = useState(1);

  const [pending, startTransition] = useTransition();

  const fetchRows = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (search)    params.set("search",     search);
    if (statusF)   params.set("status",     statusF);
    if (packageF)  params.set("packageId",  packageF);
    if (locationF) params.set("locationId", locationF);

    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setRows(d.subscribers);
          setPagination(d.pagination);
        }
      })
      .finally(() => setLoading(false));
  }, [page, search, statusF, packageF, locationF]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  function handleDelete(sub: SubscriberRow) {
    if (!confirm(`Hapus subscriber "${sub.username}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${sub.id}`, { method: "DELETE" });
      if (res.ok) { fetchRows(); router.refresh(); }
      else {
        const d = await res.json();
        alert(d.error ?? "Gagal menghapus subscriber");
      }
    });
  }

  function handleExtend(sub: SubscriberRow) {
    if (!confirm(`Perpanjang langganan "${sub.username}" dari sekarang?`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${sub.id}/extend`, { method: "POST" });
      if (res.ok) { fetchRows(); }
      else {
        const d = await res.json();
        alert(d.error ?? "Gagal memperpanjang");
      }
    });
  }

  function handleResetQuota(sub: SubscriberRow) {
    if (!confirm(`Reset kuota "${sub.username}" ke 0?`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${sub.id}/reset-quota`, { method: "POST" });
      if (res.ok) { fetchRows(); }
      else {
        const d = await res.json();
        alert(d.error ?? "Gagal reset kuota");
      }
    });
  }

  function handleDisconnect(sub: SubscriberRow) {
    if (!confirm(`Putus koneksi "${sub.username}" sekarang?`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${sub.id}/disconnect`, { method: "POST" });
      if (res.ok) { fetchRows(); }
      else {
        const d = await res.json();
        alert(d.error ?? "Gagal memutus koneksi");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari username/nama..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status filter */}
        <div className="relative">
          <select
            value={statusF}
            onChange={(e) => { setStatusF(e.target.value); setPage(1); }}
            className="bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Status</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="blocked">Blocked</option>
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Location filter */}
        <div className="relative">
          <select
            value={locationF}
            onChange={(e) => { setLocationF(e.target.value); setPage(1); }}
            className="bg-white/5 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Lokasi</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        {/* Refresh */}
        <button
          onClick={fetchRows}
          disabled={loading}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>

        {/* Add */}
        <button
          onClick={() => router.push("/admin/users/new")}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Tambah Subscriber
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Username</th>
                <th className="px-4 py-3 text-left">Paket</th>
                <th className="px-4 py-3 text-left">Lokasi</th>
                <th className="px-4 py-3 text-left">Kuota Terpakai</th>
                <th className="px-4 py-3 text-left">Expired</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Memuat...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Tidak ada subscriber</td></tr>
              ) : rows.map((row) => {
                const quotaLimit = row.package.quotaLimitMb ? Number(row.package.quotaLimitMb) : null;
                const quotaUsed  = Number(row.quotaUsedMb);
                const quotaPct   = quotaLimit ? Math.min(100, Math.round(quotaUsed / quotaLimit * 100)) : null;

                return (
                  <tr key={row.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{row.username}</div>
                      {row.name && <div className="text-xs text-slate-400">{row.name}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{row.package.name}</td>
                    <td className="px-4 py-3 text-slate-300">{row.location.name}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-300 text-xs">
                        {fmtMb(quotaUsed)} / {fmtMb(quotaLimit)}
                      </div>
                      {quotaPct !== null && (
                        <div className="w-24 bg-white/10 rounded-full h-1.5 mt-1">
                          <div
                            className={`h-1.5 rounded-full ${quotaPct >= 90 ? "bg-red-500" : quotaPct >= 70 ? "bg-yellow-500" : "bg-emerald-500"}`}
                            style={{ width: `${quotaPct}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{fmtDate(row.expiredAt)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => router.push(`/admin/users/${row.id}`)}
                          title="Edit"
                          className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleExtend(row)}
                          disabled={pending}
                          title="Perpanjang"
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                        >
                          <Clock size={14} />
                        </button>
                        <button
                          onClick={() => handleResetQuota(row)}
                          disabled={pending}
                          title="Reset Kuota"
                          className="p-1.5 text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors"
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          onClick={() => handleDisconnect(row)}
                          disabled={pending}
                          title="Putus Koneksi"
                          className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded transition-colors"
                        >
                          <WifiOff size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(row)}
                          disabled={pending}
                          title="Hapus"
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
            <p className="text-xs text-slate-500">
              {pagination.total} subscriber, hal. {pagination.page} dari {pagination.pages}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 text-slate-300 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={pagination.page >= pagination.pages}
                className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 text-slate-300 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Active Users Tab ─────────────────────────────────────────────────────────

function ActiveUsersTab() {
  const [users,   setUsers]   = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [pending, startTransition] = useTransition();

  const fetchActive = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/users/active")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) { setUsers(d.active); setLastRefresh(new Date()); }
      })
      .finally(() => setLoading(false));
  }, []);

  // Initial fetch + auto-refresh every 30s
  useEffect(() => {
    fetchActive();
    const timer = setInterval(fetchActive, 30_000);
    return () => clearInterval(timer);
  }, [fetchActive]);

  function handleDisconnect(username: string) {
    // Find subscriber ID by username — need to call the users API
    if (!confirm(`Putus koneksi "${username}"?`)) return;
    startTransition(async () => {
      // Fetch user list to find the ID
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(username)}&limit=1`);
      const data = await res.json();
      if (!data.ok || data.subscribers.length === 0) {
        alert("Subscriber tidak ditemukan di database");
        return;
      }
      const sub = data.subscribers[0];
      const res2 = await fetch(`/api/admin/users/${sub.id}/disconnect`, { method: "POST" });
      if (res2.ok) fetchActive();
      else {
        const d = await res2.json();
        alert(d.error ?? "Gagal memutus koneksi");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <div className={`w-2 h-2 rounded-full ${loading ? "bg-yellow-400 animate-pulse" : "bg-emerald-400"}`} />
          {loading ? "Memperbarui..." : `${users.length} user online`}
          {lastRefresh && (
            <span className="text-slate-500">
              · diperbarui {lastRefresh.toLocaleTimeString("id-ID")}
            </span>
          )}
        </div>
        <button
          onClick={fetchActive}
          disabled={loading}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Username</th>
                <th className="px-4 py-3 text-left">IP / MAC</th>
                <th className="px-4 py-3 text-left">Lokasi</th>
                <th className="px-4 py-3 text-left">Durasi</th>
                <th className="px-4 py-3 text-left">↓ Download</th>
                <th className="px-4 py-3 text-left">↑ Upload</th>
                <th className="px-4 py-3 text-left">Kuota Terpakai</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    {loading ? "Memuat data..." : "Tidak ada user online saat ini"}
                  </td>
                </tr>
              ) : users.map((u, i) => (
                <tr key={`${u.username}-${i}`} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{u.username}</div>
                    {u.name && <div className="text-xs text-slate-400">{u.name}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-300 text-xs">{u.framedIp ?? "—"}</div>
                    <div className="text-slate-500 text-xs">{u.callingMac ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{u.location?.name ?? u.nasIp ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{fmtDuration(u.sessionSecs)}</td>
                  <td className="px-4 py-3 text-blue-400 text-xs">{fmtMb(u.inputMb)}</td>
                  <td className="px-4 py-3 text-emerald-400 text-xs">{fmtMb(u.outputMb)}</td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {fmtMb(u.quotaUsedMb)} / {fmtMb(u.quotaLimitMb)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDisconnect(u.username)}
                      disabled={pending}
                      title="Putus Koneksi"
                      className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 px-2 py-1 rounded transition-colors ml-auto"
                    >
                      <WifiOff size={12} /> Putus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500 text-center">Auto-refresh setiap 30 detik</p>
    </div>
  );
}
