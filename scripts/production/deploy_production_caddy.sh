#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  ./scripts/production/deploy_production_caddy.sh

Validates and reloads the shared production Caddy configuration.
EOF
  exit 0
fi

exec "$ROOT_DIR/scripts/deploy/install_production_caddy.sh" "$@"
