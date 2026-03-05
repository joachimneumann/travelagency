#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$HOME/projects/travelagency"
REMOTE_SCRIPT="./scripts/update_staging.sh"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/auto_commit_and_deploy.sh <backend_caddy|keycloak|all> [--all-files] <commit message...>

Examples:
  ./scripts/auto_commit_and_deploy.sh backend_caddy automatic commit
  ./scripts/auto_commit_and_deploy.sh backend_caddy --all-files ship everything
  ./scripts/auto_commit_and_deploy.sh keycloak tighten mobile auth layout
  ./scripts/auto_commit_and_deploy.sh all pricing partial payments
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

default_stage_paths_for_target() {
  local target="$1"
  case "$target" in
    backend_caddy)
      printf '%s\n' \
        api/generated \
        assets \
        backend/app \
        deploy/Caddyfile \
        documentation \
        frontend \
        model \
        scripts \
        tools/generator
      ;;
    keycloak)
      printf '%s\n' \
        backend/keycloak-theme \
        deploy/Caddyfile \
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

if ! git diff --cached --quiet; then
  echo "Staged files:"
  git diff --cached --name-only
  git commit -m "$COMMIT_MESSAGE"
  created_commit=1
fi

if [[ "$created_commit" -eq 0 ]]; then
  echo "No git changes to commit. Skipping push and remote deployment."
  exit 0
fi

git push

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Local git status is not clean after push. Aborting remote deployment." >&2
  git status --short
  exit 1
fi

remote_args="$(printf "%q " "${SERVICES[@]}")"
ssh atp "bash -lc 'cd /srv/asiatravelplan && git pull --ff-only && $REMOTE_SCRIPT ${remote_args}'"
