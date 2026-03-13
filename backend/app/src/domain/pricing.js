import path from "node:path";
import { normalizeText } from "../lib/text.js";

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
  invoicesDir
}) {
  function normalizeAmountCents(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.round(number);
  }

  function normalizeOfferCategory(value) {
    const category = normalizeText(value).toUpperCase();
    return offerCategoryOrder.includes(category) ? category : offerCategories.OTHER;
  }

  function offerCategorySign(category) {
    return normalizeOfferCategory(category) === offerCategories.DISCOUNTS_CREDITS ? -1 : 1;
  }

  function clampOfferTaxRateBasisPoints(value, fallback = defaultOfferTaxRateBasisPoints) {
    const number = safeInt(value);
    if (!Number.isFinite(number)) return fallback;
    return clamp(number, 0, 100000);
  }

  function computeBookingOfferTotals(offer) {
    const components = Array.isArray(offer?.components) ? offer.components : [];
    const totals = components.reduce((acc, component) => {
      acc.net_amount_cents += normalizeAmountCents(component?.line_net_amount_cents, 0);
      acc.tax_amount_cents += normalizeAmountCents(component?.line_tax_amount_cents, 0);
      acc.gross_amount_cents += normalizeAmountCents(component?.line_total_amount_cents, 0);
      return acc;
    }, {
      net_amount_cents: 0,
      tax_amount_cents: 0,
      gross_amount_cents: 0
    });
    return {
      ...totals,
      total_price_cents: totals.gross_amount_cents,
      items_count: components.length
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

  function defaultBookingOffer(preferredCurrency = baseCurrency) {
    return {
      status: "DRAFT",
      currency: safeCurrency(preferredCurrency),
      category_rules: offerCategoryOrder.map((category) => ({
        category,
        tax_rate_basis_points: defaultOfferTaxRateBasisPoints
      })),
      components: [],
      totals: computeBookingOfferTotals(null),
      total_price_cents: 0
    };
  }

  function normalizeBookingOffer(rawOffer, preferredCurrency = baseCurrency) {
    const source = rawOffer && typeof rawOffer === "object" ? rawOffer : {};
    const currency = safeCurrency(source.currency || preferredCurrency);
    const status = normalizeOfferStatus(source.status);
    const components = (Array.isArray(source.components) ? source.components : []).map((component, index) => {
      const quantity = Math.max(1, safeInt(component?.quantity) || 1);
      const unitAmountCents = Math.max(0, normalizeAmountCents(component?.unit_amount_cents, 0));
      const taxRateBasisPoints = clampOfferTaxRateBasisPoints(component?.tax_rate_basis_points, defaultOfferTaxRateBasisPoints);
      const sign = offerCategorySign(component?.category);
      const lineNetAmountCents = sign * unitAmountCents * quantity;
      const lineTaxAmountCents = sign * Math.round((Math.abs(lineNetAmountCents) * taxRateBasisPoints) / 10000);
      return {
        id: normalizeText(component?.id) || `offer_component_${index + 1}`,
        category: normalizeOfferCategory(component?.category),
        label: normalizeText(component?.label),
        details: normalizeText(component?.details),
        quantity,
        unit_amount_cents: unitAmountCents,
        tax_rate_basis_points: taxRateBasisPoints,
        currency,
        notes: normalizeText(component?.notes),
        sort_order: Number.isFinite(Number(component?.sort_order)) ? Number(component.sort_order) : index,
        created_at: component?.created_at || null,
        updated_at: component?.updated_at || null,
        line_net_amount_cents: lineNetAmountCents,
        line_tax_amount_cents: lineTaxAmountCents,
        line_total_amount_cents: lineNetAmountCents + lineTaxAmountCents
      };
    });

    const totals = computeBookingOfferTotals({ components });
    return {
      status,
      currency,
      category_rules: Array.isArray(source.category_rules) && source.category_rules.length
        ? source.category_rules.map((rule) => ({
            category: normalizeOfferCategory(rule?.category),
            tax_rate_basis_points: clampOfferTaxRateBasisPoints(rule?.tax_rate_basis_points, defaultOfferTaxRateBasisPoints)
          }))
        : offerCategoryOrder.map((category) => ({
            category,
            tax_rate_basis_points: defaultOfferTaxRateBasisPoints
          })),
      components,
      totals,
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
      const unitAmountCents = Math.max(0, Number(component?.unit_amount_cents || 0));
      const safeQuantity = Math.max(1, safeInt(component?.quantity) || 1);
      const sign = offerCategorySign(component?.category);
      const taxBasisPoints = clampOfferTaxRateBasisPoints(component?.tax_rate_basis_points, defaultOfferTaxRateBasisPoints);
      const lineNetAmountCents = sign * unitAmountCents * safeQuantity;
      const lineTaxAmountCents = sign * Math.round((Math.abs(lineNetAmountCents) * taxBasisPoints) / 10000);
      return {
        id: String(component?.id || ""),
        category: normalizeOfferCategory(component?.category),
        quantity: safeQuantity,
        tax_rate_basis_points: taxBasisPoints,
        unit_amount_cents: unitAmountCents,
        line_net_amount_cents: lineNetAmountCents,
        line_tax_amount_cents: lineTaxAmountCents,
        line_total_amount_cents: lineNetAmountCents + lineTaxAmountCents,
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
    const sign = offerCategorySign(component?.category);
    const taxBasisPoints = clampOfferTaxRateBasisPoints(component?.tax_rate_basis_points, defaultOfferTaxRateBasisPoints);
    const sourceToBaseRate = sourceCurrency === baseCurrency ? 1 : normalizedRates.sourceToBaseRate;
    const baseToTargetRate = targetCurrency === baseCurrency ? 1 : normalizedRates.baseToTargetRate;

    const unitMajor = unitAmountCents / fromScale;
    const baseScale = 10 ** baseDefinition.decimal_places;
    const unitBaseMajor = unitMajor * sourceToBaseRate;
    const roundedUnitBaseMinor = Math.max(0, Math.round(unitBaseMajor * baseScale));
    const roundedUnitBaseMajor = roundedUnitBaseMinor / baseScale;
    const convertedUnitMajor = roundedUnitBaseMajor * baseToTargetRate;
    const convertedUnitMinor = Math.max(0, Math.round(convertedUnitMajor * toScale));

    const lineNetAmountCents = sign * convertedUnitMinor * safeQuantity;
    const lineTaxAmountCents = sign * Math.round((Math.abs(lineNetAmountCents) * taxBasisPoints) / 10000);
    const line_total_amount_cents = lineNetAmountCents + lineTaxAmountCents;

    return {
      id: String(component?.id || ""),
      category: normalizeOfferCategory(component?.category),
      quantity: safeQuantity,
      tax_rate_basis_points: taxBasisPoints,
      unit_amount_cents: convertedUnitMinor,
      line_net_amount_cents: lineNetAmountCents,
      line_tax_amount_cents: lineTaxAmountCents,
      line_total_amount_cents,
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

  async function convertOfferForDisplay(rawOffer, targetCurrency) {
    const normalized = normalizeBookingOffer(rawOffer, getOfferCurrencyForStorage(rawOffer));
    const sourceCurrency = getOfferCurrencyForStorage(normalized);
    const displayCurrency = safeCurrency(targetCurrency || sourceCurrency);
    if (sourceCurrency === displayCurrency) {
      return {
        ...normalized,
        currency: displayCurrency
      };
    }

    const convertedAmounts = await Promise.all(
      normalized.components.map((component) => convertMinorUnits(component.unit_amount_cents, sourceCurrency, displayCurrency))
    );

    return {
      ...normalized,
      currency: displayCurrency,
      components: normalized.components.map((component, index) => ({
        ...component,
        currency: displayCurrency,
        unit_amount_cents: convertedAmounts[index]
      }))
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

  function normalizeInvoiceComponents(value) {
    const input = Array.isArray(value) ? value : [];
    return input
      .map((component) => {
        const description = normalizeText(component?.description);
        const quantity = Math.max(1, safeInt(component?.quantity) || 1);
        const unitAmountCents = safeAmountCents(component?.unit_amount_cents);
        if (!description || !unitAmountCents) return null;
        return {
          id: normalizeText(component?.id) || `inv_component_${randomUUID()}`,
          description,
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

  async function buildBookingOfferReadModel(rawOffer, preferredCurrency = baseCurrency) {
    const normalized = normalizeBookingOffer(rawOffer, preferredCurrency);
    const converted = await convertOfferForDisplay(normalized, preferredCurrency);
    const totals = computeBookingOfferTotals(converted);
    return {
      ...converted,
      totals,
      total_price_cents: totals.total_price_cents
    };
  }

  function validateBookingOfferInput(rawOffer, booking) {
    if (!rawOffer || typeof rawOffer !== "object") {
      return { ok: false, error: "Offer is required." };
    }
    const inputComponents = Array.isArray(rawOffer.components) ? rawOffer.components : [];
    for (let index = 0; index < inputComponents.length; index++) {
      const category = normalizeOfferCategory(inputComponents[index]?.category);
      if (category === offerCategories.DISCOUNTS_CREDITS) {
        return {
          ok: false,
          error: `Component ${index + 1} uses discounts_credits, which is not allowed in offer components. Use pricing adjustments instead.`
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
    computeBookingOfferTotals,
    computeBookingPricingSummary,
    defaultBookingPricing,
    defaultBookingOffer,
    normalizeBookingOffer,
    normalizeOfferStatus,
    buildBookingOfferReadModel,
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
    invoicePdfPath
  };
}
