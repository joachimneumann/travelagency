import {
  GENERATED_CURRENCY_CODES,
  GENERATED_CURRENCIES,
  normalizeCurrencyCode as normalizeGeneratedCurrencyCode
} from "../Generated/Models/generated_Currency.js";
import { GENERATED_LANGUAGE_CODES } from "../Generated/Models/generated_Language.js";
import {
  languageByApiValue,
  languageByCode
} from "../../shared/generated/language_catalog.js";
import {
  MAX_TRAVELERS as GENERATED_MAX_TRAVELERS,
  MIN_TRAVELERS as GENERATED_MIN_TRAVELERS
} from "../Generated/Models/generated_FormConstraints.js";
import { normalizeText } from "../../shared/js/text.js";

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

const MIN_TRAVELERS = Number.isFinite(Number(GENERATED_MIN_TRAVELERS))
  ? Number(GENERATED_MIN_TRAVELERS)
  : 1;
const MAX_TRAVELERS = Number.isFinite(Number(GENERATED_MAX_TRAVELERS)) &&
  Number(GENERATED_MAX_TRAVELERS) >= MIN_TRAVELERS
  ? Number(GENERATED_MAX_TRAVELERS)
  : 30;

export function createFrontendBookingFormOptionsController(ctx) {
  const {
    els,
    state,
    frontendT,
    currentFrontendLang,
    syncLocalizedControlLanguage,
    escapeHTML,
    escapeAttr,
    publicBookingCreateRequestSchema
  } = ctx;

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

  function languageCodeFromValue(value) {
    const raw = normalizeText(value);
    if (!raw) return "";
    const byCode = languageByCode(raw);
    if (byCode && GENERATED_LANGUAGE_CODES.includes(byCode.code)) return byCode.code;
    const byApiValue = languageByApiValue(raw);
    if (byApiValue && GENERATED_LANGUAGE_CODES.includes(byApiValue.code)) return byApiValue.code;
    return "";
  }

  function preferredBookingLanguageForFrontendLang(lang = state.lang || currentFrontendLang()) {
    return languageCodeFromValue(lang) || "en";
  }

  function preferredCurrencyForLanguageValue(value) {
    const languageCode = languageCodeFromValue(value) || state.lang || currentFrontendLang();
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
    const entry = languageByCode(normalizeText(value));
    if (!entry) return String(value || "");
    if (!entry.frontendNameKey) return entry.nativeLabel || entry.apiValue || entry.code.toUpperCase();
    return frontendT(entry.frontendNameKey, entry.nativeLabel || entry.apiValue || entry.code.toUpperCase());
  }

  function applyGeneratedRequiredAttributes() {
    if (!els.bookingForm) return;
    const requiredNames = new Set(
      Array.isArray(publicBookingCreateRequestSchema?.fields)
        ? publicBookingCreateRequestSchema.fields.filter((field) => field.required).map((field) => field.name)
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

  function populateGeneratedWebFormOptions() {
    const preferredLanguage = languageCodeFromValue(els.bookingLanguage?.value || preferredBookingLanguageForFrontendLang()) || "en";
    const preferredCurrency = normalizeCurrencyCode(
      els.bookingPreferredCurrency?.value || preferredCurrencyForLanguageValue(preferredLanguage)
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

  function setupBookingBudgetOptions() {
    if (!els.bookingPreferredCurrency || !els.bookingBudget) return;
    populateGeneratedWebFormOptions();
    els.bookingPreferredCurrency.value = normalizeCurrencyCode(
      els.bookingPreferredCurrency.value || preferredCurrencyForLanguageValue(els.bookingLanguage?.value || preferredBookingLanguageForFrontendLang())
    );
    renderBudgetOptions(els.bookingPreferredCurrency.value);
    els.bookingPreferredCurrency.addEventListener("change", () => {
      renderBudgetOptions(els.bookingPreferredCurrency.value);
    });
    els.bookingLanguage?.addEventListener("change", () => {
      const nextCurrency = preferredCurrencyForLanguageValue(els.bookingLanguage.value || preferredBookingLanguageForFrontendLang());
      els.bookingPreferredCurrency.value = nextCurrency;
      renderBudgetOptions(nextCurrency);
    });
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

  function syncTravelMonthHiddenField() {
    if (!els.bookingMonth || !els.bookingMonthMonth || !els.bookingMonthYear) return;
    const month = normalizeText(els.bookingMonthMonth.value);
    const year = normalizeText(els.bookingMonthYear.value);
    els.bookingMonth.value = month && year ? `${year}-${month}` : "";
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

  return {
    DEFAULT_BOOKING_CURRENCY,
    MAX_TRAVELERS,
    MIN_TRAVELERS,
    approximateDisplayAmountFromUSD,
    buildFirstTravelMonthValue,
    findBudgetOptionValueByLowerUSD,
    findTravelDurationOptionByDays,
    formatDisplayMoney,
    getCurrencyDefinitions,
    getSelectedBudgetOption,
    languageCodeFromValue,
    normalizeCurrencyCode,
    parseTravelDurationRange,
    preferredBookingLanguageForFrontendLang,
    preferredCurrencyForFrontendLang,
    preferredCurrencyForLanguageValue,
    renderBudgetOptions,
    setTravelMonthValue,
    setupBookingBudgetOptions,
    setupTravelMonthControls
  };
}
