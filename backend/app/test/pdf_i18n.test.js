import test from "node:test";
import assert from "node:assert/strict";
import { formatPdfMoney } from "../src/lib/pdf_i18n.js";

test("formatPdfMoney normalizes PDF-hostile unicode spacing separators", () => {
  const formatted = formatPdfMoney(108984, "EURO", "fr");
  assert.equal(formatted, "€1 089,84");
  assert.equal(/[\u00A0\u202F]/.test(formatted), false);
});
