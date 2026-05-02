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

test("static translation apply job runs fallback apply phases in order", async () => {
  const seen = [];
  const service = createStaticTranslationApplyJobs({
    repoRoot: "/tmp/repo",
    nowIso: () => "2026-04-28T00:00:00.000Z",
    idFactory: () => "job-1",
    runCommand: async (phase) => {
      seen.push([phase.command, ...phase.args].join(" "));
    }
  });

  const started = await service.startApply();
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

test("static translation apply job translates central content before regenerating homepage assets", async () => {
  const seen = [];
  const service = createStaticTranslationApplyJobs({
    repoRoot: "/tmp/repo",
    nowIso: () => "2026-04-28T00:00:00.000Z",
    idFactory: () => "job-central",
    runCommand: async (phase) => {
      seen.push([phase.command, ...phase.args].join(" "));
    },
    applyTranslations: async () => {
      seen.push("central translations");
      return { translated_count: 7 };
    }
  });

  await service.startApply();
  const finished = await waitForJob(service, "job-central", "succeeded");

  assert.equal(finished.status, "succeeded");
  assert.equal(seen.length, 6);
  assert.match(seen[0], /sync_backend_i18n\.mjs translate --target vi$/);
  assert.match(seen[1], /sync_frontend_i18n\.mjs translate$/);
  assert.equal(seen[2], "central translations");
  assert.match(seen[3], /generate_public_homepage_assets\.mjs$/);
  assert.match(finished.log.join("\n"), /Translated 7 central translation items/);
});

test("static translation publish job applies translations before writing snapshot", async () => {
  const seen = [];
  const service = createStaticTranslationApplyJobs({
    repoRoot: "/tmp/repo",
    nowIso: () => "2026-04-28T00:00:00.000Z",
    idFactory: () => "job-publish",
    getStatusSummary: async () => ({
      languages: [
        {
          domain: "marketing-tour-memory",
          target_lang: "vi",
          missing_count: 1,
          stale_count: 0,
          legacy_count: 0
        }
      ]
    }),
    runCommand: async (phase) => {
      seen.push([phase.command, ...phase.args].join(" "));
    },
    publishTranslations: async () => {
      seen.push("publish snapshot");
      return { total_items: 3, source_set_hash: "abc123" };
    }
  });

  const started = await service.startPublish();
  assert.equal(started.type, "publish");
  const finished = await waitForJob(service, "job-publish", "succeeded");

  assert.equal(finished.status, "succeeded");
  assert.equal(seen.length, 6);
  assert.match(seen[0], /sync_backend_i18n\.mjs translate --target vi$/);
  assert.match(seen[4], /sync_frontend_i18n\.mjs check$/);
  assert.equal(seen[5], "publish snapshot");
  assert.match(finished.log.join("\n"), /Published 3 translation snapshot items/);
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

  await service.startApply();
  assert.throws(
    () => service.startRetranslate({ mode: "backend_vi" }),
    /already running/
  );
  release();
  const finished = await waitForJob(service, "job-running", "succeeded");
  assert.equal(finished.status, "succeeded");
});

test("static translation apply job only translates affected central memory domains", async () => {
  const seen = [];
  const applyOptions = [];
  const service = createStaticTranslationApplyJobs({
    repoRoot: "/tmp/repo",
    nowIso: () => "2026-04-28T00:00:00.000Z",
    idFactory: () => "job-fast-central",
    runCommand: async (phase) => {
      seen.push([phase.command, ...phase.args].join(" "));
    },
    getStatusSummary: async () => ({
      languages: [
        {
          domain: "marketing-tour-memory",
          target_lang: "vi",
          missing_count: 1,
          stale_count: 0,
          legacy_count: 0
        },
        {
          domain: "frontend",
          target_lang: "vi",
          missing_count: 0,
          stale_count: 0,
          legacy_count: 0
        }
      ]
    }),
    applyTranslations: async (options) => {
      applyOptions.push(options);
      seen.push("central translations");
      return { translated_count: 1 };
    }
  });

  const started = await service.startApply();
  assert.deepEqual(started.phases.map((phase) => phase.id), ["central_translate"]);
  const finished = await waitForJob(service, "job-fast-central", "succeeded");

  assert.equal(finished.status, "succeeded");
  assert.deepEqual(seen, ["central translations"]);
  assert.deepEqual(applyOptions, [
    {
      domains: ["marketing-tour-memory"],
      target_langs_by_domain: {
        "marketing-tour-memory": ["vi"]
      }
    }
  ]);
});

test("static translation apply job limits frontend scripts to affected languages", async () => {
  const seen = [];
  const service = createStaticTranslationApplyJobs({
    repoRoot: "/tmp/repo",
    nowIso: () => "2026-04-28T00:00:00.000Z",
    idFactory: () => "job-fast-frontend",
    runCommand: async (phase) => {
      seen.push([phase.command, ...phase.args].join(" "));
    },
    getStatusSummary: async () => ({
      languages: [
        {
          domain: "frontend",
          target_lang: "de",
          missing_count: 1,
          stale_count: 0,
          legacy_count: 0
        },
        {
          domain: "frontend",
          target_lang: "vi",
          missing_count: 0,
          stale_count: 1,
          legacy_count: 0
        },
        {
          domain: "backend",
          target_lang: "vi",
          missing_count: 0,
          stale_count: 0,
          legacy_count: 0
        }
      ]
    })
  });

  const started = await service.startApply();
  assert.deepEqual(started.phases.map((phase) => phase.id), ["frontend_translate", "homepage_assets", "frontend_check"]);
  const finished = await waitForJob(service, "job-fast-frontend", "succeeded");

  assert.equal(finished.status, "succeeded");
  assert.equal(seen.length, 3);
  assert.match(seen[0], /sync_frontend_i18n\.mjs translate --target de --target vi$/);
  assert.match(seen[1], /generate_public_homepage_assets\.mjs$/);
  assert.match(seen[2], /sync_frontend_i18n\.mjs check --target de --target vi$/);
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
