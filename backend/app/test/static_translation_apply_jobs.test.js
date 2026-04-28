import test from "node:test";
import assert from "node:assert/strict";
import { createStaticTranslationApplyJobs } from "../src/domain/static_translation_apply_jobs.js";

async function waitForJob(service, id, status) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const job = service.getJob(id);
    if (job.status === status) return job;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return service.getJob(id);
}

test("static translation apply job runs fixed apply phases in order", async () => {
  const seen = [];
  const service = createStaticTranslationApplyJobs({
    repoRoot: "/tmp/repo",
    nowIso: () => "2026-04-28T00:00:00.000Z",
    idFactory: () => "job-1",
    runCommand: async (phase) => {
      seen.push([phase.command, ...phase.args].join(" "));
    }
  });

  const started = service.startApply();
  assert.equal(started.status, "running");
  const finished = await waitForJob(service, "job-1", "succeeded");

  assert.equal(finished.status, "succeeded");
  assert.equal(seen.length, 5);
  assert.match(seen[0], /sync_backend_i18n\.mjs translate --target vi$/);
  assert.match(seen[1], /sync_frontend_i18n\.mjs translate$/);
  assert.match(seen[2], /generate_public_homepage_assets\.mjs$/);
  assert.match(seen[3], /sync_backend_i18n\.mjs check --target vi$/);
  assert.match(seen[4], /sync_frontend_i18n\.mjs check$/);
});

test("static translation apply job rejects concurrent jobs", async () => {
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const service = createStaticTranslationApplyJobs({
    repoRoot: "/tmp/repo",
    idFactory: () => "job-running",
    runCommand: async () => blocked
  });

  service.startApply();
  assert.throws(
    () => service.startRetranslate({ mode: "backend_vi" }),
    /already running/
  );
  release();
  const finished = await waitForJob(service, "job-running", "succeeded");
  assert.equal(finished.status, "succeeded");
});

test("static translation retranslate job validates frontend current language", () => {
  const service = createStaticTranslationApplyJobs({
    repoRoot: "/tmp/repo",
    runCommand: async () => {}
  });

  assert.throws(
    () => service.startRetranslate({ mode: "frontend_current_language", target_lang: "en" }),
    /non-English frontend language/
  );
});
