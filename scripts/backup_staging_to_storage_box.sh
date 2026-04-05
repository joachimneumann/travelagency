#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGING_ROOT="${STAGING_ROOT:-/srv/asiatravelplan}"
STORAGE_BOX_USER="${STORAGE_BOX_USER:-}"
STORAGE_BOX_HOST="${STORAGE_BOX_HOST:-}"
STORAGE_BOX_KEY="${STORAGE_BOX_KEY:-$HOME/.ssh/storage_box_backup}"
BACKUP_PREFIX="${BACKUP_PREFIX:-staging/snapshots}"
LOCAL_TMP_ROOT="${LOCAL_TMP_ROOT:-/tmp}"
KEEP_LOCAL_ARCHIVES="${KEEP_LOCAL_ARCHIVES:-0}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/backup_staging_to_storage_box.sh

Required environment variables:
  STORAGE_BOX_USER   Storage Box username, for example u571782
  STORAGE_BOX_HOST   Storage Box host, for example u571782.your-storagebox.de

Optional environment variables:
  STAGING_ROOT         Root of the staging checkout (default: /srv/asiatravelplan)
  STORAGE_BOX_KEY      SSH private key path (default: ~/.ssh/storage_box_backup)
  BACKUP_PREFIX        Remote snapshot folder prefix (default: staging/snapshots)
  LOCAL_TMP_ROOT       Local temp directory root (default: /tmp)
  KEEP_LOCAL_ARCHIVES  Keep local archives after upload when set to 1 (default: 0)

Examples:
  STORAGE_BOX_USER=u571782 \
  STORAGE_BOX_HOST=u571782.your-storagebox.de \
  ./scripts/backup_staging_to_storage_box.sh
EOF
}

require_file() {
  local target="$1"
  if [[ ! -e "$target" ]]; then
    echo "Missing required path: $target" >&2
    exit 1
  fi
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "$STORAGE_BOX_USER" || -z "$STORAGE_BOX_HOST" ]]; then
  usage >&2
  exit 1
fi

require_file "$STORAGE_BOX_KEY"
require_file "$STAGING_ROOT/content"
require_file "$STAGING_ROOT/backend/app/data"

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
WORKDIR="$(mktemp -d "$LOCAL_TMP_ROOT/asiatravelplan-staging-backup-$STAMP-XXXXXX")"
REMOTE_DIR="$BACKUP_PREFIX/$STAMP"
CONTENT_ARCHIVE="$WORKDIR/content.tar.gz"
DATA_ARCHIVE="$WORKDIR/backend-app-data.tar.gz"
MANIFEST_PATH="$WORKDIR/manifest.json"
CHECKSUM_PATH="$WORKDIR/sha256sums.txt"

cleanup() {
  if [[ "$KEEP_LOCAL_ARCHIVES" == "1" ]]; then
    echo "Local backup artifacts kept in $WORKDIR"
    return
  fi
  rm -rf "$WORKDIR"
}

trap cleanup EXIT

echo "Creating staging backup archives in $WORKDIR ..."

tar \
  --exclude='content/.DS_Store' \
  --exclude='content/**/.DS_Store' \
  -C "$STAGING_ROOT" \
  -czf "$CONTENT_ARCHIVE" \
  content

tar \
  --exclude='backend/app/data/tmp' \
  --exclude='backend/app/data/.DS_Store' \
  --exclude='backend/app/data/**/.DS_Store' \
  -C "$STAGING_ROOT" \
  -czf "$DATA_ARCHIVE" \
  backend/app/data

CONTENT_SIZE="$(wc -c < "$CONTENT_ARCHIVE" | tr -d '[:space:]')"
DATA_SIZE="$(wc -c < "$DATA_ARCHIVE" | tr -d '[:space:]')"

cat > "$MANIFEST_PATH" <<EOF
{
  "environment": "staging",
  "created_at": "$STAMP",
  "staging_root": "$STAGING_ROOT",
  "artifacts": [
    {
      "name": "content.tar.gz",
      "path": "content.tar.gz",
      "bytes": $CONTENT_SIZE
    },
    {
      "name": "backend-app-data.tar.gz",
      "path": "backend-app-data.tar.gz",
      "bytes": $DATA_SIZE
    }
  ]
}
EOF

(
  cd "$WORKDIR"
  shasum -a 256 content.tar.gz backend-app-data.tar.gz manifest.json > "$CHECKSUM_PATH"
)

echo "Uploading backup to $STORAGE_BOX_USER@$STORAGE_BOX_HOST:$REMOTE_DIR ..."

sftp -P 23 -o IdentitiesOnly=yes -i "$STORAGE_BOX_KEY" "$STORAGE_BOX_USER@$STORAGE_BOX_HOST" <<EOF
-mkdir staging
-mkdir $BACKUP_PREFIX
-mkdir $REMOTE_DIR
put $CONTENT_ARCHIVE $REMOTE_DIR/content.tar.gz
put $DATA_ARCHIVE $REMOTE_DIR/backend-app-data.tar.gz
put $MANIFEST_PATH $REMOTE_DIR/manifest.json
put $CHECKSUM_PATH $REMOTE_DIR/sha256sums.txt
ls $REMOTE_DIR
bye
EOF

echo "Backup completed: $REMOTE_DIR"
