import test from "node:test";
import assert from "node:assert/strict";
import { createCountryReferenceHandlers } from "../src/http/handlers/country_reference.js";

test("country reference save marks public homepage assets dirty without regenerating", async () => {
  const calls = [];
  const persisted = [];
  const handlers = createCountryReferenceHandlers({
    readBodyJson: async () => ({
      items: [{
        country: "VN",
        published_on_webpage: true,
        practical_tips: ["Use bottled water"],
        emergency_contacts: [{ label: "Police", phone: "113" }]
      }]
    }),
    sendJson: (_res, status, body) => {
      calls.push({ status, body });
    },
    getPrincipal: () => ({ sub: "tester" }),
    canReadCountryReferenceInfo: () => true,
    canEditCountryReferenceInfo: () => true,
    readCountryPracticalInfo: async () => ({ items: [] }),
    persistCountryPracticalInfo: async (value) => {
      persisted.push(value);
    },
    normalizeText: (value) => String(value ?? "").trim(),
    nowIso: () => "2026-04-17T00:00:00.000Z"
  });

  await handlers.handlePatchCountryReferenceInfo({}, {});

  assert.equal(persisted.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].status, 200);
  assert.equal(calls[0].body.total, 1);
  assert.deepEqual(calls[0].body.homepage_assets, {
    ok: true,
    dirty: true,
    reason: "country_reference_patch",
    item_count: 1
  });
});
