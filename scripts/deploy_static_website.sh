#!/usr/bin/env bash
set -euo pipefail

EXPECTED_HOSTNAME="${EXPECTED_HOSTNAME:-atp}"
TARGET_ROOT="${TARGET_ROOT:-/srv/production}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/asiatravelplan-static.XXXXXX")"

cleanup() {
  rm -rf "$STAGE_DIR"
}
trap cleanup EXIT

usage() {
  cat <<EOF
Usage:
  ./scripts/deploy_static_website.sh

Environment overrides:
  EXPECTED_HOSTNAME   Hostname required for execution (default: atp)
  TARGET_ROOT         Static site target directory (default: /srv/production)

This script must be executed on the production server.
It publishes the public static website bundle to TARGET_ROOT.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

CURRENT_HOSTNAME="$(hostname -s 2>/dev/null || hostname)"
if [[ "$CURRENT_HOSTNAME" != "$EXPECTED_HOSTNAME" ]]; then
  echo "Refusing to deploy static website on host '$CURRENT_HOSTNAME'." >&2
  echo "Expected host: '$EXPECTED_HOSTNAME'." >&2
  exit 1
fi

cd "$ROOT_DIR"

for required in \
  "frontend/pages/index.html" \
  "frontend/pages/404.html" \
  "assets" \
  "site.webmanifest" \
  "robots.txt"; do
  if [[ ! -e "$required" ]]; then
    echo "Missing required path: $required" >&2
    exit 1
  fi
done

mkdir -p "$STAGE_DIR/assets"
cp "frontend/pages/index.html" "$STAGE_DIR/index.html"
cp "frontend/pages/404.html" "$STAGE_DIR/404.html"
cp "site.webmanifest" "$STAGE_DIR/site.webmanifest"
cp "robots.txt" "$STAGE_DIR/robots.txt"
rsync -a --delete "assets/" "$STAGE_DIR/assets/"

mkdir -p "$TARGET_ROOT"
rsync -a --delete "$STAGE_DIR/" "$TARGET_ROOT/"

echo "Static website deployed to $TARGET_ROOT on host $CURRENT_HOSTNAME."
