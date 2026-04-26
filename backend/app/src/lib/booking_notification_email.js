import { createZohoMailApiClient } from "./zoho_mail_api.js";

const DEFAULT_BOOKING_NOTIFICATION_TO = "booking@asiatravelplan.com";
const DEFAULT_BACKEND_LOGO_PATH = "/assets/generated/runtime/brand-logo.png";

function normalizeText(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function joinList(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .join(", ");
}

function formatValue(value) {
  const normalized = normalizeText(value);
  return normalized;
}

function formatBudget(submission) {
  const lower = Number.isFinite(Number(submission?.budget_lower_usd)) ? Number(submission.budget_lower_usd) : null;
  const upper = Number.isFinite(Number(submission?.budget_upper_usd)) ? Number(submission.budget_upper_usd) : null;
  if (lower !== null && upper !== null) return `USD ${lower} - ${upper}`;
  if (lower !== null) return `From USD ${lower}`;
  if (upper !== null) return `Up to USD ${upper}`;
  return "";
}

function formatDuration(submission) {
  const min = Number.isFinite(Number(submission?.travel_duration_days_min)) ? Number(submission.travel_duration_days_min) : null;
  const max = Number.isFinite(Number(submission?.travel_duration_days_max)) ? Number(submission.travel_duration_days_max) : null;
  if (min !== null && max !== null) return `${min} - ${max} days`;
  if (min !== null) return `${min}+ days`;
  if (max !== null) return `Up to ${max} days`;
  return "";
}

function formatSubmittedAt(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return normalized;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    timeZoneName: "short",
    hour12: false
  }).format(date);
}

function normalizeAbsoluteUrl(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  try {
    const url = new URL(normalized);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function resolveRelativeUrl(baseUrl, path) {
  const normalizedBaseUrl = normalizeAbsoluteUrl(baseUrl);
  if (!normalizedBaseUrl) return "";
  try {
    return new URL(path, normalizedBaseUrl.endsWith("/") ? normalizedBaseUrl : `${normalizedBaseUrl}/`).toString();
  } catch {
    return "";
  }
}

function bookingBackendUrl({ booking, backendBaseUrl }) {
  const bookingId = normalizeText(booking?.id);
  return resolveRelativeUrl(backendBaseUrl, bookingId
    ? `/booking.html?id=${encodeURIComponent(bookingId)}`
    : "/bookings.html");
}

function fieldRow({ label, value, multiline = false }) {
  const formatted = formatValue(value);
  if (!formatted) return "";
  return `
                  <tr>
                    <td style="padding:8px 14px 8px 0;color:#667085;font-size:13px;line-height:1.45;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
                    <td style="padding:8px 0;color:#253247;font-size:14px;line-height:1.45;font-weight:600;vertical-align:top;${multiline ? "white-space:pre-wrap;" : ""}">${escapeHtml(formatted)}</td>
                  </tr>`;
}

function section(title, fields) {
  const rows = fields.map((field) => fieldRow(field)).filter(Boolean).join("");
  if (!rows) return "";
  return `
              <tr>
                <td style="padding-top:18px;">
                  <h2 style="margin:0 0 8px;color:#1f2937;font-size:15px;line-height:1.35;">${escapeHtml(title)}</h2>
                  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                    <tbody>${rows}
                    </tbody>
                  </table>
                </td>
              </tr>`;
}

export function buildBookingNotificationEmail({
  booking,
  recipientEmail = DEFAULT_BOOKING_NOTIFICATION_TO,
  logoUrl = "",
  backendBaseUrl = ""
} = {}) {
  const submission = booking?.web_form_submission || {};
  const bookingName = normalizeText(booking?.name || submission.booking_name) || normalizeText(booking?.id) || "New booking";
  const subject = `New booking: ${bookingName}`;
  const safeLogoUrl = normalizeAbsoluteUrl(logoUrl) || resolveRelativeUrl(backendBaseUrl, DEFAULT_BACKEND_LOGO_PATH);
  const backendUrl = bookingBackendUrl({ booking, backendBaseUrl });
  const submittedAt = formatSubmittedAt(submission.submitted_at || booking?.created_at);
  const cta = backendUrl
    ? `<a href="${escapeHtml(backendUrl)}" style="display:inline-block;background:#1f6feb;color:#ffffff;text-decoration:none;border-radius:6px;padding:11px 16px;font-size:14px;font-weight:700;">Open booking in backend</a>`
    : "";
  const sections = [
    section("Customer", [
      { label: "Name", value: submission.name },
      { label: "Email", value: submission.email },
      { label: "Phone", value: submission.phone_number }
    ]),
    section("Trip request", [
      { label: "Trip name", value: bookingName === "New booking" ? "" : bookingName },
      { label: "Destinations", value: joinList(submission.destinations) },
      { label: "Travel style", value: joinList(submission.travel_style) },
      { label: "Travel month", value: submission.travel_month },
      { label: "Travelers", value: submission.number_of_travelers },
      { label: "Duration", value: formatDuration(submission) },
      { label: "Budget", value: formatBudget(submission) },
      { label: "Preferred language", value: submission.preferred_language || booking?.customer_language },
      { label: "Preferred currency", value: submission.preferred_currency || booking?.preferred_currency }
    ]),
    section("Notes", [
      { label: "Message", value: submission.notes || booking?.notes, multiline: true }
    ])
  ].join("");

  const htmlBody = `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#253247;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f4f7fb;">
          <tbody>
            <tr>
              <td style="padding:28px 16px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;margin:0 auto;border-collapse:collapse;">
                  <tbody>
                    ${safeLogoUrl ? `<tr>
                      <td style="padding:0 0 16px;text-align:center;">
                        <img src="${escapeHtml(safeLogoUrl)}" alt="Asia Travel Plan" width="170" style="display:inline-block;width:170px;max-width:70%;height:auto;border:0;" />
                      </td>
                    </tr>` : ""}
                    <tr>
                      <td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:28px 30px;">
                        <p style="margin:0 0 8px;color:#1f6feb;font-size:13px;font-weight:700;letter-spacing:0;text-transform:uppercase;">New web inquiry</p>
                        <h1 style="margin:0;color:#14213d;font-size:24px;line-height:1.25;">${escapeHtml(bookingName)}</h1>
                        ${submittedAt ? `<p style="margin:10px 0 0;color:#667085;font-size:14px;line-height:1.45;">Received ${escapeHtml(submittedAt)}</p>` : ""}
                        ${cta ? `<div style="margin:22px 0 0;">${cta}</div>` : ""}
                        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:8px;">
                          <tbody>${sections}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:14px 4px 0;text-align:center;color:#8a94a6;font-size:12px;line-height:1.5;">
                        Sent to ${escapeHtml(recipientEmail)} by Asia Travel Plan.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>`;

  return { subject, htmlBody };
}

export function createBookingNotificationEmailService({
  config = {},
  mailClientFactory = createZohoMailApiClient,
  logger = console
} = {}) {
  let mailClient = null;

  function isEnabled() {
    return config?.enabled === true;
  }

  function recipientEmail() {
    return normalizeText(config?.recipientEmail) || DEFAULT_BOOKING_NOTIFICATION_TO;
  }

  function getMailClient() {
    const zoho = config?.zoho || {};
    const clientId = normalizeText(zoho.clientId);
    const clientSecret = String(zoho.clientSecret || "");
    const refreshToken = normalizeText(zoho.refreshToken);
    const accountId = normalizeText(zoho.accountId);
    const fromEmail = normalizeText(config.fromEmail);
    if (!clientId || !clientSecret || !refreshToken || !accountId || !fromEmail) {
      return null;
    }
    if (!mailClient) {
      mailClient = mailClientFactory({
        accountsBaseUrl: normalizeText(zoho.accountsBaseUrl) || "https://accounts.zoho.com",
        mailApiBaseUrl: normalizeText(zoho.mailApiBaseUrl) || "https://mail.zoho.com",
        clientId,
        clientSecret,
        refreshToken,
        accountId,
        fromEmail
      });
    }
    return mailClient;
  }

  async function notifyBookingCreated(booking) {
    if (!isEnabled()) {
      return { sent: false, skipped: "disabled" };
    }

    const to = recipientEmail();
    if (!to) {
      logger.warn?.("[booking-notification-email] WEB_INQUIRY_NOTIFICATION_TO is empty; skipping notification.");
      return { sent: false, skipped: "missing_recipient" };
    }

    try {
      const client = getMailClient();
      if (!client) {
        logger.warn?.("[booking-notification-email] Zoho Mail API credentials are not configured; skipping notification.");
        return { sent: false, skipped: "missing_zoho_config" };
      }
      const { subject, htmlBody } = buildBookingNotificationEmail({
        booking,
        recipientEmail: to,
        logoUrl: config.logoUrl,
        backendBaseUrl: config.backendBaseUrl
      });
      const result = await client.sendMessage({
        to,
        subject,
        htmlBody
      });
      return { sent: true, messageId: result?.messageId || "" };
    } catch (error) {
      logger.error?.("[booking-notification-email] Failed to send booking notification.", {
        booking_id: normalizeText(booking?.id),
        error: String(error?.message || error)
      });
      return { sent: false, error: String(error?.message || error) };
    }
  }

  return Object.freeze({
    notifyBookingCreated
  });
}
