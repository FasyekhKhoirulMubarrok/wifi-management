import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken, hashPassword } from "@/lib/auth";
import {
  updateRadiusPassword,
  updateRadiusBandwidth,
  removeRadiusUser,
} from "@/lib/radius";

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

function hasAccess(
  admin: { role: string; locations: { locationId: number }[] },
  locationId: number,
) {
  return admin.role === "super_admin" || admin.locations.some((l) => l.locationId === locationId);
}

// ─── PUT /api/admin/users/[id] ────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const subId = parseInt(id);
  if (isNaN(subId)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  try {
    const existing = await db.subscriber.findUnique({
      where:   { id: subId },
      include: { package: { select: { speedDownKbps: true, speedUpKbps: true, timeLimitDays: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Subscriber tidak ditemukan" }, { status: 404 });
    if (!hasAccess(admin, existing.locationId)) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const body = await request.json() as {
      password?:   string;
      name?:       string;
      packageId?:  number;
      locationId?: number;
      status?:     string;
    };

    // Validate new location access if changed
    const newLocationId = body.locationId ?? existing.locationId;
    if (newLocationId !== existing.locationId && !hasAccess(admin, newLocationId)) {
      return NextResponse.json({ error: "Akses ditolak ke lokasi baru" }, { status: 403 });
    }

    // Get new package if changed
    let newPkg = existing.package;
    if (body.packageId && body.packageId !== existing.packageId) {
      const pkg = await db.package.findUnique({
        where:  { id: body.packageId },
        select: { speedDownKbps: true, speedUpKbps: true, timeLimitDays: true },
      });
      if (!pkg) return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });
      newPkg = pkg;
    }

    const updateData: Record<string, unknown> = {
      name:       body.name?.trim() ?? existing.name,
      packageId:  body.packageId   ?? existing.packageId,
      locationId: newLocationId,
      status:     body.status      ?? existing.status,
    };
    if (body.password?.trim()) {
      updateData.password = await hashPassword(body.password);
    }

    const updated = await db.subscriber.update({
      where: { id: subId },
      data:  updateData,
    });

    // Sync FreeRADIUS
    if (body.password?.trim()) {
      await updateRadiusPassword(existing.username, body.password);
    }
    if (body.packageId && body.packageId !== existing.packageId) {
      await updateRadiusBandwidth(existing.username, newPkg.speedDownKbps, newPkg.speedUpKbps);
    }

    return NextResponse.json({ ok: true, subscriber: { id: updated.id, username: updated.username } });
  } catch (err) {
    console.error("[users/[id] PUT]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

// ─── DELETE /api/admin/users/[id] ────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const subId = parseInt(id);
  if (isNaN(subId)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  try {
    const existing = await db.subscriber.findUnique({
      where:  { id: subId },
      select: { username: true, locationId: true },
    });
    if (!existing) return NextResponse.json({ error: "Subscriber tidak ditemukan" }, { status: 404 });
    if (!hasAccess(admin, existing.locationId)) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    await db.subscriber.delete({ where: { id: subId } });
    await removeRadiusUser(existing.username);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[users/[id] DELETE]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
