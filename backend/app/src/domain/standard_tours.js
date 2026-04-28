import { normalizeText } from "../lib/text.js";
import { enumValueSetFor } from "../lib/generated_catalogs.js";
import {
  destinationScopeDestinations,
  normalizeDestinationScope
} from "./destination_scope.js";

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

export function createStandardTourHelpers({
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

  function normalizeStandardTourTravelPlan(rawTravelPlan) {
    const normalized = normalizeBookingTravelPlan(rawTravelPlan, null, { strictReferences: false });
    return {
      ...normalized,
      attachments: [],
      days: (Array.isArray(normalized?.days) ? normalized.days : []).map((day) => ({
        ...day,
        date: null,
        date_string: normalizeOptionalText(day?.date_string),
        services: (Array.isArray(day?.services) ? day.services : []).map((service) => ({
          ...service
        }))
      }))
    };
  }

  function cloneStandardTourTravelPlanForBooking(rawTravelPlan) {
    const normalized = normalizeStandardTourTravelPlan(rawTravelPlan);
    const createdAt = nowIso();
    const destinationScope = normalizeDestinationScope(normalized.destination_scope, normalized.destinations);
    return {
      destination_scope: destinationScope,
      destinations: destinationScopeDestinations(destinationScope),
      days: (Array.isArray(normalized?.days) ? normalized.days : []).map((day, dayIndex) => ({
        ...cloneJson(day),
        id: `travel_plan_day_${randomUUID()}`,
        day_number: dayIndex + 1,
        date: null,
        services: (Array.isArray(day?.services) ? day.services : []).map((service) => {
          const image = firstImageFromService(service);
          return {
            ...cloneJson(service),
            id: `travel_plan_service_${randomUUID()}`,
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

  function normalizeStandardTourForStorage(standardTour) {
    const source = standardTour && typeof standardTour === "object" && !Array.isArray(standardTour)
      ? standardTour
      : {};
    const normalizedTravelPlan = normalizeStandardTourTravelPlan(source.travel_plan);
    const fallbackDestinations = Array.isArray(normalizedTravelPlan.destinations) && normalizedTravelPlan.destinations.length
      ? normalizedTravelPlan.destinations
      : source.destinations;
    const destinationScope = normalizeDestinationScope(normalizedTravelPlan.destination_scope, fallbackDestinations);
    const normalizedDestinations = normalizeDestinations(
      destinationScopeDestinations(destinationScope).length
        ? destinationScopeDestinations(destinationScope)
        : source.destinations
    );
    return {
      id: normalizeText(source.id),
      title: normalizeText(source.title),
      destinations: normalizedDestinations,
      travel_plan: {
        ...normalizedTravelPlan,
        destination_scope: normalizeDestinationScope(destinationScope, normalizedDestinations),
        destinations: normalizedDestinations
      }
    };
  }

  function buildStandardTourReadModel(standardTour) {
    const stored = normalizeStandardTourForStorage(standardTour);
    return stored;
  }

  return {
    normalizeStandardTourForStorage,
    buildStandardTourReadModel,
    cloneStandardTourTravelPlanForBooking,
    normalizeStandardTourTravelPlan
  };
}
