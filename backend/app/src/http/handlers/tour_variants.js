import { existsSync } from "node:fs";

export function createTourVariantHandlers(deps) {
  const {
    normalizeText,
    safeInt,
    clamp,
    readBodyJson,
    sendJson,
    readTours,
    readTourVariants,
    persistTourVariant,
    deleteTourVariant,
    normalizeTourForStorage,
    normalizeTourForRead,
    normalizeMarketingTourTravelPlan,
    collectTourOptions,
    buildPaginatedListResponse,
    paginate,
    getPrincipal,
    canReadTourVariants,
    canEditTourVariants,
    normalizeTourLang,
    tourVariantHelpers,
    nowIso,
    randomUUID,
    repoRoot,
    execFile,
    path
  } = deps;

  const TOUR_VARIANT_STALE_UPDATE_MESSAGE = "This Tour Variant was updated by someone else. Reload before saving.";
  const PUBLIC_HOMEPAGE_ASSET_GENERATOR_CANDIDATES = Object.freeze([
    path.join(repoRoot, "scripts", "assets", "generate_public_homepage_assets.mjs"),
    path.join(repoRoot, "scripts", "generate_public_homepage_assets.mjs")
  ]);
  let publicHomepageAssetGenerationQueue = Promise.resolve();

  function requestLang(reqUrl) {
    return normalizeTourLang(new URL(reqUrl, "http://localhost").searchParams.get("lang"));
  }

  function deferredPublicHomepageAssets(reason, details = {}) {
    return {
      ok: true,
      dirty: true,
      reason,
      ...details
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

  function assertExpectedTourVariantUpdatedAt(payload, currentTourVariant, res) {
    const expectedUpdatedAt = normalizeText(payload?.expected_updated_at);
    if (!expectedUpdatedAt) return true;
    const currentUpdatedAt = normalizeText(currentTourVariant?.updated_at);
    if (expectedUpdatedAt === currentUpdatedAt) return true;
    sendJson(res, 409, {
      error: TOUR_VARIANT_STALE_UPDATE_MESSAGE,
      code: "TOUR_VARIANT_REVISION_MISMATCH",
      expected_updated_at: expectedUpdatedAt,
      current_updated_at: currentUpdatedAt || null
    });
    return false;
  }

  function validateTourVariantInput(tourVariant, tours, { isCreate = false } = {}) {
    if (isCreate && !normalizeText(tourVariant?.base_marketing_tour_id)) return ["Base marketing tour is required."];
    if (!normalizeText(tourVariant?.title)) return ["Title is required."];
    if (!Array.isArray(tourVariant?.styles) || !tourVariant.styles.length) return ["At least one style is required."];
    if (!Array.isArray(tourVariant?.days) || !tourVariant.days.length) return ["At least one day is required."];
    if (tourVariant?.published_on_webpage === true) {
      const publication = tourVariantHelpers.validateTourVariantPublication(tourVariant, tours);
      if (!publication.ok) return publication.issues;
    }
    return [];
  }

  function buildBaseTourOptions(tours, { lang = "en" } = {}) {
    return (Array.isArray(tours) ? tours : [])
      .map((tour) => normalizeTourForStorage(tour))
      .filter((tour) => tour.published_on_webpage !== false)
      .map((tour) => {
        const readModel = normalizeTourForRead(tour, { lang });
        const travelPlan = normalizeMarketingTourTravelPlan(tour.travel_plan, {
          sourceLang: "en",
          contentLang: lang,
          flatLang: lang,
          flatMode: "localized",
          strictReferences: false
        });
        return {
          id: tour.id,
          title: readModel.title,
          day_count: Array.isArray(travelPlan?.days) ? travelPlan.days.length : 0,
          styles: readModel.styles,
          style_codes: readModel.style_codes
        };
      })
      .sort((left, right) => normalizeText(left.title || left.id).localeCompare(normalizeText(right.title || right.id), lang, {
        sensitivity: "base"
      }));
  }

  function buildTourVariantOptions(tours, { lang = "en" } = {}) {
    const options = collectTourOptions(tours, { lang, includeAllStyleCatalogEntries: true });
    return {
      styles: options.styles,
      base_tours: buildBaseTourOptions(tours, { lang })
    };
  }

  function filterAndSortTourVariants(tourVariants, query, lang) {
    const search = normalizeText(query.get("search")).toLowerCase();
    const published = normalizeText(query.get("published")).toLowerCase();
    const sort = normalizeText(query.get("sort")) || "updated_at_desc";
    const filtered = (Array.isArray(tourVariants) ? tourVariants : []).filter((tourVariant) => {
      if (published === "yes" && tourVariant.published_on_webpage !== true) return false;
      if (published === "no" && tourVariant.published_on_webpage === true) return false;
      if (!search) return true;
      const readModel = tourVariantHelpers.normalizeTourVariantForRead(tourVariant, { lang });
      const haystack = [
        tourVariant.id,
        readModel.title,
        readModel.short_description,
        ...(Array.isArray(readModel.styles) ? readModel.styles : []),
        ...(Array.isArray(readModel.days) ? readModel.days : []).flatMap((day) => [
          day.source_tour_id,
          day.source_day_id,
          day.source_tour_title,
          day.source_day_title
        ])
      ].map((value) => normalizeText(value).toLowerCase()).filter(Boolean).join(" ");
      return haystack.includes(search);
    });
    filtered.sort((left, right) => {
      if (sort === "title_asc") {
        const leftTitle = tourVariantHelpers.normalizeTourVariantForRead(left, { lang }).title || left.id;
        const rightTitle = tourVariantHelpers.normalizeTourVariantForRead(right, { lang }).title || right.id;
        return normalizeText(leftTitle).localeCompare(normalizeText(rightTitle), lang, { sensitivity: "base" });
      }
      if (sort === "priority_asc") {
        const priorityCompare = Number(left.priority || 50) - Number(right.priority || 50);
        if (priorityCompare) return priorityCompare;
      }
      return String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || ""));
    });
    return {
      items: filtered,
      sort,
      filters: {
        search,
        published
      }
    };
  }

  async function readStoredToursAndVariants() {
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const tourVariants = (await readTourVariants()).map((variant) => tourVariantHelpers.normalizeTourVariantForStorage(variant));
    return { tours, tourVariants };
  }

  async function handleListTourVariants(req, res) {
    const principal = getPrincipal(req);
    if (!canReadTourVariants(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const lang = requestLang(req.url);
    const requestUrl = new URL(req.url, "http://localhost");
    const { tours, tourVariants } = await readStoredToursAndVariants();
    const { items: filtered, sort, filters } = filterAndSortTourVariants(tourVariants, requestUrl.searchParams, lang);
    const paged = paginate(filtered, requestUrl.searchParams);
    sendJson(
      res,
      200,
      buildPaginatedListResponse(
        {
          ...paged,
          items: paged.items.map((variant) => tourVariantHelpers.buildTourVariantEditorResponse(variant, tours, { lang }))
        },
        {
          sort,
          filters,
          options: buildTourVariantOptions(tours, { lang })
        }
      )
    );
  }

  async function handleGetTourVariant(req, res, [tourVariantId]) {
    const principal = getPrincipal(req);
    if (!canReadTourVariants(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const lang = requestLang(req.url);
    const { tours, tourVariants } = await readStoredToursAndVariants();
    const tourVariant = tourVariants.find((item) => item.id === tourVariantId);
    if (!tourVariant) {
      sendJson(res, 404, { error: "Tour Variant not found" });
      return;
    }
    sendJson(res, 200, {
      tour_variant: tourVariantHelpers.buildTourVariantEditorResponse(tourVariant, tours, { lang }),
      options: buildTourVariantOptions(tours, { lang })
    });
  }

  async function handleCreateTourVariant(req, res) {
    const principal = getPrincipal(req);
    if (!canEditTourVariants(principal)) {
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
    const { tours } = await readStoredToursAndVariants();
    const baseTourId = normalizeText(payload?.base_marketing_tour_id);
    const baseTour = tours.find((tour) => tour.id === baseTourId);
    if (!baseTour) {
      sendJson(res, 422, { error: "Choose a published base marketing tour." });
      return;
    }
    if (baseTour.published_on_webpage === false) {
      sendJson(res, 422, { error: "Base marketing tour must be published." });
      return;
    }

    const now = nowIso();
    const seeded = tourVariantHelpers.buildTourVariantFromBaseTour(baseTour);
    const tourVariant = tourVariantHelpers.buildTourVariantPayload(payload || {}, {
      existing: seeded,
      isCreate: true,
      lang
    });
    tourVariant.id = `tour_variant_${randomUUID()}`;
    tourVariant.created_at = now;
    tourVariant.updated_at = now;

    const issues = validateTourVariantInput(tourVariant, tours, { isCreate: true });
    if (issues.length) {
      sendJson(res, 422, { error: issues[0], issues });
      return;
    }

    await persistTourVariant(tourVariant);
    sendJson(res, 201, {
      tour_variant: tourVariantHelpers.buildTourVariantEditorResponse(tourVariant, tours, { lang }),
      homepage_assets: deferredPublicHomepageAssets("tour_variant_create", { tour_variant_id: tourVariant.id })
    });
  }

  async function handlePatchTourVariant(req, res, [tourVariantId]) {
    const principal = getPrincipal(req);
    if (!canEditTourVariants(principal)) {
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
    const { tours, tourVariants } = await readStoredToursAndVariants();
    const index = tourVariants.findIndex((item) => item.id === tourVariantId);
    if (index < 0) {
      sendJson(res, 404, { error: "Tour Variant not found" });
      return;
    }
    const current = tourVariants[index];
    if (!assertExpectedTourVariantUpdatedAt(payload, current, res)) return;
    const idChange = normalizeText(payload?.id);
    if (idChange && idChange !== tourVariantId) {
      sendJson(res, 422, { error: "Tour Variant id cannot be changed" });
      return;
    }

    const updated = tourVariantHelpers.buildTourVariantPayload(payload || {}, {
      existing: current,
      isCreate: false,
      lang
    });
    updated.updated_at = nowIso();

    const issues = validateTourVariantInput(updated, tours, { isCreate: false });
    if (issues.length) {
      sendJson(res, 422, { error: issues[0], issues });
      return;
    }

    tourVariants[index] = updated;
    await persistTourVariant(updated);
    sendJson(res, 200, {
      tour_variant: tourVariantHelpers.buildTourVariantEditorResponse(updated, tours, { lang }),
      homepage_assets: deferredPublicHomepageAssets("tour_variant_patch", { tour_variant_id: updated.id })
    });
  }

  async function handleDeleteTourVariant(req, res, [tourVariantId]) {
    const principal = getPrincipal(req);
    if (!canEditTourVariants(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const { tourVariants } = await readStoredToursAndVariants();
    const tourVariant = tourVariants.find((item) => item.id === tourVariantId);
    if (!tourVariant) {
      sendJson(res, 404, { error: "Tour Variant not found" });
      return;
    }
    await deleteTourVariant(tourVariantId);
    sendJson(res, 200, {
      ok: true,
      homepage_assets: deferredPublicHomepageAssets("tour_variant_delete", { tour_variant_id: tourVariantId })
    });
  }

  async function handleListTourVariantSourceDays(req, res) {
    const principal = getPrincipal(req);
    if (!canReadTourVariants(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const lang = requestLang(req.url);
    const requestUrl = new URL(req.url, "http://localhost");
    const limit = clamp(safeInt(requestUrl.searchParams.get("limit")) || 500, 1, 1000);
    const offset = clamp(safeInt(requestUrl.searchParams.get("offset")) || 0, 0, 5000);
    const tours = (await readTours()).map((tour) => normalizeTourForStorage(tour));
    const result = tourVariantHelpers.buildSourceDayOptions(tours, {
      lang,
      query: requestUrl.searchParams.get("q"),
      limit,
      offset
    });
    sendJson(res, 200, result);
  }

  async function handlePublishTourVariants(req, res) {
    const principal = getPrincipal(req);
    if (!canEditTourVariants(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const homepageAssets = await regeneratePublicHomepageAssets("tour_variant_publish");
    sendJson(res, 200, {
      ok: homepageAssets.ok === true,
      homepage_assets: homepageAssets
    });
  }

  return {
    handleListTourVariants,
    handleGetTourVariant,
    handleCreateTourVariant,
    handlePatchTourVariant,
    handleDeleteTourVariant,
    handleListTourVariantSourceDays,
    handlePublishTourVariants
  };
}
