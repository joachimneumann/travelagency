import { validateBookingInvoiceTranslateRequest } from "../../../Generated/API/generated_APIModels.js";
import { normalizePdfLang, pdfT } from "../../lib/pdf_i18n.js";
import {
  mergeEditableLocalizedTextField,
  mergeLocalizedTextField,
  normalizeBookingContentLang,
  normalizeBookingSourceLang,
  normalizeLocalizedTextMap,
  resolveLocalizedText
} from "../../domain/booking_content_i18n.js";
import {
  buildInvoiceTranslationStatus,
  collectInvoiceTranslationFieldChanges,
  markInvoiceTranslationFieldsManual,
  markInvoiceTranslationManual,
  translateInvoiceFromSourceLanguage
} from "../../domain/booking_translation.js";
import {
  normalizeBookingPdfPersonalization,
  resolveBookingPdfPersonalizationFlag,
  resolveBookingPdfPersonalizationText
} from "../../lib/booking_pdf_personalization.js";
import { ensureAcceptedCommercialSnapshot } from "../../domain/accepted_record.js";

export function createBookingInvoiceHandlers(deps) {
  const {
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
    convertMinorUnits
  } = deps;

  function requestContentLang(req, payload = null, invoice = null, fallback = "en") {
    try {
      const requestUrl = new URL(req?.url || "/", "http://localhost");
      return normalizeBookingContentLang(
        payload?.content_lang
        || payload?.lang
        || requestUrl.searchParams.get("content_lang")
        || requestUrl.searchParams.get("lang")
        || invoice?.lang
        || fallback
        || "en"
      );
    } catch {
      return normalizeBookingContentLang(payload?.content_lang || payload?.lang || invoice?.lang || fallback || "en");
    }
  }

  function buildDefaultInvoiceTitle(invoiceLike, lang) {
    const recipientName = normalizeText(invoiceLike?.recipient_snapshot?.name) || "recipient";
    const documentKind = normalizeText(invoiceLike?.document_kind).toUpperCase();
    const paymentLabel = normalizeText(invoiceLike?.payment_label);
    if (documentKind === "PAYMENT_REQUEST") {
      return paymentLabel
        ? pdfT(lang, "payment.request.title", "Payment request for {payment}", { payment: paymentLabel })
        : pdfT(lang, "payment.request.title_fallback", "Payment request");
    }
    if (documentKind === "PAYMENT_CONFIRMATION") {
      return paymentLabel
        ? pdfT(lang, "payment.confirmation.title", "Payment confirmation for {payment}", { payment: paymentLabel })
        : pdfT(lang, "payment.confirmation.title_fallback", "Payment confirmation");
    }
    return pdfT(lang, "invoice.title_fallback", "Invoice for {recipient}", {
      recipient: recipientName
    });
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

  function mergeInvoiceComponentsForLang(existingComponents, nextComponents, lang, sourceLang = "en") {
    const normalizedLang = normalizeBookingContentLang(lang);
    const normalizedSourceLang = normalizeBookingSourceLang(sourceLang);
    const existingById = new Map(
      normalizeInvoiceComponents(existingComponents, {
        contentLang: normalizedLang,
        flatLang: normalizedLang,
        sourceLang: normalizedSourceLang
      }).map((component) => [component.id, component])
    );
    return normalizeInvoiceComponents(nextComponents, {
      contentLang: normalizedLang,
      flatLang: normalizedLang,
      sourceLang: normalizedSourceLang
    }).map((component) => {
      const existingComponent = existingById.get(component.id);
      const descriptionField = mergeEditableLocalizedTextField(
        existingComponent?.description_i18n ?? existingComponent?.description,
        component.description,
        component.description_i18n,
        normalizedLang,
        {
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
    if (booking?.offer?.payment_terms && typeof booking.offer.payment_terms === "object") {
      return booking.offer.payment_terms;
    }
    if (booking?.accepted_record?.payment_terms && typeof booking.accepted_record.payment_terms === "object") {
      return booking.accepted_record.payment_terms;
    }
    if (booking?.accepted_payment_terms_snapshot && typeof booking.accepted_payment_terms_snapshot === "object") {
      return booking.accepted_payment_terms_snapshot;
    }
    return null;
  }

  function normalizePaymentDocumentKind(value) {
    const normalized = normalizeText(value).toUpperCase();
    return normalized === "PAYMENT_CONFIRMATION" ? "PAYMENT_CONFIRMATION" : "PAYMENT_REQUEST";
  }

  function findBookingPayment(booking, paymentId) {
    const normalizedPaymentId = normalizeText(paymentId);
    if (!normalizedPaymentId) return null;
    const payments = Array.isArray(booking?.pricing?.payments) ? booking.pricing.payments : [];
    return payments.find((payment) => normalizeText(payment?.id) === normalizedPaymentId) || null;
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
      return "booking_confirmation";
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
    return mergeInvoiceComponentsForLang([], [{
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
      || booking?.pricing?.currency
      || BASE_CURRENCY
    );
  }

  async function convertPaymentAmountForDocument(amountCents, booking, customerCurrency) {
    const normalizedAmountCents = Math.max(0, Math.round(Number(amountCents || 0)));
    const sourceCurrency = safeCurrency(booking?.pricing?.currency || customerCurrency || BASE_CURRENCY);
    if (sourceCurrency === customerCurrency) {
      return normalizedAmountCents;
    }
    return convertMinorUnits(normalizedAmountCents, sourceCurrency, customerCurrency);
  }

  async function buildPaymentDocumentDraft({
    booking,
    payment,
    paymentKind,
    documentKind,
    invoiceParty,
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
    const resolvedIntroFallback = documentKind === "PAYMENT_CONFIRMATION"
      ? `This document confirms receipt of payment for ${paymentLabel}.`
      : payment?.due_date
        ? `Please find the payment request for ${paymentLabel}, due on ${paymentDocumentDateOnly(payment?.due_date, paymentDocumentDateOnly(now))}.`
        : `Please find the payment request for ${paymentLabel}.`;
    const titleField = mergeEditableLocalizedTextField(
      null,
      buildDefaultInvoiceTitle({
        document_kind: documentKind,
        payment_label: paymentLabel,
        recipient_snapshot: invoiceParty
      }, documentLang),
      null,
      contentLang,
      {
        sourceLang,
        defaultLang: sourceLang
      }
    );
    const subtitle = resolvePaymentDocumentText(booking, scope, "subtitle", documentLang, "", sourceLang);
    const intro = resolvePaymentDocumentText(
      booking,
      scope,
      "welcome",
      documentLang,
      resolvedIntroFallback,
      sourceLang
    );
    const closing = resolvePaymentDocumentText(
      booking,
      scope,
      "closing",
      documentLang,
      documentKind === "PAYMENT_CONFIRMATION"
        ? "Thank you for your payment."
        : "Please contact us if you need any support with this payment.",
      sourceLang
    );
    const components = buildPaymentDocumentComponents(paymentLabel, paymentAmountCents, contentLang, sourceLang);
    const receivedAt = normalizeText(
      payment?.received_at
      || (paymentKind === "DEPOSIT" ? booking?.deposit_received_at : "")
    );
    const confirmedByAtpStaffId = normalizeText(
      payment?.confirmed_by_atp_staff_id
      || (paymentKind === "DEPOSIT" ? booking?.deposit_confirmed_by_atp_staff_id : "")
    );
    const paymentReference = normalizeText(
      payment?.reference
      || (paymentKind === "DEPOSIT" ? booking?.accepted_deposit_reference : "")
    );
    if (documentKind === "PAYMENT_CONFIRMATION" && (!receivedAt || !confirmedByAtpStaffId)) {
      throw new Error("Payment receipt details must be recorded before a payment confirmation PDF can be created.");
    }
    const issueDate = documentKind === "PAYMENT_CONFIRMATION"
      ? paymentDocumentDateOnly(receivedAt, paymentDocumentDateOnly(now))
      : paymentDocumentDateOnly(now);
    return {
      document_kind: documentKind,
      payment_id: normalizeText(payment?.id) || null,
      payment_term_line_id: normalizeText(payment?.origin_payment_term_line_id) || null,
      payment_kind: paymentKind,
      payment_label: paymentLabel,
      currency: customerCurrency,
      issue_date: issueDate || null,
      due_date: documentKind === "PAYMENT_REQUEST" ? (normalizeText(payment?.due_date) || null) : null,
      title: titleField.text || buildDefaultInvoiceTitle({ document_kind: documentKind, payment_label: paymentLabel, recipient_snapshot: invoiceParty }, documentLang),
      title_i18n: titleField.map,
      subtitle: subtitle || null,
      intro: intro || null,
      closing: closing || null,
      components,
      due_amount_cents: paymentAmountCents,
      total_amount_cents: paymentAmountCents,
      payment_received_at: receivedAt || null,
      payment_confirmed_by_atp_staff_id: confirmedByAtpStaffId || null,
      payment_reference: paymentReference || null
    };
  }

  function buildInvoiceReadModel(invoice, booking = null, options = {}) {
    const readLang = normalizeBookingContentLang(options?.lang || invoice?.lang || "en");
    const contentLang = normalizeBookingContentLang(invoice?.lang || readLang);
    const sourceLang = normalizeBookingSourceLang(options?.sourceLang || "en");
    const title_i18n = normalizeLocalizedTextMap(invoice?.title_i18n ?? invoice?.title, contentLang);
    const notes_i18n = normalizeLocalizedTextMap(invoice?.notes_i18n ?? invoice?.notes, contentLang);
    const normalizedComponents = normalizeInvoiceComponents(invoice?.components, {
      contentLang,
      flatLang: readLang,
      sourceLang
    });
    const title = resolveLocalizedText(title_i18n, readLang, "", { sourceLang }) || buildDefaultInvoiceTitle(invoice, readLang);
    return {
      ...invoice,
      lang: normalizePdfLang(invoice?.lang || readLang),
      title,
      title_i18n,
      notes: resolveLocalizedText(notes_i18n, readLang, "", { sourceLang }) || null,
      notes_i18n,
      components: normalizedComponents,
      translation_status: buildInvoiceTranslationStatus(invoice, readLang, sourceLang),
      sent_to_recipient: Boolean(invoice.sent_to_recipient),
      sent_to_recipient_at: invoice.sent_to_recipient_at || null,
      document_kind: normalizeText(invoice?.document_kind) || "INVOICE",
      payment_id: normalizeText(invoice?.payment_id) || null,
      payment_term_line_id: normalizeText(invoice?.payment_term_line_id) || null,
      payment_kind: normalizeText(invoice?.payment_kind) || null,
      payment_label: normalizeText(invoice?.payment_label) || null,
      subtitle: normalizeText(invoice?.subtitle) || null,
      intro: normalizeText(invoice?.intro) || null,
      closing: normalizeText(invoice?.closing) || null,
      payment_received_at: normalizeText(invoice?.payment_received_at) || null,
      payment_confirmed_by_atp_staff_id: normalizeText(invoice?.payment_confirmed_by_atp_staff_id) || null,
      payment_confirmed_by_label: normalizeText(invoice?.payment_confirmed_by_label) || null,
      payment_reference: normalizeText(invoice?.payment_reference) || null,
      pdf_url: `/api/v1/invoices/${encodeURIComponent(invoice.id)}/pdf`
    };
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

  function isInvoiceCurrencyEditable(invoice) {
    const status = normalizeText(invoice?.status).toUpperCase();
    return !status || status === "DRAFT";
  }

  function getInvoicePartyForBooking(booking) {
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

  async function handleListBookingInvoices(req, res, [bookingId]) {
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
    const invoices = [...store.invoices]
      .filter((invoice) => invoice.booking_id === bookingId)
      .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")))
      .map((invoice) => buildInvoiceReadModel(invoice, booking, { lang: readLang, sourceLang }));
    sendJson(res, 200, { items: invoices, total: invoices.length });
  }

  async function handleCreateBookingInvoice(req, res, [bookingId]) {
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
    if (!(await assertExpectedRevision(req, payload, booking, "expected_invoices_revision", "invoices_revision", res))) return;

    const now = nowIso();
    const invoiceParty = getInvoicePartyForBooking(booking);
    const contentLang = requestContentLang(req, payload, null, invoiceParty.preferred_language || "en");
    const sourceLang = requestSourceLang(req, payload);
    const documentLang = normalizePdfLang(payload.lang || invoiceParty.preferred_language || "en");
    const paymentId = normalizeText(payload?.payment_id);
    const requestedDocumentKind = normalizePaymentDocumentKind(payload?.document_kind);
    const linkedPayment = paymentId ? findBookingPayment(booking, paymentId) : null;
    if (paymentId && !linkedPayment) {
      sendJson(res, 422, { error: "The selected payment could not be found." });
      return;
    }
    const paymentKind = linkedPayment ? resolvePaymentLineKind(booking, linkedPayment) : "";
    const personalizationScope = linkedPayment ? paymentDocumentPersonalizationScope(paymentKind, requestedDocumentKind) : "";
    const previousPdfPersonalizationJson = JSON.stringify(booking?.pdf_personalization || null);
    if (personalizationScope) {
      const personalizationBranch = buildPaymentDocumentPersonalizationBranch(
        payload?.pdf_personalization,
        personalizationScope,
        contentLang,
        sourceLang
      );
      if (personalizationBranch) {
        booking.pdf_personalization = normalizeBookingPdfPersonalization({
          ...(booking?.pdf_personalization && typeof booking.pdf_personalization === "object" ? booking.pdf_personalization : {}),
          [personalizationScope]: personalizationBranch
        }, {
          flatLang: contentLang,
          sourceLang
        });
      }
    }
    const pdfPersonalizationChanged = JSON.stringify(booking?.pdf_personalization || null) !== previousPdfPersonalizationJson;

    let acceptedSnapshotUpdate = { changed: false, acceptedRecordCreated: false };
    if (linkedPayment) {
      try {
        acceptedSnapshotUpdate = await ensureAcceptedCommercialSnapshot(booking, {
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
        sendJson(res, 422, { error: String(error?.message || error) });
        return;
      }
    }

    const paymentDocumentDraft = linkedPayment
      ? await buildPaymentDocumentDraft({
          booking,
          payment: linkedPayment,
          paymentKind,
          documentKind: requestedDocumentKind,
          invoiceParty,
          contentLang,
          sourceLang,
          documentLang,
          now
        })
      : null;
    const mergedComponents = paymentDocumentDraft
      ? paymentDocumentDraft.components
      : mergeInvoiceComponentsForLang([], payload.components, contentLang, sourceLang);
    if (!mergedComponents.length) {
      sendJson(res, 422, { error: "At least one invoice component is required" });
      return;
    }
    const totalAmountCents = computeInvoiceComponentTotal(mergedComponents);
    const dueAmountCents = safeAmountCents(payload.due_amount_cents) ?? paymentDocumentDraft?.due_amount_cents ?? totalAmountCents;
    const titleField = mergeEditableLocalizedTextField(
      null,
      normalizeText(payload.title)
        || paymentDocumentDraft?.title
        || pdfT(documentLang, "invoice.title_fallback", "Invoice for {recipient}", {
          recipient: normalizeText(invoiceParty.name) || "recipient"
        }),
      payload.title_i18n,
      contentLang,
      {
        sourceLang,
        defaultLang: sourceLang
      }
    );
    const notesField = mergeEditableLocalizedTextField(
      null,
      payload.notes ?? paymentDocumentDraft?.notes,
      payload.notes_i18n,
      contentLang,
      {
        sourceLang,
        defaultLang: sourceLang
      }
    );
    const invoice = {
      id: `inv_${randomUUID()}`,
      booking_id: bookingId,
      invoice_number: normalizeText(payload.invoice_number) || nextInvoiceNumber(store),
      version: 1,
      status: "DRAFT",
      document_kind: paymentDocumentDraft?.document_kind || normalizeText(payload.document_kind) || null,
      payment_id: paymentDocumentDraft?.payment_id || null,
      payment_term_line_id: paymentDocumentDraft?.payment_term_line_id || null,
      payment_kind: paymentDocumentDraft?.payment_kind || null,
      payment_label: paymentDocumentDraft?.payment_label || null,
      lang: documentLang,
      currency: safeCurrency(payload.currency || paymentDocumentDraft?.currency),
      issue_date: normalizeText(payload.issue_date) || paymentDocumentDraft?.issue_date || now.slice(0, 10),
      due_date: normalizeText(payload.due_date) || paymentDocumentDraft?.due_date || null,
      title: titleField.text || buildDefaultInvoiceTitle({ recipient_snapshot: invoiceParty }, documentLang),
      title_i18n: titleField.map,
      subtitle: normalizeText(payload.subtitle) || paymentDocumentDraft?.subtitle || null,
      intro: normalizeText(payload.intro) || paymentDocumentDraft?.intro || null,
      notes: notesField.text || null,
      notes_i18n: notesField.map,
      closing: normalizeText(payload.closing) || paymentDocumentDraft?.closing || null,
      sent_to_recipient: false,
      sent_to_recipient_at: null,
      payment_received_at: normalizeText(payload.payment_received_at) || paymentDocumentDraft?.payment_received_at || null,
      payment_confirmed_by_atp_staff_id: normalizeText(payload.payment_confirmed_by_atp_staff_id) || paymentDocumentDraft?.payment_confirmed_by_atp_staff_id || null,
      payment_confirmed_by_label: normalizeText(payload.payment_confirmed_by_label) || paymentDocumentDraft?.payment_confirmed_by_label || null,
      payment_reference: normalizeText(payload.payment_reference) || paymentDocumentDraft?.payment_reference || null,
      recipient_snapshot: {
        name: invoiceParty.name || "Primary contact",
        email: invoiceParty.email || null,
        phone_number: invoiceParty.phone_number || null
      },
      booking_snapshot: {
        id: booking.id,
        name: normalizeText(booking.name) || null
      },
      components: mergedComponents,
      total_amount_cents: totalAmountCents,
      due_amount_cents: dueAmountCents,
      created_at: now,
      updated_at: now
    };
    if (contentLang !== sourceLang) {
      markInvoiceTranslationManual(invoice, contentLang, now, sourceLang);
    }

    await writeInvoicePdf(buildInvoiceReadModel(invoice, booking, { lang: documentLang, sourceLang }), invoiceParty, booking);
    store.invoices.push(invoice);
    incrementBookingRevision(booking, "invoices_revision");
    if (pdfPersonalizationChanged || acceptedSnapshotUpdate.changed) {
      incrementBookingRevision(booking, "core_revision");
    }
    booking.updated_at = now;
    addActivity(
      store,
      booking.id,
      "INVOICE_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      paymentDocumentDraft
        ? `${requestedDocumentKind === "PAYMENT_CONFIRMATION" ? "Payment confirmation" : "Payment request"} ${invoice.invoice_number} created for ${paymentDocumentDraft.payment_label}`
        : `Invoice ${invoice.invoice_number} created`
    );
    await persistStore(store);
    sendJson(res, 201, {
      invoice: buildInvoiceReadModel(invoice, booking, { lang: contentLang, sourceLang }),
      booking: await buildBookingPayload(booking, { req, lang: contentLang, sourceLang })
    });
  }

  async function handlePatchBookingInvoice(req, res, [bookingId, invoiceId]) {
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
    if (!(await assertExpectedRevision(req, payload, booking, "expected_invoices_revision", "invoices_revision", res))) return;

    const invoice = store.invoices.find((item) => item.id === invoiceId && item.booking_id === bookingId);
    if (!invoice) {
      sendJson(res, 404, { error: "Invoice not found" });
      return;
    }
    const previousInvoice = JSON.parse(JSON.stringify(invoice));

    const invoiceParty = getInvoicePartyForBooking(booking);
    const contentLang = requestContentLang(req, payload, invoice, booking?.customer_language || booking?.web_form_submission?.preferred_language || "en");
    const sourceLang = requestSourceLang(req, payload);
    const nextDocumentLang = payload.lang !== undefined
      ? normalizePdfLang(payload.lang || invoice.lang || invoiceParty?.preferred_language || booking?.customer_language || "en")
      : normalizePdfLang(invoice.lang || booking?.customer_language || booking?.web_form_submission?.preferred_language || "en");
    const components = payload.components !== undefined
      ? mergeInvoiceComponentsForLang(invoice.components, payload.components, contentLang, sourceLang)
      : Array.isArray(invoice.components)
        ? invoice.components
        : [];
    if (!components.length) {
      sendJson(res, 422, { error: "At least one invoice component is required" });
      return;
    }

    const isContentUpdate =
      payload.invoice_number !== undefined ||
      payload.currency !== undefined ||
      payload.issue_date !== undefined ||
      payload.due_date !== undefined ||
      payload.title !== undefined ||
      payload.notes !== undefined ||
      payload.components !== undefined ||
      payload.lang !== undefined ||
      payload.due_amount_cents !== undefined;
    const contentFieldsUpdated =
      payload.title !== undefined ||
      payload.notes !== undefined ||
      payload.components !== undefined;

    if (payload.sent_to_recipient !== undefined) {
      const sent = Boolean(payload.sent_to_recipient);
      invoice.sent_to_recipient = sent;
      invoice.sent_to_recipient_at = sent ? invoice.sent_to_recipient_at || nowIso() : null;
      if (invoice.status !== "PAID") {
        invoice.status = sent ? "INVOICE_SENT" : "DRAFT";
      }
    }

    if (isContentUpdate) {
      if (
        payload.currency !== undefined &&
        !isInvoiceCurrencyEditable(invoice) &&
        safeCurrency(payload.currency || invoice.currency) !== safeCurrency(invoice.currency)
      ) {
        sendJson(res, 409, { error: `Invoice currency is locked because the invoice status is ${invoice.status || "DRAFT"}.` });
        return;
      }
      const totalAmountCents = computeInvoiceComponentTotal(components);
      const dueAmountCents = safeAmountCents(payload.due_amount_cents) ?? totalAmountCents;
      if (payload.invoice_number !== undefined) {
        invoice.invoice_number = normalizeText(payload.invoice_number) || invoice.invoice_number;
      }
      if (payload.currency !== undefined) {
        invoice.currency = safeCurrency(payload.currency || invoice.currency);
      }
      if (payload.issue_date !== undefined) {
        invoice.issue_date = normalizeText(payload.issue_date) || invoice.issue_date;
      }
      if (payload.due_date !== undefined) {
        invoice.due_date = normalizeText(payload.due_date) || null;
      }
      if (payload.title !== undefined) {
        const titleField = mergeEditableLocalizedTextField(
          invoice.title_i18n ?? invoice.title,
          payload.title,
          payload.title_i18n,
          contentLang,
          {
            sourceLang,
            defaultLang: sourceLang
          }
        );
        invoice.title = titleField.text || buildDefaultInvoiceTitle(invoice, nextDocumentLang);
        invoice.title_i18n = titleField.map;
      }
      if (payload.lang !== undefined) {
        invoice.lang = nextDocumentLang;
      }
      if (payload.notes !== undefined) {
        const notesField = mergeEditableLocalizedTextField(
          invoice.notes_i18n ?? invoice.notes,
          payload.notes,
          payload.notes_i18n,
          contentLang,
          {
            sourceLang,
            defaultLang: sourceLang
          }
        );
        invoice.notes = notesField.text || null;
        invoice.notes_i18n = notesField.map;
      }
      invoice.components = components;
      invoice.total_amount_cents = totalAmountCents;
      invoice.due_amount_cents = dueAmountCents;
      if (contentLang !== sourceLang && contentFieldsUpdated) {
        const changedTranslationKeys = collectInvoiceTranslationFieldChanges(
          previousInvoice,
          invoice,
          contentLang,
          sourceLang
        );
        if (changedTranslationKeys.length) {
          markInvoiceTranslationFieldsManual(invoice, contentLang, nowIso(), changedTranslationKeys, sourceLang);
        } else {
          markInvoiceTranslationManual(invoice, contentLang, nowIso(), sourceLang);
        }
      }
      invoice.version = Number(invoice.version || 1) + 1;
      await writeInvoicePdf(
        buildInvoiceReadModel(invoice, booking, { lang: invoice.lang || nextDocumentLang, sourceLang }),
        invoice.recipient_snapshot || invoiceParty,
        booking
      );
    }

    invoice.updated_at = nowIso();
    incrementBookingRevision(booking, "invoices_revision");
    booking.updated_at = invoice.updated_at;
    addActivity(
      store,
      booking.id,
      "INVOICE_UPDATED",
      actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"),
      payload.sent_to_recipient !== undefined
        ? (payload.sent_to_recipient ? `Invoice ${invoice.invoice_number} marked as sent` : `Invoice ${invoice.invoice_number} marked as not sent`)
        : `Invoice ${invoice.invoice_number} updated`
    );

    await persistStore(store);
    sendJson(res, 200, {
      invoice: buildInvoiceReadModel(invoice, booking, { lang: contentLang, sourceLang }),
      booking: await buildBookingPayload(booking, { req, lang: contentLang, sourceLang })
    });
  }

  async function handleTranslateBookingInvoiceFromEnglish(req, res, [bookingId, invoiceId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateBookingInvoiceTranslateRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
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
    if (!(await assertExpectedRevision(req, payload, booking, "expected_invoices_revision", "invoices_revision", res))) return;

    const invoice = store.invoices.find((item) => item.id === invoiceId && item.booking_id === bookingId);
    if (!invoice) {
      sendJson(res, 404, { error: "Invoice not found" });
      return;
    }

    const contentLang = requestContentLang(req, payload, invoice, booking?.customer_language || booking?.web_form_submission?.preferred_language || "en");
    const sourceLang = requestSourceLang(req, payload);
    try {
      const translatedInvoice = await translateInvoiceFromSourceLanguage(
        invoice,
        sourceLang,
        contentLang,
        translateEntries,
        nowIso()
      );
      const nextJson = JSON.stringify(translatedInvoice);
      const currentJson = JSON.stringify(invoice || null);
      if (nextJson === currentJson) {
        sendJson(res, 200, {
          invoice: buildInvoiceReadModel(invoice, booking, { lang: contentLang, sourceLang }),
          booking: await buildBookingPayload(booking, { req, lang: contentLang, sourceLang }),
          unchanged: true
        });
        return;
      }

      Object.assign(invoice, translatedInvoice);
      invoice.lang = normalizePdfLang(payload?.lang || contentLang || invoice.lang || "en");
      invoice.version = Number(invoice.version || 1) + 1;
      invoice.updated_at = nowIso();
      const invoiceParty = invoice.recipient_snapshot || getInvoicePartyForBooking(booking);
      await writeInvoicePdf(buildInvoiceReadModel(invoice, booking, { lang: invoice.lang, sourceLang }), invoiceParty, booking);
      incrementBookingRevision(booking, "invoices_revision");
      booking.updated_at = invoice.updated_at;
      addActivity(
        store,
        booking.id,
        "INVOICE_UPDATED",
        actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
        `Invoice ${invoice.invoice_number} translated from ${sourceLang} to ${contentLang}`
      );
      await persistStore(store);
      sendJson(res, 200, {
        invoice: buildInvoiceReadModel(invoice, booking, { lang: contentLang, sourceLang }),
        booking: await buildBookingPayload(booking, { req, lang: contentLang, sourceLang })
      });
    } catch (error) {
      sendTranslationError(res, error);
    }
  }

  async function handleGetInvoicePdf(req, res, [invoiceId]) {
    const store = await readStore();
    const invoice = store.invoices.find((item) => item.id === invoiceId);
    if (!invoice) {
      sendJson(res, 404, { error: "Invoice not found" });
      return;
    }
    const booking = store.bookings.find((item) => item.id === invoice.booking_id) || null;
    const principal = getPrincipal(req);
    if (!booking || !canAccessBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const invoiceParty = invoice.recipient_snapshot || getInvoicePartyForBooking(booking);
    const pdfPath = invoicePdfPath(invoice.id, invoice.version);
    await writeInvoicePdf(buildInvoiceReadModel(invoice, booking, { lang: invoice.lang, sourceLang: requestSourceLang(req) }), invoiceParty, booking);
    res.setHeader("Content-Disposition", `inline; filename=\"${invoice.invoice_number || invoice.id}.pdf\"`);
    await sendFileWithCache(req, res, pdfPath, "private, max-age=0, no-store");
  }

  return {
    handleListBookingInvoices,
    handleCreateBookingInvoice,
    handlePatchBookingInvoice,
    handleTranslateBookingInvoiceFromEnglish,
    handleGetInvoicePdf
  };
}
