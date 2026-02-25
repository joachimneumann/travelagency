const qs = new URLSearchParams(window.location.search);
const apiBase = (window.CHAPTER2_API_BASE || "").replace(/\/$/, "");

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  userLabel: document.getElementById("backendUserLabel"),
  error: document.getElementById("backendError"),

  customersSearch: document.getElementById("customersSearch"),
  customersSearchBtn: document.getElementById("customersSearchBtn"),
  customersPrev: document.getElementById("customersPrev"),
  customersNext: document.getElementById("customersNext"),
  customersPageInfo: document.getElementById("customersPageInfo"),
  customersTable: document.getElementById("customersTable"),

  leadsSearch: document.getElementById("leadsSearch"),
  leadsSearchBtn: document.getElementById("leadsSearchBtn"),
  leadsPrev: document.getElementById("leadsPrev"),
  leadsNext: document.getElementById("leadsNext"),
  leadsPageInfo: document.getElementById("leadsPageInfo"),
  leadsTable: document.getElementById("leadsTable")
};

const state = {
  user: qs.get("user") || "admin",
  token: qs.get("api_token") || localStorage.getItem("chapter2_api_token") || "dev-secret-token",

  customers: {
    page: 1,
    pageSize: 10,
    totalPages: 1,
    search: ""
  },
  leads: {
    page: 1,
    pageSize: 10,
    totalPages: 1,
    search: ""
  }
};

init();

function init() {
  localStorage.setItem("chapter2_api_token", state.token);

  if (els.homeLink) {
    const params = new URLSearchParams({ user: state.user, api_token: state.token });
    els.homeLink.href = `backend.html?${params.toString()}`;
  }

  if (els.userLabel) {
    els.userLabel.textContent = `Logged in as: ${state.user}`;
  }

  bindControls();
  loadCustomers();
  loadLeads();
}

function bindControls() {
  if (els.customersSearchBtn) {
    els.customersSearchBtn.addEventListener("click", () => {
      state.customers.page = 1;
      state.customers.search = (els.customersSearch?.value || "").trim();
      loadCustomers();
    });
  }

  if (els.customersSearch) {
    els.customersSearch.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      state.customers.page = 1;
      state.customers.search = (els.customersSearch?.value || "").trim();
      loadCustomers();
    });
  }

  if (els.customersPrev) {
    els.customersPrev.addEventListener("click", () => {
      if (state.customers.page <= 1) return;
      state.customers.page -= 1;
      loadCustomers();
    });
  }

  if (els.customersNext) {
    els.customersNext.addEventListener("click", () => {
      if (state.customers.page >= state.customers.totalPages) return;
      state.customers.page += 1;
      loadCustomers();
    });
  }

  if (els.leadsSearchBtn) {
    els.leadsSearchBtn.addEventListener("click", () => {
      state.leads.page = 1;
      state.leads.search = (els.leadsSearch?.value || "").trim();
      loadLeads();
    });
  }

  if (els.leadsSearch) {
    els.leadsSearch.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      state.leads.page = 1;
      state.leads.search = (els.leadsSearch?.value || "").trim();
      loadLeads();
    });
  }

  if (els.leadsPrev) {
    els.leadsPrev.addEventListener("click", () => {
      if (state.leads.page <= 1) return;
      state.leads.page -= 1;
      loadLeads();
    });
  }

  if (els.leadsNext) {
    els.leadsNext.addEventListener("click", () => {
      if (state.leads.page >= state.leads.totalPages) return;
      state.leads.page += 1;
      loadLeads();
    });
  }
}

async function loadCustomers() {
  clearError();

  const params = new URLSearchParams({
    page: String(state.customers.page),
    page_size: String(state.customers.pageSize)
  });

  if (state.customers.search) {
    params.set("search", state.customers.search);
  }

  const payload = await fetchApi(`/api/v1/customers?${params.toString()}`);
  if (!payload) return;

  state.customers.totalPages = Math.max(1, Number(payload.total_pages || 1));
  updateCustomersPaginationUi(payload);
  renderCustomers(payload.items || []);
}

async function loadLeads() {
  clearError();

  const params = new URLSearchParams({
    page: String(state.leads.page),
    page_size: String(state.leads.pageSize),
    sort: "created_at_desc"
  });

  if (state.leads.search) {
    params.set("search", state.leads.search);
  }

  const payload = await fetchApi(`/api/v1/leads?${params.toString()}`);
  if (!payload) return;

  state.leads.totalPages = Math.max(1, Number(payload.total_pages || 1));
  updateLeadsPaginationUi(payload);
  renderLeads(payload.items || []);
}

function updateCustomersPaginationUi(payload) {
  if (els.customersPageInfo) {
    els.customersPageInfo.textContent = `Page ${payload.page || state.customers.page} / ${payload.total_pages || 1}`;
  }
  if (els.customersPrev) {
    els.customersPrev.disabled = state.customers.page <= 1;
  }
  if (els.customersNext) {
    els.customersNext.disabled = state.customers.page >= state.customers.totalPages;
  }
}

function updateLeadsPaginationUi(payload) {
  if (els.leadsPageInfo) {
    els.leadsPageInfo.textContent = `Page ${payload.page || state.leads.page} / ${payload.total_pages || 1}`;
  }
  if (els.leadsPrev) {
    els.leadsPrev.disabled = state.leads.page <= 1;
  }
  if (els.leadsNext) {
    els.leadsNext.disabled = state.leads.page >= state.leads.totalPages;
  }
}

async function fetchApi(path) {
  try {
    const response = await fetch(`${apiBase}${path}`, {
      headers: {
        Authorization: `Bearer ${state.token}`
      }
    });

    const payload = await response.json();
    if (!response.ok) {
      showError(payload.error || "Request failed");
      return null;
    }

    return payload;
  } catch (error) {
    showError("Could not connect to backend API. Ensure backend is running on localhost:8787.");
    console.error(error);
    return null;
  }
}

function renderLeads(items) {
  const header = `<thead><tr><th>ID</th><th>Stage</th><th>Customer</th><th>Destination</th><th>Style</th><th>Owner</th><th>SLA due</th></tr></thead>`;
  const rows = items
    .map((lead) => {
      const leadHref = buildDetailHref("lead", lead.id);
      const customerHref = buildDetailHref("customer", lead.customer_id || "");
      return `<tr>
        <td><a href="${escapeHtml(leadHref)}">${escapeHtml(lead.id)}</a></td>
        <td>${escapeHtml(lead.stage)}</td>
        <td>${lead.customer_id ? `<a href="${escapeHtml(customerHref)}">${escapeHtml(lead.customer_id)}</a>` : "-"}</td>
        <td>${escapeHtml(lead.destination || "-")}</td>
        <td>${escapeHtml(lead.style || "-")}</td>
        <td>${escapeHtml(lead.owner_name || "Unassigned")}</td>
        <td>${escapeHtml(lead.sla_due_at || "-")}</td>
      </tr>`;
    })
    .join("");

  const body = rows || `<tr><td colspan="7">No leads found</td></tr>`;
  if (els.leadsTable) {
    els.leadsTable.innerHTML = `${header}<tbody>${body}</tbody>`;
  }
}

function renderCustomers(items) {
  const header = `<thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Language</th><th>Updated</th></tr></thead>`;
  const rows = items
    .map((customer) => {
      const customerHref = buildDetailHref("customer", customer.id);
      return `<tr>
        <td><a href="${escapeHtml(customerHref)}">${escapeHtml(customer.id)}</a></td>
        <td>${escapeHtml(customer.name || "-")}</td>
        <td>${escapeHtml(customer.email || "-")}</td>
        <td>${escapeHtml(customer.phone || "-")}</td>
        <td>${escapeHtml(customer.language || "-")}</td>
        <td>${escapeHtml(customer.updated_at || "-")}</td>
      </tr>`;
    })
    .join("");

  const body = rows || `<tr><td colspan="6">No customers found</td></tr>`;
  if (els.customersTable) {
    els.customersTable.innerHTML = `${header}<tbody>${body}</tbody>`;
  }
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

function buildDetailHref(type, id) {
  const params = new URLSearchParams({
    type,
    id,
    user: state.user,
    api_token: state.token
  });
  return `backend-detail.html?${params.toString()}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
