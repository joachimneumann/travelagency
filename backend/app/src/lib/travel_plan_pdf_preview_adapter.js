import { resolveLocalizedText } from "../domain/booking_content_i18n.js";
import { normalizeText } from "./text.js";

export const TOUR_DETAILS_TRAVEL_PLAN_PDF_OPTIONS = Object.freeze({
  includeMarketingTourBackground: true,
  includeGuideSection: false,
  includeEndingSection: false
});

function normalizedTextList(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeText(value))
    .filter(Boolean);
}

function uniqueNormalizedTextList(values) {
  const seen = new Set();
  return normalizedTextList(values).filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildTourDetailsTravelPlanPdfBooking(tour, lang) {
  const tourId = normalizeText(tour?.id) || "tour";
  const tourTitle = normalizeText(
    resolveLocalizedText(tour?.title, lang)
      || resolveLocalizedText(tour?.title, "en")
      || tour?.title
      || tourId
  );
  return {
    id: tourId,
    name: tourTitle || tourId || "Travel plan overview",
    destinations: Array.isArray(tour?.destinations) ? tour.destinations : [],
    travel_styles: Array.isArray(tour?.styles)
      ? tour.styles
      : (Array.isArray(tour?.travel_styles) ? tour.travel_styles : []),
    customer_language: lang,
    web_form_submission: {
      tour_id: tourId
    },
    pdf_personalization: {
      travel_plan: {
        include_subtitle: true,
        include_welcome: true,
        include_closing: false,
        include_children_policy: false,
        include_whats_not_included: false,
        include_who_is_traveling: false
      }
    }
  };
}

export function buildBookingTravelPlanPreviewTour(booking, travelPlanSnapshot) {
  return {
    id: normalizeText(booking?.id) || "booking",
    title: normalizeText(booking?.name)
      || normalizeText(booking?.web_form_submission?.booking_name)
      || "Travel plan",
    short_description: "",
    destinations: uniqueNormalizedTextList([
      ...normalizedTextList(booking?.travel_plan?.destinations),
      ...normalizedTextList(booking?.web_form_submission?.destinations)
    ]),
    styles: uniqueNormalizedTextList([
      ...normalizedTextList(booking?.travel_styles),
      ...normalizedTextList(booking?.web_form_submission?.travel_style)
    ]),
    travel_plan: travelPlanSnapshot
  };
}

export async function writeTourDetailsOnePagerPdf({
  writeMarketingTourOnePagerPdf,
  tour,
  lang,
  outputPath
}) {
  if (typeof writeMarketingTourOnePagerPdf !== "function") {
    throw new Error("Tour one-pager PDF rendering is not configured");
  }
  return writeMarketingTourOnePagerPdf(tour, { lang, outputPath });
}

export async function writeTourDetailsTravelPlanPdf({
  writeTravelPlanPdf,
  tour,
  travelPlan = null,
  lang,
  outputPath
}) {
  if (typeof writeTravelPlanPdf !== "function") {
    throw new Error("Tour travel-plan PDF rendering is not configured");
  }
  return writeTravelPlanPdf(
    buildTourDetailsTravelPlanPdfBooking(tour, lang),
    travelPlan && typeof travelPlan === "object" ? travelPlan : tour?.travel_plan,
    {
      lang,
      outputPath,
      ...TOUR_DETAILS_TRAVEL_PLAN_PDF_OPTIONS
    }
  );
}
