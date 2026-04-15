#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

"$ROOT_DIR/scripts/local/stop_local_all.sh"
echo
"$ROOT_DIR/scripts/local/start_local_all.sh"
