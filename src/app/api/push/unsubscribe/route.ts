import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";

/**
 * DELETE /api/push/unsubscribe
 *
 * Body: { endpoint }
 *
 * Removes a push subscription. Only removes subscriptions belonging to the
 * authenticated user.
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json() as { endpoint?: string };
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "endpoint wajib diisi" }, { status: 400 });
    }

    // Resolve identity
    const cookieHeader = request.headers.get("cookie") ?? "";
    let userId: string | null = null;

    const adminMatch = cookieHeader.match(/(?:^|;\s*)admin_token=([^;]+)/);
    if (adminMatch) {
      try {
        const { session } = await validateSession(decodeURIComponent(adminMatch[1]));
        userId = session.userId;
      } catch { /* ignore */ }
    }

    if (!userId) {
      const userMatch = cookieHeader.match(/(?:^|;\s*)user_token=([^;]+)/);
      if (userMatch) {
        try {
          const { session } = await validateSession(decodeURIComponent(userMatch[1]));
          userId = session.userId;
        } catch { /* ignore */ }
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
    }

    await db.pushSubscription.deleteMany({ where: { endpoint, userId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push/unsubscribe]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
