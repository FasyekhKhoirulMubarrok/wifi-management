"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, Plus, Wifi, WifiOff, Users, RefreshCw, UserCog } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

export interface LocationRow {
  id:          number;
  name:        string;
  address:     string | null;
  mikrotikIp:  string;
  isActive:    boolean;
  activeUsers: number;
  admins:      { id: number; name: string; email: string }[];
}

interface PingResult {
  reachable:  boolean;
  latencyMs:  number;
  openPort:   number | null;
}

export function LocationsTable({ initialLocations }: { initialLocations: LocationRow[] }) {
  const router = useRouter();
  const [locations, setLocations] = useState(initialLocations);
  const [pingResults, setPingResults] = useState<Record<number, PingResult & { loading: boolean }>>({});
  const [deletingId, setDeletingId]   = useState<number | null>(null);
  const [assignTarget, setAssignTarget] = useState<LocationRow | null>(null);
  const [isPending, startTransition]  = useTransition();

  async function handlePing(id: number) {
    setPingResults((prev) => ({ ...prev, [id]: { ...prev[id], loading: true, reachable: false, latencyMs: 0, openPort: null } }));
    try {
      const res  = await fetch(`/api/admin/locations/${id}/ping`);
      const data = await res.json() as PingResult & { ok: boolean };
      setPingResults((prev) => ({ ...prev, [id]: { ...data, loading: false } }));
    } catch {
      setPingResults((prev) => ({ ...prev, [id]: { loading: false, reachable: false, latencyMs: 0, openPort: null } }));
    }
  }

  async function handleDelete(loc: LocationRow) {
    if (!confirm(`Hapus lokasi "${loc.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    setDeletingId(loc.id);
    try {
      const res  = await fetch(`/api/admin/locations/${loc.id}`, { method: "DELETE" });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { alert(data.error ?? "Gagal menghapus"); return; }
      setLocations((prev) => prev.filter((l) => l.id !== loc.id));
      startTransition(() => router.refresh());
    } catch {
      alert("Tidak dapat terhubung ke server");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-400">{locations.length} lokasi terdaftar</p>
        <Link
          href="/admin/locations/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah Lokasi
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Nama</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">IP MikroTik</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">User Aktif</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Admin</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Koneksi</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {locations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    Belum ada lokasi. Klik "Tambah Lokasi" untuk memulai.
                  </td>
                </tr>
              )}
              {locations.map((loc) => {
                const ping = pingResults[loc.id];
                return (
                  <tr key={loc.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-white">{loc.name}</p>
                      {loc.address && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{loc.address}</p>}
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-300 text-xs">{loc.mikrotikIp}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={loc.isActive ? "online" : "offline"} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="flex items-center justify-end gap-1 text-slate-300">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        {loc.activeUsers}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {loc.admins.length === 0 ? (
                        <span className="text-slate-600 text-xs">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {loc.admins.slice(0, 2).map((a) => (
                            <span key={a.id} className="px-2 py-0.5 rounded-full bg-white/5 text-xs text-slate-300">
                              {a.name}
                            </span>
                          ))}
                          {loc.admins.length > 2 && (
                            <span className="px-2 py-0.5 rounded-full bg-white/5 text-xs text-slate-500">
                              +{loc.admins.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {ping?.loading ? (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Mengecek...
                        </span>
                      ) : ping ? (
                        <span className={`flex items-center gap-1 text-xs font-medium ${ping.reachable ? "text-emerald-400" : "text-red-400"}`}>
                          {ping.reachable
                            ? <><Wifi className="w-3.5 h-3.5" /> {ping.latencyMs}ms (:{ping.openPort})</>
                            : <><WifiOff className="w-3.5 h-3.5" /> Tidak terjangkau</>
                          }
                        </span>
                      ) : (
                        <button
                          onClick={() => handlePing(loc.id)}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Ping
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setAssignTarget(loc)}
                          title="Assign Admin"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                        >
                          <UserCog className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/admin/locations/${loc.id}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(loc)}
                          disabled={deletingId === loc.id || isPending}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Admin Modal */}
      {assignTarget && (
        <AssignAdminModal
          location={assignTarget}
          onClose={() => setAssignTarget(null)}
          onSaved={() => {
            setAssignTarget(null);
            startTransition(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}

// ─── Assign Admin Modal ───────────────────────────────────────────────────────

interface AssignAdminModalProps {
  location: LocationRow;
  onClose:  () => void;
  onSaved:  () => void;
}

function AssignAdminModal({ location, onClose, onSaved }: AssignAdminModalProps) {
  const [adminsList, setAdminsList] = useState<{ id: number; name: string; email: string }[]>([]);
  const [selected,   setSelected]   = useState<Set<number>>(new Set(location.admins.map((a) => a.id)));
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  // Load admin_lokasi list
  useState(() => {
    fetch("/api/admin/admins?role=admin_lokasi")
      .then((r) => r.json())
      .then((d: { admins?: { id: number; name: string; email: string }[] }) => {
        setAdminsList(d.admins ?? []);
      })
      .catch(() => setError("Gagal memuat daftar admin"))
      .finally(() => setLoading(false));
  });

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res  = await fetch(`/api/admin/locations/${location.id}/assign`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ adminIds: Array.from(selected) }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Gagal menyimpan"); return; }
      onSaved();
    } catch {
      setError("Tidak dapat terhubung ke server");
    } finally {
      setSaving(false);
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-white mb-1">Assign Admin</h3>
        <p className="text-sm text-slate-400 mb-5">
          Pilih admin yang bisa mengakses <span className="text-white">{location.name}</span>
        </p>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-4">{error}</p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500 text-center py-4">Memuat...</p>
        ) : adminsList.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">Belum ada admin lokasi</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto mb-5">
            {adminsList.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-white/5 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  onChange={() => toggle(a.id)}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <div>
                  <p className="text-sm font-medium text-white">{a.name}</p>
                  <p className="text-xs text-slate-500">{a.email}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 rounded-xl text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
