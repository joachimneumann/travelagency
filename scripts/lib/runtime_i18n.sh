#!/usr/bin/env bash

runtime_i18n_generator_log_path() {
  printf '%s\n' "${RUNTIME_I18N_GENERATOR_LOG:-/tmp/build_runtime_i18n.log}"
}

runtime_i18n_check_log_path() {
  printf '%s\n' "${RUNTIME_I18N_CHECK_LOG:-/tmp/build_runtime_i18n_check.log}"
}

refresh_runtime_i18n_source_catalogs() {
  local root_dir="$1"
  local refresh_script="${2:-$root_dir/scripts/i18n/refresh_source_catalogs.mjs}"

  if [[ ! -f "$refresh_script" ]]; then
    echo "Error: runtime i18n source catalog refresher not found at $refresh_script" >&2
    return 1
  fi

  (
    cd "$root_dir"
    node "$refresh_script"
  )
}

validate_runtime_i18n_snapshots_quiet() {
  local root_dir="$1"
  local generator_path="${2:-$root_dir/scripts/i18n/build_runtime_i18n.mjs}"
  local log_path
  local command_log_path
  local snapshot_manifest

  log_path="$(runtime_i18n_check_log_path)"
  command_log_path="${log_path}.command"
  snapshot_manifest="$root_dir/content/translations/manifest.json"

  if [[ ! -f "$generator_path" ]]; then
    echo "Error: runtime i18n generator not found at $generator_path" >&2
    return 1
  fi
  if [[ ! -f "$snapshot_manifest" ]]; then
    echo "Error: translation store missing: $snapshot_manifest" >&2
    echo "Run Translate, restore content/translations, or sync the translation store before deploying." >&2
    return 1
  fi

  rm -f "$command_log_path"
  local exit_code=0
  (
    cd "$root_dir"
    node "$generator_path" --check --strict
  ) >"$command_log_path" 2>&1 || exit_code=$?

  if [[ "$exit_code" -eq 0 ]]; then
    cp "$command_log_path" "$log_path"
    rm -f "$command_log_path"
    echo "Validated runtime i18n snapshots. Full validation output: $log_path"
    return 0
  fi

  echo "Error: runtime i18n snapshot validation failed. Command output follows." >&2
  echo "If the output mentions stale source_text, stale source_hash, or missing source keys, content/translations is older than the checked-out source catalog." >&2
  echo "Deploy through scripts/deploy/auto_commit_and_deploy.sh so ignored translation snapshots are synced, or sync content/translations before running the staging update script directly." >&2
  if [[ -s "$command_log_path" ]]; then
    tail -120 "$command_log_path" >&2 || true
    echo "Full command output: $command_log_path" >&2
  fi
  return "$exit_code"
}

run_runtime_i18n_generator_quiet() {
  local root_dir="$1"
  local generator_path="${2:-$root_dir/scripts/i18n/build_runtime_i18n.mjs}"
  local log_path
  local command_log_path
  local snapshot_manifest

  log_path="$(runtime_i18n_generator_log_path)"
  command_log_path="${log_path}.command"
  snapshot_manifest="$root_dir/content/translations/manifest.json"

  if [[ ! -f "$generator_path" ]]; then
    echo "Error: runtime i18n generator not found at $generator_path" >&2
    return 1
  fi
  if [[ ! -f "$snapshot_manifest" ]]; then
    echo "Error: translation store missing: $snapshot_manifest" >&2
    echo "Run Translate, restore content/translations, or sync the translation store before deploying." >&2
    return 1
  fi

  rm -f "$command_log_path"
  local exit_code=0
  (
    cd "$root_dir"
    node "$generator_path" --strict
  ) >"$command_log_path" 2>&1 || exit_code=$?

  if [[ "$exit_code" -eq 0 ]]; then
    cp "$command_log_path" "$log_path"
    rm -f "$command_log_path"
    echo "Generated runtime i18n files. Full generation output: $log_path"
    return 0
  fi

  echo "Error: runtime i18n generation failed. Command output follows." >&2
  echo "If the output mentions stale source_text, stale source_hash, or missing source keys, content/translations is older than the checked-out source catalog." >&2
  echo "Deploy through scripts/deploy/auto_commit_and_deploy.sh so ignored translation snapshots are synced, or sync content/translations before running the staging update script directly." >&2
  if [[ -s "$command_log_path" ]]; then
    tail -120 "$command_log_path" >&2 || true
    echo "Full command output: $command_log_path" >&2
  fi
  return "$exit_code"
}
