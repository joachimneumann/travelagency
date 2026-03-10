import { normalizeText } from "../../lib/text.js";

export function createAtpStaffHandlers(deps) {
  const {
    getPrincipal,
    canViewAtpStaffDirectory,
    loadAtpStaff,
    staffUsernames,
    canManageAtpStaff,
    readBodyJson,
    normalizeStringArray,
    persistAtpStaff,
    randomUUID,
    sendJson
  } = deps;

  async function handleListAtpStaff(req, res) {
    const principal = getPrincipal(req);
    if (!canViewAtpStaffDirectory(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const requestUrl = new URL(req.url, "http://localhost");
    const onlyActive = normalizeText(requestUrl.searchParams.get("active")) !== "false";
    const atpStaff = await loadAtpStaff();
    const items = atpStaff
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

    const atpStaff = await loadAtpStaff();
    const usernameSet = new Set(usernames);
    const duplicate = atpStaff.find((member) => {
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

    atpStaff.push(member);
    await persistAtpStaff(atpStaff);
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
    handleListAtpStaff,
    handleCreateAtpStaff
  };
}
