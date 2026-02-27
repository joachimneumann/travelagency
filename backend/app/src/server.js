import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createAuth } from "./auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(APP_ROOT, "data", "store.json");
const TOURS_DIR = path.join(APP_ROOT, "data", "tours");
const INVOICES_DIR = path.join(APP_ROOT, "data", "invoices");
const TEMP_UPLOAD_DIR = path.join(APP_ROOT, "data", "tmp");
const STAFF_PATH = path.join(APP_ROOT, "config", "staff.json");
const PORT = Number(process.env.PORT || 8787);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const STRIPE_SECRET_KEY = normalizeText(process.env.STRIPE_SECRET_KEY);
const STRIPE_API_BASE = normalizeText(process.env.STRIPE_API_BASE_URL) || "https://api.stripe.com";
const STRIPE_WEBHOOK_SECRET = normalizeText(process.env.STRIPE_WEBHOOK_SECRET);
const STRIPE_CHECKOUT_SUCCESS_URL = normalizeText(process.env.STRIPE_CHECKOUT_SUCCESS_URL);
const STRIPE_CHECKOUT_CANCEL_URL = normalizeText(process.env.STRIPE_CHECKOUT_CANCEL_URL);
const PUBLIC_BASE_URL = normalizeText(process.env.PUBLIC_BASE_URL);
const execFile = promisify(execFileCb);

const STAGES = {
  NEW: "NEW",
  QUALIFIED: "QUALIFIED",
  PROPOSAL_SENT: "PROPOSAL_SENT",
  NEGOTIATION: "NEGOTIATION",
  WON: "WON",
  LOST: "LOST",
  POST_TRIP: "POST_TRIP"
};

const STAGE_ORDER = [
  STAGES.NEW,
  STAGES.QUALIFIED,
  STAGES.PROPOSAL_SENT,
  STAGES.NEGOTIATION,
  STAGES.WON,
  STAGES.LOST,
  STAGES.POST_TRIP
];

const ALLOWED_STAGE_TRANSITIONS = {
  [STAGES.NEW]: STAGE_ORDER,
  [STAGES.QUALIFIED]: STAGE_ORDER,
  [STAGES.PROPOSAL_SENT]: STAGE_ORDER,
  [STAGES.NEGOTIATION]: STAGE_ORDER,
  [STAGES.WON]: STAGE_ORDER,
  [STAGES.LOST]: STAGE_ORDER,
  [STAGES.POST_TRIP]: STAGE_ORDER
};

const SLA_HOURS = {
  [STAGES.NEW]: 2,
  [STAGES.QUALIFIED]: 8,
  [STAGES.PROPOSAL_SENT]: 24,
  [STAGES.NEGOTIATION]: 48,
  [STAGES.WON]: 24,
  [STAGES.LOST]: 0,
  [STAGES.POST_TRIP]: 0
};

let writeQueue = Promise.resolve();
const auth = createAuth({ port: PORT });

const routes = [
  ...auth.routes,
  { method: "GET", pattern: /^\/health$/, handler: handleHealth },
  { method: "GET", pattern: /^\/public\/v1\/tours$/, handler: handlePublicListTours },
  { method: "GET", pattern: /^\/public\/v1\/tour-images\/(.+)$/, handler: handlePublicTourImage },
  { method: "POST", pattern: /^\/public\/v1\/leads$/, handler: handleCreateLead },
  { method: "GET", pattern: /^\/api\/v1\/leads$/, handler: handleListLeads },
  { method: "GET", pattern: /^\/api\/v1\/leads\/([^/]+)$/, handler: handleGetLead },
  { method: "PATCH", pattern: /^\/api\/v1\/leads\/([^/]+)\/stage$/, handler: handlePatchLeadStage },
  { method: "PATCH", pattern: /^\/api\/v1\/leads\/([^/]+)\/owner$/, handler: handlePatchLeadOwner },
  { method: "GET", pattern: /^\/api\/v1\/leads\/([^/]+)\/activities$/, handler: handleListActivities },
  { method: "POST", pattern: /^\/api\/v1\/leads\/([^/]+)\/activities$/, handler: handleCreateActivity },
  { method: "GET", pattern: /^\/api\/v1\/leads\/([^/]+)\/invoices$/, handler: handleListLeadInvoices },
  { method: "POST", pattern: /^\/api\/v1\/leads\/([^/]+)\/invoices$/, handler: handleCreateLeadInvoice },
  { method: "PATCH", pattern: /^\/api\/v1\/leads\/([^/]+)\/invoices\/([^/]+)$/, handler: handlePatchLeadInvoice },
  { method: "POST", pattern: /^\/api\/v1\/leads\/([^/]+)\/invoices\/([^/]+)\/send$/, handler: handleSendLeadInvoice },
  { method: "GET", pattern: /^\/api\/v1\/invoices\/([^/]+)\/pdf$/, handler: handleGetInvoicePdf },
  { method: "GET", pattern: /^\/public\/v1\/invoices\/([^/]+)$/, handler: handleGetPublicInvoice },
  { method: "GET", pattern: /^\/public\/v1\/invoices\/([^/]+)\/pdf$/, handler: handleGetPublicInvoicePdf },
  { method: "POST", pattern: /^\/public\/v1\/invoices\/([^/]+)\/checkout-session$/, handler: handleCreateInvoiceCheckoutSession },
  { method: "GET", pattern: /^\/public\/invoice\/([^/]+)$/, handler: handlePublicInvoicePage },
  { method: "GET", pattern: /^\/api\/v1\/customers$/, handler: handleListCustomers },
  { method: "GET", pattern: /^\/api\/v1\/customers\/([^/]+)$/, handler: handleGetCustomer },
  { method: "GET", pattern: /^\/api\/v1\/customers\/([^/]+)\/offers$/, handler: handleListCustomerOffers },
  { method: "POST", pattern: /^\/api\/v1\/customers\/([^/]+)\/offers$/, handler: handleCreateCustomerOffer },
  { method: "GET", pattern: /^\/api\/v1\/staff$/, handler: handleListStaff },
  { method: "GET", pattern: /^\/api\/v1\/tours$/, handler: handleListTours },
  { method: "GET", pattern: /^\/api\/v1\/tours\/([^/]+)$/, handler: handleGetTour },
  { method: "POST", pattern: /^\/api\/v1\/tours$/, handler: handleCreateTour },
  { method: "PATCH", pattern: /^\/api\/v1\/tours\/([^/]+)$/, handler: handlePatchTour },
  { method: "POST", pattern: /^\/api\/v1\/tours\/([^/]+)\/image$/, handler: handleUploadTourImage },
  { method: "GET", pattern: /^\/api\/v1\/offers\/([^/]+)$/, handler: handleGetOfferAdmin },
  { method: "POST", pattern: /^\/api\/v1\/offers\/([^/]+)\/send$/, handler: handleMarkOfferSent },
  { method: "POST", pattern: /^\/public\/v1\/offers\/([^/]+)\/checkout-session$/, handler: handleCreatePublicCheckoutSession },
  { method: "GET", pattern: /^\/public\/v1\/offers\/([^/]+)$/, handler: handleGetPublicOffer },
  { method: "GET", pattern: /^\/public\/offer\/([^/]+)$/, handler: handlePublicOfferPage },
  { method: "POST", pattern: /^\/webhooks\/stripe$/, handler: handleStripeWebhook },
  { method: "GET", pattern: /^\/admin$/, handler: handleAdminHome },
  { method: "GET", pattern: /^\/admin\/customers$/, handler: handleAdminCustomersPage },
  { method: "GET", pattern: /^\/admin\/customers\/([^/]+)$/, handler: handleAdminCustomerDetailPage },
  { method: "GET", pattern: /^\/admin\/leads$/, handler: handleAdminLeadsPage },
  { method: "GET", pattern: /^\/admin\/leads\/([^/]+)$/, handler: handleAdminLeadDetailPage }
];

await ensureStorage();

createServer(async (req, res) => {
  try {
    auth.pruneState();
    withCors(req, res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const requestUrl = new URL(req.url, "http://localhost");
    const pathname = requestUrl.pathname;

    if (pathname.startsWith("/admin") && auth.isKeycloakEnabled()) {
      if (!auth.hasSession(req)) {
        const returnTo = `${pathname}${requestUrl.search || ""}`;
        redirect(res, auth.getLoginRedirect(returnTo));
        return;
      }
    }

    if (pathname.startsWith("/api/v1/")) {
      const authz = await auth.authorizeApiRequest(req, requestUrl);
      if (!authz.ok) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
    }

    for (const route of routes) {
      if (route.method !== req.method) continue;
      const match = pathname.match(route.pattern);
      if (!match) continue;
      const params = match.slice(1);
      await route.handler(req, res, params);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: "Internal server error", detail: String(error?.message || error) });
  }
}).listen(PORT, () => {
  console.log(`Chapter2 backend listening on http://localhost:${PORT}`);
});

async function ensureStorage() {
  await mkdir(TOURS_DIR, { recursive: true });
  await mkdir(INVOICES_DIR, { recursive: true });
  await mkdir(TEMP_UPLOAD_DIR, { recursive: true });
}

function withCors(req, res) {
  const requestOrigin = normalizeText(req.headers.origin);
  const allowAny = CORS_ORIGIN === "*";
  const allowThisOrigin = allowAny ? requestOrigin || "*" : CORS_ORIGIN;

  if (allowThisOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowThisOrigin);
  }
  if (requestOrigin) {
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...extraHeaders });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function getMimeTypeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".avif") return "image/avif";
  return "application/octet-stream";
}

async function sendFileWithCache(req, res, filePath, cacheControl) {
  let fileStats;
  try {
    fileStats = await stat(filePath);
  } catch {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (!fileStats.isFile()) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const etag = `W/"${fileStats.size}-${Number(fileStats.mtimeMs)}"`;
  const ifNoneMatch = normalizeText(req.headers["if-none-match"]);
  if (ifNoneMatch === etag) {
    res.writeHead(304, {
      "Cache-Control": cacheControl,
      ETag: etag
    });
    res.end();
    return;
  }

  res.writeHead(200, {
    "Content-Type": getMimeTypeFromExt(filePath),
    "Cache-Control": cacheControl,
    ETag: etag,
    "Content-Length": String(fileStats.size)
  });

  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Unable to read file" });
    } else {
      res.end();
    }
  });
  stream.pipe(res);
}

async function readBodyJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  return JSON.parse(text);
}

async function readStore() {
  const raw = await readFile(DATA_PATH, "utf8");
  const parsed = JSON.parse(raw);
  parsed.customers ||= [];
  parsed.leads ||= [];
  parsed.activities ||= [];
  parsed.customer_offers ||= [];
  parsed.invoices ||= [];
  parsed.payments ||= [];
  return parsed;
}

async function persistStore(store) {
  writeQueue = writeQueue.then(async () => {
    const next = `${JSON.stringify(store, null, 2)}\n`;
    await writeFile(DATA_PATH, next, "utf8");
  });
  await writeQueue;
}

async function readTours() {
  const items = [];
  const entries = await readdir(TOURS_DIR, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const tourPath = path.join(TOURS_DIR, entry.name, "tour.json");
    try {
      const raw = await readFile(tourPath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && normalizeText(parsed.id)) {
        items.push(parsed);
      }
    } catch {
      // Ignore unreadable tour folders.
    }
  }

  return items;
}

function tourFolderPath(tourId) {
  return path.join(TOURS_DIR, tourId);
}

function tourJsonPath(tourId) {
  return path.join(tourFolderPath(tourId), "tour.json");
}

async function persistTour(tour) {
  writeQueue = writeQueue.then(async () => {
    const id = normalizeText(tour?.id);
    if (!id) throw new Error("Tour id is required");
    await mkdir(tourFolderPath(id), { recursive: true });
    await writeFile(tourJsonPath(id), `${JSON.stringify(tour, null, 2)}\n`, "utf8");
  });
  await writeQueue;
}

async function loadStaff() {
  const raw = await readFile(STAFF_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function safeInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeFloat(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeCurrency(value) {
  const normalized = normalizeText(value).toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "USD";
}

function safeAmountCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded > 0 ? rounded : null;
}

function normalizeCompareText(value) {
  return normalizeText(value).replace(/\s+/g, " ").toLowerCase();
}

function generatePublicToken() {
  return `off_${randomBytes(24).toString("hex")}`;
}

function generateInvoiceToken() {
  return `inv_${randomBytes(24).toString("hex")}`;
}

function getPublicBaseUrl(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL.replace(/\/+$/, "");
  const host = normalizeText(req.headers.host) || `localhost:${PORT}`;
  const proto = normalizeText(req.headers["x-forwarded-proto"]) || "http";
  return `${proto}://${host}`;
}

function getOfferPublicLink(req, token) {
  return `${getPublicBaseUrl(req)}/public/offer/${encodeURIComponent(token)}`;
}

function resolveCheckoutReturnUrl(template, fallbackUrl, token) {
  const text = normalizeText(template);
  if (!text) return fallbackUrl;
  return text.includes("{token}") ? text.replaceAll("{token}", encodeURIComponent(token)) : text;
}

function formatMoney(amountCents, currency) {
  const value = Number(amountCents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: safeCurrency(currency) }).format(value);
  } catch {
    return `${safeCurrency(currency)} ${value.toFixed(2)}`;
  }
}

function normalizeOfferItem(input, tour) {
  const quantity = Math.max(1, safeInt(input.quantity) || 1);
  const unitAmountCents = safeAmountCents(input.unit_amount_cents) ?? Math.max(100, Math.round(Number(tour.priceFrom || 0) * 100));
  const destinationCountries = tourDestinationCountries(tour);
  const styles = Array.isArray(tour.styles) ? tour.styles.map((s) => normalizeText(s)).filter(Boolean) : [];
  return {
    id: `ofi_${randomUUID()}`,
    tour_id: tour.id,
    title: normalizeText(input.title) || normalizeText(tour.title),
    short_description: normalizeText(input.short_description) || normalizeText(tour.shortDescription),
    destinationCountries,
    styles,
    seasonality: normalizeText(tour.seasonality),
    travelers: Math.max(1, safeInt(input.travelers) || 1),
    start_date: normalizeText(input.start_date) || null,
    end_date: normalizeText(input.end_date) || null,
    customer_notes: normalizeText(input.customer_notes) || "",
    line_description: normalizeText(input.line_description) || "Private tour package",
    quantity,
    unit_amount_cents: unitAmountCents,
    total_amount_cents: unitAmountCents * quantity
  };
}

function computeOfferTotals(offer) {
  const total = (Array.isArray(offer.items) ? offer.items : []).reduce((sum, item) => sum + (safeAmountCents(item.total_amount_cents) || 0), 0);
  const deposit = safeAmountCents(offer.payment?.deposit_amount_cents);
  return {
    total_amount_cents: total,
    due_now_amount_cents: deposit && deposit < total ? deposit : total
  };
}

function sanitizePublicOffer(offer, customer) {
  const totals = computeOfferTotals(offer);
  return {
    offer: {
      id: offer.id,
      token: offer.public_token,
      status: offer.status,
      title: offer.title,
      intro_message: offer.intro_message,
      items: offer.items,
      payment: {
        currency: offer.payment.currency,
        total_amount_cents: totals.total_amount_cents,
        due_now_amount_cents: totals.due_now_amount_cents,
        due_at: offer.payment.due_at || null,
        allow_partial: Boolean(offer.payment.allow_partial)
      },
      created_at: offer.created_at,
      updated_at: offer.updated_at,
      sent_at: offer.sent_at || null,
      paid_at: offer.paid_at || null
    },
    customer: {
      name: normalizeText(customer?.name) || "Guest",
      email: normalizeEmail(customer?.email),
      language: normalizeText(customer?.language) || "English"
    }
  };
}

function validateOfferPayload(payload) {
  if (!payload || typeof payload !== "object") return "Invalid payload";
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return "At least one tour item is required";
  return "";
}

function parseStripeSignature(headerValue) {
  const parts = String(headerValue || "").split(",");
  let timestamp = "";
  let signature = "";
  for (const part of parts) {
    const [k, v] = part.split("=", 2);
    if (k === "t") timestamp = v;
    if (k === "v1") signature = v;
  }
  return { timestamp, signature };
}

function verifyStripeWebhookSignature(rawBody, signatureHeader, secret) {
  const { timestamp, signature } = parseStripeSignature(signatureHeader);
  if (!timestamp || !signature) return false;
  const signedPayload = `${timestamp}.${rawBody}`;
  const digest = createHmac("sha256", secret).update(signedPayload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function createStripeCheckoutSession({ offer, customer, amountCents, currency, successUrl, cancelUrl }) {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", successUrl);
  body.set("cancel_url", cancelUrl);
  body.set("customer_email", normalizeEmail(customer.email));
  body.set("line_items[0][price_data][currency]", safeCurrency(currency).toLowerCase());
  body.set("line_items[0][price_data][unit_amount]", String(amountCents));
  body.set("line_items[0][price_data][product_data][name]", normalizeText(offer.title) || "Chapter2 Travel Package");
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[offer_id]", offer.id);
  body.set("metadata[offer_token]", offer.public_token);
  body.set("metadata[customer_id]", offer.customer_id);

  const response = await fetch(`${STRIPE_API_BASE}/v1/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = normalizeText(payload?.error?.message) || "Stripe Checkout session creation failed";
    throw new Error(message);
  }
  return payload;
}

function computeSlaDueAt(stage, from = new Date()) {
  const hours = SLA_HOURS[stage] ?? 0;
  if (!hours) return null;
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }
  const text = normalizeText(value);
  if (!text) return [];
  return text
    .split(",")
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function normalizeHighlights(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }
  const text = normalizeText(value);
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

function tourDestinationCountries(tour) {
  const fromArray = Array.isArray(tour?.destinationCountries) ? tour.destinationCountries : [];
  return Array.from(new Set(fromArray.map((value) => normalizeText(value)).filter(Boolean)));
}

function toTourImagePublicUrl(imageValue) {
  const text = normalizeText(imageValue);
  if (!text) return "";
  if (text.startsWith("http://") || text.startsWith("https://")) return text;
  if (text.startsWith("/public/v1/tour-images/")) return text;
  if (text.startsWith("/")) return text;
  return `/public/v1/tour-images/${text}`;
}

function normalizeTourForRead(tour) {
  const destinationCountries = tourDestinationCountries(tour);
  const image = toTourImagePublicUrl(tour.image);
  return {
    ...tour,
    destinationCountries,
    image
  };
}

function collectTourOptions(tours) {
  const destinations = Array.from(
    new Set(tours.flatMap((tour) => tourDestinationCountries(tour)).map((value) => normalizeText(value)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const styles = Array.from(
    new Set(
      tours
        .flatMap((tour) => (Array.isArray(tour.styles) ? tour.styles : []))
        .map((style) => normalizeText(style))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  return { destinations, styles };
}

function resolveTourImageDiskPath(relativePath) {
  const decoded = decodeURIComponent(normalizeText(relativePath));
  if (!decoded || decoded.includes("\0")) return "";
  const normalized = path.posix.normalize(decoded.replaceAll("\\", "/")).replace(/^\/+/, "");
  if (!normalized || normalized.startsWith("..") || normalized.includes("/../")) return "";
  const absolute = path.resolve(TOURS_DIR, normalized);
  if (!absolute.startsWith(TOURS_DIR)) return "";
  return absolute;
}

function invoicePdfPath(invoiceId, version) {
  return path.join(INVOICES_DIR, `${invoiceId}-v${version}.pdf`);
}

function buildInvoicePublicPdfUrl(token) {
  return `/public/v1/invoices/${encodeURIComponent(token)}/pdf`;
}

function getInvoicePublicLink(req, token) {
  return `${getPublicBaseUrl(req)}/public/invoice/${encodeURIComponent(token)}`;
}

function normalizeInvoiceItems(items) {
  const input = Array.isArray(items) ? items : [];
  return input
    .map((item) => {
      const description = normalizeText(item?.description);
      const quantity = Math.max(1, safeInt(item?.quantity) || 1);
      const unitAmountCents = safeAmountCents(item?.unit_amount_cents);
      const totalAmountCents = unitAmountCents ? unitAmountCents * quantity : null;
      if (!description || !unitAmountCents) return null;
      return {
        id: normalizeText(item?.id) || `inv_item_${randomUUID()}`,
        description,
        quantity,
        unit_amount_cents: unitAmountCents,
        total_amount_cents: totalAmountCents
      };
    })
    .filter(Boolean);
}

function computeInvoiceTotal(items) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + (safeAmountCents(item?.total_amount_cents) || 0), 0);
}

function nextInvoiceNumber(store) {
  const prefix = "CH2-";
  const currentMax = (store.invoices || []).reduce((max, inv) => {
    const match = String(inv.invoice_number || "").match(/^CH2-(\d+)$/);
    if (!match) return max;
    const n = Number(match[1]);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  return `${prefix}${String(currentMax + 1).padStart(6, "0")}`;
}

function escapePdfText(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function buildMinimalInvoicePdfBuffer(invoice, customer, lead) {
  const currency = safeCurrency(invoice.currency);
  const lines = [
    `Chapter2 Travel Agency - Invoice ${invoice.invoice_number}`,
    `Invoice ID: ${invoice.id}`,
    `Version: ${invoice.version}`,
    `Date: ${invoice.issue_date || ""}`,
    `Due date: ${invoice.due_date || ""}`,
    `Status: ${invoice.status}`,
    "",
    `Customer: ${normalizeText(customer?.name)}`,
    `Email: ${normalizeEmail(customer?.email)}`,
    `Lead ID: ${normalizeText(lead?.id)}`,
    `Destination: ${normalizeText(lead?.destination)}`,
    `Style: ${normalizeText(lead?.style)}`,
    ""
  ];

  for (const item of invoice.items || []) {
    const qty = Number(item.quantity || 1);
    const unit = formatMoney(item.unit_amount_cents, currency);
    const total = formatMoney(item.total_amount_cents, currency);
    lines.push(`${item.description} | qty ${qty} | unit ${unit} | total ${total}`);
  }

  lines.push("");
  lines.push(`Total: ${formatMoney(invoice.total_amount_cents, currency)}`);
  lines.push(`Notes: ${normalizeText(invoice.notes) || "-"}`);
  lines.push(`Payment link token: ${invoice.public_token}`);

  const maxLines = 42;
  const display = lines.slice(0, maxLines);

  let y = 800;
  const ops = ["BT", "/F1 11 Tf", "50 810 Td"];
  for (let i = 0; i < display.length; i += 1) {
    const text = escapePdfText(display[i]);
    if (i === 0) {
      ops.push(`(${text}) Tj`);
      continue;
    }
    y -= 16;
    ops.push(`1 0 0 1 50 ${y} Tm (${text}) Tj`);
  }
  ops.push("ET");
  const content = ops.join("\n");
  const contentLength = Buffer.byteLength(content, "utf8");

  const objects = [];
  const pushObj = (body) => {
    objects.push(body);
  };

  pushObj("<< /Type /Catalog /Pages 2 0 R >>");
  pushObj("<< /Type /Pages /Count 1 /Kids [3 0 R] >>");
  pushObj("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>");
  pushObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pushObj(`<< /Length ${contentLength} >>\nstream\n${content}\nendstream`);

  let offset = 0;
  const chunks = [];
  const header = "%PDF-1.4\n";
  chunks.push(header);
  offset += Buffer.byteLength(header, "utf8");

  const xref = [0];
  for (let i = 0; i < objects.length; i += 1) {
    xref.push(offset);
    const objStr = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    chunks.push(objStr);
    offset += Buffer.byteLength(objStr, "utf8");
  }

  const xrefStart = offset;
  let xrefStr = `xref\n0 ${objects.length + 1}\n`;
  xrefStr += "0000000000 65535 f \n";
  for (let i = 1; i < xref.length; i += 1) {
    xrefStr += `${String(xref[i]).padStart(10, "0")} 00000 n \n`;
  }
  xrefStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(xrefStr);

  return Buffer.from(chunks.join(""), "utf8");
}

function levenshtein(a, b) {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  const prev = new Array(t.length + 1);
  const curr = new Array(t.length + 1);

  for (let j = 0; j <= t.length; j += 1) prev[j] = j;

  for (let i = 1; i <= s.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= t.length; j += 1) prev[j] = curr[j];
  }

  return curr[t.length];
}

function chooseOwner(staffList, leads, destination, language) {
  const activeStaff = staffList.filter((s) => s.active);
  const normalizedDestination = normalizeText(destination);
  const normalizedLanguage = normalizeText(language);

  let candidates = activeStaff.filter((staff) => {
    const destinationMatch = staff.destinations?.includes(normalizedDestination);
    const languageMatch = !normalizedLanguage || staff.languages?.includes(normalizedLanguage);
    return destinationMatch && languageMatch;
  });

  if (!candidates.length) {
    candidates = activeStaff.filter((staff) => {
      const destinationMatch = staff.destinations?.includes(normalizedDestination);
      return destinationMatch;
    });
  }

  if (!candidates.length) candidates = activeStaff;
  if (!candidates.length) return null;

  const openStages = new Set([STAGES.NEW, STAGES.QUALIFIED, STAGES.PROPOSAL_SENT, STAGES.NEGOTIATION, STAGES.WON]);

  const byLoad = candidates
    .map((staff) => {
      const load = leads.filter((lead) => lead.owner_id === staff.id && openStages.has(lead.stage)).length;
      return { staff, load };
    })
    .sort((a, b) => a.load - b.load || a.staff.name.localeCompare(b.staff.name));

  return byLoad[0].staff;
}

function findMatchingCustomer(customers, candidate) {
  const email = normalizeEmail(candidate.email);
  const phone = normalizePhone(candidate.phone);
  const name = normalizeText(candidate.name);

  if (email) {
    const byEmail = customers.find((c) => normalizeEmail(c.email) === email);
    if (byEmail) return byEmail;
  }

  if (phone) {
    const byPhone = customers.find((c) => normalizePhone(c.phone) === phone);
    if (byPhone) return byPhone;
  }

  if (name.length >= 4) {
    const byName = customers.find((c) => {
      const cName = normalizeText(c.name);
      if (!cName) return false;
      const distance = levenshtein(name, cName);
      return distance <= 2;
    });
    if (byName) return byName;
  }

  return null;
}

function validateLeadInput(payload) {
  const required = ["name", "email", "destination", "style", "travelMonth", "travelers", "duration"];
  const missing = required.filter((key) => !normalizeText(payload[key]));
  if (missing.length) {
    return { ok: false, error: `Missing required fields: ${missing.join(", ")}` };
  }

  const email = normalizeEmail(payload.email);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) return { ok: false, error: "Invalid email" };

  const travelers = safeInt(payload.travelers);
  if (!travelers || travelers < 1 || travelers > 30) {
    return { ok: false, error: "Travelers must be between 1 and 30" };
  }

  return { ok: true };
}

function addActivity(store, leadId, type, actor, detail) {
  const activity = {
    id: `act_${randomUUID()}`,
    lead_id: leadId,
    type,
    actor: actor || "system",
    detail: detail || "",
    created_at: nowIso()
  };
  store.activities.push(activity);
  return activity;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeStageFilter(value) {
  const stage = normalizeText(value).toUpperCase();
  return STAGE_ORDER.includes(stage) ? stage : "";
}

function getLeadCustomerLookup(store) {
  return new Map(store.customers.map((customer) => [customer.id, customer]));
}

function filterAndSortLeads(store, query) {
  const stage = normalizeStageFilter(query.get("stage"));
  const ownerId = normalizeText(query.get("owner_id"));
  const search = normalizeText(query.get("search")).toLowerCase();
  const sort = normalizeText(query.get("sort")) || "created_at_desc";
  const customersById = getLeadCustomerLookup(store);

  const filtered = store.leads.filter((lead) => {
    if (stage && lead.stage !== stage) return false;
    if (ownerId && lead.owner_id !== ownerId) return false;
    if (!search) return true;

    const customer = customersById.get(lead.customer_id);
    const haystack = [
      lead.id,
      lead.destination,
      lead.style,
      lead.owner_name,
      lead.notes,
      customer?.name,
      customer?.email
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "created_at_asc":
        return a.created_at.localeCompare(b.created_at);
      case "updated_at_desc":
        return b.updated_at.localeCompare(a.updated_at);
      case "sla_due_at_asc":
        return String(a.sla_due_at || "9999-12-31T23:59:59.999Z").localeCompare(
          String(b.sla_due_at || "9999-12-31T23:59:59.999Z")
        );
      case "sla_due_at_desc":
        return String(b.sla_due_at || "").localeCompare(String(a.sla_due_at || ""));
      case "created_at_desc":
      default:
        return b.created_at.localeCompare(a.created_at);
    }
  });

  return {
    items: sorted,
    filters: { stage: stage || null, owner_id: ownerId || null, search: search || null },
    sort
  };
}

function paginate(items, query) {
  const page = clamp(safeInt(query.get("page")) || 1, 1, 100000);
  const pageSize = clamp(safeInt(query.get("page_size")) || 25, 1, 100);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const offset = (page - 1) * pageSize;

  return {
    items: items.slice(offset, offset + pageSize),
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages
  };
}

async function handleHealth(_req, res) {
  sendJson(res, 200, {
    ok: true,
    service: "chapter2-backend",
    stage_values: STAGE_ORDER,
    timestamp: nowIso()
  });
}

async function handleCreateLead(req, res) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const check = validateLeadInput(payload);
  if (!check.ok) {
    sendJson(res, 422, { error: check.error });
    return;
  }

  const store = await readStore();
  const staff = await loadStaff();
  const idempotencyKey = normalizeText(req.headers["idempotency-key"]);

  if (idempotencyKey) {
    const existingByKey = store.leads.find((lead) => lead.idempotency_key === idempotencyKey);
    if (existingByKey) {
      sendJson(res, 200, {
        lead_id: existingByKey.id,
        customer_id: existingByKey.customer_id,
        status: "accepted",
        deduplicated: true,
        message: "Lead already captured with this idempotency key"
      });
      return;
    }
  }

  const customerMatch = findMatchingCustomer(store.customers, payload);
  let customer;

  if (customerMatch) {
    customer = {
      ...customerMatch,
      name: normalizeText(payload.name) || customerMatch.name,
      email: normalizeEmail(payload.email) || customerMatch.email,
      phone: normalizePhone(payload.phone) || customerMatch.phone,
      language: normalizeText(payload.language) || customerMatch.language,
      updated_at: nowIso()
    };
    const idx = store.customers.findIndex((c) => c.id === customer.id);
    store.customers[idx] = customer;
  } else {
    customer = {
      id: `cust_${randomUUID()}`,
      name: normalizeText(payload.name),
      email: normalizeEmail(payload.email),
      phone: normalizePhone(payload.phone),
      language: normalizeText(payload.language) || "English",
      created_at: nowIso(),
      updated_at: nowIso(),
      tags: []
    };
    store.customers.push(customer);
  }

  const owner = chooseOwner(staff, store.leads, payload.destination, payload.language);
  const lead = {
    id: `lead_${randomUUID()}`,
    customer_id: customer.id,
    stage: STAGES.NEW,
    owner_id: owner?.id || null,
    owner_name: owner?.name || null,
    sla_due_at: computeSlaDueAt(STAGES.NEW),
    destination: normalizeText(payload.destination),
    style: normalizeText(payload.style),
    travel_month: normalizeText(payload.travelMonth),
    travelers: safeInt(payload.travelers),
    duration: normalizeText(payload.duration),
    budget: normalizeText(payload.budget),
    notes: normalizeText(payload.notes),
    source: {
      page_url: normalizeText(payload.pageUrl),
      utm_source: normalizeText(payload.utm_source),
      utm_medium: normalizeText(payload.utm_medium),
      utm_campaign: normalizeText(payload.utm_campaign),
      referrer: normalizeText(payload.referrer)
    },
    idempotency_key: idempotencyKey || null,
    created_at: nowIso(),
    updated_at: nowIso()
  };

  store.leads.push(lead);
  addActivity(store, lead.id, "LEAD_CREATED", "public_api", "Lead created from website form");
  if (lead.owner_id) {
    addActivity(store, lead.id, "OWNER_ASSIGNED", "system", `Assigned to ${lead.owner_name}`);
  }

  await persistStore(store);

  sendJson(res, 201, {
    lead_id: lead.id,
    customer_id: customer.id,
    status: "accepted",
    deduplicated: Boolean(customerMatch),
    owner: lead.owner_name,
    sla_due_at: lead.sla_due_at,
    next_step_message: "Thanks, we will contact you with route options within 48-72h."
  });
}

async function handleListLeads(req, res) {
  const store = await readStore();
  const requestUrl = new URL(req.url, "http://localhost");
  const { items: filtered, filters, sort } = filterAndSortLeads(store, requestUrl.searchParams);
  const paged = paginate(filtered, requestUrl.searchParams);
  sendJson(res, 200, {
    items: paged.items,
    total: paged.total,
    page: paged.page,
    page_size: paged.page_size,
    total_pages: paged.total_pages,
    filters,
    sort
  });
}

async function handleGetLead(_req, res, [leadId]) {
  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }

  const customer = store.customers.find((item) => item.id === lead.customer_id) || null;
  sendJson(res, 200, { lead, customer });
}

async function handlePatchLeadStage(req, res, [leadId]) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const nextStage = normalizeText(payload.stage).toUpperCase();
  if (!STAGE_ORDER.includes(nextStage)) {
    sendJson(res, 422, { error: "Invalid stage" });
    return;
  }

  const actor = normalizeText(payload.actor) || "staff";
  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }

  const allowed = ALLOWED_STAGE_TRANSITIONS[lead.stage] || [];
  if (!allowed.includes(nextStage)) {
    sendJson(res, 409, { error: `Transition ${lead.stage} -> ${nextStage} is not allowed` });
    return;
  }

  lead.stage = nextStage;
  lead.sla_due_at = computeSlaDueAt(nextStage);
  lead.updated_at = nowIso();

  addActivity(store, lead.id, "STAGE_CHANGED", actor, `Stage updated to ${nextStage}`);
  await persistStore(store);

  sendJson(res, 200, { lead });
}

async function handlePatchLeadOwner(req, res, [leadId]) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const ownerIdRaw = normalizeText(payload.owner_id);
  const actor = normalizeText(payload.actor) || "staff";
  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }

  if (!ownerIdRaw) {
    lead.owner_id = null;
    lead.owner_name = null;
    lead.updated_at = nowIso();
    addActivity(store, lead.id, "OWNER_CHANGED", actor, "Owner unassigned");
    await persistStore(store);
    sendJson(res, 200, { lead });
    return;
  }

  const staff = await loadStaff();
  const owner = staff.find((member) => member.id === ownerIdRaw && member.active);
  if (!owner) {
    sendJson(res, 422, { error: "Owner not found or inactive" });
    return;
  }

  lead.owner_id = owner.id;
  lead.owner_name = owner.name;
  lead.updated_at = nowIso();
  addActivity(store, lead.id, "OWNER_CHANGED", actor, `Owner set to ${owner.name}`);
  await persistStore(store);

  sendJson(res, 200, { lead });
}

async function handleListActivities(_req, res, [leadId]) {
  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }

  const items = store.activities
    .filter((activity) => activity.lead_id === leadId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  sendJson(res, 200, { items, total: items.length });
}

async function handleCreateActivity(req, res, [leadId]) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const type = normalizeText(payload.type).toUpperCase();
  const actor = normalizeText(payload.actor) || "staff";
  const detail = normalizeText(payload.detail);

  if (!type) {
    sendJson(res, 422, { error: "type is required" });
    return;
  }

  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }

  const activity = addActivity(store, lead.id, type, actor, detail);
  lead.updated_at = nowIso();
  await persistStore(store);

  sendJson(res, 201, { activity });
}

function buildInvoiceReadModel(req, invoice, customer, lead) {
  const publicLink = getInvoicePublicLink(req, invoice.public_token);
  return {
    ...invoice,
    public_link: publicLink,
    pdf_url: `/api/v1/invoices/${encodeURIComponent(invoice.id)}/pdf`,
    public_pdf_url: `${getPublicBaseUrl(req)}${buildInvoicePublicPdfUrl(invoice.public_token)}`,
    customer_name: normalizeText(customer?.name),
    customer_email: normalizeEmail(customer?.email),
    lead_id: normalizeText(lead?.id)
  };
}

async function writeInvoicePdf(invoice, customer, lead) {
  const buffer = buildMinimalInvoicePdfBuffer(invoice, customer, lead);
  await mkdir(INVOICES_DIR, { recursive: true });
  await writeFile(invoicePdfPath(invoice.id, invoice.version), buffer);
}

async function handleListLeadInvoices(req, res, [leadId]) {
  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }
  const customer = store.customers.find((item) => item.id === lead.customer_id) || null;
  const items = [...store.invoices]
    .filter((invoice) => invoice.lead_id === leadId)
    .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")))
    .map((invoice) => buildInvoiceReadModel(req, invoice, customer, lead));
  sendJson(res, 200, { items, total: items.length });
}

async function handleCreateLeadInvoice(req, res, [leadId]) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }
  const customer = store.customers.find((item) => item.id === lead.customer_id);
  if (!customer) {
    sendJson(res, 422, { error: "Lead customer not found" });
    return;
  }

  const items = normalizeInvoiceItems(payload.items);
  if (!items.length) {
    sendJson(res, 422, { error: "At least one valid invoice item is required" });
    return;
  }

  const now = nowIso();
  const totalAmountCents = computeInvoiceTotal(items);
  const dueAmountCents = safeAmountCents(payload.due_amount_cents) ?? totalAmountCents;
  const invoice = {
    id: `inv_${randomUUID()}`,
    lead_id: leadId,
    customer_id: customer.id,
    invoice_number: normalizeText(payload.invoice_number) || nextInvoiceNumber(store),
    version: 1,
    status: "DRAFT",
    currency: safeCurrency(payload.currency),
    issue_date: normalizeText(payload.issue_date) || now.slice(0, 10),
    due_date: normalizeText(payload.due_date) || null,
    title: normalizeText(payload.title) || `Invoice for ${normalizeText(customer.name) || "customer"}`,
    notes: normalizeText(payload.notes),
    items,
    total_amount_cents: totalAmountCents,
    due_amount_cents: dueAmountCents,
    public_token: generateInvoiceToken(),
    stripe_last_session_id: null,
    sent_at: null,
    paid_at: null,
    created_at: now,
    updated_at: now
  };

  await writeInvoicePdf(invoice, customer, lead);
  store.invoices.push(invoice);
  await persistStore(store);

  sendJson(res, 201, {
    invoice: buildInvoiceReadModel(req, invoice, customer, lead),
    email_preview: {
      to: customer.email,
      subject: `${invoice.invoice_number} - Chapter2 Invoice`,
      body: `Hi ${customer.name || "there"},\n\nPlease review your invoice and payment details here:\n${getInvoicePublicLink(
        req,
        invoice.public_token
      )}\n\nPDF: ${getPublicBaseUrl(req)}${buildInvoicePublicPdfUrl(invoice.public_token)}\n`
    }
  });
}

async function handlePatchLeadInvoice(req, res, [leadId, invoiceId]) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }
  const customer = store.customers.find((item) => item.id === lead.customer_id);
  if (!customer) {
    sendJson(res, 422, { error: "Lead customer not found" });
    return;
  }

  const invoice = store.invoices.find((item) => item.id === invoiceId && item.lead_id === leadId);
  if (!invoice) {
    sendJson(res, 404, { error: "Invoice not found" });
    return;
  }
  if (invoice.status === "PAID") {
    sendJson(res, 409, { error: "Paid invoice cannot be modified" });
    return;
  }

  const nextItems = payload.items ? normalizeInvoiceItems(payload.items) : invoice.items;
  if (!nextItems.length) {
    sendJson(res, 422, { error: "At least one valid invoice item is required" });
    return;
  }

  const now = nowIso();
  const totalAmountCents = computeInvoiceTotal(nextItems);
  const dueAmountCents = safeAmountCents(payload.due_amount_cents) ?? totalAmountCents;
  invoice.invoice_number = normalizeText(payload.invoice_number) || invoice.invoice_number;
  invoice.currency = safeCurrency(payload.currency || invoice.currency);
  invoice.issue_date = normalizeText(payload.issue_date) || invoice.issue_date;
  invoice.due_date = normalizeText(payload.due_date) || null;
  invoice.title = normalizeText(payload.title) || invoice.title;
  invoice.notes = normalizeText(payload.notes);
  invoice.items = nextItems;
  invoice.total_amount_cents = totalAmountCents;
  invoice.due_amount_cents = dueAmountCents;
  invoice.version = Number(invoice.version || 1) + 1;
  invoice.updated_at = now;
  invoice.status = "DRAFT";
  invoice.sent_at = null;
  invoice.stripe_last_session_id = null;

  await writeInvoicePdf(invoice, customer, lead);
  await persistStore(store);
  sendJson(res, 200, { invoice: buildInvoiceReadModel(req, invoice, customer, lead) });
}

async function handleSendLeadInvoice(req, res, [leadId, invoiceId]) {
  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }
  const customer = store.customers.find((item) => item.id === lead.customer_id);
  if (!customer) {
    sendJson(res, 422, { error: "Lead customer not found" });
    return;
  }
  const invoice = store.invoices.find((item) => item.id === invoiceId && item.lead_id === leadId);
  if (!invoice) {
    sendJson(res, 404, { error: "Invoice not found" });
    return;
  }

  if (!customer.email) {
    sendJson(res, 422, { error: "Customer email is required to send invoice" });
    return;
  }

  invoice.status = invoice.status === "PAID" ? "PAID" : "SENT";
  invoice.sent_at = invoice.sent_at || nowIso();
  invoice.updated_at = nowIso();
  await persistStore(store);

  const publicLink = getInvoicePublicLink(req, invoice.public_token);
  const publicPdfLink = `${getPublicBaseUrl(req)}${buildInvoicePublicPdfUrl(invoice.public_token)}`;
  const emailBody = [
    `Hi ${customer.name || "there"},`,
    "",
    "Please review your invoice and make payment using the secure link below:",
    publicLink,
    "",
    "Invoice PDF:",
    publicPdfLink
  ].join("\n");

  sendJson(res, 200, {
    invoice: buildInvoiceReadModel(req, invoice, customer, lead),
    email_preview: {
      to: customer.email,
      subject: `${invoice.invoice_number} - Chapter2 Invoice`,
      body: emailBody
    }
  });
}

async function handleGetInvoicePdf(_req, res, [invoiceId]) {
  const store = await readStore();
  const invoice = store.invoices.find((item) => item.id === invoiceId);
  if (!invoice) {
    sendJson(res, 404, { error: "Invoice not found" });
    return;
  }

  const pdfPath = invoicePdfPath(invoice.id, invoice.version);
  await sendFileWithCache(_req, res, pdfPath, "private, max-age=0, no-store");
}

async function handleGetPublicInvoice(req, res, [token]) {
  const normalizedToken = normalizeText(token);
  const store = await readStore();
  const invoice = store.invoices.find((item) => item.public_token === normalizedToken);
  if (!invoice) {
    sendJson(res, 404, { error: "Invoice not found" });
    return;
  }
  const customer = store.customers.find((item) => item.id === invoice.customer_id) || null;
  const lead = store.leads.find((item) => item.id === invoice.lead_id) || null;

  sendJson(res, 200, {
    invoice: buildInvoiceReadModel(req, invoice, customer, lead),
    customer: {
      name: normalizeText(customer?.name),
      email: normalizeEmail(customer?.email)
    },
    lead: lead
      ? {
          id: lead.id,
          destination: normalizeText(lead.destination),
          style: normalizeText(lead.style),
          travel_month: normalizeText(lead.travel_month)
        }
      : null
  });
}

async function handleGetPublicInvoicePdf(req, res, [token]) {
  const normalizedToken = normalizeText(token);
  const store = await readStore();
  const invoice = store.invoices.find((item) => item.public_token === normalizedToken);
  if (!invoice) {
    sendJson(res, 404, { error: "Invoice not found" });
    return;
  }
  const pdfPath = invoicePdfPath(invoice.id, invoice.version);
  await sendFileWithCache(req, res, pdfPath, "public, max-age=120, must-revalidate");
}

async function createStripeCheckoutSessionForInvoice({ invoice, customer, amountCents, successUrl, cancelUrl }) {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", successUrl);
  body.set("cancel_url", cancelUrl);
  body.set("customer_email", normalizeEmail(customer.email));
  body.set("line_items[0][price_data][currency]", safeCurrency(invoice.currency).toLowerCase());
  body.set("line_items[0][price_data][unit_amount]", String(amountCents));
  body.set("line_items[0][price_data][product_data][name]", normalizeText(invoice.title) || "Chapter2 Invoice");
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[invoice_id]", invoice.id);
  body.set("metadata[invoice_token]", invoice.public_token);
  body.set("metadata[lead_id]", invoice.lead_id);
  body.set("metadata[customer_id]", invoice.customer_id);

  const response = await fetch(`${STRIPE_API_BASE}/v1/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const payload = await response.json();
  if (!response.ok) {
    const message = normalizeText(payload?.error?.message) || "Stripe Checkout session creation failed";
    throw new Error(message);
  }
  return payload;
}

async function handleCreateInvoiceCheckoutSession(req, res, [token]) {
  const normalizedToken = normalizeText(token);
  const store = await readStore();
  const invoice = store.invoices.find((item) => item.public_token === normalizedToken);
  if (!invoice) {
    sendJson(res, 404, { error: "Invoice not found" });
    return;
  }
  if (invoice.status === "PAID") {
    sendJson(res, 409, { error: "Invoice is already paid" });
    return;
  }
  if (!STRIPE_SECRET_KEY) {
    sendJson(res, 501, { error: "Stripe payments are not configured (missing STRIPE_SECRET_KEY)" });
    return;
  }

  const customer = store.customers.find((item) => item.id === invoice.customer_id);
  if (!customer?.email) {
    sendJson(res, 422, { error: "Customer email is required for checkout" });
    return;
  }

  const amountCents = safeAmountCents(invoice.due_amount_cents) || safeAmountCents(invoice.total_amount_cents);
  if (!amountCents) {
    sendJson(res, 422, { error: "Invoice amount is invalid" });
    return;
  }

  const invoiceUrl = getInvoicePublicLink(req, invoice.public_token);
  const successUrl = resolveCheckoutReturnUrl(STRIPE_CHECKOUT_SUCCESS_URL, `${invoiceUrl}?payment=success`, invoice.public_token);
  const cancelUrl = resolveCheckoutReturnUrl(STRIPE_CHECKOUT_CANCEL_URL, `${invoiceUrl}?payment=cancelled`, invoice.public_token);

  let session;
  try {
    session = await createStripeCheckoutSessionForInvoice({
      invoice,
      customer,
      amountCents,
      successUrl,
      cancelUrl
    });
  } catch (error) {
    sendJson(res, 502, { error: "Stripe checkout session creation failed", detail: String(error?.message || error) });
    return;
  }

  const now = nowIso();
  invoice.updated_at = now;
  invoice.stripe_last_session_id = normalizeText(session.id) || null;
  store.payments.push({
    id: `pay_${randomUUID()}`,
    invoice_id: invoice.id,
    lead_id: invoice.lead_id,
    customer_id: invoice.customer_id,
    provider: "stripe",
    provider_session_id: normalizeText(session.id),
    provider_payment_intent_id: normalizeText(session.payment_intent),
    amount_cents: amountCents,
    currency: safeCurrency(invoice.currency),
    status: "CHECKOUT_CREATED",
    created_at: now,
    updated_at: now
  });
  await persistStore(store);

  sendJson(res, 201, {
    checkout_url: session.url,
    session_id: session.id,
    amount_cents: amountCents,
    currency: safeCurrency(invoice.currency)
  });
}

async function handlePublicInvoicePage(req, res, [token]) {
  const normalizedToken = normalizeText(token);
  const store = await readStore();
  const invoice = store.invoices.find((item) => item.public_token === normalizedToken);
  if (!invoice) {
    sendHtml(res, 404, "<!doctype html><html><body><h1>Invoice not found</h1></body></html>");
    return;
  }
  const customer = store.customers.find((item) => item.id === invoice.customer_id) || null;
  const lead = store.leads.find((item) => item.id === invoice.lead_id) || null;
  const currency = safeCurrency(invoice.currency);
  const rows = (invoice.items || [])
    .map((item) => {
      return `<tr>
        <td>${escapeHtml(item.description)}</td>
        <td style="text-align:right">${escapeHtml(String(item.quantity || 1))}</td>
        <td style="text-align:right">${escapeHtml(formatMoney(item.unit_amount_cents, currency))}</td>
        <td style="text-align:right">${escapeHtml(formatMoney(item.total_amount_cents, currency))}</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(invoice.invoice_number)} | Chapter2 Invoice</title>
    <style>
      body { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; margin:0; background:#f6f9fb; color:#1f2d38; }
      .wrap { max-width: 980px; margin: 0 auto; padding: 24px; }
      .card { background:#fff; border:1px solid #dfe9ef; border-radius:14px; padding:20px; margin-bottom:16px; }
      table { width:100%; border-collapse: collapse; }
      th, td { padding:10px 8px; border-bottom:1px solid #edf2f6; font-size:14px; text-align:left; vertical-align:top; }
      .right { text-align:right; }
      .btn { display:inline-block; border:none; border-radius:10px; background:#ff6f47; color:#fff; padding:12px 16px; font-weight:600; cursor:pointer; margin-right:8px; }
      .btn-link { display:inline-block; border-radius:10px; border:1px solid #d7e3ea; color:#1f2d38; padding:11px 16px; text-decoration:none; }
      .muted { color:#607380; font-size:14px; }
      .sum { font-size:18px; font-weight:700; margin: 6px 0; }
      .error { color:#9d2d2d; margin-top:10px; min-height:20px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>${escapeHtml(invoice.invoice_number)}</h1>
        <p class="muted">Prepared for ${escapeHtml(customer?.name || "Guest")} (${escapeHtml(customer?.email || "")})</p>
        <p class="muted">Lead: ${escapeHtml(lead?.id || "-")} | ${escapeHtml(lead?.destination || "-")} | ${escapeHtml(
          lead?.style || "-"
        )}</p>
        <p class="muted">Issue date: ${escapeHtml(invoice.issue_date || "-")} | Due date: ${escapeHtml(invoice.due_date || "-")}</p>
        ${invoice.notes ? `<p>${escapeHtml(invoice.notes)}</p>` : ""}
      </div>
      <div class="card">
        <h2>Invoice items</h2>
        <table>
          <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Unit</th><th class="right">Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="card">
        <p class="sum">Total: ${escapeHtml(formatMoney(invoice.total_amount_cents, currency))}</p>
        <p class="sum">Due now: ${escapeHtml(formatMoney(invoice.due_amount_cents || invoice.total_amount_cents, currency))}</p>
        <button id="payBtn" class="btn">Pay by credit card</button>
        <a class="btn-link" href="${escapeHtml(buildInvoicePublicPdfUrl(invoice.public_token))}" target="_blank" rel="noopener">Download invoice PDF</a>
        <div id="error" class="error"></div>
      </div>
    </div>
    <script>
      const btn = document.getElementById("payBtn");
      const error = document.getElementById("error");
      btn.addEventListener("click", async () => {
        error.textContent = "";
        btn.disabled = true;
        btn.textContent = "Opening checkout...";
        try {
          const response = await fetch("/public/v1/invoices/${encodeURIComponent(invoice.public_token)}/checkout-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
          });
          const payload = await response.json();
          if (!response.ok || !payload.checkout_url) {
            throw new Error(payload.error || "Could not start checkout");
          }
          window.location.href = payload.checkout_url;
        } catch (e) {
          error.textContent = String(e.message || e);
          btn.disabled = false;
          btn.textContent = "Pay by credit card";
        }
      });
    </script>
  </body>
</html>`;
  sendHtml(res, 200, html);
}

async function handleListCustomers(req, res) {
  const store = await readStore();
  const requestUrl = new URL(req.url, "http://localhost");
  const search = normalizeText(requestUrl.searchParams.get("search")).toLowerCase();
  const pageQuery = requestUrl.searchParams;
  const filtered = [...store.customers]
    .filter((customer) => {
      if (!search) return true;
      const haystack = [customer.name, customer.email, customer.phone, customer.language].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) =>
      String(b.created_at || b.updated_at || "").localeCompare(String(a.created_at || a.updated_at || ""))
    );
  const paged = paginate(filtered, pageQuery);
  sendJson(res, 200, {
    items: paged.items,
    total: paged.total,
    page: paged.page,
    page_size: paged.page_size,
    total_pages: paged.total_pages
  });
}

async function handleGetCustomer(_req, res, [customerId]) {
  const store = await readStore();
  const customer = store.customers.find((item) => item.id === customerId);
  if (!customer) {
    sendJson(res, 404, { error: "Customer not found" });
    return;
  }

  const leads = store.leads
    .filter((lead) => lead.customer_id === customer.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  sendJson(res, 200, { customer, leads });
}

async function handleListCustomerOffers(req, res, [customerId]) {
  const store = await readStore();
  const customer = store.customers.find((item) => item.id === customerId);
  if (!customer) {
    sendJson(res, 404, { error: "Customer not found" });
    return;
  }

  const items = [...store.customer_offers]
    .filter((offer) => offer.customer_id === customerId)
    .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));

  sendJson(res, 200, { items, total: items.length });
}

async function handleCreateCustomerOffer(req, res, [customerId]) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const validationError = validateOfferPayload(payload);
  if (validationError) {
    sendJson(res, 422, { error: validationError });
    return;
  }

  const store = await readStore();
  const customer = store.customers.find((item) => item.id === customerId);
  if (!customer) {
    sendJson(res, 404, { error: "Customer not found" });
    return;
  }

  const tours = await readTours();
  const items = [];
  for (const rawItem of payload.items) {
    const tourId = normalizeText(rawItem?.tour_id);
    const tour = tours.find((entry) => entry.id === tourId);
    if (!tour) {
      sendJson(res, 422, { error: `Tour not found: ${tourId}` });
      return;
    }
    items.push(normalizeOfferItem(rawItem, tour));
  }

  const currency = safeCurrency(payload.currency);
  const now = nowIso();
  const offer = {
    id: `off_${randomUUID()}`,
    customer_id: customerId,
    public_token: generatePublicToken(),
    status: "DRAFT",
    title: normalizeText(payload.title) || "Your Chapter2 travel plan",
    intro_message: normalizeText(payload.intro_message) || "",
    items,
    payment: {
      currency,
      due_at: normalizeText(payload.due_at) || null,
      allow_partial: Boolean(payload.allow_partial),
      deposit_amount_cents: safeAmountCents(payload.deposit_amount_cents)
    },
    created_at: now,
    updated_at: now,
    sent_at: null,
    paid_at: null,
    stripe_last_session_id: null
  };

  store.customer_offers.push(offer);
  await persistStore(store);

  sendJson(res, 201, {
    offer,
    public_link: getOfferPublicLink(req, offer.public_token)
  });
}

async function handleGetOfferAdmin(req, res, [offerId]) {
  const store = await readStore();
  const offer = store.customer_offers.find((item) => item.id === offerId);
  if (!offer) {
    sendJson(res, 404, { error: "Offer not found" });
    return;
  }

  const customer = store.customers.find((item) => item.id === offer.customer_id) || null;
  sendJson(res, 200, {
    offer,
    customer,
    public_link: getOfferPublicLink(req, offer.public_token)
  });
}

async function handleMarkOfferSent(req, res, [offerId]) {
  const store = await readStore();
  const offer = store.customer_offers.find((item) => item.id === offerId);
  if (!offer) {
    sendJson(res, 404, { error: "Offer not found" });
    return;
  }
  const customer = store.customers.find((item) => item.id === offer.customer_id) || null;
  if (!customer) {
    sendJson(res, 422, { error: "Offer customer not found" });
    return;
  }

  const now = nowIso();
  offer.status = offer.status === "PAID" ? "PAID" : "SENT";
  offer.sent_at = offer.sent_at || now;
  offer.updated_at = now;
  await persistStore(store);

  const publicLink = getOfferPublicLink(req, offer.public_token);
  const emailBody = [
    `Hi ${customer.name || "there"},`,
    "",
    "Your Chapter2 travel proposal is ready.",
    `Open your private link: ${publicLink}`,
    "",
    "This link includes your tailored itinerary and payment details."
  ].join("\n");

  sendJson(res, 200, {
    offer,
    public_link: publicLink,
    email_preview: {
      to: customer.email,
      subject: "Your Chapter2 tour proposal and payment link",
      body: emailBody
    }
  });
}

async function handleGetPublicOffer(req, res, [token]) {
  const normalizedToken = normalizeText(token);
  const store = await readStore();
  const offer = store.customer_offers.find((item) => item.public_token === normalizedToken);
  if (!offer) {
    sendJson(res, 404, { error: "Offer not found" });
    return;
  }

  const customer = store.customers.find((item) => item.id === offer.customer_id);
  const payload = sanitizePublicOffer(offer, customer);
  payload.public_link = getOfferPublicLink(req, offer.public_token);
  sendJson(res, 200, payload);
}

async function handleCreatePublicCheckoutSession(req, res, [token]) {
  const normalizedToken = normalizeText(token);
  const store = await readStore();
  const offer = store.customer_offers.find((item) => item.public_token === normalizedToken);
  if (!offer) {
    sendJson(res, 404, { error: "Offer not found" });
    return;
  }

  if (offer.status === "PAID") {
    sendJson(res, 409, { error: "Offer is already paid" });
    return;
  }

  if (!STRIPE_SECRET_KEY) {
    sendJson(res, 501, { error: "Stripe payments are not configured (missing STRIPE_SECRET_KEY)" });
    return;
  }

  const customer = store.customers.find((item) => item.id === offer.customer_id);
  if (!customer?.email) {
    sendJson(res, 422, { error: "Offer customer email is required for Stripe checkout" });
    return;
  }

  const totals = computeOfferTotals(offer);
  const amountCents = totals.due_now_amount_cents;
  if (!amountCents) {
    sendJson(res, 422, { error: "Offer amount is invalid" });
    return;
  }

  const publicOfferUrl = getOfferPublicLink(req, offer.public_token);
  const successUrl = resolveCheckoutReturnUrl(STRIPE_CHECKOUT_SUCCESS_URL, `${publicOfferUrl}?payment=success`, offer.public_token);
  const cancelUrl = resolveCheckoutReturnUrl(STRIPE_CHECKOUT_CANCEL_URL, `${publicOfferUrl}?payment=cancelled`, offer.public_token);

  let session;
  try {
    session = await createStripeCheckoutSession({
      offer,
      customer,
      amountCents,
      currency: offer.payment.currency,
      successUrl,
      cancelUrl
    });
  } catch (error) {
    sendJson(res, 502, { error: "Stripe checkout session creation failed", detail: String(error?.message || error) });
    return;
  }

  const now = nowIso();
  offer.updated_at = now;
  offer.stripe_last_session_id = normalizeText(session.id) || null;
  store.payments.push({
    id: `pay_${randomUUID()}`,
    offer_id: offer.id,
    customer_id: offer.customer_id,
    provider: "stripe",
    provider_session_id: normalizeText(session.id),
    provider_payment_intent_id: normalizeText(session.payment_intent),
    amount_cents: amountCents,
    currency: safeCurrency(offer.payment.currency),
    status: "CHECKOUT_CREATED",
    created_at: now,
    updated_at: now
  });
  await persistStore(store);

  sendJson(res, 201, {
    checkout_url: session.url,
    session_id: session.id,
    amount_cents: amountCents,
    currency: safeCurrency(offer.payment.currency)
  });
}

async function handlePublicOfferPage(req, res, [token]) {
  const normalizedToken = normalizeText(token);
  const store = await readStore();
  const offer = store.customer_offers.find((item) => item.public_token === normalizedToken);
  if (!offer) {
    sendHtml(res, 404, "<!doctype html><html><body><h1>Offer not found</h1></body></html>");
    return;
  }
  const customer = store.customers.find((item) => item.id === offer.customer_id) || null;
  const totals = computeOfferTotals(offer);
  const currency = safeCurrency(offer.payment.currency);
  const rows = (offer.items || [])
    .map((item) => {
      return `<tr>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml((item.destinationCountries || []).join(", "))}</td>
        <td>${escapeHtml(item.customer_notes || "-")}</td>
        <td style="text-align:right">${escapeHtml(formatMoney(item.total_amount_cents, currency))}</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(offer.title)}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin:0; background:#f7fafc; color:#1f2d38; }
      .wrap { max-width: 920px; margin: 0 auto; padding: 24px; }
      .card { background:#fff; border:1px solid #dfe9ef; border-radius:14px; padding:20px; margin-bottom:16px; }
      table { width:100%; border-collapse: collapse; }
      th, td { padding:10px 8px; border-bottom:1px solid #edf2f6; font-size:14px; vertical-align:top; text-align:left; }
      .btn { display:inline-block; border:none; border-radius:10px; background:#ff6f47; color:#fff; padding:12px 16px; font-weight:600; cursor:pointer; }
      .muted { color:#607380; font-size:14px; }
      .error { color:#9d2d2d; margin-top:12px; min-height: 20px; }
      .sum { font-size:18px; font-weight:700; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>${escapeHtml(offer.title)}</h1>
        <p class="muted">Prepared for ${escapeHtml(customer?.name || "Guest")} (${escapeHtml(customer?.email || "")})</p>
        ${offer.intro_message ? `<p>${escapeHtml(offer.intro_message)}</p>` : ""}
      </div>
      <div class="card">
        <h2>Your tours</h2>
        <table>
          <thead><tr><th>Tour</th><th>Destinations</th><th>Notes</th><th style="text-align:right">Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="card">
        <p class="sum">Total: ${escapeHtml(formatMoney(totals.total_amount_cents, currency))}</p>
        <p class="sum">Due now: ${escapeHtml(formatMoney(totals.due_now_amount_cents, currency))}</p>
        <p class="muted">${offer.payment.due_at ? `Payment due by ${escapeHtml(offer.payment.due_at)}.` : ""}</p>
        <button id="payBtn" class="btn">Pay by card</button>
        <div id="error" class="error"></div>
      </div>
    </div>
    <script>
      const btn = document.getElementById("payBtn");
      const error = document.getElementById("error");
      btn.addEventListener("click", async () => {
        error.textContent = "";
        btn.disabled = true;
        btn.textContent = "Opening checkout...";
        try {
          const response = await fetch("/public/v1/offers/${encodeURIComponent(offer.public_token)}/checkout-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
          });
          const payload = await response.json();
          if (!response.ok || !payload.checkout_url) {
            throw new Error(payload.error || "Could not start checkout");
          }
          window.location.href = payload.checkout_url;
        } catch (e) {
          error.textContent = String(e.message || e);
          btn.disabled = false;
          btn.textContent = "Pay by card";
        }
      });
    </script>
  </body>
</html>`;
  sendHtml(res, 200, html);
}

async function handleStripeWebhook(req, res) {
  if (!STRIPE_WEBHOOK_SECRET) {
    sendJson(res, 501, { error: "Stripe webhook is not configured (missing STRIPE_WEBHOOK_SECRET)" });
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString("utf8");
  const signature = normalizeText(req.headers["stripe-signature"]);

  const valid = verifyStripeWebhookSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    sendJson(res, 400, { error: "Invalid Stripe signature" });
    return;
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  if (event?.type !== "checkout.session.completed") {
    sendJson(res, 200, { received: true, ignored: true });
    return;
  }

  const session = event?.data?.object || {};
  const offerId = normalizeText(session?.metadata?.offer_id);
  const store = await readStore();
  const now = nowIso();
  let handled = false;

  if (offerId) {
    const offer = store.customer_offers.find((item) => item.id === offerId);
    if (offer) {
      offer.status = "PAID";
      offer.paid_at = now;
      offer.updated_at = now;
      handled = true;
    }
  }

  const invoiceId = normalizeText(session?.metadata?.invoice_id);
  if (invoiceId) {
    const invoice = store.invoices.find((item) => item.id === invoiceId);
    if (invoice) {
      invoice.status = "PAID";
      invoice.paid_at = now;
      invoice.updated_at = now;
      handled = true;
    }
  }

  const payment = store.payments.find((item) => normalizeText(item.provider_session_id) === normalizeText(session.id));
  if (payment) {
    payment.status = "PAID";
    payment.provider_payment_intent_id = normalizeText(session.payment_intent) || payment.provider_payment_intent_id;
    payment.updated_at = now;
    handled = true;
  }

  if (!handled) {
    sendJson(res, 200, { received: true, ignored: true });
    return;
  }

  await persistStore(store);
  sendJson(res, 200, { received: true });
}

async function handleListStaff(req, res) {
  const requestUrl = new URL(req.url, "http://localhost");
  const onlyActive = normalizeText(requestUrl.searchParams.get("active")) !== "false";
  const staff = await loadStaff();
  const items = staff
    .filter((member) => (onlyActive ? member.active : true))
    .map((member) => ({
      id: member.id,
      name: member.name,
      active: Boolean(member.active),
      destinations: Array.isArray(member.destinations) ? member.destinations : [],
      languages: Array.isArray(member.languages) ? member.languages : []
    }))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  sendJson(res, 200, { items, total: items.length });
}

function buildTourPayload(payload, { existing = null, isCreate = false } = {}) {
  const next = existing ? { ...existing } : {};

  if (isCreate || payload.id !== undefined) next.id = normalizeText(payload.id);
  if (isCreate || payload.title !== undefined) next.title = normalizeText(payload.title);
  if (payload.shortDescription !== undefined) next.shortDescription = normalizeText(payload.shortDescription);
  if (isCreate || payload.destinationCountries !== undefined) {
    const destinationCountries = normalizeStringArray(payload.destinationCountries);
    next.destinationCountries = destinationCountries;
  }
  if (isCreate || payload.styles !== undefined) next.styles = normalizeStringArray(payload.styles);
  if (payload.image !== undefined) next.image = toTourImagePublicUrl(payload.image);
  if (payload.seasonality !== undefined) next.seasonality = normalizeText(payload.seasonality);
  if (payload.highlights !== undefined || isCreate) next.highlights = normalizeHighlights(payload.highlights);

  if (payload.priority !== undefined || isCreate) {
    const priority = safeInt(payload.priority);
    next.priority = priority === null ? 50 : priority;
  }
  if (payload.durationDays !== undefined || isCreate) {
    const durationDays = safeInt(payload.durationDays);
    next.durationDays = durationDays === null ? 0 : durationDays;
  }
  if (payload.priceFrom !== undefined || isCreate) {
    const priceFrom = safeInt(payload.priceFrom);
    next.priceFrom = priceFrom === null ? 0 : priceFrom;
  }
  if (payload.rating !== undefined || isCreate) {
    const rating = safeFloat(payload.rating);
    next.rating = rating === null ? 0 : rating;
  }

  return next;
}

function validateTourInput(tour, { isCreate = false } = {}) {
  if (isCreate && !tour.title) return "title is required";
  if (isCreate && !tourDestinationCountries(tour).length) return "destinationCountries is required";
  if (isCreate && (!Array.isArray(tour.styles) || !tour.styles.length)) return "styles is required";
  return "";
}

function filterAndSortTours(tours, query) {
  const search = normalizeText(query.get("search")).toLowerCase();
  const destination = normalizeText(query.get("destination"));
  const style = normalizeText(query.get("style"));
  const sort = normalizeText(query.get("sort")) || "updated_at_desc";

  const filtered = tours.filter((tour) => {
    const destinationMatch = !destination || tourDestinationCountries(tour).includes(destination);
    const styleMatch = !style || (Array.isArray(tour.styles) && tour.styles.includes(style));
    if (!destinationMatch || !styleMatch) return false;
    if (!search) return true;
    const haystack = [
      tour.id,
      tour.title,
      tour.shortDescription,
      ...tourDestinationCountries(tour),
      ...(Array.isArray(tour.highlights) ? tour.highlights : []),
      ...(Array.isArray(tour.styles) ? tour.styles : [])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });

  const items = [...filtered].sort((a, b) => {
    if (sort === "title_asc") return String(a.title || "").localeCompare(String(b.title || ""));
    return String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""));
  });

  return {
    items,
    sort,
    filters: {
      destination: destination || null,
      style: style || null,
      search: search || null
    }
  };
}

async function handlePublicListTours(req, res) {
  const tours = await readTours();
  const requestUrl = new URL(req.url, "http://localhost");
  const destination = normalizeText(requestUrl.searchParams.get("destination"));
  const style = normalizeText(requestUrl.searchParams.get("style"));
  const offset = Math.max(0, safeInt(requestUrl.searchParams.get("offset")) || 0);
  const limit = clamp(safeInt(requestUrl.searchParams.get("limit")) || tours.length || 1000, 1, 5000);

  const filtered = tours.filter((tour) => {
    const destinationMatch = !destination || tourDestinationCountries(tour).includes(destination);
    const styleMatch = !style || (Array.isArray(tour.styles) && tour.styles.includes(style));
    return destinationMatch && styleMatch;
  });

  const sorted = [...filtered].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  const items = sorted.slice(offset, offset + limit).map(normalizeTourForRead);
  const payload = { items, total: filtered.length, offset, limit };
  const payloadText = JSON.stringify(payload);
  const etag = `W/"${createHash("sha1").update(payloadText).digest("hex")}"`;
  const ifNoneMatch = normalizeText(req.headers["if-none-match"]);

  const cacheHeaders = {
    "Cache-Control": "public, max-age=120, stale-while-revalidate=600, must-revalidate",
    ETag: etag
  };

  if (ifNoneMatch === etag) {
    res.writeHead(304, cacheHeaders);
    res.end();
    return;
  }

  sendJson(res, 200, payload, cacheHeaders);
}

async function handleListTours(req, res) {
  const tours = await readTours();
  const requestUrl = new URL(req.url, "http://localhost");
  const { items: filtered, sort, filters } = filterAndSortTours(tours, requestUrl.searchParams);
  const paged = paginate(filtered, requestUrl.searchParams);
  const options = collectTourOptions(tours);
  sendJson(res, 200, {
    items: paged.items.map(normalizeTourForRead),
    total: paged.total,
    page: paged.page,
    page_size: paged.page_size,
    total_pages: paged.total_pages,
    sort,
    filters,
    available_destinations: options.destinations,
    available_styles: options.styles
  });
}

async function handleGetTour(_req, res, [tourId]) {
  const tours = await readTours();
  const tour = tours.find((item) => item.id === tourId);
  if (!tour) {
    sendJson(res, 404, { error: "Tour not found" });
    return;
  }
  const options = collectTourOptions(tours);
  sendJson(res, 200, {
    tour: normalizeTourForRead(tour),
    options: {
      destinations: options.destinations,
      styles: options.styles
    }
  });
}

async function handleCreateTour(req, res) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const now = nowIso();
  const tour = buildTourPayload(payload, { isCreate: true });
  tour.id = `tour_${randomUUID()}`;
  tour.image = toTourImagePublicUrl(tour.image);
  tour.created_at = now;
  tour.updated_at = now;

  const validationError = validateTourInput(tour, { isCreate: true });
  if (validationError) {
    sendJson(res, 422, { error: validationError });
    return;
  }

  await persistTour(tour);
  sendJson(res, 201, { tour: normalizeTourForRead(tour) });
}

async function handlePatchTour(req, res, [tourId]) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const tours = await readTours();
  const index = tours.findIndex((item) => item.id === tourId);
  if (index < 0) {
    sendJson(res, 404, { error: "Tour not found" });
    return;
  }

  const current = tours[index];
  const idChange = normalizeText(payload.id);
  if (idChange && idChange !== tourId) {
    sendJson(res, 422, { error: "Tour id cannot be changed" });
    return;
  }

  const updated = buildTourPayload(payload, { existing: current, isCreate: false });
  updated.updated_at = nowIso();

  const validationError = validateTourInput(updated, { isCreate: false });
  if (validationError) {
    sendJson(res, 422, { error: validationError });
    return;
  }

  tours[index] = updated;
  await persistTour(updated);
  sendJson(res, 200, { tour: normalizeTourForRead(updated) });
}

async function handlePublicTourImage(req, res, [rawRelativePath]) {
  const absolutePath = resolveTourImageDiskPath(rawRelativePath);
  if (!absolutePath) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }
  await sendFileWithCache(req, res, absolutePath, "public, max-age=31536000, immutable");
}

async function processTourImageToWebp(inputPath, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await execFile("magick", [
    inputPath,
    "-auto-orient",
    "-resize",
    "1000x1000>",
    "-strip",
    "-quality",
    "82",
    outputPath
  ]);
}

async function handleUploadTourImage(req, res, [tourId]) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const filename = normalizeText(payload.filename) || `${tourId}.upload`;
  const base64 = normalizeText(payload.data_base64);
  if (!base64) {
    sendJson(res, 422, { error: "data_base64 is required" });
    return;
  }

  const tours = await readTours();
  const index = tours.findIndex((item) => item.id === tourId);
  if (index < 0) {
    sendJson(res, 404, { error: "Tour not found" });
    return;
  }

  const now = nowIso();
  const sourceBuffer = Buffer.from(base64, "base64");
  if (!sourceBuffer.length) {
    sendJson(res, 422, { error: "Invalid base64 image payload" });
    return;
  }

  const tempInputPath = path.join(TEMP_UPLOAD_DIR, `${tourId}-${randomUUID()}${path.extname(filename) || ".upload"}`);
  const outputName = `${tourId}.webp`;
  const outputRelativePath = `${tourId}/${outputName}`;
  const outputPath = path.join(TOURS_DIR, outputRelativePath);

  try {
    await writeFile(tempInputPath, sourceBuffer);
    await processTourImageToWebp(tempInputPath, outputPath);
  } catch (error) {
    sendJson(res, 500, { error: "Image conversion failed", detail: String(error?.message || error) });
    return;
  } finally {
    await rm(tempInputPath, { force: true });
  }

  const publicPath = `/public/v1/tour-images/${outputRelativePath}`;
  const updated = {
    ...tours[index],
    image: publicPath,
    updated_at: now
  };
  tours[index] = updated;
  await persistTour(updated);

  sendJson(res, 200, { tour: normalizeTourForRead(updated) });
}

async function handleAdminHome(req, res) {
  sendHtml(
    res,
    200,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Chapter2 Admin</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    a { color: #004f7a; }
  </style>
</head>
<body>
  <h1>Chapter2 Admin</h1>
  <ul>
    <li><a href="/admin/leads">Lead pipeline view</a></li>
    <li><a href="/admin/customers">Customers UI</a></li>
    <li>Customers API: <a href="/api/v1/customers"><code>/api/v1/customers</code></a></li>
    <li>Tours API: <a href="/api/v1/tours"><code>/api/v1/tours</code></a></li>
  </ul>
</body>
</html>`
  );
}

async function handleAdminCustomersPage(req, res) {
  const store = await readStore();
  const requestUrl = new URL(req.url, "http://localhost");
  const params = requestUrl.searchParams;
  const search = normalizeText(params.get("search")).toLowerCase();
  const pageSize = String(clamp(safeInt(params.get("page_size")) || 25, 1, 100));

  const filtered = [...store.customers]
    .filter((customer) => {
      if (!search) return true;
      const haystack = [customer.id, customer.name, customer.email, customer.phone, customer.language]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const paged = paginate(filtered, params);

  const customerLeadsCount = new Map();
  for (const lead of store.leads) {
    customerLeadsCount.set(lead.customer_id, (customerLeadsCount.get(lead.customer_id) || 0) + 1);
  }

  const detailBaseQuery = new URLSearchParams(params);
  detailBaseQuery.delete("page");
  const detailQuery = detailBaseQuery.toString();

  const rows = paged.items
    .map((customer) => {
      const customerHref = `/admin/customers/${encodeURIComponent(customer.id)}${detailQuery ? `?${detailQuery}` : ""}`;
      return `<tr>
        <td><a href="${escapeHtml(customerHref)}">${escapeHtml(customer.id)}</a></td>
        <td>${escapeHtml(customer.name || "-")}</td>
        <td>${escapeHtml(customer.email || "-")}</td>
        <td>${escapeHtml(customer.phone || "-")}</td>
        <td>${escapeHtml(customer.language || "-")}</td>
        <td>${customerLeadsCount.get(customer.id) || 0}</td>
        <td>${escapeHtml(customer.updated_at || "-")}</td>
      </tr>`;
    })
    .join("\n");

  function pageLink(targetPage) {
    const next = new URLSearchParams(params);
    next.set("page", String(targetPage));
    return `/admin/customers?${next.toString()}`;
  }

  const prevLink = paged.page > 1 ? `<a href="${escapeHtml(pageLink(paged.page - 1))}">Previous</a>` : "";
  const nextLink =
    paged.page < paged.total_pages ? `<a href="${escapeHtml(pageLink(paged.page + 1))}">Next</a>` : "";

  const leadsHref = "/admin/leads";
  const homeHref = "/admin";

  sendHtml(
    res,
    200,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Customers</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    form { display: grid; grid-template-columns: 1fr 180px auto; gap: 0.5rem; align-items: end; margin-bottom: 1rem; }
    input, select, button { padding: 0.45rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
    th { background: #f6f6f6; }
    .pager, .links { display: flex; gap: 1rem; margin-top: 1rem; align-items: center; }
  </style>
</head>
<body>
  <h1>Customers</h1>
  <p>Total customers (all): ${store.customers.length}</p>
  <p>Total customers (filtered): ${paged.total}</p>
  <div class="links">
    <a href="${escapeHtml(homeHref)}">Admin home</a>
    <a href="${escapeHtml(leadsHref)}">Lead pipeline</a>
  </div>
  <form method="get" action="/admin/customers">
    <label>Search
      <input type="text" name="search" value="${escapeHtml(params.get("search") || "")}" placeholder="id, name, email, phone..." />
    </label>
    <label>Page size
      <select name="page_size">
        <option value="10"${pageSize === "10" ? " selected" : ""}>10</option>
        <option value="25"${pageSize === "25" ? " selected" : ""}>25</option>
        <option value="50"${pageSize === "50" ? " selected" : ""}>50</option>
      </select>
    </label>
    <button type="submit">Apply</button>
  </form>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Email</th>
        <th>Phone</th>
        <th>Language</th>
        <th>Leads</th>
        <th>Updated</th>
      </tr>
    </thead>
    <tbody>
      ${rows || "<tr><td colspan='7'>No customers found</td></tr>"}
    </tbody>
  </table>
  <div class="pager">
    <span>Page ${paged.page} / ${paged.total_pages}</span>
    ${prevLink}
    ${nextLink}
  </div>
</body>
</html>`
  );
}

async function handleAdminLeadsPage(req, res) {
  const store = await readStore();
  const requestUrl = new URL(req.url, "http://localhost");
  const filtered = filterAndSortLeads(store, requestUrl.searchParams);
  const paged = paginate(filtered.items, requestUrl.searchParams);
  const params = requestUrl.searchParams;
  const stageValue = normalizeStageFilter(params.get("stage"));
  const searchValue = normalizeText(params.get("search"));
  const pageSizeValue = String(paged.page_size);
  const sortValue = filtered.sort;

  const detailBaseQuery = new URLSearchParams(params);
  detailBaseQuery.delete("page");
  const detailQuery = detailBaseQuery.toString();

  const rows = paged.items
    .map((lead) => {
      const href = `/admin/leads/${encodeURIComponent(lead.id)}${detailQuery ? `?${detailQuery}` : ""}`;
      return `<tr>
        <td><a href="${escapeHtml(href)}">${escapeHtml(lead.id)}</a></td>
        <td>${escapeHtml(lead.stage)}</td>
        <td>${escapeHtml(lead.destination)}</td>
        <td>${escapeHtml(lead.style)}</td>
        <td>${escapeHtml(lead.owner_name || "Unassigned")}</td>
        <td>${escapeHtml(lead.sla_due_at || "-")}</td>
      </tr>`;
    })
    .join("\n");

  const stageOptions = [`<option value="">All stages</option>`]
    .concat(
      STAGE_ORDER.map((stage) => {
        const selected = stage === stageValue ? " selected" : "";
        return `<option value="${stage}"${selected}>${stage}</option>`;
      })
    )
    .join("\n");

  const sortOptions = [
    { value: "created_at_desc", label: "Newest first" },
    { value: "created_at_asc", label: "Oldest first" },
    { value: "updated_at_desc", label: "Recently updated" },
    { value: "sla_due_at_asc", label: "SLA due soonest" },
    { value: "sla_due_at_desc", label: "SLA due latest" }
  ]
    .map((option) => {
      const selected = option.value === sortValue ? " selected" : "";
      return `<option value="${option.value}"${selected}>${option.label}</option>`;
    })
    .join("\n");

  function pageLink(targetPage) {
    const next = new URLSearchParams(params);
    next.set("page", String(targetPage));
    return `/admin/leads?${next.toString()}`;
  }

  const prevLink = paged.page > 1 ? `<a href="${escapeHtml(pageLink(paged.page - 1))}">Previous</a>` : "";
  const nextLink =
    paged.page < paged.total_pages ? `<a href="${escapeHtml(pageLink(paged.page + 1))}">Next</a>` : "";
  const customersHref = "/admin/customers";
  const homeHref = "/admin";

  sendHtml(
    res,
    200,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Lead Pipeline</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    form { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 0.5rem; align-items: end; margin-bottom: 1rem; }
    input, select, button { padding: 0.45rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
    th { background: #f6f6f6; }
    .pager { display: flex; gap: 1rem; margin-top: 1rem; align-items: center; }
  </style>
</head>
<body>
  <h1>Lead Pipeline</h1>
  <p><a href="${escapeHtml(homeHref)}">Admin home</a> | <a href="${escapeHtml(customersHref)}">Customers UI</a></p>
  <p>Total leads (all): ${store.leads.length}</p>
  <p>Total leads (filtered): ${paged.total}</p>
  <form method="get" action="/admin/leads">
    <label>Stage
      <select name="stage">${stageOptions}</select>
    </label>
    <label>Search
      <input type="text" name="search" value="${escapeHtml(searchValue)}" placeholder="name, email, destination..." />
    </label>
    <label>Sort
      <select name="sort">${sortOptions}</select>
    </label>
    <label>Page size
      <select name="page_size">
        <option value="10"${pageSizeValue === "10" ? " selected" : ""}>10</option>
        <option value="25"${pageSizeValue === "25" ? " selected" : ""}>25</option>
        <option value="50"${pageSizeValue === "50" ? " selected" : ""}>50</option>
      </select>
    </label>
    <button type="submit">Apply</button>
  </form>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Stage</th>
        <th>Destination</th>
        <th>Style</th>
        <th>Owner</th>
        <th>SLA Due</th>
      </tr>
    </thead>
    <tbody>
      ${rows || "<tr><td colspan='6'>No leads yet</td></tr>"}
    </tbody>
  </table>
  <div class="pager">
    <span>Page ${paged.page} / ${paged.total_pages}</span>
    ${prevLink}
    ${nextLink}
  </div>
  <p><a href="/admin">Back</a></p>
</body>
</html>`
  );
}

async function handleAdminCustomerDetailPage(req, res, [customerId]) {
  const store = await readStore();
  const requestUrl = new URL(req.url, "http://localhost");
  const backQuery = requestUrl.searchParams.toString();
  const customer = store.customers.find((item) => item.id === customerId);

  if (!customer) {
    sendHtml(
      res,
      404,
      `<h1>Customer not found</h1><p><a href='/admin/customers${backQuery ? `?${escapeHtml(backQuery)}` : ""}'>Back</a></p>`
    );
    return;
  }

  const relatedLeads = store.leads
    .filter((lead) => lead.customer_id === customer.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const leadRows = relatedLeads
    .map((lead) => {
      const href = `/admin/leads/${encodeURIComponent(lead.id)}${backQuery ? `?${backQuery}` : ""}`;
      return `<tr>
        <td><a href="${escapeHtml(href)}">${escapeHtml(lead.id)}</a></td>
        <td>${escapeHtml(lead.stage)}</td>
        <td>${escapeHtml(lead.destination)}</td>
        <td>${escapeHtml(lead.style)}</td>
        <td>${escapeHtml(lead.owner_name || "Unassigned")}</td>
        <td>${escapeHtml(lead.created_at)}</td>
      </tr>`;
    })
    .join("\n");

  sendHtml(
    res,
    200,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(customer.id)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; max-width: 980px; }
    pre { background: #f6f6f6; padding: 1rem; overflow: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
    th { background: #f6f6f6; }
  </style>
</head>
<body>
  <h1>Customer ${escapeHtml(customer.id)}</h1>
  <p><a href="/admin/customers${backQuery ? `?${escapeHtml(backQuery)}` : ""}">Back to customers</a></p>
  <h2>Profile</h2>
  <pre>${escapeHtml(JSON.stringify(customer, null, 2))}</pre>

  <h2>Related Leads (${relatedLeads.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Lead ID</th>
        <th>Stage</th>
        <th>Destination</th>
        <th>Style</th>
        <th>Owner</th>
        <th>Created</th>
      </tr>
    </thead>
    <tbody>
      ${leadRows || "<tr><td colspan='6'>No related leads</td></tr>"}
    </tbody>
  </table>
</body>
</html>`
  );
}

async function handleAdminLeadDetailPage(req, res, [leadId]) {
  const store = await readStore();
  const staff = await loadStaff();
  const requestUrl = new URL(req.url, "http://localhost");
  const backQuery = requestUrl.searchParams.toString();
  const lead = store.leads.find((item) => item.id === leadId);

  if (!lead) {
    sendHtml(
      res,
      404,
      `<h1>Lead not found</h1><p><a href='/admin/leads${backQuery ? `?${escapeHtml(backQuery)}` : ""}'>Back</a></p>`
    );
    return;
  }

  const customer = store.customers.find((item) => item.id === lead.customer_id) || null;
  const activities = store.activities
    .filter((item) => item.lead_id === lead.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const activityRows = activities
    .map((item) => `<li><strong>${escapeHtml(item.created_at)}</strong> [${escapeHtml(item.type)}] ${escapeHtml(item.detail)} (${escapeHtml(item.actor)})</li>`)
    .join("\n");

  const stageOptions = STAGE_ORDER.map((stage) => `<option value="${stage}">${stage}</option>`).join("\n");
  const ownerOptions = [`<option value="">Unassigned</option>`]
    .concat(
      staff
        .filter((member) => member.active)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((member) => `<option value="${escapeHtml(member.id)}">${escapeHtml(member.name)}</option>`)
    )
    .join("\n");

  sendHtml(
    res,
    200,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(lead.id)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; max-width: 900px; }
    pre { background: #f6f6f6; padding: 1rem; overflow: auto; }
    input, textarea, select, button { width: 100%; margin: 0.25rem 0 0.75rem; padding: 0.5rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  </style>
</head>
<body>
  <h1>Lead ${escapeHtml(lead.id)}</h1>
  <p>Stage: <strong>${escapeHtml(lead.stage)}</strong></p>
  <p>Owner: <strong>${escapeHtml(lead.owner_name || "Unassigned")}</strong></p>

  <div class="grid">
    <section>
      <h2>Lead</h2>
      <pre>${escapeHtml(JSON.stringify(lead, null, 2))}</pre>
    </section>
    <section>
      <h2>Customer</h2>
      <pre>${escapeHtml(JSON.stringify(customer, null, 2))}</pre>
    </section>
  </div>

  <section>
    <h2>Activities</h2>
    <ul>${activityRows || "<li>No activities</li>"}</ul>
  </section>

  <section>
    <h2>Quick updates</h2>
    <label>Set Owner</label>
    <select id="ownerSelect">${ownerOptions}</select>
    <button id="ownerBtn" type="button">Update Owner</button>

    <label>Change Stage</label>
    <select id="stageSelect">${stageOptions}</select>
    <button id="stageBtn" type="button">Update Stage</button>

    <label>Add Note</label>
    <textarea id="note" rows="4" placeholder="Call notes, qualification details, customer preferences..."></textarea>
    <button id="noteBtn" type="button">Add Activity</button>
  </section>

  <p><a href="/admin/leads${backQuery ? `?${escapeHtml(backQuery)}` : ""}">Back to pipeline</a></p>

  <script>
    const leadId = ${JSON.stringify(lead.id)};
    const currentStage = ${JSON.stringify(lead.stage)};
    const currentOwnerId = ${JSON.stringify(lead.owner_id || "")};
    document.getElementById("stageSelect").value = currentStage;
    document.getElementById("ownerSelect").value = currentOwnerId;

    async function updateStage() {
      const stage = document.getElementById("stageSelect").value;
      const response = await fetch('/api/v1/leads/' + leadId + '/stage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, actor: 'admin_ui' })
      });
      const payload = await response.json();
      if (!response.ok) {
        alert(payload.error || 'Failed to update stage');
        return;
      }
      window.location.reload();
    }

    async function updateOwner() {
      const owner_id = document.getElementById("ownerSelect").value;
      const response = await fetch('/api/v1/leads/' + leadId + '/owner', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_id, actor: 'admin_ui' })
      });
      const payload = await response.json();
      if (!response.ok) {
        alert(payload.error || 'Failed to update owner');
        return;
      }
      window.location.reload();
    }

    async function addNote() {
      const detail = document.getElementById("note").value.trim();
      if (!detail) return;
      const response = await fetch('/api/v1/leads/' + leadId + '/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'NOTE', detail, actor: 'admin_ui' })
      });
      const payload = await response.json();
      if (!response.ok) {
        alert(payload.error || 'Failed to add note');
        return;
      }
      window.location.reload();
    }

    document.getElementById("stageBtn").addEventListener("click", updateStage);
    document.getElementById("ownerBtn").addEventListener("click", updateOwner);
    document.getElementById("noteBtn").addEventListener("click", addNote);
  </script>
</body>
</html>`
  );
}
