#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./copy_codex_history_to_other_mac.sh <macB_user> <macB_ip_or_hostname>
#
# Example:
#   ./copy_codex_history_to_other_mac.sh jogi 192.168.1.42

USER_B="${1:-}"
HOST_B="${2:-}"

if [[ -z "$USER_B" || -z "$HOST_B" ]]; then
  echo "Usage: $0 <macB_user> <macB_ip_or_hostname>"
  exit 1
fi

SRC_DIR="$HOME/.codex"
DST_DIR="~/.codex"

# Ensure destination directory exists
#ssh "${USER_B}@${HOST_B}" "mkdir -p ${DST_DIR}/sessions"

echo "Copying Codex sessions to ${USER_B}@${HOST_B}: ${DST_DIR}/sessions ..."

# Copy sessions (history)
rsync -avh --progress \
  --chmod=Du+rwx,Fu+rw \
  "${SRC_DIR}/sessions/" \
  "${USER_B}@${HOST_B}:${DST_DIR}/sessions/"

# Optional: also copy config.toml if it exists
# if [[ -f "${SRC_DIR}/config.toml" ]]; then
#   rsync -avh --progress \
#     --chmod=Fu+rw \
#     "${SRC_DIR}/config.toml" \
#     "${USER_B}@${HOST_B}:${DST_DIR}/config.toml"
# fi

echo "Done."
echo "On Mac B you can try: codex resume --all"
