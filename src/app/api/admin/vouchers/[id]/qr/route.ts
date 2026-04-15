import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken } from "@/lib/auth";
import { generateQR } from "@/lib/voucher";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const voucherId = parseInt(id);
  if (isNaN(voucherId)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  try {
    const voucher = await db.voucher.findUnique({
      where:  { id: voucherId },
      select: { id: true, code: true, locationId: true },
    });
    if (!voucher) return NextResponse.json({ error: "Voucher tidak ditemukan" }, { status: 404 });

    // Access check
    if (admin.role !== "super_admin" && voucher.locationId !== null) {
      const hasAccess = admin.locations.some((l) => l.locationId === voucher.locationId);
      if (!hasAccess) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const qr = await generateQR(voucher.code);
    return NextResponse.json({ ok: true, code: voucher.code, qr });
  } catch (err) {
    console.error("[vouchers/qr]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
