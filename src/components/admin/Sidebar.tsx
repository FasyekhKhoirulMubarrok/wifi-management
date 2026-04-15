"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MapPin,
  Users,
  Package,
  Ticket,
  Activity,
  BarChart2,
  Clock,
  Megaphone,
  Shield,
  TrendingUp,
  Settings,
  Wifi,
  X,
  Menu,
} from "lucide-react";
import { useState } from "react";
import type { AdminRole } from "@/generated/prisma";

interface MenuItem {
  label: string;
  href:  string;
  icon:  React.ElementType;
  roles: AdminRole[];
}

const MENU_ITEMS: MenuItem[] = [
  { label: "Dashboard",          href: "/admin/dashboard",       icon: LayoutDashboard, roles: ["super_admin", "admin_lokasi"] },
  { label: "Lokasi",             href: "/admin/locations",       icon: MapPin,          roles: ["super_admin"] },
  { label: "Manajemen Admin",    href: "/admin/admins",          icon: Users,           roles: ["super_admin"] },
  { label: "Paket",              href: "/admin/packages",        icon: Package,         roles: ["super_admin", "admin_lokasi"] },
  { label: "Voucher & User",     href: "/admin/vouchers",        icon: Ticket,          roles: ["super_admin", "admin_lokasi"] },
  { label: "Monitoring",         href: "/admin/monitoring",      icon: Activity,        roles: ["super_admin", "admin_lokasi"] },
  { label: "Laporan",            href: "/admin/reports",         icon: BarChart2,       roles: ["super_admin", "admin_lokasi"] },
  { label: "Trial",              href: "/admin/trial",           icon: Clock,           roles: ["super_admin", "admin_lokasi"] },
  { label: "Iklan",              href: "/admin/advertisements",  icon: Megaphone,       roles: ["super_admin", "admin_lokasi"] },
  { label: "MAC Rules",          href: "/admin/mac-rules",       icon: Shield,          roles: ["super_admin", "admin_lokasi"] },
  { label: "Perbandingan",       href: "/admin/comparison",      icon: TrendingUp,      roles: ["super_admin"] },
  { label: "Pengaturan",         href: "/admin/settings",        icon: Settings,        roles: ["super_admin"] },
];

interface SidebarProps {
  role: AdminRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname   = usePathname();
  const [open, setOpen] = useState(false);

  const visibleItems = MENU_ITEMS.filter((item) => item.roles.includes(role));

  function NavItem({ item }: { item: MenuItem }) {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        onClick={() => setOpen(false)}
        className={`
          flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
          ${isActive
            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
            : "text-slate-400 hover:text-white hover:bg-white/5"
          }
        `}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {item.label}
      </Link>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 shrink-0">
          <Wifi className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white leading-none">
            FadilJaya<span className="text-blue-400">.NET</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">Panel Administrasi</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin">
        {visibleItems.map((item) => (
          <NavItem key={item.href} item={item} />
        ))}
      </nav>

      {/* Bottom badge */}
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-xs text-slate-600 text-center">
          &copy; {new Date().getFullYear()} FadilJaya.NET
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-slate-800 border border-white/10 text-slate-400 hover:text-white"
        aria-label="Buka menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`
          lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-white/10
          transform transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-white"
          aria-label="Tutup menu"
        >
          <X className="w-4 h-4" />
        </button>
        <SidebarContent />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-slate-900 border-r border-white/10 h-screen sticky top-0">
        <SidebarContent />
      </aside>
    </>
  );
}
