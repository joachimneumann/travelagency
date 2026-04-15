#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/docker_runtime.sh"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.local-caddy.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-travelagency_frontend}"

stop_compose_frontend() {
  if [ ! -f "$COMPOSE_FILE" ]; then
    return
  fi

  if ! docker_daemon_available; then
    return
  fi

  (
    cd "$ROOT_DIR"
    FRONTEND_PORT="$FRONTEND_PORT" docker_compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" down --remove-orphans
  ) >/dev/null 2>&1 || true
}

stop_from_port() {
  local pids
  pids="$(lsof -tiTCP:${FRONTEND_PORT} -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    return
  fi

  local pid
  for pid in $pids; do
    echo "Stopping frontend listener on port ${FRONTEND_PORT} (PID ${pid}) ..."
    kill "$pid" 2>/dev/null || true
    sleep 0.5
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
}

stop_compose_frontend
stop_from_port

if lsof -tiTCP:${FRONTEND_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  echo "frontend is still listening on port ${FRONTEND_PORT}."
  exit 1
fi

echo "frontend is not running on port ${FRONTEND_PORT}."
