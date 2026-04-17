#!/usr/bin/env bash

load_repo_env() {
  local root_dir="${1:-}"
  local env_file line name

  if [ -z "$root_dir" ]; then
    root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  fi

  env_file="${2:-$root_dir/.env}"
  if [ ! -f "$env_file" ]; then
    return 0
  fi

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#"${line%%[![:space:]]*}"}"
    [ -n "$line" ] || continue
    case "$line" in
      \#*) continue ;;
      export\ *) line="${line#export }" ;;
    esac

    name="${line%%=*}"
    if [[ ! "$name" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      continue
    fi

    if [ -n "${!name+x}" ]; then
      continue
    fi

    eval "export $line"
  done < "$env_file"
}
