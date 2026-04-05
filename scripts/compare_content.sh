#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_HOST="${REMOTE_HOST:-atp}"
REMOTE_CONTENT_ROOT="${REMOTE_CONTENT_ROOT:-/srv/asiatravelplan-staging/content}"

IGNORE_FIND_ARGS=(
  "!"
  -name ".DS_Store"
  "!"
  -name ".gitkeep"
  "!"
  -name "staff.json.audit.log"
)

RSYNC_COMPARE_EXCLUDES=(
  --exclude ".DS_Store"
  --exclude ".gitkeep"
  --exclude "staff.json.audit.log"
)

latest_local_info() {
  local dir="$1"
  find "$dir" -type f "${IGNORE_FIND_ARGS[@]}" -print0 \
    | xargs -0 stat -f '%m %N' 2>/dev/null \
    | sort -nr \
    | head -n 1
}

latest_remote_info() {
  local dir="$1"
  ssh "$REMOTE_HOST" "find '$dir' -type f ! -name '.DS_Store' ! -name '.gitkeep' ! -name 'staff.json.audit.log' -exec stat -c '%Y %n' {} + | sort -nr | head -n 1"
}

print_section() {
  local label="$1"
  local local_dir="$2"
  local remote_dir="$3"
  local diff_output local_info remote_info local_epoch remote_epoch newer

  printf '%s\n' "$label"

  diff_output="$(
    rsync -rcni --delete --out-format='%i %n' "${RSYNC_COMPARE_EXCLUDES[@]}" "$local_dir/" "${REMOTE_HOST}:${remote_dir}/"
  )"

  if [ -z "$diff_output" ]; then
    printf '%s\n\n' "content identical"
    return
  fi

  local_info="$(latest_local_info "$local_dir")"
  remote_info="$(latest_remote_info "$remote_dir")"

  local_epoch="${local_info%% *}"
  remote_epoch="${remote_info%% *}"

  local_epoch="${local_epoch:-0}"
  remote_epoch="${remote_epoch:-0}"

  if [ "$local_epoch" -gt "$remote_epoch" ]; then
    newer="localhost is newer"
  elif [ "$local_epoch" -lt "$remote_epoch" ]; then
    newer="atp is newer"
  else
    newer="timestamps match"
  fi

  if [ "$newer" = "timestamps match" ]; then
    printf '%s\n' "content differs, timestamps match"
  else
    printf '%s\n' "content differs, $newer"
  fi

  printf '%s\n\n' "$diff_output" | head -n 10
}

print_section "ATP staff" "$ROOT_DIR/content/atp_staff" "$REMOTE_CONTENT_ROOT/atp_staff"
print_section "Tours" "$ROOT_DIR/content/tours" "$REMOTE_CONTENT_ROOT/tours"
