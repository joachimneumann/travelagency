export function createBookingMediaHandlers(deps) {
  const {
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
  } = deps;

  async function handlePublicBookingPersonPhoto(req, res, [rawRelativePath]) {
    const absolutePath = resolveBookingPersonPhotoDiskPath(rawRelativePath);
    if (!absolutePath) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    await sendFileWithCache(req, res, absolutePath, "public, max-age=31536000, immutable");
  }

  async function handlePublicBookingImage(req, res, [rawRelativePath]) {
    const absolutePath = resolveBookingImageDiskPath(rawRelativePath);
    if (!absolutePath) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    await sendFileWithCache(req, res, absolutePath, "public, max-age=31536000, immutable");
  }

  async function handleUploadBookingImage(req, res, [bookingId]) {
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
    if (!(await assertExpectedRevision(req, payload, booking, "expected_core_revision", "core_revision", res))) return;

    const filename = normalizeText(payload.filename) || `${bookingId}.upload`;
    const base64 = normalizeText(payload.data_base64);
    if (!base64) {
      sendJson(res, 422, { error: "data_base64 is required" });
      return;
    }

    const sourceBuffer = Buffer.from(base64, "base64");
    if (!sourceBuffer.length) {
      sendJson(res, 422, { error: "Invalid base64 image payload" });
      return;
    }

    const tempInputPath = path.join(TEMP_UPLOAD_DIR, `${bookingId}-${randomUUID()}${path.extname(filename) || ".upload"}`);
    const outputName = `${bookingId}-${Date.now()}.webp`;
    const outputRelativePath = `${bookingId}/${outputName}`;
    const outputPath = path.join(BOOKING_IMAGES_DIR, outputRelativePath);

    try {
      await writeFile(tempInputPath, sourceBuffer);
      await processBookingImageToWebp(tempInputPath, outputPath);
    } catch (error) {
      sendJson(res, 500, { error: "Image conversion failed", detail: String(error?.message || error) });
      return;
    } finally {
      await rm(tempInputPath, { force: true });
    }

    booking.image = `/public/v1/booking-images/${outputRelativePath}`;
    incrementBookingRevision(booking, "core_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "BOOKING_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      "Booking image updated"
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handleUploadBookingPersonPhoto(req, res, [bookingId, personId]) {
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
    if (!(await assertExpectedRevision(req, payload, booking, "expected_persons_revision", "persons_revision", res))) return;

    const persons = getBookingPersons(booking);
    const personIndex = persons.findIndex((person) => person.id === personId);
    if (personIndex < 0) {
      sendJson(res, 404, { error: "Person not found" });
      return;
    }

    const filename = normalizeText(payload.filename) || `${personId}.upload`;
    const base64 = normalizeText(payload.data_base64);
    if (!base64) {
      sendJson(res, 422, { error: "data_base64 is required" });
      return;
    }

    const sourceBuffer = Buffer.from(base64, "base64");
    if (!sourceBuffer.length) {
      sendJson(res, 422, { error: "Invalid base64 image payload" });
      return;
    }

    const tempInputPath = path.join(TEMP_UPLOAD_DIR, `${personId}-${randomUUID()}${path.extname(filename) || ".upload"}`);
    const outputName = `${personId}-${Date.now()}.webp`;
    const outputRelativePath = `${bookingId}/${outputName}`;
    const outputPath = path.join(BOOKING_PERSON_PHOTOS_DIR, outputRelativePath);

    try {
      await writeFile(tempInputPath, sourceBuffer);
      await processBookingPersonImageToWebp(tempInputPath, outputPath);
    } catch (error) {
      sendJson(res, 500, { error: "Image conversion failed", detail: String(error?.message || error) });
      return;
    } finally {
      await rm(tempInputPath, { force: true });
    }

    persons[personIndex] = {
      ...persons[personIndex],
      photo_ref: `/public/v1/booking-person-photos/${outputRelativePath}`
    };
    booking.persons = persons;
    incrementBookingRevision(booking, "persons_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "BOOKING_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      `Photo uploaded for ${normalizeText(persons[personIndex].name) || "person"}`
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  return {
    handlePublicBookingPersonPhoto,
    handlePublicBookingImage,
    handleUploadBookingImage,
    handleUploadBookingPersonPhoto
  };
}
