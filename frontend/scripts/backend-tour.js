import {
  createApiFetcher,
  escapeHtml,
  resolveApiUrl,
  setDirtySurface
} from "./shared/backend-common.js";
import { MONTH_CODE_CATALOG } from "../../shared/generated-contract/Models/generated_Aux.js";

const qs = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");

const state = {
  id: qs.get("id") || "",
  roles: [],
  permissions: {
    canEditTours: false
  },
  tour: null,
  options: {
    destinations: [],
    styles: []
  }
};

state.originalFormSnapshot = "";

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  back: document.getElementById("backToBackend"),
  logoutLink: document.getElementById("backendLogoutLink"),
  sectionNavButtons: document.querySelectorAll("[data-backend-section]"),
  userLabel: document.getElementById("backendUserLabel"),
  title: document.getElementById("tour_title"),
  subtitle: document.getElementById("tour_subtitle"),
  error: document.getElementById("tour_error"),
  titleError: document.getElementById("tour_titleError"),
  form: document.getElementById("tour_form"),
  status: document.getElementById("tour_formStatus"),
  cancel: document.getElementById("tour_cancel_btn"),
  destinationHidden: document.getElementById("tour_destinations"),
  destinationChoices: document.getElementById("tour_destination_choices"),
  stylesHidden: document.getElementById("tour_styles"),
  styleChoices: document.getElementById("tour_style_choices"),
  seasonalityStartMonth: document.getElementById("tour_seasonality_start_month"),
  seasonalityEndMonth: document.getElementById("tour_seasonality_end_month"),
  changeImageBtn: document.getElementById("tour_change_image_btn"),
  imageUpload: document.getElementById("tour_image_upload"),
  heroImage: document.getElementById("tour_hero_image")
};

function captureTourFormSnapshot() {
  if (!els.form) return "";
  const controls = Array.from(els.form.querySelectorAll("input, select, textarea"));
  const snapshot = controls.map((control, index) => {
    const key = control.id || control.name || `${control.tagName.toLowerCase()}-${index}`;
    let value = "";
    if (control.type === "checkbox" || control.type === "radio") {
      value = control.checked;
    } else if (control.type === "file") {
      value = Array.from(control.files || []).map((file) => `${file.name}:${file.size}:${file.lastModified}`);
    } else {
      value = control.value ?? "";
    }
    return [key, value];
  });
  return JSON.stringify(snapshot);
}

function updateTourDirtyState() {
  const isDirty = state.permissions.canEditTours && captureTourFormSnapshot() !== state.originalFormSnapshot;
  setDirtySurface(els.form, isDirty);
}

function markTourSnapshotClean() {
  state.originalFormSnapshot = captureTourFormSnapshot();
  setDirtySurface(els.form, false);
}

init();

async function init() {
  const backHref = "backend.html";

  if (els.homeLink) els.homeLink.href = backHref;
  if (els.back) els.back.href = backHref;
  if (els.cancel) els.cancel.href = backHref;
  if (els.logoutLink) {
    const returnTo = `${window.location.origin}/index.html`;
    els.logoutLink.href = `${apiBase}/auth/logout?return_to=${encodeURIComponent(returnTo)}`;
  }

  bindSectionNavigation("tours");

  if (!state.id) {
    showError("Missing tour id.");
    return;
  }

  await loadAuthStatus();
  renderMonthOptions();

  if (els.form) {
    els.form.addEventListener("submit", submitForm);
    const scheduleTourDirtyState = () => window.setTimeout(updateTourDirtyState, 0);
    els.form.addEventListener("input", scheduleTourDirtyState);
    els.form.addEventListener("change", scheduleTourDirtyState);
  }
  const titleInput = document.getElementById("tour_titleInput");
  if (titleInput) {
    titleInput.addEventListener("input", clearTitleError);
  }
  if (els.changeImageBtn && els.imageUpload) {
    els.changeImageBtn.addEventListener("click", () => {
      els.imageUpload.click();
    });
  }
  if (els.imageUpload) {
    els.imageUpload.addEventListener("change", () => {
      const file = els.imageUpload.files?.[0];
      if (file) setStatus(`Selected image: ${file.name}`);
      updateTourDirtyState();
    });
  }

  loadTour();
}

function bindSectionNavigation(activeSection) {
  Array.from(els.sectionNavButtons || []).forEach((button) => {
    const section = button.dataset.backendSection;
    if (!section) return;
    button.classList.toggle("is-active", section === activeSection);
    if (section === activeSection) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
    button.addEventListener("click", () => {
      window.location.href = `backend.html?section=${encodeURIComponent(section)}`;
    });
  });
}

async function loadTour() {
  const payload = await fetchApi(`/api/v1/tours/${encodeURIComponent(state.id)}`);
  if (!payload?.tour) return;

  state.tour = payload.tour;
  state.options.destinations = Array.isArray(payload.options?.destinations) ? payload.options.destinations : [];
  state.options.styles = Array.isArray(payload.options?.styles) ? payload.options.styles : [];

  const tour = state.tour;
  const destinations = tour_destinations(tour);
  const styles = tour_styles(tour);
  updateHeader(tour, destinations, styles);

  setInput("tour_id", tour.id || "");
  setInput("tour_titleInput", tour.title || "");
  setInput("tour_travel_duration_days", toInputNumber(tour.travel_duration_days));
  setInput("tour_budget_lower_usd", toInputNumber(tour.budget_lower_usd));
  setInput("tour_priority", toInputNumber(tour.priority));
  setInput("tour_rating", toInputNumber(tour.rating));
  setInput("tour_seasonality_start_month", tour.seasonality_start_month || "");
  setInput("tour_seasonality_end_month", tour.seasonality_end_month || "");
  setInput("tour_short_description", tour.short_description || "");
  setInput("tour_highlights", Array.isArray(tour.highlights) ? tour.highlights.join("\n") : "");
  updateHeroImage(tour.image || "");

  renderDestinationChoices(destinations);
  renderStyleChoices(styles);
  applyTourPermissions();
  markTourSnapshotClean();
}

function renderDestinationChoices(selectedValues) {
  const values = dedupeValues([...(state.options.destinations || []), ...(selectedValues || [])]);
  renderCheckboxes({
    container: els.destinationChoices,
    inputName: "destinationCountryChoice",
    values,
    selectedValues,
    singleSelect: false,
    onChange: () => {
      const selected = getCheckedValues("destinationCountryChoice");
      if (els.destinationHidden) els.destinationHidden.value = selected.join(", ");
    }
  });

  if (els.destinationHidden) {
    els.destinationHidden.value = (selectedValues || []).join(", ");
  }
}

function renderStyleChoices(selectedValues) {
  const values = dedupeValues([...(state.options.styles || []), ...(selectedValues || [])]);
  renderCheckboxes({
    container: els.styleChoices,
    inputName: "styleChoice",
    values,
    selectedValues,
    singleSelect: false,
    onChange: () => {
      if (els.stylesHidden) els.stylesHidden.value = getCheckedValues("styleChoice").join(", ");
    }
  });

  if (els.stylesHidden) {
    els.stylesHidden.value = selectedValues.join(", ");
  }
}

function renderMonthOptions() {
  renderSelectOptions(els.seasonalityStartMonth, MONTH_CODE_CATALOG || []);
  renderSelectOptions(els.seasonalityEndMonth, MONTH_CODE_CATALOG || []);
}

function renderSelectOptions(select, values) {
  if (!select) return;
  const currentValue = select.value || "";
  select.innerHTML = `<option value=""></option>${values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("")}`;
  select.value = currentValue;
}

function renderCheckboxes({ container, inputName, values, selectedValues = [], singleSelect = false, onChange }) {
  if (!container) return;
  const selectedSet = new Set(selectedValues.filter(Boolean).map(choiceKey));

  const html = values
    .filter(Boolean)
    .map((value) => {
      const id = `${inputName}_${slugify(value)}`;
      const checked = selectedSet.has(choiceKey(value)) ? "checked" : "";
      return `<label class="backend-checkbox-item" for="${escapeHtml(id)}"><input type="checkbox" id="${escapeHtml(
        id
      )}" name="${escapeHtml(inputName)}" value="${escapeHtml(value)}" ${checked} />${escapeHtml(value)}</label>`;
    })
    .join("");

  container.innerHTML = html;
  container.querySelectorAll(`input[name="${inputName}"]`).forEach((input) => {
    input.addEventListener("change", () => {
      if (singleSelect && input.checked) {
        container.querySelectorAll(`input[name="${inputName}"]`).forEach((el) => {
          if (el !== input) el.checked = false;
        });
      }
      onChange();
    });
  });

  onChange();
}

function getCheckedValues(inputName) {
  return Array.from(document.querySelectorAll(`input[name="${inputName}"]:checked`)).map((el) => String(el.value || "").trim());
}

async function submitForm(event) {
  event.preventDefault();
  if (!state.permissions.canEditTours) return;
  clearError();
  clearTitleError();

  const selectedDestinationCountries = getCheckedValues("destinationCountryChoice");
  const selectedStyles = getCheckedValues("styleChoice");

  const payload = {
    title: getInput("tour_titleInput"),
    destinations: selectedDestinationCountries,
    styles: selectedStyles,
    travel_duration_days: toNumberOrNull(getInput("tour_travel_duration_days")),
    budget_lower_usd: toNumberOrNull(getInput("tour_budget_lower_usd")),
    priority: toNumberOrNull(getInput("tour_priority")),
    rating: toNumberOrNull(getInput("tour_rating")),
    seasonality_start_month: getInput("tour_seasonality_start_month"),
    seasonality_end_month: getInput("tour_seasonality_end_month"),
    short_description: getInput("tour_short_description"),
    highlights: String(getInput("tour_highlights") || "")
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean)
  };

  if (!payload.title || !payload.destinations.length || !payload.styles.length) {
    setStatus("Title, at least one Destination Country, and at least one Style are required.");
    return;
  }

  const duplicate = await findDuplicateTourTitle(payload.title, state.id);
  if (duplicate) {
    setTitleError(
      `A tour titled "${duplicate.title || payload.title}" already exists (ID: ${duplicate.id}). Please use a different title.`
    );
    setStatus("Save blocked due to duplicate title.");
    const titleInput = document.getElementById("tour_titleInput");
    if (titleInput) titleInput.focus();
    return;
  }

  setStatus("Saving...");
  const result = await fetchApi(`/api/v1/tours/${encodeURIComponent(state.id)}`, {
    method: "PATCH",
    body: payload
  });
  if (!result) return;
  if (result.tour) {
    state.tour = result.tour;
    updateHeader(state.tour, tour_destinations(state.tour), tour_styles(state.tour));
  }

  const file = els.imageUpload?.files?.[0] || null;
  if (file) {
    setStatus("Uploading image...");
    const base64 = await fileToBase64(file);
    const imageResult = await fetchApi(`/api/v1/tours/${encodeURIComponent(state.id)}/image`, {
      method: "POST",
      body: {
        filename: file.name,
        data_base64: base64
      }
    });
    if (!imageResult) return;
  }

  setStatus("Tour updated.");
  if (els.imageUpload) els.imageUpload.value = "";
  await loadTour();
}

async function fileToBase64(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      const comma = value.indexOf(",");
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

const fetchApi = createApiFetcher({
  apiBase,
  onError: (message) => showError(message),
  includeDetailInError: false,
  connectionErrorMessage: "Could not connect to backend API."
});

async function loadAuthStatus() {
  try {
    const response = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
    const payload = await response.json();
    if (!response.ok || !payload?.authenticated) {
      if (els.userLabel) els.userLabel.textContent = "";
      return;
    }
    state.roles = Array.isArray(payload.user?.roles) ? payload.user.roles : [];
    const user = payload.user?.preferred_username || payload.user?.email || payload.user?.sub || "";
    if (els.userLabel) els.userLabel.textContent = user || "";
    state.permissions.canEditTours = state.roles.includes("atp_admin");
  } catch {
    if (els.userLabel) els.userLabel.textContent = "";
    // leave defaults
  }
}

function applyTourPermissions() {
  if (state.permissions.canEditTours) return;
  if (els.changeImageBtn) els.changeImageBtn.style.display = "none";
  if (els.imageUpload) els.imageUpload.disabled = true;
  if (els.form) {
    els.form.querySelectorAll("input, textarea, select, button").forEach((el) => {
      if (el.id === "tour_cancel_btn") return;
      el.disabled = true;
    });
  }
  setStatus("Read-only access.");
}

async function findDuplicateTourTitle(title, currentTourId) {
  const normalizedTitle = normalizeCompareText(title);
  if (!normalizedTitle) return null;

  let page = 1;
  const pageSize = 100;
  const maxPages = 50;

  while (page <= maxPages) {
    const query = new URLSearchParams({
      search: title,
      page: String(page),
      page_size: String(pageSize)
    });

    const payload = await fetchApi(`/api/v1/tours?${query.toString()}`);
    if (!payload) return null;

    const items = Array.isArray(payload.items) ? payload.items : [];
    const duplicate = items.find((tour) => {
      const otherId = String(tour?.id || "").trim();
      if (!otherId || otherId === currentTourId) return false;
      return normalizeCompareText(tour?.title) === normalizedTitle;
    });
    if (duplicate) return duplicate;

    const totalPages = Number(payload.pagination?.total_pages || 1);
    if (!Number.isFinite(totalPages) || page >= totalPages) break;
    page += 1;
  }

  return null;
}

function showError(message) {
  if (!els.error) return;
  els.error.textContent = message;
  els.error.classList.add("show");
}

function clearError() {
  if (!els.error) return;
  els.error.textContent = "";
  els.error.classList.remove("show");
}

function setTitleError(message) {
  if (!els.titleError) return;
  els.titleError.textContent = message;
  els.titleError.classList.add("show");
}

function clearTitleError() {
  if (!els.titleError) return;
  els.titleError.textContent = "";
  els.titleError.classList.remove("show");
}

function setStatus(message) {
  if (!els.status) return;
  els.status.textContent = message;
}

function updateHeroImage(src) {
  if (!els.heroImage) return;
  const value = String(src || "").trim();
  if (!value) {
    els.heroImage.src = "";
    els.heroImage.classList.add("empty");
    els.heroImage.style.display = "none";
    return;
  }
  els.heroImage.src = absolutizeApiUrl(value);
  els.heroImage.classList.remove("empty");
  els.heroImage.style.display = "block";
}

function updateHeader(tour, destinations, styles) {
  if (els.title) els.title.textContent = tour?.title || "Tour";
  if (!els.subtitle) return;
  const destText = destinations.length ? destinations.join(", ") : "-";
  const styleText = styles.length ? styles.join(", ") : "-";
  els.subtitle.textContent = `Destinations: ${destText} | Styles: ${styleText}`;
}

function tour_destinations(tour) {
  if (Array.isArray(tour?.destinations) && tour.destinations.length) {
    return tour.destinations.map((value) => String(value || "").trim()).filter(Boolean);
  }
  return [];
}

function tour_styles(tour) {
  return Array.isArray(tour?.styles) ? tour.styles.map((value) => String(value || "").trim()).filter(Boolean) : [];
}

function absolutizeApiUrl(urlValue) {
  return resolveApiUrl(apiBase, urlValue);
}

function getInput(id) {
  const el = document.getElementById(id);
  return String(el?.value || "").trim();
}

function setInput(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toInputNumber(value) {
  return value === null || value === undefined ? "" : String(value);
}

function dedupeValues(values) {
  const seen = new Set();
  const out = [];
  for (const raw of values || []) {
    const value = String(raw || "").trim();
    if (!value) continue;
    const key = choiceKey(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function choiceKey(value) {
  return String(value || "").trim().toLowerCase();
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeCompareText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
