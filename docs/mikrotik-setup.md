# Konfigurasi MikroTik — FadilJaya.NET

Panduan setup RouterOS untuk integrasi dengan sistem WiFi Management.
Jalankan semua perintah di terminal MikroTik (SSH atau Winbox → Terminal).

---

## Informasi Sistem

| Item | Nilai |
|------|-------|
| MikroTik Model | CRS112-8P-8S+IN, RouterOS 7 |
| IP WAN MikroTik (NAT) | `180.244.34.46` |
| IP VPS | `148.230.97.75` |
| RADIUS Secret | isi dari `RADIUS_SECRET` di `.env` (contoh: `iyung123`) |
| API Key | isi dari `MIKROTIK_API_KEY` di `.env` |
| Portal URL | `https://wifi.fadiljaya.com` |
| API URL | `https://wifiapi.fadiljaya.com` |
| Hotspot Gateway | `192.168.100.1` |
| Hotspot Pool | `192.168.100.10–192.168.100.254` |

> **Penting:** IP WAN MikroTik yang dipakai untuk RADIUS adalah IP NAT keluar (`180.244.34.46`),
> bukan IP interface WAN fisik. Pastikan nilai ini di `freeradius/config/clients.conf`.

---

## 1. RADIUS Client

```routeros
/radius
add address=148.230.97.75 secret=iyung123 \
    service=hotspot timeout=3s authentication-port=1812 \
    accounting-port=1813
```

Verifikasi:
```routeros
/radius print
# Columns: SERVICE, ADDRESS, SECRET
# 0 hotspot  148.230.97.75  iyung123
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
    html-directory=flash/hotspot \
    nas-port-type=wireless-802.11
```

Konfigurasi aktual yang dikonfirmasi benar:
```
name="fadiljaya"
login-by=http-chap,http-pap
use-radius=yes
radius-accounting=yes
radius-interim-update=received
nas-port-type=wireless-802.11
html-directory=flash/hotspot
```

---

## 4. Hotspot Interface

```routeros
/ip hotspot
add name=hotspot1 interface=bridge-hotspot address-pool=hotspot-pool \
    profile=fadiljaya
```

---

## 5. Login Page (flash/hotspot/login.html)

File ini harus menggunakan **`<meta http-equiv="refresh">`**, bukan JavaScript.
Android captive portal browser menonaktifkan JavaScript sehingga `window.location.href` tidak jalan.

Isi `flash/hotspot/login.html`:

```html
<!DOCTYPE html>
<html>
<head>
<meta http-equiv="refresh" content="0;url=https://wifi.fadiljaya.com/portal/login?mac=$(mac-esc)&ip=$(ip-esc)&link-orig=$(link-orig-esc)&link-login=$(link-login-only-esc)">
<script>window.location.href="https://wifi.fadiljaya.com/portal/login?mac=$(mac-esc)&ip=$(ip-esc)&link-orig=$(link-orig-esc)&link-login=$(link-login-only-esc)";</script>
</head>
<body></body>
</html>
```

Upload via **Winbox → Files → drag-drop** ke folder `flash/hotspot/`, overwrite file lama.

Untuk melihat isi file dari terminal:
```routeros
:put [/file get [/file find name="flash/hotspot/login.html"] content]
```

---

## 6. Walled Garden — Akses Portal Tanpa Login

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

## 7. User Profile Bandwidth Default

Profil ini dipakai saat RADIUS tidak mengembalikan bandwidth attribute:

```routeros
/ip hotspot user profile
add name=default rate-limit=1M/1M
```

---

## 8. Script Trial — Kirim MAC ke API saat User Konek

```routeros
/system script
add name=trial-check source={
  :local mac [/ip hotspot active get [find where address=$"user-address"] mac-address]
  :local nasIp [/ip address get [find where interface=bridge-hotspot] address]
  :set nasIp [:pick $nasIp 0 [:find $nasIp "/"]]

  /tool fetch url=("https://wifiapi.fadiljaya.com/api/mikrotik/trial/check") \
    http-method=post \
    http-header-field="X-Api-Key: YOUR_API_KEY,Content-Type: application/json" \
    http-data=("{\"mac_address\":\"" . $mac . "\",\"nas_ip\":\"" . $nasIp . "\"}") \
    output=none
}

/ip hotspot profile
set fadiljaya on-login=trial-check
```

---

## 9. Quota Update Berkala (setiap 15 menit)

```routeros
/system script
add name=quota-update source={
  :foreach entry in=[/ip hotspot active find] do={
    :local username [/ip hotspot active get $entry user]
    :local bytesIn  [/ip hotspot active get $entry bytes-in]
    :local mbUsed   ($bytesIn / 1048576)
    :local nasIp    [/ip address get [find where interface=bridge-hotspot] address]
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
/radius print
/ip hotspot print
/ip hotspot profile print
/ip hotspot active print
/log print where topics~"hotspot"
/log print where topics~"radius"
```

---

## FreeRADIUS — clients.conf

File: `freeradius/config/clients.conf`

```
client localhost {
    ipaddr      = 127.0.0.1
    secret      = testing123
    shortname   = localhost
    nas_type    = other
}

client docker_internal {
    ipaddr      = 172.16.0.0/12
    secret      = ${RADIUS_SECRET}
    shortname   = docker_internal
    nas_type    = other
}

client mikrotik_fadiljaya {
    ipaddr     = 180.244.34.46
    secret     = ${RADIUS_SECRET}
    shortname  = fadiljaya
    nas_type   = mikrotik
}
```

> **Penting:** IP di sini adalah IP NAT keluar MikroTik (`180.244.34.46`), bukan IP WAN fisik.
> Untuk mengetahui IP aktual, jalankan `tcpdump -i any -n udp port 1812` di VPS
> saat login dilakukan dari hotspot.

---

## Masalah & Solusi (Troubleshooting)

### 1. Browser redirect ke login page setelah voucher aktif

**Gejala:** Voucher berhasil diaktifkan (muncul animasi sukses), tapi browser kembali ke halaman login dan tidak dapat internet.

**Penyebab:** Ada dua kemungkinan:

**A. Android captive portal browser menonaktifkan JavaScript**
- Login.html menggunakan `window.location.href` (JS) untuk redirect ke portal
- Android mini-browser untuk captive portal sering disable JS
- Parameter `mac` dan `link-login` tidak ikut dikirim ke portal
- Portal tidak tahu harus redirect ke mana setelah aktivasi

**Solusi:** Ganti login.html pakai `<meta http-equiv="refresh">` (lihat bagian 5 di atas).

**B. IP MikroTik di clients.conf salah**
- FreeRADIUS hanya menerima paket dari IP yang terdaftar di clients.conf
- Jika IP salah, FreeRADIUS diam-diam drop semua request tanpa log apapun
- MikroTik timeout menunggu RADIUS response → reject → redirect balik ke login

**Solusi:** Cari IP aktual dengan `tcpdump -i any -n udp port 1812` di VPS, lalu update clients.conf.

---

### 2. FreeRADIUS tidak log apapun walau container jalan

**Gejala:** `docker logs fadiljaya-radius` tidak menampilkan request masuk.

**Diagnosa:**
```bash
# Cek apakah paket RADIUS sampai ke VPS
tcpdump -i any -n udp port 1812 -c 5
# (lakukan login dari hotspot saat tcpdump jalan)

# Cek log di dalam container
docker exec fadiljaya-radius cat /var/log/freeradius/radius.log | tail -20
```

Jika log menampilkan `Ignoring request from unknown client X.X.X.X`, berarti IP tersebut belum terdaftar di clients.conf.

---

### 3. FreeRADIUS return Access-Reject walau user ada di radcheck

**Gejala:** Log menampilkan Access-Reject.

**Penyebab umum:**
- `sql_user_name` tidak di-set → SQL query pakai `SQL-User-Name` yang kosong
- `users` file ada baris `DEFAULT Auth-Type := Reject` yang reject semua user
- File config kustom (`radiusd.conf`, `filter_username`, dll.) dengan syntax salah

**Solusi:**
- Pastikan `mods-available/sql` ada `sql_user_name = "%{User-Name}"`
- Hapus file `users`, `huntgroups`, `hints` dari konfigurasi kustom
- Jangan override `radiusd.conf` — biarkan base image yang handle

---

### 4. Voucher input terhapus sendiri di mobile

**Gejala:** Saat mengetik kode voucher di HP, huruf terhapus sendiri.

**Penyebab:** Input tidak punya atribut `autoCapitalize="characters"` dan `autoCorrect="off"` yang mencegah keyboard prediktif menimpa input.

**Solusi:** Tambahkan ke `<input>`:
```html
autoComplete="off"
autoCorrect="off"
autoCapitalize="characters"
spellCheck={false}
```

---

### 5. Konfigurasi FreeRADIUS path salah

**Gejala:** Container jalan tapi konfigurasi tidak terbaca.

**Penyebab:** Dockerfile COPY ke path yang salah (`/etc/freeradius/3.0/` vs `/etc/freeradius/`).

FreeRADIUS di image `freeradius/freeradius-server:latest` membaca dari `/etc/freeradius/`, bukan `/etc/freeradius/3.0/`.

---

## Checklist Akhir

- [ ] DNS A record `wifi`, `netadmin`, `wifiapi` → `148.230.97.75` sudah propagasi
- [ ] SSL aktif (`https://`)
- [ ] RADIUS client terdaftar di MikroTik (address=148.230.97.75)
- [ ] `use-radius=yes` di hotspot profile `fadiljaya`
- [ ] `login.html` pakai `<meta http-equiv="refresh">` (bukan hanya JS)
- [ ] `clients.conf` menggunakan IP NAT aktual MikroTik (`180.244.34.46`)
- [ ] Port 1812/1813 UDP terbuka di VPS (exposed di docker-compose)
- [ ] Walled garden dikonfigurasi untuk wifi.fadiljaya.com
- [ ] User konek WiFi → browser redirect ke portal login dengan params `mac=` dan `link-login=`
- [ ] Aktivasi voucher → animasi sukses → dapat internet
- [ ] IP MikroTik sudah ditambahkan ke nginx.conf (wifiapi whitelist)
- [ ] `YOUR_API_KEY` di script RouterOS sudah diganti dengan nilai dari `.env`
