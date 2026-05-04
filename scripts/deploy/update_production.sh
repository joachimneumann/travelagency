#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env"
PROJECT_NAME="${PROJECT_NAME:-asiatravelplan}"
RUNTIME_BRAND_LOGO_PREPARER="${RUNTIME_BRAND_LOGO_PREPARER:-$ROOT_DIR/scripts/assets/prepare_runtime_brand_logo.sh}"
RUNTIME_I18N_DEPLOY_WARNING=""
RUNTIME_I18N_DEPLOY_WARNING_LOG=""

source "$ROOT_DIR/scripts/lib/docker_runtime.sh"
source "$ROOT_DIR/scripts/lib/runtime_i18n.sh"
source "$ROOT_DIR/scripts/lib/public_homepage_assets.sh"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/deploy/update_production.sh [backend|keycloak|all]...

Examples:
  ./scripts/deploy/update_production.sh backend
  ./scripts/deploy/update_production.sh keycloak
  ./scripts/deploy/update_production.sh all
EOF
}

should_run_tests() {
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

run_production_tests() {
  echo "Running production pre-deploy tests..."
  docker_compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build backend
  docker_compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps backend \
    node --test test/mobile-contract.test.js test/source-integrity.test.js test/http_routes.test.js
}

record_runtime_i18n_deploy_warning() {
  local warning_message="$1"
  local command_log_path="$2"

  RUNTIME_I18N_DEPLOY_WARNING="$warning_message"
  RUNTIME_I18N_DEPLOY_WARNING_LOG="$command_log_path"
}

print_deploy_runtime_i18n_warning() {
  [[ -n "$RUNTIME_I18N_DEPLOY_WARNING" ]] || return 0
  print_runtime_i18n_deploy_warning production "$RUNTIME_I18N_DEPLOY_WARNING_LOG" "$RUNTIME_I18N_DEPLOY_WARNING"
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
  echo "Preparing production runtime brand logo..."
  "$RUNTIME_BRAND_LOGO_PREPARER" production
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

dump_startup_diagnostics() {
  local exit_code="$1"

  echo "Production compose startup failed with exit code $exit_code." >&2
  echo "--- docker compose ps ---" >&2
  docker_compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps >&2 || true

  echo "--- keycloak logs (last 200 lines) ---" >&2
  docker_compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail 200 keycloak >&2 || true

  echo "--- postgres logs (last 200 lines) ---" >&2
  docker_compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail 200 postgres >&2 || true
}

cd "$ROOT_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$ENV_FILE is missing in $ROOT_DIR" >&2
  exit 1
fi

mapfile -t SERVICES < <(normalize_services "$@")

if should_run_tests "${SERVICES[@]}"; then
  run_production_tests
fi

prepare_runtime_brand_logo
generate_runtime_i18n
generate_public_homepage_assets

mkdir -p backend/app/data backend/app/data/tmp content logs

compose_up_exit_code=0
docker_compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build --force-recreate "${SERVICES[@]}" || compose_up_exit_code=$?
if [[ "$compose_up_exit_code" -ne 0 ]]; then
  dump_startup_diagnostics "$compose_up_exit_code"
  exit "$compose_up_exit_code"
fi

if should_sync_atp_staff "${SERVICES[@]}"; then
  echo "Syncing ATP staff names from Keycloak ..."
  docker_compose -p "$PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps backend \
    node scripts/sync_atp_staff_from_keycloak.js
fi

print_deploy_runtime_i18n_warning
