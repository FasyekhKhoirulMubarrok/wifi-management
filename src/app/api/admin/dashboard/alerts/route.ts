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

    const now     = new Date();
    const in24h   = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [
      expiringVouchers,
      expiringSubscribers,
      inactiveLocations,
    ] = await Promise.all([
      db.voucher.count({
        where: {
          ...locationFilter,
          status:    "active",
          expiredAt: { gte: now, lte: in24h },
        },
      }),
      db.subscriber.count({
        where: {
          ...locationFilter,
          status:    "active",
          expiredAt: { gte: now, lte: in24h },
        },
      }),
      db.location.findMany({
        where: {
          ...(locationIds !== null ? { id: { in: locationIds } } : {}),
          isActive: false,
        },
        select: { id: true, name: true },
      }),
    ]);

    type AlertSeverity = "warning" | "danger";
    const alerts: { type: AlertSeverity; message: string; count?: number }[] = [];

    if (expiringVouchers > 0) {
      alerts.push({
        type:    "warning",
        message: `${expiringVouchers} voucher akan expired dalam 24 jam`,
        count:   expiringVouchers,
      });
    }
    if (expiringSubscribers > 0) {
      alerts.push({
        type:    "warning",
        message: `${expiringSubscribers} subscriber akan expired dalam 24 jam`,
        count:   expiringSubscribers,
      });
    }
    for (const loc of inactiveLocations) {
      alerts.push({
        type:    "danger",
        message: `Lokasi "${loc.name}" tidak aktif`,
      });
    }

    return NextResponse.json({ ok: true, alerts, total: alerts.length });
  } catch (err) {
    console.error("[dashboard/alerts]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
