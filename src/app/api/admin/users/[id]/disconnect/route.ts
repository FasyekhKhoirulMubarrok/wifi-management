import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken } from "@/lib/auth";
import { closeRadacctSession } from "@/lib/radius";

async function requireAdmin(request: NextRequest) {
  const token = extractToken(request);
  if (!token) return null;
  try {
    const { session } = await validateSession(token);
    if (session.userType !== "admin") return null;
    return await db.admin.findUnique({
      where:  { id: parseInt(session.userId) },
      select: { id: true, role: true, locations: { select: { locationId: true } } },
    });
  } catch { return null; }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const subId = parseInt(id);
  if (isNaN(subId)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  try {
    const sub = await db.subscriber.findUnique({
      where:  { id: subId },
      select: { username: true, locationId: true },
    });
    if (!sub) return NextResponse.json({ error: "Subscriber tidak ditemukan" }, { status: 404 });

    const hasAccess =
      admin.role === "super_admin" ||
      admin.locations.some((l) => l.locationId === sub.locationId);
    if (!hasAccess) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

    // 1. Invalidate all active JWT sessions for this subscriber
    await db.session.updateMany({
      where: { userId: String(subId), userType: "subscriber", isActive: true },
      data:  { isActive: false },
    });

    // 2. Close open radacct sessions
    await closeRadacctSession(sub.username);

    await db.adminLog.create({
      data: {
        adminId:     admin.id,
        action:      "DISCONNECT_USER",
        description: `Putus koneksi subscriber "${sub.username}" (ID ${subId})`,
        ipAddress:   request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[users/disconnect]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
