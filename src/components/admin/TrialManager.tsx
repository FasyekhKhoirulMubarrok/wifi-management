"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Settings, ClockIcon, TrendingUp, RefreshCw, CheckCircle, XCircle,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── types ────────────────────────────────────────────────────────────────────

interface TrialConfig {
  locationId:      number;
  locationName:    string;
  durationMinutes: number;
  speedKbps:       number;
  isActive:        boolean;
}

interface TrialLog {
  id:         number;
  macAddress: string;
  usedAt:     string;
  expiredAt:  string;
  location:   { id: number; name: string };
}

interface PerLocationStat {
  locationId:       number;
  locationName:     string;
  totalTrials:      number;
  uniqueDevices:    number;
  convertedDevices: number;
  conversionRate:   number;
}

interface MonthlyTrend {
  month:          string;
  trials:         number;
  converted:      number;
  conversionRate: number;
}

// ─── main component ───────────────────────────────────────────────────────────

type Tab = "config" | "logs" | "stats";

export function TrialManager() {
  const [tab, setTab] = useState<Tab>("config");

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
        {(["config", "logs", "stats"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t === "config" ? "Konfigurasi" : t === "logs" ? "Log Hari Ini" : "Statistik Konversi"}
          </button>
        ))}
      </div>

      {tab === "config" && <ConfigTab />}
      {tab === "logs"   && <LogsTab />}
      {tab === "stats"  && <StatsTab />}
    </div>
  );
}

// ─── Config Tab ───────────────────────────────────────────────────────────────

function ConfigTab() {
  const [configs, setConfigs]   = useState<TrialConfig[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState<Record<number, Partial<TrialConfig>>>({});
  const [saving,  setSaving]    = useState<Record<number, boolean>>({});

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/trial/config")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setConfigs(d.configs); })
      .finally(() => setLoading(false));
  }, []);

  function startEdit(cfg: TrialConfig) {
    setEditing((prev) => ({
      ...prev,
      [cfg.locationId]: {
        durationMinutes: cfg.durationMinutes,
        speedKbps:       cfg.speedKbps,
        isActive:        cfg.isActive,
      },
    }));
  }

  function cancelEdit(locationId: number) {
    setEditing((prev) => { const n = { ...prev }; delete n[locationId]; return n; });
  }

  async function saveEdit(locationId: number) {
    const draft = editing[locationId];
    if (!draft) return;
    setSaving((prev) => ({ ...prev, [locationId]: true }));
    try {
      const res = await fetch(`/api/admin/trial/config/${locationId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(draft),
      });
      const d = await res.json();
      if (d.ok) {
        setConfigs((prev) => prev.map((c) =>
          c.locationId === locationId ? { ...c, ...draft } : c,
        ));
        cancelEdit(locationId);
      }
    } finally {
      setSaving((prev) => ({ ...prev, [locationId]: false }));
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <Settings size={16} className="text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-300">Konfigurasi Trial per Lokasi</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs uppercase border-b border-white/10">
              <th className="px-4 py-3 text-left">Lokasi</th>
              <th className="px-4 py-3 text-center">Durasi (menit)</th>
              <th className="px-4 py-3 text-center">Kecepatan (Kbps)</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {configs.map((cfg) => {
              const draft = editing[cfg.locationId];
              const isSav = saving[cfg.locationId];
              return (
                <tr key={cfg.locationId} className="hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-white">{cfg.locationName}</td>
                  <td className="px-4 py-3 text-center">
                    {draft ? (
                      <input
                        type="number" min={1} max={1440}
                        value={draft.durationMinutes ?? cfg.durationMinutes}
                        onChange={(e) => setEditing((prev) => ({
                          ...prev,
                          [cfg.locationId]: { ...prev[cfg.locationId], durationMinutes: parseInt(e.target.value) },
                        }))}
                        className="w-20 bg-slate-700 border border-white/20 rounded px-2 py-1 text-center text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-slate-300">{cfg.durationMinutes}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {draft ? (
                      <input
                        type="number" min={64} max={102400}
                        value={draft.speedKbps ?? cfg.speedKbps}
                        onChange={(e) => setEditing((prev) => ({
                          ...prev,
                          [cfg.locationId]: { ...prev[cfg.locationId], speedKbps: parseInt(e.target.value) },
                        }))}
                        className="w-24 bg-slate-700 border border-white/20 rounded px-2 py-1 text-center text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-slate-300">{cfg.speedKbps}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {draft ? (
                      <button
                        onClick={() => setEditing((prev) => ({
                          ...prev,
                          [cfg.locationId]: { ...prev[cfg.locationId], isActive: !draft.isActive },
                        }))}
                        className={`text-xs px-2 py-1 rounded-full ${
                          draft.isActive
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-slate-600/40 text-slate-400"
                        }`}
                      >
                        {draft.isActive ? "Aktif" : "Nonaktif"}
                      </button>
                    ) : (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        cfg.isActive
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-slate-600/40 text-slate-400"
                      }`}>
                        {cfg.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {draft ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => saveEdit(cfg.locationId)}
                          disabled={isSav}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg disabled:opacity-50"
                        >
                          {isSav ? "..." : "Simpan"}
                        </button>
                        <button
                          onClick={() => cancelEdit(cfg.locationId)}
                          className="text-xs text-slate-400 hover:text-white px-2 py-1"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(cfg)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────

function LogsTab() {
  const [logs,    setLogs]    = useState<TrialLog[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/trial/logs")
      .then((r) => r.json())
      .then((d) => { if (d.ok) { setLogs(d.logs); setTotal(d.total); } })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchLogs();
    const timer = setInterval(fetchLogs, 60_000);
    return () => clearInterval(timer);
  }, [fetchLogs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClockIcon size={16} className="text-slate-400" />
          <span className="text-sm text-slate-400">
            Total trial hari ini: <strong className="text-white">{total}</strong>
          </span>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-slate-500 text-sm">Memuat...</div>
        ) : logs.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">Belum ada trial hari ini</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs uppercase border-b border-white/10">
                  <th className="px-4 py-3 text-left">MAC Address</th>
                  <th className="px-4 py-3 text-left">Lokasi</th>
                  <th className="px-4 py-3 text-left">Waktu Mulai</th>
                  <th className="px-4 py-3 text-left">Waktu Selesai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-mono text-sm text-slate-300">{log.macAddress}</td>
                    <td className="px-4 py-3 text-slate-300">{log.location.name}</td>
                    <td className="px-4 py-3 text-slate-300">{new Date(log.usedAt).toLocaleTimeString("id-ID")}</td>
                    <td className="px-4 py-3 text-slate-300">{new Date(log.expiredAt).toLocaleTimeString("id-ID")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab() {
  const [perLocation, setPerLocation] = useState<PerLocationStat[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [summary, setSummary] = useState({ totalTrials: 0, totalConverted: 0, totalDevices: 0, overallRate: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/trial/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setPerLocation(d.perLocation);
          setMonthlyTrend(d.monthlyTrend);
          setSummary(d.summary);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Trial",      value: summary.totalTrials,    color: "blue"    },
          { label: "Perangkat Unik",   value: summary.totalDevices,   color: "purple"  },
          { label: "Konversi",         value: summary.totalConverted, color: "emerald" },
          { label: "Tingkat Konversi", value: `${summary.overallRate}%`, color: "amber" },
        ].map((item) => (
          <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-1">{item.label}</p>
            <p className="text-2xl font-bold text-white">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly trend chart */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-300">Tren Konversi Bulanan</h3>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={monthlyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
            />
            <Legend />
            <Line type="monotone" dataKey="trials"    name="Trial"    stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="converted" name="Konversi" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Per-location table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-slate-300">Konversi per Lokasi</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs uppercase border-b border-white/10">
                <th className="px-4 py-3 text-left">Lokasi</th>
                <th className="px-4 py-3 text-right">Total Trial</th>
                <th className="px-4 py-3 text-right">Perangkat Unik</th>
                <th className="px-4 py-3 text-right">Konversi</th>
                <th className="px-4 py-3 text-right">Tingkat (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {perLocation.map((loc) => (
                <tr key={loc.locationId} className="hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-white">{loc.locationName}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{loc.totalTrials}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{loc.uniqueDevices}</td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-medium">{loc.convertedDevices}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${loc.conversionRate >= 20 ? "text-emerald-400" : loc.conversionRate >= 10 ? "text-amber-400" : "text-red-400"}`}>
                      {loc.conversionRate}%
                    </span>
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center gap-2 text-slate-500 text-sm py-10 justify-center">
      <CheckCircle size={16} className="animate-spin" />
      Memuat...
    </div>
  );
}

// Suppress unused import warning
void XCircle;
