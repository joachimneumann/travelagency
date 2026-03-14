import {
  bookingInvoiceCreateRequest,
  bookingInvoiceUpdateRequest,
  bookingInvoicesRequest
} from "../../Generated/API/generated_APIRequestFactory.js?v=6c388c7e525c";
import {
  formatMoneyDisplay,
  formatMoneyInputValue,
  isWholeUnitCurrency,
  normalizeCurrencyCode,
  parseMoneyInputValue,
  setSelectValue
} from "./pricing.js?v=6c388c7e525c";

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

function normalizeDateInput(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function normalizeDateTimeLocal(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
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

  function normalizeInvoiceStatus(value) {
    return String(value || "").trim().toUpperCase() || "DRAFT";
  }

  function isInvoiceCurrencyEditable(invoice = null) {
    if (!state.permissions.canEditBooking) return false;
    const targetInvoice = invoice || state.invoices.find((item) => item.id === state.selectedInvoiceId) || null;
    return normalizeInvoiceStatus(targetInvoice?.status) === "DRAFT";
  }

  function clearInvoiceStatus() {
    setInvoiceStatus("");
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
      els.invoice_due_amount_label.textContent = `Due Amount (${currency}, optional)`;
    }
    if (els.invoice_components_label) {
      els.invoice_components_label.textContent = `Components (one per line: Description | Quantity | Unit amount in ${currency})`;
    }
    if (els.invoice_due_amount_input) {
      els.invoice_due_amount_input.step = isWholeUnitCurrency(currency) ? "1" : "0.01";
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
      els.invoice_title_input,
      els.invoice_components_input,
      els.invoice_due_amount_input,
      els.invoice_vat_input,
      els.invoice_notes_input
    ].forEach((el) => {
      if (el) el.disabled = disabled;
    });
    if (els.invoice_currency_input) {
      els.invoice_currency_input.disabled = !isInvoiceCurrencyEditable();
    }
  }

  function invoiceComponentsToText(components, currency) {
    return (Array.isArray(components) ? components : [])
      .map((component) => `${component.description || ""} | ${Number(component.quantity || 1)} | ${formatMoneyInputValue(component.unit_amount_cents || 0, currency || "USD")}`)
      .join("\n");
  }

  function renderInvoicesTable() {
    if (!els.invoices_table) return;
    const rows = state.invoices
      .map((invoice) => {
        const checked = invoice.sent_to_recipient ? "checked" : "";
        const disabled = !state.permissions.canEditBooking ? "disabled" : "";
        return `<tr>
        <td><a class="btn btn-ghost" href="${escapeHtml(`${apiBase}/api/v1/invoices/${encodeURIComponent(invoice.id)}/pdf`)}" target="_blank" rel="noopener">PDF</a></td>
        <td>${escapeHtml(invoice.invoice_number || shortId(invoice.id))}</td>
        <td>${escapeHtml(String(invoice.version || 1))}</td>
        <td><input type="checkbox" data-invoice-sent="${escapeHtml(invoice.id)}" ${checked} ${disabled} /></td>
        <td>${escapeHtml(formatMoneyDisplay(invoice.total_amount_cents || 0, invoice.currency || "USD"))}</td>
        <td>${escapeHtml(formatDateTime(invoice.updated_at))}</td>
        <td><button type="button" class="btn btn-ghost" data-select-invoice="${escapeHtml(invoice.id)}">Load data</button></td>
      </tr>`;
      })
      .join("");
    const header = "<thead><tr><th></th><th>Invoice</th><th>Version</th><th>Sent</th><th>Total</th><th>Updated</th><th></th></tr></thead>";
    const body = rows || '<tr><td colspan="7">No invoices</td></tr>';
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
    const request = bookingInvoicesRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    const payload = await fetchApi(request.url, { method: request.method });
    if (!payload) return;
    state.invoices = (Array.isArray(payload.items) ? payload.items : []).sort((a, b) =>
      String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""))
    );
    renderInvoicesTable();
    populateInvoiceSelect();
    const selected = state.invoices.find((item) => item.id === state.selectedInvoiceId);
    if (selected) {
      fillInvoiceForm(selected);
    } else {
      resetInvoiceForm();
    }
  }

  function populateInvoiceSelect() {
    if (!els.invoice_select) return;
    const options = ['<option value="">New invoice</option>']
      .concat(
        state.invoices.map(
          (invoice) =>
            `<option value="${escapeHtml(invoice.id)}">${escapeHtml(invoice.invoice_number || shortId(invoice.id))} (${escapeHtml(invoice.status || "DRAFT")})</option>`
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
    if (els.invoice_issue_date_input) els.invoice_issue_date_input.value = normalizeDateInput(invoice.issue_date);
    if (els.invoice_due_date_input) els.invoice_due_date_input.value = normalizeDateInput(invoice.due_date);
    if (els.invoice_title_input) els.invoice_title_input.value = invoice.title || "";
    if (els.invoice_components_input) els.invoice_components_input.value = invoiceComponentsToText(invoice.components || [], invoice.currency || "USD");
    if (els.invoice_due_amount_input) els.invoice_due_amount_input.value = invoice.due_amount_cents ? formatMoneyInputValue(invoice.due_amount_cents, invoice.currency || "USD") : "";
    if (els.invoice_vat_input) {
      const vat = Number(invoice.vat_percentage || 0);
      els.invoice_vat_input.value = Number.isFinite(vat) ? String(vat) : "0";
    }
    if (els.invoice_notes_input) els.invoice_notes_input.value = invoice.notes || "";
    renderInvoiceMoneyLabels();
    clearInvoiceStatus();
    applyInvoicePermissions();
    markInvoiceSnapshotClean();
  }

  function resetInvoiceForm() {
    state.selectedInvoiceId = "";
    if (els.invoice_select) els.invoice_select.value = "";
    if (els.invoice_number_input) els.invoice_number_input.value = "";
    if (els.invoice_currency_input) setSelectValue(els.invoice_currency_input, "USD");
    if (els.invoice_issue_date_input) els.invoice_issue_date_input.value = "";
    if (els.invoice_due_date_input) els.invoice_due_date_input.value = "";
    if (els.invoice_title_input) els.invoice_title_input.value = "";
    if (els.invoice_components_input) els.invoice_components_input.value = "";
    if (els.invoice_due_amount_input) els.invoice_due_amount_input.value = "";
    if (els.invoice_vat_input) els.invoice_vat_input.value = "0";
    if (els.invoice_notes_input) els.invoice_notes_input.value = "";
    renderInvoiceMoneyLabels();
    clearInvoiceStatus();
    applyInvoicePermissions();
    markInvoiceSnapshotClean();
  }

  function parseInvoiceComponentsText(text) {
    const currency = normalizeCurrencyCode(els.invoice_currency_input?.value || "USD");
    const lines = String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const components = [];
    for (const line of lines) {
      const parts = line.split("|").map((value) => value.trim());
      if (parts.length < 3) throw new Error(`Invalid line: "${line}". Use "Description | Quantity | Unit amount".`);
      const description = parts[0];
      const quantity = Number(parts[1]);
      const unitAmountCents = parseMoneyInputValue(parts[2], currency);
      if (!description) throw new Error(`Missing description in line: "${line}"`);
      if (!Number.isFinite(quantity) || quantity < 1) throw new Error(`Invalid quantity in line: "${line}"`);
      if (!Number.isFinite(unitAmountCents) || unitAmountCents < 1) throw new Error(`Invalid amount in line: "${line}"`);
      components.push({ description, quantity: Math.round(quantity), unit_amount_cents: Math.round(unitAmountCents) });
    }
    return components;
  }

  function collectInvoicePayload() {
    const currency = normalizeCurrencyCode(els.invoice_currency_input?.value || "USD");
    const components = parseInvoiceComponentsText(els.invoice_components_input?.value || "");
    const dueAmountRaw = String(els.invoice_due_amount_input?.value || "").trim();
    const dueAmount = dueAmountRaw ? parseMoneyInputValue(dueAmountRaw, currency) : null;
    if (dueAmountRaw && (!Number.isFinite(dueAmount) || dueAmount < 1)) {
      throw new Error("Due amount must be a positive number.");
    }
    const vatRaw = String(els.invoice_vat_input?.value || "").trim();
    const vat = vatRaw ? Number(vatRaw) : 0;
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
      throw new Error("VAT must be between 0 and 100.");
    }
    return {
      invoice_number: String(els.invoice_number_input?.value || "").trim(),
      currency,
      issue_date: String(els.invoice_issue_date_input?.value || "").trim(),
      due_date: String(els.invoice_due_date_input?.value || "").trim(),
      title: String(els.invoice_title_input?.value || "").trim(),
      notes: String(els.invoice_notes_input?.value || "").trim(),
      vat_percentage: vat,
      due_amount_cents: dueAmount ? Math.round(dueAmount) : null,
      components
    };
  }

  async function createInvoice() {
    if (!state.booking || !state.permissions.canEditBooking) return;
    clearInvoiceStatus();
    let payload;
    try {
      payload = collectInvoicePayload();
    } catch (error) {
      setInvoiceStatus(String(error?.message || error));
      return;
    }
    const isUpdate = Boolean(state.selectedInvoiceId);
    const request = isUpdate
      ? bookingInvoiceUpdateRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id, invoice_id: state.selectedInvoiceId } })
      : bookingInvoiceCreateRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    const result = await fetchApi(request.url, {
      method: request.method,
      body: {
        ...payload,
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
    state.selectedInvoiceId = result.invoice.id;
    await loadInvoices();
  }

  async function toggleInvoiceSent(invoiceId, sent) {
    if (!state.booking || !invoiceId) return;
    if (!state.permissions.canEditBooking) return;
    clearInvoiceStatus();
    const request = bookingInvoiceUpdateRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id, invoice_id: invoiceId }
    });
    const result = await fetchApi(request.url, {
      method: request.method,
      body: {
        sent_to_recipient: Boolean(sent),
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
