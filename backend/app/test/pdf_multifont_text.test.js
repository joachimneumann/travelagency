import test from "node:test";
import assert from "node:assert/strict";
import { resolveAtpStaffShortDescriptionText } from "../src/lib/atp_staff_directory.js";
import { drawMultifontText } from "../src/lib/pdf_multifont_text.js";

class FakePdfDoc {
  constructor() {
    this.calls = [];
    this.currentFontName = "TestFont";
    this.currentFontSizeValue = 12;
  }

  font(name) {
    this.currentFontName = name;
    return this;
  }

  fontSize(value) {
    this.currentFontSizeValue = value;
    return this;
  }

  widthOfString(text) {
    return Array.from(String(text || "")).length * 10;
  }

  currentLineHeight() {
    return this.currentFontSizeValue;
  }

  fillColor() {
    return this;
  }

  text(text, x, y, options = {}) {
    this.calls.push({
      text,
      x,
      y,
      options,
      fontName: this.currentFontName,
      fontSize: this.currentFontSizeValue
    });
    return this;
  }
}

test("drawMultifontText keeps whole words together when the next word does not fit the remaining width", () => {
  const doc = new FakePdfDoc();

  drawMultifontText(doc, "go travel", 0, 0, {
    width: 70,
    fontSize: 12,
    fontChoices: [{ name: "TestFont", path: "/tmp/test-font.ttf" }]
  });

  assert.deepEqual(doc.calls.map((call) => call.text), ["go ", "travel"]);
  assert.equal(doc.calls[0].y, 0);
  assert.equal(doc.calls[1].y, 12);
});

test("ATP staff short descriptions convert escaped newline sequences into real line breaks", () => {
  const description = resolveAtpStaffShortDescriptionText({
    short_description: {
      en: "First paragraph.\\n\\nSecond paragraph."
    }
  }, "en");

  assert.equal(description, "First paragraph.\n\nSecond paragraph.");
});
