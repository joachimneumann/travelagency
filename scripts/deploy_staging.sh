#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-asiatravelplan@<SERVER_IP>}"
REMOTE_DIR="${REMOTE_DIR:-/srv/asiatravelplan}"
SSH_TARGET="${SSH_TARGET:-${REMOTE_HOST}}"

rsync -avz --delete \
  --exclude '.git' \
  --exclude 'backend/app/data/invoices/' \
  --exclude 'backend/app/data/store.json' \
  /Users/internal_admin/projects/travelagency/ \
  "${REMOTE_HOST}:${REMOTE_DIR}/"

ssh "$SSH_TARGET" "cd ${REMOTE_DIR} && mkdir -p backend/app/data && [ -f backend/app/data/store.json ] || printf '{\\n  \"customers\": [],\\n  \"bookings\": [],\\n  \"activities\": [],\\n  \"invoices\": []\\n}\\n' > backend/app/data/store.json && docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --build"
