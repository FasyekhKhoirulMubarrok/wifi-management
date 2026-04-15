import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

/**
 * Next.js Edge Middleware — proteksi route berdasarkan path.
 *
 * Urutan pengecekan:
 * 1. /api/mikrotik/* → wajib API key + whitelist IP (dicek di route handler,
 *    middleware hanya forward)
 * 2. /api/auth/*    → public (login endpoint)
 * 3. /api/admin/*   → wajib JWT admin
 * 4. /api/*         → public (termasuk /api/trial, /api/quota dari MikroTik)
 * 5. /admin/login   → public
 * 6. /admin/*       → wajib JWT admin, redirect ke /admin/login jika tidak ada
 * 7. /portal/login  → public
 * 8. /portal/expired → public
 * 9. /portal/*      → wajib JWT user
 *
 * NOTE: Middleware berjalan di Edge runtime — tidak boleh import Prisma/Node.js.
 * Cross-check session ke database dilakukan di route handler / server component.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── /api/auth/* — public (login / logout endpoints) ──────────────────
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // ── /api/admin/* — wajib JWT admin ───────────────────────────────────
  if (pathname.startsWith("/api/admin/")) {
    return requireAdminToken(request);
  }

  // ── /api/* — public (MikroTik, trial, quota dicek di route handler) ──
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // ── /admin/login — public ─────────────────────────────────────────────
  if (pathname === "/admin/login") {
    // Jika sudah login, redirect ke dashboard
    const token = getAdminToken(request);
    if (token && isTokenValid(token)) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // ── /admin/* — wajib JWT admin ────────────────────────────────────────
  if (pathname.startsWith("/admin/")) {
    return requireAdminToken(request);
  }

  // ── /portal/login, /portal/expired, /portal/blocked — public ────────
  if (
    pathname.startsWith("/portal/login") ||
    pathname.startsWith("/portal/expired") ||
    pathname.startsWith("/portal/blocked")
  ) {
    return NextResponse.next();
  }

  // ── /portal/* — wajib JWT user ────────────────────────────────────────
  if (pathname.startsWith("/portal/")) {
    return requireUserToken(request);
  }

  return NextResponse.next();
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getAdminToken(request: NextRequest): string | null {
  // Coba cookie dulu, lalu Authorization header
  return (request.cookies.get("admin_token")?.value ??
  request.headers.get("authorization")?.replace(/^Bearer\s+/, "") ?? null);
}

function getUserToken(request: NextRequest): string | null {
  return (request.cookies.get("user_token")?.value ??
  request.headers.get("authorization")?.replace(/^Bearer\s+/, "") ?? null);
}

function isTokenValid(token: string): boolean {
  try {
    verifyToken(token);
    return true;
  } catch {
    return false;
  }
}

function requireAdminToken(request: NextRequest): NextResponse {
  const token = getAdminToken(request);

  if (!token || !isTokenValid(token)) {
    // API request → 401 JSON
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }
    // Browser request → redirect ke login
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Inject user info ke header untuk server components
  const payload = verifyToken(token);
  const response = NextResponse.next();
  response.headers.set("x-user-id",   payload.userId);
  response.headers.set("x-user-type", payload.userType);
  response.headers.set("x-session-id", payload.sessionId);
  return response;
}

function requireUserToken(request: NextRequest): NextResponse {
  const token = getUserToken(request);

  if (!token || !isTokenValid(token)) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }
    return NextResponse.redirect(new URL("/portal/login", request.url));
  }

  const payload = verifyToken(token);
  const response = NextResponse.next();
  response.headers.set("x-user-id",   payload.userId);
  response.headers.set("x-user-type", payload.userType);
  response.headers.set("x-session-id", payload.sessionId);
  return response;
}

// ─────────────────────────────────────────────
// Matcher — jalankan middleware hanya di path ini
// ─────────────────────────────────────────────
export const config = {
  matcher: [
    "/admin/:path*",
    "/portal/:path*",
    "/api/admin/:path*",
    "/api/auth/:path*",
  ],
};
