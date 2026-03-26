import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  normalizeLocalizedTextMap,
  resolveLocalizedText
} from "../domain/booking_content_i18n.js";
import { normalizeText } from "./text.js";

const DEFAULT_PROFILE_BLUEPRINTS = Object.freeze({
  "admin": {
    languages: ["en", "vi"],
    destinations: ["VN", "TH", "KH", "LA"],
    qualification: {
      en: "Oversees ATP trip operations across Vietnam, Thailand, Cambodia, and Laos with a strong focus on realistic pacing, reliable handovers, and calm guest support when plans need to shift."
    }
  },
  "joachim": {
    languages: ["de", "en", "vi"],
    destinations: ["VN", "TH", "KH", "LA"],
    qualification: {
      en: "Specializes in soft-paced Southeast Asia itineraries with a strong eye for comfort, recovery time, airport handovers, and multi-country routing for couples and families.",
      de: "Spezialisiert auf ruhig getaktete Südostasien-Reisen mit besonderem Blick für Komfort, Erholungszeit, Flughafenübergänge und länderübergreifende Routen für Paare und Familien."
    }
  },
  "staff": {
    languages: ["en", "vi"],
    destinations: ["VN", "TH", "KH", "LA"],
    qualification: {
      en: "Experienced in shaping beach, wellness, and family-friendly routes with practical transfer timing, light daily pacing, and dependable on-trip coordination.",
      vi: "Có kinh nghiệm xây dựng các hành trình biển, wellness và phù hợp gia đình với thời gian di chuyển hợp lý, nhịp độ nhẹ nhàng và điều phối đáng tin cậy trong suốt chuyến đi."
    }
  },
  "accountant": {
    languages: ["en", "vi"],
    destinations: ["VN", "TH", "KH", "LA"],
    qualification: {
      en: "Supports guests with clear pre-arrival coordination, payment follow-up, and practical next-step communication so the overall journey feels smooth and well prepared."
    }
  }
});

function unique(items) {
  return Array.from(new Set((Array.isArray(items) ? items : []).filter(Boolean)));
}

function normalizeLanguageCodes(items) {
  return unique((Array.isArray(items) ? items : []).map((item) => normalizeText(item).toLowerCase()));
}

function normalizeCountryCodes(items) {
  return unique((Array.isArray(items) ? items : []).map((item) => normalizeText(item).toUpperCase()));
}

function normalizeAppearsInTeamWebPage(value, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function qualificationTextFromLegacyExperiences(items) {
  return (Array.isArray(items) ? items : [])
    .map((experience) => {
      const title = normalizeText(experience?.title);
      const summary = normalizeText(experience?.summary);
      if (title && summary) return `${title}: ${summary}`;
      return title || summary || "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function qualificationMapFromEntries(items) {
  const objectValue = Object.fromEntries(
    (Array.isArray(items) ? items : [])
      .map((entry) => [normalizeText(entry?.lang).toLowerCase(), normalizeText(entry?.value)])
      .filter(([lang, value]) => Boolean(lang && value))
  );
  return normalizeLocalizedTextMap(objectValue, "en");
}

function normalizeQualificationMap(value, legacyExperiences = []) {
  if (Array.isArray(value)) {
    const fromEntries = qualificationMapFromEntries(value);
    if (Object.keys(fromEntries).length) return fromEntries;
  }
  const direct = normalizeLocalizedTextMap(value, "en");
  if (Object.keys(direct).length) return direct;
  return normalizeLocalizedTextMap(qualificationTextFromLegacyExperiences(legacyExperiences), "en");
}

function qualificationEntriesFromMap(value) {
  return Object.entries(normalizeQualificationMap(value))
    .map(([lang, text]) => ({ lang, value: text }))
    .filter((entry) => Boolean(entry.lang && entry.value));
}

function normalizeDescriptionMap(value) {
  if (Array.isArray(value)) {
    const fromEntries = qualificationMapFromEntries(value);
    if (Object.keys(fromEntries).length) return fromEntries;
  }
  return normalizeLocalizedTextMap(value, "en");
}

function normalizePositionMap(value) {
  if (Array.isArray(value)) {
    const fromEntries = qualificationMapFromEntries(value);
    if (Object.keys(fromEntries).length) return fromEntries;
  }
  return normalizeLocalizedTextMap(value, "en");
}

function descriptionEntriesFromMap(value) {
  return Object.entries(normalizeDescriptionMap(value))
    .map(([lang, text]) => ({ lang, value: text }))
    .filter((entry) => Boolean(entry.lang && entry.value));
}

function positionEntriesFromMap(value) {
  return Object.entries(normalizePositionMap(value))
    .map(([lang, text]) => ({ lang, value: text }))
    .filter((entry) => Boolean(entry.lang && entry.value));
}

function firstNameToken(value) {
  return normalizeText(value).split(/\s+/).filter(Boolean)[0] || "";
}

export function resolveAtpStaffQualificationText(profile, lang = "en") {
  return resolveLocalizedText(
    normalizeQualificationMap(profile?.qualification_i18n ?? profile?.qualification, profile?.experiences),
    lang,
    normalizeText(profile?.qualification)
  );
}

function defaultPictureFilenameForUsername(username) {
  const normalizedUsername = normalizeText(username).toLowerCase();
  return normalizedUsername ? `${normalizedUsername}.svg` : "";
}

function pictureFilenameFromStoredValue(value, username = "") {
  const normalized = normalizeText(value);
  if (!normalized) return defaultPictureFilenameForUsername(username);
  const publicMatch = normalized.match(/\/public\/v1\/atp-staff-photos\/([^/?#]+)$/i);
  const candidate = publicMatch
    ? decodeURIComponent(publicMatch[1])
    : path.basename(normalized);
  return normalizeText(candidate) || defaultPictureFilenameForUsername(username);
}

function pictureRefForFilename(filename, username = "") {
  const resolved = pictureFilenameFromStoredValue(filename, username);
  return resolved ? `/public/v1/atp-staff-photos/${encodeURIComponent(resolved)}` : "";
}

function normalizeStoredProfile(profile) {
  const username = normalizeText(profile?.username).toLowerCase();
  if (!username) return null;
  const legacyExperienceDestinations = normalizeCountryCodes(
    (Array.isArray(profile?.experiences) ? profile.experiences : []).flatMap((experience) => experience?.countries || [])
  );
  const qualification = normalizeQualificationMap(profile?.qualification ?? profile?.qualification_i18n, profile?.experiences);
  const position = normalizePositionMap(profile?.position ?? profile?.position_i18n);
  const description = normalizeDescriptionMap(profile?.description ?? profile?.description_i18n);
  return {
    username,
    ...(normalizeText(profile?.name) ? { name: normalizeText(profile.name) } : {}),
    ...(normalizeText(profile?.full_name) ? { full_name: normalizeText(profile.full_name) } : {}),
    ...(Object.keys(position).length ? { position } : {}),
    ...(normalizeText(profile?.friendly_short_name) ? { friendly_short_name: normalizeText(profile.friendly_short_name) } : {}),
    ...(pictureFilenameFromStoredValue(profile?.picture ?? profile?.picture_ref, username)
      ? { picture: pictureFilenameFromStoredValue(profile?.picture ?? profile?.picture_ref, username) }
      : {}),
    languages: normalizeLanguageCodes(profile?.languages ?? profile?.spoken_languages),
    ...(normalizeCountryCodes(profile?.destinations).length
      ? { destinations: normalizeCountryCodes(profile.destinations) }
      : legacyExperienceDestinations.length
        ? { destinations: legacyExperienceDestinations }
        : {}),
    appears_in_team_web_page: normalizeAppearsInTeamWebPage(profile?.appears_in_team_web_page, true),
    ...(Object.keys(qualification).length ? { qualification } : {}),
    ...(Object.keys(description).length ? { description } : {})
  };
}

function defaultDisplayNameForUser(user) {
  return normalizeText(user?.name)
    || normalizeText([user?.firstName, user?.lastName].filter(Boolean).join(" "))
    || normalizeText(user?.username)
    || "ATP Staff";
}

function defaultFullNameForUser(user) {
  return defaultDisplayNameForUser(user);
}

function defaultFriendlyShortNameForUser(user) {
  return normalizeText(user?.firstName)
    || firstNameToken(user?.friendly_short_name)
    || firstNameToken(defaultFullNameForUser(user))
    || normalizeText(user?.username)
    || "ATP";
}

function initialsForName(name, username) {
  const parts = normalizeText(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length) {
    return parts.map((part) => part.charAt(0).toUpperCase()).join("");
  }
  return normalizeText(username).slice(0, 2).toUpperCase() || "AT";
}

function colorPaletteForUsername(username) {
  const palettes = [
    ["#395b7a", "#6ca0a1", "#f2c777"],
    ["#4e6b50", "#9fc17a", "#f4d7a2"],
    ["#6a4f7b", "#c88ca8", "#f6d4b6"],
    ["#6f5a3d", "#c99a6b", "#f0d7b5"]
  ];
  const source = normalizeText(username);
  const hash = source.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palettes[hash % palettes.length];
}

function buildAvatarSvg(name, username) {
  const initials = initialsForName(name, username);
  const [start, end, accent] = colorPaletteForUsername(username);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${start}"/>
      <stop offset="100%" stop-color="${end}"/>
    </linearGradient>
  </defs>
  <rect width="720" height="720" rx="72" fill="url(#bg)"/>
  <circle cx="564" cy="148" r="38" fill="${accent}" opacity="0.95"/>
  <text x="360" y="406" text-anchor="middle" fill="#ffffff" font-size="220" font-family="Source Sans 3, Arial, sans-serif" font-weight="700">${initials}</text>
  <text x="360" y="560" text-anchor="middle" fill="#ffffff" font-size="42" font-family="Source Sans 3, Arial, sans-serif" opacity="0.9">${name}</text>
</svg>
`;
}

function genericProfileBlueprint(user) {
  return {
    languages: ["en", "vi"],
    destinations: ["VN", "TH", "KH", "LA"],
    qualification: {
      en: `${defaultDisplayNameForUser(user)} helps shape well-paced Southeast Asia routes with realistic transfer windows, calm arrival support, and practical day-to-day coordination.`
    }
  };
}

function sortProfiles(items) {
  return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    const leftName = normalizeText(left?.name) || left?.username || "";
    const rightName = normalizeText(right?.name) || right?.username || "";
    return leftName.localeCompare(rightName);
  });
}

function normalizeRoleNames(items) {
  return unique((Array.isArray(items) ? items : []).map((item) => normalizeText(item)).filter(Boolean));
}

function normalizeKeycloakUserSnapshotEntry(user) {
  const id = normalizeText(user?.id);
  if (!id) return null;
  const username = normalizeText(user?.username).toLowerCase();
  return {
    id,
    ...(username ? { username } : {}),
    ...(normalizeText(user?.name) ? { name: normalizeText(user.name) } : {}),
    active: user?.active !== false,
    roles: normalizeRoleNames(user?.roles)
  };
}

function sortKeycloakUserSnapshotItems(items) {
  return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    const leftLabel = normalizeText(left?.name) || normalizeText(left?.username) || normalizeText(left?.id);
    const rightLabel = normalizeText(right?.name) || normalizeText(right?.username) || normalizeText(right?.id);
    return leftLabel.localeCompare(rightLabel);
  });
}

function defaultStoredProfileForUser(user) {
  const username = normalizeText(user?.username).toLowerCase();
  const blueprint = DEFAULT_PROFILE_BLUEPRINTS[username] || genericProfileBlueprint(user);
  return normalizeStoredProfile({
    username,
    name: defaultDisplayNameForUser(user),
    full_name: defaultFullNameForUser(user),
    friendly_short_name: defaultFriendlyShortNameForUser(user),
    picture: defaultPictureFilenameForUsername(username),
    languages: blueprint.languages,
    destinations: blueprint.destinations,
    qualification: blueprint.qualification
  });
}

function seedProfiles() {
  return [
    defaultStoredProfileForUser({ username: "admin", name: "Admin User" }),
    defaultStoredProfileForUser({ username: "joachim", name: "Joachim Neumann" }),
    defaultStoredProfileForUser({ username: "staff", name: "Staff User" }),
    defaultStoredProfileForUser({ username: "accountant", name: "Accountant User" })
  ];
}

async function fileExists(filePath) {
  if (!filePath) return false;
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function mergeStoredProfileWithUser(profile, user) {
  const normalizedProfile = normalizeStoredProfile(profile);
  const username = normalizeText(user?.username || normalizedProfile?.username).toLowerCase();
  if (!username) return null;
  const defaultProfile = defaultStoredProfileForUser({
    username,
    name: defaultDisplayNameForUser(user || normalizedProfile || {})
  });
  const normalizedQualification = normalizeQualificationMap(normalizedProfile?.qualification);
  const defaultQualification = normalizeQualificationMap(defaultProfile?.qualification);
  const normalizedPosition = normalizePositionMap(normalizedProfile?.position);
  const defaultPosition = normalizePositionMap(defaultProfile?.position);
  const normalizedDescription = normalizeDescriptionMap(normalizedProfile?.description);
  const defaultDescription = normalizeDescriptionMap(defaultProfile?.description);
  const resolvedFullName = normalizeText(normalizedProfile?.full_name)
    || normalizeText(defaultProfile?.full_name)
    || normalizeText(user?.name)
    || defaultProfile.name;
  const resolvedFriendlyShortName = normalizeText(normalizedProfile?.friendly_short_name)
    || normalizeText(defaultProfile?.friendly_short_name)
    || defaultFriendlyShortNameForUser(user || normalizedProfile || { username });
  return {
    ...defaultProfile,
    ...normalizedProfile,
    username,
    name: normalizeText(user?.name) || normalizeText(normalizedProfile?.name) || defaultProfile.name,
    full_name: resolvedFullName,
    position: Object.keys(normalizedPosition).length ? normalizedPosition : defaultPosition,
    friendly_short_name: resolvedFriendlyShortName,
    picture: pictureFilenameFromStoredValue(normalizedProfile?.picture, username) || defaultProfile.picture,
    languages: normalizeLanguageCodes(normalizedProfile?.languages).length
      ? normalizeLanguageCodes(normalizedProfile.languages)
      : defaultProfile.languages,
    destinations: normalizeCountryCodes(normalizedProfile?.destinations).length
      ? normalizeCountryCodes(normalizedProfile.destinations)
      : defaultProfile.destinations,
    appears_in_team_web_page: normalizeAppearsInTeamWebPage(
      normalizedProfile?.appears_in_team_web_page,
      normalizeAppearsInTeamWebPage(defaultProfile?.appears_in_team_web_page, true)
    ),
    qualification: Object.keys(normalizedQualification).length ? normalizedQualification : defaultQualification,
    description: Object.keys(normalizedDescription).length ? normalizedDescription : defaultDescription
  };
}

function buildResponseProfile(profile, user) {
  const merged = mergeStoredProfileWithUser(profile, user);
  if (!merged) return null;
  const {
    picture,
    qualification,
    position,
    description,
    ...responseBase
  } = merged;
  return {
    ...responseBase,
    picture_ref: pictureRefForFilename(picture, merged.username),
    qualification: resolveLocalizedText(qualification, "en", ""),
    qualification_i18n: qualificationEntriesFromMap(qualification),
    position: resolveLocalizedText(position, "en", ""),
    position_i18n: positionEntriesFromMap(position),
    description: resolveLocalizedText(description, "en", ""),
    description_i18n: descriptionEntriesFromMap(description)
  };
}

export function createAtpStaffDirectory({
  dataPath,
  photosDir,
  keycloakUsersSnapshotPath,
  keycloakDirectory,
  writeQueueRef
}) {
  function profilesDocumentFromItems(items) {
    const staff = Object.fromEntries(
      sortProfiles(items).map((profile) => {
        const normalized = normalizeStoredProfile(profile);
        if (!normalized?.username) return [null, null];
        const {
          username,
          ...rest
        } = normalized;
        return [username, rest];
      }).filter(([username, profile]) => Boolean(username && profile))
    );
    return { staff };
  }

  function profilesFromStoredDocument(document) {
    if (Array.isArray(document?.items)) {
      return document.items;
    }
    if (document?.staff && typeof document.staff === "object" && !Array.isArray(document.staff)) {
      return Object.entries(document.staff).map(([username, profile]) => ({
        ...(profile && typeof profile === "object" ? profile : {}),
        username
      }));
    }
    return [];
  }

  async function writeAvatarIfMissing(profile) {
    const username = normalizeText(profile?.username).toLowerCase();
    if (!username) return false;
    const picture = pictureFilenameFromStoredValue(profile?.picture, username);
    const defaultPicture = defaultPictureFilenameForUsername(username);
    if (picture && picture !== defaultPicture) return false;
    const outputPath = path.join(photosDir, defaultPicture);
    if (await fileExists(outputPath)) return false;
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      buildAvatarSvg(normalizeText(profile?.full_name) || normalizeText(profile?.name) || username, username),
      "utf8"
    );
    return true;
  }

  async function readProfiles() {
    const raw = await readFile(dataPath, "utf8");
    const parsed = JSON.parse(raw);
    const sourceItems = profilesFromStoredDocument(parsed);
    let changed = false;
    const items = sourceItems
      .map((profile) => {
        const normalized = normalizeStoredProfile(profile);
        if (!normalized) {
          changed = true;
          return null;
        }
        if (JSON.stringify(profile) !== JSON.stringify(normalized)) changed = true;
        return normalized;
      })
      .filter(Boolean);
    return { items, changed };
  }

  async function persistProfiles(payload) {
    writeQueueRef.current = writeQueueRef.current.then(async () => {
      await writeFile(dataPath, `${JSON.stringify(profilesDocumentFromItems(payload?.items || []), null, 2)}\n`, "utf8");
    });
    await writeQueueRef.current;
  }

  async function readKeycloakUserSnapshot() {
    const raw = await readFile(keycloakUsersSnapshotPath, "utf8");
    const parsed = JSON.parse(raw);
    const sourceItems = Array.isArray(parsed?.items) ? parsed.items : [];
    let changed = false;
    const items = sourceItems
      .map((entry) => {
        const normalized = normalizeKeycloakUserSnapshotEntry(entry);
        if (!normalized) {
          changed = true;
          return null;
        }
        if (JSON.stringify(entry) !== JSON.stringify(normalized)) changed = true;
        return normalized;
      })
      .filter(Boolean);
    return { items: sortKeycloakUserSnapshotItems(items), changed };
  }

  async function persistKeycloakUserSnapshot(payload) {
    writeQueueRef.current = writeQueueRef.current.then(async () => {
      await writeFile(keycloakUsersSnapshotPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    });
    await writeQueueRef.current;
  }

  async function ensureKeycloakUserSnapshotStorage() {
    await mkdir(path.dirname(keycloakUsersSnapshotPath), { recursive: true });
    if (!(await fileExists(keycloakUsersSnapshotPath))) {
      await writeFile(keycloakUsersSnapshotPath, `${JSON.stringify({ items: [] }, null, 2)}\n`, "utf8");
    }
    const payload = await readKeycloakUserSnapshot().catch(() => ({ items: [], changed: true }));
    if (payload.changed) {
      await persistKeycloakUserSnapshot({ items: payload.items });
    }
  }

  async function listCachedAssignableUsers() {
    await ensureKeycloakUserSnapshotStorage();
    const payload = await readKeycloakUserSnapshot().catch(() => ({ items: [] }));
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  async function listCachedAssignableStaffUsers() {
    const [users, profiles] = await Promise.all([
      listCachedAssignableUsers(),
      readProfiles().catch(() => ({ items: [] }))
    ]);
    const profilesByUsername = new Map(
      (Array.isArray(profiles?.items) ? profiles.items : []).map((profile) => [normalizeText(profile?.username).toLowerCase(), profile])
    );
    return (Array.isArray(users) ? users : []).map((user) => ({
      ...user,
      staff_profile: buildResponseProfile(profilesByUsername.get(normalizeText(user?.username).toLowerCase()), user)
    }));
  }

  async function syncKeycloakUserSnapshotFromUsers(users) {
    await ensureKeycloakUserSnapshotStorage();
    const stored = await readKeycloakUserSnapshot().catch(() => ({ items: [], changed: false }));
    const itemsById = new Map(
      (Array.isArray(stored?.items) ? stored.items : [])
        .map((item) => [normalizeText(item?.id), normalizeKeycloakUserSnapshotEntry(item)])
        .filter(([id, item]) => Boolean(id && item))
    );
    const liveIds = new Set();

    for (const user of Array.isArray(users) ? users : []) {
      const normalized = normalizeKeycloakUserSnapshotEntry(user);
      if (!normalized) continue;
      itemsById.set(normalized.id, normalized);
      liveIds.add(normalized.id);
    }

    for (const [id, item] of itemsById.entries()) {
      if (liveIds.has(id)) continue;
      itemsById.set(id, {
        ...item,
        active: false
      });
    }

    const nextItems = sortKeycloakUserSnapshotItems(Array.from(itemsById.values()));
    if (JSON.stringify(Array.isArray(stored?.items) ? stored.items : []) !== JSON.stringify(nextItems)) {
      await persistKeycloakUserSnapshot({ items: nextItems });
    }
    return nextItems;
  }

  async function ensureStorage() {
    await mkdir(path.dirname(dataPath), { recursive: true });
    await mkdir(photosDir, { recursive: true });
    if (!(await fileExists(dataPath))) {
      await writeFile(dataPath, `${JSON.stringify(profilesDocumentFromItems(seedProfiles()), null, 2)}\n`, "utf8");
    }
    const payload = await readProfiles().catch(() => ({ items: seedProfiles(), changed: true }));
    let changed = Boolean(payload.changed);
    for (const profile of payload.items) {
      if (await writeAvatarIfMissing(profile)) changed = true;
      if (!normalizeText(profile.picture)) {
        profile.picture = defaultPictureFilenameForUsername(profile.username);
        changed = true;
      }
    }
    if (changed) {
      await persistProfiles({ items: payload.items });
    }
    await ensureKeycloakUserSnapshotStorage();
  }

  async function syncProfilesFromKeycloak() {
    await ensureStorage();
    const stored = await readProfiles();
    const itemsByUsername = new Map(stored.items.map((profile) => [profile.username, profile]));
    let changed = Boolean(stored.changed);
    const users = await keycloakDirectory.listAssignableUsers().catch(() => []);
    await syncKeycloakUserSnapshotFromUsers(users).catch(() => []);
    for (const user of users) {
      const username = normalizeText(user?.username).toLowerCase();
      if (!username) continue;
      const mergedStored = mergeStoredProfileWithUser(itemsByUsername.get(username), user);
      if (!mergedStored) continue;
      if (JSON.stringify(itemsByUsername.get(username) || null) !== JSON.stringify(mergedStored)) {
        itemsByUsername.set(username, mergedStored);
        changed = true;
      }
      if (await writeAvatarIfMissing(mergedStored)) changed = true;
    }
    const nextItems = sortProfiles(Array.from(itemsByUsername.values()));
    if (changed) {
      await persistProfiles({ items: nextItems });
    }
    return nextItems;
  }

  function resolvePhotoDiskPath(rawRelativePath) {
    const relativePath = normalizeText(rawRelativePath).replace(/^\/+/, "");
    if (!relativePath) return null;
    const absolutePath = path.resolve(photosDir, relativePath);
    if (!absolutePath.startsWith(path.resolve(photosDir) + path.sep)) return null;
    return absolutePath;
  }

  async function listAssignableStaffUsers() {
    const [users, profiles] = await Promise.all([
      keycloakDirectory.listAssignableUsers(),
      syncProfilesFromKeycloak().catch(() => [])
    ]);
    const profilesByUsername = new Map(
      (Array.isArray(profiles) ? profiles : []).map((profile) => [normalizeText(profile?.username).toLowerCase(), profile])
    );
    return (Array.isArray(users) ? users : []).map((user) => ({
      ...user,
      staff_profile: buildResponseProfile(profilesByUsername.get(normalizeText(user?.username).toLowerCase()), user)
    }));
  }

  async function findAssignableUserByUsername(rawUsername) {
    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) return null;
    const users = await keycloakDirectory.listAssignableUsers().catch(() => []);
    return (Array.isArray(users) ? users : []).find((user) => normalizeText(user?.username).toLowerCase() === username) || null;
  }

  async function buildDirectoryEntryForUsername(rawUsername) {
    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) return null;
    const user = await findAssignableUserByUsername(username);
    if (!user) return null;
    const profiles = await syncProfilesFromKeycloak().catch(() => []);
    const stored = (Array.isArray(profiles) ? profiles : []).find((profile) => normalizeText(profile?.username).toLowerCase() === username);
    return {
      ...user,
      staff_profile: buildResponseProfile(stored, user)
    };
  }

  async function updateProfileByUsername(rawUsername, input = {}) {
    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) return null;
    const user = await findAssignableUserByUsername(username);
    if (!user) return null;

    await ensureStorage();
    const stored = await readProfiles();
    const itemsByUsername = new Map(stored.items.map((profile) => [profile.username, profile]));
    const currentStored = itemsByUsername.get(username) || null;
    const current = mergeStoredProfileWithUser(currentStored, user);
    const nextStored = normalizeStoredProfile({
      username,
      name: normalizeText(currentStored?.name) || normalizeText(current?.name) || defaultDisplayNameForUser(user),
      full_name: input?.full_name !== undefined ? input.full_name : current?.full_name,
      position: input?.position_i18n !== undefined
        ? input.position_i18n
        : input?.position !== undefined
          ? input.position
          : current?.position,
      friendly_short_name: input?.friendly_short_name !== undefined ? input.friendly_short_name : current?.friendly_short_name,
      picture: pictureFilenameFromStoredValue(currentStored?.picture ?? current?.picture_ref, username),
      languages: Array.isArray(input?.languages) ? input.languages : current?.languages,
      destinations: Array.isArray(input?.destinations) ? input.destinations : current?.destinations,
      appears_in_team_web_page: input?.appears_in_team_web_page !== undefined
        ? normalizeAppearsInTeamWebPage(input.appears_in_team_web_page, true)
        : normalizeAppearsInTeamWebPage(current?.appears_in_team_web_page, true),
      qualification: input?.qualification_i18n !== undefined
        ? input.qualification_i18n
        : input?.qualification !== undefined
          ? input.qualification
          : current?.qualification,
      description: input?.description_i18n !== undefined
        ? input.description_i18n
        : input?.description !== undefined
          ? input.description
          : current?.description
    });
    if (!nextStored) return null;
    itemsByUsername.set(username, nextStored);
    await writeAvatarIfMissing(nextStored);
    await persistProfiles({ items: sortProfiles(Array.from(itemsByUsername.values())) });
    return buildDirectoryEntryForUsername(username);
  }

  async function setPictureRefByUsername(rawUsername, pictureRef) {
    const username = normalizeText(rawUsername).toLowerCase();
    const normalizedPicture = pictureFilenameFromStoredValue(pictureRef, username);
    if (!username || !normalizedPicture) return null;
    const user = await findAssignableUserByUsername(username);
    if (!user) return null;

    await ensureStorage();
    const stored = await readProfiles();
    const itemsByUsername = new Map(stored.items.map((profile) => [profile.username, profile]));
    const currentStored = itemsByUsername.get(username) || null;
    const current = mergeStoredProfileWithUser(currentStored, user);
    const nextStored = normalizeStoredProfile({
      username,
      name: normalizeText(currentStored?.name) || normalizeText(current?.name) || defaultDisplayNameForUser(user),
      full_name: current?.full_name,
      position: current?.position,
      friendly_short_name: current?.friendly_short_name,
      picture: normalizedPicture,
      languages: current?.languages,
      destinations: current?.destinations,
      appears_in_team_web_page: normalizeAppearsInTeamWebPage(current?.appears_in_team_web_page, true),
      qualification: current?.qualification,
      description: current?.description
    });
    if (!nextStored) return null;
    itemsByUsername.set(username, nextStored);
    await persistProfiles({ items: sortProfiles(Array.from(itemsByUsername.values())) });
    return buildDirectoryEntryForUsername(username);
  }

  async function resetPictureByUsername(rawUsername) {
    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) return null;
    const user = await findAssignableUserByUsername(username);
    await writeAvatarIfMissing({
      username,
      name: normalizeText(user?.name) || username
    });
    return setPictureRefByUsername(username, defaultPictureFilenameForUsername(username));
  }

  async function resolveAssignedStaffProfile(keycloakUserId) {
    const normalizedUserId = normalizeText(keycloakUserId);
    if (!normalizedUserId) return null;
    await ensureStorage();
    const snapshot = await readKeycloakUserSnapshot().catch(() => ({ items: [] }));
    const user = (Array.isArray(snapshot?.items) ? snapshot.items : [])
      .find((item) => normalizeText(item?.id) === normalizedUserId) || null;
    const username = normalizeText(user?.username).toLowerCase();
    const storedProfiles = await readProfiles().catch(() => ({ items: [] }));
    const stored = username
      ? (Array.isArray(storedProfiles?.items) ? storedProfiles.items : [])
        .find((profile) => normalizeText(profile?.username).toLowerCase() === username)
      : null;
    if (!stored && !user) return null;
    return buildResponseProfile(stored, user || { id: normalizedUserId, username: "", name: "", active: false, roles: [] });
  }

  async function primeLocalKeycloakSnapshot() {
    await ensureStorage();
    const users = await keycloakDirectory.listAssignableUsers().catch(() => []);
    return syncKeycloakUserSnapshotFromUsers(users);
  }

  return {
    ensureStorage,
    readProfiles,
    persistProfiles,
    syncProfilesFromKeycloak,
    listAssignableStaffUsers,
    buildDirectoryEntryForUsername,
    updateProfileByUsername,
    setPictureRefByUsername,
    resetPictureByUsername,
    listCachedAssignableUsers,
    listCachedAssignableStaffUsers,
    primeLocalKeycloakSnapshot,
    resolveAssignedStaffProfile,
    resolvePhotoDiskPath
  };
}
