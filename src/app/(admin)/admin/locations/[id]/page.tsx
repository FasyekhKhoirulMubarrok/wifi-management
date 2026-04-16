import { redirect, notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { LocationForm } from "@/components/admin/LocationForm";

export default async function LocationDetailPage({
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
  const locationId = isNew ? null : parseInt(id);

  if (!isNew && (isNaN(locationId!) || locationId! <= 0)) {
    notFound();
  }

  let initial = undefined;
  if (!isNew && locationId) {
    const location = await db.location.findUnique({
      where:  { id: locationId },
      select: {
        id:          true,
        name:        true,
        address:     true,
        mikrotikIp:  true,
        mikrotikUser: true,
        isActive:    true,
      },
    });
    if (!location) notFound();
    initial = {
      ...location,
      address: location.address ?? undefined,
    };
  }

  const title = isNew ? "Tambah Lokasi" : `Edit: ${initial?.name}`;

  return (
    <div>
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Lokasi",    href: "/admin/locations" },
          { label: isNew ? "Tambah" : "Edit" },
        ]}
      />
      <LocationForm initial={initial} />
    </div>
  );
}
