"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Zap } from "lucide-react";

interface LocationOption { id: number; name: string }

interface PackageData {
  id?:            number;
  name?:          string;
  price?:         string;
  type?:          "voucher" | "langganan";
  quotaLimitMb?:  string | null;
  timeLimitDays?: number | null;
  speedDownKbps?: number;
  speedUpKbps?:   number;
  throttleKbps?:  number;
  locationId?:    number | null;
  isActive?:      boolean;
  scheduleStart?: string | null;
  scheduleEnd?:   string | null;
}

function fmtIDR(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

function fmtSpeed(kbps: number) {
  return kbps >= 1024 ? `${(kbps / 1024).toFixed(0)} Mbps` : `${kbps} Kbps`;
}

function fmtQuota(mb: string, unlimited: boolean) {
  if (unlimited || !mb) return "Unlimited";
  const n = Number(mb);
  if (isNaN(n)) return "—";
  return n >= 1024 ? `${(n / 1024).toFixed(1)} GB` : `${n} MB`;
}

export function PackageForm({ initial, isSuperAdmin }: { initial?: PackageData; isSuperAdmin: boolean }) {
  const router = useRouter();
  const isEdit = !!initial?.id;

  const [name,          setName]          = useState(initial?.name          ?? "");
  const [price,         setPrice]         = useState(initial?.price         ?? "");
  const [type,          setType]          = useState<"voucher"|"langganan">(initial?.type ?? "voucher");
  const [quotaMb,       setQuotaMb]       = useState(initial?.quotaLimitMb  ?? "");
  const [quotaUnlim,    setQuotaUnlim]    = useState(!initial?.quotaLimitMb);
  const [timeDays,      setTimeDays]      = useState(String(initial?.timeLimitDays ?? ""));
  const [timeUnlim,     setTimeUnlim]     = useState(!initial?.timeLimitDays);
  const [speedDown,     setSpeedDown]     = useState(String(initial?.speedDownKbps ?? "10240"));
  const [speedUp,       setSpeedUp]       = useState(String(initial?.speedUpKbps   ?? "5120"));
  const [throttle,      setThrottle]      = useState(String(initial?.throttleKbps  ?? "512"));
  const [locationId,    setLocationId]    = useState<string>(String(initial?.locationId ?? ""));
  const [isActive,      setIsActive]      = useState(initial?.isActive ?? true);
  const [scheduleStart, setScheduleStart] = useState(initial?.scheduleStart ?? "");
  const [scheduleEnd,   setScheduleEnd]   = useState(initial?.scheduleEnd   ?? "");

  const [locations,   setLocations]   = useState<LocationOption[]>([]);
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  // Load locations for select
  useEffect(() => {
    fetch("/api/admin/locations")
      .then((r) => r.json())
      .then((d: { locations?: LocationOption[] }) => setLocations(d.locations ?? []))
      .catch(() => {/* ignore */});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        name,
        price,
        type,
        quotaLimitMb:  quotaUnlim ? null : (quotaMb || null),
        timeLimitDays: timeUnlim  ? null : (timeDays ? parseInt(timeDays) : null),
        speedDownKbps: parseInt(speedDown),
        speedUpKbps:   parseInt(speedUp),
        throttleKbps:  parseInt(throttle) || 512,
        locationId:    locationId ? parseInt(locationId) : null,
        isActive,
        scheduleStart: scheduleStart || null,
        scheduleEnd:   scheduleEnd   || null,
      };

      const url    = isEdit ? `/api/admin/packages/${initial!.id}` : "/api/admin/packages";
      const method = isEdit ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Gagal menyimpan"); return; }
      router.push("/admin/packages");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server");
    } finally {
      setLoading(false);
    }
  }

  // Live preview values
  const previewPrice    = Number(price) || 0;
  const previewDown     = parseInt(speedDown) || 0;
  const previewUp       = parseInt(speedUp)   || 0;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 space-y-5 max-w-xl">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        {/* Nama */}
        <Field label="Nama Paket" required>
          <input required value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Voucher 10GB 7 Hari" className={inputCls} />
        </Field>

        {/* Tipe */}
        <Field label="Tipe" required>
          <div className="relative">
            <select value={type} onChange={(e) => setType(e.target.value as "voucher"|"langganan")}
              className={`${inputCls} appearance-none pr-10`}>
              <option value="voucher">Voucher (kode sekali pakai)</option>
              <option value="langganan">Langganan (akun tetap)</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </Field>

        {/* Harga */}
        <Field label="Harga (Rp)" required>
          <input required type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)}
            placeholder="15000" className={inputCls} />
        </Field>

        {/* Kuota */}
        <Field label="Kuota Data">
          <div className="flex items-center gap-3 mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={quotaUnlim} onChange={(e) => setQuotaUnlim(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500" />
              <span className="text-sm text-slate-300">Unlimited</span>
            </label>
          </div>
          {!quotaUnlim && (
            <div className="flex items-center gap-2">
              <input type="number" min="1" value={quotaMb} onChange={(e) => setQuotaMb(e.target.value)}
                placeholder="10240" className={`${inputCls} flex-1`} />
              <span className="text-sm text-slate-500 whitespace-nowrap">MB</span>
            </div>
          )}
        </Field>

        {/* Waktu */}
        <Field label="Masa Berlaku">
          <div className="flex items-center gap-3 mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={timeUnlim} onChange={(e) => setTimeUnlim(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500" />
              <span className="text-sm text-slate-300">Unlimited</span>
            </label>
          </div>
          {!timeUnlim && (
            <div className="flex items-center gap-2">
              <input type="number" min="1" value={timeDays} onChange={(e) => setTimeDays(e.target.value)}
                placeholder="7" className={`${inputCls} flex-1`} />
              <span className="text-sm text-slate-500 whitespace-nowrap">Hari</span>
            </div>
          )}
        </Field>

        {/* Kecepatan */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Download (Kbps)" required>
            <input required type="number" min="1" value={speedDown} onChange={(e) => setSpeedDown(e.target.value)}
              placeholder="10240" className={inputCls} />
          </Field>
          <Field label="Upload (Kbps)" required>
            <input required type="number" min="1" value={speedUp} onChange={(e) => setSpeedUp(e.target.value)}
              placeholder="5120" className={inputCls} />
          </Field>
        </div>

        {/* Throttle */}
        <Field label="Kecepatan setelah kuota habis (Kbps)">
          <input type="number" min="0" value={throttle} onChange={(e) => setThrottle(e.target.value)}
            placeholder="512" className={inputCls} />
        </Field>

        {/* Jadwal aktif */}
        <div>
          <p className="text-sm font-medium text-slate-300 mb-2">Jadwal Aktif <span className="text-slate-500 font-normal">(opsional)</span></p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dari">
              <input type="time" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)}
                className={inputCls} />
            </Field>
            <Field label="Sampai">
              <input type="time" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)}
                className={inputCls} />
            </Field>
          </div>
          <p className="text-xs text-slate-500 mt-1">Kosongkan untuk aktif 24 jam</p>
        </div>

        {/* Lokasi */}
        <Field label="Lokasi">
          <div className="relative">
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
              className={`${inputCls} appearance-none pr-10`}>
              {isSuperAdmin && <option value="">Semua Lokasi (Global)</option>}
              {locations.map((l) => (
                <option key={l.id} value={String(l.id)}>{l.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        </Field>

        {/* Aktif */}
        {isEdit && (
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500" />
            <span className="text-sm font-medium text-slate-300">Paket aktif</span>
          </label>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()}
            className="px-5 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 border border-white/10 transition-colors">
            Batal
          </button>
          <button type="submit" disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50">
            {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Paket"}
          </button>
        </div>
      </form>

      {/* Preview Card */}
      <div className="lg:w-72 shrink-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Preview Paket</p>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-white">{name || "Nama Paket"}</p>
              <p className="text-xs text-slate-500 mt-0.5 capitalize">{type}</p>
            </div>
            <p className="text-xl font-bold text-blue-400 tabular-nums shrink-0">
              {previewPrice > 0 ? fmtIDR(previewPrice) : "—"}
            </p>
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Kuota</span>
              <span className="text-white">{fmtQuota(quotaMb, quotaUnlim)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Masa Berlaku</span>
              <span className="text-white">{timeUnlim ? "Unlimited" : timeDays ? `${timeDays} Hari` : "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Kecepatan</span>
              <span className="text-white flex items-center gap-1">
                <Zap className="w-3 h-3 text-yellow-400" />
                {previewDown > 0 ? fmtSpeed(previewDown) : "—"} / {previewUp > 0 ? fmtSpeed(previewUp) : "—"}
              </span>
            </div>
            {(scheduleStart || scheduleEnd) && (
              <div className="flex justify-between">
                <span className="text-slate-500">Jadwal</span>
                <span className="text-amber-400 text-xs">{scheduleStart || "??"}–{scheduleEnd || "??"}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── small helpers ────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}
