import { createWriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { normalizeText } from "./text.js";

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
  "/Library/Fonts/Arial Unicode.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
];

const PDF_FONT_BOLD_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
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

function formatFriendlyDate(isoValue) {
  const candidate = normalizeText(isoValue);
  if (!candidate) return "";
  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) return candidate;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
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

function resolveBookingHeroTitle(booking) {
  return textOrNull(booking?.name) || textOrNull(booking?.web_form_submission?.booking_name) || "Travel Offer";
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

function drawTopHeader(doc, companyProfile, logoImage, fonts) {
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
    .text(`WhatsApp: ${companyProfile.whatsapp}`, rightColumnX, y + 50, { width: 220, align: "right" })
    .text(`Email: ${companyProfile.email}`, rightColumnX, y + 66, { width: 220, align: "right" })
    .text(companyProfile.website, rightColumnX, y + 82, { width: 220, align: "right" });

  const nextY = y + 106;
  drawDivider(doc, nextY);
  return nextY + 18;
}

function drawHero(doc, booking, generatedOffer, heroImage, startY, fonts) {
  const heroTitle = resolveBookingHeroTitle(booking);
  const heroSubtitle = "Your personalized Asia Travel Plan offer";
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
    `${formatFriendlyDate(generatedOffer?.created_at)} (v${Number(generatedOffer?.version || 1)})`,
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
      `Prepared for your requested itinerary in ${generatedOffer?.currency || booking?.preferred_currency || "USD"}.`,
      detailsX,
      chipsY + 34,
      {
        width: detailsWidth
      }
    );

  return Math.max(startY + HERO_IMAGE_HEIGHT, doc.y) + 22;
}

function drawIntro(doc, startY, fonts) {
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11.5)
    .fillColor("#33454C")
    .text(
      "Thank you for considering Asia Travel Plan for your journey. We are pleased to share this offer for your trip, and we hope it feels like a strong starting point for your travel planning. If you like it, simply reply to us and we will refine the next steps together.",
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

function drawTravelers(doc, booking, startY, fonts) {
  const travelers = peopleTraveling(booking);
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(13)
    .fillColor("#23363D")
    .text("Who is traveling", PAGE_MARGIN, startY);

  const boxY = startY + 18;
  const boxWidth = doc.page.width - PAGE_MARGIN * 2;
  const lines = travelers.length
    ? travelers.map((person, index) => {
        const name = textOrNull(person?.name) || `Traveler ${index + 1}`;
        const extras = [];
        if (safeArray(person?.roles).includes("primary_contact")) extras.push("Primary contact");
        if (person?.nationality) extras.push(person.nationality);
        return extras.length ? `${name} (${extras.join(", ")})` : name;
      })
    : [textOrNull(booking?.web_form_submission?.name) || "Traveler details will be confirmed with you"];

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

function drawOfferTable(doc, generatedOffer, startY, formatMoneyValue, fonts) {
  const columns = [
    { key: "category", label: "Category", width: 86 },
    { key: "details", label: "Details", width: 155 },
    { key: "quantity", label: "Quantity", width: 68, align: "right" },
    { key: "single", label: "Single", width: 78, align: "right" },
    { key: "total", label: "Total (incl. tax)", width: 120, align: "right" }
  ];
  let y = startY;
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(13)
    .fillColor("#23363D")
    .text("Offer details", PAGE_MARGIN, y);
  y += 18;

  const redrawHeader = (pdfDoc, nextY) => drawTableHeader(pdfDoc, nextY, columns, fonts);
  y = drawTableHeader(doc, y, columns, fonts);

  const components = safeArray(generatedOffer?.offer?.components);
  if (!components.length) {
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(10.5)
      .fillColor("#5F6E74")
      .text("No offer items were included in this version of the offer.", PAGE_MARGIN, y, {
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
    .text("Offer total", PAGE_MARGIN + columns[0].width + columns[1].width, y + 6, {
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

function drawClosing(doc, startY, fonts) {
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11)
    .fillColor("#33454C")
    .text(
      "If this offer feels right for you, simply respond to us by email or WhatsApp and we will be happy to confirm next steps, refine details, and help you move toward booking.",
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
    .text("Warm regards,", PAGE_MARGIN, signY);
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(12)
    .fillColor("#23363D")
    .text("The Asia Travel Plan Team", PAGE_MARGIN, signY + 18);
  return doc.y + 10;
}

function fallbackFormatMoney(currency, amountCents) {
  const code = normalizeText(currency) || "USD";
  const decimalPlaces = code === "VND" || code === "THB" ? 0 : 2;
  const symbolMap = {
    USD: "$",
    EURO: "€",
    VND: "₫",
    THB: "฿",
    AUD: "A$",
    GBP: "£",
    NZD: "NZ$",
    ZAR: "R"
  };
  const symbol = symbolMap[code] || `${code} `;
  const amount = Number(amountCents || 0) / 10 ** decimalPlaces;
  return `${symbol}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
    useGrouping: true
  }).format(amount)}`;
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
  const renderMoney = (amountCents, currency) => {
    if (typeof formatMoney === "function") return formatMoney(amountCents, currency);
    return fallbackFormatMoney(currency, amountCents);
  };

  return async function writeGeneratedOfferPdf(generatedOffer, booking) {
    const outputPath = generatedOfferPdfPath(generatedOffer.id);
    await mkdir(path.dirname(outputPath), { recursive: true });

    const [logoImage, heroPath, fonts] = await Promise.all([
      rasterizeImage(logoPath, { width: 1000 }),
      resolveBookingImageForPdf({ booking, bookingImagesDir, readTours, resolveTourImageDiskPath }),
      resolvePdfFonts()
    ]);
    const heroImage = await rasterizeImage(heroPath || fallbackImagePath, { width: 1200, height: 780 });

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: PAGE_SIZE,
        margin: 0,
        autoFirstPage: true,
        compress: false,
        info: {
          Title: `${resolveBookingHeroTitle(booking)} Offer`,
          Author: companyProfile.name,
          Subject: "Travel Offer"
        }
      });
      const stream = createWriteStream(outputPath);
      doc.pipe(stream);
      stream.on("finish", resolve);
      stream.on("error", reject);
      doc.on("error", reject);

      registerPdfFonts(doc, fonts);

      let y = drawTopHeader(doc, companyProfile, logoImage, fonts);
      y = drawHero(doc, booking, generatedOffer, heroImage, y, fonts);
      y = drawIntro(doc, y, fonts);
      y = drawTravelers(doc, booking, y, fonts);
      y = drawOfferTable(doc, generatedOffer, y, renderMoney, fonts);
      y = ensureSpace(doc, y, 90);
      y = drawClosing(doc, y + 18, fonts);

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
