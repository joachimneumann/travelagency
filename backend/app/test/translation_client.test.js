import test from "node:test";
import assert from "node:assert/strict";
import { createTranslationClient } from "../src/lib/translation_client.js";

test("google fallback preserves sentence spacing between translated segments", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return [[
        ["Un itinéraire de grandes expéditions au Vietnam axé sur une boucle de montagne à travers Ha Giang.", null, null, null],
        ["Avec des journées actives, des itinéraires panoramiques et un soutien local pratique.", null, null, null],
        ["Avec plaisir et chance", null, null, null]
      ]];
    }
  });

  try {
    const client = createTranslationClient({
      apiKey: "",
      googleFallbackEnabled: true
    });
    const translated = await client.translateEntries(
      {
        value: "A Vietnam grand expeditions itinerary focused on a mountain-loop focus through Ha Giang. With active days, scenic routes, and practical local support. With fun and luck"
      },
      "fr",
      {
        sourceLangCode: "en",
        allowGoogleFallback: true
      }
    );

    assert.equal(
      translated.value,
      "Un itinéraire de grandes expéditions au Vietnam axé sur une boucle de montagne à travers Ha Giang. Avec des journées actives, des itinéraires panoramiques et un soutien local pratique. Avec plaisir et chance"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("google fallback maps Malay aliases to the ms target language code", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url || "");
    return {
      ok: true,
      async json() {
        return [[
          ["Profil ATP", null, null, null]
        ]];
      }
    };
  };

  try {
    const client = createTranslationClient({
      apiKey: "",
      googleFallbackEnabled: true
    });
    const translated = await client.translateEntries(
      {
        value: "ATP profile"
      },
      "Malay",
      {
        sourceLangCode: "English",
        allowGoogleFallback: true
      }
    );

    assert.equal(translated.value, "Profil ATP");
    const requestUrl = new URL(requestedUrl);
    assert.equal(requestUrl.searchParams.get("sl"), "en");
    assert.equal(requestUrl.searchParams.get("tl"), "ms");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
