"use client";

import { useState, useRef, useEffect } from "react";
import {
  Upload, RefreshCw, CheckCircle, XCircle, Clock,
  Database, Wifi, Bell, Info,
} from "lucide-react";

// ─── types ────────────────────────────────────────────────────────────────────

interface SystemSettings {
  brandName:      string;
  brandLogoUrl:   string | null;
  vapidPublicKey: string;
}

interface RadiusClient {
  locationId:   number;
  locationName: string;
  mikrotikIp:   string;
  mikrotikUser: string;
}

interface RadiusConfig {
  authPort: number;
  acctPort: number;
  secret:   string;
  clients:  RadiusClient[];
}

interface CronJob {
  name:        string;
  label:       string;
  schedule:    string;
  lastRunAt:   string | null;
  lastStatus:  string;
  description: string | null;
}

interface Props {
  initial:     SystemSettings;
  radiusConfig: RadiusConfig;
}

// ─── main component ───────────────────────────────────────────────────────────

export function SettingsManager({ initial, radiusConfig }: Props) {
  return (
    <div className="space-y-6 max-w-3xl">
      <AppInfoSection initial={initial} />
      <RadiusSection  radiusConfig={radiusConfig} />
      <WebPushSection vapidKey={initial.vapidPublicKey} />
      <CronSection />
      <BackupSection />
    </div>
  );
}

// ─── Section: App Info ────────────────────────────────────────────────────────

function AppInfoSection({ initial }: { initial: SystemSettings }) {
  const fileRef    = useRef<HTMLInputElement>(null);
  const [brandName, setBrandName]   = useState(initial.brandName);
  const [logoFile,  setLogoFile]    = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.brandLogoUrl);
  const [saving,    setSaving]      = useState(false);
  const [msg,       setMsg]         = useState("");
  const [error,     setError]       = useState("");

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!brandName.trim()) { setError("Nama brand wajib diisi"); return; }
    setSaving(true); setError(""); setMsg("");
    const fd = new FormData();
    fd.append("brandName", brandName.trim());
    if (logoFile) fd.append("logo", logoFile);
    try {
      const res = await fetch("/api/admin/settings", { method: "PUT", body: fd });
      const d   = await res.json();
      if (!res.ok) { setError(d.error ?? "Terjadi kesalahan"); return; }
      setMsg("Pengaturan berhasil disimpan");
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard icon={<Info size={16} />} title="Informasi Aplikasi">
      {error && <ErrorMsg>{error}</ErrorMsg>}
      {msg   && <SuccessMsg>{msg}</SuccessMsg>}
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Nama Brand</label>
          <input
            value={brandName} onChange={(e) => setBrandName(e.target.value)}
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Logo (JPG/PNG/SVG, maks 2MB)</label>
          <div className="flex items-center gap-4">
            {logoPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="logo" className="h-10 object-contain bg-slate-700 rounded p-1 border border-white/10" />
            )}
            <input type="file" ref={fileRef} accept="image/*" onChange={handleLogo} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-sm bg-slate-700 hover:bg-slate-600 border border-white/10 text-slate-300 px-3 py-1.5 rounded-lg">
              <Upload size={13} /> {logoFile ? logoFile.name : "Pilih Logo"}
            </button>
          </div>
        </div>
        <button type="submit" disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded-lg disabled:opacity-50">
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
      </form>
    </SectionCard>
  );
}

// ─── Section: RADIUS ──────────────────────────────────────────────────────────

function RadiusSection({ radiusConfig }: { radiusConfig: RadiusConfig }) {
  return (
    <SectionCard icon={<Wifi size={16} />} title="Konfigurasi RADIUS">
      <p className="text-xs text-slate-500 mb-4">Read-only — edit via environment variables dan clients.conf</p>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <ReadOnlyField label="Auth Port" value={String(radiusConfig.authPort)} />
        <ReadOnlyField label="Acct Port" value={String(radiusConfig.acctPort)} />
        <ReadOnlyField label="Secret"    value={radiusConfig.secret} className="col-span-2" />
      </div>
      <p className="text-xs text-slate-400 mb-2">Klien MikroTik:</p>
      <div className="space-y-2">
        {radiusConfig.clients.map((c) => (
          <div key={c.locationId} className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2">
            <span className="text-sm text-white font-medium w-32 truncate">{c.locationName}</span>
            <span className="font-mono text-xs text-slate-400">{c.mikrotikIp}</span>
            <span className="text-xs text-slate-500">({c.mikrotikUser})</span>
          </div>
        ))}
        {radiusConfig.clients.length === 0 && (
          <p className="text-sm text-slate-500">Belum ada lokasi</p>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Section: Web Push ────────────────────────────────────────────────────────

function WebPushSection({ vapidKey }: { vapidKey: string }) {
  const [key,     setKey]     = useState(vapidKey);
  const [saving,  setSaving]  = useState(false);
  const [sending, setSending] = useState(false);
  const [msg,     setMsg]     = useState("");

  async function saveVapid(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg("");
    const fd = new FormData();
    fd.append("brandName",      ""); // Not changing brandName here, API will use existing
    fd.append("vapidPublicKey", key.trim());
    try {
      const res = await fetch("/api/admin/settings", { method: "PUT", body: fd });
      const d   = await res.json();
      if (!res.ok) { setMsg(`Error: ${d.error}`); return; }
      setMsg("VAPID key tersimpan");
    } catch {
      setMsg("Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setSending(true); setMsg("");
    try {
      // Register service worker and subscribe before testing
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setMsg("Browser tidak mendukung Web Push");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMsg("Izin notifikasi ditolak");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const vapidKey = key.trim();
        if (!vapidKey) {
          setMsg("Isi dan simpan VAPID Public Key terlebih dahulu");
          return;
        }
        const raw     = vapidKey.replace(/-/g, "+").replace(/_/g, "/");
        const padding = "=".repeat((4 - (raw.length % 4)) % 4);
        const bytes   = Uint8Array.from(atob(raw + padding), (c) => c.charCodeAt(0));
        sub = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: bytes,
        });
      }

      // Save subscription to server
      const subJson = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await fetch("/api/push/subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh:   subJson.keys.p256dh,
          auth:     subJson.keys.auth,
        }),
      });

      // Send test notification
      const res = await fetch("/api/admin/settings/test-push", { method: "POST" });
      const d   = await res.json();
      if (!res.ok) { setMsg(`Error: ${(d as { error?: string }).error}`); return; }
      setMsg(`Test notifikasi terkirim ke ${(d as { sent?: number }).sent ?? 1} perangkat`);
    } catch (err) {
      setMsg(`Gagal: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <SectionCard icon={<Bell size={16} />} title="Web Push Notifications">
      <form onSubmit={saveVapid} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">VAPID Public Key</label>
          <input
            value={key} onChange={(e) => setKey(e.target.value)}
            placeholder="Bxxxxxx..."
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {msg && <p className="text-xs text-slate-400">{msg}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1.5 rounded-lg disabled:opacity-50">
            {saving ? "..." : "Simpan"}
          </button>
          <button type="button" onClick={sendTest} disabled={sending}
            className="flex items-center gap-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-1.5 rounded-lg border border-white/10 disabled:opacity-50">
            <Bell size={13} /> Test Kirim
          </button>
        </div>
      </form>
    </SectionCard>
  );
}

// ─── Section: Cron Jobs ───────────────────────────────────────────────────────

function CronSection() {
  const [jobs,    setJobs]    = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = () => {
    setLoading(true);
    fetch("/api/admin/settings/cron-status")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setJobs(d.jobs); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchJobs(); }, []);

  return (
    <SectionCard icon={<Clock size={16} />} title="Cron Jobs">
      <div className="flex justify-end mb-2">
        <button onClick={fetchJobs} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-slate-500 py-4 text-center">Memuat...</p>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div key={job.name} className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2.5">
              {job.lastStatus === "success" ? (
                <CheckCircle size={14} className="text-emerald-400 shrink-0" />
              ) : job.lastStatus === "never" ? (
                <XCircle size={14} className="text-slate-500 shrink-0" />
              ) : (
                <XCircle size={14} className="text-red-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{job.label}</p>
                <p className="text-xs text-slate-500">{job.schedule}</p>
              </div>
              <div className="text-right">
                {job.lastRunAt ? (
                  <p className="text-xs text-slate-400">{new Date(job.lastRunAt).toLocaleString("id-ID")}</p>
                ) : (
                  <p className="text-xs text-slate-600">Belum pernah</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section: Backup ──────────────────────────────────────────────────────────

function BackupSection() {
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState("");

  async function triggerBackup() {
    setLoading(true); setMsg("");
    try {
      const res = await fetch("/api/admin/settings/backup", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMsg(`Error: ${(d as { error?: string }).error ?? "Gagal backup"}`);
        return;
      }
      // Download file
      const blob  = await res.blob();
      const cd    = res.headers.get("Content-Disposition") ?? "";
      const fname = cd.match(/filename="([^"]+)"/)?.[1] ?? "backup.sql";
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement("a");
      a.href      = url;
      a.download  = fname;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Backup berhasil diunduh");
    } catch {
      setMsg("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard icon={<Database size={16} />} title="Backup Database">
      <p className="text-sm text-slate-400 mb-4">
        Buat backup database manual dan unduh sebagai file SQL.
      </p>
      {msg && <p className={`text-sm mb-3 ${msg.startsWith("Error") ? "text-red-400" : "text-emerald-400"}`}>{msg}</p>}
      <button
        onClick={triggerBackup} disabled={loading}
        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-5 py-2 rounded-lg disabled:opacity-50"
      >
        <Database size={14} /> {loading ? "Membuat backup..." : "Backup Sekarang"}
      </button>
    </SectionCard>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionCard({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
        <span className="text-slate-400">{icon}</span>
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function ReadOnlyField({
  label, value, className = "",
}: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="font-mono text-sm text-slate-300 bg-slate-800/60 rounded px-2 py-1">{value}</p>
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-3 py-2 rounded-lg mb-3">
      {children}
    </div>
  );
}

function SuccessMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm px-3 py-2 rounded-lg mb-3">
      {children}
    </div>
  );
}
