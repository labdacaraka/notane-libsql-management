#!/usr/bin/env bash
set -euo pipefail

VERSION="v0.24.25"
BASE_URL="https://github.com/tursodatabase/libsql/releases/download/libsql-server-${VERSION}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BIN_DIR="${ROOT_DIR}/binaries"

mkdir -p "${BIN_DIR}"

download_target() {
  local target="$1"
  local file="sqld-${target}"
  local archive="libsql-server-${target}.tar.xz"
  local url="${BASE_URL}/${archive}"

  echo "==> Downloading ${target} from ${url}..."
  local tmp_dir
  tmp_dir="$(mktemp -d)"

  if ! curl -fsSL "${url}" -o "${tmp_dir}/${archive}"; then
    echo "Warning: Failed to download ${url}"
    rm -rf "${tmp_dir}"
    return 1
  fi

  tar -xJf "${tmp_dir}/${archive}" -C "${tmp_dir}"
  local sqld_found
  sqld_found="$(find "${tmp_dir}" -type f -name sqld | head -n 1)"

  if [ -n "${sqld_found}" ] && [ -f "${sqld_found}" ]; then
    mv "${sqld_found}" "${BIN_DIR}/${file}"
    chmod +x "${BIN_DIR}/${file}"
    echo "Successfully saved ${BIN_DIR}/${file}"
  else
    echo "Error: sqld binary not found in extracted archive for ${target}"
    rm -rf "${tmp_dir}"
    return 1
  fi

  rm -rf "${tmp_dir}"
}

REQUESTED="${1:-auto}"

case "${REQUESTED}" in
  all)
    echo "Downloading all official sqld platform binaries..."
    download_target "x86_64-apple-darwin" || true
    download_target "aarch64-apple-darwin" || true
    download_target "x86_64-unknown-linux-gnu" || true
    download_target "aarch64-unknown-linux-gnu" || true
    ;;
  x86_64-apple-darwin|aarch64-apple-darwin|x86_64-unknown-linux-gnu|aarch64-unknown-linux-gnu)
    download_target "${REQUESTED}"
    ;;
  auto)
    OS="$(uname -s)"
    ARCH="$(uname -m)"
    case "${OS}" in
      Darwin)
        if [ "${ARCH}" = "arm64" ]; then
          TARGET="aarch64-apple-darwin"
        else
          TARGET="x86_64-apple-darwin"
        fi
        ;;
      Linux)
        if [ "${ARCH}" = "aarch64" ]; then
          TARGET="aarch64-unknown-linux-gnu"
        else
          TARGET="x86_64-unknown-linux-gnu"
        fi
        ;;
      *)
        echo "No prebuilt sqld binary for OS: ${OS}. Skipping bundled binary."
        exit 0
        ;;
    esac
    download_target "${TARGET}"
    ;;
  *)
    echo "Usage: $0 [auto | all | <target>]"
    echo "Supported targets:"
    echo "  - x86_64-apple-darwin"
    echo "  - aarch64-apple-darwin"
    echo "  - x86_64-unknown-linux-gnu"
    echo "  - aarch64-unknown-linux-gnu"
    exit 1
    ;;
esac

echo "Binaries directory status:"
ls -lh "${BIN_DIR}"
