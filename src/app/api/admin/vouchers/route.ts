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

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status      = searchParams.get("status");
  const packageId   = searchParams.get("packageId");
  const locationId  = searchParams.get("locationId");
  const from        = searchParams.get("from");
  const to          = searchParams.get("to");
  const page        = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit       = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));

  try {
    const locationIds =
      admin.role === "super_admin"
        ? null
        : admin.locations.map((l) => l.locationId);

    const where: Record<string, unknown> = {};

    // Location access filter
    if (locationId) {
      const lid = parseInt(locationId);
      if (locationIds !== null && !locationIds.includes(lid)) {
        return NextResponse.json({ ok: true, vouchers: [], pagination: { total: 0, page, pages: 0 } });
      }
      where.locationId = lid;
    } else if (locationIds !== null) {
      where.locationId = { in: locationIds };
    }

    if (status)    where.status    = status;
    if (packageId) where.packageId = parseInt(packageId);
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      };
    }

    const [vouchers, total] = await Promise.all([
      db.voucher.findMany({
        where,
        include: {
          package:  { select: { id: true, name: true, price: true, type: true } },
          location: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip:  (page - 1) * limit,
        take:  limit,
      }),
      db.voucher.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      vouchers: vouchers.map((v) => ({
        id:          v.id,
        code:        v.code,
        status:      v.status,
        usedByMac:   v.usedByMac,
        usedAt:      v.usedAt,
        expiredAt:   v.expiredAt,
        quotaUsedMb: v.quotaUsedMb.toString(),
        createdAt:   v.createdAt,
        package: {
          id:    v.package.id,
          name:  v.package.name,
          price: v.package.price.toString(),
          type:  v.package.type,
        },
        location: v.location,
      })),
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[vouchers GET]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
