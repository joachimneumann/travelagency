#!/usr/bin/env bash
set -euo pipefail

import_zsh_env() {
  command -v zsh >/dev/null 2>&1 || return 0
  local exported
  exported="$(zsh -ilc 'source ~/.zshrc >/dev/null 2>&1 || true; typeset -px KEYCLOAK_ENABLED KEYCLOAK_BASE_URL KEYCLOAK_REALM KEYCLOAK_CLIENT_ID KEYCLOAK_CLIENT_SECRET KEYCLOAK_REDIRECT_URI KEYCLOAK_ALLOWED_ROLES KEYCLOAK_POST_LOGOUT_REDIRECT_URI GOOGLE_SERVICE_ACCOUNT_JSON_PATH GOOGLE_IMPERSONATED_EMAIL OPENAI_API_KEY OPENAI_TRANSLATION_MODEL OPENAI_MODEL CORS_ORIGIN FRONTEND_PORT BACKEND_PORT 2>/dev/null' 2>/dev/null || true)"
  [ -n "$exported" ] || return 0
  eval "$exported"
}

import_zsh_env

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/start_local_keycloak.sh"
echo
"$ROOT_DIR/scripts/start_local_backend.sh"
echo
"$ROOT_DIR/scripts/start_local_frontend.sh"
