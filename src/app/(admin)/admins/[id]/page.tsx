import { redirect, notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminForm } from "@/components/admin/AdminForm";

export default async function AdminDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const { id } = await params;
  const isNew = id === "new";
  const targetId = isNew ? null : parseInt(id);

  if (!isNew && (isNaN(targetId!) || targetId! <= 0)) {
    notFound();
  }

  let initial = undefined;
  if (!isNew && targetId) {
    const target = await db.admin.findUnique({
      where:  { id: targetId },
      select: {
        id:        true,
        name:      true,
        email:     true,
        role:      true,
        locations: { select: { locationId: true } },
      },
    });
    if (!target) notFound();
    initial = {
      id:          target.id,
      name:        target.name,
      email:       target.email,
      role:        target.role,
      locationIds: target.locations.map((l) => l.locationId),
    };
  }

  const title = isNew ? "Tambah Admin" : `Edit: ${initial?.name}`;

  return (
    <div>
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Admin",     href: "/admin/admins" },
          { label: isNew ? "Tambah" : "Edit" },
        ]}
      />
      <AdminForm initial={initial} />
    </div>
  );
}
