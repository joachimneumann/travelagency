import * as fontkit from "fontkit";

const FONT_FACE_CACHE = new Map();

function openFontFace(fontPath) {
  const normalizedPath = String(fontPath || "").trim();
  if (!normalizedPath) return null;
  if (FONT_FACE_CACHE.has(normalizedPath)) return FONT_FACE_CACHE.get(normalizedPath);
  let face = null;
  try {
    const opened = fontkit.openSync(normalizedPath);
    face = Array.isArray(opened?.fonts) && opened.fonts.length ? opened.fonts[0] : opened;
  } catch {
    face = null;
  }
  FONT_FACE_CACHE.set(normalizedPath, face);
  return face;
}

function normalizeChoices(fontChoices = []) {
  const seen = new Set();
  const normalized = [];
  for (const choice of fontChoices) {
    const name = String(choice?.name || "").trim();
    const path = String(choice?.path || "").trim();
    if (!name || !path) continue;
    const key = `${name}::${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ name, path });
  }
  return normalized;
}

function supportsChar(choice, char) {
  if (!choice) return false;
  if (!char || !char.trim()) return true;
  const face = openFontFace(choice.path);
  if (!face?.hasGlyphForCodePoint) return false;
  return face.hasGlyphForCodePoint(char.codePointAt(0));
}

function resolveChoiceForChar(char, choices, currentChoice = null) {
  if (!char || !char.trim()) return currentChoice || choices[0] || null;
  if (currentChoice && supportsChar(currentChoice, char)) return currentChoice;
  return choices.find((choice) => supportsChar(choice, char)) || currentChoice || choices[0] || null;
}

function lineHeightForChoices(doc, choices, fontSize, lineGap) {
  let height = fontSize;
  for (const choice of choices) {
    doc.font(choice.name).fontSize(fontSize);
    height = Math.max(height, doc.currentLineHeight(true));
  }
  return height + Number(lineGap || 0);
}

function layoutText(doc, text, { width = 0, fontSize = 12, lineGap = 0, fontChoices = [] } = {}) {
  const choices = normalizeChoices(fontChoices);
  if (!choices.length) return { segments: [], height: 0 };
  const maxWidth = Number(width || 0);
  const content = String(text || "");
  const lineHeight = lineHeightForChoices(doc, choices, fontSize, lineGap);
  const segments = [];

  let lineIndex = 0;
  let cursorX = 0;
  let cursorY = 0;
  let currentChoice = choices[0];

  const nextLine = () => {
    lineIndex += 1;
    cursorX = 0;
    cursorY += lineHeight;
  };

  for (const char of Array.from(content)) {
    if (char === "\r") continue;
    if (char === "\n") {
      nextLine();
      continue;
    }

    const choice = resolveChoiceForChar(char, choices, currentChoice);
    if (!choice) continue;
    currentChoice = choice;
    doc.font(choice.name).fontSize(fontSize);
    const charWidth = doc.widthOfString(char);

    if (maxWidth > 0 && cursorX > 0 && cursorX + charWidth > maxWidth && !/\s/.test(char)) {
      nextLine();
    }
    if (maxWidth > 0 && cursorX === 0 && /\s/.test(char)) {
      continue;
    }

    const last = segments[segments.length - 1];
    if (
      last
      && last.lineIndex === lineIndex
      && last.fontName === choice.name
      && last.y === cursorY
      && Math.abs((last.x + last.width) - cursorX) < 0.001
    ) {
      last.text += char;
      last.width += charWidth;
    } else {
      segments.push({
        lineIndex,
        fontName: choice.name,
        text: char,
        x: cursorX,
        y: cursorY,
        width: charWidth
      });
    }
    cursorX += charWidth;
  }

  return {
    segments,
    height: segments.length ? (cursorY + lineHeight) : lineHeight
  };
}

export function measureMultifontTextHeight(doc, text, options = {}) {
  return layoutText(doc, text, options).height;
}

export function drawMultifontText(doc, text, x, y, {
  width = 0,
  fontSize = 12,
  lineGap = 0,
  fontChoices = [],
  fillColor = null
} = {}) {
  const { segments, height } = layoutText(doc, text, {
    width,
    fontSize,
    lineGap,
    fontChoices
  });
  for (const segment of segments) {
    doc.font(segment.fontName).fontSize(fontSize);
    if (fillColor) doc.fillColor(fillColor);
    doc.text(segment.text, x + segment.x, y + segment.y, { lineBreak: false });
  }
  return y + height;
}
