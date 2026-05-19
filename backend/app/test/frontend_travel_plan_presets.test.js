import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(new URL("../../..", import.meta.url).pathname);
const presetPath = path.join(repoRoot, "frontend", "scripts", "shared", "travel_plan_presets.js");

async function loadPresets() {
  return await import(`${pathToFileURL(presetPath).href}?test=${Date.now()}`);
}

test("travel-plan presets resolve page capability contracts", async () => {
  const { resolveTravelPlanEditorPreset } = await loadPresets();

  const booking = resolveTravelPlanEditorPreset("booking");
  assert.equal(booking.name, "booking");
  assert.equal(booking.features.focusedBookingWorkspace, true);
  assert.equal(booking.features.dates, true);
  assert.equal(booking.features.sequentialDayDates, true);
  assert.equal(booking.features.services, "editable");
  assert.equal(booking.features.dayTitleEdit, true);

  const marketingTour = resolveTravelPlanEditorPreset("marketing_tour");
  assert.equal(marketingTour.name, "marketingTour");
  assert.equal(marketingTour.features.focusedBookingWorkspace, true);
  assert.equal(marketingTour.features.dates, false);
  assert.equal(marketingTour.features.sequentialDayDates, false);
  assert.equal(marketingTour.features.timing, false);
  assert.equal(marketingTour.features.services, "editable");
  assert.equal(marketingTour.features.tourCardImageSelection, true);

  const tourVariant = resolveTravelPlanEditorPreset("tour-variant");
  assert.equal(tourVariant.name, "tourVariant");
  assert.equal(tourVariant.features.focusedBookingWorkspace, true);
  assert.equal(tourVariant.features.dates, false);
  assert.equal(tourVariant.features.dayTitleEdit, false);
  assert.equal(tourVariant.features.dayDetailsEdit, false);
  assert.equal(tourVariant.features.dayReadOnlyInfo, true);
  assert.equal(tourVariant.features.mapPointEdit, false);
  assert.equal(tourVariant.features.services, "readonlyCompact");
  assert.equal(tourVariant.features.imageUpload, false);
});

test("travel-plan preset feature overrides are explicit and local", async () => {
  const { resolveTravelPlanEditorPreset } = await loadPresets();

  const resolved = resolveTravelPlanEditorPreset("tourVariant", {
    pdfs: false,
    dayDelete: false
  });

  assert.equal(resolved.features.pdfs, false);
  assert.equal(resolved.features.dayDelete, false);
  assert.equal(resolved.features.dayReorder, true);
  assert.equal(resolved.features.services, "readonlyCompact");
});
