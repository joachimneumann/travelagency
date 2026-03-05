export function createCustomerHandlers(deps) {
  const {
    getPrincipal,
    canReadCustomers,
    sendJson,
    readStore,
    normalizeText,
    paginate,
    buildPaginatedListResponse,
    buildBookingReadModel,
    canViewAtpStaffDirectory,
    loadAtpStaff,
    staffUsernames,
    canManageAtpStaff,
    readBodyJson,
    normalizeStringArray,
    persistAtpStaff,
    randomUUID
  } = deps;

async function handleListCustomers(req, res) {
  const principal = getPrincipal(req);
  if (!canReadCustomers(principal)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  const store = await readStore();
  const requestUrl = new URL(req.url, "http://localhost");
  const search = normalizeText(requestUrl.searchParams.get("search")).toLowerCase();
  const pageQuery = requestUrl.searchParams;

  const filtered = [...store.customers]
    .filter((customer) => {
      if (!search) return true;
      const haystack = [customer.name, customer.email, customer.phone, customer.language].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) =>
      String(b.created_at || b.updated_at || "").localeCompare(String(a.created_at || a.updated_at || ""))
    );
  const paged = paginate(filtered, pageQuery);
  sendJson(res, 200, buildPaginatedListResponse(paged));
}

async function handleGetCustomer(req, res, [customerId]) {
  const principal = getPrincipal(req);
  if (!canReadCustomers(principal)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  const store = await readStore();
  const customer = store.customers.find((item) => item.id === customerId);
  if (!customer) {
    sendJson(res, 404, { error: "Customer not found" });
    return;
  }

  const bookings = store.bookings
    .filter((booking) => booking.customer_id === customer.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(async (booking) => await buildBookingReadModel(booking));

  const bookingsReadModel = await Promise.all(bookings);

  sendJson(res, 200, { customer, bookings: bookingsReadModel });
}

async function handleListAtpStaff(req, res) {
  const principal = getPrincipal(req);
  if (!canViewAtpStaffDirectory(principal)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }
  const requestUrl = new URL(req.url, "http://localhost");
  const onlyActive = normalizeText(requestUrl.searchParams.get("active")) !== "false";
  const atp_staff = await loadAtpStaff();
  const items = atp_staff
    .filter((member) => (onlyActive ? member.active : true))
    .map((member) => ({
      id: member.id,
      name: member.name,
      active: Boolean(member.active),
      usernames: staffUsernames(member),
      destinations: Array.isArray(member.destinations) ? member.destinations : [],
      languages: Array.isArray(member.languages) ? member.languages : []
    }))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  sendJson(res, 200, { items, total: items.length });
}

async function handleCreateAtpStaff(req, res) {
  const principal = getPrincipal(req);
  if (!canManageAtpStaff(principal)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const name = normalizeText(payload.name);
  const usernames = Array.from(
    new Set(
      (Array.isArray(payload.usernames) ? payload.usernames : String(payload.usernames || "").split(","))
        .map((value) => normalizeText(value).toLowerCase())
        .filter(Boolean)
    )
  );
  const destinations = normalizeStringArray(payload.destinations);
  const languages = normalizeStringArray(payload.languages);

  if (!name) {
    sendJson(res, 422, { error: "name is required" });
    return;
  }

  if (!usernames.length) {
    sendJson(res, 422, { error: "at least one username is required" });
    return;
  }

  const atp_staff = await loadAtpStaff();
  const usernameSet = new Set(usernames);
  const duplicate = atp_staff.find((member) => {
    const existing = new Set(staffUsernames(member));
    return Array.from(usernameSet).some((username) => existing.has(username));
  });
  if (duplicate) {
    sendJson(res, 409, { error: `username already in use by ${duplicate.name}` });
    return;
  }

  const member = {
    id: `staff_${randomUUID()}`,
    name,
    active: payload.active !== false,
    usernames,
    destinations,
    languages
  };

  atp_staff.push(member);
  await persistAtpStaff(atp_staff);
  sendJson(res, 201, {
    atp_staff: {
      id: member.id,
      name: member.name,
      active: member.active,
      usernames: member.usernames,
      destinations: member.destinations,
      languages: member.languages
    }
  });
}

  return {
    handleListCustomers,
    handleGetCustomer,
    handleListAtpStaff,
    handleCreateAtpStaff
  };
}
