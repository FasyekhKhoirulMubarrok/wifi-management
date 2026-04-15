"use client";

import { useState, useCallback, useEffect } from "react";
import {
  RefreshCw, Wifi, WifiOff, Users, Activity,
  TrendingDown, TrendingUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── types ────────────────────────────────────────────────────────────────────

interface LocationStatus {
  id:           number;
  name:         string;
  address:      string | null;
  mikrotikIp:   string;
  isActive:     boolean;
  routerOnline: boolean;
  activeUsers:  number;
}

interface OnlineUser {
  username:    string;
  framedIp:    string | null;
  callingMac:  string | null;
  nasIp:       string | null;
  location:    { id: number; name: string } | null;
  startTime:   string | null;
  sessionSecs: number;
  inputMb:     number;
  outputMb:    number;
}

interface BandwidthEntry {
  locationId:     number;
  locationName:   string;
  activeSessions: number;
  totalInputMb:   number;
  totalOutputMb:  number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}

function fmtMb(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}

// ─── main component ───────────────────────────────────────────────────────────

export function MonitoringDashboard() {
  const [statuses,    setStatuses]    = useState<LocationStatus[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [bandwidth,   setBandwidth]   = useState<BandwidthEntry[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u, b] = await Promise.all([
        fetch("/api/admin/monitoring/status").then((r) => r.json()),
        fetch("/api/admin/monitoring/online-users").then((r) => r.json()),
        fetch("/api/admin/monitoring/bandwidth").then((r) => r.json()),
      ]);
      if (s.ok) setStatuses(s.statuses);
      if (u.ok) setOnlineUsers(u.users);
      if (b.ok) setBandwidth(b.bandwidth);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 15s
  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, 15_000);
    return () => clearInterval(timer);
  }, [fetchAll]);

  const totalOnline  = statuses.reduce((s, l) => s + l.activeUsers, 0);
  const totalOnline2 = onlineUsers.length;
  const online       = statuses.filter((l) => l.routerOnline).length;
  const offline      = statuses.filter((l) => !l.routerOnline).length;

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm">
          <div className={`w-2 h-2 rounded-full ${loading ? "bg-yellow-400 animate-pulse" : "bg-emerald-400 animate-pulse"}`} />
          <span className="text-slate-400">
            {loading ? "Memperbarui..." : lastRefresh
              ? `Diperbarui ${lastRefresh.toLocaleTimeString("id-ID")}`
              : "Belum ada data"}
          </span>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh Manual
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={<Wifi size={20} className="text-emerald-400" />} label="Router Online"    value={String(online)}          sub={`dari ${statuses.length} lokasi`} color="emerald" />
        <SummaryCard icon={<WifiOff size={20} className="text-red-400" />} label="Router Offline"   value={String(offline)}         sub="memerlukan perhatian"            color="red"     />
        <SummaryCard icon={<Users size={20} className="text-blue-400" />}  label="User Online"      value={String(totalOnline2)}    sub="sesi aktif radacct"              color="blue"    />
        <SummaryCard icon={<Activity size={20} className="text-purple-400" />} label="Total Sesi"   value={String(totalOnline)}    sub="via NAS counter"                  color="purple"  />
      </div>

      {/* Location status cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Status Lokasi</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statuses.map((loc) => (
            <LocationCard key={loc.id} loc={loc} />
          ))}
          {statuses.length === 0 && !loading && (
            <p className="text-slate-500 text-sm col-span-3">Tidak ada lokasi ditemukan</p>
          )}
        </div>
      </div>

      {/* Bandwidth chart */}
      {bandwidth.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Bandwidth per Lokasi (Sesi Aktif)
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bandwidth} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="locationName" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                labelStyle={{ color: "#e2e8f0" }}
                formatter={(v) => [fmtMb(Number(v ?? 0)), ""]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              <Bar dataKey="totalInputMb"  name="Download"  fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="totalOutputMb" name="Upload"    fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Online users table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            User Online ({onlineUsers.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Username</th>
                <th className="px-4 py-3 text-left">IP / MAC</th>
                <th className="px-4 py-3 text-left">Lokasi</th>
                <th className="px-4 py-3 text-left">Durasi</th>
                <th className="px-4 py-3 text-left">↓ DL</th>
                <th className="px-4 py-3 text-left">↑ UL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {onlineUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    {loading ? "Memuat..." : "Tidak ada user online"}
                  </td>
                </tr>
              ) : onlineUsers.map((u, i) => (
                <tr key={`${u.username}-${i}`} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{u.username}</td>
                  <td className="px-4 py-3">
                    <div className="text-slate-300 text-xs">{u.framedIp ?? "—"}</div>
                    <div className="text-slate-500 text-xs">{u.callingMac ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{u.location?.name ?? u.nasIp ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{fmtDuration(u.sessionSecs)}</td>
                  <td className="px-4 py-3 text-blue-400 text-xs">{fmtMb(u.inputMb)}</td>
                  <td className="px-4 py-3 text-emerald-400 text-xs">{fmtMb(u.outputMb)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-500 text-center">Auto-refresh setiap 15 detik</p>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  icon, label, value, sub, color,
}: {
  icon:  React.ReactNode;
  label: string;
  value: string;
  sub:   string;
  color: "emerald" | "red" | "blue" | "purple";
}) {
  const bg = {
    emerald: "bg-emerald-500/10 border-emerald-500/20",
    red:     "bg-red-500/10 border-red-500/20",
    blue:    "bg-blue-500/10 border-blue-500/20",
    purple:  "bg-purple-500/10 border-purple-500/20",
  }[color];

  return (
    <div className={`${bg} border rounded-xl p-4`}>
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

function LocationCard({ loc }: { loc: LocationStatus }) {
  return (
    <div className={`bg-white/5 border rounded-xl p-4 ${loc.routerOnline ? "border-emerald-500/20" : "border-red-500/20"}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium text-white">{loc.name}</h3>
          {loc.address && <p className="text-xs text-slate-500 mt-0.5">{loc.address}</p>}
        </div>
        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
          loc.routerOnline
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-red-500/20 text-red-400"
        }`}>
          {loc.routerOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
          {loc.routerOnline ? "Online" : "Offline"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-slate-500">IP Router</p>
          <p className="text-slate-300 font-mono text-xs">{loc.mikrotikIp}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">User Aktif</p>
          <p className="text-white font-semibold">{loc.activeUsers}</p>
        </div>
      </div>
    </div>
  );
}
