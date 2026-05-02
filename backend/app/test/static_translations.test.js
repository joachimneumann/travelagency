import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStaticTranslationService } from "../src/domain/static_translations.js";
import { createTranslationMemoryStore } from "../src/lib/translation_memory_store.js";

function sha(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function createFixture() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "static-translations-"));
  const frontendDir = path.join(repoRoot, "frontend", "data", "i18n", "frontend");
  const frontendMetaDir = path.join(repoRoot, "frontend", "data", "i18n", "frontend_meta");
  const frontendOverrideDir = path.join(repoRoot, "frontend", "data", "i18n", "frontend_overrides");
  await Promise.all([
    mkdir(frontendDir, { recursive: true }),
    mkdir(frontendMetaDir, { recursive: true }),
    mkdir(frontendOverrideDir, { recursive: true })
  ]);

  await writeJson(path.join(frontendDir, "en.json"), {
    "hero.title": "New private holidays",
    "hero.cta": "Plan my trip"
  });
  await writeJson(path.join(frontendDir, "vi.json"), {
    "hero.title": "Old translation",
    "hero.cta": "Lập kế hoạch chuyến đi",
    "obsolete.key": "Remove me"
  });
  await writeJson(path.join(frontendMetaDir, "vi.json"), {
    "hero.title": {
      source_hash: sha("Old private holidays"),
      origin: "machine",
      updated_at: "2026-01-01T00:00:00.000Z"
    },
    "hero.cta": {
      source_hash: sha("Plan my trip"),
      origin: "machine",
      updated_at: "2026-01-02T00:00:00.000Z"
    }
  });
  await writeJson(path.join(frontendOverrideDir, "vi.json"), {
    "hero.cta": "Tạo chuyến đi riêng"
  });

  return repoRoot;
}

test("static translation service marks changed source strings stale and exposes manual overrides", async () => {
  const repoRoot = await createFixture();
  try {
    const service = createStaticTranslationService({ repoRoot });
    const state = await service.getLanguageState("frontend", "vi");
    const title = state.rows.find((row) => row.key === "hero.title");
    const cta = state.rows.find((row) => row.key === "hero.cta");
    const extra = state.rows.find((row) => row.key === "obsolete.key");

    assert.equal(title.status, "stale");
    assert.equal(title.freshness_state, "stale");
    assert.equal(title.publish_state, "unpublished");
    assert.equal(title.source_hash, sha("New private holidays"));
    assert.equal(cta.status, "manual_override");
    assert.equal(cta.origin, "manual");
    assert.equal(cta.freshness_state, "current");
    assert.equal(cta.override, "Tạo chuyến đi riêng");
    assert.equal(extra.status, "extra");
    assert.equal(extra.publish_state, "not_publishable");
    assert.equal(extra.dirty, false);
    assert.equal(state.counts.stale, 1);
    assert.equal(state.counts.manual_override, 1);
    assert.equal(state.counts["freshness_state.stale"], 1);
    assert.equal(state.counts["origin.manual"], 1);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service publishes a versioned snapshot for clean target languages", async () => {
  const repoRoot = await createFixture();
  try {
    await writeJson(path.join(repoRoot, "frontend", "data", "i18n", "frontend", "vi.json"), {
      "hero.title": "Kỳ nghỉ riêng mới",
      "hero.cta": "Lập kế hoạch chuyến đi",
      "obsolete.key": "Remove me"
    });
    await writeJson(path.join(repoRoot, "frontend", "data", "i18n", "frontend_meta", "vi.json"), {
      "hero.title": {
        source_hash: sha("New private holidays"),
        origin: "machine",
        updated_at: "2026-01-03T00:00:00.000Z"
      },
      "hero.cta": {
        source_hash: sha("Plan my trip"),
        origin: "machine",
        updated_at: "2026-01-02T00:00:00.000Z"
      }
    });
    const service = createStaticTranslationService({
      repoRoot,
      translationsSnapshotDir: path.join(repoRoot, "content", "translations"),
      nowIso: () => "2026-04-28T04:00:00.000Z"
    });

    const manifest = await service.publishTranslations({ domains: ["frontend"], target_langs: ["vi"] });
    assert.equal(manifest.total_items, 2);
    assert.equal(manifest.sections[0].file, "customers/frontend-static.vi.json");

    const snapshotRaw = await readFile(path.join(repoRoot, "content", "translations", "customers", "frontend-static.vi.json"), "utf8");
    const snapshot = JSON.parse(snapshotRaw);
    const cta = snapshot.items.find((item) => item.key === "hero.cta");
    assert.equal(snapshot.schema, "translation-snapshot/v1");
    assert.equal(snapshot.target_lang, "vi");
    assert.equal(cta.origin, "manual");
    assert.equal(cta.target_text, "Tạo chuyến đi riêng");

    const state = await service.getLanguageState("frontend", "vi");
    assert.equal(state.rows.find((row) => row.key === "hero.title").publish_state, "published");
    assert.equal(state.rows.find((row) => row.key === "hero.cta").publish_state, "published");
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation publish blocks stale and missing required rows", async () => {
  const repoRoot = await createFixture();
  try {
    const service = createStaticTranslationService({
      repoRoot,
      translationsSnapshotDir: path.join(repoRoot, "content", "translations")
    });

    await assert.rejects(
      () => service.publishTranslations({ domains: ["frontend"], target_langs: ["vi"] }),
      (error) => {
        assert.equal(error.status, 409);
        assert.equal(error.code, "STATIC_TRANSLATION_PUBLISH_BLOCKED");
        assert.ok(error.details.some((issue) => issue.key === "hero.title" && issue.issue === "stale_translation"));
        return true;
      }
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service writes ordered overrides with optimistic revision checks", async () => {
  const repoRoot = await createFixture();
  try {
    const service = createStaticTranslationService({ repoRoot });
    const initial = await service.getLanguageState("frontend", "vi");
    const saved = await service.patchOverrides("frontend", "vi", {
      expected_revision: initial.revision,
      overrides: {
        "hero.title": "Kỳ nghỉ riêng mới",
        "hero.cta": ""
      }
    });

    const overridePath = path.join(repoRoot, "frontend", "data", "i18n", "frontend_overrides", "vi.json");
    const raw = await readFile(overridePath, "utf8");
    assert.deepEqual(JSON.parse(raw), {
      "hero.title": "Kỳ nghỉ riêng mới"
    });
    assert.equal(saved.rows.find((row) => row.key === "hero.title").status, "manual_override");
    assert.equal(saved.rows.find((row) => row.key === "hero.cta").status, "machine");

    await assert.rejects(
      () => service.patchOverrides("frontend", "vi", {
        expected_revision: initial.revision,
        overrides: {
          "hero.title": "Another"
        }
      }),
      /changed/
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service deletes static cached translations without clearing manual overrides", async () => {
  const repoRoot = await createFixture();
  try {
    const service = createStaticTranslationService({ repoRoot });
    const deleted = await service.deleteCache("frontend", "vi", "hero.cta");
    const cta = deleted.rows.find((row) => row.key === "hero.cta");

    assert.equal(cta.cached, "");
    assert.equal(cta.override, "Tạo chuyến đi riêng");
    assert.equal(cta.status, "manual_override");
    assert.equal(cta.origin, "manual");

    const targetRaw = await readFile(path.join(repoRoot, "frontend", "data", "i18n", "frontend", "vi.json"), "utf8");
    assert.equal(Object.prototype.hasOwnProperty.call(JSON.parse(targetRaw), "hero.cta"), false);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service rejects manual override writes when disabled", async () => {
  const repoRoot = await createFixture();
  try {
    const service = createStaticTranslationService({ repoRoot, writesEnabled: false });
    const initial = await service.getLanguageState("frontend", "vi");

    await assert.rejects(
      () => service.patchOverrides("frontend", "vi", {
        expected_revision: initial.revision,
        overrides: {
          "hero.title": "Kỳ nghỉ riêng mới"
        }
      }),
      (error) => {
        assert.equal(error.status, 403);
        assert.equal(error.code, "STATIC_TRANSLATION_WRITES_DISABLED");
        return true;
      }
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service exposes marketing tour memory and saves manual overrides", async () => {
  const repoRoot = await createFixture();
  try {
    const translationMemoryStore = createTranslationMemoryStore({
      dataPath: path.join(repoRoot, "content", "translation_memory.json"),
      writeQueueRef: { current: Promise.resolve() },
      nowIso: () => "2026-04-28T02:00:00.000Z"
    });
    await translationMemoryStore.writeMachineTranslations(
      {
        title: "Lantern walk",
        description: "Hoi An evening"
      },
      {
        title: "Maschinenlaternen-Spaziergang",
        description: "Hoi An Abend"
      },
      "de",
      { kind: "google", display: "google" }
    );

    const tours = [
      {
        id: "tour_memory",
        title: { en: "Lantern walk" },
        short_description: { en: "Hoi An evening" },
        travel_plan: {
          days: [
            {
              id: "day_one",
              title: "Market morning",
              services: [
                {
                  id: "service_one",
                  timing_kind: "label",
                  title: "Basket boat tour"
                }
              ]
            }
          ]
        }
      }
    ];

    const service = createStaticTranslationService({
      repoRoot,
      readTours: async () => JSON.parse(JSON.stringify(tours)),
      translationMemoryStore,
      nowIso: () => "2026-04-28T02:00:00.000Z"
    });

    const state = await service.getLanguageState("marketing-tour-memory", "de");
    const row = state.rows.find((item) => item.source === "Lantern walk");
    const description = state.rows.find((item) => item.source === "Hoi An evening");
    const missing = state.rows.find((item) => item.source === "Basket boat tour");

    assert.equal(row.cached, "Maschinenlaternen-Spaziergang");
    assert.equal(row.status, "machine");
    assert.equal(description.cached, "Hoi An Abend");
    assert.equal(description.status, "machine");
    assert.equal(missing.status, "missing");

    const deleted = await service.deleteCache("marketing-tour-memory", "de", row.key, {
      expected_revision: state.revision
    });
    const deletedRow = deleted.rows.find((item) => item.source === "Lantern walk");
    assert.equal(deletedRow.cached, "");
    assert.equal(deletedRow.status, "missing");

    tours[0].short_description.en = "Hoi An sunrise";
    const changedState = await service.getLanguageState("marketing-tour-memory", "de");
    const changedDescription = changedState.rows.find((item) => item.source === "Hoi An sunrise");
    assert.equal(changedDescription.status, "missing");
    assert.equal(changedDescription.dirty, true);
    const summary = await service.getStatusSummary();
    const marketingTourDe = summary.languages.find((entry) => entry.domain === "marketing-tour-memory" && entry.target_lang === "de");
    assert.equal(summary.dirty, true);
    assert.equal(marketingTourDe.dirty_count > 0, true);

    const saved = await service.patchOverrides("marketing-tour-memory", "de", {
      expected_revision: changedState.revision,
      overrides: {
        [row.key]: "Laternen-Spaziergang"
      }
    });
    const savedRow = saved.rows.find((item) => item.source === "Lantern walk");
    const resolved = await translationMemoryStore.resolveEntries({ copied: "Lantern walk" }, "de");

    assert.equal(savedRow.override, "Laternen-Spaziergang");
    assert.equal(savedRow.status, "manual_override");
    assert.deepEqual(resolved.entries, { copied: "Laternen-Spaziergang" });
    assert.deepEqual(resolved.origins, { copied: "manual_override" });

    await translationMemoryStore.writeMachineTranslations(
      { copied: "Lantern walk" },
      { copied: "Neue Maschinenlaterne" },
      "de",
      { kind: "google", display: "google" }
    );
    const stillManual = await translationMemoryStore.resolveEntries({ copied: "Lantern walk" }, "de");

    assert.deepEqual(stillManual.entries, { copied: "Laternen-Spaziergang" });
    assert.deepEqual(stillManual.origins, { copied: "manual_override" });
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service applies missing marketing tour memory translations", async () => {
  const repoRoot = await createFixture();
  try {
    const translationMemoryStore = createTranslationMemoryStore({
      dataPath: path.join(repoRoot, "content", "translation_memory.json"),
      writeQueueRef: { current: Promise.resolve() },
      nowIso: () => "2026-04-28T02:30:00.000Z"
    });
    const tours = [
      {
        id: "tour_memory",
        title: { en: "Lantern walk" },
        short_description: { en: "Hoi An evening" }
      }
    ];
    const calls = [];
    const service = createStaticTranslationService({
      repoRoot,
      readTours: async () => JSON.parse(JSON.stringify(tours)),
      translationMemoryStore,
      nowIso: () => "2026-04-28T02:30:00.000Z"
    });

    const summary = await service.applyMissingTranslations({
      domains: ["marketing-tour-memory"],
      target_langs: ["vi"],
      translateEntriesWithMeta: async (entries, targetLang, options) => {
        calls.push({ entries, targetLang, options });
        return {
          entries: Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, `vi:${value}`])),
          provider: { kind: "test", display: "test" }
        };
      }
    });

    const resolved = await translationMemoryStore.resolveEntries({ title: "Lantern walk", description: "Hoi An evening" }, "vi");
    assert.equal(summary.requested_count, 2);
    assert.equal(summary.translated_count, 2);
    assert.equal(calls[0].targetLang, "vi");
    assert.equal(calls[0].options.translationProfile, "marketing_trip_copy");
    assert.equal(calls[0].options.allowGoogleFallback, true);
    assert.deepEqual(resolved.entries, {
      title: "vi:Lantern walk",
      description: "vi:Hoi An evening"
    });

    const state = await service.getLanguageState("marketing-tour-memory", "vi");
    assert.equal(state.rows.find((row) => row.source === "Lantern walk").status, "machine");
    assert.equal(state.rows.find((row) => row.source === "Hoi An evening").status, "machine");
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service clears marketing tour machine cache without deleting manual overrides", async () => {
  const repoRoot = await createFixture();
  try {
    const translationMemoryStore = createTranslationMemoryStore({
      dataPath: path.join(repoRoot, "content", "translation_memory.json"),
      writeQueueRef: { current: Promise.resolve() },
      nowIso: () => "2026-04-28T02:45:00.000Z"
    });
    const tours = [
      {
        id: "tour_memory",
        title: { en: "Lantern walk" },
        short_description: { en: "Hoi An evening" }
      }
    ];
    await translationMemoryStore.writeMachineTranslations(
      {
        title: "Lantern walk",
        description: "Hoi An evening"
      },
      {
        title: "old:Lantern walk",
        description: "old:Hoi An evening"
      },
      "vi",
      { kind: "test", display: "test" }
    );
    await translationMemoryStore.patchManualOverrides("vi", [
      {
        source_text: "Hoi An evening",
        manual_override: "manual:Hoi An evening"
      }
    ]);

    const service = createStaticTranslationService({
      repoRoot,
      readTours: async () => JSON.parse(JSON.stringify(tours)),
      translationMemoryStore,
      nowIso: () => "2026-04-28T02:45:00.000Z"
    });

    const summary = await service.clearMachineTranslations({
      domains: ["marketing-tour-memory"],
      target_langs: ["vi"]
    });

    const resolved = await translationMemoryStore.resolveEntries({ title: "Lantern walk", description: "Hoi An evening" }, "vi");
    assert.equal(summary.cleared_count, 2);
    assert.deepEqual(summary.domains, [
      {
        domain: "marketing-tour-memory",
        target_lang: "vi",
        cleared_count: 2
      }
    ]);
    assert.equal(resolved.entries.title, undefined);
    assert.equal(resolved.entries.description, "manual:Hoi An evening");
    assert.equal(resolved.origins.description, "manual_override");

    const state = await service.getLanguageState("marketing-tour-memory", "vi");
    const title = state.rows.find((row) => row.source === "Lantern walk");
    const description = state.rows.find((row) => row.source === "Hoi An evening");
    assert.equal(title.status, "missing");
    assert.equal(description.status, "manual_override");
    assert.equal(description.cached, "");
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service excludes generated content and booking travel-plan strings from index memory", async () => {
  const repoRoot = await createFixture();
  try {
    const translationMemoryStore = createTranslationMemoryStore({
      dataPath: path.join(repoRoot, "content", "translation_memory.json"),
      writeQueueRef: { current: Promise.resolve() },
      nowIso: () => "2026-04-28T03:00:00.000Z"
    });
    await translationMemoryStore.writeMachineTranslations(
      {
        cta: "Plan my trip",
        bookingDay: "Arrival day",
        bookingService: "Airport transfer"
      },
      {
        cta: "Lập kế hoạch chuyến đi",
        bookingDay: "Ngày đến",
        bookingService: "Đưa đón sân bay"
      },
      "vi",
      { kind: "google", display: "google" }
    );

    const store = {
      destination_scope_destinations: [
        {
          code: "VN",
          label: "Vietnam",
          label_i18n: { en: "Vietnam" }
        }
      ],
      destination_areas: [],
      destination_places: [],
      bookings: [
        {
          id: "booking_alpha",
          travel_plan: {
            days: [
              {
                id: "day_one",
                title: "Arrival day",
                services: [
                  {
                    id: "service_one",
                    title: "Airport transfer",
                    details: "Meet your guide"
                  }
                ]
              }
            ]
          }
        }
      ]
    };

    const service = createStaticTranslationService({
      repoRoot,
      readStore: async () => JSON.parse(JSON.stringify(store)),
      readTours: async () => [],
      translationMemoryStore,
      nowIso: () => "2026-04-28T03:00:00.000Z"
    });

    const indexState = await service.getLanguageState("index-content-memory", "vi");
    const indexCta = indexState.rows.find((row) => row.source === "Plan my trip");

    assert.equal(indexCta.cached, "Lập kế hoạch chuyến đi");
    assert.equal(indexCta.status, "machine");
    assert.equal(indexState.rows.some((row) => row.source === "Vietnam"), false);
    assert.equal(indexState.rows.some((row) => row.source === "Airport transfer"), false);
    assert.equal(indexState.rows.some((row) => row.source === "Meet your guide"), false);

    assert.equal(service.listDomains().some((domain) => domain.id === "homepage-content"), false);
    assert.equal(service.listDomains().some((domain) => domain.id === "booking-content-memory"), false);
    const statusSummary = await service.getStatusSummary();
    assert.equal(statusSummary.languages.some((entry) => entry.domain === "homepage-content"), false);
    assert.equal(statusSummary.languages.some((entry) => entry.domain === "booking-content-memory"), false);

    const calls = [];
    const summary = await service.applyMissingTranslations({
      domains: ["booking-content-memory"],
      target_langs: ["vi"],
      translateEntriesWithMeta: async (entries, targetLang, options) => {
        calls.push({ entries, targetLang, options });
        return {
          entries: Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, `vi:${value}`])),
          provider: { kind: "test", display: "test" }
        };
      }
    });

    assert.equal(summary.requested_count, 0);
    assert.equal(summary.translated_count, 0);
    assert.equal(calls.length, 0);

    const homepageSummary = await service.applyMissingTranslations({
      domains: ["homepage-content"],
      target_langs: ["vi"],
      translateEntriesWithMeta: async (entries, targetLang, options) => {
        calls.push({ entries, targetLang, options });
        return {
          entries: Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, `vi:${value}`])),
          provider: { kind: "test", display: "test" }
        };
      }
    });

    assert.equal(homepageSummary.requested_count, 0);
    assert.equal(homepageSummary.translated_count, 0);
    assert.equal(calls.length, 0);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
