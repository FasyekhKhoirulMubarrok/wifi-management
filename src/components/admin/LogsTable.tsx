"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronDown, Search } from "lucide-react";

interface LogEntry {
  id:          number;
  action:      string;
  description: string | null;
  ipAddress:   string | null;
  createdAt:   string;
  admin: {
    id:    number;
    name:  string;
    email: string;
  };
}

interface Pagination {
  total: number;
  page:  number;
  pages: number;
}

interface Filters {
  adminId?: string;
  from?:    string;
  to?:      string;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE_LOCATION:      "Tambah Lokasi",
  UPDATE_LOCATION:      "Update Lokasi",
  DELETE_LOCATION:      "Hapus Lokasi",
  ASSIGN_ADMIN_LOCATION:"Assign Admin Lokasi",
  CREATE_ADMIN:         "Tambah Admin",
  UPDATE_ADMIN:         "Update Admin",
  DELETE_ADMIN:         "Hapus Admin",
  LOGIN:                "Login",
  LOGOUT:               "Logout",
};

function actionBadge(action: string) {
  const isDelete = action.startsWith("DELETE");
  const isCreate = action.startsWith("CREATE");
  const isLogin  = action === "LOGIN" || action === "LOGOUT";
  const cls = isDelete ? "bg-red-500/10 text-red-400 border-red-500/20"
    : isCreate ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    : isLogin  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
    : "bg-slate-500/10 text-slate-400 border-slate-500/20";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

export function LogsTable({
  logs,
  adminList,
  pagination,
  filters,
}: {
  logs:       LogEntry[];
  adminList:  { id: number; name: string }[];
  pagination: Pagination;
  filters:    Filters;
}) {
  const router   = useRouter();
  const pathname = usePathname();

  const [adminId, setAdminId] = useState(filters.adminId ?? "");
  const [from,    setFrom]    = useState(filters.from    ?? "");
  const [to,      setTo]      = useState(filters.to      ?? "");

  function buildUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const vals = { adminId, from, to, page: "1", ...overrides };
    for (const [k, v] of Object.entries(vals)) {
      if (v) params.set(k, v);
    }
    return `${pathname}?${params.toString()}`;
  }

  function handleFilter() {
    router.push(buildUrl({ page: "1" }));
  }

  function handleReset() {
    setAdminId(""); setFrom(""); setTo("");
    router.push(pathname);
  }

  function handlePage(p: number) {
    router.push(buildUrl({ page: String(p) }));
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Admin filter */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-slate-500 mb-1">Admin</label>
            <div className="relative">
              <select
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl pl-3 pr-8 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Admin</option>
                {adminList.map((a) => (
                  <option key={a.id} value={String(a.id)}>{a.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* From */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* To */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleFilter}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              Filter
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-sm transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <p className="text-xs text-slate-500">{pagination.total} log ditemukan</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Waktu</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Admin</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Aksi</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Deskripsi</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    Tidak ada log ditemukan
                  </td>
                </tr>
              )}
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("id-ID", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-white text-sm">{log.admin.name}</p>
                    <p className="text-slate-500 text-xs">{log.admin.email}</p>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {actionBadge(log.action)}
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs max-w-xs truncate">
                    {log.description ?? "—"}
                  </td>
                  <td className="px-5 py-3 font-mono text-slate-500 text-xs whitespace-nowrap">
                    {log.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Halaman {pagination.page} dari {pagination.pages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePage(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
                const p = pagination.page <= 3
                  ? i + 1
                  : pagination.page >= pagination.pages - 2
                  ? pagination.pages - 4 + i
                  : pagination.page - 2 + i;
                return p > 0 && p <= pagination.pages ? (
                  <button
                    key={p}
                    onClick={() => handlePage(p)}
                    className={`w-8 h-8 rounded-lg text-sm transition-colors ${
                      p === pagination.page
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {p}
                  </button>
                ) : null;
              })}
              <button
                onClick={() => handlePage(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
