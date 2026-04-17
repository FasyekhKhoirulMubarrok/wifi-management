import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { PortalLoginClient } from "@/components/portal/PortalLoginClient";

export const metadata = { title: "Login — FadilJaya.NET" };

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mac?: string; ip?: string; username?: string; "link-login"?: string }>;
}) {
  const sp        = await searchParams;
  const mac       = sp.mac?.toUpperCase() ?? null;
  const linkLogin = sp["link-login"] ?? null;

  // Get IP for location matching
  const hdr = await headers();
  const clientIp = hdr.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdr.get("x-real-ip") ?? null;

  if (mac) {
    // Check blacklist (null locationId = all locations)
    const blacklisted = await db.macRule.findFirst({
      where: { macAddress: mac, type: "blacklist" },
    });
    if (blacklisted) redirect("/portal/blocked");

    // Check whitelist
    const whitelisted = await db.macRule.findFirst({
      where: { macAddress: mac, type: "whitelist" },
    });
    if (whitelisted) {
      // Whitelisted devices are auto-approved — redirect to a success page
      // In production, MikroTik would have already allowed them at network level
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Perangkat Diizinkan</h2>
            <p className="text-slate-400 text-sm">Perangkat Anda ada di daftar whitelist.<br />Anda langsung terhubung ke jaringan.</p>
          </div>
        </div>
      );
    }
  }

  return <PortalLoginClient mac={mac} clientIp={clientIp} linkLogin={linkLogin} />;
}
