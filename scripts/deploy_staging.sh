#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-asiatravelplan@<SERVER_IP>}"
REMOTE_DIR="${REMOTE_DIR:-/srv/asiatravelplan}"
SSH_TARGET="${SSH_TARGET:-${REMOTE_HOST}}"

rsync -avz --delete \
  --exclude '.git' \
  --exclude 'backend/app/data/invoices/' \
  /Users/internal_admin/projects/travelagency/ \
  "${REMOTE_HOST}:${REMOTE_DIR}/"

ssh "$SSH_TARGET" "cd ${REMOTE_DIR} && docker compose -f docker-compose.staging.yml up -d --build"
