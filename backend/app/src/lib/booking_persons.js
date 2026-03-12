import { normalizeText } from "./text.js";

function optionalText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function optionalUppercaseText(value) {
  const normalized = optionalText(value);
  return normalized ? normalized.toUpperCase() : null;
}

function optionalInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function nonNegativeInt(value, fallback = 0) {
  const parsed = optionalInt(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function optionalBool(value) {
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((entry) => optionalText(entry)).filter(Boolean)));
  }
  const single = optionalText(value);
  return single ? [single] : [];
}

function compactObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const next = Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => {
      if (entryValue === null || entryValue === undefined) return false;
      if (Array.isArray(entryValue)) return entryValue.length > 0;
      if (typeof entryValue === "object") return Object.keys(entryValue).length > 0;
      return true;
    })
  );
  return Object.keys(next).length ? next : null;
}

function derivePersonName(person) {
  return optionalText(person?.name);
}

function normalizeRoles(rawRoles) {
  return normalizeStringArray(rawRoles);
}

function normalizeEmails(person) {
  const values = Array.isArray(person?.emails) ? person.emails : [];
  return Array.from(new Set(values.map((entry) => optionalText(entry)).filter(Boolean)));
}

function normalizePhoneNumbers(person) {
  const values = Array.isArray(person?.phone_numbers) ? person.phone_numbers : [];
  return Array.from(new Set(values.map((entry) => optionalText(entry)).filter(Boolean)));
}

function normalizeAddress(person) {
  return compactObject({
    line_1: optionalText(person?.address?.line_1),
    line_2: optionalText(person?.address?.line_2),
    city: optionalText(person?.address?.city),
    state_region: optionalText(person?.address?.state_region),
    postal_code: optionalText(person?.address?.postal_code),
    country_code: optionalUppercaseText(person?.address?.country_code)
  });
}

function normalizeConsent(consent, fallbackId) {
  if (!consent || typeof consent !== "object" || Array.isArray(consent)) return null;
  const normalized = compactObject({
    id: optionalText(consent.id) || fallbackId,
    consent_type: optionalText(consent.consent_type),
    status: optionalText(consent.status),
    captured_via: optionalText(consent.captured_via),
    captured_at: optionalText(consent.captured_at),
    evidence_ref: optionalText(consent.evidence_ref),
    updated_at: optionalText(consent.updated_at || consent.captured_at)
  });
  return normalized?.id && normalized?.consent_type && normalized?.status && normalized?.captured_at && normalized?.updated_at
    ? normalized
    : null;
}

function normalizeDocument(document, fallbackId) {
  if (!document || typeof document !== "object" || Array.isArray(document)) return null;
  const timestamp = new Date().toISOString();
  const normalized = compactObject({
    id: optionalText(document.id) || fallbackId,
    document_type: optionalText(document.document_type),
    holder_name: optionalText(document.holder_name),
    document_number: optionalText(document.document_number),
    document_picture_ref: optionalText(document.document_picture_ref),
    issuing_country: optionalUppercaseText(document.issuing_country),
    issued_on: optionalText(document.issued_on),
    no_expiration_date: optionalBool(document.no_expiration_date),
    expires_on: optionalText(document.expires_on),
    created_at: optionalText(document.created_at || document.updated_at) || timestamp,
    updated_at: optionalText(document.updated_at || document.created_at) || timestamp
  });
  return normalized?.id && normalized?.document_type && normalized?.created_at && normalized?.updated_at ? normalized : null;
}

function normalizeConsents(person, fallbackPrefix = "consent") {
  const consents = Array.isArray(person?.consents) ? person.consents : [];
  return consents
    .map((consent, index) => normalizeConsent(consent, `${fallbackPrefix}_${index + 1}`))
    .filter(Boolean);
}

function normalizeDocuments(person, fallbackPrefix = "document") {
  const documents = Array.isArray(person?.documents) ? person.documents : [];
  return documents
    .map((document, index) => normalizeDocument(document, `${fallbackPrefix}_${index + 1}`))
    .filter(Boolean);
}

export function normalizeBookingPerson(person, index = 0, bookingId = "booking") {
  if (!person || typeof person !== "object" || Array.isArray(person)) return null;
  const normalized = compactObject({
    id: optionalText(person.id) || `${bookingId}_person_${index + 1}`,
    name: derivePersonName(person) || "",
    photo_ref: optionalText(person.photo_ref),
    emails: normalizeEmails(person),
    phone_numbers: normalizePhoneNumbers(person),
    preferred_language: optionalText(person.preferred_language),
    date_of_birth: optionalText(person.date_of_birth),
    nationality: optionalUppercaseText(person.nationality),
    address: normalizeAddress(person),
    roles: normalizeRoles(person.roles),
    consents: normalizeConsents(person, `${bookingId}_person_${index + 1}_consent`),
    documents: normalizeDocuments(person, `${bookingId}_person_${index + 1}_document`),
    notes: optionalText(person.notes)
  });
  return normalized?.id ? normalized : null;
}

function buildFallbackSubmissionPerson(booking) {
  const submission = booking?.web_form_submission;
  if (!submission || typeof submission !== "object" || Array.isArray(submission)) return null;
  const name = optionalText(submission.name);
  const email = optionalText(submission.email);
  const phone = optionalText(submission.phone_number || submission.phone);
  if (!name && !email && !phone) return null;
  return normalizeBookingPerson({
    id: `${optionalText(booking?.id) || "booking"}_primary_contact`,
    name: name || "Primary contact",
    emails: email ? [email] : [],
    phone_numbers: phone ? [phone] : [],
    preferred_language: optionalText(submission.preferred_language),
    roles: ["primary_contact", "traveler"]
  }, 0, optionalText(booking?.id) || "booking");
}

export function getBookingPersons(booking) {
  const bookingId = optionalText(booking?.id) || "booking";
  const persons = Array.isArray(booking?.persons) ? booking.persons : [];
  const normalized = persons
    .map((person, index) => normalizeBookingPerson(person, index, bookingId))
    .filter(Boolean);
  return normalized.length ? normalized : [buildFallbackSubmissionPerson(booking)].filter(Boolean);
}

export function getBookingPrimaryContact(booking) {
  const persons = getBookingPersons(booking);
  return persons.find((person) => Array.isArray(person.roles) && person.roles.includes("primary_contact")) || persons[0] || null;
}

export function normalizeBookingPersonsPayload(bookingId, persons) {
  return (Array.isArray(persons) ? persons : [])
    .map((person, index) => normalizeBookingPerson(person, index, optionalText(bookingId) || "booking"))
    .filter(Boolean);
}

export function normalizeSingleBookingPersonPayload(bookingId, person, fallbackIndex = 0) {
  return normalizeBookingPersonsPayload(bookingId, [person]).map((entry, index) => ({
    ...entry,
    id: optionalText(entry.id) || `${optionalText(bookingId) || "booking"}_person_${fallbackIndex + index + 1}`
  }))[0] || null;
}

function normalizeWebFormSubmission(booking) {
  const submission = booking?.web_form_submission;
  const source = booking?.source;
  if (!submission || typeof submission !== "object" || Array.isArray(submission)) {
    if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  }
  return compactObject({
    ...submission,
    destinations: normalizeStringArray(submission?.destinations || booking?.destinations),
    travel_style: normalizeStringArray(submission?.travel_style || booking?.travel_styles),
    booking_name: optionalText(submission?.booking_name || booking?.name),
    tour_id: optionalText(submission?.tour_id || source?.tour_id),
    page_url: optionalText(submission?.page_url || source?.page_url),
    ip_address: optionalText(submission?.ip_address || source?.ip_address),
    ip_country_guess: optionalText(submission?.ip_country_guess || source?.ip_country_guess),
    referrer: optionalText(submission?.referrer || source?.referrer),
    utm_source: optionalText(submission?.utm_source || source?.utm_source),
    utm_medium: optionalText(submission?.utm_medium || source?.utm_medium),
    utm_campaign: optionalText(submission?.utm_campaign || source?.utm_campaign),
    travel_month: optionalText(submission?.travel_month),
    number_of_travelers: optionalInt(submission?.number_of_travelers ?? booking?.number_of_travelers),
    preferred_currency: optionalUppercaseText(submission?.preferred_currency || booking?.preferred_currency),
    travel_duration_days_min: optionalInt(submission?.travel_duration_days_min),
    travel_duration_days_max: optionalInt(submission?.travel_duration_days_max),
    name: optionalText(submission?.name),
    email: optionalText(submission?.email),
    phone_number: optionalText(submission?.phone_number),
    budget_lower_usd: optionalInt(submission?.budget_lower_usd ?? booking?.budget_lower_usd),
    budget_upper_usd: optionalInt(submission?.budget_upper_usd ?? booking?.budget_upper_usd),
    preferred_language: optionalText(submission?.preferred_language),
    notes: optionalText(submission?.notes),
    submitted_at: optionalText(submission?.submitted_at || booking?.created_at)
  });
}

export function normalizeStoredBookingRecord(booking, _store = {}) {
  const normalizedDestinations = normalizeStringArray(booking?.destinations);
  const normalizedTravelStyles = normalizeStringArray(booking?.travel_styles);
  const normalizedBooking = {
    ...booking,
    name: optionalText(booking?.name || booking?.web_form_submission?.booking_name),
    image: optionalText(booking?.image),
    core_revision: nonNegativeInt(booking?.core_revision, 0),
    notes_revision: nonNegativeInt(booking?.notes_revision, 0),
    persons_revision: nonNegativeInt(booking?.persons_revision, 0),
    pricing_revision: nonNegativeInt(booking?.pricing_revision, 0),
    offer_revision: nonNegativeInt(booking?.offer_revision, 0),
    invoices_revision: nonNegativeInt(booking?.invoices_revision, 0),
    assigned_keycloak_user_id: optionalText(booking?.assigned_keycloak_user_id),
    service_level_agreement_due_at: optionalText(booking?.service_level_agreement_due_at),
    destinations: normalizedDestinations,
    travel_styles: normalizedTravelStyles,
    number_of_travelers: optionalInt(booking?.number_of_travelers ?? booking?.web_form_submission?.number_of_travelers),
    preferred_currency: optionalUppercaseText(booking?.preferred_currency || booking?.web_form_submission?.preferred_currency),
    notes: optionalText(booking?.notes),
    web_form_submission: normalizeWebFormSubmission(booking),
    persons: getBookingPersons(booking)
  };

  return compactObject({
    ...normalizedBooking,
    id: optionalText(normalizedBooking.id),
    stage: optionalText(normalizedBooking.stage),
    travel_start_day: optionalText(normalizedBooking.travel_start_day),
    travel_end_day: optionalText(normalizedBooking.travel_end_day),
    source: undefined,
    created_at: optionalText(normalizedBooking.created_at) || new Date().toISOString(),
    updated_at: optionalText(normalizedBooking.updated_at) || optionalText(normalizedBooking.created_at) || new Date().toISOString()
  }) || normalizedBooking;
}
