import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { comparePassword, getClientIP } from "@/lib/auth";
import { createSession } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      username?: string;
      password?: string;
      macAddress?: string;
    };
    const { username, password, macAddress } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi" },
        { status: 400 },
      );
    }

    const subscriber = await db.subscriber.findUnique({
      where:   { username: username.trim() },
      include: { package: true, location: true },
    });

    if (!subscriber) {
      return NextResponse.json(
        { error: "Username atau password salah" },
        { status: 401 },
      );
    }

    const valid = await comparePassword(password, subscriber.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Username atau password salah" },
        { status: 401 },
      );
    }

    // Cek status
    if (subscriber.status === "blocked") {
      return NextResponse.json(
        { error: "Akun Anda diblokir. Hubungi admin." },
        { status: 403 },
      );
    }

    // Cek expired (kuota & waktu)
    const quotaHabis =
      subscriber.package.quotaLimitMb !== null &&
      subscriber.quotaUsedMb >= subscriber.package.quotaLimitMb;
    const waktuHabis =
      subscriber.expiredAt !== null &&
      new Date() > subscriber.expiredAt;

    if (quotaHabis || waktuHabis || subscriber.status === "expired") {
      return NextResponse.json(
        { error: "Kuota atau masa berlaku habis", code: "EXPIRED" },
        { status: 403 },
      );
    }

    const token = await createSession(
      String(subscriber.id),
      "subscriber",
      { macAddress, ipAddress: getClientIP(request) },
    );

    const response = NextResponse.json({
      ok: true,
      user: {
        id:         subscriber.id,
        username:   subscriber.username,
        name:       subscriber.name,
        locationId: subscriber.locationId,
        package:    {
          name:          subscriber.package.name,
          quotaLimitMb:  subscriber.package.quotaLimitMb?.toString() ?? null,
          timeLimitDays: subscriber.package.timeLimitDays,
          speedDownKbps: subscriber.package.speedDownKbps,
          speedUpKbps:   subscriber.package.speedUpKbps,
        },
        quotaUsedMb: subscriber.quotaUsedMb.toString(),
        expiredAt:   subscriber.expiredAt,
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
  } catch (err) {
    console.error("[user/login]", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
