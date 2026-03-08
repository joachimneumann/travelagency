import { normalizeText } from "../../../../../shared/js/text.js";

const TRAVEL_GROUP_UPDATE_FIELDS = new Set(["group_name", "group_contact_customer_id", "traveler_customer_ids"]);

export function createTravelGroupHandlers(deps) {
  const {
    sendJson,
    readStore,
    getPrincipal,
    loadAtpStaff,
    resolvePrincipalAtpStaffMember,
    canReadAllBookings,
    canAccessBooking,
    canEditBooking,
    buildPaginatedListResponse,
    paginate,
    readBodyJson,
    persistStore,
    nowIso,
    computeTravelGroupHash,
    computeClientHash,
    randomUUID
  } = deps;

  function memberCustomerIdsForGroup(group) {
    return Array.from(
      new Set((Array.isArray(group?.traveler_customer_ids) ? group.traveler_customer_ids : []).map((id) => normalizeText(id)).filter(Boolean))
    );
  }

  function memberCustomersForGroup(store, group) {
    const customerIds = new Set(memberCustomerIdsForGroup(group));
    return (Array.isArray(store?.customers) ? store.customers : [])
      .filter((customer) => customerIds.has(normalizeText(customer.client_id)))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }

  function membersForGroup(group) {
    return memberCustomerIdsForGroup(group).map((customerClientId, index) => ({
      id: `travel_group_member_${group.id}_${index + 1}`,
      travel_group_id: group.id,
      customer_client_id: customerClientId
    }));
  }

  function clientForGroup(store, group) {
    return (Array.isArray(store?.clients) ? store.clients : []).find((client) => client.id === group.client_id) || null;
  }

  function groupContactCustomerForGroup(store, group) {
    const customerClientId = normalizeText(group?.group_contact_customer_id);
    if (!customerClientId) return null;
    return (Array.isArray(store?.customers) ? store.customers : []).find((customer) => customer.client_id === customerClientId) || null;
  }

  function buildTravelGroupReadModel(group) {
    return {
      ...group,
      group_name: normalizeText(group?.group_name) || "",
      group_contact_customer_id: normalizeText(group?.group_contact_customer_id) || null,
      traveler_customer_ids: memberCustomerIdsForGroup(group),
      travel_group_hash: computeTravelGroupHash(group)
    };
  }

  function buildClientReadModel(client, group, groupContactCustomer = null) {
    if (!client) return null;
    return {
      ...client,
      client_hash: computeClientHash(client),
      display_name: normalizeText(group?.group_name) || "",
      primary_phone_number: normalizeText(groupContactCustomer?.phone_number) || null,
      primary_email: normalizeText(groupContactCustomer?.email) || null
    };
  }

  function buildTravelGroupDetail(store, group) {
    const members = membersForGroup(group);
    const groupContactCustomer = groupContactCustomerForGroup(store, group);
    return {
      client: buildClientReadModel(clientForGroup(store, group), group, groupContactCustomer),
      travel_group: buildTravelGroupReadModel(group),
      members,
      memberCustomers: memberCustomersForGroup(store, group)
    };
  }

  function relatedBookings(store, group) {
    return (Array.isArray(store?.bookings) ? store.bookings : [])
      .filter((booking) => booking.client_id === group.client_id)
      .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
  }

  function canReadGroup(principal, bookings, staffMember) {
    if (!Array.isArray(bookings) || !bookings.length) {
      return canReadAllBookings(principal) || Boolean(staffMember);
    }
    return canReadAllBookings(principal) || bookings.some((booking) => canAccessBooking(principal, booking, staffMember));
  }

  function canCreateOrEditStandaloneGroup(principal, staffMember) {
    return canReadAllBookings(principal) || Boolean(staffMember);
  }

  function normalizeTravelGroupCreate(payload = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

    const create = {};
    Object.entries(payload).forEach(([key, value]) => {
      if (!TRAVEL_GROUP_UPDATE_FIELDS.has(key)) return;
      if (key === "traveler_customer_ids") {
        create[key] = Array.isArray(value) ? Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean))) : [];
        return;
      }
      create[key] = normalizeText(value);
    });

    if (!normalizeText(create.group_name)) return null;
    if (!Array.isArray(create.traveler_customer_ids)) create.traveler_customer_ids = [];
    return create;
  }

  function normalizeTravelGroupPatch(payload = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

    const patch = {};
    Object.entries(payload).forEach(([key, value]) => {
      if (!TRAVEL_GROUP_UPDATE_FIELDS.has(key)) return;
      if (key === "traveler_customer_ids") {
        patch[key] = Array.isArray(value) ? Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean))) : [];
        return;
      }
      patch[key] = normalizeText(value);
    });

    return patch;
  }

  async function assertMatchingTravelGroupHash(payload, group, store, res) {
    const requestHash = normalizeText(payload?.travel_group_hash);
    const currentHash = computeTravelGroupHash(group);
    if (!requestHash || requestHash !== currentHash) {
      sendJson(res, 409, {
        error: "Travel group changed in backend",
        detail: "The travel group has changed in the backend. The data has been refreshed. Your changes are lost. Please do them again.",
        code: "TRAVEL_GROUP_HASH_MISMATCH",
        ...buildTravelGroupDetail(store, group)
      });
      return false;
    }
    return true;
  }

  async function handleListTravelGroups(req, res) {
    const store = await readStore();
    const principal = getPrincipal(req);
    const atp_staff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
    if (!canReadAllBookings(principal) && !staffMember) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const requestUrl = new URL(req.url, "http://localhost");
    const search = normalizeText(requestUrl.searchParams.get("search")).toLowerCase();

    const visible = (Array.isArray(store.travel_groups) ? store.travel_groups : [])
      .filter((group) => canReadGroup(principal, relatedBookings(store, group), staffMember))
      .map((group) => buildTravelGroupReadModel(group))
      .filter((group) => {
        if (!search) return true;
        const haystack = [
          group.id,
          group.client_id,
          group.group_name,
          group.group_contact_customer_id,
          ...(Array.isArray(group.traveler_customer_ids) ? group.traveler_customer_ids : [])
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));

    const paged = paginate(visible, requestUrl.searchParams);
    sendJson(res, 200, buildPaginatedListResponse(paged));
  }

  async function handleGetTravelGroup(req, res, [travelGroupId]) {
    const store = await readStore();
    const group = (Array.isArray(store.travel_groups) ? store.travel_groups : []).find((item) => item.id === travelGroupId);
    if (!group) {
      sendJson(res, 404, { error: "Travel group not found" });
      return;
    }

    const principal = getPrincipal(req);
    const atp_staff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
    const bookings = relatedBookings(store, group);
    if (!canReadGroup(principal, bookings, staffMember)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    sendJson(res, 200, buildTravelGroupDetail(store, group));
  }

  async function handleCreateTravelGroup(req, res) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const principal = getPrincipal(req);
    const atp_staff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
    if (!canCreateOrEditStandaloneGroup(principal, staffMember)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const create = normalizeTravelGroupCreate(payload);
    if (!create) {
      sendJson(res, 422, { error: "Missing required field: group_name" });
      return;
    }

    const store = await readStore();
    store.clients = Array.isArray(store.clients) ? store.clients : [];
    store.travel_groups = Array.isArray(store.travel_groups) ? store.travel_groups : [];

    const now = nowIso();
    const client = {
      id: `client_${randomUUID()}`,
      client_type: "travel_group"
    };
    client.client_hash = computeClientHash(client);

    const group = {
      id: `travel_group_${randomUUID()}`,
      client_id: client.id,
      group_name: create.group_name,
      group_contact_customer_id: create.group_contact_customer_id || null,
      traveler_customer_ids: Array.isArray(create.traveler_customer_ids) ? create.traveler_customer_ids : [],
      created_at: now,
      updated_at: now,
      archived_at: null
    };
    group.travel_group_hash = computeTravelGroupHash(group);

    store.clients.push(client);
    store.travel_groups.push(group);

    await persistStore(store);
    sendJson(res, 201, buildTravelGroupDetail(store, group));
  }

  async function handlePatchTravelGroup(req, res, [travelGroupId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const store = await readStore();
    const group = (Array.isArray(store.travel_groups) ? store.travel_groups : []).find((item) => item.id === travelGroupId);
    if (!group) {
      sendJson(res, 404, { error: "Travel group not found" });
      return;
    }

    const principal = getPrincipal(req);
    const atp_staff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
    const bookings = relatedBookings(store, group);
    if ((!bookings.length && !canCreateOrEditStandaloneGroup(principal, staffMember)) ||
      (bookings.length && !bookings.some((booking) => canEditBooking(principal, booking, staffMember)))) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    if (!(await assertMatchingTravelGroupHash(payload, group, store, res))) return;

    const patch = normalizeTravelGroupPatch(payload);
    if (!patch || !Object.keys(patch).length) {
      sendJson(res, 422, { error: "No valid fields to update" });
      return;
    }

    Object.entries(patch).forEach(([key, value]) => {
      group[key] = value;
    });
    group.updated_at = nowIso();
    group.travel_group_hash = computeTravelGroupHash(group);

    await persistStore(store);
    sendJson(res, 200, buildTravelGroupDetail(store, group));
  }

  return {
    handleListTravelGroups,
    handleCreateTravelGroup,
    handleGetTravelGroup,
    handlePatchTravelGroup
  };
}
