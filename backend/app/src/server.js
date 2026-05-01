import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isLikelyPhoneMatch,
  normalizeEmail,
  normalizePhone
} from "./domain/phone_matching.js";
import {
  pruneLegacyGeneratedOfferState
} from "./domain/generated_offer_cleanup.js";
import { collapseGeneratedOfferPaymentTermsState } from "./domain/generated_offer_artifacts.js";
import { migratePersistedTourState } from "./domain/tours_support.js";
import { createBackendServices } from "./bootstrap/services.js";
import { createApplicationRoutes } from "./bootstrap/application_handlers.js";
import {
  APP_ROLES,
  BASE_CURRENCY,
  BOOKING_NOTIFICATION_EMAIL_CONFIG,
  COMPANY_PROFILE,
  CORS_ORIGIN,
  DEFAULT_OFFER_TAX_RATE_BASIS_POINTS,
  EXCHANGE_RATE_OVERRIDES,
  execFile,
  FX_RATE_CACHE_TTL_MS,
  GENERATED_CURRENCY_HELPERS,
  GMAIL_DRAFTS_CONFIG,
  KEYCLOAK_DIRECTORY_CONFIG,
  META_WEBHOOK_CONFIG,
  MOBILE_APP_CONFIG,
  nowIso,
  OFFER_CATEGORIES,
  OFFER_CATEGORY_ORDER,
  PAYMENT_STATUSES,
  PORT,
  PRICING_ADJUSTMENT_TYPES,
  RUNTIME_PATHS,
  STAGING_ACCESS_CONFIG,
  TRAVELER_DETAILS_TOKEN_CONFIG,
  TRANSLATION_CLIENT,
  TRANSLATION_RUNTIME_INFO,
  TRANSLATION_ENABLED,
  TRANSLATION_OVERRIDE_WRITES_ENABLED
} from "./config/runtime.js";
import { createAuth } from "./auth.js";
import { createSystemHandlers } from "./http/handlers/system.js";
import { createHttpHelpers } from "./http/http_helpers.js";
import { createStagingAccessHandlers } from "./http/staging_access.js";
import {
  getRequestIpAddress,
  guessCountryFromRequest,
  safeFloat,
  safeInt,
  safeOptionalInt
} from "./lib/request_utils.js";
import { clamp, normalizeStringArray } from "./lib/collection_utils.js";
import { normalizeText } from "./lib/text.js";

const __filename = fileURLToPath(import.meta.url);

const backendUmaskValue = normalizeText(process.env.BACKEND_UMASK || "000");
if (backendUmaskValue) {
  const parsedUmask = Number.parseInt(backendUmaskValue, 8);
  if (Number.isInteger(parsedUmask) && parsedUmask >= 0) {
    // Shared staging content is managed outside the backend process, so keep
    // newly created files world-writable (0666) and directories writable/traversable (0777).
    process.umask(parsedUmask);
  }
}

const httpHelpers = createHttpHelpers({ corsOrigin: CORS_ORIGIN });
const stagingAccessHandlers = createStagingAccessHandlers({
  enabled: STAGING_ACCESS_CONFIG.enabled,
  password: STAGING_ACCESS_CONFIG.password,
  cookieSecret: STAGING_ACCESS_CONFIG.cookieSecret,
  speedBypassToken: STAGING_ACCESS_CONFIG.speedBypassToken,
  cookieName: STAGING_ACCESS_CONFIG.cookieName,
  maxAgeSeconds: STAGING_ACCESS_CONFIG.maxAgeSeconds,
  redirect: httpHelpers.redirect,
  appendSetCookie: httpHelpers.appendSetCookie,
  sendJson: httpHelpers.sendJson,
  sendHtml: httpHelpers.sendHtml,
  readBodyText: httpHelpers.readBodyText
});

async function pathExists(absolutePath) {
  try {
    await stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function moveDirectoryIfNeeded(sourceDir, targetDir) {
  const normalizedSourceDir = String(sourceDir || "").trim();
  const normalizedTargetDir = String(targetDir || "").trim();
  if (!normalizedSourceDir || !normalizedTargetDir || normalizedSourceDir === normalizedTargetDir) return;
  if (!(await pathExists(normalizedSourceDir))) return;
  if (await pathExists(normalizedTargetDir)) return;
  await mkdir(path.dirname(normalizedTargetDir), { recursive: true });
  await rename(normalizedSourceDir, normalizedTargetDir);
}

async function moveFileIfNeeded(sourcePath, targetPath) {
  const normalizedSourcePath = String(sourcePath || "").trim();
  const normalizedTargetPath = String(targetPath || "").trim();
  if (!normalizedSourcePath || !normalizedTargetPath || normalizedSourcePath === normalizedTargetPath) return;
  if (!(await pathExists(normalizedSourcePath))) return;
  if (await pathExists(normalizedTargetPath)) return;
  await mkdir(path.dirname(normalizedTargetPath), { recursive: true });
  await rename(normalizedSourcePath, normalizedTargetPath);
}

async function pruneDirectoryContents(targetDir) {
  const normalizedTargetDir = String(targetDir || "").trim();
  if (!normalizedTargetDir) return;
  await mkdir(normalizedTargetDir, { recursive: true });
  let entries = [];
  try {
    entries = await readdir(normalizedTargetDir, { withFileTypes: true });
  } catch {
    return;
  }
  await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(normalizedTargetDir, entry.name);
    await rm(absolutePath, { recursive: entry.isDirectory(), force: true }).catch(() => {});
  }));
}

async function backfillPersistedTourState() {
  const tours = await services.storeUtils.readTours();
  let changed = false;
  for (const tour of tours) {
    if (!migratePersistedTourState(tour)) continue;
    changed = true;
    await services.storeUtils.persistTour(services.tourHelpers.normalizeTourForStorage(tour));
  }
  return changed;
}

function pruneLegacyBookingState(store) {
  const bookings = Array.isArray(store?.bookings) ? store.bookings : [];
  let changed = false;
  for (const booking of bookings) {
    if (!booking || typeof booking !== "object") continue;
    if (Object.prototype.hasOwnProperty.call(booking, "stage")) {
      delete booking.stage;
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(booking, "milestones")) {
      delete booking.milestones;
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(booking, "last_action")) {
      delete booking.last_action;
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(booking, "last_action_at")) {
      delete booking.last_action_at;
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(booking, "service_level_agreement_due_at")) {
      delete booking.service_level_agreement_due_at;
      changed = true;
    }
  }
  return changed;
}

const services = createBackendServices({
  runtime: {
    appRoles: APP_ROLES,
    baseCurrency: BASE_CURRENCY,
    companyProfile: COMPANY_PROFILE,
    defaultOfferTaxRateBasisPoints: DEFAULT_OFFER_TAX_RATE_BASIS_POINTS,
    exchangeRateOverrides: EXCHANGE_RATE_OVERRIDES,
    fxRateCacheTtlMs: FX_RATE_CACHE_TTL_MS,
    generatedCurrencyDefinition: GENERATED_CURRENCY_HELPERS.generatedCurrencyDefinition,
    normalizeGeneratedCurrencyCode: GENERATED_CURRENCY_HELPERS.normalizeGeneratedCurrencyCode,
    gmailDraftsConfig: GMAIL_DRAFTS_CONFIG,
    bookingNotificationEmailConfig: BOOKING_NOTIFICATION_EMAIL_CONFIG,
    travelerDetailsTokenConfig: TRAVELER_DETAILS_TOKEN_CONFIG,
    keycloakDirectoryConfig: KEYCLOAK_DIRECTORY_CONFIG,
    metaWebhookConfig: META_WEBHOOK_CONFIG,
    offerCategories: OFFER_CATEGORIES,
    offerCategoryOrder: OFFER_CATEGORY_ORDER,
    paymentStatuses: PAYMENT_STATUSES,
    pricingAdjustmentTypes: PRICING_ADJUSTMENT_TYPES,
    translationEnabled: TRANSLATION_ENABLED,
    translationOverrideWritesEnabled: TRANSLATION_OVERRIDE_WRITES_ENABLED
  },
  collections: {
    repoRoot: RUNTIME_PATHS.repoRoot,
    dataPath: RUNTIME_PATHS.dataPath,
    toursDir: RUNTIME_PATHS.toursDir,
    paymentDocumentsDir: RUNTIME_PATHS.paymentDocumentsDir,
    generatedOffersDir: RUNTIME_PATHS.generatedOffersDir,
    travelPlanPdfsDir: RUNTIME_PATHS.travelPlanPdfsDir,
    bookingImagesDir: RUNTIME_PATHS.bookingImagesDir,
    bookingPersonPhotosDir: RUNTIME_PATHS.bookingPersonPhotosDir,
    atpStaffProfilesPath: RUNTIME_PATHS.atpStaffProfilesPath,
    atpStaffPhotosDir: RUNTIME_PATHS.atpStaffPhotosDir,
    keycloakUserSnapshotPath: RUNTIME_PATHS.keycloakUserSnapshotPath,
    countryReferenceInfoPath: RUNTIME_PATHS.countryReferenceInfoPath,
    translationRulesPath: RUNTIME_PATHS.translationRulesPath,
    translationMemoryPath: RUNTIME_PATHS.translationMemoryPath,
    bookingTravelPlanAttachmentsDir: RUNTIME_PATHS.bookingTravelPlanAttachmentsDir,
    tempUploadDir: RUNTIME_PATHS.tempUploadDir,
    travelPlanPdfPreviewDir: RUNTIME_PATHS.travelPlanPdfPreviewDir,
    logoPngPath: RUNTIME_PATHS.logoPngPath,
    fallbackBookingImagePath: RUNTIME_PATHS.fallbackBookingImagePath
  },
  httpHelpers: {
    readBodyBuffer: httpHelpers.readBodyBuffer,
    sendJson: httpHelpers.sendJson,
    sendFileWithCache: httpHelpers.sendFileWithCache
  },
  stagingAccessHelpers: {
    safeEqualText: stagingAccessHandlers.safeEqualText
  },
  support: {
    clamp,
    isLikelyPhoneMatch,
    normalizeEmail,
    normalizeStringArray,
    nowIso,
    randomUUID,
    safeFloat,
    safeInt,
    safeOptionalInt
  }
});

const systemHandlers = createSystemHandlers({
  sendJson: httpHelpers.sendJson,
  nowIso,
  companyProfile: COMPANY_PROFILE,
  translationRuntimeInfo: TRANSLATION_RUNTIME_INFO,
  mobileAppConfig: MOBILE_APP_CONFIG,
  mobileContractMetaPath: RUNTIME_PATHS.mobileContractMetaPath,
  backendGeneratedRequestFactoryPath: RUNTIME_PATHS.backendGeneratedRequestFactoryPath
});

const applicationRuntime = Object.freeze({
  appRoles: APP_ROLES,
  baseCurrency: BASE_CURRENCY,
  gmailDraftsConfig: GMAIL_DRAFTS_CONFIG,
  bookingNotificationEmailConfig: BOOKING_NOTIFICATION_EMAIL_CONFIG,
  travelerDetailsTokenConfig: TRAVELER_DETAILS_TOKEN_CONFIG,
  execFile,
  paths: RUNTIME_PATHS,
  translationClient: TRANSLATION_CLIENT
});

const applicationSupport = Object.freeze({
  clamp,
  normalizeEmail,
  normalizePhone,
  normalizeStringArray,
  normalizeText,
  nowIso,
  safeFloat,
  safeInt,
  getRequestIpAddress,
  guessCountryFromRequest,
  isLikelyPhoneMatch
});

export async function createBackendHandler({ port = PORT } = {}) {
  await moveDirectoryIfNeeded(RUNTIME_PATHS.legacyToursDir, RUNTIME_PATHS.toursDir);
  await moveDirectoryIfNeeded(RUNTIME_PATHS.legacyGeneratedOffersDir, RUNTIME_PATHS.generatedOffersDir);
  await moveDirectoryIfNeeded(RUNTIME_PATHS.legacyBookingTravelPlanAttachmentsDir, RUNTIME_PATHS.bookingTravelPlanAttachmentsDir);
  await moveFileIfNeeded(RUNTIME_PATHS.legacyCountryReferenceInfoPath, RUNTIME_PATHS.countryReferenceInfoPath);
  await services.storeUtils.ensureStorage();
  await backfillPersistedTourState();
  await services.travelPlanPdfArtifacts.migrateLegacyTravelPlanPdfStorage();
  await pruneDirectoryContents(RUNTIME_PATHS.travelPlanPdfPreviewDir);
  await pruneDirectoryContents(path.join(RUNTIME_PATHS.pdfsRoot, "invoices"));
  await services.atpStaffDirectory.ensureStorage();
  await services.countryReferenceStore.ensureStorage();
  await services.translationRulesStore.ensureStorage();
  await services.translationMemoryStore.ensureStorage();
  await services.atpStaffDirectory.syncProfilesFromKeycloak().catch(() => []);
  const startupStore = await services.storeUtils.readStore();
  const backfilledBookingPersons = startupStore.__bookingPersonsWritebackNeeded === true;
  const backfilledBookingOffers = startupStore.__bookingOfferWritebackNeeded === true;
  const legacyStoreWritebackNeeded = startupStore.__legacyStoreWritebackNeeded === true;
  const prunedLegacyBookingState = pruneLegacyBookingState(startupStore);
  const collapsedGeneratedOfferPaymentTerms = collapseGeneratedOfferPaymentTermsState(startupStore);
  const prunedLegacyGeneratedOfferState = pruneLegacyGeneratedOfferState(startupStore);
  if (
    prunedLegacyGeneratedOfferState
    || collapsedGeneratedOfferPaymentTerms
    || backfilledBookingPersons
    || backfilledBookingOffers
    || legacyStoreWritebackNeeded
    || prunedLegacyBookingState
  ) {
    await services.storeUtils.persistStore(startupStore);
  }
  const auth = createAuth({ port });
  const routes = createApplicationRoutes({
    auth,
    runtime: applicationRuntime,
    services,
    systemHandlers,
    stagingAccessHandlers,
    httpHelpers,
    support: applicationSupport
  });

  return async function backendHandler(req, res) {
    try {
      auth.pruneState();
      httpHelpers.withCors(req, res);

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
          httpHelpers.sendJson(res, 401, { error: "Unauthorized" });
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
        httpHelpers.sendJson(res, 404, { error: "Not found" });
        return;
      }

      httpHelpers.sendBackendNotFound(res, pathname);
    } catch (error) {
      httpHelpers.sendJson(res, 500, { error: "Internal server error", detail: String(error?.message || error) });
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
