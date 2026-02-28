#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.local-keycloak.yml}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed." >&2
  exit 1
fi

echo "Starting local Keycloak with persistent theme mount ..."
docker compose -f "$COMPOSE_FILE" up -d

echo "Keycloak: http://localhost:8081"
echo "Compose file: $COMPOSE_FILE"
