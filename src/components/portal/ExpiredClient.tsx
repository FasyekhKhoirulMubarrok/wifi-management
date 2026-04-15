"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, MessageCircle, QrCode, Package } from "lucide-react";
import dynamic from "next/dynamic";

const QrScanner = dynamic(
  () => import("./QrScanner").then((m) => m.QrScanner),
  { ssr: false },
);

interface PkgItem {
  id:            number;
  name:          string;
  price:         string;
  type:          string;
  quotaLimitMb:  string | null;
  timeLimitDays: number | null;
  speedDownKbps: number;
  speedUpKbps:   number;
}

function fmtMb(mb: string | null) {
  if (!mb) return "Unlimited";
  const n = parseInt(mb);
  return n >= 1024 ? `${(n / 1024).toFixed(0)} GB` : `${n} MB`;
}

export function ExpiredClient() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const mac          = searchParams.get("mac");
  const isVoucher    = searchParams.get("type") === "voucher";

  const [packages, setPackages] = useState<PkgItem[]>([]);
  const [part1, setPart1] = useState("");
  const [part2, setPart2] = useState("");
  const [part3, setPart3] = useState("");
  const [error,  setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [showQr,  setShowQr]  = useState(false);

  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const ref3 = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/portal/packages")
      .then((r) => r.json())
      .then((d: { ok: boolean; packages: PkgItem[] }) => { if (d.ok) setPackages(d.packages); })
      .catch(() => {/* ignore */});
  }, []);

  function handlePart(val: string, set: (v: string) => void, nextRef: React.RefObject<HTMLInputElement | null> | null) {
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    set(cleaned);
    if (cleaned.length === 4 && nextRef?.current) nextRef.current.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, val: string, prevRef: React.RefObject<HTMLInputElement | null> | null) {
    if (e.key === "Backspace" && val === "" && prevRef?.current) prevRef.current.focus();
  }

  const handleQrResult = useCallback((decoded: string) => {
    setShowQr(false);
    const clean = decoded.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length >= 12) {
      setPart1(clean.slice(0, 4));
      setPart2(clean.slice(4, 8));
      setPart3(clean.slice(8, 12));
    } else {
      setError("QR tidak dikenali sebagai kode voucher");
    }
  }, []);

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    if (part1.length < 4 || part2.length < 4 || part3.length < 4) {
      setError("Masukkan kode voucher lengkap");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal/voucher/activate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: `${part1}-${part2}-${part3}`, macAddress: mac }),
      });
      const d = await res.json() as { ok?: boolean; error?: string; code?: string };
      if (!res.ok) {
        if (d.code === "BLOCKED") { window.location.href = "/portal/blocked"; return; }
        setError(d.error ?? "Aktivasi gagal");
        return;
      }
      router.push("/portal/status");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server");
    } finally {
      setLoading(false);
    }
  }

  const whatsappUrl = "https://wa.me/";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {showQr && <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />}

      <div className="w-full max-w-sm space-y-5">
        {/* Expired notice */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>

          {isVoucher ? (
            <>
              <h2 className="text-xl font-bold text-white mb-2">Voucher Telah Habis</h2>
              <p className="text-slate-400 text-sm">Beli voucher baru dan masukkan kode di bawah, atau hubungi admin.</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-2">Kuota/Masa Berlaku Habis</h2>
              <p className="text-slate-400 text-sm">Hubungi admin untuk perpanjang paket Anda.</p>
            </>
          )}
        </div>

        {/* Voucher form (voucher type only) */}
        {isVoucher && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <p className="text-sm text-slate-300 font-medium mb-4 text-center">Masukkan Voucher Baru</p>
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                {[
                  { ref: ref1, val: part1, set: setPart1, next: ref2, prev: null },
                  { ref: ref2, val: part2, set: setPart2, next: ref3, prev: ref1 },
                  { ref: ref3, val: part3, set: setPart3, next: null, prev: ref2 },
                ].map((f, i) => (
                  <span key={i} className="flex items-center gap-2">
                    {i > 0 && <span className="text-slate-500">-</span>}
                    <input
                      ref={f.ref}
                      type="text" inputMode="text" maxLength={4}
                      value={f.val}
                      onChange={(e) => handlePart(e.target.value, f.set, f.next)}
                      onKeyDown={(e) => handleKeyDown(e, f.val, f.prev)}
                      className="w-16 h-12 text-center font-mono font-bold text-sm uppercase bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest"
                    />
                  </span>
                ))}
              </div>

              {error && (
                <p className="text-xs text-red-400 text-center">{error}</p>
              )}

              <button type="button" onClick={() => setShowQr(true)}
                className="w-full flex items-center justify-center gap-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 py-2.5 rounded-xl">
                <QrCode size={14} /> Scan QR Code
              </button>
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium py-2.5 rounded-xl text-sm">
                {loading ? "Mengaktifkan..." : "Aktifkan Voucher"}
              </button>
            </form>
          </div>
        )}

        {/* WhatsApp CTA */}
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 py-3 rounded-xl text-sm font-medium transition-colors">
          <MessageCircle size={16} /> Hubungi Admin via WhatsApp
        </a>

        {/* Available packages */}
        {packages.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <Package size={14} className="text-slate-400" />
              <p className="text-sm font-medium text-slate-300">Paket Tersedia</p>
            </div>
            <div className="divide-y divide-white/5">
              {packages.map((pkg) => (
                <div key={pkg.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{pkg.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {fmtMb(pkg.quotaLimitMb)}
                      {pkg.timeLimitDays ? ` · ${pkg.timeLimitDays} hari` : ""}
                      {` · ${pkg.speedDownKbps >= 1024 ? `${pkg.speedDownKbps / 1024} Mbps` : `${pkg.speedDownKbps} Kbps`}`}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-white">
                    Rp {parseInt(pkg.price).toLocaleString("id-ID")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
