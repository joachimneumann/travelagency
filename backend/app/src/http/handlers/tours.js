import {
  validateBookingTourApplyRequest,
  validateTourTranslateFieldsRequest,
  validateTourTravelPlanUpdateRequest,
  validateTravelPlanServiceImageDeleteRequest,
  validateTravelPlanServiceImageUploadRequest
} from "../../../Generated/API/generated_APIModels.js";
import { existsSync } from "node:fs";
import { execImageMagick } from "../../lib/imagemagick.js";
import {
  DESTINATION_COUNTRY_CODES,
  DESTINATION_COUNTRY_TO_TOUR_DESTINATION_CODE,
  TOUR_DESTINATION_TO_COUNTRY_CODE
} from "../../../../../shared/js/destination_country_codes.js";
import {
  findTravelPlanDayAndItem,
  normalizeItemImageRef,
  publicBookingImagePath
} from "./booking_travel_plan_shared.js";

export function createTourHandlers(deps) {
  const {
    normalizeText,
    normalizeStringArray,
    safeInt,
    toTourImagePublicUrl,
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

  function requestLang(reqUrl) {
    return normalizeTourLang(new URL(reqUrl, "http://localhost").searchParams.get("lang"));
  }

  function normalizeDestinationCodes(values) {
    return tourDestinationCodes({ destinations: normalizeStringArray(values) });
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
    if (isCreate || payload.destinations !== undefined) {
      next.destinations = normalizeDestinationCodes(payload.destinations);
    }
    if (isCreate || payload.styles !== undefined) next.styles = normalizeStyleCodes(payload.styles);
    if (payload.pictures !== undefined) {
      next.pictures = Array.from(
        new Set(
          (Array.isArray(payload.pictures) ? payload.pictures : [])
            .map((value) => toTourImagePublicUrl(value))
            .filter(Boolean)
        )
      );
    }
    if (payload.image !== undefined) next.image = toTourImagePublicUrl(payload.image);
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

    return normalizeTourForStorage(next);
  }

  function validateTourInput(tour, { isCreate = false, lang = "en" } = {}) {
    if (isCreate && !resolveLocalizedText(tour?.title, lang)) return "title is required";
    if (isCreate && !normalizeDestinationCodes(tour?.destinations).length) return "destinations is required";
    if (isCreate && !normalizeStyleCodes(tour?.styles).length) return "styles is required";
    return "";
  }

  function filterAndSortTours(tours, query, lang) {
    const search = normalizeText(query.get("search")).toLowerCase();
    const destination = normalizeTourDestinationCode(query.get("destination"));
    const style = normalizeTourStyleCode(query.get("style"));
    const sort = normalizeText(query.get("sort")) || "updated_at_desc";

    const filtered = tours.filter((tour) => {
      const destinationCodes = tourDestinationCodes(tour);
      const styleCodes = tourStyleCodes(tour);
      const destinationMatch = !destination || destinationCodes.includes(destination);
      const styleMatch = !style || styleCodes.includes(style);
      if (!destinationMatch || !styleMatch) return false;
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

    const items = [...filtered].sort((a, b) => {
      if (sort === "title_asc") {
        return String(normalizeTourForRead(a, { lang }).title || "").localeCompare(String(normalizeTourForRead(b, { lang }).title || ""));
      }
      return String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""));
    });

    return {
      items,
      sort,
      filters: {
        destination: destination || null,
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

  function tourPictureName(value) {
    const normalized = normalizeText(value);
    if (!normalized) return "";
    const withoutQuery = normalized.split("?")[0];
    const trimmed = withoutQuery.replace(/\/+$/, "");
    return decodeURIComponent(trimmed.split("/").pop() || "");
  }

  function tourPictureRelativePath(value, tourId) {
    const normalizedTourId = normalizeText(tourId);
    if (!normalizedTourId) return "";
    const normalized = normalizeText(value);
    if (!normalized) return "";
    const withoutQuery = normalized.split("?")[0];
    const publicPrefix = `/public/v1/tour-images/${normalizedTourId}/`;
    if (withoutQuery.startsWith(publicPrefix)) {
      return `${normalizedTourId}/${withoutQuery.slice(publicPrefix.length).replace(/^\/+/, "")}`;
    }
    const bareValue = withoutQuery.replace(/^\/+/, "");
    if (bareValue.startsWith(`${normalizedTourId}/`)) return bareValue;
    return "";
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
    const visibleDestinations = tourDestinationCodes(stored).filter((code) => publishedDestinationCodes.has(code));
    if (!visibleDestinations.length) return null;
    return {
      ...stored,
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
      const translatedEntries = await translateEntries(entries, targetLang, {
        sourceLangCode: sourceLang,
        domain: "tour marketing copy",
        allowGoogleFallback: true,
        traceId
      });
      logTourTranslationTiming("Request finished", {
        trace_id: traceId,
        source_lang: sourceLang,
        target_lang: targetLang,
        translated_entry_count: Object.keys(translatedEntries || {}).length,
        duration_ms: durationMs(requestStartMs)
      });
      sendJson(res, 200, {
        source_lang: sourceLang,
        target_lang: targetLang,
        entries: translationEntriesFromObject(translatedEntries)
      });
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

    await persistTour(tour);
    const homepageAssets = await regeneratePublicHomepageAssets("tour_create", { tour_id: tour.id });
    sendJson(res, 201, {
      tour: buildTourEditorResponse(tour, lang),
      homepage_assets: homepageAssets
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

    tours[index] = updated;
    await persistTour(updated);
    const homepageAssets = await regeneratePublicHomepageAssets("tour_patch", { tour_id: updated.id });
    sendJson(res, 200, {
      tour: buildTourEditorResponse(updated, lang),
      homepage_assets: homepageAssets
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

    const check = validateMarketingTourTravelPlanInput(payload.travel_plan);
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
    const homepageAssets = await regeneratePublicHomepageAssets("tour_travel_plan_patch", { tour_id: updated.id });
    sendJson(res, 200, {
      tour: buildTourEditorResponse(updated, lang),
      homepage_assets: homepageAssets
    });
  }

  function cloneJson(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function bookingDestinationCodesFromTour(tour) {
    return Array.from(
      new Set(
        tourDestinationCodes(tour)
          .map((code) => TOUR_DESTINATION_TO_COUNTRY_CODE[code] || normalizeText(code).toUpperCase())
          .filter((code) => DESTINATION_COUNTRY_CODES.includes(code))
      )
    );
  }

  async function copyTourServiceImageToBooking(image, { tourId, bookingId, serviceId, createdAt }) {
    const sourceImage = image && typeof image === "object" && !Array.isArray(image) ? image : null;
    const sourcePath = resolveTourServiceImageDiskPath(sourceImage?.storage_path, tourId);
    if (!sourceImage || !sourcePath || !existsSync(sourcePath)) return null;
    const outputName = `${serviceId}-${Date.now()}-${randomUUID()}.webp`;
    const outputRelativePath = `${bookingId}/travel-plan-services/${outputName}`;
    const outputPath = path.join(BOOKING_IMAGES_DIR, outputRelativePath);
    try {
      await processTourImageToWebp(sourcePath, outputPath);
    } catch (error) {
      console.warn("[tour-apply] Could not copy tour service image into booking storage.", {
        tour_id: tourId,
        booking_id: bookingId,
        service_id: serviceId,
        source_path: sourcePath,
        error: String(error?.message || error)
      });
      return null;
    }
    return normalizeItemImageRef({
      ...cloneJson(sourceImage),
      id: `travel_plan_service_image_${randomUUID()}`,
      storage_path: publicBookingImagePath(normalizeText, outputRelativePath),
      sort_order: 0,
      is_primary: true,
      is_customer_visible: true,
      created_at: normalizeText(sourceImage.created_at) || createdAt
    });
  }

  async function cloneMarketingTourTravelPlanForBooking(tour, booking) {
    const normalized = normalizeMarketingTourTravelPlan(tour?.travel_plan);
    const createdAt = nowIso();
    const bookingId = normalizeText(booking?.id);
    return {
      destinations: bookingDestinationCodesFromTour(tour),
      days: await Promise.all((Array.isArray(normalized.days) ? normalized.days : []).map(async (day, dayIndex) => {
        const nextDay = {
          ...cloneJson(day),
          id: `travel_plan_day_${randomUUID()}`,
          day_number: dayIndex + 1,
          date: null,
          date_string: null,
          copied_from: null
        };
        nextDay.services = await Promise.all((Array.isArray(day.services) ? day.services : []).map(async (service) => {
          const nextServiceId = `travel_plan_service_${randomUUID()}`;
          const nextImage = await copyTourServiceImageToBooking(service?.image, {
            tourId: tour.id,
            bookingId,
            serviceId: nextServiceId,
            createdAt
          });
          return {
            ...cloneJson(service),
            id: nextServiceId,
            details: null,
            details_i18n: {},
            copied_from: null,
            image: nextImage
          };
        }));
        return nextDay;
      })),
      attachments: []
    };
  }

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

    const nextTravelPlan = await cloneMarketingTourTravelPlanForBooking(tour, booking);
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
    const homepageAssets = await regeneratePublicHomepageAssets("tour_travel_plan_service_image_upload", { tour_id: updated.id });
    sendJson(res, 200, {
      tour: buildTourEditorResponse(updated, lang),
      homepage_assets: homepageAssets
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
    const homepageAssets = await regeneratePublicHomepageAssets("tour_travel_plan_service_image_delete", { tour_id: updated.id });
    sendJson(res, 200, {
      tour: buildTourEditorResponse(updated, lang),
      homepage_assets: homepageAssets
    });
  }

  async function handleUploadTourPicture(req, res, [tourId]) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    let payload;
    try {
      payload = await readBodyJson(req, { maxBytes: IMAGE_UPLOAD_BODY_MAX_BYTES });
    } catch (error) {
      sendJson(res, error?.statusCode || 400, { error: error?.message || "Invalid JSON payload" });
      return;
    }

    const lang = requestLang(req.url);
    const filename = normalizeText(payload.filename) || `${tourId}.upload`;
    const base64 = normalizeText(payload.data_base64);
    if (!base64) {
      sendJson(res, 422, { error: "data_base64 is required" });
      return;
    }

    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const index = tours.findIndex((item) => item.id === tourId);
    if (index < 0) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }

    const now = nowIso();
    const sourceBuffer = Buffer.from(base64, "base64");
    if (!sourceBuffer.length) {
      sendJson(res, 422, { error: "Invalid base64 image payload" });
      return;
    }

    const tempInputPath = path.join(TEMP_UPLOAD_DIR, `${tourId}-${randomUUID()}${path.extname(filename) || ".upload"}`);
    const outputName = `picture-${randomUUID()}.webp`;
    const outputRelativePath = `${tourId}/${outputName}`;
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

    const publicPath = `/public/v1/tour-images/${outputRelativePath}`;
    const current = normalizeTourForStorage(tours[index]);
    const updated = normalizeTourForStorage({
      ...current,
      pictures: [...current.pictures, publicPath],
      updated_at: now
    });
    tours[index] = updated;
    await persistTour(updated);
    const homepageAssets = await regeneratePublicHomepageAssets("tour_image_upload", { tour_id: updated.id });

    sendJson(res, 200, {
      tour: buildTourEditorResponse(updated, lang),
      homepage_assets: homepageAssets
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
    const homepageAssets = await regeneratePublicHomepageAssets("tour_video_upload", { tour_id: updated.id });

    sendJson(res, 200, {
      tour: buildTourEditorResponse(updated, lang),
      homepage_assets: homepageAssets
    });
  }

  async function handleDeleteTourPicture(req, res, [tourId, rawPictureName]) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const pictureName = normalizeText(decodeURIComponent(rawPictureName || ""));
    if (!pictureName) {
      sendJson(res, 422, { error: "picture_name is required" });
      return;
    }
    const safePictureName = path.basename(pictureName);
    if (safePictureName !== pictureName) {
      sendJson(res, 422, { error: "picture_name is invalid" });
      return;
    }

    const lang = requestLang(req.url);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const index = tours.findIndex((item) => item.id === tourId);
    if (index < 0) {
      sendJson(res, 404, { error: "Tour not found" });
      return;
    }

    const current = normalizeTourForStorage(tours[index]);
    const retainedPictures = current.pictures.filter((picture) => tourPictureName(picture) !== pictureName);
    const removedPicture = current.pictures.find((picture) => tourPictureName(picture) === pictureName) || "";
    let updated = current;
    if (retainedPictures.length !== current.pictures.length) {
      updated = normalizeTourForStorage({
        ...current,
        pictures: retainedPictures,
        updated_at: nowIso()
      });
      tours[index] = updated;
      await persistTour(updated);
    }

    const relativePath = tourPictureRelativePath(removedPicture, tourId) || `${tourId}/${safePictureName}`;
    await rm(path.join(TOURS_DIR, relativePath), { force: true }).catch(() => {});

    const homepageAssets = await regeneratePublicHomepageAssets("tour_picture_delete", {
      tour_id: updated.id,
      picture_name: safePictureName
    });

    sendJson(res, 200, {
      tour: buildTourEditorResponse(updated, lang),
      homepage_assets: homepageAssets
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
    const homepageAssets = await regeneratePublicHomepageAssets("tour_video_delete", { tour_id: updated.id });

    sendJson(res, 200, {
      tour: buildTourEditorResponse(updated, lang),
      homepage_assets: homepageAssets
    });
  }

  return {
    handlePublicListTours,
    handleListTours,
    handleGetTour,
    handleTranslateTourFields,
    handleCreateTour,
    handlePatchTour,
    handlePatchTourTravelPlan,
    handleUploadTourTravelPlanServiceImage,
    handleDeleteTourTravelPlanServiceImage,
    handleApplyTourToBooking,
    handleDeleteTour,
    handleGetTourVideo,
    handlePublicTourImage,
    handleUploadTourPicture,
    handleDeleteTourPicture,
    handleUploadTourVideo,
    handleDeleteTourVideo
  };
}
