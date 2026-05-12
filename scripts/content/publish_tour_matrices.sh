#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

OUTPUT_DIR="${TOUR_MATRIX_OUTPUT_DIR:-$ROOT_DIR}"
TOURS_DIR="$ROOT_DIR/content/tours"
CATALOG_PATH="$ROOT_DIR/content/tours/destinations.json"
HIGHLIGHT_MANIFEST_PATH="$ROOT_DIR/assets/img/experience-highlights/manifest.json"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/content/publish_tour_matrices.sh [options]

Generates and publishes the tour matrix HTML pages into a served directory.
On staging, run this from /srv/asiatravelplan-staging to refresh:
  https://staging.asiatravelplan.com/photo_matrix.html
  https://staging.asiatravelplan.com/meta_matrix.html

Options:
  --output-dir DIR              Publish directory. Default: repo root, or TOUR_MATRIX_OUTPUT_DIR.
  --tours DIR                   Tours directory. Default: content/tours
  --catalog FILE                Destination catalog. Default: content/tours/destinations.json
  --highlight-manifest FILE     Highlight manifest. Default: assets/img/experience-highlights/manifest.json
  --help                        Show this help.
EOF
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --output-dir)
      [[ -n "${2:-}" ]] || { echo "--output-dir requires a directory." >&2; exit 1; }
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --tours)
      [[ -n "${2:-}" ]] || { echo "--tours requires a directory." >&2; exit 1; }
      TOURS_DIR="$2"
      shift 2
      ;;
    --catalog)
      [[ -n "${2:-}" ]] || { echo "--catalog requires a file path." >&2; exit 1; }
      CATALOG_PATH="$2"
      shift 2
      ;;
    --highlight-manifest)
      [[ -n "${2:-}" ]] || { echo "--highlight-manifest requires a file path." >&2; exit 1; }
      HIGHLIGHT_MANIFEST_PATH="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

OUTPUT_DIR="$(cd "$ROOT_DIR" && mkdir -p "$OUTPUT_DIR" && cd "$OUTPUT_DIR" && pwd)"
TOURS_DIR="$(cd "$ROOT_DIR" && cd "$TOURS_DIR" && pwd)"
CATALOG_PATH="$(cd "$ROOT_DIR" && cd "$(dirname "$CATALOG_PATH")" && printf '%s/%s\n' "$PWD" "$(basename "$CATALOG_PATH")")"
HIGHLIGHT_MANIFEST_PATH="$(cd "$ROOT_DIR" && cd "$(dirname "$HIGHLIGHT_MANIFEST_PATH")" && printf '%s/%s\n' "$PWD" "$(basename "$HIGHLIGHT_MANIFEST_PATH")")"

if [[ "$OUTPUT_DIR" == "/" ]]; then
  echo "Refusing to publish matrices into /." >&2
  exit 1
fi

rm -rf "$OUTPUT_DIR/img"
rm -f "$OUTPUT_DIR/photo_matrix.html" "$OUTPUT_DIR/meta_matrix.html"

echo "Generating and publishing tour photo matrix..."
"$SCRIPT_DIR/create_tour_photo_matrix.sh" \
  --tours "$TOURS_DIR" \
  --output "$OUTPUT_DIR/photo_matrix.html" \
  --no-zip

echo "Generating and publishing tour metadata matrix..."
"$SCRIPT_DIR/create_tour_meta.sh" \
  --tours "$TOURS_DIR" \
  --catalog "$CATALOG_PATH" \
  --highlight-manifest "$HIGHLIGHT_MANIFEST_PATH" \
  --output "$OUTPUT_DIR/meta_matrix.html" \
  --no-zip

echo "Published tour matrices:"
echo "  $OUTPUT_DIR/photo_matrix.html"
echo "  $OUTPUT_DIR/meta_matrix.html"
