import test from "node:test";
import assert from "node:assert/strict";
import { createTravelPlanHelpers } from "../src/domain/travel_plan.js";
import { dayHeading } from "../src/lib/pdf_travel_plan_section.js";
import { pdfT } from "../src/lib/pdf_i18n.js";

test("travel plan validation allows blank day titles", () => {
  const { validateBookingTravelPlanInput } = createTravelPlanHelpers();

  const result = validateBookingTravelPlanInput({
    days: [
      {
        id: "day_1",
        title: "",
        services: []
      }
    ]
  });

  assert.equal(result.ok, true);
  assert.equal(result.travel_plan.days[0].title, "");
});

test("travel plan validation allows blank service titles", () => {
  const { validateBookingTravelPlanInput } = createTravelPlanHelpers();

  const result = validateBookingTravelPlanInput({
    days: [
      {
        id: "day_1",
        title: "Arrival",
        services: [
          {
            id: "service_1",
            kind: "transport",
            title: ""
          }
        ]
      }
    ]
  });

  assert.equal(result.ok, true);
  assert.equal(result.travel_plan.days[0].services[0].title, "");
});

test("travel plan PDF day heading falls back to the localized day label when title is blank", () => {
  assert.equal(
    dayHeading({ day_number: 3, title: "" }, "vi", pdfT),
    "Ngày 3"
  );
  assert.equal(
    dayHeading({ day_number: 2, title: "Arrival in Hanoi" }, "en", pdfT),
    "Day 2 - Arrival in Hanoi"
  );
});

test("marketing travel plan normalization strips localized fields and translation metadata", () => {
  const { normalizeMarketingTourTravelPlan } = createTravelPlanHelpers();

  const result = normalizeMarketingTourTravelPlan({
    days: [
      {
        id: "day_1",
        title: "Arrival",
        title_i18n: {
          vi: "Den noi"
        },
        services: [
          {
            id: "service_1",
            title: "Welcome dinner",
            title_i18n: {
              vi: "Bua toi chao mung"
            },
            details: "Dinner in town",
            details_i18n: {
              vi: "Bua toi trong pho"
            },
            image: {
              id: "image_1",
              storage_path: "/public/v1/tour-images/tour_1/image.webp",
              caption: "Dinner table",
              caption_i18n: {
                vi: "Ban an toi"
              }
            }
          }
        ],
        notes_i18n: {
          vi: "Ghi chu"
        }
      }
    ],
    translation_meta: {
      de: {
        source_lang: "en",
        source_hash: "hash_1",
        origin: "machine",
        updated_at: "2026-04-25T10:00:00.000Z"
      }
    }
  }, {
    sourceLang: "en",
    contentLang: "vi",
    flatLang: "vi",
    flatMode: "localized"
  });

  assert.equal("translation_meta" in result, false);
  assert.equal(result.days[0].title, "Arrival");
  assert.equal("title_i18n" in result.days[0], false);
  assert.equal("notes_i18n" in result.days[0], false);
  assert.equal(result.days[0].services[0].title, "Welcome dinner");
  assert.equal(result.days[0].services[0].details, "Dinner in town");
  assert.equal("title_i18n" in result.days[0].services[0], false);
  assert.equal("details_i18n" in result.days[0].services[0], false);
  assert.equal(result.days[0].services[0].image.caption, "Dinner table");
  assert.equal("caption_i18n" in result.days[0].services[0].image, false);
});
