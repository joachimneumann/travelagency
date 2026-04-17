#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/load_repo_env.sh"
load_repo_env "$ROOT_DIR"

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
KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

TOKEN_ENDPOINT="${KEYCLOAK_BASE_URL%/}/realms/master/protocol/openid-connect/token"
REALM_API="${KEYCLOAK_BASE_URL%/}/admin/realms/${KEYCLOAK_REALM}"

ACCESS_TOKEN="$(
  curl -sS --fail \
    -d "grant_type=password" \
    -d "client_id=admin-cli" \
    -d "username=${KEYCLOAK_ADMIN}" \
    -d "password=${KEYCLOAK_ADMIN_PASSWORD}" \
    "$TOKEN_ENDPOINT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])'
)"

auth_header=(-H "Authorization: Bearer ${ACCESS_TOKEN}")

ensure_realm_role() {
  local role_name="$1"
  local status
  status="$(
    curl -sS -o /dev/null -w '%{http_code}' "${auth_header[@]}" \
      "${REALM_API}/roles/${role_name}"
  )"
  if [ "$status" = "200" ]; then
    return 0
  fi
  curl -sS --fail \
    -X POST \
    "${auth_header[@]}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${role_name}\"}" \
    "${REALM_API}/roles" >/dev/null
}

set_login_theme() {
  local realm_json
  realm_json="$(curl -sS --fail "${auth_header[@]}" "${REALM_API}")"
  REALM_JSON="$realm_json" python3 <<'PY' | curl -sS --fail -X PUT "${auth_header[@]}" -H "Content-Type: application/json" -d @- "${REALM_API}" >/dev/null
import json, os, sys
realm = json.loads(os.environ["REALM_JSON"])
realm["loginTheme"] = "asiatravelplan"
print(json.dumps(realm))
PY
}

ensure_user() {
  local username="$1"
  local email="$2"
  local first_name="$3"
  local last_name="$4"
  local password="$5"
  local role_name="$6"
  local user_id

  user_id="$(
    curl -sS "${auth_header[@]}" "${REALM_API}/users?username=${username}" | \
      python3 -c 'import json,sys; data=json.load(sys.stdin); print(data[0]["id"] if data else "")'
  )"

  if [ -z "$user_id" ]; then
    local user_payload
    user_payload="$(
      USERNAME="$username" \
      USER_EMAIL="$email" \
      USER_FIRST_NAME="$first_name" \
      USER_LAST_NAME="$last_name" \
      python3 <<'PY'
import json, os
print(json.dumps({
  "username": os.environ["USERNAME"],
  "enabled": True,
  "emailVerified": True,
  "email": os.environ["USER_EMAIL"],
  "firstName": os.environ["USER_FIRST_NAME"],
  "lastName": os.environ["USER_LAST_NAME"],
}))
PY
    )"
    curl -sS --fail \
      -X POST \
      "${auth_header[@]}" \
      -H "Content-Type: application/json" \
      -d "$user_payload" \
      "${REALM_API}/users" >/dev/null

    user_id="$(
      curl -sS "${auth_header[@]}" "${REALM_API}/users?username=${username}" | \
        python3 -c 'import json,sys; data=json.load(sys.stdin); print(data[0]["id"] if data else "")'
    )"
  fi

  curl -sS --fail \
    -X PUT \
    "${auth_header[@]}" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"password\",\"temporary\":false,\"value\":\"${password}\"}" \
    "${REALM_API}/users/${user_id}/reset-password" >/dev/null

  local role_payload
  role_payload="$(
    curl -sS --fail \
      "${auth_header[@]}" \
      "${REALM_API}/roles/${role_name}"
  )"
  curl -sS --fail \
    -X POST \
    "${auth_header[@]}" \
    -H "Content-Type: application/json" \
    -d "[${role_payload}]" \
    "${REALM_API}/users/${user_id}/role-mappings/realm" >/dev/null || true
}

for role in atp_admin atp_manager atp_accountant atp_staff; do
  ensure_realm_role "$role"
done

set_login_theme

ensure_user "joachim" "joachim@asiatravelplan.local" "Joachim" "Neumann" "atp" "atp_admin"
ensure_user "van" "van@asiatravelplan.local" "Van" "Nguyen" "atp" "atp_staff"

echo "Configured local Keycloak realm '${KEYCLOAK_REALM}' with theme 'asiatravelplan' and demo users:"
echo "  joachim / atp (atp_admin)"
echo "  van / atp (atp_staff)"
