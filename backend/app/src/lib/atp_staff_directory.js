import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeText } from "./text.js";

const DEFAULT_PROFILE_BLUEPRINTS = Object.freeze({
  "admin": {
    languages: ["en", "vi"],
    destinations: ["VN", "TH", "KH", "LA"],
    experiences: [
      {
        id: "admin_operations_vn_th",
        title: "Operations oversight across Vietnam and Thailand",
        summary: "Keeps arrival logistics, hotel handovers, and day-by-day pacing realistic for trips that combine urban stays with recovery time."
      },
      {
        id: "admin_multicountry_coordination",
        title: "Multi-country guest support",
        summary: "Experienced in coordinating soft-paced routes across Southeast Asia with clear airport support, calm timing, and backup options when plans shift."
      }
    ]
  },
  "joachim": {
    languages: ["de", "en", "vi"],
    destinations: ["VN", "TH", "KH", "LA"],
    experiences: [
      {
        id: "joachim_central_vietnam_wellness",
        title: "Central Vietnam wellness pacing",
        summary: "Designs quiet Hoi An, Da Nang, and Hue programs with spa appointments, low-friction transfers, and enough empty space between highlights."
      },
      {
        id: "joachim_laos_cambodia_calm",
        title: "Gentle Cambodia and Laos journeys",
        summary: "Builds soft-paced Siem Reap and Luang Prabang itineraries that balance heritage visits with rest, river time, and unhurried evenings."
      },
      {
        id: "joachim_multicountry_handovers",
        title: "Cross-border handover planning",
        summary: "Experienced in smoothing multi-country airport arrivals, hotel changes, and local guide transitions for couples and families."
      }
    ]
  },
  "staff": {
    languages: ["en", "vi", "th"],
    destinations: ["VN", "TH", "KH", "LA"],
    experiences: [
      {
        id: "staff_thailand_coast_wellness",
        title: "Thailand coast and spa stays",
        summary: "Shapes Phuket and Krabi stays around beach time, practical treatment windows, and easy private transfers rather than rushed sightseeing blocks."
      },
      {
        id: "staff_family_pacing",
        title: "Family-friendly pacing",
        summary: "Good at building routes with lighter mornings, flexible lunch breaks, and realistic transit times for multi-generation travelers."
      }
    ]
  },
  "accountant": {
    languages: ["en", "vi"],
    destinations: ["VN", "TH", "KH", "LA"],
    experiences: [
      {
        id: "accountant_prearrival_support",
        title: "Pre-arrival guest support",
        summary: "Supports guests with calm pre-trip coordination, practical arrival briefings, and simple next-step communication before departure."
      },
      {
        id: "accountant_comfort_logistics",
        title: "Comfort-first logistics follow-up",
        summary: "Keeps an eye on payment, rooming, and timing details so the on-trip flow stays comfortable and clear for guests."
      }
    ]
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

function normalizeExperience(experience, index = 0) {
  const normalizedTitle = normalizeText(experience?.title);
  const normalizedSummary = normalizeText(experience?.summary);
  if (!normalizedTitle || !normalizedSummary) return null;
  return {
    ...(normalizeText(experience?.id) ? { id: normalizeText(experience.id) } : { id: `experience_${index + 1}` }),
    title: normalizedTitle,
    summary: normalizedSummary
  };
}

function normalizeProfile(profile) {
  const username = normalizeText(profile?.username).toLowerCase();
  if (!username) return null;
  const legacyExperienceDestinations = normalizeCountryCodes(
    (Array.isArray(profile?.experiences) ? profile.experiences : []).flatMap((experience) => experience?.countries || [])
  );
  return {
    username,
    ...(normalizeText(profile?.name) ? { name: normalizeText(profile.name) } : {}),
    ...(normalizeText(profile?.picture_ref) ? { picture_ref: normalizeText(profile.picture_ref) } : {}),
    languages: normalizeLanguageCodes(profile?.languages ?? profile?.spoken_languages),
    ...(normalizeCountryCodes(profile?.destinations).length
      ? { destinations: normalizeCountryCodes(profile.destinations) }
      : legacyExperienceDestinations.length
        ? { destinations: legacyExperienceDestinations }
        : {}),
    experiences: (Array.isArray(profile?.experiences) ? profile.experiences : [])
      .map((experience, index) => normalizeExperience(experience, index))
      .filter(Boolean)
  };
}

function defaultDisplayNameForUser(user) {
  return normalizeText(user?.name)
    || normalizeText([user?.firstName, user?.lastName].filter(Boolean).join(" "))
    || normalizeText(user?.username)
    || "ATP Staff";
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

function pictureRefForUsername(username) {
  return `/public/v1/atp-staff-photos/${encodeURIComponent(username)}.svg`;
}

function genericProfileBlueprint(user) {
  return {
    languages: ["en", "vi"],
    destinations: ["VN", "TH", "KH", "LA"],
    experiences: [
      {
        id: `${normalizeText(user?.username) || "staff"}_regional_guest_support`,
        title: "Regional guest support",
        summary: `${defaultDisplayNameForUser(user)} helps shape well-paced Southeast Asia routes with realistic transfer windows, calm arrival support, and practical day-to-day coordination.`
      },
      {
        id: `${normalizeText(user?.username) || "staff"}_soft_paced_itineraries`,
        title: "Soft-paced itinerary planning",
        summary: `${defaultDisplayNameForUser(user)} is comfortable balancing sightseeing with recovery time, lighter mornings, and clear guest communication throughout the trip.`
      }
    ]
  };
}

function sortProfiles(items) {
  return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    const leftName = normalizeText(left?.name) || left?.username || "";
    const rightName = normalizeText(right?.name) || right?.username || "";
    return leftName.localeCompare(rightName);
  });
}

function defaultProfileForUser(user) {
  const username = normalizeText(user?.username).toLowerCase();
  const blueprint = DEFAULT_PROFILE_BLUEPRINTS[username] || genericProfileBlueprint(user);
  return normalizeProfile({
    username,
    name: defaultDisplayNameForUser(user),
    picture_ref: pictureRefForUsername(username),
    languages: blueprint.languages,
    destinations: blueprint.destinations,
    experiences: blueprint.experiences
  });
}

function seedProfiles() {
  return [
    defaultProfileForUser({ username: "admin", name: "Admin User" }),
    defaultProfileForUser({ username: "joachim", name: "Joachim Neumann" }),
    defaultProfileForUser({ username: "staff", name: "Staff User" }),
    defaultProfileForUser({ username: "accountant", name: "Accountant User" })
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

function mergeProfileWithUser(profile, user) {
  const normalizedProfile = normalizeProfile(profile);
  const username = normalizeText(user?.username || normalizedProfile?.username).toLowerCase();
  if (!username) return null;
  const defaultProfile = defaultProfileForUser({
    username,
    name: defaultDisplayNameForUser(user || normalizedProfile || {})
  });
  return {
    ...defaultProfile,
    ...normalizedProfile,
    username,
    name: normalizeText(user?.name) || normalizeText(normalizedProfile?.name) || defaultProfile.name,
    picture_ref: normalizeText(normalizedProfile?.picture_ref) || defaultProfile.picture_ref,
    languages: normalizeLanguageCodes(normalizedProfile?.languages).length
      ? normalizeLanguageCodes(normalizedProfile.languages)
      : defaultProfile.languages,
    destinations: normalizeCountryCodes(normalizedProfile?.destinations).length
      ? normalizeCountryCodes(normalizedProfile.destinations)
      : defaultProfile.destinations,
    experiences: Array.isArray(normalizedProfile?.experiences) && normalizedProfile.experiences.length
      ? normalizedProfile.experiences
      : defaultProfile.experiences
  };
}

function collectContextCountries(booking = {}, generatedOffer = null) {
  const bookingDestinations = normalizeCountryCodes(booking?.destinations);
  const submittedDestinations = normalizeCountryCodes(booking?.web_form_submission?.destinations);
  const generatedDestinations = normalizeCountryCodes(generatedOffer?.travel_plan?.days?.flatMap((day) => day?.destinations || []));
  return unique([...bookingDestinations, ...submittedDestinations, ...generatedDestinations]);
}

export function selectRelevantAtpStaffExperiences(profile, booking = {}, generatedOffer = null, { limit = 3 } = {}) {
  const experiences = Array.isArray(profile?.experiences) ? profile.experiences : [];
  if (!experiences.length) return [];
  const profileDestinations = normalizeCountryCodes(profile?.destinations);
  const contextCountries = new Set(collectContextCountries(booking, generatedOffer));
  return experiences
    .map((experience, index) => {
      const destinationMatches = profileDestinations.filter((code) => contextCountries.has(code)).length;
      const score = (destinationMatches * 4) + index * -0.001;
      return { experience, index, score };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, Math.max(1, Number(limit) || 3))
    .map((entry) => entry.experience);
}

export function createAtpStaffDirectory({
  dataPath,
  photosDir,
  keycloakDirectory,
  writeQueueRef
}) {
  async function writeAvatarIfMissing(profile) {
    const username = normalizeText(profile?.username).toLowerCase();
    if (!username) return false;
    const outputPath = path.join(photosDir, `${username}.svg`);
    if (await fileExists(outputPath)) return false;
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, buildAvatarSvg(normalizeText(profile?.name) || username, username), "utf8");
    return true;
  }

  async function readProfiles() {
    const raw = await readFile(dataPath, "utf8");
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return {
      items: items
        .map((profile) => normalizeProfile(profile))
        .filter(Boolean)
    };
  }

  async function persistProfiles(payload) {
    writeQueueRef.current = writeQueueRef.current.then(async () => {
      await writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    });
    await writeQueueRef.current;
  }

  async function ensureStorage() {
    await mkdir(path.dirname(dataPath), { recursive: true });
    await mkdir(photosDir, { recursive: true });
    if (!(await fileExists(dataPath))) {
      await writeFile(dataPath, `${JSON.stringify({ items: seedProfiles() }, null, 2)}\n`, "utf8");
    }
    const payload = await readProfiles().catch(() => ({ items: seedProfiles() }));
    let changed = false;
    for (const profile of payload.items) {
      if (await writeAvatarIfMissing(profile)) changed = true;
      if (!normalizeText(profile.picture_ref)) {
        profile.picture_ref = pictureRefForUsername(profile.username);
        changed = true;
      }
    }
    if (changed) {
      await persistProfiles({ items: payload.items });
    }
  }

  async function syncProfilesFromKeycloak() {
    await ensureStorage();
    const stored = await readProfiles();
    const itemsByUsername = new Map(stored.items.map((profile) => [profile.username, profile]));
    let changed = false;
    const users = await keycloakDirectory.listAssignableUsers().catch(() => []);
    for (const user of users) {
      const username = normalizeText(user?.username).toLowerCase();
      if (!username) continue;
      const merged = mergeProfileWithUser(itemsByUsername.get(username), user);
      if (!merged) continue;
      if (JSON.stringify(itemsByUsername.get(username) || null) !== JSON.stringify(merged)) {
        itemsByUsername.set(username, merged);
        changed = true;
      }
      if (await writeAvatarIfMissing(merged)) changed = true;
    }
    const nextItems = Array.from(itemsByUsername.values()).sort((left, right) => {
      const leftName = normalizeText(left?.name) || left?.username || "";
      const rightName = normalizeText(right?.name) || right?.username || "";
      return leftName.localeCompare(rightName);
    });
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
      keycloakDirectory.listAssignableUsers().catch(() => []),
      syncProfilesFromKeycloak().catch(() => [])
    ]);
    const profilesByUsername = new Map(
      (Array.isArray(profiles) ? profiles : []).map((profile) => [normalizeText(profile?.username).toLowerCase(), profile])
    );
    return (Array.isArray(users) ? users : []).map((user) => ({
      ...user,
      staff_profile: mergeProfileWithUser(profilesByUsername.get(normalizeText(user?.username).toLowerCase()), user)
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
      staff_profile: mergeProfileWithUser(stored, user)
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
    const current = mergeProfileWithUser(currentStored, user);
    const nextStored = normalizeProfile({
      username,
      picture_ref: normalizeText(currentStored?.picture_ref) || normalizeText(current?.picture_ref) || pictureRefForUsername(username),
      languages: Array.isArray(input?.languages) ? input.languages : current?.languages,
      destinations: Array.isArray(input?.destinations) ? input.destinations : current?.destinations,
      experiences: Array.isArray(input?.experiences) ? input.experiences : current?.experiences
    });
    if (!nextStored) return null;
    itemsByUsername.set(username, nextStored);
    await writeAvatarIfMissing(nextStored);
    await persistProfiles({ items: sortProfiles(Array.from(itemsByUsername.values())) });
    return buildDirectoryEntryForUsername(username);
  }

  async function setPictureRefByUsername(rawUsername, pictureRef) {
    const username = normalizeText(rawUsername).toLowerCase();
    const normalizedPictureRef = normalizeText(pictureRef);
    if (!username || !normalizedPictureRef) return null;
    const user = await findAssignableUserByUsername(username);
    if (!user) return null;

    await ensureStorage();
    const stored = await readProfiles();
    const itemsByUsername = new Map(stored.items.map((profile) => [profile.username, profile]));
    const currentStored = itemsByUsername.get(username) || null;
    const current = mergeProfileWithUser(currentStored, user);
    const nextStored = normalizeProfile({
      username,
      picture_ref: normalizedPictureRef,
      languages: current?.languages,
      destinations: current?.destinations,
      experiences: current?.experiences
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
    return setPictureRefByUsername(username, pictureRefForUsername(username));
  }

  async function resolveAssignedStaffProfile(keycloakUserId) {
    const normalizedUserId = normalizeText(keycloakUserId);
    if (!normalizedUserId) return null;
    const user = await keycloakDirectory.getUserById(normalizedUserId).catch(() => null);
    const username = normalizeText(user?.username).toLowerCase();
    if (!username) return null;
    const profiles = await syncProfilesFromKeycloak().catch(() => []);
    const stored = (Array.isArray(profiles) ? profiles : []).find((profile) => normalizeText(profile?.username).toLowerCase() === username);
    return mergeProfileWithUser(stored, user);
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
    resolveAssignedStaffProfile,
    resolvePhotoDiskPath
  };
}
