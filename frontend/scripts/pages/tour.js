import {
  authMeRequest,
  tourCreateRequest,
  tourDetailRequest,
  toursRequest,
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
import { createTourTravelPlanAdapter } from "./tour_travel_plan_adapter.js";
import {
  destinationScopeTourDestinations,
  readDestinationScopeFromDom
} from "../shared/destination_scope_editor.js";
import {
  CUSTOMER_CONTENT_LANGUAGE_CODES,
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
  const explicitLang = normalizeText(url.searchParams.get("lang"));
  const lang = explicitLang || currentBackendLang();
  if (lang) url.searchParams.set("lang", lang);
  return `${url.pathname}${url.search}`;
}

const qs = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");
const apiOrigin = new URL(apiBase || "/", window.location.origin).toString().replace(/\/$/, "");

function normalizeText(value) {
  return String(value ?? "").trim();
}

function staleTourUpdateMessage() {
  return backendT("tour.error.stale_update", "This tour was updated by someone else. Reload before saving.");
}

function omitDerivedTravelPlanDestinations(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return plan;
  const { destinations: _derivedDestinations, ...next } = plan;
  return next;
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
    canEditTours: false,
    canEditBooking: false
  },
  allowPageUnload: false,
  formDirty: false,
  tour: null,
  booking: null,
  travelPlanDraft: null,
  travelPlanDirty: false,
  originalTravelPlanSnapshot: "",
  originalTravelPlanState: null,
  originalLocalizedContentSnapshot: "",
  reelVideoDraftItem: null,
  options: {
    destinations: [],
    styles: []
  },
  localizedContent: {
    title_i18n: {},
    short_description_i18n: {}
  },
  experienceHighlights: [],
  experienceHighlightsLoadFailed: false
};

const TOUR_SOURCE_LANG = "en";
const TOUR_DESCRIPTION_MAX_LENGTH = 170;
const TOUR_DESCRIPTION_WARNING_LENGTH = 150;
const TOUR_DESCRIPTION_MIN_FONT_SIZE_PX = 9;
const TOUR_DESCRIPTION_FIT_TOLERANCE_PX = 1;
const TOUR_DESCRIPTION_FIT_ITERATIONS = 8;
const ONE_PAGER_SMALL_IMAGE_LIMIT = 4;
const ONE_PAGER_EXPERIENCE_HIGHLIGHT_LIMIT = 4;
const TOUR_WEB_PAGE_MIN_IMAGE_COUNT = 2;
const EXPERIENCE_HIGHLIGHTS_BASE_PATH = "/assets/img/experience-highlights";

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
  dirtyBarTitle: document.getElementById("tour_dirty_bar_title"),
  dirtyBarSummary: document.getElementById("tour_dirty_bar_summary"),
  status: document.getElementById("tour_formStatus"),
  cancel: document.getElementById("tour_cancel_btn"),
  onePagerBtn: document.getElementById("tour_one_pager_btn"),
  onePagerLang: document.getElementById("tour_one_pager_lang"),
  destinationHidden: document.getElementById("tour_destinations"),
  destinationChoices: document.getElementById("tour_destination_choices"),
  stylesHidden: document.getElementById("tour_styles"),
  styleChoices: document.getElementById("tour_style_choices"),
  travel_plan_destination_scope_editor: document.getElementById("tour_destination_scope_editor"),
  seasonalityStartMonth: document.getElementById("tour_seasonality_start_month"),
  seasonalityEndMonth: document.getElementById("tour_seasonality_end_month"),
  publishedOnWebpage: document.getElementById("tour_published_on_webpage"),
  seoSlug: document.getElementById("tour_seo_slug"),
  localizedContentEditor: document.getElementById("tour_localized_content_editor"),
  onePagerImageSelector: document.getElementById("tour_one_pager_image_selector"),
  onePagerHeroImages: document.getElementById("tour_one_pager_hero_images"),
  onePagerBodyImages: document.getElementById("tour_one_pager_body_images"),
  onePagerExperienceHighlights: document.getElementById("tour_one_pager_experience_highlights"),
  onePagerClearImagesBtn: document.getElementById("tour_one_pager_clear_images_btn"),
  tourCardImageSelector: document.getElementById("tour_card_image_selector"),
  reelVideoCard: document.getElementById("tour_reel_video_card"),
  addReelVideoBtn: document.getElementById("tour_add_reel_btn"),
  reelVideoUpload: document.getElementById("tour_reel_upload"),
  travel_plan_panel: document.getElementById("travel_plan_panel"),
  travel_plan_panel_summary: document.getElementById("travel_plan_panel_summary"),
  travel_plan_editor: document.getElementById("travel_plan_editor"),
  travel_plan_status: document.getElementById("travel_plan_status"),
  travelPlanServiceLibraryModal: document.getElementById("travel_plan_service_library_modal"),
  travelPlanServiceLibraryCloseBtn: document.getElementById("travel_plan_service_library_close_btn"),
  travelPlanServiceLibraryTitle: document.getElementById("travel_plan_service_library_title"),
  travelPlanServiceLibraryQuery: document.getElementById("travel_plan_service_library_query"),
  travelPlanServiceLibraryKind: document.getElementById("travel_plan_service_library_kind"),
  travelPlanServiceLibrarySearchBtn: document.getElementById("travel_plan_service_library_search_btn"),
  travelPlanServiceLibraryStatus: document.getElementById("travel_plan_service_library_status"),
  travelPlanServiceLibraryResults: document.getElementById("travel_plan_service_library_results"),
  travelPlanServiceImageInput: document.getElementById("travel_plan_service_image_input"),
  travelPlanImagePreviewModal: document.getElementById("travel_plan_image_preview_modal"),
  travelPlanImagePreviewCloseBtn: document.getElementById("travel_plan_image_preview_close_btn"),
  travelPlanImagePreviewImage: document.getElementById("travel_plan_image_preview_image"),
  pageOverlay: document.getElementById("tour_page_overlay"),
  pageOverlayText: document.getElementById("tour_page_overlay_text")
};

let tourTravelPlanAdapter = null;

function refreshBackendNavElements() {
  els.logoutLink = document.getElementById("backendLogoutLink");
  els.userLabel = document.getElementById("backendUserLabel");
}

function hasAnyRoleInList(roleList, ...roles) {
  return roles.some((role) => roleList.includes(role));
}

function captureTourFormSnapshot() {
  if (!els.form) return "";
  const controls = Array.from(els.form.querySelectorAll("input, select, textarea"))
    .filter((control) => !shouldIgnoreTourSnapshotControl(control));
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
  snapshot.push([
    "tour_reel_video",
    state.reelVideoDraftItem
      ? (state.reelVideoDraftItem.kind === "stored"
        ? `stored:${state.reelVideoDraftItem.previewUrl || state.reelVideoDraftItem.name}`
        : `pending:${state.reelVideoDraftItem.file?.name || ""}:${state.reelVideoDraftItem.file?.size || 0}:${state.reelVideoDraftItem.file?.lastModified || 0}`)
      : ""
  ]);
  snapshot.push([
    "tour_localized_content",
    JSON.stringify(state.localizedContent || {})
  ]);
  snapshot.push([
    "tour_travel_plan",
    tourTravelPlanAdapter?.snapshot?.() || JSON.stringify(state.tour?.travel_plan || { days: [] })
  ]);
  return JSON.stringify(snapshot);
}

function shouldIgnoreTourSnapshotControl(control) {
  if (!(control instanceof HTMLElement)) return false;
  // These sub-editors already contribute their own semantic snapshots via state.
  return control === els.reelVideoUpload
    || Boolean(els.localizedContentEditor?.contains(control))
    || Boolean(els.travel_plan_destination_scope_editor?.contains(control))
    || Boolean(els.travel_plan_editor?.contains(control));
}

const TOUR_DIRTY_LOG_VALUE_LIMIT = 240;
const TOUR_DIRTY_LOG_MAX_CHANGES = 20;

function stringifyTourDirtyValue(value) {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatTourDirtyValue(value) {
  const serialized = stringifyTourDirtyValue(value);
  return serialized.length > TOUR_DIRTY_LOG_VALUE_LIMIT
    ? `${serialized.slice(0, TOUR_DIRTY_LOG_VALUE_LIMIT)}...`
    : serialized;
}

function parseTourSnapshotEntries(snapshot) {
  try {
    const rows = JSON.parse(String(snapshot || "[]"));
    if (!Array.isArray(rows)) return null;
    return rows.reduce((entries, row, index) => {
      if (!Array.isArray(row) || row.length < 2) return entries;
      const key = String(row[0] || `snapshot-${index}`);
      entries.set(key, row[1]);
      return entries;
    }, new Map());
  } catch {
    return null;
  }
}

function describeTourSnapshotChanges(cleanSnapshot, currentSnapshot) {
  const cleanEntries = parseTourSnapshotEntries(cleanSnapshot);
  const currentEntries = parseTourSnapshotEntries(currentSnapshot);
  if (!cleanEntries || !currentEntries) {
    return [{
      key: "snapshot",
      before: formatTourDirtyValue(cleanSnapshot),
      after: formatTourDirtyValue(currentSnapshot)
    }];
  }

  const keys = new Set([...cleanEntries.keys(), ...currentEntries.keys()]);
  return Array.from(keys)
    .filter((key) => stringifyTourDirtyValue(cleanEntries.get(key)) !== stringifyTourDirtyValue(currentEntries.get(key)))
    .map((key) => ({
      key,
      before: formatTourDirtyValue(cleanEntries.get(key)),
      after: formatTourDirtyValue(currentEntries.get(key))
    }));
}

let tourDirtySnapshotReady = false;

function logTourDirtyReason() {
  const cleanSnapshot = tourDirtyTracker.getCleanSnapshot();
  const currentSnapshot = captureTourFormSnapshot();
  const changes = describeTourSnapshotChanges(cleanSnapshot, currentSnapshot);
  console.log("[tour-dirty] Tour form became dirty.", {
    tour_id: state.id || state.tour?.id || "",
    lang: currentBackendLang(),
    changed_fields: changes.map((change) => change.key),
    shown_changes: changes.slice(0, TOUR_DIRTY_LOG_MAX_CHANGES),
    hidden_change_count: Math.max(0, changes.length - TOUR_DIRTY_LOG_MAX_CHANGES)
  });
}

const tourDirtyTracker = createSnapshotDirtyTracker({
  captureSnapshot: () => captureTourFormSnapshot(),
  isEnabled: () => state.permissions.canEditTours,
  onDirtyChange: (isDirty) => {
    const nextDirty = Boolean(isDirty);
    if (tourDirtySnapshotReady && nextDirty && state.formDirty !== true) {
      logTourDirtyReason();
    }
    state.formDirty = nextDirty;
    renderTourDirtyBar();
  }
});

function renderTourDirtyBar() {
  const isDirty = state.formDirty === true;
  els.dirtyBar?.classList.toggle("booking-dirty-bar--dirty", isDirty);
  if (els.dirtyBarTitle) {
    els.dirtyBarTitle.textContent = isDirty
      ? backendT("booking.page_save.unsaved", "Unsaved edits")
      : backendT("booking.page_save.clean", "No unsaved edits");
  }
  if (els.dirtyBarSummary) {
    els.dirtyBarSummary.textContent = "";
  }
  syncOnePagerButtonState();
}

function updateTourDirtyState() {
  if (!tourDirtySnapshotReady) {
    if (state.formDirty) {
      state.formDirty = false;
      renderTourDirtyBar();
    }
    return false;
  }
  return tourDirtyTracker.refresh();
}

function markTourSnapshotClean() {
  tourDirtyTracker.markClean();
  tourDirtySnapshotReady = true;
  state.originalLocalizedContentSnapshot = captureLocalizedContentSnapshot();
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

function renderOnePagerLanguageOptions() {
  if (!els.onePagerLang || String(els.onePagerLang.tagName || "").toLowerCase() !== "select") return;
  const languages = tourTextLanguages();
  const currentValue = normalizeTourTextLang(els.onePagerLang.value);
  const shouldPreserveCurrentValue = els.onePagerLang.dataset.onePagerLangInitialized === "true";
  const defaultLang = ["en", "vi"].includes(currentTourEditingLang())
    ? currentTourEditingLang()
    : "en";
  const fragment = document.createDocumentFragment();
  languages.forEach((language) => {
    const code = normalizeTourTextLang(language?.code);
    if (!code) return;
    const option = document.createElement("option");
    option.value = code;
    option.textContent = `${tourLanguageLabel(code)} (${tourLanguageShortLabel(code)})`;
    option.dir = normalizeText(language?.direction) || "ltr";
    fragment.append(option);
  });
  if (!fragment.childNodes.length) {
    const option = document.createElement("option");
    option.value = "en";
    option.textContent = "English (EN)";
    fragment.append(option);
  }
  els.onePagerLang.replaceChildren(fragment);
  const availableCodes = Array.from(els.onePagerLang.options).map((option) => normalizeTourTextLang(option.value));
  els.onePagerLang.value = shouldPreserveCurrentValue && availableCodes.includes(currentValue)
    ? currentValue
    : availableCodes.includes(defaultLang)
      ? defaultLang
      : normalizeTourTextLang(languages[0]?.code || "en");
  els.onePagerLang.dataset.onePagerLangInitialized = "true";
}

function selectedOnePagerLang() {
  return normalizeLanguageCode(els.onePagerLang?.value, {
    allowedCodes: CUSTOMER_CONTENT_LANGUAGE_CODES,
    fallback: "en"
  });
}

function experienceHighlightAssetSrc(imagePath) {
  const cleanPath = normalizeText(imagePath).replace(/^\/+/, "");
  if (!cleanPath) return "";
  return `${EXPERIENCE_HIGHLIGHTS_BASE_PATH}/${cleanPath.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function normalizeExperienceHighlightItem(item, index) {
  const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  const image = normalizeText(source.image);
  const id = normalizeText(source.id) || image.replace(/\.[^.]+$/, "") || `highlight_${index + 1}`;
  if (!image || !id) return null;
  const title_i18n = normalizeLocalizedTextMap(source.title_i18n || {});
  const title = normalizeText(source.title) || normalizeText(title_i18n.en) || id;
  return {
    id,
    image,
    src: experienceHighlightAssetSrc(image),
    title,
    title_i18n
  };
}

async function loadExperienceHighlights() {
  try {
    const response = await fetch(`${EXPERIENCE_HIGHLIGHTS_BASE_PATH}/manifest.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.experienceHighlights = (Array.isArray(payload) ? payload : [])
      .map((item, index) => normalizeExperienceHighlightItem(item, index))
      .filter(Boolean);
    state.experienceHighlightsLoadFailed = false;
  } catch (error) {
    state.experienceHighlights = [];
    state.experienceHighlightsLoadFailed = true;
    console.error("[tour-page] Failed to load one-pager experience highlights.", error);
  }
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

function truncateTourSourceDescription(value) {
  return String(value ?? "").slice(0, TOUR_DESCRIPTION_MAX_LENGTH);
}

function tourDescriptionCharacterCountText(value) {
  return backendT("tour.short_description_character_count", "{count} / {max} characters", {
    count: String(value ?? "").length,
    max: TOUR_DESCRIPTION_MAX_LENGTH
  });
}

function isTourDescriptionOverWarningLength(value) {
  return String(value ?? "").length > TOUR_DESCRIPTION_WARNING_LENGTH;
}

function normalizeTourShortDescriptionMap(value, fallbackValue = "") {
  const normalized = normalizeLocalizedTextMap(value);
  const fallback = normalizeText(fallbackValue);
  if (!normalized[TOUR_SOURCE_LANG] && fallback) {
    normalized[TOUR_SOURCE_LANG] = fallback;
  }
  if (normalized[TOUR_SOURCE_LANG]) {
    normalized[TOUR_SOURCE_LANG] = truncateTourSourceDescription(normalized[TOUR_SOURCE_LANG]);
  }
  return normalized;
}

function enforceTourSourceDescriptionLimit(control) {
  if (!control || control.getAttribute("data-tour-i18n-field") !== "short_description_i18n") return;
  const lang = normalizeTourTextLang(control.getAttribute("data-tour-i18n-lang"));
  if (lang !== TOUR_SOURCE_LANG) return;
  const truncated = truncateTourSourceDescription(control.value);
  if (control.value !== truncated) {
    control.value = truncated;
  }
}

function shouldShowTourContentSourceCue() {
  return normalizeTourTextLang(currentBackendLang()) === "vi";
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

function localizedFieldCounterId(field, lang) {
  return `${localizedFieldId(field, lang)}_counter`;
}

function getLocalizedField(field, lang) {
  return document.getElementById(localizedFieldId(field, lang));
}

function updateTourDescriptionCounter(control) {
  if (!control || control.getAttribute("data-tour-i18n-field") !== "short_description_i18n") return;
  const lang = normalizeTourTextLang(control.getAttribute("data-tour-i18n-lang"));
  const counter = document.getElementById(localizedFieldCounterId("short_description_i18n", lang));
  if (!counter) return;
  counter.textContent = tourDescriptionCharacterCountText(control.value ?? "");
  counter.classList.toggle(
    "tour-localized-content__counter--warning",
    isTourDescriptionOverWarningLength(control.value ?? "")
  );
}

function shouldFitTourShortDescriptionControl(control) {
  if (!(control instanceof HTMLElement)) return false;
  return control.getAttribute("data-tour-i18n-field") === "short_description_i18n"
    || control.getAttribute("data-tour-short-description-fit") === "1";
}

function fitTourShortDescriptionControl(control) {
  if (!(control instanceof HTMLElement) || !shouldFitTourShortDescriptionControl(control)) return;
  if (typeof window === "undefined" || !window.getComputedStyle) return;

  control.style.fontSize = "";
  const maxFontSize = Number.parseFloat(window.getComputedStyle(control).fontSize || "") || 14;
  const minFontSize = Math.min(maxFontSize, TOUR_DESCRIPTION_MIN_FONT_SIZE_PX);
  const availableHeight = Math.floor(control.clientHeight || 0);
  if (!(availableHeight > 0)) return;

  const previousOverflow = control.style.overflow;
  const previousHeight = control.style.height;
  const borderBoxHeight = Math.ceil(control.getBoundingClientRect().height || 0);
  control.style.overflow = "hidden";
  if (borderBoxHeight > 0) {
    control.style.height = `${borderBoxHeight}px`;
  }

  const measuredHeight = (fontSize) => {
    control.style.fontSize = `${fontSize}px`;
    return Math.ceil(control.scrollHeight || 0);
  };

  if (measuredHeight(maxFontSize) <= availableHeight + TOUR_DESCRIPTION_FIT_TOLERANCE_PX) {
    control.style.fontSize = "";
    control.style.overflow = previousOverflow;
    control.style.height = previousHeight;
    return;
  }

  let low = minFontSize;
  let high = maxFontSize;
  let best = minFontSize;
  for (let index = 0; index < TOUR_DESCRIPTION_FIT_ITERATIONS; index += 1) {
    const mid = (low + high) / 2;
    if (measuredHeight(mid) <= availableHeight + TOUR_DESCRIPTION_FIT_TOLERANCE_PX) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }
  }
  control.style.fontSize = `${best.toFixed(2)}px`;
  if ((control.scrollHeight || 0) > (control.clientHeight || 0) + TOUR_DESCRIPTION_FIT_TOLERANCE_PX) {
    const borderHeight = Math.max(0, (control.getBoundingClientRect().height || 0) - (control.clientHeight || 0));
    control.style.height = `${Math.ceil((control.scrollHeight || 0) + borderHeight)}px`;
  }
  control.style.overflow = previousOverflow;
}

function fitTourShortDescriptionControls(root = document) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('[data-tour-i18n-field="short_description_i18n"], [data-tour-short-description-fit="1"]').forEach((control) => {
    fitTourShortDescriptionControl(control);
  });
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

function createStoredReelVideoDraftItem(reelVideo) {
  return {
    key: `stored:${normalizeText(reelVideo?.preview_url || reelVideo?.filename || "video.mp4")}`,
    kind: "stored",
    name: normalizeText(reelVideo?.filename) || "video.mp4",
    previewUrl: normalizeText(reelVideo?.preview_url)
  };
}

function createPendingReelVideoDraftItem(file) {
  return {
    key: `pending:${file.name}:${file.size}:${file.lastModified}:${Math.random().toString(36).slice(2, 10)}`,
    kind: "pending",
    file,
    name: file.name,
    previewUrl: URL.createObjectURL(file)
  };
}

function revokeReelVideoDraftItem(item) {
  if (item?.kind === "pending" && item.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

function replaceReelVideoDraftItem(item) {
  revokeReelVideoDraftItem(state.reelVideoDraftItem);
  state.reelVideoDraftItem = item || null;
}

function syncReelVideoDraftItemFromTour(tour) {
  const reelVideo = tour?.reel_video && typeof tour.reel_video === "object" ? tour.reel_video : null;
  replaceReelVideoDraftItem(reelVideo ? createStoredReelVideoDraftItem(reelVideo) : null);
  renderTourReelVideo();
}

function reelVideoPreviewSrc(item) {
  if (item?.kind === "pending") return item.previewUrl;
  return absolutizeApiUrl(item?.previewUrl || "");
}

function revealMediaFilename(target) {
  if (!(target instanceof Element)) return false;
  const trigger = target.closest("[data-tour-media-filename-trigger]");
  if (!trigger) return false;
  const media = trigger.closest(".tour-reel-card__media");
  const filename = media?.querySelector(".tour-reel-card__filename");
  if (!(filename instanceof HTMLElement)) return false;
  filename.hidden = false;
  return true;
}

function updateReelVideoButtonLabel() {
  if (!els.addReelVideoBtn) return;
  const hasReelVideo = Boolean(state.reelVideoDraftItem);
  const i18nId = hasReelVideo ? "tour.change_reel_video" : "tour.new_reel_video";
  const fallback = hasReelVideo ? "Change Reel" : "New Reel";
  els.addReelVideoBtn.textContent = backendT(i18nId, fallback);
  els.addReelVideoBtn.setAttribute("data-i18n-id", i18nId);
}

function renderTourReelVideo() {
  if (!els.reelVideoCard) return;
  const item = state.reelVideoDraftItem;
  updateReelVideoButtonLabel();
  if (!item) {
    els.reelVideoCard.innerHTML = `<div class="tour-reel-empty micro">${escapeHtml(backendT("tour.reel_video_empty", "No reel video uploaded yet."))}</div>`;
    return;
  }

  const removeDisabled = !state.permissions.canEditTours ? "disabled" : "";
  const previewSrc = reelVideoPreviewSrc(item);
  const fileName = item.name || "video.mp4";
  const preview = previewSrc
    ? `<video class="tour-reel-card__preview" src="${escapeHtml(previewSrc)}" controls muted playsinline preload="metadata" data-tour-media-filename-trigger="true"></video>`
    : `<div class="tour-reel-card__preview" aria-hidden="true" data-tour-media-filename-trigger="true"></div>`;
  els.reelVideoCard.innerHTML = `
    <div class="tour-reel-card">
      <div class="tour-reel-card__media">
        <div class="tour-reel-card__frame">
          ${preview}
        </div>
        <span class="tour-reel-card__filename micro" hidden>${escapeHtml(fileName)}</span>
      </div>
      <button class="btn btn-ghost tour-reel-card__remove" type="button" data-tour-remove-reel-video="true" ${removeDisabled}>
        ${escapeHtml(backendT("tour.remove_reel_video", "Remove reel video"))}
      </button>
    </div>
  `;
}

function resolveTravelPlanImageSrc(pathValue) {
  const normalized = normalizeText(pathValue);
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith("/")) return `${apiOrigin}${normalized}`;
  return normalized;
}

function currentTourTravelPlan() {
  return state.travelPlanDraft || state.booking?.travel_plan || state.tour?.travel_plan || { days: [] };
}

function collectTourCardImageOptions(plan = currentTourTravelPlan()) {
  const result = [];
  for (const [dayIndex, day] of (Array.isArray(plan?.days) ? plan.days : []).entries()) {
    const dayLabel = backendT("booking.travel_plan.day_heading", "Day {day}", { day: String(dayIndex + 1) });
    for (const [serviceIndex, service] of (Array.isArray(day?.services) ? day.services : []).entries()) {
      const image = service?.image && typeof service.image === "object" && !Array.isArray(service.image)
        ? service.image
        : null;
      const storagePath = normalizeText(image?.storage_path);
      const imageId = normalizeText(image?.id);
      if (!image || !storagePath || !imageId || image.is_customer_visible === false) continue;
      const serviceLabel = normalizeText(service?.title)
        || backendT("booking.travel_plan.service_label", "Service {service}", { service: String(serviceIndex + 1) });
      result.push({
        id: imageId,
        storagePath,
        src: resolveTravelPlanImageSrc(storagePath),
        label: `${dayLabel} · ${serviceLabel}`,
        included: image.include_in_travel_tour_card === true
      });
    }
  }
  return result;
}

function normalizeTourCardImageIdList(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map((entry) => normalizeText(entry))
    .filter(Boolean)));
}

function selectedTourCardImageIds(plan, images) {
  const availableIds = new Set((Array.isArray(images) ? images : []).map((image) => image.id));
  const storedIds = normalizeTourCardImageIdList(plan?.tour_card_image_ids)
    .filter((imageId) => availableIds.has(imageId));
  if (storedIds.length) return storedIds;

  const legacyIds = (Array.isArray(images) ? images : [])
    .filter((image) => image.included)
    .map((image) => image.id);
  const storedPrimaryId = normalizeText(plan?.tour_card_primary_image_id);
  const primaryIndex = storedPrimaryId ? legacyIds.indexOf(storedPrimaryId) : -1;
  if (primaryIndex > 0) {
    const [primaryId] = legacyIds.splice(primaryIndex, 1);
    legacyIds.unshift(primaryId);
  }
  return legacyIds;
}

function tourWebPagePublicationEligibility(plan = currentTourTravelPlan()) {
  const rootScopeCount = destinationScopeTourDestinations(plan?.destination_scope).length;
  const imageCount = selectedTourCardImageIds(plan, collectTourCardImageOptions(plan)).length;
  const hasRootScope = rootScopeCount > 0;
  const hasEnoughImages = imageCount >= TOUR_WEB_PAGE_MIN_IMAGE_COUNT;
  const canPublish = hasRootScope && hasEnoughImages;
  const message = canPublish
    ? backendT("tour.published_on_webpage", "Published on webpage")
    : !hasRootScope && !hasEnoughImages
      ? backendT("tour.published_on_webpage_disabled_scope_and_images", "Select a root destination scope and at least 2 web page images before publishing on the web page.")
      : !hasRootScope
        ? backendT("tour.published_on_webpage_disabled_scope", "Select a root destination scope before publishing on the web page.")
        : backendT("tour.published_on_webpage_disabled_images", "Select at least 2 web page images before publishing on the web page.");
  return {
    canPublish,
    hasRootScope,
    hasEnoughImages,
    imageCount,
    message
  };
}

function syncPublishedOnWebpageControl(plan = currentTourTravelPlan()) {
  if (!(els.publishedOnWebpage instanceof HTMLInputElement)) return;
  const eligibility = tourWebPagePublicationEligibility(plan);
  if (!eligibility.canPublish) {
    els.publishedOnWebpage.checked = false;
  }
  els.publishedOnWebpage.disabled = !state.permissions.canEditTours || !eligibility.canPublish;
  els.publishedOnWebpage.title = eligibility.message;
  els.publishedOnWebpage.setAttribute("aria-disabled", els.publishedOnWebpage.disabled ? "true" : "false");
}

function applyTourCardImageSelectionToPlan(plan, orderedImageIds) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return;
  const normalizedIds = normalizeTourCardImageIdList(orderedImageIds);
  const selectedSet = new Set(normalizedIds);
  plan.tour_card_image_ids = normalizedIds;
  plan.tour_card_primary_image_id = normalizedIds[0] || null;
  for (const day of Array.isArray(plan.days) ? plan.days : []) {
    for (const service of Array.isArray(day?.services) ? day.services : []) {
      const image = service?.image && typeof service.image === "object" && !Array.isArray(service.image)
        ? service.image
        : null;
      if (!image) continue;
      image.include_in_travel_tour_card = selectedSet.has(normalizeText(image.id));
    }
  }
}

function syncTourCardImageSelectionAcrossState(plan) {
  const selectedIds = normalizeTourCardImageIdList(plan?.tour_card_image_ids);
  applyTourCardImageSelectionToPlan(plan, selectedIds);
  if (state.travelPlanDraft && state.travelPlanDraft !== plan) {
    applyTourCardImageSelectionToPlan(state.travelPlanDraft, selectedIds);
  }
  if (state.booking?.travel_plan && state.booking.travel_plan !== plan) {
    applyTourCardImageSelectionToPlan(state.booking.travel_plan, selectedIds);
  }
  if (state.tour?.travel_plan && state.tour.travel_plan !== plan) {
    applyTourCardImageSelectionToPlan(state.tour.travel_plan, selectedIds);
  }
}

function selectedOnePagerHeroImageId(plan, images) {
  const availableIds = new Set((Array.isArray(images) ? images : []).map((image) => image.id));
  const storedId = normalizeText(plan?.one_pager_hero_image_id);
  if (storedId && availableIds.has(storedId)) return storedId;
  const selectedIds = selectedOnePagerImageIds(plan, images);
  if (selectedIds[0]) return selectedIds[0];
  const webIds = selectedTourCardImageIds(plan, images);
  if (webIds[0]) return webIds[0];
  return images[0]?.id || "";
}

function selectedOnePagerImageIds(plan, images) {
  const availableIds = new Set((Array.isArray(images) ? images : []).map((image) => image.id));
  const hasExplicitImageIds = Object.prototype.hasOwnProperty.call(plan || {}, "one_pager_image_ids");
  const storedIds = normalizeTourCardImageIdList(plan?.one_pager_image_ids)
    .filter((imageId) => availableIds.has(imageId));
  if (hasExplicitImageIds) return storedIds.slice(0, ONE_PAGER_SMALL_IMAGE_LIMIT);
  return selectedTourCardImageIds(plan, images).slice(0, ONE_PAGER_SMALL_IMAGE_LIMIT);
}

function applyOnePagerImageSelectionToPlan(plan, { heroImageId = "", imageIds = [] } = {}) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return;
  plan.one_pager_hero_image_id = normalizeText(heroImageId) || null;
  plan.one_pager_image_ids = normalizeTourCardImageIdList(imageIds)
    .filter((imageId) => imageId !== plan.one_pager_hero_image_id)
    .slice(0, ONE_PAGER_SMALL_IMAGE_LIMIT);
}

function syncOnePagerImageSelectionAcrossState(plan) {
  const images = collectTourCardImageOptions(plan);
  const heroImageId = selectedOnePagerHeroImageId(plan, images);
  const imageIds = selectedOnePagerImageIds(plan, images).filter((imageId) => imageId !== heroImageId);
  applyOnePagerImageSelectionToPlan(plan, { heroImageId, imageIds });
  if (state.travelPlanDraft && state.travelPlanDraft !== plan) {
    applyOnePagerImageSelectionToPlan(state.travelPlanDraft, { heroImageId, imageIds });
  }
  if (state.booking?.travel_plan && state.booking.travel_plan !== plan) {
    applyOnePagerImageSelectionToPlan(state.booking.travel_plan, { heroImageId, imageIds });
  }
  if (state.tour?.travel_plan && state.tour.travel_plan !== plan) {
    applyOnePagerImageSelectionToPlan(state.tour.travel_plan, { heroImageId, imageIds });
  }
}

function experienceHighlightOptions() {
  return Array.isArray(state.experienceHighlights) ? state.experienceHighlights : [];
}

function experienceHighlightById(id) {
  const normalizedId = normalizeText(id);
  return experienceHighlightOptions().find((item) => item.id === normalizedId) || null;
}

function localizedExperienceHighlightTitle(item, lang = selectedOnePagerLang()) {
  const titleMap = item?.title_i18n && typeof item.title_i18n === "object" && !Array.isArray(item.title_i18n)
    ? item.title_i18n
    : {};
  const normalizedLang = normalizeLanguageCode(lang, {
    allowedCodes: CUSTOMER_CONTENT_LANGUAGE_CODES,
    fallback: "en"
  });
  return normalizeText(titleMap[normalizedLang])
    || normalizeText(titleMap.en)
    || normalizeText(item?.title)
    || normalizeText(item?.id);
}

function onePagerExperienceHighlightSlots(plan) {
  const source = Array.isArray(plan?.one_pager_experience_highlight_ids)
    ? plan.one_pager_experience_highlight_ids
    : [];
  const slots = source.slice(0, ONE_PAGER_EXPERIENCE_HIGHLIGHT_LIMIT).map((value) => normalizeText(value));
  while (slots.length < ONE_PAGER_EXPERIENCE_HIGHLIGHT_LIMIT) slots.push("");
  return slots;
}

function selectedOnePagerExperienceHighlightIds(plan) {
  const availableIds = new Set(experienceHighlightOptions().map((item) => item.id));
  const seen = new Set();
  return onePagerExperienceHighlightSlots(plan)
    .filter((id) => {
      if (!id || seen.has(id)) return false;
      if (availableIds.size && !availableIds.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, ONE_PAGER_EXPERIENCE_HIGHLIGHT_LIMIT);
}

function applyOnePagerExperienceHighlightSelectionToPlan(plan, highlightIds = []) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return;
  const availableIds = new Set(experienceHighlightOptions().map((item) => item.id));
  const seen = new Set();
  plan.one_pager_experience_highlight_ids = (Array.isArray(highlightIds) ? highlightIds : [])
    .slice(0, ONE_PAGER_EXPERIENCE_HIGHLIGHT_LIMIT)
    .map((value) => {
      const id = normalizeText(value);
      if (!id) return "";
      if (seen.has(id)) return "";
      if (availableIds.size && !availableIds.has(id)) return "";
      seen.add(id);
      return id;
    });
  while (plan.one_pager_experience_highlight_ids.length < ONE_PAGER_EXPERIENCE_HIGHLIGHT_LIMIT) {
    plan.one_pager_experience_highlight_ids.push("");
  }
}

function syncOnePagerExperienceHighlightSelectionAcrossState(plan) {
  const slots = onePagerExperienceHighlightSlots(plan);
  applyOnePagerExperienceHighlightSelectionToPlan(plan, slots);
  if (state.travelPlanDraft && state.travelPlanDraft !== plan) {
    applyOnePagerExperienceHighlightSelectionToPlan(state.travelPlanDraft, slots);
  }
  if (state.booking?.travel_plan && state.booking.travel_plan !== plan) {
    applyOnePagerExperienceHighlightSelectionToPlan(state.booking.travel_plan, slots);
  }
  if (state.tour?.travel_plan && state.tour.travel_plan !== plan) {
    applyOnePagerExperienceHighlightSelectionToPlan(state.tour.travel_plan, slots);
  }
}

function hasRequiredOnePagerExperienceHighlights() {
  return selectedOnePagerExperienceHighlightIds(currentTourTravelPlan()).length >= ONE_PAGER_EXPERIENCE_HIGHLIGHT_LIMIT;
}

function hasSelectedOnePagerSmallImage(plan = currentTourTravelPlan()) {
  const images = collectTourCardImageOptions(plan);
  const heroImageId = selectedOnePagerHeroImageId(plan, images);
  return selectedOnePagerImageIds(plan, images).some((imageId) => imageId !== heroImageId);
}

function onePagerButtonDisabledMessage({ highlightsReady = hasRequiredOnePagerExperienceHighlights(), smallImageReady = hasSelectedOnePagerSmallImage() } = {}) {
  if (!highlightsReady) {
    return backendT("tour.one_pager_experience_highlights_required", "Select 4 experience highlights to create the one-page PDF.");
  }
  if (!smallImageReady) {
    return backendT("tour.one_pager_small_image_required", "Select at least one small image to create the one-page PDF.");
  }
  return backendT("tour.status.one_pager_save_first", "Save the tour before creating a one-pager PDF.");
}

function renderTourCardImageThumb(image, selectedOrder, { selectable = false } = {}) {
  const selected = Number.isInteger(selectedOrder) && selectedOrder > 0;
  const title = selected
    ? backendT("tour.card_images.selected_order", "{label} is web page image {order}", { label: image.label, order: String(selectedOrder) })
    : selectable
      ? backendT("tour.card_images.select_for_web_page", "Add {label} to the web page images", { label: image.label })
      : backendT("tour.card_images.select_disabled", "{label} cannot be selected right now", { label: image.label });
  const canUseButton = state.permissions.canEditTours;
  const tagName = canUseButton ? "button" : "span";
  const attrs = canUseButton
    ? `type="button" data-tour-card-select-image="${escapeHtml(image.id)}"${selectable ? "" : " disabled"}`
    : `aria-disabled="true"`;
  const badge = selected ? String(selectedOrder) : "";
  return `
    <${tagName}
      class="tour-card-image-selector__thumb${selected ? " is-selected" : ""}"
      data-image-selector-action="tour-card"
      data-image-selector-id="${escapeHtml(image.id)}"
      ${attrs}
      title="${escapeHtml(title)}"
      aria-label="${escapeHtml(title)}"
    >
      <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.label)}" loading="lazy" />
      <span class="tour-card-image-selector__order" aria-hidden="true"${selected ? "" : " hidden"}>${escapeHtml(badge)}</span>
    </${tagName}>
  `;
}

function renderOnePagerImageThumb(image, { selected = false, badge = "", selectable = false, action = "hero", disabledTitle = "" } = {}) {
  const title = action === "hero"
    ? backendT("tour.one_pager_select_hero", "Use {label} as the one-page PDF hero image", { label: image.label })
    : backendT("tour.one_pager_select_body_image", "Add {label} to the one-page PDF images", { label: image.label });
  const selectedTitle = action === "hero"
    ? backendT("tour.one_pager_selected_hero", "{label} is the one-page PDF hero image", { label: image.label })
    : backendT("tour.one_pager_selected_body_image", "{label} is one-page PDF image {order}", { label: image.label, order: badge });
  const inactiveTitle = normalizeText(disabledTitle) || title;
  const dataAttribute = action === "hero" ? "data-one-pager-hero-image" : "data-one-pager-select-image";
  const canUseButton = state.permissions.canEditTours;
  const tagName = canUseButton ? "button" : "span";
  const attrs = canUseButton
    ? `type="button" ${dataAttribute}="${escapeHtml(image.id)}"${selectable ? "" : " disabled"}`
    : `aria-disabled="true"`;
  const badgeText = selected ? badge : "";
  return `
    <${tagName}
      class="tour-card-image-selector__thumb${selected ? " is-selected" : ""}"
      data-image-selector-action="${escapeHtml(action)}"
      data-image-selector-id="${escapeHtml(image.id)}"
      ${attrs}
      title="${escapeHtml(selected ? selectedTitle : selectable ? title : inactiveTitle)}"
      aria-label="${escapeHtml(selected ? selectedTitle : selectable ? title : inactiveTitle)}"
    >
      <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.label)}" loading="lazy" />
      <span class="tour-card-image-selector__order" aria-hidden="true"${selected ? "" : " hidden"}>${escapeHtml(badgeText)}</span>
    </${tagName}>
  `;
}

function renderOnePagerExperienceHighlightSummary(item, placeholderLabel) {
  if (!item) {
    return `<span class="tour-experience-highlight-select__text">${escapeHtml(placeholderLabel)}</span>`;
  }
  const title = localizedExperienceHighlightTitle(item);
  return `
    <img class="tour-experience-highlight-select__icon" src="${escapeHtml(item.src)}" alt="" aria-hidden="true" loading="lazy" />
    <span class="tour-experience-highlight-select__text">${escapeHtml(title)}</span>
  `;
}

function renderOnePagerExperienceHighlightOption({ item = null, index, value = "", selected = false, disabled = false, label = "" } = {}) {
  const optionLabel = item ? localizedExperienceHighlightTitle(item) : label;
  const iconMarkup = item
    ? `<img class="tour-experience-highlight-select__icon" src="${escapeHtml(item.src)}" alt="" aria-hidden="true" loading="lazy" />`
    : "";
  return `
    <button
      class="tour-experience-highlight-select__option${selected ? " is-selected" : ""}"
      type="button"
      data-one-pager-highlight-index="${escapeHtml(String(index))}"
      data-one-pager-highlight-option="${escapeHtml(value)}"
      ${disabled ? "disabled" : ""}
      role="option"
      aria-selected="${selected ? "true" : "false"}"
    >
      ${iconMarkup}
      <span class="tour-experience-highlight-select__text">${escapeHtml(optionLabel)}</span>
    </button>
  `;
}

function renderOnePagerExperienceHighlightSelectors(plan = currentTourTravelPlan()) {
  if (!(els.onePagerExperienceHighlights instanceof HTMLElement)) return;
  const highlights = experienceHighlightOptions();
  const slots = onePagerExperienceHighlightSlots(plan);
  applyOnePagerExperienceHighlightSelectionToPlan(plan, slots);
  const placeholderLabel = backendT("tour.one_pager_select_one", "select one");
  if (!highlights.length) {
    const message = state.experienceHighlightsLoadFailed
      ? backendT("tour.one_pager_experience_highlights_load_failed", "Experience highlights could not be loaded.")
      : backendT("tour.one_pager_experience_highlights_empty", "No experience highlights are available.");
    setHtmlIfChanged(els.onePagerExperienceHighlights, `<span class="micro">${escapeHtml(message)}</span>`);
    syncOnePagerButtonState();
    return;
  }

  const selectedIds = new Set(slots.filter(Boolean));
  const html = Array.from({ length: ONE_PAGER_EXPERIENCE_HIGHLIGHT_LIMIT }, (_, index) => {
    const selectedId = slots[index] || "";
    const selectedItem = experienceHighlightById(selectedId);
    const optionsMarkup = [
      renderOnePagerExperienceHighlightOption({
        index,
        value: "",
        selected: !selectedId,
        disabled: !state.permissions.canEditTours,
        label: placeholderLabel
      }),
      ...highlights.map((item) => renderOnePagerExperienceHighlightOption({
        item,
        index,
        value: item.id,
        selected: item.id === selectedId,
        disabled: !state.permissions.canEditTours || (selectedIds.has(item.id) && item.id !== selectedId)
      }))
    ].join("");
    const label = selectedItem ? localizedExperienceHighlightTitle(selectedItem) : placeholderLabel;
    return `
      <div class="tour-experience-highlight-select">
        <details class="tour-experience-highlight-select__details" data-one-pager-highlight-details>
          <summary
            class="tour-experience-highlight-select__summary"
            aria-label="${escapeHtml(label)}"
          >${renderOnePagerExperienceHighlightSummary(selectedItem, placeholderLabel)}</summary>
          <div class="tour-experience-highlight-select__menu" role="listbox">
            ${optionsMarkup}
          </div>
        </details>
      </div>
    `;
  }).join("");
  setHtmlIfChanged(els.onePagerExperienceHighlights, html);
  syncOnePagerButtonState();
}

function setHtmlIfChanged(element, html) {
  if (!(element instanceof HTMLElement)) return;
  if (element.innerHTML !== html) {
    element.innerHTML = html;
  }
}

function syncElementAttributes(target, source) {
  if (!(target instanceof Element) || !(source instanceof Element)) return;
  Array.from(target.attributes).forEach((attribute) => {
    if (!source.hasAttribute(attribute.name)) {
      target.removeAttribute(attribute.name);
    }
  });
  Array.from(source.attributes).forEach((attribute) => {
    if (target.getAttribute(attribute.name) !== attribute.value) {
      target.setAttribute(attribute.name, attribute.value);
    }
  });
}

function patchImageSelectorThumb(currentThumb, nextThumb) {
  syncElementAttributes(currentThumb, nextThumb);
  const currentImage = currentThumb.querySelector("img");
  const nextImage = nextThumb.querySelector("img");
  if (currentImage instanceof HTMLImageElement && nextImage instanceof HTMLImageElement) {
    syncElementAttributes(currentImage, nextImage);
  }
  const currentOrder = currentThumb.querySelector(".tour-card-image-selector__order");
  const nextOrder = nextThumb.querySelector(".tour-card-image-selector__order");
  if (currentOrder instanceof HTMLElement && nextOrder instanceof HTMLElement) {
    syncElementAttributes(currentOrder, nextOrder);
    if (currentOrder.textContent !== nextOrder.textContent) {
      const textNode = Array.from(currentOrder.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
      if (textNode) {
        textNode.nodeValue = nextOrder.textContent || "";
      } else {
        currentOrder.append(document.createTextNode(nextOrder.textContent || ""));
      }
    }
  }
}

function patchImageSelectorThumbs(container, html) {
  if (!(container instanceof HTMLElement)) return;
  const template = document.createElement("template");
  template.innerHTML = html;
  const nextThumbs = Array.from(template.content.children);
  const currentThumbs = Array.from(container.children);
  const canPatch = currentThumbs.length === nextThumbs.length
    && currentThumbs.every((currentThumb, index) => {
      const nextThumb = nextThumbs[index];
      return currentThumb instanceof HTMLElement
        && nextThumb instanceof HTMLElement
        && currentThumb.tagName === nextThumb.tagName
        && currentThumb.dataset.imageSelectorId === nextThumb.dataset.imageSelectorId
        && currentThumb.dataset.imageSelectorAction === nextThumb.dataset.imageSelectorAction;
    });

  if (!canPatch) {
    setHtmlIfChanged(container, html);
    return;
  }

  currentThumbs.forEach((currentThumb, index) => {
    const nextThumb = nextThumbs[index];
    if (currentThumb instanceof HTMLElement && nextThumb instanceof HTMLElement) {
      patchImageSelectorThumb(currentThumb, nextThumb);
    }
  });
}

function renderOnePagerImageSelector() {
  if (!(els.onePagerImageSelector instanceof HTMLElement)) return;
  const plan = currentTourTravelPlan();
  const images = collectTourCardImageOptions(plan);
  const heroImageId = selectedOnePagerHeroImageId(plan, images);
  const selectedIds = selectedOnePagerImageIds(plan, images).filter((imageId) => imageId !== heroImageId);
  applyOnePagerImageSelectionToPlan(plan, { heroImageId, imageIds: selectedIds });
  const orderByImageId = new Map(selectedIds.map((imageId, index) => [imageId, index + 1]));
  const emptyMarkup = `<span class="micro">${escapeHtml(backendT("tour.card_images.none_available", "No service images are available for the web page."))}</span>`;
  if (els.onePagerHeroImages) {
    patchImageSelectorThumbs(els.onePagerHeroImages, images.length
      ? images.map((image) => renderOnePagerImageThumb(image, {
        selected: image.id === heroImageId,
        badge: "H",
        selectable: state.permissions.canEditTours,
        action: "hero"
      })).join("")
      : emptyMarkup);
  }
  if (els.onePagerBodyImages) {
    patchImageSelectorThumbs(els.onePagerBodyImages, images.length
      ? images.map((image) => {
        const isHeroImage = image.id === heroImageId;
        return renderOnePagerImageThumb(image, {
          selected: orderByImageId.has(image.id),
          badge: orderByImageId.has(image.id) ? String(orderByImageId.get(image.id)) : "",
          selectable: state.permissions.canEditTours
            && !isHeroImage
            && (orderByImageId.has(image.id) || selectedIds.length < ONE_PAGER_SMALL_IMAGE_LIMIT),
          action: "body",
          disabledTitle: isHeroImage
            ? backendT("tour.one_pager_hero_already_used", "This image is already used as the one-page PDF hero image.")
            : ""
        });
      }).join("")
      : emptyMarkup);
  }
  if (els.onePagerClearImagesBtn) {
    els.onePagerClearImagesBtn.disabled = !state.permissions.canEditTours || !selectedIds.length;
  }
  syncOnePagerExperienceHighlightSelectionAcrossState(plan);
  renderOnePagerExperienceHighlightSelectors(plan);
}

function ensureTourCardImageSelectorShell() {
  if (!(els.tourCardImageSelector instanceof HTMLElement)) return null;
  let thumbs = els.tourCardImageSelector.querySelector("[data-tour-card-image-thumbs]");
  let clearButton = els.tourCardImageSelector.querySelector("[data-tour-card-clear-images]");
  if (!(thumbs instanceof HTMLElement) || !(clearButton instanceof HTMLButtonElement)) {
    els.tourCardImageSelector.innerHTML = `
      <div class="tour-card-image-selector__layout">
        <img class="tour-card-image-selector__preview" src="/assets/img/marketing_tour.png" alt="" aria-hidden="true" loading="lazy" />
        <div class="tour-card-image-selector__content">
          <div class="tour-card-image-selector__head">
            <button class="btn btn-ghost" type="button" data-tour-card-clear-images>${escapeHtml(backendT("tour.card_images.clear", "Clear"))}</button>
          </div>
          <div class="tour-card-image-selector__thumbs" data-tour-card-image-thumbs></div>
        </div>
      </div>
    `;
    thumbs = els.tourCardImageSelector.querySelector("[data-tour-card-image-thumbs]");
    clearButton = els.tourCardImageSelector.querySelector("[data-tour-card-clear-images]");
  }
  if (!(thumbs instanceof HTMLElement) || !(clearButton instanceof HTMLButtonElement)) return null;
  return { clearButton, thumbs };
}

function renderTourCardImageSelector() {
  if (!(els.tourCardImageSelector instanceof HTMLElement)) return;
  const plan = currentTourTravelPlan();
  const images = collectTourCardImageOptions(plan);
  const selectedIds = selectedTourCardImageIds(plan, images);
  applyTourCardImageSelectionToPlan(plan, selectedIds);
  const orderByImageId = new Map(selectedIds.map((imageId, index) => [imageId, index + 1]));
  const thumbsMarkup = images.length
    ? images
      .map((image) => renderTourCardImageThumb(image, orderByImageId.get(image.id) || 0, { selectable: state.permissions.canEditTours }))
      .join("")
    : `<span class="micro">${escapeHtml(backendT("tour.card_images.none_available", "No service images are available for the web page."))}</span>`;
  const shell = ensureTourCardImageSelectorShell();
  if (!shell) return;
  shell.clearButton.disabled = !state.permissions.canEditTours || !selectedIds.length;
  const clearLabel = backendT("tour.card_images.clear", "Clear");
  if (shell.clearButton.textContent !== clearLabel) {
    shell.clearButton.textContent = clearLabel;
  }
  patchImageSelectorThumbs(shell.thumbs, thumbsMarkup);
  syncPublishedOnWebpageControl(plan);
}

function syncTourCardImageSelectorFromEditor({ renderSelectors = true } = {}) {
  const result = tourTravelPlanAdapter?.collectPayload?.({
    focusFirstInvalid: false,
    pruneEmptyContent: false
  });
  if (result?.ok) {
    state.travelPlanDraft = result.payload;
    if (state.booking) state.booking.travel_plan = result.payload;
    if (state.tour) state.tour.travel_plan = result.payload;
  }
  syncOnePagerImageSelectionAcrossState(currentTourTravelPlan());
  syncOnePagerExperienceHighlightSelectionAcrossState(currentTourTravelPlan());
  syncTourCardImageSelectionAcrossState(currentTourTravelPlan());
  if (renderSelectors) {
    renderOnePagerImageSelector();
    renderTourCardImageSelector();
  }
}

function selectOnePagerHeroImage(imageId) {
  const normalizedImageId = normalizeText(imageId);
  if (!normalizedImageId || !state.permissions.canEditTours) return;
  syncTourCardImageSelectorFromEditor({ renderSelectors: false });
  const plan = currentTourTravelPlan();
  const images = collectTourCardImageOptions(plan);
  if (!images.some((image) => image.id === normalizedImageId)) {
    setStatus(backendT("tour.card_images.select_available_only", "Only available service images can be selected for the web page."));
    return;
  }
  const selectedIds = selectedOnePagerImageIds(plan, images).filter((imageIdValue) => imageIdValue !== normalizedImageId);
  applyOnePagerImageSelectionToPlan(plan, { heroImageId: normalizedImageId, imageIds: selectedIds });
  syncOnePagerImageSelectionAcrossState(plan);
  renderOnePagerImageSelector();
  updateTourDirtyState();
  setStatus(backendT("tour.one_pager_hero_selected", "One-page PDF hero image selected. Save changes to publish it."));
}

function selectOnePagerBodyImage(imageId) {
  const normalizedImageId = normalizeText(imageId);
  if (!normalizedImageId || !state.permissions.canEditTours) return;
  syncTourCardImageSelectorFromEditor({ renderSelectors: false });
  const plan = currentTourTravelPlan();
  const images = collectTourCardImageOptions(plan);
  if (!images.some((image) => image.id === normalizedImageId)) {
    setStatus(backendT("tour.card_images.select_available_only", "Only available service images can be selected for the web page."));
    return;
  }
  const heroImageId = selectedOnePagerHeroImageId(plan, images);
  if (normalizedImageId === heroImageId) {
    setStatus(backendT("tour.one_pager_hero_already_used", "This image is already used as the one-page PDF hero image."));
    return;
  }
  const selectedIds = selectedOnePagerImageIds(plan, images).filter((imageIdValue) => imageIdValue !== heroImageId);
  if (selectedIds.includes(normalizedImageId)) {
    setStatus(backendT("tour.one_pager_image_already_selected", "This image is already selected for the one-page PDF."));
    return;
  }
  if (selectedIds.length >= ONE_PAGER_SMALL_IMAGE_LIMIT) {
    setStatus(backendT("tour.one_pager_image_limit_reached", "Only 4 small images can be selected for the one-page PDF."));
    return;
  }
  applyOnePagerImageSelectionToPlan(plan, { heroImageId, imageIds: [...selectedIds, normalizedImageId] });
  syncOnePagerImageSelectionAcrossState(plan);
  renderOnePagerImageSelector();
  updateTourDirtyState();
  setStatus(backendT("tour.one_pager_image_selected", "One-page PDF image selected. Save changes to publish it."));
}

function clearOnePagerBodyImages() {
  if (!state.permissions.canEditTours) return;
  syncTourCardImageSelectorFromEditor({ renderSelectors: false });
  const plan = currentTourTravelPlan();
  const images = collectTourCardImageOptions(plan);
  const heroImageId = selectedOnePagerHeroImageId(plan, images);
  applyOnePagerImageSelectionToPlan(plan, { heroImageId, imageIds: [] });
  syncOnePagerImageSelectionAcrossState(plan);
  renderOnePagerImageSelector();
  updateTourDirtyState();
  setStatus(backendT("tour.one_pager_images_cleared", "One-page PDF image selection cleared. Select images again, then save changes."));
}

function selectOnePagerExperienceHighlight(index, highlightId) {
  if (!state.permissions.canEditTours) return;
  const slotIndex = Number(index);
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= ONE_PAGER_EXPERIENCE_HIGHLIGHT_LIMIT) return;
  const normalizedHighlightId = normalizeText(highlightId);
  if (normalizedHighlightId && !experienceHighlightById(normalizedHighlightId)) {
    setStatus(backendT("tour.one_pager_experience_highlight_unavailable", "Only available experience highlights can be selected."));
    return;
  }
  syncTourCardImageSelectorFromEditor({ renderSelectors: false });
  const plan = currentTourTravelPlan();
  const slots = onePagerExperienceHighlightSlots(plan);
  slots[slotIndex] = normalizedHighlightId;
  applyOnePagerExperienceHighlightSelectionToPlan(plan, slots);
  syncOnePagerExperienceHighlightSelectionAcrossState(plan);
  renderOnePagerImageSelector();
  updateTourDirtyState();
  setStatus(hasRequiredOnePagerExperienceHighlights()
    ? backendT("tour.one_pager_experience_highlights_selected", "Experience highlights selected. Save changes to enable the one-page PDF.")
    : backendT("tour.one_pager_experience_highlights_required", "Select 4 experience highlights to create the one-page PDF."));
}

function selectTourCardImageForWebPage(imageId) {
  const normalizedImageId = normalizeText(imageId);
  if (!normalizedImageId || !state.permissions.canEditTours) return;
  syncTourCardImageSelectorFromEditor({ renderSelectors: false });
  const plan = currentTourTravelPlan();
  const images = collectTourCardImageOptions(plan);
  if (!images.some((image) => image.id === normalizedImageId)) {
    setStatus(backendT("tour.card_images.select_available_only", "Only available service images can be selected for the web page."));
    return;
  }
  const selectedIds = selectedTourCardImageIds(plan, images);
  if (selectedIds.includes(normalizedImageId)) {
    setStatus(backendT("tour.card_images.already_selected", "This image is already selected for the web page."));
    return;
  }
  applyTourCardImageSelectionToPlan(plan, [...selectedIds, normalizedImageId]);
  syncTourCardImageSelectionAcrossState(plan);
  renderTourCardImageSelector();
  updateTourDirtyState();
  setStatus(backendT("tour.card_images.image_selected", "Web page image selected. Save changes to publish it."));
}

function clearTourCardImagesForWebPage() {
  if (!state.permissions.canEditTours) return;
  syncTourCardImageSelectorFromEditor({ renderSelectors: false });
  const plan = currentTourTravelPlan();
  applyTourCardImageSelectionToPlan(plan, []);
  syncTourCardImageSelectionAcrossState(plan);
  renderTourCardImageSelector();
  updateTourDirtyState();
  setStatus(backendT("tour.card_images.cleared", "Web page image selection cleared. Select images again, then save changes."));
}

function renderLocalizedTourContentEditor() {
  if (!els.localizedContentEditor) return;
  const lang = TOUR_SOURCE_LANG;
  const language = tourLanguageMeta(lang);
  const direction = String(language?.direction || "ltr");
  const titleId = localizedFieldId("title_i18n", lang);
  const descriptionId = localizedFieldId("short_description_i18n", lang);
  const descriptionCounterId = localizedFieldCounterId("short_description_i18n", lang);
  const titleValue = localizedFieldValue("title_i18n", lang);
  const descriptionValue = localizedFieldValue("short_description_i18n", lang);
  const descriptionCounterClass = isTourDescriptionOverWarningLength(descriptionValue)
    ? "tour-localized-content__counter micro tour-localized-content__counter--warning"
    : "tour-localized-content__counter micro";
  const showSourceCue = shouldShowTourContentSourceCue();
  const sourceCode = escapeHtml(tourLanguageShortLabel(lang));
  const sourceCueMarkup = showSourceCue
    ? `<span class="localized-pair__code tour-localized-content__source-code" aria-hidden="true">${sourceCode}</span>`
    : "";
  const fieldClass = showSourceCue
    ? "tour-localized-content__field tour-localized-content__field--source-code"
    : "tour-localized-content__field";

  els.localizedContentEditor.innerHTML = `
    <div class="tour-localized-group tour-localized-group--multiline tour-localized-group--content">
      <div class="tour-localized-group__header">
        <label class="tour-localized-group__label" for="${escapeHtml(titleId)}">${escapeHtml(backendT("tour.content_label", "Tour Title and description"))}</label>
      </div>
      <div class="tour-localized-group__row">
        <div class="tour-localized-group__field">
          <div class="tour-localized-content">
            <div class="${fieldClass}">
              ${sourceCueMarkup}
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
            <div class="${fieldClass}">
              ${sourceCueMarkup}
              <textarea
                class="tour-localized-content__description"
                id="${escapeHtml(descriptionId)}"
                data-tour-i18n-field="short_description_i18n"
                data-tour-i18n-lang="${escapeHtml(lang)}"
                data-tour-short-description-fit="1"
                maxlength="${TOUR_DESCRIPTION_MAX_LENGTH}"
                rows="3"
                spellcheck="true"
                dir="${escapeHtml(direction)}"
              >${escapeHtml(descriptionValue)}</textarea>
              <div
                class="${descriptionCounterClass}"
                id="${escapeHtml(descriptionCounterId)}"
                aria-live="polite"
              >${escapeHtml(tourDescriptionCharacterCountText(descriptionValue))}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  fitTourShortDescriptionControls(els.localizedContentEditor);
}

function readLocalizedFields(field, { multiline = false } = {}) {
  const next = normalizeLocalizedTextMap(state.localizedContent?.[field], { multiline });
  for (const language of tourTextLanguages()) {
    const lang = normalizeTourTextLang(language?.code);
    const input = getLocalizedField(field, lang);
    if (!input) continue;
    const value = String(input.value ?? "");
    let normalizedValue = multiline ? value : value.trim();
    if (field === "short_description_i18n" && lang === TOUR_SOURCE_LANG) {
      normalizedValue = truncateTourSourceDescription(normalizedValue);
      if (input.value !== normalizedValue) {
        input.value = normalizedValue;
      }
    }
    if (multiline ? normalizedValue.trim() : normalizedValue) {
      next[lang] = normalizedValue;
    } else {
      delete next[lang];
    }
  }
  return next;
}

function syncLocalizedFieldState() {
  state.localizedContent.title_i18n = readLocalizedFields("title_i18n");
  state.localizedContent.short_description_i18n = readLocalizedFields("short_description_i18n");
}

function captureLocalizedContentSnapshot() {
  return JSON.stringify({
    title_i18n: state.localizedContent?.title_i18n || {},
    short_description_i18n: state.localizedContent?.short_description_i18n || {}
  });
}

function isLocalizedSourceContentDirty() {
  return captureLocalizedContentSnapshot() !== state.originalLocalizedContentSnapshot;
}

function notifyBackendTranslationsStatus(detail = {}) {
  window.dispatchEvent(new CustomEvent("backend-translations-status-refresh", { detail }));
}

function preferredTourHeaderLangs() {
  return [TOUR_SOURCE_LANG, "vi"];
}

function updateHeaderTitle() {
  if (!els.title) return;
  const rawTitle = resolveLocalizedFieldText("title_i18n", preferredTourHeaderLangs(), state.tour?.title);
  els.title.textContent = rawTitle || (state.is_create_mode ? backendT("tour.new_title", "New tour") : backendT("nav.tours", "Tour"));
}

function updateHeaderSubtitle() {
  if (!els.subtitle) return;
  els.subtitle.innerHTML = `<em>${escapeHtml(backendT("tour.change_below", "(change below)"))}</em>`;
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

init();

function handleBackendLanguageChanged() {
  if (els.onePagerLang && els.onePagerLang.dataset.onePagerLangUserSelected !== "true") {
    delete els.onePagerLang.dataset.onePagerLangInitialized;
    renderOnePagerLanguageOptions();
  }
  syncLocalizedFieldState();
  updateHeaderTitle();
  updateHeaderSubtitle();
  renderLocalizedTourContentEditor();
  renderTourReelVideo();
  tourTravelPlanAdapter?.renderTravelPlanPanel?.({ syncFromDom: true });
  renderOnePagerImageSelector();
  renderOnePagerExperienceHighlightSelectors();
  renderTourCardImageSelector();
  renderTourDirtyBar();
}

async function init() {
  await waitForBackendI18n();
  window.addEventListener("beforeunload", (event) => {
    if (state.allowPageUnload || !updateTourDirtyState()) return;
    event.preventDefault();
    event.returnValue = "";
  });
  window.addEventListener("backend-i18n-changed", handleBackendLanguageChanged);
  refreshBackendNavElements();
  const backHref = resolveBackendSectionHref("tours");

  if (els.homeLink) els.homeLink.href = backHref;
  if (els.cancel) els.cancel.href = backHref;
  if (els.back) {
    els.back.addEventListener("click", () => {
      window.location.href = backHref;
    });
  }
  renderOnePagerLanguageOptions();
  els.onePagerBtn?.addEventListener("click", openTourOnePagerPdf);
  if (els.logoutLink) {
    const returnTo = `${window.location.origin}/`;
    wireAuthLogoutLink(els.logoutLink, { apiBase, returnTo });
  }

  await loadAuthStatus();
  syncOnePagerButtonState();
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
  await loadExperienceHighlights();
  renderMonthOptions();
  tourTravelPlanAdapter = createTourTravelPlanAdapter({
    state,
    els,
    apiOrigin,
    fetchApi,
    escapeHtml,
    onDirtyChange: () => {
      updateTourDirtyState();
    },
    onTourMutation: (tour) => {
      state.tour = tour;
      state.id = String(tour?.id || state.id || "");
      state.is_create_mode = !state.id;
      syncOnePagerButtonState();
      if (state.booking && state.booking.id === state.id) {
        state.booking.updated_at = normalizeText(tour?.updated_at) || state.booking.updated_at || null;
      }
      window.setTimeout(() => {
        renderOnePagerImageSelector();
        renderTourCardImageSelector();
        syncPublishedOnWebpageControl();
      }, 0);
      notifyBackendTranslationsStatus();
    },
    setPageOverlay: (isVisible, message = "") => setTourPageOverlay(isVisible, message)
  });
  tourTravelPlanAdapter.bind();

  if (els.form) {
    els.form.addEventListener("submit", submitForm);
    const scheduleTourDirtyState = () => window.setTimeout(updateTourDirtyState, 0);
    els.form.addEventListener("input", (event) => {
      clearError();
      setStatus("");
      const field = event.target instanceof HTMLElement ? event.target.getAttribute("data-tour-i18n-field") : "";
      if (field === "title_i18n" || field === "short_description_i18n") {
        if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) {
          enforceTourSourceDescriptionLimit(event.target);
          updateTourDescriptionCounter(event.target);
          fitTourShortDescriptionControl(event.target);
        }
        syncLocalizedFieldState();
        if (field === "title_i18n") {
          clearTitleError();
          updateHeaderTitle();
        }
        if (isLocalizedSourceContentDirty()) {
          notifyBackendTranslationsStatus({ dirty: true, refresh: false });
        } else {
          notifyBackendTranslationsStatus();
        }
      }
      scheduleTourDirtyState();
    });
    els.form.addEventListener("change", (event) => {
      clearError();
      setStatus("");
      if (event.target === els.onePagerLang) {
        els.onePagerLang.dataset.onePagerLangUserSelected = "true";
        renderOnePagerExperienceHighlightSelectors();
        return;
      }
      if (
        event.target?.matches?.("[data-destination-scope-destination]")
        || event.target?.matches?.("[data-destination-scope-area]")
        || event.target?.matches?.("[data-destination-scope-place]")
      ) {
        window.setTimeout(() => {
          syncPublishedOnWebpageControl();
          updateTourDirtyState();
        }, 0);
      }
      scheduleTourDirtyState();
    });
    els.form.addEventListener("click", (event) => {
      const onePagerHighlightOption = event.target instanceof Element
        ? event.target.closest("[data-one-pager-highlight-option]")
        : null;
      if (onePagerHighlightOption) {
        event.preventDefault();
        const detail = onePagerHighlightOption.closest("[data-one-pager-highlight-details]");
        if (detail instanceof HTMLDetailsElement) detail.open = false;
        selectOnePagerExperienceHighlight(
          onePagerHighlightOption.getAttribute("data-one-pager-highlight-index"),
          onePagerHighlightOption.getAttribute("data-one-pager-highlight-option")
        );
        return;
      }
      const onePagerHeroButton = event.target instanceof Element
        ? event.target.closest("[data-one-pager-hero-image]")
        : null;
      if (onePagerHeroButton) {
        event.preventDefault();
        selectOnePagerHeroImage(onePagerHeroButton.getAttribute("data-one-pager-hero-image"));
        return;
      }
      const onePagerImageButton = event.target instanceof Element
        ? event.target.closest("[data-one-pager-select-image]")
        : null;
      if (onePagerImageButton) {
        event.preventDefault();
        selectOnePagerBodyImage(onePagerImageButton.getAttribute("data-one-pager-select-image"));
        return;
      }
      const onePagerClearButton = event.target instanceof Element
        ? event.target.closest("#tour_one_pager_clear_images_btn")
        : null;
      if (onePagerClearButton) {
        event.preventDefault();
        clearOnePagerBodyImages();
        return;
      }
      const tourCardImageButton = event.target instanceof Element
        ? event.target.closest("[data-tour-card-select-image]")
        : null;
      if (tourCardImageButton) {
        event.preventDefault();
        selectTourCardImageForWebPage(tourCardImageButton.getAttribute("data-tour-card-select-image"));
        return;
      }
      const tourCardClearButton = event.target instanceof Element
        ? event.target.closest("[data-tour-card-clear-images]")
        : null;
      if (tourCardClearButton) {
        event.preventDefault();
        clearTourCardImagesForWebPage();
        return;
      }
    });
  }
  if (els.addReelVideoBtn && els.reelVideoUpload) {
    els.addReelVideoBtn.addEventListener("click", () => {
      els.reelVideoUpload.click();
    });
  }
  if (els.reelVideoUpload) {
    els.reelVideoUpload.addEventListener("change", () => {
      const [file] = Array.from(els.reelVideoUpload.files || []).filter((value) => value instanceof File);
      if (!file) return;
      replaceReelVideoDraftItem(createPendingReelVideoDraftItem(file));
      renderTourReelVideo();
      setStatus(backendT("tour.status.selected_video", "Selected video."));
      els.reelVideoUpload.value = "";
      updateTourDirtyState();
    });
  }
  if (els.reelVideoCard) {
    els.reelVideoCard.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("[data-tour-remove-reel-video]") : null;
      if (button && state.permissions.canEditTours) {
        event.preventDefault();
        replaceReelVideoDraftItem(null);
        renderTourReelVideo();
        updateTourDirtyState();
        return;
      }
      revealMediaFilename(event.target);
    });
  }

  if (state.is_create_mode) {
    await initializeNewTourForm();
    return;
  }

  await loadTour();
}

async function loadTour() {
  tourDirtySnapshotReady = false;
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
  state.localizedContent.short_description_i18n = normalizeTourShortDescriptionMap(
    tour.short_description_i18n,
    tour.short_description
  );
  const destinations = tour_destinations(tour);
  const styles = tour_styles(tour);
  updateHeader(tour, destinations, styles);

  setInput("tour_priority", toInputNumber(tour.priority));
  setInput("tour_seasonality_start_month", tour.seasonality_start_month || "");
  setInput("tour_seasonality_end_month", tour.seasonality_end_month || "");
  setInput("tour_seo_slug", tour.seo_slug || "");
  if (els.publishedOnWebpage) els.publishedOnWebpage.checked = tour.published_on_webpage === true;
  renderLocalizedTourContentEditor();
  syncReelVideoDraftItemFromTour(tour);
  tourTravelPlanAdapter?.applyTour(tour);
  renderOnePagerImageSelector();
  renderTourCardImageSelector();

  renderDestinationChoices(tour_destination_codes(tour));
  renderStyleChoices(tour_style_codes(tour));
  applyTourPermissions();
  markTourSnapshotClean();
  syncOnePagerButtonState();
}

async function initializeNewTourForm() {
  tourDirtySnapshotReady = false;
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
    published_on_webpage: false,
    reel_video: null,
    travel_plan: { destination_scope: [], destinations: [], days: [] }
  };

  state.localizedContent.title_i18n = {};
  state.localizedContent.short_description_i18n = {};
  updateHeader({ title: backendT("tour.new_title", "New tour") }, [], []);
  setInput("tour_priority", "50");
  setInput("tour_seasonality_start_month", "");
  setInput("tour_seasonality_end_month", "");
  setInput("tour_seo_slug", "");
  if (els.publishedOnWebpage) els.publishedOnWebpage.checked = false;
  renderLocalizedTourContentEditor();
  syncReelVideoDraftItemFromTour(state.tour);
  tourTravelPlanAdapter?.applyTour(state.tour);
  renderOnePagerImageSelector();
  renderTourCardImageSelector();
  renderDestinationChoices([]);
  renderStyleChoices([]);
  applyTourPermissions();
  clearError();
  setStatus(backendT("tour.status.new", "New tour"));
  markTourSnapshotClean();
  syncOnePagerButtonState();
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

function selectedDestinationScopeForSave(travelPlanPayload) {
  if (els.travel_plan_destination_scope_editor instanceof HTMLElement) {
    return readDestinationScopeFromDom(els.travel_plan_destination_scope_editor);
  }
  return Array.isArray(travelPlanPayload?.destination_scope) ? travelPlanPayload.destination_scope : [];
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

function syncOnePagerButtonState() {
  const unavailable = !state.permissions.canReadTours || state.is_create_mode || !normalizeText(state.id);
  const highlightsReady = hasRequiredOnePagerExperienceHighlights();
  const smallImageReady = hasSelectedOnePagerSmallImage();
  const disabled = unavailable || !highlightsReady || !smallImageReady || state.formDirty === true;
  if (els.onePagerBtn) {
    els.onePagerBtn.disabled = disabled;
    els.onePagerBtn.title = disabled
      ? onePagerButtonDisabledMessage({ highlightsReady, smallImageReady })
      : backendT("tour.one_pager_create", "Create One-Page PDF");
  }
  if (els.onePagerLang) {
    els.onePagerLang.disabled = unavailable;
  }
}

function openTourOnePagerPdf() {
  syncOnePagerButtonState();
  if (els.onePagerBtn?.disabled) {
    setStatus(onePagerButtonDisabledMessage());
    return;
  }
  if (updateTourDirtyState()) {
    setStatus(backendT("tour.status.one_pager_save_first", "Save the tour before creating a one-pager PDF."));
    return;
  }
  const url = absolutizeApiUrl(withApiLang(`/api/v1/tours/${encodeURIComponent(state.id)}/one-pager.pdf`, {
    lang: selectedOnePagerLang()
  }));
  const previewWindow = window.open(url, "_blank", "noopener");
  if (!previewWindow) {
    setStatus(backendT("tour.status.one_pager_popup_blocked", "Allow pop-ups to open the one-pager PDF."));
    return;
  }
  setStatus(backendT("tour.status.one_pager_opening", "Opening one-pager PDF."));
}

async function submitForm(event) {
  event.preventDefault();
  if (!state.permissions.canEditTours) return;
  clearError();
  clearTitleError();

  const selectedStyles = getCheckedValues("styleChoice");
  const title_i18n = readLocalizedFields("title_i18n");
  const short_description_i18n = readLocalizedFields("short_description_i18n");
  const travelPlanResult = tourTravelPlanAdapter?.collectPayload({ focusFirstInvalid: true }) || {
    ok: true,
    payload: state.tour?.travel_plan || { days: [] }
  };
  if (!travelPlanResult.ok) {
    const message = travelPlanResult.error || backendT("tour.travel_plan_invalid", "Travel plan is invalid.");
    showError(message);
    setStatus(message);
    return;
  }
  const selectedDestinationScope = selectedDestinationScopeForSave(travelPlanResult.payload);
  const selectedDestinationCountries = destinationScopeTourDestinations(selectedDestinationScope);
  const travelPlanPayload = {
    ...(travelPlanResult.payload || {}),
    destination_scope: selectedDestinationScope
  };
  const publishOnWebpage = Boolean(
    els.publishedOnWebpage?.checked
    && tourWebPagePublicationEligibility(travelPlanPayload).canPublish
  );
  if (els.publishedOnWebpage) {
    els.publishedOnWebpage.checked = publishOnWebpage;
    syncPublishedOnWebpageControl(travelPlanPayload);
  }
  const pendingReelVideo = state.reelVideoDraftItem?.kind === "pending" ? state.reelVideoDraftItem : null;
  const storedReelVideo = state.reelVideoDraftItem?.kind === "stored" ? state.reelVideoDraftItem : null;
  const hasStoredReelVideoOnServer = Boolean(state.tour?.reel_video);
  const removedStoredReelVideo = !pendingReelVideo && !storedReelVideo && hasStoredReelVideoOnServer;
  state.localizedContent.title_i18n = title_i18n;
  state.localizedContent.short_description_i18n = short_description_i18n;
  const resolvedTitle = resolveLocalizedTextMapValue(title_i18n, ["vi", "en", currentTourEditingLang()]);

  const payload = {
    title: resolvedTitle,
    title_i18n,
    styles: selectedStyles,
    priority: toNumberOrNull(getInput("tour_priority")),
    seasonality_start_month: getInput("tour_seasonality_start_month"),
    seasonality_end_month: getInput("tour_seasonality_end_month"),
    published_on_webpage: publishOnWebpage,
    seo_slug: getInput("tour_seo_slug"),
    short_description_i18n,
    travel_plan: omitDerivedTravelPlanDestinations(travelPlanPayload)
  };
  const expectedUpdatedAt = normalizeText(state.tour?.updated_at || state.booking?.updated_at);
  if (!state.is_create_mode && expectedUpdatedAt) {
    payload.expected_updated_at = expectedUpdatedAt;
  }

  const validationMessage = buildTourSaveValidationMessage({
    title: payload.title,
    destinations: selectedDestinationCountries,
    styles: payload.styles
  });
  if (validationMessage) {
    showError(validationMessage);
    setStatus(validationMessage);
    return;
  }

  let keepPageOverlayVisible = false;
  setTourPageOverlay(true, backendT("tour.status.saving_overlay", "Saving changes. Please wait."));
  try {
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
    let finalSaveStatus = homepageAssetSyncFailed(result)
      ? homepageAssetSyncWarningMessage()
      : (is_create
        ? backendT("tour.status.created", "Tour created.")
        : backendT("tour.status.updated", "Tour updated."));
    state.tour = result.tour;
    state.localizedContent.title_i18n = normalizeLocalizedTextMap(
      result.tour.title_i18n || { en: result.tour.title || "" }
    );
    state.localizedContent.short_description_i18n = normalizeTourShortDescriptionMap(
      result.tour.short_description_i18n,
      result.tour.short_description
    );
    state.id = String(result.tour.id || "");
    state.is_create_mode = false;
    updateHeader(state.tour, tour_destinations(state.tour), tour_styles(state.tour));

    if (pendingReelVideo) {
      setStatus(backendT("tour.status.uploading_video", "Uploading reel video..."));
      const base64 = await fileToBase64(pendingReelVideo.file);
      const videoResult = await fetchApi(withApiLang(`/api/v1/tours/${encodeURIComponent(state.id)}/video`), {
        method: "POST",
        body: {
          filename: pendingReelVideo.file.name,
          data_base64: base64
        }
      });
      if (!videoResult) return;
      if (homepageAssetSyncFailed(videoResult)) {
        finalSaveStatus = homepageAssetSyncWarningMessage();
      }
      if (videoResult.tour) {
        state.tour = videoResult.tour;
      }
    } else if (!is_create && removedStoredReelVideo) {
      setStatus(backendT("tour.status.removing_video", "Removing reel video..."));
      const videoDeleteResult = await fetchApi(withApiLang(`/api/v1/tours/${encodeURIComponent(state.id)}/video`), {
        method: "DELETE"
      });
      if (!videoDeleteResult) return;
      if (homepageAssetSyncFailed(videoDeleteResult)) {
        finalSaveStatus = homepageAssetSyncWarningMessage();
      }
      if (videoDeleteResult.tour) {
        state.tour = videoDeleteResult.tour;
      }
    }

    setStatus(finalSaveStatus);
    if (is_create) {
      state.allowPageUnload = true;
      keepPageOverlayVisible = true;
      window.location.href = withBackendLang("/marketing_tour.html", { id: state.id });
      return;
    }
    await loadTour();
    notifyBackendTranslationsStatus();
  } finally {
    if (!keepPageOverlayVisible) {
      setTourPageOverlay(false);
    }
  }
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
  onError: (message, payload, response) => {
    const staleTourUpdate = response?.status === 409 && payload?.code === "TOUR_REVISION_MISMATCH";
    const visibleMessage = staleTourUpdate ? staleTourUpdateMessage() : message;
    showError(visibleMessage);
    if (staleTourUpdate) setStatus(visibleMessage);
  },
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
    state.permissions.canEditBooking = state.permissions.canEditTours;
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
  if (els.addReelVideoBtn) els.addReelVideoBtn.disabled = true;
  if (els.reelVideoUpload) els.reelVideoUpload.disabled = true;
  if (els.form) {
    els.form.querySelectorAll("input, textarea, select, button").forEach((el) => {
      if (el.id === "tour_cancel_btn") return;
      if (el.id === "tour_one_pager_btn" || el.id === "tour_one_pager_lang") return;
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

function homepageAssetSyncFailed(payload) {
  return payload?.homepage_assets?.ok === false;
}

function homepageAssetSyncWarningMessage() {
  return backendT(
    "tour.status.public_sync_failed",
    "Saved in backend, but refreshing the public homepage failed. Please retry or run the homepage asset generator."
  );
}

function setTourPageOverlay(isVisible, message = "") {
  if (els.pageOverlayText) {
    els.pageOverlayText.textContent = String(message || "Please wait.").trim();
  }
  if (els.pageBody instanceof HTMLElement) {
    els.pageBody.classList.toggle("tour-detail-page--busy", Boolean(isVisible));
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

function updateHeader(tour, destinations, styles) {
  updateHeaderTitle();
  updateHeaderSubtitle();
}

function tour_destinations(tour) {
  const scoped = destinationScopeTourDestinations(tour?.travel_plan?.destination_scope);
  if (scoped.length) return scoped;
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
