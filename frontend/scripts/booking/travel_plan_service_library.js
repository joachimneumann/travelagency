import {
  bookingTravelPlanImportRequest,
  bookingTravelPlanDayImportRequest,
  bookingTravelPlanServiceImportRequest,
  travelPlanSearchRequest,
  travelPlanDaySearchRequest,
  travelPlanServiceSearchRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { bookingT } from "./i18n.js";
import { TRAVEL_PLAN_SERVICE_KIND_OPTIONS } from "../shared/generated_catalogs.js";
import { resolveTravelPlanImageSrc } from "./travel_plan_images.js";

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
    findDraftDay
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

  function isPlanLibraryMode() {
    return serviceLibraryState.mode === "plan";
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
      if (isPlanLibraryMode()) {
        els.travelPlanServiceLibraryTitle.textContent = bookingT("booking.travel_plan.existing_travel_plans", "Existing travel plans");
      } else {
        els.travelPlanServiceLibraryTitle.textContent = isDayLibraryMode()
          ? bookingT("booking.travel_plan.existing_days", "Existing days")
          : bookingT("booking.travel_plan.existing_services", "Existing services");
      }
    }
  }

  function prioritizeCurrentBookingResults(items = []) {
    const currentBookingId = String(state.booking?.id || "").trim();
    if (!currentBookingId || !Array.isArray(items) || !items.length) return Array.isArray(items) ? items : [];
    const prioritized = [];
    const remaining = [];
    items.forEach((item) => {
      const sourceBookingId = String(item?.source_booking_id || "").trim();
      if (sourceBookingId && sourceBookingId === currentBookingId) {
        prioritized.push(item);
        return;
      }
      remaining.push(item);
    });
    return [...prioritized, ...remaining];
  }

  function normalizeTravelPlanLibrarySearchResults(items = []) {
    const rows = Array.isArray(items) ? items : [];
    const currentBookingId = String(state.booking?.id || "").trim();
    if (isPlanLibraryMode()) {
      return rows.filter((item) => String(item?.source_booking_id || "").trim() !== currentBookingId);
    }
    return prioritizeCurrentBookingResults(rows);
  }

  function formatTravelPlanLibraryDateRange(item) {
    const firstDate = String(item?.first_date || "").trim();
    const lastDate = String(item?.last_date || "").trim();
    if (firstDate && lastDate) {
      return firstDate === lastDate ? firstDate : `${firstDate} - ${lastDate}`;
    }
    return firstDate || lastDate || "";
  }

  function renderTravelPlanServiceLibraryResults(items = []) {
    if (!els.travelPlanServiceLibraryResults) return;
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      els.travelPlanServiceLibraryResults.innerHTML = `
        <div class="travel-plan-library-modal__empty">
          ${escapeHtml(bookingT(
            isPlanLibraryMode()
              ? "booking.travel_plan.no_existing_plans"
              : (isDayLibraryMode() ? "booking.travel_plan.no_existing_days" : "booking.travel_plan.no_existing_items"),
            isPlanLibraryMode()
              ? "No matching travel plans found."
              : (isDayLibraryMode() ? "No matching days found." : "No matching services found.")
          ))}
        </div>
      `;
      return;
    }
    if (isPlanLibraryMode()) {
      els.travelPlanServiceLibraryResults.innerHTML = rows.map((item) => {
        const dateRange = formatTravelPlanLibraryDateRange(item);
        const previewText = item.title_preview || item.overnight_preview || "";
        return `
          <article class="travel-plan-library-card">
            <div class="travel-plan-library-card__media">
              ${item.thumbnail_url
                ? `<img src="${escapeHtml(resolveTravelPlanImageSrc(item.thumbnail_url, apiOrigin))}" alt="${escapeHtml(previewText || item.source_booking_name || bookingT("booking.travel_plan", "Travel plan"))}" loading="lazy" />`
                : `<div class="travel-plan-library-card__placeholder">${escapeHtml(bookingT("booking.travel_plan.no_image", "No image"))}</div>`}
            </div>
            <div class="travel-plan-library-card__content">
              <div class="travel-plan-library-card__eyebrow">
                ${escapeHtml(item.source_booking_name || item.source_booking_id || "")}
              </div>
              <h3>${escapeHtml(dateRange || bookingT("booking.travel_plan", "Travel plan"))}</h3>
              <p>${escapeHtml(previewText)}</p>
              <div class="travel-plan-library-card__meta">
                ${Number.isFinite(Number(item.day_count)) ? `<span>${escapeHtml(bookingT(Number(item.day_count) === 1 ? "booking.travel_plan.summary.day" : "booking.travel_plan.summary.days", "{count} days", { count: Number(item.day_count) }))}</span>` : ""}
                ${Number.isFinite(Number(item.service_count)) ? `<span>${escapeHtml(bookingT(Number(item.service_count) === 1 ? "booking.travel_plan.summary.item" : "booking.travel_plan.summary.items", "{count} services", { count: Number(item.service_count) }))}</span>` : ""}
              </div>
            </div>
            <div class="travel-plan-library-card__actions">
              <button
                class="btn btn-primary"
                data-travel-plan-import-source-plan-booking="${escapeHtml(item.source_booking_id || "")}"
                data-requires-clean-state
                type="button"
              >${escapeHtml(bookingT("booking.travel_plan.append", "Append"))}</button>
            </div>
          </article>
        `;
      }).join("");
      return;
    }
    if (isDayLibraryMode()) {
      els.travelPlanServiceLibraryResults.innerHTML = rows.map((item) => `
        <article class="travel-plan-library-card">
          <div class="travel-plan-library-card__media">
            ${item.thumbnail_url
              ? `<img src="${escapeHtml(resolveTravelPlanImageSrc(item.thumbnail_url, apiOrigin))}" alt="${escapeHtml(item.title || bookingT("booking.travel_plan.day_heading", "Day"))}" loading="lazy" />`
              : `<div class="travel-plan-library-card__placeholder">${escapeHtml(bookingT("booking.travel_plan.no_image", "No image"))}</div>`}
          </div>
          <div class="travel-plan-library-card__content">
            <div class="travel-plan-library-card__eyebrow">
              ${escapeHtml(item.source_booking_name || item.source_booking_id || "")}
            </div>
            <h3>${escapeHtml(item.title || bookingT("booking.travel_plan.day_heading", "Day"))}</h3>
            <p>${escapeHtml(item.overnight_location || item.notes || "")}</p>
            <div class="travel-plan-library-card__meta">
              ${Number.isFinite(Number(item.service_count)) ? `<span>${escapeHtml(bookingT("booking.travel_plan.service_count", "{count} service(s)", { count: Number(item.service_count) }))}</span>` : ""}
              ${Number(item.image_count) > 0 ? `<span>${escapeHtml(bookingT("booking.travel_plan.image_count", "{count} images", { count: Number(item.image_count) }))}</span>` : ""}
            </div>
          </div>
          <div class="travel-plan-library-card__actions">
            <button
              class="btn btn-primary"
              data-travel-plan-import-source-booking="${escapeHtml(item.source_booking_id || "")}"
              data-travel-plan-import-source-day="${escapeHtml(item.day_id || "")}"
              data-requires-clean-state
              type="button"
            >${escapeHtml(bookingT("booking.travel_plan.insert_as_copy", "use"))}</button>
          </div>
        </article>
      `).join("");
      return;
    }
    els.travelPlanServiceLibraryResults.innerHTML = rows.map((item) => `
      <article class="travel-plan-library-card">
        <div class="travel-plan-library-card__media">
          ${item.thumbnail_url
            ? `<img src="${escapeHtml(resolveTravelPlanImageSrc(item.thumbnail_url, apiOrigin))}" alt="${escapeHtml(item.title || bookingT("booking.travel_plan.item_title", "Service title"))}" loading="lazy" />`
            : `<div class="travel-plan-library-card__placeholder">${escapeHtml(bookingT("booking.travel_plan.no_image", "No image"))}</div>`}
        </div>
        <div class="travel-plan-library-card__content">
          <div class="travel-plan-library-card__eyebrow">
            ${escapeHtml(item.source_booking_name || item.source_booking_id || "")}
          </div>
          <h3>${escapeHtml(item.title || bookingT("booking.travel_plan.item_title", "Service title"))}</h3>
          <p>${escapeHtml(item.location || item.overnight_location || item.details || "")}</p>
          <div class="travel-plan-library-card__meta">
            ${item.service_kind ? `<span>${escapeHtml(bookingT(`booking.travel_plan.kind.${String(item.service_kind).toLowerCase()}`, item.service_kind))}</span>` : ""}
            ${Number(item.image_count) > 0 ? `<span>${escapeHtml(bookingT("booking.travel_plan.image_count", "{count} images", { count: Number(item.image_count) }))}</span>` : ""}
          </div>
        </div>
        <div class="travel-plan-library-card__actions">
          <button
            class="btn btn-primary"
            data-travel-plan-import-source-booking="${escapeHtml(item.source_booking_id || "")}"
            data-travel-plan-import-source-service="${escapeHtml(item.service_id || "")}"
            data-requires-clean-state
            type="button"
          >${escapeHtml(bookingT("booking.travel_plan.insert_as_copy", "use"))}</button>
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

  function openTravelPlanLibrary() {
    if (!state.permissions.canEditBooking || !els.travelPlanServiceLibraryModal) return;
    serviceLibraryState.mode = "plan";
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
      isPlanLibraryMode()
        ? "booking.travel_plan.searching_plans"
        : (isDayLibraryMode() ? "booking.travel_plan.searching_days" : "booking.travel_plan.searching_items"),
      isPlanLibraryMode()
        ? "Searching travel plans..."
        : (isDayLibraryMode() ? "Searching days..." : "Searching services...")
    ), "info");
    const request = isPlanLibraryMode()
      ? travelPlanSearchRequest({
          baseURL: apiOrigin,
          query: {
            ...(query ? { q: query } : {})
          }
        })
      : (isDayLibraryMode()
      ? travelPlanDaySearchRequest({
          baseURL: apiOrigin,
          query: {
            ...(query ? { q: query } : {})
          }
        })
      : travelPlanServiceSearchRequest({
          baseURL: apiOrigin,
          query: {
            ...(query ? { q: query } : {}),
            ...(kind ? { service_kind: kind } : {})
          }
        }));
    try {
      const result = await fetchBookingMutation(request.url, { method: request.method });
      if (!result) {
        setTravelPlanLibraryStatus(bookingT(
          isPlanLibraryMode()
            ? "booking.travel_plan.plan_search_failed"
            : (isDayLibraryMode() ? "booking.travel_plan.day_search_failed" : "booking.travel_plan.search_failed"),
          isPlanLibraryMode()
            ? "Could not search existing travel plans."
            : (isDayLibraryMode() ? "Could not search existing days." : "Could not search existing services.")
        ), "error");
        return;
      }
      serviceLibraryState.searchResults = normalizeTravelPlanLibrarySearchResults(Array.isArray(result.items) ? result.items : []);
      renderTravelPlanServiceLibraryResults(serviceLibraryState.searchResults);
      setTravelPlanLibraryStatus(
        serviceLibraryState.searchResults.length
          ? bookingT(
              isPlanLibraryMode()
                ? "booking.travel_plan.plan_search_results_found"
                : (isDayLibraryMode() ? "booking.travel_plan.day_search_results_found" : "booking.travel_plan.search_results_found"),
              isPlanLibraryMode()
                ? "{count} travel plan(s) found."
                : (isDayLibraryMode() ? "{count} day(s) found." : "{count} service(s) found."),
              { count: serviceLibraryState.searchResults.length }
            )
          : bookingT(
              isPlanLibraryMode()
                ? "booking.travel_plan.no_existing_plans"
                : (isDayLibraryMode() ? "booking.travel_plan.no_existing_days" : "booking.travel_plan.no_existing_items"),
              isPlanLibraryMode()
                ? "No matching travel plans found."
                : (isDayLibraryMode() ? "No matching days found." : "No matching services found.")
            ),
        serviceLibraryState.searchResults.length ? "success" : "info"
      );
    } finally {
      serviceLibraryState.searching = false;
    }
  }

  async function importTravelPlanDay(sourceBookingId, sourceDayId) {
    if (!sourceBookingId || !sourceDayId) return;
    if (!(await ensureTravelPlanReadyForMutation())) return;
    setTravelPlanLibraryStatus(bookingT("booking.travel_plan.inserting_day", "Inserting day..."), "info");
    const request = bookingTravelPlanDayImportRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id
      },
      body: {
        expected_travel_plan_revision: getBookingRevision("travel_plan_revision"),
        source_booking_id: sourceBookingId,
        source_day_id: sourceDayId,
        include_images: true,
        include_customer_visible_images_only: false,
        include_notes: true,
        include_translations: true,
        actor: state.user
      }
    });
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
  }

  async function importTravelPlanService(sourceBookingId, sourceServiceId) {
    if (!serviceLibraryState.dayId || !sourceBookingId || !sourceServiceId) return;
    if (!(await ensureTravelPlanReadyForMutation())) return;
    setTravelPlanLibraryStatus(bookingT("booking.travel_plan.inserting_item", "Inserting service..."), "info");
    const request = bookingTravelPlanServiceImportRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        day_id: serviceLibraryState.dayId
      },
      body: {
        expected_travel_plan_revision: getBookingRevision("travel_plan_revision"),
        source_booking_id: sourceBookingId,
        source_service_id: sourceServiceId,
        include_images: true,
        include_customer_visible_images_only: false,
        include_notes: true,
        include_translations: true,
        include_offer_links: false,
        actor: state.user
      }
    });
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
  }

  async function importTravelPlan(sourceBookingId) {
    if (!sourceBookingId) return;
    if (!(await ensureTravelPlanReadyForMutation())) return;
    setTravelPlanLibraryStatus(bookingT("booking.travel_plan.appending_plan", "Appending travel plan..."), "info");
    const request = bookingTravelPlanImportRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id
      },
      body: {
        expected_travel_plan_revision: getBookingRevision("travel_plan_revision"),
        source_booking_id: sourceBookingId,
        include_images: true,
        include_customer_visible_images_only: false,
        include_notes: true,
        include_translations: true,
        actor: state.user
      }
    });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: request.body
    });
    if (!result?.booking) {
      setTravelPlanLibraryStatus(bookingT("booking.travel_plan.plan_import_failed", "Could not append this travel plan."), "error");
      return;
    }
    closeTravelPlanServiceLibrary();
    await finalizeTravelPlanMutation(result, bookingT("booking.travel_plan.plan_imported", "Travel plan appended."));
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
            button.getAttribute("data-travel-plan-import-source-booking"),
            button.getAttribute("data-travel-plan-import-source-day")
          );
          return;
        }
        if (button.hasAttribute("data-travel-plan-import-source-plan-booking")) {
          void importTravelPlan(button.getAttribute("data-travel-plan-import-source-plan-booking"));
          return;
        }
        if (button.hasAttribute("data-travel-plan-import-source-booking")) {
          void importTravelPlanService(
            button.getAttribute("data-travel-plan-import-source-booking"),
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
    importTravelPlan,
    importTravelPlanDay,
    importTravelPlanService,
    openTravelPlanLibrary,
    openTravelPlanDayLibrary,
    openTravelPlanServiceLibrary,
    populateTravelPlanServiceLibraryKindOptions,
    renderTravelPlanServiceLibraryResults,
    searchTravelPlanServices
  };
}
