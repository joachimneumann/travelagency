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
import { bookingContentLang, bookingContentLanguageOption, bookingT } from "./i18n.js";
import { renderLocalizedStackedField, requestBookingFieldTranslation, resolveLocalizedEditorBranchText } from "./localized_editor.js";

export function createBookingOfferComponentsModule(ctx) {
  const {
    state,
    els,
    apiOrigin,
    fetchApi,
    fetchBookingMutation,
    escapeHtml,
    paymentTermsModule,
    defaultOfferTaxRateBasisPoints,
    offerCategories,
    offerComponentCategories,
    setOfferSaveEnabled,
    setOfferStatus,
    getCountMissingOfferPdfTranslations,
    normalizeOfferCategory,
    normalizeOfferPricingGranularity,
    isVisibleGranularityFinerThanInternal,
    cloneOfferPaymentTerms,
    updateOfferPanelSummary
  } = ctx;

  let offerPendingRowIndexes = new Set();
  let offerTotalPending = false;
  let offerCategoryEditorIndexes = new Set();
  let offerQuantityEditorIndexes = new Set();
  let offerTaxEditorIndexes = new Set();

  function resetComponentUiState() {
    offerPendingRowIndexes = new Set();
    offerTotalPending = false;
    offerCategoryEditorIndexes = new Set();
    offerQuantityEditorIndexes = new Set();
    offerTaxEditorIndexes = new Set();
  }

  function clearPendingTotals() {
    offerPendingRowIndexes = new Set();
    offerTotalPending = false;
  }

  function currentOfferInternalGranularity() {
    return normalizeOfferPricingGranularity(state.offerDraft?.pricing_granularity_internal, "component");
  }

  function currentOfferVisibleGranularity() {
    const internalGranularity = currentOfferInternalGranularity();
    const visibleGranularity = normalizeOfferPricingGranularity(state.offerDraft?.pricing_granularity_visible, internalGranularity);
    return isVisibleGranularityFinerThanInternal(visibleGranularity, internalGranularity)
      ? internalGranularity
      : visibleGranularity;
  }

  function updateOfferVisiblePricingHintState() {
    if (!els.offer_visible_pricing_hint) return;
    const internalGranularity = currentOfferInternalGranularity();
    const visibleGranularity = currentOfferVisibleGranularity();
    const components = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [];
    const missingDayAssignments = internalGranularity === "component"
      && visibleGranularity === "day"
      && components.some((component) => !Number.isInteger(Number(component?.day_number)) || Number(component?.day_number) < 1);
    if (missingDayAssignments) {
      els.offer_visible_pricing_hint.textContent = bookingT(
        "booking.offer.visible_pricing_day_requires_day_numbers",
        "Customer-visible day pricing needs every internal component assigned to a day."
      );
      els.offer_visible_pricing_hint.classList.remove("booking-inline-status--success");
      els.offer_visible_pricing_hint.classList.add("booking-inline-status--error");
      return;
    }
    els.offer_visible_pricing_hint.textContent = bookingT(
      "booking.offer.visible_pricing_hint",
      "Customer documents will show {granularity} pricing. Additional items stay visible as separate lines.",
      { granularity: visibleGranularity }
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
    if (!booking || lang === "en") return 0;
    const normalizedLang = String(lang || "").trim().toLowerCase();
    const offerSummary = booking?.offer_translation_status;
    const travelPlanSummary = booking?.travel_plan_translation_status;
    if (offerSummary?.lang === normalizedLang || travelPlanSummary?.lang === normalizedLang) {
      return Number(offerSummary?.missing_fields || 0) + Number(travelPlanSummary?.missing_fields || 0);
    }
    let missing = 0;
    const considerField = (value) => {
      if (!localizedFieldHasAnyText(value)) return;
      if (!localizedFieldHasTargetLang(value, lang)) missing += 1;
    };
    const offerComponents = Array.isArray(booking?.offer?.components) ? booking.offer.components : [];
    offerComponents.forEach((component) => {
      considerField(component?.details_i18n);
    });
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
      ? state.offerDraft.category_rules.find((componentRule) => normalizeOfferCategory(componentRule?.category) === normalizedCategory)
      : null;
    const basisPoints = Number(rule?.tax_rate_basis_points ?? defaultOfferTaxRateBasisPoints);
    return Number.isFinite(basisPoints) ? Math.max(0, Math.round(basisPoints)) : defaultOfferTaxRateBasisPoints;
  }

  function computeOfferComponentLineTotals(component) {
    const sign = offerCategorySign(component?.category);
    const quantity = Math.max(1, Number(component?.quantity || 1));
    const unitAmount = Math.max(0, Number(component?.unit_amount_cents || 0));
    const taxBasisPoints = Math.max(0, Number(component?.tax_rate_basis_points || 0));
    const unitTaxAmount = Math.round((unitAmount * taxBasisPoints) / 10000);
    const net_amount_cents = sign * quantity * unitAmount;
    const tax_amount_cents = sign * quantity * unitTaxAmount;
    return {
      net_amount_cents,
      tax_amount_cents,
      gross_amount_cents: net_amount_cents + tax_amount_cents,
      line_gross_amount_cents: net_amount_cents + tax_amount_cents
    };
  }

  function computeOfferComponentUnitGrossAmount(componentOrValues) {
    const unitAmount = Math.max(0, Number(componentOrValues?.unit_amount_cents || 0));
    const taxBasisPoints = Math.max(0, Number(componentOrValues?.tax_rate_basis_points || 0));
    return unitAmount + Math.round((unitAmount * taxBasisPoints) / 10000);
  }

  function computeOfferDiscountLineTotals(discount) {
    const amount = Math.max(0, Number(discount?.amount_cents || 0));
    return {
      line_net_amount_cents: -amount,
      line_tax_amount_cents: 0,
      line_gross_amount_cents: -amount
    };
  }

  function computeOfferTripPriceLineTotals(tripPrice) {
    const amount = Math.max(0, Number(tripPrice?.amount_cents || 0));
    const taxBasisPoints = Math.max(0, Number(tripPrice?.tax_rate_basis_points || 0));
    const taxAmount = Math.round((amount * taxBasisPoints) / 10000);
    return {
      line_net_amount_cents: amount,
      line_tax_amount_cents: taxAmount,
      line_gross_amount_cents: amount + taxAmount
    };
  }

  function computeOfferDayInternalLineTotals(dayPrice) {
    const amount = Math.max(0, Number(dayPrice?.amount_cents || 0));
    const taxBasisPoints = Math.max(0, Number(dayPrice?.tax_rate_basis_points || 0));
    const taxAmount = Math.round((amount * taxBasisPoints) / 10000);
    return {
      line_net_amount_cents: amount,
      line_tax_amount_cents: taxAmount,
      line_gross_amount_cents: amount + taxAmount
    };
  }

  function computeOfferAdditionalItemLineTotals(item) {
    const quantity = Math.max(1, Number(item?.quantity || 1));
    const unitAmount = Math.max(0, Number(item?.unit_amount_cents || 0));
    const taxBasisPoints = Math.max(0, Number(item?.tax_rate_basis_points || 0));
    const unitTaxAmount = Math.round((unitAmount * taxBasisPoints) / 10000);
    return {
      line_net_amount_cents: quantity * unitAmount,
      line_tax_amount_cents: quantity * unitTaxAmount,
      line_gross_amount_cents: quantity * (unitAmount + unitTaxAmount)
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
    const internalGranularity = normalizeOfferPricingGranularity(offerDraft?.pricing_granularity_internal, "component");
    if (internalGranularity === "trip") {
      return offerDraft?.trip_price_internal ? [offerDraft.trip_price_internal] : [];
    }
    if (internalGranularity === "day") {
      return Array.isArray(offerDraft?.days_internal) ? offerDraft.days_internal : [];
    }
    return Array.isArray(offerDraft?.components) ? offerDraft.components : [];
  }

  function buildOfferChargeLines(offerDraft = state.offerDraft) {
    const internalGranularity = normalizeOfferPricingGranularity(offerDraft?.pricing_granularity_internal, "component");
    const mainLines = buildOfferMainChargeLines(offerDraft).map((line) => {
      if (internalGranularity === "trip") return computeOfferTripPriceLineTotals(line);
      if (internalGranularity === "day") return computeOfferDayInternalLineTotals(line);
      return computeOfferComponentLineTotals(line);
    });
    const additionalLines = (Array.isArray(offerDraft?.additional_items) ? offerDraft.additional_items : [])
      .map((item) => computeOfferAdditionalItemLineTotals(item));
    const discount = offerDraft?.discount || null;
    return [
      ...mainLines,
      ...additionalLines,
      ...(discount && Number(discount?.amount_cents || 0) > 0 ? [computeOfferDiscountLineTotals(discount)] : [])
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
    const internalGranularity = normalizeOfferPricingGranularity(offerDraft?.pricing_granularity_internal, "component");
    const mainCount = internalGranularity === "trip"
      ? (offerDraft?.trip_price_internal ? 1 : 0)
      : internalGranularity === "day"
        ? (Array.isArray(offerDraft?.days_internal) ? offerDraft.days_internal.length : 0)
        : (Array.isArray(offerDraft?.components) ? offerDraft.components.length : 0);
    const additionalCount = Array.isArray(offerDraft?.additional_items) ? offerDraft.additional_items.length : 0;
    const hasDiscount = Boolean(offerDraft?.discount && Number(offerDraft.discount?.amount_cents || 0) > 0);
    return {
      currency,
      net_amount_cents,
      tax_amount_cents,
      gross_amount_cents: net_amount_cents + tax_amount_cents,
      components_count: mainCount + additionalCount + (hasDiscount ? 1 : 0)
    };
  }

  function computeOfferDraftQuotationSummary(offerDraft = state.offerDraft) {
    const totals = computeOfferDraftTotals(offerDraft);
    const buckets = new Map();
    buildOfferMainChargeLines(offerDraft).forEach((lineSource) => {
      const internalGranularity = normalizeOfferPricingGranularity(offerDraft?.pricing_granularity_internal, "component");
      const line = internalGranularity === "trip"
        ? computeOfferTripPriceLineTotals(lineSource)
        : internalGranularity === "day"
          ? computeOfferDayInternalLineTotals(lineSource)
          : computeOfferComponentLineTotals(lineSource);
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
    if (offerDraft?.discount && Number(offerDraft?.discount?.amount_cents || 0) > 0) {
      const discount = offerDraft.discount;
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
    }
    return {
      tax_included: true,
      subtotal_net_amount_cents: totals.net_amount_cents,
      total_tax_amount_cents: totals.tax_amount_cents,
      grand_total_amount_cents: totals.gross_amount_cents,
      tax_breakdown: Array.from(buckets.values()).sort((left, right) => left.tax_rate_basis_points - right.tax_rate_basis_points)
    };
  }

  function resolveOfferTotalCents() {
    const explicitTotal = Number(state.offerDraft?.total_price_cents);
    if (Number.isFinite(explicitTotal)) {
      return Math.round(explicitTotal);
    }
    const offerTotals = computeOfferDraftTotals(state.offerDraft);
    return offerTotals?.gross_amount_cents || 0;
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

  function formatPendingMoneyDisplay(currency) {
    const code = normalizeCurrencyCode(currency);
    const definitions = getCurrencyDefinitions();
    const definition = definitions[code] || definitions.USD || { symbol: code };
    const symbol = definition.symbol || code;
    return `${symbol} -.--`;
  }

  function renderOfferLocalizedDetailsField(component, index) {
    return renderLocalizedStackedField({
      escapeHtml,
      idBase: `offer_component_details_${index}`,
      label: bookingT("booking.offer.details", "Offer details"),
      type: "textarea",
      rows: 2,
      targetLang: bookingContentLang(),
      disabled: !state.permissions.canEditBooking,
      translateEnabled: Boolean(state.booking?.translation_enabled),
      englishValue: resolveLocalizedEditorBranchText(component?.details_i18n ?? component?.details, "en", ""),
      localizedValue: resolveLocalizedEditorBranchText(component?.details_i18n ?? component?.details, bookingContentLang(), ""),
      commonData: {
        "offer-component-details": index
      },
      translatePayload: {
        "offer-component-details-translate": index
      }
    });
  }

  function maxOfferComponentDayNumber() {
    const travelPlanDays = Array.isArray(state.travelPlanDraft?.days)
      ? state.travelPlanDraft.days.length
      : (Array.isArray(state.booking?.travel_plan?.days) ? state.booking.travel_plan.days.length : 0);
    const componentDays = (Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [])
      .map((component) => Number(component?.day_number || 0))
      .filter((value) => Number.isInteger(value) && value >= 1);
    return Math.max(travelPlanDays, componentDays.length ? Math.max(...componentDays) : 0);
  }

  function offerComponentDayOptions(selectedDayNumber = null) {
    const selected = Number.isInteger(Number(selectedDayNumber)) && Number(selectedDayNumber) >= 1
      ? Number(selectedDayNumber)
      : null;
    const maxDay = Math.max(maxOfferComponentDayNumber(), selected || 0);
    const options = [
      `<option value="">${escapeHtml(bookingT("booking.offer.day_number.not_applicable", "Not applicable"))}</option>`
    ];
    for (let dayNumber = 1; dayNumber <= maxDay; dayNumber += 1) {
      options.push(
        `<option value="${dayNumber}"${selected === dayNumber ? " selected" : ""}>${escapeHtml(bookingT("booking.offer.day_number.day", "Day {day}", { day: dayNumber }))}</option>`
      );
    }
    return options.join("");
  }

  function isOfferCategoryEditorOpen(index) {
    return offerCategoryEditorIndexes.has(Number(index));
  }

  function isOfferQuantityEditorOpen(index) {
    return offerQuantityEditorIndexes.has(Number(index));
  }

  function isOfferTaxEditorOpen(index) {
    return offerTaxEditorIndexes.has(Number(index));
  }

  function isOfferMultiQuantityMode(component, index) {
    return isOfferQuantityEditorOpen(index) || Math.max(1, Number(component?.quantity || 1)) > 1;
  }

  function applyOfferCategoryTaxRate(category, percentValue) {
    const normalizedCategory = normalizeOfferCategory(category);
    const numericPercent = Number(percentValue);
    const basisPoints = Number.isFinite(numericPercent)
      ? Math.max(0, Math.round(numericPercent * 100))
      : defaultOfferTaxRateBasisPoints;
    const nextRules = Array.isArray(state.offerDraft?.category_rules)
      ? state.offerDraft.category_rules.map((rule) => ({
          ...rule,
          tax_rate_basis_points:
            normalizeOfferCategory(rule?.category) === normalizedCategory
              ? basisPoints
              : Math.max(0, Math.round(Number(rule?.tax_rate_basis_points ?? defaultOfferTaxRateBasisPoints)))
        }))
      : defaultOfferCategoryRules().map((rule) => ({
          ...rule,
          tax_rate_basis_points: normalizeOfferCategory(rule.category) === normalizedCategory ? basisPoints : rule.tax_rate_basis_points
        }));
    state.offerDraft.category_rules = nextRules;
    state.offerDraft.components = (Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : []).map((component) => ({
      ...component,
      tax_rate_basis_points:
        normalizeOfferCategory(component?.category) === normalizedCategory
          ? basisPoints
          : Math.max(0, Math.round(Number(component?.tax_rate_basis_points ?? defaultOfferTaxRateBasisPoints)))
    }));
  }

  function renderOfferQuotationSummary() {
    if (!els.offer_quotation_summary) return;
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    const mainLines = buildOfferMainChargeLines(state.offerDraft);
    const additionalItems = Array.isArray(state.offerDraft?.additional_items) ? state.offerDraft.additional_items : [];
    const discount = state.offerDraft?.discount || null;
    const hasDiscount = Boolean(discount && Number(discount?.amount_cents || 0) > 0);
    if (!mainLines.length && !additionalItems.length && !hasDiscount) {
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

  function readOfferDraftComponentsForRender() {
    const rows = Array.from(document.querySelectorAll('[data-offer-component-details][data-localized-lang="en"][data-localized-role="source"]'));
    const fallbackComponents = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [];
    if (!rows.length) {
      return fallbackComponents;
    }
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    return rows.map((_, index) => {
      const fallbackComponent = fallbackComponents[index] || {};
      const category = normalizeOfferCategory(
        document.querySelector(`[data-offer-component-category="${index}"]`)?.value
          || fallbackComponent?.category
          || "OTHER"
      );
      const englishDetails = String(document.querySelector(`[data-offer-component-details="${index}"][data-localized-lang="en"][data-localized-role="source"]`)?.value || "").trim();
      const targetLang = bookingContentLang();
      const localizedDetails = targetLang === "en"
        ? ""
        : String(document.querySelector(`[data-offer-component-details="${index}"][data-localized-lang="${targetLang}"][data-localized-role="target"]`)?.value || "").trim();
      const quantityInput = document.querySelector(`[data-offer-component-quantity="${index}"]`);
      const totalInput = document.querySelector(`[data-offer-component-total-input="${index}"]`);
      const unitInput = document.querySelector(`[data-offer-component-unit="${index}"]`);
      const dayNumberInput = document.querySelector(`[data-offer-component-day-number="${index}"]`);
      const quantityRaw = Number(quantityInput?.value || fallbackComponent?.quantity || "1");
      const quantity = Number.isFinite(quantityRaw) && quantityRaw >= 1 ? Math.round(quantityRaw) : 1;
      const taxRateBasisPoints = getOfferCategoryTaxRateBasisPoints(category);
      const displayAmountRaw = totalInput?.value ?? unitInput?.value ?? "0";
      const displayedAmount = parseMoneyInputValue(displayAmountRaw, currency);
      const detailsPayload = paymentTermsModule.buildDualLocalizedPayload
        ? paymentTermsModule.buildDualLocalizedPayload(englishDetails, localizedDetails, targetLang)
        : {
            text: englishDetails || null,
            map: targetLang === "en"
              ? (englishDetails ? { en: englishDetails } : {})
              : {
                  ...(englishDetails ? { en: englishDetails } : {}),
                  ...(localizedDetails ? { [targetLang]: localizedDetails } : {})
                }
          };
      return {
        id: String(fallbackComponent.id || ""),
        category,
        label: String(fallbackComponent.label || ""),
        details: detailsPayload.text || null,
        details_i18n: detailsPayload.map,
        day_number: (() => {
          const rawValue = dayNumberInput?.value ?? fallbackComponent?.day_number ?? "";
          const parsed = Number.parseInt(String(rawValue).trim(), 10);
          return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
        })(),
        quantity,
        unit_amount_cents:
          Number.isFinite(displayedAmount) && displayedAmount >= 0
            ? deriveUnitNetAmountFromGross(displayedAmount, taxRateBasisPoints)
            : Math.max(0, Number(fallbackComponent.unit_amount_cents || 0)),
        tax_rate_basis_points: taxRateBasisPoints,
        currency,
        notes: String(fallbackComponent.notes || ""),
        sort_order: fallbackComponent.sort_order ?? index
      };
    });
  }

  function readOfferDraftDiscountForRender() {
    const fallbackDiscount = state.offerDraft?.discount && typeof state.offerDraft.discount === "object"
      ? state.offerDraft.discount
      : null;
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    const reasonInput = document.querySelector("[data-offer-discount-reason]");
    const amountInput = document.querySelector("[data-offer-discount-amount]");
    if (!reasonInput && !amountInput && !fallbackDiscount) return null;
    const reason = String(reasonInput?.value ?? fallbackDiscount?.reason ?? "").trim();
    const amount = amountInput
      ? parseMoneyInputValue(amountInput.value, currency)
      : Number(fallbackDiscount?.amount_cents || 0);
    const normalizedAmount = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
    if (!reason && normalizedAmount <= 0) return null;
    return {
      reason,
      amount_cents: normalizedAmount,
      currency
    };
  }

  function buildDualLocalizedPayload(englishText, localizedText, targetLang) {
    const english = String(englishText || "").trim();
    const localized = String(localizedText || "").trim();
    if (targetLang === "en") {
      return {
        text: english || null,
        map: english ? { en: english } : {}
      };
    }
    return {
      text: english || null,
      map: {
        ...(english ? { en: english } : {}),
        ...(localized ? { [targetLang]: localized } : {})
      }
    };
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

  function ensureOfferStructureForGranularity(internalGranularity) {
    const normalizedGranularity = normalizeOfferPricingGranularity(internalGranularity, "component");
    if (normalizedGranularity === "trip") {
      if (!state.offerDraft.trip_price_internal) {
        state.offerDraft.trip_price_internal = createEmptyTripPriceInternal();
      }
      return;
    }
    if (normalizedGranularity === "day") {
      const currentDays = Array.isArray(state.offerDraft?.days_internal) ? state.offerDraft.days_internal : [];
      if (currentDays.length) return;
      const travelPlanDayCount = Array.isArray(state.travelPlanDraft?.days)
        ? state.travelPlanDraft.days.length
        : (Array.isArray(state.booking?.travel_plan?.days) ? state.booking.travel_plan.days.length : 0);
      const seedCount = Math.max(1, travelPlanDayCount);
      state.offerDraft.days_internal = Array.from({ length: seedCount }, (_, index) => createEmptyDayPriceInternal(index + 1));
    }
  }

  function syncOfferMainDraftFromDom() {
    const internalGranularity = currentOfferInternalGranularity();
    if (internalGranularity === "trip") {
      state.offerDraft.trip_price_internal = readOfferDraftTripPriceForRender();
      return;
    }
    if (internalGranularity === "day") {
      state.offerDraft.days_internal = readOfferDraftDaysInternalForRender();
      return;
    }
    state.offerDraft.components = readOfferDraftComponentsForRender();
  }

  function syncOfferDraftFromDom() {
    syncOfferMainDraftFromDom();
    state.offerDraft.additional_items = readOfferDraftAdditionalItemsForRender();
    state.offerDraft.discount = readOfferDraftDiscountForRender();
    state.offerDraft.total_price_cents = null;
  }

  function readOfferDraftTripPriceForRender() {
    const fallback = state.offerDraft?.trip_price_internal && typeof state.offerDraft.trip_price_internal === "object"
      ? state.offerDraft.trip_price_internal
      : createEmptyTripPriceInternal();
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    const labelInput = document.querySelector("[data-offer-trip-label]");
    const amountInput = document.querySelector("[data-offer-trip-amount]");
    const taxInput = document.querySelector("[data-offer-trip-tax-rate]");
    return {
      ...fallback,
      label: String(labelInput?.value ?? fallback.label ?? "").trim(),
      amount_cents: Number.isFinite(parseMoneyInputValue(amountInput?.value ?? "", currency))
        ? Math.max(0, Math.round(parseMoneyInputValue(amountInput?.value ?? "", currency)))
        : Math.max(0, Number(fallback.amount_cents || 0)),
      tax_rate_basis_points: Number.isFinite(Number(taxInput?.value))
        ? Math.max(0, Math.round(Number(taxInput.value) * 100))
        : Math.max(0, Number(fallback.tax_rate_basis_points || defaultOfferTaxRateBasisPoints)),
      currency
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
      const labelInput = row.querySelector("[data-offer-day-label]");
      const amountInput = row.querySelector("[data-offer-day-amount]");
      const taxInput = row.querySelector("[data-offer-day-tax-rate]");
      const parsedAmount = parseMoneyInputValue(amountInput?.value ?? "", currency);
      const parsedDayNumber = Number.parseInt(String(dayNumberInput?.value || "").trim(), 10);
      return {
        ...fallback,
        day_number: Number.isInteger(parsedDayNumber) && parsedDayNumber >= 1 ? parsedDayNumber : index + 1,
        label: String(labelInput?.value ?? fallback.label ?? "").trim(),
        amount_cents: Number.isFinite(parsedAmount) ? Math.max(0, Math.round(parsedAmount)) : Math.max(0, Number(fallback.amount_cents || 0)),
        tax_rate_basis_points: Number.isFinite(Number(taxInput?.value))
          ? Math.max(0, Math.round(Number(taxInput.value) * 100))
          : Math.max(0, Number(fallback.tax_rate_basis_points || defaultOfferTaxRateBasisPoints)),
        currency,
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
        unit_amount_cents: Number.isFinite(parsedAmount) ? Math.max(0, Math.round(parsedAmount)) : Math.max(0, Number(fallback.unit_amount_cents || 0)),
        tax_rate_basis_points: Number.isFinite(Number(taxInput?.value))
          ? Math.max(0, Math.round(Number(taxInput.value) * 100))
          : Math.max(0, Number(fallback.tax_rate_basis_points || defaultOfferTaxRateBasisPoints)),
        currency,
        sort_order: index
      };
    });
  }

  function addOfferComponent() {
    if (!state.permissions.canEditBooking || !state.offerDraft) return;
    state.offerDraft.pricing_granularity_internal = "component";
    const category = normalizeOfferCategory("OTHER");
    const nextIndex = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components.length : 0;
    state.offerDraft.components.push({
      id: "",
      category,
      label: "",
      details: "",
      details_i18n: {},
      day_number: null,
      quantity: 1,
      unit_amount_cents: 0,
      tax_rate_basis_points: getOfferCategoryTaxRateBasisPoints(category),
      currency: state.offerDraft.currency,
      notes: "",
      sort_order: state.offerDraft.components.length
    });
    offerCategoryEditorIndexes.add(nextIndex);
    setOfferSaveEnabled(true);
    renderOfferComponentsTable();
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
    renderOfferComponentsTable();
  }

  function addOfferAdditionalItem() {
    if (!state.permissions.canEditBooking || !state.offerDraft) return;
    state.offerDraft.additional_items = [
      ...(Array.isArray(state.offerDraft?.additional_items) ? state.offerDraft.additional_items : []),
      createEmptyAdditionalItem()
    ];
    setOfferSaveEnabled(true);
    renderOfferComponentsTable();
  }

  function addOfferDiscount() {
    if (!state.permissions.canEditBooking || !state.offerDraft || state.offerDraft.discount) return;
    state.offerDraft.discount = {
      reason: "",
      amount_cents: 0,
      currency: normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD")
    };
    setOfferSaveEnabled(true);
    renderOfferComponentsTable();
  }

  function renderOfferComponentMainTable() {
    const readOnly = !state.permissions.canEditBooking;
    const showActionsCol = !readOnly;
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const offerComponents = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [];
    const showDualPrice = true;
    const priceHeaders = showDualPrice
      ? `<th class="offer-col-price-single">${escapeHtml(bookingT("booking.offer.unit", "Unit"))}</th><th class="offer-col-price-total">${escapeHtml(bookingT("booking.offer.total", "Total"))}</th>`
      : `<th class="offer-col-price-total">${escapeHtml(bookingT("booking.offer.total_currency", "Total ({currency})", { currency }))}</th>`;
    const actionHeader = showActionsCol ? '<th class="offer-col-actions"></th>' : "";
    const header = `<thead><tr><th class="offer-col-category">${escapeHtml(bookingT("booking.offer.category", "Offer category"))}</th><th class="offer-col-details">${escapeHtml(bookingT("booking.offer.details", "Offer details"))}</th><th class="offer-col-day">${escapeHtml(bookingT("booking.offer.day_number", "Day"))}</th><th class="offer-col-qty">${escapeHtml(bookingT("booking.offer.quantity", "Quantity"))}</th>${priceHeaders}${actionHeader}</tr></thead>`;
    const rows = offerComponents.map((component, index) => {
      const category = normalizeOfferCategory(component.category || "OTHER");
      const quantity = Math.max(1, Number(component.quantity || 1));
      const multiQuantityMode = isOfferMultiQuantityMode(component, index);
      const categoryEditorOpen = isOfferCategoryEditorOpen(index);
      const effectiveTaxRateBasisPoints = getOfferCategoryTaxRateBasisPoints(category);
      const unitGrossAmount = computeOfferComponentUnitGrossAmount({
        ...component,
        tax_rate_basis_points: effectiveTaxRateBasisPoints
      });
      const rawLineTotal = computeOfferComponentLineTotals({
        ...component,
        tax_rate_basis_points: effectiveTaxRateBasisPoints
      }).gross_amount_cents;
      const componentTotalText = formatMoneyDisplay(Math.round(rawLineTotal), currency);
      const quantityDisplayText = escapeHtml(String(quantity));
      const categoryText = escapeHtml(offerCategoryLabel(category));
      const taxRateText = escapeHtml(formatTaxRateLabel(effectiveTaxRateBasisPoints));
      const removeButton = showActionsCol
        ? `<button class="btn btn-ghost offer-remove-btn" type="button" data-offer-remove-component="${index}" title="${escapeHtml(bookingT("booking.offer.remove_component", "Remove offer component"))}" aria-label="${escapeHtml(bookingT("booking.offer.remove_component", "Remove offer component"))}">×</button>`
        : "";
      const changeLabel = escapeHtml(bookingT("common.change", "Change"));
      const categoryCellContent = categoryEditorOpen
        ? `<select id="offer_component_category_${index}" name="offer_component_category_${index}" data-offer-component-category="${index}" ${readOnly ? "disabled" : ""}>${offerComponentCategories.map((option) => `<option value="${escapeHtml(option.code)}" ${option.code === category ? "selected" : ""}>${escapeHtml(offerCategoryLabel(option.code))}</option>`).join("")}</select>`
        : `<div class="offer-inline-display">
              <div class="offer-inline-display__primary">${categoryText}</div>
              <div class="offer-inline-display__secondary">
                ${isOfferTaxEditorOpen(index)
                  ? `<label class="offer-tax-rate-editor">
                      <span class="offer-tax-rate-editor__label">${escapeHtml(bookingT("booking.offer.tax", "Tax"))}</span>
                      <input
                        id="offer_component_tax_rate_${index}"
                        name="offer_component_tax_rate_${index}"
                        data-offer-component-tax-rate="${index}"
                        type="number"
                        min="0"
                        step="0.01"
                        value="${escapeHtml(formatTaxRateInputValue(effectiveTaxRateBasisPoints))}"
                        ${readOnly ? "disabled" : ""}
                      />
                      <span class="offer-tax-rate-editor__suffix">%</span>
                    </label>`
                  : readOnly
                    ? `<span class="offer-tax-rate-text">${taxRateText}</span>`
                    : `<button class="offer-tax-rate-trigger" type="button" data-offer-edit-tax-rate="${index}">${taxRateText}</button>`}
              </div>
            </div>`;
      const quantityCellContent = multiQuantityMode
        ? `<input id="offer_component_quantity_${index}" name="offer_component_quantity_${index}" data-offer-component-quantity="${index}" type="number" min="1" step="1" value="${escapeHtml(String(quantity))}" ${readOnly ? "disabled" : ""} />`
        : `<div class="offer-inline-display offer-inline-display--qty-row">
              <div class="offer-inline-display__secondary offer-inline-display__secondary--qty">
                <span class="offer-inline-display__primary">${quantityDisplayText}</span>
                ${readOnly ? "" : `<button class="offer-inline-change-btn" type="button" data-offer-edit-quantity="${index}">${changeLabel}</button>`}
              </div>
            </div>`;
      const dayNumberCellContent = `<select id="offer_component_day_number_${index}" name="offer_component_day_number_${index}" data-offer-component-day-number="${index}" ${readOnly ? "disabled" : ""}>${offerComponentDayOptions(component?.day_number)}</select>`;
      const totalPriceCell = showDualPrice
        ? `<td class="offer-col-price-total"><div class="offer-total-cell">${multiQuantityMode
            ? `<span class="offer-price-value" data-offer-component-total="${index}">${escapeHtml(componentTotalText)}</span>`
            : `<input id="offer_component_total_${index}" name="offer_component_total_${index}" data-offer-component-total-input="${index}" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(Math.round(rawLineTotal), currency))}" ${readOnly ? "disabled" : ""} />`
          }</div></td>`
        : `<td class="offer-col-price-total"><div class="offer-total-cell"><span class="offer-price-value" data-offer-component-total="${index}">${escapeHtml(componentTotalText)}</span></div></td>`;
      const unitInputCell = showDualPrice
        ? `<td class="offer-col-price-single">${multiQuantityMode
            ? `<input id="offer_component_unit_${index}" name="offer_component_unit_${index}" data-offer-component-unit="${index}" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(unitGrossAmount, currency))}" ${readOnly ? "disabled" : ""} />`
            : ``
          }</td>`
        : "";
      const actionCell = showActionsCol ? `<td class="offer-col-actions">${removeButton}</td>` : "";
      const priceCells = showDualPrice ? `${unitInputCell}${totalPriceCell}` : totalPriceCell;
      return `<tr>
        <td class="offer-col-category"><div>${categoryCellContent}</div></td>
        <td class="offer-col-details">${renderOfferLocalizedDetailsField(component, index)}</td>
        <td class="offer-col-day">${dayNumberCellContent}</td>
        <td class="offer-col-qty">${quantityCellContent}</td>
        ${priceCells}${actionCell}
      </tr>`;
    }).join("");
    const offerTotalValue = formatMoneyDisplay(resolveOfferTotalCents(), currency);
    updateOfferPanelSummary(resolveOfferTotalCents(), currency);
    const addButtonCell = !readOnly
      ? `<td class="offer-col-category"></td><td class="offer-add-cell"><div class="offer-add-actions"><button class="btn btn-ghost booking-offer-add-btn" type="button" data-offer-add-component>${escapeHtml(bookingT("common.new", "New"))}</button></div></td>`
      : `<td class="offer-col-category"></td><td class="offer-col-details"></td>`;
    const totalLabelCols = `<td colspan="2" class="offer-total-merged"><div class="offer-total-sum"><strong class="offer-total-label">${escapeHtml(bookingT("booking.offer.total_including_tax", "Total (including tax)"))}:</strong></div></td>`;
    const totalValueCol = `<td class="offer-col-price-total offer-total-final"><div class="offer-total-cell"><strong class="offer-price-value offer-total-value">${escapeHtml(offerTotalValue)}</strong></div></td>`;
    const totalRow = `<tr class="offer-total-row">${addButtonCell}${totalLabelCols}${totalValueCol}${showActionsCol ? '<td class="offer-col-actions"></td>' : ""}</tr>`;
    return `${header}<tbody>${rows}${totalRow}</tbody>`;
  }

  function renderOfferDayMainTable() {
    const readOnly = !state.permissions.canEditBooking;
    const showActionsCol = !readOnly;
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const dayPrices = Array.isArray(state.offerDraft?.days_internal) ? state.offerDraft.days_internal : [];
    const header = `<thead><tr><th>${escapeHtml(bookingT("booking.offer.day_number", "Day"))}</th><th>${escapeHtml(bookingT("booking.offer.label", "Label"))}</th><th>${escapeHtml(bookingT("booking.offer.tax", "Tax"))}</th><th>${escapeHtml(bookingT("booking.offer.unit", "Unit"))}</th><th>${escapeHtml(bookingT("booking.offer.total", "Total"))}</th>${showActionsCol ? '<th class="offer-col-actions"></th>' : ""}</tr></thead>`;
    const rows = dayPrices.map((dayPrice, index) => {
      const totals = computeOfferDayInternalLineTotals(dayPrice);
      return `<tr data-offer-day-price-row="${index}">
        <td><input data-offer-day-number type="number" min="1" step="1" value="${escapeHtml(String(dayPrice?.day_number || index + 1))}" ${readOnly ? "disabled" : ""} /></td>
        <td><input data-offer-day-label type="text" value="${escapeHtml(String(dayPrice?.label || ""))}" placeholder="${escapeHtml(bookingT("booking.offer.day_number.day", "Day {day}", { day: index + 1 }))}" ${readOnly ? "disabled" : ""} /></td>
        <td><input data-offer-day-tax-rate type="number" min="0" step="0.01" value="${escapeHtml(formatTaxRateInputValue(dayPrice?.tax_rate_basis_points))}" ${readOnly ? "disabled" : ""} /></td>
        <td><input data-offer-day-amount type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(dayPrice?.amount_cents || 0, currency))}" ${readOnly ? "disabled" : ""} /></td>
        <td class="offer-col-price-total"><div class="offer-total-cell"><span class="offer-price-value" data-offer-main-total="${index}">${escapeHtml(formatMoneyDisplay(totals.line_gross_amount_cents, currency))}</span></div></td>
        ${showActionsCol ? `<td class="offer-col-actions"><button class="btn btn-ghost offer-remove-btn" type="button" data-offer-remove-day="${index}">×</button></td>` : ""}
      </tr>`;
    }).join("");
    const addRow = readOnly
      ? ""
      : `<tr class="offer-total-row"><td colspan="5" class="offer-add-cell"><div class="offer-add-actions"><button class="btn btn-ghost booking-offer-add-btn" type="button" data-offer-add-day>${escapeHtml(bookingT("booking.travel_plan.new_day", "New day"))}</button></div></td>${showActionsCol ? '<td class="offer-col-actions"></td>' : ""}</tr>`;
    return `${header}<tbody>${rows}${addRow}</tbody>`;
  }

  function renderOfferTripMainTable() {
    const readOnly = !state.permissions.canEditBooking;
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const tripPrice = state.offerDraft?.trip_price_internal || createEmptyTripPriceInternal();
    const totals = computeOfferTripPriceLineTotals(tripPrice);
    return `<thead><tr><th>${escapeHtml(bookingT("booking.offer.label", "Label"))}</th><th>${escapeHtml(bookingT("booking.offer.tax", "Tax"))}</th><th>${escapeHtml(bookingT("booking.offer.unit", "Unit"))}</th><th>${escapeHtml(bookingT("booking.offer.total", "Total"))}</th></tr></thead>
      <tbody>
        <tr>
          <td><input data-offer-trip-label type="text" value="${escapeHtml(String(tripPrice?.label || ""))}" placeholder="${escapeHtml(bookingT("booking.offer.trip_total", "Trip total"))}" ${readOnly ? "disabled" : ""} /></td>
          <td><input data-offer-trip-tax-rate type="number" min="0" step="0.01" value="${escapeHtml(formatTaxRateInputValue(tripPrice?.tax_rate_basis_points))}" ${readOnly ? "disabled" : ""} /></td>
          <td><input data-offer-trip-amount type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(tripPrice?.amount_cents || 0, currency))}" ${readOnly ? "disabled" : ""} /></td>
          <td class="offer-col-price-total"><div class="offer-total-cell"><span class="offer-price-value" data-offer-main-total="0">${escapeHtml(formatMoneyDisplay(totals.line_gross_amount_cents, currency))}</span></div></td>
        </tr>
      </tbody>`;
  }

  function renderAdditionalItemsTable() {
    if (!els.offer_additional_items_table) return;
    const readOnly = !state.permissions.canEditBooking;
    const showActionsCol = !readOnly;
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const items = Array.isArray(state.offerDraft?.additional_items) ? state.offerDraft.additional_items : [];
    const header = `<thead><tr><th>${escapeHtml(bookingT("booking.offer.label", "Label"))}</th><th>${escapeHtml(bookingT("booking.offer.details", "Offer details"))}</th><th>${escapeHtml(bookingT("booking.offer.day_number", "Day"))}</th><th>${escapeHtml(bookingT("booking.offer.quantity", "Quantity"))}</th><th>${escapeHtml(bookingT("booking.offer.tax", "Tax"))}</th><th>${escapeHtml(bookingT("booking.offer.unit", "Unit"))}</th><th>${escapeHtml(bookingT("booking.offer.total", "Total"))}</th>${showActionsCol ? '<th class="offer-col-actions"></th>' : ""}</tr></thead>`;
    const rows = items.map((item, index) => {
      const totals = computeOfferAdditionalItemLineTotals(item);
      return `<tr data-offer-additional-item-row="${index}">
        <td><input data-offer-additional-label type="text" value="${escapeHtml(String(item?.label || ""))}" placeholder="${escapeHtml(bookingT("booking.offer.additional_item", "Additional item"))}" ${readOnly ? "disabled" : ""} /></td>
        <td><textarea data-offer-additional-details rows="2" ${readOnly ? "disabled" : ""}>${escapeHtml(String(item?.details || ""))}</textarea></td>
        <td><select data-offer-additional-day-number ${readOnly ? "disabled" : ""}>${offerComponentDayOptions(item?.day_number)}</select></td>
        <td><input data-offer-additional-quantity type="number" min="1" step="1" value="${escapeHtml(String(Math.max(1, Number(item?.quantity || 1))))}" ${readOnly ? "disabled" : ""} /></td>
        <td><input data-offer-additional-tax-rate type="number" min="0" step="0.01" value="${escapeHtml(formatTaxRateInputValue(item?.tax_rate_basis_points))}" ${readOnly ? "disabled" : ""} /></td>
        <td><input data-offer-additional-unit type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(item?.unit_amount_cents || 0, currency))}" ${readOnly ? "disabled" : ""} /></td>
        <td class="offer-col-price-total"><div class="offer-total-cell"><span class="offer-price-value" data-offer-additional-total="${index}">${escapeHtml(formatMoneyDisplay(totals.line_gross_amount_cents, currency))}</span></div></td>
        ${showActionsCol ? `<td class="offer-col-actions"><button class="btn btn-ghost offer-remove-btn" type="button" data-offer-remove-additional="${index}">×</button></td>` : ""}
      </tr>`;
    }).join("");
    const addRow = readOnly
      ? ""
      : `<tr class="offer-total-row"><td colspan="7" class="offer-add-cell"><div class="offer-add-actions"><button class="btn btn-ghost booking-offer-add-btn" type="button" data-offer-add-additional>${escapeHtml(bookingT("common.new", "New"))}</button></div></td>${showActionsCol ? '<td class="offer-col-actions"></td>' : ""}</tr>`;
    els.offer_additional_items_table.innerHTML = `${header}<tbody>${rows}${addRow}</tbody>`;
  }

  function renderDiscountEditor() {
    if (!els.offer_discount_editor) return;
    const readOnly = !state.permissions.canEditBooking;
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    const discount = state.offerDraft?.discount && typeof state.offerDraft.discount === "object"
      ? state.offerDraft.discount
      : null;
    if (!discount && readOnly) {
      els.offer_discount_editor.hidden = true;
      els.offer_discount_editor.innerHTML = "";
      return;
    }
    els.offer_discount_editor.hidden = false;
    if (!discount) {
      els.offer_discount_editor.innerHTML = `
        <div class="offer-discount-editor__card">
          <div class="offer-discount-editor__title">${escapeHtml(bookingT("booking.offer.discount", "Discount"))}</div>
          <div class="offer-add-actions">
            <button class="btn btn-ghost booking-offer-add-btn" type="button" data-offer-add-discount>${escapeHtml(bookingT("booking.offer.add_discount", "Discount"))}</button>
          </div>
        </div>
      `;
      return;
    }
    const discountTotalText = formatMoneyDisplay(computeOfferDiscountLineTotals(discount).line_gross_amount_cents, currency);
    els.offer_discount_editor.innerHTML = `
      <div class="offer-discount-editor__card">
        <div class="offer-discount-editor__title">${escapeHtml(bookingT("booking.offer.discount", "Discount"))}</div>
        <div class="offer-discount-editor__grid">
          <label class="offer-discount-editor__field">
            <span>${escapeHtml(bookingT("booking.offer.details", "Offer details"))}</span>
            ${readOnly
              ? `<div class="offer-discount-editor__static">${escapeHtml(String(discount.reason || bookingT("booking.no_details", "No details")))}</div>`
              : `<textarea data-offer-discount-reason rows="2" placeholder="${escapeHtml(bookingT("booking.offer.discount_reason_placeholder", "Reason for discount"))}">${escapeHtml(String(discount.reason || ""))}</textarea>`}
          </label>
          <label class="offer-discount-editor__field">
            <span>${escapeHtml(bookingT("booking.offer.total", "Total"))}</span>
            ${readOnly
              ? `<div class="offer-discount-editor__static offer-discount-editor__static--amount" data-offer-discount-total>${escapeHtml(discountTotalText)}</div>`
              : `<input data-offer-discount-amount type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(discount.amount_cents || 0, currency))}" />`}
          </label>
          ${readOnly ? "" : `<div class="offer-discount-editor__actions"><button class="btn btn-ghost offer-remove-btn" type="button" data-offer-remove-discount>${escapeHtml(bookingT("booking.offer.remove_discount", "Remove discount"))}</button></div>`}
        </div>
      </div>
    `;
  }

  function bindOfferComponentEvents() {
    if (!els.offer_components_table || !state.permissions.canEditBooking) return;
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const syncOfferInputTotals = () => {
      state.offerDraft.components = readOfferDraftComponentsForRender();
      state.offerDraft.total_price_cents = null;
      setOfferSaveEnabled(true);
      updateOfferTotalsInDom();
    };
    els.offer_components_table.querySelectorAll("[data-offer-remove-component]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-offer-remove-component"));
        const component = state.offerDraft.components[index];
        const categoryLabel = offerCategoryLabel(component?.category);
        const detailsLabel = String(component?.details || component?.description || "").trim() || bookingT("booking.no_details", "No details");
        const totalLabel = formatMoneyDisplay(computeOfferComponentLineTotals(component).gross_amount_cents, currency);
        const confirmationMessage = [
          bookingT("booking.offer.remove_component_confirm", "Remove this offer component?"),
          "",
          bookingT("booking.offer.confirm_category", "Category: {value}", { value: categoryLabel }),
          bookingT("booking.offer.confirm_details", "Details: {value}", { value: detailsLabel }),
          bookingT("booking.offer.confirm_total", "Total: {value}", { value: totalLabel })
        ].join("\n");
        if (!window.confirm(confirmationMessage)) return;
        state.offerDraft.components.splice(index, 1);
        offerCategoryEditorIndexes = new Set();
        offerQuantityEditorIndexes = new Set();
        offerTaxEditorIndexes = new Set();
        setOfferSaveEnabled(true);
        renderOfferComponentsTable();
      });
    });
    els.offer_components_table.querySelectorAll("[data-offer-edit-tax-rate]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-offer-edit-tax-rate"));
        offerTaxEditorIndexes.add(index);
        renderOfferComponentsTable();
      });
    });
    els.offer_components_table.querySelectorAll("[data-offer-edit-quantity]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-offer-edit-quantity"));
        offerQuantityEditorIndexes.add(index);
        renderOfferComponentsTable();
      });
    });
    els.offer_components_table.querySelectorAll("[data-offer-component-category]").forEach((input) => {
      input.addEventListener("change", () => {
        const index = Number(input.getAttribute("data-offer-component-category"));
        offerCategoryEditorIndexes.delete(index);
        syncOfferInputTotals();
        renderOfferComponentsTable();
      });
    });
    els.offer_components_table.querySelectorAll("[data-offer-component-tax-rate]").forEach((input) => {
      input.addEventListener("change", () => {
        const index = Number(input.getAttribute("data-offer-component-tax-rate"));
        const component = state.offerDraft?.components?.[index];
        applyOfferCategoryTaxRate(component?.category, input.value);
        offerTaxEditorIndexes.delete(index);
        setOfferSaveEnabled(true);
        state.offerDraft.total_price_cents = null;
        renderOfferComponentsTable();
      });
    });
    els.offer_components_table.querySelectorAll("[data-offer-component-details]").forEach((input) => {
      input.addEventListener("change", syncOfferInputTotals);
    });
    els.offer_components_table.querySelectorAll("[data-offer-component-day-number], [data-offer-component-quantity], [data-offer-component-unit], [data-offer-component-total-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const index = Number(
          input.getAttribute("data-offer-component-day-number")
          || input.getAttribute("data-offer-component-quantity")
          || input.getAttribute("data-offer-component-unit")
          || input.getAttribute("data-offer-component-total-input")
          || "-1"
        );
        if (index >= 0) {
          offerPendingRowIndexes.add(index);
          offerTotalPending = true;
        }
        syncOfferInputTotals();
      });
      input.addEventListener("change", syncOfferInputTotals);
    });
    els.offer_components_table.querySelectorAll("[data-offer-add-component]").forEach((button) => {
      button.addEventListener("click", addOfferComponent);
    });
    els.offer_components_table.querySelectorAll("[data-localized-translate]").forEach((button) => {
      button.addEventListener("click", async () => {
        const index = Number(button.getAttribute("data-offer-component-details-translate"));
        const targetLang = bookingContentLang();
        const direction = String(button.getAttribute("data-localized-translate-direction") || "source-to-target").trim();
        const englishInput = document.querySelector(`[data-offer-component-details="${index}"][data-localized-lang="en"][data-localized-role="source"]`);
        const localizedInput = document.querySelector(`[data-offer-component-details="${index}"][data-localized-lang="${targetLang}"][data-localized-role="target"]`);
        if (!englishInput || !localizedInput || !state.booking?.id || targetLang === "en") return;
        const sourceInput = direction === "target-to-source" ? localizedInput : englishInput;
        const destinationInput = direction === "target-to-source" ? englishInput : localizedInput;
        const sourceLang = direction === "target-to-source" ? targetLang : "en";
        const destinationLang = direction === "target-to-source" ? "en" : targetLang;
        const sourceText = String(sourceInput?.value || "").trim();
        if (!sourceText) return;
        const targetOption = bookingContentLanguageOption(targetLang);
        setOfferStatus(
          direction === "target-to-source"
            ? bookingT("booking.translation.translating_field_to_english", "Translating field to English...")
            : bookingT("booking.translation.translating_field_from_english", "Translating field from English...")
        );
        let translated = "";
        try {
          const translatedEntries = await requestBookingFieldTranslation({
            bookingId: state.booking?.id,
            entries: { value: sourceText },
            fetchBookingMutation,
            sourceLang,
            targetLang: destinationLang
          });
          translated = String(translatedEntries?.value || "").trim();
          if (!translated) throw new Error(bookingT("booking.translation.error", "Could not translate this section."));
        } catch (error) {
          setOfferStatus(error?.message || bookingT("booking.translation.error", "Could not translate this section."));
          return;
        }
        destinationInput.value = translated;
        state.offerDraft.components = readOfferDraftComponentsForRender();
        state.offerDraft.total_price_cents = null;
        setOfferSaveEnabled(true);
        setOfferStatus(
          direction === "target-to-source"
            ? bookingT("booking.translation.field_translated_to_english", "Field translated to English.")
            : bookingT("booking.translation.field_translated_to_customer_language", "Field translated to {lang}.", { lang: targetOption.shortLabel })
        );
      });
    });
  }

  function bindOfferDayEvents() {
    if (!els.offer_components_table || !state.permissions.canEditBooking) return;
    const syncOfferDayTotals = () => {
      state.offerDraft.days_internal = readOfferDraftDaysInternalForRender();
      state.offerDraft.total_price_cents = null;
      setOfferSaveEnabled(true);
      updateOfferTotalsInDom();
    };
    els.offer_components_table.querySelectorAll("[data-offer-day-number], [data-offer-day-label], [data-offer-day-amount], [data-offer-day-tax-rate]").forEach((input) => {
      input.addEventListener("input", syncOfferDayTotals);
      input.addEventListener("change", syncOfferDayTotals);
    });
    els.offer_components_table.querySelectorAll("[data-offer-add-day]").forEach((button) => {
      button.addEventListener("click", addOfferDayInternal);
    });
    els.offer_components_table.querySelectorAll("[data-offer-remove-day]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-offer-remove-day"));
        state.offerDraft.days_internal.splice(index, 1);
        setOfferSaveEnabled(true);
        renderOfferComponentsTable();
      });
    });
  }

  function bindOfferTripEvents() {
    if (!els.offer_components_table || !state.permissions.canEditBooking) return;
    const syncTripTotals = () => {
      state.offerDraft.trip_price_internal = readOfferDraftTripPriceForRender();
      state.offerDraft.total_price_cents = null;
      setOfferSaveEnabled(true);
      updateOfferTotalsInDom();
    };
    els.offer_components_table.querySelectorAll("[data-offer-trip-label], [data-offer-trip-amount], [data-offer-trip-tax-rate]").forEach((input) => {
      input.addEventListener("input", syncTripTotals);
      input.addEventListener("change", syncTripTotals);
    });
  }

  function bindAdditionalItemsEvents() {
    if (!els.offer_additional_items_table || !state.permissions.canEditBooking) return;
    const syncAdditionalTotals = () => {
      state.offerDraft.additional_items = readOfferDraftAdditionalItemsForRender();
      state.offerDraft.total_price_cents = null;
      setOfferSaveEnabled(true);
      updateOfferTotalsInDom();
    };
    els.offer_additional_items_table.querySelectorAll("[data-offer-additional-label], [data-offer-additional-details], [data-offer-additional-day-number], [data-offer-additional-quantity], [data-offer-additional-tax-rate], [data-offer-additional-unit]").forEach((input) => {
      input.addEventListener("input", syncAdditionalTotals);
      input.addEventListener("change", syncAdditionalTotals);
    });
    els.offer_additional_items_table.querySelectorAll("[data-offer-add-additional]").forEach((button) => {
      button.addEventListener("click", addOfferAdditionalItem);
    });
    els.offer_additional_items_table.querySelectorAll("[data-offer-remove-additional]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-offer-remove-additional"));
        state.offerDraft.additional_items.splice(index, 1);
        setOfferSaveEnabled(true);
        renderOfferComponentsTable();
      });
    });
  }

  function bindDiscountEvents() {
    if (!els.offer_discount_editor || !state.permissions.canEditBooking) return;
    els.offer_discount_editor.querySelectorAll("[data-offer-add-discount]").forEach((button) => {
      button.addEventListener("click", addOfferDiscount);
    });
    els.offer_discount_editor.querySelectorAll("[data-offer-remove-discount]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!window.confirm(bookingT("booking.offer.remove_discount_confirm", "Remove this discount?"))) return;
        state.offerDraft.discount = null;
        setOfferSaveEnabled(true);
        renderOfferComponentsTable();
      });
    });
    els.offer_discount_editor.querySelectorAll("[data-offer-discount-reason], [data-offer-discount-amount]").forEach((input) => {
      input.addEventListener("input", () => {
        state.offerDraft.discount = readOfferDraftDiscountForRender();
        state.offerDraft.total_price_cents = null;
        setOfferSaveEnabled(true);
        updateOfferTotalsInDom();
      });
      input.addEventListener("change", () => {
        state.offerDraft.discount = readOfferDraftDiscountForRender();
        state.offerDraft.total_price_cents = null;
        setOfferSaveEnabled(true);
        updateOfferTotalsInDom();
      });
    });
  }

  function renderOfferComponentsTable() {
    if (!els.offer_components_table) return;
    ensureOfferStructureForGranularity(currentOfferInternalGranularity());
    const internalGranularity = currentOfferInternalGranularity();
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    if (internalGranularity === "trip") {
      els.offer_components_table.innerHTML = renderOfferTripMainTable();
    } else if (internalGranularity === "day") {
      els.offer_components_table.innerHTML = renderOfferDayMainTable();
    } else {
      els.offer_components_table.innerHTML = renderOfferComponentMainTable();
    }
    updateOfferPanelSummary(resolveOfferTotalCents(), currency);
    renderAdditionalItemsTable();
    renderDiscountEditor();
    updateOfferVisiblePricingHintState();
    renderOfferQuotationSummary();
    paymentTermsModule.renderOfferPaymentTerms();

    if (internalGranularity === "trip") {
      bindOfferTripEvents();
    } else if (internalGranularity === "day") {
      bindOfferDayEvents();
    } else {
      bindOfferComponentEvents();
    }
    bindAdditionalItemsEvents();
    bindDiscountEvents();
  }

  function updateOfferTotalsInDom() {
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    const internalGranularity = currentOfferInternalGranularity();
    if (internalGranularity === "component") {
      const components = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [];
      components.forEach((component, index) => {
        const totalNode = document.querySelector(`[data-offer-component-total="${index}"]`);
        if (!totalNode) return;
        if (offerPendingRowIndexes.has(index)) {
          totalNode.textContent = formatPendingMoneyDisplay(currency);
          return;
        }
        const total = computeOfferComponentLineTotals(component).gross_amount_cents;
        totalNode.textContent = formatMoneyDisplay(Math.round(total), currency);
      });
    } else if (internalGranularity === "day") {
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
    const discountTotalNode = document.querySelector("[data-offer-discount-total]");
    if (discountTotalNode) {
      const discount = state.offerDraft?.discount || null;
      const total = computeOfferDiscountLineTotals(discount).line_gross_amount_cents;
      discountTotalNode.textContent = formatMoneyDisplay(Math.round(total), currency);
    }
    const totalValueNode = document.querySelector(".offer-total-value");
    if (totalValueNode) {
      totalValueNode.textContent = `${offerTotalPending ? formatPendingMoneyDisplay(currency) : formatMoneyDisplay(resolveOfferTotalCents(), currency)}`;
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
      const taxRateBasisPoints = Number.isFinite(Number(raw))
        ? Math.max(0, Math.round(Number(raw)))
        : defaults.find((entry) => entry.category === category.code)?.tax_rate_basis_points || defaultOfferTaxRateBasisPoints;
      return {
        category: category.code,
        tax_rate_basis_points: taxRateBasisPoints
      };
    });
  }

  function collectOfferDiscount({ throwOnError = true } = {}) {
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    const discount = readOfferDraftDiscountForRender();
    if (!discount) return null;
    const reason = String(discount.reason || "").trim();
    const amountCents = Math.max(0, Math.round(Number(discount.amount_cents || 0)));
    if (!reason && amountCents <= 0) return null;
    if (amountCents <= 0) {
      if (throwOnError) throw new Error(bookingT("booking.offer.error.discount_amount", "Offer discount requires a valid amount."));
      return null;
    }
    if (!reason) {
      if (throwOnError) throw new Error(bookingT("booking.offer.error.discount_reason", "Offer discount requires a reason."));
      return null;
    }
    return {
      reason,
      amount_cents: amountCents,
      currency
    };
  }

  function collectOfferComponents({ throwOnError = true } = {}) {
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const rows = Array.from(document.querySelectorAll('[data-offer-component-details][data-localized-lang="en"][data-localized-role="source"]'));
    const components = [];
    for (const input of rows) {
      const index = Number(input.getAttribute("data-offer-component-details"));
      const fallbackComponent = state.offerDraft.components[index] || {};
      const category = normalizeOfferCategory(
        document.querySelector(`[data-offer-component-category="${index}"]`)?.value
          || fallbackComponent?.category
          || "OTHER"
      );
      const englishDetails = String(document.querySelector(`[data-offer-component-details="${index}"][data-localized-lang="en"][data-localized-role="source"]`)?.value || "").trim();
      const targetLang = bookingContentLang();
      const localizedDetails = targetLang === "en"
        ? ""
        : String(document.querySelector(`[data-offer-component-details="${index}"][data-localized-lang="${targetLang}"][data-localized-role="target"]`)?.value || "").trim();
      const quantityInput = document.querySelector(`[data-offer-component-quantity="${index}"]`);
      const totalInput = document.querySelector(`[data-offer-component-total-input="${index}"]`);
      const unitInput = document.querySelector(`[data-offer-component-unit="${index}"]`);
      const dayNumberInput = document.querySelector(`[data-offer-component-day-number="${index}"]`);
      const quantity = Number(quantityInput?.value || fallbackComponent?.quantity || "1");
      const displayedGrossAmount = parseMoneyInputValue(totalInput?.value ?? unitInput?.value ?? "0", currency);
      const taxRateBasisPoints = getOfferCategoryTaxRateBasisPoints(category);
      const unitAmount = deriveUnitNetAmountFromGross(displayedGrossAmount, taxRateBasisPoints);
      const label = String(offerCategoryLabel(category)).trim();
      const notes = String(fallbackComponent?.notes || "").trim();
      const detailsPayload = buildDualLocalizedPayload(englishDetails, localizedDetails, targetLang);
      if (!category) {
        if (throwOnError) throw new Error(bookingT("booking.offer.error.component_category", "Offer component {index} requires a category.", { index: index + 1 }));
        continue;
      }
      if (!Number.isFinite(quantity) || quantity < 1) {
        if (throwOnError) throw new Error(bookingT("booking.offer.error.component_quantity", "Offer component {index} quantity must be at least 1.", { index: index + 1 }));
        continue;
      }
      if (!Number.isFinite(unitAmount) || unitAmount < 0) {
        if (throwOnError) throw new Error(bookingT("booking.offer.error.component_amount", "Offer component {index} requires a valid non-negative unit amount.", { index: index + 1 }));
        continue;
      }
      components.push({
        id: fallbackComponent?.id || "",
        category,
        label,
        details: detailsPayload.text || null,
        details_i18n: detailsPayload.map,
        ...(() => {
          const parsedDayNumber = Number.parseInt(String(dayNumberInput?.value || "").trim(), 10);
          return Number.isInteger(parsedDayNumber) && parsedDayNumber >= 1
            ? { day_number: parsedDayNumber }
            : {};
        })(),
        quantity: Math.round(quantity),
        unit_amount_cents: Math.round(unitAmount),
        tax_rate_basis_points: taxRateBasisPoints,
        currency,
        notes: notes || null,
        sort_order: index
      });
    }
    return components;
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
      tax_rate_basis_points: Math.max(0, Math.round(Number(tripPrice.tax_rate_basis_points || defaultOfferTaxRateBasisPoints))),
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
        tax_rate_basis_points: Math.max(0, Math.round(Number(dayPrice?.tax_rate_basis_points || defaultOfferTaxRateBasisPoints))),
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
      const unitAmountCents = Math.max(0, Math.round(Number(item?.unit_amount_cents || 0)));
      if (!Number.isFinite(quantity) || quantity < 1) {
        if (throwOnError) throw new Error(bookingT("booking.offer.error.additional_item_quantity", "Additional item {index} quantity must be at least 1.", { index: index + 1 }));
        return null;
      }
      if (!Number.isFinite(unitAmountCents) || unitAmountCents < 0) {
        if (throwOnError) throw new Error(bookingT("booking.offer.error.additional_item_amount", "Additional item {index} requires a valid non-negative unit amount.", { index: index + 1 }));
        return null;
      }
      const parsedDayNumber = Number.parseInt(String(item?.day_number || "").trim(), 10);
      return {
        id: String(item?.id || "").trim(),
        label: String(item?.label || "").trim() || bookingT("booking.offer.additional_item", "Additional item"),
        ...(String(item?.details || "").trim() ? { details: String(item.details).trim() } : {}),
        ...(Number.isInteger(parsedDayNumber) && parsedDayNumber >= 1 ? { day_number: parsedDayNumber } : {}),
        quantity,
        unit_amount_cents: unitAmountCents,
        tax_rate_basis_points: Math.max(0, Math.round(Number(item?.tax_rate_basis_points || defaultOfferTaxRateBasisPoints))),
        currency,
        category: normalizeOfferCategory(item?.category || "OTHER"),
        ...(String(item?.notes || "").trim() ? { notes: String(item.notes).trim() } : {}),
        sort_order: index
      };
    }).filter(Boolean);
  }

  function collectOfferPayload() {
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const pricingGranularityInternal = currentOfferInternalGranularity();
    const pricingGranularityVisible = currentOfferVisibleGranularity();
    const category_rules = collectOfferCategoryRules();
    const components = pricingGranularityInternal === "component" ? collectOfferComponents() : [];
    const daysInternal = pricingGranularityInternal === "day" ? collectOfferDaysInternal() : [];
    const tripPriceInternal = pricingGranularityInternal === "trip" ? collectOfferTripPriceInternal() : null;
    const additionalItems = collectOfferAdditionalItems();
    const discount = collectOfferDiscount();
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
      pricing_granularity_internal: pricingGranularityInternal,
      pricing_granularity_visible: pricingGranularityVisible,
      category_rules,
      components,
      ...(pricingGranularityInternal === "day" ? { days_internal: daysInternal } : {}),
      ...(pricingGranularityInternal === "trip" && tripPriceInternal ? { trip_price_internal: tripPriceInternal } : {}),
      additional_items: additionalItems,
      ...(discount ? { discount } : {}),
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

  async function convertOfferComponentsInBackend(currentCurrency, nextCurrency, components) {
    const request = offerExchangeRatesRequest({ baseURL: apiOrigin });
    const requestBody = {
      from_currency: currentCurrency,
      to_currency: nextCurrency,
      components: components.map((component, index) => ({
        id: component.id || `component_${index}`,
        unit_amount_cents: Number(component.unit_amount_cents || 0),
        category: component.category || "OTHER",
        quantity: Number(component.quantity || 1),
        tax_rate_basis_points: Number(component.tax_rate_basis_points || 1000)
      }))
    };
    const response = await fetchApi(request.url, {
      method: request.method,
      body: requestBody
    });
    const convertedComponentsRaw = Array.isArray(response?.converted_components) ? response.converted_components : null;
    if (!response || !Array.isArray(convertedComponentsRaw)) {
      throw new Error(response?.detail || response?.error || bookingT("booking.offer.error.exchange_failed", "Offer exchange failed."));
    }
    return {
      convertedComponents: convertedComponentsRaw.map((component, index) => ({
        id: component.id || `component_${index}`,
        unit_amount_cents: Math.max(0, Number(component.unit_amount_cents) || 0),
        line_total_amount_cents: Number.isFinite(Number(component.line_total_amount_cents))
          ? Number(component.line_total_amount_cents)
          : Number(component.line_gross_amount_cents) || 0
      })),
      totalPriceCents: Number.isFinite(Number(response.total_price_cents))
        ? Number(response.total_price_cents)
        : null
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
          tax_rate_basis_points: Number(line.tax_rate_basis_points || 0)
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
    const internalGranularity = currentOfferInternalGranularity();
    if (!nextCurrency || nextCurrency === currentCurrency) {
      els.offer_currency_input.value = currentCurrency;
      return;
    }
    let components = [];
    let daysInternal = [];
    let tripPriceInternal = null;
    let additionalItems = [];
    let discount;
    try {
      if (internalGranularity === "component") {
        components = collectOfferComponents({ throwOnError: true });
      } else if (internalGranularity === "day") {
        daysInternal = collectOfferDaysInternal({ throwOnError: true });
      } else {
        tripPriceInternal = collectOfferTripPriceInternal({ throwOnError: true });
      }
      additionalItems = collectOfferAdditionalItems({ throwOnError: true });
      discount = collectOfferDiscount({ throwOnError: true });
    } catch (error) {
      setOfferStatus(String(error?.message || error));
      els.offer_currency_input.value = currentCurrency;
      return;
    }
    const restoreSelectState = () => {
      if (els.offer_currency_input) els.offer_currency_input.disabled = false;
    };
    if (els.offer_currency_input) {
      els.offer_currency_input.disabled = true;
    }
    setOfferStatus(bookingT("booking.offer.converting_prices", "Converting prices..."));
    try {
      const [convertedComponents, convertedDays, convertedTrip, convertedAdditionalItems, convertedDiscount] = await Promise.all([
        internalGranularity === "component"
          ? convertOfferComponentsInBackend(currentCurrency, nextCurrency, components)
          : Promise.resolve(null),
        internalGranularity === "day"
          ? convertOfferPricingLinesInBackend(currentCurrency, nextCurrency, daysInternal.map((dayPrice, index) => ({
              id: dayPrice.id || `offer_day_internal_${index}`,
              unit_amount_cents: Number(dayPrice.amount_cents || 0),
              quantity: 1,
              tax_rate_basis_points: Number(dayPrice.tax_rate_basis_points || 0)
            })))
          : Promise.resolve([]),
        internalGranularity === "trip" && tripPriceInternal
          ? convertOfferPricingLinesInBackend(currentCurrency, nextCurrency, [{
              id: "offer_trip_internal",
              unit_amount_cents: Number(tripPriceInternal.amount_cents || 0),
              quantity: 1,
              tax_rate_basis_points: Number(tripPriceInternal.tax_rate_basis_points || 0)
            }])
          : Promise.resolve([]),
        convertOfferPricingLinesInBackend(currentCurrency, nextCurrency, additionalItems.map((item, index) => ({
          id: item.id || `offer_additional_item_${index}`,
          unit_amount_cents: Number(item.unit_amount_cents || 0),
          quantity: Number(item.quantity || 1),
          tax_rate_basis_points: Number(item.tax_rate_basis_points || 0),
          category: item.category || "OTHER"
        }))),
        convertOfferDiscountInBackend(currentCurrency, nextCurrency, discount)
      ]);
      state.offerDraft.currency = nextCurrency;
      if (internalGranularity === "component") {
        const convertedRows = convertedComponents?.convertedComponents || [];
        state.offerDraft.components = components.map((component, index) => {
          const convertedComponent = convertedRows[index] || {};
          return {
            ...component,
            unit_amount_cents:
              Number.isFinite(convertedComponent.unit_amount_cents) && convertedComponent.unit_amount_cents >= 0
                ? convertedComponent.unit_amount_cents
                : component.unit_amount_cents,
            line_total_amount_cents: Number.isFinite(convertedComponent.line_total_amount_cents)
              ? convertedComponent.line_total_amount_cents
              : component.line_total_amount_cents,
            currency: nextCurrency
          };
        });
      } else if (internalGranularity === "day") {
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
      state.offerDraft.discount = convertedDiscount
        ? {
            ...convertedDiscount
          }
        : null;
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
      return;
    }
    restoreSelectState();
    setOfferStatus("");
    updateOfferCurrencyHint(nextCurrency);
    renderOfferComponentsTable();
  }

  function handleOfferInternalGranularityChange(nextValue) {
    if (!state.offerDraft || !state.permissions.canEditBooking) return;
    syncOfferDraftFromDom();
    resetComponentUiState();
    const internalGranularity = normalizeOfferPricingGranularity(nextValue, currentOfferInternalGranularity());
    state.offerDraft.pricing_granularity_internal = internalGranularity;
    ensureOfferStructureForGranularity(internalGranularity);
    if (isVisibleGranularityFinerThanInternal(currentOfferVisibleGranularity(), internalGranularity)) {
      state.offerDraft.pricing_granularity_visible = internalGranularity;
    }
    setOfferSaveEnabled(true);
    renderOfferComponentsTable();
  }

  function handleOfferVisibleGranularityChange(nextValue) {
    if (!state.offerDraft || !state.permissions.canEditBooking) return;
    syncOfferDraftFromDom();
    const internalGranularity = currentOfferInternalGranularity();
    const requestedVisibleGranularity = normalizeOfferPricingGranularity(nextValue, internalGranularity);
    state.offerDraft.pricing_granularity_visible = isVisibleGranularityFinerThanInternal(requestedVisibleGranularity, internalGranularity)
      ? internalGranularity
      : requestedVisibleGranularity;
    setOfferSaveEnabled(true);
    updateOfferVisiblePricingHintState();
    renderOfferQuotationSummary();
  }

  return {
    addOfferComponent,
    clearPendingTotals,
    collectOfferPayload,
    handleOfferCurrencyChange,
    handleOfferInternalGranularityChange,
    handleOfferVisibleGranularityChange,
    renderOfferComponentsTable,
    resetComponentUiState,
    resolveOfferTotalCents,
    updateOfferCurrencyHint,
    updateOfferTotalsInDom
  };
}
