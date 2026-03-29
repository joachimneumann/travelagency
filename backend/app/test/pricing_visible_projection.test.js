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
    invoicesDir: "/tmp",
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
