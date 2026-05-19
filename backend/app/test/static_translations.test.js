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
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function phraseOverrideItem({
  targetLang = "vi",
  sourcePhrase,
  targetPhrase
}) {
  return {
    source_phrase: sourcePhrase,
    target_lang: targetLang,
    target_phrase: targetPhrase
  };
}

async function writePhraseOverrides(repoRoot, items = []) {
  await writeJson(path.join(repoRoot, "config", "i18n", "translation_phrase_overrides.json"), {
    schema: "translation-phrase-overrides/v1",
    schema_version: 1,
    items
  });
}

async function createFixture() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "static-translations-"));
  const frontendSourceDir = path.join(repoRoot, "frontend", "data", "generated", "i18n", "source", "frontend");
  const frontendDir = path.join(repoRoot, "frontend", "data", "i18n", "frontend");
  const frontendMetaDir = path.join(repoRoot, "frontend", "data", "i18n", "frontend_meta");
  await Promise.all([
    mkdir(frontendSourceDir, { recursive: true }),
    mkdir(frontendDir, { recursive: true }),
    mkdir(frontendMetaDir, { recursive: true })
  ]);

  await writeJson(path.join(frontendSourceDir, "en.json"), {
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
  await writePhraseOverrides(repoRoot, [
    phraseOverrideItem({
      key: "hero.cta",
      sourcePhrase: "Plan my trip",
      targetPhrase: "Tạo chuyến đi riêng"
    })
  ]);

  return repoRoot;
}

async function readTranslationSection(repoRoot, relativePath) {
  const raw = await readFile(path.join(repoRoot, "content", "translations", relativePath), "utf8");
  return JSON.parse(raw);
}

test("static translation service marks changed source strings stale and exposes phrase overrides", async () => {
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
    assert.equal(cta.origin, "phrase_override");
    assert.equal(cta.freshness_state, "current");
    assert.equal(cta.override, "Tạo chuyến đi riêng");
    assert.equal(extra.status, "extra");
    assert.equal(extra.publish_state, "not_publishable");
    assert.equal(extra.dirty, false);
    assert.equal(state.counts.stale, 1);
    assert.equal(state.counts.manual_override, 1);
    assert.equal(state.counts["freshness_state.stale"], 1);
    assert.equal(state.counts["origin.phrase_override"], 1);
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
    assert.equal(cta.origin, "phrase_override");
    assert.equal(cta.target_text, "Tạo chuyến đi riêng");
    assert.equal(Object.hasOwn(cta, "manual_override"), false);

    const state = await service.getLanguageState("frontend", "vi");
    assert.equal(state.rows.find((row) => row.key === "hero.title").publish_state, "published");
    assert.equal(state.rows.find((row) => row.key === "hero.cta").publish_state, "published");
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service prunes extra published snapshot keys without translation work", async () => {
  const repoRoot = await createFixture();
  try {
    await writeJson(path.join(repoRoot, "frontend", "data", "i18n", "frontend", "vi.json"), {
      "hero.title": "Kỳ nghỉ riêng mới",
      "hero.cta": "Lập kế hoạch chuyến đi"
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
    await service.publishTranslations({ domains: ["frontend"], target_langs: ["vi"] });

    const snapshotPath = path.join(repoRoot, "content", "translations", "customers", "frontend-static.vi.json");
    const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
    snapshot.items.push({
      ...snapshot.items[0],
      source_ref: "frontend:obsolete.key",
      key: "obsolete.key",
      source_text: "Removed source",
      source_hash: sha("Removed source"),
      target_text: "Đã xoá",
      target_hash: sha("Đã xoá"),
      machine_text: "Đã xoá"
    });
    snapshot.item_count = snapshot.items.length;
    await writeJson(snapshotPath, snapshot);

    const staleState = await service.getLanguageState("frontend", "vi");
    assert.equal(staleState.rows.find((row) => row.key === "obsolete.key").status, "extra");

    const summary = await service.pruneExtraTranslations({ domains: ["frontend"], target_langs: ["vi"] });
    assert.equal(summary.pruned_count, 1);
    assert.deepEqual(summary.domains, [{
      domain: "frontend",
      target_lang: "vi",
      pruned_count: 1
    }]);

    const pruned = await readTranslationSection(repoRoot, "customers/frontend-static.vi.json");
    assert.equal(pruned.item_count, 2);
    assert.equal(pruned.items.some((item) => item.key === "obsolete.key"), false);
    const manifest = JSON.parse(await readFile(path.join(repoRoot, "content", "translations", "manifest.json"), "utf8"));
    assert.equal(manifest.total_items, 2);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service marks current rows unpublished when missing from the published snapshot", async () => {
  const repoRoot = await createFixture();
  try {
    await writeJson(path.join(repoRoot, "frontend", "data", "i18n", "frontend", "vi.json"), {
      "hero.title": "Kỳ nghỉ riêng mới",
      "hero.cta": "Lập kế hoạch chuyến đi"
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
    await service.publishTranslations({ domains: ["frontend"], target_langs: ["vi"] });

    await writeJson(path.join(repoRoot, "frontend", "data", "generated", "i18n", "source", "frontend", "en.json"), {
      "hero.title": "New private holidays",
      "hero.cta": "Plan my trip",
      "hero.badge": "Tailor it"
    });
    await writeJson(path.join(repoRoot, "frontend", "data", "i18n", "frontend", "vi.json"), {
      "hero.title": "Kỳ nghỉ riêng mới",
      "hero.cta": "Lập kế hoạch chuyến đi",
      "hero.badge": "Tùy chỉnh"
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
      },
      "hero.badge": {
        source_hash: sha("Tailor it"),
        origin: "machine",
        updated_at: "2026-01-04T00:00:00.000Z"
      }
    });

    const state = await service.getLanguageState("frontend", "vi");
    const badge = state.rows.find((row) => row.key === "hero.badge");
    assert.equal(badge.freshness_state, "current");
    assert.equal(badge.publish_state, "unpublished");
    assert.equal(state.counts["publish_state.unpublished"], 1);

    await service.publishTranslations({ domains: ["frontend"], target_langs: ["vi"] });
    const republished = await service.getLanguageState("frontend", "vi");
    assert.equal(republished.rows.find((row) => row.key === "hero.badge").publish_state, "published");
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service repairs protected-term-only strings during machine apply", async () => {
  const repoRoot = await createFixture();
  try {
    await writeJson(path.join(repoRoot, "frontend", "data", "generated", "i18n", "source", "frontend", "en.json"), {
      "backend.button_full": "AsiaTravelPlan Backend"
    });
    await writeJson(path.join(repoRoot, "frontend", "data", "i18n", "frontend", "vi.json"), {
      "backend.button_full": "Phần cuối của Kế hoạch Du lịch Châu Á"
    });
    await writeJson(path.join(repoRoot, "frontend", "data", "i18n", "frontend_meta", "vi.json"), {
      "backend.button_full": {
        source_hash: sha("AsiaTravelPlan Backend"),
        origin: "machine",
        updated_at: "2026-01-02T00:00:00.000Z"
      }
    });
    await writeJson(path.join(repoRoot, "config", "i18n", "translation_protected_terms.json"), {
      items: ["AsiaTravelPlan", "backend"],
      updated_at: null
    });
    const service = createStaticTranslationService({
      repoRoot,
      nowIso: () => "2026-04-28T04:00:00.000Z",
      translateEntriesWithMeta: async () => ({
        entries: {
          "backend.button_full": "Phần cuối của Kế hoạch Du lịch Châu Á"
        },
        provider: { kind: "test", label: "Test", model: "", display: "test" }
      })
    });

    const summary = await service.applyMissingTranslations({ domains: ["frontend"], target_langs: ["vi"] });
    assert.equal(summary.requested_count, 1);
    assert.equal(summary.translated_count, 1);

    const snapshot = await readTranslationSection(repoRoot, "customers/frontend-static.vi.json");
    assert.equal(snapshot.items[0].target_text, "AsiaTravelPlan Backend");
    assert.equal(snapshot.items[0].source_text, "AsiaTravelPlan Backend");
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service updates translated strings that contain protected terms", async () => {
  const repoRoot = await createFixture();
  try {
    await writeJson(path.join(repoRoot, "frontend", "data", "generated", "i18n", "source", "frontend", "en.json"), {
      "modal.title.default": "Plan your trip with AsiaTravelPlan"
    });
    await writeJson(path.join(repoRoot, "frontend", "data", "i18n", "frontend", "vi.json"), {
      "modal.title.default": "Lên kế hoạch cho chuyến đi của bạn với Kế hoạch Du lịch Châu Á"
    });
    await writeJson(path.join(repoRoot, "frontend", "data", "i18n", "frontend_meta", "vi.json"), {
      "modal.title.default": {
        source_hash: sha("Plan your trip with AsiaTravelPlan"),
        origin: "machine",
        updated_at: "2026-01-02T00:00:00.000Z"
      }
    });
    await writeJson(path.join(repoRoot, "config", "i18n", "translation_protected_terms.json"), {
      items: ["AsiaTravelPlan"],
      updated_at: null
    });
    let translateOptions = null;
    const service = createStaticTranslationService({
      repoRoot,
      nowIso: () => "2026-04-28T04:00:00.000Z",
      translateEntriesWithMeta: async (entries, _targetLang, options) => {
        translateOptions = options;
        assert.deepEqual(entries, {
          "modal.title.default": "Plan your trip with AsiaTravelPlan"
        });
        return {
          entries: {
            "modal.title.default": "Lên kế hoạch cho chuyến đi của bạn với AsiaTravelPlan"
          },
          provider: { kind: "test", label: "Test", model: "", display: "test" }
        };
      }
    });

    const status = await service.getStatusSummary({ domains: ["frontend"] });
    const viStatus = status.languages.find((entry) => entry.domain === "frontend" && entry.target_lang === "vi");
    assert.equal(viStatus.translation_work_count, 1);
    assert.equal(viStatus.protected_term_count, 1);
    assert.equal(status.translation_work_count >= 1, true);
    assert.equal(status.protected_term_count >= 1, true);

    const summary = await service.applyProtectedTerms({ domains: ["frontend"], target_langs: ["vi"] });
    assert.equal(summary.requested_count, 1);
    assert.equal(summary.translated_count, 1);
    assert.deepEqual(translateOptions.protectedTerms, ["AsiaTravelPlan"]);

    const snapshot = await readTranslationSection(repoRoot, "customers/frontend-static.vi.json");
    assert.equal(snapshot.items[0].target_text, "Lên kế hoạch cho chuyến đi của bạn với AsiaTravelPlan");
    assert.equal(snapshot.items[0].source_text, "Plan your trip with AsiaTravelPlan");
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation publish uses English fallback for stale or missing required rows", async () => {
  const repoRoot = await createFixture();
  try {
    const service = createStaticTranslationService({
      repoRoot,
      translationsSnapshotDir: path.join(repoRoot, "content", "translations")
    });

    const manifest = await service.publishTranslations({ domains: ["frontend"], target_langs: ["vi"] });
    assert.equal(manifest.fallback_count, 1);
    assert.equal(manifest.warnings[0].code, "english_fallback");

    const snapshot = await readTranslationSection(repoRoot, "customers/frontend-static.vi.json");
    const title = snapshot.items.find((item) => item.key === "hero.title");
    assert.equal(title.target_text, "New private holidays");
    assert.equal(title.machine_text, "");
    assert.equal(title.origin, "english_fallback");
    assert.equal(title.review_state, "needs_translation");
    assert.equal(title.fallback, true);
    assert.equal(title.fallback_reason, "stale_translation");

    const state = await service.getLanguageState("frontend", "vi");
    const titleState = state.rows.find((row) => row.key === "hero.title");
    assert.equal(titleState.origin, "english_fallback");
    assert.equal(titleState.review_state, "needs_translation");
    assert.equal(titleState.publish_state, "published");
    assert.equal(state.counts.dirty, 1);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation snapshot publish can run when phrase policy writes are disabled", async () => {
  const repoRoot = await createFixture();
  try {
    const service = createStaticTranslationService({
      repoRoot,
      translationsSnapshotDir: path.join(repoRoot, "content", "translations"),
      writesEnabled: false,
      snapshotPublishEnabled: true
    });

    const manifest = await service.publishTranslations({ domains: ["frontend"], target_langs: ["vi"] });
    assert.equal(manifest.fallback_count, 1);

    await assert.rejects(
      () => service.applyMissingTranslations({ domains: ["frontend"], target_langs: ["vi"] }),
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

test("static translation snapshot publish can be disabled separately", async () => {
  const repoRoot = await createFixture();
  try {
    const service = createStaticTranslationService({
      repoRoot,
      translationsSnapshotDir: path.join(repoRoot, "content", "translations"),
      snapshotPublishEnabled: false
    });

    await assert.rejects(
      () => service.publishTranslations({ domains: ["frontend"], target_langs: ["vi"] }),
      (error) => {
        assert.equal(error.status, 403);
        assert.equal(error.code, "STATIC_TRANSLATION_SNAPSHOT_PUBLISH_DISABLED");
        return true;
      }
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service rejects phrase override writes because config policy is read-only", async () => {
  const repoRoot = await createFixture();
  try {
    const service = createStaticTranslationService({ repoRoot });
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
        assert.equal(error.code, "STATIC_TRANSLATION_PHRASE_OVERRIDES_READ_ONLY");
        return true;
      }
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service edits translation policy config files", async () => {
  const repoRoot = await createFixture();
  try {
    const service = createStaticTranslationService({
      repoRoot,
      nowIso: () => "2026-05-17T10:00:00.000Z"
    });
    const initial = await service.getTranslationPolicyConfig();

    assert.equal(initial.permissions.can_write, true);
    assert.equal(initial.phrase_overrides.path, "config/i18n/translation_phrase_overrides.json");
    assert.equal(initial.phrase_overrides.item_count, 1);
    assert.equal(initial.protected_terms.path, "config/i18n/translation_protected_terms.json");

    const saved = await service.saveTranslationPolicyConfig({
      phrase_overrides: {
        expected_revision: initial.phrase_overrides.revision,
        data: {
          items: [
            phraseOverrideItem({
              sourcePhrase: "New private holidays",
              targetPhrase: "Kỳ nghỉ riêng mới"
            })
          ]
        }
      },
      protected_terms: {
        expected_revision: initial.protected_terms.revision,
        data: {
          items: ["AsiaTravelPlan", "ATP"]
        }
      }
    });

    assert.equal(saved.phrase_overrides.item_count, 1);
    assert.equal(saved.protected_terms.item_count, 2);

    const phraseOverrides = JSON.parse(await readFile(path.join(repoRoot, "config", "i18n", "translation_phrase_overrides.json"), "utf8"));
    assert.equal(phraseOverrides.schema, "translation-phrase-overrides/v1");
    assert.deepEqual(phraseOverrides.items, [
      phraseOverrideItem({
        sourcePhrase: "New private holidays",
        targetPhrase: "Kỳ nghỉ riêng mới"
      })
    ]);

    const protectedTerms = JSON.parse(await readFile(path.join(repoRoot, "config", "i18n", "translation_protected_terms.json"), "utf8"));
    assert.equal(protectedTerms.schema, "translation-protected-terms/v1");
    assert.equal(protectedTerms.updated_at, "2026-05-17T10:00:00.000Z");
    assert.deepEqual(protectedTerms.items, ["AsiaTravelPlan", "ATP"]);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service rejects invalid translation policy config edits", async () => {
  const repoRoot = await createFixture();
  try {
    const service = createStaticTranslationService({ repoRoot });

    await assert.rejects(
      () => service.saveTranslationPolicyConfig({
        phrase_overrides: {
          data: {
            items: [
              {
                source_phrase: "Hello {name}",
                target_lang: "vi",
                target_phrase: "Xin chào"
              }
            ]
          }
        }
      }),
      (error) => {
        assert.equal(error.status, 400);
        assert.equal(error.code, "STATIC_TRANSLATION_PHRASE_OVERRIDES_INVALID");
        assert.match(error.message, /template token mismatch/);
        return true;
      }
    );

    await assert.rejects(
      () => service.saveTranslationPolicyConfig({
        protected_terms: {
          data: {
            items: ["ATP", "atp"]
          }
        }
      }),
      (error) => {
        assert.equal(error.status, 400);
        assert.equal(error.code, "STATIC_TRANSLATION_PROTECTED_TERMS_INVALID");
        assert.match(error.message, /duplicate protected term/);
        return true;
      }
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service deletes static cached translations without clearing phrase overrides", async () => {
  const repoRoot = await createFixture();
  try {
    const service = createStaticTranslationService({ repoRoot });
    const deleted = await service.deleteCache("frontend", "vi", "hero.cta");
    const cta = deleted.rows.find((row) => row.key === "hero.cta");

    assert.equal(cta.cached, "");
    assert.equal(cta.override, "Tạo chuyến đi riêng");
    assert.equal(cta.status, "manual_override");
    assert.equal(cta.origin, "phrase_override");

    const section = await readTranslationSection(repoRoot, "customers/frontend-static.vi.json");
    const item = section.items.find((entry) => entry.key === "hero.cta");
    assert.equal(item.machine_text, "");
    assert.equal(Object.hasOwn(item, "manual_override"), false);
    assert.equal(item.target_text, "Tạo chuyến đi riêng");
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service rejects phrase override writes when disabled", async () => {
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
      dataPath: path.join(repoRoot, "content", "translations", "translation_memory.json"),
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

    assert.ok(changedState.revision);
    await writePhraseOverrides(repoRoot, [
      phraseOverrideItem({
        domain: "marketing-tour-memory",
        section: "customers",
        subsection: "marketing-tours",
        targetLang: "de",
        key: row.key,
        sourcePhrase: "Lantern walk",
        targetPhrase: "Laternen-Spaziergang"
      })
    ]);
    const saved = await service.getLanguageState("marketing-tour-memory", "de");
    const savedRow = saved.rows.find((item) => item.source === "Lantern walk");

    assert.equal(savedRow.override, "Laternen-Spaziergang");
    assert.equal(savedRow.status, "manual_override");

    await translationMemoryStore.writeMachineTranslations(
      { copied: "Lantern walk" },
      { copied: "Neue Maschinenlaterne" },
      "de",
      { kind: "google", display: "google" }
    );
    const stillManual = await service.getLanguageState("marketing-tour-memory", "de");
    assert.equal(stillManual.rows.find((item) => item.source === "Lantern walk").override, "Laternen-Spaziergang");
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service applies missing marketing tour memory translations", async () => {
  const repoRoot = await createFixture();
  try {
    const translationMemoryStore = createTranslationMemoryStore({
      dataPath: path.join(repoRoot, "content", "translations", "translation_memory.json"),
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
    const progress = [];
    const service = createStaticTranslationService({
      repoRoot,
      readTours: async () => JSON.parse(JSON.stringify(tours)),
      translationMemoryStore,
      nowIso: () => "2026-04-28T02:30:00.000Z"
    });

    const summary = await service.applyMissingTranslations({
      domains: ["marketing-tour-memory"],
      target_langs: ["vi"],
      onProgress: (entry) => progress.push(entry),
      translateEntriesWithMeta: async (entries, targetLang, options) => {
        calls.push({ entries, targetLang, options });
        options.onEntryComplete({ completedEntries: 1 });
        options.onEntryComplete({ completedEntries: 2 });
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
    assert.deepEqual(progress.map((entry) => ({
      domain: entry.domain,
      target_lang: entry.target_lang,
      current: entry.current,
      total: entry.total
    })), [
      { domain: "marketing-tour-memory", target_lang: "vi", current: 0, total: 2 },
      { domain: "marketing-tour-memory", target_lang: "vi", current: 1, total: 2 },
      { domain: "marketing-tour-memory", target_lang: "vi", current: 2, total: 2 },
      { domain: "marketing-tour-memory", target_lang: "vi", current: 2, total: 2 }
    ]);
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

test("static translation service exposes destination scope catalog labels as customer translations", async () => {
  const repoRoot = await createFixture();
  try {
    let store = {
      destination_scope_destinations: [
        {
          code: "VN",
          label: "Vietnam"
        }
      ],
      destination_regions: [
        {
          id: "region_north",
          destination: "VN",
          code: "north",
          name: "North"
        }
      ],
      destination_places: [
        {
          id: "place_sapa",
          destination: "VN",
          region_id: "region_north",
          code: "sapa",
          name: "Sapa"
        }
      ]
    };

    const service = createStaticTranslationService({
      repoRoot,
      readStore: async () => JSON.parse(JSON.stringify(store)),
      persistStore: async (nextStore) => {
        store = JSON.parse(JSON.stringify(nextStore));
      },
      nowIso: () => "2026-04-28T03:15:00.000Z"
    });

    assert.equal(service.listDomains().some((domain) => domain.id === "destination-scope-catalog" && domain.audience === "customer"), true);

    const state = await service.getLanguageState("destination-scope-catalog", "vi");
    const vietnam = state.rows.find((row) => row.key === "destination.VN.label");
    const north = state.rows.find((row) => row.key === "region.region_north.name");
    const sapa = state.rows.find((row) => row.key === "place.place_sapa.name");

    assert.equal(vietnam.cached, "");
    assert.equal(vietnam.status, "missing");
    assert.equal(north.override, "");
    assert.equal(north.status, "missing");
    assert.equal(sapa.status, "missing");

    assert.ok(state.revision);
    await writePhraseOverrides(repoRoot, [
      phraseOverrideItem({
        domain: "destination-scope-catalog",
        section: "customers",
        subsection: "tour-destinations",
        targetLang: "vi",
        key: "region.region_north.name",
        sourcePhrase: "North",
        targetPhrase: "Miền Bắc"
      }),
      phraseOverrideItem({
        domain: "destination-scope-catalog",
        section: "customers",
        subsection: "tour-destinations",
        targetLang: "vi",
        key: "place.place_sapa.name",
        sourcePhrase: "Sapa",
        targetPhrase: "Sa Pa"
      })
    ]);
    const saved = await service.getLanguageState("destination-scope-catalog", "vi");
    const savedNorth = saved.rows.find((row) => row.key === "region.region_north.name");
    const savedSapa = saved.rows.find((row) => row.key === "place.place_sapa.name");
    assert.equal(savedNorth.override, "Miền Bắc");
    assert.equal(savedSapa.override, "Sa Pa");
    assert.equal(Object.hasOwn(store.destination_regions[0], "name_i18n"), false);
    assert.equal(Object.hasOwn(store.destination_places[0], "name_i18n"), false);

    const calls = [];
    const summary = await service.applyMissingTranslations({
      domains: ["destination-scope-catalog"],
      target_langs: ["de"],
      translateEntriesWithMeta: async (entries, targetLang, options) => {
        calls.push({ entries, targetLang, options });
        return {
          entries: Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, `de:${value}`])),
          provider: { kind: "test", display: "test" }
        };
      }
    });

    assert.equal(summary.requested_count, 3);
    assert.equal(summary.translated_count, 3);
    assert.equal(calls[0].options.translationProfile, "destination_scope_catalog");
    const deSection = await readTranslationSection(repoRoot, "customers/tour-destinations.de.json");
    assert.equal(deSection.items.find((item) => item.key === "destination.VN.label").machine_text, "de:Vietnam");
    assert.equal(deSection.items.find((item) => item.key === "region.region_north.name").machine_text, "de:North");
    assert.equal(deSection.items.find((item) => item.key === "place.place_sapa.name").machine_text, "de:Sapa");
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("static translation service clears marketing tour machine cache without deleting phrase overrides", async () => {
  const repoRoot = await createFixture();
  try {
    const translationMemoryStore = createTranslationMemoryStore({
      dataPath: path.join(repoRoot, "content", "translations", "translation_memory.json"),
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
    await writePhraseOverrides(repoRoot, [
      phraseOverrideItem({
        domain: "marketing-tour-memory",
        section: "customers",
        subsection: "marketing-tours",
        targetLang: "vi",
        key: sha("Hoi An evening"),
        sourcePhrase: "Hoi An evening",
        targetPhrase: "phrase:Hoi An evening"
      })
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
    assert.equal(resolved.entries.description, undefined);
    assert.equal(resolved.origins.description, undefined);

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

test("static translation service keeps frontend UI and generated content out of index memory", async () => {
  const repoRoot = await createFixture();
  try {
    const translationMemoryStore = createTranslationMemoryStore({
      dataPath: path.join(repoRoot, "content", "translations", "translation_memory.json"),
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
          label: "Vietnam"
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

    assert.equal(indexCta, undefined);
    assert.equal(indexState.rows.length, 0);
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
