import { normalizeText, escapeHtml } from "../shared/api.js?v=ce37aa7dfc76";
import { isTravelingPerson, normalizeStringList } from "../shared/booking_persons.js?v=ce37aa7dfc76";

export function collectPersonEmails(person) {
  return Array.from(
    new Set(
      [person?.email, ...(Array.isArray(person?.emails) ? person.emails : [])]
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
  );
}

export function collectPersonPhoneNumbers(person) {
  return Array.from(
    new Set(
      [person?.phone_number, person?.phone, ...(Array.isArray(person?.phone_numbers) ? person.phone_numbers : [])]
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
  );
}

export function formatPersonRoleLabel(role) {
  return String(role || "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function documentHasAnyData(document) {
  if (!document || typeof document !== "object") return false;
  return [
    document.holder_name,
    document.document_number,
    document.document_picture_ref,
    document.issuing_country,
    document.issued_on,
    document.expires_on,
    document.no_expiration_date === true ? "true" : ""
  ].some((value) => normalizeText(value));
}

export function normalizePersonDocumentDraft(document = {}, document_type = "passport") {
  return {
    id: normalizeText(document.id) || "",
    document_type: normalizeText(document.document_type) || document_type,
    holder_name: normalizeText(document.holder_name) || "",
    document_number: normalizeText(document.document_number) || "",
    document_picture_ref: normalizeText(document.document_picture_ref) || "",
    issuing_country: normalizeText(document.issuing_country).toUpperCase() || "",
    issued_on: normalizeText(document.issued_on) || "",
    no_expiration_date: document.no_expiration_date === true,
    expires_on: normalizeText(document.expires_on) || "",
    created_at: normalizeText(document.created_at) || "",
    updated_at: normalizeText(document.updated_at) || ""
  };
}

export function getPersonDocument(draft, document_type) {
  return (Array.isArray(draft?.documents) ? draft.documents : []).find(
    (document) => normalizeText(document?.document_type) === normalizeText(document_type)
  ) || null;
}

export function buildDocumentPayloadFromDraft(document, person_id, booking_id, index) {
  const normalized = normalizePersonDocumentDraft(document, normalizeText(document?.document_type) || "passport");
  if (!documentHasAnyData(normalized)) return null;
  const timestamp = new Date().toISOString();
  return {
    id: normalized.id || `${normalizeText(person_id) || booking_id || "booking"}_document_${index + 1}`,
    document_type: normalizeText(normalized.document_type) || "passport",
    holder_name: normalizeText(normalized.holder_name) || undefined,
    document_number: normalizeText(normalized.document_number) || undefined,
    document_picture_ref: normalizeText(normalized.document_picture_ref) || undefined,
    issuing_country: normalizeText(normalized.issuing_country).toUpperCase() || undefined,
    issued_on: normalizeText(normalized.issued_on) || undefined,
    no_expiration_date: normalized.no_expiration_date === true ? true : undefined,
    expires_on: normalized.no_expiration_date === true ? undefined : normalizeText(normalized.expires_on) || undefined,
    created_at: normalizeText(normalized.created_at) || timestamp,
    updated_at: timestamp
  };
}

export function personHasCompleteIdentityDocument(person, document_type) {
  const document = getPersonDocument(person, document_type);
  const has_expiration = document_type === "national_id"
    ? document?.no_expiration_date === true || normalizeText(document?.expires_on)
    : normalizeText(document?.expires_on);
  return Boolean(
    normalizeText(document?.holder_name) &&
    normalizeText(person?.date_of_birth) &&
    normalizeText(person?.nationality) &&
    normalizeText(document?.document_number) &&
    normalizeText(document?.issuing_country) &&
    normalizeText(document?.issued_on) &&
    has_expiration
  );
}

export function getPersonIdentityStatus(person) {
  if (personHasCompleteIdentityDocument(person, "passport")) {
    return { is_complete: true, label: "Passport" };
  }
  if (personHasCompleteIdentityDocument(person, "national_id")) {
    return { is_complete: true, label: "ID card" };
  }
  return { is_complete: false, label: "" };
}

export function personHasCompleteContact(person) {
  return collectPersonEmails(person).length > 0 && collectPersonPhoneNumbers(person).length > 0;
}

export function personHasCompleteAddress(person) {
  return Boolean(
    normalizeText(person?.address?.line_1) &&
    normalizeText(person?.address?.city) &&
    normalizeText(person?.address?.postal_code) &&
    normalizeText(person?.address?.country_code)
  );
}

export function renderPersonCardStatusLine(label, isComplete) {
  if (!isComplete) return "";
  return `<span class="booking-person-card__identity"><span class="booking-person-card__identity-check" aria-hidden="true">&#10003;</span><span>${escapeHtml(label)}</span></span>`;
}

export function getPreferredPersonDocumentType(person) {
  const passport = getPersonDocument(person, "passport");
  const national_id = getPersonDocument(person, "national_id");
  if (documentHasAnyData(passport)) return "passport";
  if (documentHasAnyData(national_id)) return "national_id";
  return "passport";
}

export function getAbbreviatedPersonName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Name";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

export function getPersonPrimaryRoleLabel(person) {
  const roles = normalizeStringList(person?.roles);
  const priority = ["primary_contact", "decision_maker", "payer", "assistant", "traveler"];
  const selected_role = priority.find((role) => roles.includes(role)) || roles[0] || "traveler";
  return formatPersonRoleLabel(selected_role);
}

export function getPersonFooterRoleLabel(person) {
  const roleLabels = normalizeStringList(person?.roles)
    .filter((role) => role !== "traveler")
    .map(formatPersonRoleLabel);
  if (!isTravelingPerson(person)) {
    return ["Not traveling", ...roleLabels].join(", ");
  }
  return roleLabels.join(", ");
}
