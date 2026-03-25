import { access } from "node:fs/promises";
import PDFDocument from "pdfkit";
import * as fontkit from "fontkit";

const LANGUAGE_FONT_PROBES = Object.freeze({
  ar: "العربية",
  ja: "日本語",
  ko: "한글",
  vi: "Tiếng Việt",
  zh: "中文"
});

function isSupportedPdfFontContainer(filePath) {
  const normalized = String(filePath || "").trim().toLowerCase();
  if (!normalized) return false;
  // PDFKit/fontkit behave inconsistently with TrueType Collections and can
  // either fail at subset generation or emit mojibake for CJK text.
  return !normalized.endsWith(".ttc");
}

async function fileExists(filePath) {
  if (!filePath) return false;
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function canRegisterPdfFont(candidate) {
  try {
    const probe = new PDFDocument({ autoFirstPage: false });
    probe.registerFont("__probe__", candidate);
    probe.font("__probe__").fontSize(12);
    return true;
  } catch {
    return false;
  }
}

function openFontFace(candidate) {
  try {
    const opened = fontkit.openSync(candidate);
    if (Array.isArray(opened?.fonts) && opened.fonts.length) {
      return opened.fonts[0];
    }
    return opened;
  } catch {
    return null;
  }
}

function fontSupportsText(candidate, sampleText = "") {
  if (!sampleText) return true;
  const face = openFontFace(candidate);
  if (!face?.hasGlyphForCodePoint) return false;
  return Array.from(sampleText).every((char) => {
    if (!char.trim()) return true;
    return face.hasGlyphForCodePoint(char.codePointAt(0));
  });
}

async function findFirstUsablePath(paths, sampleText = "") {
  for (const candidate of paths) {
    if (!isSupportedPdfFontContainer(candidate)) continue;
    if (!(await fileExists(candidate))) continue;
    if (!canRegisterPdfFont(candidate)) continue;
    if (!fontSupportsText(candidate, sampleText)) continue;
    return candidate;
  }
  return null;
}

export async function resolvePdfFontsForLang({
  lang = "en",
  regularCandidates = [],
  boldCandidates = []
} = {}) {
  const sampleText = LANGUAGE_FONT_PROBES[String(lang || "").trim().toLowerCase()] || "";
  const regular = await findFirstUsablePath(regularCandidates, sampleText);
  const bold = (await findFirstUsablePath(boldCandidates, sampleText)) || regular;
  return { regular, bold };
}
