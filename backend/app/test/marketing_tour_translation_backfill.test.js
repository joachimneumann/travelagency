import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import {
  buildMarketingTourTranslationSnapshots,
  collectMarketingTourEmbeddedTranslations,
  runMarketingTourTranslationBackfill,
  validateMarketingTourTranslationSnapshots
} from "../scripts/backfill_marketing_tour_translations.js";

async function writeJson(filePath, payload) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function createTempRepo() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "marketing-tour-backfill-"));
  return {
    repoRoot,
    toursDir: path.join(repoRoot, "content", "tours"),
    translationsDir: path.join(repoRoot, "content", "translations")
  };
}

function sampleTour() {
  return {
    id: "tour_alpha",
    title: "Alpha tour",
    title_i18n: {
      fr: "Alpha FR"
    },
    short_description: "Alpha description",
    short_description_i18n: {
      fr: "Description FR"
    },
    travel_plan: {
      days: [{
        id: "day_1",
        title: "Arrival day",
        title_i18n: {
          fr: "Jour arrivee"
        },
        services: [{
          id: "service_1",
          title: "Airport transfer",
          title_i18n: {
            fr: "Transfert aeroport"
          },
          image: {
            caption: "Driver at arrivals",
            caption_i18n: {
              fr: "Chauffeur aux arrivees"
            }
          }
        }]
      }]
    }
  };
}

test("marketing tour translation backfill writes central snapshots and manifest", async () => {
  const { repoRoot, toursDir, translationsDir } = await createTempRepo();
  await writeJson(path.join(toursDir, "tour_alpha", "tour.json"), sampleTour());

  const report = await runMarketingTourTranslationBackfill({
    repoRoot,
    toursDir,
    translationsDir,
    write: true,
    validate: true,
    timestamp: "2026-05-08T00:00:00.000Z"
  });

  assert.equal(report.validation.ok, true);
  assert.equal(report.summary.tour_files, 1);
  assert.equal(report.summary.added, 5);
  assert.equal(report.summary.validation_issues, 0);

  const snapshot = JSON.parse(await readFile(path.join(translationsDir, "customers", "marketing-tours.fr.json"), "utf8"));
  assert.equal(snapshot.schema, "translation-snapshot/v1");
  assert.equal(snapshot.domain, "marketing-tour-memory");
  assert.equal(snapshot.target_lang, "fr");
  assert.equal(snapshot.item_count, 5);
  assert.deepEqual(
    snapshot.items.map((item) => [item.source_text, item.target_text]),
    [
      ["Airport transfer", "Transfert aeroport"],
      ["Alpha description", "Description FR"],
      ["Alpha tour", "Alpha FR"],
      ["Arrival day", "Jour arrivee"],
      ["Driver at arrivals", "Chauffeur aux arrivees"]
    ]
  );

  const manifest = JSON.parse(await readFile(path.join(translationsDir, "manifest.json"), "utf8"));
  assert.equal(manifest.customer_languages.includes("fr"), true);
  assert.deepEqual(manifest.sections.map((section) => section.file), ["customers/marketing-tours.fr.json"]);
});

test("marketing tour translation validation flags central mismatches unless overwrite is requested", async () => {
  const { repoRoot, toursDir, translationsDir } = await createTempRepo();
  await writeJson(path.join(toursDir, "tour_alpha", "tour.json"), {
    id: "tour_alpha",
    title: "Alpha tour",
    title_i18n: {
      fr: "Embedded Alpha FR"
    }
  });
  await writeJson(path.join(translationsDir, "customers", "marketing-tours.fr.json"), {
    items: [{
      source_text: "Alpha tour",
      target_text: "Central Alpha FR"
    }]
  });

  const current = await runMarketingTourTranslationBackfill({
    repoRoot,
    toursDir,
    translationsDir,
    validate: true,
    timestamp: "2026-05-08T00:00:00.000Z"
  });
  assert.equal(current.validation.ok, false);
  assert.equal(current.changes[0].conflicts.length, 1);
  assert.equal(current.validation.issues[0].type, "central_target_mismatch");

  const overwritten = await runMarketingTourTranslationBackfill({
    repoRoot,
    toursDir,
    translationsDir,
    validate: true,
    overwrite: true,
    timestamp: "2026-05-08T00:00:00.000Z"
  });
  assert.equal(overwritten.validation.ok, true);
  assert.equal(overwritten.summary.updated, 1);
});

test("marketing tour translation validation flags duplicate embedded source conflicts", async () => {
  const { repoRoot, toursDir, translationsDir } = await createTempRepo();
  await writeJson(path.join(toursDir, "tour_alpha", "tour.json"), {
    id: "tour_alpha",
    title: "Shared source",
    title_i18n: {
      fr: "Premier"
    },
    short_description: "Shared source",
    short_description_i18n: {
      fr: "Deuxieme"
    }
  });

  const extracted = await collectMarketingTourEmbeddedTranslations({ repoRoot, toursDir });
  const build = await buildMarketingTourTranslationSnapshots({
    repoRoot,
    toursDir,
    translationsDir,
    extracted,
    timestamp: "2026-05-08T00:00:00.000Z"
  });
  const validation = validateMarketingTourTranslationSnapshots(build);

  assert.equal(validation.ok, false);
  assert.equal(validation.issues.length, 1);
  assert.equal(validation.issues[0].type, "embedded_target_conflict");
});
