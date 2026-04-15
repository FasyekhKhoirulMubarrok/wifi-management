import { NextRequest, NextResponse } from "next/server";
import { invalidateSession } from "@/lib/jwt";
import { getClientIP } from "@/lib/auth";
import { validateSession } from "@/lib/jwt";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("admin_token")?.value;

    if (token) {
      // Cross-check dulu untuk dapat adminId
      try {
        const { session } = await validateSession(token);
        await invalidateSession(token);

        await db.adminLog.create({
          data: {
            adminId:     parseInt(session.userId),
            action:      "logout",
            description: "Logout berhasil",
            ipAddress:   getClientIP(request),
          },
        });
      } catch {
        // Token tidak valid — tidak masalah, hapus saja cookie-nya
      }
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.delete("admin_token");
    return response;
  } catch (err) {
    console.error("[admin/logout]", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
