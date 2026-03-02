#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/Users/internal_admin/projects/travelagency"
REMOTE_SCRIPT="./scripts/update_staging.sh"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/auto_commit_and_deploy.sh <backend_caddy|keycloak|all> <commit message...>

Examples:
  ./scripts/auto_commit_and_deploy.sh backend_caddy automatic commit
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

cd "$ROOT_DIR"

if [[ "$#" -eq 0 ]]; then
  usage
  exit 0
fi

if [[ "$#" -lt 2 ]]; then
  echo "You must provide a deployment target and a commit message." >&2
  usage >&2
  exit 1
fi

TARGET="$1"
shift
COMMIT_MESSAGE="$*"

git add -A
created_commit=0

collect_services "$TARGET"

if ! git diff --cached --quiet; then
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
