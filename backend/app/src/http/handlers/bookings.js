import { canonicalPhoneForMatch, normalizePhoneDigits } from "../../domain/phone_matching.js";

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
    computeClientHash,
    computeCustomerHash,
    computeTravelGroupHash,
    getPrincipal,
    loadAtpStaff,
    resolvePrincipalAtpStaffMember,
    canReadAllBookings,
    filterAndSortBookings,
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

function buildClientReadModel(client, customer = null, group = null, groupContactCustomer = null) {
  if (!client) return null;
  return {
    ...client,
    client_hash: computeClientHash(client),
    display_name: normalizeText(customer?.name || group?.group_name) || "",
    primary_email: normalizeEmail(customer?.email || groupContactCustomer?.email) || null,
    primary_phone_number: normalizePhone(customer?.phone_number || groupContactCustomer?.phone_number) || null
  };
}

function buildCustomerReadModel(customer) {
  if (!customer) return null;
  return {
    ...customer,
    customer_hash: computeCustomerHash(customer),
    name: normalizeText(customer.name) || "",
    title: normalizeText(customer.title) || null,
    email: normalizeEmail(customer.email) || null,
    phone_number: normalizePhone(customer.phone_number) || null,
    preferred_language: normalizeText(customer.preferred_language) || null
  };
}

function normalizeNameForMatch(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactNameForMatch(value) {
  return normalizeNameForMatch(value).replace(/\s+/g, "");
}

function levenshteinDistance(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  if (!a) return b.length;
  if (!b) return a.length;
  const costs = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = costs[0];
    costs[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = costs[j];
      if (a[i - 1] === b[j - 1]) {
        costs[j] = diagonal;
      } else {
        costs[j] = Math.min(costs[j] + 1, costs[j - 1] + 1, diagonal + 1);
      }
      diagonal = current;
    }
  }
  return costs[b.length];
}

function namesLookSimilar(left, right) {
  const normalizedLeft = normalizeNameForMatch(left);
  const normalizedRight = normalizeNameForMatch(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const leftTokens = normalizedLeft.split(" ").filter(Boolean);
  const rightTokens = normalizedRight.split(" ").filter(Boolean);
  if (leftTokens.length && rightTokens.length) {
    const sortedLeft = [...leftTokens].sort().join(" ");
    const sortedRight = [...rightTokens].sort().join(" ");
    if (sortedLeft === sortedRight) return true;
  }

  const compactLeft = compactNameForMatch(left);
  const compactRight = compactNameForMatch(right);
  if (!compactLeft || !compactRight) return false;

  const maxLength = Math.max(compactLeft.length, compactRight.length);
  if (maxLength < 4) return false;
  const threshold = maxLength <= 8 ? 1 : 2;
  return levenshteinDistance(compactLeft, compactRight) <= threshold;
}

function exactPhoneMatch(left, right) {
  const leftCanonical = canonicalPhoneForMatch(left);
  const rightCanonical = canonicalPhoneForMatch(right);
  if (leftCanonical && rightCanonical && leftCanonical === rightCanonical) {
    return true;
  }
  const leftDigits = normalizePhoneDigits(left);
  const rightDigits = normalizePhoneDigits(right);
  return Boolean(leftDigits && rightDigits && leftDigits === rightDigits);
}

function rankConfidence(current, next) {
  const weights = { low: 1, medium: 2, high: 3 };
  return (weights[next] || 0) > (weights[current] || 0) ? next : current;
}

function buildSubmittedCustomer(booking) {
  return {
    name: normalizeText(booking?.source?.submitted_name) || null,
    email: normalizeEmail(booking?.source?.submitted_email) || null,
    phone_number: normalizePhone(booking?.source?.submitted_phone_number) || null
  };
}

function rankCustomerCandidatesForBookingSubmission(customers, submitted, { normalizeEmail, isLikelyPhoneMatch }) {
  const submittedEmail = normalizeEmail(submitted?.email);
  const submittedPhoneRaw = submitted?.phone_number;
  const submittedName = normalizeNameForMatch(submitted?.name);
  const entries = Array.isArray(customers)
    ? customers.map((customer) => {
        const customerPhone = customer?.phone_number;
        const customerEmail = customer?.email;
        const customerName = customer?.name;
        const normalizedCustomerName = normalizeNameForMatch(customerName);
        const reasons = [];
        let confidence = "low";
        let score = 0;

        const hasExactPhone = Boolean(submittedPhoneRaw && customerPhone && exactPhoneMatch(customerPhone, submittedPhoneRaw));
        const hasExactEmail = Boolean(submittedEmail && customerEmail && normalizeEmail(customerEmail) === submittedEmail);
        const hasSimilarPhone = Boolean(
          submittedPhoneRaw &&
          customerPhone &&
          !hasExactPhone &&
          isLikelyPhoneMatch(customerPhone, submittedPhoneRaw)
        );
        const hasExactName = Boolean(submittedName && normalizedCustomerName && normalizedCustomerName === submittedName);
        const hasSimilarName = Boolean(
          submittedName &&
          normalizedCustomerName &&
          !hasExactName &&
          namesLookSimilar(customerName, submitted?.name)
        );

        if (hasExactPhone) {
          reasons.push("exact_phone");
          confidence = rankConfidence(confidence, "high");
          score += 120;
        } else if (hasSimilarPhone) {
          reasons.push("similar_phone");
          confidence = rankConfidence(confidence, "medium");
          score += 60;
        }

        if (hasExactEmail) {
          reasons.push("exact_email");
          confidence = rankConfidence(confidence, "high");
          score += 100;
        }

        if (hasExactName) {
          reasons.push("exact_name");
          confidence = rankConfidence(confidence, "low");
          score += hasExactPhone || hasExactEmail ? 30 : 18;
        } else if (hasSimilarName) {
          reasons.push("similar_name");
          confidence = rankConfidence(confidence, "low");
          score += 8;
        }

        return {
          customer,
          confidence,
          reasons,
          score
        };
      })
    : [];

  return entries
    .sort((left, right) => {
      const scoreDelta = right.score - left.score;
      if (scoreDelta !== 0) return scoreDelta;
      return String(right.customer.updated_at || right.customer.created_at || "").localeCompare(
        String(left.customer.updated_at || left.customer.created_at || "")
      );
    })
    .slice(0, 10)
    .map((entry) => ({
      customer_client_id: entry.customer.client_id,
      name: normalizeText(entry.customer.name) || "",
      email: normalizeEmail(entry.customer.email) || null,
      phone_number: normalizePhone(entry.customer.phone_number) || null,
      confidence: entry.score > 0 ? entry.confidence : null,
      reasons: entry.reasons
    }));
}

function resolveBookingClientContext(store, booking) {
  const client = (store.clients || []).find((item) => item.id === booking.client_id) || null;
  const customer = (store.customers || []).find((item) => item.client_id === booking.client_id) || null;
  const travelGroup = (store.travel_groups || []).find((item) => item.client_id === booking.client_id) || null;
  const groupContactCustomer = travelGroup
    ? (store.customers || []).find((item) => item.client_id === travelGroup.group_contact_customer_id) || null
    : null;
  return { client, customer, travelGroup, groupContactCustomer };
}

function syncBookingClientFields(store, booking) {
  const { client, customer, travelGroup, groupContactCustomer } = resolveBookingClientContext(store, booking);
  booking.client_type = client?.client_type || booking.client_type || null;
  booking.client_display_name = travelGroup?.group_name || customer?.name || booking.client_display_name || "";
  booking.client_primary_phone_number = customer?.phone_number || groupContactCustomer?.phone_number || booking.client_primary_phone_number || null;
  booking.client_primary_email = customer?.email || groupContactCustomer?.email || booking.client_primary_email || null;
}

function membersForTravelGroup(travelGroup) {
  return (Array.isArray(travelGroup?.traveler_customer_ids) ? travelGroup.traveler_customer_ids : []).map((customerClientId, index) => ({
    id: `travel_group_member_${travelGroup.id}_${index + 1}`,
    travel_group_id: travelGroup.id,
    customer_client_id: customerClientId
  }));
}

function buildTravelGroupPayload(store, travelGroup) {
  const members = membersForTravelGroup(travelGroup);
  const customerIds = new Set(members.map((member) => member.customer_client_id).filter(Boolean));
  const memberCustomers = (store.customers || []).filter((customer) => customerIds.has(customer.client_id));
  return { travelGroup, members, memberCustomers };
}

function ensureTravelGroupForBooking(store, booking, { randomUUID, nowIso, computeClientHash, computeTravelGroupHash }) {
  let { client, customer, travelGroup } = resolveBookingClientContext(store, booking);
  if (travelGroup && client) return { client, travelGroup, leadCustomer: customer };

  const createdAt = nowIso();
  client = {
    id: `client_${randomUUID()}`,
    client_type: "travel_group"
  };
  client.client_hash = computeClientHash(client);
  travelGroup = {
    id: `group_${randomUUID()}`,
    client_id: client.id,
    group_name: normalizeText(booking.client_display_name || customer?.name) || "Travel group",
    group_contact_customer_id: customer?.client_id || null,
    traveler_customer_ids: customer?.client_id ? [customer.client_id] : [],
    created_at: createdAt,
    updated_at: createdAt,
    archived_at: null
  };
  if (!Array.isArray(store.clients)) store.clients = [];
  if (!Array.isArray(store.travel_groups)) store.travel_groups = [];
  store.clients.push(client);
  store.travel_groups.push(travelGroup);
  travelGroup.travel_group_hash = computeTravelGroupHash(travelGroup);
  booking.client_id = client.id;
  syncBookingClientFields(store, booking);
  return { client, travelGroup, leadCustomer: customer };
}

async function buildBookingClientResponse(store, booking) {
  const { client, customer, travelGroup, groupContactCustomer } = resolveBookingClientContext(store, booking);
  const submittedCustomer = buildSubmittedCustomer(booking);
  const response = {
    booking: await buildBookingResponse(store, booking),
    client: buildClientReadModel(client, customer, travelGroup, groupContactCustomer),
    customer: buildCustomerReadModel(customer),
    travelGroup: travelGroup || null,
    submittedCustomer,
    customerCandidates: rankCustomerCandidatesForBookingSubmission(store.customers, submittedCustomer, {
      normalizeEmail,
      isLikelyPhoneMatch
    })
  };
  if (travelGroup) {
    const payloadGroup = buildTravelGroupPayload(store, travelGroup);
    response.members = payloadGroup.members;
    response.memberCustomers = payloadGroup.memberCustomers;
  }
  return response;
}

async function buildBookingResponse(store, booking) {
  const response = await buildBookingReadModel(booking);
  const { travelGroup } = resolveBookingClientContext(store, booking);
  response.travel_group_id = travelGroup?.id || null;
  return response;
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
        // Ignore cleanup failures so the booking delete is not blocked by a stale PDF file.
      }
    })
  );
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
  const ipAddress = getRequestIpAddress(req);
  const ipCountryGuess = guessCountryFromRequest(req, ipAddress);

  if (idempotencyKey) {
    const existingByKey = store.bookings.find((booking) => booking.idempotency_key === idempotencyKey);
    if (existingByKey) {
      sendJson(res, 200, {
        booking_id: existingByKey.id,
        client_id: existingByKey.client_id,
        status: "accepted",
        deduplicated: true,
        message: "Booking already captured with this idempotency key"
      });
      return;
    }
  }

  const inputPhoneNumber = normalizePhone(payload.phone_number);
  const inputPreferredLanguage = normalizeText(payload.preferred_language) || "English";
  const now = nowIso();

  const preferredCurrency = safeCurrency(payload.preferredCurrency || payload.preferred_currency || BASE_CURRENCY);
  const selectedTourId = normalizeText(payload.tourId || payload.tour_id);
  const selectedTourTitle = normalizeText(payload.tourTitle || payload.tour_title);

  const booking = {
    id: `booking_${randomUUID()}`,
    client_id: null,
    client_type: null,
    client_display_name: "",
    client_primary_phone_number: null,
    client_primary_email: null,
    stage: STAGES.NEW,
    atp_staff: null,
    atp_staff_name: null,
    service_level_agreement_due_at: computeServiceLevelAgreementDueAt(STAGES.NEW),
    destination: normalizeStringArray(payload.destination),
    style: normalizeStringArray(payload.style),
    travel_month: normalizeText(payload.travelMonth),
    number_of_travelers: normalizeText(payload.number_of_travelers) ? safeInt(payload.number_of_travelers) : null,
    duration: normalizeText(payload.duration),
    budget: normalizeText(payload.budget),
    preferred_currency: preferredCurrency,
    notes: normalizeText(payload.notes),
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
      tour_id: selectedTourId || null,
      tour_title: selectedTourTitle || null,
      submitted_name: normalizeText(payload.name) || null,
      submitted_email: normalizeEmail(payload.email) || null,
      submitted_phone_number: inputPhoneNumber || null,
      submitted_preferred_language: inputPreferredLanguage || null
    },
    idempotency_key: idempotencyKey || null,
    created_at: now,
    updated_at: now
  };

  store.bookings.push(booking);
  addActivity(store, booking.id, "BOOKING_CREATED", "public_api", "Booking created from website form");
  addActivity(store, booking.id, "CLIENT_UNASSIGNED", "public_api", "Booking created without assigned client");

  await persistStore(store);

  sendJson(res, 201, {
    booking_id: booking.id,
    booking_hash: computeBookingHash(booking),
    client_id: null,
    status: "accepted",
    deduplicated: false,
    atp_staff: booking.atp_staff,
    atp_staff_name: booking.atp_staff_name,
    service_level_agreement_due_at: booking.service_level_agreement_due_at,
    next_step_message: "Thanks, we will contact you with route options within 48-72h."
  });
}

async function handleListBookings(req, res) {
  const store = await readStore();
  const principal = getPrincipal(req);
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
  if (!canReadAllBookings(principal) && !staffMember) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  const requestUrl = new URL(req.url, "http://localhost");
  const { items: filtered, filters, sort } = filterAndSortBookings(store, requestUrl.searchParams);
  const visible = await Promise.all(
    filtered
      .filter((booking) => canAccessBooking(principal, booking, staffMember))
      .map(async (booking) => buildBookingResponse(store, booking))
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
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
  if (!canAccessBooking(principal, booking, staffMember)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  sendJson(res, 200, await buildBookingClientResponse(store, booking));
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
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
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
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
  if (!canAccessBooking(principal, booking, staffMember)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  ensureMetaChatCollections(store);
  const bookingCustomer = (store.customers || []).find((item) => item.client_id === booking.client_id) || null;
  const requestUrl = new URL(req.url, "http://localhost");
  const limit = clamp(safeInt(requestUrl.searchParams.get("limit")) || 100, 1, 500);

  const conversationItems = store.chat_conversations.filter((conversation) => {
    if (normalizeText(conversation.booking_id) === bookingId) return true;
    if (normalizeText(conversation.client_id) === normalizeText(booking.client_id)) return true;

    const channel = normalizeText(conversation.channel).toLowerCase();
    if (channel === "whatsapp" && bookingCustomer?.phone_number) {
      return isLikelyPhoneMatch(bookingCustomer.phone_number, conversation.external_contact_id);
    }
    return false;
  });
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
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
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

  sendJson(res, 200, { booking: await buildBookingResponse(store, booking) });
}

async function handlePatchBookingClient(req, res, [bookingId]) {
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
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
  if (!canEditBooking(principal, booking, staffMember)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  if (!(await assertMatchingBookingHash(payload, booking, res))) return;

  const customerClientId = normalizeText(payload.customer_client_id);
  const travelGroupId = normalizeText(payload.travel_group_id);
  const clientLookupId = normalizeText(payload.client_lookup_id);

  if ([customerClientId, travelGroupId, clientLookupId].filter(Boolean).length > 1) {
    sendJson(res, 422, { error: "Provide only one of customer_client_id, travel_group_id, or client_lookup_id" });
    return;
  }

  const resolvedCustomerClientId = clientLookupId
    ? normalizeText((store.customers || []).find((item) => item.client_id === clientLookupId)?.client_id)
    : customerClientId;
  const resolvedTravelGroupId = clientLookupId
    ? normalizeText((store.travel_groups || []).find((item) => item.id === clientLookupId || item.client_id === clientLookupId)?.id)
    : travelGroupId;

  if (resolvedCustomerClientId) {
    const customer = (store.customers || []).find((item) => item.client_id === resolvedCustomerClientId);
    const client = (store.clients || []).find((item) => item.id === resolvedCustomerClientId && item.client_type === "customer");
    if (!customer || !client) {
      sendJson(res, 422, { error: "Customer client not found" });
      return;
    }
    booking.client_id = resolvedCustomerClientId;
    booking.updated_at = nowIso();
    syncBookingClientFields(store, booking);
    addActivity(store, booking.id, "CLIENT_ASSIGNED", actorLabel(principal, "atp_staff"), `Assigned to customer ${customer.name}`);
    await persistStore(store);
    sendJson(res, 200, await buildBookingClientResponse(store, booking));
    return;
  }

  if (!resolvedTravelGroupId) {
    sendJson(res, 422, { error: "customer_client_id, travel_group_id, or client_lookup_id is required" });
    return;
  }

  const travelGroup = (store.travel_groups || []).find((item) => item.id === resolvedTravelGroupId);
  const client = travelGroup
    ? (store.clients || []).find((item) => item.id === travelGroup.client_id && item.client_type === "travel_group")
    : null;
  if (!travelGroup || !client) {
    sendJson(res, 422, { error: "Travel group not found" });
    return;
  }
  booking.client_id = client.id;
  booking.updated_at = nowIso();
  syncBookingClientFields(store, booking);
  addActivity(store, booking.id, "CLIENT_ASSIGNED", actorLabel(principal, "atp_staff"), `Assigned to travel group ${travelGroup.group_name}`);
  await persistStore(store);
  sendJson(res, 200, await buildBookingClientResponse(store, booking));
}

async function handleCreateBookingCustomer(req, res, [bookingId]) {
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
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
  if (!canEditBooking(principal, booking, staffMember)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  if (!(await assertMatchingBookingHash(payload, booking, res))) return;

  const submittedCustomer = buildSubmittedCustomer(booking);
  const customerName = normalizeText(submittedCustomer.name);
  if (!customerName) {
    sendJson(res, 422, { error: "Submitted customer name is missing" });
    return;
  }

  const createdAt = nowIso();
  const customerClient = {
    id: `client_${randomUUID()}`,
    client_type: "customer"
  };
  customerClient.client_hash = computeClientHash(customerClient);
  const customer = {
    client_id: customerClient.id,
    name: customerName,
    email: normalizeEmail(submittedCustomer.email) || null,
    phone_number: normalizePhone(submittedCustomer.phone_number) || null,
    preferred_language: normalizeText(booking?.source?.submitted_preferred_language) || null,
    created_at: createdAt,
    updated_at: createdAt
  };
  customer.customer_hash = computeCustomerHash(customer);

  if (!Array.isArray(store.clients)) store.clients = [];
  if (!Array.isArray(store.customers)) store.customers = [];
  store.clients.push(customerClient);
  store.customers.push(customer);
  booking.client_id = customerClient.id;
  booking.updated_at = createdAt;
  syncBookingClientFields(store, booking);
  addActivity(store, booking.id, "CLIENT_ASSIGNED", actorLabel(principal, "atp_staff"), `Created and assigned customer ${customer.name}`);
  await persistStore(store);
  sendJson(res, 201, await buildBookingClientResponse(store, booking));
}

async function handleCreateBookingGroupMember(req, res, [bookingId]) {
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
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
  if (!canEditBooking(principal, booking, staffMember)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  if (!(await assertMatchingBookingHash(payload, booking, res))) return;

  const { client, travelGroup } = ensureTravelGroupForBooking(store, booking, {
    randomUUID,
    nowIso,
    computeClientHash,
    computeTravelGroupHash
  });

  const customerName = normalizeText(payload.name);
  if (!customerName) {
    sendJson(res, 422, { error: "name is required" });
    return;
  }
  const createdAt = nowIso();
  const customerClient = {
    id: `client_${randomUUID()}`,
    client_type: "customer"
  };
  customerClient.client_hash = computeClientHash(customerClient);
  const customer = {
    client_id: customerClient.id,
    name: customerName,
    email: normalizeEmail(payload.email) || null,
    phone_number: normalizePhone(payload.phone_number) || null,
    preferred_language: normalizeText(payload.preferred_language) || null,
    notes: normalizeText(payload.notes) || null,
    created_at: createdAt,
    updated_at: createdAt
  };
  customer.customer_hash = computeCustomerHash(customer);

  store.clients.push(customerClient);
  store.customers.push(customer);
  const travelerCustomerIds = Array.isArray(travelGroup.traveler_customer_ids) ? [...travelGroup.traveler_customer_ids] : [];
  if (payload.is_traveling !== false && !travelerCustomerIds.includes(customer.client_id)) {
    travelerCustomerIds.push(customer.client_id);
  }
  travelGroup.traveler_customer_ids = travelerCustomerIds;
  if (!travelGroup.group_contact_customer_id) {
    travelGroup.group_contact_customer_id = customer.client_id;
  }
  travelGroup.updated_at = createdAt;
  travelGroup.travel_group_hash = computeTravelGroupHash(travelGroup);
  booking.updated_at = createdAt;
  syncBookingClientFields(store, booking);
  await persistStore(store);

  const payloadGroup = buildTravelGroupPayload(store, travelGroup);
  sendJson(res, 201, {
    booking: await buildBookingResponse(store, booking),
    client: buildClientReadModel(client, null, travelGroup, customer),
    customer: null,
    travelGroup,
    ...payloadGroup
  });
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
    sendJson(res, 200, { booking: await buildBookingResponse(store, booking) });
    return;
  }

  const atp_staff = await loadAtpStaff();
  const assignedStaff = atp_staff.find((member) => member.id === atpStaffIdRaw && member.active);
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

  sendJson(res, 200, { booking: await buildBookingResponse(store, booking) });
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
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
  if (!canEditBooking(principal, booking, staffMember)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  if (!(await assertMatchingBookingHash(payload, booking, res))) return;

  const nextNotes = normalizeText(payload.notes);
  const currentNotes = normalizeText(booking.notes);

  if (nextNotes === currentNotes) {
    sendJson(res, 200, { booking: await buildBookingResponse(store, booking), unchanged: true });
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

  sendJson(res, 200, { booking: await buildBookingResponse(store, booking) });
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
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
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
    sendJson(res, 200, { booking: await buildBookingResponse(store, booking), unchanged: true });
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

  sendJson(res, 200, { booking: await buildBookingResponse(store, booking) });
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
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
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
    sendJson(res, 200, { booking: await buildBookingResponse(store, booking), unchanged: true });
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

  sendJson(res, 200, { booking: await buildBookingResponse(store, booking) });
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
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
  if (!canAccessBooking(principal, booking, staffMember)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  const items = store.activities
    .filter((activity) => activity.booking_id === bookingId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

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
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
  if (!canEditBooking(principal, booking, staffMember)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  if (!(await assertMatchingBookingHash(payload, booking, res))) return;

  const activity = addActivity(store, booking.id, type, actorLabel(principal, normalizeText(payload.actor) || "atp_staff"), detail);
  booking.updated_at = nowIso();
  await persistStore(store);

  sendJson(res, 201, { activity, booking: await buildBookingResponse(store, booking) });
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

async function handleListBookingInvoices(req, res, [bookingId]) {
  const store = await readStore();
  const booking = store.bookings.find((item) => item.id === bookingId);
  if (!booking) {
    sendJson(res, 404, { error: "Booking not found" });
    return;
  }
  const principal = getPrincipal(req);
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
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
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
  if (!canEditBooking(principal, booking, staffMember)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  if (!(await assertMatchingBookingHash(payload, booking, res))) return;
  const { client, customer, travelGroup } = resolveBookingClientContext(store, booking);
  const invoiceParty = customer || {
    name: travelGroup?.group_name || booking.client_display_name || "client",
    email: booking.client_primary_email || null,
    phone_number: booking.client_primary_phone_number || null
  };
  if (!client) {
    sendJson(res, 422, { error: "Booking client not found" });
    return;
  }

  const components = normalizeInvoiceComponents(payload.components);
  if (!components.length) {
    sendJson(res, 422, { error: "At least one invoice component is required" });
    return;
  }

  const now = nowIso();
  const totalAmountCents = computeInvoiceComponentTotal(components);
  const dueAmountCents = safeAmountCents(payload.due_amount_cents) ?? totalAmountCents;
  const invoice = {
    id: `inv_${randomUUID()}`,
    booking_id: bookingId,
    client_id: client.id,
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
  sendJson(res, 201, { invoice: buildInvoiceReadModel(invoice), booking: await buildBookingResponse(store, booking) });
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
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
  if (!canEditBooking(principal, booking, staffMember)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  if (!(await assertMatchingBookingHash(payload, booking, res))) return;
  const { client, customer, travelGroup } = resolveBookingClientContext(store, booking);
  const invoiceParty = customer || {
    name: travelGroup?.group_name || booking.client_display_name || "client",
    email: booking.client_primary_email || null,
    phone_number: booking.client_primary_phone_number || null
  };
  if (!client) {
    sendJson(res, 422, { error: "Booking client not found" });
    return;
  }
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
  sendJson(res, 200, { invoice: buildInvoiceReadModel(invoice), booking: await buildBookingResponse(store, booking) });
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
  const atp_staff = await loadAtpStaff();
  const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
  if (!booking || !canAccessBooking(principal, booking, staffMember)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  const bookingContext = booking ? resolveBookingClientContext(store, booking) : { customer: null, travelGroup: null };
  const invoiceParty = bookingContext.customer || {
    name: bookingContext.travelGroup?.group_name || booking?.client_display_name || "client",
    email: booking?.client_primary_email || null,
    phone_number: booking?.client_primary_phone_number || null
  };
  const pdfPath = invoicePdfPath(invoice.id, invoice.version);
  // Always regenerate so PDF styling/content updates are reflected immediately.
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
