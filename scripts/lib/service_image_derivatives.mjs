import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const require = createRequire(import.meta.url);

export const DEFAULT_SERVICE_IMAGE_DERIVATIVE_CACHE_ROOT = path.join(
  repoRoot,
  "content",
  ".cache",
  "service-image-derivatives"
);

export const SERVICE_IMAGE_DERIVATIVE_VARIANTS = Object.freeze({
  "homepage-card": Object.freeze({
    width: 720,
    height: 720,
    fit: "cover",
    position: "centre",
    withoutEnlargement: true,
    quality: 68,
    effort: 5,
    suffix: "",
    outputSubdir: ""
  }),
  "customizer-thumb": Object.freeze({
    width: 360,
    height: 270,
    fit: "cover",
    position: "centre",
    withoutEnlargement: true,
    quality: 64,
    effort: 4,
    suffix: "w360",
    outputSubdir: "_thumbs"
  }),
  "matrix-thumb": Object.freeze({
    width: 300,
    height: 300,
    fit: "inside",
    position: "centre",
    withoutEnlargement: true,
    quality: 68,
    effort: 4,
    suffix: "w300",
    outputSubdir: ""
  })
});

const MANIFEST_FILENAME = "manifest.json";
let sharpModule;

function normalizeRelativePath(value) {
  return String(value || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
}

function variantConfig(variant, overrides = {}) {
  const name = String(variant || "matrix-thumb");
  const base = SERVICE_IMAGE_DERIVATIVE_VARIANTS[name];
  if (!base) throw new Error(`Unknown service image derivative variant: ${name}`);
  return {
    ...base,
    ...(overrides && typeof overrides === "object" && !Array.isArray(overrides) ? overrides : {})
  };
}

function loadSharp() {
  if (sharpModule) return sharpModule;

  try {
    sharpModule = require("sharp");
    return sharpModule;
  } catch (error) {
    try {
      sharpModule = require(path.join(repoRoot, "backend", "app", "node_modules", "sharp"));
      return sharpModule;
    } catch {
      throw new Error(
        `Unable to load sharp. Run "npm install" in backend/app before generating service image derivatives. Original error: ${error.message}`
      );
    }
  }
}

function hashText(value) {
  return createHash("sha1").update(String(value ?? ""), "utf8").digest("hex");
}

function safeStem(value) {
  const parsed = path.posix.parse(normalizeRelativePath(value));
  const stem = parsed.name || "service-image";
  return stem.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "service-image";
}

function manifestPath(cacheRoot) {
  return path.join(cacheRoot, MANIFEST_FILENAME);
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readManifest(cacheRoot) {
  try {
    const parsed = JSON.parse(await readFile(manifestPath(cacheRoot), "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : { schema: "service-image-derivatives/v1", items: {} };
  } catch (error) {
    if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    return { schema: "service-image-derivatives/v1", items: {} };
  }
}

async function updateManifest(cacheRoot, entry) {
  await mkdir(cacheRoot, { recursive: true });
  const manifest = await readManifest(cacheRoot);
  const items = manifest.items && typeof manifest.items === "object" && !Array.isArray(manifest.items)
    ? manifest.items
    : {};
  items[entry.key] = entry;
  const output = `${JSON.stringify({
    schema: "service-image-derivatives/v1",
    items
  }, null, 2)}\n`;
  const finalPath = manifestPath(cacheRoot);
  const tmpPath = path.join(
    cacheRoot,
    `${MANIFEST_FILENAME}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  );
  await writeFile(tmpPath, output, "utf8");
  await rename(tmpPath, finalPath);
}

export function serviceImageDerivativeRelativePath(sourceRelativePath, { variant = "matrix-thumb" } = {}) {
  const normalizedSourcePath = normalizeRelativePath(sourceRelativePath);
  if (!normalizedSourcePath) return "";
  const config = variantConfig(variant);
  const parsed = path.posix.parse(normalizedSourcePath);
  const outputDir = config.outputSubdir
    ? path.posix.join(parsed.dir, config.outputSubdir)
    : parsed.dir;
  const suffix = config.suffix ? `.${config.suffix}` : "";
  return path.posix.join(outputDir, `${parsed.name}${suffix}.webp`);
}

export async function writeServiceImageDerivative(sourcePath, outputPath, {
  variant = "matrix-thumb",
  sharp = null,
  overrides = {}
} = {}) {
  const config = variantConfig(variant, overrides);
  const sharpImpl = sharp || loadSharp();
  const outputDir = path.dirname(outputPath);
  await mkdir(outputDir, { recursive: true });
  const tmpPath = path.join(
    outputDir,
    `.${path.basename(outputPath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.webp`
  );
  await sharpImpl(sourcePath, { failOn: "none" })
    .rotate()
    .resize({
      width: config.width,
      height: config.height,
      fit: config.fit,
      position: config.position,
      withoutEnlargement: config.withoutEnlargement !== false
    })
    .webp({
      quality: config.quality,
      effort: config.effort
    })
    .toFile(tmpPath);
  await rename(tmpPath, outputPath);
}

export async function getCachedServiceImageDerivative({
  sourcePath,
  sourceRelativePath = "",
  variant = "matrix-thumb",
  cacheRoot = DEFAULT_SERVICE_IMAGE_DERIVATIVE_CACHE_ROOT
} = {}) {
  const normalizedSourcePath = normalizeRelativePath(sourceRelativePath) || normalizeRelativePath(path.basename(sourcePath || ""));
  if (!sourcePath || !normalizedSourcePath) {
    throw new Error("sourcePath and sourceRelativePath are required to cache a service image derivative.");
  }
  const sourceStats = await stat(sourcePath);
  const config = variantConfig(variant);
  const configHash = hashText(JSON.stringify(config));
  const key = hashText(JSON.stringify({
    sourceRelativePath: normalizedSourcePath,
    sourceSize: sourceStats.size,
    sourceMtimeMs: Math.round(sourceStats.mtimeMs),
    variant,
    configHash
  }));
  const relativePath = path.join(variant, key.slice(0, 2), `${safeStem(normalizedSourcePath)}-${key}.webp`);
  const outputPath = path.join(cacheRoot, relativePath);

  if (!(await pathExists(outputPath))) {
    await writeServiceImageDerivative(sourcePath, outputPath, { variant });
    await updateManifest(cacheRoot, {
      key,
      variant,
      source_relative_path: normalizedSourcePath,
      source_size: sourceStats.size,
      source_mtime_ms: sourceStats.mtimeMs,
      config_hash: configHash,
      cached_relative_path: relativePath.split(path.sep).join("/")
    });
  }

  return {
    key,
    path: outputPath,
    relativePath: relativePath.split(path.sep).join("/")
  };
}

export async function copyCachedServiceImageDerivative({
  sourcePath,
  sourceRelativePath,
  outputPath,
  variant = "matrix-thumb",
  cacheRoot = DEFAULT_SERVICE_IMAGE_DERIVATIVE_CACHE_ROOT
} = {}) {
  const cached = await getCachedServiceImageDerivative({
    sourcePath,
    sourceRelativePath,
    variant,
    cacheRoot
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await copyFile(cached.path, outputPath);
  return cached;
}
