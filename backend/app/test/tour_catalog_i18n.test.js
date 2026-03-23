import test from "node:test";
import assert from "node:assert/strict";
import {
  getTourStyleLabel,
  normalizeTourStyleCode,
  normalizeTourStyleLabels
} from "../src/domain/tour_catalog_i18n.js";

test("tour style catalog maps legacy values to the renamed canonical styles", () => {
  assert.equal(normalizeTourStyleCode("Adventure"), "grand-expeditions");
  assert.equal(normalizeTourStyleCode("adventure"), "grand-expeditions");
  assert.equal(normalizeTourStyleCode("Grand Expeditions"), "grand-expeditions");
  assert.equal(normalizeTourStyleCode("Food"), "gastronomic-experiences");
  assert.equal(normalizeTourStyleCode("food"), "gastronomic-experiences");
  assert.equal(normalizeTourStyleCode("Gastronomic Experiences"), "gastronomic-experiences");
  assert.equal(normalizeTourStyleCode("Spa"), "wellness");
  assert.equal(getTourStyleLabel("grand-expeditions", "en"), "Grand Expeditions");
  assert.equal(getTourStyleLabel("gastronomic-experiences", "en"), "Gastronomic Experiences");
  assert.equal(getTourStyleLabel("wellness", "de"), "Wellness");
  assert.deepEqual(
    normalizeTourStyleLabels(["Adventure", "Food", "Adventure"], "en"),
    ["Grand Expeditions", "Gastronomic Experiences"]
  );
});
