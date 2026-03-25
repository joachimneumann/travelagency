#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/wipe_local_bookings.sh [--yes] [--store <path>] [--data-dir <path>]

Examples:
  ./scripts/wipe_local_bookings.sh
  ./scripts/wipe_local_bookings.sh --yes
  STORE_FILE=/tmp/store.json ./scripts/wipe_local_bookings.sh --yes
EOF
}

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      usage
      exit 0
      ;;
  esac
done

cd "$ROOT_DIR"
node backend/app/scripts/wipe_bookings.js "$@"
