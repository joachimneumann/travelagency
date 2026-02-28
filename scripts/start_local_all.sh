#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$ROOT_DIR/scripts/start_local_keycloak.sh"
echo
"$ROOT_DIR/scripts/start_local_backend.sh"
echo
"$ROOT_DIR/scripts/start_local_frontend.sh"
