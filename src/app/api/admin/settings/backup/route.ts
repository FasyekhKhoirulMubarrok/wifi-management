import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken } from "@/lib/auth";

const execAsync = promisify(exec);

async function requireSuperAdmin(request: NextRequest) {
  const token = extractToken(request);
  if (!token) return null;
  try {
    const { session } = await validateSession(token);
    if (session.userType !== "admin") return null;
    const admin = await db.admin.findUnique({
      where:  { id: parseInt(session.userId) },
      select: { id: true, role: true },
    });
    if (!admin || admin.role !== "super_admin") return null;
    return admin;
  } catch { return null; }
}

/**
 * POST /api/admin/settings/backup
 * Triggers a mysqldump and returns the .sql file as download.
 */
export async function POST(request: NextRequest) {
  const admin = await requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const dbUrl = process.env.DATABASE_URL ?? "";
  // Parse: mysql://user:pass@host:port/dbname
  const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    return NextResponse.json({ error: "DATABASE_URL tidak valid atau tidak bisa di-parse" }, { status: 500 });
  }

  const [, user, pass, host, port, dbname] = match;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outFile   = join("/tmp", `backup-${timestamp}.sql`);

  try {
    await execAsync(
      `mysqldump -h ${host} -P ${port} -u ${user} -p${pass} --single-transaction --quick ${dbname} > ${outFile}`,
    );

    const buffer = await readFile(outFile);
    await unlink(outFile).catch(() => {/* ignore */});

    await db.adminLog.create({
      data: {
        adminId:     admin.id,
        action:      "DATABASE_BACKUP",
        description: `Manual backup oleh super_admin`,
        ipAddress:   request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      },
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":        "application/sql",
        "Content-Disposition": `attachment; filename="backup-${timestamp}.sql"`,
      },
    });
  } catch (err) {
    console.error("[settings/backup POST]", err);
    return NextResponse.json({ error: "Gagal membuat backup" }, { status: 500 });
  }
}
