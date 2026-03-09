import { normalizeText } from "../../../../shared/js/text.js";

export function createBookingViewHelpers({
  baseCurrency,
  stages,
  stageOrder,
  appRoles,
  normalizeStringArray,
  normalizeEmail,
  isLikelyPhoneMatch,
  nowIso,
  safeCurrency,
  safeOptionalInt,
  computeServiceLevelAgreementDueAt,
  randomUUID,
  clamp,
  safeInt,
  buildBookingPricingReadModel,
  buildBookingOfferReadModel,
  computeBookingHash,
  sendJson
}) {
  function resolveCustomerByExternalContact(store, externalContactId) {
    if (!externalContactId) return null;
    return (store.bookings || []).find((booking) => {
      const persons = Array.isArray(booking.persons) ? booking.persons : [];
      return persons.some((person) => Array.isArray(person.phone_numbers) && person.phone_numbers.some((phone) => isLikelyPhoneMatch(phone, externalContactId)));
    }) || null;
  }

  function resolveBookingForClient(store, clientId) {
    if (!clientId) return null;
    return (store.bookings || []).find((booking) => booking.id === clientId) || null;
  }

  function getMetaConversationOpenUrl(channel, externalContactId) {
    if (channel === "whatsapp") {
      const digits = String(externalContactId || "").replace(/\D+/g, "");
      return digits ? `https://wa.me/${digits}` : null;
    }
    return null;
  }

  function validateBookingInput(payload) {
    const required = ["name", "preferred_currency", "preferred_language"];
    const missing = required.filter((key) => !normalizeText(payload[key]));
    if (!normalizeStringArray(payload.destinations).length) missing.push("destinations");
    if (!normalizeStringArray(payload.travel_style).length) missing.push("travel_style");
    if (missing.length) {
      return { ok: false, error: `Missing required fields: ${missing.join(", ")}` };
    }

    const email = normalizeEmail(payload.email);
    const phone = normalizeText(payload.phone_number);
    const emailOk = email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) : false;
    if (!emailOk && !phone) return { ok: false, error: "Either email or phone_number must be present" };
    if (email && !emailOk) return { ok: false, error: "Invalid email" };

    const travelers = safeOptionalInt(payload.number_of_travelers);
    if (travelers !== null && travelers !== undefined && (travelers < 0 || travelers > 30)) {
      return { ok: false, error: "Travelers must be between 0 and 30" };
    }

    return { ok: true };
  }

  function addActivity(store, bookingId, type, actor, detail) {
    const activity = {
      id: `act_${randomUUID()}`,
      booking_id: bookingId,
      type,
      actor: actor || "system",
      detail: detail || "",
      created_at: nowIso()
    };
    store.activities.push(activity);
    return activity;
  }

  function hasRole(principal, role) {
    return Array.isArray(principal?.roles) ? principal.roles.includes(role) : false;
  }

  function canReadAllBookings(principal) {
    return hasRole(principal, appRoles.ADMIN) || hasRole(principal, appRoles.MANAGER) || hasRole(principal, appRoles.ACCOUNTANT);
  }

  function canChangeBookingAssignment(principal) {
    return canReadAllBookings(principal);
  }

  function canChangeBookingStage(principal, booking, staffMember) {
    if (hasRole(principal, appRoles.ADMIN) || hasRole(principal, appRoles.MANAGER) || hasRole(principal, appRoles.ACCOUNTANT)) return true;
    if (hasRole(principal, appRoles.ATP_STAFF) && staffMember) return normalizeText(booking?.atp_staff) === staffMember.id;
    return false;
  }

  function actorLabel(principal, fallback = "system") {
    return normalizeText(principal?.preferred_username || principal?.email || principal?.sub || fallback) || fallback;
  }

  function syncBookingAtpStaffFields(booking) {
    booking.atp_staff = normalizeText(booking.atp_staff) || null;
    booking.atp_staff_name = normalizeText(booking.atp_staff_name) || null;
    return booking;
  }

  function canAccessBooking(principal, booking, staffMember) {
    if (canReadAllBookings(principal)) return true;
    if (hasRole(principal, appRoles.ATP_STAFF) && staffMember) return normalizeText(booking?.atp_staff) === staffMember.id;
    return false;
  }

  function canEditBooking(principal, booking, staffMember) {
    return canChangeBookingStage(principal, booking, staffMember);
  }

  function bookingPrimaryPerson(booking) {
    const persons = Array.isArray(booking?.persons) ? booking.persons : [];
    return persons.find((person) => person?.is_lead_contact) || persons[0] || null;
  }

  async function buildBookingReadModel(booking) {
    const normalizedBooking = { ...booking };
    const preferredCurrency = safeCurrency(normalizedBooking?.preferred_currency || normalizedBooking?.pricing?.currency || baseCurrency);
    const bookingHash = computeBookingHash(normalizedBooking);
    delete normalizedBooking.preferred_currency;
    return {
      ...normalizedBooking,
      preferredCurrency,
      pricing: await buildBookingPricingReadModel(normalizedBooking.pricing, preferredCurrency),
      offer: await buildBookingOfferReadModel(normalizedBooking.offer, preferredCurrency),
      booking_hash: bookingHash
    };
  }

  async function sendBookingHashConflict(res, booking) {
    sendJson(res, 409, {
      error: "Booking changed in backend",
      detail: "The booking has changed in the backend. The data has been refreshed. Your changes are lost. Please do them again.",
      code: "BOOKING_HASH_MISMATCH",
      booking: await buildBookingReadModel(booking)
    });
  }

  async function assertMatchingBookingHash(payload, booking, res) {
    const requestHash = normalizeText(payload.booking_hash);
    const currentHash = computeBookingHash(booking);
    if (!requestHash || requestHash !== currentHash) {
      await sendBookingHashConflict(res, booking);
      return false;
    }
    return true;
  }

  function normalizeStageFilter(value) {
    const stage = normalizeText(value).toUpperCase();
    return stageOrder.includes(stage) ? stage : "";
  }

  function filterAndSortBookings(store, query) {
    const stage = normalizeStageFilter(query.get("stage"));
    const atpStaffId = normalizeText(query.get("atp_staff"));
    const rawSearch = normalizeText(query.get("search")).toLowerCase();
    const rawSearchNoSpace = rawSearch.replace(/\s+/g, "");
    const search = rawSearch.replace(/[^a-z0-9]+/g, "");
    const searchDigits = rawSearch.replace(/[^0-9]+/g, "");
    const searchLetters = rawSearch.replace(/[^a-z]+/g, "");
    const sort = normalizeText(query.get("sort")) || "created_at_desc";

    const filtered = (store.bookings || []).filter((booking) => {
      if (stage && booking.stage !== stage) return false;
      if (atpStaffId && booking.atp_staff !== atpStaffId) return false;
      if (!search) return true;

      const primaryPerson = bookingPrimaryPerson(booking);
      const persons = Array.isArray(booking.persons) ? booking.persons : [];
      const haystack = [
        booking.id,
        ...normalizeStringArray(booking.destinations),
        ...normalizeStringArray(booking.travel_styles),
        booking.atp_staff_name,
        booking.notes,
        primaryPerson?.name,
        ...(primaryPerson?.emails || []),
        ...(primaryPerson?.phone_numbers || []),
        ...persons.flatMap((person) => [person?.name, ...(person?.emails || []), ...(person?.phone_numbers || [])]),
        booking.web_form_submission?.name,
        booking.web_form_submission?.email,
        booking.web_form_submission?.phone_number,
        booking.service_level_agreement_due_at,
        JSON.stringify(booking.pricing),
        JSON.stringify(booking.offer)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const normalizedHaystack = haystack.replace(/[^a-z0-9]+/g, "");
      const normalizedHaystackNoSpace = haystack.replace(/\s+/g, "").toLowerCase();
      const hasDigits = /[0-9]/.test(search);
      const hasLetters = /[a-z]/.test(search);
      if (hasDigits && hasLetters) {
        const mixedSearch = `${searchDigits}${searchLetters}`;
        const mixedSearchAlt = `${searchLetters}${searchDigits}`;
        const mixedSearchNoSpace = rawSearchNoSpace.replace(/[^a-z0-9]+/g, "");
        return normalizedHaystack.includes(mixedSearch) || normalizedHaystackNoSpace.includes(mixedSearch) || normalizedHaystack.includes(mixedSearchAlt) || normalizedHaystackNoSpace.includes(mixedSearchAlt) || normalizedHaystack.includes(mixedSearchNoSpace) || normalizedHaystackNoSpace.includes(mixedSearchNoSpace);
      }
      return haystack.includes(rawSearch) || normalizedHaystack.includes(search) || normalizedHaystack.includes(rawSearchNoSpace) || (searchDigits && (normalizedHaystack.includes(searchDigits) || normalizedHaystackNoSpace.includes(searchDigits))) || (searchLetters && (normalizedHaystack.includes(searchLetters) || normalizedHaystackNoSpace.includes(searchLetters)));
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case "created_at_asc": return a.created_at.localeCompare(b.created_at);
        case "updated_at_desc": return String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at));
        case "service_level_agreement_due_at_asc": return String(a.service_level_agreement_due_at || "9999-12-31T23:59:59.999Z").localeCompare(String(b.service_level_agreement_due_at || "9999-12-31T23:59:59.999Z"));
        case "service_level_agreement_due_at_desc": return String(b.service_level_agreement_due_at || "").localeCompare(String(a.service_level_agreement_due_at || ""));
        case "created_at_desc":
        default:
          return String(b.created_at).localeCompare(String(a.created_at));
      }
    });

    return { items: sorted, filters: { stage: stage || null, atp_staff: atpStaffId || null, search: search || null }, sort };
  }

  function paginate(items, query) {
    const page = clamp(safeInt(query.get("page")) || 1, 1, 100000);
    const pageSize = clamp(safeInt(query.get("page_size")) || 25, 1, 100);
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;
    return { items: items.slice(offset, offset + pageSize), page, page_size: pageSize, total, total_pages: totalPages };
  }

  return {
    resolveCustomerByExternalContact,
    resolveBookingForClient,
    getMetaConversationOpenUrl,
    validateBookingInput,
    addActivity,
    canReadAllBookings,
    canChangeBookingAssignment,
    canChangeBookingStage,
    actorLabel,
    syncBookingAtpStaffFields,
    canAccessBooking,
    canEditBooking,
    buildBookingReadModel,
    assertMatchingBookingHash,
    filterAndSortBookings,
    paginate
  };
}
