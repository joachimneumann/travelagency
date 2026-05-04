#!/usr/bin/env bash

print_local_i18n_preflight_warning() {
  if [[ -z "${LOCAL_I18N_PREFLIGHT_WARNING:-}" || -z "${LOCAL_I18N_PREFLIGHT_WARNING_LOG:-}" ]]; then
    return 0
  fi
  if [[ "${LOCAL_I18N_PREFLIGHT_WARNING_OWNER_PID:-}" != "$$" ]]; then
    return 0
  fi

  print_runtime_i18n_deploy_warning \
    local \
    "$LOCAL_I18N_PREFLIGHT_WARNING_LOG" \
    "$LOCAL_I18N_PREFLIGHT_WARNING"
}

install_local_i18n_preflight_warning_trap() {
  if [[ "${LOCAL_I18N_PREFLIGHT_WARNING_TRAP_INSTALLED:-0}" == "1" ]]; then
    return 0
  fi

  export LOCAL_I18N_PREFLIGHT_WARNING_TRAP_INSTALLED=1
  trap 'print_local_i18n_preflight_warning' EXIT
}

record_local_i18n_preflight_warning() {
  local command_log_path="$1"
  local warning_message="$2"

  export LOCAL_I18N_PREFLIGHT_WARNING_LOG="$command_log_path"
  export LOCAL_I18N_PREFLIGHT_WARNING="$warning_message"
  export LOCAL_I18N_PREFLIGHT_WARNING_OWNER_PID="$$"
  install_local_i18n_preflight_warning_trap
}

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

  echo "Building runtime i18n from content/translations ..."
  refresh_runtime_i18n_source_catalogs "$root_dir"
  if [[ ! -f "$snapshot_manifest" ]]; then
    echo "Warning: translation store missing: $snapshot_manifest" >&2
    echo "Local deploy will continue so you can create content/translations from translations.html." >&2
    echo "After startup, open translations.html and run Translate." >&2
    export LOCAL_I18N_PREFLIGHT_DONE=1
    return 0
  fi

  if ! run_runtime_i18n_generator_quiet "$root_dir" "$runtime_i18n_script"; then
    local command_log_path
    command_log_path="$(runtime_i18n_generator_log_path).command"
    if runtime_i18n_failure_is_translation_sync_issue "$command_log_path"; then
      record_local_i18n_preflight_warning \
        "$command_log_path" \
        "Runtime i18n generation found stale or missing translations during local deployment."
      export LOCAL_I18N_PREFLIGHT_DONE=1
      return 0
    fi

    if [[ "${BACKEND_I18N_STRICT:-1}" == "0" ]]; then
      echo "Continuing without regenerated runtime i18n because BACKEND_I18N_STRICT=0." >&2
      export LOCAL_I18N_PREFLIGHT_DONE=1
      return 0
    fi
    return 1
  fi

  export LOCAL_I18N_PREFLIGHT_DONE=1
}
