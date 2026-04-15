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
 * GET /api/admin/reports/data-usage?from=YYYY-MM-DD&to=YYYY-MM-DD&locationId=
 * Returns data usage from session_logs, grouped by username.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const fromStr     = searchParams.get("from");
  const toStr       = searchParams.get("to");
  const locationStr = searchParams.get("locationId");

  const now  = new Date();
  const from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to   = toStr   ? new Date(toStr + "T23:59:59.999Z") : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const accessibleIds = admin.role === "super_admin"
    ? null
    : admin.locations.map((l) => l.locationId);

  const locationId = locationStr ? parseInt(locationStr) : null;

  const locationWhere =
    locationId     ? { locationId }
    : accessibleIds !== null ? { locationId: { in: accessibleIds } }
    : {};

  try {
    const logs = await db.sessionLog.findMany({
      where: {
        loginAt: { gte: from, lte: to },
        ...locationWhere,
      },
      select: {
        username:    true,
        userType:    true,
        dataUsedMb:  true,
        durationSecs: true,
        loginAt:     true,
        location:    { select: { id: true, name: true } },
      },
      orderBy: { loginAt: "desc" },
    });

    // Aggregate by username
    const userMap = new Map<string, {
      username:     string;
      userType:     string;
      sessions:     number;
      totalDataMb:  number;
      totalSecs:    number;
      location:     { id: number; name: string } | null;
    }>();

    for (const log of logs) {
      const existing = userMap.get(log.username) ?? {
        username:    log.username,
        userType:    log.userType,
        sessions:    0,
        totalDataMb: 0,
        totalSecs:   0,
        location:    log.location,
      };
      existing.sessions++;
      existing.totalDataMb += Number(log.dataUsedMb);
      existing.totalSecs   += log.durationSecs;
      userMap.set(log.username, existing);
    }

    const usersAgg = [...userMap.values()]
      .sort((a, b) => b.totalDataMb - a.totalDataMb)
      .map((u) => ({ ...u, totalDataMb: Math.round(u.totalDataMb * 100) / 100 }));

    const totalDataMb = usersAgg.reduce((s, u) => s + u.totalDataMb, 0);

    return NextResponse.json({ ok: true, totalDataMb: Math.round(totalDataMb * 100) / 100, users: usersAgg });
  } catch (err) {
    console.error("[reports/data-usage]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
