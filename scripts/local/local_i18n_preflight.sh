#!/usr/bin/env bash

run_local_i18n_preflight() {
  local root_dir="${1:-}"
  local runtime_i18n_script
  local runtime_i18n_helper
  local snapshot_manifest

  if [[ "${LOCAL_I18N_PREFLIGHT_DONE:-0}" == "1" ]]; then
    return 0
  fi

  if [[ -z "$root_dir" ]]; then
    echo "Error: run_local_i18n_preflight requires the repo root path." >&2
    return 1
  fi

  runtime_i18n_helper="$root_dir/scripts/lib/runtime_i18n.sh"
  runtime_i18n_script="$root_dir/scripts/i18n/build_runtime_i18n.mjs"
  snapshot_manifest="$root_dir/content/translations/manifest.json"
  if [[ ! -f "$runtime_i18n_helper" ]]; then
    echo "Error: runtime i18n helper not found at $runtime_i18n_helper" >&2
    return 1
  fi
  if [[ ! -f "$runtime_i18n_script" ]]; then
    echo "Error: runtime i18n generator not found at $runtime_i18n_script" >&2
    return 1
  fi

  # shellcheck source=../lib/runtime_i18n.sh
  source "$runtime_i18n_helper"

  echo "Building runtime i18n from published snapshots ..."
  if [[ ! -f "$snapshot_manifest" ]]; then
    echo "Warning: published translation snapshot missing: $snapshot_manifest" >&2
    echo "Local deploy will continue so you can publish the first snapshot from translations.html." >&2
    echo "After startup, open translations.html and run Translate everything." >&2
    export LOCAL_I18N_PREFLIGHT_DONE=1
    return 0
  fi

  if ! run_runtime_i18n_generator_quiet "$root_dir" "$runtime_i18n_script"; then
    if [[ "${BACKEND_I18N_STRICT:-1}" == "0" ]]; then
      echo "Continuing without regenerated runtime i18n because BACKEND_I18N_STRICT=0." >&2
      export LOCAL_I18N_PREFLIGHT_DONE=1
      return 0
    fi
    return 1
  fi

  export LOCAL_I18N_PREFLIGHT_DONE=1
}
