import {
  bookingTravelPlanServiceImageDeleteRequest,
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
    findDraftItem,
    applyTravelPlanMutationBooking,
    loadActivities,
    travelPlanStatus
  } = deps;

  function resolveCurrentItemImage(item) {
    if (item?.image && typeof item.image === "object" && !Array.isArray(item.image) && item.image.storage_path) {
      return item.image;
    }
    if (!Array.isArray(item?.images)) return null;
    return item.images.find((image) => image?.is_primary) || item.images[0] || null;
  }

  function renderTravelPlanServiceImages(day, item, { variant = "default", editable = true } = {}) {
    const image = resolveCurrentItemImage(item);
    const copiedFrom = item?.copied_from || null;
    const copiedFromText = copiedFrom?.source_booking_id
      ? bookingT(
        "booking.travel_plan.copied_from_booking",
        "Copied from booking {booking}",
        { booking: copiedFrom.source_booking_id }
      )
      : "";
    const placeholderSrc = "assets/img/service.png";
    const primaryPreviewSrc = image
      ? resolveTravelPlanImageSrc(image.storage_path, apiOrigin)
      : placeholderSrc;
    const primaryPreviewAlt = image
      ? (image.alt_text || image.caption || item.image_subtitle || item.title || bookingT("booking.travel_plan.picture", "Picture"))
      : (item.title || bookingT("booking.travel_plan.pictures", "Pictures"));
    const changePictureLabel = image
      ? bookingT("booking.travel_plan.change_picture", "Change picture")
      : bookingT("booking.travel_plan.add_picture", "Add picture");
    const heroMedia = editable
      ? `
        <div class="travel-plan-images__hero-frame">
          <button
            class="travel-plan-images__hero-button"
            data-travel-plan-add-image="${escapeHtml(item.id)}"
            data-travel-plan-day-id="${escapeHtml(day.id)}"
            data-requires-clean-state
            type="button"
            aria-label="${escapeHtml(changePictureLabel)}"
          >
            <img
              class="travel-plan-images__hero-image"
              src="${escapeHtml(primaryPreviewSrc)}"
              alt="${escapeHtml(primaryPreviewAlt)}"
              loading="lazy"
            />
          </button>
          ${image ? `
            <button
              class="travel-plan-images__hero-remove"
              data-travel-plan-remove-image="${escapeHtml(image.id)}"
              data-travel-plan-day-id="${escapeHtml(day.id)}"
              data-travel-plan-service-id="${escapeHtml(item.id)}"
              data-requires-clean-state
              type="button"
              aria-label="${escapeHtml(bookingT("common.remove", "Remove"))}"
            >${escapeHtml(bookingT("common.remove", "Remove"))}</button>
          ` : ""}
        </div>
      `
      : `
        <div class="travel-plan-images__hero-static" aria-label="${escapeHtml(primaryPreviewAlt)}">
          <img
            class="travel-plan-images__hero-image"
            src="${escapeHtml(primaryPreviewSrc)}"
            alt="${escapeHtml(primaryPreviewAlt)}"
            loading="lazy"
          />
        </div>
      `;
    return `
      <div class="travel-plan-images${variant === "sidebar" ? " travel-plan-images--sidebar" : ""}">
        ${heroMedia}
        ${copiedFromText ? `<p class="travel-plan-images__copied-from">${escapeHtml(copiedFromText)}</p>` : ""}
      </div>
    `;
  }

  function triggerTravelPlanServiceImagePicker(dayId, itemId) {
    const normalizedDayId = String(dayId || "").trim();
    const normalizedItemId = String(itemId || "").trim();
    if (!state.permissions.canEditBooking || !els.travelPlanServiceImageInput) {
      console.warn("[travel-plan-service-image] Image picker blocked", {
        can_edit: state.permissions.canEditBooking === true,
        has_input: Boolean(els.travelPlanServiceImageInput),
        day_id: normalizedDayId,
        service_id: normalizedItemId
      });
      return;
    }
    console.info("[travel-plan-service-image] Opening image picker", {
      booking_id: String(state.booking?.id || "").trim(),
      day_id: normalizedDayId,
      service_id: normalizedItemId
    });
    els.travelPlanServiceImageInput.dataset.dayId = normalizedDayId;
    els.travelPlanServiceImageInput.dataset.itemId = normalizedItemId;
    els.travelPlanServiceImageInput.value = "";
    els.travelPlanServiceImageInput.click();
  }

  function serviceImageDebugPayload(dayId, itemId, extra = {}) {
    const item = findDraftItem(dayId, itemId);
    return {
      booking_id: String(state.booking?.id || "").trim(),
      day_id: String(dayId || "").trim(),
      service_id: String(itemId || "").trim(),
      service_found: Boolean(item),
      image: resolveCurrentItemImage(item),
      ...extra
    };
  }

  async function handleTravelPlanServiceImageInputChange() {
    const input = els.travelPlanServiceImageInput;
    const dayId = String(input?.dataset.dayId || "").trim();
    const itemId = String(input?.dataset.itemId || "").trim();
    const file = Array.from(input?.files || [])[0] || null;
    if (input) input.value = "";
    console.info("[travel-plan-service-image] Image input changed", {
      booking_id: String(state.booking?.id || "").trim(),
      day_id: dayId,
      service_id: itemId,
      has_file: Boolean(file),
      filename: file?.name || ""
    });
    if (!dayId || !itemId || !file) {
      console.warn("[travel-plan-service-image] Image upload skipped because input data is incomplete", {
        booking_id: String(state.booking?.id || "").trim(),
        day_id: dayId,
        service_id: itemId,
        has_file: Boolean(file)
      });
      return;
    }
    if (!(await ensureTravelPlanReadyForMutation())) {
      console.warn("[travel-plan-service-image] Image upload blocked because travel plan is not ready for mutation", serviceImageDebugPayload(dayId, itemId));
      return;
    }
    console.info("[travel-plan-service-image] Starting image upload", serviceImageDebugPayload(dayId, itemId, {
      filename: file.name,
      size_bytes: file.size,
      mime_type: file.type
    }));
    travelPlanStatus(
      bookingT("booking.travel_plan.uploading_image_progress", "Uploading image {current}/{total}...", {
        current: 1,
        total: 1
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
    if (!result?.booking) {
      console.warn("[travel-plan-service-image] Image upload response did not include booking payload", serviceImageDebugPayload(dayId, itemId, {
        response_keys: result && typeof result === "object" ? Object.keys(result) : []
      }));
      return;
    }
    const responseItem = (Array.isArray(result.booking?.travel_plan?.days) ? result.booking.travel_plan.days : [])
      .find((day) => String(day?.id || "").trim() === dayId)
      ?.services
      ?.find((item) => String(item?.id || "").trim() === itemId);
    console.info("[travel-plan-service-image] Image upload response received", serviceImageDebugPayload(dayId, itemId, {
      response_image: resolveCurrentItemImage(responseItem)
    }));
    applyTravelPlanMutationBooking(result.booking, { preserveCollapsedState: true });
    console.info("[travel-plan-service-image] Image upload applied to local draft", serviceImageDebugPayload(dayId, itemId));
    await loadActivities();
    travelPlanStatus(bookingT("booking.travel_plan.image_uploaded", "Image uploaded."), "success");
    console.info("[travel-plan-service-image] Image upload completed successfully", serviceImageDebugPayload(dayId, itemId));
  }

  async function removeTravelPlanServiceImage(dayId, itemId, imageId) {
    if (!state.permissions.canEditBooking || !dayId || !itemId || !imageId) return;
    const item = findDraftItem(dayId, itemId);
    const currentImage = resolveCurrentItemImage(item);
    if (!item || !currentImage || currentImage.id !== imageId) return;
    if (!(await ensureTravelPlanReadyForMutation())) return;
    travelPlanStatus(bookingT("booking.travel_plan.removing_image", "Removing image..."), "info");
    const request = bookingTravelPlanServiceImageDeleteRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        day_id: dayId,
        service_id: itemId
      },
      body: {
        expected_travel_plan_revision: getBookingRevision("travel_plan_revision")
      }
    });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: request.body
    });
    if (!result?.booking) return;
    applyTravelPlanMutationBooking(result.booking, { preserveCollapsedState: true });
    await loadActivities();
    travelPlanStatus(bookingT("booking.travel_plan.image_removed", "Image removed."), "success");
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
      image.removeAttribute("src");
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
    triggerTravelPlanServiceImagePicker,
    openTravelPlanImagePreview
  };
}
