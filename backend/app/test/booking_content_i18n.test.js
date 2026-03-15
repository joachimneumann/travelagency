import test from "node:test";
import assert from "node:assert/strict";
import { mergeEditableLocalizedTextField } from "../src/domain/booking_content_i18n.js";

test("editing the English source prunes stale translations down to English and the current language", () => {
  const result = mergeEditableLocalizedTextField(
    {
      en: "restaurant the eifel tour",
      it: "visita al ristorante",
      de: "Restaurantbesuch",
      fr: "visite du restaurant Eiffel"
    },
    "restaurant the eifel tour updated",
    {
      en: "restaurant the eifel tour updated",
      fr: "visite correcte du restaurant Eiffel"
    },
    "fr",
    { pruneExtraTranslationsOnEnglishChange: true }
  );

  assert.deepEqual(result.map, {
    en: "restaurant the eifel tour updated",
    fr: "visite correcte du restaurant Eiffel"
  });
  assert.equal(result.text, "restaurant the eifel tour updated");
});

test("editing only the current non-English translation preserves the other saved translations", () => {
  const result = mergeEditableLocalizedTextField(
    {
      en: "restaurant the eifel tour",
      it: "visita al ristorante",
      de: "Restaurantbesuch",
      fr: "ancienne traduction"
    },
    "nouvelle traduction",
    {
      en: "restaurant the eifel tour",
      fr: "nouvelle traduction"
    },
    "fr",
    { pruneExtraTranslationsOnEnglishChange: true }
  );

  assert.deepEqual(result.map, {
    en: "restaurant the eifel tour",
    it: "visita al ristorante",
    de: "Restaurantbesuch",
    fr: "nouvelle traduction"
  });
});

test("editing English while English is the selected language removes all non-English translations", () => {
  const result = mergeEditableLocalizedTextField(
    {
      en: "Airport transfer",
      fr: "Transfert aeroport",
      de: "Flughafentransfer"
    },
    "Private airport transfer",
    {
      en: "Private airport transfer"
    },
    "en",
    { pruneExtraTranslationsOnEnglishChange: true }
  );

  assert.deepEqual(result.map, {
    en: "Private airport transfer"
  });
  assert.equal(result.text, "Private airport transfer");
});
