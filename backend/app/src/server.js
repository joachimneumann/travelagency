import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isLikelyPhoneMatch,
  normalizeEmail,
  normalizePhone
} from "./domain/phone_matching.js";
import { backfillGeneratedOfferAcceptanceTokenState } from "./domain/offer_acceptance.js";
import { collapseGeneratedOfferPaymentTermsState } from "./domain/generated_offer_artifacts.js";
import { createBackendServices } from "./bootstrap/services.js";
import { createApplicationRoutes } from "./bootstrap/application_handlers.js";
import {
  ALLOWED_STAGE_TRANSITIONS,
  APP_ROLES,
  BASE_CURRENCY,
  COMPANY_PROFILE,
  computeServiceLevelAgreementDueAt,
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
  OFFER_ACCEPTANCE_TOKEN_CONFIG,
  OFFER_CATEGORIES,
  OFFER_CATEGORY_ORDER,
  PAYMENT_STATUSES,
  PORT,
  PRICING_ADJUSTMENT_TYPES,
  RUNTIME_PATHS,
  STAGES,
  STAGE_ORDER,
  STAGING_ACCESS_CONFIG,
  TRAVELER_DETAILS_TOKEN_CONFIG,
  TRANSLATION_CLIENT,
  TRANSLATION_ENABLED
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

const httpHelpers = createHttpHelpers({ corsOrigin: CORS_ORIGIN });
const stagingAccessHandlers = createStagingAccessHandlers({
  enabled: STAGING_ACCESS_CONFIG.enabled,
  password: STAGING_ACCESS_CONFIG.password,
  cookieSecret: STAGING_ACCESS_CONFIG.cookieSecret,
  cookieName: STAGING_ACCESS_CONFIG.cookieName,
  maxAgeSeconds: STAGING_ACCESS_CONFIG.maxAgeSeconds,
  redirect: httpHelpers.redirect,
  appendSetCookie: httpHelpers.appendSetCookie,
  sendJson: httpHelpers.sendJson,
  sendHtml: httpHelpers.sendHtml,
  readBodyText: httpHelpers.readBodyText
});

const services = createBackendServices({
  runtime: {
    appRoles: APP_ROLES,
    baseCurrency: BASE_CURRENCY,
    companyProfile: COMPANY_PROFILE,
    computeServiceLevelAgreementDueAt,
    defaultOfferTaxRateBasisPoints: DEFAULT_OFFER_TAX_RATE_BASIS_POINTS,
    exchangeRateOverrides: EXCHANGE_RATE_OVERRIDES,
    fxRateCacheTtlMs: FX_RATE_CACHE_TTL_MS,
    generatedCurrencyDefinition: GENERATED_CURRENCY_HELPERS.generatedCurrencyDefinition,
    normalizeGeneratedCurrencyCode: GENERATED_CURRENCY_HELPERS.normalizeGeneratedCurrencyCode,
    gmailDraftsConfig: GMAIL_DRAFTS_CONFIG,
    offerAcceptanceTokenConfig: OFFER_ACCEPTANCE_TOKEN_CONFIG,
    travelerDetailsTokenConfig: TRAVELER_DETAILS_TOKEN_CONFIG,
    keycloakDirectoryConfig: KEYCLOAK_DIRECTORY_CONFIG,
    metaWebhookConfig: META_WEBHOOK_CONFIG,
    offerCategories: OFFER_CATEGORIES,
    offerCategoryOrder: OFFER_CATEGORY_ORDER,
    paymentStatuses: PAYMENT_STATUSES,
    pricingAdjustmentTypes: PRICING_ADJUSTMENT_TYPES,
    stageOrder: STAGE_ORDER,
    stages: STAGES,
    translationEnabled: TRANSLATION_ENABLED
  },
  collections: {
    dataPath: RUNTIME_PATHS.dataPath,
    toursDir: RUNTIME_PATHS.toursDir,
    invoicesDir: RUNTIME_PATHS.invoicesDir,
    generatedOffersDir: RUNTIME_PATHS.generatedOffersDir,
    bookingImagesDir: RUNTIME_PATHS.bookingImagesDir,
    bookingPersonPhotosDir: RUNTIME_PATHS.bookingPersonPhotosDir,
    atpStaffProfilesPath: RUNTIME_PATHS.atpStaffProfilesPath,
    atpStaffPhotosDir: RUNTIME_PATHS.atpStaffPhotosDir,
    countryReferenceInfoPath: RUNTIME_PATHS.countryReferenceInfoPath,
    bookingTravelPlanAttachmentsDir: RUNTIME_PATHS.bookingTravelPlanAttachmentsDir,
    tempUploadDir: RUNTIME_PATHS.tempUploadDir,
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
  stageOrder: STAGE_ORDER,
  mobileAppConfig: MOBILE_APP_CONFIG,
  mobileContractMetaPath: RUNTIME_PATHS.mobileContractMetaPath,
  backendGeneratedRequestFactoryPath: RUNTIME_PATHS.backendGeneratedRequestFactoryPath
});

const applicationRuntime = Object.freeze({
  appRoles: APP_ROLES,
  baseCurrency: BASE_CURRENCY,
  stages: STAGES,
  stageOrder: STAGE_ORDER,
  allowedStageTransitions: ALLOWED_STAGE_TRANSITIONS,
  computeServiceLevelAgreementDueAt,
  gmailDraftsConfig: GMAIL_DRAFTS_CONFIG,
  offerAcceptanceTokenConfig: OFFER_ACCEPTANCE_TOKEN_CONFIG,
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
  await services.storeUtils.ensureStorage();
  await services.atpStaffDirectory.ensureStorage();
  await services.countryReferenceStore.ensureStorage();
  await services.atpStaffDirectory.syncProfilesFromKeycloak().catch(() => []);
  const startupStore = await services.storeUtils.readStore();
  const backfilledBookingPersons = startupStore.__bookingPersonsWritebackNeeded === true;
  const collapsedGeneratedOfferPaymentTerms = collapseGeneratedOfferPaymentTermsState(startupStore);
  if (backfillGeneratedOfferAcceptanceTokenState(startupStore, {
    now: nowIso(),
    ttlMs: OFFER_ACCEPTANCE_TOKEN_CONFIG.ttlMs
  }) || collapsedGeneratedOfferPaymentTerms || backfilledBookingPersons) {
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
