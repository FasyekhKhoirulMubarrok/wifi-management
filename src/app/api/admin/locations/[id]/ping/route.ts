import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSession } from "@/lib/jwt";
import { extractToken } from "@/lib/auth";
import net from "node:net";

function tcpProbe(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    function done(result: boolean) {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    }

    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done(true));
    socket.on("error",   () => done(false));
    socket.on("timeout", () => done(false));
    socket.connect(port, host);
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = extractToken(request);
  if (!token) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

  try {
    const { session } = await validateSession(token);
    if (session.userType !== "admin") {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Session tidak valid" }, { status: 401 });
  }

  const { id } = await params;
  const locationId = parseInt(id);
  if (isNaN(locationId)) return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });

  try {
    // id=0 means ping an arbitrary IP passed via ?ip= (used on the create-location form)
    let ip: string;
    if (locationId === 0) {
      const ipParam = request.nextUrl.searchParams.get("ip");
      if (!ipParam) return NextResponse.json({ error: "Parameter ip wajib diisi" }, { status: 400 });
      ip = ipParam;
    } else {
      const location = await db.location.findUnique({
        where:  { id: locationId },
        select: { mikrotikIp: true },
      });
      if (!location) return NextResponse.json({ error: "Lokasi tidak ditemukan" }, { status: 404 });
      ip = location.mikrotikIp;
    }
    const start = Date.now();

    // Try MikroTik API port (8728), then Winbox (8291), then HTTP (80)
    const PORTS = [8728, 8291, 80];
    let reachable = false;
    let openPort: number | null = null;

    for (const port of PORTS) {
      const ok = await tcpProbe(ip, port, 2000);
      if (ok) {
        reachable = true;
        openPort  = port;
        break;
      }
    }

    const latencyMs = Date.now() - start;

    return NextResponse.json({
      ok:       true,
      ip,
      reachable,
      openPort,
      latencyMs,
    });
  } catch (err) {
    console.error("[locations/ping]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
