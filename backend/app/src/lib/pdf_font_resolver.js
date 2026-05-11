import { access } from "node:fs/promises";
import { createHash } from "node:crypto";
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
  ja: ["notosanscjkjp-", "notoserifcjkjp-"],
  ko: ["notosanscjkkr-", "notoserifcjkkr-"],
  zh: ["notosanscjksc-", "notoserifcjksc-", "notoserifcjktc-"]
});

const PDF_SUPPORTED_FONT_EXTENSIONS = Object.freeze([".ttf", ".otf"]);
const fileExistsCache = new Map();
const registerableFontCache = new Map();
const fontFaceCache = new Map();
const fontSupportCache = new Map();
const resolvedFontCache = new Map();
const resolvedFontInflight = new Map();

function isSupportedPdfFontContainer(filePath) {
  const normalized = String(filePath || "").trim().toLowerCase();
  if (!normalized) return false;
  // PDFKit/fontkit behave inconsistently with TTC and WOFF2 in generated PDFs.
  // Restrict runtime font selection to containers that embed reliably.
  return PDF_SUPPORTED_FONT_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

async function fileExists(filePath) {
  if (!filePath) return false;
  if (fileExistsCache.has(filePath)) return fileExistsCache.get(filePath);
  try {
    await access(filePath);
    fileExistsCache.set(filePath, true);
    return true;
  } catch {
    fileExistsCache.set(filePath, false);
    return false;
  }
}

function canRegisterPdfFont(candidate) {
  if (registerableFontCache.has(candidate)) return registerableFontCache.get(candidate);
  try {
    const probe = new PDFDocument({ autoFirstPage: false });
    probe.on("data", () => {});
    probe.on("error", () => {});
    probe.addPage({ size: [80, 40], margin: 0 });
    probe.registerFont("__probe__", candidate);
    probe.font("__probe__").fontSize(12).text("PDF", 4, 4);
    probe.end();
    registerableFontCache.set(candidate, true);
    return true;
  } catch {
    registerableFontCache.set(candidate, false);
    return false;
  }
}

function openFontFace(candidate) {
  if (fontFaceCache.has(candidate)) return fontFaceCache.get(candidate);
  try {
    const opened = fontkit.openSync(candidate);
    if (Array.isArray(opened?.fonts) && opened.fonts.length) {
      fontFaceCache.set(candidate, opened.fonts[0]);
      return opened.fonts[0];
    }
    fontFaceCache.set(candidate, opened);
    return opened;
  } catch {
    fontFaceCache.set(candidate, null);
    return null;
  }
}

function sampleTextFingerprint(sampleText = "") {
  const chars = Array.from(new Set(Array.from(String(sampleText || "")).filter((char) => char.trim()))).sort().join("");
  return createHash("sha1").update(chars).digest("hex");
}

function fontSupportsText(candidate, sampleText = "") {
  if (!sampleText) return true;
  const cacheKey = `${candidate}|${sampleTextFingerprint(sampleText)}`;
  if (fontSupportCache.has(cacheKey)) return fontSupportCache.get(cacheKey);
  const face = openFontFace(candidate);
  if (!face?.hasGlyphForCodePoint) {
    fontSupportCache.set(cacheKey, false);
    return false;
  }
  const supported = Array.from(sampleText).every((char) => {
    if (!char.trim()) return true;
    return face.hasGlyphForCodePoint(char.codePointAt(0));
  });
  fontSupportCache.set(cacheKey, supported);
  return supported;
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
  const prioritizedRegularCandidates = prioritizeCandidatesForLang(regularCandidates, lang);
  const prioritizedBoldCandidates = prioritizeCandidatesForLang(boldCandidates, lang);
  const cacheKey = [
    String(lang || "").trim().toLowerCase(),
    sampleTextFingerprint(combinedSampleText),
    prioritizedRegularCandidates.join("\u0000"),
    prioritizedBoldCandidates.join("\u0000")
  ].join("\u0001");
  if (resolvedFontCache.has(cacheKey)) return { ...resolvedFontCache.get(cacheKey) };
  if (resolvedFontInflight.has(cacheKey)) return { ...(await resolvedFontInflight.get(cacheKey)) };
  const promise = (async () => {
    const regular = await findFirstUsablePath(prioritizedRegularCandidates, combinedSampleText);
    const bold = (await findFirstUsablePath(prioritizedBoldCandidates, combinedSampleText)) || regular;
    const result = { regular, bold };
    resolvedFontCache.set(cacheKey, result);
    return result;
  })().finally(() => {
    resolvedFontInflight.delete(cacheKey);
  });
  resolvedFontInflight.set(cacheKey, promise);
  return { ...(await promise) };
}
