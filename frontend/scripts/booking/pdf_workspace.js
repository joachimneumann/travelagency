import { buildBookingCollapsibleSectionMarkup } from "./pdf_personalization_panel.js";

function escapeWorkspaceHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveEscapeHtml(escapeHtml) {
  return typeof escapeHtml === "function" ? escapeHtml : escapeWorkspaceHtml;
}

export function buildBookingPdfWorkspaceMarkup({
  escapeHtml,
  previewButtonMarkup = "",
  previewStatusMarkup = "",
  documentsMarkup = "",
  createButtonMarkup = "",
  attachmentsMarkup = ""
} = {}) {
  const escape = resolveEscapeHtml(escapeHtml);
  return `
    <div class="travel-plan-pdf-section__workspace travel-plan-footer__workspace booking-pdf-workspace">
      <div class="travel-plan-footer__preview booking-pdf-workspace__preview">
        <div class="travel-plan-pdf-actions">
          <div class="travel-plan-pdf-actions__buttons">
            ${String(previewButtonMarkup || "").trim()}
          </div>
          ${String(previewStatusMarkup || "").trim()}
        </div>
      </div>
      <div class="travel-plan-footer__content booking-pdf-workspace__content">
        <div class="travel-plan-footer__existing-pdfs booking-pdf-workspace__existing">
          ${String(documentsMarkup || "").trim()}
          <div class="travel-plan-footer__table-action">
            ${String(createButtonMarkup || "").trim() || `<span class="travel-plan-existing-pdfs__empty">${escape("")}</span>`}
          </div>
        </div>
        <div class="travel-plan-footer__attachments booking-pdf-workspace__attachments">
          ${String(attachmentsMarkup || "").trim()}
        </div>
      </div>
    </div>
  `;
}

export function buildBookingPdfDocumentBodyMarkup({
  personalizationMarkup = "",
  workspaceMarkup = ""
} = {}) {
  return [
    String(personalizationMarkup || "").trim(),
    String(workspaceMarkup || "").trim()
  ].filter(Boolean).join("");
}

export function buildBookingPdfDocumentSectionMarkup({
  title,
  personalizationMarkup = "",
  workspaceMarkup = "",
  className = "",
  dataAttributes = {},
  escapeHtml
} = {}) {
  return buildBookingCollapsibleSectionMarkup({
    title,
    className: ["booking-pdf-document-section", className].filter(Boolean).join(" "),
    dataAttributes,
    bodyClassName: "travel-plan-pdf-section__body",
    escapeHtml,
    bodyMarkup: buildBookingPdfDocumentBodyMarkup({
      personalizationMarkup,
      workspaceMarkup
    })
  });
}
