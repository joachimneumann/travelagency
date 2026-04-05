import {
  createApiFetcher,
  escapeHtml,
  normalizeText,
  resolveApiUrl
} from "../shared/api.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import {
  GENERATED_CURRENCIES,
  normalizeCurrencyCode as normalizeGeneratedCurrencyCode
} from "../../Generated/Models/generated_Currency.js";
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
import { BOOKING_CONTENT_LANGUAGE_OPTIONS } from "../booking/i18n.js";
import {
  COUNTRY_CODE_OPTIONS,
  TOUR_STYLE_CODE_OPTIONS
} from "../shared/generated_catalogs.js";

const apiBase = getBackendApiBase();
const apiOrigin = getBackendApiOrigin();
const DESTINATION_COUNTRY_CODES = Object.freeze(["VN", "TH", "KH", "LA"]);
const DESTINATION_COUNTRY_OPTIONS = Object.freeze(
  COUNTRY_CODE_OPTIONS.filter((option) => DESTINATION_COUNTRY_CODES.includes(option?.value))
);

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  error: document.getElementById("backendError"),
  bookingsSearch: document.getElementById("bookingsSearch"),
  bookingsSearchBtn: document.getElementById("bookingsSearchBtn"),
  bookingsClearSearchBtn: document.getElementById("bookingsClearSearchBtn"),
  bookingCreateOpenBtn: document.getElementById("bookingCreateOpenBtn"),
  bookingCreateModal: document.getElementById("bookingCreateModal"),
  bookingCreateCloseBtn: document.getElementById("bookingCreateCloseBtn"),
  bookingCreateCancelBtn: document.getElementById("bookingCreateCancelBtn"),
  bookingCreateSubmitBtn: document.getElementById("bookingCreateSubmitBtn"),
  bookingCreateForm: document.getElementById("bookingCreateForm"),
  bookingCreateStatus: document.getElementById("bookingCreateStatus"),
  bookingCreateTitleInput: document.getElementById("bookingCreateTitleInput"),
  bookingCreateLanguageInput: document.getElementById("bookingCreateLanguageInput"),
  bookingCreateCurrencyInput: document.getElementById("bookingCreateCurrencyInput"),
  bookingCreateDestinationsInput: document.getElementById("bookingCreateDestinationsInput"),
  bookingCreateTravelStylesInput: document.getElementById("bookingCreateTravelStylesInput"),
  bookingCreatePrimaryContactNameInput: document.getElementById("bookingCreatePrimaryContactNameInput"),
  bookingCreatePrimaryContactEmailInput: document.getElementById("bookingCreatePrimaryContactEmailInput"),
  bookingCreatePrimaryContactPhoneInput: document.getElementById("bookingCreatePrimaryContactPhoneInput"),
  bookingCreateTravelerCountInput: document.getElementById("bookingCreateTravelerCountInput"),
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
  createBookingInFlight: false,
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

function normalizeCurrencyCode(value) {
  return normalizeGeneratedCurrencyCode(value) || "USD";
}

function selectedValues(selectEl) {
  if (selectEl instanceof HTMLSelectElement) {
    return Array.from(selectEl.selectedOptions)
      .map((option) => normalizeText(option.value))
      .filter(Boolean);
  }
  if (!(selectEl instanceof HTMLElement)) return [];
  return Array.from(selectEl.querySelectorAll('input[type="checkbox"]:checked'))
    .map((input) => normalizeText(input instanceof HTMLInputElement ? input.value : ""))
    .filter(Boolean);
}

function renderCheckboxOption(kind, value, label = value) {
  const safeValue = escapeHtml(value);
  const safeLabel = escapeHtml(label);
  const inputId = `${kind}_${value.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  return `
    <label class="filter-checkbox-option" for="${escapeHtml(inputId)}">
      <input id="${escapeHtml(inputId)}" type="checkbox" value="${safeValue}" />
      <span>${safeLabel}</span>
    </label>
  `;
}

function setCreateBookingStatus(message = "") {
  if (!els.bookingCreateStatus) return;
  els.bookingCreateStatus.textContent = message;
}

function populateCreateBookingOptions() {
  if (els.bookingCreateLanguageInput instanceof HTMLSelectElement) {
    els.bookingCreateLanguageInput.innerHTML = BOOKING_CONTENT_LANGUAGE_OPTIONS
      .map((option) => `<option value="${escapeHtml(option.code)}">${escapeHtml(option.label || option.apiValue || option.code.toUpperCase())}</option>`)
      .join("");
    els.bookingCreateLanguageInput.value = "en";
  }

  if (els.bookingCreateCurrencyInput instanceof HTMLSelectElement) {
    els.bookingCreateCurrencyInput.innerHTML = Object.keys(GENERATED_CURRENCIES || {})
      .map((code) => `<option value="${escapeHtml(code)}">${escapeHtml(code)}</option>`)
      .join("");
    els.bookingCreateCurrencyInput.value = normalizeCurrencyCode("USD");
  }

  if (els.bookingCreateDestinationsInput instanceof HTMLSelectElement) {
    els.bookingCreateDestinationsInput.innerHTML = DESTINATION_COUNTRY_OPTIONS
      .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label || option.value)}</option>`)
      .join("");
  } else if (els.bookingCreateDestinationsInput instanceof HTMLElement) {
    els.bookingCreateDestinationsInput.innerHTML = DESTINATION_COUNTRY_OPTIONS
      .map((option) => renderCheckboxOption("bookingCreateDestination", option.value, option.label || option.value))
      .join("");
  }

  if (els.bookingCreateTravelStylesInput instanceof HTMLSelectElement) {
    els.bookingCreateTravelStylesInput.innerHTML = TOUR_STYLE_CODE_OPTIONS
      .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label || option.value)}</option>`)
      .join("");
  } else if (els.bookingCreateTravelStylesInput instanceof HTMLElement) {
    els.bookingCreateTravelStylesInput.innerHTML = TOUR_STYLE_CODE_OPTIONS
      .map((option) => renderCheckboxOption("bookingCreateStyle", option.value, option.label || option.value))
      .join("");
  }
}

function resetCreateBookingForm() {
  els.bookingCreateForm?.reset();
  populateCreateBookingOptions();
  setCreateBookingStatus("");
}

function setCreateBookingControlsDisabled(disabled) {
  const controls = [
    els.bookingCreateCloseBtn,
    els.bookingCreateCancelBtn,
    els.bookingCreateSubmitBtn,
    els.bookingCreateTitleInput,
    els.bookingCreateLanguageInput,
    els.bookingCreateCurrencyInput,
    els.bookingCreateDestinationsInput,
    els.bookingCreateTravelStylesInput,
    els.bookingCreatePrimaryContactNameInput,
    els.bookingCreatePrimaryContactEmailInput,
    els.bookingCreatePrimaryContactPhoneInput,
    els.bookingCreateTravelerCountInput
  ];
  for (const control of controls) {
    if (control) control.disabled = Boolean(disabled);
  }
  [els.bookingCreateDestinationsInput, els.bookingCreateTravelStylesInput].forEach((container) => {
    if (!(container instanceof HTMLElement)) return;
    Array.from(container.querySelectorAll('input[type="checkbox"]')).forEach((input) => {
      if (input instanceof HTMLInputElement) input.disabled = Boolean(disabled);
    });
  });
}

function openCreateBookingModal() {
  if (!state.permissions.canReadBookings || !els.bookingCreateModal) return;
  resetCreateBookingForm();
  els.bookingCreateModal.hidden = false;
  if (!els.bookingCreateModal.hasAttribute("tabindex")) {
    els.bookingCreateModal.setAttribute("tabindex", "-1");
  }
  window.setTimeout(() => {
    els.bookingCreateTitleInput?.focus?.();
  }, 0);
}

function closeCreateBookingModal({ returnFocus = true } = {}) {
  if (!els.bookingCreateModal || state.createBookingInFlight) return;
  els.bookingCreateModal.hidden = true;
  setCreateBookingStatus("");
  if (returnFocus) {
    els.bookingCreateOpenBtn?.focus?.();
  }
}

async function createBackendBooking() {
  if (!state.permissions.canReadBookings || state.createBookingInFlight) return;
  clearError();
  const name = normalizeText(els.bookingCreateTitleInput?.value);
  if (!name) {
    setCreateBookingStatus("Enter a booking title.");
    els.bookingCreateTitleInput?.focus?.();
    return;
  }

  state.createBookingInFlight = true;
  setCreateBookingControlsDisabled(true);
  setCreateBookingStatus("Creating booking...");

  try {
    const payload = await fetchApi("/api/v1/bookings", {
      method: "POST",
      body: {
        name,
        preferred_language: normalizeText(els.bookingCreateLanguageInput?.value) || "en",
        preferred_currency: normalizeCurrencyCode(els.bookingCreateCurrencyInput?.value || "USD"),
        destinations: selectedValues(els.bookingCreateDestinationsInput),
        travel_styles: selectedValues(els.bookingCreateTravelStylesInput),
        primary_contact_name: normalizeText(els.bookingCreatePrimaryContactNameInput?.value),
        primary_contact_email: normalizeText(els.bookingCreatePrimaryContactEmailInput?.value),
        primary_contact_phone_number: normalizeText(els.bookingCreatePrimaryContactPhoneInput?.value),
        number_of_travelers: normalizeText(els.bookingCreateTravelerCountInput?.value) || null,
        actor: state.authUser?.preferred_username || state.authUser?.sub || "backend_user"
      },
      connectionErrorMessage: backendT("booking.error.connect", "Could not connect to backend API.")
    });

    const bookingId = normalizeText(payload?.booking?.id);
    if (!bookingId) {
      setCreateBookingStatus("Could not create booking.");
      return;
    }

    closeCreateBookingModal({ returnFocus: false });
    window.location.href = buildBookingHref(bookingId);
  } finally {
    state.createBookingInFlight = false;
    setCreateBookingControlsDisabled(false);
  }
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
      pageName: "bookings.html",
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
  populateCreateBookingOptions();
  if (els.bookingCreateOpenBtn) {
    els.bookingCreateOpenBtn.addEventListener("click", openCreateBookingModal);
  }
  if (els.bookingCreateCloseBtn) {
    els.bookingCreateCloseBtn.addEventListener("click", () => closeCreateBookingModal());
  }
  if (els.bookingCreateCancelBtn) {
    els.bookingCreateCancelBtn.addEventListener("click", () => closeCreateBookingModal());
  }
  if (els.bookingCreateSubmitBtn) {
    els.bookingCreateSubmitBtn.addEventListener("click", createBackendBooking);
  }
  if (els.bookingCreateForm) {
    els.bookingCreateForm.addEventListener("submit", (event) => {
      event.preventDefault();
      createBackendBooking();
    });
  }
  if (els.bookingCreateModal) {
    els.bookingCreateModal.addEventListener("click", (event) => {
      if (event.target === els.bookingCreateModal) {
        closeCreateBookingModal();
      }
    });
  }
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.bookingCreateModal?.hidden) {
      closeCreateBookingModal();
    }
  });
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
