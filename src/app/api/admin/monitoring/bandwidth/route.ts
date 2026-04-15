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

interface BandwidthRow {
  nasIp:       string;
  activeSess:  bigint;
  totalInput:  bigint | null;
  totalOutput: bigint | null;
}

/**
 * GET /api/admin/monitoring/bandwidth
 * Returns aggregated bandwidth usage per location (active sessions only).
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
      orderBy: { name: "asc" },
    });

    let bwRows: BandwidthRow[] = [];
    if (locations.length > 0) {
      bwRows = await db.$queryRaw<BandwidthRow[]>`
        SELECT
          NASIPAddress           AS nasIp,
          COUNT(*)               AS activeSess,
          SUM(AcctInputOctets)   AS totalInput,
          SUM(AcctOutputOctets)  AS totalOutput
        FROM radacct
        WHERE AcctStopTime IS NULL
        GROUP BY NASIPAddress
      `;
    }

    const bwMap = new Map(bwRows.map((r) => [r.nasIp, r]));

    const bandwidth = locations.map((loc) => {
      const bw = bwMap.get(loc.mikrotikIp);
      return {
        locationId:    loc.id,
        locationName:  loc.name,
        mikrotikIp:    loc.mikrotikIp,
        activeSessions: bw ? Number(bw.activeSess) : 0,
        totalInputMb:  bw?.totalInput  ? Math.round(Number(bw.totalInput)  / 10485.76) / 100 : 0,
        totalOutputMb: bw?.totalOutput ? Math.round(Number(bw.totalOutput) / 10485.76) / 100 : 0,
      };
    });

    return NextResponse.json({ ok: true, bandwidth });
  } catch (err) {
    console.error("[monitoring/bandwidth]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
