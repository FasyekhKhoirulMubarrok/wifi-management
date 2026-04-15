import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken } from "@/lib/auth";
import { generateVoucherCode } from "@/lib/voucher";

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

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const body = await request.json() as {
      packageId?:  number;
      count?:      number;
      locationId?: number | null;
    };

    if (!body.packageId)                  return NextResponse.json({ error: "packageId wajib diisi" }, { status: 400 });
    if (!body.count || body.count < 1)    return NextResponse.json({ error: "Jumlah minimal 1" }, { status: 400 });
    if (body.count > 100)                 return NextResponse.json({ error: "Jumlah maksimal 100" }, { status: 400 });

    const locationId = body.locationId ?? null;

    // Check access
    if (admin.role !== "super_admin" && locationId !== null) {
      const hasAccess = admin.locations.some((l) => l.locationId === locationId);
      if (!hasAccess) return NextResponse.json({ error: "Tidak punya akses ke lokasi ini" }, { status: 403 });
    }

    // Validate package exists
    const pkg = await db.package.findUnique({
      where:  { id: body.packageId },
      select: { id: true, name: true, type: true },
    });
    if (!pkg) return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 404 });
    if (pkg.type !== "voucher") return NextResponse.json({ error: "Paket harus bertipe voucher" }, { status: 400 });

    // Generate unique codes (retry on conflict)
    const count = body.count;
    const codes: string[] = [];
    let attempts = 0;
    const maxAttempts = count * 5;

    while (codes.length < count && attempts < maxAttempts) {
      attempts++;
      const code = generateVoucherCode();
      if (codes.includes(code)) continue;

      // Check DB uniqueness
      const exists = await db.voucher.findUnique({ where: { code }, select: { id: true } });
      if (!exists) codes.push(code);
    }

    if (codes.length < count) {
      return NextResponse.json({ error: "Gagal menghasilkan kode unik yang cukup" }, { status: 500 });
    }

    // Batch insert
    await db.voucher.createMany({
      data: codes.map((code) => ({
        code,
        packageId:  body.packageId!,
        locationId: locationId ?? null,
        status:     "unused" as const,
        createdBy:  admin.id,
      })),
    });

    // Fetch the generated vouchers for response
    const vouchers = await db.voucher.findMany({
      where:   { code: { in: codes } },
      include: { package: { select: { id: true, name: true, price: true } } },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({
      ok: true,
      count: vouchers.length,
      vouchers: vouchers.map((v) => ({
        id:        v.id,
        code:      v.code,
        status:    v.status,
        createdAt: v.createdAt,
        package: {
          id:    v.package.id,
          name:  v.package.name,
          price: v.package.price.toString(),
        },
      })),
    });
  } catch (err) {
    console.error("[vouchers/generate]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
