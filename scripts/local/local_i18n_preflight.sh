#!/usr/bin/env bash

run_local_i18n_preflight() {
  local root_dir="${1:-}"
  local translate_script
  local mode

  if [[ "${LOCAL_I18N_PREFLIGHT_DONE:-0}" == "1" ]]; then
    return 0
  fi

  if [[ -z "$root_dir" ]]; then
    echo "Error: run_local_i18n_preflight requires the repo root path." >&2
    return 1
  fi

  translate_script="$root_dir/scripts/i18n/translate"
  if [[ ! -f "$translate_script" ]]; then
    echo "Error: i18n translate script not found at $translate_script" >&2
    return 1
  fi

  mode="check"
  if [[ "${AUTO_TRANSLATE_LOCAL_I18N:-0}" == "1" ]]; then
    mode="update"
  fi

  echo "Running local i18n preflight (${mode}) ..."
  (
    cd "$root_dir"
    "$translate_script" "$mode"
  )

  export LOCAL_I18N_PREFLIGHT_DONE=1
}
