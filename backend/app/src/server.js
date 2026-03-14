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
import { createTravelPlanHelpers } from "./domain/travel_plan.js";
import { createBookingViewHelpers } from "./domain/booking_views.js";
import { createAccessHelpers } from "./domain/access.js";
import { createTourHelpers } from "./domain/tours_support.js";
import { createBookingHandlers } from "./http/handlers/bookings.js";
import { createKeycloakUserHandlers } from "./http/handlers/keycloak_users.js";
import { createSupplierHandlers } from "./http/handlers/suppliers.js";
import { createTourHandlers } from "./http/handlers/tours.js";
import { createMetaWebhookHandlers } from "./integrations/meta_webhook.js";
import { createInvoicePdfWriter } from "./lib/invoice_pdf.js";
import { createOfferPdfWriter } from "./lib/offer_pdf.js";
import { createKeycloakDirectory } from "./lib/keycloak_directory.js";
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
import { normalizeText } from "./lib/text.js";
import {
  isLikelyPhoneMatch,
  normalizeEmail,
  normalizePhone,
  normalizePhoneDigits
} from "./domain/phone_matching.js";
import {
  GENERATED_BOOKING_STAGES,
  GENERATED_OFFER_CATEGORIES,
  GENERATED_PAYMENT_STATUSES,
  GENERATED_PRICING_ADJUSTMENT_TYPES
} from "../Generated/Models/generated_Booking.js";
import { GENERATED_APP_ROLES } from "../Generated/Models/generated_Roles.js";
import {
  currencyDefinition as generatedCurrencyDefinition,
  normalizeCurrencyCode as normalizeGeneratedCurrencyCode
} from "../Generated/Models/generated_Currency.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const DATA_ROOT = path.resolve(normalizeText(process.env.BACKEND_DATA_DIR) || path.join(APP_ROOT, "data"));
const DATA_PATH = path.resolve(normalizeText(process.env.STORE_FILE) || path.join(DATA_ROOT, "store.json"));
const TOURS_DIR = path.join(DATA_ROOT, "tours");
const INVOICES_DIR = path.join(DATA_ROOT, "invoices");
const GENERATED_OFFERS_DIR = path.join(DATA_ROOT, "generated_offers");
const BOOKING_IMAGES_DIR = path.join(DATA_ROOT, "booking_images");
const BOOKING_PERSON_PHOTOS_DIR = path.join(DATA_ROOT, "booking_person_photos");
const TEMP_UPLOAD_DIR = path.join(DATA_ROOT, "tmp");
const LOGO_PNG_PATH = path.resolve(APP_ROOT, "..", "..", "assets", "img", "logo-asiatravelplan.large.png");
const FALLBACK_BOOKING_IMAGE_PATH = path.resolve(APP_ROOT, "..", "..", "assets", "img", "profile_booking.png");
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
const KEYCLOAK_DIRECTORY_USERNAME = normalizeText(process.env.KEYCLOAK_DIRECTORY_USERNAME || process.env.KEYCLOAK_ADMIN || "");
const KEYCLOAK_DIRECTORY_PASSWORD = normalizeText(process.env.KEYCLOAK_DIRECTORY_PASSWORD || process.env.KEYCLOAK_ADMIN_PASSWORD || "");
const KEYCLOAK_DIRECTORY_ADMIN_REALM = normalizeText(process.env.KEYCLOAK_DIRECTORY_ADMIN_REALM || "master");
const GOOGLE_SERVICE_ACCOUNT_JSON_PATH = normalizeText(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || "");
const GOOGLE_IMPERSONATED_EMAIL = normalizeText(process.env.GOOGLE_IMPERSONATED_EMAIL || "");
const COMPANY_PROFILE = {
  name: "AsiaTravelPlan",
  website: "asiatravelplan.com",
  address: "alley 378 Cua Dai, 550000 Hoi An, Vietnam",
  whatsapp: "+84 337942446",
  email: "info@asiatravelplan.com"
};
const GMAIL_DRAFTS_CONFIG = Object.freeze({
  serviceAccountJsonPath: GOOGLE_SERVICE_ACCOUNT_JSON_PATH
    ? path.resolve(GOOGLE_SERVICE_ACCOUNT_JSON_PATH)
    : "",
  impersonatedEmail: GOOGLE_IMPERSONATED_EMAIL
});

const STAGES = Object.freeze(Object.fromEntries(GENERATED_BOOKING_STAGES.map((value) => [value, value])));
const STAGE_ORDER = GENERATED_BOOKING_STAGES;

const GENERATED_APP_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_APP_ROLES.map((value) => [String(value).replace(/^atp_/, "").toUpperCase(), value])
  )
);

const APP_ROLES = Object.freeze({
  ADMIN: GENERATED_APP_ROLE_LOOKUP.ADMIN,
  MANAGER: GENERATED_APP_ROLE_LOOKUP.MANAGER,
  ACCOUNTANT: GENERATED_APP_ROLE_LOOKUP.ACCOUNTANT,
  ATP_STAFF: GENERATED_APP_ROLE_LOOKUP.STAFF
});

const FX_RATE_CACHE_TTL_MS = 5 * 60 * 1000;
const fxRateCache = new Map();
const FX_RATE_CACHE_STALE_MS = 30 * 60 * 1000;

const PRICING_ADJUSTMENT_TYPES = Object.freeze(
  Object.fromEntries(GENERATED_PRICING_ADJUSTMENT_TYPES.map((value) => [value, value]))
);

const PAYMENT_STATUSES = Object.freeze(Object.fromEntries(GENERATED_PAYMENT_STATUSES.map((value) => [value, value])));

const OFFER_CATEGORIES = Object.freeze(
  Object.fromEntries(GENERATED_OFFER_CATEGORIES.map((value) => [value, value]))
);

const OFFER_CATEGORY_ORDER = GENERATED_OFFER_CATEGORIES;

const DEFAULT_OFFER_TAX_RATE_BASIS_POINTS = 1000;

const ALLOWED_STAGE_TRANSITIONS = Object.freeze(
  Object.fromEntries(STAGE_ORDER.map((stage) => [stage, STAGE_ORDER]))
);

const SERVICE_LEVEL_AGREEMENT_HOURS = {
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
  invoicePdfPath,
  generatedOfferPdfPath
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
  invoicesDir: INVOICES_DIR,
  generatedOffersDir: GENERATED_OFFERS_DIR
});

const {
  defaultBookingTravelPlan,
  normalizeBookingTravelPlan,
  validateBookingTravelPlanInput,
  buildBookingTravelPlanReadModel
} = createTravelPlanHelpers();

const {
  resolveBookingContactByExternalContact,
  resolveBookingById,
  getMetaConversationOpenUrl,
  validateBookingInput,
  addActivity,
  canReadAllBookings,
  canChangeBookingAssignment,
  canChangeBookingStage,
  actorLabel,
  syncBookingAssignmentFields,
  getBookingAssignedKeycloakUserId,
  canAccessBooking,
  canEditBooking,
  buildBookingReadModel,
  filterAndSortBookings,
  paginate
} = createBookingViewHelpers({
  baseCurrency: BASE_CURRENCY,
  stages: STAGES,
  stageOrder: STAGE_ORDER,
  appRoles: APP_ROLES,
  gmailDraftsConfig: GMAIL_DRAFTS_CONFIG,
  normalizeStringArray,
  normalizeEmail,
  isLikelyPhoneMatch,
  nowIso,
  safeCurrency,
  safeOptionalInt,
  computeServiceLevelAgreementDueAt,
  randomUUID,
  clamp,
  safeInt,
  buildBookingTravelPlanReadModel,
  buildBookingPricingReadModel,
  buildBookingOfferReadModel,
  sendJson
});

const {
  ensureStorage,
  readStore,
  persistStore,
  readTours,
  persistTour
} = createStoreUtils({
  dataPath: DATA_PATH,
  toursDir: TOURS_DIR,
  invoicesDir: INVOICES_DIR,
  generatedOffersDir: GENERATED_OFFERS_DIR,
  bookingImagesDir: BOOKING_IMAGES_DIR,
  bookingPersonPhotosDir: BOOKING_PERSON_PHOTOS_DIR,
  tempUploadDir: TEMP_UPLOAD_DIR,
  writeQueueRef,
  syncBookingAssignmentFields,
  normalizeBookingTravelPlan,
  normalizeBookingPricing,
  normalizeBookingOffer,
  getBookingPreferredCurrency,
  convertBookingPricingToBaseCurrency,
  convertBookingOfferToBaseCurrency
});

const keycloakDirectory = createKeycloakDirectory({
  keycloakEnabled: String(process.env.KEYCLOAK_ENABLED || "").trim().toLowerCase() === "true",
  keycloakBaseUrl: process.env.KEYCLOAK_BASE_URL,
  keycloakRealm: process.env.KEYCLOAK_REALM,
  keycloakClientId: process.env.KEYCLOAK_CLIENT_ID,
  keycloakAllowedRoles: new Set(Object.values(APP_ROLES).filter(Boolean)),
  keycloakDirectoryUsername: KEYCLOAK_DIRECTORY_USERNAME,
  keycloakDirectoryPassword: KEYCLOAK_DIRECTORY_PASSWORD,
  keycloakDirectoryAdminRealm: KEYCLOAK_DIRECTORY_ADMIN_REALM
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
  resolveBookingContactByExternalContact,
  resolveBookingById,
  getMetaConversationOpenUrl
});

const {
  tourDestinations,
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
const writeGeneratedOfferPdf = createOfferPdfWriter({
  generatedOfferPdfPath,
  bookingImagesDir: BOOKING_IMAGES_DIR,
  readTours,
  resolveTourImageDiskPath,
  logoPath: LOGO_PNG_PATH,
  fallbackImagePath: FALLBACK_BOOKING_IMAGE_PATH,
  companyProfile: COMPANY_PROFILE,
  formatMoney
});

export async function createBackendHandler({ port = PORT } = {}) {
  await ensureStorage();
  const auth = createAuth({ port });
  const {
    getPrincipal,
    canViewKeycloakUsers,
    canReadTours,
    canEditTours,
    canReadSuppliers,
    canEditSuppliers
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
    computeServiceLevelAgreementDueAt,
    safeInt,
    defaultBookingPricing,
    defaultBookingOffer,
    defaultBookingTravelPlan,
    addActivity,
    persistStore,
    getPrincipal,
    listAssignableKeycloakUsers: keycloakDirectory.listAssignableUsers,
    keycloakDisplayName: keycloakDirectory.toDisplayName,
    canReadAllBookings,
    filterAndSortBookings: (store, query) => filterAndSortBookings(store, query, { ensureMetaChatCollections }),
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
    actorLabel,
    canChangeBookingAssignment,
    syncBookingAssignmentFields,
    getBookingAssignedKeycloakUserId,
    canEditBooking,
    validateBookingPricingInput,
    convertBookingPricingToBaseCurrency,
    normalizeBookingPricing,
    validateBookingOfferInput,
    convertBookingOfferToBaseCurrency,
    normalizeBookingOffer,
    normalizeBookingTravelPlan,
    validateBookingTravelPlanInput,
    validateOfferExchangeRequest,
    resolveExchangeRateWithFallback,
    convertOfferLineAmountForCurrency,
    formatMoney,
    normalizeInvoiceComponents,
    computeInvoiceComponentTotal,
    safeAmountCents,
    nextInvoiceNumber,
    writeInvoicePdf,
    writeGeneratedOfferPdf,
    randomUUID,
    invoicePdfPath,
    generatedOfferPdfPath,
    gmailDraftsConfig: GMAIL_DRAFTS_CONFIG,
    mkdir,
    path,
    execFile,
    TEMP_UPLOAD_DIR,
    GENERATED_OFFERS_DIR,
    BOOKING_IMAGES_DIR,
    BOOKING_PERSON_PHOTOS_DIR,
    writeFile,
    rm,
    sendFileWithCache
  });
  const keycloakUserHandlers = createKeycloakUserHandlers({
    getPrincipal,
    canViewKeycloakUsers,
    listAssignableKeycloakUsers: keycloakDirectory.listAssignableUsers,
    keycloakDisplayName: keycloakDirectory.toDisplayName,
    sendJson
  });
  const supplierHandlers = createSupplierHandlers({
    readBodyJson,
    sendJson,
    readStore,
    persistStore,
    normalizeText,
    normalizeEmail,
    getPrincipal,
    canReadSuppliers,
    canEditSuppliers,
    randomUUID
  });
  const tourHandlers = createTourHandlers({
    normalizeText,
    normalizeStringArray,
    safeInt,
    safeFloat,
    normalizeHighlights,
    toTourImagePublicUrl,
    tourDestinations,
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
      ...keycloakUserHandlers,
      ...supplierHandlers,
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

function computeServiceLevelAgreementDueAt(stage, from = new Date()) {
  const hours = SERVICE_LEVEL_AGREEMENT_HOURS[stage] ?? 0;
  if (!hours) return null;
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString();
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
        tours: false
      }
    });
}
