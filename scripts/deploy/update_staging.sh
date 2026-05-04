#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="docker-compose.staging.yml"
ENV_FILE=".env"
PROJECT_NAME="${PROJECT_NAME:-asiatravelplan-staging}"
RUNTIME_BRAND_LOGO_PREPARER="${RUNTIME_BRAND_LOGO_PREPARER:-$ROOT_DIR/scripts/assets/prepare_runtime_brand_logo.sh}"
SKIP_TESTS="${SKIP_TESTS:-0}"
RUNTIME_I18N_DEPLOY_WARNING=""
RUNTIME_I18N_DEPLOY_WARNING_LOG=""

source "$ROOT_DIR/scripts/lib/docker_runtime.sh"
source "$ROOT_DIR/scripts/lib/runtime_i18n.sh"
source "$ROOT_DIR/scripts/lib/public_homepage_assets.sh"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/deploy/update_staging.sh [backend|keycloak|all]...

Examples:
  ./scripts/deploy/update_staging.sh backend
  ./scripts/deploy/update_staging.sh keycloak
  ./scripts/deploy/update_staging.sh all
  ./scripts/deploy/update_staging.sh backend keycloak

To bypass staging pre-deploy tests for urgent backend deploys:
  SKIP_TESTS=1 ./scripts/deploy/update_staging.sh backend
EOF
}

normalize_services() {
  if [[ "$#" -eq 0 ]]; then
    printf '%s\n' backend
    return
  fi

  for arg in "$@"; do
    case "$arg" in
      backend|keycloak)
        printf '%s\n' "$arg"
        ;;
      all)
        printf '%s\n' backend keycloak
        ;;
      caddy)
        echo "Staging Caddy is no longer managed by update_staging.sh." >&2
        echo "Use /srv/asiatravelplan/scripts/production/deploy_production_caddy.sh to reload the shared public Caddy stack (project asiatravelplan-public)." >&2
        exit 1
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown service: $arg" >&2
        usage >&2
        exit 1
        ;;
    esac
  done | awk '!seen[$0]++'
}

should_run_tests() {
  if [[ "$SKIP_TESTS" == "1" ]]; then
    return 1
  fi

  local service
  for service in "$@"; do
    case "$service" in
      backend)
        return 0
        ;;
    esac
  done
  return 1
}

run_staging_tests() {
  echo "Running staging pre-deploy tests..."
  docker_compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build backend
  docker_compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps backend \
    env WEB_INQUIRY_NOTIFICATION_ENABLED=false \
    node --test test/mobile-contract.test.js test/source-integrity.test.js
}

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

validate_runtime_i18n_snapshots() {
  refresh_runtime_i18n_source_catalogs "$ROOT_DIR"
  echo "Validating runtime i18n snapshots..."
  if validate_runtime_i18n_snapshots_quiet "$ROOT_DIR"; then
    return 0
  fi

  local command_log_path
  command_log_path="$(runtime_i18n_check_log_path).command"
  if runtime_i18n_failure_is_translation_sync_issue "$command_log_path"; then
    record_runtime_i18n_deploy_warning \
      "Runtime i18n validation found stale or missing translation snapshots before deployment." \
      "$command_log_path"
    echo "WARNING: Runtime i18n validation found stale or missing translations; deployment will continue." >&2
    return 0
  fi

  return 1
}

generate_public_homepage_assets() {
  echo "Generating static homepage tours/team assets..."
  run_public_homepage_asset_generator_quiet "$ROOT_DIR"
}

generate_runtime_i18n() {
  refresh_runtime_i18n_source_catalogs "$ROOT_DIR"
  echo "Generating runtime i18n from content/translations..."
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

prepare_runtime_brand_logo() {
  echo "Preparing staging runtime brand logo..."
  "$RUNTIME_BRAND_LOGO_PREPARER" staging
}

should_sync_atp_staff() {
  local service
  for service in "$@"; do
    case "$service" in
      keycloak|backend)
        return 0
        ;;
    esac
  done
  return 1
}

cd "$ROOT_DIR"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

SERVICES_OUTPUT="$(normalize_services "$@")"
SERVICES=()
while IFS= read -r service; do
  [[ -z "$service" ]] && continue
  SERVICES+=("$service")
done <<< "$SERVICES_OUTPUT"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$ENV_FILE is missing in $ROOT_DIR" >&2
  exit 1
fi

git fetch origin
git pull --ff-only

validate_runtime_i18n_snapshots

if should_run_tests "${SERVICES[@]}"; then
  run_staging_tests
elif [[ "$SKIP_TESTS" == "1" ]]; then
  echo "Skipping staging pre-deploy tests because SKIP_TESTS=1."
fi

mkdir -p frontend/data/generated/homepage assets/generated/homepage

prepare_runtime_brand_logo
generate_runtime_i18n
generate_public_homepage_assets

mkdir -p backend/app/data

docker_compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --force-recreate "${SERVICES[@]}"

if should_sync_atp_staff "${SERVICES[@]}"; then
  echo "Syncing ATP staff names from Keycloak ..."
  docker_compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps backend \
    node scripts/sync_atp_staff_from_keycloak.js
fi

print_deploy_runtime_i18n_warning
