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
LOCAL_KEYCLOAK_STAFF_PASSWORD="${LOCAL_KEYCLOAK_STAFF_PASSWORD:-atp}"
ATP_STAFF_JSON_PATH="${ATP_STAFF_JSON_PATH:-$ROOT_DIR/content/atp_staff/staff.json}"

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

  if [ -z "$role_name" ]; then
    echo "Error: role_name is required for local Keycloak user '$username'." >&2
    return 1
  fi

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

  if [ -z "$user_id" ]; then
    echo "Error: could not resolve Keycloak user id for '$username'." >&2
    return 1
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

  local role_already_assigned
  role_already_assigned="$(
    curl -sS --fail "${auth_header[@]}" "${REALM_API}/users/${user_id}/role-mappings/realm" | \
      ROLE_NAME="$role_name" python3 -c 'import json,os,sys; role=os.environ["ROLE_NAME"]; print("1" if any(item.get("name") == role for item in json.load(sys.stdin)) else "0")'
  )"
  if [ "$role_already_assigned" != "1" ]; then
    curl -sS --fail \
      -X POST \
      "${auth_header[@]}" \
      -H "Content-Type: application/json" \
      -d "[${role_payload}]" \
      "${REALM_API}/users/${user_id}/role-mappings/realm" >/dev/null
  fi
}

ensure_staff_users_from_content() {
  if [[ ! -f "$ATP_STAFF_JSON_PATH" ]]; then
    echo "Error: ATP staff profile file not found at $ATP_STAFF_JSON_PATH" >&2
    exit 1
  fi

  STAFF_JSON_PATH="$ATP_STAFF_JSON_PATH" python3 <<'PY' | while IFS= read -r staff_assignment; do
import json
import os
import re
import shlex
import sys

path = os.environ["STAFF_JSON_PATH"]
with open(path, "r", encoding="utf-8") as handle:
    payload = json.load(handle)

staff = payload.get("staff") or {}
if not isinstance(staff, dict):
    sys.exit("staff.json must contain a staff object")

def clean(value):
    return str(value or "").strip()

for username, profile in sorted(staff.items()):
    username = clean(username).lower()
    if not username:
        continue
    profile = profile if isinstance(profile, dict) else {}
    name = clean(profile.get("name")) or username
    parts = re.split(r"\s+", name)
    if len(parts) > 1:
        first_name = " ".join(parts[:-1])
        last_name = parts[-1]
    else:
        first_name = name
        last_name = ""
    role_name = "atp_admin" if username == "joachim" else "atp_staff"
    email = f"{username}@asiatravelplan.local"
    fields = {
        "username": username,
        "email": email,
        "first_name": first_name,
        "last_name": last_name,
        "role_name": role_name,
    }
    print(" ".join(f"{key}={shlex.quote(value)}" for key, value in fields.items()))
PY
    eval "$staff_assignment"
    ensure_user "$username" "$email" "$first_name" "$last_name" "$LOCAL_KEYCLOAK_STAFF_PASSWORD" "$role_name"
    echo "  $username / $LOCAL_KEYCLOAK_STAFF_PASSWORD ($role_name)"
  done
}

for role in atp_admin atp_manager atp_accountant atp_staff; do
  ensure_realm_role "$role"
done

set_login_theme

echo "Configured local Keycloak realm '${KEYCLOAK_REALM}' with theme 'asiatravelplan' and demo users:"
ensure_staff_users_from_content
