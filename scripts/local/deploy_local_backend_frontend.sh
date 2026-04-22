#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/lib/load_repo_env.sh"
load_repo_env "$ROOT_DIR"
source "$ROOT_DIR/scripts/local/local_i18n_preflight.sh"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  ./scripts/local/deploy_local_backend_frontend.sh

Starts or reconciles the local backend and frontend.
EOF
  exit 0
fi

run_local_i18n_preflight "$ROOT_DIR"

"$ROOT_DIR/scripts/local/start_local_backend.sh"
echo
"$ROOT_DIR/scripts/local/start_local_frontend.sh"
