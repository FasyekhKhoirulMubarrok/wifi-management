import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateMikrotikRequest } from "@/lib/apiKeyMiddleware";

/**
 * GET /api/mikrotik/user/status?username=xxx&nas_ip=xxx
 *
 * MikroTik polls this to validate users periodically.
 * Returns whether the user is still allowed to be online.
 *
 * Response:
 * { valid: true,  username, type, quota_left_mb, time_left_secs }
 * { valid: false, reason: "expired" | "blocked" | "quota_exceeded" | "not_found" }
 */
export async function GET(request: NextRequest) {
  const authErr = validateMikrotikRequest(request);
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: authErr.status });

  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const nasIp    = searchParams.get("nas_ip");

  if (!username) return NextResponse.json({ error: "username wajib diisi" }, { status: 400 });

  try {
    // Check MAC blacklist if MAC provided
    const mac = searchParams.get("mac")?.toUpperCase();
    if (mac) {
      let locationId: number | null = null;
      if (nasIp) {
        const loc = await db.location.findFirst({ where: { mikrotikIp: nasIp }, select: { id: true } });
        locationId = loc?.id ?? null;
      }

      const blacklisted = await db.macRule.findFirst({
        where: {
          macAddress: mac,
          type: "blacklist",
          OR: [
            ...(locationId ? [{ locationId }] : []),
            { locationId: null },
          ],
        },
      });
      if (blacklisted) {
        return NextResponse.json({ valid: false, reason: "blocked" });
      }
    }

    const now = new Date();

    // ── Try subscriber ────────────────────────────────────────────────
    const subscriber = await db.subscriber.findUnique({
      where:   { username },
      include: { package: true },
    });

    if (subscriber) {
      if (subscriber.status === "blocked") {
        return NextResponse.json({ valid: false, reason: "blocked" });
      }
      if (subscriber.status === "expired") {
        return NextResponse.json({ valid: false, reason: "expired" });
      }

      const quotaExceeded =
        subscriber.package.quotaLimitMb !== null &&
        subscriber.quotaUsedMb >= subscriber.package.quotaLimitMb;
      if (quotaExceeded) {
        return NextResponse.json({ valid: false, reason: "quota_exceeded" });
      }

      const timeExpired =
        subscriber.expiredAt !== null && now > subscriber.expiredAt;
      if (timeExpired) {
        return NextResponse.json({ valid: false, reason: "expired" });
      }

      const quotaLeftMb = subscriber.package.quotaLimitMb !== null
        ? Math.max(0, Number(subscriber.package.quotaLimitMb) - Number(subscriber.quotaUsedMb))
        : null;
      const timeLeftSecs = subscriber.expiredAt
        ? Math.max(0, Math.floor((subscriber.expiredAt.getTime() - now.getTime()) / 1000))
        : null;

      return NextResponse.json({
        valid:          true,
        type:           "subscriber",
        username,
        quota_left_mb:  quotaLeftMb,
        time_left_secs: timeLeftSecs,
        speed_down_kbps: subscriber.package.speedDownKbps,
        speed_up_kbps:   subscriber.package.speedUpKbps,
      });
    }

    // ── Try voucher (by code) ─────────────────────────────────────────
    const voucher = await db.voucher.findUnique({
      where:   { code: username },
      include: { package: true },
    });

    if (voucher) {
      if (voucher.status === "expired") {
        return NextResponse.json({ valid: false, reason: "expired" });
      }
      if (voucher.status === "unused") {
        return NextResponse.json({ valid: false, reason: "not_activated" });
      }

      const quotaExceeded =
        voucher.package.quotaLimitMb !== null &&
        voucher.quotaUsedMb >= voucher.package.quotaLimitMb;
      if (quotaExceeded) {
        return NextResponse.json({ valid: false, reason: "quota_exceeded" });
      }

      const timeExpired = voucher.expiredAt !== null && now > voucher.expiredAt;
      if (timeExpired) {
        return NextResponse.json({ valid: false, reason: "expired" });
      }

      const quotaLeftMb = voucher.package.quotaLimitMb !== null
        ? Math.max(0, Number(voucher.package.quotaLimitMb) - Number(voucher.quotaUsedMb))
        : null;
      const timeLeftSecs = voucher.expiredAt
        ? Math.max(0, Math.floor((voucher.expiredAt.getTime() - now.getTime()) / 1000))
        : null;

      return NextResponse.json({
        valid:           true,
        type:            "voucher",
        username,
        quota_left_mb:   quotaLeftMb,
        time_left_secs:  timeLeftSecs,
        speed_down_kbps: voucher.package.speedDownKbps,
        speed_up_kbps:   voucher.package.speedUpKbps,
      });
    }

    return NextResponse.json({ valid: false, reason: "not_found" });
  } catch (err) {
    console.error("[mikrotik/user/status]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
