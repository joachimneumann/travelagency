import {
  createApiFetcher,
  escapeHtml,
  resolveApiUrl,
  setDirtySurface
} from "../shared/api.js?v=f09b901159f7";
import { MONTH_CODE_CATALOG } from "../shared/generated_catalogs.js?v=f09b901159f7";
import {
  CUSTOMER_CONTENT_LANGUAGES,
  normalizeLanguageCode
} from "../../../shared/generated/language_catalog.js?v=f09b901159f7";

function backendT(id, fallback, vars) {
  if (typeof window.backendT === "function") {
    return window.backendT(id, fallback, vars);
  }
  const template = String(fallback ?? id);
  if (!vars || typeof vars !== "object") return template;
  return template.replace(/\{([^{}]+)\}/g, (match, key) => {
    const normalizedKey = String(key || "").trim();
    return normalizedKey in vars ? String(vars[normalizedKey]) : match;
  });
}

async function waitForBackendI18n() {
  await (window.__BACKEND_I18N_PROMISE || Promise.resolve());
}

function currentBackendLang() {
  return typeof window.backendI18n?.getLang === "function" ? window.backendI18n.getLang() : "";
}

function withBackendLang(pathname, params = {}) {
  const url = new URL(pathname, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  const lang = currentBackendLang();
  if (lang) url.searchParams.set("lang", lang);
  return `${url.pathname}${url.search}`;
}

function withApiLang(pathname, params = {}) {
  const url = new URL(pathname, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  const lang = currentBackendLang();
  if (lang) url.searchParams.set("lang", lang);
  return `${url.pathname}${url.search}`;
}

const qs = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");

function normalizeText(value) {
  return String(value ?? "").trim();
}

const state = {
  id: qs.get("id") || "",
  is_create_mode: !normalizeText(qs.get("id") || ""),
  authenticated: false,
  roles: [],
  permissions: {
    canEditTours: false
  },
  tour: null,
  options: {
    destinations: [],
    styles: []
  },
  localizedContent: {
    short_description_i18n: {},
    highlights_i18n: {}
  }
};

state.originalFormSnapshot = "";

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  back: document.getElementById("backToBackend"),
  logoutLink: null,
  sectionNavButtons: document.querySelectorAll("[data-backend-section]"),
  userLabel: null,
  title: document.getElementById("tour_title"),
  titleInput: document.getElementById("tour_title_input"),
  titleEditBtn: document.getElementById("tour_title_edit_btn"),
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
  shortDescriptionEditor: document.getElementById("tour_short_description_editor"),
  highlightsEditor: document.getElementById("tour_highlights_editor"),
  changeImageBtn: document.getElementById("tour_change_image_btn"),
  imageUpload: document.getElementById("tour_image_upload"),
  heroImage: document.getElementById("tour_hero_image")
};

function refreshBackendNavElements() {
  els.logoutLink = document.getElementById("backendLogoutLink");
  els.userLabel = document.getElementById("backendUserLabel");
}

function captureTourFormSnapshot() {
  if (!els.form) return "";
  const controls = Array.from(els.form.querySelectorAll("input, select, textarea"));
  if (els.titleInput && !els.form.contains(els.titleInput)) {
    controls.unshift(els.titleInput);
  }
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

function tourTextLanguages() {
  return Array.isArray(CUSTOMER_CONTENT_LANGUAGES) ? CUSTOMER_CONTENT_LANGUAGES : [];
}

function normalizeTourTextLang(value) {
  return normalizeLanguageCode(value, { fallback: "en" });
}

function normalizeLocalizedTextMap(value, { multiline = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([lang, entry]) => {
        const normalizedLang = normalizeTourTextLang(lang);
        const normalizedEntry = multiline
          ? String(entry ?? "")
          : String(entry ?? "").trim();
        return [normalizedLang, normalizedEntry];
      })
      .filter(([, entry]) => multiline ? String(entry).trim().length > 0 : Boolean(entry))
  );
}

function localizedFieldValue(field, lang) {
  const normalizedLang = normalizeTourTextLang(lang);
  const map = state.localizedContent?.[field];
  if (map && typeof map === "object" && !Array.isArray(map)) {
    return String(map[normalizedLang] ?? "");
  }
  return "";
}

function localizedTextareaId(field, lang) {
  return `tour_${field}_${normalizeTourTextLang(lang)}`;
}

function getLocalizedTextarea(field, lang) {
  return document.getElementById(localizedTextareaId(field, lang));
}

function buildTourTranslationEntries(field, sourceText) {
  if (field === "highlights_i18n") {
    const lines = String(sourceText || "")
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
    return Object.fromEntries(lines.map((line, index) => [`line_${index}`, line]));
  }

  const value = String(sourceText || "").trim();
  return value ? { value } : {};
}

async function requestTourTranslation(field, targetLang, sourceText) {
  const entries = buildTourTranslationEntries(field, sourceText);
  if (!Object.keys(entries).length) return null;

  const result = await fetchApi(withApiLang("/api/v1/tours/translate-fields"), {
    method: "POST",
    body: {
      source_lang: "en",
      target_lang: targetLang,
      entries
    }
  });
  return result?.entries || null;
}

function applyTranslatedTourField(field, targetLang, translatedEntries) {
  const targetInput = getLocalizedTextarea(field, targetLang);
  if (!targetInput || !translatedEntries) return;

  if (field === "highlights_i18n") {
    const translatedLines = Object.entries(translatedEntries)
      .sort((left, right) => {
        const leftIndex = Number(String(left[0]).replace(/^line_/, ""));
        const rightIndex = Number(String(right[0]).replace(/^line_/, ""));
        return leftIndex - rightIndex;
      })
      .map(([, value]) => String(value || "").trim())
      .filter(Boolean);
    targetInput.value = translatedLines.join("\n");
    return;
  }

  targetInput.value = String(translatedEntries.value || "").trim();
}

function renderLocalizedTourEditor(field, { label, rows = 3, multiline = false } = {}) {
  const mount = field === "short_description_i18n" ? els.shortDescriptionEditor : els.highlightsEditor;
  if (!mount) return;
  const rowsHtml = tourTextLanguages().map((language) => {
    const lang = normalizeTourTextLang(language?.code);
    const textareaId = localizedTextareaId(field, lang);
    const value = localizedFieldValue(field, lang);
    const codeHtml = lang === "en"
      ? `
        <span class="tour-localized-group__code" aria-hidden="true">EN</span>
        <button type="button" class="btn btn-ghost tour-localized-group__translate-all-btn" data-tour-translate-all="${escapeHtml(field)}">
          ${escapeHtml(backendT("tour.translation.translate_all", "Translate all"))}
        </button>
      `
      : `<button type="button" class="btn btn-ghost tour-localized-group__translate-btn" data-tour-translate-field="${escapeHtml(field)}" data-target-lang="${escapeHtml(lang)}">EN -&gt; ${escapeHtml(language?.shortLabel || lang.toUpperCase())}</button>`;
    return `
      <div class="tour-localized-group__row">
        <div class="tour-localized-group__code-cell">${codeHtml}</div>
        <div class="tour-localized-group__field">
          <textarea
            id="${escapeHtml(textareaId)}"
            data-tour-i18n-field="${escapeHtml(field)}"
            data-tour-i18n-lang="${escapeHtml(lang)}"
            rows="${escapeHtml(String(rows))}"
            spellcheck="true"
          >${escapeHtml(value)}</textarea>
        </div>
      </div>
    `;
  }).join("");

  mount.innerHTML = `
    <div class="tour-localized-group${multiline ? " tour-localized-group--multiline" : ""}">
      <div class="tour-localized-group__header">
        <label class="tour-localized-group__label" for="${escapeHtml(localizedTextareaId(field, "en"))}">${escapeHtml(label)}</label>
      </div>
      ${rowsHtml}
    </div>
  `;
}

function renderLocalizedTourEditors() {
  renderLocalizedTourEditor("short_description_i18n", {
    label: backendT("tour.description_label", "Description"),
    rows: 3
  });
  renderLocalizedTourEditor("highlights_i18n", {
    label: backendT("tour.highlights_label", "Highlights (one per line)"),
    rows: 4,
    multiline: true
  });
}

function readLocalizedTextareas(field, { multiline = false } = {}) {
  const next = {};
  for (const language of tourTextLanguages()) {
    const lang = normalizeTourTextLang(language?.code);
    const value = String(getLocalizedTextarea(field, lang)?.value ?? "");
    const normalizedValue = multiline ? value : value.trim();
    if (multiline ? normalizedValue.trim() : normalizedValue) {
      next[lang] = normalizedValue;
    }
  }
  return next;
}

async function translateTourField(button) {
  const field = normalizeText(button?.getAttribute("data-tour-translate-field"));
  const targetLang = normalizeTourTextLang(button?.getAttribute("data-target-lang"));
  const englishInput = getLocalizedTextarea(field, "en");
  const targetInput = getLocalizedTextarea(field, targetLang);
  if (!field || !englishInput || !targetInput) return;

  const englishSource = String(englishInput.value || "");
  if (!Object.keys(buildTourTranslationEntries(field, englishSource)).length) {
    setStatus(backendT("tour.translation.missing_source", "Add English text first."));
    return;
  }

  targetInput.value = "";
  updateTourDirtyState();
  setStatus(backendT("tour.translation.translating", "Translating..."));
  const translatedEntries = await requestTourTranslation(field, targetLang, englishSource);
  if (!translatedEntries) return;
  applyTranslatedTourField(field, targetLang, translatedEntries);

  updateTourDirtyState();
  setStatus(backendT("tour.translation.done", "Translation updated."));
}

async function translateAllTourField(button) {
  const field = normalizeText(button?.getAttribute("data-tour-translate-all"));
  const englishInput = getLocalizedTextarea(field, "en");
  if (!field || !englishInput) return;

  const englishSource = String(englishInput.value || "");
  if (!Object.keys(buildTourTranslationEntries(field, englishSource)).length) {
    setStatus(backendT("tour.translation.missing_source", "Add English text first."));
    return;
  }

  const targets = tourTextLanguages()
    .map((language) => normalizeTourTextLang(language?.code))
    .filter((lang) => lang && lang !== "en");
  if (!targets.length) return;

  for (const targetLang of targets) {
    const targetInput = getLocalizedTextarea(field, targetLang);
    if (targetInput) targetInput.value = "";
  }
  updateTourDirtyState();
  setStatus(backendT("tour.translation.translating_all", "Translating all languages..."));
  for (const targetLang of targets) {
    const translatedEntries = await requestTourTranslation(field, targetLang, englishSource);
    if (!translatedEntries) return;
    applyTranslatedTourField(field, targetLang, translatedEntries);
    updateTourDirtyState();
  }

  updateTourDirtyState();
  setStatus(backendT("tour.translation.all_done", "All translations updated."));
}

init();

async function init() {
  await waitForBackendI18n();
  refreshBackendNavElements();
  const backHref = withBackendLang("/backend.html", { section: "tours" });

  if (els.homeLink) els.homeLink.href = backHref;
  if (els.back) els.back.href = backHref;
  if (els.cancel) els.cancel.href = backHref;
  if (els.logoutLink) {
    const returnTo = `${window.location.origin}${withBackendLang("/index.html")}`;
    els.logoutLink.href = `${apiBase}/auth/logout?return_to=${encodeURIComponent(returnTo)}`;
  }

  bindSectionNavigation("tours");

  await loadAuthStatus();
  if (!state.authenticated) {
    redirectToBackendLogin();
    return;
  }
  renderMonthOptions();

  if (els.form) {
    els.form.addEventListener("submit", submitForm);
    const scheduleTourDirtyState = () => window.setTimeout(updateTourDirtyState, 0);
    els.form.addEventListener("input", scheduleTourDirtyState);
    els.form.addEventListener("change", scheduleTourDirtyState);
    els.form.addEventListener("click", (event) => {
      const translateAllButton = event.target.closest("[data-tour-translate-all]");
      if (translateAllButton) {
        event.preventDefault();
        void translateAllTourField(translateAllButton);
        return;
      }
      const button = event.target.closest("[data-tour-translate-field]");
      if (!button) return;
      event.preventDefault();
      void translateTourField(button);
    });
  }
  if (els.titleEditBtn) {
    els.titleEditBtn.addEventListener("click", startTourTitleEdit);
  }
  if (els.titleInput) {
    const scheduleTourDirtyState = () => window.setTimeout(updateTourDirtyState, 0);
    els.titleInput.addEventListener("input", () => {
      clearTitleError();
      scheduleTourDirtyState();
    });
    els.titleInput.addEventListener("keydown", handleTourTitleInputKeydown);
    els.titleInput.addEventListener("blur", commitTourTitleEdit);
  }
  if (els.changeImageBtn && els.imageUpload) {
    els.changeImageBtn.addEventListener("click", () => {
      els.imageUpload.click();
    });
  }
  if (els.imageUpload) {
    els.imageUpload.addEventListener("change", () => {
      const file = els.imageUpload.files?.[0];
      if (file) setStatus(backendT("tour.status.selected_image", "Selected image: {file}", { file: file.name }));
      updateTourDirtyState();
    });
  }

  if (state.is_create_mode) {
    await initializeNewTourForm();
    return;
  }

  await loadTour();
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
      window.location.href = withBackendLang("/backend.html", { section });
    });
  });
}

async function loadTour() {
  const payload = await fetchApi(withApiLang(`/api/v1/tours/${encodeURIComponent(state.id)}`));
  if (!payload?.tour) return;

  state.tour = payload.tour;
  state.options.destinations = Array.isArray(payload.options?.destinations) ? payload.options.destinations : [];
  state.options.styles = Array.isArray(payload.options?.styles) ? payload.options.styles : [];

  const tour = state.tour;
  const destinations = tour_destinations(tour);
  const styles = tour_styles(tour);
  updateHeader(tour, destinations, styles);

  setInput("tour_id", tour.id || "");
  setInput("tour_travel_duration_days", toInputNumber(tour.travel_duration_days));
  setInput("tour_budget_lower_usd", toInputNumber(tour.budget_lower_usd));
  setInput("tour_priority", toInputNumber(tour.priority));
  setInput("tour_rating", toInputNumber(tour.rating));
  setInput("tour_seasonality_start_month", tour.seasonality_start_month || "");
  setInput("tour_seasonality_end_month", tour.seasonality_end_month || "");
  state.localizedContent.short_description_i18n = normalizeLocalizedTextMap(
    tour.short_description_i18n || { en: tour.short_description || "" }
  );
  state.localizedContent.highlights_i18n = normalizeLocalizedTextMap(
    tour.highlights_i18n || { en: Array.isArray(tour.highlights) ? tour.highlights.join("\n") : "" },
    { multiline: true }
  );
  renderLocalizedTourEditors();
  updateHeroImage(tour.image || "");

  renderDestinationChoices(tour_destination_codes(tour));
  renderStyleChoices(tour_style_codes(tour));
  applyTourPermissions();
  markTourSnapshotClean();
}

async function initializeNewTourForm() {
  const payload = await fetchApi(withApiLang("/api/v1/tours", { page: 1, page_size: 1 }));
  state.options.destinations = Array.isArray(payload?.available_destinations) ? payload.available_destinations : [];
  state.options.styles = Array.isArray(payload?.available_styles) ? payload.available_styles : [];
  state.tour = {
    id: "",
    title: "",
    destinations: [],
    destination_codes: [],
    styles: [],
    style_codes: [],
    travel_duration_days: null,
    budget_lower_usd: null,
    priority: 50,
    rating: 0,
    seasonality_start_month: "",
    seasonality_end_month: "",
    short_description: "",
    highlights: [],
    short_description_i18n: {},
    highlights_i18n: {},
    image: ""
  };

  updateHeader({ title: backendT("tour.new_title", "New tour") }, [], []);
  if (els.subtitle) els.subtitle.textContent = backendT("tour.create_subtitle", "Create a new tour");
  setInput("tour_id", "(new)");
  setInput("tour_travel_duration_days", "");
  setInput("tour_budget_lower_usd", "");
  setInput("tour_priority", "50");
  setInput("tour_rating", "0");
  setInput("tour_seasonality_start_month", "");
  setInput("tour_seasonality_end_month", "");
  state.localizedContent.short_description_i18n = {};
  state.localizedContent.highlights_i18n = {};
  renderLocalizedTourEditors();
  updateHeroImage("");
  renderDestinationChoices([]);
  renderStyleChoices([]);
  applyTourPermissions();
  clearError();
  setStatus(backendT("tour.status.new", "New tour"));
  markTourSnapshotClean();
}

function renderDestinationChoices(selectedValues) {
  const values = dedupeOptions([...(state.options.destinations || []), ...(selectedValues || []).map((value) => ({ code: value, label: value }))]);
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
  const values = dedupeOptions([...(state.options.styles || []), ...(selectedValues || []).map((value) => ({ code: value, label: value }))]);
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
  const selectedSet = new Set((selectedValues || []).filter(Boolean).map(choiceKey));

  const html = values
    .filter(Boolean)
    .map((value) => {
      const optionValue = choiceValue(value);
      const optionLabel = choiceLabel(value);
      const id = `${inputName}_${slugify(optionValue)}`;
      const checked = selectedSet.has(choiceKey(optionValue)) ? "checked" : "";
      return `<label class="backend-checkbox-item" for="${escapeHtml(id)}"><input type="checkbox" id="${escapeHtml(
        id
      )}" name="${escapeHtml(inputName)}" value="${escapeHtml(optionValue)}" ${checked} />${escapeHtml(optionLabel)}</label>`;
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
    title: getTourTitleInputValue(),
    destinations: selectedDestinationCountries,
    styles: selectedStyles,
    travel_duration_days: toNumberOrNull(getInput("tour_travel_duration_days")),
    budget_lower_usd: toNumberOrNull(getInput("tour_budget_lower_usd")),
    priority: toNumberOrNull(getInput("tour_priority")),
    rating: toNumberOrNull(getInput("tour_rating")),
    seasonality_start_month: getInput("tour_seasonality_start_month"),
    seasonality_end_month: getInput("tour_seasonality_end_month"),
    short_description_i18n: readLocalizedTextareas("short_description_i18n"),
    highlights_i18n: readLocalizedTextareas("highlights_i18n", { multiline: true })
  };

  if (!payload.title || !payload.destinations.length || !payload.styles.length) {
    setStatus(backendT("tour.status.required", "Title, at least one Destination Country, and at least one Style are required."));
    return;
  }

  const duplicate = await findDuplicateTourTitle(payload.title, state.id);
  if (duplicate) {
    setTitleError(backendT(
      "tour.error.duplicate_title",
      "A tour titled \"{title}\" already exists (ID: {id}). Please use a different title.",
      { title: duplicate.title || payload.title, id: duplicate.id }
    ));
    setStatus(backendT("tour.status.duplicate", "Save blocked due to duplicate title."));
    if (els.titleInput) {
      startTourTitleEdit();
      els.titleInput.focus();
    }
    return;
  }

  setStatus(backendT("tour.status.saving", "Saving..."));
  const is_create = state.is_create_mode;
  const result = await fetchApi(is_create ? withApiLang("/api/v1/tours") : withApiLang(`/api/v1/tours/${encodeURIComponent(state.id)}`), {
    method: is_create ? "POST" : "PATCH",
    body: payload
  });
  if (!result) return;
  if (!result.tour) return;
  state.tour = result.tour;
  state.id = String(result.tour.id || "");
  state.is_create_mode = false;
  updateHeader(state.tour, tour_destinations(state.tour), tour_styles(state.tour));

  const file = els.imageUpload?.files?.[0] || null;
  if (file) {
    setStatus(backendT("tour.status.uploading_image", "Uploading image..."));
    const base64 = await fileToBase64(file);
    const imageResult = await fetchApi(withApiLang(`/api/v1/tours/${encodeURIComponent(state.id)}/image`), {
      method: "POST",
      body: {
        filename: file.name,
        data_base64: base64
      }
    });
    if (!imageResult) return;
  }

  setStatus(is_create
    ? backendT("tour.status.created", "Tour created.")
    : backendT("tour.status.updated", "Tour updated."));
  if (els.imageUpload) els.imageUpload.value = "";
  if (is_create) {
    window.location.href = withBackendLang("/tour.html", { id: state.id });
    return;
  }
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
    refreshBackendNavElements();
    const response = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
    const payload = await response.json();
    if (!response.ok || !payload?.authenticated) {
      state.authenticated = false;
      if (els.userLabel) els.userLabel.textContent = "";
      return;
    }
    state.authenticated = true;
    state.roles = Array.isArray(payload.user?.roles) ? payload.user.roles : [];
    const user = payload.user?.preferred_username || payload.user?.email || payload.user?.sub || "";
    if (els.userLabel) els.userLabel.textContent = user || "";
    state.permissions.canEditTours =
      state.roles.includes("atp_admin") ||
      state.roles.includes("atp_manager") ||
      state.roles.includes("atp_staff");
  } catch {
    state.authenticated = false;
    if (els.userLabel) els.userLabel.textContent = "";
    // leave defaults
  }
}

function redirectToBackendLogin() {
  const returnTo = `${window.location.origin}${withBackendLang("/tour.html", { id: state.id })}`;
  const loginParams = new URLSearchParams({
    return_to: returnTo,
    prompt: "login"
  });
  window.location.href = `${apiBase}/auth/login?${loginParams.toString()}`;
}

function applyTourPermissions() {
  if (els.titleEditBtn) {
    els.titleEditBtn.hidden = !state.permissions.canEditTours;
    els.titleEditBtn.disabled = !state.permissions.canEditTours;
  }
  if (els.titleInput) {
    els.titleInput.disabled = !state.permissions.canEditTours;
  }
  if (state.permissions.canEditTours) return;
  if (els.changeImageBtn) els.changeImageBtn.style.display = "none";
  if (els.imageUpload) els.imageUpload.disabled = true;
  if (els.form) {
    els.form.querySelectorAll("input, textarea, select, button").forEach((el) => {
      if (el.id === "tour_cancel_btn") return;
      el.disabled = true;
    });
  }
  setStatus(backendT("tour.status.read_only", "Read-only access."));
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

    const payload = await fetchApi(withApiLang("/api/v1/tours", Object.fromEntries(query.entries())));
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
  const rawTitle = normalizeText(tour?.title);
  if (els.title) {
    els.title.textContent = rawTitle || (state.is_create_mode ? backendT("tour.new_title", "New tour") : backendT("nav.tours", "Tour"));
    els.title.hidden = false;
  }
  if (els.titleInput && document.activeElement !== els.titleInput) {
    els.titleInput.value = rawTitle;
    els.titleInput.hidden = true;
  }
  if (els.titleEditBtn) {
    els.titleEditBtn.hidden = !state.permissions.canEditTours;
    els.titleEditBtn.disabled = !state.permissions.canEditTours;
  }
  if (!els.subtitle) return;
  const destText = destinations.length ? destinations.join(", ") : "-";
  const styleText = styles.length ? styles.join(", ") : "-";
  els.subtitle.textContent = backendT("tour.status.destinations_styles", "Destinations: {destinations} | Styles: {styles}", {
    destinations: destText,
    styles: styleText
  });
}

function getTourTitleInputValue() {
  return normalizeText(els.titleInput?.value);
}

function startTourTitleEdit() {
  if (!state.permissions.canEditTours || !els.title || !els.titleInput) return;
  els.titleInput.value = normalizeText(els.titleInput.value || els.title.textContent);
  els.title.hidden = true;
  els.titleInput.hidden = false;
  els.titleInput.focus();
  els.titleInput.select();
}

function commitTourTitleEdit() {
  if (!els.title || !els.titleInput) return;
  const value = getTourTitleInputValue();
  els.title.textContent = value || (state.is_create_mode ? backendT("tour.new_title", "New tour") : backendT("nav.tours", "Tour"));
  els.title.hidden = false;
  els.titleInput.hidden = true;
  updateTourDirtyState();
}

function handleTourTitleInputKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    commitTourTitleEdit();
  } else if (event.key === "Escape") {
    event.preventDefault();
    if (els.titleInput) {
      els.titleInput.value = normalizeText(state.tour?.title);
    }
    commitTourTitleEdit();
  }
}

function tour_destinations(tour) {
  if (Array.isArray(tour?.destinations) && tour.destinations.length) {
    return tour.destinations.map((value) => String(value || "").trim()).filter(Boolean);
  }
  return [];
}

function tour_destination_codes(tour) {
  if (Array.isArray(tour?.destination_codes) && tour.destination_codes.length) {
    return tour.destination_codes.map((value) => String(value || "").trim()).filter(Boolean);
  }
  return [];
}

function tour_styles(tour) {
  return Array.isArray(tour?.styles) ? tour.styles.map((value) => String(value || "").trim()).filter(Boolean) : [];
}

function tour_style_codes(tour) {
  if (Array.isArray(tour?.style_codes) && tour.style_codes.length) {
    return tour.style_codes.map((value) => String(value || "").trim()).filter(Boolean);
  }
  return [];
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

function normalizeOption(option) {
  if (option && typeof option === "object") {
    const code = String(option.code || "").trim();
    const label = String(option.label || option.code || "").trim();
    if (!code) return null;
    return { code, label: label || code };
  }
  const value = String(option || "").trim();
  return value ? { code: value, label: value } : null;
}

function dedupeOptions(values) {
  const seen = new Set();
  const out = [];
  for (const raw of values || []) {
    const option = normalizeOption(raw);
    if (!option) continue;
    const key = choiceKey(option.code);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(option);
  }
  return out;
}

function choiceKey(value) {
  return String(value || "").trim().toLowerCase();
}

function choiceValue(value) {
  return normalizeOption(value)?.code || "";
}

function choiceLabel(value) {
  return normalizeOption(value)?.label || "";
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
