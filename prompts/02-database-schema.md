# Fase 02 — Database Schema & Prisma Setup

## Sebelum Mulai
Baca `CLAUDE.md` terlebih dahulu. Pastikan fase 01 sudah selesai.

## Context7
use context7 untuk:
- prisma — schema definition, relations, migration, mysql connector

## Status
- [x] Fase 01: Docker + struktur project selesai
- [ ] Fase ini: Database schema + Prisma setup

## Yang Harus Dikerjakan

### 1. Install dependencies
```bash
npm install prisma @prisma/client
npx prisma init --datasource-provider mysql
```

### 2. Buat prisma/schema.prisma
Buat semua model sesuai CLAUDE.md section 5 (Struktur Database), mencakup:
- `Admin` + `AdminLocation`
- `Location`
- `Package`
- `Voucher`
- `Subscriber`
- `Session`
- `TrialSession`
- `TrialConfig`
- `PushSubscription`
- `Advertisement`
- `MacRule`
- `AdminLog`
- `SessionLog`

### 3. Buat tabel RADIUS via raw SQL
Tabel RADIUS (`radcheck`, `radreply`, `radacct`, `radusergroup`) tidak di-manage Prisma karena milik FreeRADIUS. Buat file `prisma/radius-tables.sql` berisi DDL standar FreeRADIUS.

### 4. Buat lib/db.ts
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
```

### 5. Buat seed data awal
File `prisma/seed.ts` berisi:
- Super admin default (email: admin@fadiljaya.com, password: hashed)
- Satu lokasi contoh
- Tiga paket contoh (voucher 10GB/7hari, langganan 30hari unlimited, paket malam)
- Konfigurasi trial default

### 6. Jalankan migration
```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 7. Jalankan radius-tables.sql
```bash
mysql -u root -p fadiljaya_net < prisma/radius-tables.sql
```

## File yang Akan Dibuat/Diubah
```
wifi-management/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   ├── radius-tables.sql
│   └── migrations/
└── src/
    └── lib/
        └── db.ts
```

## Definition of Done
- [ ] `prisma/schema.prisma` berisi semua model
- [ ] `npx prisma migrate dev` berhasil tanpa error
- [ ] `npx prisma db seed` berhasil
- [ ] Semua tabel RADIUS berhasil dibuat via SQL
- [ ] `npx prisma studio` bisa dibuka dan semua tabel terlihat
- [ ] `lib/db.ts` bisa diimport tanpa error
