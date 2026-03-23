import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeText } from "./text.js";

const DEFAULT_PROFILE_BLUEPRINTS = Object.freeze({
  "admin": {
    spoken_languages: ["en", "vi"],
    experiences: [
      {
        id: "admin_operations_vn_th",
        title: "Operations oversight across Vietnam and Thailand",
        summary: "Keeps arrival logistics, hotel handovers, and day-by-day pacing realistic for trips that combine urban stays with recovery time.",
        countries: ["VN", "TH"],
        travel_styles: ["luxury", "wellness", "culture"]
      },
      {
        id: "admin_multicountry_coordination",
        title: "Multi-country guest support",
        summary: "Experienced in coordinating soft-paced routes across Southeast Asia with clear airport support, calm timing, and backup options when plans shift.",
        countries: ["VN", "TH", "KH", "LA"],
        travel_styles: ["family", "wellness", "grand-expeditions"]
      }
    ]
  },
  "joachim": {
    spoken_languages: ["de", "en", "vi"],
    experiences: [
      {
        id: "joachim_central_vietnam_wellness",
        title: "Central Vietnam wellness pacing",
        summary: "Designs quiet Hoi An, Da Nang, and Hue programs with spa appointments, low-friction transfers, and enough empty space between highlights.",
        countries: ["VN"],
        travel_styles: ["wellness", "beach", "culture"]
      },
      {
        id: "joachim_laos_cambodia_calm",
        title: "Gentle Cambodia and Laos journeys",
        summary: "Builds soft-paced Siem Reap and Luang Prabang itineraries that balance heritage visits with rest, river time, and unhurried evenings.",
        countries: ["KH", "LA"],
        travel_styles: ["wellness", "culture", "luxury"]
      },
      {
        id: "joachim_multicountry_handovers",
        title: "Cross-border handover planning",
        summary: "Experienced in smoothing multi-country airport arrivals, hotel changes, and local guide transitions for couples and families.",
        countries: ["VN", "TH", "KH", "LA"],
        travel_styles: ["family", "wellness", "luxury"]
      }
    ]
  },
  "staff": {
    spoken_languages: ["en", "vi", "th"],
    experiences: [
      {
        id: "staff_thailand_coast_wellness",
        title: "Thailand coast and spa stays",
        summary: "Shapes Phuket and Krabi stays around beach time, practical treatment windows, and easy private transfers rather than rushed sightseeing blocks.",
        countries: ["TH"],
        travel_styles: ["wellness", "beach", "luxury"]
      },
      {
        id: "staff_family_pacing",
        title: "Family-friendly pacing",
        summary: "Good at building routes with lighter mornings, flexible lunch breaks, and realistic transit times for multi-generation travelers.",
        countries: ["VN", "TH", "KH"],
        travel_styles: ["family", "wellness", "culture"]
      }
    ]
  },
  "accountant": {
    spoken_languages: ["en", "vi"],
    experiences: [
      {
        id: "accountant_prearrival_support",
        title: "Pre-arrival guest support",
        summary: "Supports guests with calm pre-trip coordination, practical arrival briefings, and simple next-step communication before departure.",
        countries: ["VN", "TH", "KH", "LA"],
        travel_styles: ["wellness", "luxury", "culture"]
      },
      {
        id: "accountant_comfort_logistics",
        title: "Comfort-first logistics follow-up",
        summary: "Keeps an eye on payment, rooming, and timing details so the on-trip flow stays comfortable and clear for guests.",
        countries: ["VN", "TH", "KH", "LA"],
        travel_styles: ["wellness", "family", "luxury"]
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

function normalizeTravelStyles(items) {
  return unique((Array.isArray(items) ? items : []).map((item) => normalizeText(item).toLowerCase()));
}

function normalizeExperience(experience, index = 0) {
  const normalizedTitle = normalizeText(experience?.title);
  const normalizedSummary = normalizeText(experience?.summary);
  if (!normalizedTitle || !normalizedSummary) return null;
  return {
    ...(normalizeText(experience?.id) ? { id: normalizeText(experience.id) } : { id: `experience_${index + 1}` }),
    title: normalizedTitle,
    summary: normalizedSummary,
    ...(normalizeCountryCodes(experience?.countries).length ? { countries: normalizeCountryCodes(experience.countries) } : {}),
    ...(normalizeTravelStyles(experience?.travel_styles).length ? { travel_styles: normalizeTravelStyles(experience.travel_styles) } : {})
  };
}

function normalizeProfile(profile) {
  const username = normalizeText(profile?.username).toLowerCase();
  if (!username) return null;
  return {
    username,
    ...(normalizeText(profile?.name) ? { name: normalizeText(profile.name) } : {}),
    ...(normalizeText(profile?.picture_ref) ? { picture_ref: normalizeText(profile.picture_ref) } : {}),
    spoken_languages: normalizeLanguageCodes(profile?.spoken_languages),
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
    spoken_languages: ["en", "vi"],
    experiences: [
      {
        id: `${normalizeText(user?.username) || "staff"}_regional_guest_support`,
        title: "Regional guest support",
        summary: `${defaultDisplayNameForUser(user)} helps shape well-paced Southeast Asia routes with realistic transfer windows, calm arrival support, and practical day-to-day coordination.`,
        countries: ["VN", "TH", "KH", "LA"],
        travel_styles: ["wellness", "culture", "luxury"]
      },
      {
        id: `${normalizeText(user?.username) || "staff"}_soft_paced_itineraries`,
        title: "Soft-paced itinerary planning",
        summary: `${defaultDisplayNameForUser(user)} is comfortable balancing sightseeing with recovery time, lighter mornings, and clear guest communication throughout the trip.`,
        countries: ["VN", "TH", "KH", "LA"],
        travel_styles: ["wellness", "family", "culture"]
      }
    ]
  };
}

function defaultProfileForUser(user) {
  const username = normalizeText(user?.username).toLowerCase();
  const blueprint = DEFAULT_PROFILE_BLUEPRINTS[username] || genericProfileBlueprint(user);
  return normalizeProfile({
    username,
    name: defaultDisplayNameForUser(user),
    picture_ref: pictureRefForUsername(username),
    spoken_languages: blueprint.spoken_languages,
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
    spoken_languages: normalizeLanguageCodes(normalizedProfile?.spoken_languages).length
      ? normalizeLanguageCodes(normalizedProfile.spoken_languages)
      : defaultProfile.spoken_languages,
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

function collectContextStyles(booking = {}) {
  const bookingStyles = normalizeTravelStyles(booking?.travel_styles);
  const submittedStyles = normalizeTravelStyles(booking?.web_form_submission?.travel_style);
  return unique([...bookingStyles, ...submittedStyles]);
}

export function selectRelevantAtpStaffExperiences(profile, booking = {}, generatedOffer = null, { limit = 3 } = {}) {
  const experiences = Array.isArray(profile?.experiences) ? profile.experiences : [];
  if (!experiences.length) return [];
  const countries = new Set(collectContextCountries(booking, generatedOffer));
  const styles = new Set(collectContextStyles(booking));
  return experiences
    .map((experience, index) => {
      const experienceCountries = normalizeCountryCodes(experience?.countries);
      const experienceStyles = normalizeTravelStyles(experience?.travel_styles);
      const countryMatches = experienceCountries.filter((code) => countries.has(code)).length;
      const styleMatches = experienceStyles.filter((code) => styles.has(code)).length;
      const score = (countryMatches * 4) + (styleMatches * 3) + (experienceCountries.length ? 0 : 1) + (experienceStyles.length ? 0 : 1);
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
    resolveAssignedStaffProfile,
    resolvePhotoDiskPath
  };
}
