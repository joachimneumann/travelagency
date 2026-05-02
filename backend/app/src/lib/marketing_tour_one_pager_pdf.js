import { createWriteStream } from "node:fs";
import { access, rm } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { normalizeText } from "./text.js";
import { styleToken } from "./style_tokens.js";
import { pdfTextOptions, normalizePdfLang, pdfT } from "./pdf_i18n.js";
import { resolvePdfFontsForLang } from "./pdf_font_resolver.js";

const PAGE_SIZE = "LETTER";
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PDF_FONT_REGULAR = "MarketingTourOnePagerRegular";
const PDF_FONT_BOLD = "MarketingTourOnePagerBold";
const PDF_FONT_DISPLAY = "MarketingTourOnePagerDisplay";
const PDF_FONT_SCRIPT = "MarketingTourOnePagerScript";
const PDF_FONT_LABEL = "MarketingTourOnePagerLabel";
const IMAGE_RENDER_SCALE = 2.4;
const PUBLIC_TOUR_IMAGE_PREFIX = "/public/v1/tour-images/";

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
  surface: cssColorToHex(styleToken("surface"), "#ffffff"),
  surfaceMuted: cssColorToHex(styleToken("surface-muted"), "#f4f7f5"),
  surfaceSubtle: cssColorToHex(styleToken("surface-subtle"), "#f7faf8"),
  accent: cssColorToHex(styleToken("accent"), "#30796b"),
  accentSoft: cssColorToHex(styleToken("accent-soft"), "#ddede9"),
  accentText: cssColorToHex(styleToken("accent-text"), "#1f5f52"),
  secondary: cssColorToHex(styleToken("secondary"), "#1fa7a0"),
  text: cssColorToHex(styleToken("text"), "#1e2f3a"),
  textStrong: cssColorToHex(styleToken("text-strong"), "#152536"),
  textMuted: cssColorToHex(styleToken("muted"), "#5f7078"),
  line: cssColorToHex(styleToken("line-soft"), "#d8e1e8"),
  white: "#ffffff",
  cta: cssColorToHex(styleToken("accent"), "#30796b")
});

function pdfFontName(weight = "regular", fonts = null) {
  if (weight === "display" && fonts?.display) return PDF_FONT_DISPLAY;
  if (weight === "script" && fonts?.script) return PDF_FONT_SCRIPT;
  if (weight === "label" && fonts?.label) return PDF_FONT_LABEL;
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
  const [display, script, label] = await Promise.all([
    firstExistingPath(prioritizeAssetFonts(PDF_FONT_DISPLAY_CANDIDATES, assetDisplayCandidates)),
    firstExistingPath(prioritizeAssetFonts(PDF_FONT_SCRIPT_CANDIDATES, assetScriptCandidates)),
    firstExistingPath(prioritizeAssetFonts(PDF_FONT_LABEL_CANDIDATES, assetDisplayCandidates))
  ]);
  return { display, script, label };
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

function drawDestinationPinIcon(doc, x, y, size, color) {
  const centerX = x + size / 2;
  const topY = y + size * 0.2;
  doc.save();
  doc
    .circle(centerX, topY + size * 0.21, size * 0.18)
    .lineWidth(1.1)
    .strokeColor(color)
    .stroke();
  doc
    .moveTo(centerX - size * 0.22, topY + size * 0.35)
    .lineTo(centerX, y + size * 0.9)
    .lineTo(centerX + size * 0.22, topY + size * 0.35)
    .lineWidth(1.1)
    .lineJoin("round")
    .strokeColor(color)
    .stroke();
  doc.restore();
}

function drawBusIcon(doc, x, y, width, height, color) {
  const wheelRadius = height * 0.14;
  doc.save();
  doc.fillColor(COLORS.surfaceSubtle).roundedRect(x - 4, y - 4, width + 8, height + 9, 5).fill();
  doc
    .roundedRect(x, y + height * 0.18, width, height * 0.58, 2.4)
    .lineWidth(1.25)
    .strokeColor(color)
    .stroke();
  doc
    .moveTo(x + width * 0.1, y + height * 0.39)
    .lineTo(x + width * 0.9, y + height * 0.39)
    .moveTo(x + width * 0.17, y + height * 0.18)
    .lineTo(x + width * 0.17, y + height * 0.76)
    .moveTo(x + width * 0.77, y + height * 0.18)
    .lineTo(x + width * 0.77, y + height * 0.76)
    .lineWidth(0.9)
    .strokeColor(color)
    .stroke();
  doc
    .roundedRect(x + width * 0.24, y + height * 0.25, width * 0.22, height * 0.2, 1)
    .roundedRect(x + width * 0.5, y + height * 0.25, width * 0.21, height * 0.2, 1)
    .lineWidth(0.85)
    .strokeColor(color)
    .stroke();
  doc
    .moveTo(x + width * 0.2, y + height * 0.86)
    .lineTo(x + width * 0.8, y + height * 0.86)
    .lineWidth(1)
    .strokeColor(color)
    .stroke();
  [
    x + width * 0.27,
    x + width * 0.74
  ].forEach((wheelX) => {
    doc.circle(wheelX, y + height * 0.86, wheelRadius).fillColor(COLORS.surfaceSubtle).fill();
    doc.circle(wheelX, y + height * 0.86, wheelRadius).lineWidth(1).strokeColor(color).stroke();
  });
  doc.restore();
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

function drawRouteConnector(doc, x, y, width) {
  const color = COLORS.textStrong;
  drawDestinationPinIcon(doc, x + 4, y + 3, 22, color);
  drawDashedCurve(doc, [
    [x + 31, y + 18],
    [x + 70, y + 29],
    [x + 91, y + 5],
    [x + 125, y + 18],
    [x + 159, y + 31],
    [x + width - 82, y + 4],
    [x + width - 28, y + 18]
  ], color);
  drawBusIcon(doc, x + width / 2 - 22, y + 5, 44, 25, color);
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

function photoFrameShape(variant = 0) {
  const shapes = [
    [
      [0.03, 0.08],
      [0.99, 0],
      [0.96, 0.94],
      [0, 1]
    ],
    [
      [0, 0.03],
      [0.95, 0],
      [1, 0.96],
      [0.08, 1]
    ],
    [
      [0.07, 0],
      [1, 0.09],
      [0.93, 1],
      [0, 0.9]
    ]
  ];
  return shapes[Math.abs(Number(variant) || 0) % shapes.length];
}

function drawFramedImage(doc, { x, y, width, height, angle = 0, imageBuffer = null, label = "", fonts = null, lang = "en", variant = 0 } = {}) {
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

function fitTitleSize(doc, title, fonts) {
  let size = 56;
  while (size > 30) {
    doc.font(pdfFontName("display", fonts)).fontSize(size);
    if (doc.heightOfString(title, { width: 286, lineGap: -6 }) <= 124) return size;
    size -= 1;
  }
  return size;
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

function hasExplicitOnePagerBodyImageSelection(tour) {
  return Object.prototype.hasOwnProperty.call(tour?.travel_plan || {}, "one_pager_image_ids");
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
    drawHighlightIcon(doc, index, itemX + colWidth / 2 - 18, top, 36, COLORS.textStrong);
    doc
      .font(pdfFontName("label", fonts))
      .fontSize(7.8)
      .fillColor(COLORS.textStrong)
      .text(item.title.toUpperCase(), itemX, top + 45, { width: colWidth - 10, height: 20, align: "center", ellipsis: true });
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(7.5)
      .fillColor(COLORS.text)
      .text(item.body, itemX + 3, top + 68, { width: colWidth - 16, height: 25, align: "center", ellipsis: true });
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

function drawCta(doc, companyProfile, fonts, lang) {
  const x = 335;
  const y = 636;
  const width = 230;
  const height = 98;
  const usesDecorativeFonts = shouldUseOnePagerDecorativeFonts(lang);
  const scriptFontSize = usesDecorativeFonts ? 28 : 20;
  const scriptY = usesDecorativeFonts ? y + 35 : y + 41;
  const scriptWidth = usesDecorativeFonts ? 138 : 152;
  const scriptX = usesDecorativeFonts ? x + 75 : x + 66;
  doc.save();
  doc.roundedRect(x, y, width, height, 10).fill(COLORS.accentText);
  doc.roundedRect(x + 4, y + 4, width - 8, height - 8, 8).lineWidth(1.2).strokeColor(COLORS.white).stroke();
  doc
    .moveTo(x + 28, y + 31)
    .lineTo(x + 66, y + 17)
    .lineTo(x + 51, y + 54)
    .lineTo(x + 42, y + 38)
    .lineTo(x + 28, y + 31)
    .lineWidth(1.8)
    .strokeColor(COLORS.secondary)
    .stroke();
  doc.moveTo(x + 42, y + 38).lineTo(x + 66, y + 17).lineWidth(1.2).strokeColor(COLORS.secondary).stroke();
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(15)
    .fillColor(COLORS.white)
    .text(onePagerT(lang, "cta_plan", "Let's plan your"), x + 74, y + 18, { width: 136, align: "center" });
  doc
    .font(pdfFontName("script", fonts))
    .fontSize(scriptFontSize)
    .fillColor(COLORS.accentSoft)
    .text(onePagerT(lang, "cta_perfect_trip", "perfect trip!"), scriptX, scriptY, { width: scriptWidth, height: 24, align: "center", ellipsis: true });
  doc
    .roundedRect(x + 52, y + 70, width - 104, 20, 10)
    .fill(COLORS.secondary);
  doc
    .font(pdfFontName("label", fonts))
    .fontSize(8.8)
    .fillColor(COLORS.white)
    .text(onePagerT(lang, "cta_contact", "CONTACT US TODAY").toUpperCase(), x + 60, y + 75, { width: width - 120, align: "center" });
  doc.restore();
}

function drawFooter(doc, companyProfile, fonts) {
  const footerY = 747;
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
  const hasScriptProvidedEntries = entries.length > 0;
  if (!entries.length) {
    entries.push(...collectTourImages(tour, lang));
  }
  const useExactFrameCount = !hasScriptProvidedEntries && hasExplicitOnePagerBodyImageSelection(tour);
  const frames = [
    { width: 520, height: 270 },
    { width: 205, height: 130 },
    { width: 165, height: 108 },
    { width: 208, height: 132 },
    { width: 112, height: 82, optional: true }
  ];
  return await Promise.all(frames.map(async (frame, index) => {
    const entry = entries[index] || (useExactFrameCount || frame.optional ? null : entries[0]) || null;
    return {
      entry,
      buffer: entry
        ? await loadImageBuffer(entry.storagePath, {
          ...frame,
          resolveTourImageDiskPath: deps.resolveTourImageDiskPath,
          fallbackImagePath: deps.fallbackImagePath
        })
        : null
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
    .font(pdfFontName("script", fonts))
    .fontSize(48)
    .fillColor(COLORS.secondary)
    .text(onePagerT(lang, "trip_to", "Trip to"), 42, 126, pdfTextOptions(lang, { width: 250 }));
  const titleSize = fitTitleSize(doc, titleText, fonts);
  doc
    .font(pdfFontName("display", fonts))
    .fontSize(titleSize)
    .fillColor(COLORS.textStrong)
    .text(titleText, 42, 208, pdfTextOptions(lang, { width: 286, lineGap: -6, height: 124 }));
  doc
    .font(pdfFontName("label", fonts))
    .fontSize(12.5)
    .fillColor(COLORS.textStrong)
    .text(styleLine || onePagerT(lang, "default_style_line", "PRIVATE TOUR  |  LOCAL EXPERTISE").toUpperCase(), 42, 338, pdfTextOptions(lang, { width: 282, characterSpacing: 1.4, height: 18, ellipsis: true }));
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(10.6)
    .fillColor(COLORS.text)
    .text(description, 42, 368, pdfTextOptions(lang, { width: 265, height: 54, lineGap: 3, ellipsis: true }));
  doc.moveTo(42, 430).lineTo(78, 430).lineWidth(1).strokeColor(COLORS.secondary).stroke();
}

function drawHeroBackgroundImage(doc, imageBuffer) {
  const x = 118;
  const y = 54;
  const width = 466;
  const height = 274;
  const heroPoints = [
    [104, 58],
    [584, 56],
    [584, 257],
    [502, 290],
    [344, 282],
    [253, 230],
    [176, 145]
  ];
  doc.save();
  drawPolygonPath(doc, heroPoints);
  doc.clip();
  if (imageBuffer) {
    doc.image(imageBuffer, x, y, { width, height });
  } else {
    doc.rect(x, y, width, height).fill(COLORS.accentSoft);
  }
  doc.restore();

  doc.save();
  const leftFade = doc.linearGradient(72, 54, 380, 54)
    .stop(0, COLORS.surfaceSubtle, 1)
    .stop(0.45, COLORS.surfaceSubtle, 0.92)
    .stop(0.82, COLORS.surfaceSubtle, 0.24)
    .stop(1, COLORS.surfaceSubtle, 0);
  doc.rect(28, 52, 378, 284).fill(leftFade);
  doc.restore();

  doc.save();
  const bottomFade = doc.linearGradient(0, 220, 0, 340)
    .stop(0, COLORS.surfaceSubtle, 0)
    .stop(0.7, COLORS.surfaceSubtle, 0.82)
    .stop(1, COLORS.surfaceSubtle, 1);
  doc.rect(28, 218, PAGE_WIDTH - 56, 130).fill(bottomFade);
  doc.restore();
}

function drawBackground(doc, heroImageBuffer) {
  drawSoftRect(doc, 0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLORS.surface, 0);
  drawSoftRect(doc, 28, 28, PAGE_WIDTH - 56, PAGE_HEIGHT - 56, COLORS.surfaceSubtle, 0);
  drawHeroBackgroundImage(doc, heroImageBuffer);
}

export function createMarketingTourOnePagerPdfWriter({
  resolveTourImageDiskPath,
  logoPath = "",
  fallbackImagePath = "",
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

      drawBackground(doc, frameImages[0]?.buffer);
      drawLogo(doc, logoPath);
      drawDurationBadge(doc, duration, renderFonts);
      drawMainCopy(doc, tour, duration, renderFonts, normalizedLang);
      drawHighlights(doc, collectHighlightItems(tour, duration, normalizedLang), 42, 438, 276, renderFonts, normalizedLang);
      drawRouteConnector(doc, 43, 570, 238);
      drawIncluded(doc, collectIncludedItems(tour, duration, normalizedLang), 42, 616, 276, renderFonts, normalizedLang);

      if (frameImages[1]?.entry) {
        drawFramedImage(doc, {
          x: 352,
          y: 258,
          width: 198,
          height: 122,
          angle: -2.5,
          imageBuffer: frameImages[1]?.buffer,
          label: frameImages[1]?.entry?.label || "",
          fonts: renderFonts,
          lang: normalizedLang,
          variant: 0
        });
      }
      if (frameImages[2]?.entry) {
        drawFramedImage(doc, {
          x: 303,
          y: 405,
          width: 158,
          height: 102,
          angle: -4,
          imageBuffer: frameImages[2]?.buffer,
          label: frameImages[2]?.entry?.label || "",
          fonts: renderFonts,
          lang: normalizedLang,
          variant: 1
        });
      }
      if (frameImages[3]?.entry) {
        drawFramedImage(doc, {
          x: 364,
          y: 491,
          width: 190,
          height: 126,
          angle: 4,
          imageBuffer: frameImages[3]?.buffer,
          label: frameImages[3]?.entry?.label || "",
          fonts: renderFonts,
          lang: normalizedLang,
          variant: 2
        });
      }
      if (frameImages[4]?.entry) {
        drawFramedImage(doc, {
          x: 456,
          y: 394,
          width: 112,
          height: 82,
          angle: 5,
          imageBuffer: frameImages[4]?.buffer,
          label: frameImages[4]?.entry?.label || "",
          fonts: renderFonts,
          lang: normalizedLang,
          variant: 1
        });
      }
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
