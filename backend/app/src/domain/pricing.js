import path from "node:path";
import { normalizeText } from "../lib/text.js";
import { normalizeGeneratedEnumValue } from "../lib/generated_catalogs.js";
import {
  normalizeBookingContentLang,
  normalizeLocalizedTextMap,
  resolveLocalizedText
} from "./booking_content_i18n.js";

export function createPricingHelpers({
  baseCurrency,
  exchangeRateOverrides,
  fxRateCache,
  fxRateCacheTtlMs,
  defaultOfferTaxRateBasisPoints,
  offerCategories,
  offerCategoryOrder,
  pricingAdjustmentTypes,
  paymentStatuses,
  generatedCurrencyDefinition,
  normalizeGeneratedCurrencyCode,
  clamp,
  safeInt,
  randomUUID,
  invoicesDir,
  generatedOffersDir
}) {
  const OFFER_DETAIL_LEVEL_ORDER = Object.freeze({
    trip: 1,
    day: 2
  });

  function normalizeAmountCents(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.round(number);
  }

  function normalizeOfferCategory(value) {
    const category = normalizeText(value).toUpperCase();
    return offerCategoryOrder.includes(category) ? category : offerCategories.OTHER;
  }

  function normalizeOfferDetailLevel(value, fallback = "trip") {
    const normalized = normalizeText(value).toLowerCase();
    return Object.prototype.hasOwnProperty.call(OFFER_DETAIL_LEVEL_ORDER, normalized) ? normalized : fallback;
  }

  function isVisibleDetailLevelFinerThanInternal(visible, internal) {
    return (OFFER_DETAIL_LEVEL_ORDER[visible] || 0) > (OFFER_DETAIL_LEVEL_ORDER[internal] || 0);
  }

  function inferInternalOfferDetailLevel(source, fallback = "trip") {
    const explicit = normalizeText(source?.offer_detail_level_internal).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(OFFER_DETAIL_LEVEL_ORDER, explicit)) return explicit;
    if (Array.isArray(source?.days_internal) && source.days_internal.length) return "day";
    if (source?.trip_price_internal && typeof source.trip_price_internal === "object") return "trip";
    if (Array.isArray(source?.components) && source.components.length) {
      return source.components.every((component) => {
        const dayNumber = Number.parseInt(component?.day_number, 10);
        return Number.isInteger(dayNumber) && dayNumber >= 1;
      })
        ? "day"
        : "trip";
    }
    return fallback;
  }

  function offerCategorySign(category) {
    return normalizeOfferCategory(category) === offerCategories.DISCOUNTS_CREDITS ? -1 : 1;
  }

  function clampOfferTaxRateBasisPoints(value, fallback = defaultOfferTaxRateBasisPoints) {
    const number = safeInt(value);
    if (!Number.isFinite(number)) return fallback;
    return clamp(number, 0, 100000);
  }

  function computeOfferLineAmounts(line, overrides = {}) {
    const category = normalizeOfferCategory(overrides.category ?? line?.category);
    const quantity = Math.max(1, safeInt(overrides.quantity ?? line?.quantity) || 1);
    const unitNetAmountCents = Math.max(0, normalizeAmountCents(
      overrides.unit_amount_cents ?? overrides.unitAmountCents ?? line?.unit_amount_cents,
      0
    ));
    const taxRateBasisPoints = clampOfferTaxRateBasisPoints(
      overrides.tax_rate_basis_points ?? overrides.taxRateBasisPoints ?? line?.tax_rate_basis_points,
      defaultOfferTaxRateBasisPoints
    );
    const sign = offerCategorySign(category);
    const unitTaxAmountCents = Math.round((unitNetAmountCents * taxRateBasisPoints) / 10000);
    const unitTotalAmountCents = unitNetAmountCents + unitTaxAmountCents;
    const lineNetAmountCents = sign * unitNetAmountCents * quantity;
    const lineTaxAmountCents = sign * unitTaxAmountCents * quantity;
    const lineGrossAmountCents = sign * unitTotalAmountCents * quantity;
    return {
      category,
      quantity,
      tax_rate_basis_points: taxRateBasisPoints,
      unit_amount_cents: unitNetAmountCents,
      unit_net_amount_cents: unitNetAmountCents,
      unit_tax_amount_cents: unitTaxAmountCents,
      unit_total_amount_cents: unitTotalAmountCents,
      line_net_amount_cents: lineNetAmountCents,
      line_tax_amount_cents: lineTaxAmountCents,
      line_gross_amount_cents: lineGrossAmountCents,
      line_total_amount_cents: lineGrossAmountCents
    };
  }

  function computeTripPriceInternalAmounts(tripPrice, overrides = {}) {
    const amountCents = Math.max(0, normalizeAmountCents(
      overrides.amount_cents ?? overrides.amountCents ?? tripPrice?.amount_cents,
      0
    ));
    const taxRateBasisPoints = clampOfferTaxRateBasisPoints(
      overrides.tax_rate_basis_points ?? overrides.taxRateBasisPoints ?? tripPrice?.tax_rate_basis_points,
      defaultOfferTaxRateBasisPoints
    );
    const taxAmountCents = Math.round((amountCents * taxRateBasisPoints) / 10000);
    return {
      amount_cents: amountCents,
      tax_rate_basis_points: taxRateBasisPoints,
      line_net_amount_cents: amountCents,
      line_tax_amount_cents: taxAmountCents,
      line_gross_amount_cents: amountCents + taxAmountCents,
      line_total_amount_cents: amountCents + taxAmountCents
    };
  }

  function computeOfferDayPriceInternalAmounts(dayPrice, overrides = {}) {
    return computeTripPriceInternalAmounts(dayPrice, overrides);
  }

  function computeOfferAdditionalItemAmounts(item, overrides = {}) {
    const quantity = Math.max(1, safeInt(overrides.quantity ?? item?.quantity) || 1);
    const unitAmountCents = Math.max(0, normalizeAmountCents(
      overrides.unit_amount_cents ?? overrides.unitAmountCents ?? item?.unit_amount_cents,
      0
    ));
    const taxRateBasisPoints = clampOfferTaxRateBasisPoints(
      overrides.tax_rate_basis_points ?? overrides.taxRateBasisPoints ?? item?.tax_rate_basis_points,
      defaultOfferTaxRateBasisPoints
    );
    const unitTaxAmountCents = Math.round((unitAmountCents * taxRateBasisPoints) / 10000);
    const unitTotalAmountCents = unitAmountCents + unitTaxAmountCents;
    return {
      quantity,
      tax_rate_basis_points: taxRateBasisPoints,
      unit_amount_cents: unitAmountCents,
      unit_tax_amount_cents: unitTaxAmountCents,
      unit_total_amount_cents: unitTotalAmountCents,
      line_net_amount_cents: unitAmountCents * quantity,
      line_tax_amount_cents: unitTaxAmountCents * quantity,
      line_gross_amount_cents: unitTotalAmountCents * quantity,
      line_total_amount_cents: unitTotalAmountCents * quantity
    };
  }

  function computeOfferDiscountAmounts(discount, overrides = {}) {
    const amountCents = Math.max(0, normalizeAmountCents(
      overrides.amount_cents ?? overrides.amountCents ?? discount?.amount_cents,
      0
    ));
    return {
      amount_cents: amountCents,
      line_net_amount_cents: -amountCents,
      line_tax_amount_cents: 0,
      line_gross_amount_cents: -amountCents
    };
  }

  function createOfferTaxBucket(taxRateBasisPoints) {
    return {
      tax_rate_basis_points: taxRateBasisPoints,
      net_amount_cents: 0,
      tax_amount_cents: 0,
      gross_amount_cents: 0,
      items_count: 0
    };
  }

  function accumulateOfferTaxBucket(buckets, line, fallbackTaxRateBasisPoints = defaultOfferTaxRateBasisPoints) {
    const taxRateBasisPoints = clampOfferTaxRateBasisPoints(line?.tax_rate_basis_points, fallbackTaxRateBasisPoints);
    const netAmountCents = normalizeAmountCents(line?.line_net_amount_cents, 0);
    const taxAmountCents = normalizeAmountCents(line?.line_tax_amount_cents, 0);
    const grossAmountCents = normalizeAmountCents(
      line?.line_gross_amount_cents,
      normalizeAmountCents(line?.line_total_amount_cents, netAmountCents + taxAmountCents)
    );
    if (!netAmountCents && !taxAmountCents && !grossAmountCents) return;
    const bucket = buckets.get(taxRateBasisPoints) || createOfferTaxBucket(taxRateBasisPoints);
    bucket.net_amount_cents += netAmountCents;
    bucket.tax_amount_cents += taxAmountCents;
    bucket.gross_amount_cents += grossAmountCents;
    bucket.items_count += 1;
    buckets.set(taxRateBasisPoints, bucket);
  }

  function buildOfferTaxBreakdownFromLines(lines) {
    const buckets = new Map();
    for (const line of Array.isArray(lines) ? lines : []) {
      accumulateOfferTaxBucket(buckets, line);
    }
    return Array.from(buckets.values()).sort((left, right) => left.tax_rate_basis_points - right.tax_rate_basis_points);
  }

  function buildOfferQuotationSummaryFromLines(lines) {
    const chargeLines = Array.isArray(lines) ? lines : [];
    const totals = chargeLines.reduce((acc, line) => {
      acc.net_amount_cents += normalizeAmountCents(line?.line_net_amount_cents, 0);
      acc.tax_amount_cents += normalizeAmountCents(line?.line_tax_amount_cents, 0);
      acc.gross_amount_cents += normalizeAmountCents(
        line?.line_gross_amount_cents,
        normalizeAmountCents(line?.line_total_amount_cents, 0)
      );
      return acc;
    }, {
      net_amount_cents: 0,
      tax_amount_cents: 0,
      gross_amount_cents: 0
    });
    return {
      tax_included: true,
      subtotal_net_amount_cents: totals.net_amount_cents,
      total_tax_amount_cents: totals.tax_amount_cents,
      grand_total_amount_cents: totals.gross_amount_cents,
      tax_breakdown: buildOfferTaxBreakdownFromLines(chargeLines)
    };
  }

  function resolveAggregateTaxRateBasisPoints(lines) {
    const normalizedLines = Array.isArray(lines) ? lines : [];
    const populatedRates = normalizedLines
      .filter((line) => normalizeAmountCents(line?.line_gross_amount_cents, 0) > 0)
      .map((line) => clampOfferTaxRateBasisPoints(line?.tax_rate_basis_points, 0));
    const uniqueRates = [...new Set(populatedRates)];
    if (!uniqueRates.length) return 0;
    if (uniqueRates.length === 1) return uniqueRates[0];
    const netAmountCents = normalizedLines.reduce(
      (sum, line) => sum + Math.max(0, normalizeAmountCents(line?.line_net_amount_cents, 0)),
      0
    );
    const taxAmountCents = normalizedLines.reduce(
      (sum, line) => sum + Math.max(0, normalizeAmountCents(line?.line_tax_amount_cents, 0)),
      0
    );
    if (netAmountCents <= 0 || taxAmountCents <= 0) return 0;
    return clampOfferTaxRateBasisPoints(Math.round((taxAmountCents * 10000) / netAmountCents), 0);
  }

  function aggregateLegacyOfferLines(lines, { id, dayNumber = null, label = "", notes = "", currency, sortOrder = 0 } = {}) {
    const normalizedLines = Array.isArray(lines) ? lines : [];
    if (!normalizedLines.length) return null;
    const lineNetAmountCents = normalizedLines.reduce(
      (sum, line) => sum + Math.max(0, normalizeAmountCents(line?.line_net_amount_cents, 0)),
      0
    );
    const lineTaxAmountCents = normalizedLines.reduce(
      (sum, line) => sum + Math.max(0, normalizeAmountCents(line?.line_tax_amount_cents, 0)),
      0
    );
    const lineGrossAmountCents = normalizedLines.reduce(
      (sum, line) => sum + Math.max(0, normalizeAmountCents(line?.line_gross_amount_cents, 0)),
      0
    );
    const normalized = {
      id,
      amount_cents: lineNetAmountCents,
      tax_rate_basis_points: resolveAggregateTaxRateBasisPoints(normalizedLines),
      currency: safeCurrency(currency),
      sort_order: sortOrder,
      line_net_amount_cents: lineNetAmountCents,
      line_tax_amount_cents: lineTaxAmountCents,
      line_gross_amount_cents: lineGrossAmountCents,
      line_total_amount_cents: lineGrossAmountCents
    };
    if (Number.isInteger(dayNumber) && dayNumber >= 1) normalized.day_number = dayNumber;
    if (normalizeText(label)) normalized.label = normalizeText(label);
    if (normalizeText(notes)) normalized.notes = normalizeText(notes);
    return normalized;
  }

  function buildOfferChargeLines(offer) {
    const internalDetailLevel = normalizeOfferDetailLevel(offer?.offer_detail_level_internal);
    const lines = [];
    if (internalDetailLevel === "day") {
      lines.push(...(Array.isArray(offer?.days_internal) ? offer.days_internal : []));
    } else if (internalDetailLevel === "trip" && offer?.trip_price_internal) {
      lines.push(offer.trip_price_internal);
    }
    lines.push(...(Array.isArray(offer?.additional_items) ? offer.additional_items : []));
    const discounts = Array.isArray(offer?.discounts) ? offer.discounts : [];
    for (const discount of discounts) {
      if (!discount || normalizeAmountCents(discount?.amount_cents, 0) <= 0) continue;
      const computed = computeOfferDiscountAmounts(discount);
      lines.push({
        tax_rate_basis_points: 0,
        line_net_amount_cents: computed.line_net_amount_cents,
        line_tax_amount_cents: computed.line_tax_amount_cents,
        line_gross_amount_cents: computed.line_gross_amount_cents,
        line_total_amount_cents: computed.line_gross_amount_cents
      });
    }
    return lines;
  }

  function computeBookingOfferTaxBreakdown(offer) {
    return buildOfferTaxBreakdownFromLines(buildOfferChargeLines(offer));
  }

  function computeBookingOfferTotals(offer) {
    const internalDetailLevel = normalizeOfferDetailLevel(offer?.offer_detail_level_internal);
    const mainItemsCount = internalDetailLevel === "trip"
      ? (offer?.trip_price_internal ? 1 : 0)
      : internalDetailLevel === "day"
        ? (Array.isArray(offer?.days_internal) ? offer.days_internal.length : 0)
        : 0;
    const additionalItemsCount = Array.isArray(offer?.additional_items) ? offer.additional_items.length : 0;
    const discountsCount = (Array.isArray(offer?.discounts) ? offer.discounts : [])
      .filter((discount) => normalizeAmountCents(discount?.amount_cents, 0) > 0)
      .length;
    const totals = buildOfferChargeLines(offer).reduce((acc, component) => {
      acc.net_amount_cents += normalizeAmountCents(component?.line_net_amount_cents, 0);
      acc.tax_amount_cents += normalizeAmountCents(component?.line_tax_amount_cents, 0);
      acc.gross_amount_cents += normalizeAmountCents(
        component?.line_gross_amount_cents,
        normalizeAmountCents(component?.line_total_amount_cents, 0)
      );
      return acc;
    }, {
      net_amount_cents: 0,
      tax_amount_cents: 0,
      gross_amount_cents: 0
    });
    return {
      ...totals,
      total_price_cents: totals.gross_amount_cents,
      items_count: mainItemsCount + additionalItemsCount + discountsCount
    };
  }

  function computeBookingOfferQuotationSummary(offer) {
    return buildOfferQuotationSummaryFromLines(buildOfferChargeLines(offer));
  }

  function createVisibleProjectionLine({
    label = "",
    dayNumber = null,
    currency = baseCurrency,
    lines = []
  } = {}) {
    const summary = (Array.isArray(lines) ? lines : []).reduce((acc, line) => {
      acc.line_net_amount_cents += normalizeAmountCents(line?.line_net_amount_cents, 0);
      acc.line_tax_amount_cents += normalizeAmountCents(line?.line_tax_amount_cents, 0);
      acc.line_gross_amount_cents += normalizeAmountCents(
        line?.line_gross_amount_cents,
        normalizeAmountCents(line?.line_total_amount_cents, 0)
      );
      return acc;
    }, {
      line_net_amount_cents: 0,
      line_tax_amount_cents: 0,
      line_gross_amount_cents: 0
    });
    const normalized = {
      amount_cents: summary.line_net_amount_cents,
      currency: safeCurrency(currency),
      line_net_amount_cents: summary.line_net_amount_cents,
      line_tax_amount_cents: summary.line_tax_amount_cents,
      line_gross_amount_cents: summary.line_gross_amount_cents
    };
    const normalizedLabel = normalizeText(label);
    if (normalizedLabel) normalized.label = normalizedLabel;
    if (Number.isInteger(dayNumber) && dayNumber >= 1) normalized.day_number = dayNumber;
    return normalized;
  }

  function isSyntheticCarryOverAdditionalItem(item) {
    const details = normalizeText(item?.details).toLowerCase();
    if (!details) return false;
    return details === "carry-over surcharge" || details === "carry over surcharge";
  }

  function buildVisiblePricingProjection(offer) {
    const normalizedOffer = normalizeBookingOffer(offer, getOfferCurrencyForStorage(offer));
    const visibleDetailLevel = normalizeOfferDetailLevel(normalizedOffer?.offer_detail_level_visible);
    const internalDetailLevel = normalizeOfferDetailLevel(normalizedOffer?.offer_detail_level_internal);
    const currency = safeCurrency(normalizedOffer?.currency || baseCurrency);
    const additionalItems = Array.isArray(normalizedOffer?.additional_items) ? normalizedOffer.additional_items : [];
    const foldedCarryOverItems = visibleDetailLevel === "trip"
      ? additionalItems.filter((item) => isSyntheticCarryOverAdditionalItem(item))
      : [];
    const visibleAdditionalItems = foldedCarryOverItems.length
      ? additionalItems.filter((item) => !isSyntheticCarryOverAdditionalItem(item))
      : additionalItems;
    const projection = {
      detail_level: visibleDetailLevel,
      derivable: true,
      days: [],
      additional_items: visibleAdditionalItems
    };

    if (visibleDetailLevel === "trip") {
      if (internalDetailLevel === "trip" && normalizedOffer?.trip_price_internal) {
        projection.trip_price = createVisibleProjectionLine({
          label: normalizedOffer.trip_price_internal?.label || "Trip total",
          currency,
          lines: [normalizedOffer.trip_price_internal, ...foldedCarryOverItems]
        });
        return projection;
      }
      if (internalDetailLevel === "day") {
        projection.trip_price = createVisibleProjectionLine({
          label: "Trip total",
          currency,
          lines: [...normalizedOffer.days_internal, ...foldedCarryOverItems]
        });
        return projection;
      }
      projection.trip_price = createVisibleProjectionLine({
        label: "Trip total",
        currency,
        lines: foldedCarryOverItems
      });
      return projection;
    }

    if (visibleDetailLevel === "day") {
      if (internalDetailLevel === "day") {
        projection.days = (Array.isArray(normalizedOffer.days_internal) ? normalizedOffer.days_internal : []).map((dayPrice) =>
          createVisibleProjectionLine({
            label: dayPrice?.label || `Day ${dayPrice?.day_number || ""}`.trim(),
            dayNumber: Number.isInteger(dayPrice?.day_number) ? dayPrice.day_number : null,
            currency,
            lines: [dayPrice]
          })
        );
        return projection;
      }
      projection.derivable = false;
      return projection;
    }

    return projection;
  }

  function normalizeOfferPaymentTermKind(value) {
    return normalizeGeneratedEnumValue("OfferPaymentTermKind", value, "INSTALLMENT", {
      transform: (rawValue) => normalizeText(rawValue).toUpperCase()
    });
  }

  function normalizeOfferPaymentAmountMode(value) {
    return normalizeGeneratedEnumValue("OfferPaymentAmountMode", value, "FIXED_AMOUNT", {
      transform: (rawValue) => normalizeText(rawValue).toUpperCase()
    });
  }

  function normalizeOfferPaymentDueType(value) {
    return normalizeGeneratedEnumValue("OfferPaymentDueType", value, "ON_ACCEPTANCE", {
      transform: (rawValue) => normalizeText(rawValue).toUpperCase()
    });
  }

  function legacyDefaultOfferPaymentTermLabel(kind, sequence) {
    if (kind === "DEPOSIT") return "Deposit";
    if (kind === "FINAL_BALANCE") return "Final payment";
    return sequence > 1 ? `Installment ${sequence}` : "Installment";
  }

  function defaultOfferPaymentTermLabel(kind, installmentNumber = 1) {
    if (kind === "DEPOSIT") return "Deposit";
    if (kind === "FINAL_BALANCE") return "Final payment";
    return `Installment ${Math.max(1, Number(installmentNumber || 1))}`;
  }

  function resolveOfferPaymentTermLabel(rawLabel, kind, sequence, installmentNumber) {
    const explicitLabel = normalizeText(rawLabel);
    const nextDefaultLabel = defaultOfferPaymentTermLabel(kind, installmentNumber);
    if (!explicitLabel) return nextDefaultLabel;
    const legacyDefaultLabel = legacyDefaultOfferPaymentTermLabel(kind, sequence);
    if (explicitLabel === legacyDefaultLabel || explicitLabel === nextDefaultLabel) {
      return nextDefaultLabel;
    }
    return explicitLabel;
  }

  function normalizeOfferPaymentDueRule(rawDueRule) {
    const source = rawDueRule && typeof rawDueRule === "object" ? rawDueRule : {};
    const type = normalizeOfferPaymentDueType(source.type);
    const normalized = { type };
    if (type === "FIXED_DATE") {
      const fixedDate = normalizeText(source.fixed_date);
      if (fixedDate) normalized.fixed_date = fixedDate;
    }
    if (type === "DAYS_AFTER_ACCEPTANCE" || type === "DAYS_BEFORE_TRIP_START" || type === "DAYS_AFTER_TRIP_START" || type === "DAYS_AFTER_TRIP_END") {
      normalized.days = Math.max(0, safeInt(source.days) || 0);
    }
    return normalized;
  }

  function normalizeOfferPaymentAmountSpec(rawAmountSpec, kind = "INSTALLMENT", fallbackResolvedAmountCents = 0) {
    const source = rawAmountSpec && typeof rawAmountSpec === "object" ? rawAmountSpec : {};
    const normalizedKind = normalizeOfferPaymentTermKind(kind);
    if (normalizedKind === "FINAL_BALANCE") {
      return { mode: "REMAINING_BALANCE" };
    }
    const mode = normalizeOfferPaymentAmountMode(source.mode);
    if (mode === "REMAINING_BALANCE") {
      return {
        mode: "FIXED_AMOUNT",
        fixed_amount_cents: Math.max(
          0,
          normalizeAmountCents(source.fixed_amount_cents, normalizeAmountCents(fallbackResolvedAmountCents, 0))
        )
      };
    }
    const normalized = { mode };
    if (mode === "FIXED_AMOUNT") {
      normalized.fixed_amount_cents = Math.max(0, normalizeAmountCents(source.fixed_amount_cents, 0));
    }
    if (mode === "PERCENTAGE_OF_OFFER_TOTAL") {
      normalized.percentage_basis_points = clamp(safeInt(source.percentage_basis_points) || 0, 1, 10000);
    }
    return normalized;
  }

  function computeOfferPaymentResolvedAmount(amountSpec, basisTotalAmountCents, allocatedAmountCents) {
    const basisTotal = Math.max(0, normalizeAmountCents(basisTotalAmountCents, 0));
    const allocated = Math.max(0, normalizeAmountCents(allocatedAmountCents, 0));
    if (amountSpec.mode === "PERCENTAGE_OF_OFFER_TOTAL") {
      return Math.max(0, Math.round((basisTotal * amountSpec.percentage_basis_points) / 10000));
    }
    if (amountSpec.mode === "REMAINING_BALANCE") {
      return Math.max(0, basisTotal - allocated);
    }
    return Math.max(0, normalizeAmountCents(amountSpec.fixed_amount_cents, 0));
  }

  function computeBookingOfferPaymentTermsScheduledTotal(lines) {
    return (Array.isArray(lines) ? lines : []).reduce(
      (sum, line) => sum + Math.max(0, normalizeAmountCents(line?.resolved_amount_cents, 0)),
      0
    );
  }

  function normalizeBookingOfferPaymentTerms(rawPaymentTerms, currency, basisTotalAmountCents) {
    const source = rawPaymentTerms && typeof rawPaymentTerms === "object" ? rawPaymentTerms : null;
    if (!source) return null;
    const rawLines = Array.isArray(source.lines) ? source.lines : [];
    const preparedLines = rawLines
      .map((line, index) => ({
        line,
        index,
        sequence: Math.max(1, safeInt(line?.sequence) || (index + 1))
      }))
      .sort((left, right) => (left.sequence - right.sequence) || (left.index - right.index));

    let allocatedAmountCents = 0;
    let installmentCount = 0;
    const lines = preparedLines.map(({ line, index, sequence }) => {
      const kind = normalizeOfferPaymentTermKind(line?.kind);
      const installmentNumber = kind === "INSTALLMENT" ? (installmentCount += 1) : null;
      const amountSpec = normalizeOfferPaymentAmountSpec(line?.amount_spec, kind, line?.resolved_amount_cents);
      const resolvedAmountCents = computeOfferPaymentResolvedAmount(amountSpec, basisTotalAmountCents, allocatedAmountCents);
      allocatedAmountCents += resolvedAmountCents;
      const normalizedLine = {
        id: normalizeText(line?.id) || `offer_payment_term_${index + 1}`,
        kind,
        label: resolveOfferPaymentTermLabel(line?.label, kind, sequence, installmentNumber),
        sequence,
        amount_spec: amountSpec,
        resolved_amount_cents: resolvedAmountCents,
        due_rule: normalizeOfferPaymentDueRule(line?.due_rule)
      };
      return normalizedLine;
    });

    const normalized = {
      currency: safeCurrency(currency),
      lines
    };
    return normalized;
  }

  function normalizeBookingOfferDiscount(rawDiscount, currency, index = 0) {
    const source = rawDiscount && typeof rawDiscount === "object" ? rawDiscount : null;
    if (!source) return null;
    const reason = normalizeText(source.reason ?? source.details ?? source.description ?? source.label);
    const amountCents = Math.max(
      0,
      normalizeAmountCents(source.amount_cents ?? source.gross_amount_cents, 0)
    );
    if (amountCents <= 0) return null;
    const computed = computeOfferDiscountAmounts({ amount_cents: amountCents });
    return {
      id: normalizeText(source.id) || `offer_discount_${index + 1}`,
      reason,
      amount_cents: amountCents,
      currency: safeCurrency(currency),
      line_net_amount_cents: computed.line_net_amount_cents,
      line_tax_amount_cents: computed.line_tax_amount_cents,
      line_gross_amount_cents: computed.line_gross_amount_cents,
      sort_order: Number.isFinite(Number(source.sort_order)) ? Number(source.sort_order) : index,
      created_at: source.created_at || null,
      updated_at: source.updated_at || null
    };
  }

  function normalizeBookingOfferDiscounts(rawDiscounts, currency) {
    return (Array.isArray(rawDiscounts) ? rawDiscounts : [])
      .map((discount, index) => normalizeBookingOfferDiscount(discount, currency, index))
      .filter(Boolean);
  }

  function buildBookingOfferPaymentTermsReadModel(rawPaymentTerms, currency, basisTotalAmountCents) {
    const normalized = normalizeBookingOfferPaymentTerms(rawPaymentTerms, currency, basisTotalAmountCents);
    if (!normalized) return null;
    return {
      ...normalized,
      basis_total_amount_cents: Math.max(0, normalizeAmountCents(basisTotalAmountCents, 0)),
      scheduled_total_amount_cents: computeBookingOfferPaymentTermsScheduledTotal(normalized.lines)
    };
  }

  function defaultBookingPricing() {
    return {
      currency: baseCurrency,
      payments: []
    };
  }

  function normalizeBookingOfferTripPriceInternal(rawTripPrice, currency) {
    const source = rawTripPrice && typeof rawTripPrice === "object" ? rawTripPrice : null;
    if (!source) return null;
    const computedAmounts = computeTripPriceInternalAmounts(source);
    const normalized = {
      amount_cents: computedAmounts.amount_cents,
      tax_rate_basis_points: computedAmounts.tax_rate_basis_points,
      currency: safeCurrency(source.currency || currency),
      line_net_amount_cents: computedAmounts.line_net_amount_cents,
      line_tax_amount_cents: computedAmounts.line_tax_amount_cents,
      line_gross_amount_cents: computedAmounts.line_gross_amount_cents,
      line_total_amount_cents: computedAmounts.line_total_amount_cents
    };
    const label = normalizeText(source.label);
    const notes = normalizeText(source.notes);
    if (label) normalized.label = label;
    if (notes) normalized.notes = notes;
    return normalized;
  }

  function normalizeBookingOfferDayPricesInternal(rawDays, currency) {
    return (Array.isArray(rawDays) ? rawDays : []).map((dayPrice, index) => {
      const computedAmounts = computeOfferDayPriceInternalAmounts(dayPrice);
      const normalizedDayNumber = Number.parseInt(dayPrice?.day_number, 10);
      const normalized = {
        id: normalizeText(dayPrice?.id) || `offer_day_internal_${index + 1}`,
        day_number: Number.isInteger(normalizedDayNumber) && normalizedDayNumber >= 1 ? normalizedDayNumber : index + 1,
        amount_cents: computedAmounts.amount_cents,
        tax_rate_basis_points: computedAmounts.tax_rate_basis_points,
        currency: safeCurrency(dayPrice?.currency || currency),
        sort_order: Number.isFinite(Number(dayPrice?.sort_order)) ? Number(dayPrice.sort_order) : index,
        line_net_amount_cents: computedAmounts.line_net_amount_cents,
        line_tax_amount_cents: computedAmounts.line_tax_amount_cents,
        line_gross_amount_cents: computedAmounts.line_gross_amount_cents,
        line_total_amount_cents: computedAmounts.line_total_amount_cents
      };
      const label = normalizeText(dayPrice?.label);
      const notes = normalizeText(dayPrice?.notes);
      if (label) normalized.label = label;
      if (notes) normalized.notes = notes;
      return normalized;
    });
  }

  function normalizeBookingOfferComponents(rawComponents, currency, options = {}) {
    const contentLang = normalizeBookingContentLang(options?.contentLang || options?.lang || "en");
    const flatLang = normalizeBookingContentLang(options?.flatLang || options?.lang || "en");
    const sourceLang = normalizeBookingContentLang(options?.sourceLang || contentLang);
    return (Array.isArray(rawComponents) ? rawComponents : []).map((component, index) => {
      const computedAmounts = computeOfferLineAmounts(component);
      const normalizedDayNumber = Number.parseInt(component?.day_number, 10);
      const details_i18n = normalizeLocalizedTextMap(
        component?.details_i18n ?? component?.details ?? component?.description,
        contentLang
      );
      const details = resolveLocalizedText(details_i18n, flatLang, "", { sourceLang });
      return {
        id: normalizeText(component?.id) || `offer_component_${index + 1}`,
        category: normalizeOfferCategory(component?.category),
        ...(normalizeText(component?.label) ? { label: normalizeText(component.label) } : {}),
        ...(details ? { details } : {}),
        ...(details_i18n && Object.keys(details_i18n).length ? { details_i18n } : {}),
        ...(Number.isInteger(normalizedDayNumber) && normalizedDayNumber >= 1 ? { day_number: normalizedDayNumber } : {}),
        quantity: computedAmounts.quantity,
        unit_amount_cents: computedAmounts.unit_amount_cents,
        unit_net_amount_cents: computedAmounts.unit_net_amount_cents,
        unit_tax_amount_cents: computedAmounts.unit_tax_amount_cents,
        unit_total_amount_cents: computedAmounts.unit_total_amount_cents,
        tax_rate_basis_points: computedAmounts.tax_rate_basis_points,
        currency: safeCurrency(component?.currency || currency),
        line_net_amount_cents: computedAmounts.line_net_amount_cents,
        line_tax_amount_cents: computedAmounts.line_tax_amount_cents,
        line_gross_amount_cents: computedAmounts.line_gross_amount_cents,
        line_total_amount_cents: computedAmounts.line_total_amount_cents,
        ...(normalizeText(component?.notes) ? { notes: normalizeText(component.notes) } : {}),
        sort_order: Number.isFinite(Number(component?.sort_order)) ? Number(component.sort_order) : index,
        created_at: component?.created_at || null,
        updated_at: component?.updated_at || null
      };
    });
  }

  function normalizeBookingOfferAdditionalItems(rawItems, currency) {
    return (Array.isArray(rawItems) ? rawItems : []).map((item, index) => {
      const computedAmounts = computeOfferAdditionalItemAmounts(item);
      if (computedAmounts.unit_amount_cents <= 0) return null;
      const normalizedDayNumber = Number.parseInt(item?.day_number, 10);
      return {
        id: normalizeText(item?.id) || `offer_additional_item_${index + 1}`,
        label: normalizeText(item?.label) || `Additional item ${index + 1}`,
        ...(normalizeText(item?.details) ? { details: normalizeText(item.details) } : {}),
        ...(Number.isInteger(normalizedDayNumber) && normalizedDayNumber >= 1 ? { day_number: normalizedDayNumber } : {}),
        quantity: computedAmounts.quantity,
        unit_amount_cents: computedAmounts.unit_amount_cents,
        unit_tax_amount_cents: computedAmounts.unit_tax_amount_cents,
        unit_total_amount_cents: computedAmounts.unit_total_amount_cents,
        tax_rate_basis_points: computedAmounts.tax_rate_basis_points,
        currency: safeCurrency(item?.currency || currency),
        ...(normalizeText(item?.category) ? { category: normalizeOfferCategory(item.category) } : {}),
        line_net_amount_cents: computedAmounts.line_net_amount_cents,
        line_tax_amount_cents: computedAmounts.line_tax_amount_cents,
        line_gross_amount_cents: computedAmounts.line_gross_amount_cents,
        line_total_amount_cents: computedAmounts.line_total_amount_cents,
        ...(normalizeText(item?.notes) ? { notes: normalizeText(item.notes) } : {}),
        sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : index,
        created_at: item?.created_at || null,
        updated_at: item?.updated_at || null
      };
    }).filter(Boolean);
  }

  function deriveLegacyOfferDaysInternal(normalizedComponents, currency) {
    if (!normalizedComponents.length) return [];
    const groups = new Map();
    for (const component of normalizedComponents) {
      const dayNumber = Number.parseInt(component?.day_number, 10);
      if (!Number.isInteger(dayNumber) || dayNumber < 1) return [];
      const existing = groups.get(dayNumber) || [];
      existing.push(component);
      groups.set(dayNumber, existing);
    }
    return Array.from(groups.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([dayNumber, dayLines], index) => aggregateLegacyOfferLines(dayLines, {
        id: `offer_day_internal_${dayNumber}`,
        dayNumber,
        currency,
        sortOrder: index
      }))
      .filter(Boolean);
  }

  function deriveLegacyOfferTripPriceInternal(normalizedComponents, currency) {
    if (!normalizedComponents.length) return null;
    return aggregateLegacyOfferLines(normalizedComponents, {
      id: "offer_trip_internal_legacy",
      currency
    });
  }

  function deriveLegacyOfferQuotationSummary(normalizedComponents) {
    if (!normalizedComponents.length) return null;
    return buildOfferQuotationSummaryFromLines(normalizedComponents);
  }

  function defaultBookingOffer(preferredCurrency = baseCurrency) {
    return {
      status: "DRAFT",
      currency: safeCurrency(preferredCurrency),
      offer_detail_level_internal: "trip",
      offer_detail_level_visible: "trip",
      category_rules: offerCategoryOrder.map((category) => ({
        category,
        tax_rate_basis_points: defaultOfferTaxRateBasisPoints
      })),
      days_internal: [],
      additional_items: [],
      discounts: [],
      totals: computeBookingOfferTotals(null),
      quotation_summary: computeBookingOfferQuotationSummary(null),
      total_price_cents: 0
    };
  }

  function normalizeBookingOffer(rawOffer, preferredCurrency = baseCurrency, options = {}) {
    const source = rawOffer && typeof rawOffer === "object" ? rawOffer : {};
    const currency = safeCurrency(source.currency || preferredCurrency);
    const status = normalizeOfferStatus(source.status);
    const internalDetailLevel = inferInternalOfferDetailLevel(source, "trip");
    const requestedVisibleDetailLevel = normalizeOfferDetailLevel(
      source.offer_detail_level_visible,
      internalDetailLevel
    );
    const visibleDetailLevel = isVisibleDetailLevelFinerThanInternal(
      requestedVisibleDetailLevel,
      internalDetailLevel
    )
      ? internalDetailLevel
      : requestedVisibleDetailLevel;
    const normalizedLegacyComponents = normalizeBookingOfferComponents(source.components, currency, options);
    const normalizedDaysInternal = normalizeBookingOfferDayPricesInternal(source.days_internal, currency);
    const legacyDaysInternal = deriveLegacyOfferDaysInternal(normalizedLegacyComponents, currency);
    const normalizedTripPriceInternal = normalizeBookingOfferTripPriceInternal(source.trip_price_internal, currency);
    const legacyTripPriceInternal = deriveLegacyOfferTripPriceInternal(normalizedLegacyComponents, currency);
    const tripPriceInternal = internalDetailLevel === "trip"
      ? (normalizedTripPriceInternal || legacyTripPriceInternal)
      : null;
    const daysInternal = internalDetailLevel === "day"
      ? (normalizedDaysInternal.length ? normalizedDaysInternal : legacyDaysInternal)
      : [];
    const usesLegacyComponents = normalizedLegacyComponents.length > 0 && (
      (internalDetailLevel === "day" && !normalizedDaysInternal.length && legacyDaysInternal.length > 0)
      || (internalDetailLevel === "trip" && !normalizedTripPriceInternal && Boolean(legacyTripPriceInternal))
    );
    const normalizedAdditionalItems = normalizeBookingOfferAdditionalItems(source.additional_items, currency);
    const foldedCarryOverItems = internalDetailLevel === "trip"
      ? normalizedAdditionalItems.filter((item) => isSyntheticCarryOverAdditionalItem(item))
      : [];
    const additionalItems = foldedCarryOverItems.length
      ? normalizedAdditionalItems.filter((item) => !isSyntheticCarryOverAdditionalItem(item))
      : normalizedAdditionalItems;
    const tripPriceInternalWithFoldedCarryOver = internalDetailLevel === "trip" && foldedCarryOverItems.length
      ? aggregateLegacyOfferLines(
          [tripPriceInternal, ...foldedCarryOverItems].filter(Boolean),
          {
            id: normalizeText(tripPriceInternal?.id) || "offer_trip_internal_folded",
            label: normalizeText(tripPriceInternal?.label) || "Trip total",
            notes: normalizeText(tripPriceInternal?.notes),
            currency,
            sortOrder: Number.isFinite(Number(tripPriceInternal?.sort_order)) ? Number(tripPriceInternal.sort_order) : 0
          }
        )
      : tripPriceInternal;
    const rawDiscounts = Array.isArray(source.discounts) ? source.discounts : [];
    const discounts = normalizeBookingOfferDiscounts(
      rawDiscounts.length
        ? rawDiscounts
        : (source.discount ? [source.discount] : rawDiscounts),
      currency
    );

    const categoryRulesByCode = new Map(
      (Array.isArray(source.category_rules) ? source.category_rules : []).map((rule) => [
        normalizeOfferCategory(rule?.category),
        clampOfferTaxRateBasisPoints(rule?.tax_rate_basis_points, defaultOfferTaxRateBasisPoints)
      ])
    );
    const normalizedBase = {
      status,
      currency,
      offer_detail_level_internal: internalDetailLevel,
      offer_detail_level_visible: visibleDetailLevel,
      category_rules: offerCategoryOrder.map((category) => ({
        category,
        tax_rate_basis_points: categoryRulesByCode.has(category)
          ? categoryRulesByCode.get(category)
          : defaultOfferTaxRateBasisPoints
      })),
      ...(tripPriceInternalWithFoldedCarryOver ? { trip_price_internal: tripPriceInternalWithFoldedCarryOver } : {}),
      days_internal: daysInternal,
      additional_items: additionalItems,
      discounts
    };
    const totals = computeBookingOfferTotals(normalizedBase);
    const quotationSummary = usesLegacyComponents
      ? deriveLegacyOfferQuotationSummary(normalizedLegacyComponents)
      : computeBookingOfferQuotationSummary(normalizedBase);
    const paymentTerms = normalizeBookingOfferPaymentTerms(
      source.payment_terms,
      currency,
      quotationSummary.grand_total_amount_cents
    );
    return {
      ...normalizedBase,
      totals,
      quotation_summary: quotationSummary,
      ...(paymentTerms ? { payment_terms: paymentTerms } : {}),
      total_price_cents: totals.total_price_cents
    };
  }

  function normalizeOfferStatus(value) {
    const normalized = normalizeText(value).toUpperCase();
    return ["DRAFT", "APPROVED", "OFFER_SENT"].includes(normalized) ? normalized : "DRAFT";
  }

  function normalizeBookingPricing(rawPricing) {
    const source = rawPricing && typeof rawPricing === "object" ? rawPricing : {};
    const currency = safeCurrency(source.currency || baseCurrency);
    const payments = (Array.isArray(source.payments) ? source.payments : []).map((payment, index) => ({
      id: normalizeText(payment?.id) || `pricing_payment_${index + 1}`,
      label: normalizeText(payment?.label),
      origin_payment_term_line_id: normalizeText(payment?.origin_payment_term_line_id) || null,
      origin_generated_offer_id: normalizeText(payment?.origin_generated_offer_id) || null,
      net_amount_cents: normalizeAmountCents(payment?.net_amount_cents, 0),
      tax_rate_basis_points: clampOfferTaxRateBasisPoints(payment?.tax_rate_basis_points, 0),
      status: normalizeText(payment?.status).toUpperCase() || paymentStatuses.PENDING,
      paid_at: payment?.paid_at || null,
      received_at: payment?.received_at || null,
      received_amount_cents: Number.isFinite(Number(payment?.received_amount_cents))
        ? Math.max(0, normalizeAmountCents(payment?.received_amount_cents, 0))
        : null,
      received_generated_offer_id: normalizeText(payment?.received_generated_offer_id) || null,
      confirmed_by_atp_staff_id: normalizeText(payment?.confirmed_by_atp_staff_id) || null,
      reference: normalizeText(payment?.reference) || null,
      notes: normalizeText(payment?.notes),
      tax_amount_cents: normalizeAmountCents(payment?.tax_amount_cents, 0),
      gross_amount_cents: normalizeAmountCents(payment?.gross_amount_cents, normalizeAmountCents(payment?.net_amount_cents, 0))
    }));
    return {
      currency,
      payments
    };
  }
  function getFallbackExchangeRate(fromCurrency, toCurrency) {
    const direct = exchangeRateOverrides[`${fromCurrency}->${toCurrency}`];
    if (Number.isFinite(direct) && direct > 0) return direct;

    const reverse = exchangeRateOverrides[`${toCurrency}->${fromCurrency}`];
    if (Number.isFinite(reverse) && reverse > 0) return Number((1 / reverse).toFixed(10));

    return null;
  }

  function safeCurrency(value) {
    return normalizeGeneratedCurrencyCode(value) || baseCurrency;
  }

  function getBookingPreferredCurrency(booking = null) {
    return safeCurrency(booking?.preferred_currency || booking?.pricing?.currency || booking?.offer?.currency || baseCurrency);
  }

  function parseCurrencyForExchange(value) {
    const normalized = normalizeGeneratedCurrencyCode(value);
    return normalized || null;
  }

  function getCurrencyDefinition(currency) {
    const definition = generatedCurrencyDefinition(currency) || generatedCurrencyDefinition(baseCurrency);
    return {
      code: definition.code,
      symbol: definition.symbol || definition.code,
      decimal_places: Number.isFinite(Number(definition.decimalPlaces)) ? Number(definition.decimalPlaces) : 2,
      iso_code: definition.code === "EURO" ? "EUR" : definition.code
    };
  }

  function safeAmountCents(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const rounded = Math.round(n);
    return rounded > 0 ? rounded : null;
  }

  function getExchangeCacheKey(fromCurrency, toCurrency) {
    return `${fromCurrency}->${toCurrency}`;
  }

  async function fetchExchangeRate(fromCurrency, toCurrency, options = {}) {
    const { visited = new Set() } = options;
    const from = fromCurrency === "EURO" ? "EUR" : fromCurrency;
    const to = toCurrency === "EURO" ? "EUR" : toCurrency;
    if (!from || !to || from === to) return 1;

    const key = `${from}->${to}`;
    if (visited.has(key)) {
      throw new Error(`Exchange-rate conversion loop detected for ${key}`);
    }
    const nextVisited = new Set(visited);
    nextVisited.add(key);

    const now = Date.now();
    const cacheKey = getExchangeCacheKey(fromCurrency, toCurrency);
    const cached = fxRateCache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.rate;

    const staleCached = fxRateCache.get(cacheKey);

    const providers = [
      async () => {
        const response = await fetch(
          `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        );
        if (!response.ok) throw new Error(`Frankfurter API request failed (${response.status})`);
        const payload = await response.json();
        const rate = Number(payload?.rates?.[to]);
        if (!Number.isFinite(rate) || rate <= 0) throw new Error("Frankfurter exchange rate response did not contain a valid rate");
        return rate;
      },
      async () => {
        const symbols = Array.from(new Set([from, to])).filter(Boolean).join(",");
        const response = await fetch(
          `https://api.frankfurter.app/latest?from=EUR&to=${encodeURIComponent(symbols)}`
        );
        if (!response.ok) throw new Error(`Frankfurter EUR-based API request failed (${response.status})`);
        const payload = await response.json();
        const rates = payload?.rates || {};
        if (from === "EUR") {
          const toRate = Number(rates[to]);
          if (!Number.isFinite(toRate) || toRate <= 0) throw new Error("Frankfurter EUR-based exchange response did not contain a valid to-rate");
          return toRate;
        }
        if (to === "EUR") {
          const fromRate = Number(rates[from]);
          if (!Number.isFinite(fromRate) || fromRate <= 0) throw new Error("Frankfurter EUR-based exchange response did not contain a valid from-rate");
          return 1 / fromRate;
        }
        const fromRate = Number(rates[from]);
        const toRate = Number(rates[to]);
        if (!Number.isFinite(fromRate) || fromRate <= 0 || !Number.isFinite(toRate) || toRate <= 0) {
          throw new Error("Frankfurter EUR-based exchange response did not contain valid rates");
        }
        return toRate / fromRate;
      },
      async () => {
        const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`);
        if (!response.ok) throw new Error(`ER-API request failed (${response.status})`);
        const payload = await response.json();
        if (String(payload?.result || "").toLowerCase() !== "success" && payload?.result !== undefined) {
          throw new Error(`ER-API reported status: ${payload?.result || "unknown"}`);
        }
        const rate = Number(payload?.rates?.[to]);
        if (!Number.isFinite(rate) || rate <= 0) throw new Error("ER-API exchange rate response did not contain a valid rate");
        return rate;
      },
      async () => {
        const response = await fetch(`https://open.er-api.com/v6/latest/EUR`);
        if (!response.ok) throw new Error(`ER-API EUR-based request failed (${response.status})`);
        const payload = await response.json();
        if (String(payload?.result || "").toLowerCase() !== "success" && payload?.result !== undefined) {
          throw new Error(`ER-API reported status: ${payload?.result || "unknown"}`);
        }
        const rates = payload?.rates || {};
        if (from === "EUR") {
          const toRate = Number(rates[to]);
          if (!Number.isFinite(toRate) || toRate <= 0) throw new Error("ER-API EUR-based exchange response did not contain a valid to-rate");
          return toRate;
        }
        if (to === "EUR") {
          const fromRate = Number(rates[from]);
          if (!Number.isFinite(fromRate) || fromRate <= 0) throw new Error("ER-API EUR-based exchange response did not contain a valid from-rate");
          return 1 / fromRate;
        }
        const fromRate = Number(rates[from]);
        const toRate = Number(rates[to]);
        if (!Number.isFinite(fromRate) || fromRate <= 0 || !Number.isFinite(toRate) || toRate <= 0) {
          throw new Error("ER-API EUR-based exchange response did not contain valid rates");
        }
        return toRate / fromRate;
      }
    ];

    const errors = [];
    for (const provider of providers) {
      try {
        const rate = await provider();
        fxRateCache.set(cacheKey, {
          rate,
          expiresAt: now + fxRateCacheTtlMs
        });
        return rate;
      } catch (error) {
        errors.push(String(error?.message || error));
      }
    }

    const fallbackRate = getFallbackExchangeRate(from, to) || getFallbackExchangeRate(fromCurrency, toCurrency);
    if (Number.isFinite(fallbackRate) && fallbackRate > 0) {
      console.warn(
        `[backend] using configured fallback exchange rate ${from}->${to} = ${fallbackRate} after provider lookup failures:`,
        errors.join(" | ")
      );
      return fallbackRate;
    }

    const crossVia = [...new Set([baseCurrency, "EUR"])];
    for (const via of crossVia) {
      if (via === from || via === to) continue;
      const crossKey = getExchangeCacheKey(fromCurrency, via);
      const viaCached = fxRateCache.get(crossKey);
      const crossRate = viaCached && viaCached.expiresAt > now ? viaCached.rate : null;

      try {
        const fromToVia = crossRate || await fetchExchangeRate(fromCurrency, via, { visited: nextVisited });
        const viaToCache = getExchangeCacheKey(via, toCurrency);
        const viaToCached = fxRateCache.get(viaToCache);
        const viaTo = viaToCached && viaToCached.expiresAt > now ? viaToCached.rate : null;
        const toRate = viaTo || await fetchExchangeRate(via, toCurrency, { visited: nextVisited });
        if (fromToVia > 0 && toRate > 0) {
          const rate = fromToVia * toRate;
          fxRateCache.set(cacheKey, {
            rate,
            expiresAt: now + fxRateCacheTtlMs
          });
          return rate;
        }
      } catch (error) {
        errors.push(`Cross via ${via} failed: ${String(error?.message || error)}`);
      }
    }

    if (staleCached) {
      console.warn(
        `[backend] using stale exchange rate ${from}->${to} = ${staleCached.rate} after fresh-rate lookup failures:`,
        errors.join(" | ")
      );
      return staleCached.rate;
    }

    if (errors.length > 0) throw new Error(errors[0]);
    throw new Error("No exchange rate source available");
  }

  function roundConvertedAmount(amountCents, fromCurrency, toCurrency, rate) {
    const fromDefinition = getCurrencyDefinition(fromCurrency);
    const toDefinition = getCurrencyDefinition(toCurrency);
    const fromScale = 10 ** fromDefinition.decimal_places;
    const toScale = 10 ** toDefinition.decimal_places;
    const major = Number(amountCents) / fromScale;
    const converted = major * rate;
    return Math.max(0, Math.round(converted * toScale));
  }

  function convertMinorUnitsRaw(amountCents, fromCurrency, toCurrency, rate) {
    const fromDefinition = getCurrencyDefinition(fromCurrency);
    const toDefinition = getCurrencyDefinition(toCurrency);
    const source = Number(amountCents);
    if (!Number.isFinite(source) || source <= 0) return 0;
    const fromScale = 10 ** fromDefinition.decimal_places;
    const toScale = 10 ** toDefinition.decimal_places;
    const major = source / fromScale;
    return major * rate * toScale;
  }

  function convertOfferLineAmountForCurrency(line, rates, fromCurrency, toCurrency) {
    const sourceCurrency = safeCurrency(fromCurrency) || baseCurrency;
    const targetCurrency = safeCurrency(toCurrency) || baseCurrency;

    const normalizedRates = (() => {
      if (!rates) return { sourceToBaseRate: 1, baseToTargetRate: 1 };
      if (Array.isArray(rates)) {
        return {
          sourceToBaseRate: Number(rates[0]) || 1,
          baseToTargetRate: Number(rates[1]) || 1
        };
      }
      return {
        sourceToBaseRate: Number(rates.sourceToBaseRate) || 1,
        baseToTargetRate: Number(rates.baseToTargetRate) || 1
      };
    })();

    if (sourceCurrency === targetCurrency) {
      const computedAmounts = computeOfferLineAmounts(line);
      return {
        id: String(line?.id || ""),
        category: computedAmounts.category,
        quantity: computedAmounts.quantity,
        tax_rate_basis_points: computedAmounts.tax_rate_basis_points,
        unit_amount_cents: computedAmounts.unit_amount_cents,
        unit_net_amount_cents: computedAmounts.unit_net_amount_cents,
        unit_tax_amount_cents: computedAmounts.unit_tax_amount_cents,
        unit_total_amount_cents: computedAmounts.unit_total_amount_cents,
        line_net_amount_cents: computedAmounts.line_net_amount_cents,
        line_tax_amount_cents: computedAmounts.line_tax_amount_cents,
        line_gross_amount_cents: computedAmounts.line_gross_amount_cents,
        line_total_amount_cents: computedAmounts.line_total_amount_cents,
        currency: targetCurrency
      };
    }

    const fromDefinition = getCurrencyDefinition(sourceCurrency);
    const baseDefinition = getCurrencyDefinition(baseCurrency);
    const fromScale = 10 ** fromDefinition.decimal_places;
    const toDefinition = getCurrencyDefinition(targetCurrency);
    const toScale = 10 ** toDefinition.decimal_places;
    const safeQuantity = Math.max(1, safeInt(line?.quantity) || 1);
    const unitAmountCents = Math.max(0, Number(line?.unit_amount_cents || 0));
    const sourceToBaseRate = sourceCurrency === baseCurrency ? 1 : normalizedRates.sourceToBaseRate;
    const baseToTargetRate = targetCurrency === baseCurrency ? 1 : normalizedRates.baseToTargetRate;

    const unitMajor = unitAmountCents / fromScale;
    const baseScale = 10 ** baseDefinition.decimal_places;
    const unitBaseMajor = unitMajor * sourceToBaseRate;
    const roundedUnitBaseMinor = Math.max(0, Math.round(unitBaseMajor * baseScale));
    const roundedUnitBaseMajor = roundedUnitBaseMinor / baseScale;
    const convertedUnitMajor = roundedUnitBaseMajor * baseToTargetRate;
    const convertedUnitMinor = Math.max(0, Math.round(convertedUnitMajor * toScale));
    const computedAmounts = computeOfferLineAmounts(line, {
      quantity: safeQuantity,
      unitAmountCents: convertedUnitMinor
    });

    return {
      id: String(line?.id || ""),
      category: computedAmounts.category,
      quantity: computedAmounts.quantity,
      tax_rate_basis_points: computedAmounts.tax_rate_basis_points,
      unit_amount_cents: computedAmounts.unit_amount_cents,
      unit_net_amount_cents: computedAmounts.unit_net_amount_cents,
      unit_tax_amount_cents: computedAmounts.unit_tax_amount_cents,
      unit_total_amount_cents: computedAmounts.unit_total_amount_cents,
      line_net_amount_cents: computedAmounts.line_net_amount_cents,
      line_tax_amount_cents: computedAmounts.line_tax_amount_cents,
      line_gross_amount_cents: computedAmounts.line_gross_amount_cents,
      line_total_amount_cents: computedAmounts.line_total_amount_cents,
      currency: targetCurrency
    };
  }

  async function convertMinorUnits(amountCents, fromCurrency, toCurrency) {
    const sourceCurrency = safeCurrency(fromCurrency) || baseCurrency;
    const targetCurrency = safeCurrency(toCurrency) || baseCurrency;
    const normalizedAmount = normalizeAmountCents(amountCents, 0);
    if (sourceCurrency === targetCurrency) return normalizedAmount;
    const rate = await fetchExchangeRate(sourceCurrency, targetCurrency);
    return roundConvertedAmount(normalizedAmount, sourceCurrency, targetCurrency, rate);
  }

  async function resolveExchangeRateWithFallback(fromCurrency, toCurrency) {
    try {
      return {
        rate: await fetchExchangeRate(fromCurrency, toCurrency),
        warning: null
      };
    } catch (error) {
      const fallbackRate = getFallbackExchangeRate(fromCurrency, toCurrency);
      if (Number.isFinite(fallbackRate) && fallbackRate > 0) {
        return {
          rate: fallbackRate,
          warning: `Exchange rate lookup failed for ${fromCurrency}->${toCurrency}. Using configured fallback.`
        };
      }
      throw error;
    }
  }

  async function convertToBaseCurrency(bookingCurrency, amountCents) {
    return convertMinorUnits(amountCents, bookingCurrency, baseCurrency);
  }

  async function convertPricingPaymentForCurrency(payment, sourceCurrency, targetCurrency) {
    const normalizedPayment = payment && typeof payment === "object"
      ? payment
      : normalizeBookingPricing({ payments: [payment] }).payments[0];
    const [
      netAmountCents,
      taxAmountCents,
      grossAmountCents,
      receivedAmountCents
    ] = await Promise.all([
      convertMinorUnits(normalizedPayment?.net_amount_cents, sourceCurrency, targetCurrency),
      convertMinorUnits(normalizedPayment?.tax_amount_cents, sourceCurrency, targetCurrency),
      convertMinorUnits(normalizedPayment?.gross_amount_cents, sourceCurrency, targetCurrency),
      normalizedPayment?.received_amount_cents == null
        ? Promise.resolve(null)
        : convertMinorUnits(normalizedPayment.received_amount_cents, sourceCurrency, targetCurrency)
    ]);

    return {
      ...normalizedPayment,
      net_amount_cents: netAmountCents,
      tax_amount_cents: taxAmountCents,
      gross_amount_cents: grossAmountCents,
      received_amount_cents: receivedAmountCents
    };
  }

  function getOfferCurrencyForStorage(offer) {
    return safeCurrency(offer?.currency || baseCurrency);
  }

  function getPricingCurrencyForStorage(pricing) {
    return safeCurrency(pricing?.currency || baseCurrency);
  }

  async function convertBookingPricingToBaseCurrency(pricing) {
    // Payment operations stay in customer currency end-to-end.
    // The helper name is kept for compatibility with the surrounding call sites.
    return normalizeBookingPricing(pricing);
  }

  async function convertBookingOfferToBaseCurrency(offer) {
    const normalized = normalizeBookingOffer(offer, getOfferCurrencyForStorage(offer));
    return {
      ...normalized,
      totals: {
        ...normalized.totals
      },
      total_price_cents: normalized.total_price_cents
    };
  }

  async function convertPricingForDisplay(pricing, targetCurrency) {
    const normalized = normalizeBookingPricing(pricing);
    const sourceCurrency = getPricingCurrencyForStorage(normalized);
    const displayCurrency = safeCurrency(targetCurrency || sourceCurrency);
    if (sourceCurrency === displayCurrency) {
      return {
        ...normalized,
        currency: displayCurrency
      };
    }

    const payments = await Promise.all(
      normalized.payments.map((payment) => convertPricingPaymentForCurrency(payment, sourceCurrency, displayCurrency))
    );

    return {
      ...normalized,
      currency: displayCurrency,
      payments
    };
  }

  async function convertOfferPriceLineForDisplay(line, sourceCurrency, displayCurrency) {
    if (!line || typeof line !== "object") return null;
    const [
      amountCents,
      lineNetAmountCents,
      lineTaxAmountCents,
      lineGrossAmountCents
    ] = await Promise.all([
      convertMinorUnits(line?.amount_cents, sourceCurrency, displayCurrency),
      convertMinorUnits(
        line?.line_net_amount_cents ?? line?.amount_cents,
        sourceCurrency,
        displayCurrency
      ),
      convertMinorUnits(line?.line_tax_amount_cents, sourceCurrency, displayCurrency),
      convertMinorUnits(
        line?.line_gross_amount_cents ?? line?.line_total_amount_cents ?? line?.amount_cents,
        sourceCurrency,
        displayCurrency
      )
    ]);
    return {
      ...line,
      amount_cents: amountCents,
      line_net_amount_cents: lineNetAmountCents,
      line_tax_amount_cents: lineTaxAmountCents,
      line_gross_amount_cents: lineGrossAmountCents,
      line_total_amount_cents: lineGrossAmountCents,
      currency: displayCurrency
    };
  }

  async function convertOfferQuotationSummaryForDisplay(summary, sourceCurrency, displayCurrency) {
    if (!summary || typeof summary !== "object") return null;
    if (sourceCurrency === displayCurrency) {
      return {
        ...summary,
        tax_breakdown: Array.isArray(summary.tax_breakdown) ? summary.tax_breakdown.map((bucket) => ({ ...bucket })) : []
      };
    }
    const sourceBuckets = Array.isArray(summary.tax_breakdown) ? summary.tax_breakdown : [];
    const [
      subtotalNetAmountCents,
      totalTaxAmountCents,
      grandTotalAmountCents,
      convertedBuckets
    ] = await Promise.all([
      convertMinorUnits(summary?.subtotal_net_amount_cents, sourceCurrency, displayCurrency),
      convertMinorUnits(summary?.total_tax_amount_cents, sourceCurrency, displayCurrency),
      convertMinorUnits(summary?.grand_total_amount_cents, sourceCurrency, displayCurrency),
      Promise.all(sourceBuckets.map(async (bucket) => ({
        ...bucket,
        net_amount_cents: await convertMinorUnits(bucket?.net_amount_cents, sourceCurrency, displayCurrency),
        tax_amount_cents: await convertMinorUnits(bucket?.tax_amount_cents, sourceCurrency, displayCurrency),
        gross_amount_cents: await convertMinorUnits(bucket?.gross_amount_cents, sourceCurrency, displayCurrency)
      })))
    ]);
    return {
      ...summary,
      subtotal_net_amount_cents: subtotalNetAmountCents,
      total_tax_amount_cents: totalTaxAmountCents,
      grand_total_amount_cents: grandTotalAmountCents,
      tax_breakdown: convertedBuckets
    };
  }

  async function convertOfferForDisplay(rawOffer, targetCurrency, options = {}) {
    const normalized = normalizeBookingOffer(rawOffer, getOfferCurrencyForStorage(rawOffer), options);
    const sourceCurrency = getOfferCurrencyForStorage(normalized);
    const displayCurrency = safeCurrency(targetCurrency || sourceCurrency);
    if (sourceCurrency === displayCurrency) {
      return {
        ...normalized,
        currency: displayCurrency
      };
    }

    const [convertedAdditionalItemAmounts, convertedDaysInternal, convertedTripPriceInternal, convertedDiscountAmounts, convertedQuotationSummary] = await Promise.all([
      Promise.all(
        (Array.isArray(normalized.additional_items) ? normalized.additional_items : []).map((item) =>
          convertMinorUnits(item.unit_amount_cents, sourceCurrency, displayCurrency)
        )
      ),
      Promise.all(
        (Array.isArray(normalized.days_internal) ? normalized.days_internal : []).map((dayPrice) =>
          convertOfferPriceLineForDisplay(dayPrice, sourceCurrency, displayCurrency)
        )
      ),
      normalized.trip_price_internal
        ? convertOfferPriceLineForDisplay(normalized.trip_price_internal, sourceCurrency, displayCurrency)
        : Promise.resolve(null),
      Promise.all(
        (Array.isArray(normalized.discounts) ? normalized.discounts : []).map((discount) =>
          convertMinorUnits(discount.amount_cents, sourceCurrency, displayCurrency)
        )
      ),
      convertOfferQuotationSummaryForDisplay(normalized.quotation_summary, sourceCurrency, displayCurrency)
    ]);

    return {
      ...Object.fromEntries(Object.entries(normalized).filter(([key]) => key !== "payment_terms")),
      currency: displayCurrency,
      ...(convertedTripPriceInternal
        ? {
            trip_price_internal: convertedTripPriceInternal
          }
        : {}),
      ...(Array.isArray(normalized.days_internal)
        ? {
            days_internal: convertedDaysInternal.filter(Boolean)
          }
        : {}),
      ...(Array.isArray(normalized.additional_items)
        ? {
            additional_items: normalized.additional_items.map((item, index) => ({
              ...item,
              ...computeOfferAdditionalItemAmounts(item, {
                quantity: item?.quantity,
                unitAmountCents: convertedAdditionalItemAmounts[index]
              }),
              currency: displayCurrency
            }))
          }
        : {}),
      ...(convertedQuotationSummary
        ? { quotation_summary: convertedQuotationSummary }
        : {}),
      ...(Array.isArray(normalized.discounts)
        ? {
            discounts: normalized.discounts.map((discount, index) => ({
              ...discount,
              ...computeOfferDiscountAmounts({
                amount_cents: convertedDiscountAmounts[index]
              }),
              amount_cents: convertedDiscountAmounts[index],
              currency: displayCurrency
            }))
          }
        : {})
    };
  }

  function validateOfferExchangeRequest(payload) {
    if (!payload || typeof payload !== "object") {
      return { ok: false, error: "Request body is required." };
    }

    const fromCurrency = parseCurrencyForExchange(payload.from_currency);
    const toCurrency = parseCurrencyForExchange(payload.to_currency);
    if (!fromCurrency) return { ok: false, error: "from_currency is required and must be a valid currency." };
    if (!toCurrency) return { ok: false, error: "to_currency is required and must be a valid currency." };

    const inputLines = Array.isArray(payload.lines)
      ? payload.lines
      : (Array.isArray(payload.components) ? payload.components : []);
    const lines = [];

    for (let index = 0; index < inputLines.length; index++) {
      const row = inputLines[index];
      const rawAmount = normalizeAmountCents(row?.unit_amount_cents, 0);
      if (!Number.isFinite(rawAmount) || rawAmount < 0) {
        return { ok: false, error: `Line ${index + 1} has an invalid unit_amount_cents.` };
      }
      const category = normalizeOfferCategory(row?.category);
      const taxRateBasisPoints = clampOfferTaxRateBasisPoints(
        row?.tax_rate_basis_points,
        defaultOfferTaxRateBasisPoints
      );
      const quantity = Math.max(1, safeInt(row?.quantity) || 1);
      lines.push({
        id: normalizeText(row?.id) || `line_${index}`,
        unit_amount_cents: rawAmount,
        category,
        tax_rate_basis_points: taxRateBasisPoints,
        quantity
      });
    }

    return { ok: true, fromCurrency, toCurrency, lines };
  }

  function formatMoney(amountCents, currency) {
    const definition = getCurrencyDefinition(currency);
    const amount = Number(amountCents || 0) / 10 ** definition.decimal_places;
    return `${definition.symbol} ${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: definition.decimal_places,
      maximumFractionDigits: definition.decimal_places,
      useGrouping: true
    }).format(amount)}`;
  }

  function normalizeInvoiceComponents(value, options = {}) {
    const input = Array.isArray(value) ? value : [];
    const contentLang = normalizeBookingContentLang(options?.contentLang || options?.lang || "en");
    const flatLang = normalizeBookingContentLang(options?.flatLang || options?.lang || "en");
    const sourceLang = normalizeBookingContentLang(options?.sourceLang || contentLang);
    return input
      .map((component) => {
        const description_i18n = normalizeLocalizedTextMap(
          component?.description_i18n ?? component?.description,
          contentLang
        );
        const description = resolveLocalizedText(description_i18n, flatLang, "", { sourceLang });
        const quantity = Math.max(1, safeInt(component?.quantity) || 1);
        const unitAmountCents = safeAmountCents(component?.unit_amount_cents);
        if (!description || !unitAmountCents) return null;
        return {
          id: normalizeText(component?.id) || `inv_component_${randomUUID()}`,
          description,
          description_i18n,
          quantity,
          unit_amount_cents: unitAmountCents,
          total_amount_cents: unitAmountCents * quantity
        };
      })
      .filter(Boolean);
  }

  function computeInvoiceComponentTotal(components) {
    return (Array.isArray(components) ? components : []).reduce(
      (sum, component) => sum + (safeAmountCents(component?.total_amount_cents) || 0),
      0
    );
  }

  function nextInvoiceNumber(store) {
    const max = (store.invoices || []).reduce((acc, invoice) => {
      const match = String(invoice.invoice_number || "").match(/^ATP-(\d+)$/);
      if (!match) return acc;
      const n = Number(match[1]);
      return Number.isFinite(n) ? Math.max(acc, n) : acc;
    }, 0);
    return `ATP-${String(max + 1).padStart(6, "0")}`;
  }

  function invoicePdfPath(invoiceId, version) {
    return path.join(invoicesDir, `${invoiceId}-v${version}.pdf`);
  }

  function generatedOfferPdfPath(generatedOfferId) {
    return path.join(generatedOffersDir, `${generatedOfferId}.pdf`);
  }

  async function buildBookingOfferReadModel(rawOffer, preferredCurrency = baseCurrency, options = {}) {
    const converted = await convertOfferForDisplay(rawOffer, preferredCurrency, options);
    const totals = computeBookingOfferTotals(converted);
    const visiblePricing = buildVisiblePricingProjection(converted);
    const quotationSummary = converted.quotation_summary || computeBookingOfferQuotationSummary(converted);
    const { payment_terms: _rawPaymentTerms, ...convertedWithoutPaymentTerms } = converted;
    const paymentTerms = buildBookingOfferPaymentTermsReadModel(
      converted.payment_terms,
      converted.currency,
      totals.total_price_cents
    );
    return {
      ...convertedWithoutPaymentTerms,
      ...(paymentTerms ? { payment_terms: paymentTerms } : {}),
      visible_pricing: visiblePricing,
      totals,
      quotation_summary: quotationSummary,
      total_price_cents: totals.total_price_cents
    };
  }

  function validateBookingOfferInput(rawOffer, booking) {
    if (!rawOffer || typeof rawOffer !== "object") {
      return { ok: false, error: "Offer is required." };
    }
    const requestedInternalDetailLevel = inferInternalOfferDetailLevel(
      rawOffer?.offer_detail_level_internal
        ? rawOffer
        : ({
            ...booking?.offer,
            ...rawOffer
          }),
      "trip"
    );
    const requestedVisibleDetailLevel = normalizeOfferDetailLevel(
      rawOffer?.offer_detail_level_visible || booking?.offer?.offer_detail_level_visible,
      requestedInternalDetailLevel
    );
    if (isVisibleDetailLevelFinerThanInternal(requestedVisibleDetailLevel, requestedInternalDetailLevel)) {
      return {
        ok: false,
        error: "Visible offer detail level cannot be more specific than internal offer detail level."
      };
    }
    const inputAdditionalItems = Array.isArray(rawOffer.additional_items) ? rawOffer.additional_items : [];
    const legacyInputLines = Array.isArray(rawOffer.components) ? rawOffer.components : [];
    for (let index = 0; index < legacyInputLines.length; index++) {
      const category = normalizeOfferCategory(legacyInputLines[index]?.category);
      if (category === offerCategories.DISCOUNTS_CREDITS) {
        return {
          ok: false,
          error: `Legacy offer line ${index + 1} uses discounts_credits, which is not allowed. Use offer.discounts instead.`
        };
      }
    }
    for (let index = 0; index < inputAdditionalItems.length; index++) {
      const category = normalizeOfferCategory(inputAdditionalItems[index]?.category);
      if (category === offerCategories.DISCOUNTS_CREDITS) {
        return {
          ok: false,
          error: `Additional item ${index + 1} uses discounts_credits, which is not allowed in additional items. Use offer.discounts instead.`
        };
      }
    }
    try {
      const currentStatus = normalizeOfferStatus(booking?.offer?.status);
      const requestedCurrency = safeCurrency(
        rawOffer?.currency || booking?.offer?.currency || booking?.preferred_currency || booking?.pricing?.currency || baseCurrency
      );
      const currentCurrency = safeCurrency(
        booking?.offer?.currency || booking?.preferred_currency || booking?.pricing?.currency || baseCurrency
      );
      if (currentStatus !== "DRAFT" && requestedCurrency !== currentCurrency) {
        return {
          ok: false,
          conflict: true,
          error: `Offer currency is locked because the offer status is ${currentStatus}.`
        };
      }
      const offer = normalizeBookingOffer(
        rawOffer,
        rawOffer?.currency || booking?.offer?.currency || booking?.preferred_currency || booking?.pricing?.currency || baseCurrency
      );
      const discounts = Array.isArray(offer.discounts) ? offer.discounts : [];
      for (const discount of discounts) {
        if (!normalizeText(discount.reason)) {
          return { ok: false, error: "Offer discount reason is required." };
        }
        if (normalizeAmountCents(discount.amount_cents, 0) <= 0) {
          return { ok: false, error: "Offer discount amount must be greater than 0." };
        }
      }
      if (currentStatus !== "DRAFT") {
        offer.status = currentStatus;
      }
      return { ok: true, offer };
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    }
  }

  async function buildBookingPricingReadModel(pricing, targetCurrency = baseCurrency) {
    return convertPricingForDisplay(pricing, targetCurrency);
  }

  function validateBookingPricingInput(rawPricing) {
    if (!rawPricing || typeof rawPricing !== "object") {
      return { ok: false, error: "Pricing is required." };
    }
    try {
      const pricing = normalizeBookingPricing(rawPricing);
      return { ok: true, pricing };
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    }
  }

  return {
    safeCurrency,
    getBookingPreferredCurrency,
    parseCurrencyForExchange,
    getCurrencyDefinition,
    safeAmountCents,
    normalizeAmountCents,
    normalizeOfferCategory,
    offerCategorySign,
    clampOfferTaxRateBasisPoints,
    computeOfferLineAmounts,
    computeBookingOfferTotals,
    defaultBookingPricing,
    defaultBookingOffer,
    normalizeBookingOffer,
    normalizeOfferStatus,
    buildBookingOfferPaymentTermsReadModel,
    buildBookingOfferReadModel,
    buildVisiblePricingProjection,
    validateBookingOfferInput,
    normalizeBookingPricing,
    buildBookingPricingReadModel,
    validateBookingPricingInput,
    convertOfferLineAmountForCurrency,
    resolveExchangeRateWithFallback,
    convertMinorUnits,
    convertBookingPricingToBaseCurrency,
    convertBookingOfferToBaseCurrency,
    convertPricingForDisplay,
    convertOfferForDisplay,
    validateOfferExchangeRequest,
    formatMoney,
    normalizeInvoiceComponents,
    computeInvoiceComponentTotal,
    nextInvoiceNumber,
    invoicePdfPath,
    generatedOfferPdfPath
  };
}
