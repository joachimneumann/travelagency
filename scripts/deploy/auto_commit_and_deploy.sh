#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$HOME/projects/travelagency"
REMOTE_SCRIPT="./scripts/deploy/update_staging.sh"
readonly ALLOWED_ROOT_LEVEL_FILES=(
  ".env.staging.example"
  ".gitignore"
  "docker-compose.local-caddy.yml"
  "docker-compose.local-keycloak.yml"
  "docker-compose.staging.yml"
  "deploy"
  "robots-staging.txt"
  "site.webmanifest"
)

usage() {
  cat <<'EOF'
Usage:
  ./scripts/deploy/auto_commit_and_deploy.sh <backend_caddy|keycloak|all> [--all-files] <commit message...>

Examples:
  ./scripts/deploy/auto_commit_and_deploy.sh backend_caddy automatic commit
  ./scripts/deploy/auto_commit_and_deploy.sh backend_caddy --all-files ship everything
  ./scripts/deploy/auto_commit_and_deploy.sh keycloak tighten mobile auth layout
  ./scripts/deploy/auto_commit_and_deploy.sh all pricing partial payments
EOF
}

normalize_target() {
  case "$1" in
    backend_caddy)
      printf '%s\n' backend
      printf '%s\n' caddy
      ;;
    keycloak)
      printf '%s\n' keycloak
      ;;
    all)
      printf '%s\n' all
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown deployment target: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
}

collect_services() {
  local line
  SERVICES=()
  while IFS= read -r line; do
    [[ -n "$line" ]] && SERVICES+=("$line")
  done < <(normalize_target "$1")
}

should_run_tests() {
  local service
  for service in "$@"; do
    case "$service" in
      backend|caddy|all)
        return 0
        ;;
    esac
  done
  return 1
}

run_predeploy_tests() {
  echo "Running pre-deploy tests..."
  node --test \
    backend/app/test/mobile-contract.test.js \
    backend/app/test/source-integrity.test.js
}

is_allowed_root_level_file() {
  local candidate="$1"
  local allowed
  for allowed in "${ALLOWED_ROOT_LEVEL_FILES[@]}"; do
    if [[ "$candidate" == "$allowed" ]]; then
      return 0
    fi
  done
  return 1
}

assert_no_unexpected_staged_root_level_files() {
  local line status path root_name
  local unexpected=()
  while IFS=$'\t' read -r status path; do
    [[ -n "${status:-}" ]] || continue
    [[ -n "${path:-}" ]] || continue
    [[ "$path" == */* ]] && continue
    root_name="$path"
    case "$status" in
      D|R*D)
        continue
        ;;
    esac
    if ! is_allowed_root_level_file "$root_name"; then
      unexpected+=("$status $root_name")
    fi
  done < <(git diff --cached --name-status)

  if [[ "${#unexpected[@]}" -gt 0 ]]; then
    echo "Refusing to commit unexpected root-level staged files:" >&2
    printf '  %s\n' "${unexpected[@]}" >&2
    echo "Only known root-level deployment files may be committed through this script." >&2
    echo "Move the file under an expected directory, delete it, or commit it manually after review." >&2
    exit 1
  fi
}

default_stage_paths_for_target() {
  local target="$1"
  case "$target" in
    backend_caddy)
      printf '%s\n' \
        api/generated \
        assets \
        backend/app \
        deploy-config/Caddyfile \
        documentation \
        frontend \
        model \
        scripts \
        tools/generator
      ;;
    keycloak)
      printf '%s\n' \
        backend/keycloak-theme \
        deploy-config/Caddyfile \
        scripts
      ;;
    all)
      return 1
      ;;
    *)
      return 1
      ;;
  esac
}

cd "$ROOT_DIR"

if [[ "$#" -eq 0 ]]; then
  usage
  exit 1
fi

if [[ "$#" -lt 2 ]]; then
  echo "You must provide a deployment target and a commit message." >&2
  usage >&2
  exit 1
fi

TARGET="$1"
shift

ADD_ALL_FILES=0
if [[ "${1:-}" == "--all-files" ]]; then
  ADD_ALL_FILES=1
  shift
fi

COMMIT_MESSAGE="$*"

if [[ -z "${TARGET:-}" ]]; then
  echo "First parameter is required and must be one of: backend_caddy, keycloak, all." >&2
  usage >&2
  exit 1
fi

if [[ -z "${COMMIT_MESSAGE// }" ]]; then
  echo "Commit message must not be empty." >&2
  usage >&2
  exit 1
fi

created_commit=0

collect_services "$TARGET"
if [[ "${#SERVICES[@]}" -eq 0 ]]; then
  echo "No deployment services selected." >&2
  usage >&2
  exit 1
fi

if should_run_tests "${SERVICES[@]}"; then
  run_predeploy_tests
fi

if [[ "$ADD_ALL_FILES" -eq 1 || "$TARGET" == "all" ]]; then
  git add -A
else
  STAGE_PATHS=()
  while IFS= read -r path; do
    [[ -n "$path" ]] && STAGE_PATHS+=("$path")
  done < <(default_stage_paths_for_target "$TARGET")
  if [[ "${#STAGE_PATHS[@]}" -eq 0 ]]; then
    git add -A
  else
    git add -- "${STAGE_PATHS[@]}"
  fi
fi

assert_no_unexpected_staged_root_level_files

if ! git diff --cached --quiet; then
  echo "Staged files:"
  git --no-pager diff --cached --name-only
  GIT_EDITOR=true VISUAL=true EDITOR=true git commit -m "$COMMIT_MESSAGE"
  created_commit=1
fi

if [[ "$created_commit" -eq 0 ]]; then
  echo "No git changes to commit. Continuing with push and remote deployment."
fi

git push

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Local git status is not clean after push. Aborting remote deployment." >&2
  git --no-pager status --short
  exit 1
fi

remote_args="$(printf "%q " "${SERVICES[@]}")"
ssh atp "bash -lc 'cd /srv/asiatravelplan-staging && git pull --ff-only && $REMOTE_SCRIPT ${remote_args}'"
