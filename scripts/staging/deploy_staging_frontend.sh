#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  ./scripts/staging/deploy_staging_frontend.sh

Refreshes staging static assets from the current checkout.
EOF
  exit 0
fi

cd "$ROOT_DIR"

git fetch origin
git pull --ff-only
"$ROOT_DIR/scripts/assets/prepare_runtime_brand_logo.sh" staging
node "$ROOT_DIR/scripts/assets/generate_public_homepage_assets.mjs"
