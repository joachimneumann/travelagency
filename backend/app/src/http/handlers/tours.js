export function createTourHandlers(deps) {
  const {
    normalizeText,
    normalizeStringArray,
    safeInt,
    safeFloat,
    normalizeHighlights,
    toTourImagePublicUrl,
    tourDestinations,
    readTours,
    sendJson,
    clamp,
    normalizeTourForRead,
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


function buildTourPayload(payload, { existing = null, isCreate = false } = {}) {
  const next = existing ? { ...existing } : {};

  if (isCreate || payload.id !== undefined) next.id = normalizeText(payload.id);
  if (isCreate || payload.title !== undefined) next.title = normalizeText(payload.title);
  if (payload.shortDescription !== undefined) next.shortDescription = normalizeText(payload.shortDescription);
  if (isCreate || payload.destinations !== undefined) {
    next.destinations = normalizeStringArray(payload.destinations);
  }
  if (isCreate || payload.styles !== undefined) next.styles = normalizeStringArray(payload.styles);
  if (payload.image !== undefined) next.image = toTourImagePublicUrl(payload.image);
  if (payload.seasonality_start_month !== undefined) {
    next.seasonality_start_month = normalizeText(payload.seasonality_start_month);
  }
  if (payload.seasonality_end_month !== undefined) {
    next.seasonality_end_month = normalizeText(payload.seasonality_end_month);
  }
  if (payload.highlights !== undefined || isCreate) next.highlights = normalizeHighlights(payload.highlights);

  if (payload.priority !== undefined || isCreate) {
    const priority = safeInt(payload.priority);
    next.priority = priority === null ? 50 : priority;
  }
  if (payload.travel_duration_days !== undefined || isCreate) {
    const travel_duration_days = safeInt(payload.travel_duration_days);
    next.travel_duration_days = travel_duration_days === null ? 0 : travel_duration_days;
  }
  if (payload.budget_lower_USD !== undefined || isCreate) {
    const budget_lower_USD = safeInt(payload.budget_lower_USD);
    next.budget_lower_USD = budget_lower_USD === null ? 0 : budget_lower_USD;
  }
  if (payload.rating !== undefined || isCreate) {
    const rating = safeFloat(payload.rating);
    next.rating = rating === null ? 0 : rating;
  }

  return next;
}

function validateTourInput(tour, { isCreate = false } = {}) {
  if (isCreate && !tour.title) return "title is required";
  if (isCreate && !tourDestinations(tour).length) return "destinations is required";
  if (isCreate && (!Array.isArray(tour.styles) || !tour.styles.length)) return "styles is required";
  return "";
}

function filterAndSortTours(tours, query) {
  const search = normalizeText(query.get("search")).toLowerCase();
  const destination = normalizeText(query.get("destination"));
  const style = normalizeText(query.get("style"));
  const sort = normalizeText(query.get("sort")) || "updated_at_desc";

  const filtered = tours.filter((tour) => {
    const destinationMatch = !destination || tourDestinations(tour).includes(destination);
    const styleMatch = !style || (Array.isArray(tour.styles) && tour.styles.includes(style));
    if (!destinationMatch || !styleMatch) return false;
    if (!search) return true;
    const haystack = [
      tour.id,
      tour.title,
      tour.shortDescription,
      ...tourDestinations(tour),
      ...(Array.isArray(tour.highlights) ? tour.highlights : []),
      ...(Array.isArray(tour.styles) ? tour.styles : [])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });

  const items = [...filtered].sort((a, b) => {
    if (sort === "title_asc") return String(a.title || "").localeCompare(String(b.title || ""));
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
  const tours = await readTours();
  const requestUrl = new URL(req.url, "http://localhost");
  const destination = normalizeText(requestUrl.searchParams.get("destination"));
  const style = normalizeText(requestUrl.searchParams.get("style"));
  const offset = Math.max(0, safeInt(requestUrl.searchParams.get("offset")) || 0);
  const limit = clamp(safeInt(requestUrl.searchParams.get("limit")) || tours.length || 1000, 1, 5000);

  const filtered = tours.filter((tour) => {
    const destinationMatch = !destination || tourDestinations(tour).includes(destination);
    const styleMatch = !style || (Array.isArray(tour.styles) && tour.styles.includes(style));
    return destinationMatch && styleMatch;
  });

  const sorted = [...filtered].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  const items = sorted.slice(offset, offset + limit).map(normalizeTourForRead);
  const payload = {
    items,
    pagination: {
      page: Math.floor(offset / limit) + 1,
      page_size: limit,
      pageSize: limit,
      total_items: filtered.length,
      totalItems: filtered.length,
      total_pages: Math.max(1, Math.ceil(filtered.length / limit))
    },
    total: filtered.length,
    offset,
    limit
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
  const tours = await readTours();
  const requestUrl = new URL(req.url, "http://localhost");
  const { items: filtered, sort, filters } = filterAndSortTours(tours, requestUrl.searchParams);
  const paged = paginate(filtered, requestUrl.searchParams);
  const options = collectTourOptions(tours);
  sendJson(
    res,
    200,
    buildPaginatedListResponse(
      {
        ...paged,
        items: paged.items.map(normalizeTourForRead)
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
  const tours = await readTours();
  const tour = tours.find((item) => item.id === tourId);
  if (!tour) {
    sendJson(res, 404, { error: "Tour not found" });
    return;
  }
  const options = collectTourOptions(tours);
  sendJson(res, 200, {
    tour: normalizeTourForRead(tour),
    options: {
      destinations: options.destinations,
      styles: options.styles
    }
  });
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

  const now = nowIso();
  const tour = buildTourPayload(payload, { isCreate: true });
  tour.id = `tour_${randomUUID()}`;
  tour.image = toTourImagePublicUrl(tour.image);
  tour.created_at = now;
  tour.updated_at = now;

  const validationError = validateTourInput(tour, { isCreate: true });
  if (validationError) {
    sendJson(res, 422, { error: validationError });
    return;
  }

  await persistTour(tour);
  sendJson(res, 201, { tour: normalizeTourForRead(tour) });
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

  const tours = await readTours();
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

  const updated = buildTourPayload(payload, { existing: current, isCreate: false });
  updated.updated_at = nowIso();

  const validationError = validateTourInput(updated, { isCreate: false });
  if (validationError) {
    sendJson(res, 422, { error: validationError });
    return;
  }

  tours[index] = updated;
  await persistTour(updated);
  sendJson(res, 200, { tour: normalizeTourForRead(updated) });
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

  const filename = normalizeText(payload.filename) || `${tourId}.upload`;
  const base64 = normalizeText(payload.data_base64);
  if (!base64) {
    sendJson(res, 422, { error: "data_base64 is required" });
    return;
  }

  const tours = await readTours();
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

  sendJson(res, 200, { tour: normalizeTourForRead(updated) });
}


  return {
    handlePublicListTours,
    handleListTours,
    handleGetTour,
    handleCreateTour,
    handlePatchTour,
    handlePublicTourImage,
    handleUploadTourImage
  };
}
