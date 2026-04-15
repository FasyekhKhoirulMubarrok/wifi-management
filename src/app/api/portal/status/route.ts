import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractUserToken } from "@/lib/auth";

/**
 * GET /api/portal/status
 * Returns current user status (subscriber or voucher).
 * Reads user_token from cookie.
 */
export async function GET(request: NextRequest) {
  const token = extractUserToken(request);
  if (!token) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let session: { id: string; userType: string; userId: string };
  try {
    const validated = await validateSession(token);
    session = validated.session;
  } catch {
    return NextResponse.json({ error: "Session tidak valid" }, { status: 401 });
  }

  // Read session record to get MAC and startedAt
  const sessionRecord = await db.session.findFirst({
    where: { token, isActive: true },
    select: { macAddress: true, createdAt: true },
  });

  try {
    if (session.userType === "subscriber") {
      const subscriber = await db.subscriber.findUnique({
        where:   { id: parseInt(session.userId) },
        include: { package: true, location: true },
      });

      if (!subscriber) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

      const quotaLimitMb  = subscriber.package.quotaLimitMb ? Number(subscriber.package.quotaLimitMb) : null;
      const quotaUsedMb   = Number(subscriber.quotaUsedMb);
      const quotaLeftMb   = quotaLimitMb !== null ? Math.max(0, quotaLimitMb - quotaUsedMb) : null;
      const quotaPct      = quotaLimitMb !== null && quotaLimitMb > 0
        ? Math.max(0, Math.round((quotaLeftMb! / quotaLimitMb) * 100))
        : null;

      const now            = new Date();
      const timeLeftMs     = subscriber.expiredAt ? Math.max(0, subscriber.expiredAt.getTime() - now.getTime()) : null;
      const timeLeftDays   = timeLeftMs !== null ? Math.floor(timeLeftMs / 86400000) : null;
      const timeLeftHours  = timeLeftMs !== null ? Math.floor((timeLeftMs % 86400000) / 3600000) : null;

      return NextResponse.json({
        ok:       true,
        userType: "subscriber",
        username: subscriber.username,
        name:     subscriber.name,
        locationId:   subscriber.locationId,
        locationName: subscriber.location.name,
        packageName:  subscriber.package.name,
        speedDownKbps: subscriber.package.speedDownKbps,
        speedUpKbps:   subscriber.package.speedUpKbps,
        quota: {
          limitMb:  quotaLimitMb,
          usedMb:   quotaUsedMb,
          leftMb:   quotaLeftMb,
          pct:      quotaPct,
        },
        time: {
          expiredAt:  subscriber.expiredAt,
          leftDays:   timeLeftDays,
          leftHours:  timeLeftHours,
        },
        macAddress:    sessionRecord?.macAddress ?? null,
        sessionStart:  sessionRecord?.createdAt  ?? null,
        isExpired: subscriber.status === "expired",
      });
    }

    if (session.userType === "voucher") {
      // userId is `voucher:${id}`
      const voucherId = parseInt(session.userId.replace("voucher:", ""));
      const voucher   = await db.voucher.findUnique({
        where:   { id: voucherId },
        include: { package: true, location: true },
      });

      if (!voucher) return NextResponse.json({ error: "Voucher tidak ditemukan" }, { status: 404 });

      const quotaLimitMb = voucher.package.quotaLimitMb ? Number(voucher.package.quotaLimitMb) : null;
      const quotaUsedMb  = Number(voucher.quotaUsedMb);
      const quotaLeftMb  = quotaLimitMb !== null ? Math.max(0, quotaLimitMb - quotaUsedMb) : null;
      const quotaPct     = quotaLimitMb !== null && quotaLimitMb > 0
        ? Math.max(0, Math.round((quotaLeftMb! / quotaLimitMb) * 100))
        : null;

      const now           = new Date();
      const timeLeftMs    = voucher.expiredAt ? Math.max(0, voucher.expiredAt.getTime() - now.getTime()) : null;
      const timeLeftDays  = timeLeftMs !== null ? Math.floor(timeLeftMs / 86400000) : null;
      const timeLeftHours = timeLeftMs !== null ? Math.floor((timeLeftMs % 86400000) / 3600000) : null;

      return NextResponse.json({
        ok:       true,
        userType: "voucher",
        username: voucher.code,
        name:     null,
        locationId:   voucher.locationId,
        locationName: voucher.location?.name ?? "",
        packageName:  voucher.package.name,
        speedDownKbps: voucher.package.speedDownKbps,
        speedUpKbps:   voucher.package.speedUpKbps,
        quota: {
          limitMb:  quotaLimitMb,
          usedMb:   quotaUsedMb,
          leftMb:   quotaLeftMb,
          pct:      quotaPct,
        },
        time: {
          expiredAt:  voucher.expiredAt,
          leftDays:   timeLeftDays,
          leftHours:  timeLeftHours,
        },
        macAddress:   sessionRecord?.macAddress ?? null,
        sessionStart: sessionRecord?.createdAt  ?? null,
        isExpired: voucher.status === "expired",
      });
    }

    return NextResponse.json({ error: "Tipe user tidak dikenal" }, { status: 400 });
  } catch (err) {
    console.error("[portal/status]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
