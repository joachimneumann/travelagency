/*
  Beginner-editable configuration:
  - Tour catalog is loaded from backend endpoint /public/v1/tours
*/

import { publicBookingsRequest } from "../Generated/API/generated_APIRequestFactory.js";
import {
  PUBLIC_BOOKING_CREATE_REQUEST_SCHEMA,
  validatePublicBookingCreateRequest
} from "../Generated/API/generated_APIModels.js";
import { normalizeText } from "../../shared/js/text.js";
import { logBrowserConsoleError } from "./shared/api.js";
import { fetchAuthMe } from "./shared/auth.js";
import { createFrontendBookingFormOptionsController } from "./main_booking_form_options.js";
import { createFrontendToursController } from "./main_tours.js";

function frontendT(id, fallback, vars) {
  if (typeof window.frontendT === "function") {
    return window.frontendT(id, fallback, vars);
  }
  const template = String(fallback ?? id);
  if (!vars || typeof vars !== "object") return template;
  return template.replace(/\{([^{}]+)\}/g, (match, key) => {
    const normalizedKey = String(key || "").trim();
    return normalizedKey in vars ? String(vars[normalizedKey]) : match;
  });
}

async function waitForFrontendI18n() {
  await (window.__FRONTEND_I18N_PROMISE || Promise.resolve());
}

function currentFrontendLang() {
  return typeof window.frontendI18n?.getLang === "function" ? window.frontendI18n.getLang() : "en";
}

function withLangUrl(pathname) {
  const url = new URL(pathname, window.location.origin);
  const lang = currentFrontendLang();
  if (lang) url.searchParams.set("lang", lang);
  return url.toString();
}

const state = {
  lang: currentFrontendLang(),
  trips: [],
  filteredTrips: [],
  filterOptions: {
    destinations: [],
    styles: []
  },
  filters: {
    dest: [],
    style: []
  },
  rankedTripsDebug: [],
  formStep: 1,
  bookingSubmitted: false,
  visibleToursCount: 3,
  showMoreUsed: false,
  selectedTour: null,
  websiteAuthenticated: false
};

let lastBookingModalTrigger = null;

const TRIPS_REQUEST_VERSION = Date.now();
const INITIAL_VISIBLE_TOURS = 3;
const SHOW_MORE_BATCH = 3;
const TOURS_CACHE_TTL_MS = 5 * 60 * 1000;
const BACKEND_BASE_URL = window.ASIATRAVELPLAN_API_BASE ? window.ASIATRAVELPLAN_API_BASE.replace(/\/$/, "") : "";
const API_BASE_ORIGIN = BACKEND_BASE_URL || window.location.origin;
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
  bookingDuration: document.getElementById("bookingDuration"),
  bookingLanguage: document.getElementById("bookingLanguage"),
  bookingMonth: document.getElementById("bookingMonth"),
  bookingMonthMonth: document.getElementById("bookingMonthMonth"),
  bookingMonthYear: document.getElementById("bookingMonthYear"),
  bookingDestinationTrigger: document.getElementById("bookingDestinationTrigger"),
  bookingDestinationSummary: document.getElementById("bookingDestinationSummary"),
  bookingDestinationPanel: document.getElementById("bookingDestinationPanel"),
  bookingDestinationOptions: document.getElementById("bookingDestinationOptions"),
  bookingStyleTrigger: document.getElementById("bookingStyleTrigger"),
  bookingStyleSummary: document.getElementById("bookingStyleSummary"),
  bookingStylePanel: document.getElementById("bookingStylePanel"),
  bookingStyleOptions: document.getElementById("bookingStyleOptions"),
  booking_tour_id: document.getElementById("booking_tour_id"),
  stepBack: document.getElementById("stepBack"),
  stepClose: document.getElementById("stepClose"),
  stepNext: document.getElementById("stepNext"),
  formNav: document.querySelector(".form-nav"),
  progressSteps: document.querySelectorAll(".progress-step"),
  formSteps: document.querySelectorAll(".step"),
  bookingStepTitle: document.getElementById("bookingStepTitle"),
  error: document.getElementById("bookingError"),
  bookingModalContent: document.getElementById("bookingModalContent"),
  bookingStepThreeTitle: document.getElementById("bookingStepThreeTitle"),
  bookingStepThreeContent: document.getElementById("bookingStepThreeContent"),
  bookingSuccessState: document.getElementById("bookingSuccessState"),
  bookingSuccessCloseBtn: document.getElementById("bookingSuccessCloseBtn")
};

const bookingFormOptionsController = createFrontendBookingFormOptionsController({
  els,
  state,
  frontendT,
  currentFrontendLang,
  syncLocalizedControlLanguage,
  escapeHTML,
  escapeAttr,
  publicBookingCreateRequestSchema: PUBLIC_BOOKING_CREATE_REQUEST_SCHEMA
});
const {
  DEFAULT_BOOKING_CURRENCY,
  MAX_TRAVELERS,
  MIN_TRAVELERS,
  approximateDisplayAmountFromUSD,
  buildFirstTravelMonthValue,
  findBudgetOptionValueByLowerUSD,
  findTravelDurationOptionByDays,
  formatDisplayMoney,
  getSelectedBudgetOption,
  normalizeCurrencyCode,
  parseTravelDurationRange,
  preferredBookingLanguageForFrontendLang,
  preferredCurrencyForFrontendLang,
  preferredCurrencyForLanguageValue,
  renderBudgetOptions,
  setTravelMonthValue,
  setupBookingBudgetOptions,
  setupTravelMonthControls
} = bookingFormOptionsController;
const toursController = createFrontendToursController({
  state,
  els,
  apiBaseOrigin: API_BASE_ORIGIN,
  backendBaseUrl: BACKEND_BASE_URL,
  tripsRequestVersion: TRIPS_REQUEST_VERSION,
  initialVisibleTours: INITIAL_VISIBLE_TOURS,
  showMoreBatch: SHOW_MORE_BATCH,
  toursCacheTtlMs: TOURS_CACHE_TTL_MS,
  frontendT,
  currentFrontendLang,
  preferredCurrencyForFrontendLang,
  approximateDisplayAmountFromUSD,
  formatDisplayMoney,
  defaultBookingCurrency: DEFAULT_BOOKING_CURRENCY,
  escapeHTML,
  escapeAttr,
  updateBookingModalTitle,
  openBookingModal,
  setSelectedTourContext,
  clearSelectedTourContext,
  setBookingField,
  prefillBookingFormWithFilters
});
const {
  applyFilters,
  filterLabels,
  getCheckedValues,
  getFiltersFromURL,
  loadTrips,
  normalizeActiveFiltersFromOptions,
  normalizeFilterSelection,
  prewarmTourImages,
  populateFilterOptions,
  renderPriorityDebug,
  renderVisibleTrips,
  resolveLocalizedFrontendText,
  setFilterCheckboxes,
  setupFilterEvents,
  setupFilterSelectPanels,
  syncFilterInputs,
  tourDestinations
} = toursController;

init();

async function init() {
  await waitForFrontendI18n();
  state.lang = currentFrontendLang();
  syncI18nManagedLabels();
  setupTravelMonthControls();
  setupMobileNav();
  setupFAQ();
  setupHeroScroll();
  setupBackendLogin();
  setupHiddenBackendQuickLogin();
  loadWebsiteAuthStatus();
  setupModal();
  setupFormNavigation();
  setupLiveValidationReset();
  applyTravelerBoundsFromModel();
  setupBookingBudgetOptions();

  const savedFilters = JSON.parse(localStorage.getItem("asiatravelplan_filters") || "null");
  const urlFilters = getFiltersFromURL();
  state.filters.dest = normalizeFilterSelection(urlFilters.dest.length ? urlFilters.dest : savedFilters?.dest);
  state.filters.style = normalizeFilterSelection(urlFilters.style.length ? urlFilters.style : savedFilters?.style);

  try {
    const toursPayload = await loadTrips();
    state.trips = Array.isArray(toursPayload?.items) ? toursPayload.items : [];
    state.filterOptions.destinations = Array.isArray(toursPayload?.available_destinations)
      ? toursPayload.available_destinations
      : [];
    state.filterOptions.styles = Array.isArray(toursPayload?.available_styles)
      ? toursPayload.available_styles
      : [];
  } catch (error) {
    console.error("Failed to load tours from backend API.", error);
    state.trips = [];
    state.filterOptions.destinations = [];
    state.filterOptions.styles = [];
  }
  normalizeActiveFiltersFromOptions();
  prewarmTourImages(state.trips);

  populateFilterOptions();
  setupFilterSelectPanels();
  syncFilterInputs();
  applyFilters();
  setupFilterEvents();
  prefillBookingFormWithFilters();
}

function syncI18nManagedLabels() {
  const bookingDestinationField = document.getElementById("bookingDestination");
  const bookingStyleField = document.getElementById("bookingStyle");
  const privacyLink = document.querySelector('a[href="/privacy.html"]');
  if (bookingDestinationField) {
    bookingDestinationField.setAttribute("data-empty-label", frontendT("filters.all_destinations", "All destinations"));
  }
  if (bookingStyleField) {
    bookingStyleField.setAttribute("data-empty-label", frontendT("filters.all_styles", "All travel styles"));
  }
  if (privacyLink) {
    privacyLink.setAttribute("href", withLangUrl("/privacy.html"));
  }
  syncLocalizedControlLanguage();
  updateBackendButtonLabel({ authenticated: state.websiteAuthenticated, user: "" });
}

function syncLocalizedControlLanguage() {
  document.documentElement.lang = state.lang || currentFrontendLang() || "en";
  const languageDirection = typeof window.frontendI18n?.getDirection === "function"
    ? window.frontendI18n.getDirection()
    : "ltr";
  [
    els.bookingPreferredCurrency,
    els.bookingBudget,
    els.bookingDuration,
    els.bookingLanguage,
    els.bookingMonthMonth,
    els.bookingMonthYear
  ].filter(Boolean).forEach((control) => {
    control.setAttribute("lang", state.lang || "en");
    control.setAttribute("dir", languageDirection);
  });
  if (els.bookingMonthMonth) {
    els.bookingMonthMonth.setAttribute("aria-label", frontendT("modal.month.select_month", "Select month"));
  }
  if (els.bookingMonthYear) {
    els.bookingMonthYear.setAttribute("aria-label", frontendT("modal.month.select_year", "Select year"));
  }
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
  if (!els.faqList || els.faqList.dataset.faqBound === "1") return;
  els.faqList.dataset.faqBound = "1";

  els.faqList.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest(".faq-question") : null;
    if (!button || !els.faqList.contains(button)) return;

    const item = button.closest(".faq-item");
    if (!item) return;

    const open = item.classList.contains("open");
    item.classList.toggle("open", !open);
    button.setAttribute("aria-expanded", String(!open));

    const icon = button.querySelector('[aria-hidden="true"]');
    if (icon) icon.textContent = open ? "+" : "−";
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

  els.backendLoginBtn.addEventListener("click", () => {
    const backendUrl = withLangUrl("/backend.html");
    if (state.websiteAuthenticated) {
      window.location.href = backendUrl;
      return;
    }
    const loginParams = new URLSearchParams({
      return_to: backendUrl,
      prompt: "login"
    });
    const loginUrl = `${API_BASE_ORIGIN}/auth/login?${loginParams.toString()}`;
    const freshLoginUrl = `${API_BASE_ORIGIN}/auth/logout?return_to=${encodeURIComponent(loginUrl)}`;
    window.location.href = freshLoginUrl;
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

    const backendUrl = withLangUrl("/backend.html");
    const loginParams = new URLSearchParams({
      return_to: backendUrl,
      quick_login: "1"
    });
    window.location.href = `${BACKEND_BASE_URL}/auth/login?${loginParams.toString()}`;
  });
}

async function loadWebsiteAuthStatus() {
  if (!els.backendLoginContainer) return;

  try {
    const { response, payload } = await fetchAuthMe(BACKEND_BASE_URL);
    if (!response.ok || !payload?.authenticated) {
      state.websiteAuthenticated = false;
      placeBackendLogin(false);
      updateBackendButtonLabel({ authenticated: false, user: "" });
      return;
    }
    const user = payload.user?.preferred_username || payload.user?.email || payload.user?.sub || "authenticated user";
    state.websiteAuthenticated = true;
    placeBackendLogin(true);
    updateBackendButtonLabel({ authenticated: true, user });
  } catch {
    state.websiteAuthenticated = false;
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
    els.backendLoginBtnTitle.textContent = frontendT("backend.button_short", "Backend");
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

  els.backendLoginBtnTitle.textContent = frontendT("backend.button_full", "AsiaTravelPlan Backend");
  if (subtitleEl) {
    subtitleEl.textContent = "";
    subtitleEl.hidden = true;
  }
  if (statusEl) {
    statusEl.textContent = "";
    statusEl.hidden = true;
  }
}

function formatActiveFilterValue(values, kind) {
  if (Array.isArray(values) && values.length) return filterLabels(values, kind).join(", ");
  return kind === "destination"
    ? frontendT("filters.all_destinations", "All destinations")
    : frontendT("filters.all_styles", "All travel styles");
}

function updateBookingModalTitle() {
  if (!els.bookingTitle) return;
  const dest = state.filters.dest;
  const style = state.filters.style;
  const destLabel = formatActiveFilterValue(dest, "destination");
  const styleLabel = formatActiveFilterValue(style, "style");
  const styleLower = String(styleLabel || "").toLowerCase();

  let title = frontendT("modal.title.default", "Plan your trip with AsiaTravelPlan");
  if (dest.length && style.length) {
    title = frontendT("modal.title.destination_style", "Plan your {styleLower} tour in {destination}", {
      styleLower,
      destination: destLabel
    });
  } else if (dest.length) {
    title = frontendT("modal.title.destination", "Plan your tour in {destination}", { destination: destLabel });
  } else if (style.length) {
    title = frontendT("modal.title.style", "Plan your {styleLower} tour", { styleLower });
  }

  els.bookingTitle.textContent = title;
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
      setBookingField("bookingDestination", tourDestinations(selected));
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
      lastBookingModalTrigger = button;
      resolveAndOpenBookingModalFromButton(button);
    });
  });

  els.closeBookingModal.addEventListener("click", closeBookingModal);
  if (els.bookingSuccessCloseBtn) {
    els.bookingSuccessCloseBtn.addEventListener("click", closeBookingModal);
  }

  els.bookingModal.addEventListener("click", (event) => {
    if (event.target === els.bookingModal) closeBookingModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.bookingModal.hidden) {
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
  els.bookingModal.hidden = false;
  document.body.style.overflow = "hidden";
  const firstInput = els.bookingForm.querySelector(".step.active input:not([type=\"hidden\"]), .step.active select, .step.active textarea");
  if (firstInput) firstInput.focus();
}

function setSelectedTourContext(selectedTour) {
  state.selectedTour = selectedTour
    ? {
      id: normalizeText(selectedTour.id || ""),
      title: resolveLocalizedFrontendText(selectedTour.title, state.lang),
      destinations: tourDestinations(selectedTour),
      styles: Array.isArray(selectedTour.styles)
        ? selectedTour.styles.map((item) => normalizeText(item)).filter(Boolean)
        : [],
      seasonality_start_month: normalizeText(selectedTour.seasonality_start_month),
      travel_duration_days: Number.isFinite(Number(selectedTour.travel_duration_days))
        ? Number(selectedTour.travel_duration_days)
        : null,
      budget_lower_usd: Number.isFinite(Number(selectedTour.budget_lower_usd))
        ? Number(selectedTour.budget_lower_usd)
        : null
    }
    : null;

  if (els.booking_tour_id) {
    els.booking_tour_id.value = state.selectedTour?.id || "";
  }
}

function clearSelectedTourContext() {
  setSelectedTourContext(null);
}

function closeBookingModal() {
  const active = document.activeElement;
  if (active instanceof HTMLElement && els.bookingModal.contains(active)) {
    active.blur();
  }
  els.bookingModal.hidden = true;
  document.body.style.overflow = "";
  if (lastBookingModalTrigger instanceof HTMLElement && document.contains(lastBookingModalTrigger)) {
    lastBookingModalTrigger.focus();
  }
}

function setupFormNavigation() {
  if (!els.bookingForm) return;

  els.stepBack.addEventListener("click", () => {
    if (state.bookingSubmitted) return;
    goToFormStep(state.formStep - 1);
  });

  els.stepNext.addEventListener("click", () => {
    if (state.bookingSubmitted) return;
    if (state.formStep < 3) {
      clearBookingFeedback();
      const valid = validateCurrentStep();
      if (!valid) return;
      goToFormStep(state.formStep + 1);
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

function setupLiveValidationReset() {
  if (!els.bookingForm || els.bookingForm.dataset.liveValidationResetBound === "1") return;

  const clearRequireOneOfFieldState = (stepRoot) => {
    const contactNames = new Set(["email", "phone_number"]);
    const contactInputs = Array.from(stepRoot.querySelectorAll("input[name], select[name], textarea[name]"))
      .filter((input) => contactNames.has(input.name));
    const hasContactValue = contactInputs.some((input) => normalizeText(input.value) !== "");
    if (!hasContactValue) return;
    contactInputs.forEach((input) => {
      input.closest(".field")?.classList.remove("invalid");
    });
  };

  const handleEdit = (event) => {
    if (state.bookingSubmitted) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const field = target.closest(".field");
    if (field) {
      field.classList.remove("invalid");
    }

    const activeStep = els.bookingForm.querySelector(`.step[data-step="${state.formStep}"]`);
    if (activeStep) {
      clearRequireOneOfFieldState(activeStep);
    }

    clearBookingFeedback();
  };

  els.bookingForm.addEventListener("input", handleEdit);
  els.bookingForm.addEventListener("change", handleEdit);
  els.bookingForm.dataset.liveValidationResetBound = "1";
}

function goToFormStep(step) {
  const nextStep = Math.max(1, Math.min(3, Number(step) || 1));
  if (nextStep === state.formStep) return;
  state.formStep = nextStep;
  clearBookingFeedback();
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
  els.stepNext.textContent = state.formStep === 3
    ? frontendT("modal.nav.submit", "Submit request")
    : frontendT("modal.nav.next", "Next");
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
        if (!travelersRangeError && (input.id === "bookingTravelers" || input.name === "number_of_travelers")) {
          const minDisplay = min !== null ? min : MIN_TRAVELERS;
          const maxDisplay = max !== null ? max : MAX_TRAVELERS;
          travelersRangeError = frontendT(
            "modal.error.travelers_between",
            "Travelers must be between {min} and {max}.",
            { min: minDisplay, max: maxDisplay }
          );
        }
      }
    }
  });

  const stepInputs = Array.from(activeStep.querySelectorAll("input[name], select[name], textarea[name]"));
  const stepNames = new Set(stepInputs.map((input) => input.name).filter(Boolean));
  const requireOneOfGroups = Array.isArray(PUBLIC_BOOKING_CREATE_REQUEST_SCHEMA?.requireOneOf)
    ? PUBLIC_BOOKING_CREATE_REQUEST_SCHEMA.requireOneOf
    : [];
  requireOneOfGroups.forEach((group) => {
    if (!Array.isArray(group) || !group.some((fieldName) => stepNames.has(fieldName))) return;
    const hasValue = group.some((fieldName) => {
      const input = stepInputs.find((candidate) => candidate.name === fieldName);
      return normalizeText(input?.value) !== "";
    });
    if (hasValue) return;
    group.forEach((fieldName) => {
      const input = stepInputs.find((candidate) => candidate.name === fieldName);
      const field = input?.closest(".field");
      if (field) field.classList.add("invalid");
    });
    renderBookingError(frontendT("modal.error.email_or_phone", "Please enter an email or phone number."));
    isValid = false;
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
  const selectedDestinations = formData.getAll("destinations").map((value) => normalizeText(value)).filter(Boolean);
  const selectedStyles = formData.getAll("travel_style").map((value) => normalizeText(value)).filter(Boolean);
  const rawTravelersValue = normalizeText(entries.number_of_travelers);
  const travelersValue = rawTravelersValue ? Number.parseInt(rawTravelersValue, 10) : null;
  const selectedBudgetOption = getSelectedBudgetOption(
    entries.preferred_currency || DEFAULT_BOOKING_CURRENCY,
    els.bookingBudget?.value || "not_decided_yet"
  );
  const selectedDurationRange = parseTravelDurationRange(els.bookingDuration?.value || "");

  if (rawTravelersValue && (!Number.isInteger(travelersValue) || travelersValue < MIN_TRAVELERS || travelersValue > MAX_TRAVELERS)) {
    renderBookingError(
      frontendT("modal.error.travelers_between", "Travelers must be between {min} and {max}.", {
        min: MIN_TRAVELERS,
        max: MAX_TRAVELERS
      })
    );
    els.stepNext.disabled = false;
    els.stepBack.disabled = false;
    const travelersField = document.getElementById("bookingTravelers")?.closest(".field");
    if (travelersField) {
      travelersField.classList.add("invalid");
    }
    return;
  }

  const payload = {
    destinations: selectedDestinations,
    travel_style: selectedStyles,
    travel_month: entries.travel_month || "",
    number_of_travelers: travelersValue,
    preferred_currency: normalizeCurrencyCode(entries.preferred_currency || DEFAULT_BOOKING_CURRENCY),
    travel_duration_days_min: selectedDurationRange.min,
    travel_duration_days_max: selectedDurationRange.max,
    budget_lower_usd: selectedBudgetOption.budgetLowerUSD,
    budget_upper_usd: selectedBudgetOption.budgetUpperUSD,
    name: entries.name || "",
    email: entries.email || "",
    phone_number: entries.phone_number || "",
    preferred_language: entries.preferred_language || "",
    notes: entries.notes || "",
    booking_name: resolveLocalizedFrontendText(state.selectedTour?.title, state.lang) || "",
    tour_id: entries.tour_id || "",
    page_url: window.location.href,
    referrer: document.referrer || "",
    utm_source: getQueryParam("utm_source"),
    utm_medium: getQueryParam("utm_medium"),
    utm_campaign: getQueryParam("utm_campaign")
  };
  const idempotency_key = `booking_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  try {
    validatePublicBookingCreateRequest(payload);
    const bookingRequest = publicBookingsRequest({ baseURL: API_BASE_ORIGIN });
    const response = await fetch(bookingRequest.url, {
      method: bookingRequest.method,
      headers: {
        ...(bookingRequest.headers || {}),
        "Content-Type": "application/json",
        "Idempotency-Key": idempotency_key
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(buildBookingSubmissionDebugMessage(response.status, response.statusText, responseText));
    }
    state.bookingSubmitted = true;
    state.formStep = 3;
    renderFormStep();
    if (els.bookingStepThreeTitle) els.bookingStepThreeTitle.hidden = true;
    if (els.bookingStepThreeContent) els.bookingStepThreeContent.hidden = true;
    if (els.bookingSuccessState) els.bookingSuccessState.hidden = false;
    if (els.formNav) {
      els.formNav.hidden = true;
    }
    return;
  } catch (error) {
    renderBookingError(
      frontendT("modal.error.submit", "We could not submit your request right now."),
      error?.message || "Unknown booking submission error."
    );
    els.stepNext.disabled = false;
    els.stepNext.classList.remove("is-submitted");
    els.stepBack.disabled = false;
    logBrowserConsoleError("[website-booking] Booking form submission failed.", {
      current_url: window.location.href,
      selected_tour_id: state.selectedTour?.id || null,
      current_step: state.formStep
    }, error);
  }
}

function clearBookingFeedback() {
  if (els.error) {
    els.error.replaceChildren();
    els.error.classList.remove("show");
  }
  if (els.bookingModalContent) {
    els.bookingModalContent.hidden = false;
  }
  if (els.bookingStepThreeTitle) {
    els.bookingStepThreeTitle.hidden = false;
  }
  if (els.bookingStepThreeContent) {
    els.bookingStepThreeContent.hidden = false;
  }
  if (els.bookingSuccessState) {
    els.bookingSuccessState.hidden = true;
  }
  if (els.formNav) {
    els.formNav.hidden = false;
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
    detailsSummary.textContent = frontendT("modal.error.more", "More");
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
  const statusSuffix = statusText ? ` ${statusText}` : "";
  const header = frontendT("modal.error.http", "Booking API request failed with HTTP {status}{statusText}.", {
    status,
    statusText: statusSuffix
  });
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
  const bookingDestinations = state.selectedTour?.destinations || filterLabels(state.filters.dest, "destination");
  const bookingStyles = state.selectedTour?.styles || filterLabels(state.filters.style, "style");
  setBookingField("bookingDestination", bookingDestinations);
  setBookingField("bookingStyle", bookingStyles);
  if (state.selectedTour) {
    const firstTravelMonth = buildFirstTravelMonthValue(state.selectedTour.seasonality_start_month);
    const bookingMonth = document.getElementById("bookingMonth");
    if (bookingMonth && firstTravelMonth) {
      setTravelMonthValue(firstTravelMonth);
    }
    const bookingDuration = document.getElementById("bookingDuration");
    if (bookingDuration) {
      bookingDuration.value = findTravelDurationOptionByDays(state.selectedTour.travel_duration_days);
    }
    const preferredCurrency = normalizeCurrencyCode(els.bookingPreferredCurrency?.value || DEFAULT_BOOKING_CURRENCY);
    renderBudgetOptions(preferredCurrency);
    if (els.bookingBudget) {
      els.bookingBudget.value = findBudgetOptionValueByLowerUSD(
        preferredCurrency,
        state.selectedTour.budget_lower_usd,
        state.selectedTour.travel_duration_days
      );
    }
  }
  if (els.bookingStepTitle) {
    els.bookingStepTitle.textContent = els.toursTitle?.textContent || frontendT("modal.booking_step_title_fallback", "Featured tours you can tailor");
  }
  updateBookingModalTitle();
}

function setBookingField(id, value) {
  const field = document.getElementById(id);
  if (!field) return;

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
  const emptyLabel = normalizeText(field.getAttribute("data-empty-label")) || frontendT("filters.all_destinations", "All destinations");
  const items = Array.isArray(values) ? values.filter(Boolean) : [];
  const summary = items.length ? items.join(", ") : emptyLabel;
  const hiddenInputs = inputName
    ? items
      .map((item) => `<input type="hidden" name="${escapeAttr(inputName)}" value="${escapeAttr(item)}" />`)
      .join("")
    : "";
  field.innerHTML = `<span class="booking-static-field__text">${escapeHTML(summary)}</span>${hiddenInputs}`;
  syncBookingSelectionUi(field.id, items, emptyLabel);
}

function updateBookingSelectionFromOptions(fieldId, optionsContainer) {
  const values = getCheckedValues(optionsContainer);
  setBookingField(fieldId, values);
}

function syncBookingSelectionUi(fieldId, values, emptyLabel = "Not selected") {
  const selectedValues = Array.isArray(values) ? values.filter(Boolean) : [];
  if (fieldId === "bookingDestination") {
    setFilterCheckboxes(els.bookingDestinationOptions, selectedValues);
    if (els.bookingDestinationSummary) {
      els.bookingDestinationSummary.textContent = selectedValues.length ? selectedValues.join(", ") : emptyLabel;
    }
    return;
  }
  if (fieldId === "bookingStyle") {
    setFilterCheckboxes(els.bookingStyleOptions, selectedValues);
    if (els.bookingStyleSummary) {
      els.bookingStyleSummary.textContent = selectedValues.length ? selectedValues.join(", ") : emptyLabel;
    }
  }
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
