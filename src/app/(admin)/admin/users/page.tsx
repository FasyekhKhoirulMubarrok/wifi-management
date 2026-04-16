import { redirect } from "next/navigation";
import { getCurrentAdmin, getAccessibleLocationIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { UsersManager } from "@/components/admin/UsersManager";

export const metadata = { title: "Manajemen Subscriber — FadilJaya.NET" };

export default async function UsersPage() {
  let admin;
  try { admin = await getCurrentAdmin(); } catch { redirect("/admin/login"); }

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Manajemen Subscriber</h1>
        <p className="text-slate-400 text-sm mt-1">Kelola user langganan dan pantau koneksi aktif</p>
      </div>
      <UsersManager packages={pkgSerialized} locations={locations} />
    </div>
  );
}
