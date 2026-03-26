#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${1:-}"

if [[ -z "$SOURCE_DIR" ]]; then
  echo "Usage: ./scripts/import_atp_staff_content.sh <source-dir>" >&2
  exit 1
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source directory does not exist: $SOURCE_DIR" >&2
  exit 1
fi

if [[ ! -f "$SOURCE_DIR/staff.json" ]]; then
  echo "Source staff.json is missing: $SOURCE_DIR/staff.json" >&2
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

mkdir -p "$(dirname "$PROFILES_PATH")" "$PHOTOS_DIR"
cp "$SOURCE_DIR/staff.json" "$PROFILES_PATH"

if [[ -d "$SOURCE_DIR/photos" ]]; then
  find "$PHOTOS_DIR" -mindepth 1 -maxdepth 1 -type f -delete
  cp -R "$SOURCE_DIR/photos"/. "$PHOTOS_DIR/" 2>/dev/null || true
fi

echo "Imported ATP staff content from $SOURCE_DIR"
echo "  staff.json: $PROFILES_PATH"
echo "  photos:     $PHOTOS_DIR"
