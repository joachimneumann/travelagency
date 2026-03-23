import {
  bookingTravelPlanAttachmentDeleteRequest,
  bookingTravelPlanAttachmentUploadRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { bookingT } from "./i18n.js";

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

function attachmentPageCountLabel(pageCount) {
  const count = Number(pageCount) || 0;
  return bookingT(
    count === 1
      ? "booking.travel_plan.attachment_page_count_one"
      : "booking.travel_plan.attachment_page_count_many",
    count === 1 ? "{count} page" : "{count} pages",
    { count }
  );
}

export function createBookingTravelPlanAttachmentsModule(deps) {
  const {
    state,
    els,
    apiOrigin,
    fetchBookingMutation,
    getBookingRevision,
    escapeHtml,
    ensureTravelPlanReadyForMutation,
    finalizeTravelPlanMutation,
    applyTravelPlanMutationBooking,
    applyBookingPayload,
    loadActivities,
    travelPlanStatus
  } = deps;

  function renderTravelPlanAttachments(plan) {
    const attachments = Array.isArray(plan?.attachments) ? plan.attachments : [];
    return `
      <div class="travel-plan-attachments">
        <div class="travel-plan-attachments__head">
          <div class="travel-plan-attachments__title-wrap">
            <h4>${escapeHtml(bookingT("booking.travel_plan.additional_pdfs", "Additional PDFs"))}</h4>
            <p class="travel-plan-attachments__note">${escapeHtml(bookingT("booking.travel_plan.additional_pdfs_note", "These A4 PDFs are appended to the end of the travel plan and offer PDFs."))}</p>
          </div>
          <button
            class="btn btn-ghost booking-offer-add-btn travel-plan-attachments__upload-btn"
            data-travel-plan-upload-attachments
            data-requires-clean-state
            data-clean-state-hint-id="travel_plan_attachments_dirty_hint"
            type="button"
          >${escapeHtml(bookingT("booking.travel_plan.upload_additional_pdfs", "Upload PDFs"))}</button>
        </div>
        ${attachments.length ? `
          <div class="travel-plan-attachments__list">
            ${attachments.map((attachment) => `
              <div class="travel-plan-attachments__item" data-travel-plan-attachment="${escapeHtml(attachment.id)}">
                <div class="travel-plan-attachments__meta">
                  <span class="travel-plan-attachments__filename">${escapeHtml(attachment.filename)}</span>
                  <span class="travel-plan-attachments__pages">${escapeHtml(attachmentPageCountLabel(attachment.page_count))}</span>
                </div>
                <button
                  class="btn btn-ghost offer-remove-btn"
                  data-travel-plan-delete-attachment="${escapeHtml(attachment.id)}"
                  data-requires-clean-state
                  data-clean-state-hint-id="travel_plan_attachments_dirty_hint"
                  type="button"
                  aria-label="${escapeHtml(bookingT("booking.travel_plan.remove_additional_pdf", "Remove additional PDF"))}"
                >&times;</button>
              </div>
            `).join("")}
          </div>
        ` : `
          <p class="travel-plan-attachments__empty">${escapeHtml(bookingT("booking.travel_plan.no_additional_pdfs", "No additional PDFs attached."))}</p>
        `}
        <span id="travel_plan_attachments_dirty_hint" class="micro booking-inline-status travel-plan-pdf-actions__hint"></span>
      </div>
    `;
  }

  function triggerTravelPlanAttachmentPicker() {
    if (!state.permissions.canEditBooking || !els.travelPlanAttachmentInput) return;
    els.travelPlanAttachmentInput.value = "";
    els.travelPlanAttachmentInput.click();
  }

  async function handleTravelPlanAttachmentInputChange() {
    const input = els.travelPlanAttachmentInput;
    const files = Array.from(input?.files || []);
    if (input) input.value = "";
    if (!files.length) return;
    if (!(await ensureTravelPlanReadyForMutation())) return;

    let latestBooking = null;
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      travelPlanStatus(
        bookingT("booking.travel_plan.uploading_pdf_progress", "Uploading PDF {current}/{total}...", {
          current: index + 1,
          total: files.length
        }),
        "info"
      );
      const base64 = await fileToBase64(file);
      const request = bookingTravelPlanAttachmentUploadRequest({
        baseURL: apiOrigin,
        params: { booking_id: state.booking.id },
        body: {
          expected_travel_plan_revision: getBookingRevision("travel_plan_revision"),
          filename: file.name,
          mime_type: file.type || "application/pdf",
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
          ? bookingT("booking.travel_plan.additional_pdf_uploaded", "Additional PDF uploaded.")
          : bookingT("booking.travel_plan.additional_pdfs_uploaded", "{count} PDFs uploaded.", { count: files.length }),
        "success"
      );
    }
  }

  async function deleteTravelPlanAttachment(attachmentId) {
    if (!(await ensureTravelPlanReadyForMutation())) return;
    if (!window.confirm(bookingT("booking.travel_plan.remove_additional_pdf_confirm", "Remove this additional PDF?"))) return;
    const request = bookingTravelPlanAttachmentDeleteRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        attachment_id: attachmentId
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
    await finalizeTravelPlanMutation(result, bookingT("booking.travel_plan.additional_pdf_removed", "Additional PDF removed."));
  }

  function bindTravelPlanAttachmentInput() {
    if (els.travelPlanAttachmentInput && els.travelPlanAttachmentInput.dataset.travelPlanAttachmentsBound !== "true") {
      els.travelPlanAttachmentInput.addEventListener("change", () => {
        void handleTravelPlanAttachmentInputChange();
      });
      els.travelPlanAttachmentInput.dataset.travelPlanAttachmentsBound = "true";
    }
  }

  return {
    renderTravelPlanAttachments,
    triggerTravelPlanAttachmentPicker,
    deleteTravelPlanAttachment,
    bindTravelPlanAttachmentInput
  };
}
