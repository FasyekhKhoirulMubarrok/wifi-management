import { NextRequest, NextResponse } from "next/server";
import { invalidateSession } from "@/lib/jwt";

/**
 * POST /api/portal/logout
 * Invalidate the current user session and clear the cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("user_token")?.value;
    if (token) {
      try { await invalidateSession(token); } catch { /* already invalid */ }
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.delete("user_token");
    return response;
  } catch (err) {
    console.error("[portal/logout]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
