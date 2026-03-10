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
  sendJson
}) {
  function normalizePersonEmails(person) {
    return Array.from(
      new Set(
        [...(Array.isArray(person?.emails) ? person.emails : [])]
          .map((value) => normalizeEmail(value))
          .filter(Boolean)
      )
    );
  }

  function normalizePersonPhoneNumbers(person) {
    return Array.from(
      new Set(
        [...(Array.isArray(person?.phone_numbers) ? person.phone_numbers : [])]
          .map((value) => normalizeText(value))
          .filter(Boolean)
      )
    );
  }

  function normalizePersonRoles(person) {
    return Array.from(new Set((Array.isArray(person?.roles) ? person.roles : []).map((value) => normalizeText(value)).filter(Boolean)));
  }

  function getBookingPersons(booking) {
    const persons = Array.isArray(booking?.persons) ? booking.persons : [];
    return persons
      .map((person, index) => {
        if (!person || typeof person !== "object" || Array.isArray(person)) return null;
        return {
          ...person,
          id: normalizeText(person.id) || `${normalizeText(booking?.id) || "booking"}_person_${index + 1}`,
          name: normalizeText(person.name) || `Traveler ${index + 1}`,
          emails: normalizePersonEmails(person),
          phone_numbers: normalizePersonPhoneNumbers(person),
          roles: normalizePersonRoles(person)
        };
      })
      .filter(Boolean);
  }

  function getSubmittedContact(booking) {
    const submission = booking?.web_form_submission || {};
    return {
      name: normalizeText(submission.name) || null,
      email: normalizeEmail(submission.email) || null,
      phone_number: normalizeText(submission.phone_number) || null
    };
  }

  function getBookingPrimaryContact(booking) {
    const persons = getBookingPersons(booking);
    return persons.find((person) => person.roles.includes("primary_contact")) || persons[0] || null;
  }

  function getBookingContactProfile(booking) {
    const primary = getBookingPrimaryContact(booking);
    const submitted = getSubmittedContact(booking);
    return {
      name: normalizeText(primary?.name) || submitted.name || null,
      email: primary?.emails?.[0] || submitted.email || null,
      phone_number: primary?.phone_numbers?.[0] || submitted.phone_number || null
    };
  }

  function bookingContactMatches(booking, externalContactId) {
    const normalizedContact = normalizeText(externalContactId);
    if (!normalizedContact) return false;
    const email = normalizeEmail(normalizedContact);
    const persons = getBookingPersons(booking);
    const submitted = getSubmittedContact(booking);
    const phones = [
      submitted.phone_number,
      ...persons.flatMap((person) => person.phone_numbers)
    ].filter(Boolean);
    const emails = [
      submitted.email,
      ...persons.flatMap((person) => person.emails)
    ].filter(Boolean);
    if (email && emails.includes(email)) return true;
    return phones.some((phone) => isLikelyPhoneMatch(phone, normalizedContact));
  }

  function activeBookingStages() {
    return new Set([
      stages.NEW,
      stages.QUALIFIED,
      stages.PROPOSAL_SENT,
      stages.NEGOTIATION,
      stages.INVOICE_SENT,
      stages.PAYMENT_RECEIVED
    ]);
  }

  function resolveBookingForExternalContact(store, externalContactId) {
    if (!externalContactId) return null;
    const matches = (Array.isArray(store?.bookings) ? store.bookings : [])
      .filter((booking) => bookingContactMatches(booking, externalContactId))
      .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
    if (!matches.length) return null;
    const active = matches.find((booking) => activeBookingStages().has(booking.stage));
    return active || matches[0];
  }

  function resolveBookingContactByExternalContact(store, externalContactId) {
    const booking = resolveBookingForExternalContact(store, externalContactId);
    if (!booking) return null;
    const primary = getBookingPrimaryContact(booking);
    const contact = getBookingContactProfile(booking);
    return {
      booking_id: booking.id,
      person_id: normalizeText(primary?.id) || null,
      name: contact.name || "",
      email: contact.email || null,
      phone_number: contact.phone_number || null
    };
  }

  function resolveBookingById(store, bookingId) {
    const normalizedBookingId = normalizeText(bookingId);
    if (!normalizedBookingId) return null;
    const matches = (Array.isArray(store?.bookings) ? store.bookings : [])
      .filter((booking) => normalizeText(booking.id) === normalizedBookingId)
      .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
    if (!matches.length) return null;
    const active = matches.find((booking) => activeBookingStages().has(booking.stage));
    return active || matches[0];
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
    if (travelers !== null && travelers !== undefined && (travelers < 1 || travelers > 30)) {
      return { ok: false, error: "Travelers must be between 1 and 30" };
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
    if (hasRole(principal, appRoles.ADMIN) || hasRole(principal, appRoles.MANAGER) || hasRole(principal, appRoles.ACCOUNTANT)) {
      return true;
    }
    if (hasRole(principal, appRoles.ATP_STAFF) && staffMember) {
      return getBookingAtpStaffId(booking) === staffMember.id;
    }
    return false;
  }

  function actorLabel(principal, fallback = "system") {
    return normalizeText(principal?.preferred_username || principal?.email || principal?.sub || fallback) || fallback;
  }

  function getBookingAtpStaffId(booking) {
    return normalizeText(booking?.atp_staff);
  }

  function syncBookingAtpStaffFields(booking) {
    const staffId = normalizeText(booking.atp_staff);
    const staffName = normalizeText(booking.atp_staff_name);
    booking.atp_staff = staffId || null;
    booking.atp_staff_name = staffName || null;
    return booking;
  }

  function canAccessBooking(principal, booking, staffMember) {
    if (canReadAllBookings(principal)) return true;
    if (hasRole(principal, appRoles.ATP_STAFF) && staffMember) {
      return getBookingAtpStaffId(booking) === staffMember.id;
    }
    return false;
  }

  function canEditBooking(principal, booking, staffMember) {
    return canChangeBookingStage(principal, booking, staffMember);
  }

  async function buildBookingReadModel(booking) {
    const normalizedBooking = { ...booking };
    delete normalizedBooking.budget;
    const preferredCurrency = safeCurrency(normalizedBooking?.preferred_currency || normalizedBooking?.pricing?.currency || baseCurrency);
    return {
      ...normalizedBooking,
      preferred_currency: preferredCurrency,
      pricing: await buildBookingPricingReadModel(normalizedBooking.pricing, preferredCurrency),
      offer: await buildBookingOfferReadModel(normalizedBooking.offer, preferredCurrency)
    };
  }

  function normalizeStageFilter(value) {
    const stage = normalizeText(value).toUpperCase();
    return stageOrder.includes(stage) ? stage : "";
  }

  function filterAndSortBookings(store, query, deps = {}) {
    const { ensureMetaChatCollections = () => {} } = deps;
    const stage = normalizeStageFilter(query.get("stage"));
    const atpStaffId = normalizeText(query.get("atp_staff"));
    const rawSearch = normalizeText(query.get("search")).toLowerCase();
    const rawSearchNoSpace = rawSearch.replace(/\s+/g, "");
    const search = rawSearch.replace(/[^a-z0-9]+/g, "");
    const searchDigits = rawSearch.replace(/[^0-9]+/g, "");
    const searchLetters = rawSearch.replace(/[^a-z]+/g, "");
    const sort = normalizeText(query.get("sort")) || "created_at_desc";
    ensureMetaChatCollections(store);

    const conversationBookingIds = new Map();
    const conversationIdToConversation = new Map();
    const latestBookingById = new Map();
    const sortedByRecency = [...store.bookings].sort(
      (a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""))
    );
    for (const booking of sortedByRecency) {
      const key = normalizeText(booking.id);
      if (key && !latestBookingById.has(key)) latestBookingById.set(key, booking.id);
    }

    const getLatestBookingForContactMatch = (contact) => {
      const matched = resolveBookingForExternalContact(store, contact);
      return matched?.id || null;
    };

    for (const conversation of store.chat_conversations) {
      const conversationId = normalizeText(conversation.id);
      if (!conversationId) continue;

      const matchedBookingIds = new Set();
      const linkedBookingId = normalizeText(conversation.booking_id);
      if (linkedBookingId) matchedBookingIds.add(linkedBookingId);

      const linkedBookingIdentity = normalizeText(conversation.booking_id);
      if (linkedBookingIdentity) {
        const latestBookingId = latestBookingById.get(linkedBookingIdentity);
        if (latestBookingId) matchedBookingIds.add(latestBookingId);
      }

      const externalContactId = normalizeText(conversation.external_contact_id);
      if (externalContactId) {
        const latestBookingId = getLatestBookingForContactMatch(externalContactId);
        if (latestBookingId) matchedBookingIds.add(latestBookingId);
      }

      if (matchedBookingIds.size > 0) {
        conversationBookingIds.set(conversationId, [...matchedBookingIds]);
      }
      conversationIdToConversation.set(conversationId, conversation);
    }

    const bookingChatTextMap = new Map();
    for (const event of store.chat_events) {
      const conversationId = normalizeText(event.conversation_id);
      const eventText = normalizeText(event.text_preview).toLowerCase();
      if (!eventText) continue;

      const matchedBookingIds = new Set(conversationBookingIds.get(conversationId) || []);
      if (!matchedBookingIds.size) {
        const senderContact = normalizeText(event.sender_contact);
        const matchedBookingId = getLatestBookingForContactMatch(senderContact);
        if (matchedBookingId) matchedBookingIds.add(matchedBookingId);
      }

      if (!matchedBookingIds.size) {
        const conversation = conversationIdToConversation.get(conversationId);
        const conversationContact = normalizeText(conversation?.external_contact_id);
        const matchedBookingId = getLatestBookingForContactMatch(conversationContact);
        if (matchedBookingId) matchedBookingIds.add(matchedBookingId);
      }
      if (!matchedBookingIds.size) continue;

      const normalizedMessage = eventText.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const messageVariants = [
        eventText,
        normalizedMessage,
        eventText.replace(/\s+/g, ""),
        normalizedMessage.replace(/[^0-9]+/g, ""),
        normalizedMessage.replace(/[^a-z]+/g, "")
      ];
      const nextText = messageVariants.some((variant) => String(variant || "").trim())
        ? [...new Set(messageVariants)].join(" ")
        : eventText;

      for (const bookingId of matchedBookingIds) {
        const existing = bookingChatTextMap.get(bookingId) || "";
        bookingChatTextMap.set(bookingId, existing ? `${existing} ${nextText}` : nextText);
      }
    }

    const filtered = store.bookings.filter((booking) => {
      if (stage && booking.stage !== stage) return false;
      if (atpStaffId && booking.atp_staff !== atpStaffId) return false;
      if (!search) return true;

      const contact = getBookingContactProfile(booking);
      const persons = getBookingPersons(booking);
      const haystack = [
        booking.id,
        ...normalizeStringArray(booking.destinations),
        ...normalizeStringArray(booking.travel_styles),
        booking.atp_staff_name,
        booking.notes,
        contact.name,
        contact.email,
        contact.phone_number,
        ...persons.flatMap((person) => [person.name, ...person.emails, ...person.phone_numbers]),
        bookingChatTextMap.get(booking.id),
        booking.service_level_agreement_due_at,
        JSON.stringify(booking.pricing),
        JSON.stringify(booking.offer)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
      const normalizedHaystack = haystack.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const normalizedHaystackNoSpace = haystack.replace(/\s+/g, "").toLowerCase();
      const hasDigits = /[0-9]/.test(search);
      const hasLetters = /[a-z]/.test(search);

      if (hasDigits && hasLetters) {
        const mixedSearch = `${searchDigits}${searchLetters}`;
        const mixedSearchAlt = `${searchLetters}${searchDigits}`;
        const mixedSearchNoSpace = rawSearchNoSpace.replace(/[^a-z0-9]+/g, "");
        return (
          normalizedHaystack.includes(mixedSearch) ||
          normalizedHaystackNoSpace.includes(mixedSearch) ||
          normalizedHaystack.includes(mixedSearchAlt) ||
          normalizedHaystackNoSpace.includes(mixedSearchAlt) ||
          normalizedHaystack.includes(mixedSearchNoSpace) ||
          normalizedHaystackNoSpace.includes(mixedSearchNoSpace)
        );
      }

      return (
        haystack.includes(rawSearch) ||
        normalizedHaystack.includes(search) ||
        normalizedHaystack.includes(rawSearchNoSpace) ||
        (searchDigits &&
          (normalizedHaystack.includes(searchDigits) || normalizedHaystackNoSpace.includes(searchDigits))) ||
        (searchLetters &&
          (normalizedHaystack.includes(searchLetters) || normalizedHaystackNoSpace.includes(searchLetters)))
      );
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case "created_at_asc":
          return String(a.created_at || "").localeCompare(String(b.created_at || ""));
        case "updated_at_desc":
          return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
        case "service_level_agreement_due_at_asc":
          return String(a.service_level_agreement_due_at || "9999-12-31T23:59:59.999Z").localeCompare(
            String(b.service_level_agreement_due_at || "9999-12-31T23:59:59.999Z")
          );
        case "service_level_agreement_due_at_desc":
          return String(b.service_level_agreement_due_at || "").localeCompare(String(a.service_level_agreement_due_at || ""));
        case "created_at_desc":
        default:
          return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      }
    });

    return {
      items: sorted,
      filters: { stage: stage || null, atp_staff: atpStaffId || null, search: search || null },
      sort
    };
  }

  function paginate(items, query) {
    const page = clamp(safeInt(query.get("page")) || 1, 1, 100000);
    const pageSize = clamp(safeInt(query.get("page_size")) || 25, 1, 100);
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    return {
      items: items.slice(offset, offset + pageSize),
      page,
      page_size: pageSize,
      total,
      total_pages: totalPages
    };
  }

  return {
    resolveBookingContactByExternalContact,
    resolveBookingById,
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
    filterAndSortBookings,
    paginate
  };
}
