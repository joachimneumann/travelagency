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

  if docker context inspect colima >/dev/null 2>&1; then
    local current_context
    current_context="$(docker_context_name)"
    if [ "$current_context" != "colima" ]; then
      echo "Switching docker context to colima ..."
      docker context use colima >/dev/null
    fi
  fi

  if ! colima status 2>/dev/null | grep -qi '^status:\s*running'; then
    echo "Starting Colima ..."
    colima start
  fi

  local i
  for i in $(seq 1 40); do
    if docker_daemon_available; then
      return 0
    fi
    sleep 1
  done

  echo "Error: Docker daemon is still unavailable after starting Colima." >&2
  exit 1
}
