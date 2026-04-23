#!/usr/bin/env bash

deploy_context_root_dir() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

deploy_context_git_common_dir() {
  local root_dir="$1"
  local common_dir=""

  if ! common_dir="$(git -C "$root_dir" rev-parse --git-common-dir 2>/dev/null)"; then
    return 0
  fi

  if [[ -z "$common_dir" ]]; then
    return 0
  fi

  if [[ "$common_dir" != /* ]]; then
    common_dir="$(cd "$root_dir/$common_dir" && pwd)"
  fi

  printf '%s\n' "$common_dir"
}

deploy_context_match_environment() {
  local root_dir="$1"
  local common_dir=""
  common_dir="$(deploy_context_git_common_dir "$root_dir")"

  if [[ "$root_dir" == "$HOME/projects/travelagency" || "$common_dir" == "$HOME/projects/travelagency/.git" ]]; then
    printf '%s\n' local
    return 0
  fi

  if [[ "$root_dir" == "/srv/asiatravelplan" || "$common_dir" == "/srv/asiatravelplan/.git" ]]; then
    printf '%s\n' production
    return 0
  fi

  if [[ "$root_dir" == "/srv/asiatravelplan-staging" || "$common_dir" == "/srv/asiatravelplan-staging/.git" ]]; then
    printf '%s\n' staging
    return 0
  fi

  return 1
}

deploy_context_environment() {
  local root_dir
  root_dir="$(deploy_context_root_dir)"
  if deploy_context_match_environment "$root_dir"; then
    return 0
  fi

  echo "Unsupported checkout root: $root_dir" >&2
  echo "Supported roots: $HOME/projects/travelagency, /srv/asiatravelplan, /srv/asiatravelplan-staging" >&2
  echo "Git worktrees attached to those roots are also supported." >&2
  return 1
}

deploy_context_require_root_pwd() {
  local root_dir
  root_dir="$(deploy_context_root_dir)"

  if [[ "$PWD" != "$root_dir" ]]; then
    echo "Run this command from $root_dir." >&2
    echo "Current directory: $PWD" >&2
    return 1
  fi
}

deploy_context_resolve_entrypoint() {
  local component="$1"
  local environment="$2"
  local root_dir
  root_dir="$(deploy_context_root_dir)"

  case "$component:$environment" in
    frontend:local)
      printf '%s\n' "$root_dir/scripts/local/deploy_local_frontend.sh"
      ;;
    frontend:staging)
      printf '%s\n' "$root_dir/scripts/staging/deploy_staging_frontend.sh"
      ;;
    frontend:production)
      printf '%s\n' "$root_dir/scripts/production/deploy_production_frontend.sh"
      ;;
    backend:local)
      printf '%s\n' "$root_dir/scripts/local/deploy_local_backend.sh"
      ;;
    backend:staging)
      printf '%s\n' "$root_dir/scripts/staging/deploy_staging_backend.sh"
      ;;
    backend:production)
      printf '%s\n' "$root_dir/scripts/production/deploy_production_backend.sh"
      ;;
    backend_frontend:local)
      printf '%s\n' "$root_dir/scripts/local/deploy_local_backend_frontend.sh"
      ;;
    backend_frontend:staging)
      printf '%s\n' "$root_dir/scripts/staging/deploy_staging_backend_frontend.sh"
      ;;
    backend_frontend:production)
      printf '%s\n' "$root_dir/scripts/production/deploy_production_backend_frontend.sh"
      ;;
    keycloak:local)
      printf '%s\n' "$root_dir/scripts/local/start_local_keycloak.sh"
      ;;
    keycloak:staging)
      printf '%s\n' "$root_dir/scripts/deploy/update_staging.sh"
      ;;
    keycloak:production)
      printf '%s\n' "$root_dir/scripts/deploy/update_production.sh"
      ;;
    all:local)
      printf '%s\n' "$root_dir/scripts/local/deploy_local_all.sh"
      ;;
    all:staging)
      printf '%s\n' "$root_dir/scripts/staging/deploy_staging_all.sh"
      ;;
    all:production)
      printf '%s\n' "$root_dir/scripts/production/deploy_production_all.sh"
      ;;
    *)
      echo "Unsupported deploy target: $component ($environment)" >&2
      return 1
      ;;
  esac
}

deploy_context_usage() {
  local command_name="$1"
  local component="$2"

  cat <<EOF
Usage:
  ./$command_name [args...]

This directory-aware wrapper must be run from one of these checkout roots:
  $HOME/projects/travelagency
  /srv/asiatravelplan
  /srv/asiatravelplan-staging

Git worktrees attached to those checkouts are also supported.

It dispatches "$component" to the existing environment-specific deploy script
for the current checkout.
EOF
}

deploy_context_exec() {
  local component="$1"
  local command_name="$2"
  shift 2

  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    deploy_context_usage "$command_name" "$component"
    return 0
  fi

  deploy_context_require_root_pwd

  local environment
  local entrypoint
  environment="$(deploy_context_environment)"
  entrypoint="$(deploy_context_resolve_entrypoint "$component" "$environment")"

  case "$component:$environment" in
    keycloak:staging|keycloak:production)
      exec "$entrypoint" keycloak "$@"
      ;;
    *)
      exec "$entrypoint" "$@"
      ;;
  esac
}
