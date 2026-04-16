#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/deploy/install_production_caddy.sh

Compatibility wrapper for:
  ./scripts/production/deploy_production_caddy.sh
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

exec "$ROOT_DIR/scripts/production/deploy_production_caddy.sh" "$@"
