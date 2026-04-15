import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/portal/ads?locationId=
 * Returns active advertisements for the given location.
 * No auth required — called from user portal.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locationStr = searchParams.get("locationId");
  const locationId  = locationStr ? parseInt(locationStr) : null;

  try {
    const now = new Date();
    const ads = await db.advertisement.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: null },
          { startDate: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { endDate: null },
              { endDate: { gte: now } },
            ],
          },
          {
            OR: [
              { locationId: null },
              ...(locationId ? [{ locationId }] : []),
            ],
          },
        ],
      },
      select: {
        id:          true,
        title:       true,
        description: true,
        imageUrl:    true,
        linkUrl:     true,
      },
      orderBy: { priority: "asc" },
      take:    5,
    });

    return NextResponse.json({ ok: true, ads });
  } catch (err) {
    console.error("[portal/ads]", err);
    return NextResponse.json({ ok: false, ads: [] });
  }
}
