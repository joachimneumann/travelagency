#!/usr/bin/env bash
set -euo pipefail

docker_daemon_available() {
  command -v docker >/dev/null 2>&1 || return 1
  docker info >/dev/null 2>&1
}

docker_context_name() {
  docker context show 2>/dev/null || true
}

docker_compose_available() {
  docker compose version >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1
}

docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
    return
  fi
  echo "Error: neither 'docker compose' nor 'docker-compose' is available." >&2
  exit 1
}

print_docker_runtime_diagnostics() {
  echo "--- Docker runtime diagnostics ---" >&2
  echo "docker context: $(docker_context_name)" >&2

  if command -v colima >/dev/null 2>&1; then
    echo "colima status:" >&2
    colima status >&2 || true
  fi

  if [ -S "$HOME/.colima/default/docker.sock" ]; then
    echo "colima socket:" >&2
    ls -l "$HOME/.colima/default/docker.sock" >&2 || true
  fi

  local docker_info_error
  docker_info_error="$(docker info >/dev/null 2>&1 || docker info 2>&1 || true)"
  if [ -n "$docker_info_error" ]; then
    echo "docker info error:" >&2
    echo "$docker_info_error" >&2
  fi

  echo "Suggested recovery commands:" >&2
  echo "  docker context use colima" >&2
  echo "  colima stop" >&2
  echo "  colima start" >&2
}

ensure_colima_context() {
  if docker context inspect colima >/dev/null 2>&1; then
    local current_context
    current_context="$(docker_context_name)"
    if [ "$current_context" != "colima" ]; then
      echo "Switching docker context to colima ..."
      docker context use colima >/dev/null
    fi
  fi
}

wait_for_docker_daemon() {
  local attempts="${1:-40}"
  local i
  for i in $(seq 1 "$attempts"); do
    if docker_daemon_available; then
      return 0
    fi
    sleep 1
  done
  return 1
}

ensure_local_docker_runtime() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Error: docker is not installed." >&2
    exit 1
  fi

  if docker_daemon_available; then
    return 0
  fi

  if ! command -v colima >/dev/null 2>&1; then
    echo "Error: no Docker daemon is reachable, and colima is not installed." >&2
    echo "Install/start a Docker-compatible runtime, or install Colima:" >&2
    echo "  brew install colima docker docker-compose" >&2
    echo "  colima start" >&2
    exit 1
  fi

  if ! docker_compose_available; then
    echo "Error: docker-compose is not installed." >&2
    echo "Install it with:" >&2
    echo "  brew install docker-compose" >&2
    exit 1
  fi

  ensure_colima_context

  if ! colima status 2>/dev/null | grep -qi '^status:\s*running'; then
    echo "Starting Colima ..."
    colima start
  fi

  ensure_colima_context

  if wait_for_docker_daemon 40; then
    return 0
  fi

  if colima status 2>/dev/null | grep -qi '^status:\s*running'; then
    echo "Docker daemon is still unavailable even though Colima reports running. Restarting Colima once ..." >&2
    colima stop >/dev/null 2>&1 || true
    colima start
    ensure_colima_context
    if wait_for_docker_daemon 40; then
      return 0
    fi
  fi

  echo "Error: Docker daemon is still unavailable after starting Colima." >&2
  print_docker_runtime_diagnostics
  exit 1
}
