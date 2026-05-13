#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="${TOUR_MATRIX_OUTPUT_DIR:-$ROOT_DIR/matrix-pages}"

ARGS=("$@")
for ((index = 0; index < ${#ARGS[@]}; index += 1)); do
  if [[ "${ARGS[$index]}" == "--output-dir" && -n "${ARGS[$((index + 1))]:-}" ]]; then
    OUTPUT_DIR="${ARGS[$((index + 1))]}"
  fi
done

TOUR_MATRIX_OUTPUT_DIR="$OUTPUT_DIR" "$SCRIPT_DIR/publish_tour_matrices.sh" "$@"

OUTPUT_DIR="$(cd "$ROOT_DIR" && cd "$OUTPUT_DIR" && pwd)"

if [[ "$OUTPUT_DIR" != "$ROOT_DIR" ]]; then
  case "$OUTPUT_DIR" in
    "$ROOT_DIR"/*)
      RELATIVE_OUTPUT_DIR="${OUTPUT_DIR#"$ROOT_DIR"/}"
      ;;
    *)
      RELATIVE_OUTPUT_DIR="$OUTPUT_DIR"
      ;;
  esac

  ln -sfn "$RELATIVE_OUTPUT_DIR/photo_matrix.html" "$ROOT_DIR/photo_matrix.html"
  ln -sfn "$RELATIVE_OUTPUT_DIR/meta_matrix.html" "$ROOT_DIR/meta_matrix.html"
  ln -sfn "$RELATIVE_OUTPUT_DIR/content_matrix.html" "$ROOT_DIR/content_matrix.html"
  rm -rf "$ROOT_DIR/img"
  ln -s "$RELATIVE_OUTPUT_DIR/img" "$ROOT_DIR/img"
fi
