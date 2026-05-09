import {
  validateBookingTourApplyRequest,
  validateTourTranslateFieldsRequest,
  validateTourTravelPlanDayImportRequest,
  validateTourTravelPlanServiceImportRequest,
  validateTourTravelPlanUpdateRequest,
  validateTravelPlanServiceImageDeleteRequest,
  validateTravelPlanServiceImageUploadRequest
} from "../../../Generated/API/generated_APIModels.js";
import { existsSync, readFileSync } from "node:fs";
import { execImageMagick } from "../../lib/imagemagick.js";
import {
  findTravelPlanDayAndItem,
  normalizeItemImageRef
} from "./booking_travel_plan_shared.js";
import { createMarketingTourBookingTravelPlanCloner } from "./marketing_tour_booking_travel_plan.js";
import {
  destinationScopeTourDestinations,
  filterDestinationScopeByTourDestinations,
  mergeDestinationScopeWithTravelPlanLocations,
  validateTravelPlanDayLocationIdsAgainstCatalog
} from "../../domain/destination_scope.js";
import {
  deriveTourExperienceHighlightIds,
  normalizeExperienceHighlightIds
} from "../../domain/tour_metadata.js";
import {
  applyMarketingTourTranslations,
  loadPublishedMarketingTourTranslations
} from "../../domain/marketing_tour_translations.js";

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
    nowIso,
    randomUUID,
    persistTour,
    repoRoot,
    resolveTourImageDiskPath,
    writeTravelPlanPdf,
    writeMarketingTourOnePagerPdf,
    sendFileWithCache,
    mkdir,
    path,
    execFile,
    TEMP_UPLOAD_DIR,
    TOURS_DIR,
    TRANSLATIONS_SNAPSHOT_DIR,
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
  const CUSTOM_ONE_PAGER_PREVIEW_TTL_MS = 20 * 60 * 1000;
  const CUSTOM_ONE_PAGER_PREVIEW_MAX_DAYS = 20;
  const translationsSnapshotDir = normalizeText(TRANSLATIONS_SNAPSHOT_DIR) || path.join(repoRoot, "content", "translations");
  const customOnePagerPreviewTokens = new Map();
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

  async function loadMarketingTourContentTranslationMap(lang) {
    const normalizedLang = normalizeTourLang(lang);
    if (!normalizedLang || normalizedLang === "en") return new Map();
    try {
      const publishedByLang = await loadPublishedMarketingTourTranslations(translationsSnapshotDir, [normalizedLang]);
      return publishedByLang.get(normalizedLang) || new Map();
    } catch (error) {
      console.warn("[backend-tour-translation] Could not read published marketing tour translations.", {
        lang: normalizedLang,
        error: String(error?.message || error)
      });
    }
    return new Map();
  }

  async function localizeMarketingToursForRead(tours, lang) {
    const translations = await loadMarketingTourContentTranslationMap(lang);
    return (Array.isArray(tours) ? tours : []).map((tour) => applyMarketingTourTranslations(tour, lang, translations));
  }

  async function localizeMarketingTourForRead(tour, lang) {
    const [localized] = await localizeMarketingToursForRead([tour], lang);
    return localized || tour;
  }

  async function buildLocalizedTourEditorResponse(tour, lang) {
    return buildTourEditorResponse(await localizeMarketingTourForRead(tour, lang), lang);
  }

  function cleanupCustomOnePagerPreviewTokens() {
    const now = nowMs();
    for (const [token, entry] of customOnePagerPreviewTokens.entries()) {
      if (!entry || Number(entry.expiresAtMs || 0) <= now) {
        customOnePagerPreviewTokens.delete(token);
      }
    }
  }

  function normalizeStyleCodes(values) {
    return tourStyleCodes({ styles: normalizeStringArray(values) });
  }

  function localizedTextregionMap(value, { multiline = false } = {}) {
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

  function localizedTranslationMap(value) {
    return Object.fromEntries(
      Object.entries(localizedTextMap(value))
        .filter(([lang]) => lang !== "en")
    );
  }

  function localizedPairMap(plainValue, i18nValue, { multiline = false } = {}) {
    return localizedTextregionMap({
      ...(normalizeText(plainValue) ? { en: plainValue } : {}),
      ...localizedTranslationMap(i18nValue)
    }, { multiline });
  }

  function splitLocalizedPairInput(value, fallbackPlain = "") {
    const source = localizedTextMap(value);
    return {
      text: normalizeText(source.en) || normalizeText(fallbackPlain),
      i18n: localizedTranslationMap(source)
    };
  }

  function updateLocalizedPairForLang(holder, plainField, i18nField, inputValue, lang = "en") {
    if (!holder || typeof holder !== "object" || Array.isArray(holder)) return;
    const normalizedLang = normalizeTourLang(lang);
    const normalizedText = normalizeText(inputValue);
    if (normalizedLang === "en") {
      holder[plainField] = normalizedText;
      holder[i18nField] = localizedTranslationMap(holder[i18nField]);
      return;
    }
    const nextMap = localizedTranslationMap(holder[i18nField]);
    if (normalizedText) nextMap[normalizedLang] = normalizedText;
    else delete nextMap[normalizedLang];
    holder[i18nField] = nextMap;
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
      mapField: "title_i18n",
      plainField: "title",
      key: "website.title"
    });
    addTourTranslationDescriptor(descriptors, {
      holder: tour,
      mapField: "short_description_i18n",
      plainField: "short_description",
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

  async function syncMarketingTourTranslationsForPublish(tours) {
    for (const tour of Array.isArray(tours) ? tours : []) {
      await syncTourManualTranslationsToMemory(tour);
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
      title_i18n: localizedPairMap(stored.title, stored.title_i18n),
      short_description_i18n: localizedPairMap(stored.short_description, stored.short_description_i18n),
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

  function tourTravelPlanFilename(tour) {
    const title = normalizeText(resolveLocalizedText(tour?.title, "en") || tour?.id || "tour")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "tour";
    return `${title}-travel-plan.pdf`;
  }

  function cloneJson(value) {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value));
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

  function normalizeDuplicateTitleKey(value) {
    return normalizeText(value).replace(/\s+/g, " ").toLowerCase();
  }

  function addDuplicateTitleCandidate(candidates, value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.values(value).forEach((entry) => addDuplicateTitleCandidate(candidates, entry));
      return;
    }
    const title = normalizeText(value);
    const key = normalizeDuplicateTitleKey(title);
    if (key && !candidates.has(key)) candidates.set(key, title);
  }

  function collectTourTitleCandidates(tour) {
    const candidates = new Map();
    addDuplicateTitleCandidate(candidates, tour?.title);
    addDuplicateTitleCandidate(candidates, tour?.title_i18n);
    return candidates;
  }

  function findDuplicateTourTitle(tours, candidateTour, currentTourId = "") {
    const currentId = normalizeText(currentTourId);
    const candidates = collectTourTitleCandidates(candidateTour);
    if (!candidates.size) return null;
    for (const tour of tours) {
      const tourId = normalizeText(tour?.id);
      if (!tourId || tourId === currentId) continue;
      const existingCandidates = collectTourTitleCandidates(tour);
      for (const [key, candidateTitle] of candidates.entries()) {
        if (existingCandidates.has(key)) {
          return {
            id: tourId,
            title: existingCandidates.get(key) || candidateTitle
          };
        }
      }
    }
    return null;
  }

  function sendDuplicateTourTitle(res, duplicate) {
    sendJson(res, 409, {
      error: `A tour titled "${duplicate.title}" already exists.`,
      code: "TOUR_DUPLICATE_TITLE",
      duplicate_tour_id: duplicate.id,
      duplicate_title: duplicate.title
    });
  }

  function buildTourPayload(payload, { existing = null, isCreate = false, lang = "en" } = {}) {
    const current = existing ? normalizeTourForStorage(existing) : {};
    const next = { ...current };

    if (isCreate || payload.id !== undefined) next.id = normalizeText(payload.id) || next.id;
    if (payload.title_i18n !== undefined) {
      const pair = splitLocalizedPairInput(payload.title_i18n, current.title);
      next.title = pair.text;
      next.title_i18n = pair.i18n;
    } else if (isCreate || payload.title !== undefined) {
      updateLocalizedPairForLang(next, "title", "title_i18n", payload.title, lang);
    }
    if (payload.short_description_i18n !== undefined) {
      const pair = splitLocalizedPairInput(payload.short_description_i18n, current.short_description);
      next.short_description = pair.text;
      next.short_description_i18n = pair.i18n;
    } else if (payload.short_description !== undefined) {
      updateLocalizedPairForLang(next, "short_description", "short_description_i18n", payload.short_description, lang);
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
    if (isCreate && !normalizeText(tour?.title)) return "title is required";
    if (isCreate && !normalizeStyleCodes(tour?.styles).length) return "styles is required";
    return "";
  }

  async function validateTourDestinationScope(travelPlan, res) {
    const store = await readStore();
    const locationCheck = validateTravelPlanDayLocationIdsAgainstCatalog(travelPlan, store);
    if (!locationCheck.ok) {
      sendJson(res, 422, { error: locationCheck.error });
      return false;
    }
    const highlightCheck = validateTravelPlanDayExperienceHighlights(travelPlan);
    if (!highlightCheck.ok) {
      sendJson(res, 422, { error: highlightCheck.error });
      return false;
    }
    if (travelPlan && typeof travelPlan === "object" && !Array.isArray(travelPlan)) {
      delete travelPlan.destination_scope;
      delete travelPlan.destinations;
      travelPlan.derived_experience_highlight_ids = deriveTourExperienceHighlightIds(
        travelPlan,
        experienceHighlightCatalog()
      );
    }
    return true;
  }

  function experienceHighlightCatalog() {
    const manifestPath = path.join(repoRoot, "assets", "img", "experience-highlights", "manifest.json");
    if (!existsSync(manifestPath)) return [];
    try {
      const payload = JSON.parse(readFileSync(manifestPath, "utf8"));
      return Array.isArray(payload) ? payload : [];
    } catch {
      return [];
    }
  }

  function validateTravelPlanDayExperienceHighlights(travelPlan) {
    const catalog = experienceHighlightCatalog();
    if (!catalog.length) return { ok: true };
    const availableIds = new Set(catalog.map((item) => normalizeText(item?.id)).filter(Boolean));
    for (const day of Array.isArray(travelPlan?.days) ? travelPlan.days : []) {
      const highlightIds = normalizeExperienceHighlightIds(day?.experience_highlight_ids);
      for (const highlightId of highlightIds) {
        if (!availableIds.has(highlightId)) {
          return { ok: false, error: `Unknown experience highlight: ${highlightId}` };
        }
      }
    }
    return { ok: true };
  }

  function deriveTourDestinationScopeFromDayLocations(tour, store) {
    return mergeDestinationScopeWithTravelPlanLocations([], tour?.travel_plan, store);
  }

  function deriveTourDestinationCodesFromDayLocations(tour, store) {
    return destinationScopeTourDestinations(deriveTourDestinationScopeFromDayLocations(tour, store));
  }

  function filterAndSortTours(tours, query, lang, store) {
    const search = normalizeText(query.get("search")).toLowerCase();
    const destination = normalizeTourDestinationCode(query.get("destination"));
    const region = normalizeText(query.get("region"));
    const place = normalizeText(query.get("place"));
    const style = normalizeTourStyleCode(query.get("style"));
    const sort = normalizeText(query.get("sort")) || "updated_at_desc";

    const filtered = tours.filter((tour) => {
      const destinationCodes = deriveTourDestinationCodesFromDayLocations(tour, store);
      const styleCodes = tourStyleCodes(tour);
      const destinationScope = deriveTourDestinationScopeFromDayLocations(tour, store);
      const destinationMatch = !destination || destinationCodes.includes(destination);
      const regionMatch = !region || destinationScope.some((entry) => (
        Array.isArray(entry?.regions)
        && entry.regions.some((regionSelection) => normalizeText(regionSelection?.region_id) === region)
      ));
      const placeMatch = !place || destinationScope.some((entry) => (
        (Array.isArray(entry?.places) && entry.places.some((placeSelection) => normalizeText(placeSelection?.place_id) === place))
        || (Array.isArray(entry?.regions) && entry.regions.some((regionSelection) => (
          Array.isArray(regionSelection?.places)
          && regionSelection.places.some((placeSelection) => normalizeText(placeSelection?.place_id) === place)
        )))
      ));
      const styleMatch = !style || styleCodes.includes(style);
      if (!destinationMatch || !regionMatch || !placeMatch || !styleMatch) return false;
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
        region: region || null,
        place: place || null,
        style: style || null,
        search: search || null
      }
    };
  }

  function buildTourMatrixSummary(tours, lang, store) {
    const items = Array.isArray(tours) ? tours : [];
    const destinations = Array.from(new Set(items
      .flatMap((tour) => deriveTourDestinationCodesFromDayLocations(tour, store))
      .map((value) => normalizeText(value))
      .filter(Boolean)));
    const options = collectTourOptions(items, { lang });
    const styles = (Array.isArray(options?.styles) ? options.styles : [])
      .map((value) => normalizeText(value?.label || value?.code || value))
      .filter(Boolean);
    const counts = {};

    items.forEach((tour) => {
      const readModel = normalizeTourForRead(tour, { lang });
      const tourDestinations = Array.from(
        new Set(deriveTourDestinationCodesFromDayLocations(tour, store).map((value) => normalizeText(value)).filter(Boolean))
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
    const travelPlan = normalizeTourTravelPlan(tour?.travel_plan);
    return {
      ...travelPlan,
      derived_experience_highlight_ids: deriveTourExperienceHighlightIds(travelPlan, experienceHighlightCatalog())
    };
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

  function buildTourTravelPlanDaySearchResult({ tour, tourTitle, day }) {
    const services = Array.isArray(day?.services) ? day.services : [];
    const primaryService = services.find((item) => primaryTravelPlanServiceImage(item)) || services[0] || null;
    const primaryImage = primaryTravelPlanServiceImage(primaryService);
    const thumbnailUrls = services.flatMap((item) => travelPlanServiceImagePaths(item));
    return {
      source_tour_id: tour.id,
      source_tour_title: normalizeText(tourTitle),
      source_tour_code: tour.id,
      source_day: day && typeof day === "object" ? JSON.parse(JSON.stringify(day)) : null,
      day_id: normalizeText(day?.id),
      day_number: day?.day_number || null,
      title: normalizeText(day?.title),
      overnight_location: normalizeText(day?.overnight_location),
      primary_location_id: normalizeText(day?.primary_location_id) || null,
      secondary_location_id: normalizeText(day?.secondary_location_id) || null,
      experience_highlight_ids: normalizeExperienceHighlightIds(day?.experience_highlight_ids, { limit: 1 }),
      notes: normalizeText(day?.notes),
      thumbnail_url: normalizeText(primaryImage?.storage_path),
      thumbnail_urls: thumbnailUrls,
      service_count: services.length,
      image_count: thumbnailUrls.length,
      updated_at: normalizeText(tour.updated_at || tour.created_at)
    };
  }

  function buildTourTravelPlanServiceSearchResult({ tour, tourTitle, day, item }) {
    const primaryImage = primaryTravelPlanServiceImage(item);
    const thumbnailUrls = travelPlanServiceImagePaths(item);
    return {
      source_tour_id: tour.id,
      source_tour_title: normalizeText(tourTitle),
      source_tour_code: tour.id,
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
      primary_location_id: normalizeText(sourceDay?.primary_location_id) || null,
      secondary_location_id: normalizeText(sourceDay?.secondary_location_id) || null,
      experience_highlight_ids: normalizeExperienceHighlightIds(sourceDay?.experience_highlight_ids, { limit: 1 }),
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

  function normalizeTourForPublicWebpage(tour, destinationCatalogPayload = {}) {
    const stored = normalizeTourForStorage(tour);
    if (stored.published_on_webpage === false) return null;
    const travelPlan = stored.travel_plan && typeof stored.travel_plan === "object" && !Array.isArray(stored.travel_plan)
      ? stored.travel_plan
      : {};
    const destination_scope = deriveTourDestinationScopeFromDayLocations(stored, destinationCatalogPayload);
    const scopedStored = {
      ...stored,
      travel_plan: {
        ...travelPlan,
        destination_scope
      }
    };
    const visibleDestinations = destinationScopeTourDestinations(destination_scope);
    if (!visibleDestinations.length) return null;
    return {
      ...stored,
      travel_plan: {
        ...travelPlan,
        destination_scope: filterDestinationScopeByTourDestinations(destination_scope, visibleDestinations)
      },
      destinations: visibleDestinations
    };
  }

  async function handlePublicListTours(req, res) {
    const lang = requestLang(req.url);
    const destinationCatalogPayload = await readStore();
    const tours = await localizeMarketingToursForRead((await readTours())
      .map((tour) => normalizeTourForPublicWebpage(tour, destinationCatalogPayload))
      .filter(Boolean), lang);
    const requestUrl = new URL(req.url, "http://localhost");
    const destination = normalizeTourDestinationCode(requestUrl.searchParams.get("destination"));
    const style = normalizeTourStyleCode(requestUrl.searchParams.get("style"));
    const offset = Math.max(0, safeInt(requestUrl.searchParams.get("offset")) || 0);
    const limit = clamp(safeInt(requestUrl.searchParams.get("limit")) || tours.length || 1000, 1, 5000);

    const filtered = tours.filter((tour) => {
      const tourDestinations = Array.isArray(tour?.destinations) ? tour.destinations.map((value) => normalizeText(value)).filter(Boolean) : [];
      const destinationMatch = !destination || tourDestinations.includes(destination);
      const styleMatch = !style || tourStyleCodes(tour).includes(style);
      return destinationMatch && styleMatch;
    });

    const sorted = [...filtered].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
    const items = sorted.slice(offset, offset + limit).map((tour) => {
      const readModel = normalizeTourForRead(tour, { lang });
      const destinationCodes = Array.isArray(tour?.destinations) ? tour.destinations.map((value) => normalizeText(value)).filter(Boolean) : [];
      return {
        ...readModel,
        destination_codes: destinationCodes,
        destinations: destinationCodes,
        travel_plan: {
          ...readModel.travel_plan,
          destination_scope: tour?.travel_plan?.destination_scope || []
        }
      };
    });
    const options = collectTourOptions(tours, { lang });
    const availableDestinations = Array.from(new Set(tours.flatMap((tour) => (
      Array.isArray(tour?.destinations) ? tour.destinations : []
    ))))
      .map((code) => ({ code, label: code }));
    const payload = {
      items,
      available_destinations: availableDestinations,
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

  async function renderTourOnePagerPdf(req, res, tour, lang) {
    if (typeof writeMarketingTourOnePagerPdf !== "function") {
      sendJson(res, 503, { error: "Tour one-pager PDF rendering is not configured" });
      return;
    }

    const localizedTour = await localizeMarketingTourForRead(tour, lang);
    const readModel = normalizeTourForRead(localizedTour, { lang });
    const travelPlan = normalizeMarketingTourTravelPlan(localizedTour.travel_plan, {
      sourceLang: "en",
      contentLang: lang,
      flatLang: lang,
      flatMode: "localized",
      strictReferences: false
    });
    const tourId = normalizeText(tour?.id) || "tour";
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

  function selectedPreviewDayKeys(payload, baseTourId) {
    const selectedDays = Array.isArray(payload?.selected_days) ? payload.selected_days : [];
    return selectedDays
      .slice(0, CUSTOM_ONE_PAGER_PREVIEW_MAX_DAYS + 1)
      .map((item) => ({
        source_tour_id: normalizeText(item?.source_tour_id) || baseTourId,
        source_day_id: normalizeText(item?.source_day_id)
      }))
      .filter((item) => item.source_tour_id && item.source_day_id);
  }

  function publicTourById(tours, tourId, destinationCatalogPayload = {}) {
    const tour = (Array.isArray(tours) ? tours : []).find((item) => normalizeText(item?.id) === tourId);
    return tour ? normalizeTourForPublicWebpage(tour, destinationCatalogPayload) : null;
  }

  function publicTourLocalizedTravelPlan(tour, lang) {
    return normalizeMarketingTourTravelPlan(tour?.travel_plan, {
      sourceLang: "en",
      contentLang: lang,
      flatLang: lang,
      flatMode: "localized",
      strictReferences: false
    });
  }

  async function customizedPreviewTourFromTokenEntry(entry) {
    const lang = normalizeTourLang(entry?.lang);
    const baseTourId = normalizeText(entry?.baseTourId);
    const selectedDays = Array.isArray(entry?.selectedDays) ? entry.selectedDays : [];
    const destinationCatalogPayload = await readStore();
    const storedTours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const baseTour = publicTourById(storedTours, baseTourId, destinationCatalogPayload);
    if (!baseTour) return { ok: false, status: 404, error: "Tour not found" };

    const daySourcesByTourId = new Map();
    const nextDays = [];
    for (const selection of selectedDays) {
      const sourceTourId = normalizeText(selection?.source_tour_id);
      const sourceDayId = normalizeText(selection?.source_day_id);
      if (!sourceTourId || !sourceDayId) {
        return { ok: false, status: 400, error: "Selected days are invalid" };
      }
      if (!daySourcesByTourId.has(sourceTourId)) {
        const publicSourceTour = publicTourById(storedTours, sourceTourId, destinationCatalogPayload);
        if (!publicSourceTour) {
          return { ok: false, status: 400, error: "Selected day source is not available" };
        }
        const localizedSourceTour = await localizeMarketingTourForRead(publicSourceTour, lang);
        const localizedTravelPlan = publicTourLocalizedTravelPlan(localizedSourceTour, lang);
        daySourcesByTourId.set(sourceTourId, {
          tour: localizedSourceTour,
          travelPlan: localizedTravelPlan,
          daysById: new Map((Array.isArray(localizedTravelPlan?.days) ? localizedTravelPlan.days : [])
            .map((day) => [normalizeText(day?.id), day])
            .filter(([dayId]) => dayId))
        });
      }
      const source = daySourcesByTourId.get(sourceTourId);
      const sourceDay = source.daysById.get(sourceDayId);
      if (!sourceDay) {
        return { ok: false, status: 400, error: "Selected day is not available" };
      }
      nextDays.push({
        ...cloneJson(sourceDay),
        day_number: nextDays.length + 1
      });
    }

    if (!nextDays.length || nextDays.length > CUSTOM_ONE_PAGER_PREVIEW_MAX_DAYS) {
      return { ok: false, status: 400, error: "Select between 1 and 20 days" };
    }

    const localizedBaseTour = await localizeMarketingTourForRead(baseTour, lang);
    const readModel = normalizeTourForRead(localizedBaseTour, { lang });
    const baseTravelPlan = publicTourLocalizedTravelPlan(localizedBaseTour, lang);
    const destinationScope = mergeDestinationScopeWithTravelPlanLocations([], { days: nextDays }, destinationCatalogPayload);
    const destinations = Array.from(new Set(destinationScope.map((entry) => normalizeText(entry?.destination)).filter(Boolean)));

    return {
      ok: true,
      tour: {
        ...readModel,
        travel_plan: {
          ...baseTravelPlan,
          destination_scope: destinationScope,
          destinations,
          days: nextDays
        }
      }
    };
  }

  function travelPlanPdfBookingLikeTour(tour, lang) {
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

  async function handlePostPublicTourOnePagerPreview(req, res, [tourId]) {
    cleanupCustomOnePagerPreviewTokens();
    const baseTourId = normalizeText(tourId);
    const payload = await readBodyJson(req, { maxBytes: 64 * 1024 });
    const lang = normalizeTourLang(payload?.lang || requestLang(req.url));
    const selectedDays = selectedPreviewDayKeys(payload, baseTourId);
    if (!baseTourId || !selectedDays.length || selectedDays.length > CUSTOM_ONE_PAGER_PREVIEW_MAX_DAYS) {
      sendJson(res, 400, { error: "Select between 1 and 20 days" });
      return;
    }

    const previewCheck = await customizedPreviewTourFromTokenEntry({ baseTourId, lang, selectedDays });
    if (!previewCheck.ok) {
      sendJson(res, previewCheck.status || 400, { error: previewCheck.error || "Invalid customized tour preview" });
      return;
    }

    const token = randomUUID();
    const expiresAtMs = nowMs() + CUSTOM_ONE_PAGER_PREVIEW_TTL_MS;
    customOnePagerPreviewTokens.set(token, {
      baseTourId,
      lang,
      selectedDays,
      expiresAtMs
    });
    sendJson(res, 200, {
      token,
      pdf_url: `/public/v1/tour-preview/${encodeURIComponent(token)}.pdf?lang=${encodeURIComponent(lang)}`,
      expires_at: new Date(expiresAtMs).toISOString()
    }, { "Cache-Control": "no-store" });
  }

  async function handlePostPublicTourTravelPlanPreview(req, res, [tourId]) {
    cleanupCustomOnePagerPreviewTokens();
    if (typeof writeTravelPlanPdf !== "function") {
      sendJson(res, 503, { error: "Tour travel-plan PDF rendering is not configured" });
      return;
    }
    const baseTourId = normalizeText(tourId);
    const payload = await readBodyJson(req, { maxBytes: 64 * 1024 });
    const lang = normalizeTourLang(payload?.lang || requestLang(req.url));
    const selectedDays = selectedPreviewDayKeys(payload, baseTourId);
    if (!baseTourId || !selectedDays.length || selectedDays.length > CUSTOM_ONE_PAGER_PREVIEW_MAX_DAYS) {
      sendJson(res, 400, { error: "Select between 1 and 20 days" });
      return;
    }

    const previewCheck = await customizedPreviewTourFromTokenEntry({ baseTourId, lang, selectedDays });
    if (!previewCheck.ok) {
      sendJson(res, previewCheck.status || 400, { error: previewCheck.error || "Invalid customized tour preview" });
      return;
    }

    const token = randomUUID();
    const expiresAtMs = nowMs() + CUSTOM_ONE_PAGER_PREVIEW_TTL_MS;
    customOnePagerPreviewTokens.set(token, {
      baseTourId,
      lang,
      selectedDays,
      expiresAtMs
    });
    sendJson(res, 200, {
      token,
      pdf_url: `/public/v1/tour-preview/${encodeURIComponent(token)}/travel-plan.pdf?lang=${encodeURIComponent(lang)}`,
      expires_at: new Date(expiresAtMs).toISOString()
    }, { "Cache-Control": "no-store" });
  }

  async function handleGetPublicTourOnePagerPreviewPdf(req, res, [token]) {
    cleanupCustomOnePagerPreviewTokens();
    if (typeof writeMarketingTourOnePagerPdf !== "function") {
      sendJson(res, 503, { error: "Tour one-pager PDF rendering is not configured" });
      return;
    }
    const normalizedToken = normalizeText(token);
    const entry = customOnePagerPreviewTokens.get(normalizedToken);
    if (!entry || Number(entry.expiresAtMs || 0) <= nowMs()) {
      customOnePagerPreviewTokens.delete(normalizedToken);
      sendJson(res, 404, { error: "Tour preview expired" });
      return;
    }
    const result = await customizedPreviewTourFromTokenEntry(entry);
    if (!result.ok) {
      sendJson(res, result.status || 400, { error: result.error || "Invalid customized tour preview" });
      return;
    }

    const previewPath = path.join(TEMP_UPLOAD_DIR, `tour-one-pager-preview-${normalizedToken}.pdf`);
    let renderedPath = previewPath;
    try {
      await mkdir(path.dirname(previewPath), { recursive: true });
      const pdfResult = await writeMarketingTourOnePagerPdf(result.tour, {
        lang: normalizeTourLang(entry.lang),
        outputPath: previewPath
      });
      renderedPath = normalizeText(pdfResult?.outputPath) || previewPath;
      await sendFileWithCache(req, res, renderedPath, "private, max-age=0, no-store", {
        "Content-Disposition": `inline; filename="${tourOnePagerFilename(result.tour).replace(/"/g, "")}"`
      });
    } catch (error) {
      sendJson(res, 500, { error: "Could not render customized tour one-pager PDF", detail: String(error?.message || error) });
    } finally {
      await rm(renderedPath, { force: true }).catch(() => {});
      if (renderedPath !== previewPath) {
        await rm(previewPath, { force: true }).catch(() => {});
      }
    }
  }

  async function handleGetPublicTourTravelPlanPreviewPdf(req, res, [token]) {
    cleanupCustomOnePagerPreviewTokens();
    if (typeof writeTravelPlanPdf !== "function") {
      sendJson(res, 503, { error: "Tour travel-plan PDF rendering is not configured" });
      return;
    }
    const normalizedToken = normalizeText(token);
    const entry = customOnePagerPreviewTokens.get(normalizedToken);
    if (!entry || Number(entry.expiresAtMs || 0) <= nowMs()) {
      customOnePagerPreviewTokens.delete(normalizedToken);
      sendJson(res, 404, { error: "Tour preview expired" });
      return;
    }
    const result = await customizedPreviewTourFromTokenEntry(entry);
    if (!result.ok) {
      sendJson(res, result.status || 400, { error: result.error || "Invalid customized tour preview" });
      return;
    }

    const previewPath = path.join(TEMP_UPLOAD_DIR, `tour-travel-plan-preview-${normalizedToken}.pdf`);
    let renderedPath = previewPath;
    const lang = normalizeTourLang(entry.lang);
    try {
      await mkdir(path.dirname(previewPath), { recursive: true });
      const pdfResult = await writeTravelPlanPdf(
        travelPlanPdfBookingLikeTour(result.tour, lang),
        result.tour.travel_plan,
        {
          lang,
          outputPath: previewPath,
          includeGuideSection: false,
          includeEndingSection: false
        }
      );
      renderedPath = normalizeText(pdfResult?.outputPath) || previewPath;
      await sendFileWithCache(req, res, renderedPath, "private, max-age=0, no-store", {
        "Content-Disposition": `inline; filename="${tourTravelPlanFilename(result.tour).replace(/"/g, "")}"`
      });
    } catch (error) {
      sendJson(res, 500, { error: "Could not render customized tour travel-plan PDF", detail: String(error?.message || error) });
    } finally {
      await rm(renderedPath, { force: true }).catch(() => {});
      if (renderedPath !== previewPath) {
        await rm(previewPath, { force: true }).catch(() => {});
      }
    }
  }

  async function handleGetPublicTourOnePagerPdf(req, res, [tourId]) {
    const lang = requestLang(req.url);
    const destinationCatalogPayload = await readStore();
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const tour = tours.find((item) => item.id === tourId);
    const publicTour = tour ? normalizeTourForPublicWebpage(tour, destinationCatalogPayload) : null;
    if (!publicTour) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }
    await renderTourOnePagerPdf(req, res, publicTour, lang);
  }

  async function handleListTours(req, res) {
    const principal = getPrincipal(req);
    if (!canReadTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const lang = requestLang(req.url);
    const store = await readStore();
    const tours = await localizeMarketingToursForRead((await readTours()).map((tour) => normalizeTourForStorage(tour)), lang);
    const requestUrl = new URL(req.url, "http://localhost");
    const { items: filtered, sort, filters } = filterAndSortTours(tours, requestUrl.searchParams, lang, store);
    const paged = paginate(filtered, requestUrl.searchParams);
    const destinationOptions = Array.from(new Set(tours.flatMap((tour) => deriveTourDestinationCodesFromDayLocations(tour, store))))
      .map((code) => ({ code, label: code }));
    const options = collectTourOptions(tours, { lang, includeAllStyleCatalogEntries: true });
    sendJson(
      res,
      200,
      buildPaginatedListResponse(
        {
          ...paged,
          items: paged.items.map((tour) => {
            const readModel = normalizeTourForRead(tour, { lang });
            const destinationCodes = deriveTourDestinationCodesFromDayLocations(tour, store);
            return {
              ...readModel,
              destination_codes: destinationCodes,
              destinations: destinationCodes
            };
          })
        },
        {
          sort,
          filters,
          matrix: buildTourMatrixSummary(filtered, lang, store),
          available_destinations: destinationOptions,
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

    for (const tour of await localizeMarketingToursForRead((await readTours()).map((item) => normalizeTourForStorage(item)), lang)) {
      if (excludeTourId && tour.id === excludeTourId) continue;
      const readModel = normalizeTourForRead(tour, { lang });
      const travelPlan = normalizeMarketingTourTravelPlan(tour.travel_plan, {
        sourceLang: "en",
        contentLang: lang,
        flatLang: lang,
        flatMode: "localized",
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
          day
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
    const limit = clamp(safeInt(requestUrl.searchParams.get("limit")) || 500, 1, 500);
    const offset = clamp(safeInt(requestUrl.searchParams.get("offset")) || 0, 0, 5000);
    const rows = [];

    for (const tour of await localizeMarketingToursForRead((await readTours()).map((item) => normalizeTourForStorage(item)), lang)) {
      if (excludeTourId && tour.id === excludeTourId) continue;
      const readModel = normalizeTourForRead(tour, { lang });
      const travelPlan = normalizeMarketingTourTravelPlan(tour.travel_plan, {
        sourceLang: "en",
        contentLang: lang,
        flatLang: lang,
        flatMode: "localized",
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
            item
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
    const tours = await localizeMarketingToursForRead((await readTours()).map((tour) => normalizeTourForStorage(tour)), lang);
    const tour = tours.find((item) => item.id === tourId);
    if (!tour) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }
    const options = collectTourOptions(tours, { lang, includeAllStyleCatalogEntries: true });
    sendJson(res, 200, {
      tour: await buildLocalizedTourEditorResponse(tour, lang),
      options: {
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

    const lang = requestLang(req.url);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const tour = tours.find((item) => item.id === tourId);
    if (!tour) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }
    await renderTourOnePagerPdf(req, res, tour, lang);
  }

  async function handleGetTourTravelPlanPdf(req, res, [tourId]) {
    const principal = getPrincipal(req);
    if (!canReadTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    if (typeof writeTravelPlanPdf !== "function") {
      sendJson(res, 503, { error: "Tour travel-plan PDF rendering is not configured" });
      return;
    }

    const lang = requestLang(req.url);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const tour = tours.find((item) => item.id === tourId);
    if (!tour) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }

    const localizedTour = await localizeMarketingTourForRead(tour, lang);
    const travelPlan = normalizeMarketingTourTravelPlan(localizedTour.travel_plan, {
      sourceLang: "en",
      contentLang: lang,
      flatLang: lang,
      flatMode: "localized",
      strictReferences: false
    });
    const bookingLikeTour = travelPlanPdfBookingLikeTour(localizedTour, lang);
    const tourIdPart = normalizeText(tour?.id) || "tour";
    const previewPath = path.join(TEMP_UPLOAD_DIR, `tour-travel-plan-${tourIdPart}-${randomUUID()}.pdf`);
    let renderedPath = previewPath;
    try {
      await mkdir(path.dirname(previewPath), { recursive: true });
      const result = await writeTravelPlanPdf(bookingLikeTour, travelPlan, {
        lang,
        outputPath: previewPath,
        includeGuideSection: false,
        includeEndingSection: false
      });
      renderedPath = normalizeText(result?.outputPath) || previewPath;
      await sendFileWithCache(req, res, renderedPath, "private, max-age=0, no-store", {
        "Content-Disposition": `inline; filename="${tourTravelPlanFilename(tour).replace(/"/g, "")}"`
      });
    } catch (error) {
      sendJson(res, 500, { error: "Could not render tour travel-plan PDF", detail: String(error?.message || error) });
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

    if (!(await validateTourDestinationScope(tour.travel_plan, res))) return;

    const validationError = validateTourInput(tour, { isCreate: true, lang });
    if (validationError) {
      sendJson(res, 422, { error: validationError });
      return;
    }

    const existingTours = (await readTours()).map((item) => normalizeTourForStorage(item));
    const duplicate = findDuplicateTourTitle(existingTours, tour, tour.id);
    if (duplicate) {
      sendDuplicateTourTitle(res, duplicate);
      return;
    }

    await persistTour(tour);
    sendJson(res, 201, {
      tour: await buildLocalizedTourEditorResponse(tour, lang),
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

    const duplicate = findDuplicateTourTitle(tours, updated, updated.id);
    if (duplicate) {
      sendDuplicateTourTitle(res, duplicate);
      return;
    }

    tours[index] = updated;
    await persistTour(updated);
    sendJson(res, 200, {
      tour: await buildLocalizedTourEditorResponse(updated, lang),
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
    sendJson(res, 200, {
      tour: await buildLocalizedTourEditorResponse(updated, lang),
      homepage_assets: deferredPublicHomepageAssets("tour_travel_plan_patch", { tour_id: updated.id })
    });
  }

  async function handlePublishTours(req, res) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    await syncMarketingTourTranslationsForPublish(tours);
    const homepageAssets = await regeneratePublicHomepageAssets("tours_publish", { tour_count: tours.length });
    sendJson(res, 200, {
      published: homepageAssets?.ok !== false,
      homepage_assets: homepageAssets
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

    await syncMarketingTourTranslationsForPublish(tours);
    const homepageAssets = await regeneratePublicHomepageAssets("tour_publish", { tour_id: tour.id });
    sendJson(res, 200, {
      tour: await buildLocalizedTourEditorResponse(tour, lang),
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
      tour: await buildLocalizedTourEditorResponse(updated, lang),
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
      tour: await buildLocalizedTourEditorResponse(updated, lang),
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
      await mkdir(TEMP_UPLOAD_DIR, { recursive: true });
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
      tour: await buildLocalizedTourEditorResponse(updated, lang),
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
      tour: await buildLocalizedTourEditorResponse(updated, lang),
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
      tour: await buildLocalizedTourEditorResponse(updated, lang),
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
      tour: await buildLocalizedTourEditorResponse(updated, lang),
      homepage_assets: deferredPublicHomepageAssets("tour_video_delete", { tour_id: updated.id })
    });
  }

  return {
    handlePublicListTours,
    handleGetPublicTourOnePagerPdf,
    handlePostPublicTourOnePagerPreview,
    handleGetPublicTourOnePagerPreviewPdf,
    handlePostPublicTourTravelPlanPreview,
    handleGetPublicTourTravelPlanPreviewPdf,
    handleListTours,
    handleSearchTourTravelPlanDays,
    handleSearchTourTravelPlanServices,
    handleGetTour,
    handleGetTourTravelPlanPdf,
    handleGetTourOnePagerPdf,
    handlePublishTours,
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
