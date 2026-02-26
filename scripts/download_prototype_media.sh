#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMG_DIR="$ROOT/assets/img/flickr"
VID_DIR="$ROOT/assets/video"
mkdir -p "$IMG_DIR" "$VID_DIR"

echo "Downloading Flickr prototype images..."
curl -L --fail -o "$IMG_DIR/hero-flickr.jpg" "https://live.staticflickr.com/4205/35071348993_39e6733199_b.jpg"

validate_or_replace() {
  local target="$1"
  if file "$target" | grep -q "JPEG image data"; then
    return 0
  fi
  echo "Warning: $target is not a valid JPEG. Replacing with hero fallback."
  cp "$IMG_DIR/hero-flickr.jpg" "$target"
}

download_from_feed() {
  local tags="$1"
  local out1="$2"
  local out2="$3"
  local feed_url="https://www.flickr.com/services/feeds/photos_public.gne?tags=${tags}&format=json&nojsoncallback=1"
  local tmp_json
  tmp_json="$(mktemp)"
  curl -L --fail -o "$tmp_json" "$feed_url"

  # Parse first two media URLs from feed with python (available by default).
  python3 - "$tmp_json" "$out1" "$out2" <<'PY'
import json, sys, urllib.request
feed_path, out1, out2 = sys.argv[1:4]
with open(feed_path, "r", encoding="utf-8") as f:
    data = json.load(f)
items = data.get("items", [])[:2]
outs = [out1, out2]
for i, item in enumerate(items):
    if i >= len(outs):
        break
    url = item.get("media", {}).get("m", "")
    if not url:
        continue
    # prefer larger asset than thumbnail when available
    url = url.replace("_m.", "_b.")
    urllib.request.urlretrieve(url, outs[i])
PY

  rm -f "$tmp_json"
  validate_or_replace "$out1"
  validate_or_replace "$out2"
}

download_from_feed "vietnam,travel,landscape" "$IMG_DIR/vietnam-1.jpg" "$IMG_DIR/vietnam-2.jpg"
download_from_feed "thailand,travel,beach" "$IMG_DIR/thailand-1.jpg" "$IMG_DIR/thailand-2.jpg"
download_from_feed "cambodia,travel,temple" "$IMG_DIR/cambodia-1.jpg" "$IMG_DIR/cambodia-2.jpg"
download_from_feed "laos,travel,nature" "$IMG_DIR/laos-1.jpg" "$IMG_DIR/laos-2.jpg"

echo "Downloading prototype video (requires yt-dlp)..."
if command -v yt-dlp >/dev/null 2>&1; then
  yt-dlp -f "mp4" -o "$VID_DIR/hero-reel.%(ext)s" "https://vimeo.com/950383325"
else
  echo "yt-dlp not installed. Install it, then run:"
  echo "  yt-dlp -f mp4 -o '$VID_DIR/hero-reel.%(ext)s' https://vimeo.com/950383325"
fi

echo "Done. Update frontend assets under index.html and backend tour records as needed."
