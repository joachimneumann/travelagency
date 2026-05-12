import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveTourExperienceHighlightIds,
  normalizeExperienceHighlightIds,
  selectTourExperienceHighlightIds
} from "../src/domain/tour_metadata.js";

test("normalizeExperienceHighlightIds removes blanks and duplicates", () => {
  assert.deepEqual(
    normalizeExperienceHighlightIds(["iconic_landmarks", "", "iconic_landmarks", "local_experiences"]),
    ["iconic_landmarks", "local_experiences"]
  );
});

test("deriveTourExperienceHighlightIds returns the four most frequent single day highlights", () => {
  const catalog = [
    { id: "iconic_landmarks" },
    { id: "cultural_heritage" },
    { id: "local_experiences" },
    { id: "delicious_cuisine" },
    { id: "beaches" }
  ];
  const travelPlan = {
    days: [
      { experience_highlight_ids: ["cultural_heritage"] },
      { experience_highlight_ids: ["local_experiences"] },
      { experience_highlight_ids: ["cultural_heritage"] },
      { experience_highlight_ids: ["iconic_landmarks"] },
      { experience_highlight_ids: ["delicious_cuisine"] },
      { experience_highlight_ids: ["iconic_landmarks"] },
      { experience_highlight_ids: ["beaches"] }
    ]
  };

  assert.deepEqual(
    deriveTourExperienceHighlightIds(travelPlan, catalog),
    ["iconic_landmarks", "cultural_heritage", "local_experiences", "delicious_cuisine"]
  );
});

test("selectTourExperienceHighlightIds fills missing day highlights from deterministic fallback ids", () => {
  const catalog = [
    { id: "iconic_landmarks" },
    { id: "local_experiences" },
    { id: "delicious_cuisine" },
    { id: "family_friendly_activities" },
    { id: "shopping_souvenirs" }
  ];
  const travelPlan = {
    days: [
      { experience_highlight_ids: ["iconic_landmarks"] },
      { experience_highlight_ids: ["iconic_landmarks"] }
    ]
  };

  const selected = selectTourExperienceHighlightIds(travelPlan, catalog, { seed: "tour_alpha:en" });

  assert.equal(selected[0], "iconic_landmarks");
  assert.equal(selected.length, 4);
  assert.equal(new Set(selected).size, 4);
  assert.ok(selected.slice(1).every((id) => [
    "local_experiences",
    "delicious_cuisine",
    "family_friendly_activities",
    "shopping_souvenirs"
  ].includes(id)));
});
