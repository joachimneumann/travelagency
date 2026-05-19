import path from "node:path";
import { createPricingHelpers } from "../domain/pricing.js";
import { createTravelPlanHelpers } from "../domain/travel_plan.js";
import { createBookingViewHelpers } from "../domain/booking_views.js";
import { createTourHelpers } from "../domain/tours_support.js";
import { createTourVariantHelpers } from "../domain/tour_variants.js";
import { createPaymentDocumentPdfWriter } from "../lib/payment_document_pdf.js";
import { createOfferPdfWriter } from "../lib/offer_pdf.js";
import { createTravelPlanPdfWriter } from "../lib/travel_plan_pdf.js";
import { createMarketingTourOnePagerPdfWriter } from "../lib/marketing_tour_one_pager_pdf.js";
import { createTravelPlanPdfArtifacts } from "../lib/travel_plan_pdf_artifacts.js";
import { createKeycloakDirectory } from "../lib/keycloak_directory.js";
import { createStoreUtils } from "../lib/store_utils.js";
import { createAtpStaffDirectory } from "../lib/atp_staff_directory.js";
import { createCountryReferenceStore } from "../lib/country_reference_store.js";
import { createTranslationMemoryStore } from "../lib/translation_memory_store.js";
import { createStaticTranslationApplyJobs } from "../domain/static_translation_apply_jobs.js";
import { createStaticTranslationService } from "../domain/static_translations.js";
import { createPublicSiteDeploymentStatusService } from "../domain/public_site_deployment_status.js";

export function createBackendServices({
  runtime,
  collections,
  httpHelpers,
  support
}) {
  const writeQueueRef = { current: Promise.resolve() };
  const fxRateCache = new Map();
  const translationClient = runtime.translationClient || {};

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
    paymentDocumentsDir: collections.paymentDocumentsDir,
    generatedOffersDir: collections.generatedOffersDir
  });

  const travelPlanHelpers = createTravelPlanHelpers();

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

  const translationMemoryStore = createTranslationMemoryStore({
    dataPath: collections.translationMemoryPath,
    writeQueueRef,
    nowIso: support.nowIso
  });

  const travelPlanPdfArtifacts = createTravelPlanPdfArtifacts({
    travelPlanPdfsDir: collections.travelPlanPdfsDir,
    generatedOffersDir: collections.generatedOffersDir
  });

  const bookingViewHelpers = createBookingViewHelpers({
    baseCurrency: runtime.baseCurrency,
    appRoles: runtime.appRoles,
    gmailDraftsConfig: runtime.gmailDraftsConfig,
    travelerDetailsTokenConfig: runtime.travelerDetailsTokenConfig,
    translationEnabled: runtime.translationEnabled,
    normalizeStringArray: support.normalizeStringArray,
    normalizeEmail: support.normalizeEmail,
    nowIso: support.nowIso,
    safeCurrency: pricingHelpers.safeCurrency,
    safeOptionalInt: support.safeOptionalInt,
    randomUUID: support.randomUUID,
    clamp: support.clamp,
    safeInt: support.safeInt,
    buildBookingTravelPlanReadModel: travelPlanHelpers.buildBookingTravelPlanReadModel,
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
    tourVariantsDir: collections.tourVariantsDir,
    tourDestinationsPath: collections.tourDestinationsPath,
    paymentDocumentsDir: collections.paymentDocumentsDir,
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
    normalizeBookingOffer: pricingHelpers.normalizeBookingOffer,
    getBookingPreferredCurrency: pricingHelpers.getBookingPreferredCurrency,
    convertBookingOfferToBaseCurrency: pricingHelpers.convertBookingOfferToBaseCurrency
  });

  const repoRoot = runtime.paths?.repoRoot || collections.repoRoot;

  const staticTranslationService = createStaticTranslationService({
    repoRoot,
    translationsSnapshotDir: collections.translationsSnapshotDir,
    protectedTermsPath: collections.translationProtectedTermsPath,
    phraseOverridesPath: collections.translationPhraseOverridesPath,
    readStore: storeUtils.readStore,
    persistStore: storeUtils.persistStore,
    readTours: storeUtils.readTours,
    readTourVariants: storeUtils.readTourVariants,
    persistTour: storeUtils.persistTour,
    translationMemoryStore,
    translateEntriesWithMeta: translationClient.translateEntriesWithMeta,
    nowIso: support.nowIso,
    writesEnabled: runtime.translationOverrideWritesEnabled !== false,
    snapshotPublishEnabled: runtime.translationSnapshotPublishEnabled !== false
  });

  const staticTranslationApplyJobs = createStaticTranslationApplyJobs({
    repoRoot,
    applyTranslations: (options) => staticTranslationService.applyMissingTranslations(options),
    protectTranslations: (options) => staticTranslationService.applyProtectedTerms(options),
    clearTranslationCaches: (options) => staticTranslationService.clearMachineTranslations(options),
    getStatusSummary: () => staticTranslationService.getStatusSummary(),
    nowIso: support.nowIso
  });

  const publicSiteDeploymentStatusService = createPublicSiteDeploymentStatusService({
    repoRoot,
    contentRoot: runtime.paths?.contentRoot || path.join(repoRoot, "content"),
    nowIso: support.nowIso
  });

  const tourHelpers = createTourHelpers({
    toursDir: collections.toursDir,
    safeInt: support.safeInt,
    normalizeMarketingTourTravelPlan: travelPlanHelpers.normalizeMarketingTourTravelPlan
  });

  const tourVariantHelpers = createTourVariantHelpers({
    safeInt: support.safeInt,
    randomUUID: support.randomUUID,
    normalizeMarketingTourTravelPlan: travelPlanHelpers.normalizeMarketingTourTravelPlan,
    normalizeTourForRead: tourHelpers.normalizeTourForRead,
    normalizeTourForStorage: tourHelpers.normalizeTourForStorage,
    canPublishTourOnWebpage: tourHelpers.canPublishTourOnWebpage
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
    formatMoney: pricingHelpers.formatMoney,
    composeTravelPlanForPresentation: travelPlanHelpers.composeTravelPlanForPresentation
  });

  const writeTravelPlanPdf = createTravelPlanPdfWriter({
    bookingImagesDir: collections.bookingImagesDir,
    readTours: storeUtils.readTours,
    resolveTourImageDiskPath: tourHelpers.resolveTourImageDiskPath,
    resolveTravelPlanServiceImageDiskPath: (storagePath) => {
      const normalizedPath = String(storagePath || "").split("?")[0].replace(/^\/+/, "");
      const publicTourPrefix = "public/v1/tour-images/";
      if (normalizedPath.startsWith(publicTourPrefix)) {
        return tourHelpers.resolveTourImageDiskPath(normalizedPath.slice(publicTourPrefix.length));
      }
      return normalizedPath.startsWith("tour_") ? tourHelpers.resolveTourImageDiskPath(normalizedPath) : "";
    },
    resolveAssignedAtpStaffProfile: atpStaffDirectory.resolveAssignedStaffProfile,
    resolveAtpStaffPhotoDiskPath: atpStaffDirectory.resolvePhotoDiskPath,
    logoPath: collections.logoPngPath,
    marketingTourLogoPath: path.join(repoRoot, "assets", "img", "logo-asiatravelplan.large.transparent.png"),
    fallbackImagePath: collections.fallbackBookingImagePath,
    boundaryLogisticsImagePaths: {
      arrival: path.join(repoRoot, "assets", "img", "arrival.png"),
      departure: path.join(repoRoot, "assets", "img", "departure.png")
    },
    travelPlanAttachmentsDir: collections.bookingTravelPlanAttachmentsDir,
    companyProfile: runtime.companyProfile,
    composeTravelPlanForPresentation: travelPlanHelpers.composeTravelPlanForPresentation
  });

  const resolveOnePagerImageDiskPath = (storagePath) => {
    const normalizedPath = String(storagePath || "").split("?")[0].replace(/^\/+/, "");
    const bookingImagePrefix = "public/v1/booking-images/";
    if (normalizedPath.startsWith(bookingImagePrefix)) {
      return path.resolve(collections.bookingImagesDir, normalizedPath.slice(bookingImagePrefix.length));
    }
    const tourImagePrefix = "public/v1/tour-images/";
    return tourHelpers.resolveTourImageDiskPath(
      normalizedPath.startsWith(tourImagePrefix)
        ? normalizedPath.slice(tourImagePrefix.length)
        : normalizedPath
    );
  };

  const writeMarketingTourOnePagerPdf = createMarketingTourOnePagerPdfWriter({
    resolveTourImageDiskPath: resolveOnePagerImageDiskPath,
    logoPath: path.join(repoRoot, "assets", "img", "logo-asiatravelplan.large.transparent.png"),
    fallbackImagePath: collections.fallbackBookingImagePath,
    experienceHighlightsManifestPath: path.join(repoRoot, "assets", "img", "experience-highlights", "manifest.json"),
    companyProfile: runtime.companyProfile,
    composeTravelPlanForPresentation: travelPlanHelpers.composeTravelPlanForPresentation
  });

  const writePaymentDocumentPdf = createPaymentDocumentPdfWriter({
    paymentDocumentPdfPath: pricingHelpers.paymentDocumentPdfPath,
    companyProfile: runtime.companyProfile,
    logoPath: collections.logoPngPath,
    bookingImagesDir: collections.bookingImagesDir,
    resolveAssignedAtpStaffProfile: atpStaffDirectory.resolveAssignedStaffProfile,
    resolveAtpStaffPhotoDiskPath: atpStaffDirectory.resolvePhotoDiskPath,
    fallbackImagePath: collections.fallbackBookingImagePath,
    buildBookingOfferPaymentTermsReadModel: pricingHelpers.buildBookingOfferPaymentTermsReadModel,
    buildBookingTravelPlanReadModel: travelPlanHelpers.buildBookingTravelPlanReadModel,
    composeTravelPlanForPresentation: travelPlanHelpers.composeTravelPlanForPresentation
  });

  return {
    pricingHelpers,
    travelPlanHelpers,
    bookingViewHelpers,
    storeUtils,
    keycloakDirectory,
    atpStaffDirectory,
    countryReferenceStore,
    translationMemoryStore,
    staticTranslationService,
    staticTranslationApplyJobs,
    publicSiteDeploymentStatusService,
    travelPlanPdfArtifacts,
    tourHelpers,
    tourVariantHelpers,
    writePaymentDocumentPdf,
    writeGeneratedOfferPdf,
    writeTravelPlanPdf,
    writeMarketingTourOnePagerPdf
  };
}
