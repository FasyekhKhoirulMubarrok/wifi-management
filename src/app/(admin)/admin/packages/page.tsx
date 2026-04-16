import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { PackagesTable, type PackageRow } from "@/components/admin/PackagesTable";

export default async function PackagesPage() {
  let admin;
  try { admin = await getCurrentAdmin(); }
  catch { redirect("/admin/login"); }

  // Location access filter
  const locationIds =
    admin.role === "super_admin"
      ? null
      : (await db.admin.findUnique({
          where:  { id: admin.id },
          select: { locations: { select: { locationId: true } } },
        }))?.locations.map((l) => l.locationId) ?? [];

  const packages = await db.package.findMany({
    where: locationIds !== null
      ? { OR: [{ locationId: { in: locationIds } }, { locationId: null }] }
      : undefined,
    include: { location: { select: { id: true, name: true } } },
    orderBy: [{ locationId: "asc" }, { name: "asc" }],
  });

  const rows: PackageRow[] = packages.map((p) => ({
    id:            p.id,
    name:          p.name,
    price:         p.price.toString(),
    quotaLimitMb:  p.quotaLimitMb?.toString() ?? null,
    timeLimitDays: p.timeLimitDays,
    speedDownKbps: p.speedDownKbps,
    speedUpKbps:   p.speedUpKbps,
    throttleKbps:  p.throttleKbps,
    type:          p.type,
    locationId:    p.locationId,
    location:      p.location,
    isActive:      p.isActive,
    scheduleStart: p.scheduleStart
      ? `${String(p.scheduleStart.getHours()).padStart(2, "0")}:${String(p.scheduleStart.getMinutes()).padStart(2, "0")}`
      : null,
    scheduleEnd: p.scheduleEnd
      ? `${String(p.scheduleEnd.getHours()).padStart(2, "0")}:${String(p.scheduleEnd.getMinutes()).padStart(2, "0")}`
      : null,
  }));

  return (
    <div>
      <PageHeader
        title="Manajemen Paket"
        description="Kelola paket voucher dan langganan"
        breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Paket" }]}
      />
      <PackagesTable initialPackages={rows} />
    </div>
  );
}
