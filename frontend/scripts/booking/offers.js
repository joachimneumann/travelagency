import { GENERATED_OFFER_CATEGORIES as GENERATED_OFFER_CATEGORY_LIST } from "../../Generated/Models/generated_Booking.js";
import {
  bookingGenerateOfferRequest,
  bookingGeneratedOfferDeleteRequest,
  bookingGeneratedOfferGmailDraftRequest,
  bookingGeneratedOfferUpdateRequest,
  bookingOfferRequest,
  offerExchangeRatesRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import {
  formatMoneyDisplay,
  formatMoneyInputValue,
  getCurrencyDefinitions,
  isWholeUnitCurrency,
  normalizeCurrencyCode,
  parseMoneyInputValue,
  setSelectValue
} from "./pricing.js";
import { BOOKING_CONTENT_LANGUAGE_OPTIONS, bookingContentLang, bookingContentLanguageOption, bookingLang, bookingT } from "./i18n.js";
import { getBookingPersons } from "../shared/booking_persons.js";
import { renderBookingSegmentHeader } from "./segment_headers.js";
import {
  buildDualLocalizedPayload,
  normalizeLocalizedEditorMap,
  renderLocalizedStackedField,
  requestBookingFieldTranslation,
  resolveLocalizedEditorBranchText,
  resolveLocalizedEditorText
} from "./localized_editor.js";

const DEFAULT_OFFER_TAX_RATE_BASIS_POINTS = 1000;
const GMAIL_TAB_NAME = "asiatravelplan_gmail_drafts";
let gmailWindowHandle = null;

function acquireGmailWindow() {
  if (gmailWindowHandle && !gmailWindowHandle.closed) {
    return { windowRef: gmailWindowHandle, openedNewWindow: false };
  }
  const windowRef = window.open("about:blank", GMAIL_TAB_NAME);
  if (!windowRef) {
    return { windowRef: null, openedNewWindow: false };
  }
  gmailWindowHandle = windowRef;
  try {
    windowRef.opener = null;
  } catch {
    // Ignore browsers that disallow modifying opener on a fresh tab.
  }
  return { windowRef, openedNewWindow: true };
}

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

  let offerAutosaveTimer = null;
  let offerAutosaveInFlight = false;
  let offerAutosavePending = false;
  let offerAutosavePromise = null;
  let offerPendingRowIndexes = new Set();
  let offerTotalPending = false;
  let offerCategoryEditorIndexes = new Set();
  let offerQuantityEditorIndexes = new Set();
  let offerTaxEditorIndexes = new Set();

  function normalizeOfferStatus(value) {
    const normalized = String(value || "").trim().toUpperCase();
    return ["DRAFT", "APPROVED", "OFFER_SENT"].includes(normalized) ? normalized : "DRAFT";
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

  function setOfferStatus(message) {
    if (!els.offer_status) return;
    els.offer_status.textContent = message;
  }

  function clearOfferStatus() {
    setOfferStatus("");
  }

  function bookingContentLanguageLabel(code) {
    const normalized = String(code || "").trim().toLowerCase();
    return BOOKING_CONTENT_LANGUAGE_OPTIONS.find((option) => option.code === normalized)?.label || normalized || "en";
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
      const segments = Array.isArray(day?.segments) ? day.segments : [];
      segments.forEach((segment) => {
        considerField(segment?.time_label_i18n);
        considerField(segment?.title_i18n);
        considerField(segment?.details_i18n);
        considerField(segment?.location_i18n);
      });
    });
    return missing;
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

  function updateOfferPanelSummary(totalCents, currency) {
    renderBookingSegmentHeader(els.offerPanelSummary, {
      primary: bookingT("booking.offer_total", "Offer {total}", { total: formatMoneyDisplay(totalCents, currency) })
    });
  }

  function setOfferSaveEnabled(enabled) {
    setBookingSectionDirty("offer", Boolean(enabled) && state.permissions.canEditBooking);
  }

  function formatGeneratedOfferDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(bookingLang(), {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function getBookingAcceptanceRecipientEmail() {
    const persons = getBookingPersons(state.booking);
    const primaryContact = persons.find((person) => Array.isArray(person?.roles) && person.roles.includes("primary_contact") && person.emails?.length)
      || persons.find((person) => person.emails?.length)
      || null;
    return String(primaryContact?.emails?.[0] || state.booking?.web_form_submission?.email || "").trim();
  }

  function findGeneratedOfferById(generatedOfferId) {
    return (Array.isArray(state.booking?.generated_offers) ? state.booking.generated_offers : []).find((item) => item?.id === generatedOfferId) || null;
  }

  function buildGeneratedOfferAcceptanceLink(generatedOffer) {
    const bookingId = String(state.booking?.id || "").trim();
    const generatedOfferId = String(generatedOffer?.id || "").trim();
    const token = String(generatedOffer?.public_acceptance_token || "").trim();
    if (!bookingId || !generatedOfferId || !token) return "";
    const url = new URL("/offer-accept.html", window.location.origin);
    url.searchParams.set("booking_id", bookingId);
    url.searchParams.set("generated_offer_id", generatedOfferId);
    url.searchParams.set("token", token);
    const lang = String(generatedOffer?.lang || state.booking?.customer_language || "").trim().toLowerCase();
    if (lang) {
      url.searchParams.set("lang", lang);
    }
    return url.toString();
  }

  async function copyGeneratedOfferAcceptanceLink(generatedOfferId) {
    const generatedOffer = findGeneratedOfferById(generatedOfferId);
    const acceptanceLink = buildGeneratedOfferAcceptanceLink(generatedOffer);
    if (!acceptanceLink) {
      setOfferStatus(bookingT("booking.offer.error.acceptance_link_unavailable", "Acceptance link is not available."));
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(acceptanceLink);
        setOfferStatus(bookingT("booking.offer.acceptance_link_copied", "Acceptance link copied."));
        return;
      }
      window.prompt(bookingT("booking.offer.copy_link_prompt", "Copy this acceptance link:"), acceptanceLink);
      setOfferStatus(bookingT("booking.offer.acceptance_link_copied", "Acceptance link copied."));
    } catch {
      setOfferStatus(bookingT("booking.offer.error.acceptance_link_copy", "Could not copy acceptance link."));
    }
  }

  function emailGeneratedOfferAcceptanceLink(generatedOfferId) {
    const generatedOffer = findGeneratedOfferById(generatedOfferId);
    const acceptanceLink = buildGeneratedOfferAcceptanceLink(generatedOffer);
    if (!acceptanceLink) {
      setOfferStatus(bookingT("booking.offer.error.acceptance_link_unavailable", "Acceptance link is not available."));
      return;
    }
    const recipientEmail = getBookingAcceptanceRecipientEmail();
    if (!recipientEmail) {
      setOfferStatus(bookingT("booking.offer.error.acceptance_link_email_missing", "Booking has no recipient email for the acceptance link."));
      return;
    }
    const bookingName = String(state.booking?.name || state.booking?.web_form_submission?.booking_name || state.booking?.id || "").trim();
    const totalLabel = formatMoneyDisplay(
      Number(generatedOffer?.total_price_cents || 0),
      generatedOffer?.currency || state.offerDraft?.currency || "USD"
    );
    const subject = bookingT("booking.offer.acceptance_email_subject", "Offer acceptance link for {booking}", {
      booking: bookingName || bookingT("booking.title", "Booking")
    });
    const body = bookingT(
      "booking.offer.acceptance_email_body",
      "Hello,\n\nplease review and accept your offer here:\n{link}\n\nOffer total: {total}\n\nBest regards,\nAsia Travel Plan",
      {
        link: acceptanceLink,
        total: totalLabel
      }
    );
    window.location.href = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setOfferStatus(bookingT("booking.offer.acceptance_email_opening", "Opening your mail client..."));
  }

  function defaultOfferCategoryRules() {
    return OFFER_CATEGORIES.map((category) => ({
      category: category.code,
      tax_rate_basis_points: DEFAULT_OFFER_TAX_RATE_BASIS_POINTS
    }));
  }

  function cloneOffer(offer) {
    const source = offer && typeof offer === "object" ? offer : {};
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

    return {
      status: normalizeOfferStatus(source.status),
      currency: normalizeCurrencyCode(source.currency || state.booking?.preferred_currency || "USD"),
      category_rules,
      components: sourceComponents.map((component, index) => ({
        id: String(component?.id || ""),
        category: normalizeOfferCategory(component?.category),
        label: String(component?.label || ""),
        details: resolveLocalizedEditorText(component?.details_i18n ?? component?.details ?? component?.description, "en", ""),
        details_i18n: normalizeLocalizedEditorMap(component?.details_i18n ?? component?.details ?? component?.description, "en"),
        quantity: Math.max(1, Number(component?.quantity || 1)),
        unit_amount_cents: Math.max(0, Number(component?.unit_amount_cents || 0)),
        tax_rate_basis_points: Number.isFinite(Number(component?.tax_rate_basis_points))
          ? Math.max(0, Math.round(Number(component.tax_rate_basis_points)))
          : DEFAULT_OFFER_TAX_RATE_BASIS_POINTS,
        currency: normalizeCurrencyCode(component?.currency || source.currency || state.booking?.preferred_currency || "USD"),
        notes: String(component?.notes || ""),
        sort_order: Number.isFinite(Number(component?.sort_order)) ? Number(component.sort_order) : index
      })),
      totals: source.totals || {
        net_amount_cents: 0,
        tax_amount_cents: 0,
        gross_amount_cents: 0,
        components_count: 0
      }
    };
  }

  function normalizeOfferCategory(value) {
    const normalized = String(value || "").trim().toUpperCase();
    return OFFER_CATEGORIES.some((category) => category.code === normalized) ? normalized : "OTHER";
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

  function getOfferCategoryTaxRateBasisPoints(category) {
    const normalizedCategory = normalizeOfferCategory(category);
    const rule = Array.isArray(state.offerDraft?.category_rules)
      ? state.offerDraft.category_rules.find((componentRule) => normalizeOfferCategory(componentRule?.category) === normalizedCategory)
      : null;
    const basisPoints = Number(rule?.tax_rate_basis_points ?? DEFAULT_OFFER_TAX_RATE_BASIS_POINTS);
    return Number.isFinite(basisPoints) ? Math.max(0, Math.round(basisPoints)) : DEFAULT_OFFER_TAX_RATE_BASIS_POINTS;
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

  function formatTaxRateLabel(basisPoints) {
    const numeric = Math.max(0, Number(basisPoints || 0)) / 100;
    const text = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, "");
    return bookingT("booking.offer.tax_rate_label", "Tax {rate}%", { rate: text });
  }

  function formatTaxRateInputValue(basisPoints) {
    const numeric = Math.max(0, Number(basisPoints || 0)) / 100;
    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, "");
  }

  function applyOfferCategoryTaxRate(category, percentValue) {
    const normalizedCategory = normalizeOfferCategory(category);
    const numericPercent = Number(percentValue);
    const basisPoints = Number.isFinite(numericPercent)
      ? Math.max(0, Math.round(numericPercent * 100))
      : DEFAULT_OFFER_TAX_RATE_BASIS_POINTS;
    const nextRules = Array.isArray(state.offerDraft?.category_rules)
      ? state.offerDraft.category_rules.map((rule) => ({
          ...rule,
          tax_rate_basis_points:
            normalizeOfferCategory(rule?.category) === normalizedCategory
              ? basisPoints
              : Math.max(0, Math.round(Number(rule?.tax_rate_basis_points ?? DEFAULT_OFFER_TAX_RATE_BASIS_POINTS)))
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
          : Math.max(0, Math.round(Number(component?.tax_rate_basis_points ?? DEFAULT_OFFER_TAX_RATE_BASIS_POINTS)))
    }));
  }

  function computeOfferDraftTotalsFromComponents(components) {
    const normalizedComponents = Array.isArray(components) ? components : [];
    let net_amount_cents = 0;
    let tax_amount_cents = 0;
    for (const component of normalizedComponents) {
      const line = computeOfferComponentLineTotals(component);
      net_amount_cents += line.net_amount_cents;
      tax_amount_cents += line.tax_amount_cents;
    }
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    return {
      currency,
      net_amount_cents,
      tax_amount_cents,
      gross_amount_cents: net_amount_cents + tax_amount_cents,
      components_count: normalizedComponents.length
    };
  }

  function computeOfferDraftQuotationSummary(components) {
    const normalizedComponents = Array.isArray(components) ? components : [];
    const totals = computeOfferDraftTotalsFromComponents(normalizedComponents);
    const buckets = new Map();
    normalizedComponents.forEach((component) => {
      const line = computeOfferComponentLineTotals(component);
      if (!line.net_amount_cents && !line.tax_amount_cents && !line.gross_amount_cents) return;
      const basisPoints = Math.max(0, Number(component?.tax_rate_basis_points || 0));
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
    return {
      tax_included: true,
      subtotal_net_amount_cents: totals.net_amount_cents,
      total_tax_amount_cents: totals.tax_amount_cents,
      grand_total_amount_cents: totals.gross_amount_cents,
      tax_breakdown: Array.from(buckets.values()).sort((left, right) => left.tax_rate_basis_points - right.tax_rate_basis_points)
    };
  }

  function renderOfferQuotationSummary() {
    if (!els.offer_quotation_summary) return;
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    const components = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [];
    if (!components.length) {
      els.offer_quotation_summary.hidden = true;
      els.offer_quotation_summary.innerHTML = "";
      return;
    }
    const summary = computeOfferDraftQuotationSummary(components);
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

  function resolveOfferTotalCents() {
    const explicitTotal = Number(state.offerDraft?.total_price_cents);
    if (Number.isFinite(explicitTotal)) {
      return Math.round(explicitTotal);
    }
    const offerComponents = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [];
    const offerTotals = computeOfferDraftTotalsFromComponents(offerComponents);
    return offerTotals?.gross_amount_cents || 0;
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
      const quantityRaw = Number(quantityInput?.value || fallbackComponent?.quantity || "1");
      const quantity = Number.isFinite(quantityRaw) && quantityRaw >= 1 ? Math.round(quantityRaw) : 1;
      const taxRateBasisPoints = getOfferCategoryTaxRateBasisPoints(category);
      const displayAmountRaw = totalInput?.value ?? unitInput?.value ?? "0";
      const displayedAmount = parseMoneyInputValue(displayAmountRaw, currency);
      const detailsPayload = buildDualLocalizedPayload(englishDetails, localizedDetails, targetLang);
      return {
        id: String(fallbackComponent.id || ""),
        category,
        label: String(fallbackComponent.label || ""),
        details: detailsPayload.text || null,
        details_i18n: detailsPayload.map,
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

  function addOfferComponent() {
    if (!state.permissions.canEditBooking || !state.offerDraft) return;
    const category = normalizeOfferCategory("OTHER");
    const nextIndex = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components.length : 0;
    debugOffer("add component:start", {
      booking_id: state.booking?.id || "",
      normalized_category: category,
      components_before: Array.isArray(state.offerDraft?.components) ? state.offerDraft.components.length : 0
    });
    state.offerDraft.components.push({
      id: "",
      category,
      label: "",
      details: "",
      details_i18n: {},
      quantity: 1,
      unit_amount_cents: 0,
      tax_rate_basis_points: getOfferCategoryTaxRateBasisPoints(category),
      currency: state.offerDraft.currency,
      notes: "",
      sort_order: state.offerDraft.components.length
    });
    offerCategoryEditorIndexes.add(nextIndex);
    debugOffer("add component:after push", {
      components: state.offerDraft.components.map((component) => ({
        id: component.id,
        category: component.category,
        details: component.details,
        quantity: component.quantity,
        unit_amount_cents: component.unit_amount_cents
      }))
    });
    setOfferSaveEnabled(true);
    renderOfferComponentsTable();
  }

  function renderOfferPanel() {
    if (!els.offer_panel || !state.booking) return;
    const offer = cloneOffer(state.booking.offer || {});
    state.offerDraft = offer;
    offerPendingRowIndexes = new Set();
    offerTotalPending = false;
    offerCategoryEditorIndexes = new Set();
    offerQuantityEditorIndexes = new Set();
    offerTaxEditorIndexes = new Set();
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
        }))
      }
    });
    const currency = normalizeCurrencyCode(offer.currency || state.booking.preferred_currency || "USD");
    state.offerDraft.currency = currency;

    if (els.offer_currency_input) {
      setSelectValue(els.offer_currency_input, currency);
      els.offer_currency_input.disabled = !isOfferCurrencyEditable();
    }
    updateOfferCurrencyHint(currency);
    updateOfferPanelSummary(resolveOfferTotalCents(), currency);
    setOfferSaveEnabled(false);

    renderOfferComponentsTable();
    renderGeneratedOffersTable();
    clearOfferStatus();
  }

  function renderGeneratedOffersTable() {
    if (!els.generated_offers_table) return;
    const items = Array.isArray(state.booking?.generated_offers) ? state.booking.generated_offers : [];
    const canEdit = state.permissions.canEditBooking;
    const emailActionEnabled = canEdit && Boolean(state.booking?.generated_offer_email_enabled);
    const acceptanceLinkHeader = canEdit
      ? `<th class="generated-offers-col-acceptance">${escapeHtml(bookingT("booking.offer.acceptance_link", "Accept link"))}</th>`
      : "";
    const emailHeader = emailActionEnabled ? `<th class="generated-offers-col-email">${escapeHtml(bookingT("booking.email", "Email"))}</th>` : "";
    const actionHeader = canEdit ? '<th class="generated-offers-col-actions"></th>' : "";
    const emptyColspan = 5 + (emailActionEnabled ? 1 : 0) + (canEdit ? 2 : 0);
    const rows = items.length
      ? items
        .slice()
        .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))
        .map((item) => {
          const pdfUrl = String(item.pdf_url || "").trim();
          const acceptanceLink = buildGeneratedOfferAcceptanceLink(item);
          const recipientEmail = getBookingAcceptanceRecipientEmail();
          return `<tr>
          <td class="generated-offers-col-link">${pdfUrl ? `<a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener">${escapeHtml(bookingT("booking.pdf", "PDF"))}</a>` : "-"}</td>
          ${emailActionEnabled
            ? `<td class="generated-offers-col-email"><button class="btn btn-ghost" type="button" data-generated-offer-email="${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.email", "Email"))}</button></td>`
            : ""}
          ${canEdit
            ? `<td class="generated-offers-col-acceptance">${acceptanceLink
              ? `<div class="generated-offers-link-actions">
                  <button class="btn btn-ghost" type="button" data-generated-offer-copy-link="${escapeHtml(item.id)}">${escapeHtml(bookingT("booking.offer.copy_link", "Copy link"))}</button>
                  <button class="btn btn-ghost" type="button" data-generated-offer-email-link="${escapeHtml(item.id)}"${recipientEmail ? "" : " disabled"}>${escapeHtml(bookingT("booking.offer.email_link", "Email link"))}</button>
                </div>`
              : "-"}</td>`
            : ""}
          <td class="generated-offers-col-language">${escapeHtml(bookingContentLanguageLabel(item.lang || "en"))}</td>
          <td class="generated-offers-col-total">${escapeHtml(formatMoneyDisplay(item.total_price_cents || 0, item.currency || state.offerDraft?.currency || "USD"))}</td>
          <td class="generated-offers-col-date">${escapeHtml(formatGeneratedOfferDate(item.created_at))}</td>
          <td class="generated-offers-col-comment">${canEdit
            ? `<textarea id="generated_offer_comment_${escapeHtml(item.id)}" name="generated_offer_comment_${escapeHtml(item.id)}" data-generated-offer-comment="${escapeHtml(item.id)}" rows="1">${escapeHtml(item.comment || "")}</textarea>`
            : (escapeHtml(item.comment || "") || "-")}</td>
          ${canEdit
            ? `<td class="generated-offers-col-actions"><button class="btn btn-ghost offer-remove-btn" type="button" data-generated-offer-delete="${escapeHtml(item.id)}" title="${escapeHtml(bookingT("booking.offer.delete_generated", "Delete generated offer"))}" aria-label="${escapeHtml(bookingT("booking.offer.delete_generated", "Delete generated offer"))}">×</button></td>`
            : ""}
        </tr>`;
        })
        .join("")
      : `<tr><td colspan="${emptyColspan}">${escapeHtml(bookingT("booking.offer.no_generated", "No generated offers yet"))}</td></tr>`;
    els.generated_offers_table.innerHTML = `<thead><tr><th class="generated-offers-col-link">${escapeHtml(bookingT("booking.pdf", "PDF"))}</th>${emailHeader}${acceptanceLinkHeader}<th class="generated-offers-col-language">${escapeHtml(bookingT("booking.language", "Language"))}</th><th class="generated-offers-col-total">${escapeHtml(bookingT("booking.total", "Total"))}</th><th class="generated-offers-col-date">${escapeHtml(bookingT("booking.date", "Date"))}</th><th>${escapeHtml(bookingT("booking.comments", "Comments"))}</th>${actionHeader}</tr></thead><tbody>${rows}</tbody>`;

    if (canEdit) {
      els.generated_offers_table.querySelectorAll("[data-generated-offer-comment]").forEach((input) => {
        input.addEventListener("change", () => {
          void saveGeneratedOfferComment(input.getAttribute("data-generated-offer-comment"), input.value);
        });
      });
      els.generated_offers_table.querySelectorAll("[data-generated-offer-delete]").forEach((button) => {
        button.addEventListener("click", () => {
          void deleteGeneratedOffer(button.getAttribute("data-generated-offer-delete"));
        });
      });
      els.generated_offers_table.querySelectorAll("[data-generated-offer-email]").forEach((button) => {
        button.addEventListener("click", () => {
          void createGeneratedOfferGmailDraft(button.getAttribute("data-generated-offer-email"));
        });
      });
      els.generated_offers_table.querySelectorAll("[data-generated-offer-copy-link]").forEach((button) => {
        button.addEventListener("click", () => {
          void copyGeneratedOfferAcceptanceLink(button.getAttribute("data-generated-offer-copy-link"));
        });
      });
      els.generated_offers_table.querySelectorAll("[data-generated-offer-email-link]").forEach((button) => {
        button.addEventListener("click", () => {
          emailGeneratedOfferAcceptanceLink(button.getAttribute("data-generated-offer-email-link"));
        });
      });
    }

    if (els.generate_offer_btn) {
      els.generate_offer_btn.style.display = state.permissions.canEditBooking ? "" : "none";
      els.generate_offer_btn.onclick = state.permissions.canEditBooking ? () => {
        void handleGenerateOffer();
      } : null;
    }
  }

  async function saveGeneratedOfferComment(generatedOfferId, value) {
    if (!state.permissions.canEditBooking || !state.booking?.id || !generatedOfferId) return;
    if (!(await flushOfferAutosave())) return;
    const request = bookingGeneratedOfferUpdateRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        generated_offer_id: generatedOfferId
      }
    });
    const response = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_offer_revision: getBookingRevision("offer_revision"),
        comment: String(value || "").trim() || null
      }
    });
    if (await applyOfferBookingResponse(response)) return;
    if (!response) return;
    setOfferStatus(response?.detail || response?.error || bookingT("booking.offer.error.update_comment", "Could not update generated offer comment."));
  }

  async function deleteGeneratedOffer(generatedOfferId) {
    if (!state.permissions.canEditBooking || !state.booking?.id || !generatedOfferId) return;
    if (!window.confirm(bookingT("booking.offer.delete_generated_confirm", "Delete this generated offer?"))) return;
    if (!(await flushOfferAutosave())) return;
    const request = bookingGeneratedOfferDeleteRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        generated_offer_id: generatedOfferId
      }
    });
    const response = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_offer_revision: getBookingRevision("offer_revision")
      }
    });
    if (await applyOfferBookingResponse(response)) return;
    if (!response) return;
    setOfferStatus(response?.detail || response?.error || bookingT("booking.offer.error.delete_generated", "Could not delete generated offer."));
  }

  async function createGeneratedOfferGmailDraft(generatedOfferId) {
    if (!state.permissions.canEditBooking || !state.booking?.id || !generatedOfferId) return;
    if (!state.booking?.generated_offer_email_enabled) {
      setOfferStatus(bookingT("booking.offer.gmail_not_configured", "Gmail draft creation is not configured for this environment."));
      return;
    }
    const { windowRef: draftWindow, openedNewWindow } = acquireGmailWindow();
    setOfferStatus(bookingT("booking.offer.creating_gmail_draft", "Creating Gmail draft..."));
    const request = bookingGeneratedOfferGmailDraftRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        generated_offer_id: generatedOfferId
      }
    });
    const response = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        actor: state.user || null
      }
    });
    if (response?.gmail_draft_url) {
      if (draftWindow) {
        draftWindow.location = response.gmail_draft_url;
        setOfferStatus(response.warning || "");
        return;
      }
      const fallbackTab = window.open(response.gmail_draft_url, GMAIL_TAB_NAME);
      if (fallbackTab) {
        gmailWindowHandle = fallbackTab;
        try {
          fallbackTab.opener = null;
        } catch {
          // Ignore browsers that disallow modifying opener on a fresh tab.
        }
        setOfferStatus(response.warning || "");
        return;
      }
      setOfferStatus(bookingT("booking.offer.gmail_popup_blocked", "Gmail draft created, but your browser blocked opening a new tab. Allow pop-ups and try again."));
      return;
    }
    if (draftWindow && openedNewWindow) {
      draftWindow.close();
      gmailWindowHandle = null;
    }
    if (!response) {
      setOfferStatus("");
      return;
    }
    setOfferStatus(response?.detail || response?.error || bookingT("booking.offer.error.create_gmail_draft", "Could not create Gmail draft."));
  }

  async function handleGenerateOffer() {
    if (!state.permissions.canEditBooking || !state.booking?.id) return;
    if (!(await flushOfferAutosave())) return;
    const selectedLang = bookingContentLang();
    const missingTranslationCount = countMissingOfferPdfTranslations(state.booking, selectedLang);
    if (missingTranslationCount > 0 && !window.confirm(bookingT(
      "booking.offer.generate_missing_translation_confirm",
      "Customer language is {language}, but {count} offer or travel-plan fields are not translated yet. The PDF shell will use {language}, and those fields will fall back to English. Generate anyway?",
      {
        language: bookingContentLanguageLabel(selectedLang),
        count: missingTranslationCount
      }
    ))) {
      return;
    }
    const request = bookingGenerateOfferRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id }
    });
    const commentInput = window.prompt(bookingT("booking.offer.comment_prompt", "Comment for this generated offer (optional):"), "");
    if (commentInput === null) return;
    const normalizedComment = String(commentInput || "").trim();
    setOfferStatus(bookingT("booking.offer.generating_pdf", "Generating offer PDF..."));
    const response = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_offer_revision: getBookingRevision("offer_revision"),
        comment: normalizedComment || null,
        lang: selectedLang
      }
    });
    if (await applyOfferBookingResponse(response, { reloadActivities: true })) {
      clearOfferStatus();
      return;
    }
    if (!response) {
      setOfferStatus("");
      return;
    }
    setOfferStatus(response?.detail || response?.error || bookingT("booking.offer.error.generate_pdf", "Could not generate offer PDF."));
  }

  async function flushOfferAutosave() {
    if (offerAutosaveTimer) {
      window.clearTimeout(offerAutosaveTimer);
      offerAutosaveTimer = null;
      const result = await saveOffer();
      return Boolean(result?.booking);
    }
    if (offerAutosaveInFlight && offerAutosavePromise) {
      const result = await offerAutosavePromise;
      return Boolean(result?.booking);
    }
    if (offerAutosavePending) {
      offerAutosavePending = false;
      const result = await saveOffer();
      return Boolean(result?.booking);
    }
    return true;
  }

  function renderOfferComponentsTable() {
    if (!els.offer_components_table) return;
    const readOnly = !state.permissions.canEditBooking;
    const showActionsCol = !readOnly;
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const offerComponents = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [];
    const showDualPrice = true;
    const priceHeaders = showDualPrice
      ? `<th class="offer-col-price-single">${escapeHtml(bookingT("booking.offer.unit", "Unit"))}</th><th class="offer-col-price-total">${escapeHtml(bookingT("booking.offer.total", "Total"))}</th>`
      : `<th class="offer-col-price-total">${escapeHtml(bookingT("booking.offer.total_currency", "Total ({currency})", { currency }))}</th>`;
    const actionHeader = showActionsCol ? '<th class="offer-col-actions"></th>' : "";
    const header = `<thead><tr><th class="offer-col-category">${escapeHtml(bookingT("booking.offer.category", "Offer category"))}</th><th class="offer-col-details">${escapeHtml(bookingT("booking.offer.details", "Offer details"))}</th><th class="offer-col-qty">${escapeHtml(bookingT("booking.offer.quantity", "Quantity"))}</th>${priceHeaders}${actionHeader}</tr></thead>`;
    const rows = offerComponents
      .map((component, index) => {
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
          ? `<select id="offer_component_category_${index}" name="offer_component_category_${index}" data-offer-component-category="${index}" ${readOnly ? "disabled" : ""}>${OFFER_COMPONENT_CATEGORIES.map((option) => `<option value="${escapeHtml(option.code)}" ${option.code === category ? "selected" : ""}>${escapeHtml(offerCategoryLabel(option.code))}</option>`).join("")}</select>`
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
      <td class="offer-col-category">
        <div>${categoryCellContent}</div>
      </td>
      <td class="offer-col-details">${renderOfferLocalizedDetailsField(component, index)}</td>
      <td class="offer-col-qty">${quantityCellContent}</td>
      ${priceCells}${actionCell}
    </tr>`;
      })
      .join("");
    const offerTotalValue = formatMoneyDisplay(resolveOfferTotalCents(), currency);
    updateOfferPanelSummary(resolveOfferTotalCents(), currency);
    const addButtonCell = !readOnly
      ? `<td class="offer-col-category"></td><td class="offer-add-cell"><button class="btn btn-ghost booking-offer-add-btn" type="button" data-offer-add-component>${escapeHtml(bookingT("common.new", "New"))}</button></td>`
      : `<td class="offer-col-category"></td><td class="offer-col-details"></td>`;
    const totalLabelCols = `<td colspan="2" class="offer-total-merged"><div class="offer-total-sum"><strong class="offer-total-label">${escapeHtml(bookingT("booking.offer.total_including_tax", "Total (including tax)"))}:</strong></div></td>`;
    const totalValueCol = `<td class="offer-col-price-total offer-total-final"><div class="offer-total-cell"><strong class="offer-price-value offer-total-value">${escapeHtml(offerTotalValue)}</strong></div></td>`;
    const totalRow = `<tr class="offer-total-row">${addButtonCell}${totalLabelCols}${totalValueCol}${showActionsCol ? '<td class="offer-col-actions"></td>' : ""}</tr>`;
    els.offer_components_table.innerHTML = `${header}<tbody>${rows}${totalRow}</tbody>`;
    renderOfferQuotationSummary();

    if (!readOnly) {
      const syncOfferInputTotals = () => {
        state.offerDraft.components = readOfferDraftComponentsForRender();
        state.offerDraft.total_price_cents = null;
        setOfferSaveEnabled(true);
        updateOfferTotalsInDom();
      };
      const syncOfferAndAutosave = () => {
        syncOfferInputTotals();
        scheduleOfferAutosave();
      };
      els.offer_components_table.querySelectorAll("[data-offer-remove-component]").forEach((button) => {
        button.addEventListener("click", async () => {
          const index = Number(button.getAttribute("data-offer-remove-component"));
          const component = state.offerDraft.components[index];
          const categoryLabel = offerCategoryLabel(component?.category);
          const detailsLabel = String(component?.details || component?.description || "").trim() || bookingT("booking.no_details", "No details");
          const totalLabel = formatMoneyDisplay(
            computeOfferComponentLineTotals(component).gross_amount_cents,
            currency
          );
          const confirmationMessage = [
            bookingT("booking.offer.remove_component_confirm", "Remove this offer component?"),
            "",
            bookingT("booking.offer.confirm_category", "Category: {value}", { value: categoryLabel }),
            bookingT("booking.offer.confirm_details", "Details: {value}", { value: detailsLabel }),
            bookingT("booking.offer.confirm_total", "Total: {value}", { value: totalLabel })
          ].join("\n");
          if (!window.confirm(confirmationMessage)) {
            return;
          }
          state.offerDraft.components.splice(index, 1);
          offerCategoryEditorIndexes = new Set();
          offerQuantityEditorIndexes = new Set();
          offerTaxEditorIndexes = new Set();
          setOfferSaveEnabled(true);
          renderOfferComponentsTable();
          await saveOffer();
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
          scheduleOfferAutosave();
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
          scheduleOfferAutosave();
        });
      });
      els.offer_components_table.querySelectorAll("[data-offer-component-details]").forEach((input) => {
        input.addEventListener("change", syncOfferAndAutosave);
      });
      els.offer_components_table.querySelectorAll("[data-offer-component-quantity], [data-offer-component-unit], [data-offer-component-total-input]").forEach((input) => {
        input.addEventListener("input", () => {
          const index = Number(
            input.getAttribute("data-offer-component-quantity")
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
        input.addEventListener("change", syncOfferAndAutosave);
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
          scheduleOfferAutosave();
        });
      });
    }
  }

  function updateOfferTotalsInDom() {
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
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
    const totalValueNode = document.querySelector(".offer-total-value");
    if (totalValueNode) {
      totalValueNode.textContent = `${offerTotalPending ? formatPendingMoneyDisplay(currency) : formatMoneyDisplay(resolveOfferTotalCents(), currency)}`;
    }
    renderOfferQuotationSummary();
  }

  function scheduleOfferAutosave() {
    if (!state.permissions.canEditBooking) return;
    if (offerAutosaveInFlight) {
      offerAutosavePending = true;
      return;
    }
    if (offerAutosaveTimer) window.clearTimeout(offerAutosaveTimer);
    offerAutosaveTimer = window.setTimeout(() => {
      offerAutosaveTimer = null;
      void saveOffer();
    }, 350);
  }

  function collectOfferCategoryRules() {
    const defaults = defaultOfferCategoryRules();
    const byCategory = new Map(
      (Array.isArray(state.offerDraft?.category_rules) ? state.offerDraft.category_rules : []).map((rule) => [
        normalizeOfferCategory(rule?.category),
        rule
      ])
    );
    return OFFER_CATEGORIES.map((category) => {
      const override = byCategory.get(category.code);
      const raw = override?.tax_rate_basis_points;
      const taxRateBasisPoints = Number.isFinite(Number(raw))
        ? Math.max(0, Math.round(Number(raw)))
        : defaults.find((entry) => entry.category === category.code)?.tax_rate_basis_points || DEFAULT_OFFER_TAX_RATE_BASIS_POINTS;
      return {
        category: category.code,
        tax_rate_basis_points: taxRateBasisPoints
      };
    });
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
        quantity: Math.round(quantity),
        unit_amount_cents: Math.round(unitAmount),
        tax_rate_basis_points: taxRateBasisPoints,
        currency,
        notes: notes || null,
        sort_order: index
      });
    }
    debugOffer("collect components", {
      booking_id: state.booking?.id || "",
      currency,
      components: components.map((component) => ({
        id: component.id,
        category: component.category,
        details: component.details,
        quantity: component.quantity,
        unit_amount_cents: component.unit_amount_cents,
        tax_rate_basis_points: component.tax_rate_basis_points
      }))
    });
    return components;
  }

  function collectOfferPayload() {
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const category_rules = collectOfferCategoryRules();
    const components = collectOfferComponents();
    const payload = {
      status: normalizeOfferStatus(state.offerDraft.status || state.booking?.offer?.status),
      currency,
      category_rules,
      components
    };
    debugOffer("collect payload", payload);
    return payload;
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

  async function handleOfferCurrencyChange() {
    if (!state.booking || !state.offerDraft || !els.offer_currency_input) return;
    if (!isOfferCurrencyEditable()) {
      setSelectValue(els.offer_currency_input, normalizeCurrencyCode(state.offerDraft.currency || "USD"));
      return;
    }

    const nextCurrency = normalizeCurrencyCode(els.offer_currency_input.value);
    const currentCurrency = normalizeCurrencyCode(state.offerDraft.currency || state.booking.preferred_currency || "USD");
    if (!nextCurrency || nextCurrency === currentCurrency) {
      setSelectValue(els.offer_currency_input, currentCurrency);
      return;
    }

    let components;
    try {
      components = collectOfferComponents({ throwOnError: true });
    } catch (error) {
      setOfferStatus(String(error?.message || error));
      setSelectValue(els.offer_currency_input, currentCurrency);
      return;
    }

    const restoreSelectState = () => {
      if (els.offer_currency_input) {
        els.offer_currency_input.disabled = false;
      }
    };
    if (els.offer_currency_input) {
      els.offer_currency_input.disabled = true;
    }
    setOfferStatus(bookingT("booking.offer.converting_prices", "Converting prices..."));
    try {
      const converted = await convertOfferComponentsInBackend(currentCurrency, nextCurrency, components);
      const convertedComponents = converted.convertedComponents;
      state.offerDraft.currency = nextCurrency;
      state.offerDraft.components = components.map((component, index) => {
        const convertedComponent = convertedComponents[index] || {};
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
      if (Number.isFinite(Number(converted.totalPriceCents))) {
        state.offerDraft.total_price_cents = Math.round(Number(converted.totalPriceCents));
      }
      setOfferSaveEnabled(true);
    } catch (error) {
      setOfferStatus(bookingT("booking.offer.error.exchange_lookup", "Exchange rate lookup failed: {message}", { message: error?.message || error }));
      restoreSelectState();
      setSelectValue(els.offer_currency_input, currentCurrency);
      return;
    }
    restoreSelectState();
    setOfferStatus("");
    updateOfferCurrencyHint(nextCurrency);
    renderOfferComponentsTable();
    scheduleOfferAutosave();
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

  async function saveOffer() {
    if (!state.booking || !state.permissions.canEditBooking) return;
    if (offerAutosaveInFlight) {
      offerAutosavePending = true;
      return offerAutosavePromise;
    }
    clearOfferStatus();
    let offer;
    try {
      offer = collectOfferPayload();
    } catch (error) {
      setOfferStatus(String(error?.message || error));
      return;
    }
    debugOffer("save:start", {
      booking_id: state.booking.id,
      expected_offer_revision: getBookingRevision("offer_revision"),
      offer
    });

    const request = bookingOfferRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    offerAutosaveInFlight = true;
    const runSave = async () => {
      let result;
      try {
        result = await fetchBookingMutation(request.url, {
          method: request.method,
          body: {
            expected_offer_revision: getBookingRevision("offer_revision"),
            offer,
            actor: state.user,
            lang: bookingContentLang()
          }
        });
      } finally {
        offerAutosaveInFlight = false;
      }
      debugOffer("save:response", result?.booking
        ? {
            unchanged: Boolean(result?.unchanged),
            offer_revision: result.booking.offer_revision,
            offer: {
              currency: result.booking.offer?.currency,
              components: Array.isArray(result.booking.offer?.components)
                ? result.booking.offer.components.map((component) => ({
                    id: component.id,
                    category: component.category,
                    details: component.details,
                    quantity: component.quantity,
                    unit_amount_cents: component.unit_amount_cents
                  }))
                : []
            }
          }
        : result);

      if (!result?.booking) {
        offerPendingRowIndexes = new Set();
        offerTotalPending = false;
        updateOfferTotalsInDom();
        return result;
      }

      await applyOfferBookingResponse(result, { reloadActivities: true });
      setOfferSaveEnabled(false);
      if (offerAutosavePending) {
        offerAutosavePending = false;
        scheduleOfferAutosave();
      }
      return result;
    };
    offerAutosavePromise = runSave();
    const result = await offerAutosavePromise;
    offerAutosavePromise = null;
    debugOffer("save:response", result?.booking
      ? {
          unchanged: Boolean(result?.unchanged),
          offer_revision: result.booking.offer_revision,
          offer: {
            currency: result.booking.offer?.currency,
            components: Array.isArray(result.booking.offer?.components)
              ? result.booking.offer.components.map((component) => ({
                  id: component.id,
                  category: component.category,
                  details: component.details,
                  quantity: component.quantity,
                  unit_amount_cents: component.unit_amount_cents
                }))
              : []
          }
        }
      : result);

    return result;
  }

  return {
    renderOfferPanel,
    addOfferComponent,
    handleOfferCurrencyChange,
    saveOffer
  };
}

function formatPendingMoneyDisplay(currency) {
  const code = normalizeCurrencyCode(currency);
  const definitions = getCurrencyDefinitions();
  const definition = definitions[code] || definitions.USD || { symbol: code };
  const symbol = definition.symbol || code;
  return `${symbol} -.--`;
}
