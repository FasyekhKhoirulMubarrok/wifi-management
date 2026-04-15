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
 * GET /api/admin/trial/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns trial-to-paid conversion statistics per location and monthly trend.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const accessibleIds = admin.role === "super_admin"
    ? null
    : admin.locations.map((l) => l.locationId);

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from");
  const toStr   = searchParams.get("to");

  const now  = new Date();
  const from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const to   = toStr   ? new Date(toStr + "T23:59:59.999Z") : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const locationWhere =
    accessibleIds !== null ? { locationId: { in: accessibleIds } } : {};

  try {
    const locations = await db.location.findMany({
      where:   accessibleIds !== null ? { id: { in: accessibleIds } } : undefined,
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    });

    // All trial MACs in period
    const trialSessions = await db.trialSession.findMany({
      where:  { usedAt: { gte: from, lte: to }, ...locationWhere },
      select: { macAddress: true, locationId: true, usedAt: true },
    });

    // All vouchers used by MAC in period (conversion)
    const usedVouchers = await db.voucher.findMany({
      where:  {
        usedAt:     { gte: from, lte: to },
        usedByMac:  { not: null },
        status:     { not: "unused" },
        ...locationWhere,
      },
      select: { usedByMac: true, locationId: true, usedAt: true },
    });

    const paidMacs = new Set(usedVouchers.map((v) => `${v.usedByMac}|${v.locationId}`));

    // Per-location stats
    const perLocation = locations.map((loc) => {
      const locTrials    = trialSessions.filter((t) => t.locationId === loc.id);
      const uniqueTrials = new Set(locTrials.map((t) => t.macAddress)).size;
      const converted    = locTrials.filter((t) => paidMacs.has(`${t.macAddress}|${loc.id}`));
      const uniqueConv   = new Set(converted.map((t) => t.macAddress)).size;
      return {
        locationId:       loc.id,
        locationName:     loc.name,
        totalTrials:      locTrials.length,
        uniqueDevices:    uniqueTrials,
        convertedDevices: uniqueConv,
        conversionRate:   uniqueTrials > 0 ? Math.round((uniqueConv / uniqueTrials) * 1000) / 10 : 0,
      };
    });

    // Monthly trend: last 6 months
    const monthlyMap = new Map<string, { trials: Set<string>; converted: Set<string> }>();
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap.set(key, { trials: new Set(), converted: new Set() });
    }

    for (const t of trialSessions) {
      const key = `${t.usedAt.getFullYear()}-${String(t.usedAt.getMonth() + 1).padStart(2, "0")}`;
      const m   = monthlyMap.get(key);
      if (!m) continue;
      m.trials.add(t.macAddress);
      if (paidMacs.has(`${t.macAddress}|${t.locationId}`)) m.converted.add(t.macAddress);
    }

    const monthlyTrend = [...monthlyMap.entries()].map(([month, m]) => ({
      month,
      trials:         m.trials.size,
      converted:      m.converted.size,
      conversionRate: m.trials.size > 0 ? Math.round((m.converted.size / m.trials.size) * 1000) / 10 : 0,
    }));

    const totalTrials     = perLocation.reduce((s, l) => s + l.totalTrials, 0);
    const totalConverted  = perLocation.reduce((s, l) => s + l.convertedDevices, 0);
    const totalDevices    = perLocation.reduce((s, l) => s + l.uniqueDevices, 0);
    const overallRate     = totalDevices > 0 ? Math.round((totalConverted / totalDevices) * 1000) / 10 : 0;

    return NextResponse.json({
      ok: true,
      summary: { totalTrials, totalConverted, totalDevices, overallRate },
      perLocation,
      monthlyTrend,
    });
  } catch (err) {
    console.error("[trial/stats GET]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
