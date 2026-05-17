import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { syncMarketingTourTranslationsForPublish } from "./marketing_tour_translations.js";

export const PUBLIC_SITE_TRANSLATION_DOMAINS = Object.freeze([
  "frontend",
  "index-content-memory",
  "marketing-tour-memory",
  "destination-scope-catalog",
  "backend"
]);

const MANIFEST_SCHEMA = "public-site-publish/v1";
const MAX_LOG_LINES = 400;
const CONTENT_FINGERPRINT_SCHEMA_VERSION = 2;
const CONTENT_SOURCE_EXCLUDED_DIR_NAMES = new Set([".cache"]);
const CONTENT_SOURCE_EXCLUDED_FILE_NAMES = new Set([".DS_Store", ".gitkeep", "README.md"]);
const CONTENT_SOURCE_EXCLUDED_SUFFIXES = [".audit.log", ".tmp"];

function normalizeText(value) {
  return String(value ?? "").trim();
}

function apiError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function sha256(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedRelativePath(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function appendLog(job, line) {
  const normalized = String(line ?? "").trim();
  if (!normalized) return;
  for (const entry of normalized.split(/\r?\n/).filter(Boolean)) {
    job.log.push(entry);
    if (job.log.length > MAX_LOG_LINES) job.log.shift();
  }
}

function formatDurationMs(durationMs) {
  const ms = Math.max(0, Number(durationMs || 0));
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function commandPhase(id, label, command, args) {
  return { id, label, command, args, status: "pending" };
}

function callbackPhase(id, label, run) {
  return { id, label, run, status: "pending" };
}

function snapshotJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    phase: job.phase,
    phases: job.phases.map((phase) => ({
      id: phase.id,
      label: phase.label,
      status: phase.status
    })),
    started_at: job.started_at,
    finished_at: job.finished_at,
    error: job.error,
    error_code: job.error_code,
    source_hash: job.source_hash,
    log: [...job.log]
  };
}

async function readJsonFile(readFileFn, filePath, fallback = {}) {
  try {
    const raw = await readFileFn(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

function isExcludedContentPath(relativePath, manifestRelativePath = "") {
  const normalized = normalizeText(relativePath);
  if (!normalized || normalized.startsWith("../") || path.isAbsolute(normalized)) return true;
  if (manifestRelativePath && normalized === manifestRelativePath) return true;
  const parts = normalized.split("/");
  const basename = parts.at(-1) || "";
  if (parts.some((part) => CONTENT_SOURCE_EXCLUDED_DIR_NAMES.has(part))) return true;
  if (CONTENT_SOURCE_EXCLUDED_FILE_NAMES.has(basename)) return true;
  if (basename.startsWith(".") || parts.some((part) => part.startsWith(".") && !CONTENT_SOURCE_EXCLUDED_DIR_NAMES.has(part))) return true;
  return CONTENT_SOURCE_EXCLUDED_SUFFIXES.some((suffix) => basename.endsWith(suffix));
}

async function listContentSourceFiles({ contentRoot, manifestPath, readdirFn }) {
  const manifestRelativePath = normalizedRelativePath(contentRoot, manifestPath);
  async function visit(dirPath) {
    let entries = [];
    try {
      entries = await readdirFn(dirPath, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }

    const files = [];
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      const relativePath = normalizedRelativePath(contentRoot, entryPath);
      if (isExcludedContentPath(relativePath, manifestRelativePath)) continue;
      if (entry.isDirectory()) {
        const nestedFiles = await visit(entryPath);
        files.push(...nestedFiles);
      } else if (entry.isFile()) {
        files.push({ path: relativePath, absolute_path: entryPath });
      }
    }
    return files;
  }

  return (await visit(contentRoot)).sort((left, right) => left.path.localeCompare(right.path, "en"));
}

async function writeJsonAtomic({ mkdirFn, writeFileFn, renameFn }, filePath, data) {
  await mkdirFn(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFileFn(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await renameFn(tempPath, filePath);
}

function normalizeTranslationStatus(status = {}) {
  const unavailable = Array.isArray(status?.unavailable) ? status.unavailable : [];
  const languages = Array.isArray(status?.languages) ? status.languages : [];
  const hasCount = (field) => status?.[field] !== undefined
    || languages.some((entry) => entry && typeof entry === "object" && entry[field] !== undefined);
  const count = (field) => (
    status?.[field] === undefined
      ? languages.reduce((sum, entry) => sum + Number(entry?.[field] || 0), 0)
      : Number(status?.[field] || 0)
  );
  const missingCount = count("missing_count");
  const staleCount = count("stale_count");
  const legacyCount = count("legacy_count");
  const untranslatedCount = count("untranslated_count");
  const protectedTermCount = count("protected_term_count");
  const translationWorkCount = hasCount("translation_work_count")
    ? count("translation_work_count")
    : missingCount + staleCount + legacyCount + protectedTermCount;
  const issueCount = translationWorkCount;
  const unpublishedCount = count("unpublished_count");
  const dirtyCount = count("dirty_count");
  return {
    dirty: Boolean(status?.dirty || dirtyCount > 0 || unpublishedCount > 0 || issueCount > 0 || unavailable.length > 0),
    dirty_count: dirtyCount,
    translation_work_count: translationWorkCount,
    protected_term_count: protectedTermCount,
    missing_count: missingCount,
    stale_count: staleCount,
    legacy_count: legacyCount,
    untranslated_count: untranslatedCount,
    unpublished_count: unpublishedCount,
    issue_count: issueCount,
    unavailable_count: unavailable.length,
    unavailable,
    runtime_i18n: status?.runtime_i18n && typeof status.runtime_i18n === "object" ? status.runtime_i18n : null,
    languages
  };
}

function translationBlockers(status = {}) {
  const normalized = normalizeTranslationStatus(status);
  const blockers = [];
  if (normalized.unavailable_count > 0) {
    blockers.push({
      code: "translation_status_unavailable",
      message: `${normalized.unavailable_count} translation section${normalized.unavailable_count === 1 ? "" : "s"} could not be checked.`
    });
  }
  return blockers;
}

function normalizePublishReadiness(readiness = null) {
  if (!readiness || typeof readiness !== "object") {
    return {
      fallback_count: 0,
      warnings: [],
      issues: []
    };
  }
  const fallbackCount = Number(readiness.fallback_count || readiness.issue_count || 0);
  return {
    fallback_count: Math.max(0, fallbackCount),
    warnings: Array.isArray(readiness.warnings) ? readiness.warnings : [],
    issues: Array.isArray(readiness.issues) ? readiness.issues : []
  };
}

function translationWarnings(status = {}, readiness = null) {
  const normalized = normalizeTranslationStatus(status);
  const publishReadiness = normalizePublishReadiness(readiness);
  const warnings = [...publishReadiness.warnings];
  const fallbackCount = publishReadiness.fallback_count || normalized.issue_count;
  if (fallbackCount > 0 && !warnings.some((entry) => normalizeText(entry?.code) === "english_fallback")) {
    warnings.push({
      code: "english_fallback",
      count: fallbackCount,
      message: `${fallbackCount} translation item${fallbackCount === 1 ? "" : "s"} will use English fallback.`
    });
  }
  return {
    fallback_count: fallbackCount,
    warnings,
    issues: publishReadiness.issues
  };
}

function runCommandWithSpawn({ spawnCommand, repoRoot, env }) {
  return (phase, job) => new Promise((resolve, reject) => {
    const child = spawnCommand(phase.command, phase.args, {
      cwd: repoRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout?.on("data", (chunk) => appendLog(job, chunk.toString("utf8")));
    child.stderr?.on("data", (chunk) => appendLog(job, chunk.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${phase.label} failed with exit code ${code}.`));
    });
  });
}

export function createPublicSitePublishService({
  repoRoot,
  contentRoot = "",
  manifestPath = "",
  translationsSnapshotDir = "",
  readTours,
  readTourVariants = null,
  normalizeTourForStorage = (tour) => tour,
  staticTranslationService,
  translationMemoryStore = null,
  spawnCommand = spawn,
  runCommand = null,
  nowIso = () => new Date().toISOString(),
  idFactory = randomUUID,
  readFileFn = readFile,
  readdirFn = readdir,
  statFn = stat,
  mkdirFn = mkdir,
  writeFileFn = writeFile,
  renameFn = rename,
  env = process.env
} = {}) {
  if (!repoRoot) {
    throw new Error("createPublicSitePublishService requires repoRoot.");
  }
  if (typeof readTours !== "function") {
    throw new Error("createPublicSitePublishService requires readTours.");
  }
  if (!staticTranslationService || typeof staticTranslationService.getStatusSummary !== "function") {
    throw new Error("createPublicSitePublishService requires staticTranslationService.getStatusSummary.");
  }
  if (typeof staticTranslationService.publishTranslations !== "function") {
    throw new Error("createPublicSitePublishService requires staticTranslationService.publishTranslations.");
  }

  const resolvedManifestPath = normalizeText(manifestPath)
    || path.join(repoRoot, "content", "public-site-publish-manifest.json");
  const resolvedContentRoot = normalizeText(contentRoot) || path.dirname(resolvedManifestPath);
  const resolvedTranslationsSnapshotDir = normalizeText(translationsSnapshotDir)
    || path.join(repoRoot, "content", "translations");
  const executePhase = typeof runCommand === "function"
    ? runCommand
    : runCommandWithSpawn({ spawnCommand, repoRoot, env });

  function runtimeBrandEnvironment() {
    const raw = normalizeText(
      env.PUBLIC_SITE_RUNTIME_BRAND_ENV
      || env.RUNTIME_BRAND_ENV
      || (env.STAGING_ACCESS_ENABLED === "true" ? "staging" : "")
      || (env.NODE_ENV === "development" ? "local" : "")
    ).toLowerCase();
    return ["local", "staging", "production"].includes(raw) ? raw : "production";
  }
  const jobs = new Map();
  let runningJobId = "";

  async function readPublishManifest() {
    return readJsonFile(readFileFn, resolvedManifestPath, {});
  }

  async function readContentSourceSnapshot() {
    const files = await listContentSourceFiles({
      contentRoot: resolvedContentRoot,
      manifestPath: resolvedManifestPath,
      readdirFn
    });
    const entries = [];
    for (const file of files) {
      let stats;
      try {
        stats = await statFn(file.absolute_path);
      } catch (error) {
        if (error?.code === "ENOENT") continue;
        throw error;
      }
      let bytes;
      try {
        bytes = await readFileFn(file.absolute_path);
      } catch (error) {
        if (error?.code === "ENOENT") continue;
        throw error;
      }
      entries.push({
        path: file.path,
        size: Number(stats.size || 0),
        hash: sha256Bytes(bytes)
      });
    }
    return {
      schema_version: CONTENT_FINGERPRINT_SCHEMA_VERSION,
      file_count: entries.length,
      total_bytes: entries.reduce((sum, entry) => sum + entry.size, 0),
      hash: sha256(stableJson(entries)),
      files: entries
    };
  }

  async function readWebsiteTranslationSnapshot() {
    const manifest = await readJsonFile(readFileFn, path.join(resolvedTranslationsSnapshotDir, "manifest.json"), {});
    const domainSet = new Set(PUBLIC_SITE_TRANSLATION_DOMAINS);
    const sections = (Array.isArray(manifest?.sections) ? manifest.sections : [])
      .filter((section) => domainSet.has(normalizeText(section?.domain).toLowerCase()))
      .sort((left, right) => (
        `${normalizeText(left.domain)}|${normalizeText(left.target_lang)}|${normalizeText(left.file)}`
          .localeCompare(`${normalizeText(right.domain)}|${normalizeText(right.target_lang)}|${normalizeText(right.file)}`, "en")
      ));

    const sectionSnapshots = [];
    for (const section of sections) {
      const relativeFile = normalizeText(section?.file);
      const payload = relativeFile
        ? await readJsonFile(readFileFn, path.join(resolvedTranslationsSnapshotDir, relativeFile), {})
        : {};
      const items = (Array.isArray(payload?.items) ? payload.items : [])
        .map((item) => ({
          source_ref: normalizeText(item?.source_ref),
          key: normalizeText(item?.key),
          source_hash: normalizeText(item?.source_hash),
          target_hash: normalizeText(item?.target_hash),
          target_text: normalizeText(item?.target_text),
          origin: normalizeText(item?.origin)
        }))
        .sort((left, right) => (
          `${left.source_ref}|${left.key}`.localeCompare(`${right.source_ref}|${right.key}`, "en")
        ));
      sectionSnapshots.push({
        domain: normalizeText(section.domain),
        target_lang: normalizeText(section.target_lang),
        file: relativeFile,
        item_count: items.length,
        items
      });
    }

    return {
      source_set_hash: normalizeText(manifest?.source_set_hash),
      sections: sectionSnapshots
    };
  }

  async function readTourSnapshot() {
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    return tours
      .map((tour) => stableValue(tour))
      .sort((left, right) => normalizeText(left?.id).localeCompare(normalizeText(right?.id), "en"));
  }

  async function readTourVariantSnapshot() {
    if (typeof readTourVariants !== "function") return [];
    return (await readTourVariants())
      .map((tourVariant) => stableValue(tourVariant))
      .sort((left, right) => normalizeText(left?.id).localeCompare(normalizeText(right?.id), "en"));
  }

  function tourVariantAsTranslationTour(tourVariant) {
    if (!tourVariant || typeof tourVariant !== "object" || Array.isArray(tourVariant)) return null;
    return {
      title: tourVariant.title,
      title_i18n: tourVariant.title_i18n,
      short_description: tourVariant.short_description,
      short_description_i18n: tourVariant.short_description_i18n,
      travel_plan: {
        boundary_logistics: tourVariant.boundary_logistics,
        days: []
      }
    };
  }

  async function computeSourceState() {
    const [content, tours, tourVariants, translations] = await Promise.all([
      readContentSourceSnapshot(),
      readTourSnapshot(),
      readTourVariantSnapshot(),
      readWebsiteTranslationSnapshot()
    ]);
    const source = {
      version: 2,
      content,
      tours,
      tour_variants: tourVariants,
      translations
    };
    return {
      source_hash: sha256(stableJson(source)),
      sources: {
        content: {
          file_count: content.file_count,
          total_bytes: content.total_bytes,
          hash: content.hash
        },
        tours: {
          count: tours.length
        },
        tour_variants: {
          count: tourVariants.length
        },
        translations: {
          domains: PUBLIC_SITE_TRANSLATION_DOMAINS,
          section_count: translations.sections.length,
          item_count: translations.sections.reduce((sum, section) => sum + Number(section.item_count || 0), 0),
          source_set_hash: translations.source_set_hash
        }
      }
    };
  }

  async function getWebsiteTranslationStatus() {
    return staticTranslationService.getStatusSummary({
      domains: PUBLIC_SITE_TRANSLATION_DOMAINS
    });
  }

  async function getWebsiteTranslationReadiness() {
    if (typeof staticTranslationService.getPublishReadiness !== "function") return null;
    try {
      return await staticTranslationService.getPublishReadiness({
        domains: PUBLIC_SITE_TRANSLATION_DOMAINS
      });
    } catch {
      return null;
    }
  }

  async function getStatus() {
    const [manifest, sourceState, rawTranslationStatus, rawPublishReadiness] = await Promise.all([
      readPublishManifest(),
      computeSourceState(),
      getWebsiteTranslationStatus(),
      getWebsiteTranslationReadiness()
    ]);
    const translations = normalizeTranslationStatus(rawTranslationStatus);
    const blockers = translationBlockers(rawTranslationStatus);
    const translationWarningState = translationWarnings(rawTranslationStatus, rawPublishReadiness);
    const hasPublishedHash = Boolean(normalizeText(manifest?.source_hash));
    const sourceDirty = !hasPublishedHash || normalizeText(manifest.source_hash) !== sourceState.source_hash;
    const runningJob = runningJobId ? jobs.get(runningJobId) : null;
    return {
      dirty: Boolean(sourceDirty),
      source_dirty: sourceDirty,
      blocked: blockers.length > 0,
      block_reasons: blockers,
      warnings: translationWarningState.warnings,
      translation_fallback_count: translationWarningState.fallback_count,
      translation_fallback_issues: translationWarningState.issues,
      source_hash: sourceState.source_hash,
      published_source_hash: normalizeText(manifest?.source_hash),
      last_published_at: normalizeText(manifest?.published_at),
      last_publish: manifest?.schema === MANIFEST_SCHEMA ? {
        published_at: normalizeText(manifest.published_at),
        job_id: normalizeText(manifest.job_id),
        source_hash: normalizeText(manifest.source_hash)
      } : null,
      running_job: snapshotJob(runningJob),
      sources: sourceState.sources,
      translations
    };
  }

  async function writeSuccessManifest(job, sourceState) {
    const payload = {
      schema: MANIFEST_SCHEMA,
      schema_version: 1,
      published_at: nowIso(),
      job_id: job.id,
      source_hash: sourceState.source_hash,
      sources: sourceState.sources
    };
    await writeJsonAtomic({ mkdirFn, writeFileFn, renameFn }, resolvedManifestPath, payload);
    return payload;
  }

  function startJob({ phases }) {
    if (runningJobId) {
      throw apiError(409, "PUBLIC_SITE_PUBLISH_JOB_RUNNING", "A public-site publish job is already running.");
    }
    const job = {
      id: idFactory(),
      type: "public_site_publish",
      status: "running",
      phase: phases[0]?.id || "",
      phases,
      started_at: nowIso(),
      finished_at: "",
      error: "",
      error_code: "",
      source_hash: "",
      log: []
    };
    jobs.set(job.id, job);
    runningJobId = job.id;

    (async () => {
      try {
        for (const phase of job.phases) {
          job.phase = phase.id;
          phase.status = "running";
          phase.started_at = nowIso();
          const phaseStartedAtMs = Date.now();
          appendLog(job, `Starting: ${phase.label}`);
          try {
            if (typeof phase.run === "function") {
              await phase.run(phase, job);
            } else {
              await executePhase(phase, job);
            }
          } catch (error) {
            phase.status = "failed";
            phase.finished_at = nowIso();
            phase.duration_ms = Math.max(0, Date.now() - phaseStartedAtMs);
            appendLog(job, `Failed: ${phase.label} after ${formatDurationMs(phase.duration_ms)}`);
            throw error;
          }
          phase.status = "succeeded";
          phase.finished_at = nowIso();
          phase.duration_ms = Math.max(0, Date.now() - phaseStartedAtMs);
          appendLog(job, `Finished: ${phase.label} in ${formatDurationMs(phase.duration_ms)}`);
        }
        job.status = "succeeded";
        job.phase = "";
      } catch (error) {
        const current = job.phases.find((phase) => phase.status === "running");
        if (current) current.status = "failed";
        job.status = "failed";
        job.error = String(error?.message || error);
        job.error_code = normalizeText(error?.code);
        appendLog(job, job.error);
      } finally {
        job.finished_at = nowIso();
        if (runningJobId === job.id) runningJobId = "";
      }
    })();

    return snapshotJob(job);
  }

  return {
    getStatus,
    startPublish() {
      return startJob({
        phases: [
          callbackPhase("sync_tour_translations", "Sync manual marketing-tour translations", async (_phase, job) => {
            const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
            const tourVariants = typeof readTourVariants === "function"
              ? (await readTourVariants()).map(tourVariantAsTranslationTour).filter(Boolean)
              : [];
            await syncMarketingTourTranslationsForPublish([...tours, ...tourVariants], translationMemoryStore);
            appendLog(job, `Synced manual translations for ${tours.length} marketing tour${tours.length === 1 ? "" : "s"} and ${tourVariants.length} Tour Variant${tourVariants.length === 1 ? "" : "s"}.`);
          }),
          callbackPhase("validate_translations", "Validate public website translations", async (_phase, job) => {
            const [status, readiness] = await Promise.all([
              getWebsiteTranslationStatus(),
              getWebsiteTranslationReadiness()
            ]);
            const blockers = translationBlockers(status);
            if (blockers.length) {
              const error = apiError(
                409,
                "PUBLIC_SITE_PUBLISH_BLOCKED",
                blockers.map((blocker) => blocker.message).join(" ")
              );
              error.details = blockers;
              throw error;
            }
            const translations = normalizeTranslationStatus(status);
            const warningState = translationWarnings(status, readiness);
            appendLog(job, `Validated public website translations. ${translations.unpublished_count} translated item${translations.unpublished_count === 1 ? "" : "s"} ready for runtime generation.`);
            if (warningState.fallback_count > 0) {
              appendLog(job, `${warningState.fallback_count} translation item${warningState.fallback_count === 1 ? "" : "s"} will use English fallback.`);
            }
          }),
          callbackPhase("publish_translations", "Publish translation snapshots", async (_phase, job) => {
            const manifest = await staticTranslationService.publishTranslations({
              domains: PUBLIC_SITE_TRANSLATION_DOMAINS
            });
            appendLog(job, `Published ${manifest?.total_items || 0} translation item${manifest?.total_items === 1 ? "" : "s"}.`);
            if (Number(manifest?.fallback_count || 0) > 0) {
              appendLog(job, `${manifest.fallback_count} translation item${manifest.fallback_count === 1 ? "" : "s"} used English fallback.`);
            }
            job.publish_source_state = await computeSourceState();
            job.source_hash = job.publish_source_state.source_hash;
          }),
          commandPhase("runtime_brand_logo", "Prepare runtime brand logo", "bash", ["scripts/assets/prepare_runtime_brand_logo.sh", runtimeBrandEnvironment()]),
          commandPhase("runtime_i18n", "Generate runtime i18n", process.execPath, ["scripts/i18n/build_runtime_i18n.mjs", "--strict"]),
          commandPhase("homepage_assets", "Regenerate public homepage assets", process.execPath, ["scripts/assets/generate_public_homepage_assets.mjs"]),
          callbackPhase("write_manifest", "Record public-site publish manifest", async (_phase, job) => {
            const expectedSourceState = job.publish_source_state || await computeSourceState();
            const currentSourceState = await computeSourceState();
            if (normalizeText(expectedSourceState.source_hash) !== normalizeText(currentSourceState.source_hash)) {
              throw apiError(
                409,
                "PUBLIC_SITE_CONTENT_CHANGED_DURING_PUBLISH",
                "Content changed while the public site was being published. Run Publish Website again."
              );
            }
            const manifest = await writeSuccessManifest(job, expectedSourceState);
            job.source_hash = manifest.source_hash;
            appendLog(job, `Recorded public-site publish manifest. source_hash=${manifest.source_hash}`);
          })
        ]
      });
    },
    getJob(jobId) {
      const job = jobs.get(normalizeText(jobId));
      if (!job) {
        throw apiError(404, "PUBLIC_SITE_PUBLISH_JOB_NOT_FOUND", "Public-site publish job not found.");
      }
      return snapshotJob(job);
    }
  };
}
