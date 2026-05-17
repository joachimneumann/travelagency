import { normalizeText } from "../../shared/js/text.js";
import {
  FRONTEND_LANGUAGE_CODES,
  normalizeLanguageCode
} from "../../shared/generated/language_catalog.js";
import { createTourCustomizer } from "./tour_customize.js";

const DEFAULT_TOUR_IMAGE = "/assets/img/marketing_tours.png";
const TOUR_IMAGE_TRANSITION_MS = 2000;
const TOUR_PLAN_DAY_DETAILS_TRANSITION_MS = 300;
const COUNTRY_TO_TOUR_DESTINATION_CODE = Object.freeze({
  VN: "vietnam",
  TH: "thailand",
  KH: "cambodia",
  LA: "laos"
});
const DESTINATION_REGION_MENU_ORDER = Object.freeze(new Map([
  ["north", 0],
  ["central", 1],
  ["south", 2]
]));
const TOUR_EXPERIENCE_HIGHLIGHT_LIMIT = 4;
const TOUR_EXPERIENCE_HIGHLIGHT_FALLBACK_IDS = Object.freeze([
  "local_experiences",
  "delicious_cuisine",
  "family_friendly_activities",
  "shopping_souvenirs"
]);
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
  const tourCustomizer = createTourCustomizer({
    state,
    frontendT,
    currentFrontendLang,
    normalizeFrontendTourLang,
    escapeHTML,
    escapeAttr,
    travelPlanDays,
    destinationScopeCatalog,
    findTripById,
    ensureTourDetailsLoaded,
    allTrips: () => state.trips,
    renderVisibleTrips: () => renderVisibleTrips()
  });

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
    const region = normalizeText(params.get("region"));
    const place = normalizeText(params.get("place"));
    const style = normalizeFilterSelection(params.get("style"));
    return { dest, region, place, style };
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
    const regions = (Array.isArray(rawCatalog.regions) ? rawCatalog.regions : [])
      .map((region) => {
        const destination = normalizeDestinationCode(region?.destination || region?.country_code);
        const id = normalizeText(region?.id || region?.region_id);
        if (!id || !destination || !destinationCodes.has(destination)) return null;
        return {
          id,
          destination,
          code: normalizeText(region?.code),
          label: normalizeText(region?.label || region?.name || region?.code) || id
        };
      })
      .filter(Boolean);
    const regionIds = new Set(regions.map((region) => region.id));
    const places = (Array.isArray(rawCatalog.places) ? rawCatalog.places : [])
      .map((place) => {
        const region_id = normalizeText(place?.region_id || place?.regionId);
        const destination = normalizeDestinationCode(place?.destination || place?.country_code);
        const id = normalizeText(place?.id || place?.place_id);
        if (!id || !destination || !destinationCodes.has(destination) || (region_id && !regionIds.has(region_id))) return null;
        return {
          id,
          destination,
          region_id,
          code: normalizeText(place?.code),
          label: normalizeText(place?.label || place?.name || place?.code) || id,
          latitude: Number.isFinite(Number(place?.latitude)) ? Number(place.latitude) : null,
          longitude: Number.isFinite(Number(place?.longitude)) ? Number(place.longitude) : null
        };
      })
      .filter(Boolean);

    return { destinations, regions, places };
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
        regions: Array.isArray(entry?.regions) ? entry.regions : (Array.isArray(entry?.areas) ? entry.areas : []),
        places: Array.isArray(entry?.places) ? entry.places : []
      }))
      .filter((entry) => entry.destination);
  }

  function tourIncludesDestinationScope(trip, { destination = "", region = "", place = "" } = {}) {
    const selectedDestination = normalizeDestinationCode(destination);
    const selectedRegion = normalizeText(region);
    const selectedPlace = normalizeText(place);
    const scopeEntries = tourDestinationScopeEntries(trip);

    const destinationMatch = !selectedDestination
      || tourDestinationCodes(trip).includes(selectedDestination)
      || scopeEntries.some((entry) => entry.destination === selectedDestination);
    if (!destinationMatch) return false;

    if (!selectedRegion && !selectedPlace) return true;

    return scopeEntries.some((entry) => {
      if (selectedDestination && entry.destination !== selectedDestination) return false;
      if (selectedPlace && !selectedRegion && (Array.isArray(entry.places) ? entry.places : [])
        .some((placeSelection) => normalizeText(placeSelection?.place_id) === selectedPlace)) {
        return true;
      }
      return entry.regions.some((regionSelection) => {
        const regionId = normalizeText(regionSelection?.region_id);
        if (selectedRegion && regionId !== selectedRegion) return false;
        if (!selectedPlace) return true;
        return (Array.isArray(regionSelection?.places) ? regionSelection.places : [])
          .some((placeSelection) => normalizeText(placeSelection?.place_id) === selectedPlace);
      });
    });
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
    const regionById = new Map(catalog.regions.map((region) => [region.id, region]));
    const placeById = new Map(catalog.places.map((place) => [place.id, place]));
    let destination = normalizeSelectionToCodes(state.filters.dest, "destination", { allowUnknown: false })[0] || "";
    let region = normalizeText(state.filters.region);
    let place = normalizeText(state.filters.place);

    if (place) {
      const matchedPlace = placeById.get(place);
      if (matchedPlace) {
        region = matchedPlace.region_id || "";
        destination = matchedPlace.destination || destination;
      } else {
        place = "";
      }
    }

    if (region) {
      const matchedRegion = regionById.get(region);
      if (matchedRegion) {
        destination = matchedRegion.destination;
      } else {
        region = "";
        place = "";
      }
    }

    if (destination && !filterOptionList("destination").some((option) => normalizeDestinationCode(option.code) === destination)) {
      destination = "";
      region = "";
      place = "";
    }

    state.filters.dest = destination ? [destination] : [];
    state.filters.region = region;
    state.filters.place = place;
  }

  function normalizeActiveFiltersFromOptions() {
    normalizeDestinationScopeFilterFromOptions();
    state.filters.style = normalizeSelectionToCodes(state.filters.style, "style", { allowUnknown: false });
  }

  function hasActiveHeroFilters() {
    return Boolean(
      state.filters.dest.length
      || normalizeText(state.filters.region)
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
    const selectedRegion = normalizeText(state.filters.region);
    const selectedDestination = normalizeText(state.filters.dest?.[0]);
    const destinationLabel = selectedDestination ? filterLabel("destination", selectedDestination) : "";
    const labels = [];
    if (selectedPlace) {
      const place = catalog.places.find((item) => item.id === selectedPlace);
      if (place?.label) labels.push(place.label);
    }
    if (selectedRegion) {
      const region = catalog.regions.find((item) => item.id === selectedRegion);
      if (region?.label) labels.push(region.label);
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
      els.showMoreTours.textContent = frontendT("tours.show_all.remaining", "Show all tours ({count} more)", {
        count: String(moreCount)
      });
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

  function cloneTravelPlanPresentationValue(value, fallback = null) {
    try {
      return JSON.parse(JSON.stringify(value ?? fallback));
    } catch {
      return fallback;
    }
  }

  function boundaryServiceHasPresentationContent(service) {
    if (!service || typeof service !== "object" || Array.isArray(service)) return false;
    return [
      service.time_label,
      service.time_point,
      service.start_time,
      service.end_time,
      service.title,
      service.details,
      service.image_subtitle,
      service.airport_code,
      service.from_label,
      service.to_label
    ].some((value) => Boolean(normalizeText(value)))
      || Object.values(service.title_i18n || {}).some((value) => Boolean(normalizeText(value)))
      || Object.values(service.details_i18n || {}).some((value) => Boolean(normalizeText(value)))
      || Object.values(service.time_label_i18n || {}).some((value) => Boolean(normalizeText(value)))
      || Boolean(service.image && typeof service.image === "object" && normalizeText(service.image.storage_path || service.image.url || service.image.src));
  }

  function dayAlreadyContainsBoundaryService(day, boundaryService, boundaryKind) {
    const boundaryId = normalizeText(boundaryService?.id);
    return (Array.isArray(day?.services) ? day.services : []).some((service) => (
      normalizeText(service?.boundary_kind) === boundaryKind
        || (boundaryId && normalizeText(service?.copied_from_boundary_id) === boundaryId)
        || (boundaryId && normalizeText(service?.id) === boundaryId)
    ));
  }

  function boundaryAlreadyComposedIntoDays(days, boundaryService, boundaryKind) {
    return (Array.isArray(days) ? days : []).some((day) => (
      dayAlreadyContainsBoundaryService(day, boundaryService, boundaryKind)
    ));
  }

  function boundaryAttachTo(boundaryService, boundaryKind) {
    const attachTo = normalizeText(boundaryService?.presentation?.attach_to);
    if (boundaryKind === "departure") {
      return attachTo === "after_last_day" ? "after_last_day" : "last_day";
    }
    return attachTo === "before_first_day" ? "before_first_day" : "first_day";
  }

  function presentationBoundaryService(boundaryService, boundaryKind) {
    const sourceId = normalizeText(boundaryService?.id) || `travel_plan_boundary_${boundaryKind}`;
    return {
      ...cloneTravelPlanPresentationValue(boundaryService, {}),
      id: sourceId,
      boundary_kind: boundaryKind,
      copied_from_boundary_id: sourceId,
      _presentation_source: "boundary_logistics"
    };
  }

  function presentationBoundaryDay(boundaryService, boundaryKind, dayNumber) {
    const fallbackTitle = boundaryKind === "departure"
      ? frontendT("booking.travel_plan.departure", "Departure")
      : frontendT("booking.travel_plan.arrival", "Arrival");
    const sourceTitle = resolveTravelPlanField(boundaryService, "title");
    return {
      id: `travel_plan_boundary_${boundaryKind}_day`,
      day_number: dayNumber,
      title: sourceTitle || fallbackTitle,
      title_i18n: boundaryService?.title_i18n && typeof boundaryService.title_i18n === "object" && !Array.isArray(boundaryService.title_i18n)
        ? { ...boundaryService.title_i18n }
        : {},
      services: [presentationBoundaryService(boundaryService, boundaryKind)],
      notes: "",
      notes_i18n: {},
      _presentation_source: "boundary_logistics"
    };
  }

  function renumberPresentationDays(days) {
    return (Array.isArray(days) ? days : []).map((day, index) => ({
      ...day,
      day_number: index + 1
    }));
  }

  function composeBoundaryServiceIntoDays(days, boundaryService, boundaryKind) {
    if (!Array.isArray(days)) return [];
    if (!boundaryService || boundaryService.enabled === false || !boundaryServiceHasPresentationContent(boundaryService)) return days;
    if (boundaryAlreadyComposedIntoDays(days, boundaryService, boundaryKind)) return renumberPresentationDays(days);
    const attachTo = boundaryAttachTo(boundaryService, boundaryKind);
    if (boundaryKind === "arrival" && attachTo === "before_first_day") {
      return renumberPresentationDays([
        presentationBoundaryDay(boundaryService, boundaryKind, 1),
        ...days
      ]);
    }
    if (boundaryKind === "departure" && attachTo === "after_last_day") {
      return renumberPresentationDays([
        ...days,
        presentationBoundaryDay(boundaryService, boundaryKind, days.length + 1)
      ]);
    }
    if (!days.length) return days;
    const targetIndex = boundaryKind === "departure" ? days.length - 1 : 0;
    const targetDay = days[targetIndex];
    if (dayAlreadyContainsBoundaryService(targetDay, boundaryService, boundaryKind)) return days;
    const service = presentationBoundaryService(boundaryService, boundaryKind);
    return days.map((day, index) => {
      if (index !== targetIndex) return day;
      const services = Array.isArray(day?.services) ? day.services : [];
      return {
        ...day,
        services: boundaryKind === "departure"
          ? [...services, service]
          : [service, ...services]
      };
    });
  }

  function presentationTourPlanDays(trip, sourceDays) {
    const travelPlan = trip?.travel_plan && typeof trip.travel_plan === "object" && !Array.isArray(trip.travel_plan)
      ? trip.travel_plan
      : {};
    const boundaryLogistics = travelPlan.boundary_logistics && typeof travelPlan.boundary_logistics === "object" && !Array.isArray(travelPlan.boundary_logistics)
      ? travelPlan.boundary_logistics
      : {};
    let days = (Array.isArray(sourceDays) ? sourceDays : [])
      .map((day) => ({
        ...cloneTravelPlanPresentationValue(day, {}),
        services: (Array.isArray(day?.services) ? day.services : [])
          .map((service) => cloneTravelPlanPresentationValue(service, {}))
      }));
    days = composeBoundaryServiceIntoDays(days, boundaryLogistics.arrival, "arrival");
    days = composeBoundaryServiceIntoDays(days, boundaryLogistics.departure, "departure");
    return days;
  }

  function customizeFeatureEnabled() {
    return state.customizeFeatureEnabled !== false;
  }

  function activeTourPlanDays(trip) {
    return customizeFeatureEnabled()
      ? tourCustomizer?.activeDaysForTrip(trip) || travelPlanDays(trip)
      : travelPlanDays(trip);
  }

  function hasTravelPlanDays(trip) {
    return travelPlanDays(trip).length > 0
      || Number(trip?.travel_plan_day_count || 0) > 0
      || trip?.has_travel_plan_details === true;
  }

  function tourDurationDayCount(trip) {
    return presentationTourPlanDays(trip, activeTourPlanDays(trip)).length
      || Math.max(0, Number.parseInt(trip?.travel_plan_day_count, 10) || 0)
      || Math.max(0, Number.parseInt(trip?.duration_days, 10) || 0);
  }

  function tourDurationDaysLabel(trip) {
    const dayCount = tourDurationDayCount(trip);
    return dayCount > 0
      ? frontendT("tour.card.days", "{days} days", { days: String(dayCount) })
      : "";
  }

  function tourDisplayTitle(trip) {
    const baseTitle = resolveLocalizedFrontendText(trip?.title, state.lang);
    if (!customizeFeatureEnabled()) return baseTitle;
    return tourCustomizer?.customizedTitleForTrip(trip) || baseTitle;
  }

  function tourForSelectedContext(trip) {
    if (!trip || typeof trip !== "object") return trip;
    const displayTitle = tourDisplayTitle(trip);
    const baseTitle = resolveLocalizedFrontendText(trip?.title, state.lang);
    if (!displayTitle || displayTitle === baseTitle) return trip;
    return { ...trip, title: displayTitle };
  }

  function customTourSubmissionForTrip(tripId) {
    const normalizedTripId = normalizeText(tripId);
    if (!normalizedTripId || !tourCustomizer?.hasCustomization(normalizedTripId)) return null;
    const selectedDays = tourCustomizer.selectedDaysForPdf(normalizedTripId);
    if (!selectedDays.length) return null;
    const trip = findTripById(normalizedTripId);
    const title = tourCustomizer.customizedTitleForTrip(trip);
    return {
      schema_version: 1,
      base_tour_id: normalizedTripId,
      ...(title ? { title } : {}),
      selected_days: selectedDays
    };
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
    const onePagerExperienceHighlights = Array.isArray(source.one_pager_experience_highlights)
      ? source.one_pager_experience_highlights
      : (Array.isArray(travelPlan.one_pager_experience_highlights) ? travelPlan.one_pager_experience_highlights : []);
    const presentationDays = presentationTourPlanDays({ travel_plan: travelPlan }, Array.isArray(travelPlan.days) ? travelPlan.days : []);
    return {
      title: source.title ?? trip?.title,
      travel_plan: travelPlan,
      travel_plan_day_count: presentationDays.length,
      has_travel_plan_details: Array.isArray(travelPlan.days) && travelPlan.days.length > 0,
      ...(onePagerPdfUrl ? { one_pager_pdf_url: onePagerPdfUrl } : {}),
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
    if (expanded) {
      expandedIds.clear();
      expandedIds.add(normalizedTripId);
    } else {
      expandedIds.delete(normalizedTripId);
    }
  }

  function normalizeExpandedTourIdSet() {
    const expandedIds = expandedTourIdSet();
    const normalizedIds = Array.from(expandedIds)
      .map((value) => normalizeText(value))
      .filter(Boolean);
    const activeTripId = normalizedIds[normalizedIds.length - 1] || "";
    expandedIds.clear();
    if (activeTripId) expandedIds.add(activeTripId);
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
      if (!customizeFeatureEnabled()) {
        tourCustomizer.close();
      }
      if (nextColumnCount === renderedTourGridColumnCount) {
        syncTourCardImageSwipeSurfaces();
        fitTourCardDescriptions();
        window.requestAnimationFrame(() => {
          syncTourCardImageSwipeSurfaces();
          fitTourCardDescriptions();
        });
        return;
      }
      renderedTourGridColumnCount = nextColumnCount;
      renderVisibleTrips();
    });
  }

  function renderTourMediaBadges(trip) {
    const durationSuffix = formatTourDurationSuffix(trip);
    return durationSuffix
      ? `<span class="tour-card__duration-pill">${escapeHTML(durationSuffix)}</span>`
      : "";
  }

  function tourShowMoreLabel(expanded) {
    return expanded
      ? frontendT("modal.nav.close", "Close")
      : frontendT("tour.card.details", "Explore");
  }

  function renderTourShowMoreLabel(label, { expanded = false } = {}) {
    if (expanded) {
      return `
        <span class="tour-card__show-more-close" aria-hidden="true">&times;</span>
        <span class="tour-card__show-more-label" data-tour-card-show-more-label>${escapeHTML(label)}</span>
      `;
    }
    return `<span class="tour-card__show-more-label" data-tour-card-show-more-label>${escapeHTML(label)}</span>`;
  }

  function inferTourShowMoreExpandedState(label) {
    return normalizeText(label) === normalizeText(tourShowMoreLabel(true));
  }

  function renderTourDetailsCloseButton(tripId) {
    const label = tourShowMoreLabel(true);
    return `
      <button
        class="tour-details-modal__close"
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
    const expanded = inferTourShowMoreExpandedState(label);
    button.classList.toggle("tour-card__show-more--close", expanded);
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    const labelElement = button.querySelector("[data-tour-card-show-more-label]");
    if (labelElement instanceof HTMLElement) {
      const needsExpandedMarkup = expanded && !button.querySelector(".tour-card__show-more-close");
      const needsCollapsedMarkup = !expanded && button.querySelector(".tour-card__show-more-close");
      if (!needsExpandedMarkup && !needsCollapsedMarkup) {
        labelElement.textContent = label;
        labelElement.classList.remove("tour-card__show-more-label--hidden");
        labelElement.removeAttribute("aria-hidden");
        return labelElement;
      }
    }
    button.innerHTML = renderTourShowMoreLabel(label, { expanded });
    const renderedLabel = button.querySelector("[data-tour-card-show-more-label]");
    return renderedLabel instanceof HTMLElement ? renderedLabel : null;
  }

  function setTourShowMoreButtonExpandedState(button, expanded) {
    return setTourShowMoreButtonLabel(button, tourShowMoreLabel(expanded));
  }

  function renderTourCard(trip, { index = 0, expanded = false } = {}) {
    const tripId = normalizeText(trip?.id);
    const tripTitle = tourDisplayTitle(trip);
    const tripShortDescription = resolveLocalizedFrontendText(trip?.short_description, state.lang);
    const countries = tourDestinations(trip);
    const countriesLabel = countries.join(", ");
    const ctaLabel = frontendT("tour.card.get_quote", "Get a Quote");
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
    const showMoreA11yAttrs = canShowDetails
      ? `aria-label="${escapeAttr(showMoreLabel)}" title="${escapeAttr(showMoreLabel)}"`
      : `aria-label="${escapeAttr(detailsUnavailableLabel)}"`;

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
            <a class="btn tour-card__show-more${expanded ? " tour-card__show-more--close" : ""}" href="${escapeAttr(detailsHref)}" data-tour-card-show-more data-trip-id="${escapeAttr(tripId)}" ${showMoreStateAttrs} ${showMoreA11yAttrs}>${renderTourShowMoreLabel(showMoreLabel, { expanded })}</a>
            <button class="btn btn-primary tour-card__plan-trip" type="button" data-open-modal data-trip-id="${escapeAttr(tripId)}">${escapeHTML(ctaLabel)}</button>
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
    const details = resolveTravelPlanField(service, "details");
    const parts = [title].map((item) => compactText(item)).filter(Boolean);
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

  function stableHash(value) {
    let hash = 2166136261;
    const text = String(value ?? "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function selectedTourExperienceHighlightIds(trip) {
    const catalogOrder = new Map(TOUR_EXPERIENCE_HIGHLIGHTS.map((item, index) => [item.id, index]));
    const counts = new Map();
    const firstSeen = new Map();
    let sequence = 0;
    for (const day of Array.isArray(trip?.travel_plan?.days) ? trip.travel_plan.days : []) {
      const dayIds = Array.from(new Set((Array.isArray(day?.experience_highlight_ids) ? day.experience_highlight_ids : [])
        .map((value) => normalizeExperienceHighlightId(value))
        .filter((id) => id && catalogOrder.has(id))));
      for (const id of dayIds) {
        counts.set(id, (counts.get(id) || 0) + 1);
        if (!firstSeen.has(id)) {
          firstSeen.set(id, sequence);
          sequence += 1;
        }
      }
    }
    const selectedIds = Array.from(counts.keys())
      .sort((left, right) => {
        const countDelta = (counts.get(right) || 0) - (counts.get(left) || 0);
        if (countDelta !== 0) return countDelta;
        const catalogDelta = (catalogOrder.get(left) ?? Number.POSITIVE_INFINITY) - (catalogOrder.get(right) ?? Number.POSITIVE_INFINITY);
        if (catalogDelta !== 0) return catalogDelta;
        return (firstSeen.get(left) || 0) - (firstSeen.get(right) || 0);
      })
      .slice(0, TOUR_EXPERIENCE_HIGHLIGHT_LIMIT);
    const seen = new Set(selectedIds);
    const tripSeed = normalizeText(trip?.id || trip?.title) || "tour";
    const fallbackIds = TOUR_EXPERIENCE_HIGHLIGHT_FALLBACK_IDS
      .map((value) => normalizeExperienceHighlightId(value))
      .filter((id) => id && catalogOrder.has(id) && !seen.has(id))
      .map((id, index) => ({
        id,
        index,
        rank: stableHash(`${tripSeed}:${id}`)
      }))
      .sort((left, right) => left.rank - right.rank || left.index - right.index)
      .map((entry) => entry.id);
    return selectedIds.concat(fallbackIds).slice(0, TOUR_EXPERIENCE_HIGHLIGHT_LIMIT);
  }

  function completeTourExperienceHighlights(trip, highlightIds, explicitItems = []) {
    const seen = new Set();
    const explicitById = new Map((Array.isArray(explicitItems) ? explicitItems : [])
      .map((item) => normalizeExperienceHighlightItem(item))
      .filter(Boolean)
      .map((item) => [item.id, item]));
    return (Array.isArray(highlightIds) ? highlightIds : [])
      .map((id) => explicitById.get(id) || normalizeExperienceHighlightItem({ id }))
      .filter((highlight) => {
        if (!highlight?.id || seen.has(highlight.id)) return false;
        seen.add(highlight.id);
        return true;
      })
      .slice(0, TOUR_EXPERIENCE_HIGHLIGHT_LIMIT);
  }

  function selectedTourExperienceHighlights(trip) {
    const explicitItems = Array.isArray(trip?.one_pager_experience_highlights)
      ? trip.one_pager_experience_highlights
      : (Array.isArray(trip?.travel_plan?.one_pager_experience_highlights) ? trip.travel_plan.one_pager_experience_highlights : []);
    return completeTourExperienceHighlights(trip, selectedTourExperienceHighlightIds(trip), explicitItems);
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

  function renderTourPdfActions(trip) {
    const tripId = normalizeText(trip?.id);
    if (!tripId) return "";
    const pdfAriaLabel = frontendT("tour.plan.pdf_aria", "Tour PDFs");
    const overviewLabel = frontendT("tour.plan.pdf_overview_one_pager", "Overview (one-pager)");
    const travelPlanLabel = frontendT("tour.plan.pdf_day_by_day_travel_plan", "Day-by-Day Travel Plan");
    const overviewDescription = frontendT("tour.plan.pdf_overview_description", "A PDF that gives you an overview of this tour");
    const travelPlanDescription = frontendT("tour.plan.pdf_day_by_day_description", "A PDF that shows you all activities of this tour");
    return `
      <section class="tour-plan-pdf" aria-label="${escapeAttr(pdfAriaLabel)}">
        <div class="tour-plan-pdf__actions">
          <div class="tour-plan-pdf__item">
            <button class="btn btn-secondary tour-plan-pdf__download" type="button" data-tour-overview-pdf data-trip-id="${escapeAttr(tripId)}">${escapeHTML(overviewLabel)}</button>
            <p class="tour-plan-pdf__description">${escapeHTML(overviewDescription)}</p>
          </div>
          <div class="tour-plan-pdf__item">
            <button class="btn btn-secondary tour-plan-pdf__download" type="button" data-tour-travel-plan-pdf data-trip-id="${escapeAttr(tripId)}">${escapeHTML(travelPlanLabel)}</button>
            <p class="tour-plan-pdf__description">${escapeHTML(travelPlanDescription)}</p>
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

  function renderTourDetailsHeader(trip) {
    const tripTitle = tourDisplayTitle(trip);
    const styles = (Array.isArray(trip?.styles) ? trip.styles : [])
      .map((style) => normalizeText(style))
      .filter(Boolean);
    const titleLabel = frontendT("tour.plan.details_title", "Tour Details");
    const stylesLabel = frontendT("tour.plan.travel_style_label", "Travel Style");
    const tripId = normalizeText(trip?.id);
    const customizeLabel = frontendT("tour.plan.customize_trip", "Customize this Trip");
    const canCustomize = canCustomizeTour(trip);
    const customizationSummary = canCustomize
      ? tourCustomizer?.customizationSummaryForTrip(trip) || ""
      : "";
    const customizeCta = canCustomize
      ? `<div class="tour-details-overview__customize">
          <button class="btn btn-primary tour-details-overview__customize-button" type="button" data-tour-customize data-trip-id="${escapeAttr(tripId)}">${escapeHTML(customizeLabel)}</button>
          ${customizationSummary ? `<p class="tour-details-overview__customize-summary">${escapeHTML(customizationSummary)}</p>` : ""}
        </div>`
      : "";

    return `
      <section class="tour-details-overview" aria-label="${escapeAttr(titleLabel)}">
        <p class="tour-details-overview__kicker">${escapeHTML(titleLabel)}</p>
        <h2>${escapeHTML(tripTitle)}</h2>
        ${customizeCta}
        ${styles.length ? `
          <div class="tour-details-overview__facts">
            <div class="tour-details-overview__styles">
              <span>${escapeHTML(stylesLabel)}</span>
              <div class="tour-details-overview__style-list">
                ${styles.map((style) => `
                  <span class="tour-details-overview__style">${escapeHTML(style)}</span>
                `).join("")}
              </div>
            </div>
          </div>
        ` : ""}
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

  function renderTourCustomizeButton(trip) {
    const tripId = normalizeText(trip?.id);
    if (!tripId || !customizeFeatureEnabled()) return "";
    const routePreview = tourCustomizer?.routePreviewForTrip(trip) || { points: "", groups: [] };
    if (!routePreview.groups.length) return "";
    const label = frontendT("tour.plan.customize", "Customize this tour");
    return `
      <div class="tour-plan__customize">
        <button class="tour-plan__customize-map" type="button" data-tour-customize data-trip-id="${escapeAttr(tripId)}" aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}">
          <span class="tour-plan__customize-map-frame" aria-hidden="true">
            <span class="tour-plan__customize-map-image"></span>
            <svg class="tour-plan__customize-map-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              ${routePreview.path ? `<path d="${escapeAttr(routePreview.path)}" fill="none" vector-effect="non-scaling-stroke" />` : ""}
            </svg>
            ${routePreview.groups.map((group) => `
              <span class="tour-plan__customize-map-marker" style="left:${group.x}%;top:${group.y}%;" title="${escapeAttr(group.locationLabel)}">${escapeHTML(group.label)}</span>
            `).join("")}
          </span>
        </button>
      </div>
    `;
  }

  function canCustomizeTour(trip) {
    const tripId = normalizeText(trip?.id);
    if (!tripId || !customizeFeatureEnabled()) return false;
    const routePreview = tourCustomizer?.routePreviewForTrip(trip) || { groups: [] };
    return routePreview.groups.length > 0;
  }

  function renderTourPlanItineraryPanel(days, tripId) {
    if (!days.length) return "";
    return `
      <div class="tour-plan-itinerary" data-tour-plan-itinerary>
        ${renderTourPlanDaySummary(days, tripId)}
      </div>
    `;
  }

  function renderTourTravelPlanDetails(trip) {
    const days = presentationTourPlanDays(trip, activeTourPlanDays(trip));
    if (!days.length) {
      return `
        <div class="tour-plan--empty">
          <p>${escapeHTML(frontendT("tour.plan.no_days", "No travel plan days listed yet."))}</p>
        </div>
      `;
    }

    const tripId = normalizeText(trip?.id);

    return `
      ${renderTourDetailsHeader(trip)}
      ${renderTourExperienceHighlights(trip)}
      ${renderTourPdfActions(trip)}
      ${renderTourPlanItineraryPanel(days, tripId)}
    `;
  }

  function ensureTourDetailsModal() {
    let modal = document.querySelector("[data-tour-details-modal]");
    if (modal instanceof HTMLElement) return modal;

    modal = document.createElement("div");
    modal.className = "tour-details-modal";
    modal.setAttribute("data-tour-details-modal", "");
    modal.hidden = true;
    modal.innerHTML = `
      <div class="tour-details-modal__backdrop" data-tour-details-modal-backdrop></div>
      <div class="tour-details-modal__dialog" role="dialog" aria-modal="true" tabindex="-1">
        <div class="tour-details-modal__content" data-tour-details-modal-content></div>
      </div>
    `;
    document.body.append(modal);

    modal.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest("[data-tour-details-modal-backdrop]")) {
        event.preventDefault();
        closeTourDetailsModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || modal.hidden) return;
      event.preventDefault();
      closeTourDetailsModal();
    });

    return modal;
  }

  function tourDetailsModalContent(modal = ensureTourDetailsModal()) {
    return modal.querySelector("[data-tour-details-modal-content]");
  }

  function renderTourDetailsModalContent(trip) {
    const tripId = normalizeText(trip?.id);
    const tripTitle = tourDisplayTitle(trip);
    const panelLabel = frontendT("tour.plan.panel_label", "Travel plan for {title}", {
      title: tripTitle
    });
    const visibleIndex = Math.max(0, visibleTourIndexForTrip(tripId));
    return `
      <div class="tour-details-modal__layout" data-expanded-tour-id="${escapeAttr(tripId)}">
        <div class="tour-details-modal__card">
          ${renderTourCard(trip, { index: visibleIndex, expanded: true })}
        </div>
        <aside class="tour-details-modal__panel" id="${escapeAttr(tourDetailsPanelId(tripId))}" aria-label="${escapeAttr(panelLabel)}">
          ${renderTourDetailsCloseButton(tripId)}
          ${renderTourTravelPlanDetails(trip)}
        </aside>
      </div>
    `;
  }

  function setGridTourCardOpenState(tripId, expanded) {
    const card = directTourCardElement(tripId) || tourCardElement(tripId);
    if (!(card instanceof HTMLElement)) return;
    const button = setTourCardExpandedDomState(card, expanded);
    setTourShowMoreButtonExpandedState(button, expanded);
  }

  function openTourDetailsModal(tripId) {
    const normalizedTripId = normalizeText(tripId);
    const trip = findTripById(normalizedTripId);
    if (!normalizedTripId || !trip || !hasTravelPlanDays(trip)) return;

    const modal = ensureTourDetailsModal();
    const content = tourDetailsModalContent(modal);
    if (!(content instanceof HTMLElement)) return;

    closeOtherExpandedTourDetails(normalizedTripId);
    setTourExpanded(normalizedTripId, true);
    setGridTourCardOpenState(normalizedTripId, true);
    content.innerHTML = renderTourDetailsModalContent(trip);
    modal.dataset.tripId = normalizedTripId;
    const dialog = modal.querySelector(".tour-details-modal__dialog");
    if (dialog instanceof HTMLElement) {
      dialog.setAttribute("aria-label", frontendT("tour.plan.panel_label", "Travel plan for {title}", {
        title: tourDisplayTitle(trip)
      }));
    }
    modal.hidden = false;
    document.body.classList.add("tour-details-modal-open");
    bindTourCardOpenHandlers(content);
    fitTourCardDescriptions(content);
    const closeButton = modal.querySelector("[data-tour-details-close]");
    window.requestAnimationFrame(() => {
      const focusTarget = closeButton instanceof HTMLElement ? closeButton : dialog;
      if (!(focusTarget instanceof HTMLElement)) return;
      try {
        focusTarget.focus({ preventScroll: true });
      } catch {
        focusTarget.focus();
      }
    });
  }

  function closeTourDetailsModal({ restoreFocus = true } = {}) {
    const modal = document.querySelector("[data-tour-details-modal]");
    if (!(modal instanceof HTMLElement) || modal.hidden) return;
    const tripId = normalizeText(modal.dataset.tripId);
    const content = tourDetailsModalContent(modal);

    if (tripId) {
      setTourExpanded(tripId, false);
      setGridTourCardOpenState(tripId, false);
    }
    modal.hidden = true;
    delete modal.dataset.tripId;
    if (content instanceof HTMLElement) content.innerHTML = "";
    document.body.classList.remove("tour-details-modal-open");

    if (restoreFocus && tripId) {
      focusTourShowMoreButton(tripId);
    }
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

  function setTourCardExpandedDomState(card, expanded) {
    if (!(card instanceof HTMLElement)) return null;
    const tripId = normalizeText(card.getAttribute("data-tour-card-id"));
    card.classList.toggle("tour-card--expanded", expanded);
    const button = card.querySelector("[data-tour-card-show-more][data-trip-id]");
    if (button instanceof HTMLElement) {
      button.setAttribute("aria-expanded", expanded ? "true" : "false");
      button.setAttribute("aria-controls", tourDetailsPanelId(tripId));
    }
    return button instanceof HTMLElement ? button : null;
  }

  function closeOtherExpandedTourDetails(activeTripId) {
    const normalizedActiveTripId = normalizeText(activeTripId);
    const expandedIds = Array.from(expandedTourIdSet())
      .map((value) => normalizeText(value))
      .filter((tripId) => tripId && tripId !== normalizedActiveTripId);
    if (!expandedIds.length) return;

    expandedIds.forEach((tripId) => {
      const card = tourCardElement(tripId);
      if (card instanceof HTMLElement) {
        const button = setTourCardExpandedDomState(card, false);
        setTourShowMoreButtonExpandedState(button, false);
      }
      setTourExpanded(tripId, false);
    });
  }

  function renderTrips(trips, { showNoResults = false } = {}) {
    if (!els.tourGrid) return;
    bindTourGridResizeHandler();
    normalizeExpandedTourIdSet();

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
      parts.push(...row.map(({ trip, index: itemIndex }) => (
        renderTourCard(trip, { index: itemIndex, expanded: isTourExpanded(trip) })
      )));
    }

    els.tourGrid.innerHTML = parts.join("");
    bindTourCardOpenHandlers();
    fitTourCardDescriptions();
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        fitTourCardDescriptions();
      });
    }
  }

  function bindTourCardOpenHandlers(root = els.tourGrid) {
    if (!(root instanceof HTMLElement)) return;

    const imageCycleButtons = root.querySelectorAll("[data-tour-image-cycle]");
    imageCycleButtons.forEach((button) => {
      if (!(button instanceof HTMLButtonElement) || button.dataset.imageCycleBound === "1") return;
      button.addEventListener("click", () => {
        cycleTourCardImage(button);
      });
      button.dataset.imageCycleBound = "1";
    });

    const imageSwipeSurfaces = root.querySelectorAll("[data-tour-media-track]");
    imageSwipeSurfaces.forEach((track) => {
      const surface = track instanceof HTMLElement ? track.closest(".tour-card__media-cycle") : null;
      bindTourCardImageSwipeHandlers(surface);
    });
    syncTourCardImageSwipeSurfaces(root);

    const showMoreButtons = root.querySelectorAll("[data-tour-card-show-more][data-trip-id]");
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

    const serviceMediaGroups = root.querySelectorAll("[data-tour-plan-service-media]");
    serviceMediaGroups.forEach((media) => {
      if (!(media instanceof HTMLElement) || media.dataset.tourPlanServiceMediaBound === "1") return;
      media.addEventListener("click", handleTourPlanServiceMediaClick);
      media.addEventListener("keydown", handleTourPlanServiceMediaKeydown);
      media.dataset.tourPlanServiceMediaBound = "1";
      normalizeTourPlanServiceMedia(media);
    });

    const daySummaryButtons = root.querySelectorAll("[data-tour-plan-summary-toggle]");
    daySummaryButtons.forEach((button) => {
      if (!(button instanceof HTMLElement) || button.dataset.tourPlanSummaryBound === "1") return;
      button.addEventListener("click", () => {
        toggleTourPlanSummaryDay(button);
      });
      button.dataset.tourPlanSummaryBound = "1";
    });

    const tourDetailsCloseButtons = root.querySelectorAll("[data-tour-details-close][data-trip-id]");
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

    const customizeButtons = root.querySelectorAll("[data-tour-customize][data-trip-id]");
    customizeButtons.forEach((button) => {
      if (!(button instanceof HTMLElement) || button.dataset.tourCustomizeBound === "1") return;
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        if (!customizeFeatureEnabled()) return;
        const tripId = normalizeText(button.getAttribute("data-trip-id"));
        if (!tripId || button.dataset.tourCustomizeLoading === "1") return;
        const replaceDetailsModal = Boolean(button.closest("[data-tour-details-modal]"));
        button.dataset.tourCustomizeLoading = "1";
        button.setAttribute("aria-disabled", "true");
        try {
          await tourCustomizer.open(tripId, {
            onClose: replaceDetailsModal
              ? ({ tourId } = {}) => {
                  const restoreTripId = normalizeText(tourId) || tripId;
                  if (!restoreTripId) return;
                  window.requestAnimationFrame(() => {
                    openTourDetailsModal(restoreTripId);
                  });
                }
              : null
          });
          if (replaceDetailsModal && tourCustomizer.isOpen()) {
            closeTourDetailsModal({ restoreFocus: false });
          }
        } catch (error) {
          console.error("Failed to open tour customizer.", error);
        } finally {
          delete button.dataset.tourCustomizeLoading;
          button.removeAttribute("aria-disabled");
        }
      });
      button.dataset.tourCustomizeBound = "1";
    });

    const tourPdfButtons = root.querySelectorAll("[data-tour-overview-pdf][data-trip-id], [data-tour-travel-plan-pdf][data-trip-id]");
    tourPdfButtons.forEach((button) => {
      if (!(button instanceof HTMLElement) || button.dataset.tourPdfBound === "1") return;
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        const tripId = normalizeText(button.getAttribute("data-trip-id"));
        if (!tripId || button.dataset.tourPdfLoading === "1") return;
        const isOverview = button.hasAttribute("data-tour-overview-pdf");
        button.dataset.tourPdfLoading = "1";
        button.setAttribute("aria-disabled", "true");
        try {
          if (isOverview) {
            await tourCustomizer.openCustomizedOverviewPdf(tripId);
          } else {
            await tourCustomizer.openCustomizedTravelPlanPdf(tripId);
          }
        } catch (error) {
          console.error("Failed to open tour PDF preview.", error);
          if (isOverview) {
            const fallbackUrl = tourOnePagerPdfUrl(findTripById(tripId));
            if (fallbackUrl) window.open(fallbackUrl, "_blank", "noopener");
          }
        } finally {
          delete button.dataset.tourPdfLoading;
          button.removeAttribute("aria-disabled");
        }
      });
      button.dataset.tourPdfBound = "1";
    });

    const buttons = root.querySelectorAll("[data-open-modal][data-trip-id]");
    buttons.forEach((button) => {
      if (button.dataset.bookingBound) return;

      button.addEventListener("click", () => {
        const tripId = button.getAttribute("data-trip-id");
        const selected = state.trips.find((trip) => trip.id === tripId);
        if (selected) {
          setBookingField("bookingDestination", tourDestinations(selected));
          setBookingField("bookingStyle", selected.styles || []);
          setSelectedTourContext(tourForSelectedContext(selected));
        } else {
          clearSelectedTourContext();
        }
        closeTourDetailsModal({ restoreFocus: false });
        openBookingModal();
      });

      button.dataset.bookingBound = "1";
    });
  }

  function focusTourShowMoreButton(tripId) {
    const button = tourShowMoreButton(tripId);
    if (button instanceof HTMLElement) {
      try {
        button.focus({ preventScroll: true });
      } catch {
        button.focus();
      }
    }
  }

  function tourCardElement(tripId) {
    if (!els.tourGrid) return null;
    const normalizedTripId = normalizeText(tripId);
    if (!normalizedTripId) return null;
    return Array.from(els.tourGrid.querySelectorAll("[data-tour-card-id]"))
      .find((card) => normalizeText(card.getAttribute("data-tour-card-id")) === normalizedTripId) || null;
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

  function isSingleColumnTourLayout() {
    return getTourGridColumnCount() === 1;
  }

  function animateTourDetailsToggle(tripId, willOpen) {
    const normalizedTripId = normalizeText(tripId);
    if (!normalizedTripId) return;

    if (willOpen) {
      openTourDetailsModal(normalizedTripId);
      return;
    }

    closeTourDetailsModal();
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
  }

  function animateTourPlanSummaryDetails(summaryDay, details, expanded) {
    if (!(summaryDay instanceof HTMLElement) || !(details instanceof HTMLElement)) return;
    clearTourPlanSummaryDetailsAnimation(details);

    if (prefersReducedMotion()) {
      details.hidden = !expanded;
      details.style.height = "";
      details.style.opacity = "";
      delete details.dataset.tourPlanSummaryDetailsAnimating;
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

  function expandTourPlanServiceImage(targetCard) {
    if (!(targetCard instanceof HTMLElement)) return;
    const media = targetCard.closest("[data-tour-plan-service-media]");
    if (!(media instanceof HTMLElement)) return;
    if (targetCard.classList.contains("tour-plan-service-card--featured")) return;

    setTourPlanServiceCardFeaturedState(targetCard, true);
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
        region: state.filters.region,
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
      state.filters.region = normalizeText(button.getAttribute("data-region"));
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

    if (!state.filters.region) {
      url.searchParams.delete("region");
    } else {
      url.searchParams.set("region", state.filters.region);
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
    const selectedRegion = normalizeText(state.filters.region);
    const selectedPlace = normalizeText(state.filters.place);
    Array.from(els.navDestinationOptions.querySelectorAll("[data-hero-destination-filter]")).forEach((button) => {
      const destination = normalizeText(button.getAttribute("data-destination"));
      const region = normalizeText(button.getAttribute("data-region"));
      const place = normalizeText(button.getAttribute("data-place"));
      const isSelected = destination === selectedDestination && region === selectedRegion && place === selectedPlace;
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
      state.filters.region = "";
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
    region = "",
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
        data-region="${escapeAttr(region)}"
        data-place="${escapeAttr(place)}"
        aria-pressed="false"
      >${escapeHTML(label)}</button>
    `;
  }

  function renderDestinationScopeMenu() {
    const catalog = destinationScopeCatalog();
    const regionByDestination = new Map();
    for (const region of catalog.regions) {
      const items = regionByDestination.get(region.destination) || [];
      items.push(region);
      regionByDestination.set(region.destination, items);
    }
    const placesByRegion = new Map();
    const placesByDestination = new Map();
    for (const place of catalog.places) {
      if (place.region_id) {
        const items = placesByRegion.get(place.region_id) || [];
        items.push(place);
        placesByRegion.set(place.region_id, items);
      } else {
        const items = placesByDestination.get(place.destination) || [];
        items.push(place);
        placesByDestination.set(place.destination, items);
      }
    }

    const destinationMarkup = catalog.destinations.map((destination) => {
      const regions = sortDestinationMenuRegions(regionByDestination.get(destination.code) || []);
      const countryPlaces = placesByDestination.get(destination.code) || [];
      return `
        <section class="hero-destination-menu__destination">
          ${renderDestinationFilterButton({
            label: destination.label,
            destination: destination.code,
            className: "hero-destination-menu__destination-button"
          })}
          ${countryPlaces.length
            ? `<div class="hero-destination-menu__places">
                ${countryPlaces.map((place) => renderDestinationFilterButton({
                  label: place.label,
                  destination: destination.code,
                  place: place.id
                })).join("")}
              </div>`
            : ""}
          ${regions.length
            ? `<div class="hero-destination-menu__regions">
                ${regions.map((region) => {
                  const places = placesByRegion.get(region.id) || [];
                  return `
                    <section class="hero-destination-menu__region">
                      ${renderDestinationFilterButton({
                        label: region.label,
                        destination: destination.code,
                        region: region.id,
                        className: "hero-destination-menu__region-button"
                      })}
                      ${places.length
                        ? `<div class="hero-destination-menu__places">
                            ${places.map((place) => renderDestinationFilterButton({
                              label: place.label,
                              destination: destination.code,
                              region: region.id,
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

  function destinationMenuRegionOrder(region, index) {
    const code = normalizeText(region?.code).toLowerCase();
    if (DESTINATION_REGION_MENU_ORDER.has(code)) return DESTINATION_REGION_MENU_ORDER.get(code);
    return DESTINATION_REGION_MENU_ORDER.size + index;
  }

  function sortDestinationMenuRegions(regions) {
    return (Array.isArray(regions) ? regions : [])
      .map((region, index) => ({ region, index, order: destinationMenuRegionOrder(region, index) }))
      .sort((left, right) => left.order - right.order || left.index - right.index)
      .map((entry) => entry.region);
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
    customTourSubmissionForTrip,
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
    closeCustomizer: () => tourCustomizer.close(),
    resolveLocalizedFrontendText,
    setFilterCheckboxes,
    setupFilterEvents,
    setupFilterSelectPanels,
    syncFilterInputs,
    tourDestinations
  };
}
