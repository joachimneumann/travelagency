import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { createTranslationClient } from "../lib/translation_client.js";
import { nowIso } from "../lib/request_utils.js";
import { normalizeText } from "../lib/text.js";
import {
  GENERATED_OFFER_CATEGORIES,
  GENERATED_PAYMENT_STATUSES,
  GENERATED_PRICING_ADJUSTMENT_TYPES
} from "../../Generated/Models/generated_Booking.js";
import { GENERATED_APP_ROLES } from "../../Generated/Models/generated_Roles.js";
import {
  currencyDefinition as generatedCurrencyDefinition,
  normalizeCurrencyCode as normalizeGeneratedCurrencyCode
} from "../../Generated/Models/generated_Currency.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const APP_ROOT = path.resolve(__dirname, "..", "..");
export const REPO_ROOT = path.resolve(APP_ROOT, "..", "..");
export const DATA_ROOT = path.resolve(normalizeText(process.env.BACKEND_DATA_DIR) || path.join(APP_ROOT, "data"));
export const DATA_PATH = path.resolve(normalizeText(process.env.STORE_FILE) || path.join(DATA_ROOT, "store.json"));
export const CONTENT_ROOT = resolveConfigPathFromRepoRoot(normalizeText(process.env.CONTENT_ROOT || "content"));
export const LEGACY_TOURS_DIR = path.join(DATA_ROOT, "tours");
export const TOURS_DIR = resolveConfigPathFromRepoRoot(
  normalizeText(process.env.TOURS_DIR || process.env.TOURS_ROOT || path.join("content", "tours"))
);
export const TRAVEL_PLAN_TEMPLATES_DIR = resolveConfigPathFromRepoRoot(
  normalizeText(process.env.TRAVEL_PLAN_TEMPLATES_DIR || path.join("content", "travel_plan_templates"))
);
export const PDFS_ROOT = path.join(DATA_ROOT, "pdfs");
export const INVOICES_DIR = path.join(PDFS_ROOT, "invoices");
export const GENERATED_OFFERS_DIR = path.join(PDFS_ROOT, "generated_offers");
export const TRAVEL_PLAN_PDFS_DIR = path.join(PDFS_ROOT, "travel_plans");
export const BOOKING_IMAGES_DIR = path.join(DATA_ROOT, "booking_images");
export const BOOKING_PERSON_PHOTOS_DIR = path.join(DATA_ROOT, "booking_person_photos");
export const LEGACY_REPO_ATP_STAFF_ROOT = resolveConfigPathFromRepoRoot(path.join("content", "atp_staff"));
export const ATP_STAFF_ROOT = path.resolve(
  normalizeText(process.env.ATP_STAFF_ROOT || path.join(CONTENT_ROOT, "atp_staff"))
);
export const ATP_STAFF_PROFILES_PATH = path.resolve(
  normalizeText(process.env.ATP_STAFF_PROFILES_PATH || path.join(ATP_STAFF_ROOT, "staff.json"))
);
export const ATP_STAFF_PHOTOS_DIR = path.resolve(
  normalizeText(process.env.ATP_STAFF_PHOTOS_DIR || path.join(ATP_STAFF_ROOT, "photos"))
);
export const LEGACY_REPO_ATP_STAFF_PROFILES_PATH = path.join(LEGACY_REPO_ATP_STAFF_ROOT, "staff.json");
export const LEGACY_REPO_ATP_STAFF_PHOTOS_DIR = path.join(LEGACY_REPO_ATP_STAFF_ROOT, "photos");
export const KEYCLOAK_USER_SNAPSHOT_PATH = path.join(DATA_ROOT, "keycloak_users_snapshot.json");
export const LEGACY_COUNTRY_REFERENCE_INFO_PATH = path.join(DATA_ROOT, "country_reference_info.json");
export const COUNTRY_REFERENCE_INFO_PATH = resolveConfigPathFromRepoRoot(
  normalizeText(process.env.COUNTRY_REFERENCE_INFO_PATH || path.join("content", "country_reference_info.json"))
);
export const BOOKING_TRAVEL_PLAN_ATTACHMENTS_DIR = path.join(PDFS_ROOT, "attachments");
export const TEMP_UPLOAD_DIR = path.join(DATA_ROOT, "tmp");
export const TRAVEL_PLAN_PDF_PREVIEW_DIR = path.join(TEMP_UPLOAD_DIR, "travel_plan_previews");
export const LOGO_PNG_PATH = path.resolve(APP_ROOT, "..", "..", "assets", "img", "logo-asiatravelplan.large.png");
export const FALLBACK_BOOKING_IMAGE_PATH = path.resolve(APP_ROOT, "..", "..", "assets", "img", "happy_tourists.webp");
export const MOBILE_CONTRACT_META_PATH = path.resolve(APP_ROOT, "..", "..", "api", "generated", "mobile-api.meta.json");
export const BACKEND_GENERATED_REQUEST_FACTORY_PATH = path.join(APP_ROOT, "Generated", "API", "generated_APIRequestFactory.js");

export const LEGACY_INVOICES_DIR = path.join(DATA_ROOT, "invoices");
export const LEGACY_GENERATED_OFFERS_DIR = path.join(DATA_ROOT, "generated_offers");
export const LEGACY_BOOKING_TRAVEL_PLAN_ATTACHMENTS_DIR = path.join(DATA_ROOT, "booking_travel_plan_attachments");

export const PORT = Number(process.env.PORT || 8787);
export const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
export const execFile = promisify(execFileCb);

export const STAGING_ACCESS_CONFIG = Object.freeze({
  enabled: String(process.env.STAGING_ACCESS_ENABLED || "").trim().toLowerCase() === "true",
  password: String(process.env.STAGING_ACCESS_PASSWORD || ""),
  cookieSecret: String(process.env.STAGING_ACCESS_COOKIE_SECRET || ""),
  cookieName: normalizeText(process.env.STAGING_ACCESS_COOKIE_NAME || "asiatravelplan_staging_access"),
  maxAgeSeconds: Math.max(60, Number(process.env.STAGING_ACCESS_MAX_AGE_SECONDS || 60 * 60 * 24 * 30) || 60)
});

export const MOBILE_APP_CONFIG = Object.freeze({
  minSupportedVersion: normalizeText(process.env.MOBILE_MIN_SUPPORTED_APP_VERSION || "1.0.0"),
  latestVersion: normalizeText(process.env.MOBILE_LATEST_APP_VERSION || process.env.MOBILE_MIN_SUPPORTED_APP_VERSION || "1.0.0"),
  forceUpdate: String(process.env.MOBILE_FORCE_UPDATE || "").trim().toLowerCase() === "true"
});

export const META_WEBHOOK_CONFIG = Object.freeze({
  metaWebhookEnabled: String(process.env.META_WEBHOOK_ENABLED || "").trim().toLowerCase() === "true",
  whatsappWebhookEnabled: String(process.env.WHATSAPP_WEBHOOK_ENABLED || "").trim().toLowerCase() === "true",
  metaWebhookVerifyToken: normalizeText(process.env.META_WEBHOOK_VERIFY_TOKEN || ""),
  whatsappWebhookVerifyToken: normalizeText(process.env.WHATSAPP_VERIFY_TOKEN || ""),
  metaAppSecret: normalizeText(process.env.META_APP_SECRET || ""),
  whatsappAppSecret: normalizeText(process.env.WHATSAPP_APP_SECRET || "")
});

export const KEYCLOAK_DIRECTORY_CONFIG = Object.freeze({
  keycloakEnabled: String(process.env.KEYCLOAK_ENABLED || "").trim().toLowerCase() === "true",
  keycloakBaseUrl: process.env.KEYCLOAK_BASE_URL,
  keycloakRealm: process.env.KEYCLOAK_REALM,
  keycloakClientId: process.env.KEYCLOAK_CLIENT_ID,
  keycloakDirectoryUsername: normalizeText(process.env.KEYCLOAK_DIRECTORY_USERNAME || process.env.KEYCLOAK_ADMIN || ""),
  keycloakDirectoryPassword: normalizeText(process.env.KEYCLOAK_DIRECTORY_PASSWORD || process.env.KEYCLOAK_ADMIN_PASSWORD || ""),
  keycloakDirectoryAdminRealm: normalizeText(process.env.KEYCLOAK_DIRECTORY_ADMIN_REALM || "master")
});

const OPENAI_API_KEY = normalizeText(process.env.OPENAI_API_KEY || "");
const OPENAI_PROJECT_ID = normalizeText(process.env.OPENAI_PROJECT_ID || "");
const OPENAI_ORGANIZATION_ID = normalizeText(process.env.OPENAI_ORGANIZATION_ID || "");
const OPENAI_TRANSLATION_MODEL = normalizeText(process.env.OPENAI_TRANSLATION_MODEL || process.env.OPENAI_MODEL || "gpt-4.1") || "gpt-4.1";
const GOOGLE_TRANSLATE_FALLBACK_ENABLED = String(process.env.GOOGLE_TRANSLATE_FALLBACK_ENABLED || "true").trim().toLowerCase() !== "false";

export const TRANSLATION_ENABLED = Boolean(OPENAI_API_KEY) || GOOGLE_TRANSLATE_FALLBACK_ENABLED;

export const COMPANY_PROFILE = Object.freeze({
  name: "AsiaTravelPlan",
  website: "asiatravelplan.com",
  address: "alley 378 Cua Dai, 550000 Hoi An, Vietnam",
  whatsapp: "+84 354999192",
  email: "info@asiatravelplan.com",
  licenseNumber: "4001328591",
  bankDetails: Object.freeze({
    accountHolder: "CÔNG TY TNHH ASIA TRAVEL PLAN",
    bankName: "Vietnam Joint Stock Commercial Bank for Industry and Trade (VietinBank)",
    accountNumber: "119003054388",
    branch: "378/51 Cua Dai, Hoi An Dong, Da Nang",
    swiftCode: "ICBVVNVX484"
  })
});

export function resolveConfigPathFromRepoRoot(rawPath) {
  const normalized = normalizeText(rawPath || "");
  if (!normalized) return "";
  if (path.isAbsolute(normalized)) {
    return path.resolve(normalized);
  }
  return path.resolve(REPO_ROOT, normalized);
}

export const GMAIL_DRAFTS_CONFIG = Object.freeze({
  serviceAccountJsonPath: resolveConfigPathFromRepoRoot(normalizeText(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || "")),
  impersonatedEmail: normalizeText(process.env.GOOGLE_IMPERSONATED_EMAIL || "")
});

export const TRAVELER_DETAILS_TOKEN_CONFIG = Object.freeze({
  secret: normalizeText(process.env.TRAVELER_DETAILS_TOKEN_SECRET || ""),
  ttlMs: Math.max(60, Number(process.env.TRAVELER_DETAILS_TOKEN_TTL_SECONDS || 60 * 60 * 24) || 60) * 1000
});

export const TRANSLATION_CLIENT = createTranslationClient({
  apiKey: OPENAI_API_KEY,
  projectId: OPENAI_PROJECT_ID,
  organizationId: OPENAI_ORGANIZATION_ID,
  model: OPENAI_TRANSLATION_MODEL,
  googleFallbackEnabled: GOOGLE_TRANSLATE_FALLBACK_ENABLED
});

const GENERATED_APP_ROLE_LOOKUP = Object.freeze(
  Object.fromEntries(
    GENERATED_APP_ROLES.map((value) => [String(value).replace(/^atp_/, "").toUpperCase(), value])
  )
);

export const APP_ROLES = Object.freeze({
  ADMIN: GENERATED_APP_ROLE_LOOKUP.ADMIN,
  MANAGER: GENERATED_APP_ROLE_LOOKUP.MANAGER,
  ACCOUNTANT: GENERATED_APP_ROLE_LOOKUP.ACCOUNTANT,
  ATP_STAFF: GENERATED_APP_ROLE_LOOKUP.STAFF,
  TOUR_EDITOR: GENERATED_APP_ROLE_LOOKUP.TOUR_EDITOR
});

export const FX_RATE_CACHE_TTL_MS = 5 * 60 * 1000;
export const PRICING_ADJUSTMENT_TYPES = Object.freeze(
  Object.fromEntries(GENERATED_PRICING_ADJUSTMENT_TYPES.map((value) => [value, value]))
);
export const PAYMENT_STATUSES = Object.freeze(Object.fromEntries(GENERATED_PAYMENT_STATUSES.map((value) => [value, value])));
export const OFFER_CATEGORIES = Object.freeze(Object.fromEntries(GENERATED_OFFER_CATEGORIES.map((value) => [value, value])));
export const OFFER_CATEGORY_ORDER = GENERATED_OFFER_CATEGORIES;
export const DEFAULT_OFFER_TAX_RATE_BASIS_POINTS = 1000;

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

export const EXCHANGE_RATE_OVERRIDES = loadExchangeRateOverrides();
export const BASE_CURRENCY = normalizeGeneratedCurrencyCode(process.env.BASE_CURRENCY || "USD") || "USD";

export function getFallbackExchangeRate(fromCurrency, toCurrency) {
  const direct = EXCHANGE_RATE_OVERRIDES[`${fromCurrency}->${toCurrency}`];
  if (Number.isFinite(direct) && direct > 0) return direct;

  const reverse = EXCHANGE_RATE_OVERRIDES[`${toCurrency}->${fromCurrency}`];
  if (Number.isFinite(reverse) && reverse > 0) return Number((1 / reverse).toFixed(10));

  return null;
}

export const RUNTIME_PATHS = Object.freeze({
  appRoot: APP_ROOT,
  repoRoot: REPO_ROOT,
  dataRoot: DATA_ROOT,
  contentRoot: CONTENT_ROOT,
  dataPath: DATA_PATH,
  legacyToursDir: LEGACY_TOURS_DIR,
  pdfsRoot: PDFS_ROOT,
  toursDir: TOURS_DIR,
  travelPlanTemplatesDir: TRAVEL_PLAN_TEMPLATES_DIR,
  invoicesDir: INVOICES_DIR,
  generatedOffersDir: GENERATED_OFFERS_DIR,
  travelPlanPdfsDir: TRAVEL_PLAN_PDFS_DIR,
  bookingImagesDir: BOOKING_IMAGES_DIR,
  bookingPersonPhotosDir: BOOKING_PERSON_PHOTOS_DIR,
  atpStaffRoot: ATP_STAFF_ROOT,
  atpStaffProfilesPath: ATP_STAFF_PROFILES_PATH,
  atpStaffPhotosDir: ATP_STAFF_PHOTOS_DIR,
  legacyRepoAtpStaffProfilesPath: LEGACY_REPO_ATP_STAFF_PROFILES_PATH,
  legacyRepoAtpStaffPhotosDir: LEGACY_REPO_ATP_STAFF_PHOTOS_DIR,
  keycloakUserSnapshotPath: KEYCLOAK_USER_SNAPSHOT_PATH,
  legacyCountryReferenceInfoPath: LEGACY_COUNTRY_REFERENCE_INFO_PATH,
  countryReferenceInfoPath: COUNTRY_REFERENCE_INFO_PATH,
  bookingTravelPlanAttachmentsDir: BOOKING_TRAVEL_PLAN_ATTACHMENTS_DIR,
  tempUploadDir: TEMP_UPLOAD_DIR,
  travelPlanPdfPreviewDir: TRAVEL_PLAN_PDF_PREVIEW_DIR,
  legacyInvoicesDir: LEGACY_INVOICES_DIR,
  legacyGeneratedOffersDir: LEGACY_GENERATED_OFFERS_DIR,
  legacyBookingTravelPlanAttachmentsDir: LEGACY_BOOKING_TRAVEL_PLAN_ATTACHMENTS_DIR,
  logoPngPath: LOGO_PNG_PATH,
  fallbackBookingImagePath: FALLBACK_BOOKING_IMAGE_PATH,
  mobileContractMetaPath: MOBILE_CONTRACT_META_PATH,
  backendGeneratedRequestFactoryPath: BACKEND_GENERATED_REQUEST_FACTORY_PATH
});

export const GENERATED_CURRENCY_HELPERS = Object.freeze({
  generatedCurrencyDefinition,
  normalizeGeneratedCurrencyCode
});

export { nowIso };
