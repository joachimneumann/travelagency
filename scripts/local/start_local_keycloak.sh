#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/load_repo_env.sh"
load_repo_env "$ROOT_DIR"
source "$ROOT_DIR/scripts/lib/docker_runtime.sh"

COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.local-keycloak.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-travelagency_keycloak}"
KEYCLOAK_BASE_URL="${KEYCLOAK_BASE_URL:-http://localhost:8081}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-master}"
KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
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

echo "Bootstrapping local Keycloak demo users ..."
"$ROOT_DIR/scripts/keycloak/bootstrap_local_keycloak_users.sh"

if [ -n "${KEYCLOAK_CLIENT_SECRET:-}" ]; then
  echo "Bootstrapping local Keycloak backend client ..."
  "$ROOT_DIR/scripts/keycloak/bootstrap_local_keycloak_backend_client.sh"
else
  echo "Skipping backend client bootstrap because KEYCLOAK_CLIENT_SECRET is not set."
fi

echo "Syncing ATP staff names from Keycloak ..."
export KEYCLOAK_ENABLED="true"
export KEYCLOAK_BASE_URL
export KEYCLOAK_REALM
export KEYCLOAK_ADMIN
export KEYCLOAK_ADMIN_PASSWORD
node "$ROOT_DIR/backend/app/scripts/sync_atp_staff_from_keycloak.js"
