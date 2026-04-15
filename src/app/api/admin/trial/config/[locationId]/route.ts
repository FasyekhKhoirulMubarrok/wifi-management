import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken, checkAdminAccess } from "@/lib/auth";

async function requireAdmin(request: NextRequest) {
  const token = extractToken(request);
  if (!token) return null;
  try {
    const { session } = await validateSession(token);
    if (session.userType !== "admin") return null;
    return await db.admin.findUnique({
      where:  { id: parseInt(session.userId) },
      select: { id: true, role: true },
    });
  } catch { return null; }
}

/**
 * PUT /api/admin/trial/config/[locationId]
 * Upsert trial config for a specific location.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { locationId: locIdStr } = await params;
  const locationId = parseInt(locIdStr);
  if (isNaN(locationId)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  const hasAccess = await checkAdminAccess(admin.id, locationId);
  if (!hasAccess) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const body = await request.json() as {
      durationMinutes?: number;
      speedKbps?:       number;
      isActive?:        boolean;
    };

    if (body.durationMinutes !== undefined && (body.durationMinutes < 1 || body.durationMinutes > 1440)) {
      return NextResponse.json({ error: "Durasi harus antara 1–1440 menit" }, { status: 400 });
    }
    if (body.speedKbps !== undefined && (body.speedKbps < 64 || body.speedKbps > 102400)) {
      return NextResponse.json({ error: "Kecepatan harus antara 64–102400 Kbps" }, { status: 400 });
    }

    const config = await db.trialConfig.upsert({
      where:  { locationId },
      create: {
        locationId,
        durationMinutes: body.durationMinutes ?? 5,
        speedKbps:       body.speedKbps       ?? 1024,
        isActive:        body.isActive        ?? true,
      },
      update: {
        ...(body.durationMinutes !== undefined && { durationMinutes: body.durationMinutes }),
        ...(body.speedKbps       !== undefined && { speedKbps:       body.speedKbps }),
        ...(body.isActive        !== undefined && { isActive:        body.isActive }),
      },
    });

    return NextResponse.json({ ok: true, config });
  } catch (err) {
    console.error("[trial/config PUT]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
