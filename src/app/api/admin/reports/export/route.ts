import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken } from "@/lib/auth";
import { generateExcel, generatePDF } from "@/lib/export";

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
 * GET /api/admin/reports/export?format=excel|pdf&type=revenue|data-usage|active-users|vouchers|session-logs&from=&to=&locationId=
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const format      = searchParams.get("format") === "pdf" ? "pdf" : "excel";
  const type        = searchParams.get("type") ?? "revenue";
  const fromStr     = searchParams.get("from");
  const toStr       = searchParams.get("to");
  const locationStr = searchParams.get("locationId");

  const now  = new Date();
  const from = fromStr ? new Date(fromStr) : new Date(now.getFullYear(), now.getMonth(), 1);
  const to   = toStr   ? new Date(toStr + "T23:59:59.999Z") : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const fmtDate = (d: Date | null | undefined) => d ? d.toLocaleDateString("id-ID") : "—";
  const fmtNum  = (n: number) => n.toLocaleString("id-ID");

  const accessibleIds = admin.role === "super_admin"
    ? null
    : admin.locations.map((l) => l.locationId);
  const locationId = locationStr ? parseInt(locationStr) : null;
  const locationWhere =
    locationId          ? { locationId }
    : accessibleIds !== null ? { locationId: { in: accessibleIds } }
    : {};

  try {
    let buffer: Buffer;
    let filename: string;
    const dateRange = `${fromStr ?? "all"}_${toStr ?? "all"}`;

    if (type === "revenue") {
      const [voucherRows, subRows] = await Promise.all([
        db.voucher.findMany({
          where:   { usedAt: { gte: from, lte: to }, status: { not: "unused" }, ...locationWhere },
          include: { package: { select: { name: true, price: true } }, location: { select: { name: true } } },
          orderBy: { usedAt: "desc" },
        }),
        db.subscriber.findMany({
          where:   { activatedAt: { gte: from, lte: to }, ...locationWhere },
          include: { package: { select: { name: true, price: true } }, location: { select: { name: true } } },
          orderBy: { activatedAt: "desc" },
        }),
      ]);

      const rows = [
        ...voucherRows.map((v) => ({
          type: "Voucher", reference: v.code, package: v.package.name,
          location: v.location?.name ?? "—", amount: Number(v.package.price),
          date: fmtDate(v.usedAt),
        })),
        ...subRows.map((s) => ({
          type: "Langganan", reference: s.username, package: s.package.name,
          location: s.location.name, amount: Number(s.package.price),
          date: fmtDate(s.activatedAt),
        })),
      ].sort((a, b) => b.date.localeCompare(a.date));

      filename = `laporan-pendapatan_${dateRange}`;
      if (format === "excel") {
        buffer = await generateExcel("Pendapatan", [
          { header: "Tipe",       key: "type",      width: 12 },
          { header: "Referensi",  key: "reference", width: 20 },
          { header: "Paket",      key: "package",   width: 25 },
          { header: "Lokasi",     key: "location",  width: 20 },
          { header: "Jumlah",     key: "amount",    width: 15 },
          { header: "Tanggal",    key: "date",      width: 15 },
        ], rows);
      } else {
        buffer = generatePDF(
          "Laporan Pendapatan",
          ["Tipe", "Referensi", "Paket", "Lokasi", "Jumlah", "Tanggal"],
          rows.map((r) => [r.type, r.reference, r.package, r.location, `Rp ${fmtNum(r.amount)}`, r.date]),
        );
      }

    } else if (type === "session-logs") {
      const logs = await db.sessionLog.findMany({
        where:   { loginAt: { gte: from, lte: to }, ...locationWhere },
        include: { location: { select: { name: true } } },
        orderBy: { loginAt: "desc" },
        take:    5000,
      });

      filename = `session-log_${dateRange}`;
      const dataRows = logs.map((l) => ({
        username:    l.username,
        userType:    l.userType,
        mac:         l.macAddress ?? "—",
        ip:          l.ipAddress  ?? "—",
        location:    l.location.name,
        dataMb:      Number(l.dataUsedMb),
        durationMin: Math.round(l.durationSecs / 60),
        loginAt:     fmtDate(l.loginAt),
        logoutAt:    fmtDate(l.logoutAt),
        cause:       l.terminateCause ?? "—",
      }));

      if (format === "excel") {
        buffer = await generateExcel("Session Log", [
          { header: "Username",    key: "username",    width: 18 },
          { header: "Tipe",        key: "userType",    width: 12 },
          { header: "MAC",         key: "mac",         width: 18 },
          { header: "IP",          key: "ip",          width: 15 },
          { header: "Lokasi",      key: "location",    width: 20 },
          { header: "Data (MB)",   key: "dataMb",      width: 12 },
          { header: "Durasi (mnt)", key: "durationMin", width: 14 },
          { header: "Login",       key: "loginAt",     width: 15 },
          { header: "Logout",      key: "logoutAt",    width: 15 },
          { header: "Penyebab",    key: "cause",       width: 18 },
        ], dataRows);
      } else {
        buffer = generatePDF(
          "Session Log",
          ["Username", "Tipe", "MAC", "IP", "Lokasi", "Data (MB)", "Durasi (mnt)", "Login"],
          dataRows.map((r) => [r.username, r.userType, r.mac, r.ip, r.location, r.dataMb, r.durationMin, r.loginAt]),
        );
      }

    } else if (type === "vouchers") {
      const vrows = await db.voucher.findMany({
        where:   { createdAt: { gte: from, lte: to }, ...locationWhere },
        include: { package: { select: { name: true, price: true } }, location: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take:    5000,
      });

      filename = `laporan-voucher_${dateRange}`;
      const dataRows = vrows.map((v) => ({
        code:     v.code,
        package:  v.package.name,
        location: v.location?.name ?? "—",
        status:   v.status,
        usedAt:   fmtDate(v.usedAt),
        expiredAt: fmtDate(v.expiredAt),
        price:    Number(v.package.price),
      }));

      if (format === "excel") {
        buffer = await generateExcel("Voucher", [
          { header: "Kode",     key: "code",     width: 20 },
          { header: "Paket",    key: "package",  width: 25 },
          { header: "Lokasi",   key: "location", width: 20 },
          { header: "Status",   key: "status",   width: 12 },
          { header: "Dipakai",  key: "usedAt",   width: 15 },
          { header: "Expired",  key: "expiredAt", width: 15 },
          { header: "Harga",    key: "price",    width: 15 },
        ], dataRows);
      } else {
        buffer = generatePDF(
          "Laporan Voucher",
          ["Kode", "Paket", "Lokasi", "Status", "Dipakai", "Expired"],
          dataRows.map((r) => [r.code, r.package, r.location, r.status, r.usedAt, r.expiredAt]),
        );
      }

    } else {
      return NextResponse.json({ error: "Tipe laporan tidak dikenal" }, { status: 400 });
    }

    const ext          = format === "excel" ? "xlsx" : "pdf";
    const contentType  = format === "excel"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/pdf";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":        contentType,
        "Content-Disposition": `attachment; filename="${filename}.${ext}"`,
      },
    });
  } catch (err) {
    console.error("[reports/export]", err);
    return NextResponse.json({ error: "Gagal membuat file export" }, { status: 500 });
  }
}
