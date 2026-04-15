# Konfigurasi MikroTik — FadilJaya.NET

Panduan setup RouterOS untuk integrasi dengan sistem WiFi Management.
Jalankan semua perintah di terminal MikroTik (SSH atau Winbox → Terminal).

---

## Prasyarat

| Item | Nilai |
|------|-------|
| IP VPS | `148.230.97.75` |
| RADIUS Secret | isi dari `RADIUS_SECRET` di `.env` |
| API Key | isi dari `MIKROTIK_API_KEY` di `.env` |
| Portal URL | `https://wifi.fadiljaya.com` |
| API URL | `https://wifiapi.fadiljaya.com` |

> **Penting:** Tambahkan IP publik MikroTik tiap lokasi ke `nginx/nginx.conf` pada blok
> `# allow X.X.X.X;` di server block `wifiapi.fadiljaya.com`.

---

## 1. RADIUS Client

```routeros
/radius
add address=148.230.97.75 secret=YOUR_RADIUS_SECRET \
    service=hotspot timeout=3s authentication-port=1812 \
    accounting-port=1813
```

---

## 2. Address Pool

```routeros
/ip pool
add name=hotspot-pool ranges=192.168.100.10-192.168.100.254
```

---

## 3. Hotspot Profile

```routeros
/ip hotspot profile
add name=fadiljaya \
    login-by=http-chap,http-pap \
    use-radius=yes \
    radius-accounting=yes \
    login-url=https://wifi.fadiljaya.com/portal/login \
    nas-port-type=wireless-802.11
```

---

## 4. Hotspot Interface

Ganti `bridge` dengan interface yang menghadap ke user WiFi:

```routeros
/ip hotspot
add name=hotspot1 interface=bridge address-pool=hotspot-pool \
    profile=fadiljaya
```

---

## 5. Walled Garden — Akses Portal Tanpa Login

User yang belum login tetap bisa mengakses halaman portal dan API:

```routeros
/ip hotspot walled-garden
add dst-host=wifi.fadiljaya.com
add dst-host=wifiapi.fadiljaya.com

/ip hotspot walled-garden ip
add dst-address=148.230.97.75 dst-port=443 action=allow
add dst-address=148.230.97.75 dst-port=80  action=allow
```

---

## 6. User Profile Bandwidth Default

Profil ini dipakai saat RADIUS tidak mengembalikan bandwidth attribute:

```routeros
/ip hotspot user profile
add name=default rate-limit=1M/1M
```

---

## 7. Script Trial — Kirim MAC ke API saat User Konek

Buat script yang dipanggil otomatis saat user terkoneksi ke hotspot
(hotspot on-login script):

```routeros
/system script
add name=trial-check source={
  :local mac [/ip hotspot active get [find where address=$"user-address"] mac-address]
  :local nasIp [/ip address get [find where interface=bridge] address]
  :set nasIp [:pick $nasIp 0 [:find $nasIp "/"]]

  /tool fetch url=("https://wifiapi.fadiljaya.com/api/mikrotik/trial/check") \
    http-method=post \
    http-header-field="X-Api-Key: YOUR_API_KEY,Content-Type: application/json" \
    http-data=("{\"mac_address\":\"" . $mac . "\",\"nas_ip\":\"" . $nasIp . "\"}") \
    output=none
}
```

Daftarkan ke hotspot profile:

```routeros
/ip hotspot profile
set fadiljaya on-login=trial-check
```

---

## 8. Script Session Accounting (opsional — jika tidak pakai RADIUS accounting)

Jika RADIUS accounting tidak berjalan, gunakan script manual:

```routeros
# Session Start
/system script
add name=session-start source={
  :local username $"username"
  :local mac     $"mac-address"
  :local nasIp   [/ip address get [find where interface=bridge] address]
  :set nasIp [:pick $nasIp 0 [:find $nasIp "/"]]

  /tool fetch url="https://wifiapi.fadiljaya.com/api/mikrotik/session/start" \
    http-method=post \
    http-header-field="X-Api-Key: YOUR_API_KEY,Content-Type: application/json" \
    http-data=("{\"username\":\"" . $username . "\",\"nas_ip\":\"" . $nasIp . "\",\"mac_address\":\"" . $mac . "\"}") \
    output=none
}

# Session Stop
/system script
add name=session-stop source={
  :local username  $"username"
  :local nasIp     [/ip address get [find where interface=bridge] address]
  :set nasIp [:pick $nasIp 0 [:find $nasIp "/"]]
  :local bytesIn   $"bytes-in"
  :local bytesSec  1048576
  :local mbUsed    ($bytesIn / $bytesSec)

  /tool fetch url="https://wifiapi.fadiljaya.com/api/mikrotik/session/stop" \
    http-method=post \
    http-header-field="X-Api-Key: YOUR_API_KEY,Content-Type: application/json" \
    http-data=("{\"username\":\"" . $username . "\",\"nas_ip\":\"" . $nasIp . "\",\"data_used_mb\":" . $mbUsed . "}") \
    output=none
}
```

Daftarkan ke hotspot profile:

```routeros
/ip hotspot profile
set fadiljaya on-login=session-start on-logout=session-stop
```

---

## 9. Quota Update Berkala (setiap 15 menit)

Script RouterOS untuk melaporkan penggunaan data sementara
(agar database tetap up-to-date tanpa menunggu disconnect):

```routeros
/system script
add name=quota-update source={
  :foreach entry in=[/ip hotspot active find] do={
    :local username [/ip hotspot active get $entry user]
    :local bytesIn  [/ip hotspot active get $entry bytes-in]
    :local mbUsed   ($bytesIn / 1048576)
    :local nasIp    [/ip address get [find where interface=bridge] address]
    :set nasIp [:pick $nasIp 0 [:find $nasIp "/"]]

    /tool fetch url="https://wifiapi.fadiljaya.com/api/mikrotik/quota/update" \
      http-method=post \
      http-header-field="X-Api-Key: YOUR_API_KEY,Content-Type: application/json" \
      http-data=("{\"username\":\"" . $username . "\",\"mb_used\":" . $mbUsed . "}") \
      output=none
  }
}

/system scheduler
add name=quota-update interval=15m on-event=quota-update
```

---

## 10. Verifikasi

```routeros
# Cek RADIUS terhubung
/radius print

# Cek hotspot aktif
/ip hotspot print

# Cek user aktif
/ip hotspot active print

# Test koneksi ke API
/tool fetch url="https://wifiapi.fadiljaya.com/api/mikrotik/user/status?username=test" \
  http-header-field="X-Api-Key: YOUR_API_KEY" \
  output=user
:put $result
```

---

## Setup VPS — SSL dengan Let's Encrypt

Jalankan di VPS (bukan di dalam Docker):

```bash
# 1. Install certbot
apt update && apt install -y certbot

# 2. Buat webroot directory untuk renewal
mkdir -p /var/www/certbot

# 3. Jalankan nginx container dulu (HTTP only — belum ada cert)
#    Sementara pakai mode standalone: stop nginx dulu
docker stop fadiljaya-nginx

# 4. Generate certificate (standalone mode — sekali saja)
certbot certonly --standalone \
  -d netadmin.fadiljaya.com \
  -d wifi.fadiljaya.com \
  -d wifiapi.fadiljaya.com \
  --agree-tos \
  --email admin@fadiljaya.com \
  --non-interactive

# 5. Jalankan ulang nginx (sekarang cert sudah ada)
docker start fadiljaya-nginx

# 6. Setup auto-renewal (webroot mode — tidak perlu stop nginx)
echo "0 3 * * * root certbot renew --webroot -w /var/www/certbot --quiet && docker exec fadiljaya-nginx nginx -s reload" \
  > /etc/cron.d/certbot-renew
```

### Catatan Renewal

Saat renewal berjalan (webroot mode):
1. Certbot menulis file ke `/var/www/certbot/.well-known/acme-challenge/`
2. Nginx melayani file tersebut via lokasi `/.well-known/acme-challenge/` (sudah dikonfigurasi)
3. Let's Encrypt memverifikasi kepemilikan domain
4. Certbot memperbarui sertifikat di `/etc/letsencrypt/live/`
5. `nginx -s reload` memuat sertifikat baru tanpa downtime

---

## Checklist Akhir

- [ ] DNS A record `netadmin`, `wifi`, `wifiapi` → `148.230.97.75` sudah propagasi
- [ ] SSL aktif di ketiga subdomain (`https://`)
- [ ] HTTP redirect ke HTTPS berfungsi
- [ ] RADIUS client terdaftar di MikroTik
- [ ] Walled garden dikonfigurasi
- [ ] User konek WiFi → redirect ke `wifi.fadiljaya.com/portal/login`
- [ ] Login voucher → halaman status muncul dengan timer
- [ ] Login subscriber → halaman status muncul
- [ ] Kuota habis → redirect ke `/portal/expired`
- [ ] Panel admin `netadmin.fadiljaya.com/admin` dapat diakses
- [ ] IP MikroTik sudah ditambahkan ke `nginx.conf` (wifiapi whitelist)
- [ ] `YOUR_API_KEY` di script RouterOS sudah diganti dengan nilai dari `.env`
- [ ] `YOUR_RADIUS_SECRET` sudah diganti dengan nilai dari `.env`
