#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="docker-compose.staging.yml"
ENV_FILE=".env.staging"

source "$ROOT_DIR/scripts/lib/docker_runtime.sh"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/wipe_staging_bookings.sh [--yes] [--store <path>] [--data-dir <path>]

Examples:
  ./scripts/wipe_staging_bookings.sh
  ./scripts/wipe_staging_bookings.sh --yes
EOF
}

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      usage
      exit 0
      ;;
  esac
done

cd "$ROOT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$ENV_FILE is missing in $ROOT_DIR" >&2
  exit 1
fi

ensure_local_docker_runtime
docker_compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps backend node scripts/wipe_bookings.js "$@"
