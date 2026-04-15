# Fase 13 — Web Push Notification & Cron Jobs

## Sebelum Mulai
Baca `CLAUDE.md` terlebih dahulu. Pastikan fase 12 sudah selesai.

## Context7
use context7 untuk:
- web-push — VAPID setup, sendNotification
- node-cron — schedule, cron syntax

## Status
- [x] Fase 01-12 selesai
- [ ] Fase ini: Web Push Notification + semua Cron Jobs

## Yang Harus Dikerjakan

### 1. Install dependencies
```bash
npm install web-push node-cron
npm install -D @types/web-push @types/node-cron
```

### 2. Generate VAPID keys (sekali saja)
```bash
npx web-push generate-vapid-keys
# Simpan hasilnya ke .env
```

### 3. Buat lib/push.ts

```typescript
import webpush from 'web-push'

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

// Kirim notifikasi ke satu subscription
export async function sendPush(subscription: PushSubscription, payload: {
  title: string
  body: string
  url?: string
})

// Kirim notifikasi ke semua admin
export async function notifyAllAdmins(payload: NotificationPayload)

// Kirim notifikasi ke user tertentu
export async function notifyUser(userId: string, payload: NotificationPayload)
```

### 4. API Subscribe/Unsubscribe Push

**Endpoint:** `POST /api/push/subscribe`
- Simpan subscription token ke tabel `push_subscriptions`
- Tersedia untuk user (portal) dan admin

**Endpoint:** `DELETE /api/push/unsubscribe`
- Hapus subscription dari database

### 5. Komponen ServiceWorker untuk Web Push

Buat `public/sw.js` — Service Worker untuk handle push event:
```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json()
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon.png',
    data: { url: data.url }
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  clients.openWindow(event.notification.data.url)
})
```

### 6. Buat lib/cron.ts — Semua Cron Jobs

```typescript
import cron from 'node-cron'

// Job 1: Reset trial sessions setiap tengah malam
cron.schedule('0 0 * * *', async () => {
  await db.trialSession.deleteMany({
    where: { used_at: { lt: startOfToday() } }
  })
})

// Job 2: Cek kuota threshold setiap 15 menit
// Kirim Web Push jika kuota user ≤ 20% atau ≤ 10%
cron.schedule('*/15 * * * *', async () => {
  // Query subscriber dengan kuota hampir habis
  // Kirim notifikasi yang belum pernah dikirim untuk threshold ini
})

// Job 3: Cek status router setiap 5 menit
// Ping semua router, notifikasi admin jika offline
cron.schedule('*/5 * * * *', async () => {
  const locations = await db.location.findMany({ where: { is_active: true } })
  for (const loc of locations) {
    const isOnline = await pingRouter(loc.mikrotik_ip)
    if (!isOnline) {
      await notifyAllAdmins({
        title: 'Router Offline',
        body: `Router di ${loc.name} tidak dapat dijangkau`,
        url: '/admin/monitoring'
      })
    }
  }
})

// Job 4: Laporan harian ke admin setiap jam 07.00
cron.schedule('0 7 * * *', async () => {
  // Hitung revenue kemarin, user aktif, voucher terjual
  // Kirim ringkasan ke semua admin via Web Push
})

// Job 5: Cek expired user/voucher setiap jam
cron.schedule('0 * * * *', async () => {
  // Update status subscriber dan voucher yang sudah expired
  await db.subscriber.updateMany({
    where: { expired_at: { lt: new Date() }, status: 'active' },
    data: { status: 'expired' }
  })
  await db.voucher.updateMany({
    where: { expired_at: { lt: new Date() }, status: 'active' },
    data: { status: 'expired' }
  })
})
```

### 7. Inisialisasi cron jobs di Next.js

Buat `src/lib/cronInit.ts` yang dipanggil saat server start:
```typescript
// Pastikan cron hanya berjalan di server, bukan di browser
if (typeof window === 'undefined') {
  import('./cron').then(({ initCronJobs }) => initCronJobs())
}
```

### 8. Notifikasi trigger admin
Tambahkan trigger notifikasi di:
- Saat ada percobaan sharing account (dari FreeRADIUS reject)
- Saat voucher di-generate (opsional, bisa dikonfigurasi)

## File yang Akan Dibuat
```
src/
├── lib/
│   ├── push.ts
│   ├── cron.ts
│   └── cronInit.ts
├── app/api/push/
│   ├── subscribe/route.ts
│   └── unsubscribe/route.ts
└── public/
    └── sw.js
```

## Definition of Done
- [ ] VAPID keys tersimpan di .env
- [ ] Subscribe Web Push berfungsi di browser (minta izin notifikasi)
- [ ] Subscription token tersimpan di database
- [ ] Test kirim notifikasi dari panel admin settings berhasil sampai ke browser
- [ ] Notifikasi muncul meski halaman sudah ditutup (via Service Worker)
- [ ] Semua 5 cron job berjalan sesuai jadwal
- [ ] Reset trial berfungsi setiap tengah malam
- [ ] Notifikasi kuota threshold terkirim ke user yang tepat
- [ ] Notifikasi router offline terkirim ke semua admin
- [ ] Expired checker update status dengan benar
