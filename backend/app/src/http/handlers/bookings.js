export function createBookingHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    validateBookingInput,
    readStore,
    normalizeText,
    getRequestIpAddress,
    guessCountryFromRequest,
    findMatchingCustomer,
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

  const customerMatch = findMatchingCustomer(store.customers, payload);
  let customer;

  if (customerMatch) {
    customer = {
      ...customerMatch,
      name: normalizeText(payload.name) || customerMatch.name,
      email: normalizeEmail(payload.email) || customerMatch.email,
      phone: normalizePhone(payload.phone) || customerMatch.phone,
      language: normalizeText(payload.language) || customerMatch.language,
      updated_at: nowIso()
    };
    const idx = store.customers.findIndex((c) => c.id === customer.id);
    store.customers[idx] = customer;
  } else {
    customer = {
      id: `cust_${randomUUID()}`,
      name: normalizeText(payload.name),
      email: normalizeEmail(payload.email),
      phone: normalizePhone(payload.phone),
      language: normalizeText(payload.language) || "English",
      created_at: nowIso(),
      updated_at: nowIso(),
      tags: []
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
    destination: normalizeText(payload.destination),
    style: normalizeText(payload.style),
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
      tour_title: selectedTourTitle || null
    },
    idempotency_key: idempotencyKey || null,
    created_at: nowIso(),
    updated_at: nowIso()
  };

  store.bookings.push(booking);
  addActivity(store, booking.id, "BOOKING_CREATED", "public_api", "Booking created from website form");

  await persistStore(store);

  sendJson(res, 201, {
    booking_id: booking.id,
    booking_hash: computeBookingHash(booking),
    customer_id: customer.id,
    status: "accepted",
    deduplicated: Boolean(customerMatch),
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
  sendJson(res, 200, { booking: await buildBookingReadModel(booking), customer });
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
    if (channel === "whatsapp" && bookingCustomer?.phone) {
      return isLikelyPhoneMatch(bookingCustomer.phone, conversation.external_contact_id);
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

  const activity = addActivity(store, booking.id, type, actorLabel(principal, normalizeText(payload.actor) || "atp_staff"), detail);
  booking.updated_at = nowIso();
  await persistStore(store);

  sendJson(res, 201, { activity });
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
  await persistStore(store);
  sendJson(res, 201, { invoice: buildInvoiceReadModel(invoice) });
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

  await persistStore(store);
  sendJson(res, 200, { invoice: buildInvoiceReadModel(invoice) });
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
