#!/usr/bin/env bash
set -euo pipefail

EXPECTED_HOSTNAME="${EXPECTED_HOSTNAME:-atp}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_CADDYFILE="${SOURCE_CADDYFILE:-$ROOT_DIR/deploy/Caddyfile.production}"
TARGET_CADDYFILE="${TARGET_CADDYFILE:-/etc/caddy/Caddyfile}"
SERVICE_NAME="${SERVICE_NAME:-caddy}"
BACKUP_DIR="${BACKUP_DIR:-/etc/caddy/backups}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.production-static.yml}"

usage() {
  cat <<EOF
Usage:
  ./scripts/install_production_caddy.sh

Environment overrides:
  EXPECTED_HOSTNAME  Hostname required for execution (default: atp)
  SOURCE_CADDYFILE   Source config file (default: deploy/Caddyfile.production)
  TARGET_CADDYFILE   Installed Caddyfile path for system Caddy (default: /etc/caddy/Caddyfile)
  SERVICE_NAME       Service name to reload for system Caddy (default: caddy)
  BACKUP_DIR         Backup directory for previous system config (default: /etc/caddy/backups)
  COMPOSE_FILE       Docker Compose file for containerized Caddy (default: docker-compose.production-static.yml)
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

run_system_caddy_install() {
  local sudo_cmd=""
  if [[ "$(id -u)" -ne 0 ]]; then
    if command -v sudo >/dev/null 2>&1; then
      sudo_cmd="sudo"
    else
      echo "This script requires root or sudo to write $TARGET_CADDYFILE and reload Caddy." >&2
      exit 1
    fi
  fi

  local tmp_config
  tmp_config="$(mktemp "${TMPDIR:-/tmp}/Caddyfile.production.XXXXXX")"
  trap 'rm -f "$tmp_config"' RETURN

  cp "$SOURCE_CADDYFILE" "$tmp_config"
  caddy validate --config "$tmp_config"

  $sudo_cmd mkdir -p "$BACKUP_DIR"
  if [[ -f "$TARGET_CADDYFILE" ]]; then
    local timestamp
    timestamp="$(date +%Y%m%d-%H%M%S)"
    $sudo_cmd cp "$TARGET_CADDYFILE" "$BACKUP_DIR/Caddyfile.$timestamp"
  fi

  $sudo_cmd cp "$tmp_config" "$TARGET_CADDYFILE"
  $sudo_cmd systemctl reload "$SERVICE_NAME"
  echo "Installed $SOURCE_CADDYFILE to $TARGET_CADDYFILE and reloaded $SERVICE_NAME on $CURRENT_HOSTNAME."
}

run_docker_caddy_install() {
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "Missing Docker Compose file: $COMPOSE_FILE" >&2
    exit 1
  fi

  docker run --rm \
    -v "$SOURCE_CADDYFILE:/etc/caddy/Caddyfile:ro" \
    caddy:2 \
    caddy validate --config /etc/caddy/Caddyfile

  docker compose -f "$COMPOSE_FILE" up -d caddy
  echo "Started/reloaded production Caddy via Docker Compose on $CURRENT_HOSTNAME using $COMPOSE_FILE."
}

if command -v caddy >/dev/null 2>&1; then
  run_system_caddy_install
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  run_docker_caddy_install
  exit 0
fi

echo "Neither system Caddy nor Docker is available on this host." >&2
exit 1
