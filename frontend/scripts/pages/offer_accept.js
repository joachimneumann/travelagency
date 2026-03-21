import {
  publicGeneratedOfferAccessRequest,
  publicGeneratedOfferAcceptRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import {
  GENERATED_CURRENCIES,
  normalizeCurrencyCode as normalizeGeneratedCurrencyCode
} from "../../Generated/Models/generated_Currency.js";
import { resolveApiUrl } from "../shared/api.js";
import {
  formatGeneratedOfferAcceptanceRouteLabel,
  generatedOfferRouteUsesDepositPayment,
  normalizeGeneratedOfferAcceptanceRouteMode as normalizeAcceptanceRouteMode,
  normalizeGeneratedOfferAcceptanceRouteStatus as normalizeAcceptanceRouteStatus
} from "../shared/offer_acceptance_catalog.js";

const query = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");
const apiOrigin = apiBase || window.location.origin;

const state = {
  bookingId: String(query.get("booking_id") || "").trim(),
  generatedOfferId: String(query.get("generated_offer_id") || "").trim(),
  token: String(query.get("token") || "").trim(),
  access: null,
  accepted: false,
  sending: false,
  otpRequired: false,
  retryAfterSeconds: 0,
  retryTimer: null,
  otpSentTo: "",
  otpExpiresAt: "",
  lastStatusTone: ""
};

const els = {
  title: document.getElementById("offer_accept_title"),
  intro: document.getElementById("offer_accept_intro"),
  error: document.getElementById("offer_accept_error"),
  loading: document.getElementById("offer_accept_loading"),
  content: document.getElementById("offer_accept_content"),
  summary: document.getElementById("offer_accept_summary"),
  route: document.getElementById("offer_accept_route"),
  paymentTerms: document.getElementById("offer_accept_payment_terms"),
  pdfLink: document.getElementById("offer_accept_pdf_link"),
  result: document.getElementById("offer_accept_result"),
  resultMessage: document.getElementById("offer_accept_result_message"),
  resultStatement: document.getElementById("offer_accept_result_statement"),
  form: document.getElementById("offer_accept_form"),
  name: document.getElementById("offer_accept_name"),
  contactHint: document.getElementById("offer_accept_contact_hint"),
  sendBtn: document.getElementById("offer_accept_send_btn"),
  status: document.getElementById("offer_accept_status"),
  otpPanel: document.getElementById("offer_accept_otp_panel"),
  otpMeta: document.getElementById("offer_accept_otp_meta"),
  otpCode: document.getElementById("offer_accept_otp_code"),
  verifyBtn: document.getElementById("offer_accept_verify_btn"),
  resendBtn: document.getElementById("offer_accept_resend_btn"),
  retryAfter: document.getElementById("offer_accept_retry_after")
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function currencyDefinition(currency) {
  const code = normalizeGeneratedCurrencyCode(currency) || "USD";
  const definition = GENERATED_CURRENCIES[code] || GENERATED_CURRENCIES.USD || { symbol: code, decimal_places: 2 };
  const decimalPlaces = Number.isFinite(Number(definition.decimal_places ?? definition.decimalPlaces))
    ? Number(definition.decimal_places ?? definition.decimalPlaces)
    : 2;
  return {
    code,
    symbol: definition.symbol || code,
    decimalPlaces
  };
}

function formatMoney(value, currency) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "-";
  const definition = currencyDefinition(currency);
  const major = amount / 10 ** definition.decimalPlaces;
  return `${definition.symbol} ${new Intl.NumberFormat(document.documentElement.lang || "en", {
    minimumFractionDigits: definition.decimalPlaces,
    maximumFractionDigits: definition.decimalPlaces,
    useGrouping: true
  }).format(major)}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(document.documentElement.lang || "en", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatDateOnly(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(document.documentElement.lang || "en", {
    year: "numeric",
    month: "long",
    day: "2-digit"
  }).format(date);
}

function formatPaymentDueRule(rule) {
  const type = normalizeText(rule?.type).toUpperCase();
  const days = Math.max(0, Number(rule?.days || 0));
  if (type === "FIXED_DATE") return `Fixed date: ${formatDateOnly(rule?.fixed_date)}`;
  if (type === "DAYS_AFTER_ACCEPTANCE") return `${days} day${days === 1 ? "" : "s"} after acceptance`;
  if (type === "DAYS_BEFORE_TRIP_START") return `${days} day${days === 1 ? "" : "s"} before trip start`;
  if (type === "DAYS_AFTER_TRIP_START") return `${days} day${days === 1 ? "" : "s"} after trip start`;
  if (type === "DAYS_AFTER_TRIP_END") return `${days} day${days === 1 ? "" : "s"} after trip end`;
  return "On acceptance";
}

function routeMode() {
  return normalizeAcceptanceRouteMode(state.access?.acceptance_route?.mode || "OTP");
}

function routeUsesDepositPayment() {
  return generatedOfferRouteUsesDepositPayment(routeMode());
}

function otpRecipientHint() {
  return normalizeText(state.access?.otp_recipient_hint);
}

function setError(message) {
  els.error.textContent = String(message || "");
  els.error.hidden = !message;
  if (message) {
    els.loading.hidden = true;
  }
}

function setStatus(message, tone = "") {
  els.status.textContent = String(message || "");
  els.status.classList.toggle("is-error", tone === "error");
  els.status.classList.toggle("is-success", tone === "success");
  state.lastStatusTone = tone;
}

async function requestJson(url, options = {}) {
  const response = await fetch(resolveApiUrl(apiOrigin, url), {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, payload };
}

function startRetryCountdown(seconds) {
  const normalizedSeconds = Math.max(0, Number(seconds || 0));
  state.retryAfterSeconds = normalizedSeconds;
  if (state.retryTimer) {
    window.clearInterval(state.retryTimer);
    state.retryTimer = null;
  }
  if (normalizedSeconds <= 0) {
    render();
    return;
  }
  state.retryTimer = window.setInterval(() => {
    state.retryAfterSeconds = Math.max(0, state.retryAfterSeconds - 1);
    render();
    if (state.retryAfterSeconds <= 0 && state.retryTimer) {
      window.clearInterval(state.retryTimer);
      state.retryTimer = null;
    }
  }, 1000);
  render();
}

function renderSummary() {
  const access = state.access;
  if (!access) {
    els.summary.innerHTML = "";
    return;
  }
  const rows = [
    ["Booking", access.booking_name || access.booking_id],
    ["Offer total", `<span class="offer-accept-summary__value is-total">${escapeHtml(formatMoney(access.total_price_cents, access.currency))}</span>`],
    ["Route", escapeHtml(formatGeneratedOfferAcceptanceRouteLabel(routeMode(), {
      deposit: "Deposit payment",
      otp: "OTP confirmation"
    }))],
    ["Offer language", escapeHtml(String(access.lang || "").toUpperCase() || "-")],
    ["Generated", escapeHtml(formatDateTime(access.created_at))],
    ["Link expires", escapeHtml(formatDateTime(access.public_acceptance_expires_at))],
    ["Comment", `<span class="offer-accept-summary__comment">${escapeHtml(access.comment || "-")}</span>`]
  ];
  els.summary.innerHTML = rows.map(([label, value]) => `
    <div class="offer-accept-summary__row">
      <div class="offer-accept-summary__label">${escapeHtml(label)}</div>
      <div class="offer-accept-summary__value">${value}</div>
    </div>
  `).join("");
}

function renderRouteCard() {
  if (!els.route) return;
  const access = state.access;
  const acceptanceRoute = access?.acceptance_route;
  if (!access || !acceptanceRoute) {
    els.route.hidden = true;
    els.route.innerHTML = "";
    return;
  }
  const mode = routeMode();
  const isDeposit = routeUsesDepositPayment();
  const routeTitle = isDeposit
    ? "Deposit payment confirms the offer"
    : formatGeneratedOfferAcceptanceRouteLabel(mode, {
        deposit: "Deposit payment",
        otp: "OTP confirmation"
      });
  const defaultMessage = isDeposit
    ? (() => {
        const label = normalizeText(acceptanceRoute?.deposit_rule?.payment_term_label) || "the required payment";
        const amount = Number.isFinite(Number(acceptanceRoute?.deposit_rule?.required_amount_cents))
          ? formatMoney(acceptanceRoute.deposit_rule.required_amount_cents, acceptanceRoute?.deposit_rule?.currency || access.currency)
          : formatMoney(access.total_price_cents, access.currency);
        return `This offer is confirmed once we receive ${amount} for ${label}.`;
      })()
    : "Request a one-time code by email and enter it below to accept the offer.";
  const routeStatus = normalizeAcceptanceRouteStatus(
    acceptanceRoute?.status,
    isDeposit ? "AWAITING_PAYMENT" : "OPEN"
  );
  const statusLabel = normalizeText(routeStatus)
    ? normalizeText(String(routeStatus).replace(/_/g, " ").toLowerCase()).replace(/^\w/, (char) => char.toUpperCase())
    : (isDeposit ? "Awaiting payment" : "Open");
  const depositMeta = isDeposit && acceptanceRoute?.deposit_rule
    ? `
      <div class="offer-accept-route__meta">
        <div><strong>Required payment</strong><span>${escapeHtml(acceptanceRoute.deposit_rule.payment_term_label || "Payment")}</span></div>
        <div><strong>Amount</strong><span>${escapeHtml(formatMoney(acceptanceRoute.deposit_rule.required_amount_cents || 0, acceptanceRoute.deposit_rule.currency || access.currency))}</span></div>
      </div>
    `
    : "";
  els.route.innerHTML = `
    <div class="offer-accept-route__header">
      <h2 class="offer-accept-route__title">${escapeHtml(routeTitle)}</h2>
      <span class="offer-accept-route__status">${escapeHtml(statusLabel)}</span>
    </div>
    <p class="offer-accept-route__body">${escapeHtml(normalizeText(acceptanceRoute?.customer_message_snapshot) || defaultMessage)}</p>
    ${depositMeta}
  `;
  els.route.hidden = false;
}

function renderPaymentTerms() {
  if (!els.paymentTerms) return;
  const paymentTerms = state.access?.payment_terms;
  const lines = Array.isArray(paymentTerms?.lines) ? paymentTerms.lines : [];
  if (!paymentTerms || !lines.length) {
    els.paymentTerms.hidden = true;
    els.paymentTerms.innerHTML = "";
    return;
  }
  const currency = paymentTerms.currency || state.access?.currency || "USD";
  const rows = lines.map((line) => `
    <tr>
      <td>${escapeHtml(line.label || "Payment")}</td>
      <td>${escapeHtml(formatPaymentDueRule(line?.due_rule))}</td>
      <td class="offer-accept-payment-terms__amount">${escapeHtml(formatMoney(line?.resolved_amount_cents || 0, currency))}</td>
    </tr>
    ${normalizeText(line?.description)
      ? `<tr class="offer-accept-payment-terms__note-row"><td colspan="3"><span class="offer-accept-payment-terms__note-label">Note for customer</span>${escapeHtml(line.description)}</td></tr>`
      : ""}`
  ).join("");
  const notes = normalizeText(paymentTerms?.notes);
  els.paymentTerms.innerHTML = `
    <div class="offer-accept-payment-terms__header">
      <h2 class="offer-accept-payment-terms__title">Payment terms</h2>
    </div>
    <div class="backend-table-wrap">
      <table class="backend-table offer-accept-payment-terms__table">
        <thead>
          <tr>
            <th>Payment</th>
            <th>Due</th>
            <th class="offer-accept-payment-terms__amount">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="offer-accept-payment-terms__summary">
      <div class="offer-accept-payment-terms__summary-row">
        <span>Offer total</span>
        <strong>${escapeHtml(formatMoney(paymentTerms?.basis_total_amount_cents || state.access?.total_price_cents || 0, currency))}</strong>
      </div>
      <div class="offer-accept-payment-terms__summary-row">
        <span>Scheduled total</span>
        <strong>${escapeHtml(formatMoney(paymentTerms?.scheduled_total_amount_cents || 0, currency))}</strong>
      </div>
    </div>
    ${notes ? `<p class="offer-accept-payment-terms__notes">${escapeHtml(notes)}</p>` : ""}
  `;
  els.paymentTerms.hidden = false;
}

function renderAcceptedState() {
  const acceptance = state.access?.acceptance;
  if (!state.accepted || !acceptance) {
    els.result.hidden = true;
    return;
  }
  const acceptedAt = acceptance.accepted_at ? formatDateTime(acceptance.accepted_at) : "";
  if (normalizeText(acceptance.method).toUpperCase() === "DEPOSIT_PAYMENT") {
    els.resultMessage.textContent = acceptedAt
      ? `Offer confirmed on ${acceptedAt}.`
      : "Offer confirmed.";
    els.resultStatement.textContent = Number.isFinite(Number(acceptance.accepted_amount_cents))
      ? `Confirmed payment: ${formatMoney(acceptance.accepted_amount_cents, acceptance.accepted_currency || state.access?.currency || "USD")}`
      : "";
  } else {
    els.resultMessage.textContent = acceptedAt
      ? `Offer accepted on ${acceptedAt}.`
      : "Offer accepted.";
    els.resultStatement.textContent = "";
  }
  els.resultStatement.hidden = !normalizeText(els.resultStatement.textContent);
  els.result.hidden = false;
}

function render() {
  const access = state.access;
  els.loading.hidden = Boolean(access);
  els.content.hidden = !access;
  if (!access) return;

  const depositRoute = routeUsesDepositPayment();
  document.documentElement.lang = String(access.lang || query.get("lang") || "en").toLowerCase();
  document.title = depositRoute ? "Offer payment | AsiaTravelPlan" : "Accept Offer | AsiaTravelPlan";
  els.title.textContent = depositRoute ? "Review your offer and payment terms" : "Accept your offer";
  els.intro.textContent = depositRoute
    ? "Review the frozen PDF and payment terms. Your offer is confirmed once we receive the required payment."
    : "Review the frozen PDF, request your verification code, and confirm acceptance.";
  if (els.contactHint) {
    els.contactHint.textContent = depositRoute
      ? ""
      : (otpRecipientHint()
        ? `Verification codes are sent to ${otpRecipientHint()}.`
        : "OTP verification is unavailable because this booking has no contact email.");
    els.contactHint.hidden = depositRoute;
  }

  renderSummary();
  renderRouteCard();
  renderPaymentTerms();
  els.pdfLink.href = resolveApiUrl(apiOrigin, access.pdf_url || "#");
  els.pdfLink.hidden = !access.pdf_url;
  const otpAvailable = depositRoute || Boolean(otpRecipientHint()) || Boolean(state.otpSentTo);
  els.sendBtn.disabled = state.sending || !otpAvailable;
  els.verifyBtn.disabled = state.sending || !normalizeText(els.otpCode.value) || !otpAvailable;
  els.resendBtn.disabled = state.sending || state.retryAfterSeconds > 0 || !otpAvailable;
  els.otpPanel.hidden = !state.otpRequired || depositRoute;
  els.otpMeta.textContent = state.otpRequired
    ? `Verification code sent to ${state.otpSentTo || otpRecipientHint() || "your booking contact email"}. It expires ${state.otpExpiresAt ? `at ${formatDateTime(state.otpExpiresAt)}` : "soon"}.`
    : "";
  els.retryAfter.textContent = state.retryAfterSeconds > 0
    ? `Resend available in ${state.retryAfterSeconds}s`
    : "";
  renderAcceptedState();
  els.form.hidden = depositRoute || state.accepted;
}

async function loadAccess() {
  if (!state.bookingId || !state.generatedOfferId || !state.token) {
    setError("This acceptance link is incomplete.");
    return;
  }
  const request = publicGeneratedOfferAccessRequest({
    baseURL: apiOrigin,
    params: {
      booking_id: state.bookingId,
      generated_offer_id: state.generatedOfferId
    },
    query: {
      token: state.token
    }
  });
  const result = await requestJson(request.url, { method: request.method });
  if (!result.ok || !result.payload) {
    setError(result.payload?.error || "Could not load this offer acceptance link.");
    return;
  }
  state.access = result.payload;
  state.accepted = Boolean(result.payload.accepted);
  render();
}

function buildAcceptRequestBody({ includeOtpCode = false } = {}) {
  return {
    acceptance_token: state.token,
    accepted_by_name: normalizeText(els.name.value),
    language: state.access?.lang || String(query.get("lang") || "en").toLowerCase(),
    otp_channel: "EMAIL",
    ...(includeOtpCode ? { otp_code: normalizeText(els.otpCode.value) } : {})
  };
}

function validateBaseForm() {
  if (!normalizeText(els.name.value)) {
    setStatus("Full name is required.", "error");
    els.name.focus();
    return false;
  }
  if (!routeUsesDepositPayment() && !otpRecipientHint() && !state.otpSentTo) {
    setStatus("OTP verification is unavailable because this booking has no contact email.", "error");
    return false;
  }
  return true;
}

async function sendOtpRequest() {
  if (routeUsesDepositPayment()) return;
  if (!validateBaseForm()) return;
  state.sending = true;
  render();
  setStatus("Sending verification code...");
  const request = publicGeneratedOfferAcceptRequest({
    baseURL: apiOrigin,
    params: {
      booking_id: state.bookingId,
      generated_offer_id: state.generatedOfferId
    }
  });
  const result = await requestJson(request.url, {
    method: request.method,
    body: buildAcceptRequestBody()
  });
  state.sending = false;
  if (result.status === 202 && result.payload?.status === "OTP_REQUIRED") {
    state.otpRequired = true;
    state.otpSentTo = String(result.payload.otp_sent_to || "").trim();
    state.otpExpiresAt = String(result.payload.otp_expires_at || "").trim();
    startRetryCountdown(result.payload.retry_after_seconds || 0);
    setStatus(`Verification code sent to ${state.otpSentTo || otpRecipientHint() || "your booking contact email"}.`, "success");
    render();
    return;
  }
  if (result.status === 429) {
    state.otpRequired = true;
    startRetryCountdown(result.payload?.retry_after_seconds || 0);
    setStatus(result.payload?.error || "Please wait before requesting another verification code.", "error");
    render();
    return;
  }
  setStatus(result.payload?.error || "Could not send the verification code.", "error");
  render();
}

async function verifyOtpAndAccept() {
  if (routeUsesDepositPayment()) return;
  if (!validateBaseForm()) return;
  if (!normalizeText(els.otpCode.value)) {
    setStatus("Verification code is required.", "error");
    els.otpCode.focus();
    return;
  }
  state.sending = true;
  render();
  setStatus("Verifying code...");
  const request = publicGeneratedOfferAcceptRequest({
    baseURL: apiOrigin,
    params: {
      booking_id: state.bookingId,
      generated_offer_id: state.generatedOfferId
    }
  });
  const result = await requestJson(request.url, {
    method: request.method,
    body: buildAcceptRequestBody({ includeOtpCode: true })
  });
  state.sending = false;
  if (result.ok && result.payload?.accepted) {
    state.accepted = true;
    state.otpRequired = false;
    state.access = {
      ...state.access,
      accepted: true,
      acceptance: result.payload.acceptance || null,
      acceptance_route: result.payload.acceptance_route || state.access?.acceptance_route
    };
    setStatus("Offer accepted.", "success");
    render();
    return;
  }
  if (result.status === 429) {
    startRetryCountdown(result.payload?.retry_after_seconds || 0);
  }
  setStatus(result.payload?.error || "Could not verify the code.", "error");
  render();
}

els.form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await sendOtpRequest();
});

els.verifyBtn?.addEventListener("click", async () => {
  await verifyOtpAndAccept();
});

els.resendBtn?.addEventListener("click", async () => {
  await sendOtpRequest();
});

els.otpCode?.addEventListener("input", () => {
  els.verifyBtn.disabled = state.sending || !normalizeText(els.otpCode.value);
});

await loadAccess();
