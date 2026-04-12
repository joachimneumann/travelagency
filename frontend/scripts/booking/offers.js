import { GENERATED_OFFER_CATEGORIES as GENERATED_OFFER_CATEGORY_LIST } from "../../Generated/Models/generated_Booking.js";
import {
  formatMoneyDisplay,
  normalizeCurrencyCode,
  setSelectValue
} from "./pricing.js";
import { bookingSourceLang, bookingT } from "./i18n.js";
import { renderBookingSectionHeader } from "./sections.js";
import { createBookingOfferPricingModule } from "./offer_pricing.js";
import { createBookingOfferPaymentTermsModule } from "./offer_payment_terms.js";
import { createBookingOfferSaveController } from "./offer_save.js";

const DEFAULT_OFFER_TAX_RATE_BASIS_POINTS = 1000;
const OFFER_DETAIL_LEVEL_ORDER = Object.freeze({
  trip: 1,
  day: 2
});
const OFFER_DETAIL_LEVEL_OPTIONS = Object.freeze([
  { value: "day", label: "Per day" },
  { value: "trip", label: "Per trip" }
]);

const OFFER_CATEGORIES = GENERATED_OFFER_CATEGORY_LIST.map((code) => ({ code }));

export function createBookingOfferModule(ctx) {
  const {
    state,
    els,
    apiOrigin,
    fetchApi,
    fetchBookingMutation,
    getBookingRevision,
    renderBookingHeader,
    renderBookingData,
    renderPricingPanel,
    renderTravelPlanPanel,
    loadActivities,
    escapeHtml,
    setBookingSectionDirty
  } = ctx;

  let offerSaveController = null;
  let pendingInternalDetailLevelSelection = null;

  function normalizeOfferStatus(value) {
    const normalized = String(value || "").trim().toUpperCase();
    return ["DRAFT", "APPROVED", "OFFER_SENT"].includes(normalized) ? normalized : "DRAFT";
  }

  function normalizeOfferDetailLevel(value, fallback = "trip") {
    const normalized = String(value || "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(OFFER_DETAIL_LEVEL_ORDER, normalized) ? normalized : fallback;
  }

  function isVisibleDetailLevelFinerThanInternal(visible, internal) {
    return (OFFER_DETAIL_LEVEL_ORDER[visible] || 0) > (OFFER_DETAIL_LEVEL_ORDER[internal] || 0);
  }

  function inferInternalOfferDetailLevel(source, fallback = "trip") {
    const explicit = String(source?.offer_detail_level_internal || "").trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(OFFER_DETAIL_LEVEL_ORDER, explicit)) return explicit;
    if (Array.isArray(source?.days_internal) && source.days_internal.length) return "day";
    if (source?.trip_price_internal && typeof source.trip_price_internal === "object") return "trip";
    if (Array.isArray(source?.components) && source.components.length) {
      return source.components.every((component) => Number.isInteger(Number(component?.day_number)) && Number(component?.day_number) >= 1)
        ? "day"
        : "trip";
    }
    return fallback;
  }

  function isCoarserDetailLevel(nextValue, currentValue) {
    return (OFFER_DETAIL_LEVEL_ORDER[nextValue] || 0) < (OFFER_DETAIL_LEVEL_ORDER[currentValue] || 0);
  }

  function formatOfferDetailLevelLabel(value) {
    const normalized = normalizeOfferDetailLevel(value, "trip");
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function isOfferCurrencyEditable() {
    return state.permissions.canEditBooking && normalizeOfferStatus(state.offerDraft?.status || state.booking?.offer?.status) === "DRAFT";
  }

  function debugOffer(step, payload = undefined) {
    void step;
    void payload;
    // Temporary offer debug logging kept commented for quick re-enable during pricing investigations.
    // try {
    //   if (payload === undefined) {
    //     console.log(`[offer-debug] ${step}`);
    //   } else {
    //     console.log(`[offer-debug] ${step}`, payload);
    //   }
    // } catch {
    //   // ignore debug serialization failures
    // }
  }

  function setOfferStatus(message, type = "info") {
    if (!els.offer_status) return;
    els.offer_status.textContent = message;
    els.offer_status.classList.remove(
      "booking-inline-status--error",
      "booking-inline-status--success",
      "booking-inline-status--info"
    );
    if (!message) return;
    const normalizedType = type === "error" || type === "success" ? type : "info";
    els.offer_status.classList.add(`booking-inline-status--${normalizedType}`);
  }

  function clearOfferStatus() {
    setOfferStatus("");
  }

  function applyOfferDetailLevelSelection(select, nextValue) {
    if (!(select instanceof HTMLSelectElement)) return;
    const normalized = normalizeOfferDetailLevel(nextValue, select.value || "trip");
    if (select.value === normalized) return;
    select.value = normalized;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function openInternalDetailLevelConfirm(nextValue) {
    if (!els.offer_detail_level_confirm_modal || !els.offer_detail_level_confirm_message) return Promise.resolve(true);
    const currentValue = normalizeOfferDetailLevel(state.offerDraft?.offer_detail_level_internal, "trip");
    const normalizedNextValue = normalizeOfferDetailLevel(nextValue, currentValue);
    pendingInternalDetailLevelSelection = { nextValue: normalizedNextValue, resolver: null };
    const detailLevelEffects = {
      trip: bookingT(
        "booking.offer.internal_detail_level_warning_effect_trip",
        "The offer will keep one trip total only. Existing day rows will be collapsed into that total."
      ),
      day: bookingT(
        "booking.offer.internal_detail_level_warning_effect_day",
        "The offer will keep day rows only. If you switch from trip, every day starts at 0 and the previous total becomes one surcharge."
      )
    };
    els.offer_detail_level_confirm_message.textContent = bookingT(
      "booking.offer.internal_detail_level_warning",
      "Changing the internal offer detail level from {from} to {to} is destructive. Existing internal pricing rows will be deleted and rebuilt for the new structure. {effect} If needed, the customer-facing offer detail level will also switch to stay at the same or a more coarse level.",
      {
        from: formatOfferDetailLevelLabel(currentValue).toLowerCase(),
        to: formatOfferDetailLevelLabel(normalizedNextValue).toLowerCase(),
        effect: detailLevelEffects[normalizedNextValue] || ""
      }
    );
    els.offer_detail_level_confirm_modal.hidden = false;
    return new Promise((resolve) => {
      pendingInternalDetailLevelSelection.resolver = resolve;
      els.offer_detail_level_confirm_accept_btn?.focus();
    });
  }

  function closeInternalDetailLevelConfirm(confirmed) {
    if (!pendingInternalDetailLevelSelection) return;
    const pending = pendingInternalDetailLevelSelection;
    pendingInternalDetailLevelSelection = null;
    if (els.offer_detail_level_confirm_modal) {
      els.offer_detail_level_confirm_modal.hidden = true;
    }
    pending.resolver?.(Boolean(confirmed));
  }

  function ensureOfferDetailLevelEventsBound() {
    if (els.offer_detail_level_panel && els.offer_detail_level_panel.dataset.detailLevelBound !== "true") {
      els.offer_detail_level_panel.addEventListener("click", async (event) => {
        const button = event.target instanceof Element
          ? event.target.closest("[data-offer-detail-level-target][data-offer-detail-level-value]")
          : null;
        if (!(button instanceof HTMLButtonElement) || button.disabled || !state.permissions.canEditBooking) return;
        const target = String(button.dataset.offerDetailLevelTarget || "");
        const nextValue = String(button.dataset.offerDetailLevelValue || "");
        if (target === "internal") {
          const currentValue = normalizeOfferDetailLevel(state.offerDraft?.offer_detail_level_internal, "trip");
          if (normalizeOfferDetailLevel(nextValue, currentValue) === currentValue) return;
          if (isCoarserDetailLevel(nextValue, currentValue)) {
            const confirmed = await openInternalDetailLevelConfirm(nextValue);
            if (!confirmed) {
              syncOfferDetailLevelControls();
              return;
            }
          }
          applyOfferDetailLevelSelection(els.offer_detail_level_internal_input, nextValue);
          return;
        }
        if (target === "visible") {
          applyOfferDetailLevelSelection(els.offer_detail_level_visible_input, nextValue);
        }
      });
      els.offer_detail_level_panel.dataset.detailLevelBound = "true";
    }
    if (els.offer_detail_level_confirm_modal && els.offer_detail_level_confirm_modal.dataset.detailLevelBound !== "true") {
      els.offer_detail_level_confirm_modal.addEventListener("click", (event) => {
        if (event.target === els.offer_detail_level_confirm_modal) closeInternalDetailLevelConfirm(false);
      });
      els.offer_detail_level_confirm_modal.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeInternalDetailLevelConfirm(false);
        }
      });
      els.offer_detail_level_confirm_close_btn?.addEventListener("click", () => closeInternalDetailLevelConfirm(false));
      els.offer_detail_level_confirm_cancel_btn?.addEventListener("click", () => closeInternalDetailLevelConfirm(false));
      els.offer_detail_level_confirm_accept_btn?.addEventListener("click", () => closeInternalDetailLevelConfirm(true));
      els.offer_detail_level_confirm_modal.dataset.detailLevelBound = "true";
    }
  }

  function countMissingOfferPdfTranslations(booking, lang) {
    if (!booking || lang === bookingSourceLang("en")) return 0;
    const normalizedLang = String(lang || "").trim().toLowerCase();
    const travelPlanSummary = booking?.travel_plan_translation_status;
    if (travelPlanSummary?.lang === normalizedLang) {
      return Number(travelPlanSummary?.missing_fields || 0);
    }
    let missing = 0;
    const considerField = (value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      if (!Object.values(value).some((candidate) => String(candidate || "").trim())) return;
      if (!String(value[lang] || "").trim()) missing += 1;
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

  function updateOfferPanelSummary(totalCents, currency) {
    renderBookingSectionHeader(els.offerPanelSummary, {
      primary: bookingT("booking.proposal_total", "Offer {total}", { total: formatMoneyDisplay(totalCents, currency) })
    });
  }

  function setOfferSaveEnabled(enabled) {
    const isDirty = Boolean(enabled) && state.permissions.canEditBooking;
    setBookingSectionDirty("offer", isDirty);
    setBookingSectionDirty("payment_terms", isDirty);
  }

  const paymentTermsModule = createBookingOfferPaymentTermsModule({
    state,
    els,
    escapeHtml,
    setOfferSaveEnabled,
    setOfferStatus,
    clearOfferStatus,
    resolveOfferTotalCents: () => resolveOfferTotalCents(),
    renderOfferGenerationControls: () => {}
  });
  const offerPricingModule = createBookingOfferPricingModule({
    state,
    els,
    apiOrigin,
    fetchApi,
    fetchBookingMutation,
    escapeHtml,
    paymentTermsModule,
    defaultOfferTaxRateBasisPoints: DEFAULT_OFFER_TAX_RATE_BASIS_POINTS,
    offerCategories: OFFER_CATEGORIES,
    setOfferSaveEnabled,
    setOfferStatus,
    getCountMissingOfferPdfTranslations: countMissingOfferPdfTranslations,
    normalizeOfferCategory,
    normalizeOfferDetailLevel,
    isVisibleDetailLevelFinerThanInternal,
    cloneOfferPaymentTerms,
    updateOfferPanelSummary
  });
  offerSaveController = createBookingOfferSaveController({
    state,
    apiOrigin,
    fetchBookingMutation,
    getBookingRevision,
    clearOfferStatus,
    setOfferStatus,
    collectOfferPayload: () => offerPricingModule.collectOfferPayload(),
    applyOfferBookingResponse,
    debugOffer,
    clearPendingTotals: () => offerPricingModule.clearPendingTotals(),
    updateOfferTotalsInDom: () => offerPricingModule.updateOfferTotalsInDom(),
    logOfferPaymentTermDueTypeMismatch: (offer, booking) => paymentTermsModule.logOfferPaymentTermDueTypeMismatch(offer, booking),
    setOfferSaveEnabled
  });

  function cloneOfferPaymentTerms(rawPaymentTerms, fallbackCurrency) {
    const source = rawPaymentTerms && typeof rawPaymentTerms === "object" ? rawPaymentTerms : null;
    if (!source) return null;
    const lines = (Array.isArray(source.lines) ? source.lines : [])
      .map((line, index) => ({
        id: String(line?.id || ""),
        kind: String(line?.kind || "INSTALLMENT").trim().toUpperCase(),
        label: String(line?.label || "").trim(),
        sequence: Math.max(1, Number(line?.sequence || index + 1)),
        amount_spec: line?.amount_spec && typeof line.amount_spec === "object"
          ? {
              mode: String(line.amount_spec?.mode || "FIXED_AMOUNT").trim().toUpperCase(),
              ...(Number.isFinite(Number(line.amount_spec?.fixed_amount_cents))
                ? { fixed_amount_cents: Math.max(0, Math.round(Number(line.amount_spec.fixed_amount_cents))) }
                : {}),
              ...(Number.isFinite(Number(line.amount_spec?.percentage_basis_points))
                ? { percentage_basis_points: Math.max(0, Math.round(Number(line.amount_spec.percentage_basis_points))) }
                : {})
            }
          : { mode: "FIXED_AMOUNT" },
        resolved_amount_cents: Math.max(0, Math.round(Number(line?.resolved_amount_cents || 0))),
        due_rule: line?.due_rule && typeof line.due_rule === "object"
          ? {
              type: String(line.due_rule?.type || "ON_ACCEPTANCE").trim().toUpperCase(),
              ...(String(line.due_rule?.fixed_date || "").trim() ? { fixed_date: String(line.due_rule.fixed_date).trim() } : {}),
              ...(Number.isFinite(Number(line.due_rule?.days))
                ? { days: Math.max(0, Math.round(Number(line.due_rule.days))) }
                : {})
            }
          : { type: "ON_ACCEPTANCE" }
      }))
      .sort((left, right) => (left.sequence - right.sequence) || String(left.id || "").localeCompare(String(right.id || "")));
    return {
      currency: normalizeCurrencyCode(source.currency || fallbackCurrency || "USD"),
      basis_total_amount_cents: Math.max(0, Math.round(Number(source.basis_total_amount_cents || 0))),
      lines,
      scheduled_total_amount_cents: Number.isFinite(Number(source.scheduled_total_amount_cents))
        ? Math.max(0, Math.round(Number(source.scheduled_total_amount_cents)))
        : lines.reduce((sum, line) => sum + Math.max(0, Number(line?.resolved_amount_cents || 0)), 0)
    };
  }

  function computeLegacyOfferComponentAmounts(component) {
    const quantity = Math.max(1, Number(component?.quantity || 1));
    const unitAmountCents = Math.max(0, Number(component?.unit_amount_cents || 0));
    const taxRateBasisPoints = Number.isFinite(Number(component?.tax_rate_basis_points))
      ? Math.max(0, Math.round(Number(component.tax_rate_basis_points)))
      : DEFAULT_OFFER_TAX_RATE_BASIS_POINTS;
    const unitTaxAmountCents = Math.round((unitAmountCents * taxRateBasisPoints) / 10000);
    return {
      tax_rate_basis_points: taxRateBasisPoints,
      line_net_amount_cents: quantity * unitAmountCents,
      line_tax_amount_cents: quantity * unitTaxAmountCents,
      line_gross_amount_cents: quantity * (unitAmountCents + unitTaxAmountCents)
    };
  }

  function resolveLegacyAggregateTaxRateBasisPoints(lines) {
    const normalizedLines = Array.isArray(lines) ? lines : [];
    const populatedRates = normalizedLines
      .filter((line) => Number(line?.line_gross_amount_cents || 0) > 0)
      .map((line) => Math.max(0, Math.round(Number(line?.tax_rate_basis_points || 0))));
    const uniqueRates = [...new Set(populatedRates)];
    if (!uniqueRates.length) return 0;
    if (uniqueRates.length === 1) return uniqueRates[0];
    const netAmountCents = normalizedLines.reduce(
      (sum, line) => sum + Math.max(0, Math.round(Number(line?.line_net_amount_cents || 0))),
      0
    );
    const taxAmountCents = normalizedLines.reduce(
      (sum, line) => sum + Math.max(0, Math.round(Number(line?.line_tax_amount_cents || 0))),
      0
    );
    if (netAmountCents <= 0 || taxAmountCents <= 0) return 0;
    return Math.max(0, Math.round((taxAmountCents * 10000) / netAmountCents));
  }

  function aggregateLegacyOfferComponents(components, overrides = {}) {
    const normalizedLines = (Array.isArray(components) ? components : []).map((component) => computeLegacyOfferComponentAmounts(component));
    if (!normalizedLines.length) return null;
    return {
      ...overrides,
      amount_cents: normalizedLines.reduce(
        (sum, line) => sum + Math.max(0, Math.round(Number(line?.line_net_amount_cents || 0))),
        0
      ),
      tax_rate_basis_points: resolveLegacyAggregateTaxRateBasisPoints(normalizedLines),
      currency: normalizeCurrencyCode(overrides.currency || state.booking?.preferred_currency || "USD"),
      notes: String(overrides.notes || "").trim()
    };
  }

  function deriveLegacyOfferDaysInternal(source) {
    const sourceComponents = Array.isArray(source?.components) ? source.components : [];
    if (!sourceComponents.length) return [];
    if (!sourceComponents.every((component) => Number.isInteger(Number(component?.day_number)) && Number(component?.day_number) >= 1)) {
      return [];
    }
    const groupedByDay = new Map();
    sourceComponents.forEach((component) => {
      const dayNumber = Number(component.day_number);
      const existing = groupedByDay.get(dayNumber) || [];
      existing.push(component);
      groupedByDay.set(dayNumber, existing);
    });
    return Array.from(groupedByDay.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([dayNumber, components], index) => aggregateLegacyOfferComponents(components, {
        id: "",
        day_number: dayNumber,
        label: bookingT("booking.offer.day_number.day", "Day {day}", { day: dayNumber }),
        currency: normalizeCurrencyCode(source.currency || state.booking?.preferred_currency || "USD"),
        notes: "",
        sort_order: index
      }))
      .filter(Boolean);
  }

  function deriveLegacyOfferTripPriceInternal(source) {
    const sourceComponents = Array.isArray(source?.components) ? source.components : [];
    if (!sourceComponents.length) return null;
    return aggregateLegacyOfferComponents(sourceComponents, {
      label: String(source?.trip_price_internal?.label || "").trim(),
      currency: normalizeCurrencyCode(source.currency || state.booking?.preferred_currency || "USD"),
      notes: String(source?.trip_price_internal?.notes || "").trim()
    });
  }

  function cloneOffer(offer) {
    const source = offer && typeof offer === "object" ? offer : {};
    const paymentTerms = cloneOfferPaymentTerms(source.payment_terms, source.currency || state.booking?.preferred_currency || "USD");
    const sourceDiscounts = Array.isArray(source.discounts) && source.discounts.length
      ? source.discounts
      : (source.discount && typeof source.discount === "object" ? [source.discount] : (Array.isArray(source.discounts) ? source.discounts : []));
    const discounts = sourceDiscounts
      .map((discount, index) => ({
        id: String(discount?.id || ""),
        reason: String(discount?.reason || "").trim(),
        amount_cents: Math.max(0, Math.round(Number(discount?.amount_cents || 0))),
        currency: normalizeCurrencyCode(discount?.currency || source.currency || state.booking?.preferred_currency || "USD"),
        sort_order: Number.isFinite(Number(discount?.sort_order)) ? Number(discount.sort_order) : index
      }))
      .filter((discount) => discount.reason || discount.amount_cents > 0 || discount.id)
      .map((discount, index) => ({
        ...discount,
        id: discount.id || `offer_discount_${index + 1}`,
        sort_order: Number.isFinite(Number(discount.sort_order)) ? Number(discount.sort_order) : index
      }));
    const categoryRulesByCode = new Map(
      (Array.isArray(source.category_rules) ? source.category_rules : []).map((rule) => [
        String(rule?.category || "").toUpperCase(),
        {
          category: String(rule?.category || "").toUpperCase(),
          tax_rate_basis_points: Number(rule?.tax_rate_basis_points ?? DEFAULT_OFFER_TAX_RATE_BASIS_POINTS)
        }
      ])
    );

    const category_rules = OFFER_CATEGORIES.map((category) => {
      const existing = categoryRulesByCode.get(category.code);
      return {
        category: category.code,
        tax_rate_basis_points:
          Number.isFinite(Number(existing?.tax_rate_basis_points))
            ? Math.max(0, Math.round(Number(existing.tax_rate_basis_points)))
            : DEFAULT_OFFER_TAX_RATE_BASIS_POINTS
      };
    });

    const sourceDaysInternal = Array.isArray(source.days_internal) && source.days_internal.length
      ? source.days_internal
      : deriveLegacyOfferDaysInternal(source);
    const sourceAdditionalItems = (Array.isArray(source.additional_items) ? source.additional_items : []).filter((item) => (
      item
      && typeof item === "object"
      && (
        String(item.label || "").trim()
        || String(item.details || "").trim()
        || Math.max(0, Math.round(Number(item.unit_amount_cents || 0))) > 0
        || Math.max(1, Number(item.quantity || 1)) > 1
        || String(item.id || "").trim()
      )
    ));
    const internalDetailLevel = inferInternalOfferDetailLevel(source, "trip");
    const requestedVisibleDetailLevel = normalizeOfferDetailLevel(source.offer_detail_level_visible, internalDetailLevel);
    const visibleDetailLevel = isVisibleDetailLevelFinerThanInternal(requestedVisibleDetailLevel, internalDetailLevel)
      ? internalDetailLevel
      : requestedVisibleDetailLevel;

    return {
      status: normalizeOfferStatus(source.status),
      currency: normalizeCurrencyCode(source.currency || state.booking?.preferred_currency || "USD"),
      offer_detail_level_internal: internalDetailLevel,
      offer_detail_level_visible: visibleDetailLevel,
      category_rules,
      discounts,
      ...(paymentTerms ? { payment_terms: paymentTerms } : {}),
      ...(source.trip_price_internal && typeof source.trip_price_internal === "object"
        ? {
            trip_price_internal: {
              label: String(source.trip_price_internal?.label || "").trim(),
              amount_cents: Math.max(0, Math.round(Number(source.trip_price_internal?.amount_cents || 0))),
              tax_rate_basis_points: Number.isFinite(Number(source.trip_price_internal?.tax_rate_basis_points))
                ? Math.max(0, Math.round(Number(source.trip_price_internal.tax_rate_basis_points)))
                : DEFAULT_OFFER_TAX_RATE_BASIS_POINTS,
              currency: normalizeCurrencyCode(source.trip_price_internal?.currency || source.currency || state.booking?.preferred_currency || "USD"),
              notes: String(source.trip_price_internal?.notes || "").trim()
            }
          }
        : internalDetailLevel === "trip"
          ? { trip_price_internal: deriveLegacyOfferTripPriceInternal(source) }
        : {}),
      days_internal: sourceDaysInternal.map((dayPrice, index) => ({
        id: String(dayPrice?.id || ""),
        day_number: Number.isInteger(Number(dayPrice?.day_number)) && Number(dayPrice?.day_number) >= 1
          ? Number(dayPrice.day_number)
          : index + 1,
        label: String(dayPrice?.label || "").trim(),
        amount_cents: Math.max(0, Math.round(Number(dayPrice?.amount_cents || 0))),
        tax_rate_basis_points: Number.isFinite(Number(dayPrice?.tax_rate_basis_points))
          ? Math.max(0, Math.round(Number(dayPrice.tax_rate_basis_points)))
          : DEFAULT_OFFER_TAX_RATE_BASIS_POINTS,
        currency: normalizeCurrencyCode(dayPrice?.currency || source.currency || state.booking?.preferred_currency || "USD"),
        notes: String(dayPrice?.notes || "").trim(),
        sort_order: Number.isFinite(Number(dayPrice?.sort_order)) ? Number(dayPrice.sort_order) : index
      })),
      additional_items: sourceAdditionalItems.map((item, index) => ({
        id: String(item?.id || ""),
        label: String(item?.label || "").trim(),
        details: String(item?.details || "").trim(),
        day_number: Number.isInteger(Number(item?.day_number)) && Number(item?.day_number) >= 1
          ? Number(item.day_number)
          : null,
        quantity: Math.max(1, Number(item?.quantity || 1)),
        unit_amount_cents: Math.max(0, Math.round(Number(item?.unit_amount_cents || 0))),
        tax_rate_basis_points: Number.isFinite(Number(item?.tax_rate_basis_points))
          ? Math.max(0, Math.round(Number(item.tax_rate_basis_points)))
          : DEFAULT_OFFER_TAX_RATE_BASIS_POINTS,
        currency: normalizeCurrencyCode(item?.currency || source.currency || state.booking?.preferred_currency || "USD"),
        category: normalizeOfferCategory(item?.category || "OTHER"),
        notes: String(item?.notes || "").trim(),
        sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : index
      })),
      totals: source.totals || {
        net_amount_cents: 0,
        tax_amount_cents: 0,
        gross_amount_cents: 0,
        items_count: 0
      }
    };
  }

  function populateOfferDetailLevelSelect(select, selectedValue, { disableFinerThan = null } = {}) {
    if (!(select instanceof HTMLSelectElement)) return;
    const normalizedSelected = normalizeOfferDetailLevel(selectedValue);
    const html = OFFER_DETAIL_LEVEL_OPTIONS.map((option) => {
      const disabled = disableFinerThan
        ? isVisibleDetailLevelFinerThanInternal(option.value, disableFinerThan)
        : false;
      return `<option value="${option.value}"${option.value === normalizedSelected ? " selected" : ""}${disabled ? " disabled" : ""}>${option.label}</option>`;
    }).join("");
    select.innerHTML = html;
    if (Array.from(select.options).some((option) => option.value === normalizedSelected)) {
      select.value = normalizedSelected;
    }
  }

  function renderOfferDetailLevelPillGroup(container, target, selectedValue, { disableFinerThan = null } = {}) {
    if (!(container instanceof HTMLElement)) return;
    const normalizedSelected = normalizeOfferDetailLevel(selectedValue, "trip");
    const canEdit = Boolean(state.permissions.canEditBooking);
    container.innerHTML = OFFER_DETAIL_LEVEL_OPTIONS.map((option) => {
      const disabled = !canEdit || (disableFinerThan
        ? isVisibleDetailLevelFinerThanInternal(option.value, disableFinerThan)
        : false);
      const isActive = option.value === normalizedSelected;
      return `<button class="offer-detail-level-pill__button${isActive ? " is-active" : ""}" type="button" data-offer-detail-level-target="${target}" data-offer-detail-level-value="${option.value}" aria-pressed="${isActive ? "true" : "false"}"${disabled ? " disabled" : ""}>${escapeHtml(formatOfferDetailLevelLabel(option.value))}</button>`;
    }).join("");
  }

  function updateOfferVisiblePricingHint() {
    if (!els.offer_visible_pricing_hint) return;
    const internalDetailLevel = normalizeOfferDetailLevel(state.offerDraft?.offer_detail_level_internal, "trip");
    const visibleDetailLevel = normalizeOfferDetailLevel(state.offerDraft?.offer_detail_level_visible, internalDetailLevel);
    els.offer_visible_pricing_hint.textContent = bookingT(
      "booking.offer.visible_pricing_hint",
      "Customer documents will show {detailLevel} pricing. Adjustments stay visible as separate lines.",
      {
        detailLevel: OFFER_DETAIL_LEVEL_OPTIONS.find((option) => option.value === visibleDetailLevel)?.label.toLowerCase() || visibleDetailLevel
      }
    );
    els.offer_visible_pricing_hint.classList.remove("booking-inline-status--error");
    els.offer_visible_pricing_hint.classList.add("booking-inline-status--success");
  }

  function syncOfferDetailLevelControls() {
    const internalDetailLevel = normalizeOfferDetailLevel(state.offerDraft?.offer_detail_level_internal, "trip");
    const visibleDetailLevel = normalizeOfferDetailLevel(state.offerDraft?.offer_detail_level_visible, internalDetailLevel);
    populateOfferDetailLevelSelect(els.offer_detail_level_internal_input, internalDetailLevel);
    populateOfferDetailLevelSelect(els.offer_detail_level_visible_input, visibleDetailLevel, {
      disableFinerThan: internalDetailLevel
    });
    renderOfferDetailLevelPillGroup(els.offer_detail_level_internal_pill, "internal", internalDetailLevel);
    renderOfferDetailLevelPillGroup(els.offer_detail_level_visible_pill, "visible", visibleDetailLevel, {
      disableFinerThan: internalDetailLevel
    });
    if (els.offer_detail_level_internal_input) {
      els.offer_detail_level_internal_input.disabled = !state.permissions.canEditBooking;
    }
    if (els.offer_detail_level_visible_input) {
      els.offer_detail_level_visible_input.disabled = !state.permissions.canEditBooking;
    }
    updateOfferVisiblePricingHint();
  }

  function normalizeOfferCategory(value) {
    const normalized = String(value || "").trim().toUpperCase();
    return OFFER_CATEGORIES.some((category) => category.code === normalized) ? normalized : "OTHER";
  }

  function resolveOfferTotalCents() {
    return offerPricingModule.resolveOfferTotalCents();
  }

  function addOfferPricingRow() {
    return offerPricingModule.addOfferPricingRow();
  }

  function renderOfferPricingTable() {
    return offerPricingModule.renderOfferPricingTable();
  }

  function updateOfferTotalsInDom() {
    return offerPricingModule.updateOfferTotalsInDom();
  }

  function collectOfferPayload() {
    return offerPricingModule.collectOfferPayload();
  }

  async function applyOfferBookingResponse(response, { reloadActivities = false } = {}) {
    if (!response?.booking) return false;
    state.booking = response.booking;
    renderBookingHeader();
    renderBookingData();
    renderTravelPlanPanel?.();
    renderOfferPanel();
    renderPricingPanel?.({ markDerivedChangesDirty: true });
    if (reloadActivities) {
      await loadActivities();
    }
    return true;
  }

  function renderOfferPanel() {
    if (!els.offer_panel || !state.booking) return;
    const offer = cloneOffer(state.booking.offer || {});
    state.offerDraft = offer;
    offerPricingModule.resetOfferPricingUiState();
    debugOffer("render panel", {
      booking_id: state.booking.id,
      offer: {
        currency: offer.currency,
        discounts: Array.isArray(offer.discounts)
          ? offer.discounts.map((discount) => ({
              reason: discount.reason,
              amount_cents: discount.amount_cents
            }))
          : []
      }
    });
    const currency = normalizeCurrencyCode(offer.currency || state.booking.preferred_currency || "USD");
    state.offerDraft.currency = currency;

    if (els.offer_currency_input) {
      setSelectValue(els.offer_currency_input, currency);
      els.offer_currency_input.disabled = !isOfferCurrencyEditable();
      document.dispatchEvent(new CustomEvent("booking:offer-currency-sync"));
    }
    ensureOfferDetailLevelEventsBound();
    syncOfferDetailLevelControls();
    offerPricingModule.updateOfferCurrencyHint(currency);
    updateOfferPanelSummary(resolveOfferTotalCents(), currency);
    setOfferSaveEnabled(false);

    renderOfferPricingTable();
    clearOfferStatus();
  }

  async function saveOffer() {
    return offerSaveController?.saveOffer();
  }

  return {
    renderOfferPanel,
    addOfferPricingRow,
    handleOfferCurrencyChange: () => offerPricingModule.handleOfferCurrencyChange(),
    handleOfferInternalDetailLevelChange: () => {
      const nextValue = els.offer_detail_level_internal_input?.value;
      offerPricingModule.handleOfferInternalDetailLevelChange(nextValue);
      syncOfferDetailLevelControls();
    },
    handleOfferVisibleDetailLevelChange: () => {
      const nextValue = els.offer_detail_level_visible_input?.value;
      offerPricingModule.handleOfferVisibleDetailLevelChange(nextValue);
      syncOfferDetailLevelControls();
    },
    saveOffer
  };
}
