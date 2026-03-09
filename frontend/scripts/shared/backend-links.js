export function buildCustomerHref(id) {
  const params = new URLSearchParams({ id });
  return `customer.html?${params.toString()}`;
}

export function buildBookingHref(id) {
  const params = new URLSearchParams({ id });
  return `booking.html?${params.toString()}`;
}

export function buildPersonsHref(search = "") {
  const params = new URLSearchParams();
  if (String(search || "").trim()) params.set("search", String(search).trim());
  const query = params.toString();
  return query ? `persons.html?${query}` : "persons.html";
}

export function buildTourEditHref(id) {
  const params = new URLSearchParams({ id });
  return `tour.html?${params.toString()}`;
}

export function buildTravelGroupHref(id) {
  const params = new URLSearchParams({ id });
  return `group.html?${params.toString()}`;
}
