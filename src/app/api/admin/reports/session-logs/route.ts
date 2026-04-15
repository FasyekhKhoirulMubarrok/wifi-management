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
 * GET /api/admin/reports/session-logs?from=&to=&locationId=&search=&page=&sort=&dir=
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const fromStr     = searchParams.get("from");
  const toStr       = searchParams.get("to");
  const locationStr = searchParams.get("locationId");
  const search      = searchParams.get("search") ?? "";
  const page        = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit       = 50;
  const sortField   = searchParams.get("sort") ?? "loginAt";
  const sortDir     = searchParams.get("dir") === "asc" ? "asc" : "desc";

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

  const validSortFields = ["loginAt", "logoutAt", "dataUsedMb", "durationSecs", "username"] as const;
  type SortField = typeof validSortFields[number];
  const orderBy = validSortFields.includes(sortField as SortField)
    ? { [sortField]: sortDir }
    : { loginAt: sortDir as "asc" | "desc" };

  try {
    const where = {
      loginAt: { gte: from, lte: to },
      ...(search ? { username: { contains: search } } : {}),
      ...locationWhere,
    };

    const [logs, total] = await Promise.all([
      db.sessionLog.findMany({
        where,
        include: { location: { select: { id: true, name: true } } },
        orderBy,
        skip:  (page - 1) * limit,
        take:  limit,
      }),
      db.sessionLog.count({ where }),
    ]);

    const rows = logs.map((l) => ({
      id:             l.id,
      username:       l.username,
      userType:       l.userType,
      macAddress:     l.macAddress,
      ipAddress:      l.ipAddress,
      location:       l.location,
      dataUsedMb:     Number(l.dataUsedMb),
      durationSecs:   l.durationSecs,
      loginAt:        l.loginAt,
      logoutAt:       l.logoutAt,
      terminateCause: l.terminateCause,
    }));

    return NextResponse.json({
      ok: true,
      logs: rows,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[reports/session-logs]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
