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
import {
  buildTravelPlanItemThumbnailMap,
  drawTravelPlanDaysSection
} from "./pdf_travel_plan_section.js";
import { pdfTheme } from "./style_tokens.js";
import { normalizeText } from "./text.js";
import { resolveLocalizedText } from "../domain/booking_content_i18n.js";
import {
  resolveAtpGuideIntroName,
  resolveAtpGuidePdfContext,
  resolveAtpGuideShortDescriptionText,
  resolveAtpStaffFullName
} from "./atp_staff_pdf.js";
import {
  resolveBookingPdfCountryLabels,
  resolveBookingPdfPersonalizationText,
  resolveBookingPdfTravelStyleLabels
} from "./booking_pdf_personalization.js";
import { drawPdfTravelersSection } from "./pdf_travelers_section.js";

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
  "/usr/local/share/fonts/extracted/NotoSansCJKjp-Regular.ttf",
  "/usr/local/share/fonts/extracted/NotoSansCJKsc-Regular.ttf",
  "/usr/local/share/fonts/extracted/NotoSansCJKkr-Regular.ttf",
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
  "/usr/local/share/fonts/extracted/NotoSansCJKjp-Bold.ttf",
  "/usr/local/share/fonts/extracted/NotoSansCJKsc-Bold.ttf",
  "/usr/local/share/fonts/extracted/NotoSansCJKkr-Bold.ttf",
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

function isSyntheticTripTotalLabel(value) {
  return normalizeText(value).toLowerCase() === "trip total";
}

function isSyntheticDailyLabel(value, dayNumber = null) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return false;
  if (normalized === "daily total") return true;
  if (/^day\s+\d+$/.test(normalized)) return true;
  return Number.isInteger(Number(dayNumber)) && normalized === `day ${Number(dayNumber)}`;
}

function isSyntheticAdditionalItemLabel(value) {
  return /^additional item(?:\s+\d+)?$/i.test(normalizeText(value));
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

function formatVisiblePricingLabel(item, lang) {
  const dayNumber = Number(item?.day_number || 0);
  if (Number.isInteger(dayNumber) && dayNumber >= 1) {
    return pdfT(lang, "offer.day_label", "Day {day}", { day: dayNumber });
  }
  return pdfT(lang, "offer.trip_label", "Trip");
}

function buildOfferTableRows(generatedOffer, formatMoneyValue, lang) {
  const offer = generatedOffer?.offer && typeof generatedOffer.offer === "object" ? generatedOffer.offer : {};
  const visiblePricing = offer?.visible_pricing && typeof offer.visible_pricing === "object"
    ? offer.visible_pricing
    : null;
  const currency = generatedOffer?.currency || offer?.currency;
  const discount = offer?.discount && typeof offer.discount === "object" ? offer.discount : null;

  let mainRows = [];
  if (visiblePricing?.detail_level === "trip" && visiblePricing?.trip_price) {
    const tripPrice = visiblePricing.trip_price;
    const customTripLabel = textOrNull(tripPrice?.label) && !isSyntheticTripTotalLabel(tripPrice?.label)
      ? textOrNull(tripPrice?.label)
      : null;
    mainRows = [{
      category: pdfT(lang, "offer.trip_label", "Trip"),
      categoryTax: customTripLabel || pdfT(lang, "offer.trip_total", "Trip total"),
      details: customTripLabel || "—",
      quantity: "—",
      unitText: "—",
      totalText: formatMoneyValue(
        tripPrice?.line_gross_amount_cents ?? tripPrice?.line_total_amount_cents ?? tripPrice?.amount_cents,
        currency
      )
    }];
  } else if (visiblePricing?.detail_level === "day" && visiblePricing?.derivable !== false && safeArray(visiblePricing?.days).length) {
    mainRows = safeArray(visiblePricing.days).map((dayPrice) => {
      const customDayLabel = textOrNull(dayPrice?.label) && !isSyntheticDailyLabel(dayPrice?.label, dayPrice?.day_number)
        ? textOrNull(dayPrice?.label)
        : null;
      return {
        category: formatVisiblePricingLabel(dayPrice, lang),
        categoryTax: customDayLabel || pdfT(lang, "offer.daily_total", "Daily total"),
        details: customDayLabel || "—",
        quantity: "—",
        unitText: "—",
        totalText: formatMoneyValue(
          dayPrice?.line_gross_amount_cents ?? dayPrice?.line_total_amount_cents ?? dayPrice?.amount_cents,
          currency
        )
      };
    });
  }

  const additionalItemRows = safeArray(visiblePricing?.additional_items || offer?.additional_items).map((item) => {
    const customLabel = textOrNull(item?.label) && !isSyntheticAdditionalItemLabel(item?.label)
      ? textOrNull(item?.label)
      : null;
    return {
      category: Number.isInteger(Number(item?.day_number)) && Number(item?.day_number) >= 1
        ? pdfT(lang, "offer.additional_item_day", "Additional item · Day {day}", { day: Number(item.day_number) })
        : pdfT(lang, "offer.additional_item", "Additional item"),
      categoryTax: formatTaxRateLabel(item?.tax_rate_basis_points, lang),
      details: [customLabel, textOrNull(item?.details)].filter(Boolean).join(" · ") || "—",
      quantity: String(Number(item?.quantity || 1)),
      unitText: formatMoneyValue(
        item?.unit_total_amount_cents ?? item?.unit_amount_cents,
        currency
      ),
      totalText: formatMoneyValue(
        item?.line_gross_amount_cents ?? item?.line_total_amount_cents,
        currency
      )
    };
  });

  const discountRows = discount && Number(discount?.amount_cents || 0) > 0
    ? [{
        category: pdfT(lang, "offer.discount", "Discount"),
        categoryTax: pdfT(lang, "offer.discount_adjustment", "Final adjustment"),
        details: textOrNull(discount?.reason) || "—",
        quantity: "—",
        unitText: "—",
        totalText: formatMoneyValue(-Math.max(0, Number(discount?.amount_cents || 0)), currency)
      }]
    : [];

  return [...mainRows, ...additionalItemRows, ...discountRows];
}

function deriveOfferQuotationSummary(offer) {
  const source = offer && typeof offer === "object" ? offer : {};
  const provided = source.quotation_summary && typeof source.quotation_summary === "object"
    ? source.quotation_summary
    : null;
  if (provided) return provided;

  const internalDetailLevel = normalizeText(source?.offer_detail_level_internal).toLowerCase() || "trip";
  const dayPrices = internalDetailLevel === "day" ? safeArray(source.days_internal) : [];
  const tripPrice = internalDetailLevel === "trip" && source?.trip_price_internal ? source.trip_price_internal : null;
  const additionalItems = safeArray(source.additional_items);
  const discount = source.discount && typeof source.discount === "object" ? source.discount : null;
  const buckets = new Map();
  let subtotal = 0;
  let totalTax = 0;
  let totalGross = 0;
  const chargeLines = [
    ...dayPrices,
    ...(tripPrice ? [tripPrice] : []),
    ...additionalItems
  ];
  for (const component of chargeLines) {
    const basisPoints = Math.max(0, Number(component?.tax_rate_basis_points || 0));
    const net = Number(component?.line_net_amount_cents ?? component?.amount_cents ?? component?.line_total_amount_cents ?? 0) || 0;
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

function getContentBottomLimit(doc) {
  return doc.page.height - PAGE_MARGIN - 24;
}

function getSinglePageContentCapacity(doc) {
  return getContentBottomLimit(doc) - PAGE_MARGIN;
}

function keepSectionTogetherIfPossible(doc, currentY, estimatedHeight, headerRedraw = null) {
  if (!Number.isFinite(estimatedHeight) || estimatedHeight <= 0) return currentY;
  if (estimatedHeight > getSinglePageContentCapacity(doc)) return currentY;
  return ensureSpace(doc, currentY, estimatedHeight, headerRedraw);
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
  const heroSubtitle = resolveOfferSubtitle(booking, generatedOffer, lang);
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
  const booking = doc.__booking_for_offer_pdf || null;
  const welcomeText = resolveOfferWelcomeText(booking, lang);
  if (!welcomeText) {
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

  let y = startY;
  if (welcomeText) {
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(11.5)
      .fillColor(PDF_COLORS.textMutedStrong)
      .text(
        welcomeText,
        PAGE_MARGIN,
        y,
        pdfTextOptions(lang, {
          width: doc.page.width - PAGE_MARGIN * 2,
          lineGap: 2
        })
      );
    y = doc.y + 12;
  }
  return y;
}

function estimateGuideSectionHeight(doc, guideContext, fonts, lang) {
  const profile = guideContext?.profile || null;
  const qualificationText = textOrNull(resolveAtpGuideShortDescriptionText(guideContext, lang));
  const guideFullName = textOrNull(resolveAtpStaffFullName(profile));
  const introName = textOrNull(resolveAtpGuideIntroName(profile));
  const guideTitle = guideFullName
    ? pdfT(lang, "guide.section_title_named", "Our team member {name} will assist you", { name: guideFullName })
    : pdfT(lang, "guide.section_title_fallback", "Our team member will assist you");
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
  const bodyText = qualificationText || introText;

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
  const qualificationText = textOrNull(resolveAtpGuideShortDescriptionText(guideContext, lang));
  const guideFullName = textOrNull(resolveAtpStaffFullName(profile));
  const introName = textOrNull(resolveAtpGuideIntroName(profile));
  const guideTitle = guideFullName
    ? pdfT(lang, "guide.section_title_named", "Our team member {name} will assist you", { name: guideFullName })
    : pdfT(lang, "guide.section_title_fallback", "Our team member will assist you");
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
  const bodyText = qualificationText || introText;

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

function drawTravelPlanOverview(doc, generatedOffer, booking, startY, fonts, lang, itemThumbnailMap) {
  const travelPlan = generatedOffer?.travel_plan || booking?.travel_plan;
  return drawTravelPlanDaysSection({
    doc,
    startY,
    plan: travelPlan,
    itemThumbnailMap,
    fonts,
    lang,
    colors: PDF_COLORS,
    pdfFontName,
    pdfTextOptions,
    pdfT,
    formatPdfDateOnly,
    pageMargin: PAGE_MARGIN,
    bottomLimit: () => doc.page.height - PAGE_MARGIN - 24,
    addContinuationPage: () => startSectionOnNewPage(doc),
    sectionTitle: pdfT(lang, "offer.travel_plan_title", "Travel plan overview"),
    emptyStateMessage: pdfT(lang, "travel_plan.empty", "No travel plan is available yet."),
    sectionTitleFontSize: 13
  });
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

function resolveOfferTableColumns(generatedOffer, lang) {
  const visibleDetailLevel = normalizeText(generatedOffer?.offer?.visible_pricing?.detail_level).toLowerCase();
  const isTripVisibleDetail = visibleDetailLevel === "trip";
  const columns = isTripVisibleDetail
    ? [
        { key: "category", label: pdfT(lang, "offer.table.category", "Category"), width: 120 },
        { key: "details", label: pdfT(lang, "offer.table.details", "Details"), width: 278 },
        { key: "total", label: pdfT(lang, "offer.table.total", "Total"), width: 109, align: "right" }
      ]
    : [
        { key: "category", label: pdfT(lang, "offer.table.category", "Category"), width: 86 },
        { key: "details", label: pdfT(lang, "offer.table.details", "Details"), width: 141 },
        { key: "quantity", label: pdfT(lang, "offer.table.quantity", "Quantity"), width: 62, align: "right" },
        { key: "single", label: pdfT(lang, "offer.table.single", "Unit"), width: 98, align: "right" },
        { key: "total", label: pdfT(lang, "offer.table.total", "Total"), width: 120, align: "right" }
      ];
  return { columns, isTripVisibleDetail };
}

function measureOfferTableRowHeight(doc, row, columns, isTripVisibleDetail, fonts, lang) {
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

  return Math.max(
    24,
    categoryTextHeight + categoryTaxHeight + 2,
    doc.heightOfString(details, { width: columns[1].width - TABLE_CELL_PADDING_X * 2, align: pdfTextAlign(lang) }),
    ...(isTripVisibleDetail
      ? [
          doc.heightOfString(totalText, { width: columns[2].width - TABLE_CELL_PADDING_X * 2, align: "right" })
        ]
      : [
          doc.heightOfString(quantity, { width: columns[2].width - TABLE_CELL_PADDING_X * 2, align: "right" }),
          doc.heightOfString(unitText, { width: columns[3].width - TABLE_CELL_PADDING_X * 2, align: "right" }),
          doc.heightOfString(totalText, { width: columns[4].width - TABLE_CELL_PADDING_X * 2, align: "right" })
        ])
  ) + TABLE_CELL_PADDING_Y * 2;
}

function estimateOfferTableHeight(doc, generatedOffer, formatMoneyValue, fonts, lang) {
  const { columns, isTripVisibleDetail } = resolveOfferTableColumns(generatedOffer, lang);
  let height = 18;
  height += TABLE_HEADER_HEIGHT + 10;

  const rows = buildOfferTableRows(generatedOffer, formatMoneyValue, lang);
  if (!rows.length) {
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(10.5);
    height += doc.heightOfString(
      pdfT(lang, "offer.table_empty", "No offer items were included in this version of the offer."),
      pdfTextOptions(lang, { width: doc.page.width - PAGE_MARGIN * 2 })
    ) + 18;
    return height;
  }

  for (const row of rows) {
    height += measureOfferTableRowHeight(doc, row, columns, isTripVisibleDetail, fonts, lang) + TABLE_ROW_GAP;
  }

  const quotationSummary = deriveOfferQuotationSummary(generatedOffer?.offer);
  const hasTaxSummary = Number(quotationSummary?.total_tax_amount_cents || 0) !== 0;
  height += 32;
  if (!hasTaxSummary) return height + 10;

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
  return height + summaryCardHeight + 10;
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

function measurePaymentTermCardHeight(doc, line, currency, formatMoneyValue, fonts, lang, cardWidth, labelWidth, amountWidth, metaWidth) {
  const label = textOrNull(line?.label)
    || pdfT(lang, "offer.payment_term.default_label", "Payment term {index}", { index: 1 });
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

  return Math.max(34, Math.max(labelHeight + metaHeight + 4, amountHeight) + descriptionHeight + 18);
}

function estimatePaymentTermsHeight(doc, generatedOffer, formatMoneyValue, fonts, lang) {
  const paymentTerms = generatedOffer?.payment_terms || generatedOffer?.offer?.payment_terms;
  const lines = safeArray(paymentTerms?.lines);
  if (!lines.length) return 0;

  const currency = generatedOffer?.currency || paymentTerms?.currency;
  const cardWidth = doc.page.width - PAGE_MARGIN * 2;
  const labelWidth = 230;
  const amountWidth = 118;
  const metaWidth = cardWidth - labelWidth - amountWidth - 32;

  let height = 18;
  for (const line of lines) {
    height += measurePaymentTermCardHeight(doc, line, currency, formatMoneyValue, fonts, lang, cardWidth, labelWidth, amountWidth, metaWidth) + 8;
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
  height += summaryCardHeight;

  const notes = textOrNull(paymentTerms?.notes);
  if (notes) {
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(10);
    const notesHeight = doc.heightOfString(notes, pdfTextOptions(lang, {
      width: cardWidth,
      lineGap: 1
    }));
    height += Math.max(54, 40 + notesHeight);
  }

  return height + 10;
}

function drawOfferTable(doc, generatedOffer, startY, formatMoneyValue, fonts, lang) {
  const visibleDetailLevel = normalizeText(generatedOffer?.offer?.visible_pricing?.detail_level).toLowerCase();
  const isTripVisibleDetail = visibleDetailLevel === "trip";
  const columns = isTripVisibleDetail
    ? [
        { key: "category", label: pdfT(lang, "offer.table.category", "Category"), width: 120 },
        { key: "details", label: pdfT(lang, "offer.table.details", "Details"), width: 278 },
        { key: "total", label: pdfT(lang, "offer.table.total", "Total"), width: 109, align: "right" }
      ]
    : [
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

  const rows = buildOfferTableRows(generatedOffer, formatMoneyValue, lang);
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
      ...(isTripVisibleDetail
        ? [
            doc.heightOfString(totalText, { width: columns[2].width - TABLE_CELL_PADDING_X * 2, align: "right" })
          ]
        : [
            doc.heightOfString(quantity, { width: columns[2].width - TABLE_CELL_PADDING_X * 2, align: "right" }),
            doc.heightOfString(unitText, { width: columns[3].width - TABLE_CELL_PADDING_X * 2, align: "right" }),
            doc.heightOfString(totalText, { width: columns[4].width - TABLE_CELL_PADDING_X * 2, align: "right" })
          ])
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
    const values = isTripVisibleDetail
      ? [details, totalText]
      : [details, quantity, unitText, totalText];
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
  const hasTaxSummary = Number(quotationSummary?.total_tax_amount_cents || 0) !== 0;
  const totalLabel = hasTaxSummary
    ? pdfT(lang, "offer.total", "Total (including tax)")
    : pdfT(lang, "offer.table.total", "Total");

  const totalValueText = formatMoneyValue(
    quotationSummary?.grand_total_amount_cents ?? generatedOffer?.total_price_cents,
    generatedOffer?.currency
  );
  if (isTripVisibleDetail) {
    const totalColumn = columns[2];
    const totalValueWidth = totalColumn.width - 8;
    const totalValueX = PAGE_MARGIN + columns[0].width + columns[1].width;
    const totalLabelWidth = 180;
    const totalLabelX = Math.max(PAGE_MARGIN, totalValueX - totalLabelWidth - 14);

    doc
      .font(pdfFontName("bold", fonts))
      .fontSize(12)
      .fillColor(PDF_COLORS.textStrong)
      .text(totalLabel, totalLabelX, y + 6, {
        width: totalLabelWidth,
        align: "right"
      });
    doc
      .font(pdfFontName("bold", fonts))
      .fontSize(12)
      .fillColor(PDF_COLORS.textStrong)
      .text(totalValueText, totalValueX, y + 6, {
        width: totalValueWidth,
        align: "right"
      });
  } else {
    doc
      .font(pdfFontName("bold", fonts))
      .fontSize(12)
      .fillColor(PDF_COLORS.textStrong)
      .text(totalLabel, PAGE_MARGIN + columns[0].width + columns[1].width, y + 6, {
        width: columns[2].width + columns[3].width - 12,
        align: "right"
      });
    doc
      .font(pdfFontName("bold", fonts))
      .fontSize(12)
      .fillColor(PDF_COLORS.textStrong)
      .text(totalValueText, PAGE_MARGIN + columns[0].width + columns[1].width + columns[2].width + columns[3].width, y + 6, {
        width: columns[4].width - 8,
        align: "right"
      });
  }
  y += 32;

  if (!hasTaxSummary) {
    return y + 10;
  }

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
  const booking = generatedOffer?.__booking_for_offer_pdf || null;
  const override = textOrNull(resolveBookingPdfPersonalizationText(booking?.pdf_personalization, "offer", "closing", lang, { sourceLang: lang }));
  if (override) return override;
  const routeMode = normalizeText(generatedOffer?.customer_confirmation_flow?.mode).toUpperCase();
  if (routeMode === "DEPOSIT_PAYMENT") {
    const routeRule = generatedOffer?.customer_confirmation_flow?.deposit_rule && typeof generatedOffer.customer_confirmation_flow.deposit_rule === "object"
      ? generatedOffer.customer_confirmation_flow.deposit_rule
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
  return pdfT(
    lang,
    "offer.closing_body",
    "If this offer feels right for you, simply respond to us by email or WhatsApp and we will be happy to confirm next steps, refine details, and help you move toward booking."
  );
}

function resolveOfferSubtitle(booking, generatedOffer, lang) {
  const override = textOrNull(resolveBookingPdfPersonalizationText(booking?.pdf_personalization, "offer", "subtitle", lang, { sourceLang: lang }));
  if (override) return override;
  const dayCount = Array.isArray(generatedOffer?.travel_plan?.days) ? generatedOffer.travel_plan.days.length : 0;
  const countries = resolveBookingPdfCountryLabels(booking);
  if (dayCount > 0 && countries.length) {
    return `${dayCount} ${dayCount === 1 ? "day" : "days"} in ${countries.join(", ")}`;
  }
  if (countries.length) return countries.join(", ");
  return pdfT(lang, "offer.hero_subtitle", "Your personalized Asia Travel Plan offer");
}

function resolveOfferWelcomeText(booking, lang) {
  const override = textOrNull(resolveBookingPdfPersonalizationText(booking?.pdf_personalization, "offer", "welcome", lang, { sourceLang: lang }));
  if (override) return override;
  const styles = resolveBookingPdfTravelStyleLabels(booking, lang);
  if (styles.length) {
    return `This offer is based on your current ${styles.join(", ")} itinerary. Please let us know if you would like to adjust anything.`;
  }
  return "This is your current offer. Please let us know if you would like to adjust anything.";
}

function buildAttachmentClosingNote(attachmentCount, lang) {
  const count = Number(attachmentCount) || 0;
  if (count <= 0) return "";
  return count === 1
    ? pdfT(lang, "pdf.attachment_note_single", "Please also find the attached additional PDF at the end of this document.")
    : pdfT(lang, "pdf.attachment_note_multiple", "Please also find the attached additional PDFs at the end of this document.");
}

function estimateClosingHeight(doc, fonts, lang, generatedOffer, formatMoneyValue, attachmentCount = 0) {
  const textWidth = doc.page.width - PAGE_MARGIN * 2;

  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11);
  const bodyHeight = doc.heightOfString(
    buildClosingBody(generatedOffer, formatMoneyValue, lang),
    pdfTextOptions(lang, {
      width: textWidth,
      lineGap: 2
    })
  );

  const attachmentNote = buildAttachmentClosingNote(attachmentCount, lang);
  const attachmentHeight = attachmentNote
    ? doc.heightOfString(attachmentNote, pdfTextOptions(lang, {
      width: textWidth,
      lineGap: 2
    })) + (11 * 0.8)
    : 0;

  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11);
  const regardsHeight = doc.heightOfString(pdfT(lang, "offer.closing_regards", "Warm regards,"), {
    width: textWidth,
    align: pdfTextAlign(lang)
  });

  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(12);
  const teamHeight = doc.heightOfString(pdfT(lang, "offer.closing_team", "Your Asia Travel Plan team."), {
    width: textWidth,
    align: pdfTextAlign(lang)
  });

  return bodyHeight + attachmentHeight + 18 + regardsHeight + 18 + teamHeight + 10;
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
    .font(pdfFontName("regular", fonts))
    .fontSize(12)
    .fillColor(PDF_COLORS.textStrong)
    .text(pdfT(lang, "offer.closing_team", "Your Asia Travel Plan team."), PAGE_MARGIN, signY + 18, {
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

    const offerTravelPlan = generatedOffer?.travel_plan || booking?.travel_plan || null;
    const [logoImage, heroPath, baseFonts, accentFonts, heroTitle, guidePhoto, itemThumbnailMap] = await Promise.all([
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
        : null,
      buildTravelPlanItemThumbnailMap(offerTravelPlan, bookingImagesDir)
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
      doc.__booking_for_offer_pdf = booking;
      generatedOffer.__booking_for_offer_pdf = booking;

      let y = drawTopHeader(doc, companyProfile, logoImage, fonts, lang);
      y = drawHero(doc, heroTitle, booking, generatedOffer, heroImage, y, fonts, lang);
      y = drawIntro(doc, y, fonts, lang);
      if (booking?.pdf_personalization?.offer?.include_who_is_traveling !== false) {
        y = drawPdfTravelersSection({
          doc,
          booking,
          startY: y,
          fonts,
          lang,
          colors: PDF_COLORS,
          pageMargin: PAGE_MARGIN,
          pdfFontName,
          pdfTextAlign,
          pdfT
        });
      }
      if (safeArray(generatedOffer?.travel_plan?.days || booking?.travel_plan?.days).length) {
        y = startSectionOnNewPage(doc);
        y = drawTravelPlanOverview(doc, generatedOffer, booking, y, fonts, lang, itemThumbnailMap);
      }
      y = ensureSpace(doc, y, estimateGuideSectionHeight(doc, guideContext, fonts, lang) + 10);
      y = drawGuideSection(doc, y, fonts, lang, guideContext, guidePhoto);
      y = keepSectionTogetherIfPossible(doc, y, estimateOfferTableHeight(doc, generatedOffer, renderMoney, fonts, lang));
      y = drawOfferTable(doc, generatedOffer, y, renderMoney, fonts, lang);
      if (safeArray(generatedOffer?.payment_terms?.lines || generatedOffer?.offer?.payment_terms?.lines).length) {
        y = keepSectionTogetherIfPossible(doc, y, estimatePaymentTermsHeight(doc, generatedOffer, renderMoney, fonts, lang));
        y = drawPaymentTerms(doc, generatedOffer, y, renderMoney, fonts, lang);
      }
      y = keepSectionTogetherIfPossible(
        doc,
        y + 18,
        estimateClosingHeight(doc, fonts, lang, generatedOffer, renderMoney, attachmentPaths.length)
      );
      y = drawClosing(doc, y, fonts, lang, generatedOffer, renderMoney, attachmentPaths.length);

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
