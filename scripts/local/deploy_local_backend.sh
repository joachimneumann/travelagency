#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  ./scripts/local/deploy_local_backend.sh

Starts or reconciles the local backend only.
EOF
  exit 0
fi

exec "$ROOT_DIR/scripts/local/start_local_backend.sh" "$@"
