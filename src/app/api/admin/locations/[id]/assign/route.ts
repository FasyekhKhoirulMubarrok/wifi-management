import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken } from "@/lib/auth";

async function requireSuperAdmin(request: NextRequest) {
  const token = extractToken(request);
  if (!token) return null;
  try {
    const { session } = await validateSession(token);
    if (session.userType !== "admin") return null;
    const admin = await db.admin.findUnique({
      where:  { id: parseInt(session.userId) },
      select: { id: true, role: true },
    });
    if (!admin || admin.role !== "super_admin") return null;
    return admin;
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/locations/[id]/assign
 * Body: { adminIds: number[] }  — replaces the full set of assigned admins
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const locationId = parseInt(id);
  if (isNaN(locationId)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  try {
    const body = await request.json() as { adminIds?: number[] };
    const adminIds = body.adminIds ?? [];

    if (!Array.isArray(adminIds)) {
      return NextResponse.json({ error: "adminIds harus berupa array" }, { status: 400 });
    }

    const location = await db.location.findUnique({ where: { id: locationId }, select: { name: true } });
    if (!location) return NextResponse.json({ error: "Lokasi tidak ditemukan" }, { status: 404 });

    // Replace all assignments for this location in a transaction
    await db.$transaction([
      db.adminLocation.deleteMany({ where: { locationId } }),
      ...(adminIds.length > 0
        ? [
            db.adminLocation.createMany({
              data: adminIds.map((adminId) => ({ adminId, locationId })),
            }),
          ]
        : []),
    ]);

    await db.adminLog.create({
      data: {
        adminId:     admin.id,
        action:      "ASSIGN_ADMIN_LOCATION",
        description: `Set assignment lokasi "${location.name}": adminIds=[${adminIds.join(",")}]`,
        ipAddress:   request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[locations/assign POST]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
