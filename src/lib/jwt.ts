import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { db } from "./db";

const JWT_SECRET = process.env.JWT_SECRET!;

// 7 hari untuk user, 24 jam untuk admin
const ADMIN_TTL_SECONDS = 60 * 60 * 24;       // 24h
const USER_TTL_SECONDS  = 60 * 60 * 24 * 7;   // 7d

export interface JwtPayload {
  sessionId: string;
  userType: "admin" | "subscriber" | "voucher";
  userId: string;
}

// ─────────────────────────────────────────────
// Token helpers
// ─────────────────────────────────────────────

export function signToken(
  payload: JwtPayload,
  expiresInSeconds = USER_TTL_SECONDS,
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresInSeconds });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// ─────────────────────────────────────────────
// Session management
// ─────────────────────────────────────────────

/**
 * Buat session baru di database dan kembalikan JWT.
 * Wajib dipanggil saat login berhasil.
 */
export async function createSession(
  userId: string,
  userType: "admin" | "subscriber" | "voucher",
  opts?: { macAddress?: string; ipAddress?: string },
): Promise<string> {
  const sessionId = randomBytes(32).toString("hex");
  const ttl =
    userType === "admin" ? ADMIN_TTL_SECONDS : USER_TTL_SECONDS;
  const expiredAt = new Date(Date.now() + ttl * 1000);

  const payload: JwtPayload = { sessionId, userType, userId };
  const token = signToken(payload, ttl);

  await db.session.create({
    data: {
      id: sessionId,
      userType,
      userId,
      token,
      macAddress: opts?.macAddress ?? null,
      ipAddress:  opts?.ipAddress  ?? null,
      isActive:   true,
      expiredAt,
    },
  });

  return token;
}

/**
 * Validasi token: verify signature LALU cross-check ke database.
 * Sesuai CLAUDE.md section 10 — tidak cukup hanya verify signature.
 */
export async function validateSession(token: string): Promise<{
  session: { id: string; userType: string; userId: string };
}> {
  // 1. Verify JWT signature & expiry
  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new Error("Token tidak valid atau sudah expired");
  }

  // 2. Cross-check ke database
  const session = await db.session.findFirst({
    where: {
      id:       payload.sessionId,
      token,
      isActive: true,
      expiredAt: { gt: new Date() },
    },
  });

  if (!session) {
    throw new Error("Session tidak ditemukan atau sudah tidak aktif");
  }

  return { session };
}

/**
 * Nonaktifkan session di database (logout).
 */
export async function invalidateSession(token: string): Promise<void> {
  await db.session.updateMany({
    where: { token },
    data:  { isActive: false },
  });
}

/**
 * Nonaktifkan semua session milik user (force logout semua perangkat).
 */
export async function invalidateAllSessions(
  userId: string,
  userType: "admin" | "subscriber" | "voucher",
): Promise<void> {
  await db.session.updateMany({
    where: { userId, userType, isActive: true },
    data:  { isActive: false },
  });
}
