import { redirect, notFound } from "next/navigation";
import { getCurrentAdmin, getAccessibleLocationIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserForm } from "@/components/admin/UserForm";

export const metadata = { title: "Subscriber — FadilJaya.NET" };

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let admin;
  try { admin = await getCurrentAdmin(); } catch { redirect("/admin/login"); }

  const { id } = await params;
  const isNew = id === "new";
  const subId = isNew ? null : parseInt(id);
  if (!isNew && isNaN(subId!)) notFound();

  const locationIds = await getAccessibleLocationIds(admin.id);

  const [packages, locations] = await Promise.all([
    db.package.findMany({
      where: {
        type:     "langganan",
        isActive: true,
        ...(locationIds !== null
          ? { OR: [{ locationId: null }, { locationId: { in: locationIds } }] }
          : {}),
      },
      select:  { id: true, name: true, type: true, price: true },
      orderBy: { name: "asc" },
    }),
    db.location.findMany({
      where:   locationIds !== null ? { id: { in: locationIds } } : undefined,
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const pkgSerialized = packages.map((p) => ({
    ...p,
    price: p.price.toString(),
    type:  p.type as string,
  }));

  if (isNew) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Tambah Subscriber</h1>
          <p className="text-slate-400 text-sm mt-1">Daftarkan user langganan baru</p>
        </div>
        <UserForm mode="create" packages={pkgSerialized} locations={locations} />
      </div>
    );
  }

  // Edit mode — fetch existing subscriber
  const sub = await db.subscriber.findUnique({
    where:  { id: subId! },
    select: {
      id: true, username: true, name: true,
      packageId: true, locationId: true, status: true,
      activatedAt: true, expiredAt: true,
    },
  });
  if (!sub) notFound();

  // Access check for admin_lokasi
  if (
    locationIds !== null &&
    !locationIds.includes(sub.locationId)
  ) {
    redirect("/admin/users");
  }

  const initial = {
    id:         sub.id,
    username:   sub.username,
    name:       sub.name,
    packageId:  sub.packageId,
    locationId: sub.locationId,
    status:     sub.status as string,
    expiredAt:  sub.expiredAt?.toISOString() ?? null,
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Edit Subscriber</h1>
        <p className="text-slate-400 text-sm mt-1">
          <span className="font-mono text-blue-400">{sub.username}</span>
        </p>
      </div>
      <UserForm mode="edit" packages={pkgSerialized} locations={locations} initial={initial} />
    </div>
  );
}
