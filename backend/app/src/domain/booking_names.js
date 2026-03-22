export const SUSPICIOUS_SENTINEL_VALUES = new Set([
  "undefined",
  "null",
  "nan",
  "[object object]",
  "[object array]",
  "[object null]",
  "[object undefined]"
]);

export function isSuspiciousSentinelString(value, normalizeText) {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return false;
  const lowerValue = normalizedValue.toLowerCase();
  return SUSPICIOUS_SENTINEL_VALUES.has(lowerValue) || /^\[object [^\]]+\]$/i.test(normalizedValue);
}

export async function resolveBookingNameForStorage({
  bookingName,
  tourId,
  preferredLanguage,
  normalizeText,
  readTours,
  resolveLocalizedTourText
}) {
  const normalizedBookingName = normalizeText(bookingName);
  if (normalizedBookingName && !isSuspiciousSentinelString(normalizedBookingName, normalizeText)) {
    return normalizedBookingName;
  }

  const normalizedTourId = normalizeText(tourId);
  if (!normalizedTourId || typeof readTours !== "function") return null;

  const tours = await readTours();
  const matchingTour = (Array.isArray(tours) ? tours : []).find(
    (tour) => normalizeText(tour?.id) === normalizedTourId
  );
  if (!matchingTour) return null;

  const resolvedTitle = typeof resolveLocalizedTourText === "function"
    ? resolveLocalizedTourText(matchingTour.title, normalizeText(preferredLanguage) || "en")
    : matchingTour.title;
  const normalizedResolvedTitle = normalizeText(resolvedTitle);
  if (!normalizedResolvedTitle) return null;
  if (isSuspiciousSentinelString(normalizedResolvedTitle, normalizeText)) return null;
  return normalizedResolvedTitle;
}
