import {
  getBookingPersons,
  getBookingPrimaryContact,
  normalizeBookingPersonsPayload,
  normalizeSingleBookingPersonPayload
} from "../../lib/booking_persons.js";
import { createBookingChatHandlers } from "./booking_chat.js";
import { createBookingMediaHandlers } from "./booking_media.js";
import { createBookingInvoiceHandlers } from "./booking_invoices.js";

export function createBookingHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    validateBookingInput,
    readStore,
    normalizeText,
    normalizeStringArray,
    getRequestIpAddress,
    guessCountryFromRequest,
    normalizeEmail,
    normalizePhone,
    nowIso,
    safeCurrency,
    BASE_CURRENCY,
    STAGES,
    computeServiceLevelAgreementDueAt,
    safeInt,
    defaultBookingPricing,
    defaultBookingOffer,
    addActivity,
    persistStore,
    getPrincipal,
    listAssignableKeycloakUsers,
    keycloakDisplayName,
    canReadAllBookings,
    canAccessBooking,
    buildBookingReadModel,
    paginate,
    buildPaginatedListResponse,
    ensureMetaChatCollections,
    clamp,
    isLikelyPhoneMatch,
    buildChatEventReadModel,
    getMetaConversationOpenUrl,
    STAGE_ORDER,
    ALLOWED_STAGE_TRANSITIONS,
    canChangeBookingStage,
    actorLabel,
    canChangeBookingAssignment,
    syncBookingAssignmentFields,
    getBookingAssignedKeycloakUserId,
    canEditBooking,
    validateBookingPricingInput,
    convertBookingPricingToBaseCurrency,
    normalizeBookingPricing,
    validateBookingOfferInput,
    convertBookingOfferToBaseCurrency,
    normalizeBookingOffer,
    validateOfferExchangeRequest,
    resolveExchangeRateWithFallback,
    convertOfferLineAmountForCurrency,
    normalizeInvoiceComponents,
    computeInvoiceComponentTotal,
    safeAmountCents,
    nextInvoiceNumber,
    writeInvoicePdf,
    randomUUID,
    invoicePdfPath,
    mkdir,
    path,
    execFile,
    TEMP_UPLOAD_DIR,
    BOOKING_IMAGES_DIR,
    BOOKING_PERSON_PHOTOS_DIR,
    writeFile,
    rm,
    sendFileWithCache
  } = deps;

  function unique(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
  }

  function normalizePersonEmails(person) {
    return unique(
      [...(Array.isArray(person?.emails) ? person.emails : [])]
        .map((value) => normalizeEmail(value))
        .filter(Boolean)
    );
  }

  function normalizePersonPhoneNumbers(person) {
    return unique(
      [...(Array.isArray(person?.phone_numbers) ? person.phone_numbers : [])]
        .map((value) => normalizePhone(value))
        .filter(Boolean)
    );
  }

  function resolveBookingPersonPhotoDiskPath(rawRelativePath) {
    const relativePath = normalizeText(rawRelativePath).replace(/^\/+/, "");
    if (!relativePath) return null;
    const absolutePath = path.resolve(BOOKING_PERSON_PHOTOS_DIR, relativePath);
    if (!absolutePath.startsWith(path.resolve(BOOKING_PERSON_PHOTOS_DIR) + path.sep)) return null;
    return absolutePath;
  }

  function resolveBookingImageDiskPath(rawRelativePath) {
    const relativePath = normalizeText(rawRelativePath).replace(/^\/+/, "");
    if (!relativePath) return null;
    const absolutePath = path.resolve(BOOKING_IMAGES_DIR, relativePath);
    if (!absolutePath.startsWith(path.resolve(BOOKING_IMAGES_DIR) + path.sep)) return null;
    return absolutePath;
  }

  async function processBookingImageToWebp(inputPath, outputPath) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await execFile("magick", [
      inputPath,
      "-auto-orient",
      "-resize",
      "1000x1000>",
      "-strip",
      "-quality",
      "82",
      outputPath
    ]);
  }

  async function processBookingPersonImageToWebp(inputPath, outputPath) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await execFile("magick", [
      inputPath,
      "-auto-orient",
      "-resize",
      "1000x1000>",
      "-strip",
      "-quality",
      "82",
      outputPath
    ]);
  }

  function getSubmittedContact(booking) {
    const submission = booking?.web_form_submission || {};
    return {
      name: normalizeText(submission.name) || null,
      email: normalizeEmail(submission.email) || null,
      phone_number: normalizePhone(submission.phone_number) || null,
      preferred_language: normalizeText(submission.preferred_language) || null,
      preferred_currency: safeCurrency(submission.preferred_currency || booking?.preferred_currency || BASE_CURRENCY)
    };
  }

  function buildPrimaryContactFromSubmission(booking) {
    const submitted = getSubmittedContact(booking);
    if (!submitted.name && !submitted.email && !submitted.phone_number) return null;
    return {
      id: `${normalizeText(booking?.id) || "booking"}_primary_contact`,
      name: submitted.name || "Primary contact",
      emails: submitted.email ? [submitted.email] : [],
      phone_numbers: submitted.phone_number ? [submitted.phone_number] : [],
      preferred_language: submitted.preferred_language || null,
      roles: ["primary_contact", "traveler"]
    };
  }

  function getBookingRevision(booking, field) {
    const value = Number(booking?.[field]);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  }

  function incrementBookingRevision(booking, field) {
    booking[field] = getBookingRevision(booking, field) + 1;
  }

  function getBookingContactProfile(booking) {
    const primary = getBookingPrimaryContact(booking);
    const submitted = getSubmittedContact(booking);
    const emails = primary ? normalizePersonEmails(primary) : [];
    const phoneNumbers = primary ? normalizePersonPhoneNumbers(primary) : [];
    return {
      name: normalizeText(primary?.name) || submitted.name || "Primary contact",
      email: emails[0] || submitted.email || null,
      phone_number: phoneNumbers[0] || submitted.phone_number || null,
      preferred_language: normalizeText(primary?.preferred_language) || submitted.preferred_language || null
    };
  }

  function getBookingSearchTerms(booking) {
    const contact = getBookingContactProfile(booking);
    const persons = getBookingPersons(booking);
    return [
      normalizeText(booking?.id),
      normalizeText(booking?.name),
      normalizeText(booking?.stage),
      normalizeText(booking?.notes),
      normalizeText(booking?.assigned_keycloak_user_id),
      ...normalizeStringArray(booking?.destinations),
      ...normalizeStringArray(booking?.travel_styles),
      normalizeText(contact.name),
      normalizeText(contact.email),
      normalizeText(contact.phone_number),
      ...persons.flatMap((person) => [
        normalizeText(person.name),
        ...normalizePersonEmails(person),
        ...normalizePersonPhoneNumbers(person)
      ])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function sortBookings(items, sort) {
    const list = [...items];
    switch (sort) {
      case "created_at_asc":
        return list.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
      case "updated_at_asc":
        return list.sort((a, b) => String(a.updated_at || "").localeCompare(String(b.updated_at || "")));
      case "updated_at_desc":
        return list.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
      case "stage_asc":
        return list.sort((a, b) => String(a.stage || "").localeCompare(String(b.stage || "")));
      case "stage_desc":
        return list.sort((a, b) => String(b.stage || "").localeCompare(String(a.stage || "")));
      case "created_at_desc":
      default:
        return list.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    }
  }

  function filterBookings(store, searchParams) {
    const stage = normalizeText(searchParams.get("stage")).toUpperCase();
    const assignedKeycloakUserId = normalizeText(searchParams.get("assigned_keycloak_user_id"));
    const rawSearch = normalizeText(searchParams.get("search")).toLowerCase();
    const sort = normalizeText(searchParams.get("sort")) || "created_at_desc";

    const items = sortBookings(
      (Array.isArray(store.bookings) ? store.bookings : []).filter((booking) => {
        if (stage && normalizeText(booking.stage).toUpperCase() !== stage) return false;
        if (assignedKeycloakUserId && getBookingAssignedKeycloakUserId(booking) !== assignedKeycloakUserId) return false;
        if (rawSearch && !getBookingSearchTerms(booking).includes(rawSearch)) return false;
        return true;
      }),
      sort
    );

    return {
      items,
      filters: {
        stage: stage || null,
        assigned_keycloak_user_id: assignedKeycloakUserId || null,
        search: rawSearch || null
      },
      sort
    };
  }

  async function buildBookingPayload(booking) {
    return buildBookingReadModel({
      ...booking,
      persons: getBookingPersons(booking)
    });
  }

  async function buildBookingDetailResponse(booking) {
    return { booking: await buildBookingPayload(booking) };
  }

  async function assertExpectedRevision(payload, booking, payloadField, revisionField, res) {
    const rawExpected = payload?.[payloadField];
    const expectedRevision = rawExpected === undefined || rawExpected === null || rawExpected === ""
      ? null
      : safeInt(rawExpected);
    const currentRevision = getBookingRevision(booking, revisionField);
    if (expectedRevision === null || expectedRevision !== currentRevision) {
      sendJson(res, 409, {
        error: "Booking changed in backend",
        detail: "The booking has changed in the backend. The data has been refreshed. Your changes are lost. Please do them again.",
        code: "BOOKING_REVISION_MISMATCH",
        booking: await buildBookingPayload(booking)
      });
      return false;
    }
    return true;
  }

  function getBookingConversationMatchValues(booking) {
    const persons = getBookingPersons(booking);
    const submitted = getSubmittedContact(booking);
    return {
      phones: unique(
        [
          submitted.phone_number,
          ...persons.flatMap((person) => normalizePersonPhoneNumbers(person))
        ].filter(Boolean)
      ),
      emails: unique(
        [
          submitted.email,
          ...persons.flatMap((person) => normalizePersonEmails(person))
        ].filter(Boolean)
      )
    };
  }

  function resolveCanonicalConversationBookingId(store, conversation, excludedBookingId = "") {
    const assignedBookingId = normalizeText(conversation?.booking_id);
    if (assignedBookingId && assignedBookingId !== normalizeText(excludedBookingId)) return assignedBookingId;
    const channel = normalizeText(conversation.channel).toLowerCase();
    const externalContactId = normalizeText(conversation.external_contact_id);
    if (channel === "whatsapp" && externalContactId) {
      const matches = (Array.isArray(store?.bookings) ? store.bookings : [])
        .filter((booking) => normalizeText(booking.id) !== normalizeText(excludedBookingId))
        .filter((booking) => {
          const { phones } = getBookingConversationMatchValues(booking);
          return phones.some((phone) => isLikelyPhoneMatch(phone, externalContactId));
        })
        .sort((left, right) => String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || "")));
      return normalizeText(matches[0]?.id) || "";
    }
    const normalizedEmail = externalContactId.toLowerCase();
    const matches = (Array.isArray(store?.bookings) ? store.bookings : [])
      .filter((booking) => normalizeText(booking.id) !== normalizeText(excludedBookingId))
      .filter((booking) => {
        const { emails } = getBookingConversationMatchValues(booking);
        return emails.includes(normalizedEmail);
      })
      .sort((left, right) => String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || "")));
    return normalizeText(matches[0]?.id) || "";
  }

  function conversationMatchesBooking(store, conversation, bookingId) {
    return resolveCanonicalConversationBookingId(store, conversation) === normalizeText(bookingId);
  }

  function buildConversationRelatedBookings(store, conversation, bookingId) {
    const channel = normalizeText(conversation?.channel).toLowerCase();
    const externalContactId = normalizeText(conversation?.external_contact_id);
    if (!externalContactId) return [];

    const matches = (Array.isArray(store?.bookings) ? store.bookings : [])
      .filter((candidate) => normalizeText(candidate.id) !== normalizeText(bookingId))
      .filter((candidate) => {
        const { phones, emails } = getBookingConversationMatchValues(candidate);
        if (channel === "whatsapp") return phones.some((phone) => isLikelyPhoneMatch(phone, externalContactId));
        return emails.includes(externalContactId.toLowerCase());
      })
      .sort((left, right) => String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || "")));

    return matches.map((candidate) => ({
      booking_id: candidate.id,
      name: normalizeText(candidate.name) || null,
      stage: normalizeText(candidate.stage) || null
    }));
  }

  async function deleteBookingArtifacts(store, bookingId) {
    const removedInvoices = Array.isArray(store.invoices)
      ? store.invoices.filter((invoice) => invoice.booking_id === bookingId)
      : [];

    store.bookings = Array.isArray(store.bookings) ? store.bookings.filter((booking) => booking.id !== bookingId) : [];
    store.activities = Array.isArray(store.activities) ? store.activities.filter((activity) => activity.booking_id !== bookingId) : [];
    store.invoices = Array.isArray(store.invoices) ? store.invoices.filter((invoice) => invoice.booking_id !== bookingId) : [];

    ensureMetaChatCollections(store);
    for (const conversation of store.chat_conversations) {
      if (normalizeText(conversation.booking_id) === bookingId) {
        conversation.booking_id = resolveCanonicalConversationBookingId(store, conversation, bookingId) || null;
        conversation.updated_at = nowIso();
      }
    }

    await Promise.all(
      removedInvoices.map(async (invoice) => {
        try {
          await rm(invoicePdfPath(invoice.id, invoice.version), { force: true });
        } catch {
          // Ignore stale file cleanup failures.
        }
      })
    );
  }

  const { handleListBookingChatEvents } = createBookingChatHandlers({
    readStore,
    sendJson,
    getPrincipal,
    canAccessBooking,
    ensureMetaChatCollections,
    clamp,
    safeInt,
    conversationMatchesBooking,
    buildChatEventReadModel,
    buildConversationRelatedBookings,
    normalizeText,
    getMetaConversationOpenUrl
  });

  const {
    handlePublicBookingPersonPhoto,
    handlePublicBookingImage,
    handleUploadBookingImage,
    handleUploadBookingPersonPhoto
  } = createBookingMediaHandlers({
    readBodyJson,
    sendJson,
    normalizeText,
    getPrincipal,
    readStore,
    canEditBooking,
    assertExpectedRevision,
    path,
    randomUUID,
    TEMP_UPLOAD_DIR,
    BOOKING_IMAGES_DIR,
    BOOKING_PERSON_PHOTOS_DIR,
    writeFile,
    rm,
    processBookingImageToWebp,
    processBookingPersonImageToWebp,
    nowIso,
    addActivity,
    actorLabel,
    persistStore,
    buildBookingDetailResponse,
    incrementBookingRevision,
    resolveBookingImageDiskPath,
    resolveBookingPersonPhotoDiskPath,
    sendFileWithCache,
    getBookingPersons
  });

  const {
    handleListBookingInvoices,
    handleCreateBookingInvoice,
    handlePatchBookingInvoice,
    handleGetInvoicePdf
  } = createBookingInvoiceHandlers({
    readBodyJson,
    sendJson,
    readStore,
    getPrincipal,
    canAccessBooking,
    canEditBooking,
    assertExpectedRevision,
    normalizeInvoiceComponents,
    computeInvoiceComponentTotal,
    safeAmountCents,
    nextInvoiceNumber,
    safeCurrency,
    normalizeText,
    nowIso,
    writeInvoicePdf,
    randomUUID,
    addActivity,
    actorLabel,
    persistStore,
    buildBookingPayload,
    incrementBookingRevision,
    getBookingContactProfile,
    invoicePdfPath,
    sendFileWithCache
  });

  async function handleCreateBooking(req, res) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const check = validateBookingInput(payload);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    const store = await readStore();
    const idempotencyKey = normalizeText(req.headers["idempotency-key"]);
    if (idempotencyKey) {
      const existingByKey = store.bookings.find((booking) => booking.idempotency_key === idempotencyKey);
      if (existingByKey) {
        sendJson(res, 200, await buildBookingDetailResponse(existingByKey));
        return;
      }
    }

    const now = nowIso();
    const ipAddress = getRequestIpAddress(req);
    const ipCountryGuess = guessCountryFromRequest(req, ipAddress);
    const inputPhoneNumber = normalizePhone(payload.phone_number);
    const inputPreferredLanguage = normalizeText(payload.preferred_language) || null;
    const preferredCurrency = safeCurrency(payload.preferred_currency || BASE_CURRENCY);
    const budgetLowerUsd = normalizeText(payload.budget_lower_usd) ? safeInt(payload.budget_lower_usd) : null;
    const budgetUpperUsd = normalizeText(payload.budget_upper_usd) ? safeInt(payload.budget_upper_usd) : null;
    const travelDurationMin = normalizeText(payload.travel_duration_days_min) ? safeInt(payload.travel_duration_days_min) : null;
    const travelDurationMax = normalizeText(payload.travel_duration_days_max) ? safeInt(payload.travel_duration_days_max) : null;
    const bookingId = `booking_${randomUUID()}`;

    const submission = {
      destinations: normalizeStringArray(payload.destinations),
      travel_style: normalizeStringArray(payload.travel_style),
      booking_name: normalizeText(payload.booking_name) || null,
      tour_id: normalizeText(payload.tour_id) || null,
      page_url: normalizeText(payload.page_url),
      ip_address: ipAddress || null,
      ip_country_guess: ipCountryGuess || null,
      referrer: normalizeText(payload.referrer),
      utm_source: normalizeText(payload.utm_source),
      utm_medium: normalizeText(payload.utm_medium),
      utm_campaign: normalizeText(payload.utm_campaign),
      travel_month: normalizeText(payload.travel_month) || null,
      number_of_travelers: normalizeText(payload.number_of_travelers) ? safeInt(payload.number_of_travelers) : null,
      preferred_currency: preferredCurrency,
      travel_duration_days_min: travelDurationMin,
      travel_duration_days_max: travelDurationMax,
      name: normalizeText(payload.name) || null,
      email: normalizeEmail(payload.email) || null,
      phone_number: inputPhoneNumber || null,
      budget_lower_usd: Number.isInteger(budgetLowerUsd) ? budgetLowerUsd : null,
      budget_upper_usd: Number.isInteger(budgetUpperUsd) ? budgetUpperUsd : null,
      preferred_language: inputPreferredLanguage || null,
      notes: normalizeText(payload.notes) || null,
      submitted_at: now
    };

    const initialBookingName = normalizeText(payload.booking_name) || null;

    const booking = {
      id: bookingId,
      name: initialBookingName,
      core_revision: 0,
      notes_revision: 0,
      persons_revision: 0,
      pricing_revision: 0,
      offer_revision: 0,
      invoices_revision: 0,
      stage: STAGES.NEW,
      assigned_keycloak_user_id: null,
      service_level_agreement_due_at: computeServiceLevelAgreementDueAt(STAGES.NEW),
      destinations: submission.destinations,
      travel_styles: submission.travel_style,
      web_form_travel_month: submission.travel_month,
      travel_start_day: null,
      travel_end_day: null,
      number_of_travelers: submission.number_of_travelers,
      preferred_currency: preferredCurrency,
      notes: submission.notes,
      persons: [],
      web_form_submission: submission,
      pricing: defaultBookingPricing(),
      offer: defaultBookingOffer(preferredCurrency),
      idempotency_key: idempotencyKey || null,
      created_at: now,
      updated_at: now
    };

    const primaryContact = buildPrimaryContactFromSubmission(booking);
    booking.persons = primaryContact ? [primaryContact] : [];

    store.bookings.push(booking);
    addActivity(store, booking.id, "BOOKING_CREATED", "public_api", "Booking created from website form");
    await persistStore(store);

    sendJson(res, 201, await buildBookingDetailResponse(booking));
  }

  async function handleListBookings(req, res) {
    const store = await readStore();
    const principal = getPrincipal(req);
    if (!canReadAllBookings(principal) && !(Array.isArray(principal?.roles) && principal.roles.includes("atp_staff") && normalizeText(principal?.sub))) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const requestUrl = new URL(req.url, "http://localhost");
    const { items: filtered, filters, sort } = filterBookings(store, requestUrl.searchParams);
    const visibleBookings = filtered.filter((booking) => canAccessBooking(principal, booking));
    const visible = await Promise.all(
      visibleBookings.map((booking) => buildBookingPayload(booking))
    );
    const paged = paginate(visible, requestUrl.searchParams);
    sendJson(res, 200, buildPaginatedListResponse(paged, { filters, sort }));
  }

  async function handleGetBooking(req, res, [bookingId]) {
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

    sendJson(res, 200, await buildBookingDetailResponse(booking));
  }

  async function handleDeleteBooking(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }

    const principal = getPrincipal(req);
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(payload, booking, "expected_core_revision", "core_revision", res))) return;

    await deleteBookingArtifacts(store, bookingId);
    await persistStore(store);
    sendJson(res, 200, { deleted: true, booking_id: bookingId });
  }

  async function handlePatchBookingStage(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const nextStage = normalizeText(payload.stage).toUpperCase();
    if (!STAGE_ORDER.includes(nextStage)) {
      sendJson(res, 422, { error: "Invalid stage" });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canChangeBookingStage(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(payload, booking, "expected_core_revision", "core_revision", res))) return;

    const allowed = ALLOWED_STAGE_TRANSITIONS[booking.stage] || [];
    if (!allowed.includes(nextStage)) {
      sendJson(res, 409, { error: `Transition ${booking.stage} -> ${nextStage} is not allowed` });
      return;
    }

    booking.stage = nextStage;
    booking.service_level_agreement_due_at = computeServiceLevelAgreementDueAt(nextStage);
    incrementBookingRevision(booking, "core_revision");
    booking.updated_at = nowIso();

    addActivity(store, booking.id, "STAGE_CHANGED", actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"), `Stage updated to ${nextStage}`);
    await persistStore(store);

    sendJson(res, 200, await buildBookingDetailResponse(booking));
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
    if (!(await assertExpectedRevision(payload, booking, "expected_core_revision", "core_revision", res))) return;

    const nextName = normalizeText(payload.name) || null;
    const currentName = normalizeText(booking.name) || null;
    if (nextName === currentName) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking)), unchanged: true });
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

    sendJson(res, 200, await buildBookingDetailResponse(booking));
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
    if (!(await assertExpectedRevision(payload, booking, "expected_core_revision", "core_revision", res))) return;

    if (!assignedKeycloakUserId) {
      booking.assigned_keycloak_user_id = null;
      syncBookingAssignmentFields(booking);
      incrementBookingRevision(booking, "core_revision");
      booking.updated_at = nowIso();
      addActivity(store, booking.id, "ASSIGNMENT_CHANGED", actorLabel(principal, "keycloak_user"), "Keycloak user unassigned");
      await persistStore(store);
      sendJson(res, 200, await buildBookingDetailResponse(booking));
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

    sendJson(res, 200, await buildBookingDetailResponse(booking));
  }

  async function handleCreateBookingPerson(req, res, [bookingId]) {
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
    if (!(await assertExpectedRevision(payload, booking, "expected_persons_revision", "persons_revision", res))) return;

    const nextPerson = normalizeSingleBookingPersonPayload(booking.id, payload.person, getBookingPersons(booking).length);
    if (!nextPerson) {
      sendJson(res, 422, { error: "person is required" });
      return;
    }

    booking.persons = [...getBookingPersons(booking), nextPerson];
    incrementBookingRevision(booking, "persons_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "BOOKING_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      `Person created: ${normalizeText(nextPerson.name) || nextPerson.id}`
    );
    await persistStore(store);
    sendJson(res, 201, await buildBookingDetailResponse(booking));
  }

  async function handlePatchBookingPerson(req, res, [bookingId, personId]) {
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
    if (!(await assertExpectedRevision(payload, booking, "expected_persons_revision", "persons_revision", res))) return;

    const persons = getBookingPersons(booking);
    const personIndex = persons.findIndex((person) => person.id === personId);
    if (personIndex < 0) {
      sendJson(res, 404, { error: "Person not found" });
      return;
    }

    const mergedPerson = normalizeSingleBookingPersonPayload(booking.id, {
      ...persons[personIndex],
      ...(payload.person && typeof payload.person === "object" ? payload.person : {}),
      id: personId
    }, personIndex);
    if (!mergedPerson) {
      sendJson(res, 422, { error: "person is required" });
      return;
    }

    if (JSON.stringify(persons[personIndex]) === JSON.stringify(mergedPerson)) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking)), unchanged: true });
      return;
    }

    persons[personIndex] = mergedPerson;
    booking.persons = persons;
    incrementBookingRevision(booking, "persons_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "BOOKING_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      `Person updated: ${normalizeText(mergedPerson.name) || mergedPerson.id}`
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(booking));
  }

  async function handleDeleteBookingPerson(req, res, [bookingId, personId]) {
    let payload = {};
    try {
      payload = await readBodyJson(req);
    } catch {
      payload = {};
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
    if (!(await assertExpectedRevision(payload, booking, "expected_persons_revision", "persons_revision", res))) return;

    const persons = getBookingPersons(booking);
    const personIndex = persons.findIndex((person) => person.id === personId);
    if (personIndex < 0) {
      sendJson(res, 404, { error: "Person not found" });
      return;
    }

    const [removedPerson] = persons.splice(personIndex, 1);
    booking.persons = persons;
    incrementBookingRevision(booking, "persons_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "BOOKING_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      `Person removed: ${normalizeText(removedPerson?.name) || personId}`
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(booking));
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
    if (!(await assertExpectedRevision(payload, booking, "expected_notes_revision", "notes_revision", res))) return;

    const nextNotes = normalizeText(payload.notes);
    const currentNotes = normalizeText(booking.notes);
    if (nextNotes === currentNotes) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking)), unchanged: true });
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

    sendJson(res, 200, await buildBookingDetailResponse(booking));
  }

  async function handlePatchBookingPricing(req, res, [bookingId]) {
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
    if (!(await assertExpectedRevision(payload, booking, "expected_pricing_revision", "pricing_revision", res))) return;

    const check = validateBookingPricingInput(payload.pricing);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    const nextPricingBase = await convertBookingPricingToBaseCurrency(check.pricing);
    const nextPricingJson = JSON.stringify(nextPricingBase);
    const currentPricingJson = JSON.stringify(normalizeBookingPricing(booking.pricing));
    if (nextPricingJson === currentPricingJson) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking)), unchanged: true });
      return;
    }

    booking.pricing = nextPricingBase;
    incrementBookingRevision(booking, "pricing_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "PRICING_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      "Booking commercials updated"
    );
    await persistStore(store);

    sendJson(res, 200, await buildBookingDetailResponse(booking));
  }

  async function handlePatchBookingOffer(req, res, [bookingId]) {
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
    if (!(await assertExpectedRevision(payload, booking, "expected_offer_revision", "offer_revision", res))) return;

    const check = validateBookingOfferInput(payload.offer, booking);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    const nextOfferBase = await convertBookingOfferToBaseCurrency(check.offer);
    const nextOfferJson = JSON.stringify(nextOfferBase);
    const currentOfferJson = JSON.stringify(
      normalizeBookingOffer(booking.offer, booking.preferred_currency || booking.pricing?.currency || BASE_CURRENCY)
    );
    if (nextOfferJson === currentOfferJson) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking)), unchanged: true });
      return;
    }

    booking.offer = nextOfferBase;
    incrementBookingRevision(booking, "offer_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "OFFER_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      "Booking offer updated"
    );
    await persistStore(store);

    sendJson(res, 200, await buildBookingDetailResponse(booking));
  }

  async function handlePostOfferExchangeRates(req, res) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const principal = getPrincipal(req);
    if (!principal) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    const check = validateOfferExchangeRequest(payload);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    const { fromCurrency, toCurrency, components } = check;
    if (!Array.isArray(components) || components.length === 0) {
      sendJson(res, 200, {
        from_currency: fromCurrency,
        to_currency: toCurrency,
        exchange_rate: 1,
        total_price_cents: 0,
        converted_components: []
      });
      return;
    }

    let sourceToBaseRate = 1;
    let baseToTargetRate = 1;
    const warnings = new Set();

    if (fromCurrency !== BASE_CURRENCY) {
      try {
        const resolved = await resolveExchangeRateWithFallback(fromCurrency, BASE_CURRENCY);
        sourceToBaseRate = resolved.rate;
        if (resolved.warning) warnings.add(resolved.warning);
      } catch (error) {
        sendJson(res, 502, { error: "Unable to fetch exchange rate", detail: String(error?.message || error) });
        return;
      }
    }
    if (toCurrency !== BASE_CURRENCY) {
      try {
        const resolved = await resolveExchangeRateWithFallback(BASE_CURRENCY, toCurrency);
        baseToTargetRate = resolved.rate;
        if (resolved.warning) warnings.add(resolved.warning);
      } catch (error) {
        sendJson(res, 502, { error: "Unable to fetch exchange rate", detail: String(error?.message || error) });
        return;
      }
    }

    const convertedComponents = components.map((component) =>
      convertOfferLineAmountForCurrency(component, { sourceToBaseRate, baseToTargetRate }, fromCurrency, toCurrency)
    );
    const combinedRate = sourceToBaseRate * baseToTargetRate;

    sendJson(res, 200, {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      exchange_rate: combinedRate,
      total_price_cents: convertedComponents.reduce(
        (sum, component) =>
          sum + (Number.isFinite(component.line_total_amount_cents) ? Number(component.line_total_amount_cents) : 0),
        0
      ),
      converted_components: convertedComponents,
      ...(warnings.size > 0 ? { warning: [...warnings].join(" ") } : {})
    });
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
    if (!(await assertExpectedRevision(payload, booking, "expected_core_revision", "core_revision", res))) return;

    const activity = addActivity(store, booking.id, type, actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"), detail);
    incrementBookingRevision(booking, "core_revision");
    booking.updated_at = nowIso();
    await persistStore(store);

    sendJson(res, 201, { activity, booking: await buildBookingPayload(booking) });
  }

  return {
    handleCreateBooking,
    handleListBookings,
    handleGetBooking,
    handleDeleteBooking,
    handleListBookingChatEvents,
    handlePublicBookingImage,
    handlePublicBookingPersonPhoto,
    handlePatchBookingName,
    handleUploadBookingImage,
    handlePatchBookingStage,
    handlePatchBookingOwner,
    handleCreateBookingPerson,
    handlePatchBookingPerson,
    handleDeleteBookingPerson,
    handleUploadBookingPersonPhoto,
    handlePatchBookingNotes,
    handlePatchBookingPricing,
    handlePatchBookingOffer,
    handlePostOfferExchangeRates,
    handleListActivities,
    handleCreateActivity,
    handleListBookingInvoices,
    handleCreateBookingInvoice,
    handlePatchBookingInvoice,
    handleGetInvoicePdf
  };
}
