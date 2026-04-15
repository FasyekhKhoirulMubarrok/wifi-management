import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { sendPush } from "@/lib/push";
import { db } from "@/lib/db";

/**
 * POST /api/admin/settings/test-push
 *
 * Sends a test push notification to all subscriptions of the current admin.
 */
export async function POST(request: NextRequest) {
  void request;

  try {
    const admin = await getCurrentAdmin();

    const subs = await db.pushSubscription.findMany({
      where: { userType: "admin", userId: String(admin.id) },
    });

    if (subs.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada subscription aktif. Aktifkan notifikasi di browser terlebih dahulu." },
        { status: 404 },
      );
    }

    await Promise.all(
      subs.map((s) =>
        sendPush(s, {
          title: "Test Notifikasi",
          body:  `Halo ${admin.name}! Push notification berhasil dikonfigurasi.`,
          url:   "/admin/settings",
        }),
      ),
    );

    return NextResponse.json({ ok: true, sent: subs.length });
  } catch (err) {
    if (err instanceof Error && err.message.includes("terautentikasi")) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[settings/test-push]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
