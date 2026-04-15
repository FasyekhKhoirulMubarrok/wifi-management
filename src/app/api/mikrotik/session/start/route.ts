import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateMikrotikRequest } from "@/lib/apiKeyMiddleware";

/**
 * POST /api/mikrotik/session/start
 *
 * Called by MikroTik when a user connects (Accounting-Start).
 *
 * Body:
 * {
 *   username:    string,          // subscriber username or voucher code
 *   nas_ip:      string,          // MikroTik IP — used to look up locationId
 *   mac_address: string | null,
 *   ip_address:  string | null,
 *   user_type:   "subscriber" | "voucher"
 * }
 */
export async function POST(request: NextRequest) {
  const authErr = validateMikrotikRequest(request);
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: authErr.status });

  try {
    const body = await request.json() as {
      username?:    string;
      nas_ip?:      string;
      mac_address?: string | null;
      ip_address?:  string | null;
      user_type?:   string;
    };

    const { username, nas_ip, mac_address, ip_address, user_type } = body;

    if (!username) return NextResponse.json({ error: "username wajib diisi" }, { status: 400 });
    if (!nas_ip)   return NextResponse.json({ error: "nas_ip wajib diisi" },   { status: 400 });

    // Resolve locationId from NAS IP
    const location = await db.location.findFirst({
      where:  { mikrotikIp: nas_ip },
      select: { id: true },
    });

    if (!location) {
      return NextResponse.json({ error: `Lokasi dengan NAS IP ${nas_ip} tidak ditemukan` }, { status: 404 });
    }

    const userType = (user_type === "voucher" ? "voucher" : "subscriber") as "subscriber" | "voucher";

    await db.sessionLog.create({
      data: {
        userType,
        username,
        macAddress: mac_address?.toUpperCase() ?? null,
        ipAddress:  ip_address ?? null,
        locationId: location.id,
        loginAt:    new Date(),
        dataUsedMb: BigInt(0),
        durationSecs: 0,
      },
    });

    return NextResponse.json({ ok: true, location_id: location.id });
  } catch (err) {
    console.error("[mikrotik/session/start]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
