import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import {
  formatPdfDateOnly,
  formatPdfDateTime,
  formatPdfMoney,
  normalizePdfLang,
  pdfTextAlign,
  pdfTextOptions,
  pdfT
} from "./pdf_i18n.js";
import {
  appendPdfAttachmentsToFile,
  trimTrailingBlankPagesInFile,
  resolveTravelPlanAttachmentAbsolutePath
} from "./pdf_attachments.js";
import { resolvePdfFontsForLang } from "./pdf_font_resolver.js";
import { drawMultifontText, measureMultifontTextHeight } from "./pdf_multifont_text.js";
import { pdfTheme } from "./style_tokens.js";
import { normalizeText } from "./text.js";
import { resolveLocalizedText } from "../domain/booking_content_i18n.js";
import {
  resolveAtpGuideIntroName,
  resolveAtpGuidePdfContext,
  resolveAtpGuideQualificationText,
  resolveAtpStaffFullName
} from "./atp_staff_pdf.js";

const MM_TO_POINTS = 72 / 25.4;
// PDFKit's built-in "A4" preset rounds the page box and some viewers display it as
// 21.01 x 29.71 cm. Use the exact A4 dimensions in points instead.
const PAGE_SIZE = Object.freeze([210 * MM_TO_POINTS, 297 * MM_TO_POINTS]);
const PAGE_MARGIN = 44;
const HEADER_LOGO_WIDTH = 150;
const HERO_IMAGE_WIDTH = 195;
const HERO_IMAGE_HEIGHT = 128;
const GUIDE_PHOTO_SIZE = 96;
const TABLE_ROW_GAP = 8;
const TABLE_HEADER_HEIGHT = 28;
const TABLE_CELL_PADDING_X = 8;
const TABLE_CELL_PADDING_Y = 8;
const PDF_FONT_REGULAR = "ATPUnicodeRegular";
const PDF_FONT_BOLD = "ATPUnicodeBold";
const PDF_FONT_ACCENT_REGULAR = "ATPUnicodeAccentRegular";
const PDF_FONT_ACCENT_BOLD = "ATPUnicodeAccentBold";

const PDF_FONT_REGULAR_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
  "/Library/Fonts/Arial Unicode.ttf",
  "/usr/share/fonts/nanum/NanumGothic.ttf",
  "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
  "/usr/share/fonts/noto/NotoSansKR-Regular.otf",
  "/usr/share/fonts/opentype/noto/NotoSansKR-Regular.otf",
  "/usr/share/fonts/noto/NotoSansKR-Regular.ttf",
  "/usr/share/fonts/truetype/noto/NotoSansKR-Regular.ttf",
  "/usr/share/fonts/droid-nonlatin/DroidSansFallbackFull.ttf",
  "/usr/share/fonts/droid-nonlatin/DroidSansFallback.ttf",
  "/usr/share/fonts/opentype/unifont/unifont.otf",
  "/usr/share/fonts/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
];

const PDF_FONT_BOLD_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
  "/Library/Fonts/Arial Unicode.ttf",
  "/usr/share/fonts/nanum/NanumGothicBold.ttf",
  "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
  "/usr/share/fonts/noto/NotoSansKR-Bold.otf",
  "/usr/share/fonts/opentype/noto/NotoSansKR-Bold.otf",
  "/usr/share/fonts/noto/NotoSansKR-Bold.ttf",
  "/usr/share/fonts/truetype/noto/NotoSansKR-Bold.ttf",
  "/usr/share/fonts/droid-nonlatin/DroidSansFallbackFull.ttf",
  "/usr/share/fonts/droid-nonlatin/DroidSansFallback.ttf",
  "/usr/share/fonts/opentype/unifont/unifont.otf",
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
  lineStrong: pdfTheme.lineStrong,
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

async function fileExists(filePath) {
  if (!filePath) return false;
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function registerPdfFonts(doc, fonts) {
  if (fonts?.regular) {
    doc.registerFont(PDF_FONT_REGULAR, fonts.regular);
  }
  if (fonts?.bold) {
    doc.registerFont(PDF_FONT_BOLD, fonts.bold);
  }
  if (fonts?.accentRegular) {
    doc.registerFont(PDF_FONT_ACCENT_REGULAR, fonts.accentRegular);
  }
  if (fonts?.accentBold) {
    doc.registerFont(PDF_FONT_ACCENT_BOLD, fonts.accentBold);
  }
}

function pdfFontName(weight = "regular", fonts = null) {
  if (!fonts?.regular) return weight === "bold" ? "Helvetica-Bold" : "Helvetica";
  if (weight === "bold" && fonts?.bold) return PDF_FONT_BOLD;
  return PDF_FONT_REGULAR;
}

function mixedFontChoices(weight = "regular", fonts = null) {
  const choices = [];
  if (weight === "bold") {
    if (fonts?.regular) choices.push({ name: PDF_FONT_BOLD, path: fonts?.bold || fonts?.regular });
    if (fonts?.accentRegular) choices.push({ name: PDF_FONT_ACCENT_BOLD, path: fonts?.accentBold || fonts?.accentRegular });
    return choices;
  }
  if (fonts?.regular) choices.push({ name: PDF_FONT_REGULAR, path: fonts.regular });
  if (fonts?.accentRegular) choices.push({ name: PDF_FONT_ACCENT_REGULAR, path: fonts.accentRegular });
  return choices;
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

function formatFriendlyDate(isoValue, lang) {
  return formatPdfDateTime(isoValue, lang, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatFriendlyDateOnly(dateValue, lang) {
  return formatPdfDateOnly(dateValue, lang, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function humanizeTravelPlanServiceKind(kind, lang) {
  const normalizedKind = normalizeText(kind).toLowerCase();
  if (!normalizedKind) return "";
  const fallback = normalizedKind
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return pdfT(lang, `offer.item.${normalizedKind}`, fallback);
}

function formatTravelPlanDateTime(rawValue, lang, fallbackDayDate = "") {
  const raw = normalizeText(rawValue);
  if (!raw) return "";
  const dateTimeMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (dateTimeMatch) {
    const [, datePart, timePart] = dateTimeMatch;
    if (fallbackDayDate && datePart === fallbackDayDate) return timePart;
    return `${formatFriendlyDateOnly(datePart, lang)} ${timePart}`;
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

function peopleTraveling(booking) {
  return safeArray(booking?.persons).filter((person) => safeArray(person?.roles).includes("traveler"));
}

function categoryLabel(component) {
  const explicit = normalizeText(component?.label);
  if (explicit) return explicit;
  return normalizeText(component?.category)
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
}

function formatTaxRateLabel(basisPoints, lang) {
  const numeric = Math.max(0, Number(basisPoints || 0)) / 100;
  const value = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, "");
  return pdfT(lang, "offer.tax_rate", "Tax {rate}%", { rate: value });
}

function deriveOfferQuotationSummary(offer) {
  const source = offer && typeof offer === "object" ? offer : {};
  const provided = source.quotation_summary && typeof source.quotation_summary === "object"
    ? source.quotation_summary
    : null;
  if (provided) return provided;

  const components = safeArray(source.components);
  const discount = source.discount && typeof source.discount === "object" ? source.discount : null;
  const buckets = new Map();
  let subtotal = 0;
  let totalTax = 0;
  let totalGross = 0;
  for (const component of components) {
    const basisPoints = Math.max(0, Number(component?.tax_rate_basis_points || 0));
    const net = Number(component?.line_net_amount_cents || 0);
    const tax = Number(component?.line_tax_amount_cents || 0);
    const gross = Number(
      component?.line_gross_amount_cents
      ?? component?.line_total_amount_cents
      ?? (net + tax)
    ) || 0;
    subtotal += net;
    totalTax += tax;
    totalGross += gross;
    const bucket = buckets.get(basisPoints) || {
      tax_rate_basis_points: basisPoints,
      net_amount_cents: 0,
      tax_amount_cents: 0,
      gross_amount_cents: 0,
      items_count: 0
    };
    bucket.net_amount_cents += net;
    bucket.tax_amount_cents += tax;
    bucket.gross_amount_cents += gross;
    bucket.items_count += 1;
    buckets.set(basisPoints, bucket);
  }
  if (discount && Number(discount?.amount_cents || 0) > 0) {
    const amount = Math.max(0, Number(discount.amount_cents || 0));
    subtotal -= amount;
    totalGross -= amount;
    const bucket = buckets.get(0) || {
      tax_rate_basis_points: 0,
      net_amount_cents: 0,
      tax_amount_cents: 0,
      gross_amount_cents: 0,
      items_count: 0
    };
    bucket.net_amount_cents -= amount;
    bucket.gross_amount_cents -= amount;
    bucket.items_count += 1;
    buckets.set(0, bucket);
  }
  return {
    tax_included: true,
    subtotal_net_amount_cents: subtotal,
    total_tax_amount_cents: totalTax,
    grand_total_amount_cents: totalGross,
    tax_breakdown: Array.from(buckets.values()).sort((left, right) => left.tax_rate_basis_points - right.tax_rate_basis_points)
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
  return explicitTitle
    || submittedTitle
    || pdfT(lang, "offer.subject", "Travel Offer");
}

async function resolveBookingImageForPdf({ booking, bookingImagesDir, readTours, resolveTourImageDiskPath }) {
  const bookingImageRelative = extractPublicRelativePath(booking?.image, "/public/v1/booking-images/");
  if (bookingImageRelative) {
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

function resolveOfferAttachmentPaths(generatedOffer, booking, travelPlanAttachmentsDir) {
  const bookingAttachments = Array.isArray(booking?.travel_plan?.attachments) ? booking.travel_plan.attachments : [];
  const snapshotAttachments = Array.isArray(generatedOffer?.travel_plan?.attachments) ? generatedOffer.travel_plan.attachments : [];
  const preferredAttachments = bookingAttachments.length ? bookingAttachments : snapshotAttachments;
  return resolveTravelPlanAttachmentPaths({ attachments: preferredAttachments }, travelPlanAttachmentsDir);
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

function ensureSpace(doc, currentY, requiredHeight, headerRedraw = null) {
  const bottomLimit = doc.page.height - PAGE_MARGIN - 24;
  if (currentY + requiredHeight <= bottomLimit) return currentY;
  doc.addPage();
  if (typeof headerRedraw === "function") {
    return headerRedraw(doc, PAGE_MARGIN) || PAGE_MARGIN;
  }
  return PAGE_MARGIN;
}

function startSectionOnNewPage(doc) {
  doc.addPage();
  return PAGE_MARGIN;
}

function drawTopHeader(doc, companyProfile, logoImage, fonts, lang) {
  let y = PAGE_MARGIN;
  if (logoImage?.buffer) {
    doc.image(logoImage.buffer, PAGE_MARGIN, y + 2, { width: HEADER_LOGO_WIDTH });
  }

  const rightColumnX = doc.page.width - PAGE_MARGIN - 220;
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(13)
    .fillColor(PDF_COLORS.textStrong)
    .text(companyProfile.name, rightColumnX, y, { width: 220, align: "right" });
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(10)
    .fillColor(PDF_COLORS.textMuted)
    .text(companyProfile.address, rightColumnX, y + 18, { width: 220, align: "right" })
    .text(`${pdfT(lang, "header.whatsapp", "WhatsApp")}: ${companyProfile.whatsapp}`, rightColumnX, y + 50, { width: 220, align: "right" })
    .text(`${pdfT(lang, "header.email", "Email")}: ${companyProfile.email}`, rightColumnX, y + 66, { width: 220, align: "right" })
    .text(companyProfile.website, rightColumnX, y + 82, { width: 220, align: "right" });

  const nextY = y + 106;
  drawDivider(doc, nextY);
  return nextY + 18;
}

function drawHero(doc, heroTitle, booking, generatedOffer, heroImage, startY, fonts, lang) {
  const heroSubtitle = pdfT(lang, "offer.hero_subtitle", "Your personalized Asia Travel Plan offer");
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
    .text(heroTitle, detailsX, startY + 4, {
      width: detailsWidth,
      align: pdfTextAlign(lang)
    });
  const titleHeight = doc.heightOfString(heroTitle, { width: detailsWidth });
  const titleBottomY = startY + 4 + titleHeight;

  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11)
    .fillColor(PDF_COLORS.textMuted)
    .text(heroSubtitle, detailsX, titleBottomY + 4, {
      width: detailsWidth,
      align: pdfTextAlign(lang)
    });
  const subtitleBottomY = doc.y;

  const chipsY = subtitleBottomY + 10;
  drawRoundedTag(
    doc,
    detailsX,
    chipsY,
    180,
    22,
    pdfT(lang, "offer.badge.version", "{date} (v{version})", {
      date: formatFriendlyDate(generatedOffer?.created_at, lang),
      version: Number(generatedOffer?.version || 1)
    }),
    {
      fillColor: PDF_COLORS.surfaceSuccess
    },
    fonts
  );

  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(10.5)
    .fillColor(PDF_COLORS.textMuted)
    .text(
      pdfT(lang, "offer.intro_currency", "Prepared for your requested itinerary in {currency}.", {
        currency: generatedOffer?.currency || booking?.preferred_currency || "USD"
      }),
      detailsX,
      chipsY + 34,
      pdfTextOptions(lang, { width: detailsWidth })
    );

  return Math.max(startY + HERO_IMAGE_HEIGHT, doc.y) + 22;
}

function drawIntro(doc, startY, fonts, lang) {
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11.5)
    .fillColor(PDF_COLORS.textMutedStrong)
    .text(
      pdfT(lang, "offer.intro_body", "Thank you for considering Asia Travel Plan for your journey. We are pleased to share this offer for your trip, and we hope it feels like a strong starting point for your travel planning. If you like it, simply reply to us and we will refine the next steps together."),
      PAGE_MARGIN,
      startY,
      pdfTextOptions(lang, {
        width: doc.page.width - PAGE_MARGIN * 2,
        lineGap: 2
      })
    );
  return doc.y + 18;
}

function drawTravelers(doc, booking, startY, fonts, lang) {
  const travelers = peopleTraveling(booking);
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(13)
    .fillColor(PDF_COLORS.textStrong)
    .text(pdfT(lang, "offer.travelers_title", "Who is traveling"), PAGE_MARGIN, startY, {
      width: doc.page.width - PAGE_MARGIN * 2,
      align: pdfTextAlign(lang)
    });

  const boxY = startY + 18;
  const boxWidth = doc.page.width - PAGE_MARGIN * 2;
  const lines = travelers.length
    ? travelers.map((person, index) => {
        const name = textOrNull(person?.name) || pdfT(lang, "offer.traveler_label", "Traveler {index}", { index: index + 1 });
        const extras = [];
        if (safeArray(person?.roles).includes("primary_contact")) extras.push(pdfT(lang, "offer.primary_contact", "Primary contact"));
        if (person?.nationality) extras.push(person.nationality);
        return extras.length ? `${name} (${extras.join(", ")})` : name;
      })
    : [textOrNull(booking?.web_form_submission?.name) || pdfT(lang, "offer.traveler_fallback", "Traveler details will be confirmed with you")];

  const lineHeight = 16;
  const columnCount = lines.length > 1 ? 2 : 1;
  const rows = Math.ceil(lines.length / columnCount);
  const boxHeight = 18 + lineHeight * rows;
  doc
    .save()
    .roundedRect(PAGE_MARGIN, boxY, boxWidth, boxHeight, 12)
    .fill(PDF_COLORS.surfaceMuted)
    .restore();

  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11)
    .fillColor(PDF_COLORS.textMutedStrong);
  const gutter = 18;
  const innerWidth = boxWidth - 32;
  const columnWidth = columnCount === 2 ? (innerWidth - gutter) / 2 : innerWidth;
  lines.forEach((line, index) => {
    const row = index % rows;
    const column = Math.floor(index / rows);
    const x = PAGE_MARGIN + 16 + column * (columnWidth + gutter);
    const y = boxY + 10 + row * lineHeight;
    doc.text(`• ${line}`, x, y, {
      width: columnWidth,
      align: pdfTextAlign(lang)
    });
  });

  return boxY + boxHeight + 20;
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
  const titleChoices = mixedFontChoices("bold", fonts);
  const bodyChoices = mixedFontChoices("regular", fonts);
  let height = 26;

  height += titleChoices.length
    ? measureMultifontTextHeight(doc, guideTitle, {
        width: textWidth,
        fontSize: 13,
        fontChoices: titleChoices
      })
    : doc
        .font(pdfFontName("bold", fonts))
        .fontSize(13)
        .heightOfString(guideTitle, { width: textWidth });

  const introText = profile
    ? pdfT(lang, "guide.intro_named", "{name} from Asia Travel Plan will keep this route comfortable and well paced for you.", {
        name: introName || pdfT(lang, "guide.fallback_name", "Your ATP guide")
      })
    : pdfT(lang, "guide.intro_generic", "An ATP travel specialist will be assigned to keep this route comfortable, practical, and easy to follow.");
  const bodyText = qualificationText ? `${introText} ${qualificationText}` : introText;

  height += 6 + (
    bodyChoices.length
      ? measureMultifontTextHeight(doc, bodyText, {
          width: textWidth,
          fontSize: 10.4,
          lineGap: 2,
          fontChoices: bodyChoices
        })
      : doc
          .font(pdfFontName("regular", fonts))
          .fontSize(10.4)
          .heightOfString(bodyText, { width: textWidth, lineGap: 2 })
  );

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
  const titleChoices = mixedFontChoices("bold", fonts);
  const bodyChoices = mixedFontChoices("regular", fonts);

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
  if (titleChoices.length) {
    y = drawMultifontText(doc, guideTitle, textX, y, {
      width: textWidth,
      fontSize: 13,
      fontChoices: titleChoices,
      fillColor: PDF_COLORS.textStrong
    }) + 6;
  } else {
    doc
      .font(pdfFontName("bold", fonts))
      .fontSize(13)
      .fillColor(PDF_COLORS.textStrong)
      .text(guideTitle, textX, y, pdfTextOptions(lang, { width: textWidth }));
    y = doc.y + 6;
  }

  const introText = profile
    ? pdfT(lang, "guide.intro_named", "{name} from Asia Travel Plan will keep this route comfortable and well paced for you.", {
        name: introName || pdfT(lang, "guide.fallback_name", "Your ATP guide")
      })
    : pdfT(lang, "guide.intro_generic", "An ATP travel specialist will be assigned to keep this route comfortable, practical, and easy to follow.");
  const bodyText = qualificationText ? `${introText} ${qualificationText}` : introText;

  if (bodyChoices.length) {
    drawMultifontText(doc, bodyText, textX, y, {
      width: textWidth,
      fontSize: 10.4,
      lineGap: 2,
      fontChoices: bodyChoices,
      fillColor: PDF_COLORS.textMutedStrong
    });
  } else {
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(10.4)
      .fillColor(PDF_COLORS.textMutedStrong)
      .text(bodyText, textX, y, pdfTextOptions(lang, {
        width: textWidth,
        lineGap: 2
      }));
  }

  return startY + cardHeight + 20;
}

function drawTravelPlanOverview(doc, generatedOffer, booking, startY, fonts, lang) {
  const travelPlan = generatedOffer?.travel_plan || booking?.travel_plan;
  const days = safeArray(travelPlan?.days);
  if (!days.length) return startY;

  const sectionTitle = pdfT(lang, "offer.travel_plan_title", "Travel plan overview");
  const dayBlockWidth = doc.page.width - PAGE_MARGIN * 2;
  const timingColumnWidth = 110;
  const itemTextWidth = dayBlockWidth - timingColumnWidth - 34;

  let y = startY;
  const redrawSectionHeader = (pdfDoc, nextY) => {
    pdfDoc
      .font(pdfFontName("bold", fonts))
      .fontSize(13)
      .fillColor(PDF_COLORS.textStrong)
      .text(sectionTitle, PAGE_MARGIN, nextY, {
        width: doc.page.width - PAGE_MARGIN * 2,
        align: pdfTextAlign(lang)
      });
    return nextY + 18;
  };

  y = redrawSectionHeader(doc, y);

  for (const day of days) {
    const dayTitle = `${pdfT(lang, "offer.day_label", "Day {day}", { day: Number(day?.day_number || 0) || 1 })}${textOrNull(day?.title) ? ` - ${textOrNull(day.title)}` : ""}`;
    const dayMetaParts = [];
    if (textOrNull(day?.date)) dayMetaParts.push(formatFriendlyDateOnly(day.date, lang));
    if (textOrNull(day?.overnight_location)) {
      dayMetaParts.push(pdfT(lang, "offer.overnight", "Overnight: {location}", { location: textOrNull(day.overnight_location) }));
    }
    const dayMeta = dayMetaParts.join(" · ");

    const dayTitleWidth = dayBlockWidth * 0.58;
    const dayMetaWidth = dayBlockWidth - dayTitleWidth - 24;
    doc.font(pdfFontName("bold", fonts)).fontSize(11);
    const dayTitleHeight = doc.heightOfString(dayTitle, { width: dayTitleWidth });
    doc.font(pdfFontName("regular", fonts)).fontSize(9.5);
    const dayMetaHeight = dayMeta ? doc.heightOfString(dayMeta, { width: dayMetaWidth, align: "right" }) : 0;
    const dayHeaderHeight = Math.max(30, Math.max(dayTitleHeight, dayMetaHeight) + 14);

    y = ensureSpace(doc, y, dayHeaderHeight + 14, redrawSectionHeader);
    doc
      .save()
      .roundedRect(PAGE_MARGIN, y, dayBlockWidth, dayHeaderHeight, 10)
      .fill(PDF_COLORS.surfaceMuted)
      .restore();

    doc
      .font(pdfFontName("bold", fonts))
      .fontSize(11)
      .fillColor(PDF_COLORS.textStrong)
      .text(dayTitle, PAGE_MARGIN + 12, y + 7, {
        width: dayTitleWidth,
        align: pdfTextAlign(lang)
      });

    if (dayMeta) {
      doc
        .font(pdfFontName("regular", fonts))
        .fontSize(9.5)
        .fillColor(PDF_COLORS.textMuted)
        .text(dayMeta, PAGE_MARGIN + 12 + dayTitleWidth + 12, y + 8, {
          width: dayMetaWidth,
          align: "right"
        });
    }

    y += dayHeaderHeight + 8;

    if (textOrNull(day?.notes)) {
      y = ensureSpace(doc, y, 34, redrawSectionHeader);
      doc
        .font(pdfFontName("regular", fonts))
        .fontSize(10)
        .fillColor(PDF_COLORS.textMuted)
        .text(day.notes, PAGE_MARGIN + 4, y, {
          width: dayBlockWidth - 8,
          align: pdfTextAlign(lang),
          lineGap: 1
        });
      y = doc.y + 8;
    }

    const items = safeArray(day?.services || day?.items);
    for (const item of items) {
      const timingText = formatTravelPlanTiming(item, lang, textOrNull(day?.date));
      const itemTitle = textOrNull(item?.title) || humanizeTravelPlanServiceKind(item?.kind, lang) || pdfT(lang, "offer.item_fallback", "Planned service");
      const itemMetaParts = [];
      const kindLabel = humanizeTravelPlanServiceKind(item?.kind, lang);
      const location = textOrNull(item?.location);
      if (kindLabel) itemMetaParts.push(kindLabel);
      if (location) itemMetaParts.push(location);
      const itemMeta = itemMetaParts.join(" · ");
      const itemDetails = textOrNull(item?.details);

      doc.font(pdfFontName("bold", fonts)).fontSize(10.5);
      const itemTitleHeight = doc.heightOfString(itemTitle, { width: itemTextWidth });
      doc.font(pdfFontName("regular", fonts)).fontSize(9.2);
      const itemMetaHeight = itemMeta ? doc.heightOfString(itemMeta, { width: itemTextWidth }) : 0;
      doc.font(pdfFontName("regular", fonts)).fontSize(9.8);
      const itemDetailsHeight = itemDetails ? doc.heightOfString(itemDetails, { width: itemTextWidth, lineGap: 1 }) : 0;
      const itemTimingHeight = timingText
        ? doc.heightOfString(timingText, { width: timingColumnWidth - 8 })
        : 0;
      const itemContentHeight = itemTitleHeight
        + (itemMeta ? itemMetaHeight + 3 : 0)
        + (itemDetails ? itemDetailsHeight + 4 : 0);
      const rowHeight = Math.max(34, Math.max(itemTimingHeight, itemContentHeight) + 18);

      y = ensureSpace(doc, y, rowHeight + 8, redrawSectionHeader);
      doc
        .save()
        .roundedRect(PAGE_MARGIN, y, dayBlockWidth, rowHeight, 10)
        .fill(PDF_COLORS.surface)
        .restore();

      if (timingText) {
        doc
          .font(pdfFontName("bold", fonts))
          .fontSize(9.8)
          .fillColor(PDF_COLORS.textMutedStrong)
          .text(timingText, PAGE_MARGIN + 12, y + 10, {
            width: timingColumnWidth - 10,
            align: pdfTextAlign(lang)
          });
      }

      let textY = y + 9;
      const textX = PAGE_MARGIN + 18 + timingColumnWidth;
      doc
        .font(pdfFontName("bold", fonts))
        .fontSize(10.5)
        .fillColor(PDF_COLORS.textStrong)
        .text(itemTitle, textX, textY, {
          width: itemTextWidth,
          align: pdfTextAlign(lang)
        });
      textY = doc.y;

      if (itemMeta) {
        doc
          .font(pdfFontName("regular", fonts))
          .fontSize(9.2)
          .fillColor(PDF_COLORS.textMuted)
          .text(itemMeta, textX, textY + 2, {
            width: itemTextWidth,
            align: pdfTextAlign(lang)
          });
        textY = doc.y;
      }

      if (itemDetails) {
        doc
          .font(pdfFontName("regular", fonts))
          .fontSize(9.8)
          .fillColor(PDF_COLORS.textMutedStrong)
          .text(itemDetails, textX, textY + 3, {
            width: itemTextWidth,
            align: pdfTextAlign(lang),
            lineGap: 1
          });
      }

      y += rowHeight + 6;
    }

    y += 10;
  }

  return y;
}

function drawTableHeader(doc, startY, columns, fonts, lang) {
  let x = PAGE_MARGIN;
  doc
    .save()
    .roundedRect(PAGE_MARGIN, startY, doc.page.width - PAGE_MARGIN * 2, TABLE_HEADER_HEIGHT, 10)
    .fill(PDF_COLORS.surfaceMuted)
    .restore();

  doc.font(pdfFontName("bold", fonts)).fontSize(9.25).fillColor(PDF_COLORS.textMutedStrong);
  for (const column of columns) {
    doc.text(column.label, x + TABLE_CELL_PADDING_X, startY + 8, {
      width: column.width - TABLE_CELL_PADDING_X * 2,
      align: column.align || pdfTextAlign(lang)
    });
    x += column.width;
  }
  return startY + TABLE_HEADER_HEIGHT + 10;
}

function drawSummaryCard(doc, startY, rows, fonts, title, lang) {
  const cardWidth = Math.min(420, doc.page.width - PAGE_MARGIN * 2);
  const cardX = doc.page.width - PAGE_MARGIN - cardWidth;
  const contentX = cardX + 18;
  const contentWidth = cardWidth - 36;
  const valueColumnWidth = 126;
  const labelColumnWidth = contentWidth - valueColumnWidth - 14;
  const titleHeight = 18;
  const rowGap = 8;
  const normalRowHeight = 22;
  const totalRowHeight = 26;
  const dividerGapTop = 6;
  const dividerGapBottom = 8;
  const bodyHeight = rows.reduce((sum, row) => sum + (row.isTotal ? totalRowHeight : normalRowHeight), 0);
  const dividerHeight = rows.some((row) => row.isTotal) ? dividerGapTop + dividerGapBottom + 1 : 0;
  const cardHeight = 18 + titleHeight + 14 + bodyHeight + dividerHeight;

  doc
    .save()
    .roundedRect(cardX, startY, cardWidth, cardHeight, 16)
    .lineWidth(1)
    .strokeColor(PDF_COLORS.line)
    .fillAndStroke(PDF_COLORS.surface, PDF_COLORS.line)
    .restore();

  let y = startY + 18;
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(11.5)
    .fillColor(PDF_COLORS.textMutedStrong)
      .text(title, contentX, y, {
        width: contentWidth,
        align: pdfTextAlign(lang)
      });
  y += titleHeight + 14;

  rows.forEach((row) => {
    if (row.isTotal) {
      doc
        .save()
        .moveTo(contentX, y - dividerGapTop)
        .lineTo(contentX + contentWidth, y - dividerGapTop)
        .lineWidth(1)
        .strokeColor(PDF_COLORS.line)
        .stroke()
        .restore();
      y += dividerGapBottom;
    }

    const labelFont = row.isTotal ? "bold" : "regular";
    const labelSize = row.isTotal ? 11.5 : 10.9;
    const valueSize = row.isTotal ? 11.5 : 10.9;
    const rowHeight = row.isTotal ? totalRowHeight : normalRowHeight;

    doc
      .font(pdfFontName(labelFont, fonts))
      .fontSize(labelSize)
      .fillColor(row.isTotal ? PDF_COLORS.textStrong : PDF_COLORS.textMutedStrong)
      .text(row.label, contentX, y, {
        width: labelColumnWidth,
        align: pdfTextAlign(lang)
      });
    doc
      .font(pdfFontName(labelFont, fonts))
      .fontSize(valueSize)
      .fillColor(row.isTotal ? PDF_COLORS.textStrong : PDF_COLORS.textStrong)
      .text(row.value, contentX + labelColumnWidth + 14, y, {
        width: valueColumnWidth,
        align: "right"
      });
    y += rowHeight;
  });

  return startY + cardHeight;
}

function drawPaymentTermsSummaryCard(doc, startY, rows, fonts, lang) {
  const title = pdfT(lang, "offer.payment_terms.summary_title", "PAYMENT TERMS SUMMARY");
  const cardWidth = Math.min(420, doc.page.width - PAGE_MARGIN * 2);
  const cardX = doc.page.width - PAGE_MARGIN - cardWidth;
  const contentX = cardX + 18;
  const contentWidth = cardWidth - 36;
  const valueColumnWidth = 126;
  const labelColumnWidth = contentWidth - valueColumnWidth - 14;
  const titleHeight = 18;
  const normalRowHeight = 22;
  const totalRowHeight = 26;
  const dividerGapTop = 6;
  const dividerGapBottom = 8;
  const bodyHeight = rows.reduce((sum, row) => sum + (row.isTotal ? totalRowHeight : normalRowHeight), 0);
  const dividerHeight = rows.some((row) => row.isTotal) ? dividerGapTop + dividerGapBottom + 1 : 0;
  const cardHeight = 18 + titleHeight + 14 + bodyHeight + dividerHeight;

  doc
    .save()
    .roundedRect(cardX, startY, cardWidth, cardHeight, 16)
    .lineWidth(1)
    .strokeColor(PDF_COLORS.line)
    .fillAndStroke(PDF_COLORS.surface, PDF_COLORS.line)
    .restore();

  let y = startY + 18;
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(11.5)
    .fillColor(PDF_COLORS.textMutedStrong)
      .text(title, contentX, y, {
        width: contentWidth,
        align: pdfTextAlign(lang)
      });
  y += titleHeight + 14;

  rows.forEach((row) => {
    if (row.isTotal) {
      doc
        .save()
        .moveTo(contentX, y - dividerGapTop)
        .lineTo(contentX + contentWidth, y - dividerGapTop)
        .lineWidth(1)
        .strokeColor(PDF_COLORS.line)
        .stroke()
        .restore();
      y += dividerGapBottom;
    }

    const labelFont = row.isTotal ? "bold" : "regular";
    const labelSize = row.isTotal ? 11.5 : 10.9;
    const valueSize = row.isTotal ? 11.5 : 10.9;
    const rowHeight = row.isTotal ? totalRowHeight : normalRowHeight;

    doc
      .font(pdfFontName(labelFont, fonts))
      .fontSize(labelSize)
      .fillColor(row.isTotal ? PDF_COLORS.textStrong : PDF_COLORS.textMutedStrong)
      .text(row.label, contentX, y, {
        width: labelColumnWidth,
        align: pdfTextAlign(lang)
      });
    doc
      .font(pdfFontName(labelFont, fonts))
      .fontSize(valueSize)
      .fillColor(PDF_COLORS.textStrong)
      .text(row.value, contentX + labelColumnWidth + 14, y, {
        width: valueColumnWidth,
        align: "right"
      });
    y += rowHeight;
  });

  return startY + cardHeight;
}

function formatPaymentTermAmountSpecForPdf(amountSpec, currency, formatMoneyValue, lang) {
  const mode = normalizeText(amountSpec?.mode).toUpperCase();
  if (mode === "PERCENTAGE_OF_OFFER_TOTAL") {
    const percent = Math.max(0, Number(amountSpec?.percentage_basis_points || 0)) / 100;
    const text = Number.isInteger(percent) ? String(percent) : percent.toFixed(2).replace(/\.?0+$/, "");
    return pdfT(lang, "offer.payment_term.amount_percentage", "{percent}% of total", { percent: text });
  }
  if (mode === "REMAINING_BALANCE") {
    return pdfT(lang, "offer.payment_term.amount_remaining", "Remaining balance");
  }
  return pdfT(lang, "offer.payment_term.amount_fixed", "Fixed amount {amount}", {
    amount: formatMoneyValue(amountSpec?.fixed_amount_cents, currency)
  });
}

function formatPaymentTermDueRuleForPdf(dueRule, lang) {
  const type = normalizeText(dueRule?.type).toUpperCase();
  if (type === "FIXED_DATE" && textOrNull(dueRule?.fixed_date)) {
    return pdfT(lang, "offer.payment_term.due_fixed_date", "Due on {date}", {
      date: formatFriendlyDateOnly(dueRule.fixed_date, lang)
    });
  }
  if (type === "DAYS_AFTER_ACCEPTANCE") {
    return pdfT(lang, "offer.payment_term.due_days_after_acceptance", "Due {days} days after acceptance", {
      days: Math.max(0, Number(dueRule?.days || 0))
    });
  }
  if (type === "DAYS_BEFORE_TRIP_START") {
    return pdfT(lang, "offer.payment_term.due_days_before_trip", "Due {days} days before trip start", {
      days: Math.max(0, Number(dueRule?.days || 0))
    });
  }
  if (type === "DAYS_AFTER_TRIP_START") {
    return pdfT(lang, "offer.payment_term.due_days_after_trip_start", "Due {days} days after trip start", {
      days: Math.max(0, Number(dueRule?.days || 0))
    });
  }
  if (type === "DAYS_AFTER_TRIP_END") {
    return pdfT(lang, "offer.payment_term.due_days_after_trip_end", "Due {days} days after trip end", {
      days: Math.max(0, Number(dueRule?.days || 0))
    });
  }
  return pdfT(lang, "offer.payment_term.due_on_acceptance", "Due on acceptance");
}

function drawPaymentTerms(doc, generatedOffer, startY, formatMoneyValue, fonts, lang) {
  const paymentTerms = generatedOffer?.payment_terms || generatedOffer?.offer?.payment_terms;
  const lines = safeArray(paymentTerms?.lines);
  if (!lines.length) return startY;

  const currency = generatedOffer?.currency || paymentTerms?.currency;
  const sectionTitle = pdfT(lang, "offer.payment_terms_title", "Payment terms");
  const cardWidth = doc.page.width - PAGE_MARGIN * 2;
  const labelWidth = 230;
  const amountWidth = 118;
  const metaWidth = cardWidth - labelWidth - amountWidth - 32;

  let y = startY;
  const redrawSectionHeader = (pdfDoc, nextY) => {
    pdfDoc
      .font(pdfFontName("bold", fonts))
      .fontSize(13)
      .fillColor(PDF_COLORS.textStrong)
      .text(sectionTitle, PAGE_MARGIN, nextY, {
        width: doc.page.width - PAGE_MARGIN * 2,
        align: pdfTextAlign(lang)
      });
    return nextY + 18;
  };

  y = redrawSectionHeader(doc, y);

  for (const [index, line] of lines.entries()) {
    const label = textOrNull(line?.label)
      || pdfT(lang, "offer.payment_term.default_label", "Payment term {index}", { index: index + 1 });
    const amountText = formatMoneyValue(line?.resolved_amount_cents, currency);
    const meta = [
      formatPaymentTermAmountSpecForPdf(line?.amount_spec, currency, formatMoneyValue, lang),
      formatPaymentTermDueRuleForPdf(line?.due_rule, lang)
    ].filter(Boolean).join(" · ");
    const description = textOrNull(line?.description);

    doc.font(pdfFontName("bold", fonts)).fontSize(10.6);
    const labelHeight = doc.heightOfString(label, pdfTextOptions(lang, { width: labelWidth }));
    doc.font(pdfFontName("regular", fonts)).fontSize(10);
    const metaHeight = meta ? doc.heightOfString(meta, pdfTextOptions(lang, { width: metaWidth })) : 0;
    const descriptionHeight = description
      ? doc.heightOfString(description, pdfTextOptions(lang, { width: cardWidth - 28, lineGap: 1 }))
      : 0;
    const amountHeight = doc.heightOfString(amountText, { width: amountWidth, align: "right" });
    const rowHeight = Math.max(34, Math.max(labelHeight + metaHeight + 4, amountHeight) + descriptionHeight + 18);

    y = ensureSpace(doc, y, rowHeight + 8, redrawSectionHeader);
    doc
      .save()
      .roundedRect(PAGE_MARGIN, y, cardWidth, rowHeight, 12)
      .fill(PDF_COLORS.surface)
      .restore();

    doc
      .font(pdfFontName("bold", fonts))
      .fontSize(10.6)
      .fillColor(PDF_COLORS.textStrong)
      .text(label, PAGE_MARGIN + 14, y + 10, pdfTextOptions(lang, {
        width: labelWidth
      }));

    doc
      .font(pdfFontName("bold", fonts))
      .fontSize(10.8)
      .fillColor(PDF_COLORS.textStrong)
      .text(amountText, doc.page.width - PAGE_MARGIN - amountWidth - 14, y + 10, {
        width: amountWidth,
        align: "right"
      });

    if (meta) {
      doc
        .font(pdfFontName("regular", fonts))
        .fontSize(10)
        .fillColor(PDF_COLORS.textMuted)
        .text(meta, PAGE_MARGIN + 14, y + 26, pdfTextOptions(lang, {
          width: metaWidth + labelWidth - 10
        }));
    }

    if (description) {
      doc
        .font(pdfFontName("regular", fonts))
        .fontSize(9.8)
        .fillColor(PDF_COLORS.textMutedStrong)
        .text(description, PAGE_MARGIN + 14, y + 26 + metaHeight + 4, pdfTextOptions(lang, {
          width: cardWidth - 28,
          lineGap: 1
        }));
    }

    y += rowHeight + 8;
  }

  const basisTotal = Number(paymentTerms?.basis_total_amount_cents || generatedOffer?.total_price_cents || 0);
  const scheduledTotal = Number(
    paymentTerms?.scheduled_total_amount_cents
    || lines.reduce((sum, line) => sum + Math.max(0, Number(line?.resolved_amount_cents || 0)), 0)
  );
  const summaryRows = [
    {
      label: pdfT(lang, "offer.payment_terms.basis_total", "Offer total"),
      value: formatMoneyValue(basisTotal, currency)
    },
    {
      label: pdfT(lang, "offer.payment_terms.scheduled_total", "Scheduled total"),
      value: formatMoneyValue(scheduledTotal, currency)
    }
  ];
  const summaryCardHeight = 18 + 18 + 14
    + summaryRows.reduce((sum, row) => sum + (row.isTotal ? 26 : 22), 0)
    + (summaryRows.some((row) => row.isTotal) ? 15 : 0);
  y = ensureSpace(doc, y, summaryCardHeight + 8, redrawSectionHeader);
  y = drawPaymentTermsSummaryCard(doc, y, summaryRows, fonts, lang);

  const notes = textOrNull(paymentTerms?.notes);
  if (notes) {
    y = ensureSpace(doc, y + 8, 54, redrawSectionHeader);
    doc
      .font(pdfFontName("bold", fonts))
      .fontSize(11)
      .fillColor(PDF_COLORS.textMutedStrong)
      .text(pdfT(lang, "offer.payment_terms.notes", "Notes"), PAGE_MARGIN, y + 8, pdfTextOptions(lang, {
        width: cardWidth
      }));
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(10)
      .fillColor(PDF_COLORS.textMutedStrong)
      .text(notes, PAGE_MARGIN, y + 24, pdfTextOptions(lang, {
        width: cardWidth,
        lineGap: 1
      }));
    y = doc.y + 8;
  }

  return y + 10;
}

function drawOfferTable(doc, generatedOffer, startY, formatMoneyValue, fonts, lang) {
  const columns = [
    { key: "category", label: pdfT(lang, "offer.table.category", "Category"), width: 86 },
    { key: "details", label: pdfT(lang, "offer.table.details", "Details"), width: 141 },
    { key: "quantity", label: pdfT(lang, "offer.table.quantity", "Quantity"), width: 62, align: "right" },
    { key: "single", label: pdfT(lang, "offer.table.single", "Unit"), width: 98, align: "right" },
    { key: "total", label: pdfT(lang, "offer.table.total", "Total"), width: 120, align: "right" }
  ];
  let y = startY;
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(13)
    .fillColor(PDF_COLORS.textStrong)
    .text(pdfT(lang, "offer.table_title", "Offer details"), PAGE_MARGIN, y, {
      width: doc.page.width - PAGE_MARGIN * 2,
      align: pdfTextAlign(lang)
    });
  y += 18;

  const redrawHeader = (pdfDoc, nextY) => drawTableHeader(pdfDoc, nextY, columns, fonts, lang);
  y = drawTableHeader(doc, y, columns, fonts, lang);

  const components = safeArray(generatedOffer?.offer?.components);
  const discount = generatedOffer?.offer?.discount && typeof generatedOffer.offer.discount === "object"
    ? generatedOffer.offer.discount
    : null;
  const rows = [
    ...components.map((component) => ({
      category: categoryLabel(component),
      categoryTax: formatTaxRateLabel(component?.tax_rate_basis_points, lang),
      details: textOrNull(component?.details) || "—",
      quantity: String(Number(component?.quantity || 1)),
      unitText: formatMoneyValue(
        component?.unit_total_amount_cents ?? component?.unit_amount_cents,
        generatedOffer?.currency
      ),
      totalText: formatMoneyValue(
        component?.line_gross_amount_cents ?? component?.line_total_amount_cents,
        generatedOffer?.currency
      )
    })),
    ...(discount && Number(discount?.amount_cents || 0) > 0
      ? [{
          category: pdfT(lang, "offer.discount", "Discount"),
          categoryTax: pdfT(lang, "offer.discount_adjustment", "Final adjustment"),
          details: textOrNull(discount?.reason) || "—",
          quantity: "—",
          unitText: "—",
          totalText: formatMoneyValue(-Math.max(0, Number(discount?.amount_cents || 0)), generatedOffer?.currency)
        }]
      : [])
  ];
  if (!rows.length) {
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(10.5)
      .fillColor(PDF_COLORS.textMuted)
      .text(pdfT(lang, "offer.table_empty", "No offer items were included in this version of the offer."), PAGE_MARGIN, y, pdfTextOptions(lang, {
        width: doc.page.width - PAGE_MARGIN * 2
      }));
    return doc.y + 18;
  }

  for (const row of rows) {
    const category = row.category;
    const categoryTax = row.categoryTax;
    const details = row.details;
    const quantity = row.quantity;
    const unitText = row.unitText;
    const totalText = row.totalText;
    doc.font(pdfFontName("regular", fonts)).fontSize(10.5);
    const categoryTextHeight = doc.heightOfString(category, {
      width: columns[0].width - TABLE_CELL_PADDING_X * 2,
      align: pdfTextAlign(lang)
    });
    doc.font(pdfFontName("regular", fonts)).fontSize(8.8);
    const categoryTaxHeight = doc.heightOfString(categoryTax, {
      width: columns[0].width - TABLE_CELL_PADDING_X * 2,
      align: pdfTextAlign(lang)
    });
    doc.font(pdfFontName("regular", fonts)).fontSize(10.5);
    const rowHeight = Math.max(
      24,
      categoryTextHeight + categoryTaxHeight + 2,
    doc.heightOfString(details, { width: columns[1].width - TABLE_CELL_PADDING_X * 2, align: pdfTextAlign(lang) }),
      doc.heightOfString(quantity, { width: columns[2].width - TABLE_CELL_PADDING_X * 2, align: "right" }),
      doc.heightOfString(unitText, { width: columns[3].width - TABLE_CELL_PADDING_X * 2, align: "right" }),
      doc.heightOfString(totalText, { width: columns[4].width - TABLE_CELL_PADDING_X * 2, align: "right" })
    ) + TABLE_CELL_PADDING_Y * 2;

    y = ensureSpace(doc, y, rowHeight + 24, redrawHeader);

    doc
      .save()
      .roundedRect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, rowHeight, 10)
      .fill(PDF_COLORS.surface)
      .restore();

    let x = PAGE_MARGIN;

    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(10.5)
      .fillColor(PDF_COLORS.textStrong)
        .text(category, x + TABLE_CELL_PADDING_X, y + TABLE_CELL_PADDING_Y, {
          width: columns[0].width - TABLE_CELL_PADDING_X * 2,
          align: pdfTextAlign(lang)
        });

    const categoryTaxY = y + TABLE_CELL_PADDING_Y + categoryTextHeight + 2;
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(8.8)
      .fillColor(PDF_COLORS.textMuted)
      .text(categoryTax, x + TABLE_CELL_PADDING_X, categoryTaxY, {
        width: columns[0].width - TABLE_CELL_PADDING_X * 2,
        align: pdfTextAlign(lang)
      });

    x += columns[0].width;
    const values = [details, quantity, unitText, totalText];
    for (let index = 1; index < columns.length; index += 1) {
      const column = columns[index];
      const value = values[index - 1];
      doc
        .font(pdfFontName("regular", fonts))
        .fontSize(10.5)
        .fillColor(PDF_COLORS.textStrong)
        .text(value, x + TABLE_CELL_PADDING_X, y + TABLE_CELL_PADDING_Y, {
          width: column.width - TABLE_CELL_PADDING_X * 2,
          align: column.align || pdfTextAlign(lang)
        });
      x += column.width;
    }

    doc
      .save()
      .moveTo(PAGE_MARGIN, y + rowHeight + 4)
      .lineTo(doc.page.width - PAGE_MARGIN, y + rowHeight + 4)
      .lineWidth(0.5)
      .strokeColor(PDF_COLORS.line)
      .stroke()
      .restore();

    y += rowHeight + TABLE_ROW_GAP;
  }

  const quotationSummary = deriveOfferQuotationSummary(generatedOffer?.offer);

  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(12)
    .fillColor(PDF_COLORS.textStrong)
    .text(pdfT(lang, "offer.total", "Total (including tax)"), PAGE_MARGIN + columns[0].width + columns[1].width, y + 6, {
      width: columns[2].width + columns[3].width - 12,
      align: "right"
    });
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(12)
    .fillColor(PDF_COLORS.textStrong)
    .text(formatMoneyValue(
      quotationSummary?.grand_total_amount_cents ?? generatedOffer?.total_price_cents,
      generatedOffer?.currency
    ), PAGE_MARGIN + columns[0].width + columns[1].width + columns[2].width + columns[3].width, y + 6, {
      width: columns[4].width - 8,
      align: "right"
    });
  y += 32;

  const summaryRows = [
    {
      label: pdfT(lang, "offer.subtotal_before_tax", "Subtotal before tax"),
      value: formatMoneyValue(quotationSummary?.subtotal_net_amount_cents, generatedOffer?.currency)
    },
    ...safeArray(quotationSummary?.tax_breakdown)
      .filter((bucket) => Number(bucket?.tax_amount_cents || 0) !== 0)
      .map((bucket) => ({
        label: formatTaxRateLabel(bucket.tax_rate_basis_points, lang),
        value: formatMoneyValue(bucket.tax_amount_cents, generatedOffer?.currency)
      })),
    {
      label: pdfT(lang, "offer.total_with_tax", "Total with tax"),
      value: formatMoneyValue(
        quotationSummary?.grand_total_amount_cents ?? generatedOffer?.total_price_cents,
        generatedOffer?.currency
      ),
      isTotal: true
    }
  ];
  const summaryCardHeight = 18 + 18 + 14
    + summaryRows.reduce((sum, row) => sum + (row.isTotal ? 26 : 22), 0)
    + (summaryRows.some((row) => row.isTotal) ? 15 : 0);
  const redrawNothing = (_pdfDoc, nextY) => nextY;
  y = ensureSpace(doc, y, summaryCardHeight + 8, redrawNothing);
  y = drawSummaryCard(
    doc,
    y,
    summaryRows,
    fonts,
    pdfT(lang, "offer.quotation_tax_summary", "QUOTATION TAX SUMMARY"),
    lang
  );

  return y + 10;
}

function buildClosingBody(generatedOffer, formatMoneyValue, lang) {
  const routeMode = normalizeText(generatedOffer?.booking_confirmation_route?.mode).toUpperCase();
  if (routeMode === "DEPOSIT_PAYMENT") {
    const routeRule = generatedOffer?.booking_confirmation_route?.deposit_rule && typeof generatedOffer.booking_confirmation_route.deposit_rule === "object"
      ? generatedOffer.booking_confirmation_route.deposit_rule
      : null;
    const paymentLabel = textOrNull(routeRule?.payment_term_label) || pdfT(lang, "offer.payment_term.default_label", "Payment term {index}", { index: 1 });
    const paymentAmount = formatMoneyValue(
      Number(routeRule?.required_amount_cents || generatedOffer?.total_price_cents || 0),
      routeRule?.currency || generatedOffer?.currency
    );
    return pdfT(
      lang,
      "offer.closing_body_deposit",
      "To confirm this offer, please pay the {label} of {amount}. Once we receive this payment, we will confirm your booking and guide you through the next steps.",
      {
        label: paymentLabel,
        amount: paymentAmount
      }
    );
  }
  if (routeMode === "OTP") {
    return pdfT(
      lang,
      "offer.closing_body_otp",
      "To confirm this offer, please use the secure OTP confirmation link we sent you. After the one-time verification, we will confirm the next steps with you."
    );
  }
  return pdfT(
    lang,
    "offer.closing_body",
    "If this offer feels right for you, simply respond to us by email or WhatsApp and we will be happy to confirm next steps, refine details, and help you move toward booking."
  );
}

function buildAttachmentClosingNote(attachmentCount, lang) {
  const count = Number(attachmentCount) || 0;
  if (count <= 0) return "";
  return count === 1
    ? pdfT(lang, "pdf.attachment_note_single", "Please also find the attached additional PDF at the end of this document.")
    : pdfT(lang, "pdf.attachment_note_multiple", "Please also find the attached additional PDFs at the end of this document.");
}

function drawClosing(doc, startY, fonts, lang, generatedOffer, formatMoneyValue, attachmentCount = 0) {
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11)
    .fillColor(PDF_COLORS.textMutedStrong)
    .text(
      buildClosingBody(generatedOffer, formatMoneyValue, lang),
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
    .text(pdfT(lang, "offer.closing_regards", "Warm regards,"), PAGE_MARGIN, signY, {
      width: doc.page.width - PAGE_MARGIN * 2,
      align: pdfTextAlign(lang)
    });
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(12)
    .fillColor(PDF_COLORS.textStrong)
    .text(pdfT(lang, "offer.closing_team", "The Asia Travel Plan Team"), PAGE_MARGIN, signY + 18, {
      width: doc.page.width - PAGE_MARGIN * 2,
      align: pdfTextAlign(lang)
    });
  return doc.y + 10;
}

function fallbackFormatMoney(currency, amountCents, lang) {
  return formatPdfMoney(amountCents, currency, lang);
}

export function createOfferPdfWriter({
  generatedOfferPdfPath,
  bookingImagesDir,
  readTours,
  resolveTourImageDiskPath,
  resolveAssignedAtpStaffProfile,
  resolveAtpStaffPhotoDiskPath,
  logoPath,
  fallbackImagePath,
  travelPlanAttachmentsDir,
  companyProfile,
  formatMoney
}) {
  return async function writeGeneratedOfferPdf(generatedOffer, booking) {
    const lang = normalizePdfLang(generatedOffer?.lang || booking?.customer_language || booking?.web_form_submission?.preferred_language || "en");
    const renderMoney = (amountCents, currency) => fallbackFormatMoney(currency, amountCents, lang);
    const outputPath = generatedOfferPdfPath(generatedOffer.id);
    await mkdir(path.dirname(outputPath), { recursive: true });
    const attachmentPaths = resolveOfferAttachmentPaths(generatedOffer, booking, travelPlanAttachmentsDir);

    const guideContext = await resolveAtpGuidePdfContext({
      booking,
      generatedOffer,
      resolveAssignedAtpStaffProfile,
      resolveAtpStaffPhotoDiskPath
    });

    const [logoImage, heroPath, baseFonts, accentFonts, heroTitle, guidePhoto] = await Promise.all([
      rasterizeImage(logoPath, { width: 1000 }),
      resolveBookingImageForPdf({ booking, bookingImagesDir, readTours, resolveTourImageDiskPath }),
      resolvePdfFontsForLang({
        lang,
        regularCandidates: PDF_FONT_REGULAR_CANDIDATES,
        boldCandidates: PDF_FONT_BOLD_CANDIDATES
      }),
      resolvePdfFontsForLang({
        lang: "vi",
        sampleText: [
          textOrNull(resolveAtpStaffFullName(guideContext?.profile)),
          textOrNull(resolveAtpGuideIntroName(guideContext?.profile))
        ].filter(Boolean).join(" "),
        regularCandidates: PDF_FONT_REGULAR_CANDIDATES,
        boldCandidates: PDF_FONT_BOLD_CANDIDATES
      }),
      resolveBookingHeroTitle(booking, lang, readTours),
      guideContext?.photoDiskPath
        ? rasterizeImage(guideContext.photoDiskPath, {
            width: 420,
            height: 420
          }).catch(() => null)
        : null
    ]);
    const fonts = {
      ...(baseFonts || {}),
      accentRegular: accentFonts?.regular || null,
      accentBold: accentFonts?.bold || accentFonts?.regular || null
    };
    const heroImage = await rasterizeImage(heroPath || fallbackImagePath, { width: 1200, height: 780 });

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: PAGE_SIZE,
        margin: 0,
        autoFirstPage: true,
        compress: false,
        info: {
          Title: `${heroTitle} ${pdfT(lang, "offer.subject", "Travel Offer")}`,
          Author: companyProfile.name,
          Subject: pdfT(lang, "offer.subject", "Travel Offer")
        }
      });
      const stream = createWriteStream(outputPath);
      doc.pipe(stream);
      stream.on("finish", resolve);
      stream.on("error", reject);
      doc.on("error", reject);

      registerPdfFonts(doc, fonts);

      let y = drawTopHeader(doc, companyProfile, logoImage, fonts, lang);
      y = drawHero(doc, heroTitle, booking, generatedOffer, heroImage, y, fonts, lang);
      y = drawIntro(doc, y, fonts, lang);
      y = drawTravelers(doc, booking, y, fonts, lang);
      y = ensureSpace(doc, y, estimateGuideSectionHeight(doc, guideContext, fonts, lang) + 10);
      y = drawGuideSection(doc, y, fonts, lang, guideContext, guidePhoto);
      if (safeArray(generatedOffer?.travel_plan?.days || booking?.travel_plan?.days).length) {
        y = startSectionOnNewPage(doc);
        y = drawTravelPlanOverview(doc, generatedOffer, booking, y, fonts, lang);
      }
      y = startSectionOnNewPage(doc);
      y = drawOfferTable(doc, generatedOffer, y, renderMoney, fonts, lang);
      if (safeArray(generatedOffer?.payment_terms?.lines || generatedOffer?.offer?.payment_terms?.lines).length) {
        y = startSectionOnNewPage(doc);
        y = drawPaymentTerms(doc, generatedOffer, y, renderMoney, fonts, lang);
      }
      y = ensureSpace(doc, y, 90);
      y = drawClosing(doc, y + 18, fonts, lang, generatedOffer, renderMoney, attachmentPaths.length);

      drawDivider(doc, doc.page.height - PAGE_MARGIN - 12);
      doc
        .font(pdfFontName("regular", fonts))
        .fontSize(8.5)
        .fillColor(PDF_COLORS.textMuted)
        .text(
          `${companyProfile.name} · ${companyProfile.website} · ${companyProfile.email} · ${companyProfile.whatsapp}`,
          PAGE_MARGIN,
          doc.page.height - PAGE_MARGIN,
          { width: doc.page.width - PAGE_MARGIN * 2, align: "center" }
        );

      doc.end();
    });

    if (attachmentPaths.length) {
      await appendPdfAttachmentsToFile(outputPath, attachmentPaths);
    } else {
      await trimTrailingBlankPagesInFile(outputPath);
    }

    const pdfBuffer = await readFile(outputPath);
    return {
      outputPath,
      sha256: createHash("sha256").update(pdfBuffer).digest("hex")
    };
  };
}
