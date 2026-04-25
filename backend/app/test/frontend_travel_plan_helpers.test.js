import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(new URL("../../..", import.meta.url).pathname);
const helperPath = path.join(repoRoot, "frontend", "scripts", "booking", "travel_plan_helpers.js");

async function loadHelpers() {
  global.window = {
    ...(global.window || {}),
    __BOOKING_CONTENT_LANG: "en"
  };
  return await import(`${pathToFileURL(helperPath).href}?test=${Date.now()}`);
}

test("normalizeTravelPlanDraft preserves localized maps while keeping flat source text authoritative", async () => {
  const { normalizeTravelPlanDraft } = await loadHelpers();

  const normalized = normalizeTravelPlanDraft({
    days: [
      {
        id: "day_1",
        title: "English day",
        title_i18n: {
          vi: "Ngay tieng Viet",
          de: "Deutscher Tag"
        },
        overnight_location: "Hanoi",
        overnight_location_i18n: {
          vi: "Ha Noi"
        },
        notes: "English notes",
        notes_i18n: {
          vi: "Ghi chu"
        },
        services: [
          {
            id: "service_1",
            timing_kind: "label",
            time_label: "Morning",
            time_label_i18n: {
              vi: "Buoi sang"
            },
            kind: "other",
            title: "English service",
            title_i18n: {
              vi: "Dich vu"
            },
            details: "English details",
            details_i18n: {
              vi: "Chi tiet"
            },
            image_subtitle: "English subtitle",
            image_subtitle_i18n: {
              vi: "Phu de"
            },
            image: {
              id: "image_1",
              storage_path: "/tmp/service.webp",
              caption: "English caption",
              caption_i18n: {
                vi: "Chu thich"
              },
              alt_text: "English alt text",
              alt_text_i18n: {
                vi: "Van ban thay the"
              }
            },
            location: "Old Quarter",
            location_i18n: {
              vi: "Pho co"
            }
          }
        ]
      }
    ],
    translation_meta: {
      vi: {
        source_lang: "en",
        source_hash: "hash_1",
        origin: "machine",
        updated_at: "2026-04-25T10:00:00.000Z",
        manual_keys: ["travel_plan.day_1.title", "travel_plan.day_1.title"]
      }
    }
  }, {
    sourceLang: "en",
    targetLang: "en"
  });

  const day = normalized.days[0];
  const service = day.services[0];
  assert.equal(day.title, "English day");
  assert.deepEqual(day.title_i18n, {
    vi: "Ngay tieng Viet",
    de: "Deutscher Tag",
    en: "English day"
  });
  assert.equal(day.overnight_location, "Hanoi");
  assert.deepEqual(day.overnight_location_i18n, {
    vi: "Ha Noi",
    en: "Hanoi"
  });
  assert.equal(day.notes, "English notes");
  assert.deepEqual(day.notes_i18n, {
    vi: "Ghi chu",
    en: "English notes"
  });
  assert.equal(service.time_label, "Morning");
  assert.deepEqual(service.time_label_i18n, {
    vi: "Buoi sang",
    en: "Morning"
  });
  assert.equal(service.title, "English service");
  assert.deepEqual(service.title_i18n, {
    vi: "Dich vu",
    en: "English service"
  });
  assert.equal(service.details, "English details");
  assert.deepEqual(service.details_i18n, {
    vi: "Chi tiet",
    en: "English details"
  });
  assert.equal(service.image_subtitle, "English subtitle");
  assert.deepEqual(service.image_subtitle_i18n, {
    vi: "Phu de",
    en: "English subtitle"
  });
  assert.equal(service.image.caption, "English caption");
  assert.deepEqual(service.image.caption_i18n, {
    vi: "Chu thich",
    en: "English caption"
  });
  assert.equal(service.image.alt_text, "English alt text");
  assert.deepEqual(service.image.alt_text_i18n, {
    vi: "Van ban thay the",
    en: "English alt text"
  });
  assert.equal(service.location, "Old Quarter");
  assert.deepEqual(service.location_i18n, {
    vi: "Pho co",
    en: "Old Quarter"
  });
  assert.deepEqual(normalized.translation_meta, {
    vi: {
      source_lang: "en",
      source_hash: "hash_1",
      origin: "machine",
      updated_at: "2026-04-25T10:00:00.000Z",
      manual_keys: ["travel_plan.day_1.title"]
    }
  });
});

test("normalizeTravelPlanDraft does not restore a cleared source field from translations", async () => {
  const { normalizeTravelPlanDraft } = await loadHelpers();

  const normalized = normalizeTravelPlanDraft({
    days: [
      {
        id: "day_1",
        title: "",
        title_i18n: {
          vi: "Ngay tieng Viet"
        },
        services: [
          {
            id: "service_1",
            timing_kind: "label",
            kind: "other",
            title: "",
            title_i18n: {
              vi: "Dich vu"
            }
          }
        ]
      }
    ]
  }, {
    sourceLang: "en",
    targetLang: "en"
  });

  assert.equal(normalized.days[0].title, "");
  assert.deepEqual(normalized.days[0].title_i18n, {
    vi: "Ngay tieng Viet"
  });
  assert.equal(normalized.days[0].services[0].title, "");
  assert.deepEqual(normalized.days[0].services[0].title_i18n, {
    vi: "Dich vu"
  });
});
