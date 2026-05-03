import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  FRONTEND_LANGUAGE_CODES
} from "../../../../shared/generated/language_catalog.js";

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

function redactLine(line, env = process.env) {
  let next = String(line ?? "");
  for (const key of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"]) {
    const secret = normalizeText(env?.[key]);
    if (secret) next = next.split(secret).join(`[redacted:${key}]`);
  }
  return next;
}

function countTranslationIssues(entry) {
  return Number(entry?.missing_count || 0)
    + Number(entry?.stale_count || 0)
    + Number(entry?.legacy_count || 0);
}

function clampCount(value, max = Number.POSITIVE_INFINITY) {
  const count = Math.max(0, Math.floor(Number(value) || 0));
  return Number.isFinite(max) ? Math.min(count, max) : count;
}

function progressKeyForEntry(entry) {
  const domain = normalizeText(entry?.domain);
  const targetLang = normalizeText(entry?.target_lang).toLowerCase();
  return domain && targetLang ? `${domain}|${targetLang}` : "";
}

function progressMetadataForEntries(entries, keys) {
  const counts = {};
  for (const entry of Array.isArray(entries) ? entries : []) {
    const key = progressKeyForEntry(entry);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + countTranslationIssues(entry);
  }

  const orderedKeys = Array.isArray(keys) && keys.length
    ? keys
    : Object.keys(counts);
  const progress_counts = {};
  const progress_offsets = {};
  let progress_count = 0;
  for (const key of orderedKeys) {
    const count = clampCount(counts[key]);
    if (!count) continue;
    progress_counts[key] = count;
    progress_offsets[key] = progress_count;
    progress_count += count;
  }
  return { progress_count, progress_counts, progress_offsets };
}

function progressMetadataForTargetLangs(entries, targetLangs) {
  const keys = uniqueNormalized(targetLangs).map((targetLang) => `frontend|${targetLang}`);
  return progressMetadataForEntries(entries, keys);
}

function withProgress(phase, progress = {}) {
  return {
    ...phase,
    progress_count: clampCount(progress.progress_count),
    progress_counts: progress.progress_counts || {},
    progress_offsets: progress.progress_offsets || {}
  };
}

function prepareJobPhases(phases) {
  let progressTotal = 0;
  const prepared = (Array.isArray(phases) ? phases : []).map((phase) => {
    const progressCount = clampCount(phase?.progress_count);
    const next = {
      ...phase,
      progress_count: progressCount,
      progress_offset: progressTotal,
      progress_counts: phase?.progress_counts || {},
      progress_offsets: phase?.progress_offsets || {}
    };
    progressTotal += progressCount;
    return next;
  });
  return { phases: prepared, progressTotal };
}

function updateJobProgress(job, phase, progress = {}) {
  if (!job || !phase) return;
  const parsedCurrent = clampCount(progress.current);
  const parsedTotal = clampCount(progress.total);
  const progressKey = normalizeText(progress.key);
  const subCount = progressKey ? clampCount(phase.progress_counts?.[progressKey]) : 0;
  const subOffset = progressKey ? clampCount(phase.progress_offsets?.[progressKey]) : 0;
  const phaseCount = subCount || clampCount(phase.progress_count) || parsedTotal;
  if (!phaseCount) return;

  const jobProgress = job.progress || { current: 0, total: 0 };
  const phaseOffset = clampCount(phase.progress_offset) + subOffset;
  const nextCurrent = phaseOffset + clampCount(parsedCurrent, phaseCount);
  const plannedTotal = clampCount(jobProgress.total);
  const dynamicTotal = phaseOffset + phaseCount;
  const nextTotal = phase.progress_count
    ? clampCount(plannedTotal || dynamicTotal)
    : clampCount(Math.max(plannedTotal, dynamicTotal));
  job.progress = {
    current: clampCount(Math.max(jobProgress.current || 0, nextCurrent), nextTotal || Number.POSITIVE_INFINITY),
    total: nextTotal
  };
}

function updateJobProgressFromLogLine(job, phase, line) {
  const match = /Translat(?:ing|ed) \[(?:(\S+)\s+)?(\d+)\/(\d+)\]/i.exec(String(line || ""));
  if (!match) return;
  const [, targetLang, current, total] = match;
  const normalizedLang = normalizeText(targetLang).toLowerCase();
  updateJobProgress(job, phase, {
    current,
    total,
    key: normalizedLang ? `frontend|${normalizedLang}` : ""
  });
}

function completePhaseProgress(job, phase) {
  if (!phase?.progress_count) return;
  updateJobProgress(job, phase, {
    current: phase.progress_count,
    total: phase.progress_count
  });
}

function appendLog(job, line, env, phase = null) {
  const safeLine = redactLine(line, env);
  if (!safeLine) return;
  for (const entry of safeLine.split(/\r?\n/).filter(Boolean)) {
    job.log.push(entry);
    if (job.log.length > MAX_LOG_LINES) job.log.shift();
    updateJobProgressFromLogLine(job, phase, entry);
  }
}

function snapshot(job) {
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
    progress: {
      current: clampCount(job.progress?.current, job.progress?.total || Number.POSITIVE_INFINITY),
      total: clampCount(job.progress?.total)
    },
    log: [...job.log]
  };
}

function commandPhase(id, label, command, args) {
  return { id, label, command, args, status: "pending" };
}

function callbackPhase(id, label, run) {
  return { id, label, run, status: "pending" };
}

function whenPhase(phase, when) {
  return { ...phase, when };
}

function languageHasTranslationIssues(entry) {
  return Number(entry?.missing_count || 0) > 0
    || Number(entry?.stale_count || 0) > 0
    || Number(entry?.legacy_count || 0) > 0;
}

function uniqueNormalized(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean))];
}

function targetArgs(targetLangs) {
  return uniqueNormalized(targetLangs).flatMap((lang) => ["--target", lang]);
}

function runtimeI18nPhase() {
  return commandPhase("runtime_i18n", "Generate runtime i18n from content/translations", process.execPath, ["scripts/i18n/build_runtime_i18n.mjs", "--strict"]);
}

function homepageAssetsPhase() {
  return commandPhase("homepage_assets", "Regenerate public homepage assets", process.execPath, ["scripts/assets/generate_public_homepage_assets.mjs"]);
}

function centralApplyOptions(entries) {
  const targetLangsByDomain = {};
  for (const entry of entries) {
    const domain = normalizeText(entry?.domain);
    const targetLang = normalizeText(entry?.target_lang).toLowerCase();
    if (!domain || !targetLang) continue;
    targetLangsByDomain[domain] = uniqueNormalized([...(targetLangsByDomain[domain] || []), targetLang]);
  }
  return {
    domains: Object.keys(targetLangsByDomain),
    target_langs_by_domain: targetLangsByDomain
  };
}

function issueEntriesFromStatus(status) {
  return (Array.isArray(status?.languages) ? status.languages : []).filter(languageHasTranslationIssues);
}

function fallbackApplyPhases({ applyTranslations, includeHomepageAssets = true } = {}) {
  const phases = [];
  if (typeof applyTranslations === "function") {
    phases.push(callbackPhase("translate_content_store", "Translate missing and stale strings", async (_phase, job, helpers) => {
      const summary = await applyTranslations();
      helpers.appendLog(
        job,
        `Translated ${summary?.translated_count || 0} translation item${summary?.translated_count === 1 ? "" : "s"} in content/translations.`
      );
    }));
  }
  if (includeHomepageAssets) {
    phases.push(homepageAssetsPhase());
  }
  return phases;
}

async function applyPhases({ applyTranslations, getStatusSummary } = {}) {
  if (typeof getStatusSummary !== "function") {
    return fallbackApplyPhases({ applyTranslations });
  }

  const status = await getStatusSummary();
  const issueEntries = issueEntriesFromStatus(status);
  const applyOptions = centralApplyOptions(issueEntries);
  const phases = [];

  if (applyOptions.domains.length && typeof applyTranslations === "function") {
    const progressKeys = [...new Set(issueEntries
      .map(progressKeyForEntry)
      .filter(Boolean))];
    phases.push(withProgress(callbackPhase("translate_content_store", "Translate missing and stale strings", async (phase, job, helpers) => {
      const summary = await applyTranslations({
        ...applyOptions,
        onProgress(progress = {}) {
          const domain = normalizeText(progress.domain);
          const targetLang = normalizeText(progress.target_lang).toLowerCase();
          updateJobProgress(job, phase, {
            current: progress.current,
            total: progress.total,
            key: domain && targetLang ? `${domain}|${targetLang}` : ""
          });
        }
      });
      helpers.appendLog(
        job,
        `Translated ${summary?.translated_count || 0} translation item${summary?.translated_count === 1 ? "" : "s"} in content/translations.`
      );
    }), progressMetadataForEntries(issueEntries, progressKeys)));
  } else if (applyOptions.domains.length) {
    phases.push(withProgress(callbackPhase("translate_content_store", "Translate missing and stale strings", async () => {
      throw apiError(500, "STATIC_TRANSLATION_PROVIDER_UNAVAILABLE", "Static translation apply service is not configured.");
    }), progressMetadataForEntries(issueEntries)));
  }

  if (!phases.length) {
    phases.push(callbackPhase("apply_noop", "No translation work needed", async (_phase, job, helpers) => {
      helpers.appendLog(job, "No missing or stale translations were found.");
    }));
  }

  return phases;
}

function autoPublishPhases({ publishTranslations, getStatusSummary } = {}) {
  if (typeof publishTranslations !== "function" || typeof getStatusSummary !== "function") return [];
  const autoPublished = (job) => job?.auto_published === true;
  return [
    callbackPhase("validate_translation_store", "Validate content/translations", async (_phase, job, helpers) => {
      const status = await getStatusSummary();
      const issueEntries = issueEntriesFromStatus(status);
      const unavailableCount = Array.isArray(status?.unavailable) ? status.unavailable.length : 0;
      if (issueEntries.length || unavailableCount) {
        job.auto_published = false;
        helpers.appendLog(
          job,
          unavailableCount
            ? `Skipped runtime generation because ${unavailableCount} translation section${unavailableCount === 1 ? "" : "s"} could not be checked.`
            : `Skipped runtime generation because ${issueEntries.length} translation target${issueEntries.length === 1 ? "" : "s"} still need work.`
        );
        return;
      }
      const manifest = await publishTranslations();
      job.auto_published = true;
      helpers.appendLog(
        job,
        `Validated ${manifest.total_items || 0} content/translations item${manifest.total_items === 1 ? "" : "s"}. source_set_hash=${manifest.source_set_hash || ""}`
      );
    }),
    whenPhase(runtimeI18nPhase(), autoPublished),
    whenPhase(homepageAssetsPhase(), autoPublished)
  ];
}

async function publishPhases({ applyTranslations, publishTranslations, getStatusSummary }) {
  return [
    ...fallbackApplyPhases({ applyTranslations, includeHomepageAssets: false }),
    callbackPhase("validate_translation_store", "Validate content/translations", async (_phase, job, helpers) => {
      const manifest = await publishTranslations();
      helpers.appendLog(
        job,
        `Validated ${manifest.total_items || 0} content/translations item${manifest.total_items === 1 ? "" : "s"}. source_set_hash=${manifest.source_set_hash || ""}`
      );
    }),
    runtimeI18nPhase(),
    homepageAssetsPhase()
  ];
}

function retranslatePhases({ mode, targetLang, clearTranslationCaches }) {
  const clearPhase = (id, label, options) => callbackPhase(id, label, async (_phase, job, helpers) => {
    if (typeof clearTranslationCaches !== "function") {
      throw apiError(500, "STATIC_TRANSLATION_CACHE_CLEAR_UNAVAILABLE", "Translation cache clearing is not configured.");
    }
    const summary = await clearTranslationCaches(options);
    helpers.appendLog(
      job,
      `Cleared ${summary?.cleared_count || 0} cached translation item${summary?.cleared_count === 1 ? "" : "s"}.`
    );
    helpers.appendLog(job, "Use Translate to rebuild missing machine translations in content/translations.");
  });

  if (mode === "frontend_current_language") {
    const normalizedLang = normalizeText(targetLang).toLowerCase();
    if (!FRONTEND_LANGUAGE_CODES.includes(normalizedLang) || normalizedLang === "en") {
      throw apiError(400, "STATIC_TRANSLATION_INVALID_RETRANSLATE_TARGET", "Select a non-English frontend language to retranslate.");
    }
    return [
      clearPhase("frontend_retranslate", `Clear frontend ${normalizedLang} machine translations`, {
        domains: ["frontend"],
        target_langs: [normalizedLang]
      })
    ];
  }

  if (mode === "frontend_all_languages") {
    return [
      clearPhase("frontend_retranslate_all", "Clear customer UI machine translations", {
        domains: ["frontend"]
      })
    ];
  }

  if (mode === "marketing_tour_cache") {
    return [
      callbackPhase("marketing_tour_cache_clear", "Clear marketing tour translation cache", async (_phase, job, helpers) => {
        if (typeof clearTranslationCaches !== "function") {
          throw apiError(500, "STATIC_TRANSLATION_CACHE_CLEAR_UNAVAILABLE", "Translation cache clearing is not configured.");
        }
        const summary = await clearTranslationCaches({
          domains: ["marketing-tour-memory"]
        });
        helpers.appendLog(
          job,
          `Cleared ${summary?.cleared_count || 0} cached marketing tour translation item${summary?.cleared_count === 1 ? "" : "s"}.`
        );
        helpers.appendLog(job, "Use Translate to rebuild missing machine translations in content/translations.");
      })
    ];
  }

  if (mode === "backend_vi") {
    return [
      clearPhase("backend_retranslate_vi", "Clear backend Vietnamese machine translations", {
        domains: ["backend"],
        target_langs: ["vi"]
      })
    ];
  }

  throw apiError(400, "STATIC_TRANSLATION_INVALID_RETRANSLATE_MODE", "Unsupported retranslation mode.");
}

function spawnRunner({ spawnCommand, repoRoot, env }) {
  return (phase, job) => new Promise((resolve, reject) => {
    const child = spawnCommand(phase.command, phase.args, {
      cwd: repoRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout?.on("data", (chunk) => appendLog(job, chunk.toString("utf8"), env, phase));
    child.stderr?.on("data", (chunk) => appendLog(job, chunk.toString("utf8"), env, phase));
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

export function createStaticTranslationApplyJobs({
  repoRoot,
  applyTranslations = null,
  clearTranslationCaches = null,
  publishTranslations = null,
  getStatusSummary = null,
  spawnCommand = spawn,
  runCommand = null,
  nowIso = () => new Date().toISOString(),
  env = process.env,
  idFactory = randomUUID
} = {}) {
  if (!repoRoot) {
    throw new Error("createStaticTranslationApplyJobs requires repoRoot.");
  }

  const jobs = new Map();
  let runningJobId = "";
  const executePhase = typeof runCommand === "function"
    ? runCommand
    : spawnRunner({ spawnCommand, repoRoot, env });

  function startJob({ type, phases }) {
    if (runningJobId) {
      throw apiError(409, "STATIC_TRANSLATION_JOB_RUNNING", "A translation apply job is already running.");
    }
    const prepared = prepareJobPhases(phases);
    const job = {
      id: idFactory(),
      type,
      status: "running",
      phase: prepared.phases[0]?.id || "",
      phases: prepared.phases,
      started_at: nowIso(),
      finished_at: "",
      error: "",
      progress: {
        current: 0,
        total: prepared.progressTotal
      },
      log: []
    };
    jobs.set(job.id, job);
    runningJobId = job.id;

    (async () => {
      try {
        for (const phase of job.phases) {
          job.phase = phase.id;
          if (typeof phase.when === "function" && !phase.when(job)) {
            phase.status = "skipped";
            appendLog(job, `Skipped: ${phase.label}`, env);
            continue;
          }
          phase.status = "running";
          appendLog(job, `Starting: ${phase.label}`, env);
          if (!phase.progress_count && !Object.keys(phase.progress_offsets || {}).length && job.progress?.total) {
            phase.progress_offset = job.progress.total;
          }
          updateJobProgress(job, phase, { current: 0, total: phase.progress_count });
          if (typeof phase.run === "function") {
            await phase.run(phase, job, {
              appendLog: (targetJob, line) => appendLog(targetJob, line, env, phase),
              updateProgress: (targetJob, progress) => updateJobProgress(targetJob, phase, progress)
            });
          } else {
            await executePhase(phase, job, {
              appendLog: (targetJob, line) => appendLog(targetJob, line, env, phase),
              updateProgress: (targetJob, progress) => updateJobProgress(targetJob, phase, progress)
            });
          }
          completePhaseProgress(job, phase);
          phase.status = "succeeded";
          appendLog(job, `Finished: ${phase.label}`, env);
        }
        job.status = "succeeded";
        job.phase = "";
      } catch (error) {
        const current = job.phases.find((phase) => phase.status === "running");
        if (current) current.status = "failed";
        job.status = "failed";
        job.error = String(error?.message || error);
        appendLog(job, job.error, env);
      } finally {
        job.finished_at = nowIso();
        if (runningJobId === job.id) runningJobId = "";
      }
    })();

    return snapshot(job);
  }

  return {
    async startApply() {
      return startJob({
        type: "apply",
        phases: [
          ...await applyPhases({ applyTranslations, getStatusSummary }),
          ...autoPublishPhases({ publishTranslations, getStatusSummary })
        ]
      });
    },
    async startPublish() {
      if (typeof publishTranslations !== "function") {
        throw apiError(500, "STATIC_TRANSLATION_PUBLISH_UNAVAILABLE", "Translation snapshot publishing is not configured.");
      }
      return startJob({ type: "publish", phases: await publishPhases({ applyTranslations, publishTranslations, getStatusSummary }) });
    },
    startRetranslate({ mode, target_lang: targetLang } = {}) {
      return startJob({ type: "retranslate", phases: retranslatePhases({ mode, targetLang, clearTranslationCaches }) });
    },
    getJob(jobId) {
      const job = jobs.get(normalizeText(jobId));
      if (!job) {
        throw apiError(404, "STATIC_TRANSLATION_JOB_NOT_FOUND", "Translation job not found.");
      }
      return snapshot(job);
    }
  };
}
