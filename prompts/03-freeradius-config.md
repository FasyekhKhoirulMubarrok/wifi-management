# Fase 03 — Konfigurasi FreeRADIUS

## Sebelum Mulai
Baca `CLAUDE.md` terlebih dahulu. Pastikan fase 02 sudah selesai dan database sudah siap.

## Context7
use context7 untuk:
- freeradius — rlm_sql mysql configuration, simultaneous_use, authorize, accounting

## Status
- [x] Fase 01: Docker + struktur project selesai
- [x] Fase 02: Database schema selesai
- [ ] Fase ini: Konfigurasi FreeRADIUS

## Yang Harus Dikerjakan

### 1. Buat konfigurasi FreeRADIUS di freeradius/config/

File yang perlu dibuat/dikonfigurasi:

**radiusd.conf** — konfigurasi utama FreeRADIUS

**mods-available/sql** — koneksi ke MySQL:
```
sql {
  dialect = "mysql"
  driver = "rlm_sql_mysql"
  server = "mysql"           # nama container Docker
  port = 3306
  login = "${MYSQL_USER}"
  password = "${MYSQL_PASSWORD}"
  radius_db = "fadiljaya_net"
  
  # Tabel standar
  authcheck_table = "radcheck"
  authreply_table = "radreply"
  groupcheck_table = "radgroupcheck"
  groupreply_table = "radgroupreply"
  usergroup_table = "radusergroup"
  acct_table1 = "radacct"
  acct_table2 = "radacct"
}
```

**mods-available/attr_filter** — filter attribute

**sites-available/default** — authorize, authenticate, accounting pipeline:
- Aktifkan modul sql
- Aktifkan simultaneous_use = 1
- Reject dengan pesan jika concurrent login terdeteksi

**sites-available/inner-tunnel** — untuk PEAP/TTLS jika diperlukan

### 2. Konfigurasi clients.conf
Tambahkan setiap MikroTik sebagai RADIUS client:
```
client mikrotik_lokasi_a {
  ipaddr = 192.168.1.1      # IP MikroTik lokasi A
  secret = secret_key_here
  shortname = lokasi_a
}
```
Secret key diambil dari environment variable.

### 3. Konfigurasi simultaneous_use
```
# Di sites-available/default, bagian authorize:
simultaneous_use {
  reject_message = "Akun sedang digunakan di perangkat lain"
}
```

### 4. Aktifkan modul yang diperlukan
```bash
# Symlink mods-enabled
ln -s ../mods-available/sql mods-enabled/sql
ln -s ../mods-available/attr_filter mods-enabled/attr_filter

# Symlink sites-enabled
ln -s ../sites-available/default sites-enabled/default
```

### 5. Test konfigurasi FreeRADIUS
```bash
# Di dalam container FreeRADIUS
freeradius -X    # debug mode, pastikan tidak ada error
```

### 6. Test autentikasi
```bash
radtest username password localhost 0 secret_key
```

## File yang Akan Dibuat
```
wifi-management/
└── freeradius/
    └── config/
        ├── radiusd.conf
        ├── clients.conf
        ├── mods-available/
        │   ├── sql
        │   └── attr_filter
        ├── mods-enabled/
        │   ├── sql -> ../mods-available/sql
        │   └── attr_filter -> ../mods-available/attr_filter
        ├── sites-available/
        │   └── default
        └── sites-enabled/
            └── default -> ../sites-available/default
```

## Definition of Done
- [ ] FreeRADIUS container berjalan tanpa error
- [ ] `freeradius -X` tidak menampilkan error konfigurasi
- [ ] Koneksi ke MySQL berhasil dari FreeRADIUS
- [ ] Test `radtest` berhasil autentikasi user dari database
- [ ] Simultaneous_use bekerja — login kedua ditolak dengan pesan yang benar
- [ ] Accounting tercatat di tabel `radacct`
