import { TRAVEL_GROUP_UPDATE_REQUEST_SCHEMA } from "../../../Generated/API/generated_APIModels.js";

const TRAVEL_GROUP_UPDATE_FIELDS = new Set(
  TRAVEL_GROUP_UPDATE_REQUEST_SCHEMA.fields
    .map((field) => field.name)
    .filter((name) => name && name !== "travel_group_hash")
);

const TRAVEL_GROUP_UPDATE_FIELDS_BY_NAME = Object.fromEntries(
  TRAVEL_GROUP_UPDATE_REQUEST_SCHEMA.fields.map((field) => [field.name, field])
);

function normalizeTextValue(value) {
  return String(value ?? "").trim();
}

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
    normalizeText,
    readBodyJson,
    persistStore,
    nowIso,
    computeTravelGroupHash
  } = deps;

  function membersForGroup(store, groupId) {
    return (Array.isArray(store?.travel_group_members) ? store.travel_group_members : [])
      .filter((member) => member.travel_group_id === groupId)
      .sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
  }

  function buildTravelGroupReadModel(group, members = []) {
    return {
      ...group,
      name: normalizeText(group?.name) || null,
      notes: normalizeText(group?.notes) || null,
      travel_group_hash: computeTravelGroupHash(group, members)
    };
  }

  function buildTravelGroupDetail(store, group) {
    const members = membersForGroup(store, group.id);
    return {
      travel_group: buildTravelGroupReadModel(group, members),
      members
    };
  }

  function canReadGroup(principal, booking, staffMember) {
    if (!booking) return false;
    return canReadAllBookings(principal) || canAccessBooking(principal, booking, staffMember);
  }

  function normalizeTravelGroupPatch(payload = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }

    const patch = {};
    Object.entries(payload).forEach(([key, value]) => {
      if (!TRAVEL_GROUP_UPDATE_FIELDS.has(key)) return;
      const field = TRAVEL_GROUP_UPDATE_FIELDS_BY_NAME[key];
      const normalizedValue = normalizeTextValue(value);
      if (field?.kind === "enum") {
        if (!normalizedValue) {
          return;
        }
        const allowedValues = Array.isArray(field.enumValues) ? new Set(field.enumValues) : null;
        if (normalizedValue && allowedValues && !allowedValues.has(normalizedValue)) {
          return;
        }
      }
      patch[key] = normalizedValue;
    });

    return patch;
  }

  async function assertMatchingTravelGroupHash(payload, group, members, res) {
    const requestHash = normalizeTextValue(payload?.travel_group_hash);
    const currentHash = computeTravelGroupHash(group, members);
    if (!requestHash || requestHash !== currentHash) {
      sendJson(res, 409, {
        error: "Travel group changed in backend",
        detail: "The travel group has changed in the backend. The data has been refreshed. Your changes are lost. Please do them again.",
        code: "TRAVEL_GROUP_HASH_MISMATCH",
        ...buildTravelGroupDetail({ travel_group_members: members }, group)
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
    const bookingsById = new Map((Array.isArray(store.bookings) ? store.bookings : []).map((booking) => [booking.id, booking]));

    const visible = (Array.isArray(store.travel_groups) ? store.travel_groups : [])
      .filter((group) => {
        const booking = bookingsById.get(group.booking_id);
        return canReadGroup(principal, booking, staffMember);
      })
      .map((group) => {
        const members = membersForGroup(store, group.id);
        return buildTravelGroupReadModel(group, members);
      })
      .filter((group) => {
        if (!search) return true;
        const haystack = [
          group.id,
          group.booking_id,
          group.name,
          group.group_type,
          group.notes
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

    const booking = (Array.isArray(store.bookings) ? store.bookings : []).find((item) => item.id === group.booking_id) || null;
    const principal = getPrincipal(req);
    const atp_staff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
    if (!canReadGroup(principal, booking, staffMember)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    sendJson(res, 200, buildTravelGroupDetail(store, group));
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

    const booking = (Array.isArray(store.bookings) ? store.bookings : []).find((item) => item.id === group.booking_id) || null;
    const principal = getPrincipal(req);
    const atp_staff = await loadAtpStaff();
    const staffMember = resolvePrincipalAtpStaffMember(principal, atp_staff);
    if (!booking || !canEditBooking(principal, booking, staffMember)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const members = membersForGroup(store, group.id);
    if (!(await assertMatchingTravelGroupHash(payload, group, members, res))) return;

    const patch = normalizeTravelGroupPatch(payload);
    if (!patch || !Object.keys(patch).length) {
      sendJson(res, 422, { error: "No valid fields to update" });
      return;
    }

    Object.entries(patch).forEach(([key, value]) => {
      group[key] = value;
    });
    group.updated_at = nowIso();

    await persistStore(store);
    sendJson(res, 200, buildTravelGroupDetail(store, group));
  }

  return {
    handleListTravelGroups,
    handleGetTravelGroup,
    handlePatchTravelGroup
  };
}
