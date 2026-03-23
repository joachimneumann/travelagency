import { LANGUAGE_BY_CODE } from "../../../../shared/generated/language_catalog.js";
import { selectRelevantAtpStaffExperiences } from "./atp_staff_directory.js";
import { normalizeText } from "./text.js";

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
  return normalizedUrl.slice(prefix.length).replace(/^\/+/, "");
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

  const experiences = profile
    ? selectRelevantAtpStaffExperiences(profile, booking, generatedOffer, { limit: 3 })
    : [];

  const photoRelativePath = extractPublicRelativePath(profile?.picture_ref, "/public/v1/atp-staff-photos/");
  const photoDiskPath = photoRelativePath && typeof resolveAtpStaffPhotoDiskPath === "function"
    ? resolveAtpStaffPhotoDiskPath(photoRelativePath)
    : null;

  return {
    profile,
    experiences,
    photoDiskPath,
    languageLabels: normalizeLanguageLabels(profile?.spoken_languages)
  };
}
