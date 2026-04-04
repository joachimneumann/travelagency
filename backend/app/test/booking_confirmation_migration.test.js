import test from "node:test";
import assert from "node:assert/strict";
import { backfillGeneratedOfferBookingConfirmationState } from "../src/domain/booking_confirmation.js";

test("generated-offer booking confirmation backfill migrates legacy confirmation fields once", () => {
  const store = {
    bookings: [
      {
        id: "booking_legacy_confirmation",
        generated_offers: [
          {
            id: "generated_offer_legacy_confirmation",
            acceptance: {
              method: "PORTAL_CLICK",
              accepted_at: "2026-04-04T00:00:00.000Z"
            },
            booking_confirmation_route: {
              mode: "DEPOSIT_PAYMENT",
              status: "OPEN"
            },
            public_acceptance_token_nonce: "legacy-nonce",
            public_acceptance_token_created_at: "2026-04-04T00:00:00.000Z",
            public_acceptance_token_expires_at: "2026-04-11T00:00:00.000Z",
            public_acceptance_token_revoked_at: "2026-04-05T00:00:00.000Z"
          }
        ]
      }
    ]
  };

  const changed = backfillGeneratedOfferBookingConfirmationState(store, {
    now: "2026-04-04T00:00:00.000Z"
  });
  assert.equal(changed, true);

  const migratedOffer = store.bookings[0].generated_offers[0];
  assert.deepEqual(migratedOffer.booking_confirmation, {
    method: "PORTAL_CLICK",
    accepted_at: "2026-04-04T00:00:00.000Z"
  });
  assert.deepEqual(migratedOffer.customer_confirmation_flow, {
    mode: "DEPOSIT_PAYMENT",
    status: "CONFIRMED"
  });
  assert.equal(migratedOffer.booking_confirmation_token_nonce, "legacy-nonce");
  assert.equal(migratedOffer.booking_confirmation_token_created_at, "2026-04-04T00:00:00.000Z");
  assert.equal(migratedOffer.booking_confirmation_token_expires_at, "2026-04-11T00:00:00.000Z");
  assert.equal(migratedOffer.booking_confirmation_token_revoked_at, "2026-04-05T00:00:00.000Z");

  assert.equal("acceptance" in migratedOffer, false);
  assert.equal("booking_confirmation_route" in migratedOffer, false);
  assert.equal("public_acceptance_token_nonce" in migratedOffer, false);
  assert.equal("public_acceptance_token_created_at" in migratedOffer, false);
  assert.equal("public_acceptance_token_expires_at" in migratedOffer, false);
  assert.equal("public_acceptance_token_revoked_at" in migratedOffer, false);
});
