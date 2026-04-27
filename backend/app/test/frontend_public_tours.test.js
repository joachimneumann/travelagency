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
  assert.doesNotMatch(els.tourGrid.innerHTML, /English day notes/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /English service title/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /English service details/);
});
