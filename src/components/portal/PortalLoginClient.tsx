"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Wifi, QrCode, User, KeyRound } from "lucide-react";

const QrScanner = dynamic(
  () => import("./QrScanner").then((m) => m.QrScanner),
  { ssr: false },
);

interface Props {
  mac:      string | null;
  clientIp: string | null;
}

type Tab = "subscriber" | "voucher";

export function PortalLoginClient({ mac, clientIp }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("voucher");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4 shadow-lg shadow-blue-600/30">
          <Wifi className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">
          FadilJaya<span className="text-blue-400">.NET</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">Portal WiFi</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <TabButton active={tab === "voucher"} onClick={() => setTab("voucher")}>
            <QrCode size={15} /> Voucher
          </TabButton>
          <TabButton active={tab === "subscriber"} onClick={() => setTab("subscriber")}>
            <User size={15} /> Login Akun
          </TabButton>
        </div>

        <div className="p-6">
          {tab === "voucher"    && <VoucherTab    mac={mac} clientIp={clientIp} onSuccess={() => { router.push("/portal/status"); router.refresh(); }} />}
          {tab === "subscriber" && <SubscriberTab mac={mac} clientIp={clientIp} onSuccess={() => { router.push("/portal/status"); router.refresh(); }} />}
        </div>
      </div>

      <p className="text-slate-600 text-xs mt-6">FadilJaya.NET &copy; {new Date().getFullYear()}</p>
    </div>
  );
}

// ─── Voucher Tab ──────────────────────────────────────────────────────────────

function VoucherTab({ mac, clientIp: _clientIp, onSuccess }: { mac: string | null; clientIp: string | null; onSuccess: () => void }) {
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);
  const ref3 = useRef<HTMLInputElement>(null);

  const [part1, setPart1] = useState("");
  const [part2, setPart2] = useState("");
  const [part3, setPart3] = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [showQr,  setShowQr]  = useState(false);

  function handlePart(
    val: string,
    set: (v: string) => void,
    nextRef: React.RefObject<HTMLInputElement | null> | null,
  ) {
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    set(cleaned);
    if (cleaned.length === 4 && nextRef?.current) {
      nextRef.current.focus();
    }
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    val: string,
    prevRef: React.RefObject<HTMLInputElement | null> | null,
  ) {
    if (e.key === "Backspace" && val === "" && prevRef?.current) {
      prevRef.current.focus();
    }
  }

  const handleQrResult = useCallback((decoded: string) => {
    setShowQr(false);
    // Extract voucher code: strip non-alphanum
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
    const code = `${part1}-${part2}-${part3}`;
    if (part1.length < 4 || part2.length < 4 || part3.length < 4) {
      setError("Masukkan kode voucher lengkap (12 karakter)");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal/voucher/activate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code, macAddress: mac }),
      });
      const d = await res.json() as { ok?: boolean; error?: string; code?: string };
      if (!res.ok) {
        if (d.code === "BLOCKED") { window.location.href = "/portal/blocked"; return; }
        if (d.code === "EXPIRED") { window.location.href = "/portal/expired"; return; }
        setError(d.error ?? "Aktivasi gagal");
        return;
      }
      onSuccess();
    } catch {
      setError("Tidak dapat terhubung ke server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {showQr && <QrScanner onResult={handleQrResult} onClose={() => setShowQr(false)} />}

      <form onSubmit={handleActivate} className="space-y-5">
        <div className="text-center">
          <p className="text-sm text-slate-400 mb-4">Masukkan kode voucher WiFi Anda</p>

          {/* 3-field voucher input */}
          <div className="flex items-center justify-center gap-2">
            <VoucherInput ref={ref1} value={part1}
              onChange={(v) => handlePart(v, setPart1, ref2)}
              onKeyDown={(e) => handleKeyDown(e, part1, null)}
            />
            <span className="text-slate-500 text-lg font-light">-</span>
            <VoucherInput ref={ref2} value={part2}
              onChange={(v) => handlePart(v, setPart2, ref3)}
              onKeyDown={(e) => handleKeyDown(e, part2, ref1)}
            />
            <span className="text-slate-500 text-lg font-light">-</span>
            <VoucherInput ref={ref3} value={part3}
              onChange={(v) => handlePart(v, setPart3, null)}
              onKeyDown={(e) => handleKeyDown(e, part3, ref2)}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-xl text-center">
            {error}
          </div>
        )}

        <button
          type="button" onClick={() => setShowQr(true)}
          className="w-full flex items-center justify-center gap-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 py-2.5 rounded-xl transition-colors"
        >
          <QrCode size={15} /> Scan QR Code
        </button>

        <button
          type="submit" disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2"
        >
          {loading ? <Spinner /> : "Aktifkan Voucher"}
        </button>
      </form>
    </>
  );
}

// ─── Subscriber Tab ───────────────────────────────────────────────────────────

function SubscriberTab({ mac, clientIp: _clientIp, onSuccess }: { mac: string | null; clientIp: string | null; onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) { setError("Username dan password wajib diisi"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username: username.trim(), password, macAddress: mac }),
      });
      const d = await res.json() as { ok?: boolean; error?: string; code?: string };
      if (!res.ok) {
        if (d.code === "BLOCKED") { window.location.href = "/portal/blocked"; return; }
        if (d.code === "EXPIRED") { window.location.href = "/portal/expired"; return; }
        setError(d.error ?? "Login gagal");
        return;
      }
      onSuccess();
    } catch {
      setError("Tidak dapat terhubung ke server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Username</label>
        <div className="relative">
          <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={username} onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="username"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Password</label>
        <div className="relative">
          <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type={showPwd ? "text" : "password"}
            value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
          />
          <button
            type="button" onClick={() => setShowPwd(!showPwd)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
          >
            {showPwd ? "Sembunyikan" : "Lihat"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-xl">
          {error}
        </div>
      )}

      <button
        type="submit" disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2"
      >
        {loading ? <Spinner /> : "Masuk"}
      </button>
    </form>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VoucherInput = ({
  ref, value, onChange, onKeyDown,
}: {
  ref:        React.RefObject<HTMLInputElement | null>;
  value:      string;
  onChange:   (v: string) => void;
  onKeyDown:  (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) => (
  <input
    ref={ref}
    type="text"
    inputMode="text"
    maxLength={4}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={onKeyDown}
    className="w-16 h-12 text-center font-mono font-bold text-base uppercase bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest"
  />
);

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
        active
          ? "bg-blue-600/20 text-blue-400 border-b-2 border-blue-500"
          : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
