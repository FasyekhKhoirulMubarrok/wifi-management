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

/**
 * DELETE /api/admin/mac-rules/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  try {
    const rule = await db.macRule.findUnique({ where: { id } });
    if (!rule) return NextResponse.json({ error: "Rule tidak ditemukan" }, { status: 404 });

    // Check access for admin_lokasi
    if (admin.role !== "super_admin" && rule.locationId !== null) {
      const accessible = admin.locations.map((l) => l.locationId);
      if (!accessible.includes(rule.locationId)) {
        return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
      }
    }

    await db.macRule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mac-rules DELETE]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
