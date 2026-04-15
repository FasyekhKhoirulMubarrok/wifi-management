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
  username:     string;
  framedIp:     string | null;
  callingMac:   string | null;
  nasIp:        string | null;
  startTime:    Date | null;
  sessionSecs:  number | null;
  inputOctets:  bigint | null;
  outputOctets: bigint | null;
}

/**
 * GET /api/admin/monitoring/online-users
 * Returns all currently online users across accessible locations.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const locations = await db.location.findMany({
      where: admin.role === "super_admin"
        ? undefined
        : { id: { in: admin.locations.map((l) => l.locationId) } },
      select: { id: true, name: true, mikrotikIp: true },
    });

    const nasToLocation = new Map(locations.map((l) => [l.mikrotikIp, l]));
    const nasIps = locations.map((l) => l.mikrotikIp);

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

    let rows: RadacctRow[] = [];
    if (admin.role === "super_admin") {
      rows = await db.$queryRawUnsafe<RadacctRow[]>(
        `${selectCols} ORDER BY AcctStartTime DESC LIMIT 1000`,
      );
    } else if (nasIps.length > 0) {
      const inList = nasIps.map((ip) => `'${ip}'`).join(",");
      rows = await db.$queryRawUnsafe<RadacctRow[]>(
        `${selectCols} AND NASIPAddress IN (${inList}) ORDER BY AcctStartTime DESC LIMIT 1000`,
      );
    }

    const users = rows.map((r) => {
      const loc = r.nasIp ? nasToLocation.get(r.nasIp) : undefined;
      return {
        username:    r.username,
        framedIp:    r.framedIp ?? null,
        callingMac:  r.callingMac ?? null,
        nasIp:       r.nasIp ?? null,
        location:    loc ? { id: loc.id, name: loc.name } : null,
        startTime:   r.startTime,
        sessionSecs: r.sessionSecs ?? 0,
        inputMb:     r.inputOctets  ? Math.round(Number(r.inputOctets)  / 10485.76) / 100 : 0,
        outputMb:    r.outputOctets ? Math.round(Number(r.outputOctets) / 10485.76) / 100 : 0,
      };
    });

    return NextResponse.json({ ok: true, users, total: users.length });
  } catch (err) {
    console.error("[monitoring/online-users]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
