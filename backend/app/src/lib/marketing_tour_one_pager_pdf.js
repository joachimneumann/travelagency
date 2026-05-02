import { createWriteStream } from "node:fs";
import { access, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { normalizeText } from "./text.js";
import { styleToken } from "./style_tokens.js";
import { pdfTextOptions, normalizePdfLang, pdfT } from "./pdf_i18n.js";
import { resolvePdfFontsForLang } from "./pdf_font_resolver.js";

const MM_TO_POINTS = 72 / 25.4;
// PDFKit's built-in "A4" preset rounds the page box and some viewers display it as
// 21.01 x 29.71 cm. Use the exact A4 dimensions in points instead.
const PAGE_SIZE = Object.freeze([210 * MM_TO_POINTS, 297 * MM_TO_POINTS]);
const [PAGE_WIDTH, PAGE_HEIGHT] = PAGE_SIZE;
const LETTER_DESIGN_HEIGHT = 792;
const A4_VERTICAL_EXTENSION = PAGE_HEIGHT - LETTER_DESIGN_HEIGHT;
const FOOTER_HEIGHT = 45;
const PDF_FONT_REGULAR = "MarketingTourOnePagerRegular";
const PDF_FONT_BOLD = "MarketingTourOnePagerBold";
const PDF_FONT_DISPLAY = "MarketingTourOnePagerDisplay";
const PDF_FONT_SCRIPT = "MarketingTourOnePagerScript";
const PDF_FONT_LABEL = "MarketingTourOnePagerLabel";
const PDF_FONT_TRIP_LABEL = "MarketingTourOnePagerTripLabel";
const IMAGE_RENDER_SCALE = 2.4;
const PUBLIC_TOUR_IMAGE_PREFIX = "/public/v1/tour-images/";
const ONE_PAGER_EXPERIENCE_HIGHLIGHT_LIMIT = 4;
const EXPERIENCE_HIGHLIGHT_RENDER_SCALE = 3;
const PDF_PRIMARY_GREEN = "#30796B";
const PDF_SECONDARY_GREEN = "#e4ecdf";
const PDF_BACKGROUND_CREAM = "#FFF8EC";
const PDF_TRIP_LABEL_ORANGE = "#F27A1A";
const PDF_BUS_IMAGE_FILENAME = "bus.png";
const PDF_BUS_IMAGE_WIDTH = 236;
const PDF_BUS_IMAGE_HEIGHT = 110;
const PDF_PIN_IMAGE_FILENAME = "pin.png";
const PDF_PIN_IMAGE_WIDTH = 100;
const PDF_PIN_IMAGE_HEIGHT = 135;
const BODY_IMAGE_LIMIT = 4;
const BODY_IMAGE_RENDER_FRAME = Object.freeze({ width: 248, height: 174 });
const PHOTO_LABEL_BACKDROP_COLOR = "#000000";
const PHOTO_LABEL_BACKDROP_OPACITY = 0.34;
const PHOTO_LABEL_BRIGHTNESS_THRESHOLD = 118;
const BODY_IMAGE_LAYOUT_BOUNDS = Object.freeze({
  minX: 302,
  minY: 246,
  maxX: 570,
  maxY: 626
});
const HERO_BACKGROUND_IMAGE = Object.freeze({
  x: 118,
  y: 54,
  width: 466,
  height: 274
});

const PDF_FONT_REGULAR_CANDIDATES = Object.freeze([
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/Library/Fonts/Arial Unicode.ttf",
  "/usr/local/share/fonts/extracted/NotoSansCJKjp-Regular.ttf",
  "/usr/local/share/fonts/extracted/NotoSansCJKsc-Regular.ttf",
  "/usr/local/share/fonts/extracted/NotoSansCJKkr-Regular.ttf",
  "/usr/share/fonts/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/TTF/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf"
]);

const PDF_FONT_BOLD_CANDIDATES = Object.freeze([
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/Library/Fonts/Arial Unicode.ttf",
  "/usr/local/share/fonts/extracted/NotoSansCJKjp-Bold.ttf",
  "/usr/local/share/fonts/extracted/NotoSansCJKsc-Bold.ttf",
  "/usr/local/share/fonts/extracted/NotoSansCJKkr-Bold.ttf",
  "/usr/share/fonts/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/opentype/noto/NotoSans-Bold.ttf"
]);

const PDF_FONT_DISPLAY_CANDIDATES = Object.freeze([
  "/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf",
  "/System/Library/Fonts/Supplemental/Impact.ttf",
  "/usr/share/fonts/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/noto/NotoSansCondensed-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf",
  "/usr/share/fonts/dejavu/DejaVuSansCondensed-Bold.ttf",
  "/usr/share/fonts/TTF/DejaVuSansCondensed-Bold.ttf"
]);

const PDF_FONT_SCRIPT_CANDIDATES = Object.freeze([
  "/System/Library/Fonts/Supplemental/Brush Script.ttf",
  "/System/Library/Fonts/Supplemental/Zapfino.ttf",
  "/usr/share/fonts/noto/NotoSans-Italic.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Oblique.ttf",
  "/usr/share/fonts/TTF/DejaVuSans-Oblique.ttf"
]);

const PDF_FONT_TRIP_LABEL_CANDIDATES = Object.freeze([
  "/System/Library/Fonts/Supplemental/Brush Script.ttf",
  "/System/Library/Fonts/Supplemental/Zapfino.ttf",
  "/usr/share/fonts/noto/NotoSans-Italic.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Oblique.ttf",
  "/usr/share/fonts/TTF/DejaVuSans-Oblique.ttf"
]);

const PDF_FONT_LABEL_CANDIDATES = Object.freeze([
  "/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf",
  "/System/Library/Fonts/Supplemental/Impact.ttf",
  "/usr/share/fonts/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/noto/NotoSansCondensed-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf",
  "/usr/share/fonts/dejavu/DejaVuSansCondensed-Bold.ttf",
  "/usr/share/fonts/TTF/DejaVuSansCondensed-Bold.ttf"
]);

const PDF_ASSET_DISPLAY_FONT_FILES = Object.freeze([
  "montserrat-v31-vietnamese.woff2",
  "montserrat-v31-latin-ext.woff2",
  "montserrat-v31-latin.woff2"
]);

const PDF_ASSET_SCRIPT_FONT_FILES = Object.freeze([
  "source-sans-3-v19-italic-vietnamese.woff2",
  "source-sans-3-v19-italic-latin-ext.woff2",
  "source-sans-3-v19-italic-latin.woff2"
]);

const PDF_EMBEDDABLE_FONT_EXTENSIONS = Object.freeze([".ttf", ".otf"]);
const ONE_PAGER_DECORATIVE_FONT_LANGS = Object.freeze(new Set([
  "en",
  "fr",
  "de",
  "es",
  "it",
  "nl",
  "pl",
  "da",
  "sv",
  "no",
  "vi",
  "ms"
]));

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function textOrNull(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function localizedMapValue(value, lang, fallback = "") {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const normalizedLang = normalizePdfLang(lang);
  return normalizeText(source[normalizedLang])
    || normalizeText(source.en)
    || normalizeText(fallback);
}

function cssColorToHex(value, fallback) {
  const raw = normalizeText(value);
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(raw)) return raw;
  const rgbMatch = raw.match(/rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i);
  if (!rgbMatch) return fallback;
  const toHex = (part) => Math.max(0, Math.min(255, Math.round(Number(part) || 0)))
    .toString(16)
    .padStart(2, "0");
  return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
}

const COLORS = Object.freeze({
  surface: PDF_BACKGROUND_CREAM,
  surfaceMuted: PDF_SECONDARY_GREEN,
  surfaceSubtle: PDF_BACKGROUND_CREAM,
  accent: PDF_PRIMARY_GREEN,
  accentSoft: PDF_SECONDARY_GREEN,
  accentText: PDF_PRIMARY_GREEN,
  secondary: PDF_SECONDARY_GREEN,
  text: cssColorToHex(styleToken("text"), "#1e2f3a"),
  textStrong: cssColorToHex(styleToken("text-strong"), "#152536"),
  textMuted: cssColorToHex(styleToken("muted"), "#5f7078"),
  line: PDF_SECONDARY_GREEN,
  white: "#ffffff",
  cta: PDF_PRIMARY_GREEN,
  ctaText: PDF_BACKGROUND_CREAM,
  ctaButton: PDF_BACKGROUND_CREAM,
  ctaButtonText: PDF_PRIMARY_GREEN,
  ctaBorder: PDF_SECONDARY_GREEN
});

function pdfFontName(weight = "regular", fonts = null) {
  if (weight === "display" && fonts?.display) return PDF_FONT_DISPLAY;
  if (weight === "script" && fonts?.script) return PDF_FONT_SCRIPT;
  if (weight === "label" && fonts?.label) return PDF_FONT_LABEL;
  if (weight === "tripLabel" && fonts?.tripLabel) return PDF_FONT_TRIP_LABEL;
  if ((weight === "display" || weight === "label") && fonts?.bold) return PDF_FONT_BOLD;
  if (weight === "bold" && fonts?.bold) return PDF_FONT_BOLD;
  if (fonts?.regular) return PDF_FONT_REGULAR;
  return weight === "bold" ? "Helvetica-Bold" : "Helvetica";
}

function onePagerT(lang, key, fallback, vars) {
  return pdfT(lang, `one_pager.${key}`, fallback, vars);
}

function onePagerCountLabel(lang, count, oneKey, otherKey, oneFallback, otherFallback) {
  return onePagerT(lang, count === 1 ? oneKey : otherKey, count === 1 ? oneFallback : otherFallback, {
    count: String(count)
  });
}

function shouldUseOnePagerDecorativeFonts(lang) {
  return ONE_PAGER_DECORATIVE_FONT_LANGS.has(normalizePdfLang(lang));
}

function registerPdfFonts(doc, fonts) {
  if (fonts?.regular) doc.registerFont(PDF_FONT_REGULAR, fonts.regular);
  if (fonts?.bold) doc.registerFont(PDF_FONT_BOLD, fonts.bold);
  if (fonts?.display) doc.registerFont(PDF_FONT_DISPLAY, fonts.display);
  if (fonts?.script) doc.registerFont(PDF_FONT_SCRIPT, fonts.script);
  if (fonts?.label) doc.registerFont(PDF_FONT_LABEL, fonts.label);
  if (fonts?.tripLabel) doc.registerFont(PDF_FONT_TRIP_LABEL, fonts.tripLabel);
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

async function firstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (!isPdfEmbeddableFontPath(candidate)) continue;
    if (await fileExists(candidate)) return candidate;
  }
  return "";
}

function isPdfEmbeddableFontPath(filePath) {
  const normalized = normalizeText(filePath).toLowerCase();
  return PDF_EMBEDDABLE_FONT_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

function assetFontCandidatesFromLogoPath(logoPath, fileNames) {
  const normalizedLogoPath = normalizeText(logoPath);
  if (!normalizedLogoPath) return [];
  const assetsDir = path.resolve(path.dirname(normalizedLogoPath), "..");
  return fileNames
    .map((fileName) => path.join(assetsDir, "fonts", fileName))
    .filter(isPdfEmbeddableFontPath);
}

function prioritizeAssetFonts(staticCandidates, assetCandidates) {
  const systemCandidates = staticCandidates.filter((candidate) => candidate.startsWith("/System/") || candidate.startsWith("/Library/"));
  const portableCandidates = staticCandidates.filter((candidate) => !systemCandidates.includes(candidate));
  return [...systemCandidates, ...assetCandidates, ...portableCandidates];
}

async function resolveOnePagerDisplayFonts(logoPath) {
  const assetDisplayCandidates = assetFontCandidatesFromLogoPath(logoPath, PDF_ASSET_DISPLAY_FONT_FILES);
  const assetScriptCandidates = assetFontCandidatesFromLogoPath(logoPath, PDF_ASSET_SCRIPT_FONT_FILES);
  const [display, script, label, tripLabel] = await Promise.all([
    firstExistingPath(prioritizeAssetFonts(PDF_FONT_DISPLAY_CANDIDATES, assetDisplayCandidates)),
    firstExistingPath(prioritizeAssetFonts(PDF_FONT_SCRIPT_CANDIDATES, assetScriptCandidates)),
    firstExistingPath(prioritizeAssetFonts(PDF_FONT_LABEL_CANDIDATES, assetDisplayCandidates)),
    firstExistingPath(prioritizeAssetFonts(PDF_FONT_TRIP_LABEL_CANDIDATES, assetScriptCandidates))
  ]);
  return { display, script, label, tripLabel };
}

function streamPdfToFile(doc, outputPath) {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(outputPath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);
    doc.pipe(stream);
    doc.end();
  });
}

async function removePartialPdf(outputPath) {
  if (!outputPath) return;
  await rm(outputPath, { force: true }).catch(() => {});
}

function isFontkitDataViewBoundsError(error) {
  return /Offset is outside the bounds of the DataView/i.test(String(error?.message || error || ""));
}

function drawPolygonPath(doc, points) {
  points.forEach(([x, y], index) => {
    if (index === 0) doc.moveTo(x, y);
    else doc.lineTo(x, y);
  });
  doc.closePath();
}

function polygonPointsFromRelative(x, y, width, height, relativePoints) {
  return relativePoints.map(([relativeX, relativeY]) => [
    x + width * relativeX,
    y + height * relativeY
  ]);
}

function drawSoftRect(doc, x, y, width, height, color, radius = 0) {
  doc.save();
  if (radius > 0) doc.roundedRect(x, y, width, height, radius).fill(color);
  else doc.rect(x, y, width, height).fill(color);
  doc.restore();
}

function drawCheckIcon(doc, x, y, size, color) {
  doc.save();
  doc.circle(x + size / 2, y + size / 2, size / 2).lineWidth(0.9).strokeColor(color).stroke();
  doc
    .moveTo(x + size * 0.29, y + size * 0.52)
    .lineTo(x + size * 0.44, y + size * 0.67)
    .lineTo(x + size * 0.72, y + size * 0.35)
    .lineWidth(1.15)
    .lineCap("round")
    .lineJoin("round")
    .strokeColor(color)
    .stroke();
  doc.restore();
}

function drawPinIcon(doc, pinImagePath, tipX, tipY, height) {
  const normalizedImagePath = normalizeText(pinImagePath);
  if (!normalizedImagePath) return;
  const width = height * (PDF_PIN_IMAGE_WIDTH / PDF_PIN_IMAGE_HEIGHT);
  doc.image(normalizedImagePath, tipX - width / 2, tipY - height, {
    width,
    height
  });
}

function drawBusIcon(doc, busImagePath, centerX, wheelBaselineY, width) {
  const normalizedImagePath = normalizeText(busImagePath);
  if (!normalizedImagePath) return;
  const height = width * (PDF_BUS_IMAGE_HEIGHT / PDF_BUS_IMAGE_WIDTH);
  doc.image(normalizedImagePath, centerX - width / 2, wheelBaselineY - height, {
    width,
    height
  });
}

function drawDashedCurve(doc, points, color) {
  doc.save();
  doc.lineWidth(1.25).strokeColor(color).lineCap("round").lineJoin("round").dash(5, { space: 5 });
  for (let index = 0; index < points.length - 3; index += 3) {
    const segment = points.slice(index, index + 4);
    doc
      .moveTo(segment[0][0], segment[0][1])
      .bezierCurveTo(segment[1][0], segment[1][1], segment[2][0], segment[2][1], segment[3][0], segment[3][1])
      .stroke();
  }
  doc.restore();
}

function drawRouteConnector(doc, x, y, width, { busImagePath = "", pinImagePath = "" } = {}) {
  const color = COLORS.accentText;
  drawPinIcon(doc, pinImagePath, x + 17, y + 18, 24);
  drawDashedCurve(doc, [
    [x + 31, y + 18],
    [x + 70, y + 29],
    [x + 91, y + 18],
    [x + 125, y + 18],
    [x + 159, y + 18],
    [x + width - 82, y + 14],
    [x + width - 28, y + 40]
  ], color);
  drawBusIcon(doc, busImagePath, x + 125, y + 18, 44);
}

function drawHighlightIcon(doc, index, x, y, size, color) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  doc.save();
  doc.lineWidth(1).strokeColor(color).lineCap("round").lineJoin("round");
  if (index === 0) {
    doc.roundedRect(x + 4, y + 12, size - 8, size - 17, 2).stroke();
    doc.rect(x + 8, y + 8, 11, 6).stroke();
    doc.circle(cx, cy + 3, 8).stroke();
    doc.circle(cx, cy + 3, 3).stroke();
  } else if (index === 1) {
    doc.ellipse(cx, cy + 2, 9, 15).stroke();
    doc.moveTo(cx, y + 6).lineTo(cx, y + size - 7).stroke();
    doc.moveTo(cx - 11, y + 14).lineTo(cx + 11, y + 14).stroke();
    doc.moveTo(cx - 11, y + size - 12).lineTo(cx + 11, y + size - 12).stroke();
  } else if (index === 2) {
    doc.moveTo(x + 6, y + 21).lineTo(x + size - 6, y + 21).lineTo(x + size - 14, y + 31).lineTo(x + 14, y + 31).closePath().stroke();
    doc.moveTo(cx, y + 6).lineTo(cx, y + 21).stroke();
    doc.moveTo(cx, y + 8).lineTo(x + size - 10, y + 18).lineTo(cx, y + 18).closePath().stroke();
    doc.moveTo(x + 8, y + 36).lineTo(x + 22, y + 34).lineTo(x + 36, y + 36).stroke();
  } else {
    doc.moveTo(x + 8, y + 18).lineTo(x + size - 8, y + 18).stroke();
    doc.moveTo(x + 11, y + 18).lineTo(x + 17, y + 34).lineTo(x + size - 17, y + 34).lineTo(x + size - 11, y + 18).stroke();
    doc.moveTo(x + size - 5, y + 7).lineTo(x + size - 19, y + 19).stroke();
    doc.moveTo(x + size - 11, y + 8).lineTo(x + size - 25, y + 19).stroke();
  }
  doc.restore();
}

const PHOTO_FRAME_SHAPES = Object.freeze([
  [
    [0.012, 0.035],
    [0.994, 0.006],
    [0.984, 0.972],
    [0.006, 0.992]
  ],
  [
    [0.006, 0.012],
    [0.974, 0.004],
    [0.994, 0.982],
    [0.03, 0.996]
  ],
  [
    [0.026, 0.006],
    [0.996, 0.032],
    [0.974, 0.996],
    [0.004, 0.966]
  ],
  [
    [0.004, 0.044],
    [0.99, 0.01],
    [0.996, 0.994],
    [0.016, 0.974]
  ],
  [
    [0.022, 0.004],
    [0.996, 0.012],
    [0.976, 0.966],
    [0.01, 0.996]
  ],
  [
    [0.008, 0.004],
    [0.97, 0.03],
    [0.996, 0.966],
    [0.034, 0.996]
  ]
]);

function photoFrameShape(variant = 0) {
  return PHOTO_FRAME_SHAPES[Math.abs(Number(variant) || 0) % PHOTO_FRAME_SHAPES.length];
}

function drawFramedImage(doc, { x, y, width, height, angle = 0, imageBuffer = null, label = "", labelBackdrop = false, fonts = null, lang = "en", variant = 0 } = {}) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const shape = photoFrameShape(variant);
  const outerPoints = polygonPointsFromRelative(x - 5.5, y - 5.5, width + 12, height + 12, shape);
  const innerPoints = polygonPointsFromRelative(x, y, width, height, shape);
  doc.save();
  doc.rotate(angle, { origin: [centerX, centerY] });
  doc.save();
  drawPolygonPath(doc, outerPoints);
  doc.fill(COLORS.white);
  doc.restore();
  doc.save();
  drawPolygonPath(doc, innerPoints);
  doc.clip();
  if (imageBuffer) {
    doc.image(imageBuffer, x, y, { width, height });
  } else {
    doc.rect(x, y, width, height).fill(COLORS.accentSoft);
  }
  doc.restore();
  if (label) {
    doc.save();
    drawPolygonPath(doc, innerPoints);
    doc.clip();
    if (labelBackdrop) {
      doc
        .fillOpacity(PHOTO_LABEL_BACKDROP_OPACITY)
        .roundedRect(x + 7, y + height - 30, width - 14, 24, 4)
        .fill(PHOTO_LABEL_BACKDROP_COLOR)
        .fillOpacity(1);
    }
    doc
      .font(pdfFontName("display", fonts))
      .fontSize(14)
      .fillColor(COLORS.white)
      .text(label.toUpperCase(), x + 10, y + height - 25, pdfTextOptions(lang, { width: width - 20, height: 18, ellipsis: true }));
    doc.restore();
  }
  doc.save();
  drawPolygonPath(doc, outerPoints);
  doc.lineWidth(1.1).strokeColor(COLORS.white).stroke();
  doc.restore();
  doc.restore();
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function deterministicUnit(seed, key) {
  const digest = createHash("sha256").update(`${seed}:${key}`).digest();
  return digest.readUInt32BE(0) / 0x100000000;
}

function deterministicRange(seed, key, min, max) {
  return min + (max - min) * deterministicUnit(seed, key);
}

function deterministicIndex(seed, key, count) {
  return Math.min(Math.max(0, count - 1), Math.floor(deterministicUnit(seed, key) * count));
}

function bodyImageBaseLayouts(count) {
  const layoutsByCount = {
    1: [
      { x: 322, y: 358, width: 236, height: 158, angle: 2 }
    ],
    2: [
      { x: 328, y: 292, width: 218, height: 142, angle: -2.8 },
      { x: 322, y: 468, width: 230, height: 148, angle: 3.2 }
    ],
    3: [
      { x: 346, y: 276, width: 202, height: 130, angle: 2.4 },
      { x: 306, y: 418, width: 194, height: 126, angle: -3.8 },
      { x: 386, y: 506, width: 170, height: 110, angle: 4.2 }
    ],
    4: [
      { x: 344, y: 258, width: 198, height: 126, angle: -2.8 },
      { x: 306, y: 402, width: 172, height: 110, angle: 3 },
      { x: 382, y: 508, width: 184, height: 112, angle: -2.2 },
      { x: 452, y: 370, width: 108, height: 84, angle: 5 }
    ]
  };
  return layoutsByCount[clampNumber(count, 1, BODY_IMAGE_LIMIT)] || [];
}

function createBodyImageLayoutSeed(tour, bodyFrames) {
  return [
    textOrNull(tour?.id),
    textOrNull(tour?.slug),
    textOrNull(tour?.title),
    ...bodyFrames.map((frame) => [
      textOrNull(frame?.entry?.id),
      textOrNull(frame?.entry?.storagePath),
      textOrNull(frame?.entry?.label)
    ].filter(Boolean).join(":"))
  ].filter(Boolean).join("|") || "one-pager-body-images";
}

function createBodyImageLayouts(tour, frameImages) {
  const bodyFrames = safeArray(frameImages)
    .slice(1)
    .filter((frame) => frame?.entry)
    .slice(0, BODY_IMAGE_LIMIT);
  const baseLayouts = bodyImageBaseLayouts(bodyFrames.length);
  const seed = createBodyImageLayoutSeed(tour, bodyFrames);
  return bodyFrames.map((frame, index) => {
    const base = baseLayouts[index];
    const scale = deterministicRange(seed, `scale:${index}`, 0.84, 1.18);
    const ratioScale = deterministicRange(seed, `ratio:${index}`, 0.9, 1.1);
    const width = clampNumber(base.width * scale, 88, BODY_IMAGE_RENDER_FRAME.width);
    const height = clampNumber(base.height * scale * ratioScale, 68, BODY_IMAGE_RENDER_FRAME.height);
    const x = clampNumber(
      base.x + deterministicRange(seed, `x:${index}`, -26, 26),
      BODY_IMAGE_LAYOUT_BOUNDS.minX,
      BODY_IMAGE_LAYOUT_BOUNDS.maxX - width
    );
    const y = clampNumber(
      base.y + deterministicRange(seed, `y:${index}`, -30, 30),
      BODY_IMAGE_LAYOUT_BOUNDS.minY,
      BODY_IMAGE_LAYOUT_BOUNDS.maxY - height
    );
    return {
      frame,
      layout: {
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        width: Number(width.toFixed(2)),
        height: Number(height.toFixed(2)),
        angle: Number((base.angle + deterministicRange(seed, `angle:${index}`, -2.2, 2.2)).toFixed(2)),
        variant: deterministicIndex(seed, `shape:${index}`, PHOTO_FRAME_SHAPES.length)
      }
    };
  });
}

function drawLogo(doc, logoPath) {
  if (!logoPath) {
    throw new Error("Production logo path is required for the tour one-pager PDF.");
  }
  doc.image(logoPath, 42, 36, {
    fit: [180, 60],
    align: "left",
    valign: "top"
  });
}

function measurePdfTextHeight(doc, text, { fontName, fontSize, options }) {
  doc.font(fontName).fontSize(fontSize);
  return doc.heightOfString(text, options);
}

function fitPdfTextSize(doc, text, { fontName, maxSize, minSize, maxHeight, options, step = 0.5 }) {
  for (let size = maxSize; size >= minSize; size -= step) {
    const roundedSize = Number(size.toFixed(2));
    if (measurePdfTextHeight(doc, text, { fontName, fontSize: roundedSize, options }) <= maxHeight) {
      return roundedSize;
    }
  }
  return minSize;
}

function fitTitleSize(doc, title, fonts, options) {
  return fitPdfTextSize(doc, title, {
    fontName: pdfFontName("display", fonts),
    maxSize: 56,
    minSize: 14,
    maxHeight: 124,
    options
  });
}

function smoothStep(edge0, edge1, value) {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

async function createFeatheredHeroImageBuffer(imageBuffer) {
  if (!imageBuffer) return null;
  const width = Math.max(1, Math.round(HERO_BACKGROUND_IMAGE.width * IMAGE_RENDER_SCALE));
  const height = Math.max(1, Math.round(HERO_BACKGROUND_IMAGE.height * IMAGE_RENDER_SCALE));
  const alphaMask = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const leftAlpha = smoothStep(width * 0.02, width * 0.56, x);
      const topAlpha = smoothStep(0, height * 0.12, y);
      const bottomAlpha = 1 - smoothStep(height * 0.58, height, y);
      const alpha = Math.round(255 * Math.min(leftAlpha, topAlpha, bottomAlpha));
      const offset = (y * width + x) * 4;
      alphaMask[offset] = 255;
      alphaMask[offset + 1] = 255;
      alphaMask[offset + 2] = 255;
      alphaMask[offset + 3] = alpha;
    }
  }
  const maskBuffer = await sharp(alphaMask, {
    raw: {
      width,
      height,
      channels: 4
    }
  }).png().toBuffer();
  return await sharp(imageBuffer)
    .resize(width, height, { fit: "cover", position: "centre" })
    .ensureAlpha()
    .composite([{ input: maskBuffer, blend: "dest-in" }])
    .png()
    .toBuffer();
}

function durationParts(days, lang) {
  const dayCount = Math.max(0, safeArray(days).length);
  const nightCount = Math.max(0, dayCount - 1);
  const dayLabel = onePagerCountLabel(lang, dayCount, "day_count_one", "day_count_other", "{count} day", "{count} days");
  const nightLabel = onePagerCountLabel(lang, nightCount, "night_count_one", "night_count_other", "{count} night", "{count} nights");
  const badgeDayLabel = onePagerCountLabel(lang, dayCount, "day_badge_one", "day_badge_other", "{count} DAY", "{count} DAYS");
  const badgeNightLabel = onePagerCountLabel(lang, nightCount, "night_badge_one", "night_badge_other", "{count} NIGHT", "{count} NIGHTS");
  return {
    dayCount,
    nightCount,
    label: dayCount > 0 ? dayLabel : onePagerT(lang, "tour", "Tour"),
    nightLabel,
    badge: dayCount > 0 ? `${badgeDayLabel}\n${badgeNightLabel}` : onePagerT(lang, "tour_overview_badge", "TOUR\nOVERVIEW")
  };
}

function collectTourImages(tour, lang) {
  const entries = [];
  const webImageIds = (Array.isArray(tour?.travel_plan?.tour_card_image_ids) ? tour.travel_plan.tour_card_image_ids : [])
    .map((value) => textOrNull(value))
    .filter(Boolean);
  const hasOnePagerImageIds = Object.prototype.hasOwnProperty.call(tour?.travel_plan || {}, "one_pager_image_ids");
  const onePagerImageIds = (Array.isArray(tour?.travel_plan?.one_pager_image_ids) ? tour.travel_plan.one_pager_image_ids : [])
    .map((value) => textOrNull(value))
    .filter(Boolean);
  const selectedImageIds = hasOnePagerImageIds ? onePagerImageIds : webImageIds;
  const heroImageId = textOrNull(tour?.travel_plan?.one_pager_hero_image_id)
    || selectedImageIds[0]
    || webImageIds[0]
    || textOrNull(tour?.travel_plan?.tour_card_primary_image_id);
  safeArray(tour?.travel_plan?.days).forEach((day, dayIndex) => {
    safeArray(day?.services).forEach((service, serviceIndex) => {
      const image = service?.image && typeof service.image === "object" && !Array.isArray(service.image)
        ? service.image
        : null;
      const storagePath = textOrNull(image?.storage_path);
      if (!storagePath || image?.is_customer_visible === false) return;
      const imageId = textOrNull(image?.id);
      entries.push({
        id: imageId,
        storagePath,
        priority: webImageIds.includes(imageId)
          ? webImageIds.indexOf(imageId)
          : (image.include_in_travel_tour_card === true ? webImageIds.length : webImageIds.length + 1),
        order: dayIndex * 100 + serviceIndex,
        label: textOrNull(service?.title) || textOrNull(service?.location) || textOrNull(day?.overnight_location) || textOrNull(day?.title) || onePagerT(lang, "tour", "Tour")
      });
    });
  });

  const seen = new Set();
  const entriesById = new Map(entries.filter((entry) => entry.id).map((entry) => [entry.id, entry]));
  const fallbackEntries = entries
    .sort((left, right) => left.priority - right.priority || left.order - right.order)
    .filter((entry) => {
      if (seen.has(entry.storagePath)) return false;
      seen.add(entry.storagePath);
      return true;
    });
  const orderedEntries = [];
  const addEntry = (entry) => {
    if (!entry || orderedEntries.some((existing) => existing.storagePath === entry.storagePath)) return;
    orderedEntries.push(entry);
  };
  addEntry(entriesById.get(heroImageId));
  selectedImageIds.forEach((imageId) => addEntry(entriesById.get(imageId)));
  if (!hasOnePagerImageIds) {
    fallbackEntries.forEach(addEntry);
  }
  const outputSeen = new Set();
  return orderedEntries
    .filter((entry) => {
      if (outputSeen.has(entry.storagePath)) return false;
      outputSeen.add(entry.storagePath);
      return true;
    });
}

function collectScriptProvidedFrameImages(tour, lang) {
  const sourceImages = safeArray(tour?.travel_plan?.__one_pager_frame_images).length
    ? safeArray(tour.travel_plan.__one_pager_frame_images)
    : safeArray(tour?.travel_plan?.__one_pager_random_images);
  return sourceImages
    .map((entry, index) => {
      const source = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
      const storagePath = textOrNull(source.storage_path);
      if (!storagePath) return null;
      return {
        id: textOrNull(source.id) || `one-pager-random-${index + 1}`,
        storagePath,
        priority: index,
        order: index,
        label: textOrNull(source.label) || onePagerT(lang, "tour", "Tour")
      };
    })
    .filter(Boolean);
}

function extractPublicRelativePath(publicUrl, prefix) {
  const normalizedUrl = normalizeText(publicUrl);
  if (!normalizedUrl) return "";
  if (normalizedUrl.startsWith(prefix)) return normalizedUrl.slice(prefix.length).replace(/^\/+/, "");
  return normalizedUrl.replace(/^\/+/, "");
}

async function loadImageBuffer(storagePath, { width, height, resolveTourImageDiskPath, fallbackImagePath }) {
  const relativePath = extractPublicRelativePath(storagePath, PUBLIC_TOUR_IMAGE_PREFIX);
  const candidates = [
    typeof resolveTourImageDiskPath === "function" ? resolveTourImageDiskPath(relativePath) : "",
    typeof resolveTourImageDiskPath === "function" && relativePath !== storagePath ? resolveTourImageDiskPath(storagePath) : "",
    fallbackImagePath
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!(await fileExists(candidate))) continue;
    try {
      return await sharp(candidate)
        .rotate()
        .resize(
          Math.max(1, Math.round(width * IMAGE_RENDER_SCALE)),
          Math.max(1, Math.round(height * IMAGE_RENDER_SCALE)),
          { fit: "cover", position: "centre" }
        )
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

async function imageLowerBandNeedsLabelBackdrop(imageBuffer) {
  if (!imageBuffer) return false;
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = Math.max(1, Math.round(Number(metadata.width) || 0));
    const height = Math.max(1, Math.round(Number(metadata.height) || 0));
    if (!width || !height) return false;
    const bandTop = Math.max(0, Math.floor(height * 0.62));
    const bandHeight = Math.max(1, height - bandTop);
    const stats = await sharp(imageBuffer)
      .extract({ left: 0, top: bandTop, width, height: bandHeight })
      .stats();
    const channels = Array.isArray(stats?.channels) ? stats.channels : [];
    if (channels.length < 3) return false;
    const luminance = channels[0].mean * 0.2126 + channels[1].mean * 0.7152 + channels[2].mean * 0.0722;
    return luminance >= PHOTO_LABEL_BRIGHTNESS_THRESHOLD;
  } catch {
    return false;
  }
}

function normalizeExperienceHighlightManifestItem(item, index, manifestDir) {
  const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  const image = textOrNull(source.image);
  const id = textOrNull(source.id) || (image ? image.replace(/\.[^.]+$/, "") : "") || `highlight_${index + 1}`;
  if (!image || !id) return null;
  const title = textOrNull(source.title) || localizedMapValue(source.title_i18n, "en", id);
  return {
    id,
    title,
    title_i18n: source.title_i18n && typeof source.title_i18n === "object" && !Array.isArray(source.title_i18n)
      ? source.title_i18n
      : {},
    imagePath: path.join(manifestDir, image)
  };
}

async function readExperienceHighlightManifest(manifestPath) {
  const normalizedPath = normalizeText(manifestPath);
  if (!normalizedPath) return [];
  try {
    const raw = await readFile(normalizedPath, "utf8");
    const parsed = JSON.parse(raw);
    const manifestDir = path.dirname(normalizedPath);
    return (Array.isArray(parsed) ? parsed : [])
      .map((item, index) => normalizeExperienceHighlightManifestItem(item, index, manifestDir))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function loadExperienceHighlightImageBuffer(imagePath, size = 42) {
  if (!(await fileExists(imagePath))) return null;
  try {
    return await sharp(imagePath)
      .resize(
        Math.max(1, Math.round(size * EXPERIENCE_HIGHLIGHT_RENDER_SCALE)),
        Math.max(1, Math.round(size * EXPERIENCE_HIGHLIGHT_RENDER_SCALE)),
        { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }
      )
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

async function collectConfiguredExperienceHighlightItems(tour, lang, manifestPath) {
  const selectedIds = safeArray(tour?.travel_plan?.one_pager_experience_highlight_ids)
    .map((value) => textOrNull(value))
    .filter(Boolean)
    .slice(0, ONE_PAGER_EXPERIENCE_HIGHLIGHT_LIMIT);
  if (selectedIds.length < ONE_PAGER_EXPERIENCE_HIGHLIGHT_LIMIT) return [];
  const manifestItems = await readExperienceHighlightManifest(manifestPath);
  if (!manifestItems.length) return [];
  const itemById = new Map(manifestItems.map((item) => [item.id, item]));
  const configuredItems = selectedIds
    .map((id) => itemById.get(id))
    .filter(Boolean)
    .slice(0, ONE_PAGER_EXPERIENCE_HIGHLIGHT_LIMIT);
  if (configuredItems.length < ONE_PAGER_EXPERIENCE_HIGHLIGHT_LIMIT) return [];
  return await Promise.all(configuredItems.map(async (item) => ({
    title: localizedMapValue(item.title_i18n, lang, item.title),
    body: "",
    imageBuffer: await loadExperienceHighlightImageBuffer(item.imagePath)
  })));
}

function localizedServiceKindLabel(lang, value) {
  const normalizedKind = normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (!normalizedKind) return "";
  return pdfT(lang, `offer.item.${normalizedKind}`, normalizeText(value));
}

function collectHighlightItems(tour, duration, lang) {
  const destinations = safeArray(tour?.destinations).slice(0, 2).join(", ");
  const styles = safeArray(tour?.styles).slice(0, 2).join(", ");
  const services = safeArray(tour?.travel_plan?.days).flatMap((day) => safeArray(day?.services));
  const serviceKinds = new Set(services.map((service) => normalizeText(service?.kind)).filter(Boolean));
  const serviceKindLabels = Array.from(serviceKinds)
    .slice(0, 2)
    .map((kind) => localizedServiceKindLabel(lang, kind))
    .filter(Boolean);
  const entries = [
    { title: duration.label, body: duration.nightCount > 0 ? duration.nightLabel : onePagerT(lang, "flexible_pacing", "Flexible pacing") },
    { title: destinations || onePagerT(lang, "destinations", "Destinations"), body: destinations ? onePagerT(lang, "main_route", "Main route") : onePagerT(lang, "curated_route", "Curated route") },
    { title: styles || onePagerT(lang, "travel_style", "Travel style"), body: styles ? onePagerT(lang, "tour_style", "Tour style") : onePagerT(lang, "matched_to_tour", "Matched to the tour") },
    {
      title: onePagerCountLabel(
        lang,
        services.length,
        "planned_services_one",
        "planned_services_other",
        "{count} planned service",
        "{count} planned services"
      ),
      body: serviceKindLabels.length ? serviceKindLabels.join(", ") : onePagerT(lang, "tour_experiences", "Tour experiences")
    }
  ];
  return entries.slice(0, 4);
}

function collectIncludedItems(tour, duration, lang) {
  const services = safeArray(tour?.travel_plan?.days).flatMap((day) => safeArray(day?.services));
  const serviceTitles = services.map((service) => textOrNull(service?.title)).filter(Boolean);
  const destinations = safeArray(tour?.destinations).join(", ");
  return [
    duration.dayCount > 0
      ? onePagerCountLabel(lang, duration.dayCount, "day_tour_plan_one", "day_tour_plan_other", "{count} day tour plan", "{count} days tour plan")
      : onePagerT(lang, "tour_plan_overview", "Tour plan overview"),
    destinations
      ? onePagerT(lang, "route_through", "Route through {destinations}", { destinations })
      : onePagerT(lang, "curated_route", "Curated route"),
    serviceTitles[0] || onePagerT(lang, "selected_local_experiences", "Selected local experiences"),
    serviceTitles[1] || onePagerT(lang, "planned_transport_and_pacing", "Planned transport and pacing")
  ].slice(0, 4);
}

function drawSectionHeading(doc, text, x, y, width, fonts, lang) {
  doc
    .font(pdfFontName("label", fonts))
    .fontSize(12.5)
    .fillColor(COLORS.accentText)
    .text(text.toUpperCase(), x, y, pdfTextOptions(lang, { width: 156, characterSpacing: 0.25 }));
  doc
    .moveTo(x + 160, y + 7)
    .lineTo(x + width, y + 7)
    .lineWidth(0.8)
    .strokeColor(COLORS.line)
    .stroke();
}

function drawHighlights(doc, items, x, y, width, fonts, lang) {
  drawSectionHeading(doc, onePagerT(lang, "experience_highlights", "Experience highlights"), x, y, width, fonts, lang);
  const colWidth = width / items.length;
  const top = y + 34;
  items.forEach((item, index) => {
    const itemX = x + index * colWidth;
    if (item.imageBuffer) {
      doc.image(item.imageBuffer, itemX + colWidth / 2 - 21, top - 3, { fit: [42, 42] });
    } else {
      drawHighlightIcon(doc, index, itemX + colWidth / 2 - 18, top, 36, COLORS.textStrong);
    }
    doc
      .font(pdfFontName("label", fonts))
      .fontSize(7.8)
      .fillColor(COLORS.textStrong)
      .text(item.title.toUpperCase(), itemX, top + 45, pdfTextOptions(lang, { width: colWidth - 10, height: item.body ? 20 : 38, align: "center", ellipsis: true }));
    if (item.body) {
      doc
        .font(pdfFontName("regular", fonts))
        .fontSize(7.5)
        .fillColor(COLORS.text)
        .text(item.body, itemX + 3, top + 68, pdfTextOptions(lang, { width: colWidth - 16, height: 25, align: "center", ellipsis: true }));
    }
    if (index > 0) {
      doc.moveTo(itemX - 5, top + 2).lineTo(itemX - 5, top + 92).lineWidth(0.5).strokeColor(COLORS.line).stroke();
    }
  });
}

function drawIncluded(doc, items, x, y, width, fonts, lang) {
  drawSectionHeading(doc, onePagerT(lang, "whats_included", "What's included"), x, y, width, fonts, lang);
  const colWidth = width / 2;
  items.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const itemX = x + col * colWidth;
    const itemY = y + 34 + row * 22;
    drawCheckIcon(doc, itemX, itemY - 1, 14, COLORS.accent);
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(8.7)
      .fillColor(COLORS.text)
      .text(item, itemX + 20, itemY, { width: colWidth - 24, height: 18, ellipsis: true });
  });
}

function drawCalendarIcon(doc, x, y, width, height, color) {
  doc.save();
  doc
    .roundedRect(x, y + 3, width, height - 3, 2.5)
    .lineWidth(1.2)
    .strokeColor(color)
    .stroke();
  doc
    .moveTo(x, y + 9)
    .lineTo(x + width, y + 9)
    .lineWidth(1.2)
    .strokeColor(color)
    .stroke();
  doc
    .moveTo(x + 5, y)
    .lineTo(x + 5, y + 6)
    .moveTo(x + width - 5, y)
    .lineTo(x + width - 5, y + 6)
    .lineWidth(1.8)
    .lineCap("round")
    .strokeColor(color)
    .stroke();
  const dotSize = 1.7;
  [
    [x + 5.2, y + 13.1],
    [x + width / 2, y + 13.1],
    [x + width - 5.2, y + 13.1],
    [x + 5.2, y + 17.4],
    [x + width / 2, y + 17.4],
    [x + width - 5.2, y + 17.4]
  ].forEach(([dotX, dotY]) => {
    doc.circle(dotX, dotY, dotSize / 2).fillColor(color).fill();
  });
  doc.restore();
}

function drawFooterWhatsappIcon(doc, x, y, size, color) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.39;
  doc.save();
  doc.lineWidth(1).strokeColor(color).lineCap("round").lineJoin("round");
  doc.circle(cx, cy, r).stroke();
  doc
    .moveTo(x + size * 0.28, y + size * 0.75)
    .lineTo(x + size * 0.2, y + size * 0.94)
    .lineTo(x + size * 0.41, y + size * 0.84)
    .stroke();
  doc
    .moveTo(x + size * 0.39, y + size * 0.36)
    .bezierCurveTo(
      x + size * 0.3,
      y + size * 0.49,
      x + size * 0.43,
      y + size * 0.68,
      x + size * 0.62,
      y + size * 0.68
    )
    .stroke();
  doc
    .moveTo(x + size * 0.39, y + size * 0.36)
    .lineTo(x + size * 0.48, y + size * 0.45)
    .moveTo(x + size * 0.62, y + size * 0.68)
    .lineTo(x + size * 0.7, y + size * 0.58)
    .stroke();
  doc.restore();
}

function drawFooterEnvelopeIcon(doc, x, y, size, color) {
  const left = x + size * 0.08;
  const top = y + size * 0.22;
  const width = size * 0.84;
  const height = size * 0.58;
  const midX = x + size / 2;
  const midY = y + size * 0.56;
  doc.save();
  doc.lineWidth(1).strokeColor(color).lineCap("round").lineJoin("round");
  doc.roundedRect(left, top, width, height, 1.4).stroke();
  doc
    .moveTo(left, top + 1)
    .lineTo(midX, midY)
    .lineTo(left + width, top + 1)
    .moveTo(left, top + height)
    .lineTo(midX, midY)
    .lineTo(left + width, top + height)
    .stroke();
  doc.restore();
}

function drawFooterGlobeIcon(doc, x, y, size, color) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.42;
  doc.save();
  doc.lineWidth(1).strokeColor(color).lineCap("round").lineJoin("round");
  doc.circle(cx, cy, r).stroke();
  doc.ellipse(cx, cy, r * 0.48, r).stroke();
  doc.moveTo(cx - r, cy).lineTo(cx + r, cy).stroke();
  doc
    .moveTo(cx - r * 0.78, cy - r * 0.38)
    .bezierCurveTo(cx - r * 0.38, cy - r * 0.56, cx + r * 0.38, cy - r * 0.56, cx + r * 0.78, cy - r * 0.38)
    .moveTo(cx - r * 0.78, cy + r * 0.38)
    .bezierCurveTo(cx - r * 0.38, cy + r * 0.56, cx + r * 0.38, cy + r * 0.56, cx + r * 0.78, cy + r * 0.38)
    .stroke();
  doc.restore();
}

function drawFooterPinIcon(doc, x, y, size, color) {
  const cx = x + size / 2;
  doc.save();
  doc.lineWidth(1).strokeColor(color).lineCap("round").lineJoin("round");
  doc
    .moveTo(cx, y + size * 0.92)
    .bezierCurveTo(
      x + size * 0.24,
      y + size * 0.62,
      x + size * 0.2,
      y + size * 0.22,
      cx,
      y + size * 0.14
    )
    .bezierCurveTo(
      x + size * 0.8,
      y + size * 0.22,
      x + size * 0.76,
      y + size * 0.62,
      cx,
      y + size * 0.92
    )
    .stroke();
  doc.circle(cx, y + size * 0.42, size * 0.13).stroke();
  doc.restore();
}

function drawFooterPictogram(doc, icon, x, y, size, color) {
  if (icon === "whatsapp") {
    drawFooterWhatsappIcon(doc, x, y, size, color);
  } else if (icon === "email") {
    drawFooterEnvelopeIcon(doc, x, y, size, color);
  } else if (icon === "website") {
    drawFooterGlobeIcon(doc, x, y, size, color);
  } else if (icon === "address") {
    drawFooterPinIcon(doc, x, y, size, color);
  }
}

function drawDurationBadge(doc, duration, fonts) {
  doc.save();
  doc.circle(511, 111, 38).fill(COLORS.accent);
  doc.circle(511, 111, 40).lineWidth(3).strokeColor(COLORS.white).stroke();
  drawCalendarIcon(doc, 500, 83, 22, 20, COLORS.white);
  const lines = duration.badge.split("\n");
  doc
    .font(pdfFontName("label", fonts))
    .fontSize(12.6)
    .fillColor(COLORS.white)
    .text(lines[0], 476, 108, { width: 70, align: "center" })
    .fontSize(11.5)
    .text(lines[1] || "", 476, 125, { width: 70, align: "center" });
  doc.restore();
}

function drawCtaPaperPlaneIcon(doc, x, y, size, color) {
  doc.save();
  doc
    .moveTo(x, y + size * 0.45)
    .lineTo(x + size * 0.95, y)
    .lineTo(x + size * 0.66, y + size * 0.95)
    .lineTo(x + size * 0.43, y + size * 0.6)
    .lineTo(x, y + size * 0.45)
    .lineWidth(2.1)
    .lineJoin("round")
    .lineCap("round")
    .strokeColor(color)
    .stroke();
  doc
    .moveTo(x + size * 0.43, y + size * 0.6)
    .lineTo(x + size * 0.95, y)
    .lineWidth(1.25)
    .strokeColor(color)
    .stroke();
  doc.restore();
}

function drawCtaLightningIcon(doc, x, y, size, color) {
  doc.save();
  doc
    .moveTo(x + size * 0.58, y)
    .lineTo(x + size * 0.18, y + size * 0.54)
    .lineTo(x + size * 0.46, y + size * 0.54)
    .lineTo(x + size * 0.34, y + size)
    .lineTo(x + size * 0.82, y + size * 0.38)
    .lineTo(x + size * 0.54, y + size * 0.38)
    .closePath()
    .fillColor(color)
    .fill();
  doc.restore();
}

function drawCtaExpertIcon(doc, x, y, size, color) {
  const cx = x + size / 2;
  doc.save();
  doc.lineWidth(1.15).strokeColor(color).lineCap("round").lineJoin("round");
  doc
    .moveTo(cx, y + size * 0.96)
    .bezierCurveTo(x + size * 0.2, y + size * 0.66, x + size * 0.18, y + size * 0.22, cx, y + size * 0.12)
    .bezierCurveTo(x + size * 0.82, y + size * 0.22, x + size * 0.8, y + size * 0.66, cx, y + size * 0.96)
    .stroke();
  doc
    .circle(cx, y + size * 0.42, size * 0.14)
    .stroke();
  doc
    .moveTo(x + size * 0.24, y + size)
    .lineTo(x + size * 0.76, y + size)
    .stroke();
  doc.restore();
}

function drawCtaSupportIcon(doc, x, y, size, color, fonts) {
  doc.save();
  doc.lineWidth(1.05).strokeColor(color).lineCap("round").lineJoin("round");
  doc.circle(x + size / 2, y + size / 2, size * 0.42).stroke();
  doc
    .font(pdfFontName("label", fonts))
    .fontSize(size * 0.36)
    .fillColor(color)
    .text("24", x, y + size * 0.28, { width: size, align: "center" });
  doc.restore();
}

function drawCtaFeatureIcon(doc, icon, x, y, size, color, fonts) {
  if (icon === "fast") {
    drawCtaLightningIcon(doc, x, y, size, color);
  } else if (icon === "expert") {
    drawCtaExpertIcon(doc, x, y, size, color);
  } else if (icon === "support") {
    drawCtaSupportIcon(doc, x, y, size, color, fonts);
  }
}

function drawCtaFeature(doc, { icon, text, x, y, width, fonts, lang }) {
  const iconSize = 11.5;
  const labelX = x + iconSize + 4.5;
  const labelWidth = Math.max(10, width - iconSize - 4.5);
  const labelFont = pdfFontName("bold", fonts);
  const labelOptions = pdfTextOptions(lang, { width: labelWidth, height: 10, ellipsis: true });
  const labelSize = fitPdfTextSize(doc, text, {
    fontName: labelFont,
    maxSize: 7.1,
    minSize: 4.8,
    maxHeight: 10,
    options: labelOptions,
    step: 0.25
  });
  drawCtaFeatureIcon(doc, icon, x, y - 0.5, iconSize, COLORS.ctaText, fonts);
  doc
    .font(labelFont)
    .fontSize(labelSize)
    .fillColor(COLORS.ctaText)
    .text(text, labelX, y + 1.2, labelOptions);
}

function drawCta(doc, companyProfile, fonts, lang) {
  const x = 316;
  const width = 252;
  const height = 120;
  const y = PAGE_HEIGHT - FOOTER_HEIGHT - height - 11;
  const usesDecorativeFonts = shouldUseOnePagerDecorativeFonts(lang);
  const titleText = onePagerT(lang, "cta_plan", "Let's plan your");
  const scriptText = onePagerT(lang, "cta_perfect_trip", "perfect trip!");
  const contactText = onePagerT(lang, "cta_contact", "CONTACT US TODAY").toUpperCase();
  const titleOptions = pdfTextOptions(lang, { width: 148, height: 20, align: "center", ellipsis: true });
  const scriptOptions = pdfTextOptions(lang, { width: 178, height: 32, align: "center", ellipsis: true });
  const titleFont = pdfFontName("bold", fonts);
  const scriptFont = pdfFontName("script", fonts);
  const contactFont = pdfFontName("label", fonts);
  const titleFontSize = fitPdfTextSize(doc, titleText, {
    fontName: titleFont,
    maxSize: 17.4,
    minSize: 9,
    maxHeight: 20,
    options: titleOptions,
    step: 0.3
  });
  const scriptFontSize = fitPdfTextSize(doc, scriptText, {
    fontName: scriptFont,
    maxSize: usesDecorativeFonts ? 36 : 24,
    minSize: 9,
    maxHeight: 32,
    options: scriptOptions,
    step: 0.3
  });
  const maxContactPillWidth = width - 70;
  const contactSizingOptions = pdfTextOptions(lang, { width: maxContactPillWidth - 24, height: 15, align: "center", ellipsis: true });
  const contactFontSize = fitPdfTextSize(doc, contactText, {
    fontName: contactFont,
    maxSize: 11.8,
    minSize: 6.2,
    maxHeight: 14,
    options: contactSizingOptions,
    step: 0.25
  });
  doc.font(contactFont).fontSize(contactFontSize);
  const measuredContactWidth = doc.widthOfString(contactText);
  const contactPillWidth = clampNumber(measuredContactWidth + 38, 112, maxContactPillWidth);
  const contactPillX = x + (width - contactPillWidth) / 2;
  const contactOptions = pdfTextOptions(lang, { width: contactPillWidth - 24, height: 15, align: "center", ellipsis: true });
  const features = [
    { icon: "fast", text: onePagerT(lang, "cta_fast_response", "Fast Response") },
    { icon: "expert", text: onePagerT(lang, "cta_local_expert", "Local Expert") },
    { icon: "support", text: onePagerT(lang, "cta_support", "24/7 Support") }
  ];
  doc.save();
  doc.roundedRect(x, y, width, height, 12).fill(COLORS.cta);
  doc.roundedRect(x + 4, y + 4, width - 8, height - 8, 10).lineWidth(1.35).strokeColor(COLORS.ctaBorder).stroke();
  drawCtaPaperPlaneIcon(doc, x + 31, y + 24, 28, COLORS.ctaText);
  doc
    .font(titleFont)
    .fontSize(titleFontSize)
    .fillColor(COLORS.white)
    .text(titleText, x + 78, y + 12, titleOptions);
  doc
    .font(scriptFont)
    .fontSize(scriptFontSize)
    .fillColor(COLORS.ctaText)
    .text(scriptText, x + 58, y + 31, scriptOptions);
  doc
    .roundedRect(contactPillX, y + 73, contactPillWidth, 22, 11)
    .fill(COLORS.ctaButton);
  doc
    .font(contactFont)
    .fontSize(contactFontSize)
    .fillColor(COLORS.ctaButtonText)
    .text(contactText, contactPillX + 12, y + 78, contactOptions);
  const featureY = y + 103;
  const featureWidth = (width - 42) / 3;
  features.forEach((feature, index) => {
    drawCtaFeature(doc, {
      ...feature,
      x: x + 18 + index * featureWidth,
      y: featureY,
      width: featureWidth - 3,
      fonts,
      lang
    });
  });
  doc.restore();
}

function drawFooter(doc, companyProfile, fonts) {
  const footerY = PAGE_HEIGHT - FOOTER_HEIGHT;
  const iconSize = 16;
  const itemY = footerY + 14;
  const slots = [
    { icon: "whatsapp", text: companyProfile?.whatsapp, x: 34, width: 112 },
    { icon: "email", text: companyProfile?.email, x: 146, width: 148 },
    { icon: "website", text: companyProfile?.website, x: 294, width: 118 },
    { icon: "address", text: companyProfile?.address, x: 412, width: 166 }
  ]
    .map((slot) => ({ ...slot, text: normalizeText(slot.text) }))
    .filter((slot) => slot.text);
  drawSoftRect(doc, 0, footerY, PAGE_WIDTH, PAGE_HEIGHT - footerY, COLORS.accent, 0);
  slots.forEach((slot) => {
    drawFooterPictogram(doc, slot.icon, slot.x, itemY - 1, iconSize, COLORS.white);
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(slot.icon === "address" ? 7.6 : 8.2)
      .fillColor(COLORS.white)
      .text(slot.text, slot.x + iconSize + 8, itemY + 3, {
        width: slot.width - iconSize - 8,
        height: 11,
        ellipsis: true
      });
  });
}

async function prepareFrameImages(tour, deps, lang) {
  const entries = collectScriptProvidedFrameImages(tour, lang);
  if (!entries.length) {
    entries.push(...collectTourImages(tour, lang));
  }
  const frames = [
    { width: 520, height: 270 },
    ...Array.from({ length: BODY_IMAGE_LIMIT }, () => BODY_IMAGE_RENDER_FRAME)
  ];
  return await Promise.all(frames.map(async (frame, index) => {
    const entry = entries[index] || null;
    const buffer = entry
      ? await loadImageBuffer(entry.storagePath, {
        ...frame,
        resolveTourImageDiskPath: deps.resolveTourImageDiskPath,
        fallbackImagePath: deps.fallbackImagePath
      })
      : null;
    return {
      entry,
      buffer,
      labelBackdrop: index > 0 && await imageLowerBandNeedsLabelBackdrop(buffer)
    };
  }));
}

function drawMainCopy(doc, tour, duration, fonts, lang) {
  const title = textOrNull(tour?.title) || onePagerT(lang, "tour", "Tour");
  const titleText = title.toUpperCase();
  const description = textOrNull(tour?.short_description)
    || onePagerT(lang, "default_description", "A curated {duration} by Asia Travel Plan.", {
      duration: duration.label.toLowerCase()
    });
  const styleLine = safeArray(tour?.styles).slice(0, 3).map((item) => item.toUpperCase()).join("  |  ");

  doc
    .font(pdfFontName("tripLabel", fonts))
    .fontSize(fonts?.tripLabel ? 27 : 44)
    .fillColor(PDF_TRIP_LABEL_ORANGE)
    .text(onePagerT(lang, "trip_to", "Trip to"), 42, 118, pdfTextOptions(lang, { width: 210 }));
  const titleOptions = pdfTextOptions(lang, { width: 286, lineGap: -6 });
  const titleSize = fitTitleSize(doc, titleText, fonts, titleOptions);
  const titleFontName = pdfFontName("display", fonts);
  const titleHeight = Math.ceil(measurePdfTextHeight(doc, titleText, {
    fontName: titleFontName,
    fontSize: titleSize,
    options: titleOptions
  }));
  doc
    .font(titleFontName)
    .fontSize(titleSize)
    .fillColor(COLORS.textStrong)
    .text(titleText, 42, 208, titleOptions);
  const styleText = styleLine || onePagerT(lang, "default_style_line", "PRIVATE TOUR  |  LOCAL EXPERTISE").toUpperCase();
  const styleY = Math.max(338, 208 + titleHeight + 10);
  const styleOptions = pdfTextOptions(lang, { width: 282, characterSpacing: 1.4, lineGap: 2 });
  doc
    .font(pdfFontName("label", fonts))
    .fontSize(12.5)
    .fillColor(COLORS.textStrong);
  const measuredStyleHeight = Math.max(18, Math.ceil(doc.heightOfString(styleText, styleOptions)));
  const styleHeight = Math.min(64, measuredStyleHeight);
  doc.text(styleText, 42, styleY, pdfTextOptions(lang, { ...styleOptions, height: styleHeight, ellipsis: measuredStyleHeight > styleHeight }));
  const descriptionY = Math.max(368, styleY + styleHeight + 8);
  const descriptionOptions = pdfTextOptions(lang, { width: 265, lineGap: 3 });
  const descriptionFontName = pdfFontName("regular", fonts);
  const descriptionFontSize = fitPdfTextSize(doc, description, {
    fontName: descriptionFontName,
    maxSize: 10.6,
    minSize: 5.2,
    maxHeight: Math.max(72, 426 - descriptionY),
    options: descriptionOptions
  });
  const descriptionHeight = Math.ceil(measurePdfTextHeight(doc, description, {
    fontName: descriptionFontName,
    fontSize: descriptionFontSize,
    options: descriptionOptions
  }));
  doc
    .font(descriptionFontName)
    .fontSize(descriptionFontSize)
    .fillColor(COLORS.text)
    .text(description, 42, descriptionY, descriptionOptions);
  const sectionRuleY = Math.max(430, descriptionY + descriptionHeight + 8);
  doc.moveTo(42, sectionRuleY).lineTo(78, sectionRuleY).lineWidth(1).strokeColor(COLORS.accent).stroke();
  return { highlightsY: Math.max(438, sectionRuleY + 8) };
}

function drawHeroBackgroundImage(doc, imageBuffer) {
  const { x, y, width, height } = HERO_BACKGROUND_IMAGE;
  const heroPoints = [
    [104, 58],
    [584, 56],
    [584, 257],
    [502, 290],
    [344, 282],
    [253, 230],
    [176, 145]
  ];
  if (imageBuffer) {
    doc.image(imageBuffer, x, y, { width, height });
  } else {
    doc.save();
    drawPolygonPath(doc, heroPoints);
    doc.clip();
    doc.rect(x, y, width, height).fill(COLORS.accentSoft);
    doc.restore();
  }
}

function drawBackground(doc, heroImageBuffer) {
  drawSoftRect(doc, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.surfaceMuted, 0);
  drawHeroBackgroundImage(doc, heroImageBuffer);
}

export function createMarketingTourOnePagerPdfWriter({
  resolveTourImageDiskPath,
  logoPath = "",
  busImagePath = "",
  pinImagePath = "",
  fallbackImagePath = "",
  experienceHighlightsManifestPath = "",
  companyProfile = null
} = {}) {
  return async function writeMarketingTourOnePagerPdf(tour, {
    lang = "en",
    outputPath
  } = {}) {
    const normalizedLang = normalizePdfLang(lang);
    const days = safeArray(tour?.travel_plan?.days);
    const duration = durationParts(days, normalizedLang);
    const sampleText = [
      tour?.title,
      tour?.short_description,
      ...safeArray(tour?.destinations),
      ...safeArray(tour?.styles),
      ...days.flatMap((day) => [
        day?.title,
        day?.overnight_location,
        ...safeArray(day?.services).flatMap((service) => [service?.title, service?.location, service?.details])
      ])
    ].map((value) => normalizeText(value)).filter(Boolean).join(" ");
    const bodyFonts = await resolvePdfFontsForLang({
      lang: normalizedLang,
      sampleText,
      regularCandidates: PDF_FONT_REGULAR_CANDIDATES,
      boldCandidates: PDF_FONT_BOLD_CANDIDATES
    });
    const displayFonts = shouldUseOnePagerDecorativeFonts(normalizedLang)
      ? await resolveOnePagerDisplayFonts(logoPath)
      : {};
    const fonts = {
      ...bodyFonts,
      ...Object.fromEntries(Object.entries(displayFonts).filter(([, value]) => value))
    };
    const frameImages = await prepareFrameImages(tour, { resolveTourImageDiskPath, fallbackImagePath }, normalizedLang);
    const heroBackgroundBuffer = await createFeatheredHeroImageBuffer(frameImages[0]?.buffer);
    const bodyImageLayouts = createBodyImageLayouts(tour, frameImages);
    const configuredHighlightItems = await collectConfiguredExperienceHighlightItems(tour, normalizedLang, experienceHighlightsManifestPath);
    const highlightItems = configuredHighlightItems.length
      ? configuredHighlightItems
      : collectHighlightItems(tour, duration, normalizedLang);
    const resolvedBusImagePath = normalizeText(busImagePath)
      || (normalizeText(logoPath) ? path.join(path.dirname(logoPath), PDF_BUS_IMAGE_FILENAME) : "");
    const resolvedPinImagePath = normalizeText(pinImagePath)
      || (normalizeText(logoPath) ? path.join(path.dirname(logoPath), PDF_PIN_IMAGE_FILENAME) : "");

    const renderWithFonts = async (renderFonts) => {
      await removePartialPdf(outputPath);
      const doc = new PDFDocument({
        autoFirstPage: false,
        size: PAGE_SIZE,
        margin: 0,
        info: {
          Title: `${textOrNull(tour?.title) || onePagerT(normalizedLang, "tour", "Tour")} ${onePagerT(normalizedLang, "document_title_suffix", "one pager")}`,
          Author: "AsiaTravelPlan"
        }
      });
      registerPdfFonts(doc, renderFonts);
      doc.addPage({ size: PAGE_SIZE, margin: 0 });

      drawBackground(doc, heroBackgroundBuffer);
      drawLogo(doc, logoPath);
      drawDurationBadge(doc, duration, renderFonts);
      const mainCopyLayout = drawMainCopy(doc, tour, duration, renderFonts, normalizedLang);
      const highlightsY = Math.max(438, Number(mainCopyLayout?.highlightsY) || 438);
      const lowerContentY = highlightsY + A4_VERTICAL_EXTENSION;
      drawHighlights(doc, highlightItems, 42, highlightsY, 276, renderFonts, normalizedLang);
      drawRouteConnector(doc, 43, lowerContentY + 132, 296, {
        busImagePath: resolvedBusImagePath,
        pinImagePath: resolvedPinImagePath
      });
      drawIncluded(doc, collectIncludedItems(tour, duration, normalizedLang), 42, lowerContentY + 178, 276, renderFonts, normalizedLang);

      bodyImageLayouts.forEach(({ frame, layout }, index) => {
        drawFramedImage(doc, {
          x: layout.x,
          y: layout.y,
          width: layout.width,
          height: layout.height,
          angle: layout.angle,
          imageBuffer: frame?.buffer,
          labelBackdrop: frame?.labelBackdrop === true,
          label: frame?.entry?.label || "",
          fonts: renderFonts,
          lang: normalizedLang,
          variant: layout.variant ?? index
        });
      });
      drawCta(doc, companyProfile || {}, renderFonts, normalizedLang);
      drawFooter(doc, companyProfile || {}, renderFonts);
      await streamPdfToFile(doc, outputPath);
    };

    try {
      await renderWithFonts(fonts);
    } catch (error) {
      if (!isFontkitDataViewBoundsError(error)) throw error;
      const fallbackBodyFonts = {
        ...Object.fromEntries(Object.entries(bodyFonts).filter(([, value]) => value))
      };
      try {
        await renderWithFonts(fallbackBodyFonts);
      } catch (fallbackError) {
        if (!isFontkitDataViewBoundsError(fallbackError)) throw fallbackError;
        await renderWithFonts({});
      }
    }
    return { outputPath };
  };
}
