import { createWriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import {
  formatPdfDateOnly,
  formatPdfDateTime,
  formatPdfMoney,
  normalizePdfLang,
  pdfT
} from "./pdf_i18n.js";
import { normalizeText } from "./text.js";
import { resolveLocalizedText } from "../domain/booking_content_i18n.js";

const PAGE_SIZE = "A4";
const PAGE_MARGIN = 44;
const HEADER_LOGO_WIDTH = 150;
const HERO_IMAGE_WIDTH = 195;
const HERO_IMAGE_HEIGHT = 128;
const TABLE_ROW_GAP = 8;
const TABLE_HEADER_HEIGHT = 28;
const TABLE_CELL_PADDING_X = 8;
const TABLE_CELL_PADDING_Y = 8;
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
  if (fonts?.regular) {
    doc.registerFont(PDF_FONT_REGULAR, fonts.regular);
  }
  if (fonts?.bold) {
    doc.registerFont(PDF_FONT_BOLD, fonts.bold);
  }
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

function humanizeTravelPlanSegmentKind(kind, lang) {
  const normalizedKind = normalizeText(kind).toLowerCase();
  if (!normalizedKind) return "";
  const fallback = normalizedKind
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return pdfT(lang, `offer.segment.${normalizedKind}`, fallback);
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

function formatTravelPlanTiming(segment, lang, dayDate = "") {
  const timingKind = normalizeText(segment?.timing_kind) || "label";
  if (timingKind === "point") {
    return formatTravelPlanDateTime(segment?.time_point, lang, dayDate);
  }
  if (timingKind === "range") {
    const start = formatTravelPlanDateTime(segment?.start_time, lang, dayDate);
    const end = formatTravelPlanDateTime(segment?.end_time, lang, dayDate);
    if (start && end) return `${start} - ${end}`;
    return start || end || "";
  }
  return normalizeText(segment?.time_label);
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
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
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

function drawRoundedTag(doc, x, y, width, height, text, options = {}, fonts = null) {
  const fillColor = options.fillColor || "#F2F4EA";
  const textColor = options.textColor || "#304850";
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
    .strokeColor("#D7DED9")
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

function drawTopHeader(doc, companyProfile, logoImage, fonts, lang) {
  let y = PAGE_MARGIN;
  if (logoImage?.buffer) {
    doc.image(logoImage.buffer, PAGE_MARGIN, y + 2, { width: HEADER_LOGO_WIDTH });
  }

  const rightColumnX = doc.page.width - PAGE_MARGIN - 220;
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(13)
    .fillColor("#1D2E36")
    .text(companyProfile.name, rightColumnX, y, { width: 220, align: "right" });
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(10)
    .fillColor("#51646B")
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
      .fill("#EEF2EC")
      .restore();
  }

  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(22)
    .fillColor("#1D2E36")
    .text(heroTitle, detailsX, startY + 4, {
      width: detailsWidth
    });
  const titleHeight = doc.heightOfString(heroTitle, { width: detailsWidth });
  const titleBottomY = startY + 4 + titleHeight;

  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11)
    .fillColor("#5E6D73")
    .text(heroSubtitle, detailsX, titleBottomY + 4, {
      width: detailsWidth
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
      fillColor: "#E7F1ED"
    },
    fonts
  );

  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(10.5)
    .fillColor("#5E6D73")
    .text(
      pdfT(lang, "offer.intro_currency", "Prepared for your requested itinerary in {currency}.", {
        currency: generatedOffer?.currency || booking?.preferred_currency || "USD"
      }),
      detailsX,
      chipsY + 34,
      {
        width: detailsWidth
      }
    );

  return Math.max(startY + HERO_IMAGE_HEIGHT, doc.y) + 22;
}

function drawIntro(doc, startY, fonts, lang) {
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11.5)
    .fillColor("#33454C")
    .text(
      pdfT(lang, "offer.intro_body", "Thank you for considering Asia Travel Plan for your journey. We are pleased to share this offer for your trip, and we hope it feels like a strong starting point for your travel planning. If you like it, simply reply to us and we will refine the next steps together."),
      PAGE_MARGIN,
      startY,
      {
        width: doc.page.width - PAGE_MARGIN * 2,
        align: "left",
        lineGap: 2
      }
    );
  return doc.y + 18;
}

function drawTravelers(doc, booking, startY, fonts, lang) {
  const travelers = peopleTraveling(booking);
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(13)
    .fillColor("#23363D")
    .text(pdfT(lang, "offer.travelers_title", "Who is traveling"), PAGE_MARGIN, startY);

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
    .fill("#F4F7F2")
    .restore();

  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11)
    .fillColor("#33454C");
  const gutter = 18;
  const innerWidth = boxWidth - 32;
  const columnWidth = columnCount === 2 ? (innerWidth - gutter) / 2 : innerWidth;
  lines.forEach((line, index) => {
    const row = index % rows;
    const column = Math.floor(index / rows);
    const x = PAGE_MARGIN + 16 + column * (columnWidth + gutter);
    const y = boxY + 10 + row * lineHeight;
    doc.text(`• ${line}`, x, y, {
      width: columnWidth
    });
  });

  return boxY + boxHeight + 20;
}

function drawTravelPlanOverview(doc, generatedOffer, booking, startY, fonts, lang) {
  const travelPlan = generatedOffer?.travel_plan || booking?.travel_plan;
  const days = safeArray(travelPlan?.days);
  if (!days.length) return startY;

  const sectionTitle = pdfT(lang, "offer.travel_plan_title", "Travel plan overview");
  const dayBlockWidth = doc.page.width - PAGE_MARGIN * 2;
  const timingColumnWidth = 110;
  const segmentTextWidth = dayBlockWidth - timingColumnWidth - 34;

  let y = startY;
  const redrawSectionHeader = (pdfDoc, nextY) => {
    pdfDoc
      .font(pdfFontName("bold", fonts))
      .fontSize(13)
      .fillColor("#23363D")
      .text(sectionTitle, PAGE_MARGIN, nextY);
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
      .fill("#EEF3F0")
      .restore();

    doc
      .font(pdfFontName("bold", fonts))
      .fontSize(11)
      .fillColor("#23363D")
      .text(dayTitle, PAGE_MARGIN + 12, y + 7, {
        width: dayTitleWidth
      });

    if (dayMeta) {
      doc
        .font(pdfFontName("regular", fonts))
        .fontSize(9.5)
        .fillColor("#5E6D73")
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
        .fillColor("#5E6D73")
        .text(day.notes, PAGE_MARGIN + 4, y, {
          width: dayBlockWidth - 8,
          lineGap: 1
        });
      y = doc.y + 8;
    }

    const segments = safeArray(day?.segments);
    for (const segment of segments) {
      const timingText = formatTravelPlanTiming(segment, lang, textOrNull(day?.date));
      const segmentTitle = textOrNull(segment?.title) || humanizeTravelPlanSegmentKind(segment?.kind, lang) || pdfT(lang, "offer.segment_fallback", "Planned segment");
      const segmentMetaParts = [];
      const kindLabel = humanizeTravelPlanSegmentKind(segment?.kind, lang);
      const location = textOrNull(segment?.location);
      if (kindLabel) segmentMetaParts.push(kindLabel);
      if (location) segmentMetaParts.push(location);
      const segmentMeta = segmentMetaParts.join(" · ");
      const segmentDetails = textOrNull(segment?.details);

      doc.font(pdfFontName("bold", fonts)).fontSize(10.5);
      const segmentTitleHeight = doc.heightOfString(segmentTitle, { width: segmentTextWidth });
      doc.font(pdfFontName("regular", fonts)).fontSize(9.2);
      const segmentMetaHeight = segmentMeta ? doc.heightOfString(segmentMeta, { width: segmentTextWidth }) : 0;
      doc.font(pdfFontName("regular", fonts)).fontSize(9.8);
      const segmentDetailsHeight = segmentDetails ? doc.heightOfString(segmentDetails, { width: segmentTextWidth, lineGap: 1 }) : 0;
      const segmentTimingHeight = timingText
        ? doc.heightOfString(timingText, { width: timingColumnWidth - 8 })
        : 0;
      const segmentContentHeight = segmentTitleHeight
        + (segmentMeta ? segmentMetaHeight + 3 : 0)
        + (segmentDetails ? segmentDetailsHeight + 4 : 0);
      const rowHeight = Math.max(34, Math.max(segmentTimingHeight, segmentContentHeight) + 18);

      y = ensureSpace(doc, y, rowHeight + 8, redrawSectionHeader);
      doc
        .save()
        .roundedRect(PAGE_MARGIN, y, dayBlockWidth, rowHeight, 10)
        .fill("#FFFFFF")
        .restore();

      if (timingText) {
        doc
          .font(pdfFontName("bold", fonts))
          .fontSize(9.8)
          .fillColor("#43606B")
          .text(timingText, PAGE_MARGIN + 12, y + 10, {
            width: timingColumnWidth - 10
          });
      }

      let textY = y + 9;
      const textX = PAGE_MARGIN + 18 + timingColumnWidth;
      doc
        .font(pdfFontName("bold", fonts))
        .fontSize(10.5)
        .fillColor("#253942")
        .text(segmentTitle, textX, textY, {
          width: segmentTextWidth
        });
      textY = doc.y;

      if (segmentMeta) {
        doc
          .font(pdfFontName("regular", fonts))
          .fontSize(9.2)
          .fillColor("#5E6D73")
          .text(segmentMeta, textX, textY + 2, {
            width: segmentTextWidth
          });
        textY = doc.y;
      }

      if (segmentDetails) {
        doc
          .font(pdfFontName("regular", fonts))
          .fontSize(9.8)
          .fillColor("#33454C")
          .text(segmentDetails, textX, textY + 3, {
            width: segmentTextWidth,
            lineGap: 1
          });
      }

      y += rowHeight + 6;
    }

    y += 10;
  }

  return y;
}

function drawTableHeader(doc, startY, columns, fonts) {
  let x = PAGE_MARGIN;
  doc
    .save()
    .roundedRect(PAGE_MARGIN, startY, doc.page.width - PAGE_MARGIN * 2, TABLE_HEADER_HEIGHT, 10)
    .fill("#EEF3F0")
    .restore();

  doc.font(pdfFontName("bold", fonts)).fontSize(9.25).fillColor("#43606B");
  for (const column of columns) {
    doc.text(column.label, x + TABLE_CELL_PADDING_X, startY + 8, {
      width: column.width - TABLE_CELL_PADDING_X * 2,
      align: column.align || "left"
    });
    x += column.width;
  }
  return startY + TABLE_HEADER_HEIGHT + 10;
}

function drawOfferTable(doc, generatedOffer, startY, formatMoneyValue, fonts, lang) {
  const columns = [
    { key: "category", label: pdfT(lang, "offer.table.category", "Category"), width: 86 },
    { key: "details", label: pdfT(lang, "offer.table.details", "Details"), width: 155 },
    { key: "quantity", label: pdfT(lang, "offer.table.quantity", "Quantity"), width: 68, align: "right" },
    { key: "single", label: pdfT(lang, "offer.table.single", "Single"), width: 78, align: "right" },
    { key: "total", label: pdfT(lang, "offer.table.total_incl_tax", "Total (incl. tax)"), width: 120, align: "right" }
  ];
  let y = startY;
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(13)
    .fillColor("#23363D")
    .text(pdfT(lang, "offer.table_title", "Offer details"), PAGE_MARGIN, y);
  y += 18;

  const redrawHeader = (pdfDoc, nextY) => drawTableHeader(pdfDoc, nextY, columns, fonts);
  y = drawTableHeader(doc, y, columns, fonts);

  const components = safeArray(generatedOffer?.offer?.components);
  if (!components.length) {
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(10.5)
      .fillColor("#5F6E74")
      .text(pdfT(lang, "offer.table_empty", "No offer items were included in this version of the offer."), PAGE_MARGIN, y, {
        width: doc.page.width - PAGE_MARGIN * 2
      });
    return doc.y + 18;
  }

  for (const component of components) {
    const category = categoryLabel(component);
    const details = textOrNull(component?.details) || "—";
    const quantity = String(Number(component?.quantity || 1));
    const unitText = formatMoneyValue(component?.unit_amount_cents, generatedOffer?.currency);
    const totalText = formatMoneyValue(component?.line_total_amount_cents, generatedOffer?.currency);
    const rowHeight = Math.max(
      24,
      doc.heightOfString(category, { width: columns[0].width - TABLE_CELL_PADDING_X * 2, align: "left" }),
      doc.heightOfString(details, { width: columns[1].width - TABLE_CELL_PADDING_X * 2, align: "left" }),
      doc.heightOfString(quantity, { width: columns[2].width - TABLE_CELL_PADDING_X * 2, align: "right" }),
      doc.heightOfString(unitText, { width: columns[3].width - TABLE_CELL_PADDING_X * 2, align: "right" }),
      doc.heightOfString(totalText, { width: columns[4].width - TABLE_CELL_PADDING_X * 2, align: "right" })
    ) + TABLE_CELL_PADDING_Y * 2;

    y = ensureSpace(doc, y, rowHeight + 24, redrawHeader);

    doc
      .save()
      .roundedRect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, rowHeight, 10)
      .fill("#FFFFFF")
      .restore();

    let x = PAGE_MARGIN;
    const values = [category, details, quantity, unitText, totalText];
    for (let index = 0; index < columns.length; index += 1) {
      const column = columns[index];
      const value = values[index];
      doc
        .font(pdfFontName("regular", fonts))
        .fontSize(10.5)
        .fillColor("#253942")
        .text(value, x + TABLE_CELL_PADDING_X, y + TABLE_CELL_PADDING_Y, {
          width: column.width - TABLE_CELL_PADDING_X * 2,
          align: column.align || "left"
        });
      x += column.width;
    }

    doc
      .save()
      .moveTo(PAGE_MARGIN, y + rowHeight + 4)
      .lineTo(doc.page.width - PAGE_MARGIN, y + rowHeight + 4)
      .lineWidth(0.5)
      .strokeColor("#E1E6E2")
      .stroke()
      .restore();

    y += rowHeight + TABLE_ROW_GAP;
  }

  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(12)
    .fillColor("#22383F")
    .text(pdfT(lang, "offer.total", "Offer total"), PAGE_MARGIN + columns[0].width + columns[1].width, y + 6, {
      width: columns[2].width + columns[3].width - 12,
      align: "right"
    });
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(12)
    .fillColor("#22383F")
    .text(formatMoneyValue(generatedOffer?.total_price_cents, generatedOffer?.currency), PAGE_MARGIN + columns[0].width + columns[1].width + columns[2].width + columns[3].width, y + 6, {
      width: columns[4].width - 8,
      align: "right"
    });

  return y + 28;
}

function drawClosing(doc, startY, fonts, lang) {
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11)
    .fillColor("#33454C")
    .text(
      pdfT(lang, "offer.closing_body", "If this offer feels right for you, simply respond to us by email or WhatsApp and we will be happy to confirm next steps, refine details, and help you move toward booking."),
      PAGE_MARGIN,
      startY,
      {
        width: doc.page.width - PAGE_MARGIN * 2,
        lineGap: 2
      }
    );

  const signY = doc.y + 18;
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11)
    .fillColor("#33454C")
    .text(pdfT(lang, "offer.closing_regards", "Warm regards,"), PAGE_MARGIN, signY);
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(12)
    .fillColor("#23363D")
    .text(pdfT(lang, "offer.closing_team", "The Asia Travel Plan Team"), PAGE_MARGIN, signY + 18);
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
  logoPath,
  fallbackImagePath,
  companyProfile,
  formatMoney
}) {
  return async function writeGeneratedOfferPdf(generatedOffer, booking) {
    const lang = normalizePdfLang(generatedOffer?.lang || booking?.customer_language || booking?.web_form_submission?.preferred_language || "en");
    const renderMoney = (amountCents, currency) => fallbackFormatMoney(currency, amountCents, lang);
    const outputPath = generatedOfferPdfPath(generatedOffer.id);
    await mkdir(path.dirname(outputPath), { recursive: true });

    const [logoImage, heroPath, fonts, heroTitle] = await Promise.all([
      rasterizeImage(logoPath, { width: 1000 }),
      resolveBookingImageForPdf({ booking, bookingImagesDir, readTours, resolveTourImageDiskPath }),
      resolvePdfFonts(),
      resolveBookingHeroTitle(booking, lang, readTours)
    ]);
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
      y = drawTravelPlanOverview(doc, generatedOffer, booking, y, fonts, lang);
      y = drawOfferTable(doc, generatedOffer, y, renderMoney, fonts, lang);
      y = ensureSpace(doc, y, 90);
      y = drawClosing(doc, y + 18, fonts, lang);

      drawDivider(doc, doc.page.height - PAGE_MARGIN - 12);
      doc
        .font(pdfFontName("regular", fonts))
        .fontSize(8.5)
        .fillColor("#708087")
        .text(
          `${companyProfile.name} · ${companyProfile.website} · ${companyProfile.email} · ${companyProfile.whatsapp}`,
          PAGE_MARGIN,
          doc.page.height - PAGE_MARGIN,
          { width: doc.page.width - PAGE_MARGIN * 2, align: "center" }
        );

      doc.end();
    });
  };
}
