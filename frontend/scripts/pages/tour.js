import {
  authMeRequest,
  tourCreateRequest,
  tourDetailRequest,
  tourImageRequest,
  toursRequest,
  tourTranslateFieldsRequest,
  tourUpdateRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import { validateAuthMeResponse } from "../../Generated/API/generated_APIModels.js";
import {
  createApiFetcher,
  escapeHtml,
  logBrowserConsoleError,
  resolveApiUrl
} from "../shared/api.js";
import { wireAuthLogoutLink } from "../shared/auth.js";
import { createSnapshotDirtyTracker } from "../shared/edit_state.js";
import { MONTH_CODE_CATALOG } from "../shared/generated_catalogs.js";
import { resolveBackendSectionHref } from "../shared/nav.js";
import { applyBackendUserLabel } from "../shared/backend_page.js";
import {
  CUSTOMER_CONTENT_LANGUAGES,
  normalizeLanguageCode
} from "../../../shared/generated/language_catalog.js";

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
const apiOrigin = new URL(apiBase || "/", window.location.origin).toString().replace(/\/$/, "");

function normalizeText(value) {
  return String(value ?? "").trim();
}

const GENERATED_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_APP_ROLES.map((role) => [String(role).replace(/^atp_/, "").toUpperCase(), role])
  )
);

const ROLES = Object.freeze({
  ADMIN: GENERATED_ROLE_LOOKUP.ADMIN,
  ACCOUNTANT: GENERATED_ROLE_LOOKUP.ACCOUNTANT,
  TOUR_EDITOR: GENERATED_ROLE_LOOKUP.TOUR_EDITOR
});

const state = {
  id: qs.get("id") || "",
  is_create_mode: !normalizeText(qs.get("id") || ""),
  authenticated: false,
  roles: [],
  permissions: {
    canReadTours: false,
    canEditTours: false
  },
  allowPageUnload: false,
  tour: null,
  pendingHeroImagePreviewUrl: "",
  options: {
    destinations: [],
    styles: []
  },
  localizedContent: {
    title_i18n: {},
    short_description_i18n: {}
  }
};

const els = {
  pageBody: document.body,
  pageHeader: document.getElementById("top"),
  mainContent: document.getElementById("main-content"),
  homeLink: document.getElementById("backendHomeLink"),
  back: document.getElementById("backToBackend"),
  logoutLink: null,
  userLabel: null,
  title: document.getElementById("tour_title"),
  subtitle: document.getElementById("tour_subtitle"),
  error: document.getElementById("tour_error"),
  titleError: document.getElementById("tour_titleError"),
  form: document.getElementById("tour_form"),
  dirtyBar: document.getElementById("tour_dirty_bar"),
  status: document.getElementById("tour_formStatus"),
  cancel: document.getElementById("tour_cancel_btn"),
  destinationHidden: document.getElementById("tour_destinations"),
  destinationChoices: document.getElementById("tour_destination_choices"),
  stylesHidden: document.getElementById("tour_styles"),
  styleChoices: document.getElementById("tour_style_choices"),
  seasonalityStartMonth: document.getElementById("tour_seasonality_start_month"),
  seasonalityEndMonth: document.getElementById("tour_seasonality_end_month"),
  localizedContentEditor: document.getElementById("tour_localized_content_editor"),
  changeImageBtn: document.getElementById("tour_change_image_btn"),
  imageUpload: document.getElementById("tour_image_upload"),
  heroImage: document.getElementById("tour_hero_image"),
  pageOverlay: document.getElementById("tour_translate_overlay"),
  pageOverlayText: document.getElementById("tour_translate_overlay_text")
};

function refreshBackendNavElements() {
  els.logoutLink = document.getElementById("backendLogoutLink");
  els.userLabel = document.getElementById("backendUserLabel");
}

function hasAnyRoleInList(roleList, ...roles) {
  return roles.some((role) => roleList.includes(role));
}

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

const tourDirtyTracker = createSnapshotDirtyTracker({
  captureSnapshot: () => captureTourFormSnapshot(),
  isEnabled: () => state.permissions.canEditTours,
  onDirtyChange: (isDirty) => {
    els.dirtyBar?.classList.toggle("booking-dirty-bar--dirty", isDirty);
  }
});

function updateTourDirtyState() {
  return tourDirtyTracker.refresh();
}

function markTourSnapshotClean() {
  tourDirtyTracker.markClean();
}

function tourTextLanguages() {
  return Array.isArray(CUSTOMER_CONTENT_LANGUAGES) ? CUSTOMER_CONTENT_LANGUAGES : [];
}

function normalizeTourTextLang(value) {
  return normalizeLanguageCode(value, { fallback: "en" });
}

function currentTourEditingLang() {
  const normalizedCurrentLang = normalizeTourTextLang(currentBackendLang());
  return tourTextLanguages().some((language) => normalizeTourTextLang(language?.code) === normalizedCurrentLang)
    ? normalizedCurrentLang
    : "en";
}

function orderedTourTextLanguages() {
  const languages = tourTextLanguages();
  const editingLang = currentTourEditingLang();
  const editingLanguage = languages.find((language) => normalizeTourTextLang(language?.code) === editingLang);
  const secondaryLang = editingLang === "vi" ? "en" : "vi";
  const secondaryLanguage = languages.find((language) => normalizeTourTextLang(language?.code) === secondaryLang);
  const otherLanguages = languages
    .filter((language) => {
      const lang = normalizeTourTextLang(language?.code);
      return lang !== editingLang && lang !== secondaryLang;
    })
    .sort((left, right) => tourLanguageShortLabel(left?.code).localeCompare(tourLanguageShortLabel(right?.code), "en", {
      sensitivity: "base"
    }));
  return [
    ...(editingLanguage ? [editingLanguage] : []),
    ...(secondaryLanguage ? [secondaryLanguage] : []),
    ...otherLanguages
  ];
}

function tourLanguageMeta(lang) {
  const normalizedLang = normalizeTourTextLang(lang);
  return tourTextLanguages().find((language) => normalizeTourTextLang(language?.code) === normalizedLang) || null;
}

function tourLanguageShortLabel(lang) {
  return normalizeText(tourLanguageMeta(lang)?.shortLabel) || normalizeTourTextLang(lang).toUpperCase();
}

function tourLanguageLabel(lang) {
  const language = tourLanguageMeta(lang);
  return normalizeText(language?.nativeLabel)
    || normalizeText(language?.promptName)
    || normalizeText(language?.apiValue)
    || tourLanguageShortLabel(lang);
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

function localizedFieldId(field, lang) {
  return `tour_${field}_${normalizeTourTextLang(lang)}`;
}

function getLocalizedField(field, lang) {
  return document.getElementById(localizedFieldId(field, lang));
}

function resolveLocalizedTextMapValue(value, preferredLangs = [], fallbackValue = "") {
  const normalizedMap = normalizeLocalizedTextMap(value);
  const candidates = [
    ...preferredLangs.map((lang) => normalizeTourTextLang(lang)),
    ...Object.keys(normalizedMap),
    "vi",
    "en"
  ];
  for (const lang of candidates) {
    const value = String(normalizedMap?.[lang] ?? "").trim();
    if (value) return value;
  }
  return normalizeText(fallbackValue);
}

function resolveLocalizedFieldText(field, preferredLangs = [], fallbackValue = "") {
  return resolveLocalizedTextMapValue(state.localizedContent?.[field], preferredLangs, fallbackValue);
}

function buildTourTranslationEntries(sourceValues) {
  return Object.fromEntries(
    Object.entries(sourceValues || {})
      .map(([key, value]) => [String(key || "").trim(), String(value || "").trim()])
      .filter(([key, value]) => Boolean(key && value))
  );
}

async function requestTourTranslation(targetLang, sourceValues) {
  const entries = buildTourTranslationEntries(sourceValues);
  if (!Object.keys(entries).length) return null;
  const sourceLang = currentTourEditingLang();

  const request = tourTranslateFieldsRequest({
    baseURL: apiOrigin,
    body: {
      source_lang: sourceLang,
      target_lang: targetLang,
      entries: Object.entries(entries).map(([key, value]) => ({ key, value }))
    }
  });
  const result = await fetchApi(withApiLang(request.url), {
    method: request.method,
    body: request.body
  });
  return Array.isArray(result?.entries)
    ? Object.fromEntries(
        result.entries
          .map((entry) => [String(entry?.key || "").trim(), String(entry?.value || "").trim()])
          .filter(([key, value]) => Boolean(key && value))
      )
    : null;
}

function applyTranslatedTourFields(targetLang, translatedEntries) {
  if (!translatedEntries) return;
  const titleInput = getLocalizedField("title_i18n", targetLang);
  const descriptionInput = getLocalizedField("short_description_i18n", targetLang);
  if (titleInput && translatedEntries.title) {
    titleInput.value = String(translatedEntries.title || "").trim();
  }
  if (descriptionInput && translatedEntries.short_description) {
    descriptionInput.value = String(translatedEntries.short_description || "").trim();
  }
}

function renderLocalizedTourContentEditor() {
  if (!els.localizedContentEditor) return;
  const editingLang = currentTourEditingLang();
  const rowsHtml = orderedTourTextLanguages().map((language) => {
    const lang = normalizeTourTextLang(language?.code);
    const direction = String(language?.direction || "ltr");
    const titleId = localizedFieldId("title_i18n", lang);
    const descriptionId = localizedFieldId("short_description_i18n", lang);
    const titleValue = localizedFieldValue("title_i18n", lang);
    const descriptionValue = localizedFieldValue("short_description_i18n", lang);
    const buttonLabel = lang === editingLang
      ? `
        <button type="button" class="btn btn-ghost tour-localized-group__translate-all-btn" data-tour-translate-all="true">
          ${escapeHtml(backendT("tour.translation.translate_all", "{source} → ALL", {
            source: tourLanguageShortLabel(editingLang)
          }))}
        </button>
      `
      : `<button type="button" class="btn btn-ghost tour-localized-group__translate-btn" data-tour-translate-lang="${escapeHtml(lang)}">${escapeHtml(backendT("tour.translation.translate_one", "{source} → {target}", {
        source: tourLanguageShortLabel(editingLang),
        target: tourLanguageShortLabel(lang)
      }))}</button>`;
    return `
      <div class="tour-localized-group__row">
        <div class="tour-localized-group__code-cell">${buttonLabel}</div>
        <div class="tour-localized-group__field">
          <div class="tour-localized-content">
            <div class="tour-localized-content__field">
              <input
                class="tour-localized-content__title"
                id="${escapeHtml(titleId)}"
                data-tour-i18n-field="title_i18n"
                data-tour-i18n-lang="${escapeHtml(lang)}"
                type="text"
                spellcheck="true"
                dir="${escapeHtml(direction)}"
                value="${escapeHtml(titleValue)}"
              />
            </div>
            <div class="tour-localized-content__field">
              <textarea
                class="tour-localized-content__description"
                id="${escapeHtml(descriptionId)}"
                data-tour-i18n-field="short_description_i18n"
                data-tour-i18n-lang="${escapeHtml(lang)}"
                rows="3"
                spellcheck="true"
                dir="${escapeHtml(direction)}"
              >${escapeHtml(descriptionValue)}</textarea>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  els.localizedContentEditor.innerHTML = `
    <div class="tour-localized-group tour-localized-group--multiline tour-localized-group--content">
      <div class="tour-localized-group__header">
        <label class="tour-localized-group__label" for="${escapeHtml(localizedFieldId("title_i18n", editingLang))}">${escapeHtml(backendT("tour.content_label", "Website title and description"))}</label>
      </div>
      ${rowsHtml}
    </div>
  `;
}

function readLocalizedFields(field, { multiline = false } = {}) {
  const next = {};
  for (const language of tourTextLanguages()) {
    const lang = normalizeTourTextLang(language?.code);
    const value = String(getLocalizedField(field, lang)?.value ?? "");
    const normalizedValue = multiline ? value : value.trim();
    if (multiline ? normalizedValue.trim() : normalizedValue) {
      next[lang] = normalizedValue;
    }
  }
  return next;
}

function syncLocalizedFieldState() {
  state.localizedContent.title_i18n = readLocalizedFields("title_i18n");
  state.localizedContent.short_description_i18n = readLocalizedFields("short_description_i18n");
}

function preferredTourHeaderLangs() {
  const selectedLang = normalizeTourTextLang(currentBackendLang());
  return selectedLang === "vi" ? ["vi", "en"] : ["en", "vi"];
}

function updateHeaderTitle() {
  if (!els.title) return;
  const rawTitle = resolveLocalizedFieldText("title_i18n", preferredTourHeaderLangs(), state.tour?.title);
  els.title.textContent = rawTitle || (state.is_create_mode ? backendT("tour.new_title", "New tour") : backendT("nav.tours", "Tour"));
}

function clearTranslatedTourTarget(targetLang) {
  const titleInput = getLocalizedField("title_i18n", targetLang);
  const descriptionInput = getLocalizedField("short_description_i18n", targetLang);
  if (titleInput) titleInput.value = "";
  if (descriptionInput) descriptionInput.value = "";
}

function focusPrimaryTitleField() {
  const candidates = [currentTourEditingLang(), "vi", "en"];
  for (const lang of candidates) {
    const input = getLocalizedField("title_i18n", lang);
    if (input) {
      input.focus();
      return;
    }
  }
}

async function translateTourContent(button) {
  const targetLang = normalizeTourTextLang(button?.getAttribute("data-tour-translate-lang"));
  const sourceLang = currentTourEditingLang();
  if (!targetLang || targetLang === sourceLang) return;

  const sourceEntries = buildTourTranslationEntries({
    title: getLocalizedField("title_i18n", sourceLang)?.value,
    short_description: getLocalizedField("short_description_i18n", sourceLang)?.value
  });
  if (!Object.keys(sourceEntries).length) {
    setStatus(backendT("tour.translation.missing_source", "Add {sourceLanguage} text first.", {
      sourceLanguage: tourLanguageLabel(sourceLang)
    }));
    return;
  }

  clearTranslatedTourTarget(targetLang);
  updateTourDirtyState();
  setStatus(backendT("tour.translation.translating", "Translating from {sourceLanguage}...", {
    sourceLanguage: tourLanguageLabel(sourceLang)
  }));
  const translatedEntries = await requestTourTranslation(targetLang, sourceEntries);
  if (!translatedEntries) return;
  applyTranslatedTourFields(targetLang, translatedEntries);
  syncLocalizedFieldState();
  updateHeaderTitle();

  updateTourDirtyState();
  setStatus(backendT("tour.translation.done", "Translation updated."));
}

async function translateAllTourContent(button) {
  if (!button) return;
  const sourceLang = currentTourEditingLang();
  const sourceEntries = buildTourTranslationEntries({
    title: getLocalizedField("title_i18n", sourceLang)?.value,
    short_description: getLocalizedField("short_description_i18n", sourceLang)?.value
  });
  if (!Object.keys(sourceEntries).length) {
    setStatus(backendT("tour.translation.missing_source", "Add {sourceLanguage} text first.", {
      sourceLanguage: tourLanguageLabel(sourceLang)
    }));
    return;
  }

  const targets = tourTextLanguages()
    .map((language) => normalizeTourTextLang(language?.code))
    .filter((lang) => lang && lang !== sourceLang);
  if (!targets.length) return;

  for (const targetLang of targets) {
    clearTranslatedTourTarget(targetLang);
  }
  updateTourDirtyState();
  setTourPageOverlay(true, backendT("tour.translation.translating_all_overlay", "Translating all languages. Please wait."));
  setStatus(backendT("tour.translation.translating_all", "Translating all languages from {sourceLanguage}...", {
    sourceLanguage: tourLanguageLabel(sourceLang)
  }));
  try {
    for (const targetLang of targets) {
      const translatedEntries = await requestTourTranslation(targetLang, sourceEntries);
      if (!translatedEntries) return;
      applyTranslatedTourFields(targetLang, translatedEntries);
      syncLocalizedFieldState();
      updateTourDirtyState();
    }
  } finally {
    setTourPageOverlay(false);
  }

  updateHeaderTitle();
  updateTourDirtyState();
  setStatus(backendT("tour.translation.all_done", "All translations updated."));
}

init();

async function init() {
  await waitForBackendI18n();
  window.addEventListener("beforeunload", (event) => {
    if (state.allowPageUnload || !updateTourDirtyState()) return;
    event.preventDefault();
    event.returnValue = "";
  });
  refreshBackendNavElements();
  const backHref = resolveBackendSectionHref("tours");

  if (els.homeLink) els.homeLink.href = backHref;
  if (els.cancel) els.cancel.href = backHref;
  if (els.back) {
    els.back.addEventListener("click", () => {
      window.location.href = backHref;
    });
  }
  if (els.logoutLink) {
    const returnTo = `${window.location.origin}/`;
    wireAuthLogoutLink(els.logoutLink, { apiBase, returnTo });
  }

  await loadAuthStatus();
  if (!state.authenticated) {
    redirectToBackendLogin();
    return;
  }
  if (!state.permissions.canReadTours) {
    applyTourPermissions();
    showError(backendT("tour.error.forbidden", "You do not have access to tours."));
    setStatus(backendT("tour.status.access_denied", "Access denied."));
    return;
  }
  renderMonthOptions();

  if (els.form) {
    els.form.addEventListener("submit", submitForm);
    const scheduleTourDirtyState = () => window.setTimeout(updateTourDirtyState, 0);
    els.form.addEventListener("input", (event) => {
      clearError();
      setStatus("");
      const field = event.target instanceof HTMLElement ? event.target.getAttribute("data-tour-i18n-field") : "";
      if (field === "title_i18n" || field === "short_description_i18n") {
        syncLocalizedFieldState();
        if (field === "title_i18n") {
          clearTitleError();
          updateHeaderTitle();
        }
      }
      scheduleTourDirtyState();
    });
    els.form.addEventListener("change", () => {
      clearError();
      setStatus("");
      scheduleTourDirtyState();
    });
    els.form.addEventListener("click", (event) => {
      const translateAllButton = event.target.closest("[data-tour-translate-all]");
      if (translateAllButton) {
        event.preventDefault();
        void translateAllTourContent(translateAllButton);
        return;
      }
      const button = event.target.closest("[data-tour-translate-lang]");
      if (!button) return;
      event.preventDefault();
      void translateTourContent(button);
    });
  }
  if (els.changeImageBtn && els.imageUpload) {
    els.changeImageBtn.addEventListener("click", () => {
      els.imageUpload.click();
    });
  }
  if (els.imageUpload) {
    els.imageUpload.addEventListener("change", () => {
      const file = els.imageUpload.files?.[0];
      setPendingHeroImagePreview(file);
      renderHeroImage();
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

async function loadTour() {
  const request = tourDetailRequest({ baseURL: apiOrigin, params: { tour_id: state.id } });
  const payload = await fetchApi(withApiLang(request.url));
  if (!payload?.tour) return;

  state.tour = payload.tour;
  state.options.destinations = Array.isArray(payload.options?.destinations) ? payload.options.destinations : [];
  state.options.styles = Array.isArray(payload.options?.styles) ? payload.options.styles : [];

  const tour = state.tour;
  state.localizedContent.title_i18n = normalizeLocalizedTextMap(
    tour.title_i18n || { en: tour.title || "" }
  );
  state.localizedContent.short_description_i18n = normalizeLocalizedTextMap(
    tour.short_description_i18n || { en: tour.short_description || "" }
  );
  const destinations = tour_destinations(tour);
  const styles = tour_styles(tour);
  updateHeader(tour, destinations, styles);

  setInput("tour_priority", toInputNumber(tour.priority));
  setInput("tour_seasonality_start_month", tour.seasonality_start_month || "");
  setInput("tour_seasonality_end_month", tour.seasonality_end_month || "");
  renderLocalizedTourContentEditor();
  setPendingHeroImagePreview(null);
  renderHeroImage();

  renderDestinationChoices(tour_destination_codes(tour));
  renderStyleChoices(tour_style_codes(tour));
  applyTourPermissions();
  markTourSnapshotClean();
}

async function initializeNewTourForm() {
  const request = toursRequest({ baseURL: apiOrigin, query: { page: 1, page_size: 1 } });
  const payload = await fetchApi(withApiLang(request.url));
  state.options.destinations = Array.isArray(payload?.available_destinations) ? payload.available_destinations : [];
  state.options.styles = Array.isArray(payload?.available_styles) ? payload.available_styles : [];
  state.tour = {
    id: "",
    title: "",
    title_i18n: {},
    destinations: [],
    destination_codes: [],
    styles: [],
    style_codes: [],
    priority: 50,
    seasonality_start_month: "",
    seasonality_end_month: "",
    short_description: "",
    short_description_i18n: {},
    image: ""
  };

  state.localizedContent.title_i18n = {};
  state.localizedContent.short_description_i18n = {};
  updateHeader({ title: backendT("tour.new_title", "New tour") }, [], []);
  if (els.subtitle) els.subtitle.textContent = backendT("tour.create_subtitle", "Create a new tour");
  setInput("tour_priority", "50");
  setInput("tour_seasonality_start_month", "");
  setInput("tour_seasonality_end_month", "");
  renderLocalizedTourContentEditor();
  setPendingHeroImagePreview(null);
  renderHeroImage();
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

function buildTourSaveValidationMessage({ title = "", destinations = [], styles = [] }) {
  const missing = [];
  if (!normalizeText(title)) {
    missing.push(backendT("tour.validation.title", "Title"));
  }
  if (!Array.isArray(destinations) || !destinations.length) {
    missing.push(backendT("tour.validation.destination_country_required", "at least one destination country"));
  }
  if (!Array.isArray(styles) || !styles.length) {
    missing.push(backendT("tour.validation.style_required", "at least one style"));
  }
  if (!missing.length) return "";
  return backendT("tour.status.required_with_missing", "{base} Missing: {fields}.", {
    base: backendT("tour.status.required", "Title, at least one Destination Country, and at least one Style are required."),
    fields: missing.join(", ")
  });
}

async function submitForm(event) {
  event.preventDefault();
  if (!state.permissions.canEditTours) return;
  clearError();
  clearTitleError();

  const selectedDestinationCountries = getCheckedValues("destinationCountryChoice");
  const selectedStyles = getCheckedValues("styleChoice");
  const title_i18n = readLocalizedFields("title_i18n");
  const short_description_i18n = readLocalizedFields("short_description_i18n");
  state.localizedContent.title_i18n = title_i18n;
  state.localizedContent.short_description_i18n = short_description_i18n;
  const resolvedTitle = resolveLocalizedTextMapValue(title_i18n, ["vi", "en", currentTourEditingLang()]);

  const payload = {
    title: resolvedTitle,
    title_i18n,
    destinations: selectedDestinationCountries,
    styles: selectedStyles,
    priority: toNumberOrNull(getInput("tour_priority")),
    seasonality_start_month: getInput("tour_seasonality_start_month"),
    seasonality_end_month: getInput("tour_seasonality_end_month"),
    short_description_i18n
  };

  const validationMessage = buildTourSaveValidationMessage({
    title: payload.title,
    destinations: payload.destinations,
    styles: payload.styles
  });
  if (validationMessage) {
    showError(validationMessage);
    setStatus(validationMessage);
    return;
  }

  const duplicate = await findDuplicateTourTitle(title_i18n, state.id);
  if (duplicate) {
    const duplicateMessage = backendT(
      "tour.error.duplicate_title",
      "A tour titled \"{title}\" already exists (ID: {id}). Please use a different title.",
      { title: duplicate.title || payload.title, id: duplicate.id }
    );
    setTitleError(duplicateMessage);
    showError(duplicateMessage);
    setStatus(backendT("tour.status.duplicate", "Save blocked due to duplicate title."));
    focusPrimaryTitleField();
    return;
  }

  setStatus(backendT("tour.status.saving", "Saving..."));
  const is_create = state.is_create_mode;
  const request = is_create
    ? tourCreateRequest({ baseURL: apiOrigin })
    : tourUpdateRequest({ baseURL: apiOrigin, params: { tour_id: state.id } });
  const result = await fetchApi(withApiLang(request.url), {
    method: request.method,
    body: payload
  });
  if (!result) return;
  if (!result.tour) return;
  state.tour = result.tour;
  state.localizedContent.title_i18n = normalizeLocalizedTextMap(
    result.tour.title_i18n || { en: result.tour.title || "" }
  );
  state.localizedContent.short_description_i18n = normalizeLocalizedTextMap(
    result.tour.short_description_i18n || { en: result.tour.short_description || "" }
  );
  state.id = String(result.tour.id || "");
  state.is_create_mode = false;
  updateHeader(state.tour, tour_destinations(state.tour), tour_styles(state.tour));

  const file = els.imageUpload?.files?.[0] || null;
  if (file) {
    setStatus(backendT("tour.status.uploading_image", "Uploading image..."));
    const base64 = await fileToBase64(file);
    const imageRequest = tourImageRequest({ baseURL: apiOrigin, params: { tour_id: state.id } });
    const imageResult = await fetchApi(withApiLang(imageRequest.url), {
      method: imageRequest.method,
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
    state.allowPageUnload = true;
    window.location.href = withBackendLang("/marketing_tour.html", { id: state.id });
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
    const request = authMeRequest({ baseURL: apiOrigin });
    const response = await fetch(request.url, {
      method: request.method,
      credentials: "include",
      headers: request.headers
    });
    const payload = await response.json().catch(() => null);
    if (payload) validateAuthMeResponse(payload);
    if (!response.ok || !payload?.authenticated) {
      state.authenticated = false;
      if (els.userLabel) els.userLabel.textContent = "";
      return;
    }
    state.authenticated = true;
    state.roles = Array.isArray(payload.user?.roles) ? payload.user.roles : [];
    applyBackendUserLabel({
      userLabel: els.userLabel,
      authUser: payload.user || null,
      logKey: "tour-page",
      pageName: "marketing_tour.html",
      authMeUrl: request.url,
      extraDetails: {
        roles: state.roles,
        tour_id: state.id || ""
      }
    });
    state.permissions.canReadTours = hasAnyRoleInList(state.roles, ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.TOUR_EDITOR);
    state.permissions.canEditTours = hasAnyRoleInList(state.roles, ROLES.ADMIN, ROLES.TOUR_EDITOR);
  } catch (error) {
    state.authenticated = false;
    if (els.userLabel) els.userLabel.textContent = "";
    logBrowserConsoleError("[tour-page] Failed to load authenticated user status for the tour page.", {
      url: authMeRequest({ baseURL: apiOrigin }).url,
      method: "GET",
      tour_id: state.id || ""
    }, error);
  }
}

function redirectToBackendLogin() {
  const returnTo = `${window.location.origin}${withBackendLang("/marketing_tour.html", { id: state.id })}`;
  const loginParams = new URLSearchParams({
    return_to: returnTo,
    prompt: "login"
  });
  window.location.href = `${apiBase}/auth/login?${loginParams.toString()}`;
}

function applyTourPermissions() {
  if (state.permissions.canEditTours) return;
  if (els.changeImageBtn) els.changeImageBtn.disabled = true;
  if (els.imageUpload) els.imageUpload.disabled = true;
  if (els.form) {
    els.form.querySelectorAll("input, textarea, select, button").forEach((el) => {
      if (el.id === "tour_cancel_btn") return;
      el.disabled = true;
    });
  }
  setStatus(backendT("tour.status.read_only", "Read-only access."));
}

function collectDuplicateTitleCandidates(titleMap) {
  const normalizedMap = normalizeLocalizedTextMap(titleMap);
  const orderedLangs = [currentTourEditingLang(), "vi", "en", ...Object.keys(normalizedMap)];
  const seen = new Set();
  return orderedLangs
    .map((lang) => normalizeTourTextLang(lang))
    .filter((lang) => {
      if (!lang || seen.has(lang)) return false;
      seen.add(lang);
      return true;
    })
    .map((lang) => ({ lang, title: String(normalizedMap[lang] || "").trim() }))
    .filter((entry) => Boolean(entry.title));
}

async function findDuplicateTourTitle(titleMap, currentTourId) {
  const candidates = collectDuplicateTitleCandidates(titleMap);
  if (!candidates.length) return null;

  for (const candidate of candidates) {
    const duplicate = await findDuplicateTourTitleForLang(candidate.title, currentTourId, candidate.lang);
    if (duplicate) return duplicate;
  }

  return null;
}

async function findDuplicateTourTitleForLang(title, currentTourId, lang) {
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

    const request = toursRequest({ baseURL: apiOrigin, query: Object.fromEntries(query.entries()) });
    const requestUrl = new URL(request.url, window.location.origin);
    if (lang) requestUrl.searchParams.set("lang", lang);
    const payload = await fetchApi(`${requestUrl.pathname}${requestUrl.search}`);
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

function setTourPageOverlay(isVisible, message = "") {
  if (els.pageOverlayText) {
    els.pageOverlayText.textContent = String(
      message || backendT("tour.translation.translating_all_overlay", "Translating all languages. Please wait.")
    ).trim();
  }
  if (els.pageBody instanceof HTMLElement) {
    els.pageBody.classList.toggle("tour-detail-page--translation-busy", Boolean(isVisible));
  }
  if (els.pageHeader instanceof HTMLElement) {
    els.pageHeader.inert = Boolean(isVisible);
    els.pageHeader.setAttribute("aria-busy", isVisible ? "true" : "false");
  }
  if (els.mainContent instanceof HTMLElement) {
    els.mainContent.inert = Boolean(isVisible);
    els.mainContent.setAttribute("aria-busy", isVisible ? "true" : "false");
  }
  if (!(els.pageOverlay instanceof HTMLElement)) return;
  if (isVisible) {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    els.pageOverlay.hidden = false;
    els.pageOverlay.setAttribute("aria-hidden", "false");
    return;
  }
  els.pageOverlay.hidden = true;
  els.pageOverlay.setAttribute("aria-hidden", "true");
}

function setPendingHeroImagePreview(file) {
  if (state.pendingHeroImagePreviewUrl) {
    URL.revokeObjectURL(state.pendingHeroImagePreviewUrl);
    state.pendingHeroImagePreviewUrl = "";
  }
  if (!(file instanceof File)) return;
  state.pendingHeroImagePreviewUrl = URL.createObjectURL(file);
}

function renderHeroImage() {
  updateHeroImage(state.pendingHeroImagePreviewUrl || state.tour?.image || "");
}

function updateHeroImage(src) {
  if (!els.heroImage) return;
  const value = String(src || "").trim();
  if (!value) {
    els.heroImage.src = "assets/img/profile_booking.png";
    els.heroImage.classList.add("empty");
    return;
  }
  els.heroImage.src = /^(?:blob:|data:|https?:\/\/)/.test(value)
    ? value
    : absolutizeApiUrl(value);
  els.heroImage.classList.remove("empty");
}

function updateHeader(tour, destinations, styles) {
  updateHeaderTitle();
  if (!els.subtitle) return;
  const destText = destinations.length ? destinations.join(", ") : "-";
  const styleText = styles.length ? styles.join(", ") : "-";
  els.subtitle.textContent = backendT("tour.status.destinations_styles", "Destinations: {destinations} | Styles: {styles}", {
    destinations: destText,
    styles: styleText
  });
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
