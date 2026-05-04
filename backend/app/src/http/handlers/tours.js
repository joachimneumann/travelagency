import {
  validateBookingTourApplyRequest,
  validateTourTranslateFieldsRequest,
  validateTourTravelPlanDayImportRequest,
  validateTourTravelPlanServiceImportRequest,
  validateTourTravelPlanUpdateRequest,
  validateTravelPlanServiceImageDeleteRequest,
  validateTravelPlanServiceImageUploadRequest
} from "../../../Generated/API/generated_APIModels.js";
import { existsSync } from "node:fs";
import { execImageMagick } from "../../lib/imagemagick.js";
import {
  DESTINATION_COUNTRY_CODES,
  DESTINATION_COUNTRY_TO_TOUR_DESTINATION_CODE
} from "../../../../../shared/js/destination_country_codes.js";
import {
  findTravelPlanDayAndItem,
  normalizeItemImageRef
} from "./booking_travel_plan_shared.js";
import { createMarketingTourBookingTravelPlanCloner } from "./marketing_tour_booking_travel_plan.js";
import {
  filterDestinationScopeByTourDestinations,
  validateDestinationScopeAgainstCatalog
} from "../../domain/destination_scope.js";

export function createTourHandlers(deps) {
  const {
    normalizeText,
    normalizeStringArray,
    safeInt,
    tourDestinationCodes,
    tourStyleCodes,
    readStore,
    readTours,
    persistStore,
    sendJson,
    clamp,
    normalizeTourForRead,
    normalizeTourForStorage,
    normalizeTourTravelPlan,
    normalizeMarketingTourTravelPlan,
    validateMarketingTourTravelPlanInput,
    validateBookingTravelPlanInput,
    resolveLocalizedText,
    setLocalizedTextForLang,
    translateEntries,
    translateEntriesWithMeta,
    readTranslationRules,
    translationMemoryStore,
    normalizeTourLang,
    normalizeTourDestinationCode,
    normalizeTourStyleCode,
    getPrincipal,
    canReadTours,
    paginate,
    collectTourOptions,
    buildPaginatedListResponse,
    canEditTours,
    canEditBooking,
    assertExpectedRevision,
    buildBookingDetailResponse,
    incrementBookingRevision,
    addActivity,
    actorLabel,
    readBodyJson,
    readCountryPracticalInfo,
    nowIso,
    randomUUID,
    persistTour,
    repoRoot,
    resolveTourImageDiskPath,
    writeMarketingTourOnePagerPdf,
    sendFileWithCache,
    mkdir,
    path,
    execFile,
    TEMP_UPLOAD_DIR,
    TOURS_DIR,
    BOOKING_IMAGES_DIR,
    writeFile,
    rm
  } = deps;

  const PUBLIC_HOMEPAGE_ASSET_GENERATOR_CANDIDATES = Object.freeze([
    path.join(repoRoot, "scripts", "assets", "generate_public_homepage_assets.mjs"),
    path.join(repoRoot, "scripts", "generate_public_homepage_assets.mjs")
  ]);
  const TOUR_REEL_VIDEO_FILENAME = "video.mp4";
  const IMAGE_UPLOAD_BODY_MAX_BYTES = 16 * 1024 * 1024;
  const VIDEO_UPLOAD_BODY_MAX_BYTES = 150 * 1024 * 1024;
  const TOUR_STALE_UPDATE_MESSAGE = "This tour was updated by someone else. Reload before saving.";
  let publicHomepageAssetGenerationQueue = Promise.resolve();

  function nowMs() {
    return Date.now();
  }

  function durationMs(startMs) {
    return Math.max(0, nowMs() - Number(startMs || 0));
  }

  function summarizeTranslationEntries(entries) {
    const normalizedEntries = Object.entries(entries || {})
      .map(([key, value]) => [normalizeText(key), normalizeText(value)])
      .filter(([key, value]) => Boolean(key && value));
    return {
      entryCount: normalizedEntries.length,
      totalChars: normalizedEntries.reduce((sum, [key, value]) => sum + key.length + value.length, 0)
    };
  }

  function logTourTranslationTiming(event, details = {}) {
    const payload = Object.fromEntries(
      Object.entries(details).filter(([, value]) => value !== undefined)
    );
    console.log(`[backend-tour-translation] ${event}`, payload);
  }

  function translationEntriesToObject(entries) {
    return Object.fromEntries(
      (Array.isArray(entries) ? entries : [])
        .map((entry) => [normalizeText(entry?.key), normalizeText(entry?.value)])
        .filter(([key, value]) => Boolean(key && value))
    );
  }

  function translationEntriesFromObject(entries) {
    return Object.entries(entries || {})
      .map(([key, value]) => ({ key: normalizeText(key), value: normalizeText(value) }))
      .filter((entry) => Boolean(entry.key && entry.value));
  }

  function translationProviderResponseHeaders(provider) {
    const kind = normalizeText(provider?.kind).toLowerCase();
    const model = normalizeText(provider?.model);
    const display = normalizeText(provider?.display || (kind === "openai" ? model : kind));
    return {
      ...(kind ? { "X-ATP-Translation-Provider": kind } : {}),
      ...(model ? { "X-ATP-Translation-Provider-Model": model } : {}),
      ...(display ? { "X-ATP-Translation-Provider-Display": display } : {})
    };
  }

  function requestLang(reqUrl) {
    return normalizeTourLang(new URL(reqUrl, "http://localhost").searchParams.get("lang"));
  }

  function normalizeStyleCodes(values) {
    return tourStyleCodes({ styles: normalizeStringArray(values) });
  }

  function localizedTextareaMap(value, { multiline = false } = {}) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .map(([lang, entry]) => {
          const normalizedLang = normalizeTourLang(lang);
          const normalizedValue = multiline
            ? (Array.isArray(entry) ? entry.map((item) => normalizeText(item)).filter(Boolean).join("\n") : normalizeText(entry))
            : normalizeText(entry);
          return [normalizedLang, normalizedValue];
        })
        .filter(([, entry]) => Boolean(entry))
    );
  }

  function localizedTextMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .map(([lang, text]) => [normalizeTourLang(lang), normalizeText(text)])
        .filter(([lang, text]) => Boolean(lang && text))
    );
  }

  function addTourTranslationDescriptor(descriptors, { holder, mapField, plainField = "", key }) {
    if (!holder || !mapField || !key) return;
    const map = localizedTextMap(holder?.[mapField]);
    const sourceText = normalizeText(map.en || (plainField ? holder?.[plainField] : ""));
    if (!sourceText) return;
    descriptors.push({
      key,
      sourceText,
      targetText(targetLang) {
        return normalizeText(map[normalizeTourLang(targetLang)]);
      }
    });
  }

  function collectTourTranslationDescriptors(tour) {
    const descriptors = [];
    addTourTranslationDescriptor(descriptors, {
      holder: tour,
      mapField: "title",
      key: "website.title"
    });
    addTourTranslationDescriptor(descriptors, {
      holder: tour,
      mapField: "short_description",
      key: "website.short_description"
    });
    const days = Array.isArray(tour?.travel_plan?.days) ? tour.travel_plan.days : [];
    days.forEach((day, dayIndex) => {
      const dayId = normalizeText(day?.id) || `day_${dayIndex + 1}`;
      addTourTranslationDescriptor(descriptors, {
        holder: day,
        mapField: "title_i18n",
        plainField: "title",
        key: `travel_plan.${dayId}.title`
      });
      addTourTranslationDescriptor(descriptors, {
        holder: day,
        mapField: "overnight_location_i18n",
        plainField: "overnight_location",
        key: `travel_plan.${dayId}.overnight_location`
      });
      addTourTranslationDescriptor(descriptors, {
        holder: day,
        mapField: "notes_i18n",
        plainField: "notes",
        key: `travel_plan.${dayId}.notes`
      });
      const services = Array.isArray(day?.services) ? day.services : [];
      services.forEach((service, serviceIndex) => {
        const serviceId = normalizeText(service?.id) || `service_${dayIndex + 1}_${serviceIndex + 1}`;
        if (normalizeText(service?.timing_kind || "label") === "label") {
          addTourTranslationDescriptor(descriptors, {
            holder: service,
            mapField: "time_label_i18n",
            plainField: "time_label",
            key: `travel_plan.${dayId}.${serviceId}.time_label`
          });
        }
        addTourTranslationDescriptor(descriptors, {
          holder: service,
          mapField: "title_i18n",
          plainField: "title",
          key: `travel_plan.${dayId}.${serviceId}.title`
        });
        addTourTranslationDescriptor(descriptors, {
          holder: service,
          mapField: "details_i18n",
          plainField: "details",
          key: `travel_plan.${dayId}.${serviceId}.details`
        });
        addTourTranslationDescriptor(descriptors, {
          holder: service,
          mapField: "location_i18n",
          plainField: "location",
          key: `travel_plan.${dayId}.${serviceId}.location`
        });
        addTourTranslationDescriptor(descriptors, {
          holder: service,
          mapField: "image_subtitle_i18n",
          plainField: "image_subtitle",
          key: `travel_plan.${dayId}.${serviceId}.image_subtitle`
        });
        addTourTranslationDescriptor(descriptors, {
          holder: service?.image,
          mapField: "caption_i18n",
          plainField: "caption",
          key: `travel_plan.${dayId}.${serviceId}.image.caption`
        });
        addTourTranslationDescriptor(descriptors, {
          holder: service?.image,
          mapField: "alt_text_i18n",
          plainField: "alt_text",
          key: `travel_plan.${dayId}.${serviceId}.image.alt_text`
        });
      });
    });
    return descriptors;
  }

  async function syncTourManualTranslationsToMemory(tour) {
    if (!translationMemoryStore || typeof translationMemoryStore.patchManualOverrides !== "function") return;
    const meta = tour?.travel_plan?.translation_meta && typeof tour.travel_plan.translation_meta === "object" && !Array.isArray(tour.travel_plan.translation_meta)
      ? tour.travel_plan.translation_meta
      : {};
    const descriptors = collectTourTranslationDescriptors(tour);
    const descriptorsByKey = new Map(descriptors.map((descriptor) => [descriptor.key, descriptor]));
    for (const [lang, entry] of Object.entries(meta)) {
      const targetLang = normalizeTourLang(lang);
      const manualKeys = Array.isArray(entry?.manual_keys)
        ? entry.manual_keys.map((key) => normalizeText(key)).filter(Boolean)
        : [];
      const updates = manualKeys
        .map((key) => {
          const descriptor = descriptorsByKey.get(key);
          const manualOverride = descriptor?.targetText(targetLang);
          if (!descriptor?.sourceText || !manualOverride) return null;
          return {
            source_text: descriptor.sourceText,
            manual_override: manualOverride
          };
        })
        .filter(Boolean);
      if (updates.length) {
        await translationMemoryStore.patchManualOverrides(targetLang, updates);
      }
    }
  }

  function preferredEnglishImportText(mapValue, plainValue) {
    const source = mapValue && typeof mapValue === "object" && !Array.isArray(mapValue) ? mapValue : {};
    const englishText = normalizeText(source.en);
    if (englishText) return englishText;
    const normalizedPlainText = normalizeText(plainValue);
    if (normalizedPlainText) return normalizedPlainText;
    return "";
  }

  function buildTourEditorResponse(tour, lang) {
    const stored = normalizeTourForStorage(tour);
    return {
      ...normalizeTourForRead(stored, { lang }),
      title_i18n: localizedTextareaMap(stored.title),
      short_description_i18n: localizedTextareaMap(stored.short_description),
      travel_plan: buildTourTravelPlanEditorValue(stored),
      reel_video: buildTourReelVideoMeta(stored)
    };
  }

  function tourOnePagerFilename(tour) {
    const title = normalizeText(resolveLocalizedText(tour?.title, "en") || tour?.id || "tour")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "tour";
    return `${title}-one-pager.pdf`;
  }

  function localizedObjectText(value, lang) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? normalizeText(value[normalizeTourLang(lang)])
      : "";
  }

  function cloneJson(value) {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function fallbackSourceText(value) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? normalizeText(value.en)
      : normalizeText(value);
  }

  function sourceTextFromLocalizedValue(value, fallback = "") {
    const fallbackText = fallbackSourceText(fallback);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return normalizeText(value.en) || fallbackText;
    }
    return normalizeText(value) || fallbackText;
  }

  function collectOnePagerMemoryLocalizedMap(actions, entries, holder, fieldName, lang, key) {
    if (!holder || typeof holder !== "object" || Array.isArray(holder)) return;
    const sourceText = sourceTextFromLocalizedValue(holder[fieldName]);
    if (!sourceText) return;
    entries[key] = sourceText;
    actions.push({ kind: "map", holder, fieldName, key, sourceText });
  }

  function collectOnePagerMemoryLocalizedPair(actions, entries, holder, plainField, i18nField, lang, key) {
    if (!holder || typeof holder !== "object" || Array.isArray(holder)) return;
    const sourceText = sourceTextFromLocalizedValue(holder[i18nField], holder[plainField]);
    if (!sourceText) return;
    entries[key] = sourceText;
    actions.push({ kind: "pair", holder, i18nField, key });
  }

  function collectOnePagerTravelPlanImageMemory(actions, entries, image, lang, keyPrefix) {
    if (!image || typeof image !== "object" || Array.isArray(image)) return;
    collectOnePagerMemoryLocalizedPair(actions, entries, image, "caption", "caption_i18n", lang, `${keyPrefix}.caption`);
    collectOnePagerMemoryLocalizedPair(actions, entries, image, "alt_text", "alt_text_i18n", lang, `${keyPrefix}.alt_text`);
  }

  function collectOnePagerTravelPlanMemory(actions, entries, travelPlan, lang) {
    if (!travelPlan || typeof travelPlan !== "object" || Array.isArray(travelPlan)) return;
    for (const [dayIndex, day] of (Array.isArray(travelPlan.days) ? travelPlan.days : []).entries()) {
      if (!day || typeof day !== "object" || Array.isArray(day)) continue;
      const dayKey = `travel_plan.day.${dayIndex + 1}`;
      collectOnePagerMemoryLocalizedPair(actions, entries, day, "title", "title_i18n", lang, `${dayKey}.title`);
      collectOnePagerMemoryLocalizedPair(actions, entries, day, "overnight_location", "overnight_location_i18n", lang, `${dayKey}.overnight_location`);
      collectOnePagerMemoryLocalizedPair(actions, entries, day, "notes", "notes_i18n", lang, `${dayKey}.notes`);

      for (const [serviceIndex, service] of (Array.isArray(day.services) ? day.services : []).entries()) {
        if (!service || typeof service !== "object" || Array.isArray(service)) continue;
        const serviceKey = `${dayKey}.service.${serviceIndex + 1}`;
        collectOnePagerMemoryLocalizedPair(actions, entries, service, "time_label", "time_label_i18n", lang, `${serviceKey}.time_label`);
        collectOnePagerMemoryLocalizedPair(actions, entries, service, "title", "title_i18n", lang, `${serviceKey}.title`);
        collectOnePagerMemoryLocalizedPair(actions, entries, service, "details", "details_i18n", lang, `${serviceKey}.details`);
        collectOnePagerMemoryLocalizedPair(actions, entries, service, "location", "location_i18n", lang, `${serviceKey}.location`);
        collectOnePagerMemoryLocalizedPair(actions, entries, service, "image_subtitle", "image_subtitle_i18n", lang, `${serviceKey}.image_subtitle`);
        collectOnePagerTravelPlanImageMemory(actions, entries, service.image, lang, `${serviceKey}.image`);
        for (const [imageIndex, image] of (Array.isArray(service.images) ? service.images : []).entries()) {
          collectOnePagerTravelPlanImageMemory(actions, entries, image, lang, `${serviceKey}.image.${imageIndex + 1}`);
        }
      }
    }
  }

  function applyResolvedOnePagerMemoryActions(actions, memoryEntries, lang) {
    const normalizedLang = normalizeTourLang(lang);
    let changed = false;
    for (const action of actions) {
      const targetText = normalizeText(memoryEntries?.[action.key]);
      if (!targetText) continue;
      if (action.kind === "map") {
        const existingValue = action.holder[action.fieldName];
        action.holder[action.fieldName] = {
          ...(existingValue && typeof existingValue === "object" && !Array.isArray(existingValue)
            ? existingValue
            : { en: action.sourceText }),
          [normalizedLang]: targetText
        };
        changed = true;
      } else if (action.kind === "pair") {
        const i18nValue = action.holder[action.i18nField];
        action.holder[action.i18nField] = {
          ...(i18nValue && typeof i18nValue === "object" && !Array.isArray(i18nValue)
            ? i18nValue
            : {}),
          [normalizedLang]: targetText
        };
        changed = true;
      }
    }
    return changed;
  }

  async function applyMarketingTourMemoryToOnePagerTour(tour, lang) {
    const normalizedLang = normalizeTourLang(lang);
    if (normalizedLang === "en" || typeof translationMemoryStore?.resolveEntries !== "function") return tour;
    const next = cloneJson(tour);
    const entries = {};
    const actions = [];
    collectOnePagerMemoryLocalizedMap(actions, entries, next, "title", normalizedLang, "tour.title");
    collectOnePagerMemoryLocalizedMap(actions, entries, next, "short_description", normalizedLang, "tour.short_description");
    collectOnePagerTravelPlanMemory(actions, entries, next.travel_plan, normalizedLang);
    if (!Object.keys(entries).length) return tour;
    try {
      const memoryResult = await translationMemoryStore.resolveEntries(entries, normalizedLang);
      return applyResolvedOnePagerMemoryActions(actions, memoryResult?.entries || {}, normalizedLang)
        ? next
        : tour;
    } catch {
      return tour;
    }
  }

  function assertExpectedTourUpdatedAt(payload, currentTour, res) {
    const expectedUpdatedAt = normalizeText(payload?.expected_updated_at);
    if (!expectedUpdatedAt) return true;
    const currentUpdatedAt = normalizeText(currentTour?.updated_at);
    if (expectedUpdatedAt === currentUpdatedAt) return true;
    sendJson(res, 409, {
      error: TOUR_STALE_UPDATE_MESSAGE,
      code: "TOUR_REVISION_MISMATCH",
      expected_updated_at: expectedUpdatedAt,
      current_updated_at: currentUpdatedAt || null
    });
    return false;
  }

  function buildTourPayload(payload, { existing = null, isCreate = false, lang = "en" } = {}) {
    const current = existing ? normalizeTourForStorage(existing) : {};
    const next = { ...current };

    if (isCreate || payload.id !== undefined) next.id = normalizeText(payload.id) || next.id;
    if (payload.title_i18n !== undefined) {
      next.title = payload.title_i18n;
    } else if (isCreate || payload.title !== undefined) {
      next.title = setLocalizedTextForLang(current.title, payload.title, lang);
    }
    if (payload.short_description_i18n !== undefined) {
      next.short_description = payload.short_description_i18n;
    } else if (payload.short_description !== undefined) {
      next.short_description = setLocalizedTextForLang(current.short_description, payload.short_description, lang);
    }
    if (isCreate || payload.styles !== undefined) next.styles = normalizeStyleCodes(payload.styles);
    if (payload.video !== undefined) next.video = payload.video;
    if (payload.travel_plan !== undefined) {
      next.travel_plan = normalizeMarketingTourTravelPlan(payload.travel_plan);
    }
    if (payload.seasonality_start_month !== undefined) {
      next.seasonality_start_month = normalizeText(payload.seasonality_start_month);
    }
    if (payload.seasonality_end_month !== undefined) {
      next.seasonality_end_month = normalizeText(payload.seasonality_end_month);
    }
    if (payload.priority !== undefined || isCreate) {
      const priority = safeInt(payload.priority);
      next.priority = priority === null ? 50 : priority;
    }
    if (payload.published_on_webpage !== undefined || isCreate) {
      next.published_on_webpage = payload.published_on_webpage !== false;
    }
    if (payload.seo_slug !== undefined) {
      next.seo_slug = normalizeText(payload.seo_slug);
    }

    return normalizeTourForStorage(next);
  }

  function validateTourInput(tour, { isCreate = false, lang = "en" } = {}) {
    if (isCreate && !resolveLocalizedText(tour?.title, lang)) return "title is required";
    if (isCreate && !tourDestinationCodes(tour).length) return "destinations is required";
    if (isCreate && !normalizeStyleCodes(tour?.styles).length) return "styles is required";
    return "";
  }

  async function validateTourDestinationScope(travelPlan, res) {
    const store = await readStore();
    const check = validateDestinationScopeAgainstCatalog(travelPlan?.destination_scope, store);
    if (check.ok) return true;
    sendJson(res, 422, { error: check.error });
    return false;
  }

  function filterAndSortTours(tours, query, lang) {
    const search = normalizeText(query.get("search")).toLowerCase();
    const destination = normalizeTourDestinationCode(query.get("destination"));
    const area = normalizeText(query.get("area"));
    const place = normalizeText(query.get("place"));
    const style = normalizeTourStyleCode(query.get("style"));
    const sort = normalizeText(query.get("sort")) || "updated_at_desc";

    const filtered = tours.filter((tour) => {
      const destinationCodes = tourDestinationCodes(tour);
      const styleCodes = tourStyleCodes(tour);
      const destinationScope = Array.isArray(tour?.travel_plan?.destination_scope) ? tour.travel_plan.destination_scope : [];
      const destinationMatch = !destination || destinationCodes.includes(destination);
      const areaMatch = !area || destinationScope.some((entry) => (
        Array.isArray(entry?.areas)
        && entry.areas.some((areaSelection) => normalizeText(areaSelection?.area_id) === area)
      ));
      const placeMatch = !place || destinationScope.some((entry) => (
        Array.isArray(entry?.areas)
        && entry.areas.some((areaSelection) => (
          Array.isArray(areaSelection?.places)
          && areaSelection.places.some((placeSelection) => normalizeText(placeSelection?.place_id) === place)
        ))
      ));
      const styleMatch = !style || styleCodes.includes(style);
      if (!destinationMatch || !areaMatch || !placeMatch || !styleMatch) return false;
      if (!search) return true;

      const readModel = normalizeTourForRead(tour, { lang });
      const haystack = [
        tour.id,
        readModel.title,
        readModel.short_description,
        ...readModel.destinations,
        ...destinationCodes,
        ...readModel.styles,
        ...styleCodes
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });

    const compareUpdatedAtDesc = (a, b) => String(b.updated_at || b.created_at || "")
      .localeCompare(String(a.updated_at || a.created_at || ""));
    const publishedWebpageRank = (tour) => normalizeTourForStorage(tour).published_on_webpage === false ? 1 : 0;

    const items = [...filtered].sort((a, b) => {
      if (sort === "title_asc") {
        return String(normalizeTourForRead(a, { lang }).title || "").localeCompare(String(normalizeTourForRead(b, { lang }).title || ""));
      }
      if (sort === "published_on_webpage_desc") {
        const publishedCompare = publishedWebpageRank(a) - publishedWebpageRank(b);
        if (publishedCompare !== 0) return publishedCompare;
      }
      return compareUpdatedAtDesc(a, b);
    });

    return {
      items,
      sort,
      filters: {
        destination: destination || null,
        area: area || null,
        place: place || null,
        style: style || null,
        search: search || null
      }
    };
  }

  function buildTourMatrixSummary(tours, lang) {
    const items = Array.isArray(tours) ? tours : [];
    const options = collectTourOptions(items, { lang });
    const destinations = (Array.isArray(options?.destinations) ? options.destinations : [])
      .map((value) => normalizeText(value?.label || value?.code || value))
      .filter(Boolean);
    const styles = (Array.isArray(options?.styles) ? options.styles : [])
      .map((value) => normalizeText(value?.label || value?.code || value))
      .filter(Boolean);
    const counts = {};

    items.forEach((tour) => {
      const readModel = normalizeTourForRead(tour, { lang });
      const tourDestinations = Array.from(
        new Set((Array.isArray(readModel?.destinations) ? readModel.destinations : []).map((value) => normalizeText(value)).filter(Boolean))
      );
      const tourStyles = Array.from(
        new Set((Array.isArray(readModel?.styles) ? readModel.styles : []).map((value) => normalizeText(value)).filter(Boolean))
      );
      tourDestinations.forEach((destination) => {
        tourStyles.forEach((style) => {
          const key = `${destination}::${style}`;
          counts[key] = Math.max(0, Number(counts[key] || 0)) + 1;
        });
      });
    });

    return {
      destinations,
      styles,
      counts,
      total_tours: items.length
    };
  }

  function countBookingsReferencingTour(store, tourId) {
    const normalizedTourId = normalizeText(tourId);
    if (!normalizedTourId) return 0;
    return (Array.isArray(store?.bookings) ? store.bookings : []).filter((booking) => {
      const referencedTourId = normalizeText(booking?.tour_id) || normalizeText(booking?.web_form_submission?.tour_id);
      return referencedTourId === normalizedTourId;
    }).length;
  }

  function resolveTourFolderPath(tourId) {
    const normalizedTourId = normalizeText(tourId);
    if (!normalizedTourId) return "";
    const toursRoot = path.resolve(TOURS_DIR);
    const tourFolder = path.resolve(toursRoot, normalizedTourId);
    if (tourFolder === toursRoot || !tourFolder.startsWith(`${toursRoot}${path.sep}`)) return "";
    return tourFolder;
  }

  function resolveTourVideoDiskPath(tourId) {
    const folderPath = resolveTourFolderPath(tourId);
    if (!folderPath) return "";
    return path.join(folderPath, TOUR_REEL_VIDEO_FILENAME);
  }

  function buildTourVideoEditorPreviewUrl(tour) {
    const tourId = normalizeText(tour?.id);
    if (!tourId) return "";
    const version = normalizeText(tour?.updated_at || tour?.created_at);
    const basePath = `/api/v1/tours/${encodeURIComponent(tourId)}/video`;
    return version ? `${basePath}?v=${encodeURIComponent(version)}` : basePath;
  }

  function buildTourReelVideoMeta(tour) {
    const tourId = normalizeText(tour?.id);
    if (!tourId) return null;
    const videoPath = resolveTourVideoDiskPath(tourId);
    if (!videoPath || !existsSync(videoPath)) return null;
    const storedVideo = tour?.video && typeof tour.video === "object" && !Array.isArray(tour.video)
      ? tour.video
      : {};
    return {
      filename: normalizeText(storedVideo.title) || TOUR_REEL_VIDEO_FILENAME,
      preview_url: buildTourVideoEditorPreviewUrl(tour)
    };
  }

  function buildTourTravelPlanEditorValue(tour) {
    return normalizeTourTravelPlan(tour?.travel_plan);
  }

  function primaryTravelPlanServiceImage(item) {
    if (item?.image && typeof item.image === "object" && !Array.isArray(item.image)) {
      return item.image;
    }
    if (!Array.isArray(item?.images)) return null;
    return item.images.find((image) => image?.is_primary)
      || item.images.find((image) => image?.is_customer_visible !== false)
      || item.images[0]
      || null;
  }

  function travelPlanServiceImages(item) {
    const images = [];
    if (item?.image && typeof item.image === "object" && !Array.isArray(item.image)) {
      images.push(item.image);
    }
    if (Array.isArray(item?.images)) {
      images.push(...item.images);
    }
    const seen = new Set();
    return images
      .filter((image) => image && typeof image === "object")
      .sort((left, right) => Number(left?.sort_order || 0) - Number(right?.sort_order || 0))
      .filter((image) => {
        const storagePath = normalizeText(image?.storage_path);
        if (!storagePath || seen.has(storagePath)) return false;
        seen.add(storagePath);
        return true;
      });
  }

  function travelPlanServiceImagePaths(item) {
    return travelPlanServiceImages(item).map((image) => normalizeText(image?.storage_path)).filter(Boolean);
  }

  function buildTourTravelPlanDaySearchResult({ tour, tourTitle, day, sourceDestinationScope }) {
    const services = Array.isArray(day?.services) ? day.services : [];
    const primaryService = services.find((item) => primaryTravelPlanServiceImage(item)) || services[0] || null;
    const primaryImage = primaryTravelPlanServiceImage(primaryService);
    const thumbnailUrls = services.flatMap((item) => travelPlanServiceImagePaths(item));
    return {
      source_tour_id: tour.id,
      source_tour_title: normalizeText(tourTitle),
      source_tour_code: tour.id,
      source_destination_scope: Array.isArray(sourceDestinationScope) ? JSON.parse(JSON.stringify(sourceDestinationScope)) : [],
      source_day: day && typeof day === "object" ? JSON.parse(JSON.stringify(day)) : null,
      day_id: normalizeText(day?.id),
      day_number: day?.day_number || null,
      title: normalizeText(day?.title),
      overnight_location: normalizeText(day?.overnight_location),
      notes: normalizeText(day?.notes),
      thumbnail_url: normalizeText(primaryImage?.storage_path),
      thumbnail_urls: thumbnailUrls,
      service_count: services.length,
      image_count: thumbnailUrls.length,
      updated_at: normalizeText(tour.updated_at || tour.created_at)
    };
  }

  function buildTourTravelPlanServiceSearchResult({ tour, tourTitle, day, item, sourceDestinationScope }) {
    const primaryImage = primaryTravelPlanServiceImage(item);
    const thumbnailUrls = travelPlanServiceImagePaths(item);
    return {
      source_tour_id: tour.id,
      source_tour_title: normalizeText(tourTitle),
      source_tour_code: tour.id,
      source_destination_scope: Array.isArray(sourceDestinationScope) ? JSON.parse(JSON.stringify(sourceDestinationScope)) : [],
      source_service: item && typeof item === "object" ? JSON.parse(JSON.stringify(item)) : null,
      day_number: day?.day_number || null,
      service_id: item.id,
      service_kind: normalizeText(item.kind) || null,
      title: normalizeText(item.title),
      details: normalizeText(item.details),
      location: normalizeText(item.location),
      overnight_location: normalizeText(day?.overnight_location),
      thumbnail_url: normalizeText(primaryImage?.storage_path),
      thumbnail_urls: thumbnailUrls,
      image_count: thumbnailUrls.length,
      updated_at: normalizeText(tour.updated_at || tour.created_at)
    };
  }

  function copyMarketingTourServiceForImport(sourceItem, options = {}) {
    const includeTranslations = options.includeTranslations !== false;
    const includeImages = options.includeImages !== false;
    const includeCustomerVisibleImagesOnly = options.includeCustomerVisibleImagesOnly === true;
    const importedAt = normalizeText(options.importedAt) || nowIso();
    const sourceImage = primaryTravelPlanServiceImage(sourceItem);
    const image = includeImages && sourceImage && (!includeCustomerVisibleImagesOnly || sourceImage?.is_customer_visible !== false)
      ? {
          ...sourceImage,
          id: `travel_plan_service_image_${randomUUID()}`,
          sort_order: 0,
          is_primary: true,
          created_at: importedAt
        }
      : null;
    return {
      id: `travel_plan_service_${randomUUID()}`,
      timing_kind: normalizeText(sourceItem?.timing_kind) || "label",
      time_label: preferredEnglishImportText(sourceItem?.time_label_i18n, sourceItem?.time_label),
      time_label_i18n: includeTranslations && sourceItem?.time_label_i18n ? { ...sourceItem.time_label_i18n } : undefined,
      time_point: normalizeText(sourceItem?.time_point),
      kind: normalizeText(sourceItem?.kind) || "other",
      title: preferredEnglishImportText(sourceItem?.title_i18n, sourceItem?.title),
      title_i18n: includeTranslations && sourceItem?.title_i18n ? { ...sourceItem.title_i18n } : undefined,
      details: preferredEnglishImportText(sourceItem?.details_i18n, sourceItem?.details),
      details_i18n: includeTranslations && sourceItem?.details_i18n ? { ...sourceItem.details_i18n } : undefined,
      image_subtitle: preferredEnglishImportText(sourceItem?.image_subtitle_i18n, sourceItem?.image_subtitle),
      image_subtitle_i18n: includeTranslations && sourceItem?.image_subtitle_i18n ? { ...sourceItem.image_subtitle_i18n } : undefined,
      location: preferredEnglishImportText(sourceItem?.location_i18n, sourceItem?.location),
      location_i18n: includeTranslations && sourceItem?.location_i18n ? { ...sourceItem.location_i18n } : undefined,
      start_time: normalizeText(sourceItem?.start_time),
      end_time: normalizeText(sourceItem?.end_time),
      image
    };
  }

  function copyMarketingTourDayForImport(sourceDay, options = {}) {
    const includeTranslations = options.includeTranslations !== false;
    const includeNotes = options.includeNotes !== false;
    return {
      id: `travel_plan_day_${randomUUID()}`,
      day_number: 1,
      title: preferredEnglishImportText(sourceDay?.title_i18n, sourceDay?.title),
      title_i18n: includeTranslations && sourceDay?.title_i18n ? { ...sourceDay.title_i18n } : undefined,
      overnight_location: preferredEnglishImportText(sourceDay?.overnight_location_i18n, sourceDay?.overnight_location),
      overnight_location_i18n: includeTranslations && sourceDay?.overnight_location_i18n ? { ...sourceDay.overnight_location_i18n } : undefined,
      notes: includeNotes ? preferredEnglishImportText(sourceDay?.notes_i18n, sourceDay?.notes) : null,
      notes_i18n: includeNotes && includeTranslations && sourceDay?.notes_i18n ? { ...sourceDay.notes_i18n } : undefined,
      services: (Array.isArray(sourceDay?.services) ? sourceDay.services : []).map((sourceItem) => (
        copyMarketingTourServiceForImport(sourceItem, options)
      ))
    };
  }

  async function regeneratePublicHomepageAssets(reason, details = {}) {
    const task = async () => {
      const generatorPath = PUBLIC_HOMEPAGE_ASSET_GENERATOR_CANDIDATES.find((candidate) => existsSync(candidate));
      if (!generatorPath) {
        throw new Error("Could not find generate_public_homepage_assets.mjs in expected script locations.");
      }
      await execFile(process.execPath, [generatorPath], {
        cwd: repoRoot
      });
    };

    publicHomepageAssetGenerationQueue = publicHomepageAssetGenerationQueue.then(task, task);

    try {
      await publicHomepageAssetGenerationQueue;
      return { ok: true };
    } catch (error) {
      const message = String(error?.stderr || error?.message || error || "Static homepage asset generation failed.");
      console.error("[backend-public-homepage-assets] Generation failed.", {
        reason,
        ...details,
        error: message
      });
      return {
        ok: false,
        error: message
      };
    }
  }

  function deferredPublicHomepageAssets(reason, details = {}) {
    return {
      ok: true,
      dirty: true,
      reason,
      ...details
    };
  }

  function publishedWebpageDestinationCodes(countryReferencePayload) {
    const publishedCountryCodes = new Set(DESTINATION_COUNTRY_CODES);
    for (const item of Array.isArray(countryReferencePayload?.items) ? countryReferencePayload.items : []) {
      const countryCode = normalizeText(item?.country).toUpperCase();
      if (!countryCode) continue;
      if (item?.published_on_webpage === false) publishedCountryCodes.delete(countryCode);
      else publishedCountryCodes.add(countryCode);
    }
    return new Set(
      Array.from(publishedCountryCodes)
        .map((countryCode) => normalizeTourDestinationCode(DESTINATION_COUNTRY_TO_TOUR_DESTINATION_CODE[countryCode]))
        .filter(Boolean)
    );
  }

  function normalizeTourForPublicWebpage(tour, publishedDestinationCodes) {
    const stored = normalizeTourForStorage(tour);
    if (stored.published_on_webpage === false) return null;
    const visibleDestinations = tourDestinationCodes(stored).filter((code) => publishedDestinationCodes.has(code));
    if (!visibleDestinations.length) return null;
    const travelPlan = stored.travel_plan && typeof stored.travel_plan === "object" && !Array.isArray(stored.travel_plan)
      ? stored.travel_plan
      : {};
    return {
      ...stored,
      travel_plan: {
        ...travelPlan,
        destination_scope: filterDestinationScopeByTourDestinations(travelPlan.destination_scope, visibleDestinations)
      },
      destinations: visibleDestinations
    };
  }

  async function handlePublicListTours(req, res) {
    const lang = requestLang(req.url);
    const publishedDestinationCodes = publishedWebpageDestinationCodes(await readCountryPracticalInfo());
    const tours = (await readTours())
      .map((tour) => normalizeTourForPublicWebpage(tour, publishedDestinationCodes))
      .filter(Boolean);
    const requestUrl = new URL(req.url, "http://localhost");
    const destination = normalizeTourDestinationCode(requestUrl.searchParams.get("destination"));
    const style = normalizeTourStyleCode(requestUrl.searchParams.get("style"));
    const offset = Math.max(0, safeInt(requestUrl.searchParams.get("offset")) || 0);
    const limit = clamp(safeInt(requestUrl.searchParams.get("limit")) || tours.length || 1000, 1, 5000);

    const filtered = tours.filter((tour) => {
      const destinationMatch = !destination || tourDestinationCodes(tour).includes(destination);
      const styleMatch = !style || tourStyleCodes(tour).includes(style);
      return destinationMatch && styleMatch;
    });

    const sorted = [...filtered].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
    const items = sorted.slice(offset, offset + limit).map((tour) => normalizeTourForRead(tour, { lang }));
    const options = collectTourOptions(tours, { lang });
    const payload = {
      items,
      available_destinations: options.destinations,
      available_styles: options.styles,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        page_size: limit,
        total_items: filtered.length,
        total_pages: Math.max(1, Math.ceil(filtered.length / limit))
      }
    };
    sendJson(res, 200, payload, { "Cache-Control": "no-store" });
  }

  async function handleListTours(req, res) {
    const principal = getPrincipal(req);
    if (!canReadTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const lang = requestLang(req.url);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const requestUrl = new URL(req.url, "http://localhost");
    const { items: filtered, sort, filters } = filterAndSortTours(tours, requestUrl.searchParams, lang);
    const paged = paginate(filtered, requestUrl.searchParams);
    const options = collectTourOptions(tours, { lang, includeAllStyleCatalogEntries: true });
    sendJson(
      res,
      200,
      buildPaginatedListResponse(
        {
          ...paged,
          items: paged.items.map((tour) => normalizeTourForRead(tour, { lang }))
        },
        {
          sort,
          filters,
          matrix: buildTourMatrixSummary(filtered, lang),
          available_destinations: options.destinations,
          available_styles: options.styles
        }
      )
    );
  }

  async function handleSearchTourTravelPlanDays(req, res) {
    const principal = getPrincipal(req);
    if (!canReadTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const lang = requestLang(req.url);
    const requestUrl = new URL(req.url, "http://localhost");
    const query = normalizeText(requestUrl.searchParams.get("q")).toLowerCase();
    const serviceKind = normalizeText(requestUrl.searchParams.get("service_kind")).toLowerCase();
    const excludeTourId = normalizeText(requestUrl.searchParams.get("exclude_tour_id"));
    const limit = clamp(safeInt(requestUrl.searchParams.get("limit")) || 20, 1, 50);
    const offset = clamp(safeInt(requestUrl.searchParams.get("offset")) || 0, 0, 5000);
    const rows = [];

    for (const tour of (await readTours()).map((item) => normalizeTourForStorage(item))) {
      if (excludeTourId && tour.id === excludeTourId) continue;
      const readModel = normalizeTourForRead(tour, { lang });
      const travelPlan = normalizeMarketingTourTravelPlan(tour.travel_plan, {
        contentLang: lang,
        flatLang: lang,
        strictReferences: false
      });
      for (const day of Array.isArray(travelPlan?.days) ? travelPlan.days : []) {
        const services = Array.isArray(day?.services) ? day.services : [];
        if (!services.length) continue;
        if (serviceKind && !services.some((item) => normalizeText(item?.kind).toLowerCase() === serviceKind)) continue;
        const haystack = [
          readModel.title,
          day?.title,
          day?.overnight_location,
          day?.notes,
          ...services.flatMap((item) => [item?.title, item?.image_subtitle, item?.location])
        ].map((value) => normalizeText(value).toLowerCase()).filter(Boolean).join(" ");
        if (query && !haystack.includes(query)) continue;
        rows.push(buildTourTravelPlanDaySearchResult({
          tour,
          tourTitle: readModel.title,
          day,
          sourceDestinationScope: travelPlan?.destination_scope
        }));
      }
    }

    rows.sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")));
    sendJson(res, 200, {
      items: rows.slice(offset, offset + limit),
      total: rows.length
    });
  }

  async function handleSearchTourTravelPlanServices(req, res) {
    const principal = getPrincipal(req);
    if (!canReadTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const lang = requestLang(req.url);
    const requestUrl = new URL(req.url, "http://localhost");
    const query = normalizeText(requestUrl.searchParams.get("q")).toLowerCase();
    const serviceKind = normalizeText(requestUrl.searchParams.get("service_kind")).toLowerCase();
    const excludeTourId = normalizeText(requestUrl.searchParams.get("exclude_tour_id"));
    const limit = clamp(safeInt(requestUrl.searchParams.get("limit")) || 20, 1, 50);
    const offset = clamp(safeInt(requestUrl.searchParams.get("offset")) || 0, 0, 5000);
    const rows = [];

    for (const tour of (await readTours()).map((item) => normalizeTourForStorage(item))) {
      if (excludeTourId && tour.id === excludeTourId) continue;
      const readModel = normalizeTourForRead(tour, { lang });
      const travelPlan = normalizeMarketingTourTravelPlan(tour.travel_plan, {
        contentLang: lang,
        flatLang: lang,
        strictReferences: false
      });
      for (const day of Array.isArray(travelPlan?.days) ? travelPlan.days : []) {
        for (const item of Array.isArray(day?.services) ? day.services : []) {
          if (serviceKind && normalizeText(item?.kind).toLowerCase() !== serviceKind) continue;
          const haystack = [
            readModel.title,
            day?.title,
            day?.overnight_location,
            item?.title,
            item?.image_subtitle,
            item?.location
          ].map((value) => normalizeText(value).toLowerCase()).filter(Boolean).join(" ");
          if (query && !haystack.includes(query)) continue;
          rows.push(buildTourTravelPlanServiceSearchResult({
            tour,
            tourTitle: readModel.title,
            day,
            item,
            sourceDestinationScope: travelPlan?.destination_scope
          }));
        }
      }
    }

    rows.sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")));
    sendJson(res, 200, {
      items: rows.slice(offset, offset + limit),
      total: rows.length
    });
  }

  async function handleGetTour(req, res, [tourId]) {
    const principal = getPrincipal(req);
    if (!canReadTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const lang = requestLang(req.url);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const tour = tours.find((item) => item.id === tourId);
    if (!tour) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }
    const options = collectTourOptions(tours, { lang, includeAllStyleCatalogEntries: true });
    sendJson(res, 200, {
      tour: buildTourEditorResponse(tour, lang),
      options: {
        destinations: options.destinations,
        styles: options.styles
      }
    });
  }

  async function handleGetTourOnePagerPdf(req, res, [tourId]) {
    const principal = getPrincipal(req);
    if (!canReadTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (typeof writeMarketingTourOnePagerPdf !== "function") {
      sendJson(res, 503, { error: "Tour one-pager PDF rendering is not configured" });
      return;
    }

    const lang = requestLang(req.url);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const tour = tours.find((item) => item.id === tourId);
    if (!tour) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }

    const localizedTour = await applyMarketingTourMemoryToOnePagerTour(tour, lang);
    const readModel = normalizeTourForRead(localizedTour, { lang });
    const travelPlan = normalizeMarketingTourTravelPlan(localizedTour.travel_plan, {
      sourceLang: "en",
      contentLang: lang,
      flatLang: lang,
      flatMode: "localized",
      strictReferences: false
    });
    const selectedExperienceHighlightIds = Array.isArray(travelPlan?.one_pager_experience_highlight_ids)
      ? travelPlan.one_pager_experience_highlight_ids.map((value) => normalizeText(value)).filter(Boolean)
      : [];
    if (selectedExperienceHighlightIds.length < 4) {
      sendJson(res, 400, { error: "Select 4 experience highlights before creating the tour one-pager PDF." });
      return;
    }
    const previewPath = path.join(TEMP_UPLOAD_DIR, `tour-one-pager-${tourId}-${randomUUID()}.pdf`);
    let renderedPath = previewPath;
    try {
      await mkdir(path.dirname(previewPath), { recursive: true });
      const result = await writeMarketingTourOnePagerPdf({
        ...readModel,
        travel_plan: travelPlan
      }, {
        lang,
        outputPath: previewPath
      });
      renderedPath = normalizeText(result?.outputPath) || previewPath;
      await sendFileWithCache(req, res, renderedPath, "private, max-age=0, no-store", {
        "Content-Disposition": `inline; filename="${tourOnePagerFilename(tour).replace(/"/g, "")}"`
      });
    } catch (error) {
      sendJson(res, 500, { error: "Could not render tour one-pager PDF", detail: String(error?.message || error) });
    } finally {
      await rm(renderedPath, { force: true }).catch(() => {});
      if (renderedPath !== previewPath) {
        await rm(previewPath, { force: true }).catch(() => {});
      }
    }
  }

  async function handleTranslateTourFields(req, res) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    let payload;
    try {
      payload = await readBodyJson(req);
      validateTourTranslateFieldsRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const sourceLang = normalizeTourLang(payload.source_lang);
    const targetLang = normalizeTourLang(payload.target_lang);
    const translationProfile = normalizeText(payload.translation_profile) || "marketing_trip_copy";
    const translationRules = typeof readTranslationRules === "function"
      ? (await readTranslationRules()).items
      : [];
    const entries = translationEntriesToObject(payload.entries);
    const traceId = `tour_${randomUUID()}`;
    const requestStartMs = nowMs();
    const entryStats = summarizeTranslationEntries(entries);

    logTourTranslationTiming("Request started", {
      trace_id: traceId,
      source_lang: sourceLang,
      target_lang: targetLang,
      entry_count: entryStats.entryCount,
      total_chars: entryStats.totalChars
    });

    if (!Object.keys(entries).length) {
      logTourTranslationTiming("Request rejected: missing source fields", {
        trace_id: traceId,
        duration_ms: durationMs(requestStartMs)
      });
      sendJson(res, 422, { error: "At least one source field is required." });
      return;
    }

    if (sourceLang === targetLang) {
      logTourTranslationTiming("Request short-circuited: source equals target", {
        trace_id: traceId,
        source_lang: sourceLang,
        target_lang: targetLang,
        duration_ms: durationMs(requestStartMs)
      });
      sendJson(res, 200, {
        source_lang: sourceLang,
        target_lang: targetLang,
        entries: translationEntriesFromObject(entries)
      });
      return;
    }

    try {
      const memoryResult = typeof translationMemoryStore?.resolveEntries === "function"
        ? await translationMemoryStore.resolveEntries(entries, targetLang)
        : { entries: {}, origins: {} };
      const memoryEntries = memoryResult?.entries || {};
      const entriesForProvider = Object.fromEntries(
        Object.entries(entries).filter(([key]) => !normalizeText(memoryEntries[key]))
      );
      const translationResult = translateEntriesWithMeta
        ? await translateEntriesWithMeta(entriesForProvider, targetLang, {
            sourceLangCode: sourceLang,
            domain: "tour marketing copy",
            provider: "google",
            cacheNamespace: "tour-marketing-copy",
            translationProfile,
            translationRules,
            traceId
          })
        : {
            entries: await translateEntries(entriesForProvider, targetLang, {
              sourceLangCode: sourceLang,
              domain: "tour marketing copy",
              provider: "google",
              cacheNamespace: "tour-marketing-copy",
              translationProfile,
              translationRules,
              traceId
            }),
            provider: { kind: "google", model: "", display: "google" }
          };
      const providerEntries = translationResult?.entries || {};
      if (Object.keys(providerEntries).length && typeof translationMemoryStore?.writeMachineTranslations === "function") {
        await translationMemoryStore.writeMachineTranslations(
          entriesForProvider,
          providerEntries,
          targetLang,
          translationResult?.provider || null
        );
      }
      const translatedEntries = {
        ...providerEntries,
        ...memoryEntries
      };
      logTourTranslationTiming("Request finished", {
        trace_id: traceId,
        source_lang: sourceLang,
        target_lang: targetLang,
        translated_entry_count: Object.keys(translatedEntries || {}).length,
        translation_memory_hit_count: Object.keys(memoryEntries || {}).length,
        duration_ms: durationMs(requestStartMs)
      });
      sendJson(res, 200, {
        source_lang: sourceLang,
        target_lang: targetLang,
        entries: translationEntriesFromObject(translatedEntries)
      }, translationProviderResponseHeaders(translationResult?.provider));
    } catch (error) {
      logTourTranslationTiming("Request failed", {
        trace_id: traceId,
        source_lang: sourceLang,
        target_lang: targetLang,
        duration_ms: durationMs(requestStartMs),
        error_code: normalizeText(error?.code),
        error: String(error?.message || error || "Translation failed.")
      });
      if (error?.code === "TRANSLATION_NOT_CONFIGURED") {
        sendJson(res, 503, { error: String(error.message || "Translation provider is not configured.") });
        return;
      }
      if (error?.code === "TRANSLATION_INVALID_RESPONSE" || error?.code === "TRANSLATION_REQUEST_FAILED") {
        sendJson(res, 502, { error: String(error.message || "Translation request failed.") });
        return;
      }
      sendJson(res, 500, { error: String(error?.message || error || "Translation failed.") });
    }
  }

  async function handleCreateTour(req, res) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch (error) {
      sendJson(res, error?.statusCode || 400, { error: error?.message || "Invalid JSON payload" });
      return;
    }

    const lang = requestLang(req.url);
    const now = nowIso();
    const tour = buildTourPayload(payload, { isCreate: true, lang });
    tour.id = `tour_${randomUUID()}`;
    tour.created_at = now;
    tour.updated_at = now;

    const validationError = validateTourInput(tour, { isCreate: true, lang });
    if (validationError) {
      sendJson(res, 422, { error: validationError });
      return;
    }
    if (!(await validateTourDestinationScope(tour.travel_plan, res))) return;

    await persistTour(tour);
    await syncTourManualTranslationsToMemory(tour);
    sendJson(res, 201, {
      tour: buildTourEditorResponse(tour, lang),
      homepage_assets: deferredPublicHomepageAssets("tour_create", { tour_id: tour.id })
    });
  }

  async function handlePatchTour(req, res, [tourId]) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch (error) {
      sendJson(res, error?.statusCode || 400, { error: error?.message || "Invalid JSON payload" });
      return;
    }

    const lang = requestLang(req.url);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const index = tours.findIndex((item) => item.id === tourId);
    if (index < 0) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }

    const current = tours[index];
    if (!assertExpectedTourUpdatedAt(payload, current, res)) return;
    const idChange = normalizeText(payload.id);
    if (idChange && idChange !== tourId) {
      sendJson(res, 422, { error: "Tour id cannot be changed" });
      return;
    }

    const updated = buildTourPayload(payload, { existing: current, isCreate: false, lang });
    updated.updated_at = nowIso();

    const validationError = validateTourInput(updated, { isCreate: false, lang });
    if (validationError) {
      sendJson(res, 422, { error: validationError });
      return;
    }
    if (!(await validateTourDestinationScope(updated.travel_plan, res))) return;

    tours[index] = updated;
    await persistTour(updated);
    await syncTourManualTranslationsToMemory(updated);
    sendJson(res, 200, {
      tour: buildTourEditorResponse(updated, lang),
      homepage_assets: deferredPublicHomepageAssets("tour_patch", { tour_id: updated.id })
    });
  }

  async function handlePatchTourTravelPlan(req, res, [tourId]) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTourTravelPlanUpdateRequest(payload);
    } catch (error) {
      sendJson(res, error?.statusCode || 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const lang = requestLang(req.url);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const index = tours.findIndex((item) => item.id === tourId);
    if (index < 0) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }

    if (!assertExpectedTourUpdatedAt(payload, tours[index], res)) return;

    const check = validateMarketingTourTravelPlanInput(payload.travel_plan);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }
    if (!(await validateTourDestinationScope(check.travel_plan, res))) return;

    const updated = normalizeTourForStorage({
      ...tours[index],
      travel_plan: check.travel_plan,
      updated_at: nowIso()
    });
    tours[index] = updated;
    await persistTour(updated);
    await syncTourManualTranslationsToMemory(updated);
    sendJson(res, 200, {
      tour: buildTourEditorResponse(updated, lang),
      homepage_assets: deferredPublicHomepageAssets("tour_travel_plan_patch", { tour_id: updated.id })
    });
  }

  async function handlePublishTour(req, res, [tourId]) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const lang = requestLang(req.url);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const tour = tours.find((item) => item.id === tourId);
    if (!tour) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }

    const homepageAssets = await regeneratePublicHomepageAssets("tour_publish", { tour_id: tour.id });
    sendJson(res, 200, {
      tour: buildTourEditorResponse(tour, lang),
      homepage_assets: homepageAssets
    });
  }

  async function handleImportTourTravelPlanDay(req, res, [tourId]) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTourTravelPlanDayImportRequest(payload);
    } catch (error) {
      sendJson(res, error?.statusCode || 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const lang = requestLang(req.url);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const targetIndex = tours.findIndex((item) => item.id === tourId);
    if (targetIndex < 0) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }
    if (!assertExpectedTourUpdatedAt(payload, tours[targetIndex], res)) return;

    const sourceTourId = normalizeText(payload.source_tour_id);
    if (sourceTourId === tourId) {
      sendJson(res, 422, { error: "Choose a day from another marketing tour." });
      return;
    }
    const sourceTour = tours.find((item) => item.id === sourceTourId);
    if (!sourceTour) {
      sendJson(res, 404, { error: "Source tour not found" });
      return;
    }
    const sourceTravelPlan = normalizeMarketingTourTravelPlan(sourceTour.travel_plan, {
      contentLang: "en",
      flatLang: "en",
      strictReferences: false
    });
    const sourceDay = (Array.isArray(sourceTravelPlan?.days) ? sourceTravelPlan.days : [])
      .find((day) => day.id === normalizeText(payload.source_day_id));
    if (!sourceDay) {
      sendJson(res, 404, { error: "Source day not found" });
      return;
    }

    const targetTravelPlan = normalizeMarketingTourTravelPlan(
      payload?.target_travel_plan && typeof payload.target_travel_plan === "object" && !Array.isArray(payload.target_travel_plan)
        ? payload.target_travel_plan
        : tours[targetIndex].travel_plan,
      {
        contentLang: "en",
        flatLang: "en",
        strictReferences: false
      }
    );
    const importedDay = copyMarketingTourDayForImport(sourceDay, {
      includeTranslations: payload.include_translations !== false,
      includeNotes: payload.include_notes !== false,
      includeImages: payload.include_images !== false,
      includeCustomerVisibleImagesOnly: payload.include_customer_visible_images_only === true,
      importedAt: nowIso()
    });
    const nextTravelPlan = {
      ...targetTravelPlan,
      days: [
        ...(Array.isArray(targetTravelPlan?.days) ? targetTravelPlan.days : []),
        importedDay
      ]
    };
    const check = validateMarketingTourTravelPlanInput(nextTravelPlan);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }
    if (!(await validateTourDestinationScope(check.travel_plan, res))) return;

    const updated = normalizeTourForStorage({
      ...tours[targetIndex],
      travel_plan: check.travel_plan,
      updated_at: nowIso()
    });
    tours[targetIndex] = updated;
    await persistTour(updated);
    sendJson(res, 200, {
      tour: buildTourEditorResponse(updated, lang),
      homepage_assets: deferredPublicHomepageAssets("tour_travel_plan_day_import", { tour_id: updated.id })
    });
  }

  async function handleImportTourTravelPlanService(req, res, [tourId, dayId]) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTourTravelPlanServiceImportRequest(payload);
    } catch (error) {
      sendJson(res, error?.statusCode || 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const lang = requestLang(req.url);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const targetIndex = tours.findIndex((item) => item.id === tourId);
    if (targetIndex < 0) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }
    if (!assertExpectedTourUpdatedAt(payload, tours[targetIndex], res)) return;

    const sourceTourId = normalizeText(payload.source_tour_id);
    if (sourceTourId === tourId) {
      sendJson(res, 422, { error: "Choose a service from another marketing tour." });
      return;
    }
    const sourceTour = tours.find((item) => item.id === sourceTourId);
    if (!sourceTour) {
      sendJson(res, 404, { error: "Source tour not found" });
      return;
    }
    const sourceServiceId = normalizeText(payload.source_service_id);
    const sourceTravelPlan = normalizeMarketingTourTravelPlan(sourceTour.travel_plan, {
      contentLang: "en",
      flatLang: "en",
      strictReferences: false
    });
    const sourceDay = (Array.isArray(sourceTravelPlan?.days) ? sourceTravelPlan.days : [])
      .find((day) => Array.isArray(day?.services) && day.services.some((item) => item.id === sourceServiceId));
    const sourceService = (Array.isArray(sourceDay?.services) ? sourceDay.services : [])
      .find((item) => item.id === sourceServiceId);
    if (!sourceDay || !sourceService) {
      sendJson(res, 404, { error: "Source service not found" });
      return;
    }

    const targetTravelPlan = normalizeMarketingTourTravelPlan(
      payload?.target_travel_plan && typeof payload.target_travel_plan === "object" && !Array.isArray(payload.target_travel_plan)
        ? payload.target_travel_plan
        : tours[targetIndex].travel_plan,
      {
        contentLang: "en",
        flatLang: "en",
        strictReferences: false
      }
    );
    const targetDays = Array.isArray(targetTravelPlan?.days) ? targetTravelPlan.days : [];
    const targetDayIndex = targetDays.findIndex((day) => day.id === dayId);
    if (targetDayIndex < 0) {
      sendJson(res, 404, { error: "Target day not found" });
      return;
    }

    const importedService = copyMarketingTourServiceForImport(sourceService, {
      includeTranslations: payload.include_translations !== false,
      includeImages: payload.include_images !== false,
      includeCustomerVisibleImagesOnly: payload.include_customer_visible_images_only === true,
      importedAt: nowIso()
    });
    const targetDay = targetDays[targetDayIndex];
    const targetServices = Array.isArray(targetDay?.services) ? [...targetDay.services] : [];
    const insertAfterServiceId = normalizeText(payload.insert_after_service_id);
    if (insertAfterServiceId) {
      const insertAfterIndex = targetServices.findIndex((item) => item.id === insertAfterServiceId);
      if (insertAfterIndex < 0) {
        sendJson(res, 422, { error: `Target service ${insertAfterServiceId} was not found in the target day.` });
        return;
      }
      targetServices.splice(insertAfterIndex + 1, 0, importedService);
    } else {
      targetServices.push(importedService);
    }

    const nextTravelPlan = {
      ...targetTravelPlan,
      days: targetDays.map((day, index) => (
        index === targetDayIndex
          ? {
              ...day,
              services: targetServices
            }
          : day
      ))
    };
    const check = validateMarketingTourTravelPlanInput(nextTravelPlan);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }
    if (!(await validateTourDestinationScope(check.travel_plan, res))) return;

    const updated = normalizeTourForStorage({
      ...tours[targetIndex],
      travel_plan: check.travel_plan,
      updated_at: nowIso()
    });
    tours[targetIndex] = updated;
    await persistTour(updated);
    sendJson(res, 200, {
      tour: buildTourEditorResponse(updated, lang),
      homepage_assets: deferredPublicHomepageAssets("tour_travel_plan_service_import", { tour_id: updated.id })
    });
  }

  const marketingTourBookingTravelPlanCloner = createMarketingTourBookingTravelPlanCloner({
    normalizeText,
    normalizeMarketingTourTravelPlan,
    tourDestinationCodes,
    randomUUID,
    nowIso,
    processTourServiceImageToWebp: processTourImageToWebp,
    bookingImagesDir: BOOKING_IMAGES_DIR,
    toursDir: TOURS_DIR,
    path,
    logPrefix: "tour-apply"
  });

  async function handleApplyTourToBooking(req, res, [bookingId, tourId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
      validateBookingTourApplyRequest(payload);
    } catch (error) {
      sendJson(res, error?.statusCode || 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    const [store, tours] = await Promise.all([readStore(), readTours()]);
    const booking = (Array.isArray(store?.bookings) ? store.bookings : []).find((item) => item.id === bookingId);
    if (!booking) {
      sendJson(res, 404, { error: "Booking not found" });
      return;
    }
    if (!canEditBooking(principal, booking)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (!(await assertExpectedRevision(req, payload, booking, "expected_travel_plan_revision", "travel_plan_revision", res))) return;

    const tour = tours.map((item) => normalizeTourForStorage(item)).find((item) => item.id === tourId);
    if (!tour) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }

    const nextTravelPlan = await marketingTourBookingTravelPlanCloner.cloneMarketingTourTravelPlanForBooking(tour, booking);
    const check = validateBookingTravelPlanInput(nextTravelPlan, booking.offer);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    booking.travel_plan = check.travel_plan;
    incrementBookingRevision(booking, "travel_plan_revision");
    booking.updated_at = nowIso();
    addActivity(
      store,
      booking.id,
      "TRAVEL_PLAN_UPDATED",
      actorLabel(principal, normalizeText(payload?.actor) || "keycloak_user"),
      `Travel plan replaced from marketing tour ${resolveLocalizedText(tour.title, "en") || tour.id}`
    );
    await persistStore(store);
    sendJson(res, 200, await buildBookingDetailResponse(booking, req));
  }

  async function handleDeleteTour(req, res, [tourId]) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const existing = tours.find((item) => item.id === tourId);
    if (!existing) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }

    const store = await readStore();
    const bookingReferenceCount = countBookingsReferencingTour(store, tourId);
    if (bookingReferenceCount > 0) {
      sendJson(res, 409, {
        error: "Tour is still referenced by bookings",
        detail: `${bookingReferenceCount} booking(s) currently reference this tour.`
      });
      return;
    }

    const folderPath = resolveTourFolderPath(tourId);
    if (!folderPath) {
      sendJson(res, 500, { error: "Tour storage path is invalid" });
      return;
    }

    await rm(folderPath, { recursive: true, force: true });
    const homepageAssets = await regeneratePublicHomepageAssets("tour_delete", { tour_id: tourId });
    sendJson(res, 200, {
      deleted: true,
      tour_id: tourId,
      homepage_assets: homepageAssets
    });
  }

  async function handlePublicTourImage(req, res, [rawRelativePath]) {
    const absolutePath = resolveTourImageDiskPath(rawRelativePath);
    if (!absolutePath) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    await sendFileWithCache(req, res, absolutePath, "public, max-age=31536000, immutable");
  }

  async function handleGetTourVideo(req, res, [tourId]) {
    const principal = getPrincipal(req);
    if (!canReadTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const videoPath = resolveTourVideoDiskPath(tourId);
    if (!videoPath || !existsSync(videoPath)) {
      sendJson(res, 404, { error: "Tour video not found" });
      return;
    }

    await sendFileWithCache(req, res, videoPath, "private, no-store");
  }

  async function processTourImageToWebp(inputPath, outputPath) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await execImageMagick(execFile, [
      inputPath,
      "-auto-orient",
      "-resize",
      "1000x1000>",
      "-strip",
      "-quality",
      "82",
      outputPath
    ]);
  }

  function tourImageRelativePathFromStoragePath(storagePath, tourId) {
    const normalizedTourId = normalizeText(tourId);
    const normalized = normalizeText(storagePath).split("?")[0];
    if (!normalizedTourId || !normalized) return "";
    const publicPrefix = `/public/v1/tour-images/`;
    if (normalized.startsWith(publicPrefix)) {
      return normalized.slice(publicPrefix.length).replace(/^\/+/, "");
    }
    const bare = normalized.replace(/^\/+/, "");
    if (bare.startsWith(`${normalizedTourId}/`)) return bare;
    return "";
  }

  function resolveTourServiceImageDiskPath(storagePath, tourId) {
    const relativePath = tourImageRelativePathFromStoragePath(storagePath, tourId);
    if (!relativePath) return "";
    const absolutePath = path.resolve(TOURS_DIR, relativePath);
    const toursRoot = path.resolve(TOURS_DIR);
    if (!absolutePath.startsWith(`${toursRoot}${path.sep}`)) return "";
    return absolutePath;
  }

  async function handleUploadTourTravelPlanServiceImage(req, res, [tourId, dayId, serviceId]) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    let payload;
    try {
      payload = await readBodyJson(req, { maxBytes: IMAGE_UPLOAD_BODY_MAX_BYTES });
      validateTravelPlanServiceImageUploadRequest(payload);
    } catch (error) {
      sendJson(res, error?.statusCode || 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const lang = requestLang(req.url);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const index = tours.findIndex((item) => item.id === tourId);
    if (index < 0) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }

    const normalizedTravelPlan = normalizeMarketingTourTravelPlan(tours[index].travel_plan);
    const { dayIndex, itemIndex, item } = findTravelPlanDayAndItem(normalizedTravelPlan, dayId, serviceId);
    if (dayIndex < 0 || itemIndex < 0 || !item) {
      sendJson(res, 404, { error: "Service not found" });
      return;
    }

    const filename = normalizeText(payload.filename) || `${serviceId}.upload`;
    const base64 = normalizeText(payload.data_base64);
    if (!base64) {
      sendJson(res, 422, { error: "data_base64 is required" });
      return;
    }
    const sourceBuffer = Buffer.from(base64, "base64");
    if (!sourceBuffer.length) {
      sendJson(res, 422, { error: "Invalid base64 image payload" });
      return;
    }

    const tempInputPath = path.join(TEMP_UPLOAD_DIR, `${serviceId}-${randomUUID()}${path.extname(filename) || ".upload"}`);
    const outputName = `${serviceId}-${Date.now()}-${randomUUID()}.webp`;
    const outputRelativePath = `${tourId}/travel-plan-services/${outputName}`;
    const outputPath = path.join(TOURS_DIR, outputRelativePath);

    try {
      await writeFile(tempInputPath, sourceBuffer);
      await processTourImageToWebp(tempInputPath, outputPath);
    } catch (error) {
      sendJson(res, 500, { error: "Image conversion failed", detail: String(error?.message || error) });
      return;
    } finally {
      await rm(tempInputPath, { force: true });
    }

    const nextImage = normalizeItemImageRef({
      id: `travel_plan_service_image_${randomUUID()}`,
      storage_path: `/public/v1/tour-images/${outputRelativePath}`,
      sort_order: 0,
      is_primary: true,
      is_customer_visible: true,
      include_in_travel_tour_card: item?.image?.include_in_travel_tour_card === true,
      created_at: nowIso()
    });

    normalizedTravelPlan.days[dayIndex].services[itemIndex] = {
      ...item,
      image: nextImage
    };

    const check = validateMarketingTourTravelPlanInput(normalizedTravelPlan);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    const updated = normalizeTourForStorage({
      ...tours[index],
      travel_plan: check.travel_plan,
      updated_at: nowIso()
    });
    tours[index] = updated;
    await persistTour(updated);
    sendJson(res, 200, {
      tour: buildTourEditorResponse(updated, lang),
      homepage_assets: deferredPublicHomepageAssets("tour_travel_plan_service_image_upload", { tour_id: updated.id })
    });
  }

  async function handleDeleteTourTravelPlanServiceImage(req, res, [tourId, dayId, serviceId]) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    let payload;
    try {
      payload = await readBodyJson(req);
      validateTravelPlanServiceImageDeleteRequest(payload);
    } catch (error) {
      sendJson(res, error?.statusCode || 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const lang = requestLang(req.url);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const index = tours.findIndex((item) => item.id === tourId);
    if (index < 0) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }

    const normalizedTravelPlan = normalizeMarketingTourTravelPlan(tours[index].travel_plan);
    const { dayIndex, itemIndex, item } = findTravelPlanDayAndItem(normalizedTravelPlan, dayId, serviceId);
    if (dayIndex < 0 || itemIndex < 0 || !item) {
      sendJson(res, 404, { error: "Service not found" });
      return;
    }
    const currentImage = item.image && typeof item.image === "object" && !Array.isArray(item.image)
      ? item.image
      : null;
    if (!currentImage) {
      sendJson(res, 404, { error: "Service image not set" });
      return;
    }

    normalizedTravelPlan.days[dayIndex].services[itemIndex] = {
      ...item,
      image: null
    };

    const check = validateMarketingTourTravelPlanInput(normalizedTravelPlan);
    if (!check.ok) {
      sendJson(res, 422, { error: check.error });
      return;
    }

    const imagePath = resolveTourServiceImageDiskPath(currentImage.storage_path, tourId);
    const updated = normalizeTourForStorage({
      ...tours[index],
      travel_plan: check.travel_plan,
      updated_at: nowIso()
    });
    tours[index] = updated;
    await persistTour(updated);
    if (imagePath && imagePath.includes(`${path.sep}travel-plan-services${path.sep}`)) {
      await rm(imagePath, { force: true }).catch(() => {});
    }
    sendJson(res, 200, {
      tour: buildTourEditorResponse(updated, lang),
      homepage_assets: deferredPublicHomepageAssets("tour_travel_plan_service_image_delete", { tour_id: updated.id })
    });
  }

  async function handleUploadTourVideo(req, res, [tourId]) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    let payload;
    try {
      payload = await readBodyJson(req, { maxBytes: VIDEO_UPLOAD_BODY_MAX_BYTES });
    } catch (error) {
      sendJson(res, error?.statusCode || 400, { error: error?.message || "Invalid JSON payload" });
      return;
    }

    const filename = normalizeText(payload.filename) || `${tourId}.upload`;
    const base64 = normalizeText(payload.data_base64);
    if (!base64) {
      sendJson(res, 422, { error: "data_base64 is required" });
      return;
    }

    const lang = requestLang(req.url);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const index = tours.findIndex((item) => item.id === tourId);
    if (index < 0) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }

    const sourceBuffer = Buffer.from(base64, "base64");
    if (!sourceBuffer.length) {
      sendJson(res, 422, { error: "Invalid base64 video payload" });
      return;
    }

    const tempInputPath = path.join(TEMP_UPLOAD_DIR, `${tourId}-${randomUUID()}${path.extname(filename) || ".upload"}`);
    const outputPath = resolveTourVideoDiskPath(tourId);
    if (!outputPath) {
      sendJson(res, 500, { error: "Tour storage path is invalid" });
      return;
    }

    try {
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(tempInputPath, sourceBuffer);
      await execFile("bash", [
        path.join(repoRoot, "scripts", "content", "clipVideo"),
        tempInputPath,
        outputPath
      ]);
    } catch (error) {
      sendJson(res, 500, { error: "Video normalization failed", detail: String(error?.stderr || error?.message || error) });
      return;
    } finally {
      await rm(tempInputPath, { force: true });
    }

    const current = normalizeTourForStorage(tours[index]);
    const updated = normalizeTourForStorage({
      ...current,
      video: {
        storage_path: `/api/v1/tours/${tourId}/video`,
        title: filename
      },
      updated_at: nowIso()
    });
    tours[index] = updated;
    await persistTour(updated);

    sendJson(res, 200, {
      tour: buildTourEditorResponse(updated, lang),
      homepage_assets: deferredPublicHomepageAssets("tour_video_upload", { tour_id: updated.id })
    });
  }

  async function handleDeleteTourVideo(req, res, [tourId]) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const lang = requestLang(req.url);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const index = tours.findIndex((item) => item.id === tourId);
    if (index < 0) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }

    const videoPath = resolveTourVideoDiskPath(tourId);
    if (!videoPath || !existsSync(videoPath)) {
      sendJson(res, 404, { error: "Tour video not found" });
      return;
    }

    await rm(videoPath, { force: true });

    const current = normalizeTourForStorage(tours[index]);
    delete current.video;
    const updated = normalizeTourForStorage({
      ...current,
      updated_at: nowIso()
    });
    tours[index] = updated;
    await persistTour(updated);

    sendJson(res, 200, {
      tour: buildTourEditorResponse(updated, lang),
      homepage_assets: deferredPublicHomepageAssets("tour_video_delete", { tour_id: updated.id })
    });
  }

  return {
    handlePublicListTours,
    handleListTours,
    handleSearchTourTravelPlanDays,
    handleSearchTourTravelPlanServices,
    handleGetTour,
    handleGetTourOnePagerPdf,
    handlePublishTour,
    handleTranslateTourFields,
    handleCreateTour,
    handlePatchTour,
    handlePatchTourTravelPlan,
    handleImportTourTravelPlanDay,
    handleImportTourTravelPlanService,
    handleUploadTourTravelPlanServiceImage,
    handleDeleteTourTravelPlanServiceImage,
    handleApplyTourToBooking,
    handleDeleteTour,
    handleGetTourVideo,
    handlePublicTourImage,
    handleUploadTourVideo,
    handleDeleteTourVideo
  };
}
