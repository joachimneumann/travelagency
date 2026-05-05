#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TOURS_DIR="${REPO_ROOT}/content/tours"
STYLE_CATALOG="${REPO_ROOT}/config/tour_style_catalog.json"
HIGHLIGHTS_MANIFEST="${REPO_ROOT}/assets/img/experience-highlights/manifest.json"
FONT_DIR="${REPO_ROOT}/content/fonts"
MAIN_FONT="NotoSerif-Regular.ttf"
PDF_IMAGE_WIDTH="35%"
OUTPUT_DIR="${TOURS_DIR}"

usage() {
  cat <<'USAGE'
Usage: scripts/content/create_tour_reviews.sh [tour-id-or-path ...] [options]

Creates review files named review_{last 6 characters of tour ID}.txt and .pdf.
Without a tour input, only tours with "published_on_webpage": true are converted.

Examples:
  scripts/content/create_tour_reviews.sh
  scripts/content/create_tour_reviews.sh tour_16531bfc-a60f-4128-9abe-2eada1f2d7d8
  scripts/content/create_tour_reviews.sh content/tours/tour_16531bfc-a60f-4128-9abe-2eada1f2d7d8/tour.json

Options:
  --tour TOUR_ID_OR_PATH    Convert one tour. Can be repeated.
  --output DIR              Output directory. Default: content/tours
  --help                    Show this help.
USAGE
}

missing_commands=()
for command_name in jq pandoc xelatex; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    missing_commands+=("${command_name}")
  fi
done

IMAGE_COMMAND=""
if command -v magick >/dev/null 2>&1; then
  IMAGE_COMMAND="magick"
elif command -v convert >/dev/null 2>&1; then
  IMAGE_COMMAND="convert"
else
  missing_commands+=("imagemagick")
fi

if [ "${#missing_commands[@]}" -gt 0 ]; then
  printf 'Missing required command(s): %s\n' "${missing_commands[*]}" >&2
  printf 'Install jq, pandoc, XeLaTeX, and ImageMagick, then rerun this script.\n' >&2
  printf '\nDebian/Ubuntu:\n' >&2
  printf '  sudo apt-get update\n' >&2
  printf '  sudo apt-get install -y jq pandoc texlive-xetex texlive-latex-recommended texlive-fonts-recommended imagemagick\n' >&2
  printf '\nRHEL/CentOS/Fedora:\n' >&2
  printf '  sudo dnf install -y jq pandoc texlive-xetex texlive-collection-latexrecommended ImageMagick\n' >&2
  exit 1
fi

cd "${REPO_ROOT}"

tour_inputs=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --output)
      shift
      if [ "$#" -eq 0 ]; then
        printf '%s\n' '--output requires a directory.' >&2
        exit 1
      fi
      OUTPUT_DIR="$1"
      ;;
    --tour)
      shift
      if [ "$#" -eq 0 ]; then
        printf '%s\n' '--tour requires a tour ID or path.' >&2
        exit 1
      fi
      tour_inputs+=("$1")
      ;;
    -*)
      printf 'Unknown option: %s\n' "$1" >&2
      exit 1
      ;;
    *)
      tour_inputs+=("$1")
      ;;
  esac
  shift
done

mkdir -p "${OUTPUT_DIR}"

tour_json_path_for_input() {
  local input="$1"
  case "${input}" in
    *.json) printf '%s\n' "${input}" ;;
    */*) printf '%s/tour.json\n' "${input%/}" ;;
    ./*) printf '%s/tour.json\n' "${input%/}" ;;
    *) printf '%s/%s/tour.json\n' "${TOURS_DIR}" "${input}" ;;
  esac
}

normalize_storage_path() {
  local value="$1"
  case "${value}" in
    /public/v1/tour-images/*) printf '%s\n' "${value#/public/v1/tour-images/}" ;;
    public/v1/tour-images/*) printf '%s\n' "${value#public/v1/tour-images/}" ;;
    /*) printf '%s\n' "${value#/}" ;;
    *) printf '%s\n' "${value}" ;;
  esac
}

write_text_review_txt() {
  local tour_json="$1"
  local output_path="$2"

  jq -r \
    --slurpfile styles "${STYLE_CATALOG}" \
    --slurpfile highlights "${HIGHLIGHTS_MANIFEST}" \
    '
    def trim: gsub("^\\s+|\\s+$"; "");
    def clean: tostring | gsub("\r\n"; "\n") | gsub("\r"; "\n") | trim;
    def present: if . == "" then "missing" else . end;
    def localized:
      if type == "string" then clean | present
      elif type == "object" then (.en // "" | clean | present)
      else "missing"
      end;
    def optional_text($localized_value; $fallback):
      ((if ($localized_value | type) == "object" then ($localized_value.en // "")
        elif ($localized_value | type) == "string" then $localized_value
        else "" end) | clean) as $primary
      | if $primary != "" then $primary else (($fallback // "") | clean) end;
    def field($localized_value; $fallback): optional_text($localized_value; $fallback) | present;
    def unique_ordered: reduce .[] as $item ([]; if index($item) then . else . + [$item] end);
    def style_label($code): (($styles[0][]? | select(.code == $code) | .labels.en) // $code);
    def highlight_title($id): (($highlights[0][]? | select(.id == $id) | (.title_i18n.en // .title)) // $id);
    def service_images($service): ([($service.image // empty)] + ($service.images // []));
    def card_image_services:
      [(.travel_plan.days // [])[]? as $day
        | ($day.services // [])[]? as $service
        | service_images($service)[]
        | select(.include_in_travel_tour_card == true and .is_customer_visible != false)
        | field($service.title_i18n; $service.title)]
      | unique_ordered;
    def day_details($day):
      (optional_text($day.details_i18n; $day.details)) as $details
      | if $details != "" then $details else field($day.notes_i18n; $day.notes) end;
    def service_block($service; $index):
      "\($index + 1). \(field($service.title_i18n; $service.title))\n\n"
      + "Detail\n"
      + "\(field($service.details_i18n; $service.details))";
    def day_block($entry):
      ($entry.value) as $day
      | (($day.services // []) | to_entries) as $services
      | "Day \(($day.day_number // ($entry.key + 1)) | tostring)\n\n"
      + "Day title\n"
      + "\(field($day.title_i18n; $day.title))\n\n"
      + "Day Details\n"
      + "\(day_details($day))\n\n"
      + (if ($services | length) == 0 then "missing" else ($services | map(service_block(.value; .key)) | join("\n\n")) end);
    (.travel_plan.days // []) as $days
    | [
      (.title | localized),
      "",
      "Number of days: \(if ($days | length) > 0 then ($days | length | tostring) else "missing" end)",
      "",
      "Tour description",
      "",
      (.short_description | localized),
      "",
      (if ($days | length) == 0 then "missing" else ($days | to_entries | map(day_block(.)) | join("\n\n")) end)
    ] | join("\n")
    ' "${tour_json}" > "${output_path}"
}

write_image_review_pdf() {
  local tour_json="$1"
  local output_path="$2"
  local temp_dir markdown_path title index

  temp_dir="$(mktemp -d)"
  markdown_path="${temp_dir}/images.md"
  title="$(jq -r 'def trim: gsub("^\\s+|\\s+$"; ""); if (.title | type) == "object" then (.title.en // "" | trim) elif (.title | type) == "string" then (.title | trim) else "" end | if . == "" then "missing" else . end' "${tour_json}")"

  {
    printf '%s\n' '---'
    printf 'title: "Image review: %s"\n' "${title//\"/\\\"}"
    printf '%s\n' 'geometry: margin=0.7in'
    printf '%s\n\n' '---'
    printf '# Image review: %s\n\n' "${title}"
  } > "${markdown_path}"

  index=0
  while IFS=$'\t' read -r day_number service_title storage_path; do
    [ -n "${storage_path}" ] || continue
    case "${storage_path}" in
      http://*|https://*) continue ;;
    esac

    local_path="$(normalize_storage_path "${storage_path}")"
    source_path="${TOURS_DIR}/${local_path}"
    [ -f "${source_path}" ] || continue

    index=$((index + 1))
    image_path="${temp_dir}/image_$(printf '%03d' "${index}").jpg"
    "${IMAGE_COMMAND}" "${source_path}" -auto-orient -resize '1400x1400>' -quality 86 "${image_path}"

    if [ -n "${day_number}" ] && [ "${day_number}" != "null" ]; then
      heading="${index}. Day ${day_number}: ${service_title}"
    else
      heading="${index}. ${service_title}"
    fi

    {
      printf '## %s\n\n' "${heading}"
      printf '![](%s){width=%s}\n\n' "${image_path}" "${PDF_IMAGE_WIDTH}"
    } >> "${markdown_path}"
  done < <(
    jq -r '
      def trim: gsub("^\\s+|\\s+$"; "");
      def clean: tostring | gsub("[\t\r\n]+"; " ") | trim;
      def optional_text($localized_value; $fallback):
        ((if ($localized_value | type) == "object" then ($localized_value.en // "")
          elif ($localized_value | type) == "string" then $localized_value
          else "" end) | clean) as $primary
        | if $primary != "" then $primary else (($fallback // "") | clean) end;
      def field($localized_value; $fallback): optional_text($localized_value; $fallback) | if . == "" then "missing" else . end;
      def service_images($service): ([($service.image // empty)] + ($service.images // []));
      (.travel_plan.days // [])[]? as $day
      | ($day.services // [])[]? as $service
      | service_images($service)[]
      | (.storage_path // .url // .src // .path // "") as $path
      | select(($path | tostring | length) > 0)
      | [($day.day_number // ""), field($service.title_i18n; $service.title), $path] | @tsv
    ' "${tour_json}"
  )

  if [ "${index}" -eq 0 ]; then
    printf '%s\n' 'missing' >> "${markdown_path}"
  fi

  pandoc "${markdown_path}" \
    --pdf-engine=xelatex \
    -V "mainfont=${MAIN_FONT}" \
    -V "mainfontoptions=Path=${FONT_DIR}/" \
    -o "${output_path}"

  rm -rf "${temp_dir}"
}

tour_json_paths=()
if [ "${#tour_inputs[@]}" -gt 0 ]; then
  for tour_input in "${tour_inputs[@]}"; do
    tour_json_paths+=("$(tour_json_path_for_input "${tour_input}")")
  done
else
  while IFS= read -r tour_json; do
    tour_json_paths+=("${tour_json}")
  done < <(
    find "${TOURS_DIR}" -mindepth 2 -maxdepth 2 -type f -name tour.json | sort | while IFS= read -r candidate; do
      if jq -e '.published_on_webpage == true' "${candidate}" >/dev/null 2>&1; then
        printf '%s\n' "${candidate}"
      fi
    done
  )
fi

written_count=0
for tour_json in "${tour_json_paths[@]}"; do
  if [ ! -f "${tour_json}" ]; then
    printf 'Tour JSON not found: %s\n' "${tour_json}" >&2
    exit 1
  fi

  tour_id="$(jq -r '.id // empty' "${tour_json}")"
  if [ -z "${tour_id}" ]; then
    tour_id="$(basename "$(dirname "${tour_json}")")"
  fi
  file_id="${tour_id: -6}"
  markdown_path="${OUTPUT_DIR}/review_${file_id}.txt"
  pdf_path="${OUTPUT_DIR}/review_${file_id}.pdf"

  write_text_review_txt "${tour_json}" "${markdown_path}"
  write_image_review_pdf "${tour_json}" "${pdf_path}"
  written_count=$((written_count + 1))
  printf 'Wrote %s\n' "${markdown_path#${REPO_ROOT}/}"
  printf 'Wrote %s\n' "${pdf_path#${REPO_ROOT}/}"
done

if [ "${written_count}" -eq 1 ]; then
  printf 'Done. Wrote 1 review set.\n'
else
  printf 'Done. Wrote %s review sets.\n' "${written_count}"
fi
