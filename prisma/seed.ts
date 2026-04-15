import { PrismaClient, AdminRole, PackageType } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ──────────────────────────────────────────
  // Super Admin default
  // ──────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("Admin@123!", 12);

  const superAdmin = await prisma.admin.upsert({
    where: { email: "admin@fadiljaya.com" },
    update: {},
    create: {
      name: "Super Admin",
      email: "admin@fadiljaya.com",
      password: hashedPassword,
      role: AdminRole.super_admin,
    },
  });

  console.log(`✓ Super admin: ${superAdmin.email}`);

  // ──────────────────────────────────────────
  // Lokasi contoh
  // ──────────────────────────────────────────
  const location = await prisma.location.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Kantor Pusat",
      address: "Jl. Fadil Jaya No. 1, Kota",
      mikrotikIp: "192.168.1.1",
      mikrotikUser: "admin",
      mikrotikPass: "mikrotik123",
      isActive: true,
    },
  });

  console.log(`✓ Lokasi: ${location.name}`);

  // ──────────────────────────────────────────
  // Assign super admin ke lokasi
  // ──────────────────────────────────────────
  await prisma.adminLocation.upsert({
    where: { adminId_locationId: { adminId: superAdmin.id, locationId: location.id } },
    update: {},
    create: { adminId: superAdmin.id, locationId: location.id },
  });

  // ──────────────────────────────────────────
  // Paket 1 — Voucher 10GB / 7 hari
  // ──────────────────────────────────────────
  const paket1 = await prisma.package.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Voucher 10GB",
      price: 15000,
      quotaLimitMb: 10240,      // 10 GB
      timeLimitDays: 7,
      speedDownKbps: 10240,     // 10 Mbps
      speedUpKbps: 5120,        // 5 Mbps
      throttleKbps: 512,
      type: PackageType.voucher,
      locationId: null,         // berlaku semua lokasi
      isActive: true,
    },
  });

  console.log(`✓ Paket: ${paket1.name}`);

  // ──────────────────────────────────────────
  // Paket 2 — Langganan bulanan unlimited
  // ──────────────────────────────────────────
  const paket2 = await prisma.package.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: "Langganan Bulanan",
      price: 100000,
      quotaLimitMb: null,       // unlimited
      timeLimitDays: 30,
      speedDownKbps: 20480,     // 20 Mbps
      speedUpKbps: 10240,       // 10 Mbps
      throttleKbps: 512,
      type: PackageType.langganan,
      locationId: null,
      isActive: true,
    },
  });

  console.log(`✓ Paket: ${paket2.name}`);

  // ──────────────────────────────────────────
  // Paket 3 — Paket Malam (00:00–06:00)
  // ──────────────────────────────────────────
  const paket3 = await prisma.package.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: "Paket Malam 5GB",
      price: 5000,
      quotaLimitMb: 5120,       // 5 GB
      timeLimitDays: 1,
      speedDownKbps: 51200,     // 50 Mbps (malam bebas)
      speedUpKbps: 25600,       // 25 Mbps
      throttleKbps: 512,
      type: PackageType.voucher,
      locationId: null,
      isActive: true,
      scheduleStart: new Date("1970-01-01T00:00:00"),
      scheduleEnd: new Date("1970-01-01T06:00:00"),
    },
  });

  console.log(`✓ Paket: ${paket3.name}`);

  // ──────────────────────────────────────────
  // Konfigurasi trial default per lokasi
  // ──────────────────────────────────────────
  await prisma.trialConfig.upsert({
    where: { locationId: location.id },
    update: {},
    create: {
      locationId: location.id,
      durationMinutes: 5,
      speedKbps: 1024,          // 1 Mbps
      isActive: true,
    },
  });

  console.log(`✓ Trial config: ${location.name} — 5 menit @ 1 Mbps`);

  console.log("\n✅ Seeding selesai!");
  console.log("   Email: admin@fadiljaya.com");
  console.log("   Password: Admin@123!");
  console.log("   ⚠️  Ganti password setelah login pertama!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
