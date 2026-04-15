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
import { createBookingQueryModule } from "../http/handlers/booking_query.js";
import { createCountryReferenceHandlers } from "../http/handlers/country_reference.js";
import { createKeycloakUserHandlers } from "../http/handlers/keycloak_users.js";
import { createSupplierHandlers } from "../http/handlers/suppliers.js";
import { createTravelPlanTemplateHandlers } from "../http/handlers/travel_plan_templates.js";
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
    canReadCountryReferenceInfo,
    canEditCountryReferenceInfo,
    canReadSuppliers,
    canEditSuppliers,
    canReadTravelPlanTemplates,
    canEditTravelPlanTemplates
  } = createAccessHelpers({
    auth,
    appRoles: runtime.appRoles
  });

  const {
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
  } = services;

  function getBookingRevision(booking, field) {
    const value = Number(booking?.[field]);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  }

  function incrementBookingRevision(booking, field) {
    booking[field] = getBookingRevision(booking, field) + 1;
  }

  const bookingQueryModule = createBookingQueryModule({
    buildBookingReadModel: bookingViewHelpers.buildBookingReadModel,
    normalizeText: support.normalizeText,
    normalizeStringArray: support.normalizeStringArray,
    normalizeEmail: support.normalizeEmail,
    normalizePhone: support.normalizePhone,
    safeCurrency: pricingHelpers.safeCurrency,
    BASE_CURRENCY: runtime.baseCurrency,
    getBookingAssignedKeycloakUserId: bookingViewHelpers.getBookingAssignedKeycloakUserId
  });

  async function assertExpectedRevision(req, payload, booking, payloadField, revisionField, res) {
    const rawExpected = payload?.[payloadField];
    const expectedRevision = rawExpected === undefined || rawExpected === null || rawExpected === ""
      ? null
      : support.safeInt(rawExpected);
    const currentRevision = getBookingRevision(booking, revisionField);
    if (expectedRevision === null || expectedRevision !== currentRevision) {
      httpHelpers.sendJson(res, 409, {
        error: "Booking changed in backend",
        detail: "The booking has changed in the backend. The data has been refreshed. Your changes are lost. Please do them again.",
        code: "BOOKING_REVISION_MISMATCH",
        booking: await bookingQueryModule.buildBookingPayload(booking, req)
      });
      return false;
    }
    return true;
  }

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
    actorLabel: bookingViewHelpers.actorLabel,
    canChangeBookingAssignment: bookingViewHelpers.canChangeBookingAssignment,
    syncBookingAssignmentFields: bookingViewHelpers.syncBookingAssignmentFields,
    getBookingAssignedKeycloakUserId: bookingViewHelpers.getBookingAssignedKeycloakUserId,
    canEditBooking: bookingViewHelpers.canEditBooking,
    validateBookingPricingInput: pricingHelpers.validateBookingPricingInput,
    convertBookingPricingToBaseCurrency: pricingHelpers.convertBookingPricingToBaseCurrency,
    convertMinorUnits: pricingHelpers.convertMinorUnits,
    normalizeBookingPricing: pricingHelpers.normalizeBookingPricing,
    validateBookingOfferInput: pricingHelpers.validateBookingOfferInput,
    convertBookingOfferToBaseCurrency: pricingHelpers.convertBookingOfferToBaseCurrency,
    normalizeBookingOffer: pricingHelpers.normalizeBookingOffer,
    buildVisiblePricingProjection: pricingHelpers.buildVisiblePricingProjection,
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
    bookingConfirmationTokenConfig: runtime.bookingConfirmationTokenConfig,
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
    listAssignableUsers: keycloakDirectory.listAssignableUsers,
    listCachedAssignableUsers: atpStaffDirectory.listCachedAssignableUsers,
    keycloakDisplayName: keycloakDirectory.toDisplayName,
    sendJson: httpHelpers.sendJson
  });

  const atpStaffHandlers = createAtpStaffHandlers({
    getPrincipal,
    canViewAtpStaffProfiles: canViewKeycloakUsers,
    canEditAtpStaffProfiles,
    readBodyJson: httpHelpers.readBodyJson,
    sendJson: httpHelpers.sendJson,
    listAtpStaffDirectoryEntries: atpStaffDirectory.listDirectoryEntries,
    listPublicAtpStaffProfiles: atpStaffDirectory.listPublicTeamProfiles,
    buildAtpStaffDirectoryEntryByUsername: atpStaffDirectory.buildDirectoryEntryForUsername,
    updateAtpStaffProfileByUsername: atpStaffDirectory.updateProfileByUsername,
    setAtpStaffPictureRefByUsername: atpStaffDirectory.setPictureRefByUsername,
    resetAtpStaffPictureByUsername: atpStaffDirectory.resetPictureByUsername,
    repoRoot: runtime.paths.repoRoot,
    translateEntries: runtime.translationClient.translateEntries,
    translateEntriesWithMeta: runtime.translationClient.translateEntriesWithMeta,
    execFile: runtime.execFile,
    mkdir,
    writeFile,
    rm,
    TEMP_UPLOAD_DIR: runtime.paths.tempUploadDir,
    ATP_STAFF_PHOTOS_DIR: runtime.paths.atpStaffPhotosDir,
    resolveAtpStaffPhotoDiskPath: atpStaffDirectory.resolvePhotoDiskPath,
    sendFileWithCache: httpHelpers.sendFileWithCache,
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

  const countryReferenceHandlers = createCountryReferenceHandlers({
    readBodyJson: httpHelpers.readBodyJson,
    sendJson: httpHelpers.sendJson,
    getPrincipal,
    canReadCountryReferenceInfo,
    canEditCountryReferenceInfo,
    readCountryPracticalInfo: countryReferenceStore.readCountryPracticalInfo,
    persistCountryPracticalInfo: countryReferenceStore.persistCountryPracticalInfo,
    normalizeText: support.normalizeText,
    nowIso: support.nowIso
  });

  const tourHandlers = createTourHandlers({
    normalizeText: support.normalizeText,
    normalizeStringArray: support.normalizeStringArray,
    safeInt: support.safeInt,
    toTourImagePublicUrl: tourHelpers.toTourImagePublicUrl,
    tourDestinationCodes: tourHelpers.tourDestinationCodes,
    tourStyleCodes: tourHelpers.tourStyleCodes,
    readStore: storeUtils.readStore,
    readTours: storeUtils.readTours,
    sendJson: httpHelpers.sendJson,
    clamp: support.clamp,
    normalizeTourForRead: tourHelpers.normalizeTourForRead,
    normalizeTourForStorage: tourHelpers.normalizeTourForStorage,
    resolveLocalizedText: tourHelpers.resolveLocalizedText,
    setLocalizedTextForLang: tourHelpers.setLocalizedTextForLang,
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
    readCountryPracticalInfo: countryReferenceStore.readCountryPracticalInfo,
    nowIso: support.nowIso,
    randomUUID,
    persistTour: storeUtils.persistTour,
    repoRoot: runtime.paths.repoRoot,
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

  const travelPlanTemplateHandlers = createTravelPlanTemplateHandlers({
    readBodyJson: httpHelpers.readBodyJson,
    sendJson: httpHelpers.sendJson,
    readStore: storeUtils.readStore,
    readTravelPlanTemplates: storeUtils.readTravelPlanTemplates,
    persistTravelPlanTemplate: storeUtils.persistTravelPlanTemplate,
    deleteTravelPlanTemplate: storeUtils.deleteTravelPlanTemplate,
    getPrincipal,
    canReadTravelPlanTemplates,
    canEditTravelPlanTemplates,
    canAccessBooking: bookingViewHelpers.canAccessBooking,
    canEditBooking: bookingViewHelpers.canEditBooking,
    normalizeText: support.normalizeText,
    normalizeTourDestinationCode,
    normalizeTourStyleCode,
    nowIso: support.nowIso,
    randomUUID,
    buildTravelPlanTemplateReadModel: travelPlanTemplateHelpers.buildTravelPlanTemplateReadModel,
    normalizeTravelPlanTemplateForStorage: travelPlanTemplateHelpers.normalizeTravelPlanTemplateForStorage,
    cloneBookingTravelPlanAsTemplate: travelPlanTemplateHelpers.cloneBookingTravelPlanAsTemplate,
    cloneTemplateTravelPlanForBooking: travelPlanTemplateHelpers.cloneTemplateTravelPlanForBooking,
    normalizeTemplateTravelPlan: travelPlanTemplateHelpers.normalizeTemplateTravelPlan,
    validateBookingTravelPlanInput: travelPlanHelpers.validateBookingTravelPlanInput,
    normalizeBookingTravelPlan: travelPlanHelpers.normalizeBookingTravelPlan,
    assertExpectedRevision,
    buildBookingDetailResponse: bookingQueryModule.buildBookingDetailResponse,
    incrementBookingRevision,
    persistStore: storeUtils.persistStore,
    addActivity: bookingViewHelpers.addActivity,
    actorLabel: bookingViewHelpers.actorLabel
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
      ...countryReferenceHandlers,
      ...supplierHandlers,
      ...tourHandlers,
      ...travelPlanTemplateHandlers
    }
  });
}
