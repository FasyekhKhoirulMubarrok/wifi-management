import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken, hashPassword } from "@/lib/auth";
import { addRadiusUser, setSimultaneousUse } from "@/lib/radius";

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

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status      = searchParams.get("status");
  const packageId   = searchParams.get("packageId");
  const locationId  = searchParams.get("locationId");
  const search      = searchParams.get("search");
  const page        = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit       = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));

  try {
    const locationIds =
      admin.role === "super_admin"
        ? null
        : admin.locations.map((l) => l.locationId);

    const where: Record<string, unknown> = {};
    if (locationIds !== null) where.locationId = { in: locationIds };
    if (locationId)  where.locationId  = parseInt(locationId);
    if (status)      where.status      = status;
    if (packageId)   where.packageId   = parseInt(packageId);
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { name:     { contains: search } },
      ];
    }

    const [subscribers, total] = await Promise.all([
      db.subscriber.findMany({
        where,
        include: {
          package:  { select: { id: true, name: true, quotaLimitMb: true, timeLimitDays: true } },
          location: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip:  (page - 1) * limit,
        take:  limit,
      }),
      db.subscriber.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      subscribers: subscribers.map((s) => ({
        id:          s.id,
        username:    s.username,
        name:        s.name,
        status:      s.status,
        quotaUsedMb: s.quotaUsedMb.toString(),
        activatedAt: s.activatedAt,
        expiredAt:   s.expiredAt,
        createdAt:   s.createdAt,
        package: {
          id:            s.package.id,
          name:          s.package.name,
          quotaLimitMb:  s.package.quotaLimitMb?.toString() ?? null,
          timeLimitDays: s.package.timeLimitDays,
        },
        location: s.location,
      })),
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[users GET]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

// ─── POST /api/admin/users ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const body = await request.json() as {
      username?:   string;
      password?:   string;
      name?:       string;
      packageId?:  number;
      locationId?: number;
    };

    if (!body.username?.trim())  return NextResponse.json({ error: "Username wajib diisi" }, { status: 400 });
    if (!body.password?.trim())  return NextResponse.json({ error: "Password wajib diisi" }, { status: 400 });
    if (!body.packageId)         return NextResponse.json({ error: "Paket wajib dipilih" }, { status: 400 });
    if (!body.locationId)        return NextResponse.json({ error: "Lokasi wajib dipilih" }, { status: 400 });
    if (body.password.length < 6) return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });

    // Access check
    if (admin.role !== "super_admin") {
      const hasAccess = admin.locations.some((l) => l.locationId === body.locationId);
      if (!hasAccess) return NextResponse.json({ error: "Akses ditolak ke lokasi ini" }, { status: 403 });
    }

    // Username uniqueness
    const existing = await db.subscriber.findUnique({ where: { username: body.username.trim() } });
    if (existing) return NextResponse.json({ error: "Username sudah digunakan" }, { status: 409 });

    // Get package
    const pkg = await db.package.findUnique({
      where:  { id: body.packageId },
      select: { timeLimitDays: true, speedDownKbps: true, speedUpKbps: true },
    });
    if (!pkg) return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });

    const now       = new Date();
    const expiredAt = pkg.timeLimitDays
      ? new Date(now.getTime() + pkg.timeLimitDays * 86400_000)
      : null;

    const hashed = await hashPassword(body.password);

    const subscriber = await db.subscriber.create({
      data: {
        username:   body.username.trim(),
        password:   hashed,
        name:       body.name?.trim() ?? null,
        packageId:  body.packageId,
        locationId: body.locationId,
        activatedAt: now,
        expiredAt,
        createdBy:  admin.id,
      },
    });

    // Sync to FreeRADIUS (store plaintext password in radcheck for CHAP/MSCHAP)
    await addRadiusUser(body.username.trim(), body.password, pkg.speedDownKbps, pkg.speedUpKbps);
    await setSimultaneousUse(body.username.trim(), 1);

    return NextResponse.json({
      ok: true,
      subscriber: { id: subscriber.id, username: subscriber.username },
    }, { status: 201 });
  } catch (err) {
    console.error("[users POST]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
