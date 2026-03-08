import { createServer } from "node:http";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import { createAuth } from "./auth.js";
import { buildApiRoutes } from "./http/routes.js";
import { buildPaginatedListResponse } from "./http/pagination.js";
import { createHttpHelpers } from "./http/http_helpers.js";
import { createStagingAccessHandlers } from "./http/staging_access.js";
import { createPricingHelpers } from "./domain/pricing.js";
import { createBookingViewHelpers } from "./domain/booking_views.js";
import { computeBookingHash, computeClientHash, computeCustomerHash, computeTravelGroupHash } from "./domain/hashes.js";
import { createAccessHelpers } from "./domain/access.js";
import { createTourHelpers } from "./domain/tours_support.js";
import { createBookingHandlers } from "./http/handlers/bookings.js";
import { createCustomerHandlers } from "./http/handlers/customers.js";
import { createTravelGroupHandlers } from "./http/handlers/travel_groups.js";
import { createTourHandlers } from "./http/handlers/tours.js";
import { createMetaWebhookHandlers } from "./integrations/meta_webhook.js";
import { createInvoicePdfWriter } from "./lib/invoice_pdf.js";
import { createStoreUtils } from "./lib/store_utils.js";
import {
  formatCountryGuessLabel,
  getRequestIpAddress,
  guessCountryFromRequest,
  nowIso,
  safeFloat,
  safeInt,
  safeOptionalInt
} from "./lib/request_utils.js";
import { clamp, normalizeStringArray } from "./lib/collection_utils.js";
import { normalizeText } from "../../../shared/js/text.js";
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

const {
  withCors,
  redirect,
  appendSetCookie,
  sendJson,
  sendHtml,
  sendBackendNotFound,
  sendFileWithCache,
  readBodyBuffer,
  readBodyText,
  readBodyJson
} = createHttpHelpers({ corsOrigin: CORS_ORIGIN });

const {
  safeEqualText,
  handleStagingAccessLoginPage,
  handleStagingAccessLoginSubmit,
  handleStagingAccessCheck,
  handleStagingAccessLogout
} = createStagingAccessHandlers({
  enabled: STAGING_ACCESS_ENABLED,
  password: STAGING_ACCESS_PASSWORD,
  cookieSecret: STAGING_ACCESS_COOKIE_SECRET,
  cookieName: STAGING_ACCESS_COOKIE_NAME,
  maxAgeSeconds: STAGING_ACCESS_MAX_AGE_SECONDS,
  redirect,
  appendSetCookie,
  sendJson,
  sendHtml,
  readBodyText
});

const writeQueueRef = { current: writeQueue };

const {
  safeCurrency,
  getBookingPreferredCurrency,
  parseCurrencyForExchange,
  getCurrencyDefinition,
  safeAmountCents,
  defaultBookingPricing,
  defaultBookingOffer,
  normalizeBookingOffer,
  normalizeBookingPricing,
  buildBookingOfferReadModel,
  buildBookingPricingReadModel,
  validateBookingOfferInput,
  validateBookingPricingInput,
  convertOfferLineAmountForCurrency,
  resolveExchangeRateWithFallback,
  convertBookingPricingToBaseCurrency,
  convertBookingOfferToBaseCurrency,
  convertPricingForDisplay,
  convertOfferForDisplay,
  validateOfferExchangeRequest,
  formatMoney,
  normalizeInvoiceComponents,
  computeInvoiceComponentTotal,
  nextInvoiceNumber,
  invoicePdfPath
} = createPricingHelpers({
  baseCurrency: BASE_CURRENCY,
  exchangeRateOverrides: EXCHANGE_RATE_OVERRIDES,
  fxRateCache,
  fxRateCacheTtlMs: FX_RATE_CACHE_TTL_MS,
  defaultOfferTaxRateBasisPoints: DEFAULT_OFFER_TAX_RATE_BASIS_POINTS,
  offerCategories: OFFER_CATEGORIES,
  offerCategoryOrder: OFFER_CATEGORY_ORDER,
  pricingAdjustmentTypes: PRICING_ADJUSTMENT_TYPES,
  paymentStatuses: PAYMENT_STATUSES,
  generatedCurrencyDefinition,
  normalizeGeneratedCurrencyCode,
  clamp,
  safeInt,
  randomUUID,
  invoicesDir: INVOICES_DIR
});

const {
  resolveCustomerByExternalContact,
  resolveBookingForClient,
  getMetaConversationOpenUrl,
  validateBookingInput,
  addActivity,
  canReadAllBookings,
  canChangeBookingAssignment,
  canChangeBookingStage,
  actorLabel,
  syncBookingAtpStaffFields,
  canAccessBooking,
  canEditBooking,
  buildBookingReadModel,
  assertMatchingBookingHash,
  filterAndSortBookings,
  paginate
} = createBookingViewHelpers({
  baseCurrency: BASE_CURRENCY,
  stages: STAGES,
  stageOrder: STAGE_ORDER,
  appRoles: APP_ROLES,
  normalizeStringArray,
  normalizeEmail,
  isLikelyPhoneMatch,
  nowIso,
  safeCurrency,
  safeOptionalInt,
  computeSlaDueAt,
  randomUUID,
  clamp,
  safeInt,
  buildBookingPricingReadModel,
  buildBookingOfferReadModel,
  computeBookingHash,
  sendJson
});

const {
  ensureStorage,
  readStore,
  persistStore,
  readTours,
  persistTour,
  loadAtpStaff,
  persistAtpStaff
} = createStoreUtils({
  dataPath: DATA_PATH,
  toursDir: TOURS_DIR,
  invoicesDir: INVOICES_DIR,
  consentEvidenceDir: CONSENT_EVIDENCE_DIR,
  customerPhotosDir: CUSTOMER_PHOTOS_DIR,
  tempUploadDir: TEMP_UPLOAD_DIR,
  atpStaffPath: ATP_STAFF_PATH,
  writeQueueRef,
  syncBookingAtpStaffFields,
  normalizeBookingPricing,
  normalizeBookingOffer,
  getBookingPreferredCurrency,
  convertBookingPricingToBaseCurrency,
  convertBookingOfferToBaseCurrency
});

const {
  ensureMetaChatCollections,
  buildChatEventReadModel,
  handleMetaWebhookVerify,
  handleMetaWebhookIngest,
  handleMetaWebhookStatus
} = createMetaWebhookHandlers({
  metaWebhookEnabled: META_WEBHOOK_ENABLED,
  whatsappWebhookEnabled: WHATSAPP_WEBHOOK_ENABLED,
  metaWebhookVerifyToken: META_WEBHOOK_VERIFY_TOKEN,
  whatsappWebhookVerifyToken: WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  metaAppSecret: META_APP_SECRET,
  whatsappAppSecret: WHATSAPP_APP_SECRET,
  nowIso,
  readBodyBuffer,
  readStore,
  persistStore,
  sendJson,
  safeEqualText,
  resolveCustomerByExternalContact,
  resolveBookingForClient,
  getMetaConversationOpenUrl
});

const {
  tourDestinationCountries,
  normalizeHighlights,
  toTourImagePublicUrl,
  normalizeTourForRead,
  collectTourOptions,
  resolveTourImageDiskPath
} = createTourHelpers({
  toursDir: TOURS_DIR,
  safeInt,
  safeFloat
});

const writeInvoicePdf = createInvoicePdfWriter({ invoicePdfPath });

export async function createBackendHandler({ port = PORT } = {}) {
  await ensureStorage();
  const auth = createAuth({ port });
  const {
    getPrincipal,
    staffUsernames,
    resolvePrincipalAtpStaffMember,
    canReadCustomers,
    canViewAtpStaffDirectory,
    canManageAtpStaff,
    canReadTours,
    canEditTours
  } = createAccessHelpers({
    auth,
    appRoles: APP_ROLES
  });
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
    filterAndSortBookings: (store, query) =>
      filterAndSortBookings(store, query, {
        getCustomerLookup,
        ensureMetaChatCollections
      }),
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
    rm,
    sendFileWithCache
  });
  const customerHandlers = createCustomerHandlers({
    getPrincipal,
    canReadCustomers,
    sendJson,
    readStore,
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
    rm,
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

function computeSlaDueAt(stage, from = new Date()) {
  const hours = SLA_HOURS[stage] ?? 0;
  if (!hours) return null;
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function getCustomerLookup(store) {
  return new Map((Array.isArray(store?.customers) ? store.customers : []).map((customer) => [customer.client_id, customer]));
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
