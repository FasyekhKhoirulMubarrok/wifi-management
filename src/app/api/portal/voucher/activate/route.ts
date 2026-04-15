import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/jwt";
import { getClientIP } from "@/lib/auth";

/**
 * POST /api/portal/voucher/activate
 * Activate a voucher via captive portal.
 * Checks MAC blacklist first.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      code?:       string;
      macAddress?: string;
      locationId?: number;
    };

    const { code: rawCode, macAddress, locationId } = body;

    if (!rawCode?.trim()) {
      return NextResponse.json({ error: "Kode voucher wajib diisi" }, { status: 400 });
    }

    // MAC blacklist check
    if (macAddress) {
      const blacklisted = await db.macRule.findFirst({
        where: {
          macAddress: macAddress.toUpperCase(),
          type: "blacklist",
          OR: [
            { locationId: locationId ?? null },
            { locationId: null },
          ],
        },
      });
      if (blacklisted) {
        return NextResponse.json({ error: "Perangkat Anda telah diblokir", code: "BLOCKED" }, { status: 403 });
      }
    }

    // Normalize code: strip non-alphanum, format XXXX-XXXX-XXXX
    const cleaned = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleaned.length !== 12) {
      return NextResponse.json({ error: "Format kode voucher tidak valid (XXXX-XXXX-XXXX)" }, { status: 400 });
    }
    const code = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}`;

    const voucher = await db.voucher.findUnique({
      where:   { code },
      include: { package: true, location: true },
    });

    if (!voucher) {
      return NextResponse.json({ error: "Kode voucher tidak ditemukan" }, { status: 404 });
    }

    if (voucher.status === "expired") {
      return NextResponse.json({ error: "Voucher sudah expired", code: "EXPIRED" }, { status: 403 });
    }

    if (voucher.status === "active") {
      const waktuHabis = voucher.expiredAt !== null && new Date() > voucher.expiredAt;
      const quotaHabis = voucher.package.quotaLimitMb !== null &&
        voucher.quotaUsedMb >= voucher.package.quotaLimitMb;

      if (waktuHabis || quotaHabis) {
        await db.voucher.update({ where: { id: voucher.id }, data: { status: "expired" } });
        return NextResponse.json({ error: "Voucher sudah expired", code: "EXPIRED" }, { status: 403 });
      }

      if (macAddress && voucher.usedByMac === macAddress.toUpperCase()) {
        const token = await createSession(
          `voucher:${voucher.id}`, "voucher",
          { macAddress, ipAddress: getClientIP(request) },
        );
        return buildResponse(voucher, token);
      }

      return NextResponse.json({ error: "Voucher sedang digunakan oleh perangkat lain" }, { status: 403 });
    }

    // Activate
    const now         = new Date();
    const expiredAt   = voucher.package.timeLimitDays
      ? new Date(now.getTime() + voucher.package.timeLimitDays * 24 * 60 * 60 * 1000)
      : null;

    const activated = await db.voucher.update({
      where:   { id: voucher.id },
      data:    {
        status:    "active",
        usedByMac: macAddress?.toUpperCase() ?? null,
        usedAt:    now,
        expiredAt,
      },
      include: { package: true, location: true },
    });

    const token = await createSession(
      `voucher:${activated.id}`, "voucher",
      { macAddress, ipAddress: getClientIP(request) },
    );

    return buildResponse(activated, token);
  } catch (err) {
    console.error("[portal/voucher/activate]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

function buildResponse(
  voucher: {
    id: number; code: string; locationId: number | null;
    quotaUsedMb: bigint; expiredAt: Date | null;
    package: { name: string; quotaLimitMb: bigint | null; timeLimitDays: number | null; speedDownKbps: number; speedUpKbps: number };
    location: { name: string } | null;
  },
  token: string,
): NextResponse {
  const response = NextResponse.json({
    ok:       true,
    userType: "voucher",
    voucher:  {
      id:            voucher.id,
      code:          voucher.code,
      locationId:    voucher.locationId,
      locationName:  voucher.location?.name ?? "",
      packageName:   voucher.package.name,
      quotaLimitMb:  voucher.package.quotaLimitMb?.toString() ?? null,
      timeLimitDays: voucher.package.timeLimitDays,
      speedDownKbps: voucher.package.speedDownKbps,
      speedUpKbps:   voucher.package.speedUpKbps,
      quotaUsedMb:   voucher.quotaUsedMb.toString(),
      expiredAt:     voucher.expiredAt,
    },
  });

  response.cookies.set("user_token", token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   60 * 60 * 24 * 7,
    path:     "/",
  });

  return response;
}
