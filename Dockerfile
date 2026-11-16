FROM ghcr.io/tursodatabase/sqld:v0.24.25

LABEL org.opencontainers.image.title="Notane LibSQL Server" \
      org.opencontainers.image.description="Self-hosted multi-tenant libSQL (sqld) server instance managed by Notane" \
      org.opencontainers.image.vendor="Notane" \
      org.opencontainers.image.version="0.24.25" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /var/lib/sqld

EXPOSE 8080 8082

ENV SQLD_NODE=primary \
    SQLD_HTTP_LISTEN_ADDR=0.0.0.0:8080 \
    SQLD_ADMIN_LISTEN_ADDR=0.0.0.0:8082 \
    SQLD_DB_PATH=/var/lib/sqld \
    SQLD_ENABLE_NAMESPACES=true

VOLUME ["/var/lib/sqld"]

ENTRYPOINT ["/bin/sqld"]
CMD ["--http-listen-addr", "0.0.0.0:8080", "--admin-listen-addr", "0.0.0.0:8082", "--db-path", "/var/lib/sqld", "--enable-namespaces"]
