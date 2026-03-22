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

const PRIVACY_NOTICE = "For privacy reasons, all prior data has been deleted, except for the traveler’s name";
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

function hasDocumentInput(document) {
  if (!document || typeof document !== "object" || Array.isArray(document)) return false;
  return [
    document.holder_name,
    document.document_number,
    document.issuing_country,
    document.issued_on,
    document.expires_on,
    document.no_expiration_date === true ? "true" : ""
  ].some((value) => String(value || "").trim());
}

function hasAddressInput(address) {
  if (!address || typeof address !== "object" || Array.isArray(address)) return false;
  return [
    address.line_1,
    address.line_2,
    address.city,
    address.state_region,
    address.postal_code,
    address.country_code
  ].some((value) => String(value || "").trim());
}

function hasPublicPersonData(person) {
  if (!person || typeof person !== "object" || Array.isArray(person)) return false;
  return [
    ...(Array.isArray(person.emails) ? person.emails : []),
    ...(Array.isArray(person.phone_numbers) ? person.phone_numbers : []),
    person.preferred_language,
    person.date_of_birth,
    person.nationality
  ].some((value) => String(value || "").trim())
    || hasAddressInput(person.address)
    || (Array.isArray(person.documents) ? person.documents.some(hasDocumentInput) : false);
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

function buildClearedPublicPerson(bookingId, person) {
  return normalizeSingleBookingPersonPayload(bookingId, {
    id: person?.id,
    name: person?.name || "",
    emails: [],
    phone_numbers: [],
    preferred_language: "",
    date_of_birth: "",
    nationality: "",
    address: {},
    documents: []
  }, 0);
}

function buildPublicTravelerDetailsAccessResponse(booking, person, expiresAt) {
  const bookingName = String(booking?.name || booking?.web_form_submission?.booking_name || "").trim();
  const customerLanguage = String(booking?.customer_language || booking?.web_form_submission?.preferred_language || "").trim();
  const hasExistingData = hasPublicPersonData(person);
  return {
    booking_id: booking.id,
    person_id: person.id,
    ...(bookingName ? { booking_name: bookingName } : {}),
    ...(customerLanguage ? { customer_language: customerLanguage } : {}),
    persons_revision: Number.isInteger(Number(booking?.persons_revision)) ? Math.max(0, Number(booking.persons_revision)) : 0,
    ...(expiresAt ? { public_traveler_details_expires_at: expiresAt } : {}),
    person: buildClearedPublicPerson(booking.id, person),
    ...(hasExistingData ? { privacy_notice: PRIVACY_NOTICE } : {})
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
    date_of_birth: String(rawPerson.date_of_birth || "").trim(),
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
  return { ok: true, person: normalized };
}

function buildStoredPersonOverwrite(existingPerson, normalizedPerson) {
  return {
    id: normalizedPerson.id,
    name: normalizedPerson.name,
    ...(normalizedPerson.emails ? { emails: normalizedPerson.emails } : {}),
    ...(normalizedPerson.phone_numbers ? { phone_numbers: normalizedPerson.phone_numbers } : {}),
    ...(normalizedPerson.preferred_language ? { preferred_language: normalizedPerson.preferred_language } : {}),
    ...(normalizedPerson.date_of_birth ? { date_of_birth: normalizedPerson.date_of_birth } : {}),
    ...(normalizedPerson.nationality ? { nationality: normalizedPerson.nationality } : {}),
    ...(normalizedPerson.address ? { address: normalizedPerson.address } : {}),
    ...(normalizedPerson.documents ? { documents: normalizedPerson.documents } : {}),
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
    canEditBooking
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

  return {
    handlePostBookingPersonTravelerDetailsLink,
    handleGetPublicTravelerDetailsAccess,
    handlePatchPublicTravelerDetails
  };
}
