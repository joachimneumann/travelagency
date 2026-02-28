#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/stop_local_all.sh"
echo
"$ROOT_DIR/scripts/start_local_all.sh"
