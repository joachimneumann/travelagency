/*
  Beginner-editable configuration:
  - Tour catalog is loaded from backend endpoint /public/v1/tours
*/

import {
  GENERATED_CURRENCIES,
  normalizeCurrencyCode as normalizeGeneratedCurrencyCode
} from "../Generated/Models/generated_Currency.js";
import {
  MAX_TRAVELERS as GENERATED_MAX_TRAVELERS,
  MIN_TRAVELERS as GENERATED_MIN_TRAVELERS
} from "../Generated/Models/generated_FormConstraints.js";
import {
  publicBookingsRequest,
  publicToursRequest
} from "../Generated/API/generated_APIRequestFactory.js";
import { normalizeText } from "../../shared/js/text.js";

const state = {
  trips: [],
  filteredTrips: [],
  filters: {
    dest: [],
    style: []
  },
  rankedTripsDebug: [],
  formStep: 1,
  bookingSubmitted: false,
  visibleToursCount: 3,
  showMoreUsed: false,
  selectedTour: null
};

const TRIPS_REQUEST_VERSION = Date.now();
const INITIAL_VISIBLE_TOURS = 3;
const SHOW_MORE_BATCH = 3;
const TOURS_CACHE_KEY = "asiatravelplan_tours_cache_v2";
const TOURS_CACHE_TTL_MS = 5 * 60 * 1000;
const BACKEND_BASE_URL = window.ASIATRAVELPLAN_API_BASE ? window.ASIATRAVELPLAN_API_BASE.replace(/\/$/, "") : "";
const API_BASE_ORIGIN = BACKEND_BASE_URL || window.location.origin;
const DEFAULT_BOOKING_CURRENCY = "USD";
const MIN_TRAVELERS = Number.isFinite(Number(GENERATED_MIN_TRAVELERS))
  ? Number(GENERATED_MIN_TRAVELERS)
  : 1;
const MAX_TRAVELERS = Number.isFinite(Number(GENERATED_MAX_TRAVELERS)) &&
  Number(GENERATED_MAX_TRAVELERS) >= MIN_TRAVELERS
  ? Number(GENERATED_MAX_TRAVELERS)
  : 30;
const BOOKING_BUDGET_OPTIONS = {
  USD: ["not decided yet", "$500-$900 / week", "$900-$1,400 / week", "$1,400-$2,200 / week", "$2,200+ / week"],
  EURO: ["not decided yet", "€450-€800 / week", "€800-€1,250 / week", "€1,250-€2,000 / week", "€2,000+ / week"],
  VND: ["not decided yet", "12,000,000₫-22,000,000₫ / week", "22,000,000₫-35,000,000₫ / week", "35,000,000₫-55,000,000₫ / week", "55,000,000₫+ / week"],
  THB: ["not decided yet", "17,000฿-30,000฿ / week", "30,000฿-47,000฿ / week", "47,000฿-74,000฿ / week", "74,000฿+ / week"]
};

const els = {
  navToggle: document.getElementById("navToggle"),
  siteNav: document.getElementById("siteNav"),
  brandLogoLink: document.getElementById("brandLogoLink"),
  navDestinationTrigger: document.getElementById("navDestinationTrigger"),
  navDestinationSummary: document.getElementById("navDestinationSummary"),
  navDestinationPanel: document.getElementById("navDestinationPanel"),
  navDestinationOptions: document.getElementById("navDestinationOptions"),
  navStyleTrigger: document.getElementById("navStyleTrigger"),
  navStyleSummary: document.getElementById("navStyleSummary"),
  navStylePanel: document.getElementById("navStylePanel"),
  navStyleOptions: document.getElementById("navStyleOptions"),
  backendLoginContainer: document.getElementById("backendLoginContainer"),
  headerBackendLoginMount: document.getElementById("headerBackendLoginMount"),
  footerBackendLoginMount: document.getElementById("footerBackendLoginMount"),
  backendLoginBtn: document.getElementById("backendLoginBtn"),
  backendLoginBtnTitle: document.getElementById("backendLoginBtnTitle"),
  backendLoginBtnSubtitle: document.getElementById("backendLoginBtnSubtitle"),
  websiteAuthStatus: document.getElementById("websiteAuthStatus"),
  clearFilters: document.getElementById("clearFilters"),
  activeFilters: document.getElementById("activeFilters"),
  toursTitle: document.getElementById("toursTitle"),
  toursBooking: document.getElementById("toursBooking"),
  heroDynamicSubtitle: document.getElementById("heroDynamicSubtitle"),
  heroScrollLink: document.getElementById("heroScrollLink"),
  bookingTitle: document.getElementById("bookingTitle"),
  tourGrid: document.getElementById("tourGrid"),
  tourActions: document.getElementById("tourActions"),
  showMoreTours: document.getElementById("showMoreTours"),
  showAllTours: document.getElementById("showAllTours"),
  debugPriorityBtn: document.getElementById("debugPriorityBtn"),
  debugPriorityOutput: document.getElementById("debugPriorityOutput"),
  noResultsMessage: document.getElementById("noResultsMessage"),
  faqList: document.getElementById("faqList"),
  bookingModal: document.getElementById("bookingModal"),
  openBookingModal: document.getElementById("openBookingModal"),
  closeBookingModal: document.getElementById("closeBookingModal"),
  openModalButtons: document.querySelectorAll("[data-open-modal]"),
  bookingForm: document.getElementById("bookingForm"),
  bookingPreferredCurrency: document.getElementById("bookingPreferredCurrency"),
  bookingBudget: document.getElementById("bookingBudget"),
  bookingBudgetLabel: document.getElementById("bookingBudgetLabel"),
  bookingTourId: document.getElementById("bookingTourId"),
  bookingTourTitle: document.getElementById("bookingTourTitle"),
  stepBack: document.getElementById("stepBack"),
  stepClose: document.getElementById("stepClose"),
  stepNext: document.getElementById("stepNext"),
  progressSteps: document.querySelectorAll(".progress-step"),
  formSteps: document.querySelectorAll(".step"),
  bookingStepTitle: document.getElementById("bookingStepTitle"),
  error: document.getElementById("bookingError"),
  success: document.getElementById("bookingSuccess")
};

init();

async function init() {
  setupMobileNav();
  setupFAQ();
  setupHeroScroll();
  setupBackendLogin();
  setupHiddenBackendQuickLogin();
  loadWebsiteAuthStatus();
  setupModal();
  setupFormNavigation();
  applyTravelerBoundsFromModel();
  setupBookingBudgetOptions();

  const savedFilters = JSON.parse(localStorage.getItem("asiatravelplan_filters") || "null");
  const urlFilters = getFiltersFromURL();
  state.filters.dest = normalizeFilterSelection(urlFilters.dest.length ? urlFilters.dest : savedFilters?.dest);
  state.filters.style = normalizeFilterSelection(urlFilters.style.length ? urlFilters.style : savedFilters?.style);

  try {
    state.trips = await loadTrips();
  } catch (error) {
    console.error("Failed to load tours from backend API.", error);
    state.trips = [];
  }
  prewarmTourImages(state.trips);

  populateFilterOptions(state.trips);
  setupFilterSelectPanels();
  syncFilterInputs();
  applyFilters();
  setupFilterEvents();
  prefillBookingFormWithFilters();
}

function applyTravelerBoundsFromModel() {
  const travelersInput = document.getElementById("bookingTravelers");
  if (!travelersInput) return;
  travelersInput.setAttribute("min", String(MIN_TRAVELERS));
  travelersInput.setAttribute("max", String(MAX_TRAVELERS));
}

function setupMobileNav() {
  if (!els.navToggle || !els.siteNav) return;

  els.navToggle.addEventListener("click", () => {
    const isOpen = els.siteNav.classList.toggle("open");
    els.navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      els.siteNav.classList.remove("open");
      els.navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

function setupFAQ() {
  if (!els.faqList) return;
  const items = els.faqList.querySelectorAll(".faq-item");
  items.forEach((item) => {
    const button = item.querySelector(".faq-question");
    if (!button) return;

    button.addEventListener("click", () => {
      const open = item.classList.contains("open");
      item.classList.toggle("open", !open);
      button.setAttribute("aria-expanded", String(!open));
      const icon = button.querySelector("span");
      if (icon) icon.textContent = open ? "+" : "−";
    });
  });
}

function setupHeroScroll() {
  if (!els.heroScrollLink) return;

  els.heroScrollLink.addEventListener("click", (event) => {
    event.preventDefault();
    const toursSection = document.getElementById("tours");
    if (!toursSection) return;

    const header = document.querySelector(".header");
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    const targetTop = toursSection.getBoundingClientRect().top + window.scrollY - headerHeight;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth"
    });
  });
}

function setupBackendLogin() {
  if (!els.backendLoginBtn) return;

  els.backendLoginBtn.addEventListener("click", async () => {
    const backendUrl = `${window.location.origin}/backend.html`;
    const returnTo = backendUrl;
    const loginUrl = `${BACKEND_BASE_URL}/auth/login?return_to=${encodeURIComponent(returnTo)}`;
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
        credentials: "include"
      });
      const payload = await response.json();
      if (response.ok && payload?.authenticated) {
        window.location.href = backendUrl;
        return;
      }
    } catch {
      // Fall through to login redirect.
    }
    window.location.href = loginUrl;
  });
}

function isStagingFrontend() {
  return window.location.hostname === "staging.asiatravelplan.com";
}

function isLocalFrontend() {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function setupHiddenBackendQuickLogin() {
  if (!els.brandLogoLink || (!isStagingFrontend() && !isLocalFrontend())) return;

  els.brandLogoLink.addEventListener("click", (event) => {
    if (!event.metaKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const backendUrl = `${window.location.origin}/backend.html`;
    const loginParams = new URLSearchParams({
      return_to: backendUrl,
      quick_login: "1"
    });
    window.location.href = `${BACKEND_BASE_URL}/auth/login?${loginParams.toString()}`;
  });
}

function getCurrencyDefinitions() {
  return GENERATED_CURRENCIES;
}

function normalizeCurrencyCode(value) {
  return normalizeGeneratedCurrencyCode(value) || DEFAULT_BOOKING_CURRENCY;
}

function setupBookingBudgetOptions() {
  if (!els.bookingPreferredCurrency || !els.bookingBudget) return;
  els.bookingPreferredCurrency.value = normalizeCurrencyCode(els.bookingPreferredCurrency.value || DEFAULT_BOOKING_CURRENCY);
  renderBudgetOptions(els.bookingPreferredCurrency.value);
  els.bookingPreferredCurrency.addEventListener("change", () => {
    renderBudgetOptions(els.bookingPreferredCurrency.value);
  });
}

function renderBudgetOptions(currencyCode) {
  if (!els.bookingBudget || !els.bookingBudgetLabel) return;
  const currency = normalizeCurrencyCode(currencyCode);
  const options = BOOKING_BUDGET_OPTIONS[currency] || BOOKING_BUDGET_OPTIONS[DEFAULT_BOOKING_CURRENCY];
  const previousValue = els.bookingBudget.value;
  els.bookingBudget.innerHTML = "";
  options.forEach((optionValue) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue === "not decided yet" ? "Not decided yet" : optionValue;
    els.bookingBudget.appendChild(option);
  });
  els.bookingBudget.value = options.includes(previousValue) ? previousValue : "not decided yet";
  els.bookingBudgetLabel.textContent = `Budget range (${currency})`;
}

async function loadWebsiteAuthStatus() {
  if (!els.backendLoginContainer) return;

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
      credentials: "include"
    });
    const payload = await response.json();
    if (!response.ok || !payload?.authenticated) {
      placeBackendLogin(false);
      updateBackendButtonLabel({ authenticated: false, user: "" });
      return;
    }
    const user = payload.user?.preferred_username || payload.user?.email || payload.user?.sub || "authenticated user";
    placeBackendLogin(true);
    updateBackendButtonLabel({ authenticated: true, user });
  } catch {
    placeBackendLogin(false);
    updateBackendButtonLabel({ authenticated: false, user: "" });
  } finally {
    els.backendLoginContainer.classList.remove("backend-login--deferred");
  }
}

function placeBackendLogin(authenticated) {
  if (!els.backendLoginContainer) return;
  const target = authenticated ? els.headerBackendLoginMount : els.footerBackendLoginMount;
  if (!target) return;
  if (els.backendLoginContainer.parentElement !== target) {
    target.appendChild(els.backendLoginContainer);
  }
}

function updateBackendButtonLabel({ authenticated, user }) {
  if (!els.backendLoginBtnTitle) return;
  const subtitleEl = els.backendLoginBtnSubtitle;
  const statusEl = els.websiteAuthStatus;

  if (authenticated) {
    els.backendLoginBtnTitle.textContent = "Backend";
    if (subtitleEl) {
      subtitleEl.textContent = user || "";
      subtitleEl.hidden = !Boolean(user);
    }
    if (statusEl) {
      statusEl.textContent = "";
      statusEl.hidden = true;
    }
    return;
  }

  els.backendLoginBtnTitle.textContent = "AsiaTravelPlan Backend";
  if (subtitleEl) {
    subtitleEl.textContent = "";
    subtitleEl.hidden = true;
  }
  if (statusEl) {
    statusEl.textContent = "";
    statusEl.hidden = true;
  }
}

function setupFilterEvents() {
  if (!els.navDestinationOptions || !els.navStyleOptions) return;

  els.navDestinationOptions.addEventListener("change", () => {
    state.filters.dest = getCheckedValues(els.navDestinationOptions);
    state.visibleToursCount = INITIAL_VISIBLE_TOURS;
    state.showMoreUsed = false;
    onFilterChange();
  });

  els.navStyleOptions.addEventListener("change", () => {
    state.filters.style = getCheckedValues(els.navStyleOptions);
    state.visibleToursCount = INITIAL_VISIBLE_TOURS;
    state.showMoreUsed = false;
    onFilterChange();
  });

  els.clearFilters.addEventListener("click", () => {
    state.filters.dest = [];
    state.filters.style = [];
    state.visibleToursCount = INITIAL_VISIBLE_TOURS;
    state.showMoreUsed = false;
    syncFilterInputs();
    onFilterChange();
  });
}

function onFilterChange() {
  saveFilters();
  updateURLWithFilters();
  updateFilterTriggerLabels();
  applyFilters();
  prefillBookingFormWithFilters();
}

function saveFilters() {
  localStorage.setItem("asiatravelplan_filters", JSON.stringify(state.filters));
}

function applyFilters() {
  const matchingTrips = state.trips.filter((trip) => {
    const destinationCountries = tourDestinationCountries(trip);
    const matchDest = !state.filters.dest.length || state.filters.dest.some((destination) => destinationCountries.includes(destination));
    const matchStyle = !state.filters.style.length || state.filters.style.some((style) => trip.styles.includes(style));
    return matchDest && matchStyle;
  });
  const rankedEntries = rankTripsByPriorityAndRandom(matchingTrips);
  state.rankedTripsDebug = rankedEntries;
  state.filteredTrips = rankedEntries.map((entry) => entry.trip);

  renderFilterSummary();
  updateTitlesForFilters();
  renderVisibleTrips();
  renderPriorityDebug();
}

function rankTripsByPriorityAndRandom(trips) {
  return trips
    .map((trip) => {
      const basePriority = Number.isFinite(Number(trip.priority)) ? Number(trip.priority) : 50;
      const randomBoost = Math.floor(Math.random() * 51);
      return {
        trip,
        priority: basePriority,
        randomBoost,
        score: basePriority + randomBoost
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry);
}

function renderPriorityDebug() {
  if (!els.debugPriorityOutput) return;
  const lines = state.rankedTripsDebug.map((entry, idx) => {
    return `${idx + 1}. ${entry.trip.id} | priority: ${entry.priority} | random: ${entry.randomBoost} | sum: ${entry.score}`;
  });
  const destLabel = formatFilterValue(state.filters.dest, "destination");
  const styleLabel = formatFilterValue(state.filters.style, "style");
  const header = `Filter: ${destLabel}, ${styleLabel}`;
  els.debugPriorityOutput.textContent = `${header}\n${lines.join("\n") || "No tours in current filter."}`;
}

function renderVisibleTrips() {
  const visibleTrips = state.filteredTrips.slice(0, state.visibleToursCount);
  renderTrips(visibleTrips);
  updateTourActions();
}

function updateTourActions() {
  if (!els.tourActions || !els.showMoreTours || !els.showAllTours) return;

  const total = state.filteredTrips.length;
  const remaining = Math.max(0, total - state.visibleToursCount);

  if (total === 0 || remaining === 0) {
    els.tourActions.hidden = true;
    els.showMoreTours.hidden = true;
    els.showAllTours.hidden = true;
    return;
  }

  const moreCount = Math.min(SHOW_MORE_BATCH, remaining);
  const showMoreAvailable = !state.showMoreUsed && moreCount > 0;
  const showAllAvailable = state.showMoreUsed && remaining > 0;
  const noFilterSelected = !state.filters.dest.length && !state.filters.style.length;

  els.tourActions.hidden = !(showMoreAvailable || showAllAvailable);

  if (showMoreAvailable) {
    els.showMoreTours.hidden = false;
    if (noFilterSelected) {
      els.showMoreTours.textContent = "show more tours";
    } else {
      els.showMoreTours.textContent = buildShowMoreToursLabel(moreCount);
    }
  } else {
    els.showMoreTours.hidden = true;
  }

  if (showAllAvailable) {
    els.showAllTours.hidden = false;
    els.showAllTours.textContent = remaining === 1 ? "There is one more tour" : `show the remaining ${remaining} tours`;
  } else {
    els.showAllTours.hidden = true;
  }
}

function buildShowMoreToursLabel(moreCount) {
  const style = state.filters.style;
  const destination = state.filters.dest;
  const countText = `${moreCount}`;

  if (style.length === 1) {
    return `show ${countText} more ${style[0].toLowerCase()} tours`;
  }

  if (destination.length === 1) {
    return `show ${countText} more tours in ${destination[0]}`;
  }

  return moreCount === 1 ? "show more 1 tour" : `show more ${countText} tours`;
}

function formatFilterValue(value, kind) {
  if (Array.isArray(value) && value.length) return value.join(", ");
  return kind === "destination" ? "All destinations" : "All travel styles";
}

function updateFilterTriggerLabels() {
  if (els.navDestinationSummary) {
    els.navDestinationSummary.textContent = formatFilterValue(state.filters.dest, "destination");
  }
  if (els.navStyleSummary) {
    els.navStyleSummary.textContent = state.filters.style.length
      ? state.filters.style.join(", ")
      : "All travel styles";
  }
}

function renderFilterSummary() {
  const chips = [];
  chips.push(renderChip("Destination", state.filters.dest));
  chips.push(renderChip("Style", state.filters.style));
  els.activeFilters.innerHTML = chips.join("");
}

function renderChip(label, value) {
  const active = Array.isArray(value) && value.length > 0;
  const text = active ? value.join(", ") : `All ${label.toLowerCase()}s`;
  return `<span class="filter-pill ${active ? "active" : ""}">${label}: ${text}</span>`;
}

function updateTitlesForFilters() {
  const dest = state.filters.dest;
  const style = state.filters.style;
  const destLabel = formatFilterValue(dest, "destination");
  const styleLabel = formatFilterValue(style, "style");

  let heading = "Featured tours you can tailor";
  let booking = "Browse by destination and style. Filters update instantly and can be shared by URL.";
  let pageTitle = "AsiaTravelPlan | Custom Southeast Asia Holidays";

  if (dest.length && style.length) {
    heading = `${styleLabel} tours in ${destLabel}`;
    booking = `Showing ${styleLabel.toLowerCase()} journeys in ${destLabel}. Clear filters to see all options.`;
    pageTitle = `AsiaTravelPlan | ${styleLabel} Tours in ${destLabel}`;
  } else if (dest.length) {
    heading = `Featured tours in ${destLabel}`;
    booking = `Showing all travel styles available in ${destLabel}.`;
    pageTitle = `AsiaTravelPlan | Tours in ${destLabel}`;
  } else if (style.length) {
    heading = `${styleLabel} travel styles across Southeast Asia`;
    booking = `Showing ${styleLabel.toLowerCase()} journeys across Vietnam, Thailand, Cambodia, and Laos.`;
    pageTitle = `AsiaTravelPlan | ${styleLabel} Southeast Asia Tours`;
  }

  if (els.toursTitle) els.toursTitle.textContent = heading;
  if (els.toursBooking) els.toursBooking.textContent = booking;
  if (els.heroDynamicSubtitle) {
    els.heroDynamicSubtitle.textContent = heading;
    const noFilterSelected = !dest.length && !style.length;
    els.heroDynamicSubtitle.hidden = noFilterSelected;
  }
  if (els.bookingStepTitle) {
    els.bookingStepTitle.textContent = heading;
  }
  updateBookingModalTitle();
  document.title = pageTitle;
}

function updateBookingModalTitle() {
  if (!els.bookingTitle) return;
  const dest = state.filters.dest;
  const style = state.filters.style;
  const destLabel = formatFilterValue(dest, "destination");
  const styleLabel = formatFilterValue(style, "style");

  let title = "Plan your tour with AsiaTravelPlan";
  if (dest.length && style.length) {
    title = `Plan your ${styleLabel.toLowerCase()} tour in ${destLabel}`;
  } else if (dest.length) {
    title = `Plan your tour in ${destLabel}`;
  } else if (style.length) {
    title = `Plan your ${styleLabel.toLowerCase()} tour`;
  }

  els.bookingTitle.textContent = title;
}

function renderTrips(trips) {
  if (!els.tourGrid) return;

  if (!trips.length) {
    els.tourGrid.innerHTML = "";
    els.noResultsMessage.hidden = false;
    return;
  }

  els.noResultsMessage.hidden = true;

  const cards = trips
    .map((trip, index) => {
      const tags = trip.styles.map((style) => `<span class="tag">${escapeHTML(style)}</span>`).join("");
      const countries = tourDestinationCountries(trip);
      const countriesLabel = countries.join(", ");
      const price = typeof trip.priceFrom === "number"
        ? `From $${new Intl.NumberFormat("en-US", {
          maximumFractionDigits: 0,
          useGrouping: true
        }).format(trip.priceFrom)}`
        : "Custom quote";
      const rating = typeof trip.rating === "number" ? `★ ${trip.rating.toFixed(1)}` : "";
      const loading = index < 3 ? "eager" : "lazy";
      const fetchpriority = index < 3 ? "high" : "auto";

      return `
        <article class="tour-card">
          <img
            src="${escapeAttr(trip.image)}"
            alt="${escapeAttr(trip.title)} in ${escapeAttr(countriesLabel)}"
            loading="${loading}"
            fetchpriority="${fetchpriority}"
            width="1200"
            height="800"
          />
          <div class="tour-body">
            <div class="tour-topline">
              <span class="tour-country">${escapeHTML(countriesLabel)}</span>
              <span class="rating">${escapeHTML(rating)}</span>
            </div>
            <h3 class="tour-title">${escapeHTML(trip.title)}</h3>
            <p class="tour-desc">${escapeHTML(trip.shortDescription)}</p>
            <div class="tags">${tags}</div>
            <div class="meta">
              <span>${trip.durationDays} days</span>
              <span>${escapeHTML(price)}</span>
            </div>
            <button class="btn btn-primary" type="button" data-open-modal data-trip-id="${escapeAttr(trip.id)}">Plan this trip</button>
          </div>
        </article>
      `;
    })
    .join("");

  els.tourGrid.innerHTML = cards;
  bindTourCardOpenHandlers();
}

function bindTourCardOpenHandlers() {
  if (!els.tourGrid) return;

  const buttons = els.tourGrid.querySelectorAll("[data-open-modal][data-trip-id]");
  buttons.forEach((button) => {
    if (button.dataset.bookingBound) return;

    button.addEventListener("click", () => {
      const tripId = button.getAttribute("data-trip-id");
      const selected = state.trips.find((trip) => trip.id === tripId);
      if (selected) {
        setBookingField("bookingDestination", tourDestinationCountries(selected));
        setBookingField("bookingStyle", selected.styles || []);
        setSelectedTourContext(selected);
      } else {
        clearSelectedTourContext();
      }
      openBookingModal();
    });

    button.dataset.bookingBound = "1";
  });
}

function populateFilterOptions(trips) {
  const destinations = Array.from(new Set(trips.flatMap((trip) => tourDestinationCountries(trip)))).sort();
  const styles = Array.from(new Set(trips.flatMap((trip) => trip.styles))).sort();

  if (els.navDestinationOptions) {
    els.navDestinationOptions.innerHTML = destinations
      .map((destination) => renderFilterCheckbox("destination", destination))
      .join("");
  }

  if (els.navStyleOptions) {
    els.navStyleOptions.innerHTML = styles
      .map((style) => renderFilterCheckbox("style", style))
      .join("");
  }
}

function renderFilterCheckbox(kind, value) {
  const safeValue = escapeHTML(value);
  const inputId = `${kind}Filter_${value.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  return `
    <label class="filter-checkbox-option" for="${escapeHTML(inputId)}">
      <input id="${escapeHTML(inputId)}" type="checkbox" value="${safeValue}" />
      <span>${safeValue}</span>
    </label>
  `;
}

function tourDestinationCountries(trip) {
  if (Array.isArray(trip?.destinationCountries) && trip.destinationCountries.length) {
    return trip.destinationCountries.map((value) => String(value || "").trim()).filter(Boolean);
  }
  return [];
}

function syncFilterInputs() {
  setFilterCheckboxes(els.navDestinationOptions, state.filters.dest);
  setFilterCheckboxes(els.navStyleOptions, state.filters.style);
  updateFilterTriggerLabels();
}

function updateURLWithFilters() {
  const url = new URL(window.location.href);

  if (!state.filters.dest.length) {
    url.searchParams.delete("dest");
  } else {
    url.searchParams.set("dest", state.filters.dest.join(","));
  }

  if (!state.filters.style.length) {
    url.searchParams.delete("style");
  } else {
    url.searchParams.set("style", state.filters.style.join(","));
  }

  window.history.replaceState({}, "", url.toString());
}

function getFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  const dest = normalizeFilterSelection(params.get("dest"));
  const style = normalizeFilterSelection(params.get("style"));
  return { dest, style };
}

function normalizeFilterSelection(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item))
      .filter((item) => item && item.toLowerCase() !== "all");
  }
  const text = normalizeText(value);
  if (!text) return [];
  return text
    .split(",")
    .map((item) => normalizeText(item))
    .filter((item) => item && item.toLowerCase() !== "all");
}

function getCheckedValues(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
    .map((option) => normalizeText(option.value))
    .filter(Boolean);
}

function setFilterCheckboxes(container, values) {
  if (!container) return;
  const selected = new Set(Array.isArray(values) ? values.map((item) => normalizeText(item)).filter(Boolean) : []);
  Array.from(container.querySelectorAll('input[type="checkbox"]')).forEach((input) => {
    input.checked = selected.has(normalizeText(input.value));
  });
}

function setupFilterSelectPanels() {
  const controls = [
    { trigger: els.navDestinationTrigger, panel: els.navDestinationPanel },
    { trigger: els.navStyleTrigger, panel: els.navStylePanel }
  ].filter((item) => item.trigger && item.panel);

  if (!controls.length) return;

  const closeAllPanels = () => {
    controls.forEach(({ trigger, panel }) => {
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    });
  };

  controls.forEach(({ trigger, panel }) => {
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = panel.hidden;
      closeAllPanels();
      panel.hidden = !willOpen;
      trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });

    panel.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  });

  document.addEventListener("click", closeAllPanels);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllPanels();
  });
}

async function loadTrips() {
  const cached = getCachedTours();
  if (cached) return cached;

  try {
    const toursRequest = publicToursRequest({
      baseURL: API_BASE_ORIGIN,
      query: { v: TRIPS_REQUEST_VERSION }
    });
    const response = await fetch(toursRequest.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Backend tours request failed with status ${response.status}.`);
    }
    const payload = await response.json();
    const items = normalizeToursForFrontend(Array.isArray(payload) ? payload : payload.items || []);
    setCachedTours(items);
    return items;
  } catch (error) {
    throw error;
  }
}

function normalizeToursForFrontend(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const image = resolveTourImage(item);
    return {
      ...item,
      image
    };
  });
}

function resolveTourImage(item) {
  const raw = String(item?.image || "").trim();
  if (!raw) return raw;
  return absolutizeBackendUrl(raw);
}

function absolutizeBackendUrl(urlValue) {
  const value = String(urlValue || "").trim();
  if (!value) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("assets/") || value.startsWith("./assets/")) {
    return `/${value.replace(/^\.\//, "")}`;
  }
  if (value.startsWith("/assets/")) return value;

  if (value.startsWith("public/v1/")) return `/${value}`;
  if (value.startsWith("/public/v1/")) return value;
  if (!BACKEND_BASE_URL) return value;
  if (value.startsWith("/")) return `${BACKEND_BASE_URL}${value}`;
  return `${BACKEND_BASE_URL}/${value}`;
}


function getCachedTours() {
  try {
    const raw = localStorage.getItem(TOURS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ts = Number(parsed?.ts || 0);
    const items = parsed?.items;
    if (!Array.isArray(items)) return null;
    if (Date.now() - ts > TOURS_CACHE_TTL_MS) return null;
    return normalizeToursForFrontend(items);
  } catch {
    return null;
  }
}

function setCachedTours(items) {
  try {
    localStorage.setItem(
      TOURS_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        items: Array.isArray(items) ? items : []
      })
    );
  } catch {
    // ignore cache write issues
  }
}

function prewarmTourImages(tours) {
  const seen = new Set();
  const urls = [];

  for (const tour of tours) {
    const primary = String(tour.image || "").trim();
    for (const url of [primary]) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
    if (urls.length >= 12) break;
  }

  urls.forEach((url) => {
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.src = url;
  });
}

function setupModal() {
  if (!els.bookingModal) return;

  const openModalButtons = [els.openBookingModal, ...els.openModalButtons].filter(Boolean);
  const resolveAndOpenBookingModalFromButton = (trigger) => {
    const tripId = trigger?.getAttribute?.("data-trip-id");
    if (!tripId) {
      clearSelectedTourContext();
      openBookingModal();
      return;
    }

    const selected = state.trips.find((trip) => trip.id === tripId);
    if (selected) {
      setBookingField("bookingDestination", tourDestinationCountries(selected));
      setBookingField("bookingStyle", selected.styles || []);
      setSelectedTourContext(selected);
      openBookingModal();
      return;
    }

    clearSelectedTourContext();
    openBookingModal();
  };

  openModalButtons.forEach((button) => {
    button.addEventListener("click", () => {
      resolveAndOpenBookingModalFromButton(button);
    });
  });

  els.closeBookingModal.addEventListener("click", closeBookingModal);

  els.bookingModal.addEventListener("click", (event) => {
    if (event.target === els.bookingModal) closeBookingModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.bookingModal.getAttribute("aria-hidden") === "false") {
      closeBookingModal();
    }
  });
}

function openBookingModal() {
  state.bookingSubmitted = false;
  state.formStep = 1;
  prefillBookingFormWithFilters();
  clearBookingFeedback();
  renderFormStep();
  els.bookingModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  const firstInput = els.bookingForm.querySelector(".step.active input:not([type=\"hidden\"]), .step.active select, .step.active textarea");
  if (firstInput) firstInput.focus();
}

function setSelectedTourContext(selectedTour) {
  state.selectedTour = selectedTour
    ? {
      id: normalizeText(selectedTour.id || ""),
      title: normalizeText(selectedTour.title || ""),
      destinations: tourDestinationCountries(selectedTour),
      styles: Array.isArray(selectedTour.styles)
        ? selectedTour.styles.map((item) => normalizeText(item)).filter(Boolean)
        : []
    }
    : null;

  if (els.bookingTourId) {
    els.bookingTourId.value = state.selectedTour?.id || "";
  }
  if (els.bookingTourTitle) {
    els.bookingTourTitle.value = state.selectedTour?.title || "";
  }
}

function clearSelectedTourContext() {
  setSelectedTourContext(null);
}

function closeBookingModal() {
  els.bookingModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function setupFormNavigation() {
  if (!els.bookingForm) return;

  els.stepBack.addEventListener("click", () => {
    if (state.bookingSubmitted) return;
    if (state.formStep > 1) {
      state.formStep -= 1;
      renderFormStep();
    }
  });

  els.stepNext.addEventListener("click", () => {
    if (state.bookingSubmitted) return;
    if (state.formStep < 3) {
      clearBookingFeedback();
      const valid = validateCurrentStep();
      if (!valid) return;
      state.formStep += 1;
      renderFormStep();
      return;
    }

    const valid = validateCurrentStep();
    if (!valid) return;
    submitBookingForm();
  });

  if (els.stepClose) {
    els.stepClose.addEventListener("click", () => {
      closeBookingModal();
    });
  }

  renderFormStep();
}

if (els.showMoreTours) {
  els.showMoreTours.addEventListener("click", () => {
    const remaining = Math.max(0, state.filteredTrips.length - state.visibleToursCount);
    const toShow = Math.min(SHOW_MORE_BATCH, remaining);
    if (!toShow) return;
    state.visibleToursCount += toShow;
    state.showMoreUsed = true;
    renderVisibleTrips();
  });
}

if (els.showAllTours) {
  els.showAllTours.addEventListener("click", () => {
    state.visibleToursCount = state.filteredTrips.length;
    renderVisibleTrips();
  });
}

if (els.debugPriorityBtn && els.debugPriorityOutput) {
  els.debugPriorityBtn.addEventListener("click", () => {
    const isHidden = els.debugPriorityOutput.hidden;
    els.debugPriorityOutput.hidden = !isHidden;
    if (isHidden) renderPriorityDebug();
  });
}

function renderFormStep() {
  els.formSteps.forEach((step) => {
    const isCurrent = Number(step.getAttribute("data-step")) === state.formStep;
    step.classList.toggle("active", isCurrent);
  });

  els.progressSteps.forEach((step) => {
    const index = Number(step.getAttribute("data-step"));
    step.classList.toggle("active", index <= state.formStep);
  });

  els.stepBack.style.visibility = state.formStep === 1 ? "hidden" : "visible";
  els.stepBack.disabled = state.bookingSubmitted || state.formStep === 1;
  els.stepNext.hidden = state.bookingSubmitted;
  els.stepNext.disabled = state.bookingSubmitted;
  els.stepNext.textContent = state.formStep === 3 ? "Submit request" : "Next";
  if (els.stepClose) {
    els.stepClose.hidden = !state.bookingSubmitted;
    els.stepClose.disabled = false;
  }
}

function validateCurrentStep() {
  const activeStep = els.bookingForm.querySelector(`.step[data-step="${state.formStep}"]`);
  if (!activeStep) return true;

  let isValid = true;
  let travelersRangeError = "";
  const fields = activeStep.querySelectorAll(".field");

  fields.forEach((field) => {
    field.classList.remove("invalid");
    const input = field.querySelector("input, select, textarea");
    if (!input || !input.hasAttribute("required")) return;

    if (input.type === "checkbox") {
      if (!input.checked) {
        field.classList.add("invalid");
        isValid = false;
      }
      return;
    }

    const value = input.value.trim();
    const isEmail = input.type === "email";
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const isNumber = input.type === "number";

    if (!value || (isEmail && !emailValid)) {
      field.classList.add("invalid");
      isValid = false;
      return;
    }

    if (isNumber) {
      const numeric = Number(value);
      const minAttr = Number(input.getAttribute("min"));
      const maxAttr = Number(input.getAttribute("max"));
      const min = Number.isFinite(minAttr) ? minAttr : null;
      const max = Number.isFinite(maxAttr) ? maxAttr : null;
      const belowMin = min !== null && numeric < min;
      const aboveMax = max !== null && numeric > max;

      if (!Number.isFinite(numeric) || belowMin || aboveMax) {
        field.classList.add("invalid");
        isValid = false;
        if (!travelersRangeError && (input.id === "bookingTravelers" || input.name === "travelers")) {
          const minDisplay = min !== null ? min : MIN_TRAVELERS;
          const maxDisplay = max !== null ? max : MAX_TRAVELERS;
          travelersRangeError = `Travelers must be between ${minDisplay} and ${maxDisplay}.`;
        }
      }
    }
  });

  if (travelersRangeError) {
    renderBookingError(travelersRangeError);
  }

  return isValid;
}

async function submitBookingForm() {
  clearBookingFeedback();
  els.stepNext.disabled = true;
  els.stepBack.disabled = true;

  const formData = new FormData(els.bookingForm);
  const entries = Object.fromEntries(formData.entries());
  const selectedDestinations = formData.getAll("destination").map((value) => normalizeText(value)).filter(Boolean);
  const selectedStyles = formData.getAll("style").map((value) => normalizeText(value)).filter(Boolean);
  const rawTravelersValue = normalizeText(entries.travelers);
  const travelersValue = rawTravelersValue ? Number.parseInt(rawTravelersValue, 10) : null;

  if (rawTravelersValue && (!Number.isInteger(travelersValue) || travelersValue < MIN_TRAVELERS || travelersValue > MAX_TRAVELERS)) {
    renderBookingError(`Travelers must be between ${MIN_TRAVELERS} and ${MAX_TRAVELERS}.`);
    els.stepNext.disabled = false;
    els.stepBack.disabled = false;
    const travelersField = document.getElementById("bookingTravelers")?.closest(".field");
    if (travelersField) {
      travelersField.classList.add("invalid");
    }
    return;
  }

  const payload = {
    destination: selectedDestinations,
    style: selectedStyles,
    travelMonth: entries.travelMonth || "",
    preferredCurrency: normalizeCurrencyCode(entries.preferredCurrency || DEFAULT_BOOKING_CURRENCY),
    duration: entries.duration || "",
    travelers: travelersValue,
    budget: entries.budget || "",
    name: entries.name || "",
    email: entries.email || "",
    phone_number: entries.phone || "",
    preferred_language: entries.language || "",
    notes: entries.notes || "",
    tourId: entries.tourId || "",
    tourTitle: entries.tourTitle || "",
    pageUrl: window.location.href,
    referrer: document.referrer || "",
    utm_source: getQueryParam("utm_source"),
    utm_medium: getQueryParam("utm_medium"),
    utm_campaign: getQueryParam("utm_campaign")
  };

  const idempotencyKey = `booking_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  try {
    const bookingRequest = publicBookingsRequest({ baseURL: API_BASE_ORIGIN });
    const response = await fetch(bookingRequest.url, {
      method: bookingRequest.method,
      headers: {
        ...(bookingRequest.headers || {}),
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(buildBookingSubmissionDebugMessage(response.status, response.statusText, responseText));
    }
    state.bookingSubmitted = true;
    els.success.classList.add("show");
    els.stepNext.hidden = true;
    els.stepNext.disabled = true;
    els.stepNext.classList.remove("is-submitted");
    els.stepBack.disabled = true;
    if (els.stepClose) {
      els.stepClose.hidden = false;
      els.stepClose.disabled = false;
    }
    return;
  } catch (error) {
    renderBookingError(
      "We could not submit your request right now.",
      error?.message || "Unknown booking submission error."
    );
    els.stepNext.disabled = false;
    els.stepNext.classList.remove("is-submitted");
    els.stepBack.disabled = false;
    console.error(error);
  }
}

function clearBookingFeedback() {
  if (els.error) {
    els.error.replaceChildren();
    els.error.classList.remove("show");
  }
  if (els.success) {
    els.success.classList.remove("show");
  }
  if (els.stepNext) {
    els.stepNext.hidden = state.bookingSubmitted;
    els.stepNext.disabled = state.bookingSubmitted;
    els.stepNext.classList.toggle("is-submitted", state.bookingSubmitted);
    if (els.stepClose) {
      els.stepClose.hidden = true;
    }
  }
  if (els.stepBack) {
    els.stepBack.disabled = state.bookingSubmitted || state.formStep === 1;
  }
}

function renderBookingError(message, debugMessage) {
  if (!els.error) return;

  const summary = document.createElement("p");
  summary.className = "booking-error-summary";
  summary.textContent = message;
  els.error.appendChild(summary);

  if (debugMessage) {
    const details = document.createElement("details");
    details.className = "booking-error-details";

    const detailsSummary = document.createElement("summary");
    detailsSummary.textContent = "More";
    details.appendChild(detailsSummary);

    const debug = document.createElement("pre");
    debug.className = "booking-error-debug";
    debug.textContent = debugMessage;
    details.appendChild(debug);

    els.error.appendChild(details);
  }

  els.error.classList.add("show");
}

function buildBookingSubmissionDebugMessage(status, statusText, responseText) {
  const suffix = normalizeBookingDebugText(responseText);
  const header = `Booking API request failed with HTTP ${status}${statusText ? ` ${statusText}` : ""}.`;
  return suffix ? `${header}\n\n${suffix}` : header;
}

function normalizeBookingDebugText(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > 4000 ? `${text.slice(0, 4000)}\n\n[truncated]` : text;
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || "";
}

function prefillBookingFormWithFilters() {
  const bookingDestinations = state.selectedTour?.destinations || state.filters.dest;
  const bookingStyles = state.selectedTour?.styles || state.filters.style;
  setBookingField("bookingDestination", bookingDestinations);
  setBookingField("bookingStyle", bookingStyles);
  if (els.bookingStepTitle) {
    els.bookingStepTitle.textContent = els.toursTitle?.textContent || "Featured tours you can tailor";
  }
  updateBookingModalTitle();
}

function setBookingField(id, value) {
  const field = document.getElementById(id);
  if (!field || !value) return;

  const values = Array.isArray(value) ? value.map((item) => normalizeText(item)).filter(Boolean) : [normalizeText(value)];
  if (field.hasAttribute("data-booking-static-list")) {
    renderBookingStaticField(field, values);
    return;
  }
  if (!values.length) return;

  const optionValues = new Set(Array.from(field.options || []).map((option) => option.value));
  if (field.multiple) {
    Array.from(field.options || []).forEach((option) => {
      option.selected = values.includes(option.value);
    });
    return;
  }

  const firstMatch = values.find((item) => optionValues.has(item));
  if (firstMatch) {
    field.value = firstMatch;
  }
}

function renderBookingStaticField(field, values) {
  const inputName = normalizeText(field.getAttribute("data-booking-input-name"));
  const emptyLabel = normalizeText(field.getAttribute("data-empty-label")) || "Not selected";
  const items = Array.isArray(values) ? values.filter(Boolean) : [];
  const summary = items.length ? items.join(", ") : emptyLabel;
  const hiddenInputs = inputName
    ? items
      .map((item) => `<input type="hidden" name="${escapeAttr(inputName)}" value="${escapeAttr(item)}" />`)
      .join("")
    : "";
  field.innerHTML = `<span class="booking-static-field__text">${escapeHTML(summary)}</span>${hiddenInputs}`;
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHTML(value);
}
