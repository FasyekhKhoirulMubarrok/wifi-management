import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "./db";
import { validateSession } from "./jwt";
import type { Admin } from "@/generated/prisma";

const BCRYPT_ROUNDS = 12;

// ─────────────────────────────────────────────
// Password helpers
// ─────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─────────────────────────────────────────────
// Admin session helpers (Server Components / Route Handlers)
// ─────────────────────────────────────────────

/**
 * Baca token dari cookie dan return admin yang sedang login.
 * Lempar error jika tidak terautentikasi.
 */
export async function getCurrentAdmin(): Promise<
  Pick<Admin, "id" | "name" | "email" | "role">
> {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (!token) throw new Error("Tidak terautentikasi");

  const { session } = await validateSession(token);

  if (session.userType !== "admin") {
    throw new Error("Bukan session admin");
  }

  const admin = await db.admin.findUnique({
    where:  { id: parseInt(session.userId) },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!admin) throw new Error("Admin tidak ditemukan");
  return admin;
}

/**
 * Cek apakah admin boleh mengakses lokasi tertentu.
 * super_admin → selalu boleh.
 * admin_lokasi → hanya lokasi yang di-assign.
 * Sesuai CLAUDE.md section 16 poin 9.
 */
export async function checkAdminAccess(
  adminId: number,
  locationId: number,
): Promise<boolean> {
  const admin = await db.admin.findUnique({
    where:  { id: adminId },
    select: { role: true, locations: { select: { locationId: true } } },
  });

  if (!admin) return false;
  if (admin.role === "super_admin") return true;

  return admin.locations.some((l) => l.locationId === locationId);
}

/**
 * Ambil semua locationId yang boleh diakses admin ini.
 * Dipakai untuk filter query agar tidak bocor data lokasi lain.
 */
export async function getAccessibleLocationIds(
  adminId: number,
): Promise<number[] | null> {
  const admin = await db.admin.findUnique({
    where:  { id: adminId },
    select: { role: true, locations: { select: { locationId: true } } },
  });

  if (!admin) return [];
  if (admin.role === "super_admin") return null; // null = semua lokasi

  return admin.locations.map((l) => l.locationId);
}

// ─────────────────────────────────────────────
// Request helpers (Route Handlers)
// ─────────────────────────────────────────────

/**
 * Ambil token dari header Authorization atau cookie.
 */
export function extractToken(request: Request): string | null {
  // Coba Authorization header dulu
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Fallback ke cookie (untuk browser requests)
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)admin_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function extractUserToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)user_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Ambil IP address dari request (respects X-Forwarded-For dari Nginx).
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
