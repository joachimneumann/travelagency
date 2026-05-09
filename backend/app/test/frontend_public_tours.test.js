import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(new URL("../../..", import.meta.url).pathname);
const controllerPath = path.join(repoRoot, "frontend", "scripts", "main_tours.js");
const customizerPath = path.join(repoRoot, "frontend", "scripts", "tour_customize.js");
let esmControllerPathPromise;
let esmCustomizerPathPromise;

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
  if (!esmControllerPathPromise) {
    esmControllerPathPromise = (async () => {
      const tempRoot = await mkdtemp(path.join(os.tmpdir(), "frontend-public-tours-esm-"));
      const files = [
        ["frontend/scripts/main_tours.js", "frontend/scripts/main_tours.js"],
        ["frontend/scripts/tour_customize.js", "frontend/scripts/tour_customize.js"],
        ["shared/js/text.js", "shared/js/text.js"],
        ["shared/generated/language_catalog.js", "shared/generated/language_catalog.js"]
      ];
      await writeFile(path.join(tempRoot, "package.json"), "{\"type\":\"module\"}\n", "utf8");
      for (const [source, destination] of files) {
        const destinationPath = path.join(tempRoot, destination);
        await mkdir(path.dirname(destinationPath), { recursive: true });
        await copyFile(path.join(repoRoot, source), destinationPath);
      }
      return path.join(tempRoot, "frontend", "scripts", "main_tours.js");
    })();
  }
  const esmControllerPath = await esmControllerPathPromise;
  return await import(`${pathToFileURL(esmControllerPath).href}?test=${Date.now()}`);
}

async function loadTourCustomizer() {
  if (!esmCustomizerPathPromise) {
    esmCustomizerPathPromise = (async () => {
      const tempRoot = await mkdtemp(path.join(os.tmpdir(), "frontend-tour-customizer-esm-"));
      await writeFile(path.join(tempRoot, "package.json"), "{\"type\":\"module\"}\n", "utf8");
      await mkdir(path.join(tempRoot, "frontend", "scripts"), { recursive: true });
      await copyFile(customizerPath, path.join(tempRoot, "frontend", "scripts", "tour_customize.js"));
      return path.join(tempRoot, "frontend", "scripts", "tour_customize.js");
    })();
  }
  const esmCustomizerPath = await esmCustomizerPathPromise;
  return await import(`${pathToFileURL(esmCustomizerPath).href}?test=${Date.now()}`);
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
    one_pager_pdf_url: "/content/one-pagers/pdfs/tour_localized_plan/de.pdf",
    styles: [],
    destinations: ["Vietnam"],
    pictures: ["/assets/img/service-detail.webp"],
    travel_plan: {
      tour_card_primary_image_id: "image_card_selected",
      tour_card_image_ids: ["image_card_selected"],
      one_pager_experience_highlight_ids: [
        "iconic_landmarks",
        "delicious_cuisine"
      ],
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
                id: "image_card_selected",
                storage_path: "/assets/img/service-detail.webp",
                alt_text: "English service image",
                include_in_travel_tour_card: true,
                is_customer_visible: true
              },
              images: [
                {
                  id: "image_card_selected",
                  storage_path: "/assets/img/service-detail.webp",
                  alt_text: "English service image",
                  include_in_travel_tour_card: true,
                  is_customer_visible: true,
                  sort_order: 0,
                  is_primary: true
                },
                {
                  id: "image_details_only",
                  storage_path: "/assets/img/service-detail-extra.webp",
                  alt_text: "English extra service image",
                  alt_text_i18n: {
                    de: "German extra service image"
                  },
                  include_in_travel_tour_card: false,
                  is_customer_visible: true,
                  sort_order: 1
                },
                {
                  id: "image_customer_hidden",
                  storage_path: "/assets/img/service-detail-hidden.webp",
                  alt_text: "Hidden service image",
                  include_in_travel_tour_card: false,
                  is_customer_visible: false,
                  sort_order: 2
                }
              ]
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
                id: "image_details_second_service",
                storage_path: "/assets/img/service-detail-2.webp",
                alt_text: "English second service image",
                include_in_travel_tour_card: false,
                is_customer_visible: true
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

  const cardMediaStart = els.tourGrid.innerHTML.indexOf('class="tour-card__media"');
  const cardBodyStart = els.tourGrid.innerHTML.indexOf('class="tour-body"', cardMediaStart);
  const cardMediaMarkup = els.tourGrid.innerHTML.slice(cardMediaStart, cardBodyStart);
  assert.match(cardMediaMarkup, /\/assets\/img\/service-detail\.webp/);
  assert.doesNotMatch(cardMediaMarkup, /\/assets\/img\/service-detail-extra\.webp/);
  assert.match(els.tourGrid.innerHTML, /\/assets\/img\/service-detail-extra\.webp/);
  assert.match(els.tourGrid.innerHTML, /German extra service image/);
  assert.match(els.tourGrid.innerHTML, /\/assets\/img\/service-detail-2\.webp/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /\/assets\/img\/service-detail-hidden\.webp/);

  assert.doesNotMatch(els.tourGrid.innerHTML, /Tag 1 - German day title/);
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
  assert.match(els.tourGrid.innerHTML, /tour-plan-highlights/);
  assert.equal((els.tourGrid.innerHTML.match(/class="tour-plan-highlight"/g) || []).length, 4);
  assert.match(els.tourGrid.innerHTML, /Iconic Landmarks/);
  assert.match(els.tourGrid.innerHTML, /Delicious Cuisine/);
  assert.match(els.tourGrid.innerHTML, /\/assets\/img\/experience-highlights\/01\.png/);
  assert.match(els.tourGrid.innerHTML, /tour-plan-pdf/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /Tourübersicht/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /Tour Overview/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /tour-plan-pdf__badge/);
  assert.match(els.tourGrid.innerHTML, /\/public\/v1\/tours\/tour_localized_plan\/one-pager\.pdf\?lang=de/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /\/content\/one-pagers\/pdfs\/tour_localized_plan\/de\.pdf/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /\/api\/v1\/tours\/tour_localized_plan\/one-pager\.pdf/);
  assert.match(els.tourGrid.innerHTML, /tour-plan-summary/);
  assert.match(els.tourGrid.innerHTML, /tour-plan-summary-day/);
  assert.match(els.tourGrid.innerHTML, /Ihre Reiseroute/);
  assert.match(els.tourGrid.innerHTML, /data-tour-plan-summary-toggle/);
  assert.match(els.tourGrid.innerHTML, /data-tour-plan-summary-details hidden/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /data-tour-plan-full-itinerary/);
  assert.match(els.tourGrid.innerHTML, /tour-plan__footer-cta/);
  assert.match(els.tourGrid.innerHTML, /tour-plan__footer-plan-trip/);
  assert.match(els.tourGrid.innerHTML, /tour-plan-service-card--has-details/);
  assert.match(els.tourGrid.innerHTML, /tour-plan-service-card__details-indicator/);
  assert.match(els.tourGrid.innerHTML, /tour-plan-service-card__details-text/);
  assert.match(els.tourGrid.innerHTML, />Einzelheiten<\/span>/);
  assert.doesNotMatch(els.tourGrid.innerHTML, />Details<\/span>/);
  assert.match(els.tourGrid.innerHTML, /data-tour-plan-service-details-toggle/);
  assert.equal((els.tourGrid.innerHTML.match(/data-tour-plan-service-details-toggle/g) || []).length, 1);
  assert.doesNotMatch(els.tourGrid.innerHTML, /data-tour-plan-service-collapse/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /data-tour-plan-service-flip/);
  assert.doesNotMatch(els.tourGrid.innerHTML, /Tap again to see the image/);
  assert.match(els.tourGrid.innerHTML, /data-tour-plan-service-swap/);
});

test("collapsed public tour cards use swipe-only mobile galleries for multi-image tours", async () => {
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
    tourGalleryIndexByTripId: {
      tour_multi_image: 1
    },
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
  assert.doesNotMatch(els.tourGrid.innerHTML, /tour_multi_image[\s\S]*data-tour-image-cycle="1"/);
  assert.match(els.tourGrid.innerHTML, /tour_multi_image[\s\S]*data-tour-image-swipe="1"/);
  assert.match(els.tourGrid.innerHTML, /tour_multi_image[\s\S]*data-tour-gallery-index="1"/);
  assert.match(els.tourGrid.innerHTML, /tour_multi_image[\s\S]*tour-card__media-cycle tour-card__media-swipe/);
  assert.match(els.tourGrid.innerHTML, /tour_multi_image[\s\S]*data-tour-media-track/);
  assert.match(els.tourGrid.innerHTML, /tour_multi_image[\s\S]*2 \/ 2/);
  assert.match(els.tourGrid.innerHTML, /tour-card__media-slide is-active[\s\S]*src="\/assets\/img\/two\.webp"/);
  assert.match(els.tourGrid.innerHTML, /tour_multi_image[\s\S]*tour-card__media-dots/);
});

test("secret tour customization stays disabled on mobile viewports", async () => {
  global.HTMLElement = FakeElement;
  global.HTMLButtonElement = FakeElement;

  const { createFrontendToursController } = await loadToursController();
  const trip = {
    id: "tour_customize_mobile",
    title: "Mobile customization tour",
    short_description: "",
    styles: [],
    destinations: ["Vietnam"],
    pictures: [],
    travel_plan: {
      days: [
        {
          id: "day_1",
          day_number: 1,
          title: "Day one",
          primary_location_id: "place_hanoi",
          services: [
            {
              title: "Arrival",
              image: { storage_path: "/assets/img/hanoi.webp" }
            }
          ]
        }
      ]
    }
  };
  const baseState = () => ({
    lang: "en",
    filteredTrips: [trip],
    trips: [trip],
    visibleToursCount: 1,
    expandedTourIds: new Set([trip.id]),
    customizeFeatureEnabled: true,
    filterOptions: {
      destinations: [],
      styles: [],
      destinationScopeCatalog: {
        destinations: [
          { code: "vietnam", label: "Vietnam" }
        ],
        places: [
          {
            id: "place_hanoi",
            destination: "vietnam",
            label: "Hanoi",
            latitude: 21.0278,
            longitude: 105.8342
          }
        ]
      }
    },
    filters: {
      dest: [],
      area: "",
      place: "",
      style: []
    }
  });
  const createController = (state) => {
    const els = {
      tourGrid: new FakeElement(),
      noResultsMessage: new FakeElement(),
      tourActions: null,
      showMoreTours: null
    };
    return {
      els,
      controller: createFrontendToursController({
        state,
        els,
        backendBaseUrl: "",
        initialVisibleTours: 1,
        showMoreBatch: 1,
        frontendT: (_id, fallback, vars = {}) => String(fallback ?? "").replace(/\{([^{}]+)\}/g, (_match, key) => (
          Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ""
        )),
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
      })
    };
  };

  global.window = {
    addEventListener() {},
    requestAnimationFrame(callback) {
      if (typeof callback === "function") callback();
    },
    matchMedia(query) {
      return { matches: query === "(max-width: 760px)" };
    }
  };
  const mobile = createController(baseState());
  mobile.controller.renderVisibleTrips();

  assert.doesNotMatch(mobile.els.tourGrid.innerHTML, /data-tour-customize/);
  assert.doesNotMatch(mobile.els.tourGrid.innerHTML, /Customize this tour/);

  global.window.matchMedia = () => ({ matches: false });
  const desktop = createController(baseState());
  desktop.controller.renderVisibleTrips();

  assert.match(desktop.els.tourGrid.innerHTML, /data-tour-customize/);
  assert.match(desktop.els.tourGrid.innerHTML, /Customize this tour/);
});

test("tour customizer only previews day cards with a title, geocoded location, and service image", async () => {
  global.window = undefined;

  const { createTourCustomizer } = await loadTourCustomizer();
  const trip = {
    id: "tour_customizer_eligibility",
    travel_plan: {
      days: [
        {
          id: "eligible_catalog_location",
          day_number: 1,
          title: "Hanoi arrival",
          primary_location_id: "place_hanoi",
          services: [
            { title: "Arrival", image: { storage_path: "/assets/img/hanoi.webp" } }
          ]
        },
        {
          id: "missing_title",
          day_number: 2,
          primary_location_id: "place_hanoi",
          services: [
            { title: "Guide", image: { storage_path: "/assets/img/guide.webp" } }
          ]
        },
        {
          id: "text_only_location",
          day_number: 3,
          title: "Hoi An beach",
          overnight_location: "Hoi An",
          services: [
            { title: "Boat", image: { storage_path: "/assets/img/boat.webp" } }
          ]
        },
        {
          id: "location_without_coordinates",
          day_number: 4,
          title: "Hue stop",
          primary_location_id: "place_hue",
          services: [
            { title: "Citadel", image: { storage_path: "/assets/img/hue.webp" } }
          ]
        },
        {
          id: "missing_service_image",
          day_number: 5,
          title: "Saigon food walk",
          primary_location_id: "place_saigon",
          services: [
            { title: "Food walk" }
          ]
        },
        {
          id: "hidden_service_image",
          day_number: 6,
          title: "Nha Trang beach",
          primary_location_id: "place_nha_trang",
          services: [
            { title: "Beach", image: { storage_path: "/assets/img/beach.webp", is_customer_visible: false } }
          ]
        },
        {
          id: "eligible_explicit_route_point",
          day_number: 7,
          title: "Mekong stop",
          route_point: { lat: 10.0452, lng: 105.7469, label: "Mekong Delta" },
          services: [
            { title: "Boat", image: { storage_path: "/assets/img/mekong.webp" } }
          ]
        }
      ]
    }
  };
  const customizer = createTourCustomizer({
    state: {},
    frontendT: (_id, fallback) => fallback,
    currentFrontendLang: () => "en",
    normalizeFrontendTourLang: (lang) => lang || "en",
    escapeHTML,
    escapeAttr,
    travelPlanDays: (item) => item?.travel_plan?.days || [],
    destinationScopeCatalog: () => ({
      places: [
        { id: "place_hanoi", label: "Hanoi", latitude: 21.0278, longitude: 105.8342 },
        { id: "place_hue", label: "Hue" },
        { id: "place_saigon", label: "Ho Chi Minh City", latitude: 10.8231, longitude: 106.6297 },
        { id: "place_nha_trang", label: "Nha Trang", latitude: 12.2388, longitude: 109.1967 }
      ]
    }),
    findTripById: () => trip,
    ensureTourDetailsLoaded: async () => {},
    allTrips: () => [trip],
    renderVisibleTrips() {}
  });

  const preview = customizer.routePreviewForTrip(trip);

  assert.deepEqual(preview.groups.map((group) => group.locationLabel), ["Hanoi", "Mekong Delta"]);
  assert.deepEqual(preview.groups.map((group) => group.label), ["1", "2"]);
});

test("tour customizer keeps route segments for non-consecutive location revisits", async () => {
  global.window = undefined;

  const { createTourCustomizer } = await loadTourCustomizer();
  const trip = {
    id: "tour_customizer_route_revisit",
    travel_plan: {
      days: [
        {
          id: "sapa_arrival",
          title: "Sapa arrival",
          primary_location_id: "place_sapa",
          services: [{ title: "Arrival", image: { storage_path: "/assets/img/sapa.webp" } }]
        },
        {
          id: "sapa_market",
          title: "Sapa market",
          primary_location_id: "place_sapa",
          services: [{ title: "Market", image: { storage_path: "/assets/img/market.webp" } }]
        },
        {
          id: "hue_lagoon",
          title: "Hue lagoon",
          primary_location_id: "place_hue",
          services: [{ title: "Lagoon", image: { storage_path: "/assets/img/hue.webp" } }]
        },
        {
          id: "hanoi_quarter",
          title: "Hanoi quarter",
          primary_location_id: "place_hanoi",
          services: [{ title: "Quarter", image: { storage_path: "/assets/img/hanoi.webp" } }]
        },
        {
          id: "sapa_return",
          title: "Sapa return",
          primary_location_id: "place_sapa",
          services: [{ title: "Return", image: { storage_path: "/assets/img/return.webp" } }]
        }
      ]
    }
  };
  const customizer = createTourCustomizer({
    state: {},
    frontendT: (_id, fallback) => fallback,
    currentFrontendLang: () => "en",
    normalizeFrontendTourLang: (lang) => lang || "en",
    escapeHTML,
    escapeAttr,
    travelPlanDays: (item) => item?.travel_plan?.days || [],
    destinationScopeCatalog: () => ({
      places: [
        { id: "place_sapa", label: "Sapa", latitude: 22.3364, longitude: 103.8438 },
        { id: "place_hue", label: "Hue", latitude: 16.4637, longitude: 107.5909 },
        { id: "place_hanoi", label: "Hanoi", latitude: 21.0278, longitude: 105.8342 }
      ]
    }),
    findTripById: () => trip,
    ensureTourDetailsLoaded: async () => {},
    allTrips: () => [trip],
    renderVisibleTrips() {}
  });

  const preview = customizer.routePreviewForTrip(trip);

  assert.equal(preview.points.split(" ").length, 4);
  assert.equal((preview.path.match(/\bQ\b/g) || []).length, 3);
  assert.deepEqual(preview.groups.map((group) => group.locationLabel), ["Sapa", "Hue", "Hanoi"]);
  assert.equal(preview.groups.find((group) => group.locationLabel === "Sapa")?.label, "1-2, 5");
});

test("expanded public tour details load into the refreshed language trip list", async () => {
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

  const fetchedUrls = [];
  global.fetch = async (url) => {
    fetchedUrls.push(String(url));
    return {
      ok: true,
      async json() {
        return {
          title: "Tour tiếng Việt",
          one_pager_pdf_url: "/content/one-pagers/pdfs/tour_language_switch/vi.pdf",
          one_pager_experience_highlight_ids: [
            "iconic_landmarks",
            "delicious_cuisine"
          ],
          travel_plan: {
            days: [
              {
                id: "day_vi_1",
                day_number: 1,
                title: "Ngày tiếng Việt",
                services: []
              }
            ]
          }
        };
      }
    };
  };

  const { createFrontendToursController } = await loadToursController();
  const oldExpandedTrip = {
    id: "tour_language_switch",
    title: "Old English tour",
    short_description: "",
    styles: [],
    destinations: ["Vietnam"],
    pictures: [],
    travel_plan: {
      days: [
        {
          id: "day_en_1",
          day_number: 1,
          title: "Old English day",
          services: []
        }
      ]
    }
  };
  const refreshedTrip = {
    id: "tour_language_switch",
    title: "Tour tiếng Việt",
    short_description: "",
    styles: [],
    destinations: ["Việt Nam"],
    pictures: [],
    travel_plan_day_count: 1,
    has_travel_plan_details: true,
    travel_plan_details_url: "/frontend/data/generated/homepage/public-tour-details.vi.tour_language_switch.json"
  };
  const state = {
    lang: "vi",
    filteredTrips: [oldExpandedTrip],
    trips: [refreshedTrip],
    visibleToursCount: 1,
    expandedTourIds: new Set([refreshedTrip.id]),
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

  const controller = createFrontendToursController({
    state,
    els: {
      tourGrid: new FakeElement(),
      noResultsMessage: new FakeElement(),
      tourActions: null,
      showMoreTours: null
    },
    backendBaseUrl: "",
    initialVisibleTours: 1,
    showMoreBatch: 1,
    frontendT: (_id, fallback, vars = {}) => String(fallback ?? "").replace(/\{([^{}]+)\}/g, (_match, key) => (
      Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ""
    )),
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

  await controller.loadExpandedTourDetails();

  assert.deepEqual(fetchedUrls, [refreshedTrip.travel_plan_details_url]);
  assert.equal(state.trips[0].travel_plan.days.length, 1);
  assert.equal(state.trips[0].travel_plan.days[0].title, "Ngày tiếng Việt");
  assert.equal(state.trips[0].one_pager_pdf_url, "/content/one-pagers/pdfs/tour_language_switch/vi.pdf");
  assert.deepEqual(state.trips[0].one_pager_experience_highlight_ids, [
    "iconic_landmarks",
    "delicious_cuisine"
  ]);
  assert.equal(state.filteredTrips[0].travel_plan.days[0].title, "Old English day");
});

test("public tour details render only one expanded tour at a time", async () => {
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
  const firstTrip = {
    id: "tour_first_open",
    title: "First tour",
    short_description: "",
    styles: [],
    destinations: ["Vietnam"],
    pictures: [],
    travel_plan: {
      days: [
        {
          id: "first_day",
          day_number: 1,
          title: "First day",
          services: []
        }
      ]
    }
  };
  const secondTrip = {
    id: "tour_second_open",
    title: "Second tour",
    short_description: "",
    styles: [],
    destinations: ["Thailand"],
    pictures: [],
    travel_plan: {
      days: [
        {
          id: "second_day",
          day_number: 1,
          title: "Second day",
          services: []
        }
      ]
    }
  };
  const state = {
    lang: "en",
    filteredTrips: [firstTrip, secondTrip],
    trips: [firstTrip, secondTrip],
    visibleToursCount: 2,
    expandedTourIds: new Set([firstTrip.id, secondTrip.id]),
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
  const controller = createFrontendToursController({
    state,
    els,
    backendBaseUrl: "",
    initialVisibleTours: 2,
    showMoreBatch: 1,
    frontendT: (_id, fallback, vars = {}) => String(fallback ?? "").replace(/\{([^{}]+)\}/g, (_match, key) => (
      Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : ""
    )),
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

  assert.deepEqual([...state.expandedTourIds], [secondTrip.id]);
  assert.equal((els.tourGrid.innerHTML.match(/data-expanded-tour-id=/g) || []).length, 1);
  assert.doesNotMatch(els.tourGrid.innerHTML, /data-expanded-tour-id="tour_first_open"/);
  assert.match(els.tourGrid.innerHTML, /data-expanded-tour-id="tour_second_open"/);
});
