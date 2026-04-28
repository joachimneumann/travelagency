import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(new URL("../../..", import.meta.url).pathname);
const controllerPath = path.join(repoRoot, "frontend", "scripts", "main_tours.js");

class FakeElement {
  constructor() {
    this.hidden = false;
    this.innerHTML = "";
    this.dataset = {};
    this.style = {};
    this.classList = {
      add() {},
      remove() {},
      toggle() {}
    };
  }

  addEventListener() {}

  querySelectorAll() {
    return [];
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return escapeHTML(value).replace(/"/g, "&quot;");
}

async function loadToursController() {
  return await import(`${pathToFileURL(controllerPath).href}?test=${Date.now()}`);
}

async function loadFrontendDictionary(lang) {
  const dictionaryPath = path.join(repoRoot, "frontend", "data", "i18n", "frontend", `${lang}.json`);
  return JSON.parse(await readFile(dictionaryPath, "utf8"));
}

test("public tour travel-plan content and detail chrome follow the frontend language", async () => {
  global.HTMLElement = FakeElement;
  global.HTMLButtonElement = FakeElement;
  global.window = {
    addEventListener() {},
    requestAnimationFrame(callback) {
      if (typeof callback === "function") callback();
    },
    matchMedia() {
      return { matches: true };
    }
  };

  const { createFrontendToursController } = await loadToursController();
  const trip = {
    id: "tour_localized_plan",
    title: "Localized plan",
    short_description: "Description",
    styles: [],
    destinations: ["Vietnam"],
    pictures: [],
    travel_plan: {
      days: [
        {
          id: "day_1",
          day_number: 1,
          title: "English day title",
          title_i18n: {
            de: "German day title"
          },
          notes: "English day notes",
          notes_i18n: {
            de: "German day notes"
          },
          services: [
            {
              id: "service_1",
              kind: "other",
              title: "English service title",
              title_i18n: {
                de: "German service title"
              },
              details: "English service details",
              details_i18n: {
                de: "German service details"
              },
              image: {
                storage_path: "/assets/img/service-detail.webp",
                alt_text: "English service image"
              }
            },
            {
              id: "service_2",
              kind: "other",
              title: "English second service title",
              title_i18n: {
                de: "German second service title"
              },
              details: "English second service details",
              details_i18n: {
                de: "German second service details"
              },
              image: {
                storage_path: "/assets/img/service-detail-2.webp",
                alt_text: "English second service image"
              }
            }
          ]
        }
      ]
    }
  };
  const state = {
    lang: "de",
    filteredTrips: [trip],
    trips: [trip],
    visibleToursCount: 1,
    expandedTourIds: new Set([trip.id]),
    filterOptions: {
      destinations: [],
      styles: [],
      destinationScopeCatalog: null
    },
    filters: {
      dest: [],
      area: "",
      place: "",
      style: []
    }
  };
  const els = {
    tourGrid: new FakeElement(),
    noResultsMessage: new FakeElement(),
    tourActions: null,
    showMoreTours: null
  };
  const frontendDict = await loadFrontendDictionary("de");
  const frontendT = (id, fallback, vars = {}) => String(frontendDict[id] ?? fallback ?? "").replace(/\{([^{}]+)\}/g, (_match, key) => (
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ""
  ));

  const controller = createFrontendToursController({
    state,
    els,
    backendBaseUrl: "",
    initialVisibleTours: 1,
    showMoreBatch: 1,
    frontendT,
    currentFrontendLang: () => "de",
    preferredCurrencyForFrontendLang: () => "USD",
    approximateDisplayAmountFromUSD: () => null,
    formatDisplayMoney: () => "",
    defaultBookingCurrency: "USD",
    escapeHTML,
    escapeAttr,
    updateBookingModalTitle() {},
    openBookingModal() {},
    setSelectedTourContext() {},
    clearSelectedTourContext() {},
    setBookingField() {},
    prefillBookingFormWithFilters() {}
  });

  controller.renderVisibleTrips();

  assert.match(els.tourGrid.innerHTML, /Tag 1 - German day title/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /Day 1 - English day title/);
  assert.match(els.tourGrid.innerHTML, /German day title/);
  assert.match(els.tourGrid.innerHTML, /German day notes/);
  assert.match(els.tourGrid.innerHTML, /German service title/);
  assert.match(els.tourGrid.innerHTML, /German service details/);
  assert.match(els.tourGrid.innerHTML, /German second service title/);
  assert.match(els.tourGrid.innerHTML, /German second service details/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /English day notes/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /English service title/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /English service details/);
  assert.match(els.tourGrid.innerHTML, /data-tour-plan-service-flip/);
  assert.match(els.tourGrid.innerHTML, /Tap again to see the image/);
  assert.match(els.tourGrid.innerHTML, /data-tour-plan-service-swap/);
});

test("collapsed public tour cards only animate image hover when more than one tour image is available", async () => {
  global.HTMLElement = FakeElement;
  global.HTMLButtonElement = FakeElement;
  global.window = {
    addEventListener() {},
    requestAnimationFrame(callback) {
      if (typeof callback === "function") callback();
    },
    matchMedia() {
      return { matches: true };
    }
  };

  const { createFrontendToursController } = await loadToursController();
  const singleImageTrip = {
    id: "tour_single_image",
    title: "Single image tour",
    short_description: "One image only",
    styles: [],
    destinations: ["Vietnam"],
    pictures: ["/assets/img/single.webp"],
    travel_plan: { days: [] }
  };
  const multiImageTrip = {
    id: "tour_multi_image",
    title: "Multi image tour",
    short_description: "Two images",
    styles: [],
    destinations: ["Thailand"],
    pictures: ["/assets/img/one.webp", "/assets/img/two.webp"],
    travel_plan: { days: [] }
  };
  const state = {
    lang: "en",
    filteredTrips: [singleImageTrip, multiImageTrip],
    trips: [singleImageTrip, multiImageTrip],
    visibleToursCount: 2,
    expandedTourIds: new Set(),
    filterOptions: {
      destinations: [],
      styles: [],
      destinationScopeCatalog: null
    },
    filters: {
      dest: [],
      area: "",
      place: "",
      style: []
    }
  };
  const els = {
    tourGrid: new FakeElement(),
    noResultsMessage: new FakeElement(),
    tourActions: null,
    showMoreTours: null
  };
  const frontendDict = await loadFrontendDictionary("en");
  const frontendT = (id, fallback, vars = {}) => String(frontendDict[id] ?? fallback ?? "").replace(/\{([^{}]+)\}/g, (_match, key) => (
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ""
  ));

  const controller = createFrontendToursController({
    state,
    els,
    backendBaseUrl: "",
    initialVisibleTours: 2,
    showMoreBatch: 1,
    frontendT,
    currentFrontendLang: () => "en",
    preferredCurrencyForFrontendLang: () => "USD",
    approximateDisplayAmountFromUSD: () => null,
    formatDisplayMoney: () => "",
    defaultBookingCurrency: "USD",
    escapeHTML,
    escapeAttr,
    updateBookingModalTitle() {},
    openBookingModal() {},
    setSelectedTourContext() {},
    clearSelectedTourContext() {},
    setBookingField() {},
    prefillBookingFormWithFilters() {}
  });

  controller.renderVisibleTrips();
  const singleCardMarkup = els.tourGrid.innerHTML.split('data-tour-card-id="tour_multi_image"')[0];

  assert.match(singleCardMarkup, /tour_single_image/);
  assert.match(singleCardMarkup, /<div class="tour-card__media">/);
  assert.doesNotMatch(singleCardMarkup, /data-tour-image-cycle="1"/);
  assert.match(els.tourGrid.innerHTML, /tour_multi_image[\s\S]*data-tour-image-cycle="1"/);
  assert.match(els.tourGrid.innerHTML, /tour_multi_image[\s\S]*tour-card__media tour-card__media-button/);
});
