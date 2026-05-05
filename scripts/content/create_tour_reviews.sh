#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${REPO_ROOT}"

missing_commands=()
for command_name in node pandoc xelatex; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    missing_commands+=("${command_name}")
  fi
done

if ! command -v magick >/dev/null 2>&1 && ! command -v convert >/dev/null 2>&1; then
  missing_commands+=("imagemagick")
fi

if [ "${#missing_commands[@]}" -gt 0 ]; then
  printf 'Missing required command(s): %s\n' "${missing_commands[*]}" >&2
  printf 'Install Node.js, pandoc, XeLaTeX, and ImageMagick, then rerun this script.\n' >&2
  exit 1
fi

exec node "${SCRIPT_DIR}/create_tour_review_markdown.mjs" "$@"
