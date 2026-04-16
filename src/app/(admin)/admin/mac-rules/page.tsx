import { redirect } from "next/navigation";
import { getCurrentAdmin, getAccessibleLocationIds } from "@/lib/auth";
import { db } from "@/lib/db";
import { MacRulesManager } from "@/components/admin/MacRulesManager";

export const metadata = { title: "MAC Rules — FadilJaya.NET" };

export default async function MacRulesPage() {
  let admin;
  try { admin = await getCurrentAdmin(); } catch { redirect("/admin/login"); }

  const locationIds = await getAccessibleLocationIds(admin.id);
  const locations   = await db.location.findMany({
    where:   locationIds !== null ? { id: { in: locationIds } } : undefined,
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Whitelist & Blacklist MAC</h1>
        <p className="text-slate-400 text-sm mt-1">Kelola daftar MAC address yang diizinkan atau diblokir</p>
      </div>
      <MacRulesManager locations={locations} />
    </div>
  );
}
