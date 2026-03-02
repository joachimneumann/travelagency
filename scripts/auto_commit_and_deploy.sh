#!/usr/bin/env bash
set -euo pipefail

cd /Users/internal_admin/projects/travelagency
git add -A

if ! git diff --cached --quiet; then
  git commit -m "automatic commit"
fi

git push

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Local git status is not clean after push. Aborting remote deployment." >&2
  git status --short
  exit 1
fi

ssh atp 'bash -lc "source ~/.bashrc >/dev/null 2>&1 || true; cd /srv/asiatravelplan && git pull && cd /srv/asiatravelplan && ./scripts/update_staging.sh all"'
