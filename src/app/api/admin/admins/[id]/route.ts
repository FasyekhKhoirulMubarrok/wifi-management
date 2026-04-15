import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken, hashPassword } from "@/lib/auth";

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

// ─── PUT /api/admin/admins/[id] ───────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const targetId = parseInt(id);
  if (isNaN(targetId)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  try {
    const body = await request.json() as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      locationIds?: number[];
    };

    if (!body.name?.trim())  return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
    if (!body.email?.trim()) return NextResponse.json({ error: "Email wajib diisi" }, { status: 400 });
    if (!["super_admin", "admin_lokasi"].includes(body.role ?? "")) {
      return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
    }
    if (body.password && body.password.length < 8) {
      return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 });
    }

    // Check email uniqueness (exclude self)
    const emailConflict = await db.admin.findFirst({
      where: { email: body.email.trim().toLowerCase(), NOT: { id: targetId } },
    });
    if (emailConflict) return NextResponse.json({ error: "Email sudah digunakan" }, { status: 409 });

    const updateData: Record<string, unknown> = {
      name:  body.name.trim(),
      email: body.email.trim().toLowerCase(),
      role:  body.role,
    };
    if (body.password?.trim()) {
      updateData.password = await hashPassword(body.password);
    }

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.admin.update({
        where: { id: targetId },
        data:  updateData,
        select: { id: true, name: true, email: true, role: true },
      });

      // Sync location assignments
      await tx.adminLocation.deleteMany({ where: { adminId: targetId } });
      if (body.role === "admin_lokasi" && body.locationIds?.length) {
        await tx.adminLocation.createMany({
          data: body.locationIds.map((locationId) => ({ adminId: targetId, locationId })),
        });
      }

      return result;
    });

    await db.adminLog.create({
      data: {
        adminId:     admin.id,
        action:      "UPDATE_ADMIN",
        description: `Update admin "${updated.name}" (ID ${targetId})`,
        ipAddress:   request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      },
    });

    return NextResponse.json({ ok: true, admin: updated });
  } catch (err) {
    console.error("[admins/[id] PUT]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

// ─── DELETE /api/admin/admins/[id] ────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const targetId = parseInt(id);
  if (isNaN(targetId)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  // Prevent self-deletion
  if (targetId === admin.id) {
    return NextResponse.json({ error: "Tidak bisa hapus akun sendiri" }, { status: 400 });
  }

  try {
    const target = await db.admin.findUnique({
      where:  { id: targetId },
      select: { name: true, email: true },
    });
    if (!target) return NextResponse.json({ error: "Admin tidak ditemukan" }, { status: 404 });

    await db.admin.delete({ where: { id: targetId } });

    await db.adminLog.create({
      data: {
        adminId:     admin.id,
        action:      "DELETE_ADMIN",
        description: `Hapus admin "${target.name}" (${target.email}, ID ${targetId})`,
        ipAddress:   request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admins/[id] DELETE]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
