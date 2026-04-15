/**
 * Validasi API key + whitelist IP untuk endpoint sensitif MikroTik.
 * Sesuai CLAUDE.md section 10 — dua lapis: IP whitelist + API key header.
 */

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY!;

/**
 * Parse daftar IP yang diizinkan dari env.
 * Mendukung format: "192.168.1.1,10.0.0.1" atau single IP.
 */
function getAllowedIPs(): string[] {
  const ips: string[] = [
    "127.0.0.1",
    "::1",
    // Docker internal network
    ...(process.env.MIKROTIK_IP?.split(",").map((ip) => ip.trim()) ?? []),
  ];

  // Tambahan IP dari ALLOWED_MIKROTIK_IPS jika ada
  const extra = process.env.ALLOWED_MIKROTIK_IPS;
  if (extra) {
    ips.push(...extra.split(",").map((ip) => ip.trim()));
  }

  return ips.filter(Boolean);
}

export interface MikrotikValidationError {
  status: number;
  message: string;
}

/**
 * Validasi request dari MikroTik atau internal service.
 * Lempar MikrotikValidationError jika tidak valid.
 *
 * Penggunaan di Route Handler:
 *   const err = validateMikrotikRequest(request);
 *   if (err) return Response.json({ error: err.message }, { status: err.status });
 */
export function validateMikrotikRequest(
  request: Request,
): MikrotikValidationError | null {
  const clientIP =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "";

  const apiKey = request.headers.get("x-api-key");

  // 1. Cek IP whitelist
  const allowedIPs = getAllowedIPs();
  const ipAllowed =
    allowedIPs.includes(clientIP) ||
    // izinkan Docker bridge network 172.x.x.x
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(clientIP);

  if (!ipAllowed) {
    return { status: 403, message: "Forbidden: IP tidak diizinkan" };
  }

  // 2. Cek API key
  if (!apiKey || apiKey !== INTERNAL_API_KEY) {
    return { status: 401, message: "Unauthorized: API key tidak valid" };
  }

  return null;
}

/**
 * Versi yang langsung melempar Response (dipakai di Route Handler).
 */
export function requireMikrotikAuth(request: Request): void {
  const err = validateMikrotikRequest(request);
  if (err) {
    throw new MikrotikAuthError(err.message, err.status);
  }
}

export class MikrotikAuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "MikrotikAuthError";
  }

  toResponse(): Response {
    return Response.json(
      { error: this.message },
      { status: this.statusCode },
    );
  }
}
