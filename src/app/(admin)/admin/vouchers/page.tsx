import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { VouchersManager } from "@/components/admin/VouchersManager";

export default async function VouchersPage() {
  let admin;
  try { admin = await getCurrentAdmin(); }
  catch { redirect("/admin/login"); }

  const locationIds =
    admin.role === "super_admin"
      ? null
      : (await db.admin.findUnique({
          where:  { id: admin.id },
          select: { locations: { select: { locationId: true } } },
        }))?.locations.map((l) => l.locationId) ?? [];

  // Load packages (voucher type only for generate, all for filter)
  const [packages, locations] = await Promise.all([
    db.package.findMany({
      where: {
        isActive: true,
        ...(locationIds !== null
          ? { OR: [{ locationId: { in: locationIds } }, { locationId: null }] }
          : {}),
      },
      select: { id: true, name: true, type: true, price: true },
      orderBy: { name: "asc" },
    }),
    db.location.findMany({
      where: locationIds !== null
        ? { id: { in: locationIds }, isActive: true }
        : { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Manajemen Voucher"
        description="Daftar, generate, dan cetak voucher"
        breadcrumbs={[{ label: "Dashboard", href: "/admin/dashboard" }, { label: "Voucher" }]}
      />
      <VouchersManager
        packages={packages.map((p) => ({ ...p, price: p.price.toString() }))}
        locations={locations}
      />
    </div>
  );
}
