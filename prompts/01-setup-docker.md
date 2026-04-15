# Fase 01 — Setup Docker & Struktur Project

## Sebelum Mulai
Baca `CLAUDE.md` terlebih dahulu untuk memahami konteks penuh sistem.

## Context7
use context7 untuk:
- docker — docker-compose v2 syntax
- next.js — project initialization, App Router structure

## Status
- [ ] Fase ini: Setup Docker + struktur folder project

## Yang Harus Dikerjakan

### 1. Buat docker-compose.yml
```yaml
services:
  nextjs:
    build: .
    container_name: fadiljaya-nextjs
    restart: unless-stopped
    ports:
      - "5000:3000"  # VPS port 5000 → container port 3000 (tidak konflik dengan Project A di 3000 dan Project B di 4000)
    depends_on:
      - mysql
    env_file:
      - .env
    networks:
      - fadiljaya-net

  freeradius:
    image: freeradius/freeradius-server:latest
    container_name: fadiljaya-radius
    restart: unless-stopped
    ports:
      - "1812:1812/udp"
      - "1813:1813/udp"
    volumes:
      - ./freeradius/config:/etc/freeradius/3.0
    depends_on:
      - mysql
    networks:
      - fadiljaya-net

  mysql:
    image: mysql:8
    container_name: fadiljaya-mysql
    restart: unless-stopped
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: fadiljaya_net
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    networks:
      - fadiljaya-net

  nginx:
    image: nginx:alpine
    container_name: fadiljaya-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/certs:/etc/nginx/certs
    depends_on:
      - nextjs
    networks:
      - fadiljaya-net

networks:
  fadiljaya-net:
    driver: bridge

volumes:
  mysql_data:
```

### 2. Buat Dockerfile untuk Next.js
- Multi-stage build (builder + runner)
- Node.js 22 Alpine
- Output standalone

### 3. Buat struktur folder lengkap sesuai CLAUDE.md section 15

### 4. Inisialisasi project Next.js 14+ dengan:
- TypeScript strict mode
- Tailwind CSS
- App Router
- ESLint

### 5. Buat file .env.example berdasarkan CLAUDE.md section 14

### 6. Buat .gitignore yang lengkap

### 7. Buat nginx/nginx.conf dasar
- Routing untuk netadmin.fadiljaya.com → port 5000
- Routing untuk wifi.fadiljaya.com → port 5000
- Routing untuk wifiapi.fadiljaya.com → port 5000
- Siapkan blok untuk SSL (akan diisi Certbot nanti)

## File yang Akan Dibuat
```
wifi-management/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .gitignore
├── nginx/
│   └── nginx.conf
├── freeradius/
│   └── config/           ← folder kosong, diisi fase 03
├── src/
│   └── app/
│       ├── (admin)/
│       ├── (portal)/
│       └── api/
└── package.json
```

## Definition of Done
- [ ] `docker-compose.yml` valid dan bisa di-parse
- [ ] `Dockerfile` bisa build tanpa error
- [ ] Struktur folder sesuai CLAUDE.md section 15
- [ ] Next.js project berhasil diinisialisasi
- [ ] `npm run dev` berjalan tanpa error
- [ ] `.env.example` berisi semua variable dari CLAUDE.md section 14
