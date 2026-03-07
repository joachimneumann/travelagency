#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker_runtime.sh"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.local-keycloak.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-travelagency_keycloak}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Keycloak is not running because docker is not installed."
  exit 0
fi

if ! docker_daemon_available; then
  echo "Docker daemon is not reachable; skipping compose shutdown for Keycloak."
  exit 0
fi

echo "Stopping local Keycloak ..."
docker_compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" down --remove-orphans

if docker container inspect keycloak >/dev/null 2>&1; then
  echo "Removing legacy keycloak container ..."
  docker rm -f keycloak >/dev/null
fi
