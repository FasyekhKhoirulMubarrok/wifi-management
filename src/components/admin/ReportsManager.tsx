"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Download, FileSpreadsheet, FileText, RefreshCw,
  TrendingUp, Users, Database, Ticket, Clock,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown as ChevronDownIcon,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── types ────────────────────────────────────────────────────────────────────

interface LocationOption { id: number; name: string }

type TabId = "revenue" | "data-usage" | "active-users" | "vouchers" | "session-logs";

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtRp(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function fmtMb(mb: number) {
  if (mb >= 1024) return (mb / 1024).toFixed(2) + " GB";
  return mb.toFixed(0) + " MB";
}

function fmtDur(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── date preset helpers ──────────────────────────────────────────────────────

function todayRange() {
  const d = new Date();
  return { from: d.toISOString().slice(0, 10), to: d.toISOString().slice(0, 10) };
}

function thisWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
}

function thisMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

// ─── main component ───────────────────────────────────────────────────────────

export function ReportsManager({ locations }: { locations: LocationOption[] }) {
  const [tab,        setTab]        = useState<TabId>("revenue");
  const [from,       setFrom]       = useState(thisMonthRange().from);
  const [to,         setTo]         = useState(thisMonthRange().to);
  const [locationId, setLocationId] = useState("");
  const [loading,    setLoading]    = useState(false);

  // ─── export helper ────────────────────────────────────────────────────────
  function buildExportUrl(format: "excel" | "pdf") {
    const p = new URLSearchParams({ format, type: tab, from, to });
    if (locationId) p.set("locationId", locationId);
    return `/api/admin/reports/export?${p}`;
  }

  function applyPreset(preset: "today" | "week" | "month") {
    const range = preset === "today" ? todayRange() : preset === "week" ? thisWeekRange() : thisMonthRange();
    setFrom(range.from);
    setTo(range.to);
  }

  // ─── filter bar ───────────────────────────────────────────────────────────
  const filterBar = (
    <div className="flex flex-wrap gap-2 items-center bg-white/5 border border-white/10 rounded-xl p-3 mb-4">
      {/* Presets */}
      {(["today", "week", "month"] as const).map((p) => (
        <button
          key={p}
          onClick={() => applyPreset(p)}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors"
        >
          {p === "today" ? "Hari Ini" : p === "week" ? "Minggu Ini" : "Bulan Ini"}
        </button>
      ))}

      <span className="text-slate-600 text-xs">|</span>

      {/* Date range */}
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
        className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <span className="text-slate-500 text-xs">–</span>
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
        className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {/* Location */}
      <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
        className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">Semua Lokasi</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>

      <div className="ml-auto flex gap-2">
        {/* Only revenue, vouchers, session-logs have export */}
        {["revenue", "vouchers", "session-logs"].includes(tab) && (
          <>
            <a
              href={buildExportUrl("excel")}
              className="flex items-center gap-1 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              <FileSpreadsheet size={12} /> Excel
            </a>
            <a
              href={buildExportUrl("pdf")}
              className="flex items-center gap-1 text-xs bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              <FileText size={12} /> PDF
            </a>
          </>
        )}
      </div>
    </div>
  );

  // ─── tabs ─────────────────────────────────────────────────────────────────
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "revenue",      label: "Pendapatan",    icon: <TrendingUp size={14} /> },
    { id: "data-usage",   label: "Penggunaan Data", icon: <Database size={14} /> },
    { id: "active-users", label: "User Aktif",    icon: <Users size={14} /> },
    { id: "vouchers",     label: "Voucher",        icon: <Ticket size={14} /> },
    { id: "session-logs", label: "Session Log",   icon: <Clock size={14} /> },
  ];

  return (
    <div>
      {/* Tab navigation */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-full mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {filterBar}

      {tab === "revenue"      && <RevenueTab      from={from} to={to} locationId={locationId} setLoading={setLoading} />}
      {tab === "data-usage"   && <DataUsageTab    from={from} to={to} locationId={locationId} setLoading={setLoading} />}
      {tab === "active-users" && <ActiveUsersTab  from={from} to={to} locationId={locationId} setLoading={setLoading} />}
      {tab === "vouchers"     && <VouchersTab     from={from} to={to} locationId={locationId} setLoading={setLoading} />}
      {tab === "session-logs" && <SessionLogsTab  from={from} to={to} locationId={locationId} setLoading={setLoading} />}
    </div>
  );
}

// ─── shared filter props ──────────────────────────────────────────────────────

interface FilterProps { from: string; to: string; locationId: string; setLoading: (v: boolean) => void }

// ─── Revenue Tab ──────────────────────────────────────────────────────────────

interface RevenueData {
  totalRevenue: number;
  dailyChart:   { date: string; revenue: number }[];
  perPackage:   { id: number; name: string; count: number; revenue: number }[];
  transactions: { id: string; type: string; reference: string; package: string; amount: number; date: string }[];
}

function RevenueTab({ from, to, locationId, setLoading }: FilterProps) {
  const [data, setData] = useState<RevenueData | null>(null);

  const fetch_ = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ from, to });
    if (locationId) p.set("locationId", locationId);
    fetch(`/api/admin/reports/revenue?${p}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setData(d); })
      .finally(() => setLoading(false));
  }, [from, to, locationId, setLoading]);

  useEffect(() => { fetch_(); }, [fetch_]);

  if (!data) return <div className="text-slate-500 text-sm text-center py-10">Memuat...</div>;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Pendapatan</p>
        <p className="text-3xl font-bold text-white">{fmtRp(data.totalRevenue)}</p>
      </div>

      {/* Daily chart */}
      {data.dailyChart.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Pendapatan Harian</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.dailyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                formatter={(v) => [fmtRp(Number(v ?? 0)), "Pendapatan"]}
              />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-package */}
      {data.perPackage.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-slate-300">Breakdown per Paket</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-white/10">
                <th className="px-4 py-2 text-left">Paket</th>
                <th className="px-4 py-2 text-right">Jumlah Transaksi</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.perPackage.map((p) => (
                <tr key={p.id} className="hover:bg-white/5">
                  <td className="px-4 py-2 text-slate-300">{p.name}</td>
                  <td className="px-4 py-2 text-right text-slate-300">{p.count}</td>
                  <td className="px-4 py-2 text-right text-white font-medium">{fmtRp(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transactions */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-slate-300">Transaksi ({data.transactions.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-white/10">
                <th className="px-4 py-2 text-left">Tipe</th>
                <th className="px-4 py-2 text-left">Referensi</th>
                <th className="px-4 py-2 text-left">Paket</th>
                <th className="px-4 py-2 text-right">Jumlah</th>
                <th className="px-4 py-2 text-left">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.transactions.map((t) => (
                <tr key={t.id} className="hover:bg-white/5">
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.type === "voucher" ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                    }`}>{t.type}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-300 font-mono text-xs">{t.reference}</td>
                  <td className="px-4 py-2 text-slate-300">{t.package}</td>
                  <td className="px-4 py-2 text-right text-white">{fmtRp(t.amount)}</td>
                  <td className="px-4 py-2 text-slate-400 text-xs">{fmtDate(t.date)}</td>
                </tr>
              ))}
              {data.transactions.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Data Usage Tab ───────────────────────────────────────────────────────────

interface DataUsageData {
  totalDataMb: number;
  users:       { username: string; userType: string; sessions: number; totalDataMb: number; totalSecs: number; location: { id: number; name: string } | null }[];
}

function DataUsageTab({ from, to, locationId, setLoading }: FilterProps) {
  const [data, setData] = useState<DataUsageData | null>(null);

  const fetch_ = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ from, to });
    if (locationId) p.set("locationId", locationId);
    fetch(`/api/admin/reports/data-usage?${p}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setData(d); })
      .finally(() => setLoading(false));
  }, [from, to, locationId, setLoading]);

  useEffect(() => { fetch_(); }, [fetch_]);

  if (!data) return <div className="text-slate-500 text-sm text-center py-10">Memuat...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Data Terpakai</p>
        <p className="text-3xl font-bold text-white">{fmtMb(data.totalDataMb)}</p>
        <p className="text-xs text-slate-500 mt-1">{data.users.length} user unik</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-white/10">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Username</th>
                <th className="px-4 py-3 text-left">Tipe</th>
                <th className="px-4 py-3 text-left">Lokasi</th>
                <th className="px-4 py-3 text-right">Sesi</th>
                <th className="px-4 py-3 text-right">Data Terpakai</th>
                <th className="px-4 py-3 text-right">Total Durasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.users.map((u, i) => (
                <tr key={u.username} className="hover:bg-white/5">
                  <td className="px-4 py-2 text-slate-500 text-xs">{i + 1}</td>
                  <td className="px-4 py-2 font-medium text-white">{u.username}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      u.userType === "subscriber" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"
                    }`}>{u.userType}</span>
                  </td>
                  <td className="px-4 py-2 text-slate-400 text-xs">{u.location?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-right text-slate-300">{u.sessions}</td>
                  <td className="px-4 py-2 text-right text-white font-medium">{fmtMb(u.totalDataMb)}</td>
                  <td className="px-4 py-2 text-right text-slate-300 text-xs">{fmtDur(u.totalSecs)}</td>
                </tr>
              ))}
              {data.users.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Active Users Tab ─────────────────────────────────────────────────────────

interface ActiveUsersData {
  totalUnique:      number;
  uniqueSubscribers: number;
  uniqueVouchers:   number;
  dailyChart:       { date: string; subscribers: number; vouchers: number; total: number }[];
  perLocation:      { locationId: number; locationName: string; uniqueUsers: number }[];
}

function ActiveUsersTab({ from, to, locationId, setLoading }: FilterProps) {
  const [data, setData] = useState<ActiveUsersData | null>(null);

  const fetch_ = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ from, to });
    if (locationId) p.set("locationId", locationId);
    fetch(`/api/admin/reports/active-users?${p}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setData(d); })
      .finally(() => setLoading(false));
  }, [from, to, locationId, setLoading]);

  useEffect(() => { fetch_(); }, [fetch_]);

  if (!data) return <div className="text-slate-500 text-sm text-center py-10">Memuat...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total User Unik", value: data.totalUnique, color: "blue" },
          { label: "Subscriber",       value: data.uniqueSubscribers, color: "emerald" },
          { label: "Voucher",           value: data.uniqueVouchers, color: "purple" },
        ].map((card) => (
          <div key={card.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{card.label}</p>
            <p className="text-2xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {data.dailyChart.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">User Aktif Harian</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.dailyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              <Bar dataKey="subscribers" name="Subscriber" stackId="a" fill="#3b82f6" />
              <Bar dataKey="vouchers"    name="Voucher"    stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.perLocation.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-slate-300">Per Lokasi</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-white/10">
                <th className="px-4 py-2 text-left">Lokasi</th>
                <th className="px-4 py-2 text-right">User Unik</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.perLocation.map((l) => (
                <tr key={l.locationId} className="hover:bg-white/5">
                  <td className="px-4 py-2 text-slate-300">{l.locationName}</td>
                  <td className="px-4 py-2 text-right text-white font-medium">{l.uniqueUsers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Vouchers Tab ─────────────────────────────────────────────────────────────

interface VouchersData {
  summary:    { totalCreated: number; totalUsed: number; totalExpired: number; unused: number };
  perPackage: { id: number; name: string; created: number; used: number; expired: number; revenue: number }[];
}

function VouchersTab({ from, to, locationId, setLoading }: FilterProps) {
  const [data, setData] = useState<VouchersData | null>(null);

  const fetch_ = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ from, to });
    if (locationId) p.set("locationId", locationId);
    fetch(`/api/admin/reports/vouchers?${p}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setData(d); })
      .finally(() => setLoading(false));
  }, [from, to, locationId, setLoading]);

  useEffect(() => { fetch_(); }, [fetch_]);

  if (!data) return <div className="text-slate-500 text-sm text-center py-10">Memuat...</div>;

  const { summary } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Dibuat",   value: summary.totalCreated, color: "slate"   },
          { label: "Dipakai",  value: summary.totalUsed,    color: "emerald" },
          { label: "Expired",  value: summary.totalExpired, color: "red"     },
          { label: "Tersisa",  value: Math.max(0, summary.unused), color: "yellow" },
        ].map((card) => (
          <div key={card.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{card.label}</p>
            <p className="text-2xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-slate-300">Per Paket</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-white/10">
                <th className="px-4 py-2 text-left">Paket</th>
                <th className="px-4 py-2 text-right">Dibuat</th>
                <th className="px-4 py-2 text-right">Dipakai</th>
                <th className="px-4 py-2 text-right">Expired</th>
                <th className="px-4 py-2 text-right">Pendapatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.perPackage.map((p) => (
                <tr key={p.id} className="hover:bg-white/5">
                  <td className="px-4 py-2 text-slate-300">{p.name}</td>
                  <td className="px-4 py-2 text-right text-slate-300">{p.created}</td>
                  <td className="px-4 py-2 text-right text-emerald-400">{p.used}</td>
                  <td className="px-4 py-2 text-right text-red-400">{p.expired}</td>
                  <td className="px-4 py-2 text-right text-white font-medium">{fmtRp(p.revenue)}</td>
                </tr>
              ))}
              {data.perPackage.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Session Logs Tab ─────────────────────────────────────────────────────────

interface SessionLogRow {
  id: number; username: string; userType: string;
  macAddress: string | null; ipAddress: string | null;
  location: { id: number; name: string };
  dataUsedMb: number; durationSecs: number;
  loginAt: string; logoutAt: string | null; terminateCause: string | null;
}

type SessionSortField = "loginAt" | "logoutAt" | "dataUsedMb" | "durationSecs" | "username";

function SessionLogsTab({ from, to, locationId, setLoading }: FilterProps) {
  const [logs,        setLogs]        = useState<SessionLogRow[]>([]);
  const [pagination,  setPagination]  = useState({ total: 0, page: 1, pages: 1 });
  const [search,      setSearch]      = useState("");
  const [page,        setPage]        = useState(1);
  const [sort,        setSort]        = useState<SessionSortField>("loginAt");
  const [dir,         setDir]         = useState<"asc" | "desc">("desc");

  const fetch_ = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ from, to, page: String(page), sort, dir });
    if (locationId) p.set("locationId", locationId);
    if (search)     p.set("search", search);
    fetch(`/api/admin/reports/session-logs?${p}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) { setLogs(d.logs); setPagination(d.pagination); }
      })
      .finally(() => setLoading(false));
  }, [from, to, locationId, search, page, sort, dir, setLoading]);

  useEffect(() => { fetch_(); }, [fetch_]);

  function toggleSort(field: SessionSortField) {
    if (sort === field) setDir((d) => d === "asc" ? "desc" : "asc");
    else { setSort(field); setDir("desc"); }
    setPage(1);
  }

  function SortIcon({ field }: { field: SessionSortField }) {
    if (sort !== field) return <span className="opacity-30"><ChevronDownIcon size={10} /></span>;
    return dir === "asc" ? <ChevronUp size={10} /> : <ChevronDownIcon size={10} />;
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <input
        type="text" value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Cari username..."
        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
      />

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-white/10">
                {([
                  { label: "Username",  field: "username"     },
                  { label: "Tipe",      field: null           },
                  { label: "MAC / IP",  field: null           },
                  { label: "Lokasi",    field: null           },
                  { label: "Data",      field: "dataUsedMb"   },
                  { label: "Durasi",    field: "durationSecs" },
                  { label: "Login",     field: "loginAt"      },
                  { label: "Logout",    field: "logoutAt"     },
                ] as { label: string; field: SessionSortField | null }[]).map(({ label, field }) => (
                  <th key={label} className="px-3 py-2 text-left">
                    {field ? (
                      <button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-white">
                        {label} <SortIcon field={field} />
                      </button>
                    ) : label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5">
                  <td className="px-3 py-2 font-medium text-white">{log.username}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      log.userType === "subscriber" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"
                    }`}>{log.userType === "subscriber" ? "Sub" : "VCR"}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-slate-300 text-xs">{log.macAddress ?? "—"}</div>
                    <div className="text-slate-500 text-xs">{log.ipAddress ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-300 text-xs">{log.location.name}</td>
                  <td className="px-3 py-2 text-right text-slate-300 text-xs">{fmtMb(log.dataUsedMb)}</td>
                  <td className="px-3 py-2 text-right text-slate-300 text-xs">{fmtDur(log.durationSecs)}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{fmtDate(log.loginAt)}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{fmtDate(log.logoutAt)}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Tidak ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
            <p className="text-xs text-slate-500">
              {pagination.total} log · hal. {pagination.page} dari {pagination.pages}
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pagination.page <= 1}
                className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 text-slate-300">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={pagination.page >= pagination.pages}
                className="p-1.5 rounded hover:bg-white/10 disabled:opacity-40 text-slate-300">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
