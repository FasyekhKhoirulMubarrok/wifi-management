import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/portal/packages?locationId=
 * Returns active packages for a location (for expired page).
 * No auth required.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationStr = searchParams.get("locationId");
  const locationId  = locationStr ? parseInt(locationStr) : null;

  try {
    const packages = await db.package.findMany({
      where: {
        isActive: true,
        OR: [
          { locationId: null },
          ...(locationId ? [{ locationId }] : []),
        ],
      },
      select: {
        id:            true,
        name:          true,
        price:         true,
        type:          true,
        quotaLimitMb:  true,
        timeLimitDays: true,
        speedDownKbps: true,
        speedUpKbps:   true,
      },
      orderBy: { price: "asc" },
    });

    return NextResponse.json({
      ok: true,
      packages: packages.map((p) => ({
        ...p,
        price:        p.price.toString(),
        quotaLimitMb: p.quotaLimitMb?.toString() ?? null,
      })),
    });
  } catch (err) {
    console.error("[portal/packages]", err);
    return NextResponse.json({ ok: false, packages: [] });
  }
}
