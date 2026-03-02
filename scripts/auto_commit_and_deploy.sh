#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/Users/internal_admin/projects/travelagency"
REMOTE_SCRIPT="./scripts/update_staging.sh"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/auto_commit_and_deploy.sh [backend|caddy|keycloak|all]...

Examples:
  ./scripts/auto_commit_and_deploy.sh backend
  ./scripts/auto_commit_and_deploy.sh keycloak
  ./scripts/auto_commit_and_deploy.sh all
  ./scripts/auto_commit_and_deploy.sh backend caddy

No arguments:
  show this help and exit
EOF
}

normalize_services() {
  if [[ "$#" -eq 0 ]]; then
    return 0
  fi

  for arg in "$@"; do
    case "$arg" in
      backend|caddy|keycloak|all)
        printf '%s\n' "$arg"
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

collect_services() {
  local line
  SERVICES=()
  while IFS= read -r line; do
    [[ -n "$line" ]] && SERVICES+=("$line")
  done < <(normalize_services "$@")
}

cd "$ROOT_DIR"

if [[ "$#" -eq 0 ]]; then
  usage
  exit 0
fi

git add -A
created_commit=0

collect_services "$@"

if ! git diff --cached --quiet; then
  git commit -m "automatic commit"
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

if [[ "${#SERVICES[@]}" -eq 0 ]]; then
  echo "No deployment target specified. Skipping remote deployment."
  exit 0
fi

remote_args="$(printf "%q " "${SERVICES[@]}")"
ssh atp "bash -lc 'cd /srv/asiatravelplan && git pull --ff-only && $REMOTE_SCRIPT ${remote_args}'"
