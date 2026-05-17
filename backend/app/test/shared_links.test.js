import test from "node:test";
import assert from "node:assert/strict";
import { buildBookingHref } from "../../../frontend/scripts/shared/links.js";

test("booking links include the booking content language when available", () => {
  assert.equal(
    buildBookingHref("booking-123", { content_lang: "FR" }),
    "booking.html?id=booking-123&content_lang=fr"
  );
  assert.equal(
    buildBookingHref("booking-456", { web_form_submission: { preferred_language: "de" } }),
    "booking.html?id=booking-456&content_lang=de"
  );
});
