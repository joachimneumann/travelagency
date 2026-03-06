#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

FRONTEND_PORT="${FRONTEND_PORT:-8080}"
FRONTEND_BIND="${FRONTEND_BIND:-localhost}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.local-caddy.yml}"

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-20}"

  local i
  for i in $(seq 1 "$attempts"); do
    if curl -fsSI "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done

  echo "Error: ${label} failed to start." >&2
  docker compose -f "$COMPOSE_FILE" logs --tail=120 caddy >&2 || true
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' is not installed." >&2
    exit 1
  fi
}

stop_listeners_on_port() {
  local port="$1"
  local label="$2"
  local pids

  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    return
  fi

  echo "Stopping ${label} listener(s) on port ${port}: ${pids//$'\n'/ } ..."
  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    kill "$pid" 2>/dev/null || true
  done <<< "$pids"

  sleep 0.5

  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done <<< "$pids"
}

stop_existing_frontend() {
  if [ -f "$COMPOSE_FILE" ]; then
    (
      cd "$ROOT_DIR"
      FRONTEND_PORT="$FRONTEND_PORT" docker compose -f "$COMPOSE_FILE" down --remove-orphans
    ) >/dev/null 2>&1 || true
  fi

  stop_listeners_on_port "$FRONTEND_PORT" "frontend"
}

main() {
  require_cmd docker
  require_cmd lsof
  require_cmd curl
  stop_existing_frontend

  echo "Starting frontend on http://${FRONTEND_BIND}:${FRONTEND_PORT} ..."
  (
    cd "$ROOT_DIR"
    FRONTEND_PORT="$FRONTEND_PORT" docker compose -f "$COMPOSE_FILE" up -d caddy
  )

  wait_for_http "http://${FRONTEND_BIND}:${FRONTEND_PORT}/" "frontend"

  echo "Frontend:    http://${FRONTEND_BIND}:${FRONTEND_PORT}"
  echo "Frontend mode: local Caddy"
}

main "$@"
