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

function tokenizeContent(content) {
  const tokens = [];
  let buffer = "";
  let bufferType = "";

  const flushBuffer = () => {
    if (!buffer) return;
    tokens.push({ type: bufferType, value: buffer });
    buffer = "";
  };

  for (const char of Array.from(String(content || ""))) {
    if (char === "\r") continue;
    if (char === "\n") {
      flushBuffer();
      tokens.push({ type: "newline", value: "\n" });
      bufferType = "";
      continue;
    }
    const nextType = /\s/.test(char) ? "space" : "word";
    if (bufferType && bufferType !== nextType) flushBuffer();
    bufferType = nextType;
    buffer += char;
  }

  flushBuffer();
  return tokens;
}

function measureTokenWidth(doc, token, currentChoice, choices, fontSize) {
  let width = 0;
  let choice = currentChoice || choices[0] || null;

  for (const char of Array.from(String(token || ""))) {
    choice = resolveChoiceForChar(char, choices, choice);
    if (!choice) continue;
    doc.font(choice.name).fontSize(fontSize);
    width += doc.widthOfString(char);
  }

  return { width, choice };
}

function layoutText(doc, text, { width = 0, fontSize = 12, lineGap = 0, fontChoices = [] } = {}) {
  const choices = normalizeChoices(fontChoices);
  if (!choices.length) return { segments: [], height: 0 };
  const maxWidth = Number(width || 0);
  const content = String(text || "");
  const tokens = tokenizeContent(content);
  const lineHeight = lineHeightForChoices(doc, choices, fontSize, lineGap);
  const segments = [];

  let lineIndex = 0;
  let cursorX = 0;
  let cursorY = 0;
  let currentChoice = choices[0];
  let sawContent = false;

  const nextLine = () => {
    lineIndex += 1;
    cursorX = 0;
    cursorY += lineHeight;
  };

  const appendChar = (char) => {
    const choice = resolveChoiceForChar(char, choices, currentChoice);
    if (!choice) return;
    currentChoice = choice;
    doc.font(choice.name).fontSize(fontSize);
    const charWidth = doc.widthOfString(char);

    if (maxWidth > 0 && cursorX > 0 && cursorX + charWidth > maxWidth && !/\s/.test(char)) {
      nextLine();
    }
    if (maxWidth > 0 && cursorX === 0 && /\s/.test(char)) {
      return;
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
    sawContent = true;
  };

  for (const token of tokens) {
    if (token.type === "newline") {
      sawContent = true;
      nextLine();
      continue;
    }

    if (token.type === "space") {
      if (cursorX === 0) continue;
      const { width: tokenWidth } = measureTokenWidth(doc, token.value, currentChoice, choices, fontSize);
      if (maxWidth > 0 && cursorX + tokenWidth > maxWidth) {
        nextLine();
        continue;
      }
      for (const char of Array.from(token.value)) appendChar(char);
      continue;
    }

    const { width: tokenWidth } = measureTokenWidth(doc, token.value, currentChoice, choices, fontSize);
    if (maxWidth > 0 && cursorX > 0 && cursorX + tokenWidth > maxWidth) {
      nextLine();
    }
    if (maxWidth > 0 && tokenWidth > maxWidth) {
      for (const char of Array.from(token.value)) appendChar(char);
      continue;
    }
    for (const char of Array.from(token.value)) appendChar(char);
  }

  return {
    segments,
    height: sawContent ? (cursorY + lineHeight) : lineHeight
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
