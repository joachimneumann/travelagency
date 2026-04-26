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

test("translation client can force Google even when OpenAI is configured", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url || ""));
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
      apiKey: "test-openai-key",
      model: "gpt-4.1"
    });
    const translated = await client.translateEntries(
      {
        value: "ATP profile"
      },
      "fr",
      {
        sourceLangCode: "en",
        provider: "google",
        cacheNamespace: "tour-marketing-copy"
      }
    );

    assert.equal(translated.value, "Profil ATP");
    assert.equal(requestedUrls.length, 1);
    assert.match(requestedUrls[0], /^https:\/\/translate\.googleapis\.com\/translate_a\/single\?/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("global translation rules can satisfy an exact override without calling a provider", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    return {
      ok: true,
      async json() {
        return [[
          ["ignored", null, null, null]
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
        value: "Travel plan"
      },
      "fr",
      {
        sourceLangCode: "en",
        provider: "google",
        cacheNamespace: "translation-rules",
        translationRules: [
          { source: "Travel plan", target_lang: "fr", target: "Itineraire" }
        ]
      }
    );

    assert.equal(translated.value, "Itineraire");
    assert.equal(callCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("global translation rules can group multiple language overrides under one source term", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    return {
      ok: true,
      async json() {
        return [[
          ["ignored", null, null, null]
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
        value: "Travel plan"
      },
      "vi",
      {
        sourceLangCode: "en",
        provider: "google",
        cacheNamespace: "translation-rules-grouped",
        translationRules: [
          {
            source: "Travel plan",
            targets: [
              { target_lang: "fr", target: "Itineraire" },
              { target_lang: "vi", target: "Ke hoach du lich" }
            ]
          }
        ]
      }
    );

    assert.equal(translated.value, "Ke hoach du lich");
    assert.equal(callCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("global translation rules are restored inside longer translated strings", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  globalThis.fetch = async (url) => {
    requestUrl = String(url || "");
    return {
      ok: true,
      async json() {
        return [[
          ["Consultez [[ATP_TRANSLATION_RULE_0]] a Hoi An.", null, null, null]
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
        value: "See AsiaTravelPlan in Hoi An."
      },
      "fr",
      {
        sourceLangCode: "en",
        provider: "google",
        cacheNamespace: "translation-rules",
        translationRules: [
          { source: "AsiaTravelPlan", target_lang: "fr", target: "AsiaTravelPlan" }
        ]
      }
    );

    assert.equal(translated.value, "Consultez AsiaTravelPlan a Hoi An.");
    assert.match(decodeURIComponent(requestUrl), /\[\[ATP_TRANSLATION_RULE_0\]\]/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("translation cache is keyed by source text hash, source lang, target lang, translation profile, and global rules", async () => {
  const originalFetch = globalThis.fetch;
  const requestLog = [];
  globalThis.fetch = async (url) => {
    const requestUrl = String(url || "");
    requestLog.push(requestUrl);
    const parsed = new URL(requestUrl);
    const targetLang = parsed.searchParams.get("tl");
    return {
      ok: true,
      async json() {
        return [[
          [`translated-${targetLang}`, null, null, null]
        ]];
      }
    };
  };

  try {
    const client = createTranslationClient({
      apiKey: "",
      googleFallbackEnabled: true
    });

    const first = await client.translateEntries(
      { value: "ATP profile" },
      "fr",
      {
        sourceLangCode: "en",
        provider: "google",
        cacheNamespace: "tour-marketing-copy",
        translationRules: [
          { source: "AsiaTravelPlan", target_lang: "fr", target: "AsiaTravelPlan" }
        ]
      }
    );
    const second = await client.translateEntries(
      { value: "ATP profile" },
      "fr",
      {
        sourceLangCode: "en",
        provider: "google",
        cacheNamespace: "tour-marketing-copy",
        translationRules: [
          { source: "AsiaTravelPlan", target_lang: "fr", target: "AsiaTravelPlan" }
        ]
      }
    );
    const differentTarget = await client.translateEntries(
      { value: "ATP profile" },
      "de",
      {
        sourceLangCode: "en",
        provider: "google",
        cacheNamespace: "tour-marketing-copy",
        translationRules: [
          { source: "AsiaTravelPlan", target_lang: "de", target: "AsiaTravelPlan" }
        ]
      }
    );
    const differentSource = await client.translateEntries(
      { value: "ATP profile" },
      "fr",
      {
        sourceLangCode: "vi",
        provider: "google",
        cacheNamespace: "tour-marketing-copy",
        translationRules: [
          { source: "AsiaTravelPlan", target_lang: "fr", target: "AsiaTravelPlan" }
        ]
      }
    );
    const differentProfile = await client.translateEntries(
      { value: "ATP profile" },
      "fr",
      {
        sourceLangCode: "en",
        provider: "google",
        cacheNamespace: "tour-marketing-copy",
        translationProfile: "staff_profile",
        translationRules: [
          { source: "AsiaTravelPlan", target_lang: "fr", target: "AsiaTravelPlan" }
        ]
      }
    );
    const differentRules = await client.translateEntries(
      { value: "ATP profile" },
      "fr",
      {
        sourceLangCode: "en",
        provider: "google",
        cacheNamespace: "tour-marketing-copy",
        translationRules: [
          { source: "Kommo", target_lang: "fr", target: "Kommo" }
        ]
      }
    );

    assert.equal(first.value, "translated-fr");
    assert.equal(second.value, "translated-fr");
    assert.equal(differentTarget.value, "translated-de");
    assert.equal(differentSource.value, "translated-fr");
    assert.equal(differentProfile.value, "translated-fr");
    assert.equal(differentRules.value, "translated-fr");
    assert.equal(requestLog.length, 5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenAI translation uses profile context and global translation rules in instructions", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({
      url: String(url || ""),
      body: JSON.parse(String(options?.body || "{}"))
    });
    return {
      ok: true,
      async json() {
        return {
          output_text: JSON.stringify({
            value: "Vue booking"
          })
        };
      }
    };
  };

  try {
    const client = createTranslationClient({
      apiKey: "test-openai-key",
      model: "gpt-4.1"
    });
    const translated = await client.translateEntries(
      {
        value: "Booking view"
      },
      "vi",
      {
        sourceLangCode: "en",
        translationProfile: "staff_backend_ui",
        context: "This label appears in the booking sidebar.",
        translationRules: [
          { source: "Booking", target_lang: "vi", target: "Dat cho" },
          { source: "Kommo", target_lang: "vi", target: "Kommo" }
        ]
      }
    );

    assert.equal(translated.value, "Vue booking");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://api.openai.com/v1/responses");
    assert.match(requests[0].body.instructions, /internal staff backend UI copy/);
    assert.match(requests[0].body.instructions, /These strings are staff-facing labels, hints, statuses, and workflow text inside a travel agency backend\./);
    assert.match(requests[0].body.instructions, /This label appears in the booking sidebar\./);
    assert.match(requests[0].body.instructions, /"Booking" => "Dat cho"/);
    assert.match(requests[0].body.instructions, /Kommo/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
