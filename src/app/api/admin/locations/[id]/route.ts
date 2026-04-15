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

// ─── GET /api/admin/locations/[id] ───────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const locationId = parseInt(id);
  if (isNaN(locationId)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  try {
    const location = await db.location.findUnique({
      where: { id: locationId },
      include: {
        admins: {
          include: { admin: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!location) return NextResponse.json({ error: "Lokasi tidak ditemukan" }, { status: 404 });

    return NextResponse.json({
      ok: true,
      location: {
        ...location,
        admins: location.admins.map((a) => a.admin),
      },
    });
  } catch (err) {
    console.error("[locations/[id] GET]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

// ─── PUT /api/admin/locations/[id] ───────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const locationId = parseInt(id);
  if (isNaN(locationId)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  try {
    const body = await request.json() as {
      name?: string;
      address?: string;
      mikrotikIp?: string;
      mikrotikUser?: string;
      mikrotikPass?: string;
      isActive?: boolean;
    };

    if (!body.name?.trim())        return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
    if (!body.mikrotikIp?.trim())  return NextResponse.json({ error: "IP MikroTik wajib diisi" }, { status: 400 });
    if (!body.mikrotikUser?.trim()) return NextResponse.json({ error: "Username MikroTik wajib diisi" }, { status: 400 });

    const updateData: Record<string, unknown> = {
      name:        body.name.trim(),
      address:     body.address?.trim() ?? null,
      mikrotikIp:  body.mikrotikIp.trim(),
      mikrotikUser: body.mikrotikUser.trim(),
      isActive:    body.isActive ?? true,
    };
    if (body.mikrotikPass?.trim()) {
      updateData.mikrotikPass = body.mikrotikPass.trim();
    }

    const location = await db.location.update({
      where: { id: locationId },
      data:  updateData,
    });

    await db.adminLog.create({
      data: {
        adminId:     admin.id,
        action:      "UPDATE_LOCATION",
        description: `Update lokasi "${location.name}" (ID ${locationId})`,
        ipAddress:   request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      },
    });

    return NextResponse.json({ ok: true, location });
  } catch (err) {
    console.error("[locations/[id] PUT]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

// ─── DELETE /api/admin/locations/[id] ────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const locationId = parseInt(id);
  if (isNaN(locationId)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  try {
    const location = await db.location.findUnique({
      where: { id: locationId },
      select: { name: true, _count: { select: { vouchers: true, subscribers: true } } },
    });
    if (!location) return NextResponse.json({ error: "Lokasi tidak ditemukan" }, { status: 404 });

    if (location._count.vouchers > 0 || location._count.subscribers > 0) {
      return NextResponse.json(
        { error: "Tidak bisa hapus lokasi yang masih memiliki voucher atau subscriber" },
        { status: 409 },
      );
    }

    await db.location.delete({ where: { id: locationId } });

    await db.adminLog.create({
      data: {
        adminId:     admin.id,
        action:      "DELETE_LOCATION",
        description: `Hapus lokasi "${location.name}" (ID ${locationId})`,
        ipAddress:   request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[locations/[id] DELETE]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
