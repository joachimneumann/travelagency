/*
  Beginner-editable configuration:
  - Tour catalog is loaded from backend endpoint /public/v1/tours
*/

import {
  GENERATED_CURRENCY_CODES,
  GENERATED_CURRENCIES,
  normalizeCurrencyCode as normalizeGeneratedCurrencyCode
} from "../Generated/Models/generated_Currency.js";
import { GENERATED_LANGUAGE_CODES } from "../Generated/Models/generated_Language.js";
import {
  apiValueFromLanguageCode,
  languageByApiValue
} from "../../shared/generated/language_catalog.js?v=b7baca7c60a0";
import {
  MAX_TRAVELERS as GENERATED_MAX_TRAVELERS,
  MIN_TRAVELERS as GENERATED_MIN_TRAVELERS
} from "../Generated/Models/generated_FormConstraints.js";
import {
  publicToursRequest
} from "../Generated/API/generated_APIRequestFactory.js?v=b7baca7c60a0";
import { publicBookingsRequest } from "../Generated/API/generated_APIRequestFactory.js?v=b7baca7c60a0";
import {
  PUBLIC_BOOKING_CREATE_REQUEST_SCHEMA,
  validatePublicBookingCreateRequest
} from "../Generated/API/generated_APIModels.js";
import { normalizeText } from "../../shared/js/text.js?v=b7baca7c60a0";

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

function toursCacheKey(lang = currentFrontendLang()) {
  return `asiatravelplan_tours_cache_v7:${normalizeFrontendTourLang(lang)}`;
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
const DEFAULT_BOOKING_CURRENCY = "USD";
const FRONTEND_LANG_DEFAULT_CURRENCY = Object.freeze({
  en: "USD",
  fr: "EURO",
  zh: "CNY",
  ja: "JPY",
  ko: "KRW",
  vi: "VND",
  de: "EURO",
  es: "EURO",
  it: "EURO",
  ru: "RUB",
  nl: "EURO",
  pl: "PLN",
  da: "DKK",
  sv: "SEK",
  no: "NOK"
});
const FRONTEND_DISPLAY_EXCHANGE_RATES = Object.freeze({
  USD: 1,
  EURO: 0.873162,
  VND: 26186.298828,
  THB: 32.279637,
  CNY: 6.909294,
  JPY: 159.498237,
  KRW: 1495.240466,
  RUB: 79.8045,
  PLN: 3.729088,
  DKK: 6.513818,
  SEK: 9.429805,
  NOK: 9.750171,
  AUD: 1.425064,
  GBP: 0.754418,
  NZD: 1.72632,
  ZAR: 16.867203
});
const BOOKING_BUDGET_BANDS = Object.freeze([
  { value: "usd_500_900", lowerUSD: 500, upperUSD: 900 },
  { value: "usd_900_1400", lowerUSD: 900, upperUSD: 1400 },
  { value: "usd_1400_2200", lowerUSD: 1400, upperUSD: 2200 },
  { value: "usd_2200_plus", lowerUSD: 2200, upperUSD: null }
]);
const BUDGET_ROUNDING_STEPS = Object.freeze({
  USD: 100,
  EURO: 50,
  VND: 1000000,
  THB: 1000,
  CNY: 100,
  JPY: 1000,
  KRW: 10000,
  RUB: 1000,
  PLN: 50,
  DKK: 50,
  SEK: 50,
  NOK: 50,
  AUD: 50,
  GBP: 50,
  NZD: 50,
  ZAR: 100
});
const MIN_TRAVELERS = Number.isFinite(Number(GENERATED_MIN_TRAVELERS))
  ? Number(GENERATED_MIN_TRAVELERS)
  : 1;
const MAX_TRAVELERS = Number.isFinite(Number(GENERATED_MAX_TRAVELERS)) &&
  Number(GENERATED_MAX_TRAVELERS) >= MIN_TRAVELERS
  ? Number(GENERATED_MAX_TRAVELERS)
  : 30;
const MONTH_ABBREVIATION_TO_NUMBER = {
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
};
const BOOKING_MONTH_OPTIONS = Object.freeze([
  { value: "01", labelId: "calendar.month.01", fallback: "January" },
  { value: "02", labelId: "calendar.month.02", fallback: "February" },
  { value: "03", labelId: "calendar.month.03", fallback: "March" },
  { value: "04", labelId: "calendar.month.04", fallback: "April" },
  { value: "05", labelId: "calendar.month.05", fallback: "May" },
  { value: "06", labelId: "calendar.month.06", fallback: "June" },
  { value: "07", labelId: "calendar.month.07", fallback: "July" },
  { value: "08", labelId: "calendar.month.08", fallback: "August" },
  { value: "09", labelId: "calendar.month.09", fallback: "September" },
  { value: "10", labelId: "calendar.month.10", fallback: "October" },
  { value: "11", labelId: "calendar.month.11", fallback: "November" },
  { value: "12", labelId: "calendar.month.12", fallback: "December" }
]);
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
  [
    els.bookingPreferredCurrency,
    els.bookingBudget,
    els.bookingDuration,
    els.bookingLanguage,
    els.bookingMonthMonth,
    els.bookingMonthYear
  ].filter(Boolean).forEach((control) => {
    control.setAttribute("lang", state.lang || "en");
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

function getCurrencyDefinitions() {
  return GENERATED_CURRENCIES;
}

function normalizeCurrencyCode(value) {
  return normalizeGeneratedCurrencyCode(value) || DEFAULT_BOOKING_CURRENCY;
}

function preferredCurrencyForFrontendLang(lang = state.lang || currentFrontendLang()) {
  const normalizedLang = normalizeText(lang).toLowerCase();
  return normalizeCurrencyCode(FRONTEND_LANG_DEFAULT_CURRENCY[normalizedLang] || DEFAULT_BOOKING_CURRENCY);
}

function preferredBookingLanguageForFrontendLang(lang = state.lang || currentFrontendLang()) {
  return apiValueFromLanguageCode(normalizeText(lang).toLowerCase(), "English");
}

function preferredCurrencyForLanguageApiValue(value) {
  const languageCode = languageByApiValue(normalizeText(value))?.code || state.lang || currentFrontendLang();
  return preferredCurrencyForFrontendLang(languageCode);
}

function approximateDisplayAmountFromUSD(amountUSD, currencyCode) {
  const normalizedCurrency = normalizeCurrencyCode(currencyCode);
  const rate = Number(FRONTEND_DISPLAY_EXCHANGE_RATES[normalizedCurrency]);
  if (!Number.isFinite(rate) || !Number.isFinite(Number(amountUSD))) return null;
  return Math.round(Number(amountUSD) * rate);
}

function formatDisplayMoney(amount, currencyCode, locale = state.lang || currentFrontendLang()) {
  const normalizedCurrency = normalizeCurrencyCode(currencyCode);
  const definition = GENERATED_CURRENCIES[normalizedCurrency] || GENERATED_CURRENCIES[DEFAULT_BOOKING_CURRENCY];
  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || !definition) return "";
  const formatted = new Intl.NumberFormat(locale || "en", {
    maximumFractionDigits: Number(definition.decimalPlaces || 0),
    minimumFractionDigits: 0,
    useGrouping: true
  }).format(normalizedAmount);
  return `${definition.symbol}${formatted}`;
}

function budgetRoundingStep(currencyCode) {
  return Number(BUDGET_ROUNDING_STEPS[normalizeCurrencyCode(currencyCode)]) || 50;
}

function roundBudgetDisplayAmount(amount, currencyCode, { upperBound = false } = {}) {
  const normalizedAmount = Number(amount);
  const step = budgetRoundingStep(currencyCode);
  if (!Number.isFinite(normalizedAmount) || !Number.isFinite(step) || step <= 0) return null;
  const rounded = upperBound
    ? Math.ceil(normalizedAmount / step) * step
    : Math.floor(normalizedAmount / step) * step;
  return Math.max(step, rounded);
}

function buildBudgetLabel(currencyCode, lowerUSD, upperUSD) {
  const normalizedCurrency = normalizeCurrencyCode(currencyCode);
  if (normalizedCurrency === "USD") {
    const lowerLabel = formatDisplayMoney(lowerUSD, normalizedCurrency, state.lang || currentFrontendLang());
    if (!Number.isFinite(Number(upperUSD))) return `${lowerLabel}+`;
    const upperLabel = formatDisplayMoney(upperUSD, normalizedCurrency, state.lang || currentFrontendLang());
    return `${lowerLabel}-${upperLabel}`;
  }

  const lowerConverted = approximateDisplayAmountFromUSD(lowerUSD, normalizedCurrency);
  const upperConverted = Number.isFinite(Number(upperUSD))
    ? approximateDisplayAmountFromUSD(upperUSD, normalizedCurrency)
    : null;
  if (!Number.isFinite(lowerConverted)) {
    const lowerLabel = formatDisplayMoney(lowerUSD, DEFAULT_BOOKING_CURRENCY, state.lang || currentFrontendLang());
    if (!Number.isFinite(Number(upperUSD))) return `${lowerLabel}+`;
    const upperLabel = formatDisplayMoney(upperUSD, DEFAULT_BOOKING_CURRENCY, state.lang || currentFrontendLang());
    return `${lowerLabel}-${upperLabel}`;
  }
  const lowerLabel = formatDisplayMoney(
    roundBudgetDisplayAmount(lowerConverted, normalizedCurrency, { upperBound: false }),
    normalizedCurrency,
    state.lang || currentFrontendLang()
  );
  if (!Number.isFinite(Number(upperUSD))) return `${lowerLabel}+`;
  const upperLabel = formatDisplayMoney(
    roundBudgetDisplayAmount(upperConverted, normalizedCurrency, { upperBound: true }),
    normalizedCurrency,
    state.lang || currentFrontendLang()
  );
  return `${lowerLabel}-${upperLabel}`;
}

function budgetOptionsForCurrency(currencyCode) {
  const normalizedCurrency = normalizeCurrencyCode(currencyCode);
  return [
    {
      value: "not_decided_yet",
      label: frontendT("modal.duration.not_decided", "Not decided yet"),
      budgetLowerUSD: null,
      budgetUpperUSD: null
    },
    ...BOOKING_BUDGET_BANDS.map((band) => ({
      value: band.value,
      label: buildBudgetLabel(normalizedCurrency, band.lowerUSD, band.upperUSD),
      budgetLowerUSD: band.lowerUSD,
      budgetUpperUSD: band.upperUSD
    }))
  ];
}

function setupBookingBudgetOptions() {
  if (!els.bookingPreferredCurrency || !els.bookingBudget) return;
  populateGeneratedWebFormOptions();
  els.bookingPreferredCurrency.value = normalizeCurrencyCode(
    els.bookingPreferredCurrency.value || preferredCurrencyForLanguageApiValue(els.bookingLanguage?.value || preferredBookingLanguageForFrontendLang())
  );
  renderBudgetOptions(els.bookingPreferredCurrency.value);
  els.bookingPreferredCurrency.addEventListener("change", () => {
    renderBudgetOptions(els.bookingPreferredCurrency.value);
  });
  els.bookingLanguage?.addEventListener("change", () => {
    const nextCurrency = preferredCurrencyForLanguageApiValue(els.bookingLanguage.value || preferredBookingLanguageForFrontendLang());
    els.bookingPreferredCurrency.value = nextCurrency;
    renderBudgetOptions(nextCurrency);
  });
}

function populateGeneratedWebFormOptions() {
  const preferredLanguage = normalizeText(els.bookingLanguage?.value || preferredBookingLanguageForFrontendLang()) || "English";
  const preferredCurrency = normalizeCurrencyCode(
    els.bookingPreferredCurrency?.value || preferredCurrencyForLanguageApiValue(preferredLanguage)
  );
  populateSelectOptions(els.bookingPreferredCurrency, GENERATED_CURRENCY_CODES, {
    includePlaceholder: false,
    selectedValue: preferredCurrency
  });
  populateSelectOptions(els.bookingLanguage, GENERATED_LANGUAGE_CODES, {
    includePlaceholder: false,
    selectedValue: preferredLanguage,
    formatLabel: formatGeneratedLanguageLabel
  });
  applyGeneratedRequiredAttributes();
}

function populateSelectOptions(
  select,
  values,
  { includePlaceholder = false, placeholderLabel = "Select", selectedValue = "", formatLabel = (value) => value } = {}
) {
  if (!select) return;
  const options = [];
  if (includePlaceholder) {
    options.push(`<option value="">${escapeHTML(placeholderLabel)}</option>`);
  }
  options.push(
    ...values.map((value) => `<option value="${escapeAttr(value)}">${escapeHTML(formatLabel(value))}</option>`)
  );
  select.innerHTML = options.join("");
  select.value = values.includes(selectedValue) ? selectedValue : includePlaceholder ? "" : values[0] || "";
}

function formatGeneratedLanguageLabel(value) {
  const entry = languageByApiValue(normalizeText(value));
  if (!entry?.frontendNameKey) return String(value || "");
  return frontendT(entry.frontendNameKey, entry.apiValue || String(value || ""));
}

function applyGeneratedRequiredAttributes() {
  if (!els.bookingForm) return;
  const requiredNames = new Set(
    Array.isArray(PUBLIC_BOOKING_CREATE_REQUEST_SCHEMA?.fields)
      ? PUBLIC_BOOKING_CREATE_REQUEST_SCHEMA.fields.filter((field) => field.required).map((field) => field.name)
      : []
  );
  els.bookingForm.querySelectorAll("input[name], select[name], textarea[name]").forEach((input) => {
    if (!input.name) return;
    if (requiredNames.has(input.name)) {
      input.setAttribute("required", "");
    } else {
      input.removeAttribute("required");
    }
  });
}

function renderBudgetOptions(currencyCode) {
  if (!els.bookingBudget || !els.bookingBudgetLabel) return;
  const currency = normalizeCurrencyCode(currencyCode);
  const options = budgetOptionsForCurrency(currency);
  const previousValue = els.bookingBudget.value;
  els.bookingBudget.innerHTML = "";
  options.forEach((optionConfig) => {
    const option = document.createElement("option");
    option.value = optionConfig.value;
    option.textContent = optionConfig.value === "not_decided_yet"
      ? frontendT("modal.duration.not_decided", optionConfig.label)
      : `${optionConfig.label.replace(/\s*\/\s*week$/i, "")}${frontendT("modal.budget.per_week", " / week")}`;
    els.bookingBudget.appendChild(option);
  });
  els.bookingBudget.value = options.some((optionConfig) => optionConfig.value === previousValue) ? previousValue : "not_decided_yet";
  els.bookingBudgetLabel.textContent = frontendT("modal.step2.budget", "Budget range ({currency})", { currency });
}

function setupTravelMonthControls() {
  if (!els.bookingMonth || !els.bookingMonthMonth || !els.bookingMonthYear) return;
  populateTravelMonthSelects();
  if (els.bookingMonthMonth.dataset.bound !== "1") {
    els.bookingMonthMonth.addEventListener("change", syncTravelMonthHiddenField);
    els.bookingMonthYear.addEventListener("change", syncTravelMonthHiddenField);
    els.bookingMonthMonth.dataset.bound = "1";
    els.bookingMonthYear.dataset.bound = "1";
  }
  setTravelMonthValue(els.bookingMonth.value);
}

function populateTravelMonthSelects() {
  if (!els.bookingMonthMonth || !els.bookingMonthYear) return;
  const selected = parseTravelMonthValue(els.bookingMonth?.value);
  const yearOptions = travelMonthYearOptions(selected?.year);

  els.bookingMonthMonth.innerHTML = [
    `<option value="">${escapeHTML(frontendT("modal.month.select_month", "Select month"))}</option>`,
    ...BOOKING_MONTH_OPTIONS.map(
      (option) => `<option value="${escapeAttr(option.value)}">${escapeHTML(frontendT(option.labelId, option.fallback))}</option>`
    )
  ].join("");
  els.bookingMonthYear.innerHTML = [
    `<option value="">${escapeHTML(frontendT("modal.month.select_year", "Select year"))}</option>`,
    ...yearOptions.map((year) => `<option value="${escapeAttr(year)}">${escapeHTML(year)}</option>`)
  ].join("");

  els.bookingMonthMonth.value = selected?.month || "";
  els.bookingMonthYear.value = selected?.year || "";
  syncLocalizedControlLanguage();
}

function travelMonthYearOptions(requiredYear = "") {
  const nowYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, index) => String(nowYear + index));
  const normalizedRequiredYear = normalizeText(requiredYear);
  if (normalizedRequiredYear && !years.includes(normalizedRequiredYear)) {
    years.push(normalizedRequiredYear);
    years.sort((left, right) => Number(left) - Number(right));
  }
  return years;
}

function parseTravelMonthValue(value) {
  const match = normalizeText(value).match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  return { year: match[1], month: match[2] };
}

function setTravelMonthValue(value) {
  if (!els.bookingMonth || !els.bookingMonthMonth || !els.bookingMonthYear) return;
  const parsed = parseTravelMonthValue(value);
  if (parsed?.year && !Array.from(els.bookingMonthYear.options).some((option) => option.value === parsed.year)) {
    populateTravelMonthSelects();
  }
  els.bookingMonthMonth.value = parsed?.month || "";
  if (parsed?.year && !Array.from(els.bookingMonthYear.options).some((option) => option.value === parsed.year)) {
    const option = document.createElement("option");
    option.value = parsed.year;
    option.textContent = parsed.year;
    els.bookingMonthYear.appendChild(option);
  }
  els.bookingMonthYear.value = parsed?.year || "";
  syncTravelMonthHiddenField();
}

function syncTravelMonthHiddenField() {
  if (!els.bookingMonth || !els.bookingMonthMonth || !els.bookingMonthYear) return;
  const month = normalizeText(els.bookingMonthMonth.value);
  const year = normalizeText(els.bookingMonthYear.value);
  els.bookingMonth.value = month && year ? `${year}-${month}` : "";
}

function getSelectedBudgetOption(currencyCode, value) {
  const currency = normalizeCurrencyCode(currencyCode);
  const options = budgetOptionsForCurrency(currency);
  return options.find((option) => option.value === value) || options[0];
}

function findBudgetOptionValueByLowerUSD(currencyCode, budgetLowerUSD, travelDurationDays = null) {
  const normalizedLower = Number(budgetLowerUSD);
  const normalizedDurationDays = Number(travelDurationDays);
  if (!Number.isFinite(normalizedLower)) return "not_decided_yet";
  const weeklyLower = Number.isFinite(normalizedDurationDays) && normalizedDurationDays > 0
    ? normalizedLower / (normalizedDurationDays / 7)
    : normalizedLower;
  const currency = normalizeCurrencyCode(currencyCode);
  const options = budgetOptionsForCurrency(currency);
  const matched = options.find((option) => {
    const lower = Number(option.budgetLowerUSD);
    const upper = Number(option.budgetUpperUSD);
    if (!Number.isFinite(lower)) return false;
    if (Number.isFinite(upper)) {
      return weeklyLower >= lower && weeklyLower <= upper;
    }
    return weeklyLower >= lower;
  });
  return matched?.value || "not_decided_yet";
}

function parseTravelDurationRange(value) {
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

function findTravelDurationOptionByDays(days) {
  const normalizedDays = Number(days);
  if (!Number.isFinite(normalizedDays) || normalizedDays <= 0) return "not decided yet";
  const options = [
    "3-5 days",
    "6-8 days",
    "9-12 days",
    "13-16 days",
    "17+ days"
  ];
  return options.find((option) => {
    const range = parseTravelDurationRange(option);
    if (!Number.isFinite(range.min)) return false;
    if (Number.isFinite(range.max)) {
      return normalizedDays >= range.min && normalizedDays <= range.max;
    }
    return normalizedDays >= range.min;
  }) || "not decided yet";
}

function buildFirstTravelMonthValue(monthAbbreviation) {
  const month = MONTH_ABBREVIATION_TO_NUMBER[normalizeText(monthAbbreviation).toLowerCase()];
  if (!month) return "";
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const year = month >= currentMonth ? now.getFullYear() : now.getFullYear() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

async function loadWebsiteAuthStatus() {
  if (!els.backendLoginContainer) return;

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
      credentials: "include"
    });
    const payload = await response.json();
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
    const destinations = tourDestinationCodes(trip);
    const styles = tourStyleCodes(trip);
    const matchDest = !state.filters.dest.length || state.filters.dest.some((destination) => destinations.includes(destination));
    const matchStyle = !state.filters.style.length || state.filters.style.some((style) => styles.includes(style));
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
  const header = frontendT("tours.debug_header", "Filter: {dest}, {style}", { dest: destLabel, style: styleLabel });
  els.debugPriorityOutput.textContent = `${header}\n${lines.join("\n") || frontendT("tours.debug_empty", "No tours in current filter.")}`;
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
      els.showMoreTours.textContent = frontendT("tours.show_more.default", "Show more tours");
    } else {
      els.showMoreTours.textContent = buildShowMoreToursLabel(moreCount);
    }
  } else {
    els.showMoreTours.hidden = true;
  }

  if (showAllAvailable) {
    els.showAllTours.hidden = false;
    els.showAllTours.textContent = remaining === 1
      ? frontendT("tours.show_remaining.one", "There is 1 more tour")
      : frontendT("tours.show_remaining.many", "Show the remaining {count} tours", { count: remaining });
  } else {
    els.showAllTours.hidden = true;
  }
}

function buildShowMoreToursLabel(moreCount) {
  const style = filterLabels(state.filters.style, "style");
  const destination = filterLabels(state.filters.dest, "destination");
  const countText = String(moreCount);

  if (style.length === 1) {
    return frontendT("tours.show_more.style", "Show {count} more {styleLower} tours", {
      count: countText,
      styleLower: String(style[0] || "").toLowerCase()
    });
  }

  if (destination.length === 1) {
    return frontendT("tours.show_more.destination", "Show {count} more tours in {destination}", {
      count: countText,
      destination: destination[0]
    });
  }

  return moreCount === 1
    ? frontendT("tours.show_more.generic_one", "Show 1 more tour")
    : frontendT("tours.show_more.generic_many", "Show {count} more tours", { count: countText });
}

function formatFilterValue(value, kind) {
  if (Array.isArray(value) && value.length) return filterLabels(value, kind).join(", ");
  return kind === "destination"
    ? frontendT("filters.all_destinations", "All destinations")
    : frontendT("filters.all_styles", "All travel styles");
}

function updateFilterTriggerLabels() {
  if (els.navDestinationSummary) {
    els.navDestinationSummary.textContent = formatFilterValue(state.filters.dest, "destination");
  }
  if (els.navStyleSummary) {
    els.navStyleSummary.textContent = formatFilterValue(state.filters.style, "style");
  }
}

function renderFilterSummary() {
  const chips = [];
  chips.push(renderChip(frontendT("filters.destination_label", "Destination"), state.filters.dest, "destination"));
  chips.push(renderChip(frontendT("filters.style_label", "Style"), state.filters.style, "style"));
  els.activeFilters.innerHTML = chips.join("");
}

function renderChip(label, value, kind) {
  const active = Array.isArray(value) && value.length > 0;
  const text = active
    ? filterLabels(value, kind).join(", ")
    : kind === "destination"
      ? frontendT("filters.all_destinations", "All destinations")
      : frontendT("filters.all_styles", "All travel styles");
  return `<span class="filter-pill ${active ? "active" : ""}">${label}: ${text}</span>`;
}

function updateTitlesForFilters() {
  const dest = state.filters.dest;
  const style = state.filters.style;
  const destLabel = formatFilterValue(dest, "destination");
  const styleLabel = formatFilterValue(style, "style");
  const styleLower = String(styleLabel || "").toLowerCase();

  let heading = frontendT("tours.heading.default", "Featured tours you can tailor");
  let booking = frontendT(
    "tours.booking.default",
    "Browse by destination and style. Filters update instantly and can be shared by URL."
  );
  let pageTitle = frontendT("tours.page_title.default", "AsiaTravelPlan | Custom Southeast Asia Holidays");

  if (dest.length && style.length) {
    heading = frontendT("tours.heading.destination_style", "{style} tours in {destination}", {
      style: styleLabel,
      destination: destLabel
    });
    booking = frontendT(
      "tours.booking.destination_style",
      "Showing {styleLower} journeys in {destination}. Clear filters to see all options.",
      { styleLower, destination: destLabel }
    );
    pageTitle = frontendT("tours.page_title.destination_style", "AsiaTravelPlan | {style} Tours in {destination}", {
      style: styleLabel,
      destination: destLabel
    });
  } else if (dest.length) {
    heading = frontendT("tours.heading.destination", "Featured tours in {destination}", { destination: destLabel });
    booking = frontendT("tours.booking.destination", "Showing all travel styles available in {destination}.", {
      destination: destLabel
    });
    pageTitle = frontendT("tours.page_title.destination", "AsiaTravelPlan | Tours in {destination}", {
      destination: destLabel
    });
  } else if (style.length) {
    heading = frontendT("tours.heading.style", "{style} travel styles across Southeast Asia", { style: styleLabel });
    booking = frontendT(
      "tours.booking.style",
      "Showing {styleLower} journeys across Vietnam, Thailand, Cambodia, and Laos.",
      { styleLower }
    );
    pageTitle = frontendT("tours.page_title.style", "AsiaTravelPlan | {style} Southeast Asia Tours", {
      style: styleLabel
    });
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
      const tripTitle = resolveLocalizedFrontendText(trip?.title, state.lang);
      const tripShortDescription = resolveLocalizedFrontendText(trip?.short_description, state.lang);
      const tags = trip.styles.map((style) => `<span class="tag">${escapeHTML(style)}</span>`).join("");
      const countries = tourDestinations(trip);
      const countriesLabel = countries.join(", ");
      const displayCurrency = preferredCurrencyForFrontendLang(state.lang);
      const displayAmount = approximateDisplayAmountFromUSD(trip?.budget_lower_usd, displayCurrency);
      const priceLabel = Number.isFinite(displayAmount)
        ? formatDisplayMoney(displayAmount, displayCurrency, state.lang || currentFrontendLang())
        : formatDisplayMoney(trip?.budget_lower_usd, DEFAULT_BOOKING_CURRENCY, state.lang || currentFrontendLang());
      const price = typeof trip.budget_lower_usd === "number"
        ? frontendT("tour.card.from_price", "From ${price}", {
          price: priceLabel
        })
        : frontendT("tour.card.custom_quote", "Custom quote");
      const rating = typeof trip.rating === "number" ? `★ ${trip.rating.toFixed(1)}` : "";
      const daysLabel = frontendT("tour.card.days", "{days} days", { days: trip.travel_duration_days });
      const ctaLabel = frontendT("tour.card.plan_trip", "Plan this trip");
      const loading = index < 3 ? "eager" : "lazy";
      const fetchpriority = index < 3 ? "high" : "auto";

      return `
        <article class="tour-card">
          <img
            src="${escapeAttr(trip.image)}"
            alt="${escapeAttr(frontendT("tour.card.image_alt", "{title} in {destinations}", {
              title: tripTitle,
              destinations: countriesLabel
            }))}"
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
            <h3 class="tour-title">${escapeHTML(tripTitle)}</h3>
            <p class="tour-desc">${escapeHTML(tripShortDescription)}</p>
            <div class="tags">${tags}</div>
            <div class="meta">
              <span>${escapeHTML(daysLabel)}</span>
              <span>${escapeHTML(price)}</span>
            </div>
            <button class="btn btn-primary" type="button" data-open-modal data-trip-id="${escapeAttr(trip.id)}">${escapeHTML(ctaLabel)}</button>
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
        setBookingField("bookingDestination", tourDestinations(selected));
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

function populateFilterOptions() {
  const destinations = filterOptionList("destination");
  const styles = filterOptionList("style");
  const bookingDestinations = destinations.map((option) => option.label);
  const bookingStyles = styles.map((option) => option.label);

  if (els.navDestinationOptions) {
    els.navDestinationOptions.innerHTML = destinations
      .map((destination) => renderFilterCheckbox("destination", destination.code, destination.label))
      .join("");
  }

  if (els.navStyleOptions) {
    els.navStyleOptions.innerHTML = styles
      .map((style) => renderFilterCheckbox("style", style.code, style.label))
      .join("");
  }

  if (els.bookingDestinationOptions) {
    els.bookingDestinationOptions.innerHTML = bookingDestinations
      .map((destination) => renderFilterCheckbox("bookingDestination", destination, destination))
      .join("");
  }

  if (els.bookingStyleOptions) {
    els.bookingStyleOptions.innerHTML = bookingStyles
      .map((style) => renderFilterCheckbox("bookingStyle", style, style))
      .join("");
  }
}

function renderFilterCheckbox(kind, value, label = value) {
  const safeValue = escapeHTML(value);
  const safeLabel = escapeHTML(label);
  const inputId = `${kind}Filter_${value.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  return `
    <label class="filter-checkbox-option" for="${escapeHTML(inputId)}">
      <input id="${escapeHTML(inputId)}" type="checkbox" value="${safeValue}" />
      <span>${safeLabel}</span>
    </label>
  `;
}

function tourDestinations(trip) {
  if (Array.isArray(trip?.destinations) && trip.destinations.length) {
    return trip.destinations.map((value) => String(value || "").trim()).filter(Boolean);
  }
  return [];
}

function tourDestinationCodes(trip) {
  if (Array.isArray(trip?.destination_codes) && trip.destination_codes.length) {
    return trip.destination_codes.map((value) => normalizeText(value)).filter(Boolean);
  }
  return normalizeSelectionToCodes(tourDestinations(trip), "destination");
}

function tourStyleCodes(trip) {
  if (Array.isArray(trip?.style_codes) && trip.style_codes.length) {
    return trip.style_codes.map((value) => normalizeText(value)).filter(Boolean);
  }
  return normalizeSelectionToCodes(Array.isArray(trip?.styles) ? trip.styles : [], "style");
}

function normalizeFilterOptionList(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (item && typeof item === "object") {
        return {
          code: normalizeText(item.code),
          label: normalizeText(item.label) || normalizeText(item.code)
        };
      }
      const value = normalizeText(item);
      return value ? { code: value, label: value } : null;
    })
    .filter((item) => item?.code && item?.label);
}

function filterOptionList(kind) {
  const raw = kind === "destination" ? state.filterOptions.destinations : state.filterOptions.styles;
  return normalizeFilterOptionList(raw);
}

function filterLabel(kind, value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  const options = filterOptionList(kind);
  const match = options.find((option) => normalizeText(option.code).toLowerCase() === normalized.toLowerCase());
  return match?.label || normalized;
}

function filterLabels(values, kind) {
  return (Array.isArray(values) ? values : []).map((value) => filterLabel(kind, value)).filter(Boolean);
}

function normalizeSelectionToCodes(values, kind) {
  const options = filterOptionList(kind);
  return Array.from(new Set((Array.isArray(values) ? values : [values])
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .map((value) => {
      const lower = value.toLowerCase();
      const match = options.find((option) => {
        const code = normalizeText(option.code).toLowerCase();
        const label = normalizeText(option.label).toLowerCase();
        return lower === code || lower === label;
      });
      return normalizeText(match?.code || lower).toLowerCase();
    })
    .filter(Boolean)));
}

function normalizeActiveFiltersFromOptions() {
  state.filters.dest = normalizeSelectionToCodes(state.filters.dest, "destination");
  state.filters.style = normalizeSelectionToCodes(state.filters.style, "style");
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
    { trigger: els.navStyleTrigger, panel: els.navStylePanel },
    { trigger: els.bookingDestinationTrigger, panel: els.bookingDestinationPanel },
    { trigger: els.bookingStyleTrigger, panel: els.bookingStylePanel }
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

  if (els.bookingDestinationOptions) {
    els.bookingDestinationOptions.addEventListener("change", () => {
      updateBookingSelectionFromOptions("bookingDestination", els.bookingDestinationOptions);
    });
  }

  if (els.bookingStyleOptions) {
    els.bookingStyleOptions.addEventListener("change", () => {
      updateBookingSelectionFromOptions("bookingStyle", els.bookingStyleOptions);
    });
  }
}

async function loadTrips() {
  const cached = getCachedTours();
  if (cached) return cached;

  try {
    const toursRequest = publicToursRequest({
      baseURL: API_BASE_ORIGIN,
      query: { v: TRIPS_REQUEST_VERSION, lang: currentFrontendLang() }
    });
    const response = await fetch(toursRequest.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Backend tours request failed with status ${response.status}.`);
    }
    const payload = await response.json();
    const normalizedPayload = normalizeToursPayloadForFrontend(payload);
    setCachedTours(normalizedPayload);
    return normalizedPayload;
  } catch (error) {
    throw error;
  }
}

function normalizeToursPayloadForFrontend(payload) {
  const source = Array.isArray(payload) ? { items: payload } : (payload || {});
  return {
    items: normalizeToursForFrontend(Array.isArray(source.items) ? source.items : []),
    available_destinations: normalizeFilterOptionList(source.available_destinations),
    available_styles: normalizeFilterOptionList(source.available_styles)
  };
}

function normalizeToursForFrontend(items) {
  const lang = currentFrontendLang();
  return (Array.isArray(items) ? items : []).map((item) => {
    const image = resolveTourImage(item);
    const normalizedTitle = resolveLocalizedFrontendText(item?.title, lang);
    const normalizedShortDescription = resolveLocalizedFrontendText(item?.short_description, lang);
    const normalizedHighlights = resolveLocalizedFrontendStringArray(item?.highlights, lang);
    return {
      ...item,
      title: normalizedTitle,
      short_description: normalizedShortDescription,
      highlights: normalizedHighlights,
      image
    };
  });
}

function normalizeFrontendTourLang(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return "en";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (normalized === "fr" || normalized.startsWith("fr-")) return "fr";
  if (normalized === "zh" || normalized.startsWith("zh-") || normalized.includes("chinese") || normalized.includes("mandarin")) return "zh";
  if (normalized === "ja" || normalized.startsWith("ja-") || normalized.includes("japanese")) return "ja";
  if (normalized === "ko" || normalized.startsWith("ko-") || normalized.includes("korean")) return "ko";
  if (normalized === "vi" || normalized.startsWith("vi-") || normalized.includes("vietnam")) return "vi";
  if (normalized === "de" || normalized.startsWith("de-") || normalized.includes("german") || normalized.includes("deutsch")) return "de";
  if (normalized === "es" || normalized.startsWith("es-") || normalized.includes("spanish") || normalized.includes("español") || normalized.includes("espanol")) return "es";
  if (normalized === "it" || normalized.startsWith("it-") || normalized.includes("italian") || normalized.includes("italiano")) return "it";
  if (normalized === "ru" || normalized.startsWith("ru-") || normalized.includes("russian") || normalized.includes("рус")) return "ru";
  if (normalized === "nl" || normalized.startsWith("nl-") || normalized.includes("dutch") || normalized.includes("nederlands")) return "nl";
  if (normalized === "pl" || normalized.startsWith("pl-") || normalized.includes("polish") || normalized.includes("polski")) return "pl";
  if (normalized === "da" || normalized.startsWith("da-") || normalized.includes("danish") || normalized.includes("dansk")) return "da";
  if (normalized === "sv" || normalized.startsWith("sv-") || normalized.includes("swedish") || normalized.includes("svenska")) return "sv";
  if (normalized === "no" || normalized.startsWith("no-") || normalized.startsWith("nb-") || normalized.startsWith("nn-") || normalized.includes("norwegian") || normalized.includes("norsk")) return "no";
  return "en";
}

function resolveLocalizedFrontendText(value, lang = currentFrontendLang()) {
  if (typeof value === "string") return normalizeText(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";

  const normalizedLang = normalizeFrontendTourLang(lang);
  const candidates = [normalizedLang, "en", ...Object.keys(value)];
  for (const candidate of candidates) {
    const text = normalizeText(value[candidate]);
    if (text) return text;
  }
  return "";
}

function resolveLocalizedFrontendStringArray(value, lang = currentFrontendLang()) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeText(entry)).filter(Boolean);
  }
  if (!value || typeof value !== "object") return [];

  const normalizedLang = normalizeFrontendTourLang(lang);
  const candidates = [normalizedLang, "en", ...Object.keys(value)];
  for (const candidate of candidates) {
    const items = Array.isArray(value[candidate]) ? value[candidate].map((entry) => normalizeText(entry)).filter(Boolean) : [];
    if (items.length) return items;
  }
  return [];
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
    const raw = localStorage.getItem(toursCacheKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ts = Number(parsed?.ts || 0);
    if (!parsed || typeof parsed !== "object") return null;
    if (Date.now() - ts > TOURS_CACHE_TTL_MS) return null;
    if (!Array.isArray(parsed.items)) return null;
    return normalizeToursPayloadForFrontend(parsed);
  } catch {
    return null;
  }
}

function setCachedTours(payload) {
  try {
    localStorage.setItem(
      toursCacheKey(),
      JSON.stringify({
        ts: Date.now(),
        items: Array.isArray(payload?.items) ? payload.items : [],
        available_destinations: Array.isArray(payload?.available_destinations) ? payload.available_destinations : [],
        available_styles: Array.isArray(payload?.available_styles) ? payload.available_styles : []
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
    console.error(error);
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
