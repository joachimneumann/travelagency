#!/usr/bin/env bash

run_local_i18n_preflight() {
  local root_dir="${1:-}"
  local runtime_i18n_script

  if [[ "${LOCAL_I18N_PREFLIGHT_DONE:-0}" == "1" ]]; then
    return 0
  fi

  if [[ -z "$root_dir" ]]; then
    echo "Error: run_local_i18n_preflight requires the repo root path." >&2
    return 1
  fi

  runtime_i18n_script="$root_dir/scripts/i18n/build_runtime_i18n.mjs"
  if [[ ! -f "$runtime_i18n_script" ]]; then
    echo "Error: runtime i18n generator not found at $runtime_i18n_script" >&2
    return 1
  fi

  echo "Building runtime i18n from published snapshots ..."
  (
    cd "$root_dir"
    node "$runtime_i18n_script" --strict
  )

  export LOCAL_I18N_PREFLIGHT_DONE=1
}
