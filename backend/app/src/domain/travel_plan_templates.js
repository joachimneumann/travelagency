import { normalizeText } from "../lib/text.js";
import { enumValueSetFor } from "../lib/generated_catalogs.js";

const COUNTRY_CODE_SET = enumValueSetFor("CountryCode");

function normalizeOptionalText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function firstImageFromService(service) {
  const image = service?.image;
  if (image && typeof image === "object" && !Array.isArray(image)) return image;
  return null;
}

function extractTimeOfDay(value) {
  const normalized = normalizeText(value);
  const match = normalized.match(/(?:T|\s)(\d{2}:\d{2})(?::\d{2}(?:\.\d{3})?)?(?:Z)?$/);
  if (match) return match[1];
  if (/^\d{2}:\d{2}$/.test(normalized)) return normalized;
  return "";
}

function deriveTemplateTimeLabel(service) {
  const timingKind = normalizeText(service?.timing_kind).toLowerCase();
  if (timingKind === "point") {
    return extractTimeOfDay(service?.time_point) || normalizeText(service?.time_label);
  }
  if (timingKind === "range") {
    const start = extractTimeOfDay(service?.start_time);
    const end = extractTimeOfDay(service?.end_time);
    if (start && end) return `${start} - ${end}`;
    return start || end || normalizeText(service?.time_label);
  }
  return normalizeText(service?.time_label);
}

export function createTravelPlanTemplateHelpers({
  normalizeBookingTravelPlan,
  normalizeStringArray,
  randomUUID,
  nowIso
}) {
  function normalizeDestinations(values) {
    return Array.from(
      new Set(
        normalizeStringArray(values)
          .map((value) => normalizeText(value).toUpperCase())
          .filter((value) => value && COUNTRY_CODE_SET.has(value))
      )
    );
  }

  function normalizeTemplateTravelPlan(rawTravelPlan) {
    const normalized = normalizeBookingTravelPlan(rawTravelPlan, null, { strictReferences: false });
    return {
      ...normalized,
      attachments: [],
      days: (Array.isArray(normalized?.days) ? normalized.days : []).map((day) => ({
        ...day,
        date: null,
        date_string: normalizeOptionalText(day?.date_string),
        copied_from: null,
        services: (Array.isArray(day?.services) ? day.services : []).map((service) => ({
          ...service,
          copied_from: null
        }))
      }))
    };
  }

  function cloneBookingTravelPlanAsTemplate(rawTravelPlan) {
    const normalized = normalizeBookingTravelPlan(rawTravelPlan, null, { strictReferences: false });
    const createdAt = nowIso();
    return {
      destinations: normalizeDestinations(normalized?.destinations),
      days: (Array.isArray(normalized?.days) ? normalized.days : []).map((day, dayIndex) => ({
        id: `travel_plan_template_day_${randomUUID()}`,
        day_number: dayIndex + 1,
        date: null,
        date_string: normalizeOptionalText(day?.date_string),
        title: normalizeText(day?.title),
        title_i18n: cloneJson(day?.title_i18n),
        overnight_location: normalizeOptionalText(day?.overnight_location),
        overnight_location_i18n: cloneJson(day?.overnight_location_i18n),
        notes: normalizeOptionalText(day?.notes),
        notes_i18n: cloneJson(day?.notes_i18n),
        copied_from: null,
        services: (Array.isArray(day?.services) ? day.services : []).map((service) => {
          const image = firstImageFromService(service);
          const timeLabel = deriveTemplateTimeLabel(service);
          return {
            id: `travel_plan_template_service_${randomUUID()}`,
            timing_kind: normalizeText(service?.timing_kind).toLowerCase() === "not_applicable"
              ? "not_applicable"
              : "label",
            time_label: timeLabel || null,
            time_label_i18n: cloneJson(service?.time_label_i18n),
            time_point: null,
            kind: normalizeText(service?.kind).toLowerCase() || "other",
            title: normalizeText(service?.title),
            title_i18n: cloneJson(service?.title_i18n),
            details: normalizeOptionalText(service?.details),
            details_i18n: cloneJson(service?.details_i18n),
            image_subtitle: normalizeOptionalText(service?.image_subtitle),
            location: normalizeOptionalText(service?.location),
            location_i18n: cloneJson(service?.location_i18n),
            start_time: null,
            end_time: null,
            image: image
              ? {
                  ...cloneJson(image),
                  id: `travel_plan_template_image_${randomUUID()}`,
                  sort_order: 0,
                  is_primary: true,
                  created_at: normalizeOptionalText(image?.created_at) || createdAt
                }
              : null,
            copied_from: null
          };
        })
      })),
      attachments: []
    };
  }

  function cloneTemplateTravelPlanForBooking(rawTravelPlan) {
    const normalized = normalizeTemplateTravelPlan(rawTravelPlan);
    const createdAt = nowIso();
    return {
      destinations: normalizeDestinations(normalized?.destinations),
      days: (Array.isArray(normalized?.days) ? normalized.days : []).map((day, dayIndex) => ({
        ...cloneJson(day),
        id: `travel_plan_day_${randomUUID()}`,
        day_number: dayIndex + 1,
        date: null,
        copied_from: null,
        services: (Array.isArray(day?.services) ? day.services : []).map((service) => {
          const image = firstImageFromService(service);
          return {
            ...cloneJson(service),
            id: `travel_plan_service_${randomUUID()}`,
            copied_from: null,
            image: image
              ? {
                  ...cloneJson(image),
                  id: `travel_plan_service_image_${randomUUID()}`,
                  sort_order: 0,
                  is_primary: true,
                  created_at: normalizeOptionalText(image?.created_at) || createdAt
                }
              : null
          };
        })
      })),
      attachments: []
    };
  }

  function normalizeTravelPlanTemplateForStorage(template) {
    const source = template && typeof template === "object" && !Array.isArray(template)
      ? template
      : {};
    const normalizedTravelPlan = normalizeTemplateTravelPlan(source.travel_plan);
    const normalizedDestinations = normalizeDestinations(
      Array.isArray(normalizedTravelPlan?.destinations) && normalizedTravelPlan.destinations.length
        ? normalizedTravelPlan.destinations
        : source.destinations
    );
    return {
      id: normalizeText(source.id),
      title: normalizeText(source.title),
      destinations: normalizedDestinations,
      travel_plan: {
        ...normalizedTravelPlan,
        destinations: normalizedDestinations
      }
    };
  }

  function buildTravelPlanTemplateReadModel(template) {
    const stored = normalizeTravelPlanTemplateForStorage(template);
    return stored;
  }

  return {
    normalizeTravelPlanTemplateForStorage,
    buildTravelPlanTemplateReadModel,
    cloneBookingTravelPlanAsTemplate,
    cloneTemplateTravelPlanForBooking,
    normalizeTemplateTravelPlan
  };
}
