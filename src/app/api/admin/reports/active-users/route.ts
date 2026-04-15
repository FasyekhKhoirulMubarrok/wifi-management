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
 * GET /api/admin/reports/active-users?from=YYYY-MM-DD&to=YYYY-MM-DD&locationId=
 * Returns active user counts per day from session_logs.
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
    locationId          ? { locationId }
    : accessibleIds !== null ? { locationId: { in: accessibleIds } }
    : {};

  try {
    const logs = await db.sessionLog.findMany({
      where: {
        loginAt: { gte: from, lte: to },
        ...locationWhere,
      },
      select: { username: true, userType: true, loginAt: true, location: { select: { id: true, name: true } } },
      orderBy: { loginAt: "asc" },
    });

    // Daily active distinct users
    const dailyMap = new Map<string, { subscribers: Set<string>; vouchers: Set<string> }>();
    for (const log of logs) {
      const day = log.loginAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(day) ?? { subscribers: new Set(), vouchers: new Set() };
      if (log.userType === "subscriber") entry.subscribers.add(log.username);
      else entry.vouchers.add(log.username);
      dailyMap.set(day, entry);
    }

    const dailyChart = [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, entry]) => ({
        date,
        subscribers: entry.subscribers.size,
        vouchers:    entry.vouchers.size,
        total:       entry.subscribers.size + entry.vouchers.size,
      }));

    // Per-location breakdown
    const locMap = new Map<number, { id: number; name: string; users: Set<string> }>();
    for (const log of logs) {
      const existing = locMap.get(log.location.id) ?? { ...log.location, users: new Set<string>() };
      existing.users.add(log.username);
      locMap.set(log.location.id, existing);
    }
    const perLocation = [...locMap.values()].map((l) => ({
      locationId:   l.id,
      locationName: l.name,
      uniqueUsers:  l.users.size,
    })).sort((a, b) => b.uniqueUsers - a.uniqueUsers);

    const uniqueSubscribers = new Set(logs.filter((l) => l.userType === "subscriber").map((l) => l.username)).size;
    const uniqueVouchers    = new Set(logs.filter((l) => l.userType === "voucher").map((l) => l.username)).size;

    return NextResponse.json({
      ok: true,
      totalUnique: uniqueSubscribers + uniqueVouchers,
      uniqueSubscribers,
      uniqueVouchers,
      dailyChart,
      perLocation,
    });
  } catch (err) {
    console.error("[reports/active-users]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
