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
  markInvoiceTranslationManual,
  translateInvoiceFromSourceLanguage
} from "../../domain/booking_translation.js";

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
    translateEntries
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
    const mergedComponents = mergeInvoiceComponentsForLang([], payload.components, contentLang, sourceLang);
    if (!mergedComponents.length) {
      sendJson(res, 422, { error: "At least one invoice component is required" });
      return;
    }
    const totalAmountCents = computeInvoiceComponentTotal(mergedComponents);
    const dueAmountCents = safeAmountCents(payload.due_amount_cents) ?? totalAmountCents;
    const titleField = mergeEditableLocalizedTextField(
      null,
      normalizeText(payload.title) || pdfT(documentLang, "invoice.title_fallback", "Invoice for {recipient}", {
        recipient: normalizeText(invoiceParty.name) || "recipient"
      }),
      payload.title_i18n,
      contentLang,
      {
        sourceLang,
        defaultLang: sourceLang
      }
    );
    const notesField = mergeEditableLocalizedTextField(null, payload.notes, payload.notes_i18n, contentLang, {
      sourceLang,
      defaultLang: sourceLang
    });
    const invoice = {
      id: `inv_${randomUUID()}`,
      booking_id: bookingId,
      invoice_number: normalizeText(payload.invoice_number) || nextInvoiceNumber(store),
      version: 1,
      status: "DRAFT",
      lang: documentLang,
      currency: safeCurrency(payload.currency),
      issue_date: normalizeText(payload.issue_date) || now.slice(0, 10),
      due_date: normalizeText(payload.due_date) || null,
      title: titleField.text || buildDefaultInvoiceTitle({ recipient_snapshot: invoiceParty }, documentLang),
      title_i18n: titleField.map,
      notes: notesField.text || null,
      notes_i18n: notesField.map,
      sent_to_recipient: false,
      sent_to_recipient_at: null,
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
    booking.updated_at = now;
    addActivity(store, booking.id, "INVOICE_UPDATED", actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"), `Invoice ${invoice.invoice_number} created`);
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
        markInvoiceTranslationManual(invoice, contentLang, nowIso(), sourceLang);
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
