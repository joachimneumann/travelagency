#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

SOURCE_DIR="${ONE_PAGERS_SOURCE_DIR:-content/one-pagers}"
STAGING_HOST="${STAGING_DEPLOY_HOST:-atp}"
STAGING_ROOT="${STAGING_DEPLOY_ROOT:-/srv/asiatravelplan-staging}"
STAGING_PATH="${STAGING_ONE_PAGERS_PATH:-content/one-pagers}"
STAGING_BASE_URL="${STAGING_BASE_URL:-https://staging.asiatravelplan.com}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/content/deploy_all_one-pagers.sh [options]

Deploys already generated one-pager matrix files to staging.
Run ./scripts/content/create_all_one-pagers.sh first when the local files need updating.

Options:
  --source DIR             Local generated folder. Default: content/one-pagers
  --staging-host HOST      SSH host for staging deploy. Default: atp
  --staging-root DIR       Staging checkout root. Default: /srv/asiatravelplan-staging
  --staging-path DIR       Path below staging root. Default: content/one-pagers
  --staging-base-url URL   Public staging base URL. Default: https://staging.asiatravelplan.com
  -h, --help               Show this help.

Environment overrides:
  ONE_PAGERS_SOURCE_DIR
  STAGING_DEPLOY_HOST
  STAGING_DEPLOY_ROOT
  STAGING_ONE_PAGERS_PATH
  STAGING_BASE_URL
EOF
}

resolve_source_dir() {
  local source="$1"
  case "$source" in
    /*)
      printf '%s\n' "$source"
      ;;
    *)
      printf '%s\n' "$ROOT_DIR/$source"
      ;;
  esac
}

normalize_staging_path() {
  local raw="${1#/}"
  raw="${raw%/}"
  if [[ -z "$raw" ]]; then
    echo "Staging path cannot be empty." >&2
    exit 1
  fi

  local old_ifs="$IFS"
  local segment
  IFS='/'
  for segment in $raw; do
    if [[ -z "$segment" || "$segment" == "." || "$segment" == ".." ]]; then
      IFS="$old_ifs"
      echo "Invalid staging path: $1" >&2
      exit 1
    fi
  done
  IFS="$old_ifs"

  printf '%s\n' "$raw"
}

public_url() {
  local base="${1%/}"
  local path_part="${2#/}"
  printf '%s/%s\n' "$base" "$path_part"
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE_DIR="${2:-}"
      shift 2
      ;;
    --staging-host)
      STAGING_HOST="${2:-}"
      shift 2
      ;;
    --staging-root)
      STAGING_ROOT="${2:-}"
      shift 2
      ;;
    --staging-path)
      STAGING_PATH="${2:-}"
      shift 2
      ;;
    --staging-base-url)
      STAGING_BASE_URL="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$STAGING_HOST" || -z "$STAGING_ROOT" || -z "$STAGING_PATH" || -z "$STAGING_BASE_URL" ]]; then
  echo "Staging host, root, path, and base URL are required." >&2
  usage >&2
  exit 1
fi

command -v ssh >/dev/null 2>&1 || {
  echo "Missing required command: ssh" >&2
  exit 1
}
command -v rsync >/dev/null 2>&1 || {
  echo "Missing required command: rsync" >&2
  exit 1
}

SOURCE_DIR="$(resolve_source_dir "$SOURCE_DIR")"
STAGING_ROOT="${STAGING_ROOT%/}"
STAGING_PATH="$(normalize_staging_path "$STAGING_PATH")"
REMOTE_DIR="$STAGING_ROOT/$STAGING_PATH"
REMOTE_TARGET="$STAGING_HOST:$REMOTE_DIR/"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Missing generated one-pager directory: $SOURCE_DIR" >&2
  echo "Run ./scripts/content/create_all_one-pagers.sh first." >&2
  exit 1
fi

if [[ ! -f "$SOURCE_DIR/index.html" ]]; then
  echo "Missing matrix page: $SOURCE_DIR/index.html" >&2
  echo "Run ./scripts/content/create_all_one-pagers.sh first." >&2
  exit 1
fi

printf 'Deploying one-pagers from %s to %s ...\n' "$SOURCE_DIR" "$REMOTE_TARGET"
ssh "$STAGING_HOST" "mkdir -p $(printf '%q' "$REMOTE_DIR")"
rsync -az --delete "$SOURCE_DIR/" "$REMOTE_TARGET"

printf 'Staging one-pagers: %s\n' "$(public_url "$STAGING_BASE_URL" "$STAGING_PATH/index.html")"
