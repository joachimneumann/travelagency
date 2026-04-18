import { normalizePdfLang, pdfT } from "../../lib/pdf_i18n.js";
import {
  mergeEditableLocalizedTextField,
  normalizeBookingContentLang,
  normalizeBookingSourceLang,
  normalizeStoredLocalizedTextField
} from "../../domain/booking_content_i18n.js";
import {
  normalizeBookingPdfPersonalization,
  resolveBookingPdfPersonalizationFlag,
  resolveBookingPdfPersonalizationText
} from "../../lib/booking_pdf_personalization.js";
import { ensureAcceptedCommercialSnapshot } from "../../domain/accepted_record.js";

export function createBookingPaymentDocumentHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    getPrincipal,
    canAccessBooking,
    canEditBooking,
    assertExpectedRevision,
    normalizePaymentDocumentComponents,
    computePaymentDocumentComponentTotal,
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
  } = deps;

  function cloneJson(value) {
    return value == null ? null : JSON.parse(JSON.stringify(value));
  }

  function requestContentLang(req, payload = null, document = null, fallback = "en") {
    try {
      const requestUrl = new URL(req?.url || "/", "http://localhost");
      return normalizeBookingContentLang(
        payload?.content_lang
        || payload?.lang
        || requestUrl.searchParams.get("content_lang")
        || requestUrl.searchParams.get("lang")
        || document?.lang
        || fallback
        || "en"
      );
    } catch {
      return normalizeBookingContentLang(payload?.content_lang || payload?.lang || document?.lang || fallback || "en");
    }
  }

  function requestSourceLang(req, payload = null, fallback = "en") {
    try {
      const requestUrl = new URL(req?.url || "/", "http://localhost");
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

  function buildDefaultDocumentTitle(documentLike, lang) {
    const documentKind = normalizeText(documentLike?.document_kind).toUpperCase();
    const paymentLabel = normalizeText(documentLike?.payment_label);
    if (documentKind === "PAYMENT_CONFIRMATION") {
      return paymentLabel
        ? pdfT(lang, "payment.confirmation.title", "Payment confirmation for {payment}", { payment: paymentLabel })
        : pdfT(lang, "payment.confirmation.title_fallback", "Payment confirmation");
    }
    return paymentLabel
      ? pdfT(lang, "payment.request.title", "Payment request for {payment}", { payment: paymentLabel })
      : pdfT(lang, "payment.request.title_fallback", "Payment request");
  }

  function mergePaymentDocumentComponentsForLang(existingComponents, nextComponents, lang, sourceLang = "en") {
    const normalizedLang = normalizeBookingContentLang(lang);
    const normalizedSourceLang = normalizeBookingSourceLang(sourceLang);
    const existingById = new Map(
      normalizePaymentDocumentComponents(existingComponents, {
        contentLang: normalizedLang,
        flatLang: normalizedLang,
        sourceLang: normalizedSourceLang
      }).map((component) => [component.id, component])
    );
    return normalizePaymentDocumentComponents(nextComponents, {
      contentLang: normalizedLang,
      flatLang: normalizedLang,
      sourceLang: normalizedSourceLang
    }).map((component) => {
      const existingComponent = existingById.get(component.id);
      const descriptionField = mergeEditableLocalizedTextField(
        existingComponent?.description_i18n,
        component.description,
        component.description_i18n,
        normalizedLang,
        {
          existingText: existingComponent?.description,
          sourceLang: normalizedSourceLang,
          defaultLang: normalizedSourceLang
        }
      );
      return {
        ...component,
        description: descriptionField.text,
        description_i18n: descriptionField.map
      };
    });
  }

  function bookingPaymentTerms(booking) {
    if (booking?.accepted_record?.payment_terms && typeof booking.accepted_record.payment_terms === "object") {
      return booking.accepted_record.payment_terms;
    }
    if (booking?.accepted_payment_terms_snapshot && typeof booking.accepted_payment_terms_snapshot === "object") {
      return booking.accepted_payment_terms_snapshot;
    }
    if (booking?.offer?.payment_terms && typeof booking.offer.payment_terms === "object") {
      return booking.offer.payment_terms;
    }
    return null;
  }

  function normalizePaymentDocumentKind(value) {
    const normalized = normalizeText(value).toUpperCase();
    return normalized === "PAYMENT_CONFIRMATION" ? "PAYMENT_CONFIRMATION" : "PAYMENT_REQUEST";
  }

  function requestPreviewMode(req) {
    try {
      const requestUrl = new URL(req?.url || "/", "http://localhost");
      return requestUrl.searchParams.get("preview") === "1";
    } catch {
      return false;
    }
  }

  function paymentTermLineId(line, index) {
    return normalizeText(line?.id) || `payment_term_line_${index + 1}`;
  }

  function findBookingPayment(booking, paymentId) {
    const normalizedPaymentId = normalizeText(paymentId);
    if (!normalizedPaymentId) return null;
    const lines = Array.isArray(bookingPaymentTerms(booking)?.lines) ? bookingPaymentTerms(booking).lines : [];
    const index = lines.findIndex((line, lineIndex) => paymentTermLineId(line, lineIndex) === normalizedPaymentId);
    if (index < 0) return null;
    const line = lines[index];
    const kind = normalizeText(line?.kind).toUpperCase() || "INSTALLMENT";
    return {
      id: paymentTermLineId(line, index),
      label: normalizeText(line?.label),
      origin_payment_term_line_id: paymentTermLineId(line, index),
      net_amount_cents: Math.max(0, Math.round(Number(line?.resolved_amount_cents ?? line?.amount_spec?.fixed_amount_cents ?? 0))),
      kind
    };
  }

  function resolvePaymentLineKind(booking, payment) {
    const paymentLabel = normalizeText(payment?.label);
    const lineId = normalizeText(payment?.origin_payment_term_line_id);
    const lines = Array.isArray(bookingPaymentTerms(booking)?.lines) ? bookingPaymentTerms(booking).lines : [];
    if (lineId) {
      const matchedLine = lines.find((line) => normalizeText(line?.id) === lineId);
      const kind = normalizeText(matchedLine?.kind).toUpperCase();
      if (kind) return kind;
    }
    if (paymentLabel.toLowerCase().includes("deposit")) return "DEPOSIT";
    if (paymentLabel.toLowerCase().includes("final")) return "FINAL_BALANCE";
    return "INSTALLMENT";
  }

  function defaultPaymentLabel(payment, paymentKind) {
    const explicitLabel = normalizeText(payment?.label);
    if (explicitLabel) return explicitLabel;
    if (paymentKind === "DEPOSIT") return "Deposit";
    if (paymentKind === "FINAL_BALANCE") return "Final payment";
    return "Installment";
  }

  function paymentDocumentPersonalizationScope(paymentKind, documentKind) {
    if (documentKind === "PAYMENT_CONFIRMATION" && paymentKind === "DEPOSIT") {
      return "payment_confirmation_deposit";
    }
    if (documentKind === "PAYMENT_REQUEST" && paymentKind === "DEPOSIT") {
      return "payment_request_deposit";
    }
    if (paymentKind === "FINAL_BALANCE") {
      return documentKind === "PAYMENT_CONFIRMATION"
        ? "payment_confirmation_final"
        : "payment_request_final";
    }
    return documentKind === "PAYMENT_CONFIRMATION"
      ? "payment_confirmation_installment"
      : "payment_request_installment";
  }

  function paymentDocumentDateOnly(value, fallback = "") {
    const normalized = normalizeText(value);
    if (!normalized) return fallback;
    const dateOnly = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateOnly) return dateOnly[1];
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return fallback;
    return parsed.toISOString().slice(0, 10);
  }

  function buildPaymentDocumentPersonalizationBranch(branch, scope, contentLang, sourceLang) {
    const normalized = normalizeBookingPdfPersonalization({ [scope]: branch }, {
      flatLang: contentLang,
      sourceLang
    });
    return normalized?.[scope] && typeof normalized[scope] === "object"
      ? normalized[scope]
      : null;
  }

  function resolvePaymentDocumentText(booking, scope, field, lang, fallback, sourceLang = "en") {
    const includeField = `include_${field}`;
    if (!resolveBookingPdfPersonalizationFlag(booking?.pdf_personalization, scope, includeField, { flatLang: lang, sourceLang })) {
      return "";
    }
    const override = normalizeText(
      resolveBookingPdfPersonalizationText(booking?.pdf_personalization, scope, field, lang, { sourceLang })
    );
    return override || fallback;
  }

  function buildPaymentDocumentComponents(paymentLabel, paymentAmountCents, contentLang, sourceLang) {
    return mergePaymentDocumentComponentsForLang([], [{
      description: paymentLabel,
      quantity: 1,
      unit_amount_cents: paymentAmountCents
    }], contentLang, sourceLang);
  }

  function resolvePaymentDocumentCurrency(booking) {
    return safeCurrency(
      bookingPaymentTerms(booking)?.currency
      || booking?.accepted_deposit_currency
      || booking?.offer?.currency
      || booking?.preferred_currency
      || BASE_CURRENCY
    );
  }

  async function convertPaymentAmountForDocument(amountCents, booking, customerCurrency) {
    const normalizedAmountCents = Math.max(0, Math.round(Number(amountCents || 0)));
    const sourceCurrency = safeCurrency(
      bookingPaymentTerms(booking)?.currency
      || booking?.offer?.currency
      || booking?.preferred_currency
      || customerCurrency
      || BASE_CURRENCY
    );
    if (sourceCurrency === customerCurrency) return normalizedAmountCents;
    return convertMinorUnits(normalizedAmountCents, sourceCurrency, customerCurrency);
  }

  function getPaymentDocumentPartyForBooking(booking) {
    const contact = getBookingContactProfile(booking);
    const primaryContact = Array.isArray(booking?.persons)
      ? booking.persons.find((person) => Array.isArray(person?.roles) && person.roles.includes("primary_contact"))
      : null;
    return {
      name: contact.name || "Primary contact",
      email: contact.email || null,
      phone_number: contact.phone_number || null,
      preferred_language: normalizeText(booking?.customer_language || primaryContact?.preferred_language || booking?.web_form_submission?.preferred_language) || null
    };
  }

  async function buildPaymentDocumentDraft({
    booking,
    payment,
    paymentKind,
    documentKind,
    paymentDocumentParty,
    contentLang,
    sourceLang,
    documentLang,
    now
  }) {
    const paymentLabel = defaultPaymentLabel(payment, paymentKind);
    const customerCurrency = resolvePaymentDocumentCurrency(booking);
    const scheduledAmountCents = await convertPaymentAmountForDocument(payment?.net_amount_cents, booking, customerCurrency);
    const receivedAmountCents = Number.isFinite(Number(payment?.received_amount_cents))
      ? await convertPaymentAmountForDocument(payment.received_amount_cents, booking, customerCurrency)
      : null;
    const paymentAmountCents = documentKind === "PAYMENT_CONFIRMATION"
      ? (receivedAmountCents ?? scheduledAmountCents)
      : scheduledAmountCents;
    const scope = paymentDocumentPersonalizationScope(paymentKind, documentKind);
    const introFallback = documentKind === "PAYMENT_CONFIRMATION"
      ? `This document confirms receipt of payment for ${paymentLabel}.`
      : (paymentKind === "DEPOSIT"
          ? "We would be thrilled if you book this tour with us. Please pay the deposit to confirm your booking"
          : `Please find the payment request for ${paymentLabel}.`);
    const titleField = mergeEditableLocalizedTextField(
      null,
      buildDefaultDocumentTitle({
        document_kind: documentKind,
        payment_label: paymentLabel,
        recipient_snapshot: paymentDocumentParty
      }, documentLang),
      null,
      contentLang,
      {
        sourceLang,
        defaultLang: sourceLang
      }
    );
    const subtitle = resolvePaymentDocumentText(booking, scope, "subtitle", documentLang, "", sourceLang);
    const intro = resolvePaymentDocumentText(booking, scope, "welcome", documentLang, introFallback, sourceLang);
    const closing = resolvePaymentDocumentText(
      booking,
      scope,
      "closing",
      documentLang,
      documentKind === "PAYMENT_CONFIRMATION"
        ? "Thank you for your payment."
        : (paymentKind === "DEPOSIT"
            ? "Best regards,\nYour Asia Travel Plan team."
            : "Please contact us if you need any support with this payment."),
      sourceLang
    );
    const components = buildPaymentDocumentComponents(paymentLabel, paymentAmountCents, contentLang, sourceLang);
    const paymentReceivedAt = normalizeText(payment?.received_at || (paymentKind === "DEPOSIT" ? booking?.deposit_received_at : ""));
    const paymentConfirmedByAtpStaffId = normalizeText(payment?.confirmed_by_atp_staff_id || (paymentKind === "DEPOSIT" ? booking?.deposit_confirmed_by_atp_staff_id : ""));
    const paymentReference = normalizeText(payment?.reference || (paymentKind === "DEPOSIT" ? booking?.accepted_deposit_reference : ""));
    if (documentKind === "PAYMENT_CONFIRMATION" && (!paymentReceivedAt || !paymentConfirmedByAtpStaffId)) {
      throw new Error("Payment receipt details must be recorded before a payment confirmation PDF can be created.");
    }
    return {
      document_kind: documentKind,
      payment_id: normalizeText(payment?.id) || null,
      payment_term_line_id: normalizeText(payment?.origin_payment_term_line_id) || null,
      payment_kind: paymentKind,
      payment_label: paymentLabel,
      currency: customerCurrency,
      issue_date: documentKind === "PAYMENT_CONFIRMATION"
        ? paymentDocumentDateOnly(paymentReceivedAt, paymentDocumentDateOnly(now))
        : paymentDocumentDateOnly(now),
      title: titleField.text || buildDefaultDocumentTitle({ document_kind: documentKind, payment_label: paymentLabel }, documentLang),
      title_i18n: titleField.map,
      subtitle: subtitle || null,
      intro: intro || null,
      closing: closing || null,
      components,
      due_amount_cents: paymentAmountCents,
      total_amount_cents: paymentAmountCents,
      payment_received_at: paymentReceivedAt || null,
      payment_confirmed_by_atp_staff_id: paymentConfirmedByAtpStaffId || null,
      payment_reference: paymentReference || null
    };
  }

  function buildPaymentDocumentReadModel(document, booking = null, options = {}) {
    const readLang = normalizeBookingContentLang(options?.lang || document?.lang || "en");
    const contentLang = normalizeBookingContentLang(document?.lang || readLang);
    const sourceLang = normalizeBookingSourceLang(options?.sourceLang || "en");
    const titleField = normalizeStoredLocalizedTextField(document?.title_i18n, document?.title, {
      sourceLang,
      flatLang: readLang,
      fallbackLang: contentLang,
      flatMode: "localized",
      hydrateSourceIntoMap: true
    });
    const notesField = normalizeStoredLocalizedTextField(document?.notes_i18n, document?.notes, {
      sourceLang,
      flatLang: readLang,
      fallbackLang: contentLang,
      flatMode: "localized",
      hydrateSourceIntoMap: true
    });
    return {
      ...document,
      lang: normalizePdfLang(document?.lang || readLang),
      title: titleField.text || buildDefaultDocumentTitle(document, readLang),
      title_i18n: titleField.map,
      notes: notesField.text || null,
      notes_i18n: notesField.map,
      components: normalizePaymentDocumentComponents(document?.components, {
        contentLang,
        flatLang: readLang,
        sourceLang,
        flatMode: "localized",
        hydrateSourceIntoLocalizedMaps: true
      }),
      document_kind: normalizeText(document?.document_kind) || "PAYMENT_REQUEST",
      payment_id: normalizeText(document?.payment_id) || null,
      payment_term_line_id: normalizeText(document?.payment_term_line_id) || null,
      payment_kind: normalizeText(document?.payment_kind) || null,
      payment_label: normalizeText(document?.payment_label) || null,
      subtitle: normalizeText(document?.subtitle) || null,
      intro: normalizeText(document?.intro) || null,
      closing: normalizeText(document?.closing) || null,
      payment_received_at: normalizeText(document?.payment_received_at) || null,
      payment_confirmed_by_atp_staff_id: normalizeText(document?.payment_confirmed_by_atp_staff_id) || null,
      payment_confirmed_by_label: normalizeText(document?.payment_confirmed_by_label) || null,
      payment_reference: normalizeText(document?.payment_reference) || null,
      pdf_url: `/api/v1/payment-documents/${encodeURIComponent(document.id)}/pdf`
    };
  }

  function paymentDocumentPreviewTempOutputPath(bookingId, prefix = "payment-document-preview") {
    const tempRoot = String(TEMP_UPLOAD_DIR || "").trim();
    return path.join(tempRoot, "payment_document_previews", `${prefix}-${bookingId}-${randomUUID()}.pdf`);
  }

  function buildPaymentDocumentPreviewFilename(documentKind = "", nowValue = nowIso()) {
    const normalizedDate = String(nowValue || "").trim().slice(0, 10);
    const datePart = /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)
      ? normalizedDate
      : new Date().toISOString().slice(0, 10);
    const suffix = normalizeText(documentKind).toUpperCase() === "PAYMENT_CONFIRMATION"
      ? "payment-confirmation-preview"
      : "payment-request-preview";
    return `Asia Travel Plan ${datePart}-${suffix}.pdf`;
  }

  function paymentDocumentBuildError(status, message) {
    const error = new Error(String(message || "Invalid payment document payload"));
    error.status = status;
    return error;
  }

  async function buildPaymentDocumentFromCreatePayload({ req, payload, store, booking, preview = false }) {
    const now = nowIso();
    const paymentDocumentParty = getPaymentDocumentPartyForBooking(booking);
    const contentLang = requestContentLang(req, payload, null, paymentDocumentParty.preferred_language || "en");
    const sourceLang = requestSourceLang(req, payload);
    const documentLang = normalizePdfLang(payload?.lang || paymentDocumentParty.preferred_language || "en");
    const workingBooking = preview ? cloneJson(booking) : booking;
    const paymentId = normalizeText(payload?.payment_id);
    const requestedDocumentKind = normalizePaymentDocumentKind(payload?.document_kind);
    const linkedPayment = paymentId ? findBookingPayment(workingBooking, paymentId) : null;
    if (paymentId && !linkedPayment) {
      throw paymentDocumentBuildError(422, "The selected payment could not be found.");
    }
    if (linkedPayment) {
      linkedPayment.received_at = normalizeText(payload?.payment_received_at) || null;
      linkedPayment.confirmed_by_atp_staff_id = normalizeText(payload?.payment_confirmed_by_atp_staff_id) || null;
      linkedPayment.reference = normalizeText(payload?.payment_reference) || null;
    }

    const paymentKind = linkedPayment ? resolvePaymentLineKind(workingBooking, linkedPayment) : "";
    const personalizationScope = linkedPayment ? paymentDocumentPersonalizationScope(paymentKind, requestedDocumentKind) : "";
    const previousPersonalizationJson = JSON.stringify(workingBooking?.pdf_personalization || null);
    if (personalizationScope) {
      const personalizationBranch = buildPaymentDocumentPersonalizationBranch(
        payload?.pdf_personalization,
        personalizationScope,
        contentLang,
        sourceLang
      );
      if (personalizationBranch) {
        workingBooking.pdf_personalization = normalizeBookingPdfPersonalization({
          ...(workingBooking?.pdf_personalization && typeof workingBooking.pdf_personalization === "object" ? workingBooking.pdf_personalization : {}),
          [personalizationScope]: personalizationBranch
        }, {
          flatLang: contentLang,
          sourceLang
        });
      }
    }
    const pdfPersonalizationChanged = JSON.stringify(workingBooking?.pdf_personalization || null) !== previousPersonalizationJson;

    let acceptedSnapshotUpdate = { changed: false, acceptedRecordCreated: false };
    let depositReceiptChanged = false;
    if (linkedPayment) {
      try {
        acceptedSnapshotUpdate = await ensureAcceptedCommercialSnapshot(workingBooking, {
          baseCurrency: BASE_CURRENCY,
          normalizeGeneratedOfferSnapshot,
          normalizeBookingOffer,
          normalizeBookingTravelPlan,
          buildBookingOfferPaymentTermsReadModel,
          listBookingTravelPlanPdfs
        }, {
          allowDraftSource: true
        });
      } catch (error) {
        throw paymentDocumentBuildError(422, String(error?.message || error));
      }
    }
    if (linkedPayment && normalizeText(linkedPayment?.kind).toUpperCase() === "DEPOSIT") {
      const nextDepositReceivedAt = normalizeText(linkedPayment?.received_at);
      const nextDepositConfirmedById = normalizeText(linkedPayment?.confirmed_by_atp_staff_id);
      const nextDepositReference = normalizeText(linkedPayment?.reference);
      if (nextDepositReceivedAt && normalizeText(workingBooking?.deposit_received_at) !== nextDepositReceivedAt) {
        workingBooking.deposit_received_at = nextDepositReceivedAt;
        depositReceiptChanged = true;
      }
      if (nextDepositConfirmedById && normalizeText(workingBooking?.deposit_confirmed_by_atp_staff_id) !== nextDepositConfirmedById) {
        workingBooking.deposit_confirmed_by_atp_staff_id = nextDepositConfirmedById;
        depositReceiptChanged = true;
      }
      if (nextDepositReference && normalizeText(workingBooking?.accepted_deposit_reference) !== nextDepositReference) {
        workingBooking.accepted_deposit_reference = nextDepositReference;
        depositReceiptChanged = true;
      }
    }

    const paymentDocumentDraft = linkedPayment
      ? await buildPaymentDocumentDraft({
          booking: workingBooking,
          payment: linkedPayment,
          paymentKind,
          documentKind: requestedDocumentKind,
          paymentDocumentParty,
          contentLang,
          sourceLang,
          documentLang,
          now
        })
      : null;
    const components = paymentDocumentDraft?.components || [];
    if (!components.length) {
      throw paymentDocumentBuildError(422, "At least one payment document component is required.");
    }

    const document = {
      id: preview ? `preview_payment_document_${randomUUID()}` : `payment_document_${randomUUID()}`,
      booking_id: booking.id,
      document_number: preview ? "PREVIEW" : nextPaymentDocumentNumber(store),
      version: 1,
      status: "READY",
      document_kind: paymentDocumentDraft?.document_kind || requestedDocumentKind,
      payment_id: paymentDocumentDraft?.payment_id || null,
      payment_term_line_id: paymentDocumentDraft?.payment_term_line_id || null,
      payment_kind: paymentDocumentDraft?.payment_kind || null,
      payment_label: paymentDocumentDraft?.payment_label || null,
      lang: documentLang,
      currency: safeCurrency(paymentDocumentDraft?.currency),
      issue_date: paymentDocumentDraft?.issue_date || now.slice(0, 10),
      title: paymentDocumentDraft?.title || buildDefaultDocumentTitle(paymentDocumentDraft, documentLang),
      title_i18n: paymentDocumentDraft?.title_i18n || {},
      subtitle: normalizeText(paymentDocumentDraft?.subtitle) || null,
      intro: normalizeText(paymentDocumentDraft?.intro) || null,
      notes: normalizeText(paymentDocumentDraft?.notes) || null,
      notes_i18n: paymentDocumentDraft?.notes_i18n || {},
      closing: normalizeText(paymentDocumentDraft?.closing) || null,
      payment_received_at: normalizeText(paymentDocumentDraft?.payment_received_at) || null,
      payment_confirmed_by_atp_staff_id: normalizeText(paymentDocumentDraft?.payment_confirmed_by_atp_staff_id) || null,
      payment_confirmed_by_label: normalizeText(payload?.payment_confirmed_by_label) || null,
      payment_reference: normalizeText(paymentDocumentDraft?.payment_reference) || null,
      recipient_snapshot: {
        name: paymentDocumentParty.name || "Primary contact",
        email: paymentDocumentParty.email || null,
        phone_number: paymentDocumentParty.phone_number || null
      },
      booking_snapshot: {
        id: booking.id,
        name: normalizeText(booking?.name) || null
      },
      components,
      total_amount_cents: computePaymentDocumentComponentTotal(components),
      due_amount_cents: paymentDocumentDraft?.due_amount_cents ?? computePaymentDocumentComponentTotal(components),
      created_at: now,
      updated_at: now,
      is_preview: preview,
      preview_watermark_text: preview ? "Preview" : null
    };

    return {
      now,
      document,
      paymentDocumentParty,
      contentLang,
      sourceLang,
      documentLang,
      requestedDocumentKind,
      paymentDocumentDraft,
      pdfPersonalizationChanged,
      acceptedSnapshotUpdate,
      depositReceiptChanged,
      workingBooking
    };
  }

  async function handleListBookingPaymentDocuments(req, res, [bookingId]) {
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

    const readLang = requestContentLang(req);
    const sourceLang = requestSourceLang(req);
    const items = [...(Array.isArray(store.payment_documents) ? store.payment_documents : [])]
      .filter((document) => document.booking_id === bookingId)
      .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")))
      .map((document) => buildPaymentDocumentReadModel(document, booking, { lang: readLang, sourceLang }));
    sendJson(res, 200, { items, total: items.length });
  }

  async function handleCreateBookingPaymentDocument(req, res, [bookingId]) {
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

    const previewMode = requestPreviewMode(req);
    if (!previewMode && !(await assertExpectedRevision(
      req,
      payload,
      booking,
      "expected_payment_documents_revision",
      "payment_documents_revision",
      res
    ))) return;

    let built;
    try {
      built = await buildPaymentDocumentFromCreatePayload({
        req,
        payload,
        store,
        booking,
        preview: previewMode
      });
    } catch (error) {
      sendJson(res, error?.status || 500, { error: String(error?.message || error || "Could not build payment document.") });
      return;
    }

    const {
      now,
      document,
      paymentDocumentParty,
      contentLang,
      sourceLang,
      documentLang,
      requestedDocumentKind,
      paymentDocumentDraft,
      pdfPersonalizationChanged,
      acceptedSnapshotUpdate,
      depositReceiptChanged,
      workingBooking
    } = built;
    const renderedDocument = buildPaymentDocumentReadModel(document, workingBooking, { lang: documentLang, sourceLang });

    if (previewMode) {
      const previewPath = paymentDocumentPreviewTempOutputPath(
        booking.id,
        normalizeText(requestedDocumentKind).toLowerCase() || "payment-document-preview"
      );
      let renderedPath = previewPath;
      try {
        await mkdir(path.dirname(previewPath), { recursive: true });
        const result = await writePaymentDocumentPdf(renderedDocument, paymentDocumentParty, workingBooking, {
          outputPath: previewPath,
          preview: true,
          previewWatermarkText: "Preview"
        });
        renderedPath = normalizeText(result?.outputPath) || previewPath;
        await sendFileWithCache(req, res, renderedPath, "private, max-age=0, no-store", {
          "Content-Disposition": `inline; filename="${buildPaymentDocumentPreviewFilename(requestedDocumentKind, now).replace(/"/g, "")}"`
        });
      } catch (error) {
        sendJson(res, 500, { error: "Could not render payment document preview PDF", detail: String(error?.message || error) });
      } finally {
        await rm(renderedPath, { force: true }).catch(() => {});
        if (renderedPath !== previewPath) {
          await rm(previewPath, { force: true }).catch(() => {});
        }
      }
      return;
    }

    await writePaymentDocumentPdf(renderedDocument, paymentDocumentParty, booking);
    store.payment_documents.push(document);
    incrementBookingRevision(booking, "payment_documents_revision");
    if (pdfPersonalizationChanged || acceptedSnapshotUpdate.changed || depositReceiptChanged) {
      incrementBookingRevision(booking, "core_revision");
    }
    booking.updated_at = now;
    addActivity(
      store,
      booking.id,
      "PAYMENT_DOCUMENT_UPDATED",
      actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      paymentDocumentDraft
        ? `${requestedDocumentKind === "PAYMENT_CONFIRMATION" ? "Payment confirmation" : "Payment request"} ${document.document_number} created for ${paymentDocumentDraft.payment_label}`
        : `Payment document ${document.document_number} created`
    );
    await persistStore(store);
    sendJson(res, 201, {
      document: buildPaymentDocumentReadModel(document, booking, { lang: contentLang, sourceLang }),
      booking: await buildBookingPayload(booking, { req, lang: contentLang, sourceLang })
    });
  }

  async function handleGetPaymentDocumentPdf(req, res, [documentId]) {
    const store = await readStore();
    const document = (Array.isArray(store.payment_documents) ? store.payment_documents : []).find((item) => item.id === documentId);
    if (!document) {
      sendJson(res, 404, { error: "Payment document not found" });
      return;
    }
    const booking = store.bookings.find((item) => item.id === document.booking_id) || null;
    const principal = getPrincipal(req);
    if (!booking || !canAccessBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const paymentDocumentParty = document.recipient_snapshot || getPaymentDocumentPartyForBooking(booking);
    const pdfPath = paymentDocumentPdfPath(document.id, document.version);
    await writePaymentDocumentPdf(
      buildPaymentDocumentReadModel(document, booking, {
        lang: document.lang,
        sourceLang: requestSourceLang(req)
      }),
      paymentDocumentParty,
      booking
    );
    res.setHeader("Content-Disposition", `inline; filename=\"${document.document_number || document.id}.pdf\"`);
    await sendFileWithCache(req, res, pdfPath, "private, max-age=0, no-store");
  }

  return {
    handleListBookingPaymentDocuments,
    handleCreateBookingPaymentDocument,
    handleGetPaymentDocumentPdf
  };
}
