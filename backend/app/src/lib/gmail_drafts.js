import { readFile } from "node:fs/promises";
import { importPKCS8, SignJWT } from "jose";
import { mailTheme } from "./style_tokens.js";

const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_DRAFTS_URL = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";
const GMAIL_MESSAGES_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function encodeHeaderValue(value) {
  const text = String(value ?? "");
  if (/^[\x20-\x7E]*$/.test(text)) {
    return text;
  }
  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function chunkBase64(value, width = 76) {
  const text = String(value || "");
  if (!text) return "";
  const lines = [];
  for (let index = 0; index < text.length; index += width) {
    lines.push(text.slice(index, index + width));
  }
  return lines.join("\r\n");
}

function toBase64Url(value) {
  const base64 = Buffer.from(value).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildHtmlBody({ greeting = "", intro = "", footer = "" }) {
  return [
    `<html><body style="font-family:Arial,Helvetica,sans-serif;color:${mailTheme.text};line-height:1.5;">`,
    greeting ? `<p>${escapeHtml(greeting)}</p>` : "",
    intro ? `<p>${escapeHtml(intro)}</p>` : "",
    footer ? `<p>${escapeHtml(footer)}</p>` : "",
    "</body></html>"
  ].filter(Boolean).join("");
}

function buildMimeMessage({
  fromEmail,
  fromName,
  to,
  subject,
  htmlBody,
  attachments = []
}) {
  const safeFromEmail = normalizeText(fromEmail);
  const safeTo = normalizeText(to);
  const safeSubject = normalizeText(subject);
  if (!safeFromEmail) {
    throw new Error("Gmail draft creation requires a fromEmail.");
  }
  if (!safeTo) {
    throw new Error("Gmail draft creation requires a recipient email.");
  }
  if (!safeSubject) {
    throw new Error("Gmail draft creation requires a subject.");
  }

  const outerBoundary = `atp_outer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const parts = [];
  const encodedHtml = chunkBase64(Buffer.from(String(htmlBody || ""), "utf8").toString("base64"));

  const fromHeader = fromName
    ? `${encodeHeaderValue(fromName)} <${safeFromEmail}>`
    : safeFromEmail;

  parts.push(`From: ${fromHeader}`);
  parts.push(`To: ${safeTo}`);
  parts.push(`Subject: ${encodeHeaderValue(safeSubject)}`);
  parts.push("MIME-Version: 1.0");
  parts.push(`Content-Type: multipart/mixed; boundary="${outerBoundary}"`);
  parts.push("");
  parts.push(`--${outerBoundary}`);
  parts.push('Content-Type: text/html; charset="UTF-8"');
  parts.push("Content-Transfer-Encoding: base64");
  parts.push("");
  parts.push(encodedHtml);

  for (const attachment of attachments) {
    const filename = normalizeText(attachment?.filename || "attachment.bin");
    const contentType = normalizeText(attachment?.contentType || "application/octet-stream");
    const contentBuffer = Buffer.isBuffer(attachment?.content)
      ? attachment.content
      : attachment?.content instanceof Uint8Array
        ? Buffer.from(attachment.content)
        : Buffer.from(String(attachment?.content || ""), "utf8");
    const encodedAttachment = chunkBase64(contentBuffer.toString("base64"));

    parts.push(`--${outerBoundary}`);
    parts.push(`Content-Type: ${contentType}; name="${encodeHeaderValue(filename)}"`);
    parts.push("Content-Transfer-Encoding: base64");
    parts.push(`Content-Disposition: attachment; filename="${encodeHeaderValue(filename)}"`);
    parts.push("");
    parts.push(encodedAttachment);
  }

  parts.push(`--${outerBoundary}--`);
  parts.push("");
  return parts.join("\r\n");
}

async function loadServiceAccountJson(serviceAccountJsonPath, readFileImpl) {
  if (!normalizeText(serviceAccountJsonPath)) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_PATH is not configured.");
  }
  const raw = await readFileImpl(serviceAccountJsonPath, "utf8");
  const parsed = JSON.parse(raw);
  if (parsed?.type !== "service_account") {
    throw new Error("Google service account JSON must have type 'service_account'.");
  }
  if (!normalizeText(parsed.client_email)) {
    throw new Error("Google service account JSON is missing client_email.");
  }
  if (!normalizeText(parsed.private_key)) {
    throw new Error("Google service account JSON is missing private_key.");
  }
  return parsed;
}

async function exchangeAccessToken({ serviceAccount, impersonatedEmail, fetchImpl }) {
  const privateKey = await importPKCS8(serviceAccount.private_key, "RS256");
  const nowSeconds = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: GMAIL_COMPOSE_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(serviceAccount.client_email)
    .setSubject(impersonatedEmail)
    .setAudience(GOOGLE_TOKEN_URL)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + 300)
    .sign(privateKey);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });
  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !normalizeText(payload?.access_token)) {
    const detail = normalizeText(payload?.error_description || payload?.error || "");
    throw new Error(detail || "Google token exchange failed.");
  }
  return payload.access_token;
}

export function createGmailDraftsClient({
  serviceAccountJsonPath,
  impersonatedEmail,
  fetchImpl = globalThis.fetch,
  readFileImpl = readFile
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Global fetch is required for Gmail draft creation.");
  }

  const safeImpersonatedEmail = normalizeText(impersonatedEmail);
  if (!safeImpersonatedEmail) {
    throw new Error("GOOGLE_IMPERSONATED_EMAIL is not configured.");
  }

  let serviceAccountPromise = null;

  async function getServiceAccount() {
    if (!serviceAccountPromise) {
      serviceAccountPromise = loadServiceAccountJson(serviceAccountJsonPath, readFileImpl);
    }
    return serviceAccountPromise;
  }

  async function createDraft({
    to,
    subject,
    htmlBody = "",
    greeting = "",
    intro = "",
    footer = "",
    attachments = [],
    fromName = "",
    fromEmail = safeImpersonatedEmail
  }) {
    const serviceAccount = await getServiceAccount();
    const accessToken = await exchangeAccessToken({
      serviceAccount,
      impersonatedEmail: safeImpersonatedEmail,
      fetchImpl
    });

    const rawMime = buildMimeMessage({
      fromEmail,
      fromName,
      to,
      subject,
      htmlBody: htmlBody || buildHtmlBody({ greeting, intro, footer }),
      attachments
    });

    const response = await fetchImpl(GMAIL_DRAFTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: {
          raw: toBase64Url(rawMime)
        }
      })
    });
    const payload = await response.json().catch(() => ({}));
    const draftId = normalizeText(payload?.id);
    if (!response.ok || !draftId) {
      const detail = normalizeText(payload?.error?.message || payload?.error || "");
      throw new Error(detail || "Gmail draft creation failed.");
    }

    return {
      draftId,
      // Gmail API exposes draft IDs, but Google does not document a stable web URL
      // for opening an existing draft directly in the compose editor.
      gmailDraftUrl: "https://mail.google.com/mail/u/0/#drafts"
    };
  }

  async function sendMessage({
    to,
    subject,
    htmlBody = "",
    greeting = "",
    intro = "",
    footer = "",
    attachments = [],
    fromName = "",
    fromEmail = safeImpersonatedEmail
  }) {
    const serviceAccount = await getServiceAccount();
    const accessToken = await exchangeAccessToken({
      serviceAccount,
      impersonatedEmail: safeImpersonatedEmail,
      fetchImpl
    });

    const rawMime = buildMimeMessage({
      fromEmail,
      fromName,
      to,
      subject,
      htmlBody: htmlBody || buildHtmlBody({ greeting, intro, footer }),
      attachments
    });

    const response = await fetchImpl(GMAIL_MESSAGES_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        raw: toBase64Url(rawMime)
      })
    });
    const payload = await response.json().catch(() => ({}));
    const messageId = normalizeText(payload?.id);
    if (!response.ok || !messageId) {
      const detail = normalizeText(payload?.error?.message || payload?.error || "");
      throw new Error(detail || "Gmail message send failed.");
    }
    return { messageId };
  }

  return Object.freeze({
    createDraft,
    sendMessage
  });
}
