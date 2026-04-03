import { normalizeText } from "./text.js";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function textOrNull(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function formatTravelerDisplayName(value) {
  const normalized = textOrNull(value);
  if (!normalized) return null;
  return normalized
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function peopleTraveling(booking) {
  return safeArray(booking?.persons).filter((person) => safeArray(person?.roles).includes("traveler"));
}

export function estimatePdfTravelersSectionHeight(booking) {
  const lineCount = Math.max(peopleTraveling(booking).length, 1);
  const columnCount = lineCount > 1 ? 2 : 1;
  const rows = Math.ceil(lineCount / columnCount);
  return 56 + 16 * rows;
}

export function drawPdfTravelersSection({
  doc,
  booking,
  startY,
  fonts,
  lang,
  colors,
  pageMargin,
  pdfFontName,
  pdfTextAlign,
  pdfT
}) {
  const travelers = peopleTraveling(booking);
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(13)
    .fillColor(colors.textStrong)
    .text(pdfT(lang, "offer.travelers_title", "Who is traveling"), pageMargin, startY, {
      width: doc.page.width - pageMargin * 2,
      align: pdfTextAlign(lang)
    });

  const boxY = startY + 18;
  const boxWidth = doc.page.width - pageMargin * 2;
  const lines = travelers.length
    ? travelers.map((person, index) => {
        return formatTravelerDisplayName(person?.name)
          || pdfT(lang, "offer.traveler_label", "Traveler {index}", { index: index + 1 });
      })
    : [formatTravelerDisplayName(booking?.web_form_submission?.name) || pdfT(lang, "offer.traveler_fallback", "Traveler details will be confirmed with you")];

  const lineHeight = 16;
  const columnCount = lines.length > 1 ? 2 : 1;
  const rows = Math.ceil(lines.length / columnCount);
  const boxHeight = 18 + lineHeight * rows;
  doc
    .save()
    .roundedRect(pageMargin, boxY, boxWidth, boxHeight, 12)
    .fill(colors.surfaceMuted)
    .restore();

  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11)
    .fillColor(colors.textMutedStrong);
  const gutter = 18;
  const innerWidth = boxWidth - 32;
  const columnWidth = columnCount === 2 ? (innerWidth - gutter) / 2 : innerWidth;
  lines.forEach((line, index) => {
    const row = index % rows;
    const column = Math.floor(index / rows);
    const x = pageMargin + 16 + column * (columnWidth + gutter);
    const y = boxY + 10 + row * lineHeight;
    doc.text(`• ${line}`, x, y, {
      width: columnWidth,
      align: pdfTextAlign(lang)
    });
  });

  return boxY + boxHeight + 20;
}
