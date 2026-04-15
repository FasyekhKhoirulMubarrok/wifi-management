import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/jwt";
import { getClientIP } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      code?: string;
      macAddress?: string;
    };

    const rawCode = body.code?.trim().toUpperCase();
    const macAddress = body.macAddress?.trim();

    if (!rawCode) {
      return NextResponse.json(
        { error: "Kode voucher wajib diisi" },
        { status: 400 },
      );
    }

    // Normalisasi format: hapus semua non-alphanumeric lalu format XXXX-XXXX-XXXX
    const cleaned = rawCode.replace(/[^A-Z0-9]/g, "");
    if (cleaned.length !== 12) {
      return NextResponse.json(
        { error: "Format kode voucher tidak valid (XXXX-XXXX-XXXX)" },
        { status: 400 },
      );
    }
    const code = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}`;

    // Cari voucher
    const voucher = await db.voucher.findUnique({
      where:   { code },
      include: { package: true },
    });

    if (!voucher) {
      return NextResponse.json(
        { error: "Kode voucher tidak ditemukan" },
        { status: 404 },
      );
    }

    if (voucher.status === "expired") {
      return NextResponse.json(
        { error: "Voucher sudah expired", code: "EXPIRED" },
        { status: 403 },
      );
    }

    if (voucher.status === "active") {
      // Cek apakah sudah expired berdasarkan waktu atau kuota
      const waktuHabis =
        voucher.expiredAt !== null && new Date() > voucher.expiredAt;
      const quotaHabis =
        voucher.package.quotaLimitMb !== null &&
        voucher.quotaUsedMb >= voucher.package.quotaLimitMb;

      if (waktuHabis || quotaHabis) {
        // Update status ke expired
        await db.voucher.update({
          where: { id: voucher.id },
          data:  { status: "expired" },
        });
        return NextResponse.json(
          { error: "Voucher sudah expired", code: "EXPIRED" },
          { status: 403 },
        );
      }

      // Voucher masih aktif — jika MAC sama, lanjutkan sesi
      if (macAddress && voucher.usedByMac === macAddress) {
        const token = await createSession(
          `voucher:${voucher.id}`,
          "voucher",
          { macAddress, ipAddress: getClientIP(request) },
        );
        const response = buildVoucherResponse(voucher, token);
        return response;
      }

      return NextResponse.json(
        { error: "Voucher sedang digunakan oleh perangkat lain" },
        { status: 403 },
      );
    }

    // status === "unused" — aktivasi voucher
    const now = new Date();
    const timeLimitDays = voucher.package.timeLimitDays;
    const expiredAt = timeLimitDays
      ? new Date(now.getTime() + timeLimitDays * 24 * 60 * 60 * 1000)
      : null;

    const activated = await db.voucher.update({
      where: { id: voucher.id },
      data:  {
        status:    "active",
        usedByMac: macAddress ?? null,
        usedAt:    now,
        expiredAt,
      },
      include: { package: true },
    });

    const token = await createSession(
      `voucher:${activated.id}`,
      "voucher",
      { macAddress, ipAddress: getClientIP(request) },
    );

    return buildVoucherResponse(activated, token);
  } catch (err) {
    console.error("[user/voucher]", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}

function buildVoucherResponse(
  voucher: {
    id: number;
    code: string;
    locationId: number | null;
    quotaUsedMb: bigint;
    expiredAt: Date | null;
    package: {
      name: string;
      quotaLimitMb: bigint | null;
      timeLimitDays: number | null;
      speedDownKbps: number;
      speedUpKbps: number;
    };
  },
  token: string,
): NextResponse {
  const response = NextResponse.json({
    ok: true,
    voucher: {
      id:          voucher.id,
      code:        voucher.code,
      locationId:  voucher.locationId,
      quotaUsedMb: voucher.quotaUsedMb.toString(),
      expiredAt:   voucher.expiredAt,
      package: {
        name:          voucher.package.name,
        quotaLimitMb:  voucher.package.quotaLimitMb?.toString() ?? null,
        timeLimitDays: voucher.package.timeLimitDays,
        speedDownKbps: voucher.package.speedDownKbps,
        speedUpKbps:   voucher.package.speedUpKbps,
      },
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
