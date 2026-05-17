import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { drawMarketingTourFramedImage } from "./marketing_tour_one_pager_pdf.js";
import { pdfImageFileExists, rasterizePdfImage } from "./pdf_image_cache.js";
import { normalizeText } from "./text.js";

const ITEM_THUMBNAIL_WIDTH = 118;
const ITEM_THUMBNAIL_HEIGHT = 88;
const ITEM_CARD_PADDING = 14;
const ITEM_COLUMN_GAP = 18;
const ITEM_VERTICAL_GAP = 6;
const DAY_HEADER_TOP_GAP = 18;
const BOUNDARY_DAY_HEADER_TOP_GAP = 10;
const BOUNDARY_DAY_HEADER_BOTTOM_GAP = 3;
const BOUNDARY_DAY_AFTER_GAP = 4;
const BOUNDARY_DAY_BEFORE_REGULAR_DAY_GAP = 8;
const IMAGE_CARD_MIN_HEIGHT = 92;
const IMAGE_CARD_MAX_HEIGHT = 118;
const IMAGE_PLACEMENT_LOOKAHEAD = 8;
const FLUID_TEXT_IMAGE_SERVICE_LIMIT = 2;
const TRAVEL_PLAN_IMAGE_FRAME_INSET = 8;
const TRAVEL_PLAN_IMAGE_FRAME_SHAPE_INTENSITY = 0.38;
const TRAVEL_PLAN_TRIP_LABEL_COLOR = "#F27A1A";
const BOUNDARY_ICON_COLOR = Object.freeze({ r: 242, g: 122, b: 26 });
const BOUNDARY_INLINE_ICON_WIDTH = 18;
const BOUNDARY_INLINE_ICON_HEIGHT = 10;
const BOUNDARY_INLINE_ICON_GAP = 6;
const BOUNDARY_INLINE_ICON_Y_OFFSET = Object.freeze({
  arrival: -3.2,
  departure: -1.7
});
const DEFAULT_THUMBNAIL_CONCURRENCY = 4;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function textOrNull(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function extractPublicRelativePath(publicUrl, prefix) {
  const normalizedUrl = normalizeText(publicUrl);
  if (!normalizedUrl) return null;
  if (!normalizedUrl.startsWith(prefix)) return null;
  return normalizedUrl.slice(prefix.length).replace(/^\/+/, "");
}

async function rasterizeImage(filePath, { width, height } = {}) {
  return rasterizePdfImage(filePath, { width, height, quality: 88 });
}

async function readTintedBoundaryIcon(filePath) {
  const sourceBuffer = await readFile(filePath).catch(() => null);
  if (!sourceBuffer) return null;
  const rawImage = await sharp(sourceBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .catch(() => null);
  if (!rawImage?.data || !rawImage?.info?.width || !rawImage?.info?.height) return sourceBuffer;
  const tinted = Buffer.from(rawImage.data);
  let minX = rawImage.info.width;
  let minY = rawImage.info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < rawImage.info.height; y += 1) {
    for (let x = 0; x < rawImage.info.width; x += 1) {
      const index = (y * rawImage.info.width + x) * 4;
      const alpha = tinted[index + 3];
      if (alpha === 0) continue;
      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      tinted[index] = BOUNDARY_ICON_COLOR.r;
      tinted[index + 1] = BOUNDARY_ICON_COLOR.g;
      tinted[index + 2] = BOUNDARY_ICON_COLOR.b;
    }
  }
  const icon = sharp(tinted, {
    raw: {
      width: rawImage.info.width,
      height: rawImage.info.height,
      channels: 4
    }
  });
  const croppedIcon = maxX >= minX && maxY >= minY
    ? icon.extract({
        left: minX,
        top: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
      })
    : icon;
  return croppedIcon
    .flop()
    .png()
    .toBuffer()
    .catch(() => sourceBuffer);
}

function itemHasExplicitImage(item) {
  return Boolean(
    item?.image && typeof item.image === "object" && !Array.isArray(item.image) && textOrNull(item.image.storage_path)
  ) || safeArray(item?.images).some((image) => image?.is_customer_visible !== false && textOrNull(image?.storage_path));
}

function isBoundaryLogisticsKind(value) {
  const boundaryKind = normalizeText(value).toLowerCase();
  return boundaryKind === "arrival" || boundaryKind === "departure";
}

export function resolveTravelPlanServiceThumbnailPath(item, bookingImagesDir, options = {}) {
  const candidate = item?.image && typeof item.image === "object" && !Array.isArray(item.image)
    ? item.image
    : safeArray(item?.images)
      .filter((image) => image?.is_customer_visible !== false)
      .find((image) => textOrNull(image?.storage_path));
  if (candidate) {
    const storagePath = String(candidate.storage_path || "");
    const publicBookingRelativePath = extractPublicRelativePath(storagePath, "/public/v1/booking-images/");
    if (publicBookingRelativePath && bookingImagesDir) return path.resolve(bookingImagesDir, publicBookingRelativePath);
    if (typeof options.resolveServiceImageDiskPath === "function") {
      const resolvedPath = options.resolveServiceImageDiskPath(storagePath, item);
      if (resolvedPath) return resolvedPath;
    }
    if (bookingImagesDir) {
      const relativePath = storagePath.replace(/^\/+/, "");
      if (relativePath) return path.resolve(bookingImagesDir, relativePath);
    }
  }

  const boundaryKind = normalizeText(item?.boundary_kind).toLowerCase();
  if (!isBoundaryLogisticsKind(boundaryKind)) return null;
  const boundaryLogisticsImagePaths = options.boundaryLogisticsImagePaths && typeof options.boundaryLogisticsImagePaths === "object" && !Array.isArray(options.boundaryLogisticsImagePaths)
    ? options.boundaryLogisticsImagePaths
    : {};
  return textOrNull(boundaryLogisticsImagePaths[boundaryKind]);
}

export async function buildTravelPlanItemThumbnailMap(plan, bookingImagesDir, options = {}) {
  const items = safeArray(plan?.days).flatMap((day) => safeArray(day?.services || day?.items));
  const concurrency = normalizeThumbnailConcurrency(options.thumbnailConcurrency || process.env.PDF_THUMBNAIL_CONCURRENCY);
  const entries = await mapWithConcurrency(items, concurrency, async (item) => {
    const thumbnailPath = resolveTravelPlanServiceThumbnailPath(item, bookingImagesDir, options);
    if (!thumbnailPath || !(await pdfImageFileExists(thumbnailPath))) return [item.id, null];
    const boundaryIcon = isBoundaryLogisticsKind(item?.boundary_kind) && !itemHasExplicitImage(item);
    const thumbnail = boundaryIcon
      ? { buffer: await readTintedBoundaryIcon(thumbnailPath) }
      : await rasterizeImage(thumbnailPath, {
          width: ITEM_THUMBNAIL_WIDTH * 3,
          height: ITEM_THUMBNAIL_HEIGHT * 3
        }).catch(() => null);
    return [item.id, thumbnail?.buffer
      ? {
          ...thumbnail,
          boundaryIcon
        }
      : null];
  });
  return new Map(entries.filter(([, thumbnail]) => thumbnail?.buffer));
}

function normalizeThumbnailConcurrency(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 12) : DEFAULT_THUMBNAIL_CONCURRENCY;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const source = Array.isArray(items) ? items : [];
  const results = new Array(source.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), source.length || 1);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < source.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(source[index], index);
    }
  }));
  return results;
}

function formatTravelPlanDate(rawValue, lang, formatPdfDateOnly) {
  const raw = normalizeText(rawValue);
  if (!raw) return "";
  return formatPdfDateOnly(raw, lang, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatTravelPlanDateTime(rawValue, lang, fallbackDayDate, formatPdfDateOnly) {
  const raw = normalizeText(rawValue);
  if (!raw) return "";
  const dateTimeMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (dateTimeMatch) {
    const [, datePart, timePart] = dateTimeMatch;
    if (fallbackDayDate && datePart === fallbackDayDate) return timePart;
    const formattedDate = formatTravelPlanDate(datePart, lang, formatPdfDateOnly);
    return formattedDate ? `${formattedDate} ${timePart}` : timePart;
  }
  const timeOnlyMatch = raw.match(/^(\d{2}:\d{2})$/);
  if (timeOnlyMatch) return timeOnlyMatch[1];
  return raw;
}

function formatTravelPlanDayDateLabel(day, lang, formatPdfDateOnly, pdfT) {
  const date = formatTravelPlanDate(day?.date, lang, formatPdfDateOnly);
  if (date) return date;
  const dateString = normalizeText(day?.date_string);
  if (!dateString) return "";
  if (dateString === "before_trip") {
    return pdfT(lang, "travel_plan.date_string.before_trip", "Before the trip");
  }
  if (dateString === "after_trip") {
    return pdfT(lang, "travel_plan.date_string.after_trip", "After the trip");
  }
  return dateString;
}

function formatTravelPlanTiming(item, lang, dayDate, formatPdfDateOnly) {
  const timingKind = normalizeText(item?.timing_kind) || "label";
  if (timingKind === "point") {
    return formatTravelPlanDateTime(item?.time_point, lang, dayDate, formatPdfDateOnly);
  }
  if (timingKind === "range") {
    const start = formatTravelPlanDateTime(item?.start_time, lang, dayDate, formatPdfDateOnly);
    const end = formatTravelPlanDateTime(item?.end_time, lang, dayDate, formatPdfDateOnly);
    if (start && end) return `${start} - ${end}`;
    return start || end || "";
  }
  return normalizeText(item?.time_label);
}

function resolveDayAccommodationTitle(day) {
  const accommodation = safeArray(day?.services || day?.items).find((item) => normalizeText(item?.kind).toLowerCase() === "accommodation");
  return textOrNull(accommodation?.title);
}

function dayLabelText(day, lang, pdfT) {
  const boundaryKind = boundaryPresentationDayKind(day);
  if (boundaryKind) {
    return pdfT(
      lang,
      `booking.travel_plan.${boundaryKind}`,
      boundaryKind === "departure" ? "Departure" : "Arrival"
    );
  }
  return pdfT(lang, "offer.day_label", "Day {day}", {
    day: Number(day?.day_number || 0) || 1
  });
}

function boundaryPresentationDayKind(day) {
  if (day?._presentation_source !== "boundary_logistics" && day?._presentation_boundary_day !== true) return "";
  const boundaryKind = normalizeText(day?.boundary_kind || safeArray(day?.services || day?.items)[0]?.boundary_kind).toLowerCase();
  return boundaryKind === "arrival" || boundaryKind === "departure" ? boundaryKind : "";
}

export function dayHeading(day, lang, pdfT) {
  const label = dayLabelText(day, lang, pdfT);
  const title = textOrNull(day?.title);
  return title ? `${label} - ${title}` : label;
}

function dayTitleText(day, lang, pdfT) {
  return textOrNull(day?.title) || dayLabelText(day, lang, pdfT);
}

function measureTextHeight(doc, text, { width, fontSize, fonts, weight = "regular", lineGap = 0, pdfFontName }) {
  if (!text) return 0;
  doc.font(pdfFontName(weight, fonts)).fontSize(fontSize);
  return doc.heightOfString(text, { width, lineGap });
}

function travelPlanImageFrameVariant(entry) {
  const seed = textOrNull(entry?.item?.id) || textOrNull(entry?.item?.title) || "travel-plan-image";
  return Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function boundaryInlineIcon(entry) {
  return entry?.kind === "service" && entry?.thumbnail?.boundaryIcon === true && entry.thumbnail?.buffer
    ? entry.thumbnail
    : null;
}

function serviceTextLayout(entry, contentWidth) {
  return {
    icon: null,
    textXOffset: 0,
    textWidth: contentWidth
  };
}

function imageBoxHeight(doc, entry, contentWidth, fonts, deps) {
  const innerWidth = contentWidth - ITEM_CARD_PADDING * 2;
  const naturalHeight = innerWidth * (ITEM_THUMBNAIL_HEIGHT / ITEM_THUMBNAIL_WIDTH);
  const baseHeight = ITEM_CARD_PADDING * 2 + Math.min(IMAGE_CARD_MAX_HEIGHT, Math.max(IMAGE_CARD_MIN_HEIGHT, naturalHeight));
  const subtitle = textOrNull(entry?.item?.image_subtitle);
  if (!subtitle) return baseHeight;
  return baseHeight + measureTextHeight(doc, subtitle, {
    width: innerWidth,
    fontSize: 9.2,
    fonts,
    lineGap: 1,
    pdfFontName: deps.pdfFontName
  }) + 8;
}

function itemBoxHeight(doc, item, fonts, lang, dayDate, contentWidth, deps, entry = null) {
  const { icon, textWidth } = serviceTextLayout(entry, contentWidth);
  const metaParts = [formatTravelPlanTiming(item, lang, dayDate, deps.formatPdfDateOnly)].filter(Boolean);
  const title = textOrNull(item?.title) || deps.pdfT(lang, "offer.item_fallback", "Planned service");
  const details = textOrNull(item?.details);
  let textHeight = 0;
  if (metaParts.length) {
    textHeight += measureTextHeight(doc, metaParts.join(" · "), { width: contentWidth, fontSize: 9.2, fonts, lineGap: 1, pdfFontName: deps.pdfFontName }) + 4;
  }
  textHeight += measureTextHeight(doc, title, { width: textWidth, fontSize: 11.2, fonts, weight: "bold", lineGap: 1, pdfFontName: deps.pdfFontName });
  if (details) {
    textHeight += 4 + measureTextHeight(doc, details, { width: textWidth, fontSize: 10.2, fonts, lineGap: 2, pdfFontName: deps.pdfFontName });
  }
  return Math.max(1, textHeight, icon ? BOUNDARY_INLINE_ICON_HEIGHT : 0);
}

function drawTravelPlanItemCard(doc, x, y, width, entry, fonts, lang, dayDate, deps) {
  if (entry?.kind === "image" && entry.thumbnail?.buffer) {
    const itemHeight = imageBoxHeight(doc, entry, width, fonts, deps);
    const subtitle = textOrNull(entry?.item?.image_subtitle);
    const subtitleHeight = subtitle
      ? measureTextHeight(doc, subtitle, {
        width: width - ITEM_CARD_PADDING * 2,
        fontSize: 9.2,
        fonts,
        lineGap: 1,
        pdfFontName: deps.pdfFontName
      })
      : 0;
    const imageHeight = itemHeight - subtitleHeight - (subtitle ? 8 : 0);
    const frameX = x + TRAVEL_PLAN_IMAGE_FRAME_INSET;
    const frameY = y + TRAVEL_PLAN_IMAGE_FRAME_INSET;
    const frameWidth = Math.max(1, width - TRAVEL_PLAN_IMAGE_FRAME_INSET * 2);
    const frameHeight = Math.max(1, imageHeight - TRAVEL_PLAN_IMAGE_FRAME_INSET * 2);
    drawMarketingTourFramedImage(doc, {
      x: frameX,
      y: frameY,
      width: frameWidth,
      height: frameHeight,
      imageBuffer: entry.thumbnail.buffer,
      variant: travelPlanImageFrameVariant(entry),
      labelLayer: false,
      shapeIntensity: TRAVEL_PLAN_IMAGE_FRAME_SHAPE_INTENSITY
    });

    if (subtitle) {
      doc
        .save()
        .translate(x + ITEM_CARD_PADDING, y + imageHeight + 8)
        .transform(1, 0, -0.16, 1, 0, 0)
        .font(deps.pdfFontName("regular", fonts))
        .fontSize(9.2)
        .fillColor(deps.colors.textMutedStrong)
        .text(subtitle, 0, 0, deps.pdfTextOptions(lang, {
          width: width - ITEM_CARD_PADDING * 2,
          align: "center",
          lineGap: 1
        }));
      doc.restore();
    }

    return itemHeight;
  }

  const item = entry?.item || entry;
  const itemHeight = itemBoxHeight(doc, item, fonts, lang, dayDate, width, deps, entry);
  const { icon, textXOffset, textWidth } = serviceTextLayout(entry, width);
  const titleX = x + textXOffset;
  let innerY = y;

  const metaParts = [formatTravelPlanTiming(item, lang, dayDate, deps.formatPdfDateOnly)].filter(Boolean);
  if (metaParts.length) {
    doc
      .font(deps.pdfFontName("regular", fonts))
      .fontSize(9.2)
      .fillColor(deps.colors.textMutedStrong)
      .text(metaParts.join(" · "), x, innerY, deps.pdfTextOptions(lang, {
        width,
        lineGap: 1
      }));
    innerY = doc.y + 4;
  }

  if (icon?.buffer) {
    doc.image(icon.buffer, x, innerY + 0.8, {
      fit: [BOUNDARY_INLINE_ICON_WIDTH, BOUNDARY_INLINE_ICON_HEIGHT],
      align: "center",
      valign: "center"
    });
  }

  doc
    .font(deps.pdfFontName("bold", fonts))
    .fontSize(11.2)
    .fillColor(deps.colors.textStrong)
    .text(textOrNull(item?.title) || deps.pdfT(lang, "offer.item_fallback", "Planned service"), titleX, innerY, deps.pdfTextOptions(lang, {
      width: textWidth,
      lineGap: 1
    }));

  const details = textOrNull(item?.details);
  if (details) {
    innerY = doc.y + 4;
    doc
      .font(deps.pdfFontName("regular", fonts))
      .fontSize(10.2)
      .fillColor(deps.colors.text)
      .text(details, titleX, innerY, deps.pdfTextOptions(lang, {
        width: textWidth,
        lineGap: 2
      }));
  }

  return itemHeight;
}

function buildTravelPlanDayLayoutEntries(day, itemThumbnailMap) {
  return safeArray(day?.services || day?.items).reduce((layout, item) => {
    const thumbnail = itemThumbnailMap.get(item?.id) || null;
    layout.services.push({ kind: "service", item, thumbnail: thumbnail?.boundaryIcon === true ? thumbnail : null });
    if (thumbnail?.buffer && thumbnail.boundaryIcon !== true) {
      layout.images.push({ kind: "image", item, thumbnail });
    }
    return layout;
  }, { services: [], images: [] });
}

function boundaryHeaderIconFromLayoutEntries(items) {
  return safeArray(items?.services)
    .map((entry) => boundaryInlineIcon(entry))
    .find((icon) => icon?.buffer) || null;
}

function boundaryHeaderIconY(doc, y, dayLabel, dayLabelOptions, fonts, deps, boundaryKind) {
  doc
    .font(deps.pdfFontName("bold", fonts))
    .fontSize(9.6);
  const labelHeight = doc.heightOfString(dayLabel, dayLabelOptions);
  return y + (labelHeight - BOUNDARY_INLINE_ICON_HEIGHT) / 2 + (BOUNDARY_INLINE_ICON_Y_OFFSET[boundaryKind] || 0);
}

function remainingTravelPlanLayoutItemCount(items) {
  return safeArray(items?.services).length + safeArray(items?.images).length;
}

function firstTravelPlanLayoutItem(items) {
  return safeArray(items?.services)[0] || safeArray(items?.images)[0] || null;
}

function entriesShareTravelPlanItem(firstEntry, secondEntry) {
  return firstEntry?.item === secondEntry?.item
    || (
      textOrNull(firstEntry?.item?.id)
      && textOrNull(firstEntry?.item?.id) === textOrNull(secondEntry?.item?.id)
    );
}

function findPairedImageIndex(images, serviceEntry, placedImageIndexes = new Set()) {
  return safeArray(images).findIndex((image, index) => (
    !placedImageIndexes.has(index)
    && entriesShareTravelPlanItem(image, serviceEntry)
  ));
}

function travelPlanTextStackHeight(textEntries) {
  return safeArray(textEntries).reduce((total, entry, index) => (
    total + (index ? ITEM_VERTICAL_GAP : 0) + entry.itemHeight
  ), 0);
}

function layoutTravelPlanFluidTextImagePair(doc, items, fonts, lang, dayDate, columnWidth, availableHeight, deps) {
  const services = safeArray(items?.services);
  const images = safeArray(items?.images);
  if (!services.length || !images.length) return null;

  const textEntries = services
    .slice(0, Math.min(FLUID_TEXT_IMAGE_SERVICE_LIMIT, services.length))
    .map((entry) => ({
      entry,
      itemHeight: itemBoxHeight(doc, entry.item, fonts, lang, dayDate, columnWidth, deps, entry)
    }));
  const pairedTextIndex = textEntries.reduce((matchedIndex, { entry }, index) => (
    findPairedImageIndex(images, entry) >= 0 ? index : matchedIndex
  ), -1);
  if (pairedTextIndex < 0) return null;

  const pairedImageIndex = findPairedImageIndex(images, textEntries[pairedTextIndex].entry);
  const imageEntry = images[pairedImageIndex];
  const imageHeight = imageBoxHeight(doc, imageEntry, columnWidth, fonts, deps);
  const textImages = [];
  let textHeight = travelPlanTextStackHeight(textEntries);
  const secondaryImageIndex = textEntries.reduce((matchedIndex, { entry }, index) => {
    if (index === pairedTextIndex) return matchedIndex;
    const candidateIndex = findPairedImageIndex(images, entry, new Set([pairedImageIndex]));
    return candidateIndex >= 0 && matchedIndex < 0 ? candidateIndex : matchedIndex;
  }, -1);
  if (secondaryImageIndex >= 0) {
    const secondaryImageEntry = images[secondaryImageIndex];
    const secondaryImageHeight = imageBoxHeight(doc, secondaryImageEntry, columnWidth, fonts, deps);
    const projectedTextHeight = textHeight + ITEM_VERTICAL_GAP + secondaryImageHeight;
    if (projectedTextHeight <= availableHeight) {
      textImages.push({
        entry: secondaryImageEntry,
        itemHeight: secondaryImageHeight
      });
      textHeight = projectedTextHeight;
    }
  }
  const layoutHeight = Math.max(textHeight, imageHeight);
  if (layoutHeight > availableHeight) return null;
  const placedImageIndexes = new Set([
    pairedImageIndex,
    ...(textImages.length ? [secondaryImageIndex] : [])
  ]);

  return {
    mode: "fluidTextImage",
    textEntries,
    textImages,
    imageEntry: {
      entry: imageEntry,
      itemHeight: imageHeight
    },
    imageColumn: "right",
    height: layoutHeight,
    rest: {
      services: services.slice(textEntries.length),
      images: images.filter((_, index) => !placedImageIndexes.has(index))
    }
  };
}

function layoutTravelPlanItemsForPage(doc, items, fonts, lang, dayDate, columnWidth, availableHeight, deps) {
  const fluidTextImageLayout = layoutTravelPlanFluidTextImagePair(doc, items, fonts, lang, dayDate, columnWidth, availableHeight, deps);
  if (fluidTextImageLayout) return fluidTextImageLayout;

  const columns = { left: [], right: [] };
  const heights = { left: 0, right: 0 };
  const services = safeArray(items?.services);
  const images = safeArray(items?.images);
  let serviceIndex = 0;
  const placedImageIndexes = new Set();

  function projectedHeight(key, itemHeight) {
    return heights[key] + (columns[key].length ? ITEM_VERTICAL_GAP : 0) + itemHeight;
  }

  function placeEntry(key, entry, itemHeight) {
    heights[key] = projectedHeight(key, itemHeight);
    columns[key].push({ entry, itemHeight });
  }

  function chooseColumn(itemHeight, preferredColumn = null) {
    const preferredKey = preferredColumn || (heights.left <= heights.right ? "left" : "right");
    const alternateKey = preferredKey === "left" ? "right" : "left";
    const fitsPreferred = projectedHeight(preferredKey, itemHeight) <= availableHeight;
    const fitsAlternate = projectedHeight(alternateKey, itemHeight) <= availableHeight;
    if (fitsPreferred) return preferredKey;
    if (fitsAlternate) return alternateKey;
    return null;
  }

  function bestImagePlacement() {
    let best = null;
    let candidateCount = 0;
    for (let index = 0; index < images.length; index += 1) {
      if (placedImageIndexes.has(index)) continue;
      candidateCount += 1;
      if (candidateCount > IMAGE_PLACEMENT_LOOKAHEAD) break;
      const entry = images[index];
      const itemHeight = imageBoxHeight(doc, entry, columnWidth, fonts, deps);
      for (const key of ["left", "right"]) {
        const projected = projectedHeight(key, itemHeight);
        if (projected > availableHeight) continue;
        const nextLeft = key === "left" ? projected : heights.left;
        const nextRight = key === "right" ? projected : heights.right;
        const layoutHeight = Math.max(nextLeft, nextRight);
        const balance = Math.abs(nextLeft - nextRight);
        const score = layoutHeight + balance * 0.35 + index * 2;
        if (!best || score < best.score) {
          best = { index, key, entry, itemHeight, score };
        }
      }
    }
    return best;
  }

  while (serviceIndex < services.length) {
    const entry = services[serviceIndex];
    const itemHeight = itemBoxHeight(doc, entry.item, fonts, lang, dayDate, columnWidth, deps, entry);
    const pairedImageIndex = findPairedImageIndex(images, entry, placedImageIndexes);
    const pairedImageHeight = pairedImageIndex >= 0
      ? imageBoxHeight(doc, images[pairedImageIndex], columnWidth, fonts, deps)
      : 0;
    const targetKey = chooseColumn(itemHeight);
    if (!targetKey) break;
    if (pairedImageIndex >= 0 && (columns.left.length || columns.right.length)) {
      const alternateKey = targetKey === "left" ? "right" : "left";
      const serviceProjectedHeight = projectedHeight(targetKey, itemHeight);
      const imageFitsSameColumn = serviceProjectedHeight + ITEM_VERTICAL_GAP + pairedImageHeight <= availableHeight;
      const imageFitsAlternateColumn = projectedHeight(alternateKey, pairedImageHeight) <= availableHeight;
      if (!imageFitsSameColumn && !imageFitsAlternateColumn) break;
    }

    placeEntry(targetKey, entry, itemHeight);
    serviceIndex += 1;

    if (pairedImageIndex >= 0) {
      const imageEntry = images[pairedImageIndex];
      const imageTargetKey = chooseColumn(pairedImageHeight, targetKey);
      if (imageTargetKey) {
        placeEntry(imageTargetKey, imageEntry, pairedImageHeight);
        placedImageIndexes.add(pairedImageIndex);
      }
    }
  }

  while (true) {
    const placement = bestImagePlacement();
    if (!placement) break;
    placeEntry(placement.key, placement.entry, placement.itemHeight);
    placedImageIndexes.add(placement.index);
  }

  return {
    mode: "columns",
    columns,
    height: Math.max(heights.left, heights.right, 0),
    rest: {
      services: services.slice(serviceIndex),
      images: images.filter((_, index) => !placedImageIndexes.has(index))
    }
  };
}

function countTravelPlanLayoutItems(layout) {
  if (!layout || typeof layout !== "object") return 0;
  if (layout.mode === "stack") return safeArray(layout.entries).length;
  if (layout.mode === "fluidTextImage") {
    return safeArray(layout.textEntries).length + safeArray(layout.textImages).length + (layout.imageEntry ? 1 : 0);
  }
  return safeArray(layout.columns?.left).length + safeArray(layout.columns?.right).length;
}

function layoutTravelPlanServiceForFullWidthPage(doc, items, fonts, lang, dayDate, contentWidth, availableHeight, deps) {
  const service = safeArray(items?.services)[0] || null;
  if (!service) {
    return {
      mode: "stack",
      entries: [],
      height: 0,
      rest: items
    };
  }
  const entries = [];
  const itemHeight = itemBoxHeight(doc, service.item, fonts, lang, dayDate, contentWidth, deps, service);
  if (itemHeight <= availableHeight) entries.push({ entry: service, itemHeight });

  return {
    mode: "stack",
    entries,
    height: entries.length ? itemHeight : 0,
    rest: {
      services: entries.length ? safeArray(items?.services).slice(1) : safeArray(items?.services),
      images: safeArray(items?.images)
    }
  };
}

function drawTravelPlanItemColumns(doc, startY, columnWidth, pageLayout, fonts, lang, dayDate, deps) {
  const leftX = deps.pageMargin;
  const rightX = deps.pageMargin + columnWidth + ITEM_COLUMN_GAP;
  let leftY = startY;
  let rightY = startY;

  for (const entry of pageLayout.columns.left) {
    drawTravelPlanItemCard(doc, leftX, leftY, columnWidth, entry.entry, fonts, lang, dayDate, deps);
    leftY += entry.itemHeight + ITEM_VERTICAL_GAP;
  }

  for (const entry of pageLayout.columns.right) {
    drawTravelPlanItemCard(doc, rightX, rightY, columnWidth, entry.entry, fonts, lang, dayDate, deps);
    rightY += entry.itemHeight + ITEM_VERTICAL_GAP;
  }
}

function drawTravelPlanFluidTextImagePair(doc, startY, columnWidth, pageLayout, fonts, lang, dayDate, deps) {
  const leftX = deps.pageMargin;
  const rightX = deps.pageMargin + columnWidth + ITEM_COLUMN_GAP;
  const textX = pageLayout.imageColumn === "left" ? rightX : leftX;
  const imageX = pageLayout.imageColumn === "left" ? leftX : rightX;
  let textY = startY;

  for (const entry of safeArray(pageLayout.textEntries)) {
    drawTravelPlanItemCard(doc, textX, textY, columnWidth, entry.entry, fonts, lang, dayDate, deps);
    textY += entry.itemHeight + ITEM_VERTICAL_GAP;
  }

  for (const entry of safeArray(pageLayout.textImages)) {
    drawTravelPlanItemCard(doc, textX, textY, columnWidth, entry.entry, fonts, lang, dayDate, deps);
    textY += entry.itemHeight + ITEM_VERTICAL_GAP;
  }

  if (pageLayout.imageEntry) {
    drawTravelPlanItemCard(doc, imageX, startY, columnWidth, pageLayout.imageEntry.entry, fonts, lang, dayDate, deps);
  }
}

function drawTravelPlanItemStack(doc, startY, contentWidth, pageLayout, fonts, lang, dayDate, deps) {
  let y = startY;
  for (const entry of safeArray(pageLayout.entries)) {
    drawTravelPlanItemCard(doc, deps.pageMargin, y, contentWidth, entry.entry, fonts, lang, dayDate, deps);
    y += entry.itemHeight + ITEM_VERTICAL_GAP;
  }
}

function drawTravelPlanDayHeader(doc, y, day, fonts, lang, deps, { compact = false, boundaryIcon = null } = {}) {
  const boundaryKind = boundaryPresentationDayKind(day);
  const dateLabel = boundaryKind ? "" : formatTravelPlanDayDateLabel(day, lang, deps.formatPdfDateOnly, deps.pdfT);
  const separateDayLabel = deps.separateDayLabel === true;
  const isBoundaryStandalone = boundaryKind && day?._presentation_boundary_day === true;
  const titleText = boundaryKind && day?._presentation_boundary_day === true && separateDayLabel
    ? ""
    : separateDayLabel
      ? dayTitleText(day, lang, deps.pdfT)
      : dayHeading(day, lang, deps.pdfT);
  const titleWidth = doc.page.width - deps.pageMargin * 2 - 150;
  const titleY = separateDayLabel ? y + 15 : y;
  const titleHeight = measureTextHeight(doc, titleText, {
    width: titleWidth,
    fontSize: 15,
    fonts,
    weight: "bold",
    pdfFontName: deps.pdfFontName
  });
  const dateHeight = dateLabel
    ? measureTextHeight(doc, dateLabel, {
      width: 140,
      fontSize: 10,
      fonts,
      pdfFontName: deps.pdfFontName
    })
    : 0;

  if (separateDayLabel) {
    const dayLabel = dayLabelText(day, lang, deps.pdfT).toUpperCase();
    const hasBoundaryIcon = isBoundaryStandalone && boundaryIcon?.buffer;
    const iconTrailsLabel = hasBoundaryIcon && boundaryKind === "departure";
    const labelOffset = hasBoundaryIcon && !iconTrailsLabel
      ? BOUNDARY_INLINE_ICON_WIDTH + BOUNDARY_INLINE_ICON_GAP
      : 0;
    const labelX = deps.pageMargin + labelOffset;
    const trailingIconOffset = iconTrailsLabel
      ? BOUNDARY_INLINE_ICON_WIDTH + BOUNDARY_INLINE_ICON_GAP
      : 0;
    const dayLabelOptions = deps.pdfTextOptions(lang, {
      width: Math.max(1, titleWidth - labelOffset - trailingIconOffset),
      characterSpacing: 0
    });
    if (hasBoundaryIcon) {
      doc
        .font(deps.pdfFontName("bold", fonts))
        .fontSize(9.6);
      const measuredLabelWidth = iconTrailsLabel
        ? Math.min(doc.widthOfString(dayLabel, dayLabelOptions), dayLabelOptions.width || titleWidth)
        : 0;
      const iconX = iconTrailsLabel
        ? labelX + measuredLabelWidth + BOUNDARY_INLINE_ICON_GAP
        : deps.pageMargin;
      doc.image(
        boundaryIcon.buffer,
        iconX,
        boundaryHeaderIconY(doc, y, dayLabel, dayLabelOptions, fonts, deps, boundaryKind),
        {
          fit: [BOUNDARY_INLINE_ICON_WIDTH, BOUNDARY_INLINE_ICON_HEIGHT],
          align: "center",
          valign: "center"
        }
      );
    }
    doc
      .font(deps.pdfFontName("bold", fonts))
      .fontSize(9.6)
      .fillColor(TRAVEL_PLAN_TRIP_LABEL_COLOR)
      .text(dayLabel, labelX, y, dayLabelOptions)
      .text(dayLabel, labelX + 0.28, y, dayLabelOptions);
  }

  if (isBoundaryStandalone && separateDayLabel && !titleText) {
    return doc.y + BOUNDARY_DAY_HEADER_BOTTOM_GAP;
  }

  if (titleText) {
    doc
      .font(deps.pdfFontName("bold", fonts))
      .fontSize(15)
      .fillColor(deps.colors.textStrong)
      .text(titleText, deps.pageMargin, titleY, deps.pdfTextOptions(lang, {
        width: titleWidth
      }));
  }
  if (dateLabel) {
    doc
      .font(deps.pdfFontName("regular", fonts))
      .fontSize(10)
      .fillColor(deps.colors.textMutedStrong)
      .text(dateLabel, doc.page.width - deps.pageMargin - 140, titleY + 2, {
        width: 140,
        align: "right"
      });
  }
  const titleBlockGap = separateDayLabel ? 8 : 4;
  let nextY = titleY + Math.max(titleHeight, dateHeight) + titleBlockGap;

  const accommodationTitle = resolveDayAccommodationTitle(day);
  if (accommodationTitle) {
    doc
      .font(deps.pdfFontName("regular", fonts))
      .fontSize(10)
      .fillColor(deps.colors.textMutedStrong)
      .text(
        deps.pdfT(lang, "travel_plan.accommodation_line", "You will stay at: {name}", { name: accommodationTitle }),
        deps.pageMargin,
        nextY,
        deps.pdfTextOptions(lang, {
          width: doc.page.width - deps.pageMargin * 2
        })
      );
    nextY = doc.y + 4;
  }

  if (!compact) {
    const dayNotes = textOrNull(day?.notes);
    if (dayNotes) {
      doc
        .font(deps.pdfFontName("regular", fonts))
        .fontSize(10.2)
        .fillColor(deps.colors.text)
        .text(dayNotes, deps.pageMargin, nextY, deps.pdfTextOptions(lang, {
          width: doc.page.width - deps.pageMargin * 2,
          lineGap: 2
        }));
      nextY = doc.y + 8;
    }
  }

  return nextY + (isBoundaryStandalone ? BOUNDARY_DAY_HEADER_BOTTOM_GAP : (Number(deps.dayHeaderBottomGap) || 0));
}

function drawEmptyState(doc, y, fonts, lang, deps) {
  doc
    .save()
    .roundedRect(deps.pageMargin, y, doc.page.width - deps.pageMargin * 2, 72, 14)
    .fill(deps.colors.surfaceMuted)
    .restore();
  doc
    .font(deps.pdfFontName("bold", fonts))
    .fontSize(13)
    .fillColor(deps.colors.textStrong)
    .text(deps.sectionTitle, deps.pageMargin + 18, y + 16, deps.pdfTextOptions(lang, {
      width: doc.page.width - deps.pageMargin * 2 - 36
    }));
  doc
    .font(deps.pdfFontName("regular", fonts))
    .fontSize(10.5)
    .fillColor(deps.colors.textMutedStrong)
    .text(deps.emptyStateMessage, deps.pageMargin + 18, y + 38, deps.pdfTextOptions(lang, {
      width: doc.page.width - deps.pageMargin * 2 - 36
    }));
  return y + 88;
}

export function drawTravelPlanDaysSection({
  doc,
  startY,
  plan,
  itemThumbnailMap = new Map(),
  fonts,
  lang,
  colors,
  pdfFontName,
  pdfTextOptions,
  pdfT,
  formatPdfDateOnly,
  pageMargin,
  bottomLimit,
  addContinuationPage,
  sectionTitle,
  emptyStateMessage,
  sectionTitleFontSize = 18,
  renderSectionTitle = true,
  sectionTitleUsesTripLabel = false,
  separateDayLabel = false,
  dayHeaderBottomGap = 4
}) {
  const deps = {
    colors,
    pdfFontName,
    pdfTextOptions,
    pdfT,
    formatPdfDateOnly,
    pageMargin,
    sectionTitle,
    emptyStateMessage,
    separateDayLabel,
    dayHeaderBottomGap
  };
  const ensureSpace = (currentY, requiredHeight) => (
    currentY + requiredHeight <= bottomLimit()
      ? currentY
      : addContinuationPage()
  );

  let y = startY;
  const days = safeArray(plan?.days);

  if (!days.length) {
    if (renderSectionTitle) {
      y = ensureSpace(y, 40 + 88);
      doc
        .font(sectionTitleUsesTripLabel ? pdfFontName("tripLabel", fonts) : pdfFontName("bold", fonts))
        .fontSize(sectionTitleUsesTripLabel ? 27 : sectionTitleFontSize)
        .fillColor(sectionTitleUsesTripLabel ? TRAVEL_PLAN_TRIP_LABEL_COLOR : colors.textStrong)
        .text(sectionTitle, pageMargin, y, pdfTextOptions(lang, {
          width: doc.page.width - pageMargin * 2
        }));
      y = doc.y + 10;
    } else {
      y = ensureSpace(y, 88);
    }
    y = ensureSpace(y, 88);
    return drawEmptyState(doc, y, fonts, lang, deps);
  }

  if (renderSectionTitle) {
    y = ensureSpace(y, 40 + 90);
    doc
      .font(sectionTitleUsesTripLabel ? pdfFontName("tripLabel", fonts) : pdfFontName("bold", fonts))
      .fontSize(sectionTitleUsesTripLabel ? 27 : sectionTitleFontSize)
      .fillColor(sectionTitleUsesTripLabel ? TRAVEL_PLAN_TRIP_LABEL_COLOR : colors.textStrong)
      .text(sectionTitle, pageMargin, y, pdfTextOptions(lang, {
        width: doc.page.width - pageMargin * 2
      }));
    y = doc.y + (sectionTitleUsesTripLabel ? 0 : 10);
  }

  let previousWasBoundaryDay = false;
  for (const day of days) {
    const isBoundaryDay = Boolean(boundaryPresentationDayKind(day));
    const contentWidth = doc.page.width - pageMargin * 2;
    const columnWidth = (contentWidth - ITEM_COLUMN_GAP) / 2;
    let remainingItems = buildTravelPlanDayLayoutEntries(day, itemThumbnailMap);
    const boundaryIcon = isBoundaryDay ? boundaryHeaderIconFromLayoutEntries(remainingItems) : null;
    const headerTopGap = isBoundaryDay
      ? BOUNDARY_DAY_HEADER_TOP_GAP
      : previousWasBoundaryDay
        ? BOUNDARY_DAY_BEFORE_REGULAR_DAY_GAP
        : DAY_HEADER_TOP_GAP;

    y = ensureSpace(y + headerTopGap, 90);
    y += headerTopGap;
    y = drawTravelPlanDayHeader(doc, y, day, fonts, lang, deps, { boundaryIcon });

    let continuationPageReady = false;

    while (remainingTravelPlanLayoutItemCount(remainingItems)) {
      const availableHeight = bottomLimit() - y;
      if (availableHeight < 96) {
        if (continuationPageReady) {
          const blockingEntry = firstTravelPlanLayoutItem(remainingItems);
          const blockingItemTitle = textOrNull(blockingEntry?.item?.title) || pdfT(lang, "offer.item_fallback", "Planned service");
          throw new Error(`Travel-plan service does not fit on a single page: ${blockingItemTitle}`);
        }
        y = addContinuationPage();
        continuationPageReady = true;
        continue;
      }
      let pageLayout = layoutTravelPlanItemsForPage(
        doc,
        remainingItems,
        fonts,
        lang,
        day?.date,
        columnWidth,
        availableHeight,
        deps
      );

      if (!countTravelPlanLayoutItems(pageLayout) && safeArray(remainingItems?.services).length) {
        pageLayout = layoutTravelPlanServiceForFullWidthPage(
          doc,
          remainingItems,
          fonts,
          lang,
          day?.date,
          contentWidth,
          availableHeight,
          deps
        );
      }

      if (!countTravelPlanLayoutItems(pageLayout)) {
        if (continuationPageReady) {
          const blockingEntry = firstTravelPlanLayoutItem(remainingItems);
          const blockingItemTitle = textOrNull(blockingEntry?.item?.title) || pdfT(lang, "offer.item_fallback", "Planned service");
          throw new Error(`Travel-plan service does not fit on a single page: ${blockingItemTitle}`);
        }
        y = addContinuationPage();
        continuationPageReady = true;
        continue;
      }

      if (pageLayout.mode === "stack") {
        drawTravelPlanItemStack(doc, y, contentWidth, pageLayout, fonts, lang, day?.date, deps);
      } else if (pageLayout.mode === "fluidTextImage") {
        drawTravelPlanFluidTextImagePair(doc, y, columnWidth, pageLayout, fonts, lang, day?.date, deps);
      } else {
        drawTravelPlanItemColumns(doc, y, columnWidth, pageLayout, fonts, lang, day?.date, deps);
      }
      y += pageLayout.height + (isBoundaryDay ? BOUNDARY_DAY_AFTER_GAP : 14);
      remainingItems = pageLayout.rest;
      continuationPageReady = false;
    }

    y += isBoundaryDay ? 0 : 6;
    previousWasBoundaryDay = isBoundaryDay;
  }

  return y;
}
