#!/usr/bin/env bash
set -euo pipefail

import_zsh_env() {
  command -v zsh >/dev/null 2>&1 || return 0
  local exported
  exported="$(zsh -ilc 'source ~/.zshrc >/dev/null 2>&1 || true; typeset -px KEYCLOAK_ENABLED KEYCLOAK_BASE_URL KEYCLOAK_REALM KEYCLOAK_CLIENT_ID KEYCLOAK_CLIENT_SECRET KEYCLOAK_REDIRECT_URI KEYCLOAK_ALLOWED_ROLES KEYCLOAK_POST_LOGOUT_REDIRECT_URI KEYCLOAK_ADMIN KEYCLOAK_ADMIN_PASSWORD KEYCLOAK_DIRECTORY_USERNAME KEYCLOAK_DIRECTORY_PASSWORD KEYCLOAK_DIRECTORY_ADMIN_REALM GOOGLE_SERVICE_ACCOUNT_JSON_PATH GOOGLE_IMPERSONATED_EMAIL OPENAI_API_KEY OPENAI_PROJECT_ID OPENAI_ORGANIZATION_ID OPENAI_TRANSLATION_MODEL OPENAI_MODEL GOOGLE_TRANSLATE_FALLBACK_ENABLED BOOKING_CONFIRMATION_TOKEN_SECRET BOOKING_CONFIRMATION_TOKEN_TTL_SECONDS CORS_ORIGIN FRONTEND_PORT BACKEND_PORT WHATSAPP_WEBHOOK_ENABLED WHATSAPP_VERIFY_TOKEN WHATSAPP_WEBHOOK_VERIFY_TOKEN WHATSAPP_APP_SECRET WHATSAPP_WEBHOOK_APP_SECRET META_WEBHOOK_ENABLED META_WEBHOOK_VERIFY_TOKEN META_APP_SECRET COMPANY_BANK_ACCOUNT_HOLDER COMPANY_BANK_NAME COMPANY_BANK_ACCOUNT_NUMBER COMPANY_BANK_BRANCH COMPANY_BANK_SWIFT_CODE 2>/dev/null' 2>/dev/null || true)"
  [ -n "$exported" ] || return 0
  eval "$exported"
}

import_zsh_env

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
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
KEYCLOAK_POST_LOGOUT_REDIRECT_URI="${KEYCLOAK_POST_LOGOUT_REDIRECT_URI:-http://localhost:${FRONTEND_PORT}/index.html}"
KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
KEYCLOAK_DIRECTORY_USERNAME="${KEYCLOAK_DIRECTORY_USERNAME:-$KEYCLOAK_ADMIN}"
KEYCLOAK_DIRECTORY_PASSWORD="${KEYCLOAK_DIRECTORY_PASSWORD:-$KEYCLOAK_ADMIN_PASSWORD}"
KEYCLOAK_DIRECTORY_ADMIN_REALM="${KEYCLOAK_DIRECTORY_ADMIN_REALM:-master}"
GOOGLE_SERVICE_ACCOUNT_JSON_PATH="${GOOGLE_SERVICE_ACCOUNT_JSON_PATH:-}"
GOOGLE_IMPERSONATED_EMAIL="${GOOGLE_IMPERSONATED_EMAIL:-info@asiatravelplan.com}"
WHATSAPP_WEBHOOK_ENABLED="${WHATSAPP_WEBHOOK_ENABLED:-false}"
WHATSAPP_WEBHOOK_VERIFY_TOKEN="${WHATSAPP_WEBHOOK_VERIFY_TOKEN:-}"
WHATSAPP_WEBHOOK_APP_SECRET="${WHATSAPP_WEBHOOK_APP_SECRET:-}"
WHATSAPP_VERIFY_TOKEN="${WHATSAPP_VERIFY_TOKEN:-$WHATSAPP_WEBHOOK_VERIFY_TOKEN}"
WHATSAPP_APP_SECRET="${WHATSAPP_APP_SECRET:-$WHATSAPP_WEBHOOK_APP_SECRET}"
META_WEBHOOK_ENABLED="${META_WEBHOOK_ENABLED:-false}"
META_WEBHOOK_VERIFY_TOKEN="${META_WEBHOOK_VERIFY_TOKEN:-}"
META_APP_SECRET="${META_APP_SECRET:-}"
OPENAI_API_KEY="${OPENAI_API_KEY:-}"
OPENAI_PROJECT_ID="${OPENAI_PROJECT_ID:-}"
OPENAI_ORGANIZATION_ID="${OPENAI_ORGANIZATION_ID:-}"
OPENAI_TRANSLATION_MODEL="${OPENAI_TRANSLATION_MODEL:-${OPENAI_MODEL:-gpt-5.4-mini}}"
GOOGLE_TRANSLATE_FALLBACK_ENABLED="${GOOGLE_TRANSLATE_FALLBACK_ENABLED:-true}"
BACKEND_I18N_STRICT="${BACKEND_I18N_STRICT:-1}"
BOOKING_CONFIRMATION_TOKEN_SECRET="${BOOKING_CONFIRMATION_TOKEN_SECRET:-}"
BOOKING_CONFIRMATION_TOKEN_TTL_SECONDS="${BOOKING_CONFIRMATION_TOKEN_TTL_SECONDS:-}"
CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT},http://localhost,http://127.0.0.1}"

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

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-30}"
  local i

  for i in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done

  echo "Error: ${label} failed health check at ${url}." >&2
  if [ -f "$BACKEND_LOG_FILE" ]; then
    echo "--- ${label} log (tail) ---" >&2
    tail -n 120 "$BACKEND_LOG_FILE" >&2 || true
  fi
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' is not installed." >&2
    exit 1
  fi
}

ensure_backend_deps() {
  if [ -d "$BACKEND_DIR/node_modules/pdfkit" ] && [ -d "$BACKEND_DIR/node_modules/sharp" ]; then
    return
  fi

  echo "Backend dependencies are missing. Installing from ${BACKEND_DIR} ..."
  (cd "$BACKEND_DIR" && npm ci --no-audit --no-fund)
}

check_backend_i18n() {
  local sync_script="$ROOT_DIR/scripts/i18n/sync_backend_i18n.mjs"
  if [ ! -f "$sync_script" ]; then
    echo "Error: backend i18n sync script not found at $sync_script" >&2
    exit 1
  fi

  if node "$sync_script" check; then
    return
  fi

  echo "### Backend i18n sync failed for vi. ###" >&2
  echo "Backend UI translations are out of sync." >&2
  echo "Run: node scripts/i18n/sync_backend_i18n.mjs translate --target vi" >&2
  if [ "$BACKEND_I18N_STRICT" = "0" ]; then
    echo "Continuing because BACKEND_I18N_STRICT=0." >&2
    return
  fi
  echo "Refusing to start because BACKEND_I18N_STRICT=${BACKEND_I18N_STRICT}." >&2
  exit 1
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

stop_existing_backend() {
  if [ ! -f "$BACKEND_PID_FILE" ]; then
    stop_listeners_on_port "$BACKEND_PORT" "backend"
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
  stop_listeners_on_port "$BACKEND_PORT" "backend"
}

main() {
  require_cmd node
  require_cmd lsof
  require_cmd curl
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
  "bookings": [],
  "activities": [],
  "invoices": [],
  "chat_channel_accounts": [],
  "chat_conversations": [],
  "chat_events": []
}
EOF
  fi

  if [ "$KEYCLOAK_ENABLED" = "true" ] && [ -z "$KEYCLOAK_CLIENT_SECRET" ]; then
    echo "Error: KEYCLOAK_CLIENT_SECRET is not set." >&2
    echo "Export it first, for example:" >&2
    echo "  export KEYCLOAK_CLIENT_SECRET='...'" >&2
    exit 1
  fi

  ensure_backend_deps
  check_backend_i18n

  stop_existing_backend

  echo "Starting backend from ${BACKEND_DIR} ..."
  env \
    BACKEND_DIR="$BACKEND_DIR" \
    BACKEND_LOG_FILE="$BACKEND_LOG_FILE" \
    BACKEND_PID_FILE="$BACKEND_PID_FILE" \
    NODE_BIN="$(command -v node)" \
    PORT="$BACKEND_PORT" \
    CORS_ORIGIN="$CORS_ORIGIN" \
    KEYCLOAK_ENABLED="$KEYCLOAK_ENABLED" \
    KEYCLOAK_BASE_URL="$KEYCLOAK_BASE_URL" \
    KEYCLOAK_REALM="$KEYCLOAK_REALM" \
    KEYCLOAK_CLIENT_ID="$KEYCLOAK_CLIENT_ID" \
    KEYCLOAK_CLIENT_SECRET="$KEYCLOAK_CLIENT_SECRET" \
    KEYCLOAK_REDIRECT_URI="$KEYCLOAK_REDIRECT_URI" \
    KEYCLOAK_ALLOWED_ROLES="$KEYCLOAK_ALLOWED_ROLES" \
    KEYCLOAK_POST_LOGOUT_REDIRECT_URI="$KEYCLOAK_POST_LOGOUT_REDIRECT_URI" \
    KEYCLOAK_ADMIN="$KEYCLOAK_ADMIN" \
    KEYCLOAK_ADMIN_PASSWORD="$KEYCLOAK_ADMIN_PASSWORD" \
    KEYCLOAK_DIRECTORY_USERNAME="$KEYCLOAK_DIRECTORY_USERNAME" \
    KEYCLOAK_DIRECTORY_PASSWORD="$KEYCLOAK_DIRECTORY_PASSWORD" \
    KEYCLOAK_DIRECTORY_ADMIN_REALM="$KEYCLOAK_DIRECTORY_ADMIN_REALM" \
    WHATSAPP_WEBHOOK_ENABLED="$WHATSAPP_WEBHOOK_ENABLED" \
    WHATSAPP_VERIFY_TOKEN="$WHATSAPP_VERIFY_TOKEN" \
    WHATSAPP_APP_SECRET="$WHATSAPP_APP_SECRET" \
    META_WEBHOOK_ENABLED="$META_WEBHOOK_ENABLED" \
    META_WEBHOOK_VERIFY_TOKEN="$META_WEBHOOK_VERIFY_TOKEN" \
    META_APP_SECRET="$META_APP_SECRET" \
    GOOGLE_SERVICE_ACCOUNT_JSON_PATH="$GOOGLE_SERVICE_ACCOUNT_JSON_PATH" \
    GOOGLE_IMPERSONATED_EMAIL="$GOOGLE_IMPERSONATED_EMAIL" \
    OPENAI_API_KEY="$OPENAI_API_KEY" \
    OPENAI_PROJECT_ID="$OPENAI_PROJECT_ID" \
    OPENAI_ORGANIZATION_ID="$OPENAI_ORGANIZATION_ID" \
    OPENAI_TRANSLATION_MODEL="$OPENAI_TRANSLATION_MODEL" \
    GOOGLE_TRANSLATE_FALLBACK_ENABLED="$GOOGLE_TRANSLATE_FALLBACK_ENABLED" \
    BOOKING_CONFIRMATION_TOKEN_SECRET="$BOOKING_CONFIRMATION_TOKEN_SECRET" \
    BOOKING_CONFIRMATION_TOKEN_TTL_SECONDS="$BOOKING_CONFIRMATION_TOKEN_TTL_SECONDS" \
    node <<'EOF'
const fs = require("fs");
const { spawn } = require("child_process");

const logFd = fs.openSync(process.env.BACKEND_LOG_FILE, "a");
const child = spawn(process.env.NODE_BIN, ["src/server.js"], {
  cwd: process.env.BACKEND_DIR,
  env: process.env,
  detached: true,
  stdio: ["ignore", logFd, logFd]
});

fs.writeFileSync(process.env.BACKEND_PID_FILE, `${child.pid}\n`, "utf8");
child.unref();
EOF
  wait_for_pid "$(cat "$BACKEND_PID_FILE")" "backend" "$BACKEND_LOG_FILE"
  wait_for_http "http://localhost:${BACKEND_PORT}/health" "backend"

  echo "Backend API: http://localhost:${BACKEND_PORT}"
  echo "Backend log: ${BACKEND_LOG_FILE}"
}

main "$@"
