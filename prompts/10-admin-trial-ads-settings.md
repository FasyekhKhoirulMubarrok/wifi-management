# Fase 10 — Modul Trial, Iklan, MAC Rules & Pengaturan

## Sebelum Mulai
Baca `CLAUDE.md` terlebih dahulu. Pastikan fase 09 sudah selesai.

## Context7
use context7 untuk:
- next.js — file upload, form handling
- prisma — CRUD operations

## Status
- [x] Fase 01-09 selesai
- [ ] Fase ini: Modul Trial + Iklan + MAC Rules + Pengaturan

## Yang Harus Dikerjakan

### Modul 8 — Manajemen Trial

**Halaman trial** (`/admin/trial`):
- Tab: "Konfigurasi" | "Log Trial Hari Ini" | "Statistik Konversi"

**Tab Konfigurasi:**
- Tabel per lokasi: durasi (menit), kecepatan (Kbps), status aktif/nonaktif
- Edit inline per lokasi
- Default: 5 menit, 1024 Kbps, aktif

**Tab Log Trial Hari Ini:**
- Tabel: MAC address, lokasi, waktu mulai, waktu selesai
- Auto-refresh setiap 60 detik
- Total trial hari ini

**Tab Statistik Konversi:**
- Berapa MAC address yang trial kemudian menjadi user berbayar
- Persentase konversi per lokasi per periode
- Grafik tren konversi bulanan

**API routes:**
- `GET /api/admin/trial/config` — konfigurasi per lokasi
- `PUT /api/admin/trial/config/[locationId]` — update konfigurasi
- `GET /api/admin/trial/logs` — log trial hari ini
- `GET /api/admin/trial/stats` — statistik konversi

---

### Modul 10 — Manajemen Iklan

**Halaman iklan** (`/admin/advertisements`):
- Tabel iklan: judul, lokasi, jadwal, status, impressions, clicks, CTR
- Tombol tambah, edit, hapus, toggle aktif

**Halaman tambah/edit iklan** (`/admin/advertisements/[id]`):
- Form: judul, deskripsi (maks 100 karakter), upload gambar, link tujuan
- Pilih lokasi (semua atau spesifik)
- Set tanggal mulai dan selesai
- Set prioritas (angka, semakin kecil semakin prioritas)
- Preview tampilan iklan sebelum simpan

**Upload gambar:**
- Simpan di folder `public/uploads/ads/`
- Validasi: hanya JPG/PNG, maks 2MB
- Auto-resize ke ukuran optimal

**API routes:**
- `GET /api/admin/advertisements` — list iklan
- `POST /api/admin/advertisements` — tambah iklan (dengan file upload)
- `PUT /api/admin/advertisements/[id]` — edit iklan
- `DELETE /api/admin/advertisements/[id]` — hapus iklan
- `PATCH /api/admin/advertisements/[id]/toggle` — aktif/nonaktif
- `POST /api/admin/advertisements/[id]/impression` — catat impression
- `POST /api/admin/advertisements/[id]/click` — catat click

---

### Modul 11 — Whitelist & Blacklist MAC

**Halaman MAC rules** (`/admin/mac-rules`):
- Tab: "Whitelist" | "Blacklist"
- Tabel per tab: MAC address, keterangan, lokasi, tanggal ditambah, oleh admin siapa
- Tombol tambah, hapus

**Form tambah MAC rule:**
- Input MAC address (dengan validasi format XX:XX:XX:XX:XX:XX)
- Pilih tipe: whitelist atau blacklist
- Pilih lokasi (semua atau spesifik)
- Input keterangan (nama perangkat/pemilik)

**API routes:**
- `GET /api/admin/mac-rules` — list semua rules
- `POST /api/admin/mac-rules` — tambah rule
- `DELETE /api/admin/mac-rules/[id]` — hapus rule

---

### Modul 9 — Pengaturan Sistem *(super admin only)*

**Halaman pengaturan** (`/admin/settings`):

Section:
1. **Informasi Aplikasi** — nama brand, logo (upload)
2. **Konfigurasi RADIUS** — port, secret key per router (read-only display)
3. **Web Push** — VAPID public key (display), tombol test kirim notifikasi
4. **Cron Jobs** — tabel semua cron job dan status terakhir berjalan
5. **Backup Database** — tombol backup manual, download backup

**API routes:**
- `GET /api/admin/settings` — get semua settings
- `PUT /api/admin/settings` — update settings
- `GET /api/admin/settings/cron-status` — status semua cron job
- `POST /api/admin/settings/backup` — trigger backup database

## File yang Akan Dibuat
```
src/app/(admin)/
├── trial/
│   └── page.tsx
├── advertisements/
│   ├── page.tsx
│   └── [id]/page.tsx
├── mac-rules/
│   └── page.tsx
└── settings/
    └── page.tsx
```

## Definition of Done
- [ ] Konfigurasi trial per lokasi bisa diubah dan tersimpan
- [ ] Log trial hari ini tampil dan auto-refresh
- [ ] Statistik konversi trial ke berbayar tampil dengan benar
- [ ] CRUD iklan berfungsi dengan upload gambar
- [ ] Impressions dan clicks tercatat saat iklan ditampilkan/diklik
- [ ] Whitelist dan blacklist MAC berfungsi
- [ ] Halaman pengaturan menampilkan konfigurasi sistem
- [ ] Status cron job tampil di pengaturan
