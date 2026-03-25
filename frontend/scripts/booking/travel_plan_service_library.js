import {
  bookingTravelPlanServiceImportRequest,
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
    findDraftDay,
    formatTravelPlanDayHeading
  } = deps;

  const serviceLibraryState = {
    dayId: "",
    searchResults: [],
    searching: false
  };

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

  function renderTravelPlanServiceLibraryResults(items = []) {
    if (!els.travelPlanServiceLibraryResults) return;
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      els.travelPlanServiceLibraryResults.innerHTML = `
        <div class="travel-plan-library-modal__empty">
          ${escapeHtml(bookingT("booking.travel_plan.no_existing_items", "No matching services found."))}
        </div>
      `;
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
            ${item.day_number ? ` · ${escapeHtml(bookingT("booking.travel_plan.day_heading", "Day {day}", { day: item.day_number }))}` : ""}
          </div>
          <h3>${escapeHtml(item.title || bookingT("booking.travel_plan.item_title", "Service title"))}</h3>
          <p>${escapeHtml(item.location || item.overnight_location || item.details || "")}</p>
          <div class="travel-plan-library-card__meta">
            ${item.service_kind ? `<span>${escapeHtml(bookingT(`booking.travel_plan.kind.${String(item.service_kind).toLowerCase()}`, item.service_kind))}</span>` : ""}
            ${Number.isFinite(Number(item.image_count)) ? `<span>${escapeHtml(bookingT("booking.travel_plan.image_count", "{count} images", { count: Number(item.image_count) }))}</span>` : ""}
          </div>
        </div>
        <div class="travel-plan-library-card__actions">
          <button
            class="btn btn-primary"
            data-travel-plan-import-source-booking="${escapeHtml(item.source_booking_id || "")}"
            data-travel-plan-import-source-service="${escapeHtml(item.service_id || "")}"
            data-requires-clean-state
            type="button"
          >${escapeHtml(bookingT("booking.travel_plan.insert_as_copy", "Insert as copy"))}</button>
        </div>
      </article>
    `).join("");
  }

  function closeTravelPlanServiceLibrary() {
    serviceLibraryState.dayId = "";
    serviceLibraryState.searchResults = [];
    if (els.travelPlanServiceLibraryModal) els.travelPlanServiceLibraryModal.hidden = true;
    if (els.travelPlanServiceLibraryResults) els.travelPlanServiceLibraryResults.innerHTML = "";
    setTravelPlanLibraryStatus("");
  }

  function openTravelPlanServiceLibrary(dayId) {
    if (!state.permissions.canEditBooking || !els.travelPlanServiceLibraryModal) return;
    serviceLibraryState.dayId = String(dayId || "").trim();
    const day = findDraftDay(serviceLibraryState.dayId);
    if (els.travelPlanServiceLibrarySubtitle) {
      els.travelPlanServiceLibrarySubtitle.textContent = bookingT(
        "booking.travel_plan.insert_existing_subtitle",
        "Search existing booking services and insert a copy into {day}.",
        { day: formatTravelPlanDayHeading(Math.max(0, Number(day?.day_number || 1) - 1)) }
      );
    }
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

  async function searchTravelPlanServices() {
    if (!els.travelPlanServiceLibraryResults || serviceLibraryState.searching) return;
    serviceLibraryState.searching = true;
    const query = String(els.travelPlanServiceLibraryQuery?.value || "").trim();
    const kind = String(els.travelPlanServiceLibraryKind?.value || "").trim();
    setTravelPlanLibraryStatus(bookingT("booking.travel_plan.searching_items", "Searching services..."), "info");
    const request = travelPlanServiceSearchRequest({
      baseURL: apiOrigin,
      query: {
        ...(query ? { q: query } : {}),
        ...(kind ? { service_kind: kind } : {})
      }
    });
    try {
      const result = await fetchBookingMutation(request.url, { method: request.method });
      if (!result) {
        setTravelPlanLibraryStatus(bookingT("booking.travel_plan.search_failed", "Could not search existing services."), "error");
        return;
      }
      serviceLibraryState.searchResults = Array.isArray(result.items) ? result.items : [];
      renderTravelPlanServiceLibraryResults(serviceLibraryState.searchResults);
      setTravelPlanLibraryStatus(
        serviceLibraryState.searchResults.length
          ? bookingT("booking.travel_plan.search_results_found", "{count} matching services", { count: serviceLibraryState.searchResults.length })
          : bookingT("booking.travel_plan.no_existing_items", "No matching services found."),
        serviceLibraryState.searchResults.length ? "success" : "info"
      );
    } finally {
      serviceLibraryState.searching = false;
    }
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
    importTravelPlanService,
    openTravelPlanServiceLibrary,
    populateTravelPlanServiceLibraryKindOptions,
    renderTravelPlanServiceLibraryResults,
    searchTravelPlanServices
  };
}
