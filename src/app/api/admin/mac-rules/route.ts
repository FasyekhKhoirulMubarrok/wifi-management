import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken } from "@/lib/auth";

const MAC_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

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
 * GET /api/admin/mac-rules?type=whitelist|blacklist&locationId=
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const accessibleIds = admin.role === "super_admin"
    ? null
    : admin.locations.map((l) => l.locationId);

  const { searchParams } = new URL(request.url);
  const typeFilter  = searchParams.get("type");
  const locationStr = searchParams.get("locationId");
  const locationId  = locationStr ? parseInt(locationStr) : null;

  const where: Record<string, unknown> = {};
  if (typeFilter === "whitelist" || typeFilter === "blacklist") where.type = typeFilter;
  if (locationId) {
    where.locationId = locationId;
  } else if (accessibleIds !== null) {
    where.OR = [
      { locationId: { in: accessibleIds } },
      { locationId: null },
    ];
  }

  try {
    const rules = await db.macRule.findMany({
      where,
      select: {
        id:         true,
        macAddress: true,
        type:       true,
        locationId: true,
        note:       true,
        createdAt:  true,
        location:   { select: { id: true, name: true } },
        creator:    { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, rules });
  } catch (err) {
    console.error("[mac-rules GET]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

/**
 * POST /api/admin/mac-rules
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const body = await request.json() as {
      macAddress?: string;
      type?:       string;
      locationId?: number | null;
      note?:       string;
    };

    if (!body.macAddress?.trim()) return NextResponse.json({ error: "MAC address wajib diisi" }, { status: 400 });
    if (!MAC_REGEX.test(body.macAddress.trim().toUpperCase())) {
      return NextResponse.json({ error: "Format MAC address tidak valid (XX:XX:XX:XX:XX:XX)" }, { status: 400 });
    }
    if (!["whitelist", "blacklist"].includes(body.type ?? "")) {
      return NextResponse.json({ error: "Tipe harus whitelist atau blacklist" }, { status: 400 });
    }

    const mac        = body.macAddress.trim().toUpperCase();
    const locationId = body.locationId ?? null;

    // Check access
    if (locationId !== null && admin.role !== "super_admin") {
      const accessible = admin.locations.map((l) => l.locationId);
      if (!accessible.includes(locationId)) {
        return NextResponse.json({ error: "Akses ditolak untuk lokasi ini" }, { status: 403 });
      }
    }

    const rule = await db.macRule.create({
      data: {
        macAddress: mac,
        type:       body.type as "whitelist" | "blacklist",
        locationId,
        note:       body.note?.trim() || null,
        createdBy:  admin.id,
      },
      select: {
        id: true, macAddress: true, type: true, locationId: true, note: true, createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, rule }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "MAC address sudah ada untuk lokasi dan tipe ini" }, { status: 409 });
    }
    console.error("[mac-rules POST]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
