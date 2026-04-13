import {
  GENERATED_CURRENCIES,
  normalizeCurrencyCode as normalizeGeneratedCurrencyCode
} from "../../Generated/Models/generated_Currency.js";
import {
  bookingInvoiceCreateRequest,
  bookingPricingRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { createSnapshotDirtyTracker } from "../shared/edit_state.js";
import {
  bookingContentLang,
  bookingLanguageQuery,
  bookingLang,
  bookingSourceLang,
  bookingT
} from "./i18n.js";
import {
  mergeDualLocalizedPayload,
  renderLocalizedStackedField,
  resolveLocalizedEditorBranchText
} from "./localized_editor.js";
import {
  buildBookingPdfPanelBodyMarkup,
  buildBookingCollapsibleSectionMarkup,
  buildBookingPdfToggleFieldMarkup
} from "./pdf_personalization_panel.js";
import {
  buildBookingPdfDocumentSectionMarkup,
  buildBookingPdfWorkspaceMarkup
} from "./pdf_workspace.js";
import { initializeBookingSections } from "./sections.js";

const PAYMENT_DOCUMENT_KIND_REQUEST = "PAYMENT_REQUEST";
const PAYMENT_DOCUMENT_KIND_CONFIRMATION = "PAYMENT_CONFIRMATION";

const PAYMENT_DOCUMENT_PANEL_CONFIG = Object.freeze({
  payment_confirmation_deposit: Object.freeze({
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

function normalizeDateInputValue(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const direct = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function normalizeLocalDateToIso(value) {
  const normalized = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function dateOnlyToIsoDateTime(value) {
  const normalized = normalizeLocalDateToIso(value);
  return normalized ? `${normalized}T00:00:00.000Z` : null;
}

function paymentSectionKey(paymentId, sectionKind) {
  return `${String(paymentId || "").trim()}:${String(sectionKind || "").trim().toLowerCase()}`;
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

  const paymentSectionBusyKeys = new Set();
  const paymentSectionStatusByKey = new Map();

  function withBookingLanguageQuery(urlLike) {
    const normalizedUrl = String(urlLike || "").trim();
    if (!normalizedUrl) return "";
    const url = new URL(normalizedUrl, window.location.origin);
    const query = bookingLanguageQuery();
    url.searchParams.set("content_lang", query.content_lang);
    url.searchParams.set("source_lang", query.source_lang);
    return url.toString();
  }

  function pricingRevision() {
    if (typeof getBookingRevision === "function") {
      return getBookingRevision("pricing_revision");
    }
    const value = Number(state.booking?.pricing_revision);
    return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
  }

  const pricingDirtyTracker = createSnapshotDirtyTracker({
    captureSnapshot: () => captureControlSnapshot(els.paymentsWorkspace || els.paymentFlowSections),
    isEnabled: () => state.permissions.canEditBooking && Boolean(state.booking),
    onDirtyChange: (isDirty) => setBookingSectionDirty("pricing", isDirty)
  });

  function clonePricing(pricing) {
    return JSON.parse(JSON.stringify({
      currency: pricing?.currency || "USD",
      payments: Array.isArray(pricing?.payments) ? pricing.payments : []
    }));
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
    if (state.booking?.accepted_payment_terms_snapshot && typeof state.booking.accepted_payment_terms_snapshot === "object") {
      return state.booking.accepted_payment_terms_snapshot;
    }
    return null;
  }

  function currentOfferPaymentTermLines() {
    return Array.isArray(currentOfferPaymentTerms()?.lines) ? currentOfferPaymentTerms().lines : [];
  }

  function hasPaymentTermsFoundation() {
    return currentOfferPaymentTermLines().length > 0;
  }

  function currentOfferCurrency() {
    return normalizeCurrencyCode(
      state.offerDraft?.payment_terms?.currency
      || state.offerDraft?.currency
      || state.booking?.offer?.payment_terms?.currency
      || state.booking?.offer?.currency
      || state.booking?.accepted_record?.accepted_deposit_currency
      || state.booking?.preferred_currency
      || state.booking?.pricing?.currency
      || "USD"
    );
  }

  function resolvePaymentTermLineAmount(line, fallbackAmount = 0) {
    const resolved = Number(line?.resolved_amount_cents);
    if (Number.isFinite(resolved)) return Math.max(0, Math.round(resolved));
    const fixed = Number(line?.amount_spec?.fixed_amount_cents);
    if (Number.isFinite(fixed)) return Math.max(0, Math.round(fixed));
    return Math.max(0, Math.round(Number(fallbackAmount || 0) || 0));
  }

  function paymentTermLineForPayment(payment) {
    const lineId = String(payment?.origin_payment_term_line_id || "").trim();
    return currentOfferPaymentTermLines().find((line) => String(line?.id || "").trim() === lineId) || null;
  }

  function paymentKind(payment) {
    const lineKind = String(paymentTermLineForPayment(payment)?.kind || "").trim().toUpperCase();
    if (lineKind) return lineKind;
    const label = String(payment?.label || "").trim().toLowerCase();
    if (label.includes("deposit")) return "DEPOSIT";
    if (label.includes("final")) return "FINAL_BALANCE";
    return "INSTALLMENT";
  }

  function paymentTitle(payment, index) {
    const explicit = String(payment?.label || "").trim();
    if (explicit) return explicit;
    const kind = paymentKind(payment);
    if (kind === "DEPOSIT") return bookingT("booking.pricing.deposit", "Deposit");
    if (kind === "FINAL_BALANCE") return bookingT("booking.pricing.final_payment", "Final payment");
    const installmentNumber = (Array.isArray(state.pricingDraft?.payments) ? state.pricingDraft.payments : [])
      .slice(0, index + 1)
      .filter((entry) => paymentKind(entry) === "INSTALLMENT")
      .length;
    return bookingT("booking.pricing.installment_number", "Installment {count}", { count: String(installmentNumber || index + 1) });
  }

  function paymentSummaryText(payment) {
    const dueDate = normalizeDateInputValue(payment?.due_date);
    return dueDate
      ? bookingT("booking.pricing.payment_due_on", "Due on {date}.", { date: dueDate })
      : bookingT("booking.pricing.payment_due_unspecified", "No due date set yet.");
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
      users.set(selectedId, { id: selectedId, username: selectedId, name: selectedId });
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

  function paymentDocumentScope(payment, documentKind) {
    const kind = paymentKind(payment);
    if (documentKind === PAYMENT_DOCUMENT_KIND_REQUEST) {
      return kind === "FINAL_BALANCE" ? "payment_request_final" : "payment_request_installment";
    }
    if (kind === "DEPOSIT") return "payment_confirmation_deposit";
    return kind === "FINAL_BALANCE" ? "payment_confirmation_final" : "payment_confirmation_installment";
  }

  function paymentDocumentPanelConfig(scope) {
    return PAYMENT_DOCUMENT_PANEL_CONFIG[String(scope || "").trim()] || PAYMENT_DOCUMENT_PANEL_CONFIG.payment_confirmation_deposit;
  }

  function paymentDocumentPanelPrefix(payment, documentKind) {
    const base = String(payment?.id || payment?.origin_payment_term_line_id || payment?.label || "payment")
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "_")
      .toLowerCase();
    return `payment_pdf_${base}_${String(documentKind || "").trim().toLowerCase()}`;
  }

  function paymentDocumentPersonalizationPanelId(prefix) {
    return `${prefix}_personalization_panel`;
  }

  function paymentSectionState(paymentId, sectionKind) {
    return paymentSectionStatusByKey.get(paymentSectionKey(paymentId, sectionKind)) || { message: "", type: "info" };
  }

  function setPaymentSectionState(paymentId, sectionKind, message, type = "info") {
    const key = paymentSectionKey(paymentId, sectionKind);
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
    const key = paymentSectionKey(paymentId, sectionKind);
    if (busy) {
      paymentSectionBusyKeys.add(key);
      return;
    }
    paymentSectionBusyKeys.delete(key);
  }

  function paymentSectionBusy(paymentId, sectionKind) {
    return paymentSectionBusyKeys.has(paymentSectionKey(paymentId, sectionKind));
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
    if (!(input instanceof HTMLInputElement)) return defaultChecked === true;
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

  function paymentDocumentPersonalizationChanged(scope, prefix) {
    return JSON.stringify(collectPaymentDocumentPersonalization(scope, prefix))
      !== JSON.stringify(paymentDocumentBranch(scope));
  }

  function paymentDocumentsFor(payment, documentKind) {
    const paymentId = String(payment?.id || "").trim();
    if (!paymentId) return [];
    return currentPaymentDocuments().filter((item) => (
      String(item?.payment_id || "").trim() === paymentId
      && String(item?.document_kind || "").trim().toUpperCase() === String(documentKind || "").trim().toUpperCase()
    ));
  }

  function sortedPaymentDocumentsFor(payment, documentKind) {
    return paymentDocumentsFor(payment, documentKind)
      .slice()
      .sort((left, right) => String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || "")));
  }

  function latestPaymentDocumentFor(payment, documentKind) {
    return sortedPaymentDocumentsFor(payment, documentKind)[0] || null;
  }

  function openPaymentDocumentUrl(urlLike) {
    const url = withBookingLanguageQuery(urlLike);
    if (!url) return false;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.click();
    return true;
  }

  function paymentDocumentTableMarkup(payment, documentKind) {
    const docs = sortedPaymentDocumentsFor(payment, documentKind);
    const body = docs.length
      ? docs.map((doc) => `
          <tr>
            <td class="travel-plan-existing-pdfs-col-document">
              <a
                class="travel-plan-existing-pdfs__link"
                href="${escapeHtml(withBookingLanguageQuery(doc.pdf_url || ""))}"
                target="_blank"
                rel="noopener"
              >${escapeHtml(doc.invoice_number || doc.title || doc.id || bookingT("booking.pdf", "PDF"))}</a>
            </td>
            <td class="travel-plan-existing-pdfs-col-date">${escapeHtml(typeof formatDateTime === "function" ? formatDateTime(doc.updated_at || doc.created_at) : String(doc.updated_at || doc.created_at || "-"))}</td>
          </tr>
        `).join("")
      : `<tr><td class="travel-plan-existing-pdfs__empty" colspan="2">${escapeHtml(bookingT("booking.no_documents", "No PDFs yet."))}</td></tr>`;
    return `
      <div class="travel-plan-existing-pdfs booking-payment-document-table">
        <div class="backend-table-wrap travel-plan-existing-pdfs__table-wrap">
          <table class="backend-table travel-plan-existing-pdfs__table">
            <thead>
              <tr>
                <th class="travel-plan-existing-pdfs-col-document">${escapeHtml(bookingT("booking.pdf", "PDF"))}</th>
                <th class="travel-plan-existing-pdfs-col-date">${escapeHtml(bookingT("booking.date", "Date"))}</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function paymentDocumentAttachmentsMarkup() {
    const attachmentHint = bookingT(
      "booking.pricing.payment_pdf_attachments_unavailable",
      "Payment PDF attachments are not available yet."
    );
    return `
      <div class="travel-plan-attachments booking-payment-document-attachments">
        <div class="backend-table-wrap travel-plan-attachments__table-wrap">
          <table class="backend-table travel-plan-attachments__table">
            <thead>
              <tr>
                <th class="travel-plan-attachments-col-document">${escapeHtml(bookingT("booking.pdf_attachments", "PDF Attachments"))}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="travel-plan-attachments__empty">${escapeHtml(bookingT("booking.pricing.no_payment_pdf_attachments", "No PDF attachments yet."))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        ${state.permissions.canEditBooking ? `
          <div class="travel-plan-attachments__actions">
            <button
              class="btn btn-ghost booking-offer-add-btn travel-plan-pdf-btn travel-plan-attachments__upload-btn"
              type="button"
              disabled
              title="${escapeHtml(attachmentHint)}"
            >${escapeHtml(bookingT("booking.travel_plan.upload_additional_pdfs", "Add attachment"))}</button>
          </div>
          <span class="micro booking-inline-status booking-inline-status--info booking-payment-document__attachment-hint">${escapeHtml(attachmentHint)}</span>
        ` : ""}
      </div>
    `;
  }

  function paymentDocumentPreviewButtonMarkup(paymentId, documentKind, disabled, busy) {
    return `
      <button
        class="btn btn-ghost booking-offer-add-btn travel-plan-pdf-btn travel-plan-pdf-btn--preview"
        type="button"
        data-payment-document-preview="${escapeHtml(`${paymentId}:${documentKind}`)}"
        ${disabled ? "disabled" : ""}
      >${escapeHtml(busy ? bookingT("booking.pricing.creating_pdf", "Creating...") : bookingT("booking.travel_plan.preview_pdf", "Preview PDF"))}</button>
    `;
  }

  function paymentDocumentCreateButtonMarkup(paymentId, documentKind, disabled, busy) {
    return `
      <button
        class="btn btn-ghost booking-offer-add-btn travel-plan-pdf-btn"
        type="button"
        data-payment-document-create="${escapeHtml(`${paymentId}:${documentKind}`)}"
        ${disabled ? "disabled" : ""}
      >${escapeHtml(busy ? bookingT("booking.pricing.creating_pdf", "Creating...") : bookingT("booking.travel_plan.create_pdf", "Create PDF"))}</button>
    `;
  }

  function paymentDocumentStatusMarkup(paymentId, sectionKind) {
    const markup = paymentSectionStatusMarkup(paymentId, sectionKind);
    return markup ? `<div class="booking-payment-document__status-wrap">${markup}</div>` : "";
  }

  function paymentDocumentWorkspaceMarkup(payment, documentKind, paymentId, sectionKind, options = {}) {
    const busy = paymentSectionBusy(paymentId, sectionKind);
    const disabledReason = String(options?.disabledReason || "").trim();
    const sectionDisabled = Boolean(disabledReason);
    const previewDisabled = sectionDisabled || !paymentId || (!state.permissions.canEditBooking && !latestPaymentDocumentFor(payment, documentKind));
    const createDisabled = sectionDisabled || !state.permissions.canEditBooking || !paymentId || busy;
    return buildBookingPdfWorkspaceMarkup({
      escapeHtml,
      previewButtonMarkup: paymentDocumentPreviewButtonMarkup(paymentId, documentKind, previewDisabled || busy, busy),
      previewStatusMarkup: disabledReason
        ? `<span class="micro booking-inline-status booking-inline-status--info">${escapeHtml(disabledReason)}</span>`
        : paymentDocumentStatusMarkup(paymentId, sectionKind),
      documentsMarkup: paymentDocumentTableMarkup(payment, documentKind),
      createButtonMarkup: paymentDocumentCreateButtonMarkup(paymentId, documentKind, createDisabled, busy),
      attachmentsMarkup: paymentDocumentAttachmentsMarkup()
    });
  }

  function paymentDocumentPersonalizationPanelMarkup(scope, prefix, options = {}) {
    const config = paymentDocumentPanelConfig(scope);
    const branch = paymentDocumentBranch(scope);
    const disabled = options?.disabled === true || !state.permissions.canEditBooking;
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
        disabled,
        translateEnabled: false
      });
      return buildBookingPdfToggleFieldMarkup({
        escapeHtml,
        label: item.label,
        inputId: `${prefix}_${item.includeField}`,
        dataAttributeName: "payment-pdf-toggle",
        dataAttributeValue: `${prefix}.${item.includeField}`,
        checked: enabled,
        disabled,
        fieldMarkup
      });
    }).join("");
    return buildBookingCollapsibleSectionMarkup({
      id: paymentDocumentPersonalizationPanelId(prefix),
      escapeHtml,
      title: bookingT("booking.pdf_texts", "PDF Texts"),
      tagName: "div",
      dataAttributes: {
        bookingPdfPanel: "travel_plan"
      },
      bodyMarkup: buildBookingPdfPanelBodyMarkup({
        variant: "collapsible",
        fieldsMarkup,
        escapeHtml
      })
    });
  }

  function paymentSectionStatusMarkup(paymentId, sectionKind) {
    const status = paymentSectionState(paymentId, sectionKind);
    if (!status.message) return "";
    return `<span class="micro booking-inline-status booking-inline-status--${escapeHtml(status.type || "info")}">${escapeHtml(status.message)}</span>`;
  }

  function latestGeneratedOffer() {
    return (Array.isArray(state.booking?.generated_offers) ? state.booking.generated_offers : [])
      .slice()
      .sort((left, right) => String(right?.created_at || "").localeCompare(String(left?.created_at || "")))[0] || null;
  }

  function generatedOfferById(generatedOfferId) {
    const normalizedId = String(generatedOfferId || "").trim();
    if (!normalizedId) return null;
    return (Array.isArray(state.booking?.generated_offers) ? state.booking.generated_offers : []).find(
      (item) => String(item?.id || "").trim() === normalizedId
    ) || null;
  }

  function paymentSnapshotMarkup(payment) {
    const linkedOfferId = String(payment?.received_generated_offer_id || payment?.origin_generated_offer_id || "").trim();
    const generatedOffer = linkedOfferId ? (generatedOfferById(linkedOfferId) || latestGeneratedOffer()) : latestGeneratedOffer();
    if (!generatedOffer) {
      return `<div class="micro">${escapeHtml(bookingT("booking.pricing.snapshot_pending", "The payment snapshot will link to the latest generated offer PDF after this payment is saved."))}</div>`;
    }
    const paymentTerms = generatedOffer?.offer?.payment_terms || state.booking?.offer?.payment_terms || state.booking?.accepted_payment_terms_snapshot || null;
    const paymentTermCount = Array.isArray(paymentTerms?.lines) ? paymentTerms.lines.length : 0;
    const pdfUrl = generatedOffer?.pdf_url ? generatedOffer.pdf_url : "";
    const detailRows = [
      {
        label: bookingT("booking.pdf", "PDF"),
        value: pdfUrl
          ? `<a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener">${escapeHtml(bookingT("booking.offer.document", "Offer"))}</a>`
          : escapeHtml(bookingT("booking.offer.document_unavailable", "Offer PDF unavailable"))
      },
      {
        label: bookingT("booking.date", "Date"),
        value: escapeHtml(typeof formatDateTime === "function" ? formatDateTime(generatedOffer.created_at) : String(generatedOffer.created_at || "-"))
      },
      {
        label: bookingT("booking.language", "Language"),
        value: escapeHtml(String(generatedOffer.lang || bookingContentLang() || "en").toUpperCase())
      },
      {
        label: bookingT("booking.total", "Total"),
        value: escapeHtml(formatMoneyDisplay(
          Number(generatedOffer.total_price_cents || generatedOffer?.offer?.total_price_cents || 0),
          generatedOffer.currency || generatedOffer?.offer?.currency || currentOfferCurrency()
        ))
      },
      {
        label: bookingT("booking.payment_plan", "Payment plan"),
        value: escapeHtml(paymentTermCount
          ? bookingT("booking.pricing.snapshot_payment_plan_count", "{count} planned payment(s)", { count: String(paymentTermCount) })
          : bookingT("booking.pricing.snapshot_payment_plan_missing", "Payment plan unavailable"))
      }
    ];
    return `
      <div class="booking-payment-snapshot">
        ${detailRows.map((row) => `
          <div class="booking-payment-snapshot__row">
            <strong>${escapeHtml(row.label)}</strong>
            <span>${row.value}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function paymentFieldInput(attributeName, paymentId) {
    const normalizedId = String(paymentId || "").trim();
    if (!normalizedId) return null;
    const escapedId = typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(normalizedId)
      : normalizedId.replace(/["\\]/g, "\\$&");
    return document.querySelector(`[${attributeName}="${escapedId}"]`);
  }

  function paymentReceiptFieldValues(payment, { strict = true } = {}) {
    const paymentId = String(payment?.id || "").trim();
    const dateInput = paymentFieldInput("data-payment-received-at", paymentId);
    const confirmedByInput = paymentFieldInput("data-payment-confirmed-by", paymentId);
    const referenceInput = paymentFieldInput("data-payment-reference", paymentId);
    const receivedAt = dateInput instanceof HTMLInputElement
      ? normalizeLocalDateToIso(dateInput.value || "")
      : normalizeDateInputValue(payment?.received_at);
    const confirmedByAtpStaffId = confirmedByInput instanceof HTMLSelectElement
      ? String(confirmedByInput.value || "").trim()
      : String(payment?.confirmed_by_atp_staff_id || "").trim();
    const reference = referenceInput instanceof HTMLInputElement
      ? String(referenceInput.value || "").trim()
      : String(payment?.reference || "").trim();
    const hasAnyValue = Boolean(
      receivedAt
      || confirmedByAtpStaffId
      || reference
    );
    const fallbackAmount = Math.max(0, Math.round(Number(payment?.net_amount_cents || 0)));
    const parsedAmount = hasAnyValue ? fallbackAmount : null;
    if (strict && hasAnyValue) {
      if (!receivedAt) {
        throw new Error(bookingT("booking.pricing.error.payment_received_date_required", "When received is required once receipt details are entered."));
      }
      if (!confirmedByAtpStaffId) {
        throw new Error(bookingT("booking.pricing.error.payment_confirmed_by_required", "Confirmed by is required once receipt details are entered."));
      }
    }
    const hasRecordedReceipt = Boolean(
      Number.isFinite(parsedAmount)
      && receivedAt
      && confirmedByAtpStaffId
    );
    return {
      hasAnyValue,
      hasRecordedReceipt,
      received_amount_cents: Number.isFinite(parsedAmount) ? Math.max(0, Math.round(parsedAmount)) : null,
      received_at: receivedAt || null,
      confirmed_by_atp_staff_id: confirmedByAtpStaffId || null,
      reference: reference || null
    };
  }

  function paymentConfirmationDisabledReason(payment) {
    const receipt = paymentReceiptFieldValues(payment, { strict: false });
    if (receipt.hasRecordedReceipt) return "";
    return bookingT(
      "booking.pricing.customer_receipt_requires_payment_received",
      "Fill in Payment received before working with the Customer receipt PDF."
    );
  }

  function nextPricingFromPaymentTerms(basePricing) {
    const pricing = clonePricing(basePricing || {});
    const lines = currentOfferPaymentTermLines();
    if (!lines.length) return pricing;

    const currency = currentOfferCurrency();
    const existingPayments = Array.isArray(pricing.payments) ? pricing.payments : [];
    const remainingPayments = [...existingPayments];
    const payments = lines.map((line, index) => {
      const lineId = String(line?.id || "").trim();
      const lineLabel = String(line?.label || "").trim();
      const matchingIndex = remainingPayments.findIndex((payment) => (
        (lineId && String(payment?.origin_payment_term_line_id || "").trim() === lineId)
        || (lineLabel && String(payment?.label || "").trim() === lineLabel)
      ));
      const existing = matchingIndex >= 0
        ? remainingPayments.splice(matchingIndex, 1)[0]
        : remainingPayments.shift() || null;
      const netAmountCents = resolvePaymentTermLineAmount(line, existing?.net_amount_cents || 0);
      const taxRateBasisPoints = Number.isFinite(Number(existing?.tax_rate_basis_points))
        ? Math.max(0, Math.round(Number(existing.tax_rate_basis_points)))
        : 0;
      const taxAmountCents = Math.round((netAmountCents * taxRateBasisPoints) / 10000);
      const grossAmountCents = netAmountCents + taxAmountCents;
      const dueType = String(line?.due_rule?.type || "").trim().toUpperCase();
      const fixedDate = normalizeDateInputValue(line?.due_rule?.fixed_date);
      return {
        id: String(existing?.id || `pricing_payment_${index + 1}`).trim(),
        label: lineLabel || String(existing?.label || "").trim() || bookingT("booking.payment", "Payment"),
        origin_payment_term_line_id: lineId || String(existing?.origin_payment_term_line_id || "").trim() || null,
        origin_generated_offer_id: String(existing?.origin_generated_offer_id || "").trim() || null,
        due_date: dueType === "FIXED_DATE"
          ? (fixedDate || null)
          : (normalizeDateInputValue(existing?.due_date) || null),
        net_amount_cents: netAmountCents,
        tax_rate_basis_points: taxRateBasisPoints,
        tax_amount_cents: taxAmountCents,
        gross_amount_cents: grossAmountCents,
        status: String(existing?.status || "").trim().toUpperCase() === "PAID" ? "PAID" : "PENDING",
        paid_at: String(existing?.paid_at || "").trim() || null,
        received_at: normalizeDateInputValue(existing?.received_at) || null,
        received_amount_cents: Number.isFinite(Number(existing?.received_amount_cents))
          ? Math.max(0, Math.round(Number(existing.received_amount_cents)))
          : null,
        received_generated_offer_id: String(existing?.received_generated_offer_id || "").trim() || null,
        confirmed_by_atp_staff_id: String(existing?.confirmed_by_atp_staff_id || "").trim() || null,
        reference: String(existing?.reference || "").trim() || null,
        notes: String(existing?.notes || line?.description || "").trim() || null
      };
    });

    return {
      ...pricing,
      currency,
      payments
    };
  }

  function paymentDocumentSectionMarkup(payment, index, documentKind, title) {
    const paymentId = String(payment?.id || "").trim();
    const scope = paymentDocumentScope(payment, documentKind);
    const prefix = paymentDocumentPanelPrefix(payment, documentKind);
    const sectionKind = documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION ? "confirmation" : "request";
    const disabledReason = documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION
      ? paymentConfirmationDisabledReason(payment)
      : "";
    const variantClass = documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION
      ? "booking-payment-document--confirmation"
      : "booking-payment-document--request";
    return buildBookingPdfDocumentSectionMarkup({
      title,
      escapeHtml,
      className: [variantClass, disabledReason ? "is-disabled" : ""].filter(Boolean).join(" "),
      personalizationMarkup: paymentDocumentPersonalizationPanelMarkup(scope, prefix, { disabled: Boolean(disabledReason) }),
      workspaceMarkup: paymentDocumentWorkspaceMarkup(payment, documentKind, paymentId, sectionKind, { disabledReason })
    });
  }

  function paymentReceivedSectionMarkup(payment, index, pricing) {
    const paymentId = String(payment?.id || "").trim();
    const currency = normalizeCurrencyCode(pricing?.currency || currentOfferCurrency());
    const receivedAmountValue = formatMoneyInputValue(payment?.net_amount_cents || 0, currency);
    return `
      <section class="booking-payment-receipt booking-payment-document--receipt">
        <div class="booking-payment-receipt__head">
          <div class="booking-payment-receipt__copy">
            <h4 class="booking-payment-receipt__title">${escapeHtml(bookingT("booking.pricing.payment_received", "Payment received"))}</h4>
          </div>
        </div>
        <div class="backend-controls booking-payment-receipt__grid">
          <div class="field">
            <label for="payment_received_amount_${escapeHtml(paymentId)}">${escapeHtml(bookingT("booking.pricing.amount_received", "Amount received"))}</label>
            <div
              id="payment_received_amount_${escapeHtml(paymentId)}"
              class="booking-payment-receipt__amount-display"
              aria-readonly="true"
            >${escapeHtml(receivedAmountValue)}</div>
          </div>
          <div class="field">
            <label for="payment_received_at_${escapeHtml(paymentId)}">${escapeHtml(bookingT("booking.pricing.when_received", "When received"))}</label>
            <input
              id="payment_received_at_${escapeHtml(paymentId)}"
              type="date"
              data-payment-received-at="${escapeHtml(paymentId)}"
              value="${escapeHtml(normalizeDateInputValue(payment?.received_at))}"
              ${!state.permissions.canEditBooking ? "disabled" : ""}
            />
          </div>
          <div class="field">
            <label for="payment_confirmed_by_${escapeHtml(paymentId)}">${escapeHtml(bookingT("booking.pricing.confirmed_by", "Confirmed by"))}</label>
            <select
              id="payment_confirmed_by_${escapeHtml(paymentId)}"
              data-payment-confirmed-by="${escapeHtml(paymentId)}"
              ${!state.permissions.canEditBooking ? "disabled" : ""}
            >${buildAtpStaffOptions(String(payment?.confirmed_by_atp_staff_id || "").trim())}</select>
          </div>
          <div class="field">
            <label for="payment_reference_${escapeHtml(paymentId)}">${escapeHtml(bookingT("booking.pricing.receipt_reference", "Receipt reference"))}</label>
            <input
              id="payment_reference_${escapeHtml(paymentId)}"
              type="text"
              data-payment-reference="${escapeHtml(paymentId)}"
              value="${escapeHtml(String(payment?.reference || "").trim())}"
              ${!state.permissions.canEditBooking ? "disabled" : ""}
            />
          </div>
        </div>
        <div class="field">
          <span class="field-label">${escapeHtml(bookingT("booking.pricing.offer_snapshot", "Snapshot of the offer"))}</span>
          ${paymentSnapshotMarkup(payment, index)}
        </div>
      </section>
    `;
  }

  function paymentSectionSummaryMarkup(payment, index, pricing) {
    const amountLabel = formatMoneyDisplay(payment?.net_amount_cents || 0, pricing?.currency || currentOfferCurrency());
    return `
      <span class="booking-payment-section__head">
        <span class="booking-payment-section__copy">
          <span class="booking-payment-section__title">${escapeHtml(paymentTitle(payment, index))}</span>
          <span class="micro booking-payment-section__summary">${escapeHtml(paymentSummaryText(payment))}</span>
        </span>
        <span class="booking-payment-section__amount">${escapeHtml(amountLabel)}</span>
      </span>
    `;
  }

  function paymentStageMarkup(payment, index, pricing) {
    return `
      <article class="booking-section booking-payment-step-panel is-open" data-payment-id="${escapeHtml(String(payment?.id || "").trim())}">
        <div class="booking-section__head">
          <button
            class="booking-section__summary booking-section__summary--inline-pad-16"
            id="payment_section_summary_${escapeHtml(String(payment?.id || index + 1).trim())}"
            type="button"
          >${paymentSectionSummaryMarkup(payment, index, pricing)}</button>
        </div>
        <div class="booking-section__body">
          <div class="booking-payment-section__body">
            ${paymentDocumentSectionMarkup(
              payment,
              index,
              PAYMENT_DOCUMENT_KIND_REQUEST,
              bookingT("booking.pricing.request_pdfs", "Request PDFs")
            )}
            ${paymentReceivedSectionMarkup(payment, index, pricing)}
            ${paymentDocumentSectionMarkup(
              payment,
              index,
              PAYMENT_DOCUMENT_KIND_CONFIRMATION,
              bookingT("booking.pricing.customer_receipt", "Customer Receipt")
            )}
          </div>
        </div>
      </article>
    `;
  }

  function renderPaymentFlowSections(pricing) {
    if (!(els.paymentFlowSections instanceof HTMLElement)) return;
    const payments = Array.isArray(pricing?.payments) ? pricing.payments : [];
    if (!payments.length) {
      els.paymentFlowSections.hidden = true;
      els.paymentFlowSections.innerHTML = "";
      return;
    }
    els.paymentFlowSections.hidden = false;
    els.paymentFlowSections.innerHTML = payments.map((payment, index) => paymentStageMarkup(payment, index, pricing)).join("");
    initializeBookingSections(els.paymentFlowSections);
    bindPaymentDocumentActions(els.paymentFlowSections);
  }

  function renderPaymentFoundationMessage() {
    if (!(els.paymentFlowSections instanceof HTMLElement)) return;
    els.paymentFlowSections.hidden = false;
    els.paymentFlowSections.innerHTML = `
      <article class="booking-section booking-payment-step-panel is-open">
        <div class="booking-section__head">
          <button class="booking-section__summary booking-section__summary--inline-pad-16" type="button">
            <span class="booking-payment-section__head">
              <span class="booking-payment-section__copy">
                <span class="booking-payment-section__title">${escapeHtml(bookingT("booking.payments", "Payments"))}</span>
                <span class="micro booking-payment-section__summary">${escapeHtml(bookingT("booking.pricing.no_payments", "No payments scheduled"))}</span>
              </span>
            </span>
          </button>
        </div>
        <div class="booking-section__body">
          <div class="booking-payment-section__body">
            <p class="micro">${escapeHtml(bookingT("booking.pricing.deposit_setup_required", "Create an offer payment plan before working with payment requests and receipts."))}</p>
          </div>
        </div>
      </article>
    `;
    initializeBookingSections(els.paymentFlowSections);
  }

  function collectPricingPayload(options = {}) {
    const strict = options?.strict !== false;
    const suppressErrors = options?.suppressErrors === true;
    try {
      const currency = normalizeCurrencyCode(state.pricingDraft?.currency || currentOfferCurrency());
      const payments = (Array.isArray(state.pricingDraft?.payments) ? state.pricingDraft.payments : []).map((payment, index) => {
        const receipt = paymentReceiptFieldValues(payment, { strict });
        const taxRateBasisPoints = Number.isFinite(Number(payment?.tax_rate_basis_points))
          ? Math.max(0, Math.round(Number(payment.tax_rate_basis_points)))
          : 0;
        const netAmountCents = Math.max(0, Math.round(Number(payment?.net_amount_cents || 0)));
        const taxAmountCents = Math.round((netAmountCents * taxRateBasisPoints) / 10000);
        const grossAmountCents = netAmountCents + taxAmountCents;
        return {
          id: String(payment?.id || `pricing_payment_${index + 1}`).trim(),
          label: String(payment?.label || paymentTitle(payment, index)).trim(),
          origin_payment_term_line_id: String(payment?.origin_payment_term_line_id || "").trim() || null,
          origin_generated_offer_id: String(payment?.origin_generated_offer_id || "").trim() || null,
          due_date: normalizeDateInputValue(payment?.due_date) || null,
          net_amount_cents: netAmountCents,
          tax_rate_basis_points: taxRateBasisPoints,
          tax_amount_cents: taxAmountCents,
          gross_amount_cents: grossAmountCents,
          status: receipt.hasRecordedReceipt ? "PAID" : "PENDING",
          paid_at: receipt.hasRecordedReceipt ? dateOnlyToIsoDateTime(receipt.received_at) : null,
          received_at: receipt.received_at,
          received_amount_cents: receipt.received_amount_cents,
          received_generated_offer_id: String(payment?.received_generated_offer_id || "").trim() || null,
          confirmed_by_atp_staff_id: receipt.confirmed_by_atp_staff_id,
          reference: receipt.reference,
          notes: String(payment?.notes || "").trim() || null
        };
      });
      return {
        currency,
        payments
      };
    } catch (error) {
      if (suppressErrors) return null;
      throw error;
    }
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

  async function createPaymentDocument(paymentId, documentKind, options = {}) {
    const payment = findPaymentById(paymentId, state.pricingDraft) || findPaymentById(paymentId, state.booking?.pricing);
    if (!payment || !state.permissions.canEditBooking) return false;
    const sectionKind = documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION ? "confirmation" : "request";
    const disabledReason = documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION
      ? paymentConfirmationDisabledReason(payment)
      : "";
    if (disabledReason) {
      setPaymentSectionState(paymentId, sectionKind, disabledReason, "info");
      renderPricingPanel({ preserveDraft: true });
      return false;
    }
    const scope = paymentDocumentScope(payment, documentKind);
    const prefix = paymentDocumentPanelPrefix(payment, documentKind);
    const pdfPersonalization = collectPaymentDocumentPersonalization(scope, prefix);
    const openAfterCreate = options?.openAfterCreate === true;
    setPaymentSectionState(paymentId, sectionKind, "");
    if (state.dirty.pricing) {
      const saved = await savePricing();
      if (!saved) {
        setPaymentSectionState(paymentId, sectionKind, bookingT("booking.pricing.save_before_pdf_failed", "Could not save payment details first."), "error");
        renderPricingPanel({ preserveDraft: true });
        return false;
      }
    }
    const latestPayment = findPaymentById(paymentId, state.booking?.pricing) || findPaymentById(paymentId, state.pricingDraft);
    if (!latestPayment) {
      setPaymentSectionState(paymentId, sectionKind, bookingT("booking.pricing.payment_not_found", "This payment could not be found."), "error");
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
        typeof options?.errorMessage === "string" && options.errorMessage.trim()
          ? options.errorMessage.trim()
          : (documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION
              ? bookingT("booking.pricing.payment_confirmation_create_failed", "Could not create the customer receipt PDF.")
              : bookingT("booking.pricing.payment_request_create_failed", "Could not create the payment request PDF.")),
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
    if (openAfterCreate) {
      openPaymentDocumentUrl(result.invoice?.pdf_url || "");
    }
    setPaymentSectionState(
      paymentId,
      sectionKind,
      typeof options?.successMessage === "string" && options.successMessage.trim()
        ? options.successMessage.trim()
        : (documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION
            ? bookingT("booking.pricing.payment_confirmation_created", "Customer receipt PDF created.")
            : bookingT("booking.pricing.payment_request_created", "Payment request PDF created.")),
      "success"
    );
    renderPricingPanel({ preserveDraft: false });
    await loadActivities();
    return true;
  }

  async function previewPaymentDocument(paymentId, documentKind) {
    const payment = findPaymentById(paymentId, state.pricingDraft) || findPaymentById(paymentId, state.booking?.pricing);
    if (!payment) return false;
    const sectionKind = documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION ? "confirmation" : "request";
    const scope = paymentDocumentScope(payment, documentKind);
    const prefix = paymentDocumentPanelPrefix(payment, documentKind);
    const latestDocument = latestPaymentDocumentFor(payment, documentKind);
    const needsFreshDocument =
      state.permissions.canEditBooking
      && (
        state.dirty.pricing
        || paymentDocumentPersonalizationChanged(scope, prefix)
        || !latestDocument
      );

    if (needsFreshDocument) {
      return await createPaymentDocument(paymentId, documentKind, {
        openAfterCreate: true,
        successMessage: bookingT("booking.pricing.preview_pdf_ready", "Preview PDF opened."),
        errorMessage: bookingT("booking.pricing.preview_pdf_failed", "Could not open the preview PDF.")
      });
    }

    if (latestDocument?.pdf_url && openPaymentDocumentUrl(latestDocument.pdf_url)) {
      setPaymentSectionState(paymentId, sectionKind, bookingT("booking.pricing.preview_pdf_ready", "Preview PDF opened."), "success");
      renderPricingPanel({ preserveDraft: true });
      return true;
    }

    setPaymentSectionState(
      paymentId,
      sectionKind,
      bookingT("booking.pricing.preview_pdf_failed", "Could not open the preview PDF."),
      "error"
    );
    renderPricingPanel({ preserveDraft: true });
    return false;
  }

  function bindPaymentDocumentActions(root) {
    if (!(root instanceof HTMLElement)) return;
    root.querySelectorAll("[data-payment-document-preview]").forEach((button) => {
      button.addEventListener("click", () => {
        const raw = String(button.getAttribute("data-payment-document-preview") || "").trim();
        const separatorIndex = raw.lastIndexOf(":");
        if (separatorIndex <= 0) return;
        const paymentId = raw.slice(0, separatorIndex);
        const documentKind = raw.slice(separatorIndex + 1);
        void previewPaymentDocument(paymentId, documentKind);
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
  }

  function findPaymentById(paymentId, pricing = state.pricingDraft) {
    const normalizedId = String(paymentId || "").trim();
    if (!normalizedId) return null;
    return (Array.isArray(pricing?.payments) ? pricing.payments : []).find(
      (payment) => String(payment?.id || "").trim() === normalizedId
    ) || null;
  }

  function renderPricingPanel(options = {}) {
    if (!(els.paymentFlowSections instanceof HTMLElement) || !state.booking) return;
    const preserveDraft = options?.preserveDraft === true;
    const markDerivedChangesDirty = options?.markDerivedChangesDirty === true;
    const savedPricing = clonePricing(state.booking?.pricing || {});
    const draftSource = preserveDraft && state.dirty.pricing
      ? (collectPricingPayload({ strict: false, suppressErrors: true }) || state.pricingDraft || savedPricing)
      : savedPricing;
    const pricing = hasPaymentTermsFoundation()
      ? nextPricingFromPaymentTerms(draftSource)
      : clonePricing(draftSource);
    state.pricingDraft = pricing;

    if (hasPaymentTermsFoundation()) {
      renderPaymentFlowSections(pricing);
    } else {
      renderPaymentFoundationMessage();
    }

    if (preserveDraft && state.dirty.pricing) {
      pricingDirtyTracker.setDirty(true);
      return;
    }
    markPricingSnapshotClean();
    if (markDerivedChangesDirty && JSON.stringify(pricing) !== JSON.stringify(savedPricing)) {
      pricingDirtyTracker.setDirty(true);
    }
  }

  async function savePricing() {
    if (!state.booking || !state.permissions.canEditBooking) return false;
    let pricing;
    try {
      pricing = collectPricingPayload({ strict: true });
    } catch (error) {
      const message = String(error?.message || error);
      setPageSaveActionError?.(message);
      return false;
    }
    const request = bookingPricingRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_pricing_revision: pricingRevision(),
        pricing,
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

  function updatePricingDirtyState() {
    return pricingDirtyTracker.refresh();
  }

  function markPricingSnapshotClean() {
    pricingDirtyTracker.markClean();
  }

  return {
    renderPricingPanel,
    savePricing,
    updatePricingDirtyState,
    markPricingSnapshotClean
  };
}
