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

interface RadacctRow {
  username:        string;
  framedIp:        string | null;
  callingMac:      string | null;
  nasIp:           string | null;
  startTime:       Date | null;
  sessionSecs:     number | null;
  inputOctets:     bigint | null;
  outputOctets:    bigint | null;
}

/**
 * GET /api/admin/users/active
 * Returns currently active radacct sessions joined with subscriber/location info.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    // Get accessible location IPs for filtering
    const locations = await db.location.findMany({
      where:  admin.role === "super_admin"
        ? undefined
        : { id: { in: admin.locations.map((l) => l.locationId) } },
      select: { id: true, name: true, mikrotikIp: true },
    });

    const nasIps = locations.map((l) => l.mikrotikIp);

    // Query active radacct sessions
    // FreeRADIUS radacct table — not in Prisma schema, use raw SQL
    const selectCols = `
      SELECT
        UserName          AS username,
        FramedIPAddress   AS framedIp,
        CallingStationId  AS callingMac,
        NASIPAddress      AS nasIp,
        AcctStartTime     AS startTime,
        AcctSessionTime   AS sessionSecs,
        AcctInputOctets   AS inputOctets,
        AcctOutputOctets  AS outputOctets
      FROM radacct
      WHERE AcctStopTime IS NULL`;

    let rows: RadacctRow[];
    if (admin.role === "super_admin") {
      rows = await db.$queryRawUnsafe<RadacctRow[]>(
        `${selectCols} ORDER BY AcctStartTime DESC LIMIT 500`,
      );
    } else if (nasIps.length === 0) {
      rows = [];
    } else {
      // nasIps come from DB — safe to interpolate directly
      const inList = nasIps.map((ip) => `'${ip}'`).join(",");
      rows = await db.$queryRawUnsafe<RadacctRow[]>(
        `${selectCols} AND NASIPAddress IN (${inList}) ORDER BY AcctStartTime DESC LIMIT 500`,
      );
    }

    // Build NAS IP → location map
    const nasToLocation = new Map(locations.map((l) => [l.mikrotikIp, l]));

    // Get subscriber info for usernames
    const usernames = [...new Set(rows.map((r) => r.username))];
    const subscribers = usernames.length > 0
      ? await db.subscriber.findMany({
          where:  { username: { in: usernames } },
          select: { username: true, name: true, quotaUsedMb: true, package: { select: { quotaLimitMb: true } } },
        })
      : [];
    const subMap = new Map(subscribers.map((s) => [s.username, s]));

    const active = rows.map((r) => {
      const loc = r.nasIp ? nasToLocation.get(r.nasIp) : undefined;
      const sub = subMap.get(r.username);
      const inputMb  = r.inputOctets  ? Number(r.inputOctets)  / 1048576 : 0;
      const outputMb = r.outputOctets ? Number(r.outputOctets) / 1048576 : 0;

      return {
        username:       r.username,
        name:           sub?.name ?? null,
        framedIp:       r.framedIp ?? null,
        callingMac:     r.callingMac ?? null,
        nasIp:          r.nasIp ?? null,
        location:       loc ? { id: loc.id, name: loc.name } : null,
        startTime:      r.startTime,
        sessionSecs:    r.sessionSecs ?? 0,
        inputMb:        Math.round(inputMb * 100) / 100,
        outputMb:       Math.round(outputMb * 100) / 100,
        quotaUsedMb:    sub?.quotaUsedMb.toString() ?? null,
        quotaLimitMb:   sub?.package.quotaLimitMb?.toString() ?? null,
      };
    });

    return NextResponse.json({ ok: true, active, total: active.length });
  } catch (err) {
    console.error("[users/active]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
