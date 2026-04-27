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

test("tour helpers derive destinations from scope and omit legacy destination storage", () => {
  const legacyOnly = helpers.normalizeTourForStorage({
    id: "tour_legacy_destinations",
    title: "Legacy destinations",
    destinations: ["vietnam"],
    styles: ["culture"],
    travel_plan: {
      days: []
    }
  });

  assert.equal("destinations" in legacyOnly, false);
  assert.deepEqual(helpers.tourDestinationCodes(legacyOnly), []);
  assert.deepEqual(helpers.normalizeTourForRead(legacyOnly).destination_codes, []);

  const scoped = helpers.normalizeTourForStorage({
    id: "tour_scoped_destinations",
    title: "Scoped destinations",
    destinations: ["thailand"],
    styles: ["culture"],
    travel_plan: {
      destination_scope: [
        { destination: "VN", areas: [] }
      ],
      days: []
    }
  });

  assert.equal("destinations" in scoped, false);
  assert.equal("destinations" in scoped.travel_plan, false);
  assert.deepEqual(helpers.tourDestinationCodes(scoped), ["vietnam"]);
  assert.deepEqual(helpers.normalizeTourForRead(scoped).destination_codes, ["vietnam"]);
  assert.deepEqual(helpers.normalizeTourForRead(scoped).travel_plan.destinations, ["VN"]);
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

test("tour helpers remove legacy tour-level picture storage", () => {
  const normalized = helpers.normalizeTourForStorage({
    id: "tour_legacy",
    title: "Legacy picture",
    destinations: ["vietnam"],
    styles: ["culture"],
    image: "tour_legacy.webp?v=old",
    pictures: ["tour_legacy.webp?v=old"],
    travel_plan: {
      destination_scope: [{ destination: "VN", areas: [] }],
      days: [
        {
          services: [
            {
              id: "service_1",
              title: "Service",
              image: {
                id: "image_1",
                storage_path: "/public/v1/tour-images/tour_legacy/travel-plan-services/service.webp",
                include_in_travel_tour_card: true
              }
            }
          ]
        }
      ]
    }
  });

  assert.equal("image" in normalized, false);
  assert.equal("pictures" in normalized, false);
  assert.equal(
    normalized.travel_plan.days[0].services[0].image.include_in_travel_tour_card,
    true
  );

  const readModel = helpers.normalizeTourForRead(normalized);
  assert.equal("image" in readModel, false);
  assert.equal("pictures" in readModel, false);
  assert.equal(
    readModel.travel_plan.days[0].services[0].image.include_in_travel_tour_card,
    true
  );
  assert.equal(
    helpers.resolveTourImageDiskPath("tour_legacy.webp"),
    path.join("/tmp", "tour_legacy", "tour_legacy.webp")
  );
});

test("tour migration removes legacy image and pictures", () => {
  const persistedTour = {
    id: "tour_legacy_image",
    title: "Legacy image",
    destinations: ["vietnam"],
    styles: ["culture"],
    image: "legacy.webp",
    pictures: ["legacy.webp"]
  };

  assert.equal(migratePersistedTourState(persistedTour), true);
  assert.equal("pictures" in persistedTour, false);
  assert.equal("image" in persistedTour, false);
});
