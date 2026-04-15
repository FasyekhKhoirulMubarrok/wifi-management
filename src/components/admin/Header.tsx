"use client";

import { useRouter } from "next/navigation";
import { Bell, LogOut, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { AdminRole } from "@/generated/prisma";

interface AdminInfo {
  name:  string;
  email: string;
  role:  AdminRole;
}

const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin:  "Super Admin",
  admin_lokasi: "Admin Lokasi",
};

export function Header({ admin }: { admin: AdminInfo }) {
  const router    = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/admin/logout", { method: "POST" });
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  }

  return (
    <header className="h-16 border-b border-white/10 bg-slate-900/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 sticky top-0 z-10">
      {/* Left spacer — mobile menu button lives in Sidebar */}
      <div className="w-8 lg:hidden" />

      {/* Right: notifications + admin info */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Notification bell — placeholder */}
        <button
          className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Notifikasi"
        >
          <Bell className="w-5 h-5" />
          {/* dot indicator */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500" />
        </button>

        {/* Admin info + logout */}
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-white leading-none">{admin.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{ROLE_LABEL[admin.role]}</p>
          </div>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {admin.name.charAt(0).toUpperCase()}
          </div>

          <ChevronDown className="w-4 h-4 text-slate-500 hidden sm:block" />
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 text-sm transition-colors disabled:opacity-50"
          aria-label="Keluar"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">{loading ? "Keluar..." : "Keluar"}</span>
        </button>
      </div>
    </header>
  );
}
