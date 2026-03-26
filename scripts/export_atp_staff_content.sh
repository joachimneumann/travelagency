#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${1:-}"

if [[ -z "$TARGET_DIR" ]]; then
  echo "Usage: ./scripts/export_atp_staff_content.sh <target-dir>" >&2
  exit 1
fi

PATHS_JSON="$(
  cd "$ROOT_DIR" && node --input-type=module - <<'EOF'
import { ATP_STAFF_PROFILES_PATH, ATP_STAFF_PHOTOS_DIR } from "./backend/app/src/config/runtime.js";
console.log(JSON.stringify({ profilesPath: ATP_STAFF_PROFILES_PATH, photosDir: ATP_STAFF_PHOTOS_DIR }));
EOF
)"

PROFILES_PATH="$(printf '%s' "$PATHS_JSON" | node --input-type=module -e 'let data=""; process.stdin.on("data", (chunk) => data += chunk); process.stdin.on("end", () => { const parsed = JSON.parse(data); console.log(parsed.profilesPath || ""); });')"
PHOTOS_DIR="$(printf '%s' "$PATHS_JSON" | node --input-type=module -e 'let data=""; process.stdin.on("data", (chunk) => data += chunk); process.stdin.on("end", () => { const parsed = JSON.parse(data); console.log(parsed.photosDir || ""); });')"

mkdir -p "$TARGET_DIR/photos"

if [[ -f "$PROFILES_PATH" ]]; then
  cp "$PROFILES_PATH" "$TARGET_DIR/staff.json"
else
  printf '{\n  "staff": {}\n}\n' > "$TARGET_DIR/staff.json"
fi

if [[ -d "$PHOTOS_DIR" ]]; then
  cp -R "$PHOTOS_DIR"/. "$TARGET_DIR/photos/" 2>/dev/null || true
fi

echo "Exported ATP staff content to $TARGET_DIR"
echo "  staff.json: $TARGET_DIR/staff.json"
echo "  photos:     $TARGET_DIR/photos"
