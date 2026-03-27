#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_HOST="${1:-atp}"
REMOTE_DIR="${2:-/srv/asiatravelplan/content/atp_staff}"
CONTENT_DIR="$ROOT_DIR/content/atp_staff"
PROFILES_PATH="$CONTENT_DIR/staff.json"
PHOTOS_DIR="$CONTENT_DIR/photos"

if [[ -z "$REMOTE_HOST" ]]; then
  echo "Usage: ./scripts/export_atp_staff_content.sh [remote-host] [remote-dir]" >&2
  exit 1
fi

ssh "$REMOTE_HOST" "mkdir -p '$REMOTE_DIR/photos'"

if [[ -f "$PROFILES_PATH" ]]; then
  scp "$PROFILES_PATH" "$REMOTE_HOST:$REMOTE_DIR/staff.json"
else
  empty_json_tmp="$(mktemp)"
  printf '{\n  "staff": {}\n}\n' > "$empty_json_tmp"
  scp "$empty_json_tmp" "$REMOTE_HOST:$REMOTE_DIR/staff.json"
  rm -f "$empty_json_tmp"
fi

if [[ -d "$PHOTOS_DIR" ]]; then
  ssh "$REMOTE_HOST" "find '$REMOTE_DIR/photos' -mindepth 1 -maxdepth 1 -type f -delete"
  while IFS= read -r -d '' photo_path; do
    scp "$photo_path" "$REMOTE_HOST:$REMOTE_DIR/photos/"
  done < <(find "$PHOTOS_DIR" -mindepth 1 -maxdepth 1 -type f -print0)
fi

echo "Exported ATP staff content to $REMOTE_HOST:$REMOTE_DIR"
echo "  staff.json: $REMOTE_HOST:$REMOTE_DIR/staff.json"
echo "  photos:     $REMOTE_HOST:$REMOTE_DIR/photos"
