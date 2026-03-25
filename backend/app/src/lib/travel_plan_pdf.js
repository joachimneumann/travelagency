import { createWriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import {
  formatPdfDateOnly,
  pdfTextAlign,
  pdfTextOptions,
  normalizePdfLang,
  pdfT
} from "./pdf_i18n.js";
import {
  appendPdfAttachmentsToFile,
  trimTrailingBlankPagesInFile,
  resolveTravelPlanAttachmentAbsolutePath
} from "./pdf_attachments.js";
import { pdfTheme } from "./style_tokens.js";
import { normalizeText } from "./text.js";
import { resolveLocalizedText } from "../domain/booking_content_i18n.js";
import {
  resolveAtpGuideIntroName,
  resolveAtpGuidePdfContext,
  resolveAtpGuideQualificationText,
  resolveAtpStaffFriendlyShortName,
  resolveAtpStaffFullName
} from "./atp_staff_pdf.js";

const MM_TO_POINTS = 72 / 25.4;
// PDFKit's built-in "A4" preset rounds the page box and some viewers display it as
// 21.01 x 29.71 cm. Use the exact A4 dimensions in points instead.
const PAGE_SIZE = Object.freeze([210 * MM_TO_POINTS, 297 * MM_TO_POINTS]);
const PAGE_MARGIN = 44;
const PAGE_FOOTER_GAP = 28;
const HEADER_LOGO_WIDTH = 190;
const HEADER_LOGO_HEIGHT = 74;
const HERO_IMAGE_WIDTH = 195;
const HERO_IMAGE_HEIGHT = 128;
const ITEM_THUMBNAIL_WIDTH = 118;
const ITEM_THUMBNAIL_HEIGHT = 88;
const ITEM_CARD_PADDING = 14;
const ITEM_COLUMN_GAP = 18;
const ITEM_VERTICAL_GAP = 8;
const GUIDE_PHOTO_SIZE = 92;
const PDF_FONT_REGULAR = "ATPUnicodeRegular";
const PDF_FONT_BOLD = "ATPUnicodeBold";

const PDF_FONT_REGULAR_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/System/Library/Fonts/Hiragino Sans GB.ttc",
  "/System/Library/Fonts/Supplemental/Songti.ttc",
  "/System/Library/Fonts/AppleSDGothicNeo.ttc",
  "/System/Library/Fonts/STHeiti Light.ttc",
  "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
  "/Library/Fonts/Arial Unicode.ttf",
  "/usr/share/fonts/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
];

const PDF_FONT_BOLD_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/System/Library/Fonts/AppleSDGothicNeo.ttc",
  "/System/Library/Fonts/STHeiti Medium.ttc",
  "/System/Library/Fonts/Hiragino Sans GB.ttc",
  "/System/Library/Fonts/Supplemental/Songti.ttc",
  "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
  "/Library/Fonts/Arial Unicode.ttf",
  "/usr/share/fonts/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/opentype/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
];

const PDF_COLORS = Object.freeze({
  surface: pdfTheme.surface,
  surfaceMuted: pdfTheme.surfaceMuted,
  surfaceSubtle: pdfTheme.surfaceSubtle,
  surfaceSuccess: pdfTheme.surfaceSuccess,
  line: pdfTheme.line,
  text: pdfTheme.text,
  textStrong: pdfTheme.textStrong,
  textMuted: pdfTheme.textMuted,
  textMutedStrong: pdfTheme.textMutedStrong
});

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

function drawDivider(doc, y) {
  doc
    .save()
    .moveTo(PAGE_MARGIN, y)
    .lineTo(doc.page.width - PAGE_MARGIN, y)
    .lineWidth(1)
    .strokeColor(PDF_COLORS.line)
    .stroke()
    .restore();
}

function drawRoundedTag(doc, x, y, width, height, text, options = {}, fonts = null) {
  const fillColor = options.fillColor || PDF_COLORS.surfaceMuted;
  const textColor = options.textColor || PDF_COLORS.textMutedStrong;
  doc
    .save()
    .roundedRect(x, y, width, height, 9)
    .fill(fillColor)
    .restore();
  doc
    .fillColor(textColor)
    .font(pdfFontName("bold", fonts))
    .fontSize(10)
    .text(text, x, y + 5, { width, align: "center" });
}

function itemKindLabel(kind, lang) {
  const normalizedKind = normalizeText(kind).toLowerCase();
  if (!normalizedKind) return "";
  const fallback = normalizedKind
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return pdfT(lang, `offer.item.${normalizedKind}`, fallback);
}

function safeBookingTitle(booking, lang) {
  return textOrNull(booking?.name) || pdfT(lang, "offer.travel_plan_title", "Travel plan overview");
}

function travelPlanSectionTitle(lang) {
  return pdfT(lang, "travel_plan.pdf_subtitle", "Travel plan overview");
}

function resolveTravelPlanAttachmentPaths(travelPlan, travelPlanAttachmentsDir) {
  return (Array.isArray(travelPlan?.attachments) ? travelPlan.attachments : [])
    .slice()
    .sort((left, right) => Number(left?.sort_order || 0) - Number(right?.sort_order || 0))
    .map((attachment) => {
      const absolutePath = resolveTravelPlanAttachmentAbsolutePath(travelPlanAttachmentsDir, attachment?.storage_path);
      if (!absolutePath) {
        throw new Error(`Invalid travel-plan attachment path for ${String(attachment?.filename || attachment?.id || "attachment")}.`);
      }
      return absolutePath;
    });
}

function formatTravelPlanDate(rawValue, lang) {
  const raw = normalizeText(rawValue);
  if (!raw) return "";
  return formatPdfDateOnly(raw, lang, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatTravelPlanDateTime(rawValue, lang, fallbackDayDate = "") {
  const raw = normalizeText(rawValue);
  if (!raw) return "";
  const dateTimeMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (dateTimeMatch) {
    const [, datePart, timePart] = dateTimeMatch;
    if (fallbackDayDate && datePart === fallbackDayDate) return timePart;
    const formattedDate = formatTravelPlanDate(datePart, lang);
    return formattedDate ? `${formattedDate} ${timePart}` : timePart;
  }
  const timeOnlyMatch = raw.match(/^(\d{2}:\d{2})$/);
  if (timeOnlyMatch) return timeOnlyMatch[1];
  return raw;
}

function formatTravelPlanTiming(item, lang, dayDate = "") {
  const timingKind = normalizeText(item?.timing_kind) || "label";
  if (timingKind === "point") {
    return formatTravelPlanDateTime(item?.time_point, lang, dayDate);
  }
  if (timingKind === "range") {
    const start = formatTravelPlanDateTime(item?.start_time, lang, dayDate);
    const end = formatTravelPlanDateTime(item?.end_time, lang, dayDate);
    if (start && end) return `${start} - ${end}`;
    return start || end || "";
  }
  return normalizeText(item?.time_label);
}

function dayHeading(day, lang) {
  const label = pdfT(lang, "offer.day_label", "Day {day}", {
    day: Number(day?.day_number || 0) || 1
  });
  const title = textOrNull(day?.title);
  return title ? `${label} - ${title}` : label;
}

function measureTextHeight(doc, text, { width, fontSize, fonts, weight = "regular", lineGap = 0 }) {
  if (!text) return 0;
  doc.font(pdfFontName(weight, fonts)).fontSize(fontSize);
  return doc.heightOfString(text, { width, lineGap });
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

async function findFirstExistingPath(paths) {
  for (const candidate of paths) {
    if (await fileExists(candidate)) return candidate;
  }
  return null;
}

async function resolvePdfFonts() {
  const regular = await findFirstExistingPath(PDF_FONT_REGULAR_CANDIDATES);
  const bold = (await findFirstExistingPath(PDF_FONT_BOLD_CANDIDATES)) || regular;
  return { regular, bold };
}

function registerPdfFonts(doc, fonts) {
  if (fonts?.regular) doc.registerFont(PDF_FONT_REGULAR, fonts.regular);
  if (fonts?.bold) doc.registerFont(PDF_FONT_BOLD, fonts.bold);
}

function pdfFontName(weight = "regular", fonts = null) {
  if (!fonts?.regular) return weight === "bold" ? "Helvetica-Bold" : "Helvetica";
  if (weight === "bold" && fonts?.bold) return PDF_FONT_BOLD;
  return PDF_FONT_REGULAR;
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

async function resolveBookingHeroTitle(booking, lang, readTours) {
  const explicitTitle = textOrNull(booking?.name);
  const submittedTitle = textOrNull(booking?.web_form_submission?.booking_name);
  const tourId = textOrNull(booking?.web_form_submission?.tour_id);
  if (tourId && typeof readTours === "function") {
    const tours = await readTours().catch(() => []);
    const tour = safeArray(tours).find((item) => textOrNull(item?.id) === tourId);
    const localizedTourTitle = textOrNull(resolveLocalizedText(tour?.title, normalizePdfLang(lang), ""));
    const englishTourTitle = textOrNull(resolveLocalizedText(tour?.title, "en", ""));
    const explicitMatchesSourceTour = explicitTitle && englishTourTitle && explicitTitle === englishTourTitle;
    const submittedMatchesSourceTour = submittedTitle && englishTourTitle && submittedTitle === englishTourTitle;
    if (localizedTourTitle) {
      if (!explicitTitle && !submittedTitle) return localizedTourTitle;
      if (!explicitTitle && submittedMatchesSourceTour) return localizedTourTitle;
      if (explicitMatchesSourceTour) return localizedTourTitle;
    }
  }
  return explicitTitle || submittedTitle || pdfT(lang, "offer.travel_plan_title", "Travel plan overview");
}

async function resolveBookingImageForPdf({ booking, bookingImagesDir, readTours, resolveTourImageDiskPath }) {
  const bookingImageRelative = extractPublicRelativePath(booking?.image, "/public/v1/booking-images/");
  if (bookingImageRelative && bookingImagesDir) {
    const bookingImageAbsolute = path.resolve(bookingImagesDir, bookingImageRelative);
    if (await fileExists(bookingImageAbsolute)) return bookingImageAbsolute;
  }

  const tourId = textOrNull(booking?.web_form_submission?.tour_id);
  if (tourId && typeof readTours === "function" && typeof resolveTourImageDiskPath === "function") {
    const tours = await readTours().catch(() => []);
    const tour = safeArray(tours).find((item) => normalizeText(item?.id) === tourId);
    const tourImageRelative = extractPublicRelativePath(tour?.image, "/public/v1/tour-images/");
    if (tourImageRelative) {
      const tourImageAbsolute = resolveTourImageDiskPath(tourImageRelative);
      if (await fileExists(tourImageAbsolute)) return tourImageAbsolute;
    }
  }

  return null;
}

export function resolveTravelPlanServiceThumbnailPath(item, bookingImagesDir) {
  if (!bookingImagesDir) return null;
  const candidate = safeArray(item?.images)
    .filter((image) => image?.is_customer_visible !== false)
    .find((image) => textOrNull(image?.storage_path));
  if (!candidate) return null;
  const storagePath = String(candidate.storage_path || "");
  const publicRelativePath = extractPublicRelativePath(storagePath, "/public/v1/booking-images/");
  const relativePath = publicRelativePath || storagePath.replace(/^\/+/, "");
  return relativePath ? path.resolve(bookingImagesDir, relativePath) : null;
}

async function buildItemThumbnailMap(plan, bookingImagesDir) {
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

function footerText(companyProfile, lang) {
  if (companyProfile) {
    return [
      companyProfile.name,
      companyProfile.website,
      companyProfile.email,
      companyProfile.whatsapp
    ].filter(Boolean).join(" · ");
  }
  return pdfT(lang, "invoice.footer", "Issued by Asia Travel Plan");
}

function drawFooter(doc, fonts, companyProfile, lang) {
  drawDivider(doc, doc.page.height - PAGE_MARGIN - 12);
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(8.5)
    .fillColor(PDF_COLORS.textMuted)
    .text(
      footerText(companyProfile, lang),
      PAGE_MARGIN,
      doc.page.height - PAGE_MARGIN,
      { width: doc.page.width - PAGE_MARGIN * 2, align: "center" }
    );
}

function drawTopHeader(doc, companyProfile, logoImage, fonts, lang) {
  const profile = companyProfile || {};
  let y = PAGE_MARGIN;
  if (logoImage?.buffer) {
    doc.image(logoImage.buffer, PAGE_MARGIN, y + 2, {
      fit: [HEADER_LOGO_WIDTH, HEADER_LOGO_HEIGHT],
      align: "left",
      valign: "top"
    });
  }

  const rightColumnX = doc.page.width - PAGE_MARGIN - 220;
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(13)
    .fillColor(PDF_COLORS.textStrong)
    .text(profile.name || "Asia Travel Plan", rightColumnX, y, { width: 220, align: "right" });
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(10)
    .fillColor(PDF_COLORS.textMuted)
    .text(profile.address || "", rightColumnX, y + 18, { width: 220, align: "right" })
    .text(`${pdfT(lang, "header.whatsapp", "WhatsApp")}: ${profile.whatsapp || ""}`, rightColumnX, y + 50, { width: 220, align: "right" })
    .text(`${pdfT(lang, "header.email", "Email")}: ${profile.email || ""}`, rightColumnX, y + 66, { width: 220, align: "right" })
    .text(profile.website || "", rightColumnX, y + 82, { width: 220, align: "right" });

  const nextY = y + 106;
  drawDivider(doc, nextY);
  return nextY + 18;
}

function drawTravelPlanHero(doc, heroTitle, heroImage, startY, fonts, lang) {
  const detailsX = PAGE_MARGIN + HERO_IMAGE_WIDTH + 18;
  const detailsWidth = doc.page.width - PAGE_MARGIN - detailsX;

  if (heroImage?.buffer) {
    doc
      .save()
      .roundedRect(PAGE_MARGIN, startY, HERO_IMAGE_WIDTH, HERO_IMAGE_HEIGHT, 14)
      .clip();
    doc.image(heroImage.buffer, PAGE_MARGIN, startY, {
      width: HERO_IMAGE_WIDTH,
      height: HERO_IMAGE_HEIGHT
    });
    doc.restore();
  } else {
    doc
      .save()
      .roundedRect(PAGE_MARGIN, startY, HERO_IMAGE_WIDTH, HERO_IMAGE_HEIGHT, 14)
      .fill(PDF_COLORS.surfaceMuted)
      .restore();
  }

  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(22)
    .fillColor(PDF_COLORS.textStrong)
    .text(heroTitle, detailsX, startY + 4, pdfTextOptions(lang, { width: detailsWidth }));
  const titleHeight = doc.heightOfString(heroTitle, pdfTextOptions(lang, { width: detailsWidth }));
  const titleBottomY = startY + 4 + titleHeight;
  return Math.max(startY + HERO_IMAGE_HEIGHT, titleBottomY) + 18;
}

function drawRunningHeader(doc, booking, fonts, companyProfile, lang) {
  const pageWidth = doc.page.width - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(11)
    .fillColor(PDF_COLORS.textStrong)
    .text(safeBookingTitle(booking, lang), PAGE_MARGIN, y, {
      width: pageWidth / 2,
      align: pdfTextAlign(lang)
    });

  if (companyProfile?.name) {
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(9.5)
      .fillColor(PDF_COLORS.textMuted)
      .text(companyProfile.name, doc.page.width - PAGE_MARGIN - 220, y, { width: 220, align: "right" });
  }

  drawDivider(doc, PAGE_MARGIN + 20);
  return PAGE_MARGIN + 36;
}

function itemBoxHeight(doc, item, fonts, lang, dayDate, contentWidth, hasThumbnail = false) {
  const innerWidth = contentWidth - ITEM_CARD_PADDING * 2;
  const textWidth = innerWidth;
  const metaParts = [textOrNull(item?.location), formatTravelPlanTiming(item, lang, dayDate)].filter(Boolean);
  const title = textOrNull(item?.title) || pdfT(lang, "offer.item_fallback", "Planned service");
  const details = textOrNull(item?.details);
  let textHeight = 0;
  if (metaParts.length) {
    textHeight += measureTextHeight(doc, metaParts.join(" · "), { width: textWidth, fontSize: 9.2, fonts, lineGap: 1 }) + 4;
  }
  textHeight += measureTextHeight(doc, title, { width: textWidth, fontSize: 11.2, fonts, weight: "bold", lineGap: 1 }) + 4;
  if (details) {
    textHeight += measureTextHeight(doc, details, { width: textWidth, fontSize: 10.2, fonts, lineGap: 2 }) + 4;
  }
  const thumbnailHeight = hasThumbnail ? ITEM_THUMBNAIL_HEIGHT + 10 : 0;
  return Math.max(88, ITEM_CARD_PADDING + thumbnailHeight + textHeight + ITEM_CARD_PADDING);
}

function drawTravelPlanItemCard(doc, x, y, width, item, thumbnail, fonts, lang, dayDate) {
  const itemHeight = itemBoxHeight(doc, item, fonts, lang, dayDate, width, Boolean(thumbnail));
  doc
    .save()
    .roundedRect(x, y, width, itemHeight, 12)
    .fill(PDF_COLORS.surfaceSubtle)
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

  const metaParts = [textOrNull(item?.location), formatTravelPlanTiming(item, lang, dayDate)].filter(Boolean);
  if (metaParts.length) {
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(9.2)
      .fillColor(PDF_COLORS.textMutedStrong)
      .text(metaParts.join(" · "), innerX, innerY, pdfTextOptions(lang, {
        width: textWidth,
        lineGap: 1
      }));
    innerY = doc.y + 4;
  }

  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(11.2)
    .fillColor(PDF_COLORS.textStrong)
    .text(textOrNull(item?.title) || pdfT(lang, "offer.item_fallback", "Planned service"), innerX, innerY, pdfTextOptions(lang, {
      width: textWidth,
      lineGap: 1
    }));
  innerY = doc.y + 4;

  const details = textOrNull(item?.details);
  if (details) {
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(10.2)
      .fillColor(PDF_COLORS.text)
      .text(details, innerX, innerY, pdfTextOptions(lang, {
        width: textWidth,
        lineGap: 2
      }));
  }

  return itemHeight;
}

function layoutTravelPlanItemsForPage(doc, items, itemThumbnailMap, fonts, lang, dayDate, columnWidth, availableHeight) {
  const columns = {
    left: [],
    right: []
  };
  const heights = {
    left: 0,
    right: 0
  };
  let index = 0;

  function projectedHeight(key, itemHeight) {
    return heights[key] + (columns[key].length ? ITEM_VERTICAL_GAP : 0) + itemHeight;
  }

  while (index < items.length) {
    const item = items[index];
    const thumbnail = itemThumbnailMap.get(item?.id) || null;
    const itemHeight = itemBoxHeight(doc, item, fonts, lang, dayDate, columnWidth, Boolean(thumbnail));
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

function drawTravelPlanItemColumns(doc, startY, columnWidth, pageLayout, fonts, lang, dayDate) {
  const leftX = PAGE_MARGIN;
  const rightX = PAGE_MARGIN + columnWidth + ITEM_COLUMN_GAP;
  let leftY = startY;
  let rightY = startY;

  for (const entry of pageLayout.columns.left) {
    drawTravelPlanItemCard(doc, leftX, leftY, columnWidth, entry.item, entry.thumbnail, fonts, lang, dayDate);
    leftY += entry.itemHeight + ITEM_VERTICAL_GAP;
  }

  for (const entry of pageLayout.columns.right) {
    drawTravelPlanItemCard(doc, rightX, rightY, columnWidth, entry.item, entry.thumbnail, fonts, lang, dayDate);
    rightY += entry.itemHeight + ITEM_VERTICAL_GAP;
  }
}

function drawTravelPlanDayHeader(doc, y, day, fonts, lang, { compact = false } = {}) {
  const dateLabel = formatTravelPlanDate(day?.date, lang);
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(15)
    .fillColor(PDF_COLORS.textStrong)
    .text(dayHeading(day, lang), PAGE_MARGIN, y, pdfTextOptions(lang, {
      width: doc.page.width - PAGE_MARGIN * 2 - 150
    }));
  if (dateLabel) {
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(10)
      .fillColor(PDF_COLORS.textMutedStrong)
      .text(dateLabel, doc.page.width - PAGE_MARGIN - 140, y + 2, {
        width: 140,
        align: "right"
      });
  }
  let nextY = doc.y + 4;

  const overnight = textOrNull(day?.overnight_location);
  if (overnight) {
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(10)
      .fillColor(PDF_COLORS.textMutedStrong)
      .text(pdfT(lang, "offer.overnight", "Overnight: {location}", { location: overnight }), PAGE_MARGIN, nextY, pdfTextOptions(lang, {
        width: doc.page.width - PAGE_MARGIN * 2
      }));
    nextY = doc.y + 4;
  }

  if (!compact) {
    const dayNotes = textOrNull(day?.notes);
    if (dayNotes) {
      doc
        .font(pdfFontName("regular", fonts))
        .fontSize(10.2)
        .fillColor(PDF_COLORS.text)
        .text(dayNotes, PAGE_MARGIN, nextY, pdfTextOptions(lang, {
          width: doc.page.width - PAGE_MARGIN * 2,
          lineGap: 2
        }));
      nextY = doc.y + 8;
    }
  }

  return nextY;
}

function drawEmptyState(doc, y, fonts, lang) {
  doc
    .save()
    .roundedRect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, 72, 14)
    .fill(PDF_COLORS.surfaceMuted)
    .restore();
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(13)
    .fillColor(PDF_COLORS.textStrong)
    .text(travelPlanSectionTitle(lang), PAGE_MARGIN + 18, y + 16, pdfTextOptions(lang, {
      width: doc.page.width - PAGE_MARGIN * 2 - 36
    }));
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(10.5)
    .fillColor(PDF_COLORS.textMutedStrong)
    .text(pdfT(lang, "travel_plan.empty", "No travel plan is available yet."), PAGE_MARGIN + 18, y + 38, pdfTextOptions(lang, {
      width: doc.page.width - PAGE_MARGIN * 2 - 36
    }));
  return y + 88;
}

function buildAttachmentClosingNote(attachmentCount, lang) {
  const count = Number(attachmentCount) || 0;
  if (count <= 0) return "";
  return count === 1
    ? pdfT(lang, "pdf.attachment_note_single", "Please also find the attached additional PDF at the end of this document.")
    : pdfT(lang, "pdf.attachment_note_multiple", "Please also find the attached additional PDFs at the end of this document.");
}

function drawClosing(doc, startY, fonts, lang, attachmentCount = 0) {
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11)
    .fillColor(PDF_COLORS.textMutedStrong)
    .text(
      pdfT(lang, "travel_plan.closing_body", "We would be happy to hear from you."),
      PAGE_MARGIN,
      startY,
      pdfTextOptions(lang, {
        width: doc.page.width - PAGE_MARGIN * 2,
        lineGap: 2
      })
    );

  const attachmentNote = buildAttachmentClosingNote(attachmentCount, lang);
  if (attachmentNote) {
    doc
      .moveDown(0.8)
      .text(attachmentNote, PAGE_MARGIN, doc.y, pdfTextOptions(lang, {
        width: doc.page.width - PAGE_MARGIN * 2,
        lineGap: 2
      }));
  }

  const signY = doc.y + 18;
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11)
    .fillColor(PDF_COLORS.textMutedStrong)
    .text(pdfT(lang, "travel_plan.closing_regards", "Warm regards,"), PAGE_MARGIN, signY, {
      width: doc.page.width - PAGE_MARGIN * 2,
      align: pdfTextAlign(lang)
    });
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(12)
    .fillColor(PDF_COLORS.textStrong)
    .text(pdfT(lang, "travel_plan.closing_team", "That's your Asia Travel Plan team."), PAGE_MARGIN, signY + 18, {
      width: doc.page.width - PAGE_MARGIN * 2,
      align: pdfTextAlign(lang)
    });
  return doc.y + 10;
}

function estimateGuideSectionHeight(doc, guideContext, fonts, lang) {
  const profile = guideContext?.profile || null;
  const qualificationText = textOrNull(resolveAtpGuideQualificationText(guideContext, lang));
  const guideFullName = textOrNull(resolveAtpStaffFullName(profile));
  const introName = textOrNull(resolveAtpGuideIntroName(profile));
  const guideTitle = guideFullName
    ? `${pdfT(lang, "guide.section_title", "Your ATP guide")}: ${guideFullName}`
    : pdfT(lang, "guide.section_title", "Your ATP guide");
  const photoWidth = profile ? GUIDE_PHOTO_SIZE + 18 : 0;
  const textWidth = doc.page.width - PAGE_MARGIN * 2 - 30 - photoWidth;
  let height = 26;

  height += measureTextHeight(doc, guideTitle, {
    width: textWidth,
    fontSize: 13,
    fonts,
    weight: "bold"
  });

  const introText = profile
    ? pdfT(lang, "guide.intro_named", "{name} from Asia Travel Plan will keep this route comfortable and well paced for you.", {
        name: introName || pdfT(lang, "guide.fallback_name", "Your ATP guide")
      })
    : pdfT(lang, "guide.intro_generic", "An ATP travel specialist will be assigned to keep this route comfortable, practical, and easy to follow.");
  const bodyText = qualificationText ? `${introText} ${qualificationText}` : introText;
  height += 6 + measureTextHeight(doc, bodyText, {
    width: textWidth,
    fontSize: 10.4,
    fonts,
    lineGap: 2
  });

  return Math.max(height + 18, profile ? GUIDE_PHOTO_SIZE + 26 : 120);
}

function drawGuideSection(doc, startY, fonts, lang, guideContext, guidePhoto) {
  const profile = guideContext?.profile || null;
  const qualificationText = textOrNull(resolveAtpGuideQualificationText(guideContext, lang));
  const guideFullName = textOrNull(resolveAtpStaffFullName(profile));
  const introName = textOrNull(resolveAtpGuideIntroName(profile));
  const guideTitle = guideFullName
    ? `${pdfT(lang, "guide.section_title", "Your ATP guide")}: ${guideFullName}`
    : pdfT(lang, "guide.section_title", "Your ATP guide");
  const cardWidth = doc.page.width - PAGE_MARGIN * 2;
  const cardHeight = estimateGuideSectionHeight(doc, guideContext, fonts, lang);
  const photoWidth = profile ? GUIDE_PHOTO_SIZE + 18 : 0;
  const textX = PAGE_MARGIN + 16;
  const textWidth = cardWidth - 32 - photoWidth;
  const photoX = PAGE_MARGIN + cardWidth - 16 - GUIDE_PHOTO_SIZE;

  doc
    .save()
    .roundedRect(PAGE_MARGIN, startY, cardWidth, cardHeight, 14)
    .fill(PDF_COLORS.surfaceSubtle)
    .restore();

  if (profile) {
    if (guidePhoto?.buffer) {
      doc
        .save()
        .roundedRect(photoX, startY + 16, GUIDE_PHOTO_SIZE, GUIDE_PHOTO_SIZE, 12)
        .clip();
      doc.image(guidePhoto.buffer, photoX, startY + 16, {
        width: GUIDE_PHOTO_SIZE,
        height: GUIDE_PHOTO_SIZE
      });
      doc.restore();
    } else {
      doc
        .save()
        .roundedRect(photoX, startY + 16, GUIDE_PHOTO_SIZE, GUIDE_PHOTO_SIZE, 12)
        .fill(PDF_COLORS.surfaceMuted)
        .restore();
    }
  }

  let y = startY + 16;
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(13)
    .fillColor(PDF_COLORS.textStrong)
    .text(guideTitle, textX, y, pdfTextOptions(lang, { width: textWidth }));
  y = doc.y + 6;

  const introText = profile
    ? pdfT(lang, "guide.intro_named", "{name} from Asia Travel Plan will keep this route comfortable and well paced for you.", {
        name: introName || pdfT(lang, "guide.fallback_name", "Your ATP guide")
      })
    : pdfT(lang, "guide.intro_generic", "An ATP travel specialist will be assigned to keep this route comfortable, practical, and easy to follow.");
  const bodyText = qualificationText ? `${introText} ${qualificationText}` : introText;

  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(10.4)
    .fillColor(PDF_COLORS.textMutedStrong)
    .text(bodyText, textX, y, pdfTextOptions(lang, {
      width: textWidth,
      lineGap: 2
    }));

  return startY + cardHeight + 18;
}

export function createTravelPlanPdfWriter({
  bookingImagesDir = "",
  readTours = null,
  resolveTourImageDiskPath = null,
  resolveAssignedAtpStaffProfile = null,
  resolveAtpStaffPhotoDiskPath = null,
  logoPath = "",
  fallbackImagePath = "",
  travelPlanAttachmentsDir = "",
  companyProfile = null
}) {
  return async function writeTravelPlanPdf(booking, travelPlan, options = {}) {
    const lang = normalizePdfLang(
      options?.lang
      || booking?.customer_language
      || booking?.web_form_submission?.preferred_language
      || "en"
    );
    const outputPath = String(options?.outputPath || "").trim();
    if (!outputPath) {
      throw new Error("Travel plan PDF output path is required");
    }
    await mkdir(path.dirname(outputPath), { recursive: true });
    const plan = travelPlan && typeof travelPlan === "object" ? travelPlan : { days: [] };
    const attachmentPaths = resolveTravelPlanAttachmentPaths(plan, travelPlanAttachmentsDir);

    const guideContext = await resolveAtpGuidePdfContext({
      booking,
      resolveAssignedAtpStaffProfile,
      resolveAtpStaffPhotoDiskPath
    });

    const [heroTitle, logoImage, heroPath, itemThumbnailMap, guidePhoto] = await Promise.all([
      resolveBookingHeroTitle(booking, lang, readTours),
      rasterizeImage(logoPath, { width: 1000 }).catch(() => null),
      resolveBookingImageForPdf({ booking, bookingImagesDir, readTours, resolveTourImageDiskPath }),
      buildItemThumbnailMap(plan, bookingImagesDir),
      guideContext?.photoDiskPath
        ? rasterizeImage(guideContext.photoDiskPath, {
            width: 420,
            height: 420
          }).catch(() => null)
        : null
    ]);
    const heroImage = await rasterizeImage(heroPath || fallbackImagePath, {
      width: 1200,
      height: 780
    }).catch(() => null);

    const asciiOnly = [
      textOrNull(heroTitle),
      textOrNull(booking?.name),
      ...safeArray(plan?.days).flatMap((day) => [
        textOrNull(day?.title),
        textOrNull(day?.date),
        textOrNull(day?.overnight_location),
        textOrNull(day?.notes),
        ...safeArray(day?.services || day?.items).flatMap((item) => [
          textOrNull(item?.time_label),
          textOrNull(item?.time_point),
          textOrNull(item?.start_time),
          textOrNull(item?.end_time),
          textOrNull(item?.title),
          textOrNull(item?.location),
          textOrNull(item?.details)
        ])
      ]),
      textOrNull(resolveAtpStaffFullName(guideContext?.profile)),
      textOrNull(resolveAtpStaffFriendlyShortName(guideContext?.profile)),
      textOrNull(resolveAtpGuideQualificationText(guideContext, lang)),
      textOrNull(companyProfile?.name),
      textOrNull(companyProfile?.website),
      textOrNull(companyProfile?.email),
      textOrNull(companyProfile?.whatsapp)
    ]
      .filter(Boolean)
      .every((value) => /^[\x09\x0A\x0D\x20-\x7E]*$/.test(String(value)));

    const fonts = asciiOnly ? null : await resolvePdfFonts();

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: PAGE_SIZE,
        margin: 0,
        autoFirstPage: true,
        compress: false,
        info: {
          Title: `${safeBookingTitle(booking, lang)} ${travelPlanSectionTitle(lang)}`,
          Author: companyProfile?.name || "Asia Travel Plan",
          Subject: travelPlanSectionTitle(lang)
        }
      });
      const stream = createWriteStream(outputPath);
      doc.pipe(stream);
      stream.on("finish", resolve);
      stream.on("error", reject);
      doc.on("error", reject);

      registerPdfFonts(doc, fonts);

      const bottomLimit = () => doc.page.height - PAGE_MARGIN - PAGE_FOOTER_GAP;
      const addContinuationPage = () => {
        drawFooter(doc, fonts, companyProfile, lang);
        doc.addPage();
        return drawRunningHeader(doc, booking, fonts, companyProfile, lang);
      };
      const ensureSpace = (currentY, requiredHeight) => (
        currentY + requiredHeight <= bottomLimit()
          ? currentY
          : addContinuationPage()
      );

      let y = drawTopHeader(doc, companyProfile, logoImage, fonts, lang);
      y = drawTravelPlanHero(doc, heroTitle, heroImage, y, fonts, lang);
      y = ensureSpace(y, estimateGuideSectionHeight(doc, guideContext, fonts, lang) + 10);
      y = drawGuideSection(doc, y, fonts, lang, guideContext, guidePhoto);

      const days = safeArray(plan?.days);
      if (!days.length) {
        y = ensureSpace(y, 40 + 88);
        doc
          .font(pdfFontName("bold", fonts))
          .fontSize(18)
          .fillColor(PDF_COLORS.textStrong)
          .text(travelPlanSectionTitle(lang), PAGE_MARGIN, y, pdfTextOptions(lang, {
            width: doc.page.width - PAGE_MARGIN * 2
          }));
        y = doc.y + 10;
        y = ensureSpace(y, 88);
        y = drawEmptyState(doc, y, fonts, lang);
      } else {
        y = ensureSpace(y, 40 + 90);
        doc
          .font(pdfFontName("bold", fonts))
          .fontSize(18)
          .fillColor(PDF_COLORS.textStrong)
          .text(travelPlanSectionTitle(lang), PAGE_MARGIN, y, pdfTextOptions(lang, {
            width: doc.page.width - PAGE_MARGIN * 2
          }));
        y = doc.y + 10;
        for (const day of days) {
          y = ensureSpace(y, 90);
          y = drawTravelPlanDayHeader(doc, y, day, fonts, lang);

          const contentWidth = doc.page.width - PAGE_MARGIN * 2;
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
              availableHeight
            );

            if (!pageLayout.columns.left.length && !pageLayout.columns.right.length) {
              break;
            }

            drawTravelPlanItemColumns(doc, y, columnWidth, pageLayout, fonts, lang, day?.date);
            y += pageLayout.height + 14;
            remainingItems = pageLayout.rest;

            if (remainingItems.length) {
              y = addContinuationPage();
              y = drawTravelPlanDayHeader(doc, y, day, fonts, lang, { compact: compactHeader });
            }
          }

          y += 6;
        }
      }

      y = ensureSpace(y + 8, 96);
      drawClosing(doc, y + 10, fonts, lang, attachmentPaths.length);
      drawFooter(doc, fonts, companyProfile, lang);
      doc.end();
    });

    if (attachmentPaths.length) {
      await appendPdfAttachmentsToFile(outputPath, attachmentPaths);
    } else {
      await trimTrailingBlankPagesInFile(outputPath);
    }

    return { outputPath };
  };
}
