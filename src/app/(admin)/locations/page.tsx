import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { LocationsTable, type LocationRow } from "@/components/admin/LocationsTable";

export default async function LocationsPage() {
  let admin;
  try {
    admin = await getCurrentAdmin();
  } catch {
    redirect("/admin/login");
  }

  if (admin.role !== "super_admin") {
    redirect("/admin/dashboard");
  }

  const now = new Date();
  const locations = await db.location.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id:          true,
      name:        true,
      address:     true,
      mikrotikIp:  true,
      isActive:    true,
      admins: {
        include: { admin: { select: { id: true, name: true, email: true } } },
      },
      vouchers: {
        where: { status: "active", OR: [{ expiredAt: null }, { expiredAt: { gt: now } }] },
        select: { id: true },
      },
      subscribers: {
        where: { status: "active", OR: [{ expiredAt: null }, { expiredAt: { gt: now } }] },
        select: { id: true },
      },
    },
  });

  const rows: LocationRow[] = locations.map((l) => ({
    id:          l.id,
    name:        l.name,
    address:     l.address,
    mikrotikIp:  l.mikrotikIp,
    isActive:    l.isActive,
    activeUsers: l.vouchers.length + l.subscribers.length,
    admins:      l.admins.map((a) => a.admin),
  }));

  return (
    <div>
      <PageHeader
        title="Manajemen Lokasi"
        description="Kelola semua lokasi hotspot"
        breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Lokasi" }]}
      />
      <LocationsTable initialLocations={rows} />
    </div>
  );
}
