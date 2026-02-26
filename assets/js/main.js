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
  visibleToursCount: 3,
  showMoreUsed: false
};

const TRIPS_REQUEST_VERSION = Date.now();
const INITIAL_VISIBLE_TOURS = 3;
const SHOW_MORE_BATCH = 3;
const TOURS_CACHE_KEY = "chapter2_tours_cache_v1";
const TOURS_CACHE_TTL_MS = 5 * 60 * 1000;
const LEAD_API_ENDPOINT =
  (window.CHAPTER2_API_BASE ? `${window.CHAPTER2_API_BASE.replace(/\/$/, "")}/public/v1/leads` : "/public/v1/leads");
const BACKEND_BASE_URL = window.CHAPTER2_API_BASE ? window.CHAPTER2_API_BASE.replace(/\/$/, "") : "";

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
  toursLead: document.getElementById("toursLead"),
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
  leadModal: document.getElementById("leadModal"),
  openLeadModal: document.getElementById("openLeadModal"),
  closeLeadModal: document.getElementById("closeLeadModal"),
  openModalButtons: document.querySelectorAll("[data-open-modal]"),
  leadForm: document.getElementById("leadForm"),
  stepBack: document.getElementById("stepBack"),
  stepNext: document.getElementById("stepNext"),
  progressSteps: document.querySelectorAll(".progress-step"),
  formSteps: document.querySelectorAll(".step"),
  error: document.getElementById("leadError"),
  success: document.getElementById("leadSuccess")
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

  const savedFilters = JSON.parse(localStorage.getItem("chapter2_filters") || "null");
  const urlFilters = getFiltersFromURL();
  state.filters.dest = urlFilters.dest || savedFilters?.dest || "all";
  state.filters.style = urlFilters.style || savedFilters?.style || "all";

  state.trips = await loadTrips();

  populateFilterOptions(state.trips);
  syncFilterInputs();
  applyFilters();
  setupFilterEvents();
  prefillLeadFormWithFilters();
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
    const returnTo = `${window.location.origin}/backend.html`;
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
    els.backendLoginBtnTitle.textContent = "backend";
    els.backendLoginBtnSubtitle.textContent = user || "";
    els.backendLoginBtnSubtitle.hidden = !Boolean(user);
    return;
  }

  els.backendLoginBtnTitle.textContent = "Chapter2 backend";
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
  prefillLeadFormWithFilters();
}

function saveFilters() {
  localStorage.setItem("chapter2_filters", JSON.stringify(state.filters));
}

function applyFilters() {
  const matchingTrips = state.trips.filter((trip) => {
    const matchDest = state.filters.dest === "all" || trip.destinationCountry === state.filters.dest;
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
  let lead = "Browse by destination and style. Filters update instantly and can be shared by URL.";
  let pageTitle = "Chapter 2 | Custom Southeast Asia Holidays";

  if (dest !== "all" && style !== "all") {
    heading = `${style} tours in ${dest}`;
    lead = `Showing ${style.toLowerCase()} journeys in ${dest}. Clear filters to see all options.`;
    pageTitle = `Chapter 2 | ${style} Tours in ${dest}`;
  } else if (dest !== "all") {
    heading = `Featured tours in ${dest}`;
    lead = `Showing all travel styles available in ${dest}.`;
    pageTitle = `Chapter 2 | Tours in ${dest}`;
  } else if (style !== "all") {
    heading = `${style} travel styles across Southeast Asia`;
    lead = `Showing ${style.toLowerCase()} journeys across Vietnam, Thailand, Cambodia, and Laos.`;
    pageTitle = `Chapter 2 | ${style} Southeast Asia Tours`;
  }

  if (els.toursTitle) els.toursTitle.textContent = heading;
  if (els.toursLead) els.toursLead.textContent = lead;
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
    .map((trip) => {
      const tags = trip.styles.map((style) => `<span class="tag">${escapeHTML(style)}</span>`).join("");
      const price = typeof trip.priceFrom === "number" ? `From $${trip.priceFrom}` : "Custom quote";
      const rating = typeof trip.rating === "number" ? `★ ${trip.rating.toFixed(1)}` : "";

      return `
        <article class="tour-card">
          <img
            src="${escapeAttr(trip.image)}"
            data-fallback="${escapeAttr(trip.fallbackImage || trip.image)}"
            alt="${escapeAttr(trip.title)} in ${escapeAttr(trip.destinationCountry)}"
            loading="lazy"
            width="1200"
            height="800"
          />
          <div class="tour-body">
            <div class="tour-topline">
              <span class="tour-country">${escapeHTML(trip.destinationCountry)}</span>
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

  els.tourGrid.querySelectorAll("img[data-fallback]").forEach((img) => {
    img.addEventListener("error", () => {
      const fallback = img.getAttribute("data-fallback");
      if (fallback && img.src !== fallback) {
        img.src = fallback;
      }
    });
  });

  // Re-bind modal opener buttons created after rendering cards.
  els.tourGrid.querySelectorAll("[data-open-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tripId = btn.getAttribute("data-trip-id");
      const selected = state.trips.find((t) => t.id === tripId);
      if (selected) {
        setLeadField("leadDestination", selected.destinationCountry);
        setLeadField("leadStyle", selected.styles[0] || "");
      }
      openLeadModal();
    });
  });
}

function populateFilterOptions(trips) {
  const destinations = Array.from(new Set(trips.map((trip) => trip.destinationCountry))).sort();
  const styles = Array.from(new Set(trips.flatMap((trip) => trip.styles))).sort();

  for (const destination of destinations) {
    els.navDestination.insertAdjacentHTML("beforeend", `<option>${escapeHTML(destination)}</option>`);
  }

  for (const style of styles) {
    els.navStyle.insertAdjacentHTML("beforeend", `<option>${escapeHTML(style)}</option>`);
  }
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
  try {
    if (BACKEND_BASE_URL) {
      const cached = getCachedTours();
      if (cached) return cached;

      const response = await fetch(`${BACKEND_BASE_URL}/public/v1/tours?v=${TRIPS_REQUEST_VERSION}`);
      if (!response.ok) throw new Error("Backend tours request failed.");
      const payload = await response.json();
      const items = Array.isArray(payload) ? payload : payload.items || [];
      setCachedTours(items);
      return items;
    }

    const response = await fetch(`data/trips.json?v=${TRIPS_REQUEST_VERSION}`, { cache: "reload" });
    if (!response.ok) throw new Error("Trip JSON request failed.");
    return await response.json();
  } catch (error) {
    // file:// fallback: update this embedded JSON for full offline open support
    const fallbackScript = document.getElementById("tripsFallback");
    if (!fallbackScript) return [];
    try {
      return JSON.parse(fallbackScript.textContent.trim() || "[]");
    } catch {
      return [];
    }
  }
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
    return items;
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

function setupModal() {
  if (!els.leadModal) return;

  const openButtons = [els.openLeadModal, ...els.openModalButtons].filter(Boolean);
  openButtons.forEach((button) => {
    button.addEventListener("click", openLeadModal);
  });

  els.closeLeadModal.addEventListener("click", closeLeadModal);

  els.leadModal.addEventListener("click", (event) => {
    if (event.target === els.leadModal) closeLeadModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.leadModal.getAttribute("aria-hidden") === "false") {
      closeLeadModal();
    }
  });
}

function openLeadModal() {
  prefillLeadFormWithFilters();
  clearLeadFeedback();
  els.leadModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  const firstInput = els.leadForm.querySelector(".step.active input, .step.active select, .step.active textarea");
  if (firstInput) firstInput.focus();
}

function closeLeadModal() {
  els.leadModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function setupFormNavigation() {
  if (!els.leadForm) return;

  els.stepBack.addEventListener("click", () => {
    if (state.formStep > 1) {
      state.formStep -= 1;
      renderFormStep();
    }
  });

  els.stepNext.addEventListener("click", () => {
    if (state.formStep < 3) {
      const valid = validateCurrentStep();
      if (!valid) return;
      state.formStep += 1;
      renderFormStep();
      return;
    }

    const valid = validateCurrentStep();
    if (!valid) return;
    submitLeadForm();
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
  const activeStep = els.leadForm.querySelector(`.step[data-step="${state.formStep}"]`);
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

async function submitLeadForm() {
  clearLeadFeedback();
  els.stepNext.disabled = true;
  els.stepBack.disabled = true;

  const formData = new FormData(els.leadForm);
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

  const idempotencyKey = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  try {
    const response = await fetch(LEAD_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("Lead API request failed");
    els.success.classList.add("show");
    return;
  } catch (error) {
    if (els.error) {
      els.error.textContent = "We could not submit your request right now. Please try again in a few minutes.";
      els.error.classList.add("show");
    }
    els.stepNext.disabled = false;
    els.stepBack.disabled = false;
    console.error(error);
  }
}

function clearLeadFeedback() {
  if (els.error) {
    els.error.textContent = "";
    els.error.classList.remove("show");
  }
  if (els.success) {
    els.success.classList.remove("show");
  }
  if (els.stepNext) els.stepNext.disabled = false;
  if (els.stepBack) els.stepBack.disabled = state.formStep === 1;
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name) || "";
}

function prefillLeadFormWithFilters() {
  if (state.filters.dest !== "all") setLeadField("leadDestination", state.filters.dest);
  if (state.filters.style !== "all") setLeadField("leadStyle", state.filters.style);
}

function setLeadField(id, value) {
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
