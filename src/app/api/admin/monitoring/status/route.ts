import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken } from "@/lib/auth";
import { pingAll } from "@/lib/ping";

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

interface ActiveCountRow { nasIp: string; cnt: bigint }

/**
 * GET /api/admin/monitoring/status
 * Returns per-location status: router ping + active user count.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const locations = await db.location.findMany({
      where: admin.role === "super_admin"
        ? undefined
        : { id: { in: admin.locations.map((l) => l.locationId) } },
      select: { id: true, name: true, address: true, mikrotikIp: true, isActive: true },
      orderBy: { name: "asc" },
    });

    // Ping all routers concurrently
    const ips = locations.map((l) => l.mikrotikIp);
    const pingResults = await pingAll(ips);

    // Count active radacct sessions per NAS IP
    let activeCounts: ActiveCountRow[] = [];
    if (ips.length > 0) {
      activeCounts = await db.$queryRaw<ActiveCountRow[]>`
        SELECT NASIPAddress AS nasIp, COUNT(*) AS cnt
        FROM radacct
        WHERE AcctStopTime IS NULL
        GROUP BY NASIPAddress
      `;
    }
    const countMap = new Map(activeCounts.map((r) => [r.nasIp, Number(r.cnt)]));

    const statuses = locations.map((loc) => ({
      id:           loc.id,
      name:         loc.name,
      address:      loc.address,
      mikrotikIp:   loc.mikrotikIp,
      isActive:     loc.isActive,
      routerOnline: pingResults[loc.mikrotikIp] ?? false,
      activeUsers:  countMap.get(loc.mikrotikIp) ?? 0,
    }));

    return NextResponse.json({ ok: true, statuses });
  } catch (err) {
    console.error("[monitoring/status]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
