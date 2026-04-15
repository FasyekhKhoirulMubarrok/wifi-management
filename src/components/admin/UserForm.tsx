"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Save, X } from "lucide-react";

interface PackageOption { id: number; name: string; type: string; price: string }
interface LocationOption { id: number; name: string }

interface SubscriberData {
  id:         number;
  username:   string;
  name:       string | null;
  packageId:  number;
  locationId: number;
  status:     string;
  expiredAt:  string | null;
}

interface Props {
  mode:      "create" | "edit";
  packages:  PackageOption[];
  locations: LocationOption[];
  initial?:  SubscriberData;
}

export function UserForm({ mode, packages, locations, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [username,   setUsername]   = useState(initial?.username   ?? "");
  const [password,   setPassword]   = useState("");
  const [name,       setName]       = useState(initial?.name       ?? "");
  const [packageId,  setPackageId]  = useState<number>(initial?.packageId  ?? 0);
  const [locationId, setLocationId] = useState<number>(initial?.locationId ?? 0);
  const [status,     setStatus]     = useState(initial?.status     ?? "active");
  const [showPass,   setShowPass]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Filter to langganan packages only
  const subPackages = packages.filter((p) => p.type === "langganan");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username.trim()) { setError("Username wajib diisi"); return; }
    if (mode === "create" && !password.trim()) { setError("Password wajib diisi"); return; }
    if (mode === "create" && password.length < 6) { setError("Password minimal 6 karakter"); return; }
    if (!packageId) { setError("Paket wajib dipilih"); return; }
    if (!locationId) { setError("Lokasi wajib dipilih"); return; }

    const body: Record<string, unknown> = { name: name.trim() || null, packageId, locationId, status };
    if (mode === "create") {
      body.username = username.trim();
      body.password = password;
    } else {
      if (password.trim()) body.password = password;
    }

    startTransition(async () => {
      try {
        const url    = mode === "create" ? "/api/admin/users" : `/api/admin/users/${initial!.id}`;
        const method = mode === "create" ? "POST" : "PUT";
        const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data   = await res.json();
        if (!res.ok) { setError(data.error ?? "Terjadi kesalahan"); return; }
        router.push("/admin/users");
        router.refresh();
      } catch {
        setError("Gagal menghubungi server");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <X size={16} className="shrink-0" />{error}
        </div>
      )}

      {/* Username */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Username <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={mode === "edit"}
          placeholder="contoh: user_fadil"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {mode === "edit" && (
          <p className="text-xs text-slate-500 mt-1">Username tidak dapat diubah.</p>
        )}
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Password {mode === "create" && <span className="text-red-400">*</span>}
          {mode === "edit" && <span className="text-slate-500 font-normal"> (kosongkan jika tidak diubah)</span>}
        </label>
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "create" ? "Min. 6 karakter" : "••••••••"}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Nama */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Nama Lengkap</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Opsional"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Paket */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Paket <span className="text-red-400">*</span>
        </label>
        <select
          value={packageId}
          onChange={(e) => setPackageId(Number(e.target.value))}
          className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>-- Pilih Paket --</option>
          {subPackages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — Rp {Number(p.price).toLocaleString("id-ID")}
            </option>
          ))}
        </select>
      </div>

      {/* Lokasi */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Lokasi <span className="text-red-400">*</span>
        </label>
        <select
          value={locationId}
          onChange={(e) => setLocationId(Number(e.target.value))}
          className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>-- Pilih Lokasi --</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* Status (edit only) */}
      {mode === "edit" && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Save size={16} />
          {pending ? "Menyimpan..." : mode === "create" ? "Tambah Subscriber" : "Simpan Perubahan"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
