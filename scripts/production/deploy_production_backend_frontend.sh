#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  ./scripts/production/deploy_production_backend_frontend.sh

Deploys the production backend, reloads Caddy, and publishes the static website.
EOF
  exit 0
fi

"$ROOT_DIR/scripts/deploy/update_production.sh" backend
echo
"$ROOT_DIR/scripts/production/deploy_production_caddy.sh"
echo
"$ROOT_DIR/scripts/deploy/deploy_static_website.sh"
