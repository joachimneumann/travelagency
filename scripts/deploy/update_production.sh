#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env"
PROJECT_NAME="${PROJECT_NAME:-asiatravelplan}"

source "$ROOT_DIR/scripts/lib/docker_runtime.sh"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/deploy/update_production.sh [backend|keycloak|all]...

Examples:
  ./scripts/deploy/update_production.sh backend
  ./scripts/deploy/update_production.sh keycloak
  ./scripts/deploy/update_production.sh all
EOF
}

should_run_tests() {
  local service
  for service in "$@"; do
    case "$service" in
      backend)
        return 0
        ;;
    esac
  done
  return 1
}

run_production_tests() {
  echo "Running production pre-deploy tests..."
  docker_compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build backend
  docker_compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps backend \
    node --test test/mobile-contract.test.js test/source-integrity.test.js test/http_routes.test.js
}

normalize_services() {
  if [[ "$#" -eq 0 ]]; then
    printf '%s\n' backend
    return
  fi

  for arg in "$@"; do
    case "$arg" in
      backend|keycloak)
        printf '%s\n' "$arg"
        ;;
      all)
        printf '%s\n' backend keycloak
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown service: $arg" >&2
        usage >&2
        exit 1
        ;;
    esac
  done | awk '!seen[$0]++'
}

generate_public_homepage_assets() {
  echo "Generating static homepage tours/team assets..."
  node "$ROOT_DIR/scripts/assets/generate_public_homepage_assets.mjs"
}

cd "$ROOT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$ENV_FILE is missing in $ROOT_DIR" >&2
  exit 1
fi

mapfile -t SERVICES < <(normalize_services "$@")

if should_run_tests "${SERVICES[@]}"; then
  run_production_tests
fi

generate_public_homepage_assets

mkdir -p backend/app/data backend/app/data/tmp content logs
if [[ ! -f backend/app/data/store.json ]]; then
  printf '{}\n' > backend/app/data/store.json
fi

docker_compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --force-recreate "${SERVICES[@]}"
