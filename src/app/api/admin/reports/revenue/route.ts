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
 * GET /api/admin/reports/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD&locationId=
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const fromStr     = searchParams.get("from");
  const toStr       = searchParams.get("to");
  const locationStr = searchParams.get("locationId");

  const now    = new Date();
  const from   = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to     = toStr   ? new Date(toStr + "T23:59:59.999Z") : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const accessibleIds = admin.role === "super_admin"
    ? null
    : admin.locations.map((l) => l.locationId);

  const locationId = locationStr ? parseInt(locationStr) : null;

  // Build location filter
  function locFilter(field: string) {
    if (locationId) return { [field]: locationId };
    if (accessibleIds !== null) return { [field]: { in: accessibleIds } };
    return {};
  }

  try {
    // Revenue from vouchers (usedAt in range)
    const voucherRev = await db.voucher.findMany({
      where: {
        usedAt:    { gte: from, lte: to },
        status:    { not: "unused" },
        ...locFilter("locationId"),
      },
      include: { package: { select: { id: true, name: true, price: true } } },
      orderBy: { usedAt: "asc" },
    });

    // Revenue from subscribers (activatedAt in range)
    const subRev = await db.subscriber.findMany({
      where: {
        activatedAt: { gte: from, lte: to },
        ...locFilter("locationId"),
      },
      include: { package: { select: { id: true, name: true, price: true } } },
      orderBy: { activatedAt: "asc" },
    });

    // Build daily chart data
    const dailyMap = new Map<string, number>();
    for (const v of voucherRev) {
      if (!v.usedAt) continue;
      const day = v.usedAt.toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + Number(v.package.price));
    }
    for (const s of subRev) {
      const day = s.activatedAt.toISOString().slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + Number(s.package.price));
    }

    const dailyChart = [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue }));

    // Per-package breakdown
    const pkgMap = new Map<number, { id: number; name: string; count: number; revenue: number }>();
    for (const v of voucherRev) {
      const p = v.package;
      const existing = pkgMap.get(p.id) ?? { id: p.id, name: p.name, count: 0, revenue: 0 };
      existing.count++;
      existing.revenue += Number(p.price);
      pkgMap.set(p.id, existing);
    }
    for (const s of subRev) {
      const p = s.package;
      const existing = pkgMap.get(p.id) ?? { id: p.id, name: p.name, count: 0, revenue: 0 };
      existing.count++;
      existing.revenue += Number(p.price);
      pkgMap.set(p.id, existing);
    }
    const perPackage = [...pkgMap.values()].sort((a, b) => b.revenue - a.revenue);

    // Transaction list (most recent first, max 200)
    const transactions = [
      ...voucherRev.map((v) => ({
        id:        `v${v.id}`,
        type:      "voucher" as const,
        reference: v.code,
        package:   v.package.name,
        amount:    Number(v.package.price),
        date:      v.usedAt!,
      })),
      ...subRev.map((s) => ({
        id:        `s${s.id}`,
        type:      "langganan" as const,
        reference: s.username,
        package:   s.package.name,
        amount:    Number(s.package.price),
        date:      s.activatedAt,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 200);

    const totalRevenue = voucherRev.reduce((s, v) => s + Number(v.package.price), 0)
      + subRev.reduce((s, sub) => s + Number(sub.package.price), 0);

    return NextResponse.json({
      ok: true,
      totalRevenue,
      dailyChart,
      perPackage,
      transactions,
    });
  } catch (err) {
    console.error("[reports/revenue]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
