import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createTourHandlers } from "../src/http/handlers/tours.js";
import { createTravelPlanHelpers } from "../src/domain/travel_plan.js";
import { createTourHelpers } from "../src/domain/tours_support.js";
import {
  normalizeTourDestinationCode,
  normalizeTourLang,
  normalizeTourStyleCode
} from "../src/domain/tour_catalog_i18n.js";
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

function sampleTour() {
  return {
    id: "tour_alpha",
    title: "Alpha Tour",
    short_description: "Alpha description",
    styles: ["classic"],
    published_on_webpage: true,
    destinations: ["vietnam"],
    travel_plan: {
      tour_card_image_ids: ["image_1", "image_2"],
      days: [
        {
          id: "day_1",
          day_number: 1,
          primary_location_id: "place_hoi_an",
          title: "Arrival day",
          services: [
            {
              id: "service_1",
              title: "Welcome",
              image: {
                id: "image_1",
                storage_path: "/public/v1/tour-images/tour_alpha/image-1.webp",
                is_customer_visible: true
              }
            },
            {
              id: "service_2",
              title: "Walk",
              image: {
                id: "image_2",
                storage_path: "/public/v1/tour-images/tour_alpha/image-2.webp",
                is_customer_visible: true
              }
            }
          ]
        }
      ]
    }
  };
}

function createTestTourHandlers({
  repoRoot,
  tours = [sampleTour()],
  readBodyJson = async () => ({}),
  writeTravelPlanPdf = async (_booking, _travelPlan, { outputPath }) => {
    await writeFile(outputPath, "%PDF-1.3\n", "utf8");
    return { outputPath };
  },
  writeMarketingTourOnePagerPdf = async (_tour, { outputPath }) => {
    await writeFile(outputPath, "%PDF-1.3\n", "utf8");
    return { outputPath };
  },
  sendJson = () => {},
  sendFileWithCache = async () => {}
}) {
  const travelPlanHelpers = createTravelPlanHelpers();
  const tourHelpers = createTourHelpers({
    toursDir: path.join(repoRoot, "content", "tours"),
    safeInt,
    normalizeMarketingTourTravelPlan: travelPlanHelpers.normalizeMarketingTourTravelPlan
  });

  return createTourHandlers({
    normalizeText,
    normalizeStringArray,
    safeInt,
    tourDestinationCodes: tourHelpers.tourDestinationCodes,
    tourStyleCodes: tourHelpers.tourStyleCodes,
    readStore: async () => ({ items: [] }),
    readTours: async () => tours,
    readTourVariants: async () => [],
    persistStore: async () => {},
    sendJson,
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
    canEditTours: () => true,
    canEditBooking: () => false,
    assertExpectedRevision: async () => true,
    buildBookingDetailResponse: async (booking) => booking,
    incrementBookingRevision: () => {},
    addActivity: () => {},
    actorLabel: () => "Tester",
    readBodyJson,
    readCountryPracticalInfo: async () => ({ items: [] }),
    nowIso: () => "2026-05-17T00:00:00.000Z",
    randomUUID: () => "uuid",
    persistTour: async () => {},
    repoRoot,
    resolveTourImageDiskPath: () => "",
    writeTravelPlanPdf,
    writeMarketingTourOnePagerPdf,
    sendFileWithCache,
    mkdir,
    path,
    execFile: async () => {},
    TEMP_UPLOAD_DIR: path.join(repoRoot, "tmp"),
    PUBLIC_TOUR_PDF_CACHE_DIR: path.join(repoRoot, "tmp", "public-tour-pdf-cache"),
    TOURS_DIR: path.join(repoRoot, "content", "tours"),
    TRANSLATIONS_SNAPSHOT_DIR: path.join(repoRoot, "content", "translations"),
    TRANSLATION_PHRASE_OVERRIDES_PATH: path.join(repoRoot, "config", "i18n", "translation_phrase_overrides.json"),
    BOOKING_IMAGES_DIR: path.join(repoRoot, "booking-images"),
    writeFile,
    rm
  });
}

test("regular tour travel-plan PDFs are written once and reused from cache", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "public-tour-pdf-cache-"));
  const sentFiles = [];
  let renderCount = 0;
  const handlers = createTestTourHandlers({
    repoRoot,
    writeTravelPlanPdf: async (_booking, _travelPlan, { outputPath }) => {
      renderCount += 1;
      await writeFile(outputPath, `%PDF-${renderCount}\n`, "utf8");
      return { outputPath };
    },
    sendFileWithCache: async (_req, _res, filePath, cacheControl, headers = {}) => {
      sentFiles.push({ filePath, cacheControl, headers });
    }
  });

  await handlers.handleGetTourTravelPlanPdf(
    { url: "/api/v1/tours/tour_alpha/travel-plan.pdf?lang=en" },
    {},
    ["tour_alpha"]
  );
  await handlers.handleGetTourTravelPlanPdf(
    { url: "/api/v1/tours/tour_alpha/travel-plan.pdf?lang=en" },
    {},
    ["tour_alpha"]
  );

  assert.equal(renderCount, 1);
  assert.equal(sentFiles.length, 2);
  assert.equal(sentFiles[0].filePath, sentFiles[1].filePath);
  assert.match(sentFiles[0].filePath, /public-tour-pdf-cache\/travel-plans\/[a-f0-9]{40}\.pdf$/);
  assert.equal(sentFiles[0].headers["Content-Disposition"], 'inline; filename="alpha-tour-travel-plan.pdf"');
});

test("uncustomized public PDF preview requests return regular cached PDF URLs", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "public-tour-pdf-preview-"));
  const responses = [];
  const handlers = createTestTourHandlers({
    repoRoot,
    readBodyJson: async () => ({
      lang: "en",
      selected_days: [
        { source_tour_id: "tour_alpha", source_day_id: "day_1" }
      ]
    }),
    sendJson: (_res, status, body, headers = {}) => {
      responses.push({ status, body, headers });
    }
  });

  await handlers.handlePostPublicTourOnePagerPreview(
    { url: "/public/v1/tours/tour_alpha/one-pager-preview" },
    {},
    ["tour_alpha"]
  );
  await handlers.handlePostPublicTourTravelPlanPreview(
    { url: "/public/v1/tours/tour_alpha/travel-plan-preview" },
    {},
    ["tour_alpha"]
  );

  assert.equal(responses[0].status, 200);
  assert.deepEqual(responses[0].body, {
    pdf_url: "/public/v1/tours/tour_alpha/one-pager.pdf?lang=en"
  });
  assert.equal(responses[1].status, 200);
  assert.deepEqual(responses[1].body, {
    pdf_url: "/public/v1/tours/tour_alpha/travel-plan.pdf?lang=en"
  });
});
