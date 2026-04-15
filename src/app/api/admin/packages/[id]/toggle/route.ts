import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken } from "@/lib/auth";

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const pkgId = parseInt(id);
  if (isNaN(pkgId)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  try {
    const pkg = await db.package.findUnique({
      where:  { id: pkgId },
      select: { isActive: true, locationId: true },
    });
    if (!pkg) return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });

    // Check access
    const hasAccess =
      admin.role === "super_admin" ||
      (pkg.locationId !== null && admin.locations.some((l) => l.locationId === pkg.locationId));
    if (!hasAccess) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

    const updated = await db.package.update({
      where: { id: pkgId },
      data:  { isActive: !pkg.isActive },
      select: { id: true, isActive: true },
    });

    return NextResponse.json({ ok: true, isActive: updated.isActive });
  } catch (err) {
    console.error("[packages/toggle]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
