import {
  bookingTravelPlanItemImageDeleteRequest,
  bookingTravelPlanItemImageReorderRequest,
  bookingTravelPlanItemImageUploadRequest
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
    findDraftItem,
    applyTravelPlanMutationBooking,
    applyBookingPayload,
    loadActivities,
    travelPlanStatus
  } = deps;

  function renderTravelPlanItemImages(day, item) {
    const images = Array.isArray(item?.images) ? item.images : [];
    const copiedFrom = item?.copied_from || null;
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
            data-travel-plan-add-image="${escapeHtml(item.id)}"
            data-travel-plan-day-id="${escapeHtml(day.id)}"
            data-requires-clean-state
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
                    alt="${escapeHtml(image.alt_text || image.caption || item.title || bookingT("booking.travel_plan.picture", "Picture"))}"
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
                    data-travel-plan-item-id="${escapeHtml(item.id)}"
                    data-requires-clean-state
                    type="button"
                    aria-label="${escapeHtml(bookingT("booking.travel_plan.move_image_left", "Move image left"))}"
                    ${index === 0 ? "disabled" : ""}
                  >&larr;</button>
                  <button
                    class="btn btn-ghost travel-plan-move-btn"
                    data-travel-plan-move-image-right="${escapeHtml(image.id)}"
                    data-travel-plan-day-id="${escapeHtml(day.id)}"
                    data-travel-plan-item-id="${escapeHtml(item.id)}"
                    data-requires-clean-state
                    type="button"
                    aria-label="${escapeHtml(bookingT("booking.travel_plan.move_image_right", "Move image right"))}"
                    ${index === images.length - 1 ? "disabled" : ""}
                  >&rarr;</button>
                  <button
                    class="btn btn-ghost offer-remove-btn"
                    data-travel-plan-remove-image="${escapeHtml(image.id)}"
                    data-travel-plan-day-id="${escapeHtml(day.id)}"
                    data-travel-plan-item-id="${escapeHtml(item.id)}"
                    data-requires-clean-state
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

  function triggerTravelPlanItemImagePicker(dayId, itemId) {
    if (!state.permissions.canEditBooking || !els.travelPlanItemImageInput) return;
    els.travelPlanItemImageInput.dataset.dayId = String(dayId || "").trim();
    els.travelPlanItemImageInput.dataset.itemId = String(itemId || "").trim();
    els.travelPlanItemImageInput.value = "";
    els.travelPlanItemImageInput.click();
  }

  async function handleTravelPlanItemImageInputChange() {
    const input = els.travelPlanItemImageInput;
    const dayId = String(input?.dataset.dayId || "").trim();
    const itemId = String(input?.dataset.itemId || "").trim();
    const files = Array.from(input?.files || []);
    if (input) input.value = "";
    if (!dayId || !itemId || !files.length) return;
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
      const request = bookingTravelPlanItemImageUploadRequest({
        baseURL: apiOrigin,
        params: {
          booking_id: state.booking.id,
          day_id: dayId,
          item_id: itemId
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

  async function reorderTravelPlanItemImage(dayId, itemId, imageId, direction) {
    if (!(await ensureTravelPlanReadyForMutation())) return;
    const item = findDraftItem(dayId, itemId);
    const images = Array.isArray(item?.images) ? [...item.images] : [];
    const currentIndex = images.findIndex((image) => image.id === imageId);
    if (currentIndex < 0) return;
    const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const [image] = images.splice(currentIndex, 1);
    images.splice(targetIndex, 0, image);
    const request = bookingTravelPlanItemImageReorderRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        day_id: dayId,
        item_id: itemId
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

  async function removeTravelPlanItemImage(dayId, itemId, imageId) {
    if (!(await ensureTravelPlanReadyForMutation())) return;
    const request = bookingTravelPlanItemImageDeleteRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        day_id: dayId,
        item_id: itemId,
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
    if (els.travelPlanItemImageInput && els.travelPlanItemImageInput.dataset.travelPlanBound !== "true") {
      els.travelPlanItemImageInput.addEventListener("change", () => {
        void handleTravelPlanItemImageInputChange();
      });
      els.travelPlanItemImageInput.dataset.travelPlanBound = "true";
    }
  }

  return {
    bindTravelPlanImageInput,
    handleTravelPlanItemImageInputChange,
    removeTravelPlanItemImage,
    renderTravelPlanItemImages,
    reorderTravelPlanItemImage,
    triggerTravelPlanItemImagePicker
  };
}
