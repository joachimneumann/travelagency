#!/usr/bin/env bash
set -euo pipefail

BACKEND_PID_FILE="${BACKEND_PID_FILE:-/tmp/asiatravelplan-backend.pid}"
BACKEND_PORT="${BACKEND_PORT:-8787}"

stop_process() {
  local pid="$1"
  local label="$2"

  if [ -z "$pid" ]; then
    return
  fi

  if kill -0 "$pid" 2>/dev/null; then
    echo "Stopping ${label} (PID ${pid}) ..."
    kill "$pid" 2>/dev/null || true
    sleep 0.5
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    echo "${label} stopped."
  fi
}

stop_from_pid_file() {
  if [ ! -f "$BACKEND_PID_FILE" ]; then
    return
  fi

  local pid
  pid="$(cat "$BACKEND_PID_FILE" 2>/dev/null || true)"
  if [ -z "$pid" ]; then
    echo "backend PID file was empty and has been removed."
  fi
  stop_process "$pid" "backend"
  rm -f "$BACKEND_PID_FILE"
}

stop_from_port() {
  local pids
  pids="$(lsof -tiTCP:${BACKEND_PORT} -sTCP:LISTEN 2>/dev/null || true)"
  if [ -z "$pids" ]; then
    return
  fi

  local pid
  for pid in $pids; do
    stop_process "$pid" "backend on port ${BACKEND_PORT}"
  done
}

stop_from_pid_file
stop_from_port

if lsof -tiTCP:${BACKEND_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  echo "backend is still listening on port ${BACKEND_PORT}."
  exit 1
fi

echo "backend is not running on port ${BACKEND_PORT}."
