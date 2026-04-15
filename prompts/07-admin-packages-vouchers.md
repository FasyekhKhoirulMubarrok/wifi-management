# Fase 07 — Modul Paket & Voucher

## Sebelum Mulai
Baca `CLAUDE.md` terlebih dahulu. Pastikan fase 06 sudah selesai.

## Context7
use context7 untuk:
- next.js — server actions, dynamic routes
- prisma — query dengan filter dan relasi
- qrcode — generate QR code base64

## Status
- [x] Fase 01-06 selesai
- [ ] Fase ini: Modul Paket + Modul Voucher

## Yang Harus Dikerjakan

### Modul 4 — Manajemen Paket

**Halaman list paket** (`/admin/packages`):
- Tabel: nama, harga, kuota, waktu, kecepatan, tipe, lokasi, status
- Filter berdasarkan tipe (voucher/langganan) dan lokasi
- Toggle aktif/nonaktif per paket
- Tombol tambah, edit, hapus

**Halaman tambah/edit paket** (`/admin/packages/[id]`):
- Form lengkap sesuai field tabel `packages` di CLAUDE.md
- Field kuota — input angka + checkbox "Unlimited"
- Field waktu — input angka + checkbox "Unlimited"
- Field jadwal aktif (schedule_start, schedule_end) — untuk paket waktu tertentu
- Preview ringkasan paket sebelum simpan

**API routes:**
- `GET /api/admin/packages` — list paket
- `POST /api/admin/packages` — tambah paket
- `PUT /api/admin/packages/[id]` — edit paket
- `DELETE /api/admin/packages/[id]` — hapus paket
- `PATCH /api/admin/packages/[id]/toggle` — aktif/nonaktif

---

### Modul 5A — Manajemen Voucher

**Halaman voucher** (`/admin/vouchers`):
- Tab: "Daftar Voucher" | "Generate Voucher"
- Filter: status (unused/active/expired), paket, lokasi, tanggal

**Tab Daftar Voucher:**
- Tabel: kode, paket, lokasi, status, dipakai oleh (MAC), tanggal pakai, expired
- Tombol lihat QR (popup modal dengan QR code besar)
- Tombol download QR sebagai PNG
- Checkbox multi-select untuk print massal

**Tab Generate Voucher:**
- Pilih paket
- Input jumlah voucher (1-100)
- Pilih lokasi (opsional)
- Tombol Generate
- Setelah generate: tampil tabel hasil + tombol Print Semua

**Fitur Print Voucher:**
- Generate halaman print dengan kartu voucher format A4
- Setiap kartu berisi: logo FadilJaya.NET, QR code, kode teks, nama paket, harga
- Format kartu sesuai CLAUDE.md section 7 Modul 5
- CSS print-friendly (`@media print`)

**Generate kode voucher:**
```typescript
// lib/voucher.ts
import crypto from 'crypto'

export function generateVoucherCode(): string {
  const part = () => crypto.randomBytes(2).toString('hex').toUpperCase()
  return `${part()}-${part()}-${part()}`
  // Contoh: A3F2-9B1C-4E7D
}
```

**Generate QR code:**
```typescript
import QRCode from 'qrcode'

export async function generateQR(code: string): Promise<string> {
  return QRCode.toDataURL(code, { width: 200, margin: 2 })
}
```

**API routes:**
- `GET /api/admin/vouchers` — list voucher dengan filter
- `POST /api/admin/vouchers/generate` — generate batch voucher
- `GET /api/admin/vouchers/[id]/qr` — get QR code base64
- `GET /api/admin/vouchers/print` — data untuk halaman print

## File yang Akan Dibuat
```
src/
├── app/(admin)/
│   ├── packages/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   └── vouchers/
│       ├── page.tsx
│       └── print/page.tsx
└── lib/
    └── voucher.ts
```

## Definition of Done
- [ ] CRUD paket berfungsi dengan semua field
- [ ] Paket waktu tertentu bisa diset jadwal aktifnya
- [ ] Generate voucher batch berhasil buat kode unik
- [ ] QR code tampil di popup dan bisa di-download
- [ ] Print massal menghasilkan halaman siap cetak
- [ ] Format kartu voucher sesuai spesifikasi CLAUDE.md
- [ ] Filter voucher berdasarkan status, paket, lokasi berfungsi
