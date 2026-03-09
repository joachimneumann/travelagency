import {
  createApiFetcher,
  escapeHtml,
  formatDateTime,
  normalizeText
} from "./shared/backend-common.js";
import { GENERATED_ATP_STAFF_ROLES } from "../Generated/Models/generated_ATPStaff.js";
import {
  buildBookingHref,
  buildTourEditHref
} from "./shared/backend-links.js";
import { resolveBackendSectionHref } from "./shared/backend-nav.js";
import { renderPagination } from "./shared/backend-pagination.js";

const qs = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  error: document.getElementById("backendError"),
  sectionNavButtons: document.querySelectorAll("[data-backend-section]"),

  bookingsPanel: document.getElementById("bookingsPanel"),
  toursPanel: document.getElementById("toursPanel"),
  settingsPanel: document.getElementById("settingsPanel"),

  bookingsSearch: document.getElementById("bookingsSearch"),
  bookingsSearchBtn: document.getElementById("bookingsSearchBtn"),
  bookingsClearSearchBtn: document.getElementById("bookingsClearSearchBtn"),
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
  { id: "bookings", canAccess: () => state.permissions.canReadBookings },
  { id: "tours", canAccess: () => state.permissions.canReadTours },
  { id: "settings", canAccess: () => state.permissions.canReadSettings }
];

const ROLES = {
  ADMIN: GENERATED_ATP_STAFF_ROLES[0],
  MANAGER: GENERATED_ATP_STAFF_ROLES[1],
  ACCOUNTANT: GENERATED_ATP_STAFF_ROLES[2],
  STAFF: GENERATED_ATP_STAFF_ROLES[3]
};

const state = {
  roles: [],
  permissions: {
    canReadBookings: false,
    canReadSettings: false,
    canManageStaff: false,
    canReadTours: false,
    canEditTours: false
  },
  bookings: { page: 1, pageSize: 10, totalPages: 1, total: 0, search: "" },
  tours: { page: 1, pageSize: 10, totalPages: 1, total: 0, search: "", destination: "all", style: "all" },
  staff: [],
  activeSection: "bookings"
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

  if (state.permissions.canReadBookings) loadBookings();
  if (state.permissions.canManageStaff) loadStaff();
  if (state.permissions.canReadTours) loadTours();
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
      canReadBookings: hasAnyRole(ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.STAFF),
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
    if (section === "persons") {
      button.classList.remove("is-hidden");
      button.addEventListener("click", () => {
        window.location.href = resolveBackendSectionHref(section);
      });
      return;
    }
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
  return section ? section.id : "bookings";
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
      if (section === "bookings") loadBookings();
      if (section === "tours") loadTours();
    });
  }
}

const fetchApi = createApiFetcher({
  apiBase,
  onError: (message) => showError(message),
  suppressNotFound: false,
  includeDetailInError: false,
  connectionErrorMessage: "Could not connect to backend API. Ensure backend is running on localhost:8787."
});

function renderBookings(items) {
  if (els.bookingsClearSearchBtn) {
    els.bookingsClearSearchBtn.hidden = !(!items.length && String(state.bookings.search || "").trim());
  }

  const header = `<thead><tr><th>ID</th><th>Stage</th><th>Primary contact</th><th>Persons</th><th>Destination</th><th>Style</th><th>Staff</th><th>Service Level Agreement due</th></tr></thead>`;
  const rows = items
    .map((booking) => {
      const bookingHref = buildBookingHref(booking.id);
      const persons = getBookingPersons(booking);
      const primaryContact = getPrimaryContact(booking);
      const primaryLabel = [
        primaryContact?.name,
        primaryContact?.emails?.[0],
        primaryContact?.phone_numbers?.[0]
      ].filter(Boolean).join(" | ") || "-";
      const personsSummary = `${persons.length} listed / ${getTravelerCount(booking)} travelers`;
      return `<tr>
        <td><a href="${escapeHtml(bookingHref)}">${escapeHtml(shortId(booking.id))}</a></td>
        <td>${escapeHtml(booking.stage)}</td>
        <td>${escapeHtml(primaryLabel)}</td>
        <td>${escapeHtml(personsSummary)}</td>
        <td>${escapeHtml(Array.isArray(booking.destination) ? booking.destination.join(", ") : booking.destination || "-")}</td>
        <td>${escapeHtml(Array.isArray(booking.style) ? booking.style.join(", ") : booking.style || "-")}</td>
        <td>${escapeHtml(booking.atp_staff_name || "Unassigned")}</td>
        <td>${escapeHtml(formatDateTime(booking.service_level_agreement_due_at))}</td>
      </tr>`;
    })
    .join("");

  const body =
    rows ||
    `<tr><td colspan="8">${escapeHtml(
      `No bookings found${state.bookings.search ? ` for "${state.bookings.search}"` : ""}`
    )}</td></tr>`;
  if (els.bookingsTable) els.bookingsTable.innerHTML = `${header}<tbody>${body}</tbody>`;
}

function renderTours(items) {
  const header = `<thead><tr><th>ID</th><th>Title</th><th>Country</th><th>Styles</th><th>Days</th><th>Price</th><th>Updated</th></tr></thead>`;
  const rows = items
    .map((tour) => {
      const styles = Array.isArray(tour.styles) ? tour.styles.join(", ") : "";
      const countries = Array.isArray(tour.destinations) ? tour.destinations.join(", ") : "";
      const href = buildTourEditHref(tour.id);
      return `<tr>
        <td><a href="${escapeHtml(href)}" title="${escapeHtml(tour.id)}">${escapeHtml(shortId(tour.id))}</a></td>
        <td>${escapeHtml(tour.title || "-")}</td>
        <td>${escapeHtml(countries || "-")}</td>
        <td>${escapeHtml(styles || "-")}</td>
        <td>${escapeHtml(String(tour.travel_duration_days ?? "-"))}</td>
        <td>${escapeHtml(formatIntegerWithGrouping(tour.budget_lower_USD ?? "-"))}</td>
        <td>${escapeHtml(formatDateTime(tour.updated_at || tour.created_at))}</td>
      </tr>`;
    })
    .join("");

  const body = rows || `<tr><td colspan="7">No tours found</td></tr>`;
  if (els.toursTable) els.toursTable.innerHTML = `${header}<tbody>${body}</tbody>`;
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

function getBookingPersons(booking) {
  if (!Array.isArray(booking?.persons)) return [];
  return booking.persons
    .filter((person) => person && typeof person === "object" && !Array.isArray(person))
    .map((person) => ({
      ...person,
      name: normalizeText(person.name) || "",
      roles: Array.from(new Set((Array.isArray(person.roles) ? person.roles : []).map((value) => normalizeText(value)).filter(Boolean))),
      emails: Array.from(
        new Set(
          [person?.email, ...(Array.isArray(person?.emails) ? person.emails : [])]
            .map((value) => normalizeText(value))
            .filter(Boolean)
        )
      ),
      phone_numbers: Array.from(
        new Set(
          [person?.phone_number, person?.phone, ...(Array.isArray(person?.phone_numbers) ? person.phone_numbers : [])]
            .map((value) => normalizeText(value))
            .filter(Boolean)
        )
      )
    }));
}

function getPrimaryContact(booking) {
  const persons = getBookingPersons(booking);
  return persons.find((person) => person.roles.includes("primary_contact")) || persons[0] || null;
}

function getTravelerCount(booking) {
  const persons = getBookingPersons(booking);
  const travelers = persons.filter((person) => person.roles.includes("traveler"));
  return travelers.length || persons.length;
}

function shortId(value) {
  const id = String(value || "");
  return id.length > 6 ? id.slice(-6) : id;
}
