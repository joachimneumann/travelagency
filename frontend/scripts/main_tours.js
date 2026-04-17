import { normalizeText } from "../../shared/js/text.js";
import {
  FRONTEND_LANGUAGE_CODES,
  normalizeLanguageCode
} from "../../shared/generated/language_catalog.js";

const DEFAULT_TOUR_IMAGE = "/assets/img/marketing_tours.png";

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
    const style = normalizeFilterSelection(params.get("style"));
    return { dest, style };
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
      return trip.destination_codes.map((value) => normalizeText(value)).filter(Boolean);
    }
    return normalizeSelectionToCodes(tourDestinations(trip), "destination");
  }

  function tourStyleCodes(trip) {
    if (Array.isArray(trip?.style_codes) && trip.style_codes.length) {
      return trip.style_codes.map((value) => normalizeText(value)).filter(Boolean);
    }
    return normalizeSelectionToCodes(Array.isArray(trip?.styles) ? trip.styles : [], "style");
  }

  function shouldShowHeroDestinationFilter(destinations = filterOptionList("destination")) {
    return destinations.length > 1;
  }

  function normalizeActiveFiltersFromOptions() {
    state.filters.dest = shouldShowHeroDestinationFilter()
      ? normalizeSelectionToCodes(state.filters.dest, "destination", { allowUnknown: false })
      : [];
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

  function updateFilterTriggerLabels() {
    if (els.navDestinationSummary) {
      els.navDestinationSummary.textContent = formatFilterValue(state.filters.dest, "destination");
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
    const destination = filterLabels(state.filters.dest, "destination");
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
    const destLabel = formatFilterValue(dest, "destination");
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

  function resolveTourImage(item) {
    const raw = String(item?.image || "").trim();
    if (!raw) return DEFAULT_TOUR_IMAGE;
    return absolutizeBackendUrl(raw);
  }

  function normalizeToursForFrontend(items) {
    const lang = currentFrontendLang();
    return (Array.isArray(items) ? items : []).map((item) => {
      const image = resolveTourImage(item);
      const normalizedTitle = resolveLocalizedFrontendText(item?.title, lang);
      const normalizedShortDescription = resolveLocalizedFrontendText(item?.short_description, lang);
      return {
        ...item,
        title: normalizedTitle,
        short_description: normalizedShortDescription,
        image
      };
    });
  }

  function normalizeToursPayloadForFrontend(payload) {
    const source = Array.isArray(payload) ? { items: payload } : (payload || {});
    return {
      items: normalizeToursForFrontend(Array.isArray(source.items) ? source.items : []),
      available_destinations: normalizeFilterOptionList(source.available_destinations),
      available_styles: normalizeFilterOptionList(source.available_styles)
    };
  }

  async function loadTrips() {
    const lang = normalizeFrontendTourLang(currentFrontendLang());
    const response = await fetch(publicToursDataUrl(lang), { cache: "default" });
    if (!response.ok) {
      throw new Error(`Static tours request failed with status ${response.status}.`);
    }
    const payload = await response.json();
    return normalizeToursPayloadForFrontend(payload);
  }

  function renderTrips(trips) {
    if (!els.tourGrid) return;

    if (!trips.length) {
      els.tourGrid.innerHTML = "";
      els.noResultsMessage.hidden = false;
      return;
    }

    els.noResultsMessage.hidden = true;

    const cards = trips
      .map((trip, index) => {
        const tripTitle = resolveLocalizedFrontendText(trip?.title, state.lang);
        const tripShortDescription = resolveLocalizedFrontendText(trip?.short_description, state.lang);
        const tags = trip.styles.map((style) => `<span class="tag">${escapeHTML(style)}</span>`).join("");
        const countries = tourDestinations(trip);
        const countriesLabel = countries.join(", ");
        const ctaLabel = frontendT("tour.card.plan_trip", "Plan this trip");
        const moreLabel = frontendT("tour.card.more", "more");
        const loading = index < 3 ? "eager" : "lazy";
        const fetchpriority = index < 3 ? "high" : "auto";

        return `
          <article class="tour-card">
            <img
              src="${escapeAttr(trip.image)}"
              alt="${escapeAttr(frontendT("tour.card.image_alt", "{title} in {destinations}", {
                title: tripTitle,
                destinations: countriesLabel
              }))}"
              loading="${loading}"
              fetchpriority="${fetchpriority}"
              width="1200"
              height="800"
            />
            <div class="tour-body">
              <h3 class="tour-title tour-title--topline">${escapeHTML(tripTitle)}</h3>
              <div class="tour-desc-wrap">
                <p class="tour-desc" data-tour-desc>${escapeHTML(tripShortDescription)}</p>
                <button
                  class="tour-desc-toggle"
                  type="button"
                  data-tour-desc-toggle
                  data-tour-desc-trip-id="${escapeAttr(trip.id)}"
                  data-more-label="${escapeAttr(moreLabel)}"
                  hidden
                >${escapeHTML(moreLabel)}</button>
              </div>
              <div class="tags">${tags}</div>
              <button class="btn btn-primary" type="button" data-open-modal data-trip-id="${escapeAttr(trip.id)}">${escapeHTML(ctaLabel)}</button>
            </div>
          </article>
        `;
      })
      .join("");

    els.tourGrid.innerHTML = cards;
    window.requestAnimationFrame(() => {
      syncTourDescriptionToggles();
      renderTourDescriptionDetail();
    });
    bindTourCardOpenHandlers();
  }

  function syncTourDescriptionToggles() {
    if (!els.tourGrid) return;
    const cards = els.tourGrid.querySelectorAll(".tour-card");
    cards.forEach((card) => {
      const description = card.querySelector("[data-tour-desc]");
      const toggle = card.querySelector("[data-tour-desc-toggle]");
      if (!(description instanceof HTMLElement) || !(toggle instanceof HTMLButtonElement)) return;
      toggle.hidden = description.scrollHeight <= description.clientHeight + 1;
      toggle.textContent = toggle.dataset.moreLabel || frontendT("tour.card.more", "more");
    });
  }

  function selectedTourDescriptionTrip() {
    const tripId = normalizeText(state.selectedTourDescriptionId);
    if (!tripId) return null;
    return state.filteredTrips.find((trip) => normalizeText(trip?.id) === tripId)
      || state.trips.find((trip) => normalizeText(trip?.id) === tripId)
      || null;
  }

  function closeTourDescriptionDetail() {
    if (!state.selectedTourDescriptionId) return;
    state.selectedTourDescriptionId = "";
    renderTourDescriptionDetail();
  }

  function renderTourDescriptionDetail() {
    if (!els.tourDescriptionDetail) return;
    const selectedTrip = selectedTourDescriptionTrip();
    const detailBody = resolveLocalizedFrontendText(selectedTrip?.short_description, state.lang);
    const detailTitle = resolveLocalizedFrontendText(selectedTrip?.title, state.lang);

    if (!selectedTrip || !detailBody) {
      els.tourDescriptionDetail.hidden = true;
      els.tourDescriptionDetail.setAttribute("aria-hidden", "true");
      els.tourDescriptionDetail.innerHTML = "";
      return;
    }

    els.tourDescriptionDetail.hidden = false;
    els.tourDescriptionDetail.setAttribute("aria-hidden", "false");
    els.tourDescriptionDetail.innerHTML = `
      <div class="team-detail" role="dialog" aria-modal="true" aria-label="${escapeAttr(frontendT("tour.card.more", "more"))}">
        <div class="team-detail__content">
          <div class="team-detail__copy">
            <h3 class="team-detail__name">${escapeHTML(detailTitle)}</h3>
            <p class="team-detail__body">${escapeHTML(detailBody)}</p>
          </div>
        </div>
      </div>
    `;
  }

  function bindTourDescriptionDetail() {
    if (!els.tourDescriptionDetail || els.tourDescriptionDetail.dataset.tourDescBound === "1") return;
    els.tourDescriptionDetail.dataset.tourDescBound = "1";
    els.tourDescriptionDetail.addEventListener("click", () => {
      closeTourDescriptionDetail();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !state.selectedTourDescriptionId) return;
      closeTourDescriptionDetail();
    });
    window.addEventListener("resize", () => {
      window.requestAnimationFrame(syncTourDescriptionToggles);
    });
  }

  function bindTourCardOpenHandlers() {
    if (!els.tourGrid) return;
    bindTourDescriptionDetail();

    const descriptionButtons = els.tourGrid.querySelectorAll("[data-tour-desc-toggle]");
    descriptionButtons.forEach((button) => {
      if (button.dataset.descBound) return;
      button.addEventListener("click", () => {
        const tripId = normalizeText(button.getAttribute("data-tour-desc-trip-id"));
        if (!tripId) return;
        state.selectedTourDescriptionId = tripId;
        renderTourDescriptionDetail();
      });
      button.dataset.descBound = "1";
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
      const destinations = tourDestinationCodes(trip);
      const styles = tourStyleCodes(trip);
      const matchDest = !state.filters.dest.length || state.filters.dest.some((destination) => destinations.includes(destination));
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

    els.navDestinationOptions.addEventListener("change", () => {
      state.filters.dest = getCheckedValues(els.navDestinationOptions);
      state.visibleToursCount = initialVisibleTours;
      onFilterChange();
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

    if (!state.filters.style.length) {
      url.searchParams.delete("style");
    } else {
      url.searchParams.set("style", state.filters.style.join(","));
    }

    window.history.replaceState({}, "", url.toString());
  }

  function syncFilterInputs() {
    setFilterCheckboxes(els.navDestinationOptions, state.filters.dest);
    setFilterCheckboxes(els.navStyleOptions, state.filters.style);
    updateFilterTriggerLabels();
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

  function populateFilterOptions() {
    const destinations = filterOptionList("destination");
    const styles = filterOptionList("style");
    const bookingDestinations = destinations.map((option) => option.label);
    const bookingStyles = styles.map((option) => option.label);
    const destinationFilterWrap = els.navDestinationWrap;
    const showDestinationFilter = shouldShowHeroDestinationFilter(destinations);

    if (els.navDestinationOptions) {
      els.navDestinationOptions.innerHTML = [
        renderFilterClearAction("destination", frontendT("filters.all_destinations", "All destinations")),
        ...destinations.map((destination) => renderFilterCheckbox("destination", destination.code, destination.label))
      ].join("");
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
      const primary = String(tour.image || "").trim();
      for (const url of [primary]) {
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
