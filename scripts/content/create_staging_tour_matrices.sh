#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="${TOUR_MATRIX_OUTPUT_DIR:-$ROOT_DIR}"

mkdir -p "$OUTPUT_DIR"
rm -rf "$OUTPUT_DIR/img"

echo "Generating staging tour photo matrix..."
"$SCRIPT_DIR/create_tour_photo_matrix.sh" \
  --output "$OUTPUT_DIR/photo_matrix.html" \
  --no-zip

echo "Generating staging tour metadata matrix..."
"$SCRIPT_DIR/create_tour_meta.sh" \
  --output "$OUTPUT_DIR/meta_matrix.html" \
  --no-zip

echo "Generated staging tour matrices:"
echo "  $OUTPUT_DIR/photo_matrix.html"
echo "  $OUTPUT_DIR/meta_matrix.html"
