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
import { cloneBookingForTesting } from "../../domain/booking_clone.js";
import { createGeneratedOfferArtifactHelpers } from "../../domain/generated_offer_artifacts.js";
import {
  ensureGeneratedOfferBookingConfirmationTokenState,
  synchronizeGeneratedOfferCustomerConfirmationFlowStatus
} from "../../domain/booking_confirmation.js";
import {
  normalizeTourDestinationCode,
  normalizeTourStyleCode,
  sortTourStyleCodes
} from "../../domain/tour_catalog_i18n.js";
import { createBookingQueryModule } from "./booking_query.js";
import { createBookingChatHandlers } from "./booking_chat.js";
import { createBookingCoreHandlers } from "./booking_core.js";
import { createBookingFinanceHandlers } from "./booking_finance.js";
import { createBookingConfirmationHandlers } from "./booking_confirmation.js";
import { createBookingMediaHandlers } from "./booking_media.js";
import { createBookingInvoiceHandlers } from "./booking_invoices.js";
import { createBookingPeopleHandlers } from "./booking_people.js";
import { createBookingTravelerDetailsHandlers } from "./booking_traveler_details.js";
import { createBookingTravelPlanHandlers } from "./booking_travel_plan.js";
import { enumValueSetFor } from "../../lib/generated_catalogs.js";

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
    readTours,
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
    defaultBookingPricing,
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
    ensureMetaChatCollections,
    clamp,
    isLikelyPhoneMatch,
    buildChatEventReadModel,
    getMetaConversationOpenUrl,
    actorLabel,
    canChangeBookingAssignment,
    syncBookingAssignmentFields,
    getBookingAssignedKeycloakUserId,
    canEditBooking,
    validateBookingPricingInput,
    convertBookingPricingToBaseCurrency,
    convertMinorUnits,
    normalizeBookingPricing,
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
    normalizeInvoiceComponents,
    computeInvoiceComponentTotal,
    safeAmountCents,
    nextInvoiceNumber,
    writeInvoicePdf,
    writeGeneratedOfferPdf,
    writeTravelPlanPdf,
    listBookingTravelPlanPdfs,
    persistBookingTravelPlanPdfArtifact,
    resolveBookingTravelPlanPdfArtifact,
    updateBookingTravelPlanPdfArtifact,
    deleteBookingTravelPlanPdfArtifact,
    randomUUID,
    invoicePdfPath,
    generatedOfferPdfPath,
    gmailDraftsConfig,
    bookingConfirmationTokenConfig,
    travelerDetailsTokenConfig,
    mkdir,
    path,
    execFile,
    TEMP_UPLOAD_DIR,
    GENERATED_OFFERS_DIR,
    TRAVEL_PLAN_PDFS_DIR,
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

  function syncBookingGeneratedOfferRouteStatuses(booking) {
    const generatedOffers = Array.isArray(booking?.generated_offers) ? booking.generated_offers : [];
    let changed = false;
    const now = nowIso();
    for (const generatedOffer of generatedOffers) {
      if (ensureGeneratedOfferBookingConfirmationTokenState(generatedOffer, { now })) {
        changed = true;
      }
      if (synchronizeGeneratedOfferCustomerConfirmationFlowStatus(generatedOffer, { now })) {
        changed = true;
      }
    }
    return changed;
  }

  function syncBookingPublicPortalState(booking) {
    return syncBookingGeneratedOfferRouteStatuses(booking);
  }

  function unique(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
  }

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
    getSubmittedContact,
    normalizePersonEmails,
    normalizePersonPhoneNumbers
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

  function getBookingConversationMatchValues(booking) {
    const persons = getBookingPersons(booking);
    const submitted = getSubmittedContact(booking);
    return {
      phones: unique(
        [
          submitted.phone_number,
          ...persons.flatMap((person) => normalizePersonPhoneNumbers(person))
        ].filter(Boolean)
      ),
      emails: unique(
        [
          submitted.email,
          ...persons.flatMap((person) => normalizePersonEmails(person))
        ].filter(Boolean)
      )
    };
  }

  function resolveCanonicalConversationBookingId(store, conversation, excludedBookingId = "") {
    const assignedBookingId = normalizeText(conversation?.booking_id);
    if (assignedBookingId && assignedBookingId !== normalizeText(excludedBookingId)) {
      const assignedBookingStillExists = (Array.isArray(store?.bookings) ? store.bookings : []).some(
        (booking) => normalizeText(booking.id) === assignedBookingId
      );
      if (assignedBookingStillExists) return assignedBookingId;
    }
    const channel = normalizeText(conversation.channel).toLowerCase();
    const externalContactId = normalizeText(conversation.external_contact_id);
    if (channel === "whatsapp" && externalContactId) {
      const matches = (Array.isArray(store?.bookings) ? store.bookings : [])
        .filter((booking) => normalizeText(booking.id) !== normalizeText(excludedBookingId))
        .filter((booking) => {
          const { phones } = getBookingConversationMatchValues(booking);
          return phones.some((phone) => isLikelyPhoneMatch(phone, externalContactId));
        })
        .sort((left, right) => String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || "")));
      return normalizeText(matches[0]?.id) || "";
    }
    const normalizedEmail = externalContactId.toLowerCase();
    const matches = (Array.isArray(store?.bookings) ? store.bookings : [])
      .filter((booking) => normalizeText(booking.id) !== normalizeText(excludedBookingId))
      .filter((booking) => {
        const { emails } = getBookingConversationMatchValues(booking);
        return emails.includes(normalizedEmail);
      })
      .sort((left, right) => String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || "")));
    return normalizeText(matches[0]?.id) || "";
  }

  function conversationMatchesBooking(store, conversation, bookingId) {
    return resolveCanonicalConversationBookingId(store, conversation) === normalizeText(bookingId);
  }

  function buildConversationRelatedBookings(store, conversation, bookingId) {
    const channel = normalizeText(conversation?.channel).toLowerCase();
    const externalContactId = normalizeText(conversation?.external_contact_id);
    if (!externalContactId) return [];

    const matches = (Array.isArray(store?.bookings) ? store.bookings : [])
      .filter((candidate) => normalizeText(candidate.id) !== normalizeText(bookingId))
      .filter((candidate) => {
        const { phones, emails } = getBookingConversationMatchValues(candidate);
        if (channel === "whatsapp") return phones.some((phone) => isLikelyPhoneMatch(phone, externalContactId));
        return emails.includes(externalContactId.toLowerCase());
      })
      .sort((left, right) => String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || "")));

    return matches.map((candidate) => ({
      booking_id: candidate.id,
      name: normalizeText(candidate.name) || null
    }));
  }

  async function deleteBookingArtifacts(store, bookingId) {
    const removedBooking = Array.isArray(store.bookings)
      ? store.bookings.find((booking) => booking.id === bookingId) || null
      : null;
    const removedInvoices = Array.isArray(store.invoices)
      ? store.invoices.filter((invoice) => invoice.booking_id === bookingId)
      : [];

    store.bookings = Array.isArray(store.bookings) ? store.bookings.filter((booking) => booking.id !== bookingId) : [];
    store.activities = Array.isArray(store.activities) ? store.activities.filter((activity) => activity.booking_id !== bookingId) : [];
    store.invoices = Array.isArray(store.invoices) ? store.invoices.filter((invoice) => invoice.booking_id !== bookingId) : [];

    ensureMetaChatCollections(store);
    for (const conversation of store.chat_conversations) {
      if (normalizeText(conversation.booking_id) === bookingId) {
        conversation.booking_id = resolveCanonicalConversationBookingId(store, conversation, bookingId) || null;
        conversation.updated_at = nowIso();
      }
    }

    await Promise.all(
      removedInvoices.map(async (invoice) => {
        try {
          await rm(invoicePdfPath(invoice.id, invoice.version), { force: true });
        } catch {
          // Ignore stale file cleanup failures.
        }
      })
    );

    await Promise.all(
      (Array.isArray(removedBooking?.generated_offers) ? removedBooking.generated_offers : []).map(async (generatedOffer) => {
        try {
          await rm(generatedOfferPdfPath(generatedOffer.id), { force: true });
        } catch {
          // Ignore stale file cleanup failures.
        }
      })
    );
    await rm(path.join(TRAVEL_PLAN_PDFS_DIR, bookingId), { recursive: true, force: true }).catch(() => {});
    await rm(path.join(BOOKING_TRAVEL_PLAN_ATTACHMENTS_DIR, bookingId), { recursive: true, force: true }).catch(() => {});
  }

  const { handleListBookingChatEvents } = createBookingChatHandlers({
    readStore,
    sendJson,
    getPrincipal,
    canAccessBooking,
    ensureMetaChatCollections,
    clamp,
    safeInt,
    conversationMatchesBooking,
    resolveCanonicalConversationBookingId,
    buildChatEventReadModel,
    buildConversationRelatedBookings,
    normalizeText,
    getMetaConversationOpenUrl
  });

  const {
    handlePublicBookingPersonPhoto,
    handlePublicBookingImage,
    handleUploadBookingImage,
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
    BOOKING_IMAGES_DIR,
    BOOKING_PERSON_PHOTOS_DIR,
    writeFile,
    rm,
    processBookingImageToWebp,
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
    getBookingPersons
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
    handleSearchTravelPlans,
    handleSearchTravelPlanDays,
    handleSearchTravelPlanServices,
    handleImportTravelPlan,
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
    getPrincipal,
    canEditBooking,
    canAccessBooking,
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
    mkdir
  });

  const {
    handlePatchBookingPricing,
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
    validateBookingPricingInput,
    convertBookingPricingToBaseCurrency,
    normalizeBookingPricing,
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
    handleGetPublicGeneratedOfferAccess,
    handleGetPublicGeneratedOfferPdf
  } = createBookingConfirmationHandlers({
    readBodyJson,
    sendJson,
    readStore,
    persistStore,
    normalizeText,
    normalizeBookingPricing,
    nowIso,
    addActivity,
    formatMoney,
    incrementBookingRevision,
    convertBookingPricingToBaseCurrency,
    randomUUID,
    gmailDraftsConfig,
    bookingConfirmationTokenConfig,
    getBookingContactProfile,
    getRequestIpAddress,
    normalizeGeneratedOfferSnapshot,
    ensureFrozenGeneratedOfferPdf,
    sendFileWithCache
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
    handleListBookingInvoices,
    handleCreateBookingInvoice,
    handlePatchBookingInvoice,
    handleTranslateBookingInvoiceFromEnglish,
    handleGetInvoicePdf
  } = createBookingInvoiceHandlers({
    readBodyJson,
    sendJson,
    readStore,
    getPrincipal,
    canAccessBooking,
    canEditBooking,
    assertExpectedRevision,
    normalizeInvoiceComponents,
    computeInvoiceComponentTotal,
    safeAmountCents,
    nextInvoiceNumber,
    safeCurrency,
    normalizeText,
    nowIso,
    writeInvoicePdf,
    randomUUID,
    addActivity,
    actorLabel,
    persistStore,
    buildBookingPayload,
    incrementBookingRevision,
    getBookingContactProfile,
    invoicePdfPath,
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

    const normalizedDestinations = normalizeCountryCodes(payload.destinations, normalizeText);
    const submission = {
      destinations: normalizedDestinations,
      travel_style: canonicalBookingTravelStyles(payload.travel_style),
      booking_name: initialBookingName,
      tour_id: normalizeText(payload.tour_id) || null,
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
      pricing_revision: 0,
      offer_revision: 0,
      invoices_revision: 0,
      assigned_keycloak_user_id: null,
      travel_styles: canonicalBookingTravelStyles(submission.travel_style),
      web_form_travel_month: submission.travel_month,
      travel_start_day: null,
      travel_end_day: null,
      number_of_travelers: submission.number_of_travelers,
      preferred_currency: preferredCurrency,
      notes: submission.notes,
      persons: [],
      travel_plan: {
        ...defaultBookingTravelPlan(),
        destinations: normalizedDestinations
      },
      web_form_submission: submission,
      pricing: defaultBookingPricing(),
      offer: defaultBookingOffer(preferredCurrency),
      generated_offers: [],
      idempotency_key: idempotencyKey || null,
      created_at: now,
      updated_at: now
    };

    const primaryContact = buildPrimaryContactFromSubmission(booking);
    booking.persons = primaryContact ? [primaryContact] : [];

    store.bookings.push(booking);
    addActivity(store, booking.id, "BOOKING_CREATED", "public_api", "Booking created from website form");
    await persistStore(store);

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
      pricing_revision: 0,
      offer_revision: 0,
      invoices_revision: 0,
      assigned_keycloak_user_id: normalizeText(principal?.sub) || null,
      travel_styles: canonicalBookingTravelStyles(payload?.travel_styles),
      web_form_travel_month: null,
      travel_start_day: null,
      travel_end_day: null,
      number_of_travelers: travelerCount,
      preferred_currency: preferredCurrency,
      notes: "",
      persons: [],
      travel_plan: {
        ...defaultBookingTravelPlan(),
        destinations: normalizeCountryCodes(payload?.destinations, normalizeText)
      },
      pricing: defaultBookingPricing(),
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
    const visible = await Promise.all(
      visibleBookings.map((booking) => buildBookingPayload(booking, { req, listMode: true }))
    );
    const paged = paginate(visible, requestUrl.searchParams);
    sendJson(res, 200, buildPaginatedListResponse(paged, { filters, sort }));
  }

  async function handleGetBooking(req, res, [bookingId]) {
    const store = await readStore();
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

    if (syncBookingPublicPortalState(booking)) {
      await persistStore(store);
    }

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handleDeleteBooking(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }

    const principal = getPrincipal(req);
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_core_revision", "core_revision", res))) return;

    await deleteBookingArtifacts(store, bookingId);
    await persistStore(store);
    sendJson(res, 200, { deleted: true, booking_id: bookingId });
  }

  async function handleCloneBooking(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const nextName = normalizeText(payload?.name);
    if (!nextName) {
      sendJson(res, 422, { error: "name is required" });
      return;
    }

    const store = await readStore();
    const sourceBooking = store.bookings.find((item) => item.id === bookingId);
    if (!sourceBooking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }

    const principal = getPrincipal(req);
    if (!canEditBooking(principal, sourceBooking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, sourceBooking, "expected_core_revision", "core_revision", res))) return;

    const clonedBooking = cloneBookingForTesting(sourceBooking, {
      randomUUID,
      nowIso,
      name: nextName,
      includeTravelers: payload?.include_travelers === true
    });

    store.bookings.push(clonedBooking);
    addActivity(
      store,
      clonedBooking.id,
      "BOOKING_CREATED",
      actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      `Cloned from ${sourceBooking.id}`
    );
    await persistStore(store);

    sendJson(res, 201, await buildBookingDetailResponse(clonedBooking, req));
  }

  return {
    handleCreateBooking,
    handleCreateBackendBooking,
    handleListBookings,
    handleGetBooking,
    handleDeleteBooking,
    handleCloneBooking,
    handleListBookingChatEvents,
    handlePublicBookingImage,
    handlePublicBookingPersonPhoto,
    handlePatchBookingName,
    handlePatchBookingCustomerLanguage,
    handlePatchBookingSource,
    handleUploadBookingImage,
    handlePatchBookingOwner,
    handleTranslateBookingFields,
    handleCreateBookingPerson,
    handlePatchBookingPerson,
    handleDeleteBookingPerson,
    handleSearchTravelPlans,
    handleSearchTravelPlanDays,
    handleSearchTravelPlanServices,
    handleImportTravelPlan,
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
    handlePatchBookingPricing,
    handlePatchBookingOffer,
    handleGenerateBookingOffer,
    handleGetPublicGeneratedOfferAccess,
    handleGetPublicGeneratedOfferPdf,
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
    handleListBookingInvoices,
    handleCreateBookingInvoice,
    handlePatchBookingInvoice,
    handleTranslateBookingInvoiceFromEnglish,
    handleGetInvoicePdf
  };
}
