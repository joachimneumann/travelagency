const TOUR_CUSTOMIZE_STORAGE_PREFIX = "asiatravelplan.custom_tour.";
const TOUR_CUSTOMIZE_MAX_DAYS = 20;
const TOUR_CUSTOMIZE_ROUTE_BOUNDS = Object.freeze({
  north: 24.5,
  south: 7.0,
  west: 97.0,
  east: 110.5
});

const TOUR_CUSTOMIZE_ROUTE_POINTS = Object.freeze([
  { id: "hanoi", label: "Hanoi", lat: 21.0278, lng: 105.8342, aliases: ["hanoi", "ha noi", "hà nội", "hà nội", "noi bai"] },
  { id: "halong", label: "Halong Bay", lat: 20.9101, lng: 107.1839, aliases: ["halong", "ha long", "hạ long", "hạ long"] },
  { id: "ninh-binh", label: "Ninh Binh", lat: 20.2506, lng: 105.9745, aliases: ["ninh binh", "ninh bình", "trang an", "tràng an", "hang mua", "hoa lu", "bai dinh"] },
  { id: "tam-dao", label: "Tam Dao", lat: 21.4569, lng: 105.6440, aliases: ["tam dao", "tam đảo"] },
  { id: "sapa", label: "Sapa", lat: 22.3364, lng: 103.8438, aliases: ["sapa", "sa pa", "fansipan", "o quy ho", "muong hoa"] },
  { id: "hue", label: "Hue", lat: 16.4637, lng: 107.5909, aliases: ["hue", "huế", "thien mu", "thiên mụ", "imperial citadel", "lang co", "lăng cô"] },
  { id: "danang", label: "Da Nang", lat: 16.0544, lng: 108.2022, aliases: ["da nang", "danang", "đà nẵng", "marble mountains", "son tra", "dragon bridge", "ba na", "bà nà", "bana"] },
  { id: "hoi-an", label: "Hoi An", lat: 15.8801, lng: 108.3380, aliases: ["hoi an", "hội an", "họi an", "coconut forest"] },
  { id: "phu-quoc", label: "Phu Quoc", lat: 10.2899, lng: 103.9840, aliases: ["phu quoc", "phú quốc", "phú quốc", "sao beach", "hon thom", "hòn thơm", "grand world", "sunset town"] }
]);

function normalizeText(value) {
  return String(value ?? "").trim();
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function storageAvailable() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const key = "__atp_customizer_probe__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function storageKey(tourId) {
  return `${TOUR_CUSTOMIZE_STORAGE_PREFIX}${tourId}`;
}

function projectLatLng(routePoint) {
  const lat = Number(routePoint?.lat);
  const lng = Number(routePoint?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const x = ((lng - TOUR_CUSTOMIZE_ROUTE_BOUNDS.west) / (TOUR_CUSTOMIZE_ROUTE_BOUNDS.east - TOUR_CUSTOMIZE_ROUTE_BOUNDS.west)) * 100;
  const y = ((TOUR_CUSTOMIZE_ROUTE_BOUNDS.north - lat) / (TOUR_CUSTOMIZE_ROUTE_BOUNDS.north - TOUR_CUSTOMIZE_ROUTE_BOUNDS.south)) * 100;
  return {
    x: Math.min(96, Math.max(4, x)),
    y: Math.min(96, Math.max(4, y))
  };
}

function normalizeSearchText(value) {
  return normalizeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function resolveLocalizedField(source, field, lang) {
  const map = source?.[`${field}_i18n`];
  const localized = map && typeof map === "object" && !Array.isArray(map)
    ? normalizeText(map[lang]) || normalizeText(map.en)
    : "";
  return localized || normalizeText(source?.[field]);
}

function daySearchText(day, lang) {
  const services = Array.isArray(day?.services) ? day.services : [];
  return [
    resolveLocalizedField(day, "title", lang),
    resolveLocalizedField(day, "overnight_location", lang),
    resolveLocalizedField(day, "notes", lang),
    ...services.flatMap((service) => [
      resolveLocalizedField(service, "title", lang),
      resolveLocalizedField(service, "location", lang),
      resolveLocalizedField(service, "details", lang)
    ])
  ].join(" ");
}

function resolveRoutePoint(day, lang) {
  const explicit = day?.route_point || day?.routePoint;
  if (explicit && Number.isFinite(Number(explicit.lat)) && Number.isFinite(Number(explicit.lng))) {
    const label = normalizeText(explicit.label) || resolveLocalizedField(day, "overnight_location", lang);
    return { lat: Number(explicit.lat), lng: Number(explicit.lng), label };
  }
  const haystack = normalizeSearchText(daySearchText(day, lang));
  let match = null;
  for (const point of TOUR_CUSTOMIZE_ROUTE_POINTS) {
    for (const alias of point.aliases) {
      const normalizedAlias = normalizeSearchText(alias);
      const index = normalizedAlias ? haystack.lastIndexOf(normalizedAlias) : -1;
      if (index < 0) continue;
      if (
        !match
        || index > match.index
        || (index === match.index && normalizedAlias.length > match.aliasLength)
      ) {
        match = { point, index, aliasLength: normalizedAlias.length };
      }
    }
  }
  return match ? { lat: match.point.lat, lng: match.point.lng, label: match.point.label } : null;
}

function firstCustomerImage(day) {
  for (const service of Array.isArray(day?.services) ? day.services : []) {
    const images = [
      service?.image,
      ...(Array.isArray(service?.images) ? service.images : [])
    ];
    for (const image of images) {
      if (!image || typeof image !== "object" || Array.isArray(image)) continue;
      if (image.is_customer_visible === false) continue;
      const src = normalizeText(image.storage_path || image.url || image.src || image.path);
      if (src) return src;
    }
  }
  return "";
}

function summarizeDay(day, lang) {
  const notes = compactText(resolveLocalizedField(day, "notes", lang));
  if (notes) return notes.length > 150 ? `${notes.slice(0, 147).trim()}...` : notes;
  const service = (Array.isArray(day?.services) ? day.services : [])
    .map((item) => compactText(resolveLocalizedField(item, "title", lang) || resolveLocalizedField(item, "details", lang)))
    .find(Boolean);
  return service || "";
}

function dayModuleFromDay({ day, sourceTourId, originalTourId, lang }) {
  const sourceDayId = normalizeText(day?.id);
  const routePoint = resolveRoutePoint(day, lang);
  if (!sourceTourId || !sourceDayId || !routePoint) return null;
  const mapPoint = projectLatLng(routePoint);
  if (!mapPoint) return null;
  const locationLabel = normalizeText(routePoint.label)
    || resolveLocalizedField(day, "overnight_location", lang)
    || resolveLocalizedField(day, "title", lang);
  return {
    id: `${sourceTourId}:${sourceDayId}`,
    source: sourceTourId === originalTourId ? "original" : "optional",
    sourceTourId,
    sourceDayId,
    title: resolveLocalizedField(day, "title", lang) || locationLabel,
    locationLabel,
    summary: summarizeDay(day, lang),
    thumbnailUrl: firstCustomerImage(day),
    routePoint,
    mapPoint,
    day: cloneJson(day)
  };
}

function normalizeCustomizationPayload(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const originalTourId = normalizeText(source.originalTourId);
  const timelineDays = (Array.isArray(source.timelineDays) ? source.timelineDays : [])
    .map((item) => {
      const sourceTourId = normalizeText(item?.sourceTourId);
      const sourceDayId = normalizeText(item?.sourceDayId);
      const day = item?.day && typeof item.day === "object" && !Array.isArray(item.day) ? item.day : null;
      if (!sourceTourId || !sourceDayId || !day) return null;
      return {
        ...item,
        id: normalizeText(item?.id) || `${sourceTourId}:${sourceDayId}`,
        sourceTourId,
        sourceDayId,
        day
      };
    })
    .filter(Boolean)
    .slice(0, TOUR_CUSTOMIZE_MAX_DAYS);
  return originalTourId && timelineDays.length ? { originalTourId, timelineDays } : null;
}

export function createTourCustomizer({
  state,
  frontendT,
  currentFrontendLang,
  normalizeFrontendTourLang,
  escapeHTML,
  escapeAttr,
  travelPlanDays,
  findTripById,
  ensureTourDetailsLoaded,
  allTrips,
  renderVisibleTrips
}) {
  const customizations = new Map();
  const canUseStorage = storageAvailable();
  let modal = null;
  let draft = null;
  let lastFocusedElement = null;
  let activeDragPayload = null;
  let activeDropIndex = null;
  let activePointerDrag = null;

  function t(key, fallback, vars) {
    return typeof frontendT === "function" ? frontendT(key, fallback, vars) : fallback;
  }

  function lang() {
    return typeof normalizeFrontendTourLang === "function"
      ? normalizeFrontendTourLang(currentFrontendLang?.())
      : normalizeText(currentFrontendLang?.()) || "en";
  }

  function loadStoredCustomization(tourId) {
    const normalizedTourId = normalizeText(tourId);
    if (!normalizedTourId || customizations.has(normalizedTourId) || !canUseStorage) {
      return customizations.get(normalizedTourId) || null;
    }
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey(normalizedTourId)) || "null");
      const normalized = normalizeCustomizationPayload(parsed);
      if (normalized?.originalTourId === normalizedTourId) {
        customizations.set(normalizedTourId, normalized);
        return normalized;
      }
    } catch {
      return null;
    }
    return null;
  }

  function saveCustomization(customization) {
    const normalized = normalizeCustomizationPayload(customization);
    if (!normalized) return;
    customizations.set(normalized.originalTourId, normalized);
    if (!canUseStorage) return;
    try {
      window.localStorage.setItem(storageKey(normalized.originalTourId), JSON.stringify(normalized));
    } catch {
      // Local persistence is best effort; the active page state still works.
    }
  }

  function clearCustomization(tourId) {
    const normalizedTourId = normalizeText(tourId);
    customizations.delete(normalizedTourId);
    if (canUseStorage) {
      try {
        window.localStorage.removeItem(storageKey(normalizedTourId));
      } catch {
        // Ignore storage failures.
      }
    }
  }

  function hasCustomization(tourId) {
    return Boolean(loadStoredCustomization(tourId));
  }

  function activeDaysForTrip(trip) {
    const tourId = normalizeText(trip?.id);
    const customization = loadStoredCustomization(tourId);
    if (!customization) return typeof travelPlanDays === "function" ? travelPlanDays(trip) : [];
    return customization.timelineDays.map((item, index) => ({
      ...cloneJson(item.day),
      day_number: index + 1
    }));
  }

  function selectedDaysForPdf(tourId) {
    const customization = loadStoredCustomization(tourId);
    if (!customization) return [];
    return customization.timelineDays.map((item) => ({
      source_tour_id: item.sourceTourId,
      source_day_id: item.sourceDayId
    }));
  }

  function routePreviewForTrip(trip) {
    const tourId = normalizeText(trip?.id);
    const days = activeDaysForTrip(trip);
    const modules = days
      .map((day) => dayModuleFromDay({
        day,
        sourceTourId: tourId,
        originalTourId: tourId,
        lang: lang()
      }))
      .filter(Boolean);
    const groups = routeGroups(modules);
    return {
      points: routePolylinePoints(groups),
      groups: groups.map((group) => ({
        label: formatDayNumbers(group.dayNumbers),
        locationLabel: group.item.locationLabel,
        x: group.mapPoint.x,
        y: group.mapPoint.y
      }))
    };
  }

  async function candidateModulesForTrip(baseTrip) {
    const currentLang = lang();
    const baseTourId = normalizeText(baseTrip?.id);
    const trips = typeof allTrips === "function" ? allTrips() : [];
    await Promise.all((Array.isArray(trips) ? trips : []).map(async (trip) => {
      const tripId = normalizeText(trip?.id);
      if (!tripId || (typeof travelPlanDays === "function" && travelPlanDays(trip).length)) return;
      try {
        await ensureTourDetailsLoaded?.(tripId);
      } catch {
        // Optional days are opportunistic; skip tours whose details fail to load.
      }
    }));
    return (Array.isArray(trips) ? trips : []).flatMap((trip) => {
      const sourceTourId = normalizeText(trip?.id);
      return (typeof travelPlanDays === "function" ? travelPlanDays(trip) : [])
        .map((day) => dayModuleFromDay({ day, sourceTourId, originalTourId: baseTourId, lang: currentLang }))
        .filter(Boolean);
    });
  }

  function initialTimelineFromTrip(baseTrip, modules) {
    const baseTourId = normalizeText(baseTrip?.id);
    const stored = loadStoredCustomization(baseTourId);
    if (stored) {
      const byId = new Map(modules.map((item) => [item.id, item]));
      const timelineDays = stored.timelineDays
        .map((item) => byId.get(`${item.sourceTourId}:${item.sourceDayId}`) || dayModuleFromDay({
          day: item.day,
          sourceTourId: item.sourceTourId,
          originalTourId: baseTourId,
          lang: lang()
        }))
        .filter(Boolean)
        .slice(0, TOUR_CUSTOMIZE_MAX_DAYS);
      if (timelineDays.length) return timelineDays;
    }
    return modules
      .filter((item) => item.sourceTourId === baseTourId)
      .slice(0, TOUR_CUSTOMIZE_MAX_DAYS);
  }

  function optionalModules(modules, timelineDays) {
    const selected = new Set(timelineDays.map((item) => item.id));
    return modules.filter((item) => !selected.has(item.id));
  }

  function routeGroups(timelineDays) {
    const groups = [];
    const byPoint = new Map();
    timelineDays.forEach((item, index) => {
      const key = routeKeyForItem(item);
      if (!key) return;
      if (!byPoint.has(key)) {
        const group = {
          key,
          item,
          mapPoint: item.mapPoint,
          dayNumbers: [],
          visits: []
        };
        byPoint.set(key, group);
        groups.push(group);
      }
      const group = byPoint.get(key);
      group.dayNumbers.push(index + 1);
      group.visits.push(item);
    });
    return groups;
  }

  function routeKeyForItem(item) {
    const lat = Number(item?.routePoint?.lat);
    const lng = Number(item?.routePoint?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
    return `${lat.toFixed(4)}:${lng.toFixed(4)}`;
  }

  function formatDayNumbers(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const ranges = [];
    for (let index = 0; index < sorted.length; index += 1) {
      const start = sorted[index];
      let end = start;
      while (sorted[index + 1] === end + 1) {
        end = sorted[index + 1];
        index += 1;
      }
      ranges.push(start === end ? String(start) : `${start}-${end}`);
    }
    return ranges.join(", ");
  }

  function routePolylinePoints(groups) {
    const points = [];
    for (const group of groups) {
      const point = `${group.mapPoint.x.toFixed(2)},${group.mapPoint.y.toFixed(2)}`;
      if (points[points.length - 1] !== point) points.push(point);
    }
    return points.join(" ");
  }

  function renderMap() {
    const groups = routeGroups(draft.timelineDays);
    const points = routePolylinePoints(groups);
    return `
      <section class="tour-customize-map" aria-label="${escapeAttr(t("tour.customize.map", "Route map"))}">
        <div class="tour-customize-map__canvas">
          <div class="tour-customize-map__frame">
            <div class="tour-customize-map__region" aria-hidden="true"></div>
            <svg class="tour-customize-map__route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              ${points ? `<polyline points="${escapeAttr(points)}" fill="none" vector-effect="non-scaling-stroke" />` : ""}
            </svg>
            ${groups.map((group) => {
              const label = formatDayNumbers(group.dayNumbers);
              const location = group.item.locationLabel;
              const aria = t("tour.customize.marker_label", "Days {days}, {location}", { days: label, location });
              return `
                <button class="tour-customize-map__marker" type="button" data-customize-route-key="${escapeAttr(group.key)}" style="left:${group.mapPoint.x}%;top:${group.mapPoint.y}%;" aria-label="${escapeAttr(aria)}" title="${escapeAttr(aria)}">
                  ${escapeHTML(label)}
                </button>
              `;
            }).join("")}
          </div>
        </div>
      </section>
    `;
  }

  function renderOptionalCard(item) {
    return `
      <article class="tour-customize-option" data-customize-option-id="${escapeAttr(item.id)}">
        ${item.thumbnailUrl
          ? `<img src="${escapeAttr(item.thumbnailUrl)}" alt="" loading="lazy" />`
          : `<span class="tour-customize-option__thumb" aria-hidden="true"></span>`}
        <div class="tour-customize-option__body">
          <h4>${escapeHTML(item.title)}</h4>
          <p class="tour-customize-option__location">${escapeHTML(item.locationLabel)}</p>
          ${item.summary ? `<p>${escapeHTML(item.summary)}</p>` : ""}
        </div>
        <span class="tour-customize-option__handle" aria-hidden="true">::</span>
      </article>
    `;
  }

  function renderTimelineItem(item, index) {
    return `
      <article class="tour-customize-timeline__item" data-customize-timeline-id="${escapeAttr(item.id)}">
        <span class="tour-customize-timeline__day">${escapeHTML(t("tour.customize.day", "Day {day}", { day: String(index + 1) }))}</span>
        <div class="tour-customize-timeline__actions">
          <button type="button" data-customize-remove="${escapeAttr(item.id)}" aria-label="${escapeAttr(t("tour.customize.remove", "Remove day"))}">&times;</button>
        </div>
        ${item.thumbnailUrl
          ? `<img src="${escapeAttr(item.thumbnailUrl)}" alt="" loading="lazy" />`
          : `<span class="tour-customize-timeline__thumb" aria-hidden="true"></span>`}
        <div class="tour-customize-timeline__body">
          <h4>${escapeHTML(item.title)}</h4>
          <p>${escapeHTML(item.locationLabel)}</p>
        </div>
        <span class="tour-customize-timeline__handle" aria-hidden="true">::</span>
      </article>
    `;
  }

  function renderModalBody() {
    const optionalDays = optionalModules(draft.modules, draft.timelineDays);
    const canFinish = draft.timelineDays.length > 0 && draft.timelineDays.length <= TOUR_CUSTOMIZE_MAX_DAYS;
    return `
      <div class="tour-customize__dialog" role="dialog" aria-modal="true" aria-labelledby="tour_customize_title">
        <header class="tour-customize__header">
          <div>
            <h2 id="tour_customize_title">${escapeHTML(t("tour.customize.title", "Customize this tour"))}</h2>
            <p>${escapeHTML(t("tour.customize.subtitle", "Adapt the day-by-day route before previewing your trip."))}</p>
          </div>
          <div class="tour-customize__header-actions">
            <button class="btn btn-secondary" type="button" data-customize-reset>${escapeHTML(t("tour.customize.reset", "Reset tour"))}</button>
            <button class="tour-customize__close" type="button" data-customize-close aria-label="${escapeAttr(t("tour.customize.close", "Close"))}">&times;</button>
          </div>
        </header>
        <div class="tour-customize__workspace">
          ${renderMap()}
          <section class="tour-customize-options" aria-label="${escapeAttr(t("tour.customize.optional_days", "Optional days"))}">
            <h3>${escapeHTML(t("tour.customize.optional_days", "Optional days"))}</h3>
            <div class="tour-customize-options__list">
              ${optionalDays.length
                ? optionalDays.map(renderOptionalCard).join("")
                : `<p class="tour-customize__empty">${escapeHTML(t("tour.customize.no_optional_days", "No optional days are available for this route yet."))}</p>`}
            </div>
            </section>
            <section class="tour-customize-timeline" aria-label="${escapeAttr(t("tour.customize.timeline", "Your itinerary"))}">
              <div class="tour-customize-timeline__header">
                <h3>${escapeHTML(t("tour.customize.timeline", "Your itinerary"))}</h3>
              </div>
              <div class="tour-customize-timeline__list" data-customize-timeline>
                ${draft.timelineDays.length
                ? draft.timelineDays.map(renderTimelineItem).join("")
                : `<p class="tour-customize__empty">${escapeHTML(t("tour.customize.empty_timeline", "Add at least one day to keep customizing."))}</p>`}
            </div>
          </section>
        </div>
        <footer class="tour-customize__footer">
          <p>${escapeHTML(t("tour.customize.limit", "Maximum {count} days.", { count: String(TOUR_CUSTOMIZE_MAX_DAYS) }))}</p>
          <div>
            <button class="btn btn-secondary" type="button" data-customize-cancel>${escapeHTML(t("tour.customize.cancel", "Cancel"))}</button>
            <button class="btn btn-primary" type="button" data-customize-finish ${canFinish ? "" : "disabled"}>${escapeHTML(t("tour.customize.finish", "Use this itinerary"))}</button>
          </div>
        </footer>
      </div>
    `;
  }

  function renderModal() {
    if (!modal) return;
    modal.innerHTML = renderModalBody();
    bindModalEvents();
  }

  function addDay(itemId, insertIndex = draft.timelineDays.length) {
    if (!draft || draft.timelineDays.length >= TOUR_CUSTOMIZE_MAX_DAYS) return;
    const item = draft.modules.find((candidate) => candidate.id === itemId);
    if (!item || draft.timelineDays.some((candidate) => candidate.id === item.id)) return;
    const next = [...draft.timelineDays];
    next.splice(Math.min(Math.max(0, insertIndex), next.length), 0, item);
    draft.timelineDays = next;
    renderModal();
  }

  function removeDay(itemId) {
    if (!draft) return;
    draft.timelineDays = draft.timelineDays.filter((item) => item.id !== itemId);
    renderModal();
  }

  function closeModal({ restoreFocus = true } = {}) {
    if (modal?.parentNode) modal.parentNode.removeChild(modal);
    modal = null;
    draft = null;
    activeDragPayload = null;
    activeDropIndex = null;
    activePointerDrag = null;
    document.documentElement.classList.remove("tour-customize-modal-open");
    document.documentElement.classList.remove("tour-customize-pointer-dragging");
    if (restoreFocus && lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
  }

  function finishCustomization() {
    if (!draft || !draft.timelineDays.length) return;
    saveCustomization({
      originalTourId: draft.tourId,
      timelineDays: draft.timelineDays.map((item) => ({
        id: item.id,
        source: item.source,
        sourceTourId: item.sourceTourId,
        sourceDayId: item.sourceDayId,
        day: item.day
      }))
    });
    closeModal({ restoreFocus: false });
    renderVisibleTrips?.();
  }

  function resetDraftToOriginal() {
    if (!draft) return;
    clearCustomization(draft.tourId);
    draft.timelineDays = draft.modules
      .filter((item) => item.sourceTourId === draft.tourId)
      .slice(0, TOUR_CUSTOMIZE_MAX_DAYS);
    renderModal();
  }

  function dragPayloadFromEvent(event) {
    if (activeDragPayload) return activeDragPayload;
    try {
      const payload = JSON.parse(event.dataTransfer?.getData("text/plain") || "null");
      const id = normalizeText(payload?.id);
      const kind = payload?.kind === "timeline" ? "timeline" : payload?.kind === "option" ? "option" : "";
      return kind && id ? { kind, id } : null;
    } catch {
      return null;
    }
  }

  function timelineItemElements(timeline) {
    return [...timeline.querySelectorAll("[data-customize-timeline-id]")]
      .filter((element) => element instanceof HTMLElement);
  }

  function timelineInsertIndex(timeline, clientX) {
    const items = timelineItemElements(timeline);
    for (let index = 0; index < items.length; index += 1) {
      const rect = items[index].getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) return index;
    }
    return items.length;
  }

  function clearDropSlot(timeline) {
    timeline?.querySelector(".tour-customize-timeline__drop-slot")?.remove();
    timeline?.closest(".tour-customize-timeline")?.classList.remove("tour-customize-timeline--drop-active");
    activeDropIndex = null;
  }

  function renderDropSlot(timeline, insertIndex, variant = "day") {
    if (!draft || !(timeline instanceof HTMLElement)) return;
    const boundedIndex = Math.min(Math.max(0, insertIndex), draft.timelineDays.length);
    const existing = timeline.querySelector(".tour-customize-timeline__drop-slot");
    const slot = existing instanceof HTMLElement ? existing : document.createElement("div");
    const normalizedVariant = variant === "between" ? "between" : "day";
    slot.className = `tour-customize-timeline__drop-slot${normalizedVariant === "between" ? " tour-customize-timeline__drop-slot--between" : ""}`;
    if (!existing || slot.getAttribute("data-customize-drop-variant") !== normalizedVariant) {
      slot.setAttribute("aria-hidden", "true");
      slot.innerHTML = normalizedVariant === "between"
        ? `<strong>${escapeHTML(t("tour.customize.drop_here", "Drop here"))}</strong>`
        : `<span>+</span><strong>${escapeHTML(t("tour.customize.drop_here", "Drop here"))}</strong>`;
    }
    slot.setAttribute("data-customize-drop-index", String(boundedIndex));
    slot.setAttribute("data-customize-drop-variant", normalizedVariant);
    const items = timelineItemElements(timeline);
    timeline.insertBefore(slot, items[boundedIndex] || null);
    timeline.closest(".tour-customize-timeline")?.classList.add("tour-customize-timeline--drop-active");
    activeDropIndex = boundedIndex;
  }

  function updateTimelineDayLabels(timeline) {
    timelineItemElements(timeline).forEach((element, index) => {
      const day = element.querySelector(".tour-customize-timeline__day");
      if (day) {
        day.textContent = t("tour.customize.day", "Day {day}", { day: String(index + 1) });
      }
    });
  }

  function syncTimelineDomOrder(timeline) {
    const byId = new Map(timelineItemElements(timeline).map((element) => [
      element.getAttribute("data-customize-timeline-id"),
      element
    ]));
    draft.timelineDays.forEach((item) => {
      const element = byId.get(item.id);
      if (element) timeline.appendChild(element);
    });
    updateTimelineDayLabels(timeline);
  }

  function reorderTimelineDuringDrag(timeline, draggedId, insertIndex) {
    if (!draft || !(timeline instanceof HTMLElement)) return;
    const currentIndex = draft.timelineDays.findIndex((item) => item.id === draggedId);
    if (currentIndex < 0) return;
    const boundedInsertIndex = Math.min(Math.max(0, insertIndex), draft.timelineDays.length);
    const nextIndex = boundedInsertIndex > currentIndex ? boundedInsertIndex - 1 : boundedInsertIndex;
    if (nextIndex < 0 || nextIndex >= draft.timelineDays.length || nextIndex === currentIndex) return;
    const next = [...draft.timelineDays];
    const [item] = next.splice(currentIndex, 1);
    next.splice(nextIndex, 0, item);
    draft.timelineDays = next;
    syncTimelineDomOrder(timeline);
  }

  function autoScrollTimelineDuringDrag(timeline, event) {
    const rect = timeline.getBoundingClientRect();
    const edge = 44;
    if (event.clientX < rect.left + edge) {
      timeline.scrollLeft -= Math.ceil((rect.left + edge - event.clientX) / 4);
    } else if (event.clientX > rect.right - edge) {
      timeline.scrollLeft += Math.ceil((event.clientX - (rect.right - edge)) / 4);
    }
  }

  function isNearTimeline(timeline, event) {
    const rect = timeline.getBoundingClientRect();
    const padding = 72;
    return event.clientX >= rect.left - padding
      && event.clientX <= rect.right + padding
      && event.clientY >= rect.top - padding
      && event.clientY <= rect.bottom + padding;
  }

  function dropIntoTimeline(event, timeline) {
    event.preventDefault();
    event.stopPropagation();
    const payload = dragPayloadFromEvent(event);
    const id = normalizeText(payload?.id);
    if (!draft || !id) return;
    const insertIndex = Number.isInteger(activeDropIndex)
      ? activeDropIndex
      : timelineInsertIndex(timeline, event.clientX);
    clearDropSlot(timeline);
    activeDragPayload = null;
    if (payload.kind === "option") {
      addDay(id, insertIndex);
      return;
    }
    if (payload.kind === "timeline") {
      updateTimelineDayLabels(timeline);
      renderModal();
    }
  }

  function moveDragGhost(event) {
    if (!activePointerDrag?.ghost) return;
    activePointerDrag.ghost.style.left = `${event.clientX - activePointerDrag.offsetX}px`;
    activePointerDrag.ghost.style.top = `${event.clientY - activePointerDrag.offsetY}px`;
  }

  function clearMapDragHighlight() {
    modal?.querySelectorAll(".tour-customize-map__marker.is-drag-location").forEach((marker) => {
      marker.classList.remove("is-drag-location");
    });
    modal?.querySelector("[data-customize-drag-map-marker]")?.remove();
  }

  function itemById(itemId) {
    const id = normalizeText(itemId);
    if (!id || !draft) return null;
    return draft.modules.find((item) => item.id === id)
      || draft.timelineDays.find((item) => item.id === id)
      || null;
  }

  function highlightMapLocation(itemId) {
    clearMapDragHighlight();
    const item = itemById(itemId);
    const key = routeKeyForItem(item);
    if (!item || !key || !item.mapPoint) return;
    const existingMarker = Array.from(modal?.querySelectorAll(".tour-customize-map__marker") || [])
      .find((marker) => marker.getAttribute("data-customize-route-key") === key);
    if (existingMarker instanceof HTMLElement) {
      existingMarker.classList.add("is-drag-location");
      return;
    }
    const marker = document.createElement("span");
    marker.className = "tour-customize-map__marker is-drag-location";
    marker.setAttribute("data-customize-drag-map-marker", "");
    marker.setAttribute("aria-hidden", "true");
    marker.style.left = `${item.mapPoint.x}%`;
    marker.style.top = `${item.mapPoint.y}%`;
    modal?.querySelector(".tour-customize-map__frame")?.appendChild(marker);
  }

  function cleanupPointerDrag({ commit = false, event = null } = {}) {
    const pointerDrag = activePointerDrag;
    if (!pointerDrag) return;
    activePointerDrag = null;
    activeDragPayload = null;
    clearMapDragHighlight();
    pointerDrag.source?.classList.remove("is-dragging");
    pointerDrag.ghost?.remove();
    document.removeEventListener("pointermove", handlePointerDragMove);
    document.removeEventListener("pointerup", handlePointerDragEnd);
    document.removeEventListener("pointercancel", handlePointerDragCancel);
    document.documentElement.classList.remove("tour-customize-pointer-dragging");
    if (pointerDrag.timeline instanceof HTMLElement) {
      const shouldAddOption = commit
        && event
        && pointerDrag.kind === "option"
        && isNearTimeline(pointerDrag.timeline, event);
      const insertIndex = Number.isInteger(activeDropIndex)
        ? activeDropIndex
        : event
          ? timelineInsertIndex(pointerDrag.timeline, event.clientX)
          : draft?.timelineDays.length || 0;
      clearDropSlot(pointerDrag.timeline);
      if (shouldAddOption) {
        addDay(pointerDrag.id, insertIndex);
        return;
      }
      if (commit && pointerDrag.kind === "timeline") {
        renderModal();
      }
    }
  }

  function handlePointerDragMove(event) {
    if (!activePointerDrag || event.pointerId !== activePointerDrag.pointerId) return;
    event.preventDefault();
    moveDragGhost(event);
    const timeline = activePointerDrag.timeline;
    if (!(timeline instanceof HTMLElement)) return;
    autoScrollTimelineDuringDrag(timeline, event);
    if (!isNearTimeline(timeline, event)) {
      clearDropSlot(timeline);
      return;
    }
    const insertIndex = timelineInsertIndex(timeline, event.clientX);
    if (activePointerDrag.kind === "timeline") {
      reorderTimelineDuringDrag(timeline, activePointerDrag.id, insertIndex);
      const currentIndex = draft?.timelineDays.findIndex((item) => item.id === activePointerDrag.id) ?? -1;
      renderDropSlot(timeline, currentIndex >= 0 ? currentIndex : insertIndex, "between");
      return;
    }
    renderDropSlot(timeline, insertIndex);
  }

  function handlePointerDragEnd(event) {
    if (!activePointerDrag || event.pointerId !== activePointerDrag.pointerId) return;
    event.preventDefault();
    cleanupPointerDrag({ commit: true, event });
  }

  function handlePointerDragCancel(event) {
    if (!activePointerDrag || event.pointerId !== activePointerDrag.pointerId) return;
    cleanupPointerDrag();
  }

  function startPointerDrag(element, event, root) {
    if (!(element instanceof HTMLElement) || event.button !== 0 || activePointerDrag) return;
    const optionId = element.getAttribute("data-customize-option-id");
    const timelineId = element.getAttribute("data-customize-timeline-id");
    const id = normalizeText(optionId || timelineId);
    const kind = optionId ? "option" : timelineId ? "timeline" : "";
    const timeline = root.querySelector("[data-customize-timeline]");
    if (!id || !kind || !(timeline instanceof HTMLElement)) return;
    event.preventDefault();
    const rect = element.getBoundingClientRect();
    const ghost = element.cloneNode(true);
    ghost.classList.add("tour-customize-drag-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.removeAttribute("data-customize-option-id");
    ghost.removeAttribute("data-customize-timeline-id");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.appendChild(ghost);
    activePointerDrag = {
      kind,
      id,
      pointerId: event.pointerId,
      source: element,
      ghost,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      timeline
    };
    activeDragPayload = { kind, id };
    element.classList.add("is-dragging");
    highlightMapLocation(id);
    document.documentElement.classList.add("tour-customize-pointer-dragging");
    moveDragGhost(event);
    document.addEventListener("pointermove", handlePointerDragMove, { passive: false });
    document.addEventListener("pointerup", handlePointerDragEnd, { passive: false });
    document.addEventListener("pointercancel", handlePointerDragCancel);
  }

  function bindDragAndDrop(root) {
    root.querySelectorAll(".tour-customize-option__handle, .tour-customize-timeline__handle").forEach((handle) => {
      if (!(handle instanceof HTMLElement)) return;
      handle.addEventListener("pointerdown", (event) => {
        const source = handle.closest("[data-customize-option-id], [data-customize-timeline-id]");
        startPointerDrag(source, event, root);
      });
    });

    root.querySelectorAll("[data-customize-option-id], [data-customize-timeline-id]").forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      element.addEventListener("dragstart", (event) => {
        const optionId = element.getAttribute("data-customize-option-id");
        const timelineId = element.getAttribute("data-customize-timeline-id");
        activeDragPayload = {
          kind: optionId ? "option" : "timeline",
          id: optionId || timelineId
        };
        element.classList.add("is-dragging");
        highlightMapLocation(activeDragPayload.id);
        if (event.dataTransfer) {
          event.dataTransfer.setData("text/plain", JSON.stringify(activeDragPayload));
          event.dataTransfer.effectAllowed = "move";
        }
      });
      element.addEventListener("dragend", () => {
        element.classList.remove("is-dragging");
        const wasTimelineDrag = activeDragPayload?.kind === "timeline";
        activeDragPayload = null;
        clearMapDragHighlight();
        const timeline = root.querySelector("[data-customize-timeline]");
        if (timeline instanceof HTMLElement) clearDropSlot(timeline);
        if (wasTimelineDrag) renderModal();
      });
    });

    const timeline = root.querySelector("[data-customize-timeline]");
    if (!(timeline instanceof HTMLElement)) return;
    timeline.addEventListener("dragover", (event) => {
      const payload = dragPayloadFromEvent(event);
      if (!payload) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      if (payload.kind === "timeline") {
        reorderTimelineDuringDrag(timeline, payload.id, timelineInsertIndex(timeline, event.clientX));
        const currentIndex = draft?.timelineDays.findIndex((item) => item.id === payload.id) ?? -1;
        renderDropSlot(timeline, currentIndex >= 0 ? currentIndex : timelineInsertIndex(timeline, event.clientX), "between");
        return;
      }
      renderDropSlot(timeline, timelineInsertIndex(timeline, event.clientX));
    });
    timeline.addEventListener("dragleave", (event) => {
      if (event.relatedTarget instanceof Node && timeline.contains(event.relatedTarget)) return;
      if (isNearTimeline(timeline, event)) return;
      clearDropSlot(timeline);
    });
    root.addEventListener("dragover", (event) => {
      const payload = dragPayloadFromEvent(event);
      if (!payload || !isNearTimeline(timeline, event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      if (payload.kind === "timeline") {
        reorderTimelineDuringDrag(timeline, payload.id, timelineInsertIndex(timeline, event.clientX));
        const currentIndex = draft?.timelineDays.findIndex((item) => item.id === payload.id) ?? -1;
        renderDropSlot(timeline, currentIndex >= 0 ? currentIndex : timelineInsertIndex(timeline, event.clientX), "between");
        return;
      }
      renderDropSlot(timeline, timelineInsertIndex(timeline, event.clientX));
    });
    timeline.addEventListener("drop", (event) => {
      dropIntoTimeline(event, timeline);
    });
    root.addEventListener("drop", (event) => {
      if (!activeDragPayload || !isNearTimeline(timeline, event)) return;
      dropIntoTimeline(event, timeline);
    });
  }

  function bindModalEvents() {
    if (!modal) return;
    modal.querySelectorAll("[data-customize-remove]").forEach((button) => {
      button.addEventListener("click", () => removeDay(button.getAttribute("data-customize-remove")));
    });
    modal.querySelector("[data-customize-reset]")?.addEventListener("click", resetDraftToOriginal);
    modal.querySelector("[data-customize-finish]")?.addEventListener("click", finishCustomization);
    modal.querySelector("[data-customize-close]")?.addEventListener("click", () => closeModal());
    modal.querySelector("[data-customize-cancel]")?.addEventListener("click", () => closeModal());
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal();
    });
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
      }
    });
    bindDragAndDrop(modal);
  }

  async function open(tourId) {
    if (typeof document === "undefined") return;
    const normalizedTourId = normalizeText(tourId);
    let trip = typeof findTripById === "function" ? findTripById(normalizedTourId) : null;
    if (!trip) return;
    trip = await ensureTourDetailsLoaded?.(normalizedTourId) || trip;
    const modules = await candidateModulesForTrip(trip);
    const timelineDays = initialTimelineFromTrip(trip, modules);
    if (!timelineDays.length) return;
    lastFocusedElement = document.activeElement;
    draft = {
      tourId: normalizedTourId,
      modules,
      timelineDays
    };
    modal = document.createElement("div");
    modal.className = "tour-customize";
    document.body.appendChild(modal);
    document.documentElement.classList.add("tour-customize-modal-open");
    renderModal();
    const closeButton = modal.querySelector("[data-customize-close]");
    if (closeButton instanceof HTMLElement) closeButton.focus();
  }

  async function openCustomizedPdf(tourId) {
    const normalizedTourId = normalizeText(tourId);
    const selectedDays = selectedDaysForPdf(normalizedTourId);
    if (!selectedDays.length) return false;
    const response = await fetch(`/public/v1/tours/${encodeURIComponent(normalizedTourId)}/one-pager-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lang: lang(),
        selected_days: selectedDays
      })
    });
    if (!response.ok) throw new Error(`Customized PDF preview failed: ${response.status}`);
    const payload = await response.json();
    const pdfUrl = normalizeText(payload?.pdf_url);
    if (!pdfUrl) throw new Error("Customized PDF preview did not return a URL.");
    window.open(pdfUrl, "_blank", "noopener");
    return true;
  }

  return {
    hasCustomization,
    activeDaysForTrip,
    selectedDaysForPdf,
    routePreviewForTrip,
    open,
    openCustomizedPdf,
    clearCustomization
  };
}
