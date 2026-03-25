import { createWriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import {
  formatPdfDateOnly,
  formatPdfMoney,
  normalizePdfLang,
  pdfT
} from "./pdf_i18n.js";
import { pdfTheme } from "./style_tokens.js";
import { normalizeText } from "./text.js";

const PAGE_SIZE = "A4";
const PAGE_MARGIN = 46;
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

export function createInvoicePdfWriter({ invoicePdfPath, companyProfile = null }) {
  return async function writeInvoicePdf(invoice, invoiceParty, booking) {
    const lang = normalizePdfLang(invoice?.lang || booking?.customer_language || booking?.web_form_submission?.preferred_language || "en");
    const outputPath = invoicePdfPath(invoice.id, invoice.version || 1);
    await mkdir(path.dirname(outputPath), { recursive: true });
    const fonts = await resolvePdfFonts();
    const recipient = invoice?.recipient_snapshot || invoiceParty || {};
    const currency = normalizeText(invoice?.currency) || "USD";
    const components = Array.isArray(invoice?.components) ? invoice.components : [];

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: PAGE_SIZE,
        margin: 0,
        autoFirstPage: true,
        compress: false,
        info: {
          Title: normalizeText(invoice?.title) || pdfT(lang, "invoice.subject", "Invoice"),
          Author: companyProfile?.name || "Asia Travel Plan",
          Subject: pdfT(lang, "invoice.subject", "Invoice")
        }
      });
      const stream = createWriteStream(outputPath);
      doc.pipe(stream);
      stream.on("finish", resolve);
      stream.on("error", reject);
      doc.on("error", reject);
      registerPdfFonts(doc, fonts);

      let y = PAGE_MARGIN;
      doc
        .font(pdfFontName("bold", fonts))
        .fontSize(24)
        .fillColor(PDF_COLORS.textStrong)
        .text(normalizeText(invoice?.title) || pdfT(lang, "invoice.title_fallback", "Invoice for {recipient}", {
          recipient: safeText(recipient?.name, pdfT(lang, "invoice.recipient_fallback", "recipient"))
        }), PAGE_MARGIN, y, { width: 320 });

      if (companyProfile) {
        doc
          .font(pdfFontName("bold", fonts))
          .fontSize(12)
          .fillColor(PDF_COLORS.textStrong)
          .text(companyProfile.name, doc.page.width - PAGE_MARGIN - 220, y, { width: 220, align: "right" });
        doc
          .font(pdfFontName("regular", fonts))
          .fontSize(10)
          .fillColor(PDF_COLORS.textMuted)
          .text(companyProfile.address, doc.page.width - PAGE_MARGIN - 220, y + 18, { width: 220, align: "right" })
          .text(companyProfile.email, doc.page.width - PAGE_MARGIN - 220, y + 50, { width: 220, align: "right" })
          .text(companyProfile.website, doc.page.width - PAGE_MARGIN - 220, y + 66, { width: 220, align: "right" })
          .text(companyProfile.whatsapp, doc.page.width - PAGE_MARGIN - 220, y + 82, { width: 220, align: "right" });
      }

      y += 106;
      drawDivider(doc, y);
      y += 20;

      const leftWidth = doc.page.width - PAGE_MARGIN * 2;
      y = drawMetaRow(doc, `${pdfT(lang, "invoice.number", "Invoice number")}:`, safeText(invoice?.invoice_number, invoice?.id), PAGE_MARGIN, y, leftWidth, fonts) + 6;
      y = drawMetaRow(doc, `${pdfT(lang, "invoice.issue_date", "Issue date")}:`, safeText(formatPdfDateOnly(invoice?.issue_date, lang, { day: "2-digit", month: "short", year: "numeric" }), safeText(invoice?.issue_date)), PAGE_MARGIN, y, leftWidth, fonts) + 6;
      y = drawMetaRow(doc, `${pdfT(lang, "invoice.due_date", "Due date")}:`, safeText(formatPdfDateOnly(invoice?.due_date, lang, { day: "2-digit", month: "short", year: "numeric" }), safeText(invoice?.due_date)), PAGE_MARGIN, y, leftWidth, fonts) + 6;
      y = drawMetaRow(doc, `${pdfT(lang, "invoice.booking", "Booking")}:`, safeText(invoice?.booking_snapshot?.name || booking?.name, safeText(booking?.id)), PAGE_MARGIN, y, leftWidth, fonts) + 6;
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
      }

      drawDivider(doc, doc.page.height - PAGE_MARGIN - 12);
      doc
        .font(pdfFontName("regular", fonts))
        .fontSize(8.5)
        .fillColor(PDF_COLORS.textMuted)
        .text(
          companyProfile
            ? `${companyProfile.name} · ${companyProfile.website} · ${companyProfile.email} · ${companyProfile.whatsapp}`
            : pdfT(lang, "invoice.footer", "Issued by Asia Travel Plan"),
          PAGE_MARGIN,
          doc.page.height - PAGE_MARGIN,
          { width: doc.page.width - PAGE_MARGIN * 2, align: "center" }
        );

      doc.end();
    });
  };
}
