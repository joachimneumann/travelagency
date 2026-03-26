#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${1:-$ROOT_DIR/backup/atp_staff}"

PATHS_JSON="$(
  cd "$ROOT_DIR" && node --input-type=module - <<'EOF'
import { ATP_STAFF_PROFILES_PATH, ATP_STAFF_PHOTOS_DIR } from "./backend/app/src/config/runtime.js";
console.log(JSON.stringify({ profilesPath: ATP_STAFF_PROFILES_PATH, photosDir: ATP_STAFF_PHOTOS_DIR }));
EOF
)"

PROFILES_PATH="$(printf '%s' "$PATHS_JSON" | node --input-type=module -e 'let data=""; process.stdin.on("data", (chunk) => data += chunk); process.stdin.on("end", () => { const parsed = JSON.parse(data); console.log(parsed.profilesPath || ""); });')"
PHOTOS_DIR="$(printf '%s' "$PATHS_JSON" | node --input-type=module -e 'let data=""; process.stdin.on("data", (chunk) => data += chunk); process.stdin.on("end", () => { const parsed = JSON.parse(data); console.log(parsed.photosDir || ""); });')"

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
