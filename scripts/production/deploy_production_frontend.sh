#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOMEPAGE_BUNDLE_PATH="$ROOT_DIR/frontend/data/generated/homepage/public-homepage-main.bundle.js"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  ./scripts/production/deploy_production_frontend.sh

Regenerates the production homepage frontend assets.
EOF
  exit 0
fi

cd "$ROOT_DIR"
echo "Generating production homepage frontend assets..."
"$ROOT_DIR/scripts/assets/prepare_runtime_brand_logo.sh" production
node "$ROOT_DIR/scripts/assets/generate_public_homepage_assets.mjs"

if [[ ! -f "$HOMEPAGE_BUNDLE_PATH" ]]; then
  echo "Missing generated homepage bundle after asset generation: $HOMEPAGE_BUNDLE_PATH" >&2
  exit 1
fi
