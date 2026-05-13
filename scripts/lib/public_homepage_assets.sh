#!/usr/bin/env bash

public_homepage_assets_log_path() {
  printf '%s\n' "${PUBLIC_HOMEPAGE_ASSET_GENERATOR_LOG:-/tmp/generate_public_homepage_assets.log}"
}

public_homepage_frontend_data_dir() {
  local root_dir="$1"
  printf '%s\n' "${PUBLIC_HOMEPAGE_FRONTEND_DATA_DIR:-$root_dir/frontend/data/generated/homepage}"
}

assert_public_homepage_assets_present() {
  local root_dir="$1"
  local frontend_data_dir
  local missing=0

  frontend_data_dir="$(public_homepage_frontend_data_dir "$root_dir")"

  for asset_path in \
    "$frontend_data_dir/index.html" \
    "$frontend_data_dir/public-homepage-copy.global.js" \
    "$frontend_data_dir/public-homepage-main.bundle.js"
  do
    if [[ ! -s "$asset_path" ]]; then
      echo "Error: missing generated homepage asset after generation: $asset_path" >&2
      missing=1
    fi
  done

  [[ "$missing" -eq 0 ]]
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
    assert_public_homepage_assets_present "$root_dir" || return 1
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
