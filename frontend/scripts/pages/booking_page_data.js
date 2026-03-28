import {
  authMeRequest,
  bookingDetailRequest,
  keycloakUsersRequest,
  staffProfilesRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { validateAuthMeResponse } from "../../Generated/API/generated_APIModels.js";
import { logBrowserConsoleError, resolveApiUrl } from "../shared/api.js";
import { applyBackendUserLabel } from "../shared/backend_page.js";
import {
  bookingContentLang,
  setBookingContentLang
} from "../booking/i18n.js";

export function createBookingPageDataController(ctx) {
  const {
    state,
    els,
    apiBase,
    apiOrigin,
    roles,
    backendT,
    normalizeBookingContentLang,
    redirectToBackendLogin,
    fetchApi,
    showError,
    clearError,
    clearStatus,
    setStatus,
    resolveSubmissionCustomerLanguage,
    updateContentLangInUrl,
    syncContentLanguageSelector,
    withBookingContentLang,
    applyBookingPayload,
    renderBookingHeader,
    renderBookingData,
    renderActionControls,
    renderPersonsEditor,
    renderPricingPanel,
    renderTravelPlanPanel,
    renderOfferPanel,
    loadActivities,
    loadInvoices,
    ensureTourImageLoaded,
    bookingWhatsAppRef
  } = ctx;

  function hasAnyRole(...candidateRoles) {
    return candidateRoles.some((role) => state.roles.includes(role));
  }

  function mergeAssignableUsersWithStaffProfiles(assignableUsers, staffProfileEntries) {
    const profilesByUsername = new Map(
      (Array.isArray(staffProfileEntries) ? staffProfileEntries : [])
        .map((entry) => {
          const username = String(entry?.username || "").trim().toLowerCase();
          return username ? [username, entry?.staff_profile && typeof entry.staff_profile === "object" ? entry.staff_profile : null] : null;
        })
        .filter(Boolean)
    );
    return (Array.isArray(assignableUsers) ? assignableUsers : []).map((user) => {
      const username = String(user?.username || "").trim().toLowerCase();
      const staffProfile = username ? profilesByUsername.get(username) || null : null;
      return {
        ...user,
        staff_profile: staffProfile,
        full_name: String(staffProfile?.full_name || user?.full_name || "").trim() || null
      };
    });
  }

  function getConflictReloadInstruction() {
    const userAgent = String(window.navigator.userAgent || "");
    const platform = String(window.navigator.platform || "");
    const touchPoints = Number(window.navigator.maxTouchPoints || 0);
    const isIPhone = /iPhone/i.test(userAgent);
    const isIPad = /iPad/i.test(userAgent) || (/Mac/i.test(platform) && touchPoints > 1);
    const isIOS = isIPhone || isIPad;
    if (isIOS) {
      return backendT("booking.reload.ios", "Reload this page in Safari by tapping the reload button in the address bar.");
    }
    if (/Android/i.test(userAgent)) {
      return backendT("booking.reload.android", "Reload this page in your browser by tapping the reload button in the toolbar.");
    }
    if (/Mac/i.test(platform)) {
      return backendT("booking.reload.mac", "Reload this page with Command-R.");
    }
    if (/Win/i.test(platform)) {
      return backendT("booking.reload.windows", "Reload this page with Ctrl-R or F5.");
    }
    return backendT("booking.reload.default", "Reload this page in your browser.");
  }

  async function fetchBookingMutation(path, options = {}) {
    const method = options.method || "GET";
    const body = options.body;
    const requestUrl = resolveApiUrl(apiOrigin, withBookingContentLang(path));

    try {
      const response = await fetch(requestUrl, {
        method,
        credentials: "include",
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });

      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          redirectToBackendLogin();
          return null;
        }
        logBrowserConsoleError("[booking] Backend rejected a booking mutation request.", {
          booking_id: state.id,
          method,
          url: requestUrl,
          status: response.status,
          status_text: response.statusText,
          request_body: body,
          response_payload: payload
        });
        if (response.status === 409 && payload?.code === "BOOKING_REVISION_MISMATCH" && payload?.booking) {
          const instruction = getConflictReloadInstruction();
          showError(backendT(
            "booking.error.changed_detail",
            "This booking was changed on another device. Please reload before editing again. {instruction}",
            { instruction }
          ));
          setStatus(backendT("booking.error.changed", "This booking was changed in the backend. Reload required."));
          return null;
        }
        const requestFailed = backendT("booking.error.request_failed", "Request failed");
        const message = payload?.detail ? `${payload.error || requestFailed}: ${payload.detail}` : payload.error || requestFailed;
        showError(message);
        return null;
      }

      clearError();
      return payload;
    } catch (error) {
      showError(backendT("booking.error.connect", "Could not connect to backend API."));
      logBrowserConsoleError("[booking] Network error while sending a booking mutation request.", {
        booking_id: state.id,
        method,
        url: requestUrl,
        request_body: body
      }, error);
      return null;
    }
  }

  async function loadAuthStatus() {
    try {
      const request = authMeRequest({ baseURL: apiOrigin });
      const response = await fetch(request.url, {
        method: request.method,
        credentials: "include",
        headers: request.headers
      });
      const payload = await response.json().catch(() => null);
      if (payload) validateAuthMeResponse(payload);
      if (response.status === 401 || (response.ok && !payload?.authenticated)) {
        state.authUser = null;
        if (els.userLabel) els.userLabel.textContent = "";
        redirectToBackendLogin();
        return;
      }
      if (!response.ok) {
        state.authUser = null;
        if (els.userLabel) els.userLabel.textContent = "";
        return;
      }
      state.roles = Array.isArray(payload.user?.roles) ? payload.user.roles : [];
      state.authUser = payload.user || null;
      const user = applyBackendUserLabel({
        userLabel: els.userLabel,
        authUser: payload.user || null,
        logKey: "booking",
        pageName: "booking.html",
        authMeUrl: request.url,
        extraDetails: {
          booking_id: state.id || "",
          roles: state.roles
        }
      });
      state.user = user || "";
      state.permissions = {
        canChangeAssignment: hasAnyRole(roles.ADMIN, roles.MANAGER),
        canReadAssignmentDirectory: hasAnyRole(roles.ADMIN, roles.MANAGER, roles.ACCOUNTANT),
        canChangeStage: hasAnyRole(roles.ADMIN, roles.MANAGER, roles.STAFF),
        canEditBooking: hasAnyRole(roles.ADMIN, roles.MANAGER, roles.STAFF)
      };
    } catch (error) {
      state.user = "";
      state.authUser = null;
      if (els.userLabel) els.userLabel.textContent = "";
      logBrowserConsoleError("[booking] Failed to load authenticated user status for the booking page.", {
        url: authMeRequest({ baseURL: apiOrigin }).url,
        method: "GET"
      }, error);
    }
  }

  async function loadBookingPage() {
    clearStatus();
    const requestedContentLang = normalizeBookingContentLang(state.contentLang || bookingContentLang("en"));
    const requests = [
      fetchApi(withBookingContentLang(bookingDetailRequest({ baseURL: apiOrigin, params: { booking_id: state.id } }).url)),
      state.permissions.canReadAssignmentDirectory
        ? fetchApi(keycloakUsersRequest({ baseURL: apiOrigin }).url, { suppressNotFound: true })
        : Promise.resolve(null),
      state.permissions.canReadAssignmentDirectory
        ? fetchApi(staffProfilesRequest({ baseURL: apiOrigin }).url, { suppressNotFound: true })
        : Promise.resolve(null)
    ];
    const [bookingPayload, usersPayload, staffProfilesPayload] = await Promise.all(requests);
    if (!bookingPayload) return false;

    const incomingBooking = bookingPayload?.booking || null;
    if (!state.contentLangInitialized) {
      const submissionLang = resolveSubmissionCustomerLanguage(incomingBooking);
      state.contentLang = setBookingContentLang(submissionLang);
      state.contentLangInitialized = true;
      updateContentLangInUrl(state.contentLang);
      syncContentLanguageSelector?.();
      if (submissionLang !== requestedContentLang) {
        return await loadBookingPage();
      }
    }

    state.keycloakUsers = mergeAssignableUsersWithStaffProfiles(usersPayload?.items, staffProfilesPayload?.items);
    applyBookingPayload(bookingPayload, { forceDraftReset: true });
    syncContentLanguageSelector?.();
    await ensureTourImageLoaded();

    renderBookingHeader();
    renderBookingData();
    renderActionControls();
    renderPersonsEditor();
    renderPricingPanel();
    renderTravelPlanPanel();
    renderOfferPanel();
    await loadActivities();
    await bookingWhatsAppRef()?.load(state.booking);
    await loadInvoices();
    bookingWhatsAppRef()?.startAutoRefresh(() => state.booking);
    return true;
  }

  return {
    fetchBookingMutation,
    loadAuthStatus,
    loadBookingPage
  };
}
