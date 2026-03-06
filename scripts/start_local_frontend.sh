#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

FRONTEND_PORT="${FRONTEND_PORT:-8080}"
FRONTEND_BIND="${FRONTEND_BIND:-localhost}"
FRONTEND_PID_FILE="${FRONTEND_PID_FILE:-/tmp/asiatravelplan-frontend.pid}"
FRONTEND_LOG_FILE="${FRONTEND_LOG_FILE:-/tmp/asiatravelplan-frontend.log}"
BACKEND_BASE="${BACKEND_BASE:-http://127.0.0.1:8787}"

wait_for_pid() {
  local pid="$1"
  local label="$2"
  local log_file="$3"

  sleep 0.8
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "Error: ${label} failed to start." >&2
    if [ -f "$log_file" ]; then
      echo "--- ${label} log (tail) ---" >&2
      tail -n 80 "$log_file" >&2 || true
    fi
    exit 1
  fi
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
  if [ ! -f "$FRONTEND_PID_FILE" ]; then
    stop_listeners_on_port "$FRONTEND_PORT" "frontend"
    return
  fi

  local existing_pid
  existing_pid="$(cat "$FRONTEND_PID_FILE" 2>/dev/null || true)"
  if [ -n "${existing_pid}" ] && kill -0 "${existing_pid}" 2>/dev/null; then
    echo "Stopping existing frontend (PID ${existing_pid}) ..."
    kill "${existing_pid}" 2>/dev/null || true
    sleep 0.5
    if kill -0 "${existing_pid}" 2>/dev/null; then
      kill -9 "${existing_pid}" 2>/dev/null || true
    fi
  fi

  rm -f "$FRONTEND_PID_FILE"
  stop_listeners_on_port "$FRONTEND_PORT" "frontend"
}

main() {
  require_cmd python3
  require_cmd lsof
  stop_existing_frontend

  echo "Starting frontend on http://${FRONTEND_BIND}:${FRONTEND_PORT} ..."
  bash -lc '
    cd "$1"
    nohup python3 scripts/serve_frontend.py \
      --bind "$2" \
      "$3" \
      --directory "$1" \
      --backend-base "$4" >"$5" 2>&1 < /dev/null &
    pid=$!
    disown "$pid" 2>/dev/null || true
    printf "%s\n" "$pid" >"$6"
  ' bash "$ROOT_DIR" "$FRONTEND_BIND" "$FRONTEND_PORT" "$BACKEND_BASE" "$FRONTEND_LOG_FILE" "$FRONTEND_PID_FILE"
  wait_for_pid "$(cat "$FRONTEND_PID_FILE")" "frontend" "$FRONTEND_LOG_FILE"

  echo "Frontend:    http://${FRONTEND_BIND}:${FRONTEND_PORT}"
  echo "Backend proxy: ${BACKEND_BASE}"
  echo "Frontend log: ${FRONTEND_LOG_FILE}"
}

main "$@"
