# Fase 14 — Nginx, SSL & Konfigurasi MikroTik

## Sebelum Mulai
Baca `CLAUDE.md` terlebih dahulu. Pastikan fase 13 sudah selesai.

## Context7
use context7 untuk:
- nginx — reverse proxy, SSL, upstream
- certbot — let's encrypt, nginx plugin

## Status
- [x] Fase 01-13 selesai
- [ ] Fase ini: Nginx final config + SSL + konfigurasi MikroTik

## Yang Harus Dikerjakan

### 1. Konfigurasi Nginx final (nginx/nginx.conf)

```nginx
events { worker_connections 1024; }

http {
  upstream nextjs {
    server nextjs:3000;
  }

  # netadmin.fadiljaya.com → Panel Admin
  server {
    listen 80;
    server_name netadmin.fadiljaya.com;
    
    location / {
      proxy_pass http://nextjs;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
  }

  # wifi.fadiljaya.com → Portal User
  server {
    listen 80;
    server_name wifi.fadiljaya.com;
    
    location / {
      proxy_pass http://nextjs;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
  }

  # wifiapi.fadiljaya.com → API Internal
  server {
    listen 80;
    server_name wifiapi.fadiljaya.com;
    
    # Hanya izinkan IP MikroTik dan localhost
    # IP lain langsung 403
    location / {
      proxy_pass http://nextjs;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
  }
}
```

### 2. Setup DNS di Hostinger
Tambahkan 3 A record di panel DNS Hostinger:
```
netadmin  A  148.230.97.75
wifi      A  148.230.97.75
wifiapi   A  148.230.97.75
```
Tunggu propagasi DNS (biasanya 5-30 menit).

### 3. Install Certbot dan Setup SSL
```bash
# Di VPS (bukan di dalam Docker)
apt install certbot python3-certbot-nginx

# Stop nginx container sementara
docker stop fadiljaya-nginx

# Generate certificate untuk ketiga subdomain
certbot certonly --standalone \
  -d netadmin.fadiljaya.com \
  -d wifi.fadiljaya.com \
  -d wifiapi.fadiljaya.com

# Mount certificate ke container nginx
# Tambahkan di docker-compose.yml:
# volumes:
#   - /etc/letsencrypt:/etc/letsencrypt:ro
```

### 4. Update nginx.conf untuk HTTPS

Tambahkan blok SSL untuk setiap server:
```nginx
server {
  listen 443 ssl;
  server_name netadmin.fadiljaya.com;
  
  ssl_certificate /etc/letsencrypt/live/netadmin.fadiljaya.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/netadmin.fadiljaya.com/privkey.pem;
  
  # Redirect HTTP ke HTTPS
  ...
}

server {
  listen 80;
  server_name netadmin.fadiljaya.com;
  return 301 https://$host$request_uri;
}
```

### 5. Auto-renewal SSL
```bash
# Crontab untuk auto-renewal
crontab -e
# Tambahkan:
0 0 1 * * certbot renew --quiet && docker restart fadiljaya-nginx
```

### 6. Konfigurasi MikroTik (RouterOS commands)

Buat file dokumentasi `docs/mikrotik-setup.md` berisi perintah RouterOS:

**Setup RADIUS client:**
```routeros
/radius
add address=148.230.97.75 secret=YOUR_SECRET service=hotspot timeout=3s
```

**Setup Hotspot dengan RADIUS:**
```routeros
/ip hotspot profile
set default login-by=http-chap,http-pap use-radius=yes

/ip hotspot
add interface=bridge name=hotspot1 address-pool=hotspot-pool \
    profile=default
```

**Walled Garden — izinkan akses ke portal tanpa login:**
```routeros
/ip hotspot walled-garden
add dst-host=wifi.fadiljaya.com
add dst-host=wifiapi.fadiljaya.com
```

**Redirect ke portal saat user belum login:**
```routeros
/ip hotspot profile
set default login-url=https://wifi.fadiljaya.com/portal/login
```

**Konfigurasi API call ke sistem (opsional, untuk trial):**
Script RouterOS yang berjalan saat user konek untuk kirim MAC ke API trial.

### 7. Test end-to-end lengkap

Checklist pengujian:
1. User konek WiFi → redirect ke wifi.fadiljaya.com/portal/login
2. Trial berjalan 5 menit → redirect ke halaman login
3. Login dengan voucher → halaman status muncul
4. Login dengan akun langganan → halaman status muncul
5. Kuota habis → redirect ke halaman expired
6. Panel admin dapat diakses di netadmin.fadiljaya.com
7. SSL aktif di semua subdomain (https://)
8. API endpoint menolak request tanpa API key

## File yang Akan Dibuat/Diubah
```
wifi-management/
├── nginx/
│   └── nginx.conf          ← update ke versi final dengan SSL
└── docs/
    └── mikrotik-setup.md   ← panduan konfigurasi MikroTik
```

## Definition of Done
- [ ] Ketiga subdomain bisa diakses via browser
- [ ] SSL aktif (https://) di semua subdomain
- [ ] HTTP otomatis redirect ke HTTPS
- [ ] Panel admin terbuka di netadmin.fadiljaya.com
- [ ] Portal user terbuka di wifi.fadiljaya.com
- [ ] API menolak request tidak valid di wifiapi.fadiljaya.com
- [ ] Auto-renewal SSL terkonfigurasi
- [ ] Dokumentasi konfigurasi MikroTik lengkap
- [ ] Test end-to-end semua alur utama berhasil
