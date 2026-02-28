#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.local-keycloak.yml}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed." >&2
  exit 1
fi

echo "Stopping local Keycloak ..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans

if docker container inspect keycloak >/dev/null 2>&1; then
  echo "Removing legacy keycloak container ..."
  docker rm -f keycloak >/dev/null
fi
