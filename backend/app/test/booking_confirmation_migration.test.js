import test from "node:test";
import assert from "node:assert/strict";
import { pruneLegacyGeneratedOfferState } from "../src/domain/generated_offer_cleanup.js";

test("generated-offer startup cleanup migrates accepted snapshots and removes legacy confirmation fields", () => {
  const store = {
    bookings: [
      {
        id: "booking_legacy_confirmation",
        confirmed_generated_offer_id: "generated_offer_legacy_confirmation",
        generated_offers: [
          {
            id: "generated_offer_legacy_confirmation",
            currency: "USD",
            total_price_cents: 12000,
            offer: {
              currency: "USD",
              total_price_cents: 12000,
              payment_terms: {
                currency: "USD",
                lines: [
                  {
                    id: "payment_term_legacy_deposit",
                    kind: "DEPOSIT",
                    label: "Deposit",
                    sequence: 1,
                    amount_spec: {
                      mode: "FIXED_AMOUNT",
                      fixed_amount_cents: 3000
                    },
                    due_rule: {
                      type: "DAYS_AFTER_ACCEPTANCE",
                      days: 0
                    }
                  }
                ]
              }
            },
            travel_plan: {
              days: [
                {
                  id: "travel_plan_day_1",
                  day_number: 1,
                  services: []
                }
              ]
            },
            booking_confirmation: {
              method: "MANAGEMENT",
              accepted_at: "2026-04-04T00:00:00.000Z"
            },
            management_approver_atp_staff_id: "kc-joachim",
            management_approver_label: "Joachim",
            acceptance_route: {
              mode: "DEPOSIT_PAYMENT",
              status: "OPEN"
            },
            public_booking_confirmation_token_nonce: "legacy-nonce"
          }
        ]
      }
    ]
  };

  const changed = pruneLegacyGeneratedOfferState(store);
  assert.equal(changed, true);

  const booking = store.bookings[0];
  const migratedOffer = booking.generated_offers[0];

  assert.equal(booking.confirmed_generated_offer_id, undefined);
  assert.equal(booking.accepted_offer_artifact_ref, "generated_offer_legacy_confirmation");
  assert.equal(booking.accepted_deposit_amount_cents, 3000);
  assert.equal(booking.accepted_deposit_currency, "USD");
  assert.deepEqual(booking.accepted_offer_snapshot, migratedOffer.offer);
  assert.deepEqual(booking.accepted_payment_terms_snapshot, migratedOffer.offer.payment_terms);
  assert.deepEqual(booking.accepted_travel_plan_snapshot, migratedOffer.travel_plan);

  assert.equal("booking_confirmation" in migratedOffer, false);
  assert.equal("management_approver_atp_staff_id" in migratedOffer, false);
  assert.equal("management_approver_label" in migratedOffer, false);
  assert.equal("acceptance_route" in migratedOffer, false);
  assert.equal("public_booking_confirmation_token_nonce" in migratedOffer, false);
});
