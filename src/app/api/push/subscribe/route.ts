import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";

/**
 * POST /api/push/subscribe
 *
 * Body: { endpoint, p256dh, auth }
 *
 * Saves a Web Push subscription linked to the current admin or portal user.
 * Accepts both admin_token and user_token cookies.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      endpoint?: string;
      p256dh?:   string;
      auth?:     string;
    };

    const { endpoint, p256dh, auth } = body;
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "endpoint, p256dh, auth wajib diisi" }, { status: 400 });
    }

    // Resolve identity from admin_token or user_token cookie
    const cookieHeader = request.headers.get("cookie") ?? "";

    let userId:   string | null = null;
    let userType: "admin" | "user" | null = null;

    // Try admin token first
    const adminTokenMatch = cookieHeader.match(/(?:^|;\s*)admin_token=([^;]+)/);
    if (adminTokenMatch) {
      try {
        const { session } = await validateSession(decodeURIComponent(adminTokenMatch[1]));
        if (session.userType === "admin") {
          userId   = session.userId;
          userType = "admin";
        }
      } catch {
        // Invalid token — try user token next
      }
    }

    // Try portal user token
    if (!userId) {
      const userTokenMatch = cookieHeader.match(/(?:^|;\s*)user_token=([^;]+)/);
      if (userTokenMatch) {
        try {
          const { session } = await validateSession(decodeURIComponent(userTokenMatch[1]));
          if (session.userType !== "admin") {
            userId   = session.userId;
            userType = "user";
          }
        } catch {
          // Invalid token
        }
      }
    }

    if (!userId || !userType) {
      return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
    }

    // Upsert: replace existing subscription for the same endpoint
    await db.pushSubscription.deleteMany({ where: { endpoint } });
    await db.pushSubscription.create({
      data: { userType, userId, endpoint, p256dh, auth },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push/subscribe]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
