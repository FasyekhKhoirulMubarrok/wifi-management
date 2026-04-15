"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Wifi, WifiOff, RefreshCw, Eye, EyeOff } from "lucide-react";

interface LocationData {
  id?:           number;
  name?:         string;
  address?:      string;
  mikrotikIp?:   string;
  mikrotikUser?: string;
  mikrotikPass?: string;
  isActive?:     boolean;
}

export function LocationForm({ initial }: { initial?: LocationData }) {
  const router  = useRouter();
  const isEdit  = !!initial?.id;

  const [name,         setName]         = useState(initial?.name         ?? "");
  const [address,      setAddress]      = useState(initial?.address      ?? "");
  const [mikrotikIp,   setMikrotikIp]   = useState(initial?.mikrotikIp   ?? "");
  const [mikrotikUser, setMikrotikUser] = useState(initial?.mikrotikUser ?? "");
  const [mikrotikPass, setMikrotikPass] = useState("");
  const [isActive,     setIsActive]     = useState(initial?.isActive     ?? true);
  const [showPass,     setShowPass]     = useState(false);

  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const [pingState, setPingState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ok";   latencyMs: number; openPort: number | null }
    | { status: "fail" }
  >({ status: "idle" });

  async function handlePing() {
    if (!mikrotikIp.trim()) {
      setError("Isi IP MikroTik terlebih dahulu");
      return;
    }
    setError("");

    // If editing, use the API endpoint
    if (isEdit && initial?.id) {
      setPingState({ status: "loading" });
      try {
        const res  = await fetch(`/api/admin/locations/${initial.id}/ping`);
        const data = await res.json() as { reachable: boolean; latencyMs: number; openPort: number | null };
        setPingState(data.reachable
          ? { status: "ok", latencyMs: data.latencyMs, openPort: data.openPort }
          : { status: "fail" }
        );
      } catch {
        setPingState({ status: "fail" });
      }
      return;
    }

    // For new locations, use a temporary route via query param
    setPingState({ status: "loading" });
    try {
      const res  = await fetch(`/api/admin/locations/0/ping?ip=${encodeURIComponent(mikrotikIp.trim())}`);
      const data = await res.json() as { reachable: boolean; latencyMs: number; openPort: number | null };
      setPingState(data.reachable
        ? { status: "ok", latencyMs: data.latencyMs, openPort: data.openPort }
        : { status: "fail" }
      );
    } catch {
      setPingState({ status: "fail" });
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        address: address.trim() || null,
        mikrotikIp: mikrotikIp.trim(),
        mikrotikUser: mikrotikUser.trim(),
        isActive,
      };
      if (mikrotikPass.trim()) payload.mikrotikPass = mikrotikPass.trim();
      if (!isEdit)              payload.mikrotikPass = mikrotikPass.trim();

      const url    = isEdit ? `/api/admin/locations/${initial!.id}` : "/api/admin/locations";
      const method = isEdit ? "PUT" : "POST";

      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json() as { ok?: boolean; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan");
        return;
      }

      router.push("/admin/locations");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Nama */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Nama Lokasi <span className="text-red-400">*</span>
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contoh: Kantor Pusat"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      {/* Alamat */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Alamat
        </label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Jl. Contoh No. 1, Kota..."
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
        />
      </div>

      {/* MikroTik IP */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          IP MikroTik <span className="text-red-400">*</span>
        </label>
        <div className="flex gap-2">
          <input
            required
            value={mikrotikIp}
            onChange={(e) => { setMikrotikIp(e.target.value); setPingState({ status: "idle" }); }}
            placeholder="192.168.1.1"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <button
            type="button"
            onClick={handlePing}
            disabled={pingState.status === "loading"}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {pingState.status === "loading"
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Wifi className="w-4 h-4" />
            }
            Test
          </button>
        </div>
        {pingState.status === "ok" && (
          <p className="mt-1.5 text-xs text-emerald-400 flex items-center gap-1">
            <Wifi className="w-3.5 h-3.5" />
            Terjangkau — {pingState.latencyMs}ms (port {pingState.openPort})
          </p>
        )}
        {pingState.status === "fail" && (
          <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
            <WifiOff className="w-3.5 h-3.5" />
            Tidak terjangkau
          </p>
        )}
      </div>

      {/* MikroTik User */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Username MikroTik <span className="text-red-400">*</span>
        </label>
        <input
          required
          value={mikrotikUser}
          onChange={(e) => setMikrotikUser(e.target.value)}
          placeholder="admin"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      {/* MikroTik Password */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Password MikroTik
          {isEdit && <span className="text-slate-500 font-normal ml-1">(kosong = tidak ubah)</span>}
          {!isEdit && <span className="text-red-400 ml-1">*</span>}
        </label>
        <div className="relative">
          <input
            required={!isEdit}
            type={showPass ? "text" : "password"}
            value={mikrotikPass}
            onChange={(e) => setMikrotikPass(e.target.value)}
            placeholder={isEdit ? "••••••••" : "Password MikroTik"}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Status */}
      {isEdit && (
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-sm font-medium text-slate-300">Lokasi aktif</span>
          </label>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 rounded-xl text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
        >
          {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Lokasi"}
        </button>
      </div>
    </form>
  );
}
