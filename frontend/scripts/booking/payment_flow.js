import {
  bookingPaymentDocumentCreateRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import {
  bookingContentLang,
  bookingLanguageQuery,
  bookingSourceLang,
  bookingT
} from "./i18n.js";
import {
  formatMoneyDisplay,
  formatMoneyInputValue,
  normalizeCurrencyCode
} from "./currency.js";
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
import {
  initializeBookingSections,
  setBookingSectionOpen
} from "./sections.js";

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
  payment_request_deposit: Object.freeze({
    items: Object.freeze([
      Object.freeze({ field: "welcome", includeField: "include_welcome", label: "Deposit request welcome", rows: 4, defaultChecked: true }),
      Object.freeze({ field: "closing", includeField: "include_closing", label: "Deposit request closing", rows: 3, defaultChecked: true })
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

function paymentSectionKey(paymentId, sectionKind) {
  return `${String(paymentId || "").trim()}:${String(sectionKind || "").trim().toLowerCase()}`;
}

export function createBookingPaymentFlowModule(ctx) {
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
  } = ctx;

  const paymentSectionBusyKeys = new Set();
  const paymentSectionStatusByKey = new Map();
  const paymentReceiptDrafts = new Map();

  function withBookingLanguageQuery(urlLike) {
    const normalizedUrl = String(urlLike || "").trim();
    if (!normalizedUrl) return "";
    const url = new URL(normalizedUrl, window.location.origin);
    const query = bookingLanguageQuery();
    url.searchParams.set("content_lang", query.content_lang);
    url.searchParams.set("source_lang", query.source_lang);
    return url.toString();
  }

  function currentOfferPaymentTerms() {
    const draftTerms = state.offerDraft?.payment_terms;
    if (state.booking?.accepted_record?.payment_terms && typeof state.booking.accepted_record.payment_terms === "object") {
      return state.booking.accepted_record.payment_terms;
    }
    if (state.booking?.accepted_payment_terms_snapshot && typeof state.booking.accepted_payment_terms_snapshot === "object") {
      return state.booking.accepted_payment_terms_snapshot;
    }
    if (draftTerms && typeof draftTerms === "object") return draftTerms;
    if (state.booking?.offer?.payment_terms && typeof state.booking.offer.payment_terms === "object") {
      return state.booking.offer.payment_terms;
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
      state.booking?.accepted_record?.payment_terms?.currency
      || state.booking?.accepted_payment_terms_snapshot?.currency
      || state.booking?.accepted_record?.accepted_deposit_currency
      || state.offerDraft?.payment_terms?.currency
      || state.offerDraft?.currency
      || state.booking?.offer?.payment_terms?.currency
      || state.booking?.offer?.currency
      || state.booking?.preferred_currency
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

  function paymentTermLineId(line, index) {
    return String(line?.id || `payment_term_line_${index + 1}`).trim();
  }

  function paymentLineReceiptDefaults(payment) {
    const latestConfirmation = latestPaymentDocumentFor(payment, PAYMENT_DOCUMENT_KIND_CONFIRMATION);
    if (latestConfirmation) {
      return {
        received_at: normalizeDateInputValue(latestConfirmation.payment_received_at),
        confirmed_by_atp_staff_id: String(latestConfirmation.payment_confirmed_by_atp_staff_id || "").trim(),
        reference: String(latestConfirmation.payment_reference || "").trim()
      };
    }
    if (payment?.kind === "DEPOSIT") {
      return {
        received_at: normalizeDateInputValue(state.booking?.deposit_received_at),
        confirmed_by_atp_staff_id: String(state.booking?.deposit_confirmed_by_atp_staff_id || "").trim(),
        reference: String(state.booking?.accepted_deposit_reference || "").trim()
      };
    }
    return {
      received_at: "",
      confirmed_by_atp_staff_id: "",
      reference: ""
    };
  }

  function paymentReceiptDraft(payment) {
    const paymentId = String(payment?.id || "").trim();
    const draft = paymentReceiptDrafts.get(paymentId);
    if (draft) return draft;
    return paymentLineReceiptDefaults(payment);
  }

  function currentPaymentLines() {
    const lines = currentOfferPaymentTermLines();
    return lines.map((line, index) => {
      const id = paymentTermLineId(line, index);
      const kind = String(line?.kind || "").trim().toUpperCase() || "INSTALLMENT";
      const label = String(line?.label || "").trim();
      const receipt = paymentReceiptDrafts.get(id);
      const fallbackReceipt = receipt || paymentLineReceiptDefaults({ id, kind });
      return {
        id,
        payment_term_line_id: id,
        kind,
        label,
        net_amount_cents: resolvePaymentTermLineAmount(line, 0),
        origin_payment_term_line_id: id,
        received_at: fallbackReceipt.received_at || null,
        confirmed_by_atp_staff_id: fallbackReceipt.confirmed_by_atp_staff_id || null,
        reference: fallbackReceipt.reference || null
      };
    });
  }

  function paymentTermLineForPayment(payment) {
    const lineId = String(payment?.payment_term_line_id || payment?.origin_payment_term_line_id || payment?.id || "").trim();
    const lines = currentOfferPaymentTermLines();
    return lines.find((line, index) => paymentTermLineId(line, index) === lineId) || null;
  }

  function paymentKind(payment) {
    if (String(payment?.kind || "").trim()) return String(payment.kind).trim().toUpperCase();
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
    const installmentNumber = currentPaymentLines()
      .slice(0, index + 1)
      .filter((entry) => paymentKind(entry) === "INSTALLMENT")
      .length;
    return bookingT("booking.pricing.installment_number", "Installment {count}", { count: String(installmentNumber || index + 1) });
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
    return Array.isArray(state.paymentDocuments) ? state.paymentDocuments : [];
  }

  function paymentDocumentScope(payment, documentKind) {
    const kind = paymentKind(payment);
    if (documentKind === PAYMENT_DOCUMENT_KIND_REQUEST) {
      if (kind === "DEPOSIT") return "payment_request_deposit";
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

  function paymentDocumentSectionKey(paymentId, sectionKind) {
    return `${String(paymentId || "").trim()}:${String(sectionKind || "").trim()}`;
  }

  function captureOpenPaymentDocumentSections(root) {
    if (!(root instanceof HTMLElement)) return new Set();
    return new Set(
      Array.from(root.querySelectorAll("[data-payment-document-section]"))
        .filter((panel) => panel instanceof HTMLElement && panel.classList.contains("is-open"))
        .map((panel) => String(panel.getAttribute("data-payment-document-section") || "").trim())
        .filter(Boolean)
    );
  }

  function restoreOpenPaymentDocumentSections(root, openKeys) {
    if (!(root instanceof HTMLElement) || !(openKeys instanceof Set) || !openKeys.size) return;
    root.querySelectorAll("[data-payment-document-section]").forEach((panel) => {
      if (!(panel instanceof HTMLElement)) return;
      const key = String(panel.getAttribute("data-payment-document-section") || "").trim();
      if (!openKeys.has(key)) return;
      setBookingSectionOpen(panel, true, { animate: false });
    });
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
              >${escapeHtml(doc.document_number || doc.title || doc.id || bookingT("booking.pdf", "PDF"))}</a>
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
            >${escapeHtml(bookingT("booking.travel_plan.upload_additional_pdfs", "Add attachment"))}</button>
          </div>
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

  function paymentSnapshotMarkup(payment) {
    const generatedOffer = latestGeneratedOffer();
    if (!generatedOffer) {
      return `<div class="micro">${escapeHtml(bookingT("booking.pricing.snapshot_pending", "The payment snapshot will link to the latest generated offer PDF after you generate one."))}</div>`;
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
    const fallbackReceipt = paymentReceiptDraft(payment);
    const receivedAt = dateInput instanceof HTMLInputElement
      ? normalizeLocalDateToIso(dateInput.value || "")
      : normalizeDateInputValue(fallbackReceipt.received_at);
    const confirmedByAtpStaffId = confirmedByInput instanceof HTMLSelectElement
      ? String(confirmedByInput.value || "").trim()
      : String(fallbackReceipt.confirmed_by_atp_staff_id || "").trim();
    const reference = referenceInput instanceof HTMLInputElement
      ? String(referenceInput.value || "").trim()
      : String(fallbackReceipt.reference || "").trim();
    const hasAnyValue = Boolean(
      receivedAt
      || confirmedByAtpStaffId
      || reference
    );
    if (strict && hasAnyValue) {
      if (!receivedAt) {
        throw new Error(bookingT("booking.pricing.error.payment_received_date_required", "When received is required once receipt details are entered."));
      }
      if (!confirmedByAtpStaffId) {
        throw new Error(bookingT("booking.pricing.error.payment_confirmed_by_required", "Confirmed by is required once receipt details are entered."));
      }
    }
    const hasRecordedReceipt = Boolean(receivedAt && confirmedByAtpStaffId);
    return {
      hasAnyValue,
      hasRecordedReceipt,
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
      dataAttributes: {
        paymentDocumentSection: paymentDocumentSectionKey(paymentId, sectionKind)
      },
      personalizationMarkup: paymentDocumentPersonalizationPanelMarkup(scope, prefix, { disabled: Boolean(disabledReason) }),
      workspaceMarkup: paymentDocumentWorkspaceMarkup(payment, documentKind, paymentId, sectionKind, { disabledReason })
    });
  }

  function paymentReceivedSectionMarkup(payment, index, currency) {
    const paymentId = String(payment?.id || "").trim();
    const receipt = paymentReceiptDraft(payment);
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
              value="${escapeHtml(normalizeDateInputValue(receipt.received_at))}"
              ${!state.permissions.canEditBooking ? "disabled" : ""}
            />
          </div>
          <div class="field">
            <label for="payment_confirmed_by_${escapeHtml(paymentId)}">${escapeHtml(bookingT("booking.pricing.confirmed_by", "Confirmed by"))}</label>
            <select
              id="payment_confirmed_by_${escapeHtml(paymentId)}"
              data-payment-confirmed-by="${escapeHtml(paymentId)}"
              ${!state.permissions.canEditBooking ? "disabled" : ""}
            >${buildAtpStaffOptions(String(receipt.confirmed_by_atp_staff_id || "").trim())}</select>
          </div>
          <div class="field">
            <label for="payment_reference_${escapeHtml(paymentId)}">${escapeHtml(bookingT("booking.pricing.receipt_reference", "Receipt reference"))}</label>
            <input
              id="payment_reference_${escapeHtml(paymentId)}"
              type="text"
              data-payment-reference="${escapeHtml(paymentId)}"
              value="${escapeHtml(String(receipt.reference || "").trim())}"
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

  function paymentSectionSummaryMarkup(payment, index, currency) {
    const amountLabel = formatMoneyDisplay(payment?.net_amount_cents || 0, currency || currentOfferCurrency());
    return `
      <span class="booking-payment-section__head">
        <span class="booking-payment-section__copy">
          <span class="booking-payment-section__title">${escapeHtml(paymentTitle(payment, index))}</span>
        </span>
        <span class="booking-payment-section__amount">${escapeHtml(amountLabel)}</span>
      </span>
    `;
  }

  function paymentStageMarkup(payment, index, currency) {
    return `
      <article class="booking-section booking-payment-step-panel is-open" data-payment-id="${escapeHtml(String(payment?.id || "").trim())}">
        <div class="booking-section__head">
          <button
            class="booking-section__summary booking-section__summary--inline-pad-16"
            id="payment_section_summary_${escapeHtml(String(payment?.id || index + 1).trim())}"
            type="button"
          >${paymentSectionSummaryMarkup(payment, index, currency)}</button>
        </div>
        <div class="booking-section__body">
          <div class="booking-payment-section__body">
            ${paymentDocumentSectionMarkup(
              payment,
              index,
              PAYMENT_DOCUMENT_KIND_REQUEST,
              bookingT("booking.pricing.request_pdfs", "Request payment")
            )}
            ${paymentReceivedSectionMarkup(payment, index, currency)}
            ${paymentDocumentSectionMarkup(
              payment,
              index,
              PAYMENT_DOCUMENT_KIND_CONFIRMATION,
              bookingT("booking.pricing.customer_receipt", "Confirm payment")
            )}
          </div>
        </div>
      </article>
    `;
  }

  function bindPaymentReceiptDraftInputs(root) {
    if (!(root instanceof HTMLElement)) return;
    const persistDraft = (paymentId) => {
      const payment = findPaymentById(paymentId);
      if (!payment) return;
      const receipt = paymentReceiptFieldValues(payment, { strict: false });
      paymentReceiptDrafts.set(paymentId, {
        received_at: receipt.received_at || "",
        confirmed_by_atp_staff_id: receipt.confirmed_by_atp_staff_id || "",
        reference: receipt.reference || ""
      });
    };
    root.querySelectorAll("[data-payment-received-at], [data-payment-confirmed-by], [data-payment-reference]").forEach((input) => {
      const persistCurrentInput = () => {
        const paymentId = String(
          input.getAttribute("data-payment-received-at")
          || input.getAttribute("data-payment-confirmed-by")
          || input.getAttribute("data-payment-reference")
          || ""
        ).trim();
        if (!paymentId) return;
        persistDraft(paymentId);
      };
      input.addEventListener("input", persistCurrentInput);
      input.addEventListener("change", persistCurrentInput);
    });
  }

  function renderPaymentFlowSections() {
    if (!(els.paymentFlowSections instanceof HTMLElement)) return;
    const openPaymentDocumentSections = captureOpenPaymentDocumentSections(els.paymentFlowSections);
    const payments = currentPaymentLines();
    const currency = currentOfferCurrency();
    if (!payments.length) {
      els.paymentFlowSections.hidden = true;
      els.paymentFlowSections.innerHTML = "";
      return;
    }
    els.paymentFlowSections.hidden = false;
    els.paymentFlowSections.innerHTML = payments.map((payment, index) => paymentStageMarkup(payment, index, currency)).join("");
    initializeBookingSections(els.paymentFlowSections);
    restoreOpenPaymentDocumentSections(els.paymentFlowSections, openPaymentDocumentSections);
    bindPaymentDocumentActions(els.paymentFlowSections);
    bindPaymentReceiptDraftInputs(els.paymentFlowSections);
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

  function paymentDocumentPayload(payment, documentKind, pdfPersonalization, options = {}) {
    const receipt = paymentReceiptFieldValues(payment, {
      strict: documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION
    });
    paymentReceiptDrafts.set(String(payment?.id || "").trim(), {
      received_at: receipt.received_at || "",
      confirmed_by_atp_staff_id: receipt.confirmed_by_atp_staff_id || "",
      reference: receipt.reference || ""
    });
    return {
      expected_payment_documents_revision: getBookingRevision("payment_documents_revision"),
      payment_id: String(payment?.id || "").trim(),
      document_kind: documentKind,
      lang: bookingContentLang(),
      content_lang: bookingContentLang(),
      source_lang: bookingSourceLang(),
      payment_received_at: receipt.received_at,
      payment_confirmed_by_atp_staff_id: receipt.confirmed_by_atp_staff_id,
      payment_reference: receipt.reference,
      payment_confirmed_by_label: documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION
        ? (resolveAtpStaffLabel(receipt.confirmed_by_atp_staff_id) || null)
        : null,
      pdf_personalization: pdfPersonalization,
      actor: state.user || null,
      ...options
    };
  }

  async function createLinkedPaymentDocument(payment, documentKind, pdfPersonalization) {
    const payload = {
      ...paymentDocumentPayload(payment, documentKind, pdfPersonalization)
    };
    const request = bookingPaymentDocumentCreateRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id }
    });
    return fetchBookingMutation(request.url, {
      method: request.method,
      body: payload
    });
  }

  function openPaymentPreviewWindow() {
    const previewWindow = window.open("", "_blank");
    if (!previewWindow) return null;
    previewWindow.document.title = bookingT("booking.travel_plan.preview_pdf", "Preview PDF");
    previewWindow.document.documentElement.innerHTML = `
      <head>
        <title>${escapeHtml(bookingT("booking.travel_plan.preview_pdf", "Preview PDF"))}</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            background: rgba(245, 241, 232, 0.78);
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .booking-page-overlay__panel {
            min-width: min(28rem, calc(100vw - 3rem));
            max-width: 32rem;
            display: grid;
            justify-items: center;
            gap: 0.9rem;
            padding: 1.45rem 1.6rem;
            border: 1px solid rgba(202, 191, 173, 0.9);
            border-radius: 24px;
            background: rgba(255, 255, 255, 0.96);
            box-shadow: 0 24px 48px rgba(24, 35, 52, 0.16);
            text-align: center;
          }
          .booking-page-overlay__spinner {
            width: 2.2rem;
            height: 2.2rem;
            border: 3px solid rgba(202, 191, 173, 0.9);
            border-top-color: rgba(84, 93, 105, 1);
            border-radius: 999px;
            animation: booking-inline-status-spin 0.8s linear infinite;
          }
          .booking-page-overlay__text {
            color: rgba(35, 52, 73, 1);
            font-size: 1rem;
            font-weight: 600;
          }
          @keyframes booking-inline-status-spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="booking-page-overlay__panel" role="status" aria-live="polite">
          <span class="booking-page-overlay__spinner" aria-hidden="true"></span>
          <span class="booking-page-overlay__text">${escapeHtml(bookingT("booking.pricing.creating_pdf", "Creating..."))}</span>
        </div>
      </body>
    `;
    return previewWindow;
  }

  async function previewLinkedPaymentDocument(payment, documentKind, pdfPersonalization, previewWindow) {
    const request = bookingPaymentDocumentCreateRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id },
      query: {
        ...bookingLanguageQuery(),
        preview: "1"
      }
    });
    const payload = paymentDocumentPayload(payment, documentKind, pdfPersonalization);
    const response = await fetch(request.url, {
      method: request.method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      const requestFailed = bookingT("booking.error.request_failed", "Request failed");
      const message = errorPayload?.detail
        ? `${errorPayload.error || requestFailed}: ${errorPayload.detail}`
        : errorPayload?.error || requestFailed;
      throw new Error(message);
    }
    const pdfBlob = await response.blob();
    const objectUrl = URL.createObjectURL(pdfBlob);
    previewWindow.location.replace(objectUrl);
    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60_000);
    return true;
  }

  function hasPendingOfferChanges() {
    return Boolean(state.dirty.offer || state.dirty.payment_terms);
  }

  function persistedPaymentById(paymentId) {
    const normalizedId = String(paymentId || "").trim();
    if (!normalizedId) return null;
    return currentPaymentLines().find((payment) => String(payment?.id || "").trim() === normalizedId) || null;
  }

  async function createPaymentDocument(paymentId, documentKind, options = {}) {
    const payment = findPaymentById(paymentId);
    if (!payment || !state.permissions.canEditBooking) return false;
    const sectionKind = documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION ? "confirmation" : "request";
    const disabledReason = documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION
      ? paymentConfirmationDisabledReason(payment)
      : "";
    if (disabledReason) {
      setPaymentSectionState(paymentId, sectionKind, disabledReason, "info");
      renderPaymentFlowPanel();
      return false;
    }
    if (hasPendingOfferChanges()) {
      setPaymentSectionState(paymentId, sectionKind, bookingT("booking.offer.save_required_for_payments", "Save offer edits before creating payment documents."), "info");
      renderPaymentFlowPanel();
      return false;
    }
    const scope = paymentDocumentScope(payment, documentKind);
    const prefix = paymentDocumentPanelPrefix(payment, documentKind);
    const pdfPersonalization = collectPaymentDocumentPersonalization(scope, prefix);
    const openAfterCreate = options?.openAfterCreate === true;
    setPaymentSectionState(paymentId, sectionKind, "");
    const latestPayment = persistedPaymentById(paymentId);
    if (!latestPayment) {
      setPaymentSectionState(paymentId, sectionKind, bookingT("booking.pricing.payment_not_found", "This payment could not be found."), "error");
      renderPaymentFlowPanel();
      return false;
    }
    setPaymentSectionBusy(paymentId, sectionKind, true);
    renderPaymentFlowPanel();
    const result = await createLinkedPaymentDocument(latestPayment, documentKind, pdfPersonalization);
    setPaymentSectionBusy(paymentId, sectionKind, false);
    if (!result?.document || !result?.booking) {
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
      renderPaymentFlowPanel();
      return false;
    }
    state.booking = result.booking;
    renderBookingHeader();
    renderBookingData();
    renderActionControls?.();
    await loadPaymentDocuments?.();
    if (openAfterCreate) {
      openPaymentDocumentUrl(result.document?.pdf_url || "");
    }
    if (options?.suppressSuccessMessage === true) {
      setPaymentSectionState(paymentId, sectionKind, "");
    } else {
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
    }
    renderPaymentFlowPanel();
    await loadActivities();
    return true;
  }

  async function previewPaymentDocument(paymentId, documentKind) {
    const payment = findPaymentById(paymentId);
    if (!payment) return false;
    const sectionKind = documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION ? "confirmation" : "request";
    const scope = paymentDocumentScope(payment, documentKind);
    const prefix = paymentDocumentPanelPrefix(payment, documentKind);
    const disabledReason = documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION
      ? paymentConfirmationDisabledReason(payment)
      : "";
    if (disabledReason) {
      setPaymentSectionState(paymentId, sectionKind, disabledReason, "info");
      renderPaymentFlowPanel();
      return false;
    }
    if (hasPendingOfferChanges()) {
      setPaymentSectionState(paymentId, sectionKind, bookingT("booking.offer.save_required_for_payments", "Save offer edits before creating payment documents."), "info");
      renderPaymentFlowPanel();
      return false;
    }
    const pdfPersonalization = collectPaymentDocumentPersonalization(scope, prefix);
    const previewWindow = openPaymentPreviewWindow();
    if (!previewWindow) {
      setPaymentSectionState(paymentId, sectionKind, bookingT("booking.travel_plan.preview_popup_blocked", "Allow pop-ups to preview the PDF."), "error");
      renderPaymentFlowPanel();
      return false;
    }
    setPaymentSectionState(paymentId, sectionKind, "");
    const latestPayment = persistedPaymentById(paymentId);
    if (!latestPayment) {
      previewWindow.close();
      setPaymentSectionState(paymentId, sectionKind, bookingT("booking.pricing.payment_not_found", "This payment could not be found."), "error");
      renderPaymentFlowPanel();
      return false;
    }
    setPaymentSectionBusy(paymentId, sectionKind, true);
    renderPaymentFlowPanel();
    try {
      await previewLinkedPaymentDocument(latestPayment, documentKind, pdfPersonalization, previewWindow);
      setPaymentSectionBusy(paymentId, sectionKind, false);
      setPaymentSectionState(paymentId, sectionKind, "");
      renderPaymentFlowPanel();
      return true;
    } catch (error) {
      previewWindow.close();
      setPaymentSectionBusy(paymentId, sectionKind, false);
      setPaymentSectionState(
        paymentId,
        sectionKind,
        String(error?.message || bookingT("booking.pricing.preview_pdf_failed", "Could not open the preview PDF.")),
        "error"
      );
      renderPaymentFlowPanel();
      return false;
    }

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

  function findPaymentById(paymentId) {
    const normalizedId = String(paymentId || "").trim();
    if (!normalizedId) return null;
    return currentPaymentLines().find(
      (payment) => String(payment?.id || "").trim() === normalizedId
    ) || null;
  }

  function renderPaymentFlowPanel() {
    if (!(els.paymentFlowSections instanceof HTMLElement) || !state.booking) return;
    if (hasPaymentTermsFoundation()) {
      renderPaymentFlowSections();
    } else {
      renderPaymentFoundationMessage();
    }
  }

  return {
    renderPaymentFlowPanel
  };
}
