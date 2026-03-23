import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createAccessHelpers } from "../domain/access.js";
import {
  normalizeTourDestinationCode,
  normalizeTourLang,
  normalizeTourStyleCode
} from "../domain/tour_catalog_i18n.js";
import { buildPaginatedListResponse } from "../http/pagination.js";
import { buildApiRoutes } from "../http/routes.js";
import { createAtpStaffHandlers } from "../http/handlers/atp_staff.js";
import { createBookingHandlers } from "../http/handlers/bookings.js";
import { createKeycloakUserHandlers } from "../http/handlers/keycloak_users.js";
import { createSupplierHandlers } from "../http/handlers/suppliers.js";
import { createTourHandlers } from "../http/handlers/tours.js";

export function createApplicationRoutes({
  auth,
  runtime,
  services,
  systemHandlers,
  stagingAccessHandlers,
  httpHelpers,
  support
}) {
  const {
    getPrincipal,
    canViewKeycloakUsers,
    canEditAtpStaffProfiles,
    canReadTours,
    canEditTours,
    canReadSuppliers,
    canEditSuppliers
  } = createAccessHelpers({
    auth,
    appRoles: runtime.appRoles
  });

  const {
    pricingHelpers,
    travelPlanHelpers,
    bookingViewHelpers,
    storeUtils,
    keycloakDirectory,
    atpStaffDirectory,
    travelPlanPdfArtifacts,
    metaWebhookHandlers,
    tourHelpers,
    writeInvoicePdf,
    writeGeneratedOfferPdf,
    writeTravelPlanPdf
  } = services;

  const bookingHandlers = createBookingHandlers({
    readBodyJson: httpHelpers.readBodyJson,
    sendJson: httpHelpers.sendJson,
    validateBookingInput: bookingViewHelpers.validateBookingInput,
    readStore: storeUtils.readStore,
    readTours: storeUtils.readTours,
    normalizeText: support.normalizeText,
    normalizeStringArray: support.normalizeStringArray,
    getRequestIpAddress: support.getRequestIpAddress,
    guessCountryFromRequest: support.guessCountryFromRequest,
    normalizeEmail: support.normalizeEmail,
    normalizePhone: support.normalizePhone,
    nowIso: support.nowIso,
    safeCurrency: pricingHelpers.safeCurrency,
    BASE_CURRENCY: runtime.baseCurrency,
    STAGES: runtime.stages,
    computeServiceLevelAgreementDueAt: runtime.computeServiceLevelAgreementDueAt,
    safeInt: support.safeInt,
    defaultBookingPricing: pricingHelpers.defaultBookingPricing,
    defaultBookingOffer: pricingHelpers.defaultBookingOffer,
    defaultBookingTravelPlan: travelPlanHelpers.defaultBookingTravelPlan,
    addActivity: bookingViewHelpers.addActivity,
    persistStore: storeUtils.persistStore,
    getPrincipal,
    listAssignableKeycloakUsers: keycloakDirectory.listAssignableUsers,
    keycloakDisplayName: keycloakDirectory.toDisplayName,
    canReadAllBookings: bookingViewHelpers.canReadAllBookings,
    filterAndSortBookings: (store, query) => bookingViewHelpers.filterAndSortBookings(store, query, {
      ensureMetaChatCollections: metaWebhookHandlers.ensureMetaChatCollections
    }),
    canAccessBooking: bookingViewHelpers.canAccessBooking,
    buildBookingReadModel: bookingViewHelpers.buildBookingReadModel,
    paginate: bookingViewHelpers.paginate,
    buildPaginatedListResponse,
    ensureMetaChatCollections: metaWebhookHandlers.ensureMetaChatCollections,
    clamp: support.clamp,
    isLikelyPhoneMatch: support.isLikelyPhoneMatch,
    buildChatEventReadModel: metaWebhookHandlers.buildChatEventReadModel,
    getMetaConversationOpenUrl: bookingViewHelpers.getMetaConversationOpenUrl,
    STAGE_ORDER: runtime.stageOrder,
    ALLOWED_STAGE_TRANSITIONS: runtime.allowedStageTransitions,
    canChangeBookingStage: bookingViewHelpers.canChangeBookingStage,
    actorLabel: bookingViewHelpers.actorLabel,
    canChangeBookingAssignment: bookingViewHelpers.canChangeBookingAssignment,
    syncBookingAssignmentFields: bookingViewHelpers.syncBookingAssignmentFields,
    getBookingAssignedKeycloakUserId: bookingViewHelpers.getBookingAssignedKeycloakUserId,
    canEditBooking: bookingViewHelpers.canEditBooking,
    validateBookingPricingInput: pricingHelpers.validateBookingPricingInput,
    convertBookingPricingToBaseCurrency: pricingHelpers.convertBookingPricingToBaseCurrency,
    normalizeBookingPricing: pricingHelpers.normalizeBookingPricing,
    validateBookingOfferInput: pricingHelpers.validateBookingOfferInput,
    convertBookingOfferToBaseCurrency: pricingHelpers.convertBookingOfferToBaseCurrency,
    normalizeBookingOffer: pricingHelpers.normalizeBookingOffer,
    normalizeBookingTravelPlan: travelPlanHelpers.normalizeBookingTravelPlan,
    buildBookingOfferPaymentTermsReadModel: pricingHelpers.buildBookingOfferPaymentTermsReadModel,
    buildBookingOfferReadModel: pricingHelpers.buildBookingOfferReadModel,
    buildBookingTravelPlanReadModel: travelPlanHelpers.buildBookingTravelPlanReadModel,
    validateBookingTravelPlanInput: travelPlanHelpers.validateBookingTravelPlanInput,
    validateOfferExchangeRequest: pricingHelpers.validateOfferExchangeRequest,
    resolveExchangeRateWithFallback: pricingHelpers.resolveExchangeRateWithFallback,
    convertOfferLineAmountForCurrency: pricingHelpers.convertOfferLineAmountForCurrency,
    formatMoney: pricingHelpers.formatMoney,
    normalizeInvoiceComponents: pricingHelpers.normalizeInvoiceComponents,
    computeInvoiceComponentTotal: pricingHelpers.computeInvoiceComponentTotal,
    safeAmountCents: pricingHelpers.safeAmountCents,
    nextInvoiceNumber: pricingHelpers.nextInvoiceNumber,
    writeInvoicePdf,
    writeGeneratedOfferPdf,
    writeTravelPlanPdf,
    listBookingTravelPlanPdfs: travelPlanPdfArtifacts.listBookingTravelPlanPdfs,
    persistBookingTravelPlanPdfArtifact: travelPlanPdfArtifacts.persistBookingTravelPlanPdfArtifact,
    resolveBookingTravelPlanPdfArtifact: travelPlanPdfArtifacts.resolveBookingTravelPlanPdfArtifact,
    updateBookingTravelPlanPdfArtifact: travelPlanPdfArtifacts.updateBookingTravelPlanPdfArtifact,
    deleteBookingTravelPlanPdfArtifact: travelPlanPdfArtifacts.deleteBookingTravelPlanPdfArtifact,
    randomUUID,
    invoicePdfPath: pricingHelpers.invoicePdfPath,
    generatedOfferPdfPath: pricingHelpers.generatedOfferPdfPath,
    gmailDraftsConfig: runtime.gmailDraftsConfig,
    offerAcceptanceTokenConfig: runtime.offerAcceptanceTokenConfig,
    travelerDetailsTokenConfig: runtime.travelerDetailsTokenConfig,
    mkdir,
    path,
    execFile: runtime.execFile,
    TEMP_UPLOAD_DIR: runtime.paths.tempUploadDir,
    GENERATED_OFFERS_DIR: runtime.paths.generatedOffersDir,
    TRAVEL_PLAN_PDFS_DIR: runtime.paths.travelPlanPdfsDir,
    TRAVEL_PLAN_PDF_PREVIEW_DIR: runtime.paths.travelPlanPdfPreviewDir,
    BOOKING_IMAGES_DIR: runtime.paths.bookingImagesDir,
    BOOKING_PERSON_PHOTOS_DIR: runtime.paths.bookingPersonPhotosDir,
    BOOKING_TRAVEL_PLAN_ATTACHMENTS_DIR: runtime.paths.bookingTravelPlanAttachmentsDir,
    writeFile,
    rm,
    sendFileWithCache: httpHelpers.sendFileWithCache,
    translateEntries: runtime.translationClient.translateEntries,
    resolveLocalizedTourText: tourHelpers.resolveLocalizedText
  });

  const keycloakUserHandlers = createKeycloakUserHandlers({
    getPrincipal,
    canViewKeycloakUsers,
    listAssignableStaffUsers: atpStaffDirectory.listAssignableStaffUsers,
    keycloakDisplayName: keycloakDirectory.toDisplayName,
    sendJson: httpHelpers.sendJson
  });

  const atpStaffHandlers = createAtpStaffHandlers({
    getPrincipal,
    canEditAtpStaffProfiles,
    readBodyJson: httpHelpers.readBodyJson,
    sendJson: httpHelpers.sendJson,
    sendFileWithCache: httpHelpers.sendFileWithCache,
    resolveAtpStaffPhotoDiskPath: atpStaffDirectory.resolvePhotoDiskPath,
    buildAtpStaffDirectoryEntryByUsername: atpStaffDirectory.buildDirectoryEntryForUsername,
    updateAtpStaffProfileByUsername: atpStaffDirectory.updateProfileByUsername,
    setAtpStaffPictureRefByUsername: atpStaffDirectory.setPictureRefByUsername,
    resetAtpStaffPictureByUsername: atpStaffDirectory.resetPictureByUsername,
    translateEntries: runtime.translationClient.translateEntries,
    execFile: runtime.execFile,
    mkdir,
    writeFile,
    rm,
    TEMP_UPLOAD_DIR: runtime.paths.tempUploadDir,
    ATP_STAFF_PHOTOS_DIR: runtime.paths.atpStaffPhotosDir,
    randomUUID
  });

  const supplierHandlers = createSupplierHandlers({
    readBodyJson: httpHelpers.readBodyJson,
    sendJson: httpHelpers.sendJson,
    readStore: storeUtils.readStore,
    persistStore: storeUtils.persistStore,
    normalizeText: support.normalizeText,
    normalizeEmail: support.normalizeEmail,
    getPrincipal,
    canReadSuppliers,
    canEditSuppliers,
    randomUUID
  });

  const tourHandlers = createTourHandlers({
    normalizeText: support.normalizeText,
    normalizeStringArray: support.normalizeStringArray,
    safeInt: support.safeInt,
    safeFloat: support.safeFloat,
    toTourImagePublicUrl: tourHelpers.toTourImagePublicUrl,
    tourDestinationCodes: tourHelpers.tourDestinationCodes,
    tourStyleCodes: tourHelpers.tourStyleCodes,
    readTours: storeUtils.readTours,
    sendJson: httpHelpers.sendJson,
    clamp: support.clamp,
    normalizeTourForRead: tourHelpers.normalizeTourForRead,
    normalizeTourForStorage: tourHelpers.normalizeTourForStorage,
    resolveLocalizedText: tourHelpers.resolveLocalizedText,
    setLocalizedTextForLang: tourHelpers.setLocalizedTextForLang,
    setLocalizedStringArrayForLang: tourHelpers.setLocalizedStringArrayForLang,
    translateEntries: runtime.translationClient.translateEntries,
    normalizeTourLang,
    normalizeTourDestinationCode,
    normalizeTourStyleCode,
    createHash,
    getPrincipal,
    canReadTours,
    paginate: bookingViewHelpers.paginate,
    collectTourOptions: tourHelpers.collectTourOptions,
    buildPaginatedListResponse,
    canEditTours,
    readBodyJson: httpHelpers.readBodyJson,
    nowIso: support.nowIso,
    randomUUID,
    persistTour: storeUtils.persistTour,
    resolveTourImageDiskPath: tourHelpers.resolveTourImageDiskPath,
    sendFileWithCache: httpHelpers.sendFileWithCache,
    mkdir,
    path,
    execFile: runtime.execFile,
    TEMP_UPLOAD_DIR: runtime.paths.tempUploadDir,
    TOURS_DIR: runtime.paths.toursDir,
    writeFile,
    rm
  });

  return buildApiRoutes({
    authRoutes: auth.routes,
    handlers: {
      handleAuthMe: auth.handleAuthMe,
      handleHealth: systemHandlers.handleHealth,
      handleMetaWebhookStatus: metaWebhookHandlers.handleMetaWebhookStatus,
      handleMetaWebhookVerify: metaWebhookHandlers.handleMetaWebhookVerify,
      handleMetaWebhookIngest: metaWebhookHandlers.handleMetaWebhookIngest,
      handleStagingAccessLoginPage: stagingAccessHandlers.handleStagingAccessLoginPage,
      handleStagingAccessLoginSubmit: stagingAccessHandlers.handleStagingAccessLoginSubmit,
      handleStagingAccessCheck: stagingAccessHandlers.handleStagingAccessCheck,
      handleStagingAccessLogout: stagingAccessHandlers.handleStagingAccessLogout,
      handleMobileBootstrap: systemHandlers.handleMobileBootstrap,
      ...bookingHandlers,
      ...atpStaffHandlers,
      ...keycloakUserHandlers,
      ...supplierHandlers,
      ...tourHandlers
    }
  });
}
