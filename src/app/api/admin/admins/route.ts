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

// ─── GET /api/admin/admins ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const roleFilter = searchParams.get("role");

  try {
    const admins = await db.admin.findMany({
      where: roleFilter ? { role: roleFilter as "super_admin" | "admin_lokasi" } : undefined,
      select: {
        id:        true,
        name:      true,
        email:     true,
        role:      true,
        createdAt: true,
        locations: {
          include: { location: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      ok: true,
      admins: admins.map((a) => ({
        id:        a.id,
        name:      a.name,
        email:     a.email,
        role:      a.role,
        createdAt: a.createdAt,
        locations: a.locations.map((l) => l.location),
      })),
    });
  } catch (err) {
    console.error("[admins GET]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

// ─── POST /api/admin/admins ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const body = await request.json() as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      locationIds?: number[];
    };

    if (!body.name?.trim())     return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
    if (!body.email?.trim())    return NextResponse.json({ error: "Email wajib diisi" }, { status: 400 });
    if (!body.password?.trim()) return NextResponse.json({ error: "Password wajib diisi" }, { status: 400 });
    if (!["super_admin", "admin_lokasi"].includes(body.role ?? "")) {
      return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
    }
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 });
    }

    const existing = await db.admin.findUnique({ where: { email: body.email.trim().toLowerCase() } });
    if (existing) return NextResponse.json({ error: "Email sudah digunakan" }, { status: 409 });

    const hashed = await hashPassword(body.password);

    const newAdmin = await db.$transaction(async (tx) => {
      const created = await tx.admin.create({
        data: {
          name:     body.name!.trim(),
          email:    body.email!.trim().toLowerCase(),
          password: hashed,
          role:     body.role as "super_admin" | "admin_lokasi",
        },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });

      if (body.role === "admin_lokasi" && body.locationIds?.length) {
        await tx.adminLocation.createMany({
          data: body.locationIds.map((locationId) => ({
            adminId: created.id,
            locationId,
          })),
        });
      }

      return created;
    });

    await db.adminLog.create({
      data: {
        adminId:     admin.id,
        action:      "CREATE_ADMIN",
        description: `Tambah admin "${newAdmin.name}" (${newAdmin.email}) role ${newAdmin.role}`,
        ipAddress:   request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      },
    });

    return NextResponse.json({ ok: true, admin: newAdmin }, { status: 201 });
  } catch (err) {
    console.error("[admins POST]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
