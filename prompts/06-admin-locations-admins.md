# Fase 06 — Modul Lokasi & Manajemen Admin

## Sebelum Mulai
Baca `CLAUDE.md` terlebih dahulu. Pastikan fase 05 sudah selesai.

## Context7
use context7 untuk:
- next.js — server actions, form handling
- prisma — CRUD operations

## Status
- [x] Fase 01-05 selesai
- [ ] Fase ini: Modul Lokasi + Modul Manajemen Admin

## Yang Harus Dikerjakan

### Modul 2 — Manajemen Lokasi *(super admin only)*

**Halaman list lokasi** (`/admin/locations`):
- Tabel semua lokasi: nama, alamat, IP MikroTik, status online/offline, jumlah user aktif
- Status online/offline di-ping real-time dari server
- Tombol tambah, edit, hapus lokasi
- Tombol assign admin ke lokasi

**Halaman tambah/edit lokasi** (`/admin/locations/[id]`):
- Form: nama, alamat, IP MikroTik, username MikroTik, password MikroTik
- Test koneksi ke MikroTik — tombol "Test Koneksi" kirim ping ke IP MikroTik

**API routes:**
- `GET /api/admin/locations` — list semua lokasi
- `POST /api/admin/locations` — tambah lokasi
- `PUT /api/admin/locations/[id]` — edit lokasi
- `DELETE /api/admin/locations/[id]` — hapus lokasi
- `GET /api/admin/locations/[id]/ping` — ping MikroTik
- `POST /api/admin/locations/[id]/assign` — assign admin ke lokasi

---

### Modul 3 — Manajemen Admin

**Halaman list admin** (`/admin/admins`):
- Tabel semua admin: nama, email, role, lokasi yang di-assign, tanggal dibuat
- Tombol tambah, edit, hapus admin
- Filter berdasarkan role

**Halaman tambah/edit admin** (`/admin/admins/[id]`):
- Form: nama, email, password, role
- Jika role `admin_lokasi`: multi-select lokasi yang bisa diakses
- Jika edit: field password opsional (kosong = tidak ubah password)

**Halaman log aktivitas** (`/admin/admins/logs`):
- Tabel log: admin, aksi, deskripsi, IP, waktu
- Filter per admin dan per periode

**API routes:**
- `GET /api/admin/admins` — list semua admin
- `POST /api/admin/admins` — tambah admin
- `PUT /api/admin/admins/[id]` — edit admin
- `DELETE /api/admin/admins/[id]` — hapus admin
- `GET /api/admin/admins/logs` — log aktivitas

## File yang Akan Dibuat
```
src/app/(admin)/
├── locations/
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
└── admins/
    ├── page.tsx
    ├── [id]/
    │   └── page.tsx
    └── logs/
        └── page.tsx
```

## Definition of Done
- [ ] CRUD lokasi berfungsi lengkap
- [ ] Ping MikroTik bekerja dan menampilkan status
- [ ] CRUD admin berfungsi lengkap
- [ ] Assign admin ke lokasi berfungsi
- [ ] Admin lokasi tidak bisa akses halaman ini
- [ ] Log aktivitas tercatat setiap aksi admin
