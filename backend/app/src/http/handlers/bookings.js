import {
  getBookingPersons,
  normalizeBookingPersonsPayload
} from "../../lib/booking_persons.js";
import { normalizeBookingContentLang } from "../../domain/booking_content_i18n.js";
import {
  isSuspiciousSentinelString,
  resolveBookingNameForStorage
} from "../../domain/booking_names.js";
import { normalizePdfLang } from "../../lib/pdf_i18n.js";
import { createGeneratedOfferArtifactHelpers } from "../../domain/generated_offer_artifacts.js";
import {
  ensureGeneratedOfferAcceptanceTokenState,
  synchronizeGeneratedOfferAcceptanceRouteStatus
} from "../../domain/offer_acceptance.js";
import { normalizeTourStyleLabels } from "../../domain/tour_catalog_i18n.js";
import { createBookingQueryModule } from "./booking_query.js";
import { createBookingChatHandlers } from "./booking_chat.js";
import { createBookingCoreHandlers } from "./booking_core.js";
import { createBookingFinanceHandlers } from "./booking_finance.js";
import { createBookingOfferAcceptanceHandlers } from "./booking_offer_acceptance.js";
import { createBookingMediaHandlers } from "./booking_media.js";
import { createBookingInvoiceHandlers } from "./booking_invoices.js";
import { createBookingPeopleHandlers } from "./booking_people.js";
import { createBookingTravelerDetailsHandlers } from "./booking_traveler_details.js";
import { createBookingTravelPlanHandlers } from "./booking_travel_plan.js";

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
    STAGES,
    computeServiceLevelAgreementDueAt,
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
    STAGE_ORDER,
    ALLOWED_STAGE_TRANSITIONS,
    canChangeBookingStage,
    actorLabel,
    canChangeBookingAssignment,
    syncBookingAssignmentFields,
    getBookingAssignedKeycloakUserId,
    canEditBooking,
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
    offerAcceptanceTokenConfig,
    travelerDetailsTokenConfig,
    mkdir,
    path,
    execFile,
    TEMP_UPLOAD_DIR,
    GENERATED_OFFERS_DIR,
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
      if (ensureGeneratedOfferAcceptanceTokenState(generatedOffer, { now })) {
        changed = true;
      }
      if (synchronizeGeneratedOfferAcceptanceRouteStatus(generatedOffer, { now })) {
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
    const normalized = normalizeTourStyleLabels(normalizeStringArray(values), "en");
    return normalized.length ? normalized : normalizeStringArray(values);
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
    await execFile("magick", [
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
    await execFile("magick", [
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
      name: normalizeText(candidate.name) || null,
      stage: normalizeText(candidate.stage) || null
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
    store.offer_acceptance_challenges = Array.isArray(store.offer_acceptance_challenges)
      ? store.offer_acceptance_challenges.filter((challenge) => normalizeText(challenge.booking_id) !== bookingId)
      : [];

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
    await rm(path.join(GENERATED_OFFERS_DIR, `travel-plan-${bookingId}.pdf`), { force: true }).catch(() => {});
    await rm(path.join(GENERATED_OFFERS_DIR, "travel-plan-pdfs", bookingId), { recursive: true, force: true }).catch(() => {});
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
    handlePostBookingMilestoneAction,
    handlePatchBookingName,
    handlePatchBookingCustomerLanguage,
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
    canChangeBookingStage,
    canChangeBookingAssignment,
    canAccessBooking,
    normalizeText,
    nowIso,
    safeInt,
    STAGE_ORDER,
    ALLOWED_STAGE_TRANSITIONS,
    STAGES,
    computeServiceLevelAgreementDueAt,
    addActivity,
    actorLabel,
    persistStore,
    listAssignableKeycloakUsers,
    keycloakDisplayName,
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
    handleSearchTravelPlanItems,
    handleImportTravelPlanItem,
    handleUploadTravelPlanItemImage,
    handleDeleteTravelPlanItemImage,
    handleReorderTravelPlanItemImages,
    handleGetTravelPlanAttachmentPdf,
    handleUploadTravelPlanAttachment,
    handleDeleteTravelPlanAttachment,
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
    handleTranslateBookingOfferFromEnglish,
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
    rm,
    canAccessBooking,
    sendFileWithCache,
    translateEntries,
    normalizeGeneratedOfferSnapshot,
    ensureFrozenGeneratedOfferPdf
  });

  const {
    handleGetPublicGeneratedOfferAccess,
    handleGetPublicGeneratedOfferPdf,
    handlePublicAcceptGeneratedOffer
  } = createBookingOfferAcceptanceHandlers({
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
    offerAcceptanceTokenConfig,
    getBookingContactProfile,
    getRequestIpAddress,
    normalizeGeneratedOfferSnapshot,
    ensureFrozenGeneratedOfferPdf,
    sendFileWithCache
  });

  const {
    handlePostBookingPersonTravelerDetailsLink,
    handleGetPublicTravelerDetailsAccess,
    handlePatchPublicTravelerDetails
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
    canEditBooking
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
    translateEntries
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

    const submission = {
      destinations: normalizeStringArray(payload.destinations),
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
      stage: STAGES.NEW,
      assigned_keycloak_user_id: null,
      service_level_agreement_due_at: computeServiceLevelAgreementDueAt(STAGES.NEW),
      destinations: submission.destinations,
      travel_styles: canonicalBookingTravelStyles(submission.travel_style),
      web_form_travel_month: submission.travel_month,
      travel_start_day: null,
      travel_end_day: null,
      number_of_travelers: submission.number_of_travelers,
      preferred_currency: preferredCurrency,
      notes: submission.notes,
      persons: [],
      travel_plan: defaultBookingTravelPlan(),
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
      visibleBookings.map((booking) => buildBookingPayload(booking, req))
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

  return {
    handleCreateBooking,
    handleListBookings,
    handleGetBooking,
    handleDeleteBooking,
    handleListBookingChatEvents,
    handlePublicBookingImage,
    handlePublicBookingPersonPhoto,
    handlePatchBookingName,
    handlePatchBookingCustomerLanguage,
    handleUploadBookingImage,
    handlePostBookingMilestoneAction,
    handlePatchBookingOwner,
    handleTranslateBookingFields,
    handleCreateBookingPerson,
    handlePatchBookingPerson,
    handleDeleteBookingPerson,
    handleSearchTravelPlanItems,
    handleImportTravelPlanItem,
    handleUploadTravelPlanItemImage,
    handleDeleteTravelPlanItemImage,
    handleReorderTravelPlanItemImages,
    handleGetTravelPlanAttachmentPdf,
    handleUploadTravelPlanAttachment,
    handleDeleteTravelPlanAttachment,
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
    handleTranslateBookingOfferFromEnglish,
    handleGenerateBookingOffer,
    handleGetPublicGeneratedOfferAccess,
    handleGetPublicGeneratedOfferPdf,
    handlePublicAcceptGeneratedOffer,
    handlePostBookingPersonTravelerDetailsLink,
    handleGetPublicTravelerDetailsAccess,
    handlePatchPublicTravelerDetails,
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
