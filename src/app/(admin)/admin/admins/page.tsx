import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminsTable, type AdminRow } from "@/components/admin/AdminsTable";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

export default async function AdminsPage() {
  let admin;
  try {
    admin = await getCurrentAdmin();
  } catch {
    redirect("/admin/login");
  }

  if (admin.role !== "super_admin") {
    redirect("/admin/dashboard");
  }

  const admins = await db.admin.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id:        true,
      name:      true,
      email:     true,
      role:      true,
      createdAt: true,
      locations: {
        include: { location: { select: { id: true, name: true } } },
      },
    },
  });

  const rows: AdminRow[] = admins.map((a) => ({
    id:        a.id,
    name:      a.name,
    email:     a.email,
    role:      a.role,
    createdAt: a.createdAt.toISOString(),
    locations: a.locations.map((l) => l.location),
  }));

  return (
    <div>
      <PageHeader
        title="Manajemen Admin"
        description="Kelola akun admin dan hak akses"
        breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Admin" }]}
        action={
          <Link
            href="/admin/admins/logs"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            Log Aktivitas
          </Link>
        }
      />
      <AdminsTable initialAdmins={rows} currentAdminId={admin.id} />
    </div>
  );
}
