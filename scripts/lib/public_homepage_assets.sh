#!/usr/bin/env bash

public_homepage_assets_log_path() {
  printf '%s\n' "${PUBLIC_HOMEPAGE_ASSET_GENERATOR_LOG:-/tmp/generate_public_homepage_assets.log}"
}

run_public_homepage_asset_generator_quiet() {
  local root_dir="$1"
  local generator_path="${2:-$root_dir/scripts/assets/generate_public_homepage_assets.mjs}"
  local log_path
  local command_log_path

  log_path="$(public_homepage_assets_log_path)"
  command_log_path="${log_path}.command"

  if [[ ! -f "$generator_path" ]]; then
    echo "Error: homepage asset generator not found at $generator_path" >&2
    return 1
  fi

  rm -f "$command_log_path"
  local exit_code=0
  (
    cd "$root_dir"
    PUBLIC_HOMEPAGE_ASSET_GENERATOR_LOG="$log_path" \
      PUBLIC_HOMEPAGE_ASSET_GENERATOR_QUIET=1 \
      node "$generator_path"
  ) >"$command_log_path" 2>&1 || exit_code=$?

  if [[ "$exit_code" -eq 0 ]]; then
    rm -f "$command_log_path"
    echo "Generated static homepage assets. Full generation output: $log_path"
    return 0
  fi

  echo "Error: static homepage asset generation failed. Command output follows." >&2
  if [[ -s "$command_log_path" ]]; then
    tail -120 "$command_log_path" >&2 || true
    echo "Full command output: $command_log_path" >&2
  fi
  return "$exit_code"
}
