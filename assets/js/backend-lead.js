const qs = new URLSearchParams(window.location.search);
const apiBase = (window.CHAPTER2_API_BASE || "").replace(/\/$/, "");

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

const state = {
  type: qs.get("type") || "lead",
  id: qs.get("id") || "",
  user: qs.get("user") || "admin",
  lead: null,
  customer: null,
  staff: [],
  invoices: [],
  selectedInvoiceId: ""
};

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  back: document.getElementById("backToBackend"),
  logoutLink: document.getElementById("backendLogoutLink"),
  title: document.getElementById("detailTitle"),
  subtitle: document.getElementById("detailSubTitle"),
  error: document.getElementById("detailError"),
  leadDataView: document.getElementById("leadDataView"),
  actionsPanel: document.getElementById("leadActionsPanel"),
  ownerSelect: document.getElementById("leadOwnerSelect"),
  ownerSaveBtn: document.getElementById("leadOwnerSaveBtn"),
  stageSelect: document.getElementById("leadStageSelect"),
  stageSaveBtn: document.getElementById("leadStageSaveBtn"),
  noteInput: document.getElementById("leadNoteInput"),
  noteSaveBtn: document.getElementById("leadNoteSaveBtn"),
  actionStatus: document.getElementById("leadActionStatus"),
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
  invoiceVatInput: document.getElementById("invoiceVatInput"),
  invoiceNotesInput: document.getElementById("invoiceNotesInput"),
  invoiceCreateBtn: document.getElementById("invoiceCreateBtn"),
  invoiceStatus: document.getElementById("invoiceStatus"),
  invoicesTable: document.getElementById("invoicesTable")
};

init();

function init() {
  const backParams = new URLSearchParams({ user: state.user });
  const backHref = `backend.html?${backParams.toString()}`;

  if (els.homeLink) els.homeLink.href = backHref;
  if (els.back) els.back.href = backHref;
  if (els.logoutLink) {
    const returnTo = `${window.location.origin}/index.html`;
    els.logoutLink.href = `${apiBase}/auth/logout?global=true&return_to=${encodeURIComponent(returnTo)}`;
  }

  if (els.ownerSaveBtn) els.ownerSaveBtn.addEventListener("click", saveOwner);
  if (els.stageSaveBtn) els.stageSaveBtn.addEventListener("click", saveStage);
  if (els.noteSaveBtn) els.noteSaveBtn.addEventListener("click", addNote);
  if (els.invoiceSelect) els.invoiceSelect.addEventListener("change", onInvoiceSelectChange);
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

  if (state.type === "customer") {
    if (els.actionsPanel) els.actionsPanel.style.display = "none";
    if (els.invoicePanel) els.invoicePanel.style.display = "none";
    loadCustomer();
    return;
  }

  loadLeadPage();
}

async function loadLeadPage() {
  clearStatus();
  const [leadPayload, staffPayload] = await Promise.all([
    fetchApi(`/api/v1/leads/${encodeURIComponent(state.id)}`),
    fetchApi(`/api/v1/staff?active=true`)
  ]);
  if (!leadPayload) return;

  state.lead = leadPayload.lead || null;
  state.customer = leadPayload.customer || null;
  state.staff = Array.isArray(staffPayload?.items) ? staffPayload.items : [];

  renderLeadHeader();
  renderLeadData();
  renderActionControls();
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
      title: "Related Leads",
      entries: [{ key: "count", value: String((payload.leads || []).length) }]
    }
  ];
  renderSections(sections);

  renderActivitiesTable([]);
  if (els.activitiesTable) {
    els.activitiesTable.innerHTML =
      '<thead><tr><th>Lead ID</th><th>Stage</th><th>Destination</th><th>Style</th><th>Owner</th><th>Created</th></tr></thead>' +
      `<tbody>${(payload.leads || [])
        .map((lead) => {
          const href = buildLeadHref(lead.id);
          return `<tr>
          <td><a href="${escapeHtml(href)}">${escapeHtml(shortId(lead.id))}</a></td>
          <td>${escapeHtml(lead.stage || "-")}</td>
          <td>${escapeHtml(lead.destination || "-")}</td>
          <td>${escapeHtml(lead.style || "-")}</td>
          <td>${escapeHtml(lead.owner_name || "Unassigned")}</td>
          <td>${escapeHtml(formatDateTime(lead.created_at))}</td>
        </tr>`;
        })
        .join("") || '<tr><td colspan="6">No related leads</td></tr>'}</tbody>`;
  }
}

function renderLeadHeader() {
  if (!state.lead) return;
  if (els.title) els.title.textContent = `Lead ${shortId(state.lead.id)}`;
  if (els.subtitle) {
    const customerText = state.customer?.name || state.lead.customer_id || "-";
    els.subtitle.textContent = `${customerText} | ${state.lead.stage || "-"}`;
  }
}

function renderLeadData() {
  if (!state.lead) return;
  const lead = state.lead;
  const sections = [
    {
      title: "Lead",
      entries: [
        ["id", lead.id],
        ["stage", lead.stage],
        ["owner", lead.owner_name || "Unassigned"],
        ["destination", lead.destination],
        ["style", lead.style],
        ["travel_month", lead.travel_month],
        ["travelers", lead.travelers],
        ["duration", lead.duration],
        ["budget", lead.budget],
        ["sla_due_at", formatDateTime(lead.sla_due_at)],
        ["created_at", formatDateTime(lead.created_at)],
        ["updated_at", formatDateTime(lead.updated_at)]
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
      entries: toEntries(lead.source || {})
    }
  ];

  renderSections(sections);
}

function renderSections(sections) {
  if (!els.leadDataView) return;
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
  els.leadDataView.innerHTML = html;
}

function renderActionControls() {
  if (!state.lead) return;

  if (els.stageSelect) {
    const options = STAGES.map((stage) => `<option value="${escapeHtml(stage)}">${escapeHtml(stage)}</option>`).join("");
    els.stageSelect.innerHTML = options;
    els.stageSelect.value = state.lead.stage || STAGES[0];
  }

  if (els.ownerSelect) {
    const options = ['<option value="">Unassigned</option>']
      .concat((state.staff || []).map((staff) => `<option value="${escapeHtml(staff.id)}">${escapeHtml(staff.name)}</option>`))
      .join("");
    els.ownerSelect.innerHTML = options;
    els.ownerSelect.value = state.lead.owner_id || "";
  }
}

async function saveOwner() {
  if (!state.lead || !els.ownerSelect) return;
  const result = await fetchApi(`/api/v1/leads/${encodeURIComponent(state.lead.id)}/owner`, {
    method: "PATCH",
    body: {
      owner_id: els.ownerSelect.value || null,
      actor: state.user
    }
  });
  if (!result?.lead) return;
  state.lead = result.lead;
  renderLeadHeader();
  renderLeadData();
  setStatus("Owner updated.");
  await loadActivities();
}

async function saveStage() {
  if (!state.lead || !els.stageSelect) return;
  const result = await fetchApi(`/api/v1/leads/${encodeURIComponent(state.lead.id)}/stage`, {
    method: "PATCH",
    body: {
      stage: els.stageSelect.value,
      actor: state.user
    }
  });
  if (!result?.lead) return;
  state.lead = result.lead;
  renderLeadHeader();
  renderLeadData();
  setStatus("Stage updated.");
  await loadActivities();
}

async function addNote() {
  if (!state.lead || !els.noteInput) return;
  const text = String(els.noteInput.value || "").trim();
  if (!text) {
    setStatus("Please enter a note.");
    return;
  }

  const result = await fetchApi(`/api/v1/leads/${encodeURIComponent(state.lead.id)}/activities`, {
    method: "POST",
    body: {
      type: "NOTE",
      actor: state.user,
      detail: text
    }
  });
  if (!result?.activity) return;

  els.noteInput.value = "";
  setStatus("Note added.");
  await loadActivities();
}

async function loadActivities() {
  if (!state.lead) return;
  const payload = await fetchApi(`/api/v1/leads/${encodeURIComponent(state.lead.id)}/activities`);
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
  if (!state.lead) return;
  const payload = await fetchApi(`/api/v1/leads/${encodeURIComponent(state.lead.id)}/invoices`);
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
  const header = `<thead><tr><th>PDF</th><th>Invoice</th><th>Version</th><th>Sent to customer</th><th>Total (cents)</th><th>Updated</th><th>Actions</th></tr></thead>`;
  const rows = state.invoices
    .map((invoice) => {
      const checked = invoice.sent_to_customer ? "checked" : "";
      return `<tr>
        <td><a class="btn btn-ghost" href="${escapeHtml(`${apiBase}/api/v1/invoices/${encodeURIComponent(invoice.id)}/pdf`)}" target="_blank" rel="noopener">PDF</a></td>
        <td>${escapeHtml(invoice.invoice_number || shortId(invoice.id))}</td>
        <td>${escapeHtml(String(invoice.version || 1))}</td>
        <td><input type="checkbox" data-invoice-sent="${escapeHtml(invoice.id)}" ${checked} /></td>
        <td>${escapeHtml(String(invoice.total_amount_cents || 0))}</td>
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
  if (els.invoiceIssueDateInput) els.invoiceIssueDateInput.value = normalizeDateInput(invoice.issue_date);
  if (els.invoiceDueDateInput) els.invoiceDueDateInput.value = normalizeDateInput(invoice.due_date);
  if (els.invoiceTitleInput) els.invoiceTitleInput.value = invoice.title || "";
  if (els.invoiceItemsInput) els.invoiceItemsInput.value = invoiceItemsToText(invoice.items || []);
  if (els.invoiceDueAmountInput) els.invoiceDueAmountInput.value = invoice.due_amount_cents ? String(invoice.due_amount_cents) : "";
  if (els.invoiceVatInput) {
    const vat = Number(invoice.vat_percentage || 0);
    els.invoiceVatInput.value = Number.isFinite(vat) ? String(vat) : "0";
  }
  if (els.invoiceNotesInput) els.invoiceNotesInput.value = invoice.notes || "";
}

function resetInvoiceForm() {
  state.selectedInvoiceId = "";
  if (els.invoiceSelect) els.invoiceSelect.value = "";
  if (els.invoiceNumberInput) els.invoiceNumberInput.value = "";
  if (els.invoiceCurrencyInput) setSelectValue(els.invoiceCurrencyInput, "USD");
  if (els.invoiceIssueDateInput) els.invoiceIssueDateInput.value = "";
  if (els.invoiceDueDateInput) els.invoiceDueDateInput.value = "";
  if (els.invoiceTitleInput) els.invoiceTitleInput.value = "";
  if (els.invoiceItemsInput) els.invoiceItemsInput.value = "";
  if (els.invoiceDueAmountInput) els.invoiceDueAmountInput.value = "";
  if (els.invoiceVatInput) els.invoiceVatInput.value = "0";
  if (els.invoiceNotesInput) els.invoiceNotesInput.value = "";
  clearInvoiceStatus();
}

function invoiceItemsToText(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => `${item.description || ""} | ${Number(item.quantity || 1)} | ${Number(item.unit_amount_cents || 0)}`)
    .join("\n");
}

function parseInvoiceItemsText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const items = [];
  for (const line of lines) {
    const parts = line.split("|").map((value) => value.trim());
    if (parts.length < 3) throw new Error(`Invalid line: "${line}". Use "Description | Quantity | Unit amount in cents".`);
    const description = parts[0];
    const quantity = Number(parts[1]);
    const unitAmountCents = Number(parts[2]);
    if (!description) throw new Error(`Missing description in line: "${line}"`);
    if (!Number.isFinite(quantity) || quantity < 1) throw new Error(`Invalid quantity in line: "${line}"`);
    if (!Number.isFinite(unitAmountCents) || unitAmountCents < 1) throw new Error(`Invalid amount in line: "${line}"`);
    items.push({ description, quantity: Math.round(quantity), unit_amount_cents: Math.round(unitAmountCents) });
  }
  return items;
}

function collectInvoicePayload() {
  const items = parseInvoiceItemsText(els.invoiceItemsInput?.value || "");
  const dueAmountRaw = String(els.invoiceDueAmountInput?.value || "").trim();
  const dueAmount = dueAmountRaw ? Number(dueAmountRaw) : null;
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
    currency: String(els.invoiceCurrencyInput?.value || "USD").trim() || "USD",
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
  if (!state.lead) return;
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
    ? `/api/v1/leads/${encodeURIComponent(state.lead.id)}/invoices/${encodeURIComponent(state.selectedInvoiceId)}`
    : `/api/v1/leads/${encodeURIComponent(state.lead.id)}/invoices`;
  const method = isUpdate ? "PATCH" : "POST";
  const result = await fetchApi(path, { method, body: payload });
  if (!result?.invoice) return;
  state.selectedInvoiceId = result.invoice.id;
  setInvoiceStatus(isUpdate ? "Invoice updated." : "Invoice created.");
  await loadInvoices();
}

async function toggleInvoiceSent(invoiceId, sent) {
  if (!state.lead || !invoiceId) return;
  clearInvoiceStatus();
  const result = await fetchApi(
    `/api/v1/leads/${encodeURIComponent(state.lead.id)}/invoices/${encodeURIComponent(invoiceId)}`,
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

function normalizeDateInput(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
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

function buildLeadHref(id) {
  const params = new URLSearchParams({ type: "lead", id, user: state.user });
  return `backend-lead.html?${params.toString()}`;
}

function setStatus(message) {
  if (!els.actionStatus) return;
  els.actionStatus.textContent = message;
}

function clearStatus() {
  setStatus("");
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
