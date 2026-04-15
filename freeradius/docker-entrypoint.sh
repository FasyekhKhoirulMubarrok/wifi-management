#!/bin/sh
##############################################################################
# FadilJaya.NET — FreeRADIUS Docker Entrypoint
# Membuat symlink mods-enabled dan sites-enabled sebelum memulai freeradius.
##############################################################################
set -e

CONFDIR="/etc/freeradius/3.0"

# ──────────────────────────────────────────────────────────────────
# Substitusi environment variable di clients.conf
# FreeRADIUS tidak expand ${VAR} dari env otomatis.
# ──────────────────────────────────────────────────────────────────
if [ -n "${RADIUS_SECRET}" ]; then
    sed -i "s|\${RADIUS_SECRET}|${RADIUS_SECRET}|g" "${CONFDIR}/clients.conf"
fi

if [ -n "${MYSQL_USER}" ]; then
    sed -i "s|\${MYSQL_USER}|${MYSQL_USER}|g" "${CONFDIR}/mods-available/sql"
fi

if [ -n "${MYSQL_PASSWORD}" ]; then
    sed -i "s|\${MYSQL_PASSWORD}|${MYSQL_PASSWORD}|g" "${CONFDIR}/mods-available/sql"
fi

# ──────────────────────────────────────────────────────────────────
# Symlink mods-enabled
# ──────────────────────────────────────────────────────────────────
echo "[entrypoint] Membuat symlink mods-enabled..."
mkdir -p "${CONFDIR}/mods-enabled"

for mod in sql attr_filter pap chap mschap eap \
           preprocess acct_unique suffix files \
           detail expiration logintime always \
           expr exec filter_username; do
    src="${CONFDIR}/mods-available/${mod}"
    dst="${CONFDIR}/mods-enabled/${mod}"
    if [ -f "${src}" ] && [ ! -e "${dst}" ]; then
        ln -sf "${src}" "${dst}"
        echo "  linked: mods-enabled/${mod}"
    fi
done

# ──────────────────────────────────────────────────────────────────
# Symlink sites-enabled
# ──────────────────────────────────────────────────────────────────
echo "[entrypoint] Membuat symlink sites-enabled..."
mkdir -p "${CONFDIR}/sites-enabled"

for site in default inner-tunnel; do
    src="${CONFDIR}/sites-available/${site}"
    dst="${CONFDIR}/sites-enabled/${site}"
    if [ -f "${src}" ] && [ ! -e "${dst}" ]; then
        ln -sf "${src}" "${dst}"
        echo "  linked: sites-enabled/${site}"
    fi
done

# Hapus symlink bawaan Docker image yang tidak kita pakai
for f in "${CONFDIR}/sites-enabled/inner-tunnel.disable" \
         "${CONFDIR}/sites-enabled/status.disable"; do
    [ -L "${f}" ] || [ -e "${f}" ] && rm -f "${f}" 2>/dev/null || true
done

# ──────────────────────────────────────────────────────────────────
# Tunggu MySQL siap (maksimal 60 detik)
# ──────────────────────────────────────────────────────────────────
echo "[entrypoint] Menunggu MySQL siap..."
i=0
until mysqladmin ping -h mysql -u "${MYSQL_USER}" -p"${MYSQL_PASSWORD}" --silent 2>/dev/null; do
    i=$((i + 1))
    if [ $i -ge 30 ]; then
        echo "[entrypoint] ERROR: MySQL tidak siap setelah 60 detik"
        exit 1
    fi
    echo "  MySQL belum siap, tunggu 2 detik... ($i/30)"
    sleep 2
done
echo "[entrypoint] MySQL siap."

echo "[entrypoint] Konfigurasi selesai. Memulai FreeRADIUS..."
exec freeradius -f "$@"
