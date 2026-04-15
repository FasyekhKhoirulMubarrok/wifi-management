"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Wifi, WifiOff, LogOut, AlertTriangle, Clock, Database,
  Zap, Monitor, MessageCircle, ChevronRight,
} from "lucide-react";

// ─── types ────────────────────────────────────────────────────────────────────

interface QuotaInfo {
  limitMb: number | null;
  usedMb:  number;
  leftMb:  number | null;
  pct:     number | null;  // % remaining (0-100), null = unlimited
}

interface TimeInfo {
  expiredAt: string | null;
  leftDays:  number | null;
  leftHours: number | null;
}

interface StatusData {
  userType:      "subscriber" | "voucher";
  username:      string;
  name:          string | null;
  locationId:    number | null;
  locationName:  string;
  packageName:   string;
  speedDownKbps: number;
  speedUpKbps:   number;
  quota:         QuotaInfo;
  time:          TimeInfo;
  macAddress:    string | null;
  sessionStart:  string | null;
  isExpired:     boolean;
}

interface Ad {
  id:          number;
  title:       string;
  description: string | null;
  imageUrl:    string | null;
  linkUrl:     string | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtMb(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function fmtKbps(kbps: number) {
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} Mbps`;
  return `${kbps} Kbps`;
}

function fmtElapsed(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function quotaColor(pct: number | null) {
  if (pct === null) return "bg-blue-500";
  if (pct <= 10) return "bg-red-500";
  if (pct <= 20) return "bg-amber-500";
  return "bg-blue-500";
}

function initials(name: string | null, username: string) {
  const src = name ?? username;
  return src.slice(0, 2).toUpperCase();
}

// ─── main component ───────────────────────────────────────────────────────────

export function StatusClient() {
  const router = useRouter();
  const [data,    setData]    = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ads,     setAds]     = useState<Ad[]>([]);
  const [adIdx,   setAdIdx]   = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const impressedIds = useRef<Set<number>>(new Set());

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/status");
      if (res.status === 401) { router.push("/portal/login"); return; }
      const d = await res.json() as StatusData & { ok?: boolean; isExpired?: boolean };
      if (d.ok) {
        if (d.isExpired) { router.push("/portal/expired"); return; }
        setData(d);
        if (d.locationId) fetchAds(d.locationId);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  function fetchAds(locationId: number) {
    fetch(`/api/portal/ads?locationId=${locationId}`)
      .then((r) => r.json())
      .then((d: { ok: boolean; ads: Ad[] }) => { if (d.ok) setAds(d.ads); })
      .catch(() => {/* ignore */});
  }

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Real-time session timer
  useEffect(() => {
    if (!data?.sessionStart) return;
    const start = new Date(data.sessionStart).getTime();
    const tick  = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [data?.sessionStart]);

  // Ad rotation every 8s
  useEffect(() => {
    if (ads.length <= 1) return;
    const t = setInterval(() => setAdIdx((i) => (i + 1) % ads.length), 8000);
    return () => clearInterval(t);
  }, [ads.length]);

  // Record impression when ad is shown
  useEffect(() => {
    const ad = ads[adIdx];
    if (!ad || impressedIds.current.has(ad.id)) return;
    impressedIds.current.add(ad.id);
    fetch(`/api/portal/ads/${ad.id}/impression`, { method: "POST" }).catch(() => {/*ignore*/});
  }, [ads, adIdx]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/portal/logout", { method: "POST" });
      router.push("/portal/login");
    } finally {
      setLoggingOut(false);
    }
  }

  function handleAdClick(ad: Ad) {
    fetch(`/api/portal/ads/${ad.id}/click`, { method: "POST" }).catch(() => {/*ignore*/});
    if (ad.linkUrl) window.open(ad.linkUrl, "_blank", "noopener");
  }

  // ── loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Memuat status...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <WifiOff className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">Gagal memuat data. <button onClick={fetchStatus} className="text-blue-400 underline">Coba lagi</button></p>
        </div>
      </div>
    );
  }

  const { quota, time } = data;
  const showQuota = quota.limitMb !== null;
  const showTime  = time.expiredAt !== null;
  const quotaPct  = quota.pct;
  const lowQuota  = quotaPct !== null && quotaPct <= 20;

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto px-4 pt-6 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Wifi size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-white leading-tight">FadilJaya.NET</p>
            <p className="text-xs text-slate-400 leading-tight">{data.locationName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-3 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400 font-medium">Online</span>
        </div>
      </div>

      {/* Low quota warning */}
      {lowQuota && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-300 font-medium">
              Kuota Anda tinggal {quotaPct}%
            </p>
            <p className="text-xs text-amber-400/80 mt-0.5">Segera hubungi admin untuk perpanjang</p>
            <a
              href="https://wa.me/"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2.5 py-1 rounded-lg mt-2 transition-colors"
            >
              <MessageCircle size={11} /> Hubungi Admin via WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* User card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-base">
            {initials(data.name, data.username)}
          </div>
          <div>
            <p className="font-semibold text-white">{data.name ?? data.username}</p>
            {data.name && <p className="text-xs text-slate-400">{data.username}</p>}
            <span className="inline-block text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full mt-0.5">
              {data.packageName}
            </span>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className={`grid gap-3 mb-4 ${showQuota && showTime ? "grid-cols-2" : "grid-cols-1"}`}>
        {showQuota && (
          <MetricCard
            icon={<Database size={16} />}
            label="Sisa Kuota"
            value={quota.leftMb !== null ? fmtMb(quota.leftMb) : "Unlimited"}
            sub={quota.limitMb !== null ? `dari ${fmtMb(quota.limitMb)}` : undefined}
            color={lowQuota ? (quotaPct! <= 10 ? "red" : "amber") : "blue"}
          >
            {quota.limitMb !== null && (
              <div className="mt-2">
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${quotaColor(quotaPct)}`}
                    style={{ width: `${quotaPct ?? 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1 text-right">{quotaPct}% tersisa</p>
              </div>
            )}
          </MetricCard>
        )}

        {showTime && (
          <MetricCard
            icon={<Clock size={16} />}
            label="Sisa Waktu"
            value={
              time.leftDays !== null && time.leftDays > 0
                ? `${time.leftDays}h ${time.leftHours}j`
                : time.leftHours !== null
                ? `${time.leftHours} jam`
                : "—"
            }
            sub={time.expiredAt ? `exp. ${new Date(time.expiredAt).toLocaleDateString("id-ID")}` : undefined}
            color="purple"
          />
        )}
      </div>

      {/* Session details */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 space-y-3">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">Detail Sesi</p>

        <DetailRow icon={<Clock size={13} />}    label="Durasi" value={fmtElapsed(elapsed)} mono />
        <DetailRow icon={<Zap size={13} />}      label="Kecepatan"
          value={`↓ ${fmtKbps(data.speedDownKbps)}  ↑ ${fmtKbps(data.speedUpKbps)}`} />
        <DetailRow icon={<Monitor size={13} />}  label="MAC Address" value={data.macAddress ?? "—"} mono />
      </div>

      {/* Ad banner */}
      {ads.length > 0 && (() => {
        const ad = ads[adIdx];
        return (
          <button
            onClick={() => handleAdClick(ad)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-4 text-left hover:bg-white/8 transition-colors"
          >
            {ad.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ad.imageUrl} alt={ad.title} className="w-full h-28 object-cover" />
            )}
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 mb-0.5">Iklan</p>
                <p className="text-sm font-medium text-white truncate">{ad.title}</p>
                {ad.description && <p className="text-xs text-slate-400 truncate">{ad.description}</p>}
              </div>
              {ad.linkUrl && <ChevronRight size={16} className="text-slate-500 shrink-0 ml-2" />}
            </div>
          </button>
        );
      })()}

      {/* Logout */}
      <button
        onClick={handleLogout} disabled={loggingOut}
        className="w-full flex items-center justify-center gap-2 text-sm text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 py-3 rounded-xl transition-colors disabled:opacity-50"
      >
        <LogOut size={15} /> {loggingOut ? "Keluar..." : "Logout"}
      </button>
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  icon, label, value, sub, color, children,
}: {
  icon:      React.ReactNode;
  label:     string;
  value:     string;
  sub?:      string;
  color:     "blue" | "purple" | "amber" | "red";
  children?: React.ReactNode;
}) {
  const colorMap = {
    blue:   "text-blue-400   bg-blue-500/10   border-blue-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    amber:  "text-amber-400  bg-amber-500/10  border-amber-500/20",
    red:    "text-red-400    bg-red-500/10    border-red-500/20",
  };
  return (
    <div className={`border rounded-2xl p-4 ${colorMap[color].split(" ").slice(1).join(" ")}`}>
      <div className={`flex items-center gap-1.5 mb-2 ${colorMap[color].split(" ")[0]}`}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      {children}
    </div>
  );
}

function DetailRow({
  icon, label, value, mono,
}: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-slate-400">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className={`text-xs text-slate-200 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
