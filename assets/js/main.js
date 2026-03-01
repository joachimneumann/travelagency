/*
  Beginner-editable configuration:
  - Tour catalog is loaded from backend endpoint /public/v1/tours
*/

const state = {
  trips: [],
  filteredTrips: [],
  filters: {
    dest: "all",
    style: "all"
  },
  rankedTripsDebug: [],
  formStep: 1,
  bookingSubmitted: false,
  visibleToursCount: 3,
  showMoreUsed: false
};

const TRIPS_REQUEST_VERSION = Date.now();
const INITIAL_VISIBLE_TOURS = 3;
const SHOW_MORE_BATCH = 3;
const TOURS_CACHE_KEY = "asiatravelplan_tours_cache_v2";
const TOURS_CACHE_TTL_MS = 5 * 60 * 1000;
const TOURS_API_ENDPOINT =
  (window.ASIATRAVELPLAN_API_BASE ? `${window.ASIATRAVELPLAN_API_BASE.replace(/\/$/, "")}/public/v1/tours` : "/public/v1/tours");
const TOURS_STATIC_FALLBACK_ENDPOINT = "data/tours_fallback_data.jspn";
const BOOKING_API_ENDPOINT =
  (window.ASIATRAVELPLAN_API_BASE ? `${window.ASIATRAVELPLAN_API_BASE.replace(/\/$/, "")}/public/v1/bookings` : "/public/v1/bookings");
const BACKEND_BASE_URL = window.ASIATRAVELPLAN_API_BASE ? window.ASIATRAVELPLAN_API_BASE.replace(/\/$/, "") : "";

const els = {
  navToggle: document.getElementById("navToggle"),
  siteNav: document.getElementById("siteNav"),
  navDestination: document.getElementById("navDestination"),
  navStyle: document.getElementById("navStyle"),
  backendLoginContainer: document.getElementById("backendLoginContainer"),
  headerBackendLoginMount: document.getElementById("headerBackendLoginMount"),
  footerBackendLoginMount: document.getElementById("footerBackendLoginMount"),
  backendLoginBtn: document.getElementById("backendLoginBtn"),
  backendLoginBtnTitle: document.getElementById("backendLoginBtnTitle"),
  backendLoginBtnSubtitle: document.getElementById("backendLoginBtnSubtitle"),
  websiteAuthStatus: document.getElementById("websiteAuthStatus"),
  clearFilters: document.getElementById("clearFilters"),
  activeFilters: document.getElementById("activeFilters"),
  toursTitle: document.getElementById("toursTitle"),
  toursBooking: document.getElementById("toursBooking"),
  heroDynamicSubtitle: document.getElementById("heroDynamicSubtitle"),
  heroScrollLink: document.getElementById("heroScrollLink"),
  tourGrid: document.getElementById("tourGrid"),
  tourActions: document.getElementById("tourActions"),
  showMoreTours: document.getElementById("showMoreTours"),
  showAllTours: document.getElementById("showAllTours"),
  debugPriorityBtn: document.getElementById("debugPriorityBtn"),
  debugPriorityOutput: document.getElementById("debugPriorityOutput"),
  noResultsMessage: document.getElementById("noResultsMessage"),
  faqList: document.getElementById("faqList"),
  bookingModal: document.getElementById("bookingModal"),
  openBookingModal: document.getElementById("openBookingModal"),
  closeBookingModal: document.getElementById("closeBookingModal"),
  openModalButtons: document.querySelectorAll("[data-open-modal]"),
  bookingForm: document.getElementById("bookingForm"),
  stepBack: document.getElementById("stepBack"),
  stepNext: document.getElementById("stepNext"),
  progressSteps: document.querySelectorAll(".progress-step"),
  formSteps: document.querySelectorAll(".step"),
  error: document.getElementById("bookingError"),
  success: document.getElementById("bookingSuccess")
};

init();

async function init() {
  setupMobileNav();
  setupFAQ();
  setupHeroScroll();
  setupBackendLogin();
  loadWebsiteAuthStatus();
  setupModal();
  setupFormNavigation();

  const savedFilters = JSON.parse(localStorage.getItem("asiatravelplan_filters") || "null");
  const urlFilters = getFiltersFromURL();
  state.filters.dest = urlFilters.dest || savedFilters?.dest || "all";
  state.filters.style = urlFilters.style || savedFilters?.style || "all";

  try {
    state.trips = await loadTrips();
  } catch (error) {
    console.error("Failed to load tours from backend API.", error);
    state.trips = [];
  }
  prewarmTourImages(state.trips);

  populateFilterOptions(state.trips);
  syncFilterInputs();
  applyFilters();
  setupFilterEvents();
  prefillBookingFormWithFilters();
}

function setupMobileNav() {
  if (!els.navToggle || !els.siteNav) return;

  els.navToggle.addEventListener("click", () => {
    const isOpen = els.siteNav.classList.toggle("open");
    els.navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      els.siteNav.classList.remove("open");
      els.navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

function setupFAQ() {
  if (!els.faqList) return;
  const items = els.faqList.querySelectorAll(".faq-item");
  items.forEach((item) => {
    const button = item.querySelector(".faq-question");
    if (!button) return;

    button.addEventListener("click", () => {
      const open = item.classList.contains("open");
      item.classList.toggle("open", !open);
      button.setAttribute("aria-expanded", String(!open));
      const icon = button.querySelector("span");
      if (icon) icon.textContent = open ? "+" : "−";
    });
  });
}

function setupHeroScroll() {
  if (!els.heroScrollLink) return;

  els.heroScrollLink.addEventListener("click", (event) => {
    event.preventDefault();
    const toursSection = document.getElementById("tours");
    if (!toursSection) return;

    const header = document.querySelector(".header");
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    const targetTop = toursSection.getBoundingClientRect().top + window.scrollY - headerHeight;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth"
    });
  });
}

function setupBackendLogin() {
  if (!els.backendLoginBtn) return;

  els.backendLoginBtn.addEventListener("click", async () => {
    const backendUrl = `${window.location.origin}/backend.html`;
    const returnTo = backendUrl;
    const loginUrl = `${BACKEND_BASE_URL}/auth/login?return_to=${encodeURIComponent(returnTo)}`;
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
        credentials: "include"
      });
      const payload = await response.json();
      if (response.ok && payload?.authenticated) {
        window.location.href = backendUrl;
        return;
      }
    } catch {
      // Fall through to login redirect.
    }
    window.location.href = loginUrl;
  });
}

async function loadWebsiteAuthStatus() {
  if (!els.websiteAuthStatus) return;

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/auth/me`, {
      credentials: "include"
    });
    const payload = await response.json();
    if (!response.ok || !payload?.authenticated) {
      placeBackendLogin(false);
      updateBackendButtonLabel({ authenticated: false, user: "" });
      return;
    }
    const user = payload.user?.preferred_username || payload.user?.email || payload.user?.sub || "authenticated user";
    placeBackendLogin(true);
    updateBackendButtonLabel({ authenticated: true, user });
  } catch {
    placeBackendLogin(false);
    updateBackendButtonLabel({ authenticated: false, user: "" });
  }
}

function placeBackendLogin(authenticated) {
  if (!els.backendLoginContainer) return;
  const target = authenticated ? els.headerBackendLoginMount : els.footerBackendLoginMount;
  if (!target) return;
  if (els.backendLoginContainer.parentElement !== target) {
    target.appendChild(els.backendLoginContainer);
  }
}

function updateBackendButtonLabel({ authenticated, user }) {
  if (!els.backendLoginBtnTitle || !els.backendLoginBtnSubtitle) return;

  if (authenticated) {
    els.backendLoginBtnTitle.textContent = "Backend";
    els.backendLoginBtnSubtitle.textContent = user || "";
    els.backendLoginBtnSubtitle.hidden = !Boolean(user);
    return;
  }

  els.backendLoginBtnTitle.textContent = "AsiaTravelPlan Backend";
  els.backendLoginBtnSubtitle.textContent = "";
  els.backendLoginBtnSubtitle.hidden = true;
}

function setupFilterEvents() {
  if (!els.navDestination || !els.navStyle) return;

  els.navDestination.addEventListener("change", () => {
    state.filters.dest = els.navDestination.value;
    state.visibleToursCount = INITIAL_VISIBLE_TOURS;
    state.showMoreUsed = false;
    onFilterChange();
  });

  els.navStyle.addEventListener("change", () => {
    state.filters.style = els.navStyle.value;
    state.visibleToursCount = INITIAL_VISIBLE_TOURS;
    state.showMoreUsed = false;
    onFilterChange();
  });

  els.clearFilters.addEventListener("click", () => {
    state.filters.dest = "all";
    state.filters.style = "all";
    state.visibleToursCount = INITIAL_VISIBLE_TOURS;
    state.showMoreUsed = false;
    syncFilterInputs();
    onFilterChange();
  });
}

function onFilterChange() {
  saveFilters();
  updateURLWithFilters();
  applyFilters();
  prefillBookingFormWithFilters();
}

function saveFilters() {
  localStorage.setItem("asiatravelplan_filters", JSON.stringify(state.filters));
}

function applyFilters() {
  const matchingTrips = state.trips.filter((trip) => {
    const destinationCountries = tourDestinationCountries(trip);
    const matchDest = state.filters.dest === "all" || destinationCountries.includes(state.filters.dest);
    const matchStyle = state.filters.style === "all" || trip.styles.includes(state.filters.style);
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
  const header = `Filter: ${destLabel}, ${styleLabel}`;
  els.debugPriorityOutput.textContent = `${header}\n${lines.join("\n") || "No tours in current filter."}`;
}

function renderVisibleTrips() {
  const visibleTrips = state.filteredTrips.slice(0, state.visibleToursCount);
  renderTrips(visibleTrips);
  updateTourActions();
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

  const moreCount = Math.min(SHOW_MORE_BATCH, remaining);
  const showMoreAvailable = !state.showMoreUsed && moreCount > 0;
  const showAllAvailable = state.showMoreUsed && remaining > 0;
  const noFilterSelected = state.filters.dest === "all" && state.filters.style === "all";

  els.tourActions.hidden = !(showMoreAvailable || showAllAvailable);

  if (showMoreAvailable) {
    els.showMoreTours.hidden = false;
    if (noFilterSelected) {
      els.showMoreTours.textContent = "show more tours";
    } else {
      els.showMoreTours.textContent = buildShowMoreToursLabel(moreCount);
    }
  } else {
    els.showMoreTours.hidden = true;
  }

  if (showAllAvailable) {
    els.showAllTours.hidden = false;
    els.showAllTours.textContent = remaining === 1 ? "There is one more tour" : `show the remaining ${remaining} tours`;
  } else {
    els.showAllTours.hidden = true;
  }
}

function buildShowMoreToursLabel(moreCount) {
  const style = state.filters.style;
  const destination = state.filters.dest;
  const countText = `${moreCount}`;

  if (style !== "all") {
    return `show ${countText} more ${style.toLowerCase()} tours`;
  }

  if (destination !== "all") {
    return `show ${countText} more tours in ${destination}`;
  }

  return moreCount === 1 ? "show more 1 tour" : `show more ${countText} tours`;
}

function formatFilterValue(value, kind) {
  if (value !== "all") return value;
  return kind === "destination" ? "All destinations" : "All styles";
}

function renderFilterSummary() {
  const chips = [];
  chips.push(renderChip("Destination", state.filters.dest));
  chips.push(renderChip("Style", state.filters.style));
  els.activeFilters.innerHTML = chips.join("");
}

function renderChip(label, value) {
  const active = value !== "all";
  const text = active ? value : `All ${label.toLowerCase()}s`;
  return `<span class="filter-pill ${active ? "active" : ""}">${label}: ${text}</span>`;
}

function updateTitlesForFilters() {
  const dest = state.filters.dest;
  const style = state.filters.style;

  let heading = "Featured tours you can tailor";
  let booking = "Browse by destination and style. Filters update instantly and can be shared by URL.";
  let pageTitle = "AsiaTravelPlan | Custom Southeast Asia Holidays";

  if (dest !== "all" && style !== "all") {
    heading = `${style} tours in ${dest}`;
    booking = `Showing ${style.toLowerCase()} journeys in ${dest}. Clear filters to see all options.`;
    pageTitle = `AsiaTravelPlan | ${style} Tours in ${dest}`;
  } else if (dest !== "all") {
    heading = `Featured tours in ${dest}`;
    booking = `Showing all travel styles available in ${dest}.`;
    pageTitle = `AsiaTravelPlan | Tours in ${dest}`;
  } else if (style !== "all") {
    heading = `${style} travel styles across Southeast Asia`;
    booking = `Showing ${style.toLowerCase()} journeys across Vietnam, Thailand, Cambodia, and Laos.`;
    pageTitle = `AsiaTravelPlan | ${style} Southeast Asia Tours`;
  }

  if (els.toursTitle) els.toursTitle.textContent = heading;
  if (els.toursBooking) els.toursBooking.textContent = booking;
  if (els.heroDynamicSubtitle) {
    els.heroDynamicSubtitle.textContent = heading;
    const noFilterSelected = dest === "all" && style === "all";
    els.heroDynamicSubtitle.hidden = noFilterSelected;
  }
  document.title = pageTitle;
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
      const tags = trip.styles.map((style) => `<span class="tag">${escapeHTML(style)}</span>`).join("");
      const countries = tourDestinationCountries(trip);
      const countriesLabel = countries.join(", ");
      const price = typeof trip.priceFrom === "number" ? `From $${trip.priceFrom}` : "Custom quote";
      const rating = typeof trip.rating === "number" ? `★ ${trip.rating.toFixed(1)}` : "";
      const loading = index < 3 ? "eager" : "lazy";
      const fetchpriority = index < 3 ? "high" : "auto";

      return `
        <article class="tour-card">
          <img
            src="${escapeAttr(trip.image)}"
            alt="${escapeAttr(trip.title)} in ${escapeAttr(countriesLabel)}"
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
            <h3 class="tour-title">${escapeHTML(trip.title)}</h3>
            <p class="tour-desc">${escapeHTML(trip.shortDescription)}</p>
            <div class="tags">${tags}</div>
            <div class="meta">
              <span>${trip.durationDays} days</span>
              <span>${escapeHTML(price)}</span>
            </div>
            <button class="btn btn-primary" type="button" data-open-modal data-trip-id="${escapeAttr(trip.id)}">Plan this trip</button>
          </div>
        </article>
      `;
    })
    .join("");

  els.tourGrid.innerHTML = cards;
  // Re-bind modal opener buttons created after rendering cards.
  els.tourGrid.querySelectorAll("[data-open-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tripId = btn.getAttribute("data-trip-id");
      const selected = state.trips.find((t) => t.id === tripId);
      if (selected) {
        const firstDestination = tourDestinationCountries(selected)[0] || "";
        setBookingField("bookingDestination", firstDestination);
        setBookingField("bookingStyle", selected.styles[0] || "");
      }
      openBookingModal();
    });
  });
}

function populateFilterOptions(trips) {
  const destinations = Array.from(new Set(trips.flatMap((trip) => tourDestinationCountries(trip)))).sort();
  const styles = Array.from(new Set(trips.flatMap((trip) => trip.styles))).sort();

  for (const destination of destinations) {
    els.navDestination.insertAdjacentHTML("beforeend", `<option>${escapeHTML(destination)}</option>`);
  }

  for (const style of styles) {
    els.navStyle.insertAdjacentHTML("beforeend", `<option>${escapeHTML(style)}</option>`);
  }
}

function tourDestinationCountries(trip) {
  if (Array.isArray(trip?.destinationCountries) && trip.destinationCountries.length) {
    return trip.destinationCountries.map((value) => String(value || "").trim()).filter(Boolean);
  }
  return [];
}

function syncFilterInputs() {
  els.navDestination.value = state.filters.dest;
  els.navStyle.value = state.filters.style;
}

function updateURLWithFilters() {
  const url = new URL(window.location.href);

  if (state.filters.dest === "all") {
    url.searchParams.delete("dest");
  } else {
    url.searchParams.set("dest", state.filters.dest);
  }

  if (state.filters.style === "all") {
    url.searchParams.delete("style");
  } else {
    url.searchParams.set("style", state.filters.style);
  }

  window.history.replaceState({}, "", url.toString());
}

function getFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  const dest = params.get("dest") || "";
  const style = params.get("style") || "";
  return { dest, style };
}

async function loadTrips() {
  const cached = getCachedTours();
  if (cached) return cached;

  try {
    const response = await fetch(`${TOURS_API_ENDPOINT}?v=${TRIPS_REQUEST_VERSION}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Backend tours request failed with status ${response.status}.`);
    }
    const payload = await response.json();
    const items = normalizeToursForFrontend(Array.isArray(payload) ? payload : payload.items || []);
    setCachedTours(items);
    return items;
  } catch (error) {
    const fallbackResponse = await fetch(`${TOURS_STATIC_FALLBACK_ENDPOINT}?v=${TRIPS_REQUEST_VERSION}`, { cache: "no-store" });
    if (!fallbackResponse.ok) {
      throw error;
    }
    const fallbackPayload = await fallbackResponse.json();
    const items = normalizeToursForFrontend(Array.isArray(fallbackPayload) ? fallbackPayload : fallbackPayload.items || []);
    setCachedTours(items);
    return items;
  }
}

function normalizeToursForFrontend(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const image = resolveTourImage(item);
    return {
      ...item,
      image
    };
  });
}

function resolveTourImage(item) {
  const raw = String(item?.image || "").trim();
  if (!raw) return raw;

  const backendImagePath = raw.startsWith("/public/v1/tour-images/") || raw.startsWith("public/v1/tour-images/");
  if (!BACKEND_BASE_URL && backendImagePath) {
    const titleSlug = slugify(String(item?.title || "").trim()) || "tour";
    return `assets/img/tours_fallback_images/${titleSlug}.webp`;
  }

  return absolutizeBackendUrl(raw);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function localAssetPathFromLegacyId(legacyId) {
  if (!legacyId.startsWith("trip-")) return "";
  const parts = legacyId.slice(5).split("-");
  if (parts.length < 3) return "";

  const country = (parts.shift() || "").toLowerCase();
  const style = (parts.shift() || "").toLowerCase();
  const variant = parts.join("-").toLowerCase();
  if (!country || !style || !variant) return "";

  const variantUnderscored = variant.replace(/-/g, "_");
  return `assets/tours/${country}/${style}/${country}-${style}-${variantUnderscored}.webp`;
}

function absolutizeBackendUrl(urlValue) {
  const value = String(urlValue || "").trim();
  if (!value) return value;
  if (value.startsWith("assets/")) return value;
  if (value.startsWith("/assets/")) return value;
  if (value.startsWith("./assets/")) return value.replace(/^\.\//, "");
  if (!BACKEND_BASE_URL) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return `${BACKEND_BASE_URL}${value}`;
  return `${BACKEND_BASE_URL}/${value}`;
}

function getCachedTours() {
  try {
    const raw = localStorage.getItem(TOURS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ts = Number(parsed?.ts || 0);
    const items = parsed?.items;
    if (!Array.isArray(items)) return null;
    if (Date.now() - ts > TOURS_CACHE_TTL_MS) return null;
    return normalizeToursForFrontend(items);
  } catch {
    return null;
  }
}

function setCachedTours(items) {
  try {
    localStorage.setItem(
      TOURS_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        items: Array.isArray(items) ? items : []
      })
    );
  } catch {
    // ignore cache write issues
  }
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

function setupModal() {
  if (!els.bookingModal) return;

  const openButtons = [els.openBookingModal, ...els.openModalButtons].filter(Boolean);
  openButtons.forEach((button) => {
    button.addEventListener("click", openBookingModal);
  });

  els.closeBookingModal.addEventListener("click", closeBookingModal);

  els.bookingModal.addEventListener("click", (event) => {
    if (event.target === els.bookingModal) closeBookingModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.bookingModal.getAttribute("aria-hidden") === "false") {
      closeBookingModal();
    }
  });
}

function openBookingModal() {
  prefillBookingFormWithFilters();
  clearBookingFeedback();
  els.bookingModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  const firstInput = els.bookingForm.querySelector(".step.active input, .step.active select, .step.active textarea");
  if (firstInput) firstInput.focus();
}

function closeBookingModal() {
  els.bookingModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function setupFormNavigation() {
  if (!els.bookingForm) return;

  els.stepBack.addEventListener("click", () => {
    if (state.bookingSubmitted) return;
    if (state.formStep > 1) {
      state.formStep -= 1;
      renderFormStep();
    }
  });

  els.stepNext.addEventListener("click", () => {
    if (state.bookingSubmitted) return;
    if (state.formStep < 3) {
      const valid = validateCurrentStep();
      if (!valid) return;
      state.formStep += 1;
      renderFormStep();
      return;
    }

    const valid = validateCurrentStep();
    if (!valid) return;
    submitBookingForm();
  });

  renderFormStep();
}

if (els.showMoreTours) {
  els.showMoreTours.addEventListener("click", () => {
    const remaining = Math.max(0, state.filteredTrips.length - state.visibleToursCount);
    const toShow = Math.min(SHOW_MORE_BATCH, remaining);
    if (!toShow) return;
    state.visibleToursCount += toShow;
    state.showMoreUsed = true;
    renderVisibleTrips();
  });
}

if (els.showAllTours) {
  els.showAllTours.addEventListener("click", () => {
    state.visibleToursCount = state.filteredTrips.length;
    renderVisibleTrips();
  });
}

if (els.debugPriorityBtn && els.debugPriorityOutput) {
  els.debugPriorityBtn.addEventListener("click", () => {
    const isHidden = els.debugPriorityOutput.hidden;
    els.debugPriorityOutput.hidden = !isHidden;
    if (isHidden) renderPriorityDebug();
  });
}

function renderFormStep() {
  els.formSteps.forEach((step) => {
    const isCurrent = Number(step.getAttribute("data-step")) === state.formStep;
    step.classList.toggle("active", isCurrent);
  });

  els.progressSteps.forEach((step) => {
    const index = Number(step.getAttribute("data-step"));
    step.classList.toggle("active", index <= state.formStep);
  });

  els.stepBack.style.visibility = state.formStep === 1 ? "hidden" : "visible";
  els.stepNext.textContent = state.formStep === 3 ? "Submit request" : "Next";
}

function validateCurrentStep() {
  const activeStep = els.bookingForm.querySelector(`.step[data-step="${state.formStep}"]`);
  if (!activeStep) return true;

  let isValid = true;
  const fields = activeStep.querySelectorAll(".field");

  fields.forEach((field) => {
    field.classList.remove("invalid");
    const input = field.querySelector("input, select, textarea");
    if (!input || !input.hasAttribute("required")) return;

    if (input.type === "checkbox") {
      if (!input.checked) {
        field.classList.add("invalid");
        isValid = false;
      }
      return;
    }

    const value = input.value.trim();
    const isEmail = input.type === "email";
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

    if (!value || (isEmail && !emailValid)) {
      field.classList.add("invalid");
      isValid = false;
    }
  });

  return isValid;
}

async function submitBookingForm() {
  clearBookingFeedback();
  els.stepNext.disabled = true;
  els.stepBack.disabled = true;

  const formData = new FormData(els.bookingForm);
  const entries = Object.fromEntries(formData.entries());

  const payload = {
    destination: entries.destination || "",
    style: entries.style || "",
    travelMonth: entries.travelMonth || "",
    duration: entries.duration || "",
    travelers: entries.travelers || "",
    budget: entries.budget || "",
    name: entries.name || "",
    email: entries.email || "",
    phone: entries.phone || "",
    language: entries.language || "",
    notes: entries.notes || "",
    pageUrl: window.location.href,
    referrer: document.referrer || "",
    utm_source: getQueryParam("utm_source"),
    utm_medium: getQueryParam("utm_medium"),
    utm_campaign: getQueryParam("utm_campaign")
  };

  const idempotencyKey = `booking_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  try {
    const response = await fetch(BOOKING_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(buildBookingSubmissionDebugMessage(response.status, response.statusText, responseText));
    }
    state.bookingSubmitted = true;
    els.success.classList.add("show");
    els.stepNext.textContent = "Submitted";
    els.stepNext.disabled = true;
    els.stepBack.disabled = true;
    return;
  } catch (error) {
    renderBookingError(
      "We could not submit your request right now. Please try again in a few minutes.",
      error?.message || "Unknown booking submission error."
    );
    els.stepNext.disabled = false;
    els.stepBack.disabled = false;
    console.error(error);
  }
}

function clearBookingFeedback() {
  if (els.error) {
    els.error.replaceChildren();
    els.error.classList.remove("show");
  }
  if (els.success) {
    els.success.classList.remove("show");
  }
  if (els.stepNext) {
    els.stepNext.disabled = state.bookingSubmitted;
  }
  if (els.stepBack) {
    els.stepBack.disabled = state.bookingSubmitted || state.formStep === 1;
  }
}

function renderBookingError(message, debugMessage) {
  if (!els.error) return;

  const summary = document.createElement("p");
  summary.className = "booking-error-summary";
  summary.textContent = message;
  els.error.appendChild(summary);

  if (debugMessage) {
    const details = document.createElement("details");
    details.className = "booking-error-details";

    const detailsSummary = document.createElement("summary");
    detailsSummary.textContent = "More";
    details.appendChild(detailsSummary);

    const debug = document.createElement("pre");
    debug.className = "booking-error-debug";
    debug.textContent = debugMessage;
    details.appendChild(debug);

    els.error.appendChild(details);
  }

  els.error.classList.add("show");
}

function buildBookingSubmissionDebugMessage(status, statusText, responseText) {
  const suffix = normalizeBookingDebugText(responseText);
  const header = `Booking API request failed with HTTP ${status}${statusText ? ` ${statusText}` : ""}.`;
  return suffix ? `${header}\n\n${suffix}` : header;
}

function normalizeBookingDebugText(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > 4000 ? `${text.slice(0, 4000)}\n\n[truncated]` : text;
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || "";
}

function prefillBookingFormWithFilters() {
  if (state.filters.dest !== "all") setBookingField("bookingDestination", state.filters.dest);
  if (state.filters.style !== "all") setBookingField("bookingStyle", state.filters.style);
}

function setBookingField(id, value) {
  const field = document.getElementById(id);
  if (!field || !value) return;

  const optionValues = Array.from(field.options || []).map((option) => option.value);
  if (optionValues.includes(value)) {
    field.value = value;
  }
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHTML(value);
}
