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
 * GET /api/admin/reports/vouchers?from=YYYY-MM-DD&to=YYYY-MM-DD&locationId=
 * Returns voucher statistics by package.
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
    // Vouchers created in range
    const created = await db.voucher.findMany({
      where:   { createdAt: { gte: from, lte: to }, ...locationWhere },
      include: { package: { select: { id: true, name: true, price: true } } },
    });

    // Vouchers used in range
    const used = await db.voucher.findMany({
      where:   { usedAt: { gte: from, lte: to }, ...locationWhere },
      include: { package: { select: { id: true, name: true, price: true } } },
    });

    // Vouchers that expired in range
    const expired = await db.voucher.findMany({
      where:   { expiredAt: { gte: from, lte: to }, status: "expired", ...locationWhere },
      include: { package: { select: { id: true, name: true } } },
    });

    // Per-package breakdown
    const pkgMap = new Map<number, {
      id: number; name: string;
      created: number; used: number; expired: number; revenue: number;
    }>();

    for (const v of created) {
      const p = v.package;
      const e = pkgMap.get(p.id) ?? { id: p.id, name: p.name, created: 0, used: 0, expired: 0, revenue: 0 };
      e.created++;
      pkgMap.set(p.id, e);
    }
    for (const v of used) {
      const p = v.package;
      const e = pkgMap.get(p.id) ?? { id: p.id, name: p.name, created: 0, used: 0, expired: 0, revenue: 0 };
      e.used++;
      e.revenue += Number(p.price);
      pkgMap.set(p.id, e);
    }
    for (const v of expired) {
      const p = v.package;
      const e = pkgMap.get(p.id) ?? { id: p.id, name: p.name, created: 0, used: 0, expired: 0, revenue: 0 };
      e.expired++;
      pkgMap.set(p.id, e);
    }

    const perPackage = [...pkgMap.values()].sort((a, b) => b.used - a.used);

    return NextResponse.json({
      ok: true,
      summary: {
        totalCreated: created.length,
        totalUsed:    used.length,
        totalExpired: expired.length,
        unused:       created.length - used.length - expired.length,
      },
      perPackage,
    });
  } catch (err) {
    console.error("[reports/vouchers]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
