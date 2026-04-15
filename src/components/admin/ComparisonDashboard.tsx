"use client";

import { useState, useCallback, useEffect } from "react";
import { FileSpreadsheet, FileText, TrendingUp, TrendingDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts";

// ─── types ────────────────────────────────────────────────────────────────────

interface ComparisonEntry {
  locationId:   number;
  locationName: string;
  revenue:      number;
  activeUsers:  number;
  totalDataMb:  number;
  vouchersSold: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtRp(n: number) {
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000)     return `Rp ${(n / 1_000).toFixed(0)}rb`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function fmtMb(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function thisMonthRange() {
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

type MetricKey = "revenue" | "activeUsers" | "totalDataMb" | "vouchersSold";

const METRICS: { key: MetricKey; label: string; fmt: (v: number) => string }[] = [
  { key: "revenue",      label: "Revenue",         fmt: fmtRp  },
  { key: "activeUsers",  label: "User Aktif",       fmt: (v) => String(v) },
  { key: "totalDataMb",  label: "Data Terpakai",    fmt: fmtMb  },
  { key: "vouchersSold", label: "Voucher Terjual",  fmt: (v) => String(v) },
];

const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

// ─── main component ───────────────────────────────────────────────────────────

export function ComparisonDashboard() {
  const [from,      setFrom]      = useState(thisMonthRange().from);
  const [to,        setTo]        = useState(thisMonthRange().to);
  const [data,      setData]      = useState<ComparisonEntry[]>([]);
  const [bestId,    setBestId]    = useState<number | null>(null);
  const [worstId,   setWorstId]   = useState<number | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [activeMetric, setActiveMetric] = useState<MetricKey>("revenue");

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/comparison?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setData(d.comparison);
          setBestId(d.best  ?? null);
          setWorstId(d.worst ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function buildExportUrl(format: "excel" | "pdf") {
    return `/api/admin/reports/export?format=${format}&type=revenue&from=${from}&to=${to}`;
  }

  const metric = METRICS.find((m) => m.key === activeMetric)!;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center bg-white/5 border border-white/10 rounded-xl p-3">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-slate-500 text-xs">–</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <div className="ml-auto flex gap-2">
          <a href={buildExportUrl("excel")}
            className="flex items-center gap-1 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg transition-colors">
            <FileSpreadsheet size={12} /> Excel
          </a>
          <a href={buildExportUrl("pdf")}
            className="flex items-center gap-1 text-xs bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg transition-colors">
            <FileText size={12} /> PDF
          </a>
        </div>
      </div>

      {loading && (
        <div className="text-center py-10 text-slate-500 text-sm">Memuat data...</div>
      )}

      {!loading && data.length > 0 && (
        <>
          {/* Best / Worst highlight */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { id: bestId,  label: "Performa Terbaik",  Icon: TrendingUp,   color: "emerald" },
              { id: worstId, label: "Performa Terendah", Icon: TrendingDown, color: "red"     },
            ].map(({ id, label, Icon, color }) => {
              const entry = data.find((d) => d.locationId === id);
              if (!entry) return null;
              const cls = color === "emerald"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border-red-500/20 text-red-400";
              return (
                <div key={label} className={`${cls} border rounded-xl p-4`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={16} />
                    <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
                  </div>
                  <p className="text-white font-bold text-lg">{entry.locationName}</p>
                  <p className="text-sm mt-1">Revenue: {fmtRp(entry.revenue)} · {entry.activeUsers} user aktif</p>
                </div>
              );
            })}
          </div>

          {/* Metric selector for chart */}
          <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setActiveMetric(m.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeMetric === m.key ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Bar chart */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">
              Perbandingan {metric.label} per Lokasi
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="locationName" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => metric.fmt(v)} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                  formatter={(v) => [metric.fmt(Number(v ?? 0)), metric.label]}
                />
                <Bar dataKey={activeMetric} radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell
                      key={entry.locationId}
                      fill={
                        entry.locationId === bestId  ? "#10b981" :
                        entry.locationId === worstId ? "#ef4444" :
                        COLORS[index % COLORS.length]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Comparison table */}
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-semibold text-slate-300">Tabel Perbandingan</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase border-b border-white/10">
                    <th className="px-4 py-3 text-left">Lokasi</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">User Aktif</th>
                    <th className="px-4 py-3 text-right">Data Terpakai</th>
                    <th className="px-4 py-3 text-right">Voucher Terjual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.map((row) => {
                    const isBest  = row.locationId === bestId;
                    const isWorst = row.locationId === worstId;
                    return (
                      <tr key={row.locationId} className={`hover:bg-white/5 ${isBest ? "bg-emerald-500/5" : isWorst ? "bg-red-500/5" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{row.locationName}</span>
                            {isBest  && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">Terbaik</span>}
                            {isWorst && <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">Terendah</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-white font-medium">{fmtRp(row.revenue)}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{row.activeUsers}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{fmtMb(row.totalDataMb)}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{row.vouchersSold}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && data.length === 0 && (
        <div className="text-center py-12 text-slate-500">Tidak ada data untuk periode ini</div>
      )}
    </div>
  );
}
