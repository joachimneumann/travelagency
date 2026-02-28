const qs = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");

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

  bookingsSearch: document.getElementById("bookingsSearch"),
  bookingsSearchBtn: document.getElementById("bookingsSearchBtn"),
  bookingsCountInfo: document.getElementById("bookingsCountInfo"),
  bookingsPagination: document.getElementById("bookingsPagination"),
  bookingsTable: document.getElementById("bookingsTable"),

  toursSearch: document.getElementById("toursSearch"),
  toursDestination: document.getElementById("toursDestination"),
  toursStyle: document.getElementById("toursStyle"),
  toursClearFiltersBtn: document.getElementById("toursClearFiltersBtn"),
  toursSearchBtn: document.getElementById("toursSearchBtn"),
  toursCountInfo: document.getElementById("toursCountInfo"),
  toursPagination: document.getElementById("toursPagination"),
  toursTable: document.getElementById("toursTable")
};

const state = {
  user: qs.get("user") || "admin",
  customers: { page: 1, pageSize: 10, totalPages: 1, total: 0, search: "" },
  bookings: { page: 1, pageSize: 10, totalPages: 1, total: 0, search: "" },
  tours: { page: 1, pageSize: 10, totalPages: 1, total: 0, search: "", destination: "all", style: "all" }
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
  loadBookings();
  loadTours();
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
  bindSearch(els.customersSearchBtn, els.customersSearch, state.customers, loadCustomers);
  bindSearch(els.bookingsSearchBtn, els.bookingsSearch, state.bookings, loadBookings);
  bindSearch(els.toursSearchBtn, els.toursSearch, state.tours, loadTours);

  if (els.toursDestination) {
    els.toursDestination.addEventListener("change", () => {
      state.tours.destination = els.toursDestination.value || "all";
      state.tours.page = 1;
      loadTours();
    });
  }

  if (els.toursStyle) {
    els.toursStyle.addEventListener("change", () => {
      state.tours.style = els.toursStyle.value || "all";
      state.tours.page = 1;
      loadTours();
    });
  }

  if (els.toursClearFiltersBtn) {
    els.toursClearFiltersBtn.addEventListener("click", () => {
      state.tours.destination = "all";
      state.tours.style = "all";
      state.tours.page = 1;
      if (els.toursDestination) els.toursDestination.value = "all";
      if (els.toursStyle) els.toursStyle.value = "all";
      loadTours();
    });
  }
}

function bindSearch(searchBtn, searchInput, model, reloadFn) {
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      model.page = 1;
      model.search = (searchInput?.value || "").trim();
      reloadFn();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      model.page = 1;
      model.search = (searchInput?.value || "").trim();
      reloadFn();
    });
  }
}

async function loadCustomers() {
  clearError();

  const params = new URLSearchParams({
    page: String(state.customers.page),
    page_size: String(state.customers.pageSize)
  });
  if (state.customers.search) params.set("search", state.customers.search);

  const payload = await fetchApi(`/api/v1/customers?${params.toString()}`);
  if (!payload) return;

  state.customers.totalPages = Math.max(1, Number(payload.total_pages || 1));
  state.customers.total = Number(payload.total || 0);
  state.customers.page = Number(payload.page || state.customers.page);
  updatePaginationUi("customers");
  renderCustomers(payload.items || []);
}

async function loadBookings() {
  clearError();

  const params = new URLSearchParams({
    page: String(state.bookings.page),
    page_size: String(state.bookings.pageSize),
    sort: "created_at_desc"
  });
  if (state.bookings.search) params.set("search", state.bookings.search);

  const payload = await fetchApi(`/api/v1/bookings?${params.toString()}`);
  if (!payload) return;

  state.bookings.totalPages = Math.max(1, Number(payload.total_pages || 1));
  state.bookings.total = Number(payload.total || 0);
  state.bookings.page = Number(payload.page || state.bookings.page);
  updatePaginationUi("bookings");
  renderBookings(payload.items || []);
}

async function loadTours() {
  clearError();

  const params = new URLSearchParams({
    page: String(state.tours.page),
    page_size: String(state.tours.pageSize),
    sort: "updated_at_desc"
  });
  if (state.tours.search) params.set("search", state.tours.search);
  if (state.tours.destination && state.tours.destination !== "all") params.set("destination", state.tours.destination);
  if (state.tours.style && state.tours.style !== "all") params.set("style", state.tours.style);

  const payload = await fetchApi(`/api/v1/tours?${params.toString()}`);
  if (!payload) return;

  state.tours.totalPages = Math.max(1, Number(payload.total_pages || 1));
  state.tours.total = Number(payload.total || 0);
  state.tours.page = Number(payload.page || state.tours.page);
  populateTourFilterOptions(payload);
  updatePaginationUi("tours");
  renderTours(payload.items || []);
}

function populateTourFilterOptions(payload) {
  const destinations = Array.isArray(payload?.available_destinations) ? payload.available_destinations : [];
  const styles = Array.isArray(payload?.available_styles) ? payload.available_styles : [];

  if (els.toursDestination) {
    const current = state.tours.destination || "all";
    const options = ['<option value="all">All destinations</option>']
      .concat(destinations.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
      .join("");
    els.toursDestination.innerHTML = options;
    els.toursDestination.value = destinations.includes(current) ? current : "all";
    state.tours.destination = els.toursDestination.value;
  }

  if (els.toursStyle) {
    const current = state.tours.style || "all";
    const options = ['<option value="all">All styles</option>']
      .concat(styles.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
      .join("");
    els.toursStyle.innerHTML = options;
    els.toursStyle.value = styles.includes(current) ? current : "all";
    state.tours.style = els.toursStyle.value;
  }
}

function updatePaginationUi(section) {
  const model = state[section];
  const countInfo = els[`${section}CountInfo`];
  const pagination = els[`${section}Pagination`];

  if (countInfo) {
    countInfo.textContent = `${model.total} total · page ${model.page} of ${model.totalPages}`;
  }

  if (pagination) {
    renderPagination(pagination, model, (page) => {
      model.page = page;
      if (section === "customers") loadCustomers();
      if (section === "bookings") loadBookings();
      if (section === "tours") loadTours();
    });
  }
}

function renderPagination(container, pager, onPageChange) {
  const current = pager.page;
  const total = pager.totalPages;

  const parts = [
    buttonHtml({ label: "Previous", disabled: current <= 1, page: current - 1, cls: "backend-page-btn" })
  ];

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

  parts.push(buttonHtml({ label: "Next", disabled: current >= total, page: current + 1, cls: "backend-page-btn" }));
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
    'type="button"',
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

function renderBookings(items) {
  const header = `<thead><tr><th>ID</th><th>Stage</th><th>Customer</th><th>Destination</th><th>Style</th><th>Owner</th><th>SLA due</th></tr></thead>`;
  const rows = items
    .map((booking) => {
      const bookingHref = buildDetailHref("booking", booking.id);
      const customerHref = buildDetailHref("customer", booking.customer_id || "");
      return `<tr>
        <td><a href="${escapeHtml(bookingHref)}">${escapeHtml(shortId(booking.id))}</a></td>
        <td>${escapeHtml(booking.stage)}</td>
        <td>${booking.customer_id ? `<a href="${escapeHtml(customerHref)}">${escapeHtml(shortId(booking.customer_id))}</a>` : "-"}</td>
        <td>${escapeHtml(booking.destination || "-")}</td>
        <td>${escapeHtml(booking.style || "-")}</td>
        <td>${escapeHtml(booking.owner_name || "Unassigned")}</td>
        <td>${escapeHtml(formatDateTime(booking.sla_due_at))}</td>
      </tr>`;
    })
    .join("");

  const body = rows || `<tr><td colspan="7">No bookings found</td></tr>`;
  if (els.bookingsTable) els.bookingsTable.innerHTML = `${header}<tbody>${body}</tbody>`;
}

function renderCustomers(items) {
  const header = `<thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Language</th><th>Updated</th></tr></thead>`;
  const rows = items
    .map((customer) => {
      const customerHref = buildDetailHref("customer", customer.id);
      return `<tr>
        <td><a href="${escapeHtml(customerHref)}">${escapeHtml(shortId(customer.id))}</a></td>
        <td>${escapeHtml(customer.name || "-")}</td>
        <td>${escapeHtml(customer.email || "-")}</td>
        <td>${escapeHtml(customer.phone || "-")}</td>
        <td>${escapeHtml(customer.language || "-")}</td>
        <td>${escapeHtml(formatDateTime(customer.updated_at))}</td>
      </tr>`;
    })
    .join("");

  const body = rows || `<tr><td colspan="6">No customers found</td></tr>`;
  if (els.customersTable) els.customersTable.innerHTML = `${header}<tbody>${body}</tbody>`;
}

function renderTours(items) {
  const header = `<thead><tr><th>ID</th><th>Title</th><th>Country</th><th>Styles</th><th>Days</th><th>Price</th><th>Updated</th></tr></thead>`;
  const rows = items
    .map((tour) => {
      const styles = Array.isArray(tour.styles) ? tour.styles.join(", ") : "";
      const countries = Array.isArray(tour.destinationCountries) ? tour.destinationCountries.join(", ") : "";
      const href = buildTourEditHref(tour.id);
      return `<tr>
        <td><a href="${escapeHtml(href)}" title="${escapeHtml(tour.id)}">${escapeHtml(shortId(tour.id))}</a></td>
        <td>${escapeHtml(tour.title || "-")}</td>
        <td>${escapeHtml(countries || "-")}</td>
        <td>${escapeHtml(styles || "-")}</td>
        <td>${escapeHtml(String(tour.durationDays ?? "-"))}</td>
        <td>${escapeHtml(String(tour.priceFrom ?? "-"))}</td>
        <td>${escapeHtml(formatDateTime(tour.updated_at || tour.created_at))}</td>
      </tr>`;
    })
    .join("");

  const body = rows || `<tr><td colspan="7">No tours found</td></tr>`;
  if (els.toursTable) els.toursTable.innerHTML = `${header}<tbody>${body}</tbody>`;
}

function buildDetailHref(type, id) {
  const params = new URLSearchParams({ type, id, user: state.user });
  return `backend-booking.html?${params.toString()}`;
}

function buildTourEditHref(id) {
  const params = new URLSearchParams({ id, user: state.user });
  return `backend-tour.html?${params.toString()}`;
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
