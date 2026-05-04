import { normalizeText } from "../../shared/js/text.js";
import {
  FRONTEND_LANGUAGE_CODES,
  normalizeLanguageCode
} from "../../shared/generated/language_catalog.js";

const DEFAULT_TOUR_IMAGE = "/assets/img/marketing_tours.png";
const TOUR_IMAGE_TRANSITION_MS = 2000;
const TOUR_GRID_LAYOUT_TRANSITION_MS = 520;
const TOUR_DETAILS_OPEN_TRANSITION_MS = 920;
const TOUR_DETAILS_MOBILE_OPEN_TRANSITION_MS = 1500;
const TOUR_DETAILS_MOBILE_OPEN_EASING = "cubic-bezier(0.45, 0, 0.2, 1)";
const TOUR_DETAILS_TRANSITION_MS = 640;
const TOUR_DETAILS_CLOSE_TRANSITION_MS = 780;
const TOUR_DETAILS_DESKTOP_CLOSE_TRANSITION_MS = 920;
const TOUR_PLAN_SERVICE_SWAP_TRANSITION_MS = 380;
const TOUR_PLAN_DAY_DETAILS_TRANSITION_MS = 300;
const TOUR_SHOW_MORE_LABEL_TRANSITION_MS = 420;
const TOUR_CARD_SCROLL_TIMEOUT_MS = 900;
const TOUR_CARD_SCROLL_MARGIN_PX = 12;
const TOUR_DETAILS_IMAGE_READY_TIMEOUT_MS = 900;
const TOUR_DETAILS_CONNECTOR_VIEWPORT_THRESHOLD_PX = 100;
const TOUR_CARD_MEDIA_SNAPSHOT_HOLD_MS = Math.max(
  TOUR_GRID_LAYOUT_TRANSITION_MS,
  TOUR_DETAILS_OPEN_TRANSITION_MS,
  TOUR_DETAILS_MOBILE_OPEN_TRANSITION_MS,
  TOUR_DETAILS_TRANSITION_MS,
  TOUR_DETAILS_CLOSE_TRANSITION_MS,
  TOUR_DETAILS_DESKTOP_CLOSE_TRANSITION_MS
) + 180;
const COUNTRY_TO_TOUR_DESTINATION_CODE = Object.freeze({
  VN: "vietnam",
  TH: "thailand",
  KH: "cambodia",
  LA: "laos"
});
const TOUR_EXPERIENCE_HIGHLIGHT_LIMIT = 4;
const EXPERIENCE_HIGHLIGHTS_BASE_PATH = "/assets/img/experience-highlights";
const TOUR_EXPERIENCE_HIGHLIGHTS = Object.freeze([
  { id: "iconic_landmarks", title: "Iconic Landmarks", image: "01.png" },
  { id: "cultural_heritage", title: "Cultural Heritage", image: "02.png" },
  { id: "local_experiences", title: "Local Experiences", image: "03.png" },
  { id: "delicious_cuisine", title: "Delicious Cuisine", image: "04.png" },
  { id: "scenic_landscapes", title: "Scenic Landscapes", image: "05.png" },
  { id: "hidden_gems", title: "Hidden Gems", image: "06.png" },
  { id: "historic_sites", title: "Historic Sites", image: "07.png" },
  { id: "art_architecture", title: "Art and Architecture", image: "08.png" },
  { id: "nature_wildlife", title: "Nature and Wildlife", image: "09.png" },
  { id: "beaches_islands", title: "Beaches and Islands", image: "10.png" },
  { id: "mountain_adventures", title: "Mountain Adventures", image: "11.png" },
  { id: "city_life", title: "City Life", image: "12.png" },
  { id: "festivals_events", title: "Festivals and Events", image: "13.png" },
  { id: "traditional_markets", title: "Traditional Markets", image: "14.png" },
  { id: "nightlife_entertainment", title: "Nightlife and Entertainment", image: "15.png" },
  { id: "wellness_relaxation", title: "Wellness and Relaxation", image: "16.png" },
  { id: "family_friendly_activities", title: "Family Friendly Activities", image: "17.png" },
  { id: "outdoor_adventures", title: "Outdoor Adventures", image: "18.png" },
  { id: "spiritual_places", title: "Spiritual Places", image: "19.png" },
  { id: "shopping_souvenirs", title: "Shopping and Souvenirs", image: "20.png" }
]);
const TOUR_EXPERIENCE_HIGHLIGHT_BY_ID = new Map(TOUR_EXPERIENCE_HIGHLIGHTS.map((item) => [item.id, item]));
const tourCardImageTransitionTimers = new WeakMap();
const tourPlanSummaryDetailsAnimations = new WeakMap();

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
  let tourDetailsConnectorFrame = 0;
  let tourDetailsTransitionToken = 0;
  let tourCardMediaSnapshotToken = 0;
  const openingTourColumnIndexes = new Map();
  const openingTourInitialHeights = new Map();

  function normalizeFrontendTourLang(value) {
    return normalizeLanguageCode(value, { allowedCodes: FRONTEND_LANGUAGE_CODES, fallback: "en" });
  }

  function generatedTourAssetUrlsByLang() {
    const toursByLang = window.ASIATRAVELPLAN_PUBLIC_HOMEPAGE_COPY?.assetUrls?.toursByLang;
    return toursByLang && typeof toursByLang === "object" ? toursByLang : {};
  }

  function generatedTourDestinationAssetUrlsByLang() {
    const destinationsByLang = window.ASIATRAVELPLAN_PUBLIC_HOMEPAGE_COPY?.assetUrls?.tourDestinationsByLang;
    return destinationsByLang && typeof destinationsByLang === "object" ? destinationsByLang : {};
  }

  function publicToursDataUrl(lang) {
    const normalizedLang = normalizeFrontendTourLang(lang);
    return normalizeText(generatedTourAssetUrlsByLang()?.[normalizedLang])
      || `/frontend/data/generated/homepage/public-tours.${encodeURIComponent(normalizedLang)}.json`;
  }

  function publicTourDestinationsDataUrl(lang) {
    const normalizedLang = normalizeFrontendTourLang(lang);
    return normalizeText(generatedTourDestinationAssetUrlsByLang()?.[normalizedLang])
      || `/frontend/data/generated/homepage/public-tour-destinations.${encodeURIComponent(normalizedLang)}.json`;
  }

  function publicTourDetailsDataUrl(trip) {
    const explicitUrl = normalizeText(trip?.travel_plan_details_url);
    if (explicitUrl) return explicitUrl;
    const normalizedLang = normalizeFrontendTourLang(currentFrontendLang());
    const tripId = normalizeText(trip?.id);
    return tripId
      ? `/frontend/data/generated/homepage/public-tour-details.${encodeURIComponent(normalizedLang)}.${encodeURIComponent(tripId)}.json`
      : "";
  }

  function slugify(value, fallback = "tour") {
    const slug = normalizeText(value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");
    return slug || fallback;
  }

  function tourSeoSlug(trip) {
    const explicitSlug = slugify(trip?.seo_slug, "");
    if (explicitSlug) return explicitSlug;
    const tripId = normalizeText(trip?.id);
    const title = normalizeText(trip?.title) || tripId;
    const suffix = slugify(tripId.replace(/^tour[_-]?/i, ""), "tour").slice(0, 8);
    return `${slugify(title)}-${suffix}`;
  }

  function tourDetailsHref(trip) {
    return `/tours/${tourSeoSlug(trip)}`;
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
    const scope = Array.isArray(trip?.destination_scope)
      ? trip.destination_scope
      : (Array.isArray(trip?.travel_plan?.destination_scope) ? trip.travel_plan.destination_scope : []);
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

  function hasActiveHeroFilters() {
    return Boolean(
      state.filters.dest.length
      || normalizeText(state.filters.area)
      || normalizeText(state.filters.place)
      || state.filters.style.length
    );
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

  function updateHeroFilterMatchCount() {
    if (!(els.heroFilterMatchCount instanceof HTMLElement)) return;

    if (!hasActiveHeroFilters()) {
      els.heroFilterMatchCount.textContent = "";
      els.heroFilterMatchCount.hidden = true;
      return;
    }

    const total = state.filteredTrips.length;
    const label = total === 0
      ? frontendT("tours.filter_match_count.zero", "No tours match these filter criteria")
      : total === 1
        ? frontendT("tours.filter_match_count.one", "1 tour matches these filter criteria")
        : frontendT("tours.filter_match_count.many", "{count} tours match these filter criteria", {
          count: String(total)
        });
    els.heroFilterMatchCount.textContent = label;
    els.heroFilterMatchCount.hidden = false;
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
    const selectedImageIds = Array.from(new Set((Array.isArray(item?.travel_plan?.tour_card_image_ids) ? item.travel_plan.tour_card_image_ids : [])
      .map((value) => normalizeText(value))
      .filter(Boolean)));
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
    if (selectedImageIds.length) {
      entries.sort((left, right) => {
        const leftIndex = selectedImageIds.indexOf(left.id);
        const rightIndex = selectedImageIds.indexOf(right.id);
        const normalizedLeftIndex = leftIndex >= 0 ? leftIndex : Number.MAX_SAFE_INTEGER;
        const normalizedRightIndex = rightIndex >= 0 ? rightIndex : Number.MAX_SAFE_INTEGER;
        return normalizedLeftIndex - normalizedRightIndex;
      });
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

  function normalizeTourDestinationPayloadForFrontend(payload) {
    const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
    return source.available_destination_scope_catalog
      || source.destination_scope_catalog
      || source.catalog
      || null;
  }

  async function loadTourDestinations(lang) {
    const response = await fetch(publicTourDestinationsDataUrl(lang), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Static tour destinations request failed with status ${response.status}.`);
    }
    return response.json();
  }

  function normalizeToursPayloadForFrontend(payload, destinationPayload = null) {
    const source = Array.isArray(payload) ? { items: payload } : (payload || {});
    const generatedDestinationCatalog = normalizeTourDestinationPayloadForFrontend(destinationPayload);
    return {
      items: normalizeToursForFrontend(Array.isArray(source.items) ? source.items : []),
      available_destinations: normalizeFilterOptionList(source.available_destinations),
      available_destination_scope_catalog: generatedDestinationCatalog || source.available_destination_scope_catalog || null,
      available_styles: normalizeFilterOptionList(source.available_styles)
    };
  }

  async function loadTrips() {
    const lang = normalizeFrontendTourLang(currentFrontendLang());
    const destinationPayloadPromise = loadTourDestinations(lang).catch((error) => {
      console.warn("Failed to load static tour destinations data.", error);
      return null;
    });
    const response = await fetch(publicToursDataUrl(lang), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Static tours request failed with status ${response.status}.`);
    }
    const [payload, destinationPayload] = await Promise.all([
      response.json(),
      destinationPayloadPromise
    ]);
    return normalizeToursPayloadForFrontend(payload, destinationPayload);
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
    return travelPlanDays(trip).length > 0
      || Number(trip?.travel_plan_day_count || 0) > 0
      || trip?.has_travel_plan_details === true;
  }

  function tourDurationDayCount(trip) {
    return travelPlanDays(trip).length
      || Math.max(0, Number.parseInt(trip?.travel_plan_day_count, 10) || 0)
      || Math.max(0, Number.parseInt(trip?.duration_days, 10) || 0);
  }

  function tourDurationDaysLabel(trip) {
    const dayCount = tourDurationDayCount(trip);
    return dayCount > 0
      ? frontendT("tour.card.days", "{days} days", { days: String(dayCount) })
      : "";
  }

  function tourDetailsCache() {
    if (!state.tourDetailsById || typeof state.tourDetailsById !== "object") {
      state.tourDetailsById = {};
    }
    return state.tourDetailsById;
  }

  function tourDetailsInflightCache() {
    if (!state.tourDetailsInflightById || typeof state.tourDetailsInflightById !== "object") {
      state.tourDetailsInflightById = {};
    }
    return state.tourDetailsInflightById;
  }

  function tourDetailsCacheKey(tripId, lang = currentFrontendLang()) {
    const normalizedTripId = normalizeText(tripId);
    if (!normalizedTripId) return "";
    return `${normalizeFrontendTourLang(lang)}:${normalizedTripId}`;
  }

  function normalizeTourDetailsPayloadForFrontend(payload, trip) {
    const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
    const travelPlan = source.travel_plan && typeof source.travel_plan === "object" && !Array.isArray(source.travel_plan)
      ? source.travel_plan
      : {};
    const onePagerPdfUrl = normalizeText(source.one_pager_pdf_url || travelPlan.one_pager_pdf_url);
    const onePagerExperienceHighlightIds = Array.isArray(source.one_pager_experience_highlight_ids)
      ? source.one_pager_experience_highlight_ids
      : (Array.isArray(travelPlan.one_pager_experience_highlight_ids) ? travelPlan.one_pager_experience_highlight_ids : []);
    const onePagerExperienceHighlights = Array.isArray(source.one_pager_experience_highlights)
      ? source.one_pager_experience_highlights
      : (Array.isArray(travelPlan.one_pager_experience_highlights) ? travelPlan.one_pager_experience_highlights : []);
    return {
      title: source.title ?? trip?.title,
      travel_plan: travelPlan,
      travel_plan_day_count: Array.isArray(travelPlan.days) ? travelPlan.days.length : 0,
      has_travel_plan_details: Array.isArray(travelPlan.days) && travelPlan.days.length > 0,
      ...(onePagerPdfUrl ? { one_pager_pdf_url: onePagerPdfUrl } : {}),
      ...(onePagerExperienceHighlightIds.length ? { one_pager_experience_highlight_ids: onePagerExperienceHighlightIds } : {}),
      ...(onePagerExperienceHighlights.length ? { one_pager_experience_highlights: onePagerExperienceHighlights } : {})
    };
  }

  async function loadTourDetailsForTrip(trip) {
    const tripId = normalizeText(trip?.id);
    if (!tripId) return null;
    if (travelPlanDays(trip).length > 0) return trip;

    const cache = tourDetailsCache();
    const cacheKey = tourDetailsCacheKey(tripId);
    if (cache[cacheKey]) {
      Object.assign(trip, cache[cacheKey]);
      return trip;
    }

    const inflight = tourDetailsInflightCache();
    if (!inflight[cacheKey]) {
      const url = publicTourDetailsDataUrl(trip);
      inflight[cacheKey] = url
        ? fetch(url)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Static tour details request failed with status ${response.status}.`);
            }
            return response.json();
          })
          .then((payload) => normalizeTourDetailsPayloadForFrontend(payload, trip))
          .finally(() => {
            delete inflight[cacheKey];
          })
        : Promise.resolve(null);
    }

    const details = await inflight[cacheKey];
    if (!details) return null;
    cache[cacheKey] = details;
    Object.assign(trip, details);
    return trip;
  }

  async function ensureTourDetailsLoaded(tripId) {
    const trip = findTripById(tripId);
    if (!trip || !hasTravelPlanDays(trip)) return null;
    try {
      return await loadTourDetailsForTrip(trip);
    } catch (error) {
      console.error("Failed to load static homepage tour details.", error);
      return null;
    }
  }

  async function loadExpandedTourDetails() {
    const tripIds = Array.from(expandedTourIdSet()).filter(Boolean);
    if (!tripIds.length) return;
    const currentTripsById = new Map(
      (Array.isArray(state.trips) ? state.trips : [])
        .map((trip) => [normalizeText(trip?.id), trip])
        .filter(([tripId]) => tripId)
    );
    await Promise.all(tripIds.map(async (tripId) => {
      const trip = currentTripsById.get(normalizeText(tripId)) || findTripById(tripId);
      if (!trip || !hasTravelPlanDays(trip)) return null;
      try {
        return await loadTourDetailsForTrip(trip);
      } catch (error) {
        console.error("Failed to load static homepage tour details.", error);
        return null;
      }
    }));
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
    const dayCount = tourDurationDayCount(trip);
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
        syncTourCardImageSwipeSurfaces();
        fitTourCardDescriptions();
        syncExpandedTourDetailsHeights();
        scheduleTourDetailsConnectorVisibilityUpdate();
        window.requestAnimationFrame(() => {
          syncTourCardImageSwipeSurfaces();
          fitTourCardDescriptions();
          syncExpandedTourDetailsHeights();
          scheduleTourDetailsConnectorVisibilityUpdate();
        });
        return;
      }
      renderedTourGridColumnCount = nextColumnCount;
      openingTourColumnIndexes.clear();
      renderVisibleTrips();
    });
    window.addEventListener("scroll", () => {
      scheduleTourDetailsConnectorVisibilityUpdate();
    }, { passive: true });
  }

  function renderTourMediaBadges(trip) {
    const durationSuffix = formatTourDurationSuffix(trip);
    return durationSuffix
      ? `<span class="tour-card__duration-pill">${escapeHTML(durationSuffix)}</span>`
      : "";
  }

  function tourShowMoreLabel(expanded) {
    return expanded
      ? frontendT("tour.card.show_less", "Show less")
      : frontendT("tour.card.details", "Details");
  }

  function renderTourShowMoreLabel(label) {
    return `<span class="tour-card__show-more-label" data-tour-card-show-more-label>${escapeHTML(label)}</span>`;
  }

  function renderTourDetailsCloseButton(tripId) {
    const label = tourShowMoreLabel(true);
    return `
      <button
        class="tour-details-row__close"
        type="button"
        data-tour-details-close
        data-trip-id="${escapeAttr(tripId)}"
        aria-label="${escapeAttr(label)}"
        title="${escapeAttr(label)}"
      ><span aria-hidden="true">&times;</span></button>
    `;
  }

  function tourShowMoreButton(tripId) {
    if (!els.tourGrid) return null;
    const normalizedTripId = normalizeText(tripId);
    return Array.from(els.tourGrid.querySelectorAll("[data-tour-card-show-more][data-trip-id]"))
      .find((candidate) => normalizeText(candidate.getAttribute("data-trip-id")) === normalizedTripId) || null;
  }

  function setTourShowMoreButtonLabel(button, label) {
    if (!(button instanceof HTMLElement)) return null;
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
    if (!(button instanceof HTMLElement)) return;
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

    const fadeOut = labelElement.animate([
      { opacity: 1 },
      { opacity: 0 }
    ], {
      duration: Math.round(TOUR_SHOW_MORE_LABEL_TRANSITION_MS / 2),
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      fill: "forwards"
    });
    await fadeOut.finished.catch(() => {});
    fadeOut.cancel();
    labelElement.textContent = nextLabel;
    const fadeIn = labelElement.animate([
      { opacity: 0 },
      { opacity: 1 }
    ], {
      duration: Math.round(TOUR_SHOW_MORE_LABEL_TRANSITION_MS / 2),
      easing: "cubic-bezier(0.2, 0, 0.2, 1)",
      fill: "forwards"
    });
    await fadeIn.finished.catch(() => {});
    fadeIn.cancel();
  }

  function renderTourCard(trip, { index = 0, expanded = false } = {}) {
    const tripId = normalizeText(trip?.id);
    const tripTitle = resolveLocalizedFrontendText(trip?.title, state.lang);
    const tripShortDescription = resolveLocalizedFrontendText(trip?.short_description, state.lang);
    const countries = tourDestinations(trip);
    const countriesLabel = countries.join(", ");
    const ctaLabel = frontendT("tour.card.plan_trip", "Plan this trip");
    const durationMetaLabel = tourDurationDaysLabel(trip);
    const privateTourLabel = frontendT("tour.card.private_tour", "Private tour");
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
    const galleryCount = gallery.length;
    const activeGalleryIndex = savedTourCardGalleryIndex(tripId, galleryCount);
    const primaryPicture = normalizeText(gallery[activeGalleryIndex]) || primaryTourPicture(trip);
    const singleColumnGallery = galleryCount > 1 && isSingleColumnTourLayout();
    const galleryImageAlt = frontendT("tour.card.image_alt", "{title} in {destinations}", {
      title: tripTitle,
      destinations: countriesLabel
    });
    const mediaCycleTag = galleryCount > 1 && !singleColumnGallery ? "button" : "div";
    const mediaCycleClass = galleryCount > 1
      ? `tour-card__media-cycle ${singleColumnGallery ? "tour-card__media-swipe" : "tour-card__media-button"}`
      : "tour-card__media-cycle";
    const mediaAttrs = galleryCount > 1
      ? singleColumnGallery
        ? ` data-tour-image-swipe="1" data-tour-gallery-index="${escapeAttr(String(activeGalleryIndex))}" data-tour-gallery-total="${escapeAttr(String(galleryCount))}" data-trip-id="${escapeAttr(tripId)}"`
        : ` type="button" data-tour-image-cycle="1" data-tour-gallery-index="${escapeAttr(String(activeGalleryIndex))}" data-trip-id="${escapeAttr(tripId)}" aria-label="${escapeAttr(galleryLabel)}"`
      : "";
    const galleryCounter = galleryCount > 1
      ? `<span class="tour-card__media-counter" data-tour-image-counter>${escapeHTML(`${activeGalleryIndex + 1} / ${galleryCount}`)}</span>`
      : "";
    const galleryDots = galleryCount > 1
      ? `
          <span class="tour-card__media-dots" data-tour-image-dots aria-hidden="true">
            ${gallery.map((_image, imageIndex) => `<span class="tour-card__media-dot${imageIndex === activeGalleryIndex ? " is-active" : ""}" data-tour-image-dot></span>`).join("")}
          </span>
        `
      : "";
    const galleryMediaMarkup = singleColumnGallery
      ? `
                <div class="tour-card__media-track" data-tour-media-track>
                  ${[{ image: gallery[activeGalleryIndex], imageIndex: activeGalleryIndex }].map(({ image, imageIndex }) => `
                    <img
                      class="tour-card__media-slide${imageIndex === activeGalleryIndex ? " is-active" : ""}"
                      data-tour-media-slide
                      data-tour-media-index="${escapeAttr(String(imageIndex))}"
                      data-tour-media-alt="${escapeAttr(galleryImageAlt)}"
                      src="${escapeAttr(image || DEFAULT_TOUR_IMAGE)}"
                      alt="${imageIndex === activeGalleryIndex ? escapeAttr(galleryImageAlt) : ""}"
                      aria-hidden="${imageIndex === activeGalleryIndex ? "false" : "true"}"
                      loading="${imageIndex === activeGalleryIndex ? loading : "lazy"}"
                      fetchpriority="${imageIndex === activeGalleryIndex ? fetchpriority : "auto"}"
                      draggable="false"
                      width="1200"
                      height="800"
                    />
                  `).join("")}
                </div>
              `
      : `
                <img
                  class="tour-card__media-layer is-active"
                  data-tour-media-layer="primary"
                  src="${escapeAttr(primaryPicture)}"
                  alt="${escapeAttr(galleryImageAlt)}"
                  loading="${loading}"
                  fetchpriority="${fetchpriority}"
                  draggable="false"
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
                  draggable="false"
                  width="1200"
                  height="800"
                />
              `;
    const canShowDetails = hasTravelPlanDays(trip);
    const detailsPanelId = tourDetailsPanelId(tripId);
    const detailsHref = tourDetailsHref(trip);
    const showMoreStateAttrs = canShowDetails
      ? `aria-expanded="${expanded ? "true" : "false"}" aria-controls="${escapeAttr(detailsPanelId)}"`
      : `title="${escapeAttr(detailsUnavailableLabel)}"`;

    return `
      <article class="tour-card${expanded ? " tour-card--expanded" : ""}" data-tour-card-id="${escapeAttr(tripId)}" draggable="false">
        <div class="tour-card__media">
          <${mediaCycleTag} class="${mediaCycleClass}"${mediaAttrs}>
            <div class="tour-card__media-zoom">
              <div class="tour-card__media-stage">
                ${galleryMediaMarkup}
              </div>
            </div>
          </${mediaCycleTag}>
          ${galleryCounter}
          ${galleryDots}
          ${renderTourMediaBadges(trip)}
        </div>
        <div class="tour-body">
          <h3 class="tour-title tour-title--card">
            <span class="tour-title__text">${escapeHTML(tripTitle)}</span>
          </h3>
          <p class="tour-card__meta">
            ${durationMetaLabel ? `<span>${escapeHTML(durationMetaLabel)}</span>` : ""}
            ${durationMetaLabel && countriesLabel ? `<span aria-hidden="true">•</span>` : ""}
            ${countriesLabel ? `<span>${escapeHTML(countriesLabel)}</span>` : ""}
            ${(durationMetaLabel || countriesLabel) ? `<span aria-hidden="true">•</span>` : ""}
            <span>${escapeHTML(privateTourLabel)}</span>
          </p>
          <div class="tour-desc-wrap">
            <p class="tour-desc" data-tour-desc>${escapeHTML(tripShortDescription)}</p>
          </div>
          <div class="tour-card__actions">
            <button class="btn btn-primary tour-card__plan-trip" type="button" data-open-modal data-trip-id="${escapeAttr(tripId)}">${escapeHTML(ctaLabel)}</button>
            <a class="btn tour-card__show-more" href="${escapeAttr(detailsHref)}" data-tour-card-show-more data-trip-id="${escapeAttr(tripId)}" ${showMoreStateAttrs}>${renderTourShowMoreLabel(showMoreLabel)}</a>
          </div>
        </div>
      </article>
    `;
  }

  function fitTourCardDescription(description) {
    if (!(description instanceof HTMLElement)) return;
    description.style.fontSize = "";
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

  function stripLeadingBulletMarkers(value) {
    return normalizeText(value).replace(/(^|\n)\s*[•*+-]\s+/g, "$1");
  }

  function compactServiceDetailText(value) {
    return stripLeadingBulletMarkers(value).replace(/\s+/g, " ");
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

  function tourPlanImageSrc(image) {
    if (typeof image === "string") return absolutizeBackendUrl(image);
    if (!image || typeof image !== "object" || Array.isArray(image)) return "";
    return absolutizeBackendUrl(image.storage_path || image.url || image.src || image.path);
  }

  function tourPlanServiceImages(service) {
    const candidates = [
      service?.image,
      ...(Array.isArray(service?.images)
        ? [...service.images].sort((left, right) => Number(left?.sort_order || 0) - Number(right?.sort_order || 0))
        : [])
    ];
    const images = [];
    const seen = new Set();
    for (const candidate of candidates) {
      if (!candidate) continue;
      const image = typeof candidate === "string" ? { storage_path: candidate } : candidate;
      if (!image || typeof image !== "object" || Array.isArray(image)) continue;
      if (image.is_customer_visible === false) continue;
      const src = tourPlanImageSrc(image);
      if (!src) continue;
      const imageId = normalizeText(image.id);
      if ((imageId && seen.has(imageId)) || seen.has(src)) continue;
      if (imageId) seen.add(imageId);
      seen.add(src);
      images.push(image);
    }
    return images;
  }

  function primaryTourPlanServiceImage(service) {
    const images = tourPlanServiceImages(service);
    if (images.length) return images.find((item) => item?.is_primary) || images[0] || null;
    const image = service?.image;
    if (typeof image === "string") return { storage_path: image };
    if (image && typeof image === "object" && !Array.isArray(image) && image.is_customer_visible !== false) return image;
    return null;
  }

  function tourPlanServiceImageSrc(service) {
    const image = primaryTourPlanServiceImage(service);
    return tourPlanImageSrc(image);
  }

  function tourPlanServiceTitle(service, { genericFallback = true, image = null } = {}) {
    const titleImage = image || primaryTourPlanServiceImage(service);
    const title = resolveTravelPlanField(service, "title")
      || resolveTravelPlanField(service, "image_subtitle")
      || resolveTravelPlanImageField(titleImage, "caption")
      || resolveTravelPlanField(service, "location")
      || formatServiceKindLabel(service?.kind);
    return title || (genericFallback ? frontendT("tour.plan.service_fallback", "Service") : "");
  }

  function tourPlanServiceDetails(service, title = tourPlanServiceTitle(service)) {
    const normalizedTitle = compactText(title).toLowerCase();
    const details = compactServiceDetailText(resolveTravelPlanField(service, "details"));
    return details && details.toLowerCase() !== normalizedTitle ? details : "";
  }

  function tourPlanServiceImageAlt(service, image = null) {
    const altImage = image || primaryTourPlanServiceImage(service);
    return resolveTravelPlanImageField(altImage, "alt_text")
      || tourPlanServiceTitle(service, { image: altImage })
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
    const detailsText = compactServiceDetailText(details);
    const titleText = compactText(title).toLowerCase();

    if (detailsText && detailsText.toLowerCase() !== titleText) {
      const withDetails = [line, detailsText].filter(Boolean).join(" - ");
      if (!line || withDetails.length <= 118) {
        line = withDetails;
      }
    }

    return truncateCompactText(line || detailsText);
  }

  function renderTourPlanServiceCard(service, className = "", { featured = false, swappable = false, image = null } = {}) {
    const serviceImage = image || primaryTourPlanServiceImage(service);
    const src = tourPlanImageSrc(serviceImage);
    if (!src) return "";
    const title = tourPlanServiceTitle(service, { image: serviceImage });
    const details = tourPlanServiceDetails(service, title);
    const width = Math.max(1, Number.parseInt(serviceImage?.width_px, 10) || 720);
    const height = Math.max(1, Number.parseInt(serviceImage?.height_px, 10) || 720);
    const hasDetails = Boolean(compactText(details));
    const detailsLabel = frontendT("tour.plan.show_service_details", "Show details for {title}", { title });
    const detailsBadgeLabel = frontendT("tour.plan.service_details_badge", "Details");
    const swapLabel = frontendT("tour.plan.feature_service", "Show {title} as the featured service", { title });
    const body = `
      <div class="tour-plan-service-card__body">
        <h5>${escapeHTML(title)}</h5>
        ${hasDetails ? `<p>${escapeHTML(details)}</p>` : ""}
      </div>
    `;
    const imageMarkup = `
      <img
        src="${escapeAttr(src)}"
        alt="${escapeAttr(tourPlanServiceImageAlt(service, serviceImage))}"
        loading="eager"
        width="${escapeAttr(String(width))}"
        height="${escapeAttr(String(height))}"
      />
    `;

    return `
      <article
        class="tour-plan-service-card${className ? ` ${escapeAttr(className)}` : ""}${hasDetails ? " tour-plan-service-card--has-details" : ""}${swappable ? " tour-plan-service-card--interactive" : ""}"
        data-tour-plan-service-card
        ${hasDetails ? `data-tour-plan-service-has-details="1"` : ""}
        ${swappable ? `data-tour-plan-service-swap role="button" tabindex="0" aria-label="${escapeAttr(swapLabel)}"` : ""}
      >
        ${imageMarkup}
        ${hasDetails ? `
          <span class="tour-plan-service-card__details-indicator"${featured ? ` data-tour-plan-service-details-toggle role="button" tabindex="0" aria-pressed="false" aria-label="${escapeAttr(detailsLabel)}"` : ""}>
            <span class="tour-plan-service-card__details-icon" aria-hidden="true"></span>
            <span class="tour-plan-service-card__details-text">${escapeHTML(detailsBadgeLabel)}</span>
          </span>
        ` : ""}
        ${body}
      </article>
    `;
  }

  function tourPlanServiceImageEntries(services) {
    return (Array.isArray(services) ? services : []).flatMap((service, index) => (
      tourPlanServiceImages(service).map((image) => ({
        service,
        index,
        image,
        src: tourPlanImageSrc(image)
      }))
    ));
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
          ${sideEntries.map(({ service, image }) => renderTourPlanServiceCard(service, "tour-plan-service-card--small", { swappable: true, image })).join("")}
        </div>`
      : "";

    return {
      markup: `
        <div class="tour-plan-service-media${sideEntries.length ? "" : " tour-plan-service-media--single"}" data-tour-plan-service-media>
          ${renderTourPlanServiceCard(featured.service, "tour-plan-service-card--featured", {
            featured: true,
            image: featured.image
          })}
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

  function normalizeExperienceHighlightId(value) {
    return normalizeText(value).toLowerCase().replace(/[-\s]+/g, "_");
  }

  function experienceHighlightAssetSrc(imagePath) {
    const cleanPath = normalizeText(imagePath).replace(/^\/+/, "");
    if (!cleanPath) return "";
    if (cleanPath.startsWith("assets/")) return `/${cleanPath}`;
    return `${EXPERIENCE_HIGHLIGHTS_BASE_PATH}/${cleanPath.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
  }

  function fallbackExperienceHighlightTitle(id) {
    const normalizedId = normalizeExperienceHighlightId(id);
    if (!normalizedId) return "";
    return normalizedId
      .split("_")
      .map((part) => part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : "")
      .filter(Boolean)
      .join(" ");
  }

  function normalizeExperienceHighlightItem(item) {
    const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
    const id = normalizeExperienceHighlightId(source.id);
    const catalogItem = TOUR_EXPERIENCE_HIGHLIGHT_BY_ID.get(id);
    const title = normalizeText(source.title) || normalizeText(catalogItem?.title) || fallbackExperienceHighlightTitle(id);
    const src = normalizeText(source.image_src || source.src)
      || experienceHighlightAssetSrc(source.image || catalogItem?.image);
    if (!id || !title || !src) return null;
    return { id, title, src };
  }

  function configuredTourExperienceHighlightIds(trip) {
    const seen = new Set();
    const sources = [
      trip?.one_pager_experience_highlight_ids,
      trip?.experience_highlight_ids,
      trip?.travel_plan?.one_pager_experience_highlight_ids,
      trip?.travel_plan?.experience_highlight_ids
    ];
    return sources
      .flatMap((source) => Array.isArray(source) ? source : [])
      .map((value) => normalizeExperienceHighlightId(value))
      .filter((id) => {
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, TOUR_EXPERIENCE_HIGHLIGHT_LIMIT);
  }

  function stableHash(value) {
    let hash = 2166136261;
    const text = String(value ?? "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function completeTourExperienceHighlights(trip, highlights) {
    const seen = new Set();
    const selectedHighlights = [];
    for (const highlight of Array.isArray(highlights) ? highlights : []) {
      if (!highlight?.id || seen.has(highlight.id)) continue;
      selectedHighlights.push(highlight);
      seen.add(highlight.id);
      if (selectedHighlights.length >= TOUR_EXPERIENCE_HIGHLIGHT_LIMIT) return selectedHighlights;
    }

    const tripSeed = normalizeText(trip?.id || trip?.title) || "tour";
    const randomHighlights = TOUR_EXPERIENCE_HIGHLIGHTS
      .filter((item) => item?.id && !seen.has(item.id))
      .map((item) => ({
        item,
        rank: stableHash(`${tripSeed}:${item.id}`)
      }))
      .sort((left, right) => left.rank - right.rank || left.item.id.localeCompare(right.item.id))
      .map(({ item }) => normalizeExperienceHighlightItem(item))
      .filter((item) => {
        if (!item?.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    return selectedHighlights.concat(randomHighlights).slice(0, TOUR_EXPERIENCE_HIGHLIGHT_LIMIT);
  }

  function selectedTourExperienceHighlights(trip) {
    const explicitItems = Array.isArray(trip?.one_pager_experience_highlights)
      ? trip.one_pager_experience_highlights
      : (Array.isArray(trip?.travel_plan?.one_pager_experience_highlights) ? trip.travel_plan.one_pager_experience_highlights : []);
    const normalizedExplicitItems = explicitItems
      .map((item) => normalizeExperienceHighlightItem(item))
      .filter(Boolean);
    if (normalizedExplicitItems.length) return completeTourExperienceHighlights(trip, normalizedExplicitItems);

    const configuredHighlights = configuredTourExperienceHighlightIds(trip)
      .map((id) => normalizeExperienceHighlightItem({ id }))
      .filter(Boolean);
    if (configuredHighlights.length) return completeTourExperienceHighlights(trip, configuredHighlights);

    return completeTourExperienceHighlights(trip, []);
  }

  function renderTourExperienceHighlights(trip) {
    const highlights = selectedTourExperienceHighlights(trip);
    if (!highlights.length) return "";
    const title = frontendT("tour.plan.experience_highlights_title", "Experience highlights");
    return `
      <section class="tour-plan-highlights" aria-label="${escapeAttr(title)}">
        <h3>${escapeHTML(title)}</h3>
        <div class="tour-plan-highlights__grid">
          ${highlights.map((item) => `
            <article class="tour-plan-highlight">
              <img class="tour-plan-highlight__icon" src="${escapeAttr(item.src)}" alt="" aria-hidden="true" loading="lazy" width="64" height="64" />
              <h4>${escapeHTML(item.title)}</h4>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function tourOnePagerPdfUrl(trip) {
    const tourId = normalizeText(trip?.id);
    if (!tourId) return "";
    const lang = normalizeFrontendTourLang(currentFrontendLang());
    return `/public/v1/tours/${encodeURIComponent(tourId)}/one-pager.pdf?lang=${encodeURIComponent(lang)}`;
  }

  function renderTourOnePagerDownload(trip) {
    const pdfUrl = tourOnePagerPdfUrl(trip);
    if (!pdfUrl) return "";
    const pdfAriaLabel = frontendT("tour.plan.pdf_aria", "Tour PDF");
    const pdfDescription = frontendT(
      "tour.plan.pdf_description",
      "Contact information, Experience highlights, and pictures"
    );
    const pdfDownloadLabel = frontendT("tour.plan.pdf_download", "Tour Preview");
    return `
      <section class="tour-plan-pdf" aria-label="${escapeAttr(pdfAriaLabel)}">
        <div class="tour-plan-pdf__body">
          <div class="tour-plan-pdf__content">
            <a class="btn btn-secondary tour-plan-pdf__download" href="${escapeAttr(pdfUrl)}" target="_blank" rel="noopener">${escapeHTML(pdfDownloadLabel)}</a>
            <p>${escapeHTML(pdfDescription)}</p>
          </div>
        </div>
      </section>
    `;
  }

  function tourDetailsDurationLabel(days) {
    return frontendT("tour.card.days", "{days} days", {
      days: String(days.length)
    });
  }

  function renderTourDetailsHeader(trip, days) {
    const tripTitle = resolveLocalizedFrontendText(trip?.title, state.lang);
    const destinations = tourDestinations(trip).join(", ");
    const styles = (Array.isArray(trip?.styles) ? trip.styles : [])
      .map((style) => normalizeText(style))
      .filter(Boolean);
    const titleLabel = frontendT("tour.plan.details_title", "Tour Details");
    const durationLabel = frontendT("tour.plan.duration_label", "Duration");
    const destinationLabel = frontendT("filters.destination_label", "Destination");
    const destinationFallback = frontendT("filters.all_destinations", "All destinations");
    const stylesLabel = frontendT("modal.step3.styles", "Travel styles");

    return `
      <section class="tour-details-overview" aria-label="${escapeAttr(titleLabel)}">
        <p class="tour-details-overview__kicker">${escapeHTML(titleLabel)}</p>
        <h2>${escapeHTML(tripTitle)}</h2>
        <div class="tour-details-overview__facts">
          <div class="tour-details-overview__fact">
            <span>${escapeHTML(durationLabel)}</span>
            <strong>${escapeHTML(tourDetailsDurationLabel(days))}</strong>
          </div>
          <div class="tour-details-overview__fact">
            <span>${escapeHTML(destinationLabel)}</span>
            <strong>${escapeHTML(destinations || destinationFallback)}</strong>
          </div>
          ${styles.length ? `
            <div class="tour-details-overview__styles">
              <span>${escapeHTML(stylesLabel)}</span>
              <div class="tour-details-overview__style-list">
                ${styles.map((style) => `
                  <span class="tour-details-overview__style">${escapeHTML(style)}</span>
                `).join("")}
              </div>
            </div>
          ` : ""}
        </div>
      </section>
    `;
  }

  function tourPlanSummaryDayDetailsId(tripId, index) {
    return `${tourDetailsPanelId(tripId)}-day-${index + 1}-details`;
  }

  function tourPlanDayHeading(day, index) {
    const dayNumber = Math.max(1, Number.parseInt(day?.day_number, 10) || index + 1);
    const dayTitle = resolveTravelPlanField(day, "title");
    const dayLabel = frontendT("tour.plan.day_label", "Day {day}", {
      day: String(dayNumber)
    });
    return {
      dayNumber,
      dayTitle,
      dayLabel,
      heading: dayTitle || dayLabel
    };
  }

  function tourPlanDayBadgeLabel(dayNumber) {
    const dayLabel = compactText(frontendT("tour.plan.day_label", "Day {day}", {
      day: String(dayNumber)
    }));
    const withoutNumber = compactText(dayLabel.replace(String(dayNumber), ""));
    return withoutNumber || frontendT("tour.plan.summary_day_badge", "Day");
  }

  function tourPlanDaySummaryText(day) {
    const notes = resolveTravelPlanField(day, "notes");
    if (notes) {
      return {
        text: compactText(stripLeadingBulletMarkers(notes)),
        fullText: compactText(stripLeadingBulletMarkers(notes)),
        isTruncated: false,
        source: "notes"
      };
    }
    const serviceLine = (Array.isArray(day?.services) ? day.services : [])
      .map((service) => formatTourPlanServiceLine(service))
      .find((line) => line?.text);
    return serviceLine
      ? { ...serviceLine, source: "service" }
      : { text: "", fullText: "", isTruncated: false, source: "empty" };
  }

  function renderTourPlanDayContent(day, options = {}) {
    const { includeNotes = true } = options;
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
          : "")
      : "";
    const notesMarkup = includeNotes && notes
      ? `<p class="tour-plan-day__notes">${escapeHTML(notes)}</p>`
      : "";
    return [
      notesMarkup,
      serviceMedia.markup,
      textServiceMarkup,
      legacyServiceList
    ].filter(Boolean).join("");
  }

  function renderTourPlanDaySummary(days, tripId) {
    if (!days.length) return "";
    const durationLabel = tourDetailsDurationLabel(days);
    const headingLabel = frontendT("tour.plan.summary_heading", "Your itinerary for {duration}", {
      duration: durationLabel
    });
    return `
      <section class="tour-plan-summary" aria-label="${escapeAttr(headingLabel)}" data-tour-plan-summary>
        <div class="tour-plan-summary__header">
          <h4>${escapeHTML(headingLabel)}</h4>
        </div>
        <div class="tour-plan-summary__list">
          ${days.map((day, index) => {
            const { dayNumber, dayTitle, dayLabel, heading } = tourPlanDayHeading(day, index);
            const summary = tourPlanDaySummaryText(day);
            const detailsId = tourPlanSummaryDayDetailsId(tripId, index);
            const detailsMarkup = renderTourPlanDayContent(day);
            const controlsAttr = detailsMarkup ? ` aria-controls="${escapeAttr(detailsId)}"` : "";
            return `
              <article class="tour-plan-summary-day" data-tour-plan-summary-day>
                <button class="tour-plan-summary-day__toggle" type="button" data-tour-plan-summary-toggle${controlsAttr} aria-expanded="false">
                  <span class="tour-plan-summary-day__label">${escapeHTML(dayLabel)}</span>
                  <span class="tour-plan-summary-day__body">
                    <strong>${escapeHTML(dayTitle || heading)}</strong>
                  </span>
                  <span class="tour-plan-summary-day__chevron" aria-hidden="true"></span>
                </button>
                ${detailsMarkup ? `
                  <div class="tour-plan-summary-day__details" id="${escapeAttr(detailsId)}" data-tour-plan-summary-details hidden>
                    <div class="tour-plan-day__body">
                      ${detailsMarkup}
                    </div>
                  </div>
                ` : ""}
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderTourTravelPlanDetails(trip) {
    const days = travelPlanDays(trip);
    if (!days.length) {
      return `
        <div class="tour-plan--empty">
          <p>${escapeHTML(frontendT("tour.plan.no_days", "No travel plan days listed yet."))}</p>
        </div>
      `;
    }

    const tripId = normalizeText(trip?.id);
    const ctaLabel = frontendT("tour.card.plan_trip", "Plan this trip");

    return `
      ${renderTourDetailsHeader(trip, days)}
      ${renderTourExperienceHighlights(trip)}
      ${renderTourOnePagerDownload(trip)}
      ${renderTourPlanDaySummary(days, tripId)}
      <div class="tour-plan__footer-cta">
        <button class="btn btn-primary tour-plan__footer-plan-trip" type="button" data-open-modal data-trip-id="${escapeAttr(tripId)}">${escapeHTML(ctaLabel)}</button>
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
    const isOpeningTour = openingTourColumnIndexes.has(tripId);
    const initialColumnIndex = isOpeningTour
      ? openingTourColumnIndexes.get(tripId)
      : 0;
    const columnCount = Math.min(Math.max(1, renderedTourGridColumnCount), 3);
    const column = Math.min(Math.max(1, Number(initialColumnIndex ?? columnIndex) + 1), Math.max(1, columnCount));
    const openingClass = isOpeningTour && columnCount > 1 ? " tour-details-row--opening" : "";
    const openingInitialHeight = Math.max(0, Math.ceil(Number(openingTourInitialHeights.get(tripId)) || 0));
    const cardHeightStyle = openingInitialHeight > 0
      ? ` --tour-details-card-open-height: ${openingInitialHeight}px;`
      : "";
    const mobileOpeningStyle = isOpeningTour && columnCount === 1 && openingInitialHeight > 0
      ? ` height: ${openingInitialHeight}px; overflow: hidden; opacity: 1;`
      : "";
    const sidePanelClass = columnCount > 1
      ? ` tour-details-row--side-panel tour-details-row--columns-${columnCount}${isOpeningTour ? "" : " tour-details-row--attached"}`
      : "";
    return `
      <article
        class="tour-details-row${openingClass}${sidePanelClass}"
        data-expanded-tour-id="${escapeAttr(tripId)}"
        style="--tour-grid-columns: ${columnCount}; --tour-details-column: ${column};${cardHeightStyle}${mobileOpeningStyle}"
      >
        <div class="tour-details-row__shell">
          ${renderTourCard(trip, { index, expanded: true })}
          <aside class="tour-details-row__panel" id="${escapeAttr(panelId)}" aria-label="${escapeAttr(panelLabel)}">
            ${renderTourDetailsCloseButton(tripId)}
            ${renderTourTravelPlanDetails(trip)}
          </aside>
        </div>
      </article>
    `;
  }

  function renderTwoColumnBelowTourDetailsRow(trip, columnIndex = 0) {
    const tripId = normalizeText(trip?.id);
    const panelId = tourDetailsPanelId(tripId);
    const tripTitle = resolveLocalizedFrontendText(trip?.title, state.lang);
    const panelLabel = frontendT("tour.plan.panel_label", "Travel plan for {title}", {
      title: tripTitle
    });
    const column = Math.min(Math.max(1, Number(columnIndex ?? 0) + 1), 2);
    return `
      <article
        class="tour-details-row tour-details-row--below-grid tour-details-row--columns-2"
        data-expanded-tour-id="${escapeAttr(tripId)}"
        style="--tour-grid-columns: 2; --tour-details-column: ${column};"
      >
        <div class="tour-details-row__shell">
          <aside class="tour-details-row__panel" id="${escapeAttr(panelId)}" aria-label="${escapeAttr(panelLabel)}">
            ${renderTourDetailsCloseButton(tripId)}
            ${renderTourTravelPlanDetails(trip)}
          </aside>
        </div>
      </article>
    `;
  }

  function createTourDetailsPanelElement(trip) {
    const tripId = normalizeText(trip?.id);
    const tripTitle = resolveLocalizedFrontendText(trip?.title, state.lang);
    const panelLabel = frontendT("tour.plan.panel_label", "Travel plan for {title}", {
      title: tripTitle
    });
    const panel = document.createElement("aside");
    panel.className = "tour-details-row__panel";
    panel.id = tourDetailsPanelId(tripId);
    panel.setAttribute("aria-label", panelLabel);
    panel.innerHTML = `${renderTourDetailsCloseButton(tripId)}${renderTourTravelPlanDetails(trip)}`;
    return panel;
  }

  function createSingleColumnTourDetailsRow(trip, card) {
    const tripId = normalizeText(trip?.id);
    const row = document.createElement("article");
    row.className = "tour-details-row";
    row.dataset.expandedTourId = tripId;
    row.style.setProperty("--tour-grid-columns", "1");
    row.style.setProperty("--tour-details-column", "1");

    const shell = document.createElement("div");
    shell.className = "tour-details-row__shell";
    const panel = createTourDetailsPanelElement(trip);
    row.append(shell);
    card.replaceWith(row);
    shell.append(card, panel);
    return row;
  }

  function directTourCardElement(tripId) {
    const card = tourCardElement(tripId);
    return card instanceof HTMLElement && card.parentElement === els.tourGrid ? card : null;
  }

  function visibleTourIndexForTrip(tripId) {
    const normalizedTripId = normalizeText(tripId);
    if (!normalizedTripId) return -1;
    return state.filteredTrips
      .slice(0, state.visibleToursCount)
      .findIndex((trip) => normalizeText(trip?.id) === normalizedTripId);
  }

  function visibleTourRowTripIds(tripId, columnCount = getTourGridColumnCount()) {
    const visibleTrips = state.filteredTrips.slice(0, state.visibleToursCount);
    const visibleIndex = visibleTourIndexForTrip(tripId);
    if (visibleIndex < 0) return [];
    const columns = Math.max(1, Number(columnCount) || 1);
    const rowStart = Math.floor(visibleIndex / columns) * columns;
    return visibleTrips
      .slice(rowStart, rowStart + columns)
      .map((trip) => normalizeText(trip?.id))
      .filter(Boolean);
  }

  function createTourGridSpacerElement(tripId) {
    const spacer = document.createElement("div");
    spacer.className = "tour-grid__spacer";
    spacer.setAttribute("aria-hidden", "true");
    spacer.dataset.tourDetailsSpacerFor = normalizeText(tripId);
    return spacer;
  }

  function removeTourDetailsGridSpacers(tripId) {
    if (!(els.tourGrid instanceof HTMLElement)) return;
    const normalizedTripId = normalizeText(tripId);
    Array.from(els.tourGrid.querySelectorAll(".tour-grid__spacer[data-tour-details-spacer-for]"))
      .forEach((spacer) => {
        if (!(spacer instanceof HTMLElement)) return;
        if (normalizeText(spacer.dataset.tourDetailsSpacerFor) === normalizedTripId) {
          spacer.remove();
        }
      });
  }

  function visibleTourTripIds() {
    return state.filteredTrips
      .slice(0, state.visibleToursCount)
      .map((trip) => normalizeText(trip?.id))
      .filter(Boolean);
  }

  function compactClosedTourGridCards() {
    if (!(els.tourGrid instanceof HTMLElement)) return [];
    if (els.tourGrid.querySelector("[data-expanded-tour-id]")) return [];

    Array.from(els.tourGrid.querySelectorAll(".tour-grid__spacer"))
      .forEach((spacer) => spacer.remove());

    const movedTripIds = [];
    visibleTourTripIds().forEach((tripId) => {
      const card = directTourCardElement(tripId);
      if (!(card instanceof HTMLElement)) return;
      els.tourGrid.append(card);
      movedTripIds.push(tripId);
    });
    return movedTripIds;
  }

  function isTwoCardWrappedTourRow(row) {
    return tourDetailsWrapsBelowCard(row)
      && getTourGridColumnCount() === 2
      && visibleTourTripIds().length === 2;
  }

  function shouldCompactCloseWithoutGridAnimation(row) {
    return isTwoCardWrappedTourRow(row);
  }

  function insertTourDetailsGridSpacers(rowTripIds, tripId, columnCount) {
    if (!(els.tourGrid instanceof HTMLElement)) return;
    const normalizedTripId = normalizeText(tripId);
    removeTourDetailsGridSpacers(normalizedTripId);
    const expandedIds = expandedTourIdSet();
    const normalCards = (Array.isArray(rowTripIds) ? rowTripIds : [])
      .filter((rowTripId) => rowTripId && rowTripId !== normalizedTripId && !expandedIds.has(rowTripId))
      .map((rowTripId) => directTourCardElement(rowTripId))
      .filter((card) => card instanceof HTMLElement);
    if (!normalCards.length) return;

    const spacerCount = Math.max(0, (Math.max(1, Number(columnCount) || 1) - normalCards.length));
    let anchor = normalCards[normalCards.length - 1];
    for (let index = 0; index < spacerCount; index += 1) {
      const spacer = createTourGridSpacerElement(normalizedTripId);
      anchor.after(spacer);
      anchor = spacer;
    }
  }

  function createSidePanelTourDetailsRow(trip, card, { columnIndex = 0, columnCount = getTourGridColumnCount(), initialCardHeight = 0 } = {}) {
    if (!(els.tourGrid instanceof HTMLElement) || !(card instanceof HTMLElement)) return null;
    const tripId = normalizeText(trip?.id);
    if (!tripId) return null;
    const columns = Math.min(Math.max(1, Number(columnCount) || 1), 3);
    const column = Math.min(Math.max(1, Number(columnIndex ?? 0) + 1), Math.max(1, columns));
    const rowTripIds = visibleTourRowTripIds(tripId, columns);
    const anchor = rowTripIds.map((rowTripId) => directTourCardElement(rowTripId)).find((item) => item instanceof HTMLElement) || card;

    const row = document.createElement("article");
    row.className = `tour-details-row tour-details-row--side-panel tour-details-row--columns-${columns}`;
    row.dataset.expandedTourId = tripId;
    if (columns === 2) {
      row.classList.add("tour-details-row--attached");
    }
    row.style.setProperty("--tour-grid-columns", String(columns));
    row.style.setProperty("--tour-details-column", String(column));
    const cardHeight = Math.max(0, Math.ceil(Number(initialCardHeight) || 0));
    if (cardHeight > 0) {
      row.style.setProperty("--tour-details-card-open-height", `${cardHeight}px`);
    }

    const shell = document.createElement("div");
    shell.className = "tour-details-row__shell";
    const panel = createTourDetailsPanelElement(trip);
    row.append(shell);
    els.tourGrid.insertBefore(row, anchor);
    shell.append(card, panel);
    insertTourDetailsGridSpacers(rowTripIds, tripId, columns);
    return row;
  }

  function createTwoColumnBelowTourDetailsRow(trip, { columnIndex = 0 } = {}) {
    if (!(els.tourGrid instanceof HTMLElement)) return null;
    const tripId = normalizeText(trip?.id);
    if (!tripId) return null;
    const rowTripIds = visibleTourRowTripIds(tripId, 2);
    const rowCards = rowTripIds
      .map((rowTripId) => directTourCardElement(rowTripId))
      .filter((candidate) => candidate instanceof HTMLElement);
    const anchor = rowCards[rowCards.length - 1] || directTourCardElement(tripId);
    if (!(anchor instanceof HTMLElement)) return null;
    const column = Math.min(Math.max(1, Number(columnIndex ?? 0) + 1), 2);

    const row = document.createElement("article");
    row.className = "tour-details-row tour-details-row--below-grid tour-details-row--columns-2";
    row.dataset.expandedTourId = tripId;
    row.style.setProperty("--tour-grid-columns", "2");
    row.style.setProperty("--tour-details-column", String(column));

    const shell = document.createElement("div");
    shell.className = "tour-details-row__shell";
    const panel = createTourDetailsPanelElement(trip);
    row.append(shell);
    shell.append(panel);
    anchor.after(row);
    return row;
  }

  function restoreExpandedTourCardToGrid(row, card, tripId) {
    if (!(els.tourGrid instanceof HTMLElement) || !(row instanceof HTMLElement) || !(card instanceof HTMLElement)) return;
    const normalizedTripId = normalizeText(tripId);
    removeTourDetailsGridSpacers(normalizedTripId);
    const visibleIndex = visibleTourIndexForTrip(normalizedTripId);
    const visibleTrips = state.filteredTrips.slice(0, state.visibleToursCount);
    const reference = visibleTrips
      .slice(Math.max(0, visibleIndex + 1))
      .map((trip) => directTourCardElement(normalizeText(trip?.id)))
      .find((candidate) => candidate instanceof HTMLElement);
    if (reference instanceof HTMLElement) {
      els.tourGrid.insertBefore(card, reference);
    } else {
      els.tourGrid.append(card);
    }
    row.remove();
  }

  function setTourCardExpandedDomState(card, expanded) {
    if (!(card instanceof HTMLElement)) return null;
    const tripId = normalizeText(card.getAttribute("data-tour-card-id"));
    card.classList.toggle("tour-card--expanded", expanded);
    if (!expanded) {
      card.classList.remove("tour-card--details-connector-visible");
    }
    const button = card.querySelector("[data-tour-card-show-more][data-trip-id]");
    if (button instanceof HTMLElement) {
      button.setAttribute("aria-expanded", expanded ? "true" : "false");
      button.setAttribute("aria-controls", tourDetailsPanelId(tripId));
    }
    return button instanceof HTMLElement ? button : null;
  }

  function renderTrips(trips, { showNoResults = false } = {}) {
    if (!els.tourGrid) return;
    bindTourGridResizeHandler();

    if (!trips.length) {
      els.tourGrid.innerHTML = "";
      els.noResultsMessage.hidden = !showNoResults;
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

      if (renderedTourGridColumnCount === 2) {
        parts.push(...row.map(({ trip, index: itemIndex }) => (
          renderTourCard(trip, { index: itemIndex, expanded: isTourExpanded(trip) })
        )));
        parts.push(...expandedItems.map(({ trip }) => {
          const columnIndex = row.findIndex((item) => normalizeText(item.trip?.id) === normalizeText(trip?.id));
          return renderTwoColumnBelowTourDetailsRow(trip, columnIndex);
        }));
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
    scheduleTourDetailsConnectorVisibilityUpdate();
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        fitTourCardDescriptions();
        syncExpandedTourDetailsHeights();
        scheduleTourDetailsConnectorVisibilityUpdate();
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

    const imageSwipeSurfaces = els.tourGrid.querySelectorAll("[data-tour-media-track]");
    imageSwipeSurfaces.forEach((track) => {
      const surface = track instanceof HTMLElement ? track.closest(".tour-card__media-cycle") : null;
      bindTourCardImageSwipeHandlers(surface);
    });
    syncTourCardImageSwipeSurfaces();

    const showMoreButtons = els.tourGrid.querySelectorAll("[data-tour-card-show-more][data-trip-id]");
    showMoreButtons.forEach((button) => {
      if (!(button instanceof HTMLElement) || button.dataset.tourDetailsBound === "1") return;
      button.addEventListener("click", async (event) => {
        const tripId = normalizeText(button.getAttribute("data-trip-id"));
        const trip = findTripById(tripId);
        if (!trip || !hasTravelPlanDays(trip)) return;
        event.preventDefault();
        if (button.dataset.tourDetailsLoading === "1") return;
        const willOpen = !expandedTourIdSet().has(tripId);
        if (willOpen) {
          button.dataset.tourDetailsLoading = "1";
          button.setAttribute("aria-disabled", "true");
          const loadedTrip = await ensureTourDetailsLoaded(tripId);
          delete button.dataset.tourDetailsLoading;
          button.removeAttribute("aria-disabled");
          if (!loadedTrip || !hasTravelPlanDays(loadedTrip)) return;
        }
        animateTourDetailsToggle(tripId, willOpen);
      });
      button.dataset.tourDetailsBound = "1";
    });

    const serviceMediaGroups = els.tourGrid.querySelectorAll("[data-tour-plan-service-media]");
    serviceMediaGroups.forEach((media) => {
      if (!(media instanceof HTMLElement) || media.dataset.tourPlanServiceMediaBound === "1") return;
      media.addEventListener("click", handleTourPlanServiceMediaClick);
      media.addEventListener("keydown", handleTourPlanServiceMediaKeydown);
      media.dataset.tourPlanServiceMediaBound = "1";
      normalizeTourPlanServiceMedia(media);
    });

    const daySummaryButtons = els.tourGrid.querySelectorAll("[data-tour-plan-summary-toggle]");
    daySummaryButtons.forEach((button) => {
      if (!(button instanceof HTMLElement) || button.dataset.tourPlanSummaryBound === "1") return;
      button.addEventListener("click", () => {
        toggleTourPlanSummaryDay(button);
      });
      button.dataset.tourPlanSummaryBound = "1";
    });

    const tourDetailsCloseButtons = els.tourGrid.querySelectorAll("[data-tour-details-close][data-trip-id]");
    tourDetailsCloseButtons.forEach((button) => {
      if (!(button instanceof HTMLElement) || button.dataset.tourDetailsCloseBound === "1") return;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const tripId = normalizeText(button.getAttribute("data-trip-id"));
        if (!tripId || !expandedTourIdSet().has(tripId)) return;
        animateTourDetailsToggle(tripId, false);
      });
      button.dataset.tourDetailsCloseBound = "1";
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

  function focusTourShowMoreButton(tripId) {
    if (isSingleColumnTourLayout()) return;
    const button = tourShowMoreButton(tripId);
    if (button instanceof HTMLElement) {
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
      const visibleSlide = card.querySelector(".tour-card__media-slide.is-active");
      const visibleImage = visibleLayer instanceof HTMLImageElement ? visibleLayer : visibleSlide;
      if (!(visibleImage instanceof HTMLImageElement)) return;
      const imageSrc = normalizeText(visibleImage.currentSrc || visibleImage.src || visibleImage.getAttribute("src"));
      if (!imageSrc) return;
      const computedStyle = window.getComputedStyle?.(visibleImage);
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

      const activeImage = card.querySelector(".tour-card__media-layer.is-active")
        || card.querySelector(".tour-card__media-slide.is-active");
      scheduleTourCardMediaSnapshotClear(mediaStage, activeImage);
    });
  }

  function waitForAnimationFrame() {
    return new Promise((resolve) => {
      window.requestAnimationFrame(resolve);
    });
  }

  function waitForImageReady(image) {
    if (!(image instanceof HTMLImageElement)) return Promise.resolve();
    image.loading = "eager";
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      let timer = 0;
      const done = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        image.removeEventListener("load", done);
        image.removeEventListener("error", done);
        resolve();
      };

      image.addEventListener("load", done, { once: true });
      image.addEventListener("error", done, { once: true });
      if (typeof image.decode === "function") {
        image.decode().then(done).catch(() => {});
      }
      timer = window.setTimeout(done, TOUR_DETAILS_IMAGE_READY_TIMEOUT_MS);
    });
  }

  async function waitForExpandedTourServiceImages(row) {
    if (!(row instanceof HTMLElement)) return;
    const images = Array.from(row.querySelectorAll("[data-tour-plan-service-media] img"))
      .filter((image) => image instanceof HTMLImageElement);
    if (!images.length) return;
    await Promise.all(images.map((image) => waitForImageReady(image)));
    await waitForAnimationFrame();
  }

  function parseCssDurationToMs(value) {
    const normalizedValue = normalizeText(value).toLowerCase();
    if (!normalizedValue) return 0;
    if (normalizedValue.endsWith("ms")) {
      return Number.parseFloat(normalizedValue.slice(0, -2)) || 0;
    }
    if (normalizedValue.endsWith("s")) {
      return (Number.parseFloat(normalizedValue.slice(0, -1)) || 0) * 1000;
    }
    return Number.parseFloat(normalizedValue) || 0;
  }

  function tourCardImageTransitionDurationMs(button) {
    if (!(button instanceof HTMLElement) || !window.getComputedStyle) {
      return TOUR_IMAGE_TRANSITION_MS;
    }
    const cssDurationMs = parseCssDurationToMs(
      window.getComputedStyle(button).getPropertyValue("--tour-card-image-transition-duration")
    );
    return cssDurationMs > 0 ? cssDurationMs : TOUR_IMAGE_TRANSITION_MS;
  }

  function waitForTourCardImageReady(image, src) {
    const normalizedSrc = normalizeText(src);
    if (!(image instanceof HTMLImageElement) || !normalizedSrc) return Promise.resolve(false);

    return new Promise((resolve) => {
      let settled = false;
      let timeout = 0;
      const finish = (isReady) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        image.onload = null;
        image.onerror = null;
        resolve(Boolean(isReady));
      };
      const finishAfterDecode = () => {
        if (typeof image.decode === "function") {
          image.decode().then(() => finish(true)).catch(() => finish(true));
          return;
        }
        finish(true);
      };

      image.decoding = "async";
      image.loading = "eager";
      image.onload = finishAfterDecode;
      image.onerror = () => finish(false);
      timeout = window.setTimeout(() => finish(false), 5000);
      image.src = normalizedSrc;
      if (image.complete) {
        if (image.naturalWidth > 0) {
          finishAfterDecode();
        } else {
          finish(false);
        }
      }
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
    ghost.dataset.tourDetailsGhost = "1";
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
          { opacity: 1, transform: "translateY(0)", clipPath: "inset(0 0 0 0)" },
          { opacity: 0, transform: "translateY(-0.4rem)", clipPath: "inset(0 0 100% 0)" }
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
      duration: TOUR_DETAILS_DESKTOP_CLOSE_TRANSITION_MS,
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
      timer = window.setTimeout(done, TOUR_DETAILS_DESKTOP_CLOSE_TRANSITION_MS + 140);
    });
  }

  function cancelElementAnimations(element, { subtree = false } = {}) {
    if (!(element instanceof Element) || typeof element.getAnimations !== "function") return;
    element.getAnimations({ subtree }).forEach((animation) => {
      try {
        animation.cancel();
      } catch (_error) {
        // Best effort: stale async paths are also ignored through transition tokens.
      }
    });
  }

  function cancelActiveTourDetailsAnimations() {
    if (els.tourGrid instanceof HTMLElement) {
      const animatedElements = els.tourGrid.querySelectorAll([
        ".tour-details-row",
        ".tour-details-row__attach-background",
        ".tour-details-row__shell",
        ".tour-details-row__panel",
        "[data-tour-card-id]"
      ].join(","));
      animatedElements.forEach((element) => cancelElementAnimations(element));
      els.tourGrid
        .querySelectorAll("[data-tour-card-show-more-label]")
        .forEach((label) => cancelElementAnimations(label, { subtree: true }));
    }

    document.querySelectorAll("[data-tour-details-ghost]").forEach((ghost) => {
      cancelElementAnimations(ghost, { subtree: true });
      ghost.remove();
    });
  }

  function beginTourDetailsTransition() {
    const token = ++tourDetailsTransitionToken;
    openingTourColumnIndexes.clear();
    openingTourInitialHeights.clear();
    cancelActiveTourDetailsAnimations();
    return token;
  }

  function isCurrentTourDetailsTransition(token) {
    return token === tourDetailsTransitionToken;
  }

  function completeTourDetailsTransition(token, tripId) {
    if (!isCurrentTourDetailsTransition(token)) return false;
    focusTourShowMoreButton(tripId);
    return true;
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
      return Promise.resolve();
    }

    const card = row.classList.contains("tour-details-row--side-panel")
      ? expandedTourCard(row)
      : expandedTourShell(row);
    if (!(card instanceof HTMLElement)) {
      row.style.setProperty("--tour-details-column", "1");
      return Promise.resolve();
    }

    const previousRect = card.getBoundingClientRect();
    row.style.setProperty("--tour-details-column", "1");
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
        duration: TOUR_DETAILS_OPEN_TRANSITION_MS,
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

  function finishTourShellAttachAnimation(shell, background, animation, durationMs) {
    return new Promise((resolve) => {
      let finished = false;
      let timer = 0;
      const done = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        animation?.removeEventListener?.("finish", done);
        animation?.removeEventListener?.("cancel", done);
        background?.remove();
        shell.style.background = "";
        resolve();
      };

      animation?.addEventListener?.("finish", done, { once: true });
      animation?.addEventListener?.("cancel", done, { once: true });
      timer = window.setTimeout(done, durationMs + 140);
    });
  }

  function expandedTourBackgroundStartLeftInset(shell, card) {
    if (!(shell instanceof HTMLElement) || !(card instanceof HTMLElement)) return 0;

    const shellRect = shell.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const shellWidth = Math.max(0, Math.ceil(shellRect.width));
    if (shellWidth <= 0) return 0;
    return Math.min(shellWidth, Math.max(0, Math.ceil(cardRect.right - shellRect.left)));
  }

  function expandedTourDetailsPanelStartLeftInset(row, initialCardRight) {
    const panel = expandedTourDetailsPanel(row);
    if (!(panel instanceof HTMLElement)) return null;
    const panelRect = panel.getBoundingClientRect();
    const panelWidth = Math.max(0, Math.ceil(panelRect.width));
    if (panelWidth <= 0) return null;
    return Math.min(panelWidth, Math.max(0, Math.ceil((Number(initialCardRight) || 0) - panelRect.left)));
  }

  function createTourDetailsAttachBackground(shell, startLeftInset) {
    if (!(shell instanceof HTMLElement)) return null;
    const background = document.createElement("span");
    background.className = "tour-details-row__attach-background";
    background.setAttribute("aria-hidden", "true");
    background.style.clipPath = `inset(0 0 0 ${Math.max(0, Math.ceil(Number(startLeftInset) || 0))}px)`;
    shell.prepend(background);
    return background;
  }

  async function animateExpandedTourDetailsAttach(row, durationMs = TOUR_DETAILS_OPEN_TRANSITION_MS, { backgroundStartLeft, initialCardRight } = {}) {
    if (!(row instanceof HTMLElement) || !row.classList.contains("tour-details-row--side-panel")) {
      return;
    }
    if (row.classList.contains("tour-details-row--attached")) return;

    const shell = expandedTourShell(row);
    const card = expandedTourCard(row);
    if (!(shell instanceof HTMLElement) || !(card instanceof HTMLElement)) {
      row.classList.add("tour-details-row--attached");
      return;
    }

    const startLeftInset = Number.isFinite(Number(backgroundStartLeft))
      ? Math.max(0, Math.ceil(Number(backgroundStartLeft)))
      : expandedTourBackgroundStartLeftInset(shell, card);
    const startClipPath = `inset(0 0 0 ${startLeftInset}px)`;
    const endClipPath = "inset(0 0 0 0)";

    shell.style.background = "transparent";
    row.classList.add("tour-details-row--attached");
    const panelStartLeftInset = expandedTourDetailsPanelStartLeftInset(row, initialCardRight);
    if (panelStartLeftInset !== null) {
      row.style.setProperty("--tour-details-panel-open-left-inset", `${panelStartLeftInset}px`);
    }
    const background = createTourDetailsAttachBackground(shell, startLeftInset);
    void shell.offsetWidth;
    await waitForAnimationFrame();

    if (!(background instanceof HTMLElement) || typeof background.animate !== "function" || startLeftInset < 1) {
      background?.remove();
      shell.style.background = "";
      return;
    }

    background.style.willChange = "clip-path";
    const animation = background.animate(
      [
        { clipPath: startClipPath },
        { clipPath: endClipPath }
      ],
      {
        duration: Math.max(0, Number(durationMs) || TOUR_DETAILS_OPEN_TRANSITION_MS),
        easing: "cubic-bezier(0.2, 0.82, 0.2, 1)",
        fill: "both"
      }
    );

    await finishTourShellAttachAnimation(shell, background, animation, durationMs);
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

  function isSingleColumnTourLayout() {
    return getTourGridColumnCount() === 1;
  }

  function isTwoColumnTourLayout() {
    return getTourGridColumnCount() === 2;
  }

  function expandedTourDetailsPanel(row) {
    return row?.querySelector?.(".tour-details-row__panel") || null;
  }

  function scrollExpandedTourDetailsIntoView(tripId, { behavior = "smooth" } = {}) {
    const panel = expandedTourDetailsPanel(expandedTourRow(tripId));
    if (!(panel instanceof HTMLElement)) return Promise.resolve(false);

    const visibleTop = stickyHeaderBottomOffset() + TOUR_CARD_SCROLL_MARGIN_PX;
    const rect = panel.getBoundingClientRect();
    const targetY = window.scrollY + rect.top - visibleTop;
    return scrollWindowToY(targetY, behavior).then(() => true);
  }

  function expandedTourCard(row) {
    return expandedTourShell(row)?.querySelector?.(".tour-card") || null;
  }

  function expandedTourOriginCard(row) {
    const nestedCard = expandedTourCard(row);
    if (nestedCard instanceof HTMLElement) return nestedCard;
    const tripId = normalizeText(row?.getAttribute?.("data-expanded-tour-id"));
    return directTourCardElement(tripId) || tourCardElement(tripId);
  }

  function tourDetailsAreBelowGrid(row) {
    return row instanceof HTMLElement
      && row.classList.contains("tour-details-row--below-grid");
  }

  function tourDetailsWrapsBelowCard(row) {
    return row instanceof HTMLElement
      && row.classList.contains("tour-details-row--side-panel")
      && row.classList.contains("tour-details-row--columns-2");
  }

  function syncExpandedTourDetailsHeight(row) {
    if (!(row instanceof HTMLElement)) return 0;
    const card = expandedTourOriginCard(row);
    const panel = expandedTourDetailsPanel(row);
    const shell = expandedTourShell(row);

    const cardHeight = card instanceof HTMLElement
      ? Math.max(0, Math.ceil(card.getBoundingClientRect().height))
      : 0;
    const shellHeight = shell instanceof HTMLElement
      ? Math.max(0, Math.ceil(shell.getBoundingClientRect().height))
      : 0;
    const cardWidth = card instanceof HTMLElement
      ? Math.max(0, Math.ceil(card.getBoundingClientRect().width))
      : 0;
    const shellWidth = shell instanceof HTMLElement
      ? Math.max(0, Math.ceil(shell.getBoundingClientRect().width))
      : 0;
    const panelHeight = panel instanceof HTMLElement
      ? Math.max(0, Math.ceil(panel.getBoundingClientRect().height))
      : 0;
    if (cardHeight <= 0 && panelHeight <= 0) return 0;
    const rowHeight = Math.max(cardHeight, panelHeight);
    const sidePanel = row.classList.contains("tour-details-row--side-panel");
    const wrappedPanel = tourDetailsWrapsBelowCard(row);
    const syncedHeight = wrappedPanel ? Math.max(cardHeight, shellHeight) : (sidePanel ? cardHeight : rowHeight);

    if (cardHeight > 0) {
      row.style.setProperty("--tour-details-card-height", `${cardHeight}px`);
    }
    if (cardWidth > 0) {
      const panelMaxWidth = Math.round(cardWidth * 1.8);
      row.style.setProperty("--tour-details-card-width", `${cardWidth}px`);
      row.style.setProperty("--tour-details-panel-width", `${Math.round(cardWidth * 1.75)}px`);
      row.style.setProperty("--tour-details-panel-max-width", `${panelMaxWidth}px`);
      row.style.setProperty("--tour-details-panel-fit-width", `${shellWidth > 0 ? Math.min(panelMaxWidth, shellWidth) : panelMaxWidth}px`);
    }
    if (
      sidePanel
      && !wrappedPanel
      && !row.classList.contains("tour-details-row--opening")
      && !row.classList.contains("tour-details-row--closing")
    ) {
      row.style.height = `${syncedHeight}px`;
    }
    return syncedHeight;
  }

  function syncExpandedTourDetailsHeights() {
    if (!els.tourGrid) return;
    Array.from(els.tourGrid.querySelectorAll(".tour-details-row")).forEach((row) => {
      syncExpandedTourDetailsHeight(row);
    });
  }

  function syncExpandedTourDetailsHeightsDuring(durationMs) {
    syncExpandedTourDetailsHeights();
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;

    const start = typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
    const duration = Math.max(0, Number(durationMs) || 0);
    const tick = () => {
      syncExpandedTourDetailsHeights();
      const now = typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
      if (now - start < duration) {
        window.requestAnimationFrame(tick);
      }
    };
    window.requestAnimationFrame(tick);
  }

  function updateTourDetailsConnectorVisibility(root = els.tourGrid) {
    if (!(root instanceof HTMLElement) || typeof window === "undefined") return;
    const singleColumnLayout = isSingleColumnTourLayout();
    const cards = Array.from(root.querySelectorAll(".tour-card--expanded"));
    cards.forEach((card) => {
      if (!(card instanceof HTMLElement)) return;
      const button = card.querySelector("[data-tour-card-show-more][data-trip-id]");
      if (!singleColumnLayout || !(button instanceof HTMLElement)) {
        card.classList.remove("tour-card--details-connector-visible");
        return;
      }
      const buttonBottom = button.getBoundingClientRect().bottom;
      const distanceFromViewportBottom = window.innerHeight - buttonBottom;
      card.classList.toggle(
        "tour-card--details-connector-visible",
        distanceFromViewportBottom < TOUR_DETAILS_CONNECTOR_VIEWPORT_THRESHOLD_PX
      );
    });
  }

  function scheduleTourDetailsConnectorVisibilityUpdate(root = els.tourGrid) {
    if (!(root instanceof HTMLElement) || typeof window === "undefined") return;
    if (tourDetailsConnectorFrame) {
      window.cancelAnimationFrame(tourDetailsConnectorFrame);
    }
    tourDetailsConnectorFrame = window.requestAnimationFrame(() => {
      tourDetailsConnectorFrame = 0;
      updateTourDetailsConnectorVisibility(root);
    });
  }

  function collapsedTourDetailsHeight(row) {
    const syncedHeight = syncExpandedTourDetailsHeight(row);
    if (tourDetailsAreBelowGrid(row)) return 0;
    if (tourDetailsWrapsBelowCard(row)) {
      const card = expandedTourOriginCard(row);
      if (card instanceof HTMLElement) {
        return Math.max(0, Math.ceil(card.getBoundingClientRect().height));
      }
    }
    if (syncedHeight > 0) return syncedHeight;
    const card = expandedTourOriginCard(row);
    if (!(card instanceof HTMLElement)) return 0;
    return Math.max(0, Math.ceil(card.getBoundingClientRect().height));
  }

  function clearTourDetailsRowAnimation(row, { preserveHeight = false } = {}) {
    if (!(row instanceof HTMLElement)) return;
    row.classList.remove("tour-details-row--opening", "tour-details-row--closing");
    if (!preserveHeight) row.style.height = "";
    row.style.opacity = "";
    row.style.overflow = "";
    row.style.removeProperty("--tour-details-row-transition-duration");
    row.style.removeProperty("--tour-details-row-transition-easing");
    row.style.removeProperty("--tour-details-panel-open-left-inset");
  }

  function finishTourDetailsRowAnimation(row, durationMs = TOUR_DETAILS_TRANSITION_MS) {
    return new Promise((resolve) => {
      let finished = false;
      let timer = 0;
      const done = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        row?.removeEventListener?.("transitionend", onTransitionEnd);
        row?.removeEventListener?.("transitioncancel", onTransitionEnd);
        resolve();
      };
      const onTransitionEnd = (event) => {
        if (event.target !== row || event.propertyName !== "height") return;
        done();
      };

      row.addEventListener("transitionend", onTransitionEnd);
      row.addEventListener("transitioncancel", onTransitionEnd);
      timer = window.setTimeout(done, durationMs + 140);
    });
  }

  async function animateTourDetailsRowHeight(row, targetHeight, mode, { durationMs, easing } = {}) {
    if (!(row instanceof HTMLElement)) return;
    const opening = mode === "open";
    const fallbackDurationMs = opening ? TOUR_DETAILS_OPEN_TRANSITION_MS : TOUR_DETAILS_TRANSITION_MS;
    const customDurationMs = Number(durationMs);
    const transitionDurationMs = Number.isFinite(customDurationMs)
      ? Math.max(0, customDurationMs)
      : fallbackDurationMs;
    const transitionEasing = normalizeText(easing);
    row.classList.toggle("tour-details-row--opening", opening);
    row.classList.toggle("tour-details-row--closing", !opening);
    row.style.setProperty("--tour-details-row-transition-duration", `${transitionDurationMs}ms`);
    if (transitionEasing) {
      row.style.setProperty("--tour-details-row-transition-easing", transitionEasing);
    } else {
      row.style.removeProperty("--tour-details-row-transition-easing");
    }
    void row.offsetHeight;
    await waitForAnimationFrame();
    if (opening) {
      row.classList.remove("tour-details-row--opening");
    }
    row.style.height = `${Math.max(0, Math.ceil(targetHeight))}px`;
    await finishTourDetailsRowAnimation(row, transitionDurationMs);
  }

  function updateOutgoingTourDetailsButton(row, expanded) {
    const button = row?.querySelector?.("[data-tour-card-show-more][data-trip-id]");
    if (!(button instanceof HTMLElement)) return;
    button.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function animateTourDetailsToggle(tripId, willOpen) {
    const normalizedTripId = normalizeText(tripId);
    if (!normalizedTripId) return;

    if (isSingleColumnTourLayout()) {
      const transitionToken = beginTourDetailsTransition();
      if (willOpen) {
        animateSingleColumnTourDetailsOpen(normalizedTripId, transitionToken);
      } else {
        animateSingleColumnTourDetailsClose(normalizedTripId, transitionToken);
      }
      return;
    }

    if (isTwoColumnTourLayout()) {
      const transitionToken = beginTourDetailsTransition();
      if (willOpen) {
        animateTwoColumnBelowTourDetailsOpen(normalizedTripId, transitionToken);
      } else {
        animateTwoColumnBelowTourDetailsClose(normalizedTripId, transitionToken);
      }
      return;
    }

    if (prefersReducedMotion()) {
      const transitionToken = beginTourDetailsTransition();
      if (willOpen) {
        const trip = findTripById(normalizedTripId);
        const card = directTourCardElement(normalizedTripId);
        if (!trip || !(card instanceof HTMLElement)) {
          setTourExpanded(normalizedTripId, true);
          renderVisibleTrips();
          completeTourDetailsTransition(transitionToken, normalizedTripId);
          return;
        }
        renderedTourGridColumnCount = getTourGridColumnCount();
        const initialColumnIndex = tourGridColumnIndexForTrip(normalizedTripId);
        const initialCardHeight = Math.max(0, Math.ceil(card.getBoundingClientRect().height));
        setTourExpanded(normalizedTripId, true);
        const row = createSidePanelTourDetailsRow(trip, card, {
          columnIndex: initialColumnIndex,
          columnCount: renderedTourGridColumnCount,
          initialCardHeight
        });
        if (!(row instanceof HTMLElement)) {
          renderVisibleTrips();
          completeTourDetailsTransition(transitionToken, normalizedTripId);
          return;
        }
        row.classList.add("tour-details-row--attached");
        const openedButton = setTourCardExpandedDomState(card, true);
        setTourShowMoreButtonLabel(openedButton, tourShowMoreLabel(true));
        bindTourCardOpenHandlers();
        fitTourCardDescriptions(row);
        syncExpandedTourDetailsHeight(row);
        void scrollTourCardFullyVisible(normalizedTripId, { behavior: "auto" }).then(() => {
          completeTourDetailsTransition(transitionToken, normalizedTripId);
        });
        return;
      }

      const row = expandedTourRow(normalizedTripId);
      const card = expandedTourCard(row);
      if (!(row instanceof HTMLElement) || !(card instanceof HTMLElement)) {
        setTourExpanded(normalizedTripId, false);
        renderVisibleTrips();
        completeTourDetailsTransition(transitionToken, normalizedTripId);
        return;
      }
      const closedButton = setTourCardExpandedDomState(card, false);
      setTourShowMoreButtonLabel(closedButton, tourShowMoreLabel(false));
      setTourExpanded(normalizedTripId, false);
      restoreExpandedTourCardToGrid(row, card, normalizedTripId);
      compactClosedTourGridCards();
      bindTourCardOpenHandlers();
      fitTourCardDescriptions(card);
      syncExpandedTourDetailsHeights();
      completeTourDetailsTransition(transitionToken, normalizedTripId);
      return;
    }

    const transitionToken = beginTourDetailsTransition();
    if (willOpen) {
      animateTourDetailsOpen(normalizedTripId, transitionToken);
    } else {
      animateTourDetailsClose(normalizedTripId, transitionToken);
    }
  }

  async function animateSingleColumnTourDetailsOpen(tripId, transitionToken) {
    const trip = findTripById(tripId);
    const card = tourCardElement(tripId);
    if (!trip || !(card instanceof HTMLElement)) {
      setTourExpanded(tripId, true);
      renderVisibleTrips();
      completeTourDetailsTransition(transitionToken, tripId);
      return;
    }

    const initialCardHeight = Math.max(0, Math.ceil(card.getBoundingClientRect().height));
    setTourExpanded(tripId, true);
    const row = createSingleColumnTourDetailsRow(trip, card);
    if (initialCardHeight > 0) {
      row.style.setProperty("--tour-details-card-open-height", `${initialCardHeight}px`);
    }
    const openedButton = setTourCardExpandedDomState(card, true);
    setTourShowMoreButtonLabel(openedButton, tourShowMoreLabel(false));
    scheduleTourDetailsConnectorVisibilityUpdate(row);
    row.classList.add("tour-details-row--opening");
    row.style.height = `${initialCardHeight}px`;
    row.style.overflow = "hidden";
    row.style.opacity = "1";
    bindTourCardOpenHandlers();
    fitTourCardDescriptions(row);
    syncExpandedTourDetailsHeight(row);

    if (prefersReducedMotion()) {
      setTourShowMoreButtonLabel(openedButton, tourShowMoreLabel(true));
      clearTourDetailsRowAnimation(row);
      scheduleTourDetailsConnectorVisibilityUpdate(row);
      completeTourDetailsTransition(transitionToken, tripId);
      return;
    }

    const buttonLabelPromise = animateTourShowMoreButtonLabel(
      openedButton,
      tourShowMoreLabel(true),
      { direction: "open" }
    );
    await waitForExpandedTourServiceImages(row);
    if (!isCurrentTourDetailsTransition(transitionToken)) return;
    const expandedHeight = Math.max(row.scrollHeight, row.getBoundingClientRect().height);
    const mobileOpenTransitionMs = TOUR_DETAILS_MOBILE_OPEN_TRANSITION_MS;
    await Promise.all([
      animateTourDetailsRowHeight(row, expandedHeight, "open", {
        durationMs: mobileOpenTransitionMs,
        easing: TOUR_DETAILS_MOBILE_OPEN_EASING
      }),
      buttonLabelPromise
    ]);
    if (!isCurrentTourDetailsTransition(transitionToken)) return;
    clearTourDetailsRowAnimation(row);
    scheduleTourDetailsConnectorVisibilityUpdate(row);
    completeTourDetailsTransition(transitionToken, tripId);
  }

  async function animateSingleColumnTourDetailsClose(tripId, transitionToken) {
    const row = expandedTourRow(tripId);
    const card = tourCardElement(tripId);
    if (!(row instanceof HTMLElement) || !(card instanceof HTMLElement) || !row.contains(card)) {
      setTourExpanded(tripId, false);
      renderVisibleTrips();
      completeTourDetailsTransition(transitionToken, tripId);
      return;
    }

    const closedButton = setTourCardExpandedDomState(card, false);
    const expandedHeight = Math.max(row.scrollHeight, row.getBoundingClientRect().height);
    const collapsedHeight = Math.max(0, Math.ceil(card.getBoundingClientRect().height));
    row.classList.add("tour-details-row--closing");
    row.style.height = `${expandedHeight}px`;
    row.style.overflow = "hidden";
    row.style.opacity = "1";
    setTourShowMoreButtonLabel(closedButton, tourShowMoreLabel(true));

    if (prefersReducedMotion()) {
      setTourExpanded(tripId, false);
      setTourShowMoreButtonLabel(closedButton, tourShowMoreLabel(false));
      setTourCardExpandedDomState(card, false);
      row.replaceWith(card);
      bindTourCardOpenHandlers();
      completeTourDetailsTransition(transitionToken, tripId);
      return;
    }

    await Promise.all([
      animateTourDetailsRowHeight(row, collapsedHeight, "close", {
        durationMs: TOUR_DETAILS_CLOSE_TRANSITION_MS,
        easing: "cubic-bezier(0.2, 0.82, 0.2, 1)"
      }),
      animateTourShowMoreButtonLabel(
        closedButton,
        tourShowMoreLabel(false),
        { direction: "close" }
      )
    ]);
    if (!isCurrentTourDetailsTransition(transitionToken)) return;
    setTourExpanded(tripId, false);
    setTourCardExpandedDomState(card, false);
    row.replaceWith(card);
    bindTourCardOpenHandlers();
    fitTourCardDescriptions(card);
    completeTourDetailsTransition(transitionToken, tripId);
  }

  async function animateTwoColumnBelowTourDetailsOpen(tripId, transitionToken) {
    const trip = findTripById(tripId);
    const card = directTourCardElement(tripId);
    if (!trip || !(card instanceof HTMLElement)) {
      setTourExpanded(tripId, true);
      renderVisibleTrips();
      completeTourDetailsTransition(transitionToken, tripId);
      return;
    }

    const initialColumnIndex = tourGridColumnIndexForTrip(tripId);
    renderedTourGridColumnCount = 2;
    setTourExpanded(tripId, true);
    const row = createTwoColumnBelowTourDetailsRow(trip, {
      columnIndex: initialColumnIndex
    });
    const openedButton = setTourCardExpandedDomState(card, true);
    setTourShowMoreButtonLabel(openedButton, tourShowMoreLabel(false));

    if (!(row instanceof HTMLElement)) {
      renderVisibleTrips();
      completeTourDetailsTransition(transitionToken, tripId);
      return;
    }

    row.classList.add("tour-details-row--opening");
    row.style.height = "0px";
    row.style.overflow = "hidden";
    row.style.opacity = "1";
    bindTourCardOpenHandlers();
    fitTourCardDescriptions(card);
    syncExpandedTourDetailsHeight(row);

    if (prefersReducedMotion()) {
      setTourShowMoreButtonLabel(openedButton, tourShowMoreLabel(true));
      clearTourDetailsRowAnimation(row);
      completeTourDetailsTransition(transitionToken, tripId);
      return;
    }

    const buttonLabelPromise = animateTourShowMoreButtonLabel(
      openedButton,
      tourShowMoreLabel(true),
      { direction: "open" }
    );
    await waitForExpandedTourServiceImages(row);
    if (!isCurrentTourDetailsTransition(transitionToken)) return;
    const expandedHeight = Math.max(row.scrollHeight, row.getBoundingClientRect().height);
    await Promise.all([
      animateTourDetailsRowHeight(row, expandedHeight, "open", {
        durationMs: TOUR_DETAILS_MOBILE_OPEN_TRANSITION_MS,
        easing: TOUR_DETAILS_MOBILE_OPEN_EASING
      }),
      buttonLabelPromise
    ]);
    if (!isCurrentTourDetailsTransition(transitionToken)) return;
    clearTourDetailsRowAnimation(row);
    completeTourDetailsTransition(transitionToken, tripId);
  }

  async function animateTwoColumnBelowTourDetailsClose(tripId, transitionToken) {
    const row = expandedTourRow(tripId);
    const card = directTourCardElement(tripId);
    if (!(row instanceof HTMLElement) || !(card instanceof HTMLElement)) {
      setTourExpanded(tripId, false);
      renderVisibleTrips();
      completeTourDetailsTransition(transitionToken, tripId);
      return;
    }

    updateOutgoingTourDetailsButton(row, false);
    const closedButton = setTourCardExpandedDomState(card, false);
    const expandedHeight = Math.max(row.scrollHeight, row.getBoundingClientRect().height);
    row.classList.add("tour-details-row--closing");
    row.style.height = `${expandedHeight}px`;
    row.style.overflow = "hidden";
    row.style.opacity = "1";
    setTourShowMoreButtonLabel(closedButton, tourShowMoreLabel(true));

    if (prefersReducedMotion()) {
      setTourExpanded(tripId, false);
      setTourShowMoreButtonLabel(closedButton, tourShowMoreLabel(false));
      row.remove();
      bindTourCardOpenHandlers();
      fitTourCardDescriptions(card);
      completeTourDetailsTransition(transitionToken, tripId);
      return;
    }

    await Promise.all([
      animateTourDetailsRowHeight(row, 0, "close", {
        durationMs: TOUR_DETAILS_CLOSE_TRANSITION_MS,
        easing: "cubic-bezier(0.2, 0.82, 0.2, 1)"
      }),
      animateTourShowMoreButtonLabel(
        closedButton,
        tourShowMoreLabel(false),
        { direction: "close" }
      )
    ]);
    if (!isCurrentTourDetailsTransition(transitionToken)) return;
    setTourExpanded(tripId, false);
    row.remove();
    bindTourCardOpenHandlers();
    fitTourCardDescriptions(card);
    completeTourDetailsTransition(transitionToken, tripId);
  }

  async function animateTourDetailsOpen(tripId, transitionToken) {
    const singleColumnLayout = isSingleColumnTourLayout();
    const previousRects = captureTourCardRects();
    const trip = findTripById(tripId);
    const card = singleColumnLayout ? tourCardElement(tripId) : directTourCardElement(tripId);
    const initialColumnIndex = singleColumnLayout ? 0 : tourGridColumnIndexForTrip(tripId);
    renderedTourGridColumnCount = getTourGridColumnCount();
    openingTourColumnIndexes.set(tripId, initialColumnIndex);
    const initialCardHeight = Math.max(0, Math.ceil(Number(previousRects.get(tripId)?.height) || 0));
    if (initialCardHeight > 0) {
      openingTourInitialHeights.set(tripId, initialCardHeight);
    } else {
      openingTourInitialHeights.delete(tripId);
    }
    setTourExpanded(tripId, true);
    const row = trip && card instanceof HTMLElement
      ? (singleColumnLayout
          ? createSingleColumnTourDetailsRow(trip, card)
          : createSidePanelTourDetailsRow(trip, card, {
              columnIndex: initialColumnIndex,
              columnCount: renderedTourGridColumnCount,
              initialCardHeight
            }))
      : null;
    const openedButton = row instanceof HTMLElement
      ? setTourCardExpandedDomState(card, true)
      : tourShowMoreButton(tripId);
    setTourShowMoreButtonLabel(openedButton, tourShowMoreLabel(false));

    if (!(row instanceof HTMLElement)) {
      renderVisibleTrips();
      await animateTourGridLayout(previousRects, { excludedTripIds: [tripId] });
      if (!isCurrentTourDetailsTransition(transitionToken)) return;
      await animateTourShowMoreButtonLabel(openedButton, tourShowMoreLabel(true), { direction: "open" });
      if (!isCurrentTourDetailsTransition(transitionToken)) return;
      openingTourColumnIndexes.delete(tripId);
      openingTourInitialHeights.delete(tripId);
      window.requestAnimationFrame(() => {
        completeTourDetailsTransition(transitionToken, tripId);
      });
      return;
    }

    bindTourCardOpenHandlers();
    fitTourCardDescriptions(row);
    syncExpandedTourDetailsHeight(row);
    const collapsedHeight = collapsedTourDetailsHeight(row);
    row.classList.add("tour-details-row--opening");
    row.style.height = `${collapsedHeight}px`;
    row.style.overflow = "hidden";
    row.style.opacity = "1";

    const opensSideways = !singleColumnLayout
      && row.classList.contains("tour-details-row--side-panel")
      && !tourDetailsWrapsBelowCard(row);
    const backgroundStartLeft = opensSideways
      ? expandedTourBackgroundStartLeftInset(expandedTourShell(row), expandedTourCard(row))
      : 0;
    const initialCardRect = opensSideways ? expandedTourCard(row)?.getBoundingClientRect?.() : null;
    const initialCardRight = Number(initialCardRect?.right) || 0;
    const twoCardWrappedRow = isTwoCardWrappedTourRow(row);
    const gridAnimationExcludedTripIds = twoCardWrappedRow
      ? visibleTourTripIds()
      : [tripId];
    const rowClearingPromise = singleColumnLayout
      ? Promise.resolve()
      : Promise.all([
          animateTourGridLayout(previousRects, { excludedTripIds: gridAnimationExcludedTripIds }),
          animateExpandedTourCardToLeft(row)
        ]);
    const startDetailsOpenAnimation = (targetHeight) => Promise.all([
      opensSideways
        ? animateExpandedTourDetailsAttach(row, TOUR_DETAILS_OPEN_TRANSITION_MS, { backgroundStartLeft, initialCardRight })
        : Promise.resolve(),
      animateTourDetailsRowHeight(row, opensSideways ? collapsedHeight : targetHeight, "open")
    ]);
    const detailsOpenPromise = opensSideways
      ? startDetailsOpenAnimation(collapsedHeight)
      : null;

    await waitForExpandedTourServiceImages(row);
    if (!isCurrentTourDetailsTransition(transitionToken)) return;
    const expandedHeight = Math.max(row.scrollHeight, row.getBoundingClientRect().height);

    if (singleColumnLayout) {
      const mobileOpenTransitionMs = TOUR_DETAILS_MOBILE_OPEN_TRANSITION_MS;
      await Promise.all([
        animateTourDetailsRowHeight(row, expandedHeight, "open", {
          durationMs: mobileOpenTransitionMs,
          easing: TOUR_DETAILS_MOBILE_OPEN_EASING
        }),
        animateTourShowMoreButtonLabel(
          openedButton,
          tourShowMoreLabel(true),
          { direction: "open" }
        )
      ]);
      if (!isCurrentTourDetailsTransition(transitionToken)) return;
      openingTourInitialHeights.delete(tripId);
      clearTourDetailsRowAnimation(row);
      completeTourDetailsTransition(transitionToken, tripId);
      return;
    }

    const buttonLabelPromise = animateTourShowMoreButtonLabel(
      openedButton,
      tourShowMoreLabel(true),
      { direction: "open" }
    );

    await rowClearingPromise;
    if (!isCurrentTourDetailsTransition(transitionToken)) return;
    openingTourColumnIndexes.delete(tripId);
    openingTourInitialHeights.delete(tripId);
    await scrollTourCardFullyVisible(tripId);
    if (!isCurrentTourDetailsTransition(transitionToken)) return;
    if (!opensSideways) {
      await scrollExpandedTourDetailsIntoView(tripId);
      if (!isCurrentTourDetailsTransition(transitionToken)) return;
    }
    await Promise.all([
      detailsOpenPromise || startDetailsOpenAnimation(expandedHeight),
      buttonLabelPromise
    ]);
    if (!isCurrentTourDetailsTransition(transitionToken)) return;
    if (!opensSideways) {
      await scrollExpandedTourDetailsIntoView(tripId);
      if (!isCurrentTourDetailsTransition(transitionToken)) return;
    }
    clearTourDetailsRowAnimation(row, { preserveHeight: opensSideways });
    completeTourDetailsTransition(transitionToken, tripId);
  }

  async function animateTourDetailsClose(tripId, transitionToken) {
    const row = expandedTourRow(tripId);
    const card = expandedTourCard(row);
    if (!(row instanceof HTMLElement) || !(card instanceof HTMLElement)) {
      setTourExpanded(tripId, false);
      renderVisibleTrips();
      window.requestAnimationFrame(() => {
        completeTourDetailsTransition(transitionToken, tripId);
      });
      return;
    }

    updateOutgoingTourDetailsButton(row, false);
    const previousRects = captureTourCardRects();
    const compactWithoutGridAnimation = shouldCompactCloseWithoutGridAnimation(row);
    const outgoingDetailsGhost = createOutgoingTourDetailsGhost(row);
    const closedButton = setTourCardExpandedDomState(card, false);
    setTourShowMoreButtonLabel(closedButton, tourShowMoreLabel(true));
    setTourExpanded(tripId, false);
    restoreExpandedTourCardToGrid(row, card, tripId);
    const compactedTripIds = compactClosedTourGridCards();
    bindTourCardOpenHandlers();
    fitTourCardDescriptions(card);
    syncExpandedTourDetailsHeights();
    scheduleTourDetailsConnectorVisibilityUpdate();
    await Promise.all([
      animateOutgoingTourDetailsGhost(outgoingDetailsGhost),
      animateTourGridLayout(previousRects, {
        excludedTripIds: compactWithoutGridAnimation ? compactedTripIds : []
      }),
      animateTourShowMoreButtonLabel(
        closedButton,
        tourShowMoreLabel(false),
        { direction: "close" }
      )
    ]);
    if (!isCurrentTourDetailsTransition(transitionToken)) return;
    window.requestAnimationFrame(() => {
      completeTourDetailsTransition(transitionToken, tripId);
    });
  }

  function clearTourPlanSummaryDetailsAnimation(details) {
    const activeAnimation = tourPlanSummaryDetailsAnimations.get(details);
    if (!activeAnimation) return;
    if (typeof window !== "undefined" && typeof window.clearTimeout === "function") {
      window.clearTimeout(activeAnimation.timer);
    } else {
      clearTimeout(activeAnimation.timer);
    }
    details.removeEventListener("transitionend", activeAnimation.onTransitionEnd);
    tourPlanSummaryDetailsAnimations.delete(details);
  }

  function finishTourPlanSummaryDetailsAnimation(details, expanded) {
    clearTourPlanSummaryDetailsAnimation(details);
    details.style.height = "";
    details.style.opacity = "";
    delete details.dataset.tourPlanSummaryDetailsAnimating;
    if (!expanded) {
      details.hidden = true;
    }
    syncExpandedTourDetailsHeights();
  }

  function animateTourPlanSummaryDetails(summaryDay, details, expanded) {
    if (!(summaryDay instanceof HTMLElement) || !(details instanceof HTMLElement)) return;
    clearTourPlanSummaryDetailsAnimation(details);

    if (prefersReducedMotion()) {
      details.hidden = !expanded;
      details.style.height = "";
      details.style.opacity = "";
      delete details.dataset.tourPlanSummaryDetailsAnimating;
      syncExpandedTourDetailsHeightsDuring(0);
      return;
    }

    details.hidden = false;
    details.dataset.tourPlanSummaryDetailsAnimating = expanded ? "expanding" : "collapsing";
    if (expanded) {
      details.style.height = "0px";
      details.style.opacity = "0";
      void details.offsetHeight;
      details.style.height = `${details.scrollHeight}px`;
      details.style.opacity = "1";
    } else {
      details.style.height = `${details.scrollHeight}px`;
      details.style.opacity = "1";
      void details.offsetHeight;
      details.style.height = "0px";
      details.style.opacity = "0";
    }

    const done = () => finishTourPlanSummaryDetailsAnimation(details, expanded);
    const onTransitionEnd = (event) => {
      if (event.target !== details || event.propertyName !== "height") return;
      done();
    };
    details.addEventListener("transitionend", onTransitionEnd);
    const timer = typeof window !== "undefined" && typeof window.setTimeout === "function"
      ? window.setTimeout(done, TOUR_PLAN_DAY_DETAILS_TRANSITION_MS + 120)
      : setTimeout(done, TOUR_PLAN_DAY_DETAILS_TRANSITION_MS + 120);
    tourPlanSummaryDetailsAnimations.set(details, { onTransitionEnd, timer });
    syncExpandedTourDetailsHeightsDuring(TOUR_PLAN_DAY_DETAILS_TRANSITION_MS + 80);
  }

  function toggleTourPlanSummaryDay(trigger) {
    if (!(trigger instanceof HTMLElement)) return;
    const summaryDay = trigger.closest("[data-tour-plan-summary-day]");
    if (!(summaryDay instanceof HTMLElement)) return;

    const willExpand = trigger.getAttribute("aria-expanded") !== "true";
    const details = summaryDay.querySelector("[data-tour-plan-summary-details]");
    summaryDay.classList.toggle("is-expanded", willExpand);
    trigger.setAttribute("aria-expanded", willExpand ? "true" : "false");
    if (details instanceof HTMLElement) {
      animateTourPlanSummaryDetails(summaryDay, details, willExpand);
      return;
    }
    syncExpandedTourDetailsHeightsDuring(0);
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

  function setTourPlanServiceDetailsIndicatorState(card, enabled) {
    if (!(card instanceof HTMLElement)) return;
    const indicator = card.querySelector(".tour-plan-service-card__details-indicator");
    if (!(indicator instanceof HTMLElement)) return;
    if (!enabled) {
      indicator.removeAttribute("data-tour-plan-service-details-toggle");
      indicator.removeAttribute("role");
      indicator.removeAttribute("tabindex");
      indicator.removeAttribute("aria-pressed");
      indicator.removeAttribute("aria-label");
      return;
    }

    const title = tourPlanServiceCardTitleText(card);
    indicator.setAttribute("data-tour-plan-service-details-toggle", "");
    indicator.setAttribute("role", "button");
    indicator.setAttribute("tabindex", "0");
    indicator.setAttribute("aria-pressed", card.classList.contains("is-showing-details") ? "true" : "false");
    indicator.setAttribute("aria-label", frontendT("tour.plan.show_service_details", "Show details for {title}", { title }));
  }

  function setTourPlanServiceDetailsVisible(card, visible) {
    if (!(card instanceof HTMLElement)) return;
    card.classList.toggle("is-showing-details", visible);
    const indicator = card.querySelector("[data-tour-plan-service-details-toggle]");
    if (indicator instanceof HTMLElement) {
      indicator.setAttribute("aria-pressed", visible ? "true" : "false");
    }
    syncExpandedTourDetailsHeights();
  }

  function toggleTourPlanServiceDetails(card) {
    if (!(card instanceof HTMLElement)) return;
    setTourPlanServiceDetailsVisible(card, !card.classList.contains("is-showing-details"));
  }

  function setTourPlanServiceCardFeaturedState(card, featured) {
    if (!(card instanceof HTMLElement)) return;
    const hasDetails = card.getAttribute("data-tour-plan-service-has-details") === "1";
    card.classList.toggle("tour-plan-service-card--featured", featured);
    card.classList.toggle("tour-plan-service-card--small", !featured);
    card.classList.toggle("tour-plan-service-card--interactive", !featured);
    card.classList.remove("is-showing-details");
    if (featured) {
      card.removeAttribute("data-tour-plan-service-swap");
      card.removeAttribute("data-tour-plan-service-collapse");
      card.removeAttribute("role");
      card.removeAttribute("tabindex");
      card.removeAttribute("aria-label");
      setTourPlanServiceDetailsIndicatorState(card, hasDetails);
      return;
    }

    const title = tourPlanServiceCardTitleText(card);
    setTourPlanServiceDetailsIndicatorState(card, false);
    card.removeAttribute("data-tour-plan-service-collapse");
    card.removeAttribute("aria-pressed");
    card.setAttribute("data-tour-plan-service-swap", "");
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", frontendT("tour.plan.feature_service", "Show {title} as the featured service", { title }));
  }

  function normalizeTourPlanServiceMedia(media) {
    if (!(media instanceof HTMLElement)) return;
    if (media.dataset.tourPlanServicesNormalized === "1") return;
    const featuredCard = media.querySelector(".tour-plan-service-card--featured");
    if (!(featuredCard instanceof HTMLElement)) return;
    setTourPlanServiceCardFeaturedState(featuredCard, true);
    media.dataset.tourPlanServicesNormalized = "1";
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

  async function expandTourPlanServiceImage(targetCard) {
    if (!(targetCard instanceof HTMLElement)) return;
    const media = targetCard.closest("[data-tour-plan-service-media]");
    if (!(media instanceof HTMLElement) || media.dataset.tourPlanServiceSwapAnimating === "1") return;
    if (targetCard.classList.contains("tour-plan-service-card--featured")) return;

    media.dataset.tourPlanServiceSwapAnimating = "1";
    setTourPlanServiceCardFeaturedState(targetCard, true);
    syncExpandedTourDetailsHeights();
    window.requestAnimationFrame(syncExpandedTourDetailsHeights);
    delete media.dataset.tourPlanServiceSwapAnimating;
  }

  function handleTourPlanServiceMediaClick(event) {
    const media = tourPlanServiceMediaFromEvent(event);
    if (!media) return;
    const detailsToggle = event.target instanceof Element
      ? event.target.closest("[data-tour-plan-service-details-toggle]")
      : null;
    if (detailsToggle instanceof HTMLElement && media.contains(detailsToggle)) {
      const detailsCard = detailsToggle.closest("[data-tour-plan-service-card]");
      if (!(detailsCard instanceof HTMLElement) || !media.contains(detailsCard)) return;
      event.preventDefault();
      event.stopPropagation();
      toggleTourPlanServiceDetails(detailsCard);
      return;
    }
    const swapCard = tourPlanServiceSwapCardFromEvent(event, media);
    if (swapCard) {
      event.preventDefault();
      void expandTourPlanServiceImage(swapCard);
      return;
    }
  }

  function handleTourPlanServiceMediaKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const media = tourPlanServiceMediaFromEvent(event);
    if (!media) return;
    const detailsToggle = event.target instanceof Element
      ? event.target.closest("[data-tour-plan-service-details-toggle]")
      : null;
    if (detailsToggle instanceof HTMLElement && media.contains(detailsToggle)) {
      const detailsCard = detailsToggle.closest("[data-tour-plan-service-card]");
      if (!(detailsCard instanceof HTMLElement) || !media.contains(detailsCard)) return;
      event.preventDefault();
      toggleTourPlanServiceDetails(detailsCard);
      return;
    }
    const swapCard = tourPlanServiceSwapCardFromEvent(event, media);
    if (swapCard) {
      event.preventDefault();
      void expandTourPlanServiceImage(swapCard);
      return;
    }
  }

  function updateTourCardImageCounter(button, currentIndex, total) {
    const media = button.closest?.(".tour-card__media");
    const counter = media?.querySelector?.("[data-tour-image-counter]");
    if (counter instanceof HTMLElement) {
      counter.textContent = `${currentIndex + 1} / ${total}`;
    }
    const dots = Array.from(media?.querySelectorAll?.("[data-tour-image-dot]") || []);
    dots.forEach((dot, dotIndex) => {
      if (!(dot instanceof HTMLElement)) return;
      dot.classList.toggle("is-active", dotIndex === currentIndex);
    });
  }

  function tourCardGalleryIndexByTripId() {
    if (!state.tourGalleryIndexByTripId || typeof state.tourGalleryIndexByTripId !== "object") {
      state.tourGalleryIndexByTripId = {};
    }
    return state.tourGalleryIndexByTripId;
  }

  function savedTourCardGalleryIndex(tripId, total) {
    const rawIndex = tourCardGalleryIndexByTripId()[normalizeText(tripId)];
    return clampTourCardGalleryIndex(rawIndex, total);
  }

  function saveTourCardGalleryIndex(tripId, index, total) {
    const normalizedTripId = normalizeText(tripId);
    if (!normalizedTripId) return;
    tourCardGalleryIndexByTripId()[normalizedTripId] = clampTourCardGalleryIndex(index, total);
  }

  function saveTourCardSurfaceGalleryIndex(surface, index, total) {
    if (!(surface instanceof HTMLElement)) return;
    saveTourCardGalleryIndex(surface.getAttribute("data-trip-id"), index, total);
  }

  function tourCardSwipeSlides(surface) {
    return Array.from(surface?.querySelectorAll?.("[data-tour-media-slide]") || [])
      .filter((item) => item instanceof HTMLImageElement);
  }

  function tourCardSwipeTotal(surface) {
    const rawTotal = Number.parseInt(surface?.dataset?.tourGalleryTotal || "", 10);
    return Number.isFinite(rawTotal) && rawTotal > 0
      ? rawTotal
      : tourCardSwipeSlides(surface).length;
  }

  function currentTourCardGalleryIndex(surface, total) {
    if (!(surface instanceof HTMLElement)) return 0;
    const rawIndex = Number.parseInt(surface.dataset.tourGalleryIndex || "0", 10);
    const safeIndex = Number.isFinite(rawIndex) ? rawIndex : 0;
    return clampTourCardGalleryIndex(safeIndex, total);
  }

  function clampTourCardGalleryIndex(index, total) {
    const maxIndex = Math.max(0, Number(total) - 1);
    const safeIndex = Number.isFinite(Number(index)) ? Number(index) : 0;
    return Math.min(Math.max(safeIndex, 0), maxIndex);
  }

  function tourCardSwipeTrack(surface) {
    return surface?.querySelector?.("[data-tour-media-track]") || null;
  }

  function updateTourCardSwipeSlides(surface, activeIndex) {
    const slides = tourCardSwipeSlides(surface);
    slides.forEach((slide, slideIndex) => {
      const rawSlideIndex = Number.parseInt(slide.dataset.tourMediaIndex || String(slideIndex), 10);
      const resolvedSlideIndex = Number.isFinite(rawSlideIndex) ? rawSlideIndex : slideIndex;
      const isActive = resolvedSlideIndex === activeIndex;
      const altText = normalizeText(slide.dataset.tourMediaAlt);
      slide.classList.toggle("is-active", isActive);
      slide.alt = isActive ? altText : "";
      slide.setAttribute("aria-hidden", isActive ? "false" : "true");
    });
  }

  function hydrateTourCardSwipeGallery(surface) {
    if (!(surface instanceof HTMLElement) || surface.dataset.tourGalleryHydrated === "1") return;
    const track = tourCardSwipeTrack(surface);
    if (!(track instanceof HTMLElement)) return;
    const tripId = normalizeText(surface.getAttribute("data-trip-id"));
    const trip = findTripById(tripId);
    const gallery = Array.isArray(trip?.pictures) && trip.pictures.length ? trip.pictures : [DEFAULT_TOUR_IMAGE];
    if (gallery.length <= 1) return;
    const activeIndex = currentTourCardGalleryIndex(surface, gallery.length);
    const activeSlide = tourCardSwipeSlides(surface).find((slide) => {
      const slideIndex = Number.parseInt(slide.dataset.tourMediaIndex || "", 10);
      return Number.isFinite(slideIndex) && slideIndex === activeIndex;
    });
    const altText = normalizeText(activeSlide?.dataset?.tourMediaAlt)
      || activeSlide?.alt
      || "";
    track.innerHTML = gallery.map((image, imageIndex) => `
      <img
        class="tour-card__media-slide${imageIndex === activeIndex ? " is-active" : ""}"
        data-tour-media-slide
        data-tour-media-index="${escapeAttr(String(imageIndex))}"
        data-tour-media-alt="${escapeAttr(altText)}"
        src="${escapeAttr(image || DEFAULT_TOUR_IMAGE)}"
        alt="${imageIndex === activeIndex ? escapeAttr(altText) : ""}"
        aria-hidden="${imageIndex === activeIndex ? "false" : "true"}"
        loading="${imageIndex === activeIndex ? "eager" : "lazy"}"
        fetchpriority="auto"
        draggable="false"
        width="1200"
        height="800"
      />
    `).join("");
    surface.dataset.tourGalleryHydrated = "1";
    setTourCardSwipeGalleryIndex(surface, activeIndex, { scroll: true, behavior: "auto" });
  }

  function tourCardSwipeSlideWidth(track, slides, index = 0) {
    return track.clientWidth || slides[index]?.getBoundingClientRect?.().width || 0;
  }

  function tourCardSwipePhysicalIndexFromScroll(track, slides) {
    const slideWidth = tourCardSwipeSlideWidth(track, slides);
    if (slideWidth <= 0) return 1;
    return Math.round(track.scrollLeft / slideWidth);
  }

  function tourCardSwipeIndexFromScroll(surface) {
    const track = tourCardSwipeTrack(surface);
    const slides = tourCardSwipeSlides(surface);
    if (!(track instanceof HTMLElement) || !slides.length) return;
    const physicalIndex = tourCardSwipePhysicalIndexFromScroll(track, slides);
    return clampTourCardGalleryIndex(physicalIndex, slides.length);
  }

  function setTourCardSwipeGalleryIndex(surface, nextIndex, { scroll = true, behavior = "auto" } = {}) {
    if (!(surface instanceof HTMLElement)) return;
    const track = tourCardSwipeTrack(surface);
    const slides = tourCardSwipeSlides(surface);
    const total = Math.max(1, tourCardSwipeTotal(surface));
    if (!slides.length) return;
    const safeIndex = clampTourCardGalleryIndex(Number.parseInt(String(nextIndex), 10) || 0, total);
    surface.dataset.tourGalleryIndex = String(safeIndex);
    saveTourCardSurfaceGalleryIndex(surface, safeIndex, total);
    updateTourCardSwipeSlides(surface, safeIndex);
    updateTourCardImageCounter(surface, safeIndex, total);
    if (scroll && track instanceof HTMLElement && surface.dataset.tourGalleryHydrated === "1") {
      const slideWidth = tourCardSwipeSlideWidth(track, slides, safeIndex);
      const left = slideWidth * safeIndex;
      if (typeof track.scrollTo === "function") {
        track.scrollTo({ left, behavior });
      } else {
        track.scrollLeft = left;
      }
    }
  }

  function stepTourCardSwipeGallery(surface, step) {
    hydrateTourCardSwipeGallery(surface);
    const slides = tourCardSwipeSlides(surface);
    if (!(surface instanceof HTMLElement) || slides.length <= 1) return;
    const currentIndex = tourCardSwipeIndexFromScroll(surface);
    const nextIndex = clampTourCardGalleryIndex(currentIndex + step, slides.length);
    setTourCardSwipeGalleryIndex(surface, nextIndex, { scroll: true, behavior: "smooth" });
  }

  function syncTourCardImageSwipeSurfaces(root = els.tourGrid) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll("[data-tour-media-track]").forEach((track) => {
      const surface = track instanceof HTMLElement ? track.closest(".tour-card__media-cycle") : null;
      if (!(surface instanceof HTMLElement)) return;
      setTourCardSwipeGalleryIndex(surface, currentTourCardGalleryIndex(surface, tourCardSwipeTotal(surface)), {
        scroll: true,
        behavior: "auto"
      });
    });
  }

  function bindTourCardImageSwipeHandlers(surface) {
    if (!(surface instanceof HTMLElement) || surface.dataset.imageSwipeBound === "1") return;
    const track = tourCardSwipeTrack(surface);
    if (!(track instanceof HTMLElement)) return;

    let scrollFrame = 0;
    const syncFromScroll = () => {
      scrollFrame = 0;
      setTourCardSwipeGalleryIndex(surface, tourCardSwipeIndexFromScroll(surface), { scroll: false });
    };
    track.addEventListener("scroll", () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(syncFromScroll);
    }, { passive: true });
    surface.addEventListener("click", (event) => {
      if (!isSingleColumnTourLayout()) return;
      const rect = surface.getBoundingClientRect();
      if (rect.width <= 0) return;
      const step = event.clientX < rect.left + (rect.width / 2) ? -1 : 1;
      stepTourCardSwipeGallery(surface, step);
    });
    surface.addEventListener("pointerdown", () => {
      if (!isSingleColumnTourLayout()) return;
      hydrateTourCardSwipeGallery(surface);
    }, { passive: true, once: true });
    surface.addEventListener("touchstart", () => {
      if (!isSingleColumnTourLayout()) return;
      hydrateTourCardSwipeGallery(surface);
    }, { passive: true, once: true });
    surface.dataset.imageSwipeBound = "1";
    setTourCardSwipeGalleryIndex(surface, currentTourCardGalleryIndex(surface, tourCardSwipeTotal(surface)), {
      scroll: true,
      behavior: "auto"
    });
  }

  function nextTourCardImageTransitionToken(button) {
    if (!(button instanceof HTMLElement)) return "";
    const nextToken = String((Number.parseInt(button.dataset.imageTransitionToken || "0", 10) || 0) + 1);
    button.dataset.imageTransitionToken = nextToken;
    return nextToken;
  }

  function clearTourCardImageTransitionTimer(button) {
    const activeTimer = tourCardImageTransitionTimers.get(button);
    if (activeTimer) {
      window.clearTimeout(activeTimer);
      tourCardImageTransitionTimers.delete(button);
    }
  }

  async function finishTourCardImageTransition(button, primaryLayer, secondaryLayer, transitionToken = "") {
    if (
      !(button instanceof HTMLElement)
      || !(primaryLayer instanceof HTMLImageElement)
      || !(secondaryLayer instanceof HTMLImageElement)
    ) {
      return;
    }

    const nextImageSrc = normalizeText(secondaryLayer.currentSrc || secondaryLayer.src);
    if (nextImageSrc) {
      await waitForTourCardImageReady(primaryLayer, nextImageSrc);
    }
    if (transitionToken && button.dataset.imageTransitionToken !== transitionToken) return;

    primaryLayer.classList.remove("is-leaving");
    secondaryLayer.classList.remove("is-entering");
    button.dataset.imageAnimating = "0";
  }

  async function commitActiveTourCardImageTransition(button, primaryLayer, secondaryLayer) {
    if (
      !(button instanceof HTMLElement)
      || button.dataset.imageAnimating !== "1"
      || !(primaryLayer instanceof HTMLImageElement)
      || !(secondaryLayer instanceof HTMLImageElement)
    ) {
      return true;
    }

    clearTourCardImageTransitionTimer(button);
    const transitionToken = nextTourCardImageTransitionToken(button);
    const currentTargetSrc = normalizeText(secondaryLayer.currentSrc || secondaryLayer.src);
    if (!currentTargetSrc) {
      primaryLayer.classList.remove("is-leaving");
      secondaryLayer.classList.remove("is-entering");
      button.dataset.imageAnimating = "0";
      return true;
    }

    secondaryLayer.style.animation = "none";
    secondaryLayer.style.opacity = "1";
    primaryLayer.style.animation = "none";
    primaryLayer.style.opacity = "0";
    const imageReady = await waitForTourCardImageReady(primaryLayer, currentTargetSrc);
    if (button.dataset.imageTransitionToken !== transitionToken) return false;

    primaryLayer.classList.remove("is-leaving");
    secondaryLayer.classList.remove("is-entering");
    primaryLayer.style.animation = "";
    primaryLayer.style.opacity = "";
    secondaryLayer.style.animation = "";
    secondaryLayer.style.opacity = "";
    button.dataset.imageAnimating = "0";
    return imageReady;
  }

  async function cycleTourCardImage(button, { step = 1 } = {}) {
    if (!(button instanceof HTMLElement)) return;
    if (button.dataset.imageLoading === "1") return;

    const tripId = normalizeText(button.getAttribute("data-trip-id"));
    const trip = state.filteredTrips.find((item) => normalizeText(item?.id) === tripId)
      || state.trips.find((item) => normalizeText(item?.id) === tripId)
      || null;
    const gallery = Array.isArray(trip?.pictures) && trip.pictures.length ? trip.pictures : [DEFAULT_TOUR_IMAGE];
    if (gallery.length <= 1) return;

    const currentIndex = Math.max(0, Number.parseInt(button.dataset.tourGalleryIndex || "0", 10) || 0) % gallery.length;
    const requestedStep = Number.parseInt(String(step), 10) || 1;
    const nextIndex = (currentIndex + requestedStep + gallery.length) % gallery.length;
    const primaryLayer = button.querySelector('[data-tour-media-layer="primary"]');
    const secondaryLayer = button.querySelector('[data-tour-media-layer="secondary"]');
    if (!(primaryLayer instanceof HTMLImageElement) || !(secondaryLayer instanceof HTMLImageElement)) return;

    if (button.dataset.imageAnimating === "1") {
      const committed = await commitActiveTourCardImageTransition(button, primaryLayer, secondaryLayer);
      if (!committed) return;
    }

    const nextImageSrc = String(gallery[nextIndex] || gallery[0] || DEFAULT_TOUR_IMAGE);
    button.dataset.imageLoading = "1";
    try {
      secondaryLayer.classList.remove("is-entering");
      primaryLayer.classList.remove("is-leaving");
      const imageReady = await waitForTourCardImageReady(secondaryLayer, nextImageSrc);
      if (!imageReady) return;

      const transitionToken = nextTourCardImageTransitionToken(button);
      button.dataset.imageAnimating = "1";
      button.dataset.tourGalleryIndex = String(nextIndex);
      saveTourCardGalleryIndex(tripId, nextIndex, gallery.length);
      void secondaryLayer.offsetWidth;

      secondaryLayer.classList.add("is-entering");
      primaryLayer.classList.add("is-leaving");
      updateTourCardImageCounter(button, nextIndex, gallery.length);

      const transitionDurationMs = tourCardImageTransitionDurationMs(button);
      const transitionTimer = window.setTimeout(() => {
        tourCardImageTransitionTimers.delete(button);
        finishTourCardImageTransition(button, primaryLayer, secondaryLayer, transitionToken);
      }, transitionDurationMs);
      tourCardImageTransitionTimers.set(button, transitionTimer);
    } finally {
      button.dataset.imageLoading = "0";
    }
  }

  function renderVisibleTrips() {
    const visibleTrips = state.filteredTrips.slice(0, state.visibleToursCount);
    renderTrips(visibleTrips, {
      showNoResults: hasActiveHeroFilters() && state.filteredTrips.length === 0
    });
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
    updateHeroFilterMatchCount();
    updateTitlesForFilters();
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
    loadExpandedTourDetails,
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
