import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createTourHandlers } from "../src/http/handlers/tours.js";
import { createTravelPlanHelpers } from "../src/domain/travel_plan.js";
import { createTourHelpers } from "../src/domain/tours_support.js";
import { createTourVariantHelpers } from "../src/domain/tour_variants.js";
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
          time: "Morning",
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

test("marketing tour translation overlay applies phrase overrides over content translations and strips embedded fallback", async () => {
  const translationsRoot = await mkdtemp(path.join(os.tmpdir(), "marketing-tour-translations-"));
  const customersDir = path.join(translationsRoot, "customers");
  const phraseOverridesPath = path.join(translationsRoot, "..", "config", "i18n", "translation_phrase_overrides.json");
  await mkdir(customersDir, { recursive: true });
  await mkdir(path.dirname(phraseOverridesPath), { recursive: true });
  await writeFile(path.join(customersDir, "marketing-tours.fr.json"), JSON.stringify({
    items: [
      { source_text: "English tour title", target_text: "Published French tour title" },
      { source_text: "English service title", target_text: "Published French service title" }
    ]
  }, null, 2), "utf8");
  await writeFile(phraseOverridesPath, JSON.stringify({
    schema: "translation-phrase-overrides/v1",
    schema_version: 1,
    items: [
      { source_phrase: "English tour title", target_lang: "fr", target_phrase: "Phrase French tour title" }
    ]
  }, null, 2), "utf8");

  const published = await loadPublishedMarketingTourTranslations(translationsRoot, ["fr"], { phraseOverridesPath });
  const original = createSampleTour();
  const localized = applyMarketingTourTranslations(original, "fr", published.get("fr"));

  assert.equal(localized.title, "Phrase French tour title");
  assert.equal(localized.title_i18n, undefined);
  assert.equal(localized.short_description_i18n, undefined);
  assert.equal(localized.travel_plan.days[0].title_i18n, undefined);
  assert.equal(localized.travel_plan.days[0].services[0].title, "Published French service title");
  assert.equal(localized.travel_plan.days[0].services[0].title_i18n, undefined);
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

test("tour API applies marketing tour phrase overrides over content translations", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "marketing-tour-handler-"));
  const translationsRoot = path.join(repoRoot, "content", "translations");
  const customersDir = path.join(translationsRoot, "customers");
  const phraseOverridesPath = path.join(repoRoot, "config", "i18n", "translation_phrase_overrides.json");
  await mkdir(customersDir, { recursive: true });
  await mkdir(path.dirname(phraseOverridesPath), { recursive: true });
  await writeFile(path.join(customersDir, "marketing-tours.fr.json"), JSON.stringify({
    items: [
      { source_text: "English tour title", target_text: "Published French tour title" },
      { source_text: "English service title", target_text: "Published French service title" }
    ]
  }, null, 2), "utf8");
  await writeFile(phraseOverridesPath, JSON.stringify({
    schema: "translation-phrase-overrides/v1",
    schema_version: 1,
    items: [
      { source_phrase: "English tour title", target_lang: "fr", target_phrase: "Phrase French tour title" }
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
    TRANSLATION_PHRASE_OVERRIDES_PATH: phraseOverridesPath,
    BOOKING_IMAGES_DIR: path.join(repoRoot, "booking-images"),
    writeFile: async () => {},
    rm: async () => {}
  });

  await handlers.handleListTours({ url: "/api/v1/tours?lang=fr" }, {});
  assert.equal(responses[0].status, 200);
  assert.equal(responses[0].body.items[0].title, "Phrase French tour title");
  assert.equal(responses[0].body.items[0].short_description, "English tour description");

  await handlers.handleSearchTourTravelPlanServices({ url: "/api/v1/tours/travel-plan-services/search?lang=fr&q=published" }, {});
  assert.equal(responses[1].status, 200);
  assert.equal(responses[1].body.items[0].title, "Published French service title");

  await handlers.handleSearchTourTravelPlanDays({ url: "/api/v1/tours/travel-plan-days/search?lang=fr&q=embedded" }, {});
  assert.equal(responses[2].status, 200);
  assert.equal(responses[2].body.items.length, 0);
});

test("public one-pager PDF route renders published Tour Variants without requiring destination catalog lookup", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "tour-variant-one-pager-"));
  const cacheDir = path.join(repoRoot, "cache");
  const travelPlanHelpers = createTravelPlanHelpers();
  const tourHelpers = createTourHelpers({
    toursDir: path.join(repoRoot, "content", "tours"),
    safeInt,
    normalizeMarketingTourTravelPlan: travelPlanHelpers.normalizeMarketingTourTravelPlan
  });
  const tourVariantHelpers = createTourVariantHelpers({
    safeInt,
    randomUUID: () => "uuid",
    normalizeMarketingTourTravelPlan: travelPlanHelpers.normalizeMarketingTourTravelPlan,
    normalizeTourForRead: tourHelpers.normalizeTourForRead,
    normalizeTourForStorage: tourHelpers.normalizeTourForStorage,
    canPublishTourOnWebpage: tourHelpers.canPublishTourOnWebpage
  });
  const sourceTour = {
    id: "tour_source",
    title: "Source tour",
    short_description: "Source description",
    styles: ["beach"],
    published_on_webpage: true,
    travel_plan: {
      days: [{
        id: "day_source",
        day_number: 1,
        title: "Source day",
        primary_location_id: "place_not_in_empty_catalog",
        services: [
          {
            id: "service_1",
            title: "First service",
            image: {
              id: "image_1",
              storage_path: "tour_source/one.webp",
              include_in_travel_tour_card: true,
              is_customer_visible: true
            }
          },
          {
            id: "service_2",
            title: "Second service",
            image: {
              id: "image_2",
              storage_path: "tour_source/two.webp",
              include_in_travel_tour_card: true,
              is_customer_visible: true
            }
          }
        ]
      }]
    }
  };
  const tourVariant = {
    id: "tour_variant_public",
    title: "Variant tour",
    short_description: "Variant description",
    styles: ["beach"],
    published_on_webpage: true,
    base_marketing_tour_id: "tour_source",
    days: [{
      id: "variant_day_1",
      source_tour_id: "tour_source",
      source_day_id: "day_source"
    }]
  };
  const responses = [];
  let renderedTour = null;
  let sentFile = null;
  const handlers = createTourHandlers({
    normalizeText,
    normalizeStringArray,
    safeInt,
    tourDestinationCodes: tourHelpers.tourDestinationCodes,
    tourStyleCodes: tourHelpers.tourStyleCodes,
    readStore: async () => ({}),
    readTours: async () => [sourceTour],
    readTourVariants: async () => [tourVariant],
    persistStore: async () => {},
    sendJson: (_res, status, body, headers = {}) => {
      responses.push({ status, body, headers });
    },
    clamp,
    normalizeTourForRead: tourHelpers.normalizeTourForRead,
    normalizeTourForStorage: tourHelpers.normalizeTourForStorage,
    normalizeTourTravelPlan: tourHelpers.normalizeTourTravelPlan,
    normalizeMarketingTourTravelPlan: travelPlanHelpers.normalizeMarketingTourTravelPlan,
    tourVariantHelpers,
    validateMarketingTourTravelPlanInput: travelPlanHelpers.validateMarketingTourTravelPlanInput,
    validateBookingTravelPlanInput: travelPlanHelpers.validateBookingTravelPlanInput,
    resolveLocalizedText: tourHelpers.resolveLocalizedText,
    setLocalizedTextForLang: tourHelpers.setLocalizedTextForLang,
    translateEntries: async () => ({}),
    translateEntriesWithMeta: async () => ({ entries: {} }),
    translationMemoryStore: { readTranslationMemory: async () => ({ items: {} }) },
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
    nowIso: () => "2026-05-15T00:00:00.000Z",
    randomUUID: () => "uuid",
    persistTour: async () => {},
    repoRoot,
    resolveTourImageDiskPath: () => null,
    writeMarketingTourOnePagerPdf: async (tour, { outputPath }) => {
      renderedTour = tour;
      await writeFile(outputPath, "%PDF-1.3\n", "utf8");
      return { outputPath };
    },
    sendFileWithCache: async (_req, _res, filePath, cacheControl, headers = {}) => {
      sentFile = { filePath, cacheControl, headers };
    },
    mkdir,
    path,
    execFile: async () => {},
    TEMP_UPLOAD_DIR: path.join(repoRoot, "tmp"),
    PUBLIC_TOUR_ONE_PAGER_PDF_CACHE_DIR: cacheDir,
    TOURS_DIR: path.join(repoRoot, "content", "tours"),
    TRANSLATIONS_SNAPSHOT_DIR: path.join(repoRoot, "content", "translations"),
    TRANSLATION_PHRASE_OVERRIDES_PATH: path.join(repoRoot, "config", "i18n", "translation_phrase_overrides.json"),
    BOOKING_IMAGES_DIR: path.join(repoRoot, "booking-images"),
    writeFile,
    rm
  });

  await handlers.handleGetPublicTourOnePagerPdf(
    { url: "/public/v1/tours/tour_variant_public/one-pager.pdf?lang=en" },
    {},
    ["tour_variant_public"]
  );

  assert.deepEqual(responses, []);
  assert.equal(renderedTour?.id, "tour_variant_public");
  assert.equal(renderedTour?.title, "Variant tour");
  assert.equal(renderedTour?.travel_plan?.days?.length, 1);
  assert.equal(sentFile?.headers?.["Content-Disposition"], 'inline; filename="variant-tour-one-pager.pdf"');
});
