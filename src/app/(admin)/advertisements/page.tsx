import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { AdvertisementsManager } from "@/components/admin/AdvertisementsManager";

export const metadata = { title: "Iklan — FadilJaya.NET" };

export default async function AdvertisementsPage() {
  try { await getCurrentAdmin(); } catch { redirect("/admin/login"); }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Manajemen Iklan</h1>
        <p className="text-slate-400 text-sm mt-1">Kelola iklan, jadwal, dan statistik performa</p>
      </div>
      <AdvertisementsManager />
    </div>
  );
}
