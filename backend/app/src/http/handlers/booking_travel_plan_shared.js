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

export function normalizeItemImageRefs(images = []) {
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

export function findTravelPlanDayAndItem(travelPlan, dayId, itemId) {
  const days = Array.isArray(travelPlan?.days) ? travelPlan.days : [];
  const dayIndex = days.findIndex((day) => day.id === dayId);
  if (dayIndex < 0) return { dayIndex: -1, itemIndex: -1, day: null, item: null };
  const day = days[dayIndex];
  const items = Array.isArray(day?.items) ? day.items : [];
  const itemIndex = items.findIndex((item) => item.id === itemId);
  if (itemIndex < 0) return { dayIndex, itemIndex: -1, day, item: null };
  return { dayIndex, itemIndex, day, item: items[itemIndex] };
}
