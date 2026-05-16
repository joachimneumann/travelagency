#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET_DIR="$ROOT_DIR/assets/generated/runtime"
WEB_TARGET_PATH="$TARGET_DIR/brand-logo.png"
BACKOFFICE_TARGET_PATH="$TARGET_DIR/brand-logo-backoffice.png"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/assets/prepare_runtime_brand_logo.sh [production|staging|local]

Copies the environment-specific public and backoffice header logos into the generated runtime asset paths.
EOF
}

ENVIRONMENT="${1:-production}"

case "$ENVIRONMENT" in
  production)
    WEB_SOURCE_PATH="$ROOT_DIR/assets/img/production.png"
    BACKOFFICE_SOURCE_PATH="$ROOT_DIR/assets/img/production.backoffice.png"
    ;;
  staging)
    WEB_SOURCE_PATH="$ROOT_DIR/assets/img/staging.png"
    BACKOFFICE_SOURCE_PATH="$ROOT_DIR/assets/img/staging.backoffice.png"
    ;;
  local)
    WEB_SOURCE_PATH="$ROOT_DIR/assets/img/local.png"
    BACKOFFICE_SOURCE_PATH="$ROOT_DIR/assets/img/local.backoffice.png"
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    echo "Unknown environment: $ENVIRONMENT" >&2
    usage >&2
    exit 1
    ;;
esac

if [[ ! -f "$WEB_SOURCE_PATH" ]]; then
  echo "Missing source logo: $WEB_SOURCE_PATH" >&2
  exit 1
fi

if [[ ! -f "$BACKOFFICE_SOURCE_PATH" ]]; then
  echo "Missing backoffice source logo: $BACKOFFICE_SOURCE_PATH" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
cp "$WEB_SOURCE_PATH" "$WEB_TARGET_PATH"
cp "$BACKOFFICE_SOURCE_PATH" "$BACKOFFICE_TARGET_PATH"
echo "Prepared runtime brand logos for $ENVIRONMENT: $WEB_TARGET_PATH, $BACKOFFICE_TARGET_PATH"
