#!/usr/bin/env bash
set -euo pipefail

EXPECTED_HOSTNAME="${EXPECTED_HOSTNAME:-atp}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_CADDYFILE="${SOURCE_CADDYFILE:-$ROOT_DIR/deploy/Caddyfile}"
CADDY_COMPOSE_FILE="${CADDY_COMPOSE_FILE:-$ROOT_DIR/docker-compose.caddy.yml}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"

usage() {
  cat <<EOF
Usage:
  ./scripts/production/deploy_production_caddy.sh

Environment overrides:
  EXPECTED_HOSTNAME  Hostname required for execution (default: atp)
  SOURCE_CADDYFILE   Shared Caddy config file (default: deploy/Caddyfile)
  CADDY_COMPOSE_FILE Docker Compose file that manages the shared public Caddy container (default: docker-compose.caddy.yml)
  ENV_FILE           Env file passed to docker compose (default: .env.production)
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

CURRENT_HOSTNAME="$(hostname -s 2>/dev/null || hostname)"
if [[ "$CURRENT_HOSTNAME" != "$EXPECTED_HOSTNAME" ]]; then
  echo "Refusing to deploy production Caddy on host '$CURRENT_HOSTNAME'." >&2
  echo "Expected host: '$EXPECTED_HOSTNAME'." >&2
  exit 1
fi

if [[ ! -f "$SOURCE_CADDYFILE" ]]; then
  echo "Missing source Caddyfile: $SOURCE_CADDYFILE" >&2
  exit 1
fi

if [[ ! -f "$CADDY_COMPOSE_FILE" ]]; then
  echo "Missing Caddy compose file: $CADDY_COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
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

docker compose --env-file "$ENV_FILE" -f "$CADDY_COMPOSE_FILE" up -d caddy
echo "Shared public Caddy reloaded on $CURRENT_HOSTNAME using $CADDY_COMPOSE_FILE."
