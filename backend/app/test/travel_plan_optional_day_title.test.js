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
    ],
    offer_component_links: []
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
    ],
    offer_component_links: []
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
