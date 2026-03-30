import { access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { normalizeText } from "./text.js";

const ITEM_THUMBNAIL_WIDTH = 118;
const ITEM_THUMBNAIL_HEIGHT = 88;
const ITEM_CARD_PADDING = 14;
const ITEM_COLUMN_GAP = 18;
const ITEM_VERTICAL_GAP = 8;

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

async function fileExists(filePath) {
  if (!filePath) return false;
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function rasterizeImage(filePath, { width, height } = {}) {
  if (!(await fileExists(filePath))) return null;
  const image = sharp(filePath, { failOn: "none" }).rotate();
  const metadata = await image.metadata().catch(() => ({}));
  const resized = image.resize({
    width: width || null,
    height: height || null,
    fit: "cover",
    position: "centre",
    withoutEnlargement: false
  });
  const buffer = await resized.jpeg({ quality: 88 }).toBuffer();
  return {
    buffer,
    width: width || metadata.width || 1,
    height: height || metadata.height || 1
  };
}

export function resolveTravelPlanServiceThumbnailPath(item, bookingImagesDir) {
  if (!bookingImagesDir) return null;
  const candidate = item?.image && typeof item.image === "object" && !Array.isArray(item.image)
    ? item.image
    : safeArray(item?.images)
      .filter((image) => image?.is_customer_visible !== false)
      .find((image) => textOrNull(image?.storage_path));
  if (!candidate) return null;
  const storagePath = String(candidate.storage_path || "");
  const publicRelativePath = extractPublicRelativePath(storagePath, "/public/v1/booking-images/");
  const relativePath = publicRelativePath || storagePath.replace(/^\/+/, "");
  return relativePath ? path.resolve(bookingImagesDir, relativePath) : null;
}

export async function buildTravelPlanItemThumbnailMap(plan, bookingImagesDir) {
  const items = safeArray(plan?.days).flatMap((day) => safeArray(day?.services || day?.items));
  const entries = await Promise.all(items.map(async (item) => {
    const thumbnailPath = resolveTravelPlanServiceThumbnailPath(item, bookingImagesDir);
    if (!thumbnailPath || !(await fileExists(thumbnailPath))) return [item.id, null];
    const thumbnail = await rasterizeImage(thumbnailPath, {
      width: ITEM_THUMBNAIL_WIDTH * 3,
      height: ITEM_THUMBNAIL_HEIGHT * 3
    }).catch(() => null);
    return [item.id, thumbnail];
  }));
  return new Map(entries.filter(([, thumbnail]) => thumbnail?.buffer));
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

export function dayHeading(day, lang, pdfT) {
  const label = pdfT(lang, "offer.day_label", "Day {day}", {
    day: Number(day?.day_number || 0) || 1
  });
  const title = textOrNull(day?.title);
  return title ? `${label} - ${title}` : label;
}

function measureTextHeight(doc, text, { width, fontSize, fonts, weight = "regular", lineGap = 0, pdfFontName }) {
  if (!text) return 0;
  doc.font(pdfFontName(weight, fonts)).fontSize(fontSize);
  return doc.heightOfString(text, { width, lineGap });
}

function itemBoxHeight(doc, item, fonts, lang, dayDate, contentWidth, hasThumbnail, deps) {
  const innerWidth = contentWidth - ITEM_CARD_PADDING * 2;
  const textWidth = innerWidth;
  const metaParts = [textOrNull(item?.location), formatTravelPlanTiming(item, lang, dayDate, deps.formatPdfDateOnly)].filter(Boolean);
  const title = textOrNull(item?.title) || deps.pdfT(lang, "offer.item_fallback", "Planned service");
  const details = textOrNull(item?.details);
  let textHeight = 0;
  if (metaParts.length) {
    textHeight += measureTextHeight(doc, metaParts.join(" · "), { width: textWidth, fontSize: 9.2, fonts, lineGap: 1, pdfFontName: deps.pdfFontName }) + 4;
  }
  textHeight += measureTextHeight(doc, title, { width: textWidth, fontSize: 11.2, fonts, weight: "bold", lineGap: 1, pdfFontName: deps.pdfFontName }) + 4;
  if (details) {
    textHeight += measureTextHeight(doc, details, { width: textWidth, fontSize: 10.2, fonts, lineGap: 2, pdfFontName: deps.pdfFontName }) + 4;
  }
  const thumbnailHeight = hasThumbnail ? ITEM_THUMBNAIL_HEIGHT + 10 : 0;
  return Math.max(88, ITEM_CARD_PADDING + thumbnailHeight + textHeight + ITEM_CARD_PADDING);
}

function drawTravelPlanItemCard(doc, x, y, width, item, thumbnail, fonts, lang, dayDate, deps) {
  const itemHeight = itemBoxHeight(doc, item, fonts, lang, dayDate, width, Boolean(thumbnail), deps);
  doc
    .save()
    .roundedRect(x, y, width, itemHeight, 12)
    .fill(deps.colors.surfaceSubtle)
    .restore();

  const innerX = x + ITEM_CARD_PADDING;
  const innerWidth = width - ITEM_CARD_PADDING * 2;
  const textWidth = innerWidth;
  let innerY = y + ITEM_CARD_PADDING;

  if (thumbnail?.buffer) {
    doc
      .save()
      .roundedRect(innerX, innerY, innerWidth, ITEM_THUMBNAIL_HEIGHT, 10)
      .clip();
    doc.image(thumbnail.buffer, innerX, innerY, {
      fit: [innerWidth, ITEM_THUMBNAIL_HEIGHT],
      align: "center",
      valign: "center"
    });
    doc.restore();
    innerY += ITEM_THUMBNAIL_HEIGHT + 10;
  }

  const metaParts = [textOrNull(item?.location), formatTravelPlanTiming(item, lang, dayDate, deps.formatPdfDateOnly)].filter(Boolean);
  if (metaParts.length) {
    doc
      .font(deps.pdfFontName("regular", fonts))
      .fontSize(9.2)
      .fillColor(deps.colors.textMutedStrong)
      .text(metaParts.join(" · "), innerX, innerY, deps.pdfTextOptions(lang, {
        width: textWidth,
        lineGap: 1
      }));
    innerY = doc.y + 4;
  }

  doc
    .font(deps.pdfFontName("bold", fonts))
    .fontSize(11.2)
    .fillColor(deps.colors.textStrong)
    .text(textOrNull(item?.title) || deps.pdfT(lang, "offer.item_fallback", "Planned service"), innerX, innerY, deps.pdfTextOptions(lang, {
      width: textWidth,
      lineGap: 1
    }));
  innerY = doc.y + 4;

  const details = textOrNull(item?.details);
  if (details) {
    doc
      .font(deps.pdfFontName("regular", fonts))
      .fontSize(10.2)
      .fillColor(deps.colors.text)
      .text(details, innerX, innerY, deps.pdfTextOptions(lang, {
        width: textWidth,
        lineGap: 2
      }));
  }

  return itemHeight;
}

function layoutTravelPlanItemsForPage(doc, items, itemThumbnailMap, fonts, lang, dayDate, columnWidth, availableHeight, deps) {
  const columns = { left: [], right: [] };
  const heights = { left: 0, right: 0 };
  let index = 0;

  function projectedHeight(key, itemHeight) {
    return heights[key] + (columns[key].length ? ITEM_VERTICAL_GAP : 0) + itemHeight;
  }

  while (index < items.length) {
    const item = items[index];
    const thumbnail = itemThumbnailMap.get(item?.id) || null;
    const itemHeight = itemBoxHeight(doc, item, fonts, lang, dayDate, columnWidth, Boolean(thumbnail), deps);
    const preferredKey = heights.left <= heights.right ? "left" : "right";
    const alternateKey = preferredKey === "left" ? "right" : "left";
    const fitsPreferred = projectedHeight(preferredKey, itemHeight) <= availableHeight;
    const fitsAlternate = projectedHeight(alternateKey, itemHeight) <= availableHeight;
    let targetKey = null;

    if (fitsPreferred || (!columns.left.length && !columns.right.length)) {
      targetKey = preferredKey;
    } else if (fitsAlternate) {
      targetKey = alternateKey;
    } else {
      break;
    }

    heights[targetKey] = projectedHeight(targetKey, itemHeight);
    columns[targetKey].push({ item, thumbnail, itemHeight });
    index += 1;
  }

  return {
    columns,
    height: Math.max(heights.left, heights.right, 0),
    rest: items.slice(index)
  };
}

function drawTravelPlanItemColumns(doc, startY, columnWidth, pageLayout, fonts, lang, dayDate, deps) {
  const leftX = deps.pageMargin;
  const rightX = deps.pageMargin + columnWidth + ITEM_COLUMN_GAP;
  let leftY = startY;
  let rightY = startY;

  for (const entry of pageLayout.columns.left) {
    drawTravelPlanItemCard(doc, leftX, leftY, columnWidth, entry.item, entry.thumbnail, fonts, lang, dayDate, deps);
    leftY += entry.itemHeight + ITEM_VERTICAL_GAP;
  }

  for (const entry of pageLayout.columns.right) {
    drawTravelPlanItemCard(doc, rightX, rightY, columnWidth, entry.item, entry.thumbnail, fonts, lang, dayDate, deps);
    rightY += entry.itemHeight + ITEM_VERTICAL_GAP;
  }
}

function drawTravelPlanDayHeader(doc, y, day, fonts, lang, deps, { compact = false } = {}) {
  const dateLabel = formatTravelPlanDate(day?.date, lang, deps.formatPdfDateOnly);
  doc
    .font(deps.pdfFontName("bold", fonts))
    .fontSize(15)
    .fillColor(deps.colors.textStrong)
    .text(dayHeading(day, lang, deps.pdfT), deps.pageMargin, y, deps.pdfTextOptions(lang, {
      width: doc.page.width - deps.pageMargin * 2 - 150
    }));
  if (dateLabel) {
    doc
      .font(deps.pdfFontName("regular", fonts))
      .fontSize(10)
      .fillColor(deps.colors.textMutedStrong)
      .text(dateLabel, doc.page.width - deps.pageMargin - 140, y + 2, {
        width: 140,
        align: "right"
      });
  }
  let nextY = doc.y + 4;

  const overnight = textOrNull(day?.overnight_location);
  if (overnight) {
    doc
      .font(deps.pdfFontName("regular", fonts))
      .fontSize(10)
      .fillColor(deps.colors.textMutedStrong)
      .text(deps.pdfT(lang, "offer.overnight", "Overnight: {location}", { location: overnight }), deps.pageMargin, nextY, deps.pdfTextOptions(lang, {
        width: doc.page.width - deps.pageMargin * 2
      }));
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

  return nextY;
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
  renderSectionTitle = true
}) {
  const deps = {
    colors,
    pdfFontName,
    pdfTextOptions,
    pdfT,
    formatPdfDateOnly,
    pageMargin,
    sectionTitle,
    emptyStateMessage
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
        .font(pdfFontName("bold", fonts))
        .fontSize(sectionTitleFontSize)
        .fillColor(colors.textStrong)
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
      .font(pdfFontName("bold", fonts))
      .fontSize(sectionTitleFontSize)
      .fillColor(colors.textStrong)
      .text(sectionTitle, pageMargin, y, pdfTextOptions(lang, {
        width: doc.page.width - pageMargin * 2
      }));
    y = doc.y + 10;
  }

  for (const day of days) {
    y = ensureSpace(y, 90);
    y = drawTravelPlanDayHeader(doc, y, day, fonts, lang, deps);

    const contentWidth = doc.page.width - pageMargin * 2;
    const columnWidth = (contentWidth - ITEM_COLUMN_GAP) / 2;
    let remainingItems = safeArray(day?.services || day?.items);
    let compactHeader = true;

    while (remainingItems.length) {
      const availableHeight = Math.max(96, bottomLimit() - y);
      const pageLayout = layoutTravelPlanItemsForPage(
        doc,
        remainingItems,
        itemThumbnailMap,
        fonts,
        lang,
        day?.date,
        columnWidth,
        availableHeight,
        deps
      );

      if (!pageLayout.columns.left.length && !pageLayout.columns.right.length) {
        break;
      }

      drawTravelPlanItemColumns(doc, y, columnWidth, pageLayout, fonts, lang, day?.date, deps);
      y += pageLayout.height + 14;
      remainingItems = pageLayout.rest;

      if (remainingItems.length) {
        y = addContinuationPage();
        y = drawTravelPlanDayHeader(doc, y, day, fonts, lang, deps, { compact: compactHeader });
      }
    }

    y += 6;
  }

  return y;
}
