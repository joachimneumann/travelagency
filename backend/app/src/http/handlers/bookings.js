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
    computeSlaDueAt,
    safeInt,
    defaultBookingPricing,
    defaultBookingOffer,
    addActivity,
    persistStore,
    computeBookingHash,
    computeCustomerHash,
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
    sendFileWithCache
  } = deps;

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

function upsertCandidate(candidateMap, customer, reason, confidence, score) {
  if (!customer?.id) return;
  const existing = candidateMap.get(customer.id) || {
    customer,
    reasons: [],
    confidence: "low",
    score: 0
  };
  if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
  existing.confidence = rankConfidence(existing.confidence, confidence);
  existing.score = Math.max(existing.score, score);
  candidateMap.set(customer.id, existing);
}

function summarizeCandidates(candidateMap) {
  return Array.from(candidateMap.values())
    .sort((left, right) => {
      const scoreDelta = right.score - left.score;
      if (scoreDelta !== 0) return scoreDelta;
      return String(right.customer.updated_at || right.customer.created_at || "").localeCompare(
        String(left.customer.updated_at || left.customer.created_at || "")
      );
    })
    .map((entry) => ({
      customer_id: entry.customer.id,
      confidence: entry.confidence,
      reasons: entry.reasons
    }));
}

function mergeMatchedCustomer(existingCustomer, payload, now, preferredLanguage, { normalizeEmail, normalizePhone }) {
  return {
    ...existingCustomer,
    name: String(existingCustomer.name || "").trim() || String(payload.name || "").trim(),
    email: normalizeEmail(existingCustomer.email) || normalizeEmail(payload.email) || null,
    phone_number: normalizePhone(existingCustomer.phone_number) || normalizePhone(payload.phone_number) || null,
    preferred_language: String(existingCustomer.preferred_language || "").trim() || preferredLanguage || null,
    updated_at: now
  };
}

function resolveCustomerForBookingSubmission(customers, payload, { normalizeEmail, isLikelyPhoneMatch }) {
  const submittedEmail = normalizeEmail(payload.email);
  const submittedPhoneRaw = payload.phone_number;
  const submittedName = normalizeNameForMatch(payload.name);
  const candidateMap = new Map();
  const exactPhoneMatches = [];
  const exactEmailMatches = [];

  for (const customer of Array.isArray(customers) ? customers : []) {
    const customerPhone = customer?.phone_number;
    const customerEmail = customer?.email;
    const customerName = customer?.name;
    const normalizedCustomerName = normalizeNameForMatch(customerName);

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
      namesLookSimilar(customerName, payload.name)
    );

    if (hasExactPhone) {
      exactPhoneMatches.push(customer);
      upsertCandidate(candidateMap, customer, "exact_phone", "high", 100);
    } else if (hasSimilarPhone) {
      upsertCandidate(candidateMap, customer, "similar_phone", "medium", 60);
    }

    if (hasExactEmail) {
      exactEmailMatches.push(customer);
      upsertCandidate(candidateMap, customer, "exact_email", "high", 90);
    }

    if (hasExactName && !hasExactPhone && !hasExactEmail) {
      upsertCandidate(candidateMap, customer, "exact_name", "low", 35);
    } else if (hasSimilarName && !hasExactPhone && !hasExactEmail) {
      upsertCandidate(candidateMap, customer, "similar_name", "low", 25);
    }
  }

  const exactEmailIds = new Set(exactEmailMatches.map((customer) => customer.id));
  const exactIntersection = exactPhoneMatches.filter((customer) => exactEmailIds.has(customer.id));

  if (exactIntersection.length === 1) {
    return {
      decision: "matched_existing_customer",
      confidence: "high",
      reason: "exact_phone_and_email",
      matchedCustomer: exactIntersection[0],
      duplicateCandidates: []
    };
  }

  if (exactPhoneMatches.length === 1 && (exactEmailMatches.length === 0 || exactEmailIds.has(exactPhoneMatches[0].id))) {
    return {
      decision: "matched_existing_customer",
      confidence: "high",
      reason: "exact_phone",
      matchedCustomer: exactPhoneMatches[0],
      duplicateCandidates: []
    };
  }

  if (exactEmailMatches.length === 1) {
    const emailMatch = exactEmailMatches[0];
    const submittedPhone = canonicalPhoneForMatch(submittedPhoneRaw);
    const existingPhone = canonicalPhoneForMatch(emailMatch.phone_number);
    if (!submittedPhone || !existingPhone || submittedPhone === existingPhone) {
      return {
        decision: "matched_existing_customer",
        confidence: "high",
        reason: "exact_email",
        matchedCustomer: emailMatch,
        duplicateCandidates: []
      };
    }
  }

  const duplicateCandidates = summarizeCandidates(candidateMap);
  if (duplicateCandidates.length) {
    return {
      decision: "created_new_customer_with_duplicate_candidate",
      confidence: duplicateCandidates[0].confidence,
      reason: duplicateCandidates[0].reasons[0] || "possible_duplicate",
      matchedCustomer: null,
      duplicateCandidates
    };
  }

  return {
    decision: "created_new_customer",
    confidence: "low",
    reason: "no_match",
    matchedCustomer: null,
    duplicateCandidates: []
  };
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
        customer_id: existingByKey.customer_id,
        status: "accepted",
        deduplicated: true,
        message: "Booking already captured with this idempotency key"
      });
      return;
    }
  }

  const customerResolution = resolveCustomerForBookingSubmission(store.customers, payload, {
    normalizeEmail,
    isLikelyPhoneMatch
  });
  const inputPhoneNumber = normalizePhone(payload.phone_number);
  const inputPreferredLanguage = normalizeText(payload.preferred_language) || "English";
  const now = nowIso();
  let customer;

  if (customerResolution.matchedCustomer) {
    customer = mergeMatchedCustomer(customerResolution.matchedCustomer, payload, now, inputPreferredLanguage, {
      normalizeEmail,
      normalizePhone
    });
    const idx = store.customers.findIndex((c) => c.id === customer.id);
    store.customers[idx] = customer;
  } else {
    customer = {
      id: `cust_${randomUUID()}`,
      name: normalizeText(payload.name),
      email: normalizeEmail(payload.email),
      phone_number: inputPhoneNumber,
      preferred_language: inputPreferredLanguage,
      created_at: now,
      updated_at: now
    };
    store.customers.push(customer);
  }

  const preferredCurrency = safeCurrency(payload.preferredCurrency || payload.preferred_currency || BASE_CURRENCY);
  const selectedTourId = normalizeText(payload.tourId || payload.tour_id);
  const selectedTourTitle = normalizeText(payload.tourTitle || payload.tour_title);

  const booking = {
    id: `booking_${randomUUID()}`,
    customer_id: customer.id,
    stage: STAGES.NEW,
    atp_staff: null,
    atp_staff_name: null,
    owner_id: null,
    owner_name: null,
    sla_due_at: computeSlaDueAt(STAGES.NEW),
    destination: normalizeStringArray(payload.destination),
    style: normalizeStringArray(payload.style),
    travel_month: normalizeText(payload.travelMonth),
    travelers: safeInt(payload.travelers),
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
      submitted_preferred_language: inputPreferredLanguage || null,
      customer_resolution: {
        decision: customerResolution.decision,
        confidence: customerResolution.confidence,
        reason: customerResolution.reason,
        matched_customer_id: customerResolution.matchedCustomer?.id || null,
        duplicate_candidate_customer_ids: customerResolution.duplicateCandidates.map((candidate) => candidate.customer_id),
        duplicate_candidates: customerResolution.duplicateCandidates
      }
    },
    idempotency_key: idempotencyKey || null,
    created_at: now,
    updated_at: now
  };

  store.bookings.push(booking);
  addActivity(store, booking.id, "BOOKING_CREATED", "public_api", "Booking created from website form");
  if (customerResolution.decision === "created_new_customer_with_duplicate_candidate") {
    addActivity(
      store,
      booking.id,
      "CUSTOMER_DUPLICATE_REVIEW",
      "public_api",
      `Possible existing customers: ${customerResolution.duplicateCandidates.map((candidate) => candidate.customer_id).join(", ")}`
    );
  }

  await persistStore(store);

  sendJson(res, 201, {
    booking_id: booking.id,
    booking_hash: computeBookingHash(booking),
    customer_id: customer.id,
    status: "accepted",
    deduplicated: customerResolution.decision === "matched_existing_customer",
    atp_staff: booking.atp_staff_name,
    sla_due_at: booking.sla_due_at,
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
      .map(async (booking) => buildBookingReadModel(booking))
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

  const customer = store.customers.find((item) => item.id === booking.customer_id) || null;
  sendJson(res, 200, { booking: await buildBookingReadModel(booking), customer: buildCustomerReadModel(customer) });
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
  const bookingCustomer = store.customers.find((item) => item.id === booking.customer_id) || null;
  const requestUrl = new URL(req.url, "http://localhost");
  const limit = clamp(safeInt(requestUrl.searchParams.get("limit")) || 100, 1, 500);

  const conversationItems = store.chat_conversations.filter((conversation) => {
    if (normalizeText(conversation.booking_id) === bookingId) return true;
    if (normalizeText(conversation.customer_id) === normalizeText(booking.customer_id)) return true;

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
        customer_id: conversation.customer_id || null,
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
  booking.sla_due_at = computeSlaDueAt(nextStage);
  booking.updated_at = nowIso();

  addActivity(store, booking.id, "STAGE_CHANGED", actorLabel(principal, normalizeText(payload.actor) || "atp_staff"), `Stage updated to ${nextStage}`);
  await persistStore(store);

  sendJson(res, 200, { booking: await buildBookingReadModel(booking) });
}

async function handlePatchBookingOwner(req, res, [bookingId]) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const ownerIdRaw = normalizeText(payload.owner_id);
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

  if (!ownerIdRaw) {
    booking.atp_staff = null;
    booking.atp_staff_name = null;
    syncBookingAtpStaffFields(booking);
    booking.updated_at = nowIso();
    addActivity(store, booking.id, "STAFF_CHANGED", actorLabel(principal, "atp_staff"), "AtpStaff unassigned");
    await persistStore(store);
    sendJson(res, 200, { booking: await buildBookingReadModel(booking) });
    return;
  }

  const atp_staff = await loadAtpStaff();
  const owner = atp_staff.find((member) => member.id === ownerIdRaw && member.active);
  if (!owner) {
    sendJson(res, 422, { error: "AtpStaff member not found or inactive" });
    return;
  }

  booking.atp_staff = owner.id;
  booking.atp_staff_name = owner.name;
  syncBookingAtpStaffFields(booking);
  booking.updated_at = nowIso();
  addActivity(store, booking.id, "STAFF_CHANGED", actorLabel(principal, "atp_staff"), `AtpStaff set to ${owner.name}`);
  await persistStore(store);

  sendJson(res, 200, { booking: await buildBookingReadModel(booking) });
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
    sendJson(res, 200, { booking: await buildBookingReadModel(booking), unchanged: true });
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

  sendJson(res, 200, { booking: await buildBookingReadModel(booking) });
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
    sendJson(res, 200, { booking: await buildBookingReadModel(booking), unchanged: true });
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

  sendJson(res, 200, { booking: await buildBookingReadModel(booking) });
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
    sendJson(res, 200, { booking: await buildBookingReadModel(booking), unchanged: true });
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

  sendJson(res, 200, { booking: await buildBookingReadModel(booking) });
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

  sendJson(res, 201, { activity, booking: await buildBookingReadModel(booking) });
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
  const customer = store.customers.find((item) => item.id === booking.customer_id);
  if (!customer) {
    sendJson(res, 422, { error: "Booking customer not found" });
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
    customer_id: customer.id,
    invoice_number: normalizeText(payload.invoice_number) || nextInvoiceNumber(store),
    version: 1,
    status: "DRAFT",
    currency: safeCurrency(payload.currency),
    issue_date: normalizeText(payload.issue_date) || now.slice(0, 10),
    due_date: normalizeText(payload.due_date) || null,
    title: normalizeText(payload.title) || `Invoice for ${normalizeText(customer.name) || "customer"}`,
    notes: normalizeText(payload.notes),
    sent_to_customer: false,
    sent_to_customer_at: null,
    components,
    total_amount_cents: totalAmountCents,
    due_amount_cents: dueAmountCents,
    created_at: now,
    updated_at: now
  };

  await writeInvoicePdf(invoice, customer, booking);
  store.invoices.push(invoice);
  booking.updated_at = now;
  await persistStore(store);
  sendJson(res, 201, { invoice: buildInvoiceReadModel(invoice), booking: await buildBookingReadModel(booking) });
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
  const customer = store.customers.find((item) => item.id === booking.customer_id);
  if (!customer) {
    sendJson(res, 422, { error: "Booking customer not found" });
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
    await writeInvoicePdf(invoice, customer, booking);
  }
  invoice.updated_at = nowIso();
  booking.updated_at = invoice.updated_at;

  await persistStore(store);
  sendJson(res, 200, { invoice: buildInvoiceReadModel(invoice), booking: await buildBookingReadModel(booking) });
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
  const customer = store.customers.find((item) => item.id === invoice.customer_id) || null;
  const pdfPath = invoicePdfPath(invoice.id, invoice.version);
  // Always regenerate so PDF styling/content updates are reflected immediately.
  await writeInvoicePdf(invoice, customer, booking);
  res.setHeader("Content-Disposition", `inline; filename=\"${invoice.invoice_number || invoice.id}.pdf\"`);
  await sendFileWithCache(req, res, pdfPath, "private, max-age=0, no-store");
}


  return {
    handleCreateBooking,
    handleListBookings,
    handleGetBooking,
    handleListBookingChatEvents,
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
