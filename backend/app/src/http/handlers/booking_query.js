import {
  getBookingPersons,
  getBookingPrimaryContact
} from "../../lib/booking_persons.js";
import { normalizeBookingContentLang } from "../../domain/booking_content_i18n.js";

export function createBookingQueryModule(deps) {
  const {
    buildBookingReadModel,
    normalizeText,
    normalizeStringArray,
    normalizeEmail,
    normalizePhone,
    safeCurrency,
    BASE_CURRENCY,
    getBookingAssignedKeycloakUserId
  } = deps;

  function unique(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
  }

  function normalizePersonEmails(person) {
    return unique(
      [...(Array.isArray(person?.emails) ? person.emails : [])]
        .map((value) => normalizeEmail(value))
        .filter(Boolean)
    );
  }

  function normalizePersonPhoneNumbers(person) {
    return unique(
      [...(Array.isArray(person?.phone_numbers) ? person.phone_numbers : [])]
        .map((value) => normalizePhone(value))
        .filter(Boolean)
    );
  }

  function getSubmittedContact(booking) {
    const submission = booking?.web_form_submission || {};
    const preferredLanguage = normalizeText(booking?.customer_language || submission.preferred_language)
      ? normalizeBookingContentLang(booking?.customer_language || submission.preferred_language)
      : null;
    return {
      name: normalizeText(submission.name) || null,
      email: normalizeEmail(submission.email) || null,
      phone_number: normalizePhone(submission.phone_number) || null,
      preferred_language: preferredLanguage,
      preferred_currency: safeCurrency(submission.preferred_currency || booking?.preferred_currency || BASE_CURRENCY)
    };
  }

  function getBookingContactProfile(booking) {
    const primary = getBookingPrimaryContact(booking);
    const submitted = getSubmittedContact(booking);
    const emails = primary ? normalizePersonEmails(primary) : [];
    const phoneNumbers = primary ? normalizePersonPhoneNumbers(primary) : [];
    return {
      name: normalizeText(primary?.name) || submitted.name || "Primary contact",
      email: emails[0] || submitted.email || null,
      phone_number: phoneNumbers[0] || submitted.phone_number || null,
      preferred_language: normalizeText(booking?.customer_language || primary?.preferred_language || submitted.preferred_language)
        ? normalizeBookingContentLang(booking?.customer_language || primary?.preferred_language || submitted.preferred_language)
        : null
    };
  }

  function getBookingSearchTerms(booking) {
    const contact = getBookingContactProfile(booking);
    const persons = getBookingPersons(booking);
    return [
      normalizeText(booking?.id),
      normalizeText(booking?.name),
      normalizeText(booking?.stage),
      normalizeText(booking?.notes),
      normalizeText(booking?.assigned_keycloak_user_id),
      ...normalizeStringArray(booking?.destinations),
      ...normalizeStringArray(booking?.travel_styles),
      normalizeText(contact.name),
      normalizeText(contact.email),
      normalizeText(contact.phone_number),
      ...persons.flatMap((person) => [
        normalizeText(person.name),
        ...normalizePersonEmails(person),
        ...normalizePersonPhoneNumbers(person)
      ])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function sortBookings(items, sort) {
    const list = [...items];
    switch (sort) {
      case "created_at_asc":
        return list.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
      case "updated_at_asc":
        return list.sort((a, b) => String(a.updated_at || "").localeCompare(String(b.updated_at || "")));
      case "updated_at_desc":
        return list.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
      case "stage_asc":
        return list.sort((a, b) => String(a.stage || "").localeCompare(String(b.stage || "")));
      case "stage_desc":
        return list.sort((a, b) => String(b.stage || "").localeCompare(String(a.stage || "")));
      case "created_at_desc":
      default:
        return list.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    }
  }

  function filterBookings(store, searchParams) {
    const stage = normalizeText(searchParams.get("stage")).toUpperCase();
    const assignedKeycloakUserId = normalizeText(searchParams.get("assigned_keycloak_user_id"));
    const rawSearch = normalizeText(searchParams.get("search")).toLowerCase();
    const sort = normalizeText(searchParams.get("sort")) || "created_at_desc";

    const items = sortBookings(
      (Array.isArray(store.bookings) ? store.bookings : []).filter((booking) => {
        if (stage && normalizeText(booking.stage).toUpperCase() !== stage) return false;
        if (assignedKeycloakUserId && getBookingAssignedKeycloakUserId(booking) !== assignedKeycloakUserId) return false;
        if (rawSearch && !getBookingSearchTerms(booking).includes(rawSearch)) return false;
        return true;
      }),
      sort
    );

    return {
      items,
      filters: {
        stage: stage || null,
        assigned_keycloak_user_id: assignedKeycloakUserId || null,
        search: rawSearch || null
      },
      sort
    };
  }

  function resolveRequestedLang(source) {
    if (!source) return "en";
    if (typeof source === "string") return normalizeBookingContentLang(source);
    if (typeof source?.lang === "string") return normalizeBookingContentLang(source.lang);
    if (source?.req) return resolveRequestedLang(source.req);
    if (typeof source?.url === "string") {
      try {
        const requestUrl = new URL(source.url, "http://localhost");
        return normalizeBookingContentLang(requestUrl.searchParams.get("lang") || "en");
      } catch {
        return "en";
      }
    }
    return "en";
  }

  async function buildBookingPayload(booking, options = {}) {
    return buildBookingReadModel({
      ...booking,
      persons: getBookingPersons(booking)
    }, {
      lang: resolveRequestedLang(options),
      includeBookingConfirmationToken: Boolean(options?.includeBookingConfirmationToken)
    });
  }

  async function buildBookingDetailResponse(booking, options = {}) {
    return { booking: await buildBookingPayload(booking, { ...options, includeBookingConfirmationToken: true }) };
  }

  return {
    buildBookingDetailResponse,
    buildBookingPayload,
    filterBookings,
    getBookingContactProfile,
    getSubmittedContact,
    normalizePersonEmails,
    normalizePersonPhoneNumbers
  };
}
