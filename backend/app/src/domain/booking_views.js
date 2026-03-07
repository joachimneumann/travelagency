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
  computeSlaDueAt,
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
    const exactMatches = (store.customers || []).filter((customer) => isLikelyPhoneMatch(customer.phone_number, externalContactId));
    if (exactMatches.length === 1) return exactMatches[0];
    return null;
  }

  function resolveBookingForClient(store, clientId) {
    if (!clientId) return null;
    const activeStages = new Set([
      stages.NEW,
      stages.QUALIFIED,
      stages.PROPOSAL_SENT,
      stages.NEGOTIATION,
      stages.INVOICE_SENT,
      stages.PAYMENT_RECEIVED
    ]);

    const matches = store.bookings
      .filter((booking) => booking.client_id === clientId)
      .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
    if (!matches.length) return null;
    const active = matches.find((booking) => activeStages.has(booking.stage));
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
    const required = ["name", "email", "duration"];
    const missing = required.filter((key) => !normalizeText(payload[key]));
    if (!normalizeStringArray(payload.destination).length) missing.push("destination");
    if (!normalizeStringArray(payload.style).length) missing.push("style");
    if (missing.length) {
      return { ok: false, error: `Missing required fields: ${missing.join(", ")}` };
    }

    const email = normalizeEmail(payload.email);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) return { ok: false, error: "Invalid email" };

    const travelers = safeOptionalInt(payload.travelers);
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
    return normalizeText(booking?.atp_staff || booking?.owner_id);
  }

  function syncBookingAtpStaffFields(booking) {
    const staffId = normalizeText(booking.atp_staff || booking.owner_id);
    const staffName = normalizeText(booking.atp_staff_name || booking.owner_name);
    booking.atp_staff = staffId || null;
    booking.atp_staff_name = staffName || null;
    booking.owner_id = staffId || null;
    booking.owner_name = staffName || null;
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
    const preferredCurrency = safeCurrency(booking?.preferred_currency || booking?.pricing?.currency || baseCurrency);
    return {
      ...booking,
      pricing: await buildBookingPricingReadModel(booking.pricing, preferredCurrency),
      offer: await buildBookingOfferReadModel(booking.offer, preferredCurrency),
      booking_hash: computeBookingHash(booking)
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

  function filterAndSortBookings(store, query, deps = {}) {
    const { getCustomerLookup = () => new Map(), ensureMetaChatCollections = () => {} } = deps;
    const stage = normalizeStageFilter(query.get("stage"));
    const ownerId = normalizeText(query.get("owner_id"));
    const rawSearch = normalizeText(query.get("search")).toLowerCase();
    const rawSearchNoSpace = rawSearch.replace(/\s+/g, "");
    const search = rawSearch.replace(/[^a-z0-9]+/g, "");
    const searchDigits = rawSearch.replace(/[^0-9]+/g, "");
    const searchLetters = rawSearch.replace(/[^a-z]+/g, "");
    const sort = normalizeText(query.get("sort")) || "created_at_desc";
    const customersByClientId = getCustomerLookup(store);
    ensureMetaChatCollections(store);

    const conversationBookingIds = new Map();
    const conversationIdToConversation = new Map();
    const latestBookingByClient = new Map();
    const sortedByRecency = [...store.bookings].sort(
      (a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""))
    );
    for (const booking of sortedByRecency) {
      if (!latestBookingByClient.has(booking.client_id)) {
        latestBookingByClient.set(booking.client_id, booking.id);
      }
    }

    const getLatestBookingForPhoneMatch = (phone) => {
      if (!phone) return null;
      for (const booking of sortedByRecency) {
        const customer = customersByClientId.get(booking.client_id);
        const storedPhone = customer?.phone_number || "";
        if (!storedPhone) continue;
        if (isLikelyPhoneMatch(storedPhone, phone)) return booking.id;
      }
      return null;
    };

    for (const conversation of store.chat_conversations) {
      const conversationId = normalizeText(conversation.id);
      if (!conversationId) continue;

      const matchedBookingIds = new Set();
      const linkedBookingId = normalizeText(conversation.booking_id);
      if (linkedBookingId) matchedBookingIds.add(linkedBookingId);

      const linkedClientId = normalizeText(conversation.client_id);
      if (linkedClientId) {
        const latestBookingId = latestBookingByClient.get(linkedClientId);
        if (latestBookingId) matchedBookingIds.add(latestBookingId);
      }

      const channel = normalizeText(conversation.channel).toLowerCase();
      const externalContactId = normalizeText(conversation.external_contact_id);
      if (channel === "whatsapp" && externalContactId) {
        const latestBookingId = getLatestBookingForPhoneMatch(externalContactId);
        if (latestBookingId) matchedBookingIds.add(latestBookingId);
      }

      if (matchedBookingIds.size > 0) {
        conversationBookingIds.set(conversationId, [...matchedBookingIds]);
      }
      conversationIdToConversation.set(conversationId, conversation);
    }

    const getBookingIdsFromPhoneMatch = (phone) => {
      const matched = new Set();
      const latestBookingId = getLatestBookingForPhoneMatch(phone);
      if (latestBookingId) matched.add(latestBookingId);
      return matched;
    };

    const bookingChatTextMap = new Map();
    for (const event of store.chat_events) {
      const conversationId = normalizeText(event.conversation_id);
      const eventText = normalizeText(event.text_preview).toLowerCase();
      if (!eventText) continue;

      const matchedBookingIds = new Set(conversationBookingIds.get(conversationId) || []);
      if (!matchedBookingIds.size) {
        const senderContact = String(event.sender_contact || "").replace(/\D+/g, "");
        if (senderContact) {
          for (const id of getBookingIdsFromPhoneMatch(senderContact)) matchedBookingIds.add(id);
        }
      }

      if (!matchedBookingIds.size) {
        const conversation = conversationIdToConversation.get(conversationId);
        const conversationContact = conversation ? String(conversation.external_contact_id || "").replace(/\D+/g, "") : "";
        if (conversationContact) {
          for (const id of getBookingIdsFromPhoneMatch(conversationContact)) matchedBookingIds.add(id);
        }
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
      if (ownerId && booking.owner_id !== ownerId) return false;
      if (!search) return true;

      const customer = customersByClientId.get(booking.client_id);
      const hasDigits = /[0-9]/.test(search);
      const hasLetters = /[a-z]/.test(search);
      const haystack = [
        booking.id,
        ...normalizeStringArray(booking.destination),
        ...normalizeStringArray(booking.style),
        booking.owner_name,
        booking.notes,
        booking.client_display_name,
        customer?.email,
        bookingChatTextMap.get(booking.id),
        booking.sla_due_at,
        JSON.stringify(booking.pricing),
        JSON.stringify(booking.offer)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
      const normalizedHaystack = haystack.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const normalizedHaystackNoSpace = haystack.replace(/\s+/g, "").toLowerCase();
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
          return a.created_at.localeCompare(b.created_at);
        case "updated_at_desc":
          return b.updated_at.localeCompare(a.updated_at);
        case "sla_due_at_asc":
          return String(a.sla_due_at || "9999-12-31T23:59:59.999Z").localeCompare(
            String(b.sla_due_at || "9999-12-31T23:59:59.999Z")
          );
        case "sla_due_at_desc":
          return String(b.sla_due_at || "").localeCompare(String(a.sla_due_at || ""));
        case "created_at_desc":
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });

    return {
      items: sorted,
      filters: { stage: stage || null, owner_id: ownerId || null, search: search || null },
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
