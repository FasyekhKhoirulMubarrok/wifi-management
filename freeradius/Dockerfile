FROM freeradius/freeradius-server:latest

# Install mysql-client untuk health check (mysqladmin ping)
RUN apt-get update && apt-get install -y --no-install-recommends \
        default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy konfigurasi kustom (timpa bawaan image)
COPY config/ /etc/freeradius/

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Pastikan owner benar (FreeRADIUS jalan sebagai freerad)
RUN chown -R freerad:freerad /etc/freeradius/ \
    && chmod 640 /etc/freeradius/clients.conf

EXPOSE 1812/udp 1813/udp

ENTRYPOINT ["/docker-entrypoint.sh"]
