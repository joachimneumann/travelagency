import {
  validateBookingGenerateOfferRequest,
  validateBookingOfferTranslateRequest
} from "../../../Generated/API/generated_APIModels.js";
import { readFile } from "node:fs/promises";
import { createGmailDraftsClient } from "../../lib/gmail_drafts.js";
import { normalizePdfLang, pdfT } from "../../lib/pdf_i18n.js";
import {
  normalizeGeneratedOfferCustomerConfirmationFlowMode,
  ensureGeneratedOfferBookingConfirmationTokenState,
  buildBookingConfirmationStatement,
  buildBookingConfirmationTermsSnapshot,
  BOOKING_CONFIRMATION_TERMS_VERSION,
  buildGeneratedOfferSnapshotHash
} from "../../domain/booking_confirmation.js";
import {
  mergeEditableLocalizedTextField,
  mergeLocalizedTextField,
  normalizeBookingContentLang,
  normalizeBookingSourceLang
} from "../../domain/booking_content_i18n.js";
import {
  markOfferTranslationManual,
  translateOfferFromSourceLanguage
} from "../../domain/booking_translation.js";
import { freezeAcceptedCommercialRecord } from "../../domain/accepted_record.js";

export function createBookingFinanceHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    getPrincipal,
    canEditBooking,
    normalizeText,
    nowIso,
    BASE_CURRENCY,
    addActivity,
    actorLabel,
    persistStore,
    assertExpectedRevision,
    buildBookingDetailResponse,
    incrementBookingRevision,
    computeServiceLevelAgreementDueAt,
    validateBookingPricingInput,
    convertBookingPricingToBaseCurrency,
    normalizeBookingPricing,
    validateBookingOfferInput,
    convertBookingOfferToBaseCurrency,
    normalizeBookingOffer,
    normalizeBookingTravelPlan,
    buildBookingOfferPaymentTermsReadModel,
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
    ensureFrozenGeneratedOfferPdf
  } = deps;

  let gmailDraftsClient = null;

  function getGmailDraftsClient() {
    const serviceAccountJsonPath = normalizeText(gmailDraftsConfig?.serviceAccountJsonPath);
    const impersonatedEmail = normalizeText(gmailDraftsConfig?.impersonatedEmail);
    if (!serviceAccountJsonPath || !impersonatedEmail) {
      throw new Error("Gmail draft creation is not configured.");
    }
    if (!gmailDraftsClient) {
      gmailDraftsClient = createGmailDraftsClient({
        serviceAccountJsonPath,
        impersonatedEmail
      });
    }
    return gmailDraftsClient;
  }

  function buildGeneratedOfferEmailDraftCopy(booking, generatedOfferSnapshot, contact) {
    const lang = normalizePdfLang(generatedOfferSnapshot?.lang || booking?.customer_language || "en");
    const contactName = normalizeText(contact?.name);
    const bookingTitle = normalizeText(booking?.name || booking?.web_form_submission?.booking_name);
    return {
      lang,
      subject: pdfT(lang, "email.offer_subject", "Your Asia Travel Plan offer"),
      greeting: contactName
        ? pdfT(lang, "email.greeting_named", "Hello {name},", { name: contactName })
        : pdfT(lang, "email.greeting_generic", "Hello,"),
      intro: bookingTitle
        ? pdfT(lang, "email.offer_intro_named", "Please find attached the current Asia Travel Plan offer for {trip}.", { trip: bookingTitle })
        : pdfT(lang, "email.offer_intro_generic", "Please find attached your current Asia Travel Plan offer."),
      footer: `${pdfT(lang, "offer.closing_regards", "Warm regards,")}\n${pdfT(lang, "offer.closing_team", "The Asia Travel Plan Team")}`
    };
  }

  function requestContentLang(req, payload = null) {
    try {
      const requestUrl = new URL(req.url, "http://localhost");
      return normalizeBookingContentLang(
        payload?.content_lang
        || payload?.lang
        || requestUrl.searchParams.get("content_lang")
        || requestUrl.searchParams.get("lang")
        || "en"
      );
    } catch {
      return normalizeBookingContentLang(payload?.content_lang || payload?.lang || "en");
    }
  }

  function requestSourceLang(req, payload = null, fallback = "en") {
    try {
      const requestUrl = new URL(req.url, "http://localhost");
      return normalizeBookingSourceLang(
        payload?.source_lang
        || requestUrl.searchParams.get("source_lang")
        || fallback
        || "en"
      );
    } catch {
      return normalizeBookingSourceLang(payload?.source_lang || fallback || "en");
    }
  }

  function mergeOfferForLang(existingOffer, nextOffer, lang, preferredCurrency, sourceLang = "en") {
    const normalizedLang = normalizeBookingContentLang(lang);
    const normalizedSourceLang = normalizeBookingSourceLang(sourceLang);
    const nextNormalized = normalizeBookingOffer(nextOffer, preferredCurrency, {
      contentLang: normalizedLang,
      flatLang: normalizedLang,
      sourceLang: normalizedSourceLang
    });
    return nextNormalized;
  }

  function sendTranslationError(res, error) {
    if (error?.code === "TRANSLATION_NOT_CONFIGURED") {
      sendJson(res, 503, { error: String(error.message || "Translation provider is not configured.") });
      return;
    }
    if (error?.code === "TRANSLATION_SOURCE_LANGUAGE") {
      sendJson(res, 422, { error: String(error.message || "The source language cannot be auto-translated.") });
      return;
    }
    if (error?.code === "TRANSLATION_INVALID_RESPONSE" || error?.code === "TRANSLATION_REQUEST_FAILED") {
      sendJson(res, 502, { error: String(error.message || "Translation request failed.") });
      return;
    }
    sendJson(res, 500, { error: String(error?.message || error || "Translation failed.") });
  }

  function resolveGeneratedOfferBookingConfirmationPaymentLine(paymentTerms, requestedLineId = "") {
    const lines = Array.isArray(paymentTerms?.lines) ? paymentTerms.lines : [];
    if (!lines.length) {
      throw new Error("Deposit payment acceptance requires at least one payment term line.");
    }
    const normalizedRequestedLineId = normalizeText(requestedLineId);
    if (normalizedRequestedLineId) {
      const explicitLine = lines.find((line) => normalizeText(line?.id) === normalizedRequestedLineId);
      if (!explicitLine) {
        throw new Error("Selected acceptance payment term line was not found.");
      }
      return explicitLine;
    }
    return lines.find((line) => normalizeText(line?.kind).toUpperCase() === "DEPOSIT") || lines[0];
  }

  function buildGeneratedOfferCustomerConfirmationFlow({ generatedOffer, booking, offerSnapshot, payload, principal, now }) {
    const requestedFlow = payload?.customer_confirmation_flow && typeof payload.customer_confirmation_flow === "object"
      ? payload.customer_confirmation_flow
      : null;
    const paymentTerms = offerSnapshot?.payment_terms || null;
    const hasPaymentTermLines = Array.isArray(paymentTerms?.lines) && paymentTerms.lines.length > 0;
    const mode = requestedFlow
      ? normalizeGeneratedOfferCustomerConfirmationFlowMode(requestedFlow.mode)
      : (hasPaymentTermLines ? "DEPOSIT_PAYMENT" : "");
    const selectedByATPStaffId = normalizeText(
      principal?.sub
      || principal?.preferred_username
      || payload?.actor
      || booking?.assigned_keycloak_user_id
      || "keycloak_user"
    ) || "keycloak_user";
    const expiresAt = normalizeText(requestedFlow?.expires_at) || "";
    const customerMessageSnapshot = normalizeText(requestedFlow?.customer_message_snapshot);

    if (!mode) {
      return null;
    }

    if (mode === "DEPOSIT_PAYMENT") {
      const acceptanceLine = resolveGeneratedOfferBookingConfirmationPaymentLine(
        paymentTerms,
        requestedFlow?.deposit_rule?.payment_term_line_id
      );
      return {
        mode,
        status: "AWAITING_PAYMENT",
        selected_at: now,
        selected_by_atp_staff_id: selectedByATPStaffId,
        ...(expiresAt ? { expires_at: expiresAt } : {}),
        ...(customerMessageSnapshot ? { customer_message_snapshot: customerMessageSnapshot } : {}),
        deposit_rule: {
          payment_term_line_id: normalizeText(acceptanceLine?.id),
          payment_term_label: normalizeText(acceptanceLine?.label) || "Deposit",
          required_amount_cents: Math.max(0, Math.round(Number(acceptanceLine?.resolved_amount_cents || 0))),
          currency: normalizeText(paymentTerms?.currency || offerSnapshot?.currency || generatedOffer?.currency || BASE_CURRENCY).toUpperCase() || BASE_CURRENCY,
          aggregation_mode: "SUM_LINKED_PAID_PAYMENTS"
        }
      };
    }

    throw new Error("Invalid generated customer confirmation flow.");
  }

  function resolveGeneratedOfferManagementApprover(booking) {
    const approverId = normalizeText(
      booking?.assigned_keycloak_user_id
      || booking?.assigned_atp_staff?.id
      || booking?.assigned_atp_staff?.username
    );
    const approverLabel = normalizeText(
      booking?.assigned_atp_staff?.full_name
      || booking?.assigned_keycloak_user_label
      || booking?.assigned_atp_staff?.username
    );
    return {
      approverId: approverId || null,
      approverLabel: approverLabel || approverId || null
    };
  }

  function toDateOnly(value) {
    const normalized = normalizeText(value);
    if (!normalized) return null;
    const directMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
    if (directMatch) return directMatch[1];
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  function shiftDateOnly(value, days) {
    const baseDate = toDateOnly(value);
    if (!baseDate) return null;
    const parsed = new Date(`${baseDate}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setUTCDate(parsed.getUTCDate() + (Number.isFinite(Number(days)) ? Math.round(Number(days)) : 0));
    return parsed.toISOString().slice(0, 10);
  }

  function resolveAcceptedOfferPaymentDueDate(line, booking, acceptedAt) {
    const dueRule = line?.due_rule && typeof line.due_rule === "object" ? line.due_rule : {};
    const dueType = normalizeText(dueRule.type).toUpperCase();
    const days = Number.isFinite(Number(dueRule.days)) ? Number(dueRule.days) : 0;

    if (dueType === "FIXED_DATE") return toDateOnly(dueRule.fixed_date);
    if (dueType === "DAYS_AFTER_ACCEPTANCE") return shiftDateOnly(acceptedAt, days);
    if (dueType === "DAYS_BEFORE_TRIP_START") return shiftDateOnly(booking?.travel_start_day, -days);
    if (dueType === "DAYS_AFTER_TRIP_START") return shiftDateOnly(booking?.travel_start_day, days);
    if (dueType === "DAYS_AFTER_TRIP_END") return shiftDateOnly(booking?.travel_end_day, days);
    return toDateOnly(acceptedAt);
  }

  function buildAcceptedOfferSeedPricing({ booking, normalizedSnapshot, acceptedAt }) {
    const paymentTerms = normalizedSnapshot?.payment_terms;
    const lines = Array.isArray(paymentTerms?.lines) ? paymentTerms.lines : [];
    if (!lines.length) return null;

    return {
      currency: normalizeText(paymentTerms?.currency || normalizedSnapshot?.currency) || "USD",
      agreed_net_amount_cents: Math.max(0, Math.round(Number(normalizedSnapshot?.total_price_cents || 0))),
      adjustments: [],
      payments: lines.map((line, index) => {
        const label = normalizeText(line?.label) || `Payment ${index + 1}`;
        const dueDate = resolveAcceptedOfferPaymentDueDate(line, booking, acceptedAt);
        const notes = normalizeText(line?.description);
        return {
          id: `pricing_payment_${randomUUID()}`,
          label,
          ...(dueDate ? { due_date: dueDate } : {}),
          net_amount_cents: Math.max(0, Math.round(Number(line?.resolved_amount_cents || 0))),
          tax_rate_basis_points: 0,
          status: "PENDING",
          paid_at: null,
          ...(notes ? { notes } : {})
        };
      })
    };
  }

  async function seedAcceptedOfferPricing({ booking, normalizedSnapshot, acceptedAt }) {
    const seedPricing = buildAcceptedOfferSeedPricing({ booking, normalizedSnapshot, acceptedAt });
    if (!seedPricing) return false;

    const currentPricing = await convertBookingPricingToBaseCurrency(booking?.pricing || {});
    if (Array.isArray(currentPricing?.payments) && currentPricing.payments.length > 0) {
      return false;
    }

    const convertedSeedPricing = await convertBookingPricingToBaseCurrency(seedPricing);
    const nextPricing = normalizeBookingPricing({
      ...currentPricing,
      currency: convertedSeedPricing.currency,
      agreed_net_amount_cents: Number(currentPricing?.agreed_net_amount_cents || 0) > 0
        ? currentPricing.agreed_net_amount_cents
        : convertedSeedPricing.agreed_net_amount_cents,
      payments: convertedSeedPricing.payments
    });

    if (JSON.stringify(nextPricing) === JSON.stringify(currentPricing)) {
      return false;
    }

    booking.pricing = nextPricing;
    incrementBookingRevision(booking, "pricing_revision");
    return true;
  }

  async function finalizeManagementGeneratedOfferConfirmation({ req, payload, store, booking, generatedOffer, principal }) {
    if (normalizeText(booking?.confirmed_generated_offer_id) && normalizeText(booking.confirmed_generated_offer_id) !== generatedOffer.id) {
      return { ok: false, status: 409, error: "Another generated offer has already been confirmed for this booking." };
    }

    if (generatedOffer?.booking_confirmation && typeof generatedOffer.booking_confirmation === "object") {
      if (!normalizeText(booking?.confirmed_generated_offer_id)) {
        booking.confirmed_generated_offer_id = generatedOffer.id;
        await persistStore(store);
      }
      return { ok: true, bookingConfirmation: generatedOffer.booking_confirmation, unchanged: true };
    }

    const approverId = normalizeText(generatedOffer?.management_approver_atp_staff_id);
    const approverLabel = normalizeText(generatedOffer?.management_approver_label);
    if (!approverId || !approverLabel) {
      return { ok: false, status: 422, error: "This generated offer has no management approver assigned." };
    }
    if (normalizeText(principal?.sub) !== approverId) {
      return { ok: false, status: 403, error: "Only the assigned management approver can confirm this booking." };
    }

    const normalizedSnapshot = normalizeGeneratedOfferSnapshot(generatedOffer, booking);
    const frozenPdf = await ensureFrozenGeneratedOfferPdf(generatedOffer, booking, { store });
    const bookingConfirmation = {
      id: `booking_confirmation_${randomUUID()}`,
      accepted_at: nowIso(),
      accepted_by_name: approverLabel,
      language: normalizePdfLang(normalizedSnapshot.lang || booking?.customer_language || "en"),
      method: "MANAGEMENT",
      management_approver_atp_staff_id: approverId,
      statement_snapshot: buildBookingConfirmationStatement({
        bookingName: normalizeText(booking?.name || booking?.web_form_submission?.booking_name),
        formattedTotal: formatMoney(normalizedSnapshot.total_price_cents, normalizedSnapshot.currency)
      }),
      terms_version: BOOKING_CONFIRMATION_TERMS_VERSION,
      terms_snapshot: buildBookingConfirmationTermsSnapshot(),
      offer_currency: normalizedSnapshot.currency,
      offer_total_price_cents: Number(normalizedSnapshot.total_price_cents || 0),
      offer_pdf_sha256: normalizeText(generatedOffer?.pdf_sha256 || frozenPdf?.sha256),
      offer_snapshot_sha256: buildGeneratedOfferSnapshotHash(normalizedSnapshot)
    };

    generatedOffer.booking_confirmation = bookingConfirmation;
    if (generatedOffer?.customer_confirmation_flow && typeof generatedOffer.customer_confirmation_flow === "object") {
      generatedOffer.customer_confirmation_flow.status = "CONFIRMED";
    }
    booking.confirmed_generated_offer_id = generatedOffer.id;
    await seedAcceptedOfferPricing({
      booking,
      normalizedSnapshot,
      acceptedAt: bookingConfirmation.accepted_at
    });
    booking.offer_revision = (Number.isInteger(Number(booking.offer_revision)) ? Number(booking.offer_revision) : 0) + 1;
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "BOOKING_CONFIRMED",
      actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      `Booking confirmed by management approver ${approverLabel}`
    );
    await persistStore(store);
    return { ok: true, bookingConfirmation, unchanged: false };
  }

  async function handlePatchBookingPricing(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_pricing_revision", "pricing_revision", res))) return;

    const check = validateBookingPricingInput(payload.pricing);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    const depositReceiptPayload = payload?.deposit_receipt && typeof payload.deposit_receipt === "object"
      ? payload.deposit_receipt
      : null;
    const depositReceiptDraftPayload = payload?.deposit_receipt_draft && typeof payload.deposit_receipt_draft === "object"
      ? payload.deposit_receipt_draft
      : null;
    const normalizedDepositReceipt = depositReceiptPayload
      ? {
        deposit_received_at: normalizeText(depositReceiptPayload?.deposit_received_at),
        deposit_confirmed_by_atp_staff_id: normalizeText(depositReceiptPayload?.deposit_confirmed_by_atp_staff_id),
        deposit_reference: normalizeText(depositReceiptPayload?.deposit_reference)
      }
      : null;
    const normalizedDepositReceiptDraft = depositReceiptDraftPayload
      ? {
        deposit_received_at: normalizeText(depositReceiptDraftPayload?.deposit_received_at),
        deposit_confirmed_by_atp_staff_id: normalizeText(depositReceiptDraftPayload?.deposit_confirmed_by_atp_staff_id),
        deposit_reference: normalizeText(depositReceiptDraftPayload?.deposit_reference)
      }
      : null;
    if (normalizedDepositReceipt) {
      if (!normalizedDepositReceipt.deposit_received_at) {
        sendJson(res, 422, { error: "deposit_receipt.deposit_received_at is required." });
        return;
      }
      if (!normalizedDepositReceipt.deposit_confirmed_by_atp_staff_id) {
        sendJson(res, 422, { error: "deposit_receipt.deposit_confirmed_by_atp_staff_id is required." });
        return;
      }
    }

    const nextPricingBase = await convertBookingPricingToBaseCurrency(check.pricing);
    const nextPricingJson = JSON.stringify(nextPricingBase);
    const currentPricingJson = JSON.stringify(normalizeBookingPricing(booking.pricing));
    const pricingChanged = nextPricingJson !== currentPricingJson;
    const acceptedRecordAvailable = Boolean(
      booking?.accepted_offer_snapshot
      && booking?.accepted_payment_terms_snapshot
      && Number.isFinite(Number(booking?.accepted_deposit_amount_cents))
      && normalizeText(booking?.accepted_deposit_currency)
    );
    const depositReceiptUnchanged = !normalizedDepositReceipt || (
      normalizeText(booking?.deposit_received_at) === normalizedDepositReceipt.deposit_received_at
      && normalizeText(booking?.deposit_confirmed_by_atp_staff_id) === normalizedDepositReceipt.deposit_confirmed_by_atp_staff_id
      && normalizeText(booking?.accepted_deposit_reference) === normalizedDepositReceipt.deposit_reference
      && acceptedRecordAvailable
    );
    const depositReceiptDraftUnchanged = !normalizedDepositReceiptDraft || (
      normalizeText(booking?.deposit_receipt_draft_received_at) === normalizedDepositReceiptDraft.deposit_received_at
      && normalizeText(booking?.deposit_receipt_draft_confirmed_by_atp_staff_id) === normalizedDepositReceiptDraft.deposit_confirmed_by_atp_staff_id
      && normalizeText(booking?.deposit_receipt_draft_reference) === normalizedDepositReceiptDraft.deposit_reference
    );
    if (!pricingChanged && depositReceiptUnchanged && depositReceiptDraftUnchanged) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking, req)), unchanged: true });
      return;
    }

    let receiptUpdate = null;
    if (normalizedDepositReceipt) {
      try {
        receiptUpdate = await freezeAcceptedCommercialRecord(booking, {
          now: nowIso(),
          depositReceivedAt: normalizedDepositReceipt.deposit_received_at,
          depositConfirmedByAtpStaffId: normalizedDepositReceipt.deposit_confirmed_by_atp_staff_id,
          depositReference: normalizedDepositReceipt.deposit_reference,
          baseCurrency: BASE_CURRENCY,
          normalizeGeneratedOfferSnapshot,
          normalizeBookingOffer,
          normalizeBookingTravelPlan,
          buildBookingOfferPaymentTermsReadModel,
          listBookingTravelPlanPdfs,
          computeServiceLevelAgreementDueAt
        });
      } catch (error) {
        sendJson(res, 422, { error: String(error?.message || error) });
        return;
      }
    }
    const draftChanged = Boolean(normalizedDepositReceiptDraft) && (
      normalizeText(booking?.deposit_receipt_draft_received_at) !== normalizedDepositReceiptDraft.deposit_received_at
      || normalizeText(booking?.deposit_receipt_draft_confirmed_by_atp_staff_id) !== normalizedDepositReceiptDraft.deposit_confirmed_by_atp_staff_id
      || normalizeText(booking?.deposit_receipt_draft_reference) !== normalizedDepositReceiptDraft.deposit_reference
    );

    booking.pricing = nextPricingBase;
    if (receiptUpdate?.changed) {
      delete booking.deposit_receipt_draft_received_at;
      delete booking.deposit_receipt_draft_confirmed_by_atp_staff_id;
      delete booking.deposit_receipt_draft_reference;
    } else if (normalizedDepositReceiptDraft) {
      if (normalizedDepositReceiptDraft.deposit_received_at) {
        booking.deposit_receipt_draft_received_at = normalizedDepositReceiptDraft.deposit_received_at;
      } else {
        delete booking.deposit_receipt_draft_received_at;
      }
      if (normalizedDepositReceiptDraft.deposit_confirmed_by_atp_staff_id) {
        booking.deposit_receipt_draft_confirmed_by_atp_staff_id = normalizedDepositReceiptDraft.deposit_confirmed_by_atp_staff_id;
      } else {
        delete booking.deposit_receipt_draft_confirmed_by_atp_staff_id;
      }
      if (normalizedDepositReceiptDraft.deposit_reference) {
        booking.deposit_receipt_draft_reference = normalizedDepositReceiptDraft.deposit_reference;
      } else {
        delete booking.deposit_receipt_draft_reference;
      }
    }
    if (pricingChanged || draftChanged) {
      incrementBookingRevision(booking, "pricing_revision");
    }
    if (receiptUpdate?.changed) {
      incrementBookingRevision(booking, "core_revision");
    }
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "PRICING_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      receiptUpdate?.detail || "Booking commercials updated"
    );
    await persistStore(store);

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handlePatchBookingOffer(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_offer_revision", "offer_revision", res))) return;

    const check = validateBookingOfferInput(payload.offer, booking);
    if (!check.ok) {
      sendJson(res, check.conflict ? 409 : 422, { error: check.error });
      return;
    }

    // Temporary offer debug logging kept commented for quick re-enable during pricing investigations.
    // try {
    //   console.log("[offer-debug backend] request", JSON.stringify({
    //     booking_id: bookingId,
    //     expected_offer_revision: payload?.expected_offer_revision,
    //     incoming_offer: payload?.offer,
    //     normalized_offer: check.offer
    //   }));
    // } catch {
    //   // ignore debug serialization issues
    // }

    const contentLang = requestContentLang(req, payload);
    const sourceLang = requestSourceLang(req, payload);
    const mergedOffer = mergeOfferForLang(
      booking.offer,
      check.offer,
      contentLang,
      booking.preferred_currency || booking.pricing?.currency || BASE_CURRENCY,
      sourceLang
    );
    if (contentLang !== sourceLang) {
      markOfferTranslationManual(mergedOffer, contentLang, nowIso(), sourceLang);
    }
    const nextOfferBase = await convertBookingOfferToBaseCurrency(mergedOffer);
    const nextOfferJson = JSON.stringify(nextOfferBase);
    const currentOfferJson = JSON.stringify(
      normalizeBookingOffer(booking.offer, booking.preferred_currency || booking.pricing?.currency || BASE_CURRENCY)
    );
    if (nextOfferJson === currentOfferJson) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking, req)), unchanged: true });
      return;
    }

    booking.offer = nextOfferBase;
    incrementBookingRevision(booking, "offer_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "OFFER_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      "Booking offer updated"
    );
    await persistStore(store);

    // Temporary offer debug logging kept commented for quick re-enable during pricing investigations.
    // try {
    //   console.log("[offer-debug backend] response", JSON.stringify({
    //     booking_id: bookingId,
    //     stored_offer: booking.offer,
    //     offer_revision: booking.offer_revision
    //   }));
    // } catch {
    //   // ignore debug serialization issues
    // }

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handleTranslateBookingOfferFromEnglish(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateBookingOfferTranslateRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_offer_revision", "offer_revision", res))) return;

    const contentLang = requestContentLang(req, payload);
    const sourceLang = requestSourceLang(req, payload);
    try {
      const translatedOffer = await translateOfferFromSourceLanguage(
        booking.offer,
        sourceLang,
        contentLang,
        translateEntries,
        nowIso()
      );
      const nextOfferBase = await convertBookingOfferToBaseCurrency(translatedOffer);
      if (JSON.stringify(nextOfferBase) === JSON.stringify(booking.offer || null)) {
        sendJson(res, 200, { ...(await buildBookingDetailResponse(booking, req)), unchanged: true });
        return;
      }

      booking.offer = nextOfferBase;
      incrementBookingRevision(booking, "offer_revision");
      booking.updated_at = nowIso();
      addActivity(
        store,
        booking.id,
        "OFFER_TRANSLATED",
        actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
        `Offer translated from ${sourceLang} to ${contentLang}`
      );
      await persistStore(store);
      sendJson(res, 200, await buildBookingDetailResponse(booking, req));
    } catch (error) {
      sendTranslationError(res, error);
    }
  }

  async function handlePostOfferExchangeRates(req, res) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const principal = getPrincipal(req);
    if (!principal) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    const check = validateOfferExchangeRequest(payload);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    const { fromCurrency, toCurrency, lines } = check;
    if (!Array.isArray(lines) || lines.length === 0) {
      sendJson(res, 200, {
        from_currency: fromCurrency,
        to_currency: toCurrency,
        exchange_rate: 1,
        total_price_cents: 0,
        converted_lines: [],
        converted_components: []
      });
      return;
    }

    let sourceToBaseRate = 1;
    let baseToTargetRate = 1;
    const warnings = new Set();

    if (fromCurrency !== BASE_CURRENCY) {
      try {
        const resolved = await resolveExchangeRateWithFallback(fromCurrency, BASE_CURRENCY);
        sourceToBaseRate = resolved.rate;
        if (resolved.warning) warnings.add(resolved.warning);
      } catch (error) {
        sendJson(res, 502, { error: "Unable to fetch exchange rate", detail: String(error?.message || error) });
        return;
      }
    }
    if (toCurrency !== BASE_CURRENCY) {
      try {
        const resolved = await resolveExchangeRateWithFallback(BASE_CURRENCY, toCurrency);
        baseToTargetRate = resolved.rate;
        if (resolved.warning) warnings.add(resolved.warning);
      } catch (error) {
        sendJson(res, 502, { error: "Unable to fetch exchange rate", detail: String(error?.message || error) });
        return;
      }
    }

    const convertedLines = lines.map((line) =>
      convertOfferLineAmountForCurrency(line, { sourceToBaseRate, baseToTargetRate }, fromCurrency, toCurrency)
    );
    const combinedRate = sourceToBaseRate * baseToTargetRate;

    const responsePayload = {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      exchange_rate: combinedRate,
      total_price_cents: convertedLines.reduce(
        (sum, line) =>
          sum + (Number.isFinite(line.line_total_amount_cents) ? Number(line.line_total_amount_cents) : 0),
        0
      ),
      converted_lines: convertedLines,
      converted_components: convertedLines,
      ...(warnings.size > 0 ? { warning: [...warnings].join(" ") } : {})
    };
    sendJson(res, 200, responsePayload);
  }

  async function handleGenerateBookingOffer(req, res, [bookingId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateBookingGenerateOfferRequest(payload || {});
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_offer_revision", "offer_revision", res))) return;

    const documentLang = normalizePdfLang(
      payload?.lang
      || booking?.customer_language
      || booking?.web_form_submission?.preferred_language
      || (Array.isArray(booking?.persons)
        ? booking.persons.find((person) => Array.isArray(person?.roles) && person.roles.includes("primary_contact"))?.preferred_language
        : null)
      || "en"
    );
    const offerSnapshot = normalizeBookingOffer(
      booking.offer,
      booking.offer?.currency || booking.preferred_currency || BASE_CURRENCY,
      { contentLang: documentLang, flatLang: documentLang }
    );
    const travelPlanSnapshot = buildBookingTravelPlanReadModel(booking.travel_plan, offerSnapshot, { lang: documentLang });
    const now = nowIso();
    const existingGeneratedOffers = Array.isArray(booking.generated_offers) ? booking.generated_offers : [];
    const version = existingGeneratedOffers.reduce((maxVersion, item) => {
      const candidate = Number(item?.version || 0);
      return Number.isInteger(candidate) && candidate > maxVersion ? candidate : maxVersion;
    }, 0) + 1;
    const generatedOffer = {
      id: `generated_offer_${randomUUID()}`,
      booking_id: booking.id,
      version,
      filename: `ATP offer ${now.slice(0, 10)}.pdf`,
      lang: documentLang,
      comment: normalizeText(payload?.comment) || null,
      created_at: now,
      created_by: actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      currency: offerSnapshot.currency,
      total_price_cents: Number(offerSnapshot.total_price_cents || 0),
      offer: offerSnapshot,
      travel_plan: travelPlanSnapshot
    };
    const { approverId, approverLabel } = resolveGeneratedOfferManagementApprover(booking);
    if (approverId) {
      generatedOffer.management_approver_atp_staff_id = approverId;
    }
    if (approverLabel) {
      generatedOffer.management_approver_label = approverLabel;
    }
    try {
      const customerConfirmationFlow = buildGeneratedOfferCustomerConfirmationFlow({
        generatedOffer,
        booking,
        offerSnapshot,
        payload,
        principal,
        now
      });
      if (customerConfirmationFlow) {
        generatedOffer.customer_confirmation_flow = customerConfirmationFlow;
        ensureGeneratedOfferBookingConfirmationTokenState(generatedOffer, { now });
      }
    } catch (error) {
      sendJson(res, 422, { error: String(error?.message || error || "Invalid generated customer confirmation flow.") });
      return;
    }

    booking.generated_offers = [...existingGeneratedOffers, generatedOffer];
    await ensureFrozenGeneratedOfferPdf(generatedOffer, booking);
    incrementBookingRevision(booking, "offer_revision");
    booking.updated_at = now;
    addActivity(
      store,
      booking.id,
      "OFFER_UPDATED",
      actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      `Offer PDF generated (${formatMoney(generatedOffer.total_price_cents, generatedOffer.currency)})`
    );
    await persistStore(store);

    sendJson(res, 201, await buildBookingDetailResponse(booking, req));
  }

  async function handleGetGeneratedOfferPdf(req, res, [bookingId, generatedOfferId]) {
    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canAccessBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const generatedOffer = (Array.isArray(booking.generated_offers) ? booking.generated_offers : []).find(
      (item) => item.id === generatedOfferId
    );
    if (!generatedOffer) {
      sendJson(res, 404, { error: "Generated offer not found" });
      return;
    }
    let pdfPath;
    try {
      ({ pdfPath } = await ensureFrozenGeneratedOfferPdf(generatedOffer, booking, { store }));
    } catch (error) {
      sendJson(res, 500, { error: "Generated offer PDF artifact is missing", detail: String(error?.message || error) });
      return;
    }
    await sendFileWithCache(req, res, pdfPath, "private, max-age=0, no-store", {
      "Content-Disposition": `inline; filename="${String(generatedOffer.filename || `${generatedOffer.id}.pdf`).replace(/"/g, "")}"`
    });
  }

  async function handleCreateGeneratedOfferGmailDraft(req, res, [bookingId, generatedOfferId]) {
    let payload = {};
    try {
      payload = await readBodyJson(req);
    } catch {
      payload = {};
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const generatedOffer = (Array.isArray(booking.generated_offers) ? booking.generated_offers : []).find(
      (item) => item.id === generatedOfferId
    );
    if (!generatedOffer) {
      sendJson(res, 404, { error: "Generated offer not found" });
      return;
    }

    const contact = getBookingContactProfile(booking);
    const recipientEmail = normalizeText(contact?.email || booking?.web_form_submission?.email);
    if (!recipientEmail) {
      sendJson(res, 422, { error: "Booking has no recipient email address for draft creation." });
      return;
    }

    const generatedOfferSnapshot = normalizeGeneratedOfferSnapshot(generatedOffer, booking);
    const draftCopy = buildGeneratedOfferEmailDraftCopy(booking, generatedOfferSnapshot, contact);

    try {
      const { pdfPath } = await ensureFrozenGeneratedOfferPdf(generatedOffer, booking, {
        store,
        persistMetadata: false
      });
      const pdfBuffer = await readFile(pdfPath);
      const draft = await getGmailDraftsClient().createDraft({
        to: recipientEmail,
        subject: draftCopy.subject,
        greeting: draftCopy.greeting,
        intro: draftCopy.intro,
        footer: draftCopy.footer,
        fromName: "Asia Travel Plan",
        attachments: [{
          filename: normalizeText(generatedOffer.filename) || `${generatedOffer.id}.pdf`,
          contentType: "application/pdf",
          content: pdfBuffer
        }]
      });

      let activityLogged = true;
      let warning = "";
      try {
        addActivity(
          store,
          booking.id,
          "OFFER_EMAIL_DRAFT_CREATED",
          actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
          `Gmail draft created for ${normalizeText(generatedOffer.filename) || generatedOffer.id}`
        );
        await persistStore(store);
      } catch (activityError) {
        activityLogged = false;
        warning = "Draft created, but booking activity could not be recorded.";
        console.error("Failed to persist Gmail draft booking activity", activityError);
      }

      sendJson(res, 200, {
        draft_id: draft.draftId,
        gmail_draft_url: draft.gmailDraftUrl,
        recipient_email: recipientEmail,
        generated_offer_id: generatedOffer.id,
        activity_logged: activityLogged,
        ...(warning ? { warning } : {})
      });
    } catch (error) {
      const detail = String(error?.message || error);
      const status = /not configured/i.test(detail) ? 503 : 502;
      sendJson(res, status, {
        error: "Could not create Gmail draft",
        detail
      });
    }
  }

  async function handlePatchGeneratedBookingOffer(req, res, [bookingId, generatedOfferId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_offer_revision", "offer_revision", res))) return;

    const generatedOffers = Array.isArray(booking.generated_offers) ? booking.generated_offers : [];
    const index = generatedOffers.findIndex((item) => item.id === generatedOfferId);
    if (index < 0) {
      sendJson(res, 404, { error: "Generated offer not found" });
      return;
    }

    const currentGeneratedOffer = generatedOffers[index];
    const nextComment = normalizeText(payload?.comment) || null;
    const confirmAsManagement = payload?.confirm_as_management === true;
    const commentChanged = (currentGeneratedOffer.comment || null) !== nextComment;
    if (!commentChanged && !confirmAsManagement) {
      sendJson(res, 200, { ...(await buildBookingDetailResponse(booking, req)), unchanged: true });
      return;
    }

    if (commentChanged) {
      generatedOffers[index] = {
        ...currentGeneratedOffer,
        comment: nextComment
      };
      booking.generated_offers = generatedOffers;
    }

    if (confirmAsManagement) {
      const finalized = await finalizeManagementGeneratedOfferConfirmation({
        req,
        payload,
        store,
        booking,
        generatedOffer: generatedOffers[index],
        principal
      });
      if (!finalized.ok) {
        sendJson(res, finalized.status || 422, { error: finalized.error || "Could not confirm generated offer." });
        return;
      }
      if (commentChanged && finalized.unchanged) {
        incrementBookingRevision(booking, "offer_revision");
        booking.updated_at = nowIso();
        addActivity(
          store,
          booking.id,
          "OFFER_UPDATED",
          actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
          "Generated offer comment updated"
        );
        await persistStore(store);
      }
      sendJson(res, 200, await buildBookingDetailResponse(booking, req));
      return;
    }

    incrementBookingRevision(booking, "offer_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "OFFER_UPDATED",
      actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      "Generated offer comment updated"
    );
    await persistStore(store);

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handleDeleteGeneratedBookingOffer(req, res, [bookingId, generatedOfferId]) {
    let payload = {};
    try {
      payload = await readBodyJson(req);
    } catch {
      payload = {};
    }

    const principal = getPrincipal(req);
    const store = await readStore();
    const booking = store.bookings.find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_offer_revision", "offer_revision", res))) return;

    const generatedOffers = Array.isArray(booking.generated_offers) ? booking.generated_offers : [];
    const index = generatedOffers.findIndex((item) => item.id === generatedOfferId);
    if (index < 0) {
      sendJson(res, 404, { error: "Generated offer not found" });
      return;
    }
    if (normalizeText(booking?.confirmed_generated_offer_id) === generatedOfferId) {
      sendJson(res, 409, { error: "Confirmed generated offers cannot be deleted." });
      return;
    }

    const [removed] = generatedOffers.splice(index, 1);
    booking.generated_offers = generatedOffers;
    incrementBookingRevision(booking, "offer_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "OFFER_UPDATED",
      actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      "Generated offer deleted"
    );
    await persistStore(store);

    const pdfPath = generatedOfferPdfPath(removed.id);
    await rm(pdfPath, { force: true }).catch(() => {});

    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  return {
    handlePatchBookingPricing,
    handlePatchBookingOffer,
    handleTranslateBookingOfferFromEnglish,
    handlePostOfferExchangeRates,
    handleGenerateBookingOffer,
    handleGetGeneratedOfferPdf,
    handleCreateGeneratedOfferGmailDraft,
    handlePatchGeneratedBookingOffer,
    handleDeleteGeneratedBookingOffer
  };
}
