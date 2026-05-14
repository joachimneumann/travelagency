import test from "node:test";
import assert from "node:assert/strict";
import { createTourVariantHelpers } from "../src/domain/tour_variants.js";
import { createTourHelpers } from "../src/domain/tours_support.js";
import { createTravelPlanHelpers } from "../src/domain/travel_plan.js";

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

test("Tour Variant source-day options exclude unpublished marketing tours", () => {
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
    }
  ];

  const options = tourVariantHelpers.buildSourceDayOptions(tours, { lang: "en" });
  assert.deepEqual(
    options.items.map((item) => `${item.source_tour_id}:${item.source_day_id}`),
    ["tour_public:day_public"]
  );
});
