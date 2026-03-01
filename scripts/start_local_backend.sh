#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${BACKEND_DIR:-$ROOT_DIR/backend/app}"
BACKEND_PID_FILE="${BACKEND_PID_FILE:-/tmp/asiatravelplan-backend.pid}"
BACKEND_LOG_FILE="${BACKEND_LOG_FILE:-/tmp/asiatravelplan-backend.log}"
BACKEND_PORT="${BACKEND_PORT:-8787}"
STORE_FILE="${STORE_FILE:-$BACKEND_DIR/data/store.json}"

FRONTEND_PORT="${FRONTEND_PORT:-8080}"
FRONTEND_BIND="${FRONTEND_BIND:-127.0.0.1}"

KEYCLOAK_ENABLED="${KEYCLOAK_ENABLED:-true}"
KEYCLOAK_BASE_URL="${KEYCLOAK_BASE_URL:-http://localhost:8081}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-master}"
KEYCLOAK_CLIENT_ID="${KEYCLOAK_CLIENT_ID:-asiatravelplan-backend}"
KEYCLOAK_CLIENT_SECRET="${KEYCLOAK_CLIENT_SECRET:-}"
KEYCLOAK_REDIRECT_URI="${KEYCLOAK_REDIRECT_URI:-http://localhost:${BACKEND_PORT}/auth/callback}"
KEYCLOAK_ALLOWED_ROLES="${KEYCLOAK_ALLOWED_ROLES:-atp_admin,atp_manager,atp_accountant,atp_staff}"
KEYCLOAK_GLOBAL_LOGOUT="${KEYCLOAK_GLOBAL_LOGOUT:-true}"
KEYCLOAK_POST_LOGOUT_REDIRECT_URI="${KEYCLOAK_POST_LOGOUT_REDIRECT_URI:-http://localhost:${FRONTEND_PORT}/index.html}"
CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT}}"

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

stop_existing_backend() {
  if [ ! -f "$BACKEND_PID_FILE" ]; then
    return
  fi

  local existing_pid
  existing_pid="$(cat "$BACKEND_PID_FILE" 2>/dev/null || true)"
  if [ -n "${existing_pid}" ] && kill -0 "${existing_pid}" 2>/dev/null; then
    echo "Stopping existing backend (PID ${existing_pid}) ..."
    kill "${existing_pid}" 2>/dev/null || true
    sleep 0.5
    if kill -0 "${existing_pid}" 2>/dev/null; then
      kill -9 "${existing_pid}" 2>/dev/null || true
    fi
  fi

  rm -f "$BACKEND_PID_FILE"
}

main() {
  require_cmd npm

  if [ ! -f "$BACKEND_DIR/package.json" ]; then
    echo "Error: backend package.json not found in $BACKEND_DIR" >&2
    exit 1
  fi

  if [ ! -f "$STORE_FILE" ]; then
    echo "Creating local backend store at ${STORE_FILE} ..."
    mkdir -p "$(dirname "$STORE_FILE")"
    cat >"$STORE_FILE" <<'EOF'
{
  "customers": [],
  "bookings": [],
  "activities": [],
  "invoices": []
}
EOF
  fi

  if [ -z "$KEYCLOAK_CLIENT_SECRET" ]; then
    echo "Error: KEYCLOAK_CLIENT_SECRET is not set." >&2
    echo "Export it first, for example:" >&2
    echo "  export KEYCLOAK_CLIENT_SECRET='...'" >&2
    exit 1
  fi

  stop_existing_backend

  echo "Starting backend from ${BACKEND_DIR} ..."
  (
    cd "$BACKEND_DIR"
    nohup env \
      PORT="$BACKEND_PORT" \
      CORS_ORIGIN="$CORS_ORIGIN" \
      KEYCLOAK_ENABLED="$KEYCLOAK_ENABLED" \
      KEYCLOAK_BASE_URL="$KEYCLOAK_BASE_URL" \
      KEYCLOAK_REALM="$KEYCLOAK_REALM" \
      KEYCLOAK_CLIENT_ID="$KEYCLOAK_CLIENT_ID" \
      KEYCLOAK_CLIENT_SECRET="$KEYCLOAK_CLIENT_SECRET" \
      KEYCLOAK_REDIRECT_URI="$KEYCLOAK_REDIRECT_URI" \
      KEYCLOAK_ALLOWED_ROLES="$KEYCLOAK_ALLOWED_ROLES" \
      KEYCLOAK_GLOBAL_LOGOUT="$KEYCLOAK_GLOBAL_LOGOUT" \
      KEYCLOAK_POST_LOGOUT_REDIRECT_URI="$KEYCLOAK_POST_LOGOUT_REDIRECT_URI" \
      npm start >"$BACKEND_LOG_FILE" 2>&1 &
    echo $! >"$BACKEND_PID_FILE"
  )
  wait_for_pid "$(cat "$BACKEND_PID_FILE")" "backend" "$BACKEND_LOG_FILE"

  echo "Backend API: http://localhost:${BACKEND_PORT}"
  echo "Backend log: ${BACKEND_LOG_FILE}"
}

main "$@"
