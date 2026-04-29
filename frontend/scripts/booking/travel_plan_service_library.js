import {
  bookingTourApplyRequest,
  toursRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { bookingT } from "./i18n.js";
import { TRAVEL_PLAN_SERVICE_KIND_OPTIONS } from "../shared/generated_catalogs.js";
import { resolveTravelPlanImageSrc } from "./travel_plan_images.js";
import { normalizeDestinationScope } from "../shared/destination_scope_editor.js";

function normalizeText(value) {
  return String(value ?? "").trim();
}

const MIN_COPY_IMPORT_OVERLAY_MS = 500;

function waitForMs(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

async function waitForMinimumElapsed(startedAt, minimumMs) {
  const remainingMs = Math.max(0, (Number(minimumMs) || 0) - (Date.now() - Number(startedAt || 0)));
  if (remainingMs > 0) await waitForMs(remainingMs);
}

export function createBookingTravelPlanServiceLibraryModule(deps) {
  const {
    state,
    els,
    apiOrigin,
    fetchBookingMutation,
    getBookingRevision,
    escapeHtml,
    ensureTravelPlanReadyForMutation,
    finalizeTravelPlanMutation,
    collectTravelPlanPayload,
    findDraftDay,
    buildTravelPlanDaySearchRequest,
    buildTravelPlanServiceSearchRequest,
    buildTravelPlanDayImportRequest,
    buildTravelPlanServiceImportRequest,
    cloneTravelPlanDayForLocalImport,
    cloneTravelPlanServiceForLocalImport,
    applyLocalTravelPlanDraft,
    setPageOverlay,
    travelPlanLibrarySource = "marketing_tour"
  } = deps;

  const serviceLibraryState = {
    dayId: "",
    mode: "service",
    searchResults: [],
    searching: false
  };

  function isServiceLibraryMode() {
    return serviceLibraryState.mode === "service";
  }

  function isDayLibraryMode() {
    return serviceLibraryState.mode === "day";
  }

  function isTourLibraryMode() {
    return serviceLibraryState.mode === "tour";
  }

  function isMarketingTourLibrarySource() {
    return travelPlanLibrarySource === "marketing_tour";
  }

  function librarySourceId(item) {
    return normalizeText(item?.source_tour_id);
  }

  function librarySourceLabel(item) {
    return normalizeText(item?.source_tour_title)
      || normalizeText(item?.source_tour_name)
      || normalizeText(item?.source_tour_code)
      || librarySourceId(item);
  }

  function setTravelPlanLibraryStatus(message, type = "info") {
    if (!els.travelPlanServiceLibraryStatus) return;
    els.travelPlanServiceLibraryStatus.textContent = message;
    els.travelPlanServiceLibraryStatus.classList.remove(
      "booking-inline-status--error",
      "booking-inline-status--success",
      "booking-inline-status--info"
    );
    if (!message) return;
    const normalizedType = type === "error" || type === "success" ? type : "info";
    els.travelPlanServiceLibraryStatus.classList.add(`booking-inline-status--${normalizedType}`);
  }

  function cloneJson(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function resolveDirtyImportTargetTravelPlan() {
    if (state.travelPlanDirty !== true || typeof collectTravelPlanPayload !== "function") {
      return {
        aborted: false,
        skipPrepare: false,
        targetTravelPlan: null
      };
    }
    const collected = collectTravelPlanPayload({
      focusFirstInvalid: true,
      pruneEmptyContent: false
    });
    if (!collected?.ok) {
      setTravelPlanLibraryStatus(
        collected?.error || bookingT("booking.travel_plan.invalid", "Travel plan is invalid."),
        "error"
      );
      return {
        aborted: true,
        skipPrepare: true,
        targetTravelPlan: null
      };
    }
    return {
      aborted: false,
      skipPrepare: true,
      targetTravelPlan: collected.payload
    };
  }

  function collectCurrentTravelPlanForLocalInsert() {
    if (typeof collectTravelPlanPayload !== "function") return null;
    const collected = collectTravelPlanPayload({
      focusFirstInvalid: true,
      pruneEmptyContent: false
    });
    if (!collected?.ok) {
      setTravelPlanLibraryStatus(
        collected?.error || bookingT("booking.travel_plan.invalid", "Travel plan is invalid."),
        "error"
      );
      return null;
    }
    return collected.payload;
  }

  function mergeDestinationScopeIntoTravelPlan(plan, sourceScope) {
    return {
      ...(plan && typeof plan === "object" ? plan : {}),
      destination_scope: normalizeDestinationScope([
        ...normalizeDestinationScope(plan?.destination_scope),
        ...normalizeDestinationScope(sourceScope)
      ])
    };
  }

  function findTravelPlanDaySearchResult(sourceId, sourceDayId) {
    const normalizedSourceId = normalizeText(sourceId);
    const normalizedDayId = normalizeText(sourceDayId);
    return serviceLibraryState.searchResults.find((item) => (
      librarySourceId(item) === normalizedSourceId
      && normalizeText(item?.day_id) === normalizedDayId
    )) || null;
  }

  function findTravelPlanServiceSearchResult(sourceId, sourceServiceId) {
    const normalizedSourceId = normalizeText(sourceId);
    const normalizedServiceId = normalizeText(sourceServiceId);
    return serviceLibraryState.searchResults.find((item) => (
      librarySourceId(item) === normalizedSourceId
      && normalizeText(item?.service_id) === normalizedServiceId
    )) || null;
  }

  function canApplyLocalTravelPlanDayImport(searchResult) {
    return Boolean(
      typeof cloneTravelPlanDayForLocalImport === "function"
      && typeof applyLocalTravelPlanDraft === "function"
      && searchResult?.source_day
      && typeof searchResult.source_day === "object"
    );
  }

  function canApplyLocalTravelPlanServiceImport(searchResult) {
    return Boolean(
      typeof cloneTravelPlanServiceForLocalImport === "function"
      && typeof applyLocalTravelPlanDraft === "function"
      && searchResult?.source_service
      && typeof searchResult.source_service === "object"
    );
  }

  function applyLocalTravelPlanImport(nextPlan, successMessage) {
    closeTravelPlanServiceLibrary();
    applyLocalTravelPlanDraft(nextPlan);
    setTravelPlanLibraryStatus(successMessage, "success");
  }

  function populateTravelPlanServiceLibraryKindOptions() {
    if (!els.travelPlanServiceLibraryKind) return;
    const currentValue = String(els.travelPlanServiceLibraryKind.value || "").trim();
    els.travelPlanServiceLibraryKind.innerHTML = [
      `<option value="">${escapeHtml(bookingT("booking.travel_plan.all_kinds", "All kinds"))}</option>`,
      ...TRAVEL_PLAN_SERVICE_KIND_OPTIONS.map((option) => (
        `<option value="${escapeHtml(option.value)}">${escapeHtml(bookingT(`booking.travel_plan.kind.${option.value}`, option.label))}</option>`
      ))
    ].join("");
    if (currentValue) els.travelPlanServiceLibraryKind.value = currentValue;
  }

  function updateTravelPlanLibraryModeUi() {
    const kindField = els.travelPlanServiceLibraryKind?.closest(".field");
    if (kindField instanceof HTMLElement) {
      kindField.hidden = !isServiceLibraryMode();
    }
    if (els.travelPlanServiceLibraryTitle instanceof HTMLElement) {
      if (isTourLibraryMode()) {
        els.travelPlanServiceLibraryTitle.textContent = bookingT("booking.travel_plan.marketing_tours", "Marketing tours");
      } else {
        els.travelPlanServiceLibraryTitle.textContent = isDayLibraryMode()
          ? bookingT("booking.travel_plan.existing_days", "Existing days")
          : bookingT("booking.travel_plan.existing_services", "Existing services");
      }
    }
  }

  function normalizeTravelPlanLibrarySearchResults(items = []) {
    const rows = Array.isArray(items) ? items : [];
    const currentBookingId = String(state.booking?.id || state.id || "").trim();
    if (isTourLibraryMode()) {
      return rows.filter((item) => tourDays(item).length > 0);
    }
    if (isMarketingTourLibrarySource()) {
      return rows.filter((item) => {
        const sourceId = librarySourceId(item);
        return sourceId && sourceId !== currentBookingId;
      });
    }
    return rows.filter((item) => librarySourceId(item));
  }

  function currentTravelPlanHasDays() {
    return Array.isArray(state.travelPlanDraft?.days) && state.travelPlanDraft.days.length > 0;
  }

  function tourDays(item) {
    return Array.isArray(item?.travel_plan?.days) ? item.travel_plan.days : [];
  }

  function tourServices(item) {
    return tourDays(item).flatMap((day) => (Array.isArray(day?.services) ? day.services : []));
  }

  function tourThumbnailUrl(item) {
    const services = tourServices(item);
    const thumbnailService = services.find((service) => String(service?.image?.storage_path || "").trim()) || services[0] || null;
    return String(thumbnailService?.image?.storage_path || item?.image || "").trim();
  }

  function travelPlanServiceImageUrls(service) {
    const images = [];
    if (service?.image && typeof service.image === "object" && !Array.isArray(service.image)) {
      images.push(service.image);
    }
    if (Array.isArray(service?.images)) {
      images.push(...service.images);
    }
    const seen = new Set();
    return images
      .filter((image) => image && typeof image === "object")
      .sort((left, right) => Number(left?.sort_order || 0) - Number(right?.sort_order || 0))
      .map((image) => String(image?.storage_path || "").trim())
      .filter((url) => {
        if (!url || seen.has(url)) return false;
        seen.add(url);
        return true;
      });
  }

  function tourThumbnailUrls(item) {
    const urls = tourServices(item).flatMap((service) => travelPlanServiceImageUrls(service));
    if (!urls.length) {
      const fallbackUrl = tourThumbnailUrl(item);
      return fallbackUrl ? [fallbackUrl] : [];
    }
    return urls;
  }

  function libraryThumbnailUrls(item) {
    const urls = Array.isArray(item?.thumbnail_urls)
      ? item.thumbnail_urls.map((url) => String(url || "").trim()).filter(Boolean)
      : [];
    const fallbackUrl = String(item?.thumbnail_url || "").trim();
    if (!urls.length && fallbackUrl) urls.push(fallbackUrl);
    return Array.from(new Set(urls));
  }

  function renderTravelPlanLibraryCardMedia(urls, altText) {
    const normalizedUrls = Array.isArray(urls) ? urls.map((url) => String(url || "").trim()).filter(Boolean) : [];
    if (!normalizedUrls.length) {
      return `<div class="travel-plan-library-card__placeholder">${escapeHtml(bookingT("booking.travel_plan.no_image", "No image"))}</div>`;
    }
    if (normalizedUrls.length === 1) {
      return `<img src="${escapeHtml(resolveTravelPlanImageSrc(normalizedUrls[0], apiOrigin))}" alt="${escapeHtml(altText)}" loading="lazy" />`;
    }
    return `
      <div class="travel-plan-library-card__image-cycle" style="--travel-plan-library-image-count: ${normalizedUrls.length};">
        ${normalizedUrls.map((url, index) => `
          <img
            src="${escapeHtml(resolveTravelPlanImageSrc(url, apiOrigin))}"
            alt="${index === 0 ? escapeHtml(altText) : ""}"
            loading="lazy"
            style="--travel-plan-library-image-index: ${index};"
          />
        `).join("")}
      </div>
    `;
  }

  function renderTravelPlanServiceLibraryResults(items = []) {
    if (!els.travelPlanServiceLibraryResults) return;
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      els.travelPlanServiceLibraryResults.innerHTML = `
        <div class="travel-plan-library-modal__empty">
          ${escapeHtml(bookingT(
            isTourLibraryMode()
              ? "booking.travel_plan.no_marketing_tours"
              : (isDayLibraryMode() ? "booking.travel_plan.no_existing_days" : "booking.travel_plan.no_existing_items"),
            isTourLibraryMode()
              ? "No matching marketing tours found."
              : (isDayLibraryMode() ? "No matching days found." : "No matching services found.")
          ))}
        </div>
      `;
      return;
    }
    if (isTourLibraryMode()) {
      const tourActionLabel = currentTravelPlanHasDays()
        ? bookingT("booking.travel_plan.append", "Append")
        : bookingT("booking.travel_plan.use_action", "Use");
      els.travelPlanServiceLibraryResults.innerHTML = rows.map((item) => {
        const destinations = Array.isArray(item?.destinations) ? item.destinations : [];
        const days = tourDays(item);
        const services = tourServices(item);
        const thumbnailUrls = tourThumbnailUrls(item);
        const thumbnailAlt = item.title || bookingT("booking.travel_plan.marketing_tours", "Marketing tours");
        return `
          <article class="travel-plan-library-card">
            <div class="travel-plan-library-card__media">
              ${renderTravelPlanLibraryCardMedia(thumbnailUrls, thumbnailAlt)}
            </div>
            <div class="travel-plan-library-card__content">
              <div class="travel-plan-library-card__eyebrow">
                ${escapeHtml(destinations.join(", "))}
              </div>
              <h3>${escapeHtml(item.title || bookingT("booking.travel_plan.marketing_tours", "Marketing tours"))}</h3>
              <div class="travel-plan-library-card__meta">
                <span>${escapeHtml(bookingT(days.length === 1 ? "booking.travel_plan.summary.day" : "booking.travel_plan.summary.days", "{count} days", { count: days.length }))}</span>
                <span>${escapeHtml(bookingT(services.length === 1 ? "booking.travel_plan.summary.item" : "booking.travel_plan.summary.items", "{count} services", { count: services.length }))}</span>
              </div>
            </div>
            <div class="travel-plan-library-card__actions">
              <button
                class="btn btn-primary"
                data-travel-plan-apply-tour="${escapeHtml(item.id || "")}"
                data-requires-clean-state
                type="button"
              >${escapeHtml(tourActionLabel)}</button>
            </div>
          </article>
        `;
      }).join("");
      return;
    }
    if (isDayLibraryMode()) {
      els.travelPlanServiceLibraryResults.innerHTML = rows.map((item) => `
        <article class="travel-plan-library-card travel-plan-library-card--leading-action">
          <div class="travel-plan-library-card__actions">
            <button
              class="btn btn-primary"
              data-travel-plan-import-source-id="${escapeHtml(librarySourceId(item))}"
              data-travel-plan-import-source-day="${escapeHtml(item.day_id || "")}"
              type="button"
            >${escapeHtml(bookingT("booking.travel_plan.insert_as_copy", "Use"))}</button>
          </div>
          <div class="travel-plan-library-card__media">
            ${renderTravelPlanLibraryCardMedia(libraryThumbnailUrls(item), item.title || bookingT("booking.travel_plan.day_heading", "Day"))}
          </div>
          <div class="travel-plan-library-card__content">
            <div class="travel-plan-library-card__eyebrow">
              ${escapeHtml(librarySourceLabel(item))}
            </div>
            <h3>${escapeHtml(item.title || bookingT("booking.travel_plan.day_heading", "Day"))}</h3>
            <p>${escapeHtml(item.overnight_location || item.notes || "")}</p>
            <div class="travel-plan-library-card__meta">
              ${Number.isFinite(Number(item.service_count)) ? `<span>${escapeHtml(bookingT("booking.travel_plan.service_count", "{count} service(s)", { count: Number(item.service_count) }))}</span>` : ""}
              ${Number(item.image_count) > 0 ? `<span>${escapeHtml(bookingT("booking.travel_plan.image_count", "{count} images", { count: Number(item.image_count) }))}</span>` : ""}
            </div>
          </div>
        </article>
      `).join("");
      return;
    }
    els.travelPlanServiceLibraryResults.innerHTML = rows.map((item) => `
      <article class="travel-plan-library-card travel-plan-library-card--leading-action">
        <div class="travel-plan-library-card__actions">
          <button
            class="btn btn-primary"
            data-travel-plan-import-source-id="${escapeHtml(librarySourceId(item))}"
            data-travel-plan-import-source-service="${escapeHtml(item.service_id || "")}"
            type="button"
          >${escapeHtml(bookingT("booking.travel_plan.insert_as_copy", "Use"))}</button>
        </div>
        <div class="travel-plan-library-card__media">
          ${renderTravelPlanLibraryCardMedia(libraryThumbnailUrls(item), item.title || bookingT("booking.travel_plan.item_title", "Service title"))}
        </div>
        <div class="travel-plan-library-card__content">
          <div class="travel-plan-library-card__eyebrow">
            ${escapeHtml(librarySourceLabel(item))}
          </div>
          <h3>${escapeHtml(item.title || bookingT("booking.travel_plan.item_title", "Service title"))}</h3>
          <p>${escapeHtml(item.location || item.overnight_location || item.details || "")}</p>
          <div class="travel-plan-library-card__meta">
            ${item.service_kind ? `<span>${escapeHtml(bookingT(`booking.travel_plan.kind.${String(item.service_kind).toLowerCase()}`, item.service_kind))}</span>` : ""}
            ${Number(item.image_count) > 0 ? `<span>${escapeHtml(bookingT("booking.travel_plan.image_count", "{count} images", { count: Number(item.image_count) }))}</span>` : ""}
          </div>
        </div>
      </article>
    `).join("");
  }

  function closeTravelPlanServiceLibrary() {
    serviceLibraryState.dayId = "";
    serviceLibraryState.mode = "service";
    serviceLibraryState.searchResults = [];
    if (els.travelPlanServiceLibraryModal) els.travelPlanServiceLibraryModal.hidden = true;
    if (els.travelPlanServiceLibraryResults) els.travelPlanServiceLibraryResults.innerHTML = "";
    setTravelPlanLibraryStatus("");
    updateTravelPlanLibraryModeUi();
  }

  function openTravelPlanServiceLibrary(dayId) {
    if (!state.permissions.canEditBooking || !els.travelPlanServiceLibraryModal) return;
    serviceLibraryState.mode = "service";
    serviceLibraryState.dayId = String(dayId || "").trim();
    const day = findDraftDay(serviceLibraryState.dayId);
    updateTravelPlanLibraryModeUi();
    if (els.travelPlanServiceLibraryQuery && !els.travelPlanServiceLibraryQuery.value) {
      els.travelPlanServiceLibraryQuery.value = String(day?.overnight_location || "").trim();
    }
    serviceLibraryState.searchResults = [];
    renderTravelPlanServiceLibraryResults([]);
    setTravelPlanLibraryStatus("");
    els.travelPlanServiceLibraryModal.hidden = false;
    window.setTimeout(() => {
      els.travelPlanServiceLibraryQuery?.focus();
      els.travelPlanServiceLibraryQuery?.select?.();
    }, 0);
    void searchTravelPlanServices();
  }

  function openTravelPlanDayLibrary() {
    if (!state.permissions.canEditBooking || !els.travelPlanServiceLibraryModal) return;
    serviceLibraryState.mode = "day";
    serviceLibraryState.dayId = "";
    updateTravelPlanLibraryModeUi();
    serviceLibraryState.searchResults = [];
    renderTravelPlanServiceLibraryResults([]);
    setTravelPlanLibraryStatus("");
    els.travelPlanServiceLibraryModal.hidden = false;
    window.setTimeout(() => {
      els.travelPlanServiceLibraryQuery?.focus();
      els.travelPlanServiceLibraryQuery?.select?.();
    }, 0);
    void searchTravelPlanServices();
  }

  function openTourLibrary() {
    if (!state.permissions.canEditBooking || !els.travelPlanServiceLibraryModal) return;
    serviceLibraryState.mode = "tour";
    serviceLibraryState.dayId = "";
    updateTravelPlanLibraryModeUi();
    serviceLibraryState.searchResults = [];
    renderTravelPlanServiceLibraryResults([]);
    setTravelPlanLibraryStatus("");
    els.travelPlanServiceLibraryModal.hidden = false;
    window.setTimeout(() => {
      els.travelPlanServiceLibraryQuery?.focus();
      els.travelPlanServiceLibraryQuery?.select?.();
    }, 0);
    void searchTravelPlanServices();
  }

  async function searchTravelPlanServices() {
    if (!els.travelPlanServiceLibraryResults || serviceLibraryState.searching) return;
    serviceLibraryState.searching = true;
    const query = String(els.travelPlanServiceLibraryQuery?.value || "").trim();
    const kind = String(els.travelPlanServiceLibraryKind?.value || "").trim();
    setTravelPlanLibraryStatus(bookingT(
      isTourLibraryMode()
        ? "booking.travel_plan.searching_marketing_tours"
        : (isDayLibraryMode() ? "booking.travel_plan.searching_days" : "booking.travel_plan.searching_items"),
      isTourLibraryMode()
        ? "Searching marketing tours..."
        : (isDayLibraryMode() ? "Searching days..." : "Searching services...")
    ), "info");
    const request = isTourLibraryMode()
      ? toursRequest({
          baseURL: apiOrigin,
          query: {
            ...(query ? { search: query } : {}),
            page_size: 30
          }
        })
      : (isDayLibraryMode()
      ? (typeof buildTravelPlanDaySearchRequest === "function"
          ? buildTravelPlanDaySearchRequest({ apiOrigin, state, query })
          : null)
      : (typeof buildTravelPlanServiceSearchRequest === "function"
          ? buildTravelPlanServiceSearchRequest({ apiOrigin, state, query, kind })
          : null));
    if (!request?.url) {
      serviceLibraryState.searching = false;
      setTravelPlanLibraryStatus(bookingT("booking.travel_plan.search_failed", "Could not search existing services."), "error");
      return;
    }
    try {
      const result = await fetchBookingMutation(request.url, { method: request.method });
      if (!result) {
        setTravelPlanLibraryStatus(bookingT(
          isTourLibraryMode()
            ? "booking.travel_plan.marketing_tour_search_failed"
            : (isDayLibraryMode() ? "booking.travel_plan.day_search_failed" : "booking.travel_plan.search_failed"),
          isTourLibraryMode()
            ? "Could not search marketing tours."
            : (isDayLibraryMode() ? "Could not search existing days." : "Could not search existing services.")
        ), "error");
        return;
      }
      serviceLibraryState.searchResults = normalizeTravelPlanLibrarySearchResults(Array.isArray(result.items) ? result.items : []);
      renderTravelPlanServiceLibraryResults(serviceLibraryState.searchResults);
      setTravelPlanLibraryStatus(
        serviceLibraryState.searchResults.length
          ? bookingT(
              isTourLibraryMode()
                ? "booking.travel_plan.marketing_tour_search_results_found"
                : (isDayLibraryMode() ? "booking.travel_plan.day_search_results_found" : "booking.travel_plan.search_results_found"),
              isTourLibraryMode()
                ? "{count} marketing tour(s) found."
                : (isDayLibraryMode() ? "{count} day(s) found." : "{count} service(s) found."),
              { count: serviceLibraryState.searchResults.length }
            )
          : bookingT(
              isTourLibraryMode()
                ? "booking.travel_plan.no_marketing_tours"
                : (isDayLibraryMode() ? "booking.travel_plan.no_existing_days" : "booking.travel_plan.no_existing_items"),
              isTourLibraryMode()
                ? "No matching marketing tours found."
                : (isDayLibraryMode() ? "No matching days found." : "No matching services found.")
            ),
        serviceLibraryState.searchResults.length ? "success" : "info"
      );
    } finally {
      serviceLibraryState.searching = false;
    }
  }

  async function importTravelPlanDay(sourceId, sourceDayId) {
    if (!sourceId || !sourceDayId) return;
    const insertingMessage = bookingT("booking.travel_plan.inserting_day", "Inserting day...");
    const overlayStartedAt = Date.now();
    setTravelPlanLibraryStatus(insertingMessage, "info");
    if (typeof setPageOverlay === "function") {
      setPageOverlay(true, insertingMessage);
    }
    try {
      const searchResult = findTravelPlanDaySearchResult(sourceId, sourceDayId);
      if (canApplyLocalTravelPlanDayImport(searchResult)) {
        const currentTravelPlan = collectCurrentTravelPlanForLocalInsert();
        if (!currentTravelPlan) return;
        const importedDay = cloneTravelPlanDayForLocalImport({
          searchResult: cloneJson(searchResult),
          targetTravelPlan: cloneJson(currentTravelPlan),
          targetDayIndex: Array.isArray(currentTravelPlan?.days) ? currentTravelPlan.days.length : 0
        });
        if (!importedDay || typeof importedDay !== "object") {
          setTravelPlanLibraryStatus(bookingT("booking.travel_plan.day_insert_failed", "Could not insert this day."), "error");
          return;
        }
        const nextTravelPlan = mergeDestinationScopeIntoTravelPlan({
          ...cloneJson(currentTravelPlan),
          days: [
            ...(Array.isArray(currentTravelPlan?.days) ? currentTravelPlan.days : []),
            importedDay
          ]
        }, searchResult.source_destination_scope);
        applyLocalTravelPlanImport(nextTravelPlan, bookingT("booking.travel_plan.day_inserted", "Day inserted."));
        return;
      }
      const draftTarget = resolveDirtyImportTargetTravelPlan();
      if (draftTarget.aborted) return;
      if (!draftTarget.skipPrepare && !(await ensureTravelPlanReadyForMutation())) return;
      const request = typeof buildTravelPlanDayImportRequest === "function"
        ? buildTravelPlanDayImportRequest({
            apiOrigin,
            state,
            sourceTourId: sourceId,
            sourceDayId,
            getBookingRevision,
            targetTravelPlan: draftTarget.targetTravelPlan
          })
        : null;
      if (!request?.url) {
        setTravelPlanLibraryStatus(bookingT("booking.travel_plan.day_insert_failed", "Could not insert this day."), "error");
        return;
      }
      const result = await fetchBookingMutation(request.url, {
        method: request.method,
        body: request.body
      });
      if (!result?.booking) {
        setTravelPlanLibraryStatus(bookingT("booking.travel_plan.day_insert_failed", "Could not insert this day."), "error");
        return;
      }
      closeTravelPlanServiceLibrary();
      await finalizeTravelPlanMutation(result, bookingT("booking.travel_plan.day_inserted", "Day inserted."));
    } finally {
      if (typeof setPageOverlay === "function") {
        await waitForMinimumElapsed(overlayStartedAt, MIN_COPY_IMPORT_OVERLAY_MS);
        setPageOverlay(false);
      }
    }
  }

  async function importTravelPlanService(sourceId, sourceServiceId) {
    if (!serviceLibraryState.dayId || !sourceId || !sourceServiceId) return;
    const insertingMessage = bookingT("booking.travel_plan.inserting_item", "Inserting service...");
    const overlayStartedAt = Date.now();
    setTravelPlanLibraryStatus(insertingMessage, "info");
    if (typeof setPageOverlay === "function") {
      setPageOverlay(true, insertingMessage);
    }
    try {
      const searchResult = findTravelPlanServiceSearchResult(sourceId, sourceServiceId);
      if (canApplyLocalTravelPlanServiceImport(searchResult)) {
        const currentTravelPlan = collectCurrentTravelPlanForLocalInsert();
        if (!currentTravelPlan) return;
        const targetDays = Array.isArray(currentTravelPlan?.days) ? [...currentTravelPlan.days] : [];
        const targetDayIndex = targetDays.findIndex((day) => normalizeText(day?.id) === serviceLibraryState.dayId);
        if (targetDayIndex < 0) {
          setTravelPlanLibraryStatus(bookingT("booking.travel_plan.insert_failed", "Could not insert service."), "error");
          return;
        }
        const importedService = cloneTravelPlanServiceForLocalImport({
          searchResult: cloneJson(searchResult),
          targetTravelPlan: cloneJson(currentTravelPlan),
          targetDay: cloneJson(targetDays[targetDayIndex]),
          targetDayIndex
        });
        if (!importedService || typeof importedService !== "object") {
          setTravelPlanLibraryStatus(bookingT("booking.travel_plan.insert_failed", "Could not insert service."), "error");
          return;
        }
        const targetServices = Array.isArray(targetDays[targetDayIndex]?.services)
          ? [...targetDays[targetDayIndex].services]
          : [];
        targetServices.push(importedService);
        targetDays[targetDayIndex] = {
          ...targetDays[targetDayIndex],
          services: targetServices
        };
        const nextTravelPlan = mergeDestinationScopeIntoTravelPlan({
          ...cloneJson(currentTravelPlan),
          days: targetDays
        }, searchResult.source_destination_scope);
        applyLocalTravelPlanImport(nextTravelPlan, bookingT("booking.travel_plan.item_inserted", "Service inserted."));
        return;
      }
      const draftTarget = resolveDirtyImportTargetTravelPlan();
      if (draftTarget.aborted) return;
      if (!draftTarget.skipPrepare && !(await ensureTravelPlanReadyForMutation())) return;
      const request = typeof buildTravelPlanServiceImportRequest === "function"
        ? buildTravelPlanServiceImportRequest({
            apiOrigin,
            state,
            targetDayId: serviceLibraryState.dayId,
            sourceTourId: sourceId,
            sourceServiceId,
            getBookingRevision,
            targetTravelPlan: draftTarget.targetTravelPlan
          })
        : null;
      if (!request?.url) {
        setTravelPlanLibraryStatus(bookingT("booking.travel_plan.insert_failed", "Could not insert service."), "error");
        return;
      }
      const result = await fetchBookingMutation(request.url, {
        method: request.method,
        body: request.body
      });
      if (!result?.booking) {
        setTravelPlanLibraryStatus(bookingT("booking.travel_plan.insert_failed", "Could not insert service."), "error");
        return;
      }
      closeTravelPlanServiceLibrary();
      await finalizeTravelPlanMutation(result, bookingT("booking.travel_plan.item_inserted", "Service inserted."));
    } finally {
      if (typeof setPageOverlay === "function") {
        await waitForMinimumElapsed(overlayStartedAt, MIN_COPY_IMPORT_OVERLAY_MS);
        setPageOverlay(false);
      }
    }
  }

  async function applyTour(tourId) {
    if (!tourId) return;
    if (!(await ensureTravelPlanReadyForMutation())) return;
    const draftDays = Array.isArray(state.travelPlanDraft?.days) ? state.travelPlanDraft.days : [];
    const existingServiceCount = draftDays.reduce(
      (total, day) => total + (Array.isArray(day?.services) ? day.services.length : 0),
      0
    );
    if ((draftDays.length > 0 || existingServiceCount > 0) && window.confirm(
      bookingT(
        "booking.travel_plan.confirm_replace_with_marketing_tour",
        "Use this marketing tour and replace the current travel plan?"
      )
    ) !== true) {
      return;
    }
    setTravelPlanLibraryStatus(bookingT("booking.travel_plan.applying_marketing_tour", "Applying marketing tour..."), "info");
    const request = bookingTourApplyRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        tour_id: tourId
      },
      body: {
        expected_travel_plan_revision: getBookingRevision("travel_plan_revision"),
        actor: state.user
      }
    });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: request.body
    });
    if (!result?.booking) {
      setTravelPlanLibraryStatus(bookingT("booking.travel_plan.apply_marketing_tour_failed", "Could not apply this marketing tour."), "error");
      return;
    }
    closeTravelPlanServiceLibrary();
    await finalizeTravelPlanMutation(result, bookingT("booking.travel_plan.marketing_tour_applied", "Marketing tour applied."));
  }

  function bindTravelPlanServiceLibrary() {
    if (els.travelPlanServiceLibraryModal && els.travelPlanServiceLibraryModal.dataset.travelPlanBound !== "true") {
      els.travelPlanServiceLibraryCloseBtn?.addEventListener("click", closeTravelPlanServiceLibrary);
      els.travelPlanServiceLibrarySearchBtn?.addEventListener("click", () => {
        void searchTravelPlanServices();
      });
      els.travelPlanServiceLibraryQuery?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void searchTravelPlanServices();
        }
      });
      els.travelPlanServiceLibraryModal.addEventListener("click", (event) => {
        if (event.target === els.travelPlanServiceLibraryModal) {
          closeTravelPlanServiceLibrary();
          return;
        }
        const button = event.target.closest("button");
        if (!button) return;
        if (button.hasAttribute("data-travel-plan-import-source-day")) {
          void importTravelPlanDay(
            button.getAttribute("data-travel-plan-import-source-id"),
            button.getAttribute("data-travel-plan-import-source-day")
          );
          return;
        }
        if (button.hasAttribute("data-travel-plan-apply-tour")) {
          void applyTour(button.getAttribute("data-travel-plan-apply-tour"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-import-source-id")) {
          void importTravelPlanService(
            button.getAttribute("data-travel-plan-import-source-id"),
            button.getAttribute("data-travel-plan-import-source-service")
          );
        }
      });
      els.travelPlanServiceLibraryModal.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeTravelPlanServiceLibrary();
        }
      });
      els.travelPlanServiceLibraryModal.dataset.travelPlanBound = "true";
    }
  }

  return {
    bindTravelPlanServiceLibrary,
    closeTravelPlanServiceLibrary,
    applyTour,
    importTravelPlanDay,
    importTravelPlanService,
    openTourLibrary,
    openTravelPlanDayLibrary,
    openTravelPlanServiceLibrary,
    populateTravelPlanServiceLibraryKindOptions,
    renderTravelPlanServiceLibraryResults,
    searchTravelPlanServices
  };
}
