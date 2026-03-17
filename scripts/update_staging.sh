#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="docker-compose.staging.yml"
ENV_FILE=".env.staging"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/update_staging.sh [backend|caddy|keycloak|all]...

Examples:
  ./scripts/update_staging.sh backend
  ./scripts/update_staging.sh keycloak
  ./scripts/update_staging.sh caddy
  ./scripts/update_staging.sh all
  ./scripts/update_staging.sh backend caddy
EOF
}

normalize_services() {
  if [[ "$#" -eq 0 ]]; then
    printf '%s\n' backend
    return
  fi

  for arg in "$@"; do
    case "$arg" in
      backend|caddy|keycloak)
        printf '%s\n' "$arg"
        ;;
      all)
        printf '%s\n' backend caddy keycloak
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

should_run_tests() {
  local service
  for service in "$@"; do
    case "$service" in
      backend|caddy)
        return 0
        ;;
    esac
  done
  return 1
}

run_staging_tests() {
  echo "Running staging pre-deploy tests..."
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps backend \
    sh -lc 'npm ci >/dev/null && node --test test/mobile-contract.test.js test/source-integrity.test.js'
}

cd "$ROOT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$ENV_FILE is missing in $ROOT_DIR" >&2
  exit 1
fi

mapfile -t SERVICES < <(normalize_services "$@")

git fetch origin
git pull --ff-only

if should_run_tests "${SERVICES[@]}"; then
  run_staging_tests
fi

mkdir -p backend/app/data
if [[ ! -f backend/app/data/store.json ]]; then
  printf '{}\n' > backend/app/data/store.json
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --force-recreate "${SERVICES[@]}"
