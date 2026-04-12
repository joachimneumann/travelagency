import {
  GENERATED_CURRENCIES,
  normalizeCurrencyCode as normalizeGeneratedCurrencyCode
} from "../../Generated/Models/generated_Currency.js";
import {
  bookingInvoiceCreateRequest,
  bookingGeneratedOfferUpdateRequest,
  bookingPricingRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { createSnapshotDirtyTracker } from "../shared/edit_state.js";
import {
  bookingContentLang,
  bookingLang,
  bookingSourceLang,
  bookingT
} from "./i18n.js";
import {
  mergeDualLocalizedPayload,
  renderLocalizedStackedField,
  resolveLocalizedEditorBranchText
} from "./localized_editor.js";
import { initializeBookingSections, renderBookingSectionHeader } from "./sections.js";
import { derivePaymentFlowState } from "./payment_flow_state.js";

const PRICING_SUMMARY_LABELS = Object.freeze({
  agreed_net_amount: ["booking.pricing.agreed_net_amount", "Agreed net amount"],
  adjustments_delta: ["booking.pricing.adjustments_delta", "Adjustments delta"],
  adjusted_net_amount: ["booking.pricing.adjusted_net_amount", "Adjusted net amount"],
  scheduled_net_amount: ["booking.pricing.scheduled_net_amount", "Scheduled net amount"],
  unscheduled_net_amount: ["booking.pricing.unscheduled_net_amount", "Unscheduled net amount"],
  scheduled_tax_amount: ["booking.pricing.scheduled_tax_amount", "Scheduled tax amount"],
  scheduled_gross_amount: ["booking.pricing.scheduled_gross_amount", "Scheduled gross amount"],
  paid_gross_amount: ["booking.pricing.paid_gross_amount", "Paid gross amount"],
  outstanding_gross_amount: ["booking.pricing.outstanding_gross_amount", "Outstanding gross amount"],
  schedule_balanced: ["booking.pricing.schedule_balanced", "Schedule balanced"]
});

const PAYMENT_DOCUMENT_KIND_REQUEST = "PAYMENT_REQUEST";
const PAYMENT_DOCUMENT_KIND_CONFIRMATION = "PAYMENT_CONFIRMATION";

const PAYMENT_DOCUMENT_PANEL_CONFIG = Object.freeze({
  booking_confirmation: Object.freeze({
    items: Object.freeze([
      Object.freeze({ field: "subtitle", includeField: "include_subtitle", label: "Payment confirmation subtitle", rows: 2, defaultChecked: false }),
      Object.freeze({ field: "welcome", includeField: "include_welcome", label: "Payment confirmation welcome", rows: 3, defaultChecked: true }),
      Object.freeze({ field: "closing", includeField: "include_closing", label: "Payment confirmation closing", rows: 3, defaultChecked: true })
    ])
  }),
  payment_request_installment: Object.freeze({
    items: Object.freeze([
      Object.freeze({ field: "subtitle", includeField: "include_subtitle", label: "Payment request subtitle", rows: 2, defaultChecked: false }),
      Object.freeze({ field: "welcome", includeField: "include_welcome", label: "Payment request welcome", rows: 3, defaultChecked: true }),
      Object.freeze({ field: "closing", includeField: "include_closing", label: "Payment request closing", rows: 3, defaultChecked: true })
    ])
  }),
  payment_confirmation_installment: Object.freeze({
    items: Object.freeze([
      Object.freeze({ field: "subtitle", includeField: "include_subtitle", label: "Payment confirmation subtitle", rows: 2, defaultChecked: false }),
      Object.freeze({ field: "welcome", includeField: "include_welcome", label: "Payment confirmation welcome", rows: 3, defaultChecked: true }),
      Object.freeze({ field: "closing", includeField: "include_closing", label: "Payment confirmation closing", rows: 3, defaultChecked: true })
    ])
  }),
  payment_request_final: Object.freeze({
    items: Object.freeze([
      Object.freeze({ field: "subtitle", includeField: "include_subtitle", label: "Payment request subtitle", rows: 2, defaultChecked: false }),
      Object.freeze({ field: "welcome", includeField: "include_welcome", label: "Payment request welcome", rows: 3, defaultChecked: true }),
      Object.freeze({ field: "closing", includeField: "include_closing", label: "Payment request closing", rows: 3, defaultChecked: true })
    ])
  }),
  payment_confirmation_final: Object.freeze({
    items: Object.freeze([
      Object.freeze({ field: "subtitle", includeField: "include_subtitle", label: "Payment confirmation subtitle", rows: 2, defaultChecked: false }),
      Object.freeze({ field: "welcome", includeField: "include_welcome", label: "Payment confirmation welcome", rows: 3, defaultChecked: true }),
      Object.freeze({ field: "closing", includeField: "include_closing", label: "Payment confirmation closing", rows: 3, defaultChecked: true })
    ])
  })
});

function pricingSummaryLabel(key) {
  const entry = PRICING_SUMMARY_LABELS[key];
  return entry ? bookingT(entry[0], entry[1]) : key;
}

function pricingAdjustmentTypeLabel(type) {
  const normalized = String(type || "").trim().toUpperCase();
  return bookingT(`booking.pricing.adjustment_type.${normalized.toLowerCase()}`, normalized);
}

function pricingPaymentStatusLabel(status) {
  const normalized = String(status || "").trim().toUpperCase();
  return bookingT(`booking.pricing.payment_status.${normalized.toLowerCase()}`, normalized);
}

export function getCurrencyDefinitions() {
  return GENERATED_CURRENCIES;
}

export function normalizeCurrencyCode(value) {
  return normalizeGeneratedCurrencyCode(value) || "USD";
}

function currencyDefinition(currency) {
  const code = normalizeCurrencyCode(currency);
  const definitions = getCurrencyDefinitions();
  const definition = definitions[code] || definitions.USD || { symbol: code, decimalPlaces: 2 };
  return {
    code,
    symbol: definition.symbol || code,
    decimalPlaces: Number.isFinite(Number(definition.decimal_places ?? definition.decimalPlaces))
      ? Number(definition.decimal_places ?? definition.decimalPlaces)
      : 2
  };
}

function currencyDecimalPlaces(currency) {
  return currencyDefinition(currency).decimalPlaces;
}

export function isWholeUnitCurrency(currency) {
  return currencyDecimalPlaces(currency) === 0;
}

export function populateCurrencySelect(selectEl) {
  if (!(selectEl instanceof HTMLSelectElement)) return;
  const definitions = getCurrencyDefinitions();
  const selectedValue = normalizeCurrencyCode(selectEl.value || "USD");
  selectEl.innerHTML = Object.keys(definitions)
    .map((code) => `<option value="${code}">${code}</option>`)
    .join("");
  selectEl.value = selectedValue;
}

export function formatMoneyDisplay(value, currency) {
  const amount = Number(value || 0);
  const definition = currencyDefinition(currency);
  if (!Number.isFinite(amount)) return "-";
  const major = amount / 10 ** definition.decimalPlaces;
  return `${definition.symbol} ${new Intl.NumberFormat(bookingLang(), {
    minimumFractionDigits: definition.decimalPlaces,
    maximumFractionDigits: definition.decimalPlaces,
    useGrouping: true
  }).format(major)}`;
}

export function formatMoneyInputValue(value, currency) {
  const amount = Number(value || 0);
  const definition = currencyDefinition(currency);
  if (!Number.isFinite(amount)) return "0";
  if (definition.decimalPlaces === 0) return String(Math.round(amount));
  return (amount / 10 ** definition.decimalPlaces).toFixed(definition.decimalPlaces);
}

export function parseMoneyInputValue(value, currency) {
  const definition = currencyDefinition(currency);
  const normalized = String(value || "0").trim().replace(",", ".");
  const amount = Number(normalized || "0");
  if (!Number.isFinite(amount)) return NaN;
  if (definition.decimalPlaces === 0) return Math.round(amount);
  return Math.round(amount * 10 ** definition.decimalPlaces);
}

export function setSelectValue(selectEl, rawValue) {
  if (!selectEl) return;
  const value = normalizeCurrencyCode(rawValue || "USD");
  const hasOption = Array.from(selectEl.options).some((option) => option.value === value);
  if (!hasOption) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  }
  selectEl.value = value;
}

export function createBookingPricingModule(ctx) {
  const {
    state,
    els,
    apiOrigin,
    fetchBookingMutation,
    getBookingRevision,
    renderBookingHeader,
    renderActionControls,
    renderBookingData,
    loadActivities,
    loadPaymentDocuments,
    escapeHtml,
    formatDateTime,
    captureControlSnapshot,
    setBookingSectionDirty,
    setPageSaveActionError,
    hasUnsavedBookingChanges
  } = ctx;
  let bookingConfirmationPdfBusy = false;
  const paymentSectionBusyKeys = new Set();
  const paymentSectionStatusByKey = new Map();
  const paymentReceiptBusyIds = new Set();
  const pendingPaymentReceiptSaveIds = new Set();

  function pricingRevision() {
    if (typeof getBookingRevision === "function") {
      return getBookingRevision("pricing_revision");
    }
    const value = Number(state.booking?.pricing_revision);
    return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
  }
  const pricingDirtyTracker = createSnapshotDirtyTracker({
    captureSnapshot: () => captureControlSnapshot(els.pricing_panel),
    isEnabled: () => state.permissions.canEditBooking && hasPaymentTermsFoundation(),
    onDirtyChange: (isDirty) => setBookingSectionDirty("pricing", isDirty)
  });

  function bookingHasRecordedDeposit() {
    return Boolean(
      String(
        state.booking?.deposit_received_at
        || state.booking?.milestones?.deposit_received_at
        || ""
      ).trim()
    );
  }

  function savedDepositReceivedAt() {
    return String(
      state.booking?.deposit_received_at
      || state.booking?.milestones?.deposit_received_at
      || ""
    ).trim();
  }

  function savedDepositReceiptDraftReceivedAt() {
    return String(state.booking?.deposit_receipt_draft_received_at || "").trim();
  }

  function savedDepositConfirmedById() {
    return String(state.booking?.deposit_confirmed_by_atp_staff_id || "").trim();
  }

  function savedDepositReceiptDraftConfirmedById() {
    return String(state.booking?.deposit_receipt_draft_confirmed_by_atp_staff_id || "").trim();
  }

  function setDepositReceiptArmed(value) {
    state.pricingDepositReceiptArmed = Boolean(value);
  }

  function depositReceiptIsArmed() {
    return state.pricingDepositReceiptArmed === true;
  }

  function savedDepositReference() {
    return String(
      state.booking?.accepted_record?.accepted_deposit_reference
      || ""
    ).trim();
  }

  function savedDepositReceiptDraftReference() {
    return String(state.booking?.deposit_receipt_draft_reference || "").trim();
  }

  function currentOfferPaymentTerms() {
    const draftTerms = state.offerDraft?.payment_terms;
    if (draftTerms && typeof draftTerms === "object") return draftTerms;
    if (state.booking?.offer?.payment_terms && typeof state.booking.offer.payment_terms === "object") {
      return state.booking.offer.payment_terms;
    }
    if (state.booking?.accepted_record?.payment_terms && typeof state.booking.accepted_record.payment_terms === "object") {
      return state.booking.accepted_record.payment_terms;
    }
    return null;
  }

  function currentOfferPaymentTermLines() {
    return Array.isArray(currentOfferPaymentTerms()?.lines) ? currentOfferPaymentTerms().lines : [];
  }

  function hasPaymentTermsFoundation() {
    return currentOfferPaymentTermLines().length > 0;
  }

  function acceptedRecordAvailable() {
    return state.booking?.accepted_record?.available === true;
  }

  function currentBookingConfirmationPdfs() {
    return Array.isArray(state.booking?.booking_confirmation_pdfs) ? state.booking.booking_confirmation_pdfs : [];
  }

  function hasConfiguredDepositPaymentTerm() {
    return currentOfferPaymentTermLines().some((line) => (
      String(line?.kind || "").trim().toUpperCase() === "DEPOSIT"
      && resolvePaymentTermLineAmount(line, 0) > 0
    ));
  }

  function findDepositPaymentTermLine() {
    const lines = currentOfferPaymentTermLines();
    return lines.find((line) => String(line?.kind || "").trim().toUpperCase() === "DEPOSIT") || lines[0] || null;
  }

  function setPricingControlsVisibility(active) {
    const pricingControls = els.pricing_currency_input?.closest(".backend-controls");
    const adjustmentsWrap = els.pricing_adjustments_table?.closest(".backend-table-wrap");
    const adjustmentsHeading = adjustmentsWrap?.previousElementSibling || null;
    const paymentsWrap = els.pricing_payments_table?.closest(".backend-table-wrap");
    const paymentsHeading = paymentsWrap?.previousElementSibling || null;
    const pricingStatusRow = els.pricing_status?.closest(".backend-controls");
    const receiptControls = els.pricing_deposit_controls;
    const receiptHintRow = els.pricing_deposit_hint_row;

    if (receiptControls instanceof HTMLElement) receiptControls.hidden = !active;
    if (receiptHintRow instanceof HTMLElement) receiptHintRow.hidden = !active;
    if (pricingControls instanceof HTMLElement) pricingControls.hidden = !active;
    if (adjustmentsHeading instanceof HTMLElement) adjustmentsHeading.hidden = !active;
    if (adjustmentsWrap instanceof HTMLElement) adjustmentsWrap.hidden = !active;
    if (paymentsHeading instanceof HTMLElement) paymentsHeading.hidden = !active;
    if (paymentsWrap instanceof HTMLElement) paymentsWrap.hidden = !active;
    if (pricingStatusRow instanceof HTMLElement) pricingStatusRow.hidden = !active;
  }

  function setPricingStatus(message) {
    if (!els.pricing_status) return;
    els.pricing_status.textContent = message;
  }

  function clearPricingStatus() {
    setPricingStatus("");
  }

  function setPricingDepositHint(message) {
    if (!els.pricing_deposit_hint) return;
    const normalized = message || "";
    els.pricing_deposit_hint.textContent = normalized;
    if (els.pricing_deposit_hint_row instanceof HTMLElement) {
      els.pricing_deposit_hint_row.hidden = !normalized;
    }
  }

  function setDepositActionHint(message, type = "info") {
    if (!els.pricing_deposit_action_hint) return;
    els.pricing_deposit_action_hint.textContent = message || "";
    els.pricing_deposit_action_hint.classList.remove(
      "booking-inline-status--error",
      "booking-inline-status--success",
      "booking-inline-status--info"
    );
    if (!message) return;
    const normalizedType = type === "error" || type === "success" ? type : "info";
    els.pricing_deposit_action_hint.classList.add(`booking-inline-status--${normalizedType}`);
  }

  function setBookingConfirmationPdfStatus(message, type = "info") {
    if (!els.booking_confirmation_pdf_status) return;
    els.booking_confirmation_pdf_status.textContent = message || "";
    els.booking_confirmation_pdf_status.classList.remove(
      "booking-inline-status--error",
      "booking-inline-status--success",
      "booking-inline-status--info"
    );
    if (!message) return;
    const normalizedType = type === "error" || type === "success" ? type : "info";
    els.booking_confirmation_pdf_status.classList.add(`booking-inline-status--${normalizedType}`);
  }

  function updatePricingDirtyState() {
    return pricingDirtyTracker.refresh();
  }

  function markPricingSnapshotClean() {
    pricingDirtyTracker.markClean();
  }

  function clonePricing(pricing) {
    return JSON.parse(
      JSON.stringify({
        currency: pricing.currency || "USD",
        agreed_net_amount_cents: pricing.agreed_net_amount_cents || 0,
        adjustments: Array.isArray(pricing.adjustments) ? pricing.adjustments : [],
        payments: Array.isArray(pricing.payments) ? pricing.payments : [],
        summary: pricing.summary || {}
      })
    );
  }

  function currentOfferCurrency() {
    const draftTotal = Number(
      state.offerDraft?.total_price_cents
      ?? state.offerDraft?.totals?.total_price_cents
      ?? 0
    );
    const useDraftCurrency = Boolean(
      (state.offerDraft?.payment_terms && typeof state.offerDraft.payment_terms === "object")
      || (Number.isFinite(draftTotal) && draftTotal > 0)
    );
    return normalizeCurrencyCode(
      (useDraftCurrency ? state.offerDraft?.payment_terms?.currency : "")
      || (useDraftCurrency ? state.offerDraft?.currency : "")
      || state.booking?.offer?.payment_terms?.currency
      || state.booking?.offer?.currency
      || state.booking?.accepted_record?.accepted_deposit_currency
      || state.booking?.preferred_currency
      || "USD"
    );
  }

  function currentOfferTotalPriceCents() {
    const draftDirect = Number(state.offerDraft?.total_price_cents);
    if (Number.isFinite(draftDirect) && draftDirect > 0) return Math.max(0, Math.round(draftDirect));
    const draftSummary = Number(state.offerDraft?.totals?.total_price_cents);
    if (Number.isFinite(draftSummary) && draftSummary > 0) return Math.max(0, Math.round(draftSummary));
    const bookingDirect = Number(state.booking?.offer?.total_price_cents);
    if (Number.isFinite(bookingDirect) && bookingDirect > 0) return Math.max(0, Math.round(bookingDirect));
    const bookingSummary = Number(state.booking?.offer?.totals?.total_price_cents);
    if (Number.isFinite(bookingSummary) && bookingSummary > 0) return Math.max(0, Math.round(bookingSummary));
    const acceptedDirect = Number(state.booking?.accepted_record?.offer?.total_price_cents);
    const total = Number.isFinite(acceptedDirect) ? acceptedDirect : 0;
    return Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0;
  }

  function resolvePaymentTermLineAmount(line, fallbackAmount = 0) {
    const resolved = Number(line?.resolved_amount_cents);
    if (Number.isFinite(resolved)) return Math.max(0, Math.round(resolved));
    const fixed = Number(line?.amount_spec?.fixed_amount_cents);
    if (Number.isFinite(fixed)) return Math.max(0, Math.round(fixed));
    return Math.max(0, Math.round(Number(fallbackAmount || 0) || 0));
  }

  function isDepositPaymentRow(payment, depositLine = findDepositPaymentTermLine()) {
    const normalizedOriginId = String(payment?.origin_payment_term_line_id || "").trim();
    const depositLineId = String(depositLine?.id || "").trim();
    if (normalizedOriginId && depositLineId && normalizedOriginId === depositLineId) return true;
    return String(payment?.label || "").trim().toLowerCase().includes("deposit");
  }

  function buildAtpStaffOptions(selectedId = "") {
    const users = new Map();
    for (const user of Array.isArray(state.keycloakUsers) ? state.keycloakUsers : []) {
      const userId = String(user?.id || "").trim();
      if (userId) users.set(userId, user);
    }
    const authUserId = String(state.authUser?.id || state.authUser?.sub || "").trim();
    if (authUserId && !users.has(authUserId)) {
      users.set(authUserId, {
        ...(state.authUser && typeof state.authUser === "object" ? state.authUser : {}),
        id: authUserId
      });
    }
    if (selectedId && !users.has(selectedId)) {
      users.set(selectedId, {
        id: selectedId,
        username: selectedId,
        name: state.booking?.accepted_record?.deposit_confirmed_by_label || selectedId
      });
    }
    const optionLabel = (user) => String(
      user?.staff_profile?.full_name
      || user?.full_name
      || user?.name
      || user?.preferred_username
      || user?.username
      || user?.id
      || ""
    ).trim();
    return [`<option value="">${escapeHtml(bookingT("booking.pricing.confirmed_by_placeholder", "Select ATP staff"))}</option>`]
      .concat(
        [...users.values()]
          .sort((left, right) => optionLabel(left).localeCompare(optionLabel(right)))
          .map((user) => `<option value="${escapeHtml(String(user.id || "").trim())}" ${String(user.id || "").trim() === selectedId ? "selected" : ""}>${escapeHtml(optionLabel(user) || String(user.id || "").trim())}</option>`)
      )
      .join("");
  }

  function resolveAtpStaffLabel(atpStaffId = "") {
    const normalizedId = String(atpStaffId || "").trim();
    if (!normalizedId) return "";
    const user = (Array.isArray(state.keycloakUsers) ? state.keycloakUsers : []).find(
      (entry) => String(entry?.id || "").trim() === normalizedId
    );
    return String(
      user?.staff_profile?.full_name
      || user?.full_name
      || user?.name
      || user?.preferred_username
      || user?.username
      || user?.id
      || normalizedId
    ).trim();
  }

  function currentPaymentDocuments() {
    return Array.isArray(state.invoices) ? state.invoices : [];
  }

  function paymentEntryForMilestone(milestone, pricing = state.pricingDraft) {
    const items = Array.isArray(pricing?.payments) ? pricing.payments : [];
    const normalizedMilestoneId = String(milestone?.id || "").trim();
    const byId = normalizedMilestoneId
      ? items.find((item) => String(item?.id || "").trim() === normalizedMilestoneId)
      : null;
    return byId || items[Number.isFinite(Number(milestone?.index)) ? Number(milestone.index) : -1] || null;
  }

  function paymentLineKind(payment) {
    const lineId = String(payment?.origin_payment_term_line_id || "").trim();
    const line = currentOfferPaymentTermLines().find((entry) => String(entry?.id || "").trim() === lineId) || null;
    const kind = String(line?.kind || "").trim().toUpperCase();
    if (kind) return kind;
    if (String(payment?.label || "").trim().toLowerCase().includes("deposit")) return "DEPOSIT";
    if (String(payment?.label || "").trim().toLowerCase().includes("final")) return "FINAL_BALANCE";
    return "INSTALLMENT";
  }

  function findPaymentById(paymentId, pricing = state.pricingDraft) {
    const normalizedId = String(paymentId || "").trim();
    if (!normalizedId) return null;
    const items = Array.isArray(pricing?.payments) ? pricing.payments : [];
    return items.find((item) => String(item?.id || "").trim() === normalizedId) || null;
  }

  function paymentDocumentScope(payment, documentKind) {
    const kind = paymentLineKind(payment);
    if (documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION && kind === "DEPOSIT") {
      return "booking_confirmation";
    }
    if (kind === "FINAL_BALANCE") {
      return documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION
        ? "payment_confirmation_final"
        : "payment_request_final";
    }
    return documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION
      ? "payment_confirmation_installment"
      : "payment_request_installment";
  }

  function paymentDocumentPanelConfig(scope) {
    return PAYMENT_DOCUMENT_PANEL_CONFIG[String(scope || "").trim()] || PAYMENT_DOCUMENT_PANEL_CONFIG.booking_confirmation;
  }

  function paymentDocumentPanelPrefix(payment, documentKind) {
    const base = String(payment?.id || payment?.origin_payment_term_line_id || payment?.label || "payment")
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "_")
      .toLowerCase();
    return `payment_pdf_${base}_${String(documentKind || "").trim().toLowerCase()}`;
  }

  function paymentSectionStatusKey(paymentId, sectionKind) {
    return `${String(paymentId || "").trim()}:${String(sectionKind || "").trim().toLowerCase()}`;
  }

  function paymentSectionState(paymentId, sectionKind) {
    return paymentSectionStatusByKey.get(paymentSectionStatusKey(paymentId, sectionKind)) || { message: "", type: "info" };
  }

  function setPaymentSectionState(paymentId, sectionKind, message, type = "info") {
    const key = paymentSectionStatusKey(paymentId, sectionKind);
    const normalizedMessage = String(message || "").trim();
    if (!normalizedMessage) {
      paymentSectionStatusByKey.delete(key);
      return;
    }
    paymentSectionStatusByKey.set(key, {
      message: normalizedMessage,
      type: type === "error" || type === "success" ? type : "info"
    });
  }

  function setPaymentSectionBusy(paymentId, sectionKind, busy) {
    const key = paymentSectionStatusKey(paymentId, sectionKind);
    if (busy) {
      paymentSectionBusyKeys.add(key);
      return;
    }
    paymentSectionBusyKeys.delete(key);
  }

  function paymentSectionBusy(paymentId, sectionKind) {
    return paymentSectionBusyKeys.has(paymentSectionStatusKey(paymentId, sectionKind));
  }

  function paymentDocumentBranch(scope) {
    const personalization = state.booking?.pdf_personalization && typeof state.booking.pdf_personalization === "object"
      ? state.booking.pdf_personalization
      : {};
    const branch = personalization?.[scope];
    return branch && typeof branch === "object" && !Array.isArray(branch) ? branch : {};
  }

  function readPaymentPdfToggle(prefix, includeField, defaultChecked = false) {
    const input = document.querySelector(`[data-payment-pdf-toggle="${prefix}.${includeField}"]`);
    if (!(input instanceof HTMLInputElement)) {
      return defaultChecked === true;
    }
    return input.checked;
  }

  function readPaymentPdfLocalizedField(prefix, field, existingValue) {
    const sourceInput = document.querySelector(`[data-payment-pdf-field="${prefix}.${field}"][data-localized-role="source"]`);
    const targetInput = document.querySelector(`[data-payment-pdf-field="${prefix}.${field}"][data-localized-role="target"]`);
    const payload = mergeDualLocalizedPayload(
      existingValue?.i18n ?? existingValue,
      String(sourceInput?.value || "").trim(),
      String(targetInput?.value || "").trim()
    );
    return {
      text: payload.text,
      i18n: payload.map
    };
  }

  function collectPaymentDocumentPersonalization(scope, prefix) {
    const config = paymentDocumentPanelConfig(scope);
    const existingBranch = paymentDocumentBranch(scope);
    const nextBranch = {};
    config.items.forEach((item) => {
      const payload = readPaymentPdfLocalizedField(prefix, item.field, existingBranch?.[`${item.field}_i18n`]);
      nextBranch[item.field] = payload.text;
      nextBranch[`${item.field}_i18n`] = payload.i18n;
      nextBranch[item.includeField] = readPaymentPdfToggle(prefix, item.includeField, item.defaultChecked === true);
    });
    return nextBranch;
  }

  function collectBookingConfirmationPersonalization() {
    const scope = "booking_confirmation";
    const config = paymentDocumentPanelConfig(scope);
    const existingBranch = paymentDocumentBranch(scope);
    const nextBranch = {};
    config.items.forEach((item) => {
      const sourceInput = document.querySelector(`[data-booking-pdf-field="${scope}.${item.field}"][data-localized-role="source"]`);
      const targetInput = document.querySelector(`[data-booking-pdf-field="${scope}.${item.field}"][data-localized-role="target"]`);
      const payload = mergeDualLocalizedPayload(
        existingBranch?.[`${item.field}_i18n`] ?? existingBranch?.[item.field],
        String(sourceInput?.value || "").trim(),
        String(targetInput?.value || "").trim()
      );
      const toggleInput = document.querySelector(`[data-booking-pdf-toggle="${scope}.${item.includeField}"]`);
      nextBranch[item.field] = payload.text;
      nextBranch[`${item.field}_i18n`] = payload.map;
      nextBranch[item.includeField] = toggleInput instanceof HTMLInputElement
        ? toggleInput.checked
        : item.defaultChecked === true;
    });
    return nextBranch;
  }

  function paymentFieldInput(attributeName, paymentId) {
    const normalizedId = String(paymentId || "").trim();
    if (!normalizedId) return null;
    const escapedId = typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(normalizedId)
      : normalizedId.replace(/["\\]/g, "\\$&");
    return document.querySelector(`[${attributeName}="${escapedId}"]`);
  }

  function depositReceiptReadiness({ includeCleanState = true } = {}) {
    const missing = [];
    if (currentOfferTotalPriceCents() <= 0) {
      missing.push(bookingT("booking.pricing.deposit_requirement.offer_price", "Set the offer price above 0."));
    }
    if (!hasConfiguredDepositPaymentTerm()) {
      missing.push(bookingT("booking.pricing.deposit_requirement.deposit_term", "Configure the deposit in payment terms."));
    }
    if (!normalizeLocalDateToIso(els.pricing_deposit_received_at_input?.value || "")) {
      missing.push(bookingT("booking.pricing.deposit_requirement.received_at", "Fill \"Deposit received at\"."));
    }
    if (!String(els.pricing_deposit_confirmed_by_select?.value || "").trim()) {
      missing.push(bookingT("booking.pricing.deposit_requirement.confirmed_by", "Choose \"Confirmed by\"."));
    }
    if (includeCleanState && typeof hasUnsavedBookingChanges === "function" && hasUnsavedBookingChanges()) {
      missing.push(bookingT("booking.pricing.deposit_requirement.clean_state", "Save all changes first."));
    }
    return {
      ready: missing.length === 0,
      missing
    };
  }

  function latestPendingManagementGeneratedOffer() {
    const items = Array.isArray(state.booking?.generated_offers) ? state.booking.generated_offers : [];
    return items
      .filter((item) => (
        item
        && !item.booking_confirmation
        && (!item.customer_confirmation_flow || typeof item.customer_confirmation_flow !== "object")
        && String(item.management_approver_atp_staff_id || "").trim()
      ))
      .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))[0] || null;
  }

  function managementApprovalReadiness() {
    const generatedOffer = latestPendingManagementGeneratedOffer();
    if (!generatedOffer) {
      return { available: false, ready: false, message: "" };
    }
    const approverId = String(generatedOffer.management_approver_atp_staff_id || "").trim();
    const approverLabel = String(generatedOffer.management_approver_label || approverId || "").trim();
    const selectedId = String(els.pricing_deposit_confirmed_by_select?.value || "").trim();
    if (!selectedId) {
      return {
        available: true,
        ready: false,
        message: bookingT("booking.pricing.management_select_approver", "Choose the management approver under \"Confirmed by\".")
      };
    }
    if (selectedId !== approverId) {
      return {
        available: true,
        ready: false,
        message: bookingT("booking.pricing.management_expected_approver", "Select {name} under \"Confirmed by\" to unlock management approval.", {
          name: approverLabel || bookingT("booking.pricing.confirmed_by", "Confirmed by")
        })
      };
    }
    return {
      available: true,
      ready: true,
      generatedOfferId: String(generatedOffer.id || "").trim(),
      approverLabel
    };
  }

  function renderDepositReceiptActionState({ locked = bookingHasRecordedDeposit() } = {}) {
    const armed = depositReceiptIsArmed();
    const readiness = depositReceiptReadiness({ includeCleanState: !armed });
    const managementReadiness = managementApprovalReadiness();
    if (els.pricing_deposit_received_btn) {
      els.pricing_deposit_received_btn.disabled = locked || !state.permissions.canEditBooking || armed || !readiness.ready;
      els.pricing_deposit_received_btn.hidden = locked;
    }
    if (els.pricing_management_approval_btn) {
      els.pricing_management_approval_btn.hidden = locked || !managementReadiness.available;
      els.pricing_management_approval_btn.disabled = locked || !state.permissions.canEditBooking || !managementReadiness.ready;
    }
    if (locked) {
      setDepositActionHint("", "info");
      return;
    }
    if (armed) {
      setDepositActionHint(
        bookingT("booking.pricing.deposit_received_ready_hint", "Full deposit receipt confirmed. Save the page to persist it."),
        "success"
      );
      return;
    }
    if (!readiness.ready) {
      setDepositActionHint(readiness.missing[0] || managementReadiness.message || "", "error");
      return;
    }
    if (!managementReadiness.ready && managementReadiness.message) {
      setDepositActionHint(managementReadiness.message, "info");
      return;
    }
    setDepositActionHint(
      bookingT("booking.pricing.deposit_action_ready", "Everything is ready. Press \"Full Deposit received\" to confirm the deposit receipt."),
      "info"
    );
  }

  function applyDefaultDepositReceiptDraft() {
    if (bookingHasRecordedDeposit() || !state.permissions.canEditBooking) return false;
    const readiness = depositReceiptReadiness({ includeCleanState: false });
    if (!readiness.ready) {
      renderDepositReceiptActionState();
      return false;
    }
    setDepositReceiptArmed(true);
    renderDepositReceiptActionState();
    updatePricingDirtyState();
    return true;
  }

  function disarmDepositReceiptConfirmation() {
    if (!depositReceiptIsArmed()) {
      renderDepositReceiptActionState();
      return false;
    }
    setDepositReceiptArmed(false);
    renderDepositReceiptActionState();
    return true;
  }

  function renderDepositReceiptControls(pricing) {
    const depositLine = findDepositPaymentTermLine();
    const currency = normalizeCurrencyCode(pricing?.currency || currentOfferCurrency());
    const depositAmount = resolvePaymentTermLineAmount(depositLine, 0);
    const locked = bookingHasRecordedDeposit();

    if (els.pricing_deposit_amount) {
      els.pricing_deposit_amount.textContent = formatMoneyDisplay(depositAmount, currency);
    }
    if (els.pricing_deposit_received_at_input) {
      els.pricing_deposit_received_at_input.value = normalizeDateInput(
        locked ? savedDepositReceivedAt() : (savedDepositReceiptDraftReceivedAt() || savedDepositReceivedAt())
      );
      els.pricing_deposit_received_at_input.disabled = !state.permissions.canEditBooking || locked;
    }
    if (els.pricing_deposit_confirmed_by_select) {
      const preserveExplicitBlank =
        !locked
        && !savedDepositConfirmedById()
        && els.pricing_deposit_confirmed_by_select.dataset.userClearedSelection === "true";
      const selectedId = preserveExplicitBlank
        ? ""
        : (locked ? savedDepositConfirmedById() : (savedDepositReceiptDraftConfirmedById() || savedDepositConfirmedById()));
      els.pricing_deposit_confirmed_by_select.innerHTML = buildAtpStaffOptions(selectedId);
      els.pricing_deposit_confirmed_by_select.value = selectedId;
      els.pricing_deposit_confirmed_by_select.disabled = !state.permissions.canEditBooking || locked;
      if (!preserveExplicitBlank) {
        delete els.pricing_deposit_confirmed_by_select.dataset.userClearedSelection;
      }
    }
    if (els.pricing_deposit_reference_input) {
      els.pricing_deposit_reference_input.value = locked
        ? savedDepositReference()
        : (savedDepositReceiptDraftReference() || "");
      els.pricing_deposit_reference_input.disabled = !state.permissions.canEditBooking || locked;
    }
    if (locked) {
      setDepositReceiptArmed(false);
    }
    renderDepositReceiptActionState({ locked });
    setPricingDepositHint(
      locked
        ? bookingT("booking.pricing.deposit_recorded_hint", "Deposit receipt recorded. The deposit row is now locked in this section.")
        : ""
    );
  }

  function renderBookingConfirmationPdfSection() {
    if (!(els.booking_confirmation_pdf_section instanceof HTMLElement)) return;
    const flow = currentFlowState(state.pricingDraft || state.booking?.pricing || {});
    const depositMilestone = flow.milestones.find((milestone) => milestone.isDeposit) || null;
    const depositPayment = depositMilestone ? (paymentEntryForMilestone(depositMilestone, state.pricingDraft) || null) : null;
    const visible = bookingHasRecordedDeposit() && acceptedRecordAvailable() && Boolean(depositPayment);
    els.booking_confirmation_pdf_section.hidden = !visible;
    if (!visible) {
      if (els.booking_confirmation_pdfs_table) {
        els.booking_confirmation_pdfs_table.innerHTML = "";
      }
      setBookingConfirmationPdfStatus("");
      return;
    }

    if (els.create_booking_confirmation_btn instanceof HTMLButtonElement) {
      els.create_booking_confirmation_btn.hidden = !state.permissions.canEditBooking;
      els.create_booking_confirmation_btn.disabled = bookingConfirmationPdfBusy || !state.permissions.canEditBooking;
      els.create_booking_confirmation_btn.textContent = bookingConfirmationPdfBusy
        ? bookingT("booking.pricing.booking_confirmation_creating", "Creating...")
        : bookingT("booking.pricing.create_booking_confirmation", "Create booking confirmation");
    }

    if (!els.booking_confirmation_pdfs_table) return;
    const rows = [];
    rows.push(...paymentDocumentsFor(depositPayment, PAYMENT_DOCUMENT_KIND_CONFIRMATION)
      .slice()
      .sort((left, right) => String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || "")))
      .map((doc) => `
        <tr>
          <td><a href="${escapeHtml(doc.pdf_url || "#")}" target="_blank" rel="noopener">${escapeHtml(doc.invoice_number || doc.title || doc.id || bookingT("booking.pdf", "PDF"))}</a></td>
          <td>${escapeHtml(typeof formatDateTime === "function" ? formatDateTime(doc.updated_at || doc.created_at) : String(doc.updated_at || doc.created_at || "-"))}</td>
        </tr>
      `));
    rows.push(...currentBookingConfirmationPdfs()
      .slice()
      .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))
      .map((pdf) => `
        <tr>
          <td><a href="${escapeHtml(pdf.pdf_url || "#")}" target="_blank" rel="noopener">${escapeHtml(pdf.filename || "Legacy booking confirmation PDF")}</a></td>
          <td>${escapeHtml(typeof formatDateTime === "function" ? formatDateTime(pdf.created_at) : String(pdf.created_at || "-"))}</td>
        </tr>
      `));
    const body = rows.length
      ? rows.join("")
      : `<tr><td colspan="2">${escapeHtml(bookingT("booking.pricing.no_booking_confirmations", "No booking confirmation PDFs yet."))}</td></tr>`;
    els.booking_confirmation_pdfs_table.innerHTML = `
      <thead>
        <tr>
          <th>${escapeHtml(bookingT("booking.pdf", "PDF"))}</th>
          <th>${escapeHtml(bookingT("booking.updated", "Updated"))}</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    `;
  }

  function currentFlowState(pricing) {
    return derivePaymentFlowState({
      booking: state.booking,
      pricing,
      paymentTerms: currentOfferPaymentTerms()
    });
  }

  function updatePricingPanelSummary(pricing) {
    if (!els.pricingPanelSummary) return;
    const flow = currentFlowState(pricing);
    const outstandingAmount = Number(pricing?.summary?.outstanding_gross_amount_cents || 0);
    const secondary = !flow.proposalSent
      ? bookingT("booking.pricing.summary_waiting_proposal", "Waiting for the proposal to be sent")
      : !flow.depositReceivedAt
        ? bookingT("booking.pricing.summary_deposit_pending", "Deposit pending")
        : flow.fullyPaid
          ? bookingT("booking.pricing.summary_fully_paid", "Fully paid")
          : bookingT("booking.pricing.summary_outstanding", "Outstanding {amount}", {
              amount: formatMoneyDisplay(outstandingAmount, pricing?.currency || currentOfferCurrency())
            });
    renderBookingSectionHeader(els.pricingPanelSummary, {
      primary: bookingT("booking.payments", "Payments"),
      secondary
    });
  }

  function setFlowChipState(element, tone, label) {
    if (!(element instanceof HTMLElement)) return;
    element.textContent = label || "";
    element.classList.remove("is-done", "is-current", "is-upcoming", "is-blocked");
    if (tone) {
      element.classList.add(`is-${tone}`);
    }
  }

  function paymentReceiptReceivedAt(payment, milestone) {
    const paymentId = String(payment?.id || milestone?.id || "").trim();
    const input = paymentFieldInput("data-payment-received-at", paymentId);
    if (input instanceof HTMLInputElement) {
      return normalizeLocalDateToIso(input.value || "");
    }
    return String(
      payment?.received_at
      || payment?.paid_at
      || (milestone?.isDeposit ? state.booking?.deposit_received_at : "")
      || ""
    ).trim();
  }

  function paymentReceiptConfirmedById(payment, milestone) {
    const paymentId = String(payment?.id || milestone?.id || "").trim();
    const input = paymentFieldInput("data-payment-confirmed-by", paymentId);
    if (input instanceof HTMLSelectElement) {
      return String(input.value || "").trim();
    }
    return String(
      payment?.confirmed_by_atp_staff_id
      || (milestone?.isDeposit ? state.booking?.deposit_confirmed_by_atp_staff_id : "")
      || ""
    ).trim();
  }

  function paymentReceiptReference(payment, milestone) {
    const paymentId = String(payment?.id || milestone?.id || "").trim();
    const input = paymentFieldInput("data-payment-reference", paymentId);
    if (input instanceof HTMLInputElement) {
      return String(input.value || "").trim();
    }
    return String(
      payment?.reference
      || (milestone?.isDeposit ? state.booking?.accepted_deposit_reference : "")
      || ""
    ).trim();
  }

  function paymentReceiptReady(payment, milestone, { includeCleanState = true } = {}) {
    const missing = [];
    if (!paymentReceiptReceivedAt(payment, milestone)) {
      missing.push(bookingT("booking.pricing.payment_requirement.received_at", "Fill the payment received date."));
    }
    if (!paymentReceiptConfirmedById(payment, milestone)) {
      missing.push(bookingT("booking.pricing.payment_requirement.confirmed_by", "Choose who confirmed the payment."));
    }
    if (includeCleanState && typeof hasUnsavedBookingChanges === "function" && hasUnsavedBookingChanges()) {
      missing.push(bookingT("booking.pricing.payment_requirement.clean_state", "Save all changes first."));
    }
    return {
      ready: missing.length === 0,
      missing
    };
  }

  function paymentDocumentsFor(payment, documentKind) {
    const paymentId = String(payment?.id || "").trim();
    if (!paymentId) return [];
    return currentPaymentDocuments().filter((item) => (
      String(item?.payment_id || "").trim() === paymentId
      && String(item?.document_kind || "").trim().toUpperCase() === String(documentKind || "").trim().toUpperCase()
    ));
  }

  function paymentDocumentPersonalizationPanelMarkup(scope, prefix) {
    const config = paymentDocumentPanelConfig(scope);
    const branch = paymentDocumentBranch(scope);
    const fieldsMarkup = config.items.map((item) => {
      const enabled = branch?.[item.includeField] !== false && (item.defaultChecked === true || branch?.[item.includeField] === true);
      const fieldMarkup = renderLocalizedStackedField({
        escapeHtml,
        idBase: `${prefix}_${item.field}`,
        label: item.label,
        showLabel: false,
        type: item.rows > 1 ? "textarea" : "input",
        rows: item.rows,
        commonData: { "payment-pdf-field": `${prefix}.${item.field}` },
        sourceValue: resolveLocalizedEditorBranchText(branch?.[`${item.field}_i18n`] ?? branch?.[item.field], bookingSourceLang(), ""),
        localizedValue: resolveLocalizedEditorBranchText(branch?.[`${item.field}_i18n`] ?? branch?.[item.field], bookingContentLang(), ""),
        englishPlaceholder: "",
        localizedPlaceholder: "",
        disabled: !state.permissions.canEditBooking,
        translateEnabled: false
      });
      return `
        <div class="booking-pdf-panel__field">
          <label class="booking-pdf-panel__toggle-label" for="${prefix}_${item.includeField}">
            <input
              id="${prefix}_${item.includeField}"
              type="checkbox"
              data-payment-pdf-toggle="${prefix}.${item.includeField}"
              ${enabled ? "checked" : ""}
              ${!state.permissions.canEditBooking ? "disabled" : ""}
            />
            <span>${escapeHtml(item.label)}</span>
          </label>
          <div class="booking-pdf-panel__field-body">
            ${fieldMarkup}
          </div>
        </div>
      `;
    }).join("");
    return `
      <article
        class="booking-collapsible booking-payment-document-panel"
        data-booking-pdf-panel="${escapeHtml(scope)}"
        data-payment-pdf-personalization="true"
      >
        <div class="booking-collapsible__head">
          <button class="booking-collapsible__summary booking-section__summary--inline-pad-16" type="button">
            <span class="backend-section-header">
              <span class="backend-section-header__primary">${escapeHtml(bookingT("booking.pdf_texts", "PDF Texts"))}</span>
            </span>
          </button>
        </div>
        <div class="booking-collapsible__body">
          <div class="booking-pdf-panel__body">
            <div class="booking-pdf-panel__fields">
              ${fieldsMarkup}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function paymentDocumentTableMarkup(payment, documentKind, { includeLegacyDepositRows = false } = {}) {
    const docs = paymentDocumentsFor(payment, documentKind)
      .slice()
      .sort((left, right) => String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || "")));
    const rows = docs.map((doc) => `
      <tr>
        <td><a href="${escapeHtml(doc.pdf_url || "#")}" target="_blank" rel="noopener">${escapeHtml(doc.invoice_number || doc.title || doc.id || bookingT("booking.pdf", "PDF"))}</a></td>
        <td>${escapeHtml(typeof formatDateTime === "function" ? formatDateTime(doc.updated_at || doc.created_at) : String(doc.updated_at || doc.created_at || "-"))}</td>
      </tr>
    `);
    if (includeLegacyDepositRows) {
      rows.push(...currentBookingConfirmationPdfs()
        .slice()
        .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))
        .map((pdf) => `
          <tr>
            <td>
              <a href="${escapeHtml(pdf.pdf_url || "#")}" target="_blank" rel="noopener">${escapeHtml(pdf.filename || "Legacy booking confirmation PDF")}</a>
            </td>
            <td>${escapeHtml(typeof formatDateTime === "function" ? formatDateTime(pdf.created_at) : String(pdf.created_at || "-"))}</td>
          </tr>
        `));
    }
    const body = rows.length
      ? rows.join("")
      : `<tr><td colspan="2">${escapeHtml(bookingT("booking.no_documents", "No PDFs yet."))}</td></tr>`;
    return `
      <div class="backend-table-wrap">
        <table class="backend-table">
          <thead>
            <tr>
              <th>${escapeHtml(bookingT("booking.pdf", "PDF"))}</th>
              <th>${escapeHtml(bookingT("booking.updated", "Updated"))}</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  function paymentSectionStatusMarkup(paymentId, sectionKind) {
    const status = paymentSectionState(paymentId, sectionKind);
    const toneClass = status.message ? ` booking-inline-status--${escapeHtml(status.type || "info")}` : "";
    return `<span class="micro booking-inline-status booking-payment-document__status${toneClass}">${escapeHtml(status.message || "")}</span>`;
  }

  function paymentMilestoneStatusTone(milestone, flow) {
    if (milestone?.status === "PAID") return "done";
    if (milestone?.isDeposit) return flow.proposalSent ? "current" : "upcoming";
    return flow.nextOpenMilestone?.id === milestone?.id ? "current" : "upcoming";
  }

  function paymentMilestoneStatusLabel(milestone, flow) {
    if (milestone?.isDeposit) {
      if (milestone?.status === "PAID") return bookingT("booking.pricing.deposit_confirmed", "Deposit confirmed");
      return flow.proposalSent
        ? bookingT("booking.pricing.deposit_pending_short", "Deposit pending")
        : bookingT("booking.pricing.awaiting_proposal_send", "Waiting for sent proposal");
    }
    if (milestone?.status === "PAID") return bookingT("booking.pricing.paid", "Paid");
    return flow.nextOpenMilestone?.id === milestone?.id
      ? bookingT("booking.pricing.next_payment", "Next payment")
      : bookingT("booking.pricing.pending", "Pending");
  }

  function paymentMilestoneAmountLabel(milestone, pricing) {
    if (milestone?.isDeposit) {
      const depositAmountCents = Number(
        state.booking?.accepted_record?.accepted_deposit_amount_cents
        ?? milestone?.netAmountCents
        ?? 0
      );
      const currency = normalizeCurrencyCode(
        state.booking?.accepted_record?.accepted_deposit_currency
        || pricing?.currency
        || currentOfferCurrency()
      );
      return formatMoneyDisplay(depositAmountCents, currency);
    }
    return formatMoneyDisplay(milestone?.netAmountCents, pricing?.currency || currentOfferCurrency());
  }

  function paymentRequestSectionMarkup(payment, milestone) {
    const paymentId = String(payment?.id || milestone?.id || "").trim();
    const scope = paymentDocumentScope(payment, PAYMENT_DOCUMENT_KIND_REQUEST);
    const prefix = paymentDocumentPanelPrefix(payment, PAYMENT_DOCUMENT_KIND_REQUEST);
    const busy = paymentSectionBusy(paymentId, "request");
    const dueDate = String(payment?.due_date || milestone?.dueDate || "").trim();
    return `
      <section class="booking-payment-document booking-payment-document--request">
        <div class="booking-payment-document__head">
          <div class="booking-payment-document__copy">
            <h4 class="booking-payment-document__title">${escapeHtml(bookingT("booking.pricing.payment_requests", "Payment request PDFs"))}</h4>
            <p class="booking-payment-document__summary">
              ${escapeHtml(dueDate
                ? bookingT("booking.pricing.payment_request_due_summary", "Optional payment request for this milestone. Due on {date}.", { date: dueDate })
                : bookingT("booking.pricing.payment_request_summary", "Optional payment request for this milestone."))}
            </p>
          </div>
        </div>
        ${paymentDocumentTableMarkup(payment, PAYMENT_DOCUMENT_KIND_REQUEST)}
        ${paymentDocumentPersonalizationPanelMarkup(scope, prefix)}
        <div class="booking-payment-document__actions">
          <button
            class="btn btn-ghost booking-offer-add-btn"
            type="button"
            data-payment-document-create="${escapeHtml(`${paymentId}:${PAYMENT_DOCUMENT_KIND_REQUEST}`)}"
            ${!state.permissions.canEditBooking || busy || !paymentId ? "disabled" : ""}
          >${escapeHtml(busy
            ? bookingT("booking.pricing.payment_request_creating", "Creating...")
            : bookingT("booking.pricing.create_payment_request", "Create payment request"))}</button>
          ${paymentSectionStatusMarkup(paymentId, "request")}
        </div>
      </section>
    `;
  }

  function paymentConfirmationSectionMarkup(payment, milestone, pricing) {
    const paymentId = String(payment?.id || milestone?.id || "").trim();
    const scope = paymentDocumentScope(payment, PAYMENT_DOCUMENT_KIND_CONFIRMATION);
    const prefix = paymentDocumentPanelPrefix(payment, PAYMENT_DOCUMENT_KIND_CONFIRMATION);
    const busy = paymentSectionBusy(paymentId, "confirmation");
    const receiptBusy = paymentReceiptBusyIds.has(paymentId);
    const isPaid = String(payment?.status || milestone?.status || "").trim().toUpperCase() === "PAID";
    const receiptReady = paymentReceiptReady(payment, milestone, { includeCleanState: false });
    return `
      <section class="booking-payment-document booking-payment-document--confirmation">
        <div class="booking-payment-document__head">
          <div class="booking-payment-document__copy">
            <h4 class="booking-payment-document__title">${escapeHtml(bookingT("booking.pricing.payment_confirmations", "Payment confirmation PDFs"))}</h4>
            <p class="booking-payment-document__summary">${escapeHtml(isPaid
              ? bookingT("booking.pricing.payment_confirmation_ready", "Optional payment confirmation once the payment has been recorded.")
              : bookingT("booking.pricing.payment_confirmation_pending", "Record the payment receipt before creating a confirmation PDF."))}</p>
          </div>
        </div>
        <div class="backend-controls booking-payment-document__receipt-grid">
          <div class="field">
            <span class="field-label">${escapeHtml(bookingT("booking.pricing.amount", "Amount"))}</span>
            <div class="pricing-deposit-amount-text">${escapeHtml(paymentMilestoneAmountLabel(milestone, pricing))}</div>
          </div>
          <div class="field">
            <label for="payment_received_at_${escapeHtml(paymentId)}">${escapeHtml(bookingT("booking.pricing.received_at", "Received at"))}</label>
            <input
              id="payment_received_at_${escapeHtml(paymentId)}"
              type="date"
              data-payment-received-at="${escapeHtml(paymentId)}"
              value="${escapeHtml(normalizeDateInput(paymentReceiptReceivedAt(payment, milestone)))}"
              ${!state.permissions.canEditBooking ? "disabled" : ""}
            />
          </div>
          <div class="field">
            <label for="payment_confirmed_by_${escapeHtml(paymentId)}">${escapeHtml(bookingT("booking.pricing.confirmed_by", "Confirmed by"))}</label>
            <select
              id="payment_confirmed_by_${escapeHtml(paymentId)}"
              data-payment-confirmed-by="${escapeHtml(paymentId)}"
              ${!state.permissions.canEditBooking ? "disabled" : ""}
            >${buildAtpStaffOptions(paymentReceiptConfirmedById(payment, milestone))}</select>
          </div>
          <div class="field">
            <label for="payment_reference_${escapeHtml(paymentId)}">${escapeHtml(bookingT("booking.pricing.reference", "Reference"))}</label>
            <input
              id="payment_reference_${escapeHtml(paymentId)}"
              type="text"
              data-payment-reference="${escapeHtml(paymentId)}"
              value="${escapeHtml(paymentReceiptReference(payment, milestone))}"
              placeholder="${escapeHtml(bookingT("booking.pricing.deposit_reference_placeholder", "Bank transfer ref / receipt no. (optional)"))}"
              ${!state.permissions.canEditBooking ? "disabled" : ""}
            />
          </div>
        </div>
        <div class="booking-payment-document__actions">
          <button
            class="btn"
            type="button"
            data-payment-record-received="${escapeHtml(paymentId)}"
            ${!state.permissions.canEditBooking || receiptBusy || !receiptReady.ready || !paymentId ? "disabled" : ""}
          >${escapeHtml(receiptBusy
            ? bookingT("booking.pricing.payment_receipt_saving", "Saving...")
            : isPaid
              ? bookingT("booking.pricing.save_payment_receipt", "Save payment receipt details")
              : bookingT("booking.pricing.record_payment_received", "Record payment received"))}</button>
          ${paymentSectionStatusMarkup(paymentId, "confirmation")}
        </div>
        ${paymentDocumentTableMarkup(payment, PAYMENT_DOCUMENT_KIND_CONFIRMATION)}
        ${paymentDocumentPersonalizationPanelMarkup(scope, prefix)}
        <div class="booking-payment-document__actions">
          <button
            class="btn btn-ghost booking-offer-add-btn"
            type="button"
            data-payment-document-create="${escapeHtml(`${paymentId}:${PAYMENT_DOCUMENT_KIND_CONFIRMATION}`)}"
            ${!state.permissions.canEditBooking || busy || !isPaid || !receiptReady.ready || !paymentId ? "disabled" : ""}
          >${escapeHtml(busy
            ? bookingT("booking.pricing.payment_confirmation_creating", "Creating...")
            : bookingT("booking.pricing.create_payment_confirmation", "Create payment confirmation"))}</button>
          <span class="micro booking-payment-document__hint">${escapeHtml(isPaid
            ? bookingT("booking.pricing.payment_confirmation_optional", "Optional after the payment has been received.")
            : bookingT("booking.pricing.payment_confirmation_requires_record", "Record the payment receipt first."))}</span>
        </div>
      </section>
    `;
  }

  function buildPaymentMilestoneSectionMarkup(milestone, pricing, flow) {
    const payment = paymentEntryForMilestone(milestone, pricing) || {};
    const statusTone = paymentMilestoneStatusTone(milestone, flow);
    const statusLabel = paymentMilestoneStatusLabel(milestone, flow);
    const title = String(milestone?.label || bookingT("booking.payment", "Payment")).trim();
    const summary = milestone?.status === "PAID"
      ? bookingT("booking.pricing.payment_paid_on", "Paid on {date}", {
          date: milestone?.paidAt
            ? (typeof formatDateTime === "function" ? formatDateTime(milestone.paidAt) : milestone.paidAt)
            : bookingT("booking.pricing.payment_paid", "Paid")
        })
      : milestone?.dueDate
        ? bookingT("booking.pricing.payment_due_on", "Due on {date}.", { date: milestone.dueDate })
        : bookingT("booking.pricing.payment_due_unspecified", "No due date set yet.");
    return `
      <article class="booking-payment-section booking-payment-section--milestone is-${escapeHtml(statusTone)}" data-payment-milestone-card="${escapeHtml(milestone?.id || "")}" tabindex="-1">
        <div class="booking-payment-section__head">
          <div class="booking-payment-section__copy">
            <div class="booking-payment-section__title-row">
              <h3 class="booking-payment-section__title">${escapeHtml(title)}</h3>
              <span class="booking-flow-chip is-${escapeHtml(statusTone)}">${escapeHtml(statusLabel)}</span>
            </div>
            <p class="micro booking-payment-section__summary">${escapeHtml(summary)}</p>
          </div>
          <div class="booking-payment-section__amount">${escapeHtml(paymentMilestoneAmountLabel(milestone, pricing))}</div>
        </div>
        <div class="booking-payment-section__body">
          ${paymentRequestSectionMarkup(payment, milestone)}
          ${paymentConfirmationSectionMarkup(payment, milestone, pricing)}
        </div>
      </article>
    `;
  }

  function renderDepositPaymentSection(pricing) {
    if (!(els.paymentDepositSection instanceof HTMLElement)) return;
    const flow = currentFlowState(pricing);
    const depositMilestone = flow.milestones.find((milestone) => milestone.isDeposit) || null;
    if (!depositMilestone) {
      els.paymentDepositSection.hidden = true;
      if (els.paymentDepositSectionSummary instanceof HTMLElement) {
        els.paymentDepositSectionSummary.textContent = "";
      }
      if (els.paymentDepositSectionAmount instanceof HTMLElement) {
        els.paymentDepositSectionAmount.textContent = "";
      }
      setFlowChipState(els.paymentDepositSectionStatus, "", "");
      return;
    }
    els.paymentDepositSection.hidden = false;
    if (els.paymentDepositSectionTitle instanceof HTMLElement) {
      els.paymentDepositSectionTitle.textContent = depositMilestone.label || bookingT("booking.pricing.deposit", "Deposit");
    }
    if (els.paymentDepositSectionSummary instanceof HTMLElement) {
      els.paymentDepositSectionSummary.textContent = flow.depositReceivedAt
        ? bookingT("booking.pricing.deposit_received_on", "Deposit received on {date}", {
            date: typeof formatDateTime === "function" ? formatDateTime(flow.depositReceivedAt) : String(flow.depositReceivedAt)
          })
        : bookingT(
            "booking.pricing.deposit_section_intro",
            "Record the deposit receipt to confirm the booking and unlock confirmation PDFs."
          );
    }
    if (els.paymentDepositSectionAmount instanceof HTMLElement) {
      els.paymentDepositSectionAmount.textContent = paymentMilestoneAmountLabel(depositMilestone, pricing);
    }
    setFlowChipState(
      els.paymentDepositSectionStatus,
      paymentMilestoneStatusTone(depositMilestone, flow),
      paymentMilestoneStatusLabel(depositMilestone, flow)
    );
  }

  function renderPaymentsBookingConfirmationCard(pricing) {
    if (!(els.paymentsBookingConfirmationCard instanceof HTMLElement)) return;
    const flow = currentFlowState(pricing);
    const acceptedOffer = flow.acceptedOffer;
    const depositMilestone = flow.milestones.find((milestone) => milestone.isDeposit) || null;
    if (!depositMilestone) {
      els.paymentsBookingConfirmationCard.hidden = true;
      els.paymentsBookingConfirmationCard.innerHTML = "";
      return;
    }
    const depositAmountCents = Number(
      state.booking?.accepted_record?.accepted_deposit_amount_cents
      ?? depositMilestone?.netAmountCents
      ?? 0
    );
    const currency = normalizeCurrencyCode(
      state.booking?.accepted_record?.accepted_deposit_currency
      || pricing?.currency
      || currentOfferCurrency()
    );
    const statusTone = flow.depositReceivedAt ? "done" : flow.proposalSent ? "current" : "upcoming";
    const statusLabel = flow.depositReceivedAt
      ? bookingT("booking.pricing.deposit_confirmed", "Deposit confirmed")
      : flow.proposalSent
        ? bookingT("booking.pricing.deposit_pending_short", "Deposit pending")
        : bookingT("booking.pricing.awaiting_proposal_send", "Waiting for sent proposal");
    const details = [];
    if (flow.depositReceivedAt) {
      details.push(bookingT("booking.pricing.deposit_received_on", "Deposit received on {date}", {
        date: typeof formatDateTime === "function" ? formatDateTime(flow.depositReceivedAt) : String(flow.depositReceivedAt)
      }));
    } else {
      details.push(bookingT(
        "booking.pricing.deposit_card_intro",
        "Booking confirmation becomes active when the deposit payment is recorded."
      ));
    }
    if (acceptedOffer?.pdf_url) {
      details.push(bookingT("booking.pricing.accepted_offer_available", "Frozen accepted proposal PDF available."));
    } else if (acceptedRecordAvailable()) {
      details.push(bookingT("booking.pricing.accepted_offer_missing_link", "Accepted proposal artifact is frozen, but its PDF link is not available here."));
    }
    els.paymentsBookingConfirmationCard.hidden = false;
    els.paymentsBookingConfirmationCard.innerHTML = `
      <div class="booking-flow-inline-card__head">
        <div>
          <h3 class="booking-flow-inline-card__title">${escapeHtml(bookingT("booking.pricing.booking_confirmation_deposit", "Booking confirmation / Deposit"))}</h3>
          <span class="booking-flow-chip is-${escapeHtml(statusTone)}">${escapeHtml(statusLabel)}</span>
        </div>
        <div class="booking-flow-inline-card__amount">${escapeHtml(formatMoneyDisplay(depositAmountCents, currency))}</div>
      </div>
      <p class="booking-flow-inline-card__body">${escapeHtml(details.join(" "))}</p>
      <div class="booking-flow-inline-card__actions">
        ${acceptedOffer?.pdf_url
          ? `<a class="btn btn-ghost" href="${escapeHtml(acceptedOffer.pdf_url)}" target="_blank" rel="noopener">${escapeHtml(bookingT("booking.pricing.view_accepted_offer", "View accepted proposal PDF"))}</a>`
          : ""}
      </div>
    `;
  }

  function renderPaymentsMilestonesOverview(pricing) {
    if (!(els.paymentsMilestonesOverview instanceof HTMLElement)) return;
    const flow = currentFlowState(pricing);
    const milestones = flow.milestones.filter((milestone) => !milestone.isDeposit);
    if (!milestones.length) {
      els.paymentsMilestonesOverview.hidden = true;
      els.paymentsMilestonesOverview.innerHTML = "";
      return;
    }
    const openMilestones = milestones.filter((milestone) => milestone.status !== "PAID");
    const paidMilestones = milestones.filter((milestone) => milestone.status === "PAID");
    const activeMarkup = openMilestones.map((milestone) => buildPaymentMilestoneSectionMarkup(milestone, pricing, flow)).join("");
    const paidGroupMarkup = paidMilestones.length
      ? `
        <article id="payments_paid_group" class="booking-collapsible booking-flow-paid-group">
          <div class="booking-collapsible__head">
            <button class="booking-collapsible__summary booking-section__summary--inline-pad-16" type="button" data-payments-paid-summary></button>
          </div>
          <div class="booking-collapsible__body">
            <div class="booking-flow-paid-group__items">
              ${paidMilestones.map((milestone) => buildPaymentMilestoneSectionMarkup(milestone, pricing, flow)).join("")}
            </div>
          </div>
        </article>
      `
      : "";
    els.paymentsMilestonesOverview.hidden = false;
    els.paymentsMilestonesOverview.innerHTML = `${activeMarkup}${paidGroupMarkup}`;
    const paidSummary = els.paymentsMilestonesOverview.querySelector("[data-payments-paid-summary]");
    if (paidSummary instanceof HTMLElement) {
      renderBookingSectionHeader(paidSummary, {
        primary: bookingT("booking.payments", "Payments"),
        secondary: bookingT("booking.pricing.summary_fully_paid", "Fully paid")
      });
    }
    initializeBookingSections(els.paymentsMilestonesOverview);
    bindPaymentMilestoneActions(els.paymentsMilestonesOverview);
  }

  async function createLinkedPaymentDocument(payment, documentKind, pdfPersonalization) {
    const request = bookingInvoiceCreateRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id }
    });
    return fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_invoices_revision: getBookingRevision("invoices_revision"),
        payment_id: String(payment?.id || "").trim(),
        document_kind: documentKind,
        lang: bookingContentLang(),
        content_lang: bookingContentLang(),
        source_lang: bookingSourceLang(),
        payment_confirmed_by_label: documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION
          ? (resolveAtpStaffLabel(payment?.confirmed_by_atp_staff_id) || null)
          : null,
        pdf_personalization: pdfPersonalization,
        actor: state.user || null
      }
    });
  }

  async function createPaymentDocument(paymentId, documentKind) {
    const payment = findPaymentById(paymentId, state.pricingDraft) || findPaymentById(paymentId, state.booking?.pricing);
    if (!payment || !state.permissions.canEditBooking) return false;
    const sectionKind = documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION ? "confirmation" : "request";
    const scope = paymentDocumentScope(payment, documentKind);
    const prefix = paymentDocumentPanelPrefix(payment, documentKind);
    const pdfPersonalization = collectPaymentDocumentPersonalization(scope, prefix);
    setPaymentSectionState(paymentId, sectionKind, "", "info");
    if (state.dirty.pricing) {
      const saved = await savePricing();
      if (!saved) {
        setPaymentSectionState(paymentId, sectionKind, bookingT("booking.pricing.save_before_pdf_failed", "Could not save the payment details first."), "error");
        renderPricingPanel({ preserveDraft: true });
        return false;
      }
    }
    const latestPayment = findPaymentById(paymentId, state.booking?.pricing) || findPaymentById(paymentId, state.pricingDraft);
    if (!latestPayment) {
      setPaymentSectionState(paymentId, sectionKind, bookingT("booking.pricing.payment_not_found", "This payment milestone could not be found."), "error");
      renderPricingPanel({ preserveDraft: true });
      return false;
    }
    setPaymentSectionBusy(paymentId, sectionKind, true);
    renderPricingPanel({ preserveDraft: true });
    const result = await createLinkedPaymentDocument(latestPayment, documentKind, pdfPersonalization);
    setPaymentSectionBusy(paymentId, sectionKind, false);
    if (!result?.invoice || !result?.booking) {
      setPaymentSectionState(
        paymentId,
        sectionKind,
        documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION
          ? bookingT("booking.pricing.payment_confirmation_create_failed", "Could not create the payment confirmation PDF.")
          : bookingT("booking.pricing.payment_request_create_failed", "Could not create the payment request PDF."),
        "error"
      );
      renderPricingPanel({ preserveDraft: true });
      return false;
    }
    state.booking = result.booking;
    renderBookingHeader();
    renderBookingData();
    renderActionControls?.();
    await loadPaymentDocuments?.();
    setPaymentSectionState(
      paymentId,
      sectionKind,
      documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION
        ? bookingT("booking.pricing.payment_confirmation_created", "Payment confirmation PDF created.")
        : bookingT("booking.pricing.payment_request_created", "Payment request PDF created."),
      "success"
    );
    renderPricingPanel({ preserveDraft: true });
    await loadActivities();
    return true;
  }

  async function recordPaymentReceipt(paymentId) {
    const payment = findPaymentById(paymentId, state.pricingDraft);
    if (!payment || !state.permissions.canEditBooking) return false;
    const readiness = paymentReceiptReady(payment, { id: paymentId, isDeposit: false }, { includeCleanState: false });
    if (!readiness.ready) {
      setPaymentSectionState(paymentId, "confirmation", readiness.missing[0] || bookingT("booking.pricing.payment_requirement.received_at", "Fill the payment received date."), "error");
      renderPricingPanel({ preserveDraft: true });
      return false;
    }
    paymentReceiptBusyIds.add(paymentId);
    setPaymentSectionState(paymentId, "confirmation", "", "info");
    renderPricingPanel({ preserveDraft: true });
    pendingPaymentReceiptSaveIds.add(paymentId);
    const saved = await savePricing();
    pendingPaymentReceiptSaveIds.delete(paymentId);
    paymentReceiptBusyIds.delete(paymentId);
    setPaymentSectionState(
      paymentId,
      "confirmation",
      saved
        ? bookingT("booking.pricing.payment_receipt_saved", "Payment receipt recorded.")
        : bookingT("booking.pricing.payment_receipt_save_failed", "Could not save the payment receipt."),
      saved ? "success" : "error"
    );
    renderPricingPanel({ preserveDraft: true });
    return saved;
  }

  function bindPaymentMilestoneActions(root) {
    if (!(root instanceof HTMLElement)) return;
    const syncConfirmationSection = (section) => {
      if (!(section instanceof HTMLElement)) return;
      const recordButton = section.querySelector("[data-payment-record-received]");
      if (!(recordButton instanceof HTMLButtonElement)) return;
      const paymentId = String(recordButton.getAttribute("data-payment-record-received") || "").trim();
      const payment = findPaymentById(paymentId, state.pricingDraft) || findPaymentById(paymentId, state.booking?.pricing);
      const readiness = paymentReceiptReady(payment || {}, { id: paymentId, isDeposit: false }, { includeCleanState: false });
      const isPaid = String(payment?.status || "").trim().toUpperCase() === "PAID";
      recordButton.disabled = !state.permissions.canEditBooking || paymentReceiptBusyIds.has(paymentId) || !readiness.ready || !paymentId;
      const createButton = section.querySelector(`[data-payment-document-create="${paymentId}:${PAYMENT_DOCUMENT_KIND_CONFIRMATION}"]`);
      if (createButton instanceof HTMLButtonElement) {
        createButton.disabled = !state.permissions.canEditBooking || paymentSectionBusy(paymentId, "confirmation") || !isPaid || !readiness.ready || !paymentId;
      }
    };
    root.querySelectorAll("[data-payment-record-received]").forEach((button) => {
      button.addEventListener("click", () => {
        void recordPaymentReceipt(button.getAttribute("data-payment-record-received"));
      });
    });
    root.querySelectorAll("[data-payment-document-create]").forEach((button) => {
      button.addEventListener("click", () => {
        const raw = String(button.getAttribute("data-payment-document-create") || "").trim();
        const separatorIndex = raw.lastIndexOf(":");
        if (separatorIndex <= 0) return;
        const paymentId = raw.slice(0, separatorIndex);
        const documentKind = raw.slice(separatorIndex + 1);
        void createPaymentDocument(paymentId, documentKind);
      });
    });
    root.querySelectorAll(".booking-payment-document--confirmation").forEach((section) => {
      syncConfirmationSection(section);
      section.querySelectorAll("[data-payment-received-at], [data-payment-confirmed-by]").forEach((input) => {
        input.addEventListener("change", () => {
          syncConfirmationSection(section);
        });
      });
    });
  }

  function nextPricingFromPaymentTerms(basePricing) {
    const pricing = clonePricing(basePricing || {});
    const paymentTerms = currentOfferPaymentTerms();
    const lines = Array.isArray(paymentTerms?.lines) ? paymentTerms.lines : [];
    if (!lines.length) {
      return pricing;
    }

    const currency = currentOfferCurrency();
    const existingPayments = Array.isArray(pricing.payments) ? pricing.payments : [];
    const remainingPayments = [...existingPayments];
    const depositRecorded = bookingHasRecordedDeposit();
    const normalizedDepositReceivedAt = savedDepositReceivedAt();

    const payments = lines.map((line, index) => {
      const lineLabel = String(line?.label || "").trim();
      const matchingIndex = remainingPayments.findIndex((payment) => String(payment?.label || "").trim() === lineLabel);
      const existing = matchingIndex >= 0
        ? remainingPayments.splice(matchingIndex, 1)[0]
        : remainingPayments.shift() || null;
      const kind = String(line?.kind || "").trim().toUpperCase();
      const isDeposit = kind === "DEPOSIT";
      const dueType = String(line?.due_rule?.type || "").trim().toUpperCase();
      const fixedDate = String(line?.due_rule?.fixed_date || "").trim();
      const existingStatus = String(existing?.status || "").trim().toUpperCase();
      const existingPaidAt = String(existing?.paid_at || "").trim();
      const status = isDeposit ? (depositRecorded ? "PAID" : "PENDING") : (existingStatus === "PAID" ? "PAID" : "PENDING");
      const paidAt = status === "PAID"
        ? (existingPaidAt || (isDeposit ? normalizedDepositReceivedAt : ""))
        : "";
      const receivedAt = isDeposit
        ? (savedDepositReceivedAt() || String(existing?.received_at || "").trim())
        : String(existing?.received_at || "").trim();
      const confirmedByAtpStaffId = isDeposit
        ? (savedDepositConfirmedById() || String(existing?.confirmed_by_atp_staff_id || "").trim())
        : String(existing?.confirmed_by_atp_staff_id || "").trim();
      const reference = isDeposit
        ? (savedDepositReference() || String(existing?.reference || "").trim())
        : String(existing?.reference || "").trim();

      return {
        id: String(existing?.id || "").trim(),
        label: lineLabel || `${bookingT("booking.payment", "Payment")} ${index + 1}`,
        origin_payment_term_line_id: String(existing?.origin_payment_term_line_id || line?.id || "").trim() || null,
        due_date: dueType === "FIXED_DATE"
          ? (fixedDate || null)
          : (String(existing?.due_date || "").trim() || null),
        net_amount_cents: resolvePaymentTermLineAmount(line, existing?.net_amount_cents || 0),
        tax_rate_basis_points: Number.isFinite(Number(existing?.tax_rate_basis_points))
          ? Number(existing.tax_rate_basis_points)
          : 0,
        status,
        paid_at: paidAt || null,
        received_at: receivedAt || null,
        confirmed_by_atp_staff_id: confirmedByAtpStaffId || null,
        reference: reference || null,
        notes: String(existing?.notes || line?.description || "").trim() || null
      };
    });

    return {
      ...pricing,
      currency,
      agreed_net_amount_cents: Number(pricing.agreed_net_amount_cents || 0) > 0
        ? Math.round(Number(pricing.agreed_net_amount_cents || 0))
        : currentOfferTotalPriceCents(),
      adjustments: Array.isArray(pricing.adjustments) ? pricing.adjustments : [],
      payments
    };
  }

  function renderPricingSummaryTable(pricing) {
    if (!els.pricing_summary_table) return;
    const summary = pricing.summary || {};
    const hiddenSummaryKeys = new Set([
      "agreed_net_amount",
      "adjusted_net_amount",
      "scheduled_net_amount",
      "scheduled_gross_amount",
      "outstanding_gross_amount"
    ]);
    const moneyRows = [
      ["agreed_net_amount", pricing.agreed_net_amount_cents],
      ["adjustments_delta", summary.adjustments_delta_cents],
      ["adjusted_net_amount", summary.adjusted_net_amount_cents],
      ["scheduled_net_amount", summary.scheduled_net_amount_cents],
      ["unscheduled_net_amount", summary.unscheduled_net_amount_cents],
      ["scheduled_tax_amount", summary.scheduled_tax_amount_cents],
      ["scheduled_gross_amount", summary.scheduled_gross_amount_cents],
      ["paid_gross_amount", summary.paid_gross_amount_cents],
      ["outstanding_gross_amount", summary.outstanding_gross_amount_cents]
    ]
      .filter(([key]) => !hiddenSummaryKeys.has(key))
      .filter(([, value]) => Number(value || 0) !== 0)
      .map(([key, value]) => `<tr><th>${escapeHtml(pricingSummaryLabel(key))}</th><td>${escapeHtml(formatMoneyDisplay(value, pricing.currency))}</td></tr>`);
    const rows = []
      .concat(moneyRows)
      .concat(
        summary.is_schedule_balanced === false
          ? [`<tr><th>${escapeHtml(pricingSummaryLabel("schedule_balanced"))}</th><td>${escapeHtml(bookingT("common.no", "No"))}</td></tr>`]
          : []
      )
      .join("");
    els.pricing_summary_table.innerHTML = `<tbody>${rows || `<tr><td colspan="2">${escapeHtml(bookingT("booking.pricing.no_totals", "No payment totals yet"))}</td></tr>`}</tbody>`;
  }

  function addPricingAdjustmentRow() {
    state.pricingDraft.adjustments.push({
      id: "",
      type: "DISCOUNT",
      label: "",
      amount_cents: 0,
      notes: null
    });
    renderPricingAdjustmentsTable();
  }

  function removePricingAdjustmentRow(index) {
    state.pricingDraft.adjustments.splice(index, 1);
    renderPricingAdjustmentsTable();
  }

  function addPricingPaymentRow() {
    state.pricingDraft.payments.push({
      id: "",
      label: "",
      due_date: null,
      net_amount_cents: 0,
      tax_rate_basis_points: 0,
      status: "PENDING",
      paid_at: null,
      received_at: null,
      confirmed_by_atp_staff_id: null,
      reference: null,
      notes: null
    });
    renderPricingPaymentsTable();
  }

  function removePricingPaymentRow(index) {
    state.pricingDraft.payments.splice(index, 1);
    renderPricingPaymentsTable();
  }

  function renderPricingAdjustmentsTable() {
    if (!els.pricing_adjustments_table) return;
    const readOnly = !state.permissions.canEditBooking;
    const items = Array.isArray(state.pricingDraft.adjustments) ? state.pricingDraft.adjustments : [];
    const currency = normalizeCurrencyCode(state.pricingDraft.currency);
    const header = `<thead><tr><th>${escapeHtml(bookingT("booking.pricing.label", "Label"))}</th><th>${escapeHtml(bookingT("booking.pricing.type", "Type"))}</th><th>${escapeHtml(bookingT("booking.pricing.amount_currency", "Amount ({currency})", { currency }))}</th><th>${escapeHtml(bookingT("booking.notes", "Notes"))}</th>${readOnly ? "" : "<th></th>"}</tr></thead>`;
    const rows = items
      .map((item, index) => `<tr>
      <td><input id="pricing_adjustment_label_${index}" name="pricing_adjustment_label_${index}" data-pricing-adjustment-label="${index}" type="text" value="${escapeHtml(item.label || "")}" ${readOnly ? "disabled" : ""} /></td>
      <td>
        <select id="pricing_adjustment_type_${index}" name="pricing_adjustment_type_${index}" data-pricing-adjustment-type="${index}" ${readOnly ? "disabled" : ""}>
          ${["DISCOUNT", "CREDIT", "SURCHARGE"].map((type) => `<option value="${type}" ${item.type === type ? "selected" : ""}>${escapeHtml(pricingAdjustmentTypeLabel(type))}</option>`).join("")}
        </select>
      </td>
      <td><input id="pricing_adjustment_amount_${index}" name="pricing_adjustment_amount_${index}" data-pricing-adjustment-amount="${index}" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(item.amount_cents || 0, currency))}" ${readOnly ? "disabled" : ""} /></td>
      <td><input class="booking-text-field booking-text-field--internal" id="pricing_adjustment_notes_${index}" name="pricing_adjustment_notes_${index}" data-pricing-adjustment-notes="${index}" type="text" value="${escapeHtml(item.notes || "")}" ${readOnly ? "disabled" : ""} /></td>
      ${readOnly ? "" : `<td><button class="btn btn-ghost" type="button" data-pricing-remove-adjustment="${index}">${escapeHtml(bookingT("common.remove", "Remove"))}</button></td>`}
    </tr>`)
      .join("");
    const addRow = readOnly ? "" : `<tr><td colspan="5"><button class="btn btn-ghost" type="button" data-pricing-add-adjustment>${escapeHtml(bookingT("common.add", "Add"))}</button></td></tr>`;
    const body = (rows || `<tr><td colspan="${readOnly ? 4 : 5}">${escapeHtml(bookingT("booking.pricing.no_adjustments", "No adjustments"))}</td></tr>`) + addRow;
    els.pricing_adjustments_table.innerHTML = `${header}<tbody>${body}</tbody>`;
    if (!readOnly) {
      els.pricing_adjustments_table.querySelectorAll("[data-pricing-remove-adjustment]").forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number(button.getAttribute("data-pricing-remove-adjustment"));
          removePricingAdjustmentRow(index);
        });
      });
      els.pricing_adjustments_table.querySelector("[data-pricing-add-adjustment]")?.addEventListener("click", addPricingAdjustmentRow);
    }
  }

  function renderPricingPaymentsTable() {
    if (!els.pricing_payments_table) return;
    const readOnly = !state.permissions.canEditBooking;
    const items = Array.isArray(state.pricingDraft.payments) ? state.pricingDraft.payments : [];
    const currency = normalizeCurrencyCode(state.pricingDraft.currency);
    const depositLine = findDepositPaymentTermLine();
    const header = `<thead><tr><th>${escapeHtml(bookingT("booking.pricing.label", "Label"))}</th><th>${escapeHtml(bookingT("booking.due_date", "Due date"))}</th><th>${escapeHtml(bookingT("booking.pricing.net_currency", "Net ({currency})", { currency }))}</th><th>${escapeHtml(bookingT("booking.pricing.tax_percent", "Tax %"))}</th><th>${escapeHtml(bookingT("booking.pricing.status", "Status"))}</th><th>${escapeHtml(bookingT("booking.pricing.paid_at", "Paid at"))}</th><th>${escapeHtml(bookingT("booking.notes", "Notes"))}</th>${readOnly ? "" : "<th></th>"}</tr></thead>`;
    const rows = items
      .map((item, index) => {
        const depositLocked = isDepositPaymentRow(item, depositLine);
        const rowReadOnly = readOnly || depositLocked;
        return `<tr>
      <td><input id="pricing_payment_label_${index}" name="pricing_payment_label_${index}" data-pricing-payment-label="${index}" type="text" value="${escapeHtml(item.label || "")}" ${rowReadOnly ? "disabled" : ""} /></td>
      <td><input id="pricing_payment_due_date_${index}" name="pricing_payment_due_date_${index}" data-pricing-payment-due-date="${index}" type="date" value="${escapeHtml(item.due_date || "")}" ${rowReadOnly ? "disabled" : ""} /></td>
      <td><input id="pricing_payment_net_${index}" name="pricing_payment_net_${index}" data-pricing-payment-net="${index}" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(item.net_amount_cents || 0, currency))}" ${rowReadOnly ? "disabled" : ""} /></td>
      <td><input id="pricing_payment_tax_${index}" name="pricing_payment_tax_${index}" data-pricing-payment-tax="${index}" type="number" min="0" max="100" step="0.01" value="${escapeHtml(formatTaxRatePercent(item.tax_rate_basis_points))}" ${rowReadOnly ? "disabled" : ""} /></td>
      <td>
        <select id="pricing_payment_status_${index}" name="pricing_payment_status_${index}" data-pricing-payment-status="${index}" ${readOnly || depositLocked ? "disabled" : ""}>
          ${["PENDING", "PAID"].map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${escapeHtml(pricingPaymentStatusLabel(status))}</option>`).join("")}
        </select>
      </td>
      <td><input id="pricing_payment_paid_at_${index}" name="pricing_payment_paid_at_${index}" data-pricing-payment-paid-at="${index}" type="datetime-local" value="${escapeHtml(normalizeDateTimeLocal(item.paid_at))}" ${readOnly || depositLocked ? "disabled" : ""} /></td>
      <td><input class="booking-text-field booking-text-field--internal" id="pricing_payment_notes_${index}" name="pricing_payment_notes_${index}" data-pricing-payment-notes="${index}" type="text" value="${escapeHtml(item.notes || "")}" ${rowReadOnly ? "disabled" : ""} /></td>
      ${readOnly || depositLocked ? "" : `<td><button class="btn btn-ghost" type="button" data-pricing-remove-payment="${index}">${escapeHtml(bookingT("common.remove", "Remove"))}</button></td>`}
    </tr>`;
      })
      .join("");
    const addRow = readOnly ? "" : `<tr><td colspan="8"><button class="btn btn-ghost" type="button" data-pricing-add-payment>${escapeHtml(bookingT("common.add", "Add"))}</button></td></tr>`;
    const body = (rows || `<tr><td colspan="${readOnly ? 7 : 8}">${escapeHtml(bookingT("booking.pricing.no_payments", "No payments scheduled"))}</td></tr>`) + addRow;
    els.pricing_payments_table.innerHTML = `${header}<tbody>${body}</tbody>`;
    if (!readOnly) {
      els.pricing_payments_table.querySelectorAll("[data-pricing-remove-payment]").forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number(button.getAttribute("data-pricing-remove-payment"));
          removePricingPaymentRow(index);
        });
      });
      els.pricing_payments_table.querySelectorAll("[data-pricing-payment-status]").forEach((select) => {
        select.addEventListener("change", () => {
          const index = Number(select.getAttribute("data-pricing-payment-status"));
          const paidAtInput = document.querySelector(`[data-pricing-payment-paid-at="${index}"]`);
          if (String(select.value || "").toUpperCase() === "PAID" && paidAtInput && !paidAtInput.value) {
            paidAtInput.value = normalizeDateTimeLocal(new Date().toISOString());
          }
        });
      });
      els.pricing_payments_table.querySelector("[data-pricing-add-payment]")?.addEventListener("click", addPricingPaymentRow);
    }
  }

  function renderPricingPanel(options = {}) {
    if (!els.pricing_panel || !state.booking) return;
    const preserveDraft = options?.preserveDraft === true;
    const markDerivedChangesDirty = options?.markDerivedChangesDirty === true;
    const paymentTermsAvailable = hasPaymentTermsFoundation();
    const savedPricing = clonePricing(state.booking.pricing || {});
    const hasDirtyDraft = preserveDraft && state.dirty.pricing && state.pricingDraft && typeof state.pricingDraft === "object";
    const pricing = paymentTermsAvailable
      ? nextPricingFromPaymentTerms(hasDirtyDraft ? state.pricingDraft : savedPricing)
      : savedPricing;
    state.pricingDraft = pricing;
    setPricingControlsVisibility(paymentTermsAvailable);
    updatePricingPanelSummary(pricing);

    if (!paymentTermsAvailable) {
      setDepositReceiptArmed(false);
      setDepositActionHint("", "info");
      if (els.pricing_summary_table) {
        els.pricing_summary_table.innerHTML = `<tbody><tr><td colspan="2">${escapeHtml(bookingT("booking.pricing.deposit_setup_required", "Create an offer with payment terms before recording a deposit receipt."))}</td></tr></tbody>`;
      }
      if (els.pricing_adjustments_table) els.pricing_adjustments_table.innerHTML = "";
      if (els.pricing_payments_table) els.pricing_payments_table.innerHTML = "";
      if (els.paymentsBookingConfirmationCard instanceof HTMLElement) {
        els.paymentsBookingConfirmationCard.hidden = true;
        els.paymentsBookingConfirmationCard.innerHTML = "";
      }
      if (els.paymentsMilestonesOverview instanceof HTMLElement) {
        els.paymentsMilestonesOverview.hidden = true;
        els.paymentsMilestonesOverview.innerHTML = "";
      }
      if (els.paymentDepositSection instanceof HTMLElement) {
        els.paymentDepositSection.hidden = true;
      }
      setPricingDepositHint("");
      renderBookingConfirmationPdfSection();
      clearPricingStatus();
      markPricingSnapshotClean();
      return;
    }

    const currency = normalizeCurrencyCode(pricing.currency);
    if (els.pricing_currency_input) {
      els.pricing_currency_input.value = currency;
      els.pricing_currency_input.disabled = !state.permissions.canEditBooking;
    }
    if (els.pricing_agreed_net_label) {
      els.pricing_agreed_net_label.textContent = bookingT("booking.pricing.agreed_net_amount_currency", "Agreed net amount ({currency})", { currency });
    }
    if (els.pricing_agreed_net_input) {
      els.pricing_agreed_net_input.value = formatMoneyInputValue(pricing.agreed_net_amount_cents || 0, currency);
      els.pricing_agreed_net_input.disabled = !state.permissions.canEditBooking;
    }
    renderDepositReceiptControls(pricing);
    renderDepositPaymentSection(pricing);
    renderPaymentsBookingConfirmationCard(pricing);
    renderPaymentsMilestonesOverview(pricing);
    renderBookingConfirmationPdfSection();
    renderPricingSummaryTable(pricing);
    renderPricingAdjustmentsTable();
    renderPricingPaymentsTable();
    clearPricingStatus();
    if (hasDirtyDraft) {
      pricingDirtyTracker.setDirty(true);
      return;
    }
    if (!bookingHasRecordedDeposit()) {
      setDepositReceiptArmed(false);
    }
    markPricingSnapshotClean();
    if (markDerivedChangesDirty && JSON.stringify(pricing) !== JSON.stringify(savedPricing)) {
      pricingDirtyTracker.setDirty(true);
    }
  }

  function collectPricingPayload() {
    const currency = normalizeCurrencyCode(els.pricing_currency_input?.value || "USD");
    const agreedNet = parseMoneyInputValue(els.pricing_agreed_net_input?.value || "0", currency);
    if (!currency) throw new Error(bookingT("booking.pricing.error.currency_required", "Currency is required."));
    if (!Number.isFinite(agreedNet) || agreedNet < 0) throw new Error(bookingT("booking.pricing.error.agreed_net_non_negative", "Agreed net amount must be zero or positive."));

    const adjustments = Array.from(document.querySelectorAll("[data-pricing-adjustment-label]")).map((input) => {
      const index = Number(input.getAttribute("data-pricing-adjustment-label"));
      const type = String(document.querySelector(`[data-pricing-adjustment-type="${index}"]`)?.value || "DISCOUNT").trim().toUpperCase();
      const label = String(document.querySelector(`[data-pricing-adjustment-label="${index}"]`)?.value || "").trim();
      const amount = parseMoneyInputValue(document.querySelector(`[data-pricing-adjustment-amount="${index}"]`)?.value || "0", currency);
      const notes = String(document.querySelector(`[data-pricing-adjustment-notes="${index}"]`)?.value || "").trim();
      if (!label) throw new Error(bookingT("booking.pricing.error.adjustment_label", "Adjustment {index} requires a label.", { index: index + 1 }));
      if (!["DISCOUNT", "CREDIT", "SURCHARGE"].includes(type)) throw new Error(bookingT("booking.pricing.error.adjustment_type", "Adjustment {index} has an invalid type.", { index: index + 1 }));
      if (!Number.isFinite(amount) || amount < 0) throw new Error(bookingT("booking.pricing.error.adjustment_amount", "Adjustment {index} requires a valid non-negative amount.", { index: index + 1 }));
      return {
        id: state.pricingDraft.adjustments[index]?.id || "",
        type,
        label,
        amount_cents: Math.round(amount),
        notes: notes || null
      };
    });

    const payments = Array.from(document.querySelectorAll("[data-pricing-payment-label]")).map((input) => {
      const index = Number(input.getAttribute("data-pricing-payment-label"));
      const existingPayment = state.pricingDraft.payments[index] || {};
      const paymentId = String(existingPayment.id || "").trim();
      const label = String(document.querySelector(`[data-pricing-payment-label="${index}"]`)?.value || "").trim();
      const dueDate = String(document.querySelector(`[data-pricing-payment-due-date="${index}"]`)?.value || "").trim();
      const netAmount = parseMoneyInputValue(document.querySelector(`[data-pricing-payment-net="${index}"]`)?.value || "0", currency);
      const taxPercent = Number(document.querySelector(`[data-pricing-payment-tax="${index}"]`)?.value || "0");
      const baseStatus = String(document.querySelector(`[data-pricing-payment-status="${index}"]`)?.value || "PENDING").trim().toUpperCase();
      const paidAtInputValue = document.querySelector(`[data-pricing-payment-paid-at="${index}"]`)?.value || "";
      const receivedAt = paymentReceiptReceivedAt(existingPayment, { id: paymentId, isDeposit: false });
      const confirmedByAtpStaffId = paymentReceiptConfirmedById(existingPayment, { id: paymentId, isDeposit: false });
      const reference = paymentReceiptReference(existingPayment, { id: paymentId, isDeposit: false });
      const forcePaid = paymentId && pendingPaymentReceiptSaveIds.has(paymentId);
      const status = forcePaid ? "PAID" : baseStatus;
      const paidAt = normalizeLocalDateTimeToIso(
        paidAtInputValue
          || (forcePaid ? normalizeDateTimeLocal(receivedAt || new Date().toISOString()) : "")
          || (status === "PAID" ? normalizeDateTimeLocal(existingPayment.paid_at || new Date().toISOString()) : "")
      );
      const notes = String(document.querySelector(`[data-pricing-payment-notes="${index}"]`)?.value || "").trim();
      if (!label) throw new Error(bookingT("booking.pricing.error.payment_label", "Payment {index} requires a label.", { index: index + 1 }));
      if (!Number.isFinite(netAmount) || netAmount < 0) throw new Error(bookingT("booking.pricing.error.payment_amount", "Payment {index} requires a valid non-negative net amount.", { index: index + 1 }));
      if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) throw new Error(bookingT("booking.pricing.error.payment_tax", "Payment {index} requires a tax rate between 0 and 100.", { index: index + 1 }));
      if (!["PENDING", "PAID"].includes(status)) throw new Error(bookingT("booking.pricing.error.payment_status", "Payment {index} has an invalid status.", { index: index + 1 }));
      if (status === "PAID" && !paidAt) throw new Error(bookingT("booking.pricing.error.payment_paid_at", "Payment {index} needs a paid time when marked paid.", { index: index + 1 }));
      return {
        id: paymentId,
        label,
        origin_payment_term_line_id: String(existingPayment.origin_payment_term_line_id || "").trim() || null,
        due_date: dueDate || null,
        net_amount_cents: Math.round(netAmount),
        tax_rate_basis_points: Math.round(taxPercent * 100),
        status,
        paid_at: paidAt || null,
        received_at: receivedAt || null,
        confirmed_by_atp_staff_id: confirmedByAtpStaffId || null,
        reference: reference || null,
        notes: notes || null
      };
    });

    return {
      currency,
      agreed_net_amount_cents: Math.round(agreedNet),
      adjustments,
      payments
    };
  }

  function collectDepositReceiptPayload() {
    const depositReceivedAt = normalizeLocalDateToIso(els.pricing_deposit_received_at_input?.value || "");
    const confirmedById = String(els.pricing_deposit_confirmed_by_select?.value || "").trim();
    const depositReference = String(els.pricing_deposit_reference_input?.value || "").trim();
    const hasAnyValue = Boolean(depositReceivedAt || confirmedById || depositReference);
    if (!hasAnyValue) return null;
    if (!depositReceiptIsArmed()) {
      return null;
    }
    const readiness = depositReceiptReadiness();
    if (!readiness.ready) {
      throw new Error(readiness.missing[0] || bookingT("booking.pricing.error.deposit_ack_required", "Deposit receipt is not ready."));
    }
    if (!depositReceivedAt) {
      throw new Error(bookingT("booking.pricing.error.deposit_received_at_required", "Deposit received at is required."));
    }
    if (!confirmedById) {
      throw new Error(bookingT("booking.pricing.error.deposit_confirmed_by_required", "Confirmed by is required."));
    }
    return {
      deposit_received_at: depositReceivedAt,
      deposit_confirmed_by_atp_staff_id: confirmedById,
      ...(depositReference ? { deposit_reference: depositReference } : {})
    };
  }

  function collectDepositReceiptDraftPayload() {
    if (bookingHasRecordedDeposit()) return null;
    return {
      deposit_received_at: normalizeLocalDateToIso(els.pricing_deposit_received_at_input?.value || "") || null,
      deposit_confirmed_by_atp_staff_id: String(els.pricing_deposit_confirmed_by_select?.value || "").trim() || null,
      deposit_reference: String(els.pricing_deposit_reference_input?.value || "").trim() || null
    };
  }

  async function savePricing() {
    if (!state.booking || !state.permissions.canEditBooking) return false;
    clearPricingStatus();
    let pricing;
    let depositReceipt;
    let depositReceiptDraft;
    try {
      pricing = collectPricingPayload();
      depositReceipt = collectDepositReceiptPayload();
      depositReceiptDraft = collectDepositReceiptDraftPayload();
    } catch (error) {
      const message = String(error?.message || error);
      setPricingStatus(message);
      setPageSaveActionError?.(message);
      return false;
    }

    const request = bookingPricingRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_pricing_revision: pricingRevision(),
        pricing,
        ...(depositReceipt ? { deposit_receipt: depositReceipt } : {}),
        ...(depositReceiptDraft ? { deposit_receipt_draft: depositReceiptDraft } : {}),
        actor: state.user
      }
    });
    if (!result?.booking) return false;
    state.booking = result.booking;
    renderBookingHeader();
    renderBookingData();
    renderActionControls?.();
    renderPricingPanel();
    await loadActivities();
    return true;
  }

  async function confirmGeneratedOfferByManagement() {
    if (!state.booking || !state.permissions.canEditBooking) return false;
    clearPricingStatus();
    const readiness = managementApprovalReadiness();
    if (!readiness.available || !readiness.generatedOfferId) return false;
    if (!readiness.ready) {
      const message = readiness.message || bookingT("booking.pricing.management_select_approver", "Choose the management approver under \"Confirmed by\".");
      setDepositActionHint(message, "error");
      setPageSaveActionError?.(message);
      return false;
    }
    const request = bookingGeneratedOfferUpdateRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        generated_offer_id: readiness.generatedOfferId
      }
    });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_offer_revision: getBookingRevision("offer_revision"),
        confirm_as_management: true,
        actor: state.user || null
      }
    });
    if (!result?.booking) return false;
    state.booking = result.booking;
    renderBookingHeader();
    renderBookingData();
    renderActionControls?.();
    renderPricingPanel({ preserveDraft: true });
    await loadActivities();
    return true;
  }

  async function createBookingConfirmationPdf() {
    if (!state.booking || !state.permissions.canEditBooking || bookingConfirmationPdfBusy) return false;
    if (!bookingHasRecordedDeposit() || !acceptedRecordAvailable()) return false;
    const flow = currentFlowState(state.pricingDraft || state.booking?.pricing || {});
    const depositMilestone = flow.milestones.find((milestone) => milestone.isDeposit) || null;
    const depositPayment = depositMilestone ? (paymentEntryForMilestone(depositMilestone, state.pricingDraft) || findPaymentById(depositMilestone.id, state.booking?.pricing)) : null;
    if (!depositPayment?.id) return false;
    bookingConfirmationPdfBusy = true;
    setBookingConfirmationPdfStatus(
      bookingT("booking.pricing.booking_confirmation_creating", "Creating booking confirmation PDF..."),
      "info"
    );
    renderBookingConfirmationPdfSection();
    const result = await createLinkedPaymentDocument(
      depositPayment,
      PAYMENT_DOCUMENT_KIND_CONFIRMATION,
      collectBookingConfirmationPersonalization()
    );
    bookingConfirmationPdfBusy = false;
    renderBookingConfirmationPdfSection();
    if (!result?.invoice || !result?.booking) {
      setBookingConfirmationPdfStatus(
        bookingT("booking.pricing.booking_confirmation_create_failed", "Could not create booking confirmation PDF."),
        "error"
      );
      return false;
    }
    state.booking = result.booking;
    renderBookingHeader();
    renderBookingData();
    renderActionControls?.();
    await loadPaymentDocuments?.();
    renderPricingPanel({ preserveDraft: true });
    setBookingConfirmationPdfStatus(
      bookingT("booking.pricing.booking_confirmation_created", "Booking confirmation PDF created."),
      "success"
    );
    await loadActivities();
    return true;
  }

  async function deleteBookingConfirmationPdf(artifactId) {
    if (!state.booking || !state.permissions.canEditBooking || !artifactId) return false;
    if (!window.confirm(bookingT("booking.pricing.delete_booking_confirmation_pdf_confirm", "Delete this booking confirmation PDF?"))) {
      return false;
    }
    setBookingConfirmationPdfStatus("", "info");
    const result = await fetchBookingMutation(
      `/api/v1/bookings/${encodeURIComponent(state.booking.id)}/booking-confirmation/pdfs/${encodeURIComponent(artifactId)}`,
      {
        method: "DELETE",
        body: { actor: state.user || null }
      }
    );
    if (!result?.booking) {
      setBookingConfirmationPdfStatus(
        bookingT("booking.pricing.booking_confirmation_delete_failed", "Could not delete booking confirmation PDF."),
        "error"
      );
      return false;
    }
    state.booking = result.booking;
    renderBookingHeader();
    renderBookingData();
    renderActionControls?.();
    renderPricingPanel({ preserveDraft: true });
    setBookingConfirmationPdfStatus(
      bookingT("booking.pricing.booking_confirmation_deleted", "Booking confirmation PDF deleted."),
      "success"
    );
    await loadActivities();
    return true;
  }

  return {
    updatePricingDirtyState,
    markPricingSnapshotClean,
    renderPricingPanel,
    savePricing,
    confirmGeneratedOfferByManagement,
    createBookingConfirmationPdf,
    deleteBookingConfirmationPdf,
    applyDefaultDepositReceiptDraft,
    disarmDepositReceiptConfirmation,
    refreshDepositReceiptActionState: () => renderDepositReceiptActionState()
  };
}

function normalizeDateTimeLocal(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function normalizeDateInput(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function normalizeLocalDateTimeToIso(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function normalizeLocalDateToIso(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  return `${text}T00:00:00.000Z`;
}

function formatTaxRatePercent(value) {
  const basisPoints = Number(value || 0);
  if (!Number.isFinite(basisPoints)) return "0";
  return (basisPoints / 100).toFixed(2).replace(/\.00$/, "");
}
