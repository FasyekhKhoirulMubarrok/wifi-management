# Fase 12 — Sistem Trial & Manajemen Kuota

## Sebelum Mulai
Baca `CLAUDE.md` terlebih dahulu. Pastikan fase 11 sudah selesai.

## Context7
use context7 untuk:
- next.js — API routes, middleware
- prisma — transaction, FOR UPDATE locking

## Status
- [x] Fase 01-11 selesai
- [ ] Fase ini: Sistem trial + API kuota untuk MikroTik

## Yang Harus Dikerjakan

### 1. API Trial untuk MikroTik

**Endpoint:** `POST /api/mikrotik/trial/check`

Header wajib:
- `x-api-key: [INTERNAL_API_KEY]`
- `x-forwarded-for: [IP MikroTik]`

Request body:
```json
{ "mac": "A4:C3:F0:12:3B:7E", "location_id": 1 }
```

Logika (urutan WAJIB):
1. Validasi API key + whitelist IP
2. Cek MAC di blacklist → return `{ allowed: false, reason: "blocked" }`
3. Cek MAC di whitelist → return `{ allowed: true, type: "whitelist" }`
4. Cek apakah lokasi punya trial aktif
5. Cek `trial_sessions` — sudah trial hari ini di lokasi ini?
6. Sudah → return `{ allowed: false, reason: "already_used" }`
7. Belum → insert ke `trial_sessions` → return:
```json
{
  "allowed": true,
  "type": "trial",
  "duration_seconds": 300,
  "speed_kbps": 1024
}
```

### 2. API Quota Update untuk MikroTik

**Endpoint:** `POST /api/mikrotik/quota/update`

WAJIB menggunakan DB transaction dengan FOR UPDATE (lihat CLAUDE.md section 10):

```typescript
export async function POST(req: Request) {
  validateMikrotikRequest(req)
  
  const { username, mb_used, session_id } = await req.json()
  
  // WAJIB: gunakan transaction dengan row locking
  await db.$transaction(async (tx) => {
    // Lock baris user
    const user = await tx.$queryRaw`
      SELECT quota_used_mb, quota_limit_mb, expired_at 
      FROM subscribers 
      WHERE username = ${username} 
      FOR UPDATE
    `
    
    // Update kuota
    await tx.subscriber.update({
      where: { username },
      data: { quota_used_mb: { increment: mb_used } }
    })
    
    // Cek apakah kuota habis
    const newUsed = user.quota_used_mb + mb_used
    if (user.quota_limit_mb && newUsed >= user.quota_limit_mb) {
      // Trigger blokir via FreeRADIUS disconnect
      await triggerDisconnect(username)
    }
  })
}
```

### 3. API Session Reporting untuk MikroTik

**Endpoint:** `POST /api/mikrotik/session/start`
- Catat awal sesi ke `session_logs`

**Endpoint:** `POST /api/mikrotik/session/stop`
- Update `session_logs` dengan waktu selesai, total data, terminate cause

### 4. API Cek Status User untuk MikroTik

**Endpoint:** `GET /api/mikrotik/user/status`
- Cek apakah user masih valid (tidak expired, tidak diblokir)
- MikroTik bisa polling endpoint ini untuk validasi berkala

### 5. lib/radius.ts — Helper RADIUS

```typescript
// Tambah user ke RADIUS
export async function addRadiusUser(username: string, password: string, profile: string)

// Hapus user dari RADIUS  
export async function removeRadiusUser(username: string)

// Update profil kecepatan user
export async function updateUserProfile(username: string, speedDown: number, speedUp: number)

// Disconnect paksa user via RADIUS CoA
export async function triggerDisconnect(username: string)

// Set kuota limit di radcheck
export async function setQuotaLimit(username: string, limitMb: number)
```

## File yang Akan Dibuat
```
src/
├── app/api/mikrotik/
│   ├── trial/
│   │   └── check/route.ts
│   ├── quota/
│   │   └── update/route.ts
│   ├── session/
│   │   ├── start/route.ts
│   │   └── stop/route.ts
│   └── user/
│       └── status/route.ts
└── lib/
    └── radius.ts
```

## Definition of Done
- [ ] Trial check API menjalankan urutan logika dengan benar (blacklist → whitelist → trial check)
- [ ] Trial session tersimpan di database
- [ ] Quota update menggunakan DB transaction dengan FOR UPDATE — tidak ada race condition
- [ ] Session start/stop mencatat ke session_logs
- [ ] Semua endpoint menolak request tanpa API key valid
- [ ] Semua endpoint menolak IP yang tidak di whitelist
- [ ] triggerDisconnect berfungsi memutus sesi user di FreeRADIUS
