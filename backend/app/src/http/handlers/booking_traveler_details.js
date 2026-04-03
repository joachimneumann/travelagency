import {
  getBookingPersons,
  normalizeSingleBookingPersonPayload
} from "../../lib/booking_persons.js";
import {
  buildTravelerDetailsToken,
  resolveTravelerDetailsTokenExpiresAt,
  verifyTravelerDetailsToken
} from "../../domain/traveler_details_portal.js";

const PRIVATE_CACHE_HEADERS = Object.freeze({
  "Cache-Control": "private, max-age=0, no-store",
  Pragma: "no-cache"
});

const PUBLIC_TRAVELER_DOCUMENT_TYPES = new Set(["passport", "national_id"]);
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnly(value) {
  const normalized = String(value || "").trim();
  if (!normalized || !DATE_ONLY_PATTERN.test(normalized)) return null;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === normalized ? normalized : null;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((entry) => String(entry || "").trim()).filter(Boolean)));
}

function normalizePreferenceInput(value) {
  if (Array.isArray(value)) return normalizeStringArray(value);
  const normalized = String(value || "").trim();
  if (!normalized) return [];
  return Array.from(new Set(
    normalized
      .split(",")
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
  ));
}

function normalizeBooleanInput(value, fallback) {
  if (value === true || value === false) return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "y", "smoker", "single_room", "single"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "non_smoker", "nonsmoker", "sharing_room_ok", "sharing_ok", "sharing"].includes(normalized)) return false;
  return fallback;
}

function resolveTravelerDetailsTokenFromRequest(req) {
  try {
    const requestUrl = new URL(req.url, "http://localhost");
    return String(requestUrl.searchParams.get("token") || "").trim();
  } catch {
    return "";
  }
}

function isTravelingPerson(person) {
  return Array.isArray(person?.roles) && person.roles.some((role) => String(role || "").trim() === "traveler");
}

function normalizeStoredPersons(booking) {
  const persons = Array.isArray(booking?.persons) ? booking.persons : [];
  return persons
    .map((person, index) => normalizeSingleBookingPersonPayload(booking?.id, person, index))
    .filter(Boolean);
}

function findStoredPerson(booking, personId) {
  const normalizedPersonId = String(personId || "").trim();
  if (!normalizedPersonId) return null;
  return normalizeStoredPersons(booking).find((person) => String(person?.id || "").trim() === normalizedPersonId) || null;
}

function resolveTravelerNumber(booking, personId) {
  const normalizedPersonId = String(personId || "").trim();
  if (!normalizedPersonId) return null;
  const travelers = normalizeStoredPersons(booking).filter((person) => isTravelingPerson(person));
  const travelerIndex = travelers.findIndex((person) => String(person?.id || "").trim() === normalizedPersonId);
  return travelerIndex >= 0 ? travelerIndex + 1 : null;
}

function buildPublicDocumentInput(document, personId, documentIndex) {
  const documentType = String(document?.document_type || "").trim().toLowerCase();
  if (!PUBLIC_TRAVELER_DOCUMENT_TYPES.has(documentType)) return null;
  return {
    id: String(document?.id || `${personId}_document_${documentIndex + 1}`).trim(),
    document_type: documentType,
    holder_name: String(document?.holder_name || "").trim(),
    document_number: String(document?.document_number || "").trim(),
    issuing_country: String(document?.issuing_country || "").trim().toUpperCase(),
    issued_on: String(document?.issued_on || "").trim(),
    no_expiration_date: document?.no_expiration_date === true,
    expires_on: String(document?.expires_on || "").trim()
  };
}

function buildPublicAddressInput(address) {
  if (!address || typeof address !== "object" || Array.isArray(address)) return undefined;
  const nextAddress = {
    line_1: String(address.line_1 || "").trim(),
    line_2: String(address.line_2 || "").trim(),
    city: String(address.city || "").trim(),
    state_region: String(address.state_region || "").trim(),
    postal_code: String(address.postal_code || "").trim(),
    country_code: String(address.country_code || "").trim().toUpperCase()
  };
  return Object.values(nextAddress).some(Boolean) ? nextAddress : undefined;
}

function buildPublicVisiblePerson(bookingId, person) {
  const normalized = normalizeSingleBookingPersonPayload(bookingId, person, 0);
  if (!normalized) return null;
  return {
    id: normalized.id,
    name: normalized.name,
    ...(Array.isArray(normalized.emails) && normalized.emails.length ? { emails: normalized.emails } : {}),
    ...(Array.isArray(normalized.phone_numbers) && normalized.phone_numbers.length ? { phone_numbers: normalized.phone_numbers } : {}),
    ...(String(normalized.preferred_language || "").trim() ? { preferred_language: normalized.preferred_language } : {}),
    ...(Array.isArray(normalized.food_preferences) && normalized.food_preferences.length ? { food_preferences: normalized.food_preferences } : {}),
    ...(Array.isArray(normalized.allergies) && normalized.allergies.length ? { allergies: normalized.allergies } : {}),
    ...(normalized.hotel_room_smoker === true ? { hotel_room_smoker: true } : {}),
    ...(normalized.hotel_room_sharing_ok === false ? { hotel_room_sharing_ok: false } : {}),
    ...(String(normalized.date_of_birth || "").trim() ? { date_of_birth: normalized.date_of_birth } : {}),
    ...(String(normalized.gender || "").trim() ? { gender: normalized.gender } : {}),
    ...(String(normalized.nationality || "").trim() ? { nationality: normalized.nationality } : {}),
    ...(normalized.address ? { address: normalized.address } : {}),
    ...(Array.isArray(normalized.documents) && normalized.documents.length ? {
      documents: normalized.documents.map((document) => ({
        id: document.id,
        document_type: document.document_type,
        ...(String(document.holder_name || "").trim() ? { holder_name: document.holder_name } : {}),
        ...(String(document.document_number || "").trim() ? { document_number: document.document_number } : {}),
        ...(String(document.issuing_country || "").trim() ? { issuing_country: document.issuing_country } : {}),
        ...(String(document.issued_on || "").trim() ? { issued_on: document.issued_on } : {}),
        ...(document.no_expiration_date === true ? { no_expiration_date: true } : {}),
        ...(String(document.expires_on || "").trim() ? { expires_on: document.expires_on } : {}),
        ...(String(document.document_picture_ref || "").trim() ? { document_picture_ref: document.document_picture_ref } : {})
      }))
    } : {})
  };
}

function buildPublicTravelerDetailsAccessResponse(booking, person, expiresAt) {
  const bookingName = String(booking?.name || booking?.web_form_submission?.booking_name || "").trim();
  const customerLanguage = String(booking?.customer_language || booking?.web_form_submission?.preferred_language || "").trim();
  const travelerNumber = resolveTravelerNumber(booking, person?.id);
  return {
    booking_id: booking.id,
    person_id: person.id,
    ...(travelerNumber ? { traveler_number: travelerNumber } : {}),
    ...(bookingName ? { booking_name: bookingName } : {}),
    ...(customerLanguage ? { customer_language: customerLanguage } : {}),
    persons_revision: Number.isInteger(Number(booking?.persons_revision)) ? Math.max(0, Number(booking.persons_revision)) : 0,
    ...(expiresAt ? { public_traveler_details_expires_at: expiresAt } : {}),
    person: buildPublicVisiblePerson(booking.id, person)
  };
}

function collectPublicTravelerDetailsPayload(booking, personId, rawPerson) {
  if (!rawPerson || typeof rawPerson !== "object" || Array.isArray(rawPerson)) {
    return { ok: false, error: "person must be an object." };
  }

  const documents = (Array.isArray(rawPerson.documents) ? rawPerson.documents : [])
    .map((document, documentIndex) => buildPublicDocumentInput(document, personId, documentIndex))
    .filter(Boolean);
  const candidate = {
    id: String(personId || "").trim(),
    name: String(rawPerson.name || "").trim(),
    emails: normalizeStringArray(rawPerson.emails),
    phone_numbers: normalizeStringArray(rawPerson.phone_numbers),
    preferred_language: String(rawPerson.preferred_language || "").trim(),
    food_preferences: normalizePreferenceInput(rawPerson.food_preferences),
    allergies: normalizePreferenceInput(rawPerson.allergies),
    hotel_room_smoker: normalizeBooleanInput(rawPerson.hotel_room_smoker, false),
    hotel_room_sharing_ok: normalizeBooleanInput(rawPerson.hotel_room_sharing_ok, true),
    date_of_birth: String(rawPerson.date_of_birth || "").trim(),
    gender: String(rawPerson.gender || "").trim().toLowerCase(),
    nationality: String(rawPerson.nationality || "").trim().toUpperCase(),
    address: buildPublicAddressInput(rawPerson.address),
    documents
  };

  if (!candidate.name) {
    return { ok: false, error: "Traveler needs a full name." };
  }
  if (candidate.date_of_birth && !parseDateOnly(candidate.date_of_birth)) {
    return { ok: false, error: "Traveler date of birth must use YYYY-MM-DD." };
  }
  for (const document of candidate.documents) {
    if (document.issued_on && !parseDateOnly(document.issued_on)) {
      return { ok: false, error: `Traveler ${document.document_type} issue date must use YYYY-MM-DD.` };
    }
    if (document.expires_on && !parseDateOnly(document.expires_on)) {
      return { ok: false, error: `Traveler ${document.document_type} expiry date must use YYYY-MM-DD.` };
    }
  }

  const normalized = normalizeSingleBookingPersonPayload(booking?.id, candidate, 0);
  if (!normalized) {
    return { ok: false, error: "Traveler details are invalid." };
  }
  if (!Object.prototype.hasOwnProperty.call(rawPerson, "hotel_room_smoker")) {
    delete normalized.hotel_room_smoker;
  }
  if (!Object.prototype.hasOwnProperty.call(rawPerson, "hotel_room_sharing_ok")) {
    delete normalized.hotel_room_sharing_ok;
  }
  return { ok: true, person: normalized };
}

function buildStoredPersonOverwrite(existingPerson, normalizedPerson) {
  const existingDocuments = Array.isArray(existingPerson?.documents) ? existingPerson.documents : [];
  const preservedDocuments = Array.isArray(normalizedPerson?.documents)
    ? normalizedPerson.documents.map((document) => {
        const normalizedDocumentId = String(document?.id || "").trim();
        const normalizedDocumentType = String(document?.document_type || "").trim().toLowerCase();
        const existingDocument = existingDocuments.find((candidate) => (
          (normalizedDocumentId && String(candidate?.id || "").trim() === normalizedDocumentId)
          || (normalizedDocumentType && String(candidate?.document_type || "").trim().toLowerCase() === normalizedDocumentType)
        )) || null;
        return {
          ...document,
          ...(String(existingDocument?.document_picture_ref || "").trim()
            ? { document_picture_ref: String(existingDocument.document_picture_ref).trim() }
            : {}),
          created_at: String(existingDocument?.created_at || document?.created_at || "").trim() || document.created_at
        };
      })
    : null;
  return {
    id: normalizedPerson.id,
    name: normalizedPerson.name,
    ...(normalizedPerson.emails ? { emails: normalizedPerson.emails } : {}),
    ...(normalizedPerson.phone_numbers ? { phone_numbers: normalizedPerson.phone_numbers } : {}),
    ...(normalizedPerson.preferred_language ? { preferred_language: normalizedPerson.preferred_language } : {}),
    ...(normalizedPerson.food_preferences ? { food_preferences: normalizedPerson.food_preferences } : {}),
    ...(normalizedPerson.allergies ? { allergies: normalizedPerson.allergies } : {}),
    hotel_room_smoker: normalizedPerson.hotel_room_smoker === true
      ? true
      : normalizedPerson.hotel_room_smoker === false
        ? false
        : existingPerson?.hotel_room_smoker === true,
    hotel_room_sharing_ok: normalizedPerson.hotel_room_sharing_ok === true
      ? true
      : normalizedPerson.hotel_room_sharing_ok === false
        ? false
        : existingPerson?.hotel_room_sharing_ok !== false,
    ...(normalizedPerson.date_of_birth ? { date_of_birth: normalizedPerson.date_of_birth } : {}),
    ...(normalizedPerson.gender ? { gender: normalizedPerson.gender } : {}),
    ...(normalizedPerson.nationality ? { nationality: normalizedPerson.nationality } : {}),
    ...(normalizedPerson.address ? { address: normalizedPerson.address } : {}),
    ...(preservedDocuments ? { documents: preservedDocuments } : {}),
    ...(existingPerson?.photo_ref ? { photo_ref: existingPerson.photo_ref } : {}),
    ...(Array.isArray(existingPerson?.roles) ? { roles: existingPerson.roles } : {}),
    ...(Array.isArray(existingPerson?.consents) ? { consents: existingPerson.consents } : {}),
    ...(existingPerson?.notes ? { notes: existingPerson.notes } : {})
  };
}

export function createBookingTravelerDetailsHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    persistStore,
    normalizeText,
    nowIso,
    addActivity,
    incrementBookingRevision,
    travelerDetailsTokenConfig,
    getPrincipal,
    canEditBooking,
    path,
    randomUUID,
    TEMP_UPLOAD_DIR,
    BOOKING_PERSON_PHOTOS_DIR,
    writeFile,
    rm,
    processBookingPersonImageToWebp,
    getBookingPersons
  } = deps;

  const travelerDetailsTokenSecret = normalizeText(travelerDetailsTokenConfig?.secret);

  function verifyPublicTravelerDetailsToken({ req, bookingId, personId }) {
    return verifyTravelerDetailsToken(resolveTravelerDetailsTokenFromRequest(req), {
      bookingId,
      personId,
      secret: travelerDetailsTokenSecret,
      now: nowIso()
    });
  }

  function upsertPersonDocumentPicture(person, documentType, pictureRef, timestamp) {
    const normalizedDocumentType = String(documentType || "").trim().toLowerCase();
    const personId = String(person?.id || "").trim() || "person";
    const documents = Array.isArray(person?.documents) ? person.documents : [];
    let found = false;
    const nextDocuments = documents.map((document, index) => {
      if (String(document?.document_type || "").trim().toLowerCase() !== normalizedDocumentType) return document;
      found = true;
      return {
        ...document,
        id: String(document?.id || `${personId}_${normalizedDocumentType}_${index + 1}`).trim(),
        document_type: normalizedDocumentType,
        document_picture_ref: pictureRef,
        created_at: String(document?.created_at || "").trim() || timestamp,
        updated_at: timestamp
      };
    });
    if (!found) {
      nextDocuments.push({
        id: `${personId}_${normalizedDocumentType}`,
        document_type: normalizedDocumentType,
        document_picture_ref: pictureRef,
        created_at: timestamp,
        updated_at: timestamp
      });
    }
    return {
      ...person,
      documents: nextDocuments
    };
  }

  async function handlePostBookingPersonTravelerDetailsLink(req, res, [bookingId, personId]) {
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

    const person = findStoredPerson(booking, personId);
    if (!person) {
      sendJson(res, 404, { error: "Person not found" });
      return;
    }
    if (!isTravelingPerson(person)) {
      sendJson(res, 422, { error: "Traveler details links can only be created for travelers." });
      return;
    }

    const expiresAt = resolveTravelerDetailsTokenExpiresAt({
      now: nowIso(),
      ttlMs: travelerDetailsTokenConfig?.ttlMs
    });
    const token = buildTravelerDetailsToken({
      bookingId,
      personId,
      expiresAt,
      secret: travelerDetailsTokenSecret
    });

    sendJson(res, 200, {
      booking_id: bookingId,
      person_id: person.id,
      traveler_details_token: token,
      traveler_details_expires_at: expiresAt
    });
  }

  async function handleGetPublicTravelerDetailsAccess(req, res, [bookingId, personId]) {
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" }, PRIVATE_CACHE_HEADERS);
      return;
    }

    const tokenCheck = verifyPublicTravelerDetailsToken({ req, bookingId, personId });
    if (!tokenCheck.ok) {
      const status = tokenCheck.code === "TOKEN_EXPIRED" ? 410 : 401;
      sendJson(res, status, { error: tokenCheck.error }, PRIVATE_CACHE_HEADERS);
      return;
    }

    const person = findStoredPerson(booking, personId);
    if (!person) {
      sendJson(res, 404, { error: "Person not found" }, PRIVATE_CACHE_HEADERS);
      return;
    }

    sendJson(
      res,
      200,
      buildPublicTravelerDetailsAccessResponse(booking, person, tokenCheck.payload?.expires_at || ""),
      PRIVATE_CACHE_HEADERS
    );
  }

  async function handlePatchPublicTravelerDetails(req, res, [bookingId, personId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch (error) {
      sendJson(res, 400, { error: error?.message || "Invalid JSON payload" }, PRIVATE_CACHE_HEADERS);
      return;
    }

    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" }, PRIVATE_CACHE_HEADERS);
      return;
    }

    const tokenCheck = verifyPublicTravelerDetailsToken({ req, bookingId, personId });
    if (!tokenCheck.ok) {
      const status = tokenCheck.code === "TOKEN_EXPIRED" ? 410 : 401;
      sendJson(res, status, { error: tokenCheck.error }, PRIVATE_CACHE_HEADERS);
      return;
    }

    const existingPerson = findStoredPerson(booking, personId);
    if (!existingPerson) {
      sendJson(res, 404, { error: "Person not found" }, PRIVATE_CACHE_HEADERS);
      return;
    }

    const collected = collectPublicTravelerDetailsPayload(booking, personId, payload?.person);
    if (!collected.ok) {
      sendJson(res, 422, { error: collected.error }, PRIVATE_CACHE_HEADERS);
      return;
    }

    const storedPersons = normalizeStoredPersons(booking);
    const nextPersons = storedPersons.map((person) => (
      String(person?.id || "").trim() === String(personId || "").trim()
        ? buildStoredPersonOverwrite(existingPerson, collected.person)
        : person
    ));

    const currentSnapshot = JSON.stringify(storedPersons);
    const nextSnapshot = JSON.stringify(nextPersons);
    if (currentSnapshot !== nextSnapshot) {
      booking.persons = nextPersons;
      incrementBookingRevision(booking, "persons_revision");
      booking.updated_at = nowIso();
      addActivity(store, booking.id, "BOOKING_UPDATED", "public_link", "Traveler details updated via public link");
      await persistStore(store);
    }

    const savedPerson = findStoredPerson(booking, personId);
    sendJson(res, 200, {
      ...buildPublicTravelerDetailsAccessResponse(booking, savedPerson || collected.person, tokenCheck.payload?.expires_at || ""),
      saved_at: nowIso()
    }, PRIVATE_CACHE_HEADERS);
  }

  async function handleUploadPublicTravelerDocumentPicture(req, res, [bookingId, personId, rawDocumentType]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch (error) {
      sendJson(res, 400, { error: error?.message || "Invalid JSON payload" }, PRIVATE_CACHE_HEADERS);
      return;
    }

    const documentType = String(rawDocumentType || "").trim().toLowerCase();
    if (!PUBLIC_TRAVELER_DOCUMENT_TYPES.has(documentType)) {
      sendJson(res, 404, { error: "Document type not found" }, PRIVATE_CACHE_HEADERS);
      return;
    }

    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" }, PRIVATE_CACHE_HEADERS);
      return;
    }

    const tokenCheck = verifyPublicTravelerDetailsToken({ req, bookingId, personId });
    if (!tokenCheck.ok) {
      const status = tokenCheck.code === "TOKEN_EXPIRED" ? 410 : 401;
      sendJson(res, status, { error: tokenCheck.error }, PRIVATE_CACHE_HEADERS);
      return;
    }

    const persons = getBookingPersons(booking);
    const personIndex = persons.findIndex((person) => String(person?.id || "").trim() === String(personId || "").trim());
    if (personIndex < 0) {
      sendJson(res, 404, { error: "Person not found" }, PRIVATE_CACHE_HEADERS);
      return;
    }

    const filename = String(payload?.filename || "").trim() || `${personId}-${documentType}.upload`;
    const base64 = String(payload?.data_base64 || "").trim();
    if (!base64) {
      sendJson(res, 422, { error: "data_base64 is required" }, PRIVATE_CACHE_HEADERS);
      return;
    }

    const sourceBuffer = Buffer.from(base64, "base64");
    if (!sourceBuffer.length) {
      sendJson(res, 422, { error: "Invalid base64 image payload" }, PRIVATE_CACHE_HEADERS);
      return;
    }

    const tempInputPath = path.join(TEMP_UPLOAD_DIR, `${personId}-${documentType}-${randomUUID()}${path.extname(filename) || ".upload"}`);
    const outputName = `${personId}-${documentType}-${Date.now()}.webp`;
    const outputRelativePath = `${bookingId}/${outputName}`;
    const outputPath = path.join(BOOKING_PERSON_PHOTOS_DIR, outputRelativePath);

    try {
      await writeFile(tempInputPath, sourceBuffer);
      await processBookingPersonImageToWebp(tempInputPath, outputPath);
    } catch (error) {
      sendJson(res, 500, { error: "Image conversion failed", detail: String(error?.message || error) }, PRIVATE_CACHE_HEADERS);
      return;
    } finally {
      await rm(tempInputPath, { force: true });
    }

    const timestamp = nowIso();
    const pictureRef = `/public/v1/booking-person-photos/${outputRelativePath}`;
    persons[personIndex] = upsertPersonDocumentPicture(persons[personIndex], documentType, pictureRef, timestamp);
    booking.persons = persons;
    incrementBookingRevision(booking, "persons_revision");
    booking.updated_at = timestamp;
    addActivity(store, booking.id, "BOOKING_UPDATED", "public_link", `Traveler ${documentType === "national_id" ? "ID card" : "passport"} image uploaded via public link`);
    await persistStore(store);

    sendJson(
      res,
      200,
      {
        ...buildPublicTravelerDetailsAccessResponse(booking, persons[personIndex], tokenCheck.payload?.expires_at || ""),
        saved_at: timestamp
      },
      PRIVATE_CACHE_HEADERS
    );
  }

  return {
    handlePostBookingPersonTravelerDetailsLink,
    handleGetPublicTravelerDetailsAccess,
    handlePatchPublicTravelerDetails,
    handleUploadPublicTravelerDocumentPicture
  };
}
