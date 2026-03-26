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

const LANGUAGE_FONT_PRIORITY_MARKERS = Object.freeze({
  ja: ["notosanscjkjp-"],
  ko: ["notosanscjkkr-"],
  zh: ["notosanscjksc-"]
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

function prioritizeCandidatesForLang(paths = [], lang = "en") {
  const priorityMarkers = LANGUAGE_FONT_PRIORITY_MARKERS[String(lang || "").trim().toLowerCase()] || [];
  if (!priorityMarkers.length) return Array.isArray(paths) ? paths : [];
  const ranked = Array.isArray(paths) ? [...paths] : [];
  ranked.sort((left, right) => {
    const leftPath = String(left || "").trim().toLowerCase();
    const rightPath = String(right || "").trim().toLowerCase();
    const leftRank = priorityMarkers.findIndex((marker) => leftPath.includes(marker));
    const rightRank = priorityMarkers.findIndex((marker) => rightPath.includes(marker));
    const normalizedLeftRank = leftRank >= 0 ? leftRank : Number.MAX_SAFE_INTEGER;
    const normalizedRightRank = rightRank >= 0 ? rightRank : Number.MAX_SAFE_INTEGER;
    return normalizedLeftRank - normalizedRightRank;
  });
  return ranked;
}

export async function resolvePdfFontsForLang({
  lang = "en",
  sampleText = "",
  regularCandidates = [],
  boldCandidates = []
} = {}) {
  const combinedSampleText = `${LANGUAGE_FONT_PROBES[String(lang || "").trim().toLowerCase()] || ""} ${String(sampleText || "").trim()}`.trim();
  const regular = await findFirstUsablePath(prioritizeCandidatesForLang(regularCandidates, lang), combinedSampleText);
  const bold = (await findFirstUsablePath(prioritizeCandidatesForLang(boldCandidates, lang), combinedSampleText)) || regular;
  return { regular, bold };
}
