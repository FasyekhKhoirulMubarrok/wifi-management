import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken } from "@/lib/auth";

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

/**
 * POST /api/admin/users/[id]/extend
 * Renew subscription: set activatedAt = now, recalculate expiredAt from package.
 */
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
      where:   { id: subId },
      include: { package: { select: { timeLimitDays: true } } },
    });
    if (!sub) return NextResponse.json({ error: "Subscriber tidak ditemukan" }, { status: 404 });

    const hasAccess =
      admin.role === "super_admin" ||
      admin.locations.some((l) => l.locationId === sub.locationId);
    if (!hasAccess) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

    const now       = new Date();
    const expiredAt = sub.package.timeLimitDays
      ? new Date(now.getTime() + sub.package.timeLimitDays * 86400_000)
      : null;

    const updated = await db.subscriber.update({
      where: { id: subId },
      data:  {
        activatedAt: now,
        expiredAt,
        status:      "active",
      },
      select: { expiredAt: true },
    });

    await db.adminLog.create({
      data: {
        adminId:     admin.id,
        action:      "EXTEND_SUBSCRIBER",
        description: `Perpanjang subscriber "${sub.username}" hingga ${updated.expiredAt?.toISOString() ?? "unlimited"}`,
        ipAddress:   request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      },
    });

    return NextResponse.json({ ok: true, expiredAt: updated.expiredAt });
  } catch (err) {
    console.error("[users/extend]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
