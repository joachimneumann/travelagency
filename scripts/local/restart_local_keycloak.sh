#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-travelagency_keycloak}"

"$ROOT_DIR/scripts/local/stop_local_keycloak.sh"
echo
"$ROOT_DIR/scripts/local/start_local_keycloak.sh"
