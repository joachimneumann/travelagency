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

function applyPhases() {
  return [
    commandPhase("backend_translate", "Apply backend UI translation overrides", process.execPath, ["scripts/i18n/sync_backend_i18n.mjs", "translate", "--target", "vi"]),
    commandPhase("frontend_translate", "Apply customer-facing translation overrides", process.execPath, ["scripts/i18n/sync_frontend_i18n.mjs", "translate"]),
    commandPhase("homepage_assets", "Regenerate public homepage assets", process.execPath, ["scripts/assets/generate_public_homepage_assets.mjs"]),
    commandPhase("backend_check", "Check backend UI translations", process.execPath, ["scripts/i18n/sync_backend_i18n.mjs", "check", "--target", "vi"]),
    commandPhase("frontend_check", "Check customer-facing translations", process.execPath, ["scripts/i18n/sync_frontend_i18n.mjs", "check"])
  ];
}

function retranslatePhases({ mode, targetLang }) {
  if (mode === "frontend_current_language") {
    const normalizedLang = normalizeText(targetLang).toLowerCase();
    if (!FRONTEND_LANGUAGE_CODES.includes(normalizedLang) || normalizedLang === "en") {
      throw apiError(400, "STATIC_TRANSLATION_INVALID_RETRANSLATE_TARGET", "Select a non-English frontend language to retranslate.");
    }
    return [
      commandPhase("frontend_retranslate", `Retranslate frontend ${normalizedLang}`, process.execPath, ["scripts/i18n/sync_frontend_i18n.mjs", "translate", "--target", normalizedLang, "--force-all"]),
      commandPhase("homepage_assets", "Regenerate public homepage assets", process.execPath, ["scripts/assets/generate_public_homepage_assets.mjs"]),
      commandPhase("frontend_check", `Check frontend ${normalizedLang}`, process.execPath, ["scripts/i18n/sync_frontend_i18n.mjs", "check", "--target", normalizedLang])
    ];
  }

  if (mode === "frontend_all_languages") {
    return [
      commandPhase("frontend_retranslate_all", "Retranslate all customer-facing languages", process.execPath, ["scripts/i18n/sync_frontend_i18n.mjs", "translate", "--force-all"]),
      commandPhase("homepage_assets", "Regenerate public homepage assets", process.execPath, ["scripts/assets/generate_public_homepage_assets.mjs"]),
      commandPhase("frontend_check", "Check customer-facing translations", process.execPath, ["scripts/i18n/sync_frontend_i18n.mjs", "check"])
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
          phase.status = "running";
          appendLog(job, `Starting: ${phase.label}`, env);
          await executePhase(phase, job);
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
    startApply() {
      return startJob({ type: "apply", phases: applyPhases() });
    },
    startRetranslate({ mode, target_lang: targetLang } = {}) {
      return startJob({ type: "retranslate", phases: retranslatePhases({ mode, targetLang }) });
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
