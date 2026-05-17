#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

OUTPUT_DIR="${TOUR_MATRIX_OUTPUT_DIR:-$ROOT_DIR}"
TOURS_DIR="$ROOT_DIR/content/tours"
CATALOG_PATH="$ROOT_DIR/content/tours/destinations.json"
HIGHLIGHT_MANIFEST_PATH="$ROOT_DIR/assets/img/experience-highlights/manifest.json"
ONE_PAGERS_OUTPUT_DIR="${ONE_PAGERS_OUTPUT_DIR:-}"
PDF_CACHE_DIR="${PUBLIC_TOUR_PDF_CACHE_DIR:-}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/content/publish_tour_matrices.sh [options]

Generates and publishes the tour matrix HTML pages into a served directory.
On staging, run this from /srv/asiatravelplan-staging to refresh:
  https://staging.asiatravelplan.com/photo_matrix.html
  https://staging.asiatravelplan.com/meta_matrix.html
  https://staging.asiatravelplan.com/content_matrix.html
  https://staging.asiatravelplan.com/content_matrix_vi.html
  https://staging.asiatravelplan.com/content_matrix_ja.html
  https://staging.asiatravelplan.com/one_pager_matrix.html
  https://staging.asiatravelplan.com/travel_plan_matrix.html

Options:
  --output-dir DIR              Publish directory. Default: repo root, or TOUR_MATRIX_OUTPUT_DIR.
  --tours DIR                   Tours directory. Default: content/tours
  --catalog FILE                Destination catalog. Default: content/tours/destinations.json
  --highlight-manifest FILE     Highlight manifest. Default: assets/img/experience-highlights/manifest.json
  --one-pagers-output-dir DIR   One-pager PDF/image output directory. Default: content/one-pagers.
  --pdf-cache-dir DIR           Public tour PDF cache root. Default: backend runtime cache.
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
    --one-pagers-output-dir)
      [[ -n "${2:-}" ]] || { echo "--one-pagers-output-dir requires a directory." >&2; exit 1; }
      ONE_PAGERS_OUTPUT_DIR="$2"
      shift 2
      ;;
    --pdf-cache-dir)
      [[ -n "${2:-}" ]] || { echo "--pdf-cache-dir requires a directory." >&2; exit 1; }
      PDF_CACHE_DIR="$2"
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
if [[ -n "$ONE_PAGERS_OUTPUT_DIR" ]]; then
  ONE_PAGERS_OUTPUT_DIR="$(cd "$ROOT_DIR" && mkdir -p "$ONE_PAGERS_OUTPUT_DIR" && cd "$ONE_PAGERS_OUTPUT_DIR" && pwd)"
fi
if [[ -n "$PDF_CACHE_DIR" ]]; then
  PDF_CACHE_DIR="$(cd "$ROOT_DIR" && mkdir -p "$PDF_CACHE_DIR" && cd "$PDF_CACHE_DIR" && pwd)"
fi

if [[ "$OUTPUT_DIR" == "/" ]]; then
  echo "Refusing to publish matrices into /." >&2
  exit 1
fi

if [[ ! -w "$OUTPUT_DIR" ]]; then
  echo "Tour matrix output directory is not writable by uid $(id -u):gid $(id -g): $OUTPUT_DIR" >&2
  exit 1
fi

if [[ -n "$ONE_PAGERS_OUTPUT_DIR" && ! -w "$ONE_PAGERS_OUTPUT_DIR" ]]; then
  echo "One-pager output directory is not writable by uid $(id -u):gid $(id -g): $ONE_PAGERS_OUTPUT_DIR" >&2
  exit 1
fi
if [[ -n "$PDF_CACHE_DIR" && ! -w "$PDF_CACHE_DIR" ]]; then
  echo "PDF cache directory is not writable by uid $(id -u):gid $(id -g): $PDF_CACHE_DIR" >&2
  exit 1
fi

if [[ ! -d "$ROOT_DIR/backend/app/node_modules" ]]; then
  echo "Missing backend/app/node_modules. Run npm install in backend/app first." >&2
  exit 1
fi

export ONE_PAGER_FONT_DIR="${ONE_PAGER_FONT_DIR:-$ROOT_DIR/content/fonts}"

rm -rf "$OUTPUT_DIR/img"
rm -f \
  "$OUTPUT_DIR/photo_matrix.html" \
  "$OUTPUT_DIR/meta_matrix.html" \
  "$OUTPUT_DIR/content_matrix.html" \
  "$OUTPUT_DIR/content_matrix_vi.html" \
  "$OUTPUT_DIR/content_matrix_ja.html" \
  "$OUTPUT_DIR/one_pager_matrix.html" \
  "$OUTPUT_DIR/travel_plan_matrix.html"

echo "Generating and publishing tour photo matrix..."
"$SCRIPT_DIR/create_tour_photo_matrix.sh" \
  --tours "$TOURS_DIR" \
  --output "$OUTPUT_DIR/photo_matrix.html"

echo "Generating and publishing tour metadata matrix..."
"$SCRIPT_DIR/create_tour_meta.sh" \
  --tours "$TOURS_DIR" \
  --catalog "$CATALOG_PATH" \
  --highlight-manifest "$HIGHLIGHT_MANIFEST_PATH" \
  --output "$OUTPUT_DIR/meta_matrix.html"

echo "Generating and publishing tour content matrix (English)..."
node "$SCRIPT_DIR/create_tour_content_matrix.mjs" english \
  --tours "$TOURS_DIR" \
  --output "$OUTPUT_DIR/content_matrix.html"

echo "Generating and publishing tour content matrix (Vietnamese)..."
node "$SCRIPT_DIR/create_tour_content_matrix.mjs" vietnamese \
  --tours "$TOURS_DIR" \
  --output "$OUTPUT_DIR/content_matrix_vi.html"

echo "Generating and publishing tour content matrix (Japanese)..."
node "$SCRIPT_DIR/create_tour_content_matrix.mjs" japanese \
  --tours "$TOURS_DIR" \
  --output "$OUTPUT_DIR/content_matrix_ja.html"

echo "Generating and publishing one-pager and travel-plan PDF matrices..."
ONE_PAGER_ARGS=(
  --tours "$TOURS_DIR"
  --highlight-manifest "$HIGHLIGHT_MANIFEST_PATH"
  --matrix-output "$OUTPUT_DIR/one_pager_matrix.html"
  --travel-plan-matrix-output "$OUTPUT_DIR/travel_plan_matrix.html"
)
if [[ -n "$ONE_PAGERS_OUTPUT_DIR" ]]; then
  ONE_PAGER_ARGS+=(--output "$ONE_PAGERS_OUTPUT_DIR")
fi
if [[ -n "$PDF_CACHE_DIR" ]]; then
  ONE_PAGER_ARGS+=(--pdf-cache-dir "$PDF_CACHE_DIR")
fi
node "$SCRIPT_DIR/create_all_one_pagers.mjs" "${ONE_PAGER_ARGS[@]}"

echo "Published tour matrices:"
echo "  $OUTPUT_DIR/photo_matrix.html"
echo "  $OUTPUT_DIR/meta_matrix.html"
echo "  $OUTPUT_DIR/content_matrix.html"
echo "  $OUTPUT_DIR/content_matrix_vi.html"
echo "  $OUTPUT_DIR/content_matrix_ja.html"
echo "  $OUTPUT_DIR/one_pager_matrix.html"
echo "  $OUTPUT_DIR/travel_plan_matrix.html"
