import { normalizeText } from "../lib/text.js";
import { enumValueSetFor } from "../lib/generated_catalogs.js";

const TEMPLATE_STATUSES = new Set(["draft", "published", "archived"]);
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
  normalizeTourStyleCode,
  randomUUID,
  nowIso
}) {
  function normalizeTravelPlanTemplateStatus(value) {
    const normalized = normalizeText(value).toLowerCase();
    return TEMPLATE_STATUSES.has(normalized) ? normalized : "draft";
  }

  function normalizeDestinations(values) {
    return Array.from(
      new Set(
        normalizeStringArray(values)
          .map((value) => normalizeText(value).toUpperCase())
          .filter((value) => value && COUNTRY_CODE_SET.has(value))
      )
    );
  }

  function normalizeTravelStyles(values) {
    return normalizeStringArray(values)
      .map((value) => normalizeTourStyleCode(value) || normalizeText(value))
      .filter(Boolean);
  }

  function normalizeTemplateTravelPlan(rawTravelPlan) {
    const normalized = normalizeBookingTravelPlan(rawTravelPlan, null, { strictReferences: false });
    return {
      ...normalized,
      offer_component_links: [],
      attachments: [],
      days: (Array.isArray(normalized?.days) ? normalized.days : []).map((day) => ({
        ...day,
        date: null,
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
      days: (Array.isArray(normalized?.days) ? normalized.days : []).map((day, dayIndex) => ({
        id: `travel_plan_template_day_${randomUUID()}`,
        day_number: dayIndex + 1,
        date: null,
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
            supplier_id: normalizeOptionalText(service?.supplier_id),
            start_time: null,
            end_time: null,
            financial_coverage_needed: service?.financial_coverage_needed !== false,
            financial_coverage_status: normalizeText(service?.financial_coverage_status).toLowerCase() || "not_covered",
            financial_note: normalizeOptionalText(service?.financial_note),
            financial_note_i18n: cloneJson(service?.financial_note_i18n),
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
      offer_component_links: [],
      attachments: []
    };
  }

  function cloneTemplateTravelPlanForBooking(rawTravelPlan) {
    const normalized = normalizeTemplateTravelPlan(rawTravelPlan);
    const createdAt = nowIso();
    return {
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
      offer_component_links: [],
      attachments: []
    };
  }

  function normalizeTravelPlanTemplateForStorage(template) {
    const source = template && typeof template === "object" && !Array.isArray(template)
      ? template
      : {};
    return {
      id: normalizeText(source.id),
      title: normalizeText(source.title),
      description: normalizeOptionalText(source.description),
      status: normalizeTravelPlanTemplateStatus(source.status),
      destinations: normalizeDestinations(source.destinations),
      travel_styles: normalizeTravelStyles(source.travel_styles),
      source_booking_id: normalizeOptionalText(source.source_booking_id),
      created_by_atp_staff_id: normalizeOptionalText(source.created_by_atp_staff_id),
      travel_plan: normalizeTemplateTravelPlan(source.travel_plan),
      created_at: normalizeOptionalText(source.created_at),
      updated_at: normalizeOptionalText(source.updated_at)
    };
  }

  function buildTravelPlanTemplateReadModel(template, options = {}) {
    const stored = normalizeTravelPlanTemplateForStorage(template);
    const days = Array.isArray(stored?.travel_plan?.days) ? stored.travel_plan.days : [];
    const services = days.flatMap((day) => (Array.isArray(day?.services) ? day.services : []));
    const thumbnail = services.find((service) => firstImageFromService(service)) || services[0] || null;
    const thumbnailUrl = normalizeOptionalText(firstImageFromService(thumbnail)?.storage_path);
    return {
      ...stored,
      source_booking_name: normalizeOptionalText(options.sourceBookingName),
      day_count: days.length,
      service_count: services.length,
      thumbnail_url: thumbnailUrl
    };
  }

  return {
    normalizeTravelPlanTemplateStatus,
    normalizeTravelPlanTemplateForStorage,
    buildTravelPlanTemplateReadModel,
    cloneBookingTravelPlanAsTemplate,
    cloneTemplateTravelPlanForBooking,
    normalizeTemplateTravelPlan
  };
}
