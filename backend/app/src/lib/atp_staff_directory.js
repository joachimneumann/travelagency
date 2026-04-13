import { existsSync, statSync } from "node:fs";
import { access, appendFile, copyFile, mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  normalizeLocalizedTextMap,
  resolveLocalizedText
} from "../domain/booking_content_i18n.js";
import { normalizeDisplayLineBreaks, normalizeText } from "./text.js";

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

function normalizeTeamOrder(value) {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number" && Number.isInteger(value) && Number.isFinite(value)) return value;
  const normalized = normalizeText(value);
  if (!normalized || !/^-?\d+$/.test(normalized)) return undefined;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function localizedTextMapFromEntries(items) {
  const objectValue = Object.fromEntries(
    (Array.isArray(items) ? items : [])
      .map((entry) => [normalizeText(entry?.lang).toLowerCase(), normalizeText(entry?.value)])
      .filter(([lang, value]) => Boolean(lang && value))
  );
  return normalizeLocalizedTextMap(objectValue, "en");
}

function normalizeDescriptionMap(value) {
  if (Array.isArray(value)) {
    const fromEntries = localizedTextMapFromEntries(value);
    if (Object.keys(fromEntries).length) return fromEntries;
  }
  return normalizeLocalizedTextMap(value, "en");
}

function normalizeShortDescriptionMap(value) {
  if (Array.isArray(value)) {
    const fromEntries = localizedTextMapFromEntries(value);
    if (Object.keys(fromEntries).length) return fromEntries;
  }
  return normalizeLocalizedTextMap(value, "en");
}

function normalizePositionMap(value) {
  if (Array.isArray(value)) {
    const fromEntries = localizedTextMapFromEntries(value);
    if (Object.keys(fromEntries).length) return fromEntries;
  }
  return normalizeLocalizedTextMap(value, "en");
}

function descriptionEntriesFromMap(value) {
  return Object.entries(normalizeDescriptionMap(value))
    .map(([lang, text]) => ({ lang, value: text }))
    .filter((entry) => Boolean(entry.lang && entry.value));
}

function shortDescriptionEntriesFromMap(value) {
  return Object.entries(normalizeShortDescriptionMap(value))
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
  return "";
}

export function resolveAtpStaffShortDescriptionText(profile, lang = "en") {
  return normalizeDisplayLineBreaks(resolveLocalizedText(
    normalizeShortDescriptionMap(profile?.short_description_i18n ?? profile?.short_description),
    lang,
    normalizeText(profile?.short_description)
  ));
}

function avatarPictureFilenameForUsername(username) {
  const normalizedUsername = normalizeText(username).toLowerCase();
  return normalizedUsername ? `${normalizedUsername}.svg` : "";
}

function preferredPictureFilenameForUsername(username, photosDir = "") {
  const normalizedUsername = normalizeText(username).toLowerCase();
  if (!normalizedUsername) return "";
  const webpFilename = `${normalizedUsername}.webp`;
  if (photosDir && existsSync(path.join(photosDir, webpFilename))) return webpFilename;
  return avatarPictureFilenameForUsername(normalizedUsername);
}

function pictureFilenameFromStoredValue(value, username = "", photosDir = "") {
  const normalized = normalizeText(value);
  if (!normalized) return preferredPictureFilenameForUsername(username, photosDir);
  const staticMatch = normalized.match(/\/content\/atp_staff\/photos\/([^/?#]+)$/i);
  const legacyPublicMatch = normalized.match(/\/public\/v1\/atp-staff-photos\/([^/?#]+)$/i);
  const candidate = staticMatch
    ? decodeURIComponent(staticMatch[1])
    : legacyPublicMatch
      ? decodeURIComponent(legacyPublicMatch[1])
      : path.basename(normalized);
  const normalizedCandidate = normalizeText(candidate);
  const preferredFilename = preferredPictureFilenameForUsername(username, photosDir);
  if (!normalizedCandidate) return preferredFilename;
  if (normalizedCandidate === avatarPictureFilenameForUsername(username)) return preferredFilename;
  return normalizedCandidate;
}

function withAssetVersion(value, version) {
  const normalizedValue = normalizeText(value);
  const normalizedVersion = normalizeText(version);
  if (!normalizedValue || !normalizedVersion) return normalizedValue;
  const absolute = /^https?:\/\//i.test(normalizedValue);
  const url = new URL(normalizedValue, "http://localhost");
  url.searchParams.set("v", normalizedVersion);
  return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

function pictureVersionForFilename(filename, username = "", photosDir = "") {
  const resolved = pictureFilenameFromStoredValue(filename, username, photosDir);
  if (!resolved || !photosDir) return "";
  try {
    const stats = statSync(path.join(photosDir, resolved));
    return String(Math.trunc(stats.mtimeMs));
  } catch {
    return "";
  }
}

function pictureRefForFilename(filename, username = "", photosDir = "") {
  const resolved = pictureFilenameFromStoredValue(filename, username, photosDir);
  if (!resolved) return "";
  return withAssetVersion(
    `/public/v1/atp-staff-photos/${encodeURIComponent(resolved)}`,
    pictureVersionForFilename(resolved, username, photosDir)
  );
}

function normalizeStoredProfile(profile) {
  const username = normalizeText(profile?.username).toLowerCase();
  if (!username) return null;
  const legacyExperienceDestinations = normalizeCountryCodes(
    (Array.isArray(profile?.experiences) ? profile.experiences : []).flatMap((experience) => experience?.countries || [])
  );
  const position = normalizePositionMap(profile?.position ?? profile?.position_i18n);
  const description = normalizeDescriptionMap(profile?.description ?? profile?.description_i18n);
  const shortDescription = normalizeShortDescriptionMap(profile?.short_description ?? profile?.short_description_i18n);
  return {
    username,
    ...(normalizeText(profile?.name) ? { name: normalizeText(profile.name) } : {}),
    ...(normalizeText(profile?.full_name) ? { full_name: normalizeText(profile.full_name) } : {}),
    ...(Object.keys(position).length ? { position } : {}),
    ...(normalizeText(profile?.friendly_short_name) ? { friendly_short_name: normalizeText(profile.friendly_short_name) } : {}),
    ...(normalizeTeamOrder(profile?.team_order) !== undefined ? { team_order: normalizeTeamOrder(profile?.team_order) } : {}),
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
    ...(Object.keys(description).length ? { description } : {}),
    ...(Object.keys(shortDescription).length ? { short_description: shortDescription } : {})
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

function sortProfiles(items) {
  return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    const leftTeamOrder = normalizeTeamOrder(left?.team_order);
    const rightTeamOrder = normalizeTeamOrder(right?.team_order);
    if (leftTeamOrder !== undefined && rightTeamOrder !== undefined && leftTeamOrder !== rightTeamOrder) {
      return leftTeamOrder - rightTeamOrder;
    }
    if (leftTeamOrder !== undefined) return -1;
    if (rightTeamOrder !== undefined) return 1;
    const leftName = normalizeText(left?.name) || left?.username || "";
    const rightName = normalizeText(right?.name) || right?.username || "";
    const byName = leftName.localeCompare(rightName);
    if (byName !== 0) return byName;
    const leftUsername = normalizeText(left?.username);
    const rightUsername = normalizeText(right?.username);
    return leftUsername.localeCompare(rightUsername);
  });
}

function normalizeRoleNames(items) {
  return unique((Array.isArray(items) ? items : []).map((item) => normalizeText(item)).filter(Boolean));
}

function collectRoleNames(user) {
  return normalizeRoleNames([
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.realm_roles) ? user.realm_roles : []),
    ...(Array.isArray(user?.client_roles) ? user.client_roles : [])
  ]);
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
    roles: collectRoleNames(user),
    realm_roles: normalizeRoleNames(user?.realm_roles),
    client_roles: normalizeRoleNames(user?.client_roles)
  };
}

function sortKeycloakUserSnapshotItems(items) {
  return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    const leftLabel = normalizeText(left?.name) || normalizeText(left?.username) || normalizeText(left?.id);
    const rightLabel = normalizeText(right?.name) || normalizeText(right?.username) || normalizeText(right?.id);
    return leftLabel.localeCompare(rightLabel);
  });
}

function isEligibleStaffUser(user, allowedStaffRoleNames) {
  const allowed = allowedStaffRoleNames instanceof Set
    ? allowedStaffRoleNames
    : new Set(normalizeRoleNames(allowedStaffRoleNames));
  if (!allowed.size) return false;
  return collectRoleNames(user).some((role) => allowed.has(role));
}

function defaultStoredProfileForUser(user, photosDir = "") {
  const username = normalizeText(user?.username).toLowerCase();
  return normalizeStoredProfile({
    username,
    name: defaultDisplayNameForUser(user),
    full_name: defaultFullNameForUser(user),
    friendly_short_name: defaultFriendlyShortNameForUser(user),
    picture: preferredPictureFilenameForUsername(username, photosDir),
    languages: [],
    destinations: [],
    appears_in_team_web_page: true
  });
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

function mergeStoredProfileWithUser(profile, user, photosDir = "") {
  const normalizedProfile = normalizeStoredProfile(profile);
  const username = normalizeText(user?.username || normalizedProfile?.username).toLowerCase();
  if (!username) return null;
  const defaultProfile = defaultStoredProfileForUser({
    username,
    name: defaultDisplayNameForUser(user || normalizedProfile || {})
  }, photosDir);
  const normalizedPosition = normalizePositionMap(normalizedProfile?.position);
  const normalizedDescription = normalizeDescriptionMap(normalizedProfile?.description);
  const normalizedShortDescription = normalizeShortDescriptionMap(normalizedProfile?.short_description);
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
    position: Object.keys(normalizedPosition).length ? normalizedPosition : {},
    friendly_short_name: resolvedFriendlyShortName,
    ...(normalizeTeamOrder(normalizedProfile?.team_order) !== undefined
      ? { team_order: normalizeTeamOrder(normalizedProfile?.team_order) }
      : {}),
    picture: pictureFilenameFromStoredValue(normalizedProfile?.picture, username, photosDir) || defaultProfile.picture,
    languages: normalizeLanguageCodes(normalizedProfile?.languages),
    destinations: normalizeCountryCodes(normalizedProfile?.destinations),
    appears_in_team_web_page: normalizeAppearsInTeamWebPage(
      normalizedProfile?.appears_in_team_web_page,
      normalizeAppearsInTeamWebPage(defaultProfile?.appears_in_team_web_page, true)
    ),
    description: Object.keys(normalizedDescription).length ? normalizedDescription : {},
    short_description: Object.keys(normalizedShortDescription).length ? normalizedShortDescription : {}
  };
}

function buildResponseProfile(profile, user, photosDir = "") {
  const merged = mergeStoredProfileWithUser(profile, user, photosDir);
  if (!merged) return null;
  const {
    picture,
    position,
    description,
    short_description,
    ...responseBase
  } = merged;
  return {
    ...responseBase,
    picture_ref: pictureRefForFilename(picture, merged.username, photosDir),
    position: resolveLocalizedText(position, "en", ""),
    position_i18n: positionEntriesFromMap(position),
    description: resolveLocalizedText(description, "en", ""),
    description_i18n: descriptionEntriesFromMap(description),
    short_description: resolveLocalizedText(short_description, "en", ""),
    short_description_i18n: shortDescriptionEntriesFromMap(short_description)
  };
}

export function createAtpStaffDirectory({
  dataPath,
  photosDir,
  legacyDataPath = "",
  legacyPhotosDir = "",
  keycloakUsersSnapshotPath,
  keycloakDirectory,
  writeQueueRef,
  staffRoleNames = []
}) {
  const allowedStaffRoleNames = new Set(normalizeRoleNames(staffRoleNames));
  const auditLogPath = `${dataPath}.audit.log`;

  function captureAuditStack() {
    return String(new Error().stack || "")
      .split("\n")
      .slice(2, 8)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  async function appendProfilesAuditLog(entry) {
    const nextEntry = {
      timestamp: new Date().toISOString(),
      data_path: dataPath,
      ...entry
    };
    const serialized = `${JSON.stringify(nextEntry)}\n`;
    await queueWrite(async () => {
      await mkdir(path.dirname(auditLogPath), { recursive: true });
      await appendFile(auditLogPath, serialized, "utf8");
    });
  }

  async function waitForQueuedWrites() {
    await Promise.resolve(writeQueueRef.current).catch(() => {});
  }

  async function queueWrite(task) {
    const queuedWrite = Promise.resolve(writeQueueRef.current)
      .catch(() => {})
      .then(task);
    writeQueueRef.current = queuedWrite;
    await queuedWrite;
  }

  async function writeTextFileAtomic(targetPath, contents) {
    const tempPath = `${targetPath}.${process.pid}.${Date.now().toString(36)}.${Math.random().toString(16).slice(2)}.tmp`;
    try {
      await writeFile(tempPath, contents, "utf8");
      await rename(tempPath, targetPath);
    } catch (error) {
      await unlink(tempPath).catch(() => {});
      throw error;
    }
  }

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
    const picture = pictureFilenameFromStoredValue(profile?.picture, username, photosDir);
    const defaultPicture = avatarPictureFilenameForUsername(username);
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
    await waitForQueuedWrites();
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
    if (sourceItems.length > 0 && items.length === 0) {
      throw new Error(`Refusing to normalize ATP staff profiles at ${dataPath} into an empty set.`);
    }
    return { items, changed };
  }

  async function persistProfiles(payload, meta = {}) {
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const document = profilesDocumentFromItems(items);
    const usernames = items
      .map((profile) => normalizeText(profile?.username).toLowerCase())
      .filter(Boolean);
    const auditEntry = {
      action: "persist_profiles",
      reason: normalizeText(meta.reason) || "unspecified",
      item_count: items.length,
      usernames,
      became_empty: items.length === 0,
      ...(items.length === 0 ? { stack: captureAuditStack() } : {})
    };
    await queueWrite(async () => {
      await writeTextFileAtomic(dataPath, `${JSON.stringify(document, null, 2)}\n`);
    });
    await appendProfilesAuditLog(auditEntry);
  }

  async function readKeycloakUserSnapshot() {
    await waitForQueuedWrites();
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
    await queueWrite(async () => {
      await writeTextFileAtomic(keycloakUsersSnapshotPath, `${JSON.stringify(payload, null, 2)}\n`);
    });
  }

  async function ensureKeycloakUserSnapshotStorage() {
    await mkdir(path.dirname(keycloakUsersSnapshotPath), { recursive: true });
    if (!(await fileExists(keycloakUsersSnapshotPath))) {
      await writeTextFileAtomic(keycloakUsersSnapshotPath, `${JSON.stringify({ items: [] }, null, 2)}\n`);
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

  function filterEligibleStaffUsers(items, { activeOnly = false } = {}) {
    return sortKeycloakUserSnapshotItems(
      (Array.isArray(items) ? items : []).filter((user) => {
        if (!isEligibleStaffUser(user, allowedStaffRoleNames)) return false;
        if (activeOnly && user?.active === false) return false;
        return true;
      })
    );
  }

  async function listCachedEligibleStaffUsers(options = {}) {
    const cached = await listCachedAssignableUsers();
    return filterEligibleStaffUsers(cached, options);
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
      if (legacyDataPath && await fileExists(legacyDataPath)) {
        await copyFile(legacyDataPath, dataPath);
        await appendProfilesAuditLog({
          action: "seed_profiles_from_legacy_copy",
          reason: "ensure_storage_missing_data_path",
          source_path: legacyDataPath
        });
      } else {
        await writeTextFileAtomic(dataPath, `${JSON.stringify({ staff: {} }, null, 2)}\n`);
        await appendProfilesAuditLog({
          action: "create_empty_profiles_file",
          reason: "ensure_storage_missing_data_path",
          became_empty: true,
          stack: captureAuditStack()
        });
      }
    }
    if (legacyPhotosDir && await fileExists(legacyPhotosDir)) {
      const entries = await readdir(legacyPhotosDir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (!entry?.isFile?.()) continue;
        const sourcePath = path.join(legacyPhotosDir, entry.name);
        const targetPath = path.join(photosDir, entry.name);
        if (await fileExists(targetPath)) continue;
        await copyFile(sourcePath, targetPath).catch(() => {});
      }
    }
    const payload = await readProfiles();
    let changed = Boolean(payload.changed);
    for (const profile of payload.items) {
      if (await writeAvatarIfMissing(profile)) changed = true;
      if (!normalizeText(profile.picture)) {
        profile.picture = preferredPictureFilenameForUsername(profile.username, photosDir);
        changed = true;
      }
    }
    if (changed) {
      await persistProfiles({ items: payload.items }, {
        reason: "ensure_storage_normalize_and_avatar_backfill"
      });
    }
    await ensureKeycloakUserSnapshotStorage();
  }

  async function syncProfilesFromKeycloak() {
    await ensureStorage();
    const users = await keycloakDirectory.listAllowedUsers().catch(() => []);
    await syncKeycloakUserSnapshotFromUsers(users).catch(() => []);
    const stored = await readProfiles().catch(() => ({ items: [] }));
    return Array.isArray(stored?.items) ? stored.items : [];
  }

  function resolvePhotoDiskPath(rawRelativePath) {
    const relativePath = normalizeText(rawRelativePath).replace(/^\/+/, "");
    if (!relativePath) return null;
    const absolutePath = path.resolve(photosDir, relativePath);
    if (!absolutePath.startsWith(path.resolve(photosDir) + path.sep)) return null;
    return absolutePath;
  }

  async function listEligibleStaffUsers(options = {}) {
    const { activeOnly = false } = options;
    try {
      const users = await keycloakDirectory.listAssignableUsers();
      await syncKeycloakUserSnapshotFromUsers(users).catch(() => []);
      return filterEligibleStaffUsers(users, { activeOnly });
    } catch {
      return listCachedEligibleStaffUsers({ activeOnly });
    }
  }

  async function listAllAtpUsers(options = {}) {
    const { activeOnly = false } = options;
    try {
      const users = await keycloakDirectory.listAllowedUsers();
      await syncKeycloakUserSnapshotFromUsers(users).catch(() => []);
      return sortKeycloakUserSnapshotItems(
        (Array.isArray(users) ? users : []).filter((user) => !(activeOnly && user?.active === false))
      );
    } catch {
      const cached = await listCachedAssignableUsers();
      return sortKeycloakUserSnapshotItems(
        (Array.isArray(cached) ? cached : []).filter((user) => !(activeOnly && user?.active === false))
      );
    }
  }

  async function findEligibleStaffUserByUsername(rawUsername) {
    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) return null;
    const liveUsers = await listEligibleStaffUsers().catch(() => []);
    const liveMatch = (Array.isArray(liveUsers) ? liveUsers : [])
      .find((user) => normalizeText(user?.username).toLowerCase() === username) || null;
    if (liveMatch) return liveMatch;
    const cachedUsers = await listCachedEligibleStaffUsers().catch(() => []);
    return (Array.isArray(cachedUsers) ? cachedUsers : [])
      .find((user) => normalizeText(user?.username).toLowerCase() === username) || null;
  }

  async function readStoredProfileByUsername(rawUsername) {
    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) return null;
    const stored = await readProfiles().catch(() => ({ items: [] }));
    return (Array.isArray(stored?.items) ? stored.items : [])
      .find((profile) => normalizeText(profile?.username).toLowerCase() === username) || null;
  }

  async function ensureAvatarForResponseProfile(profile) {
    if (!profile?.username) return;
    await writeAvatarIfMissing({
      username: profile.username,
      name: normalizeText(profile?.full_name) || normalizeText(profile?.name) || profile.username,
      picture: pictureFilenameFromStoredValue(profile?.picture_ref, profile.username, photosDir)
    }).catch(() => {});
  }

  async function buildDirectoryEntryForUsername(rawUsername) {
    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) return null;
    await ensureStorage();
    const users = await listAllAtpUsers().catch(() => []);
    const user = (Array.isArray(users) ? users : [])
      .find((item) => normalizeText(item?.username).toLowerCase() === username) || null;
    if (!user) return null;
    const stored = await readStoredProfileByUsername(username);
    const staffProfile = buildResponseProfile(stored, user, photosDir);
    await ensureAvatarForResponseProfile(staffProfile);
    return {
      ...user,
      staff_profile: staffProfile
    };
  }

  async function updateProfileByUsername(rawUsername, input = {}) {
    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) return null;
    const users = await listAllAtpUsers().catch(() => []);
    const user = (Array.isArray(users) ? users : [])
      .find((item) => normalizeText(item?.username).toLowerCase() === username) || null;
    if (!user) return null;

    await ensureStorage();
    const stored = await readProfiles();
    const itemsByUsername = new Map(stored.items.map((profile) => [profile.username, profile]));
    const currentStored = itemsByUsername.get(username) || null;
    const current = mergeStoredProfileWithUser(currentStored, user, photosDir);
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
      team_order: input?.team_order !== undefined ? input.team_order : current?.team_order,
      picture: pictureFilenameFromStoredValue(currentStored?.picture ?? current?.picture_ref, username, photosDir),
      languages: Array.isArray(input?.languages) ? input.languages : current?.languages,
      destinations: Array.isArray(input?.destinations) ? input.destinations : current?.destinations,
      appears_in_team_web_page: input?.appears_in_team_web_page !== undefined
        ? normalizeAppearsInTeamWebPage(input.appears_in_team_web_page, true)
        : normalizeAppearsInTeamWebPage(current?.appears_in_team_web_page, true),
      description: input?.description_i18n !== undefined
        ? input.description_i18n
        : input?.description !== undefined
          ? input.description
          : current?.description,
      short_description: input?.short_description_i18n !== undefined
        ? input.short_description_i18n
        : input?.short_description !== undefined
          ? input.short_description
          : current?.short_description
    });
    if (!nextStored) return null;
    itemsByUsername.set(username, nextStored);
    await writeAvatarIfMissing(nextStored);
    await persistProfiles({ items: sortProfiles(Array.from(itemsByUsername.values())) }, {
      reason: `update_profile_by_username:${username}`
    });
    return buildDirectoryEntryForUsername(username);
  }

  async function setPictureRefByUsername(rawUsername, pictureRef) {
    const username = normalizeText(rawUsername).toLowerCase();
    const normalizedPicture = pictureFilenameFromStoredValue(pictureRef, username, photosDir);
    if (!username || !normalizedPicture) return null;
    const users = await listAllAtpUsers().catch(() => []);
    const user = (Array.isArray(users) ? users : [])
      .find((item) => normalizeText(item?.username).toLowerCase() === username) || null;
    if (!user) return null;

    await ensureStorage();
    const stored = await readProfiles();
    const itemsByUsername = new Map(stored.items.map((profile) => [profile.username, profile]));
    const currentStored = itemsByUsername.get(username) || null;
    const current = mergeStoredProfileWithUser(currentStored, user, photosDir);
    const nextStored = normalizeStoredProfile({
      username,
      name: normalizeText(currentStored?.name) || normalizeText(current?.name) || defaultDisplayNameForUser(user),
      full_name: current?.full_name,
      position: current?.position,
      friendly_short_name: current?.friendly_short_name,
      team_order: current?.team_order,
      picture: normalizedPicture,
      languages: current?.languages,
      destinations: current?.destinations,
      appears_in_team_web_page: normalizeAppearsInTeamWebPage(current?.appears_in_team_web_page, true),
      description: current?.description,
      short_description: current?.short_description
    });
    if (!nextStored) return null;
    itemsByUsername.set(username, nextStored);
    await persistProfiles({ items: sortProfiles(Array.from(itemsByUsername.values())) }, {
      reason: `set_picture_ref_by_username:${username}`
    });
    return buildDirectoryEntryForUsername(username);
  }

  async function resetPictureByUsername(rawUsername) {
    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) return null;
    const user = await findEligibleStaffUserByUsername(username);
    await writeAvatarIfMissing({
      username,
      name: normalizeText(user?.name) || username
    });
    return setPictureRefByUsername(username, preferredPictureFilenameForUsername(username, photosDir));
  }

  async function resolveAssignedStaffProfile(keycloakUserId) {
    const normalizedUserId = normalizeText(keycloakUserId);
    if (!normalizedUserId) return null;
    await ensureStorage();
    const snapshot = await readKeycloakUserSnapshot().catch(() => ({ items: [] }));
    const user = (Array.isArray(snapshot?.items) ? snapshot.items : [])
      .find((item) => normalizeText(item?.id) === normalizedUserId) || null;
    if (!isEligibleStaffUser(user, allowedStaffRoleNames)) return null;
    const username = normalizeText(user?.username).toLowerCase();
    const stored = username ? await readStoredProfileByUsername(username) : null;
    const profile = buildResponseProfile(stored, user, photosDir);
    await ensureAvatarForResponseProfile(profile);
    return profile;
  }

  async function listPublicTeamProfiles() {
    await ensureStorage();
    const users = await listEligibleStaffUsers({ activeOnly: true });
    const storedProfiles = await readProfiles().catch(() => ({ items: [] }));
    const storedByUsername = new Map(
      (Array.isArray(storedProfiles?.items) ? storedProfiles.items : [])
        .map((profile) => [normalizeText(profile?.username).toLowerCase(), profile])
        .filter(([username, profile]) => Boolean(username && profile))
    );

    const items = [];
    for (const user of users) {
      const username = normalizeText(user?.username).toLowerCase();
      if (!username) continue;
      const profile = buildResponseProfile(storedByUsername.get(username) || null, user, photosDir);
      if (!profile || profile.appears_in_team_web_page !== true) continue;
      await ensureAvatarForResponseProfile(profile);
      items.push(profile);
    }
    return sortProfiles(items);
  }

  async function listDirectoryEntries() {
    await ensureStorage();
    const users = await listAllAtpUsers();
    const storedProfiles = await readProfiles().catch(() => ({ items: [] }));
    const storedByUsername = new Map(
      (Array.isArray(storedProfiles?.items) ? storedProfiles.items : [])
        .map((profile) => [normalizeText(profile?.username).toLowerCase(), profile])
        .filter(([username, profile]) => Boolean(username && profile))
    );
    const items = [];
    for (const user of users) {
      const username = normalizeText(user?.username).toLowerCase();
      if (!username) continue;
      const staffProfile = buildResponseProfile(storedByUsername.get(username) || null, user, photosDir);
      await ensureAvatarForResponseProfile(staffProfile);
      items.push({
        ...user,
        staff_profile: staffProfile
      });
    }
    return items.sort((left, right) => {
      const leftLabel = normalizeText(left?.name) || normalizeText(left?.username);
      const rightLabel = normalizeText(right?.name) || normalizeText(right?.username);
      return leftLabel.localeCompare(rightLabel);
    });
  }

  async function primeLocalKeycloakSnapshot() {
    await ensureStorage();
    const users = await keycloakDirectory.listAllowedUsers().catch(() => []);
    return syncKeycloakUserSnapshotFromUsers(users);
  }

  return {
    ensureStorage,
    readProfiles,
    persistProfiles,
    syncProfilesFromKeycloak,
    buildDirectoryEntryForUsername,
    updateProfileByUsername,
    setPictureRefByUsername,
    resetPictureByUsername,
    listCachedAssignableUsers,
    listCachedEligibleStaffUsers,
    listDirectoryEntries,
    listPublicTeamProfiles,
    primeLocalKeycloakSnapshot,
    resolveAssignedStaffProfile,
    resolvePhotoDiskPath
  };
}
