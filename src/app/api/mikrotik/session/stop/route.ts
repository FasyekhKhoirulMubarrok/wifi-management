import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateMikrotikRequest } from "@/lib/apiKeyMiddleware";

/**
 * POST /api/mikrotik/session/stop
 *
 * Called by MikroTik when a user disconnects (Accounting-Stop).
 *
 * Body:
 * {
 *   username:         string,
 *   nas_ip:           string,
 *   data_used_mb:     number,   // total data used in this session (MB)
 *   duration_secs:    number,   // total session duration (seconds)
 *   terminate_cause?: string    // e.g. "User-Request", "Session-Timeout", "Idle-Timeout"
 * }
 */
export async function POST(request: NextRequest) {
  const authErr = validateMikrotikRequest(request);
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: authErr.status });

  try {
    const body = await request.json() as {
      username?:        string;
      nas_ip?:          string;
      data_used_mb?:    number;
      duration_secs?:   number;
      terminate_cause?: string;
    };

    const { username, nas_ip, data_used_mb, duration_secs, terminate_cause } = body;

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

    // Find the latest open session for this username at this location
    const sessionLog = await db.sessionLog.findFirst({
      where: {
        username,
        locationId: location.id,
        logoutAt:   null,
      },
      orderBy: { loginAt: "desc" },
    });

    if (!sessionLog) {
      // No open session — create a retroactive closed entry
      await db.sessionLog.create({
        data: {
          userType:     "subscriber",
          username,
          locationId:   location.id,
          dataUsedMb:   BigInt(Math.ceil(data_used_mb ?? 0)),
          durationSecs: Math.round(duration_secs ?? 0),
          loginAt:      new Date(Date.now() - (duration_secs ?? 0) * 1000),
          logoutAt:     new Date(),
          terminateCause: terminate_cause ?? null,
        },
      });
    } else {
      await db.sessionLog.update({
        where: { id: sessionLog.id },
        data: {
          logoutAt:      new Date(),
          dataUsedMb:    BigInt(Math.ceil(data_used_mb ?? 0)),
          durationSecs:  Math.round(duration_secs ?? 0),
          terminateCause: terminate_cause ?? null,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mikrotik/session/stop]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
