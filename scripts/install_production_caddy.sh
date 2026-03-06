#!/usr/bin/env bash
set -euo pipefail

EXPECTED_HOSTNAME="${EXPECTED_HOSTNAME:-atp}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_CADDYFILE="${SOURCE_CADDYFILE:-$ROOT_DIR/deploy/Caddyfile.production}"
TARGET_CADDYFILE="${TARGET_CADDYFILE:-/etc/caddy/Caddyfile}"
SERVICE_NAME="${SERVICE_NAME:-caddy}"
BACKUP_DIR="${BACKUP_DIR:-/etc/caddy/backups}"

usage() {
  cat <<EOF
Usage:
  ./scripts/install_production_caddy.sh

Environment overrides:
  EXPECTED_HOSTNAME  Hostname required for execution (default: atp)
  SOURCE_CADDYFILE   Source config file (default: deploy/Caddyfile.production)
  TARGET_CADDYFILE   Installed Caddyfile path (default: /etc/caddy/Caddyfile)
  SERVICE_NAME       Service name to reload (default: caddy)
  BACKUP_DIR         Backup directory for previous config (default: /etc/caddy/backups)
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

CURRENT_HOSTNAME="$(hostname -s 2>/dev/null || hostname)"
if [[ "$CURRENT_HOSTNAME" != "$EXPECTED_HOSTNAME" ]]; then
  echo "Refusing to install production Caddy config on host '$CURRENT_HOSTNAME'." >&2
  echo "Expected host: '$EXPECTED_HOSTNAME'." >&2
  exit 1
fi

if [[ ! -f "$SOURCE_CADDYFILE" ]]; then
  echo "Missing source Caddyfile: $SOURCE_CADDYFILE" >&2
  exit 1
fi

if ! command -v caddy >/dev/null 2>&1; then
  echo "caddy is not installed or not in PATH." >&2
  exit 1
fi

SUDO=""
if [[ "$(id -u)" -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "This script requires root or sudo to write $TARGET_CADDYFILE and reload Caddy." >&2
    exit 1
  fi
fi

TMP_CONFIG="$(mktemp "${TMPDIR:-/tmp}/Caddyfile.production.XXXXXX")"
cleanup() {
  rm -f "$TMP_CONFIG"
}
trap cleanup EXIT

cp "$SOURCE_CADDYFILE" "$TMP_CONFIG"
caddy validate --config "$TMP_CONFIG"

$SUDO mkdir -p "$BACKUP_DIR"
if [[ -f "$TARGET_CADDYFILE" ]]; then
  timestamp="$(date +%Y%m%d-%H%M%S)"
  $SUDO cp "$TARGET_CADDYFILE" "$BACKUP_DIR/Caddyfile.$timestamp"
fi

$SUDO cp "$TMP_CONFIG" "$TARGET_CADDYFILE"
$SUDO systemctl reload "$SERVICE_NAME"

echo "Installed $SOURCE_CADDYFILE to $TARGET_CADDYFILE and reloaded $SERVICE_NAME on $CURRENT_HOSTNAME."
