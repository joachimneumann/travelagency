import {
  bookingGenerateOfferRequest,
  bookingGeneratedOfferDeleteRequest,
  bookingGeneratedOfferGmailDraftRequest,
  bookingGeneratedOfferUpdateRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import {
  bookingContentLang,
  bookingContentLanguageLabel,
  bookingLanguageQuery,
  bookingSourceLanguageLabel,
  bookingT,
  bookingLang
} from "./i18n.js";
import { formatMoneyDisplay } from "./pricing.js";
import {
  normalizeGeneratedOfferCustomerConfirmationFlowStatus
} from "../shared/booking_confirmation_catalog.js";
import { renderBookingSectionHeader } from "./sections.js";
import { setBookingPageOverlay } from "./page_overlay.js";
import {
  latestProposalNeedsSending,
  proposalWasSent,
  resolveLatestGeneratedOffer,
  resolveProposalSentOffer,
  resolveProposalSentAt
} from "./payment_flow_state.js";

const GMAIL_TAB_NAME = "asiatravelplan_gmail_drafts";
let gmailWindowHandle = null;

function withBookingLanguageQuery(urlLike) {
  const url = new URL(urlLike, window.location.origin);
  const query = bookingLanguageQuery();
  url.searchParams.set("content_lang", query.content_lang);
  url.searchParams.set("source_lang", query.source_lang);
  return url.toString();
}

function acquireGmailWindow() {
  if (gmailWindowHandle && !gmailWindowHandle.closed) {
    return { windowRef: gmailWindowHandle, openedNewWindow: false };
  }
  const windowRef = window.open("about:blank", GMAIL_TAB_NAME);
  if (!windowRef) {
    return { windowRef: null, openedNewWindow: false };
  }
  gmailWindowHandle = windowRef;
  try {
    windowRef.opener = null;
  } catch {
    // Ignore browsers that disallow modifying opener on a fresh tab.
  }
  return { windowRef, openedNewWindow: true };
}

export function createBookingGeneratedOffersModule(ctx) {
  const {
    state,
    els,
    apiOrigin,
    escapeHtml,
    fetchBookingMutation,
    getBookingRevision,
    applyOfferBookingResponse,
    countMissingOfferPdfTranslations,
    ensureOfferCleanState,
    setOfferStatus
  } = ctx;

  let generatedOfferPaymentTermLineId = "";

  function formatGeneratedOfferDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(bookingLang(), {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function getBookingConfirmationPaymentTerms() {
    const lines = Array.isArray(state.offerDraft?.payment_terms?.lines) ? state.offerDraft.payment_terms.lines : [];
    const currency = String(
      state.offerDraft?.payment_terms?.currency
      || state.offerDraft?.currency
      || state.booking?.preferred_currency
      || "USD"
    ).trim().toUpperCase() || "USD";
    return {
      currency,
      lines: lines.filter((line) => line && typeof line === "object" && String(line.id || "").trim())
    };
  }

  function resolveDefaultBookingConfirmationPaymentTermLineId(lines) {
    const items = Array.isArray(lines) ? lines : [];
    if (!items.length) return "";
    const depositLine = items.find((line) => String(line?.kind || "").trim().toUpperCase() === "DEPOSIT");
    return String(depositLine?.id || items[0]?.id || "").trim();
  }

  function resolveSelectedBookingConfirmationPaymentTerm(lines) {
    const items = Array.isArray(lines) ? lines : [];
    if (!items.length) return null;
    return items.find((line) => String(line?.id || "").trim() === generatedOfferPaymentTermLineId) || items[0] || null;
  }

  function syncOfferGenerationControlsState() {
    const { lines } = getBookingConfirmationPaymentTerms();
    if (!lines.length) {
      generatedOfferPaymentTermLineId = "";
      return;
    }
    if (!generatedOfferPaymentTermLineId || !lines.some((line) => String(line?.id || "").trim() === generatedOfferPaymentTermLineId)) {
      generatedOfferPaymentTermLineId = resolveDefaultBookingConfirmationPaymentTermLineId(lines);
    }
  }

  function updateBookingConfirmationPanelSummary() {
    if (!els.bookingConfirmationPanelSummary) return;
    const generatedOffers = Array.isArray(state.booking?.generated_offers) ? state.booking.generated_offers : [];
    const proposalSentAt = resolveProposalSentAt(state.booking);
    const secondary = generatedOffers.length
      ? proposalSentAt
        ? bookingT("booking.offer.summary_sent", "Proposal sent on {date}", {
            date: formatGeneratedOfferDate(proposalSentAt)
          })
        : bookingT("booking.booking_confirmation_summary_count", "{count} generated offer(s)", {
            count: String(generatedOffers.length)
          })
      : bookingT("booking.booking_confirmation_none", "No generated offers yet.");
    renderBookingSectionHeader(els.bookingConfirmationPanelSummary, {
      primary: bookingT("booking.proposal_documents", "Proposal PDFs"),
      secondary
    });
  }

  function formatGenerateOfferError(response) {
    const detail = String(response?.detail || "").trim();
    const error = String(response?.error || "").trim();
    const message = detail || error;
    if (!message) {
      return bookingT("booking.offer.error.generate_pdf", "Could not generate offer PDF.");
    }
    if (/deposit payment acceptance requires at least one payment term line/i.test(message)) {
      return bookingT(
        "booking.offer.error.generate_missing_payment_terms",
        "This booking cannot generate a new offer yet because the selected customer confirmation flow needs at least one payment term line."
      );
    }
    if (/selected acceptance payment term line was not found/i.test(message)) {
      return bookingT(
        "booking.offer.error.generate_invalid_payment_term",
        "This booking cannot generate a new offer because the selected payment term line for the customer confirmation flow is missing."
      );
    }
    if (/no travel plan|travel plan.*not available|travel plan.*empty/i.test(message)) {
      return bookingT(
        "booking.offer.error.generate_missing_travel_plan",
        "Add at least one travel-plan service before generating a new offer."
      );
    }
    return message;
  }

  function resolveGeneratedOfferStatus(generatedOffer) {
    const bookingConfirmation = generatedOffer?.booking_confirmation;
    if (bookingConfirmation && typeof bookingConfirmation === "object") {
      return {
        tone: "confirmed",
        label: bookingT("booking.offer.status.confirmed", "Confirmed"),
        detail: bookingConfirmation.accepted_at
          ? bookingT("booking.offer.status.confirmed_on", "Confirmed on {date}", {
              date: formatGeneratedOfferDate(bookingConfirmation.accepted_at)
            })
          : ""
      };
    }

    const routeStatus = normalizeGeneratedOfferCustomerConfirmationFlowStatus(
      generatedOffer?.customer_confirmation_flow?.status,
      generatedOffer?.customer_confirmation_flow?.mode === "DEPOSIT_PAYMENT" ? "AWAITING_PAYMENT" : "OPEN"
    );
    if (routeStatus === "AWAITING_PAYMENT") {
      return {
        tone: "open",
        variant: "awaiting-payment",
        label: bookingT("booking.offer.status.awaiting_payment", "Awaiting payment"),
        detail: ""
      };
    }
    if (routeStatus === "EXPIRED") {
      return {
        tone: "expired",
        variant: "expired",
        label: bookingT("booking.offer.status.expired", "Expired"),
        detail: ""
      };
    }
    if (routeStatus === "REVOKED") {
      return {
        tone: "unavailable",
        variant: "revoked",
        label: bookingT("booking.offer.status.revoked", "Revoked"),
        detail: ""
      };
    }

    const expiresAtMs = Date.parse(String(generatedOffer?.public_booking_confirmation_expires_at || ""));
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
      return {
        tone: "expired",
        variant: "expired",
        label: bookingT("booking.offer.status.expired", "Expired"),
        detail: ""
      };
    }

    if (String(generatedOffer?.public_booking_confirmation_token || "").trim()) {
      return {
        tone: "open",
        variant: "open",
        label: bookingT("booking.offer.status.open", "Open"),
        detail: ""
      };
    }

    return {
      tone: "unavailable",
      variant: "unavailable",
      label: bookingT("booking.offer.status.unavailable", "Unavailable"),
      detail: ""
    };
  }

  function renderOfferGenerationControls() {
    syncOfferGenerationControlsState();
    const { lines, currency } = getBookingConfirmationPaymentTerms();
    const canEdit = state.permissions.canEditBooking;
    const selectedPaymentTerm = resolveSelectedBookingConfirmationPaymentTerm(lines);
    const selectedAmount = selectedPaymentTerm ? formatMoneyDisplay(Number(selectedPaymentTerm?.resolved_amount_cents || 0), currency) : "";

    if (els.generate_offer_btn) {
      els.generate_offer_btn.style.display = canEdit ? "" : "none";
      els.generate_offer_btn.disabled = false;
      if (selectedAmount) {
        els.generate_offer_btn.title = bookingT("booking.offer.route.option.deposit_payment_amount", "Deposit of {amount}", { amount: selectedAmount });
      } else {
        els.generate_offer_btn.removeAttribute("title");
      }
    }
  }

  function renderGeneratedOffersOverview() {
    if (!(els.generated_offers_overview instanceof HTMLElement)) return;
    const latestOffer = resolveLatestGeneratedOffer(state.booking);
    const sentOffer = resolveProposalSentOffer(state.booking);
    const proposalSentAt = resolveProposalSentAt(state.booking);
    const sentByLabel = String(state.booking?.proposal_sent_by_atp_staff_label || "").trim();
    const showMarkLatestAction = state.permissions.canEditBooking && Boolean(latestOffer);
    const overviewTone = !latestOffer
      ? "blocked"
      : latestProposalNeedsSending(state.booking)
        ? "current"
        : proposalWasSent(state.booking)
          ? "done"
          : "current";
    const overviewLabel = !latestOffer
      ? bookingT("booking.offer.proposal_pdf_missing", "No proposal PDF yet")
      : latestProposalNeedsSending(state.booking)
        ? bookingT("booking.offer.latest_not_sent", "Latest proposal PDF not marked as sent")
        : proposalWasSent(state.booking)
          ? bookingT("booking.offer.proposal_sent", "Proposal sent")
          : bookingT("booking.offer.ready_to_send", "Proposal ready to send");
    const detail = !latestOffer
      ? bookingT("booking.offer.proposal_pdf_missing_detail", "Generate a customer-facing proposal PDF before sending the proposal.")
      : proposalSentAt
        ? bookingT("booking.offer.proposal_sent_detail", "Sent on {date}{person}", {
            date: formatGeneratedOfferDate(proposalSentAt),
            person: sentByLabel ? ` by ${sentByLabel}` : ""
          })
        : sentOffer
          ? bookingT("booking.offer.proposal_sent_frozen_detail", "The accepted offer artifact is the current sent proposal.")
          : bookingT("booking.offer.proposal_send_prompt", "Mark the sent proposal manually so ATP can see which PDF went to the customer.");
    els.generated_offers_overview.hidden = false;
    els.generated_offers_overview.innerHTML = `
      <div class="booking-flow-inline-card__head">
        <span class="booking-flow-chip is-${escapeHtml(overviewTone)}">${escapeHtml(overviewLabel)}</span>
        ${latestOffer ? `<span class="booking-flow-inline-card__meta">${escapeHtml(bookingT("booking.offer.latest_pdf", "Latest PDF: {date}", {
          date: formatGeneratedOfferDate(latestOffer.created_at)
        }))}</span>` : ""}
      </div>
      <p class="booking-flow-inline-card__body">${escapeHtml(detail)}</p>
      ${showMarkLatestAction
        ? `<div class="booking-flow-inline-card__actions">
            <button class="btn btn-ghost" type="button" data-generated-offer-mark-latest-sent ${latestProposalNeedsSending(state.booking) ? "" : proposalWasSent(state.booking) ? "disabled" : ""} data-requires-clean-state>
              ${escapeHtml(bookingT("booking.offer.mark_latest_sent", "Mark latest proposal as sent"))}
            </button>
          </div>`
        : ""}
    `;
    els.generated_offers_overview.querySelector("[data-generated-offer-mark-latest-sent]")?.addEventListener("click", () => {
      if (!latestOffer?.id) return;
      void markGeneratedOfferAsSent(latestOffer.id);
    });
  }

  function renderGeneratedOffersTable() {
    if (!els.generated_offers_table) return;
    const items = Array.isArray(state.booking?.generated_offers) ? state.booking.generated_offers : [];
    updateBookingConfirmationPanelSummary();
    renderOfferGenerationControls();
    renderGeneratedOffersOverview();
    const canEdit = state.permissions.canEditBooking;
    const emailActionEnabled = canEdit && Boolean(state.booking?.generated_offer_email_enabled);
    const statusHeader = `<th class="generated-offers-col-status">${escapeHtml(bookingT("booking.status", "Status"))}</th>`;
    const emailHeader = emailActionEnabled ? `<th class="generated-offers-col-email">${escapeHtml(bookingT("booking.email", "Email"))}</th>` : "";
    const actionHeader = canEdit ? '<th class="generated-offers-col-actions"></th>' : "";
    const emptyColspan = 6 + (emailActionEnabled ? 1 : 0) + (canEdit ? 1 : 0);
    const rows = items.length
      ? items
        .slice()
        .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))
        .map((item) => {
          const pdfUrl = item?.pdf_url ? withBookingLanguageQuery(item.pdf_url) : "";
          const offerStatus = resolveGeneratedOfferStatus(item);
          const proposalSent = String(state.booking?.proposal_sent_generated_offer_id || "").trim() === String(item?.id || "").trim();
          return `<tr>
          <td class="generated-offers-col-link">${pdfUrl ? `<a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener">${escapeHtml(bookingT("booking.offer.document", "Offer"))}</a>` : "-"}</td>
          ${emailActionEnabled
            ? `<td class="generated-offers-col-email"><button class="btn btn-ghost" type="button" data-generated-offer-email="${escapeHtml(item.id)}" data-requires-clean-state>${escapeHtml(bookingT("booking.email", "Email"))}</button></td>`
            : ""}
          <td class="generated-offers-col-status">
            <span class="generated-offers-status-badge is-${escapeHtml(offerStatus.tone)}${offerStatus.variant ? ` is-${escapeHtml(offerStatus.variant)}` : ""}">${escapeHtml(offerStatus.label)}</span>
            ${proposalSent ? `<span class="generated-offers-status-badge is-confirmed is-proposal-sent">${escapeHtml(bookingT("booking.offer.sent_badge", "Sent proposal"))}</span>` : ""}
            ${offerStatus.detail ? `<div class="generated-offers-status-meta">${escapeHtml(offerStatus.detail)}</div>` : ""}
          </td>
          <td class="generated-offers-col-language">${escapeHtml(bookingContentLanguageLabel(item.lang || "en"))}</td>
          <td class="generated-offers-col-total">${escapeHtml(formatMoneyDisplay(item.total_price_cents || 0, item.currency || state.offerDraft?.currency || "USD"))}</td>
          <td class="generated-offers-col-date">${escapeHtml(formatGeneratedOfferDate(item.created_at))}</td>
          <td class="generated-offers-col-comment">${canEdit
            ? `<textarea data-generated-offer-comment-input="${escapeHtml(item.id)}" rows="2">${escapeHtml(item.comment || "")}</textarea>
               <button class="btn btn-ghost" type="button" data-generated-offer-save-comment="${escapeHtml(item.id)}" data-requires-clean-state>${escapeHtml(bookingT("common.save", "Save"))}</button>`
            : (escapeHtml(item.comment || "") || "-")}</td>
          ${canEdit
            ? `<td class="generated-offers-col-actions">
                <button class="btn btn-ghost" type="button" data-generated-offer-mark-sent="${escapeHtml(item.id)}" data-requires-clean-state ${proposalSent ? "disabled" : ""}>${escapeHtml(proposalSent ? bookingT("booking.offer.marked_sent", "Marked sent") : bookingT("booking.offer.mark_as_sent", "Mark sent"))}</button>
                <button class="btn btn-ghost offer-remove-btn" type="button" data-generated-offer-delete="${escapeHtml(item.id)}" data-requires-clean-state title="${escapeHtml(bookingT("booking.offer.delete_generated", "Delete generated offer"))}" aria-label="${escapeHtml(bookingT("booking.offer.delete_generated", "Delete generated offer"))}">×</button>
              </td>`
            : ""}
        </tr>`;
        })
        .join("")
      : `<tr><td colspan="${emptyColspan}">${escapeHtml(bookingT("booking.offer.no_generated", "No generated offers yet"))}</td></tr>`;
    els.generated_offers_table.innerHTML = `<thead><tr><th class="generated-offers-col-link">${escapeHtml(bookingT("booking.offer.document", "Offer"))}</th>${emailHeader}${statusHeader}<th class="generated-offers-col-language">${escapeHtml(bookingT("booking.language", "Language"))}</th><th class="generated-offers-col-total">${escapeHtml(bookingT("booking.total", "Total"))}</th><th class="generated-offers-col-date">${escapeHtml(bookingT("booking.date", "Date"))}</th><th>${escapeHtml(bookingT("booking.comments", "Comments"))}</th>${actionHeader}</tr></thead><tbody>${rows}</tbody>`;

    if (canEdit) {
      els.generated_offers_table.querySelectorAll("[data-generated-offer-save-comment]").forEach((button) => {
        button.addEventListener("click", () => {
          const generatedOfferId = String(button.getAttribute("data-generated-offer-save-comment") || "").trim();
          const input = els.generated_offers_table.querySelector(`[data-generated-offer-comment-input="${CSS.escape(generatedOfferId)}"]`);
          const nextValue = input instanceof HTMLTextAreaElement ? input.value : "";
          void saveGeneratedOfferComment(generatedOfferId, nextValue);
        });
      });
      els.generated_offers_table.querySelectorAll("[data-generated-offer-delete]").forEach((button) => {
        button.addEventListener("click", () => {
          void deleteGeneratedOffer(button.getAttribute("data-generated-offer-delete"));
        });
      });
      els.generated_offers_table.querySelectorAll("[data-generated-offer-mark-sent]").forEach((button) => {
        button.addEventListener("click", () => {
          void markGeneratedOfferAsSent(button.getAttribute("data-generated-offer-mark-sent"));
        });
      });
      els.generated_offers_table.querySelectorAll("[data-generated-offer-email]").forEach((button) => {
        button.addEventListener("click", () => {
          void createGeneratedOfferGmailDraft(button.getAttribute("data-generated-offer-email"));
        });
      });
    }

    if (els.generate_offer_btn) {
      els.generate_offer_btn.style.display = state.permissions.canEditBooking ? "" : "none";
      els.generate_offer_btn.onclick = state.permissions.canEditBooking ? () => {
        void handleGenerateOffer();
      } : null;
    }
  }

  async function saveGeneratedOfferComment(generatedOfferId, value) {
    if (!state.permissions.canEditBooking || !state.booking?.id || !generatedOfferId) return;
    if (!(await ensureOfferCleanState())) return;
    const request = bookingGeneratedOfferUpdateRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        generated_offer_id: generatedOfferId
      }
    });
    const response = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_offer_revision: getBookingRevision("offer_revision"),
        comment: String(value || "").trim()
      }
    });
    if (await applyOfferBookingResponse(response)) return;
    if (!response) return;
    setOfferStatus(response?.detail || response?.error || bookingT("booking.offer.error.update_comment", "Could not update generated offer comment."));
  }

  async function deleteGeneratedOffer(generatedOfferId) {
    if (!state.permissions.canEditBooking || !state.booking?.id || !generatedOfferId) return;
    if (!window.confirm(bookingT("booking.offer.delete_generated_confirm", "Delete this generated offer?"))) return;
    if (!(await ensureOfferCleanState())) return;
    const request = bookingGeneratedOfferDeleteRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        generated_offer_id: generatedOfferId
      }
    });
    const response = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_offer_revision: getBookingRevision("offer_revision")
      }
    });
    if (await applyOfferBookingResponse(response)) return;
    if (!response) return;
    setOfferStatus(response?.detail || response?.error || bookingT("booking.offer.error.delete_generated", "Could not delete generated offer."));
  }

  async function createGeneratedOfferGmailDraft(generatedOfferId) {
    if (!state.permissions.canEditBooking || !state.booking?.id || !generatedOfferId) return;
    if (!state.booking?.generated_offer_email_enabled) {
      setOfferStatus(bookingT("booking.offer.gmail_not_configured", "Gmail draft creation is not configured for this environment."));
      return;
    }
    const { windowRef: draftWindow, openedNewWindow } = acquireGmailWindow();
    setOfferStatus(bookingT("booking.offer.creating_gmail_draft", "Creating Gmail draft..."));
    const request = bookingGeneratedOfferGmailDraftRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        generated_offer_id: generatedOfferId
      }
    });
    const response = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        actor: state.user || null
      }
    });
    if (response?.gmail_draft_url) {
      if (draftWindow) {
        draftWindow.location = response.gmail_draft_url;
        setOfferStatus(response.warning || "");
        return;
      }
      const fallbackTab = window.open(response.gmail_draft_url, GMAIL_TAB_NAME);
      if (fallbackTab) {
        gmailWindowHandle = fallbackTab;
        try {
          fallbackTab.opener = null;
        } catch {
          // Ignore browsers that disallow modifying opener on a fresh tab.
        }
        setOfferStatus(response.warning || "");
        return;
      }
      setOfferStatus(bookingT("booking.offer.gmail_popup_blocked", "Gmail draft created, but your browser blocked opening a new tab. Allow pop-ups and try again."));
      return;
    }
    if (draftWindow && openedNewWindow) {
      draftWindow.close();
      gmailWindowHandle = null;
    }
    if (!response) {
      setOfferStatus("");
      return;
    }
    setOfferStatus(response?.detail || response?.error || bookingT("booking.offer.error.create_gmail_draft", "Could not create Gmail draft."));
  }

  async function markGeneratedOfferAsSent(generatedOfferId) {
    if (!state.permissions.canEditBooking || !state.booking?.id || !generatedOfferId) return false;
    if (!(await ensureOfferCleanState())) return false;
    const request = bookingGeneratedOfferUpdateRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        generated_offer_id: generatedOfferId
      }
    });
    const response = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_offer_revision: getBookingRevision("offer_revision"),
        mark_as_sent: true,
        actor: state.user || null
      }
    });
    if (await applyOfferBookingResponse(response, { reloadActivities: true })) {
      setOfferStatus(bookingT("booking.offer.sent_success", "Proposal marked as sent."), "success");
      return true;
    }
    if (!response) return false;
    setOfferStatus(response?.detail || response?.error || bookingT("booking.offer.sent_failed", "Could not mark the proposal as sent."), "error");
    return false;
  }

  async function handleGenerateOffer() {
    if (!state.permissions.canEditBooking || !state.booking?.id) return;
    syncOfferGenerationControlsState();
    const selectedLang = bookingContentLang();
    const missingTranslationCount = countMissingOfferPdfTranslations(state.booking, selectedLang);
    if (missingTranslationCount > 0 && !window.confirm(bookingT(
      "booking.offer.generate_missing_translation_confirm",
      "Customer language is {language}, but {count} offer or travel-plan fields are not translated yet. The PDF shell will use {language}, and those fields will fall back to {sourceLanguage}. Generate anyway?",
      {
        language: bookingContentLanguageLabel(selectedLang),
        sourceLanguage: bookingSourceLanguageLabel(),
        count: missingTranslationCount
      }
    ))) {
      return;
    }
    const request = bookingGenerateOfferRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id }
    });
    const customerConfirmationFlow = generatedOfferPaymentTermLineId
      ? {
          mode: "DEPOSIT_PAYMENT",
          deposit_rule: {
            payment_term_line_id: generatedOfferPaymentTermLineId
          }
        }
      : null;
    setOfferStatus(bookingT("booking.offer.generating_pdf", "Generating offer PDF..."), "info");
    setBookingPageOverlay(els, true, bookingT("booking.offer.generating_pdf_overlay", "Generating offer PDF. Please wait."));
    const response = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_offer_revision: getBookingRevision("offer_revision"),
        lang: selectedLang,
        ...(customerConfirmationFlow ? { customer_confirmation_flow: customerConfirmationFlow } : {})
      }
    }).finally(() => {
      setBookingPageOverlay(els, false);
    });
    if (await applyOfferBookingResponse(response, { reloadActivities: true })) {
      setOfferStatus("");
      return;
    }
    if (!response) {
      setOfferStatus("");
      return;
    }
    setOfferStatus(formatGenerateOfferError(response), "error");
  }

  return {
    renderGeneratedOffersTable,
    renderOfferGenerationControls,
    updateBookingConfirmationPanelSummary,
    markGeneratedOfferAsSent
  };
}
