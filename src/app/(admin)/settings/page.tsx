import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { readSettings } from "@/lib/settings";
import { SettingsManager } from "@/components/admin/SettingsManager";

export const metadata = { title: "Pengaturan — FadilJaya.NET" };

export default async function SettingsPage() {
  let admin;
  try { admin = await getCurrentAdmin(); } catch { redirect("/admin/login"); }
  if (admin.role !== "super_admin") redirect("/admin/dashboard");

  const settings = readSettings();

  const locations = await db.location.findMany({
    select:  { id: true, name: true, mikrotikIp: true, mikrotikUser: true },
    orderBy: { name: "asc" },
  });

  const radiusConfig = {
    authPort: 1812,
    acctPort: 1813,
    secret:   "(dari clients.conf — tidak disimpan di DB)",
    clients:  locations.map((l) => ({
      locationId:   l.id,
      locationName: l.name,
      mikrotikIp:   l.mikrotikIp,
      mikrotikUser: l.mikrotikUser,
    })),
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Pengaturan Sistem</h1>
        <p className="text-slate-400 text-sm mt-1">Konfigurasi aplikasi, RADIUS, push notification, dan backup</p>
      </div>
      <SettingsManager initial={settings} radiusConfig={radiusConfig} />
    </div>
  );
}
