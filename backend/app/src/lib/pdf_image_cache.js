import { stat } from "node:fs/promises";
import sharp from "sharp";

const DEFAULT_MAX_ENTRIES = 256;
const DEFAULT_MAX_BYTES = 128 * 1024 * 1024;

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function imageCacheEnabled() {
  return String(process.env.PDF_IMAGE_CACHE || "").trim() !== "0";
}

const maxEntries = positiveInt(process.env.PDF_IMAGE_CACHE_MAX_ENTRIES, DEFAULT_MAX_ENTRIES);
const maxBytes = positiveInt(process.env.PDF_IMAGE_CACHE_MAX_BYTES, DEFAULT_MAX_BYTES);
const rasterCache = new Map();
const rasterInflight = new Map();
let rasterCacheBytes = 0;

function deleteCacheEntry(key) {
  const entry = rasterCache.get(key);
  if (!entry) return;
  rasterCacheBytes -= Number(entry.bytes || 0);
  rasterCache.delete(key);
}

function rememberCacheEntry(key, value) {
  if (!value?.buffer) return value;
  const bytes = value.buffer.length || 0;
  if (bytes > maxBytes) return value;
  deleteCacheEntry(key);
  rasterCache.set(key, { value, bytes });
  rasterCacheBytes += bytes;
  while (rasterCache.size > maxEntries || rasterCacheBytes > maxBytes) {
    const oldestKey = rasterCache.keys().next().value;
    if (!oldestKey) break;
    deleteCacheEntry(oldestKey);
  }
  return value;
}

function readCacheEntry(key) {
  const entry = rasterCache.get(key);
  if (!entry) return null;
  rasterCache.delete(key);
  rasterCache.set(key, entry);
  return entry.value;
}

async function imageStat(filePath) {
  if (!filePath) return null;
  try {
    const result = await stat(filePath);
    return result.isFile() ? result : null;
  } catch {
    return null;
  }
}

export async function pdfImageFileExists(filePath) {
  return Boolean(await imageStat(filePath));
}

function rasterCacheKey(filePath, fileStat, options) {
  return [
    "raster",
    filePath,
    fileStat.size,
    Math.trunc(fileStat.mtimeMs),
    options.width || "",
    options.height || "",
    options.fit || "cover",
    options.position || "centre",
    options.quality || 88,
    options.withoutEnlargement === true ? "1" : "0"
  ].join("|");
}

async function rasterizeUncached(filePath, {
  width,
  height,
  fit = "cover",
  position = "centre",
  quality = 88,
  withoutEnlargement = false
} = {}) {
  const image = sharp(filePath, { failOn: "none" }).rotate();
  const metadata = await image.metadata().catch(() => ({}));
  const buffer = await image
    .resize({
      width: width || null,
      height: height || null,
      fit,
      position,
      withoutEnlargement
    })
    .jpeg({ quality })
    .toBuffer();
  return {
    buffer,
    width: width || metadata.width || 1,
    height: height || metadata.height || 1
  };
}

export async function rasterizePdfImage(filePath, options = {}) {
  const normalizedPath = String(filePath || "").trim();
  if (!normalizedPath) return null;
  const fileStat = await imageStat(normalizedPath);
  if (!fileStat) return null;
  if (!imageCacheEnabled()) {
    return rasterizeUncached(normalizedPath, options);
  }

  const key = rasterCacheKey(normalizedPath, fileStat, options);
  const cached = readCacheEntry(key);
  if (cached) return cached;
  const inflight = rasterInflight.get(key);
  if (inflight) return inflight;

  const promise = rasterizeUncached(normalizedPath, options)
    .then((value) => rememberCacheEntry(key, value))
    .finally(() => {
      rasterInflight.delete(key);
    });
  rasterInflight.set(key, promise);
  return promise;
}
