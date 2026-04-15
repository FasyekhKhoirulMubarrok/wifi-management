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

    const now      = new Date();
    const ago30    = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [voucherData, subscriberData] = await Promise.all([
      db.voucher.findMany({
        where: { ...locationFilter, status: { not: "unused" }, usedAt: { gte: ago30 } },
        select: { usedAt: true, package: { select: { price: true } } },
        orderBy: { usedAt: "asc" },
      }),
      db.subscriber.findMany({
        where: { ...locationFilter, activatedAt: { gte: ago30 } },
        select: { activatedAt: true, package: { select: { price: true } } },
        orderBy: { activatedAt: "asc" },
      }),
    ]);

    // Build ordered 30-day map
    const revenueByDay = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d   = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      revenueByDay.set(key, 0);
    }

    for (const v of voucherData) {
      if (!v.usedAt) continue;
      const key = v.usedAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      if (revenueByDay.has(key)) {
        revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(v.package.price));
      }
    }
    for (const s of subscriberData) {
      const key = s.activatedAt.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      if (revenueByDay.has(key)) {
        revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + Number(s.package.price));
      }
    }

    const chart = Array.from(revenueByDay.entries()).map(([date, revenue]) => ({
      date,
      revenue,
    }));

    return NextResponse.json({ ok: true, chart });
  } catch (err) {
    console.error("[dashboard/revenue-chart]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
