import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
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
      select: { id: true, role: true },
    });
  } catch { return null; }
}

async function saveAdImage(file: File): Promise<string | `error:${string}`> {
  const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];
  const MAX_SIZE      = 2 * 1024 * 1024;

  if (!ALLOWED_TYPES.includes(file.type)) return "error:Hanya JPG dan PNG yang diperbolehkan";
  if (file.size > MAX_SIZE)               return "error:Ukuran gambar maksimal 2MB";

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext    = file.type === "image/png" ? "png" : "jpg";
  const fname  = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const dir    = join(process.cwd(), "public", "uploads", "ads");
  const dest   = join(dir, fname);

  const resized = await sharp(buffer)
    .resize({ width: 800, height: 600, fit: "inside", withoutEnlargement: true })
    .toFormat(ext === "png" ? "png" : "jpeg", { quality: 85 })
    .toBuffer();

  await writeFile(dest, resized);
  return `/uploads/ads/${fname}`;
}

/**
 * PUT /api/admin/advertisements/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  const existing = await db.advertisement.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Iklan tidak ditemukan" }, { status: 404 });

  try {
    const formData    = await request.formData();
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

    let imageUrl = existing.imageUrl;
    if (imageFile && imageFile.size > 0) {
      const result = await saveAdImage(imageFile);
      if (typeof result === "string" && result.startsWith("error:")) {
        return NextResponse.json({ error: result.slice(6) }, { status: 400 });
      }
      // Delete old image if it's a local file
      if (existing.imageUrl?.startsWith("/uploads/")) {
        const oldPath = join(process.cwd(), "public", existing.imageUrl);
        await unlink(oldPath).catch(() => {/* ignore if not found */});
      }
      imageUrl = result as string;
    }

    const updated = await db.advertisement.update({
      where: { id },
      data: {
        title:       title.trim(),
        description: description?.trim() || null,
        imageUrl,
        linkUrl:     linkUrl?.trim() || null,
        locationId:  locationStr ? parseInt(locationStr) : null,
        priority:    priorityStr ? parseInt(priorityStr) : 0,
        startDate:   startDateStr ? new Date(startDateStr) : null,
        endDate:     endDateStr   ? new Date(endDateStr)   : null,
      },
      select: { id: true, title: true },
    });

    return NextResponse.json({ ok: true, ad: updated });
  } catch (err) {
    console.error("[advertisements PUT]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/advertisements/[id]
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

  const existing = await db.advertisement.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Iklan tidak ditemukan" }, { status: 404 });

  try {
    await db.advertisement.delete({ where: { id } });

    if (existing.imageUrl?.startsWith("/uploads/")) {
      const oldPath = join(process.cwd(), "public", existing.imageUrl);
      await unlink(oldPath).catch(() => {/* ignore */});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[advertisements DELETE]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
