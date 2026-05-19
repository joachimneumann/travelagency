import { normalizeText } from "../lib/text.js";
import { normalizeStringArray } from "../lib/collection_utils.js";
import {
  normalizeTourLang,
  normalizeTourStyleCode,
  sortTourStyleCodes
} from "./tour_catalog_i18n.js";

const ARRIVAL_MODES = new Set(["none", "first_day", "before_first_day"]);
const DEPARTURE_MODES = new Set(["none", "last_day", "after_last_day"]);

function cloneJson(value, fallback = null) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch {
    return fallback;
  }
}

function normalizeTranslationMap(value, { sourceLang = "en" } = {}) {
  const normalizedSourceLang = normalizeTourLang(sourceLang);
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([lang, text]) => [normalizeTourLang(lang), normalizeText(text)])
      .filter(([lang, text]) => Boolean(lang && text && lang !== normalizedSourceLang))
  );
}

function localizedPairMap(plainValue, i18nValue, { sourceLang = "en" } = {}) {
  const normalizedSourceLang = normalizeTourLang(sourceLang);
  const sourceText = normalizeText(plainValue);
  return {
    ...(sourceText ? { [normalizedSourceLang]: sourceText } : {}),
    ...normalizeTranslationMap(i18nValue, { sourceLang: normalizedSourceLang })
  };
}

function resolveLocalizedPair(holder, plainField, i18nField, lang = "en") {
  if (!holder || typeof holder !== "object" || Array.isArray(holder)) return "";
  const normalizedLang = normalizeTourLang(lang);
  if (normalizedLang === "en") return normalizeText(holder?.[plainField]);
  const translations = normalizeTranslationMap(holder?.[i18nField]);
  return normalizeText(translations[normalizedLang]) || normalizeText(holder?.[plainField]);
}

function splitLocalizedPairInput(value, fallbackPlain = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      text: normalizeText(fallbackPlain),
      i18n: {}
    };
  }
  const source = Object.fromEntries(
    Object.entries(value)
      .map(([lang, text]) => [normalizeTourLang(lang), normalizeText(text)])
      .filter(([lang, text]) => Boolean(lang && text))
  );
  return {
    text: normalizeText(source.en) || normalizeText(fallbackPlain),
    i18n: Object.fromEntries(Object.entries(source).filter(([lang]) => lang !== "en"))
  };
}

function updateLocalizedPairForLang(holder, plainField, i18nField, inputValue, lang = "en") {
  if (!holder || typeof holder !== "object" || Array.isArray(holder)) return;
  const normalizedLang = normalizeTourLang(lang);
  const normalizedText = normalizeText(inputValue);
  if (normalizedLang === "en") {
    holder[plainField] = normalizedText;
    holder[i18nField] = normalizeTranslationMap(holder[i18nField]);
    return;
  }
  const nextMap = normalizeTranslationMap(holder[i18nField]);
  if (normalizedText) nextMap[normalizedLang] = normalizedText;
  else delete nextMap[normalizedLang];
  holder[i18nField] = nextMap;
}

function normalizeStyleCodes(values) {
  return sortTourStyleCodes(
    normalizeStringArray(values)
      .map((value) => normalizeTourStyleCode(value))
      .filter(Boolean)
  );
}

function hasOwn(value, field) {
  return Object.prototype.hasOwnProperty.call(value || {}, field);
}

function normalizeTourVariantImageIds(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => normalizeText(value))
    .filter(Boolean)));
}

function applyTourVariantImageSelection(target, source) {
  if (!target || typeof target !== "object" || Array.isArray(target)) return;
  if (hasOwn(source, "tour_card_image_ids")) {
    target.tour_card_image_ids = normalizeTourVariantImageIds(source.tour_card_image_ids);
    return;
  }
  delete target.tour_card_image_ids;
}

function firstTourCardImagePath(tour) {
  const selectedImageIds = normalizeTourVariantImageIds(tour?.travel_plan?.tour_card_image_ids);
  const entries = [];
  for (const day of Array.isArray(tour?.travel_plan?.days) ? tour.travel_plan.days : []) {
    for (const service of Array.isArray(day?.services) ? day.services : []) {
      const candidates = [
        service?.image,
        ...(Array.isArray(service?.images)
          ? [...service.images].sort((left, right) => Number(left?.sort_order || 0) - Number(right?.sort_order || 0))
          : [])
      ];
      for (const image of candidates) {
        if (!image || typeof image !== "object" || Array.isArray(image)) continue;
        if (image.include_in_travel_tour_card !== true || image.is_customer_visible === false) continue;
        const storagePath = normalizeText(image.storage_path);
        if (storagePath) entries.push({ id: normalizeText(image.id), storagePath });
      }
    }
  }
  if (selectedImageIds.length) {
    entries.sort((left, right) => {
      const leftIndex = selectedImageIds.indexOf(left.id);
      const rightIndex = selectedImageIds.indexOf(right.id);
      const normalizedLeftIndex = leftIndex >= 0 ? leftIndex : Number.MAX_SAFE_INTEGER;
      const normalizedRightIndex = rightIndex >= 0 ? rightIndex : Number.MAX_SAFE_INTEGER;
      return normalizedLeftIndex - normalizedRightIndex;
    });
  }
  return entries[0]?.storagePath || "";
}

function normalizeBoundaryMode(value, boundaryKind) {
  const normalized = normalizeText(value).toLowerCase();
  const modes = boundaryKind === "departure" ? DEPARTURE_MODES : ARRIVAL_MODES;
  if (modes.has(normalized)) return normalized;
  const attachTo = normalizeText(value?.attach_to).toLowerCase();
  if (modes.has(attachTo)) return attachTo;
  return "none";
}

function boundaryPresentationForMode(mode, boundaryKind) {
  if (boundaryKind === "departure") {
    return {
      attach_to: mode === "after_last_day" ? "after_last_day" : "last_day",
      position: "end"
    };
  }
  return {
    attach_to: mode === "before_first_day" ? "before_first_day" : "first_day",
    position: "start"
  };
}

function modeFromBoundaryService(service, boundaryKind) {
  if (!service || typeof service !== "object" || Array.isArray(service)) return "none";
  if (service.mode !== undefined) return normalizeBoundaryMode(service.mode, boundaryKind);
  if (service.enabled === false) return "none";
  return normalizeBoundaryMode(service.presentation, boundaryKind);
}

function normalizeBoundaryService(rawService, boundaryKind) {
  const source = rawService && typeof rawService === "object" && !Array.isArray(rawService)
    ? rawService
    : {};
  const mode = normalizeBoundaryMode(source.mode ?? source.presentation, boundaryKind);
  const titlePair = splitLocalizedPairInput(source.title_i18n, source.title);
  const detailsPair = splitLocalizedPairInput(source.details_i18n, source.details);
  const id = normalizeText(source.id) || `tour_variant_boundary_${boundaryKind}`;
  return {
    id,
    mode,
    time: null,
    time_i18n: {},
    kind: "transport",
    boundary_kind: boundaryKind,
    enabled: mode !== "none" && source.enabled !== false,
    title: titlePair.text,
    title_i18n: titlePair.i18n,
    details: detailsPair.text || null,
    details_i18n: detailsPair.i18n,
    airport_code: normalizeText(source.airport_code) || null,
    from_label: null,
    to_label: null,
    presentation: boundaryPresentationForMode(mode, boundaryKind)
  };
}

function normalizeBoundaryLogistics(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    arrival: normalizeBoundaryService(source.arrival, "arrival"),
    departure: normalizeBoundaryService(source.departure, "departure")
  };
}

function emptyBoundaryLogistics() {
  return normalizeBoundaryLogistics({
    arrival: { mode: "none" },
    departure: { mode: "none" }
  });
}

function normalizeDayRefs(days) {
  return (Array.isArray(days) ? days : [])
    .map((day, index) => {
      const sourceTourId = normalizeText(day?.source_tour_id);
      const sourceDayId = normalizeText(day?.source_day_id);
      if (!sourceTourId || !sourceDayId) return null;
      return {
        id: normalizeText(day?.id) || `tour_variant_day_${index + 1}`,
        day_number: index + 1,
        source_tour_id: sourceTourId,
        source_day_id: sourceDayId
      };
    })
    .filter(Boolean);
}

function sourceTourMap(tours) {
  return new Map(
    (Array.isArray(tours) ? tours : [])
      .map((tour) => [normalizeText(tour?.id), tour])
      .filter(([tourId]) => tourId)
  );
}

function tourDayMap(tour, normalizeMarketingTourTravelPlan, options = {}) {
  const travelPlan = normalizeMarketingTourTravelPlan(tour?.travel_plan, options);
  return new Map(
    (Array.isArray(travelPlan?.days) ? travelPlan.days : [])
      .map((day) => [normalizeText(day?.id), day])
      .filter(([dayId]) => dayId)
  );
}

function boundaryForRead(service, lang) {
  const normalized = normalizeBoundaryService(service, normalizeText(service?.boundary_kind) || "arrival");
  const boundaryKind = normalized.boundary_kind;
  return {
    ...normalized,
    mode: modeFromBoundaryService(normalized, boundaryKind),
    title: resolveLocalizedPair(normalized, "title", "title_i18n", lang),
    title_i18n: localizedPairMap(normalized.title, normalized.title_i18n),
    details: resolveLocalizedPair(normalized, "details", "details_i18n", lang) || null,
    details_i18n: localizedPairMap(normalized.details, normalized.details_i18n)
  };
}

export function createTourVariantHelpers({
  safeInt,
  randomUUID,
  normalizeMarketingTourTravelPlan,
  normalizeTourForRead,
  normalizeTourForStorage,
  canPublishTourOnWebpage
}) {
  function normalizeTourVariantForStorage(variant) {
    const source = variant && typeof variant === "object" && !Array.isArray(variant) ? variant : {};
    const next = {
      ...source,
      id: normalizeText(source.id),
      title: normalizeText(source.title),
      title_i18n: normalizeTranslationMap(source.title_i18n),
      short_description: normalizeText(source.short_description),
      short_description_i18n: normalizeTranslationMap(source.short_description_i18n),
      styles: normalizeStyleCodes(source.styles),
      seasonality_start_month: normalizeText(source.seasonality_start_month),
      seasonality_end_month: normalizeText(source.seasonality_end_month),
      priority: safeInt(source.priority) ?? 50,
      published_on_webpage: source.published_on_webpage === true,
      base_marketing_tour_id: normalizeText(source.base_marketing_tour_id),
      boundary_logistics: normalizeBoundaryLogistics(source.boundary_logistics),
      days: normalizeDayRefs(source.days)
    };
    applyTourVariantImageSelection(next, source);
    if (!Object.keys(next.title_i18n).length) delete next.title_i18n;
    if (!Object.keys(next.short_description_i18n).length) delete next.short_description_i18n;
    return next;
  }

  function normalizeTourVariantForRead(variant, { lang = "en" } = {}) {
    const stored = normalizeTourVariantForStorage(variant);
    const normalizedLang = normalizeTourLang(lang);
    return {
      ...stored,
      record_type: "tour_variant",
      title: resolveLocalizedPair(stored, "title", "title_i18n", normalizedLang),
      title_i18n: localizedPairMap(stored.title, stored.title_i18n),
      short_description: resolveLocalizedPair(stored, "short_description", "short_description_i18n", normalizedLang),
      short_description_i18n: localizedPairMap(stored.short_description, stored.short_description_i18n),
      boundary_logistics: {
        arrival: boundaryForRead(stored.boundary_logistics?.arrival, normalizedLang),
        departure: boundaryForRead(stored.boundary_logistics?.departure, normalizedLang)
      }
    };
  }

  function buildTourVariantPayload(payload, { existing = null, isCreate = false, lang = "en" } = {}) {
    const current = existing ? normalizeTourVariantForStorage(existing) : {
      published_on_webpage: false,
      boundary_logistics: emptyBoundaryLogistics(),
      days: []
    };
    const next = { ...current };

    if (payload.id !== undefined) next.id = normalizeText(payload.id) || next.id;
    if (payload.title_i18n !== undefined) {
      const pair = splitLocalizedPairInput(payload.title_i18n, current.title);
      next.title = pair.text;
      next.title_i18n = pair.i18n;
    } else if (payload.title !== undefined) {
      updateLocalizedPairForLang(next, "title", "title_i18n", payload.title, lang);
    }
    if (payload.short_description_i18n !== undefined) {
      const pair = splitLocalizedPairInput(payload.short_description_i18n, current.short_description);
      next.short_description = pair.text;
      next.short_description_i18n = pair.i18n;
    } else if (payload.short_description !== undefined) {
      updateLocalizedPairForLang(next, "short_description", "short_description_i18n", payload.short_description, lang);
    }
    if (payload.styles !== undefined) next.styles = normalizeStyleCodes(payload.styles);
    if (payload.seasonality_start_month !== undefined) next.seasonality_start_month = normalizeText(payload.seasonality_start_month);
    if (payload.seasonality_end_month !== undefined) next.seasonality_end_month = normalizeText(payload.seasonality_end_month);
    if (payload.priority !== undefined) next.priority = safeInt(payload.priority) ?? 50;
    if (payload.tour_card_image_ids !== undefined) applyTourVariantImageSelection(next, payload);
    if (payload.base_marketing_tour_id !== undefined) {
      next.base_marketing_tour_id = normalizeText(payload.base_marketing_tour_id);
    }
    if (payload.boundary_logistics !== undefined) {
      next.boundary_logistics = normalizeBoundaryLogistics(payload.boundary_logistics);
    }
    if (payload.days !== undefined) next.days = normalizeDayRefs(payload.days);
    if (payload.published_on_webpage !== undefined) {
      next.published_on_webpage = payload.published_on_webpage === true;
    }
    return normalizeTourVariantForStorage(next);
  }

  function buildTourVariantFromBaseTour(baseTour) {
    const storedBaseTour = normalizeTourForStorage(baseTour);
    const baseTravelPlan = normalizeMarketingTourTravelPlan(storedBaseTour.travel_plan, {
      sourceLang: "en",
      contentLang: "en",
      flatLang: "en",
      strictReferences: false
    });
    const baseTourCardImageIds = normalizeTourVariantImageIds(baseTravelPlan?.tour_card_image_ids);
    return normalizeTourVariantForStorage({
      id: `tour_variant_${randomUUID()}`,
      title: normalizeText(storedBaseTour.title),
      title_i18n: normalizeTranslationMap(storedBaseTour.title_i18n),
      short_description: normalizeText(storedBaseTour.short_description),
      short_description_i18n: normalizeTranslationMap(storedBaseTour.short_description_i18n),
      styles: normalizeStyleCodes(storedBaseTour.styles),
      seasonality_start_month: normalizeText(storedBaseTour.seasonality_start_month),
      seasonality_end_month: normalizeText(storedBaseTour.seasonality_end_month),
      priority: safeInt(storedBaseTour.priority) ?? 50,
      published_on_webpage: false,
      base_marketing_tour_id: normalizeText(storedBaseTour.id),
      ...(baseTourCardImageIds.length ? { tour_card_image_ids: baseTourCardImageIds } : {}),
      boundary_logistics: emptyBoundaryLogistics(),
      days: (Array.isArray(baseTravelPlan?.days) ? baseTravelPlan.days : []).map((day, index) => ({
        id: `tour_variant_day_${index + 1}`,
        day_number: index + 1,
        source_tour_id: storedBaseTour.id,
        source_day_id: normalizeText(day?.id)
      }))
    });
  }

  function resolveTourVariantDayRef(ref, toursById, options = {}) {
    const sourceTourId = normalizeText(ref?.source_tour_id);
    const sourceDayId = normalizeText(ref?.source_day_id);
    const sourceTour = toursById.get(sourceTourId);
    if (!sourceTour || (options.publicOnly === true && sourceTour.published_on_webpage === false)) return null;
    const daysById = tourDayMap(sourceTour, normalizeMarketingTourTravelPlan, options.travelPlanOptions || {});
    const sourceDay = daysById.get(sourceDayId);
    if (!sourceDay) return null;
    return {
      sourceTour,
      sourceDay
    };
  }

  function resolveTourVariantToTour(variant, tours, options = {}) {
    const stored = normalizeTourVariantForStorage(variant);
    const toursById = sourceTourMap((Array.isArray(tours) ? tours : []).map((tour) => normalizeTourForStorage(tour)));
    const days = [];
    for (const [index, ref] of stored.days.entries()) {
      const resolved = resolveTourVariantDayRef(ref, toursById, options);
      if (!resolved) continue;
      const day = cloneJson(resolved.sourceDay, {});
      days.push({
        ...day,
        id: normalizeText(ref.id) || `tour_variant_day_${index + 1}`,
        day_number: days.length + 1,
        source_tour_id: normalizeText(ref.source_tour_id),
        source_day_id: normalizeText(ref.source_day_id)
      });
    }
    const travelPlanSource = {
      boundary_logistics: stored.boundary_logistics,
      days
    };
    if (hasOwn(stored, "tour_card_image_ids")) {
      travelPlanSource.tour_card_image_ids = stored.tour_card_image_ids;
    }
    const normalizedTravelPlan = normalizeMarketingTourTravelPlan(travelPlanSource, options.travelPlanOptions || {});
    normalizedTravelPlan.days = (Array.isArray(normalizedTravelPlan.days) ? normalizedTravelPlan.days : []).map((day, index) => ({
      ...day,
      source_tour_id: normalizeText(days[index]?.source_tour_id),
      source_day_id: normalizeText(days[index]?.source_day_id)
    }));
    const tour = {
      id: stored.id,
      record_type: "tour_variant",
      title: stored.title,
      title_i18n: normalizeTranslationMap(stored.title_i18n),
      short_description: stored.short_description,
      short_description_i18n: normalizeTranslationMap(stored.short_description_i18n),
      styles: normalizeStyleCodes(stored.styles),
      seasonality_start_month: stored.seasonality_start_month,
      seasonality_end_month: stored.seasonality_end_month,
      priority: safeInt(stored.priority) ?? 50,
      published_on_webpage: stored.published_on_webpage === true,
      base_marketing_tour_id: stored.base_marketing_tour_id,
      created_at: normalizeText(stored.created_at),
      updated_at: normalizeText(stored.updated_at || stored.created_at),
      travel_plan: normalizedTravelPlan
    };
    return tour;
  }

  function resolvePublishedTourLikeById(tourId, tours, variants, options = {}) {
    const normalizedTourId = normalizeText(tourId);
    const storedTours = (Array.isArray(tours) ? tours : []).map((tour) => normalizeTourForStorage(tour));
    const directTour = storedTours.find((tour) => normalizeText(tour?.id) === normalizedTourId);
    if (directTour && directTour.published_on_webpage !== false) return directTour;
    const variant = (Array.isArray(variants) ? variants : [])
      .map((item) => normalizeTourVariantForStorage(item))
      .find((item) => item.id === normalizedTourId);
    if (!variant || variant.published_on_webpage !== true) return null;
    const validation = validateTourVariantPublication(variant, storedTours);
    if (!validation.ok) return null;
    return resolveTourVariantToTour(variant, storedTours, {
      ...options,
      publicOnly: true
    });
  }

  function resolveSelectedVariantDay(variant, sourceDayId, tours, options = {}) {
    const stored = normalizeTourVariantForStorage(variant);
    const ref = stored.days.find((day) => normalizeText(day?.id) === normalizeText(sourceDayId));
    if (!ref) return null;
    const toursById = sourceTourMap((Array.isArray(tours) ? tours : []).map((tour) => normalizeTourForStorage(tour)));
    return resolveTourVariantDayRef(ref, toursById, options);
  }

  function resolveSelectedDay(sourceTourId, sourceDayId, tours, variants, options = {}) {
    const normalizedSourceTourId = normalizeText(sourceTourId);
    const normalizedSourceDayId = normalizeText(sourceDayId);
    const storedTours = (Array.isArray(tours) ? tours : []).map((tour) => normalizeTourForStorage(tour));
    const sourceTour = storedTours.find((tour) => normalizeText(tour?.id) === normalizedSourceTourId);
    if (sourceTour) {
      if (options.publicOnly === true && sourceTour.published_on_webpage === false) return null;
      const daysById = tourDayMap(sourceTour, normalizeMarketingTourTravelPlan, options.travelPlanOptions || {});
      const sourceDay = daysById.get(normalizedSourceDayId);
      return sourceDay ? { sourceTour, sourceDay } : null;
    }
    const sourceVariant = (Array.isArray(variants) ? variants : [])
      .map((item) => normalizeTourVariantForStorage(item))
      .find((item) => item.id === normalizedSourceTourId);
    if (!sourceVariant || (options.publicOnly === true && sourceVariant.published_on_webpage !== true)) return null;
    const validation = validateTourVariantPublication(sourceVariant, storedTours);
    if (!validation.ok) return null;
    return resolveSelectedVariantDay(sourceVariant, normalizedSourceDayId, storedTours, {
      ...options,
      publicOnly: true
    });
  }

  function validateTourVariantPublication(variant, tours) {
    const stored = normalizeTourVariantForStorage(variant);
    const issues = [];
    if (!stored.id) issues.push("Tour Variant id is required.");
    if (!stored.title) issues.push("Title is required.");
    if (!stored.styles.length) issues.push("At least one style is required.");
    if (!stored.days.length) issues.push("At least one day is required.");
    const storedTours = (Array.isArray(tours) ? tours : []).map((tour) => normalizeTourForStorage(tour));
    const toursById = sourceTourMap(storedTours);
    const baseTour = toursById.get(stored.base_marketing_tour_id);
    if (!stored.base_marketing_tour_id) {
      issues.push("Base marketing tour is required.");
    } else if (!baseTour) {
      issues.push("Base marketing tour was not found.");
    } else if (baseTour.published_on_webpage === false) {
      issues.push("Base marketing tour must be published.");
    }
    const missingRefs = [];
    const unpublishedRefs = [];
    for (const ref of stored.days) {
      const sourceTour = toursById.get(ref.source_tour_id);
      if (!sourceTour) {
        missingRefs.push(`${ref.source_tour_id}:${ref.source_day_id}`);
        continue;
      }
      if (sourceTour.published_on_webpage === false) {
        unpublishedRefs.push(sourceTour.id);
        continue;
      }
      const daysById = tourDayMap(sourceTour, normalizeMarketingTourTravelPlan, {
        sourceLang: "en",
        contentLang: "en",
        flatLang: "en",
        strictReferences: false
      });
      if (!daysById.has(ref.source_day_id)) {
        missingRefs.push(`${ref.source_tour_id}:${ref.source_day_id}`);
      }
    }
    if (missingRefs.length) issues.push(`Referenced days are missing: ${Array.from(new Set(missingRefs)).join(", ")}.`);
    if (unpublishedRefs.length) issues.push(`Referenced tours are not published: ${Array.from(new Set(unpublishedRefs)).join(", ")}.`);
    const resolvedTour = resolveTourVariantToTour(stored, storedTours, { publicOnly: true });
    if (typeof canPublishTourOnWebpage === "function" && !canPublishTourOnWebpage(resolvedTour)) {
      issues.push("The selected days do not have enough public tour-card content.");
    }
    return {
      ok: issues.length === 0,
      issues
    };
  }

  function buildTourVariantEditorResponse(variant, tours, { lang = "en" } = {}) {
    const storedTours = (Array.isArray(tours) ? tours : []).map((tour) => normalizeTourForStorage(tour));
    const toursById = sourceTourMap(storedTours);
    const readModel = normalizeTourVariantForRead(variant, { lang });
    const resolvedTour = resolveTourVariantToTour(variant, storedTours, {
      travelPlanOptions: {
        sourceLang: "en",
        contentLang: lang,
        flatLang: lang,
        flatMode: "localized",
        strictReferences: false
      }
    });
    const resolvedTourCardImageIds = normalizeTourVariantImageIds(resolvedTour?.travel_plan?.tour_card_image_ids);
    const dayStatuses = readModel.days.map((ref) => {
      const sourceTour = toursById.get(ref.source_tour_id);
      const daysById = sourceTour
        ? tourDayMap(sourceTour, normalizeMarketingTourTravelPlan, {
            sourceLang: "en",
            contentLang: lang,
            flatLang: lang,
            flatMode: "localized",
            strictReferences: false
          })
        : new Map();
      const sourceDay = daysById.get(ref.source_day_id);
      const tourReadModel = sourceTour ? normalizeTourForRead(sourceTour, { lang }) : null;
      return {
        ...ref,
        source_tour_title: normalizeText(tourReadModel?.title),
        source_tour_published_on_webpage: sourceTour ? sourceTour.published_on_webpage !== false : false,
        source_day_title: normalizeText(sourceDay?.title),
        source_day_exists: Boolean(sourceDay)
      };
    });
    const publication = validateTourVariantPublication(variant, storedTours);
    return {
      ...readModel,
      tour_card_image_ids: resolvedTourCardImageIds,
      thumbnail_url: firstTourCardImagePath(resolvedTour),
      days: dayStatuses,
      publication
    };
  }

  function isMarketingTourSource(tour) {
    const recordType = normalizeText(tour?.record_type).toLowerCase();
    if (recordType === "tour_variant") return false;
    return !normalizeText(tour?.base_marketing_tour_id);
  }

  function buildSourceDayOptions(tours, { lang = "en", query = "", limit = 500, offset = 0 } = {}) {
    const normalizedQuery = normalizeText(query).toLowerCase();
    const rows = [];
    const storedTours = (Array.isArray(tours) ? tours : [])
      .map((tour) => normalizeTourForStorage(tour))
      .filter(isMarketingTourSource)
      .filter((tour) => tour.published_on_webpage !== false);
    for (const tour of storedTours) {
      const tourReadModel = normalizeTourForRead(tour, { lang });
      const travelPlan = normalizeMarketingTourTravelPlan(tour.travel_plan, {
        sourceLang: "en",
        contentLang: lang,
        flatLang: lang,
        flatMode: "localized",
        strictReferences: false
      });
      for (const day of Array.isArray(travelPlan?.days) ? travelPlan.days : []) {
        const services = Array.isArray(day?.services) ? day.services : [];
        const imagePaths = services.flatMap((service) => {
          const images = [
            service?.image && typeof service.image === "object" && !Array.isArray(service.image) ? service.image : null,
            ...(Array.isArray(service?.images) ? service.images : [])
          ].filter(Boolean);
          return images.map((image) => normalizeText(image?.storage_path)).filter(Boolean);
        });
        const haystack = [
          tourReadModel.title,
          tour.id,
          day?.title,
          day?.notes,
          ...services.flatMap((service) => [service?.title, service?.details, service?.image_subtitle])
        ].map((value) => normalizeText(value).toLowerCase()).filter(Boolean).join(" ");
        if (normalizedQuery && !haystack.includes(normalizedQuery)) continue;
        rows.push({
          source_tour_id: tour.id,
          source_tour_title: tourReadModel.title,
          source_day_id: normalizeText(day?.id),
          day_number: day?.day_number || null,
          title: normalizeText(day?.title),
          notes: normalizeText(day?.notes),
          thumbnail_url: imagePaths[0] || "",
          thumbnail_urls: imagePaths,
          service_count: services.length,
          image_count: imagePaths.length,
          source_day: cloneJson(day, {})
        });
      }
    }
    rows.sort((left, right) => {
      const tourCompare = normalizeText(left.source_tour_title).localeCompare(normalizeText(right.source_tour_title), lang, { sensitivity: "base" });
      if (tourCompare) return tourCompare;
      return Number(left.day_number || 0) - Number(right.day_number || 0);
    });
    return {
      items: rows.slice(offset, offset + limit),
      total: rows.length
    };
  }

  return {
    emptyBoundaryLogistics,
    normalizeTourVariantForStorage,
    normalizeTourVariantForRead,
    buildTourVariantPayload,
    buildTourVariantFromBaseTour,
    resolveTourVariantToTour,
    resolvePublishedTourLikeById,
    resolveSelectedDay,
    validateTourVariantPublication,
    buildTourVariantEditorResponse,
    buildSourceDayOptions
  };
}
