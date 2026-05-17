import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveTravelPlanServiceThumbnailPath } from "../src/lib/pdf_travel_plan_section.js";

test("travel plan pdf resolves activity image paths from public booking image urls", () => {
  const bookingImagesDir = "/srv/backend/app/data/booking_images";
  const resolved = resolveTravelPlanServiceThumbnailPath({
    images: [{
      storage_path: "/public/v1/booking-images/booking_123/travel-plan-services/service_1.webp",
      is_customer_visible: true
    }]
  }, bookingImagesDir);

  assert.equal(
    resolved,
    path.resolve(bookingImagesDir, "booking_123/travel-plan-services/service_1.webp")
  );
});

test("travel plan pdf still resolves raw relative booking image paths", () => {
  const bookingImagesDir = "/srv/backend/app/data/booking_images";
  const resolved = resolveTravelPlanServiceThumbnailPath({
    images: [{
      storage_path: "booking_123/travel-plan-services/service_1.webp",
      is_customer_visible: true
    }]
  }, bookingImagesDir);

  assert.equal(
    resolved,
    path.resolve(bookingImagesDir, "booking_123/travel-plan-services/service_1.webp")
  );
});

test("travel plan pdf resolves default arrival and departure boundary thumbnails", () => {
  const boundaryLogisticsImagePaths = {
    arrival: "/repo/assets/img/arrival.png",
    departure: "/repo/assets/img/departure.png"
  };

  assert.equal(
    resolveTravelPlanServiceThumbnailPath(
      { boundary_kind: "arrival", _presentation_source: "boundary_logistics" },
      "",
      { boundaryLogisticsImagePaths }
    ),
    boundaryLogisticsImagePaths.arrival
  );
  assert.equal(
    resolveTravelPlanServiceThumbnailPath(
      { boundary_kind: "departure", _presentation_source: "boundary_logistics" },
      "",
      { boundaryLogisticsImagePaths }
    ),
    boundaryLogisticsImagePaths.departure
  );
});
