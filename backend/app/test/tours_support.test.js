import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createTourHelpers, migratePersistedTourState } from "../src/domain/tours_support.js";

function safeInt(value) {
  const normalized = Number.parseInt(value, 10);
  return Number.isFinite(normalized) ? normalized : null;
}

function safeFloat(value) {
  const normalized = Number.parseFloat(value);
  return Number.isFinite(normalized) ? normalized : null;
}

const helpers = createTourHelpers({
  toursDir: "/tmp",
  safeInt,
  safeFloat
});

test("tour admin options can include catalog travel styles that no tour uses yet", () => {
  const tours = [
    {
      id: "tour_1",
      title: "Culture trip",
      destinations: ["vietnam"],
      styles: ["culture"]
    }
  ];

  const usedOnlyOptions = helpers.collectTourOptions(tours, { lang: "en" });
  assert.deepEqual(
    usedOnlyOptions.styles.map((option) => option.code),
    ["culture"]
  );

  const adminOptions = helpers.collectTourOptions(tours, {
    lang: "en",
    includeAllStyleCatalogEntries: true
  });
  assert.ok(
    adminOptions.styles.some((option) => option.code === "wellness" && option.label === "Wellness"),
    "Admin tour options should expose catalog styles even before any tour uses them"
  );
});

test("tour helpers resolve localized titles with vietnamese then english fallback", () => {
  const viTour = helpers.normalizeTourForRead(
    {
      id: "tour_1",
      title: {
        en: "English title",
        vi: "Tieu de tieng Viet"
      },
      short_description: {
        en: "English description"
      },
      destinations: ["vietnam"],
      styles: ["culture"]
    },
    { lang: "vi" }
  );

  assert.equal(viTour.title, "Tieu de tieng Viet");

  const fallbackTour = helpers.normalizeTourForRead(
    {
      id: "tour_2",
      title: {
        en: "English title only"
      },
      destinations: ["vietnam"],
      styles: ["culture"]
    },
    { lang: "vi" }
  );

  assert.equal(fallbackTour.title, "English title only");
});

test("tour helpers keep video metadata at the tour root and strip legacy travel plan video", () => {
  const legacyVideo = {
    storage_path: "/api/v1/tours/tour_1/video",
    title: "custom-video.mp4"
  };
  const persistedTour = {
    id: "tour_1",
    title: "Legacy video",
    destinations: ["vietnam"],
    styles: ["culture"],
    travel_plan: {
      video: legacyVideo,
      days: []
    }
  };

  assert.equal(migratePersistedTourState(persistedTour), true);
  assert.deepEqual(persistedTour.video, legacyVideo);
  assert.equal("video" in persistedTour.travel_plan, false);

  const normalized = helpers.normalizeTourForStorage({
    id: "tour_1",
    title: "Legacy video",
    destinations: ["vietnam"],
    styles: ["culture"],
    travel_plan: {
      video: legacyVideo,
      days: []
    }
  });
  assert.deepEqual(normalized.video, legacyVideo);
  assert.equal("video" in normalized.travel_plan, false);

  const deleted = helpers.normalizeTourForStorage({
    ...normalized,
    video: null,
    travel_plan: {
      ...normalized.travel_plan,
      video: legacyVideo
    }
  });
  assert.equal("video" in deleted, false);
  assert.equal("video" in deleted.travel_plan, false);
});

test("tour helpers scope legacy bare tour picture filenames under the tour folder", () => {
  const normalized = helpers.normalizeTourForStorage({
    id: "tour_legacy",
    title: "Legacy picture",
    destinations: ["vietnam"],
    styles: ["culture"],
    image: "tour_legacy.webp?v=old",
    pictures: ["tour_legacy.webp?v=old"]
  });

  assert.deepEqual(normalized.pictures, [
    "/public/v1/tour-images/tour_legacy/tour_legacy.webp?v=old"
  ]);
  assert.equal(normalized.image, "/public/v1/tour-images/tour_legacy/tour_legacy.webp?v=old");

  const normalizedPublicPrefix = helpers.normalizeTourForStorage({
    id: "tour_legacy",
    title: "Legacy public picture",
    destinations: ["vietnam"],
    styles: ["culture"],
    pictures: ["/public/v1/tour-images/tour_legacy.webp"]
  });

  assert.deepEqual(normalizedPublicPrefix.pictures, [
    "/public/v1/tour-images/tour_legacy/tour_legacy.webp"
  ]);
  assert.equal(
    helpers.resolveTourImageDiskPath("tour_legacy.webp"),
    path.join("/tmp", "tour_legacy", "tour_legacy.webp")
  );
});
