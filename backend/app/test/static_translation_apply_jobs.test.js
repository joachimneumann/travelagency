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

async function waitForProgress(service, id, current) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const job = service.getJob(id);
    if (Number(job.progress?.current || 0) >= current) return job;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return service.getJob(id);
}

function withoutProgressCallbacks(options) {
  return options.map(({ onProgress, ...rest }) => rest);
}

test("static translation apply job runs fallback apply without generating homepage assets", async () => {
  const seen = [];
  const service = createStaticTranslationApplyJobs({
    repoRoot: "/tmp/repo",
    nowIso: () => "2026-04-28T00:00:00.000Z",
    idFactory: () => "job-1",
    applyTranslations: async () => {
      seen.push("translate content store");
      return { translated_count: 5 };
    },
    runCommand: async (phase) => {
      seen.push([phase.command, ...phase.args].join(" "));
    }
  });

  const started = await service.startApply();
  assert.equal(started.status, "running");
  const finished = await waitForJob(service, "job-1", "succeeded");

  assert.equal(finished.status, "succeeded");
  assert.deepEqual(seen, ["translate content store"]);
});

test("static translation apply job translates central content without regenerating homepage assets", async () => {
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
  assert.deepEqual(seen, ["central translations"]);
  assert.match(finished.log.join("\n"), /Translated 7 translation items in content\/translations/);
});

test("static translation publish job writes snapshot before runtime and homepage generation", async () => {
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
    applyTranslations: async () => {
      throw new Error("publish should not translate missing strings");
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
  assert.equal(seen.length, 3);
  assert.equal(seen[0], "publish snapshot");
  assert.match(seen[1], /build_runtime_i18n\.mjs --strict$/);
  assert.match(seen[2], /generate_public_homepage_assets\.mjs$/);
  assert.match(finished.log.join("\n"), /Validated 3 content\/translations items/);
});

test("static translation apply job rejects concurrent jobs", async () => {
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const service = createStaticTranslationApplyJobs({
    repoRoot: "/tmp/repo",
    idFactory: () => "job-running",
    applyTranslations: async () => blocked
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
  assert.deepEqual(started.phases.map((phase) => phase.id), ["translate_content_store"]);
  const finished = await waitForJob(service, "job-fast-central", "succeeded");

  assert.equal(finished.status, "succeeded");
  assert.deepEqual(seen, ["central translations"]);
  assert.equal(typeof applyOptions[0]?.onProgress, "function");
  assert.deepEqual(withoutProgressCallbacks(applyOptions), [
    {
      domains: ["marketing-tour-memory"],
      target_langs_by_domain: {
        "marketing-tour-memory": ["vi"]
      }
    }
  ]);
});

test("static translation apply job leaves publish work for central publish after translation issues clear", async () => {
  const seen = [];
  const applyOptions = [];
  let statusCalls = 0;
  const service = createStaticTranslationApplyJobs({
    repoRoot: "/tmp/repo",
    nowIso: () => "2026-04-28T00:00:00.000Z",
    idFactory: () => "job-auto-publish",
    runCommand: async (phase) => {
      seen.push([phase.command, ...phase.args].join(" "));
    },
    getStatusSummary: async () => {
      statusCalls += 1;
      return statusCalls === 1
        ? {
            languages: [
              {
                domain: "marketing-tour-memory",
                target_lang: "vi",
                missing_count: 1,
                stale_count: 0,
                legacy_count: 0
              }
            ]
          }
        : {
            languages: [
              {
                domain: "marketing-tour-memory",
                target_lang: "vi",
                missing_count: 0,
                stale_count: 0,
                legacy_count: 0,
                unpublished_count: 2
              }
            ]
          };
    },
    applyTranslations: async (options) => {
      applyOptions.push(options);
      seen.push("central translations");
      return { translated_count: 2 };
    },
    publishTranslations: async () => {
      throw new Error("translate should not publish snapshots");
    }
  });

  const started = await service.startApply();
  assert.deepEqual(started.phases.map((phase) => phase.id), ["translate_content_store"]);
  const finished = await waitForJob(service, "job-auto-publish", "succeeded");

  assert.equal(finished.status, "succeeded");
  assert.equal(typeof applyOptions[0]?.onProgress, "function");
  assert.deepEqual(withoutProgressCallbacks(applyOptions), [
    {
      domains: ["marketing-tour-memory"],
      target_langs_by_domain: {
        "marketing-tour-memory": ["vi"]
      }
    }
  ]);
  assert.deepEqual(seen, ["central translations"]);
  assert.equal(statusCalls, 1);
  assert.doesNotMatch(finished.log.join("\n"), /Validated 2 content\/translations items|runtime i18n|homepage assets/i);
});

test("static translation apply job includes protected-term repair work in the normal translate action", async () => {
  const applyOptions = [];
  const service = createStaticTranslationApplyJobs({
    repoRoot: "/tmp/repo",
    nowIso: () => "2026-04-28T00:00:00.000Z",
    idFactory: () => "job-protected-normal-apply",
    getStatusSummary: async () => ({
      languages: [
        {
          domain: "frontend",
          target_lang: "de",
          missing_count: 0,
          stale_count: 0,
          legacy_count: 0,
          protected_term_count: 2,
          translation_work_count: 2
        }
      ]
    }),
    applyTranslations: async (options) => {
      applyOptions.push(options);
      return { translated_count: 2 };
    }
  });

  await service.startApply();
  const finished = await waitForJob(service, "job-protected-normal-apply", "succeeded");

  assert.equal(finished.status, "succeeded");
  assert.deepEqual(withoutProgressCallbacks(applyOptions), [
    {
      domains: ["frontend"],
      target_langs_by_domain: {
        frontend: ["de"]
      }
    }
  ]);
  assert.match(finished.log.join("\n"), /Translated 2 translation items in content\/translations/);
});

test("static translation apply job limits content store translation to affected languages", async () => {
  const seen = [];
  const applyOptions = [];
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
    }),
    applyTranslations: async (options) => {
      applyOptions.push(options);
      seen.push("translate content store");
      return { translated_count: 2 };
    }
  });

  const started = await service.startApply();
  assert.deepEqual(started.phases.map((phase) => phase.id), ["translate_content_store"]);
  const finished = await waitForJob(service, "job-fast-frontend", "succeeded");

  assert.equal(finished.status, "succeeded");
  assert.deepEqual(seen, ["translate content store"]);
  assert.equal(typeof applyOptions[0]?.onProgress, "function");
  assert.deepEqual(withoutProgressCallbacks(applyOptions), [
    {
      domains: ["frontend"],
      target_langs_by_domain: {
        frontend: ["de", "vi"]
      }
    }
  ]);
});

test("static translation apply job exposes content-store translation progress", async () => {
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const service = createStaticTranslationApplyJobs({
    repoRoot: "/tmp/repo",
    nowIso: () => "2026-04-28T00:00:00.000Z",
    idFactory: () => "job-command-progress",
    getStatusSummary: async () => ({
      languages: [
        {
          domain: "backend",
          target_lang: "vi",
          missing_count: 15075,
          stale_count: 0,
          legacy_count: 0
        }
      ]
    }),
    applyTranslations: async (options) => {
      options.onProgress({
        domain: "backend",
        target_lang: "vi",
        current: 100,
        total: 15075
      });
      await blocked;
      return { translated_count: 15075 };
    }
  });

  const started = await service.startApply();
  assert.equal(started.progress.total, 15075);
  const running = await waitForProgress(service, "job-command-progress", 100);
  assert.deepEqual(running.progress, { current: 100, total: 15075 });

  release();
  const finished = await waitForJob(service, "job-command-progress", "succeeded");
  assert.deepEqual(finished.progress, { current: 15075, total: 15075 });
});

test("static translation apply job exposes central translation progress", async () => {
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const service = createStaticTranslationApplyJobs({
    repoRoot: "/tmp/repo",
    nowIso: () => "2026-04-28T00:00:00.000Z",
    idFactory: () => "job-central-progress",
    getStatusSummary: async () => ({
      languages: [
        {
          domain: "marketing-tour-memory",
          target_lang: "vi",
          missing_count: 5,
          stale_count: 0,
          legacy_count: 0
        }
      ]
    }),
    applyTranslations: async (options) => {
      options.onProgress({
        domain: "marketing-tour-memory",
        target_lang: "vi",
        current: 2,
        total: 5
      });
      await blocked;
      return { translated_count: 5 };
    }
  });

  const started = await service.startApply();
  assert.equal(started.progress.total, 5);
  const running = await waitForProgress(service, "job-central-progress", 2);
  assert.deepEqual(running.progress, { current: 2, total: 5 });

  release();
  const finished = await waitForJob(service, "job-central-progress", "succeeded");
  assert.deepEqual(finished.progress, { current: 5, total: 5 });
});

test("static translation advanced job clears marketing tour memory cache without translating", async () => {
  const seen = [];
  const clearOptions = [];
  const service = createStaticTranslationApplyJobs({
    repoRoot: "/tmp/repo",
    nowIso: () => "2026-04-28T00:00:00.000Z",
    idFactory: () => "job-marketing-tour-cache-clear",
    runCommand: async (phase) => {
      seen.push([phase.command, ...phase.args].join(" "));
    },
    applyTranslations: async () => {
      throw new Error("advanced cache clear should not call the translation provider");
    },
    clearTranslationCaches: async (options) => {
      clearOptions.push(options);
      seen.push("central cache clear");
      return { cleared_count: 4 };
    }
  });

  const started = service.startRetranslate({ mode: "marketing_tour_cache" });
  assert.deepEqual(started.phases.map((phase) => phase.id), ["marketing_tour_cache_clear"]);
  const finished = await waitForJob(service, "job-marketing-tour-cache-clear", "succeeded");

  assert.equal(finished.status, "succeeded");
  assert.deepEqual(seen, ["central cache clear"]);
  assert.deepEqual(clearOptions, [
    {
      domains: ["marketing-tour-memory"]
    }
  ]);
  assert.match(finished.log.join("\n"), /Cleared 4 cached marketing tour translation items/);
  assert.match(finished.log.join("\n"), /Use Translate to rebuild missing machine translations/);
});

test("static translation protected terms job points changed translations to Publish Website", async () => {
  const seen = [];
  const service = createStaticTranslationApplyJobs({
    repoRoot: "/tmp/repo",
    nowIso: () => "2026-04-28T00:00:00.000Z",
    idFactory: () => "job-protected-terms",
    protectTranslations: async () => {
      seen.push("protected terms");
      return { translated_count: 12 };
    }
  });

  const started = service.startRetranslate({ mode: "protected_terms" });
  assert.deepEqual(started.phases.map((phase) => phase.id), ["protected_terms_update"]);
  const finished = await waitForJob(service, "job-protected-terms", "succeeded");

  assert.equal(finished.status, "succeeded");
  assert.deepEqual(seen, ["protected terms"]);
  assert.match(finished.log.join("\n"), /Updated 12 protected-term translation items/);
  assert.match(finished.log.join("\n"), /Use Publish Website to update runtime translations/);
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
