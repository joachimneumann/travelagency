import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStaticTranslationService } from "../src/domain/static_translations.js";

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
    assert.equal(title.source_hash, sha("New private holidays"));
    assert.equal(cta.status, "manual_override");
    assert.equal(cta.override, "Tạo chuyến đi riêng");
    assert.equal(extra.status, "extra");
    assert.equal(state.counts.stale, 1);
    assert.equal(state.counts.manual_override, 1);
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

test("static translation service exposes and edits generated homepage content translations", async () => {
  const repoRoot = await createFixture();
  try {
    let store = {
      destination_scope_destinations: [
        {
          code: "VN",
          label: "Vietnam",
          label_i18n: {
            en: "Vietnam",
            vi: "Việt Nam"
          }
        }
      ],
      destination_areas: [
        {
          id: "area_north",
          destination: "VN",
          code: "north",
          name: "North",
          name_i18n: {
            en: "North",
            vi: "Miền Bắc"
          },
          updated_at: "2026-04-28T00:00:00.000Z"
        }
      ],
      destination_places: []
    };
    let tours = [
      {
        id: "tour_alpha",
        title: {
          en: "Northern Vietnam",
          vi: "Miền Bắc Việt Nam"
        },
        short_description: {
          en: "Da Lat of the North",
          vi: "Đà Lạt của miền Bắc"
        },
        updated_at: "2026-04-28T00:00:00.000Z"
      }
    ];

    const service = createStaticTranslationService({
      repoRoot,
      readStore: async () => JSON.parse(JSON.stringify(store)),
      persistStore: async (nextStore) => {
        store = JSON.parse(JSON.stringify(nextStore));
      },
      readTours: async () => JSON.parse(JSON.stringify(tours)),
      persistTour: async (nextTour) => {
        tours = tours.map((tour) => tour.id === nextTour.id ? JSON.parse(JSON.stringify(nextTour)) : tour);
      },
      nowIso: () => "2026-04-28T01:00:00.000Z"
    });

    const state = await service.getLanguageState("homepage-content", "vi");
    const north = state.rows.find((row) => row.key === "area.area_north.name");
    const tourDescription = state.rows.find((row) => row.key === "tour.tour_alpha.short_description");

    assert.equal(north.source, "North");
    assert.equal(north.override, "Miền Bắc");
    assert.equal(north.status, "content_translation");
    assert.equal(tourDescription.source, "Da Lat of the North");

    const saved = await service.patchOverrides("homepage-content", "vi", {
      expected_revision: state.revision,
      overrides: {
        "area.area_north.name": "Bắc Bộ",
        "tour.tour_alpha.short_description": "Đà Lạt miền Bắc"
      }
    });

    assert.equal(store.destination_areas[0].name_i18n.vi, "Bắc Bộ");
    assert.equal(tours[0].short_description.vi, "Đà Lạt miền Bắc");
    assert.equal(saved.rows.find((row) => row.key === "area.area_north.name").override, "Bắc Bộ");
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
