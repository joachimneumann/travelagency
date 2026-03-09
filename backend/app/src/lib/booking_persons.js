import { normalizeText } from "../../../../shared/js/text.js";

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
  const fullName = optionalText(person?.name);
  if (fullName) return fullName;
  const firstName = optionalText(person?.first_name);
  const lastName = optionalText(person?.last_name);
  const joined = [firstName, lastName].filter(Boolean).join(" ");
  return joined || null;
}

function normalizeRoleValue(value) {
  const normalized = optionalText(value);
  if (!normalized) return null;
  if (normalized === "TravelGroupContact") return "primary_contact";
  return normalized;
}

function normalizeRoles(rawRoles, flags = {}) {
  const roleSet = new Set(normalizeStringArray(rawRoles).map((role) => normalizeRoleValue(role)).filter(Boolean));
  if (flags.is_traveling) roleSet.add("traveler");
  if (flags.is_lead_contact) roleSet.add("primary_contact");
  return [...roleSet];
}

function normalizeEmails(person) {
  const values = Array.isArray(person?.emails) ? person.emails : [];
  const single = optionalText(person?.email);
  return Array.from(new Set([...values, single].map((entry) => optionalText(entry)).filter(Boolean)));
}

function normalizePhoneNumbers(person) {
  const values = Array.isArray(person?.phone_numbers) ? person.phone_numbers : [];
  return Array.from(
    new Set(
      [...values, person?.phone_number, person?.phone]
        .map((entry) => optionalText(entry))
        .filter(Boolean)
    )
  );
}

function normalizeAddress(person) {
  return compactObject({
    line_1: optionalText(person?.address?.line_1 || person?.address_line_1),
    line_2: optionalText(person?.address?.line_2 || person?.address_line_2),
    city: optionalText(person?.address?.city || person?.address_city),
    state_region: optionalText(person?.address?.state_region || person?.address_state_region),
    postal_code: optionalText(person?.address?.postal_code || person?.address_postal_code),
    country_code: optionalUppercaseText(person?.address?.country_code || person?.address_country_code)
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
  const normalized = compactObject({
    id: optionalText(document.id) || fallbackId,
    document_type: optionalText(document.document_type),
    document_number: optionalText(document.document_number),
    document_picture_ref: optionalText(document.document_picture_ref),
    issuing_country: optionalUppercaseText(document.issuing_country),
    expires_on: optionalText(document.expires_on),
    created_at: optionalText(document.created_at || document.updated_at),
    updated_at: optionalText(document.updated_at || document.created_at)
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

function mergeArrays(left, right) {
  return Array.from(new Set([...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])].filter(Boolean)));
}

function mergeBookingPersons(existing, incoming) {
  if (!existing) return incoming;
  return compactObject({
    id: existing.id || incoming.id,
    name: existing.name || incoming.name,
    photo_ref: existing.photo_ref || incoming.photo_ref,
    emails: mergeArrays(existing.emails, incoming.emails),
    phone_numbers: mergeArrays(existing.phone_numbers, incoming.phone_numbers),
    preferred_language: existing.preferred_language || incoming.preferred_language,
    date_of_birth: existing.date_of_birth || incoming.date_of_birth,
    nationality: existing.nationality || incoming.nationality,
    address: existing.address || incoming.address,
    roles: mergeArrays(existing.roles, incoming.roles),
    consents: mergeArrays(existing.consents, incoming.consents),
    documents: mergeArrays(existing.documents, incoming.documents),
    notes: existing.notes || incoming.notes
  });
}

function buildLookupMap(items, keyResolver) {
  const lookup = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const key = keyResolver(item);
    if (key) lookup.set(key, item);
  }
  return lookup;
}

function customerKey(customer) {
  return optionalText(customer?.client_id || customer?.id);
}

function normalizeBookingPerson(person, index = 0, bookingId = "booking") {
  if (!person || typeof person !== "object" || Array.isArray(person)) return null;
  const normalized = compactObject({
    id: optionalText(person.id) || `${bookingId}_person_${index + 1}`,
    name: derivePersonName(person) || `Traveler ${index + 1}`,
    photo_ref: optionalText(person.photo_ref),
    emails: normalizeEmails(person),
    phone_numbers: normalizePhoneNumbers(person),
    preferred_language: optionalText(person.preferred_language || person.language),
    date_of_birth: optionalText(person.date_of_birth),
    nationality: optionalUppercaseText(person.nationality),
    address: normalizeAddress(person),
    roles: normalizeRoles(person.roles || person.member_roles, {
      is_traveling: person.is_traveling === true,
      is_lead_contact: person.is_lead_contact === true
    }),
    consents: normalizeConsents(person, `${bookingId}_person_${index + 1}_consent`),
    documents: normalizeDocuments(person, `${bookingId}_person_${index + 1}_document`),
    notes: optionalText(person.notes)
  });
  return normalized?.id && normalized?.name ? normalized : null;
}

function buildBookingPersonFromCustomer(customer, options = {}) {
  const { roles = [], consents = [], documents = [], fallbackId = "booking_person_1" } = options;
  const id = customerKey(customer) || fallbackId;
  return normalizeBookingPerson({
    ...customer,
    id,
    roles,
    consents,
    documents
  }, 0, id);
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
    email,
    phone_number: phone,
    preferred_language: optionalText(submission.preferred_language || submission.language),
    roles: ["primary_contact", "traveler"]
  }, 0, optionalText(booking?.id) || "booking");
}

function normalizeWebFormSubmission(booking) {
  const submission = booking?.web_form_submission;
  if (!submission || typeof submission !== "object" || Array.isArray(submission)) {
    return null;
  }
  return compactObject({
    ...submission,
    destinations: normalizeStringArray(submission.destinations || booking?.destinations || booking?.destination),
    travel_style: normalizeStringArray(submission.travel_style || booking?.travel_styles || booking?.style),
    travel_month: optionalText(submission.travel_month || booking?.travel_month),
    number_of_travelers: optionalInt(submission.number_of_travelers ?? booking?.number_of_travelers ?? booking?.travelers),
    preferred_currency: optionalUppercaseText(submission.preferred_currency || booking?.preferred_currency),
    travel_duration_days_min: optionalInt(submission.travel_duration_days_min),
    travel_duration_days_max: optionalInt(submission.travel_duration_days_max),
    name: optionalText(submission.name),
    email: optionalText(submission.email),
    phone_number: optionalText(submission.phone_number || submission.phone),
    budget_lower_USD: optionalInt(submission.budget_lower_USD ?? booking?.budget_lower_USD),
    budget_upper_USD: optionalInt(submission.budget_upper_USD ?? booking?.budget_upper_USD),
    preferred_language: optionalText(submission.preferred_language || submission.language),
    notes: optionalText(submission.notes),
    submittedAt: optionalText(submission.submittedAt || submission.submitted_at || booking?.created_at)
  });
}

export function buildBookingPersonsFromLegacy(booking, store = {}) {
  const bookingId = optionalText(booking?.id) || "booking";
  if (Array.isArray(booking?.persons) && booking.persons.length) {
    return booking.persons
      .map((person, index) => normalizeBookingPerson(person, index, bookingId))
      .filter(Boolean);
  }

  const customers = Array.isArray(store.customers) ? store.customers : [];
  const customerConsents = Array.isArray(store.customer_consents) ? store.customer_consents : [];
  const customerDocuments = Array.isArray(store.customer_documents) ? store.customer_documents : [];
  const travelGroups = Array.isArray(store.travel_groups) ? store.travel_groups : [];
  const travelGroupMembers = Array.isArray(store.travel_group_members) ? store.travel_group_members : [];

  const customersById = buildLookupMap(customers, (customer) => optionalText(customer?.id));
  const customersByClientId = buildLookupMap(customers, (customer) => optionalText(customer?.client_id));
  const consentsByCustomerId = new Map();
  const documentsByCustomerId = new Map();

  for (const consent of customerConsents) {
    const key = optionalText(consent?.customer_client_id || consent?.customer_id);
    if (!key) continue;
    const items = consentsByCustomerId.get(key) || [];
    items.push(consent);
    consentsByCustomerId.set(key, items);
  }

  for (const document of customerDocuments) {
    const key = optionalText(document?.customer_client_id || document?.customer_id);
    if (!key) continue;
    const items = documentsByCustomerId.get(key) || [];
    items.push(document);
    documentsByCustomerId.set(key, items);
  }

  const personsById = new Map();

  const upsertPerson = (person) => {
    if (!person) return;
    const key = optionalText(person.id) || `${bookingId}_person_${personsById.size + 1}`;
    const merged = mergeBookingPersons(personsById.get(key), { ...person, id: key });
    personsById.set(key, merged);
  };

  const customerToPerson = (customer, roles = [], fallbackId = `${bookingId}_person_${personsById.size + 1}`) => {
    if (!customer) return null;
    const id = customerKey(customer) || fallbackId;
    return buildBookingPersonFromCustomer(customer, {
      fallbackId,
      roles,
      consents: consentsByCustomerId.get(id) || consentsByCustomerId.get(optionalText(customer?.id)) || [],
      documents: documentsByCustomerId.get(id) || documentsByCustomerId.get(optionalText(customer?.id)) || []
    });
  };

  const legacyCustomerId = optionalText(booking?.customer_id);
  if (legacyCustomerId) {
    upsertPerson(customerToPerson(customersById.get(legacyCustomerId), ["primary_contact", "traveler"], `${bookingId}_primary_contact`));
  }

  const legacyClientId = optionalText(booking?.client_id);
  const legacyClientType = optionalText(booking?.client_type);
  if (legacyClientType === "customer" && legacyClientId) {
    upsertPerson(customerToPerson(customersByClientId.get(legacyClientId), ["primary_contact", "traveler"], `${bookingId}_primary_contact`));
  }

  if (legacyClientType === "travel_group" && legacyClientId) {
    const group = travelGroups.find((entry) => optionalText(entry?.client_id) === legacyClientId || optionalText(entry?.id) === legacyClientId);
    const memberLookup = new Map(
      travelGroupMembers
        .filter((member) => optionalText(member?.travel_group_id) === optionalText(group?.id))
        .map((member) => [optionalText(member?.customer_client_id), member])
    );

    const contactCustomerId = optionalText(group?.group_contact_customer_id);
    if (contactCustomerId) {
      const member = memberLookup.get(contactCustomerId);
      upsertPerson(
        customerToPerson(customersByClientId.get(contactCustomerId), normalizeRoles(member?.member_roles, {
          is_traveling: member?.is_traveling === true,
          is_lead_contact: true
        }), `${bookingId}_primary_contact`)
      );
    }

    for (const travelerCustomerId of normalizeStringArray(group?.traveler_customer_ids)) {
      const member = memberLookup.get(travelerCustomerId);
      upsertPerson(
        customerToPerson(customersByClientId.get(travelerCustomerId), normalizeRoles(member?.member_roles, {
          is_traveling: member?.is_traveling !== false,
          is_lead_contact: travelerCustomerId === contactCustomerId
        }), `${bookingId}_${travelerCustomerId}`)
      );
    }
  }

  if (!personsById.size) {
    upsertPerson(buildFallbackSubmissionPerson(booking));
  }

  return [...personsById.values()]
    .map((person, index) => normalizeBookingPerson(person, index, bookingId))
    .filter(Boolean);
}

export function normalizeStoredBookingRecord(booking, store = {}) {
  const normalizedDestinations = normalizeStringArray(booking?.destinations || booking?.destination);
  const normalizedTravelStyles = normalizeStringArray(booking?.travel_styles || booking?.style);
  const normalizedBooking = {
    ...booking,
    atp_staff: optionalText(booking?.atp_staff || booking?.staff || booking?.owner_id),
    atp_staff_name: optionalText(booking?.atp_staff_name || booking?.staff_name || booking?.owner_name),
    service_level_agreement_due_at: optionalText(booking?.service_level_agreement_due_at || booking?.sla_due_at),
    destination: normalizedDestinations,
    destinations: normalizedDestinations,
    style: normalizedTravelStyles,
    travel_styles: normalizedTravelStyles,
    number_of_travelers: optionalInt(booking?.number_of_travelers ?? booking?.travelers ?? booking?.web_form_submission?.number_of_travelers),
    preferred_currency: optionalUppercaseText(booking?.preferred_currency || booking?.web_form_submission?.preferred_currency),
    notes: optionalText(booking?.notes),
    web_form_submission: normalizeWebFormSubmission(booking),
    persons: buildBookingPersonsFromLegacy(booking, store)
  };

  return compactObject({
    ...normalizedBooking,
    id: optionalText(normalizedBooking.id),
    stage: optionalText(normalizedBooking.stage),
    travel_start_day: optionalText(normalizedBooking.travel_start_day),
    travel_end_day: optionalText(normalizedBooking.travel_end_day),
    created_at: optionalText(normalizedBooking.created_at) || new Date().toISOString(),
    updated_at: optionalText(normalizedBooking.updated_at) || optionalText(normalizedBooking.created_at) || new Date().toISOString()
  }) || normalizedBooking;
}
