import {
  getBookingPersons,
  normalizeBookingPersonsPayload
} from "../../lib/booking_persons.js";
import { execImageMagick } from "../../lib/imagemagick.js";
import {
  normalizeBookingContentLang
} from "../../domain/booking_content_i18n.js";
import {
  isSuspiciousSentinelString,
  resolveBookingNameForStorage
} from "../../domain/booking_names.js";
import { normalizePdfLang } from "../../lib/pdf_i18n.js";
import { createBookingNotificationEmailService } from "../../lib/booking_notification_email.js";
import { createGeneratedOfferArtifactHelpers } from "../../domain/generated_offer_artifacts.js";
import {
  normalizeTourDestinationCode,
  normalizeTourStyleCode,
  sortTourStyleCodes
} from "../../domain/tour_catalog_i18n.js";
import { createBookingQueryModule } from "./booking_query.js";
import { createBookingCoreHandlers } from "./booking_core.js";
import { createBookingFinanceHandlers } from "./booking_finance.js";
import { createBookingMediaHandlers } from "./booking_media.js";
import { createBookingPaymentDocumentHandlers } from "./booking_payment_documents.js";
import { createBookingPeopleHandlers } from "./booking_people.js";
import { createBookingTravelerDetailsHandlers } from "./booking_traveler_details.js";
import { createBookingTravelPlanHandlers } from "./booking_travel_plan.js";
import { enumValueSetFor } from "../../lib/generated_catalogs.js";
import { createMarketingTourBookingTravelPlanCloner } from "./marketing_tour_booking_travel_plan.js";
import {
  DESTINATION_COUNTRY_CODES
} from "../../../../../shared/js/destination_country_codes.js";
import {
  deriveDestinationScopeFromTravelPlanLocations,
  destinationScopeDestinations
} from "../../domain/destination_scope.js";

const COUNTRY_CODE_SET = enumValueSetFor("CountryCode");
const DESTINATION_COUNTRY_CODE_BY_TOUR_CODE = Object.freeze({
  vietnam: "VN",
  thailand: "TH",
  cambodia: "KH",
  laos: "LA"
});

function normalizeCountryCodes(items, normalizeText) {
  return Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => {
          const normalized = normalizeText(item);
          if (!normalized) return "";
          const directCode = normalized.toUpperCase();
          if (COUNTRY_CODE_SET.has(directCode)) return directCode;
          const tourCode = normalizeTourDestinationCode(normalized);
          return DESTINATION_COUNTRY_CODE_BY_TOUR_CODE[tourCode] || directCode;
        })
        .filter((item) => item && COUNTRY_CODE_SET.has(item))
    )
  );
}

export function createBookingHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    validateBookingInput,
    readStore,
    readRawStore = readStore,
    readTours,
    readCountryPracticalInfo,
    normalizeTourForStorage,
    normalizeMarketingTourTravelPlan,
    tourDestinationCodes,
    normalizeText,
    normalizeStringArray,
    getRequestIpAddress,
    guessCountryFromRequest,
    normalizeEmail,
    normalizePhone,
    nowIso,
    safeCurrency,
    BASE_CURRENCY,
    safeInt,
    defaultBookingOffer,
    defaultBookingTravelPlan,
    addActivity,
    persistStore,
    getPrincipal,
    listAssignableKeycloakUsers,
    keycloakDisplayName,
    canReadAllBookings,
    canAccessBooking,
    buildBookingReadModel,
    paginate,
    buildPaginatedListResponse,
    actorLabel,
    canChangeBookingAssignment,
    syncBookingAssignmentFields,
    getBookingAssignedKeycloakUserId,
    canEditBooking,
    convertMinorUnits,
    validateBookingOfferInput,
    convertBookingOfferToBaseCurrency,
    normalizeBookingOffer,
    buildVisiblePricingProjection,
    normalizeBookingTravelPlan,
    buildBookingOfferPaymentTermsReadModel,
    buildBookingOfferReadModel,
    buildBookingTravelPlanReadModel,
    validateBookingTravelPlanInput,
    validateOfferExchangeRequest,
    resolveExchangeRateWithFallback,
    convertOfferLineAmountForCurrency,
    formatMoney,
    normalizePaymentDocumentComponents,
    computePaymentDocumentComponentTotal,
    safeAmountCents,
    nextPaymentDocumentNumber,
    writePaymentDocumentPdf,
    writeGeneratedOfferPdf,
    writeTravelPlanPdf,
    listBookingTravelPlanPdfs,
    persistBookingTravelPlanPdfArtifact,
    resolveBookingTravelPlanPdfArtifact,
    updateBookingTravelPlanPdfArtifact,
    deleteBookingTravelPlanPdfArtifact,
    randomUUID,
    paymentDocumentPdfPath,
    generatedOfferPdfPath,
    gmailDraftsConfig,
    bookingNotificationEmailConfig,
    travelerDetailsTokenConfig,
    mkdir,
    path,
    execFile,
    TEMP_UPLOAD_DIR,
    TOURS_DIR,
    GENERATED_OFFERS_DIR,
    TRAVEL_PLAN_PDF_PREVIEW_DIR,
    BOOKING_IMAGES_DIR,
    BOOKING_PERSON_PHOTOS_DIR,
    BOOKING_TRAVEL_PLAN_ATTACHMENTS_DIR,
    writeFile,
    rm,
    sendFileWithCache,
    translateEntries,
    resolveLocalizedTourText
  } = deps;

  const bookingNotificationEmail = createBookingNotificationEmailService({
    config: bookingNotificationEmailConfig
  });

  function canonicalBookingTravelStyles(values) {
    return sortTourStyleCodes(
      normalizeStringArray(values)
        .map((value) => normalizeTourStyleCode(value))
        .filter(Boolean)
    );
  }

  async function resolveSubmittedBookingName(payload) {
    return resolveBookingNameForStorage({
      bookingName: payload?.booking_name,
      tourId: payload?.tour_id,
      preferredLanguage: payload?.preferred_language,
      normalizeText,
      readTours,
      resolveLocalizedTourText
    });
  }

  function resolveBookingPersonPhotoDiskPath(rawRelativePath) {
    const relativePath = normalizeText(rawRelativePath).replace(/^\/+/, "");
    if (!relativePath) return null;
    const absolutePath = path.resolve(BOOKING_PERSON_PHOTOS_DIR, relativePath);
    if (!absolutePath.startsWith(path.resolve(BOOKING_PERSON_PHOTOS_DIR) + path.sep)) return null;
    return absolutePath;
  }

  function resolveBookingImageDiskPath(rawRelativePath) {
    const relativePath = normalizeText(rawRelativePath).replace(/^\/+/, "");
    if (!relativePath) return null;
    const absolutePath = path.resolve(BOOKING_IMAGES_DIR, relativePath);
    if (!absolutePath.startsWith(path.resolve(BOOKING_IMAGES_DIR) + path.sep)) return null;
    return absolutePath;
  }

  async function processBookingImageToWebp(inputPath, outputPath) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await execImageMagick(execFile, [
      inputPath,
      "-auto-orient",
      "-resize",
      "1000x1000>",
      "-strip",
      "-quality",
      "82",
      outputPath
    ]);
  }

  const marketingTourBookingTravelPlanCloner = createMarketingTourBookingTravelPlanCloner({
    normalizeText,
    normalizeMarketingTourTravelPlan,
    tourDestinationCodes,
    randomUUID,
    nowIso,
    processTourServiceImageToWebp: processBookingImageToWebp,
    bookingImagesDir: BOOKING_IMAGES_DIR,
    toursDir: TOURS_DIR,
    path,
    logPrefix: "public-booking-tour"
  });

  function defaultInitialBookingTravelPlan() {
    return {
      ...defaultBookingTravelPlan()
    };
  }

  function normalizeCustomTourSelectedDays(value, fallbackTourId = "") {
    const normalizedFallbackTourId = normalizeText(fallbackTourId);
    return (Array.isArray(value) ? value : [])
      .map((item) => {
        const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
        const sourceTourId = normalizeText(source.source_tour_id) || normalizedFallbackTourId;
        const sourceDayId = normalizeText(source.source_day_id);
        return sourceTourId && sourceDayId
          ? { source_tour_id: sourceTourId, source_day_id: sourceDayId }
          : null;
      })
      .filter(Boolean);
  }

  function normalizeSubmittedCustomTour(value, fallbackBaseTourId = "") {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : null;
    if (!source) return null;
    const baseTourId = normalizeText(source.base_tour_id || source.tour_id || fallbackBaseTourId);
    const selectedDays = normalizeCustomTourSelectedDays(source.selected_days, baseTourId);
    if (!baseTourId || !selectedDays.length) return null;
    const schemaVersion = safeInt(source.schema_version || 1);
    const title = normalizeText(source.title);
    return {
      schema_version: Number.isInteger(schemaVersion) && schemaVersion > 0 ? schemaVersion : 1,
      base_tour_id: baseTourId,
      ...(title ? { title } : {}),
      selected_days: selectedDays
    };
  }

  function destinationCountryCodeFromTourValue(value) {
    const normalized = normalizeText(value);
    if (!normalized) return "";
    const directCode = normalized.toUpperCase();
    if (DESTINATION_COUNTRY_CODES.includes(directCode)) return directCode;
    const tourCode = normalizeTourDestinationCode(normalized);
    return DESTINATION_COUNTRY_CODE_BY_TOUR_CODE[tourCode] || "";
  }

  function tourCountryCodesFromTour(tour, destinationCatalogStore = {}) {
    return Array.from(
      new Set(
        [
          ...destinationScopeDestinations(deriveDestinationScopeFromTravelPlanLocations(tour?.travel_plan, destinationCatalogStore)),
          ...tourDestinationCodes(tour),
          ...normalizeStringArray(tour?.destination_codes),
          ...normalizeStringArray(tour?.destinations)
        ]
          .map(destinationCountryCodeFromTourValue)
          .filter((code) => DESTINATION_COUNTRY_CODES.includes(code))
      )
    );
  }

  async function publishedPublicWebpageCountryCodes() {
    const publishedCountryCodes = new Set(DESTINATION_COUNTRY_CODES);
    if (typeof readCountryPracticalInfo !== "function") return publishedCountryCodes;
    const countryReferencePayload = await readCountryPracticalInfo();
    for (const item of Array.isArray(countryReferencePayload?.items) ? countryReferencePayload.items : []) {
      const countryCode = normalizeText(item?.country).toUpperCase();
      if (!countryCode) continue;
      if (item?.published_on_webpage === false) publishedCountryCodes.delete(countryCode);
      else publishedCountryCodes.add(countryCode);
    }
    return publishedCountryCodes;
  }

  async function canSeedSubmittedTourFromPublicForm(tour, destinationCatalogStore = {}) {
    const tourCountryCodes = tourCountryCodesFromTour(tour, destinationCatalogStore);
    if (!tourCountryCodes.length) return false;
    const publishedCountryCodes = await publishedPublicWebpageCountryCodes();
    return tourCountryCodes.some((countryCode) => publishedCountryCodes.has(countryCode));
  }

  function sourceDaysByIdForCustomTour(tour) {
    const normalizedTravelPlan = normalizeMarketingTourTravelPlan(tour?.travel_plan, {
      sourceLang: "en",
      contentLang: "en",
      flatLang: "en"
    });
    return new Map((Array.isArray(normalizedTravelPlan?.days) ? normalizedTravelPlan.days : [])
      .map((day) => [normalizeText(day?.id), day])
      .filter(([dayId]) => Boolean(dayId)));
  }

  async function buildInitialTravelPlanFromSubmittedCustomTour(customTour, booking, destinationCatalogStore) {
    const normalizedCustomTour = normalizeSubmittedCustomTour(
      customTour,
      booking?.web_form_submission?.tour_id
    );
    if (!normalizedCustomTour) return null;

    const bookingId = normalizeText(booking?.id);
    let tours = [];
    try {
      tours = (await readTours()).map((item) => normalizeTourForStorage(item));
    } catch (error) {
      console.warn("[public-booking-tour] Could not read marketing tours for custom submission.", {
        base_tour_id: normalizedCustomTour.base_tour_id,
        booking_id: bookingId,
        error: String(error?.message || error)
      });
      return null;
    }

    const toursById = new Map(tours.map((tour) => [normalizeText(tour?.id), tour]).filter(([tourId]) => Boolean(tourId)));
    const baseTour = toursById.get(normalizedCustomTour.base_tour_id);
    if (!baseTour) return null;

    try {
      if (!(await canSeedSubmittedTourFromPublicForm(baseTour, destinationCatalogStore))) {
        return null;
      }
    } catch (error) {
      console.warn("[public-booking-tour] Could not verify submitted custom tour publication state.", {
        base_tour_id: normalizedCustomTour.base_tour_id,
        booking_id: bookingId,
        error: String(error?.message || error)
      });
      return null;
    }

    const sourceCaches = new Map();
    const selectedSourceDays = [];
    for (const selection of normalizedCustomTour.selected_days) {
      const sourceTourId = normalizeText(selection.source_tour_id);
      const sourceDayId = normalizeText(selection.source_day_id);
      const sourceTour = toursById.get(sourceTourId);
      if (!sourceTour) return null;
      try {
        if (!(await canSeedSubmittedTourFromPublicForm(sourceTour, destinationCatalogStore))) {
          return null;
        }
      } catch (error) {
        console.warn("[public-booking-tour] Could not verify submitted custom day source publication state.", {
          source_tour_id: sourceTourId,
          source_day_id: sourceDayId,
          booking_id: bookingId,
          error: String(error?.message || error)
        });
        return null;
      }
      if (!sourceCaches.has(sourceTourId)) {
        sourceCaches.set(sourceTourId, sourceDaysByIdForCustomTour(sourceTour));
      }
      const sourceDay = sourceCaches.get(sourceTourId).get(sourceDayId);
      if (!sourceDay) return null;
      selectedSourceDays.push({ sourceTourId, sourceDay });
    }
    if (!selectedSourceDays.length) return null;

    const createdAt = nowIso();
    let days = [];
    try {
      days = await Promise.all(selectedSourceDays.map(({ sourceTourId, sourceDay }, dayIndex) => (
        marketingTourBookingTravelPlanCloner.cloneMarketingTourDayForBooking(sourceDay, {
          dayIndex,
          tourId: sourceTourId,
          bookingId,
          createdAt
        })
      )));
    } catch (error) {
      console.warn("[public-booking-tour] Could not clone submitted custom tour travel plan.", {
        base_tour_id: normalizedCustomTour.base_tour_id,
        booking_id: bookingId,
        error: String(error?.message || error)
      });
      return null;
    }

    const nextTravelPlan = {
      days,
      attachments: []
    };
    const check = validateBookingTravelPlanInput(nextTravelPlan, booking.offer);
    if (!check.ok) {
      console.warn("[public-booking-tour] Submitted custom tour travel plan was invalid for booking.", {
        base_tour_id: normalizedCustomTour.base_tour_id,
        booking_id: bookingId,
        error: check.error
      });
      return null;
    }

    return check.travel_plan;
  }

  async function buildInitialTravelPlanFromSubmittedTour(tourId, booking, destinationCatalogStore) {
    const normalizedTourId = normalizeText(tourId);
    if (!normalizedTourId) return defaultInitialBookingTravelPlan();

    let tour = null;
    try {
      const tours = (await readTours()).map((item) => normalizeTourForStorage(item));
      tour = tours.find((item) => item.id === normalizedTourId) || null;
    } catch (error) {
      console.warn("[public-booking-tour] Could not read submitted marketing tour.", {
        tour_id: normalizedTourId,
        booking_id: booking?.id,
        error: String(error?.message || error)
      });
      return defaultInitialBookingTravelPlan();
    }

    if (!tour) return defaultInitialBookingTravelPlan();

    try {
      if (!(await canSeedSubmittedTourFromPublicForm(tour, destinationCatalogStore))) {
        return defaultInitialBookingTravelPlan();
      }
    } catch (error) {
      console.warn("[public-booking-tour] Could not verify submitted marketing tour publication state.", {
        tour_id: normalizedTourId,
        booking_id: booking?.id,
        error: String(error?.message || error)
      });
      return defaultInitialBookingTravelPlan();
    }

    let nextTravelPlan;
    try {
      nextTravelPlan = await marketingTourBookingTravelPlanCloner.cloneMarketingTourTravelPlanForBooking(tour, booking);
    } catch (error) {
      console.warn("[public-booking-tour] Could not clone submitted marketing tour travel plan.", {
        tour_id: normalizedTourId,
        booking_id: booking?.id,
        error: String(error?.message || error)
      });
      return defaultInitialBookingTravelPlan();
    }

    const check = validateBookingTravelPlanInput(nextTravelPlan, booking.offer);
    if (!check.ok) {
      console.warn("[public-booking-tour] Submitted marketing tour travel plan was invalid for booking.", {
        tour_id: normalizedTourId,
        booking_id: booking?.id,
        error: check.error
      });
      return defaultInitialBookingTravelPlan();
    }

    return check.travel_plan;
  }

  async function processBookingPersonImageToWebp(inputPath, outputPath) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await execImageMagick(execFile, [
      inputPath,
      "-auto-orient",
      "-resize",
      "1000x1000>",
      "-strip",
      "-quality",
      "82",
      outputPath
    ]);
  }

  function buildPrimaryContactFromSubmission(booking) {
    const submitted = getSubmittedContact(booking);
    if (!submitted.name && !submitted.email && !submitted.phone_number) return null;
    return {
      id: `${normalizeText(booking?.id) || "booking"}_primary_contact`,
      name: submitted.name || "Primary contact",
      emails: submitted.email ? [submitted.email] : [],
      phone_numbers: submitted.phone_number ? [submitted.phone_number] : [],
      preferred_language: submitted.preferred_language || null,
      roles: ["primary_contact", "traveler"]
    };
  }

  function buildPrimaryContactFromManualCreate({
    bookingId,
    name,
    email,
    phoneNumber,
    preferredLanguage
  }) {
    const contactName = normalizeText(name);
    const contactEmail = normalizeEmail(email);
    const contactPhoneNumber = normalizePhone(phoneNumber);
    if (!contactName && !contactEmail && !contactPhoneNumber) return null;
    return {
      id: `${normalizeText(bookingId) || "booking"}_primary_contact`,
      name: contactName || "Primary contact",
      emails: contactEmail ? [contactEmail] : [],
      phone_numbers: contactPhoneNumber ? [contactPhoneNumber] : [],
      preferred_language: preferredLanguage || null,
      roles: ["primary_contact", "traveler"]
    };
  }

  function validateBackendBookingInput(payload) {
    const title = normalizeText(payload?.name);
    if (!title) {
      return { ok: false, error: "name is required" };
    }
    if (isSuspiciousSentinelString(title, normalizeText)) {
      return { ok: false, error: "Invalid name" };
    }

    if (!normalizeText(payload?.preferred_language)) {
      return { ok: false, error: "preferred_language is required" };
    }
    if (!normalizeText(payload?.preferred_currency)) {
      return { ok: false, error: "preferred_currency is required" };
    }

    const primaryContactName = normalizeText(payload?.primary_contact_name);
    if (primaryContactName && isSuspiciousSentinelString(primaryContactName, normalizeText)) {
      return { ok: false, error: "Invalid primary_contact_name" };
    }

    if (normalizeText(payload?.primary_contact_email) && !normalizeEmail(payload?.primary_contact_email)) {
      return { ok: false, error: "Invalid primary_contact_email" };
    }
    if (normalizeText(payload?.primary_contact_phone_number) && !normalizePhone(payload?.primary_contact_phone_number)) {
      return { ok: false, error: "Invalid primary_contact_phone_number" };
    }

    const travelers = payload?.number_of_travelers === undefined || payload?.number_of_travelers === null || payload?.number_of_travelers === ""
      ? null
      : safeInt(payload.number_of_travelers);
    if (travelers !== null && (!Number.isInteger(travelers) || travelers < 1 || travelers > 30)) {
      return { ok: false, error: "number_of_travelers must be between 1 and 30" };
    }

    return { ok: true };
  }

  function getBookingRevision(booking, field) {
    const value = Number(booking?.[field]);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  }

  function incrementBookingRevision(booking, field) {
    booking[field] = getBookingRevision(booking, field) + 1;
  }

  const queryModule = createBookingQueryModule({
    buildBookingReadModel,
    normalizeText,
    normalizeStringArray,
    normalizeEmail,
    normalizePhone,
    safeCurrency,
    BASE_CURRENCY,
    getBookingAssignedKeycloakUserId
  });
  const {
    buildBookingDetailResponse,
    buildBookingPayload,
    filterBookings,
    getBookingContactProfile,
    getSubmittedContact
  } = queryModule;

  const {
    normalizeGeneratedOfferSnapshot,
    ensureFrozenGeneratedOfferPdf
  } = createGeneratedOfferArtifactHelpers({
    baseCurrency: BASE_CURRENCY,
    normalizeText,
    normalizePdfLang,
    nowIso,
    normalizeBookingOffer,
    buildVisiblePricingProjection,
    buildBookingOfferPaymentTermsReadModel,
    normalizeBookingTravelPlan,
    generatedOfferPdfPath,
    writeGeneratedOfferPdf,
    persistStore
  });

  async function assertExpectedRevision(req, payload, booking, payloadField, revisionField, res) {
    const rawExpected = payload?.[payloadField];
    const expectedRevision = rawExpected === undefined || rawExpected === null || rawExpected === ""
      ? null
      : safeInt(rawExpected);
    const currentRevision = getBookingRevision(booking, revisionField);
    if (expectedRevision === null || expectedRevision !== currentRevision) {
      sendJson(res, 409, {
        error: "Booking changed in backend",
        detail: "The booking has changed in the backend. The data has been refreshed. Your changes are lost. Please do them again.",
        code: "BOOKING_REVISION_MISMATCH",
        booking: await buildBookingPayload(booking, req)
      });
      return false;
    }
    return true;
  }

  const {
    handlePublicBookingPersonPhoto,
    handlePublicBookingImage,
    handleUploadBookingPersonPhoto,
    handleUploadBookingPersonDocumentPicture
  } = createBookingMediaHandlers({
    readBodyJson,
    sendJson,
    normalizeText,
    getPrincipal,
    readStore,
    canEditBooking,
    assertExpectedRevision,
    path,
    randomUUID,
    TEMP_UPLOAD_DIR,
    BOOKING_PERSON_PHOTOS_DIR,
    writeFile,
    rm,
    processBookingPersonImageToWebp,
    nowIso,
    addActivity,
    actorLabel,
    persistStore,
    buildBookingDetailResponse,
    incrementBookingRevision,
    resolveBookingImageDiskPath,
    resolveBookingPersonPhotoDiskPath,
    sendFileWithCache,
    getBookingPersons,
    travelerDetailsTokenConfig
  });

  const {
    handlePatchBookingName,
    handlePatchBookingCustomerLanguage,
    handlePatchBookingSource,
    handlePatchBookingOwner,
    handlePatchBookingNotes,
    handleListActivities,
    handleCreateActivity,
    handleTranslateBookingFields
  } = createBookingCoreHandlers({
    readBodyJson,
    sendJson,
    readStore,
    readRawStore,
    getPrincipal,
    canEditBooking,
    canChangeBookingAssignment,
    canAccessBooking,
    normalizeText,
    nowIso,
    addActivity,
    actorLabel,
    persistStore,
    listAssignableKeycloakUsers,
    keycloakDisplayName,
    normalizeStringArray,
    canonicalBookingTravelStyles,
    syncBookingAssignmentFields,
    assertExpectedRevision,
    buildBookingDetailResponse,
    buildBookingPayload,
    incrementBookingRevision,
    translateEntries
  });

  const {
    handleCreateBookingPerson,
    handlePatchBookingPerson,
    handleDeleteBookingPerson
  } = createBookingPeopleHandlers({
    readBodyJson,
    sendJson,
    readStore,
    getPrincipal,
    canEditBooking,
    normalizeText,
    nowIso,
    addActivity,
    actorLabel,
    persistStore,
    assertExpectedRevision,
    buildBookingDetailResponse,
    incrementBookingRevision
  });

  const {
    handleImportTravelPlanDay,
    handleImportTravelPlanService,
    handleUploadTravelPlanServiceImage,
    handleDeleteTravelPlanServiceImage,
    handleGetTravelPlanAttachmentPdf,
    handleUploadTravelPlanAttachment,
    handleDeleteTravelPlanAttachment,
    handlePostBookingTravelPlanPdf,
    handleGetBookingTravelPlanPdfArtifact,
    handlePatchBookingTravelPlanPdfArtifact,
    handleDeleteBookingTravelPlanPdfArtifact,
    handlePatchBookingTravelPlan,
    handleGetBookingTravelPlanPdf,
    handleTranslateBookingTravelPlanFromEnglish
  } = createBookingTravelPlanHandlers({
    readBodyJson,
    sendJson,
    readStore,
    readTours,
    getPrincipal,
    canEditBooking,
    canAccessBooking,
    normalizeTourForStorage,
    normalizeMarketingTourTravelPlan,
    normalizeText,
    nowIso,
    addActivity,
    actorLabel,
    persistStore,
    assertExpectedRevision,
    buildBookingDetailResponse,
    incrementBookingRevision,
    validateBookingTravelPlanInput,
    normalizeBookingTravelPlan,
    buildBookingTravelPlanReadModel,
    writeTravelPlanPdf,
    listBookingTravelPlanPdfs,
    persistBookingTravelPlanPdfArtifact,
    resolveBookingTravelPlanPdfArtifact,
    updateBookingTravelPlanPdfArtifact,
    deleteBookingTravelPlanPdfArtifact,
    sendFileWithCache,
    translateEntries,
    path,
    randomUUID,
    generatedOfferPdfPath,
    TEMP_UPLOAD_DIR,
    TRAVEL_PLAN_PDF_PREVIEW_DIR,
    BOOKING_IMAGES_DIR,
    BOOKING_TRAVEL_PLAN_ATTACHMENTS_DIR,
    writeFile,
    rm,
    processBookingImageToWebp,
    mkdir,
    marketingTourBookingTravelPlanCloner
  });

  const {
    handlePatchBookingOffer,
    handlePostOfferExchangeRates,
    handleGenerateBookingOffer,
    handleGetGeneratedOfferPdf,
    handleCreateGeneratedOfferGmailDraft,
    handlePatchGeneratedBookingOffer,
    handleDeleteGeneratedBookingOffer
  } = createBookingFinanceHandlers({
    readBodyJson,
    sendJson,
    readStore,
    getPrincipal,
    canEditBooking,
    normalizeText,
    getRequestIpAddress,
    nowIso,
    BASE_CURRENCY,
    addActivity,
    actorLabel,
    persistStore,
    assertExpectedRevision,
    buildBookingDetailResponse,
    incrementBookingRevision,
    validateBookingOfferInput,
    convertBookingOfferToBaseCurrency,
    normalizeBookingOffer,
    normalizeBookingTravelPlan,
    buildBookingOfferPaymentTermsReadModel,
    buildBookingOfferReadModel,
    buildBookingTravelPlanReadModel,
    formatMoney,
    validateOfferExchangeRequest,
    resolveExchangeRateWithFallback,
    convertOfferLineAmountForCurrency,
    randomUUID,
    generatedOfferPdfPath,
    gmailDraftsConfig,
    getBookingContactProfile,
    listBookingTravelPlanPdfs,
    rm,
    canAccessBooking,
    sendFileWithCache,
    translateEntries,
    normalizeGeneratedOfferSnapshot,
    ensureFrozenGeneratedOfferPdf,
    path,
    TEMP_UPLOAD_DIR
  });

  const {
    handlePostBookingPersonTravelerDetailsLink,
    handleGetPublicTravelerDetailsAccess,
    handlePatchPublicTravelerDetails,
    handleUploadPublicTravelerDocumentPicture
  } = createBookingTravelerDetailsHandlers({
    readBodyJson,
    sendJson,
    readStore,
    persistStore,
    normalizeText,
    nowIso,
    addActivity,
    incrementBookingRevision,
    travelerDetailsTokenConfig,
    getPrincipal,
    canEditBooking,
    path,
    randomUUID,
    TEMP_UPLOAD_DIR,
    BOOKING_PERSON_PHOTOS_DIR,
    writeFile,
    rm,
    processBookingPersonImageToWebp,
    getBookingPersons
  });

  const {
    handleListBookingPaymentDocuments,
    handleCreateBookingPaymentDocument,
    handleGetPaymentDocumentPdf
  } = createBookingPaymentDocumentHandlers({
    readBodyJson,
    sendJson,
    readStore,
    readRawStore,
    getPrincipal,
    canAccessBooking,
    canEditBooking,
    assertExpectedRevision,
    normalizePaymentDocumentComponents,
    computePaymentDocumentComponentTotal,
    safeAmountCents,
    nextPaymentDocumentNumber,
    safeCurrency,
    normalizeText,
    nowIso,
    writePaymentDocumentPdf,
    randomUUID,
    addActivity,
    actorLabel,
    persistStore,
    buildBookingPayload,
    incrementBookingRevision,
    getBookingContactProfile,
    paymentDocumentPdfPath,
    sendFileWithCache,
    translateEntries,
    BASE_CURRENCY,
    normalizeGeneratedOfferSnapshot,
    normalizeBookingOffer,
    normalizeBookingTravelPlan,
    buildBookingOfferPaymentTermsReadModel,
    listBookingTravelPlanPdfs,
    convertMinorUnits,
    path,
    TEMP_UPLOAD_DIR,
    rm,
    mkdir
  });

  async function handleCreateBooking(req, res) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const check = validateBookingInput(payload);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    const store = await readStore();
    const idempotencyKey = normalizeText(req.headers["idempotency-key"]);
    if (idempotencyKey) {
      const existingByKey = store.bookings.find((booking) => booking.idempotency_key === idempotencyKey);
      if (existingByKey) {
        sendJson(res, 200, await buildBookingDetailResponse(existingByKey));
        return;
      }
    }

    const now = nowIso();
    const ipAddress = getRequestIpAddress(req);
    const ipCountryGuess = guessCountryFromRequest(req, ipAddress);
    const inputPhoneNumber = normalizePhone(payload.phone_number);
    const inputPreferredLanguage = normalizeText(payload.preferred_language)
      ? normalizeBookingContentLang(payload.preferred_language)
      : null;
    const preferredCurrency = safeCurrency(payload.preferred_currency || BASE_CURRENCY);
    const budgetLowerUsd = normalizeText(payload.budget_lower_usd) ? safeInt(payload.budget_lower_usd) : null;
    const budgetUpperUsd = normalizeText(payload.budget_upper_usd) ? safeInt(payload.budget_upper_usd) : null;
    const travelDurationMin = normalizeText(payload.travel_duration_days_min) ? safeInt(payload.travel_duration_days_min) : null;
    const travelDurationMax = normalizeText(payload.travel_duration_days_max) ? safeInt(payload.travel_duration_days_max) : null;
    const bookingId = `booking_${randomUUID()}`;

    const initialBookingName = await resolveSubmittedBookingName(payload);
    if (
      isSuspiciousSentinelString(payload.booking_name, normalizeText) &&
      !initialBookingName
    ) {
      sendJson(res, 422, { error: "Invalid booking_name" });
      return;
    }

    const submittedTourId = normalizeText(payload.tour_id) || null;
    const submittedCustomTour = normalizeSubmittedCustomTour(payload.custom_tour, submittedTourId);
    const submission = {
      travel_style: canonicalBookingTravelStyles(payload.travel_style),
      booking_name: initialBookingName,
      tour_id: submittedTourId,
      custom_tour: submittedCustomTour,
      page_url: normalizeText(payload.page_url),
      ip_address: ipAddress || null,
      ip_country_guess: ipCountryGuess || null,
      referrer: normalizeText(payload.referrer),
      utm_source: normalizeText(payload.utm_source),
      utm_medium: normalizeText(payload.utm_medium),
      utm_campaign: normalizeText(payload.utm_campaign),
      travel_month: normalizeText(payload.travel_month) || null,
      number_of_travelers: normalizeText(payload.number_of_travelers) ? safeInt(payload.number_of_travelers) : null,
      preferred_currency: preferredCurrency,
      travel_duration_days_min: travelDurationMin,
      travel_duration_days_max: travelDurationMax,
      name: normalizeText(payload.name) || null,
      email: normalizeEmail(payload.email) || null,
      phone_number: inputPhoneNumber || null,
      budget_lower_usd: Number.isInteger(budgetLowerUsd) ? budgetLowerUsd : null,
      budget_upper_usd: Number.isInteger(budgetUpperUsd) ? budgetUpperUsd : null,
      preferred_language: inputPreferredLanguage || null,
      notes: normalizeText(payload.notes) || null,
      submitted_at: now
    };

    const booking = {
      id: bookingId,
      customer_language: inputPreferredLanguage || "en",
      name: initialBookingName,
      core_revision: 0,
      notes_revision: 0,
      persons_revision: 0,
      travel_plan_revision: 0,
      offer_revision: 0,
      payment_documents_revision: 0,
      assigned_keycloak_user_id: null,
      travel_styles: canonicalBookingTravelStyles(submission.travel_style),
      web_form_travel_month: submission.travel_month,
      travel_start_day: null,
      travel_end_day: null,
      number_of_travelers: submission.number_of_travelers,
      preferred_currency: preferredCurrency,
      notes: submission.notes,
      persons: [],
      travel_plan: defaultInitialBookingTravelPlan(),
      web_form_submission: submission,
      offer: defaultBookingOffer(preferredCurrency),
      generated_offers: [],
      idempotency_key: idempotencyKey || null,
      created_at: now,
      updated_at: now
    };

    booking.travel_plan = await buildInitialTravelPlanFromSubmittedCustomTour(
      submission.custom_tour,
      booking,
      store
    ) || await buildInitialTravelPlanFromSubmittedTour(
      submission.tour_id,
      booking,
      store
    );

    const primaryContact = buildPrimaryContactFromSubmission(booking);
    booking.persons = primaryContact ? [primaryContact] : [];

    store.bookings.push(booking);
    addActivity(store, booking.id, "BOOKING_CREATED", "public_api", "Booking created from website form");
    await persistStore(store);
    void bookingNotificationEmail.notifyBookingCreated(booking);

    sendJson(res, 201, await buildBookingDetailResponse(booking, req));
  }

  async function handleCreateBackendBooking(req, res) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const check = validateBackendBookingInput(payload);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    const principal = getPrincipal(req);
    const canCreateBooking = canReadAllBookings(principal)
      || (Array.isArray(principal?.roles) && principal.roles.includes("atp_staff") && normalizeText(principal?.sub));
    if (!canCreateBooking) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const now = nowIso();
    const bookingId = `booking_${randomUUID()}`;
    const preferredLanguage = normalizeBookingContentLang(payload?.preferred_language);
    const preferredCurrency = safeCurrency(payload?.preferred_currency || BASE_CURRENCY);
    const travelerCount = payload?.number_of_travelers === undefined || payload?.number_of_travelers === null || payload?.number_of_travelers === ""
      ? null
      : safeInt(payload.number_of_travelers);
    const booking = {
      id: bookingId,
      customer_language: preferredLanguage,
      name: normalizeText(payload?.name),
      core_revision: 0,
      notes_revision: 0,
      persons_revision: 0,
      travel_plan_revision: 0,
      offer_revision: 0,
      payment_documents_revision: 0,
      assigned_keycloak_user_id: normalizeText(principal?.sub) || null,
      travel_styles: canonicalBookingTravelStyles(payload?.travel_styles),
      web_form_travel_month: null,
      travel_start_day: null,
      travel_end_day: null,
      number_of_travelers: travelerCount,
      preferred_currency: preferredCurrency,
      notes: "",
      persons: [],
      travel_plan: defaultBookingTravelPlan(),
      offer: defaultBookingOffer(preferredCurrency),
      generated_offers: [],
      created_at: now,
      updated_at: now
    };

    const primaryContact = buildPrimaryContactFromManualCreate({
      bookingId,
      name: payload?.primary_contact_name,
      email: payload?.primary_contact_email,
      phoneNumber: payload?.primary_contact_phone_number,
      preferredLanguage
    });
    if (primaryContact) {
      booking.persons = [primaryContact];
    }

    const store = await readStore();
    store.bookings.push(booking);
    addActivity(
      store,
      booking.id,
      "BOOKING_CREATED",
      actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      "Booking created in backend"
    );
    await persistStore(store);

    sendJson(res, 201, await buildBookingDetailResponse(booking, req));
  }

  async function handleListBookings(req, res) {
    const store = await readStore();
    const principal = getPrincipal(req);
    if (!canReadAllBookings(principal) && !(Array.isArray(principal?.roles) && principal.roles.includes("atp_staff") && normalizeText(principal?.sub))) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const requestUrl = new URL(req.url, "http://localhost");
    const { items: filtered, filters, sort } = filterBookings(store, requestUrl.searchParams);
    const visibleBookings = filtered.filter((booking) => canAccessBooking(principal, booking));
    const pagedBookings = paginate(visibleBookings, requestUrl.searchParams);
    const visible = await Promise.all(
      pagedBookings.items.map((booking) => buildBookingPayload(booking, { req, listMode: true }))
    );
    sendJson(res, 200, buildPaginatedListResponse({
      ...pagedBookings,
      items: visible
    }, { filters, sort }));
  }

  async function handleGetBooking(req, res, [bookingId]) {
    const store = await readRawStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }

    const principal = getPrincipal(req);
    if (!canAccessBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  return {
    handleCreateBooking,
    handleCreateBackendBooking,
    handleListBookings,
    handleGetBooking,
    handlePublicBookingImage,
    handlePublicBookingPersonPhoto,
    handlePatchBookingName,
    handlePatchBookingCustomerLanguage,
    handlePatchBookingSource,
    handlePatchBookingOwner,
    handleTranslateBookingFields,
    handleCreateBookingPerson,
    handlePatchBookingPerson,
    handleDeleteBookingPerson,
    handleImportTravelPlanDay,
    handleImportTravelPlanService,
    handleUploadTravelPlanServiceImage,
    handleDeleteTravelPlanServiceImage,
    handleGetTravelPlanAttachmentPdf,
    handleUploadTravelPlanAttachment,
    handleDeleteTravelPlanAttachment,
    handlePostBookingTravelPlanPdf,
    handleGetBookingTravelPlanPdfArtifact,
    handlePatchBookingTravelPlanPdfArtifact,
    handleDeleteBookingTravelPlanPdfArtifact,
    handlePatchBookingTravelPlan,
    handleGetBookingTravelPlanPdf,
    handleTranslateBookingTravelPlanFromEnglish,
    handleUploadBookingPersonPhoto,
    handleUploadBookingPersonDocumentPicture,
    handlePatchBookingNotes,
    handlePatchBookingOffer,
    handleGenerateBookingOffer,
    handlePostBookingPersonTravelerDetailsLink,
    handleGetPublicTravelerDetailsAccess,
    handlePatchPublicTravelerDetails,
    handleUploadPublicTravelerDocumentPicture,
    handlePatchGeneratedBookingOffer,
    handleDeleteGeneratedBookingOffer,
    handleGetGeneratedOfferPdf,
    handleCreateGeneratedOfferGmailDraft,
    handlePostOfferExchangeRates,
    handleListActivities,
    handleCreateActivity,
    handleListBookingPaymentDocuments,
    handleCreateBookingPaymentDocument,
    handleGetPaymentDocumentPdf
  };
}
