import { createWriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import {
  formatPdfDateOnly,
  pdfTextAlign,
  pdfTextOptions,
  normalizePdfLang,
  pdfT
} from "./pdf_i18n.js";
import {
  appendPdfAttachmentsToFile,
  trimTrailingBlankPagesInFile,
  resolveTravelPlanAttachmentAbsolutePath
} from "./pdf_attachments.js";
import { pdfTheme } from "./style_tokens.js";
import { normalizeText } from "./text.js";
import { resolvePdfFontsForLang } from "./pdf_font_resolver.js";
import { drawMultifontText, measureMultifontTextHeight } from "./pdf_multifont_text.js";
import { drawPdfCompanyHeader } from "./pdf_company_header.js";
import { resolveLocalizedText } from "../domain/booking_content_i18n.js";
import {
  resolveAtpGuideIntroName,
  resolveAtpGuidePdfContext,
  resolveAtpGuideShortDescriptionText,
  resolveAtpStaffFriendlyShortName,
  resolveAtpStaffFullName
} from "./atp_staff_pdf.js";
import {
  resolveBookingPdfPersonalizationFlag,
  resolveBookingPdfCountryLabels,
  resolveBookingPdfPersonalizationText,
  resolveBookingPdfTravelStyleLabels
} from "./booking_pdf_personalization.js";
import {
  buildTravelPlanItemThumbnailMap,
  drawTravelPlanDaysSection
} from "./pdf_travel_plan_section.js";
import {
  drawPdfTravelersSection,
  estimatePdfTravelersSectionHeight
} from "./pdf_travelers_section.js";

const MM_TO_POINTS = 72 / 25.4;
// PDFKit's built-in "A4" preset rounds the page box and some viewers display it as
// 21.01 x 29.71 cm. Use the exact A4 dimensions in points instead.
const PAGE_SIZE = Object.freeze([210 * MM_TO_POINTS, 297 * MM_TO_POINTS]);
const PAGE_MARGIN = 44;
const PAGE_FOOTER_GAP = 28;
const HERO_IMAGE_WIDTH = 195;
const HERO_IMAGE_HEIGHT = 128;
const GUIDE_PHOTO_SIZE = 92;
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

function travelPlanSectionTitle(lang) {
  return pdfT(lang, "travel_plan.pdf_subtitle", "Travel plan overview");
}

function resolveTravelPlanSubtitle(booking, plan, lang) {
  if (!resolveBookingPdfPersonalizationFlag(booking?.pdf_personalization, "travel_plan", "include_subtitle", { sourceLang: lang })) {
    return "";
  }
  const override = textOrNull(resolveBookingPdfPersonalizationText(booking?.pdf_personalization, "travel_plan", "subtitle", lang, { sourceLang: lang }));
  if (override) return override;
  const dayCount = Array.isArray(plan?.days) ? plan.days.length : 0;
  const countries = resolveBookingPdfCountryLabels(booking);
  if (dayCount > 0 && countries.length) {
    return `${dayCount} ${dayCount === 1 ? "day" : "days"} in ${countries.join(", ")}`;
  }
  if (countries.length) return countries.join(", ");
  return dayCount > 0 ? `${dayCount} ${dayCount === 1 ? "day" : "days"}` : "";
}

function resolveTravelPlanWelcomeText(booking, lang) {
  if (!resolveBookingPdfPersonalizationFlag(booking?.pdf_personalization, "travel_plan", "include_welcome", { sourceLang: lang })) {
    return "";
  }
  const override = textOrNull(resolveBookingPdfPersonalizationText(booking?.pdf_personalization, "travel_plan", "welcome", lang, { sourceLang: lang }));
  if (override) return override;
  const styles = resolveBookingPdfTravelStyleLabels(booking, lang);
  if (styles.length) {
    return pdfT(
      lang,
      "travel_plan.default_welcome_styles",
      "This is your current {styles} travel plan. Please let us know if you would like to modify anything.",
      { styles: styles.join(", ") }
    );
  }
  return pdfT(
    lang,
    "travel_plan.default_welcome",
    "This is your current travel plan. Please let us know if you would like to modify anything."
  );
}

function resolveTravelPlanClosingText(booking, lang) {
  if (!resolveBookingPdfPersonalizationFlag(booking?.pdf_personalization, "travel_plan", "include_closing", { sourceLang: lang })) {
    return "";
  }
  return (
    textOrNull(resolveBookingPdfPersonalizationText(booking?.pdf_personalization, "travel_plan", "closing", lang, { sourceLang: lang }))
    || pdfT(lang, "travel_plan.closing_body", "We would be happy to hear from you.")
  );
}

function resolveTravelPlanChildrenPolicyText(booking, lang) {
  if (!resolveBookingPdfPersonalizationFlag(booking?.pdf_personalization, "travel_plan", "include_children_policy", { sourceLang: lang })) {
    return "";
  }
  return textOrNull(
    resolveBookingPdfPersonalizationText(booking?.pdf_personalization, "travel_plan", "children_policy", lang, { sourceLang: lang })
  );
}

function resolveTravelPlanWhatsNotIncludedText(booking, lang) {
  if (!resolveBookingPdfPersonalizationFlag(booking?.pdf_personalization, "travel_plan", "include_whats_not_included", { sourceLang: lang })) {
    return "";
  }
  return textOrNull(
    resolveBookingPdfPersonalizationText(booking?.pdf_personalization, "travel_plan", "whats_not_included", lang, { sourceLang: lang })
  );
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

function registerPdfFonts(doc, fonts) {
  if (fonts?.regular) doc.registerFont(PDF_FONT_REGULAR, fonts.regular);
  if (fonts?.bold) doc.registerFont(PDF_FONT_BOLD, fonts.bold);
  if (fonts?.accentRegular) doc.registerFont(PDF_FONT_ACCENT_REGULAR, fonts.accentRegular);
  if (fonts?.accentBold) doc.registerFont(PDF_FONT_ACCENT_BOLD, fonts.accentBold);
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
    const tourImageRelative = extractPublicRelativePath(safeArray(tour?.pictures)[0], "/public/v1/tour-images/");
    if (tourImageRelative) {
      const tourImageAbsolute = resolveTourImageDiskPath(tourImageRelative);
      if (await fileExists(tourImageAbsolute)) return tourImageAbsolute;
    }
  }

  return null;
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
  return pdfT(lang, "document.footer", "Issued by Asia Travel Plan");
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

function resolveGuideSectionTitle(guideContext, lang) {
  const profile = guideContext?.profile || null;
  const guideTitleName = textOrNull(resolveAtpGuideIntroName(profile)) || textOrNull(resolveAtpStaffFullName(profile));
  return guideTitleName
    ? pdfT(lang, "guide.section_title_named", "Our team member {name} will assist you", { name: guideTitleName })
    : pdfT(lang, "guide.section_title_fallback", "Our team member will assist you");
}

function resolveGuideSectionBody(guideContext, lang) {
  const profile = guideContext?.profile || null;
  const qualificationText = textOrNull(resolveAtpGuideShortDescriptionText(guideContext, lang));
  const introName = textOrNull(resolveAtpGuideIntroName(profile));
  const introText = profile
    ? pdfT(lang, "guide.intro_named", "{name} from Asia Travel Plan will keep this route comfortable and well paced for you.", {
        name: introName || pdfT(lang, "guide.fallback_name", "Your ATP guide")
      })
    : pdfT(lang, "guide.intro_generic", "An ATP travel specialist will be assigned to keep this route comfortable, practical, and easy to follow.");
  return qualificationText || introText;
}

function drawTravelPlanHero(doc, heroTitle, heroSubtitle, heroImage, startY, fonts, lang) {
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
    .text(heroTitle, detailsX, startY + 4, pdfTextOptions(lang, { width: detailsWidth }));
  const titleHeight = doc.heightOfString(heroTitle, pdfTextOptions(lang, { width: detailsWidth }));
  const titleBottomY = startY + 4 + titleHeight;
  let bottomY = titleBottomY;
  if (heroSubtitle) {
    doc
      .font(pdfFontName("regular", fonts))
      .fontSize(11.5)
      .fillColor(PDF_COLORS.textMutedStrong)
      .text(heroSubtitle, detailsX, titleBottomY + 6, pdfTextOptions(lang, { width: detailsWidth }));
    bottomY = doc.y;
  }
  return Math.max(startY + HERO_IMAGE_HEIGHT, bottomY) + 18;
}

function drawRunningHeader(doc, booking, fonts, companyProfile, lang) {
  const pageWidth = doc.page.width - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(11)
    .fillColor(PDF_COLORS.textStrong)
    .text(safeBookingTitle(booking, lang), PAGE_MARGIN, y, {
      width: pageWidth / 2,
      align: pdfTextAlign(lang)
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

function buildAttachmentClosingNote(attachmentCount, lang) {
  const count = Number(attachmentCount) || 0;
  if (count <= 0) return "";
  return count === 1
    ? pdfT(lang, "pdf.attachment_note_single", "Please also find the attached additional PDF at the end of this document.")
    : pdfT(lang, "pdf.attachment_note_multiple", "Please also find the attached additional PDFs at the end of this document.");
}

function drawTextParagraph(doc, startY, text, fonts, lang, { fontSize = 11, lineGap = 2 } = {}) {
  if (!text) return startY;
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(fontSize)
    .fillColor(PDF_COLORS.textMutedStrong)
    .text(
      text,
      PAGE_MARGIN,
      startY,
      pdfTextOptions(lang, {
        width: doc.page.width - PAGE_MARGIN * 2,
        lineGap
      })
    );
  return doc.y;
}

function measureTravelPlanEndingHeight(doc, fonts, lang, {
  childrenPolicyText = "",
  whatsNotIncludedText = "",
  closingText = "",
  attachmentCount = 0
} = {}) {
  const width = doc.page.width - PAGE_MARGIN * 2;
  let height = 0;
  const sections = [
    {
      title: pdfT(lang, "travel_plan.children_policy_title", "Children's Policy"),
      body: childrenPolicyText
    },
    {
      title: pdfT(lang, "travel_plan.whats_not_included_title", "What's not included"),
      body: whatsNotIncludedText
    }
  ].filter((section) => section.body);

  for (const section of sections) {
    height += measureTextHeight(doc, section.title, {
      width,
      fontSize: 11.2,
      fonts,
      weight: "bold",
      lineGap: 1
    });
    height += 4;
    height += measureTextHeight(doc, section.body, {
      width,
      fontSize: 11,
      fonts,
      lineGap: 2
    });
    height += 14;
  }

  height += measureTextHeight(doc, closingText, {
    width,
    fontSize: 11,
    fonts,
    lineGap: 2
  });

  const attachmentNote = buildAttachmentClosingNote(attachmentCount, lang);
  if (attachmentNote) {
    height += 14;
    height += measureTextHeight(doc, attachmentNote, {
      width,
      fontSize: 11,
      fonts,
      lineGap: 2
    });
  }

  height += 18;
  height += measureTextHeight(doc, pdfT(lang, "travel_plan.closing_regards", "Warm regards,"), {
    width,
    fontSize: 11,
    fonts
  });
  height += measureTextHeight(doc, pdfT(lang, "travel_plan.closing_team", "Your Asia Travel Plan team."), {
    width,
    fontSize: 12,
    fonts
  });

  return height + 16;
}

function drawTravelPlanTitledParagraph(doc, startY, fonts, lang, title, text) {
  if (!text) return startY;
  doc
    .font(pdfFontName("bold", fonts))
    .fontSize(11.2)
    .fillColor(PDF_COLORS.textStrong)
    .text(title, PAGE_MARGIN, startY, pdfTextOptions(lang, {
      width: doc.page.width - PAGE_MARGIN * 2,
      lineGap: 1
    }));
  return drawTextParagraph(doc, doc.y + 4, text, fonts, lang, { fontSize: 11 });
}

function drawClosing(doc, startY, fonts, lang, {
  childrenPolicyText = "",
  whatsNotIncludedText = "",
  closingText = "",
  attachmentCount = 0
} = {}) {
  let y = startY;

  if (childrenPolicyText) {
    y = drawTravelPlanTitledParagraph(
      doc,
      y,
      fonts,
      lang,
      pdfT(lang, "travel_plan.children_policy_title", "Children's Policy"),
      childrenPolicyText
    ) + 14;
  }

  if (whatsNotIncludedText) {
    y = drawTravelPlanTitledParagraph(
      doc,
      y,
      fonts,
      lang,
      pdfT(lang, "travel_plan.whats_not_included_title", "What's not included"),
      whatsNotIncludedText
    ) + 14;
  }

  y = drawTextParagraph(doc, y, closingText, fonts, lang);

  const attachmentNote = buildAttachmentClosingNote(attachmentCount, lang);
  if (attachmentNote) {
    doc
      .moveDown(0.8)
      .text(attachmentNote, PAGE_MARGIN, doc.y, pdfTextOptions(lang, {
        width: doc.page.width - PAGE_MARGIN * 2,
        lineGap: 2
      }));
    y = doc.y;
  }

  const signY = y + 18;
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(11)
    .fillColor(PDF_COLORS.textMutedStrong)
    .text(pdfT(lang, "travel_plan.closing_regards", "Warm regards,"), PAGE_MARGIN, signY, {
      width: doc.page.width - PAGE_MARGIN * 2,
      align: pdfTextAlign(lang)
    });
  doc
    .font(pdfFontName("regular", fonts))
    .fontSize(12)
    .fillColor(PDF_COLORS.textStrong)
    .text(pdfT(lang, "travel_plan.closing_team", "Your Asia Travel Plan team."), PAGE_MARGIN, signY + 18, {
      width: doc.page.width - PAGE_MARGIN * 2,
      align: pdfTextAlign(lang)
    });
  return doc.y + 10;
}

function estimateGuideSectionHeight(doc, guideContext, fonts, lang, options = {}) {
  const profile = guideContext?.profile || null;
  const includeTitle = options?.includeTitle !== false;
  const guideTitle = resolveGuideSectionTitle(guideContext, lang);
  const photoWidth = profile ? GUIDE_PHOTO_SIZE + 18 : 0;
  const textWidth = doc.page.width - PAGE_MARGIN * 2 - 30 - photoWidth;
  const titleChoices = mixedFontChoices("bold", fonts);
  const bodyChoices = mixedFontChoices("regular", fonts);
  let height = 26;

  if (includeTitle) {
    height += titleChoices.length
      ? measureMultifontTextHeight(doc, guideTitle, {
          width: textWidth,
          fontSize: 13,
          fontChoices: titleChoices
        })
      : measureTextHeight(doc, guideTitle, {
          width: textWidth,
          fontSize: 13,
          fonts,
          weight: "bold"
        });
    height += 6;
  }

  const bodyText = resolveGuideSectionBody(guideContext, lang);
  height += (
    bodyChoices.length
      ? measureMultifontTextHeight(doc, bodyText, {
          width: textWidth,
          fontSize: 10.4,
          lineGap: 2,
          fontChoices: bodyChoices
        })
      : measureTextHeight(doc, bodyText, {
          width: textWidth,
          fontSize: 10.4,
          fonts,
          lineGap: 2
        })
  );

  return Math.max(height + 18, profile ? GUIDE_PHOTO_SIZE + 26 : 120);
}

function drawGuideSection(doc, startY, fonts, lang, guideContext, guidePhoto, options = {}) {
  const profile = guideContext?.profile || null;
  const includeTitle = options?.includeTitle !== false;
  const guideTitle = resolveGuideSectionTitle(guideContext, lang);
  const cardWidth = doc.page.width - PAGE_MARGIN * 2;
  const cardHeight = estimateGuideSectionHeight(doc, guideContext, fonts, lang, { includeTitle });
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
  if (includeTitle) {
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
  }

  const bodyText = resolveGuideSectionBody(guideContext, lang);

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

  return startY + cardHeight + 18;
}

export function createTravelPlanPdfWriter({
  bookingImagesDir = "",
  readTours = null,
  resolveTourImageDiskPath = null,
  resolveAssignedAtpStaffProfile = null,
  resolveAtpStaffPhotoDiskPath = null,
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
    const outputPath = String(options?.outputPath || "").trim();
    if (!outputPath) {
      throw new Error("Travel plan PDF output path is required");
    }
    await mkdir(path.dirname(outputPath), { recursive: true });
    const plan = travelPlan && typeof travelPlan === "object" ? travelPlan : { days: [] };
    const attachmentPaths = resolveTravelPlanAttachmentPaths(plan, travelPlanAttachmentsDir);
    const heroSubtitle = resolveTravelPlanSubtitle(booking, plan, lang);
    const welcomeText = resolveTravelPlanWelcomeText(booking, lang);
    const childrenPolicyText = resolveTravelPlanChildrenPolicyText(booking, lang);
    const whatsNotIncludedText = resolveTravelPlanWhatsNotIncludedText(booking, lang);
    const closingText = resolveTravelPlanClosingText(booking, lang);

    const guideContext = await resolveAtpGuidePdfContext({
      booking,
      resolveAssignedAtpStaffProfile,
      resolveAtpStaffPhotoDiskPath
    });

    const [heroTitle, logoImage, heroPath, itemThumbnailMap, guidePhoto] = await Promise.all([
      resolveBookingHeroTitle(booking, lang, readTours),
      rasterizeImage(logoPath, { width: 1000 }).catch(() => null),
      resolveBookingImageForPdf({ booking, bookingImagesDir, readTours, resolveTourImageDiskPath }),
      buildTravelPlanItemThumbnailMap(plan, bookingImagesDir),
      guideContext?.photoDiskPath
        ? rasterizeImage(guideContext.photoDiskPath, {
            width: 420,
            height: 420
          }).catch(() => null)
        : null
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
        textOrNull(day?.date_string),
        textOrNull(day?.overnight_location),
        textOrNull(day?.notes),
        ...safeArray(day?.services || day?.items).flatMap((item) => [
          textOrNull(item?.time_label),
          textOrNull(item?.time_point),
          textOrNull(item?.start_time),
          textOrNull(item?.end_time),
          textOrNull(item?.title),
          textOrNull(item?.location),
          textOrNull(item?.details)
        ])
      ]),
      textOrNull(resolveAtpStaffFullName(guideContext?.profile)),
      textOrNull(resolveAtpStaffFriendlyShortName(guideContext?.profile)),
      textOrNull(resolveAtpGuideShortDescriptionText(guideContext, lang)),
      textOrNull(companyProfile?.name),
      textOrNull(companyProfile?.website),
      textOrNull(companyProfile?.email),
      textOrNull(companyProfile?.whatsapp)
    ]
      .filter(Boolean)
      .every((value) => /^[\x09\x0A\x0D\x20-\x7E]*$/.test(String(value)));

    const [baseFonts, accentFonts] = asciiOnly
      ? [null, null]
      : await Promise.all([
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
          })
        ]);
    const fonts = baseFonts
      ? {
          ...baseFonts,
          accentRegular: accentFonts?.regular || null,
          accentBold: accentFonts?.bold || accentFonts?.regular || null
        }
      : null;

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: PAGE_SIZE,
        margin: 0,
        autoFirstPage: true,
        compress: false,
        info: {
          Title: `${safeBookingTitle(booking, lang)} ${travelPlanSectionTitle(lang)}`,
          Author: companyProfile?.name || "Asia Travel Plan",
          Subject: travelPlanSectionTitle(lang)
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

      let y = drawPdfCompanyHeader(doc, {
        companyProfile,
        logoImage,
        fonts,
        lang,
        pageMargin: PAGE_MARGIN,
        colors: PDF_COLORS,
        pdfFontName
      });
      y = drawTravelPlanHero(doc, heroTitle, heroSubtitle, heroImage, y, fonts, lang);
      y = ensureSpace(y, estimateGuideSectionHeight(doc, guideContext, fonts, lang) + 10);
      y = drawGuideSection(doc, y, fonts, lang, guideContext, guidePhoto);
      if (welcomeText) {
        y = ensureSpace(y + 6, 72);
        y = drawTextParagraph(doc, y + 6, welcomeText, fonts, lang, { fontSize: 11.2 }) + 12;
      }

      y = drawTravelPlanDaysSection({
        doc,
        startY: y,
        plan,
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
        sectionTitle: travelPlanSectionTitle(lang),
        emptyStateMessage: pdfT(lang, "travel_plan.empty", "No travel plan is available yet."),
        sectionTitleFontSize: 18,
        renderSectionTitle: false
      });

      if (booking?.pdf_personalization?.travel_plan?.include_who_is_traveling === true) {
        y = ensureSpace(y, estimatePdfTravelersSectionHeight(booking));
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

      y = ensureSpace(y + 8, measureTravelPlanEndingHeight(doc, fonts, lang, {
        childrenPolicyText,
        whatsNotIncludedText,
        closingText,
        attachmentCount: attachmentPaths.length
      }));
      drawClosing(doc, y + 10, fonts, lang, {
        childrenPolicyText,
        whatsNotIncludedText,
        closingText,
        attachmentCount: attachmentPaths.length
      });
      drawFooter(doc, fonts, companyProfile, lang);
      doc.end();
    });

    if (attachmentPaths.length) {
      await appendPdfAttachmentsToFile(outputPath, attachmentPaths);
    } else {
      await trimTrailingBlankPagesInFile(outputPath);
    }

    return { outputPath };
  };
}
