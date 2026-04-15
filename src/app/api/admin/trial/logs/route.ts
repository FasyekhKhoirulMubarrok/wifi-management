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
 * GET /api/admin/trial/logs?date=YYYY-MM-DD&locationId=
 * Returns trial sessions for a given date (default today).
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const accessibleIds = admin.role === "super_admin"
    ? null
    : admin.locations.map((l) => l.locationId);

  const { searchParams } = new URL(request.url);
  const dateStr     = searchParams.get("date");
  const locationStr = searchParams.get("locationId");

  const now   = new Date();
  const start = dateStr
    ? new Date(dateStr + "T00:00:00.000Z")
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end   = dateStr
    ? new Date(dateStr + "T23:59:59.999Z")
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const locationId = locationStr ? parseInt(locationStr) : null;

  try {
    const locationWhere =
      locationId          ? { locationId }
      : accessibleIds !== null ? { locationId: { in: accessibleIds } }
      : {};

    const logs = await db.trialSession.findMany({
      where:   { usedAt: { gte: start, lte: end }, ...locationWhere },
      select:  {
        id:         true,
        macAddress: true,
        usedAt:     true,
        expiredAt:  true,
        location:   { select: { id: true, name: true } },
      },
      orderBy: { usedAt: "desc" },
      take:    500,
    });

    return NextResponse.json({ ok: true, total: logs.length, logs });
  } catch (err) {
    console.error("[trial/logs GET]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
