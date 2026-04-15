import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken } from "@/lib/auth";
import { readSettings, writeSettings } from "@/lib/settings";

async function requireSuperAdmin(request: NextRequest) {
  const token = extractToken(request);
  if (!token) return null;
  try {
    const { session } = await validateSession(token);
    if (session.userType !== "admin") return null;
    const admin = await db.admin.findUnique({
      where:  { id: parseInt(session.userId) },
      select: { id: true, role: true },
    });
    if (!admin || admin.role !== "super_admin") return null;
    return admin;
  } catch { return null; }
}

/**
 * GET /api/admin/settings
 */
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const settings = readSettings();

    // RADIUS config from locations table
    const locations = await db.location.findMany({
      select:  { id: true, name: true, mikrotikIp: true, mikrotikUser: true },
      orderBy: { name: "asc" },
    });

    const radiusConfig = {
      authPort:    1812,
      acctPort:    1813,
      secret:      "(from clients.conf — not stored in DB)",
      clients:     locations.map((l) => ({
        locationId:  l.id,
        locationName: l.name,
        mikrotikIp:  l.mikrotikIp,
        mikrotikUser: l.mikrotikUser,
      })),
    };

    return NextResponse.json({ ok: true, settings, radiusConfig });
  } catch (err) {
    console.error("[settings GET]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/settings
 * Accepts multipart/form-data for logo upload + other settings.
 */
export async function PUT(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const formData   = await request.formData();
    const brandName  = formData.get("brandName")  as string | null;
    const logoFile   = formData.get("logo")        as File | null;
    const vapidKey   = formData.get("vapidPublicKey") as string | null;

    if (!brandName?.trim()) {
      return NextResponse.json({ error: "Nama brand wajib diisi" }, { status: 400 });
    }

    const current = readSettings();
    let brandLogoUrl = current.brandLogoUrl;

    if (logoFile && logoFile.size > 0) {
      const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/svg+xml"];
      if (!ALLOWED.includes(logoFile.type)) {
        return NextResponse.json({ error: "Hanya JPG, PNG, dan SVG yang diperbolehkan" }, { status: 400 });
      }
      if (logoFile.size > 2 * 1024 * 1024) {
        return NextResponse.json({ error: "Ukuran logo maksimal 2MB" }, { status: 400 });
      }

      const buffer = Buffer.from(await logoFile.arrayBuffer());
      const ext    = logoFile.type === "image/svg+xml" ? "svg"
                   : logoFile.type === "image/png"     ? "png" : "jpg";
      const fname  = `logo-${Date.now()}.${ext}`;
      const dir    = join(process.cwd(), "public", "uploads", "settings");
      const dest   = join(dir, fname);

      if (ext !== "svg") {
        const resized = await sharp(buffer)
          .resize({ width: 300, height: 100, fit: "inside", withoutEnlargement: true })
          .toFormat(ext === "png" ? "png" : "jpeg", { quality: 90 })
          .toBuffer();
        await writeFile(dest, resized);
      } else {
        await writeFile(dest, buffer);
      }

      brandLogoUrl = `/uploads/settings/${fname}`;
    }

    const updated = {
      brandName:      brandName.trim(),
      brandLogoUrl,
      vapidPublicKey: vapidKey?.trim() ?? current.vapidPublicKey,
    };
    writeSettings(updated);

    return NextResponse.json({ ok: true, settings: updated });
  } catch (err) {
    console.error("[settings PUT]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
