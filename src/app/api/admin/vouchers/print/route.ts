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

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");

  if (!idsParam) return NextResponse.json({ error: "Parameter ids wajib diisi" }, { status: 400 });

  const ids = idsParam
    .split(",")
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n));

  if (ids.length === 0) return NextResponse.json({ error: "Tidak ada ID valid" }, { status: 400 });
  if (ids.length > 200) return NextResponse.json({ error: "Maksimal 200 voucher per cetak" }, { status: 400 });

  try {
    const locationIds =
      admin.role === "super_admin" ? null : admin.locations.map((l) => l.locationId);

    const vouchers = await db.voucher.findMany({
      where: {
        id: { in: ids },
        ...(locationIds !== null ? { locationId: { in: locationIds } } : {}),
      },
      include: {
        package: {
          select: {
            name: true, price: true, type: true,
            quotaLimitMb: true, timeLimitDays: true,
            speedDownKbps: true, speedUpKbps: true,
          },
        },
        location: { select: { name: true } },
      },
      orderBy: { id: "asc" },
    });

    // Generate QR codes in parallel (batched to avoid overwhelming node)
    const BATCH = 20;
    const results = [];
    for (let i = 0; i < vouchers.length; i += BATCH) {
      const batch = vouchers.slice(i, i + BATCH);
      const qrs   = await Promise.all(batch.map((v) => generateQR(v.code)));
      for (let j = 0; j < batch.length; j++) {
        const v = batch[j];
        results.push({
          id:       v.id,
          code:     v.code,
          qr:       qrs[j],
          location: v.location?.name ?? null,
          package: {
            name:          v.package.name,
            price:         v.package.price.toString(),
            quotaLimitMb:  v.package.quotaLimitMb?.toString() ?? null,
            timeLimitDays: v.package.timeLimitDays,
            speedDownKbps: v.package.speedDownKbps,
          },
        });
      }
    }

    return NextResponse.json({ ok: true, vouchers: results });
  } catch (err) {
    console.error("[vouchers/print]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
