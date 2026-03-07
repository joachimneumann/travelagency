const qs = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");

function resolveApiUrl(pathOrUrl) {
  const value = String(pathOrUrl || "");
  if (/^https?:\/\//.test(value)) return value;
  return `${apiBase}${value}`;
}

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  error: document.getElementById("backendError"),
  sectionNavButtons: document.querySelectorAll("[data-backend-section]"),

  dashboardPanel: document.getElementById("dashboardPanel"),
  customersPanel: document.getElementById("customersPanel"),
  travelGroupsPanel: document.getElementById("travelGroupsPanel"),
  bookingsPanel: document.getElementById("bookingsPanel"),
  toursPanel: document.getElementById("toursPanel"),
  settingsPanel: document.getElementById("settingsPanel"),

  dashboardCustomersCount: document.getElementById("dashboardCustomersCount"),
  dashboardBookingsCount: document.getElementById("dashboardBookingsCount"),
  dashboardToursCount: document.getElementById("dashboardToursCount"),
  dashboardTravelGroupsCount: document.getElementById("dashboardTravelGroupsCount"),

  customersSearch: document.getElementById("customersSearch"),
  customersSearchBtn: document.getElementById("customersSearchBtn"),
  customersCountInfo: document.getElementById("customersCountInfo"),
  customersPagination: document.getElementById("customersPagination"),
  customersTable: document.getElementById("customersTable"),

  bookingsSearch: document.getElementById("bookingsSearch"),
  bookingsSearchBtn: document.getElementById("bookingsSearchBtn"),
  bookingsClearSearchBtn: document.getElementById("bookingsClearSearchBtn"),
  bookingsCountInfo: document.getElementById("bookingsCountInfo"),
  bookingsPagination: document.getElementById("bookingsPagination"),
  bookingsTable: document.getElementById("bookingsTable"),

  travelGroupsCountInfo: document.getElementById("travelGroupsCountInfo"),
  travelGroupsPagination: document.getElementById("travelGroupsPagination"),
  travelGroupsTable: document.getElementById("travelGroupsTable"),
  travelGroupsNotice: document.getElementById("travelGroupsNotice"),

  toursSearch: document.getElementById("toursSearch"),
  toursDestination: document.getElementById("toursDestination"),
  toursStyle: document.getElementById("toursStyle"),
  toursClearFiltersBtn: document.getElementById("toursClearFiltersBtn"),
  toursSearchBtn: document.getElementById("toursSearchBtn"),
  toursCountInfo: document.getElementById("toursCountInfo"),
  toursPagination: document.getElementById("toursPagination"),
  toursTable: document.getElementById("toursTable"),

  staffName: document.getElementById("staffName"),
  staffUsernames: document.getElementById("staffUsernames"),
  staffDestinations: document.getElementById("staffDestinations"),
  staffLanguages: document.getElementById("staffLanguages"),
  staffCreateBtn: document.getElementById("staffCreateBtn"),
  staffStatus: document.getElementById("staffStatus"),
  staffTable: document.getElementById("staffTable")
};

const SECTION_CONFIG = [
  { id: "dashboard", canAccess: () => true },
  { id: "customers", canAccess: () => state.permissions.canReadCustomers },
  { id: "travelGroups", canAccess: () => state.permissions.canReadTravelGroups },
  { id: "bookings", canAccess: () => state.permissions.canReadBookings },
  { id: "tours", canAccess: () => state.permissions.canReadTours },
  { id: "settings", canAccess: () => state.permissions.canReadSettings }
];

const ROLES = {
  ADMIN: "atp_admin",
  MANAGER: "atp_manager",
  ACCOUNTANT: "atp_accountant",
  STAFF: "atp_staff"
};

const state = {
  roles: [],
  permissions: {
    canReadCustomers: false,
    canReadBookings: false,
    canReadTravelGroups: false,
    canReadSettings: false,
    canManageStaff: false,
    canReadTours: false,
    canEditTours: false
  },
  customers: { page: 1, pageSize: 10, totalPages: 1, total: 0, search: "" },
  bookings: { page: 1, pageSize: 10, totalPages: 1, total: 0, search: "" },
  travelGroups: { page: 1, pageSize: 10, totalPages: 1, total: 0, search: "" },
  tours: { page: 1, pageSize: 10, totalPages: 1, total: 0, search: "", destination: "all", style: "all" },
  staff: [],
  activeSection: "dashboard"
};

function formatIntegerWithGrouping(value) {
  if (!Number.isFinite(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    useGrouping: true
  }).format(Number(value));
}

init();

async function init() {
  if (els.homeLink) {
    els.homeLink.href = "backend.html";
  }

  if (els.logoutLink) {
    const returnTo = `${window.location.origin}/index.html`;
    els.logoutLink.href = `${apiBase}/auth/logout?return_to=${encodeURIComponent(returnTo)}`;
  }

  await loadBackendAuthStatus();
  bindSectionNavigation();
  applyRoleVisibility();
  bindControls();

  if (state.permissions.canReadCustomers) loadCustomers();
  if (state.permissions.canReadBookings) loadBookings();
  if (state.permissions.canReadTravelGroups) loadTravelGroups();
  if (state.permissions.canManageStaff) loadStaff();
  if (state.permissions.canReadTours) loadTours();
  updateDashboardCounts();
}

async function loadBackendAuthStatus() {
  if (!els.userLabel) return null;
  try {
    const response = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
    const payload = await response.json();
    if (!response.ok || !payload?.authenticated) {
      els.userLabel.textContent = "";
      return null;
    }
    const user = payload.user?.preferred_username || payload.user?.email || payload.user?.sub || "";
    state.roles = Array.isArray(payload.user?.roles) ? payload.user.roles : [];
    const isAdmin = hasAnyRole(ROLES.ADMIN, ROLES.MANAGER);
    state.permissions = {
      canReadCustomers: hasAnyRole(ROLES.ADMIN, ROLES.MANAGER),
      canReadBookings: hasAnyRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.STAFF),
      canReadTravelGroups: hasAnyRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.STAFF),
      canManageStaff: isAdmin,
      canReadSettings: isAdmin,
      canReadTours: hasAnyRole(ROLES.ADMIN, ROLES.ACCOUNTANT),
      canEditTours: hasAnyRole(ROLES.ADMIN)
    };
    els.userLabel.textContent = user || "";
    return payload.user;
  } catch {
    els.userLabel.textContent = "";
    return null;
  }
}

function bindSectionNavigation() {
  const buttons = Array.from(els.sectionNavButtons || []);
  buttons.forEach((button) => {
    const section = button.dataset.backendSection;
    const allowed = isSectionAllowed(section);
    button.classList.toggle("is-hidden", !allowed);

    if (!allowed) return;

    button.addEventListener("click", () => {
      if (state.activeSection === section) return;
      showSection(section);
    });
  });

  if (buttons.length === 0) return;
  if (!isSectionAllowed(state.activeSection)) {
    state.activeSection = resolveRequestedSection();
  }
}

function bindSearchControls() {
  if (state.permissions.canReadCustomers) {
    bindSearch(els.customersSearchBtn, els.customersSearch, state.customers, loadCustomers);
  }
  if (state.permissions.canReadBookings) {
    bindSearch(els.bookingsSearchBtn, els.bookingsSearch, state.bookings, loadBookings);
    if (els.bookingsClearSearchBtn) {
      els.bookingsClearSearchBtn.addEventListener("click", () => {
        state.bookings.search = "";
        if (els.bookingsSearch) els.bookingsSearch.value = "";
        state.bookings.page = 1;
        loadBookings();
      });
    }
  }
  if (state.permissions.canReadTours) {
    bindSearch(els.toursSearchBtn, els.toursSearch, state.tours, loadTours);
  }

  if (state.permissions.canReadTours && els.toursDestination) {
    els.toursDestination.addEventListener("change", () => {
      state.tours.destination = els.toursDestination.value || "all";
      state.tours.page = 1;
      loadTours();
    });
  }

  if (state.permissions.canReadTours && els.toursStyle) {
    els.toursStyle.addEventListener("change", () => {
      state.tours.style = els.toursStyle.value || "all";
      state.tours.page = 1;
      loadTours();
    });
  }

  if (state.permissions.canReadTours && els.toursClearFiltersBtn) {
    els.toursClearFiltersBtn.addEventListener("click", () => {
      state.tours.destination = "all";
      state.tours.style = "all";
      state.tours.page = 1;
      if (els.toursDestination) els.toursDestination.value = "all";
      if (els.toursStyle) els.toursStyle.value = "all";
      loadTours();
    });
  }

  if (state.permissions.canManageStaff && els.staffCreateBtn) {
    els.staffCreateBtn.addEventListener("click", createStaff);
  }

  const requestedSection = resolveRequestedSection();
  showSection(requestedSection, { updateUrl: false });
}

function bindControls() {
  bindSearchControls();
}

function isSectionAllowed(sectionId) {
  return SECTION_CONFIG.some((item) => item.id === sectionId && item.canAccess());
}

function sectionPanel(sectionId) {
  return els[`${sectionId}Panel`];
}

function firstAllowedSection() {
  const section = SECTION_CONFIG.find((item) => item.canAccess());
  return section ? section.id : "dashboard";
}

function resolveRequestedSection() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("section");
  if (!requested) return firstAllowedSection();
  return isSectionAllowed(requested) ? requested : firstAllowedSection();
}

function showSection(sectionId, options = { updateUrl: true }) {
  const section = isSectionAllowed(sectionId) ? sectionId : firstAllowedSection();
  state.activeSection = section;

  const allowedSections = SECTION_CONFIG.filter((item) => item.canAccess()).map((item) => item.id);
  allowedSections.forEach((id) => {
    const panel = sectionPanel(id);
    if (panel) panel.classList.toggle("is-hidden", id !== section);
  });

  Array.from(els.sectionNavButtons || []).forEach((button) => {
    const candidate = button.dataset.backendSection;
    button.classList.toggle("is-active", candidate === section);
  });

  if (options.updateUrl) {
    const params = new URLSearchParams(window.location.search);
    params.set("section", section);
    if (!params.get("user") && state.user) {
      params.set("user", state.user);
    }
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  }
}

function applyRoleVisibility() {
  SECTION_CONFIG.forEach((section) => {
    const allowed = section.canAccess();
    const button = Array.from(els.sectionNavButtons || []).find(
      (item) => item.dataset.backendSection === section.id
    );
    const panel = sectionPanel(section.id);

    if (button) button.classList.toggle("is-hidden", !allowed);
    if (panel) panel.classList.toggle("is-hidden", !allowed);
  });
}

function hasAnyRole(...roles) {
  return roles.some((role) => state.roles.includes(role));
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
  const pagination = payload.pagination || {};

  state.customers.totalPages = Math.max(
    1,
    Number(pagination.total_pages || Math.ceil(Number(pagination.total_items || 0) / state.customers.pageSize) || 1)
  );
  state.customers.total = Number(pagination.total_items || 0);
  state.customers.page = Number(pagination.page || state.customers.page);
  updatePaginationUi("customers");
  renderCustomers(payload.items || []);
  updateDashboardCounts();
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
  const pagination = payload.pagination || {};

  state.bookings.totalPages = Math.max(
    1,
    Number(pagination.total_pages || Math.ceil(Number(pagination.total_items || 0) / state.bookings.pageSize) || 1)
  );
  state.bookings.total = Number(pagination.total_items || 0);
  state.bookings.page = Number(pagination.page || state.bookings.page);
  updatePaginationUi("bookings");
  renderBookings(payload.items || []);
  updateDashboardCounts();
}

async function loadTravelGroups() {
  clearError();
  const params = new URLSearchParams({
    page: String(state.travelGroups.page),
    page_size: String(state.travelGroups.pageSize),
    sort: "updated_at_desc"
  });
  if (state.travelGroups.search) params.set("search", state.travelGroups.search);

  const payload = await fetchApi(`/api/v1/travel_groups?${params.toString()}`);
  if (!payload) return;
  const pagination = payload.pagination || {};

  if (els.travelGroupsNotice) {
    els.travelGroupsNotice.textContent = payload.items?.length ? "" : "No travel groups found.";
  }
  state.travelGroups.totalPages = Math.max(
    1,
    Number(pagination.total_pages || Math.ceil(Number(pagination.total_items || 0) / state.travelGroups.pageSize) || 1)
  );
  state.travelGroups.total = Number(pagination.total_items || 0);
  state.travelGroups.page = Number(pagination.page || state.travelGroups.page);
  updatePaginationUi("travelGroups");
  renderTravelGroups(payload.items || []);
  updateDashboardCounts();
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
  const pagination = payload.pagination || {};

  state.tours.totalPages = Math.max(
    1,
    Number(pagination.total_pages || Math.ceil(Number(pagination.total_items || 0) / state.tours.pageSize) || 1)
  );
  state.tours.total = Number(pagination.total_items || 0);
  state.tours.page = Number(pagination.page || state.tours.page);
  populateTourFilterOptions(payload);
  updatePaginationUi("tours");
  renderTours(payload.items || []);
  updateDashboardCounts();
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
      if (section === "travelGroups") loadTravelGroups();
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

async function fetchApi(path, options = {}) {
  const method = options.method || "GET";
  const body = options.body;
  const suppressNotFound = options.suppressNotFound || false;
  try {
    const response = await fetch(resolveApiUrl(path), {
      method,
      credentials: "include",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      if (suppressNotFound && response.status === 404) return null;
      showError((payload && payload.error) || "Request failed");
      return null;
    }

    return payload;
  } catch (error) {
    showError("Could not connect to backend API. Ensure backend is running on localhost:8787.");
    console.error(error);
    return null;
  }
}

function updateDashboardCounts() {
  if (els.dashboardCustomersCount) {
    els.dashboardCustomersCount.textContent = formatIntegerWithGrouping(state.customers.total);
  }
  if (els.dashboardBookingsCount) {
    els.dashboardBookingsCount.textContent = formatIntegerWithGrouping(state.bookings.total);
  }
  if (els.dashboardToursCount) {
    els.dashboardToursCount.textContent = formatIntegerWithGrouping(state.tours.total);
  }
  if (els.dashboardTravelGroupsCount) {
    els.dashboardTravelGroupsCount.textContent = formatIntegerWithGrouping(state.travelGroups.total);
  }
}

function renderBookings(items) {
  const canOpenCustomer = state.permissions.canReadCustomers;
  if (els.bookingsClearSearchBtn) {
    els.bookingsClearSearchBtn.hidden = !(!items.length && String(state.bookings.search || "").trim());
  }

  const header = `<thead><tr><th>ID</th><th>Stage</th><th>Customer</th><th>Destination</th><th>Style</th><th>Staff</th><th>SLA due</th></tr></thead>`;
  const rows = items
    .map((booking) => {
      const bookingHref = buildBookingHref(booking.id);
      const customerHref = buildCustomerHref(booking.customer_id || "");
      const customerCell = booking.customer_id
        ? canOpenCustomer
          ? `<a href="${escapeHtml(customerHref)}">${escapeHtml(shortId(booking.customer_id))}</a>`
          : escapeHtml(shortId(booking.customer_id))
        : "-";
      return `<tr>
        <td><a href="${escapeHtml(bookingHref)}">${escapeHtml(shortId(booking.id))}</a></td>
        <td>${escapeHtml(booking.stage)}</td>
        <td>${customerCell}</td>
        <td>${escapeHtml(Array.isArray(booking.destination) ? booking.destination.join(", ") : booking.destination || "-")}</td>
        <td>${escapeHtml(Array.isArray(booking.style) ? booking.style.join(", ") : booking.style || "-")}</td>
        <td>${escapeHtml(booking.staff_name || booking.owner_name || "Unassigned")}</td>
        <td>${escapeHtml(formatDateTime(booking.sla_due_at))}</td>
      </tr>`;
    })
    .join("");

  const body =
    rows ||
    `<tr><td colspan="7">${escapeHtml(
      `No bookings found${state.bookings.search ? ` for "${state.bookings.search}"` : ""}`
    )}</td></tr>`;
  if (els.bookingsTable) els.bookingsTable.innerHTML = `${header}<tbody>${body}</tbody>`;
}

function renderCustomers(items) {
  const header = `<thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Language</th><th>Updated</th></tr></thead>`;
  const rows = items
    .map((customer) => {
      const customerHref = buildCustomerHref(customer.id);
      return `<tr>
        <td><a href="${escapeHtml(customerHref)}">${escapeHtml(shortId(customer.id))}</a></td>
        <td>${escapeHtml(customer.name || "-")}</td>
        <td>${escapeHtml(customer.email || "-")}</td>
        <td>${escapeHtml(customer.phone_number || "-")}</td>
        <td>${escapeHtml(customer.preferred_language || "-")}</td>
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
        <td>${escapeHtml(formatIntegerWithGrouping(tour.priceFrom ?? "-"))}</td>
        <td>${escapeHtml(formatDateTime(tour.updated_at || tour.created_at))}</td>
      </tr>`;
    })
    .join("");

  const body = rows || `<tr><td colspan="7">No tours found</td></tr>`;
  if (els.toursTable) els.toursTable.innerHTML = `${header}<tbody>${body}</tbody>`;
}

function renderTravelGroups(items) {
  const header = `<thead><tr><th>ID</th><th>Name</th><th>Type</th><th>Booking</th><th>Notes</th><th>Updated</th></tr></thead>`;
  const rows = items
    .map((group) => {
      return `<tr>
        <td>${escapeHtml(group.id || "-")}</td>
        <td>${escapeHtml(group.name || "-")}</td>
        <td>${escapeHtml(group.group_type || group.groupType || "-")}</td>
        <td>${escapeHtml(group.booking_id || group.bookingId || "-")}</td>
        <td>${escapeHtml(group.notes || "-")}</td>
        <td>${escapeHtml(formatDateTime(group.updated_at || group.updatedAt))}</td>
      </tr>`;
    })
    .join("");

  const body = rows || `<tr><td colspan="6">No travel groups found</td></tr>`;
  if (els.travelGroupsTable) els.travelGroupsTable.innerHTML = `${header}<tbody>${body}</tbody>`;
}

function buildCustomerHref(id) {
  const params = new URLSearchParams({ id });
  return `customer.html?${params.toString()}`;
}

function buildBookingHref(id) {
  const params = new URLSearchParams({ type: "booking", id });
  return `backend-booking.html?${params.toString()}`;
}

function buildTourEditHref(id) {
  const params = new URLSearchParams({ id });
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

async function loadStaff() {
  clearError();
  const payload = await fetchApi(`/api/v1/atp_staff?active=true`);
  if (!payload) return;
  state.staff = Array.isArray(payload.items) ? payload.items : [];
  renderStaff(state.staff);
}

function renderStaff(items) {
  if (!els.staffTable) return;
  const header = `<thead><tr><th>Name</th><th>Usernames</th><th>Destinations</th><th>Languages</th><th>Active</th></tr></thead>`;
  const rows = items
    .map((staff) => `<tr>
      <td>${escapeHtml(staff.name || "-")}</td>
      <td>${escapeHtml(Array.isArray(staff.usernames) ? staff.usernames.join(", ") : "-")}</td>
      <td>${escapeHtml(Array.isArray(staff.destinations) ? staff.destinations.join(", ") : "-")}</td>
      <td>${escapeHtml(Array.isArray(staff.languages) ? staff.languages.join(", ") : "-")}</td>
      <td>${staff.active ? "Yes" : "No"}</td>
    </tr>`)
    .join("");
  els.staffTable.innerHTML = `${header}<tbody>${rows || '<tr><td colspan="5">No staff found</td></tr>'}</tbody>`;
}

async function createStaff() {
  clearError();
  setStaffStatus("Creating...");
  const payload = {
    name: (els.staffName?.value || "").trim(),
    usernames: (els.staffUsernames?.value || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    destinations: (els.staffDestinations?.value || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    languages: (els.staffLanguages?.value || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    active: true
  };
  const result = await fetchApi(`/api/v1/atp_staff`, { method: "POST", body: payload });
  if (!result?.staff) {
    setStaffStatus("");
    return;
  }
  if (els.staffName) els.staffName.value = "";
  if (els.staffUsernames) els.staffUsernames.value = "";
  if (els.staffDestinations) els.staffDestinations.value = "";
  if (els.staffLanguages) els.staffLanguages.value = "";
  setStaffStatus("Staff created.");
  await loadStaff();
}

function setStaffStatus(message) {
  if (!els.staffStatus) return;
  els.staffStatus.textContent = message;
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
