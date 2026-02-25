#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v magick >/dev/null 2>&1; then
  echo "Error: 'magick' command not found. Please install ImageMagick." >&2
  exit 1
fi

converted=0

while IFS= read -r -d '' src; do
  dir="$(dirname "$src")"
  file="$(basename "$src")"
  base="${file%.*}"
  dest="$dir/$base.webp"

  magick "$src" \
    -auto-orient \
    -strip \
    -resize '1000x1000>' \
    -quality 82 \
    -define webp:method=6 \
    "$dest"

  rm -f "$src"
  converted=$((converted + 1))
  echo "Converted: $src -> $dest"
done < <(find "$ROOT_DIR" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.avif' -o -iname '*.gif' -o -iname '*.tif' -o -iname '*.tiff' -o -iname '*.bmp' \) -print0)

echo "Done. Converted $converted file(s)."

SYNC_SCRIPT="$ROOT_DIR/../../scripts/sync_tours_from_images.py"
if [ -f "$SYNC_SCRIPT" ]; then
  python3 "$SYNC_SCRIPT"
fi
