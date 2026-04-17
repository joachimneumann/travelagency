import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createCountryReferenceHandlers } from "../src/http/handlers/country_reference.js";

test("country reference save regenerates public homepage assets", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "country-reference-handler-"));
  const generatorPath = path.join(repoRoot, "scripts", "assets", "generate_public_homepage_assets.mjs");
  await mkdir(path.dirname(generatorPath), { recursive: true });
  await writeFile(generatorPath, "process.stdout.write('ok\\n');\n", "utf8");

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
    nowIso: () => "2026-04-17T00:00:00.000Z",
    repoRoot,
    execFile: async (file, args, options) => {
      calls.push({ execFile: { file, args, options } });
    }
  });

  await handlers.handlePatchCountryReferenceInfo({}, {});

  assert.equal(persisted.length, 1);
  assert.equal(calls[0].execFile.args[0], generatorPath);
  assert.equal(calls[1].status, 200);
  assert.equal(calls[1].body.total, 1);
  assert.deepEqual(calls[1].body.homepage_assets, { ok: true });
});

test("country reference save returns homepage asset warning when regeneration fails", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "country-reference-handler-fail-"));
  const generatorPath = path.join(repoRoot, "scripts", "assets", "generate_public_homepage_assets.mjs");
  await mkdir(path.dirname(generatorPath), { recursive: true });
  await writeFile(generatorPath, "process.exit(1);\n", "utf8");

  const responses = [];
  const handlers = createCountryReferenceHandlers({
    readBodyJson: async () => ({
      items: [{
        country: "VN",
        published_on_webpage: false,
        practical_tips: [],
        emergency_contacts: []
      }]
    }),
    sendJson: (_res, status, body) => {
      responses.push({ status, body });
    },
    getPrincipal: () => ({ sub: "tester" }),
    canReadCountryReferenceInfo: () => true,
    canEditCountryReferenceInfo: () => true,
    readCountryPracticalInfo: async () => ({ items: [] }),
    persistCountryPracticalInfo: async () => {},
    normalizeText: (value) => String(value ?? "").trim(),
    nowIso: () => "2026-04-17T00:00:00.000Z",
    repoRoot,
    execFile: async () => {
      const error = new Error("boom");
      error.stderr = "generator failed";
      throw error;
    }
  });

  await handlers.handlePatchCountryReferenceInfo({}, {});

  assert.equal(responses.length, 1);
  assert.equal(responses[0].status, 200);
  assert.deepEqual(responses[0].body.homepage_assets, {
    ok: false,
    error: "generator failed"
  });
});
