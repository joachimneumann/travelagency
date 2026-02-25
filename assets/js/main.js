/*
  Beginner-editable configuration:
  - Update destination/style labels in data/trips.json
  - Update email target in buildMailtoLink()
*/

const state = {
  trips: [],
  filteredTrips: [],
  filters: {
    dest: "all",
    style: "all"
  },
  formStep: 1
};

const TRIPS_CACHE_KEY = "chapter2_trips_cache_v4";
const TRIPS_CACHE_TTL_MS = 60 * 60 * 1000;

const els = {
  navToggle: document.getElementById("navToggle"),
  siteNav: document.getElementById("siteNav"),
  navDestination: document.getElementById("navDestination"),
  navStyle: document.getElementById("navStyle"),
  clearFilters: document.getElementById("clearFilters"),
  activeFilters: document.getElementById("activeFilters"),
  toursTitle: document.getElementById("toursTitle"),
  toursLead: document.getElementById("toursLead"),
  tourGrid: document.getElementById("tourGrid"),
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
  success: document.getElementById("leadSuccess"),
  manualMailto: document.getElementById("manualMailto")
};

init();

async function init() {
  setupMobileNav();
  setupFAQ();
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

function setupFilterEvents() {
  if (!els.navDestination || !els.navStyle) return;

  els.navDestination.addEventListener("change", () => {
    state.filters.dest = els.navDestination.value;
    onFilterChange();
  });

  els.navStyle.addEventListener("change", () => {
    state.filters.style = els.navStyle.value;
    onFilterChange();
  });

  els.clearFilters.addEventListener("click", () => {
    state.filters.dest = "all";
    state.filters.style = "all";
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
  state.filteredTrips = state.trips.filter((trip) => {
    const matchDest = state.filters.dest === "all" || trip.destinationCountry === state.filters.dest;
    const matchStyle = state.filters.style === "all" || trip.styles.includes(state.filters.style);
    return matchDest && matchStyle;
  });

  const tripsForGrid = selectTripsForGrid(state.filteredTrips, 6);

  renderFilterSummary();
  updateTitlesForFilters();
  renderTrips(tripsForGrid);
}

function selectTripsForGrid(trips, maxCards = 6) {
  if (trips.length <= maxCards) return trips;
  const shuffled = [...trips];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, maxCards);
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
  const cachedTrips = readTripsCache();
  if (cachedTrips) return cachedTrips;

  try {
    const response = await fetch("data/trips.json");
    if (!response.ok) throw new Error("Trip JSON request failed.");
    const trips = await response.json();
    writeTripsCache(trips);
    return trips;
  } catch (error) {
    // file:// fallback: update this embedded JSON for full offline open support
    const fallbackScript = document.getElementById("tripsFallback");
    if (!fallbackScript) return [];
    try {
      const trips = JSON.parse(fallbackScript.textContent.trim() || "[]");
      writeTripsCache(trips);
      return trips;
    } catch {
      return [];
    }
  }
}

function readTripsCache() {
  try {
    const raw = localStorage.getItem(TRIPS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.trips) || typeof parsed.cachedAt !== "number") return null;
    if (Date.now() - parsed.cachedAt > TRIPS_CACHE_TTL_MS) return null;
    return parsed.trips;
  } catch {
    return null;
  }
}

function writeTripsCache(trips) {
  try {
    localStorage.setItem(
      TRIPS_CACHE_KEY,
      JSON.stringify({
        cachedAt: Date.now(),
        trips
      })
    );
  } catch {
    // Ignore storage quota/privacy-mode failures.
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

function submitLeadForm() {
  const formData = new FormData(els.leadForm);
  const entries = Object.fromEntries(formData.entries());

  const bodyLines = [
    "New Chapter 2 Trip Inquiry",
    "",
    `Destination: ${entries.destination || ""}`,
    `Travel style: ${entries.style || ""}`,
    `Travel month: ${entries.travelMonth || ""}`,
    `Travel duration: ${entries.duration || ""}`,
    `Travelers: ${entries.travelers || ""}`,
    `Budget: ${entries.budget || ""}`,
    `Name: ${entries.name || ""}`,
    `Email: ${entries.email || ""}`,
    `Phone/WhatsApp: ${entries.phone || ""}`,
    `Language: ${entries.language || ""}`,
    "",
    `Notes: ${entries.notes || ""}`
  ];

  const mailtoHref = buildMailtoLink("hello@chapter2.live", "New discovery call request", bodyLines.join("\n"));

  els.manualMailto.href = mailtoHref;
  els.success.classList.add("show");

  // Trigger mail app for static-site fallback submission.
  window.location.href = mailtoHref;
}

function buildMailtoLink(to, subject, body) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
