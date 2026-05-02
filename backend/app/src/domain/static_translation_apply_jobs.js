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

function appendLog(job, line, env) {
  const safeLine = redactLine(line, env);
  if (!safeLine) return;
  for (const entry of safeLine.split(/\r?\n/).filter(Boolean)) {
    job.log.push(entry);
    if (job.log.length > MAX_LOG_LINES) job.log.shift();
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
  return commandPhase("runtime_i18n", "Generate runtime i18n from published snapshots", process.execPath, ["scripts/i18n/build_runtime_i18n.mjs", "--strict"]);
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
  const phases = [
    commandPhase("backend_translate", "Apply backend UI translation overrides", process.execPath, ["scripts/i18n/sync_backend_i18n.mjs", "translate", "--target", "vi"]),
    commandPhase("frontend_translate", "Apply customer-facing translation overrides", process.execPath, ["scripts/i18n/sync_frontend_i18n.mjs", "translate"])
  ];
  if (typeof applyTranslations === "function") {
    phases.push(callbackPhase("central_translate", "Translate central content and memory", async (_phase, job, helpers) => {
      const summary = await applyTranslations();
      helpers.appendLog(
        job,
        `Translated ${summary?.translated_count || 0} central translation item${summary?.translated_count === 1 ? "" : "s"}.`
      );
    }));
  }
  if (includeHomepageAssets) {
    phases.push(homepageAssetsPhase());
  }
  phases.push(
    commandPhase("backend_check", "Check backend UI translations", process.execPath, ["scripts/i18n/sync_backend_i18n.mjs", "check", "--target", "vi"]),
    commandPhase("frontend_check", "Check customer-facing translations", process.execPath, ["scripts/i18n/sync_frontend_i18n.mjs", "check"])
  );
  return phases;
}

async function applyPhases({ applyTranslations, getStatusSummary } = {}) {
  if (typeof getStatusSummary !== "function") {
    return fallbackApplyPhases({ applyTranslations });
  }

  const status = await getStatusSummary();
  const issueEntries = issueEntriesFromStatus(status);
  const backendTargets = issueEntries
    .filter((entry) => normalizeText(entry.domain) === "backend")
    .map((entry) => entry.target_lang);
  const frontendTargets = issueEntries
    .filter((entry) => normalizeText(entry.domain) === "frontend")
    .map((entry) => entry.target_lang);
  const centralEntries = issueEntries
    .filter((entry) => !["backend", "frontend"].includes(normalizeText(entry.domain)));
  const centralOptions = centralApplyOptions(centralEntries);
  const phases = [];

  for (const targetLang of uniqueNormalized(backendTargets)) {
    phases.push(commandPhase(
      `backend_translate_${targetLang}`,
      `Apply backend UI translations for ${targetLang}`,
      process.execPath,
      ["scripts/i18n/sync_backend_i18n.mjs", "translate", "--target", targetLang]
    ));
  }

  const frontendTargetLangs = uniqueNormalized(frontendTargets);
  if (frontendTargetLangs.length) {
    phases.push(commandPhase(
      "frontend_translate",
      `Apply customer-facing UI translations for ${frontendTargetLangs.join(", ")}`,
      process.execPath,
      ["scripts/i18n/sync_frontend_i18n.mjs", "translate", ...targetArgs(frontendTargetLangs)]
    ));
  }

  if (centralOptions.domains.length && typeof applyTranslations === "function") {
    phases.push(callbackPhase("central_translate", "Translate central content and memory", async (_phase, job, helpers) => {
      const summary = await applyTranslations(centralOptions);
      helpers.appendLog(
        job,
        `Translated ${summary?.translated_count || 0} central translation item${summary?.translated_count === 1 ? "" : "s"}.`
      );
    }));
  } else if (centralOptions.domains.length) {
    phases.push(callbackPhase("central_translate", "Translate central content and memory", async () => {
      throw apiError(500, "STATIC_TRANSLATION_PROVIDER_UNAVAILABLE", "Central translation apply service is not configured.");
    }));
  }

  if (frontendTargetLangs.length) {
    phases.push(homepageAssetsPhase());
  }

  for (const targetLang of uniqueNormalized(backendTargets)) {
    phases.push(commandPhase(
      `backend_check_${targetLang}`,
      `Check backend UI translations for ${targetLang}`,
      process.execPath,
      ["scripts/i18n/sync_backend_i18n.mjs", "check", "--target", targetLang]
    ));
  }

  if (frontendTargetLangs.length) {
    phases.push(commandPhase(
      "frontend_check",
      `Check customer-facing UI translations for ${frontendTargetLangs.join(", ")}`,
      process.execPath,
      ["scripts/i18n/sync_frontend_i18n.mjs", "check", ...targetArgs(frontendTargetLangs)]
    ));
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
    callbackPhase("publish_snapshot", "Publish translation snapshot", async (_phase, job, helpers) => {
      const status = await getStatusSummary();
      const issueEntries = issueEntriesFromStatus(status);
      const unavailableCount = Array.isArray(status?.unavailable) ? status.unavailable.length : 0;
      if (issueEntries.length || unavailableCount) {
        job.auto_published = false;
        helpers.appendLog(
          job,
          unavailableCount
            ? `Skipped publishing because ${unavailableCount} translation section${unavailableCount === 1 ? "" : "s"} could not be checked.`
            : `Skipped publishing because ${issueEntries.length} translation target${issueEntries.length === 1 ? "" : "s"} still need work.`
        );
        return;
      }
      const manifest = await publishTranslations();
      job.auto_published = true;
      helpers.appendLog(
        job,
        `Published ${manifest.total_items || 0} translation snapshot items. source_set_hash=${manifest.source_set_hash || ""}`
      );
    }),
    whenPhase(runtimeI18nPhase(), autoPublished),
    whenPhase(homepageAssetsPhase(), autoPublished)
  ];
}

async function publishPhases({ applyTranslations, publishTranslations, getStatusSummary }) {
  return [
    ...fallbackApplyPhases({ applyTranslations, includeHomepageAssets: false }),
    callbackPhase("publish_snapshot", "Publish translation snapshot", async (_phase, job, helpers) => {
      const manifest = await publishTranslations();
      helpers.appendLog(
        job,
        `Published ${manifest.total_items || 0} translation snapshot items. source_set_hash=${manifest.source_set_hash || ""}`
      );
    }),
    runtimeI18nPhase(),
    homepageAssetsPhase()
  ];
}

function retranslatePhases({ mode, targetLang, clearTranslationCaches }) {
  if (mode === "frontend_current_language") {
    const normalizedLang = normalizeText(targetLang).toLowerCase();
    if (!FRONTEND_LANGUAGE_CODES.includes(normalizedLang) || normalizedLang === "en") {
      throw apiError(400, "STATIC_TRANSLATION_INVALID_RETRANSLATE_TARGET", "Select a non-English frontend language to retranslate.");
    }
    return [
      commandPhase("frontend_retranslate", `Retranslate frontend ${normalizedLang}`, process.execPath, ["scripts/i18n/sync_frontend_i18n.mjs", "translate", "--target", normalizedLang, "--force-all"]),
      homepageAssetsPhase(),
      commandPhase("frontend_check", `Check frontend ${normalizedLang}`, process.execPath, ["scripts/i18n/sync_frontend_i18n.mjs", "check", "--target", normalizedLang])
    ];
  }

  if (mode === "frontend_all_languages") {
    return [
      commandPhase("frontend_retranslate_all", "Retranslate customer UI strings", process.execPath, ["scripts/i18n/sync_frontend_i18n.mjs", "translate", "--force-all"]),
      homepageAssetsPhase(),
      commandPhase("frontend_check", "Check customer-facing translations", process.execPath, ["scripts/i18n/sync_frontend_i18n.mjs", "check"])
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
        helpers.appendLog(job, "Use Translate to rebuild missing machine translations and publish clean snapshots.");
      })
    ];
  }

  if (mode === "backend_vi") {
    return [
      commandPhase("backend_retranslate_vi", "Retranslate backend Vietnamese", process.execPath, ["scripts/i18n/sync_backend_i18n.mjs", "translate", "--target", "vi", "--force-all"]),
      commandPhase("backend_check", "Check backend UI translations", process.execPath, ["scripts/i18n/sync_backend_i18n.mjs", "check", "--target", "vi"])
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
    child.stdout?.on("data", (chunk) => appendLog(job, chunk.toString("utf8"), env));
    child.stderr?.on("data", (chunk) => appendLog(job, chunk.toString("utf8"), env));
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
    const job = {
      id: idFactory(),
      type,
      status: "running",
      phase: phases[0]?.id || "",
      phases: phases.map((phase) => ({ ...phase })),
      started_at: nowIso(),
      finished_at: "",
      error: "",
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
          if (typeof phase.run === "function") {
            await phase.run(phase, job, {
              appendLog: (targetJob, line) => appendLog(targetJob, line, env)
            });
          } else {
            await executePhase(phase, job);
          }
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
