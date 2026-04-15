import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { ComparisonDashboard } from "@/components/admin/ComparisonDashboard";

export const metadata = { title: "Perbandingan Lokasi — FadilJaya.NET" };

export default async function ComparisonPage() {
  let admin;
  try { admin = await getCurrentAdmin(); } catch { redirect("/admin/login"); }

  // Super admin only
  if (admin.role !== "super_admin") redirect("/admin/dashboard");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Perbandingan Antar Lokasi</h1>
        <p className="text-slate-400 text-sm mt-1">Bandingkan performa revenue, user, dan data antar semua lokasi</p>
      </div>
      <ComparisonDashboard />
    </div>
  );
}
