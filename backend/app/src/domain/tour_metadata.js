import { normalizeText } from "../lib/text.js";

export const TOUR_EXPERIENCE_HIGHLIGHT_LIMIT = 4;
export const TOUR_EXPERIENCE_HIGHLIGHT_FALLBACK_IDS = Object.freeze([
  "local_experiences",
  "delicious_cuisine",
  "family_friendly_activities",
  "shopping_souvenirs"
]);

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

function deterministicRank(seed, id) {
  const text = `${seed || "tour"}:${id}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicShuffleIds(ids, seed) {
  return [...ids]
    .map((id, index) => ({
      id,
      index,
      rank: deterministicRank(seed, id)
    }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((entry) => entry.id);
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

export function selectTourExperienceHighlightIds(
  travelPlan,
  catalog = [],
  {
    limit = TOUR_EXPERIENCE_HIGHLIGHT_LIMIT,
    fallbackIds = TOUR_EXPERIENCE_HIGHLIGHT_FALLBACK_IDS,
    seed = ""
  } = {}
) {
  const catalogOrder = experienceHighlightCatalogOrder(catalog);
  const availableIds = catalogOrder.size ? new Set(catalogOrder.keys()) : null;
  const selected = deriveTourExperienceHighlightIds(travelPlan, catalog, { limit });
  const seen = new Set(selected);
  const fallbackCandidates = normalizeExperienceHighlightIds(fallbackIds, {
    availableIds,
    limit: Number.POSITIVE_INFINITY
  }).filter((id) => !seen.has(id));

  for (const id of deterministicShuffleIds(fallbackCandidates, seed)) {
    selected.push(id);
    seen.add(id);
    if (selected.length >= limit) return selected;
  }

  return selected.slice(0, limit);
}
