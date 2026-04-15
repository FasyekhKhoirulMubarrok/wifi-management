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
    const now         = new Date();

    const locations = await db.location.findMany({
      where: locationIds !== null ? { id: { in: locationIds } } : { isActive: true },
      select: {
        id:   true,
        name: true,
        vouchers: {
          where: {
            status: "active",
            OR: [{ expiredAt: null }, { expiredAt: { gt: now } }],
          },
          select: { id: true },
        },
        subscribers: {
          where: {
            status: "active",
            OR: [{ expiredAt: null }, { expiredAt: { gt: now } }],
          },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const data = locations.map((loc) => ({
      locationId: loc.id,
      name:       loc.name,
      vouchers:   loc.vouchers.length,
      subscribers: loc.subscribers.length,
      total:      loc.vouchers.length + loc.subscribers.length,
    }));

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[dashboard/active-users]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
