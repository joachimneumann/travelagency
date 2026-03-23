import { createPricingHelpers } from "../domain/pricing.js";
import { createTravelPlanHelpers } from "../domain/travel_plan.js";
import { createBookingViewHelpers } from "../domain/booking_views.js";
import { createTourHelpers } from "../domain/tours_support.js";
import { createMetaWebhookHandlers } from "../integrations/meta_webhook.js";
import { createInvoicePdfWriter } from "../lib/invoice_pdf.js";
import { createOfferPdfWriter } from "../lib/offer_pdf.js";
import { createTravelPlanPdfWriter } from "../lib/travel_plan_pdf.js";
import { createKeycloakDirectory } from "../lib/keycloak_directory.js";
import { createStoreUtils } from "../lib/store_utils.js";

export function createBackendServices({
  runtime,
  collections,
  httpHelpers,
  stagingAccessHelpers,
  support
}) {
  const writeQueueRef = { current: Promise.resolve() };
  const fxRateCache = new Map();

  const pricingHelpers = createPricingHelpers({
    baseCurrency: runtime.baseCurrency,
    exchangeRateOverrides: runtime.exchangeRateOverrides,
    fxRateCache,
    fxRateCacheTtlMs: runtime.fxRateCacheTtlMs,
    defaultOfferTaxRateBasisPoints: runtime.defaultOfferTaxRateBasisPoints,
    offerCategories: runtime.offerCategories,
    offerCategoryOrder: runtime.offerCategoryOrder,
    pricingAdjustmentTypes: runtime.pricingAdjustmentTypes,
    paymentStatuses: runtime.paymentStatuses,
    generatedCurrencyDefinition: runtime.generatedCurrencyDefinition,
    normalizeGeneratedCurrencyCode: runtime.normalizeGeneratedCurrencyCode,
    clamp: support.clamp,
    safeInt: support.safeInt,
    randomUUID: support.randomUUID,
    invoicesDir: collections.invoicesDir,
    generatedOffersDir: collections.generatedOffersDir
  });

  const travelPlanHelpers = createTravelPlanHelpers();

  const bookingViewHelpers = createBookingViewHelpers({
    baseCurrency: runtime.baseCurrency,
    stages: runtime.stages,
    stageOrder: runtime.stageOrder,
    appRoles: runtime.appRoles,
    gmailDraftsConfig: runtime.gmailDraftsConfig,
    offerAcceptanceTokenConfig: runtime.offerAcceptanceTokenConfig,
    travelerDetailsTokenConfig: runtime.travelerDetailsTokenConfig,
    translationEnabled: runtime.translationEnabled,
    normalizeStringArray: support.normalizeStringArray,
    normalizeEmail: support.normalizeEmail,
    isLikelyPhoneMatch: support.isLikelyPhoneMatch,
    nowIso: support.nowIso,
    safeCurrency: pricingHelpers.safeCurrency,
    safeOptionalInt: support.safeOptionalInt,
    computeServiceLevelAgreementDueAt: runtime.computeServiceLevelAgreementDueAt,
    randomUUID: support.randomUUID,
    clamp: support.clamp,
    safeInt: support.safeInt,
    buildBookingTravelPlanReadModel: travelPlanHelpers.buildBookingTravelPlanReadModel,
    buildBookingPricingReadModel: pricingHelpers.buildBookingPricingReadModel,
    buildBookingOfferReadModel: pricingHelpers.buildBookingOfferReadModel,
    sendJson: httpHelpers.sendJson
  });

  const storeUtils = createStoreUtils({
    dataPath: collections.dataPath,
    toursDir: collections.toursDir,
    invoicesDir: collections.invoicesDir,
    generatedOffersDir: collections.generatedOffersDir,
    bookingImagesDir: collections.bookingImagesDir,
    bookingPersonPhotosDir: collections.bookingPersonPhotosDir,
    bookingTravelPlanAttachmentsDir: collections.bookingTravelPlanAttachmentsDir,
    tempUploadDir: collections.tempUploadDir,
    writeQueueRef,
    syncBookingAssignmentFields: bookingViewHelpers.syncBookingAssignmentFields,
    normalizeBookingTravelPlan: travelPlanHelpers.normalizeBookingTravelPlan,
    normalizeBookingPricing: pricingHelpers.normalizeBookingPricing,
    normalizeBookingOffer: pricingHelpers.normalizeBookingOffer,
    getBookingPreferredCurrency: pricingHelpers.getBookingPreferredCurrency,
    convertBookingPricingToBaseCurrency: pricingHelpers.convertBookingPricingToBaseCurrency,
    convertBookingOfferToBaseCurrency: pricingHelpers.convertBookingOfferToBaseCurrency
  });

  const keycloakDirectory = createKeycloakDirectory({
    keycloakEnabled: runtime.keycloakDirectoryConfig.keycloakEnabled,
    keycloakBaseUrl: runtime.keycloakDirectoryConfig.keycloakBaseUrl,
    keycloakRealm: runtime.keycloakDirectoryConfig.keycloakRealm,
    keycloakClientId: runtime.keycloakDirectoryConfig.keycloakClientId,
    keycloakAllowedRoles: new Set(Object.values(runtime.appRoles).filter(Boolean)),
    keycloakDirectoryUsername: runtime.keycloakDirectoryConfig.keycloakDirectoryUsername,
    keycloakDirectoryPassword: runtime.keycloakDirectoryConfig.keycloakDirectoryPassword,
    keycloakDirectoryAdminRealm: runtime.keycloakDirectoryConfig.keycloakDirectoryAdminRealm
  });

  const metaWebhookHandlers = createMetaWebhookHandlers({
    metaWebhookEnabled: runtime.metaWebhookConfig.metaWebhookEnabled,
    whatsappWebhookEnabled: runtime.metaWebhookConfig.whatsappWebhookEnabled,
    metaWebhookVerifyToken: runtime.metaWebhookConfig.metaWebhookVerifyToken,
    whatsappWebhookVerifyToken: runtime.metaWebhookConfig.whatsappWebhookVerifyToken,
    metaAppSecret: runtime.metaWebhookConfig.metaAppSecret,
    whatsappAppSecret: runtime.metaWebhookConfig.whatsappAppSecret,
    nowIso: support.nowIso,
    readBodyBuffer: httpHelpers.readBodyBuffer,
    readStore: storeUtils.readStore,
    persistStore: storeUtils.persistStore,
    sendJson: httpHelpers.sendJson,
    safeEqualText: stagingAccessHelpers.safeEqualText,
    resolveBookingContactByExternalContact: bookingViewHelpers.resolveBookingContactByExternalContact,
    resolveBookingById: bookingViewHelpers.resolveBookingById,
    getMetaConversationOpenUrl: bookingViewHelpers.getMetaConversationOpenUrl
  });

  const tourHelpers = createTourHelpers({
    toursDir: collections.toursDir,
    safeInt: support.safeInt,
    safeFloat: support.safeFloat
  });

  const writeInvoicePdf = createInvoicePdfWriter({
    invoicePdfPath: pricingHelpers.invoicePdfPath,
    companyProfile: runtime.companyProfile
  });

  const writeGeneratedOfferPdf = createOfferPdfWriter({
    generatedOfferPdfPath: pricingHelpers.generatedOfferPdfPath,
    bookingImagesDir: collections.bookingImagesDir,
    readTours: storeUtils.readTours,
    resolveTourImageDiskPath: tourHelpers.resolveTourImageDiskPath,
    logoPath: collections.logoPngPath,
    fallbackImagePath: collections.fallbackBookingImagePath,
    travelPlanAttachmentsDir: collections.bookingTravelPlanAttachmentsDir,
    companyProfile: runtime.companyProfile,
    formatMoney: pricingHelpers.formatMoney
  });

  const writeTravelPlanPdf = createTravelPlanPdfWriter({
    travelPlanPdfPath: (bookingId) => `${collections.generatedOffersDir}/travel-plan-${String(bookingId || "").trim()}.pdf`,
    bookingImagesDir: collections.bookingImagesDir,
    readTours: storeUtils.readTours,
    resolveTourImageDiskPath: tourHelpers.resolveTourImageDiskPath,
    logoPath: collections.logoPngPath,
    fallbackImagePath: collections.fallbackBookingImagePath,
    travelPlanAttachmentsDir: collections.bookingTravelPlanAttachmentsDir,
    companyProfile: runtime.companyProfile
  });

  return {
    pricingHelpers,
    travelPlanHelpers,
    bookingViewHelpers,
    storeUtils,
    keycloakDirectory,
    metaWebhookHandlers,
    tourHelpers,
    writeInvoicePdf,
    writeGeneratedOfferPdf,
    writeTravelPlanPdf
  };
}
