#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET_DIR="$ROOT_DIR/assets/generated/runtime"
TARGET_PATH="$TARGET_DIR/brand-logo.png"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/assets/prepare_runtime_brand_logo.sh [production|staging|local]

Copies the environment-specific header logo into the generated runtime asset path.
EOF
}

ENVIRONMENT="${1:-production}"

case "$ENVIRONMENT" in
  production)
    SOURCE_PATH="$ROOT_DIR/assets/img/logo-asiatravelplan.png"
    ;;
  staging)
    SOURCE_PATH="$ROOT_DIR/assets/img/staging.png"
    ;;
  local)
    SOURCE_PATH="$ROOT_DIR/assets/img/local.png"
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

if [[ ! -f "$SOURCE_PATH" ]]; then
  echo "Missing source logo: $SOURCE_PATH" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
cp "$SOURCE_PATH" "$TARGET_PATH"
echo "Prepared runtime brand logo for $ENVIRONMENT: $TARGET_PATH"
