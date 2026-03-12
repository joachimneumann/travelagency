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
    sendFileWithCache
  } = deps;

  function buildInvoiceReadModel(invoice) {
    return {
      ...invoice,
      components: Array.isArray(invoice?.components) ? invoice.components : [],
      sent_to_recipient: Boolean(invoice.sent_to_recipient),
      sent_to_recipient_at: invoice.sent_to_recipient_at || null,
      pdf_url: `/api/v1/invoices/${encodeURIComponent(invoice.id)}/pdf`
    };
  }

  function getInvoicePartyForBooking(booking) {
    const contact = getBookingContactProfile(booking);
    return {
      name: contact.name || "Primary contact",
      email: contact.email || null,
      phone_number: contact.phone_number || null
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

    const invoices = [...store.invoices]
      .filter((invoice) => invoice.booking_id === bookingId)
      .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")))
      .map(buildInvoiceReadModel);
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
    if (!(await assertExpectedRevision(payload, booking, "expected_invoices_revision", "invoices_revision", res))) return;

    const components = normalizeInvoiceComponents(payload.components);
    if (!components.length) {
      sendJson(res, 422, { error: "At least one invoice component is required" });
      return;
    }

    const now = nowIso();
    const invoiceParty = getInvoicePartyForBooking(booking);
    const totalAmountCents = computeInvoiceComponentTotal(components);
    const dueAmountCents = safeAmountCents(payload.due_amount_cents) ?? totalAmountCents;
    const invoice = {
      id: `inv_${randomUUID()}`,
      booking_id: bookingId,
      invoice_number: normalizeText(payload.invoice_number) || nextInvoiceNumber(store),
      version: 1,
      status: "DRAFT",
      currency: safeCurrency(payload.currency),
      issue_date: normalizeText(payload.issue_date) || now.slice(0, 10),
      due_date: normalizeText(payload.due_date) || null,
      title: normalizeText(payload.title) || `Invoice for ${normalizeText(invoiceParty.name) || "recipient"}`,
      notes: normalizeText(payload.notes),
      sent_to_recipient: false,
      sent_to_recipient_at: null,
      components,
      total_amount_cents: totalAmountCents,
      due_amount_cents: dueAmountCents,
      created_at: now,
      updated_at: now
    };

    await writeInvoicePdf(invoice, invoiceParty, booking);
    store.invoices.push(invoice);
    incrementBookingRevision(booking, "invoices_revision");
    booking.updated_at = now;
    addActivity(store, booking.id, "INVOICE_UPDATED", actorLabel(principal, normalizeText(payload.actor) || "keycloak_user"), `Invoice ${invoice.invoice_number} created`);
    await persistStore(store);
    sendJson(res, 201, { invoice: buildInvoiceReadModel(invoice), booking: await buildBookingPayload(booking) });
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
    if (!(await assertExpectedRevision(payload, booking, "expected_invoices_revision", "invoices_revision", res))) return;

    const invoice = store.invoices.find((item) => item.id === invoiceId && item.booking_id === bookingId);
    if (!invoice) {
      sendJson(res, 404, { error: "Invoice not found" });
      return;
    }

    const components = payload.components
      ? normalizeInvoiceComponents(payload.components)
      : Array.isArray(invoice.components)
        ? invoice.components
        : [];
    if (!components.length) {
      sendJson(res, 422, { error: "At least one invoice component is required" });
      return;
    }

    const invoiceParty = getInvoicePartyForBooking(booking);
    const isContentUpdate =
      payload.invoice_number !== undefined ||
      payload.currency !== undefined ||
      payload.issue_date !== undefined ||
      payload.due_date !== undefined ||
      payload.title !== undefined ||
      payload.notes !== undefined ||
      payload.components !== undefined ||
      payload.due_amount_cents !== undefined;

    if (payload.sent_to_recipient !== undefined) {
      const sent = Boolean(payload.sent_to_recipient);
      invoice.sent_to_recipient = sent;
      invoice.sent_to_recipient_at = sent ? invoice.sent_to_recipient_at || nowIso() : null;
      if (invoice.status !== "PAID") {
        invoice.status = sent ? "INVOICE_SENT" : "DRAFT";
      }
    }

    if (isContentUpdate) {
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
        invoice.title = normalizeText(payload.title) || invoice.title;
      }
      if (payload.notes !== undefined) {
        invoice.notes = normalizeText(payload.notes);
      }
      invoice.components = components;
      invoice.total_amount_cents = totalAmountCents;
      invoice.due_amount_cents = dueAmountCents;
      invoice.version = Number(invoice.version || 1) + 1;
      await writeInvoicePdf(invoice, invoiceParty, booking);
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
    sendJson(res, 200, { invoice: buildInvoiceReadModel(invoice), booking: await buildBookingPayload(booking) });
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

    const invoiceParty = getInvoicePartyForBooking(booking);
    const pdfPath = invoicePdfPath(invoice.id, invoice.version);
    await writeInvoicePdf(invoice, invoiceParty, booking);
    res.setHeader("Content-Disposition", `inline; filename=\"${invoice.invoice_number || invoice.id}.pdf\"`);
    await sendFileWithCache(req, res, pdfPath, "private, max-age=0, no-store");
  }

  return {
    handleListBookingInvoices,
    handleCreateBookingInvoice,
    handlePatchBookingInvoice,
    handleGetInvoicePdf
  };
}
