import { redirect, notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdvertisementForm } from "@/components/admin/AdvertisementForm";

export const metadata = { title: "Iklan — FadilJaya.NET" };

export default async function AdvertisementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let admin;
  try { admin = await getCurrentAdmin(); }
  catch { redirect("/admin/login"); }

  const { id } = await params;
  const isNew  = id === "new";
  const adId   = isNew ? null : parseInt(id);
  if (!isNew && (isNaN(adId!) || adId! <= 0)) notFound();

  const locations = await db.location.findMany({
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  let initial = undefined;
  if (!isNew && adId) {
    const ad = await db.advertisement.findUnique({
      where:  { id: adId },
      select: {
        id: true, title: true, description: true, imageUrl: true, linkUrl: true,
        locationId: true, priority: true, isActive: true,
        startDate: true, endDate: true,
      },
    });
    if (!ad) notFound();

    initial = {
      id:          ad.id,
      title:       ad.title,
      description: ad.description,
      imageUrl:    ad.imageUrl,
      linkUrl:     ad.linkUrl,
      locationId:  ad.locationId,
      priority:    ad.priority,
      isActive:    ad.isActive,
      startDate:   ad.startDate ? ad.startDate.toISOString() : null,
      endDate:     ad.endDate   ? ad.endDate.toISOString()   : null,
    };
  }

  // Suppress unused warning
  void admin;

  return (
    <div>
      <PageHeader
        title={isNew ? "Tambah Iklan" : `Edit: ${initial?.title}`}
        breadcrumbs={[
          { label: "Dashboard",    href: "/admin/dashboard" },
          { label: "Iklan",        href: "/admin/advertisements" },
          { label: isNew ? "Tambah" : "Edit" },
        ]}
      />
      <AdvertisementForm initial={initial} locations={locations} />
    </div>
  );
}
