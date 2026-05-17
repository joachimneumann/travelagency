import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createTourVariantHelpers } from "../src/domain/tour_variants.js";
import { createTourHelpers } from "../src/domain/tours_support.js";
import { createTravelPlanHelpers } from "../src/domain/travel_plan.js";
import { createTourVariantHandlers } from "../src/http/handlers/tour_variants.js";

function safeInt(value) {
  const normalized = Number.parseInt(value, 10);
  return Number.isFinite(normalized) ? normalized : null;
}

const travelPlanHelpers = createTravelPlanHelpers();
const tourHelpers = createTourHelpers({
  toursDir: "/tmp",
  safeInt,
  normalizeMarketingTourTravelPlan: travelPlanHelpers.normalizeMarketingTourTravelPlan
});
const tourVariantHelpers = createTourVariantHelpers({
  safeInt,
  randomUUID: () => "fixed-id",
  normalizeMarketingTourTravelPlan: travelPlanHelpers.normalizeMarketingTourTravelPlan,
  normalizeTourForRead: tourHelpers.normalizeTourForRead,
  normalizeTourForStorage: tourHelpers.normalizeTourForStorage,
  canPublishTourOnWebpage: tourHelpers.canPublishTourOnWebpage
});

test("Tour Variant creation from a base marketing tour keeps the seeded timeline and starts with empty boundary logistics", () => {
  const baseTour = {
    id: "tour_base",
    title: "Northern Vietnam",
    short_description: "A compact northern itinerary.",
    styles: ["culture"],
    priority: 12,
    published_on_webpage: true,
    travel_plan: {
      days: [
        {
          id: "day_hanoi",
          day_number: 1,
          title: "Hanoi arrival",
          primary_location_id: "hanoi",
          services: []
        },
        {
          id: "day_ninh_binh",
          day_number: 2,
          title: "Ninh Binh",
          primary_location_id: "ninh-binh",
          services: []
        }
      ]
    }
  };

  const seeded = tourVariantHelpers.buildTourVariantFromBaseTour(baseTour);
  const stored = tourVariantHelpers.buildTourVariantPayload(
    { base_marketing_tour_id: "tour_base" },
    { existing: seeded, isCreate: true, lang: "en" }
  );

  assert.equal(stored.title, "Northern Vietnam");
  assert.equal(stored.short_description, "A compact northern itinerary.");
  assert.deepEqual(stored.styles, ["culture"]);
  assert.equal(stored.priority, 12);
  assert.equal(stored.base_marketing_tour_id, "tour_base");
  assert.deepEqual(
    stored.days.map((day) => [day.source_tour_id, day.source_day_id]),
    [
      ["tour_base", "day_hanoi"],
      ["tour_base", "day_ninh_binh"]
    ]
  );
  assert.equal(stored.boundary_logistics.arrival.mode, "none");
  assert.equal(stored.boundary_logistics.departure.mode, "none");
});

test("Tour Variant stores explicit web page image order and resolves it into the generated travel plan", () => {
  const baseTour = {
    id: "tour_base",
    title: "Image source tour",
    styles: ["culture"],
    published_on_webpage: true,
    travel_plan: {
      days: [
        {
          id: "day_hanoi",
          day_number: 1,
          title: "Hanoi",
          primary_location_id: "hanoi",
          services: [
            {
              title: "First image",
              image: {
                id: "image_one",
                storage_path: "/public/v1/tour-images/tour_base/one.webp",
                include_in_travel_tour_card: true
              }
            },
            {
              title: "Second image",
              image: {
                id: "image_two",
                storage_path: "/public/v1/tour-images/tour_base/two.webp",
                include_in_travel_tour_card: true
              }
            }
          ]
        }
      ]
    }
  };

  const variant = tourVariantHelpers.buildTourVariantPayload({
    id: "tour_variant_images",
    title: "Image variant",
    styles: ["culture"],
    base_marketing_tour_id: "tour_base",
    days: [
      {
        id: "tour_variant_day_1",
        day_number: 1,
        source_tour_id: "tour_base",
        source_day_id: "day_hanoi"
      }
    ],
    tour_card_image_ids: ["image_two", "image_one"]
  }, {
    existing: {
      boundary_logistics: tourVariantHelpers.emptyBoundaryLogistics(),
      days: []
    },
    lang: "en"
  });

  const resolvedTour = tourVariantHelpers.resolveTourVariantToTour(variant, [baseTour]);

  assert.deepEqual(variant.tour_card_image_ids, ["image_two", "image_one"]);
  assert.equal(variant.tour_card_primary_image_id, "image_two");
  assert.deepEqual(resolvedTour.travel_plan.tour_card_image_ids, ["image_two", "image_one"]);
  assert.equal(resolvedTour.travel_plan.tour_card_primary_image_id, "image_two");
});

test("Tour Variant without stored image ids keeps deriving web page images from source days", () => {
  const baseTour = {
    id: "tour_base",
    title: "Legacy source tour",
    styles: ["culture"],
    published_on_webpage: true,
    travel_plan: {
      days: [
        {
          id: "day_legacy",
          day_number: 1,
          title: "Legacy day",
          primary_location_id: "hanoi",
          services: [
            {
              image: {
                id: "legacy_one",
                storage_path: "/public/v1/tour-images/tour_base/legacy-one.webp",
                include_in_travel_tour_card: true
              }
            },
            {
              image: {
                id: "legacy_two",
                storage_path: "/public/v1/tour-images/tour_base/legacy-two.webp",
                include_in_travel_tour_card: true
              }
            }
          ]
        }
      ]
    }
  };
  const legacyVariant = {
    id: "tour_variant_legacy",
    title: "Legacy variant",
    styles: ["culture"],
    published_on_webpage: true,
    base_marketing_tour_id: "tour_base",
    boundary_logistics: tourVariantHelpers.emptyBoundaryLogistics(),
    days: [
      {
        id: "tour_variant_day_1",
        day_number: 1,
        source_tour_id: "tour_base",
        source_day_id: "day_legacy"
      }
    ]
  };

  const readModel = tourVariantHelpers.buildTourVariantEditorResponse(legacyVariant, [baseTour], { lang: "en" });
  const resolvedTour = tourVariantHelpers.resolveTourVariantToTour(legacyVariant, [baseTour]);

  assert.deepEqual(readModel.tour_card_image_ids, ["legacy_one", "legacy_two"]);
  assert.equal(readModel.tour_card_primary_image_id, "legacy_one");
  assert.deepEqual(resolvedTour.travel_plan.tour_card_image_ids, ["legacy_one", "legacy_two"]);
});

test("Tour Variant source-day options include only published marketing tours", () => {
  const tours = [
    {
      id: "tour_public",
      title: "Public tour",
      styles: ["culture"],
      published_on_webpage: true,
      travel_plan: {
        tour_card_image_ids: ["public_image_1", "public_image_2"],
        days: [
          {
            id: "day_public",
            title: "Published day",
            primary_location_id: "hanoi",
            services: [
              {
                image: {
                  id: "public_image_1",
                  storage_path: "/public/v1/tour-images/tour_public/one.webp",
                  include_in_travel_tour_card: true
                }
              },
              {
                image: {
                  id: "public_image_2",
                  storage_path: "/public/v1/tour-images/tour_public/two.webp",
                  include_in_travel_tour_card: true
                }
              }
            ]
          }
        ]
      }
    },
    {
      id: "tour_unpublished",
      title: "Hidden tour",
      styles: ["culture"],
      published_on_webpage: false,
      travel_plan: {
        days: [
          {
            id: "day_hidden",
            title: "Hidden day",
            services: []
          }
        ]
      }
    },
    {
      id: "tour_variant_public",
      record_type: "tour_variant",
      title: "Published Tour Variant",
      styles: ["culture"],
      published_on_webpage: true,
      base_marketing_tour_id: "tour_public",
      travel_plan: {
        tour_card_image_ids: ["variant_image_1", "variant_image_2"],
        days: [
          {
            id: "day_variant",
            title: "Variant day",
            primary_location_id: "hanoi",
            services: [
              {
                image: {
                  id: "variant_image_1",
                  storage_path: "/public/v1/tour-images/tour_variant_public/one.webp",
                  include_in_travel_tour_card: true
                }
              },
              {
                image: {
                  id: "variant_image_2",
                  storage_path: "/public/v1/tour-images/tour_variant_public/two.webp",
                  include_in_travel_tour_card: true
                }
              }
            ]
          }
        ]
      }
    },
    {
      id: "stored_variant_public",
      title: "Stored Tour Variant",
      styles: ["culture"],
      published_on_webpage: true,
      base_marketing_tour_id: "tour_public",
      travel_plan: {
        tour_card_image_ids: ["stored_variant_image_1", "stored_variant_image_2"],
        days: [
          {
            id: "day_stored_variant",
            title: "Stored variant day",
            primary_location_id: "hanoi",
            services: [
              {
                image: {
                  id: "stored_variant_image_1",
                  storage_path: "/public/v1/tour-images/stored_variant_public/one.webp",
                  include_in_travel_tour_card: true
                }
              },
              {
                image: {
                  id: "stored_variant_image_2",
                  storage_path: "/public/v1/tour-images/stored_variant_public/two.webp",
                  include_in_travel_tour_card: true
                }
              }
            ]
          }
        ]
      }
    }
  ];

  const options = tourVariantHelpers.buildSourceDayOptions(tours, { lang: "en" });
  assert.deepEqual(
    options.items.map((item) => `${item.source_tour_id}:${item.source_day_id}`),
    ["tour_public:day_public"]
  );
});

test("Tour Variant publish blocks invalid published variants before homepage generation", async () => {
  let generated = false;
  const { handlePublishTourVariants } = createTourVariantHandlers({
    normalizeText: (value) => String(value ?? "").trim(),
    safeInt,
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    readBodyJson: async () => ({}),
    sendJson: (res, status, payload) => {
      res.statusCode = status;
      res.payload = payload;
    },
    readTours: async () => [
      {
        id: "tour_base",
        title: "Base tour",
        styles: ["culture"],
        published_on_webpage: true,
        travel_plan: {
          tour_card_image_ids: [
            "travel_plan_service_image_one",
            "travel_plan_service_image_two"
          ],
          days: [
            {
              id: "day_existing",
              title: "Existing day",
              primary_location_id: "hanoi",
              services: [
                {
                  title: "Image one",
                  image: {
                    id: "travel_plan_service_image_one",
                    storage_path: "/public/v1/tour-images/tour_base/one.png",
                    include_in_travel_tour_card: true
                  }
                },
                {
                  title: "Image two",
                  image: {
                    id: "travel_plan_service_image_two",
                    storage_path: "/public/v1/tour-images/tour_base/two.png",
                    include_in_travel_tour_card: true
                  }
                }
              ]
            }
          ]
        }
      }
    ],
    readTourVariants: async () => [
      {
        id: "tour_variant_bad",
        title: "Broken variant",
        styles: ["culture"],
        published_on_webpage: true,
        base_marketing_tour_id: "tour_base",
        boundary_logistics: tourVariantHelpers.emptyBoundaryLogistics(),
        days: [
          {
            id: "tour_variant_day_1",
            day_number: 1,
            source_tour_id: "tour_base",
            source_day_id: "day_missing"
          }
        ]
      }
    ],
    persistTourVariant: async () => {},
    deleteTourVariant: async () => {},
    normalizeTourForStorage: tourHelpers.normalizeTourForStorage,
    normalizeTourForRead: tourHelpers.normalizeTourForRead,
    normalizeMarketingTourTravelPlan: travelPlanHelpers.normalizeMarketingTourTravelPlan,
    collectTourOptions: () => ({}),
    buildPaginatedListResponse: (payload) => payload,
    paginate: (items) => ({ items, total: items.length, page: 1, page_size: items.length }),
    getPrincipal: () => ({ id: "tester" }),
    canReadTourVariants: () => true,
    canEditTourVariants: () => true,
    normalizeTourLang: (value) => String(value || "en").trim().toLowerCase() || "en",
    tourVariantHelpers,
    nowIso: () => "2026-05-15T00:00:00.000Z",
    randomUUID: () => "fixed-id",
    repoRoot: "/tmp/travelagency-test",
    execFile: async () => {
      generated = true;
    },
    path
  });
  const res = {};

  await handlePublishTourVariants({ url: "/api/v1/tour-variants/publish?lang=en" }, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.payload?.code, "TOUR_VARIANTS_PUBLISH_BLOCKED");
  assert.equal(res.payload?.invalid_tour_variants?.[0]?.id, "tour_variant_bad");
  assert.match(res.payload?.invalid_tour_variants?.[0]?.issues?.join(" "), /day_missing/);
  assert.equal(generated, false);
});
