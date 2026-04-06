#!/usr/bin/env bash
set -euo pipefail

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
KEYCLOAK_CLIENT_ID="${KEYCLOAK_CLIENT_ID:-asiatravelplan-backend}"
KEYCLOAK_CLIENT_SECRET="${KEYCLOAK_CLIENT_SECRET:-}"
KEYCLOAK_REDIRECT_URI="${KEYCLOAK_REDIRECT_URI:-http://localhost:8787/auth/callback}"
KEYCLOAK_POST_LOGOUT_REDIRECT_URI="${KEYCLOAK_POST_LOGOUT_REDIRECT_URI:-http://127.0.0.1:8080/}"
KEYCLOAK_ALLOWED_ROLES="${KEYCLOAK_ALLOWED_ROLES:-atp_admin,atp_manager,atp_accountant,atp_staff,atp_tour_editor}"
KEYCLOAK_CLIENT_REDIRECT_URIS="${KEYCLOAK_CLIENT_REDIRECT_URIS:-}"
KEYCLOAK_CLIENT_WEB_ORIGINS="${KEYCLOAK_CLIENT_WEB_ORIGINS:-}"
KEYCLOAK_CLIENT_ROOT_URL="${KEYCLOAK_CLIENT_ROOT_URL:-}"
KEYCLOAK_CLIENT_BASE_URL="${KEYCLOAK_CLIENT_BASE_URL:-/}"
KEYCLOAK_CLIENT_ADMIN_URL="${KEYCLOAK_CLIENT_ADMIN_URL:-}"
KEYCLOAK_LOGIN_THEME="${KEYCLOAK_LOGIN_THEME:-asiatravelplan}"
KEYCLOAK_BOOTSTRAP_ADMIN_ROLE="${KEYCLOAK_BOOTSTRAP_ADMIN_ROLE:-atp_admin}"

if [[ -z "$KEYCLOAK_CLIENT_SECRET" ]]; then
  echo "Error: KEYCLOAK_CLIENT_SECRET is not set." >&2
  exit 1
fi

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
  if [[ "$status" == "200" ]]; then
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
  REALM_JSON="$realm_json" KEYCLOAK_LOGIN_THEME="$KEYCLOAK_LOGIN_THEME" python3 <<'PY' | curl -sS --fail -X PUT "${auth_header[@]}" -H "Content-Type: application/json" -d @- "${REALM_API}" >/dev/null
import json, os
realm = json.loads(os.environ["REALM_JSON"])
realm["loginTheme"] = os.environ["KEYCLOAK_LOGIN_THEME"]
print(json.dumps(realm))
PY
}

ensure_backend_client() {
  local client_uuid redirect_uris_json web_origins_json root_url base_url admin_url
  client_uuid="$(
    curl -sS "${auth_header[@]}" "${REALM_API}/clients?clientId=${KEYCLOAK_CLIENT_ID}" | \
      python3 -c 'import json,sys; data=json.load(sys.stdin); print(data[0]["id"] if data else "")'
  )"

  redirect_uris_json="$(
    KEYCLOAK_REDIRECT_URI="$KEYCLOAK_REDIRECT_URI" \
    KEYCLOAK_POST_LOGOUT_REDIRECT_URI="$KEYCLOAK_POST_LOGOUT_REDIRECT_URI" \
    KEYCLOAK_CLIENT_REDIRECT_URIS="$KEYCLOAK_CLIENT_REDIRECT_URIS" \
    python3 <<'PY'
import json, os
raw = os.environ.get("KEYCLOAK_CLIENT_REDIRECT_URIS", "").strip()
if raw:
    items = [item.strip() for item in raw.split(",") if item.strip()]
else:
    items = [os.environ["KEYCLOAK_REDIRECT_URI"], os.environ["KEYCLOAK_POST_LOGOUT_REDIRECT_URI"]]
seen = set()
items = [item for item in items if item and not (item in seen or seen.add(item))]
print(json.dumps(items))
PY
  )"

  web_origins_json="$(
    KEYCLOAK_CLIENT_WEB_ORIGINS="$KEYCLOAK_CLIENT_WEB_ORIGINS" python3 <<'PY'
import json, os
raw = os.environ.get("KEYCLOAK_CLIENT_WEB_ORIGINS", "").strip()
items = [item.strip() for item in raw.split(",") if item.strip()] if raw else []
print(json.dumps(items))
PY
  )"

  root_url="$KEYCLOAK_CLIENT_ROOT_URL"
  if [[ -z "$root_url" ]]; then
    root_url="$KEYCLOAK_POST_LOGOUT_REDIRECT_URI"
  fi

  base_url="$KEYCLOAK_CLIENT_BASE_URL"
  admin_url="$KEYCLOAK_CLIENT_ADMIN_URL"

  local payload
  payload="$(
    KEYCLOAK_CLIENT_ID="$KEYCLOAK_CLIENT_ID" \
    KEYCLOAK_CLIENT_SECRET="$KEYCLOAK_CLIENT_SECRET" \
    KEYCLOAK_POST_LOGOUT_REDIRECT_URI="$KEYCLOAK_POST_LOGOUT_REDIRECT_URI" \
    REDIRECT_URIS_JSON="$redirect_uris_json" \
    WEB_ORIGINS_JSON="$web_origins_json" \
    ROOT_URL="$root_url" \
    BASE_URL="$base_url" \
    ADMIN_URL="$admin_url" \
    python3 <<'PY'
import json, os
payload = {
    "clientId": os.environ["KEYCLOAK_CLIENT_ID"],
    "name": os.environ["KEYCLOAK_CLIENT_ID"],
    "enabled": True,
    "protocol": "openid-connect",
    "publicClient": False,
    "bearerOnly": False,
    "standardFlowEnabled": True,
    "directAccessGrantsEnabled": False,
    "serviceAccountsEnabled": False,
    "implicitFlowEnabled": False,
    "redirectUris": json.loads(os.environ["REDIRECT_URIS_JSON"]),
    "webOrigins": json.loads(os.environ["WEB_ORIGINS_JSON"]),
    "rootUrl": os.environ["ROOT_URL"],
    "baseUrl": os.environ["BASE_URL"],
    "secret": os.environ["KEYCLOAK_CLIENT_SECRET"],
    "attributes": {
        "post.logout.redirect.uris": os.environ["KEYCLOAK_POST_LOGOUT_REDIRECT_URI"]
    }
}
admin_url = os.environ.get("ADMIN_URL", "").strip()
if admin_url:
    payload["adminUrl"] = admin_url
print(json.dumps(payload))
PY
  )"

  if [[ -n "$client_uuid" ]]; then
    curl -sS --fail \
      -X PUT \
      "${auth_header[@]}" \
      -H "Content-Type: application/json" \
      -d "$payload" \
      "${REALM_API}/clients/${client_uuid}" >/dev/null
    echo "Updated Keycloak client '${KEYCLOAK_CLIENT_ID}' in realm '${KEYCLOAK_REALM}'."
  else
    curl -sS --fail \
      -X POST \
      "${auth_header[@]}" \
      -H "Content-Type: application/json" \
      -d "$payload" \
      "${REALM_API}/clients" >/dev/null
    echo "Created Keycloak client '${KEYCLOAK_CLIENT_ID}' in realm '${KEYCLOAK_REALM}'."
  fi
}

assign_realm_role_to_admin_user() {
  local user_id role_payload
  user_id="$(
    curl -sS "${auth_header[@]}" "${REALM_API}/users?username=${KEYCLOAK_ADMIN}" | \
      python3 -c 'import json,sys; data=json.load(sys.stdin); print(data[0]["id"] if data else "")'
  )"
  if [[ -z "$user_id" ]]; then
    echo "Warning: Keycloak admin user '${KEYCLOAK_ADMIN}' was not found in realm '${KEYCLOAK_REALM}'." >&2
    return 0
  fi
  role_payload="$(
    curl -sS --fail \
      "${auth_header[@]}" \
      "${REALM_API}/roles/${KEYCLOAK_BOOTSTRAP_ADMIN_ROLE}"
  )"
  curl -sS --fail \
    -X POST \
    "${auth_header[@]}" \
    -H "Content-Type: application/json" \
    -d "[${role_payload}]" \
    "${REALM_API}/users/${user_id}/role-mappings/realm" >/dev/null || true
  echo "Ensured role '${KEYCLOAK_BOOTSTRAP_ADMIN_ROLE}' for user '${KEYCLOAK_ADMIN}'."
}

IFS=',' read -r -a role_names <<< "$KEYCLOAK_ALLOWED_ROLES"
for role in "${role_names[@]}"; do
  role="$(printf '%s' "$role" | xargs)"
  [[ -n "$role" ]] && ensure_realm_role "$role"
done

set_login_theme
ensure_backend_client
assign_realm_role_to_admin_user
