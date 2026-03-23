import { createWriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import {
  formatPdfDateOnly,
  normalizePdfLang,
  pdfT
} from "./pdf_i18n.js";
import {
  appendPdfAttachmentsToFile,
  resolveTravelPlanAttachmentAbsolutePath
} from "./pdf_attachments.js";
import { pdfTheme } from "./style_tokens.js";
import { normalizeText } from "./text.js";
import { resolveLocalizedText } from "../domain/booking_content_i18n.js";

const MM_TO_POINTS = 72 / 25.4;
// PDFKit's built-in "A4" preset rounds the page box and some viewers display it as
// 21.01 x 29.71 cm. Use the exact A4 dimensions in points instead.
const PAGE_SIZE = Object.freeze([210 * MM_TO_POINTS, 297 * MM_TO_POINTS]);
const PAGE_MARGIN = 44;
const PAGE_FOOTER_GAP = 28;
const HEADER_LOGO_WIDTH = 150;
const HERO_IMAGE_WIDTH = 195;
const HERO_IMAGE_HEIGHT = 128;
const ITEM_THUMBNAIL_WIDTH = 118;
const ITEM_THUMBNAIL_HEIGHT = 88;
const ITEM_CARD_PADDING = 14;
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
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf",
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
  "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/opentype/noto/NotoSans-Bold.ttf",
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

function resolveTravelPlanItemThumbnailPath(item, bookingImagesDir) {
  if (!bookingImagesDir) return null;
  const candidate = safeArray(item?.images)
    .filter((image) => image?.is_customer_visible !== false)
    .find((image) => textOrNull(image?.storage_path));
  if (!candidate) return null;
  return path.resolve(bookingImagesDir, String(candidate.storage_path).replace(/^\/+/, ""));
}

async function buildItemThumbnailMap(plan, bookingImagesDir) {
  const items = safeArray(plan?.days).flatMap((day) => safeArray(day?.items));
  const entries = await Promise.all(items.map(async (item) => {
    const thumbnailPath = resolveTravelPlanItemThumbnailPath(item, bookingImagesDir);
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
    doc.image(logoImage.buffer, PAGE_MARGIN, y + 2, { width: HEADER_LOGO_WIDTH });
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
  const heroSubtitle = pdfT(lang, "travel_plan.pdf_subtitle", "Travel plan overview");
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
    .text(heroTitle, detailsX, startY + 4, { width: detailsWidth });
  const titleHeight = doc.heightOfString(heroTitle, { width: detailsWidth });
  const titleBottomY = startY + 4 + titleHeight;

  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11)
    .fillColor(PDF_COLORS.textMuted)
    .text(heroSubtitle, detailsX, titleBottomY + 4, { width: detailsWidth });

  drawRoundedTag(
    doc,
    detailsX,
    doc.y + 10,
    170,
    22,
    pdfT(lang, "travel_plan.pdf_badge", "Day-by-day itinerary"),
    { fillColor: PDF_COLORS.surfaceSuccess },
    fonts
  );

  return Math.max(startY + HERO_IMAGE_HEIGHT, doc.y + 22) + 18;
}

function drawRunningHeader(doc, booking, fonts, companyProfile, lang) {
  const pageWidth = doc.page.width - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(11)
    .fillColor(PDF_COLORS.textStrong)
    .text(safeBookingTitle(booking, lang), PAGE_MARGIN, y, { width: pageWidth / 2 });
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(9.5)
    .fillColor(PDF_COLORS.textMuted)
    .text(pdfT(lang, "offer.travel_plan_title", "Travel plan overview"), PAGE_MARGIN, y + 14, { width: pageWidth / 2 });

  if (companyProfile?.name) {
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(9.5)
      .fillColor(PDF_COLORS.textMuted)
      .text(companyProfile.name, doc.page.width - PAGE_MARGIN - 220, y, { width: 220, align: "right" });
  }

  drawDivider(doc, PAGE_MARGIN + 34);
  return PAGE_MARGIN + 50;
}

function itemBoxHeight(doc, item, fonts, lang, dayDate, contentWidth, hasThumbnail = false) {
  const innerWidth = contentWidth - ITEM_CARD_PADDING * 2;
  const textWidth = hasThumbnail
    ? innerWidth - ITEM_THUMBNAIL_WIDTH - 14
    : innerWidth;
  const metaParts = [formatTravelPlanTiming(item, lang, dayDate), itemKindLabel(item?.kind, lang)].filter(Boolean);
  const title = textOrNull(item?.title) || pdfT(lang, "offer.item_fallback", "Planned item");
  const location = textOrNull(item?.location);
  const details = textOrNull(item?.details);
  let textHeight = 12;
  if (metaParts.length) {
    textHeight += measureTextHeight(doc, metaParts.join(" · "), { width: textWidth, fontSize: 9.2, fonts, lineGap: 1 }) + 4;
  }
  textHeight += measureTextHeight(doc, title, { width: textWidth, fontSize: 11.2, fonts, weight: "bold", lineGap: 1 }) + 4;
  if (location) {
    textHeight += measureTextHeight(doc, location, { width: textWidth, fontSize: 9.8, fonts, lineGap: 1 }) + 4;
  }
  if (details) {
    textHeight += measureTextHeight(doc, details, { width: textWidth, fontSize: 10.2, fonts, lineGap: 2 }) + 4;
  }
  const thumbnailHeight = hasThumbnail ? ITEM_THUMBNAIL_HEIGHT + 12 : 0;
  return Math.max(72, Math.max(textHeight + 12, thumbnailHeight + 12));
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
    .text(pdfT(lang, "offer.travel_plan_title", "Travel plan overview"), PAGE_MARGIN + 18, y + 16);
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(10.5)
    .fillColor(PDF_COLORS.textMutedStrong)
    .text(pdfT(lang, "travel_plan.empty", "No travel plan is available yet."), PAGE_MARGIN + 18, y + 38, {
      width: doc.page.width - PAGE_MARGIN * 2 - 36
    });
  return y + 88;
}

function buildAttachmentClosingNote(attachmentCount) {
  const count = Number(attachmentCount) || 0;
  if (count <= 0) return "";
  return count === 1
    ? "Please also find the attached additional PDF at the end of this document."
    : "Please also find the attached additional PDFs at the end of this document.";
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
      {
        width: doc.page.width - PAGE_MARGIN * 2,
        lineGap: 2
      }
    );

  const attachmentNote = buildAttachmentClosingNote(attachmentCount);
  if (attachmentNote) {
    doc
      .moveDown(0.8)
      .text(attachmentNote, PAGE_MARGIN, doc.y, {
        width: doc.page.width - PAGE_MARGIN * 2,
        lineGap: 2
      });
  }

  const signY = doc.y + 18;
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11)
    .fillColor(PDF_COLORS.textMutedStrong)
    .text(pdfT(lang, "travel_plan.closing_regards", "Warm regards,"), PAGE_MARGIN, signY);
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(12)
    .fillColor(PDF_COLORS.textStrong)
    .text(pdfT(lang, "travel_plan.closing_team", "That's your Asia Travel Plan team."), PAGE_MARGIN, signY + 18);
  return doc.y + 10;
}

export function createTravelPlanPdfWriter({
  travelPlanPdfPath,
  bookingImagesDir = "",
  readTours = null,
  resolveTourImageDiskPath = null,
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
    const outputPath = travelPlanPdfPath(booking?.id);
    await mkdir(path.dirname(outputPath), { recursive: true });
    const plan = travelPlan && typeof travelPlan === "object" ? travelPlan : { days: [] };
    const attachmentPaths = resolveTravelPlanAttachmentPaths(plan, travelPlanAttachmentsDir);

    const [heroTitle, logoImage, heroPath, itemThumbnailMap] = await Promise.all([
      resolveBookingHeroTitle(booking, lang, readTours),
      rasterizeImage(logoPath, { width: 1000 }).catch(() => null),
      resolveBookingImageForPdf({ booking, bookingImagesDir, readTours, resolveTourImageDiskPath }),
      buildItemThumbnailMap(plan, bookingImagesDir)
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
        ...safeArray(day?.items).flatMap((item) => [
          textOrNull(item?.time_label),
          textOrNull(item?.time_point),
          textOrNull(item?.start_time),
          textOrNull(item?.end_time),
          textOrNull(item?.title),
          textOrNull(item?.location),
          textOrNull(item?.details)
        ])
      ]),
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
          Title: `${safeBookingTitle(booking, lang)} ${pdfT(lang, "offer.travel_plan_title", "Travel plan overview")}`,
          Author: companyProfile?.name || "Asia Travel Plan",
          Subject: pdfT(lang, "offer.travel_plan_title", "Travel plan overview")
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

      const days = safeArray(plan?.days);
      if (!days.length) {
        y = ensureSpace(y, 88);
        y = drawEmptyState(doc, y, fonts, lang);
      } else {
        for (const day of days) {
          y = ensureSpace(y, 90);
          const dateLabel = formatTravelPlanDate(day?.date, lang);
          doc
            .font(pdfFontName("bold", fonts))
            .fontSize(15)
            .fillColor(PDF_COLORS.textStrong)
            .text(dayHeading(day, lang), PAGE_MARGIN, y, {
              width: doc.page.width - PAGE_MARGIN * 2 - 150
            });
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
          y = doc.y + 4;

          const overnight = textOrNull(day?.overnight_location);
          if (overnight) {
            doc
              .font(pdfFontName("regular", fonts))
              .fontSize(10)
              .fillColor(PDF_COLORS.textMutedStrong)
              .text(pdfT(lang, "offer.overnight", "Overnight: {location}", { location: overnight }), PAGE_MARGIN, y, {
                width: doc.page.width - PAGE_MARGIN * 2
              });
            y = doc.y + 4;
          }

          const dayNotes = textOrNull(day?.notes);
          if (dayNotes) {
            doc
              .font(pdfFontName("regular", fonts))
              .fontSize(10.2)
              .fillColor(PDF_COLORS.text)
              .text(dayNotes, PAGE_MARGIN, y, {
                width: doc.page.width - PAGE_MARGIN * 2,
                lineGap: 2
              });
            y = doc.y + 8;
          }

          for (const item of safeArray(day?.items)) {
            const thumbnail = itemThumbnailMap.get(item?.id) || null;
            const contentWidth = doc.page.width - PAGE_MARGIN * 2;
            const itemHeight = itemBoxHeight(doc, item, fonts, lang, day?.date, contentWidth, Boolean(thumbnail));
            y = ensureSpace(y, itemHeight + 10);

            doc
              .save()
              .roundedRect(PAGE_MARGIN, y, contentWidth, itemHeight, 12)
              .fill(PDF_COLORS.surfaceSubtle)
              .restore();

            const innerX = PAGE_MARGIN + ITEM_CARD_PADDING;
            const innerWidth = contentWidth - ITEM_CARD_PADDING * 2;
            const thumbnailWidth = thumbnail ? ITEM_THUMBNAIL_WIDTH : 0;
            const textWidth = thumbnail ? innerWidth - thumbnailWidth - 14 : innerWidth;
            const thumbnailX = PAGE_MARGIN + contentWidth - ITEM_CARD_PADDING - thumbnailWidth;
            let innerY = y + 12;

            if (thumbnail?.buffer) {
              doc
                .save()
                .roundedRect(thumbnailX, y + 10, ITEM_THUMBNAIL_WIDTH, ITEM_THUMBNAIL_HEIGHT, 10)
                .clip();
              doc.image(thumbnail.buffer, thumbnailX, y + 10, {
                width: ITEM_THUMBNAIL_WIDTH,
                height: ITEM_THUMBNAIL_HEIGHT
              });
              doc.restore();
            }

            const metaParts = [formatTravelPlanTiming(item, lang, day?.date), itemKindLabel(item?.kind, lang)].filter(Boolean);
            if (metaParts.length) {
              doc
                .font(pdfFontName("regular", fonts))
                .fontSize(9.2)
                .fillColor(PDF_COLORS.textMutedStrong)
                .text(metaParts.join(" · "), innerX, innerY, {
                  width: textWidth,
                  lineGap: 1
                });
              innerY = doc.y + 4;
            }

            doc
              .font(pdfFontName("bold", fonts))
              .fontSize(11.2)
              .fillColor(PDF_COLORS.textStrong)
              .text(textOrNull(item?.title) || pdfT(lang, "offer.item_fallback", "Planned item"), innerX, innerY, {
                width: textWidth,
                lineGap: 1
              });
            innerY = doc.y + 4;

            const location = textOrNull(item?.location);
            if (location) {
              doc
                .font(pdfFontName("regular", fonts))
                .fontSize(9.8)
                .fillColor(PDF_COLORS.textMutedStrong)
                .text(location, innerX, innerY, {
                  width: textWidth,
                  lineGap: 1
                });
              innerY = doc.y + 4;
            }

            const details = textOrNull(item?.details);
            if (details) {
              doc
                .font(pdfFontName("regular", fonts))
                .fontSize(10.2)
                .fillColor(PDF_COLORS.text)
                .text(details, innerX, innerY, {
                  width: textWidth,
                  lineGap: 2
                });
            }

            y += itemHeight + 8;
          }

          y += 14;
        }
      }

      y = ensureSpace(y + 8, 96);
      drawClosing(doc, y + 10, fonts, lang, attachmentPaths.length);
      drawFooter(doc, fonts, companyProfile, lang);
      doc.end();
    });

    if (attachmentPaths.length) {
      await appendPdfAttachmentsToFile(outputPath, attachmentPaths);
    }

    return { outputPath };
  };
}
