import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBookingTravelPlanPreviewTour,
  buildTourDetailsTravelPlanPdfBooking,
  writeTourDetailsTravelPlanPdf
} from "../src/lib/travel_plan_pdf_preview_adapter.js";

test("booking preview adapter builds a tour-shaped PDF input", () => {
  const travelPlan = { days: [{ id: "day_1", title: "Hanoi" }] };
  const tour = buildBookingTravelPlanPreviewTour({
    id: "booking_1",
    name: "Northern Vietnam",
    travel_plan: {
      destinations: ["Vietnam", "Hanoi"]
    },
    travel_styles: ["Culture"],
    web_form_submission: {
      destinations: ["hanoi", "Sapa"],
      travel_style: ["culture", "Nature"]
    }
  }, travelPlan);

  assert.equal(tour.id, "booking_1");
  assert.equal(tour.title, "Northern Vietnam");
  assert.deepEqual(tour.destinations, ["Vietnam", "Hanoi", "Sapa"]);
  assert.deepEqual(tour.styles, ["Culture", "Nature"]);
  assert.equal(tour.travel_plan, travelPlan);
});

test("tour-details travel-plan writer uses the shared marketing-tour PDF options", async () => {
  let request = null;
  const result = await writeTourDetailsTravelPlanPdf({
    writeTravelPlanPdf: async (booking, travelPlan, options) => {
      request = { booking, travelPlan, options };
      return { outputPath: options.outputPath };
    },
    tour: {
      id: "tour_1",
      title: "Mekong",
      styles: ["food"],
      travel_plan: { days: [] }
    },
    lang: "en",
    outputPath: "/tmp/sample.pdf"
  });

  assert.equal(result.outputPath, "/tmp/sample.pdf");
  assert.equal(request.booking.name, "Mekong");
  assert.deepEqual(request.travelPlan, { days: [] });
  assert.equal(request.options.includeMarketingTourBackground, true);
  assert.equal(request.options.includeGuideSection, false);
  assert.equal(request.options.includeEndingSection, false);
});

test("tour-to-booking adapter keeps personalization defaults for tour detail PDFs", () => {
  const booking = buildTourDetailsTravelPlanPdfBooking({
    id: "tour_2",
    title: { en: "Hue", vi: "Hue" },
    destinations: ["Vietnam"],
    styles: ["heritage"]
  }, "en");

  assert.equal(booking.id, "tour_2");
  assert.equal(booking.name, "Hue");
  assert.deepEqual(booking.destinations, ["Vietnam"]);
  assert.deepEqual(booking.travel_styles, ["heritage"]);
  assert.equal(booking.pdf_personalization.travel_plan.include_welcome, true);
  assert.equal(booking.pdf_personalization.travel_plan.include_closing, false);
});
