#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${REPO_ROOT}"

if [[ ! -d "backend/app/node_modules" ]]; then
  echo "Missing backend/app/node_modules. Run npm install in backend/app first." >&2
  exit 1
fi

exec node "${SCRIPT_DIR}/create_all_one_pagers.mjs" "$@"
