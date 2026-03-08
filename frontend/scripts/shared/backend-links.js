export function buildCustomerHref(id) {
  const params = new URLSearchParams({ id });
  return `customer.html?${params.toString()}`;
}

export function buildBookingHref(id) {
  const params = new URLSearchParams({ id });
  return `booking.html?${params.toString()}`;
}

export function buildTourEditHref(id) {
  const params = new URLSearchParams({ id });
  return `tour.html?${params.toString()}`;
}

export function buildTravelGroupHref(id) {
  const params = new URLSearchParams({ id });
  return `group.html?${params.toString()}`;
}
