import { createWriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import {
  formatPdfDateOnly,
  formatPdfMoney,
  normalizePdfLang
} from "./pdf_i18n.js";
import {
  resolveBookingPdfPersonalizationFlag,
  resolveBookingPdfPersonalizationText
} from "./booking_pdf_personalization.js";
import { resolvePdfFontsForLang } from "./pdf_font_resolver.js";
import { getBookingPersons } from "./booking_persons.js";
import { pdfTheme } from "./style_tokens.js";
import { normalizeText } from "./text.js";

const PAGE_SIZE = "A4";
const PAGE_MARGIN = 46;
const HEADER_LOGO_WIDTH = 150;
const TABLE_HEADER_HEIGHT = 22;
const TABLE_CELL_PADDING_X = 8;
const TABLE_CELL_PADDING_Y = 2;
const SIGNATURE_LINE_TOP_GAP = (72 / 2.54) * 1.5;
const PDF_FONT_REGULAR = "ATPUnicodeRegular";
const PDF_FONT_BOLD = "ATPUnicodeBold";

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
  surfaceMuted: pdfTheme.surfaceMuted,
  surfaceSubtle: pdfTheme.surfaceSubtle,
  line: pdfTheme.line,
  text: pdfTheme.text,
  textStrong: pdfTheme.textStrong,
  textMuted: pdfTheme.textMuted,
  textMutedStrong: pdfTheme.textMutedStrong
});

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

function registerPdfFonts(doc, fonts) {
  if (fonts?.regular) doc.registerFont(PDF_FONT_REGULAR, fonts.regular);
  if (fonts?.bold) doc.registerFont(PDF_FONT_BOLD, fonts.bold);
}

function pdfFontName(weight = "regular", fonts = null) {
  if (!fonts?.regular) return weight === "bold" ? "Helvetica-Bold" : "Helvetica";
  if (weight === "bold" && fonts?.bold) return PDF_FONT_BOLD;
  return PDF_FONT_REGULAR;
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

function ensureSpace(doc, currentY, requiredHeight) {
  const bottomLimit = doc.page.height - PAGE_MARGIN - 24;
  if (currentY + requiredHeight <= bottomLimit) return currentY;
  doc.addPage();
  return PAGE_MARGIN;
}

function drawTopHeader(doc, companyProfile, logoImage, fonts) {
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
    .text(`WhatsApp: ${companyProfile.whatsapp}`, rightColumnX, y + 50, { width: 220, align: "right" })
    .text(`Email: ${companyProfile.email}`, rightColumnX, y + 66, { width: 220, align: "right" })
    .text(companyProfile.website, rightColumnX, y + 82, { width: 220, align: "right" });

  const nextY = y + 106;
  drawDivider(doc, nextY);
  return nextY + 18;
}

function safeText(value, fallback = "-") {
  const normalized = normalizeText(value);
  return normalized || fallback;
}

function textOrEmpty(value) {
  return normalizeText(value) || "";
}

function normalizeCurrency(value, fallback = "USD") {
  const normalized = normalizeText(value).toUpperCase();
  return normalized || fallback;
}

function bookingTitle(booking) {
  return normalizeText(booking?.name || booking?.web_form_submission?.booking_name) || "Booking";
}

function travelerNames(booking) {
  const persons = getBookingPersons(booking);
  const travelers = persons.filter((person) => Array.isArray(person?.roles) && person.roles.includes("traveler"));
  const source = travelers.length ? travelers : persons;
  const names = source.map((person) => normalizeText(person?.name)).filter(Boolean);
  if (names.length) return names;
  const fallback = normalizeText(booking?.web_form_submission?.name);
  return fallback ? [fallback] : [];
}

function buildTravelPlanRows(booking, lang) {
  const days = Array.isArray(booking?.accepted_travel_plan_snapshot?.days) ? booking.accepted_travel_plan_snapshot.days : [];
  return [...days]
    .sort((left, right) => Number(left?.day_number || 0) - Number(right?.day_number || 0))
    .map((day, index) => {
      const dayNumber = Number(day?.day_number || index + 1);
      const dayLabel = `Day ${dayNumber}`;
      const dateLabel = normalizeText(day?.date)
        ? formatPdfDateOnly(day.date, lang, { day: "2-digit", month: "short", year: "numeric" })
        : safeText(day?.date_string, "-");
      const summaryParts = [
        normalizeText(day?.title),
        normalizeText(day?.overnight_location) ? `Overnight: ${normalizeText(day.overnight_location)}` : ""
      ].filter(Boolean);
      return {
        dayLabel,
        dateLabel,
        summary: summaryParts.join(" | ") || "-"
      };
    });
}

function moneyLabel(amountCents, currency, lang) {
  return formatPdfMoney(Math.max(0, Math.round(Number(amountCents || 0))), currency, lang);
}

function resolveBookingConfirmationSubtitleText(booking, lang) {
  if (!resolveBookingPdfPersonalizationFlag(booking?.pdf_personalization, "booking_confirmation", "include_subtitle", { sourceLang: lang })) {
    return "";
  }
  return textOrEmpty(
    resolveBookingPdfPersonalizationText(booking?.pdf_personalization, "booking_confirmation", "subtitle", lang, { sourceLang: lang })
  );
}

function resolveBookingConfirmationWelcomeText(booking, lang, depositAmountCents, currency) {
  if (!resolveBookingPdfPersonalizationFlag(booking?.pdf_personalization, "booking_confirmation", "include_welcome", { sourceLang: lang })) {
    return "";
  }
  const override = textOrEmpty(
    resolveBookingPdfPersonalizationText(booking?.pdf_personalization, "booking_confirmation", "welcome", lang, { sourceLang: lang })
  );
  if (override) return override;
  return `This document confirms receipt of a deposit payment of ${moneyLabel(depositAmountCents, currency, lang)}.`;
}

function resolveBookingConfirmationClosingText(booking, lang) {
  if (!resolveBookingPdfPersonalizationFlag(booking?.pdf_personalization, "booking_confirmation", "include_closing", { sourceLang: lang })) {
    return "";
  }
  const override = textOrEmpty(
    resolveBookingPdfPersonalizationText(booking?.pdf_personalization, "booking_confirmation", "closing", lang, { sourceLang: lang })
  );
  return override || "Thank you for your payment. AsiaTravelPlan looks forward to supporting you throughout your journey.";
}

function drawMetaRow(doc, label, value, x, y, width, fonts) {
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(10)
    .fillColor(PDF_COLORS.textMutedStrong)
    .text(label, x, y, { width: 168 });
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(10.5)
    .fillColor(PDF_COLORS.textStrong)
    .text(value, x + 172, y, { width: width - 172 });
  return doc.y;
}

function travelPlanTableColumns(doc) {
  const width = doc.page.width - PAGE_MARGIN * 2;
  return [
    { key: "day", label: "Day", width: 60 },
    { key: "date", label: "Date", width: 96 },
    { key: "plan", label: "Plan", width: width - 156 }
  ];
}

function drawTravelPlanRow(doc, y, row, columns, fonts) {
  const xPositions = [];
  let cursor = PAGE_MARGIN;
  for (const column of columns) {
    xPositions.push(cursor);
    cursor += column.width;
  }
  const values = [row.dayLabel, row.dateLabel, row.summary];
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(10);
  const textHeights = values.map((value, index) => doc.heightOfString(String(value || "-"), {
    width: columns[index].width - TABLE_CELL_PADDING_X * 2,
    align: "left"
  }));
  const rowHeight = Math.max(18, ...textHeights.map((value) => value + TABLE_CELL_PADDING_Y * 2));
  values.forEach((value, index) => {
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(10)
      .fillColor(PDF_COLORS.textStrong)
      .text(String(value || "-"), xPositions[index] + TABLE_CELL_PADDING_X, y + TABLE_CELL_PADDING_Y, {
        width: columns[index].width - TABLE_CELL_PADDING_X * 2
      });
  });
  return y + rowHeight + 2;
}

export function createBookingConfirmationPdfWriter({
  companyProfile = null,
  logoPath = ""
}) {
  return async function writeBookingConfirmationPdf(booking, options = {}) {
    const lang = normalizePdfLang(booking?.customer_language || booking?.web_form_submission?.preferred_language || "en");
    const outputPath = String(options?.outputPath || "").trim();
    if (!outputPath) {
      throw new Error("outputPath is required for booking confirmation PDF generation.");
    }
    await mkdir(path.dirname(outputPath), { recursive: true });

    const fonts = await resolvePdfFontsForLang({
      lang,
      regularCandidates: PDF_FONT_REGULAR_CANDIDATES,
      boldCandidates: PDF_FONT_BOLD_CANDIDATES
    });
    const logoImage = await rasterizeImage(logoPath, { width: 1000 });
    const currency = normalizeCurrency(
      booking?.accepted_offer_snapshot?.currency
      || booking?.accepted_deposit_currency
      || booking?.preferred_currency
      || "USD"
    );
    const totalAmountCents = Math.max(0, Math.round(Number(
      booking?.accepted_offer_snapshot?.total_price_cents
      || booking?.accepted_offer_snapshot?.totals?.total_price_cents
      || booking?.pricing?.summary?.scheduled_gross_amount_cents
      || 0
    )));
    const depositAmountCents = Math.max(0, Math.round(Number(booking?.accepted_deposit_amount_cents || 0)));
    const remainingBalanceCents = Math.max(0, totalAmountCents - depositAmountCents);
    const travelerLabel = travelerNames(booking).join(", ");
    const planRows = buildTravelPlanRows(booking, lang);
    const subtitleText = resolveBookingConfirmationSubtitleText(booking, lang);
    const welcomeText = resolveBookingConfirmationWelcomeText(booking, lang, depositAmountCents, currency);
    const closingText = resolveBookingConfirmationClosingText(booking, lang);

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: PAGE_SIZE,
        margin: 0,
        autoFirstPage: true,
        compress: false,
        info: {
          Title: `Booking confirmation - ${bookingTitle(booking)}`,
          Author: normalizeText(companyProfile?.name) || "AsiaTravelPlan",
          Subject: "Booking confirmation"
        }
      });
      const stream = createWriteStream(outputPath);
      doc.pipe(stream);
      stream.on("finish", resolve);
      stream.on("error", reject);
      doc.on("error", reject);
      registerPdfFonts(doc, fonts);

      let y = drawTopHeader(doc, companyProfile, logoImage, fonts);

      doc
        .font(pdfFontName("bold", fonts))
        .fontSize(22)
        .fillColor(PDF_COLORS.textStrong)
        .text(bookingTitle(booking), PAGE_MARGIN, y, {
          width: doc.page.width - PAGE_MARGIN * 2
        });
      y = doc.y + 8;

      if (subtitleText) {
        doc
          .font(pdfFontName("regular", fonts))
          .fontSize(11)
          .fillColor(PDF_COLORS.textMutedStrong)
          .text(subtitleText, PAGE_MARGIN, y, {
            width: doc.page.width - PAGE_MARGIN * 2
          });
        y = doc.y + 12;
      } else {
        y += 8;
      }

      y = drawMetaRow(doc, "Who is traveling:", travelerLabel || "-", PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, fonts) + 8;
      y += 4;

      y = ensureSpace(doc, y, 60);
      doc
        .font(pdfFontName("bold", fonts))
        .fontSize(13)
        .fillColor(PDF_COLORS.textStrong)
        .text("Travel plan", PAGE_MARGIN, y);
      y += 14;

      if (!planRows.length) {
        doc
          .font(pdfFontName("regular", fonts))
          .fontSize(10.5)
          .fillColor(PDF_COLORS.textMutedStrong)
          .text("No travel-plan days were frozen for this booking.", PAGE_MARGIN, y, {
            width: doc.page.width - PAGE_MARGIN * 2
          });
        y = doc.y + 14;
      } else {
        const tableColumns = travelPlanTableColumns(doc);
        y += 2;
        for (const row of planRows) {
          y = ensureSpace(doc, y, 36);
          if (y === PAGE_MARGIN) {
            y = drawTopHeader(doc, companyProfile, logoImage, fonts);
            y += 2;
          }
          y = drawTravelPlanRow(doc, y, row, tableColumns, fonts);
        }
        y += 8;
      }

      y = ensureSpace(doc, y, 110);
      doc
        .font(pdfFontName("bold", fonts))
        .fontSize(13)
        .fillColor(PDF_COLORS.textStrong)
        .text("Amounts", PAGE_MARGIN, y);
      y += 18;
      y = drawMetaRow(doc, "Total Amount:", moneyLabel(totalAmountCents, currency, lang), PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, fonts) + 6;
      y = drawMetaRow(doc, "Deposit Received:", moneyLabel(depositAmountCents, currency, lang), PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, fonts) + 6;
      y = drawMetaRow(doc, "Remaining Balance:", moneyLabel(remainingBalanceCents, currency, lang), PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, fonts) + 18;

      y = ensureSpace(doc, y, 150);
      doc
        .font(pdfFontName("bold", fonts))
        .fontSize(13)
        .fillColor(PDF_COLORS.textStrong)
        .text("Deposit Payment Confirmation", PAGE_MARGIN, y);
      y += 20;
      doc
        .font(pdfFontName("regular", fonts))
        .fontSize(10.5)
        .fillColor(PDF_COLORS.textMutedStrong)
        .text(welcomeText, PAGE_MARGIN, y, { width: doc.page.width - PAGE_MARGIN * 2 });
      y = doc.y + 16;
      if (closingText) {
        doc
          .text(closingText, PAGE_MARGIN, y, { width: doc.page.width - PAGE_MARGIN * 2 });
        y = doc.y + 28;
      } else {
        y += 12;
      }

      const signatureWidth = (doc.page.width - PAGE_MARGIN * 2 - 24) / 2;
      const leftX = PAGE_MARGIN;
      const rightX = leftX + signatureWidth + 24;
      const lineY = y + SIGNATURE_LINE_TOP_GAP;
      [leftX, rightX].forEach((x) => {
        doc
          .save()
          .moveTo(x, lineY)
          .lineTo(x + signatureWidth, lineY)
          .lineWidth(1)
          .strokeColor(PDF_COLORS.line)
          .stroke()
          .restore();
      });
      doc
        .font(pdfFontName("regular", fonts))
        .fontSize(10)
        .fillColor(PDF_COLORS.textMutedStrong)
        .text(normalizeText(companyProfile?.name) || "AsiaTravelPlan", leftX, y, { width: signatureWidth, align: "center" })
        .text(normalizeText(companyProfile?.name) || "AsiaTravelPlan", rightX, y, { width: signatureWidth, align: "center" });
      doc
        .font("Helvetica-Oblique")
        .fontSize(10)
        .fillColor(PDF_COLORS.textMutedStrong)
        .text("Director's Signature", leftX, lineY + 6, { width: signatureWidth, align: "center" })
        .text("Tour Coordinator's Signature", rightX, lineY + 6, { width: signatureWidth, align: "center" });

      doc.end();
    });

    if (!(await fileExists(outputPath))) {
      throw new Error("Booking confirmation PDF could not be written.");
    }

    return { outputPath };
  };
}
