import { createWriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import {
  formatPdfDateOnly,
  formatPdfMoney,
  normalizePdfLang,
  pdfTextOptions,
  pdfT
} from "./pdf_i18n.js";
import { drawPdfCompanyHeader } from "./pdf_company_header.js";
import { resolvePdfFontsForLang } from "./pdf_font_resolver.js";
import { pdfTheme } from "./style_tokens.js";
import { normalizeText } from "./text.js";
import {
  resolveAtpGuideIntroName,
  resolveAtpGuidePdfContext,
  resolveAtpGuideShortDescriptionText,
  resolveAtpStaffFullName
} from "./atp_staff_pdf.js";
import {
  buildTravelPlanItemThumbnailMap,
  drawTravelPlanDaysSection
} from "./pdf_travel_plan_section.js";

const PAGE_SIZE = "A4";
const PAGE_MARGIN = 44;
const PDF_FONT_REGULAR = "ATPUnicodeRegular";
const PDF_FONT_BOLD = "ATPUnicodeBold";
const HERO_IMAGE_WIDTH = 198;
const HERO_IMAGE_HEIGHT = 126;
const GUIDE_PHOTO_SIZE = 88;

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
  line: pdfTheme.line,
  text: pdfTheme.text,
  textStrong: pdfTheme.textStrong,
  textMuted: pdfTheme.textMuted,
  textMutedStrong: pdfTheme.textMutedStrong
});

function textOrNull(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function drawPreviewWatermark(doc, fonts, text = "Preview") {
  const watermarkText = normalizeText(text) || "Preview";
  const centerX = doc.page.width / 2;
  const centerY = doc.page.height / 2;
  doc
    .save()
    .rotate(-35, { origin: [centerX, centerY] })
    .fillOpacity(0.18)
    .font(pdfFontName("bold", fonts))
    .fontSize(78)
    .fillColor(PDF_COLORS.textMuted)
    .text(watermarkText, centerX - 170, centerY - 40, {
      width: 340,
      align: "center"
    })
    .restore();
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

function extractPublicRelativePath(publicUrl, prefix) {
  const normalizedUrl = normalizeText(publicUrl);
  if (!normalizedUrl) return null;
  if (!normalizedUrl.startsWith(prefix)) return null;
  return normalizedUrl
    .slice(prefix.length)
    .replace(/^\/+/, "")
    .replace(/[?#].*$/, "");
}

async function rasterizeImage(filePath, { width, height } = {}) {
  if (!(await fileExists(filePath))) return null;
  const image = sharp(filePath, { failOn: "none" }).rotate();
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
    width: width || 1,
    height: height || 1
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

function safeText(value, fallback = "-") {
  const normalized = normalizeText(value);
  return normalized || fallback;
}

function invoiceDocumentKind(value) {
  const normalized = normalizeText(value).toUpperCase();
  return normalized || "INVOICE";
}

function invoiceSubjectLabel(invoice, lang) {
  const kind = invoiceDocumentKind(invoice?.document_kind);
  if (kind === "PAYMENT_REQUEST") {
    return pdfT(lang, "payment.request.subject", "Payment request");
  }
  if (kind === "PAYMENT_CONFIRMATION") {
    return pdfT(lang, "payment.confirmation.subject", "Payment confirmation");
  }
  return pdfT(lang, "invoice.subject", "Invoice");
}

function drawMetaRow(doc, label, value, x, y, width, fonts) {
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(10)
    .fillColor(PDF_COLORS.textMutedStrong)
    .text(label, x, y, { width: 120 });
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(10.5)
    .fillColor(PDF_COLORS.textStrong)
    .text(value, x + 126, y, { width: width - 126 });
  return doc.y;
}

function componentRowTotal(component) {
  const total = Number(component?.total_amount_cents || 0);
  if (Number.isFinite(total) && total > 0) return total;
  return Math.max(0, Number(component?.quantity || 0)) * Math.max(0, Number(component?.unit_amount_cents || 0));
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

function isDepositPaymentRequestDocument(invoice) {
  return invoiceDocumentKind(invoice?.document_kind) === "PAYMENT_REQUEST"
    && normalizeText(invoice?.payment_kind).toUpperCase() === "DEPOSIT";
}

function resolveFriendlyPaymentSchedule(booking, buildBookingOfferPaymentTermsReadModel) {
  const offerSnapshot = booking?.accepted_offer_snapshot && typeof booking.accepted_offer_snapshot === "object"
    ? booking.accepted_offer_snapshot
    : booking?.offer;
  const paymentTermsSnapshot = booking?.accepted_payment_terms_snapshot && typeof booking.accepted_payment_terms_snapshot === "object"
    ? booking.accepted_payment_terms_snapshot
    : offerSnapshot?.payment_terms;
  if (!paymentTermsSnapshot || typeof buildBookingOfferPaymentTermsReadModel !== "function") return null;
  const currency = normalizeText(
    paymentTermsSnapshot?.currency
    || offerSnapshot?.currency
    || booking?.preferred_currency
    || booking?.pricing?.currency
    || "USD"
  ).toUpperCase() || "USD";
  const totalAmountCents = Math.max(0, Math.round(Number(
    offerSnapshot?.total_price_cents
    || offerSnapshot?.totals?.total_price_cents
    || 0
  )));
  return buildBookingOfferPaymentTermsReadModel(paymentTermsSnapshot, currency, totalAmountCents);
}

function resolveTravelPlanForDepositRequest(booking, buildBookingTravelPlanReadModel, lang) {
  const offerSnapshot = booking?.accepted_offer_snapshot && typeof booking.accepted_offer_snapshot === "object"
    ? booking.accepted_offer_snapshot
    : booking?.offer;
  const travelPlanSnapshot = booking?.accepted_travel_plan_snapshot && typeof booking.accepted_travel_plan_snapshot === "object"
    ? booking.accepted_travel_plan_snapshot
    : booking?.travel_plan;
  if (!travelPlanSnapshot) return { days: [] };
  if (typeof buildBookingTravelPlanReadModel !== "function") return travelPlanSnapshot;
  return buildBookingTravelPlanReadModel(travelPlanSnapshot, offerSnapshot, {
    lang,
    contentLang: lang,
    flatLang: lang,
    sourceLang: lang
  });
}

async function resolveDepositHeroImage(booking, bookingImagesDir, fallbackImagePath) {
  const relativePath = extractPublicRelativePath(booking?.image, "/public/v1/booking-images/");
  const imagePath = relativePath
    ? path.resolve(String(bookingImagesDir || ""), relativePath)
    : String(fallbackImagePath || "");
  return rasterizeImage(imagePath, {
    width: 1200,
    height: 780
  }).catch(() => null);
}

function estimateGuideSectionHeight(doc, guideTitle, guideBody, fonts, hasPhoto) {
  const photoWidth = hasPhoto ? GUIDE_PHOTO_SIZE + 18 : 0;
  const textWidth = doc.page.width - PAGE_MARGIN * 2 - 30 - photoWidth;
  doc.font(pdfFontName("bold", fonts)).fontSize(13);
  const titleHeight = doc.heightOfString(guideTitle, { width: textWidth, lineGap: 1 });
  doc.font(pdfFontName("regular", fonts)).fontSize(10.4);
  const bodyHeight = doc.heightOfString(guideBody, { width: textWidth, lineGap: 2 });
  return Math.max(26 + titleHeight + 6 + bodyHeight + 18, hasPhoto ? GUIDE_PHOTO_SIZE + 26 : 120);
}

function drawGuideSection(doc, startY, fonts, lang, guideContext, guidePhoto) {
  const profile = guideContext?.profile || null;
  const guideName = textOrNull(resolveAtpGuideIntroName(profile)) || textOrNull(resolveAtpStaffFullName(profile));
  const guideTitle = guideName
    ? pdfT(lang, "guide.section_title_named", "Our team member {name} will assist you", { name: guideName })
    : pdfT(lang, "guide.section_title_fallback", "Our team member will assist you");
  const guideBody = textOrNull(resolveAtpGuideShortDescriptionText(guideContext, lang))
    || pdfT(lang, "guide.intro_generic", "An ATP travel specialist will be assigned to keep this route comfortable, practical, and easy to follow.");
  const cardWidth = doc.page.width - PAGE_MARGIN * 2;
  const hasPhoto = Boolean(profile);
  const cardHeight = estimateGuideSectionHeight(doc, guideTitle, guideBody, fonts, hasPhoto);
  const photoWidth = hasPhoto ? GUIDE_PHOTO_SIZE + 18 : 0;
  const textX = PAGE_MARGIN + 16;
  const textWidth = cardWidth - 32 - photoWidth;
  const photoX = PAGE_MARGIN + cardWidth - 16 - GUIDE_PHOTO_SIZE;

  doc
    .save()
    .roundedRect(PAGE_MARGIN, startY, cardWidth, cardHeight, 14)
    .fill(PDF_COLORS.surfaceSubtle)
    .restore();

  if (hasPhoto) {
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
    .text(guideTitle, textX, y, { width: textWidth, lineGap: 1 });
  y = doc.y + 6;
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(10.4)
    .fillColor(PDF_COLORS.textMutedStrong)
    .text(guideBody, textX, y, { width: textWidth, lineGap: 2 });

  return startY + cardHeight + 18;
}

function drawDepositHero(doc, booking, travelPlan, heroImage, startY, fonts, lang) {
  const title = textOrNull(booking?.name) || pdfT(lang, "offer.travel_plan_title", "Travel plan overview");
  const dayCount = Array.isArray(travelPlan?.days) ? travelPlan.days.length : 0;
  const subtitle = dayCount > 0
    ? pdfT(lang, "payment.deposit_request.trip_length", "{count} days", { count: String(dayCount) })
    : "";
  const detailsX = PAGE_MARGIN + HERO_IMAGE_WIDTH + 18;
  const detailsWidth = doc.page.width - PAGE_MARGIN - detailsX;
  if (heroImage?.buffer) {
    doc
      .save()
      .roundedRect(PAGE_MARGIN, startY, HERO_IMAGE_WIDTH, HERO_IMAGE_HEIGHT, 18)
      .clip();
    doc.image(heroImage.buffer, PAGE_MARGIN, startY, {
      width: HERO_IMAGE_WIDTH,
      height: HERO_IMAGE_HEIGHT
    });
    doc.restore();
  } else {
    doc
      .save()
      .roundedRect(PAGE_MARGIN, startY, HERO_IMAGE_WIDTH, HERO_IMAGE_HEIGHT, 18)
      .fill(PDF_COLORS.surfaceMuted)
      .restore();
  }
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(24)
    .fillColor(PDF_COLORS.textStrong)
    .text(title, detailsX, startY + 6, { width: detailsWidth });
  if (subtitle) {
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(11.5)
      .fillColor(PDF_COLORS.textMutedStrong)
      .text(subtitle, detailsX, doc.y + 6, { width: detailsWidth });
  }
  return Math.max(startY + HERO_IMAGE_HEIGHT, doc.y) + 20;
}

function friendlyScheduleRowLabel(line, installmentIndex, lang) {
  const kind = normalizeText(line?.kind).toUpperCase();
  if (kind === "DEPOSIT") {
    return pdfT(lang, "payment.deposit_request.schedule.deposit", "Deposit");
  }
  if (kind === "FINAL_BALANCE") {
    return pdfT(lang, "payment.deposit_request.schedule.final", "Final payment");
  }
  return normalizeText(line?.label) || pdfT(lang, "payment.deposit_request.schedule.installment", "Installment {count}", {
    count: String(installmentIndex)
  });
}

function drawDepositPaymentSchedule(doc, startY, schedule, invoiceCurrency, fonts, lang) {
  const rows = Array.isArray(schedule?.lines) ? schedule.lines : [];
  if (!rows.length) return startY;
  const leftWidth = doc.page.width - PAGE_MARGIN * 2;
  const rowHeight = 32;
  const totalAmountCents = Math.max(
    0,
    Math.round(Number(schedule?.scheduled_total_amount_cents || schedule?.basis_total_amount_cents || 0))
  );
  let installmentIndex = 1;
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(14)
    .fillColor(PDF_COLORS.textStrong)
    .text(pdfT(lang, "payment.deposit_request.schedule.title", "Your payment schedule"), PAGE_MARGIN, startY, { width: leftWidth });
  let y = doc.y + 10;
  doc
    .save()
    .roundedRect(PAGE_MARGIN, y, leftWidth, rowHeight, 12)
    .fill(PDF_COLORS.surfaceMuted)
    .restore();
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(10)
    .fillColor(PDF_COLORS.textMutedStrong)
    .text(pdfT(lang, "payment.deposit_request.schedule.step", "Payment step"), PAGE_MARGIN + 12, y + 10, { width: leftWidth - 160 })
    .text(pdfT(lang, "payment.deposit_request.schedule.amount", "Amount"), doc.page.width - PAGE_MARGIN - 132, y + 10, { width: 120, align: "right" });
  y += rowHeight + 8;

  rows.forEach((line) => {
    const rowLabel = friendlyScheduleRowLabel(line, installmentIndex, lang);
    if (normalizeText(line?.kind).toUpperCase() !== "DEPOSIT" && normalizeText(line?.kind).toUpperCase() !== "FINAL_BALANCE") {
      installmentIndex += 1;
    }
    doc
      .save()
      .roundedRect(PAGE_MARGIN, y, leftWidth, rowHeight, 12)
      .fill(PDF_COLORS.surface)
      .restore();
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(10.4)
      .fillColor(PDF_COLORS.textStrong)
      .text(rowLabel, PAGE_MARGIN + 12, y + 10, { width: leftWidth - 160 })
      .text(formatPdfMoney(line?.resolved_amount_cents || 0, invoiceCurrency, lang), doc.page.width - PAGE_MARGIN - 132, y + 10, {
        width: 120,
        align: "right"
      });
    y += rowHeight + 6;
  });

  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(11.2)
    .fillColor(PDF_COLORS.textStrong)
    .text(pdfT(lang, "payment.deposit_request.schedule.total", "Total amount"), PAGE_MARGIN, y + 6, {
      width: leftWidth - 140,
      align: "right"
    })
    .text(formatPdfMoney(totalAmountCents, invoiceCurrency, lang), doc.page.width - PAGE_MARGIN - 132, y + 6, {
      width: 120,
      align: "right"
    });
  return doc.y + 20;
}

function drawParagraph(doc, startY, text, fonts) {
  if (!text) return startY;
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(10.8)
    .fillColor(PDF_COLORS.textMutedStrong)
    .text(text, PAGE_MARGIN, startY, { width: doc.page.width - PAGE_MARGIN * 2, lineGap: 2 });
  return doc.y;
}

function drawDepositTravelPlanRunningHeader(doc, booking, fonts, companyProfile, lang) {
  let y = PAGE_MARGIN;
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(11)
    .fillColor(PDF_COLORS.textStrong)
    .text(textOrNull(booking?.name) || pdfT(lang, "offer.travel_plan_title", "Travel plan overview"), PAGE_MARGIN, y, {
      width: (doc.page.width - PAGE_MARGIN * 2) / 2
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

export function createInvoicePdfWriter({
  invoicePdfPath,
  companyProfile = null,
  logoPath = "",
  bookingImagesDir = "",
  resolveAssignedAtpStaffProfile = null,
  resolveAtpStaffPhotoDiskPath = null,
  fallbackImagePath = "",
  buildBookingOfferPaymentTermsReadModel = null,
  buildBookingTravelPlanReadModel = null
}) {
  return async function writeInvoicePdf(invoice, invoiceParty, booking, options = {}) {
    const lang = normalizePdfLang(invoice?.lang || booking?.customer_language || booking?.web_form_submission?.preferred_language || "en");
    const outputPath = normalizeText(options?.outputPath) || invoicePdfPath(invoice.id, invoice.version || 1);
    await mkdir(path.dirname(outputPath), { recursive: true });
    const fonts = await resolvePdfFontsForLang({
      lang,
      regularCandidates: PDF_FONT_REGULAR_CANDIDATES,
      boldCandidates: PDF_FONT_BOLD_CANDIDATES
    });
    const recipient = invoice?.recipient_snapshot || invoiceParty || {};
    const currency = normalizeText(invoice?.currency) || "USD";
    const components = Array.isArray(invoice?.components) ? invoice.components : [];
    const logoImage = await fileExists(logoPath)
      ? { path: logoPath }
      : null;
    const previewMode = options?.preview === true || invoice?.is_preview === true;
    const previewWatermarkText = normalizeText(options?.previewWatermarkText) || normalizeText(invoice?.preview_watermark_text) || "Preview";
    const depositRequestMode = isDepositPaymentRequestDocument(invoice);
    const travelPlan = depositRequestMode
      ? resolveTravelPlanForDepositRequest(booking, buildBookingTravelPlanReadModel, lang)
      : null;
    const paymentSchedule = depositRequestMode
      ? resolveFriendlyPaymentSchedule(booking, buildBookingOfferPaymentTermsReadModel)
      : null;
    const guideContext = depositRequestMode
      ? await resolveAtpGuidePdfContext({
          booking,
          resolveAssignedAtpStaffProfile,
          resolveAtpStaffPhotoDiskPath
        })
      : null;
    const [heroImage, guidePhoto, itemThumbnailMap] = depositRequestMode
      ? await Promise.all([
          resolveDepositHeroImage(booking, bookingImagesDir, fallbackImagePath),
          guideContext?.photoDiskPath
            ? rasterizeImage(guideContext.photoDiskPath, {
                width: 420,
                height: 420
              }).catch(() => null)
            : Promise.resolve(null),
          buildTravelPlanItemThumbnailMap(travelPlan, bookingImagesDir)
        ])
      : [null, null, new Map()];

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: PAGE_SIZE,
        margin: 0,
        autoFirstPage: true,
        bufferPages: previewMode,
        compress: false,
        info: {
          Title: normalizeText(invoice?.title) || invoiceSubjectLabel(invoice, lang),
          Author: companyProfile?.name || "Asia Travel Plan",
          Subject: invoiceSubjectLabel(invoice, lang)
        }
      });
      const stream = createWriteStream(outputPath);
      doc.pipe(stream);
      stream.on("finish", resolve);
      stream.on("error", reject);
      doc.on("error", reject);
      registerPdfFonts(doc, fonts);

      if (depositRequestMode) {
        let y = drawPdfCompanyHeader(doc, {
          companyProfile,
          logoImage,
          fonts,
          lang,
          pageMargin: PAGE_MARGIN,
          colors: PDF_COLORS,
          pdfFontName
        });
        y = drawDepositHero(doc, booking, travelPlan, heroImage, y, fonts, lang);
        y = drawGuideSection(doc, y, fonts, lang, guideContext, guidePhoto);
        y = drawDepositPaymentSchedule(doc, y, paymentSchedule, currency, fonts, lang);
        y = drawParagraph(doc, y, normalizeText(invoice?.intro), fonts) + 14;
        if (Array.isArray(travelPlan?.days) && travelPlan.days.length) {
          y = drawParagraph(doc, y, pdfT(lang, "payment.deposit_request.travel_plan_note", "Please find your travel plan at the end of this PDF."), fonts) + 14;
        }
        y = drawParagraph(doc, y, normalizeText(invoice?.closing), fonts);
        drawFooter(doc, fonts, companyProfile, lang);

        if (Array.isArray(travelPlan?.days) && travelPlan.days.length) {
          doc.addPage();
          const addContinuationPage = () => {
            drawFooter(doc, fonts, companyProfile, lang);
            doc.addPage();
            return drawDepositTravelPlanRunningHeader(doc, booking, fonts, companyProfile, lang);
          };
          const bottomLimit = () => doc.page.height - PAGE_MARGIN - 24;
          const startY = drawDepositTravelPlanRunningHeader(doc, booking, fonts, companyProfile, lang);
          drawTravelPlanDaysSection({
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
            bottomLimit,
            addContinuationPage,
            sectionTitle: pdfT(lang, "travel_plan.pdf_subtitle", "Travel plan"),
            emptyStateMessage: pdfT(lang, "travel_plan.empty", "No travel plan is available yet."),
            sectionTitleFontSize: 18,
            renderSectionTitle: true
          });
          drawFooter(doc, fonts, companyProfile, lang);
        }
      } else {
        let y = drawPdfCompanyHeader(doc, {
          companyProfile,
          logoImage,
          fonts,
          lang,
          pageMargin: PAGE_MARGIN,
          colors: PDF_COLORS,
          pdfFontName
        });
        doc
          .font(pdfFontName("bold", fonts))
          .fontSize(24)
          .fillColor(PDF_COLORS.textStrong)
          .text(normalizeText(invoice?.title) || pdfT(lang, "invoice.title_fallback", "Invoice for {recipient}", {
            recipient: safeText(recipient?.name, pdfT(lang, "invoice.recipient_fallback", "recipient"))
          }), PAGE_MARGIN, y, { width: 320 });
        if (normalizeText(invoice?.subtitle)) {
          doc
            .font(pdfFontName("regular", fonts))
            .fontSize(11)
            .fillColor(PDF_COLORS.textMutedStrong)
            .text(invoice.subtitle, PAGE_MARGIN, doc.y + 4, { width: 320 });
        }
        y = doc.y + 20;

        const leftWidth = doc.page.width - PAGE_MARGIN * 2;
        y = drawMetaRow(doc, `${pdfT(lang, "invoice.number", "Invoice number")}:`, safeText(invoice?.invoice_number, invoice?.id), PAGE_MARGIN, y, leftWidth, fonts) + 6;
        y = drawMetaRow(doc, `${pdfT(lang, "invoice.issue_date", "Issue date")}:`, safeText(formatPdfDateOnly(invoice?.issue_date, lang, { day: "2-digit", month: "short", year: "numeric" }), safeText(invoice?.issue_date)), PAGE_MARGIN, y, leftWidth, fonts) + 6;
        y = drawMetaRow(doc, `${pdfT(lang, "invoice.booking", "Booking")}:`, safeText(invoice?.booking_snapshot?.name || booking?.name, safeText(booking?.id)), PAGE_MARGIN, y, leftWidth, fonts) + 6;
        if (normalizeText(invoice?.payment_label)) {
          y = drawMetaRow(doc, `${pdfT(lang, "payment.label", "Payment")}:`, safeText(invoice?.payment_label), PAGE_MARGIN, y, leftWidth, fonts) + 6;
        }
        if (normalizeText(invoice?.payment_received_at)) {
          y = drawMetaRow(
            doc,
            `${pdfT(lang, "payment.received_at", "Received on")}:`,
            safeText(formatPdfDateOnly(invoice?.payment_received_at, lang, { day: "2-digit", month: "short", year: "numeric" }), safeText(invoice?.payment_received_at)),
            PAGE_MARGIN,
            y,
            leftWidth,
            fonts
          ) + 6;
        }
        if (normalizeText(invoice?.payment_confirmed_by_label || invoice?.payment_confirmed_by_atp_staff_id)) {
          y = drawMetaRow(
            doc,
            `${pdfT(lang, "payment.confirmed_by", "Confirmed by")}:`,
            safeText(invoice?.payment_confirmed_by_label || invoice?.payment_confirmed_by_atp_staff_id),
            PAGE_MARGIN,
            y,
            leftWidth,
            fonts
          ) + 6;
        }
        if (normalizeText(invoice?.payment_reference)) {
          y = drawMetaRow(doc, `${pdfT(lang, "payment.reference", "Reference")}:`, safeText(invoice?.payment_reference), PAGE_MARGIN, y, leftWidth, fonts) + 6;
        }
        y = drawMetaRow(doc, `${pdfT(lang, "invoice.currency", "Currency")}:`, currency, PAGE_MARGIN, y, leftWidth, fonts) + 18;

        y = ensureSpace(doc, y, 86);
        doc
          .save()
          .roundedRect(PAGE_MARGIN, y, leftWidth, 74, 12)
          .fill(PDF_COLORS.surfaceMuted)
          .restore();
        doc
          .font(pdfFontName("bold", fonts))
          .fontSize(11)
          .fillColor(PDF_COLORS.textStrong)
          .text(pdfT(lang, "invoice.recipient", "Recipient"), PAGE_MARGIN + 14, y + 12);
        doc
          .font(pdfFontName("regular", fonts))
          .fontSize(10.5)
          .fillColor(PDF_COLORS.textMutedStrong)
          .text(safeText(recipient?.name, "-"), PAGE_MARGIN + 14, y + 30, { width: leftWidth - 28 })
          .text(`${pdfT(lang, "invoice.email", "Email")}: ${safeText(recipient?.email)}`, PAGE_MARGIN + 14, y + 46, { width: leftWidth / 2 - 18 })
          .text(`${pdfT(lang, "invoice.phone", "Phone")}: ${safeText(recipient?.phone_number)}`, PAGE_MARGIN + leftWidth / 2, y + 46, { width: leftWidth / 2 - 14 });
        y += 94;

        if (normalizeText(invoice?.intro)) {
          y = ensureSpace(doc, y, 60);
          doc
            .font(pdfFontName("regular", fonts))
            .fontSize(10.8)
            .fillColor(PDF_COLORS.textMutedStrong)
            .text(invoice.intro, PAGE_MARGIN, y, { width: leftWidth, lineGap: 2 });
          y = doc.y + 16;
        }

        y = ensureSpace(doc, y, 90);
        doc
          .font(pdfFontName("bold", fonts))
          .fontSize(13)
          .fillColor(PDF_COLORS.textStrong)
          .text(pdfT(lang, "invoice.components", "Components"), PAGE_MARGIN, y);
        y += 18;

        const columns = [
          { label: pdfT(lang, "offer.table.details", "Details"), width: 240, align: "left" },
          { label: pdfT(lang, "offer.table.quantity", "Quantity"), width: 70, align: "right" },
          { label: pdfT(lang, "offer.table.single", "Single"), width: 100, align: "right" },
          { label: pdfT(lang, "offer.table.total_incl_tax", "Total (incl. tax)"), width: 110, align: "right" }
        ];

        doc
          .save()
          .roundedRect(PAGE_MARGIN, y, leftWidth, 28, 10)
          .fill(PDF_COLORS.surfaceMuted)
          .restore();
        let x = PAGE_MARGIN;
        doc.font(pdfFontName("bold", fonts)).fontSize(9.2).fillColor(PDF_COLORS.textMutedStrong);
        for (const column of columns) {
          doc.text(column.label, x + 8, y + 8, { width: column.width - 16, align: column.align });
          x += column.width;
        }
        y += 38;

        if (!components.length) {
          doc
            .font(pdfFontName("regular", fonts))
            .fontSize(10.5)
            .fillColor(PDF_COLORS.textMuted)
            .text(pdfT(lang, "invoice.no_components", "No invoice components"), PAGE_MARGIN, y, { width: leftWidth });
          y = doc.y + 18;
        } else {
          for (const component of components) {
            const rowHeight = 28;
            y = ensureSpace(doc, y, rowHeight + 10);
            doc
              .save()
              .roundedRect(PAGE_MARGIN, y, leftWidth, rowHeight, 10)
              .fill(PDF_COLORS.surface)
              .restore();
            const values = [
              safeText(component?.description),
              String(Math.max(1, Number(component?.quantity || 1))),
              formatPdfMoney(component?.unit_amount_cents, currency, lang),
              formatPdfMoney(componentRowTotal(component), currency, lang)
            ];
            let colX = PAGE_MARGIN;
            values.forEach((value, index) => {
              const column = columns[index];
              doc
                .font(pdfFontName("regular", fonts))
                .fontSize(10.2)
                .fillColor(PDF_COLORS.textStrong)
                .text(value, colX + 8, y + 8, { width: column.width - 16, align: column.align });
              colX += column.width;
            });
            y += rowHeight + 6;
          }
        }

        y = ensureSpace(doc, y, 72);
        const totalLabelWidth = 150;
        doc
          .font(pdfFontName("bold", fonts))
          .fontSize(11)
          .fillColor(PDF_COLORS.textStrong)
          .text(pdfT(lang, "invoice.total_amount", "Total amount"), doc.page.width - PAGE_MARGIN - totalLabelWidth - 150, y, {
            width: totalLabelWidth,
            align: "right"
          })
          .text(formatPdfMoney(invoice?.total_amount_cents, currency, lang), doc.page.width - PAGE_MARGIN - 140, y, {
            width: 140,
            align: "right"
          });
        y += 18;
        doc
          .font(pdfFontName("bold", fonts))
          .fontSize(11)
          .fillColor(PDF_COLORS.textStrong)
          .text(pdfT(lang, "invoice.due_amount", "Due amount"), doc.page.width - PAGE_MARGIN - totalLabelWidth - 150, y, {
            width: totalLabelWidth,
            align: "right"
          })
          .text(formatPdfMoney(invoice?.due_amount_cents, currency, lang), doc.page.width - PAGE_MARGIN - 140, y, {
            width: 140,
            align: "right"
          });
        y += 28;

        if (normalizeText(invoice?.notes)) {
          y = ensureSpace(doc, y, 72);
          doc
            .font(pdfFontName("bold", fonts))
            .fontSize(11)
            .fillColor(PDF_COLORS.textStrong)
            .text(pdfT(lang, "invoice.notes", "Notes"), PAGE_MARGIN, y);
          y += 16;
          doc
            .font(pdfFontName("regular", fonts))
            .fontSize(10.5)
            .fillColor(PDF_COLORS.textMutedStrong)
            .text(invoice.notes, PAGE_MARGIN, y, { width: leftWidth, lineGap: 2 });
          y = doc.y + 16;
        }

        if (normalizeText(invoice?.closing)) {
          y = ensureSpace(doc, y, 60);
          doc
            .font(pdfFontName("regular", fonts))
            .fontSize(10.5)
            .fillColor(PDF_COLORS.textMutedStrong)
            .text(invoice.closing, PAGE_MARGIN, y, { width: leftWidth, lineGap: 2 });
        }

        drawFooter(doc, fonts, companyProfile, lang);
      }

      if (previewMode) {
        const { start, count } = doc.bufferedPageRange();
        for (let index = start; index < start + count; index += 1) {
          doc.switchToPage(index);
          drawPreviewWatermark(doc, fonts, previewWatermarkText);
        }
      }

      doc.end();
    });

    return {
      outputPath
    };
  };
}
