import { bookingT, bookingLang } from "./i18n.js";
import {
  formatMoneyDisplay,
  formatMoneyInputValue,
  isWholeUnitCurrency,
  normalizeCurrencyCode,
  parseMoneyInputValue
} from "./currency.js";
import { renderBookingSectionHeader } from "./sections.js";
import {
  OFFER_PAYMENT_AMOUNT_MODE_CATALOG,
  OFFER_PAYMENT_DUE_TYPE_CATALOG,
  normalizeGeneratedEnumValue
} from "../shared/generated_catalogs.js";

const OFFER_PAYMENT_AMOUNT_MODES = OFFER_PAYMENT_AMOUNT_MODE_CATALOG;
const OFFER_PAYMENT_EDITABLE_AMOUNT_MODES = Object.freeze(
  OFFER_PAYMENT_AMOUNT_MODES.filter((mode) => mode !== "REMAINING_BALANCE")
);
const OFFER_PAYMENT_DUE_TYPES = OFFER_PAYMENT_DUE_TYPE_CATALOG;
const OFFER_PAYMENT_DAY_BASED_DUE_TYPES = Object.freeze(
  OFFER_PAYMENT_DUE_TYPES.filter((type) => type !== "ON_ACCEPTANCE" && type !== "FIXED_DATE")
);

function englishPaymentTermKindLabel(kind, installmentNumber = 1) {
  const normalizedKind = String(kind || "").trim().toUpperCase();
  if (normalizedKind === "DEPOSIT") return "Deposit";
  if (normalizedKind === "FINAL_BALANCE") return "Final payment";
  return `Installment ${Math.max(1, Number(installmentNumber || 1))}`;
}

export function createBookingOfferPaymentTermsModule(ctx) {
  const {
    state,
    els,
    escapeHtml,
    setOfferSaveEnabled,
    setOfferStatus,
    clearOfferStatus,
    resolveOfferTotalCents,
    renderOfferGenerationControls
  } = ctx;

  function updateOfferPaymentTermsPanelSummary(paymentTerms = state.offerDraft?.payment_terms) {
    if (!els.offerPaymentTermsPanelSummary) return;
    const lines = Array.isArray(paymentTerms?.lines) ? paymentTerms.lines : [];
    const currency = normalizeCurrencyCode(paymentTerms?.currency || state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    const depositLine = lines.find((line) => normalizeOfferPaymentTermKindValue(line?.kind) === "DEPOSIT") || null;
    const remainingCount = lines.filter((line) => normalizeOfferPaymentTermKindValue(line?.kind) !== "DEPOSIT").length;
    const secondary = lines.length
      ? bookingT("booking.payment_plan_summary_compact", "Deposit {deposit}, {count} remaining payment(s)", {
          deposit: formatMoneyDisplay(depositLine?.resolved_amount_cents || 0, currency),
          count: String(remainingCount)
        })
      : bookingT("booking.payment_terms_summary_none", "No payment terms yet.");
    renderBookingSectionHeader(els.offerPaymentTermsPanelSummary, {
      primary: bookingT("booking.payment_plan", "Payment plan"),
      secondary
    });
  }

  function formatGeneratedOfferDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(bookingLang(), {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function normalizeOfferPaymentTermKindValue(value) {
    return normalizeGeneratedEnumValue("OfferPaymentTermKind", value, "INSTALLMENT", {
      transform: (rawValue) => String(rawValue ?? "").trim().toUpperCase()
    });
  }

  function normalizeOfferPaymentAmountModeValue(value) {
    return normalizeGeneratedEnumValue("OfferPaymentAmountMode", value, "FIXED_AMOUNT", {
      transform: (rawValue) => String(rawValue ?? "").trim().toUpperCase()
    });
  }

  function normalizeOfferPaymentDueTypeValue(value) {
    const rawNormalized = String(value || "").trim().toUpperCase();
    const normalized = normalizeGeneratedEnumValue("OfferPaymentDueType", value, "", {
      transform: (rawValue) => String(rawValue ?? "").trim().toUpperCase()
    });
    if (normalized) return normalized;
    if (rawNormalized) {
      console.error("[offer-payment-terms] Unsupported due type normalized to ON_ACCEPTANCE.", {
        requestedDueType: value,
        normalizedDueType: rawNormalized,
        supportedDueTypes: OFFER_PAYMENT_DUE_TYPES
      });
    }
    return "ON_ACCEPTANCE";
  }

  function offerPaymentDueTypeUsesFixedDate(value) {
    return normalizeOfferPaymentDueTypeValue(value) === "FIXED_DATE";
  }

  function offerPaymentDueTypeUsesDays(value) {
    return OFFER_PAYMENT_DAY_BASED_DUE_TYPES.includes(normalizeOfferPaymentDueTypeValue(value));
  }

  function logOfferPaymentTermDueTypeMismatch(requestOffer, responseBooking) {
    const requestLines = Array.isArray(requestOffer?.payment_terms?.lines) ? requestOffer.payment_terms.lines : [];
    const responseLines = Array.isArray(responseBooking?.offer?.payment_terms?.lines) ? responseBooking.offer.payment_terms.lines : [];
    const mismatch = requestLines
      .map((line, index) => {
        const requestedType = normalizeOfferPaymentDueTypeValue(line?.due_rule?.type);
        const returnedType = normalizeOfferPaymentDueTypeValue(responseLines[index]?.due_rule?.type);
        if (requestedType === returnedType) return null;
        return {
          lineIndex: index,
          label: String(line?.label || responseLines[index]?.label || ""),
          requestedType,
          returnedType
        };
      })
      .find(Boolean);
    if (!mismatch) return;
    console.error("[offer-payment-terms] Backend response changed a saved due type.", {
      reason: "The booking offer PATCH response returned a different payment-term due type than the one sent by the browser.",
      mismatch,
      requestLines: requestLines.map((line) => ({
        label: String(line?.label || ""),
        dueType: normalizeOfferPaymentDueTypeValue(line?.due_rule?.type)
      })),
      responseLines: responseLines.map((line) => ({
        label: String(line?.label || ""),
        dueType: normalizeOfferPaymentDueTypeValue(line?.due_rule?.type)
      }))
    });
  }

  function normalizeOfferPaymentAmountSpecDraftValue(rawAmountSpec, kind, fallbackResolvedAmountCents = 0) {
    const normalizedKind = normalizeOfferPaymentTermKindValue(kind);
    if (normalizedKind === "FINAL_BALANCE") {
      return { mode: "REMAINING_BALANCE" };
    }
    const mode = normalizeOfferPaymentAmountModeValue(rawAmountSpec?.mode);
    if (mode === "REMAINING_BALANCE") {
      return {
        mode: "FIXED_AMOUNT",
        fixed_amount_cents: Math.max(
          0,
          Math.round(Number(rawAmountSpec?.fixed_amount_cents ?? fallbackResolvedAmountCents ?? 0))
        )
      };
    }
    if (mode === "PERCENTAGE_OF_OFFER_TOTAL") {
      return {
        mode,
        percentage_basis_points: Math.max(0, Math.round(Number(rawAmountSpec?.percentage_basis_points || 0)))
      };
    }
    return {
      mode: "FIXED_AMOUNT",
      fixed_amount_cents: Math.max(0, Math.round(Number(rawAmountSpec?.fixed_amount_cents || 0)))
    };
  }

  function formatLegacyPaymentTermKindLabel(kind, sequence) {
    return englishPaymentTermKindLabel(kind, sequence);
  }

  function formatPaymentTermKindLabel(kind, fallbackLabel, options = {}) {
    const normalizedKind = String(kind || "").trim().toUpperCase();
    const explicitLabel = String(fallbackLabel || "").trim();
    if (explicitLabel) return explicitLabel;
    return englishPaymentTermKindLabel(
      normalizedKind,
      Math.max(1, Number(options.installmentNumber || 1))
    );
  }

  function resolveOfferPaymentTermInstallmentNumber(lines, lineIndex, kindOverride = null) {
    const targetIndex = Math.max(0, Number(lineIndex || 0));
    let count = 0;
    const items = Array.isArray(lines) ? lines : [];
    for (let index = 0; index <= targetIndex && index < items.length; index += 1) {
      const kind = normalizeOfferPaymentTermKindValue(index === targetIndex && kindOverride ? kindOverride : items[index]?.kind);
      if (kind === "INSTALLMENT") count += 1;
    }
    return Math.max(1, count || 1);
  }

  function resolveOfferPaymentTermLabel(rawLabel, kind, sequence, installmentNumber) {
    const explicitLabel = String(rawLabel || "").trim();
    const nextDefaultLabel = formatPaymentTermKindLabel(kind, "", { installmentNumber });
    if (!explicitLabel) return nextDefaultLabel;
    const legacyDefaultLabel = formatLegacyPaymentTermKindLabel(kind, sequence);
    if (explicitLabel === legacyDefaultLabel || explicitLabel === nextDefaultLabel) {
      return nextDefaultLabel;
    }
    return explicitLabel;
  }

  function formatPercentageBasisPoints(value) {
    const basisPoints = Math.max(0, Number(value || 0));
    const percentage = basisPoints / 100;
    return `${Number.isInteger(percentage) ? String(percentage) : percentage.toFixed(2).replace(/\.?0+$/, "")}%`;
  }

  function formatPaymentTermAmountModeLabel(mode) {
    const normalizedMode = normalizeOfferPaymentAmountModeValue(mode);
    if (normalizedMode === "PERCENTAGE_OF_OFFER_TOTAL") {
      return bookingT("booking.offer.payment_terms.amount_mode_percentage", "% of offer total");
    }
    if (normalizedMode === "REMAINING_BALANCE") {
      return bookingT("booking.offer.payment_terms.amount_mode_remaining", "Remaining balance");
    }
    return bookingT("booking.offer.payment_terms.amount_mode_fixed", "Fixed amount");
  }

  function formatPaymentTermDueTypeLabel(type) {
    const normalizedType = normalizeOfferPaymentDueTypeValue(type);
    if (normalizedType === "FIXED_DATE") {
      return bookingT("booking.offer.payment_terms.due_type_fixed_date", "Fixed date");
    }
    if (normalizedType === "DAYS_AFTER_ACCEPTANCE") {
      return bookingT("booking.offer.payment_terms.due_type_after_acceptance", "Days after acceptance");
    }
    if (normalizedType === "DAYS_BEFORE_TRIP_START") {
      return bookingT("booking.offer.payment_terms.due_type_before_trip", "Days before trip start");
    }
    if (normalizedType === "DAYS_AFTER_TRIP_START") {
      return bookingT("booking.offer.payment_terms.due_type_after_trip_start", "Days after trip start");
    }
    if (normalizedType === "DAYS_AFTER_TRIP_END") {
      return bookingT("booking.offer.payment_terms.due_type_after_trip_end", "Days after trip end");
    }
    return bookingT("booking.offer.payment_terms.due_type_on_acceptance", "On acceptance");
  }

  function buildOfferPaymentTermFieldId(field, index) {
    const normalizedIndex = Math.max(0, Number(index || 0));
    return `offer_payment_term_${field}_${normalizedIndex}`;
  }

  function buildOfferPaymentTermFieldName(field, index) {
    const normalizedIndex = Math.max(0, Number(index || 0));
    return `offer_payment_terms[${normalizedIndex}][${field}]`;
  }

  function formatPaymentTermAmountSpec(amountSpec, currency) {
    const mode = String(amountSpec?.mode || "").trim().toUpperCase();
    if (mode === "PERCENTAGE_OF_OFFER_TOTAL") {
      return bookingT("booking.offer.payment_terms.amount_percentage", "{percent} of total", {
        percent: formatPercentageBasisPoints(amountSpec?.percentage_basis_points)
      });
    }
    if (mode === "REMAINING_BALANCE") {
      return bookingT("booking.offer.payment_terms.amount_remaining", "Remaining balance");
    }
    return bookingT("booking.offer.payment_terms.amount_fixed", "Fixed amount {amount}", {
      amount: formatMoneyDisplay(amountSpec?.fixed_amount_cents || 0, currency)
    });
  }

  function formatOfferPaymentDueRule(dueRule) {
    const type = String(dueRule?.type || "").trim().toUpperCase();
    if (type === "FIXED_DATE" && String(dueRule?.fixed_date || "").trim()) {
      const formattedDate = formatGeneratedOfferDate(dueRule.fixed_date);
      return bookingT("booking.offer.payment_terms.due_fixed_date", "Due on {date}", { date: formattedDate });
    }
    if (type === "DAYS_AFTER_ACCEPTANCE") {
      const days = Math.max(0, Number(dueRule?.days || 0));
      return bookingT("booking.offer.payment_terms.due_days_after_acceptance", "Due {days} days after acceptance", {
        days: String(days)
      });
    }
    if (type === "DAYS_BEFORE_TRIP_START") {
      const days = Math.max(0, Number(dueRule?.days || 0));
      return bookingT("booking.offer.payment_terms.due_days_before_trip", "Due {days} days before trip start", {
        days: String(days)
      });
    }
    if (type === "DAYS_AFTER_TRIP_START") {
      const days = Math.max(0, Number(dueRule?.days || 0));
      return bookingT("booking.offer.payment_terms.due_days_after_trip_start", "Due {days} days after trip start", {
        days: String(days)
      });
    }
    if (type === "DAYS_AFTER_TRIP_END") {
      const days = Math.max(0, Number(dueRule?.days || 0));
      return bookingT("booking.offer.payment_terms.due_days_after_trip_end", "Due {days} days after trip end", {
        days: String(days)
      });
    }
    return bookingT("booking.offer.payment_terms.due_on_acceptance", "Due on acceptance");
  }

  function formatPaymentTermAmountValueDisplay(line, currency) {
    const mode = normalizeOfferPaymentAmountModeValue(line?.amount_spec?.mode);
    if (mode === "FIXED_AMOUNT") {
      return formatMoneyDisplay(line?.amount_spec?.fixed_amount_cents || 0, currency);
    }
    if (mode === "PERCENTAGE_OF_OFFER_TOTAL") {
      return formatPercentageBasisPoints(line?.amount_spec?.percentage_basis_points);
    }
    return bookingT("booking.offer.payment_terms.remaining_balance", "Remaining balance");
  }

  function createDefaultOfferPaymentDepositLine(sequence = 1) {
    const numericSequence = Math.max(1, Math.round(Number(sequence || 1)));
    return {
      id: "",
      kind: "DEPOSIT",
      label: formatPaymentTermKindLabel("DEPOSIT"),
      sequence: numericSequence,
      amount_spec: {
        mode: "PERCENTAGE_OF_OFFER_TOTAL",
        percentage_basis_points: 3000
      },
      resolved_amount_cents: 0,
      due_rule: {
        type: "ON_ACCEPTANCE"
      }
    };
  }

  function createDefaultOfferPaymentInstallmentLine(sequence, installmentNumber = 1) {
    const numericSequence = Math.max(1, Math.round(Number(sequence || 1)));
    return {
      id: "",
      kind: "INSTALLMENT",
      label: formatPaymentTermKindLabel("INSTALLMENT", "", { installmentNumber: Math.max(1, installmentNumber) }),
      sequence: numericSequence,
      amount_spec: {
        mode: "FIXED_AMOUNT",
        fixed_amount_cents: 0
      },
      resolved_amount_cents: 0,
      due_rule: {
        type: "ON_ACCEPTANCE"
      }
    };
  }

  function createDefaultFinalOfferPaymentTermLine(sequence) {
    const numericSequence = Math.max(1, Math.round(Number(sequence || 1)));
    return {
      id: "",
      kind: "FINAL_BALANCE",
      label: formatPaymentTermKindLabel("FINAL_BALANCE"),
      sequence: numericSequence,
      amount_spec: {
        mode: "REMAINING_BALANCE"
      },
      resolved_amount_cents: 0,
      due_rule: {
        type: "ON_ACCEPTANCE"
      },
      description: ""
    };
  }

  function computeOfferPaymentResolvedAmountDraft(amountSpec, basisTotalAmountCents, allocatedAmountCents) {
    const basisTotal = Math.max(0, Math.round(Number(basisTotalAmountCents || 0)));
    const allocated = Math.max(0, Math.round(Number(allocatedAmountCents || 0)));
    const mode = normalizeOfferPaymentAmountModeValue(amountSpec?.mode);
    if (mode === "PERCENTAGE_OF_OFFER_TOTAL") {
      const percentageBasisPoints = Math.max(0, Math.round(Number(amountSpec?.percentage_basis_points || 0)));
      return Math.max(0, Math.round((basisTotal * percentageBasisPoints) / 10000));
    }
    if (mode === "REMAINING_BALANCE") {
      return Math.max(0, basisTotal - allocated);
    }
    return Math.max(0, Math.round(Number(amountSpec?.fixed_amount_cents || 0)));
  }

  function normalizeOfferPaymentTermsDraft(rawPaymentTerms, fallbackCurrency = null) {
    const source = rawPaymentTerms && typeof rawPaymentTerms === "object" ? rawPaymentTerms : null;
    const currency = normalizeCurrencyCode(
      source?.currency
      || fallbackCurrency
      || state.offerDraft?.currency
      || state.booking?.preferred_currency
      || "USD"
    );
    const basisTotalAmountCents = Math.max(0, Math.round(resolveOfferTotalCents()));
    const sourceLines = Array.isArray(source?.lines) ? source.lines : [];
    const finalLineSource = sourceLines.find((line) => normalizeOfferPaymentTermKindValue(line?.kind) === "FINAL_BALANCE") || null;
    const preparedLines = sourceLines
      .filter((line) => normalizeOfferPaymentTermKindValue(line?.kind) !== "FINAL_BALANCE")
      .map((line, index) => ({
        line,
        index,
        sequence: Math.max(1, Math.round(Number(line?.sequence || index + 1)))
      }))
      .sort((left, right) => (left.sequence - right.sequence) || (left.index - right.index));

    let allocatedAmountCents = 0;
    let installmentNumber = 0;
    const lines = preparedLines.map(({ line, sequence }) => {
      const kind = normalizeOfferPaymentTermKindValue(line?.kind);
      if (kind === "INSTALLMENT") installmentNumber += 1;
      const amountSpec = normalizeOfferPaymentAmountSpecDraftValue(line?.amount_spec, kind, line?.resolved_amount_cents);

      const dueType = normalizeOfferPaymentDueTypeValue(line?.due_rule?.type);
      const dueRule = { type: dueType };
      if (offerPaymentDueTypeUsesFixedDate(dueType) && String(line?.due_rule?.fixed_date || "").trim()) {
        dueRule.fixed_date = String(line.due_rule.fixed_date).trim();
      }
      if (offerPaymentDueTypeUsesDays(dueType)) {
        dueRule.days = Math.max(0, Math.round(Number(line?.due_rule?.days || 0)));
      }

      const resolvedAmountCents = computeOfferPaymentResolvedAmountDraft(amountSpec, basisTotalAmountCents, allocatedAmountCents);
      allocatedAmountCents += resolvedAmountCents;

      return {
        id: String(line?.id || ""),
        kind,
        label: resolveOfferPaymentTermLabel(line?.label, kind, sequence, installmentNumber),
        sequence,
        amount_spec: amountSpec,
        resolved_amount_cents: resolvedAmountCents,
        due_rule: dueRule
      };
    });

    const finalLineTemplate = finalLineSource && typeof finalLineSource === "object"
      ? finalLineSource
      : createDefaultFinalOfferPaymentTermLine(lines.length + 1);
    const finalLineSequence = lines.length + 1;
    const finalLine = {
      id: String(finalLineTemplate?.id || ""),
      kind: "FINAL_BALANCE",
      label: resolveOfferPaymentTermLabel(finalLineTemplate?.label, "FINAL_BALANCE", finalLineSequence, installmentNumber),
      sequence: finalLineSequence,
      amount_spec: {
        mode: "REMAINING_BALANCE"
      },
      resolved_amount_cents: computeOfferPaymentResolvedAmountDraft(
        { mode: "REMAINING_BALANCE" },
        basisTotalAmountCents,
        allocatedAmountCents
      ),
      due_rule: (() => {
        const dueType = normalizeOfferPaymentDueTypeValue(finalLineTemplate?.due_rule?.type);
        const dueRule = { type: dueType };
        if (offerPaymentDueTypeUsesFixedDate(dueType) && String(finalLineTemplate?.due_rule?.fixed_date || "").trim()) {
          dueRule.fixed_date = String(finalLineTemplate.due_rule.fixed_date).trim();
        }
        if (offerPaymentDueTypeUsesDays(dueType)) {
          dueRule.days = Math.max(0, Math.round(Number(finalLineTemplate?.due_rule?.days || 0)));
        }
        return dueRule;
      })(),
    };
    lines.push(finalLine);

    return {
      currency,
      basis_total_amount_cents: basisTotalAmountCents,
      lines,
      scheduled_total_amount_cents: lines.reduce((sum, line) => sum + Math.max(0, Number(line?.resolved_amount_cents || 0)), 0)
    };
  }

  function getOfferPaymentTermsDraft() {
    const draft = normalizeOfferPaymentTermsDraft(
      state.offerDraft?.payment_terms,
      state.offerDraft?.currency || state.booking?.preferred_currency || "USD"
    );
    if (state.offerDraft) {
      state.offerDraft.payment_terms = draft;
    }
    return draft;
  }

  function ensureOfferPaymentTermsDraft() {
    const existing = getOfferPaymentTermsDraft();
    if (existing) return existing;
    const draft = normalizeOfferPaymentTermsDraft({
      currency: state.offerDraft?.currency || state.booking?.preferred_currency || "USD",
      lines: [createDefaultFinalOfferPaymentTermLine(1)]
    });
    state.offerDraft.payment_terms = draft;
    return draft;
  }

  function renderOfferPaymentTermsSummaryRows(paymentTerms, currency) {
    const finalPaymentLine = (Array.isArray(paymentTerms?.lines) ? paymentTerms.lines : []).find(
      (line) => normalizeOfferPaymentTermKindValue(line?.kind) === "FINAL_BALANCE"
    ) || null;
    return `
      <div class="offer-payment-terms__summary">
        <span class="offer-payment-terms__summary-label">${escapeHtml(bookingT("booking.offer.payment_terms.final_balance", "Final payment"))}</span>
        <span class="offer-payment-terms__summary-value" data-offer-payment-terms-final-payment>${escapeHtml(formatMoneyDisplay(finalPaymentLine?.resolved_amount_cents || paymentTerms?.basis_total_amount_cents || 0, currency))}</span>
      </div>
      <div class="offer-payment-terms__summary">
        <span class="offer-payment-terms__summary-label">${escapeHtml(bookingT("booking.offer.payment_terms.basis_total", "Offer total"))}</span>
        <span class="offer-payment-terms__summary-value" data-offer-payment-terms-basis-total>${escapeHtml(formatMoneyDisplay(paymentTerms?.basis_total_amount_cents || 0, currency))}</span>
      </div>
    `;
  }

  function renderOfferPaymentTermsValidationMarkup(message = "") {
    const normalizedMessage = String(message || "").trim();
    return `
      <div
        class="micro booking-inline-status offer-payment-terms__status ${normalizedMessage ? "booking-inline-status--error" : ""}"
        data-offer-payment-terms-status
      >${escapeHtml(normalizedMessage)}</div>
    `;
  }

  function validateOfferPaymentTermsTotal(paymentTerms = state.offerDraft?.payment_terms) {
    const draft = paymentTerms && typeof paymentTerms === "object" ? paymentTerms : null;
    if (!draft) return "";
    const currency = normalizeCurrencyCode(draft.currency || state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    const basisTotalAmountCents = Math.max(0, Math.round(Number(draft.basis_total_amount_cents || 0)));
    const scheduledAmountCents = (Array.isArray(draft.lines) ? draft.lines : [])
      .filter((line) => normalizeOfferPaymentTermKindValue(line?.kind) !== "FINAL_BALANCE")
      .reduce((sum, line) => sum + Math.max(0, Math.round(Number(line?.resolved_amount_cents || 0))), 0);
    if (scheduledAmountCents <= basisTotalAmountCents) return "";
    return bookingT(
      "booking.offer.payment_terms.error.total_exceeded",
      "Deposit and installments total {scheduled}, which exceeds the offer total {offerTotal}.",
      {
        scheduled: formatMoneyDisplay(scheduledAmountCents, currency),
        offerTotal: formatMoneyDisplay(basisTotalAmountCents, currency)
      }
    );
  }

  function syncOfferPaymentTermsValidationStatus(paymentTerms = state.offerDraft?.payment_terms) {
    const message = validateOfferPaymentTermsTotal(paymentTerms);
    const statusNode = els.offer_payment_terms?.querySelector("[data-offer-payment-terms-status]");
    const previousValidationMessage = statusNode instanceof HTMLElement ? String(statusNode.textContent || "").trim() : "";
    if (statusNode instanceof HTMLElement) {
      statusNode.textContent = message;
      statusNode.classList.toggle("booking-inline-status--error", Boolean(message));
    }
    if (message) {
      if (els.offer_status?.textContent !== message) {
        setOfferStatus?.(message, "error");
      }
      return false;
    }
    if (
      !String(els.offer_status?.textContent || "").trim()
      || (previousValidationMessage && els.offer_status?.textContent === previousValidationMessage)
    ) {
      clearOfferStatus();
    }
    return true;
  }

  function renderOfferPaymentTermAddRow(action, label) {
    return `
      <tr class="offer-payment-terms__add-row offer-payment-terms__add-row--${escapeHtml(action)}">
        <td colspan="6" class="offer-payment-terms__add-cell">
          <button class="btn btn-ghost offer-payment-terms__add-button" type="button" data-offer-payment-term-add="${escapeHtml(action)}">${escapeHtml(label)}</button>
        </td>
      </tr>
    `;
  }

  function updateOfferPaymentTermsInDom() {
    if (!els.offer_payment_terms) return;
    const paymentTerms = getOfferPaymentTermsDraft();
    if (!paymentTerms) return;
    const currency = normalizeCurrencyCode(paymentTerms.currency || state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    const rows = Array.from(els.offer_payment_terms.querySelectorAll("[data-offer-payment-term-resolved]"));
    rows.forEach((node) => {
      const index = Number(node.getAttribute("data-offer-payment-term-resolved"));
      const line = paymentTerms.lines[index];
      node.textContent = formatMoneyDisplay(line?.resolved_amount_cents || 0, currency);
    });
    const finalPaymentLine = (Array.isArray(paymentTerms?.lines) ? paymentTerms.lines : []).find(
      (line) => normalizeOfferPaymentTermKindValue(line?.kind) === "FINAL_BALANCE"
    ) || null;
    const finalNode = els.offer_payment_terms.querySelector("[data-offer-payment-terms-final-payment]");
    const basisNode = els.offer_payment_terms.querySelector("[data-offer-payment-terms-basis-total]");
    if (finalNode) {
      finalNode.textContent = formatMoneyDisplay(finalPaymentLine?.resolved_amount_cents || paymentTerms?.basis_total_amount_cents || 0, currency);
    }
    if (basisNode) {
      basisNode.textContent = formatMoneyDisplay(paymentTerms.basis_total_amount_cents || 0, currency);
    }
  }

  function renderOfferPaymentTerms() {
    if (!els.offer_payment_terms) return;
    const readOnly = !state.permissions.canEditBooking;
    const paymentTerms = getOfferPaymentTermsDraft();
    const lines = Array.isArray(paymentTerms?.lines) ? paymentTerms.lines : [];
    if ((!paymentTerms || !lines.length) && readOnly) {
      if (els.offer_payment_terms_panel) {
        els.offer_payment_terms_panel.hidden = true;
      }
      els.offer_payment_terms.hidden = true;
      els.offer_payment_terms.innerHTML = "";
      return;
    }
    if (els.offer_payment_terms_panel) {
      els.offer_payment_terms_panel.hidden = false;
    }
    const displayTerms = paymentTerms || ensureOfferPaymentTermsDraft();
    const currency = normalizeCurrencyCode(displayTerms.currency || state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    updateOfferPaymentTermsPanelSummary(displayTerms);
    if (readOnly) {
      const rows = lines
        .slice()
        .sort((left, right) => (Number(left?.sequence || 0) - Number(right?.sequence || 0)))
        .filter((line) => normalizeOfferPaymentTermKindValue(line?.kind) !== "FINAL_BALANCE")
        .map((line, index) => {
          const label = String(line?.label || "").trim() || formatPaymentTermKindLabel(line?.kind, "", {
            installmentNumber: resolveOfferPaymentTermInstallmentNumber(lines, index)
          });
          return `
            <tr class="offer-payment-terms__table-row">
              <td class="offer-payment-term-col-label">${escapeHtml(label)}</td>
              <td class="offer-payment-term-col-amount">${escapeHtml(formatPaymentTermAmountModeLabel(line?.amount_spec?.mode))}</td>
              <td class="offer-payment-term-col-value">${escapeHtml(formatPaymentTermAmountValueDisplay(line, currency))}</td>
              <td class="offer-payment-term-col-due">${escapeHtml(formatOfferPaymentDueRule(line?.due_rule))}</td>
              <td class="offer-payment-term-col-resolved">${escapeHtml(formatMoneyDisplay(line?.resolved_amount_cents || 0, currency))}</td>
              <td class="offer-payment-term-col-actions"></td>
            </tr>
          `;
        })
        .join("");
      els.offer_payment_terms.innerHTML = `
        <div class="backend-table-wrap offer-payment-terms__table-wrap">
          <table class="backend-table offer-payment-terms__table">
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${renderOfferPaymentTermsValidationMarkup(validateOfferPaymentTermsTotal(displayTerms))}
        ${renderOfferPaymentTermsSummaryRows(displayTerms, currency)}
      `;
      els.offer_payment_terms.hidden = false;
      renderOfferGenerationControls?.();
      return;
    }

    const amountStep = isWholeUnitCurrency(currency) ? "1" : "0.01";
    const rowEntries = lines.map((line, index) => {
      const amountMode = normalizeOfferPaymentAmountModeValue(line?.amount_spec?.mode);
      const dueType = normalizeOfferPaymentDueTypeValue(line?.due_rule?.type);
      const normalizedKind = normalizeOfferPaymentTermKindValue(line?.kind);
      const isFinalBalance = normalizedKind === "FINAL_BALANCE";
      const installmentNumber = resolveOfferPaymentTermInstallmentNumber(lines, index);
      const kindLabel = formatPaymentTermKindLabel(line?.kind, "", { installmentNumber });
      const amountModeFieldId = buildOfferPaymentTermFieldId("amount_mode", index);
      const fixedAmountFieldId = buildOfferPaymentTermFieldId("fixed_amount", index);
      const percentageFieldId = buildOfferPaymentTermFieldId("percentage", index);
      const dueTypeFieldId = buildOfferPaymentTermFieldId("due_type", index);
      const fixedDateFieldId = buildOfferPaymentTermFieldId("fixed_date", index);
      const daysFieldId = buildOfferPaymentTermFieldId("days", index);
      const dueEditor = `<div class="offer-payment-terms__due-editor" data-offer-payment-term-due-editor="${index}">
            <select
              id="${dueTypeFieldId}"
              name="${buildOfferPaymentTermFieldName("due_type", index)}"
              data-offer-payment-term-due-type="${index}"
            >
              ${OFFER_PAYMENT_DUE_TYPES.map((type) => `<option value="${escapeHtml(type)}" ${type === dueType ? "selected" : ""}>${escapeHtml(formatPaymentTermDueTypeLabel(type))}</option>`).join("")}
            </select>
            <input
              id="${fixedDateFieldId}"
              name="${buildOfferPaymentTermFieldName("fixed_date", index)}"
              type="date"
              data-offer-payment-term-fixed-date="${index}"
              value="${escapeHtml(String(line?.due_rule?.fixed_date || ""))}"
              ${offerPaymentDueTypeUsesFixedDate(dueType) ? "" : "hidden"}
            />
            <input
              id="${daysFieldId}"
              name="${buildOfferPaymentTermFieldName("days", index)}"
              type="number"
              min="0"
              step="1"
              data-offer-payment-term-days="${index}"
              value="${escapeHtml(String(Math.max(0, Number(line?.due_rule?.days || 0))))}"
              ${offerPaymentDueTypeUsesDays(dueType) ? "" : "hidden"}
            />
          </div>`;
      return {
        kind: normalizedKind,
        index,
        markup: `
        <tr class="offer-payment-terms__table-row">
          <td class="offer-payment-term-col-label">
            <div class="offer-payment-terms__static offer-payment-terms__label-text">${escapeHtml(String(line?.label || kindLabel))}</div>
          </td>
          <td class="offer-payment-term-col-amount">
            ${isFinalBalance
              ? `<div class="offer-payment-terms__static offer-payment-terms__static--empty"></div>`
              : `<select
                  id="${amountModeFieldId}"
                  name="${buildOfferPaymentTermFieldName("amount_mode", index)}"
                  data-offer-payment-term-amount-mode="${index}"
                >
                  ${OFFER_PAYMENT_EDITABLE_AMOUNT_MODES.map((mode) => `<option value="${escapeHtml(mode)}" ${mode === amountMode ? "selected" : ""}>${escapeHtml(formatPaymentTermAmountModeLabel(mode))}</option>`).join("")}
                </select>`}
          </td>
          <td class="offer-payment-term-col-value">
            ${amountMode === "FIXED_AMOUNT"
              ? `<input
                  id="${fixedAmountFieldId}"
                  name="${buildOfferPaymentTermFieldName("fixed_amount", index)}"
                  type="number"
                  min="0"
                  step="${amountStep}"
                  data-offer-payment-term-fixed-amount="${index}"
                  value="${escapeHtml(formatMoneyInputValue(line?.amount_spec?.fixed_amount_cents || 0, currency))}"
                />`
              : amountMode === "PERCENTAGE_OF_OFFER_TOTAL"
                ? `<div class="offer-payment-terms__input-with-suffix">
                    <input
                      id="${percentageFieldId}"
                      name="${buildOfferPaymentTermFieldName("percentage", index)}"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      data-offer-payment-term-percentage="${index}"
                      value="${escapeHtml(formatPercentageBasisPoints(line?.amount_spec?.percentage_basis_points || 0).replace(/%$/, ""))}"
                    />
                    <span>%</span>
                  </div>`
                : `<div class="offer-payment-terms__static offer-payment-terms__static--empty"></div>`}
          </td>
          <td class="offer-payment-term-col-due">
            ${dueEditor}
          </td>
          <td class="offer-payment-term-col-resolved">
            <div class="offer-payment-terms__resolved" data-offer-payment-term-resolved="${index}">${escapeHtml(formatMoneyDisplay(line?.resolved_amount_cents || 0, currency))}</div>
          </td>
          <td class="offer-payment-term-col-actions">
            ${isFinalBalance
              ? `<div class="offer-payment-terms__static offer-payment-terms__static--empty"></div>`
              : `<button class="btn btn-ghost offer-remove-btn" type="button" data-offer-payment-term-remove="${index}" title="${escapeHtml(bookingT("booking.offer.payment_terms.remove", "Remove payment term"))}" aria-label="${escapeHtml(bookingT("booking.offer.payment_terms.remove", "Remove payment term"))}">×</button>`}
          </td>
        </tr>
      `
      };
    });
    const depositRows = rowEntries
      .filter((entry) => entry.kind === "DEPOSIT")
      .map((entry) => entry.markup)
      .join("");
    const installmentRows = rowEntries
      .filter((entry) => entry.kind === "INSTALLMENT")
      .map((entry) => entry.markup)
      .join("");
    const editableRows = [
      depositRows || renderOfferPaymentTermAddRow("deposit", bookingT("booking.offer.payment_terms.add_deposit", "Add deposit")),
      installmentRows,
      renderOfferPaymentTermAddRow("installment", bookingT("booking.offer.payment_terms.add_installment", "Add Installment"))
    ].filter(Boolean).join("");

    els.offer_payment_terms.innerHTML = `
      <div class="backend-table-wrap offer-payment-terms__table-wrap">
        <table class="backend-table offer-payment-terms__table">
          <tbody>
            ${lines.length
              ? editableRows
              : `<tr><td colspan="6" class="offer-payment-terms__empty">${escapeHtml(bookingT("booking.offer.payment_terms.empty", "No payment terms yet."))}</td></tr>`}
          </tbody>
        </table>
      </div>
      ${renderOfferPaymentTermsValidationMarkup(validateOfferPaymentTermsTotal(displayTerms))}
      ${renderOfferPaymentTermsSummaryRows(displayTerms, currency)}
    `;
    els.offer_payment_terms.hidden = false;
    renderOfferGenerationControls?.();

    const markDirty = () => {
      setOfferSaveEnabled(true);
      syncOfferPaymentTermsValidationStatus(state.offerDraft?.payment_terms);
    };
    const syncComputedOnly = () => {
      state.offerDraft.payment_terms = normalizeOfferPaymentTermsDraft(
        state.offerDraft?.payment_terms,
        state.offerDraft?.currency || state.booking?.preferred_currency || "USD"
      );
      markDirty();
      updateOfferPaymentTermsInDom();
    };
    const syncComputedChanges = () => {
      syncComputedOnly();
    };
    const withLine = (index, callback) => {
      const draft = ensureOfferPaymentTermsDraft();
      const line = Array.isArray(draft.lines) ? draft.lines[index] : null;
      if (!line) return null;
      callback(line, draft);
      draft.lines = draft.lines.map((entry, entryIndex) => ({
        ...entry,
        sequence: entryIndex + 1
      }));
      state.offerDraft.payment_terms = normalizeOfferPaymentTermsDraft(draft, draft.currency);
      return state.offerDraft.payment_terms?.lines?.[index] || null;
    };

    els.offer_payment_terms.querySelectorAll("[data-offer-payment-term-add]").forEach((button) => {
      button.addEventListener("click", () => {
        const draft = ensureOfferPaymentTermsDraft();
        const currentLines = Array.isArray(draft.lines) ? draft.lines : [];
        const action = String(button.getAttribute("data-offer-payment-term-add") || "").trim().toLowerCase();
        const finalIndex = currentLines.findIndex((line) => normalizeOfferPaymentTermKindValue(line?.kind) === "FINAL_BALANCE");
        const nextLines = [...currentLines];
        if (action === "deposit") {
          const hasDeposit = currentLines.some((line) => normalizeOfferPaymentTermKindValue(line?.kind) === "DEPOSIT");
          if (hasDeposit) return;
          nextLines.splice(0, 0, createDefaultOfferPaymentDepositLine(1));
        } else {
          const installmentCount = currentLines.filter((line) => normalizeOfferPaymentTermKindValue(line?.kind) === "INSTALLMENT").length;
          const nextLine = createDefaultOfferPaymentInstallmentLine(
            finalIndex >= 0 ? finalIndex + 1 : currentLines.length + 1,
            installmentCount + 1
          );
          if (finalIndex >= 0) {
            nextLines.splice(finalIndex, 0, nextLine);
          } else {
            nextLines.push(nextLine, createDefaultFinalOfferPaymentTermLine(currentLines.length + 2));
          }
        }
        draft.lines = nextLines;
        state.offerDraft.payment_terms = normalizeOfferPaymentTermsDraft(draft, draft.currency);
        markDirty();
        renderOfferPaymentTerms();
      });
    });
    els.offer_payment_terms.querySelectorAll("[data-offer-payment-term-remove]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.getAttribute("data-offer-payment-term-remove"));
        const draft = ensureOfferPaymentTermsDraft();
        draft.lines.splice(index, 1);
        state.offerDraft.payment_terms = normalizeOfferPaymentTermsDraft(draft, draft.currency);
        markDirty();
        renderOfferPaymentTerms();
      });
    });
    els.offer_payment_terms.querySelectorAll("[data-offer-payment-term-amount-mode]").forEach((input) => {
      input.addEventListener("change", () => {
        const index = Number(input.getAttribute("data-offer-payment-term-amount-mode"));
        withLine(index, (line) => {
          const nextMode = normalizeOfferPaymentAmountModeValue(input.value);
          line.amount_spec = normalizeOfferPaymentAmountSpecDraftValue(
            { mode: nextMode, fixed_amount_cents: line.resolved_amount_cents, percentage_basis_points: 1000 },
            line.kind,
            line.resolved_amount_cents
          );
        });
        markDirty();
        renderOfferPaymentTerms();
      });
    });
    els.offer_payment_terms.querySelectorAll("[data-offer-payment-term-fixed-amount]").forEach((input) => {
      input.addEventListener("input", () => {
        const index = Number(input.getAttribute("data-offer-payment-term-fixed-amount"));
        withLine(index, (line) => {
          line.amount_spec = normalizeOfferPaymentAmountSpecDraftValue(
            {
              mode: "FIXED_AMOUNT",
              fixed_amount_cents: parseMoneyInputValue(input.value, currency)
            },
            line.kind,
            line.resolved_amount_cents
          );
        });
        syncComputedOnly();
      });
      input.addEventListener("change", syncComputedChanges);
    });
    els.offer_payment_terms.querySelectorAll("[data-offer-payment-term-percentage]").forEach((input) => {
      input.addEventListener("input", () => {
        const index = Number(input.getAttribute("data-offer-payment-term-percentage"));
        withLine(index, (line) => {
          line.amount_spec = normalizeOfferPaymentAmountSpecDraftValue(
            {
              mode: "PERCENTAGE_OF_OFFER_TOTAL",
              percentage_basis_points: Math.max(0, Math.round(Number(input.value || 0) * 100))
            },
            line.kind,
            line.resolved_amount_cents
          );
        });
        syncComputedOnly();
      });
      input.addEventListener("change", syncComputedChanges);
    });
    els.offer_payment_terms.querySelectorAll("[data-offer-payment-term-due-type]").forEach((input) => {
      input.addEventListener("change", () => {
        const index = Number(input.getAttribute("data-offer-payment-term-due-type"));
        const requestedDueType = normalizeOfferPaymentDueTypeValue(input.value);
        withLine(index, (line) => {
          const nextType = requestedDueType;
          line.due_rule = { type: nextType };
          if (offerPaymentDueTypeUsesFixedDate(nextType)) {
            line.due_rule.fixed_date = "";
          } else if (offerPaymentDueTypeUsesDays(nextType)) {
            line.due_rule.days = 0;
          }
        });
        markDirty();
        const dueEditor = els.offer_payment_terms?.querySelector(`[data-offer-payment-term-due-editor="${index}"]`);
        const fixedDateInput = els.offer_payment_terms?.querySelector(`[data-offer-payment-term-fixed-date="${index}"]`);
        const daysInput = els.offer_payment_terms?.querySelector(`[data-offer-payment-term-days="${index}"]`);
        if (fixedDateInput) {
          fixedDateInput.hidden = !offerPaymentDueTypeUsesFixedDate(requestedDueType);
          if (offerPaymentDueTypeUsesFixedDate(requestedDueType) && !String(fixedDateInput.value || "").trim()) {
            fixedDateInput.value = "";
          }
        }
        if (daysInput) {
          daysInput.hidden = !offerPaymentDueTypeUsesDays(requestedDueType);
          if (offerPaymentDueTypeUsesDays(requestedDueType)) {
            daysInput.value = String(Math.max(0, Number(state.offerDraft?.payment_terms?.lines?.[index]?.due_rule?.days || 0)));
          }
        }
        if (!dueEditor) {
          console.error("[offer-payment-terms] Due type editor mount not found after change.", {
            reason: "The booking payment-terms row editor could not be updated in place after the user changed the due type.",
            lineIndex: index,
            requestedDueType
          });
        }
      });
    });
    els.offer_payment_terms.querySelectorAll("[data-offer-payment-term-fixed-date]").forEach((input) => {
      input.addEventListener("input", () => {
        const index = Number(input.getAttribute("data-offer-payment-term-fixed-date"));
        withLine(index, (line) => {
          line.due_rule.type = "FIXED_DATE";
          line.due_rule.fixed_date = String(input.value || "");
        });
        markDirty();
      });
      input.addEventListener("change", () => {
        const index = Number(input.getAttribute("data-offer-payment-term-fixed-date"));
        withLine(index, (line) => {
          line.due_rule.type = "FIXED_DATE";
          line.due_rule.fixed_date = String(input.value || "");
        });
        syncComputedOnly();
      });
    });
    els.offer_payment_terms.querySelectorAll("[data-offer-payment-term-days]").forEach((input) => {
      input.addEventListener("input", () => {
        const index = Number(input.getAttribute("data-offer-payment-term-days"));
        withLine(index, (line) => {
          line.due_rule.days = Math.max(0, Math.round(Number(input.value || 0)));
        });
        markDirty();
      });
      input.addEventListener("change", syncComputedChanges);
    });
  }

  return {
    ensureOfferPaymentTermsDraft,
    formatPaymentTermKindLabel,
    getOfferPaymentTermsDraft,
    logOfferPaymentTermDueTypeMismatch,
    normalizeOfferPaymentAmountModeValue,
    normalizeOfferPaymentAmountSpecDraftValue,
    normalizeOfferPaymentDueTypeValue,
    normalizeOfferPaymentTermKindValue,
    normalizeOfferPaymentTermsDraft,
    offerPaymentDueTypeUsesDays,
    offerPaymentDueTypeUsesFixedDate,
    renderOfferPaymentTerms,
    resolveOfferPaymentTermInstallmentNumber,
    validateOfferPaymentTermsTotal,
    updateOfferPaymentTermsInDom
  };
}
