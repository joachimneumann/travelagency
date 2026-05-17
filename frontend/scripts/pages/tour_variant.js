import {
  createApiFetcher,
  escapeHtml,
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
import { MONTH_CODE_CATALOG } from "../shared/generated_catalogs.js";
import { buildTourEditHref, buildTourVariantEditHref } from "../shared/links.js";

const apiBase = getBackendApiBase();
const apiOrigin = getBackendApiOrigin();
const qs = new URLSearchParams(window.location.search);

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  error: document.getElementById("backendError"),
  heading: document.getElementById("tourVariantHeading"),
  reloadBtn: document.getElementById("tourVariantReloadBtn"),
  saveBtn: document.getElementById("tourVariantSaveBtn"),
  baseTour: document.getElementById("tourVariantBaseTour"),
  title: document.getElementById("tourVariantTitle"),
  shortDescription: document.getElementById("tourVariantShortDescription"),
  priority: document.getElementById("tourVariantPriority"),
  seasonStart: document.getElementById("tourVariantSeasonStart"),
  seasonEnd: document.getElementById("tourVariantSeasonEnd"),
  published: document.getElementById("tourVariantPublished"),
  tourCardImageSelector: document.getElementById("tourVariantCardImageSelector"),
  styles: document.getElementById("tourVariantStyles"),
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
  mapPreview: document.getElementById("tourVariantMapPreview"),
  daySummary: document.getElementById("tourVariantDaySummary"),
  customizerOverlay: document.getElementById("tourVariantCustomizerOverlay"),
  customizerClose: document.getElementById("tourVariantCustomizerClose"),
  customizer: document.getElementById("tourVariantCustomizer")
};

const GENERATED_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_APP_ROLES.map((role) => [String(role).replace(/^atp_/, "").toUpperCase(), role])
  )
);

const ROLES = Object.freeze({
  TOUR_EDITOR: GENERATED_ROLE_LOOKUP.TOUR_EDITOR
});

const TOUR_WEB_PAGE_MIN_IMAGE_COUNT = 2;

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
  sourceDaysLoaded: false
};

let backendLoginRedirectScheduled = false;
let cleanPayloadSignature = "";
let isSavingTourVariant = false;
let isCustomizerOverlayOpen = false;

const fetchApi = createApiFetcher({
  apiBase,
  onError: (message, _payload, response) => {
    if (response?.status === 401) {
      handleUnauthorizedApiResponse();
      return;
    }
    showError(message);
  },
  suppressNotFound: false,
  includeDetailInError: true,
  connectionErrorMessage: backendT("booking.error.connect", "Could not connect to backend API.")
});

const customizerLabels = {};
updateCustomizerLabels();

function createTourVariantCustomizerWorkspace(root, onTimelineChange = null, mode = "default") {
  return createTourCustomizerWorkspace({
    root,
    mode,
    escapeHTML: escapeHtml,
    escapeAttr: escapeHtml,
    currentFrontendLang: currentLang,
    labels: customizerLabels,
    destinationScopeCatalog: () => state.destinationScopeCatalog,
    travelPlanDays: customizerTravelPlanDays,
    allTrips: customizerTrips,
    findTripById: findCustomizerTripById,
    ensureTourDetailsLoaded: async (tourId) => findCustomizerTripById(tourId),
    onTimelineChange
  });
}

const tourVariantMapPreview = createTourVariantCustomizerWorkspace(els.mapPreview, null, "preview");
const tourVariantCustomizer = createTourVariantCustomizerWorkspace(els.customizer, applyCustomizerTimeline, "full");

function tourVariantT(key, fallback, vars) {
  return backendT(`backend.tour_variant.${key}`, fallback, vars);
}

function updateCustomizerLabels() {
  Object.assign(customizerLabels, {
    map: tourVariantT("map", "Route map"),
    optimize: tourVariantT("reorder_route", "Reorder Route"),
    zoomOut: tourVariantT("zoom_out", "Zoom out"),
    optionalDays: tourVariantT("optional_days", "Optional days"),
    noOptionalDays: tourVariantT("no_optional_days", "No optional days are available for this route yet."),
    timeline: tourVariantT("timeline", "Tour Variant timeline"),
    timelineWithCount: tourVariantT("timeline_with_count", "Tour Variant timeline ({count})"),
    emptyTimeline: tourVariantT("empty_timeline", "Add at least one day to keep customizing."),
    day: tourVariantT("day", "Day {day}"),
    moveHere: tourVariantT("move_here", "move here"),
    dropHere: tourVariantT("drop_here", "drop here")
  });
  refreshCustomizerChromeLabels();
}

function refreshCustomizerChromeLabels() {
  const routeCustomizerLabel = tourVariantT("route_customizer", "Route customizer");
  refreshMapPreviewStage();
  if (els.customizerOverlay instanceof HTMLElement) {
    els.customizerOverlay.setAttribute("aria-label", routeCustomizerLabel);
  }
  if (els.customizerClose instanceof HTMLButtonElement) {
    els.customizerClose.textContent = backendT("common.close", "Close");
  }
}

function setCustomizerOverlayOpen(open) {
  const nextOpen = Boolean(open);
  if (!(els.customizerOverlay instanceof HTMLElement)) return;
  isCustomizerOverlayOpen = nextOpen;
  els.customizerOverlay.hidden = !nextOpen;
  refreshMapPreviewStage();
  if (nextOpen) {
    renderCustomizer();
    window.setTimeout(() => {
      if (isCustomizerOverlayOpen) els.customizerClose?.focus?.();
    }, 0);
  } else {
    mapPreviewStage()?.focus?.();
  }
}

function openCustomizerOverlay() {
  setCustomizerOverlayOpen(true);
}

function closeCustomizerOverlay() {
  setCustomizerOverlayOpen(false);
}

function handleMapPreviewKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (!isMapPreviewStageTarget(event.target)) return;
  event.preventDefault();
  openCustomizerOverlay();
}

function handleMapPreviewClick(event) {
  if (!isMapPreviewStageTarget(event.target)) return;
  event.preventDefault();
  openCustomizerOverlay();
}

function mapPreviewStage() {
  return els.mapPreview instanceof HTMLElement ? els.mapPreview : null;
}

function isMapPreviewStageTarget(target) {
  return target instanceof Element && Boolean(els.mapPreview?.contains(target));
}

function refreshMapPreviewStage() {
  const stage = mapPreviewStage();
  if (!(stage instanceof HTMLElement)) return;
  const openLabel = tourVariantT("open_route_customizer", "Open route customizer");
  stage.setAttribute("role", "button");
  stage.setAttribute("tabindex", "0");
  stage.setAttribute("aria-controls", "tourVariantCustomizerOverlay");
  stage.setAttribute("aria-expanded", isCustomizerOverlayOpen ? "true" : "false");
  stage.setAttribute("aria-label", openLabel);
  stage.setAttribute("title", openLabel);
}

function handleCustomizerOverlayKeydown(event) {
  if (event.key !== "Escape" || !isCustomizerOverlayOpen) return;
  event.preventDefault();
  closeCustomizerOverlay();
}

function customizerTripState({ forceDisabled = false } = {}) {
  return {
    baseTrip: state.isCreateMode ? null : customizerBaseTrip(),
    selectedDayRefs: state.isCreateMode ? [] : timelineRefsForCustomizer(),
    disabled: forceDisabled || state.isCreateMode || !state.permissions.canEditTourVariants,
    emptyOptionsLabel: state.isCreateMode
      ? tourVariantT("create_from_list_first", "Create the Tour Variant from the Tour Variants page first.")
      : tourVariantT("no_optional_days", "No optional days are available for this route yet."),
    emptyTimelineLabel: state.isCreateMode
      ? tourVariantT("create_from_list_first", "Create the Tour Variant from the Tour Variants page first.")
      : tourVariantT("empty_timeline", "Add at least one day to keep customizing."),
    tourId: normalizeText(state.variant?.id) || "tour_variant_workspace",
    tourTitle: normalizeText(els.title?.value) || normalizeText(state.variant?.title) || tourVariantT("timeline", "Tour Variant timeline")
  };
}

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

function redirectToBackendLogin() {
  const authBase = String(apiBase || window.location.origin).replace(/\/$/, "");
  const loginParams = new URLSearchParams({
    return_to: window.location.href,
    prompt: "login"
  });
  window.location.href = `${authBase}/auth/login?${loginParams.toString()}`;
}

function handleUnauthorizedApiResponse() {
  const message = tourVariantT(
    "session_expired",
    "Your backend session expired. Sign in again to continue."
  );
  showError(message);
  setStatus(message);
  if (els.saveBtn instanceof HTMLButtonElement) els.saveBtn.disabled = true;
  if (backendLoginRedirectScheduled) return;
  backendLoginRedirectScheduled = true;
  window.setTimeout(() => {
    redirectToBackendLogin();
  }, 250);
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

function renderSelectOptions(select, values) {
  if (!(select instanceof HTMLSelectElement)) return;
  const currentValue = select.value || "";
  select.innerHTML = `<option value=""></option>${values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("")}`;
  select.value = currentValue;
}

function renderMonthOptions() {
  renderSelectOptions(els.seasonStart, MONTH_CODE_CATALOG || []);
  renderSelectOptions(els.seasonEnd, MONTH_CODE_CATALOG || []);
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
    `<option value="">${escapeHtml(baseTours.length
      ? tourVariantT("choose_base_marketing_tour", "Choose a base marketing tour")
      : tourVariantT("no_published_marketing_tours", "No published marketing tours"))}</option>`,
    ...baseTours.map((tour) => {
      const id = normalizeText(tour.id);
      return `<option value="${escapeHtml(id)}"${id === selectedValue ? " selected" : ""}>${escapeHtml(tour.title || id)} (${escapeHtml(String(tour.day_count || 0))})</option>`;
    })
  ].join("");
}

function renderIssues() {
  if (!els.issues) return;
  const issues = Array.isArray(state.variant?.publication?.issues) ? state.variant.publication.issues : [];
  els.issues.textContent = issues.length ? issues.join(" ") : "";
}

function resolveTravelPlanImageSrc(pathValue) {
  const normalized = normalizeText(pathValue);
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith("/")) return `${apiOrigin}${normalized}`;
  return normalized;
}

function normalizeTourCardImageIdList(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map((entry) => normalizeText(entry))
    .filter(Boolean)));
}

function selectedSourceDayForVariantDay(day) {
  const sourceDay = findSourceDayByKey(dayRefKey(day));
  return sourceDay?.source_day && typeof sourceDay.source_day === "object" && !Array.isArray(sourceDay.source_day)
    ? sourceDay.source_day
    : null;
}

function collectTourCardImageOptions() {
  const result = [];
  for (const [dayIndex, day] of timelineDays().entries()) {
    const sourceDay = selectedSourceDayForVariantDay(day);
    if (!sourceDay) continue;
    const dayLabel = tourVariantT("day", "Day {day}", { day: String(dayIndex + 1) });
    for (const [serviceIndex, service] of (Array.isArray(sourceDay?.services) ? sourceDay.services : []).entries()) {
      const image = service?.image && typeof service.image === "object" && !Array.isArray(service.image)
        ? service.image
        : null;
      const storagePath = normalizeText(image?.storage_path);
      const imageId = normalizeText(image?.id);
      if (!image || !storagePath || !imageId || image.is_customer_visible === false) continue;
      const serviceLabel = normalizeText(service?.title)
        || tourVariantT("service", "Service {service}", { service: String(serviceIndex + 1) });
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

function selectedTourCardImageIds(images = collectTourCardImageOptions()) {
  const availableIds = new Set((Array.isArray(images) ? images : []).map((image) => image.id));
  const hasStoredImageIds = Object.prototype.hasOwnProperty.call(state.variant || {}, "tour_card_image_ids");
  const storedIds = normalizeTourCardImageIdList(state.variant?.tour_card_image_ids)
    .filter((imageId) => availableIds.has(imageId));
  if (hasStoredImageIds) return storedIds;

  const legacyIds = (Array.isArray(images) ? images : [])
    .filter((image) => image.included)
    .map((image) => image.id);
  const storedPrimaryId = normalizeText(state.variant?.tour_card_primary_image_id);
  const primaryIndex = storedPrimaryId ? legacyIds.indexOf(storedPrimaryId) : -1;
  if (primaryIndex > 0) {
    const [primaryId] = legacyIds.splice(primaryIndex, 1);
    legacyIds.unshift(primaryId);
  }
  return legacyIds;
}

function applyTourCardImageSelectionToVariant(orderedImageIds) {
  if (!state.variant || typeof state.variant !== "object" || Array.isArray(state.variant)) return;
  const normalizedIds = normalizeTourCardImageIdList(orderedImageIds);
  state.variant.tour_card_image_ids = normalizedIds;
  state.variant.tour_card_primary_image_id = normalizedIds[0] || null;
}

function variantHasDayLocation() {
  return timelineDays().some((day) => {
    const sourceDay = selectedSourceDayForVariantDay(day);
    return Boolean(normalizeText(sourceDay?.primary_location_id) || normalizeText(sourceDay?.secondary_location_id));
  });
}

function tourVariantWebPagePublicationEligibility() {
  const images = collectTourCardImageOptions();
  const imageCount = selectedTourCardImageIds(images).length;
  const hasDayLocation = variantHasDayLocation();
  const hasEnoughImages = imageCount >= TOUR_WEB_PAGE_MIN_IMAGE_COUNT;
  const canPublish = hasDayLocation && hasEnoughImages;
  const message = canPublish
    ? backendT("tour.published_on_webpage", "Show on web page")
    : !hasDayLocation && !hasEnoughImages
      ? backendT("tour.published_on_webpage_disabled_location_and_images", "Select at least one travel-plan day location and at least 2 web page images before publishing on the web page.")
      : !hasDayLocation
        ? backendT("tour.published_on_webpage_disabled_location", "Select at least one travel-plan day location before publishing on the web page.")
        : backendT("tour.published_on_webpage_disabled_images", "Select at least 2 web page images before publishing on the web page.");
  return {
    canPublish,
    hasDayLocation,
    hasEnoughImages,
    imageCount,
    message
  };
}

function syncPublishedOnWebpageControl() {
  if (!(els.published instanceof HTMLInputElement)) return;
  const eligibility = state.sourceDaysLoaded
    ? tourVariantWebPagePublicationEligibility()
    : { canPublish: false, message: tourVariantT("loading", "Loading...") };
  if (!eligibility.canPublish) {
    els.published.checked = false;
  }
  els.published.disabled = !state.permissions.canEditTourVariants || state.isCreateMode || !eligibility.canPublish;
  els.published.title = eligibility.message;
  els.published.setAttribute("aria-disabled", els.published.disabled ? "true" : "false");
}

function renderTourCardImageThumb(image, selectedOrder, { selectable = false } = {}) {
  const selected = Number.isInteger(selectedOrder) && selectedOrder > 0;
  const title = selected
    ? backendT("tour.card_images.selected_order", "{label} is web page image {order}", { label: image.label, order: String(selectedOrder) })
    : selectable
      ? backendT("tour.card_images.select_for_web_page", "Add {label} to the web page images", { label: image.label })
      : backendT("tour.card_images.select_disabled", "{label} cannot be selected right now", { label: image.label });
  const canUseButton = state.permissions.canEditTourVariants && !state.isCreateMode;
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
      currentOrder.textContent = nextOrder.textContent || "";
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

function ensureTourCardImageSelectorShell() {
  if (!(els.tourCardImageSelector instanceof HTMLElement)) return null;
  let thumbs = els.tourCardImageSelector.querySelector("[data-tour-card-image-thumbs]");
  let clearButton = els.tourCardImageSelector.querySelector("[data-tour-card-clear-images]");
  if (!(thumbs instanceof HTMLElement) || !(clearButton instanceof HTMLButtonElement)) {
    els.tourCardImageSelector.innerHTML = `
      <div class="tour-card-image-selector__layout">
        <img class="tour-card-image-selector__preview" src="/assets/img/marketing_tour.png" alt="" aria-hidden="true" loading="lazy" />
        <div class="tour-card-image-selector__content">
          <button class="btn btn-ghost tour-card-image-selector__clear" type="button" data-tour-card-clear-images>${escapeHtml(backendT("tour.card_images.clear", "Clear selection"))}</button>
          <label class="backend-checkbox-item tour-variant-published-toggle" for="tourVariantPublished">
            <input id="tourVariantPublished" type="checkbox" />
            <span>${escapeHtml(backendT("tour.published_on_webpage", "Show on web page"))}</span>
          </label>
          <div class="tour-card-image-selector__thumbs" data-tour-card-image-thumbs></div>
        </div>
      </div>
    `;
    thumbs = els.tourCardImageSelector.querySelector("[data-tour-card-image-thumbs]");
    clearButton = els.tourCardImageSelector.querySelector("[data-tour-card-clear-images]");
    els.published = document.getElementById("tourVariantPublished");
  }
  if (!(thumbs instanceof HTMLElement) || !(clearButton instanceof HTMLButtonElement)) return null;
  return { clearButton, thumbs };
}

function renderTourCardImageSelector() {
  if (!(els.tourCardImageSelector instanceof HTMLElement)) return;
  const shell = ensureTourCardImageSelectorShell();
  if (!shell) return;
  if (!state.sourceDaysLoaded) {
    shell.clearButton.disabled = true;
    patchImageSelectorThumbs(shell.thumbs, `<span class="micro">${escapeHtml(tourVariantT("loading", "Loading..."))}</span>`);
    syncPublishedOnWebpageControl();
    return;
  }

  const images = collectTourCardImageOptions();
  const selectedIds = selectedTourCardImageIds(images);
  applyTourCardImageSelectionToVariant(selectedIds);
  const orderByImageId = new Map(selectedIds.map((imageId, index) => [imageId, index + 1]));
  const thumbsMarkup = images.length
    ? images
      .map((image) => renderTourCardImageThumb(image, orderByImageId.get(image.id) || 0, {
        selectable: state.permissions.canEditTourVariants && !state.isCreateMode
      }))
      .join("")
    : `<span class="micro">${escapeHtml(backendT("tour.card_images.none_available", "No service images are available for the web page."))}</span>`;
  shell.clearButton.disabled = !state.permissions.canEditTourVariants || state.isCreateMode || !selectedIds.length;
  const clearLabel = backendT("tour.card_images.clear", "Clear selection");
  if (shell.clearButton.textContent !== clearLabel) {
    shell.clearButton.textContent = clearLabel;
  }
  patchImageSelectorThumbs(shell.thumbs, thumbsMarkup);
  syncPublishedOnWebpageControl();
}

function selectTourCardImageForWebPage(imageId) {
  const normalizedImageId = normalizeText(imageId);
  if (!normalizedImageId || !state.permissions.canEditTourVariants || state.isCreateMode || !state.sourceDaysLoaded) return;
  const images = collectTourCardImageOptions();
  if (!images.some((image) => image.id === normalizedImageId)) {
    setStatus(backendT("tour.card_images.select_available_only", "Only available service images can be selected for the web page."));
    return;
  }
  const selectedIds = selectedTourCardImageIds(images);
  if (selectedIds.includes(normalizedImageId)) {
    setStatus(backendT("tour.card_images.already_selected", "This image is already selected for the web page."));
    return;
  }
  applyTourCardImageSelectionToVariant([...selectedIds, normalizedImageId]);
  renderTourCardImageSelector();
  handleDraftChanged();
  setStatus(backendT("tour.card_images.image_selected", "Web page image selected. Save changes to publish it."));
}

function clearTourCardImagesForWebPage() {
  if (!state.permissions.canEditTourVariants || state.isCreateMode || !state.sourceDaysLoaded) return;
  applyTourCardImageSelectionToVariant([]);
  renderTourCardImageSelector();
  handleDraftChanged();
  setStatus(backendT("tour.card_images.cleared", "Web page image selection cleared. Select images again, then save changes."));
}

function renderHeader() {
  const title = normalizeText(state.variant?.title) || (state.isCreateMode
    ? tourVariantT("new_title", "New Tour Variant")
    : tourVariantT("heading", "Tour Variant"));
  if (els.heading) els.heading.textContent = title;
  document.title = title;
}

function renderForm() {
  const variant = state.variant || {};
  renderHeader();
  renderMonthOptions();
  setInput(els.title, variant.title || "");
  setInput(els.shortDescription, variant.short_description || "");
  setInput(els.priority, variant.priority ?? 50);
  setInput(els.seasonStart, variant.seasonality_start_month || "");
  setInput(els.seasonEnd, variant.seasonality_end_month || "");
  if (els.published instanceof HTMLInputElement) els.published.checked = variant.published_on_webpage === true;
  renderStyleChoices(Array.isArray(variant.style_codes) && variant.style_codes.length ? variant.style_codes : variant.styles);
  renderBoundary("arrival");
  renderBoundary("departure");
  renderIssues();
  renderBaseTourOptions(normalizeText(qs.get("base_marketing_tour_id")) || variant.base_marketing_tour_id || "");
  renderCustomizer();
  markCurrentPayloadClean();
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

function sourceMarketingTourHref(sourceTourId) {
  const normalizedSourceTourId = normalizeText(sourceTourId);
  if (!normalizedSourceTourId) return "";
  return `${buildTourEditHref(normalizedSourceTourId)}#travel_plan_panel`;
}

function sourceMarketingTourDayLabel(sourceDay) {
  const sourceDayNumber = Number(sourceDay?.day_number || sourceDay?.source_day?.day_number);
  if (Number.isFinite(sourceDayNumber) && sourceDayNumber > 0) {
    return tourVariantT("day", "Day {day}", { day: String(sourceDayNumber) });
  }
  return normalizeText(sourceDay?.source_day_id);
}

function renderDaySummary() {
  if (!(els.daySummary instanceof HTMLElement)) return;
  const days = timelineDays();
  if (!days.length) {
    els.daySummary.innerHTML = `<p class="micro">${escapeHtml(tourVariantT("empty_timeline", "Add at least one day to keep customizing."))}</p>`;
    return;
  }
  els.daySummary.innerHTML = `
    <ol class="tour-variant-day-summary__list">
      ${days.map((day, index) => {
        const sourceDay = findSourceDayByKey(dayRefKey(day));
        const variantDayNumber = Number(day?.day_number) || index + 1;
        const dayTitle = normalizeText(sourceDay?.title || day?.source_day_title)
          || tourVariantT("untitled_day", "Untitled day");
        const sourceTourId = normalizeText(sourceDay?.source_tour_id || day?.source_tour_id);
        const sourceTourTitle = normalizeText(sourceDay?.source_tour_title || day?.source_tour_title || sourceTourId);
        const sourceDayLabel = sourceMarketingTourDayLabel(sourceDay || day);
        const sourceLabel = [sourceTourTitle, sourceDayLabel].filter(Boolean).join(" · ");
        const href = sourceMarketingTourHref(sourceTourId);
        return `
          <li class="tour-variant-day-summary__item">
            <span class="tour-variant-day-summary__number">${escapeHtml(tourVariantT("day", "Day {day}", { day: String(variantDayNumber) }))}</span>
            <span class="tour-variant-day-summary__title">${escapeHtml(dayTitle)}</span>
            <span class="tour-variant-day-summary__source">
              ${href && sourceLabel
                ? `<a href="${escapeHtml(href)}">${escapeHtml(sourceLabel)}</a>`
                : escapeHtml(sourceLabel || sourceTourId || day?.source_day_id || "")}
            </span>
          </li>
        `;
      }).join("")}
    </ol>
  `;
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
  handleDraftChanged();
}

function renderCustomizer() {
  renderDaySummary();
  renderTourCardImageSelector();
  const tripState = customizerTripState();
  void tourVariantMapPreview.setTripState({
    ...tripState,
    disabled: true
  }).then(() => {
    refreshMapPreviewStage();
  }).catch((error) => {
    console.error("[backend-tour-variant] Failed to render Tour Variant map preview.", error);
  });
  void tourVariantCustomizer.setTripState(tripState).catch((error) => {
    console.error("[backend-tour-variant] Failed to render Tour Variant customizer.", error);
  });
}

async function loadSourceDays() {
  state.sourceDaysLoaded = false;
  renderTourCardImageSelector();
  const payload = await fetchApi(withBackendApiLang("/api/v1/tour-variants/source-days", {
    limit: 1000
  }), {
    cache: "no-store"
  });
  if (!payload) return;
  state.allSourceDays = Array.isArray(payload.items) ? payload.items : [];
  state.sourceDaysLoaded = true;
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
    tour_card_primary_image_id: null,
    tour_card_image_ids: [],
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
  setStatus(tourVariantT("loading", "Loading..."));
  const payload = await fetchApi(withBackendApiLang(`/api/v1/tour-variants/${encodeURIComponent(state.id)}`), {
    cache: "no-store"
  });
  if (!payload?.tour_variant) return;
  state.variant = payload.tour_variant;
  state.options = payload.options && typeof payload.options === "object" ? payload.options : state.options;
  renderForm();
  await loadSourceDays();
  markCurrentPayloadClean();
  setStatus("");
}

function buildPayload() {
  const variant = state.variant || {};
  const tourCardImageIds = normalizeTourCardImageIdList(variant.tour_card_image_ids);
  const publishOnWebpage = Boolean(
    els.published instanceof HTMLInputElement
    && els.published.checked === true
    && state.sourceDaysLoaded
    && tourVariantWebPagePublicationEligibility().canPublish
  );
  return {
    expected_updated_at: normalizeText(variant.updated_at),
    title_i18n: localizedPairForSave(variant.title_i18n, variant.title, els.title?.value),
    short_description_i18n: localizedPairForSave(variant.short_description_i18n, variant.short_description, els.shortDescription?.value),
    styles: selectedStyleCodes(),
    seasonality_start_month: normalizeText(els.seasonStart?.value),
    seasonality_end_month: normalizeText(els.seasonEnd?.value),
    priority: Number.isFinite(Number(els.priority?.value)) ? Number(els.priority.value) : 50,
    tour_card_primary_image_id: tourCardImageIds[0] || null,
    tour_card_image_ids: tourCardImageIds,
    published_on_webpage: publishOnWebpage,
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

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function comparablePayload() {
  const payload = buildPayload();
  const { expected_updated_at: _expectedUpdatedAt, ...rest } = payload;
  return rest;
}

function currentPayloadSignature() {
  return stableStringify(comparablePayload());
}

function hasUnsavedTourVariantChanges() {
  if (!state.variant) return false;
  if (state.isCreateMode) {
    return Boolean(normalizeText(els.baseTour?.value || state.variant.base_marketing_tour_id));
  }
  return currentPayloadSignature() !== cleanPayloadSignature;
}

function updateSaveButtonState() {
  if (!(els.saveBtn instanceof HTMLButtonElement)) return;
  els.saveBtn.textContent = state.isCreateMode
    ? tourVariantT("create", "Create")
    : tourVariantT("save", "Save");
  const canSave = state.permissions.canEditTourVariants
    && !backendLoginRedirectScheduled
    && !isSavingTourVariant
    && hasUnsavedTourVariantChanges();
  els.saveBtn.disabled = !canSave;
}

function markCurrentPayloadClean() {
  cleanPayloadSignature = state.isCreateMode ? "" : currentPayloadSignature();
  updateSaveButtonState();
}

function handleDraftChanged() {
  if (!isSavingTourVariant) setStatus("");
  updateSaveButtonState();
}

async function createFromBase() {
  const baseMarketingTourId = normalizeText(els.baseTour?.value || state.variant?.base_marketing_tour_id);
  if (!baseMarketingTourId) {
    showError(tourVariantT("choose_base_marketing_tour", "Choose a base marketing tour."));
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
  if (isSavingTourVariant || !hasUnsavedTourVariantChanges()) {
    updateSaveButtonState();
    return;
  }
  clearError();
  isSavingTourVariant = true;
  updateSaveButtonState();
  if (state.isCreateMode) {
    try {
      await createFromBase();
    } finally {
      isSavingTourVariant = false;
      updateSaveButtonState();
    }
    return;
  }
  setStatus(tourVariantT("saving", "Saving..."));
  try {
    const payload = await fetchApi(withBackendApiLang(`/api/v1/tour-variants/${encodeURIComponent(state.id)}`), {
      method: "PATCH",
      body: buildPayload()
    });
    if (!payload?.tour_variant) {
      setStatus("");
      return;
    }
    state.variant = payload.tour_variant;
    renderForm();
    window.dispatchEvent(new CustomEvent("backend-public-site-publish-refresh", {
      detail: { dirty: true }
    }));
    setStatus(tourVariantT("saved", "Saved."));
  } finally {
    isSavingTourVariant = false;
    updateSaveButtonState();
  }
}

function handleBackendLanguageChanged() {
  updateCustomizerLabels();
  renderHeader();
  renderBaseTourOptions(normalizeText(qs.get("base_marketing_tour_id")) || state.variant?.base_marketing_tour_id || "");
  renderCustomizer();
  renderTourCardImageSelector();
  updateSaveButtonState();
}

function bindControls() {
  els.saveBtn?.addEventListener("click", () => {
    void saveTourVariant();
  });
  els.reloadBtn?.addEventListener("click", () => {
    void loadTourVariant();
  });
  els.mapPreview?.addEventListener("click", handleMapPreviewClick);
  els.mapPreview?.addEventListener("keydown", handleMapPreviewKeydown);
  els.customizerClose?.addEventListener("click", closeCustomizerOverlay);
  els.customizerOverlay?.addEventListener("keydown", handleCustomizerOverlayKeydown);
  els.tourCardImageSelector?.addEventListener("click", (event) => {
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
    }
  });
  [
    els.baseTour,
    els.title,
    els.shortDescription,
    els.priority,
    els.seasonStart,
    els.seasonEnd,
    els.published,
    els.arrivalMode,
    els.arrivalTitle,
    els.arrivalAirportCode,
    els.arrivalDetails,
    els.departureMode,
    els.departureTitle,
    els.departureAirportCode,
    els.departureDetails
  ].forEach((element) => {
    if (!(element instanceof HTMLElement)) return;
    element.addEventListener("input", handleDraftChanged);
    element.addEventListener("change", handleDraftChanged);
  });
  els.styles?.addEventListener("change", handleDraftChanged);
  window.addEventListener("backend-i18n-changed", handleBackendLanguageChanged);
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
      showError(tourVariantT("forbidden", "You do not have access to Tour Variants."));
      return;
    }
    await loadDestinationScopeCatalog();
    await loadTourVariant();
  } catch (error) {
    console.error("[backend-tour-variant] initialization failed", error);
    showError(error?.message || tourVariantT("load_failed", "Could not load Tour Variant."));
  } finally {
    setBackendPageLoadingOverlay(false);
  }
}

void init();
