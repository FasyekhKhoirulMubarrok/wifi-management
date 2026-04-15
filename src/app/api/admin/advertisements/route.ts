import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
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
 * GET /api/admin/advertisements?locationId=&page=
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const accessibleIds = admin.role === "super_admin"
    ? null
    : admin.locations.map((l) => l.locationId);

  const { searchParams } = new URL(request.url);
  const locationStr = searchParams.get("locationId");
  const locationId  = locationStr ? parseInt(locationStr) : null;

  const where =
    locationId          ? { locationId }
    : accessibleIds !== null ? { OR: [{ locationId: { in: accessibleIds } }, { locationId: null }] }
    : {};

  try {
    const ads = await db.advertisement.findMany({
      where,
      select: {
        id:          true,
        title:       true,
        description: true,
        imageUrl:    true,
        linkUrl:     true,
        locationId:  true,
        priority:    true,
        isActive:    true,
        startDate:   true,
        endDate:     true,
        impressions: true,
        clicks:      true,
        createdAt:   true,
        location:    { select: { id: true, name: true } },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      ok: true,
      ads: ads.map((a) => ({
        ...a,
        ctr: a.impressions > 0 ? Math.round((a.clicks / a.impressions) * 1000) / 10 : 0,
      })),
    });
  } catch (err) {
    console.error("[advertisements GET]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

/**
 * POST /api/admin/advertisements
 * Accepts multipart/form-data with optional image upload.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const formData = await request.formData();
    const title       = formData.get("title")       as string | null;
    const description = formData.get("description") as string | null;
    const linkUrl     = formData.get("linkUrl")     as string | null;
    const locationStr = formData.get("locationId")  as string | null;
    const priorityStr = formData.get("priority")    as string | null;
    const startDateStr = formData.get("startDate")  as string | null;
    const endDateStr   = formData.get("endDate")    as string | null;
    const imageFile   = formData.get("image")       as File | null;

    if (!title?.trim()) return NextResponse.json({ error: "Judul wajib diisi" }, { status: 400 });
    if (description && description.length > 100) {
      return NextResponse.json({ error: "Deskripsi maksimal 100 karakter" }, { status: 400 });
    }

    let imageUrl: string | null = null;
    if (imageFile && imageFile.size > 0) {
      const result = await saveAdImage(imageFile);
      if (typeof result === "string" && result.startsWith("error:")) {
        return NextResponse.json({ error: result.slice(6) }, { status: 400 });
      }
      imageUrl = result as string;
    }

    const ad = await db.advertisement.create({
      data: {
        title:       title.trim(),
        description: description?.trim() || null,
        imageUrl,
        linkUrl:     linkUrl?.trim() || null,
        locationId:  locationStr ? parseInt(locationStr) : null,
        priority:    priorityStr ? parseInt(priorityStr) : 0,
        startDate:   startDateStr ? new Date(startDateStr) : null,
        endDate:     endDateStr   ? new Date(endDateStr)   : null,
        isActive:    true,
      },
      select: { id: true, title: true },
    });

    return NextResponse.json({ ok: true, ad }, { status: 201 });
  } catch (err) {
    console.error("[advertisements POST]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

async function saveAdImage(file: File): Promise<string | `error:${string}`> {
  const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];
  const MAX_SIZE      = 2 * 1024 * 1024; // 2MB

  if (!ALLOWED_TYPES.includes(file.type)) return "error:Hanya JPG dan PNG yang diperbolehkan";
  if (file.size > MAX_SIZE)               return "error:Ukuran gambar maksimal 2MB";

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext    = file.type === "image/png" ? "png" : "jpg";
  const fname  = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const dir    = join(process.cwd(), "public", "uploads", "ads");
  const dest   = join(dir, fname);

  // Resize to max 800×600, preserve aspect ratio
  const resized = await sharp(buffer)
    .resize({ width: 800, height: 600, fit: "inside", withoutEnlargement: true })
    .toFormat(ext === "png" ? "png" : "jpeg", { quality: 85 })
    .toBuffer();

  await writeFile(dest, resized);
  return `/uploads/ads/${fname}`;
}
