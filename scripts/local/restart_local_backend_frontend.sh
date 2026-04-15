#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

"$ROOT_DIR/scripts/local/restart_local_backend.sh"
echo
"$ROOT_DIR/scripts/local/restart_local_frontend.sh"
