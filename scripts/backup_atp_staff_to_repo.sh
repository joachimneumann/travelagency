#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${1:-$ROOT_DIR/backup/atp_staff}"
CONTENT_DIR="$ROOT_DIR/content/atp_staff"
PROFILES_PATH="$CONTENT_DIR/staff.json"
PHOTOS_DIR="$CONTENT_DIR/photos"

mkdir -p "$BACKUP_DIR/photos"

if [[ -f "$PROFILES_PATH" ]]; then
  cp "$PROFILES_PATH" "$BACKUP_DIR/staff.json"
else
  printf '{\n  "staff": {}\n}\n' > "$BACKUP_DIR/staff.json"
fi

find "$BACKUP_DIR/photos" -mindepth 1 -maxdepth 1 -type f ! -name '.gitkeep' -delete
if [[ -d "$PHOTOS_DIR" ]]; then
  cp -R "$PHOTOS_DIR"/. "$BACKUP_DIR/photos/" 2>/dev/null || true
fi

echo "Backed up ATP staff content to $BACKUP_DIR"
echo "  staff.json: $BACKUP_DIR/staff.json"
echo "  photos:     $BACKUP_DIR/photos"
