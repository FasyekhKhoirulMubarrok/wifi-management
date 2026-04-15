# Fase 05 — Layout Admin & Dashboard

## Sebelum Mulai
Baca `CLAUDE.md` terlebih dahulu. Pastikan fase 04 sudah selesai.

## Context7
use context7 untuk:
- next.js — App Router layout, server components, client components
- tailwindcss — utility classes, responsive design
- recharts — chart library untuk grafik dashboard

## Status
- [x] Fase 01-04 selesai
- [ ] Fase ini: Layout admin panel + halaman dashboard

## Yang Harus Dikerjakan

### 1. Install dependencies
```bash
npm install recharts lucide-react
```

### 2. Buat layout admin (app/(admin)/layout.tsx)
Komponen layout dengan:
- Sidebar navigasi kiri — logo FadilJaya.NET, menu 12 modul dengan icon
- Header atas — nama admin yang login, role, tombol logout, bell notifikasi
- Main content area
- Responsive — sidebar collapse di mobile
- Role-based menu — super_admin lihat semua menu, admin_lokasi lihat menu terbatas

**Menu sidebar:**
1. Dashboard
2. Lokasi *(super admin only)*
3. Manajemen Admin *(super admin only)*
4. Paket
5. Voucher & User
6. Monitoring
7. Laporan
8. Trial
9. Iklan
10. MAC Rules
11. Perbandingan Lokasi
12. Pengaturan *(super admin only)*

### 3. Buat halaman dashboard (app/(admin)/dashboard/page.tsx)

**Untuk super admin — tampilkan:**
- Row metric cards: total user aktif semua lokasi, revenue hari ini, total lokasi, total voucher aktif
- Grafik pendapatan 30 hari terakhir (line chart, Recharts)
- Grafik user aktif per lokasi (bar chart, Recharts)
- Tabel lokasi dengan status online/offline router
- Alert list — router offline, user kuota hampir habis

**Untuk admin lokasi — tampilkan:**
- Data lokasi sendiri saja
- Metric cards: user aktif lokasi ini, revenue lokasi hari ini, voucher aktif
- Grafik pendapatan lokasi 30 hari
- Daftar user online saat ini di lokasi

### 4. Buat API untuk data dashboard
- `GET /api/admin/dashboard/stats` — metric cards
- `GET /api/admin/dashboard/revenue-chart` — data grafik pendapatan
- `GET /api/admin/dashboard/active-users` — user aktif per lokasi
- `GET /api/admin/dashboard/alerts` — alert list

### 5. Buat komponen reusable
- `MetricCard` — card angka statistik
- `StatusBadge` — badge online/offline/active/expired
- `PageHeader` — header halaman dengan judul dan breadcrumb
- `LoadingSkeleton` — loading state

## File yang Akan Dibuat
```
src/
├── app/
│   └── (admin)/
│       ├── layout.tsx
│       └── dashboard/
│           └── page.tsx
├── components/
│   ├── admin/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── MetricCard.tsx
│   └── ui/
│       ├── StatusBadge.tsx
│       ├── PageHeader.tsx
│       └── LoadingSkeleton.tsx
└── app/
    └── api/
        └── admin/
            └── dashboard/
                ├── stats/route.ts
                ├── revenue-chart/route.ts
                ├── active-users/route.ts
                └── alerts/route.ts
```

## Definition of Done
- [ ] Layout admin tampil dengan sidebar dan header
- [ ] Navigasi sidebar berfungsi
- [ ] Role-based menu bekerja — admin_lokasi tidak lihat menu super admin
- [ ] Dashboard super admin menampilkan data semua lokasi
- [ ] Dashboard admin lokasi hanya menampilkan data lokasi sendiri
- [ ] Grafik pendapatan dan user aktif tampil dengan data dari database
- [ ] Tampilan modern, bersih, dan profesional dengan Tailwind CSS
- [ ] Responsive di mobile
