#!/usr/bin/env bash
set -euo pipefail

import_zsh_env() {
  command -v zsh >/dev/null 2>&1 || return 0
  local assignments
  assignments="$(
    zsh -lc '
      source ~/.zshrc >/dev/null 2>&1 || true
      for var in KEYCLOAK_BASE_URL KEYCLOAK_REALM KEYCLOAK_CLIENT_ID KEYCLOAK_CLIENT_SECRET KEYCLOAK_REDIRECT_URI KEYCLOAK_POST_LOGOUT_REDIRECT_URI KEYCLOAK_ADMIN KEYCLOAK_ADMIN_PASSWORD FRONTEND_PORT BACKEND_PORT; do
        if [[ -n ${(P)var-} ]]; then
          print -r -- "$var=${(Pqqq)var}"
        fi
      done
    ' 2>/dev/null || true
  )"
  [ -n "$assignments" ] || return 0
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    eval "export $line"
  done <<< "$assignments"
}

import_zsh_env

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command '$1' is not installed." >&2
    exit 1
  fi
}

require_cmd curl
require_cmd python3

KEYCLOAK_BASE_URL="${KEYCLOAK_BASE_URL:-http://localhost:8081}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-master}"
KEYCLOAK_CLIENT_ID="${KEYCLOAK_CLIENT_ID:-asiatravelplan-backend}"
KEYCLOAK_CLIENT_SECRET="${KEYCLOAK_CLIENT_SECRET:-}"
KEYCLOAK_REDIRECT_URI="${KEYCLOAK_REDIRECT_URI:-http://localhost:8787/auth/callback}"
KEYCLOAK_POST_LOGOUT_REDIRECT_URI="${KEYCLOAK_POST_LOGOUT_REDIRECT_URI:-http://127.0.0.1:8080/index.html}"
KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"
BACKEND_PORT="${BACKEND_PORT:-8787}"

if [ -z "$KEYCLOAK_CLIENT_SECRET" ]; then
  echo "Error: KEYCLOAK_CLIENT_SECRET is not set." >&2
  exit 1
fi

TOKEN_ENDPOINT="${KEYCLOAK_BASE_URL%/}/realms/master/protocol/openid-connect/token"
ADMIN_API_BASE="${KEYCLOAK_BASE_URL%/}/admin/realms/${KEYCLOAK_REALM}"
BACKEND_ORIGIN="http://localhost:${BACKEND_PORT}"
FRONTEND_ORIGIN_LOCALHOST="http://localhost:${FRONTEND_PORT}"
FRONTEND_ORIGIN_LOOPBACK="http://127.0.0.1:${FRONTEND_PORT}"
export BACKEND_ORIGIN FRONTEND_ORIGIN_LOCALHOST FRONTEND_ORIGIN_LOOPBACK

ACCESS_TOKEN="$(
  curl -sS --fail \
    -d "grant_type=password" \
    -d "client_id=admin-cli" \
    -d "username=${KEYCLOAK_ADMIN}" \
    -d "password=${KEYCLOAK_ADMIN_PASSWORD}" \
    "$TOKEN_ENDPOINT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])'
)"

CLIENT_UUID="$(
  curl -sS \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    "${ADMIN_API_BASE}/clients?clientId=${KEYCLOAK_CLIENT_ID}" | \
    python3 -c 'import json,sys; data=json.load(sys.stdin); print(data[0]["id"] if data else "")'
)"

CLIENT_PAYLOAD="$(
  python3 <<'PY'
import json, os

client_id = os.environ["KEYCLOAK_CLIENT_ID"]
client_secret = os.environ["KEYCLOAK_CLIENT_SECRET"]
redirect_uri = os.environ["KEYCLOAK_REDIRECT_URI"]
post_logout = os.environ["KEYCLOAK_POST_LOGOUT_REDIRECT_URI"]
frontend_localhost = os.environ["FRONTEND_ORIGIN_LOCALHOST"]
frontend_loopback = os.environ["FRONTEND_ORIGIN_LOOPBACK"]
backend_origin = os.environ["BACKEND_ORIGIN"]

payload = {
    "clientId": client_id,
    "name": client_id,
    "enabled": True,
    "protocol": "openid-connect",
    "publicClient": False,
    "bearerOnly": False,
    "standardFlowEnabled": True,
    "directAccessGrantsEnabled": False,
    "serviceAccountsEnabled": False,
    "implicitFlowEnabled": False,
    "redirectUris": [
        redirect_uri,
        post_logout,
        f"{frontend_localhost}/*",
        f"{frontend_loopback}/*",
        f"{backend_origin}/*",
    ],
    "webOrigins": [
        frontend_localhost,
        frontend_loopback,
        backend_origin,
    ],
    "rootUrl": frontend_loopback,
    "baseUrl": "/",
    "adminUrl": frontend_loopback,
    "secret": client_secret,
    "attributes": {
        "post.logout.redirect.uris": post_logout
    }
}
print(json.dumps(payload))
PY
)"

if [ -n "$CLIENT_UUID" ]; then
  curl -sS --fail \
    -X PUT \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$CLIENT_PAYLOAD" \
    "${ADMIN_API_BASE}/clients/${CLIENT_UUID}" >/dev/null
  echo "Updated Keycloak client '${KEYCLOAK_CLIENT_ID}' in realm '${KEYCLOAK_REALM}'."
else
  curl -sS --fail \
    -X POST \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$CLIENT_PAYLOAD" \
    "${ADMIN_API_BASE}/clients" >/dev/null
  echo "Created Keycloak client '${KEYCLOAK_CLIENT_ID}' in realm '${KEYCLOAK_REALM}'."
fi
