#!/usr/bin/env bash
set -euo pipefail

EXPECTED_HOSTNAME="${EXPECTED_HOSTNAME:-atp}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CADDY_ROOT="${CADDY_ROOT:-/srv/asiatravelplan-public}"
SOURCE_CADDYFILE="${SOURCE_CADDYFILE:-$ROOT_DIR/deploy-config/Caddyfile}"
SOURCE_CADDY_COMPOSE_FILE="${SOURCE_CADDY_COMPOSE_FILE:-$ROOT_DIR/docker-compose.caddy.yml}"
CADDY_COMPOSE_FILE="${CADDY_COMPOSE_FILE:-$CADDY_ROOT/docker-compose.caddy.yml}"
RUNTIME_CADDYFILE="${RUNTIME_CADDYFILE:-$CADDY_ROOT/deploy-config/Caddyfile}"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
CADDY_PROJECT_NAME="${CADDY_PROJECT_NAME:-asiatravelplan-public}"

source "$ROOT_DIR/scripts/lib/docker_runtime.sh"

usage() {
  cat <<EOF
Usage:
  ./scripts/production/deploy_production_caddy.sh

Environment overrides:
  EXPECTED_HOSTNAME       Hostname required for execution (default: atp)
  CADDY_ROOT              Runtime root for the shared public Caddy stack (default: /srv/asiatravelplan-public)
  SOURCE_CADDYFILE        Source Caddy config file in the checkout (default: deploy-config/Caddyfile)
  SOURCE_CADDY_COMPOSE_FILE Source compose file in the checkout (default: docker-compose.caddy.yml)
  CADDY_COMPOSE_FILE      Runtime compose file path (default: /srv/asiatravelplan-public/docker-compose.caddy.yml)
  RUNTIME_CADDYFILE       Runtime Caddyfile path (default: /srv/asiatravelplan-public/deploy-config/Caddyfile)
  ENV_FILE                Env file passed to docker compose (default: .env)
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

if [[ ! -f "$SOURCE_CADDY_COMPOSE_FILE" ]]; then
  echo "Missing source Caddy compose file: $SOURCE_CADDY_COMPOSE_FILE" >&2
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

mkdir -p "$(dirname "$RUNTIME_CADDYFILE")"
cp "$SOURCE_CADDYFILE" "$RUNTIME_CADDYFILE"
cp "$SOURCE_CADDY_COMPOSE_FILE" "$CADDY_COMPOSE_FILE"

docker run --rm \
  -v "$RUNTIME_CADDYFILE:/etc/caddy/Caddyfile:ro" \
  caddy:2 \
  caddy validate --config /etc/caddy/Caddyfile

docker_compose -p "$CADDY_PROJECT_NAME" --env-file "$ENV_FILE" -f "$CADDY_COMPOSE_FILE" up -d caddy
docker_compose -p "$CADDY_PROJECT_NAME" --env-file "$ENV_FILE" -f "$CADDY_COMPOSE_FILE" exec -T caddy \
  caddy reload --config /etc/caddy/Caddyfile
echo "Shared public Caddy reloaded on $CURRENT_HOSTNAME using runtime root $CADDY_ROOT (project: $CADDY_PROJECT_NAME)."
