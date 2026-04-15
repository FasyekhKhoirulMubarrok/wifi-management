import { redirect } from "next/navigation";
import { getCurrentAdmin, getAccessibleLocationIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { ReportsManager } from "@/components/admin/ReportsManager";

export const metadata = { title: "Laporan — FadilJaya.NET" };

export default async function ReportsPage() {
  let admin;
  try { admin = await getCurrentAdmin(); } catch { redirect("/admin/login"); }

  const locationIds = await getAccessibleLocationIds(admin.id);

  const locations = await db.location.findMany({
    where:   locationIds !== null ? { id: { in: locationIds } } : undefined,
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Laporan</h1>
        <p className="text-slate-400 text-sm mt-1">Analisis pendapatan, penggunaan data, dan aktivitas user</p>
      </div>
      <ReportsManager locations={locations} />
    </div>
  );
}
