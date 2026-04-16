import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { LogsTable } from "@/components/admin/LogsTable";

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ adminId?: string; from?: string; to?: string; page?: string }>;
}) {
  let admin;
  try {
    admin = await getCurrentAdmin();
  } catch {
    redirect("/admin/login");
  }

  if (admin.role !== "super_admin") {
    redirect("/admin/dashboard");
  }

  const sp       = await searchParams;
  const page     = Math.max(1, parseInt(sp.page ?? "1"));
  const limit    = 50;
  const adminId  = sp.adminId ? parseInt(sp.adminId) : undefined;
  const from     = sp.from ? new Date(sp.from) : undefined;
  const to       = sp.to   ? new Date(sp.to)   : undefined;

  const where: Record<string, unknown> = {};
  if (adminId)  where.adminId   = adminId;
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to   ? { lte: to   } : {}),
    };
  }

  const [logs, total, adminList] = await Promise.all([
    db.adminLog.findMany({
      where,
      include: {
        admin: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * limit,
      take:  limit,
    }),
    db.adminLog.count({ where }),
    db.admin.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Log Aktivitas Admin"
        description="Riwayat semua aksi admin sistem"
        breadcrumbs={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Admin",     href: "/admin/admins" },
          { label: "Log Aktivitas" },
        ]}
      />
      <LogsTable
        logs={logs.map((l) => ({
          id:          l.id,
          action:      l.action,
          description: l.description,
          ipAddress:   l.ipAddress,
          createdAt:   l.createdAt.toISOString(),
          admin: l.admin,
        }))}
        adminList={adminList}
        pagination={{ total, page, pages: Math.ceil(total / limit) }}
        filters={{ adminId: sp.adminId, from: sp.from, to: sp.to }}
      />
    </div>
  );
}
