import {
  getBookingPersons,
  normalizeSingleBookingPersonPayload
} from "../../lib/booking_persons.js";

export function createBookingPeopleHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    getPrincipal,
    canEditBooking,
    normalizeText,
    nowIso,
    addActivity,
    actorLabel,
    persistStore,
    assertExpectedRevision,
    buildBookingDetailResponse,
    incrementBookingRevision
  } = deps;

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

  return {
    handleCreateBookingPerson,
    handlePatchBookingPerson,
    handleDeleteBookingPerson
  };
}
