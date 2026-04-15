"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ChevronDown } from "lucide-react";

interface AdminData {
  id?:          number;
  name?:        string;
  email?:       string;
  role?:        "super_admin" | "admin_lokasi";
  locationIds?: number[];
}

interface LocationOption {
  id:   number;
  name: string;
}

export function AdminForm({ initial }: { initial?: AdminData }) {
  const router = useRouter();
  const isEdit = !!initial?.id;

  const [name,        setName]        = useState(initial?.name  ?? "");
  const [email,       setEmail]       = useState(initial?.email ?? "");
  const [password,    setPassword]    = useState("");
  const [role,        setRole]        = useState<"super_admin" | "admin_lokasi">(initial?.role ?? "admin_lokasi");
  const [locationIds, setLocationIds] = useState<Set<number>>(new Set(initial?.locationIds ?? []));
  const [showPass,    setShowPass]    = useState(false);

  const [locations,   setLocations]   = useState<LocationOption[]>([]);
  const [loadingLocs, setLoadingLocs] = useState(false);

  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  // Load location options when role = admin_lokasi
  useEffect(() => {
    if (role !== "admin_lokasi") return;
    setLoadingLocs(true);
    fetch("/api/admin/locations")
      .then((r) => r.json())
      .then((d: { locations?: LocationOption[] }) => setLocations(d.locations ?? []))
      .catch(() => setLocations([]))
      .finally(() => setLoadingLocs(false));
  }, [role]);

  function toggleLocation(id: number) {
    setLocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        name:        name.trim(),
        email:       email.trim(),
        role,
        locationIds: role === "admin_lokasi" ? Array.from(locationIds) : [],
      };
      if (password.trim()) payload.password = password;
      if (!isEdit)          payload.password = password;

      const url    = isEdit ? `/api/admin/admins/${initial!.id}` : "/api/admin/admins";
      const method = isEdit ? "PUT" : "POST";

      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json() as { ok?: boolean; error?: string };

      if (!res.ok) { setError(data.error ?? "Gagal menyimpan"); return; }

      router.push("/admin/admins");
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
          Nama Lengkap <span className="text-red-400">*</span>
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contoh: Budi Santoso"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Email <span className="text-red-400">*</span>
        </label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@fadiljaya.com"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Password
          {isEdit && <span className="text-slate-500 font-normal ml-1">(kosong = tidak ubah)</span>}
          {!isEdit && <span className="text-red-400 ml-1">*</span>}
        </label>
        <div className="relative">
          <input
            required={!isEdit}
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? "••••••••" : "Minimal 8 karakter"}
            minLength={isEdit && !password ? undefined : 8}
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

      {/* Role */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Role <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "super_admin" | "admin_lokasi")}
            className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          >
            <option value="super_admin">Super Admin</option>
            <option value="admin_lokasi">Admin Lokasi</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Location multi-select (only for admin_lokasi) */}
      {role === "admin_lokasi" && (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Lokasi yang Bisa Diakses
          </label>
          {loadingLocs ? (
            <p className="text-sm text-slate-500">Memuat lokasi...</p>
          ) : locations.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada lokasi terdaftar</p>
          ) : (
            <div className="space-y-2 bg-white/5 border border-white/10 rounded-xl p-3 max-h-48 overflow-y-auto">
              {locations.map((loc) => (
                <label
                  key={loc.id}
                  className="flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={locationIds.has(loc.id)}
                    onChange={() => toggleLocation(loc.id)}
                    className="w-4 h-4 rounded accent-blue-500"
                  />
                  <span className="text-sm text-white">{loc.name}</span>
                </label>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500 mt-1">
            {locationIds.size} lokasi dipilih
          </p>
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
          {loading ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Admin"}
        </button>
      </div>
    </form>
  );
}
