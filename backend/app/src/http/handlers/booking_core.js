import {
  validateBookingCustomerLanguageUpdateRequest,
  validateBookingSourceUpdateRequest,
  validateTranslationEntriesRequest
} from "../../../Generated/API/generated_APIModels.js";
import {
  getBookingTravelPlanDestinations,
  setBookingTravelPlanDestinations
} from "../../lib/booking_persons.js";
import { enumValueSetFor } from "../../lib/generated_catalogs.js";
import { normalizeBookingPdfPersonalization } from "../../lib/booking_pdf_personalization.js";
import {
  normalizeBookingContentLang
} from "../../domain/booking_content_i18n.js";

const COUNTRY_CODE_SET = enumValueSetFor("CountryCode");

function normalizeCountryCodes(items, normalizeText) {
  return Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => normalizeText(item).toUpperCase())
        .filter((item) => item && COUNTRY_CODE_SET.has(item))
    )
  );
}

export function createBookingCoreHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    getPrincipal,
    canEditBooking,
    canChangeBookingAssignment,
    canAccessBooking,
    normalizeText,
    nowIso,
    addActivity,
    actorLabel,
    persistStore,
    listAssignableKeycloakUsers,
    keycloakDisplayName,
    normalizeStringArray,
    canonicalBookingTravelStyles,
    syncBookingAssignmentFields,
    assertExpectedRevision,
    buildBookingDetailResponse,
    buildBookingPayload,
    incrementBookingRevision,
    translateEntries
  } = deps;

  function translationEntriesToObject(entries) {
    return Object.fromEntries(
      (Array.isArray(entries) ? entries : [])
        .map((entry) => [normalizeText(entry?.key), normalizeText(entry?.value)])
        .filter(([key, value]) => Boolean(key && value))
    );
  }

  function translationEntriesFromObject(entries) {
    return Object.entries(entries || {})
      .map(([key, value]) => ({ key: normalizeText(key), value: normalizeText(value) }))
      .filter((entry) => Boolean(entry.key && entry.value));
  }

  async function handlePatchBookingName(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_core_revision", "core_revision", res))) return;

    const nextName = normalizeText(payload.name) || null;
    const currentName = normalizeText(booking.name) || null;
    if (nextName === currentName) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking, req)), unchanged: true });
      return;
    }

    booking.name = nextName;
    incrementBookingRevision(booking, "core_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "BOOKING_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      nextName ? `Booking name set to ${nextName}` : "Booking name cleared"
    );
    await persistStore(store);

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handlePatchBookingCustomerLanguage(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateBookingCustomerLanguageUpdateRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_core_revision", "core_revision", res))) return;

    const nextCustomerLanguage = normalizeBookingContentLang(payload.customer_language);
    const currentCustomerLanguage = normalizeBookingContentLang(
      booking?.customer_language
      || booking?.web_form_submission?.preferred_language
      || "en"
    );
    if (nextCustomerLanguage === currentCustomerLanguage && normalizeText(booking?.customer_language) === nextCustomerLanguage) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking, req)), unchanged: true });
      return;
    }

    booking.customer_language = nextCustomerLanguage;
    incrementBookingRevision(booking, "core_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "BOOKING_UPDATED",
      actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      `Customer language set to ${nextCustomerLanguage}`
    );
    await persistStore(store);

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handlePatchBookingSource(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateBookingSourceUpdateRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_core_revision", "core_revision", res))) return;

    const nextSourceChannel = normalizeText(payload?.source_channel).toLowerCase();
    const nextReferralKind = normalizeText(payload?.referral_kind).toLowerCase();
    let nextReferralLabel = normalizeText(payload?.referral_label) || null;
    let nextReferralStaffUserId = normalizeText(payload?.referral_staff_user_id) || null;

    if (nextReferralKind === "none") {
      nextReferralLabel = null;
      nextReferralStaffUserId = null;
    } else if (nextReferralKind === "b2b_partner") {
      if (!nextReferralLabel) {
        sendJson(res, 422, { error: "referral_label is required when referral_kind is b2b_partner" });
        return;
      }
      nextReferralStaffUserId = null;
    } else if (nextReferralKind === "other_customer") {
      nextReferralStaffUserId = null;
    } else if (nextReferralKind === "atp_staff") {
      if (!nextReferralStaffUserId) {
        sendJson(res, 422, { error: "referral_staff_user_id is required when referral_kind is atp_staff" });
        return;
      }
      const assignableUsers = await listAssignableKeycloakUsers().catch(() => []);
      const referredStaff = assignableUsers.find((user) => user.id === nextReferralStaffUserId && user.active !== false);
      if (!referredStaff) {
        sendJson(res, 422, { error: "Referral ATP staff user not found or inactive" });
        return;
      }
      nextReferralLabel = null;
    }

    const currentSourceChannel = normalizeText(booking?.source_channel).toLowerCase() || null;
    const currentReferralKind = normalizeText(booking?.referral_kind).toLowerCase() || null;
    const currentReferralLabel = normalizeText(booking?.referral_label) || null;
    const currentReferralStaffUserId = normalizeText(booking?.referral_staff_user_id) || null;
    const nextDestinations = payload?.destinations !== undefined
      ? normalizeCountryCodes(payload.destinations, normalizeText)
      : getBookingTravelPlanDestinations(booking);
    const currentDestinations = getBookingTravelPlanDestinations(booking);
    const nextTravelStyles = payload?.travel_styles !== undefined
      ? canonicalBookingTravelStyles(normalizeStringArray(payload.travel_styles))
      : canonicalBookingTravelStyles(normalizeStringArray(booking?.travel_styles));
    const currentTravelStyles = canonicalBookingTravelStyles(normalizeStringArray(booking?.travel_styles));
    const preferredCustomerLang = normalizeBookingContentLang(
      booking?.customer_language
      || booking?.web_form_submission?.preferred_language
      || "en"
    );
    const nextPdfPersonalization = payload?.pdf_personalization !== undefined
      ? normalizeBookingPdfPersonalization(payload.pdf_personalization, {
          flatLang: preferredCustomerLang,
          sourceLang: preferredCustomerLang
        })
      : normalizeBookingPdfPersonalization(booking?.pdf_personalization, {
          flatLang: preferredCustomerLang,
          sourceLang: preferredCustomerLang
        });
    const currentPdfPersonalization = normalizeBookingPdfPersonalization(booking?.pdf_personalization, {
      flatLang: preferredCustomerLang,
      sourceLang: preferredCustomerLang
    });

    if (
      nextSourceChannel === currentSourceChannel
      && nextReferralKind === currentReferralKind
      && nextReferralLabel === currentReferralLabel
      && nextReferralStaffUserId === currentReferralStaffUserId
      && JSON.stringify(nextDestinations) === JSON.stringify(currentDestinations)
      && JSON.stringify(nextTravelStyles) === JSON.stringify(currentTravelStyles)
      && JSON.stringify(nextPdfPersonalization) === JSON.stringify(currentPdfPersonalization)
    ) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking, req)), unchanged: true });
      return;
    }

    booking.source_channel = nextSourceChannel || null;
    booking.referral_kind = nextReferralKind || null;
    booking.referral_label = nextReferralLabel;
    booking.referral_staff_user_id = nextReferralStaffUserId;
    setBookingTravelPlanDestinations(booking, nextDestinations);
    booking.travel_styles = nextTravelStyles;
    booking.pdf_personalization = nextPdfPersonalization;
    incrementBookingRevision(booking, "core_revision");
    booking.updated_at = nowIso();

    const activityDetail = nextReferralKind === "atp_staff"
      ? `Booking source set to ${nextSourceChannel}; referral set to ATP staff ${nextReferralStaffUserId}`
      : nextReferralKind === "b2b_partner"
        ? `Booking source set to ${nextSourceChannel}; referral set to B2B partner ${nextReferralLabel}`
        : nextReferralKind === "other_customer"
          ? `Booking source set to ${nextSourceChannel}; referral set to other customer${nextReferralLabel ? ` ${nextReferralLabel}` : ""}`
          : `Booking source set to ${nextSourceChannel}; referral cleared`;
    addActivity(
      store,
      booking.id,
      "BOOKING_UPDATED",
      actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      activityDetail
    );
    await persistStore(store);

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handlePatchBookingOwner(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const assignedKeycloakUserId = normalizeText(payload.assigned_keycloak_user_id);
    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canChangeBookingAssignment(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_core_revision", "core_revision", res))) return;

    if (!assignedKeycloakUserId) {
      booking.assigned_keycloak_user_id = null;
      syncBookingAssignmentFields(booking);
      incrementBookingRevision(booking, "core_revision");
      booking.updated_at = nowIso();
      addActivity(store, booking.id, "ASSIGNMENT_CHANGED", actorLabel(principal, "keycloak_user"), "Keycloak user unassigned");
      await persistStore(store);
      sendJson(res, 200, await buildBookingDetailResponse(booking, req));
      return;
    }

    const assignableUsers = await listAssignableKeycloakUsers().catch(() => []);
    const assignedUser = assignableUsers.find((user) => user.id === assignedKeycloakUserId && user.active !== false);
    if (!assignedUser) {
      sendJson(res, 422, { error: "Keycloak user not found or inactive" });
      return;
    }

    booking.assigned_keycloak_user_id = assignedUser.id;
    syncBookingAssignmentFields(booking);
    incrementBookingRevision(booking, "core_revision");
    booking.updated_at = nowIso();
    addActivity(store, booking.id, "ASSIGNMENT_CHANGED", actorLabel(principal, "keycloak_user"), `Keycloak user set to ${keycloakDisplayName(assignedUser)}`);
    await persistStore(store);

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handlePatchBookingNotes(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_notes_revision", "notes_revision", res))) return;

    const nextNotes = normalizeText(payload.notes);
    const currentNotes = normalizeText(booking.notes);
    if (nextNotes === currentNotes) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking, req)), unchanged: true });
      return;
    }

    booking.notes = nextNotes;
    incrementBookingRevision(booking, "notes_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "NOTE_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      nextNotes ? "Booking note updated" : "Booking note cleared"
    );
    await persistStore(store);

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handleListActivities(req, res, [bookingId]) {
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    const principal = getPrincipal(req);
    if (!canAccessBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const items = store.activities
      .filter((activity) => activity.booking_id === bookingId)
      .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));

    sendJson(res, 200, { activities: items, items, total: items.length });
  }

  async function handleCreateActivity(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const type = normalizeText(payload.type).toUpperCase();
    const principal = getPrincipal(req);
    const detail = normalizeText(payload.detail);
    if (!type) {
      sendJson(res, 422, { error: "type is required" });
      return;
    }

    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_core_revision", "core_revision", res))) return;

    const activity = addActivity(store, booking.id, type, actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"), detail);
    incrementBookingRevision(booking, "core_revision");
    booking.updated_at = nowIso();
    await persistStore(store);

    sendJson(res, 201, { activity, booking: await buildBookingPayload(booking, req) });
  }

  async function handleTranslateBookingFields(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTranslationEntriesRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const sourceLang = normalizeBookingContentLang(payload.source_lang);
    const targetLang = normalizeBookingContentLang(payload.target_lang);
    const entries = translationEntriesToObject(payload.entries);
    if (!Object.keys(entries).length) {
      sendJson(res, 422, { error: "At least one source field is required." });
      return;
    }

    if (sourceLang === targetLang) {
      sendJson(res, 200, {
        source_lang: sourceLang,
        target_lang: targetLang,
        entries: translationEntriesFromObject(entries)
      });
      return;
    }

    try {
      const translatedEntries = await translateEntries(entries, targetLang, {
        sourceLangCode: sourceLang,
        domain: "travel planning",
        allowGoogleFallback: true
      });
      sendJson(res, 200, {
        source_lang: sourceLang,
        target_lang: targetLang,
        entries: translationEntriesFromObject(translatedEntries)
      });
    } catch (error) {
      if (error?.code === "TRANSLATION_NOT_CONFIGURED") {
        sendJson(res, 503, { error: String(error.message || "Translation provider is not configured.") });
        return;
      }
      if (error?.code === "TRANSLATION_INVALID_RESPONSE" || error?.code === "TRANSLATION_REQUEST_FAILED") {
        sendJson(res, 502, { error: String(error.message || "Translation request failed.") });
        return;
      }
      sendJson(res, 500, { error: String(error?.message || error || "Translation failed.") });
    }
  }

  return {
    handlePatchBookingName,
    handlePatchBookingCustomerLanguage,
    handlePatchBookingSource,
    handlePatchBookingOwner,
    handlePatchBookingNotes,
    handleListActivities,
    handleCreateActivity,
    handleTranslateBookingFields
  };
}
