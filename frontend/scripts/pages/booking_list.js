import {
  createApiFetcher,
  escapeHtml,
  normalizeText,
  resolveApiUrl
} from "../shared/api.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import {
  bookingsRequest,
  publicToursRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { buildBookingHref } from "../shared/links.js";
import { renderPagination } from "../shared/pagination.js";
import {
  getPersonInitials,
  getRepresentativeTraveler
} from "../shared/booking_persons.js";
import {
  backendT,
  getBackendApiBase,
  getBackendApiOrigin,
  initializeBackendPageChrome,
  loadBackendPageAuthState
} from "../shared/backend_page.js";

const apiBase = getBackendApiBase();
const apiOrigin = getBackendApiOrigin();

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  error: document.getElementById("backendError"),
  bookingsSearch: document.getElementById("bookingsSearch"),
  bookingsSearchBtn: document.getElementById("bookingsSearchBtn"),
  bookingsClearSearchBtn: document.getElementById("bookingsClearSearchBtn"),
  bookingsCountInfo: document.getElementById("bookingsCountInfo"),
  bookingsPagination: document.getElementById("bookingsPagination"),
  bookingsTable: document.getElementById("bookingsTable")
};

const GENERATED_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_APP_ROLES.map((role) => [String(role).replace(/^atp_/, "").toUpperCase(), role])
  )
);

const ROLES = Object.freeze({
  ADMIN: GENERATED_ROLE_LOOKUP.ADMIN,
  MANAGER: GENERATED_ROLE_LOOKUP.MANAGER,
  ACCOUNTANT: GENERATED_ROLE_LOOKUP.ACCOUNTANT,
  STAFF: GENERATED_ROLE_LOOKUP.STAFF
});

const state = {
  authUser: null,
  roles: [],
  permissions: {
    canReadBookings: false
  },
  bookings: {
    page: 1,
    pageSize: 10,
    totalPages: 1,
    total: 0,
    search: ""
  },
  tourImagesById: new Map()
};

function startConsoleStep(label, details = {}, options = {}) {
  const startedAt = Date.now();
  const warnAfterMs = Number(options.warnAfterMs) > 0 ? Number(options.warnAfterMs) : 3000;
  const stepLabel = `[backend-bookings] ${label}`;
  console.info(`${stepLabel} started.`, details);
  const warningTimer = window.setTimeout(() => {
    console.warn(`${stepLabel} is still pending after ${warnAfterMs}ms.`, {
      pending_for_ms: Date.now() - startedAt,
      ...details
    });
  }, warnAfterMs);

  return {
    done(extraDetails = {}) {
      window.clearTimeout(warningTimer);
      console.info(`${stepLabel} finished.`, {
        duration_ms: Date.now() - startedAt,
        ...details,
        ...extraDetails
      });
    },
    fail(error, extraDetails = {}) {
      window.clearTimeout(warningTimer);
      console.error(`${stepLabel} failed.`, {
        duration_ms: Date.now() - startedAt,
        ...details,
        ...extraDetails
      }, error);
    }
  };
}

function refreshBackendNavElements() {
  els.logoutLink = document.getElementById("backendLogoutLink");
  els.userLabel = document.getElementById("backendUserLabel");
}

function bookingStageLabel(stage) {
  const normalized = String(stage || "").trim().toLowerCase();
  return backendT(
    `booking.stage.${normalized}`,
    String(stage || "")
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function hasAnyRoleInList(roleList, ...roles) {
  return roles.some((role) => roleList.includes(role));
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

const fetchApi = createApiFetcher({
  apiBase,
  onError: (message) => showError(message),
  suppressNotFound: false,
  includeDetailInError: false,
  connectionErrorMessage: backendT("booking.error.connect", "Could not connect to backend API.")
});

init();

async function init() {
  const initStep = startConsoleStep("Booking list page init", {
    pageUrl: window.location.href,
    apiBase,
    apiOrigin
  }, { warnAfterMs: 2000 });
  try {
    const chromeStep = startConsoleStep("Backend chrome bootstrap", {
      pageUrl: window.location.href
    }, { warnAfterMs: 2000 });
    const chrome = await initializeBackendPageChrome({
      currentSection: "bookings",
      homeLink: els.homeLink,
      refreshNav: refreshBackendNavElements
    });
    chromeStep.done({
      logout_link_found: Boolean(chrome?.logoutLink),
      user_label_found: Boolean(chrome?.userLabel)
    });
    els.logoutLink = chrome.logoutLink;
    els.userLabel = chrome.userLabel;

    const authStep = startConsoleStep("Backend auth state load", {
      authMeUrl: `${String(apiOrigin || window.location.origin).replace(/\/$/, "")}/auth/me`
    }, { warnAfterMs: 3000 });
    const authState = await loadBackendPageAuthState({
      apiOrigin,
      refreshNav: refreshBackendNavElements,
      computePermissions: (roles) => ({
        canReadBookings: hasAnyRoleInList(roles, ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.STAFF)
      }),
      hasPageAccess: (permissions) => permissions.canReadBookings,
      logKey: "backend-bookings",
      pageName: "backend.html",
      expectedRolesAnyOf: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.STAFF],
      likelyCause: "The user is authenticated in Keycloak but does not have the ATP roles required to read bookings."
    });
    authStep.done({
      authenticated: Boolean(authState?.authUser),
      authUser: authState?.authUser?.preferred_username || authState?.authUser?.sub || "",
      roles: Array.isArray(authState?.roles) ? authState.roles : [],
      permissions: authState?.permissions || {}
    });
    state.authUser = authState.authUser;
    state.roles = authState.roles;
    state.permissions = {
      canReadBookings: Boolean(authState.permissions?.canReadBookings)
    };
    bindControls();

    if (state.permissions.canReadBookings) {
      await loadBookings();
    } else {
      showError(backendT("booking.error.forbidden", "You do not have access to bookings."));
    }
    initStep.done({
      authenticated_user: state.authUser?.preferred_username || state.authUser?.sub || "",
      roles: state.roles,
      permissions: state.permissions
    });
  } catch (error) {
    initStep.fail(error);
    console.error("[backend-bookings] Booking list page initialization failed.", {
      pageUrl: window.location.href,
      apiBase,
      apiOrigin
    }, error);
  }
}

function bindControls() {
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
  const loadStep = startConsoleStep("Bookings table load", {
    authUser: state.authUser?.preferred_username || state.authUser?.sub || "",
    roles: state.roles,
    search: state.bookings.search || "",
    page: state.bookings.page,
    pageSize: state.bookings.pageSize
  }, { warnAfterMs: 4000 });

  try {
    await ensureTourImageCatalog();

    const params = new URLSearchParams({
      page: String(state.bookings.page),
      page_size: String(state.bookings.pageSize),
      sort: "created_at_desc"
    });
    if (state.bookings.search) params.set("search", state.bookings.search);

    const request = bookingsRequest({ baseURL: apiOrigin, query: Object.fromEntries(params.entries()) });
    const bookingsRequestStep = startConsoleStep("Bookings API request", {
      requestUrl: request.url,
      authUser: state.authUser?.preferred_username || state.authUser?.sub || "",
      roles: state.roles,
      search: state.bookings.search || "",
      page: state.bookings.page,
      pageSize: state.bookings.pageSize
    }, { warnAfterMs: 4000 });
    const payload = await fetchApi(request.url);
    bookingsRequestStep.done({
      received_payload: Boolean(payload),
      item_count: Array.isArray(payload?.items) ? payload.items.length : 0,
      total_items: Number(payload?.pagination?.total_items || 0)
    });
    if (!payload) {
      console.error("[backend-bookings] Bookings request returned no payload, so the bookings table stayed empty.", {
        requestUrl: request.url,
        authUser: state.authUser,
        roles: state.roles,
        permissions: state.permissions,
        page: state.bookings.page,
        pageSize: state.bookings.pageSize,
        search: state.bookings.search || "",
        likelyCause: "The backend request failed earlier, returned a non-JSON response, or the page lost authentication before the list could load."
      });
      return;
    }
    const pagination = payload.pagination || {};

    state.bookings.totalPages = Math.max(
      1,
      Number(pagination.total_pages || Math.ceil(Number(pagination.total_items || 0) / state.bookings.pageSize) || 1)
    );
    state.bookings.total = Number(pagination.total_items || 0);
    state.bookings.page = Number(pagination.page || state.bookings.page);
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (!items.length && !String(state.bookings.search || "").trim()) {
      console.error("[backend-bookings] Empty bookings list returned by API.", {
        requestUrl: request.url,
        authUser: state.authUser,
        roles: state.roles,
        permissions: state.permissions,
        page: state.bookings.page,
        pageSize: state.bookings.pageSize,
        pagination,
        totalItems: state.bookings.total,
        likelyCause: "The bookings API returned zero visible items. On localhost this usually means missing seed data, filtered assignment-based access, or a backend/auth role mismatch."
      });
    }

    updateBookingsPaginationUi();
    renderBookings(items);
    loadStep.done({
      rendered_items: items.length,
      total_items: state.bookings.total,
      page: state.bookings.page,
      total_pages: state.bookings.totalPages
    });
  } catch (error) {
    loadStep.fail(error);
    console.error("[backend-bookings] Unexpected failure while loading bookings.", {
      authUser: state.authUser,
      roles: state.roles,
      permissions: state.permissions,
      page: state.bookings.page,
      pageSize: state.bookings.pageSize,
      search: state.bookings.search || ""
    }, error);
  }
}

async function ensureTourImageCatalog() {
  if (state.tourImagesById.size) return;
  const requestUrl = publicToursRequest({ baseURL: apiOrigin }).url;
  const toursStep = startConsoleStep("Public tour image preload", {
    requestUrl,
    authUser: state.authUser?.preferred_username || state.authUser?.sub || "",
    roles: state.roles
  }, { warnAfterMs: 4000 });
  const payload = await fetchApi(publicToursRequest({ baseURL: apiOrigin }).url, {
    includeDetailInError: false,
    connectionErrorMessage: backendT("tour.error.load_public_images", "Could not load public tour images.")
  });
  if (!payload) {
    toursStep.done({
      received_payload: false
    });
    console.error("[backend-bookings] Public tour image preload returned no payload.", {
      requestUrl: publicToursRequest({ baseURL: apiOrigin }).url,
      authUser: state.authUser,
      roles: state.roles,
      permissions: state.permissions,
      likelyCause: "The bookings page preloads public tour images before rendering. If that request fails, bookings can still load, but this indicates a backend or frontend API problem."
    });
  }
  const items = Array.isArray(payload?.items) ? payload.items : [];
  state.tourImagesById = new Map(
    items
      .map((tour) => [normalizeText(tour?.id), normalizeText(tour?.image)])
      .filter(([tourId]) => Boolean(tourId))
  );
  toursStep.done({
    received_payload: true,
    item_count: items.length,
    cached_images: state.tourImagesById.size
  });
}

function updateBookingsPaginationUi() {
  if (els.bookingsCountInfo) {
    els.bookingsCountInfo.textContent = "";
  }

  if (els.bookingsPagination) {
    renderPagination(els.bookingsPagination, state.bookings, (page) => {
      state.bookings.page = page;
      loadBookings();
    });
  }
}

function renderBookings(items) {
  if (els.bookingsClearSearchBtn) {
    els.bookingsClearSearchBtn.hidden = !(!items.length && String(state.bookings.search || "").trim());
  }

  const header = `<thead><tr><th>${escapeHtml(backendT("backend.table.id", "ID"))}</th><th>${escapeHtml(backendT("backend.table.booking_name", "Booking Name"))}</th><th class="booking-list-col-stage">${escapeHtml(backendT("backend.table.stage", "Stage"))}</th><th class="booking-list-col-staff">${escapeHtml(backendT("backend.table.staff", "ATP staff"))}</th></tr></thead>`;
  const rows = items
    .map((booking) => {
      const bookingHref = buildBookingHref(booking.id);
      const bookingName = normalizeText(booking.name) || "-";
      const representativeTraveler = getRepresentativeTraveler(booking);
      const representativeMarkup = representativeTraveler
        ? renderRepresentativeTravelerMarkup(representativeTraveler)
        : "";
      const bookingImageMarkup = renderBookingImageMarkup(booking);
      return `<tr>
        <td><a href="${escapeHtml(bookingHref)}">${escapeHtml(shortId(booking.id))}</a></td>
        <td>
          <div class="booking-list__name-cell">
            <span class="booking-list__booking-thumb">${bookingImageMarkup}</span>
            <div class="booking-list__name-copy">
              <div class="booking-list__booking-name">${escapeHtml(bookingName)}</div>
              ${representativeMarkup}
            </div>
          </div>
        </td>
        <td>${escapeHtml(bookingStageLabel(booking.stage || "-"))}</td>
        <td>${escapeHtml(resolveAssignedKeycloakUserLabel(booking))}</td>
      </tr>`;
    })
    .join("");

  const body =
    rows ||
    `<tr><td colspan="4">${escapeHtml(
      backendT("backend.bookings.no_results", "No bookings found{suffix}", {
        suffix: state.bookings.search
          ? backendT("backend.bookings.search_suffix", ' for "{query}"', { query: state.bookings.search })
          : ""
      })
    )}</td></tr>`;
  if (els.bookingsTable) els.bookingsTable.innerHTML = `${header}<tbody>${body}</tbody>`;
}

function renderBookingImageMarkup(booking) {
  const bookingImage = normalizeText(booking?.image);
  const tourId = normalizeText(booking?.web_form_submission?.tour_id);
  const tourImage = tourId ? normalizeText(state.tourImagesById.get(tourId)) : "";
  const representativeTraveler = getRepresentativeTraveler(booking);
  const imageRef = bookingImage || tourImage;
  const alt = normalizeText(booking?.name) || backendT("booking.picture", "Booking picture");
  const isDiscoveryCallWithoutTour = !imageRef && !tourId && Boolean(normalizeText(booking?.web_form_submission?.page_url));

  if (imageRef) {
    return `<img class="booking-list__booking-thumb-image" src="${escapeHtml(resolveRepresentativePhotoSrc(imageRef))}" alt="${escapeHtml(alt)}" />`;
  }

  if (isDiscoveryCallWithoutTour) {
    return `<img class="booking-list__booking-thumb-image" src="assets/img/happy_tourists.webp" alt="${escapeHtml(alt)}" />`;
  }

  if (representativeTraveler && normalizeText(representativeTraveler.photo_ref)) {
    return `<img class="booking-list__booking-thumb-image" src="${escapeHtml(resolveRepresentativePhotoSrc(representativeTraveler.photo_ref))}" alt="" />`;
  }

  if (representativeTraveler && normalizeText(representativeTraveler.name)) {
    return `<span class="booking-list__booking-thumb-initials">${escapeHtml(getPersonInitials(representativeTraveler.name))}</span>`;
  }

  return '<img class="booking-list__booking-thumb-image" src="assets/img/profile_person.png" alt="" />';
}

function renderRepresentativeTravelerMarkup(person) {
  const personName = normalizeText(person?.name) || backendT("booking.representative_traveler", "Representative traveler");
  const photoRef = normalizeText(person?.photo_ref);
  const avatarMarkup = photoRef
    ? `<img class="booking-list__representative-avatar-image" src="${escapeHtml(resolveRepresentativePhotoSrc(photoRef))}" alt="" />`
    : normalizeText(person?.name)
      ? `<span class="booking-list__representative-avatar-initials">${escapeHtml(getPersonInitials(person.name))}</span>`
      : `<img class="booking-list__representative-avatar-image" src="assets/img/profile_person.png" alt="" />`;

  return `
    <div class="booking-list__representative">
      <span class="booking-list__representative-avatar">${avatarMarkup}</span>
      <span class="booking-list__representative-name">${escapeHtml(personName)}</span>
    </div>
  `;
}

function resolveRepresentativePhotoSrc(photoRef) {
  const imagePath = normalizeText(photoRef) || "assets/img/profile_person.png";
  return /^assets\//.test(imagePath) ? imagePath : resolveApiUrl(apiBase, imagePath);
}

function shortId(value) {
  const id = String(value || "");
  return id.length > 6 ? id.slice(-6) : id;
}

function resolveAssignedKeycloakUserLabel(booking) {
  const assignedKeycloakUserLabel = normalizeText(booking?.assigned_keycloak_user_label);
  if (assignedKeycloakUserLabel) return assignedKeycloakUserLabel;
  const assignedKeycloakUserId = normalizeText(booking?.assigned_keycloak_user_id);
  return assignedKeycloakUserId || backendT("common.unassigned", "Unassigned");
}
