import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "@/lib/jwt";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("admin_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    const { session } = await validateSession(token);

    if (session.userType !== "admin") {
      return NextResponse.json(
        { error: "Bukan session admin" },
        { status: 403 },
      );
    }

    const admin = await db.admin.findUnique({
      where:  { id: parseInt(session.userId) },
      select: {
        id:        true,
        name:      true,
        email:     true,
        role:      true,
        createdAt: true,
        locations: {
          select: {
            location: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Admin tidak ditemukan" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id:        admin.id,
      name:      admin.name,
      email:     admin.email,
      role:      admin.role,
      createdAt: admin.createdAt,
      locations: admin.locations.map((l) => l.location),
    });
  } catch (err) {
    console.error("[admin/me]", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
