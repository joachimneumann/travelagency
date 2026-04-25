import test from "node:test";
import assert from "node:assert/strict";
import { formatPdfMoney, pdfT } from "../src/lib/pdf_i18n.js";

test("formatPdfMoney normalizes PDF-hostile unicode spacing separators", () => {
  const formatted = formatPdfMoney(108984, "EURO", "fr");
  assert.equal(formatted, "€1 089,84");
  assert.equal(/[\u00A0\u202F]/.test(formatted), false);
});

test("formatPdfMoney renders VND with an ASCII currency code for PDF safety", () => {
  const formatted = formatPdfMoney(16763620, "VND", "en");
  assert.equal(formatted, "VND 16,763,620");
  assert.equal(formatted.includes("₫"), false);
});

test("travel plan default welcome text localizes style-aware copy", () => {
  const translated = pdfT("de", "travel_plan.default_welcome_styles", "fallback", {
    styles: "Budget, Kultur, Kulinarische Erlebnisse"
  });

  assert.equal(
    translated,
    "Dies ist Ihr aktueller Reiseplan für Budget, Kultur, Kulinarische Erlebnisse. Bitte teilen Sie uns mit, wenn Sie etwas ändern möchten."
  );
  assert.equal(translated.includes("This is your current"), false);
});
