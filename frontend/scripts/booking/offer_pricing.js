import {
  offerExchangeRatesRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import {
  formatMoneyDisplay,
  formatMoneyInputValue,
  getCurrencyDefinitions,
  isWholeUnitCurrency,
  normalizeCurrencyCode,
  parseMoneyInputValue
} from "./pricing.js";
import { bookingSourceLang, bookingT } from "./i18n.js";
import { resolveLocalizedEditorBranchText } from "./localized_editor.js";

export function createBookingOfferPricingModule(ctx) {
  const {
    state,
    els,
    apiOrigin,
    fetchApi,
    escapeHtml,
    paymentTermsModule,
    defaultOfferTaxRateBasisPoints,
    offerCategories,
    setOfferSaveEnabled,
    setOfferStatus,
    getCountMissingOfferPdfTranslations,
    normalizeOfferCategory,
    normalizeOfferDetailLevel,
    isVisibleDetailLevelFinerThanInternal,
    cloneOfferPaymentTerms,
    updateOfferPanelSummary
  } = ctx;

  function resetOfferPricingUiState() {}

  function clearPendingTotals() {}

  function currentOfferInternalDetailLevel() {
    return normalizeOfferDetailLevel(state.offerDraft?.offer_detail_level_internal, "trip");
  }

  function currentOfferVisibleDetailLevel() {
    const internalDetailLevel = currentOfferInternalDetailLevel();
    const visibleDetailLevel = normalizeOfferDetailLevel(state.offerDraft?.offer_detail_level_visible, internalDetailLevel);
    return isVisibleDetailLevelFinerThanInternal(visibleDetailLevel, internalDetailLevel)
      ? internalDetailLevel
      : visibleDetailLevel;
  }

  function updateOfferVisiblePricingHintState() {
    if (!els.offer_visible_pricing_hint) return;
    const visibleDetailLevel = currentOfferVisibleDetailLevel();
    els.offer_visible_pricing_hint.textContent = bookingT(
      "booking.offer.visible_pricing_hint",
      "Customer documents will show {detailLevel} pricing. Adjustments stay visible as separate lines.",
      { detailLevel: visibleDetailLevel }
    );
    els.offer_visible_pricing_hint.classList.remove("booking-inline-status--error");
    els.offer_visible_pricing_hint.classList.add("booking-inline-status--success");
  }

  function defaultOfferCategoryRules() {
    return offerCategories.map((category) => ({
      category: category.code,
      tax_rate_basis_points: defaultOfferTaxRateBasisPoints
    }));
  }

  function offerCategoryLabel(code) {
    const normalized = normalizeOfferCategory(code);
    const fallback = normalized
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    return bookingT(`booking.offer_category.${normalized.toLowerCase()}`, fallback || bookingT("booking.offer_category.other", "Other"));
  }

  function offerCategorySign(code) {
    return normalizeOfferCategory(code) === "DISCOUNTS_CREDITS" ? -1 : 1;
  }

  function localizedFieldHasAnyText(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return Object.values(value).some((candidate) => String(candidate || "").trim());
  }

  function localizedFieldHasTargetLang(value, lang) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return Boolean(String(value[lang] || "").trim());
  }

  function countMissingOfferPdfTranslations(booking, lang) {
    if (typeof getCountMissingOfferPdfTranslations === "function") {
      return getCountMissingOfferPdfTranslations(booking, lang);
    }
    if (!booking || lang === bookingSourceLang("en")) return 0;
    const normalizedLang = String(lang || "").trim().toLowerCase();
    const travelPlanSummary = booking?.travel_plan_translation_status;
    if (travelPlanSummary?.lang === normalizedLang) {
      return Number(travelPlanSummary?.missing_fields || 0);
    }
    let missing = 0;
    const considerField = (value) => {
      if (!localizedFieldHasAnyText(value)) return;
      if (!localizedFieldHasTargetLang(value, lang)) missing += 1;
    };
    const travelDays = Array.isArray(booking?.travel_plan?.days) ? booking.travel_plan.days : [];
    travelDays.forEach((day) => {
      considerField(day?.title_i18n);
      considerField(day?.overnight_location_i18n);
      considerField(day?.notes_i18n);
      const services = Array.isArray(day?.services)
        ? day.services
        : (Array.isArray(day?.items) ? day.items : []);
      services.forEach((item) => {
        considerField(item?.time_label_i18n);
        considerField(item?.title_i18n);
        considerField(item?.details_i18n);
        considerField(item?.location_i18n);
      });
    });
    return missing;
  }

  function getOfferCategoryTaxRateBasisPoints(category) {
    const normalizedCategory = normalizeOfferCategory(category);
    const rule = Array.isArray(state.offerDraft?.category_rules)
      ? state.offerDraft.category_rules.find((categoryRule) => normalizeOfferCategory(categoryRule?.category) === normalizedCategory)
      : null;
    return normalizeOfferTaxRateBasisPoints(rule?.tax_rate_basis_points, defaultOfferTaxRateBasisPoints);
  }

  function normalizeOfferTaxRateBasisPoints(value, fallback = defaultOfferTaxRateBasisPoints) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return Math.max(0, Math.round(numeric));
    const fallbackNumeric = Number(fallback);
    return Number.isFinite(fallbackNumeric) ? Math.max(0, Math.round(fallbackNumeric)) : defaultOfferTaxRateBasisPoints;
  }

  function readOfferTaxRateBasisPointsInput(input, fallback = defaultOfferTaxRateBasisPoints) {
    const rawValue = String(input?.value ?? "").trim();
    if (!rawValue) return normalizeOfferTaxRateBasisPoints(fallback, defaultOfferTaxRateBasisPoints);
    return normalizeOfferTaxRateBasisPoints(Number(rawValue) * 100, fallback);
  }

  function offerDayName(dayNumber) {
    const normalizedDayNumber = Number(dayNumber || 0);
    if (!Number.isFinite(normalizedDayNumber) || normalizedDayNumber < 1) return "";
    const travelDay = (Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [])[normalizedDayNumber - 1];
    if (!travelDay) return "";
    return resolveLocalizedEditorBranchText(travelDay.title_i18n ?? travelDay.title, bookingSourceLang(), "").trim();
  }

  function computeOfferDiscountLineTotals(discount) {
    const amount = Math.max(0, Number(discount?.amount_cents || 0));
    const line_net_amount_cents = -amount;
    const line_tax_amount_cents = 0;
    const line_gross_amount_cents = -amount;
    return {
      net_amount_cents: line_net_amount_cents,
      tax_amount_cents: line_tax_amount_cents,
      gross_amount_cents: line_gross_amount_cents,
      line_net_amount_cents,
      line_tax_amount_cents,
      line_gross_amount_cents
    };
  }

  function computeOfferTripPriceLineTotals(tripPrice) {
    const amount = Math.max(0, Number(tripPrice?.amount_cents || 0));
    const taxBasisPoints = Math.max(0, Number(tripPrice?.tax_rate_basis_points || 0));
    const taxAmount = Math.round((amount * taxBasisPoints) / 10000);
    const line_net_amount_cents = amount;
    const line_tax_amount_cents = taxAmount;
    const line_gross_amount_cents = amount + taxAmount;
    return {
      net_amount_cents: line_net_amount_cents,
      tax_amount_cents: line_tax_amount_cents,
      gross_amount_cents: line_gross_amount_cents,
      line_net_amount_cents,
      line_tax_amount_cents,
      line_gross_amount_cents
    };
  }

  function computeOfferDayInternalLineTotals(dayPrice) {
    const amount = Math.max(0, Number(dayPrice?.amount_cents || 0));
    const taxBasisPoints = Math.max(0, Number(dayPrice?.tax_rate_basis_points || 0));
    const taxAmount = Math.round((amount * taxBasisPoints) / 10000);
    const line_net_amount_cents = amount;
    const line_tax_amount_cents = taxAmount;
    const line_gross_amount_cents = amount + taxAmount;
    return {
      net_amount_cents: line_net_amount_cents,
      tax_amount_cents: line_tax_amount_cents,
      gross_amount_cents: line_gross_amount_cents,
      line_net_amount_cents,
      line_tax_amount_cents,
      line_gross_amount_cents
    };
  }

  function computeOfferAdditionalItemLineTotals(item) {
    const quantity = Math.max(1, Number(item?.quantity || 1));
    const unitAmount = Math.max(0, Number(item?.unit_amount_cents || 0));
    const taxBasisPoints = Math.max(0, Number(item?.tax_rate_basis_points || 0));
    const unitTaxAmount = Math.round((unitAmount * taxBasisPoints) / 10000);
    const line_net_amount_cents = quantity * unitAmount;
    const line_tax_amount_cents = quantity * unitTaxAmount;
    const line_gross_amount_cents = quantity * (unitAmount + unitTaxAmount);
    return {
      net_amount_cents: line_net_amount_cents,
      tax_amount_cents: line_tax_amount_cents,
      gross_amount_cents: line_gross_amount_cents,
      line_net_amount_cents,
      line_tax_amount_cents,
      line_gross_amount_cents
    };
  }

  function deriveUnitNetAmountFromGross(grossAmountCents, taxRateBasisPoints) {
    const gross = Math.max(0, Math.round(Number(grossAmountCents || 0)));
    const basisPoints = Math.max(0, Math.round(Number(taxRateBasisPoints || 0)));
    if (basisPoints <= 0) return gross;
    const estimated = Math.max(0, Math.round((gross * 10000) / (10000 + basisPoints)));
    let bestNet = estimated;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (let candidate = Math.max(0, estimated - 4); candidate <= estimated + 4; candidate += 1) {
      const candidateGross = candidate + Math.round((candidate * basisPoints) / 10000);
      const delta = Math.abs(candidateGross - gross);
      if (delta < bestDelta || (delta === bestDelta && Math.abs(candidate - estimated) < Math.abs(bestNet - estimated))) {
        bestDelta = delta;
        bestNet = candidate;
      }
    }
    return bestNet;
  }

  function buildOfferMainChargeLines(offerDraft = state.offerDraft) {
    const internalDetailLevel = normalizeOfferDetailLevel(offerDraft?.offer_detail_level_internal, "trip");
    if (internalDetailLevel === "trip") {
      return offerDraft?.trip_price_internal ? [offerDraft.trip_price_internal] : [];
    }
    return Array.isArray(offerDraft?.days_internal) ? offerDraft.days_internal : [];
  }

  function buildOfferChargeLines(offerDraft = state.offerDraft) {
    const internalDetailLevel = normalizeOfferDetailLevel(offerDraft?.offer_detail_level_internal, "trip");
    const mainLines = buildOfferMainChargeLines(offerDraft).map((line) => {
      if (internalDetailLevel === "trip") return computeOfferTripPriceLineTotals(line);
      return computeOfferDayInternalLineTotals(line);
    });
    const additionalLines = (Array.isArray(offerDraft?.additional_items) ? offerDraft.additional_items : [])
      .map((item) => computeOfferAdditionalItemLineTotals(item));
    const discountLines = (Array.isArray(offerDraft?.discounts) ? offerDraft.discounts : [])
      .filter((discount) => Number(discount?.amount_cents || 0) > 0)
      .map((discount) => computeOfferDiscountLineTotals(discount));
    return [
      ...mainLines,
      ...additionalLines,
      ...discountLines
    ];
  }

  function computeOfferDraftTotals(offerDraft = state.offerDraft) {
    let net_amount_cents = 0;
    let tax_amount_cents = 0;
    for (const line of buildOfferChargeLines(offerDraft)) {
      net_amount_cents += line.net_amount_cents;
      tax_amount_cents += line.tax_amount_cents;
    }
    const currency = normalizeCurrencyCode(offerDraft?.currency || state.booking?.preferred_currency || "USD");
    const internalDetailLevel = normalizeOfferDetailLevel(offerDraft?.offer_detail_level_internal, "trip");
    const mainCount = internalDetailLevel === "trip"
      ? (offerDraft?.trip_price_internal ? 1 : 0)
      : (Array.isArray(offerDraft?.days_internal) ? offerDraft.days_internal.length : 0);
    const additionalCount = Array.isArray(offerDraft?.additional_items) ? offerDraft.additional_items.length : 0;
    const discountCount = (Array.isArray(offerDraft?.discounts) ? offerDraft.discounts : [])
      .filter((discount) => Number(discount?.amount_cents || 0) > 0)
      .length;
    return {
      currency,
      net_amount_cents,
      tax_amount_cents,
      gross_amount_cents: net_amount_cents + tax_amount_cents,
      items_count: mainCount + additionalCount + discountCount
    };
  }

  function computeOfferDraftQuotationSummary(offerDraft = state.offerDraft) {
    const totals = computeOfferDraftTotals(offerDraft);
    const buckets = new Map();
    buildOfferMainChargeLines(offerDraft).forEach((lineSource) => {
      const internalDetailLevel = normalizeOfferDetailLevel(offerDraft?.offer_detail_level_internal, "trip");
      const line = internalDetailLevel === "trip"
        ? computeOfferTripPriceLineTotals(lineSource)
        : computeOfferDayInternalLineTotals(lineSource);
      if (!line.net_amount_cents && !line.tax_amount_cents && !line.gross_amount_cents) return;
      const basisPoints = Math.max(0, Number(lineSource?.tax_rate_basis_points || 0));
      const bucket = buckets.get(basisPoints) || {
        tax_rate_basis_points: basisPoints,
        net_amount_cents: 0,
        tax_amount_cents: 0,
        gross_amount_cents: 0,
        items_count: 0
      };
      bucket.net_amount_cents += line.net_amount_cents;
      bucket.tax_amount_cents += line.tax_amount_cents;
      bucket.gross_amount_cents += line.gross_amount_cents;
      bucket.items_count += 1;
      buckets.set(basisPoints, bucket);
    });
    (Array.isArray(offerDraft?.additional_items) ? offerDraft.additional_items : []).forEach((item) => {
      const line = computeOfferAdditionalItemLineTotals(item);
      if (!line.line_net_amount_cents && !line.line_tax_amount_cents && !line.line_gross_amount_cents) return;
      const basisPoints = Math.max(0, Number(item?.tax_rate_basis_points || 0));
      const bucket = buckets.get(basisPoints) || {
        tax_rate_basis_points: basisPoints,
        net_amount_cents: 0,
        tax_amount_cents: 0,
        gross_amount_cents: 0,
        items_count: 0
      };
      bucket.net_amount_cents += line.line_net_amount_cents;
      bucket.tax_amount_cents += line.line_tax_amount_cents;
      bucket.gross_amount_cents += line.line_gross_amount_cents;
      bucket.items_count += 1;
      buckets.set(basisPoints, bucket);
    });
    (Array.isArray(offerDraft?.discounts) ? offerDraft.discounts : []).forEach((discount) => {
      if (!discount || Number(discount?.amount_cents || 0) <= 0) return;
      const line = computeOfferDiscountLineTotals(discount);
      const bucket = buckets.get(0) || {
        tax_rate_basis_points: 0,
        net_amount_cents: 0,
        tax_amount_cents: 0,
        gross_amount_cents: 0,
        items_count: 0
      };
      bucket.net_amount_cents += line.line_net_amount_cents;
      bucket.tax_amount_cents += line.line_tax_amount_cents;
      bucket.gross_amount_cents += line.line_gross_amount_cents;
      bucket.items_count += 1;
      buckets.set(0, bucket);
    });
    return {
      tax_included: true,
      subtotal_net_amount_cents: totals.net_amount_cents,
      total_tax_amount_cents: totals.tax_amount_cents,
      grand_total_amount_cents: totals.gross_amount_cents,
      tax_breakdown: Array.from(buckets.values()).sort((left, right) => left.tax_rate_basis_points - right.tax_rate_basis_points)
    };
  }

  function resolveOfferTotalCents() {
    const offerTotals = computeOfferDraftTotals(state.offerDraft);
    if (Number.isFinite(Number(offerTotals?.gross_amount_cents))) {
      return Math.round(Number(offerTotals.gross_amount_cents));
    }
    const explicitTotal = Number(state.offerDraft?.total_price_cents);
    return Number.isFinite(explicitTotal) ? Math.round(explicitTotal) : 0;
  }

  function formatTaxRateLabel(basisPoints) {
    const numeric = Math.max(0, Number(basisPoints || 0)) / 100;
    const text = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, "");
    return bookingT("booking.offer.tax_rate_label", "Tax {rate}%", { rate: text });
  }

  function formatTaxRateInputValue(basisPoints) {
    const numeric = Math.max(0, Number(basisPoints || 0)) / 100;
    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, "");
  }

  function renderOfferQuotationSummary() {
    if (!els.offer_quotation_summary) return;
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    const mainLines = buildOfferMainChargeLines(state.offerDraft);
    const additionalItems = Array.isArray(state.offerDraft?.additional_items) ? state.offerDraft.additional_items : [];
    const discounts = Array.isArray(state.offerDraft?.discounts) ? state.offerDraft.discounts : [];
    const hasDiscounts = discounts.some((discount) => Number(discount?.amount_cents || 0) > 0);
    if (!mainLines.length && !additionalItems.length && !hasDiscounts) {
      els.offer_quotation_summary.hidden = true;
      els.offer_quotation_summary.innerHTML = "";
      return;
    }
    const summary = computeOfferDraftQuotationSummary(state.offerDraft);
    const rows = [
      {
        label: bookingT("booking.offer.subtotal_before_tax", "Subtotal before tax"),
        value: formatMoneyDisplay(summary.subtotal_net_amount_cents || 0, currency)
      },
      ...summary.tax_breakdown
        .filter((bucket) => Number(bucket?.tax_amount_cents || 0) !== 0)
        .map((bucket) => ({
          label: formatTaxRateLabel(bucket.tax_rate_basis_points),
          value: formatMoneyDisplay(bucket.tax_amount_cents || 0, currency)
        })),
      {
        label: bookingT("booking.offer.total_with_tax", "Total with tax"),
        value: formatMoneyDisplay(summary.grand_total_amount_cents || 0, currency),
        isTotal: true
      }
    ];
    els.offer_quotation_summary.innerHTML = `
      <div class="offer-quotation-summary__card">
        <div class="offer-quotation-summary__title">${escapeHtml(bookingT("booking.offer.quotation_tax_summary", "Quotation tax summary"))}</div>
        <div class="offer-quotation-summary__rows">
          ${rows.map((row) => `
            <div class="offer-quotation-summary__row${row.isTotal ? " is-total" : ""}">
              <span class="offer-quotation-summary__label">${escapeHtml(row.label)}</span>
              <span class="offer-quotation-summary__value">${escapeHtml(row.value)}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
    els.offer_quotation_summary.hidden = false;
  }

  function readOfferDraftDiscountsForRender() {
    const fallbackDiscounts = Array.isArray(state.offerDraft?.discounts) ? state.offerDraft.discounts : [];
    const rows = Array.from(document.querySelectorAll("[data-offer-discount-row]"));
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    if (!rows.length) return fallbackDiscounts;
    return rows.map((row, index) => {
      const fallback = fallbackDiscounts[index] || {};
      const reasonInput = row.querySelector("[data-offer-discount-reason]");
      const amountInput = row.querySelector("[data-offer-discount-amount]");
      const amount = amountInput
        ? parseMoneyInputValue(amountInput.value, currency)
        : Number(fallback?.amount_cents || 0);
      const normalizedAmount = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
      const reason = String(reasonInput?.value ?? fallback?.reason ?? "").trim();
      if (!reason && normalizedAmount <= 0 && !String(fallback?.id || "").trim()) {
        return null;
      }
      return {
        id: String(fallback?.id || `offer_discount_${index + 1}`),
        reason,
        amount_cents: normalizedAmount,
        currency,
        sort_order: Number.isFinite(Number(fallback?.sort_order)) ? Number(fallback.sort_order) : index
      };
    }).filter(Boolean);
  }

  function createEmptyTripPriceInternal() {
    return {
      label: bookingT("booking.offer.trip_total", "Trip total"),
      amount_cents: 0,
      tax_rate_basis_points: defaultOfferTaxRateBasisPoints,
      currency: normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD"),
      notes: ""
    };
  }

  function createEmptyDayPriceInternal(dayNumber) {
    const normalizedDayNumber = Number.isInteger(Number(dayNumber)) && Number(dayNumber) >= 1 ? Number(dayNumber) : 1;
    return {
      id: "",
      day_number: normalizedDayNumber,
      label: bookingT("booking.offer.day_number.day", "Day {day}", { day: normalizedDayNumber }),
      amount_cents: 0,
      tax_rate_basis_points: defaultOfferTaxRateBasisPoints,
      currency: normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD"),
      notes: "",
      sort_order: normalizedDayNumber - 1
    };
  }

  function createEmptyAdditionalItem() {
    const nextIndex = Array.isArray(state.offerDraft?.additional_items) ? state.offerDraft.additional_items.length : 0;
    return {
      id: "",
      label: "",
      details: "",
      day_number: null,
      quantity: 1,
      unit_amount_cents: 0,
      tax_rate_basis_points: defaultOfferTaxRateBasisPoints,
      currency: normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD"),
      category: "OTHER",
      notes: "",
      sort_order: nextIndex
    };
  }

  function createEmptyDiscount() {
    const nextIndex = Array.isArray(state.offerDraft?.discounts) ? state.offerDraft.discounts.length : 0;
    return {
      id: "",
      reason: "",
      amount_cents: 0,
      currency: normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD"),
      sort_order: nextIndex
    };
  }

  function createSurchargeAdditionalItem(amountCents, details = "") {
    return {
      id: "",
      label: bookingT("booking.offer.additional_item", "Additional item"),
      details: String(details || "").trim() || bookingT("booking.offer.carry_over_surcharge", "Carry-over surcharge"),
      day_number: null,
      quantity: 1,
      unit_amount_cents: Math.max(0, Math.round(Number(amountCents || 0))),
      tax_rate_basis_points: 0,
      currency: normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD"),
      category: "OTHER",
      notes: "",
      sort_order: 0
    };
  }

  function hasMeaningfulAdditionalItem(item) {
    if (!item || typeof item !== "object") return false;
    return Boolean(
      String(item.label || "").trim()
      || String(item.details || "").trim()
      || Number(item.unit_amount_cents || 0) > 0
      || Number(item.quantity || 0) > 1
      || String(item.id || "").trim()
    );
  }

  function currentTravelPlanDayCount() {
    return Array.isArray(state.travelPlanDraft?.days)
      ? state.travelPlanDraft.days.length
      : (Array.isArray(state.booking?.travel_plan?.days) ? state.booking.travel_plan.days.length : 0);
  }

  function clearInactiveMainOfferStructures(internalDetailLevel) {
    if (!state.offerDraft || typeof state.offerDraft !== "object") return;
    const normalizedDetailLevel = normalizeOfferDetailLevel(internalDetailLevel, "trip");
    if (normalizedDetailLevel === "trip") {
      state.offerDraft.days_internal = [];
      return;
    }
    state.offerDraft.trip_price_internal = null;
  }

  function computeMainStructureGrossByDetailLevel(detailLevel) {
    const normalizedDetailLevel = normalizeOfferDetailLevel(detailLevel, "trip");
    if (normalizedDetailLevel === "trip") {
      return Math.max(0, Math.round(computeOfferTripPriceLineTotals(state.offerDraft?.trip_price_internal).line_gross_amount_cents || 0));
    }
    return (Array.isArray(state.offerDraft?.days_internal) ? state.offerDraft.days_internal : [])
      .reduce((sum, dayPrice) => sum + Math.max(0, Math.round(computeOfferDayInternalLineTotals(dayPrice).line_gross_amount_cents || 0)), 0);
  }

  function cloneAdditionalItems(items = state.offerDraft?.additional_items) {
    return (Array.isArray(items) ? items : []).map((item, index) => ({
      ...item,
      sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : index
    }));
  }

  function cloneDiscounts(discounts = state.offerDraft?.discounts) {
    return (Array.isArray(discounts) ? discounts : []).map((discount, index) => ({
      ...discount,
      id: String(discount?.id || `offer_discount_${index + 1}`),
      reason: String(discount?.reason || "").trim(),
      amount_cents: Math.max(0, Math.round(Number(discount?.amount_cents || 0))),
      currency: normalizeCurrencyCode(discount?.currency || state.offerDraft?.currency || state.booking?.preferred_currency || "USD"),
      sort_order: Number.isFinite(Number(discount?.sort_order)) ? Number(discount.sort_order) : index
    }));
  }

  function appendSurchargeAdditionalItem(items, amountCents, details = "") {
    const normalizedItems = cloneAdditionalItems(items);
    const normalizedAmount = Math.max(0, Math.round(Number(amountCents || 0)));
    if (normalizedAmount <= 0) return normalizedItems;
    return [
      ...normalizedItems,
      {
        ...createSurchargeAdditionalItem(normalizedAmount, details),
        sort_order: normalizedItems.length
      }
    ];
  }

  function applyDestructiveInternalDetailLevelTransition(fromDetailLevel, toDetailLevel) {
    if (!state.offerDraft || fromDetailLevel === toDetailLevel) return;
    const travelPlanDayCount = Math.max(0, currentTravelPlanDayCount());
    const currentMainGross = computeMainStructureGrossByDetailLevel(fromDetailLevel);
    const existingDays = Array.isArray(state.offerDraft?.days_internal) ? state.offerDraft.days_internal : [];
    const existingAdditionalItems = cloneAdditionalItems();
    const existingDiscounts = cloneDiscounts();

    if (toDetailLevel === "trip") {
      state.offerDraft.trip_price_internal = {
        ...createEmptyTripPriceInternal(),
        label: bookingT("booking.offer.trip_total", "Trip total"),
        amount_cents: currentMainGross,
        tax_rate_basis_points: 0
      };
      state.offerDraft.days_internal = [];
      state.offerDraft.additional_items = existingAdditionalItems;
      state.offerDraft.discounts = existingDiscounts;
      return;
    }

    if (toDetailLevel === "day") {
      state.offerDraft.days_internal = Array.from({ length: travelPlanDayCount }, (_, index) => ({
        ...createEmptyDayPriceInternal(index + 1),
        day_number: index + 1,
        amount_cents: 0,
        tax_rate_basis_points: 0,
        sort_order: index
      }));
      state.offerDraft.additional_items = appendSurchargeAdditionalItem(existingAdditionalItems, currentMainGross);
      state.offerDraft.trip_price_internal = null;
      state.offerDraft.discounts = existingDiscounts;
    }
  }

  function ensureOfferStructureForDetailLevel(internalDetailLevel) {
    const normalizedDetailLevel = normalizeOfferDetailLevel(internalDetailLevel, "trip");
    if (normalizedDetailLevel === "trip") {
      if (!state.offerDraft.trip_price_internal) {
        state.offerDraft.trip_price_internal = createEmptyTripPriceInternal();
      }
      return;
    }
    if (normalizedDetailLevel === "day") {
      const currentDays = Array.isArray(state.offerDraft?.days_internal) ? state.offerDraft.days_internal : [];
      const seedCount = Math.max(0, currentTravelPlanDayCount());
      state.offerDraft.days_internal = Array.from({ length: seedCount }, (_, index) => {
        const existing = currentDays.find((dayPrice) => Number(dayPrice?.day_number) === index + 1) || currentDays[index];
        return {
          ...createEmptyDayPriceInternal(index + 1),
          ...(existing && typeof existing === "object" ? existing : {}),
          day_number: index + 1,
          label: bookingT("booking.offer.day_number.day", "Day {day}", { day: index + 1 }),
          sort_order: index
        };
      });
    }
  }

  function syncOfferMainDraftFromDom() {
    const internalDetailLevel = currentOfferInternalDetailLevel();
    if (internalDetailLevel === "trip") {
      state.offerDraft.trip_price_internal = readOfferDraftTripPriceForRender();
      return;
    }
    state.offerDraft.days_internal = readOfferDraftDaysInternalForRender();
  }

  function syncOfferDraftFromDom() {
    syncOfferMainDraftFromDom();
    state.offerDraft.additional_items = readOfferDraftAdditionalItemsForRender();
    state.offerDraft.discounts = readOfferDraftDiscountsForRender();
    state.offerDraft.total_price_cents = null;
  }

  function readOfferDraftTripPriceForRender() {
    const fallback = state.offerDraft?.trip_price_internal && typeof state.offerDraft.trip_price_internal === "object"
      ? state.offerDraft.trip_price_internal
      : createEmptyTripPriceInternal();
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    const noteInput = document.querySelector("[data-offer-trip-note]");
    const amountInput = document.querySelector("[data-offer-trip-amount]");
    const taxInput = document.querySelector("[data-offer-trip-tax-rate]");
    return {
      ...fallback,
      label: String(fallback.label ?? "").trim(),
      ...(() => {
        const taxRateBasisPoints = readOfferTaxRateBasisPointsInput(taxInput, fallback.tax_rate_basis_points);
        const parsedGrossAmount = parseMoneyInputValue(amountInput?.value ?? "", currency);
        return {
          amount_cents: Number.isFinite(parsedGrossAmount)
            ? Math.max(0, Math.round(deriveUnitNetAmountFromGross(parsedGrossAmount, taxRateBasisPoints)))
            : Math.max(0, Number(fallback.amount_cents || 0)),
          tax_rate_basis_points: taxRateBasisPoints
        };
      })(),
      currency,
      notes: String(noteInput?.value ?? fallback.notes ?? "").trim()
    };
  }

  function readOfferDraftDaysInternalForRender() {
    const fallbackDays = Array.isArray(state.offerDraft?.days_internal) ? state.offerDraft.days_internal : [];
    const rows = Array.from(document.querySelectorAll("[data-offer-day-price-row]"));
    if (!rows.length) return fallbackDays;
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    return rows.map((row, index) => {
      const fallback = fallbackDays[index] || createEmptyDayPriceInternal(index + 1);
      const dayNumberInput = row.querySelector("[data-offer-day-number]");
      const noteInput = row.querySelector("[data-offer-day-note]");
      const amountInput = row.querySelector("[data-offer-day-price-incl-tax]") || row.querySelector("[data-offer-day-amount]");
      const taxInput = row.querySelector("[data-offer-day-tax-rate]");
      const parsedGrossAmount = parseMoneyInputValue(amountInput?.value ?? "", currency);
      const parsedDayNumber = Number.parseInt(String(dayNumberInput?.value || "").trim(), 10);
      const taxRateBasisPoints = readOfferTaxRateBasisPointsInput(taxInput, fallback.tax_rate_basis_points);
      return {
        ...fallback,
        day_number: Number.isInteger(parsedDayNumber) && parsedDayNumber >= 1 ? parsedDayNumber : index + 1,
        label: String(fallback.label || "").trim(),
        amount_cents: Number.isFinite(parsedGrossAmount)
          ? Math.max(0, Math.round(deriveUnitNetAmountFromGross(parsedGrossAmount, taxRateBasisPoints)))
          : Math.max(0, Number(fallback.amount_cents || 0)),
        tax_rate_basis_points: taxRateBasisPoints,
        currency,
        notes: String(noteInput?.value ?? fallback.notes ?? "").trim(),
        sort_order: index
      };
    });
  }

  function readOfferDraftAdditionalItemsForRender() {
    const fallbackItems = Array.isArray(state.offerDraft?.additional_items) ? state.offerDraft.additional_items : [];
    const rows = Array.from(document.querySelectorAll("[data-offer-additional-item-row]"));
    if (!rows.length) return fallbackItems;
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    return rows.map((row, index) => {
      const fallback = fallbackItems[index] || createEmptyAdditionalItem();
      const labelInput = row.querySelector("[data-offer-additional-label]");
      const detailsInput = row.querySelector("[data-offer-additional-details]");
      const dayNumberInput = row.querySelector("[data-offer-additional-day-number]");
      const quantityInput = row.querySelector("[data-offer-additional-quantity]");
      const unitInput = row.querySelector("[data-offer-additional-unit]");
      const taxInput = row.querySelector("[data-offer-additional-tax-rate]");
      const parsedAmount = parseMoneyInputValue(unitInput?.value ?? "", currency);
      const parsedDayNumber = Number.parseInt(String(dayNumberInput?.value || "").trim(), 10);
      return {
        ...fallback,
        label: String(labelInput?.value ?? fallback.label ?? "").trim(),
        details: String(detailsInput?.value ?? fallback.details ?? "").trim(),
        day_number: Number.isInteger(parsedDayNumber) && parsedDayNumber >= 1 ? parsedDayNumber : null,
        quantity: Math.max(1, Math.round(Number(quantityInput?.value || fallback.quantity || 1))),
        unit_amount_cents: Number.isFinite(parsedAmount)
          ? deriveUnitNetAmountFromGross(
              Math.round(parsedAmount / Math.max(1, Math.round(Number(quantityInput?.value || fallback.quantity || 1)))),
              readOfferTaxRateBasisPointsInput(taxInput, fallback.tax_rate_basis_points)
            )
          : Math.max(0, Number(fallback.unit_amount_cents || 0)),
        tax_rate_basis_points: readOfferTaxRateBasisPointsInput(taxInput, fallback.tax_rate_basis_points),
        currency,
        sort_order: index
      };
    });
  }

  function addOfferPricingRow() {
    if (!state.permissions.canEditBooking || !state.offerDraft) return;
    if (currentOfferInternalDetailLevel() === "day") {
      addOfferDayInternal();
      return;
    }
    addOfferAdditionalItem();
  }

  function addOfferDayInternal() {
    if (!state.permissions.canEditBooking || !state.offerDraft) return;
    const nextDayNumber = Math.max(
      1,
      ...(Array.isArray(state.offerDraft?.days_internal) ? state.offerDraft.days_internal : [])
        .map((dayPrice) => Number(dayPrice?.day_number || 0))
        .filter((value) => Number.isInteger(value) && value >= 1)
    ) + 1;
    state.offerDraft.days_internal = [
      ...(Array.isArray(state.offerDraft?.days_internal) ? state.offerDraft.days_internal : []),
      createEmptyDayPriceInternal(nextDayNumber)
    ];
    setOfferSaveEnabled(true);
    renderOfferPricingTable();
  }

  function addOfferAdditionalItem() {
    if (!state.permissions.canEditBooking || !state.offerDraft) return;
    state.offerDraft.additional_items = [
      ...(Array.isArray(state.offerDraft?.additional_items) ? state.offerDraft.additional_items : []),
      createEmptyAdditionalItem()
    ];
    setOfferSaveEnabled(true);
    renderOfferPricingTable();
  }

  function addOfferDiscount() {
    if (!state.permissions.canEditBooking || !state.offerDraft) return;
    state.offerDraft.discounts = [
      ...(Array.isArray(state.offerDraft?.discounts) ? state.offerDraft.discounts : []),
      createEmptyDiscount()
    ];
    setOfferSaveEnabled(true);
    renderOfferPricingTable();
  }

  function renderOfferDayMainTable() {
    const readOnly = !state.permissions.canEditBooking;
    const showActionsCol = !readOnly;
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const dayPrices = Array.isArray(state.offerDraft?.days_internal) ? state.offerDraft.days_internal : [];
    const additionalItems = (Array.isArray(state.offerDraft?.additional_items) ? state.offerDraft.additional_items : [])
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !readOnly || hasMeaningfulAdditionalItem(item));
    const discounts = (Array.isArray(state.offerDraft?.discounts) ? state.offerDraft.discounts : [])
      .map((discount, index) => ({ discount, index }))
      .filter(({ discount }) => !readOnly || (discount && (String(discount.reason || "").trim() || Number(discount.amount_cents || 0) > 0)));
    const header = `<thead><tr><th class="offer-col-day offer-col-day--day-mode">${escapeHtml(bookingT("booking.offer.day", "Day"))}</th><th class="offer-col-name">${escapeHtml(bookingT("booking.offer.name", "Name"))}</th><th class="offer-col-details">${escapeHtml(bookingT("booking.offer.note", "Note"))}</th><th class="offer-col-price-total">${escapeHtml(bookingT("booking.offer.price_including_tax", "Price (incl. tax)"))}</th>${showActionsCol ? '<th class="offer-col-actions"></th>' : ""}</tr></thead>`;
    const dayRows = dayPrices.map((dayPrice, index) => {
      const totals = computeOfferDayInternalLineTotals(dayPrice);
      const grossAmountCents = totals.line_gross_amount_cents;
      const dayNumber = dayPrice?.day_number || index + 1;
      const dayName = offerDayName(dayNumber);
      return `<tr data-offer-day-price-row="${index}">
        <td class="offer-col-day offer-col-day--day-mode">
          <input data-offer-day-number type="hidden" value="${escapeHtml(String(dayNumber))}" />
          <span>${escapeHtml(bookingT("booking.offer.day_number.day", "Day {day}", { day: dayNumber }))}</span>
        </td>
        <td class="offer-col-name"><span>${escapeHtml(dayName || bookingT("booking.no_details", "No details"))}</span></td>
        <td class="offer-col-details">
          ${readOnly
            ? escapeHtml(String(dayPrice?.notes || ""))
            : `<input data-offer-day-note type="text" value="${escapeHtml(String(dayPrice?.notes || ""))}" placeholder="${escapeHtml(bookingT("booking.offer.day_note_placeholder", "Note for the offer for this day"))}" />`}
          <input data-offer-day-tax-rate type="hidden" value="${escapeHtml(formatTaxRateInputValue(dayPrice?.tax_rate_basis_points))}" />
        </td>
        <td class="offer-col-price-total">
          <div class="offer-total-cell">
            ${readOnly
              ? `<span class="offer-price-value" data-offer-main-total="${index}">${escapeHtml(formatMoneyDisplay(grossAmountCents, currency))}</span>`
              : `<input data-offer-day-price-incl-tax data-offer-main-total-input="${index}" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(grossAmountCents, currency))}" />`}
          </div>
        </td>
        ${showActionsCol ? `<td class="offer-col-actions"></td>` : ""}
      </tr>`;
    }).join("");
    const adjustmentRows = [
      ...additionalItems.map(({ item, index }) => {
        const totals = computeOfferAdditionalItemLineTotals(item);
        const noteValue = String(item?.details || item?.label || "").trim();
        return `<tr data-offer-additional-item-row="${index}">
          <td class="offer-col-day offer-col-day--day-mode">${escapeHtml(bookingT("booking.offer.pricing_adjustment_surcharge", "Surcharge"))}</td>
          <td class="offer-col-name"></td>
          <td class="offer-col-details">${readOnly
            ? escapeHtml(noteValue)
            : `<input data-offer-additional-details type="text" value="${escapeHtml(noteValue)}" placeholder="${escapeHtml(bookingT("booking.offer.adjustment_note_placeholder", "Adjustment note"))}" />
               <input data-offer-additional-label type="hidden" value="${escapeHtml(String(item?.label || "").trim())}" />
               <input data-offer-additional-day-number type="hidden" value="${escapeHtml(String(item?.day_number || ""))}" />
               <input data-offer-additional-quantity type="hidden" value="${escapeHtml(String(Math.max(1, Number(item?.quantity || 1))))}" />
               <input data-offer-additional-tax-rate type="hidden" value="${escapeHtml(formatTaxRateInputValue(item?.tax_rate_basis_points))}" />`}</td>
          <td class="offer-col-price-total"><div class="offer-total-cell">${readOnly
            ? `<span class="offer-price-value" data-offer-additional-total="${index}">${escapeHtml(formatMoneyDisplay(totals.line_gross_amount_cents, currency))}</span>`
            : `<input data-offer-additional-unit type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(totals.line_gross_amount_cents, currency))}" />`}</div></td>
          ${showActionsCol ? `<td class="offer-col-actions"><button class="btn btn-ghost offer-remove-btn" type="button" data-offer-remove-additional="${index}">×</button></td>` : ""}
        </tr>`;
      }),
      ...discounts.map(({ discount, index }) => {
        const totals = computeOfferDiscountLineTotals(discount);
        return `<tr data-offer-discount-row="${index}">
          <td class="offer-col-day offer-col-day--day-mode">${escapeHtml(bookingT("booking.offer.pricing_adjustment_discount", "Discount"))}</td>
          <td class="offer-col-name"></td>
          <td class="offer-col-details">${readOnly
            ? escapeHtml(String(discount.reason || ""))
            : `<input data-offer-discount-reason type="text" value="${escapeHtml(String(discount.reason || ""))}" placeholder="${escapeHtml(bookingT("booking.offer.discount_reason_placeholder", "Reason for discount"))}" />`}</td>
          <td class="offer-col-price-total"><div class="offer-total-cell">${readOnly
            ? `<span class="offer-price-value" data-offer-discount-total="${index}">${escapeHtml(formatMoneyDisplay(totals.line_gross_amount_cents, currency))}</span>`
            : `<input data-offer-discount-amount type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(discount.amount_cents || 0, currency))}" />`}</div></td>
          ${showActionsCol ? `<td class="offer-col-actions"><button class="btn btn-ghost offer-remove-btn" type="button" data-offer-remove-discount="${index}" title="${escapeHtml(bookingT("booking.offer.remove_discount", "Remove discount"))}" aria-label="${escapeHtml(bookingT("booking.offer.remove_discount", "Remove discount"))}">×</button></td>` : ""}
        </tr>`;
      })
    ].join("");
    const offerTotalValue = formatMoneyDisplay(resolveOfferTotalCents(), currency);
    updateOfferPanelSummary(resolveOfferTotalCents(), currency);
    const addRow = readOnly
      ? ""
      : `<tr class="offer-total-row"><td colspan="4" class="offer-add-cell"><div class="offer-add-actions"><button class="btn btn-ghost booking-offer-add-btn" type="button" data-offer-add-additional>${escapeHtml(bookingT("booking.offer.add_surcharge", "Add surcharge"))}</button><button class="btn btn-ghost booking-offer-add-btn" type="button" data-offer-add-discount>${escapeHtml(bookingT("booking.offer.add_discount", "Add discount"))}</button></div></td>${showActionsCol ? '<td class="offer-col-actions"></td>' : ""}</tr>`;
    const totalRow = `<tr class="offer-total-row"><td colspan="3" class="offer-total-merged"><div class="offer-total-sum"><strong class="offer-total-label">${escapeHtml(bookingT("booking.offer.total_including_tax", "Total (including tax)"))}:</strong></div></td><td class="offer-col-price-total offer-total-final"><div class="offer-total-cell"><strong class="offer-price-value offer-total-value">${escapeHtml(offerTotalValue)}</strong></div></td>${showActionsCol ? '<td class="offer-col-actions"></td>' : ""}</tr>`;
    return `${header}<tbody>${dayRows}${adjustmentRows}${totalRow}${addRow}</tbody>`;
  }

  function renderOfferTripMainTable() {
    const readOnly = !state.permissions.canEditBooking;
    const showActionsCol = !readOnly;
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const tripPrice = state.offerDraft?.trip_price_internal || createEmptyTripPriceInternal();
    const totals = computeOfferTripPriceLineTotals(tripPrice);
    const additionalItems = (Array.isArray(state.offerDraft?.additional_items) ? state.offerDraft.additional_items : [])
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !readOnly || hasMeaningfulAdditionalItem(item));
    const discounts = (Array.isArray(state.offerDraft?.discounts) ? state.offerDraft.discounts : [])
      .map((discount, index) => ({ discount, index }))
      .filter(({ discount }) => !readOnly || (discount && (String(discount.reason || "").trim() || Number(discount.amount_cents || 0) > 0)));
    const header = `<thead><tr><th class="offer-col-name offer-col-name--trip-mode">${escapeHtml(bookingT("booking.offer.name", "Name"))}</th><th class="offer-col-details offer-col-details--trip-mode">${escapeHtml(bookingT("booking.offer.note", "Note"))}</th><th class="offer-col-price-total">${escapeHtml(bookingT("booking.offer.price_including_tax", "Price (incl. tax)"))}</th>${showActionsCol ? '<th class="offer-col-actions"></th>' : ""}</tr></thead>`;
    const tripRow = `<tr data-offer-trip-price-row="0">
      <td class="offer-col-name offer-col-name--trip-mode"><span>${escapeHtml(String(tripPrice?.label || bookingT("booking.offer.trip_total", "Trip total") || ""))}</span></td>
      <td class="offer-col-details offer-col-details--trip-mode">
        ${readOnly
          ? escapeHtml(String(tripPrice?.notes || ""))
          : `<input data-offer-trip-note type="text" value="${escapeHtml(String(tripPrice?.notes || ""))}" placeholder="${escapeHtml(bookingT("booking.offer.day_note_placeholder", "Note for the offer for this day"))}" />`}
        <input data-offer-trip-tax-rate type="hidden" value="${escapeHtml(formatTaxRateInputValue(tripPrice?.tax_rate_basis_points))}" />
      </td>
      <td class="offer-col-price-total">
        <div class="offer-total-cell">
          ${readOnly
            ? `<span class="offer-price-value" data-offer-main-total="0">${escapeHtml(formatMoneyDisplay(totals.line_gross_amount_cents, currency))}</span>`
            : `<input data-offer-trip-amount data-offer-main-total-input="0" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(totals.line_gross_amount_cents, currency))}" />`}
        </div>
      </td>
      ${showActionsCol ? `<td class="offer-col-actions"></td>` : ""}
    </tr>`;
    const adjustmentRows = [
      ...additionalItems.map(({ item, index }) => {
        const itemTotals = computeOfferAdditionalItemLineTotals(item);
        const noteValue = String(item?.details || item?.label || "").trim();
        return `<tr data-offer-additional-item-row="${index}">
          <td class="offer-col-name offer-col-name--trip-mode">${escapeHtml(bookingT("booking.offer.pricing_adjustment_surcharge", "Surcharge"))}</td>
          <td class="offer-col-details offer-col-details--trip-mode">${readOnly
            ? escapeHtml(noteValue)
            : `<input data-offer-additional-details type="text" value="${escapeHtml(noteValue)}" placeholder="${escapeHtml(bookingT("booking.offer.adjustment_note_placeholder", "Adjustment note"))}" />
               <input data-offer-additional-label type="hidden" value="${escapeHtml(String(item?.label || "").trim())}" />
               <input data-offer-additional-day-number type="hidden" value="${escapeHtml(String(item?.day_number || ""))}" />
               <input data-offer-additional-quantity type="hidden" value="${escapeHtml(String(Math.max(1, Number(item?.quantity || 1))))}" />
               <input data-offer-additional-tax-rate type="hidden" value="${escapeHtml(formatTaxRateInputValue(item?.tax_rate_basis_points))}" />`}</td>
          <td class="offer-col-price-total"><div class="offer-total-cell">${readOnly
            ? `<span class="offer-price-value" data-offer-additional-total="${index}">${escapeHtml(formatMoneyDisplay(itemTotals.line_gross_amount_cents, currency))}</span>`
            : `<input data-offer-additional-unit type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(itemTotals.line_gross_amount_cents, currency))}" />`}</div></td>
          ${showActionsCol ? `<td class="offer-col-actions"><button class="btn btn-ghost offer-remove-btn" type="button" data-offer-remove-additional="${index}">×</button></td>` : ""}
        </tr>`;
      }),
      ...discounts.map(({ discount, index }) => {
        const discountTotals = computeOfferDiscountLineTotals(discount);
        return `<tr data-offer-discount-row="${index}">
          <td class="offer-col-name offer-col-name--trip-mode">${escapeHtml(bookingT("booking.offer.pricing_adjustment_discount", "Discount"))}</td>
          <td class="offer-col-details offer-col-details--trip-mode">${readOnly
            ? escapeHtml(String(discount.reason || ""))
            : `<input data-offer-discount-reason type="text" value="${escapeHtml(String(discount.reason || ""))}" placeholder="${escapeHtml(bookingT("booking.offer.discount_reason_placeholder", "Reason for discount"))}" />`}</td>
          <td class="offer-col-price-total"><div class="offer-total-cell">${readOnly
            ? `<span class="offer-price-value" data-offer-discount-total="${index}">${escapeHtml(formatMoneyDisplay(discountTotals.line_gross_amount_cents, currency))}</span>`
            : `<input data-offer-discount-amount type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(discount.amount_cents || 0, currency))}" />`}</div></td>
          ${showActionsCol ? `<td class="offer-col-actions"><button class="btn btn-ghost offer-remove-btn" type="button" data-offer-remove-discount="${index}" title="${escapeHtml(bookingT("booking.offer.remove_discount", "Remove discount"))}" aria-label="${escapeHtml(bookingT("booking.offer.remove_discount", "Remove discount"))}">×</button></td>` : ""}
        </tr>`;
      })
    ].join("");
    const offerTotalValue = formatMoneyDisplay(resolveOfferTotalCents(), currency);
    updateOfferPanelSummary(resolveOfferTotalCents(), currency);
    const totalRow = `<tr class="offer-total-row"><td colspan="2" class="offer-total-merged"><div class="offer-total-sum"><strong class="offer-total-label">${escapeHtml(bookingT("booking.offer.total_including_tax", "Total (including tax)"))}:</strong></div></td><td class="offer-col-price-total offer-total-final"><div class="offer-total-cell"><strong class="offer-price-value offer-total-value">${escapeHtml(offerTotalValue)}</strong></div></td>${showActionsCol ? '<td class="offer-col-actions"></td>' : ""}</tr>`;
    const addRow = readOnly
      ? ""
      : `<tr class="offer-total-row"><td colspan="3" class="offer-add-cell"><div class="offer-add-actions"><button class="btn btn-ghost booking-offer-add-btn" type="button" data-offer-add-additional>${escapeHtml(bookingT("booking.offer.add_surcharge", "Add surcharge"))}</button><button class="btn btn-ghost booking-offer-add-btn" type="button" data-offer-add-discount>${escapeHtml(bookingT("booking.offer.add_discount", "Add discount"))}</button></div></td>${showActionsCol ? '<td class="offer-col-actions"></td>' : ""}</tr>`;
    return `${header}<tbody>${tripRow}${adjustmentRows}${totalRow}${addRow}</tbody>`;
  }

  function bindOfferDayEvents() {
    if (!els.offer_pricing_table || !state.permissions.canEditBooking) return;
    const syncOfferDayTotals = () => {
      state.offerDraft.days_internal = readOfferDraftDaysInternalForRender();
      state.offerDraft.total_price_cents = null;
      setOfferSaveEnabled(true);
      updateOfferTotalsInDom();
    };
    els.offer_pricing_table.querySelectorAll("[data-offer-day-number], [data-offer-day-note], [data-offer-day-price-incl-tax], [data-offer-day-tax-rate]").forEach((input) => {
      input.addEventListener("input", syncOfferDayTotals);
      input.addEventListener("change", syncOfferDayTotals);
    });
  }

  function bindOfferTripEvents() {
    if (!els.offer_pricing_table || !state.permissions.canEditBooking) return;
    const syncTripTotals = () => {
      state.offerDraft.trip_price_internal = readOfferDraftTripPriceForRender();
      state.offerDraft.total_price_cents = null;
      setOfferSaveEnabled(true);
      updateOfferTotalsInDom();
    };
    els.offer_pricing_table.querySelectorAll("[data-offer-trip-note], [data-offer-trip-amount], [data-offer-trip-tax-rate]").forEach((input) => {
      input.addEventListener("input", syncTripTotals);
      input.addEventListener("change", syncTripTotals);
    });
  }

  function bindOfferAdjustmentEvents() {
    if (!state.permissions.canEditBooking) return;
    const syncAdjustments = () => {
      state.offerDraft.additional_items = readOfferDraftAdditionalItemsForRender();
      state.offerDraft.discounts = readOfferDraftDiscountsForRender();
      state.offerDraft.total_price_cents = null;
      setOfferSaveEnabled(true);
      updateOfferTotalsInDom();
    };
    document.querySelectorAll("[data-offer-additional-label], [data-offer-additional-details], [data-offer-additional-day-number], [data-offer-additional-quantity], [data-offer-additional-tax-rate], [data-offer-additional-unit], [data-offer-discount-reason], [data-offer-discount-amount]").forEach((input) => {
      input.addEventListener("input", syncAdjustments);
      input.addEventListener("change", syncAdjustments);
    });
    document.querySelectorAll("[data-offer-add-additional]").forEach((button) => {
      button.addEventListener("click", addOfferAdditionalItem);
    });
    document.querySelectorAll("[data-offer-add-discount]").forEach((button) => {
      button.addEventListener("click", addOfferDiscount);
    });
    document.querySelectorAll("[data-offer-remove-additional]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-offer-remove-additional"));
        state.offerDraft.additional_items.splice(index, 1);
        setOfferSaveEnabled(true);
        renderOfferPricingTable();
      });
    });
    document.querySelectorAll("[data-offer-remove-discount]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!window.confirm(bookingT("booking.offer.remove_discount_confirm", "Remove this discount?"))) return;
        const index = Number(button.getAttribute("data-offer-remove-discount"));
        state.offerDraft.discounts.splice(index, 1);
        setOfferSaveEnabled(true);
        renderOfferPricingTable();
      });
    });
  }

  function renderOfferPricingTable() {
    if (!els.offer_pricing_table) return;
    ensureOfferStructureForDetailLevel(currentOfferInternalDetailLevel());
    const internalDetailLevel = currentOfferInternalDetailLevel();
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    els.offer_pricing_table.innerHTML = internalDetailLevel === "day"
      ? renderOfferDayMainTable()
      : renderOfferTripMainTable();
    updateOfferPanelSummary(resolveOfferTotalCents(), currency);
    updateOfferVisiblePricingHintState();
    renderOfferQuotationSummary();
    paymentTermsModule.renderOfferPaymentTerms();

    if (internalDetailLevel === "trip") {
      bindOfferTripEvents();
    } else {
      bindOfferDayEvents();
    }
    bindOfferAdjustmentEvents();
  }

  function updateOfferTotalsInDom() {
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    const internalDetailLevel = currentOfferInternalDetailLevel();
    if (internalDetailLevel === "day") {
      const dayPrices = Array.isArray(state.offerDraft?.days_internal) ? state.offerDraft.days_internal : [];
      dayPrices.forEach((dayPrice, index) => {
        const totalNode = document.querySelector(`[data-offer-main-total="${index}"]`);
        if (!totalNode) return;
        totalNode.textContent = formatMoneyDisplay(Math.round(computeOfferDayInternalLineTotals(dayPrice).line_gross_amount_cents), currency);
      });
    } else {
      const totalNode = document.querySelector('[data-offer-main-total="0"]');
      if (totalNode) {
        totalNode.textContent = formatMoneyDisplay(Math.round(computeOfferTripPriceLineTotals(state.offerDraft?.trip_price_internal).line_gross_amount_cents), currency);
      }
    }
    const additionalItems = Array.isArray(state.offerDraft?.additional_items) ? state.offerDraft.additional_items : [];
    additionalItems.forEach((item, index) => {
      const totalNode = document.querySelector(`[data-offer-additional-total="${index}"]`);
      if (!totalNode) return;
      totalNode.textContent = formatMoneyDisplay(Math.round(computeOfferAdditionalItemLineTotals(item).line_gross_amount_cents), currency);
    });
    const discounts = Array.isArray(state.offerDraft?.discounts) ? state.offerDraft.discounts : [];
    discounts.forEach((discount, index) => {
      const totalNode = document.querySelector(`[data-offer-discount-total="${index}"]`);
      if (!totalNode) return;
      const total = computeOfferDiscountLineTotals(discount).line_gross_amount_cents;
      totalNode.textContent = formatMoneyDisplay(Math.round(total), currency);
    });
    const totalValueNode = document.querySelector(".offer-total-value");
    if (totalValueNode) {
      totalValueNode.textContent = formatMoneyDisplay(resolveOfferTotalCents(), currency);
    }
    updateOfferPanelSummary(resolveOfferTotalCents(), currency);
    if (state.offerDraft?.payment_terms) {
      state.offerDraft.payment_terms = paymentTermsModule.normalizeOfferPaymentTermsDraft(state.offerDraft.payment_terms, currency);
      paymentTermsModule.updateOfferPaymentTermsInDom();
    }
    updateOfferVisiblePricingHintState();
    renderOfferQuotationSummary();
  }

  function collectOfferCategoryRules() {
    const defaults = defaultOfferCategoryRules();
    const byCategory = new Map(
      (Array.isArray(state.offerDraft?.category_rules) ? state.offerDraft.category_rules : []).map((rule) => [
        normalizeOfferCategory(rule?.category),
        rule
      ])
    );
    return offerCategories.map((category) => {
      const override = byCategory.get(category.code);
      const raw = override?.tax_rate_basis_points;
      const taxRateBasisPoints = normalizeOfferTaxRateBasisPoints(
        raw,
        defaults.find((entry) => entry.category === category.code)?.tax_rate_basis_points ?? defaultOfferTaxRateBasisPoints
      );
      return {
        category: category.code,
        tax_rate_basis_points: taxRateBasisPoints
      };
    });
  }

  function collectOfferDiscounts({ throwOnError = true } = {}) {
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    return readOfferDraftDiscountsForRender().map((discount, index) => {
      const reason = String(discount.reason || "").trim();
      const rawAmountCents = Number(discount.amount_cents || 0);
      const amountCents = Math.round(rawAmountCents);
      if (!Number.isFinite(amountCents) || amountCents < 0) {
        if (throwOnError) throw new Error(bookingT("booking.offer.error.discount_amount", "Offer discount requires a valid amount."));
        return null;
      }
      if (amountCents <= 0) return null;
      if (!reason) {
        if (throwOnError) throw new Error(bookingT("booking.offer.error.discount_reason", "Offer discount requires a reason."));
        return null;
      }
      return {
        id: String(discount.id || `offer_discount_${index + 1}`),
        reason,
        amount_cents: amountCents,
        currency,
        sort_order: Number.isFinite(Number(discount.sort_order)) ? Number(discount.sort_order) : index
      };
    }).filter(Boolean);
  }

  function collectOfferTripPriceInternal({ throwOnError = true } = {}) {
    const tripPrice = readOfferDraftTripPriceForRender();
    if (!tripPrice) return null;
    const amountCents = Math.max(0, Math.round(Number(tripPrice.amount_cents || 0)));
    if (!Number.isFinite(amountCents) || amountCents < 0) {
      if (throwOnError) throw new Error(bookingT("booking.offer.error.trip_amount", "Trip pricing requires a valid non-negative amount."));
      return null;
    }
    return {
      label: String(tripPrice.label || "").trim() || null,
      amount_cents: amountCents,
      tax_rate_basis_points: normalizeOfferTaxRateBasisPoints(tripPrice.tax_rate_basis_points, defaultOfferTaxRateBasisPoints),
      currency: normalizeCurrencyCode(tripPrice.currency || state.offerDraft?.currency || state.booking?.preferred_currency || "USD"),
      ...(String(tripPrice.notes || "").trim() ? { notes: String(tripPrice.notes).trim() } : {})
    };
  }

  function collectOfferDaysInternal({ throwOnError = true } = {}) {
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const days = readOfferDraftDaysInternalForRender();
    return days.map((dayPrice, index) => {
      const dayNumber = Number.parseInt(String(dayPrice?.day_number || "").trim(), 10);
      const amountCents = Math.max(0, Math.round(Number(dayPrice?.amount_cents || 0)));
      if (!Number.isInteger(dayNumber) || dayNumber < 1) {
        if (throwOnError) throw new Error(bookingT("booking.offer.error.day_number", "Internal day pricing row {index} requires a valid day number.", { index: index + 1 }));
        return null;
      }
      if (!Number.isFinite(amountCents) || amountCents < 0) {
        if (throwOnError) throw new Error(bookingT("booking.offer.error.day_amount", "Internal day pricing row {index} requires a valid non-negative amount.", { index: index + 1 }));
        return null;
      }
      return {
        id: String(dayPrice?.id || "").trim(),
        day_number: dayNumber,
        ...(String(dayPrice?.label || "").trim() ? { label: String(dayPrice.label).trim() } : {}),
        amount_cents: amountCents,
        tax_rate_basis_points: normalizeOfferTaxRateBasisPoints(dayPrice?.tax_rate_basis_points, defaultOfferTaxRateBasisPoints),
        currency,
        sort_order: index,
        ...(String(dayPrice?.notes || "").trim() ? { notes: String(dayPrice.notes).trim() } : {})
      };
    }).filter(Boolean);
  }

  function collectOfferAdditionalItems({ throwOnError = true } = {}) {
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const items = readOfferDraftAdditionalItemsForRender();
    return items.map((item, index) => {
      const quantity = Math.max(1, Math.round(Number(item?.quantity || 1)));
      const rawUnitAmountCents = Number(item?.unit_amount_cents || 0);
      const unitAmountCents = Math.round(rawUnitAmountCents);
      if (!Number.isFinite(quantity) || quantity < 1) {
        if (throwOnError) throw new Error(bookingT("booking.offer.error.additional_item_quantity", "Additional item {index} quantity must be at least 1.", { index: index + 1 }));
        return null;
      }
      if (!Number.isFinite(unitAmountCents) || unitAmountCents < 0) {
        if (throwOnError) throw new Error(bookingT("booking.offer.error.additional_item_amount", "Additional item {index} requires a valid non-negative unit amount.", { index: index + 1 }));
        return null;
      }
      if (unitAmountCents <= 0) return null;
      const parsedDayNumber = Number.parseInt(String(item?.day_number || "").trim(), 10);
      return {
        id: String(item?.id || "").trim(),
        label: String(item?.label || "").trim() || bookingT("booking.offer.additional_item", "Additional item"),
        ...(String(item?.details || "").trim() ? { details: String(item.details).trim() } : {}),
        ...(Number.isInteger(parsedDayNumber) && parsedDayNumber >= 1 ? { day_number: parsedDayNumber } : {}),
        quantity,
        unit_amount_cents: unitAmountCents,
        tax_rate_basis_points: normalizeOfferTaxRateBasisPoints(item?.tax_rate_basis_points, defaultOfferTaxRateBasisPoints),
        currency,
        category: normalizeOfferCategory(item?.category || "OTHER"),
        ...(String(item?.notes || "").trim() ? { notes: String(item.notes).trim() } : {}),
        sort_order: index
      };
    }).filter(Boolean);
  }

  function collectOfferPayload() {
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const internalDetailLevel = currentOfferInternalDetailLevel();
    const visibleDetailLevel = currentOfferVisibleDetailLevel();
    const category_rules = collectOfferCategoryRules();
    const daysInternal = internalDetailLevel === "day" ? collectOfferDaysInternal() : [];
    const tripPriceInternal = internalDetailLevel === "trip" ? collectOfferTripPriceInternal() : null;
    const additionalItems = collectOfferAdditionalItems();
    const discounts = collectOfferDiscounts();
    const paymentTermsDraft = paymentTermsModule.normalizeOfferPaymentTermsDraft(
      cloneOfferPaymentTerms(state.offerDraft?.payment_terms, currency),
      currency
    );
    const paymentTermsNotes = String(paymentTermsDraft?.notes || "").trim();
    if (paymentTermsDraft) {
      const percentageErrors = paymentTermsDraft.lines
        .map((line, index) => ({ line, index }))
        .find(({ line }) => paymentTermsModule.normalizeOfferPaymentAmountModeValue(line?.amount_spec?.mode) === "PERCENTAGE_OF_OFFER_TOTAL"
          && Math.round(Number(line?.amount_spec?.percentage_basis_points || 0)) <= 0);
      if (percentageErrors) {
        throw new Error(bookingT("booking.offer.payment_terms.error.percentage_required", "Payment term {index} percentage must be greater than 0.", {
          index: String(percentageErrors.index + 1)
        }));
      }
      const fixedDateErrors = paymentTermsDraft.lines
        .map((line, index) => ({ line, index }))
        .find(({ line }) => paymentTermsModule.normalizeOfferPaymentDueTypeValue(line?.due_rule?.type) === "FIXED_DATE"
          && !String(line?.due_rule?.fixed_date || "").trim());
      if (fixedDateErrors) {
        throw new Error(bookingT("booking.offer.payment_terms.error.fixed_date_required", "Payment term {index} requires a due date.", {
          index: String(fixedDateErrors.index + 1)
        }));
      }
    }
    return {
      status: String(state.offerDraft?.status || "DRAFT").trim().toUpperCase(),
      currency,
      offer_detail_level_internal: internalDetailLevel,
      offer_detail_level_visible: visibleDetailLevel,
      category_rules,
      ...(internalDetailLevel === "day" ? { days_internal: daysInternal } : {}),
      ...(internalDetailLevel === "trip" && tripPriceInternal ? { trip_price_internal: tripPriceInternal } : {}),
      additional_items: additionalItems,
      ...(discounts.length ? { discounts } : {}),
      ...(paymentTermsDraft && (paymentTermsDraft.lines.length || paymentTermsNotes)
        ? {
	            payment_terms: {
	              currency: paymentTermsDraft.currency,
	              lines: paymentTermsDraft.lines.map((line, index) => ({
	                id: line.id || "",
                kind: paymentTermsModule.normalizeOfferPaymentTermKindValue(line.kind),
                label: String(line.label || "").trim() || paymentTermsModule.formatPaymentTermKindLabel(line.kind, "", {
                  installmentNumber: paymentTermsModule.resolveOfferPaymentTermInstallmentNumber(paymentTermsDraft.lines, index)
                }),
                sequence: index + 1,
	                amount_spec: {
	                  ...paymentTermsModule.normalizeOfferPaymentAmountSpecDraftValue(
	                    line?.amount_spec,
	                    line?.kind,
	                    line?.resolved_amount_cents
	                  )
	                },
	                due_rule: {
	                  type: paymentTermsModule.normalizeOfferPaymentDueTypeValue(line?.due_rule?.type),
	                  ...(paymentTermsModule.offerPaymentDueTypeUsesFixedDate(line?.due_rule?.type) && String(line?.due_rule?.fixed_date || "").trim()
                    ? { fixed_date: String(line.due_rule.fixed_date).trim() }
                    : {}),
                  ...(paymentTermsModule.offerPaymentDueTypeUsesDays(line?.due_rule?.type)
                    ? { days: Math.max(0, Math.round(Number(line?.due_rule?.days || 0))) }
                    : {})
                },
                ...(String(line?.description || "").trim() ? { description: String(line.description).trim() } : {})
              })),
              ...(paymentTermsNotes ? { notes: paymentTermsNotes } : {})
            }
          }
        : {})
    };
  }

  async function convertOfferPricingLinesInBackend(currentCurrency, nextCurrency, lines) {
    const normalizedLines = Array.isArray(lines) ? lines : [];
    if (!normalizedLines.length) return [];
    const request = offerExchangeRatesRequest({ baseURL: apiOrigin });
    const response = await fetchApi(request.url, {
      method: request.method,
      body: {
        from_currency: currentCurrency,
        to_currency: nextCurrency,
        components: normalizedLines.map((line, index) => ({
          id: line.id || `pricing_line_${index}`,
          unit_amount_cents: Number(line.unit_amount_cents || 0),
          category: line.category || "OTHER",
          quantity: Number(line.quantity || 1),
          tax_rate_basis_points: normalizeOfferTaxRateBasisPoints(line.tax_rate_basis_points, 0)
        }))
      }
    });
    const convertedComponentsRaw = Array.isArray(response?.converted_components) ? response.converted_components : null;
    if (!response || !Array.isArray(convertedComponentsRaw)) {
      throw new Error(response?.detail || response?.error || bookingT("booking.offer.error.exchange_failed", "Offer exchange failed."));
    }
    return convertedComponentsRaw.map((component, index) => ({
      id: component.id || `pricing_line_${index}`,
      unit_amount_cents: Math.max(0, Number(component.unit_amount_cents) || 0)
    }));
  }

  async function convertOfferDiscountInBackend(currentCurrency, nextCurrency, discount) {
    if (!discount || Number(discount?.amount_cents || 0) <= 0) return null;
    const request = offerExchangeRatesRequest({ baseURL: apiOrigin });
    const response = await fetchApi(request.url, {
      method: request.method,
      body: {
        from_currency: currentCurrency,
        to_currency: nextCurrency,
        components: [
          {
            id: "offer_discount_conversion",
            unit_amount_cents: Number(discount.amount_cents || 0),
            category: "OTHER",
            quantity: 1,
            tax_rate_basis_points: 0
          }
        ]
      }
    });
    const converted = Array.isArray(response?.converted_components) ? response.converted_components[0] : null;
    if (!converted) {
      throw new Error(response?.detail || response?.error || bookingT("booking.offer.error.exchange_failed", "Offer exchange failed."));
    }
    return {
      reason: String(discount.reason || "").trim(),
      amount_cents: Math.max(0, Number(converted.unit_amount_cents) || 0),
      currency: nextCurrency
    };
  }

  function updateOfferCurrencyHint(selectedCurrency) {
    if (!els.offer_currency_hint) return;
    const preferredCurrency = normalizeCurrencyCode(state.booking?.web_form_submission?.preferred_currency || "");
    const currentCurrency = normalizeCurrencyCode(selectedCurrency || state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    if (!preferredCurrency || preferredCurrency === currentCurrency) {
      els.offer_currency_hint.textContent = "";
      els.offer_currency_hint.hidden = true;
      return;
    }
    els.offer_currency_hint.textContent = bookingT("booking.offer.preferred_currency_hint", "({currency} was preferred in web submission)", { currency: preferredCurrency });
    els.offer_currency_hint.hidden = false;
  }

  async function handleOfferCurrencyChange() {
    if (!state.booking || !state.offerDraft || !els.offer_currency_input) return;
    const nextCurrency = normalizeCurrencyCode(els.offer_currency_input.value);
    const currentCurrency = normalizeCurrencyCode(state.offerDraft.currency || state.booking.preferred_currency || "USD");
    const currentOfferTotalCents = Math.max(0, Math.round(resolveOfferTotalCents()));
    const internalDetailLevel = currentOfferInternalDetailLevel();
    if (!nextCurrency || nextCurrency === currentCurrency) {
      els.offer_currency_input.value = currentCurrency;
      document.dispatchEvent(new CustomEvent("booking:offer-currency-sync"));
      return;
    }
    let daysInternal = [];
    let tripPriceInternal = null;
    let additionalItems = [];
    let discounts = [];
    try {
      if (internalDetailLevel === "day") {
        daysInternal = collectOfferDaysInternal({ throwOnError: true });
      } else {
        tripPriceInternal = collectOfferTripPriceInternal({ throwOnError: true });
      }
      additionalItems = collectOfferAdditionalItems({ throwOnError: true });
      discounts = collectOfferDiscounts({ throwOnError: true });
    } catch (error) {
      setOfferStatus(String(error?.message || error));
      els.offer_currency_input.value = currentCurrency;
      document.dispatchEvent(new CustomEvent("booking:offer-currency-sync"));
      return;
    }
    const restoreSelectState = () => {
      if (els.offer_currency_input) {
        els.offer_currency_input.disabled = false;
        document.dispatchEvent(new CustomEvent("booking:offer-currency-sync"));
      }
    };
    if (els.offer_currency_input) {
      els.offer_currency_input.disabled = true;
      document.dispatchEvent(new CustomEvent("booking:offer-currency-sync"));
    }
    setOfferStatus(bookingT("booking.offer.converting_prices", "Converting prices..."));
    try {
      const [convertedDays, convertedTrip, convertedAdditionalItems, convertedDiscounts] = await Promise.all([
        internalDetailLevel === "day"
          ? convertOfferPricingLinesInBackend(currentCurrency, nextCurrency, daysInternal.map((dayPrice, index) => ({
              id: dayPrice.id || `offer_day_internal_${index}`,
              unit_amount_cents: Number(dayPrice.amount_cents || 0),
              quantity: 1,
              tax_rate_basis_points: normalizeOfferTaxRateBasisPoints(dayPrice.tax_rate_basis_points, 0)
            })))
          : Promise.resolve([]),
        internalDetailLevel === "trip" && tripPriceInternal
          ? convertOfferPricingLinesInBackend(currentCurrency, nextCurrency, [{
              id: "offer_trip_internal",
              unit_amount_cents: Number(tripPriceInternal.amount_cents || 0),
              quantity: 1,
              tax_rate_basis_points: normalizeOfferTaxRateBasisPoints(tripPriceInternal.tax_rate_basis_points, 0)
            }])
          : Promise.resolve([]),
        convertOfferPricingLinesInBackend(currentCurrency, nextCurrency, additionalItems.map((item, index) => ({
          id: item.id || `offer_additional_item_${index}`,
          unit_amount_cents: Number(item.unit_amount_cents || 0),
          quantity: Number(item.quantity || 1),
          tax_rate_basis_points: normalizeOfferTaxRateBasisPoints(item.tax_rate_basis_points, 0),
          category: item.category || "OTHER"
        }))),
        Promise.all(discounts.map((discount) => convertOfferDiscountInBackend(currentCurrency, nextCurrency, discount)))
      ]);
      state.offerDraft.currency = nextCurrency;
      if (internalDetailLevel === "day") {
        state.offerDraft.days_internal = daysInternal.map((dayPrice, index) => ({
          ...dayPrice,
          amount_cents: Number.isFinite(convertedDays[index]?.unit_amount_cents)
            ? convertedDays[index].unit_amount_cents
            : dayPrice.amount_cents,
          currency: nextCurrency
        }));
      } else if (tripPriceInternal) {
        state.offerDraft.trip_price_internal = {
          ...tripPriceInternal,
          amount_cents: Number.isFinite(convertedTrip[0]?.unit_amount_cents)
            ? convertedTrip[0].unit_amount_cents
            : tripPriceInternal.amount_cents,
          currency: nextCurrency
        };
      }
      state.offerDraft.additional_items = additionalItems.map((item, index) => ({
        ...item,
        unit_amount_cents: Number.isFinite(convertedAdditionalItems[index]?.unit_amount_cents)
          ? convertedAdditionalItems[index].unit_amount_cents
          : item.unit_amount_cents,
        currency: nextCurrency
      }));
      state.offerDraft.discounts = discounts.map((discount, index) => ({
        ...discount,
        ...(convertedDiscounts[index] || {}),
        currency: nextCurrency
      }));
      state.offerDraft.total_price_cents = null;
      if (state.offerDraft.payment_terms) {
        const nextOfferTotalCents = Math.max(0, Math.round(computeOfferDraftTotals(state.offerDraft).gross_amount_cents));
        const conversionRatio = currentOfferTotalCents > 0 && nextOfferTotalCents > 0
          ? nextOfferTotalCents / currentOfferTotalCents
          : 1;
        const nextPaymentTerms = {
          ...state.offerDraft.payment_terms,
          currency: nextCurrency,
          lines: (Array.isArray(state.offerDraft.payment_terms.lines) ? state.offerDraft.payment_terms.lines : []).map((line) => {
            const amountMode = paymentTermsModule.normalizeOfferPaymentAmountModeValue(line?.amount_spec?.mode);
            const amountSpec = {
              mode: amountMode,
              ...(amountMode === "FIXED_AMOUNT"
                ? {
                    fixed_amount_cents: Math.max(0, Math.round(Number(line?.amount_spec?.fixed_amount_cents || 0) * conversionRatio))
                  }
                : {}),
              ...(amountMode === "PERCENTAGE_OF_OFFER_TOTAL"
                ? { percentage_basis_points: Math.max(0, Math.round(Number(line?.amount_spec?.percentage_basis_points || 0))) }
                : {})
            };
            return {
              ...line,
              amount_spec: amountSpec
            };
          })
        };
        state.offerDraft.payment_terms = paymentTermsModule.normalizeOfferPaymentTermsDraft(nextPaymentTerms, nextCurrency);
      }
      setOfferSaveEnabled(true);
    } catch (error) {
      setOfferStatus(bookingT("booking.offer.error.exchange_lookup", "Exchange rate lookup failed: {message}", { message: error?.message || error }));
      restoreSelectState();
      els.offer_currency_input.value = currentCurrency;
      document.dispatchEvent(new CustomEvent("booking:offer-currency-sync"));
      return;
    }
    restoreSelectState();
    setOfferStatus("");
    updateOfferCurrencyHint(nextCurrency);
    renderOfferPricingTable();
  }

  function handleOfferInternalDetailLevelChange(nextValue) {
    if (!state.offerDraft || !state.permissions.canEditBooking) return;
    syncOfferDraftFromDom();
    resetOfferPricingUiState();
    const previousDetailLevel = currentOfferInternalDetailLevel();
    const internalDetailLevel = normalizeOfferDetailLevel(nextValue, previousDetailLevel);
    applyDestructiveInternalDetailLevelTransition(previousDetailLevel, internalDetailLevel);
    state.offerDraft.offer_detail_level_internal = internalDetailLevel;
    clearInactiveMainOfferStructures(internalDetailLevel);
    state.offerDraft.total_price_cents = null;
    ensureOfferStructureForDetailLevel(internalDetailLevel);
    if (isVisibleDetailLevelFinerThanInternal(currentOfferVisibleDetailLevel(), internalDetailLevel)) {
      state.offerDraft.offer_detail_level_visible = internalDetailLevel;
    }
    setOfferSaveEnabled(true);
    renderOfferPricingTable();
  }

  function handleOfferVisibleDetailLevelChange(nextValue) {
    if (!state.offerDraft || !state.permissions.canEditBooking) return;
    syncOfferDraftFromDom();
    const internalDetailLevel = currentOfferInternalDetailLevel();
    const requestedVisibleDetailLevel = normalizeOfferDetailLevel(nextValue, internalDetailLevel);
    state.offerDraft.offer_detail_level_visible = isVisibleDetailLevelFinerThanInternal(requestedVisibleDetailLevel, internalDetailLevel)
      ? internalDetailLevel
      : requestedVisibleDetailLevel;
    setOfferSaveEnabled(true);
    updateOfferVisiblePricingHintState();
    renderOfferQuotationSummary();
  }

  return {
    addOfferPricingRow,
    clearPendingTotals,
    collectOfferPayload,
    handleOfferCurrencyChange,
    handleOfferInternalDetailLevelChange,
    handleOfferVisibleDetailLevelChange,
    renderOfferPricingTable,
    resetOfferPricingUiState,
    resolveOfferTotalCents,
    updateOfferCurrencyHint,
    updateOfferTotalsInDom
  };
}
