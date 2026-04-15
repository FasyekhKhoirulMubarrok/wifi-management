import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken } from "@/lib/auth";

// ─── auth helper ─────────────────────────────────────────────────────────────

async function requireSuperAdmin(request: NextRequest) {
  const token = extractToken(request);
  if (!token) return null;
  try {
    const { session } = await validateSession(token);
    if (session.userType !== "admin") return null;
    const admin = await db.admin.findUnique({
      where:  { id: parseInt(session.userId) },
      select: { id: true, role: true, name: true },
    });
    if (!admin || admin.role !== "super_admin") return null;
    return admin;
  } catch {
    return null;
  }
}

// ─── GET /api/admin/locations ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const now = new Date();
    const locations = await db.location.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id:          true,
        name:        true,
        address:     true,
        mikrotikIp:  true,
        mikrotikUser: true,
        isActive:    true,
        createdAt:   true,
        admins: {
          select: {
            admin: { select: { id: true, name: true, email: true } },
          },
        },
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
    });

    return NextResponse.json({
      ok: true,
      locations: locations.map((l) => ({
        id:          l.id,
        name:        l.name,
        address:     l.address,
        mikrotikIp:  l.mikrotikIp,
        mikrotikUser: l.mikrotikUser,
        isActive:    l.isActive,
        createdAt:   l.createdAt,
        activeUsers: l.vouchers.length + l.subscribers.length,
        admins:      l.admins.map((a) => a.admin),
      })),
    });
  } catch (err) {
    console.error("[locations GET]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

// ─── POST /api/admin/locations ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const body = await request.json() as {
      name?: string;
      address?: string;
      mikrotikIp?: string;
      mikrotikUser?: string;
      mikrotikPass?: string;
    };

    if (!body.name?.trim())        return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
    if (!body.mikrotikIp?.trim())  return NextResponse.json({ error: "IP MikroTik wajib diisi" }, { status: 400 });
    if (!body.mikrotikUser?.trim()) return NextResponse.json({ error: "Username MikroTik wajib diisi" }, { status: 400 });
    if (!body.mikrotikPass?.trim()) return NextResponse.json({ error: "Password MikroTik wajib diisi" }, { status: 400 });

    const location = await db.location.create({
      data: {
        name:        body.name.trim(),
        address:     body.address?.trim() ?? null,
        mikrotikIp:  body.mikrotikIp.trim(),
        mikrotikUser: body.mikrotikUser.trim(),
        mikrotikPass: body.mikrotikPass.trim(),
      },
    });

    await db.adminLog.create({
      data: {
        adminId:     admin.id,
        action:      "CREATE_LOCATION",
        description: `Tambah lokasi "${location.name}" (ID ${location.id})`,
        ipAddress:   request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      },
    });

    return NextResponse.json({ ok: true, location }, { status: 201 });
  } catch (err) {
    console.error("[locations POST]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
