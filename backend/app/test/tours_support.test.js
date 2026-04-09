import test from "node:test";
import assert from "node:assert/strict";
import { createTourHelpers } from "../src/domain/tours_support.js";

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
