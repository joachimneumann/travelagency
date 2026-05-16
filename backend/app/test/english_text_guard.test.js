import test from "node:test";
import assert from "node:assert/strict";

import { isLikelyVietnameseText } from "../../../frontend/scripts/shared/english_text_guard.js";

test("English text guard detects likely Vietnamese sentences", () => {
  assert.equal(
    isLikelyVietnameseText("Khách sạn này rất đẹp và gần trung tâm."),
    true
  );
  assert.equal(
    isLikelyVietnameseText("Buoi sang tham quan pho co, an trua tai nha hang dia phuong."),
    true
  );
});

test("English text guard allows English copy with Vietnamese place names", () => {
  assert.equal(
    isLikelyVietnameseText("Visit Hội An and Đà Nẵng before returning to the hotel."),
    false
  );
  assert.equal(
    isLikelyVietnameseText("Airport transfer and hotel check-in."),
    false
  );
});

