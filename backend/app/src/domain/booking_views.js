import { normalizeText } from "../lib/text.js";
import { getBookingPersons, getBookingPrimaryContact } from "../lib/booking_persons.js";
import { normalizeBookingContentLang } from "./booking_content_i18n.js";
import { resolveBookingMilestoneState } from "./booking_milestones.js";
import { isSuspiciousSentinelString } from "./booking_names.js";
import {
  buildOfferTranslationStatus,
  buildTravelPlanTranslationStatus
} from "./booking_translation.js";
import { buildGeneratedOfferTransportFields } from "./booking_confirmation.js";

export function createBookingViewHelpers({
  baseCurrency,
  stages,
  stageOrder,
  appRoles,
  gmailDraftsConfig,
  bookingConfirmationTokenConfig,
  translationEnabled,
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
  buildBookingTravelPlanReadModel,
  buildBookingPricingReadModel,
  buildBookingOfferReadModel,
  listAssignableKeycloakUsers,
  keycloakDisplayName,
  resolveAssignedAtpStaffProfile,
  listBookingTravelPlanPdfs,
  sendJson
}) {
  const bookingConfirmationTokenSecret = normalizeText(bookingConfirmationTokenConfig?.secret);
  let assignableKeycloakUserLabelsPromise = null;

  function resolveAssignableKeycloakUserLabelMap() {
    if (!listAssignableKeycloakUsers || typeof keycloakDisplayName !== "function") {
      return Promise.resolve(new Map());
    }
    if (!assignableKeycloakUserLabelsPromise) {
      assignableKeycloakUserLabelsPromise = Promise.resolve()
        .then(() => listAssignableKeycloakUsers())
        .then((items) => new Map(
          (Array.isArray(items) ? items : [])
            .map((user) => [normalizeText(user?.id), normalizeText(keycloakDisplayName(user))])
            .filter(([id, label]) => Boolean(id && label))
        ))
        .catch(() => new Map());
    }
    return assignableKeycloakUserLabelsPromise;
  }
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

  function getSubmittedContact(booking) {
    const submission = booking?.web_form_submission || {};
    return {
      name: normalizeText(submission.name) || null,
      email: normalizeEmail(submission.email) || null,
      phone_number: normalizeText(submission.phone_number) || null
    };
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
    if (missing.length) {
      return { ok: false, error: `Missing required fields: ${missing.join(", ")}` };
    }

    const email = normalizeEmail(payload.email);
    const phone = normalizeText(payload.phone_number);
    const submittedName = normalizeText(payload.name);
    if (submittedName && isSuspiciousSentinelString(submittedName, normalizeText)) {
      return { ok: false, error: "Invalid name" };
    }
    if (phone && isSuspiciousSentinelString(phone, normalizeText)) {
      return { ok: false, error: "Invalid phone_number" };
    }
    const emailOk = email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) : false;
    if (!emailOk && !phone) return { ok: false, error: "Either email or phone_number must be present" };
    if (email && !emailOk) return { ok: false, error: "Invalid email" };

    const bookingName = normalizeText(payload.booking_name);
    if (
      bookingName &&
      isSuspiciousSentinelString(bookingName, normalizeText) &&
      !normalizeText(payload.tour_id)
    ) {
      return { ok: false, error: "Invalid booking_name" };
    }

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
    return hasRole(principal, appRoles.ADMIN) || hasRole(principal, appRoles.MANAGER);
  }

  function canChangeBookingStage(principal, booking) {
    if (hasRole(principal, appRoles.ADMIN) || hasRole(principal, appRoles.MANAGER)) {
      return true;
    }
    if (hasRole(principal, appRoles.ATP_STAFF)) {
      return getBookingAssignedKeycloakUserId(booking) === normalizeText(principal?.sub);
    }
    return false;
  }

  function actorLabel(principal, fallback = "system") {
    return normalizeText(principal?.preferred_username || principal?.email || principal?.sub || fallback) || fallback;
  }

  function getBookingAssignedKeycloakUserId(booking) {
    return normalizeText(booking?.assigned_keycloak_user_id);
  }

  function syncBookingAssignmentFields(booking) {
    const assignedUserId = normalizeText(booking.assigned_keycloak_user_id);
    booking.assigned_keycloak_user_id = assignedUserId || null;
    return booking;
  }

  function canAccessBooking(principal, booking) {
    if (canReadAllBookings(principal)) return true;
    if (hasRole(principal, appRoles.ATP_STAFF)) {
      return getBookingAssignedKeycloakUserId(booking) === normalizeText(principal?.sub);
    }
    return false;
  }

  function canEditBooking(principal, booking) {
    return canChangeBookingStage(principal, booking);
  }

  function isGeneratedOfferEmailEnabled() {
    return Boolean(
      normalizeText(gmailDraftsConfig?.serviceAccountJsonPath)
      && normalizeText(gmailDraftsConfig?.impersonatedEmail)
    );
  }

  function publicGeneratedOfferFields(generatedOffer, options = {}) {
    return buildGeneratedOfferTransportFields(generatedOffer, {
      secret: bookingConfirmationTokenSecret,
      includeBookingConfirmationToken: Boolean(options?.includeBookingConfirmationToken)
    });
  }

  async function buildGeneratedOfferSnapshotReadModel(generatedOffer, defaultCurrency, options = {}) {
    const generatedOfferCurrency = safeCurrency(
      generatedOffer?.currency || generatedOffer?.offer?.currency || defaultCurrency
    );
    const generatedLang = normalizeBookingContentLang(generatedOffer?.lang || options?.lang || "en");
    const {
      payment_terms: _rawPaymentTerms,
      ...generatedOfferTransportFields
    } = publicGeneratedOfferFields(generatedOffer, options);
    const generatedOfferReadModel = await buildBookingOfferReadModel(
      generatedOffer?.offer,
      generatedOfferCurrency,
      { lang: generatedLang }
    );
    return {
      ...generatedOfferTransportFields,
      currency: generatedOfferReadModel.currency || generatedOfferCurrency,
      total_price_cents: safeInt(generatedOffer?.total_price_cents) || safeInt(generatedOfferReadModel?.total_price_cents) || 0,
      ...(generatedOfferReadModel?.payment_terms ? { payment_terms: generatedOfferReadModel.payment_terms } : {}),
      offer: generatedOfferReadModel,
      travel_plan: buildBookingTravelPlanReadModel(generatedOffer?.travel_plan, generatedOfferReadModel, { lang: generatedLang })
    };
  }

  async function buildBookingReadModel(booking, options = {}) {
    const {
      idempotency_key: _idempotencyKey,
      web_form_travel_month: _webFormTravelMonth,
      traveler_details_token_nonce: _travelerDetailsTokenNonce,
      traveler_details_token_created_at: _travelerDetailsTokenCreatedAt,
      traveler_details_token_expires_at: _travelerDetailsTokenExpiresAt,
      traveler_details_token_revoked_at: _travelerDetailsTokenRevokedAt,
      public_traveler_details_token_nonce: _legacyTravelerDetailsTokenNonce,
      public_traveler_details_token_created_at: _legacyTravelerDetailsTokenCreatedAt,
      public_traveler_details_token_expires_at: _legacyTravelerDetailsTokenExpiresAt,
      public_traveler_details_token_revoked_at: _legacyTravelerDetailsTokenRevokedAt,
      ...normalizedBooking
    } = { ...booking };
    delete normalizedBooking.budget;
    const lang = normalizeBookingContentLang(options?.lang || "en");
    const preferredCurrency = safeCurrency(normalizedBooking?.preferred_currency || normalizedBooking?.pricing?.currency || baseCurrency);
    const offerCurrency = safeCurrency(normalizedBooking?.offer?.currency || preferredCurrency);
    const milestoneState = resolveBookingMilestoneState({
      milestones: normalizedBooking?.milestones,
      last_action: normalizedBooking?.last_action,
      last_action_at: normalizedBooking?.last_action_at,
      lifecycle: normalizedBooking?.lifecycle
    }, normalizedBooking?.stage);
    const generatedOffers = await Promise.all(
      (Array.isArray(normalizedBooking?.generated_offers) ? normalizedBooking.generated_offers : []).map(async (generatedOffer) => ({
        ...(await buildGeneratedOfferSnapshotReadModel(generatedOffer, offerCurrency, {
          lang,
          includeBookingConfirmationToken: Boolean(options?.includeBookingConfirmationToken)
        })),
        pdf_url: `/api/v1/bookings/${encodeURIComponent(normalizedBooking.id)}/generated-offers/${encodeURIComponent(generatedOffer.id)}/pdf`
      }))
    );
    const assignedKeycloakUserId = normalizeText(normalizedBooking?.assigned_keycloak_user_id);
    const assignedKeycloakUserLabels = assignedKeycloakUserId
      ? await resolveAssignableKeycloakUserLabelMap()
      : null;
    const assignedAtpStaff = assignedKeycloakUserId && typeof resolveAssignedAtpStaffProfile === "function"
      ? await resolveAssignedAtpStaffProfile(assignedKeycloakUserId).catch(() => null)
      : null;
    const travelPlanPdfs = typeof listBookingTravelPlanPdfs === "function"
      ? await listBookingTravelPlanPdfs(normalizedBooking.id).catch(() => [])
      : [];
    const assignedKeycloakUserLabel = assignedKeycloakUserId
      ? normalizeText(assignedKeycloakUserLabels?.get(assignedKeycloakUserId)) || normalizeText(assignedAtpStaff?.name) || assignedKeycloakUserId
      : "";
    return {
      ...normalizedBooking,
      stage: milestoneState.stage,
      milestones: milestoneState.milestones,
      last_action: milestoneState.lastAction,
      last_action_at: milestoneState.lastActionAt,
      ...(assignedKeycloakUserLabel ? { assigned_keycloak_user_label: assignedKeycloakUserLabel } : {}),
      ...(assignedAtpStaff ? { assigned_atp_staff: assignedAtpStaff } : {}),
      service_level_agreement_due_at: milestoneState.lastAction
        ? computeServiceLevelAgreementDueAt(milestoneState.stage, new Date(milestoneState.lastActionAt))
        : normalizedBooking?.service_level_agreement_due_at,
      customer_language: normalizeBookingContentLang(
        normalizedBooking?.customer_language
        || normalizedBooking?.web_form_submission?.preferred_language
        || "en"
      ),
      preferred_currency: preferredCurrency,
      travel_plan: buildBookingTravelPlanReadModel(normalizedBooking.travel_plan, normalizedBooking.offer, { lang }),
      travel_plan_translation_status: buildTravelPlanTranslationStatus(normalizedBooking.travel_plan, lang),
      pricing: await buildBookingPricingReadModel(normalizedBooking.pricing, preferredCurrency),
      offer: await buildBookingOfferReadModel(normalizedBooking.offer, offerCurrency, { lang }),
      travel_plan_pdfs: travelPlanPdfs.map((item) => ({
        ...item,
        sent_to_customer: item?.sent_to_customer === true,
        pdf_url: `/api/v1/bookings/${encodeURIComponent(normalizedBooking.id)}/travel-plan/pdfs/${encodeURIComponent(item.id)}/pdf`
      })),
      offer_translation_status: buildOfferTranslationStatus(normalizedBooking.offer, lang),
      generated_offers: generatedOffers,
      generated_offer_email_enabled: isGeneratedOfferEmailEnabled(),
      translation_enabled: Boolean(translationEnabled)
    };
  }

  function normalizeStageFilter(value) {
    const stage = normalizeText(value).toUpperCase();
    return stageOrder.includes(stage) ? stage : "";
  }

  function filterAndSortBookings(store, query, deps = {}) {
    const { ensureMetaChatCollections = () => {} } = deps;
    const stage = normalizeStageFilter(query.get("stage"));
    const assignedKeycloakUserId = normalizeText(query.get("assigned_keycloak_user_id"));
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

      const linkedBookingId = normalizeText(conversation.booking_id);
      const externalContactId = normalizeText(conversation.external_contact_id);
      const canonicalBookingId = linkedBookingId || (externalContactId ? getLatestBookingForContactMatch(externalContactId) : null);
      if (canonicalBookingId) {
        conversationBookingIds.set(conversationId, [canonicalBookingId]);
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
      if (assignedKeycloakUserId && getBookingAssignedKeycloakUserId(booking) !== assignedKeycloakUserId) return false;
      if (!search) return true;

      const contact = getBookingContactProfile(booking);
      const persons = getBookingPersons(booking);
      const haystack = [
        booking.id,
        ...normalizeStringArray(booking.destinations),
        ...normalizeStringArray(booking.travel_styles),
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
      filters: { stage: stage || null, assigned_keycloak_user_id: assignedKeycloakUserId || null, search: search || null },
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
    syncBookingAssignmentFields,
    getBookingAssignedKeycloakUserId,
    canAccessBooking,
    canEditBooking,
    buildBookingReadModel,
    filterAndSortBookings,
    paginate
  };
}
