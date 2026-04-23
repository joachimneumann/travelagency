/*
  Beginner-editable configuration:
  - Tour catalog is loaded from generated frontend data files
*/

import { normalizeText } from "../../shared/js/text.js";
import { logBrowserConsoleError } from "./shared/api.js";
import { createFrontendToursController } from "./main_tours.js";

const frontendT = (id, fallback, vars) => {
  if (typeof window.frontendT === "function") {
    return window.frontendT(id, fallback, vars);
  }
  const template = String(fallback ?? id);
  if (!vars || typeof vars !== "object") return template;
  return template.replace(/\{([^{}]+)\}/g, (match, key) => {
    const normalizedKey = String(key || "").trim();
    return normalizedKey in vars ? String(vars[normalizedKey]) : match;
  });
};

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

function resolveFrontendAssetUrl(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith("/public/")) return `${API_BASE_ORIGIN}${normalized}`;
  return normalized;
}

const state = {
  lang: currentFrontendLang(),
  trips: [],
  teamMembers: [],
  teamMembersLoaded: false,
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
  visibleToursCount: 6,
  showMoreUsed: false,
  selectedTour: null,
  selectedTourDescriptionId: "",
  selectedTeamMemberUsername: "",
  companyProfile: null,
  authStatusKnown: false,
  websiteAuthenticated: false,
  websiteAuthenticatedUser: "",
  reelsModeOpen: false
};

let lastBookingModalTrigger = null;
let publicBootstrapLoadPromise = null;
let publicBootstrapLoaded = false;
let footerBootstrapObserved = false;
let tourImagePrewarmToken = 0;
let tourSectionPrewarmObserved = false;
let tourSectionPrewarmTriggered = false;
let teamSectionRevealObserved = false;
let teamMembersLoadPromise = null;
let authStatusLoadPromise = null;
let reelsUnlockTapTimes = [];
let reelsRuntimePromise = null;
let reelsRuntimeInstance = null;

const DEFAULT_BOOKING_CURRENCY = "USD";
const FALLBACK_MIN_TRAVELERS = 1;
const FALLBACK_MAX_TRAVELERS = 30;
const REELS_UNLOCK_KEY = "asiatravelplan_reels_unlocked";
const REELS_UNLOCK_TAP_TARGET = 5;
const REELS_UNLOCK_WINDOW_MS = 3000;
const MONTH_ABBREVIATION_TO_NUMBER = Object.freeze({
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12
});
const bookingRuntime = {
  controller: null,
  publicBookingsRequest: null,
  publicBookingCreateRequestSchema: null,
  validatePublicBookingCreateRequest: null,
  promise: null
};
const authRuntime = {
  fetchAuthMe: null,
  promise: null
};

const INITIAL_VISIBLE_TOURS = 6;
const SHOW_MORE_BATCH = 3;
const BACKEND_BASE_URL = window.ASIATRAVELPLAN_API_BASE ? window.ASIATRAVELPLAN_API_BASE.replace(/\/$/, "") : "";
const API_BASE_ORIGIN = BACKEND_BASE_URL || window.location.origin;
const PUBLIC_BOOTSTRAP_URL = `${API_BASE_ORIGIN}/public/v1/mobile/bootstrap`;
const WEBSITE_AUTH_CACHE_KEY = "asiatravelplan_backend_auth_me_v1";
const els = {
  pageBody: document.body,
  pageHeader: document.querySelector(".header"),
  navToggle: document.getElementById("navToggle"),
  siteNav: document.getElementById("siteNav"),
  mobileReelToggle: document.getElementById("mobileReelToggle"),
  mobileReelLayer: document.getElementById("mobileReelLayer"),
  mobileReelFeed: document.getElementById("mobileReelFeed"),
  brandLogoLink: document.getElementById("brandLogoLink"),
  navDestinationWrap: document.getElementById("navDestinationWrap"),
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
  heroTitle: document.getElementById("heroTitle"),
  backendLoginBtn: document.getElementById("backendLoginBtn"),
  backendLoginBtnTitle: document.getElementById("backendLoginBtnTitle"),
  backendLoginBtnSubtitle: document.getElementById("backendLoginBtnSubtitle"),
  websiteAuthStatus: document.getElementById("websiteAuthStatus"),
  footerLicense: document.getElementById("footerLicense"),
  viewToursBtn: document.getElementById("viewToursBtn"),
  activeFilters: document.getElementById("activeFilters"),
  toursTitle: document.getElementById("toursTitle"),
  toursBooking: document.getElementById("toursBooking"),
  teamSection: document.getElementById("teamSection"),
  teamSectionTitle: document.getElementById("teamSectionTitle"),
  teamSectionBody: document.getElementById("teamSectionBody"),
  teamGrid: document.getElementById("teamGrid"),
  teamDetail: document.getElementById("teamDetail"),
  tourDescriptionDetail: document.getElementById("tourDescriptionDetail"),
  heroDynamicSubtitle: document.getElementById("heroDynamicSubtitle"),
  bookingTitle: document.getElementById("bookingTitle"),
  tourGrid: document.getElementById("tourGrid"),
  tourActions: document.getElementById("tourActions"),
  showMoreTours: document.getElementById("showMoreTours"),
  toursSection: document.getElementById("tours"),
  mainContent: document.getElementById("main-content"),
  footerBrandTitle: document.getElementById("footerBrandTitle"),
  pageFooter: document.querySelector(".footer"),
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

function bookingController() {
  return bookingRuntime.controller;
}

function bookingSchema() {
  return bookingRuntime.publicBookingCreateRequestSchema;
}

function bookingRuntimeLoaded() {
  return Boolean(bookingController());
}

async function ensureBookingRuntime() {
  if (bookingController()) return bookingRuntime;
  if (bookingRuntime.promise) return bookingRuntime.promise;

  bookingRuntime.promise = (async () => {
    const [
      bookingModule,
      requestFactoryModule,
      apiModelsModule
    ] = await Promise.all([
      import("./main_booking_form_options.js"),
      import("../Generated/API/generated_APIRequestFactory.js"),
      import("../Generated/API/generated_APIModels.js")
    ]);

    bookingRuntime.publicBookingsRequest = requestFactoryModule.publicBookingsRequest;
    bookingRuntime.publicBookingCreateRequestSchema = apiModelsModule.PUBLIC_BOOKING_CREATE_REQUEST_SCHEMA;
    bookingRuntime.validatePublicBookingCreateRequest = apiModelsModule.validatePublicBookingCreateRequest;
    bookingRuntime.controller = bookingModule.createFrontendBookingFormOptionsController({
      els,
      state,
      frontendT,
      currentFrontendLang,
      syncLocalizedControlLanguage,
      escapeHTML,
      escapeAttr,
      publicBookingCreateRequestSchema: bookingRuntime.publicBookingCreateRequestSchema
    });

    applyTravelerBoundsFromModel();
    bookingController()?.setupTravelMonthControls?.();
    bookingController()?.setupBookingBudgetOptions?.();

    return bookingRuntime;
  })().finally(() => {
    bookingRuntime.promise = null;
  });

  return bookingRuntime.promise;
}

async function ensureAuthRuntime() {
  if (typeof authRuntime.fetchAuthMe === "function") return authRuntime;
  if (authRuntime.promise) return authRuntime.promise;

  authRuntime.promise = import("./shared/auth.js")
    .then((authModule) => {
      authRuntime.fetchAuthMe = authModule.fetchAuthMe;
      return authRuntime;
    })
    .finally(() => {
      authRuntime.promise = null;
    });

  return authRuntime.promise;
}

function preferredCurrencyForFrontendLang(lang) {
  return bookingController()?.preferredCurrencyForFrontendLang?.(lang) || DEFAULT_BOOKING_CURRENCY;
}

function approximateDisplayAmountFromUSD(amountUSD, currencyCode) {
  return bookingController()?.approximateDisplayAmountFromUSD?.(amountUSD, currencyCode) ?? null;
}

function formatDisplayMoney(amount, currencyCode, locale) {
  if (bookingController()?.formatDisplayMoney) {
    return bookingController().formatDisplayMoney(amount, currencyCode, locale);
  }
  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount)) return "";
  return new Intl.NumberFormat(locale || state.lang || currentFrontendLang() || "en", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    useGrouping: true
  }).format(normalizedAmount);
}

function normalizeCurrencyCode(value) {
  const normalized = bookingController()?.normalizeCurrencyCode?.(value);
  if (normalized) return normalized;
  const fallback = normalizeText(value).toUpperCase();
  return fallback || DEFAULT_BOOKING_CURRENCY;
}

function preferredBookingLanguageForFrontendLang(lang) {
  return bookingController()?.preferredBookingLanguageForFrontendLang?.(lang) || "en";
}

function preferredCurrencyForLanguageValue(value) {
  return bookingController()?.preferredCurrencyForLanguageValue?.(value) || DEFAULT_BOOKING_CURRENCY;
}

function refreshLocalizedBookingFormOptions() {
  bookingController()?.refreshLocalizedBookingFormOptions?.();
}

function setTravelMonthValue(value) {
  bookingController()?.setTravelMonthValue?.(value);
}

function buildFirstTravelMonthValue(monthAbbreviation) {
  const built = bookingController()?.buildFirstTravelMonthValue?.(monthAbbreviation);
  if (built) return built;
  const month = MONTH_ABBREVIATION_TO_NUMBER[normalizeText(monthAbbreviation).toLowerCase()];
  if (!month) return "";
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const year = month >= currentMonth ? now.getFullYear() : now.getFullYear() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseTravelDurationRange(value) {
  const parsed = bookingController()?.parseTravelDurationRange?.(value);
  if (parsed) return parsed;
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized || normalized === "not decided yet") {
    return { min: null, max: null };
  }
  const plusMatch = normalized.match(/^(\d+)\+\s*days?$/);
  if (plusMatch) {
    return { min: Number.parseInt(plusMatch[1], 10), max: null };
  }
  const rangeMatch = normalized.match(/^(\d+)\s*-\s*(\d+)\s*days?$/);
  if (rangeMatch) {
    return {
      min: Number.parseInt(rangeMatch[1], 10),
      max: Number.parseInt(rangeMatch[2], 10)
    };
  }
  return { min: null, max: null };
}

function getSelectedBudgetOption(currencyCode, value) {
  return bookingController()?.getSelectedBudgetOption?.(currencyCode, value) || {
    budgetLowerUSD: null,
    budgetUpperUSD: null
  };
}
const toursController = createFrontendToursController({
  state,
  els,
  backendBaseUrl: BACKEND_BASE_URL,
  initialVisibleTours: INITIAL_VISIBLE_TOURS,
  showMoreBatch: SHOW_MORE_BATCH,
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
  window.addEventListener("frontend-i18n-changed", () => {
    void handleFrontendLanguageChanged();
  });
  syncI18nManagedLabels();
  setupMobileNav();
  setupReelsUnlock();
  setupReelsToggle();
  setupFAQ();
  setupTeamSection();
  setupFooterCompanyProfile();
  setupBackendLogin();
  setupBrandLogoLinkBehavior();
  applyWebsiteAuthState({ authenticated: false, user: "", known: false });
  primeBackendLoginFromCache();
  revealBackendLogin();
  void loadWebsiteAuthStatus();
  setupModal();
  setupFormNavigation();
  setupLiveValidationReset();
  applyTravelerBoundsFromModel();

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
    console.error("Failed to load static homepage tours data.", error);
    state.trips = [];
    state.filterOptions.destinations = [];
    state.filterOptions.styles = [];
  }
  normalizeActiveFiltersFromOptions();

  populateFilterOptions();
  setupFilterSelectPanels();
  syncFilterInputs();
  applyFilters();
  setupFilterEvents();
  prefillBookingFormWithFilters();
  setupTourSectionImagePrewarm();
}

function scheduleDeferredTask(task, { timeout = 1200, fallbackDelayMs = 250 } = {}) {
  if (typeof task !== "function") return;
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => task(), { timeout });
    return;
  }
  window.setTimeout(() => task(), fallbackDelayMs);
}

function nextTourImagesToPrewarm() {
  const visibleCount = Math.max(0, Number(state.visibleToursCount) || 0);
  return (Array.isArray(state.filteredTrips) ? state.filteredTrips : []).slice(visibleCount, visibleCount + 6);
}

function triggerTourSectionImagePrewarm() {
  if (tourSectionPrewarmTriggered) return;
  tourSectionPrewarmTriggered = true;
  const scheduledToken = ++tourImagePrewarmToken;
  const snapshot = nextTourImagesToPrewarm();
  scheduleDeferredTask(() => {
    if (scheduledToken !== tourImagePrewarmToken) return;
    prewarmTourImages(snapshot);
  }, { timeout: 1500, fallbackDelayMs: 300 });
}

function setupTourSectionImagePrewarm() {
  if (!(els.toursSection instanceof HTMLElement) || tourSectionPrewarmObserved) return;
  tourSectionPrewarmObserved = true;

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        triggerTourSectionImagePrewarm();
        observer.disconnect();
        break;
      }
    }, {
      threshold: 0.18,
      rootMargin: "0px 0px -12% 0px"
    });
    observer.observe(els.toursSection);
    return;
  }

  scheduleDeferredTask(() => {
    triggerTourSectionImagePrewarm();
  }, { timeout: 3500, fallbackDelayMs: 1200 });
}

function localizedEntriesFromStaticValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => ({
        lang: normalizeText(entry?.lang).toLowerCase(),
        value: normalizeText(entry?.value)
      }))
      .filter((entry) => entry.lang && entry.value);
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([lang, text]) => ({
        lang: normalizeText(lang).toLowerCase(),
        value: normalizeText(text)
      }))
      .filter((entry) => entry.lang && entry.value);
  }
  const normalized = normalizeText(value);
  return normalized ? [{ lang: "en", value: normalized }] : [];
}

function generatedHomepageAssetUrls() {
  const assetUrls = window.ASIATRAVELPLAN_PUBLIC_HOMEPAGE_COPY?.assetUrls;
  return assetUrls && typeof assetUrls === "object" ? assetUrls : {};
}

function publicTeamDataUrl() {
  return normalizeText(generatedHomepageAssetUrls()?.team) || "/frontend/data/generated/homepage/public-team.json";
}

function publicReelsDataUrl() {
  return normalizeText(generatedHomepageAssetUrls()?.reels) || "/frontend/data/generated/reels/public-reels.json";
}

function isReelsUnlocked() {
  try {
    return window.sessionStorage.getItem(REELS_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function setReelsUnlocked(value) {
  try {
    if (value) {
      window.sessionStorage.setItem(REELS_UNLOCK_KEY, "1");
    } else {
      window.sessionStorage.removeItem(REELS_UNLOCK_KEY);
    }
  } catch {
    // Ignore sessionStorage failures and leave reels hidden.
  }
}

function reelsButtonDefaultLabel() {
  return frontendT("reels.button", "Reels");
}

function reelsButtonCloseLabel() {
  return "X";
}

function setReelsButtonActive(isActive) {
  if (!els.mobileReelToggle) return;
  const active = Boolean(isActive);
  els.mobileReelToggle.classList.toggle("is-active", active);
  els.mobileReelToggle.setAttribute("aria-expanded", String(active));
  els.mobileReelToggle.textContent = active ? reelsButtonCloseLabel() : reelsButtonDefaultLabel();
  els.mobileReelToggle.setAttribute(
    "aria-label",
    active
      ? frontendT("reels.button.close_label", "Close reels")
      : frontendT("reels.button.open_label", "Open reels")
  );
}

function syncReelsButtonVisibility() {
  if (!els.mobileReelToggle) return;
  els.mobileReelToggle.hidden = !isReelsUnlocked();
  setReelsButtonActive(state.reelsModeOpen);
}

function syncReelsLayerOffset() {
  if (!(els.mobileReelLayer instanceof HTMLElement)) return;
  const headerHeight = els.pageHeader instanceof HTMLElement
    ? Math.ceil(els.pageHeader.getBoundingClientRect().height)
    : 0;
  els.mobileReelLayer.style.top = `${Math.max(0, headerHeight)}px`;
}

function syncBodyScrollLock() {
  const bookingModalOpen = Boolean(els.bookingModal && !els.bookingModal.hidden);
  document.body.style.overflow = bookingModalOpen || state.reelsModeOpen ? "hidden" : "";
}

function setMobileNavOpen(isOpen) {
  if (!els.navToggle || !els.siteNav) return;
  const open = Boolean(isOpen);
  els.siteNav.classList.toggle("open", open);
  els.navToggle.setAttribute("aria-expanded", String(open));
}

function setMobileNavToggleDisabled(disabled) {
  if (!els.navToggle) return;
  const isDisabled = Boolean(disabled);
  els.navToggle.disabled = isDisabled;
  els.navToggle.setAttribute("aria-disabled", String(isDisabled));
}

function setReelsModeOpen(isOpen) {
  const open = Boolean(isOpen);
  state.reelsModeOpen = open;
  els.pageBody?.classList.toggle("home-page--reels-open", open);
  if (els.mobileReelLayer) {
    els.mobileReelLayer.hidden = !open;
    els.mobileReelLayer.setAttribute("aria-hidden", open ? "false" : "true");
  }
  if (open) {
    setMobileNavOpen(false);
  }
  setMobileNavToggleDisabled(open);
  setReelsButtonActive(open);
  syncReelsLayerOffset();
  syncBodyScrollLock();
}

function registerReelsUnlockTap() {
  const now = Date.now();
  reelsUnlockTapTimes = reelsUnlockTapTimes.filter((time) => now - time <= REELS_UNLOCK_WINDOW_MS);
  reelsUnlockTapTimes.push(now);
  if (reelsUnlockTapTimes.length < REELS_UNLOCK_TAP_TARGET) return;
  reelsUnlockTapTimes = [];
  setReelsUnlocked(true);
  syncReelsButtonVisibility();
}

function setupReelsUnlock() {
  syncReelsButtonVisibility();
  if (!(els.footerBrandTitle instanceof HTMLElement) || els.footerBrandTitle.dataset.reelsUnlockBound === "1") return;
  els.footerBrandTitle.dataset.reelsUnlockBound = "1";
  els.footerBrandTitle.addEventListener("click", registerReelsUnlockTap);
}

function loadReelsRuntime() {
  if (!reelsRuntimePromise) {
    reelsRuntimePromise = import("/frontend/scripts/main_reels.js")
      .catch((error) => {
        reelsRuntimePromise = null;
        throw error;
      });
  }
  return reelsRuntimePromise;
}

async function ensureReelsRuntime() {
  if (reelsRuntimeInstance) return reelsRuntimeInstance;
  const reelsModule = await loadReelsRuntime();
  reelsRuntimeInstance = reelsModule.createReelsRuntime({
    state,
    els,
    frontendT,
    escapeHTML,
    escapeAttr,
    resolveLocalizedFrontendText,
    tourDestinations,
    publicReelsDataUrl,
    setReelsModeOpen,
    openBookingModalForTripId
  });
  return reelsRuntimeInstance;
}

function setupReelsToggle() {
  if (!(els.mobileReelToggle instanceof HTMLButtonElement) || els.mobileReelToggle.dataset.reelsToggleBound === "1") return;
  let toggleBusy = false;
  els.mobileReelToggle.dataset.reelsToggleBound = "1";

  els.mobileReelToggle.addEventListener("click", async () => {
    if (els.mobileReelToggle.hidden || toggleBusy) return;
    toggleBusy = true;
    try {
      const runtime = await ensureReelsRuntime();
      if (state.reelsModeOpen) {
        runtime.close();
      } else {
        await runtime.open();
      }
    } finally {
      toggleBusy = false;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.reelsModeOpen || (els.bookingModal && !els.bookingModal.hidden)) return;
    void ensureReelsRuntime().then((runtime) => {
      runtime.close();
    });
  });

  window.addEventListener("resize", syncReelsLayerOffset);
}

function resolveLocalizedStaticValue(value, lang = state.lang || currentFrontendLang()) {
  const entries = localizedEntriesFromStaticValue(value);
  const normalizedLang = normalizeText(lang).toLowerCase() || "en";
  return normalizeText(
    entries.find((entry) => entry.lang === normalizedLang)?.value
    || entries.find((entry) => entry.lang === "en")?.value
    || entries[0]?.value
  );
}

function normalizeTeamMemberProfile(profile) {
  const normalizedUsername = normalizeText(profile?.username).toLowerCase();
  if (!normalizedUsername || !profile || typeof profile !== "object") return null;
  const fullName = normalizeText(profile?.name) || normalizedUsername;
  const role = resolveLocalizedStaticValue(profile?.position_i18n ?? profile?.position)
    || "Team member";
  const description = resolveLocalizedStaticValue(profile?.description_i18n ?? profile?.description);
  const shortDescription = resolveLocalizedStaticValue(profile?.short_description_i18n ?? profile?.short_description);
  const configuredPictureRef = resolveFrontendAssetUrl(profile?.picture_ref);
  if (!configuredPictureRef) {
    console.warn("[frontend-home] Team member picture_ref missing; hiding staff profile.", {
      username: normalizedUsername,
      name: fullName,
      page_url: window.location.href
    });
    return null;
  }
  return {
    username: normalizedUsername,
    fullName,
    role,
    description,
    shortDescription,
    pictureRef: configuredPictureRef
  };
}

async function loadTeamMembers({ force = false } = {}) {
  if (state.teamMembersLoaded && !force) {
    return state.teamMembers;
  }
  if (teamMembersLoadPromise && !force) {
    return teamMembersLoadPromise;
  }

  const dataUrl = publicTeamDataUrl();
  const request = (async () => {
    state.teamMembersLoaded = false;
    try {
      const response = await fetch(dataUrl, { cache: "default" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const source = Array.isArray(payload?.items) ? payload.items : [];
      state.teamMembers = source
        .map((profile) => normalizeTeamMemberProfile(profile))
        .filter(Boolean);
      state.teamMembersLoaded = true;
      renderTeamSection();
      return state.teamMembers;
    } catch (error) {
      state.teamMembers = [];
      state.teamMembersLoaded = false;
      if (els.teamSection instanceof HTMLElement) {
        els.teamSection.hidden = true;
      }
      logBrowserConsoleError("[frontend-home] Failed to load public ATP staff team content.", {
        url: dataUrl,
        page_url: window.location.href
      }, error);
      return [];
    } finally {
      teamMembersLoadPromise = null;
    }
  })();

  teamMembersLoadPromise = request;
  return request;
}

function ensureTeamMembersLoaded(options) {
  return loadTeamMembers(options);
}

function setupTeamSection() {
  if (!els.teamGrid || els.teamGrid.dataset.teamBound === "1") return;
  els.teamGrid.dataset.teamBound = "1";
  const handleToggle = (element) => {
    const username = normalizeText(element?.getAttribute?.("data-team-member")).toLowerCase();
    if (!username) return;
    state.selectedTeamMemberUsername = state.selectedTeamMemberUsername === username ? "" : username;
    renderTeamSection();
  };
  els.teamGrid.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-team-member]") : null;
    if (!button) return;
    handleToggle(button);
  });
  els.teamDetail?.addEventListener("click", () => {
    if (!state.selectedTeamMemberUsername) return;
    state.selectedTeamMemberUsername = "";
    renderTeamSection();
  });
  if (els.teamSection instanceof HTMLElement && !teamSectionRevealObserved && "IntersectionObserver" in window) {
    teamSectionRevealObserved = true;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        els.teamSection?.classList.add("is-visible");
        void ensureTeamMembersLoaded();
        observer.disconnect();
        break;
      }
    }, {
      threshold: 0.16,
      rootMargin: "200px 0px -10% 0px"
    });
    observer.observe(els.teamSection);
  } else if (els.teamSection instanceof HTMLElement) {
    els.teamSection.classList.add("is-visible");
    scheduleDeferredTask(() => {
      void ensureTeamMembersLoaded();
    }, { timeout: 2200, fallbackDelayMs: 650 });
  }
}

function ensureFooterBootstrapLoaded(options) {
  return loadPublicBootstrap(options);
}

function setupFooterCompanyProfile() {
  syncFooterCompanyProfile();
  if (!(els.footerLicense instanceof HTMLElement) || footerBootstrapObserved) return;
  if ("IntersectionObserver" in window) {
    footerBootstrapObserved = true;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        void ensureFooterBootstrapLoaded();
        observer.disconnect();
        break;
      }
    }, {
      threshold: 0.01,
      rootMargin: "300px 0px 0px 0px"
    });
    observer.observe(els.footerLicense);
    return;
  }
  footerBootstrapObserved = true;
  scheduleDeferredTask(() => {
    void ensureFooterBootstrapLoaded();
  }, { timeout: 5000, fallbackDelayMs: 2500 });
}

function renderTeamSection() {
  if (!(els.teamSection instanceof HTMLElement) || !els.teamGrid || !els.teamDetail) return;
  const members = Array.isArray(state.teamMembers) ? state.teamMembers : [];
  const selectedUsername = normalizeText(state.selectedTeamMemberUsername).toLowerCase();
  const selected = members.find((member) => member.username === selectedUsername) || null;

  if (!members.length) {
    els.teamSection.hidden = true;
    els.teamGrid.innerHTML = "";
    els.teamDetail.hidden = true;
    els.teamDetail.setAttribute("aria-hidden", "true");
    els.teamDetail.innerHTML = "";
    return;
  }

  els.teamSection.hidden = false;
  els.teamGrid.innerHTML = members.map((member, memberIndex) => {
    const isActive = member.username === selectedUsername;
    const role = member.role || frontendT("trust.team.role_fallback", "Team member");
    return `
      <button
        class="team-card${isActive ? " is-active" : ""}"
        type="button"
        data-team-member="${escapeAttr(member.username)}"
        aria-pressed="${isActive ? "true" : "false"}"
        style="--team-card-index:${memberIndex};"
      >
        <span class="team-card__photo-wrap">
          <img class="team-card__photo" src="${escapeAttr(member.pictureRef)}" alt="${escapeAttr(member.fullName)}" loading="lazy" data-team-member-photo="${escapeAttr(member.username)}" />
        </span>
        <span class="team-card__name">${escapeHTML(member.fullName)}</span>
        <span class="team-card__role">${escapeHTML(role)}</span>
      </button>
    `;
  }).join("");

  els.teamGrid.querySelectorAll("[data-team-member-photo]").forEach((image) => {
    if (!(image instanceof HTMLImageElement) || image.dataset.teamPhotoBound === "1") return;
    image.dataset.teamPhotoBound = "1";
    image.addEventListener("error", () => {
      const username = normalizeText(image.getAttribute("data-team-member-photo")).toLowerCase();
      const member = members.find((entry) => entry.username === username) || null;
      console.warn("[frontend-home] Team member photo failed to load.", {
        username,
        name: member?.fullName || "",
        image_src: image.currentSrc || image.src || "",
        team_data_url: publicTeamDataUrl(),
        page_url: window.location.href
      });
    });
  });

  if (!selected) {
    els.teamDetail.hidden = true;
    els.teamDetail.setAttribute("aria-hidden", "true");
    els.teamDetail.innerHTML = "";
    return;
  }

  const useShortDescription = window.matchMedia("(max-width: 760px)").matches;
  const detailBody = (useShortDescription ? selected.shortDescription || selected.description : selected.description || selected.shortDescription) || frontendT(
    "trust.team.description_fallback",
    "This team member supports AsiaTravelPlan guests before and during their journey."
  );
  els.teamDetail.hidden = false;
  els.teamDetail.setAttribute("aria-hidden", "false");
  els.teamDetail.innerHTML = `
    <div class="team-detail" role="dialog" aria-modal="true" aria-label="${escapeAttr(frontendT("trust.team.detail_label", "About"))}">
      <div class="team-detail__content">
        <div class="team-detail__copy">
          <p class="team-detail__body">${escapeHTML(detailBody)}</p>
        </div>
      </div>
    </div>
  `;
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
  syncFooterCompanyProfile();
  syncLocalizedControlLanguage();
  updateBackendButtonLabel({ authenticated: state.websiteAuthenticated, user: state.websiteAuthenticatedUser });
}

async function loadPublicBootstrap({ force = false } = {}) {
  if (publicBootstrapLoaded && !force) return state.companyProfile;
  if (publicBootstrapLoadPromise && !force) return publicBootstrapLoadPromise;
  publicBootstrapLoadPromise = (async () => {
  try {
    const response = await fetch(PUBLIC_BOOTSTRAP_URL, {
      credentials: "same-origin",
      cache: "default"
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    state.companyProfile = payload?.company_profile && typeof payload.company_profile === "object"
      ? payload.company_profile
      : null;
    publicBootstrapLoaded = true;
  } catch (error) {
    state.companyProfile = null;
    logBrowserConsoleError("[frontend-home] Failed to load public bootstrap.", {
      url: PUBLIC_BOOTSTRAP_URL,
      page_url: window.location.href
    }, error);
  } finally {
    syncFooterCompanyProfile();
    publicBootstrapLoadPromise = null;
  }
  return state.companyProfile;
  })();
  return publicBootstrapLoadPromise;
}

function syncFooterCompanyProfile() {
  if (!els.footerLicense) return;
  const licenseNumber = normalizeText(state.companyProfile?.licenseNumber);
  if (!licenseNumber) {
    els.footerLicense.textContent = frontendT("footer.license", "License: {licenseNumber}", {
      licenseNumber: ""
    }).replace(/\s*[:：]\s*$/, "").trim();
    return;
  }
  els.footerLicense.textContent = frontendT("footer.license", "License: {licenseNumber}", {
    licenseNumber
  });
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
  const minTravelers = Number(bookingController()?.MIN_TRAVELERS) || FALLBACK_MIN_TRAVELERS;
  const maxTravelers = Number(bookingController()?.MAX_TRAVELERS) || FALLBACK_MAX_TRAVELERS;
  travelersInput.setAttribute("min", String(minTravelers));
  travelersInput.setAttribute("max", String(maxTravelers));
}

function setupMobileNav() {
  if (!els.navToggle || !els.siteNav) return;

  const closeMobileNav = () => {
    els.siteNav.classList.remove("open");
    els.navToggle.setAttribute("aria-expanded", "false");
  };

  els.navToggle.addEventListener("click", () => {
    if (els.navToggle.disabled) return;
    const isOpen = !els.siteNav.classList.contains("open");
    setMobileNavOpen(isOpen);
  });

  els.siteNav.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const selectedItem = target.closest('a[href], #backendLoginBtn, [data-lang-option]');
    if (!selectedItem || !els.siteNav.contains(selectedItem)) return;

    closeMobileNav();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileNav();
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

function setupBackendLogin() {
  if (!els.backendLoginBtn) return;

  const navigateToBackendDestination = () => {
    const backendUrl = withLangUrl("/bookings.html");
    if (state.websiteAuthenticated) {
      window.location.href = backendUrl;
      return;
    }
    const loginParams = new URLSearchParams({
      return_to: backendUrl,
      prompt: "login"
    });
    const loginUrl = `${API_BASE_ORIGIN}/auth/login?${loginParams.toString()}`;
    window.location.href = loginUrl;
  };

  const primeWebsiteAuthStatus = () => {
    if (state.authStatusKnown) return;
    void loadWebsiteAuthStatus();
  };

  if (els.backendLoginBtn.dataset.authBound !== "1") {
    els.backendLoginBtn.addEventListener("pointerenter", primeWebsiteAuthStatus);
    els.backendLoginBtn.addEventListener("focus", primeWebsiteAuthStatus);
    els.backendLoginBtn.addEventListener("touchstart", primeWebsiteAuthStatus, { passive: true });
    els.backendLoginBtn.addEventListener("click", async () => {
      els.backendLoginBtn.disabled = true;
      try {
        if (!state.authStatusKnown) {
          await loadWebsiteAuthStatus();
        }
      } finally {
        els.backendLoginBtn.disabled = false;
      }
      navigateToBackendDestination();
    });
    els.backendLoginBtn.dataset.authBound = "1";
  }
}

function revealBackendLogin() {
  els.backendLoginContainer?.classList.remove("backend-login--deferred");
}

function resolveWebsiteAuthUserLabel(authUser = null) {
  return normalizeText(authUser?.preferred_username || authUser?.email || authUser?.sub);
}

function applyWebsiteAuthState({ authenticated, user = "", known = true } = {}) {
  const resolvedUser = normalizeText(user);
  state.websiteAuthenticated = Boolean(authenticated);
  state.websiteAuthenticatedUser = state.websiteAuthenticated ? resolvedUser : "";
  if (known) {
    state.authStatusKnown = true;
  }
  placeBackendLogin(state.websiteAuthenticated);
  updateBackendButtonLabel({
    authenticated: state.websiteAuthenticated,
    user: state.websiteAuthenticatedUser
  });
}

function primeBackendLoginFromCache() {
  try {
    const cachedPayload = JSON.parse(window.sessionStorage.getItem(WEBSITE_AUTH_CACHE_KEY) || "null");
    if (cachedPayload?.authenticated !== true || !cachedPayload.user) return;
    const user = resolveWebsiteAuthUserLabel(cachedPayload.user);
    if (!user) return;
    applyWebsiteAuthState({ authenticated: true, user, known: false });
  } catch {
    // Ignore stale or unavailable session storage; the live auth check below is authoritative.
  }
}

async function loadWebsiteAuthStatus({ force = false } = {}) {
  if (!els.backendLoginContainer) return false;
  if (state.authStatusKnown && !force) return state.websiteAuthenticated;
  if (authStatusLoadPromise && !force) return authStatusLoadPromise;

  authStatusLoadPromise = (async () => {
    try {
      const { fetchAuthMe } = await ensureAuthRuntime();
      const { response, payload } = await fetchAuthMe(BACKEND_BASE_URL);
      if (!response.ok || !payload?.authenticated) {
        applyWebsiteAuthState({ authenticated: false, user: "" });
        return false;
      }
      const user = resolveWebsiteAuthUserLabel(payload.user) || "authenticated user";
      applyWebsiteAuthState({ authenticated: true, user });
      return true;
    } catch {
      applyWebsiteAuthState({ authenticated: false, user: "" });
      return false;
    } finally {
      revealBackendLogin();
      authStatusLoadPromise = null;
    }
  });
  return authStatusLoadPromise;
}

function isStagingFrontend() {
  return window.location.hostname === "staging.asiatravelplan.com";
}

function isLocalFrontend() {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function setupBrandLogoLinkBehavior() {
  if (!(els.brandLogoLink instanceof HTMLElement) || els.brandLogoLink.dataset.brandLogoBound === "1") return;
  els.brandLogoLink.dataset.brandLogoBound = "1";

  els.brandLogoLink.addEventListener("click", (event) => {
    const allowQuickLogin = isStagingFrontend() || isLocalFrontend();
    if (event.metaKey && allowQuickLogin) {
      event.preventDefault();
      event.stopPropagation();

      const backendUrl = withLangUrl("/bookings.html");
      const loginParams = new URLSearchParams({
        return_to: backendUrl,
        quick_login: "1"
      });
      window.location.href = `${BACKEND_BASE_URL}/auth/login?${loginParams.toString()}`;
      return;
    }

    event.preventDefault();
    if (state.reelsModeOpen) return;

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
}

function filterOptionEntries(kind) {
  const raw = kind === "destination" ? state.filterOptions.destinations : state.filterOptions.styles;
  return (Array.isArray(raw) ? raw : [])
    .map((item) => ({
      code: normalizeText(item?.code || item),
      label: normalizeText(item?.label || item?.code || item)
    }))
    .filter((item) => item.code && item.label);
}

function readBookingStaticFieldValues(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return [];
  return Array.from(field.querySelectorAll('input[type="hidden"][name]'))
    .map((input) => normalizeText(input.value))
    .filter(Boolean);
}

function mapBookingSelectionLabelsToCodes(values, kind) {
  const options = filterOptionEntries(kind);
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => {
      const normalizedValue = normalizeText(value);
      if (!normalizedValue) return "";
      const lower = normalizedValue.toLowerCase();
      const match = options.find((option) => {
        const code = normalizeText(option.code).toLowerCase();
        const label = normalizeText(option.label).toLowerCase();
        return lower === code || lower === label;
      });
      return normalizeText(match?.code);
    })
    .filter(Boolean)));
}

async function handleFrontendLanguageChanged() {
  state.lang = currentFrontendLang();
  const selectedTourId = normalizeText(state.selectedTour?.id || els.booking_tour_id?.value);
  const preservedBookingDestinationCodes = mapBookingSelectionLabelsToCodes(
    readBookingStaticFieldValues("bookingDestination"),
    "destination"
  );
  const preservedBookingStyleCodes = mapBookingSelectionLabelsToCodes(
    readBookingStaticFieldValues("bookingStyle"),
    "style"
  );

  syncI18nManagedLabels();
  setReelsButtonActive(state.reelsModeOpen);
  if (bookingRuntimeLoaded()) {
    refreshLocalizedBookingFormOptions();
  }

  try {
    const toursPayload = await loadTrips();
    state.trips = Array.isArray(toursPayload?.items) ? toursPayload.items : [];
    state.filterOptions.destinations = Array.isArray(toursPayload?.available_destinations)
      ? toursPayload.available_destinations
      : [];
    state.filterOptions.styles = Array.isArray(toursPayload?.available_styles)
      ? toursPayload.available_styles
      : [];
    normalizeActiveFiltersFromOptions();

    if (selectedTourId) {
      const selectedTour = state.trips.find((trip) => trip.id === selectedTourId);
      if (selectedTour) {
        setSelectedTourContext(selectedTour);
      } else {
        clearSelectedTourContext();
      }
    }

    populateFilterOptions();
    syncFilterInputs();

    if (preservedBookingDestinationCodes.length) {
      setBookingField("bookingDestination", filterLabels(preservedBookingDestinationCodes, "destination"));
    }
    if (preservedBookingStyleCodes.length) {
      setBookingField("bookingStyle", filterLabels(preservedBookingStyleCodes, "style"));
    }

    applyFilters();
    if (state.teamMembersLoaded) {
      renderTeamSection();
    }
  } catch (error) {
    console.error("Failed to refresh localized static tours after frontend language switch.", error);
  } finally {
    tourSectionPrewarmTriggered = false;
    if (bookingRuntimeLoaded()) {
      renderFormStep();
    }
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

  openModalButtons.forEach((button) => {
    button.addEventListener("click", () => {
      void openBookingModalForTripId(button?.getAttribute?.("data-trip-id"), button);
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

async function openBookingModal() {
  await ensureBookingRuntime();
  state.bookingSubmitted = false;
  state.formStep = 1;
  prefillBookingFormWithFilters();
  clearBookingFeedback();
  renderFormStep();
  els.bookingModal.hidden = false;
  syncBodyScrollLock();
  const firstInput = els.bookingForm.querySelector(".step.active input:not([type=\"hidden\"]), .step.active select, .step.active textarea");
  if (firstInput) firstInput.focus();
}

async function openBookingModalForTripId(tripId, trigger = null) {
  await ensureBookingRuntime();
  if (trigger instanceof HTMLElement) {
    lastBookingModalTrigger = trigger;
  }

  const normalizedTripId = normalizeText(tripId);
  if (!normalizedTripId) {
    clearSelectedTourContext();
    await openBookingModal();
    return;
  }

  const selected = state.trips.find((trip) => normalizeText(trip?.id) === normalizedTripId);
  if (selected) {
    setBookingField("bookingDestination", tourDestinations(selected));
    setBookingField("bookingStyle", selected.styles || []);
    setSelectedTourContext(selected);
    await openBookingModal();
    return;
  }

  clearSelectedTourContext();
  await openBookingModal();
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
      seasonality_start_month: normalizeText(selectedTour.seasonality_start_month)
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
  syncBodyScrollLock();
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

  els.stepNext.addEventListener("click", async () => {
    if (state.bookingSubmitted) return;
    await ensureBookingRuntime();
    if (state.formStep < 3) {
      clearBookingFeedback();
      const valid = validateCurrentStep();
      if (!valid) return;
      goToFormStep(state.formStep + 1);
      return;
    }

    const valid = validateCurrentStep();
    if (!valid) return;
    await submitBookingForm();
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
    const toShow = remaining;
    if (!toShow) return;
    state.visibleToursCount += toShow;
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
  const minTravelers = Number(bookingController()?.MIN_TRAVELERS) || FALLBACK_MIN_TRAVELERS;
  const maxTravelers = Number(bookingController()?.MAX_TRAVELERS) || FALLBACK_MAX_TRAVELERS;

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
          const minDisplay = min !== null ? min : minTravelers;
          const maxDisplay = max !== null ? max : maxTravelers;
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
  const requireOneOfGroups = Array.isArray(bookingSchema()?.requireOneOf)
    ? bookingSchema().requireOneOf
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
  await ensureBookingRuntime();
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
  const minTravelers = Number(bookingController()?.MIN_TRAVELERS) || FALLBACK_MIN_TRAVELERS;
  const maxTravelers = Number(bookingController()?.MAX_TRAVELERS) || FALLBACK_MAX_TRAVELERS;

  if (rawTravelersValue && (!Number.isInteger(travelersValue) || travelersValue < minTravelers || travelersValue > maxTravelers)) {
    renderBookingError(
      frontendT("modal.error.travelers_between", "Travelers must be between {min} and {max}.", {
        min: minTravelers,
        max: maxTravelers
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
    bookingRuntime.validatePublicBookingCreateRequest?.(payload);
    const bookingRequest = bookingRuntime.publicBookingsRequest?.({ baseURL: API_BASE_ORIGIN });
    if (!bookingRequest) {
      throw new Error("Booking request runtime is not available.");
    }
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
