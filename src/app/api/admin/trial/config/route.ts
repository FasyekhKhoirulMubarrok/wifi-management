import { NextRequest, NextResponse } from "next/server";
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
 * GET /api/admin/trial/config
 * Returns trial config for all accessible locations.
 * If no TrialConfig row exists for a location, returns defaults.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const accessibleIds = admin.role === "super_admin"
    ? null
    : admin.locations.map((l) => l.locationId);

  try {
    const locations = await db.location.findMany({
      where:   accessibleIds !== null ? { id: { in: accessibleIds } } : undefined,
      select:  { id: true, name: true, trialConfig: true },
      orderBy: { name: "asc" },
    });

    const configs = locations.map((loc) => ({
      locationId:      loc.id,
      locationName:    loc.name,
      durationMinutes: loc.trialConfig?.durationMinutes ?? 5,
      speedKbps:       loc.trialConfig?.speedKbps       ?? 1024,
      isActive:        loc.trialConfig?.isActive        ?? true,
    }));

    return NextResponse.json({ ok: true, configs });
  } catch (err) {
    console.error("[trial/config GET]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
