import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createTourHandlers } from "../src/http/handlers/tours.js";
import { createTravelPlanHelpers } from "../src/domain/travel_plan.js";
import { createTourHelpers } from "../src/domain/tours_support.js";
import {
  normalizeTourDestinationCode,
  normalizeTourLang,
  normalizeTourStyleCode
} from "../src/domain/tour_catalog_i18n.js";
import {
  applyMarketingTourTranslations,
  loadPublishedMarketingTourTranslations
} from "../src/domain/marketing_tour_translations.js";
import { normalizeStringArray } from "../src/lib/collection_utils.js";
import { normalizeText } from "../src/lib/text.js";

function safeInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function createSampleTour() {
  return {
    id: "tour_test",
    title: "English tour title",
    title_i18n: {
      fr: "Embedded French tour title"
    },
    short_description: "English tour description",
    short_description_i18n: {
      fr: "Embedded French tour description"
    },
    styles: ["beach"],
    priority: 10,
    published_on_webpage: true,
    updated_at: "2026-05-08T00:00:00.000Z",
    travel_plan: {
      destination_scope: [{ destination: "VN", areas: [] }],
      tour_card_image_ids: ["image_1", "image_2"],
      days: [{
        id: "day_1",
        day_number: 1,
        title: "English day title",
        title_i18n: {
          fr: "Embedded French day title"
        },
        services: [{
          id: "service_1",
          kind: "other",
          timing_kind: "label",
          time_label: "Morning",
          title: "English service title",
          title_i18n: {
            fr: "Embedded French service title"
          },
          details: "English service details",
          image: {
            id: "image_1",
            storage_path: "tour_test/image.webp",
            is_primary: true,
            is_customer_visible: true
          }
        }]
      }]
    }
  };
}

test("marketing tour translation overlay applies manual overrides over content translations and strips embedded fallback", async () => {
  const translationsRoot = await mkdtemp(path.join(os.tmpdir(), "marketing-tour-translations-"));
  const customersDir = path.join(translationsRoot, "customers");
  const manualOverridesPath = path.join(translationsRoot, "..", "config", "i18n", "translation_manual_overrides.json");
  await mkdir(customersDir, { recursive: true });
  await mkdir(path.dirname(manualOverridesPath), { recursive: true });
  await writeFile(path.join(customersDir, "marketing-tours.fr.json"), JSON.stringify({
    items: [
      { source_text: "English tour title", target_text: "Published French tour title" },
      { source_text: "English service title", target_text: "Published French service title" }
    ]
  }, null, 2), "utf8");
  await writeFile(manualOverridesPath, JSON.stringify({
    schema: "translation-manual-overrides/v2",
    schema_version: 2,
    items: [
      { source_text: "English tour title", target_lang: "fr", manual_override: "Manual French tour title" }
    ]
  }, null, 2), "utf8");

  const published = await loadPublishedMarketingTourTranslations(translationsRoot, ["fr"], { manualOverridesPath });
  const original = createSampleTour();
  const localized = applyMarketingTourTranslations(original, "fr", published.get("fr"));

  assert.equal(localized.title_i18n.fr, "Manual French tour title");
  assert.equal(localized.short_description_i18n, undefined);
  assert.equal(localized.travel_plan.days[0].title_i18n, undefined);
  assert.equal(localized.travel_plan.days[0].services[0].title_i18n.fr, "Published French service title");
  assert.equal(original.title_i18n.fr, "Embedded French tour title");
});

test("marketing tour translation overlay strips embedded translations for English reads", () => {
  const original = createSampleTour();
  const localized = applyMarketingTourTranslations(original, "en", new Map());

  assert.equal(localized.title_i18n, undefined);
  assert.equal(localized.short_description_i18n, undefined);
  assert.equal(localized.travel_plan.days[0].title_i18n, undefined);
  assert.equal(localized.travel_plan.days[0].services[0].title_i18n, undefined);
  assert.equal(original.title_i18n.fr, "Embedded French tour title");
});

test("tour API applies marketing tour manual overrides over content translations", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "marketing-tour-handler-"));
  const translationsRoot = path.join(repoRoot, "content", "translations");
  const customersDir = path.join(translationsRoot, "customers");
  const manualOverridesPath = path.join(repoRoot, "config", "i18n", "translation_manual_overrides.json");
  await mkdir(customersDir, { recursive: true });
  await mkdir(path.dirname(manualOverridesPath), { recursive: true });
  await writeFile(path.join(customersDir, "marketing-tours.fr.json"), JSON.stringify({
    items: [
      { source_text: "English tour title", target_text: "Published French tour title" },
      { source_text: "English service title", target_text: "Published French service title" }
    ]
  }, null, 2), "utf8");
  await writeFile(manualOverridesPath, JSON.stringify({
    schema: "translation-manual-overrides/v2",
    schema_version: 2,
    items: [
      { source_text: "English tour title", target_lang: "fr", manual_override: "Manual French tour title" }
    ]
  }, null, 2), "utf8");

  const travelPlanHelpers = createTravelPlanHelpers();
  const tourHelpers = createTourHelpers({
    toursDir: path.join(repoRoot, "content", "tours"),
    safeInt,
    normalizeMarketingTourTravelPlan: travelPlanHelpers.normalizeMarketingTourTravelPlan
  });
  const responses = [];
  const handlers = createTourHandlers({
    normalizeText,
    normalizeStringArray,
    safeInt,
    tourDestinationCodes: tourHelpers.tourDestinationCodes,
    tourStyleCodes: tourHelpers.tourStyleCodes,
    readStore: async () => ({ bookings: [] }),
    readTours: async () => [createSampleTour()],
    persistStore: async () => {},
    sendJson: (_res, status, body, headers = {}) => {
      responses.push({ status, body, headers });
    },
    clamp,
    normalizeTourForRead: tourHelpers.normalizeTourForRead,
    normalizeTourForStorage: tourHelpers.normalizeTourForStorage,
    normalizeTourTravelPlan: tourHelpers.normalizeTourTravelPlan,
    normalizeMarketingTourTravelPlan: travelPlanHelpers.normalizeMarketingTourTravelPlan,
    validateMarketingTourTravelPlanInput: travelPlanHelpers.validateMarketingTourTravelPlanInput,
    validateBookingTravelPlanInput: travelPlanHelpers.validateBookingTravelPlanInput,
    resolveLocalizedText: tourHelpers.resolveLocalizedText,
    setLocalizedTextForLang: tourHelpers.setLocalizedTextForLang,
    translateEntries: async () => ({}),
    translateEntriesWithMeta: async () => ({ entries: {} }),
    translationMemoryStore: {
      readTranslationMemory: async () => ({
        items: {
          description: {
            source_text: "English tour description",
            targets: {
              fr: {
                machine: "Memory French tour description"
              }
            }
          }
        }
      })
    },
    normalizeTourLang,
    normalizeTourDestinationCode,
    normalizeTourStyleCode,
    getPrincipal: () => ({ sub: "tester" }),
    canReadTours: () => true,
    paginate: (items) => ({
      items,
      page: 1,
      page_size: items.length,
      total_items: items.length,
      total_pages: 1
    }),
    collectTourOptions: tourHelpers.collectTourOptions,
    buildPaginatedListResponse: (paged, meta) => ({ ...paged, ...meta }),
    canEditTours: () => false,
    canEditBooking: () => false,
    assertExpectedRevision: async () => true,
    buildBookingDetailResponse: async (booking) => booking,
    incrementBookingRevision: () => {},
    addActivity: () => {},
    actorLabel: () => "Tester",
    readBodyJson: async () => ({}),
    readCountryPracticalInfo: async () => ({ items: [] }),
    nowIso: () => "2026-05-08T00:00:00.000Z",
    randomUUID: () => "uuid",
    persistTour: async () => {},
    repoRoot,
    resolveTourImageDiskPath: () => null,
    writeMarketingTourOnePagerPdf: async () => ({ outputPath: "" }),
    sendFileWithCache: async () => {},
    mkdir: async () => {},
    path,
    execFile: async () => {},
    TEMP_UPLOAD_DIR: path.join(repoRoot, "tmp"),
    TOURS_DIR: path.join(repoRoot, "content", "tours"),
    TRANSLATIONS_SNAPSHOT_DIR: translationsRoot,
    TRANSLATION_MANUAL_OVERRIDES_PATH: manualOverridesPath,
    BOOKING_IMAGES_DIR: path.join(repoRoot, "booking-images"),
    writeFile: async () => {},
    rm: async () => {}
  });

  await handlers.handleListTours({ url: "/api/v1/tours?lang=fr" }, {});
  assert.equal(responses[0].status, 200);
  assert.equal(responses[0].body.items[0].title, "Manual French tour title");
  assert.equal(responses[0].body.items[0].short_description, "English tour description");

  await handlers.handleSearchTourTravelPlanServices({ url: "/api/v1/tours/travel-plan-services/search?lang=fr&q=published" }, {});
  assert.equal(responses[1].status, 200);
  assert.equal(responses[1].body.items[0].title, "Published French service title");

  await handlers.handleSearchTourTravelPlanDays({ url: "/api/v1/tours/travel-plan-days/search?lang=fr&q=embedded" }, {});
  assert.equal(responses[2].status, 200);
  assert.equal(responses[2].body.items.length, 0);
});
