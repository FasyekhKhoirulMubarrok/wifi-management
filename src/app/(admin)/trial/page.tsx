import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { TrialManager } from "@/components/admin/TrialManager";

export const metadata = { title: "Trial — FadilJaya.NET" };

export default async function TrialPage() {
  try { await getCurrentAdmin(); } catch { redirect("/admin/login"); }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Manajemen Trial</h1>
        <p className="text-slate-400 text-sm mt-1">Konfigurasi trial, log, dan statistik konversi</p>
      </div>
      <TrialManager />
    </div>
  );
}
