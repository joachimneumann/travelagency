import {
  bookingTravelPlanSegmentImageDeleteRequest,
  bookingTravelPlanSegmentImageReorderRequest,
  bookingTravelPlanSegmentImageUploadRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { bookingT } from "./i18n.js";

export function resolveTravelPlanImageSrc(pathValue, apiOrigin) {
  const normalized = String(pathValue || "").trim();
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith("/")) return `${String(apiOrigin || "").replace(/\/$/, "")}${normalized}`;
  return normalized;
}

async function fileToBase64(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      const comma = value.indexOf(",");
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.onerror = () => reject(new Error(bookingT("booking.error.read_file", "Failed to read file")));
    reader.readAsDataURL(file);
  });
}

export function createBookingTravelPlanImagesModule(deps) {
  const {
    state,
    els,
    apiOrigin,
    fetchBookingMutation,
    getBookingRevision,
    escapeHtml,
    ensureTravelPlanReadyForMutation,
    finalizeTravelPlanMutation,
    findDraftSegment,
    applyTravelPlanMutationBooking,
    applyBookingPayload,
    loadActivities,
    travelPlanStatus
  } = deps;

  function renderTravelPlanSegmentImages(day, segment) {
    const images = Array.isArray(segment?.images) ? segment.images : [];
    const copiedFrom = segment?.copied_from || null;
    const copiedFromText = copiedFrom?.source_booking_id
      ? bookingT(
        "booking.travel_plan.copied_from_booking",
        "Copied from booking {booking}",
        { booking: copiedFrom.source_booking_id }
      )
      : "";

    return `
      <div class="travel-plan-images">
        <div class="travel-plan-images__head">
          <div class="travel-plan-images__title-wrap">
            <h4>${escapeHtml(bookingT("booking.travel_plan.pictures", "Pictures"))}</h4>
            ${copiedFromText ? `<p class="travel-plan-images__copied-from">${escapeHtml(copiedFromText)}</p>` : ""}
          </div>
          <button
            class="btn btn-ghost travel-plan-link-add-btn"
            data-travel-plan-add-image="${escapeHtml(segment.id)}"
            data-travel-plan-day-id="${escapeHtml(day.id)}"
            type="button"
          >${escapeHtml(bookingT("booking.travel_plan.add_images", "Add images"))}</button>
        </div>
        ${images.length ? `
          <div class="travel-plan-images__list">
            ${images.map((image, index) => `
              <article class="travel-plan-image-card" data-travel-plan-image="${escapeHtml(image.id)}">
                <div class="travel-plan-image-card__preview">
                  <img
                    src="${escapeHtml(resolveTravelPlanImageSrc(image.storage_path, apiOrigin))}"
                    alt="${escapeHtml(image.alt_text || image.caption || segment.title || bookingT("booking.travel_plan.picture", "Picture"))}"
                    loading="lazy"
                  />
                </div>
                <div class="travel-plan-image-card__meta">
                  ${image.is_primary ? `<span class="travel-plan-image-card__badge">${escapeHtml(bookingT("booking.travel_plan.primary_image", "Primary"))}</span>` : ""}
                  ${image.is_customer_visible === false ? `<span class="travel-plan-image-card__badge travel-plan-image-card__badge--muted">${escapeHtml(bookingT("booking.travel_plan.internal_only", "Internal only"))}</span>` : ""}
                </div>
                <div class="travel-plan-image-card__actions">
                  <button
                    class="btn btn-ghost travel-plan-move-btn"
                    data-travel-plan-move-image-left="${escapeHtml(image.id)}"
                    data-travel-plan-day-id="${escapeHtml(day.id)}"
                    data-travel-plan-segment-id="${escapeHtml(segment.id)}"
                    type="button"
                    aria-label="${escapeHtml(bookingT("booking.travel_plan.move_image_left", "Move image left"))}"
                    ${index === 0 ? "disabled" : ""}
                  >&larr;</button>
                  <button
                    class="btn btn-ghost travel-plan-move-btn"
                    data-travel-plan-move-image-right="${escapeHtml(image.id)}"
                    data-travel-plan-day-id="${escapeHtml(day.id)}"
                    data-travel-plan-segment-id="${escapeHtml(segment.id)}"
                    type="button"
                    aria-label="${escapeHtml(bookingT("booking.travel_plan.move_image_right", "Move image right"))}"
                    ${index === images.length - 1 ? "disabled" : ""}
                  >&rarr;</button>
                  <button
                    class="btn btn-ghost offer-remove-btn"
                    data-travel-plan-remove-image="${escapeHtml(image.id)}"
                    data-travel-plan-day-id="${escapeHtml(day.id)}"
                    data-travel-plan-segment-id="${escapeHtml(segment.id)}"
                    type="button"
                    aria-label="${escapeHtml(bookingT("booking.travel_plan.remove_image", "Remove image"))}"
                  >&times;</button>
                </div>
              </article>
            `).join("")}
          </div>
        ` : `
          <div class="travel-plan-images__empty">${escapeHtml(bookingT("booking.travel_plan.no_images", "No pictures yet."))}</div>
        `}
      </div>
    `;
  }

  function triggerTravelPlanSegmentImagePicker(dayId, segmentId) {
    if (!state.permissions.canEditBooking || !els.travelPlanSegmentImageInput) return;
    els.travelPlanSegmentImageInput.dataset.dayId = String(dayId || "").trim();
    els.travelPlanSegmentImageInput.dataset.segmentId = String(segmentId || "").trim();
    els.travelPlanSegmentImageInput.value = "";
    els.travelPlanSegmentImageInput.click();
  }

  async function handleTravelPlanSegmentImageInputChange() {
    const input = els.travelPlanSegmentImageInput;
    const dayId = String(input?.dataset.dayId || "").trim();
    const segmentId = String(input?.dataset.segmentId || "").trim();
    const files = Array.from(input?.files || []);
    if (input) input.value = "";
    if (!dayId || !segmentId || !files.length) return;
    if (!(await ensureTravelPlanReadyForMutation())) return;
    let latestBooking = null;
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      travelPlanStatus(
        bookingT("booking.travel_plan.uploading_image_progress", "Uploading image {current}/{total}...", {
          current: index + 1,
          total: files.length
        }),
        "info"
      );
      const base64 = await fileToBase64(file);
      const request = bookingTravelPlanSegmentImageUploadRequest({
        baseURL: apiOrigin,
        params: {
          booking_id: state.booking.id,
          day_id: dayId,
          segment_id: segmentId
        },
        body: {
          expected_travel_plan_revision: getBookingRevision("travel_plan_revision"),
          filename: file.name,
          data_base64: base64,
          actor: state.user
        }
      });
      const result = await fetchBookingMutation(request.url, {
        method: request.method,
        body: request.body
      });
      if (!result?.booking) return;
      latestBooking = result.booking;
      state.booking = latestBooking;
      applyBookingPayload();
    }
    if (latestBooking) {
      applyTravelPlanMutationBooking(latestBooking);
      await loadActivities();
      travelPlanStatus(
        files.length === 1
          ? bookingT("booking.travel_plan.image_uploaded", "Image uploaded.")
          : bookingT("booking.travel_plan.images_uploaded", "{count} images uploaded.", { count: files.length }),
        "success"
      );
    }
  }

  async function reorderTravelPlanSegmentImage(dayId, segmentId, imageId, direction) {
    if (!(await ensureTravelPlanReadyForMutation())) return;
    const segment = findDraftSegment(dayId, segmentId);
    const images = Array.isArray(segment?.images) ? [...segment.images] : [];
    const currentIndex = images.findIndex((image) => image.id === imageId);
    if (currentIndex < 0) return;
    const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const [image] = images.splice(currentIndex, 1);
    images.splice(targetIndex, 0, image);
    const request = bookingTravelPlanSegmentImageReorderRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        day_id: dayId,
        segment_id: segmentId
      },
      body: {
        expected_travel_plan_revision: getBookingRevision("travel_plan_revision"),
        image_ids: images.map((item) => item.id),
        actor: state.user
      }
    });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: request.body
    });
    await finalizeTravelPlanMutation(result, bookingT("booking.travel_plan.image_order_updated", "Picture order updated."));
  }

  async function removeTravelPlanSegmentImage(dayId, segmentId, imageId) {
    if (!(await ensureTravelPlanReadyForMutation())) return;
    const request = bookingTravelPlanSegmentImageDeleteRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        day_id: dayId,
        segment_id: segmentId,
        image_id: imageId
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
    await finalizeTravelPlanMutation(result, bookingT("booking.travel_plan.image_removed", "Image removed."));
  }

  function bindTravelPlanImageInput() {
    if (els.travelPlanSegmentImageInput && els.travelPlanSegmentImageInput.dataset.travelPlanBound !== "true") {
      els.travelPlanSegmentImageInput.addEventListener("change", () => {
        void handleTravelPlanSegmentImageInputChange();
      });
      els.travelPlanSegmentImageInput.dataset.travelPlanBound = "true";
    }
  }

  return {
    bindTravelPlanImageInput,
    handleTravelPlanSegmentImageInputChange,
    removeTravelPlanSegmentImage,
    renderTravelPlanSegmentImages,
    reorderTravelPlanSegmentImage,
    triggerTravelPlanSegmentImagePicker
  };
}
