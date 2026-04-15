# Fase 11 — Halaman Portal User

## Sebelum Mulai
Baca `CLAUDE.md` terlebih dahulu. Pastikan fase 10 sudah selesai.

## Context7
use context7 untuk:
- next.js — App Router, redirect, cookies
- html5-qrcode — scan QR dari kamera browser
- tailwindcss — styling halaman user yang mobile-friendly

## Status
- [x] Fase 01-10 selesai
- [ ] Fase ini: Semua halaman portal user

## Yang Harus Dikerjakan

### 1. Install dependencies
```bash
npm install html5-qrcode
```

### 2. Layout portal user (app/(portal)/layout.tsx)
- Minimal, tidak ada sidebar
- Background bersih
- Meta viewport mobile-friendly
- Nama brand FadilJaya.NET di header

### 3. Halaman Login (`/portal/login`)

**Dua tab:**

**Tab 1 — Login Akun (Langganan):**
- Input username
- Input password
- Tombol login
- Pesan error jika gagal

**Tab 2 — Voucher:**
- 3 field input kode: `[XXXX] - [XXXX] - [XXXX]`
- Auto-fokus pindah ke field berikutnya setelah 4 karakter
- Tombol "Scan QR" — buka kamera browser via html5-qrcode
- Scan QR otomatis mengisi ketiga field sekaligus
- Tombol aktivasi voucher

**Logika setelah login/aktivasi voucher berhasil:**
- Simpan JWT ke cookie
- Redirect ke `/portal/status`

**Cek MAC rules sebelum tampilkan halaman login:**
- Jika MAC ada di blacklist → redirect ke `/portal/blocked`
- Jika MAC ada di whitelist → langsung izinkan tanpa login
- Jika MAC normal → tampilkan halaman login

### 4. Halaman Status (`/portal/status`)

Tampilan sesuai mockup di CLAUDE.md section 8:
- Header: FadilJaya.NET + nama lokasi + status online
- Avatar inisial + username + nama paket
- Metric cards: sisa kuota (GB) + sisa waktu
- Progress bar kuota:
  - Biru jika > 20%
  - Kuning jika ≤ 20%
  - Merah jika ≤ 10%
- Detail sesi: durasi (timer client-side real-time, update setiap detik), data terpakai sesi ini, kecepatan, MAC address
- **Banner iklan dinamis** — fetch iklan aktif untuk lokasi ini
  - Catat impression saat iklan tampil
  - Catat click saat iklan diklik
- **Banner notifikasi proaktif** — muncul otomatis jika kuota ≤ 20%:
  ```
  ⚠️ Kuota Anda tinggal [X]% 
  Segera hubungi admin untuk perpanjang
  [Hubungi Admin via WhatsApp]
  ```
- Tombol logout

**Tampilan berbeda berdasarkan tipe paket:**
- Kuota saja → tampilkan metric kuota, sembunyikan metric waktu
- Waktu saja → tampilkan metric waktu, sembunyikan metric kuota
- Kuota + waktu → tampilkan keduanya, highlight yang lebih kritis

### 5. Halaman Kuota/Waktu Habis (`/portal/expired`)

**Untuk user langganan:**
```
Kuota/Masa berlaku Anda telah habis
Hubungi admin untuk perpanjang paket Anda.
[Tombol: Hubungi Admin via WhatsApp]
```

**Untuk user voucher:**
```
Voucher Anda telah habis
Beli voucher baru dan masukkan kode di bawah:
[Form input kode voucher 3 field]
— atau —
[Tombol: Hubungi Admin via WhatsApp]
```

**Daftar paket tersedia** (fetch dari database, paket aktif untuk lokasi ini):
- Nama paket, kuota/waktu, harga
- Tampilkan sebagai card list

### 6. Halaman Blocked (`/portal/blocked`)
- Pesan: "Perangkat Anda telah diblokir dari jaringan ini"
- Instruksi: hubungi admin jika ada pertanyaan
- Tidak ada link atau tombol lain

### 7. API routes untuk portal
- `POST /api/portal/login` — login langganan
- `POST /api/portal/voucher/activate` — aktivasi voucher
- `GET /api/portal/status` — data status user aktif
- `GET /api/portal/ads` — iklan aktif untuk lokasi
- `POST /api/portal/ads/[id]/impression` — catat impression
- `POST /api/portal/ads/[id]/click` — catat click
- `GET /api/portal/packages` — daftar paket untuk halaman expired
- `POST /api/portal/logout` — logout user

## File yang Akan Dibuat
```
src/app/(portal)/
├── layout.tsx
├── login/
│   └── page.tsx
├── status/
│   └── page.tsx
├── expired/
│   └── page.tsx
└── blocked/
    └── page.tsx
```

## Definition of Done
- [ ] Login langganan berhasil dan redirect ke status
- [ ] Aktivasi voucher berhasil dan redirect ke status
- [ ] 3 field input voucher auto-fokus pindah setelah 4 karakter
- [ ] Scan QR berfungsi via kamera browser dan mengisi 3 field
- [ ] Halaman status menampilkan semua informasi dengan benar
- [ ] Timer durasi sesi berjalan real-time di client
- [ ] Progress bar berubah warna sesuai persentase kuota
- [ ] Tampilan menyesuaikan tipe paket (kuota/waktu/keduanya)
- [ ] Banner iklan tampil dan mencatat impressions + clicks
- [ ] Banner notifikasi proaktif muncul saat kuota ≤ 20%
- [ ] Halaman expired berbeda untuk langganan dan voucher
- [ ] MAC blacklist redirect ke halaman blocked
- [ ] Tampilan mobile-friendly
