import { pdfT } from "./pdf_i18n.js";

const DEFAULT_LOGO_WIDTH = 250;
const DEFAULT_LOGO_HEIGHT = 98;
const DEFAULT_RIGHT_COLUMN_WIDTH = 220;
const DEFAULT_PAGE_MARGIN = 44;
const DEFAULT_COLORS = Object.freeze({
  line: "#d8e1e8",
  textStrong: "#1f4f6f",
  textMuted: "#5f7990"
});

function resolveLogoSource(logoImage) {
  if (!logoImage) return null;
  if (Buffer.isBuffer(logoImage)) return logoImage;
  if (logoImage?.buffer) return logoImage.buffer;
  if (typeof logoImage?.path === "string" && logoImage.path.trim()) return logoImage.path;
  if (typeof logoImage === "string" && logoImage.trim()) return logoImage;
  return null;
}

export function drawPdfCompanyHeader(doc, {
  companyProfile = null,
  logoImage = null,
  fonts = null,
  lang = "en",
  pageMargin = DEFAULT_PAGE_MARGIN,
  colors = DEFAULT_COLORS,
  pdfFontName = (weight) => weight === "bold" ? "Helvetica-Bold" : "Helvetica",
  logoWidth = DEFAULT_LOGO_WIDTH,
  logoHeight = DEFAULT_LOGO_HEIGHT,
  rightColumnWidth = DEFAULT_RIGHT_COLUMN_WIDTH
} = {}) {
  const profile = companyProfile || {};
  let y = pageMargin;
  let logoBottomY = y;
  const logoSource = resolveLogoSource(logoImage);
  if (logoSource) {
    doc.image(logoSource, pageMargin, y + 2, {
      fit: [logoWidth, logoHeight],
      align: "left",
      valign: "top"
    });
    logoBottomY = y + 2 + logoHeight;
  }

  const rightColumnX = doc.page.width - pageMargin - rightColumnWidth;
  const addressY = y + 18;
  const addressOptions = { width: rightColumnWidth, align: "right" };
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(13)
    .fillColor(colors.textStrong || DEFAULT_COLORS.textStrong)
    .text(profile.name || "Asia Travel Plan", rightColumnX, y, addressOptions);
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(10)
    .fillColor(colors.textMuted || DEFAULT_COLORS.textMuted);

  const addressText = profile.address || "";
  const addressHeight = addressText
    ? doc.heightOfString(addressText, addressOptions)
    : 0;
  const whatsappY = addressY + addressHeight + 2;
  const emailY = whatsappY + 16;
  const websiteY = emailY + 16;
  doc
    .text(addressText, rightColumnX, addressY, addressOptions)
    .text(`${pdfT(lang, "header.whatsapp", "WhatsApp")}: ${profile.whatsapp || ""}`, rightColumnX, whatsappY, addressOptions)
    .text(`${pdfT(lang, "header.email", "Email")}: ${profile.email || ""}`, rightColumnX, emailY, addressOptions)
    .text(profile.website || "", rightColumnX, websiteY, addressOptions);

  const websiteHeight = profile.website
    ? doc.heightOfString(profile.website, addressOptions)
    : 0;
  const rightColumnBottomY = Math.max(websiteY + websiteHeight, emailY + 12, addressY + addressHeight);
  const nextY = Math.max(logoBottomY, rightColumnBottomY) + 10;
  doc
    .save()
    .moveTo(pageMargin, nextY)
    .lineTo(doc.page.width - pageMargin, nextY)
    .lineWidth(1)
    .strokeColor(colors.line || DEFAULT_COLORS.line)
    .stroke()
    .restore();
  return nextY + 18;
}
