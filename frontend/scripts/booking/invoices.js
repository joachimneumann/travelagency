import {
  bookingInvoiceCreateRequest,
  bookingInvoiceUpdateRequest,
  bookingInvoicesRequest
} from "../../Generated/API/generated_APIRequestFactory.js?v=f09b901159f7";
import {
  formatMoneyDisplay,
  formatMoneyInputValue,
  isWholeUnitCurrency,
  normalizeCurrencyCode,
  parseMoneyInputValue,
  setSelectValue
} from "./pricing.js?v=f09b901159f7";
import { bookingContentLang, bookingT } from "./i18n.js?v=f09b901159f7";
import {
  buildDualLocalizedPayload,
  renderLocalizedSplitField,
  requestBookingFieldTranslation,
  resolveLocalizedEditorText
} from "./localized_editor.js?v=f09b901159f7";

export function formatDateInput(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function plusOneMonthDateInput(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + 1);
  if (d.getDate() < originalDay) {
    d.setDate(0);
  }
  return formatDateInput(d);
}

function invoiceStatusLabel(status) {
  const normalized = String(status || "").trim().toUpperCase();
  const fallback = normalized
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return bookingT(`booking.invoice_status.${normalized.toLowerCase()}`, fallback || normalized || "-");
}

function normalizeDateInput(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function createBookingInvoicesModule(ctx) {
  const {
    state,
    els,
    apiBase,
    apiOrigin,
    fetchApi,
    fetchBookingMutation,
    getBookingRevision,
    renderBookingHeader,
    renderBookingData,
    renderOfferPanel,
    renderPricingPanel,
    escapeHtml,
    formatDateTime,
    captureControlSnapshot,
    setBookingSectionDirty
  } = ctx;

  function setInvoiceStatus(message) {
    if (!els.invoice_status) return;
    els.invoice_status.textContent = message;
  }

  function clearInvoiceStatus() {
    setInvoiceStatus("");
  }

  function normalizeInvoiceStatus(value) {
    return String(value || "").trim().toUpperCase() || "DRAFT";
  }

  function currentSelectedInvoice() {
    return state.invoices.find((item) => item.id === state.selectedInvoiceId) || null;
  }

  function isInvoiceCurrencyEditable(invoice = null) {
    if (!state.permissions.canEditBooking) return false;
    const targetInvoice = invoice || currentSelectedInvoice();
    return normalizeInvoiceStatus(targetInvoice?.status) === "DRAFT";
  }

  function refreshInvoiceInputRefs() {
    const targetLang = bookingContentLang();
    els.invoice_title_input = document.querySelector('[data-invoice-localized-field="title"][data-localized-lang="en"][data-localized-role="source"]');
    els.invoice_title_localized_input = document.querySelector(`[data-invoice-localized-field="title"][data-localized-lang="${targetLang}"][data-localized-role="target"]`);
    els.invoice_components_input = document.querySelector('[data-invoice-localized-field="components"][data-localized-lang="en"][data-localized-role="source"]');
    els.invoice_components_localized_input = document.querySelector(`[data-invoice-localized-field="components"][data-localized-lang="${targetLang}"][data-localized-role="target"]`);
    els.invoice_components_label = document.getElementById("invoice_components_label");
    els.invoice_notes_input = document.querySelector('[data-invoice-localized-field="notes"][data-localized-lang="en"][data-localized-role="source"]');
    els.invoice_notes_localized_input = document.querySelector(`[data-invoice-localized-field="notes"][data-localized-lang="${targetLang}"][data-localized-role="target"]`);
  }

  function invoiceComponentsToText(components, currency, lang = bookingContentLang()) {
    return (Array.isArray(components) ? components : [])
      .map((component) => {
        const description = resolveLocalizedEditorText(
          component?.description_i18n ?? component?.description,
          lang,
          component?.description || ""
        );
        return `${description || ""} | ${Number(component?.quantity || 1)} | ${formatMoneyInputValue(component?.unit_amount_cents || 0, currency || "USD")}`;
      })
      .join("\n");
  }

  function renderInvoiceLocalizedFields(invoice = null) {
    const targetLang = bookingContentLang();
    const currency = normalizeCurrencyCode(invoice?.currency || els.invoice_currency_input?.value || "USD");

    if (els.invoice_title_field) {
      els.invoice_title_field.innerHTML = renderLocalizedSplitField({
        escapeHtml,
        idBase: "invoice_title_input",
        label: bookingT("booking.invoice_title", "Title"),
        labelId: "invoice_title_label",
        type: "input",
        targetLang,
        disabled: !state.permissions.canEditBooking,
        translateEnabled: Boolean(state.booking?.translation_enabled),
        englishValue: resolveLocalizedEditorText(invoice?.title_i18n ?? invoice?.title, "en", ""),
        localizedValue: resolveLocalizedEditorText(invoice?.title_i18n ?? invoice?.title, targetLang, ""),
        englishPlaceholder: bookingT("booking.invoice_title_placeholder", "Invoice title"),
        localizedPlaceholder: bookingT("booking.invoice_title_placeholder", "Invoice title"),
        commonData: { "invoice-localized-field": "title" },
        translatePayload: { "invoice-translate-field": "title" }
      });
    }

    if (els.invoice_components_field) {
      els.invoice_components_field.innerHTML = renderLocalizedSplitField({
        escapeHtml,
        idBase: "invoice_components_input",
        label: bookingT(
          "booking.invoice_components_currency",
          "Components (one per line: Description | Quantity | Unit amount in {currency})",
          { currency }
        ),
        labelId: "invoice_components_label",
        type: "textarea",
        rows: 5,
        targetLang,
        disabled: !state.permissions.canEditBooking,
        translateEnabled: Boolean(state.booking?.translation_enabled),
        englishValue: invoiceComponentsToText(invoice?.components || [], currency, "en"),
        localizedValue: invoiceComponentsToText(invoice?.components || [], currency, targetLang),
        englishPlaceholder: bookingT("booking.invoice_components_placeholder", "Example: Custom Vietnam route | 2 | 245000"),
        localizedPlaceholder: bookingT("booking.invoice_components_placeholder", "Example: Custom Vietnam route | 2 | 245000"),
        commonData: { "invoice-localized-field": "components" },
        translatePayload: { "invoice-translate-field": "components" }
      });
    }

    if (els.invoice_notes_field) {
      els.invoice_notes_field.innerHTML = renderLocalizedSplitField({
        escapeHtml,
        idBase: "invoice_notes_input",
        label: bookingT("booking.invoice_note", "Invoice Note"),
        labelId: "invoice_notes_label",
        type: "textarea",
        rows: 3,
        targetLang,
        disabled: !state.permissions.canEditBooking,
        translateEnabled: Boolean(state.booking?.translation_enabled),
        englishValue: resolveLocalizedEditorText(invoice?.notes_i18n ?? invoice?.notes, "en", ""),
        localizedValue: resolveLocalizedEditorText(invoice?.notes_i18n ?? invoice?.notes, targetLang, ""),
        commonData: { "invoice-localized-field": "notes" },
        translatePayload: { "invoice-translate-field": "notes" }
      });
    }

    refreshInvoiceInputRefs();
    applyInvoicePermissions();
    renderInvoiceMoneyLabels();
  }

  function updateInvoiceDirtyState() {
    const isDirty =
      state.permissions.canEditBooking &&
      captureControlSnapshot(els.invoice_panel) !== state.originalInvoiceSnapshot;
    setBookingSectionDirty("invoice", isDirty);
  }

  function markInvoiceSnapshotClean() {
    state.originalInvoiceSnapshot = captureControlSnapshot(els.invoice_panel);
    setBookingSectionDirty("invoice", false);
  }

  function renderInvoiceMoneyLabels() {
    const currency = normalizeCurrencyCode(els.invoice_currency_input?.value || "USD");
    if (els.invoice_due_amount_label) {
      els.invoice_due_amount_label.textContent = bookingT(
        "booking.invoice_due_amount_currency",
        "Due amount ({currency}, optional)",
        { currency }
      );
    }
    if (els.invoice_components_label) {
      els.invoice_components_label.textContent = bookingT(
        "booking.invoice_components_currency",
        "Components (one per line: Description | Quantity | Unit amount in {currency})",
        { currency }
      );
    }
    if (els.invoice_due_amount_input) {
      els.invoice_due_amount_input.step = isWholeUnitCurrency(currency) ? "1" : "0.01";
    }
    if (els.invoice_number_input) {
      els.invoice_number_input.placeholder = bookingT("booking.invoice_number_placeholder", "Auto-generated if empty");
    }
  }

  function applyInvoicePermissions() {
    const disabled = !state.permissions.canEditBooking;
    [
      els.invoice_select,
      els.invoice_number_input,
      els.invoice_issue_date_input,
      els.invoice_issue_today_btn,
      els.invoice_due_date_input,
      els.invoice_due_month_btn,
      els.invoice_due_amount_input,
      els.invoice_vat_input,
      els.invoice_create_btn
    ].forEach((el) => {
      if (el) el.disabled = disabled;
    });
    if (els.invoice_currency_input) {
      els.invoice_currency_input.disabled = !isInvoiceCurrencyEditable();
    }
    els.invoice_panel?.querySelectorAll('[data-invoice-localized-field]').forEach((el) => {
      const isTargetPane = el.getAttribute("data-localized-role") === "target";
      el.disabled = disabled || (isTargetPane && bookingContentLang() === "en");
    });
  }

  function renderInvoicesTable() {
    if (!els.invoices_table) return;
    const rows = state.invoices
      .map((invoice) => {
        const checked = invoice.sent_to_recipient ? "checked" : "";
        const disabled = !state.permissions.canEditBooking ? "disabled" : "";
        return `<tr>
        <td><a class="btn btn-ghost" href="${escapeHtml(`${apiBase}/api/v1/invoices/${encodeURIComponent(invoice.id)}/pdf`)}" target="_blank" rel="noopener">${escapeHtml(bookingT("booking.pdf", "PDF"))}</a></td>
        <td>${escapeHtml(invoice.invoice_number || shortId(invoice.id))}</td>
        <td>${escapeHtml(String(invoice.version || 1))}</td>
        <td><input type="checkbox" data-invoice-sent="${escapeHtml(invoice.id)}" ${checked} ${disabled} /></td>
        <td>${escapeHtml(formatMoneyDisplay(invoice.total_amount_cents || 0, invoice.currency || "USD"))}</td>
        <td>${escapeHtml(formatDateTime(invoice.updated_at))}</td>
        <td><button type="button" class="btn btn-ghost" data-select-invoice="${escapeHtml(invoice.id)}">${escapeHtml(bookingT("common.load_data", "Load data"))}</button></td>
      </tr>`;
      })
      .join("");
    const header = `<thead><tr><th></th><th>${escapeHtml(bookingT("booking.invoice", "Invoice"))}</th><th>${escapeHtml(bookingT("booking.version", "Version"))}</th><th>${escapeHtml(bookingT("booking.sent", "Sent"))}</th><th>${escapeHtml(bookingT("booking.total", "Total"))}</th><th>${escapeHtml(bookingT("booking.updated", "Updated"))}</th><th></th></tr></thead>`;
    const body = rows || `<tr><td colspan="7">${escapeHtml(bookingT("booking.no_invoices", "No invoices"))}</td></tr>`;
    els.invoices_table.innerHTML = `${header}<tbody>${body}</tbody>`;
    els.invoices_table.querySelectorAll("[data-select-invoice]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = String(button.getAttribute("data-select-invoice") || "");
        state.selectedInvoiceId = id;
        const invoice = state.invoices.find((item) => item.id === id);
        if (invoice) fillInvoiceForm(invoice);
      });
    });
    els.invoices_table.querySelectorAll("[data-invoice-sent]").forEach((input) => {
      input.addEventListener("change", async () => {
        const invoiceId = String(input.getAttribute("data-invoice-sent") || "");
        await toggleInvoiceSent(invoiceId, Boolean(input.checked));
      });
    });
  }

  async function loadInvoices() {
    if (!state.booking) return;
    const request = bookingInvoicesRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id },
      query: { lang: bookingContentLang() }
    });
    const payload = await fetchApi(request.url, { method: request.method });
    if (!payload) return;
    state.invoices = (Array.isArray(payload.items) ? payload.items : []).sort((a, b) =>
      String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""))
    );
    renderInvoicesTable();
    populateInvoiceSelect();
    const selected = state.invoices.find((item) => item.id === state.selectedInvoiceId);
    if (selected) fillInvoiceForm(selected);
    else resetInvoiceForm();
  }

  function populateInvoiceSelect() {
    if (!els.invoice_select) return;
    const options = [`<option value="">${escapeHtml(bookingT("booking.new_invoice", "New invoice"))}</option>`]
      .concat(
        state.invoices.map(
          (invoice) =>
            `<option value="${escapeHtml(invoice.id)}">${escapeHtml(invoice.invoice_number || shortId(invoice.id))} (${escapeHtml(invoiceStatusLabel(invoice.status || "DRAFT"))})</option>`
        )
      )
      .join("");
    els.invoice_select.innerHTML = options;
    els.invoice_select.value = state.selectedInvoiceId || "";
  }

  function onInvoiceSelectChange() {
    const id = String(els.invoice_select?.value || "");
    state.selectedInvoiceId = id;
    if (!id) {
      resetInvoiceForm();
      return;
    }
    clearInvoiceStatus();
    const invoice = state.invoices.find((item) => item.id === id);
    if (invoice) fillInvoiceForm(invoice);
  }

  function fillInvoiceForm(invoice) {
    state.selectedInvoiceId = invoice.id;
    if (els.invoice_select) els.invoice_select.value = invoice.id;
    if (els.invoice_number_input) els.invoice_number_input.value = invoice.invoice_number || "";
    if (els.invoice_currency_input) setSelectValue(els.invoice_currency_input, invoice.currency || "USD");
    renderInvoiceLocalizedFields(invoice);
    if (els.invoice_issue_date_input) els.invoice_issue_date_input.value = normalizeDateInput(invoice.issue_date);
    if (els.invoice_due_date_input) els.invoice_due_date_input.value = normalizeDateInput(invoice.due_date);
    if (els.invoice_due_amount_input) {
      els.invoice_due_amount_input.value = invoice.due_amount_cents
        ? formatMoneyInputValue(invoice.due_amount_cents, invoice.currency || "USD")
        : "";
    }
    if (els.invoice_vat_input) {
      const vat = Number(invoice.vat_percentage || 0);
      els.invoice_vat_input.value = Number.isFinite(vat) ? String(vat) : "0";
    }
    clearInvoiceStatus();
    renderInvoiceMoneyLabels();
    applyInvoicePermissions();
    markInvoiceSnapshotClean();
  }

  function resetInvoiceForm() {
    state.selectedInvoiceId = "";
    if (els.invoice_select) els.invoice_select.value = "";
    if (els.invoice_number_input) els.invoice_number_input.value = "";
    if (els.invoice_currency_input) setSelectValue(els.invoice_currency_input, "USD");
    renderInvoiceLocalizedFields(null);
    if (els.invoice_issue_date_input) els.invoice_issue_date_input.value = "";
    if (els.invoice_due_date_input) els.invoice_due_date_input.value = "";
    if (els.invoice_due_amount_input) els.invoice_due_amount_input.value = "";
    if (els.invoice_vat_input) els.invoice_vat_input.value = "0";
    clearInvoiceStatus();
    renderInvoiceMoneyLabels();
    applyInvoicePermissions();
    markInvoiceSnapshotClean();
  }

  function parseInvoiceComponentsText(text, currency) {
    const lines = String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const components = [];
    for (const line of lines) {
      const parts = line.split("|").map((value) => value.trim());
      if (parts.length < 3) {
        throw new Error(
          bookingT(
            "booking.invoice_error.invalid_line",
            'Invalid line: "{line}". Use "Description | Quantity | Unit amount".',
            { line }
          )
        );
      }
      const description = parts[0];
      const quantity = Number(parts[1]);
      const unitAmountCents = parseMoneyInputValue(parts[2], currency);
      if (!description) {
        throw new Error(bookingT("booking.invoice_error.missing_description", 'Missing description in line: "{line}"', { line }));
      }
      if (!Number.isFinite(quantity) || quantity < 1) {
        throw new Error(bookingT("booking.invoice_error.invalid_quantity", 'Invalid quantity in line: "{line}"', { line }));
      }
      if (!Number.isFinite(unitAmountCents) || unitAmountCents < 1) {
        throw new Error(bookingT("booking.invoice_error.invalid_amount", 'Invalid amount in line: "{line}"', { line }));
      }
      components.push({
        description,
        quantity: Math.round(quantity),
        unit_amount_cents: Math.round(unitAmountCents)
      });
    }
    return components;
  }

  function parseLocalizedInvoiceDescriptions(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return "";
        const parts = trimmed.split("|").map((value) => value.trim());
        return String(parts[0] || "").trim();
      });
  }

  function serializeLocalizedInvoiceComponents(englishComponents, translatedDescriptions, currency) {
    return (Array.isArray(englishComponents) ? englishComponents : [])
      .map((component, index) => {
        const description = String(translatedDescriptions[index] || "").trim();
        return `${description} | ${Number(component.quantity || 1)} | ${formatMoneyInputValue(component.unit_amount_cents || 0, currency || "USD")}`;
      })
      .join("\n");
  }

  function collectInvoicePayload() {
    const currency = normalizeCurrencyCode(els.invoice_currency_input?.value || "USD");
    const englishTitle = String(els.invoice_title_input?.value || "").trim();
    const localizedTitle = bookingContentLang() === "en"
      ? ""
      : String(els.invoice_title_localized_input?.value || "").trim();
    const englishNotes = String(els.invoice_notes_input?.value || "").trim();
    const localizedNotes = bookingContentLang() === "en"
      ? ""
      : String(els.invoice_notes_localized_input?.value || "").trim();
    const englishComponents = parseInvoiceComponentsText(els.invoice_components_input?.value || "", currency);
    const localizedDescriptions = parseLocalizedInvoiceDescriptions(els.invoice_components_localized_input?.value || "");
    const titlePayload = buildDualLocalizedPayload(englishTitle, localizedTitle, bookingContentLang());
    const notesPayload = buildDualLocalizedPayload(englishNotes, localizedNotes, bookingContentLang());
    const components = englishComponents.map((component, index) => {
      const descriptionPayload = buildDualLocalizedPayload(
        component.description,
        localizedDescriptions[index] || "",
        bookingContentLang()
      );
      return {
        description: descriptionPayload.text,
        description_i18n: descriptionPayload.map,
        quantity: component.quantity,
        unit_amount_cents: component.unit_amount_cents
      };
    });

    const dueAmountRaw = String(els.invoice_due_amount_input?.value || "").trim();
    const dueAmount = dueAmountRaw ? parseMoneyInputValue(dueAmountRaw, currency) : null;
    if (dueAmountRaw && (!Number.isFinite(dueAmount) || dueAmount < 1)) {
      throw new Error(bookingT("booking.invoice_error.due_amount", "Due amount must be a positive number."));
    }

    const vatRaw = String(els.invoice_vat_input?.value || "").trim();
    const vat = vatRaw ? Number(vatRaw) : 0;
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
      throw new Error(bookingT("booking.invoice_error.vat", "VAT must be between 0 and 100."));
    }

    return {
      invoice_number: String(els.invoice_number_input?.value || "").trim(),
      currency,
      issue_date: String(els.invoice_issue_date_input?.value || "").trim(),
      due_date: String(els.invoice_due_date_input?.value || "").trim(),
      title: titlePayload.text,
      title_i18n: titlePayload.map,
      notes: notesPayload.text || null,
      notes_i18n: notesPayload.map,
      vat_percentage: vat,
      due_amount_cents: dueAmount ? Math.round(dueAmount) : null,
      components
    };
  }

  async function createInvoice() {
    if (!state.booking || !state.permissions.canEditBooking) return false;
    clearInvoiceStatus();
    let payload;
    try {
      payload = collectInvoicePayload();
    } catch (error) {
      setInvoiceStatus(String(error?.message || error));
      return false;
    }
    const isUpdate = Boolean(state.selectedInvoiceId);
    const request = isUpdate
      ? bookingInvoiceUpdateRequest({
          baseURL: apiOrigin,
          params: { booking_id: state.booking.id, invoice_id: state.selectedInvoiceId },
          query: { lang: bookingContentLang() }
        })
      : bookingInvoiceCreateRequest({
          baseURL: apiOrigin,
          params: { booking_id: state.booking.id },
          query: { lang: bookingContentLang() }
        });
    const result = await fetchApi(request.url, {
      method: request.method,
      body: {
        ...payload,
        lang: bookingContentLang(),
        expected_invoices_revision: getBookingRevision("invoices_revision")
      }
    });
    if (!result?.invoice) return false;
    if (result.booking) {
      state.booking = result.booking;
      renderBookingHeader();
      renderBookingData();
      renderOfferPanel();
      renderPricingPanel();
    }
    state.selectedInvoiceId = result.invoice.id;
    await loadInvoices();
    setInvoiceStatus(
      isUpdate
        ? bookingT("booking.invoice_saved", "Invoice saved.")
        : bookingT("booking.invoice_created", "Invoice created.")
    );
    return true;
  }

  async function toggleInvoiceSent(invoiceId, sent) {
    if (!state.booking || !invoiceId || !state.permissions.canEditBooking) return;
    clearInvoiceStatus();
    const request = bookingInvoiceUpdateRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id, invoice_id: invoiceId },
      query: { lang: bookingContentLang() }
    });
    const result = await fetchApi(request.url, {
      method: request.method,
      body: {
        sent_to_recipient: Boolean(sent),
        lang: bookingContentLang(),
        expected_invoices_revision: getBookingRevision("invoices_revision")
      }
    });
    if (!result?.invoice) return;
    if (result.booking) {
      state.booking = result.booking;
      renderBookingHeader();
      renderBookingData();
      renderOfferPanel();
      renderPricingPanel();
    }
    await loadInvoices();
  }

  async function translateInvoiceField(button) {
    if (!state.permissions.canEditBooking || !state.booking?.id || bookingContentLang() === "en") return;
    const field = String(button.getAttribute("data-invoice-translate-field") || "").trim();
    if (!field) return;

    if (field === "components") {
      const currency = normalizeCurrencyCode(els.invoice_currency_input?.value || "USD");
      let englishComponents;
      try {
        englishComponents = parseInvoiceComponentsText(els.invoice_components_input?.value || "", currency);
      } catch (error) {
        setInvoiceStatus(String(error?.message || error));
        return;
      }
      if (!englishComponents.length || !els.invoice_components_localized_input) return;
      const entries = Object.fromEntries(
        englishComponents.map((component, index) => [`line_${index}`, component.description])
      );
      setInvoiceStatus(bookingT("booking.translation.translating_field", "Translating field from English..."));
      const translated = await requestBookingFieldTranslation({
        bookingId: state.booking.id,
        entries,
        fetchBookingMutation,
        actor: state.user || null,
        targetLang: bookingContentLang()
      });
      if (!translated) {
        setInvoiceStatus("");
        return;
      }
      const translatedDescriptions = englishComponents.map((component, index) => String(translated[`line_${index}`] || "").trim());
      els.invoice_components_localized_input.value = serializeLocalizedInvoiceComponents(
        englishComponents,
        translatedDescriptions,
        currency
      );
      updateInvoiceDirtyState();
      setInvoiceStatus(bookingT("booking.translation.field_translated", "Field translated from English."));
      return;
    }

    const editor = button.closest(".localized-editor");
    const englishInput = editor?.querySelector('[data-localized-lang="en"][data-localized-role="source"]');
    const localizedInput = editor?.querySelector(`[data-localized-lang="${bookingContentLang()}"][data-localized-role="target"]`);
    const englishText = String(englishInput?.value || "").trim();
    if (!englishText || !localizedInput) return;
    setInvoiceStatus(bookingT("booking.translation.translating_field", "Translating field from English..."));
    const translated = await requestBookingFieldTranslation({
      bookingId: state.booking.id,
      entries: { field: englishText },
      fetchBookingMutation,
      actor: state.user || null,
      targetLang: bookingContentLang()
    });
    if (!translated?.field) {
      if (!translated) setInvoiceStatus("");
      return;
    }
    localizedInput.value = translated.field;
    updateInvoiceDirtyState();
    setInvoiceStatus(bookingT("booking.translation.field_translated", "Field translated from English."));
  }

  if (els.invoice_panel && els.invoice_panel.dataset.localizedTranslateBound !== "true") {
    els.invoice_panel.addEventListener("click", (event) => {
      const button = event.target.closest("[data-localized-translate]");
      if (!button) return;
      void translateInvoiceField(button);
    });
    els.invoice_panel.dataset.localizedTranslateBound = "true";
  }

  return {
    updateInvoiceDirtyState,
    markInvoiceSnapshotClean,
    loadInvoices,
    onInvoiceSelectChange,
    createInvoice,
    toggleInvoiceSent,
    renderInvoiceMoneyLabels
  };
}

function shortId(value) {
  const text = String(value || "");
  return text.length > 8 ? text.slice(0, 8) : text || "-";
}
