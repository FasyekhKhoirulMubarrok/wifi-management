"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, Plus, ChevronDown } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

export interface AdminRow {
  id:        number;
  name:      string;
  email:     string;
  role:      "super_admin" | "admin_lokasi";
  createdAt: string;
  locations: { id: number; name: string }[];
}

const ROLE_LABEL: Record<string, string> = {
  super_admin:  "Super Admin",
  admin_lokasi: "Admin Lokasi",
};

export function AdminsTable({
  initialAdmins,
  currentAdminId,
}: {
  initialAdmins:  AdminRow[];
  currentAdminId: number;
}) {
  const router = useRouter();
  const [admins,    setAdmins]    = useState(initialAdmins);
  const [roleFilter, setRoleFilter] = useState<"" | "super_admin" | "admin_lokasi">("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = roleFilter
    ? admins.filter((a) => a.role === roleFilter)
    : admins;

  async function handleDelete(admin: AdminRow) {
    if (admin.id === currentAdminId) {
      alert("Tidak bisa hapus akun sendiri");
      return;
    }
    if (!confirm(`Hapus admin "${admin.name}" (${admin.email})?`)) return;
    setDeletingId(admin.id);
    try {
      const res  = await fetch(`/api/admin/admins/${admin.id}`, { method: "DELETE" });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { alert(data.error ?? "Gagal menghapus"); return; }
      setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
      startTransition(() => router.refresh());
    } catch {
      alert("Tidak dapat terhubung ke server");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <p className="text-sm text-slate-400">{filtered.length} admin</p>
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
              className="appearance-none bg-white/5 border border-white/10 rounded-xl pl-3 pr-8 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Role</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin_lokasi">Admin Lokasi</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>
        </div>
        <Link
          href="/admin/admins/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Tambah Admin
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Admin</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Lokasi Akses</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Bergabung</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    Tidak ada admin ditemukan
                  </td>
                </tr>
              )}
              {filtered.map((admin) => (
                <tr key={admin.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {admin.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white flex items-center gap-1.5">
                          {admin.name}
                          {admin.id === currentAdminId && (
                            <span className="text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full">(Anda)</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">{admin.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={admin.role === "super_admin" ? "active" : "online"} />
                    <span className="ml-2 text-xs text-slate-400">{ROLE_LABEL[admin.role]}</span>
                  </td>
                  <td className="px-5 py-3">
                    {admin.role === "super_admin" ? (
                      <span className="text-xs text-slate-500 italic">Semua lokasi</span>
                    ) : admin.locations.length === 0 ? (
                      <span className="text-xs text-slate-600">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {admin.locations.slice(0, 3).map((l) => (
                          <span key={l.id} className="px-2 py-0.5 rounded-full bg-white/5 text-xs text-slate-300">
                            {l.name}
                          </span>
                        ))}
                        {admin.locations.length > 3 && (
                          <span className="px-2 py-0.5 rounded-full bg-white/5 text-xs text-slate-500">
                            +{admin.locations.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs">
                    {new Date(admin.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/admins/${admin.id}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(admin)}
                        disabled={deletingId === admin.id || admin.id === currentAdminId || isPending}
                        title={admin.id === currentAdminId ? "Tidak bisa hapus akun sendiri" : "Hapus"}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
