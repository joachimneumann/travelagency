import {
  bookingTravelPlanSegmentImportRequest,
  travelPlanSegmentSearchRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { bookingT } from "./i18n.js";
import { TRAVEL_PLAN_SEGMENT_KIND_OPTIONS } from "../shared/generated_catalogs.js";
import { resolveTravelPlanImageSrc } from "./travel_plan_images.js";

export function createBookingTravelPlanSegmentLibraryModule(deps) {
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

  const segmentLibraryState = {
    dayId: "",
    searchResults: [],
    searching: false
  };

  function setTravelPlanLibraryStatus(message, type = "info") {
    if (!els.travelPlanSegmentLibraryStatus) return;
    els.travelPlanSegmentLibraryStatus.textContent = message;
    els.travelPlanSegmentLibraryStatus.classList.remove(
      "booking-inline-status--error",
      "booking-inline-status--success",
      "booking-inline-status--info"
    );
    if (!message) return;
    const normalizedType = type === "error" || type === "success" ? type : "info";
    els.travelPlanSegmentLibraryStatus.classList.add(`booking-inline-status--${normalizedType}`);
  }

  function populateTravelPlanSegmentLibraryKindOptions() {
    if (!els.travelPlanSegmentLibraryKind) return;
    const currentValue = String(els.travelPlanSegmentLibraryKind.value || "").trim();
    els.travelPlanSegmentLibraryKind.innerHTML = [
      `<option value="">${escapeHtml(bookingT("booking.travel_plan.all_kinds", "All kinds"))}</option>`,
      ...TRAVEL_PLAN_SEGMENT_KIND_OPTIONS.map((option) => (
        `<option value="${escapeHtml(option.value)}">${escapeHtml(bookingT(`booking.travel_plan.kind.${option.value}`, option.label))}</option>`
      ))
    ].join("");
    if (currentValue) els.travelPlanSegmentLibraryKind.value = currentValue;
  }

  function renderTravelPlanSegmentLibraryResults(items = []) {
    if (!els.travelPlanSegmentLibraryResults) return;
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      els.travelPlanSegmentLibraryResults.innerHTML = `
        <div class="travel-plan-library-modal__empty">
          ${escapeHtml(bookingT("booking.travel_plan.no_existing_segments", "No matching segments found."))}
        </div>
      `;
      return;
    }
    els.travelPlanSegmentLibraryResults.innerHTML = rows.map((item) => `
      <article class="travel-plan-library-card">
        <div class="travel-plan-library-card__media">
          ${item.thumbnail_url
            ? `<img src="${escapeHtml(resolveTravelPlanImageSrc(item.thumbnail_url, apiOrigin))}" alt="${escapeHtml(item.title || bookingT("booking.travel_plan.segment_title", "Segment title"))}" loading="lazy" />`
            : `<div class="travel-plan-library-card__placeholder">${escapeHtml(bookingT("booking.travel_plan.no_image", "No image"))}</div>`}
        </div>
        <div class="travel-plan-library-card__content">
          <div class="travel-plan-library-card__eyebrow">
            ${escapeHtml(item.source_booking_name || item.source_booking_id || "")}
            ${item.day_number ? ` · ${escapeHtml(bookingT("booking.travel_plan.day_heading", "Day {day}", { day: item.day_number }))}` : ""}
          </div>
          <h3>${escapeHtml(item.title || bookingT("booking.travel_plan.segment_title", "Segment title"))}</h3>
          <p>${escapeHtml(item.location || item.overnight_location || item.details || "")}</p>
          <div class="travel-plan-library-card__meta">
            ${item.segment_kind ? `<span>${escapeHtml(bookingT(`booking.travel_plan.kind.${String(item.segment_kind).toLowerCase()}`, item.segment_kind))}</span>` : ""}
            ${Number.isFinite(Number(item.image_count)) ? `<span>${escapeHtml(bookingT("booking.travel_plan.image_count", "{count} images", { count: Number(item.image_count) }))}</span>` : ""}
          </div>
        </div>
        <div class="travel-plan-library-card__actions">
          <button
            class="btn btn-primary"
            data-travel-plan-import-source-booking="${escapeHtml(item.source_booking_id || "")}"
            data-travel-plan-import-source-segment="${escapeHtml(item.segment_id || "")}"
            type="button"
          >${escapeHtml(bookingT("booking.travel_plan.insert_as_copy", "Insert as copy"))}</button>
        </div>
      </article>
    `).join("");
  }

  function closeTravelPlanSegmentLibrary() {
    segmentLibraryState.dayId = "";
    segmentLibraryState.searchResults = [];
    if (els.travelPlanSegmentLibraryModal) els.travelPlanSegmentLibraryModal.hidden = true;
    if (els.travelPlanSegmentLibraryResults) els.travelPlanSegmentLibraryResults.innerHTML = "";
    setTravelPlanLibraryStatus("");
  }

  function openTravelPlanSegmentLibrary(dayId) {
    if (!state.permissions.canEditBooking || !els.travelPlanSegmentLibraryModal) return;
    segmentLibraryState.dayId = String(dayId || "").trim();
    const day = findDraftDay(segmentLibraryState.dayId);
    if (els.travelPlanSegmentLibrarySubtitle) {
      els.travelPlanSegmentLibrarySubtitle.textContent = bookingT(
        "booking.travel_plan.insert_existing_subtitle",
        "Search existing booking segments and insert a copy into {day}.",
        { day: formatTravelPlanDayHeading(Math.max(0, Number(day?.day_number || 1) - 1)) }
      );
    }
    if (els.travelPlanSegmentLibraryQuery && !els.travelPlanSegmentLibraryQuery.value) {
      els.travelPlanSegmentLibraryQuery.value = String(day?.overnight_location || "").trim();
    }
    segmentLibraryState.searchResults = [];
    renderTravelPlanSegmentLibraryResults([]);
    setTravelPlanLibraryStatus("");
    els.travelPlanSegmentLibraryModal.hidden = false;
    window.setTimeout(() => {
      els.travelPlanSegmentLibraryQuery?.focus();
      els.travelPlanSegmentLibraryQuery?.select?.();
    }, 0);
    void searchTravelPlanSegments();
  }

  async function searchTravelPlanSegments() {
    if (!els.travelPlanSegmentLibraryResults || segmentLibraryState.searching) return;
    segmentLibraryState.searching = true;
    const query = String(els.travelPlanSegmentLibraryQuery?.value || "").trim();
    const kind = String(els.travelPlanSegmentLibraryKind?.value || "").trim();
    setTravelPlanLibraryStatus(bookingT("booking.travel_plan.searching_segments", "Searching segments..."), "info");
    const request = travelPlanSegmentSearchRequest({
      baseURL: apiOrigin,
      query: {
        ...(query ? { q: query } : {}),
        ...(kind ? { segment_kind: kind } : {})
      }
    });
    try {
      const result = await fetchBookingMutation(request.url, { method: request.method });
      if (!result) {
        setTravelPlanLibraryStatus(bookingT("booking.travel_plan.search_failed", "Could not search existing segments."), "error");
        return;
      }
      segmentLibraryState.searchResults = Array.isArray(result.items) ? result.items : [];
      renderTravelPlanSegmentLibraryResults(segmentLibraryState.searchResults);
      setTravelPlanLibraryStatus(
        segmentLibraryState.searchResults.length
          ? bookingT("booking.travel_plan.search_results_found", "{count} matching segments", { count: segmentLibraryState.searchResults.length })
          : bookingT("booking.travel_plan.no_existing_segments", "No matching segments found."),
        segmentLibraryState.searchResults.length ? "success" : "info"
      );
    } finally {
      segmentLibraryState.searching = false;
    }
  }

  async function importTravelPlanSegment(sourceBookingId, sourceSegmentId) {
    if (!segmentLibraryState.dayId || !sourceBookingId || !sourceSegmentId) return;
    if (!(await ensureTravelPlanReadyForMutation())) return;
    setTravelPlanLibraryStatus(bookingT("booking.travel_plan.inserting_segment", "Inserting segment..."), "info");
    const request = bookingTravelPlanSegmentImportRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        day_id: segmentLibraryState.dayId
      },
      body: {
        expected_travel_plan_revision: getBookingRevision("travel_plan_revision"),
        source_booking_id: sourceBookingId,
        source_segment_id: sourceSegmentId,
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
      setTravelPlanLibraryStatus(bookingT("booking.travel_plan.insert_failed", "Could not insert segment."), "error");
      return;
    }
    closeTravelPlanSegmentLibrary();
    await finalizeTravelPlanMutation(result, bookingT("booking.travel_plan.segment_inserted", "Segment inserted."));
  }

  function bindTravelPlanSegmentLibrary() {
    if (els.travelPlanSegmentLibraryModal && els.travelPlanSegmentLibraryModal.dataset.travelPlanBound !== "true") {
      els.travelPlanSegmentLibraryCloseBtn?.addEventListener("click", closeTravelPlanSegmentLibrary);
      els.travelPlanSegmentLibrarySearchBtn?.addEventListener("click", () => {
        void searchTravelPlanSegments();
      });
      els.travelPlanSegmentLibraryQuery?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void searchTravelPlanSegments();
        }
      });
      els.travelPlanSegmentLibraryModal.addEventListener("click", (event) => {
        if (event.target === els.travelPlanSegmentLibraryModal) {
          closeTravelPlanSegmentLibrary();
          return;
        }
        const button = event.target.closest("button");
        if (!button) return;
        if (button.hasAttribute("data-travel-plan-import-source-booking")) {
          void importTravelPlanSegment(
            button.getAttribute("data-travel-plan-import-source-booking"),
            button.getAttribute("data-travel-plan-import-source-segment")
          );
        }
      });
      els.travelPlanSegmentLibraryModal.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeTravelPlanSegmentLibrary();
        }
      });
      els.travelPlanSegmentLibraryModal.dataset.travelPlanBound = "true";
    }
  }

  return {
    bindTravelPlanSegmentLibrary,
    closeTravelPlanSegmentLibrary,
    importTravelPlanSegment,
    openTravelPlanSegmentLibrary,
    populateTravelPlanSegmentLibraryKindOptions,
    renderTravelPlanSegmentLibraryResults,
    searchTravelPlanSegments
  };
}
