import { normalizeText } from "./api.js";
import { COUNTRY_CODE_CATALOG } from "./generated_catalogs.js";

const DESTINATION_OPTIONS = Object.freeze([
  Object.freeze({ code: "VN", label: "Vietnam" }),
  Object.freeze({ code: "TH", label: "Thailand" }),
  Object.freeze({ code: "KH", label: "Cambodia" }),
  Object.freeze({ code: "LA", label: "Laos" })
]);

const TOUR_DESTINATION_TO_COUNTRY = Object.freeze({
  vietnam: "VN",
  thailand: "TH",
  cambodia: "KH",
  laos: "LA"
});

const COUNTRY_TO_TOUR_DESTINATION = Object.freeze(
  Object.fromEntries(Object.entries(TOUR_DESTINATION_TO_COUNTRY).map(([tourCode, countryCode]) => [countryCode, tourCode]))
);

function countryCode(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (COUNTRY_CODE_CATALOG.includes(upper)) return upper;
  return TOUR_DESTINATION_TO_COUNTRY[raw.toLowerCase()] || "";
}

function unique(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

export function destinationScopeDestinations(scope) {
  const order = new Map(DESTINATION_OPTIONS.map((option, index) => [option.code, index]));
  return unique((Array.isArray(scope) ? scope : []).map((entry) => countryCode(entry?.destination)).filter(Boolean))
    .sort((left, right) => (order.get(left) ?? 999) - (order.get(right) ?? 999) || left.localeCompare(right));
}

export function destinationScopeTourDestinations(scope) {
  return destinationScopeDestinations(scope).map((destination) => COUNTRY_TO_TOUR_DESTINATION[destination] || destination.toLowerCase()).filter(Boolean);
}

export function normalizeDestinationScope(scope, fallbackDestinations = []) {
  const source = Array.isArray(scope) && scope.length
    ? scope
    : unique((Array.isArray(fallbackDestinations) ? fallbackDestinations : []).map(countryCode).filter(Boolean))
      .map((destination) => ({ destination, areas: [] }));
  const byDestination = new Map();
  for (const rawEntry of source) {
    const destination = countryCode(rawEntry?.destination || rawEntry);
    if (!destination) continue;
    const entry = byDestination.get(destination) || { destination, areas: [] };
    const knownAreaIds = new Set(entry.areas.map((area) => area.area_id));
    for (const rawArea of Array.isArray(rawEntry?.areas) ? rawEntry.areas : []) {
      const areaId = normalizeText(rawArea?.area_id || rawArea?.id);
      if (!areaId) continue;
      const existingArea = entry.areas.find((area) => area.area_id === areaId);
      const places = unique((Array.isArray(rawArea?.places) ? rawArea.places : [])
        .map((rawPlace) => normalizeText(rawPlace?.place_id || rawPlace?.id || rawPlace))
        .filter(Boolean))
        .map((placeId) => ({ place_id: placeId }));
      if (existingArea) {
        const knownPlaceIds = new Set(existingArea.places.map((place) => place.place_id));
        for (const place of places) {
          if (!knownPlaceIds.has(place.place_id)) {
            existingArea.places.push(place);
            knownPlaceIds.add(place.place_id);
          }
        }
        continue;
      }
      if (!knownAreaIds.has(areaId)) {
        entry.areas.push({ area_id: areaId, places });
        knownAreaIds.add(areaId);
      }
    }
    byDestination.set(destination, entry);
  }
  return destinationScopeDestinations([...byDestination.values()]).map((destination) => byDestination.get(destination));
}

export function normalizeDestinationScopeCatalog(catalog) {
  const destinations = Array.isArray(catalog?.destinations)
    ? catalog.destinations
    : DESTINATION_OPTIONS;
  return {
    destinations: destinations.map((option) => ({
      code: countryCode(option?.code || option?.value || option),
      label: normalizeText(option?.label || option?.name || option?.code || option?.value || option)
    })).filter((option) => option.code),
    areas: (Array.isArray(catalog?.areas) ? catalog.areas : []).map((area) => ({
      id: normalizeText(area?.id),
      destination: countryCode(area?.destination),
      code: normalizeText(area?.code),
      label: normalizeText(area?.label || area?.name || area?.code || area?.id),
      is_active: area?.is_active !== false
    })).filter((area) => area.id && area.destination),
    places: (Array.isArray(catalog?.places) ? catalog.places : []).map((place) => ({
      id: normalizeText(place?.id),
      area_id: normalizeText(place?.area_id),
      code: normalizeText(place?.code),
      label: normalizeText(place?.label || place?.name || place?.code || place?.id),
      is_active: place?.is_active !== false
    })).filter((place) => place.id && place.area_id)
  };
}

export function ensureDestinationScopeForDestinations(scope, destinations) {
  const normalizedDestinations = destinationScopeDestinations(
    (Array.isArray(destinations) ? destinations : []).map((destination) => ({ destination }))
  );
  const existing = normalizeDestinationScope(scope).filter((entry) => normalizedDestinations.includes(entry.destination));
  for (const destination of normalizedDestinations) {
    if (!existing.some((entry) => entry.destination === destination)) {
      existing.push({ destination, areas: [] });
    }
  }
  return normalizeDestinationScope(existing);
}

function checkedAttr(condition) {
  return condition ? " checked" : "";
}

function disabledAttr(condition) {
  return condition ? " disabled" : "";
}

export function renderDestinationScopeEditor({
  catalog,
  scope,
  escapeHtml,
  canEdit = true,
  allowCreate = false,
  t = (_id, fallback) => fallback
}) {
  const normalizedCatalog = normalizeDestinationScopeCatalog(catalog);
  const normalizedScope = normalizeDestinationScope(scope);
  const selectedDestinations = new Set(destinationScopeDestinations(normalizedScope));
  const areaSelections = new Map(
    normalizedScope.flatMap((entry) => (Array.isArray(entry.areas) ? entry.areas : []).map((area) => [area.area_id, area]))
  );

  return `
    <section class="destination-scope-editor" data-destination-scope-editor>
      <div class="destination-scope-editor__head">
        <h3>${escapeHtml(t("booking.travel_plan.route_scope", "Destination(s)"))}</h3>
      </div>
      <div class="destination-scope-editor__destinations" role="group" aria-label="${escapeHtml(t("booking.travel_plan.destinations", "Destinations"))}">
        ${normalizedCatalog.destinations.map((destination) => `
          <label class="backend-checkbox-item destination-scope-editor__destination">
            <input
              type="checkbox"
              data-destination-scope-destination="${escapeHtml(destination.code)}"
              value="${escapeHtml(destination.code)}"
              ${checkedAttr(selectedDestinations.has(destination.code))}
              ${disabledAttr(!canEdit)}
            />
            ${escapeHtml(destination.label || destination.code)}
          </label>
        `).join("")}
      </div>
      <div class="destination-scope-editor__groups">
        ${normalizedCatalog.destinations
          .filter((destination) => selectedDestinations.has(destination.code))
          .map((destination) => {
            const areas = normalizedCatalog.areas.filter((area) => area.destination === destination.code);
            return `
              <article class="destination-scope-editor__group" data-destination-scope-destination-group="${escapeHtml(destination.code)}">
                <div class="destination-scope-editor__group-head">
                  <h4>${escapeHtml(destination.label || destination.code)}</h4>
                  ${allowCreate && canEdit
                    ? `<button class="btn btn-ghost destination-scope-editor__small-action" type="button" data-destination-scope-add-area="${escapeHtml(destination.code)}">${escapeHtml(t("booking.travel_plan.add_area", "Add area"))}</button>`
                    : ""}
                </div>
                <div class="destination-scope-editor__areas">
                  ${areas.length ? areas.map((area) => {
                    const areaSelection = areaSelections.get(area.id);
                    const checked = Boolean(areaSelection);
                    const selectedPlaceIds = new Set((Array.isArray(areaSelection?.places) ? areaSelection.places : []).map((place) => place.place_id));
                    const places = normalizedCatalog.places.filter((place) => place.area_id === area.id);
                    return `
                      <div class="destination-scope-editor__area" data-destination-scope-area-row="${escapeHtml(area.id)}">
                        <label class="backend-checkbox-item destination-scope-editor__area-choice">
                          <input
                            type="checkbox"
                            data-destination-scope-area="${escapeHtml(area.id)}"
                            data-destination-scope-area-destination="${escapeHtml(destination.code)}"
                            value="${escapeHtml(area.id)}"
                            ${checkedAttr(checked)}
                            ${disabledAttr(!canEdit)}
                          />
                          ${escapeHtml(area.label || area.code || area.id)}
                        </label>
                        ${checked
                          ? `<div class="destination-scope-editor__places">
                              ${places.map((place) => `
                                <label class="backend-checkbox-item destination-scope-editor__place-choice">
                                  <input
                                    type="checkbox"
                                    data-destination-scope-place="${escapeHtml(place.id)}"
                                    data-destination-scope-place-area="${escapeHtml(area.id)}"
                                    value="${escapeHtml(place.id)}"
                                    ${checkedAttr(selectedPlaceIds.has(place.id))}
                                    ${disabledAttr(!canEdit)}
                                  />
                                  ${escapeHtml(place.label || place.code || place.id)}
                                </label>
                              `).join("") || `<p class="micro destination-scope-editor__empty">${escapeHtml(t("booking.travel_plan.no_places", "No places yet."))}</p>`}
                              ${allowCreate && canEdit
                                ? `<button class="btn btn-ghost destination-scope-editor__small-action" type="button" data-destination-scope-add-place="${escapeHtml(area.id)}">${escapeHtml(t("booking.travel_plan.add_place", "Add place"))}</button>`
                                : ""}
                            </div>`
                          : ""}
                      </div>
                    `;
                  }).join("") : `<p class="micro destination-scope-editor__empty">${escapeHtml(t("booking.travel_plan.no_areas", "No areas yet."))}</p>`}
                </div>
              </article>
            `;
          }).join("")}
      </div>
    </section>
  `;
}

export function readDestinationScopeFromDom(container) {
  if (!(container instanceof HTMLElement)) return [];
  const destinations = Array.from(container.querySelectorAll("[data-destination-scope-destination]:checked"))
    .map((input) => countryCode(input.getAttribute("data-destination-scope-destination") || input.value))
    .filter(Boolean);
  const entries = destinations.map((destination) => ({ destination, areas: [] }));
  const entryByDestination = new Map(entries.map((entry) => [entry.destination, entry]));
  const checkedAreas = Array.from(container.querySelectorAll("[data-destination-scope-area]:checked"));
  for (const areaInput of checkedAreas) {
    const areaId = normalizeText(areaInput.getAttribute("data-destination-scope-area") || areaInput.value);
    const destination = countryCode(areaInput.getAttribute("data-destination-scope-area-destination"));
    const entry = entryByDestination.get(destination);
    if (!areaId || !entry) continue;
    const places = Array.from(container.querySelectorAll("[data-destination-scope-place]:checked"))
      .filter((placeInput) => normalizeText(placeInput.getAttribute("data-destination-scope-place-area")) === areaId)
      .map((placeInput) => normalizeText(placeInput.getAttribute("data-destination-scope-place") || placeInput.value))
      .filter(Boolean)
      .map((placeId) => ({ place_id: placeId }));
    entry.areas.push({ area_id: areaId, places });
  }
  return normalizeDestinationScope(entries);
}
