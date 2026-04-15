# Fase 09 — Modul Laporan & Perbandingan Lokasi

## Sebelum Mulai
Baca `CLAUDE.md` terlebih dahulu. Pastikan fase 08 sudah selesai.

## Context7
use context7 untuk:
- next.js — server components, searchParams
- prisma — aggregasi, groupBy, date filtering
- recharts — chart untuk laporan
- exceljs — export Excel
- jspdf — export PDF

## Status
- [x] Fase 01-08 selesai
- [ ] Fase ini: Modul Laporan + Modul Perbandingan Lokasi

## Yang Harus Dikerjakan

### 1. Install dependencies
```bash
npm install exceljs jspdf jspdf-autotable
```

### Modul 7 — Laporan

**Halaman laporan** (`/admin/reports`):

Tab navigasi:
1. **Pendapatan** — revenue per periode, filter per lokasi
2. **Penggunaan Data** — GB terpakai per user, histori sesi
3. **User Aktif** — jumlah user aktif per lokasi per periode
4. **Voucher** — terjual, terpakai, expired per paket
5. **Session Log** — log login/logout per user

**Filter yang tersedia di semua tab:**
- Preset: Hari ini, Minggu ini, Bulan ini
- Custom range: date picker start - end
- Filter lokasi (super admin bisa pilih semua atau per lokasi)

**Tab Pendapatan:**
- Total revenue periode yang dipilih
- Breakdown per paket
- Grafik line chart revenue harian
- Tabel detail transaksi voucher dan langganan

**Tab Session Log:**
- Tabel: username, tipe (langganan/voucher), MAC address, IP, lokasi, data terpakai, durasi, login, logout
- Sortable per kolom
- Searchable per username

**Fitur Export:**
- Tombol "Export Excel" — download .xlsx
- Tombol "Export PDF" — download .pdf
- Export sesuai filter yang aktif saat ini

**lib/export.ts:**
```typescript
// Export Excel
export async function exportExcel(data: any[], filename: string)

// Export PDF
export async function exportPDF(data: any[], filename: string, title: string)
```

**API routes:**
- `GET /api/admin/reports/revenue` — data pendapatan
- `GET /api/admin/reports/data-usage` — penggunaan data per user
- `GET /api/admin/reports/active-users` — statistik user aktif
- `GET /api/admin/reports/vouchers` — statistik voucher
- `GET /api/admin/reports/session-logs` — session log
- `GET /api/admin/reports/export` — generate file export

---

### Modul 12 — Perbandingan Antar Lokasi

**Halaman perbandingan** (`/admin/comparison`):
- Hanya bisa diakses super admin
- Filter periode: mingguan, bulanan, custom range
- Tabel perbandingan semua lokasi secara berdampingan:

| Lokasi | Revenue | User Aktif | Data Terpakai | Voucher Terjual |
|--------|---------|------------|---------------|-----------------|
| Lokasi A | Rp 1.2jt | 15 | 45 GB | 23 |
| Lokasi B | Rp 800rb | 8 | 28 GB | 12 |
| Lokasi C | Rp 2.1jt | 22 | 67 GB | 41 |

- Bar chart perbandingan per metrik
- Highlight lokasi dengan performa tertinggi dan terendah
- Export Excel dan PDF

**API routes:**
- `GET /api/admin/comparison` — data perbandingan semua lokasi

## File yang Akan Dibuat
```
src/
├── app/(admin)/
│   ├── reports/
│   │   └── page.tsx
│   └── comparison/
│       └── page.tsx
└── lib/
    └── export.ts
```

## Definition of Done
- [ ] Semua 5 tab laporan menampilkan data yang benar
- [ ] Filter periode (preset + custom) berfungsi
- [ ] Filter lokasi berfungsi (super admin semua, admin lokasi hanya miliknya)
- [ ] Export Excel menghasilkan file .xlsx yang valid
- [ ] Export PDF menghasilkan file .pdf yang rapi
- [ ] Halaman perbandingan menampilkan semua lokasi berdampingan
- [ ] Chart perbandingan tampil dengan benar
- [ ] Admin lokasi tidak bisa akses halaman perbandingan
