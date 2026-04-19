import { LANGUAGE_BY_CODE } from "../../../../shared/generated/language_catalog.js";
import { resolveAtpStaffShortDescriptionText } from "./atp_staff_directory.js";
import { normalizeText } from "./text.js";

function textOrNull(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeLanguageLabels(items) {
  const labels = [];
  for (const item of Array.isArray(items) ? items : []) {
    const code = normalizeText(item).toLowerCase();
    if (!code) continue;
    const entry = LANGUAGE_BY_CODE[code];
    labels.push(normalizeText(entry?.shortLabel) || code.toUpperCase());
  }
  return Array.from(new Set(labels));
}

function extractPublicRelativePath(publicUrl, prefix) {
  const normalizedUrl = normalizeText(publicUrl);
  if (!normalizedUrl) return null;
  if (!normalizedUrl.startsWith(prefix)) return null;
  return normalizedUrl
    .slice(prefix.length)
    .replace(/^\/+/, "")
    .replace(/[?#].*$/, "");
}

export async function resolveAtpGuidePdfContext({
  booking,
  generatedOffer = null,
  resolveAssignedAtpStaffProfile = null,
  resolveAtpStaffPhotoDiskPath = null
}) {
  const assignedUserId = normalizeText(booking?.assigned_keycloak_user_id);
  const profile = (
    (booking?.assigned_atp_staff && typeof booking.assigned_atp_staff === "object")
      ? booking.assigned_atp_staff
      : null
  ) || (
    assignedUserId && typeof resolveAssignedAtpStaffProfile === "function"
      ? await resolveAssignedAtpStaffProfile(assignedUserId).catch(() => null)
      : null
  );

  const photoRelativePath = extractPublicRelativePath(profile?.picture_ref, "/content/atp_staff/photos/")
    || extractPublicRelativePath(profile?.picture_ref, "/public/v1/atp-staff-photos/")
    || textOrNull(profile?.picture);
  const photoDiskPath = photoRelativePath && typeof resolveAtpStaffPhotoDiskPath === "function"
    ? resolveAtpStaffPhotoDiskPath(photoRelativePath)
    : null;

  return {
    profile,
    photoDiskPath,
    languageLabels: normalizeLanguageLabels(profile?.languages)
  };
}

export function resolveAtpGuideShortDescriptionText(guideContext, lang = "en") {
  return resolveAtpStaffShortDescriptionText(guideContext?.profile || null, lang);
}

export function resolveAtpStaffFullName(profile) {
  return textOrNull(profile?.name);
}

export function resolveAtpStaffFriendlyShortName(profile) {
  return textOrNull(profile?.friendly_short_name);
}

export function resolveAtpGuideDisplayName(profile) {
  const fullName = resolveAtpStaffFullName(profile);
  const friendlyShortName = resolveAtpStaffFriendlyShortName(profile);
  if (fullName && friendlyShortName && fullName.toLowerCase() !== friendlyShortName.toLowerCase()) {
    return `${fullName} (${friendlyShortName})`;
  }
  return fullName || friendlyShortName || null;
}

export function resolveAtpGuideIntroName(profile) {
  return resolveAtpStaffFriendlyShortName(profile)
    || resolveAtpStaffFullName(profile)
    || null;
}
