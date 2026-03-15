export function createTourHandlers(deps) {
  const {
    normalizeText,
    normalizeStringArray,
    safeInt,
    safeFloat,
    toTourImagePublicUrl,
    tourDestinationCodes,
    tourStyleCodes,
    readTours,
    sendJson,
    clamp,
    normalizeTourForRead,
    normalizeTourForStorage,
    resolveLocalizedText,
    setLocalizedTextForLang,
    setLocalizedStringArrayForLang,
    translateEntries,
    normalizeTourLang,
    normalizeTourDestinationCode,
    normalizeTourStyleCode,
    createHash,
    getPrincipal,
    canReadTours,
    paginate,
    collectTourOptions,
    buildPaginatedListResponse,
    canEditTours,
    readBodyJson,
    nowIso,
    randomUUID,
    persistTour,
    resolveTourImageDiskPath,
    sendFileWithCache,
    mkdir,
    path,
    execFile,
    TEMP_UPLOAD_DIR,
    TOURS_DIR,
    writeFile,
    rm
  } = deps;

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
      short_description_i18n: localizedTextareaMap(stored.short_description),
      highlights_i18n: localizedTextareaMap(stored.highlights, { multiline: true })
    };
  }

  function buildTourPayload(payload, { existing = null, isCreate = false, lang = "en" } = {}) {
    const current = existing ? normalizeTourForStorage(existing) : {};
    const next = { ...current };

    if (isCreate || payload.id !== undefined) next.id = normalizeText(payload.id) || next.id;
    if (isCreate || payload.title !== undefined) next.title = setLocalizedTextForLang(current.title, payload.title, lang);
    if (payload.short_description_i18n !== undefined) {
      next.short_description = payload.short_description_i18n;
    } else if (payload.short_description !== undefined) {
      next.short_description = setLocalizedTextForLang(current.short_description, payload.short_description, lang);
    }
    if (isCreate || payload.destinations !== undefined) {
      next.destinations = normalizeDestinationCodes(payload.destinations);
    }
    if (isCreate || payload.styles !== undefined) next.styles = normalizeStyleCodes(payload.styles);
    if (payload.image !== undefined) next.image = toTourImagePublicUrl(payload.image);
    if (payload.seasonality_start_month !== undefined) {
      next.seasonality_start_month = normalizeText(payload.seasonality_start_month);
    }
    if (payload.seasonality_end_month !== undefined) {
      next.seasonality_end_month = normalizeText(payload.seasonality_end_month);
    }
    if (payload.highlights_i18n !== undefined) {
      next.highlights = payload.highlights_i18n;
    } else if (payload.highlights !== undefined || isCreate) {
      next.highlights = setLocalizedStringArrayForLang(current.highlights, payload.highlights, lang);
    }

    if (payload.priority !== undefined || isCreate) {
      const priority = safeInt(payload.priority);
      next.priority = priority === null ? 50 : priority;
    }
    if (payload.travel_duration_days !== undefined || isCreate) {
      const travelDurationDays = safeInt(payload.travel_duration_days);
      next.travel_duration_days = travelDurationDays === null ? 0 : travelDurationDays;
    }
    if (payload.budget_lower_usd !== undefined || isCreate) {
      const budgetLowerUsd = safeInt(payload.budget_lower_usd);
      next.budget_lower_usd = budgetLowerUsd === null ? 0 : budgetLowerUsd;
    }
    if (payload.rating !== undefined || isCreate) {
      const rating = safeFloat(payload.rating);
      next.rating = rating === null ? 0 : rating;
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
        ...styleCodes,
        ...(Array.isArray(readModel.highlights) ? readModel.highlights : [])
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

  async function handlePublicListTours(req, res) {
    const lang = requestLang(req.url);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
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
    const payloadText = JSON.stringify(payload);
    const etag = `W/"${createHash("sha1").update(payloadText).digest("hex")}"`;
    const ifNoneMatch = normalizeText(req.headers["if-none-match"]);

    const cacheHeaders = {
      "Cache-Control": "public, max-age=120, stale-while-revalidate=600, must-revalidate",
      ETag: etag
    };

    if (ifNoneMatch === etag) {
      res.writeHead(304, cacheHeaders);
      res.end();
      return;
    }

    sendJson(res, 200, payload, cacheHeaders);
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
    const options = collectTourOptions(tours, { lang });
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
    const options = collectTourOptions(tours, { lang });
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
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const sourceLang = normalizeTourLang(payload?.source_lang || "en");
    const targetLang = normalizeTourLang(payload?.target_lang || "en");
    const entries = payload?.entries && typeof payload.entries === "object" && !Array.isArray(payload.entries)
      ? Object.fromEntries(
          Object.entries(payload.entries)
            .map(([key, value]) => [normalizeText(key), normalizeText(value)])
            .filter(([key, value]) => Boolean(key && value))
        )
      : {};

    if (!Object.keys(entries).length) {
      sendJson(res, 422, { error: "At least one source field is required." });
      return;
    }

    if (sourceLang === targetLang) {
      sendJson(res, 200, { source_lang: sourceLang, target_lang: targetLang, entries });
      return;
    }

    try {
      const translatedEntries = await translateEntries(entries, targetLang, {
        sourceLangCode: sourceLang,
        domain: "tour marketing copy",
        allowGoogleFallback: true
      });
      sendJson(res, 200, {
        source_lang: sourceLang,
        target_lang: targetLang,
        entries: translatedEntries
      });
    } catch (error) {
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
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const lang = requestLang(req.url);
    const now = nowIso();
    const tour = buildTourPayload(payload, { isCreate: true, lang });
    tour.id = `tour_${randomUUID()}`;
    tour.image = toTourImagePublicUrl(tour.image);
    tour.created_at = now;
    tour.updated_at = now;

    const validationError = validateTourInput(tour, { isCreate: true, lang });
    if (validationError) {
      sendJson(res, 422, { error: validationError });
      return;
    }

    await persistTour(tour);
    sendJson(res, 201, { tour: buildTourEditorResponse(tour, lang) });
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
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
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
    sendJson(res, 200, { tour: buildTourEditorResponse(updated, lang) });
  }

  async function handlePublicTourImage(req, res, [rawRelativePath]) {
    const absolutePath = resolveTourImageDiskPath(rawRelativePath);
    if (!absolutePath) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    await sendFileWithCache(req, res, absolutePath, "public, max-age=31536000, immutable");
  }

  async function processTourImageToWebp(inputPath, outputPath) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await execFile("magick", [
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

  async function handleUploadTourImage(req, res, [tourId]) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
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
    const outputName = `${tourId}.webp`;
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
    const updated = {
      ...tours[index],
      image: publicPath,
      updated_at: now
    };
    tours[index] = updated;
    await persistTour(updated);

    sendJson(res, 200, { tour: normalizeTourForRead(updated, { lang }) });
  }

  return {
    handlePublicListTours,
    handleListTours,
    handleGetTour,
    handleTranslateTourFields,
    handleCreateTour,
    handlePatchTour,
    handlePublicTourImage,
    handleUploadTourImage
  };
}
