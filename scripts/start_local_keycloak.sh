#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker_runtime.sh"

import_zsh_env() {
  command -v zsh >/dev/null 2>&1 || return 0
  local exported
  exported="$(zsh -lc 'typeset -px KEYCLOAK_BASE_URL KEYCLOAK_REALM 2>/dev/null' 2>/dev/null || true)"
  [ -n "$exported" ] || return 0
  eval "$exported"
}

import_zsh_env

COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.local-keycloak.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-travelagency_keycloak}"
KEYCLOAK_BASE_URL="${KEYCLOAK_BASE_URL:-http://localhost:8081}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-master}"
KEYCLOAK_DISCOVERY_URL="${KEYCLOAK_BASE_URL%/}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration"
KEYCLOAK_READY_TIMEOUT_SECONDS="${KEYCLOAK_READY_TIMEOUT_SECONDS:-45}"

ensure_local_docker_runtime

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is not installed." >&2
  exit 1
fi

if docker container inspect keycloak >/dev/null 2>&1; then
  echo "Removing stale keycloak container ..."
  docker rm -f keycloak >/dev/null
fi

echo "Starting local Keycloak with persistent theme mount ..."
docker_compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" up -d

deadline=$((SECONDS + KEYCLOAK_READY_TIMEOUT_SECONDS))
while true; do
  if curl --silent --fail --output /dev/null "$KEYCLOAK_DISCOVERY_URL"; then
    break
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "Error: Keycloak did not become ready at $KEYCLOAK_DISCOVERY_URL within ${KEYCLOAK_READY_TIMEOUT_SECONDS}s." >&2
    docker_compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" ps >&2 || true
    exit 1
  fi
  sleep 1
done

echo "Keycloak: ${KEYCLOAK_BASE_URL}"
echo "Compose file: $COMPOSE_FILE"
echo "Docker context: $(docker_context_name)"
