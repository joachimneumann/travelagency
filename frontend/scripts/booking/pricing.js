import {
  GENERATED_CURRENCIES,
  normalizeCurrencyCode as normalizeGeneratedCurrencyCode
} from "../../Generated/Models/generated_Currency.js";
import {
  bookingGeneratedOfferUpdateRequest,
  bookingPricingRequest
} from "../../Generated/API/generated_APIRequestFactory.js";
import { createSnapshotDirtyTracker } from "../shared/edit_state.js";
import { bookingLang, bookingT } from "./i18n.js";

const PRICING_SUMMARY_LABELS = Object.freeze({
  agreed_net_amount: ["booking.pricing.agreed_net_amount", "Agreed net amount"],
  adjustments_delta: ["booking.pricing.adjustments_delta", "Adjustments delta"],
  adjusted_net_amount: ["booking.pricing.adjusted_net_amount", "Adjusted net amount"],
  scheduled_net_amount: ["booking.pricing.scheduled_net_amount", "Scheduled net amount"],
  unscheduled_net_amount: ["booking.pricing.unscheduled_net_amount", "Unscheduled net amount"],
  scheduled_tax_amount: ["booking.pricing.scheduled_tax_amount", "Scheduled tax amount"],
  scheduled_gross_amount: ["booking.pricing.scheduled_gross_amount", "Scheduled gross amount"],
  paid_gross_amount: ["booking.pricing.paid_gross_amount", "Paid gross amount"],
  outstanding_gross_amount: ["booking.pricing.outstanding_gross_amount", "Outstanding gross amount"],
  schedule_balanced: ["booking.pricing.schedule_balanced", "Schedule balanced"]
});

function pricingSummaryLabel(key) {
  const entry = PRICING_SUMMARY_LABELS[key];
  return entry ? bookingT(entry[0], entry[1]) : key;
}

function pricingAdjustmentTypeLabel(type) {
  const normalized = String(type || "").trim().toUpperCase();
  return bookingT(`booking.pricing.adjustment_type.${normalized.toLowerCase()}`, normalized);
}

function pricingPaymentStatusLabel(status) {
  const normalized = String(status || "").trim().toUpperCase();
  return bookingT(`booking.pricing.payment_status.${normalized.toLowerCase()}`, normalized);
}

export function getCurrencyDefinitions() {
  return GENERATED_CURRENCIES;
}

export function normalizeCurrencyCode(value) {
  return normalizeGeneratedCurrencyCode(value) || "USD";
}

function currencyDefinition(currency) {
  const code = normalizeCurrencyCode(currency);
  const definitions = getCurrencyDefinitions();
  const definition = definitions[code] || definitions.USD || { symbol: code, decimalPlaces: 2 };
  return {
    code,
    symbol: definition.symbol || code,
    decimalPlaces: Number.isFinite(Number(definition.decimal_places ?? definition.decimalPlaces))
      ? Number(definition.decimal_places ?? definition.decimalPlaces)
      : 2
  };
}

function currencyDecimalPlaces(currency) {
  return currencyDefinition(currency).decimalPlaces;
}

export function isWholeUnitCurrency(currency) {
  return currencyDecimalPlaces(currency) === 0;
}

export function populateCurrencySelect(selectEl) {
  if (!(selectEl instanceof HTMLSelectElement)) return;
  const definitions = getCurrencyDefinitions();
  const selectedValue = normalizeCurrencyCode(selectEl.value || "USD");
  selectEl.innerHTML = Object.keys(definitions)
    .map((code) => `<option value="${code}">${code}</option>`)
    .join("");
  selectEl.value = selectedValue;
}

export function formatMoneyDisplay(value, currency) {
  const amount = Number(value || 0);
  const definition = currencyDefinition(currency);
  if (!Number.isFinite(amount)) return "-";
  const major = amount / 10 ** definition.decimalPlaces;
  return `${definition.symbol} ${new Intl.NumberFormat(bookingLang(), {
    minimumFractionDigits: definition.decimalPlaces,
    maximumFractionDigits: definition.decimalPlaces,
    useGrouping: true
  }).format(major)}`;
}

export function formatMoneyInputValue(value, currency) {
  const amount = Number(value || 0);
  const definition = currencyDefinition(currency);
  if (!Number.isFinite(amount)) return "0";
  if (definition.decimalPlaces === 0) return String(Math.round(amount));
  return (amount / 10 ** definition.decimalPlaces).toFixed(definition.decimalPlaces);
}

export function parseMoneyInputValue(value, currency) {
  const definition = currencyDefinition(currency);
  const normalized = String(value || "0").trim().replace(",", ".");
  const amount = Number(normalized || "0");
  if (!Number.isFinite(amount)) return NaN;
  if (definition.decimalPlaces === 0) return Math.round(amount);
  return Math.round(amount * 10 ** definition.decimalPlaces);
}

export function setSelectValue(selectEl, rawValue) {
  if (!selectEl) return;
  const value = normalizeCurrencyCode(rawValue || "USD");
  const hasOption = Array.from(selectEl.options).some((option) => option.value === value);
  if (!hasOption) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  }
  selectEl.value = value;
}

export function createBookingPricingModule(ctx) {
  const {
    state,
    els,
    apiOrigin,
    fetchBookingMutation,
    getBookingRevision,
    renderBookingHeader,
    renderActionControls,
    renderBookingData,
    loadActivities,
    escapeHtml,
    captureControlSnapshot,
    setBookingSectionDirty,
    setPageSaveActionError,
    hasUnsavedBookingChanges
  } = ctx;

  function pricingRevision() {
    if (typeof getBookingRevision === "function") {
      return getBookingRevision("pricing_revision");
    }
    const value = Number(state.booking?.pricing_revision);
    return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
  }
  const pricingDirtyTracker = createSnapshotDirtyTracker({
    captureSnapshot: () => captureControlSnapshot(els.pricing_panel),
    isEnabled: () => state.permissions.canEditBooking && hasPaymentTermsFoundation(),
    onDirtyChange: (isDirty) => setBookingSectionDirty("pricing", isDirty)
  });

  function bookingHasRecordedDeposit() {
    return Boolean(
      String(
        state.booking?.deposit_received_at
        || state.booking?.milestones?.deposit_received_at
        || ""
      ).trim()
    );
  }

  function savedDepositReceivedAt() {
    return String(
      state.booking?.deposit_received_at
      || state.booking?.milestones?.deposit_received_at
      || ""
    ).trim();
  }

  function savedDepositReceiptDraftReceivedAt() {
    return String(state.booking?.deposit_receipt_draft_received_at || "").trim();
  }

  function savedDepositConfirmedById() {
    return String(state.booking?.deposit_confirmed_by_atp_staff_id || "").trim();
  }

  function savedDepositReceiptDraftConfirmedById() {
    return String(state.booking?.deposit_receipt_draft_confirmed_by_atp_staff_id || "").trim();
  }

  function setDepositReceiptArmed(value) {
    state.pricingDepositReceiptArmed = Boolean(value);
  }

  function depositReceiptIsArmed() {
    return state.pricingDepositReceiptArmed === true;
  }

  function savedDepositReference() {
    return String(
      state.booking?.accepted_record?.accepted_deposit_reference
      || ""
    ).trim();
  }

  function savedDepositReceiptDraftReference() {
    return String(state.booking?.deposit_receipt_draft_reference || "").trim();
  }

  function currentOfferPaymentTerms() {
    const draftTerms = state.offerDraft?.payment_terms;
    if (draftTerms && typeof draftTerms === "object") return draftTerms;
    if (state.booking?.offer?.payment_terms && typeof state.booking.offer.payment_terms === "object") {
      return state.booking.offer.payment_terms;
    }
    if (state.booking?.accepted_record?.payment_terms && typeof state.booking.accepted_record.payment_terms === "object") {
      return state.booking.accepted_record.payment_terms;
    }
    return null;
  }

  function currentOfferPaymentTermLines() {
    return Array.isArray(currentOfferPaymentTerms()?.lines) ? currentOfferPaymentTerms().lines : [];
  }

  function hasPaymentTermsFoundation() {
    return currentOfferPaymentTermLines().length > 0;
  }

  function hasConfiguredDepositPaymentTerm() {
    return currentOfferPaymentTermLines().some((line) => (
      String(line?.kind || "").trim().toUpperCase() === "DEPOSIT"
      && resolvePaymentTermLineAmount(line, 0) > 0
    ));
  }

  function findDepositPaymentTermLine() {
    const lines = currentOfferPaymentTermLines();
    return lines.find((line) => String(line?.kind || "").trim().toUpperCase() === "DEPOSIT") || lines[0] || null;
  }

  function setPricingControlsVisibility(active) {
    const pricingControls = els.pricing_currency_input?.closest(".backend-controls");
    const adjustmentsWrap = els.pricing_adjustments_table?.closest(".backend-table-wrap");
    const adjustmentsHeading = adjustmentsWrap?.previousElementSibling || null;
    const paymentsWrap = els.pricing_payments_table?.closest(".backend-table-wrap");
    const paymentsHeading = paymentsWrap?.previousElementSibling || null;
    const pricingStatusRow = els.pricing_status?.closest(".backend-controls");
    const receiptControls = els.pricing_deposit_controls;
    const receiptHintRow = els.pricing_deposit_hint_row;

    if (receiptControls instanceof HTMLElement) receiptControls.hidden = !active;
    if (receiptHintRow instanceof HTMLElement) receiptHintRow.hidden = !active;
    if (pricingControls instanceof HTMLElement) pricingControls.hidden = !active;
    if (adjustmentsHeading instanceof HTMLElement) adjustmentsHeading.hidden = !active;
    if (adjustmentsWrap instanceof HTMLElement) adjustmentsWrap.hidden = !active;
    if (paymentsHeading instanceof HTMLElement) paymentsHeading.hidden = !active;
    if (paymentsWrap instanceof HTMLElement) paymentsWrap.hidden = !active;
    if (pricingStatusRow instanceof HTMLElement) pricingStatusRow.hidden = !active;
  }

  function setPricingStatus(message) {
    if (!els.pricing_status) return;
    els.pricing_status.textContent = message;
  }

  function clearPricingStatus() {
    setPricingStatus("");
  }

  function setPricingDepositHint(message) {
    if (!els.pricing_deposit_hint) return;
    const normalized = message || "";
    els.pricing_deposit_hint.textContent = normalized;
    if (els.pricing_deposit_hint_row instanceof HTMLElement) {
      els.pricing_deposit_hint_row.hidden = !normalized;
    }
  }

  function setDepositActionHint(message, type = "info") {
    if (!els.pricing_deposit_action_hint) return;
    els.pricing_deposit_action_hint.textContent = message || "";
    els.pricing_deposit_action_hint.classList.remove(
      "booking-inline-status--error",
      "booking-inline-status--success",
      "booking-inline-status--info"
    );
    if (!message) return;
    const normalizedType = type === "error" || type === "success" ? type : "info";
    els.pricing_deposit_action_hint.classList.add(`booking-inline-status--${normalizedType}`);
  }

  function updatePricingDirtyState() {
    return pricingDirtyTracker.refresh();
  }

  function markPricingSnapshotClean() {
    pricingDirtyTracker.markClean();
  }

  function clonePricing(pricing) {
    return JSON.parse(
      JSON.stringify({
        currency: pricing.currency || "USD",
        agreed_net_amount_cents: pricing.agreed_net_amount_cents || 0,
        adjustments: Array.isArray(pricing.adjustments) ? pricing.adjustments : [],
        payments: Array.isArray(pricing.payments) ? pricing.payments : [],
        summary: pricing.summary || {}
      })
    );
  }

  function currentOfferCurrency() {
    const draftTotal = Number(
      state.offerDraft?.total_price_cents
      ?? state.offerDraft?.totals?.total_price_cents
      ?? 0
    );
    const useDraftCurrency = Boolean(
      (Array.isArray(state.offerDraft?.components) && state.offerDraft.components.length > 0)
      || (state.offerDraft?.payment_terms && typeof state.offerDraft.payment_terms === "object")
      || (Number.isFinite(draftTotal) && draftTotal > 0)
    );
    return normalizeCurrencyCode(
      (useDraftCurrency ? state.offerDraft?.payment_terms?.currency : "")
      || (useDraftCurrency ? state.offerDraft?.currency : "")
      || state.booking?.offer?.payment_terms?.currency
      || state.booking?.offer?.currency
      || state.booking?.accepted_record?.accepted_deposit_currency
      || state.booking?.preferred_currency
      || "USD"
    );
  }

  function currentOfferComponents() {
    if (Array.isArray(state.offerDraft?.components) && state.offerDraft.components.length > 0) {
      return state.offerDraft.components;
    }
    if (Array.isArray(state.booking?.offer?.components)) {
      return state.booking.offer.components;
    }
    if (Array.isArray(state.booking?.accepted_record?.offer?.components)) {
      return state.booking.accepted_record.offer.components;
    }
    return [];
  }

  function currentOfferTotalPriceCents() {
    const draftDirect = Number(state.offerDraft?.total_price_cents);
    if (Number.isFinite(draftDirect) && draftDirect > 0) return Math.max(0, Math.round(draftDirect));
    const draftSummary = Number(state.offerDraft?.totals?.total_price_cents);
    if (Number.isFinite(draftSummary) && draftSummary > 0) return Math.max(0, Math.round(draftSummary));
    const bookingDirect = Number(state.booking?.offer?.total_price_cents);
    if (Number.isFinite(bookingDirect) && bookingDirect > 0) return Math.max(0, Math.round(bookingDirect));
    const bookingSummary = Number(state.booking?.offer?.totals?.total_price_cents);
    if (Number.isFinite(bookingSummary) && bookingSummary > 0) return Math.max(0, Math.round(bookingSummary));
    const acceptedDirect = Number(state.booking?.accepted_record?.offer?.total_price_cents);
    const total = Number.isFinite(acceptedDirect) ? acceptedDirect : 0;
    return Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0;
  }

  function resolvePaymentTermLineAmount(line, fallbackAmount = 0) {
    const resolved = Number(line?.resolved_amount_cents);
    if (Number.isFinite(resolved)) return Math.max(0, Math.round(resolved));
    const fixed = Number(line?.amount_spec?.fixed_amount_cents);
    if (Number.isFinite(fixed)) return Math.max(0, Math.round(fixed));
    return Math.max(0, Math.round(Number(fallbackAmount || 0) || 0));
  }

  function isDepositPaymentRow(payment, depositLine = findDepositPaymentTermLine()) {
    const normalizedOriginId = String(payment?.origin_payment_term_line_id || "").trim();
    const depositLineId = String(depositLine?.id || "").trim();
    if (normalizedOriginId && depositLineId && normalizedOriginId === depositLineId) return true;
    return String(payment?.label || "").trim().toLowerCase().includes("deposit");
  }

  function buildAtpStaffOptions(selectedId = "") {
    const users = new Map();
    for (const user of Array.isArray(state.keycloakUsers) ? state.keycloakUsers : []) {
      const userId = String(user?.id || "").trim();
      if (userId) users.set(userId, user);
    }
    const authUserId = String(state.authUser?.id || state.authUser?.sub || "").trim();
    if (authUserId && !users.has(authUserId)) {
      users.set(authUserId, {
        ...(state.authUser && typeof state.authUser === "object" ? state.authUser : {}),
        id: authUserId
      });
    }
    if (selectedId && !users.has(selectedId)) {
      users.set(selectedId, {
        id: selectedId,
        username: selectedId,
        name: state.booking?.accepted_record?.deposit_confirmed_by_label || selectedId
      });
    }
    const optionLabel = (user) => String(
      user?.staff_profile?.full_name
      || user?.full_name
      || user?.name
      || user?.preferred_username
      || user?.username
      || user?.id
      || ""
    ).trim();
    return [`<option value="">${escapeHtml(bookingT("booking.pricing.confirmed_by_placeholder", "Select ATP staff"))}</option>`]
      .concat(
        [...users.values()]
          .sort((left, right) => optionLabel(left).localeCompare(optionLabel(right)))
          .map((user) => `<option value="${escapeHtml(String(user.id || "").trim())}" ${String(user.id || "").trim() === selectedId ? "selected" : ""}>${escapeHtml(optionLabel(user) || String(user.id || "").trim())}</option>`)
      )
      .join("");
  }

  function depositReceiptReadiness({ includeCleanState = true } = {}) {
    const missing = [];
    if (currentOfferTotalPriceCents() <= 0) {
      missing.push(bookingT("booking.pricing.deposit_requirement.offer_price", "Set the offer price above 0."));
    }
    if (!hasConfiguredDepositPaymentTerm()) {
      missing.push(bookingT("booking.pricing.deposit_requirement.deposit_term", "Configure the deposit in payment terms."));
    }
    if (!normalizeLocalDateToIso(els.pricing_deposit_received_at_input?.value || "")) {
      missing.push(bookingT("booking.pricing.deposit_requirement.received_at", "Fill \"Deposit received at\"."));
    }
    if (!String(els.pricing_deposit_confirmed_by_select?.value || "").trim()) {
      missing.push(bookingT("booking.pricing.deposit_requirement.confirmed_by", "Choose \"Confirmed by\"."));
    }
    if (includeCleanState && typeof hasUnsavedBookingChanges === "function" && hasUnsavedBookingChanges()) {
      missing.push(bookingT("booking.pricing.deposit_requirement.clean_state", "Save all changes first."));
    }
    return {
      ready: missing.length === 0,
      missing
    };
  }

  function latestPendingManagementGeneratedOffer() {
    const items = Array.isArray(state.booking?.generated_offers) ? state.booking.generated_offers : [];
    return items
      .filter((item) => (
        item
        && !item.booking_confirmation
        && (!item.customer_confirmation_flow || typeof item.customer_confirmation_flow !== "object")
        && String(item.management_approver_atp_staff_id || "").trim()
      ))
      .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))[0] || null;
  }

  function managementApprovalReadiness() {
    const generatedOffer = latestPendingManagementGeneratedOffer();
    if (!generatedOffer) {
      return { available: false, ready: false, message: "" };
    }
    const approverId = String(generatedOffer.management_approver_atp_staff_id || "").trim();
    const approverLabel = String(generatedOffer.management_approver_label || approverId || "").trim();
    const selectedId = String(els.pricing_deposit_confirmed_by_select?.value || "").trim();
    if (!selectedId) {
      return {
        available: true,
        ready: false,
        message: bookingT("booking.pricing.management_select_approver", "Choose the management approver under \"Confirmed by\".")
      };
    }
    if (selectedId !== approverId) {
      return {
        available: true,
        ready: false,
        message: bookingT("booking.pricing.management_expected_approver", "Select {name} under \"Confirmed by\" to unlock management approval.", {
          name: approverLabel || bookingT("booking.pricing.confirmed_by", "Confirmed by")
        })
      };
    }
    return {
      available: true,
      ready: true,
      generatedOfferId: String(generatedOffer.id || "").trim(),
      approverLabel
    };
  }

  function renderDepositReceiptActionState({ locked = bookingHasRecordedDeposit() } = {}) {
    const armed = depositReceiptIsArmed();
    const readiness = depositReceiptReadiness({ includeCleanState: !armed });
    const managementReadiness = managementApprovalReadiness();
    if (els.pricing_deposit_received_btn) {
      els.pricing_deposit_received_btn.disabled = locked || !state.permissions.canEditBooking || armed || !readiness.ready;
      els.pricing_deposit_received_btn.hidden = locked;
    }
    if (els.pricing_management_approval_btn) {
      els.pricing_management_approval_btn.hidden = locked || !managementReadiness.available;
      els.pricing_management_approval_btn.disabled = locked || !state.permissions.canEditBooking || !managementReadiness.ready;
    }
    if (locked) {
      setDepositActionHint("", "info");
      return;
    }
    if (armed) {
      setDepositActionHint(
        bookingT("booking.pricing.deposit_received_ready_hint", "Full deposit receipt confirmed. Save the page to persist it."),
        "success"
      );
      return;
    }
    if (!readiness.ready) {
      setDepositActionHint(readiness.missing[0] || managementReadiness.message || "", "error");
      return;
    }
    if (!managementReadiness.ready && managementReadiness.message) {
      setDepositActionHint(managementReadiness.message, "info");
      return;
    }
    setDepositActionHint(
      bookingT("booking.pricing.deposit_action_ready", "Everything is ready. Press \"Full Deposit received\" to confirm the deposit receipt."),
      "info"
    );
  }

  function applyDefaultDepositReceiptDraft() {
    if (bookingHasRecordedDeposit() || !state.permissions.canEditBooking) return false;
    const readiness = depositReceiptReadiness({ includeCleanState: false });
    if (!readiness.ready) {
      renderDepositReceiptActionState();
      return false;
    }
    setDepositReceiptArmed(true);
    renderDepositReceiptActionState();
    updatePricingDirtyState();
    return true;
  }

  function disarmDepositReceiptConfirmation() {
    if (!depositReceiptIsArmed()) {
      renderDepositReceiptActionState();
      return false;
    }
    setDepositReceiptArmed(false);
    renderDepositReceiptActionState();
    return true;
  }

  function renderDepositReceiptControls(pricing) {
    const depositLine = findDepositPaymentTermLine();
    const currency = normalizeCurrencyCode(pricing?.currency || currentOfferCurrency());
    const depositAmount = resolvePaymentTermLineAmount(depositLine, 0);
    const locked = bookingHasRecordedDeposit();

    if (els.pricing_deposit_amount) {
      els.pricing_deposit_amount.textContent = formatMoneyDisplay(depositAmount, currency);
    }
    if (els.pricing_deposit_received_at_input) {
      els.pricing_deposit_received_at_input.value = normalizeDateInput(
        locked ? savedDepositReceivedAt() : (savedDepositReceiptDraftReceivedAt() || savedDepositReceivedAt())
      );
      els.pricing_deposit_received_at_input.disabled = !state.permissions.canEditBooking || locked;
    }
    if (els.pricing_deposit_confirmed_by_select) {
      const preserveExplicitBlank =
        !locked
        && !savedDepositConfirmedById()
        && els.pricing_deposit_confirmed_by_select.dataset.userClearedSelection === "true";
      const selectedId = preserveExplicitBlank
        ? ""
        : (locked ? savedDepositConfirmedById() : (savedDepositReceiptDraftConfirmedById() || savedDepositConfirmedById()));
      els.pricing_deposit_confirmed_by_select.innerHTML = buildAtpStaffOptions(selectedId);
      els.pricing_deposit_confirmed_by_select.value = selectedId;
      els.pricing_deposit_confirmed_by_select.disabled = !state.permissions.canEditBooking || locked;
      if (!preserveExplicitBlank) {
        delete els.pricing_deposit_confirmed_by_select.dataset.userClearedSelection;
      }
    }
    if (els.pricing_deposit_reference_input) {
      els.pricing_deposit_reference_input.value = locked
        ? savedDepositReference()
        : (savedDepositReceiptDraftReference() || "");
      els.pricing_deposit_reference_input.disabled = !state.permissions.canEditBooking || locked;
    }
    if (locked) {
      setDepositReceiptArmed(false);
    }
    renderDepositReceiptActionState({ locked });
    setPricingDepositHint(
      locked
        ? bookingT("booking.pricing.deposit_recorded_hint", "Deposit receipt recorded. The deposit row is now locked in this section.")
        : ""
    );
  }

  function nextPricingFromPaymentTerms(basePricing) {
    const pricing = clonePricing(basePricing || {});
    const paymentTerms = currentOfferPaymentTerms();
    const lines = Array.isArray(paymentTerms?.lines) ? paymentTerms.lines : [];
    if (!lines.length) {
      return pricing;
    }

    const currency = currentOfferCurrency();
    const existingPayments = Array.isArray(pricing.payments) ? pricing.payments : [];
    const remainingPayments = [...existingPayments];
    const depositRecorded = bookingHasRecordedDeposit();
    const normalizedDepositReceivedAt = savedDepositReceivedAt();

    const payments = lines.map((line, index) => {
      const lineLabel = String(line?.label || "").trim();
      const matchingIndex = remainingPayments.findIndex((payment) => String(payment?.label || "").trim() === lineLabel);
      const existing = matchingIndex >= 0
        ? remainingPayments.splice(matchingIndex, 1)[0]
        : remainingPayments.shift() || null;
      const kind = String(line?.kind || "").trim().toUpperCase();
      const isDeposit = kind === "DEPOSIT";
      const dueType = String(line?.due_rule?.type || "").trim().toUpperCase();
      const fixedDate = String(line?.due_rule?.fixed_date || "").trim();
      const existingStatus = String(existing?.status || "").trim().toUpperCase();
      const existingPaidAt = String(existing?.paid_at || "").trim();
      const status = isDeposit ? (depositRecorded ? "PAID" : "PENDING") : (existingStatus === "PAID" ? "PAID" : "PENDING");
      const paidAt = status === "PAID"
        ? (existingPaidAt || (isDeposit ? normalizedDepositReceivedAt : ""))
        : "";

      return {
        id: String(existing?.id || "").trim(),
        label: lineLabel || `${bookingT("booking.payment", "Payment")} ${index + 1}`,
        origin_payment_term_line_id: String(existing?.origin_payment_term_line_id || line?.id || "").trim() || null,
        due_date: dueType === "FIXED_DATE"
          ? (fixedDate || null)
          : (String(existing?.due_date || "").trim() || null),
        net_amount_cents: resolvePaymentTermLineAmount(line, existing?.net_amount_cents || 0),
        tax_rate_basis_points: Number.isFinite(Number(existing?.tax_rate_basis_points))
          ? Number(existing.tax_rate_basis_points)
          : 0,
        status,
        paid_at: paidAt || null,
        notes: String(existing?.notes || line?.description || "").trim() || null
      };
    });

    return {
      ...pricing,
      currency,
      agreed_net_amount_cents: Number(pricing.agreed_net_amount_cents || 0) > 0
        ? Math.round(Number(pricing.agreed_net_amount_cents || 0))
        : currentOfferTotalPriceCents(),
      adjustments: Array.isArray(pricing.adjustments) ? pricing.adjustments : [],
      payments
    };
  }

  function renderPricingSummaryTable(pricing) {
    if (!els.pricing_summary_table) return;
    const summary = pricing.summary || {};
    const hiddenSummaryKeys = new Set([
      "agreed_net_amount",
      "adjusted_net_amount",
      "scheduled_net_amount",
      "scheduled_gross_amount",
      "outstanding_gross_amount"
    ]);
    const moneyRows = [
      ["agreed_net_amount", pricing.agreed_net_amount_cents],
      ["adjustments_delta", summary.adjustments_delta_cents],
      ["adjusted_net_amount", summary.adjusted_net_amount_cents],
      ["scheduled_net_amount", summary.scheduled_net_amount_cents],
      ["unscheduled_net_amount", summary.unscheduled_net_amount_cents],
      ["scheduled_tax_amount", summary.scheduled_tax_amount_cents],
      ["scheduled_gross_amount", summary.scheduled_gross_amount_cents],
      ["paid_gross_amount", summary.paid_gross_amount_cents],
      ["outstanding_gross_amount", summary.outstanding_gross_amount_cents]
    ]
      .filter(([key]) => !hiddenSummaryKeys.has(key))
      .filter(([, value]) => Number(value || 0) !== 0)
      .map(([key, value]) => `<tr><th>${escapeHtml(pricingSummaryLabel(key))}</th><td>${escapeHtml(formatMoneyDisplay(value, pricing.currency))}</td></tr>`);
    const rows = []
      .concat(moneyRows)
      .concat(
        summary.is_schedule_balanced === false
          ? [`<tr><th>${escapeHtml(pricingSummaryLabel("schedule_balanced"))}</th><td>${escapeHtml(bookingT("common.no", "No"))}</td></tr>`]
          : []
      )
      .join("");
    els.pricing_summary_table.innerHTML = `<tbody>${rows || `<tr><td colspan="2">${escapeHtml(bookingT("booking.pricing.no_totals", "No payment totals yet"))}</td></tr>`}</tbody>`;
  }

  function addPricingAdjustmentRow() {
    state.pricingDraft.adjustments.push({
      id: "",
      type: "DISCOUNT",
      label: "",
      amount_cents: 0,
      notes: null
    });
    renderPricingAdjustmentsTable();
  }

  function removePricingAdjustmentRow(index) {
    state.pricingDraft.adjustments.splice(index, 1);
    renderPricingAdjustmentsTable();
  }

  function addPricingPaymentRow() {
    state.pricingDraft.payments.push({
      id: "",
      label: "",
      due_date: null,
      net_amount_cents: 0,
      tax_rate_basis_points: 0,
      status: "PENDING",
      paid_at: null,
      notes: null
    });
    renderPricingPaymentsTable();
  }

  function removePricingPaymentRow(index) {
    state.pricingDraft.payments.splice(index, 1);
    renderPricingPaymentsTable();
  }

  function renderPricingAdjustmentsTable() {
    if (!els.pricing_adjustments_table) return;
    const readOnly = !state.permissions.canEditBooking;
    const items = Array.isArray(state.pricingDraft.adjustments) ? state.pricingDraft.adjustments : [];
    const currency = normalizeCurrencyCode(state.pricingDraft.currency);
    const header = `<thead><tr><th>${escapeHtml(bookingT("booking.pricing.label", "Label"))}</th><th>${escapeHtml(bookingT("booking.pricing.type", "Type"))}</th><th>${escapeHtml(bookingT("booking.pricing.amount_currency", "Amount ({currency})", { currency }))}</th><th>${escapeHtml(bookingT("booking.notes", "Notes"))}</th>${readOnly ? "" : "<th></th>"}</tr></thead>`;
    const rows = items
      .map((item, index) => `<tr>
      <td><input id="pricing_adjustment_label_${index}" name="pricing_adjustment_label_${index}" data-pricing-adjustment-label="${index}" type="text" value="${escapeHtml(item.label || "")}" ${readOnly ? "disabled" : ""} /></td>
      <td>
        <select id="pricing_adjustment_type_${index}" name="pricing_adjustment_type_${index}" data-pricing-adjustment-type="${index}" ${readOnly ? "disabled" : ""}>
          ${["DISCOUNT", "CREDIT", "SURCHARGE"].map((type) => `<option value="${type}" ${item.type === type ? "selected" : ""}>${escapeHtml(pricingAdjustmentTypeLabel(type))}</option>`).join("")}
        </select>
      </td>
      <td><input id="pricing_adjustment_amount_${index}" name="pricing_adjustment_amount_${index}" data-pricing-adjustment-amount="${index}" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(item.amount_cents || 0, currency))}" ${readOnly ? "disabled" : ""} /></td>
      <td><input class="booking-text-field booking-text-field--internal" id="pricing_adjustment_notes_${index}" name="pricing_adjustment_notes_${index}" data-pricing-adjustment-notes="${index}" type="text" value="${escapeHtml(item.notes || "")}" ${readOnly ? "disabled" : ""} /></td>
      ${readOnly ? "" : `<td><button class="btn btn-ghost" type="button" data-pricing-remove-adjustment="${index}">${escapeHtml(bookingT("common.remove", "Remove"))}</button></td>`}
    </tr>`)
      .join("");
    const addRow = readOnly ? "" : `<tr><td colspan="5"><button class="btn btn-ghost" type="button" data-pricing-add-adjustment>${escapeHtml(bookingT("common.add", "Add"))}</button></td></tr>`;
    const body = (rows || `<tr><td colspan="${readOnly ? 4 : 5}">${escapeHtml(bookingT("booking.pricing.no_adjustments", "No adjustments"))}</td></tr>`) + addRow;
    els.pricing_adjustments_table.innerHTML = `${header}<tbody>${body}</tbody>`;
    if (!readOnly) {
      els.pricing_adjustments_table.querySelectorAll("[data-pricing-remove-adjustment]").forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number(button.getAttribute("data-pricing-remove-adjustment"));
          removePricingAdjustmentRow(index);
        });
      });
      els.pricing_adjustments_table.querySelector("[data-pricing-add-adjustment]")?.addEventListener("click", addPricingAdjustmentRow);
    }
  }

  function renderPricingPaymentsTable() {
    if (!els.pricing_payments_table) return;
    const readOnly = !state.permissions.canEditBooking;
    const items = Array.isArray(state.pricingDraft.payments) ? state.pricingDraft.payments : [];
    const currency = normalizeCurrencyCode(state.pricingDraft.currency);
    const depositLine = findDepositPaymentTermLine();
    const header = `<thead><tr><th>${escapeHtml(bookingT("booking.pricing.label", "Label"))}</th><th>${escapeHtml(bookingT("booking.due_date", "Due date"))}</th><th>${escapeHtml(bookingT("booking.pricing.net_currency", "Net ({currency})", { currency }))}</th><th>${escapeHtml(bookingT("booking.pricing.tax_percent", "Tax %"))}</th><th>${escapeHtml(bookingT("booking.pricing.status", "Status"))}</th><th>${escapeHtml(bookingT("booking.pricing.paid_at", "Paid at"))}</th><th>${escapeHtml(bookingT("booking.notes", "Notes"))}</th>${readOnly ? "" : "<th></th>"}</tr></thead>`;
    const rows = items
      .map((item, index) => {
        const depositLocked = isDepositPaymentRow(item, depositLine);
        const rowReadOnly = readOnly || depositLocked;
        return `<tr>
      <td><input id="pricing_payment_label_${index}" name="pricing_payment_label_${index}" data-pricing-payment-label="${index}" type="text" value="${escapeHtml(item.label || "")}" ${rowReadOnly ? "disabled" : ""} /></td>
      <td><input id="pricing_payment_due_date_${index}" name="pricing_payment_due_date_${index}" data-pricing-payment-due-date="${index}" type="date" value="${escapeHtml(item.due_date || "")}" ${rowReadOnly ? "disabled" : ""} /></td>
      <td><input id="pricing_payment_net_${index}" name="pricing_payment_net_${index}" data-pricing-payment-net="${index}" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(item.net_amount_cents || 0, currency))}" ${rowReadOnly ? "disabled" : ""} /></td>
      <td><input id="pricing_payment_tax_${index}" name="pricing_payment_tax_${index}" data-pricing-payment-tax="${index}" type="number" min="0" max="100" step="0.01" value="${escapeHtml(formatTaxRatePercent(item.tax_rate_basis_points))}" ${rowReadOnly ? "disabled" : ""} /></td>
      <td>
        <select id="pricing_payment_status_${index}" name="pricing_payment_status_${index}" data-pricing-payment-status="${index}" ${readOnly || depositLocked ? "disabled" : ""}>
          ${["PENDING", "PAID"].map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${escapeHtml(pricingPaymentStatusLabel(status))}</option>`).join("")}
        </select>
      </td>
      <td><input id="pricing_payment_paid_at_${index}" name="pricing_payment_paid_at_${index}" data-pricing-payment-paid-at="${index}" type="datetime-local" value="${escapeHtml(normalizeDateTimeLocal(item.paid_at))}" ${readOnly || depositLocked ? "disabled" : ""} /></td>
      <td><input class="booking-text-field booking-text-field--internal" id="pricing_payment_notes_${index}" name="pricing_payment_notes_${index}" data-pricing-payment-notes="${index}" type="text" value="${escapeHtml(item.notes || "")}" ${rowReadOnly ? "disabled" : ""} /></td>
      ${readOnly || depositLocked ? "" : `<td><button class="btn btn-ghost" type="button" data-pricing-remove-payment="${index}">${escapeHtml(bookingT("common.remove", "Remove"))}</button></td>`}
    </tr>`;
      })
      .join("");
    const addRow = readOnly ? "" : `<tr><td colspan="8"><button class="btn btn-ghost" type="button" data-pricing-add-payment>${escapeHtml(bookingT("common.add", "Add"))}</button></td></tr>`;
    const body = (rows || `<tr><td colspan="${readOnly ? 7 : 8}">${escapeHtml(bookingT("booking.pricing.no_payments", "No payments scheduled"))}</td></tr>`) + addRow;
    els.pricing_payments_table.innerHTML = `${header}<tbody>${body}</tbody>`;
    if (!readOnly) {
      els.pricing_payments_table.querySelectorAll("[data-pricing-remove-payment]").forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number(button.getAttribute("data-pricing-remove-payment"));
          removePricingPaymentRow(index);
        });
      });
      els.pricing_payments_table.querySelectorAll("[data-pricing-payment-status]").forEach((select) => {
        select.addEventListener("change", () => {
          const index = Number(select.getAttribute("data-pricing-payment-status"));
          const paidAtInput = document.querySelector(`[data-pricing-payment-paid-at="${index}"]`);
          if (String(select.value || "").toUpperCase() === "PAID" && paidAtInput && !paidAtInput.value) {
            paidAtInput.value = normalizeDateTimeLocal(new Date().toISOString());
          }
        });
      });
      els.pricing_payments_table.querySelector("[data-pricing-add-payment]")?.addEventListener("click", addPricingPaymentRow);
    }
  }

  function renderPricingPanel(options = {}) {
    if (!els.pricing_panel || !state.booking) return;
    const preserveDraft = options?.preserveDraft === true;
    const markDerivedChangesDirty = options?.markDerivedChangesDirty === true;
    const paymentTermsAvailable = hasPaymentTermsFoundation();
    const savedPricing = clonePricing(state.booking.pricing || {});
    const hasDirtyDraft = preserveDraft && state.dirty.pricing && state.pricingDraft && typeof state.pricingDraft === "object";
    const pricing = paymentTermsAvailable
      ? nextPricingFromPaymentTerms(hasDirtyDraft ? state.pricingDraft : savedPricing)
      : savedPricing;
    state.pricingDraft = pricing;
    setPricingControlsVisibility(paymentTermsAvailable);

    if (!paymentTermsAvailable) {
      setDepositReceiptArmed(false);
      setDepositActionHint("", "info");
      if (els.pricing_summary_table) {
        els.pricing_summary_table.innerHTML = `<tbody><tr><td colspan="2">${escapeHtml(bookingT("booking.pricing.deposit_setup_required", "Create an offer with payment terms before recording a deposit receipt."))}</td></tr></tbody>`;
      }
      if (els.pricing_adjustments_table) els.pricing_adjustments_table.innerHTML = "";
      if (els.pricing_payments_table) els.pricing_payments_table.innerHTML = "";
      setPricingDepositHint("");
      clearPricingStatus();
      markPricingSnapshotClean();
      return;
    }

    const currency = normalizeCurrencyCode(pricing.currency);
    if (els.pricing_currency_input) {
      els.pricing_currency_input.value = currency;
      els.pricing_currency_input.disabled = !state.permissions.canEditBooking;
    }
    if (els.pricing_agreed_net_label) {
      els.pricing_agreed_net_label.textContent = bookingT("booking.pricing.agreed_net_amount_currency", "Agreed net amount ({currency})", { currency });
    }
    if (els.pricing_agreed_net_input) {
      els.pricing_agreed_net_input.value = formatMoneyInputValue(pricing.agreed_net_amount_cents || 0, currency);
      els.pricing_agreed_net_input.disabled = !state.permissions.canEditBooking;
    }
    renderDepositReceiptControls(pricing);
    renderPricingSummaryTable(pricing);
    renderPricingAdjustmentsTable();
    renderPricingPaymentsTable();
    clearPricingStatus();
    if (hasDirtyDraft) {
      pricingDirtyTracker.setDirty(true);
      return;
    }
    if (!bookingHasRecordedDeposit()) {
      setDepositReceiptArmed(false);
    }
    markPricingSnapshotClean();
    if (markDerivedChangesDirty && JSON.stringify(pricing) !== JSON.stringify(savedPricing)) {
      pricingDirtyTracker.setDirty(true);
    }
  }

  function collectPricingPayload() {
    const currency = normalizeCurrencyCode(els.pricing_currency_input?.value || "USD");
    const agreedNet = parseMoneyInputValue(els.pricing_agreed_net_input?.value || "0", currency);
    if (!currency) throw new Error(bookingT("booking.pricing.error.currency_required", "Currency is required."));
    if (!Number.isFinite(agreedNet) || agreedNet < 0) throw new Error(bookingT("booking.pricing.error.agreed_net_non_negative", "Agreed net amount must be zero or positive."));

    const adjustments = Array.from(document.querySelectorAll("[data-pricing-adjustment-label]")).map((input) => {
      const index = Number(input.getAttribute("data-pricing-adjustment-label"));
      const type = String(document.querySelector(`[data-pricing-adjustment-type="${index}"]`)?.value || "DISCOUNT").trim().toUpperCase();
      const label = String(document.querySelector(`[data-pricing-adjustment-label="${index}"]`)?.value || "").trim();
      const amount = parseMoneyInputValue(document.querySelector(`[data-pricing-adjustment-amount="${index}"]`)?.value || "0", currency);
      const notes = String(document.querySelector(`[data-pricing-adjustment-notes="${index}"]`)?.value || "").trim();
      if (!label) throw new Error(bookingT("booking.pricing.error.adjustment_label", "Adjustment {index} requires a label.", { index: index + 1 }));
      if (!["DISCOUNT", "CREDIT", "SURCHARGE"].includes(type)) throw new Error(bookingT("booking.pricing.error.adjustment_type", "Adjustment {index} has an invalid type.", { index: index + 1 }));
      if (!Number.isFinite(amount) || amount < 0) throw new Error(bookingT("booking.pricing.error.adjustment_amount", "Adjustment {index} requires a valid non-negative amount.", { index: index + 1 }));
      return {
        id: state.pricingDraft.adjustments[index]?.id || "",
        type,
        label,
        amount_cents: Math.round(amount),
        notes: notes || null
      };
    });

    const payments = Array.from(document.querySelectorAll("[data-pricing-payment-label]")).map((input) => {
      const index = Number(input.getAttribute("data-pricing-payment-label"));
      const label = String(document.querySelector(`[data-pricing-payment-label="${index}"]`)?.value || "").trim();
      const dueDate = String(document.querySelector(`[data-pricing-payment-due-date="${index}"]`)?.value || "").trim();
      const netAmount = parseMoneyInputValue(document.querySelector(`[data-pricing-payment-net="${index}"]`)?.value || "0", currency);
      const taxPercent = Number(document.querySelector(`[data-pricing-payment-tax="${index}"]`)?.value || "0");
      const status = String(document.querySelector(`[data-pricing-payment-status="${index}"]`)?.value || "PENDING").trim().toUpperCase();
      const paidAtInputValue = document.querySelector(`[data-pricing-payment-paid-at="${index}"]`)?.value || "";
      const paidAt = normalizeLocalDateTimeToIso(
        paidAtInputValue || (status === "PAID" ? normalizeDateTimeLocal(new Date().toISOString()) : "")
      );
      const notes = String(document.querySelector(`[data-pricing-payment-notes="${index}"]`)?.value || "").trim();
      if (!label) throw new Error(bookingT("booking.pricing.error.payment_label", "Payment {index} requires a label.", { index: index + 1 }));
      if (!Number.isFinite(netAmount) || netAmount < 0) throw new Error(bookingT("booking.pricing.error.payment_amount", "Payment {index} requires a valid non-negative net amount.", { index: index + 1 }));
      if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) throw new Error(bookingT("booking.pricing.error.payment_tax", "Payment {index} requires a tax rate between 0 and 100.", { index: index + 1 }));
      if (!["PENDING", "PAID"].includes(status)) throw new Error(bookingT("booking.pricing.error.payment_status", "Payment {index} has an invalid status.", { index: index + 1 }));
      if (status === "PAID" && !paidAt) throw new Error(bookingT("booking.pricing.error.payment_paid_at", "Payment {index} needs a paid time when marked paid.", { index: index + 1 }));
      return {
        id: state.pricingDraft.payments[index]?.id || "",
        label,
        due_date: dueDate || null,
        net_amount_cents: Math.round(netAmount),
        tax_rate_basis_points: Math.round(taxPercent * 100),
        status,
        paid_at: paidAt || null,
        notes: notes || null
      };
    });

    return {
      currency,
      agreed_net_amount_cents: Math.round(agreedNet),
      adjustments,
      payments
    };
  }

  function collectDepositReceiptPayload() {
    const depositReceivedAt = normalizeLocalDateToIso(els.pricing_deposit_received_at_input?.value || "");
    const confirmedById = String(els.pricing_deposit_confirmed_by_select?.value || "").trim();
    const depositReference = String(els.pricing_deposit_reference_input?.value || "").trim();
    const hasAnyValue = Boolean(depositReceivedAt || confirmedById || depositReference);
    if (!hasAnyValue) return null;
    if (!depositReceiptIsArmed()) {
      return null;
    }
    const readiness = depositReceiptReadiness();
    if (!readiness.ready) {
      throw new Error(readiness.missing[0] || bookingT("booking.pricing.error.deposit_ack_required", "Deposit receipt is not ready."));
    }
    if (!depositReceivedAt) {
      throw new Error(bookingT("booking.pricing.error.deposit_received_at_required", "Deposit received at is required."));
    }
    if (!confirmedById) {
      throw new Error(bookingT("booking.pricing.error.deposit_confirmed_by_required", "Confirmed by is required."));
    }
    return {
      deposit_received_at: depositReceivedAt,
      deposit_confirmed_by_atp_staff_id: confirmedById,
      ...(depositReference ? { deposit_reference: depositReference } : {})
    };
  }

  function collectDepositReceiptDraftPayload() {
    if (bookingHasRecordedDeposit()) return null;
    return {
      deposit_received_at: normalizeLocalDateToIso(els.pricing_deposit_received_at_input?.value || "") || null,
      deposit_confirmed_by_atp_staff_id: String(els.pricing_deposit_confirmed_by_select?.value || "").trim() || null,
      deposit_reference: String(els.pricing_deposit_reference_input?.value || "").trim() || null
    };
  }

  async function savePricing() {
    if (!state.booking || !state.permissions.canEditBooking) return false;
    clearPricingStatus();
    let pricing;
    let depositReceipt;
    let depositReceiptDraft;
    try {
      pricing = collectPricingPayload();
      depositReceipt = collectDepositReceiptPayload();
      depositReceiptDraft = collectDepositReceiptDraftPayload();
    } catch (error) {
      const message = String(error?.message || error);
      setPricingStatus(message);
      setPageSaveActionError?.(message);
      return false;
    }

    const request = bookingPricingRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_pricing_revision: pricingRevision(),
        pricing,
        ...(depositReceipt ? { deposit_receipt: depositReceipt } : {}),
        ...(depositReceiptDraft ? { deposit_receipt_draft: depositReceiptDraft } : {}),
        actor: state.user
      }
    });
    if (!result?.booking) return false;
    state.booking = result.booking;
    renderBookingHeader();
    renderBookingData();
    renderActionControls?.();
    renderPricingPanel();
    await loadActivities();
    return true;
  }

  async function confirmGeneratedOfferByManagement() {
    if (!state.booking || !state.permissions.canEditBooking) return false;
    clearPricingStatus();
    const readiness = managementApprovalReadiness();
    if (!readiness.available || !readiness.generatedOfferId) return false;
    if (!readiness.ready) {
      const message = readiness.message || bookingT("booking.pricing.management_select_approver", "Choose the management approver under \"Confirmed by\".");
      setDepositActionHint(message, "error");
      setPageSaveActionError?.(message);
      return false;
    }
    const request = bookingGeneratedOfferUpdateRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        generated_offer_id: readiness.generatedOfferId
      }
    });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_offer_revision: getBookingRevision("offer_revision"),
        confirm_as_management: true,
        actor: state.user || null
      }
    });
    if (!result?.booking) return false;
    state.booking = result.booking;
    renderBookingHeader();
    renderBookingData();
    renderActionControls?.();
    renderPricingPanel({ preserveDraft: true });
    await loadActivities();
    return true;
  }

  return {
    updatePricingDirtyState,
    markPricingSnapshotClean,
    renderPricingPanel,
    savePricing,
    confirmGeneratedOfferByManagement,
    applyDefaultDepositReceiptDraft,
    disarmDepositReceiptConfirmation,
    refreshDepositReceiptActionState: () => renderDepositReceiptActionState()
  };
}

function normalizeDateTimeLocal(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function normalizeDateInput(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function normalizeLocalDateTimeToIso(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function normalizeLocalDateToIso(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  return `${text}T00:00:00.000Z`;
}

function formatTaxRatePercent(value) {
  const basisPoints = Number(value || 0);
  if (!Number.isFinite(basisPoints)) return "0";
  return (basisPoints / 100).toFixed(2).replace(/\.00$/, "");
}
