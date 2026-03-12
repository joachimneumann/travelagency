export function createBookingCoreHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    getPrincipal,
    canEditBooking,
    canChangeBookingStage,
    canChangeBookingAssignment,
    canAccessBooking,
    normalizeText,
    nowIso,
    safeInt,
    STAGE_ORDER,
    ALLOWED_STAGE_TRANSITIONS,
    STAGES,
    computeServiceLevelAgreementDueAt,
    addActivity,
    actorLabel,
    persistStore,
    listAssignableKeycloakUsers,
    keycloakDisplayName,
    syncBookingAssignmentFields,
    assertExpectedRevision,
    buildBookingDetailResponse,
    buildBookingPayload,
    incrementBookingRevision
  } = deps;

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
    handlePatchBookingStage,
    handlePatchBookingName,
    handlePatchBookingOwner,
    handlePatchBookingNotes,
    handleListActivities,
    handleCreateActivity
  };
}
