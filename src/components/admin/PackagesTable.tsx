"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, Plus, ToggleLeft, ToggleRight, ChevronDown } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

export interface PackageRow {
  id:            number;
  name:          string;
  price:         string;
  quotaLimitMb:  string | null;
  timeLimitDays: number | null;
  speedDownKbps: number;
  speedUpKbps:   number;
  throttleKbps:  number;
  type:          "voucher" | "langganan";
  locationId:    number | null;
  location:      { id: number; name: string } | null;
  isActive:      boolean;
  scheduleStart: string | null;
  scheduleEnd:   string | null;
}

function fmtSpeed(kbps: number) {
  return kbps >= 1024 ? `${(kbps / 1024).toFixed(0)} Mbps` : `${kbps} Kbps`;
}

function fmtQuota(mb: string | null) {
  if (!mb) return "Unlimited";
  const n = Number(mb);
  return n >= 1024 ? `${(n / 1024).toFixed(0)} GB` : `${n} MB`;
}

function fmtIDR(s: string) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(s));
}

export function PackagesTable({
  initialPackages,
}: {
  initialPackages: PackageRow[];
}) {
  const router = useRouter();
  const [packages,   setPackages]   = useState(initialPackages);
  const [typeFilter, setTypeFilter] = useState<"" | "voucher" | "langganan">("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const filtered = typeFilter ? packages.filter((p) => p.type === typeFilter) : packages;

  async function handleToggle(pkg: PackageRow) {
    setTogglingId(pkg.id);
    try {
      const res  = await fetch(`/api/admin/packages/${pkg.id}/toggle`, { method: "PATCH" });
      const data = await res.json() as { ok?: boolean; isActive?: boolean; error?: string };
      if (!res.ok) { alert(data.error ?? "Gagal"); return; }
      setPackages((prev) => prev.map((p) => p.id === pkg.id ? { ...p, isActive: data.isActive! } : p));
    } catch {
      alert("Tidak dapat terhubung ke server");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(pkg: PackageRow) {
    if (!confirm(`Hapus paket "${pkg.name}"?`)) return;
    setDeletingId(pkg.id);
    try {
      const res  = await fetch(`/api/admin/packages/${pkg.id}`, { method: "DELETE" });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { alert(data.error ?? "Gagal menghapus"); return; }
      setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
      startTransition(() => router.refresh());
    } catch {
      alert("Tidak dapat terhubung ke server");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <p className="text-sm text-slate-400">{filtered.length} paket</p>
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
              className="appearance-none bg-white/5 border border-white/10 rounded-xl pl-3 pr-8 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Tipe</option>
              <option value="voucher">Voucher</option>
              <option value="langganan">Langganan</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>
        </div>
        <Link
          href="/admin/packages/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah Paket
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Nama</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Tipe</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Harga</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Kuota / Waktu</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Kecepatan</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Lokasi</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                    Belum ada paket. Klik "Tambah Paket" untuk memulai.
                  </td>
                </tr>
              )}
              {filtered.map((pkg) => (
                <tr key={pkg.id} className={`hover:bg-white/[0.03] transition-colors ${!pkg.isActive ? "opacity-50" : ""}`}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-white">{pkg.name}</p>
                    {pkg.scheduleStart && pkg.scheduleEnd && (
                      <p className="text-xs text-amber-400 mt-0.5">{pkg.scheduleStart}–{pkg.scheduleEnd}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                      pkg.type === "voucher"
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                        : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                    }`}>
                      {pkg.type === "voucher" ? "Voucher" : "Langganan"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-white tabular-nums">
                    {fmtIDR(pkg.price)}
                  </td>
                  <td className="px-5 py-3 text-slate-300 text-xs">
                    <p>{fmtQuota(pkg.quotaLimitMb)}</p>
                    <p className="text-slate-500">{pkg.timeLimitDays ? `${pkg.timeLimitDays} hari` : "Unlimited"}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-300 text-xs">
                    <p>↓ {fmtSpeed(pkg.speedDownKbps)}</p>
                    <p className="text-slate-500">↑ {fmtSpeed(pkg.speedUpKbps)}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs">
                    {pkg.location?.name ?? <span className="italic text-slate-600">Semua Lokasi</span>}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={pkg.isActive ? "active" : "expired"} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggle(pkg)}
                        disabled={togglingId === pkg.id}
                        title={pkg.isActive ? "Nonaktifkan" : "Aktifkan"}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
                      >
                        {pkg.isActive
                          ? <ToggleRight className="w-5 h-5 text-emerald-400" />
                          : <ToggleLeft className="w-5 h-5" />
                        }
                      </button>
                      <Link
                        href={`/admin/packages/${pkg.id}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(pkg)}
                        disabled={deletingId === pkg.id}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
