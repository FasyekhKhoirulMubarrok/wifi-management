# Fase 04 — Sistem Autentikasi & Keamanan

## Sebelum Mulai
Baca `CLAUDE.md` terlebih dahulu. Pastikan fase 01-03 sudah selesai.

## Context7
use context7 untuk:
- next.js — middleware, App Router, API routes
- jsonwebtoken — JWT sign, verify
- bcryptjs — password hashing

## Status
- [x] Fase 01-03 selesai
- [ ] Fase ini: Auth system (JWT, middleware, API key)

## Yang Harus Dikerjakan

### 1. Install dependencies
```bash
npm install jsonwebtoken bcryptjs
npm install -D @types/jsonwebtoken @types/bcryptjs
```

### 2. Buat lib/jwt.ts
Helper untuk sign dan verify JWT, termasuk:
- `signToken(payload)` — buat JWT baru
- `verifyToken(token)` — verify dan decode JWT
- `createSession(userId, userType, mac?)` — buat session di database
- `validateSession(token)` — cross-check token ke database (WAJIB, lihat CLAUDE.md section 10)

### 3. Buat lib/auth.ts
- `hashPassword(password)` — hash dengan bcrypt
- `comparePassword(password, hash)` — verify password
- `getCurrentAdmin(token)` — get admin dari session
- `checkAdminAccess(adminId, locationId)` — validasi role-based access

### 4. Buat middleware.ts di root src/
Proteksi route berdasarkan path:
- `/admin/*` → wajib JWT admin valid
- `/portal/status` → wajib JWT user valid
- `/api/mikrotik/*` → wajib API key + whitelist IP (lihat CLAUDE.md section 10)
- `/api/admin/*` → wajib JWT admin valid
- `/portal/login` → public
- `/portal/expired` → public

### 5. Buat API routes autentikasi admin
- `POST /api/auth/admin/login` — login admin, return JWT
- `POST /api/auth/admin/logout` — hapus session dari database
- `GET /api/auth/admin/me` — get current admin info

### 6. Buat API routes autentikasi user
- `POST /api/auth/user/login` — login langganan, return JWT
- `POST /api/auth/user/voucher` — aktivasi voucher, return JWT
- `POST /api/auth/user/logout` — hapus session

### 7. Buat middleware validasi API key untuk MikroTik
```typescript
// lib/apiKeyMiddleware.ts
export function validateMikrotikRequest(req: Request) {
  const clientIP = req.headers.get('x-forwarded-for')
  const apiKey = req.headers.get('x-api-key')
  
  const allowedIPs = process.env.ALLOWED_MIKROTIK_IPS?.split(',') ?? []
  
  if (!allowedIPs.includes(clientIP ?? '')) {
    throw new Error('IP not allowed')
  }
  
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    throw new Error('Invalid API key')
  }
}
```

### 8. Buat halaman login admin
- Path: `/admin/login`
- Form email + password
- Redirect ke `/admin/dashboard` setelah berhasil
- Tampilan modern dengan Tailwind CSS

## File yang Akan Dibuat
```
src/
├── middleware.ts
├── lib/
│   ├── jwt.ts
│   ├── auth.ts
│   └── apiKeyMiddleware.ts
└── app/
    ├── (admin)/
    │   └── login/
    │       └── page.tsx
    └── api/
        └── auth/
            ├── admin/
            │   ├── login/route.ts
            │   ├── logout/route.ts
            │   └── me/route.ts
            └── user/
                ├── login/route.ts
                ├── voucher/route.ts
                └── logout/route.ts
```

## Definition of Done
- [ ] Login admin berhasil dan return JWT yang valid
- [ ] Session tersimpan di tabel `sessions` database
- [ ] Setiap request ke `/admin/*` tanpa token → redirect ke login
- [ ] Token expired → redirect ke login
- [ ] API key validation bekerja untuk endpoint MikroTik
- [ ] Role-based access — admin_lokasi tidak bisa akses data lokasi lain
- [ ] Password di-hash dengan bcrypt sebelum disimpan
- [ ] Logout menghapus session dari database
