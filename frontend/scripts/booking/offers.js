import { GENERATED_OFFER_CATEGORIES as GENERATED_OFFER_CATEGORY_LIST } from "../../Generated/Models/generated_Booking.js";
import {
  formatMoneyDisplay,
  normalizeCurrencyCode,
  setSelectValue
} from "./pricing.js";
import { bookingT } from "./i18n.js";
import { renderBookingSectionHeader } from "./sections.js";
import { createBookingGeneratedOffersModule } from "./offer_generated_offers.js";
import { createBookingOfferComponentsModule } from "./offer_components.js";
import { createBookingOfferPaymentTermsModule } from "./offer_payment_terms.js";
import { createBookingOfferSaveController } from "./offer_save.js";
import {
  normalizeLocalizedEditorMap,
  resolveLocalizedEditorText
} from "./localized_editor.js";

const DEFAULT_OFFER_TAX_RATE_BASIS_POINTS = 1000;
const OFFER_PRICING_GRANULARITY_ORDER = Object.freeze({
  trip: 1,
  day: 2,
  component: 3
});
const OFFER_PRICING_GRANULARITY_OPTIONS = Object.freeze([
  { value: "component", label: "Per component" },
  { value: "day", label: "Per day" },
  { value: "trip", label: "Per trip" }
]);

const OFFER_CATEGORIES = GENERATED_OFFER_CATEGORY_LIST.map((code) => ({ code }));

const OFFER_COMPONENT_CATEGORIES = OFFER_CATEGORIES.filter((category) => category.code !== "DISCOUNTS_CREDITS");

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
    renderTravelPlanPanel,
    loadActivities,
    escapeHtml,
    setBookingSectionDirty
  } = ctx;

  let offerSaveController = null;

  function normalizeOfferStatus(value) {
    const normalized = String(value || "").trim().toUpperCase();
    return ["DRAFT", "APPROVED", "OFFER_SENT"].includes(normalized) ? normalized : "DRAFT";
  }

  function normalizeOfferPricingGranularity(value, fallback = "component") {
    const normalized = String(value || "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(OFFER_PRICING_GRANULARITY_ORDER, normalized) ? normalized : fallback;
  }

  function isVisibleGranularityFinerThanInternal(visible, internal) {
    return (OFFER_PRICING_GRANULARITY_ORDER[visible] || 0) > (OFFER_PRICING_GRANULARITY_ORDER[internal] || 0);
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

  function countMissingOfferPdfTranslations(booking, lang) {
    if (!booking || lang === "en") return 0;
    const normalizedLang = String(lang || "").trim().toLowerCase();
    const offerSummary = booking?.offer_translation_status;
    const travelPlanSummary = booking?.travel_plan_translation_status;
    if (offerSummary?.lang === normalizedLang || travelPlanSummary?.lang === normalizedLang) {
      return Number(offerSummary?.missing_fields || 0) + Number(travelPlanSummary?.missing_fields || 0);
    }
    let missing = 0;
    const considerField = (value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      if (!Object.values(value).some((candidate) => String(candidate || "").trim())) return;
      if (!String(value[lang] || "").trim()) missing += 1;
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

  function updateOfferPanelSummary(totalCents, currency) {
    renderBookingSectionHeader(els.offerPanelSummary, {
      primary: bookingT("booking.offer_total", "Offer {total}", { total: formatMoneyDisplay(totalCents, currency) })
    });
  }

  function setOfferSaveEnabled(enabled) {
    const isDirty = Boolean(enabled) && state.permissions.canEditBooking;
    setBookingSectionDirty("offer", isDirty);
    setBookingSectionDirty("payment_terms", isDirty);
  }

  function ensureOfferCleanState() {
    return offerSaveController?.ensureOfferCleanState() ?? Promise.resolve(true);
  }

  const paymentTermsModule = createBookingOfferPaymentTermsModule({
    state,
    els,
    escapeHtml,
    setOfferSaveEnabled,
    clearOfferStatus,
    resolveOfferTotalCents: () => resolveOfferTotalCents(),
    renderOfferGenerationControls: () => generatedOffersModule.renderOfferGenerationControls()
  });
  const generatedOffersModule = createBookingGeneratedOffersModule({
    state,
    els,
    apiOrigin,
    escapeHtml,
    fetchBookingMutation,
    getBookingRevision,
    applyOfferBookingResponse,
    countMissingOfferPdfTranslations,
    ensureOfferCleanState,
    setOfferStatus
  });
  const offerComponentsModule = createBookingOfferComponentsModule({
    state,
    els,
    apiOrigin,
    fetchApi,
    fetchBookingMutation,
    escapeHtml,
    paymentTermsModule,
    defaultOfferTaxRateBasisPoints: DEFAULT_OFFER_TAX_RATE_BASIS_POINTS,
    offerCategories: OFFER_CATEGORIES,
    offerComponentCategories: OFFER_COMPONENT_CATEGORIES,
    setOfferSaveEnabled,
    setOfferStatus,
    getCountMissingOfferPdfTranslations: countMissingOfferPdfTranslations,
    normalizeOfferCategory,
    normalizeOfferPricingGranularity,
    isVisibleGranularityFinerThanInternal,
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
    collectOfferPayload: () => offerComponentsModule.collectOfferPayload(),
    applyOfferBookingResponse,
    debugOffer,
    clearPendingTotals: () => offerComponentsModule.clearPendingTotals(),
    updateOfferTotalsInDom: () => offerComponentsModule.updateOfferTotalsInDom(),
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
          : { type: "ON_ACCEPTANCE" },
        ...(String(line?.description || "").trim() ? { description: String(line.description).trim() } : {})
      }))
      .sort((left, right) => (left.sequence - right.sequence) || String(left.id || "").localeCompare(String(right.id || "")));
    return {
      currency: normalizeCurrencyCode(source.currency || fallbackCurrency || "USD"),
      basis_total_amount_cents: Math.max(0, Math.round(Number(source.basis_total_amount_cents || 0))),
      lines,
      scheduled_total_amount_cents: Number.isFinite(Number(source.scheduled_total_amount_cents))
        ? Math.max(0, Math.round(Number(source.scheduled_total_amount_cents)))
        : lines.reduce((sum, line) => sum + Math.max(0, Number(line?.resolved_amount_cents || 0)), 0),
      ...(String(source.notes || "").trim() ? { notes: String(source.notes).trim() } : {})
    };
  }

  function cloneOffer(offer) {
    const source = offer && typeof offer === "object" ? offer : {};
    const paymentTerms = cloneOfferPaymentTerms(source.payment_terms, source.currency || state.booking?.preferred_currency || "USD");
    const discount = source.discount && typeof source.discount === "object"
      ? {
          reason: String(source.discount?.reason || "").trim(),
          amount_cents: Math.max(0, Math.round(Number(source.discount?.amount_cents || 0))),
          currency: normalizeCurrencyCode(source.discount?.currency || source.currency || state.booking?.preferred_currency || "USD")
        }
      : null;
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

    const sourceComponents = Array.isArray(source.components) ? source.components : [];
    const sourceDaysInternal = Array.isArray(source.days_internal) ? source.days_internal : [];
    const sourceAdditionalItems = Array.isArray(source.additional_items) ? source.additional_items : [];
    const pricingGranularityInternal = normalizeOfferPricingGranularity(source.pricing_granularity_internal, "component");
    const requestedVisibleGranularity = normalizeOfferPricingGranularity(source.pricing_granularity_visible, pricingGranularityInternal);
    const pricingGranularityVisible = isVisibleGranularityFinerThanInternal(requestedVisibleGranularity, pricingGranularityInternal)
      ? pricingGranularityInternal
      : requestedVisibleGranularity;

    return {
      status: normalizeOfferStatus(source.status),
      currency: normalizeCurrencyCode(source.currency || state.booking?.preferred_currency || "USD"),
      pricing_granularity_internal: pricingGranularityInternal,
      pricing_granularity_visible: pricingGranularityVisible,
      category_rules,
      ...(discount ? { discount } : {}),
      ...(paymentTerms ? { payment_terms: paymentTerms } : {}),
      components: sourceComponents.map((component, index) => ({
        id: String(component?.id || ""),
        category: normalizeOfferCategory(component?.category),
        label: String(component?.label || ""),
        details: resolveLocalizedEditorText(component?.details_i18n ?? component?.details ?? component?.description, "en", ""),
        details_i18n: normalizeLocalizedEditorMap(component?.details_i18n ?? component?.details ?? component?.description, "en"),
        day_number: Number.isInteger(Number(component?.day_number)) && Number(component?.day_number) >= 1
          ? Number(component.day_number)
          : null,
        quantity: Math.max(1, Number(component?.quantity || 1)),
        unit_amount_cents: Math.max(0, Number(component?.unit_amount_cents || 0)),
        tax_rate_basis_points: Number.isFinite(Number(component?.tax_rate_basis_points))
          ? Math.max(0, Math.round(Number(component.tax_rate_basis_points)))
          : DEFAULT_OFFER_TAX_RATE_BASIS_POINTS,
        currency: normalizeCurrencyCode(component?.currency || source.currency || state.booking?.preferred_currency || "USD"),
        notes: String(component?.notes || ""),
        sort_order: Number.isFinite(Number(component?.sort_order)) ? Number(component.sort_order) : index
      })),
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
        components_count: 0
      }
    };
  }

  function populateOfferGranularitySelect(select, selectedValue, { disableFinerThan = null } = {}) {
    if (!(select instanceof HTMLSelectElement)) return;
    const normalizedSelected = normalizeOfferPricingGranularity(selectedValue);
    const html = OFFER_PRICING_GRANULARITY_OPTIONS.map((option) => {
      const disabled = disableFinerThan
        ? isVisibleGranularityFinerThanInternal(option.value, disableFinerThan)
        : false;
      return `<option value="${option.value}"${option.value === normalizedSelected ? " selected" : ""}${disabled ? " disabled" : ""}>${option.label}</option>`;
    }).join("");
    select.innerHTML = html;
    if (Array.from(select.options).some((option) => option.value === normalizedSelected)) {
      select.value = normalizedSelected;
    }
  }

  function updateOfferVisiblePricingHint() {
    if (!els.offer_visible_pricing_hint) return;
    const internalGranularity = normalizeOfferPricingGranularity(state.offerDraft?.pricing_granularity_internal, "component");
    const visibleGranularity = normalizeOfferPricingGranularity(state.offerDraft?.pricing_granularity_visible, internalGranularity);
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
      {
        granularity: OFFER_PRICING_GRANULARITY_OPTIONS.find((option) => option.value === visibleGranularity)?.label.toLowerCase() || visibleGranularity
      }
    );
    els.offer_visible_pricing_hint.classList.remove("booking-inline-status--error");
    els.offer_visible_pricing_hint.classList.add("booking-inline-status--success");
  }

  function syncOfferGranularityControls() {
    const internalGranularity = normalizeOfferPricingGranularity(state.offerDraft?.pricing_granularity_internal, "component");
    const visibleGranularity = normalizeOfferPricingGranularity(state.offerDraft?.pricing_granularity_visible, internalGranularity);
    populateOfferGranularitySelect(els.offer_pricing_granularity_internal_input, internalGranularity);
    populateOfferGranularitySelect(els.offer_pricing_granularity_visible_input, visibleGranularity, {
      disableFinerThan: internalGranularity
    });
    if (els.offer_pricing_granularity_internal_input) {
      els.offer_pricing_granularity_internal_input.disabled = !state.permissions.canEditBooking;
    }
    if (els.offer_pricing_granularity_visible_input) {
      els.offer_pricing_granularity_visible_input.disabled = !state.permissions.canEditBooking;
    }
    updateOfferVisiblePricingHint();
  }

  function normalizeOfferCategory(value) {
    const normalized = String(value || "").trim().toUpperCase();
    return OFFER_CATEGORIES.some((category) => category.code === normalized) ? normalized : "OTHER";
  }

  function resolveOfferTotalCents() {
    return offerComponentsModule.resolveOfferTotalCents();
  }

  function addOfferComponent() {
    return offerComponentsModule.addOfferComponent();
  }

  function renderOfferComponentsTable() {
    return offerComponentsModule.renderOfferComponentsTable();
  }

  function updateOfferTotalsInDom() {
    return offerComponentsModule.updateOfferTotalsInDom();
  }

  function collectOfferPayload() {
    return offerComponentsModule.collectOfferPayload();
  }

  async function applyOfferBookingResponse(response, { reloadActivities = false } = {}) {
    if (!response?.booking) return false;
    state.booking = response.booking;
    renderBookingHeader();
    renderBookingData();
    renderTravelPlanPanel?.();
    renderOfferPanel();
    if (reloadActivities) {
      await loadActivities();
    }
    return true;
  }

  function renderOfferPanel() {
    if (!els.offer_panel || !state.booking) return;
    const offer = cloneOffer(state.booking.offer || {});
    state.offerDraft = offer;
    offerComponentsModule.resetComponentUiState();
    debugOffer("render panel", {
      booking_id: state.booking.id,
      offer: {
        currency: offer.currency,
        components: offer.components.map((component) => ({
          id: component.id,
          category: component.category,
          details: component.details,
          quantity: component.quantity,
          unit_amount_cents: component.unit_amount_cents
        })),
        discount: offer.discount
          ? {
              reason: offer.discount.reason,
              amount_cents: offer.discount.amount_cents
            }
          : null
      }
    });
    const currency = normalizeCurrencyCode(offer.currency || state.booking.preferred_currency || "USD");
    state.offerDraft.currency = currency;

    if (els.offer_currency_input) {
      setSelectValue(els.offer_currency_input, currency);
      els.offer_currency_input.disabled = !isOfferCurrencyEditable();
    }
    syncOfferGranularityControls();
    offerComponentsModule.updateOfferCurrencyHint(currency);
    updateOfferPanelSummary(resolveOfferTotalCents(), currency);
    generatedOffersModule.updateBookingConfirmationPanelSummary();
    setOfferSaveEnabled(false);

    renderOfferComponentsTable();
    generatedOffersModule.renderGeneratedOffersTable();
    clearOfferStatus();
  }

  async function saveOffer() {
    return offerSaveController?.saveOffer();
  }

  return {
    renderOfferPanel,
    addOfferComponent,
    handleOfferCurrencyChange: () => offerComponentsModule.handleOfferCurrencyChange(),
    handleOfferInternalGranularityChange: () => {
      const nextValue = els.offer_pricing_granularity_internal_input?.value;
      offerComponentsModule.handleOfferInternalGranularityChange(nextValue);
      syncOfferGranularityControls();
    },
    handleOfferVisibleGranularityChange: () => {
      const nextValue = els.offer_pricing_granularity_visible_input?.value;
      offerComponentsModule.handleOfferVisibleGranularityChange(nextValue);
      syncOfferGranularityControls();
    },
    saveOffer
  };
}
