import { redirect, notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { PackageForm } from "@/components/admin/PackageForm";

export default async function PackageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let admin;
  try { admin = await getCurrentAdmin(); }
  catch { redirect("/admin/login"); }

  const { id } = await params;
  const isNew  = id === "new";
  const pkgId  = isNew ? null : parseInt(id);
  if (!isNew && (isNaN(pkgId!) || pkgId! <= 0)) notFound();

  let initial = undefined;
  if (!isNew && pkgId) {
    const pkg = await db.package.findUnique({
      where:  { id: pkgId },
      select: {
        id: true, name: true, price: true, type: true,
        quotaLimitMb: true, timeLimitDays: true,
        speedDownKbps: true, speedUpKbps: true, throttleKbps: true,
        locationId: true, isActive: true,
        scheduleStart: true, scheduleEnd: true,
      },
    });
    if (!pkg) notFound();

    // Access check for admin_lokasi
    if (admin.role !== "super_admin" && pkg.locationId !== null) {
      const access = await db.adminLocation.findUnique({
        where: { adminId_locationId: { adminId: admin.id, locationId: pkg.locationId } },
      });
      if (!access) redirect("/admin/packages");
    }

    const fmt = (d: Date | null) =>
      d ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : null;

    initial = {
      id:            pkg.id,
      name:          pkg.name,
      price:         pkg.price.toString(),
      type:          pkg.type,
      quotaLimitMb:  pkg.quotaLimitMb?.toString() ?? null,
      timeLimitDays: pkg.timeLimitDays,
      speedDownKbps: pkg.speedDownKbps,
      speedUpKbps:   pkg.speedUpKbps,
      throttleKbps:  pkg.throttleKbps,
      locationId:    pkg.locationId,
      isActive:      pkg.isActive,
      scheduleStart: fmt(pkg.scheduleStart),
      scheduleEnd:   fmt(pkg.scheduleEnd),
    };
  }

  return (
    <div>
      <PageHeader
        title={isNew ? "Tambah Paket" : `Edit: ${initial?.name}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/admin/dashboard" },
          { label: "Paket",     href: "/admin/packages" },
          { label: isNew ? "Tambah" : "Edit" },
        ]}
      />
      <PackageForm initial={initial} isSuperAdmin={admin.role === "super_admin"} />
    </div>
  );
}
