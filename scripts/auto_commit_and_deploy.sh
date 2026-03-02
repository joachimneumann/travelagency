#!/usr/bin/env bash
set -euo pipefail

cd /Users/internal_admin/projects/travelagency
git add -A
created_commit=0

if ! git diff --cached --quiet; then
  git commit -m "automatic commit"
  created_commit=1
fi

if [[ "$created_commit" -eq 0 ]]; then
  echo "No git changes to commit. Skipping push and remote deployment."
  exit 0
fi

git push

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Local git status is not clean after push. Aborting remote deployment." >&2
  git status --short
  exit 1
fi

ssh atp 'bash -lc "source ~/.bashrc >/dev/null 2>&1 || true; cd /srv/asiatravelplan && git pull && cd /srv/asiatravelplan && ./scripts/update_staging.sh all"'
