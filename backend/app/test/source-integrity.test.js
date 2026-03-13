import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function topLevelFunctionDeclarations(filePath) {
  const source = await readFile(filePath, "utf8");
  const lines = source.split("\n");
  let depth = 0;
  const names = [];
  for (const line of lines) {
    const match = line.match(/^\s{2}function\s+([A-Za-z0-9_]+)\s*\(/);
    if (depth === 1 && match) {
      names.push(match[1]);
    }
    for (const char of line) {
      if (char === "{") depth += 1;
      if (char === "}") depth = Math.max(0, depth - 1);
    }
  }
  return names;
}

async function moduleLevelFunctionDeclarations(filePath) {
  const source = await readFile(filePath, "utf8");
  const lines = source.split("\n");
  let depth = 0;
  const names = [];
  for (const line of lines) {
    const match = line.match(/^(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/);
    if (depth === 0 && match) {
      names.push(match[1]);
    }
    for (const char of line) {
      if (char === "{") depth += 1;
      if (char === "}") depth = Math.max(0, depth - 1);
    }
  }
  return names;
}

async function importedBindings(filePath) {
  const source = await readFile(filePath, "utf8");
  const bindings = [];
  const importBlocks = source.matchAll(/import\s+([\s\S]*?)\s+from\s+["'][^"']+["'];/g);
  for (const match of importBlocks) {
    const clause = String(match[1] || "").trim();
    if (!clause) continue;
    if (clause.startsWith("{")) {
      const inner = clause.replace(/^\{\s*|\s*\}$/g, "");
      for (const part of inner.split(",")) {
        const token = part.trim();
        if (!token) continue;
        const aliasMatch = token.match(/^(.*?)\s+as\s+([A-Za-z0-9_$]+)$/);
        if (aliasMatch) {
          bindings.push(aliasMatch[2]);
          continue;
        }
        const bareMatch = token.match(/^([A-Za-z0-9_$]+)$/);
        if (bareMatch) bindings.push(bareMatch[1]);
      }
      continue;
    }
    const defaultAndMaybeNamespace = clause.split(",").map((part) => part.trim()).filter(Boolean);
    if (defaultAndMaybeNamespace[0] && /^[A-Za-z0-9_$]+$/.test(defaultAndMaybeNamespace[0])) {
      bindings.push(defaultAndMaybeNamespace[0]);
    }
    if (defaultAndMaybeNamespace[1]) {
      const namespaceMatch = defaultAndMaybeNamespace[1].match(/^\*\s+as\s+([A-Za-z0-9_$]+)$/);
      if (namespaceMatch) bindings.push(namespaceMatch[1]);
    }
  }
  return bindings;
}

test("booking handlers do not contain duplicate top-level helper declarations", async () => {
  const filePath = path.resolve(__dirname, "..", "src", "http", "handlers", "bookings.js");
  const names = await topLevelFunctionDeclarations(filePath);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  assert.deepEqual(duplicates, []);
});

test("booking page keeps critical init handlers wired to real local functions", async () => {
  const filePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const names = await moduleLevelFunctionDeclarations(filePath);
  const required = [
    "loadActivities",
    "saveOwner",
    "saveStage",
    "saveNote",
    "updateNoteSaveButtonState",
    "savePricing",
    "handleOfferCurrencyChange",
    "addOfferComponent",
    "saveOffer",
    "updatePricingDirtyState",
    "loadInvoices",
    "onInvoiceSelectChange",
    "renderInvoiceMoneyLabels",
    "createInvoice",
    "updateInvoiceDirtyState"
  ];
  for (const name of required) {
    assert.ok(
      names.includes(name),
      `Expected booking.js to define ${name} because init/module wiring references it`
    );
  }
});

test("booking page does not declare duplicate imported bindings", async () => {
  const filePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const names = await importedBindings(filePath);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  assert.deepEqual(
    duplicates,
    [],
    "Duplicate imported bindings in booking.js cause browser SyntaxError before the page can run"
  );
});

test("offer row removal triggers an immediate save in the pricing module", async () => {
  const filePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "pricing.js");
  const source = await readFile(filePath, "utf8");
  assert.match(
    source,
    /data-offer-remove-component[\s\S]*?renderOfferComponentsTable\(\);[\s\S]*?await saveOffer\(\);/,
    "Removing an offer row should persist immediately instead of staying only in the local draft"
  );
});

test("offer editor uses autosave instead of an explicit update button", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const pricingModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "pricing.js");
  const bookingSource = await readFile(bookingPagePath, "utf8");
  const pricingSource = await readFile(pricingModulePath, "utf8");

  assert.doesNotMatch(
    bookingSource,
    /id="offer_save_btn"/,
    "Offer UI should not expose a manual update button"
  );
  assert.match(
    pricingSource,
    /data-offer-component-quantity[\s\S]*?addEventListener\("input",[\s\S]*?syncOfferInputTotals\(\)/,
    "Offer quantity changes should update totals live"
  );
  assert.match(
    pricingSource,
    /function scheduleOfferAutosave\(/,
    "Offer editor should persist through autosave"
  );
});

test("offer component editor does not expose discounts_credits as a selectable category", async () => {
  const pricingModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "pricing.js");
  const pricingSource = await readFile(pricingModulePath, "utf8");

  assert.match(
    pricingSource,
    /const OFFER_COMPONENT_CATEGORIES = OFFER_CATEGORIES\.filter\(\(category\) => category\.code !== "DISCOUNTS_CREDITS"\);/,
    "Offer component rows should not allow discounts_credits because that creates negative sellable line items"
  );
});
