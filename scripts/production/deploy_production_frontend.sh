#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  ./scripts/production/deploy_production_frontend.sh

Deploys the production frontend/static website.
EOF
  exit 0
fi

exec "$ROOT_DIR/scripts/deploy/deploy_static_website.sh" "$@"
