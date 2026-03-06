#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$1"
FRONTEND_BIND="$2"
FRONTEND_PORT="$3"
BACKEND_BASE="$4"
FRONTEND_LOG_FILE="$5"

cd "$ROOT_DIR"

while true; do
  python3 scripts/serve_frontend.py \
    --bind "$FRONTEND_BIND" \
    "$FRONTEND_PORT" \
    --directory "$ROOT_DIR" \
    --backend-base "$BACKEND_BASE" >>"$FRONTEND_LOG_FILE" 2>&1

  # Avoid a tight restart loop if the child exits immediately.
  sleep 1
done
