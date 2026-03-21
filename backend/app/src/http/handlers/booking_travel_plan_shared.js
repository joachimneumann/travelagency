export function parseTravelPlanQueryInt(value, fallback, { min = 0, max = 100 } = {}) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isInteger(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

export function publicBookingImagePath(normalizeText, relativePath) {
  const normalized = normalizeText(relativePath).replace(/^\/+/, "");
  return normalized ? `/public/v1/booking-images/${normalized}` : "";
}

export function normalizeSegmentImageRefs(images = []) {
  const items = Array.isArray(images) ? images : [];
  return items.map((image, index) => ({
    ...image,
    sort_order: index,
    is_primary: index === 0
  }));
}

export function cloneTravelPlanLocalizedMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [String(key), typeof entryValue === "string" ? entryValue : String(entryValue || "")])
      .filter(([, entryValue]) => entryValue)
  );
}

export function findTravelPlanDayAndSegment(travelPlan, dayId, segmentId) {
  const days = Array.isArray(travelPlan?.days) ? travelPlan.days : [];
  const dayIndex = days.findIndex((day) => day.id === dayId);
  if (dayIndex < 0) return { dayIndex: -1, segmentIndex: -1, day: null, segment: null };
  const day = days[dayIndex];
  const segments = Array.isArray(day?.segments) ? day.segments : [];
  const segmentIndex = segments.findIndex((segment) => segment.id === segmentId);
  if (segmentIndex < 0) return { dayIndex, segmentIndex: -1, day, segment: null };
  return { dayIndex, segmentIndex, day, segment: segments[segmentIndex] };
}
