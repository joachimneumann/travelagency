const qs = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");

const STAGES = [
  "NEW",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "INVOICE_SENT",
  "PAYMENT_RECEIVED",
  "WON",
  "LOST",
  "POST_TRIP"
];

const ROLES = {
  ADMIN: "atp_admin",
  MANAGER: "atp_manager",
  ACCOUNTANT: "atp_accountant",
  STAFF: "atp_staff"
};

const state = {
  type: qs.get("type") || "booking",
  id: qs.get("id") || "",
  user: qs.get("user") || "admin",
  roles: [],
  permissions: {
    canChangeAssignment: false,
    canChangeStage: false,
    canEditBooking: false
  },
  booking: null,
  customer: null,
  staff: [],
  invoices: [],
  selectedInvoiceId: "",
  originalNote: "",
  pricingDraft: {
    adjustments: [],
    payments: []
  }
};

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  back: document.getElementById("backToBackend"),
  logoutLink: document.getElementById("backendLogoutLink"),
  title: document.getElementById("detailTitle"),
  subtitle: document.getElementById("detailSubTitle"),
  error: document.getElementById("detailError"),
  bookingDataView: document.getElementById("bookingDataView"),
  actionsPanel: document.getElementById("bookingActionsPanel"),
  ownerSelect: document.getElementById("bookingOwnerSelect"),
  stageSelect: document.getElementById("bookingStageSelect"),
  noteInput: document.getElementById("bookingNoteInput"),
  noteSaveBtn: document.getElementById("bookingNoteSaveBtn"),
  actionStatus: document.getElementById("bookingActionStatus"),
  pricingPanel: document.getElementById("pricingPanel"),
  pricingSummaryTable: document.getElementById("pricingSummaryTable"),
  pricingCurrencyInput: document.getElementById("pricingCurrencyInput"),
  pricingAgreedNetLabel: document.getElementById("pricingAgreedNetLabel"),
  pricingAgreedNetInput: document.getElementById("pricingAgreedNetInput"),
  pricingAdjustmentsTable: document.getElementById("pricingAdjustmentsTable"),
  pricingPaymentsTable: document.getElementById("pricingPaymentsTable"),
  pricingSaveBtn: document.getElementById("pricingSaveBtn"),
  pricingStatus: document.getElementById("pricingStatus"),
  activitiesTable: document.getElementById("activitiesTable"),
  invoicePanel: document.getElementById("invoicePanel"),
  invoiceSelect: document.getElementById("invoiceSelect"),
  invoiceNumberInput: document.getElementById("invoiceNumberInput"),
  invoiceCurrencyInput: document.getElementById("invoiceCurrencyInput"),
  invoiceIssueDateInput: document.getElementById("invoiceIssueDateInput"),
  invoiceIssueTodayBtn: document.getElementById("invoiceIssueTodayBtn"),
  invoiceDueDateInput: document.getElementById("invoiceDueDateInput"),
  invoiceDueMonthBtn: document.getElementById("invoiceDueMonthBtn"),
  invoiceTitleInput: document.getElementById("invoiceTitleInput"),
  invoiceItemsInput: document.getElementById("invoiceItemsInput"),
  invoiceDueAmountInput: document.getElementById("invoiceDueAmountInput"),
  invoiceDueAmountLabel: document.getElementById("invoiceDueAmountLabel"),
  invoiceItemsLabel: document.getElementById("invoiceItemsLabel"),
  invoiceVatInput: document.getElementById("invoiceVatInput"),
  invoiceNotesInput: document.getElementById("invoiceNotesInput"),
  invoiceCreateBtn: document.getElementById("invoiceCreateBtn"),
  invoiceStatus: document.getElementById("invoiceStatus"),
  invoicesTable: document.getElementById("invoicesTable")
};

init();

async function init() {
  const backParams = new URLSearchParams({ user: state.user });
  const backHref = `backend.html?${backParams.toString()}`;

  if (els.homeLink) els.homeLink.href = backHref;
  if (els.back) els.back.href = backHref;
  if (els.logoutLink) {
    const returnTo = `${window.location.origin}/index.html`;
    els.logoutLink.href = `${apiBase}/auth/logout?global=true&return_to=${encodeURIComponent(returnTo)}`;
  }

  if (els.ownerSelect) els.ownerSelect.addEventListener("change", saveOwner);
  if (els.stageSelect) els.stageSelect.addEventListener("change", saveStage);
  if (els.noteSaveBtn) els.noteSaveBtn.addEventListener("click", saveNote);
  if (els.pricingSaveBtn) els.pricingSaveBtn.addEventListener("click", savePricing);
  if (els.invoiceSelect) els.invoiceSelect.addEventListener("change", onInvoiceSelectChange);
  if (els.invoiceCurrencyInput) els.invoiceCurrencyInput.addEventListener("change", renderInvoiceMoneyLabels);
  if (els.invoiceCreateBtn) els.invoiceCreateBtn.addEventListener("click", createInvoice);
  if (els.invoiceIssueTodayBtn) {
    els.invoiceIssueTodayBtn.addEventListener("click", () => {
      if (els.invoiceIssueDateInput) els.invoiceIssueDateInput.value = formatDateInput(new Date());
    });
  }
  if (els.invoiceDueMonthBtn) {
    els.invoiceDueMonthBtn.addEventListener("click", () => {
      if (els.invoiceDueDateInput) els.invoiceDueDateInput.value = plusOneMonthDateInput(new Date());
    });
  }

  if (!state.id) {
    showError("Missing record id.");
    return;
  }

  await loadAuthStatus();

  if (state.type === "customer") {
    if (els.actionsPanel) els.actionsPanel.style.display = "none";
    if (els.invoicePanel) els.invoicePanel.style.display = "none";
    loadCustomer();
    return;
  }

  loadBookingPage();
}

async function loadBookingPage() {
  clearStatus();
  const requests = [fetchApi(`/api/v1/bookings/${encodeURIComponent(state.id)}`)];
  if (state.permissions.canChangeAssignment) {
    requests.push(fetchApi(`/api/v1/staff?active=true`));
  }
  const [bookingPayload, staffPayload] = await Promise.all(requests);
  if (!bookingPayload) return;

  state.booking = bookingPayload.booking || null;
  state.customer = bookingPayload.customer || null;
  state.staff = Array.isArray(staffPayload?.items) ? staffPayload.items : [];

  renderBookingHeader();
  renderBookingData();
  renderActionControls();
  renderPricingPanel();
  await loadActivities();
  await loadInvoices();
}

async function loadCustomer() {
  const payload = await fetchApi(`/api/v1/customers/${encodeURIComponent(state.id)}`);
  if (!payload) return;

  if (els.title) els.title.textContent = payload.customer?.name || `Customer ${state.id}`;
  if (els.subtitle) els.subtitle.textContent = payload.customer?.email || "Customer detail";

  const sections = [
    {
      title: "Customer",
      entries: toEntries(payload.customer || {})
    },
    {
      title: "Related Bookings",
      entries: [{ key: "count", value: String((payload.bookings || []).length) }]
    }
  ];
  renderSections(sections);

  renderActivitiesTable([]);
  if (els.activitiesTable) {
    els.activitiesTable.innerHTML =
      '<thead><tr><th>Booking ID</th><th>Stage</th><th>Destination</th><th>Style</th><th>Staff</th><th>Created</th></tr></thead>' +
      `<tbody>${(payload.bookings || [])
        .map((booking) => {
          const href = buildBookingHref(booking.id);
          return `<tr>
          <td><a href="${escapeHtml(href)}">${escapeHtml(shortId(booking.id))}</a></td>
          <td>${escapeHtml(booking.stage || "-")}</td>
          <td>${escapeHtml(booking.destination || "-")}</td>
          <td>${escapeHtml(booking.style || "-")}</td>
          <td>${escapeHtml(booking.staff_name || booking.owner_name || "Unassigned")}</td>
          <td>${escapeHtml(formatDateTime(booking.created_at))}</td>
        </tr>`;
        })
        .join("") || '<tr><td colspan="6">No related bookings</td></tr>'}</tbody>`;
  }
}

function renderBookingHeader() {
  if (!state.booking) return;
  if (els.title) els.title.textContent = `Booking ${shortId(state.booking.id)}`;
  if (els.subtitle) {
    els.subtitle.textContent = "";
    els.subtitle.hidden = true;
  }
}

function renderBookingData() {
  if (!state.booking) return;
  const booking = state.booking;
  const sections = [
    {
      title: "Booking",
      entries: [
        ["id", booking.id],
        ["stage", booking.stage],
        ["staff", booking.staff_name || booking.owner_name || "Unassigned"],
        ["destination", booking.destination],
        ["style", booking.style],
        ["travel_month", booking.travel_month],
        ["travelers", booking.travelers],
        ["duration", booking.duration],
        ["budget", booking.budget],
        ["sla_due_at", formatDateTime(booking.sla_due_at)],
        ["created_at", formatDateTime(booking.created_at)],
        ["updated_at", formatDateTime(booking.updated_at)]
      ]
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => ({ key, value: String(value ?? "-") }))
    },
    {
      title: "Customer",
      entries: toEntries(state.customer || {})
    },
    {
      title: "Source",
      entries: [
        ["page_url", booking.source?.page_url],
        ["ip_address", booking.source?.ip_address],
        ["ip_country_guess", booking.source?.ip_country_guess],
        ["referrer", booking.source?.referrer],
        ["utm_source", booking.source?.utm_source],
        ["utm_medium", booking.source?.utm_medium],
        ["utm_campaign", booking.source?.utm_campaign]
      ]
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => ({ key, value: String(value ?? "-") }))
    }
  ];

  renderSections(sections);
}

function renderSections(sections) {
  if (!els.bookingDataView) return;
  const html = sections
    .map((section) => {
      const rows = (section.entries || [])
        .map((entry) => {
          return `<tr><th>${escapeHtml(entry.key)}</th><td>${escapeHtml(String(entry.value || "-"))}</td></tr>`;
        })
        .join("");
      return `
        <div style="margin-bottom: 0.9rem;">
          <h3 style="margin: 0 0 0.4rem; font-size: 0.98rem;">${escapeHtml(section.title)}</h3>
          <div class="backend-table-wrap">
            <table class="backend-table"><tbody>${rows || '<tr><td colspan="2">-</td></tr>'}</tbody></table>
          </div>
        </div>
      `;
    })
    .join("");
  els.bookingDataView.innerHTML = html;
}

function renderActionControls() {
  if (!state.booking) return;

  if (els.stageSelect) {
    const options = STAGES.map((stage) => `<option value="${escapeHtml(stage)}">${escapeHtml(stage)}</option>`).join("");
    els.stageSelect.innerHTML = options;
    els.stageSelect.value = state.booking.stage || STAGES[0];
  }

  if (els.ownerSelect) {
    const options = ['<option value="">Unassigned</option>']
      .concat((state.staff || []).map((staff) => `<option value="${escapeHtml(staff.id)}">${escapeHtml(staff.name)}</option>`))
      .join("");
    els.ownerSelect.innerHTML = options;
    els.ownerSelect.value = state.booking.staff || state.booking.owner_id || "";
    els.ownerSelect.disabled = !state.permissions.canChangeAssignment;
  }

  if (els.stageSelect) els.stageSelect.disabled = !state.permissions.canChangeStage;
  if (els.noteInput) {
    els.noteInput.disabled = !state.permissions.canEditBooking;
    els.noteInput.value = state.booking.notes || "";
  }
  state.originalNote = String(state.booking.notes || "");
  if (els.noteSaveBtn) els.noteSaveBtn.style.display = state.permissions.canEditBooking ? "" : "none";
  if (els.invoiceCreateBtn) els.invoiceCreateBtn.style.display = state.permissions.canEditBooking ? "" : "none";
}

function renderPricingPanel() {
  if (!els.pricingPanel || !state.booking) return;
  const pricing = clonePricing(state.booking.pricing || {});
  state.pricingDraft = pricing;
  const currency = normalizeCurrencyCode(pricing.currency);

  if (els.pricingCurrencyInput) {
    els.pricingCurrencyInput.value = currency;
    els.pricingCurrencyInput.disabled = !state.permissions.canEditBooking;
  }
  if (els.pricingAgreedNetLabel) {
    els.pricingAgreedNetLabel.textContent = `Agreed Net Amount (${currency})`;
  }
  if (els.pricingAgreedNetInput) {
    els.pricingAgreedNetInput.value = formatMoneyInputValue(pricing.agreed_net_amount_cents || 0, currency);
    els.pricingAgreedNetInput.disabled = !state.permissions.canEditBooking;
  }
  if (els.pricingSaveBtn) els.pricingSaveBtn.style.display = state.permissions.canEditBooking ? "" : "none";

  renderPricingSummaryTable(pricing);
  renderPricingAdjustmentsTable();
  renderPricingPaymentsTable();
  clearPricingStatus();
}

function renderPricingSummaryTable(pricing) {
  if (!els.pricingSummaryTable) return;
  const summary = pricing.summary || {};
  const moneyRows = [
    ["agreed_net_amount", pricing.agreed_net_amount_cents],
    ["adjustments_delta", summary.adjustments_delta_cents],
    ["adjusted_net_amount", summary.adjusted_net_amount_cents],
    ["scheduled_net_amount", summary.scheduled_net_amount_cents],
    ["scheduled_tax_amount", summary.scheduled_tax_amount_cents],
    ["scheduled_gross_amount", summary.scheduled_gross_amount_cents],
    ["paid_gross_amount", summary.paid_gross_amount_cents],
    ["outstanding_gross_amount", summary.outstanding_gross_amount_cents]
  ]
    .filter(([, value]) => Number(value || 0) !== 0)
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(formatMoneyDisplay(value, pricing.currency))}</td></tr>`);
  const rows = []
    .concat(moneyRows)
    .concat(summary.is_schedule_balanced === false ? ['<tr><th>schedule_balanced</th><td>no</td></tr>'] : [])
    .join("");
  els.pricingSummaryTable.innerHTML = `<tbody>${rows || '<tr><td colspan="2">No payment totals yet</td></tr>'}</tbody>`;
}

function renderPricingAdjustmentsTable() {
  if (!els.pricingAdjustmentsTable) return;
  const readOnly = !state.permissions.canEditBooking;
  const items = Array.isArray(state.pricingDraft.adjustments) ? state.pricingDraft.adjustments : [];
  const currency = normalizeCurrencyCode(state.pricingDraft.currency);
  const header = `<thead><tr><th>Label</th><th>Type</th><th>Amount (${escapeHtml(currency)})</th><th>Notes</th>${readOnly ? "" : "<th></th>"}</tr></thead>`;
  const rows = items
    .map((item, index) => `<tr>
      <td><input data-pricing-adjustment-label="${index}" type="text" value="${escapeHtml(item.label || "")}" ${readOnly ? "disabled" : ""} /></td>
      <td>
        <select data-pricing-adjustment-type="${index}" ${readOnly ? "disabled" : ""}>
          ${["DISCOUNT", "CREDIT", "SURCHARGE"]
            .map((type) => `<option value="${type}" ${item.type === type ? "selected" : ""}>${type}</option>`)
            .join("")}
        </select>
      </td>
      <td><input data-pricing-adjustment-amount="${index}" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(item.amount_cents || 0, currency))}" ${readOnly ? "disabled" : ""} /></td>
      <td><input data-pricing-adjustment-notes="${index}" type="text" value="${escapeHtml(item.notes || "")}" ${readOnly ? "disabled" : ""} /></td>
      ${readOnly ? "" : `<td><button class="btn btn-ghost" type="button" data-pricing-remove-adjustment="${index}">Remove</button></td>`}
    </tr>`)
    .join("");
  const addRow = readOnly
    ? ""
    : `<tr><td colspan="5"><button class="btn btn-ghost" type="button" data-pricing-add-adjustment>Add</button></td></tr>`;
  const body = (rows || `<tr><td colspan="${readOnly ? 4 : 5}">No adjustments</td></tr>`) + addRow;
  els.pricingAdjustmentsTable.innerHTML = `${header}<tbody>${body}</tbody>`;
  if (!readOnly) {
    els.pricingAdjustmentsTable.querySelectorAll("[data-pricing-remove-adjustment]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-pricing-remove-adjustment"));
        removePricingAdjustmentRow(index);
      });
    });
    els.pricingAdjustmentsTable.querySelector("[data-pricing-add-adjustment]")?.addEventListener("click", addPricingAdjustmentRow);
  }
}

function renderPricingPaymentsTable() {
  if (!els.pricingPaymentsTable) return;
  const readOnly = !state.permissions.canEditBooking;
  const items = Array.isArray(state.pricingDraft.payments) ? state.pricingDraft.payments : [];
  const currency = normalizeCurrencyCode(state.pricingDraft.currency);
  const header = `<thead><tr><th>Label</th><th>Due Date</th><th>Net (${escapeHtml(currency)})</th><th>Tax %</th><th>Status</th><th>Paid At</th><th>Notes</th>${readOnly ? "" : "<th></th>"}</tr></thead>`;
  const rows = items
    .map((item, index) => `<tr>
      <td><input data-pricing-payment-label="${index}" type="text" value="${escapeHtml(item.label || "")}" ${readOnly ? "disabled" : ""} /></td>
      <td><input data-pricing-payment-due-date="${index}" type="date" value="${escapeHtml(item.due_date || "")}" ${readOnly ? "disabled" : ""} /></td>
      <td><input data-pricing-payment-net="${index}" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(item.net_amount_cents || 0, currency))}" ${readOnly ? "disabled" : ""} /></td>
      <td><input data-pricing-payment-tax="${index}" type="number" min="0" max="100" step="0.01" value="${escapeHtml(formatTaxRatePercent(item.tax_rate_basis_points))}" ${readOnly ? "disabled" : ""} /></td>
      <td>
        <select data-pricing-payment-status="${index}" ${readOnly ? "disabled" : ""}>
          ${["PENDING", "PAID"].map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </td>
      <td><input data-pricing-payment-paid-at="${index}" type="datetime-local" value="${escapeHtml(normalizeDateTimeLocal(item.paid_at))}" ${readOnly ? "disabled" : ""} /></td>
      <td><input data-pricing-payment-notes="${index}" type="text" value="${escapeHtml(item.notes || "")}" ${readOnly ? "disabled" : ""} /></td>
      ${readOnly ? "" : `<td><button class="btn btn-ghost" type="button" data-pricing-remove-payment="${index}">Remove</button></td>`}
    </tr>`)
    .join("");
  const addRow = readOnly
    ? ""
    : `<tr><td colspan="8"><button class="btn btn-ghost" type="button" data-pricing-add-payment>Add</button></td></tr>`;
  const body = (rows || `<tr><td colspan="${readOnly ? 7 : 8}">No payments scheduled</td></tr>`) + addRow;
  els.pricingPaymentsTable.innerHTML = `${header}<tbody>${body}</tbody>`;
  if (!readOnly) {
    els.pricingPaymentsTable.querySelectorAll("[data-pricing-remove-payment]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-pricing-remove-payment"));
        removePricingPaymentRow(index);
      });
    });
    els.pricingPaymentsTable.querySelectorAll("[data-pricing-payment-status]").forEach((select) => {
      select.addEventListener("change", () => {
        const index = Number(select.getAttribute("data-pricing-payment-status"));
        const paidAtInput = document.querySelector(`[data-pricing-payment-paid-at="${index}"]`);
        if (!(paidAtInput instanceof HTMLInputElement)) return;
        if (String(select.value || "").toUpperCase() === "PAID") {
          if (!paidAtInput.value) paidAtInput.value = normalizeDateTimeLocal(new Date().toISOString());
        } else {
          paidAtInput.value = "";
        }
      });
    });
    els.pricingPaymentsTable.querySelector("[data-pricing-add-payment]")?.addEventListener("click", addPricingPaymentRow);
  }
}

function addPricingAdjustmentRow() {
  state.pricingDraft.adjustments.push({
    id: "",
    type: "DISCOUNT",
    label: "",
    amount_cents: 0,
    notes: ""
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
    due_date: "",
    net_amount_cents: 0,
    tax_rate_basis_points: 0,
    status: "PENDING",
    paid_at: "",
    notes: ""
  });
  renderPricingPaymentsTable();
}

function removePricingPaymentRow(index) {
  state.pricingDraft.payments.splice(index, 1);
  renderPricingPaymentsTable();
}

async function saveOwner() {
  if (!state.booking || !els.ownerSelect) return;
  const result = await fetchBookingMutation(`/api/v1/bookings/${encodeURIComponent(state.booking.id)}/owner`, {
    method: "PATCH",
    body: {
      booking_hash: state.booking.booking_hash,
      owner_id: els.ownerSelect.value || null,
      actor: state.user
    }
  });
  if (!result?.booking) return;
  state.booking = result.booking;
  renderBookingHeader();
  renderBookingData();
  setStatus("Staff updated.");
  await loadActivities();
}

async function saveStage() {
  if (!state.booking || !els.stageSelect) return;
  const result = await fetchBookingMutation(`/api/v1/bookings/${encodeURIComponent(state.booking.id)}/stage`, {
    method: "PATCH",
    body: {
      booking_hash: state.booking.booking_hash,
      stage: els.stageSelect.value,
      actor: state.user
    }
  });
  if (!result?.booking) return;
  state.booking = result.booking;
  renderBookingHeader();
  renderBookingData();
  setStatus("Stage updated.");
  await loadActivities();
}

async function saveNote() {
  if (!state.booking || !els.noteInput) return;
  const result = await fetchBookingMutation(`/api/v1/bookings/${encodeURIComponent(state.booking.id)}/notes`, {
    method: "PATCH",
    body: {
      booking_hash: state.booking.booking_hash,
      notes: String(els.noteInput.value || "").trim(),
      actor: state.user,
    }
  });
  if (!result?.booking) return;

  state.booking = result.booking;
  state.originalNote = String(result.booking.notes || "");
  if (els.noteInput) els.noteInput.value = state.originalNote;
  renderBookingHeader();
  renderBookingData();
  renderActionControls();
  setStatus(result.unchanged ? "Note unchanged." : "Note saved.");
  await loadActivities();
}

async function savePricing() {
  if (!state.booking) return;
  let pricing;
  try {
    pricing = collectPricingPayload();
  } catch (error) {
    setPricingStatus(String(error?.message || error));
    return;
  }

  const result = await fetchBookingMutation(`/api/v1/bookings/${encodeURIComponent(state.booking.id)}/pricing`, {
    method: "PATCH",
    body: {
      booking_hash: state.booking.booking_hash,
      pricing,
      actor: state.user
    }
  });
  if (!result?.booking) {
    if (els.error?.textContent) setPricingStatus(els.error.textContent);
    return;
  }

  state.booking = result.booking;
  renderBookingHeader();
  renderBookingData();
  renderPricingPanel();
  setPricingStatus(result.unchanged ? "Payments unchanged." : "Payments saved.");
  await loadActivities();
}

async function loadActivities() {
  if (!state.booking) return;
  const payload = await fetchApi(`/api/v1/bookings/${encodeURIComponent(state.booking.id)}/activities`);
  if (!payload) return;
  renderActivitiesTable(payload.items || []);
}

function renderActivitiesTable(items) {
  if (!els.activitiesTable) return;
  const header = `<thead><tr><th>Time</th><th>Type</th><th>Actor</th><th>Detail</th></tr></thead>`;
  const rows = items
    .map(
      (activity) => `<tr>
      <td>${escapeHtml(formatDateTime(activity.created_at))}</td>
      <td>${escapeHtml(activity.type || "-")}</td>
      <td>${escapeHtml(activity.actor || "-")}</td>
      <td>${escapeHtml(activity.detail || "-")}</td>
    </tr>`
    )
    .join("");

  const body = rows || '<tr><td colspan="4">No activities</td></tr>';
  els.activitiesTable.innerHTML = `${header}<tbody>${body}</tbody>`;
}

async function loadInvoices() {
  if (!state.booking) return;
  const payload = await fetchApi(`/api/v1/bookings/${encodeURIComponent(state.booking.id)}/invoices`);
  if (!payload) return;
  state.invoices = (Array.isArray(payload.items) ? payload.items : []).sort((a, b) =>
    String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""))
  );
  renderInvoiceSelect();
  renderInvoicesTable();
  if (state.selectedInvoiceId) {
    const selected = state.invoices.find((item) => item.id === state.selectedInvoiceId);
    if (selected) {
      fillInvoiceForm(selected);
      return;
    }
  }
  resetInvoiceForm();
}

function renderInvoiceSelect() {
  if (!els.invoiceSelect) return;
  const options = ['<option value="">New invoice</option>']
    .concat(
      state.invoices.map(
        (invoice) =>
          `<option value="${escapeHtml(invoice.id)}">${escapeHtml(invoice.invoice_number || shortId(invoice.id))} (${escapeHtml(
            invoice.status || "DRAFT"
          )})</option>`
      )
    )
    .join("");
  els.invoiceSelect.innerHTML = options;
  els.invoiceSelect.value = state.selectedInvoiceId || "";
}

function renderInvoicesTable() {
  if (!els.invoicesTable) return;
  const header = `<thead><tr><th>PDF</th><th>Invoice</th><th>Version</th><th>Sent to customer</th><th>Total</th><th>Updated</th><th>Actions</th></tr></thead>`;
  const rows = state.invoices
    .map((invoice) => {
      const checked = invoice.sent_to_customer ? "checked" : "";
      const disabled = state.permissions.canEditBooking ? "" : "disabled";
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
  const body = rows || '<tr><td colspan="7">No invoices</td></tr>';
  els.invoicesTable.innerHTML = `${header}<tbody>${body}</tbody>`;
  els.invoicesTable.querySelectorAll("[data-select-invoice]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = String(button.getAttribute("data-select-invoice") || "");
      state.selectedInvoiceId = id;
      renderInvoiceSelect();
      const invoice = state.invoices.find((item) => item.id === id);
      if (invoice) fillInvoiceForm(invoice);
    });
  });
  els.invoicesTable.querySelectorAll("[data-invoice-sent]").forEach((input) => {
    input.addEventListener("change", async () => {
      const invoiceId = String(input.getAttribute("data-invoice-sent") || "");
      await toggleInvoiceSent(invoiceId, Boolean(input.checked));
    });
  });
}

function onInvoiceSelectChange() {
  const id = String(els.invoiceSelect?.value || "");
  state.selectedInvoiceId = id;
  clearInvoiceStatus();
  if (!id) {
    resetInvoiceForm();
    return;
  }
  const invoice = state.invoices.find((item) => item.id === id);
  if (invoice) fillInvoiceForm(invoice);
}

function fillInvoiceForm(invoice) {
  state.selectedInvoiceId = invoice.id;
  if (els.invoiceSelect) els.invoiceSelect.value = invoice.id;
  if (els.invoiceNumberInput) els.invoiceNumberInput.value = invoice.invoice_number || "";
  if (els.invoiceCurrencyInput) setSelectValue(els.invoiceCurrencyInput, invoice.currency || "USD");
  renderInvoiceMoneyLabels();
  if (els.invoiceIssueDateInput) els.invoiceIssueDateInput.value = normalizeDateInput(invoice.issue_date);
  if (els.invoiceDueDateInput) els.invoiceDueDateInput.value = normalizeDateInput(invoice.due_date);
  if (els.invoiceTitleInput) els.invoiceTitleInput.value = invoice.title || "";
  if (els.invoiceItemsInput) els.invoiceItemsInput.value = invoiceItemsToText(invoice.items || [], invoice.currency || "USD");
  if (els.invoiceDueAmountInput) els.invoiceDueAmountInput.value = invoice.due_amount_cents ? formatMoneyInputValue(invoice.due_amount_cents, invoice.currency || "USD") : "";
  if (els.invoiceVatInput) {
    const vat = Number(invoice.vat_percentage || 0);
    els.invoiceVatInput.value = Number.isFinite(vat) ? String(vat) : "0";
  }
  if (els.invoiceNotesInput) els.invoiceNotesInput.value = invoice.notes || "";
  applyInvoicePermissions();
}

function resetInvoiceForm() {
  state.selectedInvoiceId = "";
  if (els.invoiceSelect) els.invoiceSelect.value = "";
  if (els.invoiceNumberInput) els.invoiceNumberInput.value = "";
  if (els.invoiceCurrencyInput) setSelectValue(els.invoiceCurrencyInput, "USD");
  renderInvoiceMoneyLabels();
  if (els.invoiceIssueDateInput) els.invoiceIssueDateInput.value = "";
  if (els.invoiceDueDateInput) els.invoiceDueDateInput.value = "";
  if (els.invoiceTitleInput) els.invoiceTitleInput.value = "";
  if (els.invoiceItemsInput) els.invoiceItemsInput.value = "";
  if (els.invoiceDueAmountInput) els.invoiceDueAmountInput.value = "";
  if (els.invoiceVatInput) els.invoiceVatInput.value = "0";
  if (els.invoiceNotesInput) els.invoiceNotesInput.value = "";
  clearInvoiceStatus();
  applyInvoicePermissions();
}

function invoiceItemsToText(items, currency) {
  return (Array.isArray(items) ? items : [])
    .map((item) => `${item.description || ""} | ${Number(item.quantity || 1)} | ${formatMoneyInputValue(item.unit_amount_cents || 0, currency || "USD")}`)
    .join("\n");
}

function parseInvoiceItemsText(text) {
  const currency = normalizeCurrencyCode(els.invoiceCurrencyInput?.value || "USD");
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const items = [];
  for (const line of lines) {
    const parts = line.split("|").map((value) => value.trim());
    if (parts.length < 3) throw new Error(`Invalid line: "${line}". Use "Description | Quantity | Unit amount".`);
    const description = parts[0];
    const quantity = Number(parts[1]);
    const unitAmountCents = parseMoneyInputValue(parts[2], currency);
    if (!description) throw new Error(`Missing description in line: "${line}"`);
    if (!Number.isFinite(quantity) || quantity < 1) throw new Error(`Invalid quantity in line: "${line}"`);
    if (!Number.isFinite(unitAmountCents) || unitAmountCents < 1) throw new Error(`Invalid amount in line: "${line}"`);
    items.push({ description, quantity: Math.round(quantity), unit_amount_cents: Math.round(unitAmountCents) });
  }
  return items;
}

function collectInvoicePayload() {
  const currency = normalizeCurrencyCode(els.invoiceCurrencyInput?.value || "USD");
  const items = parseInvoiceItemsText(els.invoiceItemsInput?.value || "");
  const dueAmountRaw = String(els.invoiceDueAmountInput?.value || "").trim();
  const dueAmount = dueAmountRaw ? parseMoneyInputValue(dueAmountRaw, currency) : null;
  if (dueAmountRaw && (!Number.isFinite(dueAmount) || dueAmount < 1)) {
    throw new Error("Due amount must be a positive number.");
  }
  const vatRaw = String(els.invoiceVatInput?.value || "").trim();
  const vat = vatRaw ? Number(vatRaw) : 0;
  if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
    throw new Error("VAT must be between 0 and 100.");
  }
  return {
    invoice_number: String(els.invoiceNumberInput?.value || "").trim(),
    currency,
    issue_date: String(els.invoiceIssueDateInput?.value || "").trim(),
    due_date: String(els.invoiceDueDateInput?.value || "").trim(),
    title: String(els.invoiceTitleInput?.value || "").trim(),
    notes: String(els.invoiceNotesInput?.value || "").trim(),
    vat_percentage: vat,
    due_amount_cents: dueAmount ? Math.round(dueAmount) : null,
    items
  };
}

async function createInvoice() {
  if (!state.booking) return;
  if (!state.permissions.canEditBooking) return;
  clearInvoiceStatus();
  let payload;
  try {
    payload = collectInvoicePayload();
  } catch (error) {
    setInvoiceStatus(String(error?.message || error));
    return;
  }
  const isUpdate = Boolean(state.selectedInvoiceId);
  const path = isUpdate
    ? `/api/v1/bookings/${encodeURIComponent(state.booking.id)}/invoices/${encodeURIComponent(state.selectedInvoiceId)}`
    : `/api/v1/bookings/${encodeURIComponent(state.booking.id)}/invoices`;
  const method = isUpdate ? "PATCH" : "POST";
  const result = await fetchApi(path, { method, body: payload });
  if (!result?.invoice) return;
  state.selectedInvoiceId = result.invoice.id;
  setInvoiceStatus(isUpdate ? "Invoice updated." : "Invoice created.");
  await loadInvoices();
}

async function toggleInvoiceSent(invoiceId, sent) {
  if (!state.booking || !invoiceId) return;
  if (!state.permissions.canEditBooking) return;
  clearInvoiceStatus();
  const result = await fetchApi(
    `/api/v1/bookings/${encodeURIComponent(state.booking.id)}/invoices/${encodeURIComponent(invoiceId)}`,
    {
      method: "PATCH",
      body: { sent_to_customer: Boolean(sent) }
    }
  );
  if (!result?.invoice) return;
  setInvoiceStatus(sent ? "Invoice marked as sent to customer." : "Invoice marked as not sent.");
  await loadInvoices();
}

function setInvoiceStatus(message) {
  if (!els.invoiceStatus) return;
  els.invoiceStatus.textContent = message;
}

function clearInvoiceStatus() {
  setInvoiceStatus("");
}

function setPricingStatus(message) {
  if (!els.pricingStatus) return;
  els.pricingStatus.textContent = message;
}

function clearPricingStatus() {
  setPricingStatus("");
}

function applyInvoicePermissions() {
  const disabled = !state.permissions.canEditBooking;
  [
    els.invoiceSelect,
    els.invoiceNumberInput,
    els.invoiceCurrencyInput,
    els.invoiceIssueDateInput,
    els.invoiceIssueTodayBtn,
    els.invoiceDueDateInput,
    els.invoiceDueMonthBtn,
    els.invoiceTitleInput,
    els.invoiceItemsInput,
    els.invoiceDueAmountInput,
    els.invoiceVatInput,
    els.invoiceNotesInput
  ].forEach((el) => {
    if (el) el.disabled = disabled;
  });
}

function collectPricingPayload() {
  const currency = normalizeCurrencyCode(els.pricingCurrencyInput?.value || "USD");
  const agreedNet = parseMoneyInputValue(els.pricingAgreedNetInput?.value || "0", currency);
  if (!currency) throw new Error("Currency is required.");
  if (!Number.isFinite(agreedNet) || agreedNet < 0) throw new Error("Agreed net amount must be zero or positive.");

  const adjustments = Array.from(document.querySelectorAll("[data-pricing-adjustment-label]")).map((input) => {
    const index = Number(input.getAttribute("data-pricing-adjustment-label"));
    const type = String(document.querySelector(`[data-pricing-adjustment-type="${index}"]`)?.value || "DISCOUNT").trim().toUpperCase();
    const label = String(document.querySelector(`[data-pricing-adjustment-label="${index}"]`)?.value || "").trim();
    const amount = parseMoneyInputValue(document.querySelector(`[data-pricing-adjustment-amount="${index}"]`)?.value || "0", currency);
    const notes = String(document.querySelector(`[data-pricing-adjustment-notes="${index}"]`)?.value || "").trim();
    if (!label) throw new Error(`Adjustment ${index + 1} requires a label.`);
    if (!["DISCOUNT", "CREDIT", "SURCHARGE"].includes(type)) throw new Error(`Adjustment ${index + 1} has an invalid type.`);
    if (!Number.isFinite(amount) || amount < 0) throw new Error(`Adjustment ${index + 1} requires a valid non-negative amount.`);
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
    const label = String(document.querySelector(`[data-pricing-payment-label="${index}"]`)?.value || "").trim();
    const dueDate = String(document.querySelector(`[data-pricing-payment-due-date="${index}"]`)?.value || "").trim();
    const netAmount = parseMoneyInputValue(document.querySelector(`[data-pricing-payment-net="${index}"]`)?.value || "0", currency);
    const taxPercent = Number(document.querySelector(`[data-pricing-payment-tax="${index}"]`)?.value || "0");
    const status = String(document.querySelector(`[data-pricing-payment-status="${index}"]`)?.value || "PENDING").trim().toUpperCase();
    const paidAtInputValue = document.querySelector(`[data-pricing-payment-paid-at="${index}"]`)?.value || "";
    const paidAt = normalizeDateTimePayload(paidAtInputValue || (status === "PAID" ? normalizeDateTimeLocal(new Date().toISOString()) : ""));
    const notes = String(document.querySelector(`[data-pricing-payment-notes="${index}"]`)?.value || "").trim();
    if (!label) throw new Error(`Payment ${index + 1} requires a label.`);
    if (!Number.isFinite(netAmount) || netAmount < 0) throw new Error(`Payment ${index + 1} requires a valid non-negative net amount.`);
    if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) throw new Error(`Payment ${index + 1} requires a tax rate between 0 and 100.`);
    if (!["PENDING", "PAID"].includes(status)) throw new Error(`Payment ${index + 1} has an invalid status.`);
    if (status === "PAID" && !paidAt) throw new Error(`Payment ${index + 1} needs a paid time when marked paid.`);
    return {
      id: state.pricingDraft.payments[index]?.id || "",
      label,
      due_date: dueDate || null,
      net_amount_cents: Math.round(netAmount),
      tax_rate_basis_points: Math.round(taxPercent * 100),
      status,
      paid_at: paidAt || null,
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

function normalizeDateTimePayload(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function formatTaxRatePercent(value) {
  const basisPoints = Number(value || 0);
  if (!Number.isFinite(basisPoints)) return "0";
  return (basisPoints / 100).toFixed(2).replace(/\.00$/, "");
}

function normalizeCurrencyCode(value) {
  return String(value || "USD").trim().toUpperCase() || "USD";
}

function isWholeUnitCurrency(currency) {
  return normalizeCurrencyCode(currency) === "VND";
}

function currencySymbol(currency) {
  const code = normalizeCurrencyCode(currency);
  const symbols = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    VND: "₫",
    THB: "฿",
    LAK: "₭",
    KHR: "៛"
  };
  return symbols[code] || code;
}

function formatMoneyDisplay(value, currency) {
  const amount = Number(value || 0);
  const code = normalizeCurrencyCode(currency);
  if (!Number.isFinite(amount)) return "-";
  if (isWholeUnitCurrency(code)) return `${currencySymbol(code)} ${Math.round(amount)}`;
  const major = amount / 100;
  return `${currencySymbol(code)} ${major.toFixed(2).replace(".", ",")}`;
}

function formatMoneyInputValue(value, currency) {
  const amount = Number(value || 0);
  const code = normalizeCurrencyCode(currency);
  if (!Number.isFinite(amount)) return "0";
  if (isWholeUnitCurrency(code)) return String(Math.round(amount));
  return (amount / 100).toFixed(2);
}

function parseMoneyInputValue(value, currency) {
  const code = normalizeCurrencyCode(currency);
  const normalized = String(value || "0").trim().replace(",", ".");
  const amount = Number(normalized || "0");
  if (!Number.isFinite(amount)) return NaN;
  if (isWholeUnitCurrency(code)) return Math.round(amount);
  return Math.round(amount * 100);
}

function renderInvoiceMoneyLabels() {
  const currency = normalizeCurrencyCode(els.invoiceCurrencyInput?.value || "USD");
  if (els.invoiceDueAmountLabel) {
    els.invoiceDueAmountLabel.textContent = `Due Amount (${currency}, optional)`;
  }
  if (els.invoiceItemsLabel) {
    els.invoiceItemsLabel.textContent = `Items (one per line: Description | Quantity | Unit amount in ${currency})`;
  }
  if (els.invoiceDueAmountInput) {
    els.invoiceDueAmountInput.step = isWholeUnitCurrency(currency) ? "1" : "0.01";
  }
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

function formatDateInput(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function plusOneMonthDateInput(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + 1);
  if (d.getDate() < originalDay) {
    d.setDate(0);
  }
  return formatDateInput(d);
}

function setSelectValue(selectEl, rawValue) {
  if (!selectEl) return;
  const value = String(rawValue || "").trim().toUpperCase() || "USD";
  const hasOption = Array.from(selectEl.options).some((option) => option.value === value);
  if (!hasOption) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  }
  selectEl.value = value;
}

function toEntries(obj) {
  return Object.entries(obj || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ({
      key,
      value: Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value)
    }));
}

async function fetchApi(path, options = {}) {
  const method = options.method || "GET";
  const body = options.body;

  try {
    const response = await fetch(`${apiBase}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.detail ? `${payload.error || "Request failed"}: ${payload.detail}` : payload.error || "Request failed";
      showError(message);
      return null;
    }

    clearError();
    return payload;
  } catch (error) {
    showError("Could not connect to backend API.");
    console.error(error);
    return null;
  }
}

async function fetchBookingMutation(path, options = {}) {
  const method = options.method || "GET";
  const body = options.body;

  try {
    const response = await fetch(`${apiBase}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    const payload = await response.json();
    if (!response.ok) {
      if (response.status === 409 && payload?.code === "BOOKING_HASH_MISMATCH" && payload?.booking) {
        state.booking = payload.booking;
        if (els.noteInput) els.noteInput.value = state.booking.notes || "";
        state.originalNote = String(state.booking.notes || "");
        renderBookingHeader();
        renderBookingData();
        renderActionControls();
        renderPricingPanel();
        loadActivities();
        setStatus("The booking has changed in the backend. The data has been refreshed. Your changes are lost. Please do them again.");
        clearError();
        return null;
      }
      const message = payload?.detail ? `${payload.error || "Request failed"}: ${payload.detail}` : payload.error || "Request failed";
      showError(message);
      return null;
    }

    clearError();
    return payload;
  } catch (error) {
    showError("Could not connect to backend API.");
    console.error(error);
    return null;
  }
}

function buildBookingHref(id) {
  const params = new URLSearchParams({ type: "booking", id, user: state.user });
  return `backend-booking.html?${params.toString()}`;
}

function setStatus(message) {
  if (!els.actionStatus) return;
  els.actionStatus.textContent = message;
}

function clearStatus() {
  setStatus("");
}

async function loadAuthStatus() {
  try {
    const response = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
    const payload = await response.json();
    if (!response.ok || !payload?.authenticated) return;
    state.roles = Array.isArray(payload.user?.roles) ? payload.user.roles : [];
    state.permissions = {
      canChangeAssignment: hasAnyRole(ROLES.ADMIN, ROLES.MANAGER),
      canChangeStage: hasAnyRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.STAFF),
      canEditBooking: hasAnyRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF)
    };
  } catch {
    // leave defaults
  }
}

function hasAnyRole(...roles) {
  return roles.some((role) => state.roles.includes(role));
}

function showError(message) {
  if (!els.error) return;
  els.error.textContent = message;
  els.error.classList.add("show");
}

function clearError() {
  if (!els.error) return;
  els.error.textContent = "";
  els.error.classList.remove("show");
}

function shortId(value) {
  const id = String(value || "");
  return id.length > 6 ? id.slice(-6) : id;
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
