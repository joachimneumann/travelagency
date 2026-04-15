#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  ./scripts/staging/deploy_staging_all.sh

Deploys the full staging stack.
EOF
  exit 0
fi

exec "$ROOT_DIR/scripts/deploy/update_staging.sh" all "$@"
