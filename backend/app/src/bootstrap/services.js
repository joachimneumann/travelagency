import { createPricingHelpers } from "../domain/pricing.js";
import { createTravelPlanHelpers } from "../domain/travel_plan.js";
import { createTravelPlanTemplateHelpers } from "../domain/travel_plan_templates.js";
import { createBookingViewHelpers } from "../domain/booking_views.js";
import { createTourHelpers } from "../domain/tours_support.js";
import {
  normalizeTourDestinationCode,
  normalizeTourStyleCode
} from "../domain/tour_catalog_i18n.js";
import { createMetaWebhookHandlers } from "../integrations/meta_webhook.js";
import { createInvoicePdfWriter } from "../lib/invoice_pdf.js";
import { createOfferPdfWriter } from "../lib/offer_pdf.js";
import { createTravelPlanPdfWriter } from "../lib/travel_plan_pdf.js";
import { createTravelPlanPdfArtifacts } from "../lib/travel_plan_pdf_artifacts.js";
import { createKeycloakDirectory } from "../lib/keycloak_directory.js";
import { createStoreUtils } from "../lib/store_utils.js";
import { createAtpStaffDirectory } from "../lib/atp_staff_directory.js";
import { createCountryReferenceStore } from "../lib/country_reference_store.js";

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
  const travelPlanTemplateHelpers = createTravelPlanTemplateHelpers({
    normalizeBookingTravelPlan: travelPlanHelpers.normalizeBookingTravelPlan,
    normalizeStringArray: support.normalizeStringArray,
    normalizeTourDestinationCode,
    normalizeTourStyleCode,
    randomUUID: support.randomUUID,
    nowIso: support.nowIso
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

  const atpStaffDirectory = createAtpStaffDirectory({
    dataPath: collections.atpStaffProfilesPath,
    photosDir: collections.atpStaffPhotosDir,
    legacyDataPath: collections.legacyRepoAtpStaffProfilesPath,
    legacyPhotosDir: collections.legacyRepoAtpStaffPhotosDir,
    keycloakUsersSnapshotPath: collections.keycloakUserSnapshotPath,
    keycloakDirectory,
    writeQueueRef,
    staffRoleNames: [runtime.appRoles.ATP_STAFF, runtime.appRoles.ADMIN]
  });

  atpStaffDirectory.primeLocalKeycloakSnapshot().catch(() => {});

  const countryReferenceStore = createCountryReferenceStore({
    dataPath: collections.countryReferenceInfoPath,
    writeQueueRef,
    nowIso: support.nowIso
  });

  const travelPlanPdfArtifacts = createTravelPlanPdfArtifacts({
    travelPlanPdfsDir: collections.travelPlanPdfsDir,
    generatedOffersDir: collections.generatedOffersDir
  });

  const bookingViewHelpers = createBookingViewHelpers({
    baseCurrency: runtime.baseCurrency,
    stages: runtime.stages,
    stageOrder: runtime.stageOrder,
    appRoles: runtime.appRoles,
    gmailDraftsConfig: runtime.gmailDraftsConfig,
    bookingConfirmationTokenConfig: runtime.bookingConfirmationTokenConfig,
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
    buildBookingOfferPaymentTermsReadModel: pricingHelpers.buildBookingOfferPaymentTermsReadModel,
    listAssignableKeycloakUsers: atpStaffDirectory.listCachedEligibleStaffUsers,
    keycloakDisplayName: keycloakDirectory.toDisplayName,
    resolveAssignedAtpStaffProfile: atpStaffDirectory.resolveAssignedStaffProfile,
    listBookingTravelPlanPdfs: travelPlanPdfArtifacts.listBookingTravelPlanPdfs,
    sendJson: httpHelpers.sendJson
  });

  const storeUtils = createStoreUtils({
    dataPath: collections.dataPath,
    toursDir: collections.toursDir,
    travelPlanTemplatesDir: collections.travelPlanTemplatesDir,
    invoicesDir: collections.invoicesDir,
    generatedOffersDir: collections.generatedOffersDir,
    travelPlanPdfsDir: collections.travelPlanPdfsDir,
    bookingImagesDir: collections.bookingImagesDir,
    bookingPersonPhotosDir: collections.bookingPersonPhotosDir,
    bookingTravelPlanAttachmentsDir: collections.bookingTravelPlanAttachmentsDir,
    tempUploadDir: collections.tempUploadDir,
    travelPlanPdfPreviewDir: collections.travelPlanPdfPreviewDir,
    writeQueueRef,
    syncBookingAssignmentFields: bookingViewHelpers.syncBookingAssignmentFields,
    normalizeBookingTravelPlan: travelPlanHelpers.normalizeBookingTravelPlan,
    normalizeBookingPricing: pricingHelpers.normalizeBookingPricing,
    normalizeBookingOffer: pricingHelpers.normalizeBookingOffer,
    getBookingPreferredCurrency: pricingHelpers.getBookingPreferredCurrency,
    convertBookingPricingToBaseCurrency: pricingHelpers.convertBookingPricingToBaseCurrency,
    convertBookingOfferToBaseCurrency: pricingHelpers.convertBookingOfferToBaseCurrency
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
    safeInt: support.safeInt
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
    resolveAssignedAtpStaffProfile: atpStaffDirectory.resolveAssignedStaffProfile,
    resolveAtpStaffPhotoDiskPath: atpStaffDirectory.resolvePhotoDiskPath,
    logoPath: collections.logoPngPath,
    fallbackImagePath: collections.fallbackBookingImagePath,
    travelPlanAttachmentsDir: collections.bookingTravelPlanAttachmentsDir,
    companyProfile: runtime.companyProfile,
    formatMoney: pricingHelpers.formatMoney
  });

  const writeTravelPlanPdf = createTravelPlanPdfWriter({
    bookingImagesDir: collections.bookingImagesDir,
    readTours: storeUtils.readTours,
    resolveTourImageDiskPath: tourHelpers.resolveTourImageDiskPath,
    resolveAssignedAtpStaffProfile: atpStaffDirectory.resolveAssignedStaffProfile,
    resolveAtpStaffPhotoDiskPath: atpStaffDirectory.resolvePhotoDiskPath,
    logoPath: collections.logoPngPath,
    fallbackImagePath: collections.fallbackBookingImagePath,
    travelPlanAttachmentsDir: collections.bookingTravelPlanAttachmentsDir,
    companyProfile: runtime.companyProfile
  });

  return {
    pricingHelpers,
    travelPlanHelpers,
    travelPlanTemplateHelpers,
    bookingViewHelpers,
    storeUtils,
    keycloakDirectory,
    atpStaffDirectory,
    countryReferenceStore,
    travelPlanPdfArtifacts,
    metaWebhookHandlers,
    tourHelpers,
    writeInvoicePdf,
    writeGeneratedOfferPdf,
    writeTravelPlanPdf
  };
}
