import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken } from "@/lib/auth";
import { parseTimeString } from "@/lib/voucher";

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

function canWrite(
  admin: { role: string; locations: { locationId: number }[] },
  locationId: number | null,
) {
  if (admin.role === "super_admin") return true;
  if (locationId === null) return false;
  return admin.locations.some((l) => l.locationId === locationId);
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── PUT /api/admin/packages/[id] ─────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const pkgId = parseInt(id);
  if (isNaN(pkgId)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  try {
    const existing = await db.package.findUnique({ where: { id: pkgId }, select: { locationId: true } });
    if (!existing) return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });
    if (!canWrite(admin, existing.locationId)) {
      return NextResponse.json({ error: "Akses ditolak ke lokasi paket ini" }, { status: 403 });
    }

    const body = await request.json() as {
      name?: string; price?: string | number; type?: string;
      quotaLimitMb?: string | number | null; timeLimitDays?: number | null;
      speedDownKbps?: number; speedUpKbps?: number; throttleKbps?: number;
      locationId?: number | null; isActive?: boolean;
      scheduleStart?: string | null; scheduleEnd?: string | null;
    };

    if (!body.name?.trim())                    return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
    if (!body.price || isNaN(Number(body.price))) return NextResponse.json({ error: "Harga tidak valid" }, { status: 400 });
    if (!["voucher", "langganan"].includes(body.type ?? "")) return NextResponse.json({ error: "Tipe tidak valid" }, { status: 400 });

    const newLocationId = body.locationId ?? null;
    if (!canWrite(admin, newLocationId)) {
      return NextResponse.json({ error: "Tidak punya akses ke lokasi baru ini" }, { status: 403 });
    }

    const pkg = await db.package.update({
      where: { id: pkgId },
      data: {
        name:          body.name.trim(),
        price:         Number(body.price),
        type:          body.type as "voucher" | "langganan",
        quotaLimitMb:  body.quotaLimitMb != null ? BigInt(body.quotaLimitMb) : null,
        timeLimitDays: body.timeLimitDays ?? null,
        speedDownKbps: Number(body.speedDownKbps),
        speedUpKbps:   Number(body.speedUpKbps),
        throttleKbps:  Number(body.throttleKbps ?? 512),
        locationId:    newLocationId,
        isActive:      body.isActive ?? true,
        scheduleStart: parseTimeString(body.scheduleStart),
        scheduleEnd:   parseTimeString(body.scheduleEnd),
      },
    });

    return NextResponse.json({
      ok: true,
      package: {
        ...pkg,
        price:         pkg.price.toString(),
        quotaLimitMb:  pkg.quotaLimitMb?.toString() ?? null,
        scheduleStart: pkg.scheduleStart ? formatTime(pkg.scheduleStart) : null,
        scheduleEnd:   pkg.scheduleEnd   ? formatTime(pkg.scheduleEnd)   : null,
      },
    });
  } catch (err) {
    console.error("[packages/[id] PUT]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

// ─── DELETE /api/admin/packages/[id] ─────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const pkgId = parseInt(id);
  if (isNaN(pkgId)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  try {
    const existing = await db.package.findUnique({
      where:  { id: pkgId },
      select: { locationId: true, _count: { select: { vouchers: true, subscribers: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });
    if (!canWrite(admin, existing.locationId)) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }
    if (existing._count.vouchers > 0 || existing._count.subscribers > 0) {
      return NextResponse.json(
        { error: "Tidak bisa hapus paket yang sudah digunakan voucher atau subscriber" },
        { status: 409 },
      );
    }

    await db.package.delete({ where: { id: pkgId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[packages/[id] DELETE]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
