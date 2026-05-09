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

function normalizeCoordinate(value, { min, max } = {}) {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  if (Number.isFinite(min) && numberValue < min) return null;
  if (Number.isFinite(max) && numberValue > max) return null;
  return numberValue;
}

function normalizeMapZoom(value) {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  const normalized = Math.round(numberValue);
  return normalized >= 0 && normalized <= 22 ? normalized : null;
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
      .map((destination) => ({ destination, regions: [] }));
  const byDestination = new Map();
  for (const rawEntry of source) {
    const destination = countryCode(rawEntry?.destination || rawEntry);
    if (!destination) continue;
    const entry = byDestination.get(destination) || { destination, regions: [], places: [] };
    const knownRegionIds = new Set(entry.regions.map((region) => region.region_id));
    const countryPlaces = unique((Array.isArray(rawEntry?.places) ? rawEntry.places : [])
      .map((rawPlace) => normalizeText(rawPlace?.place_id || rawPlace?.id || rawPlace))
      .filter(Boolean))
      .map((placeId) => ({ place_id: placeId }));
    const knownCountryPlaceIds = new Set(entry.places.map((place) => place.place_id));
    for (const place of countryPlaces) {
      if (!knownCountryPlaceIds.has(place.place_id)) {
        entry.places.push(place);
        knownCountryPlaceIds.add(place.place_id);
      }
    }
    const rawRegions = Array.isArray(rawEntry?.regions) ? rawEntry.regions : (Array.isArray(rawEntry?.areas) ? rawEntry.areas : []);
    for (const rawRegion of rawRegions) {
      const regionId = normalizeText(rawRegion?.region_id || rawRegion?.area_id || rawRegion?.id);
      if (!regionId) continue;
      const existingRegion = entry.regions.find((region) => region.region_id === regionId);
      const places = unique((Array.isArray(rawRegion?.places) ? rawRegion.places : [])
        .map((rawPlace) => normalizeText(rawPlace?.place_id || rawPlace?.id || rawPlace))
        .filter(Boolean))
        .map((placeId) => ({ place_id: placeId }));
      if (existingRegion) {
        const knownPlaceIds = new Set(existingRegion.places.map((place) => place.place_id));
        for (const place of places) {
          if (!knownPlaceIds.has(place.place_id)) {
            existingRegion.places.push(place);
            knownPlaceIds.add(place.place_id);
          }
        }
        continue;
      }
      if (!knownRegionIds.has(regionId)) {
        entry.regions.push({ region_id: regionId, places });
        knownRegionIds.add(regionId);
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
    regions: (Array.isArray(catalog?.regions) ? catalog.regions : []).map((region) => ({
      id: normalizeText(region?.id),
      destination: countryCode(region?.destination),
      code: normalizeText(region?.code),
      label: normalizeText(region?.label || region?.name || region?.code || region?.id),
      is_active: region?.is_active !== false
    })).filter((region) => region.id && region.destination),
    places: (Array.isArray(catalog?.places) ? catalog.places : []).map((place) => ({
      id: normalizeText(place?.id),
      destination: countryCode(place?.destination),
      region_id: normalizeText(place?.region_id || place?.area_id),
      code: normalizeText(place?.code),
      label: normalizeText(place?.label || place?.name || place?.code || place?.id),
      latitude: normalizeCoordinate(place?.latitude, { min: -90, max: 90 }),
      longitude: normalizeCoordinate(place?.longitude, { min: -180, max: 180 }),
      map_zoom: normalizeMapZoom(place?.map_zoom),
      is_active: place?.is_active !== false
    })).filter((place) => place.id && place.destination)
  };
}

export function ensureDestinationScopeForDestinations(scope, destinations) {
  const normalizedDestinations = destinationScopeDestinations(
    (Array.isArray(destinations) ? destinations : []).map((destination) => ({ destination }))
  );
  const existing = normalizeDestinationScope(scope).filter((entry) => normalizedDestinations.includes(entry.destination));
  for (const destination of normalizedDestinations) {
    if (!existing.some((entry) => entry.destination === destination)) {
      existing.push({ destination, regions: [], places: [] });
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
  const regionSelections = new Map(
    normalizedScope.flatMap((entry) => (Array.isArray(entry.regions) ? entry.regions : []).map((region) => [region.region_id, region]))
  );
  const countryPlaceSelections = new Map(
    normalizedScope.map((entry) => [entry.destination, new Set((Array.isArray(entry.places) ? entry.places : []).map((place) => place.place_id))])
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
            const regions = normalizedCatalog.regions.filter((region) => region.destination === destination.code);
            const countryPlaces = normalizedCatalog.places.filter((place) => place.destination === destination.code && !place.region_id);
            const selectedCountryPlaceIds = countryPlaceSelections.get(destination.code) || new Set();
            return `
              <article class="destination-scope-editor__group" data-destination-scope-destination-group="${escapeHtml(destination.code)}">
                <div class="destination-scope-editor__group-head">
                  <h4>${escapeHtml(destination.label || destination.code)}</h4>
                  ${allowCreate && canEdit
                    ? `<button class="btn btn-ghost destination-scope-editor__small-action" type="button" data-destination-scope-add-region="${escapeHtml(destination.code)}">${escapeHtml(t("booking.travel_plan.add_region", "Add region"))}</button>`
                    : ""}
                </div>
                ${countryPlaces.length || (allowCreate && canEdit)
                  ? `<div class="destination-scope-editor__places">
                      ${countryPlaces.map((place) => `
                        <label class="backend-checkbox-item destination-scope-editor__place-choice">
                          <input
                            type="checkbox"
                            data-destination-scope-country-place="${escapeHtml(place.id)}"
                            data-destination-scope-country-place-destination="${escapeHtml(destination.code)}"
                            value="${escapeHtml(place.id)}"
                            ${checkedAttr(selectedCountryPlaceIds.has(place.id))}
                            ${disabledAttr(!canEdit)}
                          />
                          ${escapeHtml(place.label || place.code || place.id)}
                        </label>
                      `).join("")}
                      ${allowCreate && canEdit
                        ? `<button class="btn btn-ghost destination-scope-editor__small-action" type="button" data-destination-scope-add-country-place="${escapeHtml(destination.code)}">${escapeHtml(t("booking.travel_plan.add_place", "Add place"))}</button>`
                        : ""}
                    </div>`
                  : ""}
                <div class="destination-scope-editor__regions">
                  ${regions.length ? regions.map((region) => {
                    const regionSelection = regionSelections.get(region.id);
                    const checked = Boolean(regionSelection);
                    const selectedPlaceIds = new Set((Array.isArray(regionSelection?.places) ? regionSelection.places : []).map((place) => place.place_id));
                    const places = normalizedCatalog.places.filter((place) => place.region_id === region.id);
                    return `
                      <div class="destination-scope-editor__region" data-destination-scope-region-row="${escapeHtml(region.id)}">
                        <label class="backend-checkbox-item destination-scope-editor__region-choice">
                          <input
                            type="checkbox"
                            data-destination-scope-region="${escapeHtml(region.id)}"
                            data-destination-scope-region-destination="${escapeHtml(destination.code)}"
                            value="${escapeHtml(region.id)}"
                            ${checkedAttr(checked)}
                            ${disabledAttr(!canEdit)}
                          />
                          ${escapeHtml(region.label || region.code || region.id)}
                        </label>
                        ${checked
                          ? `<div class="destination-scope-editor__places">
                              ${places.map((place) => `
                                <label class="backend-checkbox-item destination-scope-editor__place-choice">
                                  <input
                                    type="checkbox"
                                    data-destination-scope-place="${escapeHtml(place.id)}"
                                    data-destination-scope-place-region="${escapeHtml(region.id)}"
                                    value="${escapeHtml(place.id)}"
                                    ${checkedAttr(selectedPlaceIds.has(place.id))}
                                    ${disabledAttr(!canEdit)}
                                  />
                                  ${escapeHtml(place.label || place.code || place.id)}
                                </label>
                              `).join("") || `<p class="micro destination-scope-editor__empty">${escapeHtml(t("booking.travel_plan.no_places", "No places yet."))}</p>`}
                              ${allowCreate && canEdit
                                ? `<button class="btn btn-ghost destination-scope-editor__small-action" type="button" data-destination-scope-add-place="${escapeHtml(region.id)}">${escapeHtml(t("booking.travel_plan.add_place", "Add place"))}</button>`
                                : ""}
                            </div>`
                          : ""}
                      </div>
                    `;
                  }).join("") : `<p class="micro destination-scope-editor__empty">${escapeHtml(t("booking.travel_plan.no_regions", "No regions yet."))}</p>`}
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
  const entries = destinations.map((destination) => ({ destination, regions: [], places: [] }));
  const entryByDestination = new Map(entries.map((entry) => [entry.destination, entry]));
  const checkedRegions = Array.from(container.querySelectorAll("[data-destination-scope-region]:checked"));
  for (const placeInput of Array.from(container.querySelectorAll("[data-destination-scope-country-place]:checked"))) {
    const placeId = normalizeText(placeInput.getAttribute("data-destination-scope-country-place") || placeInput.value);
    const destination = countryCode(placeInput.getAttribute("data-destination-scope-country-place-destination"));
    const entry = entryByDestination.get(destination);
    if (placeId && entry) entry.places.push({ place_id: placeId });
  }
  for (const regionInput of checkedRegions) {
    const regionId = normalizeText(regionInput.getAttribute("data-destination-scope-region") || regionInput.value);
    const destination = countryCode(regionInput.getAttribute("data-destination-scope-region-destination"));
    const entry = entryByDestination.get(destination);
    if (!regionId || !entry) continue;
    const places = Array.from(container.querySelectorAll("[data-destination-scope-place]:checked"))
      .filter((placeInput) => normalizeText(placeInput.getAttribute("data-destination-scope-place-region")) === regionId)
      .map((placeInput) => normalizeText(placeInput.getAttribute("data-destination-scope-place") || placeInput.value))
      .filter(Boolean)
      .map((placeId) => ({ place_id: placeId }));
    entry.regions.push({ region_id: regionId, places });
  }
  return normalizeDestinationScope(entries);
}
