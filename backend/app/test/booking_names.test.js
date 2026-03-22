import test from "node:test";
import assert from "node:assert/strict";
import {
  isSuspiciousSentinelString,
  resolveBookingNameForStorage
} from "../src/domain/booking_names.js";
import { normalizeText } from "../src/lib/text.js";

test("detects suspicious sentinel strings", () => {
  assert.equal(isSuspiciousSentinelString("[object Object]", normalizeText), true);
  assert.equal(isSuspiciousSentinelString("undefined", normalizeText), true);
  assert.equal(isSuspiciousSentinelString("Vietnam Culture - Hoi An", normalizeText), false);
});

test("keeps a normal booking name", async () => {
  const bookingName = await resolveBookingNameForStorage({
    bookingName: "Vietnam Culture - Hoi An",
    tourId: "tour_123",
    preferredLanguage: "en",
    normalizeText,
    readTours: async () => [],
    resolveLocalizedTourText: (value) => value
  });

  assert.equal(bookingName, "Vietnam Culture - Hoi An");
});

test("falls back to the tour title for suspicious booking names", async () => {
  const bookingName = await resolveBookingNameForStorage({
    bookingName: "[object Object]",
    tourId: "tour_123",
    preferredLanguage: "en",
    normalizeText,
    readTours: async () => [
      {
        id: "tour_123",
        title: {
          en: "Vietnam Culture - Hoi An",
          de: "Vietnam Kultur - Hoi An"
        }
      }
    ],
    resolveLocalizedTourText: (value, lang) => value?.[lang] || value?.en || null
  });

  assert.equal(bookingName, "Vietnam Culture - Hoi An");
});

test("returns null when suspicious booking name cannot be recovered from a tour", async () => {
  const bookingName = await resolveBookingNameForStorage({
    bookingName: "[object Object]",
    tourId: "tour_missing",
    preferredLanguage: "en",
    normalizeText,
    readTours: async () => [],
    resolveLocalizedTourText: (value) => value
  });

  assert.equal(bookingName, null);
});
