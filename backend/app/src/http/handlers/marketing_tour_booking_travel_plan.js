import { existsSync } from "node:fs";
import {
  normalizeBookingContentLang
} from "../../domain/booking_content_i18n.js";
import { normalizeDestinationScope } from "../../domain/destination_scope.js";
import {
  DESTINATION_COUNTRY_CODES,
  TOUR_DESTINATION_TO_COUNTRY_CODE
} from "../../../../../shared/js/destination_country_codes.js";
import {
  normalizeItemImageRef,
  publicBookingImagePath
} from "./booking_travel_plan_shared.js";

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function cloneLocalizedMap(value, normalizeText) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([lang, text]) => [normalizeBookingContentLang(lang), normalizeText(text)])
      .filter(([lang, text]) => lang && lang !== "en" && text)
  );
}

function firstTextFromMap(value, normalizeText) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  for (const text of Object.values(source)) {
    const normalized = normalizeText(text);
    if (normalized) return normalized;
  }
  return "";
}

function cloneLocalizedTextField(source, plainField, mapField, normalizeText) {
  const rawMap = source?.[mapField] && typeof source[mapField] === "object" && !Array.isArray(source[mapField])
    ? source[mapField]
    : {};
  const map = cloneLocalizedMap(rawMap, normalizeText);
  return {
    text: normalizeText(source?.[plainField])
      || normalizeText(rawMap.en)
      || firstTextFromMap(map, normalizeText),
    map
  };
}

function tourImageRelativePathFromStoragePath(storagePath, tourId, normalizeText) {
  const normalizedTourId = normalizeText(tourId);
  const normalized = normalizeText(storagePath).split("?")[0];
  if (!normalizedTourId || !normalized) return "";
  const publicPrefix = "/public/v1/tour-images/";
  if (normalized.startsWith(publicPrefix)) {
    return normalized.slice(publicPrefix.length).replace(/^\/+/, "");
  }
  const bare = normalized.replace(/^\/+/, "");
  if (bare.startsWith(`${normalizedTourId}/`)) return bare;
  return "";
}

function resolveTourServiceImageDiskPath(storagePath, tourId, { normalizeText, path, toursDir }) {
  const relativePath = tourImageRelativePathFromStoragePath(storagePath, tourId, normalizeText);
  if (!relativePath) return "";
  const absolutePath = path.resolve(toursDir, relativePath);
  const toursRoot = path.resolve(toursDir);
  if (!absolutePath.startsWith(`${toursRoot}${path.sep}`)) return "";
  return absolutePath;
}

export function createMarketingTourBookingTravelPlanCloner(deps) {
  const {
    normalizeText,
    normalizeMarketingTourTravelPlan,
    tourDestinationCodes,
    randomUUID,
    nowIso,
    processTourServiceImageToWebp,
    bookingImagesDir,
    toursDir,
    path,
    logPrefix = "marketing-tour-booking-plan"
  } = deps;

  function bookingDestinationCodesFromTour(tour) {
    return Array.from(
      new Set(
        tourDestinationCodes(tour)
          .map((code) => TOUR_DESTINATION_TO_COUNTRY_CODE[code] || normalizeText(code).toUpperCase())
          .filter((code) => DESTINATION_COUNTRY_CODES.includes(code))
      )
    );
  }

  async function copyTourServiceImageToBooking(image, {
    tourId,
    bookingId,
    serviceId,
    createdAt
  }) {
    const sourceImage = image && typeof image === "object" && !Array.isArray(image) ? image : null;
    const sourcePath = resolveTourServiceImageDiskPath(sourceImage?.storage_path, tourId, {
      normalizeText,
      path,
      toursDir
    });
    if (!sourceImage || !sourcePath || !existsSync(sourcePath)) return null;

    const outputName = `${serviceId}-${Date.now()}-${randomUUID()}.webp`;
    const outputRelativePath = `${bookingId}/travel-plan-services/${outputName}`;
    const outputPath = path.join(bookingImagesDir, outputRelativePath);
    try {
      await processTourServiceImageToWebp(sourcePath, outputPath);
    } catch (error) {
      console.warn(`[${logPrefix}] Could not copy tour service image into booking storage.`, {
        tour_id: tourId,
        booking_id: bookingId,
        service_id: serviceId,
        source_path: sourcePath,
        error: String(error?.message || error)
      });
      return null;
    }

    const caption = cloneLocalizedTextField(sourceImage, "caption", "caption_i18n", normalizeText);
    const altText = cloneLocalizedTextField(sourceImage, "alt_text", "alt_text_i18n", normalizeText);
    return normalizeItemImageRef({
      id: `travel_plan_service_image_${randomUUID()}`,
      storage_path: publicBookingImagePath(normalizeText, outputRelativePath),
      caption: caption.text || null,
      caption_i18n: caption.map,
      alt_text: altText.text || null,
      alt_text_i18n: altText.map,
      sort_order: 0,
      is_primary: true,
      is_customer_visible: true,
      width_px: Number.isInteger(sourceImage.width_px) ? sourceImage.width_px : null,
      height_px: Number.isInteger(sourceImage.height_px) ? sourceImage.height_px : null,
      source_attribution: cloneJson(sourceImage.source_attribution),
      focal_point: cloneJson(sourceImage.focal_point),
      created_at: normalizeText(sourceImage.created_at) || createdAt
    });
  }

  async function cloneMarketingTourServiceForBooking(service, {
    tourId,
    bookingId,
    createdAt
  }) {
    const nextServiceId = `travel_plan_service_${randomUUID()}`;
    const title = cloneLocalizedTextField(service, "title", "title_i18n", normalizeText);
    const details = cloneLocalizedTextField(service, "details", "details_i18n", normalizeText);
    const imageSubtitle = cloneLocalizedTextField(
      service,
      "image_subtitle",
      "image_subtitle_i18n",
      normalizeText
    );
    const nextImage = await copyTourServiceImageToBooking(service?.image, {
      tourId,
      bookingId,
      serviceId: nextServiceId,
      createdAt
    });

    return {
      id: nextServiceId,
      timing_kind: "not_applicable",
      time_label: null,
      time_label_i18n: {},
      time_point: null,
      kind: normalizeText(service?.kind) || "other",
      title: title.text,
      title_i18n: title.map,
      details: details.text || null,
      details_i18n: details.map,
      image_subtitle: imageSubtitle.text || null,
      image_subtitle_i18n: imageSubtitle.map,
      location: null,
      location_i18n: {},
      start_time: null,
      end_time: null,
      image: nextImage
    };
  }

  async function cloneMarketingTourDayForBooking(day, {
    dayIndex,
    tourId,
    bookingId,
    createdAt
  }) {
    const title = cloneLocalizedTextField(day, "title", "title_i18n", normalizeText);
    const overnightLocation = cloneLocalizedTextField(
      day,
      "overnight_location",
      "overnight_location_i18n",
      normalizeText
    );
    const notes = cloneLocalizedTextField(day, "notes", "notes_i18n", normalizeText);
    return {
      id: `travel_plan_day_${randomUUID()}`,
      day_number: dayIndex + 1,
      date: null,
      date_string: null,
      title: title.text,
      title_i18n: title.map,
      overnight_location: overnightLocation.text || null,
      overnight_location_i18n: overnightLocation.map,
      services: await Promise.all((Array.isArray(day?.services) ? day.services : []).map((service) => (
        cloneMarketingTourServiceForBooking(service, {
          tourId,
          bookingId,
          createdAt
        })
      ))),
      notes: notes.text || null,
      notes_i18n: notes.map
    };
  }

  async function cloneMarketingTourTravelPlanForBooking(tour, booking) {
    const normalized = normalizeMarketingTourTravelPlan(tour?.travel_plan, {
      sourceLang: "en",
      contentLang: "en",
      flatLang: "en"
    });
    const createdAt = nowIso();
    const bookingId = normalizeText(booking?.id);
    const destinations = bookingDestinationCodesFromTour(tour);
    return {
      destination_scope: normalizeDestinationScope(normalized.destination_scope, destinations),
      destinations,
      days: await Promise.all((Array.isArray(normalized.days) ? normalized.days : []).map((day, dayIndex) => (
        cloneMarketingTourDayForBooking(day, {
          dayIndex,
          tourId: tour?.id,
          bookingId,
          createdAt
        })
      ))),
      attachments: []
    };
  }

  return {
    bookingDestinationCodesFromTour,
    cloneMarketingTourDayForBooking,
    cloneMarketingTourServiceForBooking,
    cloneMarketingTourTravelPlanForBooking
  };
}
