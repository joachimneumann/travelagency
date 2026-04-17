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
    canReadSettings,
    canReadTours,
    canEditTours,
    canReadCountryReferenceInfo,
    canEditCountryReferenceInfo,
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
    writePaymentDocumentPdf,
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

  async function handleGetSettingsObservability(req, res) {
    const principal = getPrincipal(req);
    if (!canReadSettings(principal)) {
      httpHelpers.sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const store = await storeUtils.readStore();
    const activeSessions = auth.listActiveSessions();
    const usersByKey = new Map();

    for (const session of activeSessions) {
      const key = support.normalizeText(session?.sub)
        || support.normalizeText(session?.preferred_username).toLowerCase()
        || support.normalizeText(session?.email).toLowerCase()
        || support.normalizeText(session?.sid);
      if (!key) continue;

      const previous = usersByKey.get(key);
      const mergedRoles = Array.from(new Set([
        ...(Array.isArray(previous?.roles) ? previous.roles : []),
        ...(Array.isArray(session?.roles) ? session.roles : [])
      ]));

      const createdAt = support.normalizeText(session?.created_at) || null;
      const expiresAt = support.normalizeText(session?.expires_at) || null;
      usersByKey.set(key, {
        sub: support.normalizeText(session?.sub) || null,
        preferred_username: support.normalizeText(session?.preferred_username) || null,
        name: support.normalizeText(session?.name) || null,
        email: support.normalizeText(session?.email) || null,
        roles: mergedRoles,
        session_count: Number(previous?.session_count || 0) + 1,
        latest_login_at: String(createdAt || "") > String(previous?.latest_login_at || "") ? createdAt : (previous?.latest_login_at || null),
        latest_expires_at: String(expiresAt || "") > String(previous?.latest_expires_at || "") ? expiresAt : (previous?.latest_expires_at || null)
      });
    }

    const loggedInUsers = Array.from(usersByKey.values())
      .sort((left, right) => {
        const rightStamp = String(right?.latest_login_at || "");
        const leftStamp = String(left?.latest_login_at || "");
        if (rightStamp !== leftStamp) return rightStamp.localeCompare(leftStamp);
        const rightLabel = support.normalizeText(right?.preferred_username || right?.email || right?.name || "");
        const leftLabel = support.normalizeText(left?.preferred_username || left?.email || left?.name || "");
        return leftLabel.localeCompare(rightLabel, "en", { sensitivity: "base" });
      });

    const bookings = Array.isArray(store?.bookings) ? [...store.bookings] : [];
    const latestBooking = bookings.sort(
      (left, right) => String(right?.updated_at || right?.created_at || "").localeCompare(String(left?.updated_at || left?.created_at || ""))
    )[0] || null;

    let latestChangedBooking = null;
    if (latestBooking) {
      const lastActivity = (Array.isArray(store?.activities) ? store.activities : [])
        .filter((activity) => support.normalizeText(activity?.booking_id) === support.normalizeText(latestBooking.id))
        .sort((left, right) => String(right?.created_at || "").localeCompare(String(left?.created_at || "")))[0] || null;

      latestChangedBooking = {
        id: support.normalizeText(latestBooking.id),
        name: support.normalizeText(latestBooking.name) || null,
        updated_at: support.normalizeText(latestBooking.updated_at || latestBooking.created_at) || null,
        assigned_keycloak_user_id: support.normalizeText(latestBooking.assigned_keycloak_user_id) || null,
        last_activity: lastActivity ? {
          type: support.normalizeText(lastActivity.type) || null,
          actor: support.normalizeText(lastActivity.actor) || null,
          detail: support.normalizeText(lastActivity.detail) || null,
          created_at: support.normalizeText(lastActivity.created_at) || null
        } : null
      };
    }

    httpHelpers.sendJson(res, 200, {
      logged_in_users: loggedInUsers,
      session_count: activeSessions.length,
      user_count: loggedInUsers.length,
      latest_changed_booking: latestChangedBooking
    });
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
    convertMinorUnits: pricingHelpers.convertMinorUnits,
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
    normalizePaymentDocumentComponents: pricingHelpers.normalizePaymentDocumentComponents,
    computePaymentDocumentComponentTotal: pricingHelpers.computePaymentDocumentComponentTotal,
    safeAmountCents: pricingHelpers.safeAmountCents,
    nextPaymentDocumentNumber: pricingHelpers.nextPaymentDocumentNumber,
    writePaymentDocumentPdf,
    writeGeneratedOfferPdf,
    writeTravelPlanPdf,
    listBookingTravelPlanPdfs: travelPlanPdfArtifacts.listBookingTravelPlanPdfs,
    persistBookingTravelPlanPdfArtifact: travelPlanPdfArtifacts.persistBookingTravelPlanPdfArtifact,
    resolveBookingTravelPlanPdfArtifact: travelPlanPdfArtifacts.resolveBookingTravelPlanPdfArtifact,
    updateBookingTravelPlanPdfArtifact: travelPlanPdfArtifacts.updateBookingTravelPlanPdfArtifact,
    deleteBookingTravelPlanPdfArtifact: travelPlanPdfArtifacts.deleteBookingTravelPlanPdfArtifact,
    randomUUID,
    paymentDocumentPdfPath: pricingHelpers.paymentDocumentPdfPath,
    generatedOfferPdfPath: pricingHelpers.generatedOfferPdfPath,
    gmailDraftsConfig: runtime.gmailDraftsConfig,
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
      handleProductionAccessCheck: auth.handleProductionAccessCheck,
      handleHealth: systemHandlers.handleHealth,
      handleMetaWebhookStatus: metaWebhookHandlers.handleMetaWebhookStatus,
      handleMetaWebhookVerify: metaWebhookHandlers.handleMetaWebhookVerify,
      handleMetaWebhookIngest: metaWebhookHandlers.handleMetaWebhookIngest,
      handleStagingAccessLoginPage: stagingAccessHandlers.handleStagingAccessLoginPage,
      handleStagingAccessLoginSubmit: stagingAccessHandlers.handleStagingAccessLoginSubmit,
      handleStagingAccessCheck: stagingAccessHandlers.handleStagingAccessCheck,
      handleStagingAccessLogout: stagingAccessHandlers.handleStagingAccessLogout,
      handleMobileBootstrap: systemHandlers.handleMobileBootstrap,
      handleGetSettingsObservability,
      ...bookingHandlers,
      ...atpStaffHandlers,
      ...keycloakUserHandlers,
      ...countryReferenceHandlers,
      ...tourHandlers,
      ...travelPlanTemplateHandlers
    }
  });
}
