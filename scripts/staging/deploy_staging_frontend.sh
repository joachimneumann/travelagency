#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_I18N_DEPLOY_WARNING=""
RUNTIME_I18N_DEPLOY_WARNING_LOG=""
source "$ROOT_DIR/scripts/lib/runtime_i18n.sh"
source "$ROOT_DIR/scripts/lib/public_homepage_assets.sh"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  ./scripts/staging/deploy_staging_frontend.sh

Refreshes staging static assets from the current checkout.
EOF
  exit 0
fi

cd "$ROOT_DIR"

record_runtime_i18n_deploy_warning() {
  local warning_message="$1"
  local command_log_path="$2"

  RUNTIME_I18N_DEPLOY_WARNING="$warning_message"
  RUNTIME_I18N_DEPLOY_WARNING_LOG="$command_log_path"
}

print_deploy_runtime_i18n_warning() {
  [[ -n "$RUNTIME_I18N_DEPLOY_WARNING" ]] || return 0
  print_runtime_i18n_deploy_warning staging "$RUNTIME_I18N_DEPLOY_WARNING_LOG" "$RUNTIME_I18N_DEPLOY_WARNING"
}

generate_runtime_i18n() {
  if run_runtime_i18n_generator_quiet "$ROOT_DIR"; then
    return 0
  fi

  local command_log_path
  command_log_path="$(runtime_i18n_generator_log_path).command"
  if runtime_i18n_failure_is_translation_sync_issue "$command_log_path"; then
    record_runtime_i18n_deploy_warning \
      "Runtime i18n generation found stale or missing translations during deployment." \
      "$command_log_path"
    echo "WARNING: Runtime i18n generation found stale or missing translations; deployment will continue with existing generated runtime i18n files." >&2
    return 0
  fi

  return 1
}

git fetch origin
git pull --ff-only
"$ROOT_DIR/scripts/assets/prepare_runtime_brand_logo.sh" staging
generate_runtime_i18n
run_public_homepage_asset_generator_quiet "$ROOT_DIR"
print_deploy_runtime_i18n_warning
