import test from "node:test";
import assert from "node:assert/strict";
import { createPricingHelpers } from "../src/domain/pricing.js";

function buildPricingHelpers() {
  return createPricingHelpers({
    baseCurrency: "USD",
    exchangeRateOverrides: {},
    fxRateCache: new Map(),
    fxRateCacheTtlMs: 0,
    defaultOfferTaxRateBasisPoints: 0,
    offerCategories: {
      ACCOMMODATION: "ACCOMMODATION",
      TRANSPORTATION: "TRANSPORTATION",
      OTHER: "OTHER",
      DISCOUNTS_CREDITS: "DISCOUNTS_CREDITS"
    },
    offerCategoryOrder: ["ACCOMMODATION", "TRANSPORTATION", "OTHER", "DISCOUNTS_CREDITS"],
    pricingAdjustmentTypes: {
      DISCOUNT: "DISCOUNT"
    },
    paymentStatuses: {
      PENDING: "PENDING",
      PAID: "PAID"
    },
    generatedCurrencyDefinition: null,
    normalizeGeneratedCurrencyCode: (value) => String(value || "USD").trim().toUpperCase() || "USD",
    clamp: (value, min, max) => Math.min(Math.max(value, min), max),
    safeInt: (value) => {
      const parsed = Number.parseInt(String(value ?? ""), 10);
      return Number.isFinite(parsed) ? parsed : null;
    },
    randomUUID: () => "test-uuid",
    paymentDocumentsDir: "/tmp",
    generatedOffersDir: "/tmp"
  });
}

test("trip visible pricing folds synthetic carry-over surcharge into trip total", () => {
  const helpers = buildPricingHelpers();
  const offer = helpers.normalizeBookingOffer({
    currency: "USD",
    offer_detail_level_internal: "day",
    offer_detail_level_visible: "trip",
    days_internal: [
      {
        id: "day_1",
        day_number: 1,
        label: "Day 1",
        amount_cents: 1000,
        tax_rate_basis_points: 0
      }
    ],
    additional_items: [
      {
        id: "carry_over",
        label: "Additional item",
        details: "Carry-over surcharge",
        quantity: 1,
        unit_amount_cents: 200,
        tax_rate_basis_points: 0
      },
      {
        id: "real_addon",
        label: "Visa",
        details: "Border fee",
        quantity: 1,
        unit_amount_cents: 300,
        tax_rate_basis_points: 0
      }
    ]
  });

  const projection = helpers.buildVisiblePricingProjection(offer);
  assert.equal(projection.detail_level, "trip");
  assert.equal(projection.trip_price.line_gross_amount_cents, 1200);
  assert.equal(projection.additional_items.length, 1);
  assert.equal(projection.additional_items[0].id, "real_addon");
});

test("trip internal pricing folds synthetic carry-over surcharge into trip total and removes it from adjustments", () => {
  const helpers = buildPricingHelpers();
  const offer = helpers.normalizeBookingOffer({
    currency: "USD",
    offer_detail_level_internal: "trip",
    offer_detail_level_visible: "trip",
    trip_price_internal: {
      id: "trip_total",
      label: "Trip total",
      amount_cents: 1000,
      tax_rate_basis_points: 0
    },
    additional_items: [
      {
        id: "carry_over",
        label: "Additional item",
        details: "Carry-over surcharge",
        quantity: 1,
        unit_amount_cents: 200,
        tax_rate_basis_points: 0
      },
      {
        id: "real_addon",
        label: "Visa",
        details: "Border fee",
        quantity: 1,
        unit_amount_cents: 300,
        tax_rate_basis_points: 0
      }
    ]
  });

  assert.equal(offer.trip_price_internal?.line_gross_amount_cents, 1200);
  assert.equal(offer.additional_items.length, 1);
  assert.equal(offer.additional_items[0].id, "real_addon");
  assert.equal(offer.total_price_cents, 1500);
});

test("legacy component trip fallback preserves tax amounts in quotation summary", () => {
  const helpers = buildPricingHelpers();
  const offer = helpers.normalizeBookingOffer({
    currency: "USD",
    components: [
      {
        id: "legacy_trip_line",
        category: "TRANSPORTATION",
        quantity: 1,
        unit_amount_cents: 10000,
        tax_rate_basis_points: 1000
      }
    ]
  });

  assert.equal(offer.offer_detail_level_internal, "trip");
  assert.equal(offer.trip_price_internal?.amount_cents, 10000);
  assert.equal(offer.trip_price_internal?.line_tax_amount_cents, 1000);
  assert.equal(offer.trip_price_internal?.line_gross_amount_cents, 11000);
  assert.equal(offer.quotation_summary?.subtotal_net_amount_cents, 10000);
  assert.equal(offer.quotation_summary?.total_tax_amount_cents, 1000);
  assert.equal(offer.quotation_summary?.grand_total_amount_cents, 11000);
  assert.deepEqual(offer.quotation_summary?.tax_breakdown, [
    {
      tax_rate_basis_points: 1000,
      net_amount_cents: 10000,
      tax_amount_cents: 1000,
      gross_amount_cents: 11000,
      items_count: 1
    }
  ]);
});

test("legacy component day fallback keeps exact tax breakdown across mixed day rates", () => {
  const helpers = buildPricingHelpers();
  const offer = helpers.normalizeBookingOffer({
    currency: "USD",
    components: [
      {
        id: "legacy_day_one_taxed",
        category: "TRANSPORTATION",
        day_number: 1,
        quantity: 1,
        unit_amount_cents: 10000,
        tax_rate_basis_points: 1000
      },
      {
        id: "legacy_day_one_tax_free",
        category: "OTHER",
        day_number: 1,
        quantity: 1,
        unit_amount_cents: 5000,
        tax_rate_basis_points: 0
      }
    ]
  });

  assert.equal(offer.offer_detail_level_internal, "day");
  assert.equal(offer.days_internal.length, 1);
  assert.equal(offer.days_internal[0]?.amount_cents, 15000);
  assert.equal(offer.days_internal[0]?.line_tax_amount_cents, 1000);
  assert.equal(offer.days_internal[0]?.line_gross_amount_cents, 16000);
  assert.equal(offer.quotation_summary?.subtotal_net_amount_cents, 15000);
  assert.equal(offer.quotation_summary?.total_tax_amount_cents, 1000);
  assert.equal(offer.quotation_summary?.grand_total_amount_cents, 16000);
  assert.deepEqual(offer.quotation_summary?.tax_breakdown, [
    {
      tax_rate_basis_points: 0,
      net_amount_cents: 5000,
      tax_amount_cents: 0,
      gross_amount_cents: 5000,
      items_count: 1
    },
    {
      tax_rate_basis_points: 1000,
      net_amount_cents: 10000,
      tax_amount_cents: 1000,
      gross_amount_cents: 11000,
      items_count: 1
    }
  ]);
});
