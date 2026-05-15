import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import {
  PUBLIC_SITE_TRANSLATION_DOMAINS,
  createPublicSitePublishService
} from "../src/domain/public_site_publish.js";

async function waitForJob(service, id, status) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const job = service.getJob(id);
    if (job.status === status) return job;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return service.getJob(id);
}

async function createTempRepo(prefix = "public-site-publish-") {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
  const translationsSnapshotDir = path.join(repoRoot, "content", "translations");
  await mkdir(translationsSnapshotDir, { recursive: true });
  await writeFile(path.join(translationsSnapshotDir, "manifest.json"), JSON.stringify({
    schema: "translation-snapshot/v1",
    sections: []
  }, null, 2), "utf8");
  return {
    repoRoot,
    translationsSnapshotDir,
    manifestPath: path.join(repoRoot, "content", "public-site-publish-manifest.json")
  };
}

function cleanTranslationStatus() {
  return {
    dirty: false,
    dirty_count: 0,
    missing_count: 0,
    stale_count: 0,
    legacy_count: 0,
    untranslated_count: 0,
    unpublished_count: 0,
    unavailable: [],
    runtime_i18n: {
      blocked: false
    },
    languages: []
  };
}

function sampleTour() {
  return {
    id: "tour_alpha",
    title: { en: "Alpha tour" },
    title_i18n: {
      vi: "Tour Alpha VI"
    },
    published_on_webpage: true,
    updated_at: "2026-05-10T00:00:00.000Z",
    travel_plan: {
      translation_meta: {
        vi: {
          manual_keys: ["website.title"]
        }
      },
      days: []
    }
  };
}

test("public-site publish includes backend translations needed by runtime i18n", () => {
  assert.ok(
    PUBLIC_SITE_TRANSLATION_DOMAINS.includes("backend"),
    "Publish Website must publish backend UI translations before strict runtime i18n generation."
  );
});

test("public-site publish runs translations and homepage generation before writing a clean manifest", async () => {
  const { repoRoot, translationsSnapshotDir, manifestPath } = await createTempRepo();
  const tours = [sampleTour()];
  const seen = [];
  const publishOptions = [];
  const statusOptions = [];
  const memoryUpdates = [];
  const service = createPublicSitePublishService({
    repoRoot,
    translationsSnapshotDir,
    manifestPath,
    readTours: async () => tours,
    nowIso: () => "2026-05-10T10:00:00.000Z",
    idFactory: () => "public-job-1",
    translationMemoryStore: {
      patchManualOverrides: async (lang, updates) => {
        memoryUpdates.push({ lang, updates });
      }
    },
    staticTranslationService: {
      getStatusSummary: async (options) => {
        statusOptions.push(options);
        return cleanTranslationStatus();
      },
      publishTranslations: async (options) => {
        publishOptions.push(options);
        seen.push("publish translations");
        return { total_items: 0, source_set_hash: "empty" };
      }
    },
    runCommand: async (phase) => {
      seen.push(phase.id);
    }
  });

  const before = await service.getStatus();
  assert.equal(before.dirty, true);
  assert.equal(before.blocked, false);

  const started = service.startPublish();
  assert.equal(started.status, "running");
  const finished = await waitForJob(service, "public-job-1", "succeeded");

  assert.equal(finished.status, "succeeded");
  assert.deepEqual(seen, ["publish translations", "runtime_i18n", "homepage_assets"]);
  assert.deepEqual(publishOptions, [{ domains: PUBLIC_SITE_TRANSLATION_DOMAINS }]);
  assert.equal(statusOptions.every((options) => JSON.stringify(options) === JSON.stringify({ domains: PUBLIC_SITE_TRANSLATION_DOMAINS })), true);
  assert.deepEqual(memoryUpdates, [{
    lang: "vi",
    updates: [{
      source_text: "Alpha tour",
      manual_override: "Tour Alpha VI"
    }]
  }]);

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.schema, "public-site-publish/v1");
  assert.equal(manifest.job_id, "public-job-1");
  assert.equal(manifest.published_at, "2026-05-10T10:00:00.000Z");
  assert.equal(typeof manifest.source_hash, "string");

  const after = await service.getStatus();
  assert.equal(after.dirty, false);
  assert.equal(after.source_dirty, false);
  assert.equal(after.last_published_at, "2026-05-10T10:00:00.000Z");
});

test("public-site publish refreshes stale runtime snapshots when translated items are unpublished", async () => {
  const { repoRoot, translationsSnapshotDir, manifestPath } = await createTempRepo();
  const seen = [];
  const service = createPublicSitePublishService({
    repoRoot,
    translationsSnapshotDir,
    manifestPath,
    readTours: async () => [],
    nowIso: () => "2026-05-10T10:00:00.000Z",
    idFactory: () => "public-job-runtime-refresh",
    translationMemoryStore: {
      patchManualOverrides: async () => {}
    },
    staticTranslationService: {
      getStatusSummary: async () => ({
        ...cleanTranslationStatus(),
        dirty: true,
        unpublished_count: 20,
        runtime_i18n: {
          blocked: true,
          error: "Runtime i18n snapshot validation failed: missing source keys"
        }
      }),
      publishTranslations: async () => {
        seen.push("publish translations");
        return { total_items: 20, source_set_hash: "updated" };
      }
    },
    runCommand: async (phase) => {
      seen.push(phase.id);
    }
  });

  const status = await service.getStatus();
  assert.equal(status.dirty, true);
  assert.equal(status.blocked, false);

  service.startPublish();
  const finished = await waitForJob(service, "public-job-runtime-refresh", "succeeded");

  assert.equal(finished.status, "succeeded");
  assert.deepEqual(seen, ["publish translations", "runtime_i18n", "homepage_assets"]);
});

test("public-site publish treats translated but unpublished content as ready to publish", async () => {
  const { repoRoot, translationsSnapshotDir, manifestPath } = await createTempRepo();
  const seen = [];
  const service = createPublicSitePublishService({
    repoRoot,
    translationsSnapshotDir,
    manifestPath,
    readTours: async () => [],
    nowIso: () => "2026-05-10T10:00:00.000Z",
    idFactory: () => "public-job-translated-content",
    translationMemoryStore: {
      patchManualOverrides: async () => {}
    },
    staticTranslationService: {
      getStatusSummary: async () => ({
        ...cleanTranslationStatus(),
        dirty: true,
        translation_work_count: 0,
        missing_count: 0,
        stale_count: 0,
        legacy_count: 0,
        unpublished_count: 45,
        untranslated_count: 45,
        runtime_i18n: {
          blocked: true,
          error: "Runtime i18n snapshot validation failed: missing source keys"
        }
      }),
      publishTranslations: async () => {
        seen.push("publish translations");
        return { total_items: 45, source_set_hash: "updated" };
      }
    },
    runCommand: async (phase) => {
      seen.push(phase.id);
    }
  });

  const status = await service.getStatus();
  assert.equal(status.dirty, true);
  assert.equal(status.blocked, false);
  assert.equal(status.translations.translation_work_count, 0);
  assert.equal(status.translations.unpublished_count, 45);

  service.startPublish();
  const finished = await waitForJob(service, "public-job-translated-content", "succeeded");

  assert.equal(finished.status, "succeeded");
  assert.deepEqual(seen, ["publish translations", "runtime_i18n", "homepage_assets"]);
});

test("public-site publish still blocks runtime failures when no unpublished translations can refresh them", async () => {
  const { repoRoot, translationsSnapshotDir, manifestPath } = await createTempRepo();
  const seen = [];
  const service = createPublicSitePublishService({
    repoRoot,
    translationsSnapshotDir,
    manifestPath,
    readTours: async () => [],
    idFactory: () => "public-job-runtime-blocked",
    translationMemoryStore: {
      patchManualOverrides: async () => {}
    },
    staticTranslationService: {
      getStatusSummary: async () => ({
        ...cleanTranslationStatus(),
        runtime_i18n: {
          blocked: true,
          error: "Runtime i18n generator failed"
        }
      }),
      publishTranslations: async () => {
        seen.push("publish translations");
      }
    },
    runCommand: async (phase) => {
      seen.push(phase.id);
    }
  });

  const status = await service.getStatus();
  assert.equal(status.blocked, true);
  assert.equal(status.block_reasons[0].code, "runtime_i18n_blocked");

  service.startPublish();
  const finished = await waitForJob(service, "public-job-runtime-blocked", "failed");

  assert.equal(finished.status, "failed");
  assert.equal(finished.error_code, "PUBLIC_SITE_PUBLISH_BLOCKED");
  assert.deepEqual(seen, []);
});

test("public-site publish marks the job failed when translations need work", async () => {
  const { repoRoot, translationsSnapshotDir, manifestPath } = await createTempRepo();
  const seen = [];
  const service = createPublicSitePublishService({
    repoRoot,
    translationsSnapshotDir,
    manifestPath,
    readTours: async () => [sampleTour()],
    idFactory: () => "public-job-blocked",
    translationMemoryStore: {
      patchManualOverrides: async () => {}
    },
    staticTranslationService: {
      getStatusSummary: async () => ({
        ...cleanTranslationStatus(),
        dirty: true,
        dirty_count: 1,
        missing_count: 1,
        languages: [{
          domain: "marketing-tour-memory",
          target_lang: "vi",
          missing_count: 1
        }]
      }),
      publishTranslations: async () => {
        seen.push("publish translations");
      }
    },
    runCommand: async (phase) => {
      seen.push(phase.id);
    }
  });

  const status = await service.getStatus();
  assert.equal(status.blocked, true);
  assert.equal(status.block_reasons[0].code, "translations_need_work");

  service.startPublish();
  const finished = await waitForJob(service, "public-job-blocked", "failed");

  assert.equal(finished.status, "failed");
  assert.equal(finished.error_code, "PUBLIC_SITE_PUBLISH_BLOCKED");
  assert.match(finished.error, /need translation or update/);
  assert.deepEqual(seen, []);
});

test("public-site publish rejects concurrent jobs", async () => {
  const { repoRoot, translationsSnapshotDir, manifestPath } = await createTempRepo();
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const service = createPublicSitePublishService({
    repoRoot,
    translationsSnapshotDir,
    manifestPath,
    readTours: async () => [sampleTour()],
    idFactory: () => "public-job-running",
    translationMemoryStore: {
      patchManualOverrides: async () => {}
    },
    staticTranslationService: {
      getStatusSummary: async () => cleanTranslationStatus(),
      publishTranslations: async () => ({ total_items: 0 })
    },
    runCommand: async () => blocked
  });

  service.startPublish();
  assert.throws(
    () => service.startPublish(),
    /already running/
  );
  release();
  const finished = await waitForJob(service, "public-job-running", "succeeded");
  assert.equal(finished.status, "succeeded");
});

test("public-site status becomes dirty when marketing tours change after publish", async () => {
  const { repoRoot, translationsSnapshotDir, manifestPath } = await createTempRepo();
  const tours = [sampleTour()];
  const service = createPublicSitePublishService({
    repoRoot,
    translationsSnapshotDir,
    manifestPath,
    readTours: async () => tours,
    nowIso: () => "2026-05-10T10:00:00.000Z",
    idFactory: () => "public-job-hash",
    translationMemoryStore: {
      patchManualOverrides: async () => {}
    },
    staticTranslationService: {
      getStatusSummary: async () => cleanTranslationStatus(),
      publishTranslations: async () => ({ total_items: 0 })
    },
    runCommand: async () => {}
  });

  service.startPublish();
  await waitForJob(service, "public-job-hash", "succeeded");
  assert.equal((await service.getStatus()).dirty, false);

  tours[0] = {
    ...tours[0],
    title: "Changed Alpha tour",
    updated_at: "2026-05-10T11:00:00.000Z"
  };
  const status = await service.getStatus();
  assert.equal(status.dirty, true);
  assert.equal(status.source_dirty, true);
});

test("public-site status becomes dirty when content files change after publish", async () => {
  const { repoRoot, translationsSnapshotDir, manifestPath } = await createTempRepo();
  const contentDataPath = path.join(repoRoot, "content", "country_reference_info.json");
  const service = createPublicSitePublishService({
    repoRoot,
    translationsSnapshotDir,
    manifestPath,
    readTours: async () => [],
    nowIso: () => "2026-05-10T10:00:00.000Z",
    idFactory: () => "public-job-content-hash",
    translationMemoryStore: {
      patchManualOverrides: async () => {}
    },
    staticTranslationService: {
      getStatusSummary: async () => cleanTranslationStatus(),
      publishTranslations: async () => ({ total_items: 0 })
    },
    runCommand: async () => {}
  });

  service.startPublish();
  await waitForJob(service, "public-job-content-hash", "succeeded");
  assert.equal((await service.getStatus()).dirty, false);

  await writeFile(contentDataPath, `${JSON.stringify({ countries: [{ code: "VN" }] }, null, 2)}\n`, "utf8");
  const status = await service.getStatus();
  assert.equal(status.dirty, true);
  assert.equal(status.source_dirty, true);
  assert.equal(status.sources.content.file_count, 2);
});

test("public-site status becomes dirty when marketing-tour seasonality changes after publish", async () => {
  const { repoRoot, translationsSnapshotDir, manifestPath } = await createTempRepo();
  const tours = [{
    ...sampleTour(),
    seasonality_start_month: "jan",
    seasonality_end_month: "apr"
  }];
  const service = createPublicSitePublishService({
    repoRoot,
    translationsSnapshotDir,
    manifestPath,
    readTours: async () => tours,
    nowIso: () => "2026-05-10T10:00:00.000Z",
    idFactory: () => "public-job-seasonality",
    translationMemoryStore: {
      patchManualOverrides: async () => {}
    },
    staticTranslationService: {
      getStatusSummary: async () => cleanTranslationStatus(),
      publishTranslations: async () => ({ total_items: 0 })
    },
    runCommand: async () => {}
  });

  service.startPublish();
  await waitForJob(service, "public-job-seasonality", "succeeded");
  assert.equal((await service.getStatus()).dirty, false);

  tours[0] = {
    ...tours[0],
    seasonality_start_month: "feb",
    updated_at: "2026-05-10T11:00:00.000Z"
  };
  const status = await service.getStatus();
  assert.equal(status.dirty, true);
  assert.equal(status.source_dirty, true);
});
