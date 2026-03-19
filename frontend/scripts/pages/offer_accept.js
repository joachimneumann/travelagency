import {
  publicGeneratedOfferAccessRequest,
  publicGeneratedOfferAcceptRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import {
  GENERATED_CURRENCIES,
  normalizeCurrencyCode as normalizeGeneratedCurrencyCode
} from "../../Generated/Models/generated_Currency.js";
import { resolveApiUrl } from "../shared/api.js";

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
  pdfLink: document.getElementById("offer_accept_pdf_link"),
  result: document.getElementById("offer_accept_result"),
  resultMessage: document.getElementById("offer_accept_result_message"),
  resultStatement: document.getElementById("offer_accept_result_statement"),
  form: document.getElementById("offer_accept_form"),
  name: document.getElementById("offer_accept_name"),
  email: document.getElementById("offer_accept_email"),
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

function renderAcceptedState() {
  const acceptance = state.access?.acceptance;
  if (!state.accepted || !acceptance) {
    els.result.hidden = true;
    els.form.hidden = false;
    return;
  }
  els.result.hidden = false;
  els.form.hidden = true;
  els.resultMessage.textContent = acceptance.accepted_at
    ? `Accepted by ${acceptance.accepted_by_name || "customer"} on ${formatDateTime(acceptance.accepted_at)}`
    : `Accepted by ${acceptance.accepted_by_name || "customer"}`;
  els.resultStatement.textContent = acceptance.statement_snapshot || "";
}

function render() {
  const access = state.access;
  els.loading.hidden = Boolean(access);
  els.content.hidden = !access;
  if (!access) return;

  document.documentElement.lang = String(access.lang || query.get("lang") || "en").toLowerCase();
  renderSummary();
  els.pdfLink.href = resolveApiUrl(apiOrigin, access.pdf_url || "#");
  els.pdfLink.hidden = !access.pdf_url;
  els.sendBtn.disabled = state.sending;
  els.verifyBtn.disabled = state.sending || !normalizeText(els.otpCode.value);
  els.resendBtn.disabled = state.sending || state.retryAfterSeconds > 0;
  els.otpPanel.hidden = !state.otpRequired;
  els.otpMeta.textContent = state.otpRequired
    ? `Verification code sent to ${state.otpSentTo || "your email"}. It expires ${state.otpExpiresAt ? `at ${formatDateTime(state.otpExpiresAt)}` : "soon"}.`
    : "";
  els.retryAfter.textContent = state.retryAfterSeconds > 0
    ? `Resend available in ${state.retryAfterSeconds}s`
    : "";
  renderAcceptedState();
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
    accepted_by_email: normalizeText(els.email.value),
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
  if (!normalizeText(els.email.value)) {
    setStatus("Email is required.", "error");
    els.email.focus();
    return false;
  }
  return true;
}

async function sendOtpRequest() {
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
    setStatus(`Verification code sent to ${state.otpSentTo || "your email"}.`, "success");
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
      acceptance: result.payload.acceptance || null
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
