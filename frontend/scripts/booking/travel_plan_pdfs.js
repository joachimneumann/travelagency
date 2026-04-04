import {
  bookingTravelPlanPdfDeleteRequest,
  bookingTravelPlanPdfUpdateRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { bookingLanguageQuery, bookingT } from "./i18n.js";

function pageCountLabel(pageCount) {
  const count = Number(pageCount) || 0;
  return bookingT(
    count === 1
      ? "booking.travel_plan.attachment_page_count_one"
      : "booking.travel_plan.attachment_page_count_many",
    count === 1 ? "{count} page" : "{count} pages",
    { count }
  );
}

export function createBookingTravelPlanPdfsModule(deps) {
  const {
    state,
    apiOrigin,
    fetchBookingMutation,
    getBookingRevision,
    escapeHtml,
    formatDateTime,
    ensureTravelPlanReadyForMutation,
    finalizeTravelPlanMutation
  } = deps;

  function withBookingLanguageQuery(urlLike) {
    const url = new URL(urlLike, window.location.origin);
    const query = bookingLanguageQuery();
    url.searchParams.set("content_lang", query.content_lang);
    url.searchParams.set("source_lang", query.source_lang);
    return url.toString();
  }

  function renderTravelPlanPdfsTable() {
    const pdfs = Array.isArray(state.booking?.travel_plan_pdfs) ? state.booking.travel_plan_pdfs : [];
    const canEdit = Boolean(state.permissions?.canEditBooking);
    const emptyColspan = canEdit ? 6 : 5;
    return `
      <div class="travel-plan-existing-pdfs">
        <div class="backend-table-wrap travel-plan-existing-pdfs__table-wrap">
          <table class="backend-table travel-plan-existing-pdfs__table">
            <thead>
              <tr>
                <th class="travel-plan-existing-pdfs-col-document">${escapeHtml(bookingT("booking.pdf", "PDF"))}</th>
                <th class="travel-plan-existing-pdfs-col-pages">${escapeHtml(bookingT("booking.pages", "Pages"))}</th>
                <th class="travel-plan-existing-pdfs-col-date">${escapeHtml(bookingT("booking.date", "Date"))}</th>
                <th class="travel-plan-existing-pdfs-col-comment">${escapeHtml(bookingT("booking.comments", "Comments"))}</th>
                <th class="travel-plan-existing-pdfs-col-sent">${escapeHtml(bookingT("booking.travel_plan.sent_to_customer", "Sent to customer"))}</th>
                ${canEdit ? `<th class="travel-plan-existing-pdfs-col-actions">${escapeHtml(bookingT("backend.table.actions", "Actions"))}</th>` : ""}
              </tr>
            </thead>
            <tbody>
              ${pdfs.length
                ? pdfs.map((pdf) => `
                    <tr data-travel-plan-pdf="${escapeHtml(pdf.id)}">
                      <td class="travel-plan-existing-pdfs-col-document">
                        <a
                          class="travel-plan-existing-pdfs__link"
                          href="${escapeHtml(withBookingLanguageQuery(pdf.pdf_url || ""))}"
                          target="_blank"
                          rel="noopener"
                        >${escapeHtml(pdf.filename || bookingT("booking.travel_plan.travel_plan_pdf", "Travel plan PDF"))}</a>
                      </td>
                      <td class="travel-plan-existing-pdfs-col-pages">${escapeHtml(pageCountLabel(pdf.page_count))}</td>
                      <td class="travel-plan-existing-pdfs-col-date">${escapeHtml(formatDateTime(pdf.created_at))}</td>
                      <td class="travel-plan-existing-pdfs-col-comment generated-offers-col-comment">${canEdit
                        ? `<textarea data-travel-plan-pdf-comment-input="${escapeHtml(pdf.id)}" rows="2">${escapeHtml(pdf.comment || "")}</textarea>
                           <button class="btn btn-ghost" type="button" data-travel-plan-pdf-save-comment="${escapeHtml(pdf.id)}" data-requires-clean-state data-clean-state-hint-id="travel_plan_pdf_dirty_hint">${escapeHtml(bookingT("common.save", "Save"))}</button>`
                        : (escapeHtml(pdf.comment || "") || "-")}</td>
                      <td class="travel-plan-existing-pdfs-col-sent">
                        <label class="travel-plan-existing-pdfs__sent-toggle">
                          <input
                            type="checkbox"
                            data-travel-plan-pdf-sent="${escapeHtml(pdf.id)}"
                            ${pdf.sent_to_customer === true ? "checked" : ""}
                            ${canEdit ? 'data-requires-clean-state data-clean-state-hint-id="travel_plan_pdf_dirty_hint"' : "disabled"}
                          />
                        </label>
                      </td>
                      ${canEdit ? `
                        <td class="travel-plan-existing-pdfs-col-actions">
                          <button
                            class="btn btn-ghost offer-remove-btn"
                            data-travel-plan-delete-pdf="${escapeHtml(pdf.id)}"
                            data-requires-clean-state
                            data-clean-state-hint-id="travel_plan_pdf_dirty_hint"
                            type="button"
                            aria-label="${escapeHtml(bookingT("booking.travel_plan.delete_pdf", "Delete travel plan PDF"))}"
                            title="${escapeHtml(bookingT("booking.travel_plan.delete_pdf", "Delete travel plan PDF"))}"
                            ${pdf.sent_to_customer === true ? "disabled" : ""}
                          >&times;</button>
                        </td>
                      ` : ""}
                    </tr>
                  `).join("")
                : `<tr><td class="travel-plan-existing-pdfs__empty" colspan="${emptyColspan}">${escapeHtml(bookingT("booking.travel_plan.no_existing_pdfs", "No travel plan PDFs yet."))}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function saveTravelPlanPdfComment(artifactId, value) {
    if (!(await ensureTravelPlanReadyForMutation())) return false;
    const currentArtifact = (Array.isArray(state.booking?.travel_plan_pdfs) ? state.booking.travel_plan_pdfs : [])
      .find((item) => item?.id === artifactId);
    const request = bookingTravelPlanPdfUpdateRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        artifact_id: artifactId
      },
      body: {
        expected_travel_plan_revision: getBookingRevision("travel_plan_revision"),
        sent_to_customer: currentArtifact?.sent_to_customer === true,
        comment: String(value || "").trim(),
        actor: state.user
      }
    });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: request.body
    });
    return await finalizeTravelPlanMutation(result, bookingT("booking.travel_plan.pdf_comment_saved", "Travel plan PDF comment saved."));
  }

  async function setTravelPlanPdfSentToCustomer(artifactId, sentToCustomer) {
    if (!(await ensureTravelPlanReadyForMutation())) return false;
    const currentArtifact = (Array.isArray(state.booking?.travel_plan_pdfs) ? state.booking.travel_plan_pdfs : [])
      .find((item) => item?.id === artifactId);
    const request = bookingTravelPlanPdfUpdateRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        artifact_id: artifactId
      },
      body: {
        expected_travel_plan_revision: getBookingRevision("travel_plan_revision"),
        sent_to_customer: sentToCustomer === true,
        comment: String(currentArtifact?.comment || "").trim(),
        actor: state.user
      }
    });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: request.body
    });
    return await finalizeTravelPlanMutation(
      result,
      sentToCustomer === true
        ? bookingT("booking.travel_plan.pdf_marked_sent", "Travel plan PDF marked as sent to customer.")
        : bookingT("booking.travel_plan.pdf_marked_not_sent", "Travel plan PDF marked as not sent to customer.")
    );
  }

  async function deleteTravelPlanPdf(artifactId) {
    if (!(await ensureTravelPlanReadyForMutation())) return false;
    if (!window.confirm(bookingT("booking.travel_plan.delete_pdf_confirm", "Delete this travel plan PDF?"))) return false;
    const request = bookingTravelPlanPdfDeleteRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        artifact_id: artifactId
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
    return await finalizeTravelPlanMutation(result, bookingT("booking.travel_plan.pdf_deleted", "Travel plan PDF deleted."));
  }

  return {
    renderTravelPlanPdfsTable,
    saveTravelPlanPdfComment,
    setTravelPlanPdfSentToCustomer,
    deleteTravelPlanPdf
  };
}
