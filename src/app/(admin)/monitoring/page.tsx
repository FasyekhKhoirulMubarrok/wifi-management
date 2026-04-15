import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { MonitoringDashboard } from "@/components/admin/MonitoringDashboard";

export const metadata = { title: "Monitoring — FadilJaya.NET" };

export default async function MonitoringPage() {
  try { await getCurrentAdmin(); } catch { redirect("/admin/login"); }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Monitoring Real-time</h1>
        <p className="text-slate-400 text-sm mt-1">Status router, user online, dan penggunaan bandwidth</p>
      </div>
      <MonitoringDashboard />
    </div>
  );
}
