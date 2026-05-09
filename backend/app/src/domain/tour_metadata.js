import { normalizeText } from "../lib/text.js";

export const TOUR_EXPERIENCE_HIGHLIGHT_LIMIT = 4;

function normalizeOptionalText(value) {
  const normalized = normalizeText(value);
  return normalized || "";
}

function experienceHighlightCatalogOrder(catalog) {
  const order = new Map();
  (Array.isArray(catalog) ? catalog : []).forEach((item, index) => {
    const id = normalizeOptionalText(item?.id || item);
    if (id && !order.has(id)) order.set(id, index);
  });
  return order;
}

export function normalizeExperienceHighlightIds(values, { availableIds = null, limit = Number.POSITIVE_INFINITY } = {}) {
  const allowed = availableIds instanceof Set
    ? availableIds
    : (Array.isArray(availableIds) ? new Set(availableIds.map(normalizeOptionalText).filter(Boolean)) : null);
  const seen = new Set();
  const normalized = [];
  for (const value of Array.isArray(values) ? values : []) {
    const id = normalizeOptionalText(value);
    if (!id || seen.has(id)) continue;
    if (allowed && !allowed.has(id)) continue;
    seen.add(id);
    normalized.push(id);
    if (normalized.length >= limit) break;
  }
  return normalized;
}

export function deriveTourExperienceHighlightIds(travelPlan, catalog = [], { limit = TOUR_EXPERIENCE_HIGHLIGHT_LIMIT } = {}) {
  const catalogOrder = experienceHighlightCatalogOrder(catalog);
  const availableIds = catalogOrder.size ? new Set(catalogOrder.keys()) : null;
  const counts = new Map();
  const firstSeen = new Map();
  let sequence = 0;

  for (const day of Array.isArray(travelPlan?.days) ? travelPlan.days : []) {
    const dayHighlightIds = normalizeExperienceHighlightIds(day?.experience_highlight_ids, { availableIds, limit: 1 });
    for (const id of dayHighlightIds) {
      counts.set(id, (counts.get(id) || 0) + 1);
      if (!firstSeen.has(id)) {
        firstSeen.set(id, sequence);
        sequence += 1;
      }
    }
  }

  return Array.from(counts.keys())
    .sort((left, right) => {
      const countDelta = (counts.get(right) || 0) - (counts.get(left) || 0);
      if (countDelta !== 0) return countDelta;
      const leftCatalogIndex = catalogOrder.has(left) ? catalogOrder.get(left) : Number.POSITIVE_INFINITY;
      const rightCatalogIndex = catalogOrder.has(right) ? catalogOrder.get(right) : Number.POSITIVE_INFINITY;
      if (leftCatalogIndex !== rightCatalogIndex) return leftCatalogIndex - rightCatalogIndex;
      return (firstSeen.get(left) || 0) - (firstSeen.get(right) || 0);
    })
    .slice(0, limit);
}
