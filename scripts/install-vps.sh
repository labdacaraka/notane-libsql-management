#!/usr/bin/env bash
# Notane LibSQL Server - VPS Non-Docker Installer
# Installs sqld as a managed systemd service on Linux VPS (Ubuntu / Debian / CentOS / Rocky)

set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (use sudo ./scripts/install-vps.sh)"
  exit 1
fi

VERSION="v0.24.25"
ARCH="$(uname -m)"

case "${ARCH}" in
  x86_64)
    TARGET="x86_64-unknown-linux-gnu"
    ;;
  aarch64|arm64)
    TARGET="aarch64-unknown-linux-gnu"
    ;;
  *)
    echo "Error: Unsupported CPU architecture: ${ARCH}"
    exit 1
    ;;
esac

echo "==> Detected architecture: ${TARGET}"
echo "==> Downloading sqld ${VERSION}..."

TMP_DIR="$(mktemp -d)"
ARCHIVE="libsql-server-${TARGET}.tar.xz"
URL="https://github.com/tursodatabase/libsql/releases/download/libsql-server-${VERSION}/${ARCHIVE}"

curl -fsSL "${URL}" -o "${TMP_DIR}/${ARCHIVE}"
tar -xJf "${TMP_DIR}/${ARCHIVE}" -C "${TMP_DIR}"

SQLD_BIN="$(find "${TMP_DIR}" -type f -name sqld | head -n 1)"
install -m 755 "${SQLD_BIN}" /usr/local/bin/sqld
rm -rf "${TMP_DIR}"

echo "==> sqld installed to /usr/local/bin/sqld ($(sqld --version || true))"

# Create dedicated service user and directory
if ! id -u sqld >/dev/null 2>&1; then
  useradd --system --shell /usr/sbin/nologin --home-dir /var/lib/sqld sqld
fi

mkdir -p /var/lib/sqld
chown -R sqld:sqld /var/lib/sqld
chmod 700 /var/lib/sqld

# Create systemd service
cat << 'EOF' > /etc/systemd/system/sqld.service
[Unit]
Description=Notane LibSQL Server (sqld)
After=network.target

[Service]
Type=simple
User=sqld
Group=sqld
WorkingDirectory=/var/lib/sqld
ExecStart=/usr/local/bin/sqld \
  --http-listen-addr 0.0.0.0:8080 \
  --admin-listen-addr 127.0.0.1:8082 \
  --db-path /var/lib/sqld \
  --enable-namespaces
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now sqld

echo ""
echo "=========================================================="
echo " Notane LibSQL Server successfully installed and started!"
echo " Status: systemctl status sqld"
echo " Logs:   journalctl -u sqld -f"
echo " HTTP Port (Clients): http://<VPS-IP>:8080"
echo " Admin Port (Local):  http://127.0.0.1:8082"
echo "=========================================================="
