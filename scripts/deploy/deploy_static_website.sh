#!/usr/bin/env bash
set -euo pipefail

EXPECTED_HOSTNAME="${EXPECTED_HOSTNAME:-atp}"
TARGET_ROOT="${TARGET_ROOT:-/srv/placeholder}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_ROOT="${SOURCE_ROOT:-$ROOT_DIR/production}"
STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/asiatravelplan-static.XXXXXX")"

cleanup() {
  rm -rf "$STAGE_DIR"
}
trap cleanup EXIT

usage() {
  cat <<EOF
Usage:
  ./scripts/deploy/deploy_static_website.sh

Environment overrides:
  EXPECTED_HOSTNAME   Hostname required for execution (default: atp)
  TARGET_ROOT         Static site target directory (default: /srv/placeholder)
  SOURCE_ROOT         Static source directory (default: <repo>/production)

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
  "$SOURCE_ROOT/index.html" \
  "$SOURCE_ROOT/assets" \
  "$SOURCE_ROOT/site.webmanifest" \
  "$SOURCE_ROOT/robots.txt" \
  "$SOURCE_ROOT/sitemap.xml"; do
  if [[ ! -e "$required" ]]; then
    echo "Missing required path: $required" >&2
    exit 1
  fi
done

mkdir -p "$STAGE_DIR/assets"
cp "$SOURCE_ROOT/index.html" "$STAGE_DIR/index.html"
cp "$SOURCE_ROOT/index.html" "$STAGE_DIR/404.html"
cp "$SOURCE_ROOT/site.webmanifest" "$STAGE_DIR/site.webmanifest"
cp "$SOURCE_ROOT/robots.txt" "$STAGE_DIR/robots.txt"
cp "$SOURCE_ROOT/sitemap.xml" "$STAGE_DIR/sitemap.xml"
rsync -a --delete "$SOURCE_ROOT/assets/" "$STAGE_DIR/assets/"

mkdir -p "$TARGET_ROOT"
rsync -a --delete "$STAGE_DIR/" "$TARGET_ROOT/"

echo "Static website deployed to $TARGET_ROOT on host $CURRENT_HOSTNAME."
