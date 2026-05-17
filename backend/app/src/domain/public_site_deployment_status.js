import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, readFile, readlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const PUBLIC_SITE_DEPLOYMENT_MANIFEST_SCHEMA = "public-site-deployment/v1";
export const PUBLIC_SITE_DEPLOYMENT_MANIFEST_NAME = "public-site-deployment-manifest.json";

const DEFAULT_EXCLUDED_CONTENT_METADATA_PATHS = Object.freeze([
  PUBLIC_SITE_DEPLOYMENT_MANIFEST_NAME,
  "public-site-publish-manifest.json"
]);

function normalizeText(value) {
  return String(value ?? "").trim();
}

function toPosixRelativePath(value) {
  return normalizeText(value).split(path.sep).join("/");
}

function defaultManifestPath(repoRoot) {
  return path.join(repoRoot, "content", PUBLIC_SITE_DEPLOYMENT_MANIFEST_NAME);
}

function normalizeExcludedPaths(excluded = DEFAULT_EXCLUDED_CONTENT_METADATA_PATHS) {
  return new Set(
    (Array.isArray(excluded) ? excluded : DEFAULT_EXCLUDED_CONTENT_METADATA_PATHS)
      .map((value) => toPosixRelativePath(value).replace(/^\/+/, ""))
      .filter(Boolean)
  );
}

function metadataHash(entries) {
  const hash = createHash("sha256");
  for (const entry of entries) {
    hash.update(JSON.stringify(entry));
    hash.update("\n");
  }
  return hash.digest("hex");
}

async function collectMetadataEntries(rootDir, currentDir, excludedPaths, entries) {
  const names = (await readdir(currentDir)).sort((left, right) => left.localeCompare(right, "en"));
  for (const name of names) {
    const absolutePath = path.join(currentDir, name);
    const relativePath = toPosixRelativePath(path.relative(rootDir, absolutePath));
    if (!relativePath || excludedPaths.has(relativePath)) continue;

    const stats = await lstat(absolutePath);
    const baseEntry = {
      path: relativePath,
      mode: stats.mode,
      mtime_ms: Math.floor(stats.mtimeMs)
    };

    if (stats.isDirectory()) {
      entries.push({
        ...baseEntry,
        type: "directory"
      });
      await collectMetadataEntries(rootDir, absolutePath, excludedPaths, entries);
      continue;
    }

    if (stats.isSymbolicLink()) {
      entries.push({
        ...baseEntry,
        type: "symlink",
        size: stats.size,
        target: await readlink(absolutePath).catch(() => "")
      });
      continue;
    }

    if (stats.isFile()) {
      entries.push({
        ...baseEntry,
        type: "file",
        size: stats.size
      });
      continue;
    }

    entries.push({
      ...baseEntry,
      type: "other",
      size: stats.size
    });
  }
}

export async function computeContentMetadataHash({
  contentRoot,
  excludeRelativePaths = DEFAULT_EXCLUDED_CONTENT_METADATA_PATHS
} = {}) {
  const normalizedContentRoot = normalizeText(contentRoot);
  if (!normalizedContentRoot) {
    throw new Error("computeContentMetadataHash requires contentRoot.");
  }
  const resolvedContentRoot = path.resolve(normalizedContentRoot);

  const excludedPaths = normalizeExcludedPaths(excludeRelativePaths);
  const entries = [];
  await collectMetadataEntries(resolvedContentRoot, resolvedContentRoot, excludedPaths, entries);

  const fileEntries = entries.filter((entry) => entry.type === "file");
  const directoryEntries = entries.filter((entry) => entry.type === "directory");
  const totalBytes = fileEntries.reduce((sum, entry) => sum + Number(entry.size || 0), 0);

  return {
    hash: metadataHash(entries),
    file_count: fileEntries.length,
    directory_count: directoryEntries.length,
    entry_count: entries.length,
    total_bytes: totalBytes
  };
}

export async function writePublicSiteDeploymentManifest({
  repoRoot,
  contentRoot = path.join(repoRoot || "", "content"),
  manifestPath = defaultManifestPath(repoRoot),
  environment = "",
  nowIso = () => new Date().toISOString()
} = {}) {
  if (!repoRoot) {
    throw new Error("writePublicSiteDeploymentManifest requires repoRoot.");
  }

  const contentMetadata = await computeContentMetadataHash({ contentRoot });
  const manifest = {
    schema: PUBLIC_SITE_DEPLOYMENT_MANIFEST_SCHEMA,
    schema_version: 1,
    generated_at: nowIso(),
    environment: normalizeText(environment) || "unknown",
    content_metadata: contentMetadata
  };

  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

async function readManifest(manifestPath) {
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    return {
      schema: "",
      error: normalizeText(error?.message) || "Deployment manifest could not be read."
    };
  }
}

function manifestHash(manifest) {
  return normalizeText(manifest?.content_metadata?.hash);
}

export function createPublicSiteDeploymentStatusService({
  repoRoot,
  contentRoot = path.join(repoRoot || "", "content"),
  manifestPath = defaultManifestPath(repoRoot),
  nowIso = () => new Date().toISOString()
} = {}) {
  if (!repoRoot) {
    throw new Error("createPublicSiteDeploymentStatusService requires repoRoot.");
  }

  async function getStatus() {
    const checkedAt = nowIso();
    let currentMetadata;
    try {
      currentMetadata = await computeContentMetadataHash({ contentRoot });
    } catch (error) {
      return {
        loaded: false,
        clean: false,
        dirty: true,
        status: "error",
        checked_at: checkedAt,
        error: normalizeText(error?.message) || "Content metadata could not be hashed."
      };
    }

    const manifest = await readManifest(manifestPath);
    const deployedHash = manifestHash(manifest);
    const currentHash = currentMetadata.hash;
    const clean = Boolean(deployedHash && deployedHash === currentHash);
    const manifestError = normalizeText(manifest?.error);

    return {
      loaded: true,
      clean,
      dirty: !clean,
      status: clean ? "clean" : (manifest ? "dirty" : "missing_manifest"),
      checked_at: checkedAt,
      deployed_at: normalizeText(manifest?.generated_at) || null,
      deployed_hash: deployedHash || null,
      current_hash: currentHash,
      content_metadata: currentMetadata,
      deployed_content_metadata: manifest?.content_metadata || null,
      manifest_schema: normalizeText(manifest?.schema) || null,
      ...(manifestError ? { error: manifestError } : {})
    };
  }

  return {
    getStatus
  };
}
