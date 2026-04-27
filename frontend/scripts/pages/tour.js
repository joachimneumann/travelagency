import {
  authMeRequest,
  tourCreateRequest,
  tourDetailRequest,
  tourPictureDeleteRequest,
  tourPictureUploadRequest,
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
import { initializeBookingSection, setBookingSectionOpen } from "../booking/sections.js";
import { createTourTravelPlanAdapter } from "./tour_travel_plan_adapter.js";
import {
  destinationScopeTourDestinations,
  readDestinationScopeFromDom
} from "../shared/destination_scope_editor.js";
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
  travelPlanTranslationIncomplete: false,
  originalTravelPlanSnapshot: "",
  originalTravelPlanState: null,
  pictureDraftItems: [],
  reelVideoDraftItem: null,
  activeTravelPlanTranslationLang: "",
  options: {
    destinations: [],
    styles: []
  },
  localizedContent: {
    title_i18n: {},
    short_description_i18n: {}
  }
};

const TOUR_BULK_TRANSLATION_CONCURRENCY = 4;

const TOUR_TRANSLATION_SOURCE_LANG = "en";
const TOUR_DESCRIPTION_MAX_LENGTH = 170;
const TRAVEL_PLAN_TRANSLATION_INCOMPLETE_STATUSES = new Set(["missing", "partial", "stale"]);
const TRAVEL_PLAN_TRANSLATION_REQUEST_BATCH_SIZE = 12;
const TOUR_TRANSLATION_PROVIDER_DISPLAY = "google";

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
  destinationHidden: document.getElementById("tour_destinations"),
  destinationChoices: document.getElementById("tour_destination_choices"),
  stylesHidden: document.getElementById("tour_styles"),
  styleChoices: document.getElementById("tour_style_choices"),
  travel_plan_destination_scope_editor: document.getElementById("tour_destination_scope_editor"),
  seasonalityStartMonth: document.getElementById("tour_seasonality_start_month"),
  seasonalityEndMonth: document.getElementById("tour_seasonality_end_month"),
  localizedContentEditor: document.getElementById("tour_localized_content_editor"),
  pictureList: document.getElementById("tour_picture_list"),
  addPictureBtn: document.getElementById("tour_add_picture_btn"),
  pictureUpload: document.getElementById("tour_picture_upload"),
  reelVideoCard: document.getElementById("tour_reel_video_card"),
  addReelVideoBtn: document.getElementById("tour_add_reel_btn"),
  reelVideoUpload: document.getElementById("tour_reel_upload"),
  travel_plan_panel: document.getElementById("travel_plan_panel"),
  travel_plan_panel_summary: document.getElementById("travel_plan_panel_summary"),
  travel_plan_editor: document.getElementById("travel_plan_editor"),
  travel_plan_status: document.getElementById("travel_plan_status"),
  travelPlanTranslationSection: document.getElementById("tour_travel_plan_translation_section"),
  travelPlanTranslationSummary: document.getElementById("tour_travel_plan_translation_summary"),
  travelPlanTranslationPanel: document.getElementById("tour_travel_plan_translation_panel"),
  travelPlanServiceImageInput: document.getElementById("travel_plan_service_image_input"),
  travelPlanImagePreviewModal: document.getElementById("travel_plan_image_preview_modal"),
  travelPlanImagePreviewCloseBtn: document.getElementById("travel_plan_image_preview_close_btn"),
  travelPlanImagePreviewImage: document.getElementById("travel_plan_image_preview_image"),
  pageOverlay: document.getElementById("tour_translate_overlay"),
  pageOverlayText: document.getElementById("tour_translate_overlay_text")
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
  snapshot.push([
    "tour_pictures",
    state.pictureDraftItems.map((item) => {
      if (item.kind === "stored") return `stored:${item.picture}`;
      const file = item.file;
      return `pending:${file?.name || ""}:${file?.size || 0}:${file?.lastModified || 0}`;
    })
  ]);
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

const tourDirtyTracker = createSnapshotDirtyTracker({
  captureSnapshot: () => captureTourFormSnapshot(),
  isEnabled: () => state.permissions.canEditTours,
  onDirtyChange: (isDirty) => {
    state.formDirty = Boolean(isDirty);
    renderTourDirtyBar();
  }
});

function renderTourDirtyBar() {
  const isDirty = state.formDirty === true;
  const translationIncomplete = state.travelPlanTranslationIncomplete === true;
  els.dirtyBar?.classList.toggle("booking-dirty-bar--dirty", isDirty);
  if (els.dirtyBarTitle) {
    els.dirtyBarTitle.textContent = isDirty
      ? backendT("booking.page_save.unsaved", "Unsaved edits")
      : backendT("booking.page_save.clean", "No unsaved edits");
  }
  if (els.dirtyBarSummary) {
    els.dirtyBarSummary.textContent = "";
    if (translationIncomplete) {
      const pill = document.createElement("span");
      pill.className = "booking-dirty-bar__notice-pill";
      pill.textContent = backendT("tour.travel_plan_translation.section_title_incomplete", "Translation: incomplete");
      els.dirtyBarSummary.append(pill);
    }
  }
}

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

function truncateTourSourceDescription(value) {
  return String(value ?? "").slice(0, TOUR_DESCRIPTION_MAX_LENGTH);
}

function normalizeTourShortDescriptionMap(value, fallbackValue = "") {
  const normalized = normalizeLocalizedTextMap(value);
  const fallback = normalizeText(fallbackValue);
  if (!normalized[TOUR_TRANSLATION_SOURCE_LANG] && fallback) {
    normalized[TOUR_TRANSLATION_SOURCE_LANG] = fallback;
  }
  if (normalized[TOUR_TRANSLATION_SOURCE_LANG]) {
    normalized[TOUR_TRANSLATION_SOURCE_LANG] = truncateTourSourceDescription(normalized[TOUR_TRANSLATION_SOURCE_LANG]);
  }
  return normalized;
}

function enforceTourSourceDescriptionLimit(control) {
  if (!control || control.getAttribute("data-tour-i18n-field") !== "short_description_i18n") return;
  const lang = normalizeTourTextLang(control.getAttribute("data-tour-i18n-lang"));
  if (lang !== TOUR_TRANSLATION_SOURCE_LANG) return;
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

function normalizeTourPictures(tour) {
  if (Array.isArray(tour?.pictures) && tour.pictures.length) {
    return tour.pictures.map(stripTourPictureVersion).filter(Boolean);
  }
  return [];
}

function stripTourPictureVersion(value) {
  return String(value || "").trim().replace(/[?#].*$/, "");
}

function pictureNameFromValue(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const withoutQuery = normalized.split("?")[0].replace(/\/+$/, "");
  try {
    return decodeURIComponent(withoutQuery.split("/").pop() || "");
  } catch {
    return withoutQuery.split("/").pop() || "";
  }
}

function createStoredPictureDraftItem(picture, index = 0) {
  const rawPicture = String(picture || "").trim();
  const normalizedPicture = stripTourPictureVersion(rawPicture);
  return {
    key: `stored:${normalizedPicture}:${index}`,
    kind: "stored",
    picture: normalizedPicture,
    name: pictureNameFromValue(normalizedPicture) || `picture-${index + 1}`,
    previewUrl: rawPicture && rawPicture !== normalizedPicture ? rawPicture : ""
  };
}

function createPendingPictureDraftItem(file) {
  const previewUrl = URL.createObjectURL(file);
  return {
    key: `pending:${file.name}:${file.size}:${file.lastModified}:${Math.random().toString(36).slice(2, 10)}`,
    kind: "pending",
    file,
    name: file.name,
    previewUrl
  };
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

function revokePictureDraftItem(item) {
  if (item?.kind === "pending" && item.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

function revokeReelVideoDraftItem(item) {
  if (item?.kind === "pending" && item.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

function replacePictureDraftItems(items) {
  state.pictureDraftItems.forEach((item) => revokePictureDraftItem(item));
  state.pictureDraftItems = items;
}

function replaceReelVideoDraftItem(item) {
  revokeReelVideoDraftItem(state.reelVideoDraftItem);
  state.reelVideoDraftItem = item || null;
}

function syncPictureDraftItemsFromTour(tour) {
  replacePictureDraftItems(normalizeTourPictures(tour).map((picture, index) => createStoredPictureDraftItem(picture, index)));
  renderTourPictures();
}

function syncReelVideoDraftItemFromTour(tour) {
  const reelVideo = tour?.reel_video && typeof tour.reel_video === "object" ? tour.reel_video : null;
  replaceReelVideoDraftItem(reelVideo ? createStoredReelVideoDraftItem(reelVideo) : null);
  renderTourReelVideo();
}

function picturePreviewSrc(item) {
  if (item?.kind === "pending") return item.previewUrl;
  return absolutizeApiUrl(item?.picture || "");
}

function reelVideoPreviewSrc(item) {
  if (item?.kind === "pending") return item.previewUrl;
  return absolutizeApiUrl(item?.previewUrl || "");
}

function renderTourPictures() {
  if (!els.pictureList) return;
  if (!state.pictureDraftItems.length) {
    els.pictureList.innerHTML = `<div class="tour-picture-empty micro">${escapeHtml(
      backendT("tour.picture_empty", "No pictures added yet.")
    )}</div>`;
    return;
  }

  els.pictureList.innerHTML = state.pictureDraftItems
    .map((item) => {
      const removeDisabled = !state.permissions.canEditTours ? "disabled" : "";
      const fileName = item.name || backendT("tour.picture_label", "Tour picture");
      return `
        <div class="tour-picture-card">
          <div class="tour-picture-card__media">
            <div class="tour-picture-card__frame">
              <img class="tour-picture-card__image" src="${escapeHtml(picturePreviewSrc(item))}" alt="" loading="lazy" data-tour-media-filename-trigger="true" />
            </div>
            <span class="tour-picture-card__filename micro" hidden>${escapeHtml(fileName)}</span>
          </div>
          <button class="btn btn-ghost tour-picture-card__remove" type="button" data-tour-remove-picture="${escapeHtml(item.key)}" ${removeDisabled}>
            ${escapeHtml(backendT("tour.remove_picture", "Remove picture"))}
          </button>
        </div>
      `;
    })
    .join("");
}

function revealMediaFilename(target) {
  if (!(target instanceof Element)) return false;
  const trigger = target.closest("[data-tour-media-filename-trigger]");
  if (!trigger) return false;
  const media = trigger.closest(".tour-picture-card__media, .tour-reel-card__media");
  const filename = media?.querySelector(".tour-picture-card__filename, .tour-reel-card__filename");
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
    els.reelVideoCard.innerHTML = `<div class="tour-reel-empty micro">No reel video uploaded yet.</div>`;
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

function buildTourTranslationEntries(sourceValues) {
  return Object.fromEntries(
    Object.entries(sourceValues || {})
      .map(([key, value]) => [String(key || "").trim(), String(value || "").trim()])
      .filter(([key, value]) => Boolean(key && value))
  );
}

async function requestTourTranslation(targetLang, sourceValues, options = {}) {
  const entries = buildTourTranslationEntries(sourceValues);
  if (!Object.keys(entries).length) return null;
  const sourceLang = normalizeTourTextLang(options?.sourceLang || currentTourEditingLang());
  const translationProfile = normalizeText(options?.translationProfile || "marketing_trip_copy") || "marketing_trip_copy";

  const request = tourTranslateFieldsRequest({
    baseURL: apiOrigin,
    body: {
      source_lang: sourceLang,
      target_lang: targetLang,
      translation_profile: translationProfile,
      entries: Object.entries(entries).map(([key, value]) => ({ key, value }))
    }
  });
  const result = await fetchApi(withApiLang(request.url), {
    method: request.method,
    body: request.body,
    includeResponseMeta: true
  });
  const payload = result?.payload || null;
  const translatedEntries = Array.isArray(payload?.entries)
    ? Object.fromEntries(
        payload.entries
          .map((entry) => [String(entry?.key || "").trim(), String(entry?.value || "").trim()])
          .filter(([key, value]) => Boolean(key && value))
      )
    : null;
  return {
    entries: translatedEntries,
    translationProvider: result?.responseMeta?.translationProvider || null
  };
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
  const lang = TOUR_TRANSLATION_SOURCE_LANG;
  const language = tourLanguageMeta(lang);
  const direction = String(language?.direction || "ltr");
  const titleId = localizedFieldId("title_i18n", lang);
  const descriptionId = localizedFieldId("short_description_i18n", lang);
  const titleValue = localizedFieldValue("title_i18n", lang);
  const descriptionValue = localizedFieldValue("short_description_i18n", lang);
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
                maxlength="${TOUR_DESCRIPTION_MAX_LENGTH}"
                rows="3"
                spellcheck="true"
                dir="${escapeHtml(direction)}"
              >${escapeHtml(descriptionValue)}</textarea>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function readLocalizedFields(field, { multiline = false } = {}) {
  const next = normalizeLocalizedTextMap(state.localizedContent?.[field], { multiline });
  for (const language of tourTextLanguages()) {
    const lang = normalizeTourTextLang(language?.code);
    const input = getLocalizedField(field, lang);
    if (!input) continue;
    const value = String(input.value ?? "");
    let normalizedValue = multiline ? value : value.trim();
    if (field === "short_description_i18n" && lang === TOUR_TRANSLATION_SOURCE_LANG) {
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

function preferredTourHeaderLangs() {
  const selectedLang = normalizeTourTextLang(currentBackendLang());
  return selectedLang === "vi" ? ["vi", "en"] : ["en", "vi"];
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
  const translationResult = await requestTourTranslation(targetLang, sourceEntries);
  const translatedEntries = translationResult?.entries || null;
  if (!translatedEntries) return;
  applyTranslatedTourFields(targetLang, translatedEntries);
  syncLocalizedFieldState();
  updateHeaderTitle();

  updateTourDirtyState();
  setStatus(backendT("tour.translation.done", "Translation updated."));
}

function logTourTranslationBatchProgress(message, details = {}) {
  const payload = Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined)
  );
  if (Object.keys(payload).length) {
    console.log(`[tour-translation] ${message}`, payload);
    return;
  }
  console.log(`[tour-translation] ${message}`);
}

async function runBatchedParallel(items, batchSize, worker) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const normalizedBatchSize = Math.max(1, Number(batchSize) || 1);
  for (let start = 0; start < normalizedItems.length; start += normalizedBatchSize) {
    const batch = normalizedItems.slice(start, start + normalizedBatchSize);
    await Promise.all(batch.map((item, index) => worker(item, start + index)));
  }
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
  logTourTranslationBatchProgress("Starting bulk translation", {
    source_lang: sourceLang,
    source_label: tourLanguageLabel(sourceLang),
    total_targets: targets.length,
    targets,
    concurrency: TOUR_BULK_TRANSLATION_CONCURRENCY
  });
  try {
    let completed = 0;
    await runBatchedParallel(targets, TOUR_BULK_TRANSLATION_CONCURRENCY, async (targetLang, index) => {
      logTourTranslationBatchProgress("Translating language", {
        step: `${index + 1}/${targets.length}`,
        source_lang: sourceLang,
        target_lang: targetLang,
        target_label: tourLanguageLabel(targetLang)
      });
      const translationResult = await requestTourTranslation(targetLang, sourceEntries);
      const translatedEntries = translationResult?.entries || null;
      if (!translatedEntries) return;
      applyTranslatedTourFields(targetLang, translatedEntries);
      syncLocalizedFieldState();
      updateTourDirtyState();
      completed += 1;
      setStatus(backendT("tour.translation.translating_all_progress", "Translated {completed} of {total} languages from {sourceLanguage}...", {
        completed,
        total: targets.length,
        sourceLanguage: tourLanguageLabel(sourceLang)
      }));
      logTourTranslationBatchProgress("Finished language", {
        step: `${index + 1}/${targets.length}`,
        source_lang: sourceLang,
        target_lang: targetLang,
        target_label: tourLanguageLabel(targetLang)
      });
    });
  } catch (error) {
    logTourTranslationBatchProgress("Bulk translation failed", {
      source_lang: sourceLang,
      error: String(error?.message || error || "Unknown error")
    });
    throw error;
  } finally {
    setTourPageOverlay(false);
    logTourTranslationBatchProgress("Bulk translation finished", {
      source_lang: sourceLang
    });
  }

  updateHeaderTitle();
  updateTourDirtyState();
  setStatus(backendT("tour.translation.all_done", "All translations updated."));
}

const TRAVEL_PLAN_SOURCE_LANG = TOUR_TRANSLATION_SOURCE_LANG;

function uniqueLanguageCodes(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => normalizeTourTextLang(value)).filter(Boolean)));
}

function travelPlanTranslationLanguages() {
  return uniqueLanguageCodes([TRAVEL_PLAN_SOURCE_LANG, ...tourTextLanguages().map((language) => language?.code)]);
}

function travelPlanTranslationTargetLanguages() {
  return travelPlanTranslationLanguages().filter((lang) => lang !== TRAVEL_PLAN_SOURCE_LANG);
}

function partitionItems(items, batchSize) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const normalizedBatchSize = Math.max(1, Number(batchSize) || 1);
  const batches = [];
  for (let start = 0; start < normalizedItems.length; start += normalizedBatchSize) {
    batches.push(normalizedItems.slice(start, start + normalizedBatchSize));
  }
  return batches;
}

function waitForMs(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

async function waitForMinimumElapsed(startedAt, minimumMs) {
  const remainingMs = Math.max(0, (Number(minimumMs) || 0) - (Date.now() - startedAt));
  if (remainingMs > 0) await waitForMs(remainingMs);
}

function travelPlanTranslationOverlayMessage(targetLang, translator = "") {
  if (!normalizeText(targetLang)) {
    return backendT("tour.travel_plan_translation.translating_overlay", "Translating website content and travel plan. Please wait.");
  }
  return backendT(
    "tour.travel_plan_translation.translating_current_overlay",
    "Translating {language} using {translator}. Please wait.",
    {
      language: tourLanguageLabel(targetLang),
      translator: normalizeText(translator) || TOUR_TRANSLATION_PROVIDER_DISPLAY
    }
  );
}

function travelPlanSourceHash(fields, { excludedKeys = [] } = {}) {
  const excluded = new Set((Array.isArray(excludedKeys) ? excludedKeys : []).map((entry) => normalizeText(entry)).filter(Boolean));
  const source = JSON.stringify(
    (Array.isArray(fields) ? fields : [])
      .filter((field) => !excluded.has(field.key))
      .map((field) => [field.key, field.sourceText])
  );
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function fieldTranslationMap(holder, mapField) {
  return normalizeLocalizedTextMap(holder?.[mapField]);
}

function setFieldTranslation(holder, {
  mapField,
  plainField,
  sourceText,
  targetLang,
  targetText
}) {
  if (!holder || targetLang === TRAVEL_PLAN_SOURCE_LANG) return;
  const nextMap = fieldTranslationMap(holder, mapField);
  const normalizedSource = normalizeText(sourceText || (plainField ? holder?.[plainField] : "") || nextMap[TRAVEL_PLAN_SOURCE_LANG]);
  const normalizedTarget = normalizeText(targetText);
  if (normalizedSource) nextMap[TRAVEL_PLAN_SOURCE_LANG] = normalizedSource;
  else delete nextMap[TRAVEL_PLAN_SOURCE_LANG];
  if (normalizedTarget) nextMap[targetLang] = normalizedTarget;
  else delete nextMap[targetLang];
  if (plainField) holder[plainField] = normalizedSource;
  holder[mapField] = nextMap;
}

function collectTravelPlanTranslationFields(plan, targetLang = "") {
  const fields = [];
  const days = Array.isArray(plan?.days) ? plan.days : [];
  const normalizedTargetLang = normalizeTourTextLang(targetLang);

  function addField({ holder, mapField, plainField, key, label }) {
    if (!holder || !key) return;
    const map = fieldTranslationMap(holder, mapField);
    const sourceText = normalizeText(plainField ? holder?.[plainField] : "") || normalizeText(map[TRAVEL_PLAN_SOURCE_LANG]);
    if (!sourceText) return;
    fields.push({
      key,
      label,
      holder,
      mapField,
      plainField,
      sourceText,
      targetText: normalizedTargetLang ? String(map[normalizedTargetLang] || "") : ""
    });
  }

  addField({
    holder: state.localizedContent,
    mapField: "title_i18n",
    plainField: "",
    key: "website.title",
    label: backendT("tour.content_title_label", "Website title")
  });
  addField({
    holder: state.localizedContent,
    mapField: "short_description_i18n",
    plainField: "",
    key: "website.short_description",
    label: backendT("tour.content_description_label", "Website description")
  });

  days.forEach((day, dayIndex) => {
    const dayId = normalizeText(day?.id) || `day_${dayIndex + 1}`;
    const dayLabel = backendT("booking.travel_plan.day_heading", "Day {day}", { day: String(dayIndex + 1) });
    addField({
      holder: day,
      mapField: "title_i18n",
      plainField: "title",
      key: `travel_plan.${dayId}.title`,
      label: `${dayLabel} · ${backendT("booking.travel_plan.day_title", "Day Title")}`
    });
    addField({
      holder: day,
      mapField: "overnight_location_i18n",
      plainField: "overnight_location",
      key: `travel_plan.${dayId}.overnight_location`,
      label: `${dayLabel} · ${backendT("booking.travel_plan.location_optional", "Location (optional)")}`
    });
    addField({
      holder: day,
      mapField: "notes_i18n",
      plainField: "notes",
      key: `travel_plan.${dayId}.notes`,
      label: `${dayLabel} · ${backendT("booking.travel_plan.day_notes", "Day Details")}`
    });

    const services = Array.isArray(day?.services) ? day.services : [];
    services.forEach((service, serviceIndex) => {
      const serviceId = normalizeText(service?.id) || `service_${dayIndex + 1}_${serviceIndex + 1}`;
      const serviceLabel = `${dayLabel} · ${backendT("booking.travel_plan.service_label", "Service")} ${serviceIndex + 1}`;
      if (normalizeText(service?.timing_kind || "label") === "label") {
        addField({
          holder: service,
          mapField: "time_label_i18n",
          plainField: "time_label",
          key: `travel_plan.${dayId}.${serviceId}.time_label`,
          label: `${serviceLabel} · ${backendT("booking.travel_plan.time_label", "Time label")}`
        });
      }
      addField({
        holder: service,
        mapField: "title_i18n",
        plainField: "title",
        key: `travel_plan.${dayId}.${serviceId}.title`,
        label: `${serviceLabel} · ${backendT("booking.travel_plan.service_title", "Title")}`
      });
      addField({
        holder: service,
        mapField: "location_i18n",
        plainField: "location",
        key: `travel_plan.${dayId}.${serviceId}.location`,
        label: `${serviceLabel} · ${backendT("booking.travel_plan.location_optional", "Location (optional)")}`
      });
      addField({
        holder: service,
        mapField: "image_subtitle_i18n",
        plainField: "image_subtitle",
        key: `travel_plan.${dayId}.${serviceId}.image_subtitle`,
        label: `${serviceLabel} · ${backendT("booking.travel_plan.image_subtitle_optional", "Image subtitle (optional)")}`
      });
      addField({
        holder: service?.image,
        mapField: "caption_i18n",
        plainField: "caption",
        key: `travel_plan.${dayId}.${serviceId}.image.caption`,
        label: `${serviceLabel} · ${backendT("booking.travel_plan.image_caption", "Image caption")}`
      });
      addField({
        holder: service?.image,
        mapField: "alt_text_i18n",
        plainField: "alt_text",
        key: `travel_plan.${dayId}.${serviceId}.image.alt_text`,
        label: `${serviceLabel} · ${backendT("booking.travel_plan.image_alt_text", "Image alt text")}`
      });
    });
  });

  return fields;
}

function currentTravelPlanForTranslation({ syncFromEditor = false } = {}) {
  if (syncFromEditor) {
    syncLocalizedFieldState();
  }
  if (syncFromEditor && tourTravelPlanAdapter?.collectPayload) {
    const result = tourTravelPlanAdapter.collectPayload({ focusFirstInvalid: true });
    if (!result.ok) {
      setStatus(result.error || backendT("tour.travel_plan_invalid", "Travel plan is invalid."));
      return null;
    }
    state.travelPlanDraft = result.payload;
    if (state.booking) state.booking.travel_plan = result.payload;
    if (state.tour) state.tour.travel_plan = result.payload;
  }
  return state.travelPlanDraft || state.booking?.travel_plan || state.tour?.travel_plan || { days: [] };
}

function travelPlanManualTranslationKeys(plan, targetLang) {
  return Array.from(
    new Set(
      (Array.isArray(plan?.translation_meta?.[targetLang]?.manual_keys) ? plan.translation_meta[targetLang].manual_keys : [])
        .map((entry) => normalizeText(entry))
        .filter(Boolean)
    )
  );
}

function touchTravelPlanTranslationMeta(plan, targetLang, origin = "machine", options = {}) {
  if (!plan || targetLang === TRAVEL_PLAN_SOURCE_LANG) return;
  const fields = collectTravelPlanTranslationFields(plan, targetLang);
  if (!fields.length) return;
  const meta = plan.translation_meta && typeof plan.translation_meta === "object" && !Array.isArray(plan.translation_meta)
    ? { ...plan.translation_meta }
    : {};
  const manualKeys = Object.prototype.hasOwnProperty.call(options, "manualKeys")
    ? Array.from(new Set((Array.isArray(options.manualKeys) ? options.manualKeys : []).map((entry) => normalizeText(entry)).filter(Boolean)))
    : travelPlanManualTranslationKeys(plan, targetLang);
  meta[targetLang] = {
    source_lang: TRAVEL_PLAN_SOURCE_LANG,
    source_hash: travelPlanSourceHash(fields, { excludedKeys: manualKeys }),
    origin: manualKeys.length || origin === "manual" ? "manual" : "machine",
    updated_at: new Date().toISOString(),
    ...(manualKeys.length ? { manual_keys: manualKeys } : {})
  };
  plan.translation_meta = meta;
}

function travelPlanTranslationStatus(plan, targetLang) {
  const fields = collectTravelPlanTranslationFields(plan, targetLang);
  const totalFields = fields.length;
  const translatedFields = fields.reduce((count, field) => count + (normalizeText(field.targetText) ? 1 : 0), 0);
  const missingFields = Math.max(0, totalFields - translatedFields);
  const meta = plan?.translation_meta?.[targetLang] && typeof plan.translation_meta[targetLang] === "object"
    ? plan.translation_meta[targetLang]
    : null;
  const sourceHash = travelPlanSourceHash(fields, {
    excludedKeys: travelPlanManualTranslationKeys(plan, targetLang)
  });
  const stale = Boolean(meta?.source_hash) && meta.source_hash !== sourceHash;
  let status = "missing";
  if (targetLang === TRAVEL_PLAN_SOURCE_LANG) status = "source";
  else if (!totalFields) status = "empty";
  else if (!translatedFields) status = "missing";
  else if (stale) status = "stale";
  else if (missingFields > 0) status = "partial";
  else if (meta?.origin === "machine") status = "machine";
  else status = "current";
  return {
    status,
    totalFields,
    translatedFields,
    missingFields,
    stale
  };
}

function travelPlanTranslationStatusLabel(status) {
  switch (status) {
    case "source":
      return backendT("tour.travel_plan_translation.status.source", "English source");
    case "empty":
      return backendT("tour.travel_plan_translation.status.empty", "No source text");
    case "partial":
      return backendT("tour.travel_plan_translation.status.partial", "Partial");
    case "stale":
      return backendT("tour.travel_plan_translation.status.stale", "Outdated");
    case "machine":
      return backendT("tour.travel_plan_translation.status.machine", "Machine translated");
    case "current":
      return backendT("tour.travel_plan_translation.status.current", "Reviewed");
    default:
      return backendT("tour.travel_plan_translation.status.missing", "Missing");
  }
}

function isTravelPlanTranslationIncompleteStatus(status) {
  return TRAVEL_PLAN_TRANSLATION_INCOMPLETE_STATUSES.has(String(status || ""));
}

function setTravelPlanTranslationSummaryState(isIncomplete) {
  state.travelPlanTranslationIncomplete = Boolean(isIncomplete);
  renderTourDirtyBar();
  if (!(els.travelPlanTranslationSummary instanceof HTMLElement)) return;
  const title = els.travelPlanTranslationSummary.querySelector("[data-translation-summary-title]");
  const labelKey = isIncomplete
    ? "tour.travel_plan_translation.section_title_incomplete"
    : "tour.travel_plan_translation.section_title";
  const fallback = isIncomplete ? "Translation: incomplete" : "Translations";
  els.travelPlanTranslationSummary.classList.toggle("booking-section__summary--translation-incomplete", isIncomplete);
  els.travelPlanTranslationSummary.classList.toggle("backend-section__summary--translation-incomplete", isIncomplete);
  if (title instanceof HTMLElement) {
    title.dataset.i18nId = labelKey;
    title.textContent = backendT(labelKey, fallback);
  }
}

function renderTravelPlanTranslationReview(plan, targetLang) {
  const fields = collectTravelPlanTranslationFields(plan, targetLang);
  if (!fields.length) {
    return `<div class="tour-reel-empty micro">${escapeHtml(backendT("tour.travel_plan_translation.no_source", "Add English website or travel-plan text before translating."))}</div>`;
  }
  return `
    <div class="tour-travel-plan-translation__review">
      ${fields.map((field) => `
        <div class="tour-travel-plan-translation__review-row">
          <div class="micro">${escapeHtml(field.label)}</div>
          <div class="tour-travel-plan-translation__source">${escapeHtml(field.sourceText)}</div>
          <textarea
            class="booking-text-field tour-travel-plan-translation__target"
            rows="2"
            data-tour-travel-plan-translation-key="${escapeHtml(field.key)}"
            data-tour-travel-plan-translation-lang="${escapeHtml(targetLang)}"
            ${state.permissions.canEditTours ? "" : "disabled"}
          >${escapeHtml(field.targetText)}</textarea>
        </div>
      `).join("")}
    </div>
  `;
}

function renderTravelPlanTranslationPanel() {
  if (!els.travelPlanTranslationPanel) return;
  const plan = currentTravelPlanForTranslation();
  const targets = travelPlanTranslationTargetLanguages();
  const sourceFields = collectTravelPlanTranslationFields(plan, TRAVEL_PLAN_SOURCE_LANG);
  const canTranslate = state.permissions.canEditTours && sourceFields.length > 0 && targets.length > 0;
  const summaries = targets.map((lang) => ({
    lang,
    summary: travelPlanTranslationStatus(plan, lang)
  }));
  setTravelPlanTranslationSummaryState(
    summaries.some(({ summary }) => isTravelPlanTranslationIncompleteStatus(summary.status))
  );
  const rows = summaries.map(({ lang, summary }) => {
    const isReviewOpen = state.activeTravelPlanTranslationLang === lang;
    const progress = backendT("tour.travel_plan_translation.progress", "{translated}/{total} fields", {
      translated: String(summary.translatedFields),
      total: String(summary.totalFields)
    });
    return `
      <div class="tour-travel-plan-translation__row">
        <div>
          <strong>${escapeHtml(tourLanguageLabel(lang))}</strong>
          <div class="micro">${escapeHtml(tourLanguageShortLabel(lang))}</div>
        </div>
        <span class="micro tour-travel-plan-translation__status">${escapeHtml(travelPlanTranslationStatusLabel(summary.status))}</span>
        <span class="micro">${escapeHtml(progress)}</span>
        <div class="tour-travel-plan-translation__actions">
          <button class="btn btn-ghost" type="button" data-tour-travel-plan-translate-lang="${escapeHtml(lang)}" ${canTranslate ? "" : "disabled"}>
            ${escapeHtml(summary.status === "missing" ? backendT("tour.travel_plan_translation.translate", "Translate") : backendT("tour.travel_plan_translation.update", "Update"))}
          </button>
          <button class="btn btn-ghost" type="button" data-tour-travel-plan-review-lang="${escapeHtml(lang)}" ${summary.totalFields ? "" : "disabled"}>
            ${escapeHtml(isReviewOpen ? backendT("tour.travel_plan_translation.hide_review", "Hide") : backendT("tour.travel_plan_translation.review", "Review"))}
          </button>
        </div>
        ${isReviewOpen ? renderTravelPlanTranslationReview(plan, lang) : ""}
      </div>
    `;
  }).join("");

  els.travelPlanTranslationPanel.innerHTML = `
    <div class="tour-travel-plan-translation__header">
      <div class="tour-travel-plan-translation__copy">
        <strong>${escapeHtml(backendT("tour.travel_plan_translation.title", "Translate the English website content and travel plan"))}</strong>
      </div>
      <div class="tour-travel-plan-translation__actions">
        <button class="btn btn-primary" type="button" data-tour-travel-plan-translate-missing ${canTranslate ? "" : "disabled"}>
          ${escapeHtml(backendT("tour.travel_plan_translation.translate_missing", "Translate"))}
        </button>
        <button class="btn btn-ghost" type="button" data-tour-travel-plan-translate-all ${canTranslate ? "" : "disabled"}>
          ${escapeHtml(backendT("tour.travel_plan_translation.translate_all", "Delete all translations and translate"))}
        </button>
      </div>
    </div>
    <div class="tour-travel-plan-translation__list">${rows || `<div class="tour-reel-empty micro">${escapeHtml(backendT("tour.travel_plan_translation.no_languages", "No customer languages configured."))}</div>`}</div>
  `;
}

function applyTravelPlanTranslationEntries(plan, targetLang, translatedEntries, origin = "machine") {
  const fields = collectTravelPlanTranslationFields(plan, targetLang);
  const manualKeys = origin === "machine" ? new Set(travelPlanManualTranslationKeys(plan, targetLang)) : new Set();
  for (const field of fields) {
    if (manualKeys.has(field.key)) continue;
    if (!Object.prototype.hasOwnProperty.call(translatedEntries || {}, field.key)) continue;
    setFieldTranslation(field.holder, {
      mapField: field.mapField,
      plainField: field.plainField,
      sourceText: field.sourceText,
      targetLang,
      targetText: translatedEntries[field.key]
    });
  }
  touchTravelPlanTranslationMeta(plan, targetLang, origin, { manualKeys: Array.from(manualKeys) });
}

function updateTravelPlanTranslationField(targetLang, key, value, { rerender = false } = {}) {
  const plan = currentTravelPlanForTranslation();
  const field = collectTravelPlanTranslationFields(plan, targetLang).find((candidate) => candidate.key === key);
  if (!field) return;
  setFieldTranslation(field.holder, {
    mapField: field.mapField,
    plainField: field.plainField,
    sourceText: field.sourceText,
    targetLang,
    targetText: value
  });
  const manualKeys = new Set(travelPlanManualTranslationKeys(plan, targetLang));
  if (normalizeText(value)) manualKeys.add(key);
  else manualKeys.delete(key);
  touchTravelPlanTranslationMeta(plan, targetLang, "manual", { manualKeys: Array.from(manualKeys) });
  if (state.booking) state.booking.travel_plan = plan;
  if (state.tour) state.tour.travel_plan = plan;
  state.travelPlanDraft = plan;
  if (key.startsWith("website.")) updateHeaderTitle();
  updateTourDirtyState();
  if (rerender) renderTravelPlanTranslationPanel();
}

async function translateTravelPlanLanguages(targets, { force = false, minimumOverlayMs = 0, showOverlayWhenNoWork = false } = {}) {
  const plan = currentTravelPlanForTranslation({ syncFromEditor: true });
  if (!plan) return;
  const sourceFields = collectTravelPlanTranslationFields(plan, TRAVEL_PLAN_SOURCE_LANG);
  if (!sourceFields.length) {
    setStatus(backendT("tour.travel_plan_translation.no_source", "Add English website or travel-plan text before translating."));
    return;
  }
  const resolvedTargets = uniqueLanguageCodes(targets).filter((lang) => lang && lang !== TRAVEL_PLAN_SOURCE_LANG);
  if (!resolvedTargets.length) return;

  const workItems = resolvedTargets
    .map((targetLang) => {
      const summary = travelPlanTranslationStatus(plan, targetLang);
      if (!force && !["missing", "partial", "stale"].includes(summary.status)) return null;
      const fields = collectTravelPlanTranslationFields(plan, targetLang);
      if (!fields.length) return null;
      return {
        targetLang,
        fieldBatches: partitionItems(fields, TRAVEL_PLAN_TRANSLATION_REQUEST_BATCH_SIZE)
      };
    })
    .filter(Boolean);
  if (!workItems.length) {
    if (showOverlayWhenNoWork || minimumOverlayMs > 0) {
      const overlayStartedAt = Date.now();
      setTourPageOverlay(true, travelPlanTranslationOverlayMessage("", TOUR_TRANSLATION_PROVIDER_DISPLAY));
      setStatus(backendT("tour.travel_plan_translation.done", "Translations updated."));
      await waitForMinimumElapsed(overlayStartedAt, minimumOverlayMs);
      setTourPageOverlay(false);
    }
    return;
  }

  const overlayStartedAt = Date.now();
  setTourPageOverlay(true, travelPlanTranslationOverlayMessage(workItems[0]?.targetLang, TOUR_TRANSLATION_PROVIDER_DISPLAY));
  setStatus(backendT("tour.travel_plan_translation.translating", "Translating website content and travel plan..."));
  try {
    for (const workItem of workItems) {
      const targetLang = workItem.targetLang;
      for (const fieldBatch of workItem.fieldBatches) {
        setTourPageOverlay(true, travelPlanTranslationOverlayMessage(targetLang, TOUR_TRANSLATION_PROVIDER_DISPLAY));
        const sourceEntries = Object.fromEntries(fieldBatch.map((field) => [field.key, field.sourceText]));
        const translationResult = await requestTourTranslation(targetLang, sourceEntries, {
          sourceLang: TRAVEL_PLAN_SOURCE_LANG
        });
        const translatedEntries = translationResult?.entries || null;
        if (!translatedEntries) continue;
        applyTravelPlanTranslationEntries(plan, targetLang, translatedEntries, "machine");
      }
    }
    state.travelPlanDraft = plan;
    if (state.booking) state.booking.travel_plan = plan;
    if (state.tour) state.tour.travel_plan = plan;
    updateHeaderTitle();
    renderTravelPlanTranslationPanel();
    updateTourDirtyState();
    setStatus(backendT("tour.travel_plan_translation.done", "Translations updated."));
  } finally {
    await waitForMinimumElapsed(overlayStartedAt, minimumOverlayMs);
    setTourPageOverlay(false);
  }
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
  tourTravelPlanAdapter = createTourTravelPlanAdapter({
    state,
    els,
    apiOrigin,
    fetchApi,
    escapeHtml,
    onDirtyChange: () => {
      updateTourDirtyState();
      renderTravelPlanTranslationPanel();
    },
    onTourMutation: (tour) => {
      state.tour = tour;
      state.id = String(tour?.id || state.id || "");
      state.is_create_mode = !state.id;
    },
    setPageOverlay: (isVisible, message = "") => setTourPageOverlay(isVisible, message)
  });
  tourTravelPlanAdapter.bind();
  if (els.travelPlanTranslationSection instanceof HTMLElement) {
    initializeBookingSection(els.travelPlanTranslationSection);
    setBookingSectionOpen(els.travelPlanTranslationSection, true, { animate: false });
  }

  if (els.form) {
    els.form.addEventListener("submit", submitForm);
    const scheduleTourDirtyState = () => window.setTimeout(updateTourDirtyState, 0);
    els.form.addEventListener("input", (event) => {
      clearError();
      setStatus("");
      const translationField = event.target instanceof HTMLElement
        ? event.target.closest("[data-tour-travel-plan-translation-key]")
        : null;
      if (translationField) {
        updateTravelPlanTranslationField(
          normalizeTourTextLang(translationField.getAttribute("data-tour-travel-plan-translation-lang")),
          normalizeText(translationField.getAttribute("data-tour-travel-plan-translation-key")),
          translationField.value || ""
        );
        scheduleTourDirtyState();
        return;
      }
      const field = event.target instanceof HTMLElement ? event.target.getAttribute("data-tour-i18n-field") : "";
      if (field === "title_i18n" || field === "short_description_i18n") {
        if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) {
          enforceTourSourceDescriptionLimit(event.target);
        }
        syncLocalizedFieldState();
        if (field === "title_i18n") {
          clearTitleError();
          updateHeaderTitle();
        }
        renderTravelPlanTranslationPanel();
      }
      scheduleTourDirtyState();
    });
    els.form.addEventListener("change", (event) => {
      clearError();
      setStatus("");
      const translationField = event.target instanceof HTMLElement
        ? event.target.closest("[data-tour-travel-plan-translation-key]")
        : null;
      if (translationField) {
        updateTravelPlanTranslationField(
          normalizeTourTextLang(translationField.getAttribute("data-tour-travel-plan-translation-lang")),
          normalizeText(translationField.getAttribute("data-tour-travel-plan-translation-key")),
          translationField.value || "",
          { rerender: true }
        );
      }
      scheduleTourDirtyState();
    });
    els.form.addEventListener("click", (event) => {
      const translateAllTravelPlanButton = event.target.closest("[data-tour-travel-plan-translate-all]");
      if (translateAllTravelPlanButton) {
        event.preventDefault();
        void translateTravelPlanLanguages(travelPlanTranslationTargetLanguages(), { force: true });
        return;
      }
      const translateMissingTravelPlanButton = event.target.closest("[data-tour-travel-plan-translate-missing]");
      if (translateMissingTravelPlanButton) {
        event.preventDefault();
        void translateTravelPlanLanguages(travelPlanTranslationTargetLanguages(), {
          force: false,
          minimumOverlayMs: 1000,
          showOverlayWhenNoWork: true
        });
        return;
      }
      const translateTravelPlanLanguageButton = event.target.closest("[data-tour-travel-plan-translate-lang]");
      if (translateTravelPlanLanguageButton) {
        event.preventDefault();
        const targetLang = normalizeTourTextLang(translateTravelPlanLanguageButton.getAttribute("data-tour-travel-plan-translate-lang"));
        void translateTravelPlanLanguages([targetLang], { force: true });
        return;
      }
      const reviewTravelPlanLanguageButton = event.target.closest("[data-tour-travel-plan-review-lang]");
      if (reviewTravelPlanLanguageButton) {
        event.preventDefault();
        const targetLang = normalizeTourTextLang(reviewTravelPlanLanguageButton.getAttribute("data-tour-travel-plan-review-lang"));
        state.activeTravelPlanTranslationLang = state.activeTravelPlanTranslationLang === targetLang ? "" : targetLang;
        currentTravelPlanForTranslation({ syncFromEditor: true });
        renderTravelPlanTranslationPanel();
        return;
      }
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
  if (els.addPictureBtn && els.pictureUpload) {
    els.addPictureBtn.addEventListener("click", () => {
      els.pictureUpload.click();
    });
  }
  if (els.pictureUpload) {
    els.pictureUpload.addEventListener("change", () => {
      const files = Array.from(els.pictureUpload.files || []).filter((file) => file instanceof File);
      if (!files.length) return;
      state.pictureDraftItems = [
        ...state.pictureDraftItems,
        ...files.map((file) => createPendingPictureDraftItem(file))
      ];
      renderTourPictures();
      setStatus(
        backendT("tour.status.selected_pictures", "Selected {count} picture(s).", {
          count: String(files.length)
        })
      );
      els.pictureUpload.value = "";
      updateTourDirtyState();
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
  if (els.pictureList) {
    els.pictureList.addEventListener("click", (event) => {
      if (revealMediaFilename(event.target)) return;
      const button = event.target instanceof Element ? event.target.closest("[data-tour-remove-picture]") : null;
      if (!button || !state.permissions.canEditTours) return;
      event.preventDefault();
      const key = String(button.getAttribute("data-tour-remove-picture") || "").trim();
      if (!key) return;
      const nextItems = [];
      for (const item of state.pictureDraftItems) {
        if (item.key === key) {
          revokePictureDraftItem(item);
          continue;
        }
        nextItems.push(item);
      }
      state.pictureDraftItems = nextItems;
      renderTourPictures();
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
  renderLocalizedTourContentEditor();
  syncPictureDraftItemsFromTour(tour);
  syncReelVideoDraftItemFromTour(tour);
  tourTravelPlanAdapter?.applyTour(tour);
  renderTravelPlanTranslationPanel();

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
    pictures: [],
    reel_video: null,
    travel_plan: { destination_scope: [], destinations: [], days: [] }
  };

  state.localizedContent.title_i18n = {};
  state.localizedContent.short_description_i18n = {};
  updateHeader({ title: backendT("tour.new_title", "New tour") }, [], []);
  setInput("tour_priority", "50");
  setInput("tour_seasonality_start_month", "");
  setInput("tour_seasonality_end_month", "");
  renderLocalizedTourContentEditor();
  syncPictureDraftItemsFromTour(state.tour);
  syncReelVideoDraftItemFromTour(state.tour);
  tourTravelPlanAdapter?.applyTour(state.tour);
  renderTravelPlanTranslationPanel();
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
  const draftPictureItems = [...state.pictureDraftItems];
  const storedPictures = draftPictureItems
    .filter((item) => item.kind === "stored")
    .map((item) => item.picture)
    .filter(Boolean);
  const pendingPictures = draftPictureItems.filter((item) => item.kind === "pending");
  const removedPictures = normalizeTourPictures(state.tour).filter((picture) => !storedPictures.includes(picture));
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
    short_description_i18n,
    pictures: storedPictures,
    travel_plan: omitDerivedTravelPlanDestinations(travelPlanPayload)
  };
  const expectedUpdatedAt = normalizeText(state.tour?.updated_at);
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

    if (pendingPictures.length) {
      for (let index = 0; index < pendingPictures.length; index += 1) {
        const item = pendingPictures[index];
        setStatus(
          backendT("tour.status.uploading_picture_progress", "Uploading picture {current} of {total}...", {
            current: String(index + 1),
            total: String(pendingPictures.length)
          })
        );
        const base64 = await fileToBase64(item.file);
        const pictureRequest = tourPictureUploadRequest({ baseURL: apiOrigin, params: { tour_id: state.id } });
        const pictureResult = await fetchApi(withApiLang(pictureRequest.url), {
          method: pictureRequest.method,
          body: {
            filename: item.file.name,
            data_base64: base64
          }
        });
        if (!pictureResult) return;
        if (homepageAssetSyncFailed(pictureResult)) {
          finalSaveStatus = homepageAssetSyncWarningMessage();
        }
        if (pictureResult.tour) {
          state.tour = pictureResult.tour;
        }
      }
    }

    if (!is_create && removedPictures.length) {
      for (const picture of removedPictures) {
        const pictureName = pictureNameFromValue(picture);
        if (!pictureName) continue;
        setStatus(backendT("tour.status.removing_picture", "Removing picture..."));
        const deleteRequest = tourPictureDeleteRequest({
          baseURL: apiOrigin,
          params: { tour_id: state.id, picture_name: pictureName }
        });
        const deleteResult = await fetchApi(withApiLang(deleteRequest.url), {
          method: deleteRequest.method
        });
        if (!deleteResult) return;
        if (homepageAssetSyncFailed(deleteResult)) {
          finalSaveStatus = homepageAssetSyncWarningMessage();
        }
        if (deleteResult.tour) {
          state.tour = deleteResult.tour;
        }
      }
    }

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
  if (els.addPictureBtn) els.addPictureBtn.disabled = true;
  if (els.pictureUpload) els.pictureUpload.disabled = true;
  if (els.addReelVideoBtn) els.addReelVideoBtn.disabled = true;
  if (els.reelVideoUpload) els.reelVideoUpload.disabled = true;
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
