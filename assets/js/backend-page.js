const qs = new URLSearchParams(window.location.search);
const apiBase = (window.CHAPTER2_API_BASE || "").replace(/\/$/, "");

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  error: document.getElementById("backendError"),

  customersSearch: document.getElementById("customersSearch"),
  customersSearchBtn: document.getElementById("customersSearchBtn"),
  customersCountInfo: document.getElementById("customersCountInfo"),
  customersPagination: document.getElementById("customersPagination"),
  customersTable: document.getElementById("customersTable"),

  leadsSearch: document.getElementById("leadsSearch"),
  leadsSearchBtn: document.getElementById("leadsSearchBtn"),
  leadsCountInfo: document.getElementById("leadsCountInfo"),
  leadsPagination: document.getElementById("leadsPagination"),
  leadsTable: document.getElementById("leadsTable")
};

const state = {
  user: qs.get("user") || "admin",
  customers: {
    page: 1,
    pageSize: 10,
    totalPages: 1,
    total: 0,
    search: ""
  },
  leads: {
    page: 1,
    pageSize: 10,
    totalPages: 1,
    total: 0,
    search: ""
  }
};

init();

function init() {
  if (els.homeLink) {
    const params = new URLSearchParams({ user: state.user });
    els.homeLink.href = `backend.html?${params.toString()}`;
  }
  if (els.logoutLink) {
    const returnTo = `${window.location.origin}/index.html`;
    els.logoutLink.href = `${apiBase}/auth/logout?global=true&return_to=${encodeURIComponent(returnTo)}`;
  }
  loadBackendAuthStatus();

  bindControls();
  loadCustomers();
  loadLeads();
}

async function loadBackendAuthStatus() {
  if (!els.userLabel) return;
  try {
    const response = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
    const payload = await response.json();
    if (!response.ok || !payload?.authenticated) {
      els.userLabel.textContent = "";
      return;
    }
    const user = payload.user?.preferred_username || payload.user?.email || payload.user?.sub || "";
    els.userLabel.textContent = user ? `Logged in as: ${user}` : "";
  } catch {
    els.userLabel.textContent = "";
  }
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
  state.customers.total = Number(payload.total || 0);
  state.customers.page = Number(payload.page || state.customers.page);
  updateCustomersPaginationUi();
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
  state.leads.total = Number(payload.total || 0);
  state.leads.page = Number(payload.page || state.leads.page);
  updateLeadsPaginationUi();
  renderLeads(payload.items || []);
}

function updateCustomersPaginationUi() {
  if (els.customersCountInfo) {
    els.customersCountInfo.textContent = `${state.customers.total} total · page ${state.customers.page} of ${state.customers.totalPages}`;
  }
  if (els.customersPagination) {
    renderPagination(els.customersPagination, state.customers, (page) => {
      state.customers.page = page;
      loadCustomers();
    });
  }
}

function updateLeadsPaginationUi() {
  if (els.leadsCountInfo) {
    els.leadsCountInfo.textContent = `${state.leads.total} total · page ${state.leads.page} of ${state.leads.totalPages}`;
  }
  if (els.leadsPagination) {
    renderPagination(els.leadsPagination, state.leads, (page) => {
      state.leads.page = page;
      loadLeads();
    });
  }
}

function renderPagination(container, pager, onPageChange) {
  const current = pager.page;
  const total = pager.totalPages;

  const parts = [];

  parts.push(
    buttonHtml({
      label: "Previous",
      disabled: current <= 1,
      page: current - 1,
      cls: "backend-page-btn"
    })
  );

  for (const page of visiblePages(current, total)) {
    if (page === "...") {
      parts.push(`<span class="backend-page-ellipsis">...</span>`);
      continue;
    }

    parts.push(
      buttonHtml({
        label: String(page),
        disabled: page === current,
        page,
        current: page === current,
        cls: "backend-page-btn"
      })
    );
  }

  parts.push(
    buttonHtml({
      label: "Next",
      disabled: current >= total,
      page: current + 1,
      cls: "backend-page-btn"
    })
  );

  container.innerHTML = parts.join("");

  container.querySelectorAll("button[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = Number(btn.getAttribute("data-page"));
      if (!Number.isFinite(page)) return;
      if (page < 1 || page > total) return;
      onPageChange(page);
    });
  });
}

function visiblePages(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push("...");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push("...");

  pages.push(total);
  return pages;
}

function buttonHtml({ label, disabled, page, current = false, cls = "" }) {
  const attrs = [
    `class="${cls}"`,
    `type="button"`,
    `data-page="${page}"`,
    disabled ? "disabled" : "",
    current ? 'aria-current="page"' : ""
  ]
    .filter(Boolean)
    .join(" ");
  return `<button ${attrs}>${escapeHtml(label)}</button>`;
}

async function fetchApi(path) {
  try {
    const response = await fetch(`${apiBase}${path}`, {
      credentials: "include",
      headers: {}
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
    user: state.user
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
