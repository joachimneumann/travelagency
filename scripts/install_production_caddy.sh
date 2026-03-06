#!/usr/bin/env bash
set -euo pipefail

EXPECTED_HOSTNAME="${EXPECTED_HOSTNAME:-atp}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_CADDYFILE="${SOURCE_CADDYFILE:-$ROOT_DIR/deploy/Caddyfile}"
STAGING_ENV_FILE="${STAGING_ENV_FILE:-$ROOT_DIR/.env.staging}"
STAGING_COMPOSE_FILE="${STAGING_COMPOSE_FILE:-$ROOT_DIR/docker-compose.staging.yml}"
LEGACY_PRODUCTION_COMPOSE_FILE="${LEGACY_PRODUCTION_COMPOSE_FILE:-$ROOT_DIR/docker-compose.production-static.yml}"

usage() {
  cat <<EOF
Usage:
  ./scripts/install_production_caddy.sh

Environment overrides:
  EXPECTED_HOSTNAME  Hostname required for execution (default: atp)
  SOURCE_CADDYFILE   Shared Caddy config file (default: deploy/Caddyfile)
  STAGING_ENV_FILE   Env file for the shared staging/prod compose stack (default: .env.staging)
  STAGING_COMPOSE_FILE Docker Compose file for the shared staging/prod Caddy stack (default: docker-compose.staging.yml)
  LEGACY_PRODUCTION_COMPOSE_FILE Legacy standalone production compose file to stop if present (default: docker-compose.production-static.yml)
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

if [[ ! -f "$STAGING_ENV_FILE" ]]; then
  echo "Missing staging env file: $STAGING_ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$STAGING_COMPOSE_FILE" ]]; then
  echo "Missing staging compose file: $STAGING_COMPOSE_FILE" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required on this host." >&2
  exit 1
fi

docker run --rm \
  -v "$SOURCE_CADDYFILE:/etc/caddy/Caddyfile:ro" \
  caddy:2 \
  caddy validate --config /etc/caddy/Caddyfile

if [[ -f "$LEGACY_PRODUCTION_COMPOSE_FILE" ]]; then
  docker compose -f "$LEGACY_PRODUCTION_COMPOSE_FILE" down || true
fi

docker compose --env-file "$STAGING_ENV_FILE" -f "$STAGING_COMPOSE_FILE" up -d caddy
echo "Shared staging/production Caddy reloaded on $CURRENT_HOSTNAME using $STAGING_COMPOSE_FILE."
