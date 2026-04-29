import { normalizeText } from "../../shared/js/text.js";
import {
  FRONTEND_LANGUAGE_CODES,
  normalizeLanguageCode
} from "../../shared/generated/language_catalog.js";

const DEFAULT_TOUR_IMAGE = "/assets/img/marketing_tours.png";
const TOUR_IMAGE_TRANSITION_MS = 2000;
const TOUR_GRID_LAYOUT_TRANSITION_MS = 520;
const TOUR_DETAILS_TRANSITION_MS = 640;
const TOUR_DETAILS_CLOSE_TRANSITION_MS = 780;
const TOUR_PLAN_SERVICE_SWAP_TRANSITION_MS = 380;
const TOUR_SHOW_MORE_LABEL_TRANSITION_MS = 180;
const TOUR_CARD_SCROLL_TIMEOUT_MS = 900;
const TOUR_CARD_SCROLL_MARGIN_PX = 12;
const TOUR_CARD_DESC_MIN_FONT_SIZE_PX = 10;
const TOUR_CARD_DESC_FIT_TOLERANCE_PX = 1;
const TOUR_CARD_DESC_FIT_ITERATIONS = 8;
const TOUR_CARD_MEDIA_SNAPSHOT_HOLD_MS = Math.max(
  TOUR_GRID_LAYOUT_TRANSITION_MS,
  TOUR_DETAILS_TRANSITION_MS,
  TOUR_DETAILS_CLOSE_TRANSITION_MS
) + 180;
const COUNTRY_TO_TOUR_DESTINATION_CODE = Object.freeze({
  VN: "vietnam",
  TH: "thailand",
  KH: "cambodia",
  LA: "laos"
});
const tourCardImageTransitionTimers = new WeakMap();

export function createFrontendToursController(ctx) {
  const {
    state,
    els,
    backendBaseUrl,
    initialVisibleTours,
    showMoreBatch,
    frontendT,
    currentFrontendLang,
    preferredCurrencyForFrontendLang,
    approximateDisplayAmountFromUSD,
    formatDisplayMoney,
    defaultBookingCurrency,
    escapeHTML,
    escapeAttr,
    updateBookingModalTitle,
    openBookingModal,
    setSelectedTourContext,
    clearSelectedTourContext,
    setBookingField,
    prefillBookingFormWithFilters
  } = ctx;

  let renderedTourGridColumnCount = 0;
  let tourGridResizeBound = false;
  let tourDetailsTransitioning = false;
  let tourCardMediaSnapshotToken = 0;
  const openingTourColumnIndexes = new Map();

  function normalizeFrontendTourLang(value) {
    return normalizeLanguageCode(value, { allowedCodes: FRONTEND_LANGUAGE_CODES, fallback: "en" });
  }

  function generatedTourAssetUrlsByLang() {
    const toursByLang = window.ASIATRAVELPLAN_PUBLIC_HOMEPAGE_COPY?.assetUrls?.toursByLang;
    return toursByLang && typeof toursByLang === "object" ? toursByLang : {};
  }

  function publicToursDataUrl(lang) {
    const normalizedLang = normalizeFrontendTourLang(lang);
    return normalizeText(generatedTourAssetUrlsByLang()?.[normalizedLang])
      || `/frontend/data/generated/homepage/public-tours.${encodeURIComponent(normalizedLang)}.json`;
  }

  function normalizeFilterSelection(value) {
    if (Array.isArray(value)) {
      return value
        .map((item) => normalizeText(item))
        .filter((item) => item && item.toLowerCase() !== "all");
    }
    const text = normalizeText(value);
    if (!text) return [];
    return text
      .split(",")
      .map((item) => normalizeText(item))
      .filter((item) => item && item.toLowerCase() !== "all");
  }

  function getFiltersFromURL() {
    const params = new URLSearchParams(window.location.search);
    const dest = normalizeFilterSelection(params.get("dest"));
    const area = normalizeText(params.get("area"));
    const place = normalizeText(params.get("place"));
    const style = normalizeFilterSelection(params.get("style"));
    return { dest, area, place, style };
  }

  function normalizeFilterOptionList(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => {
        if (item && typeof item === "object") {
          return {
            code: normalizeText(item.code),
            label: normalizeText(item.label) || normalizeText(item.code)
          };
        }
        const value = normalizeText(item);
        return value ? { code: value, label: value } : null;
      })
      .filter((item) => item?.code && item?.label);
  }

  function filterOptionList(kind) {
    const raw = kind === "destination" ? state.filterOptions.destinations : state.filterOptions.styles;
    return normalizeFilterOptionList(raw);
  }

  function normalizeDestinationCode(value) {
    const normalized = normalizeText(value);
    if (!normalized) return "";
    const countryCode = normalized.toUpperCase();
    if (COUNTRY_TO_TOUR_DESTINATION_CODE[countryCode]) return COUNTRY_TO_TOUR_DESTINATION_CODE[countryCode];
    return normalized.toLowerCase();
  }

  function normalizeDestinationScopeCatalogPayload(catalog) {
    const rawCatalog = catalog && typeof catalog === "object" && !Array.isArray(catalog) ? catalog : {};
    const destinationOptions = filterOptionList("destination");
    const destinationByCode = new Map();

    const addDestination = (item) => {
      const code = normalizeDestinationCode(item?.code || item?.destination || item?.country_code || item);
      if (!code || destinationByCode.has(code)) return;
      destinationByCode.set(code, {
        code,
        country_code: normalizeText(item?.country_code || item?.country || "").toUpperCase(),
        label: normalizeText(item?.label || item?.name) || filterLabel("destination", code) || code
      });
    };

    (Array.isArray(rawCatalog.destinations) ? rawCatalog.destinations : []).forEach(addDestination);
    destinationOptions.forEach(addDestination);

    const destinations = Array.from(destinationByCode.values());
    const destinationCodes = new Set(destinations.map((destination) => destination.code));
    const areas = (Array.isArray(rawCatalog.areas) ? rawCatalog.areas : [])
      .map((area) => {
        const destination = normalizeDestinationCode(area?.destination || area?.country_code);
        const id = normalizeText(area?.id || area?.area_id);
        if (!id || !destination || !destinationCodes.has(destination)) return null;
        return {
          id,
          destination,
          code: normalizeText(area?.code),
          label: normalizeText(area?.label || area?.name || area?.code) || id
        };
      })
      .filter(Boolean);
    const areaIds = new Set(areas.map((area) => area.id));
    const places = (Array.isArray(rawCatalog.places) ? rawCatalog.places : [])
      .map((place) => {
        const area_id = normalizeText(place?.area_id || place?.areaId);
        const id = normalizeText(place?.id || place?.place_id);
        if (!id || !area_id || !areaIds.has(area_id)) return null;
        return {
          id,
          area_id,
          code: normalizeText(place?.code),
          label: normalizeText(place?.label || place?.name || place?.code) || id
        };
      })
      .filter(Boolean);

    return { destinations, areas, places };
  }

  function destinationScopeCatalog() {
    return normalizeDestinationScopeCatalogPayload(state.filterOptions.destinationScopeCatalog);
  }

  function filterLabel(kind, value) {
    const normalized = normalizeText(value);
    if (!normalized) return "";
    const options = filterOptionList(kind);
    const match = options.find((option) => normalizeText(option.code).toLowerCase() === normalized.toLowerCase());
    return match?.label || normalized;
  }

  function filterLabels(values, kind) {
    return (Array.isArray(values) ? values : []).map((value) => filterLabel(kind, value)).filter(Boolean);
  }

  function normalizeSelectionToCodes(values, kind, { allowUnknown = true } = {}) {
    const options = filterOptionList(kind);
    return Array.from(new Set((Array.isArray(values) ? values : [values])
      .map((value) => normalizeText(value))
      .filter(Boolean)
      .map((value) => {
        const lower = value.toLowerCase();
        const match = options.find((option) => {
          const code = normalizeText(option.code).toLowerCase();
          const label = normalizeText(option.label).toLowerCase();
          return lower === code || lower === label;
        });
        const matchedCode = normalizeText(match?.code).toLowerCase();
        if (matchedCode) return matchedCode;
        return allowUnknown ? lower : "";
      })
      .filter(Boolean)));
  }

  function tourDestinations(trip) {
    if (Array.isArray(trip?.destinations) && trip.destinations.length) {
      return trip.destinations.map((value) => String(value || "").trim()).filter(Boolean);
    }
    return [];
  }

  function tourDestinationCodes(trip) {
    if (Array.isArray(trip?.destination_codes) && trip.destination_codes.length) {
      return trip.destination_codes.map((value) => normalizeDestinationCode(value)).filter(Boolean);
    }
    return normalizeSelectionToCodes(tourDestinations(trip), "destination");
  }

  function tourDestinationScopeEntries(trip) {
    const scope = Array.isArray(trip?.travel_plan?.destination_scope) ? trip.travel_plan.destination_scope : [];
    return scope
      .map((entry) => ({
        destination: normalizeDestinationCode(entry?.destination),
        areas: Array.isArray(entry?.areas) ? entry.areas : []
      }))
      .filter((entry) => entry.destination);
  }

  function tourIncludesDestinationScope(trip, { destination = "", area = "", place = "" } = {}) {
    const selectedDestination = normalizeDestinationCode(destination);
    const selectedArea = normalizeText(area);
    const selectedPlace = normalizeText(place);
    const scopeEntries = tourDestinationScopeEntries(trip);

    const destinationMatch = !selectedDestination
      || tourDestinationCodes(trip).includes(selectedDestination)
      || scopeEntries.some((entry) => entry.destination === selectedDestination);
    if (!destinationMatch) return false;

    if (!selectedArea && !selectedPlace) return true;

    return scopeEntries.some((entry) => (
      (!selectedDestination || entry.destination === selectedDestination)
      && entry.areas.some((areaSelection) => {
        const areaId = normalizeText(areaSelection?.area_id);
        if (selectedArea && areaId !== selectedArea) return false;
        if (!selectedPlace) return true;
        return (Array.isArray(areaSelection?.places) ? areaSelection.places : [])
          .some((placeSelection) => normalizeText(placeSelection?.place_id) === selectedPlace);
      })
    ));
  }

  function tourStyleCodes(trip) {
    if (Array.isArray(trip?.style_codes) && trip.style_codes.length) {
      return trip.style_codes.map((value) => normalizeText(value)).filter(Boolean);
    }
    return normalizeSelectionToCodes(Array.isArray(trip?.styles) ? trip.styles : [], "style");
  }

  function shouldShowHeroDestinationFilter() {
    return true;
  }

  function normalizeDestinationScopeFilterFromOptions() {
    const catalog = destinationScopeCatalog();
    const areaById = new Map(catalog.areas.map((area) => [area.id, area]));
    const placeById = new Map(catalog.places.map((place) => [place.id, place]));
    let destination = normalizeSelectionToCodes(state.filters.dest, "destination", { allowUnknown: false })[0] || "";
    let area = normalizeText(state.filters.area);
    let place = normalizeText(state.filters.place);

    if (place) {
      const matchedPlace = placeById.get(place);
      if (matchedPlace) {
        area = matchedPlace.area_id;
      } else {
        place = "";
      }
    }

    if (area) {
      const matchedArea = areaById.get(area);
      if (matchedArea) {
        destination = matchedArea.destination;
      } else {
        area = "";
        place = "";
      }
    }

    if (destination && !filterOptionList("destination").some((option) => normalizeDestinationCode(option.code) === destination)) {
      destination = "";
      area = "";
      place = "";
    }

    state.filters.dest = destination ? [destination] : [];
    state.filters.area = area;
    state.filters.place = place;
  }

  function normalizeActiveFiltersFromOptions() {
    normalizeDestinationScopeFilterFromOptions();
    state.filters.style = normalizeSelectionToCodes(state.filters.style, "style", { allowUnknown: false });
  }

  function setFilterCheckboxes(container, values) {
    if (!container) return;
    const selected = new Set(Array.isArray(values) ? values.map((item) => normalizeText(item)).filter(Boolean) : []);
    Array.from(container.querySelectorAll('input[type="checkbox"]')).forEach((input) => {
      input.checked = selected.has(normalizeText(input.value));
    });
  }

  function getCheckedValues(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
      .map((option) => normalizeText(option.value))
      .filter(Boolean);
  }

  function formatFilterValue(value, kind) {
    if (Array.isArray(value) && value.length) return filterLabels(value, kind).join(", ");
    return kind === "destination"
      ? frontendT("filters.all_destinations", "All destinations")
      : frontendT("filters.all_styles", "All travel styles");
  }

  function selectedDestinationScopeLabel() {
    const catalog = destinationScopeCatalog();
    const selectedPlace = normalizeText(state.filters.place);
    const selectedArea = normalizeText(state.filters.area);
    const selectedDestination = normalizeText(state.filters.dest?.[0]);
    const destinationLabel = selectedDestination ? filterLabel("destination", selectedDestination) : "";
    const labels = [];
    if (selectedPlace) {
      const place = catalog.places.find((item) => item.id === selectedPlace);
      if (place?.label) labels.push(place.label);
    }
    if (selectedArea) {
      const area = catalog.areas.find((item) => item.id === selectedArea);
      if (area?.label) labels.push(area.label);
    }
    if (destinationLabel) {
      labels.push(destinationLabel);
    }
    return labels.length
      ? labels.join(" · ")
      : frontendT("filters.all_destinations", "All destinations");
  }

  function updateFilterTriggerLabels() {
    if (els.navDestinationSummary) {
      els.navDestinationSummary.textContent = selectedDestinationScopeLabel();
    }
    if (els.navStyleSummary) {
      els.navStyleSummary.textContent = formatFilterValue(state.filters.style, "style");
    }
  }

  function renderFilterSummary() {
    if (!els.activeFilters) return;
    els.activeFilters.innerHTML = "";
    els.activeFilters.hidden = true;
  }

  function buildShowMoreToursLabel(moreCount) {
    const style = filterLabels(state.filters.style, "style");
    const destination = state.filters.dest.length ? [selectedDestinationScopeLabel()] : [];
    const countText = String(moreCount);

    if (style.length === 1) {
      return frontendT("tours.show_more.style", "Show {count} more {styleLower} tours", {
        count: countText,
        styleLower: String(style[0] || "").toLowerCase()
      });
    }

    if (destination.length === 1) {
      return frontendT("tours.show_more.destination", "Show {count} more tours in {destination}", {
        count: countText,
        destination: destination[0]
      });
    }

    return moreCount === 1
      ? frontendT("tours.show_more.generic_one", "Show 1 more tour")
      : frontendT("tours.show_more.generic_many", "Show {count} more tours", { count: countText });
  }

  function updateViewToursButton() {
    if (!els.viewToursBtn) return;
    const total = state.filteredTrips.length;
    if (total <= 0) {
      els.viewToursBtn.textContent = frontendT("tours.view.none", "No matching tours");
      els.viewToursBtn.disabled = true;
      return;
    }
    els.viewToursBtn.textContent = frontendT("tours.view.count", "View {count} tours", { count: total });
    els.viewToursBtn.disabled = false;
  }

  function scrollToToursGrid() {
    const toursSection = document.getElementById("tours");
    if (!toursSection) return;
    const header = document.querySelector(".header");
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    const targetTop = toursSection.getBoundingClientRect().top + window.scrollY - headerHeight;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth"
    });
  }

  function updateTourActions() {
    if (!els.tourActions || !els.showMoreTours) return;

    const total = state.filteredTrips.length;
    const remaining = Math.max(0, total - state.visibleToursCount);

    if (total === 0 || remaining === 0) {
      els.tourActions.hidden = true;
      els.showMoreTours.hidden = true;
      return;
    }

    const moreCount = remaining;
    const showMoreAvailable = moreCount > 0;

    els.tourActions.hidden = !showMoreAvailable;

    if (showMoreAvailable) {
      els.showMoreTours.hidden = false;
      els.showMoreTours.textContent = frontendT("tours.show_all.count", "Show all {count} tours", { count: total });
    } else {
      els.showMoreTours.hidden = true;
    }
  }

  function updateTitlesForFilters() {
    const dest = state.filters.dest;
    const style = state.filters.style;
    const destLabel = dest.length ? selectedDestinationScopeLabel() : formatFilterValue(dest, "destination");
    const styleLabel = formatFilterValue(style, "style");
    const styleLower = String(styleLabel || "").toLowerCase();

    let heading = frontendT("tours.heading.default", "Featured tours you can tailor");
    let booking = frontendT(
      "tours.booking.default",
      "Browse by destination and style. Filters update instantly and can be shared by URL."
    );
    let pageTitle = frontendT("tours.page_title.default", "AsiaTravelPlan | Custom Southeast Asia Holidays");

    if (dest.length && style.length) {
      heading = frontendT("tours.heading.destination_style", "{style} tours in {destination}", {
        style: styleLabel,
        destination: destLabel
      });
      booking = frontendT(
        "tours.booking.destination_style",
        "Showing {styleLower} journeys in {destination}. Clear filters to see all options.",
        { styleLower, destination: destLabel }
      );
      pageTitle = frontendT("tours.page_title.destination_style", "AsiaTravelPlan | {style} Tours in {destination}", {
        style: styleLabel,
        destination: destLabel
      });
    } else if (dest.length) {
      heading = frontendT("tours.heading.destination", "Featured tours in {destination}", { destination: destLabel });
      booking = frontendT("tours.booking.destination", "Showing all travel styles available in {destination}.", {
        destination: destLabel
      });
      pageTitle = frontendT("tours.page_title.destination", "AsiaTravelPlan | Tours in {destination}", {
        destination: destLabel
      });
    } else if (style.length) {
      heading = frontendT("tours.heading.style", "{style} travel styles across Southeast Asia", { style: styleLabel });
      booking = frontendT(
        "tours.booking.style",
        "Showing {styleLower} journeys across Vietnam, Thailand, Cambodia, and Laos.",
        { styleLower }
      );
      pageTitle = frontendT("tours.page_title.style", "AsiaTravelPlan | {style} Southeast Asia Tours", {
        style: styleLabel
      });
    }

    if (els.toursTitle) els.toursTitle.textContent = heading;
    if (els.toursBooking) els.toursBooking.textContent = booking;
    if (els.heroDynamicSubtitle) {
      els.heroDynamicSubtitle.hidden = true;
    }
    if (els.bookingStepTitle) {
      els.bookingStepTitle.textContent = heading;
    }
    updateBookingModalTitle();
    document.title = pageTitle;
  }

  function resolveLocalizedFrontendText(value, lang = currentFrontendLang()) {
    if (typeof value === "string") return normalizeText(value);
    if (!value || typeof value !== "object" || Array.isArray(value)) return "";

    const normalizedLang = normalizeFrontendTourLang(lang);
    const candidates = [normalizedLang, "en", ...Object.keys(value)];
    for (const candidate of candidates) {
      const text = normalizeText(value[candidate]);
      if (text) return text;
    }
    return "";
  }

  function resolveLocalizedFrontendStringArray(value, lang = currentFrontendLang()) {
    if (Array.isArray(value)) {
      return value.map((entry) => normalizeText(entry)).filter(Boolean);
    }
    if (!value || typeof value !== "object") return [];

    const normalizedLang = normalizeFrontendTourLang(lang);
    const candidates = [normalizedLang, "en", ...Object.keys(value)];
    for (const candidate of candidates) {
      const items = Array.isArray(value[candidate]) ? value[candidate].map((entry) => normalizeText(entry)).filter(Boolean) : [];
      if (items.length) return items;
    }
    return [];
  }

  function absolutizeBackendUrl(urlValue) {
    const value = String(urlValue || "").trim();
    if (!value) return value;
    if (value.startsWith("http://") || value.startsWith("https://")) return value;
    if (value.startsWith("assets/") || value.startsWith("./assets/")) {
      return `/${value.replace(/^\.\//, "")}`;
    }
    if (value.startsWith("/assets/")) return value;
    if (value.startsWith("public/v1/")) return `/${value}`;
    if (value.startsWith("/public/v1/")) return value;
    if (!backendBaseUrl) return value;
    if (value.startsWith("/")) return `${backendBaseUrl}${value}`;
    return `${backendBaseUrl}/${value}`;
  }

  function selectedTravelTourCardPictures(item) {
    const selectedImageId = normalizeText(item?.travel_plan?.tour_card_primary_image_id);
    const entries = [];
    for (const day of Array.isArray(item?.travel_plan?.days) ? item.travel_plan.days : []) {
      for (const service of Array.isArray(day?.services) ? day.services : []) {
        const candidates = [
          service?.image,
          ...(Array.isArray(service?.images)
            ? [...service.images].sort((left, right) => Number(left?.sort_order || 0) - Number(right?.sort_order || 0))
            : [])
        ];
        for (const image of candidates) {
          if (!image || typeof image !== "object" || Array.isArray(image)) continue;
          if (image.include_in_travel_tour_card !== true || image.is_customer_visible === false) continue;
          const src = absolutizeBackendUrl(image.storage_path || image.url || image.src || image.path);
          if (src) entries.push({ id: normalizeText(image.id), src });
        }
      }
    }
    const selectedEntryIndex = selectedImageId
      ? entries.findIndex((entry) => entry.id === selectedImageId)
      : -1;
    if (selectedEntryIndex > 0) {
      const [selectedEntry] = entries.splice(selectedEntryIndex, 1);
      entries.unshift(selectedEntry);
    }
    return entries.map((entry) => entry.src);
  }

  function resolveTourPictures(item) {
    const selectedPictures = selectedTravelTourCardPictures(item);
    const payloadPictures = Array.isArray(item?.pictures)
      ? item.pictures.map((picture) => absolutizeBackendUrl(picture)).filter(Boolean)
      : [];
    return Array.from(new Set([...selectedPictures, ...payloadPictures]));
  }

  function primaryTourPicture(item) {
    const pictures = resolveTourPictures(item);
    return normalizeText(pictures[0]) || DEFAULT_TOUR_IMAGE;
  }

  function normalizeToursForFrontend(items) {
    const lang = currentFrontendLang();
    return (Array.isArray(items) ? items : []).map((item) => {
      const pictures = resolveTourPictures(item);
      const normalizedTitle = resolveLocalizedFrontendText(item?.title, lang);
      const normalizedShortDescription = resolveLocalizedFrontendText(item?.short_description, lang);
      return {
        ...item,
        title: normalizedTitle,
        short_description: normalizedShortDescription,
        pictures
      };
    });
  }

  function normalizeToursPayloadForFrontend(payload) {
    const source = Array.isArray(payload) ? { items: payload } : (payload || {});
    return {
      items: normalizeToursForFrontend(Array.isArray(source.items) ? source.items : []),
      available_destinations: normalizeFilterOptionList(source.available_destinations),
      available_destination_scope_catalog: source.available_destination_scope_catalog || null,
      available_styles: normalizeFilterOptionList(source.available_styles)
    };
  }

  async function loadTrips() {
    const lang = normalizeFrontendTourLang(currentFrontendLang());
    const response = await fetch(publicToursDataUrl(lang), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Static tours request failed with status ${response.status}.`);
    }
    const payload = await response.json();
    return normalizeToursPayloadForFrontend(payload);
  }

  function expandedTourIdSet() {
    if (state.expandedTourIds instanceof Set) return state.expandedTourIds;
    const values = Array.isArray(state.expandedTourIds) ? state.expandedTourIds : [];
    state.expandedTourIds = new Set(values.map((value) => normalizeText(value)).filter(Boolean));
    return state.expandedTourIds;
  }

  function findTripById(tripId) {
    const normalizedTripId = normalizeText(tripId);
    if (!normalizedTripId) return null;
    return state.filteredTrips.find((trip) => normalizeText(trip?.id) === normalizedTripId)
      || state.trips.find((trip) => normalizeText(trip?.id) === normalizedTripId)
      || null;
  }

  function travelPlanDays(trip) {
    return Array.isArray(trip?.travel_plan?.days) ? trip.travel_plan.days : [];
  }

  function hasTravelPlanDays(trip) {
    return travelPlanDays(trip).length > 0;
  }

  function isTourExpanded(trip) {
    const tripId = normalizeText(trip?.id);
    return Boolean(tripId && hasTravelPlanDays(trip) && expandedTourIdSet().has(tripId));
  }

  function setTourExpanded(tripId, expanded) {
    const normalizedTripId = normalizeText(tripId);
    if (!normalizedTripId) return;
    const expandedIds = expandedTourIdSet();
    if (expanded) expandedIds.add(normalizedTripId);
    else expandedIds.delete(normalizedTripId);
  }

  function prefersReducedMotion() {
    return typeof window !== "undefined"
      && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function formatTourDurationSuffix(trip) {
    const dayCount = travelPlanDays(trip).length;
    if (dayCount <= 0) return "";
    const normalizedLang = normalizeFrontendTourLang(currentFrontendLang());
    if (normalizedLang === "vi") {
      if (dayCount === 1) return "1N";
      return `${dayCount}N${Math.max(0, dayCount - 1)}Đ`;
    }
    if (dayCount === 1) return "1D";
    return `${dayCount}D${Math.max(0, dayCount - 1)}N`;
  }

  function tourDetailsPanelId(tripId) {
    const normalizedTripId = normalizeText(tripId).replace(/[^a-zA-Z0-9_-]+/g, "-");
    return `tour-details-${normalizedTripId || "unknown"}`;
  }

  function getTourGridColumnCount() {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return 3;
    if (window.matchMedia("(max-width: 760px)").matches) return 1;
    if (window.matchMedia("(max-width: 1024px)").matches) return 2;
    return 3;
  }

  function bindTourGridResizeHandler() {
    if (tourGridResizeBound || typeof window === "undefined") return;
    tourGridResizeBound = true;
    window.addEventListener("resize", () => {
      const nextColumnCount = getTourGridColumnCount();
      if (nextColumnCount === renderedTourGridColumnCount) {
        fitTourCardDescriptions();
        syncExpandedTourDetailsHeights();
        window.requestAnimationFrame(() => {
          fitTourCardDescriptions();
          syncExpandedTourDetailsHeights();
        });
        return;
      }
      renderedTourGridColumnCount = nextColumnCount;
      openingTourColumnIndexes.clear();
      renderVisibleTrips();
    });
  }

  function renderTourTitle(trip, tripTitle) {
    const durationSuffix = formatTourDurationSuffix(trip);
    const duration = durationSuffix
      ? ` <span class="tour-title__duration">${escapeHTML(durationSuffix)}</span>`
      : "";
    return `
      <h3 class="tour-title tour-title--topline">
        <span class="tour-title__text">${escapeHTML(tripTitle)}</span>${duration}
      </h3>
    `;
  }

  function tourShowMoreLabel(expanded) {
    return expanded
      ? frontendT("tour.card.show_less", "Show less")
      : frontendT("tour.card.show_more", "Show more");
  }

  function renderTourShowMoreLabel(label) {
    return `<span class="tour-card__show-more-label" data-tour-card-show-more-label>${escapeHTML(label)}</span>`;
  }

  function tourShowMoreButton(tripId) {
    if (!els.tourGrid) return null;
    const normalizedTripId = normalizeText(tripId);
    return Array.from(els.tourGrid.querySelectorAll("[data-tour-card-show-more][data-trip-id]"))
      .find((candidate) => normalizeText(candidate.getAttribute("data-trip-id")) === normalizedTripId) || null;
  }

  function setTourShowMoreButtonLabel(button, label) {
    if (!(button instanceof HTMLButtonElement)) return null;
    const labelElement = button.querySelector("[data-tour-card-show-more-label]");
    if (labelElement instanceof HTMLElement) {
      labelElement.textContent = label;
      return labelElement;
    }
    button.innerHTML = renderTourShowMoreLabel(label);
    const renderedLabel = button.querySelector("[data-tour-card-show-more-label]");
    return renderedLabel instanceof HTMLElement ? renderedLabel : null;
  }

  async function animateTourShowMoreButtonLabel(button, nextLabel, { direction = "open" } = {}) {
    if (!(button instanceof HTMLButtonElement)) return;
    const labelElement = button.querySelector("[data-tour-card-show-more-label]");
    if (!(labelElement instanceof HTMLElement)) {
      setTourShowMoreButtonLabel(button, nextLabel);
      return;
    }
    if (normalizeText(labelElement.textContent) === normalizeText(nextLabel)) return;
    if (prefersReducedMotion() || typeof labelElement.animate !== "function") {
      labelElement.textContent = nextLabel;
      return;
    }

    const outOffset = direction === "close" ? "0.22rem" : "-0.22rem";
    const inOffset = direction === "close" ? "-0.22rem" : "0.22rem";
    const halfDuration = Math.max(80, Math.round(TOUR_SHOW_MORE_LABEL_TRANSITION_MS / 2));
    const outgoing = labelElement.animate([
      { opacity: 1, transform: "translateY(0)" },
      { opacity: 0, transform: `translateY(${outOffset})` }
    ], {
      duration: halfDuration,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      fill: "forwards"
    });
    await outgoing.finished.catch(() => {});
    outgoing.cancel();

    labelElement.textContent = nextLabel;
    const incoming = labelElement.animate([
      { opacity: 0, transform: `translateY(${inOffset})` },
      { opacity: 1, transform: "translateY(0)" }
    ], {
      duration: halfDuration,
      easing: "cubic-bezier(0.2, 0, 0.2, 1)",
      fill: "forwards"
    });
    await incoming.finished.catch(() => {});
    incoming.cancel();
  }

  function renderTourCard(trip, { index = 0, expanded = false } = {}) {
    const tripId = normalizeText(trip?.id);
    const tripTitle = resolveLocalizedFrontendText(trip?.title, state.lang);
    const tripShortDescription = resolveLocalizedFrontendText(trip?.short_description, state.lang);
    const tags = (Array.isArray(trip?.styles) ? trip.styles : [])
      .map((style) => `<span class="tag">${escapeHTML(style)}</span>`)
      .join("");
    const countries = tourDestinations(trip);
    const countriesLabel = countries.join(", ");
    const ctaLabel = frontendT("tour.card.plan_trip", "Plan this trip");
    const showMoreLabel = tourShowMoreLabel(expanded);
    const detailsUnavailableLabel = frontendT(
      "tour.plan.details_unavailable",
      "No detailed travel plan is available yet."
    );
    const galleryLabel = frontendT("tour.card.gallery_next", "Show next picture for {title}", {
      title: tripTitle
    });
    const loading = index === 0 ? "eager" : "lazy";
    const fetchpriority = "auto";
    const gallery = Array.isArray(trip?.pictures) && trip.pictures.length ? trip.pictures : [DEFAULT_TOUR_IMAGE];
    const primaryPicture = primaryTourPicture(trip);
    const galleryCount = gallery.length;
    const mediaTag = galleryCount > 1 ? "button" : "div";
    const mediaClass = galleryCount > 1 ? "tour-card__media tour-card__media-button" : "tour-card__media";
    const mediaAttrs = galleryCount > 1
      ? ` type="button" data-tour-image-cycle="1" data-tour-gallery-index="0" data-trip-id="${escapeAttr(tripId)}" aria-label="${escapeAttr(galleryLabel)}"`
      : "";
    const galleryCounter = galleryCount > 1
      ? `<span class="tour-card__media-counter" data-tour-image-counter>${escapeHTML(`1 / ${galleryCount}`)}</span>`
      : "";
    const canShowDetails = hasTravelPlanDays(trip);
    const detailsPanelId = tourDetailsPanelId(tripId);
    const showMoreStateAttrs = canShowDetails
      ? `aria-expanded="${expanded ? "true" : "false"}" aria-controls="${escapeAttr(detailsPanelId)}"`
      : `disabled title="${escapeAttr(detailsUnavailableLabel)}"`;

    return `
      <article class="tour-card${expanded ? " tour-card--expanded" : ""}" data-tour-card-id="${escapeAttr(tripId)}">
        <${mediaTag} class="${mediaClass}"${mediaAttrs}>
          <div class="tour-card__media-zoom">
            <div class="tour-card__media-stage">
              <img
                class="tour-card__media-layer is-active"
                data-tour-media-layer="primary"
                src="${escapeAttr(primaryPicture)}"
                alt="${escapeAttr(frontendT("tour.card.image_alt", "{title} in {destinations}", {
                  title: tripTitle,
                  destinations: countriesLabel
                }))}"
                loading="${loading}"
                fetchpriority="${fetchpriority}"
                width="1200"
                height="800"
              />
              <img
                class="tour-card__media-layer"
                data-tour-media-layer="secondary"
                src="${escapeAttr(primaryPicture)}"
                alt=""
                aria-hidden="true"
                loading="lazy"
                width="1200"
                height="800"
              />
            </div>
          </div>
          ${galleryCounter}
        </${mediaTag}>
        <div class="tour-body">
          ${renderTourTitle(trip, tripTitle)}
          <div class="tour-desc-wrap">
            <p class="tour-desc" data-tour-desc>${escapeHTML(tripShortDescription)}</p>
          </div>
          <div class="tags">${tags}</div>
          <button class="btn tour-card__show-more" type="button" data-tour-card-show-more data-trip-id="${escapeAttr(tripId)}" ${showMoreStateAttrs}>${renderTourShowMoreLabel(showMoreLabel)}</button>
          <button class="btn btn-primary tour-card__plan-trip" type="button" data-open-modal data-trip-id="${escapeAttr(tripId)}">${escapeHTML(ctaLabel)}</button>
        </div>
      </article>
    `;
  }

  function tourDescriptionAvailableHeight(description) {
    const wrap = description?.closest?.(".tour-desc-wrap");
    const wrapHeight = wrap instanceof HTMLElement ? wrap.getBoundingClientRect().height : 0;
    if (wrapHeight > 0) return Math.floor(wrapHeight);

    const styles = window.getComputedStyle?.(description);
    const fontSize = Number.parseFloat(styles?.fontSize || "") || 14;
    const lineHeight = Number.parseFloat(styles?.lineHeight || "") || (fontSize * 1.55);
    const lines = Number.parseInt(styles?.getPropertyValue("--tour-card-desc-lines") || "4", 10) || 4;
    return Math.floor(lineHeight * lines);
  }

  function fitTourCardDescription(description) {
    if (!(description instanceof HTMLElement) || typeof window === "undefined" || !window.getComputedStyle) return;

    description.style.fontSize = "";
    const maxFontSize = Number.parseFloat(window.getComputedStyle(description).fontSize || "") || 14;
    const minFontSize = Math.min(maxFontSize, TOUR_CARD_DESC_MIN_FONT_SIZE_PX);
    const availableHeight = tourDescriptionAvailableHeight(description);
    if (!(availableHeight > 0)) return;

    const previousDisplay = description.style.display;
    const previousLineClamp = description.style.webkitLineClamp;
    const previousBoxOrient = description.style.webkitBoxOrient;
    const previousOverflow = description.style.overflow;
    const previousMinHeight = description.style.minHeight;

    description.style.display = "block";
    description.style.webkitLineClamp = "unset";
    description.style.webkitBoxOrient = "initial";
    description.style.overflow = "visible";
    description.style.minHeight = "0";

    const measuredHeight = (fontSize) => {
      description.style.fontSize = `${fontSize}px`;
      return Math.ceil(description.scrollHeight);
    };

    if (measuredHeight(maxFontSize) <= availableHeight + TOUR_CARD_DESC_FIT_TOLERANCE_PX) {
      description.style.fontSize = "";
    } else {
      let low = minFontSize;
      let high = maxFontSize;
      let best = minFontSize;
      for (let index = 0; index < TOUR_CARD_DESC_FIT_ITERATIONS; index += 1) {
        const mid = (low + high) / 2;
        if (measuredHeight(mid) <= availableHeight + TOUR_CARD_DESC_FIT_TOLERANCE_PX) {
          best = mid;
          low = mid;
        } else {
          high = mid;
        }
      }
      description.style.fontSize = `${best.toFixed(2)}px`;
    }

    description.style.display = previousDisplay;
    description.style.webkitLineClamp = previousLineClamp;
    description.style.webkitBoxOrient = previousBoxOrient;
    description.style.overflow = previousOverflow;
    description.style.minHeight = previousMinHeight;
  }

  function fitTourCardDescriptions(root = els.tourGrid) {
    if (!(root instanceof HTMLElement)) return;
    root.querySelectorAll("[data-tour-desc]").forEach((description) => {
      fitTourCardDescription(description);
    });
  }

  function renderTourGridSpacer(count) {
    return Array.from({ length: Math.max(0, Number(count) || 0) })
      .map(() => `<div class="tour-grid__spacer" aria-hidden="true"></div>`)
      .join("");
  }

  function resolveTravelPlanField(source, fieldName) {
    if (!source || typeof source !== "object") return "";
    return resolveTravelPlanLocalizedValue(source[fieldName], source[`${fieldName}_i18n`], state.lang);
  }

  function isLocalizedFrontendTextMap(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function resolveExplicitLocalizedFrontendText(value, lang) {
    if (!isLocalizedFrontendTextMap(value)) return "";
    return normalizeText(value[normalizeFrontendTourLang(lang)]);
  }

  function resolveTravelPlanSourceText(value, lang) {
    if (typeof value === "string") return normalizeText(value);
    return resolveExplicitLocalizedFrontendText(value, lang);
  }

  function resolveTravelPlanLocalizedValue(sourceValue, i18nValue, lang = state.lang) {
    const normalizedLang = normalizeFrontendTourLang(lang);
    const sourceEnglishText = resolveTravelPlanSourceText(sourceValue, "en");
    const i18nEnglishText = resolveExplicitLocalizedFrontendText(i18nValue, "en");

    if (normalizedLang === "en") {
      return sourceEnglishText || i18nEnglishText;
    }

    return resolveExplicitLocalizedFrontendText(i18nValue, normalizedLang)
      || resolveTravelPlanSourceText(sourceValue, normalizedLang)
      || sourceEnglishText
      || i18nEnglishText;
  }

  function compactText(value) {
    return normalizeText(value).replace(/\s+/g, " ");
  }

  function truncateCompactText(value, maxLength = 118) {
    const text = compactText(value);
    const limit = Math.max(20, Number(maxLength) || 118);
    if (text.length <= limit) {
      return { text, fullText: text, isTruncated: false };
    }
    return {
      text: `${text.slice(0, limit - 3).trimEnd()}...`,
      fullText: text,
      isTruncated: true
    };
  }

  function formatServiceKindLabel(value) {
    const normalized = compactText(value).replace(/[-_]+/g, " ");
    if (!normalized) return "";
    return normalized.replace(/\b([a-z])/g, (match) => match.toUpperCase());
  }

  function resolveTravelPlanImageField(image, fieldName) {
    if (!image || typeof image !== "object" || Array.isArray(image)) return "";
    return resolveTravelPlanLocalizedValue(image[fieldName], image[`${fieldName}_i18n`], state.lang);
  }

  function primaryTourPlanServiceImage(service) {
    const image = service?.image;
    if (typeof image === "string") return { storage_path: image };
    if (image && typeof image === "object" && !Array.isArray(image)) return image;
    if (!Array.isArray(service?.images)) return null;
    return service.images.find((item) => item?.is_primary) || service.images[0] || null;
  }

  function tourPlanServiceImageSrc(service) {
    const image = primaryTourPlanServiceImage(service);
    if (typeof image === "string") return absolutizeBackendUrl(image);
    if (!image || typeof image !== "object" || Array.isArray(image)) return "";
    return absolutizeBackendUrl(image.storage_path || image.url || image.src || image.path);
  }

  function tourPlanServiceTitle(service, { genericFallback = true } = {}) {
    const image = primaryTourPlanServiceImage(service);
    const title = resolveTravelPlanField(service, "title")
      || resolveTravelPlanField(service, "image_subtitle")
      || resolveTravelPlanImageField(image, "caption")
      || resolveTravelPlanField(service, "location")
      || formatServiceKindLabel(service?.kind);
    return title || (genericFallback ? frontendT("tour.plan.service_fallback", "Service") : "");
  }

  function tourPlanServiceDetails(service, title = tourPlanServiceTitle(service)) {
    const image = primaryTourPlanServiceImage(service);
    const candidates = [
      resolveTravelPlanField(service, "details"),
      resolveTravelPlanField(service, "image_subtitle"),
      resolveTravelPlanImageField(image, "caption"),
      resolveTravelPlanField(service, "location")
    ];
    const normalizedTitle = compactText(title).toLowerCase();
    return candidates
      .map((item) => compactText(item))
      .find((item) => item && item.toLowerCase() !== normalizedTitle) || "";
  }

  function tourPlanServiceImageAlt(service) {
    const image = primaryTourPlanServiceImage(service);
    return resolveTravelPlanImageField(image, "alt_text")
      || tourPlanServiceTitle(service)
      || frontendT("tour.plan.service_image_alt", "Travel plan service image");
  }

  function formatTourPlanServiceLine(service) {
    const title = resolveTravelPlanField(service, "title")
      || resolveTravelPlanField(service, "image_subtitle")
      || formatServiceKindLabel(service?.kind);
    const location = resolveTravelPlanField(service, "location");
    const details = resolveTravelPlanField(service, "details");
    const parts = [title, location].map((item) => compactText(item)).filter(Boolean);
    let line = parts.join(" - ");
    const detailsText = compactText(details);
    const titleText = compactText(title).toLowerCase();

    if (detailsText && detailsText.toLowerCase() !== titleText) {
      const withDetails = [line, detailsText].filter(Boolean).join(" - ");
      if (!line || withDetails.length <= 118) {
        line = withDetails;
      }
    }

    return truncateCompactText(line || detailsText);
  }

  function renderTourPlanServiceCard(service, className = "", { featured = false, swappable = false } = {}) {
    const src = tourPlanServiceImageSrc(service);
    if (!src) return "";
    const title = tourPlanServiceTitle(service);
    const details = tourPlanServiceDetails(service, title);
    const image = primaryTourPlanServiceImage(service);
    const width = Math.max(1, Number.parseInt(image?.width_px, 10) || 720);
    const height = Math.max(1, Number.parseInt(image?.height_px, 10) || 720);
    const flippable = Boolean(compactText(details));
    const flipLabel = flippable
      ? frontendT("tour.plan.show_service_details", "Show details for {title}", { title })
      : "";
    const swapLabel = frontendT("tour.plan.feature_service", "Show {title} as the featured service", { title });
    const frontBody = `
      <div class="tour-plan-service-card__body">
        <h5>${escapeHTML(title)}</h5>
      </div>
    `;
    const imageMarkup = `
      <img
        src="${escapeAttr(src)}"
        alt="${escapeAttr(tourPlanServiceImageAlt(service))}"
        loading="lazy"
        width="${escapeAttr(String(width))}"
        height="${escapeAttr(String(height))}"
      />
    `;

    if (flippable) {
      const backHint = frontendT("tour.plan.service_details_back_hint", "Tap again to see the image");
      const interactionAttrs = featured
        ? `data-tour-plan-service-flip role="button" tabindex="0" aria-pressed="false" aria-label="${escapeAttr(flipLabel)}"`
        : (swappable
            ? `data-tour-plan-service-swap role="button" tabindex="0" aria-label="${escapeAttr(swapLabel)}"`
            : "");
      return `
        <article
          class="tour-plan-service-card${className ? ` ${escapeAttr(className)}` : ""}${featured ? " tour-plan-service-card--flippable" : ""}${swappable ? " tour-plan-service-card--interactive" : ""}"
          data-tour-plan-service-card
          data-tour-plan-service-has-details="1"
          ${interactionAttrs}
        >
          <div class="tour-plan-service-card__inner">
            <div class="tour-plan-service-card__face tour-plan-service-card__face--front">
              ${imageMarkup}
              ${frontBody}
            </div>
            <div class="tour-plan-service-card__face tour-plan-service-card__face--back">
              <div class="tour-plan-service-card__back-copy">
                <h5>${escapeHTML(title)}</h5>
                <p>${escapeHTML(details)}</p>
                <span class="tour-plan-service-card__back-hint">${escapeHTML(backHint)}</span>
              </div>
            </div>
          </div>
        </article>
      `;
    }

    return `
      <article
        class="tour-plan-service-card${className ? ` ${escapeAttr(className)}` : ""}${swappable ? " tour-plan-service-card--interactive" : ""}"
        data-tour-plan-service-card
        ${swappable ? `data-tour-plan-service-swap role="button" tabindex="0" aria-label="${escapeAttr(swapLabel)}"` : ""}
      >
        ${imageMarkup}
        ${frontBody}
      </article>
    `;
  }

  function tourPlanServiceImageEntries(services) {
    return (Array.isArray(services) ? services : [])
      .map((service, index) => ({
        service,
        index,
        src: tourPlanServiceImageSrc(service)
      }))
      .filter((entry) => entry.src);
  }

  function renderTourPlanServiceMedia(services) {
    const imageEntries = tourPlanServiceImageEntries(services);
    if (!imageEntries.length) {
      return {
        markup: "",
        imageIndexes: new Set()
      };
    }

    const [featured, ...sideEntries] = imageEntries;
    const sideMarkup = sideEntries.length
      ? `<div class="tour-plan-service-media__side">
          ${sideEntries.map(({ service }) => renderTourPlanServiceCard(service, "tour-plan-service-card--small", { swappable: true })).join("")}
        </div>`
      : "";

    return {
      markup: `
        <div class="tour-plan-service-media${sideEntries.length ? "" : " tour-plan-service-media--single"}" data-tour-plan-service-media>
          ${renderTourPlanServiceCard(featured.service, "tour-plan-service-card--featured", { featured: true })}
          ${sideMarkup}
        </div>
      `,
      imageIndexes: new Set(imageEntries.map((entry) => entry.index))
    };
  }

  function renderTourPlanTextServices(services, excludedIndexes = new Set()) {
    const rows = (Array.isArray(services) ? services : [])
      .map((service, index) => {
        if (excludedIndexes.has(index)) return "";
        const title = tourPlanServiceTitle(service, { genericFallback: false });
        const details = tourPlanServiceDetails(service, title);
        const hasTitle = compactText(title);
        const hasDetails = compactText(details);
        if (!hasTitle && !hasDetails) return "";
        const titleMarkup = hasTitle ? `<h5>${escapeHTML(title)}</h5>` : "";
        const detailMarkup = hasDetails ? `<p>${escapeHTML(details)}</p>` : "";
        const titleOnlyClass = hasTitle && !hasDetails ? " tour-plan-text-service--title-only" : "";
        return `
          <article class="tour-plan-text-service${titleOnlyClass}">
            ${titleMarkup}
            ${detailMarkup}
          </article>
        `;
      })
      .filter(Boolean)
      .join("");

    return rows
      ? `<div class="tour-plan-text-services">${rows}</div>`
      : "";
  }

  function renderTourPlanDay(day, index, tripId) {
    const dayNumber = Math.max(1, Number.parseInt(day?.day_number, 10) || index + 1);
    const dayTitle = resolveTravelPlanField(day, "title");
    const dayLabel = frontendT("tour.plan.day_label", "Day {day}", {
      day: String(dayNumber)
    });
    const heading = dayTitle ? `${dayLabel} - ${dayTitle}` : dayLabel;
    const notes = resolveTravelPlanField(day, "notes");
    const services = Array.isArray(day?.services) ? day.services : [];
    const serviceMedia = renderTourPlanServiceMedia(services);
    const textServiceMarkup = renderTourPlanTextServices(services, serviceMedia.imageIndexes);
    const shouldRenderLegacyServices = !serviceMedia.markup && !textServiceMarkup;
    const legacyServiceLines = shouldRenderLegacyServices
      ? services
        .map((service) => formatTourPlanServiceLine(service))
        .filter((line) => line.text)
      : [];
    const legacyServiceList = shouldRenderLegacyServices
      ? (legacyServiceLines.length
          ? `<ul class="tour-plan-services">
              ${legacyServiceLines.map((line) => `
                <li>
                  <span class="tour-plan-service__line" title="${escapeAttr(line.isTruncated ? line.fullText : "")}">${escapeHTML(line.text)}</span>
                </li>
              `).join("")}
            </ul>`
          : `<p class="tour-plan-day__empty">${escapeHTML(frontendT("tour.plan.no_services", "No services listed yet."))}</p>`)
      : "";
    const notesMarkup = notes
      ? `<p class="tour-plan-day__notes">${escapeHTML(notes)}</p>`
      : "";
    const serviceMarkup = [
      serviceMedia.markup,
      textServiceMarkup,
      legacyServiceList
    ].filter(Boolean).join("") || (!services.length && notes
      ? ""
      : `<p class="tour-plan-day__empty">${escapeHTML(frontendT("tour.plan.no_services", "No services listed yet."))}</p>`);

    return `
      <article class="tour-plan-day">
        <h4 class="tour-plan-day__heading">${escapeHTML(heading)}</h4>
        <div class="tour-plan-day__body">
          ${notesMarkup}
          ${serviceMarkup}
        </div>
      </article>
    `;
  }

  function renderTourTravelPlanDetails(trip) {
    const days = travelPlanDays(trip);
    if (!days.length) {
      return `
        <div class="tour-plan tour-plan--empty">
          <p>${escapeHTML(frontendT("tour.plan.no_days", "No travel plan days listed yet."))}</p>
        </div>
      `;
    }

    return `
      <div class="tour-plan">
        <div class="tour-plan__days">
          ${days.map((day, index) => renderTourPlanDay(day, index, trip?.id)).join("")}
        </div>
      </div>
    `;
  }

  function renderExpandedTourRow(trip, index, columnIndex = 0) {
    const tripId = normalizeText(trip?.id);
    const panelId = tourDetailsPanelId(tripId);
    const tripTitle = resolveLocalizedFrontendText(trip?.title, state.lang);
    const panelLabel = frontendT("tour.plan.panel_label", "Travel plan for {title}", {
      title: tripTitle
    });
    const isOpeningFromPreviousColumn = openingTourColumnIndexes.has(tripId);
    const initialColumnIndex = isOpeningFromPreviousColumn
      ? openingTourColumnIndexes.get(tripId)
      : 0;
    const columnCount = Math.min(Math.max(1, renderedTourGridColumnCount), 3);
    const column = Math.min(Math.max(1, Number(initialColumnIndex ?? columnIndex) + 1), Math.max(1, columnCount));
    const sidePanelClass = columnCount > 1
      ? ` tour-details-row--side-panel tour-details-row--columns-${columnCount}${isOpeningFromPreviousColumn ? "" : " tour-details-row--attached"}`
      : "";
    return `
      <article
        class="tour-details-row${sidePanelClass}"
        data-expanded-tour-id="${escapeAttr(tripId)}"
        style="--tour-grid-columns: ${columnCount}; --tour-details-column: ${column};"
      >
        <div class="tour-details-row__shell">
          ${renderTourCard(trip, { index, expanded: true })}
          <aside class="tour-details-row__panel" id="${escapeAttr(panelId)}" aria-label="${escapeAttr(panelLabel)}">
            ${renderTourTravelPlanDetails(trip)}
          </aside>
        </div>
      </article>
    `;
  }

  function renderTrips(trips) {
    if (!els.tourGrid) return;
    bindTourGridResizeHandler();

    if (!trips.length) {
      els.tourGrid.innerHTML = "";
      els.noResultsMessage.hidden = false;
      return;
    }

    els.noResultsMessage.hidden = true;
    renderedTourGridColumnCount = getTourGridColumnCount();

    const items = trips.map((trip, index) => ({ trip, index }));
    const parts = [];
    for (let index = 0; index < items.length; index += renderedTourGridColumnCount) {
      const row = items.slice(index, index + renderedTourGridColumnCount);
      const expandedItems = row.filter(({ trip }) => isTourExpanded(trip));
      if (!expandedItems.length) {
        parts.push(...row.map(({ trip, index: itemIndex }) => renderTourCard(trip, { index: itemIndex })));
        continue;
      }

      parts.push(...expandedItems.map(({ trip, index: itemIndex }) => {
        const columnIndex = row.findIndex((item) => normalizeText(item.trip?.id) === normalizeText(trip?.id));
        return renderExpandedTourRow(trip, itemIndex, columnIndex);
      }));
      const normalItems = row.filter(({ trip }) => !isTourExpanded(trip));
      parts.push(...normalItems.map(({ trip, index: itemIndex }) => renderTourCard(trip, { index: itemIndex })));
      if (normalItems.length > 0) {
        parts.push(renderTourGridSpacer(renderedTourGridColumnCount - normalItems.length));
      }
    }

    els.tourGrid.innerHTML = parts.join("");
    bindTourCardOpenHandlers();
    fitTourCardDescriptions();
    syncExpandedTourDetailsHeights();
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        fitTourCardDescriptions();
        syncExpandedTourDetailsHeights();
      });
    }
  }

  function bindTourCardOpenHandlers() {
    if (!els.tourGrid) return;

    const imageCycleButtons = els.tourGrid.querySelectorAll("[data-tour-image-cycle]");
    imageCycleButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement) || button.dataset.imageCycleBound === "1") return;
      button.addEventListener("click", () => {
        cycleTourCardImage(button);
      });
      button.dataset.imageCycleBound = "1";
    });

    const showMoreButtons = els.tourGrid.querySelectorAll("[data-tour-card-show-more][data-trip-id]");
    showMoreButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement) || button.dataset.tourDetailsBound === "1") return;
      button.addEventListener("click", () => {
        if (button.disabled || tourDetailsTransitioning) return;
        const tripId = normalizeText(button.getAttribute("data-trip-id"));
        const trip = findTripById(tripId);
        if (!trip || !hasTravelPlanDays(trip)) return;
        animateTourDetailsToggle(tripId, !expandedTourIdSet().has(tripId));
      });
      button.dataset.tourDetailsBound = "1";
    });

    const serviceMediaGroups = els.tourGrid.querySelectorAll("[data-tour-plan-service-media]");
    serviceMediaGroups.forEach((media) => {
      if (!(media instanceof HTMLElement) || media.dataset.tourPlanServiceMediaBound === "1") return;
      media.addEventListener("click", handleTourPlanServiceMediaClick);
      media.addEventListener("keydown", handleTourPlanServiceMediaKeydown);
      media.dataset.tourPlanServiceMediaBound = "1";
    });

    const buttons = els.tourGrid.querySelectorAll("[data-open-modal][data-trip-id]");
    buttons.forEach((button) => {
      if (button.dataset.bookingBound) return;

      button.addEventListener("click", () => {
        const tripId = button.getAttribute("data-trip-id");
        const selected = state.trips.find((trip) => trip.id === tripId);
        if (selected) {
          setBookingField("bookingDestination", tourDestinations(selected));
          setBookingField("bookingStyle", selected.styles || []);
          setSelectedTourContext(selected);
        } else {
          clearSelectedTourContext();
        }
        openBookingModal();
      });

      button.dataset.bookingBound = "1";
    });
  }

  function setTourPlanServiceCardFlipped(card, flipped) {
    if (!(card instanceof HTMLElement)) return;
    card.classList.toggle("is-flipped", flipped);
    if (card.hasAttribute("data-tour-plan-service-flip")) {
      card.setAttribute("aria-pressed", flipped ? "true" : "false");
    }
  }

  function toggleTourPlanServiceCard(card) {
    if (!(card instanceof HTMLElement)) return;
    setTourPlanServiceCardFlipped(card, !card.classList.contains("is-flipped"));
    syncExpandedTourDetailsHeights();
  }

  function focusTourShowMoreButton(tripId) {
    const button = tourShowMoreButton(tripId);
    if (button instanceof HTMLButtonElement) {
      try {
        button.focus({ preventScroll: true });
      } catch {
        button.focus();
      }
    }
  }

  function expandedTourRow(tripId) {
    if (!els.tourGrid) return null;
    const normalizedTripId = normalizeText(tripId);
    if (!normalizedTripId) return null;
    return Array.from(els.tourGrid.querySelectorAll("[data-expanded-tour-id]"))
      .find((row) => normalizeText(row.getAttribute("data-expanded-tour-id")) === normalizedTripId) || null;
  }

  function tourGridColumnIndexForTrip(tripId) {
    const normalizedTripId = normalizeText(tripId);
    if (!normalizedTripId) return 0;
    const visibleTrips = state.filteredTrips.slice(0, state.visibleToursCount);
    const visibleIndex = visibleTrips.findIndex((trip) => normalizeText(trip?.id) === normalizedTripId);
    if (visibleIndex < 0) return 0;
    return visibleIndex % Math.max(1, getTourGridColumnCount());
  }

  function tourCardElement(tripId) {
    if (!els.tourGrid) return null;
    const normalizedTripId = normalizeText(tripId);
    if (!normalizedTripId) return null;
    return Array.from(els.tourGrid.querySelectorAll("[data-tour-card-id]"))
      .find((card) => normalizeText(card.getAttribute("data-tour-card-id")) === normalizedTripId) || null;
  }

  function captureTourCardRects() {
    const rects = new Map();
    if (!els.tourGrid) return rects;
    Array.from(els.tourGrid.querySelectorAll("[data-tour-card-id]")).forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      const tripId = normalizeText(card.getAttribute("data-tour-card-id"));
      if (!tripId || rects.has(tripId)) return;
      rects.set(tripId, card.getBoundingClientRect());
    });
    return rects;
  }

  function cssImageUrl(value) {
    const url = normalizeText(value);
    if (!url) return "";
    return `url("${url.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\n\r\f]/g, "")}")`;
  }

  function captureTourCardMediaSnapshots() {
    const snapshots = new Map();
    if (!els.tourGrid) return snapshots;

    Array.from(els.tourGrid.querySelectorAll("[data-tour-card-id]")).forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      const tripId = normalizeText(card.getAttribute("data-tour-card-id"));
      if (!tripId || snapshots.has(tripId)) return;
      const visibleLayer = card.querySelector(".tour-card__media-layer.is-entering")
        || card.querySelector(".tour-card__media-layer.is-active");
      if (!(visibleLayer instanceof HTMLImageElement)) return;
      const imageSrc = normalizeText(visibleLayer.currentSrc || visibleLayer.src || visibleLayer.getAttribute("src"));
      if (!imageSrc) return;
      const computedStyle = window.getComputedStyle?.(visibleLayer);
      snapshots.set(tripId, {
        imageSrc,
        objectPosition: computedStyle?.objectPosition || "center"
      });
    });

    return snapshots;
  }

  function clearTourCardMediaSnapshot(stage, token) {
    if (!(stage instanceof HTMLElement) || stage.dataset.mediaSnapshotToken !== token) return;
    stage.style.backgroundImage = "";
    stage.style.backgroundPosition = "";
    stage.style.backgroundRepeat = "";
    stage.style.backgroundSize = "";
    delete stage.dataset.mediaSnapshotToken;
  }

  function scheduleTourCardMediaSnapshotClear(stage, activeImage) {
    if (!(stage instanceof HTMLElement)) return;
    const token = String(++tourCardMediaSnapshotToken);
    stage.dataset.mediaSnapshotToken = token;
    let imageReady = !(activeImage instanceof HTMLImageElement) || (activeImage.complete && activeImage.naturalWidth > 0);
    let holdElapsed = false;

    const maybeClear = () => {
      if (!imageReady || !holdElapsed) return;
      clearTourCardMediaSnapshot(stage, token);
    };
    const markReady = () => {
      imageReady = true;
      maybeClear();
    };

    if (activeImage instanceof HTMLImageElement && !imageReady) {
      activeImage.addEventListener("load", markReady, { once: true });
      activeImage.addEventListener("error", markReady, { once: true });
      if (typeof activeImage.decode === "function") {
        activeImage.decode().then(markReady).catch(() => {});
      }
    }

    window.setTimeout(() => {
      holdElapsed = true;
      maybeClear();
    }, TOUR_CARD_MEDIA_SNAPSHOT_HOLD_MS);
  }

  function applyTourCardMediaSnapshots(snapshots) {
    if (!(snapshots instanceof Map) || snapshots.size === 0 || !els.tourGrid) return;

    Array.from(els.tourGrid.querySelectorAll("[data-tour-card-id]")).forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      const tripId = normalizeText(card.getAttribute("data-tour-card-id"));
      const snapshot = snapshots.get(tripId);
      if (!snapshot?.imageSrc) return;

      const mediaStage = card.querySelector(".tour-card__media-stage");
      if (!(mediaStage instanceof HTMLElement)) return;
      mediaStage.style.backgroundImage = cssImageUrl(snapshot.imageSrc);
      mediaStage.style.backgroundPosition = snapshot.objectPosition || "center";
      mediaStage.style.backgroundRepeat = "no-repeat";
      mediaStage.style.backgroundSize = "cover";

      const activeImage = card.querySelector(".tour-card__media-layer.is-active");
      scheduleTourCardMediaSnapshotClear(mediaStage, activeImage);
    });
  }

  function waitForAnimationFrame() {
    return new Promise((resolve) => {
      window.requestAnimationFrame(resolve);
    });
  }

  function disableFocusableElements(element) {
    if (!(element instanceof HTMLElement)) return;
    const focusableSelector = [
      "a[href]",
      "button",
      "input",
      "select",
      "textarea",
      "[tabindex]"
    ].join(",");
    element.querySelectorAll(focusableSelector).forEach((item) => {
      if (!(item instanceof HTMLElement)) return;
      item.setAttribute("tabindex", "-1");
      item.setAttribute("aria-hidden", "true");
    });
  }

  function createOutgoingTourDetailsGhost(row) {
    if (!(row instanceof HTMLElement)) return null;
    const panel = row.querySelector(".tour-details-row__panel");
    if (!(panel instanceof HTMLElement)) return null;

    const rect = panel.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const ghost = panel.cloneNode(true);
    if (!(ghost instanceof HTMLElement)) return null;
    ghost.removeAttribute("id");
    ghost.querySelectorAll("[id]").forEach((item) => item.removeAttribute("id"));
    ghost.setAttribute("aria-hidden", "true");
    ghost.setAttribute("inert", "");
    disableFocusableElements(ghost);

    Object.assign(ghost.style, {
      position: "fixed",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: "0",
      boxSizing: "border-box",
      pointerEvents: "none",
      zIndex: "20",
      overflow: "hidden",
      willChange: "opacity, transform, clip-path"
    });
    document.body.append(ghost);

    return {
      element: ghost,
      sidePanel: row.classList.contains("tour-details-row--side-panel")
    };
  }

  function animateOutgoingTourDetailsGhost(ghostState) {
    const ghost = ghostState?.element;
    if (!(ghost instanceof HTMLElement)) return Promise.resolve();
    const sidePanel = Boolean(ghostState?.sidePanel);
    const keyframes = sidePanel
      ? [
          { opacity: 1, transform: "translateX(0)", clipPath: "inset(0 0 0 0)" },
          { opacity: 0, transform: "translateX(-0.5rem)", clipPath: "inset(0 100% 0 0)" }
        ]
      : [
          { opacity: 1, transform: "translateY(0)", clipPath: "inset(0 0 0 0)" },
          { opacity: 0, transform: "translateY(-0.4rem)", clipPath: "inset(0 0 100% 0)" }
        ];

    if (typeof ghost.animate !== "function") {
      ghost.remove();
      return Promise.resolve();
    }

    const animation = ghost.animate(keyframes, {
      duration: TOUR_DETAILS_CLOSE_TRANSITION_MS,
      easing: "cubic-bezier(0.2, 0.82, 0.2, 1)",
      fill: "forwards"
    });

    return new Promise((resolve) => {
      let finished = false;
      let timer = 0;
      const done = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        animation.removeEventListener("finish", done);
        animation.removeEventListener("cancel", done);
        ghost.remove();
        resolve();
      };
      animation.addEventListener("finish", done, { once: true });
      animation.addEventListener("cancel", done, { once: true });
      timer = window.setTimeout(done, TOUR_DETAILS_CLOSE_TRANSITION_MS + 140);
    });
  }

  function animateTourGridLayout(previousRects, { excludedTripIds = [] } = {}) {
    if (!(previousRects instanceof Map) || previousRects.size === 0 || !els.tourGrid) {
      return Promise.resolve();
    }

    const excludedIds = new Set((Array.isArray(excludedTripIds) ? excludedTripIds : [excludedTripIds])
      .map((value) => normalizeText(value))
      .filter(Boolean));
    const animations = [];
    Array.from(els.tourGrid.querySelectorAll("[data-tour-card-id]")).forEach((card) => {
      if (!(card instanceof HTMLElement) || typeof card.animate !== "function") return;
      const tripId = normalizeText(card.getAttribute("data-tour-card-id"));
      if (excludedIds.has(tripId)) return;
      const previousRect = previousRects.get(tripId);
      if (!previousRect) return;
      const nextRect = card.getBoundingClientRect();
      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

      card.style.willChange = "transform";
      const animation = card.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" }
        ],
        {
          duration: TOUR_GRID_LAYOUT_TRANSITION_MS,
          easing: "cubic-bezier(0.2, 0.82, 0.2, 1)",
          fill: "both"
        }
      );
      animations.push(new Promise((resolve) => {
        const cleanup = () => {
          card.style.willChange = "";
          resolve();
        };
        animation.addEventListener("finish", cleanup, { once: true });
        animation.addEventListener("cancel", cleanup, { once: true });
      }));
    });

    return animations.length ? Promise.all(animations).then(() => undefined) : Promise.resolve();
  }

  function expandedTourShell(row) {
    return row?.querySelector?.(".tour-details-row__shell") || null;
  }

  function animateExpandedTourCardToLeft(row) {
    if (!(row instanceof HTMLElement)) return Promise.resolve();
    const currentColumn = Number.parseInt(row.style.getPropertyValue("--tour-details-column"), 10) || 1;
    if (currentColumn <= 1) {
      row.classList.add("tour-details-row--attached");
      return Promise.resolve();
    }

    const card = row.classList.contains("tour-details-row--side-panel")
      ? expandedTourCard(row)
      : expandedTourShell(row);
    if (!(card instanceof HTMLElement)) {
      row.style.setProperty("--tour-details-column", "1");
      row.classList.add("tour-details-row--attached");
      return Promise.resolve();
    }

    const previousRect = card.getBoundingClientRect();
    row.style.setProperty("--tour-details-column", "1");
    row.classList.add("tour-details-row--attached");
    const nextRect = card.getBoundingClientRect();
    const deltaX = previousRect.left - nextRect.left;
    const deltaY = previousRect.top - nextRect.top;
    if ((Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) || typeof card.animate !== "function") {
      return Promise.resolve();
    }

    card.style.willChange = "transform";
    const animation = card.animate(
      [
        { transform: `translate(${deltaX}px, ${deltaY}px)` },
        { transform: "translate(0, 0)" }
      ],
      {
        duration: TOUR_GRID_LAYOUT_TRANSITION_MS,
        easing: "cubic-bezier(0.2, 0.82, 0.2, 1)",
        fill: "both"
      }
    );

    return new Promise((resolve) => {
      const cleanup = () => {
        card.style.willChange = "";
        resolve();
      };
      animation.addEventListener("finish", cleanup, { once: true });
      animation.addEventListener("cancel", cleanup, { once: true });
    });
  }

  function stickyHeaderBottomOffset() {
    const header = document.querySelector(".header");
    if (!(header instanceof HTMLElement)) return 0;
    const rect = header.getBoundingClientRect();
    return Math.max(0, Math.ceil(rect.bottom));
  }

  function scrollWindowToY(top, behavior = "smooth") {
    const documentElement = document.documentElement;
    const maxScrollY = Math.max(0, documentElement.scrollHeight - window.innerHeight);
    const targetY = Math.min(maxScrollY, Math.max(0, Math.round(Number(top) || 0)));
    if (Math.abs(window.scrollY - targetY) < 1) return Promise.resolve();

    return new Promise((resolve) => {
      const startedAt = performance.now();
      const scrollBehavior = prefersReducedMotion() ? "auto" : behavior;
      window.scrollTo({ top: targetY, behavior: scrollBehavior });

      if (scrollBehavior === "auto") {
        window.requestAnimationFrame(resolve);
        return;
      }

      const tick = () => {
        if (Math.abs(window.scrollY - targetY) < 1 || performance.now() - startedAt > TOUR_CARD_SCROLL_TIMEOUT_MS) {
          resolve();
          return;
        }
        window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    });
  }

  function scrollTourCardFullyVisible(tripId, { behavior = "smooth" } = {}) {
    const card = tourCardElement(tripId);
    if (!(card instanceof HTMLElement)) return Promise.resolve(false);

    const rect = card.getBoundingClientRect();
    const visibleTop = stickyHeaderBottomOffset() + TOUR_CARD_SCROLL_MARGIN_PX;
    const visibleBottom = Math.max(visibleTop, window.innerHeight - TOUR_CARD_SCROLL_MARGIN_PX);
    const availableHeight = visibleBottom - visibleTop;
    let targetY = window.scrollY;

    if (rect.height > availableHeight || rect.top < visibleTop) {
      targetY += rect.top - visibleTop;
    } else if (rect.bottom > visibleBottom) {
      targetY += rect.bottom - visibleBottom;
    } else {
      return Promise.resolve(false);
    }

    return scrollWindowToY(targetY, behavior).then(() => true);
  }

  function expandedTourCard(row) {
    return expandedTourShell(row)?.querySelector?.(".tour-card") || null;
  }

  function syncExpandedTourDetailsHeight(row) {
    if (!(row instanceof HTMLElement)) return 0;
    const card = expandedTourCard(row);
    if (!(card instanceof HTMLElement)) return 0;

    const cardHeight = Math.max(0, Math.ceil(card.getBoundingClientRect().height));
    if (cardHeight <= 0) return 0;

    row.style.setProperty("--tour-details-card-height", `${cardHeight}px`);
    if (
      row.classList.contains("tour-details-row--side-panel")
      && !row.classList.contains("tour-details-row--opening")
      && !row.classList.contains("tour-details-row--closing")
    ) {
      row.style.height = `${cardHeight}px`;
    }
    return cardHeight;
  }

  function syncExpandedTourDetailsHeights() {
    if (!els.tourGrid) return;
    Array.from(els.tourGrid.querySelectorAll(".tour-details-row")).forEach((row) => {
      syncExpandedTourDetailsHeight(row);
    });
  }

  function collapsedTourDetailsHeight(row) {
    const syncedHeight = syncExpandedTourDetailsHeight(row);
    if (syncedHeight > 0) return syncedHeight;
    const card = expandedTourCard(row);
    if (!(card instanceof HTMLElement)) return 0;
    return Math.max(0, Math.ceil(card.getBoundingClientRect().height));
  }

  function clearTourDetailsRowAnimation(row, { preserveHeight = false } = {}) {
    if (!(row instanceof HTMLElement)) return;
    row.classList.remove("tour-details-row--opening", "tour-details-row--closing");
    if (!preserveHeight) row.style.height = "";
    row.style.opacity = "";
    row.style.overflow = "";
  }

  function finishTourDetailsRowAnimation(row) {
    return new Promise((resolve) => {
      let finished = false;
      let timer = 0;
      const done = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        row?.removeEventListener?.("transitionend", onTransitionEnd);
        resolve();
      };
      const onTransitionEnd = (event) => {
        if (event.target !== row || event.propertyName !== "height") return;
        done();
      };

      row.addEventListener("transitionend", onTransitionEnd);
      timer = window.setTimeout(done, TOUR_DETAILS_TRANSITION_MS + 140);
    });
  }

  async function animateTourDetailsRowHeight(row, targetHeight, mode) {
    if (!(row instanceof HTMLElement)) return;
    const opening = mode === "open";
    row.classList.toggle("tour-details-row--opening", opening);
    row.classList.toggle("tour-details-row--closing", !opening);
    void row.offsetHeight;
    await waitForAnimationFrame();
    if (opening) {
      row.classList.remove("tour-details-row--opening");
    }
    row.style.height = `${Math.max(0, Math.ceil(targetHeight))}px`;
    await finishTourDetailsRowAnimation(row);
  }

  function updateOutgoingTourDetailsButton(row, expanded) {
    const button = row?.querySelector?.("[data-tour-card-show-more][data-trip-id]");
    if (!(button instanceof HTMLButtonElement)) return;
    button.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function animateTourDetailsToggle(tripId, willOpen) {
    const normalizedTripId = normalizeText(tripId);
    if (!normalizedTripId) return;

    if (prefersReducedMotion()) {
      setTourExpanded(normalizedTripId, willOpen);
      renderVisibleTrips();
      const visibilityPromise = willOpen
        ? scrollTourCardFullyVisible(normalizedTripId, { behavior: "auto" })
        : Promise.resolve(false);
      void visibilityPromise.then(() => {
        focusTourShowMoreButton(normalizedTripId);
      });
      return;
    }

    tourDetailsTransitioning = true;
    if (willOpen) {
      animateTourDetailsOpen(normalizedTripId);
    } else {
      animateTourDetailsClose(normalizedTripId);
    }
  }

  async function animateTourDetailsOpen(tripId) {
    const previousRects = captureTourCardRects();
    const previousMediaSnapshots = captureTourCardMediaSnapshots();
    const initialColumnIndex = tourGridColumnIndexForTrip(tripId);
    if (initialColumnIndex > 0) {
      openingTourColumnIndexes.set(tripId, initialColumnIndex);
    } else {
      openingTourColumnIndexes.delete(tripId);
    }
    setTourExpanded(tripId, true);
    renderVisibleTrips();
    applyTourCardMediaSnapshots(previousMediaSnapshots);
    const openedButton = tourShowMoreButton(tripId);
    setTourShowMoreButtonLabel(openedButton, tourShowMoreLabel(false));

    const row = expandedTourRow(tripId);
    if (!(row instanceof HTMLElement)) {
      await animateTourGridLayout(previousRects, { excludedTripIds: [tripId] });
      await animateTourShowMoreButtonLabel(openedButton, tourShowMoreLabel(true), { direction: "open" });
      openingTourColumnIndexes.delete(tripId);
      tourDetailsTransitioning = false;
      window.requestAnimationFrame(() => {
        focusTourShowMoreButton(tripId);
      });
      return;
    }

    const expandedHeight = Math.max(row.scrollHeight, row.getBoundingClientRect().height);
    const collapsedHeight = collapsedTourDetailsHeight(row);
    row.classList.add("tour-details-row--opening");
    row.style.height = `${collapsedHeight}px`;
    row.style.overflow = "hidden";
    row.style.opacity = "1";

    await Promise.all([
      animateTourGridLayout(previousRects, { excludedTripIds: [tripId] }),
      animateExpandedTourCardToLeft(row)
    ]);
    openingTourColumnIndexes.delete(tripId);
    await scrollTourCardFullyVisible(tripId);
    const opensSideways = row.classList.contains("tour-details-row--side-panel");
    await animateTourDetailsRowHeight(row, opensSideways ? collapsedHeight : expandedHeight, "open");
    clearTourDetailsRowAnimation(row, { preserveHeight: opensSideways });
    await animateTourShowMoreButtonLabel(openedButton, tourShowMoreLabel(true), { direction: "open" });
    tourDetailsTransitioning = false;
    focusTourShowMoreButton(tripId);
  }

  async function animateTourDetailsClose(tripId) {
    const row = expandedTourRow(tripId);
    if (!(row instanceof HTMLElement)) {
      setTourExpanded(tripId, false);
      renderVisibleTrips();
      tourDetailsTransitioning = false;
      window.requestAnimationFrame(() => {
        focusTourShowMoreButton(tripId);
      });
      return;
    }

    updateOutgoingTourDetailsButton(row, false);
    const previousRects = captureTourCardRects();
    const previousMediaSnapshots = captureTourCardMediaSnapshots();
    const outgoingDetailsGhost = createOutgoingTourDetailsGhost(row);
    setTourExpanded(tripId, false);
    renderVisibleTrips();
    applyTourCardMediaSnapshots(previousMediaSnapshots);
    const closedButton = tourShowMoreButton(tripId);
    setTourShowMoreButtonLabel(closedButton, tourShowMoreLabel(true));
    await Promise.all([
      animateOutgoingTourDetailsGhost(outgoingDetailsGhost),
      animateTourGridLayout(previousRects)
    ]);
    await animateTourShowMoreButtonLabel(closedButton, tourShowMoreLabel(false), { direction: "close" });
    tourDetailsTransitioning = false;
    window.requestAnimationFrame(() => {
      focusTourShowMoreButton(tripId);
    });
  }

  function tourPlanServiceMediaFromEvent(event) {
    const media = event?.currentTarget;
    return media instanceof HTMLElement && media.matches("[data-tour-plan-service-media]")
      ? media
      : null;
  }

  function tourPlanServiceSwapCardFromEvent(event, media) {
    const target = event?.target;
    if (!(target instanceof Element)) return null;
    const card = target.closest("[data-tour-plan-service-swap]");
    return card instanceof HTMLElement && media?.contains(card) ? card : null;
  }

  function tourPlanServiceCardTitleText(card) {
    return compactText(card?.querySelector?.(".tour-plan-service-card__body h5")?.textContent)
      || frontendT("tour.plan.service_fallback", "Service");
  }

  function setTourPlanServiceCardFeaturedState(card, featured) {
    if (!(card instanceof HTMLElement)) return;
    const hasDetails = card.getAttribute("data-tour-plan-service-has-details") === "1";
    card.classList.toggle("tour-plan-service-card--featured", featured);
    card.classList.toggle("tour-plan-service-card--small", !featured);
    card.classList.toggle("tour-plan-service-card--interactive", !featured);
    card.classList.toggle("tour-plan-service-card--flippable", featured && hasDetails);
    card.classList.remove("is-flipped");
    if (featured) {
      card.removeAttribute("data-tour-plan-service-swap");
      if (hasDetails) {
        const title = tourPlanServiceCardTitleText(card);
        card.setAttribute("data-tour-plan-service-flip", "");
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.setAttribute("aria-pressed", "false");
        card.setAttribute("aria-label", frontendT("tour.plan.show_service_details", "Show details for {title}", { title }));
      } else {
        card.removeAttribute("data-tour-plan-service-flip");
        card.removeAttribute("role");
        card.removeAttribute("tabindex");
        card.removeAttribute("aria-label");
        card.removeAttribute("aria-pressed");
      }
      return;
    }

    card.removeAttribute("data-tour-plan-service-flip");
    card.removeAttribute("aria-pressed");
    const title = tourPlanServiceCardTitleText(card);
    card.setAttribute("data-tour-plan-service-swap", "");
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", frontendT("tour.plan.feature_service", "Show {title} as the featured service", { title }));
  }

  function finishTourPlanServiceSwapAnimation(card) {
    return new Promise((resolve) => {
      let finished = false;
      let timer = 0;
      const done = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        card.removeEventListener("transitionend", onTransitionEnd);
        resolve();
      };
      const onTransitionEnd = (event) => {
        if (event.target !== card || event.propertyName !== "transform") return;
        done();
      };

      card.addEventListener("transitionend", onTransitionEnd);
      timer = window.setTimeout(done, TOUR_PLAN_SERVICE_SWAP_TRANSITION_MS + 120);
    });
  }

  async function animateTourPlanServiceSwap(media, firstRects, cards) {
    if (prefersReducedMotion()) return;

    const movingCards = cards
      .map((card) => {
        const firstRect = firstRects.get(card);
        const lastRect = card.getBoundingClientRect();
        if (!firstRect || !lastRect.width || !lastRect.height) return null;
        const deltaX = firstRect.left - lastRect.left;
        const deltaY = firstRect.top - lastRect.top;
        const scaleX = firstRect.width / lastRect.width;
        const scaleY = firstRect.height / lastRect.height;
        return { card, deltaX, deltaY, scaleX, scaleY };
      })
      .filter(Boolean);

    if (!movingCards.length) return;

    movingCards.forEach(({ card, deltaX, deltaY, scaleX, scaleY }) => {
      card.classList.add("tour-plan-service-card--swapping");
      card.style.transition = "none";
      card.style.transformOrigin = "top left";
      card.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
    });
    void media.offsetHeight;

    await waitForAnimationFrame();
    movingCards.forEach(({ card }) => {
      card.style.transition = `transform ${TOUR_PLAN_SERVICE_SWAP_TRANSITION_MS}ms cubic-bezier(0.2, 0.82, 0.2, 1)`;
      card.style.transform = "";
    });

    await Promise.all(movingCards.map(({ card }) => finishTourPlanServiceSwapAnimation(card)));
    movingCards.forEach(({ card }) => {
      card.classList.remove("tour-plan-service-card--swapping");
      card.style.transition = "";
      card.style.transformOrigin = "";
      card.style.transform = "";
    });
  }

  async function swapFeaturedTourPlanService(targetCard) {
    if (!(targetCard instanceof HTMLElement)) return;
    const media = targetCard.closest("[data-tour-plan-service-media]");
    if (!(media instanceof HTMLElement) || media.dataset.tourPlanServiceSwapAnimating === "1") return;
    const featuredCard = Array.from(media.children)
      .find((child) => child instanceof HTMLElement && child.matches(".tour-plan-service-card--featured"));
    const side = media.querySelector(".tour-plan-service-media__side");
    if (!(featuredCard instanceof HTMLElement) || !(side instanceof HTMLElement) || featuredCard === targetCard) return;
    if (!side.contains(targetCard)) return;

    media.dataset.tourPlanServiceSwapAnimating = "1";
    const firstRects = new Map([
      [featuredCard, featuredCard.getBoundingClientRect()],
      [targetCard, targetCard.getBoundingClientRect()]
    ]);
    const targetNextSibling = targetCard.nextSibling;

    setTourPlanServiceCardFeaturedState(targetCard, true);
    setTourPlanServiceCardFeaturedState(featuredCard, false);
    media.insertBefore(targetCard, side);
    side.insertBefore(featuredCard, targetNextSibling);

    try {
      await animateTourPlanServiceSwap(media, firstRects, [targetCard, featuredCard]);
    } finally {
      delete media.dataset.tourPlanServiceSwapAnimating;
      syncExpandedTourDetailsHeights();
    }
  }

  function handleTourPlanServiceMediaClick(event) {
    const media = tourPlanServiceMediaFromEvent(event);
    if (!media) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const swapCard = tourPlanServiceSwapCardFromEvent(event, media);
    if (swapCard) {
      event.preventDefault();
      void swapFeaturedTourPlanService(swapCard);
      return;
    }
    const flipCard = target.closest("[data-tour-plan-service-flip]");
    if (!(flipCard instanceof HTMLElement) || !media.contains(flipCard)) return;
    event.preventDefault();
    toggleTourPlanServiceCard(flipCard);
  }

  function handleTourPlanServiceMediaKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const media = tourPlanServiceMediaFromEvent(event);
    if (!media) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const swapCard = tourPlanServiceSwapCardFromEvent(event, media);
    if (swapCard) {
      event.preventDefault();
      void swapFeaturedTourPlanService(swapCard);
      return;
    }
    const flipCard = target.closest("[data-tour-plan-service-flip]");
    if (!(flipCard instanceof HTMLElement) || !media.contains(flipCard)) return;
    event.preventDefault();
    toggleTourPlanServiceCard(flipCard);
  }

  function updateTourCardImageCounter(button, currentIndex, total) {
    const counter = button.querySelector("[data-tour-image-counter]");
    if (!(counter instanceof HTMLElement)) return;
    counter.textContent = `${currentIndex + 1} / ${total}`;
  }

  function clearTourCardImageTransitionTimer(button) {
    const activeTimer = tourCardImageTransitionTimers.get(button);
    if (activeTimer) {
      window.clearTimeout(activeTimer);
      tourCardImageTransitionTimers.delete(button);
    }
  }

  function commitActiveTourCardImageTransition(button) {
    if (!(button instanceof HTMLButtonElement) || button.dataset.imageAnimating !== "1") return;

    const primaryLayer = button.querySelector('[data-tour-media-layer="primary"]');
    const secondaryLayer = button.querySelector('[data-tour-media-layer="secondary"]');
    if (!(primaryLayer instanceof HTMLImageElement) || !(secondaryLayer instanceof HTMLImageElement)) return;

    clearTourCardImageTransitionTimer(button);

    if (secondaryLayer.src) {
      primaryLayer.src = secondaryLayer.src;
    }

    primaryLayer.classList.remove("is-leaving");
    secondaryLayer.classList.remove("is-entering");
    button.dataset.imageAnimating = "0";
  }

  function cycleTourCardImage(button) {
    if (!(button instanceof HTMLButtonElement)) return;

    if (button.dataset.imageAnimating === "1") {
      commitActiveTourCardImageTransition(button);
    }

    const tripId = normalizeText(button.getAttribute("data-trip-id"));
    const trip = state.filteredTrips.find((item) => normalizeText(item?.id) === tripId)
      || state.trips.find((item) => normalizeText(item?.id) === tripId)
      || null;
    const gallery = Array.isArray(trip?.pictures) && trip.pictures.length ? trip.pictures : [DEFAULT_TOUR_IMAGE];
    if (gallery.length <= 1) return;

    const currentIndex = Math.max(0, Number.parseInt(button.dataset.tourGalleryIndex || "0", 10) || 0) % gallery.length;
    const nextIndex = (currentIndex + 1) % gallery.length;
    const primaryLayer = button.querySelector('[data-tour-media-layer="primary"]');
    const secondaryLayer = button.querySelector('[data-tour-media-layer="secondary"]');
    if (!(primaryLayer instanceof HTMLImageElement) || !(secondaryLayer instanceof HTMLImageElement)) return;

    button.dataset.imageAnimating = "1";
    button.dataset.tourGalleryIndex = String(nextIndex);
    secondaryLayer.src = String(gallery[nextIndex] || gallery[0] || DEFAULT_TOUR_IMAGE);
    secondaryLayer.classList.remove("is-entering");
    primaryLayer.classList.remove("is-leaving");

    void secondaryLayer.offsetWidth;

    secondaryLayer.classList.add("is-entering");
    primaryLayer.classList.add("is-leaving");
    updateTourCardImageCounter(button, nextIndex, gallery.length);

    const transitionTimer = window.setTimeout(() => {
      primaryLayer.src = secondaryLayer.src;
      primaryLayer.classList.remove("is-leaving");
      secondaryLayer.classList.remove("is-entering");
      button.dataset.imageAnimating = "0";
      tourCardImageTransitionTimers.delete(button);
    }, TOUR_IMAGE_TRANSITION_MS);
    tourCardImageTransitionTimers.set(button, transitionTimer);
  }

  function renderVisibleTrips() {
    const visibleTrips = state.filteredTrips.slice(0, state.visibleToursCount);
    renderTrips(visibleTrips);
    updateTourActions();
  }

  function rankTripsByPriorityAndRandom(trips) {
    const randomBoostByTripId = state.tourRandomBoostById && typeof state.tourRandomBoostById === "object"
      ? state.tourRandomBoostById
      : (state.tourRandomBoostById = {});

    return trips
      .map((trip) => {
        const tripId = normalizeText(trip?.id);
        const basePriority = Number.isFinite(Number(trip.priority)) ? Number(trip.priority) : 50;
        if (!Number.isFinite(randomBoostByTripId[tripId])) {
          randomBoostByTripId[tripId] = Math.floor(Math.random() * 51);
        }
        const randomBoost = randomBoostByTripId[tripId];
        return {
          trip,
          priority: basePriority,
          randomBoost,
          score: basePriority + randomBoost
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.trip?.id || "").localeCompare(String(b.trip?.id || ""));
      })
      .map((entry) => entry);
  }

  function renderPriorityDebug() {
    if (!els.debugPriorityOutput) return;
    const lines = state.rankedTripsDebug.map((entry, idx) => {
      return `${idx + 1}. ${entry.trip.id} | priority: ${entry.priority} | random: ${entry.randomBoost} | sum: ${entry.score}`;
    });
    const destLabel = formatFilterValue(state.filters.dest, "destination");
    const styleLabel = formatFilterValue(state.filters.style, "style");
    const header = frontendT("tours.debug_header", "Filter: {dest}, {style}", { dest: destLabel, style: styleLabel });
    els.debugPriorityOutput.textContent = `${header}\n${lines.join("\n") || frontendT("tours.debug_empty", "No tours in current filter.")}`;
  }

  function applyFilters() {
    const matchingTrips = state.trips.filter((trip) => {
      const styles = tourStyleCodes(trip);
      const matchDest = tourIncludesDestinationScope(trip, {
        destination: state.filters.dest[0],
        area: state.filters.area,
        place: state.filters.place
      });
      const matchStyle = !state.filters.style.length || state.filters.style.some((style) => styles.includes(style));
      return matchDest && matchStyle;
    });
    const rankedEntries = rankTripsByPriorityAndRandom(matchingTrips);
    state.rankedTripsDebug = rankedEntries;
    state.filteredTrips = rankedEntries.map((entry) => entry.trip);

    renderFilterSummary();
    updateTitlesForFilters();
    updateViewToursButton();
    renderVisibleTrips();
    renderPriorityDebug();
  }

  function saveFilters() {
    localStorage.setItem("asiatravelplan_filters", JSON.stringify(state.filters));
  }

  function onFilterChange() {
    saveFilters();
    updateURLWithFilters();
    updateFilterTriggerLabels();
    applyFilters();
    prefillBookingFormWithFilters();
  }

  function setupFilterEvents() {
    if (!els.navDestinationOptions || !els.navStyleOptions) return;

    els.navDestinationOptions.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-hero-destination-filter]") : null;
      if (!button) return;
      state.filters.dest = normalizeText(button.getAttribute("data-destination"))
        ? [normalizeText(button.getAttribute("data-destination"))]
        : [];
      state.filters.area = normalizeText(button.getAttribute("data-area"));
      state.filters.place = normalizeText(button.getAttribute("data-place"));
      normalizeDestinationScopeFilterFromOptions();
      state.visibleToursCount = initialVisibleTours;
      syncDestinationFilterMenu();
      onFilterChange();
      closeFilterPanelForOptions(els.navDestinationOptions);
    });

    els.navDestinationOptions.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-clear-filter-group]") : null;
      if (!button) return;
      clearFilterGroup("destination", els.navDestinationOptions);
    });

    els.navStyleOptions.addEventListener("change", () => {
      state.filters.style = getCheckedValues(els.navStyleOptions);
      state.visibleToursCount = initialVisibleTours;
      onFilterChange();
    });

    els.navStyleOptions.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-clear-filter-group]") : null;
      if (!button) return;
      clearFilterGroup("style", els.navStyleOptions);
    });

    if (els.viewToursBtn) {
      els.viewToursBtn.addEventListener("click", () => {
        if (els.viewToursBtn.disabled) return;
        scrollToToursGrid();
      });
    }
  }

  function updateURLWithFilters() {
    const url = new URL(window.location.href);

    if (!state.filters.dest.length) {
      url.searchParams.delete("dest");
    } else {
      url.searchParams.set("dest", state.filters.dest.join(","));
    }

    if (!state.filters.area) {
      url.searchParams.delete("area");
    } else {
      url.searchParams.set("area", state.filters.area);
    }

    if (!state.filters.place) {
      url.searchParams.delete("place");
    } else {
      url.searchParams.set("place", state.filters.place);
    }

    if (!state.filters.style.length) {
      url.searchParams.delete("style");
    } else {
      url.searchParams.set("style", state.filters.style.join(","));
    }

    window.history.replaceState({}, "", url.toString());
  }

  function syncFilterInputs() {
    setFilterCheckboxes(els.navStyleOptions, state.filters.style);
    syncDestinationFilterMenu();
    updateFilterTriggerLabels();
  }

  function syncDestinationFilterMenu() {
    if (!els.navDestinationOptions) return;
    const selectedDestination = normalizeText(state.filters.dest?.[0]);
    const selectedArea = normalizeText(state.filters.area);
    const selectedPlace = normalizeText(state.filters.place);
    Array.from(els.navDestinationOptions.querySelectorAll("[data-hero-destination-filter]")).forEach((button) => {
      const destination = normalizeText(button.getAttribute("data-destination"));
      const area = normalizeText(button.getAttribute("data-area"));
      const place = normalizeText(button.getAttribute("data-place"));
      const isSelected = destination === selectedDestination && area === selectedArea && place === selectedPlace;
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
  }

  function closeFilterPanelForOptions(optionsContainer) {
    const panel = optionsContainer?.closest(".filter-select-panel");
    const wrap = panel?.parentElement;
    const trigger = wrap?.querySelector(".filter-select-trigger");
    if (panel) panel.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  }

  function clearFilterGroup(group, optionsContainer) {
    if (group === "destination") {
      state.filters.dest = [];
      state.filters.area = "";
      state.filters.place = "";
    } else if (group === "style") {
      state.filters.style = [];
    } else {
      return;
    }

    state.visibleToursCount = initialVisibleTours;
    syncFilterInputs();
    onFilterChange();
    closeFilterPanelForOptions(optionsContainer);
  }

  function renderFilterCheckbox(kind, value, label = value) {
    const safeValue = escapeHTML(value);
    const safeLabel = escapeHTML(label);
    const inputId = `${kind}Filter_${value.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    return `
      <label class="filter-checkbox-option" for="${escapeHTML(inputId)}">
        <input id="${escapeHTML(inputId)}" type="checkbox" value="${safeValue}" />
        <span>${safeLabel}</span>
      </label>
    `;
  }

  function renderFilterClearAction(group, label) {
    return `
      <button class="filter-panel-action" type="button" data-clear-filter-group="${escapeAttr(group)}">
        ${escapeHTML(label)}
      </button>
    `;
  }

  function renderDestinationFilterButton({
    label,
    destination = "",
    area = "",
    place = "",
    className = "hero-destination-menu__item"
  } = {}) {
    return `
      <button
        class="${escapeAttr(className)}"
        type="button"
        role="menuitem"
        data-hero-destination-filter
        data-destination="${escapeAttr(destination)}"
        data-area="${escapeAttr(area)}"
        data-place="${escapeAttr(place)}"
        aria-pressed="false"
      >${escapeHTML(label)}</button>
    `;
  }

  function renderDestinationScopeMenu() {
    const catalog = destinationScopeCatalog();
    const areaByDestination = new Map();
    for (const area of catalog.areas) {
      const items = areaByDestination.get(area.destination) || [];
      items.push(area);
      areaByDestination.set(area.destination, items);
    }
    const placesByArea = new Map();
    for (const place of catalog.places) {
      const items = placesByArea.get(place.area_id) || [];
      items.push(place);
      placesByArea.set(place.area_id, items);
    }

    const destinationMarkup = catalog.destinations.map((destination) => {
      const areas = areaByDestination.get(destination.code) || [];
      return `
        <section class="hero-destination-menu__destination">
          ${renderDestinationFilterButton({
            label: destination.label,
            destination: destination.code,
            className: "hero-destination-menu__destination-button"
          })}
          ${areas.length
            ? `<div class="hero-destination-menu__areas">
                ${areas.map((area) => {
                  const places = placesByArea.get(area.id) || [];
                  return `
                    <section class="hero-destination-menu__area">
                      ${renderDestinationFilterButton({
                        label: area.label,
                        destination: destination.code,
                        area: area.id,
                        className: "hero-destination-menu__area-button"
                      })}
                      ${places.length
                        ? `<div class="hero-destination-menu__places">
                            ${places.map((place) => renderDestinationFilterButton({
                              label: place.label,
                              destination: destination.code,
                              area: area.id,
                              place: place.id
                            })).join("")}
                          </div>`
                        : ""}
                    </section>
                  `;
                }).join("")}
              </div>`
            : ""}
        </section>
      `;
    }).join("");

    return `
      <div class="hero-destination-menu__all">
        ${renderDestinationFilterButton({
          label: frontendT("filters.all_destinations", "All destinations"),
          className: "hero-destination-menu__all-button"
        })}
      </div>
      ${destinationMarkup || `<p class="hero-destination-menu__empty">${escapeHTML(frontendT("filters.no_destinations", "No destinations configured."))}</p>`}
    `;
  }

  function populateFilterOptions() {
    const destinations = filterOptionList("destination");
    const styles = filterOptionList("style");
    const bookingDestinations = destinations.map((option) => option.label);
    const bookingStyles = styles.map((option) => option.label);
    const destinationFilterWrap = els.navDestinationWrap;
    const showDestinationFilter = shouldShowHeroDestinationFilter();

    if (els.navDestinationOptions) {
      els.navDestinationOptions.innerHTML = renderDestinationScopeMenu();
      syncDestinationFilterMenu();
    }

    if (destinationFilterWrap instanceof HTMLElement) {
      destinationFilterWrap.hidden = !showDestinationFilter;
    }
    if (els.navDestinationPanel) els.navDestinationPanel.hidden = true;
    if (els.navDestinationTrigger) els.navDestinationTrigger.setAttribute("aria-expanded", "false");

    if (els.navStyleOptions) {
      els.navStyleOptions.innerHTML = [
        renderFilterClearAction("style", frontendT("filters.all_styles", "All travel styles")),
        ...styles.map((style) => renderFilterCheckbox("style", style.code, style.label))
      ].join("");
    }

    if (els.bookingDestinationOptions) {
      els.bookingDestinationOptions.innerHTML = bookingDestinations
        .map((destination) => renderFilterCheckbox("bookingDestination", destination, destination))
        .join("");
    }

    if (els.bookingStyleOptions) {
      els.bookingStyleOptions.innerHTML = bookingStyles
        .map((style) => renderFilterCheckbox("bookingStyle", style, style))
        .join("");
    }
  }

  function setupFilterSelectPanels() {
    const controls = [
      { trigger: els.navDestinationTrigger, panel: els.navDestinationPanel },
      { trigger: els.navStyleTrigger, panel: els.navStylePanel },
      { trigger: els.bookingDestinationTrigger, panel: els.bookingDestinationPanel },
      { trigger: els.bookingStyleTrigger, panel: els.bookingStylePanel }
    ].filter((item) => item.trigger && item.panel);

    if (!controls.length) return;

    const closeAllPanels = () => {
      controls.forEach(({ trigger, panel }) => {
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      });
    };

    controls.forEach(({ trigger, panel }) => {
      trigger.addEventListener("click", (event) => {
        event.stopPropagation();
        const willOpen = panel.hidden;
        closeAllPanels();
        panel.hidden = !willOpen;
        trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });

      panel.addEventListener("click", (event) => {
        event.stopPropagation();
      });
    });

    document.addEventListener("click", closeAllPanels);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAllPanels();
    });

    if (els.bookingDestinationOptions) {
      els.bookingDestinationOptions.addEventListener("change", () => {
        updateBookingSelectionFromOptions("bookingDestination", els.bookingDestinationOptions);
      });
    }

    if (els.bookingStyleOptions) {
      els.bookingStyleOptions.addEventListener("change", () => {
        updateBookingSelectionFromOptions("bookingStyle", els.bookingStyleOptions);
      });
    }
  }

  function updateBookingSelectionFromOptions(fieldId, optionsContainer) {
    const values = getCheckedValues(optionsContainer);
    setBookingField(fieldId, values);
  }

  function prewarmTourImages(tours) {
    const seen = new Set();
    const urls = [];

    for (const tour of tours) {
      for (const url of (Array.isArray(tour?.pictures) ? tour.pictures : []).slice(0, 1)) {
        if (!url || seen.has(url)) continue;
        seen.add(url);
        urls.push(url);
      }
      if (urls.length >= 12) break;
    }

    urls.forEach((url) => {
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.src = url;
    });
  }

  return {
    applyFilters,
    filterLabels,
    getCheckedValues,
    getFiltersFromURL,
    loadTrips,
    normalizeActiveFiltersFromOptions,
    normalizeFilterSelection,
    prewarmTourImages,
    populateFilterOptions,
    preferredCurrencyForFrontendLang,
    renderPriorityDebug,
    renderVisibleTrips,
    resolveLocalizedFrontendText,
    setFilterCheckboxes,
    setupFilterEvents,
    setupFilterSelectPanels,
    syncFilterInputs,
    tourDestinations
  };
}
