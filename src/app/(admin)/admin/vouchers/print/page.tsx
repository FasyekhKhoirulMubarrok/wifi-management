"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PrintVoucher {
  id:       number;
  code:     string;
  qr:       string;
  location: string | null;
  package: {
    name:          string;
    price:         string;
    quotaLimitMb:  string | null;
    timeLimitDays: number | null;
    speedDownKbps: number;
  };
}

function fmtIDR(s: string) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(s));
}

function fmtQuota(mb: string | null) {
  if (!mb) return "Unlimited";
  const n = Number(mb);
  return n >= 1024 ? `${(n / 1024).toFixed(0)} GB` : `${n} MB`;
}

function fmtSpeed(kbps: number) {
  return kbps >= 1024 ? `${(kbps / 1024).toFixed(0)} Mbps` : `${kbps} Kbps`;
}

export default function VoucherPrintPage() {
  const searchParams = useSearchParams();
  const ids          = searchParams.get("ids") ?? "";

  const [vouchers, setVouchers] = useState<PrintVoucher[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  useEffect(() => {
    if (!ids) { setError("Tidak ada voucher yang dipilih"); setLoading(false); return; }
    fetch(`/api/admin/vouchers/print?ids=${ids}`)
      .then((r) => r.json())
      .then((d: { ok?: boolean; error?: string; vouchers?: PrintVoucher[] }) => {
        if (!d.ok) { setError(d.error ?? "Gagal memuat data"); return; }
        setVouchers(d.vouchers ?? []);
      })
      .catch(() => setError("Tidak dapat terhubung ke server"))
      .finally(() => setLoading(false));
  }, [ids]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-400" />
          <p className="text-slate-400">Menyiapkan kartu voucher...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link href="/admin/vouchers" className="text-blue-400 hover:underline text-sm">← Kembali</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Screen-only toolbar — hidden during print via globals.css */}
      <div data-no-print className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/vouchers"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 border border-white/10 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Link>
          <p className="text-sm text-slate-400">{vouchers.length} kartu voucher siap cetak</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <Printer className="w-4 h-4" />
          Cetak / Save PDF
        </button>
      </div>

      {/* Voucher cards grid */}
      <div className="voucher-print-grid">
        {vouchers.map((v) => (
          <VoucherCard key={v.id} voucher={v} />
        ))}
      </div>

      {/* Print-specific styles */}
      <style>{`
        .voucher-print-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        @media print {
          .voucher-print-grid {
            gap: 6mm;
            grid-template-columns: repeat(2, 1fr);
          }
          .voucher-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

function VoucherCard({ voucher: v }: { voucher: PrintVoucher }) {
  return (
    <div className="voucher-card bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-200"
      style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Header */}
      <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* WiFi icon SVG inline */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
          <span className="text-white font-bold text-sm tracking-tight">
            FadilJaya<span className="opacity-75">.NET</span>
          </span>
        </div>
        {v.location && (
          <span className="text-blue-100 text-xs">{v.location}</span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex items-start gap-4">
        {/* QR Code */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={v.qr} alt={v.code} className="w-20 h-20 rounded border border-slate-100 shrink-0" />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 mb-1">{v.package.name}</p>
          <p className="font-mono font-bold text-slate-900 tracking-widest text-sm mb-2">{v.code}</p>

          <div className="space-y-0.5 text-xs text-slate-600">
            <div className="flex justify-between gap-2">
              <span>Kuota</span>
              <span className="font-medium text-slate-800">{fmtQuota(v.package.quotaLimitMb)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Masa</span>
              <span className="font-medium text-slate-800">
                {v.package.timeLimitDays ? `${v.package.timeLimitDays} Hari` : "Unlimited"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span>Speed</span>
              <span className="font-medium text-slate-800">{fmtSpeed(v.package.speedDownKbps)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-between bg-slate-50">
        <p className="text-xs text-slate-400">Scan QR untuk aktivasi</p>
        <p className="text-sm font-bold text-blue-600">{fmtIDR(v.package.price)}</p>
      </div>
    </div>
  );
}
