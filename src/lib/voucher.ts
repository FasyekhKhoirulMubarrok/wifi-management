import crypto from "node:crypto";
import QRCode from "qrcode";

/**
 * Generate a random voucher code in format XXXX-XXXX-XXXX
 * Uses 12 hex chars (48 bits of entropy).
 */
export function generateVoucherCode(): string {
  const part = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${part()}-${part()}-${part()}`;
}

/**
 * Generate QR code as base64 data URL.
 */
export async function generateQR(code: string): Promise<string> {
  return QRCode.toDataURL(code, { width: 200, margin: 2, color: { dark: "#000000", light: "#ffffff" } });
}

/**
 * Convert MySQL TIME value (Prisma returns as Date) to "HH:MM" string.
 */
export function timeToString(d: Date | null | undefined): string {
  if (!d) return "";
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Parse "HH:MM" string to a Date object compatible with Prisma @db.Time
 */
export function parseTimeString(s: string | null | undefined): Date | null {
  if (!s) return null;
  const match = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1]);
  const m = parseInt(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return new Date(1970, 0, 1, h, m, 0, 0);
}
