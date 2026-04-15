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
    if (session.userType === "admin") {
      const admin = await db.admin.findUnique({
        where:  { id: parseInt(session.userId) },
        select: { id: true, role: true },
      });
      if (admin?.role !== "super_admin") return null;
      return admin;
    }
    return null;
  } catch { return null; }
}

/**
 * GET /api/admin/comparison?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Super admin only. Returns side-by-side metrics for all locations.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from");
  const toStr   = searchParams.get("to");

  const now  = new Date();
  const from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to   = toStr   ? new Date(toStr + "T23:59:59.999Z") : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  try {
    const locations = await db.location.findMany({
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    });

    const [voucherRev, subRev, sessionLogs, vouchersUsed] = await Promise.all([
      // Revenue from vouchers per location
      db.voucher.findMany({
        where:  { usedAt: { gte: from, lte: to }, status: { not: "unused" } },
        select: { locationId: true, package: { select: { price: true } } },
      }),
      // Revenue from subscribers per location
      db.subscriber.findMany({
        where:  { activatedAt: { gte: from, lte: to } },
        select: { locationId: true, package: { select: { price: true } } },
      }),
      // Session logs for data + active users per location
      db.sessionLog.findMany({
        where:  { loginAt: { gte: from, lte: to } },
        select: { locationId: true, username: true, dataUsedMb: true },
      }),
      // Vouchers sold per location
      db.voucher.findMany({
        where:  { usedAt: { gte: from, lte: to } },
        select: { locationId: true },
      }),
    ]);

    // Aggregate per location
    type LocMetrics = {
      locationId:      number;
      locationName:    string;
      revenue:         number;
      uniqueUsers:     Set<string>;
      totalDataMb:     number;
      vouchersSold:    number;
    };

    const metricsMap = new Map<number, LocMetrics>(
      locations.map((l) => [l.id, {
        locationId:   l.id,
        locationName: l.name,
        revenue:      0,
        uniqueUsers:  new Set(),
        totalDataMb:  0,
        vouchersSold: 0,
      }]),
    );

    for (const v of voucherRev) {
      const m = metricsMap.get(v.locationId ?? -1);
      if (m) m.revenue += Number(v.package.price);
    }
    for (const s of subRev) {
      const m = metricsMap.get(s.locationId);
      if (m) m.revenue += Number(s.package.price);
    }
    for (const log of sessionLogs) {
      const m = metricsMap.get(log.locationId);
      if (m) {
        m.uniqueUsers.add(log.username);
        m.totalDataMb += Number(log.dataUsedMb);
      }
    }
    for (const v of vouchersUsed) {
      const m = metricsMap.get(v.locationId ?? -1);
      if (m) m.vouchersSold++;
    }

    const comparison = [...metricsMap.values()].map((m) => ({
      locationId:   m.locationId,
      locationName: m.locationName,
      revenue:      Math.round(m.revenue),
      activeUsers:  m.uniqueUsers.size,
      totalDataMb:  Math.round(m.totalDataMb * 100) / 100,
      vouchersSold: m.vouchersSold,
    }));

    // Find best/worst performers
    const best  = comparison.reduce((a, b) => b.revenue > a.revenue ? b : a, comparison[0]);
    const worst = comparison.reduce((a, b) => b.revenue < a.revenue ? b : a, comparison[0]);

    return NextResponse.json({ ok: true, comparison, best: best?.locationId, worst: worst?.locationId });
  } catch (err) {
    console.error("[comparison]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
