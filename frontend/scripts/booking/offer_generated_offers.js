import {
  bookingGenerateOfferRequest,
  bookingGeneratedOfferDeleteRequest,
  bookingGeneratedOfferGmailDraftRequest,
  bookingGeneratedOfferUpdateRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { logBrowserConsoleError } from "../shared/api.js";
import { bookingContentLang, bookingContentLanguageLabel, bookingT, bookingLang } from "./i18n.js";
import { formatMoneyDisplay } from "./pricing.js";
import { getBookingPersons } from "../shared/booking_persons.js";
import {
  formatGeneratedOfferAcceptanceRouteLabel,
  generatedOfferRouteUsesDepositPayment as routeUsesDepositPayment,
  normalizeGeneratedOfferAcceptanceRouteMode as normalizeGeneratedOfferRouteMode,
  normalizeGeneratedOfferAcceptanceRouteStatus as normalizeGeneratedOfferRouteStatus
} from "../shared/offer_acceptance_catalog.js";
import { renderBookingSectionHeader } from "./sections.js";

const GMAIL_TAB_NAME = "asiatravelplan_gmail_drafts";
let gmailWindowHandle = null;

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

  let generatedOfferRouteMode = "DEPOSIT_PAYMENT";
  let generatedOfferPaymentTermLineId = "";
  const loggedMissingOtpAcceptanceLinks = new Set();

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

  function currentGeneratedOfferRouteMode(generatedOffer) {
    return normalizeGeneratedOfferRouteMode(generatedOffer?.acceptance_route?.mode || "DEPOSIT_PAYMENT");
  }

  function getOfferAcceptancePaymentTerms() {
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

  function resolveDefaultAcceptancePaymentTermLineId(lines) {
    const items = Array.isArray(lines) ? lines : [];
    if (!items.length) return "";
    const depositLine = items.find((line) => String(line?.kind || "").trim().toUpperCase() === "DEPOSIT");
    return String(depositLine?.id || items[0]?.id || "").trim();
  }

  function resolveSelectedAcceptancePaymentTerm(lines) {
    const items = Array.isArray(lines) ? lines : [];
    if (!items.length) return null;
    return items.find((line) => String(line?.id || "").trim() === generatedOfferPaymentTermLineId) || items[0] || null;
  }

  function syncOfferGenerationControlsState() {
    generatedOfferRouteMode = normalizeGeneratedOfferRouteMode(generatedOfferRouteMode || "DEPOSIT_PAYMENT");
    const { lines } = getOfferAcceptancePaymentTerms();
    if (!lines.length) {
      generatedOfferPaymentTermLineId = "";
      return;
    }
    if (!generatedOfferPaymentTermLineId || !lines.some((line) => String(line?.id || "").trim() === generatedOfferPaymentTermLineId)) {
      generatedOfferPaymentTermLineId = resolveDefaultAcceptancePaymentTermLineId(lines);
    }
  }

  function updateOfferAcceptancePanelSummary() {
    if (!els.offerAcceptancePanelSummary) return;
    const generatedOffers = Array.isArray(state.booking?.generated_offers) ? state.booking.generated_offers : [];
    const acceptedCount = generatedOffers.filter((item) => item?.acceptance && typeof item.acceptance === "object").length;
    const secondary = generatedOffers.length
      ? acceptedCount > 0
        ? bookingT("booking.offer_acceptance_summary_accepted", "{accepted} accepted of {count} generated offer(s)", {
            accepted: String(acceptedCount),
            count: String(generatedOffers.length)
          })
        : bookingT("booking.offer_acceptance_summary_count", "{count} generated offer(s)", {
            count: String(generatedOffers.length)
          })
      : bookingT("booking.offer_acceptance_none", "No generated offers yet.");
    renderBookingSectionHeader(els.offerAcceptancePanelSummary, {
      primary: bookingT("booking.offer_acceptance", "Offer acceptance"),
      secondary
    });
  }

  function resolveGeneratedOfferStatus(generatedOffer) {
    const acceptance = generatedOffer?.acceptance;
    if (acceptance && typeof acceptance === "object") {
      return {
        tone: "accepted",
        label: bookingT("booking.offer.status.accepted", "Accepted"),
        detail: acceptance.accepted_at
          ? bookingT("booking.offer.status.accepted_on", "Accepted on {date}", {
              date: formatGeneratedOfferDate(acceptance.accepted_at)
            })
          : ""
      };
    }

    const routeStatus = normalizeGeneratedOfferRouteStatus(
      generatedOffer?.acceptance_route?.status,
      generatedOffer?.acceptance_route?.mode === "DEPOSIT_PAYMENT" ? "AWAITING_PAYMENT" : "OPEN"
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

    const expiresAtMs = Date.parse(String(generatedOffer?.public_acceptance_expires_at || ""));
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
      return {
        tone: "expired",
        variant: "expired",
        label: bookingT("booking.offer.status.expired", "Expired"),
        detail: ""
      };
    }

    if (String(generatedOffer?.public_acceptance_token || "").trim()) {
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

  function getBookingAcceptanceRecipientEmail() {
    const persons = getBookingPersons(state.booking);
    const primaryContact = persons.find((person) => Array.isArray(person?.roles) && person.roles.includes("primary_contact") && person.emails?.length)
      || persons.find((person) => person.emails?.length)
      || null;
    return String(primaryContact?.emails?.[0] || state.booking?.web_form_submission?.email || "").trim();
  }

  function findGeneratedOfferById(generatedOfferId) {
    return (Array.isArray(state.booking?.generated_offers) ? state.booking.generated_offers : []).find((item) => item?.id === generatedOfferId) || null;
  }

  function buildGeneratedOfferAcceptanceLink(generatedOffer) {
    const bookingId = String(state.booking?.id || "").trim();
    const generatedOfferId = String(generatedOffer?.id || "").trim();
    const token = String(generatedOffer?.public_acceptance_token || "").trim();
    if (!bookingId || !generatedOfferId || !token) return "";
    const url = new URL("/offer-accept.html", window.location.origin);
    url.searchParams.set("booking_id", bookingId);
    url.searchParams.set("generated_offer_id", generatedOfferId);
    url.searchParams.set("token", token);
    const lang = String(generatedOffer?.lang || state.booking?.customer_language || "").trim().toLowerCase();
    if (lang) {
      url.searchParams.set("lang", lang);
    }
    return url.toString();
  }

  function logMissingOtpAcceptanceLink(generatedOffer) {
    const generatedOfferId = String(generatedOffer?.id || "").trim();
    if (!generatedOfferId || loggedMissingOtpAcceptanceLinks.has(generatedOfferId)) return;
    loggedMissingOtpAcceptanceLinks.add(generatedOfferId);
    logBrowserConsoleError(
      "[offer-acceptance] OTP route is unavailable because the generated offer has no public acceptance token.",
      {
        booking_id: String(state.booking?.id || "").trim() || null,
        generated_offer_id: generatedOfferId,
        route_mode: currentGeneratedOfferRouteMode(generatedOffer),
        route_status: normalizeGeneratedOfferRouteStatus(generatedOffer?.acceptance_route?.status, generatedOffer?.acceptance_route?.mode),
        has_acceptance_route: Boolean(generatedOffer?.acceptance_route),
        has_public_acceptance_token: Boolean(String(generatedOffer?.public_acceptance_token || "").trim()),
        public_acceptance_expires_at: String(generatedOffer?.public_acceptance_expires_at || "").trim() || null,
        generated_offer_created_at: String(generatedOffer?.created_at || "").trim() || null,
        hint: "The backend response did not include a public acceptance token. Likely causes: the generated offer record is stale and needs token repair, the backend was not restarted after the OTP-token fix, or OFFER_ACCEPTANCE_TOKEN_SECRET is missing in this environment."
      }
    );
  }

  async function copyGeneratedOfferAcceptanceLink(generatedOfferId) {
    const generatedOffer = findGeneratedOfferById(generatedOfferId);
    const acceptanceLink = buildGeneratedOfferAcceptanceLink(generatedOffer);
    if (!acceptanceLink) {
      setOfferStatus(bookingT("booking.offer.error.acceptance_link_unavailable", "Acceptance link is not available."));
      return;
    }
    const copiedMessage = routeUsesDepositPayment(currentGeneratedOfferRouteMode(generatedOffer))
      ? bookingT("booking.offer.customer_page_copied", "Customer page copied.")
      : bookingT("booking.offer.acceptance_link_copied", "Acceptance link copied.");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(acceptanceLink);
        setOfferStatus(copiedMessage);
        return;
      }
      window.prompt(bookingT("booking.offer.copy_link_prompt", "Copy this acceptance link:"), acceptanceLink);
      setOfferStatus(copiedMessage);
    } catch {
      setOfferStatus(bookingT("booking.offer.error.acceptance_link_copy", "Could not copy acceptance link."));
    }
  }

  function emailGeneratedOfferAcceptanceLink(generatedOfferId) {
    const generatedOffer = findGeneratedOfferById(generatedOfferId);
    const acceptanceLink = buildGeneratedOfferAcceptanceLink(generatedOffer);
    if (!acceptanceLink) {
      setOfferStatus(bookingT("booking.offer.error.acceptance_link_unavailable", "Acceptance link is not available."));
      return;
    }
    const recipientEmail = getBookingAcceptanceRecipientEmail();
    if (!recipientEmail) {
      setOfferStatus(bookingT("booking.offer.error.acceptance_link_email_missing", "Booking has no recipient email for the acceptance link."));
      return;
    }
    const bookingName = String(state.booking?.name || state.booking?.web_form_submission?.booking_name || state.booking?.id || "").trim();
    const totalLabel = formatMoneyDisplay(
      Number(generatedOffer?.total_price_cents || 0),
      generatedOffer?.currency || state.offerDraft?.currency || "USD"
    );
    const routeMode = currentGeneratedOfferRouteMode(generatedOffer);
    const routeRule = generatedOffer?.acceptance_route?.deposit_rule && typeof generatedOffer.acceptance_route.deposit_rule === "object"
      ? generatedOffer.acceptance_route.deposit_rule
      : null;
    const requiredPaymentLabel = String(routeRule?.payment_term_label || "").trim() || bookingT("booking.offer.payment_term", "payment");
    const requiredPaymentAmount = Number.isFinite(Number(routeRule?.required_amount_cents))
      ? formatMoneyDisplay(Number(routeRule.required_amount_cents), routeRule?.currency || generatedOffer?.currency || state.offerDraft?.currency || "USD")
      : totalLabel;
    const subject = routeUsesDepositPayment(routeMode)
      ? bookingT("booking.offer.payment_email_subject", "Payment page for {booking}", {
          booking: bookingName || bookingT("booking.title", "Booking")
        })
      : bookingT("booking.offer.acceptance_email_subject", "Offer acceptance link for {booking}", {
          booking: bookingName || bookingT("booking.title", "Booking")
        });
    const body = routeUsesDepositPayment(routeMode)
      ? bookingT(
          "booking.offer.payment_email_body",
          "Hello,\n\nplease review your offer and payment terms here:\n{link}\n\nYour offer is confirmed when we receive {amount} for {label}.\n\nBest regards,\nAsia Travel Plan",
          {
            link: acceptanceLink,
            amount: requiredPaymentAmount,
            label: requiredPaymentLabel
          }
        )
      : bookingT(
          "booking.offer.acceptance_email_body",
          "Hello,\n\nplease review and accept your offer here:\n{link}\n\nOffer total: {total}\n\nBest regards,\nAsia Travel Plan",
          {
            link: acceptanceLink,
            total: totalLabel
          }
        );
    window.location.href = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setOfferStatus(bookingT("booking.offer.acceptance_email_opening", "Opening your mail client..."));
  }

  function renderOfferGenerationControls() {
    if (!els.offer_generation_route_mode) return;
    syncOfferGenerationControlsState();
    const { lines, currency } = getOfferAcceptancePaymentTerms();
    const canEdit = state.permissions.canEditBooking;
    const hasOtpRecipient = Boolean(getBookingAcceptanceRecipientEmail());
    if (!hasOtpRecipient && !routeUsesDepositPayment(generatedOfferRouteMode)) {
      generatedOfferRouteMode = "DEPOSIT_PAYMENT";
    }
    const selectedPaymentTerm = resolveSelectedAcceptancePaymentTerm(lines);
    const selectedAmount = selectedPaymentTerm
      ? formatMoneyDisplay(Number(selectedPaymentTerm?.resolved_amount_cents || 0), currency)
      : "";
    const routeOptions = [
      {
        value: "DEPOSIT_PAYMENT",
        label: selectedAmount
          ? bookingT("booking.offer.route.option.deposit_payment_amount", "Deposit of {amount}", { amount: selectedAmount })
          : bookingT("booking.offer.route.option.deposit_payment", "Deposit")
      },
      {
        value: "OTP",
        label: bookingT("booking.offer.route.option.otp", "OTP confirmation"),
        disabled: !hasOtpRecipient
      }
    ];
    els.offer_generation_route_mode.innerHTML = routeOptions.map((option) => `
      <option value="${escapeHtml(option.value)}" ${option.value === generatedOfferRouteMode ? "selected" : ""} ${option.disabled ? "disabled" : ""}>${escapeHtml(option.label)}</option>
    `).join("");
    els.offer_generation_route_mode.disabled = !canEdit;

    if (els.generate_offer_btn) {
      els.generate_offer_btn.style.display = canEdit ? "" : "none";
      els.generate_offer_btn.disabled = routeUsesDepositPayment(generatedOfferRouteMode) && !generatedOfferPaymentTermLineId;
    }

    els.offer_generation_route_mode.onchange = canEdit ? () => {
      generatedOfferRouteMode = normalizeGeneratedOfferRouteMode(els.offer_generation_route_mode.value || "DEPOSIT_PAYMENT");
      syncOfferGenerationControlsState();
      renderOfferGenerationControls();
    } : null;
  }

  function renderGeneratedOffersTable() {
    if (!els.generated_offers_table) return;
    const items = Array.isArray(state.booking?.generated_offers) ? state.booking.generated_offers : [];
    updateOfferAcceptancePanelSummary();
    renderOfferGenerationControls();
    const canEdit = state.permissions.canEditBooking;
    const emailActionEnabled = canEdit && Boolean(state.booking?.generated_offer_email_enabled);
    const statusHeader = `<th class="generated-offers-col-status">${escapeHtml(bookingT("booking.status", "Status"))}</th>`;
    const routeHeader = `<th class="generated-offers-col-route">${escapeHtml(bookingT("booking.offer.route", "Route"))}</th>`;
    const emailHeader = emailActionEnabled ? `<th class="generated-offers-col-email">${escapeHtml(bookingT("booking.email", "Email"))}</th>` : "";
    const actionHeader = canEdit ? '<th class="generated-offers-col-actions"></th>' : "";
    const emptyColspan = 7 + (emailActionEnabled ? 1 : 0) + (canEdit ? 1 : 0);
    const rows = items.length
      ? items
        .slice()
        .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))
        .map((item) => {
          const pdfUrl = String(item.pdf_url || "").trim();
          const acceptanceLink = buildGeneratedOfferAcceptanceLink(item);
          const recipientEmail = getBookingAcceptanceRecipientEmail();
          const offerStatus = resolveGeneratedOfferStatus(item);
          const routeMode = currentGeneratedOfferRouteMode(item);
          const generatedOfferId = String(item?.id || "").trim();
          const otpRouteUnavailable = !routeUsesDepositPayment(routeMode) && !acceptanceLink;
          if (otpRouteUnavailable) {
            logMissingOtpAcceptanceLink(item);
          } else if (generatedOfferId) {
            loggedMissingOtpAcceptanceLinks.delete(generatedOfferId);
          }
          return `<tr>
          <td class="generated-offers-col-link">${pdfUrl ? `<a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener">${escapeHtml(bookingT("booking.offer.document", "Offer"))}</a>` : "-"}</td>
          ${emailActionEnabled
            ? `<td class="generated-offers-col-email"><button class="btn btn-ghost" type="button" data-generated-offer-email="${escapeHtml(item.id)}" data-requires-clean-state>${escapeHtml(bookingT("booking.email", "Email"))}</button></td>`
            : ""}
          <td class="generated-offers-col-route">${routeUsesDepositPayment(routeMode)
            ? `<span class="generated-offers-route-label">${escapeHtml(formatGeneratedOfferAcceptanceRouteLabel(routeMode, {
                deposit: bookingT("booking.offer.route.deposit_payment", "Deposit"),
                otp: bookingT("booking.offer.route.otp", "OTP")
              }))}</span>`
            : (otpRouteUnavailable
                ? `<span class="generated-offers-route-label">${escapeHtml(bookingT("booking.offer.status.unavailable", "Unavailable"))}</span>`
                : (canEdit && acceptanceLink
                ? `<div class="generated-offers-link-actions">
                    <button class="btn btn-ghost" type="button" data-generated-offer-copy-link="${escapeHtml(item.id)}" data-requires-clean-state>${escapeHtml(bookingT("booking.offer.otp_link", "OTP link"))}</button>
                    <button class="btn btn-ghost" type="button" data-generated-offer-email-draft="${escapeHtml(item.id)}" data-requires-clean-state${emailActionEnabled ? "" : " disabled"}>${escapeHtml(bookingT("booking.offer.send_otp_email", "Send OTP email"))}</button>
                  </div>`
                : `<span class="generated-offers-route-label">${escapeHtml(formatGeneratedOfferAcceptanceRouteLabel(routeMode, {
                    deposit: bookingT("booking.offer.route.deposit_payment", "Deposit"),
                    otp: bookingT("booking.offer.route.otp", "OTP")
                  }))}</span>`))}
          </td>
          <td class="generated-offers-col-status">
            <span class="generated-offers-status-badge is-${escapeHtml(offerStatus.tone)}${offerStatus.variant ? ` is-${escapeHtml(offerStatus.variant)}` : ""}">${escapeHtml(offerStatus.label)}</span>
            ${offerStatus.detail ? `<div class="generated-offers-status-meta">${escapeHtml(offerStatus.detail)}</div>` : ""}
          </td>
          <td class="generated-offers-col-language">${escapeHtml(bookingContentLanguageLabel(item.lang || "en"))}</td>
          <td class="generated-offers-col-total">${escapeHtml(formatMoneyDisplay(item.total_price_cents || 0, item.currency || state.offerDraft?.currency || "USD"))}</td>
          <td class="generated-offers-col-date">${escapeHtml(formatGeneratedOfferDate(item.created_at))}</td>
          <td class="generated-offers-col-comment">${canEdit
            ? `<div class="generated-offers-comment-text">${escapeHtml(item.comment || "-")}</div>
               <button class="btn btn-ghost" type="button" data-generated-offer-edit-comment="${escapeHtml(item.id)}" data-requires-clean-state>${escapeHtml(bookingT("common.edit", "Edit"))}</button>`
            : (escapeHtml(item.comment || "") || "-")}</td>
          ${canEdit
            ? `<td class="generated-offers-col-actions"><button class="btn btn-ghost offer-remove-btn" type="button" data-generated-offer-delete="${escapeHtml(item.id)}" data-requires-clean-state title="${escapeHtml(bookingT("booking.offer.delete_generated", "Delete generated offer"))}" aria-label="${escapeHtml(bookingT("booking.offer.delete_generated", "Delete generated offer"))}">×</button></td>`
            : ""}
        </tr>`;
        })
        .join("")
      : `<tr><td colspan="${emptyColspan}">${escapeHtml(bookingT("booking.offer.no_generated", "No generated offers yet"))}</td></tr>`;
    els.generated_offers_table.innerHTML = `<thead><tr><th class="generated-offers-col-link">${escapeHtml(bookingT("booking.offer.document", "Offer"))}</th>${emailHeader}${routeHeader}${statusHeader}<th class="generated-offers-col-language">${escapeHtml(bookingT("booking.language", "Language"))}</th><th class="generated-offers-col-total">${escapeHtml(bookingT("booking.total", "Total"))}</th><th class="generated-offers-col-date">${escapeHtml(bookingT("booking.date", "Date"))}</th><th>${escapeHtml(bookingT("booking.comments", "Comments"))}</th>${actionHeader}</tr></thead><tbody>${rows}</tbody>`;

    if (canEdit) {
      els.generated_offers_table.querySelectorAll("[data-generated-offer-edit-comment]").forEach((button) => {
        button.addEventListener("click", () => {
          void promptGeneratedOfferCommentEdit(button.getAttribute("data-generated-offer-edit-comment"));
        });
      });
      els.generated_offers_table.querySelectorAll("[data-generated-offer-delete]").forEach((button) => {
        button.addEventListener("click", () => {
          void deleteGeneratedOffer(button.getAttribute("data-generated-offer-delete"));
        });
      });
      els.generated_offers_table.querySelectorAll("[data-generated-offer-email]").forEach((button) => {
        button.addEventListener("click", () => {
          void createGeneratedOfferGmailDraft(button.getAttribute("data-generated-offer-email"));
        });
      });
      els.generated_offers_table.querySelectorAll("[data-generated-offer-copy-link]").forEach((button) => {
        button.addEventListener("click", () => {
          void copyGeneratedOfferAcceptanceLink(button.getAttribute("data-generated-offer-copy-link"));
        });
      });
      els.generated_offers_table.querySelectorAll("[data-generated-offer-email-draft]").forEach((button) => {
        button.addEventListener("click", () => {
          void createGeneratedOfferGmailDraft(button.getAttribute("data-generated-offer-email-draft"));
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
        comment: String(value || "").trim() || null
      }
    });
    if (await applyOfferBookingResponse(response)) return;
    if (!response) return;
    setOfferStatus(response?.detail || response?.error || bookingT("booking.offer.error.update_comment", "Could not update generated offer comment."));
  }

  async function promptGeneratedOfferCommentEdit(generatedOfferId) {
    if (!state.permissions.canEditBooking || !state.booking?.id || !generatedOfferId) return;
    if (!(await ensureOfferCleanState())) return;
    const generatedOffer = (Array.isArray(state.booking.generated_offers) ? state.booking.generated_offers : [])
      .find((item) => item?.id === generatedOfferId);
    const currentValue = String(generatedOffer?.comment || "");
    const nextValue = window.prompt(bookingT("booking.offer.comment_prompt", "Comment for this generated offer (optional):"), currentValue);
    if (nextValue === null) return;
    if (String(nextValue).trim() === currentValue.trim()) return;
    await saveGeneratedOfferComment(generatedOfferId, nextValue);
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

  async function handleGenerateOffer() {
    if (!state.permissions.canEditBooking || !state.booking?.id) return;
    if (!(await ensureOfferCleanState())) return;
    const requestedRouteMode = normalizeGeneratedOfferRouteMode(
      els.offer_generation_route_mode?.value || generatedOfferRouteMode || "DEPOSIT_PAYMENT"
    );
    generatedOfferRouteMode = requestedRouteMode;
    syncOfferGenerationControlsState();
    const selectedLang = bookingContentLang();
    const missingTranslationCount = countMissingOfferPdfTranslations(state.booking, selectedLang);
    if (missingTranslationCount > 0 && !window.confirm(bookingT(
      "booking.offer.generate_missing_translation_confirm",
      "Customer language is {language}, but {count} offer or travel-plan fields are not translated yet. The PDF shell will use {language}, and those fields will fall back to English. Generate anyway?",
      {
        language: bookingContentLanguageLabel(selectedLang),
        count: missingTranslationCount
      }
    ))) {
      return;
    }
    const request = bookingGenerateOfferRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id }
    });
    const commentInput = window.prompt(bookingT("booking.offer.comment_prompt", "Comment for this generated offer (optional):"), "");
    if (commentInput === null) return;
    const normalizedComment = String(commentInput || "").trim();
    const acceptanceRoute = routeUsesDepositPayment(requestedRouteMode)
      ? {
          mode: "DEPOSIT_PAYMENT",
          deposit_rule: {
            payment_term_line_id: generatedOfferPaymentTermLineId
          }
        }
      : {
          mode: "OTP"
        };
    setOfferStatus(bookingT("booking.offer.generating_pdf", "Generating offer PDF..."));
    const response = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_offer_revision: getBookingRevision("offer_revision"),
        comment: normalizedComment || null,
        lang: selectedLang,
        acceptance_route: acceptanceRoute
      }
    });
    if (await applyOfferBookingResponse(response, { reloadActivities: true })) {
      setOfferStatus("");
      return;
    }
    if (!response) {
      setOfferStatus("");
      return;
    }
    setOfferStatus(response?.detail || response?.error || bookingT("booking.offer.error.generate_pdf", "Could not generate offer PDF."));
  }

  return {
    renderGeneratedOffersTable,
    renderOfferGenerationControls,
    updateOfferAcceptancePanelSummary
  };
}
