import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken, getAccessibleLocationIds } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  let adminId: number;
  try {
    const { session } = await validateSession(token);
    if (session.userType !== "admin") {
      return NextResponse.json({ error: "Bukan session admin" }, { status: 403 });
    }
    adminId = parseInt(session.userId);
  } catch {
    return NextResponse.json({ error: "Session tidak valid" }, { status: 401 });
  }

  try {
    const locationIds = await getAccessibleLocationIds(adminId);
    const locationFilter =
      locationIds !== null ? { locationId: { in: locationIds } } : {};

    const now        = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      activeVouchers,
      activeSubscribers,
      totalLocations,
      todayVouchers,
      todaySubscribers,
    ] = await Promise.all([
      db.voucher.count({
        where: {
          ...locationFilter,
          status: "active",
          OR: [{ expiredAt: null }, { expiredAt: { gt: now } }],
        },
      }),
      db.subscriber.count({
        where: {
          ...locationFilter,
          status: "active",
          OR: [{ expiredAt: null }, { expiredAt: { gt: now } }],
        },
      }),
      locationIds !== null
        ? Promise.resolve(locationIds.length)
        : db.location.count({ where: { isActive: true } }),
      db.voucher.findMany({
        where: { ...locationFilter, status: { not: "unused" }, usedAt: { gte: todayStart } },
        include: { package: { select: { price: true } } },
      }),
      db.subscriber.findMany({
        where: { ...locationFilter, activatedAt: { gte: todayStart } },
        include: { package: { select: { price: true } } },
      }),
    ]);

    const revenueToday =
      todayVouchers.reduce((s, v) => s + Number(v.package.price), 0) +
      todaySubscribers.reduce((s, v) => s + Number(v.package.price), 0);

    return NextResponse.json({
      ok: true,
      stats: {
        activeUsers:    activeVouchers + activeSubscribers,
        activeVouchers,
        activeSubscribers,
        revenueToday,
        totalLocations,
      },
    });
  } catch (err) {
    console.error("[dashboard/stats]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
