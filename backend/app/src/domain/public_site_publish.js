import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { syncMarketingTourTranslationsForPublish } from "./marketing_tour_translations.js";

export const PUBLIC_SITE_TRANSLATION_DOMAINS = Object.freeze([
  "frontend",
  "index-content-memory",
  "marketing-tour-memory",
  "destination-scope-catalog"
]);

const MANIFEST_SCHEMA = "public-site-publish/v1";
const MAX_LOG_LINES = 400;

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

async function writeJsonAtomic({ mkdirFn, writeFileFn, renameFn }, filePath, data) {
  await mkdirFn(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFileFn(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await renameFn(tempPath, filePath);
}

function normalizeTranslationStatus(status = {}) {
  const unavailable = Array.isArray(status?.unavailable) ? status.unavailable : [];
  const languages = Array.isArray(status?.languages) ? status.languages : [];
  const count = (field) => (
    status?.[field] === undefined
      ? languages.reduce((sum, entry) => sum + Number(entry?.[field] || 0), 0)
      : Number(status?.[field] || 0)
  );
  const missingCount = count("missing_count");
  const staleCount = count("stale_count");
  const legacyCount = count("legacy_count");
  const untranslatedCount = count("untranslated_count");
  const issueCount = missingCount + staleCount + legacyCount + Math.max(0, untranslatedCount - missingCount);
  const unpublishedCount = count("unpublished_count");
  const dirtyCount = count("dirty_count");
  return {
    dirty: Boolean(status?.dirty || dirtyCount > 0 || unpublishedCount > 0 || issueCount > 0 || unavailable.length > 0),
    dirty_count: dirtyCount,
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
  if (normalized.issue_count > 0) {
    blockers.push({
      code: "translations_need_work",
      message: `${normalized.issue_count} translation item${normalized.issue_count === 1 ? "" : "s"} need translation or update before publishing.`
    });
  }
  const runtimeSnapshotCanBeRefreshed = normalized.unpublished_count > 0
    && normalized.issue_count === 0
    && normalized.unavailable_count === 0;
  if (normalized.runtime_i18n?.blocked && !runtimeSnapshotCanBeRefreshed) {
    blockers.push({
      code: "runtime_i18n_blocked",
      message: normalizeText(normalized.runtime_i18n.error || normalized.runtime_i18n.output) || "Runtime translation generation is blocked."
    });
  }
  return blockers;
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
  manifestPath = "",
  translationsSnapshotDir = "",
  readTours,
  normalizeTourForStorage = (tour) => tour,
  staticTranslationService,
  translationMemoryStore = null,
  spawnCommand = spawn,
  runCommand = null,
  nowIso = () => new Date().toISOString(),
  idFactory = randomUUID,
  readFileFn = readFile,
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
  const resolvedTranslationsSnapshotDir = normalizeText(translationsSnapshotDir)
    || path.join(repoRoot, "content", "translations");
  const executePhase = typeof runCommand === "function"
    ? runCommand
    : runCommandWithSpawn({ spawnCommand, repoRoot, env });
  const jobs = new Map();
  let runningJobId = "";

  async function readPublishManifest() {
    return readJsonFile(readFileFn, resolvedManifestPath, {});
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

  async function computeSourceState() {
    const [tours, translations] = await Promise.all([
      readTourSnapshot(),
      readWebsiteTranslationSnapshot()
    ]);
    const source = {
      version: 1,
      tours,
      translations
    };
    return {
      source_hash: sha256(stableJson(source)),
      sources: {
        tours: {
          count: tours.length
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

  async function getStatus() {
    const [manifest, sourceState, rawTranslationStatus] = await Promise.all([
      readPublishManifest(),
      computeSourceState(),
      getWebsiteTranslationStatus()
    ]);
    const translations = normalizeTranslationStatus(rawTranslationStatus);
    const blockers = translationBlockers(rawTranslationStatus);
    const hasPublishedHash = Boolean(normalizeText(manifest?.source_hash));
    const sourceDirty = !hasPublishedHash || normalizeText(manifest.source_hash) !== sourceState.source_hash;
    const runningJob = runningJobId ? jobs.get(runningJobId) : null;
    return {
      dirty: Boolean(sourceDirty || translations.dirty),
      source_dirty: sourceDirty,
      blocked: blockers.length > 0,
      block_reasons: blockers,
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
          appendLog(job, `Starting: ${phase.label}`);
          if (typeof phase.run === "function") {
            await phase.run(phase, job);
          } else {
            await executePhase(phase, job);
          }
          phase.status = "succeeded";
          appendLog(job, `Finished: ${phase.label}`);
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
            await syncMarketingTourTranslationsForPublish(tours, translationMemoryStore);
            appendLog(job, `Synced manual translations for ${tours.length} marketing tour${tours.length === 1 ? "" : "s"}.`);
          }),
          callbackPhase("validate_translations", "Validate public website translations", async (_phase, job) => {
            const status = await getWebsiteTranslationStatus();
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
            appendLog(job, `Validated public website translations. ${translations.unpublished_count} translated item${translations.unpublished_count === 1 ? "" : "s"} ready for runtime generation.`);
          }),
          callbackPhase("publish_translations", "Publish translation snapshots", async (_phase, job) => {
            const manifest = await staticTranslationService.publishTranslations({
              domains: PUBLIC_SITE_TRANSLATION_DOMAINS
            });
            appendLog(job, `Published ${manifest?.total_items || 0} translation item${manifest?.total_items === 1 ? "" : "s"}.`);
          }),
          commandPhase("runtime_i18n", "Generate runtime i18n", process.execPath, ["scripts/i18n/build_runtime_i18n.mjs", "--strict"]),
          commandPhase("homepage_assets", "Regenerate public homepage assets", process.execPath, ["scripts/assets/generate_public_homepage_assets.mjs"]),
          callbackPhase("write_manifest", "Record public-site publish manifest", async (_phase, job) => {
            const sourceState = await computeSourceState();
            const manifest = await writeSuccessManifest(job, sourceState);
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
