import {
  bookingTravelPlanServiceImageReorderRequest,
  bookingTravelPlanServiceImageUploadRequest
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
    syncTravelPlanDraftFromDom,
    applyTravelPlanMutationBooking,
    applyBookingPayload,
    renderTravelPlanPanel,
    loadActivities,
    travelPlanStatus
  } = deps;

  function renderTravelPlanServiceImages(day, item) {
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
              ${(() => {
                const previewSrc = resolveTravelPlanImageSrc(image.storage_path, apiOrigin);
                const previewAlt = image.alt_text || image.caption || item.title || bookingT("booking.travel_plan.picture", "Picture");
                return `
              <article class="travel-plan-image-card" data-travel-plan-image="${escapeHtml(image.id)}">
                <button
                  class="travel-plan-image-card__preview"
                  data-travel-plan-preview-image="${escapeHtml(image.id)}"
                  data-travel-plan-preview-src="${escapeHtml(previewSrc)}"
                  data-travel-plan-preview-alt="${escapeHtml(previewAlt)}"
                  type="button"
                  aria-label="${escapeHtml(bookingT("booking.travel_plan.open_full_image", "Open full size image"))}"
                >
                  ${image.is_primary ? `<span class="travel-plan-image-card__badge travel-plan-image-card__badge--overlay">${escapeHtml(bookingT("booking.travel_plan.primary_image", "Primary"))}</span>` : ""}
                  ${image.is_customer_visible === false ? `<span class="travel-plan-image-card__badge travel-plan-image-card__badge--muted travel-plan-image-card__badge--overlay-start">${escapeHtml(bookingT("booking.travel_plan.internal_only", "Internal only"))}</span>` : ""}
                  <img
                    src="${escapeHtml(previewSrc)}"
                    alt="${escapeHtml(previewAlt)}"
                    loading="lazy"
                  />
                </button>
                <div class="travel-plan-image-card__actions">
                  <button
                    class="btn btn-ghost travel-plan-move-btn"
                    data-travel-plan-move-image-left="${escapeHtml(image.id)}"
                    data-travel-plan-day-id="${escapeHtml(day.id)}"
                    data-travel-plan-service-id="${escapeHtml(item.id)}"
                    data-requires-clean-state
                    type="button"
                    aria-label="${escapeHtml(bookingT("booking.travel_plan.move_image_left", "Move image left"))}"
                    ${index === 0 ? "disabled" : ""}
                  >&larr;</button>
                  <button
                    class="btn btn-ghost travel-plan-move-btn"
                    data-travel-plan-move-image-right="${escapeHtml(image.id)}"
                    data-travel-plan-day-id="${escapeHtml(day.id)}"
                    data-travel-plan-service-id="${escapeHtml(item.id)}"
                    data-requires-clean-state
                    type="button"
                    aria-label="${escapeHtml(bookingT("booking.travel_plan.move_image_right", "Move image right"))}"
                    ${index === images.length - 1 ? "disabled" : ""}
                  >&rarr;</button>
                  <button
                    class="btn btn-ghost offer-remove-btn"
                    data-travel-plan-remove-image="${escapeHtml(image.id)}"
                    data-travel-plan-day-id="${escapeHtml(day.id)}"
                    data-travel-plan-service-id="${escapeHtml(item.id)}"
                    type="button"
                    aria-label="${escapeHtml(bookingT("booking.travel_plan.remove_image", "Remove image"))}"
                  >&times;</button>
                </div>
              </article>
            `;
              })()}
            `).join("")}
          </div>
        ` : `
          <div class="travel-plan-images__empty">${escapeHtml(bookingT("booking.travel_plan.no_images", "No pictures yet."))}</div>
        `}
      </div>
    `;
  }

  function triggerTravelPlanServiceImagePicker(dayId, itemId) {
    if (!state.permissions.canEditBooking || !els.travelPlanServiceImageInput) return;
    els.travelPlanServiceImageInput.dataset.dayId = String(dayId || "").trim();
    els.travelPlanServiceImageInput.dataset.itemId = String(itemId || "").trim();
    els.travelPlanServiceImageInput.value = "";
    els.travelPlanServiceImageInput.click();
  }

  async function handleTravelPlanServiceImageInputChange() {
    const input = els.travelPlanServiceImageInput;
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
      const request = bookingTravelPlanServiceImageUploadRequest({
        baseURL: apiOrigin,
        params: {
          booking_id: state.booking.id,
          day_id: dayId,
          service_id: itemId
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

  async function reorderTravelPlanServiceImage(dayId, itemId, imageId, direction) {
    if (!(await ensureTravelPlanReadyForMutation())) return;
    const item = findDraftItem(dayId, itemId);
    const images = Array.isArray(item?.images) ? [...item.images] : [];
    const currentIndex = images.findIndex((image) => image.id === imageId);
    if (currentIndex < 0) return;
    const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;
    const [image] = images.splice(currentIndex, 1);
    images.splice(targetIndex, 0, image);
    const request = bookingTravelPlanServiceImageReorderRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        day_id: dayId,
        service_id: itemId
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

  function removeTravelPlanServiceImage(dayId, itemId, imageId) {
    if (!state.permissions.canEditBooking) return;
    syncTravelPlanDraftFromDom?.();
    const item = findDraftItem(dayId, itemId);
    const currentImages = Array.isArray(item?.images) ? item.images : [];
    const nextImages = currentImages.filter((image) => image.id !== imageId);
    if (nextImages.length === currentImages.length || !item) return;
    item.images = nextImages;
    travelPlanStatus("");
    renderTravelPlanPanel?.();
  }

  function openTravelPlanImagePreview(src, alt = "") {
    const modal = els.travelPlanImagePreviewModal;
    const image = els.travelPlanImagePreviewImage;
    const normalizedSrc = String(src || "").trim();
    if (!modal || !image || !normalizedSrc) return;
    image.src = normalizedSrc;
    image.alt = String(alt || "").trim();
    if (!modal.hasAttribute("tabindex")) modal.setAttribute("tabindex", "-1");
    modal.hidden = false;
    if (els.travelPlanImagePreviewCloseBtn?.focus) {
      els.travelPlanImagePreviewCloseBtn.focus();
    } else if (modal.focus) {
      modal.focus();
    }
  }

  function closeTravelPlanImagePreview() {
    const modal = els.travelPlanImagePreviewModal;
    const image = els.travelPlanImagePreviewImage;
    if (!modal) return;
    modal.hidden = true;
    if (image) {
      image.src = "";
      image.alt = "";
    }
  }

  function bindTravelPlanImagePreviewModal() {
    const modal = els.travelPlanImagePreviewModal;
    if (!modal || modal.dataset.travelPlanPreviewBound === "true") return;
    els.travelPlanImagePreviewCloseBtn?.addEventListener("click", closeTravelPlanImagePreview);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeTravelPlanImagePreview();
    });
    modal.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeTravelPlanImagePreview();
    });
    modal.dataset.travelPlanPreviewBound = "true";
  }

  function bindTravelPlanImageInput() {
    if (els.travelPlanServiceImageInput && els.travelPlanServiceImageInput.dataset.travelPlanBound !== "true") {
      els.travelPlanServiceImageInput.addEventListener("change", () => {
        void handleTravelPlanServiceImageInputChange();
      });
      els.travelPlanServiceImageInput.dataset.travelPlanBound = "true";
    }
  }

  return {
    bindTravelPlanImageInput,
    bindTravelPlanImagePreviewModal,
    closeTravelPlanImagePreview,
    handleTravelPlanServiceImageInputChange,
    removeTravelPlanServiceImage,
    renderTravelPlanServiceImages,
    reorderTravelPlanServiceImage,
    triggerTravelPlanServiceImagePicker,
    openTravelPlanImagePreview
  };
}
