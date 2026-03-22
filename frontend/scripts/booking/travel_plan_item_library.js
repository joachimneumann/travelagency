import {
  bookingTravelPlanItemImportRequest,
  travelPlanItemSearchRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { bookingT } from "./i18n.js";
import { TRAVEL_PLAN_ITEM_KIND_OPTIONS } from "../shared/generated_catalogs.js";
import { resolveTravelPlanImageSrc } from "./travel_plan_images.js";

export function createBookingTravelPlanItemLibraryModule(deps) {
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

  const itemLibraryState = {
    dayId: "",
    searchResults: [],
    searching: false
  };

  function setTravelPlanLibraryStatus(message, type = "info") {
    if (!els.travelPlanItemLibraryStatus) return;
    els.travelPlanItemLibraryStatus.textContent = message;
    els.travelPlanItemLibraryStatus.classList.remove(
      "booking-inline-status--error",
      "booking-inline-status--success",
      "booking-inline-status--info"
    );
    if (!message) return;
    const normalizedType = type === "error" || type === "success" ? type : "info";
    els.travelPlanItemLibraryStatus.classList.add(`booking-inline-status--${normalizedType}`);
  }

  function populateTravelPlanItemLibraryKindOptions() {
    if (!els.travelPlanItemLibraryKind) return;
    const currentValue = String(els.travelPlanItemLibraryKind.value || "").trim();
    els.travelPlanItemLibraryKind.innerHTML = [
      `<option value="">${escapeHtml(bookingT("booking.travel_plan.all_kinds", "All kinds"))}</option>`,
      ...TRAVEL_PLAN_ITEM_KIND_OPTIONS.map((option) => (
        `<option value="${escapeHtml(option.value)}">${escapeHtml(bookingT(`booking.travel_plan.kind.${option.value}`, option.label))}</option>`
      ))
    ].join("");
    if (currentValue) els.travelPlanItemLibraryKind.value = currentValue;
  }

  function renderTravelPlanItemLibraryResults(items = []) {
    if (!els.travelPlanItemLibraryResults) return;
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      els.travelPlanItemLibraryResults.innerHTML = `
        <div class="travel-plan-library-modal__empty">
          ${escapeHtml(bookingT("booking.travel_plan.no_existing_items", "No matching travel plan items found."))}
        </div>
      `;
      return;
    }
    els.travelPlanItemLibraryResults.innerHTML = rows.map((item) => `
      <article class="travel-plan-library-card">
        <div class="travel-plan-library-card__media">
          ${item.thumbnail_url
            ? `<img src="${escapeHtml(resolveTravelPlanImageSrc(item.thumbnail_url, apiOrigin))}" alt="${escapeHtml(item.title || bookingT("booking.travel_plan.item_title", "Travel plan item title"))}" loading="lazy" />`
            : `<div class="travel-plan-library-card__placeholder">${escapeHtml(bookingT("booking.travel_plan.no_image", "No image"))}</div>`}
        </div>
        <div class="travel-plan-library-card__content">
          <div class="travel-plan-library-card__eyebrow">
            ${escapeHtml(item.source_booking_name || item.source_booking_id || "")}
            ${item.day_number ? ` · ${escapeHtml(bookingT("booking.travel_plan.day_heading", "Day {day}", { day: item.day_number }))}` : ""}
          </div>
          <h3>${escapeHtml(item.title || bookingT("booking.travel_plan.item_title", "Travel plan item title"))}</h3>
          <p>${escapeHtml(item.location || item.overnight_location || item.details || "")}</p>
          <div class="travel-plan-library-card__meta">
            ${item.item_kind ? `<span>${escapeHtml(bookingT(`booking.travel_plan.kind.${String(item.item_kind).toLowerCase()}`, item.item_kind))}</span>` : ""}
            ${Number.isFinite(Number(item.image_count)) ? `<span>${escapeHtml(bookingT("booking.travel_plan.image_count", "{count} images", { count: Number(item.image_count) }))}</span>` : ""}
          </div>
        </div>
        <div class="travel-plan-library-card__actions">
          <button
            class="btn btn-primary"
            data-travel-plan-import-source-booking="${escapeHtml(item.source_booking_id || "")}"
            data-travel-plan-import-source-item="${escapeHtml(item.item_id || "")}"
            data-requires-clean-state
            type="button"
          >${escapeHtml(bookingT("booking.travel_plan.insert_as_copy", "Insert as copy"))}</button>
        </div>
      </article>
    `).join("");
  }

  function closeTravelPlanItemLibrary() {
    itemLibraryState.dayId = "";
    itemLibraryState.searchResults = [];
    if (els.travelPlanItemLibraryModal) els.travelPlanItemLibraryModal.hidden = true;
    if (els.travelPlanItemLibraryResults) els.travelPlanItemLibraryResults.innerHTML = "";
    setTravelPlanLibraryStatus("");
  }

  function openTravelPlanItemLibrary(dayId) {
    if (!state.permissions.canEditBooking || !els.travelPlanItemLibraryModal) return;
    itemLibraryState.dayId = String(dayId || "").trim();
    const day = findDraftDay(itemLibraryState.dayId);
    if (els.travelPlanItemLibrarySubtitle) {
      els.travelPlanItemLibrarySubtitle.textContent = bookingT(
        "booking.travel_plan.insert_existing_subtitle",
        "Search existing booking travel plan items and insert a copy into {day}.",
        { day: formatTravelPlanDayHeading(Math.max(0, Number(day?.day_number || 1) - 1)) }
      );
    }
    if (els.travelPlanItemLibraryQuery && !els.travelPlanItemLibraryQuery.value) {
      els.travelPlanItemLibraryQuery.value = String(day?.overnight_location || "").trim();
    }
    itemLibraryState.searchResults = [];
    renderTravelPlanItemLibraryResults([]);
    setTravelPlanLibraryStatus("");
    els.travelPlanItemLibraryModal.hidden = false;
    window.setTimeout(() => {
      els.travelPlanItemLibraryQuery?.focus();
      els.travelPlanItemLibraryQuery?.select?.();
    }, 0);
    void searchTravelPlanItems();
  }

  async function searchTravelPlanItems() {
    if (!els.travelPlanItemLibraryResults || itemLibraryState.searching) return;
    itemLibraryState.searching = true;
    const query = String(els.travelPlanItemLibraryQuery?.value || "").trim();
    const kind = String(els.travelPlanItemLibraryKind?.value || "").trim();
    setTravelPlanLibraryStatus(bookingT("booking.travel_plan.searching_items", "Searching travel plan items..."), "info");
    const request = travelPlanItemSearchRequest({
      baseURL: apiOrigin,
      query: {
        ...(query ? { q: query } : {}),
        ...(kind ? { item_kind: kind } : {})
      }
    });
    try {
      const result = await fetchBookingMutation(request.url, { method: request.method });
      if (!result) {
        setTravelPlanLibraryStatus(bookingT("booking.travel_plan.search_failed", "Could not search existing travel plan items."), "error");
        return;
      }
      itemLibraryState.searchResults = Array.isArray(result.items) ? result.items : [];
      renderTravelPlanItemLibraryResults(itemLibraryState.searchResults);
      setTravelPlanLibraryStatus(
        itemLibraryState.searchResults.length
          ? bookingT("booking.travel_plan.search_results_found", "{count} matching travel plan items", { count: itemLibraryState.searchResults.length })
          : bookingT("booking.travel_plan.no_existing_items", "No matching travel plan items found."),
        itemLibraryState.searchResults.length ? "success" : "info"
      );
    } finally {
      itemLibraryState.searching = false;
    }
  }

  async function importTravelPlanItem(sourceBookingId, sourceItemId) {
    if (!itemLibraryState.dayId || !sourceBookingId || !sourceItemId) return;
    if (!(await ensureTravelPlanReadyForMutation())) return;
    setTravelPlanLibraryStatus(bookingT("booking.travel_plan.inserting_item", "Inserting travel plan item..."), "info");
    const request = bookingTravelPlanItemImportRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        day_id: itemLibraryState.dayId
      },
      body: {
        expected_travel_plan_revision: getBookingRevision("travel_plan_revision"),
        source_booking_id: sourceBookingId,
        source_item_id: sourceItemId,
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
      setTravelPlanLibraryStatus(bookingT("booking.travel_plan.insert_failed", "Could not insert travel plan item."), "error");
      return;
    }
    closeTravelPlanItemLibrary();
    await finalizeTravelPlanMutation(result, bookingT("booking.travel_plan.item_inserted", "Travel plan item inserted."));
  }

  function bindTravelPlanItemLibrary() {
    if (els.travelPlanItemLibraryModal && els.travelPlanItemLibraryModal.dataset.travelPlanBound !== "true") {
      els.travelPlanItemLibraryCloseBtn?.addEventListener("click", closeTravelPlanItemLibrary);
      els.travelPlanItemLibrarySearchBtn?.addEventListener("click", () => {
        void searchTravelPlanItems();
      });
      els.travelPlanItemLibraryQuery?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void searchTravelPlanItems();
        }
      });
      els.travelPlanItemLibraryModal.addEventListener("click", (event) => {
        if (event.target === els.travelPlanItemLibraryModal) {
          closeTravelPlanItemLibrary();
          return;
        }
        const button = event.target.closest("button");
        if (!button) return;
        if (button.hasAttribute("data-travel-plan-import-source-booking")) {
          void importTravelPlanItem(
            button.getAttribute("data-travel-plan-import-source-booking"),
            button.getAttribute("data-travel-plan-import-source-item")
          );
        }
      });
      els.travelPlanItemLibraryModal.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeTravelPlanItemLibrary();
        }
      });
      els.travelPlanItemLibraryModal.dataset.travelPlanBound = "true";
    }
  }

  return {
    bindTravelPlanItemLibrary,
    closeTravelPlanItemLibrary,
    importTravelPlanItem,
    openTravelPlanItemLibrary,
    populateTravelPlanItemLibraryKindOptions,
    renderTravelPlanItemLibraryResults,
    searchTravelPlanItems
  };
}
