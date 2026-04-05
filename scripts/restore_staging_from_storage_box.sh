#!/usr/bin/env bash
set -euo pipefail

STAGING_ROOT="${STAGING_ROOT:-/srv/asiatravelplan}"
STORAGE_BOX_USER="${STORAGE_BOX_USER:-}"
STORAGE_BOX_HOST="${STORAGE_BOX_HOST:-}"
STORAGE_BOX_KEY="${STORAGE_BOX_KEY:-$HOME/.ssh/storage_box_backup}"
BACKUP_PREFIX="${BACKUP_PREFIX:-staging/snapshots}"
LOCAL_TMP_ROOT="${LOCAL_TMP_ROOT:-/tmp}"
KEEP_LOCAL_ARCHIVES="${KEEP_LOCAL_ARCHIVES:-0}"

SNAPSHOT=""
ASSUME_YES=0

usage() {
  cat <<'EOF'
Usage:
  ./scripts/restore_staging_from_storage_box.sh --snapshot <timestamp> [--yes]

Required environment variables:
  STORAGE_BOX_USER   Storage Box username, for example u571782
  STORAGE_BOX_HOST   Storage Box host, for example u571782.your-storagebox.de

Required arguments:
  --snapshot <timestamp>  Snapshot name under staging/snapshots, for example 2026-04-05T18-43-31Z

Safety:
  --yes   Required to actually restore over the current staging files

Optional environment variables:
  STAGING_ROOT         Root of the staging checkout (default: /srv/asiatravelplan)
  STORAGE_BOX_KEY      SSH private key path (default: ~/.ssh/storage_box_backup)
  BACKUP_PREFIX        Remote snapshot folder prefix (default: staging/snapshots)
  LOCAL_TMP_ROOT       Local temp directory root (default: /tmp)
  KEEP_LOCAL_ARCHIVES  Keep local downloaded archives after restore when set to 1 (default: 0)

Example:
  STORAGE_BOX_USER=u571782 \
  STORAGE_BOX_HOST=u571782.your-storagebox.de \
  ./scripts/restore_staging_from_storage_box.sh --snapshot 2026-04-05T18-43-31Z --yes
EOF
}

require_path() {
  local target="$1"
  if [[ ! -e "$target" ]]; then
    echo "Missing required path: $target" >&2
    exit 1
  fi
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --snapshot)
      SNAPSHOT="${2:-}"
      shift 2
      ;;
    --yes)
      ASSUME_YES=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$STORAGE_BOX_USER" || -z "$STORAGE_BOX_HOST" || -z "$SNAPSHOT" ]]; then
  usage >&2
  exit 1
fi

if [[ "$ASSUME_YES" != "1" ]]; then
  echo "Restore refused without --yes." >&2
  usage >&2
  exit 1
fi

require_path "$STORAGE_BOX_KEY"
require_path "$STAGING_ROOT/content"
require_path "$STAGING_ROOT/backend/app/data"

REMOTE_DIR="$BACKUP_PREFIX/$SNAPSHOT"
WORKDIR="$(mktemp -d "$LOCAL_TMP_ROOT/asiatravelplan-staging-restore-$SNAPSHOT-XXXXXX")"
CONTENT_ARCHIVE="$WORKDIR/content.tar.gz"
DATA_ARCHIVE="$WORKDIR/backend-app-data.tar.gz"
MANIFEST_PATH="$WORKDIR/manifest.json"
CHECKSUM_PATH="$WORKDIR/sha256sums.txt"
EXTRACT_ROOT="$WORKDIR/extracted"

cleanup() {
  if [[ "$KEEP_LOCAL_ARCHIVES" == "1" ]]; then
    echo "Local restore artifacts kept in $WORKDIR"
    return
  fi
  rm -rf "$WORKDIR"
}

trap cleanup EXIT

echo "Downloading snapshot $REMOTE_DIR ..."

sftp -P 23 -o IdentitiesOnly=yes -i "$STORAGE_BOX_KEY" "$STORAGE_BOX_USER@$STORAGE_BOX_HOST" <<EOF
get $REMOTE_DIR/content.tar.gz $CONTENT_ARCHIVE
get $REMOTE_DIR/backend-app-data.tar.gz $DATA_ARCHIVE
get $REMOTE_DIR/manifest.json $MANIFEST_PATH
get $REMOTE_DIR/sha256sums.txt $CHECKSUM_PATH
bye
EOF

echo "Verifying checksums ..."
(
  cd "$WORKDIR"
  shasum -a 256 -c "$CHECKSUM_PATH"
)

mkdir -p "$EXTRACT_ROOT"

echo "Extracting snapshot ..."
tar -C "$EXTRACT_ROOT" -xzf "$CONTENT_ARCHIVE"
tar -C "$EXTRACT_ROOT" -xzf "$DATA_ARCHIVE"

require_path "$EXTRACT_ROOT/content"
require_path "$EXTRACT_ROOT/backend/app/data"

echo "Restoring content into $STAGING_ROOT ..."
rsync -a --delete "$EXTRACT_ROOT/content/" "$STAGING_ROOT/content/"
rsync -a --delete "$EXTRACT_ROOT/backend/app/data/" "$STAGING_ROOT/backend/app/data/"

mkdir -p "$STAGING_ROOT/backend/app/data/tmp"

echo "Restore completed from $REMOTE_DIR"
