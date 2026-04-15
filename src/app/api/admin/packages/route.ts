import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken } from "@/lib/auth";
import { parseTimeString } from "@/lib/voucher";

// ─── auth helper ─────────────────────────────────────────────────────────────

async function requireAdmin(request: NextRequest) {
  const token = extractToken(request);
  if (!token) return null;
  try {
    const { session } = await validateSession(token);
    if (session.userType !== "admin") return null;
    const admin = await db.admin.findUnique({
      where:  { id: parseInt(session.userId) },
      select: { id: true, role: true, locations: { select: { locationId: true } } },
    });
    return admin;
  } catch {
    return null;
  }
}

function canWrite(
  admin: { role: string; locations: { locationId: number }[] },
  locationId: number | null,
): boolean {
  if (admin.role === "super_admin") return true;
  if (locationId === null) return false; // global packages: super_admin only
  return admin.locations.some((l) => l.locationId === locationId);
}

// ─── GET /api/admin/packages ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const typeFilter     = searchParams.get("type");
  const locationFilter = searchParams.get("locationId");
  const activeFilter   = searchParams.get("isActive");

  try {
    const locationIds =
      admin.role === "super_admin"
        ? null
        : admin.locations.map((l) => l.locationId);

    const where: Record<string, unknown> = {};

    if (typeFilter) where.type = typeFilter;
    if (activeFilter !== null && activeFilter !== "") where.isActive = activeFilter === "true";
    if (locationFilter) {
      where.locationId = locationFilter === "null" ? null : parseInt(locationFilter);
    } else if (locationIds !== null) {
      // admin_lokasi: show packages for their locations + global packages (locationId=null)
      where.OR = [
        { locationId: { in: locationIds } },
        { locationId: null },
      ];
    }

    const packages = await db.package.findMany({
      where,
      include: { location: { select: { id: true, name: true } } },
      orderBy: [{ locationId: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({
      ok: true,
      packages: packages.map((p) => ({
        id:            p.id,
        name:          p.name,
        price:         p.price.toString(),
        quotaLimitMb:  p.quotaLimitMb?.toString() ?? null,
        timeLimitDays: p.timeLimitDays,
        speedDownKbps: p.speedDownKbps,
        speedUpKbps:   p.speedUpKbps,
        throttleKbps:  p.throttleKbps,
        type:          p.type,
        locationId:    p.locationId,
        location:      p.location,
        isActive:      p.isActive,
        scheduleStart: p.scheduleStart ? formatTime(p.scheduleStart) : null,
        scheduleEnd:   p.scheduleEnd   ? formatTime(p.scheduleEnd)   : null,
        createdAt:     p.createdAt,
      })),
    });
  } catch (err) {
    console.error("[packages GET]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── POST /api/admin/packages ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const body = await request.json() as PackageInput;
    const validation = validatePackageInput(body);
    if (validation) return NextResponse.json({ error: validation }, { status: 400 });

    const locationId = body.locationId ?? null;
    if (!canWrite(admin, locationId)) {
      return NextResponse.json({ error: "Tidak punya akses ke lokasi ini" }, { status: 403 });
    }

    const pkg = await db.package.create({
      data: buildPackageData(body),
    });

    return NextResponse.json({ ok: true, package: serializePackage(pkg) }, { status: 201 });
  } catch (err) {
    console.error("[packages POST]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

// ─── shared helpers ───────────────────────────────────────────────────────────

interface PackageInput {
  name?:          string;
  price?:         string | number;
  type?:          string;
  quotaLimitMb?:  string | number | null;
  timeLimitDays?: number | null;
  speedDownKbps?: number;
  speedUpKbps?:   number;
  throttleKbps?:  number;
  locationId?:    number | null;
  isActive?:      boolean;
  scheduleStart?: string | null;
  scheduleEnd?:   string | null;
}

function validatePackageInput(b: PackageInput): string | null {
  if (!b.name?.trim())                       return "Nama wajib diisi";
  if (!b.price || isNaN(Number(b.price)))    return "Harga tidak valid";
  if (Number(b.price) < 0)                   return "Harga tidak boleh negatif";
  if (!["voucher", "langganan"].includes(b.type ?? "")) return "Tipe tidak valid";
  if (!b.speedDownKbps || b.speedDownKbps <= 0) return "Kecepatan download wajib diisi";
  if (!b.speedUpKbps   || b.speedUpKbps   <= 0) return "Kecepatan upload wajib diisi";
  return null;
}

function buildPackageData(b: PackageInput) {
  return {
    name:          b.name!.trim(),
    price:         Number(b.price),
    type:          b.type as "voucher" | "langganan",
    quotaLimitMb:  b.quotaLimitMb != null ? BigInt(b.quotaLimitMb) : null,
    timeLimitDays: b.timeLimitDays ?? null,
    speedDownKbps: Number(b.speedDownKbps),
    speedUpKbps:   Number(b.speedUpKbps),
    throttleKbps:  Number(b.throttleKbps ?? 512),
    locationId:    b.locationId ?? null,
    isActive:      b.isActive ?? true,
    scheduleStart: parseTimeString(b.scheduleStart),
    scheduleEnd:   parseTimeString(b.scheduleEnd),
  };
}

function serializePackage(p: {
  id: number; name: string; price: unknown; type: string;
  quotaLimitMb: bigint | null; timeLimitDays: number | null;
  speedDownKbps: number; speedUpKbps: number; throttleKbps: number;
  locationId: number | null; isActive: boolean;
  scheduleStart: Date | null; scheduleEnd: Date | null; createdAt: Date;
}) {
  return {
    ...p,
    price:         p.price?.toString(),
    quotaLimitMb:  p.quotaLimitMb?.toString() ?? null,
    scheduleStart: p.scheduleStart ? formatTime(p.scheduleStart) : null,
    scheduleEnd:   p.scheduleEnd   ? formatTime(p.scheduleEnd)   : null,
  };
}
