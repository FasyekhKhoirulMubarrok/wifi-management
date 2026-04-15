import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { comparePassword } from "@/lib/auth";
import { createSession } from "@/lib/jwt";
import { getClientIP } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password wajib diisi" },
        { status: 400 },
      );
    }

    // Cari admin
    const admin = await db.admin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!admin) {
      // Sama-sama 401 agar tidak bocor informasi "email tidak terdaftar"
      return NextResponse.json(
        { error: "Email atau password salah" },
        { status: 401 },
      );
    }

    // Verifikasi password
    const valid = await comparePassword(password, admin.password);
    if (!valid) {
      // Catat gagal login di log
      await db.adminLog.create({
        data: {
          adminId:     admin.id,
          action:      "login_failed",
          description: "Password salah",
          ipAddress:   getClientIP(request),
        },
      });
      return NextResponse.json(
        { error: "Email atau password salah" },
        { status: 401 },
      );
    }

    // Buat session
    const token = await createSession(
      String(admin.id),
      "admin",
      { ipAddress: getClientIP(request) },
    );

    // Catat login berhasil
    await db.adminLog.create({
      data: {
        adminId:     admin.id,
        action:      "login",
        description: "Login berhasil",
        ipAddress:   getClientIP(request),
      },
    });

    const response = NextResponse.json({
      ok:    true,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    });

    // Set HttpOnly cookie
    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   60 * 60 * 24, // 24h
      path:     "/",
    });

    return response;
  } catch (err) {
    console.error("[admin/login]", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
