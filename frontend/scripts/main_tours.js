import { publicToursRequest } from "../Generated/API/generated_APIRequestFactory.js";
import { normalizeText } from "../../shared/js/text.js";

export function createFrontendToursController(ctx) {
  const {
    state,
    els,
    apiBaseOrigin,
    backendBaseUrl,
    tripsRequestVersion,
    initialVisibleTours,
    showMoreBatch,
    toursCacheTtlMs,
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
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) return "en";
    if (normalized === "en" || normalized.startsWith("en-")) return "en";
    if (normalized === "fr" || normalized.startsWith("fr-")) return "fr";
    if (normalized === "zh" || normalized.startsWith("zh-") || normalized.includes("chinese") || normalized.includes("mandarin")) return "zh";
    if (normalized === "ja" || normalized.startsWith("ja-") || normalized.includes("japanese")) return "ja";
    if (normalized === "ko" || normalized.startsWith("ko-") || normalized.includes("korean")) return "ko";
    if (normalized === "vi" || normalized.startsWith("vi-") || normalized.includes("vietnam")) return "vi";
    if (normalized === "de" || normalized.startsWith("de-") || normalized.includes("german") || normalized.includes("deutsch")) return "de";
    if (normalized === "es" || normalized.startsWith("es-") || normalized.includes("spanish") || normalized.includes("español") || normalized.includes("espanol")) return "es";
    if (normalized === "it" || normalized.startsWith("it-") || normalized.includes("italian") || normalized.includes("italiano")) return "it";
    if (normalized === "ru" || normalized.startsWith("ru-") || normalized.includes("russian") || normalized.includes("рус")) return "ru";
    if (normalized === "nl" || normalized.startsWith("nl-") || normalized.includes("dutch") || normalized.includes("nederlands")) return "nl";
    if (normalized === "pl" || normalized.startsWith("pl-") || normalized.includes("polish") || normalized.includes("polski")) return "pl";
    if (normalized === "da" || normalized.startsWith("da-") || normalized.includes("danish") || normalized.includes("dansk")) return "da";
    if (normalized === "sv" || normalized.startsWith("sv-") || normalized.includes("swedish") || normalized.includes("svenska")) return "sv";
    if (normalized === "no" || normalized.startsWith("no-") || normalized.startsWith("nb-") || normalized.startsWith("nn-") || normalized.includes("norwegian") || normalized.includes("norsk")) return "no";
    return "en";
  }

  function toursCacheKey(lang = currentFrontendLang()) {
    return `asiatravelplan_tours_cache_v7:${normalizeFrontendTourLang(lang)}`;
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

  function normalizeSelectionToCodes(values, kind) {
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
        return normalizeText(match?.code || lower).toLowerCase();
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

  function normalizeActiveFiltersFromOptions() {
    state.filters.dest = normalizeSelectionToCodes(state.filters.dest, "destination");
    state.filters.style = normalizeSelectionToCodes(state.filters.style, "style");
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

  function renderChip(label, value, kind) {
    const active = Array.isArray(value) && value.length > 0;
    const text = active
      ? filterLabels(value, kind).join(", ")
      : kind === "destination"
        ? frontendT("filters.all_destinations", "All destinations")
        : frontendT("filters.all_styles", "All travel styles");
    return `<span class="filter-pill ${active ? "active" : ""}">${label}: ${text}</span>`;
  }

  function renderFilterSummary() {
    const chips = [];
    chips.push(renderChip(frontendT("filters.destination_label", "Destination"), state.filters.dest, "destination"));
    chips.push(renderChip(frontendT("filters.style_label", "Style"), state.filters.style, "style"));
    els.activeFilters.innerHTML = chips.join("");
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

  function updateTourActions() {
    if (!els.tourActions || !els.showMoreTours || !els.showAllTours) return;

    const total = state.filteredTrips.length;
    const remaining = Math.max(0, total - state.visibleToursCount);

    if (total === 0 || remaining === 0) {
      els.tourActions.hidden = true;
      els.showMoreTours.hidden = true;
      els.showAllTours.hidden = true;
      return;
    }

    const moreCount = Math.min(showMoreBatch, remaining);
    const showMoreAvailable = !state.showMoreUsed && moreCount > 0;
    const showAllAvailable = state.showMoreUsed && remaining > 0;
    const noFilterSelected = !state.filters.dest.length && !state.filters.style.length;

    els.tourActions.hidden = !(showMoreAvailable || showAllAvailable);

    if (showMoreAvailable) {
      els.showMoreTours.hidden = false;
      if (noFilterSelected) {
        els.showMoreTours.textContent = frontendT("tours.show_more.default", "Show more tours");
      } else {
        els.showMoreTours.textContent = buildShowMoreToursLabel(moreCount);
      }
    } else {
      els.showMoreTours.hidden = true;
    }

    if (showAllAvailable) {
      els.showAllTours.hidden = false;
      els.showAllTours.textContent = remaining === 1
        ? frontendT("tours.show_remaining.one", "There is 1 more tour")
        : frontendT("tours.show_remaining.many", "Show the remaining {count} tours", { count: remaining });
    } else {
      els.showAllTours.hidden = true;
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
      els.heroDynamicSubtitle.textContent = heading;
      const noFilterSelected = !dest.length && !style.length;
      els.heroDynamicSubtitle.hidden = noFilterSelected;
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
    if (!raw) return raw;
    return absolutizeBackendUrl(raw);
  }

  function normalizeToursForFrontend(items) {
    const lang = currentFrontendLang();
    return (Array.isArray(items) ? items : []).map((item) => {
      const image = resolveTourImage(item);
      const normalizedTitle = resolveLocalizedFrontendText(item?.title, lang);
      const normalizedShortDescription = resolveLocalizedFrontendText(item?.short_description, lang);
      const normalizedHighlights = resolveLocalizedFrontendStringArray(item?.highlights, lang);
      return {
        ...item,
        title: normalizedTitle,
        short_description: normalizedShortDescription,
        highlights: normalizedHighlights,
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

  function getCachedTours() {
    try {
      const raw = localStorage.getItem(toursCacheKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const ts = Number(parsed?.ts || 0);
      if (!parsed || typeof parsed !== "object") return null;
      if (Date.now() - ts > toursCacheTtlMs) return null;
      if (!Array.isArray(parsed.items)) return null;
      return normalizeToursPayloadForFrontend(parsed);
    } catch {
      return null;
    }
  }

  function setCachedTours(payload) {
    try {
      localStorage.setItem(
        toursCacheKey(),
        JSON.stringify({
          ts: Date.now(),
          items: Array.isArray(payload?.items) ? payload.items : [],
          available_destinations: Array.isArray(payload?.available_destinations) ? payload.available_destinations : [],
          available_styles: Array.isArray(payload?.available_styles) ? payload.available_styles : []
        })
      );
    } catch {
      // ignore cache write issues
    }
  }

  async function loadTrips() {
    const cached = getCachedTours();
    if (cached) return cached;

    const toursRequest = publicToursRequest({
      baseURL: apiBaseOrigin,
      query: { v: tripsRequestVersion, lang: currentFrontendLang() }
    });
    const response = await fetch(toursRequest.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Backend tours request failed with status ${response.status}.`);
    }
    const payload = await response.json();
    const normalizedPayload = normalizeToursPayloadForFrontend(payload);
    setCachedTours(normalizedPayload);
    return normalizedPayload;
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
        const displayCurrency = preferredCurrencyForFrontendLang(state.lang);
        const displayAmount = approximateDisplayAmountFromUSD(trip?.budget_lower_usd, displayCurrency);
        const priceLabel = Number.isFinite(displayAmount)
          ? formatDisplayMoney(displayAmount, displayCurrency, state.lang || currentFrontendLang())
          : formatDisplayMoney(trip?.budget_lower_usd, defaultBookingCurrency, state.lang || currentFrontendLang());
        const price = typeof trip.budget_lower_usd === "number"
          ? frontendT("tour.card.from_price", "From ${price}", { price: priceLabel })
          : frontendT("tour.card.custom_quote", "Custom quote");
        const rating = typeof trip.rating === "number" ? `★ ${trip.rating.toFixed(1)}` : "";
        const daysLabel = frontendT("tour.card.days", "{days} days", { days: trip.travel_duration_days });
        const ctaLabel = frontendT("tour.card.plan_trip", "Plan this trip");
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
              <div class="tour-topline">
                <span class="tour-country">${escapeHTML(countriesLabel)}</span>
                <span class="rating">${escapeHTML(rating)}</span>
              </div>
              <h3 class="tour-title">${escapeHTML(tripTitle)}</h3>
              <p class="tour-desc">${escapeHTML(tripShortDescription)}</p>
              <div class="tags">${tags}</div>
              <div class="meta">
                <span>${escapeHTML(daysLabel)}</span>
                <span>${escapeHTML(price)}</span>
              </div>
              <button class="btn btn-primary" type="button" data-open-modal data-trip-id="${escapeAttr(trip.id)}">${escapeHTML(ctaLabel)}</button>
            </div>
          </article>
        `;
      })
      .join("");

    els.tourGrid.innerHTML = cards;
    bindTourCardOpenHandlers();
  }

  function bindTourCardOpenHandlers() {
    if (!els.tourGrid) return;

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
    return trips
      .map((trip) => {
        const basePriority = Number.isFinite(Number(trip.priority)) ? Number(trip.priority) : 50;
        const randomBoost = Math.floor(Math.random() * 51);
        return {
          trip,
          priority: basePriority,
          randomBoost,
          score: basePriority + randomBoost
        };
      })
      .sort((a, b) => b.score - a.score)
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
      state.showMoreUsed = false;
      onFilterChange();
    });

    els.navStyleOptions.addEventListener("change", () => {
      state.filters.style = getCheckedValues(els.navStyleOptions);
      state.visibleToursCount = initialVisibleTours;
      state.showMoreUsed = false;
      onFilterChange();
    });

    els.clearFilters.addEventListener("click", () => {
      state.filters.dest = [];
      state.filters.style = [];
      state.visibleToursCount = initialVisibleTours;
      state.showMoreUsed = false;
      syncFilterInputs();
      onFilterChange();
    });
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

  function populateFilterOptions() {
    const destinations = filterOptionList("destination");
    const styles = filterOptionList("style");
    const bookingDestinations = destinations.map((option) => option.label);
    const bookingStyles = styles.map((option) => option.label);

    if (els.navDestinationOptions) {
      els.navDestinationOptions.innerHTML = destinations
        .map((destination) => renderFilterCheckbox("destination", destination.code, destination.label))
        .join("");
    }

    if (els.navStyleOptions) {
      els.navStyleOptions.innerHTML = styles
        .map((style) => renderFilterCheckbox("style", style.code, style.label))
        .join("");
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
