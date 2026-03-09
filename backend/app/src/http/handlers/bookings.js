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
    computeBookingHash,
    getPrincipal,
    loadAtpStaff,
    resolvePrincipalAtpStaffMember,
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
    assertMatchingBookingHash,
    actorLabel,
    canChangeBookingAssignment,
    syncBookingAtpStaffFields,
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
    rm,
    sendFileWithCache
  } = deps;

  function unique(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
  }

  function normalizePersonEmails(person) {
    return unique(
      [person?.email, ...(Array.isArray(person?.emails) ? person.emails : [])]
        .map((value) => normalizeEmail(value))
        .filter(Boolean)
    );
  }

  function normalizePersonPhoneNumbers(person) {
    return unique(
      [person?.phone_number, person?.phone, ...(Array.isArray(person?.phone_numbers) ? person.phone_numbers : [])]
        .map((value) => normalizePhone(value))
        .filter(Boolean)
    );
  }

  function normalizePersonRoles(person) {
    return unique((Array.isArray(person?.roles) ? person.roles : []).map((value) => normalizeText(value)).filter(Boolean));
  }

  function normalizeBookingPersonsForWrite(booking) {
    const persons = Array.isArray(booking?.persons) ? booking.persons : [];
    return persons
      .map((person, index) => {
        if (!person || typeof person !== "object" || Array.isArray(person)) return null;
        const roles = normalizePersonRoles(person);
        const emails = normalizePersonEmails(person);
        const phoneNumbers = normalizePersonPhoneNumbers(person);
        const normalized = {
          ...person,
          id: normalizeText(person.id) || `${normalizeText(booking?.id) || "booking"}_person_${index + 1}`,
          name: normalizeText(person.name) || `Traveler ${index + 1}`,
          roles,
          emails,
          phone_numbers: phoneNumbers
        };
        delete normalized.email;
        delete normalized.phone;
        delete normalized.phone_number;
        return normalized;
      })
      .filter(Boolean);
  }

  function getSubmittedCustomer(booking) {
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
    const submitted = getSubmittedCustomer(booking);
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

  function getBookingPersons(booking) {
    const normalized = normalizeBookingPersonsForWrite(booking);
    if (normalized.length) return normalized;
    const fallback = buildPrimaryContactFromSubmission(booking);
    return fallback ? [fallback] : [];
  }

  function getBookingPrimaryContact(booking) {
    const persons = getBookingPersons(booking);
    const explicit = persons.find((person) => normalizePersonRoles(person).includes("primary_contact"));
    return explicit || persons[0] || null;
  }

  function getBookingContactProfile(booking) {
    const primary = getBookingPrimaryContact(booking);
    const submitted = getSubmittedCustomer(booking);
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
      normalizeText(booking?.stage),
      normalizeText(booking?.notes),
      normalizeText(booking?.atp_staff_name),
      ...normalizeStringArray(booking?.destinations || booking?.destination),
      ...normalizeStringArray(booking?.travel_styles || booking?.style),
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
    const atpStaffId = normalizeText(searchParams.get("atp_staff"));
    const rawSearch = normalizeText(searchParams.get("search")).toLowerCase();
    const sort = normalizeText(searchParams.get("sort")) || "created_at_desc";

    const items = sortBookings(
      (Array.isArray(store.bookings) ? store.bookings : []).filter((booking) => {
        if (stage && normalizeText(booking.stage).toUpperCase() !== stage) return false;
        if (atpStaffId && normalizeText(booking.atp_staff) !== atpStaffId) return false;
        if (rawSearch && !getBookingSearchTerms(booking).includes(rawSearch)) return false;
        return true;
      }),
      sort
    );

    return {
      items,
      filters: {
        stage: stage || null,
        atp_staff: atpStaffId || null,
        search: rawSearch || null
      },
      sort
    };
  }

  async function buildBookingPayload(booking) {
    const response = await buildBookingReadModel({
      ...booking,
      persons: getBookingPersons(booking)
    });
    if (!response.serviceLevelAgreementDueAt && response.service_level_agreement_due_at) {
      response.serviceLevelAgreementDueAt = response.service_level_agreement_due_at;
    }
    if (!response.createdAt && response.created_at) {
      response.createdAt = response.created_at;
    }
    if (!response.updatedAt && response.updated_at) {
      response.updatedAt = response.updated_at;
    }
    if (!response.destinations && response.destination) {
      response.destinations = response.destination;
    }
    if (!response.travel_styles && response.style) {
      response.travel_styles = response.style;
    }
    return response;
  }

  async function buildBookingDetailResponse(booking) {
    return { booking: await buildBookingPayload(booking) };
  }

  function getBookingConversationMatchValues(booking) {
    const persons = getBookingPersons(booking);
    const submitted = getSubmittedCustomer(booking);
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

  function conversationMatchesBooking(conversation, bookingId, booking) {
    if (normalizeText(conversation.booking_id) === bookingId) return true;
    const channel = normalizeText(conversation.channel).toLowerCase();
    const externalContactId = normalizeText(conversation.external_contact_id);
    const { phones, emails } = getBookingConversationMatchValues(booking);
    if (channel === "whatsapp" && externalContactId) {
      return phones.some((phone) => isLikelyPhoneMatch(phone, externalContactId));
    }
    return emails.includes(externalContactId.toLowerCase());
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
        conversation.booking_id = null;
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

  function sendDeprecatedClientEndpoint(res) {
    sendJson(res, 410, {
      error: "Deprecated endpoint",
      detail: "Booking customer/group assignment endpoints were removed. booking.persons is now the source of truth."
    });
  }

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
    const budgetLowerUSD = normalizeText(payload.budget_lower_USD) ? safeInt(payload.budget_lower_USD) : null;
    const budgetUpperUSD = normalizeText(payload.budget_upper_USD) ? safeInt(payload.budget_upper_USD) : null;
    const travelDurationMin = normalizeText(payload.travel_duration_days_min) ? safeInt(payload.travel_duration_days_min) : null;
    const travelDurationMax = normalizeText(payload.travel_duration_days_max) ? safeInt(payload.travel_duration_days_max) : null;
    const bookingId = `booking_${randomUUID()}`;

    const submission = {
      destinations: normalizeStringArray(payload.destinations),
      travel_style: normalizeStringArray(payload.travel_style),
      travel_month: normalizeText(payload.travel_month) || null,
      number_of_travelers: normalizeText(payload.number_of_travelers) ? safeInt(payload.number_of_travelers) : null,
      preferred_currency: preferredCurrency,
      travel_duration_days_min: travelDurationMin,
      travel_duration_days_max: travelDurationMax,
      name: normalizeText(payload.name) || null,
      email: normalizeEmail(payload.email) || null,
      phone_number: inputPhoneNumber || null,
      budget_lower_USD: Number.isInteger(budgetLowerUSD) ? budgetLowerUSD : null,
      budget_upper_USD: Number.isInteger(budgetUpperUSD) ? budgetUpperUSD : null,
      preferred_language: inputPreferredLanguage || null,
      notes: normalizeText(payload.notes) || null,
      submittedAt: now
    };

    const booking = {
      id: bookingId,
      stage: STAGES.NEW,
      atp_staff: null,
      atp_staff_name: null,
      service_level_agreement_due_at: computeServiceLevelAgreementDueAt(STAGES.NEW),
      destinations: submission.destinations,
      destination: submission.destinations,
      travel_styles: submission.travel_style,
      style: submission.travel_style,
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
      source: {
        page_url: normalizeText(payload.pageUrl),
        ip_address: ipAddress || null,
        ip_country_guess: ipCountryGuess || null,
        utm_source: normalizeText(payload.utm_source),
        utm_medium: normalizeText(payload.utm_medium),
        utm_campaign: normalizeText(payload.utm_campaign),
        referrer: normalizeText(payload.referrer),
        tour_id: normalizeText(payload.tourId || payload.tour_id) || null,
        tour_title: normalizeText(payload.tourTitle || payload.tour_title) || null
      },
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
    const atpStaff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atpStaff);
    if (!canReadAllBookings(principal) && !staffMember) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const requestUrl = new URL(req.url, "http://localhost");
    const { items: filtered, filters, sort } = filterBookings(store, requestUrl.searchParams);
    const visible = await Promise.all(
      filtered
        .filter((booking) => canAccessBooking(principal, booking, staffMember))
        .map((booking) => buildBookingPayload(booking))
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
    const atpStaff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atpStaff);
    if (!canAccessBooking(principal, booking, staffMember)) {
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
    const atpStaff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atpStaff);
    if (!canEditBooking(principal, booking, staffMember)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertMatchingBookingHash(payload, booking, res))) return;

    await deleteBookingArtifacts(store, bookingId);
    await persistStore(store);
    sendJson(res, 200, { deleted: true, booking_id: bookingId });
  }

  async function handleListBookingChatEvents(req, res, [bookingId]) {
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }

    const principal = getPrincipal(req);
    const atpStaff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atpStaff);
    if (!canAccessBooking(principal, booking, staffMember)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    ensureMetaChatCollections(store);
    const requestUrl = new URL(req.url, "http://localhost");
    const limit = clamp(safeInt(requestUrl.searchParams.get("limit")) || 100, 1, 500);

    const conversationItems = store.chat_conversations.filter((conversation) => conversationMatchesBooking(conversation, bookingId, booking));
    const conversationMap = new Map(conversationItems.map((item) => [item.id, item]));
    const events = store.chat_events
      .filter((event) => conversationMap.has(event.conversation_id))
      .sort((a, b) => String(b.sent_at || b.created_at || "").localeCompare(String(a.sent_at || a.created_at || "")))
      .slice(0, limit);

    const items = events.map((event) => buildChatEventReadModel(event, conversationMap.get(event.conversation_id)));
    const conversations = conversationItems
      .map((conversation) => {
        const channel = normalizeText(conversation.channel).toLowerCase();
        return {
          id: conversation.id,
          channel,
          external_contact_id: conversation.external_contact_id || null,
          client_id: conversation.client_id || null,
          booking_id: conversation.booking_id || null,
          last_event_at: conversation.last_event_at || null,
          latest_preview: conversation.latest_preview || null,
          open_url: getMetaConversationOpenUrl(channel, conversation.external_contact_id)
        };
      })
      .sort((a, b) => String(b.last_event_at || "").localeCompare(String(a.last_event_at || "")));

    sendJson(res, 200, {
      mode: "read_only",
      items,
      total: items.length,
      conversations,
      conversation_total: conversations.length
    });
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
    const atpStaff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atpStaff);
    if (!canChangeBookingStage(principal, booking, staffMember)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertMatchingBookingHash(payload, booking, res))) return;

    const allowed = ALLOWED_STAGE_TRANSITIONS[booking.stage] || [];
    if (!allowed.includes(nextStage)) {
      sendJson(res, 409, { error: `Transition ${booking.stage} -> ${nextStage} is not allowed` });
      return;
    }

    booking.stage = nextStage;
    booking.service_level_agreement_due_at = computeServiceLevelAgreementDueAt(nextStage);
    booking.updated_at = nowIso();

    addActivity(store, booking.id, "STAGE_CHANGED", actorLabel(principal, normalizeText(payload.actor) || "atp_staff"), `Stage updated to ${nextStage}`);
    await persistStore(store);

    sendJson(res, 200, await buildBookingDetailResponse(booking));
  }

  async function handlePatchBookingClient(_req, res) {
    sendDeprecatedClientEndpoint(res);
  }

  async function handleCreateBookingCustomer(_req, res) {
    sendDeprecatedClientEndpoint(res);
  }

  async function handleCreateBookingGroup(_req, res) {
    sendDeprecatedClientEndpoint(res);
  }

  async function handleCreateBookingGroupMember(_req, res) {
    sendDeprecatedClientEndpoint(res);
  }

  async function handlePatchBookingOwner(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const atpStaffIdRaw = normalizeText(payload.atp_staff);
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
    if (!(await assertMatchingBookingHash(payload, booking, res))) return;

    if (!atpStaffIdRaw) {
      booking.atp_staff = null;
      booking.atp_staff_name = null;
      syncBookingAtpStaffFields(booking);
      booking.updated_at = nowIso();
      addActivity(store, booking.id, "STAFF_CHANGED", actorLabel(principal, "atp_staff"), "AtpStaff unassigned");
      await persistStore(store);
      sendJson(res, 200, await buildBookingDetailResponse(booking));
      return;
    }

    const atpStaff = await loadAtpStaff();
    const assignedStaff = atpStaff.find((member) => member.id === atpStaffIdRaw && member.active);
    if (!assignedStaff) {
      sendJson(res, 422, { error: "AtpStaff member not found or inactive" });
      return;
    }

    booking.atp_staff = assignedStaff.id;
    booking.atp_staff_name = assignedStaff.name;
    syncBookingAtpStaffFields(booking);
    booking.updated_at = nowIso();
    addActivity(store, booking.id, "STAFF_CHANGED", actorLabel(principal, "atp_staff"), `AtpStaff set to ${assignedStaff.name}`);
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
    const atpStaff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atpStaff);
    if (!canEditBooking(principal, booking, staffMember)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertMatchingBookingHash(payload, booking, res))) return;

    const nextNotes = normalizeText(payload.notes);
    const currentNotes = normalizeText(booking.notes);
    if (nextNotes === currentNotes) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking)), unchanged: true });
      return;
    }

    booking.notes = nextNotes;
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "NOTE_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "atp_staff"),
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
    const atpStaff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atpStaff);
    if (!canEditBooking(principal, booking, staffMember)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertMatchingBookingHash(payload, booking, res))) return;

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
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "PRICING_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "atp_staff"),
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
    const atpStaff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atpStaff);
    if (!canEditBooking(principal, booking, staffMember)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertMatchingBookingHash(payload, booking, res))) return;

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
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "OFFER_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "atp_staff"),
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
    const atpStaff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atpStaff);
    if (!canAccessBooking(principal, booking, staffMember)) {
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
    const atpStaff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atpStaff);
    if (!canEditBooking(principal, booking, staffMember)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertMatchingBookingHash(payload, booking, res))) return;

    const activity = addActivity(store, booking.id, type, actorLabel(principal, normalizeText(payload.actor) || "atp_staff"), detail);
    booking.updated_at = nowIso();
    await persistStore(store);

    sendJson(res, 201, { activity, booking: await buildBookingPayload(booking) });
  }

  function buildInvoiceReadModel(invoice) {
    return {
      ...invoice,
      components: Array.isArray(invoice?.components) ? invoice.components : [],
      sent_to_customer: Boolean(invoice.sent_to_customer),
      sent_to_customer_at: invoice.sent_to_customer_at || null,
      pdf_url: `/api/v1/invoices/${encodeURIComponent(invoice.id)}/pdf`
    };
  }

  function getInvoicePartyForBooking(booking) {
    const contact = getBookingContactProfile(booking);
    return {
      name: contact.name || "Primary contact",
      email: contact.email || null,
      phone_number: contact.phone_number || null
    };
  }

  async function handleListBookingInvoices(req, res, [bookingId]) {
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    const principal = getPrincipal(req);
    const atpStaff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atpStaff);
    if (!canAccessBooking(principal, booking, staffMember)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const invoices = [...store.invoices]
      .filter((invoice) => invoice.booking_id === bookingId)
      .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")))
      .map(buildInvoiceReadModel);
    sendJson(res, 200, { items: invoices, total: invoices.length });
  }

  async function handleCreateBookingInvoice(req, res, [bookingId]) {
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
    const atpStaff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atpStaff);
    if (!canEditBooking(principal, booking, staffMember)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertMatchingBookingHash(payload, booking, res))) return;

    const components = normalizeInvoiceComponents(payload.components);
    if (!components.length) {
      sendJson(res, 422, { error: "At least one invoice component is required" });
      return;
    }

    const now = nowIso();
    const invoiceParty = getInvoicePartyForBooking(booking);
    const totalAmountCents = computeInvoiceComponentTotal(components);
    const dueAmountCents = safeAmountCents(payload.due_amount_cents) ?? totalAmountCents;
    const invoice = {
      id: `inv_${randomUUID()}`,
      booking_id: bookingId,
      client_id: bookingId,
      invoice_number: normalizeText(payload.invoice_number) || nextInvoiceNumber(store),
      version: 1,
      status: "DRAFT",
      currency: safeCurrency(payload.currency),
      issue_date: normalizeText(payload.issue_date) || now.slice(0, 10),
      due_date: normalizeText(payload.due_date) || null,
      title: normalizeText(payload.title) || `Invoice for ${normalizeText(invoiceParty.name) || "client"}`,
      notes: normalizeText(payload.notes),
      sent_to_customer: false,
      sent_to_customer_at: null,
      components,
      total_amount_cents: totalAmountCents,
      due_amount_cents: dueAmountCents,
      created_at: now,
      updated_at: now
    };

    await writeInvoicePdf(invoice, invoiceParty, booking);
    store.invoices.push(invoice);
    booking.updated_at = now;
    await persistStore(store);
    sendJson(res, 201, { invoice: buildInvoiceReadModel(invoice), booking: await buildBookingPayload(booking) });
  }

  async function handlePatchBookingInvoice(req, res, [bookingId, invoiceId]) {
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
    const atpStaff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atpStaff);
    if (!canEditBooking(principal, booking, staffMember)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertMatchingBookingHash(payload, booking, res))) return;

    const invoice = store.invoices.find((item) => item.id === invoiceId && item.booking_id === bookingId);
    if (!invoice) {
      sendJson(res, 404, { error: "Invoice not found" });
      return;
    }

    const components = payload.components
      ? normalizeInvoiceComponents(payload.components)
      : Array.isArray(invoice.components)
        ? invoice.components
        : [];
    if (!components.length) {
      sendJson(res, 422, { error: "At least one invoice component is required" });
      return;
    }

    const invoiceParty = getInvoicePartyForBooking(booking);
    const isContentUpdate =
      payload.invoice_number !== undefined ||
      payload.currency !== undefined ||
      payload.issue_date !== undefined ||
      payload.due_date !== undefined ||
      payload.title !== undefined ||
      payload.notes !== undefined ||
      payload.components !== undefined ||
      payload.due_amount_cents !== undefined;

    if (payload.sent_to_customer !== undefined) {
      const sent = Boolean(payload.sent_to_customer);
      invoice.sent_to_customer = sent;
      invoice.sent_to_customer_at = sent ? invoice.sent_to_customer_at || nowIso() : null;
      if (invoice.status !== "PAID") {
        invoice.status = sent ? "INVOICE_SENT" : "DRAFT";
      }
    }

    if (isContentUpdate) {
      const totalAmountCents = computeInvoiceComponentTotal(components);
      const dueAmountCents = safeAmountCents(payload.due_amount_cents) ?? totalAmountCents;
      if (payload.invoice_number !== undefined) {
        invoice.invoice_number = normalizeText(payload.invoice_number) || invoice.invoice_number;
      }
      if (payload.currency !== undefined) {
        invoice.currency = safeCurrency(payload.currency || invoice.currency);
      }
      if (payload.issue_date !== undefined) {
        invoice.issue_date = normalizeText(payload.issue_date) || invoice.issue_date;
      }
      if (payload.due_date !== undefined) {
        invoice.due_date = normalizeText(payload.due_date) || null;
      }
      if (payload.title !== undefined) {
        invoice.title = normalizeText(payload.title) || invoice.title;
      }
      if (payload.notes !== undefined) {
        invoice.notes = normalizeText(payload.notes);
      }
      invoice.components = components;
      invoice.total_amount_cents = totalAmountCents;
      invoice.due_amount_cents = dueAmountCents;
      invoice.version = Number(invoice.version || 1) + 1;
      await writeInvoicePdf(invoice, invoiceParty, booking);
    }
    invoice.updated_at = nowIso();
    booking.updated_at = invoice.updated_at;

    await persistStore(store);
    sendJson(res, 200, { invoice: buildInvoiceReadModel(invoice), booking: await buildBookingPayload(booking) });
  }

  async function handleGetInvoicePdf(req, res, [invoiceId]) {
    const store = await readStore();
    const invoice = store.invoices.find((item) => item.id === invoiceId);
    if (!invoice) {
      sendJson(res, 404, { error: "Invoice not found" });
      return;
    }
    const booking = store.bookings.find((item) => item.id === invoice.booking_id) || null;
    const principal = getPrincipal(req);
    const atpStaff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atpStaff);
    if (!booking || !canAccessBooking(principal, booking, staffMember)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const invoiceParty = getInvoicePartyForBooking(booking);
    const pdfPath = invoicePdfPath(invoice.id, invoice.version);
    await writeInvoicePdf(invoice, invoiceParty, booking);
    res.setHeader("Content-Disposition", `inline; filename=\"${invoice.invoice_number || invoice.id}.pdf\"`);
    await sendFileWithCache(req, res, pdfPath, "private, max-age=0, no-store");
  }

  return {
    handleCreateBooking,
    handleListBookings,
    handleGetBooking,
    handleDeleteBooking,
    handleListBookingChatEvents,
    handlePatchBookingClient,
    handleCreateBookingCustomer,
    handleCreateBookingGroup,
    handleCreateBookingGroupMember,
    handlePatchBookingStage,
    handlePatchBookingOwner,
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
