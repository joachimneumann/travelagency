import {
  createApiFetcher,
  escapeHtml,
  formatDateTime,
  normalizeText
} from "../shared/api.js";
import { destinationScopeCatalogRequest } from "../../Generated/API/generated_APIRequestFactory.js";
import { normalizeDestinationScopeCatalog } from "../shared/destination_scope_editor.js";
import { createTourCustomizerWorkspace } from "../tour_customize.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import {
  backendT,
  currentBackendLang,
  getBackendApiBase,
  getBackendApiOrigin,
  initializeBackendPageChrome,
  loadBackendPageAuthState,
  setBackendPageLoadingOverlay,
  withBackendApiLang
} from "../shared/backend_page.js";
import { buildTourVariantEditHref } from "../shared/links.js";

const apiBase = getBackendApiBase();
const apiOrigin = getBackendApiOrigin();
const qs = new URLSearchParams(window.location.search);

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  error: document.getElementById("backendError"),
  backLink: document.getElementById("tourVariantBackLink"),
  heading: document.getElementById("tourVariantHeading"),
  reloadBtn: document.getElementById("tourVariantReloadBtn"),
  saveBtn: document.getElementById("tourVariantSaveBtn"),
  createBaseField: document.getElementById("tourVariantCreateBaseField"),
  baseTour: document.getElementById("tourVariantBaseTour"),
  title: document.getElementById("tourVariantTitle"),
  shortDescription: document.getElementById("tourVariantShortDescription"),
  priority: document.getElementById("tourVariantPriority"),
  seasonStart: document.getElementById("tourVariantSeasonStart"),
  seasonEnd: document.getElementById("tourVariantSeasonEnd"),
  published: document.getElementById("tourVariantPublished"),
  styles: document.getElementById("tourVariantStyles"),
  meta: document.getElementById("tourVariantMeta"),
  issues: document.getElementById("tourVariantIssues"),
  status: document.getElementById("tourVariantStatus"),
  arrivalMode: document.getElementById("tourVariantArrivalMode"),
  arrivalTitle: document.getElementById("tourVariantArrivalTitle"),
  arrivalAirportCode: document.getElementById("tourVariantArrivalAirportCode"),
  arrivalDetails: document.getElementById("tourVariantArrivalDetails"),
  departureMode: document.getElementById("tourVariantDepartureMode"),
  departureTitle: document.getElementById("tourVariantDepartureTitle"),
  departureAirportCode: document.getElementById("tourVariantDepartureAirportCode"),
  departureDetails: document.getElementById("tourVariantDepartureDetails"),
  customizer: document.getElementById("tourVariantCustomizer"),
  sourceSearch: document.getElementById("tourVariantSourceSearch"),
  sourceSearchBtn: document.getElementById("tourVariantSourceSearchBtn")
};

const GENERATED_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_APP_ROLES.map((role) => [String(role).replace(/^atp_/, "").toUpperCase(), role])
  )
);

const ROLES = Object.freeze({
  TOUR_EDITOR: GENERATED_ROLE_LOOKUP.TOUR_EDITOR
});

const state = {
  id: normalizeText(qs.get("id")),
  isCreateMode: !normalizeText(qs.get("id")),
  permissions: {
    canReadTourVariants: false,
    canEditTourVariants: false
  },
  variant: null,
  options: {
    styles: [],
    base_tours: []
  },
  destinationScopeCatalog: normalizeDestinationScopeCatalog({}),
  allSourceDays: [],
  sourceSearch: ""
};

const fetchApi = createApiFetcher({
  apiBase,
  onError: (message) => showError(message),
  suppressNotFound: false,
  includeDetailInError: true,
  connectionErrorMessage: backendT("booking.error.connect", "Could not connect to backend API.")
});

const tourVariantCustomizer = createTourCustomizerWorkspace({
  root: els.customizer,
  escapeHTML: escapeHtml,
  escapeAttr: escapeHtml,
  currentFrontendLang: currentLang,
  labels: {
    map: "Route map",
    optimize: "Optimize",
    zoomOut: "Zoom out",
    optionalDays: "Optional days",
    noOptionalDays: "No optional days are available for this route yet.",
    timeline: "Tour Variant timeline",
    timelineWithCount: "Tour Variant timeline ({count})",
    emptyTimeline: "Add at least one day to keep customizing.",
    day: "Day {day}",
    moveHere: "move here",
    dropHere: "drop here"
  },
  destinationScopeCatalog: () => state.destinationScopeCatalog,
  travelPlanDays: customizerTravelPlanDays,
  allTrips: customizerTrips,
  findTripById: findCustomizerTripById,
  ensureTourDetailsLoaded: async (tourId) => findCustomizerTripById(tourId),
  onTimelineChange: applyCustomizerTimeline
});

function refreshBackendNavElements() {
  els.logoutLink = document.getElementById("backendLogoutLink");
  els.userLabel = document.getElementById("backendUserLabel");
}

function hasAnyRoleInList(roleList, ...roles) {
  return roles.some((role) => roleList.includes(role));
}

function showError(message) {
  if (!els.error) return;
  els.error.textContent = String(message || "").trim();
  els.error.classList.toggle("show", Boolean(els.error.textContent));
}

function clearError() {
  showError("");
}

function setStatus(message = "") {
  if (els.status) els.status.textContent = String(message || "").trim();
}

function currentLang() {
  return normalizeText(currentBackendLang()).toLowerCase() || "en";
}

function optionValue(option) {
  if (option && typeof option === "object") return normalizeText(option.code || option.value || option.id);
  return normalizeText(option);
}

function optionLabel(option) {
  if (option && typeof option === "object") return normalizeText(option.label || option.title || option.code || option.value || option.id);
  return normalizeText(option);
}

function selectedStyleCodes() {
  return Array.from(els.styles?.querySelectorAll?.('input[name="tourVariantStyle"]:checked') || [])
    .map((input) => normalizeText(input.value))
    .filter(Boolean);
}

function renderStyleChoices(selectedValues = []) {
  if (!els.styles) return;
  const selected = new Set((Array.isArray(selectedValues) ? selectedValues : []).map((value) => normalizeText(value)));
  const values = [];
  const seen = new Set();
  for (const raw of [
    ...(Array.isArray(state.options.styles) ? state.options.styles : []),
    ...Array.from(selected).map((code) => ({ code, label: code }))
  ]) {
    const value = optionValue(raw);
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    values.push({ value, label: optionLabel(raw) || value });
  }
  els.styles.innerHTML = values.map((option) => `
    <label>
      <input type="checkbox" name="tourVariantStyle" value="${escapeHtml(option.value)}"${selected.has(option.value) ? " checked" : ""} />
      <span>${escapeHtml(option.label)}</span>
    </label>
  `).join("");
}

function setInput(element, value) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    element.value = value == null ? "" : String(value);
  }
}

function localizedMap(mapValue, plainValue = "") {
  const map = mapValue && typeof mapValue === "object" && !Array.isArray(mapValue) ? { ...mapValue } : {};
  const source = normalizeText(map.en) || normalizeText(plainValue);
  return {
    ...(source ? { en: source } : {}),
    ...Object.fromEntries(Object.entries(map).filter(([lang, text]) => normalizeText(lang) !== "en" && normalizeText(text)))
  };
}

function localizedPairForSave(existingMap, currentSourceValue, currentInputValue) {
  const lang = currentLang();
  const next = localizedMap(existingMap, currentSourceValue);
  const value = normalizeText(currentInputValue);
  if (lang === "en") {
    if (value) next.en = value;
    else delete next.en;
  } else if (value) {
    next[lang] = value;
  } else {
    delete next[lang];
  }
  return next;
}

function defaultBoundary(kind) {
  return {
    id: `tour_variant_boundary_${kind}`,
    mode: "none",
    title: "",
    title_i18n: {},
    details: "",
    details_i18n: {},
    airport_code: ""
  };
}

function boundary(kind) {
  const source = state.variant?.boundary_logistics?.[kind];
  return source && typeof source === "object" && !Array.isArray(source) ? source : defaultBoundary(kind);
}

function renderBoundary(kind) {
  const prefix = kind === "departure" ? "departure" : "arrival";
  const source = boundary(kind);
  setInput(els[`${prefix}Mode`], source.mode || "none");
  setInput(els[`${prefix}Title`], source.title || "");
  setInput(els[`${prefix}AirportCode`], source.airport_code || "");
  setInput(els[`${prefix}Details`], source.details || "");
}

function boundaryPayload(kind) {
  const prefix = kind === "departure" ? "departure" : "arrival";
  const source = boundary(kind);
  const titleInput = normalizeText(els[`${prefix}Title`]?.value);
  const detailsInput = normalizeText(els[`${prefix}Details`]?.value);
  return {
    id: normalizeText(source.id) || `tour_variant_boundary_${kind}`,
    mode: normalizeText(els[`${prefix}Mode`]?.value) || "none",
    title_i18n: localizedPairForSave(source.title_i18n, source.title, titleInput),
    details_i18n: localizedPairForSave(source.details_i18n, source.details, detailsInput),
    airport_code: normalizeText(els[`${prefix}AirportCode`]?.value)
  };
}

function renderBaseTourOptions(selectedValue = "") {
  if (!(els.baseTour instanceof HTMLSelectElement)) return;
  const baseTours = Array.isArray(state.options.base_tours) ? state.options.base_tours : [];
  els.baseTour.innerHTML = [
    `<option value="">${escapeHtml(baseTours.length ? "Choose a base marketing tour" : "No published marketing tours")}</option>`,
    ...baseTours.map((tour) => {
      const id = normalizeText(tour.id);
      return `<option value="${escapeHtml(id)}"${id === selectedValue ? " selected" : ""}>${escapeHtml(tour.title || id)} (${escapeHtml(String(tour.day_count || 0))})</option>`;
    })
  ].join("");
}

function renderMeta() {
  if (!els.meta) return;
  const variant = state.variant || {};
  const updated = formatDateTime(variant.updated_at || variant.created_at);
  els.meta.innerHTML = [
    variant.id ? `<div>ID: ${escapeHtml(variant.id)}</div>` : "",
    `<div>Updated: ${escapeHtml(updated)}</div>`
  ].filter(Boolean).join("");
}

function renderIssues() {
  if (!els.issues) return;
  const issues = Array.isArray(state.variant?.publication?.issues) ? state.variant.publication.issues : [];
  els.issues.textContent = issues.length ? issues.join(" ") : "";
}

function renderHeader() {
  const title = normalizeText(state.variant?.title) || (state.isCreateMode ? "New Tour Variant" : "Tour Variant");
  if (els.heading) els.heading.textContent = title;
  document.title = title;
}

function renderForm() {
  const variant = state.variant || {};
  renderHeader();
  setInput(els.title, variant.title || "");
  setInput(els.shortDescription, variant.short_description || "");
  setInput(els.priority, variant.priority ?? 50);
  setInput(els.seasonStart, variant.seasonality_start_month || "");
  setInput(els.seasonEnd, variant.seasonality_end_month || "");
  if (els.published instanceof HTMLInputElement) els.published.checked = variant.published_on_webpage === true;
  renderStyleChoices(Array.isArray(variant.style_codes) && variant.style_codes.length ? variant.style_codes : variant.styles);
  renderBoundary("arrival");
  renderBoundary("departure");
  renderMeta();
  renderIssues();
  if (els.createBaseField instanceof HTMLElement) els.createBaseField.hidden = !state.isCreateMode;
  renderBaseTourOptions(normalizeText(qs.get("base_marketing_tour_id")) || variant.base_marketing_tour_id || "");
  if (els.saveBtn instanceof HTMLButtonElement) {
    els.saveBtn.disabled = !state.permissions.canEditTourVariants;
    els.saveBtn.textContent = state.isCreateMode ? "Create" : "Save";
  }
  renderCustomizer();
}

function timelineDays() {
  return Array.isArray(state.variant?.days) ? state.variant.days : [];
}

function renumberDays() {
  const days = timelineDays();
  days.forEach((day, index) => {
    day.day_number = index + 1;
    if (!normalizeText(day.id)) day.id = `tour_variant_day_${index + 1}`;
  });
}

function dayRefKey(day) {
  const sourceTourId = normalizeText(day?.source_tour_id);
  const sourceDayId = normalizeText(day?.source_day_id);
  return sourceTourId && sourceDayId ? `${sourceTourId}:${sourceDayId}` : "";
}

function sourceDayKey(sourceDay) {
  const sourceTourId = normalizeText(sourceDay?.source_tour_id);
  const sourceDayId = normalizeText(sourceDay?.source_day_id);
  return sourceTourId && sourceDayId ? `${sourceTourId}:${sourceDayId}` : "";
}

function findSourceDayByKey(key) {
  const normalizedKey = normalizeText(key);
  return state.allSourceDays.find((sourceDay) => sourceDayKey(sourceDay) === normalizedKey) || null;
}

function sourceRowsForCustomizer() {
  return Array.isArray(state.allSourceDays) ? state.allSourceDays : [];
}

function customizerTravelPlanDays(trip) {
  return Array.isArray(trip?.travel_plan?.days) ? trip.travel_plan.days : [];
}

function customizerTrips() {
  const tripsById = new Map();
  for (const sourceDay of sourceRowsForCustomizer()) {
    const sourceTourId = normalizeText(sourceDay?.source_tour_id);
    const sourceDayId = normalizeText(sourceDay?.source_day_id);
    const rawDay = sourceDay?.source_day && typeof sourceDay.source_day === "object" && !Array.isArray(sourceDay.source_day)
      ? sourceDay.source_day
      : null;
    if (!sourceTourId || !sourceDayId || !rawDay) continue;
    if (!tripsById.has(sourceTourId)) {
      tripsById.set(sourceTourId, {
        id: sourceTourId,
        title: normalizeText(sourceDay?.source_tour_title) || sourceTourId,
        published_on_webpage: true,
        travel_plan: { days: [] },
        dayIds: new Set()
      });
    }
    const trip = tripsById.get(sourceTourId);
    if (trip.dayIds.has(sourceDayId)) continue;
    trip.dayIds.add(sourceDayId);
    trip.travel_plan.days.push({
      ...rawDay,
      id: normalizeText(rawDay.id) || sourceDayId,
      day_number: Number(rawDay.day_number || sourceDay.day_number) || trip.travel_plan.days.length + 1
    });
  }
  return Array.from(tripsById.values()).map(({ dayIds: _dayIds, ...trip }) => ({
    ...trip,
    travel_plan: {
      ...trip.travel_plan,
      days: [...trip.travel_plan.days].sort((left, right) => {
        const leftNumber = Number(left?.day_number);
        const rightNumber = Number(right?.day_number);
        if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
          return leftNumber - rightNumber;
        }
        return normalizeText(left?.id).localeCompare(normalizeText(right?.id));
      })
    }
  }));
}

function findCustomizerTripById(tourId) {
  const normalizedTourId = normalizeText(tourId);
  return customizerTrips().find((trip) => normalizeText(trip?.id) === normalizedTourId) || null;
}

function selectedBaseTourTitle(baseTourId) {
  const normalizedBaseTourId = normalizeText(baseTourId);
  const baseTour = (Array.isArray(state.options.base_tours) ? state.options.base_tours : [])
    .find((tour) => normalizeText(tour?.id) === normalizedBaseTourId);
  return normalizeText(baseTour?.title) || normalizedBaseTourId;
}

function customizerBaseTrip() {
  const baseTourId = normalizeText(state.variant?.base_marketing_tour_id || els.baseTour?.value || qs.get("base_marketing_tour_id"));
  if (!baseTourId) return null;
  return findCustomizerTripById(baseTourId) || {
    id: baseTourId,
    title: selectedBaseTourTitle(baseTourId),
    published_on_webpage: true,
    travel_plan: { days: [] }
  };
}

function timelineRefsForCustomizer() {
  return timelineDays().map((day) => {
    const sourceDay = findSourceDayByKey(dayRefKey(day));
    return {
      ...day,
      source_tour_title: normalizeText(sourceDay?.source_tour_title || day?.source_tour_title),
      source_day_title: normalizeText(sourceDay?.title || day?.source_day_title),
      source_day_exists: day?.source_day_exists !== false && sourceDay !== null,
      source_tour_published_on_webpage: day?.source_tour_published_on_webpage !== false,
      ...(sourceDay?.source_day ? { source_day: sourceDay.source_day } : {})
    };
  });
}

function applyCustomizerTimeline(items) {
  if (!state.variant) return;
  state.variant.days = (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      id: normalizeText(item?.variantDayId || item?.timelineInstanceId) || `tour_variant_day_${index + 1}`,
      day_number: index + 1,
      source_tour_id: normalizeText(item?.sourceTourId),
      source_day_id: normalizeText(item?.sourceDayId),
      source_tour_title: normalizeText(item?.sourceTourTitle),
      source_day_title: normalizeText(item?.title),
      source_day_exists: item?.sourceDayExists !== false,
      source_tour_published_on_webpage: item?.sourceTourPublished !== false
    }))
    .filter((day) => day.source_tour_id && day.source_day_id);
  renumberDays();
  renderCustomizer();
}

function renderCustomizer() {
  void tourVariantCustomizer.setTripState({
    baseTrip: state.isCreateMode ? null : customizerBaseTrip(),
    selectedDayRefs: state.isCreateMode ? [] : timelineRefsForCustomizer(),
    moduleQuery: state.sourceSearch,
    disabled: state.isCreateMode || !state.permissions.canEditTourVariants,
    emptyOptionsLabel: state.isCreateMode
      ? "Choose a base marketing tour and create the Tour Variant first."
      : "No optional days are available for this route yet.",
    emptyTimelineLabel: state.isCreateMode
      ? "Choose a base marketing tour and create the Tour Variant first."
      : "Add at least one day to keep customizing.",
    tourId: normalizeText(state.variant?.id) || "tour_variant_workspace",
    tourTitle: normalizeText(state.variant?.title) || "Tour Variant timeline"
  }).catch((error) => {
    console.error("[backend-tour-variant] Failed to render Tour Variant customizer.", error);
  });
}

async function loadSourceDays() {
  const payload = await fetchApi(withBackendApiLang("/api/v1/tour-variants/source-days", {
    limit: 1000
  }), {
    cache: "no-store"
  });
  if (!payload) return;
  state.allSourceDays = Array.isArray(payload.items) ? payload.items : [];
  renderCustomizer();
}

async function loadDestinationScopeCatalog() {
  const request = destinationScopeCatalogRequest({ baseURL: apiOrigin });
  const payload = await fetchApi(withBackendApiLang(request.url), {
    cache: "no-store"
  });
  state.destinationScopeCatalog = normalizeDestinationScopeCatalog(payload || {});
}

async function loadOptionsForCreate() {
  const payload = await fetchApi(withBackendApiLang("/api/v1/tour-variants", {
    page: 1,
    page_size: 1
  }), {
    cache: "no-store"
  });
  state.options = payload?.options && typeof payload.options === "object" ? payload.options : state.options;
  state.variant = {
    id: "",
    title: "",
    title_i18n: {},
    short_description: "",
    short_description_i18n: {},
    styles: [],
    style_codes: [],
    priority: 50,
    seasonality_start_month: "",
    seasonality_end_month: "",
    published_on_webpage: false,
    base_marketing_tour_id: normalizeText(qs.get("base_marketing_tour_id")),
    boundary_logistics: {
      arrival: defaultBoundary("arrival"),
      departure: defaultBoundary("departure")
    },
    days: []
  };
  renderForm();
}

async function loadTourVariant() {
  if (state.isCreateMode) {
    await loadOptionsForCreate();
    await loadSourceDays();
    return;
  }
  setStatus("Loading...");
  const payload = await fetchApi(withBackendApiLang(`/api/v1/tour-variants/${encodeURIComponent(state.id)}`), {
    cache: "no-store"
  });
  if (!payload?.tour_variant) return;
  state.variant = payload.tour_variant;
  state.options = payload.options && typeof payload.options === "object" ? payload.options : state.options;
  renderForm();
  await loadSourceDays();
  setStatus("");
}

function buildPayload() {
  const variant = state.variant || {};
  return {
    expected_updated_at: normalizeText(variant.updated_at),
    title_i18n: localizedPairForSave(variant.title_i18n, variant.title, els.title?.value),
    short_description_i18n: localizedPairForSave(variant.short_description_i18n, variant.short_description, els.shortDescription?.value),
    styles: selectedStyleCodes(),
    seasonality_start_month: normalizeText(els.seasonStart?.value),
    seasonality_end_month: normalizeText(els.seasonEnd?.value),
    priority: Number.isFinite(Number(els.priority?.value)) ? Number(els.priority.value) : 50,
    published_on_webpage: els.published instanceof HTMLInputElement ? els.published.checked === true : false,
    base_marketing_tour_id: normalizeText(variant.base_marketing_tour_id || els.baseTour?.value),
    boundary_logistics: {
      arrival: boundaryPayload("arrival"),
      departure: boundaryPayload("departure")
    },
    days: timelineDays().map((day, index) => ({
      id: normalizeText(day.id) || `tour_variant_day_${index + 1}`,
      day_number: index + 1,
      source_tour_id: normalizeText(day.source_tour_id),
      source_day_id: normalizeText(day.source_day_id)
    })).filter((day) => day.source_tour_id && day.source_day_id)
  };
}

async function createFromBase() {
  const baseMarketingTourId = normalizeText(els.baseTour?.value || state.variant?.base_marketing_tour_id);
  if (!baseMarketingTourId) {
    showError("Choose a base marketing tour.");
    return;
  }
  const payload = await fetchApi(withBackendApiLang("/api/v1/tour-variants"), {
    method: "POST",
    body: {
      base_marketing_tour_id: baseMarketingTourId
    }
  });
  if (!payload?.tour_variant?.id) return;
  window.dispatchEvent(new CustomEvent("backend-public-site-publish-refresh", {
    detail: { dirty: true }
  }));
  window.location.href = buildTourVariantEditHref(payload.tour_variant.id);
}

async function saveTourVariant() {
  clearError();
  if (state.isCreateMode) {
    await createFromBase();
    return;
  }
  setStatus("Saving...");
  const payload = await fetchApi(withBackendApiLang(`/api/v1/tour-variants/${encodeURIComponent(state.id)}`), {
    method: "PATCH",
    body: buildPayload()
  });
  if (!payload?.tour_variant) return;
  state.variant = payload.tour_variant;
  renderForm();
  window.dispatchEvent(new CustomEvent("backend-public-site-publish-refresh", {
    detail: { dirty: true }
  }));
  setStatus("Saved.");
}

function bindControls() {
  els.saveBtn?.addEventListener("click", () => {
    void saveTourVariant();
  });
  els.reloadBtn?.addEventListener("click", () => {
    void loadTourVariant();
  });
  els.sourceSearchBtn?.addEventListener("click", () => {
    state.sourceSearch = normalizeText(els.sourceSearch?.value);
    renderCustomizer();
  });
  els.sourceSearch?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    state.sourceSearch = normalizeText(els.sourceSearch.value);
    renderCustomizer();
  });
}

async function init() {
  setBackendPageLoadingOverlay(true);
  try {
    const chrome = await initializeBackendPageChrome({
      currentSection: "tour_variants",
      homeLink: els.homeLink,
      refreshNav: refreshBackendNavElements
    });
    els.logoutLink = chrome.logoutLink;
    els.userLabel = chrome.userLabel;

    const authState = await loadBackendPageAuthState({
      apiOrigin,
      refreshNav: refreshBackendNavElements,
      computePermissions: (roles) => ({
        canReadTourVariants: hasAnyRoleInList(roles, ROLES.TOUR_EDITOR),
        canEditTourVariants: hasAnyRoleInList(roles, ROLES.TOUR_EDITOR)
      }),
      hasPageAccess: (permissions) => permissions.canReadTourVariants,
      logKey: "backend-tour-variant",
      pageName: "tour_variant.html",
      expectedRolesAnyOf: [ROLES.TOUR_EDITOR],
      likelyCause: "The user is authenticated in Keycloak but does not have atp_tour_editor."
    });
    state.permissions = {
      canReadTourVariants: Boolean(authState.permissions?.canReadTourVariants),
      canEditTourVariants: Boolean(authState.permissions?.canEditTourVariants)
    };
    bindControls();
    if (!state.permissions.canReadTourVariants) {
      showError("You do not have access to Tour Variants.");
      return;
    }
    await loadDestinationScopeCatalog();
    await loadTourVariant();
  } catch (error) {
    console.error("[backend-tour-variant] initialization failed", error);
    showError(error?.message || "Could not load Tour Variant.");
  } finally {
    setBackendPageLoadingOverlay(false);
  }
}

void init();
