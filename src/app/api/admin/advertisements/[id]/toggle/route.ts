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
      select: { id: true, role: true },
    });
  } catch { return null; }
}

/**
 * PATCH /api/admin/advertisements/[id]/toggle
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  try {
    const existing = await db.advertisement.findUnique({ where: { id }, select: { isActive: true } });
    if (!existing) return NextResponse.json({ error: "Iklan tidak ditemukan" }, { status: 404 });

    const updated = await db.advertisement.update({
      where: { id },
      data:  { isActive: !existing.isActive },
      select: { id: true, isActive: true },
    });

    return NextResponse.json({ ok: true, isActive: updated.isActive });
  } catch (err) {
    console.error("[advertisements toggle PATCH]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
