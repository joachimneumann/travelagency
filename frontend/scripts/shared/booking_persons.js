import { normalizeText } from "./api.js?v=741a535307b3";

export function normalizeStringList(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
  );
}

export function getBookingPersons(booking) {
  if (!Array.isArray(booking?.persons)) return [];
  return booking.persons
    .filter((person) => person && typeof person === "object" && !Array.isArray(person))
    .map((person, index) => ({
      ...person,
      id: normalizeText(person.id) || `person_${index + 1}`,
      name: normalizeText(person.name) || "",
      roles: normalizeStringList(person.roles),
      emails: Array.from(
        new Set(
          [person?.email, ...(Array.isArray(person?.emails) ? person.emails : [])]
            .map((value) => normalizeText(value))
            .filter(Boolean)
        )
      ),
      phone_numbers: Array.from(
        new Set(
          [person?.phone_number, person?.phone, ...(Array.isArray(person?.phone_numbers) ? person.phone_numbers : [])]
            .map((value) => normalizeText(value))
            .filter(Boolean)
        )
      )
    }));
}

export function isTravelingPerson(person) {
  return normalizeStringList(person?.roles).includes("traveler");
}

export function getRepresentativeTraveler(booking_or_persons) {
  const persons = Array.isArray(booking_or_persons)
    ? booking_or_persons
    : getBookingPersons(booking_or_persons);
  const travelers = persons.filter(isTravelingPerson);

  if (travelers.length === 1) return travelers[0];
  if (travelers.length > 1) {
    return travelers.find((person) => {
      const roles = normalizeStringList(person?.roles);
      return roles.includes("primary_contact") || roles.includes("decision_maker") || roles.includes("payer");
    }) || travelers[0];
  }
  return null;
}

export function getPersonInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "P";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}
