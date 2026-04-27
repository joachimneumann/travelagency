import test from "node:test";
import assert from "node:assert/strict";
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

test("public tour travel-plan text stays English when the frontend language changes", async () => {
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
            vi: "Vietnamese day title"
          },
          notes: "English day notes",
          notes_i18n: {
            vi: "Vietnamese day notes"
          },
          services: [
            {
              id: "service_1",
              kind: "other",
              title: "English service title",
              title_i18n: {
                vi: "Vietnamese service title"
              },
              details: "English service details",
              details_i18n: {
                vi: "Vietnamese service details"
              }
            }
          ]
        }
      ]
    }
  };
  const state = {
    lang: "vi",
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
  const frontendT = (_id, fallback, vars = {}) => String(fallback ?? "").replace(/\{([^{}]+)\}/g, (_match, key) => (
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ""
  ));

  const controller = createFrontendToursController({
    state,
    els,
    backendBaseUrl: "",
    initialVisibleTours: 1,
    showMoreBatch: 1,
    frontendT,
    currentFrontendLang: () => "vi",
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

  assert.match(els.tourGrid.innerHTML, /English day title/);
  assert.match(els.tourGrid.innerHTML, /English day notes/);
  assert.match(els.tourGrid.innerHTML, /English service title/);
  assert.match(els.tourGrid.innerHTML, /English service details/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /Vietnamese day title/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /Vietnamese day notes/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /Vietnamese service title/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /Vietnamese service details/);
});
