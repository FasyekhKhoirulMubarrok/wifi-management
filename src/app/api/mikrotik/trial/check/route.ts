import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateMikrotikRequest } from "@/lib/apiKeyMiddleware";

/**
 * POST /api/mikrotik/trial/check
 *
 * Body: { mac: string, location_id: number }
 *
 * Urutan logika:
 * 1. Validasi API key + whitelist IP
 * 2. Blacklist → { allowed: false, reason: "blocked" }
 * 3. Whitelist → { allowed: true, type: "whitelist" }
 * 4. Cek trial aktif di lokasi
 * 5. Cek sudah trial hari ini → { allowed: false, reason: "already_used" }
 * 6. Insert trial session → { allowed: true, type: "trial", ... }
 */
export async function POST(request: NextRequest) {
  const authErr = validateMikrotikRequest(request);
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: authErr.status });

  try {
    const body = await request.json() as { mac?: string; location_id?: number };
    const mac        = body.mac?.trim().toUpperCase();
    const locationId = body.location_id;

    if (!mac)        return NextResponse.json({ error: "mac wajib diisi" },         { status: 400 });
    if (!locationId) return NextResponse.json({ error: "location_id wajib diisi" }, { status: 400 });

    // Step 2: Blacklist check
    const blacklisted = await db.macRule.findFirst({
      where: {
        macAddress: mac,
        type: "blacklist",
        OR: [{ locationId }, { locationId: null }],
      },
    });
    if (blacklisted) {
      return NextResponse.json({ allowed: false, reason: "blocked" });
    }

    // Step 3: Whitelist check
    const whitelisted = await db.macRule.findFirst({
      where: {
        macAddress: mac,
        type: "whitelist",
        OR: [{ locationId }, { locationId: null }],
      },
    });
    if (whitelisted) {
      return NextResponse.json({ allowed: true, type: "whitelist" });
    }

    // Step 4: Check trial config for this location
    const trialConfig = await db.trialConfig.findUnique({ where: { locationId } });
    if (!trialConfig || !trialConfig.isActive) {
      return NextResponse.json({ allowed: false, reason: "trial_disabled" });
    }

    // Step 5: Check if already trialed today at this location
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const existing = await db.trialSession.findFirst({
      where: {
        macAddress: mac,
        locationId,
        usedAt: { gte: todayStart, lte: todayEnd },
      },
    });
    if (existing) {
      return NextResponse.json({ allowed: false, reason: "already_used" });
    }

    // Step 6: Insert trial session
    const now       = new Date();
    const expiredAt = new Date(now.getTime() + trialConfig.durationMinutes * 60 * 1000);

    await db.trialSession.create({
      data: {
        macAddress: mac,
        locationId,
        usedAt:    now,
        expiredAt,
      },
    });

    return NextResponse.json({
      allowed:          true,
      type:             "trial",
      duration_seconds: trialConfig.durationMinutes * 60,
      speed_kbps:       trialConfig.speedKbps,
      expired_at:       expiredAt.toISOString(),
    });
  } catch (err) {
    console.error("[mikrotik/trial/check]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
