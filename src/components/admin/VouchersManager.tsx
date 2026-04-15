"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  QrCode, Download, Printer, Plus, RefreshCw, ChevronDown,
  X, CheckSquare, Square,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

// ─── shared types ─────────────────────────────────────────────────────────────

interface PackageOption { id: number; name: string; type: string; price: string }
interface LocationOption { id: number; name: string }
interface VoucherRow {
  id:          number;
  code:        string;
  status:      "unused" | "active" | "expired";
  usedByMac:   string | null;
  usedAt:      string | null;
  expiredAt:   string | null;
  quotaUsedMb: string;
  createdAt:   string;
  package:     { id: number; name: string; price: string; type: string };
  location:    { id: number; name: string } | null;
}

interface Pagination { total: number; page: number; pages: number }

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── main component ───────────────────────────────────────────────────────────

export function VouchersManager({
  packages,
  locations,
}: {
  packages:  PackageOption[];
  locations: LocationOption[];
}) {
  const [tab, setTab] = useState<"list" | "generate">("list");

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit mb-6">
        {(["list", "generate"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t === "list" ? "Daftar Voucher" : "Generate Voucher"}
          </button>
        ))}
      </div>

      {tab === "list"
        ? <VoucherListTab packages={packages} locations={locations} />
        : <VoucherGenerateTab packages={packages.filter((p) => p.type === "voucher")} locations={locations} />
      }
    </div>
  );
}

// ─── List Tab ─────────────────────────────────────────────────────────────────

function VoucherListTab({
  packages, locations,
}: {
  packages:  PackageOption[];
  locations: LocationOption[];
}) {
  const router = useRouter();
  const [vouchers,   setVouchers]   = useState<VoucherRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, pages: 0 });
  const [loading,    setLoading]    = useState(false);
  const [selected,   setSelected]   = useState<Set<number>>(new Set());

  // Filters
  const [status,     setStatus]     = useState("");
  const [packageId,  setPackageId]  = useState("");
  const [locationId, setLocationId] = useState("");
  const [from,       setFrom]       = useState("");
  const [to,         setTo]         = useState("");
  const [page,       setPage]       = useState(1);

  // QR modal
  const [qrModal, setQrModal] = useState<{ code: string; qr: string } | null>(null);
  const [qrLoading, setQrLoading] = useState<number | null>(null);

  const [, startTransition] = useTransition();

  const fetchVouchers = useCallback(async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "50" });
    if (status)     params.set("status",     status);
    if (packageId)  params.set("packageId",  packageId);
    if (locationId) params.set("locationId", locationId);
    if (from)       params.set("from",       from);
    if (to)         params.set("to",         to);

    try {
      const res  = await fetch(`/api/admin/vouchers?${params}`);
      const data = await res.json() as { ok: boolean; vouchers: VoucherRow[]; pagination: Pagination };
      if (data.ok) {
        setVouchers(data.vouchers);
        setPagination(data.pagination);
        setPage(p);
        setSelected(new Set());
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [status, packageId, locationId, from, to]);

  async function showQR(voucher: VoucherRow) {
    setQrLoading(voucher.id);
    try {
      const res  = await fetch(`/api/admin/vouchers/${voucher.id}/qr`);
      const data = await res.json() as { ok: boolean; code: string; qr: string };
      if (data.ok) setQrModal({ code: data.code, qr: data.qr });
    } catch { /* ignore */ }
    finally { setQrLoading(null); }
  }

  function downloadQR(code: string, qr: string) {
    const a = document.createElement("a");
    a.href     = qr;
    a.download = `voucher-${code}.png`;
    a.click();
  }

  function toggleSelect(id: number) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    setSelected((prev) => prev.size === vouchers.length ? new Set() : new Set(vouchers.map((v) => v.id)));
  }

  function handlePrint() {
    const ids = Array.from(selected).join(",");
    if (!ids) return;
    startTransition(() => router.push(`/admin/vouchers/print?ids=${ids}`));
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          <SelectField label="Status" value={status} onChange={setStatus}>
            <option value="">Semua</option>
            <option value="unused">Tersedia</option>
            <option value="active">Aktif</option>
            <option value="expired">Expired</option>
          </SelectField>
          <SelectField label="Paket" value={packageId} onChange={setPackageId}>
            <option value="">Semua Paket</option>
            {packages.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </SelectField>
          <SelectField label="Lokasi" value={locationId} onChange={setLocationId}>
            <option value="">Semua Lokasi</option>
            {locations.map((l) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
          </SelectField>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Dari</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Sampai</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={() => fetchVouchers(1)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            Tampilkan
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2.5">
          <p className="text-sm text-blue-300">{selected.size} voucher dipilih</p>
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors">
            <Printer className="w-3.5 h-3.5" />
            Cetak
          </button>
          <button onClick={() => setSelected(new Set())}
            className="text-xs text-slate-400 hover:text-white transition-colors ml-auto">
            Batalkan pilihan
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <p className="text-xs text-slate-500">{pagination.total} voucher</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleAll} className="text-slate-500 hover:text-white transition-colors">
                    {selected.size === vouchers.length && vouchers.length > 0
                      ? <CheckSquare className="w-4 h-4 text-blue-400" />
                      : <Square className="w-4 h-4" />
                    }
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Kode</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Paket</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Lokasi</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Dipakai</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Expired</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />Memuat...
                </td></tr>
              )}
              {!loading && vouchers.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-500">
                  Klik "Tampilkan" untuk melihat voucher
                </td></tr>
              )}
              {!loading && vouchers.map((v) => (
                <tr key={v.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => toggleSelect(v.id)} className="text-slate-500 hover:text-white transition-colors">
                      {selected.has(v.id)
                        ? <CheckSquare className="w-4 h-4 text-blue-400" />
                        : <Square className="w-4 h-4" />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-white text-xs tracking-widest">{v.code}</td>
                  <td className="px-4 py-3">
                    <p className="text-white text-xs">{v.package.name}</p>
                    <p className="text-slate-500 text-xs">{v.package.price ? `Rp ${Number(v.package.price).toLocaleString("id-ID")}` : ""}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{v.location?.name ?? <span className="italic text-slate-600">Global</span>}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={v.status === "unused" ? "unused" : v.status === "active" ? "active" : "expired"} />
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    <p className="font-mono">{v.usedByMac ?? "—"}</p>
                    <p>{fmtDate(v.usedAt)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{fmtDate(v.expiredAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => showQR(v)}
                        disabled={qrLoading === v.id}
                        title="Lihat QR"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-40"
                      >
                        {qrLoading === v.id
                          ? <RefreshCw className="w-4 h-4 animate-spin" />
                          : <QrCode className="w-4 h-4" />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-slate-500">Halaman {page} dari {pagination.pages}</p>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => fetchVouchers(page - 1)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors">
                ← Prev
              </button>
              <button disabled={page >= pagination.pages} onClick={() => fetchVouchers(page + 1)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setQrModal(null)} />
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl p-6 w-72 shadow-2xl text-center">
            <button onClick={() => setQrModal(null)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrModal.qr} alt={qrModal.code} className="w-48 h-48 mx-auto rounded-xl border border-white/10 bg-white p-2" />
            <p className="mt-3 font-mono text-white tracking-widest font-bold">{qrModal.code}</p>
            <button
              onClick={() => downloadQR(qrModal.code, qrModal.qr)}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PNG
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Generate Tab ─────────────────────────────────────────────────────────────

interface GeneratedVoucher { id: number; code: string; package: { name: string; price: string } }

function VoucherGenerateTab({
  packages, locations,
}: {
  packages:  PackageOption[];
  locations: LocationOption[];
}) {
  const router = useRouter();
  const [packageId,  setPackageId]  = useState("");
  const [count,      setCount]      = useState("10");
  const [locationId, setLocationId] = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [generated,  setGenerated]  = useState<GeneratedVoucher[]>([]);
  const [, startTransition] = useTransition();

  async function handleGenerate() {
    if (!packageId) { setError("Pilih paket terlebih dahulu"); return; }
    const n = parseInt(count);
    if (isNaN(n) || n < 1 || n > 100) { setError("Jumlah harus antara 1-100"); return; }

    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/admin/vouchers/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          packageId:  parseInt(packageId),
          count:      n,
          locationId: locationId ? parseInt(locationId) : null,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; vouchers?: GeneratedVoucher[] };
      if (!res.ok) { setError(data.error ?? "Gagal generate"); return; }
      setGenerated(data.vouchers ?? []);
    } catch {
      setError("Tidak dapat terhubung ke server");
    } finally {
      setLoading(false);
    }
  }

  function handlePrintAll() {
    const ids = generated.map((v) => v.id).join(",");
    startTransition(() => router.push(`/admin/vouchers/print?ids=${ids}`));
  }

  return (
    <div className="space-y-6 max-w-xl">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
        <SelectField label="Paket Voucher" value={packageId} onChange={setPackageId}>
          <option value="">-- Pilih Paket --</option>
          {packages.map((p) => <option key={p.id} value={String(p.id)}>{p.name} — Rp {Number(p.price).toLocaleString("id-ID")}</option>)}
        </SelectField>

        <div>
          <label className="block text-xs text-slate-500 mb-1">Jumlah Voucher (1–100)</label>
          <input type="number" min="1" max="100" value={count} onChange={(e) => setCount(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        </div>

        <SelectField label="Lokasi (opsional)" value={locationId} onChange={setLocationId}>
          <option value="">Tidak dikaitkan ke lokasi</option>
          {locations.map((l) => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
        </SelectField>

        <button onClick={handleGenerate} disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
          {loading
            ? <><RefreshCw className="w-4 h-4 animate-spin" />Generating...</>
            : <><Plus className="w-4 h-4" />Generate {count || 0} Voucher</>
          }
        </button>
      </div>

      {/* Results */}
      {generated.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-white">{generated.length} voucher berhasil dibuat</p>
            <button onClick={handlePrintAll}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">
              <Printer className="w-4 h-4" />
              Cetak Semua
            </button>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-900/90">
                  <tr className="border-b border-white/5">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">#</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Kode Voucher</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Paket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {generated.map((v, i) => (
                    <tr key={v.id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-2 text-slate-500 text-xs">{i + 1}</td>
                      <td className="px-4 py-2 font-mono text-white tracking-widest text-sm">{v.code}</td>
                      <td className="px-4 py-2 text-slate-400 text-xs">{v.package.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── small helper ─────────────────────────────────────────────────────────────

function SelectField({ label, value, onChange, children }: {
  label:    string;
  value:    string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl pl-3 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
          {children}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
      </div>
    </div>
  );
}
