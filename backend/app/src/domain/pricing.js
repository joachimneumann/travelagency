import path from "node:path";
import { normalizeText } from "../lib/text.js";
import { normalizeGeneratedEnumValue } from "../lib/generated_catalogs.js";
import { normalizeOfferTranslationMeta } from "./booking_translation.js";
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
    day: 2,
    component: 3
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
    if (Array.isArray(source?.components) && source.components.length) return "component";
    if (Array.isArray(source?.days_internal) && source.days_internal.length) return "day";
    if (source?.trip_price_internal && typeof source.trip_price_internal === "object") return "trip";
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

  function computeOfferComponentAmounts(component, overrides = {}) {
    const category = normalizeOfferCategory(overrides.category ?? component?.category);
    const quantity = Math.max(1, safeInt(overrides.quantity ?? component?.quantity) || 1);
    const unitNetAmountCents = Math.max(0, normalizeAmountCents(
      overrides.unit_amount_cents ?? overrides.unitAmountCents ?? component?.unit_amount_cents,
      0
    ));
    const taxRateBasisPoints = clampOfferTaxRateBasisPoints(
      overrides.tax_rate_basis_points ?? overrides.taxRateBasisPoints ?? component?.tax_rate_basis_points,
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

  function buildOfferChargeLines(offer) {
    const internalDetailLevel = normalizeOfferDetailLevel(offer?.offer_detail_level_internal);
    const lines = [];
    if (internalDetailLevel === "component") {
      lines.push(...(Array.isArray(offer?.components) ? offer.components : []));
    } else if (internalDetailLevel === "day") {
      lines.push(...(Array.isArray(offer?.days_internal) ? offer.days_internal : []));
    } else if (internalDetailLevel === "trip" && offer?.trip_price_internal) {
      lines.push(offer.trip_price_internal);
    }
    lines.push(...(Array.isArray(offer?.additional_items) ? offer.additional_items : []));
    const discount = offer?.discount && typeof offer.discount === "object" ? offer.discount : null;
    if (discount && normalizeAmountCents(discount?.amount_cents, 0) > 0) {
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
    const buckets = new Map();
    for (const component of buildOfferChargeLines(offer)) {
      const taxRateBasisPoints = clampOfferTaxRateBasisPoints(component?.tax_rate_basis_points, defaultOfferTaxRateBasisPoints);
      const netAmountCents = normalizeAmountCents(component?.line_net_amount_cents, 0);
      const taxAmountCents = normalizeAmountCents(component?.line_tax_amount_cents, 0);
      const grossAmountCents = normalizeAmountCents(
        component?.line_gross_amount_cents,
        normalizeAmountCents(component?.line_total_amount_cents, netAmountCents + taxAmountCents)
      );
      if (!netAmountCents && !taxAmountCents && !grossAmountCents) continue;
      const bucket = buckets.get(taxRateBasisPoints) || {
        tax_rate_basis_points: taxRateBasisPoints,
        net_amount_cents: 0,
        tax_amount_cents: 0,
        gross_amount_cents: 0,
        items_count: 0
      };
      bucket.net_amount_cents += netAmountCents;
      bucket.tax_amount_cents += taxAmountCents;
      bucket.gross_amount_cents += grossAmountCents;
      bucket.items_count += 1;
      buckets.set(taxRateBasisPoints, bucket);
    }
    return Array.from(buckets.values()).sort((left, right) => left.tax_rate_basis_points - right.tax_rate_basis_points);
  }

  function computeBookingOfferTotals(offer) {
    const internalDetailLevel = normalizeOfferDetailLevel(offer?.offer_detail_level_internal);
    const mainItemsCount = internalDetailLevel === "trip"
      ? (offer?.trip_price_internal ? 1 : 0)
      : internalDetailLevel === "day"
        ? (Array.isArray(offer?.days_internal) ? offer.days_internal.length : 0)
        : (Array.isArray(offer?.components) ? offer.components.length : 0);
    const additionalItemsCount = Array.isArray(offer?.additional_items) ? offer.additional_items.length : 0;
    const hasDiscount = offer?.discount && normalizeAmountCents(offer.discount?.amount_cents, 0) > 0;
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
      items_count: mainItemsCount + additionalItemsCount + (hasDiscount ? 1 : 0)
    };
  }

  function computeBookingOfferQuotationSummary(offer) {
    const totals = computeBookingOfferTotals(offer);
    return {
      tax_included: true,
      subtotal_net_amount_cents: totals.net_amount_cents,
      total_tax_amount_cents: totals.tax_amount_cents,
      grand_total_amount_cents: totals.gross_amount_cents,
      tax_breakdown: computeBookingOfferTaxBreakdown(offer)
    };
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
      components: [],
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
        lines: [...normalizedOffer.components, ...foldedCarryOverItems]
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
      const components = Array.isArray(normalizedOffer.components) ? normalizedOffer.components : [];
      if (components.some((component) => !Number.isInteger(component?.day_number) || component.day_number < 1)) {
        projection.derivable = false;
        return projection;
      }
      const byDay = new Map();
      for (const component of components) {
        const dayNumber = Number(component.day_number);
        const bucket = byDay.get(dayNumber) || [];
        bucket.push(component);
        byDay.set(dayNumber, bucket);
      }
      projection.days = Array.from(byDay.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([dayNumber, lines]) => createVisibleProjectionLine({
          label: `Day ${dayNumber}`,
          dayNumber,
          currency,
          lines
        }));
      return projection;
    }

    projection.components = Array.isArray(normalizedOffer.components) ? normalizedOffer.components : [];
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
      const description = normalizeText(line?.description);
      if (description) normalizedLine.description = description;
      return normalizedLine;
    });

    const notes = normalizeText(source.notes);
    const normalized = {
      currency: safeCurrency(currency),
      lines
    };
    if (notes) normalized.notes = notes;
    return normalized;
  }

  function normalizeBookingOfferDiscount(rawDiscount, currency) {
    const source = rawDiscount && typeof rawDiscount === "object" ? rawDiscount : null;
    if (!source) return null;
    const reason = normalizeText(source.reason ?? source.details ?? source.description ?? source.label);
    const amountCents = Math.max(
      0,
      normalizeAmountCents(source.amount_cents ?? source.gross_amount_cents, 0)
    );
    if (!reason && amountCents <= 0) return null;
    const computed = computeOfferDiscountAmounts({ amount_cents: amountCents });
    return {
      reason,
      amount_cents: amountCents,
      currency: safeCurrency(currency),
      line_net_amount_cents: computed.line_net_amount_cents,
      line_tax_amount_cents: computed.line_tax_amount_cents,
      line_gross_amount_cents: computed.line_gross_amount_cents
    };
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

  function computeBookingPricingSummary(pricing) {
    const normalized = pricing && typeof pricing === "object" ? pricing : {};
    const agreed = normalizeAmountCents(normalized.agreed_net_amount_cents, 0);
    const adjustmentDelta = (Array.isArray(normalized.adjustments) ? normalized.adjustments : []).reduce(
      (sum, adjustment) => sum + normalizeAmountCents(adjustment?.amount_cents, 0),
      0
    );
    const adjusted = agreed + adjustmentDelta;
    const scheduledNet = (Array.isArray(normalized.payments) ? normalized.payments : []).reduce(
      (sum, payment) => sum + normalizeAmountCents(payment?.net_amount_cents, 0),
      0
    );
    const scheduledTax = (Array.isArray(normalized.payments) ? normalized.payments : []).reduce(
      (sum, payment) => sum + normalizeAmountCents(payment?.tax_amount_cents, 0),
      0
    );
    const scheduledGross = (Array.isArray(normalized.payments) ? normalized.payments : []).reduce(
      (sum, payment) => sum + normalizeAmountCents(payment?.gross_amount_cents, normalizeAmountCents(payment?.net_amount_cents, 0)),
      0
    );
    const paidGross = (Array.isArray(normalized.payments) ? normalized.payments : [])
      .filter((payment) => normalizeText(payment?.status).toUpperCase() === paymentStatuses.PAID)
      .reduce((sum, payment) => sum + normalizeAmountCents(payment?.gross_amount_cents, normalizeAmountCents(payment?.net_amount_cents, 0)), 0);
    return {
      agreed_net_amount_cents: agreed,
      adjustments_delta_cents: adjustmentDelta,
      adjusted_net_amount_cents: adjusted,
      scheduled_net_amount_cents: scheduledNet,
      unscheduled_net_amount_cents: adjusted - scheduledNet,
      scheduled_tax_amount_cents: scheduledTax,
      scheduled_gross_amount_cents: scheduledGross,
      paid_gross_amount_cents: paidGross,
      outstanding_gross_amount_cents: Math.max(0, scheduledGross - paidGross),
      is_schedule_balanced: scheduledNet === adjusted
    };
  }

  function defaultBookingPricing() {
    return {
      currency: baseCurrency,
      agreed_net_amount_cents: 0,
      adjustments: [],
      payments: [],
      summary: computeBookingPricingSummary(null)
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

  function normalizeBookingOfferAdditionalItems(rawItems, currency) {
    return (Array.isArray(rawItems) ? rawItems : []).map((item, index) => {
      const computedAmounts = computeOfferAdditionalItemAmounts(item);
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
    });
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
      components: [],
      additional_items: [],
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
    const contentLang = normalizeBookingContentLang(options?.contentLang || options?.lang || "en");
    const flatLang = normalizeBookingContentLang(options?.flatLang || options?.lang || "en");
    const sourceComponents = Array.isArray(source.components) ? source.components : [];
    const legacyDiscountComponent = source.discount
      ? null
      : sourceComponents.find((component) => normalizeOfferCategory(component?.category) === offerCategories.DISCOUNTS_CREDITS);
    const normalizedComponents = sourceComponents
      .filter((component) => normalizeOfferCategory(component?.category) !== offerCategories.DISCOUNTS_CREDITS)
      .map((component, index) => {
        const computedAmounts = computeOfferComponentAmounts(component);
        const normalizedDayNumber = Number.parseInt(component?.day_number, 10);
        const label_i18n = normalizeLocalizedTextMap(component?.label_i18n ?? component?.label, contentLang);
        const details_i18n = normalizeLocalizedTextMap(
          component?.details_i18n ?? component?.details ?? component?.description,
          contentLang
        );
        const notes_i18n = normalizeLocalizedTextMap(component?.notes_i18n ?? component?.notes, contentLang);
        return {
          id: normalizeText(component?.id) || `offer_component_${index + 1}`,
          category: computedAmounts.category,
          label: resolveLocalizedText(label_i18n, flatLang),
          label_i18n,
          details: resolveLocalizedText(details_i18n, flatLang),
          details_i18n,
          day_number: Number.isInteger(normalizedDayNumber) && normalizedDayNumber >= 1 ? normalizedDayNumber : null,
          quantity: computedAmounts.quantity,
          unit_amount_cents: computedAmounts.unit_amount_cents,
          unit_net_amount_cents: computedAmounts.unit_net_amount_cents,
          unit_tax_amount_cents: computedAmounts.unit_tax_amount_cents,
          unit_total_amount_cents: computedAmounts.unit_total_amount_cents,
          tax_rate_basis_points: computedAmounts.tax_rate_basis_points,
          currency,
          notes: resolveLocalizedText(notes_i18n, flatLang),
          notes_i18n,
          sort_order: Number.isFinite(Number(component?.sort_order)) ? Number(component.sort_order) : index,
          created_at: component?.created_at || null,
          updated_at: component?.updated_at || null,
          line_net_amount_cents: computedAmounts.line_net_amount_cents,
          line_tax_amount_cents: computedAmounts.line_tax_amount_cents,
          line_gross_amount_cents: computedAmounts.line_gross_amount_cents,
          line_total_amount_cents: computedAmounts.line_total_amount_cents
        };
      });
    const components = internalDetailLevel === "component" ? normalizedComponents : [];
    const tripPriceInternal = internalDetailLevel === "trip"
      ? normalizeBookingOfferTripPriceInternal(source.trip_price_internal, currency)
      : null;
    const daysInternal = internalDetailLevel === "day"
      ? normalizeBookingOfferDayPricesInternal(source.days_internal, currency)
      : [];
    const additionalItems = normalizeBookingOfferAdditionalItems(source.additional_items, currency);

    const discount = normalizeBookingOfferDiscount(
      source.discount || (legacyDiscountComponent
        ? {
            reason:
              legacyDiscountComponent?.details
              ?? legacyDiscountComponent?.description
              ?? legacyDiscountComponent?.notes
              ?? legacyDiscountComponent?.label,
            amount_cents: Math.abs(
              computeOfferComponentAmounts(legacyDiscountComponent).line_gross_amount_cents
            )
          }
        : null),
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
      components,
      ...(tripPriceInternal ? { trip_price_internal: tripPriceInternal } : {}),
      days_internal: daysInternal,
      additional_items: additionalItems,
      ...(discount ? { discount } : {})
    };
    const totals = computeBookingOfferTotals(normalizedBase);
    const quotationSummary = computeBookingOfferQuotationSummary(normalizedBase);
    const paymentTerms = normalizeBookingOfferPaymentTerms(
      source.payment_terms,
      currency,
      quotationSummary.grand_total_amount_cents
    );
    return normalizeOfferTranslationMeta({
      ...normalizedBase,
      totals,
      quotation_summary: quotationSummary,
      ...(paymentTerms ? { payment_terms: paymentTerms } : {}),
      total_price_cents: totals.total_price_cents
    });
  }

  function normalizeOfferStatus(value) {
    const normalized = normalizeText(value).toUpperCase();
    return ["DRAFT", "APPROVED", "OFFER_SENT"].includes(normalized) ? normalized : "DRAFT";
  }

  function normalizeBookingPricing(rawPricing) {
    const source = rawPricing && typeof rawPricing === "object" ? rawPricing : {};
    const currency = safeCurrency(source.currency || baseCurrency);
    const adjustments = (Array.isArray(source.adjustments) ? source.adjustments : []).map((adjustment, index) => ({
      id: normalizeText(adjustment?.id) || `pricing_adjustment_${index + 1}`,
      type: normalizeText(adjustment?.type).toUpperCase() || pricingAdjustmentTypes.DISCOUNT,
      label: normalizeText(adjustment?.label),
      amount_cents: normalizeAmountCents(adjustment?.amount_cents, 0),
      note: normalizeText(adjustment?.note),
      created_at: adjustment?.created_at || null,
      updated_at: adjustment?.updated_at || null
    }));
    const payments = (Array.isArray(source.payments) ? source.payments : []).map((payment, index) => ({
      id: normalizeText(payment?.id) || `pricing_payment_${index + 1}`,
      label: normalizeText(payment?.label),
      due_date: normalizeText(payment?.due_date) || null,
      net_amount_cents: normalizeAmountCents(payment?.net_amount_cents, 0),
      tax_rate_basis_points: clampOfferTaxRateBasisPoints(payment?.tax_rate_basis_points, 0),
      status: normalizeText(payment?.status).toUpperCase() || paymentStatuses.PENDING,
      paid_at: payment?.paid_at || null,
      notes: normalizeText(payment?.notes),
      tax_amount_cents: normalizeAmountCents(payment?.tax_amount_cents, 0),
      gross_amount_cents: normalizeAmountCents(payment?.gross_amount_cents, normalizeAmountCents(payment?.net_amount_cents, 0))
    }));
    const pricing = {
      currency,
      agreed_net_amount_cents: normalizeAmountCents(source.agreed_net_amount_cents, 0),
      adjustments,
      payments
    };
    return {
      ...pricing,
      summary: computeBookingPricingSummary(pricing)
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

  function convertOfferLineAmountForCurrency(component, rates, fromCurrency, toCurrency) {
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
      const computedAmounts = computeOfferComponentAmounts(component);
      return {
        id: String(component?.id || ""),
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
    const safeQuantity = Math.max(1, safeInt(component?.quantity) || 1);
    const unitAmountCents = Math.max(0, Number(component?.unit_amount_cents || 0));
    const sourceToBaseRate = sourceCurrency === baseCurrency ? 1 : normalizedRates.sourceToBaseRate;
    const baseToTargetRate = targetCurrency === baseCurrency ? 1 : normalizedRates.baseToTargetRate;

    const unitMajor = unitAmountCents / fromScale;
    const baseScale = 10 ** baseDefinition.decimal_places;
    const unitBaseMajor = unitMajor * sourceToBaseRate;
    const roundedUnitBaseMinor = Math.max(0, Math.round(unitBaseMajor * baseScale));
    const roundedUnitBaseMajor = roundedUnitBaseMinor / baseScale;
    const convertedUnitMajor = roundedUnitBaseMajor * baseToTargetRate;
    const convertedUnitMinor = Math.max(0, Math.round(convertedUnitMajor * toScale));
    const computedAmounts = computeOfferComponentAmounts(component, {
      quantity: safeQuantity,
      unitAmountCents: convertedUnitMinor
    });

    return {
      id: String(component?.id || ""),
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

  function getOfferCurrencyForStorage(offer) {
    return safeCurrency(offer?.currency || baseCurrency);
  }

  function getPricingCurrencyForStorage(pricing) {
    return safeCurrency(pricing?.currency || baseCurrency);
  }

  async function convertBookingPricingToBaseCurrency(pricing) {
    const normalized = normalizeBookingPricing(pricing);
    const sourceCurrency = getPricingCurrencyForStorage(normalized);
    if (sourceCurrency === baseCurrency) {
      return {
        ...normalized,
        currency: baseCurrency
      };
    }

    const [agreedNetAmount, adjustments, payments] = await Promise.all([
      convertMinorUnits(normalized.agreed_net_amount_cents, sourceCurrency, baseCurrency),
      Promise.all(
        normalized.adjustments.map((adjustment) =>
          convertMinorUnits(adjustment.amount_cents, sourceCurrency, baseCurrency)
        )
      ),
      Promise.all(
        normalized.payments.map((payment) => convertMinorUnits(payment.net_amount_cents, sourceCurrency, baseCurrency))
      )
    ]);

    return {
      ...normalized,
      currency: baseCurrency,
      agreed_net_amount_cents: agreedNetAmount,
      adjustments: normalized.adjustments.map((adjustment, index) => ({
        ...adjustment,
        amount_cents: adjustments[index]
      })),
      payments: normalized.payments.map((payment, index) => ({
        ...payment,
        net_amount_cents: payments[index]
      }))
    };
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
        currency: displayCurrency,
        totals: normalized.totals || computeBookingPricingSummary(normalized),
        total_price_cents: normalized.total_price_cents ?? (normalized.totals?.total_price_cents || 0)
      };
    }

    const [agreedNetAmount, adjustments, payments] = await Promise.all([
      convertMinorUnits(normalized.agreed_net_amount_cents, sourceCurrency, displayCurrency),
      Promise.all(
        normalized.adjustments.map((adjustment) =>
          convertMinorUnits(adjustment.amount_cents, sourceCurrency, displayCurrency)
        )
      ),
      Promise.all(
        normalized.payments.map((payment) => convertMinorUnits(payment.net_amount_cents, sourceCurrency, displayCurrency))
      )
    ]);

    return {
      ...normalized,
      currency: displayCurrency,
      agreed_net_amount_cents: agreedNetAmount,
      adjustments: normalized.adjustments.map((adjustment, index) => ({
        ...adjustment,
        amount_cents: adjustments[index]
      })),
      payments: normalized.payments.map((payment, index) => ({
        ...payment,
        net_amount_cents: payments[index]
      }))
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

    const [convertedComponentAmounts, convertedAdditionalItemAmounts, convertedDayAmounts, convertedTripAmount, convertedDiscountAmount] = await Promise.all([
      Promise.all(
        normalized.components.map((component) => convertMinorUnits(component.unit_amount_cents, sourceCurrency, displayCurrency))
      ),
      Promise.all(
        (Array.isArray(normalized.additional_items) ? normalized.additional_items : []).map((item) =>
          convertMinorUnits(item.unit_amount_cents, sourceCurrency, displayCurrency)
        )
      ),
      Promise.all(
        (Array.isArray(normalized.days_internal) ? normalized.days_internal : []).map((dayPrice) =>
          convertMinorUnits(dayPrice.amount_cents, sourceCurrency, displayCurrency)
        )
      ),
      normalized.trip_price_internal
        ? convertMinorUnits(normalized.trip_price_internal.amount_cents, sourceCurrency, displayCurrency)
        : Promise.resolve(null),
      normalized.discount
        ? convertMinorUnits(normalized.discount.amount_cents, sourceCurrency, displayCurrency)
        : Promise.resolve(null)
    ]);

    return {
      ...Object.fromEntries(Object.entries(normalized).filter(([key]) => key !== "payment_terms")),
      currency: displayCurrency,
      components: normalized.components.map((component, index) => ({
        ...component,
        ...computeOfferComponentAmounts(component, {
          quantity: component?.quantity,
          unitAmountCents: convertedComponentAmounts[index]
        }),
        currency: displayCurrency,
      })),
      ...(normalized.trip_price_internal
        ? {
            trip_price_internal: {
              ...normalized.trip_price_internal,
              ...computeTripPriceInternalAmounts(normalized.trip_price_internal, {
                amountCents: convertedTripAmount
              }),
              currency: displayCurrency
            }
          }
        : {}),
      ...(Array.isArray(normalized.days_internal)
        ? {
            days_internal: normalized.days_internal.map((dayPrice, index) => ({
              ...dayPrice,
              ...computeOfferDayPriceInternalAmounts(dayPrice, {
                amountCents: convertedDayAmounts[index]
              }),
              currency: displayCurrency
            }))
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
      ...(normalized.discount
        ? {
            discount: {
              ...normalized.discount,
              ...computeOfferDiscountAmounts({
                amount_cents: convertedDiscountAmount
              }),
              amount_cents: convertedDiscountAmount,
              currency: displayCurrency
            }
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

    const inputComponents = Array.isArray(payload.components) ? payload.components : [];
    const components = [];

    for (let index = 0; index < inputComponents.length; index++) {
      const row = inputComponents[index];
      const rawAmount = normalizeAmountCents(row?.unit_amount_cents, 0);
      if (!Number.isFinite(rawAmount) || rawAmount < 0) {
        return { ok: false, error: `Component ${index + 1} has an invalid unit_amount_cents.` };
      }
      const category = normalizeOfferCategory(row?.category);
      const taxRateBasisPoints = clampOfferTaxRateBasisPoints(
        row?.tax_rate_basis_points,
        defaultOfferTaxRateBasisPoints
      );
      const quantity = Math.max(1, safeInt(row?.quantity) || 1);
      components.push({
        id: normalizeText(row?.id) || `component_${index}`,
        unit_amount_cents: rawAmount,
        category,
        tax_rate_basis_points: taxRateBasisPoints,
        quantity
      });
    }

    return { ok: true, fromCurrency, toCurrency, components };
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
    return input
      .map((component) => {
        const description_i18n = normalizeLocalizedTextMap(
          component?.description_i18n ?? component?.description,
          contentLang
        );
        const description = resolveLocalizedText(description_i18n, flatLang);
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
      quotation_summary: computeBookingOfferQuotationSummary(converted),
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
    const inputComponents = Array.isArray(rawOffer.components) ? rawOffer.components : [];
    for (let index = 0; index < inputComponents.length; index++) {
      const category = normalizeOfferCategory(inputComponents[index]?.category);
      if (category === offerCategories.DISCOUNTS_CREDITS) {
        return {
          ok: false,
          error: `Component ${index + 1} uses discounts_credits, which is not allowed in offer components. Use offer.discount instead.`
        };
      }
    }
    const inputAdditionalItems = Array.isArray(rawOffer.additional_items) ? rawOffer.additional_items : [];
    for (let index = 0; index < inputAdditionalItems.length; index++) {
      const category = normalizeOfferCategory(inputAdditionalItems[index]?.category);
      if (category === offerCategories.DISCOUNTS_CREDITS) {
        return {
          ok: false,
          error: `Additional item ${index + 1} uses discounts_credits, which is not allowed in additional items. Use offer.discount instead.`
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
      if (offer.discount) {
        if (!normalizeText(offer.discount.reason)) {
          return { ok: false, error: "Offer discount reason is required." };
        }
        if (normalizeAmountCents(offer.discount.amount_cents, 0) <= 0) {
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
    const converted = await convertPricingForDisplay(pricing, targetCurrency);
    return {
      ...converted,
      summary: computeBookingPricingSummary(converted)
    };
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
    computeOfferComponentAmounts,
    computeBookingOfferTotals,
    computeBookingPricingSummary,
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
