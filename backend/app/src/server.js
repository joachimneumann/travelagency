import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import { createAuth } from "./auth.js";
import { buildApiRoutes } from "./http/routes.js";
import { buildPaginatedListResponse } from "./http/pagination.js";
import { createBookingHandlers } from "./http/handlers/bookings.js";
import { createCustomerHandlers } from "./http/handlers/customers.js";
import { createTravelGroupHandlers } from "./http/handlers/travel_groups.js";
import { createTourHandlers } from "./http/handlers/tours.js";
import {
  isLikelyPhoneMatch,
  normalizeEmail,
  normalizePhone,
  normalizePhoneDigits
} from "./domain/phone_matching.js";
import {
  currencyDefinition as generatedCurrencyDefinition,
  normalizeCurrencyCode as normalizeGeneratedCurrencyCode
} from "../Generated/Models/generated_Currency.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(APP_ROOT, "data", "store.json");
const TOURS_DIR = path.join(APP_ROOT, "data", "tours");
const INVOICES_DIR = path.join(APP_ROOT, "data", "invoices");
const CONSENT_EVIDENCE_DIR = path.join(APP_ROOT, "data", "consent-evidence");
const CUSTOMER_PHOTOS_DIR = path.join(APP_ROOT, "data", "customer-photos");
const TEMP_UPLOAD_DIR = path.join(APP_ROOT, "data", "tmp");
const ATP_STAFF_PATH = path.join(APP_ROOT, "config", "atp_staff.json");
const LOGO_PNG_PATH = path.resolve(APP_ROOT, "..", "..", "assets", "img", "logo-asiatravelplan.png");
const MOBILE_CONTRACT_META_PATH = path.resolve(APP_ROOT, "..", "..", "api", "generated", "mobile-api.meta.json");
const BACKEND_GENERATED_REQUEST_FACTORY_PATH = path.join(APP_ROOT, "Generated", "API", "generated_APIRequestFactory.js");
const PORT = Number(process.env.PORT || 8787);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const execFile = promisify(execFileCb);
const STAGING_ACCESS_ENABLED = String(process.env.STAGING_ACCESS_ENABLED || "").trim().toLowerCase() === "true";
const STAGING_ACCESS_PASSWORD = String(process.env.STAGING_ACCESS_PASSWORD || "");
const STAGING_ACCESS_COOKIE_SECRET = String(process.env.STAGING_ACCESS_COOKIE_SECRET || "");
const STAGING_ACCESS_COOKIE_NAME = normalizeText(process.env.STAGING_ACCESS_COOKIE_NAME || "asiatravelplan_staging_access");
const STAGING_ACCESS_MAX_AGE_SECONDS = Math.max(60, Number(process.env.STAGING_ACCESS_MAX_AGE_SECONDS || 60 * 60 * 24 * 30) || 60);
const MOBILE_MIN_SUPPORTED_APP_VERSION = normalizeText(process.env.MOBILE_MIN_SUPPORTED_APP_VERSION || "1.0.0");
const MOBILE_LATEST_APP_VERSION = normalizeText(process.env.MOBILE_LATEST_APP_VERSION || MOBILE_MIN_SUPPORTED_APP_VERSION);
const MOBILE_FORCE_UPDATE = String(process.env.MOBILE_FORCE_UPDATE || "").trim().toLowerCase() === "true";
const META_WEBHOOK_ENABLED = String(process.env.META_WEBHOOK_ENABLED || "").trim().toLowerCase() === "true";
const WHATSAPP_WEBHOOK_ENABLED = String(process.env.WHATSAPP_WEBHOOK_ENABLED || "").trim().toLowerCase() === "true";
const META_WEBHOOK_VERIFY_TOKEN = normalizeText(process.env.META_WEBHOOK_VERIFY_TOKEN || "");
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = normalizeText(process.env.WHATSAPP_VERIFY_TOKEN || "");
const META_APP_SECRET = normalizeText(process.env.META_APP_SECRET || "");
const WHATSAPP_APP_SECRET = normalizeText(process.env.WHATSAPP_APP_SECRET || "");
const META_WEBHOOK_STATUS = {
  verify_requests: 0,
  ingest_requests: 0,
  signature_failures: 0,
  json_parse_failures: 0,
  last_verify_at: null,
  last_ingest_at: null,
  last_result: null
};
const COMPANY_PROFILE = {
  name: "AsiaTravelPlan",
  website: "asiatravelplan.com",
  address: "alley 378 Cua Dai, 550000 Hoi An, Vietnam",
  whatsapp: "+84 337942446",
  email: "info@asiatravelplan.com"
};

const STAGES = {
  NEW: "NEW",
  QUALIFIED: "QUALIFIED",
  PROPOSAL_SENT: "PROPOSAL_SENT",
  NEGOTIATION: "NEGOTIATION",
  INVOICE_SENT: "INVOICE_SENT",
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
  WON: "WON",
  LOST: "LOST",
  POST_TRIP: "POST_TRIP"
};

const STAGE_ORDER = [
  STAGES.NEW,
  STAGES.QUALIFIED,
  STAGES.PROPOSAL_SENT,
  STAGES.NEGOTIATION,
  STAGES.INVOICE_SENT,
  STAGES.PAYMENT_RECEIVED,
  STAGES.WON,
  STAGES.LOST,
  STAGES.POST_TRIP
];

const APP_ROLES = {
  ADMIN: "atp_admin",
  MANAGER: "atp_manager",
  ACCOUNTANT: "atp_accountant",
  ATP_STAFF: "atp_staff"
};

const FX_RATE_CACHE_TTL_MS = 5 * 60 * 1000;
const fxRateCache = new Map();
const FX_RATE_CACHE_STALE_MS = 30 * 60 * 1000;

const PRICING_ADJUSTMENT_TYPES = {
  DISCOUNT: "DISCOUNT",
  CREDIT: "CREDIT",
  SURCHARGE: "SURCHARGE"
};

const PAYMENT_STATUSES = {
  PENDING: "PENDING",
  PAID: "PAID"
};

const OFFER_CATEGORIES = {
  ACCOMMODATION: "ACCOMMODATION",
  TRANSPORTATION: "TRANSPORTATION",
  TOURS_ACTIVITIES: "TOURS_ACTIVITIES",
  GUIDE_SUPPORT_SERVICES: "GUIDE_SUPPORT_SERVICES",
  MEALS: "MEALS",
  FEES_TAXES: "FEES_TAXES",
  DISCOUNTS_CREDITS: "DISCOUNTS_CREDITS",
  OTHER: "OTHER"
};

const OFFER_CATEGORY_ORDER = [
  OFFER_CATEGORIES.ACCOMMODATION,
  OFFER_CATEGORIES.TRANSPORTATION,
  OFFER_CATEGORIES.TOURS_ACTIVITIES,
  OFFER_CATEGORIES.GUIDE_SUPPORT_SERVICES,
  OFFER_CATEGORIES.MEALS,
  OFFER_CATEGORIES.FEES_TAXES,
  OFFER_CATEGORIES.DISCOUNTS_CREDITS,
  OFFER_CATEGORIES.OTHER
];

const DEFAULT_OFFER_TAX_RATE_BASIS_POINTS = 1000;

const ALLOWED_STAGE_TRANSITIONS = {
  [STAGES.NEW]: STAGE_ORDER,
  [STAGES.QUALIFIED]: STAGE_ORDER,
  [STAGES.PROPOSAL_SENT]: STAGE_ORDER,
  [STAGES.NEGOTIATION]: STAGE_ORDER,
  [STAGES.INVOICE_SENT]: STAGE_ORDER,
  [STAGES.PAYMENT_RECEIVED]: STAGE_ORDER,
  [STAGES.WON]: STAGE_ORDER,
  [STAGES.LOST]: STAGE_ORDER,
  [STAGES.POST_TRIP]: STAGE_ORDER
};

const SLA_HOURS = {
  [STAGES.NEW]: 2,
  [STAGES.QUALIFIED]: 8,
  [STAGES.PROPOSAL_SENT]: 24,
  [STAGES.NEGOTIATION]: 48,
  [STAGES.INVOICE_SENT]: 24,
  [STAGES.PAYMENT_RECEIVED]: 0,
  [STAGES.WON]: 24,
  [STAGES.LOST]: 0,
  [STAGES.POST_TRIP]: 0
};

let writeQueue = Promise.resolve();
let mobileContractMetaPromise = null;

function normalizeExchangeRatePairKey(value) {
  const cleaned = String(value).toUpperCase().replace(/\s+/g, "");
  if (cleaned.includes("->")) {
    return cleaned;
  }
  if (/^[A-Z]{3}_[A-Z]{3}$/i.test(cleaned)) {
    return `${cleaned.slice(0, 3)}->${cleaned.slice(4)}`;
  }
  return null;
}

function loadExchangeRateOverrides() {
  const parsed = {};
  try {
    const json = String(process.env.EXCHANGE_RATE_OVERRIDES || "").trim();
    if (json) {
      const candidate = JSON.parse(json);
      if (candidate && typeof candidate === "object") {
        for (const [key, value] of Object.entries(candidate)) {
          const pair = normalizeExchangeRatePairKey(key);
          const rate = Number(value);
          if (!pair || !Number.isFinite(rate) || rate <= 0) continue;
          parsed[pair] = rate;
        }
      }
    }
  } catch (error) {
    console.error("[backend] failed to parse EXCHANGE_RATE_OVERRIDES:", error?.message || error);
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("EXCHANGE_RATE_")) continue;
    const pair = normalizeExchangeRatePairKey(key.replace(/^EXCHANGE_RATE_/, ""));
    const rate = Number(value);
    if (!pair || !Number.isFinite(rate) || rate <= 0) continue;
    parsed[pair] = rate;
  }

  return { ...parsed };
}

const EXCHANGE_RATE_OVERRIDES = loadExchangeRateOverrides();
const BASE_CURRENCY = normalizeGeneratedCurrencyCode(process.env.BASE_CURRENCY || "USD") || "USD";

function getFallbackExchangeRate(fromCurrency, toCurrency) {
  const direct = EXCHANGE_RATE_OVERRIDES[`${fromCurrency}->${toCurrency}`];
  if (Number.isFinite(direct) && direct > 0) return direct;

  const reverse = EXCHANGE_RATE_OVERRIDES[`${toCurrency}->${fromCurrency}`];
  if (Number.isFinite(reverse) && reverse > 0) return Number((1 / reverse).toFixed(10));

  return null;
}

export async function createBackendHandler({ port = PORT } = {}) {
  await ensureStorage();
  const auth = createAuth({ port });
  const bookingHandlers = createBookingHandlers({
    readBodyJson,
    sendJson,
    validateBookingInput,
    readStore,
    normalizeText,
    normalizeStringArray,
    getRequestIpAddress,
    guessCountryFromRequest,
    normalizeEmail,
    normalizePhone,
    nowIso,
    safeCurrency,
    BASE_CURRENCY,
    STAGES,
    computeSlaDueAt,
    safeInt,
    defaultBookingPricing,
    defaultBookingOffer,
    addActivity,
    persistStore,
    computeBookingHash,
    computeClientHash,
    computeCustomerHash,
    computeTravelGroupHash,
    getPrincipal,
    loadAtpStaff,
    resolvePrincipalAtpStaffMember,
    canReadAllBookings,
    filterAndSortBookings,
    canAccessBooking,
    buildBookingReadModel,
    paginate,
    buildPaginatedListResponse,
    ensureMetaChatCollections,
    clamp,
    isLikelyPhoneMatch,
    buildChatEventReadModel,
    getMetaConversationOpenUrl,
    STAGE_ORDER,
    ALLOWED_STAGE_TRANSITIONS,
    canChangeBookingStage,
    assertMatchingBookingHash,
    actorLabel,
    canChangeBookingAssignment,
    syncBookingAtpStaffFields,
    canEditBooking,
    validateBookingPricingInput,
    convertBookingPricingToBaseCurrency,
    normalizeBookingPricing,
    validateBookingOfferInput,
    convertBookingOfferToBaseCurrency,
    normalizeBookingOffer,
    validateOfferExchangeRequest,
    resolveExchangeRateWithFallback,
    convertOfferLineAmountForCurrency,
    normalizeInvoiceComponents,
    computeInvoiceComponentTotal,
    safeAmountCents,
    nextInvoiceNumber,
    writeInvoicePdf,
    randomUUID,
    invoicePdfPath,
    sendFileWithCache
  });
  const customerHandlers = createCustomerHandlers({
    getPrincipal,
    canReadCustomers,
    sendJson,
    readStore,
    normalizeText,
    paginate,
    buildPaginatedListResponse,
    buildBookingReadModel,
    canViewAtpStaffDirectory,
    loadAtpStaff,
    staffUsernames,
    canManageAtpStaff,
    readBodyJson,
    normalizeStringArray,
    persistAtpStaff,
    persistStore,
    randomUUID,
    nowIso,
    computeClientHash,
    computeCustomerHash,
    computeTravelGroupHash,
    mkdir,
    path,
    writeFile,
    stat,
    sendFileWithCache,
    CONSENT_EVIDENCE_DIR,
    CUSTOMER_PHOTOS_DIR
  });
  const travelGroupHandlers = createTravelGroupHandlers({
    sendJson,
    readStore,
    getPrincipal,
    loadAtpStaff,
    resolvePrincipalAtpStaffMember,
    canReadAllBookings,
    canAccessBooking,
    canEditBooking,
    buildPaginatedListResponse,
    paginate,
    normalizeText,
    readBodyJson,
    persistStore,
    nowIso,
    computeTravelGroupHash,
    computeClientHash,
    randomUUID
  });
  const tourHandlers = createTourHandlers({
    normalizeText,
    normalizeStringArray,
    safeInt,
    safeFloat,
    normalizeHighlights,
    toTourImagePublicUrl,
    tourDestinationCountries,
    readTours,
    sendJson,
    clamp,
    normalizeTourForRead,
    createHash,
    getPrincipal,
    canReadTours,
    paginate,
    collectTourOptions,
    buildPaginatedListResponse,
    canEditTours,
    readBodyJson,
    nowIso,
    randomUUID,
    persistTour,
    resolveTourImageDiskPath,
    sendFileWithCache,
    mkdir,
    path,
    execFile,
    TEMP_UPLOAD_DIR,
    TOURS_DIR,
    writeFile,
    rm
  });
  const routes = buildApiRoutes({
    authRoutes: auth.routes,
    handlers: {
      handleHealth,
      handleMetaWebhookStatus,
      handleMetaWebhookVerify,
      handleMetaWebhookIngest,
      handleStagingAccessLoginPage,
      handleStagingAccessLoginSubmit,
      handleStagingAccessCheck,
      handleStagingAccessLogout,
      handleMobileBootstrap,
      ...bookingHandlers,
      ...customerHandlers,
      ...travelGroupHandlers,
      ...tourHandlers
    }
  });

  return async function backendHandler(req, res) {
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

      if (pathname.startsWith("/api/v1/")) {
        const authz = await auth.authorizeApiRequest(req, requestUrl);
        if (!authz.ok) {
          sendJson(res, 401, { error: "Unauthorized" });
          return;
        }
        req.authz = authz;
      }

      for (const route of routes) {
        if (route.method !== req.method) continue;
        const match = pathname.match(route.pattern);
        if (!match) continue;
        const params = match.slice(1);
        await route.handler(req, res, params);
        return;
      }

      if (pathname.startsWith("/api/")) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }

      sendBackendNotFound(res, pathname);
    } catch (error) {
      sendJson(res, 500, { error: "Internal server error", detail: String(error?.message || error) });
    }
  };
}

export async function startBackendServer({ port = PORT } = {}) {
  const handler = await createBackendHandler({ port });
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(port, resolve));
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const server = await startBackendServer({ port: PORT });
  console.log(`AsiaTravelPlan backend listening on http://localhost:${server.address().port}`);
}

async function ensureStorage() {
  await mkdir(TOURS_DIR, { recursive: true });
  await mkdir(INVOICES_DIR, { recursive: true });
  await mkdir(CONSENT_EVIDENCE_DIR, { recursive: true });
  await mkdir(CUSTOMER_PHOTOS_DIR, { recursive: true });
  await mkdir(TEMP_UPLOAD_DIR, { recursive: true });
}

function withCors(req, res) {
  const requestOrigin = normalizeText(req.headers.origin);
  const allowedOrigins = String(CORS_ORIGIN || "*")
    .split(",")
    .map((value) => normalizeText(value))
    .filter(Boolean);
  const allowAny = allowedOrigins.includes("*");
  const allowThisOrigin = allowAny
    ? requestOrigin || "*"
    : allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0] || "";

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

function appendSetCookie(res, cookieValue) {
  const previous = res.getHeader("Set-Cookie");
  if (!previous) {
    res.setHeader("Set-Cookie", [cookieValue]);
    return;
  }
  const list = Array.isArray(previous) ? previous : [String(previous)];
  list.push(cookieValue);
  res.setHeader("Set-Cookie", list);
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...extraHeaders });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function sendBackendNotFound(res, pathname = "") {
  const backHref = "/";
  const backLabel = "Back to website";

  sendHtml(
    res,
    404,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Not Found | AsiaTravelPlan Backend</title>
    <style>
      :root {
        --ink: #163040;
        --muted: #5b6c78;
        --line: #d7e0e6;
        --paper: #f4f7f8;
        --white: #ffffff;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        min-height: 100vh;
        font-family: "Segoe UI", "Avenir Next", "Helvetica Neue", Arial, sans-serif;
        color: var(--ink);
        background: linear-gradient(180deg, #f7fafb 0%, #eef3f5 100%);
        display: grid;
        place-items: center;
        padding: 1.5rem;
      }
      .panel {
        width: min(760px, 100%);
        background: rgba(255,255,255,0.92);
        border: 1px solid var(--line);
        border-radius: 24px;
        box-shadow: 0 18px 48px rgba(22, 48, 64, 0.10);
        padding: 2.5rem;
      }
      .eyebrow {
        margin: 0 0 0.75rem;
        font-size: 0.8rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
      }
      h1 {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3.2rem);
        line-height: 0.98;
      }
      .booking {
        margin: 1rem 0 0;
        max-width: 34ch;
        color: var(--muted);
        line-height: 1.6;
      }
      .contact {
        margin: 1.25rem 0 0;
        padding: 0.95rem 1rem;
        background: var(--paper);
        border-left: 4px solid var(--ink);
        font-weight: 600;
      }
      .actions {
        display: flex;
        gap: 0.8rem;
        flex-wrap: wrap;
        margin-top: 1.5rem;
      }
      .btn {
        text-decoration: none;
        border-radius: 999px;
        padding: 0.8rem 1.15rem;
        border: 1px solid var(--ink);
        color: var(--ink);
      }
      .btn-primary {
        background: var(--ink);
        color: var(--white);
      }
      .meta {
        margin-top: 1.25rem;
        color: var(--muted);
        font-size: 0.92rem;
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <p class="eyebrow">Backend 404</p>
      <h1>Page not found</h1>
      <p class="booking">The backend route you requested does not exist or is no longer available.</p>
      <p class="contact">please contact Joachim</p>
      <div class="actions">
        <a class="btn btn-primary" href="${escapeHtml(backHref)}">${escapeHtml(backLabel)}</a>
        <a class="btn" href="mailto:info@asiatravelplan.com">Email us</a>
      </div>
      <p class="meta">Requested path: <code>${escapeHtml(pathname || "/")}</code></p>
    </main>
  </body>
</html>`
  );
}

function parseCookies(req) {
  const cookieHeader = String(req.headers.cookie || "");
  const cookies = {};
  for (const segment of cookieHeader.split(";")) {
    const [rawKey, ...rest] = segment.trim().split("=");
    if (!rawKey) continue;
    cookies[rawKey] = decodeURIComponent(rest.join("=") || "");
  }
  return cookies;
}

function signStagingAccessCookie(password) {
  return createHmac("sha256", STAGING_ACCESS_COOKIE_SECRET).update(String(password || ""), "utf8").digest("hex");
}

function safeEqualText(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function hasValidStagingAccess(req) {
  if (!STAGING_ACCESS_ENABLED) return true;
  if (!STAGING_ACCESS_PASSWORD || !STAGING_ACCESS_COOKIE_SECRET) return false;
  const cookies = parseCookies(req);
  const actual = normalizeText(cookies[STAGING_ACCESS_COOKIE_NAME]);
  const expected = signStagingAccessCookie(STAGING_ACCESS_PASSWORD);
  return Boolean(actual && expected && safeEqualText(actual, expected));
}

function setStagingAccessCookie(res) {
  const value = signStagingAccessCookie(STAGING_ACCESS_PASSWORD);
  appendSetCookie(
    res,
    `${STAGING_ACCESS_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STAGING_ACCESS_MAX_AGE_SECONDS}`
  );
}

function clearStagingAccessCookie(res) {
  appendSetCookie(res, `${STAGING_ACCESS_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

function normalizeReturnToPath(value, fallback = "/") {
  const raw = normalizeText(value);
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw.startsWith("/staging-access/")) return fallback;
  return raw;
}

function getForwardedPath(req) {
  const forwardedUri = normalizeText(req.headers["x-forwarded-uri"]);
  if (forwardedUri) return normalizeReturnToPath(forwardedUri, "/");
  try {
    const requestUrl = new URL(req.url, "http://localhost");
    return normalizeReturnToPath(`${requestUrl.pathname}${requestUrl.search}`, "/");
  } catch {
    return "/";
  }
}

function renderStagingAccessLogin({ error = "", returnTo = "/" } = {}) {
  const safeReturnTo = normalizeReturnToPath(returnTo, "/");
  const errorBlock = error ? `<p class="error">${escapeHtml(error)}</p>` : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Staging Access | AsiaTravelPlan</title>
    <style>
      :root {
        --ink: #16222d;
        --muted: #5f6f7a;
        --line: #d9e1e6;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        font-family: "Segoe UI", "Avenir Next", "Helvetica Neue", Arial, sans-serif;
        color: var(--ink);
        background: linear-gradient(180deg, #f6f9fa 0%, #eef3f5 100%);
      }
      .card {
        width: min(440px, 100%);
        background: rgba(255,255,255,0.96);
        border: 1px solid var(--line);
        border-radius: 20px;
        box-shadow: 0 18px 48px rgba(16, 33, 45, 0.10);
        padding: 2rem;
      }
      h1 { margin: 0 0 0.75rem; font-size: 1.8rem; }
      p { margin: 0 0 1rem; color: var(--muted); }
      label { display: block; font-weight: 600; margin-bottom: 0.5rem; }
      input[type="password"] {
        width: 100%;
        padding: 0.8rem 0.9rem;
        border: 1px solid var(--line);
        border-radius: 12px;
        font: inherit;
      }
      button {
        width: 100%;
        margin-top: 1rem;
        border: 0;
        border-radius: 12px;
        padding: 0.85rem 1rem;
        background: #163040;
        color: #fff;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .error {
        color: #a33434;
        background: #fff0f0;
        border: 1px solid #f0cccc;
        border-radius: 12px;
        padding: 0.75rem 0.9rem;
      }
      .micro { margin-top: 1rem; font-size: 0.9rem; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Staging Access</h1>
      <p>This environment is password-protected and not intended for public access.</p>
      ${errorBlock}
      <form method="post" action="/staging-access/login">
        <input type="hidden" name="return_to" value="${escapeHtml(safeReturnTo)}" />
        <label for="stagingAccessPassword">Password</label>
        <input id="stagingAccessPassword" name="password" type="password" autocomplete="current-password" required />
        <button type="submit">Continue</button>
      </form>
      <p class="micro">Access is remembered with a secure cookie for approximately ${Math.round(
        STAGING_ACCESS_MAX_AGE_SECONDS / (60 * 60 * 24)
      )} days.</p>
    </main>
  </body>
</html>`;
}

async function handleStagingAccessLoginPage(req, res) {
  if (!STAGING_ACCESS_ENABLED) {
    redirect(res, "/");
    return;
  }
  const requestUrl = new URL(req.url, "http://localhost");
  const returnTo = normalizeReturnToPath(requestUrl.searchParams.get("return_to"), "/");
  if (hasValidStagingAccess(req)) {
    redirect(res, returnTo);
    return;
  }
  sendHtml(res, 200, renderStagingAccessLogin({ returnTo }));
}

async function handleStagingAccessLoginSubmit(req, res) {
  if (!STAGING_ACCESS_ENABLED) {
    redirect(res, "/");
    return;
  }
  const contentType = normalizeText(req.headers["content-type"]).toLowerCase();
  if (!contentType.includes("application/x-www-form-urlencoded")) {
    sendJson(res, 415, { error: "Expected form submission" });
    return;
  }
  const body = await readBodyText(req);
  const params = new URLSearchParams(body);
  const password = String(params.get("password") || "");
  const returnTo = normalizeReturnToPath(params.get("return_to"), "/");
  if (!STAGING_ACCESS_PASSWORD || !STAGING_ACCESS_COOKIE_SECRET) {
    sendHtml(res, 500, renderStagingAccessLogin({ error: "Staging access is not configured.", returnTo }));
    return;
  }
  if (!safeEqualText(password, STAGING_ACCESS_PASSWORD)) {
    sendHtml(res, 401, renderStagingAccessLogin({ error: "Incorrect password.", returnTo }));
    return;
  }
  setStagingAccessCookie(res);
  redirect(res, returnTo);
}

async function handleStagingAccessCheck(req, res) {
  if (!STAGING_ACCESS_ENABLED || hasValidStagingAccess(req)) {
    res.writeHead(204);
    res.end();
    return;
  }
  const returnTo = getForwardedPath(req);
  redirect(res, `/staging-access/login?return_to=${encodeURIComponent(returnTo)}`);
}

async function handleStagingAccessLogout(req, res) {
  clearStagingAccessCookie(res);
  redirect(res, "/staging-access/login");
}

function getMimeTypeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
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
  const text = await readBodyText(req);
  if (!text) return {};
  return JSON.parse(text);
}

async function readBodyBuffer(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function readBodyText(req) {
  const buffer = await readBodyBuffer(req);
  return buffer.toString("utf8").trim();
}

async function readStore() {
  const raw = await readFile(DATA_PATH, "utf8");
  const parsed = JSON.parse(raw);
  parsed.clients ||= [];
  parsed.customers ||= [];
  parsed.bookings ||= [];
  parsed.activities ||= [];
  parsed.invoices ||= [];
  parsed.customer_consents ||= [];
  parsed.customer_documents ||= [];
  parsed.travel_groups ||= [];
  parsed.travel_group_members ||= [];
  parsed.chat_channel_accounts ||= [];
  parsed.chat_conversations ||= [];
  parsed.chat_events ||= [];
  const convertedBookings = await Promise.all(parsed.bookings.map(async (booking) => {
    syncBookingAtpStaffFields(booking);
    booking.pricing = normalizeBookingPricing(booking.pricing);
    booking.offer = normalizeBookingOffer(booking.offer, getBookingPreferredCurrency(booking));
    booking.pricing = await convertBookingPricingToBaseCurrency(booking.pricing);
    booking.offer = await convertBookingOfferToBaseCurrency(booking.offer);
    return booking;
  }));
  parsed.bookings = convertedBookings;
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

async function loadAtpStaff() {
  try {
    const raw = await readFile(ATP_STAFF_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("[backend] failed to load atp_staff.json:", error?.message || error);
    return [];
  }
}

async function persistAtpStaff(atp_staff) {
  writeQueue = writeQueue.then(async () => {
    await writeFile(ATP_STAFF_PATH, `${JSON.stringify(atp_staff, null, 2)}\n`, "utf8");
  });
  await writeQueue;
}

function nowIso() {
  return new Date().toISOString();
}

function resolveCustomerByExternalContact(store, externalContactId) {
  if (!externalContactId) return null;
  const exactMatches = (store.customers || []).filter((customer) => isLikelyPhoneMatch(customer.phone_number, externalContactId));
  if (exactMatches.length === 1) return exactMatches[0];
  return null;
}

function resolveBookingForClient(store, clientId) {
  if (!clientId) return null;
  const activeStages = new Set([
    STAGES.NEW,
    STAGES.QUALIFIED,
    STAGES.PROPOSAL_SENT,
    STAGES.NEGOTIATION,
    STAGES.INVOICE_SENT,
    STAGES.PAYMENT_RECEIVED
  ]);

  const matches = store.bookings
    .filter((booking) => booking.client_id === clientId)
    .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
  if (!matches.length) return null;
  const active = matches.find((booking) => activeStages.has(booking.stage));
  return active || matches[0];
}

function getMetaConversationOpenUrl(channel, externalContactId) {
  if (channel === "whatsapp") {
    const digits = normalizePhoneDigits(externalContactId);
    return digits ? `https://wa.me/${digits}` : null;
  }
  return null;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) return normalizeText(value[0]);
  return normalizeText(value);
}

function normalizeIpAddress(value) {
  let text = firstHeaderValue(value);
  if (!text) return "";
  if (text.includes(",")) {
    text = normalizeText(text.split(",")[0]);
  }
  if (text.startsWith("::ffff:")) {
    text = text.slice(7);
  }
  return text;
}

function getRequestIpAddress(req) {
  return (
    normalizeIpAddress(req.headers["x-forwarded-for"]) ||
    normalizeIpAddress(req.headers["x-real-ip"]) ||
    normalizeIpAddress(req.socket?.remoteAddress) ||
    ""
  );
}

function isPrivateOrLocalIp(ip) {
  const text = normalizeIpAddress(ip);
  if (!text) return false;
  if (text === "127.0.0.1" || text === "::1" || text === "localhost") return true;
  if (text.startsWith("10.")) return true;
  if (text.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(text)) return true;
  if (text.startsWith("fc") || text.startsWith("fd")) return true;
  if (text.startsWith("fe80:")) return true;
  return false;
}

function ipv4ToInt(ip) {
  const parts = normalizeIpAddress(ip)
    .split(".")
    .map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
}

function ipv4CidrContains(ip, cidr) {
  const [base, prefixText] = String(cidr).split("/");
  const prefix = Number(prefixText);
  const ipValue = ipv4ToInt(ip);
  const baseValue = ipv4ToInt(base);
  if (ipValue === null || baseValue === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }
  if (prefix === 0) return true;
  const mask = prefix === 32 ? 0xffffffff : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipValue & mask) === (baseValue & mask);
}

function guessCountryFromIpRange(ipAddress) {
  const text = normalizeIpAddress(ipAddress);
  if (!text || text.includes(":")) return "";

  // Best-effort IPv4 fallback for common Vietnam allocations when no trusted proxy country header exists.
  const vietnamCidrs = [
    "14.160.0.0/11",
    "14.224.0.0/11",
    "27.64.0.0/12",
    "42.112.0.0/13",
    "58.186.0.0/15",
    "113.160.0.0/11",
    "115.72.0.0/13",
    "116.96.0.0/12",
    "123.16.0.0/12",
    "171.224.0.0/12",
    "171.244.0.0/14",
    "203.162.0.0/16",
    "203.210.128.0/17",
    "222.252.0.0/14"
  ];

  if (vietnamCidrs.some((cidr) => ipv4CidrContains(text, cidr))) {
    return "VN";
  }

  return "";
}

function formatCountryGuessLabel(value) {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) return "";
  if (normalized === "VN") return "Vietnam (VN)";
  if (normalized === "LOCAL/PRIVATE") return "Local/Private";
  if (normalized === "UNKNOWN") return "Unknown";
  return normalized;
}

function guessCountryFromRequest(req, ipAddress) {
  const proxyCountry =
    firstHeaderValue(req.headers["cf-ipcountry"]) ||
    firstHeaderValue(req.headers["cloudfront-viewer-country"]) ||
    firstHeaderValue(req.headers["fastly-country-code"]) ||
    firstHeaderValue(req.headers["x-country-code"]) ||
    firstHeaderValue(req.headers["x-vercel-ip-country"]);
  const normalizedProxyCountry = normalizeText(proxyCountry).toUpperCase();
  if (normalizedProxyCountry && normalizedProxyCountry !== "XX" && normalizedProxyCountry !== "T1") {
    return formatCountryGuessLabel(normalizedProxyCountry);
  }
  if (!ipAddress) return formatCountryGuessLabel("UNKNOWN");
  if (isPrivateOrLocalIp(ipAddress)) return formatCountryGuessLabel("LOCAL/PRIVATE");
  const fallbackCountry = guessCountryFromIpRange(ipAddress);
  if (fallbackCountry) return formatCountryGuessLabel(fallbackCountry);
  return formatCountryGuessLabel("UNKNOWN");
}

function safeInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeOptionalInt(value) {
  if (!normalizeText(value)) return null;
  return safeInt(value);
}

function safeFloat(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function computeSlaDueAt(stage, from = new Date()) {
  const hours = SLA_HOURS[stage] ?? 0;
  if (!hours) return null;
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function safeCurrency(value) {
  return normalizeGeneratedCurrencyCode(value) || BASE_CURRENCY;
}

function getBookingPreferredCurrency(booking = null) {
  return safeCurrency(booking?.preferred_currency || booking?.pricing?.currency || booking?.offer?.currency || BASE_CURRENCY);
}

function parseCurrencyForExchange(value) {
  const normalized = normalizeGeneratedCurrencyCode(value);
  return normalized || null;
}

function getCurrencyDefinition(currency) {
  const definition = generatedCurrencyDefinition(currency) || generatedCurrencyDefinition(BASE_CURRENCY);
  return {
    code: definition.code,
    symbol: definition.symbol || definition.code,
    decimal_places: Number.isFinite(Number(definition.decimalPlaces)) ? Number(definition.decimalPlaces) : 2,
    iso_code: definition.code === "EURO" ? "EUR" : definition.code
  };
}

function safeAmountCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded > 0 ? rounded : null;
}

function getExchangeCacheKey(fromCurrency, toCurrency) {
  return `${fromCurrency}->${toCurrency}`;
}

async function fetchExchangeRate(fromCurrency, toCurrency, options = {}) {
  const { visited = new Set() } = options;
  const from = fromCurrency === "EURO" ? "EUR" : fromCurrency;
  const to = toCurrency === "EURO" ? "EUR" : toCurrency;
  if (!from || !to || from === to) return 1;

  const key = `${from}->${to}`;
  if (visited.has(key)) {
    throw new Error(`Exchange-rate conversion loop detected for ${key}`);
  }
  const nextVisited = new Set(visited);
  nextVisited.add(key);

  const now = Date.now();
  const cacheKey = getExchangeCacheKey(fromCurrency, toCurrency);
  const cached = fxRateCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.rate;

  const staleCached = fxRateCache.get(cacheKey);

  const providers = [
    async () => {
      const response = await fetch(
        `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      if (!response.ok) {
        throw new Error(`Frankfurter API request failed (${response.status})`);
      }
      const payload = await response.json();
      const rate = Number(payload?.rates?.[to]);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error("Frankfurter exchange rate response did not contain a valid rate");
      }
      return rate;
    },
    async () => {
      const symbols = Array.from(new Set([from, to])).filter(Boolean).join(",");
      const response = await fetch(
        `https://api.frankfurter.app/latest?from=EUR&to=${encodeURIComponent(symbols)}`
      );
      if (!response.ok) {
        throw new Error(`Frankfurter EUR-based API request failed (${response.status})`);
      }
      const payload = await response.json();
      const rates = payload?.rates || {};
      if (from === "EUR") {
        const toRate = Number(rates[to]);
        if (!Number.isFinite(toRate) || toRate <= 0) {
          throw new Error("Frankfurter EUR-based exchange response did not contain a valid to-rate");
        }
        return toRate;
      }
      if (to === "EUR") {
        const fromRate = Number(rates[from]);
        if (!Number.isFinite(fromRate) || fromRate <= 0) {
          throw new Error("Frankfurter EUR-based exchange response did not contain a valid from-rate");
        }
        return 1 / fromRate;
      }
      const fromRate = Number(rates[from]);
      const toRate = Number(rates[to]);
      if (!Number.isFinite(fromRate) || fromRate <= 0 || !Number.isFinite(toRate) || toRate <= 0) {
        throw new Error("Frankfurter EUR-based exchange response did not contain valid rates");
      }
      return toRate / fromRate;
    },
    async () => {
      const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`);
      if (!response.ok) {
        throw new Error(`ER-API request failed (${response.status})`);
      }
      const payload = await response.json();
      if (String(payload?.result || "").toLowerCase() !== "success" && payload?.result !== undefined) {
        throw new Error(`ER-API reported status: ${payload?.result || "unknown"}`);
      }
      const rate = Number(payload?.rates?.[to]);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error("ER-API exchange rate response did not contain a valid rate");
      }
      return rate;
    },
    async () => {
      const response = await fetch(`https://open.er-api.com/v6/latest/EUR`);
      if (!response.ok) {
        throw new Error(`ER-API EUR-based request failed (${response.status})`);
      }
      const payload = await response.json();
      if (String(payload?.result || "").toLowerCase() !== "success" && payload?.result !== undefined) {
        throw new Error(`ER-API reported status: ${payload?.result || "unknown"}`);
      }
      const rates = payload?.rates || {};
      if (from === "EUR") {
        const toRate = Number(rates[to]);
        if (!Number.isFinite(toRate) || toRate <= 0) {
          throw new Error("ER-API EUR-based exchange response did not contain a valid to-rate");
        }
        return toRate;
      }
      if (to === "EUR") {
        const fromRate = Number(rates[from]);
        if (!Number.isFinite(fromRate) || fromRate <= 0) {
          throw new Error("ER-API EUR-based exchange response did not contain a valid from-rate");
        }
        return 1 / fromRate;
      }
      const fromRate = Number(rates[from]);
      const toRate = Number(rates[to]);
      if (!Number.isFinite(fromRate) || fromRate <= 0 || !Number.isFinite(toRate) || toRate <= 0) {
        throw new Error("ER-API EUR-based exchange response did not contain valid rates");
      }
      return toRate / fromRate;
    }
  ];

  const errors = [];
  for (const provider of providers) {
    try {
      const rate = await provider();
      fxRateCache.set(cacheKey, {
        rate,
        expiresAt: now + FX_RATE_CACHE_TTL_MS
      });
      return rate;
    } catch (error) {
      errors.push(String(error?.message || error));
    }
  }

  const fallbackRate = getFallbackExchangeRate(from, to) || getFallbackExchangeRate(fromCurrency, toCurrency);
  if (Number.isFinite(fallbackRate) && fallbackRate > 0) {
    console.warn(
      `[backend] using configured fallback exchange rate ${from}->${to} = ${fallbackRate} after provider lookup failures:`,
      errors.join(" | ")
    );
    return fallbackRate;
  }

  const crossVia = [...new Set([BASE_CURRENCY, "EUR"])]
  for (const via of crossVia) {
    if (via === from || via === to) continue;
    const crossKey = getExchangeCacheKey(fromCurrency, via);
    const viaCached = fxRateCache.get(crossKey);
    const crossRate = viaCached && viaCached.expiresAt > now ? viaCached.rate : null;

    try {
      const fromToVia = crossRate || await fetchExchangeRate(fromCurrency, via, { visited: nextVisited });
      const viaToCache = getExchangeCacheKey(via, toCurrency);
      const viaToCached = fxRateCache.get(viaToCache);
      const viaTo = viaToCached && viaToCached.expiresAt > now ? viaToCached.rate : null;
      const toRate = viaTo || await fetchExchangeRate(via, toCurrency, { visited: nextVisited });
      if (fromToVia > 0 && toRate > 0) {
        const rate = fromToVia * toRate;
        fxRateCache.set(cacheKey, {
          rate,
          expiresAt: now + FX_RATE_CACHE_TTL_MS
        });
        return rate;
      }
    } catch (error) {
      errors.push(`Cross via ${via} failed: ${String(error?.message || error)}`);
    }
  }

  if (staleCached) {
    console.warn(
      `[backend] using stale exchange rate ${from}->${to} = ${staleCached.rate} after fresh-rate lookup failures:`,
      errors.join(" | ")
    );
    return staleCached.rate;
  }

  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  throw new Error("No exchange rate source available");
}

function roundConvertedAmount(amountCents, fromCurrency, toCurrency, rate) {
  const fromDefinition = getCurrencyDefinition(fromCurrency);
  const toDefinition = getCurrencyDefinition(toCurrency);
  const fromScale = 10 ** fromDefinition.decimal_places;
  const toScale = 10 ** toDefinition.decimal_places;
  const major = Number(amountCents) / fromScale;
  const converted = major * rate;
  return Math.max(0, Math.round(converted * toScale));
}

function convertMinorUnitsRaw(amountCents, fromCurrency, toCurrency, rate) {
  const fromDefinition = getCurrencyDefinition(fromCurrency);
  const toDefinition = getCurrencyDefinition(toCurrency);
  const source = Number(amountCents);
  if (!Number.isFinite(source) || source <= 0) return 0;
  const fromScale = 10 ** fromDefinition.decimal_places;
  const toScale = 10 ** toDefinition.decimal_places;
  const major = source / fromScale;
  return major * rate * toScale;
}

function convertOfferLineAmountForCurrency(component, rates, fromCurrency, toCurrency) {
  const sourceCurrency = safeCurrency(fromCurrency) || BASE_CURRENCY;
  const targetCurrency = safeCurrency(toCurrency) || BASE_CURRENCY;

  const normalizedRates = (() => {
    if (!rates) return { sourceToBaseRate: 1, baseToTargetRate: 1 };
    if (Array.isArray(rates)) {
      return {
        sourceToBaseRate: Number(rates[0]) || 1,
        baseToTargetRate: Number(rates[1]) || 1
      };
    }
    return {
      sourceToBaseRate: Number(rates.sourceToBaseRate) || 1,
      baseToTargetRate: Number(rates.baseToTargetRate) || 1
    };
  })();

  if (sourceCurrency === targetCurrency) {
    const unitAmountCents = Math.max(0, Number(component?.unit_amount_cents || 0));
    const safeQuantity = Math.max(1, safeInt(component?.quantity) || 1);
    const sign = offerCategorySign(component?.category);
    const taxBasisPoints = clampOfferTaxRateBasisPoints(component?.tax_rate_basis_points, DEFAULT_OFFER_TAX_RATE_BASIS_POINTS);
    const lineNetAmountCents = sign * unitAmountCents * safeQuantity;
    const lineTaxAmountCents = sign * Math.round((Math.abs(lineNetAmountCents) * taxBasisPoints) / 10000);
    return {
      id: String(component?.id || ""),
      category: normalizeOfferCategory(component?.category),
      quantity: safeQuantity,
      tax_rate_basis_points: taxBasisPoints,
      unit_amount_cents: unitAmountCents,
      line_net_amount_cents: lineNetAmountCents,
      line_tax_amount_cents: lineTaxAmountCents,
      line_total_amount_cents: lineNetAmountCents + lineTaxAmountCents,
      currency: targetCurrency
    };
  }

  const fromDefinition = getCurrencyDefinition(sourceCurrency);
  const baseDefinition = getCurrencyDefinition(BASE_CURRENCY);
  const fromScale = 10 ** fromDefinition.decimal_places;
  const toDefinition = getCurrencyDefinition(targetCurrency);
  const toScale = 10 ** toDefinition.decimal_places;
  const safeQuantity = Math.max(1, safeInt(component?.quantity) || 1);
  const unitAmountCents = Math.max(0, Number(component?.unit_amount_cents || 0));
  const sign = offerCategorySign(component?.category);
  const taxBasisPoints = clampOfferTaxRateBasisPoints(component?.tax_rate_basis_points, DEFAULT_OFFER_TAX_RATE_BASIS_POINTS);
  const sourceToBaseRate = sourceCurrency === BASE_CURRENCY ? 1 : normalizedRates.sourceToBaseRate;
  const baseToTargetRate = targetCurrency === BASE_CURRENCY ? 1 : normalizedRates.baseToTargetRate;

  const unitMajor = unitAmountCents / fromScale;
  const baseScale = 10 ** baseDefinition.decimal_places;
  const unitBaseMajor = unitMajor * sourceToBaseRate;
  const roundedUnitBaseMinor = Math.max(0, Math.round(unitBaseMajor * baseScale));
  const roundedUnitBaseMajor = roundedUnitBaseMinor / baseScale;
  const convertedUnitMajor = roundedUnitBaseMajor * baseToTargetRate;
  const convertedUnitMinor = Math.max(0, Math.round(convertedUnitMajor * toScale));

  const lineNetAmountCents = sign * convertedUnitMinor * safeQuantity;
  const lineTaxAmountCents = sign * Math.round((Math.abs(lineNetAmountCents) * taxBasisPoints) / 10000);
  const line_total_amount_cents = lineNetAmountCents + lineTaxAmountCents;

  return {
    id: String(component?.id || ""),
    category: normalizeOfferCategory(component?.category),
    quantity: safeQuantity,
    tax_rate_basis_points: taxBasisPoints,
    unit_amount_cents: convertedUnitMinor,
    line_net_amount_cents: lineNetAmountCents,
    line_tax_amount_cents: lineTaxAmountCents,
    line_total_amount_cents,
    currency: targetCurrency
  };
}

async function convertMinorUnits(amountCents, fromCurrency, toCurrency) {
  const sourceCurrency = safeCurrency(fromCurrency) || BASE_CURRENCY;
  const targetCurrency = safeCurrency(toCurrency) || BASE_CURRENCY;
  const normalizedAmount = normalizeAmountCents(amountCents, 0);
  if (sourceCurrency === targetCurrency) return normalizedAmount;
  const rate = await fetchExchangeRate(sourceCurrency, targetCurrency);
  return roundConvertedAmount(normalizedAmount, sourceCurrency, targetCurrency, rate);
}

async function resolveExchangeRateWithFallback(fromCurrency, toCurrency) {
  try {
    return {
      rate: await fetchExchangeRate(fromCurrency, toCurrency),
      warning: null
    };
  } catch (error) {
    const fallbackRate = getFallbackExchangeRate(fromCurrency, toCurrency);
    if (Number.isFinite(fallbackRate) && fallbackRate > 0) {
      return {
        rate: fallbackRate,
        warning: `Exchange rate lookup failed for ${fromCurrency}->${toCurrency}. Using configured fallback.`
      };
    }
    throw error;
  }
}

async function convertToBaseCurrency(bookingCurrency, amountCents) {
  return convertMinorUnits(amountCents, bookingCurrency, BASE_CURRENCY);
}

function getOfferCurrencyForStorage(offer) {
  return safeCurrency(offer?.currency || BASE_CURRENCY);
}

function getPricingCurrencyForStorage(pricing) {
  return safeCurrency(pricing?.currency || BASE_CURRENCY);
}

async function convertBookingPricingToBaseCurrency(pricing) {
  const normalized = normalizeBookingPricing(pricing);
  const sourceCurrency = getPricingCurrencyForStorage(normalized);
  if (sourceCurrency === BASE_CURRENCY) {
    return {
      ...normalized,
      currency: BASE_CURRENCY
    };
  }

  const [agreedNetAmount, adjustments, payments] = await Promise.all([
    convertMinorUnits(normalized.agreed_net_amount_cents, sourceCurrency, BASE_CURRENCY),
    Promise.all(
      normalized.adjustments.map((adjustment) =>
        convertMinorUnits(adjustment.amount_cents, sourceCurrency, BASE_CURRENCY)
      )
    ),
    Promise.all(
      normalized.payments.map((payment) => convertMinorUnits(payment.net_amount_cents, sourceCurrency, BASE_CURRENCY))
    )
  ]);

  return {
    ...normalized,
    currency: BASE_CURRENCY,
    agreed_net_amount_cents: agreedNetAmount,
    adjustments: normalized.adjustments.map((adjustment, index) => ({
      ...adjustment,
      amount_cents: adjustments[index]
    })),
    payments: normalized.payments.map((payment, index) => ({
      ...payment,
      net_amount_cents: payments[index]
    }))
  };
}

async function convertBookingOfferToBaseCurrency(offer) {
  const normalized = normalizeBookingOffer(offer, getOfferCurrencyForStorage(offer));
  const sourceCurrency = getOfferCurrencyForStorage(normalized);
  if (sourceCurrency === BASE_CURRENCY) {
    return {
      ...normalized,
      currency: BASE_CURRENCY,
      totals: {
        ...normalized.totals
      },
      total_price_cents: normalized.total_price_cents
    };
  }

  const convertedComponentAmounts = await Promise.all(
    normalized.components.map((component) => convertMinorUnits(component.unit_amount_cents, sourceCurrency, BASE_CURRENCY))
  );

  const converted = {
    ...normalized,
    currency: BASE_CURRENCY,
    components: normalized.components.map((component, index) => ({
      ...component,
      currency: BASE_CURRENCY,
      unit_amount_cents: convertedComponentAmounts[index]
    }))
  };
  const totals = computeBookingOfferTotals(converted);

  return {
    ...converted,
    totals,
    total_price_cents: totals.total_price_cents
  };
}

async function convertPricingForDisplay(pricing, targetCurrency) {
  const normalized = normalizeBookingPricing(pricing);
  const sourceCurrency = getPricingCurrencyForStorage(normalized);
  const displayCurrency = safeCurrency(targetCurrency || sourceCurrency);
  if (sourceCurrency === displayCurrency) {
    return {
      ...normalized,
      currency: displayCurrency,
      totals: normalized.totals || computeBookingOfferTotals(normalized),
      total_price_cents: normalized.total_price_cents ?? (normalized.totals?.total_price_cents || 0)
    };
  }

  const [agreedNetAmount, adjustments, payments] = await Promise.all([
    convertMinorUnits(normalized.agreed_net_amount_cents, sourceCurrency, displayCurrency),
    Promise.all(
      normalized.adjustments.map((adjustment) =>
        convertMinorUnits(adjustment.amount_cents, sourceCurrency, displayCurrency)
      )
    ),
    Promise.all(
      normalized.payments.map((payment) => convertMinorUnits(payment.net_amount_cents, sourceCurrency, displayCurrency))
    )
  ]);

  return {
    ...normalized,
    currency: displayCurrency,
    agreed_net_amount_cents: agreedNetAmount,
    adjustments: normalized.adjustments.map((adjustment, index) => ({
      ...adjustment,
      amount_cents: adjustments[index]
    })),
    payments: normalized.payments.map((payment, index) => ({
      ...payment,
      net_amount_cents: payments[index]
    }))
  };
}

async function convertOfferForDisplay(rawOffer, targetCurrency) {
  const normalized = normalizeBookingOffer(rawOffer, getOfferCurrencyForStorage(rawOffer));
  const sourceCurrency = getOfferCurrencyForStorage(normalized);
  const displayCurrency = safeCurrency(targetCurrency || sourceCurrency);
  if (sourceCurrency === displayCurrency) {
    return {
      ...normalized,
      currency: displayCurrency
    };
  }

  const convertedAmounts = await Promise.all(
    normalized.components.map((component) => convertMinorUnits(component.unit_amount_cents, sourceCurrency, displayCurrency))
  );

  return {
    ...normalized,
    currency: displayCurrency,
    components: normalized.components.map((component, index) => ({
      ...component,
      currency: displayCurrency,
      unit_amount_cents: convertedAmounts[index]
    }))
  };
}

function validateOfferExchangeRequest(payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Request body is required." };
  }

  const fromCurrency = parseCurrencyForExchange(payload.from_currency || payload.fromCurrency);
  const toCurrency = parseCurrencyForExchange(payload.to_currency || payload.toCurrency);
  if (!fromCurrency) return { ok: false, error: "from_currency is required and must be a valid currency." };
  if (!toCurrency) return { ok: false, error: "to_currency is required and must be a valid currency." };

  const inputComponents = Array.isArray(payload.components) ? payload.components : [];
  const components = [];

  for (let index = 0; index < inputComponents.length; index++) {
    const row = inputComponents[index];
    const rawAmount = normalizeAmountCents(row?.unit_amount_cents, 0);
    if (!Number.isFinite(rawAmount) || rawAmount < 0) {
      return { ok: false, error: `Component ${index + 1} has an invalid unit_amount_cents.` };
    }
    const category = normalizeOfferCategory(row?.category);
    const taxRateBasisPoints = clampOfferTaxRateBasisPoints(
      row?.tax_rate_basis_points,
      DEFAULT_OFFER_TAX_RATE_BASIS_POINTS
    );
    const quantity = Math.max(1, safeInt(row?.quantity) || 1);
    components.push({
      id: normalizeText(row?.id) || `component_${index}`,
      unit_amount_cents: rawAmount,
      category,
      tax_rate_basis_points: taxRateBasisPoints,
      quantity
    });
  }

  return { ok: true, fromCurrency, toCurrency, components };
}

function formatMoney(amountCents, currency) {
  const definition = getCurrencyDefinition(currency);
  const amount = Number(amountCents || 0) / 10 ** definition.decimal_places;
  return `${definition.symbol} ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: definition.decimal_places,
    maximumFractionDigits: definition.decimal_places,
    useGrouping: true
  }).format(amount)}`;
}

function normalizeInvoiceComponents(value) {
  const input = Array.isArray(value) ? value : [];
  return input
    .map((component) => {
      const description = normalizeText(component?.description);
      const quantity = Math.max(1, safeInt(component?.quantity) || 1);
      const unitAmountCents = safeAmountCents(component?.unit_amount_cents);
      if (!description || !unitAmountCents) return null;
      return {
        id: normalizeText(component?.id) || `inv_component_${randomUUID()}`,
        description,
        quantity,
        unit_amount_cents: unitAmountCents,
        total_amount_cents: unitAmountCents * quantity
      };
    })
    .filter(Boolean);
}

function computeInvoiceComponentTotal(components) {
  return (Array.isArray(components) ? components : []).reduce(
    (sum, component) => sum + (safeAmountCents(component?.total_amount_cents) || 0),
    0
  );
}

function safeVatPercentage(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function nextInvoiceNumber(store) {
  const max = (store.invoices || []).reduce((acc, invoice) => {
    const match = String(invoice.invoice_number || "").match(/^ATP-(\d+)$/);
    if (!match) return acc;
    const n = Number(match[1]);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `ATP-${String(max + 1).padStart(6, "0")}`;
}

function invoicePdfPath(invoiceId, version) {
  return path.join(INVOICES_DIR, `${invoiceId}-v${version}.pdf`);
}

let cachedLogoImagePromise = null;

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePngRgba(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) {
    throw new Error("Unsupported PNG signature");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.subarray(offset, offset + 4).toString("ascii");
    offset += 4;
    const data = buffer.subarray(offset, offset + length);
    offset += length;
    offset += 4;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error("Only 8-bit RGBA PNG logos are supported");
  }

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const rgba = Buffer.alloc(width * height * bytesPerPixel);
  let inOffset = 0;
  let outOffset = 0;
  let previousRow = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inOffset];
    inOffset += 1;
    const row = Buffer.from(inflated.subarray(inOffset, inOffset + stride));
    inOffset += stride;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previousRow[x] || 0;
      const upLeft = x >= bytesPerPixel ? previousRow[x - bytesPerPixel] || 0 : 0;

      if (filter === 1) row[x] = (row[x] + left) & 0xff;
      else if (filter === 2) row[x] = (row[x] + up) & 0xff;
      else if (filter === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) row[x] = (row[x] + paethPredictor(left, up, upLeft)) & 0xff;
    }

    row.copy(rgba, outOffset);
    outOffset += stride;
    previousRow = row;
  }

  return { width, height, rgba };
}

async function getLogoPdfImageData() {
  if (!cachedLogoImagePromise) {
    cachedLogoImagePromise = readFile(LOGO_PNG_PATH).then((buffer) => {
      const { width, height, rgba } = decodePngRgba(buffer);
      const rgb = Buffer.alloc(width * height * 3);
      const alpha = Buffer.alloc(width * height);
      for (let src = 0, rgbOffset = 0, alphaOffset = 0; src < rgba.length; src += 4) {
        rgb[rgbOffset] = rgba[src];
        rgb[rgbOffset + 1] = rgba[src + 1];
        rgb[rgbOffset + 2] = rgba[src + 2];
        alpha[alphaOffset] = rgba[src + 3];
        rgbOffset += 3;
        alphaOffset += 1;
      }
      return {
        width,
        height,
        rgb: deflateSync(rgb),
        alpha: deflateSync(alpha)
      };
    });
  }

  return cachedLogoImagePromise;
}

function wrapPdfText(value, maxCharsPerLine, maxLines) {
  const words = String(value || "-").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ["-"];
  const lines = [];
  let current = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (next.length <= maxCharsPerLine) {
      current = next;
      continue;
    }
    lines.push(current);
    current = words[i];
    if (lines.length >= maxLines - 1) break;
  }

  if (lines.length < maxLines) lines.push(current);
  if (lines.length > maxLines) return lines.slice(0, maxLines);
  if (lines.length === maxLines && words.length > 1) {
    const used = lines.join(" ").split(/\s+/).length;
    if (used < words.length) {
      const last = lines[maxLines - 1];
      lines[maxLines - 1] = `${last.slice(0, Math.max(0, maxCharsPerLine - 1)).trim()}...`;
    }
  }
  return lines;
}

function buildPdfBuffer(objects) {
  const chunks = [Buffer.from("%PDF-1.4\n", "utf8")];
  const offsets = [0];
  let offset = chunks[0].length;

  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(offset);
    const header = Buffer.from(`${i + 1} 0 obj\n`, "utf8");
    const footer = Buffer.from("\nendobj\n", "utf8");
    const body = Buffer.isBuffer(objects[i]) ? objects[i] : Buffer.from(objects[i], "utf8");
    chunks.push(header, body, footer);
    offset += header.length + body.length + footer.length;
  }

  const xrefStart = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "utf8"));
  return Buffer.concat(chunks);
}

function escapePdfText(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function abbreviateBookingId(value) {
  const text = normalizeText(value);
  if (!text) return "-";
  if (text.length <= 13) return text;
  return `${text.slice(0, 13)}...`;
}

function buildInvoicePdfBuffer(invoice, customer, booking, logoImage) {
  const currency = safeCurrency(invoice.currency);
  const components = Array.isArray(invoice.components) ? invoice.components : [];
  const subtotalCents = safeAmountCents(invoice.subtotal_amount_cents) ?? computeInvoiceComponentTotal(components);
  const vatPercentage = safeVatPercentage(invoice.vat_percentage);
  const vatAmountCents = safeAmountCents(invoice.vat_amount_cents) ?? Math.round(subtotalCents * (vatPercentage / 100));
  const totalCents = safeAmountCents(invoice.total_amount_cents) ?? subtotalCents + vatAmountCents;
  const totalMoney = formatMoney(totalCents, currency);
  const dueMoney = formatMoney(invoice.due_amount_cents || invoice.total_amount_cents, currency);

  const line = (x1, y1, x2, y2) => `${x1} ${y1} m ${x2} ${y2} l S`;
  const rectFill = (x, y, w, h) => `${x} ${y} ${w} ${h} re f`;
  const rectStroke = (x, y, w, h) => `${x} ${y} ${w} ${h} re S`;
  const textAt = (x, y, size, value) => `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(value)}) Tj ET`;
  const imageAt = (x, y, w, h) => `q ${w} 0 0 ${h} ${x} ${y} cm /ImLogo Do Q`;

  const ops = [];

  // Header.
  ops.push("1 1 1 rg");
  ops.push(rectFill(0, 724, 595, 118));
  ops.push("0.12 0.18 0.22 rg");
  ops.push(imageAt(40, 742, 58, 58));
  ops.push(textAt(112, 786, 18, COMPANY_PROFILE.name));
  ops.push("0.35 0.42 0.47 rg");
  ops.push(textAt(112, 770, 9, "Southeast Asia Travel"));
  ops.push("0.12 0.18 0.22 rg");
  ops.push(textAt(472, 786, 12, "INVOICE"));
  ops.push("0.35 0.42 0.47 rg");
  ops.push(textAt(414, 769, 9, `Invoice Number: ${invoice.invoice_number || "-"}`));
  ops.push(textAt(434, 754, 9, `Issue Date: ${invoice.issue_date || "-"}`));
  ops.push(textAt(435, 739, 9, `Due Date: ${invoice.due_date || "-"}`));
  ops.push("0.88 0.90 0.92 rg");
  ops.push(line(40, 730, 555, 730));

  // Contact / bill-to cards.
  ops.push("0.97 0.98 0.99 rg");
  ops.push(rectFill(40, 640, 250, 72));
  ops.push(rectFill(305, 640, 250, 72));
  ops.push("0.82 0.85 0.88 RG");
  ops.push("1 w");
  ops.push(rectStroke(40, 640, 250, 72));
  ops.push(rectStroke(305, 640, 250, 72));
  ops.push("0.35 0.42 0.47 rg");
  ops.push(textAt(52, 691, 10, "From"));
  ops.push(textAt(317, 691, 10, "Bill To"));
  ops.push("0.12 0.18 0.22 rg");
  ops.push(textAt(52, 674, 11, COMPANY_PROFILE.name));
  ops.push(textAt(52, 658, 9, COMPANY_PROFILE.address));
  ops.push(textAt(52, 644, 9, `${COMPANY_PROFILE.email} | ${COMPANY_PROFILE.whatsapp}`));
  ops.push(textAt(317, 674, 11, normalizeText(customer?.name) || "-"));
  ops.push(textAt(317, 658, 9, normalizeEmail(customer?.email) || "-"));

  // Components table header.
  const tableTop = 596;
  ops.push("0.82 0.85 0.88 RG");
  ops.push(rectStroke(40, tableTop, 515, 26));
  ops.push("0.93 0.95 0.96 rg");
  ops.push(rectFill(40, tableTop, 515, 26));
  ops.push("0.12 0.18 0.22 rg");
  ops.push(textAt(48, tableTop + 10, 9, "Description"));
  ops.push(textAt(352, tableTop + 10, 9, "Qty"));
  ops.push(textAt(410, tableTop + 10, 9, "Unit"));
  ops.push(textAt(485, tableTop + 10, 9, "Total"));

  // Component rows.
  let rowY = tableTop - 24;
  const rowHeight = 24;
  const maxRows = 16;
  for (let i = 0; i < Math.min(components.length, maxRows); i += 1) {
    const component = components[i];
    ops.push("0.86 0.88 0.90 RG");
    ops.push(rectStroke(40, rowY, 515, rowHeight));
    ops.push("0.12 0.18 0.22 rg");
    const descLines = wrapPdfText(normalizeText(component.description) || "-", 42, 2);
    ops.push(textAt(48, rowY + 11, 9, descLines[0] || "-"));
    if (descLines[1]) ops.push(textAt(48, rowY + 2, 9, descLines[1]));
    ops.push(textAt(356, rowY + 7, 9, String(component.quantity || 1)));
    ops.push(textAt(408, rowY + 7, 9, formatMoney(component.unit_amount_cents, currency)));
    ops.push(textAt(476, rowY + 7, 9, formatMoney(component.total_amount_cents, currency)));
    rowY -= rowHeight;
  }

  // Notes and totals blocks.
  const sectionTop = Math.max(160, rowY - 18);
  const notesY = sectionTop - 74;
  const totalsY = sectionTop - 96;
  const notesLines = wrapPdfText(normalizeText(invoice.notes) || "-", 44, 3);

  ops.push("1 1 1 rg");
  ops.push(rectFill(40, notesY, 285, 74));
  ops.push("0.82 0.85 0.88 RG");
  ops.push(rectStroke(40, notesY, 285, 74));
  ops.push("0.35 0.42 0.47 rg");
  ops.push(textAt(52, notesY + 54, 10, "Notes"));
  ops.push("0.12 0.18 0.22 rg");
  notesLines.forEach((lineText, index) => {
    ops.push(textAt(52, notesY + 36 - index * 14, 9, lineText));
  });

  ops.push("0.97 0.98 0.99 rg");
  ops.push(rectFill(345, totalsY, 210, 96));
  ops.push("0.82 0.85 0.88 RG");
  ops.push(rectStroke(345, totalsY, 210, 96));
  ops.push("0.12 0.18 0.22 rg");
  ops.push(textAt(357, totalsY + 72, 10, `Subtotal: ${formatMoney(subtotalCents, currency)}`));
  ops.push(textAt(357, totalsY + 56, 10, `VAT (${vatPercentage.toFixed(2)}%): ${formatMoney(vatAmountCents, currency)}`));
  ops.push(textAt(357, totalsY + 40, 11, `Total: ${totalMoney}`));
  ops.push(textAt(357, totalsY + 24, 10, `Due now: ${dueMoney}`));
  ops.push("0.35 0.42 0.47 rg");
  ops.push(textAt(357, totalsY + 10, 9, `Currency: ${currency}`));

  ops.push("0.62 0.67 0.72 RG");
  ops.push(textAt(40, 42, 8, `Generated ${new Date().toISOString()} | ${COMPANY_PROFILE.website}`));
  ops.push(line(40, 52, 555, 52));

  const content = Buffer.from(ops.join("\n"), "utf8");
  const rgbStream = Buffer.concat([
    Buffer.from(
      `<< /Type /XObject /Subtype /Image /Width ${logoImage.width} /Height ${logoImage.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask 6 0 R /Length ${logoImage.rgb.length} >>\nstream\n`,
      "utf8"
    ),
    logoImage.rgb,
    Buffer.from("\nendstream", "utf8")
  ]);
  const alphaStream = Buffer.concat([
    Buffer.from(
      `<< /Type /XObject /Subtype /Image /Width ${logoImage.width} /Height ${logoImage.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${logoImage.alpha.length} >>\nstream\n`,
      "utf8"
    ),
    logoImage.alpha,
    Buffer.from("\nendstream", "utf8")
  ]);
  const contentStream = Buffer.from(`<< /Length ${content.length} >>\nstream\n${content.toString("utf8")}\nendstream`, "utf8");

  return buildPdfBuffer([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> /XObject << /ImLogo 5 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    rgbStream,
    alphaStream,
    contentStream
  ]);
}

async function writeInvoicePdf(invoice, customer, booking) {
  await mkdir(INVOICES_DIR, { recursive: true });
  const logoImage = await getLogoPdfImageData();
  const pdf = buildInvoicePdfBuffer(invoice, customer, booking, logoImage);
  await writeFile(invoicePdfPath(invoice.id, invoice.version), pdf);
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

function chooseOwner(staffList, bookings, destination, language) {
  const activeAtpStaff = staffList.filter((s) => s.active);
  const normalizedDestinations = normalizeStringArray(destination);
  const normalizedLanguage = normalizeText(language);

  let candidates = activeAtpStaff.filter((atp_staff) => {
    const destinationMatch = normalizedDestinations.length
      ? normalizedDestinations.some((destination) => atp_staff.destinations?.includes(destination))
      : false;
    const languageMatch = !normalizedLanguage || atp_staff.languages?.includes(normalizedLanguage);
    return destinationMatch && languageMatch;
  });

  if (!candidates.length) {
    candidates = activeAtpStaff.filter((atp_staff) => {
      const destinationMatch = normalizedDestinations.length
        ? normalizedDestinations.some((destination) => atp_staff.destinations?.includes(destination))
        : false;
      return destinationMatch;
    });
  }

  if (!candidates.length) candidates = activeAtpStaff;
  if (!candidates.length) return null;

  const openStages = new Set([STAGES.NEW, STAGES.QUALIFIED, STAGES.PROPOSAL_SENT, STAGES.NEGOTIATION, STAGES.WON]);

  const byLoad = candidates
    .map((atp_staff) => {
      const load = bookings.filter((booking) => booking.owner_id === atp_staff.id && openStages.has(booking.stage)).length;
      return { atp_staff, load };
    })
    .sort((a, b) => a.load - b.load || a.atp_staff.name.localeCompare(b.atp_staff.name));

  return byLoad[0].atp_staff;
}

function validateBookingInput(payload) {
  const required = ["name", "email", "duration"];
  const missing = required.filter((key) => !normalizeText(payload[key]));
  if (!normalizeStringArray(payload.destination).length) missing.push("destination");
  if (!normalizeStringArray(payload.style).length) missing.push("style");
  if (missing.length) {
    return { ok: false, error: `Missing required fields: ${missing.join(", ")}` };
  }

  const email = normalizeEmail(payload.email);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) return { ok: false, error: "Invalid email" };

  const travelers = safeOptionalInt(payload.travelers);
  if (travelers !== null && travelers !== undefined && (travelers < 1 || travelers > 30)) {
    return { ok: false, error: "Travelers must be between 1 and 30" };
  }

  return { ok: true };
}

function addActivity(store, bookingId, type, actor, detail) {
  const activity = {
    id: `act_${randomUUID()}`,
    booking_id: bookingId,
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

function getPrincipal(req) {
  return req.authz?.principal || null;
}

function getPrincipalRoles(principal) {
  return Array.isArray(principal?.roles) ? principal.roles.filter(Boolean) : [];
}

function hasRole(principal, role) {
  return getPrincipalRoles(principal).includes(role);
}

function canReadAllBookings(principal) {
  return hasRole(principal, APP_ROLES.ADMIN) || hasRole(principal, APP_ROLES.MANAGER) || hasRole(principal, APP_ROLES.ACCOUNTANT);
}

function canWriteAllBookings(principal) {
  return canReadAllBookings(principal);
}

function canChangeBookingAssignment(principal) {
  return canReadAllBookings(principal);
}

function canReadTours(principal) {
  return hasRole(principal, APP_ROLES.ADMIN) || hasRole(principal, APP_ROLES.ACCOUNTANT);
}

function canChangeBookingStage(principal, booking, staffMember) {
  if (hasRole(principal, APP_ROLES.ADMIN) || hasRole(principal, APP_ROLES.MANAGER) || hasRole(principal, APP_ROLES.ACCOUNTANT)) {
    return true;
  }
  if (hasRole(principal, APP_ROLES.ATP_STAFF) && staffMember) {
    return getBookingAtpStaffId(booking) === staffMember.id;
  }
  return false;
}

function canEditTours(principal) {
  return hasRole(principal, APP_ROLES.ADMIN);
}

function canReadCustomers(principal) {
  return canReadAllBookings(principal);
}

function canViewAtpStaffDirectory(principal) {
  return canChangeBookingAssignment(principal);
}

function canManageAtpStaff(principal) {
  return hasRole(principal, APP_ROLES.ADMIN) || hasRole(principal, APP_ROLES.MANAGER);
}

function actorLabel(principal, fallback = "system") {
  return normalizeText(principal?.preferred_username || principal?.email || principal?.sub || fallback) || fallback;
}

function normalizeCompareText(value) {
  return normalizeText(value).toLowerCase();
}

function staffUsernames(member) {
  const explicit = []
    .concat(Array.isArray(member?.usernames) ? member.usernames : [])
    .concat(Array.isArray(member?.keycloak_usernames) ? member.keycloak_usernames : []);
  return Array.from(new Set(explicit.map(normalizeCompareText).filter(Boolean)));
}

function staffEmails(member) {
  const explicit = []
    .concat(Array.isArray(member?.emails) ? member.emails : [])
    .concat(Array.isArray(member?.keycloak_emails) ? member.keycloak_emails : []);
  return Array.from(new Set(explicit.map(normalizeCompareText).filter(Boolean)));
}

function resolvePrincipalAtpStaffMember(principal, staffList) {
  if (!hasRole(principal, APP_ROLES.ATP_STAFF)) return null;
  const username = normalizeCompareText(principal?.preferred_username);
  const email = normalizeCompareText(principal?.email);
  const sub = normalizeCompareText(principal?.sub);

  return (
    staffList.find((member) => {
      const usernames = staffUsernames(member);
      const emails = staffEmails(member);
      return (
        (username && usernames.includes(username)) ||
        (email && emails.includes(email)) ||
        (sub && usernames.includes(sub))
      );
    }) || null
  );
}

function getBookingAtpStaffId(booking) {
  return normalizeText(booking?.atp_staff || booking?.owner_id);
}

function syncBookingAtpStaffFields(booking) {
  const staffId = normalizeText(booking.atp_staff || booking.owner_id);
  const staffName = normalizeText(booking.atp_staff_name || booking.owner_name);
  booking.atp_staff = staffId || null;
  booking.atp_staff_name = staffName || null;
  booking.owner_id = staffId || null;
  booking.owner_name = staffName || null;
  return booking;
}

function defaultBookingPricing() {
  return {
    currency: BASE_CURRENCY,
    agreed_net_amount_cents: 0,
    adjustments: [],
    payments: []
  };
}

function defaultBookingOffer(preferredCurrency = BASE_CURRENCY) {
  const currency = safeCurrency(preferredCurrency);
  return {
    currency,
    category_rules: OFFER_CATEGORY_ORDER.map((category) => ({
      category,
      tax_rate_basis_points: DEFAULT_OFFER_TAX_RATE_BASIS_POINTS
    })),
    components: [],
    totals: {
      net_amount_cents: 0,
      tax_amount_cents: 0,
      gross_amount_cents: 0,
      components_count: 0
    },
    total_price_cents: 0
  };
}

function normalizeAmountCents(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(numeric);
}

function normalizeBasisPoints(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(numeric);
}

function normalizePricingAdjustmentType(value) {
  const normalized = normalizeText(value).toUpperCase();
  return PRICING_ADJUSTMENT_TYPES[normalized] || PRICING_ADJUSTMENT_TYPES.DISCOUNT;
}

function normalizePaymentStatus(value) {
  const normalized = normalizeText(value).toUpperCase();
  return PAYMENT_STATUSES[normalized] || PAYMENT_STATUSES.PENDING;
}

function normalizeOfferCategory(value) {
  const normalized = normalizeText(value).toUpperCase();
  return OFFER_CATEGORIES[normalized] || OFFER_CATEGORIES.OTHER;
}

function offerCategorySign(category) {
  return normalizeOfferCategory(category) === OFFER_CATEGORIES.DISCOUNTS_CREDITS ? -1 : 1;
}

function clampOfferTaxRateBasisPoints(value, fallback = DEFAULT_OFFER_TAX_RATE_BASIS_POINTS) {
  const basisPoints = normalizeBasisPoints(value, fallback);
  return clamp(basisPoints, 0, 100000);
}

function buildOfferCategoryRuleMap(rules) {
  const map = new Map(
    OFFER_CATEGORY_ORDER.map((category) => [
      category,
      {
        category,
        tax_rate_basis_points: DEFAULT_OFFER_TAX_RATE_BASIS_POINTS
      }
    ])
  );
  for (const rule of rules) {
    const category = normalizeOfferCategory(rule?.category);
    map.set(category, {
      category,
      tax_rate_basis_points: clampOfferTaxRateBasisPoints(rule?.tax_rate_basis_points)
    });
  }
  return map;
}

function computeBookingOfferTotals(offer) {
  let net_amount_cents = 0;
  let tax_amount_cents = 0;
  let components_count = 0;

  for (const component of offer.components || []) {
    const sign = offerCategorySign(component.category);
    const lineNet = Math.max(0, normalizeAmountCents(component.unit_amount_cents, 0)) * Math.max(1, safeInt(component.quantity) || 1);
    const lineTax = roundTaxAmount(
      lineNet,
      clampOfferTaxRateBasisPoints(component.tax_rate_basis_points, DEFAULT_OFFER_TAX_RATE_BASIS_POINTS)
    );
    net_amount_cents += sign * lineNet;
    tax_amount_cents += sign * lineTax;
    components_count += 1;
  }

  return {
    net_amount_cents,
    tax_amount_cents,
    gross_amount_cents: net_amount_cents + tax_amount_cents,
    total_price_cents: net_amount_cents + tax_amount_cents,
    components_count
  };
}

function normalizeBookingOffer(rawOffer, preferredCurrency = BASE_CURRENCY) {
  const fallback = defaultBookingOffer(preferredCurrency);
  const offer = rawOffer && typeof rawOffer === "object" ? rawOffer : {};
  const currency = safeCurrency(offer.currency || preferredCurrency || fallback.currency);
  const rulesInput = Array.isArray(offer.category_rules) ? offer.category_rules : [];
  const ruleMap = buildOfferCategoryRuleMap(rulesInput);
  const category_rules = OFFER_CATEGORY_ORDER.map((category) => ruleMap.get(category));
  const sourceComponents = Array.isArray(offer.components)
    ? offer.components
    : [];
  const components = sourceComponents.map((component, index) => {
    const category = normalizeOfferCategory(component?.category);
        const categoryRule = ruleMap.get(category);
        return {
          id: normalizeText(component?.id) || `offer_component_${randomUUID()}`,
          category,
          label: normalizeText(component?.label) || "Offer component",
          details: normalizeText(component?.details || component?.description),
          quantity: Math.max(1, safeInt(component?.quantity) || 1),
          unit_amount_cents: Math.max(0, normalizeAmountCents(component?.unit_amount_cents, 0)),
          tax_rate_basis_points: clampOfferTaxRateBasisPoints(
            component?.tax_rate_basis_points,
            categoryRule?.tax_rate_basis_points ?? DEFAULT_OFFER_TAX_RATE_BASIS_POINTS
          ),
          currency,
          notes: normalizeText(component?.notes),
          sort_order: Number.isFinite(safeInt(component?.sort_order))
            ? safeInt(component?.sort_order)
            : Number.isFinite(safeInt(component?.sortOrder))
              ? safeInt(component?.sortOrder)
              : index,
          created_at: normalizeText(component?.created_at) || null,
          updated_at: normalizeText(component?.updated_at) || null
        };
      });

  const normalized = {
    currency,
    category_rules,
    components
  };
  const totals = computeBookingOfferTotals(normalized);
  return {
    ...normalized,
    totals,
    total_price_cents: totals.total_price_cents
  };
}

async function buildBookingOfferReadModel(rawOffer, preferredCurrency = BASE_CURRENCY) {
  const offer = await convertOfferForDisplay(rawOffer, preferredCurrency);
  const totals = computeBookingOfferTotals(offer);
  return {
    ...offer,
    components: offer.components.map((component) => {
      const sign = offerCategorySign(component.category);
      const line_net_amount_cents = sign * component.unit_amount_cents * component.quantity;
      const line_tax_amount_cents = sign * roundTaxAmount(
        component.unit_amount_cents * component.quantity,
        component.tax_rate_basis_points
      );
      const line_total_amount_cents = line_net_amount_cents + line_tax_amount_cents;
      return {
        ...component,
        line_net_amount_cents,
        line_tax_amount_cents,
        line_total_amount_cents,
        line_gross_amount_cents: line_total_amount_cents
      };
    }),
    totals,
    total_price_cents: totals.total_price_cents
  };
}

function validateBookingOfferInput(rawOffer, booking) {
  if (!rawOffer || typeof rawOffer !== "object" || Array.isArray(rawOffer)) {
    return { ok: false, error: "offer must be an object" };
  }

  const preferredCurrency = safeCurrency(
    booking?.preferred_currency ||
      booking?.offer?.currency ||
      booking?.pricing?.currency ||
      rawOffer?.currency ||
      BASE_CURRENCY
  );
  const offer = normalizeBookingOffer(rawOffer, preferredCurrency);

  for (const component of offer.components) {
    if (!component.label) return { ok: false, error: "Each offer component requires a label" };
    if (component.quantity < 1) return { ok: false, error: "Offer component quantity must be at least 1" };
    if (component.unit_amount_cents < 0) return { ok: false, error: "Offer component amounts must be zero or positive" };
    if (component.tax_rate_basis_points < 0 || component.tax_rate_basis_points > 100000) {
      return { ok: false, error: "Offer component tax_rate_basis_points must be between 0 and 100000" };
    }
  }

  return { ok: true, offer };
}

function adjustmentSign(type) {
  return type === PRICING_ADJUSTMENT_TYPES.SURCHARGE ? 1 : -1;
}

function roundTaxAmount(netAmountCents, basisPoints) {
  return Math.round((Number(netAmountCents || 0) * Number(basisPoints || 0)) / 10000);
}

function normalizeBookingPricing(rawPricing) {
  const pricing = rawPricing && typeof rawPricing === "object" ? rawPricing : {};
  const adjustments = Array.isArray(pricing.adjustments) ? pricing.adjustments : [];
  const payments = Array.isArray(pricing.payments) ? pricing.payments : [];

  return {
    currency: safeCurrency(pricing.currency || BASE_CURRENCY),
    agreed_net_amount_cents: normalizeAmountCents(pricing.agreed_net_amount_cents, 0),
    adjustments: adjustments.map((adjustment) => ({
      id: normalizeText(adjustment?.id) || `adj_${randomUUID()}`,
      type: normalizePricingAdjustmentType(adjustment?.type),
      label: normalizeText(adjustment?.label) || "Adjustment",
      amount_cents: Math.max(0, normalizeAmountCents(adjustment?.amount_cents, 0)),
      notes: normalizeText(adjustment?.notes)
    })),
    payments: payments.map((payment) => ({
      id: normalizeText(payment?.id) || `pay_${randomUUID()}`,
      label: normalizeText(payment?.label) || "Installment",
      due_date: normalizeText(payment?.due_date),
      net_amount_cents: Math.max(0, normalizeAmountCents(payment?.net_amount_cents, 0)),
      tax_rate_basis_points: Math.max(0, normalizeBasisPoints(payment?.tax_rate_basis_points, 0)),
      status: normalizePaymentStatus(payment?.status),
      paid_at: normalizeText(payment?.paid_at),
      notes: normalizeText(payment?.notes)
    }))
  };
}

function computeBookingPricingSummary(pricing) {
  const normalized = normalizeBookingPricing(pricing);
  const adjustments_delta_cents = normalized.adjustments.reduce(
    (sum, adjustment) => sum + adjustmentSign(adjustment.type) * adjustment.amount_cents,
    0
  );
  const adjusted_net_amount_cents = normalized.agreed_net_amount_cents + adjustments_delta_cents;
  const scheduled_net_amount_cents = normalized.payments.reduce((sum, payment) => sum + payment.net_amount_cents, 0);
  const unscheduled_net_amount_cents = Math.max(0, adjusted_net_amount_cents - scheduled_net_amount_cents);
  const scheduled_tax_amount_cents = normalized.payments.reduce(
    (sum, payment) => sum + roundTaxAmount(payment.net_amount_cents, payment.tax_rate_basis_points),
    0
  );
  const scheduled_gross_amount_cents = scheduled_net_amount_cents + scheduled_tax_amount_cents;
  const paid_gross_amount_cents = normalized.payments.reduce((sum, payment) => {
    if (payment.status !== PAYMENT_STATUSES.PAID) return sum;
    return sum + payment.net_amount_cents + roundTaxAmount(payment.net_amount_cents, payment.tax_rate_basis_points);
  }, 0);

  return {
    agreed_net_amount_cents: normalized.agreed_net_amount_cents,
    adjustments_delta_cents,
    adjusted_net_amount_cents,
    scheduled_net_amount_cents,
    unscheduled_net_amount_cents,
    scheduled_tax_amount_cents,
    scheduled_gross_amount_cents,
    paid_gross_amount_cents,
    outstanding_gross_amount_cents: Math.max(0, scheduled_gross_amount_cents - paid_gross_amount_cents),
    is_schedule_balanced:
      normalized.payments.length === 0 ? true : scheduled_net_amount_cents === adjusted_net_amount_cents
  };
}

async function buildBookingPricingReadModel(pricing, targetCurrency = BASE_CURRENCY) {
  const normalized = normalizeBookingPricing(pricing);
  const converted = await convertPricingForDisplay(normalized, targetCurrency);
  return {
    ...converted,
    payments: converted.payments.map((payment) => {
      const tax_amount_cents = roundTaxAmount(payment.net_amount_cents, payment.tax_rate_basis_points);
      return {
        ...payment,
        tax_amount_cents,
        gross_amount_cents: payment.net_amount_cents + tax_amount_cents
      };
    }),
    summary: computeBookingPricingSummary(converted)
  };
}

function validateBookingPricingInput(rawPricing) {
  if (!rawPricing || typeof rawPricing !== "object" || Array.isArray(rawPricing)) {
    return { ok: false, error: "pricing must be an object" };
  }

  const pricing = normalizeBookingPricing(rawPricing);
  if (!pricing.currency) return { ok: false, error: "pricing.currency is required" };
  if (pricing.agreed_net_amount_cents < 0) {
    return { ok: false, error: "pricing.agreed_net_amount_cents must be zero or positive" };
  }

  for (const adjustment of pricing.adjustments) {
    if (!Object.values(PRICING_ADJUSTMENT_TYPES).includes(adjustment.type)) {
      return { ok: false, error: `Invalid pricing adjustment type: ${adjustment.type}` };
    }
    if (!adjustment.label) return { ok: false, error: "Each pricing adjustment requires a label" };
    if (adjustment.amount_cents < 0) return { ok: false, error: "Adjustment amounts must be zero or positive" };
  }

  const summary = computeBookingPricingSummary(pricing);
  if (summary.adjusted_net_amount_cents < 0) {
    return { ok: false, error: "Pricing adjustments cannot reduce the agreed amount below zero" };
  }

  for (const payment of pricing.payments) {
    if (!payment.label) return { ok: false, error: "Each payment requires a label" };
    if (!Object.values(PAYMENT_STATUSES).includes(payment.status)) {
      return { ok: false, error: `Invalid payment status: ${payment.status}` };
    }
    if (payment.net_amount_cents < 0) return { ok: false, error: "Payment amounts must be zero or positive" };
    if (payment.tax_rate_basis_points < 0 || payment.tax_rate_basis_points > 100000) {
      return { ok: false, error: "tax_rate_basis_points must be between 0 and 100000" };
    }
    if (payment.status === PAYMENT_STATUSES.PAID && !payment.paid_at) {
      payment.paid_at = nowIso();
    }
    if (payment.status !== PAYMENT_STATUSES.PAID) {
      payment.paid_at = null;
    }
  }

  if (pricing.payments.length > 0 && summary.scheduled_net_amount_cents > summary.adjusted_net_amount_cents) {
    return {
      ok: false,
      error: `Scheduled payment net total (${summary.scheduled_net_amount_cents}) cannot exceed adjusted net total (${summary.adjusted_net_amount_cents})`
    };
  }

  return { ok: true, pricing };
}

function canAccessBooking(principal, booking, staffMember) {
  if (canReadAllBookings(principal)) return true;
  if (hasRole(principal, APP_ROLES.ATP_STAFF) && staffMember) {
    return getBookingAtpStaffId(booking) === staffMember.id;
  }
  return false;
}

function canEditBooking(principal, booking, staffMember) {
  if (canWriteAllBookings(principal)) return true;
  if (hasRole(principal, APP_ROLES.ATP_STAFF) && staffMember) {
    return getBookingAtpStaffId(booking) === staffMember.id;
  }
  return false;
}

function getClientLookup(store) {
  return new Map((store.clients || []).map((client) => [client.id, client]));
}

function getCustomerLookup(store) {
  return new Map((store.customers || []).map((customer) => [customer.client_id, customer]));
}

function getTravelGroupLookupByClient(store) {
  return new Map((store.travel_groups || []).map((group) => [group.client_id, group]));
}

function computeClientHash(client) {
  const payload = {
    id: client?.id || null,
    client_type: client?.client_type || null
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function computeCustomerHash(customer) {
  const payload = {
    client_id: customer?.client_id || null,
    name: customer?.name || null,
    photo_ref: customer?.photo_ref || null,
    title: customer?.title || null,
    first_name: customer?.first_name || null,
    last_name: customer?.last_name || null,
    date_of_birth: customer?.date_of_birth || null,
    nationality: customer?.nationality || null,
    address_line_1: customer?.address_line_1 || null,
    address_line_2: customer?.address_line_2 || null,
    address_city: customer?.address_city || null,
    address_state_region: customer?.address_state_region || null,
    address_postal_code: customer?.address_postal_code || null,
    address_country_code: customer?.address_country_code || null,
    organization_name: customer?.organization_name || null,
    organization_address: customer?.organization_address || null,
    organization_phone_number: customer?.organization_phone_number || null,
    organization_webpage: customer?.organization_webpage || null,
    organization_email: customer?.organization_email || null,
    tax_id: customer?.tax_id || null,
    phone_number: customer?.phone_number || null,
    email: customer?.email || null,
    preferred_language: customer?.preferred_language || null,
    preferred_currency: customer?.preferred_currency || null,
    timezone: customer?.timezone || null,
    notes: customer?.notes || null,
    created_at: customer?.created_at || null,
    updated_at: customer?.updated_at || null,
    archived_at: customer?.archived_at || null
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function computeTravelGroupHash(group, members = []) {
  const normalizedMembers = Array.isArray(members)
    ? [...members]
        .map((member) => ({
          id: member?.id || null,
          travel_group_id: member?.travel_group_id || null,
          customer_client_id: member?.customer_client_id || null,
          is_traveling: member?.is_traveling ?? null,
          member_roles: Array.isArray(member?.member_roles) ? [...member.member_roles].sort() : [],
          notes: member?.notes || null,
          created_at: member?.created_at || null,
          updated_at: member?.updated_at || null
        }))
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
    : [];
  const payload = {
    id: group?.id || null,
    client_id: group?.client_id || null,
    group_name: group?.group_name || null,
    preferred_language: group?.preferred_language || null,
    preferred_currency: group?.preferred_currency || null,
    timezone: group?.timezone || null,
    notes: group?.notes || null,
    created_at: group?.created_at || null,
    updated_at: group?.updated_at || null,
    archived_at: group?.archived_at || null,
    members: normalizedMembers
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function computeBookingHash(booking) {
  const payload = {
    id: booking.id || null,
    client_id: booking.client_id || null,
    client_type: booking.client_type || null,
    client_display_name: booking.client_display_name || null,
    client_primary_phone_number: booking.client_primary_phone_number || null,
    client_primary_email: booking.client_primary_email || null,
    stage: booking.stage || null,
    atp_staff: booking.atp_staff || booking.owner_id || null,
    atp_staff_name: booking.atp_staff_name || booking.owner_name || null,
    sla_due_at: booking.sla_due_at || null,
    destination: normalizeStringArray(booking.destination).sort(),
    style: normalizeStringArray(booking.style).sort(),
    travel_month: booking.travel_month || null,
    travelers: booking.travelers ?? null,
    duration: booking.duration || null,
    budget: booking.budget || null,
    preferred_currency: booking.preferred_currency || null,
    notes: booking.notes || null,
    pricing: normalizeBookingPricing(booking.pricing),
  offer: normalizeBookingOffer(booking.offer, booking.preferred_currency || BASE_CURRENCY),
    source: booking.source || null,
    created_at: booking.created_at || null,
    updated_at: booking.updated_at || null
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function buildBookingReadModel(booking) {
  const preferredCurrency = safeCurrency(booking?.preferred_currency || booking?.pricing?.currency || BASE_CURRENCY);
  return {
    ...booking,
    pricing: await buildBookingPricingReadModel(booking.pricing, preferredCurrency),
    offer: await buildBookingOfferReadModel(booking.offer, preferredCurrency),
    booking_hash: computeBookingHash(booking)
  };
}

async function sendBookingHashConflict(res, booking) {
  sendJson(res, 409, {
    error: "Booking changed in backend",
    detail: "The booking has changed in the backend. The data has been refreshed. Your changes are lost. Please do them again.",
    code: "BOOKING_HASH_MISMATCH",
    booking: await buildBookingReadModel(booking)
  });
}

async function assertMatchingBookingHash(payload, booking, res) {
  const requestHash = normalizeText(payload.booking_hash);
  const currentHash = computeBookingHash(booking);
  if (!requestHash || requestHash !== currentHash) {
    await sendBookingHashConflict(res, booking);
    return false;
  }
  return true;
}

function filterAndSortBookings(store, query) {
  const stage = normalizeStageFilter(query.get("stage"));
  const ownerId = normalizeText(query.get("owner_id"));
  const rawSearch = normalizeText(query.get("search")).toLowerCase();
  const rawSearchNoSpace = rawSearch.replace(/\s+/g, "");
  const search = rawSearch.replace(/[^a-z0-9]+/g, "");
  const searchDigits = rawSearch.replace(/[^0-9]+/g, "");
  const searchLetters = rawSearch.replace(/[^a-z]+/g, "");
  const sort = normalizeText(query.get("sort")) || "created_at_desc";
  const customersByClientId = getCustomerLookup(store);
  ensureMetaChatCollections(store);

  const conversationBookingIds = new Map();
  const conversationIdToConversation = new Map();
  const latestBookingByClient = new Map();
  const sortedByRecency = [...store.bookings].sort(
    (a, b) =>
      String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""))
  );
  for (const booking of sortedByRecency) {
    if (!latestBookingByClient.has(booking.client_id)) {
      latestBookingByClient.set(booking.client_id, booking.id);
    }
  }

  const getLatestBookingForPhoneMatch = (phone) => {
    if (!phone) return null;
    for (const booking of sortedByRecency) {
      const customer = customersByClientId.get(booking.client_id);
      const storedPhone = customer?.phone_number || "";
      if (!storedPhone) continue;
      if (isLikelyPhoneMatch(storedPhone, phone)) return booking.id;
    }
    return null;
  };

  for (const conversation of store.chat_conversations) {
    const conversationId = normalizeText(conversation.id);
    if (!conversationId) continue;

    const matchedBookingIds = new Set();
    const linkedBookingId = normalizeText(conversation.booking_id);
    if (linkedBookingId) matchedBookingIds.add(linkedBookingId);

    const linkedClientId = normalizeText(conversation.client_id);
    if (linkedClientId) {
      const latestBookingId = latestBookingByClient.get(linkedClientId);
      if (latestBookingId) {
        matchedBookingIds.add(latestBookingId);
      }
    }

    const channel = normalizeText(conversation.channel).toLowerCase();
    const externalContactId = normalizeText(conversation.external_contact_id);
    if (channel === "whatsapp" && externalContactId) {
      const latestBookingId = getLatestBookingForPhoneMatch(externalContactId);
      if (latestBookingId) {
        matchedBookingIds.add(latestBookingId);
      }
    }

    if (matchedBookingIds.size > 0) {
      conversationBookingIds.set(conversationId, [...matchedBookingIds]);
    }
    conversationIdToConversation.set(conversationId, conversation);
  }

  const getBookingIdsFromPhoneMatch = (phone) => {
    const matched = new Set();
    const latestBookingId = getLatestBookingForPhoneMatch(phone);
    if (latestBookingId) matched.add(latestBookingId);
    return matched;
  };

  const bookingChatTextMap = new Map();
  for (const event of store.chat_events) {
    const conversationId = normalizeText(event.conversation_id);
    const eventText = normalizeText(event.text_preview).toLowerCase();
    if (!eventText) continue;

    const matchedBookingIds = new Set(conversationBookingIds.get(conversationId) || []);
    if (!matchedBookingIds.size) {
      const senderContact = normalizePhoneDigits(event.sender_contact);
      if (senderContact) {
        for (const id of getBookingIdsFromPhoneMatch(senderContact)) matchedBookingIds.add(id);
      }
    }

    if (!matchedBookingIds.size) {
      const conversation = conversationIdToConversation.get(conversationId);
      const conversationContact = conversation ? normalizePhoneDigits(conversation.external_contact_id) : "";
      if (conversationContact) {
        for (const id of getBookingIdsFromPhoneMatch(conversationContact)) matchedBookingIds.add(id);
      }
    }
    if (!matchedBookingIds.size) continue;

    const normalizedMessage = eventText.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const messageVariants = [
      eventText,
      normalizedMessage,
      eventText.replace(/\s+/g, ""),
      normalizedMessage.replace(/[^0-9]+/g, ""),
      normalizedMessage.replace(/[^a-z]+/g, "")
    ];

    const nextText = messageVariants.some((variant) => String(variant || "").trim())
      ? [...new Set(messageVariants)].join(" ")
      : eventText;

    for (const bookingId of matchedBookingIds) {
      const existing = bookingChatTextMap.get(bookingId) || "";
      bookingChatTextMap.set(bookingId, existing ? `${existing} ${nextText}` : nextText);
    }
  }

  const filtered = store.bookings.filter((booking) => {
    if (stage && booking.stage !== stage) return false;
    if (ownerId && booking.owner_id !== ownerId) return false;
    if (!search) return true;

    const customer = customersByClientId.get(booking.client_id);
    const hasDigits = /[0-9]/.test(search);
    const hasLetters = /[a-z]/.test(search);
    const haystack = [
      booking.id,
      ...normalizeStringArray(booking.destination),
      ...normalizeStringArray(booking.style),
      booking.owner_name,
      booking.notes,
      booking.client_display_name,
      customer?.email,
      bookingChatTextMap.get(booking.id),
      booking.sla_due_at,
      JSON.stringify(booking.pricing),
      JSON.stringify(booking.offer)
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    const normalizedHaystack = haystack.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const normalizedHaystackNoSpace = haystack.replace(/\s+/g, "").toLowerCase();
    if (hasDigits && hasLetters) {
      const mixedSearch = `${searchDigits}${searchLetters}`;
      const mixedSearchAlt = `${searchLetters}${searchDigits}`;
      const mixedSearchNoSpace = rawSearchNoSpace.replace(/[^a-z0-9]+/g, "");
      return (
        normalizedHaystack.includes(mixedSearch) ||
        normalizedHaystackNoSpace.includes(mixedSearch) ||
        normalizedHaystack.includes(mixedSearchAlt) ||
        normalizedHaystackNoSpace.includes(mixedSearchAlt) ||
        normalizedHaystack.includes(mixedSearchNoSpace) ||
        normalizedHaystackNoSpace.includes(mixedSearchNoSpace)
      );
    }

    return (
      haystack.includes(rawSearch) ||
      normalizedHaystack.includes(search) ||
      normalizedHaystack.includes(rawSearchNoSpace) ||
      (searchDigits &&
        (normalizedHaystack.includes(searchDigits) || normalizedHaystackNoSpace.includes(searchDigits))) ||
      (searchLetters &&
        (normalizedHaystack.includes(searchLetters) || normalizedHaystackNoSpace.includes(searchLetters)))
    );
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

function ensureMetaChatCollections(store) {
  store.chat_channel_accounts ||= [];
  store.chat_conversations ||= [];
  store.chat_events ||= [];
}

function normalizeMetaTimestampToIso(value) {
  const text = normalizeText(value);
  if (!text) return nowIso();
  const numeric = Number(text);
  if (Number.isFinite(numeric)) {
    const ms = numeric > 10_000_000_000 ? numeric : numeric * 1000;
    const date = new Date(ms);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date.toISOString();
  return nowIso();
}

function compactPreviewText(value, fallback = "(event)") {
  const text = normalizeText(value);
  if (!text) return fallback;
  if (text.length <= 240) return text;
  return `${text.slice(0, 240)}...`;
}

function extractWhatsAppMessagePreview(message) {
  const type = normalizeText(message?.type).toLowerCase();
  if (type === "text") {
    const body = typeof message?.text === "string" ? message?.text : message?.text?.body;
    return normalizeText(body) || "[text]";
  }
  if (type === "button") {
    return normalizeText(message?.button?.text) || "[button]";
  }
  if (type === "interactive") {
    return normalizeText(message?.interactive?.body?.text) || "[interactive]";
  }
  const fallbackBody = normalizeText(message?.body || message?.message?.body || message?.message?.text?.body || message?.message?.text);
  if (fallbackBody) return fallbackBody;
  if (type) return `[${type}]`;
  return "(message)";
}

function upsertMetaChannelAccount(store, { channel, externalAccountId, displayName = "", metadata = {} }) {
  ensureMetaChatCollections(store);
  const normalizedChannel = normalizeText(channel).toLowerCase();
  const normalizedAccountId = normalizeText(externalAccountId);
  if (!normalizedChannel || !normalizedAccountId) return null;

  let account = store.chat_channel_accounts.find(
    (item) => normalizeText(item.channel).toLowerCase() === normalizedChannel && normalizeText(item.external_account_id) === normalizedAccountId
  );

  if (!account) {
    account = {
      id: `chatacct_${randomUUID()}`,
      channel: normalizedChannel,
      external_account_id: normalizedAccountId,
      name: normalizeText(displayName) || null,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
      created_at: nowIso(),
      updated_at: nowIso()
    };
    store.chat_channel_accounts.push(account);
    return account;
  }

  account.name = normalizeText(displayName) || account.name || null;
  account.metadata = metadata && typeof metadata === "object" ? { ...account.metadata, ...metadata } : account.metadata;
  account.updated_at = nowIso();
  return account;
}

function findOrCreateMetaConversation(store, {
  channel,
  externalConversationId = "",
  externalContactId = "",
  channelAccountId = "",
  clientId = null,
  bookingId = null
}) {
  ensureMetaChatCollections(store);
  const normalizedChannel = normalizeText(channel).toLowerCase();
  const normalizedContactId = normalizeText(externalContactId);
  const normalizedConversationId = normalizeText(externalConversationId || normalizedContactId);
  const normalizedAccountId = normalizeText(channelAccountId);

  if (!normalizedChannel || !normalizedContactId) return null;

  let conversation = store.chat_conversations.find((item) => {
    return (
      normalizeText(item.channel).toLowerCase() === normalizedChannel &&
      normalizeText(item.external_contact_id) === normalizedContactId &&
      normalizeText(item.channel_account_id) === normalizedAccountId
    );
  });

  if (!conversation) {
    conversation = {
      id: `chatconv_${randomUUID()}`,
      channel: normalizedChannel,
      channel_account_id: normalizedAccountId || null,
      external_conversation_id: normalizedConversationId || normalizedContactId,
      external_contact_id: normalizedContactId,
      client_id: clientId || null,
      booking_id: bookingId || null,
      assigned_atp_staff_id: null,
      latest_preview: null,
      last_event_at: null,
      created_at: nowIso(),
      updated_at: nowIso()
    };
    store.chat_conversations.push(conversation);
    return conversation;
  }

  if (!conversation.client_id && clientId) conversation.client_id = clientId;
  if (!conversation.booking_id && bookingId) conversation.booking_id = bookingId;
  conversation.external_conversation_id = normalizedConversationId || conversation.external_conversation_id || normalizedContactId;
  conversation.updated_at = nowIso();
  return conversation;
}

function hasDuplicateMetaChatEvent(store, candidate) {
  return store.chat_events.some((item) => {
    return (
      normalizeText(item.conversation_id) === normalizeText(candidate.conversation_id) &&
      normalizeText(item.external_message_id) === normalizeText(candidate.external_message_id) &&
      normalizeText(item.event_type) === normalizeText(candidate.event_type) &&
      normalizeText(item.direction) === normalizeText(candidate.direction) &&
      normalizeText(item.external_status) === normalizeText(candidate.external_status) &&
      normalizeText(item.sent_at) === normalizeText(candidate.sent_at)
    );
  });
}

function appendMetaChatEvent(store, event) {
  ensureMetaChatCollections(store);
  const normalizedEvent = {
    id: `chatevt_${randomUUID()}`,
    conversation_id: normalizeText(event.conversation_id),
    channel: normalizeText(event.channel).toLowerCase(),
    event_type: normalizeText(event.event_type).toLowerCase() || "message",
    direction: normalizeText(event.direction).toLowerCase() || "inbound",
    external_message_id: normalizeText(event.external_message_id) || null,
    external_status: normalizeText(event.external_status).toLowerCase() || null,
    sender_display: normalizeText(event.sender_display) || null,
    sender_contact: normalizeText(event.sender_contact) || null,
    text_preview: compactPreviewText(event.text_preview, "(event)"),
    sent_at: normalizeMetaTimestampToIso(event.sent_at),
    received_at: nowIso(),
    payload_json: event.payload_json && typeof event.payload_json === "object" ? event.payload_json : {},
    created_at: nowIso()
  };

  if (hasDuplicateMetaChatEvent(store, normalizedEvent)) {
    return { inserted: false, event: null };
  }

  store.chat_events.push(normalizedEvent);
  const conversation = store.chat_conversations.find((item) => item.id === normalizedEvent.conversation_id);
  if (conversation) {
    conversation.last_event_at = normalizedEvent.sent_at;
    conversation.latest_preview = normalizedEvent.text_preview;
    conversation.updated_at = nowIso();
  }
  return { inserted: true, event: normalizedEvent };
}

function findChatMessageTextByExternalMessageId(store, conversationId, externalMessageId) {
  const targetConversationId = normalizeText(conversationId);
  const targetExternalId = normalizeText(externalMessageId);
  if (!targetConversationId || !targetExternalId) return "";
  const matched = store.chat_events.find((item) => {
    return (
      normalizeText(item.conversation_id) === targetConversationId &&
      normalizeText(item.event_type).toLowerCase() === "message" &&
      normalizeText(item.external_message_id) === targetExternalId
    );
  });
  return normalizeText(matched?.text_preview);
}

function buildWhatsAppContext(store, entry, change) {
  const value = change?.value && typeof change.value === "object" ? change.value : {};
  const metadata = value?.metadata && typeof value.metadata === "object" ? value.metadata : {};
  const phoneNumberId = normalizeText(metadata.phone_number_id);
  const displayPhone = normalizeText(metadata.display_phone_number);
  const wabaId = normalizeText(entry?.id);

  const account = upsertMetaChannelAccount(store, {
    channel: "whatsapp",
    externalAccountId: phoneNumberId || wabaId,
    displayName: displayPhone || "WhatsApp",
    metadata: {
      waba_id: wabaId || null,
      display_phone_number: displayPhone || null,
      phone_number_id: phoneNumberId || null
    }
  });

  const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
  const contactMap = new Map(
    contacts
      .map((contact) => [normalizeText(contact?.wa_id), contact])
      .filter(([waId]) => Boolean(waId))
  );

  return { value, account, displayPhone, contacts, contactMap };
}

function findOrCreateWhatsAppConversation(store, account, waId) {
  const normalizedWaId = normalizeText(waId);
  if (!normalizedWaId) return null;
  const matchedCustomer = resolveCustomerByExternalContact(store, normalizedWaId);
  const matchedBooking = resolveBookingForClient(store, matchedCustomer?.client_id || null);
  return findOrCreateMetaConversation(store, {
    channel: "whatsapp",
    externalConversationId: normalizedWaId,
    externalContactId: normalizedWaId,
    channelAccountId: account?.id || "",
    clientId: matchedCustomer?.client_id || null,
    bookingId: matchedBooking?.id || null
  });
}

function coerceWhatsAppMessagePayload(rawMessage) {
  const source = rawMessage && typeof rawMessage === "object" ? rawMessage : {};
  const nested = source?.message && typeof source.message === "object" ? source.message : null;
  if (!nested) return source;
  return {
    ...nested,
    id: normalizeText(source?.id) || normalizeText(nested?.id),
    from: normalizeText(source?.from) || normalizeText(nested?.from),
    to: normalizeText(source?.to) || normalizeText(nested?.to),
    timestamp: normalizeText(source?.timestamp) || normalizeText(nested?.timestamp)
  };
}

function resolveWhatsAppDirectionAndContact(message, displayPhone, fallbackContact = "") {
  const from = normalizeText(message?.from);
  const to = normalizeText(message?.to);
  const outboundFromBusiness = Boolean(displayPhone && from) && isLikelyPhoneMatch(from, displayPhone);
  const inboundToBusiness = Boolean(displayPhone && to) && isLikelyPhoneMatch(to, displayPhone);

  if (outboundFromBusiness) {
    return { direction: "outbound", contactId: normalizeText(to || fallbackContact) };
  }
  if (inboundToBusiness) {
    return { direction: "inbound", contactId: normalizeText(from || fallbackContact) };
  }
  return { direction: "inbound", contactId: normalizeText(from || to || fallbackContact) };
}

function processWhatsAppMetaChange(store, entry, change) {
  const { value, account, displayPhone, contacts, contactMap } = buildWhatsAppContext(store, entry, change);
  let inserted = 0;
  let ignored = 0;

  const messages = Array.isArray(value?.messages) ? value.messages : [];
  const messageEchoes = Array.isArray(value?.message_echoes) ? value.message_echoes : [];
  const combinedMessages = [...messages, ...messageEchoes];
  for (const rawMessage of combinedMessages) {
    const message = coerceWhatsAppMessagePayload(rawMessage);
    const directionInfo = resolveWhatsAppDirectionAndContact(message, displayPhone, contacts?.[0]?.wa_id || "");
    const waId = normalizeText(directionInfo.contactId);
    if (!waId) {
      ignored += 1;
      continue;
    }
    const conversation = findOrCreateWhatsAppConversation(store, account, waId);
    if (!conversation) {
      ignored += 1;
      continue;
    }

    const profileName = normalizeText(contactMap.get(waId)?.profile?.name);
    const result = appendMetaChatEvent(store, {
      conversation_id: conversation.id,
      channel: "whatsapp",
      event_type: "message",
      direction: directionInfo.direction,
      external_message_id: normalizeText(message?.id),
      external_status: null,
      sender_display: directionInfo.direction === "outbound" ? "business" : profileName || waId,
      sender_contact: directionInfo.direction === "outbound" ? displayPhone || normalizeText(message?.from) : waId,
      text_preview: extractWhatsAppMessagePreview(message),
      sent_at: message?.timestamp,
      payload_json: rawMessage
    });
    if (result.inserted) inserted += 1;
    else ignored += 1;
  }

  const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
  for (const status of statuses) {
    const waId = normalizeText(status?.recipient_id || status?.to || status?.recipient || "");
    if (!waId) {
      ignored += 1;
      continue;
    }
    const conversation = findOrCreateWhatsAppConversation(store, account, waId);
    if (!conversation) {
      ignored += 1;
      continue;
    }
    const statusCode = normalizeText(status?.status).toLowerCase() || "unknown";
    const externalStatusMessageId = normalizeText(status?.id || status?.message_id || status?.meta_msg_id);
    const relatedMessageText = findChatMessageTextByExternalMessageId(store, conversation.id, externalStatusMessageId);
    const result = appendMetaChatEvent(store, {
      conversation_id: conversation.id,
      channel: "whatsapp",
      event_type: "status",
      direction: "outbound",
      external_message_id: externalStatusMessageId,
      external_status: statusCode,
      sender_display: "business",
      sender_contact: displayPhone || null,
      text_preview: relatedMessageText ? `Status: ${statusCode} - ${relatedMessageText}` : `Status: ${statusCode}`,
      sent_at: status?.timestamp,
      payload_json: status
    });
    if (result.inserted) inserted += 1;
    else ignored += 1;
  }

  return { inserted, ignored };
}

function processWhatsAppMessageEchoesChange(store, entry, change) {
  const { value, account, displayPhone, contacts, contactMap } = buildWhatsAppContext(store, entry, change);
  let inserted = 0;
  let ignored = 0;
  const echoes = Array.isArray(value?.message_echoes) ? value.message_echoes : [];

  for (const rawEcho of echoes) {
    const echo = coerceWhatsAppMessagePayload(rawEcho);
    const directionInfo = resolveWhatsAppDirectionAndContact(echo, displayPhone, contacts?.[0]?.wa_id || "");
    const waId = normalizeText(directionInfo.contactId);
    if (!waId) {
      ignored += 1;
      continue;
    }
    const conversation = findOrCreateWhatsAppConversation(store, account, waId);
    if (!conversation) {
      ignored += 1;
      continue;
    }

    const profileName = normalizeText(contactMap.get(waId)?.profile?.name);
    const result = appendMetaChatEvent(store, {
      conversation_id: conversation.id,
      channel: "whatsapp",
      event_type: "message",
      direction: directionInfo.direction,
      external_message_id: normalizeText(echo?.id),
      external_status: null,
      sender_display: directionInfo.direction === "outbound" ? "business" : profileName || waId,
      sender_contact: directionInfo.direction === "outbound" ? displayPhone || normalizeText(echo?.from) : waId,
      text_preview: extractWhatsAppMessagePreview(echo),
      sent_at: echo?.timestamp,
      payload_json: rawEcho
    });
    if (result.inserted) inserted += 1;
    else ignored += 1;
  }

  return { inserted, ignored };
}

function processWhatsAppHistoryChange(store, entry, change) {
  const { value, account, displayPhone, contacts } = buildWhatsAppContext(store, entry, change);
  let inserted = 0;
  let ignored = 0;
  const historyItems = Array.isArray(value?.history) ? value.history : [];

  for (const historyItem of historyItems) {
    const fallbackContact = normalizeText(historyItem?.wa_id || historyItem?.chat_id || historyItem?.contact?.wa_id || contacts?.[0]?.wa_id || "");
    const messageItems = Array.isArray(historyItem?.messages) ? historyItem.messages : [historyItem];
    for (const rawMessage of messageItems) {
      const message = coerceWhatsAppMessagePayload(rawMessage);
      const directionInfo = resolveWhatsAppDirectionAndContact(message, displayPhone, fallbackContact);
      const waId = normalizeText(directionInfo.contactId);
      if (!waId) {
        ignored += 1;
        continue;
      }
      const conversation = findOrCreateWhatsAppConversation(store, account, waId);
      if (!conversation) {
        ignored += 1;
        continue;
      }

      const historyStatus = normalizeText(message?.history_context?.status).toLowerCase();
      const eventType = historyStatus ? "status" : "message";
      const textPreview = historyStatus ? `History status: ${historyStatus}` : extractWhatsAppMessagePreview(message);
      const result = appendMetaChatEvent(store, {
        conversation_id: conversation.id,
        channel: "whatsapp",
        event_type: eventType,
        direction: directionInfo.direction,
        external_message_id: normalizeText(message?.id),
        external_status: historyStatus || null,
        sender_display: directionInfo.direction === "outbound" ? "business" : waId,
        sender_contact: directionInfo.direction === "outbound" ? displayPhone || normalizeText(message?.from) : waId,
        text_preview: textPreview,
        sent_at: message?.timestamp || value?.timestamp,
        payload_json: rawMessage
      });
      if (result.inserted) inserted += 1;
      else ignored += 1;
    }
  }

  return { inserted, ignored };
}

function processWhatsAppAppStateSyncChange(store, entry, change) {
  const { value, account, displayPhone, contactMap } = buildWhatsAppContext(store, entry, change);
  let inserted = 0;
  let ignored = 0;
  const contacts = Array.isArray(value?.contacts) ? value.contacts : [];

  for (const contact of contacts) {
    const waId = normalizeText(contact?.wa_id || contact?.id || contact?.phone || "");
    if (!waId) {
      ignored += 1;
      continue;
    }
    const conversation = findOrCreateWhatsAppConversation(store, account, waId);
    if (!conversation) {
      ignored += 1;
      continue;
    }
    const profileName = normalizeText(contactMap.get(waId)?.profile?.name || contact?.profile?.name);
    const appState = normalizeText(contact?.state || contact?.status || contact?.app_state || "updated").toLowerCase();
    const result = appendMetaChatEvent(store, {
      conversation_id: conversation.id,
      channel: "whatsapp",
      event_type: "status",
      direction: "inbound",
      external_message_id: normalizeText(contact?.id) || `app_state_sync_${waId}`,
      external_status: "app_state_sync",
      sender_display: profileName || waId,
      sender_contact: waId,
      text_preview: `App state sync: ${appState}`,
      sent_at: value?.timestamp || nowIso(),
      payload_json: contact
    });
    if (result.inserted) inserted += 1;
    else ignored += 1;
  }

  return { inserted, ignored };
}

function processMessengerMetaEntry(store, entry) {
  const pageId = normalizeText(entry?.id);
  const account = upsertMetaChannelAccount(store, {
    channel: "messenger",
    externalAccountId: pageId,
    displayName: "Facebook Page",
    metadata: { page_id: pageId || null }
  });

  let inserted = 0;
  let ignored = 0;
  const messagingEvents = Array.isArray(entry?.messaging) ? entry.messaging : [];
  for (const event of messagingEvents) {
    const senderId = normalizeText(event?.sender?.id);
    const recipientId = normalizeText(event?.recipient?.id);
    const isOutbound = senderId === pageId;
    const contactId = isOutbound ? recipientId : senderId;
    if (!contactId) {
      ignored += 1;
      continue;
    }

    const matchedCustomer = resolveCustomerByExternalContact(store, contactId);
    const matchedBooking = resolveBookingForClient(store, matchedCustomer?.client_id || null);
    const conversation = findOrCreateMetaConversation(store, {
      channel: "messenger",
      externalConversationId: contactId,
      externalContactId: contactId,
      channelAccountId: account?.id || "",
      clientId: matchedCustomer?.client_id || null,
      bookingId: matchedBooking?.id || null
    });
    if (!conversation) {
      ignored += 1;
      continue;
    }

    const eventType = event?.message ? "message" : "status";
    const externalStatus = event?.delivery ? "delivered" : event?.read ? "read" : event?.postback ? "postback" : null;
    const previewText = event?.message?.text || (event?.message?.attachments ? "[attachment]" : eventType === "status" ? `Status: ${externalStatus || "event"}` : "(message)");

    const result = appendMetaChatEvent(store, {
      conversation_id: conversation.id,
      channel: "messenger",
      event_type: eventType,
      direction: isOutbound ? "outbound" : "inbound",
      external_message_id: normalizeText(event?.message?.mid || event?.delivery?.mids?.[0] || event?.read?.mid),
      external_status: externalStatus,
      sender_display: isOutbound ? "page" : contactId,
      sender_contact: contactId,
      text_preview: previewText,
      sent_at: event?.timestamp,
      payload_json: event
    });

    if (result.inserted) inserted += 1;
    else ignored += 1;
  }

  return { inserted, ignored };
}

function processMetaWebhookPayload(store, payload) {
  ensureMetaChatCollections(store);
  const objectType = normalizeText(payload?.object).toLowerCase();
  let inserted = 0;
  let ignored = 0;

  if (objectType === "whatsapp_business_account") {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const field = normalizeText(change?.field).toLowerCase();
        let result = null;
        if (field === "messages") {
          result = processWhatsAppMetaChange(store, entry, change);
        } else if (field === "smb_message_echoes") {
          result = processWhatsAppMessageEchoesChange(store, entry, change);
        } else if (field === "history") {
          result = processWhatsAppHistoryChange(store, entry, change);
        } else if (field === "smb_app_state_sync") {
          result = processWhatsAppAppStateSyncChange(store, entry, change);
        } else {
          continue;
        }
        inserted += result.inserted;
        ignored += result.ignored;
      }
    }
    return { inserted, ignored, channel: "whatsapp" };
  }

  if (objectType === "page") {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    for (const entry of entries) {
      const result = processMessengerMetaEntry(store, entry);
      inserted += result.inserted;
      ignored += result.ignored;
    }
    return { inserted, ignored, channel: "messenger" };
  }

  return { inserted: 0, ignored: 0, channel: "unknown" };
}

function verifyMetaWebhookSignature(req, rawBody) {
  const secret = META_APP_SECRET || WHATSAPP_APP_SECRET;
  if (!secret) return true;
  const signatureHeader = firstHeaderValue(req.headers["x-hub-signature-256"]);
  if (!signatureHeader.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const actual = signatureHeader.slice("sha256=".length);
  return safeEqualText(actual, expected);
}

function isMetaWebhookConfigured() {
  const enabled = META_WEBHOOK_ENABLED || WHATSAPP_WEBHOOK_ENABLED;
  const verifyToken = META_WEBHOOK_VERIFY_TOKEN || WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (enabled) return Boolean(verifyToken);
  return Boolean(verifyToken);
}

async function handleMetaWebhookVerify(req, res) {
  META_WEBHOOK_STATUS.verify_requests += 1;
  META_WEBHOOK_STATUS.last_verify_at = nowIso();
  if (!isMetaWebhookConfigured()) {
    sendJson(res, 503, { error: "Meta webhook is disabled" });
    return;
  }
  const requestUrl = new URL(req.url, "http://localhost");
  const mode = normalizeText(requestUrl.searchParams.get("hub.mode"));
  const verifyToken = normalizeText(requestUrl.searchParams.get("hub.verify_token"));
  const challenge = normalizeText(requestUrl.searchParams.get("hub.challenge"));
  const configuredVerifyToken = META_WEBHOOK_VERIFY_TOKEN || WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && challenge && safeEqualText(verifyToken, configuredVerifyToken)) {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(challenge);
    return;
  }

  sendJson(res, 403, { error: "Meta webhook verification failed" });
}

async function handleMetaWebhookIngest(req, res) {
  META_WEBHOOK_STATUS.ingest_requests += 1;
  META_WEBHOOK_STATUS.last_ingest_at = nowIso();
  if (!isMetaWebhookConfigured()) {
    sendJson(res, 503, { error: "Meta webhook is disabled" });
    return;
  }

  let rawBody;
  try {
    rawBody = await readBodyBuffer(req);
  } catch {
    sendJson(res, 400, { error: "Invalid request body" });
    return;
  }

  if (!verifyMetaWebhookSignature(req, rawBody)) {
    META_WEBHOOK_STATUS.signature_failures += 1;
    sendJson(res, 401, { error: "Invalid Meta signature" });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    META_WEBHOOK_STATUS.json_parse_failures += 1;
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const store = await readStore();
  const result = processMetaWebhookPayload(store, payload);
  if (result.inserted > 0) {
    await persistStore(store);
  }
  META_WEBHOOK_STATUS.last_result = {
    at: nowIso(),
    object: normalizeText(payload?.object).toLowerCase() || "unknown",
    entry_count: Array.isArray(payload?.entry) ? payload.entry.length : 0,
    channel: result.channel,
    inserted: result.inserted,
    ignored: result.ignored,
    sample_entry_id: normalizeText(payload?.entry?.[0]?.id),
    sample_change_field: normalizeText(payload?.entry?.[0]?.changes?.[0]?.field),
    sample_from: normalizeText(payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from)
  };
  sendJson(res, 200, {
    ok: true,
    mode: "read_only",
    channel: result.channel,
    inserted: result.inserted,
    ignored: result.ignored
  });
}

async function handleMetaWebhookStatus(_req, res) {
  sendJson(res, 200, {
    ok: true,
    mode: "read_only",
    configured: {
      webhook_enabled: isMetaWebhookConfigured(),
      verify_token_set: Boolean(META_WEBHOOK_VERIFY_TOKEN || WHATSAPP_WEBHOOK_VERIFY_TOKEN),
      app_secret_set: Boolean(META_APP_SECRET || WHATSAPP_APP_SECRET)
    },
    counters: {
      verify_requests: META_WEBHOOK_STATUS.verify_requests,
      ingest_requests: META_WEBHOOK_STATUS.ingest_requests,
      signature_failures: META_WEBHOOK_STATUS.signature_failures,
      json_parse_failures: META_WEBHOOK_STATUS.json_parse_failures
    },
    last_verify_at: META_WEBHOOK_STATUS.last_verify_at,
    last_ingest_at: META_WEBHOOK_STATUS.last_ingest_at,
    last_result: META_WEBHOOK_STATUS.last_result
  });
}

function buildChatEventReadModel(event, conversation) {
  const channel = normalizeText(event?.channel).toLowerCase();
  const senderContact = normalizeText(event?.sender_contact || conversation?.external_contact_id || "");
  return {
    id: event.id,
    channel,
    direction: event.direction,
    event_type: event.event_type,
    external_status: event.external_status || null,
    text_preview: event.text_preview || "",
    sender_display: event.sender_display || null,
    sender_contact: senderContact || null,
    sent_at: event.sent_at || event.created_at || null,
    received_at: event.received_at || null,
    conversation_id: event.conversation_id,
    open_url: getMetaConversationOpenUrl(channel, senderContact)
  };
}

async function handleHealth(_req, res) {
  sendJson(res, 200, {
    ok: true,
    service: "asiatravelplan-backend",
    stage_values: STAGE_ORDER,
    timestamp: nowIso()
  });
}

async function readMobileContractMeta() {
  if (!mobileContractMetaPromise) {
    mobileContractMetaPromise = (async () => {
      try {
        const raw = await readFile(MOBILE_CONTRACT_META_PATH, "utf8");
        return JSON.parse(raw);
      } catch {
        try {
          const generatedFactorySource = await readFile(BACKEND_GENERATED_REQUEST_FACTORY_PATH, "utf8");
          const match = generatedFactorySource.match(/GENERATED_CONTRACT_VERSION\s*=\s*"([^"]+)"/);
          if (match?.[1]) {
            return { modelVersion: match[1] };
          }
        } catch {
          // Fall through to unknown
        }
        return { modelVersion: "unknown" };
      }
    })();
  }
  return mobileContractMetaPromise;
}

async function handleMobileBootstrap(_req, res) {
  const contractMeta = await readMobileContractMeta();
  sendJson(res, 200, {
    app: {
      min_supported_version: MOBILE_MIN_SUPPORTED_APP_VERSION,
      latest_version: MOBILE_LATEST_APP_VERSION,
      force_update: MOBILE_FORCE_UPDATE
    },
      api: {
        contract_version: normalizeText(contractMeta.modelVersion) || "unknown"
      },
      features: {
        bookings: true,
        customers: true,
        tours: false
      }
    });
}
