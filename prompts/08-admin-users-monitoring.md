# Fase 08 — Modul User Langganan & Monitoring

## Sebelum Mulai
Baca `CLAUDE.md` terlebih dahulu. Pastikan fase 07 sudah selesai.

## Context7
use context7 untuk:
- next.js — server components, polling/refresh
- prisma — query dengan join dan aggregasi

## Status
- [x] Fase 01-07 selesai
- [ ] Fase ini: Modul User Langganan + Modul Monitoring

## Yang Harus Dikerjakan

### Modul 5B — Manajemen User Langganan

**Halaman list subscriber** (`/admin/users`):
- Tab: "Langganan" | "User Aktif Sekarang"
- Tabel langganan: username, nama, paket, lokasi, kuota terpakai/total, sisa waktu, status
- Filter: status (active/expired/blocked), paket, lokasi
- Tombol tambah, edit, perpanjang, reset kuota, putus koneksi, hapus

**Halaman tambah/edit subscriber** (`/admin/users/[id]`):
- Form: username, password, nama, pilih paket, pilih lokasi
- Tanggal aktivasi dan expired (auto-hitung dari paket)
- Edit: password opsional

**Tab User Aktif Sekarang:**
- Refresh otomatis setiap 30 detik
- Tabel: username, IP, MAC address, lokasi, durasi sesi, data terpakai sesi ini, sisa kuota
- Tombol "Putus Koneksi" — hapus session dari database + kirim disconnect ke FreeRADIUS/MikroTik

**Reset kuota:**
- Set `quota_used_mb = 0` di database
- Update di tabel `radcheck` juga

**API routes:**
- `GET /api/admin/users` — list subscriber
- `POST /api/admin/users` — tambah subscriber
- `PUT /api/admin/users/[id]` — edit subscriber
- `DELETE /api/admin/users/[id]` — hapus subscriber
- `POST /api/admin/users/[id]/reset-quota` — reset kuota
- `POST /api/admin/users/[id]/disconnect` — putus koneksi
- `GET /api/admin/users/active` — user aktif real-time

---

### Modul 6 — Monitoring Real-time

**Halaman monitoring** (`/admin/monitoring`):
- Auto-refresh setiap 15 detik (atau gunakan polling)
- Kartu status per lokasi: nama, status router (online/offline), jumlah user aktif, bandwidth usage
- Grafik bandwidth per lokasi (live, update setiap 30 detik)
- Tabel user online semua lokasi: username, IP, MAC, lokasi, durasi, data terpakai

**Ping router:**
```typescript
// lib/ping.ts
import { exec } from 'child_process'

export function pingRouter(ip: string): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`ping -c 1 -W 2 ${ip}`, (error) => {
      resolve(!error)
    })
  })
}
```

**API routes:**
- `GET /api/admin/monitoring/status` — status semua lokasi + router
- `GET /api/admin/monitoring/online-users` — user online semua lokasi
- `GET /api/admin/monitoring/bandwidth` — data bandwidth per lokasi

## File yang Akan Dibuat
```
src/
├── app/(admin)/
│   ├── users/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   └── monitoring/
│       └── page.tsx
└── lib/
    └── ping.ts
```

## Definition of Done
- [ ] CRUD subscriber berfungsi lengkap
- [ ] Reset kuota berhasil update database dan radcheck
- [ ] Putus koneksi berhasil hapus session
- [ ] Tab user aktif refresh setiap 30 detik
- [ ] Halaman monitoring menampilkan status router real-time
- [ ] Ping router bekerja dari dalam Docker container
- [ ] Grafik bandwidth update otomatis
