import { existsSync } from "node:fs";
import path from "node:path";
import {
  buildDestinationScopeCatalogResponse,
  createDestinationCatalogDestinationRecord,
  createDestinationRegionRecord,
  createDestinationPlaceRecord,
  deleteDestinationCatalogDestination,
  deleteDestinationRegion,
  deleteDestinationPlace,
  ensureDestinationScopeCatalogI18n,
  normalizeDestinationScopeCatalog,
  upsertDestinationCatalogDestination,
  upsertDestinationRegion,
  upsertDestinationPlace
} from "../../domain/destination_scope.js";

export function createDestinationScopeHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    readTours,
    persistStore,
    getPrincipal,
    canEditTours,
    normalizeText,
    nowIso,
    randomUUID,
    repoRoot,
    execFile,
    toursDir,
    tourDestinationsPath,
    translateEntriesWithMeta,
    readTranslationRules
  } = deps;

  const PUBLIC_HOMEPAGE_ASSET_GENERATOR_CANDIDATES = Object.freeze([
    path.join(repoRoot, "scripts", "assets", "generate_public_homepage_assets.mjs"),
    path.join(repoRoot, "scripts", "generate_public_homepage_assets.mjs")
  ]);
  let publicHomepageAssetGenerationQueue = Promise.resolve();

  function buildPublicHomepageAssetGeneratorEnv() {
    const env = { ...process.env };
    const normalizedToursDir = normalizeText(toursDir);
    if (normalizedToursDir) {
      env.PUBLIC_HOMEPAGE_TOURS_ROOT = normalizedToursDir;
    }
    const normalizedTourDestinationsPath = normalizeText(tourDestinationsPath);
    if (normalizedTourDestinationsPath) {
      env.TOUR_DESTINATIONS_PATH = normalizedTourDestinationsPath;
      env.PUBLIC_HOMEPAGE_DESTINATION_CATALOG_PATH = normalizedTourDestinationsPath;
    }
    return env;
  }

  async function regeneratePublicHomepageAssets(reason, details = {}) {
    const task = async () => {
      const generatorPath = PUBLIC_HOMEPAGE_ASSET_GENERATOR_CANDIDATES.find((candidate) => existsSync(candidate));
      if (!generatorPath) {
        throw new Error("Could not find generate_public_homepage_assets.mjs in expected script locations.");
      }
      await execFile(process.execPath, [generatorPath], {
        cwd: repoRoot,
        env: buildPublicHomepageAssetGeneratorEnv()
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

  async function ensureCatalogI18n(store, reason) {
    const translationRulesPayload = typeof readTranslationRules === "function"
      ? await readTranslationRules()
      : null;
    const translationRules = Array.isArray(translationRulesPayload?.items) ? translationRulesPayload.items : [];
    const result = await ensureDestinationScopeCatalogI18n(store, {
      translateEntriesWithMeta,
      translationRules,
      nowIso,
      traceId: reason
    });
    return result;
  }

  function canReadDestinationScopeCatalog(principal) {
    return Boolean(principal);
  }

  function buildLocationUsageCounts(tours, store) {
    const catalog = normalizeDestinationScopeCatalog(store);
    const regionById = new Map(catalog.regions.map((region) => [region.id, region]));
    const placeById = new Map(catalog.places.map((place) => [place.id, place]));
    const destinationCodes = new Set(catalog.destinations.map((destination) => destination.code));
    const counts = {};
    const increment = (locationId) => {
      const normalizedLocationId = normalizeText(locationId);
      if (!normalizedLocationId) return;
      counts[normalizedLocationId] = Math.max(0, Number(counts[normalizedLocationId] || 0)) + 1;
    };

    for (const tour of Array.isArray(tours) ? tours : []) {
      for (const day of Array.isArray(tour?.travel_plan?.days) ? tour.travel_plan.days : []) {
        const dayLocationIds = new Set([
          normalizeText(day?.primary_location_id),
          normalizeText(day?.secondary_location_id)
        ].filter(Boolean));
        const countedNodes = new Set();
        for (const locationId of dayLocationIds) {
          if (placeById.has(locationId)) {
            const place = placeById.get(locationId);
            const region = regionById.get(place.region_id);
            countedNodes.add(place.id);
            if (region) {
              countedNodes.add(region.id);
              countedNodes.add(region.destination);
            } else if (place.destination) {
              countedNodes.add(place.destination);
            }
            continue;
          }
          if (regionById.has(locationId)) {
            const region = regionById.get(locationId);
            countedNodes.add(region.id);
            countedNodes.add(region.destination);
            continue;
          }
          if (destinationCodes.has(locationId)) {
            countedNodes.add(locationId);
          }
        }
        for (const nodeId of countedNodes) increment(nodeId);
      }
    }
    return counts;
  }

  async function assertLocationCanBeDeleted(store, locationId, res) {
    const counts = buildLocationUsageCounts(
      typeof readTours === "function" ? await readTours() : [],
      store
    );
    const usageCount = Math.max(0, Number(counts[normalizeText(locationId)] || 0));
    if (usageCount > 0) {
      sendJson(res, 409, { error: "Location is used by travel-plan days.", usage_count: usageCount });
      return false;
    }
    return true;
  }

  function requestLang(req) {
    try {
      const requestUrl = new URL(req.url, "http://localhost");
      return normalizeText(requestUrl.searchParams.get("lang")) || "en";
    } catch {
      return "en";
    }
  }

  async function handleListDestinationScopeCatalog(req, res) {
    const principal = getPrincipal(req);
    if (!canReadDestinationScopeCatalog(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const store = await readStore();
    sendJson(res, 200, buildDestinationScopeCatalogResponse(store, { lang: requestLang(req) }));
  }

  async function handleCreateDestinationRegion(req, res) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const store = await readStore();
    const record = createDestinationRegionRecord(payload, { randomUUID, nowIso });
    if (!record.ok) {
      sendJson(res, 422, { error: record.error });
      return;
    }
    const result = upsertDestinationRegion(store, record.region);
    if (!result.ok) {
      sendJson(res, 409, { error: result.error });
      return;
    }
    store.destination_regions = result.store.destination_regions;
    const i18nResult = await ensureCatalogI18n(store, "destination_scope_region_create");
    Object.assign(store, i18nResult.store);
    await persistStore(store);
    const catalog = buildDestinationScopeCatalogResponse(store, { lang: requestLang(req) });
    const homepageAssets = await regeneratePublicHomepageAssets("destination_scope_region_create", {
      region_id: result.region.id,
      destination: result.region.destination
    });
    sendJson(res, 201, {
      region: catalog.regions.find((region) => region.id === result.region.id) || result.region,
      catalog,
      i18n: {
        ok: !i18nResult.errors.length,
        errors: i18nResult.errors
      },
      homepage_assets: homepageAssets
    });
  }

  async function handleCreateDestinationScopeDestination(req, res) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const store = await readStore();
    const record = createDestinationCatalogDestinationRecord(payload, { nowIso });
    if (!record.ok) {
      sendJson(res, 422, { error: record.error });
      return;
    }
    const result = upsertDestinationCatalogDestination(store, record.destination);
    if (!result.ok) {
      sendJson(res, 409, { error: result.error });
      return;
    }
    store.destination_scope_destinations = result.store.destination_scope_destinations;
    const i18nResult = await ensureCatalogI18n(store, "destination_scope_destination_create");
    Object.assign(store, i18nResult.store);
    await persistStore(store);
    const catalog = buildDestinationScopeCatalogResponse(store, { lang: requestLang(req) });
    const homepageAssets = await regeneratePublicHomepageAssets("destination_scope_destination_create", {
      destination: result.destination.code
    });
    sendJson(res, 201, {
      destination: catalog.destinations.find((destination) => destination.code === result.destination.code) || result.destination,
      catalog,
      i18n: {
        ok: !i18nResult.errors.length,
        errors: i18nResult.errors
      },
      homepage_assets: homepageAssets
    });
  }

  async function handleCreateDestinationPlace(req, res) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const store = await readStore();
    const record = createDestinationPlaceRecord(payload, store, { randomUUID, nowIso });
    if (!record.ok) {
      sendJson(res, 422, { error: record.error });
      return;
    }
    const result = upsertDestinationPlace(store, record.place);
    if (!result.ok) {
      sendJson(res, 409, { error: result.error });
      return;
    }
    store.destination_places = result.store.destination_places;
    const i18nResult = await ensureCatalogI18n(store, "destination_scope_place_create");
    Object.assign(store, i18nResult.store);
    await persistStore(store);
    const catalog = buildDestinationScopeCatalogResponse(store, { lang: requestLang(req) });
    const homepageAssets = await regeneratePublicHomepageAssets("destination_scope_place_create", {
      place_id: result.place.id,
      region_id: result.place.region_id
    });
    sendJson(res, 201, {
      place: catalog.places.find((place) => place.id === result.place.id) || result.place,
      catalog,
      i18n: {
        ok: !i18nResult.errors.length,
        errors: i18nResult.errors
      },
      homepage_assets: homepageAssets
    });
  }

  async function handleDeleteDestinationScopeDestination(req, res, [destination]) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const store = await readStore();
    if (!(await assertLocationCanBeDeleted(store, destination, res))) return;
    const result = deleteDestinationCatalogDestination(store, destination);
    if (!result.ok) {
      sendJson(res, /still has/i.test(result.error || "") ? 409 : 404, { error: result.error });
      return;
    }
    store.destination_scope_destinations = result.store.destination_scope_destinations;
    store.destination_regions = result.store.destination_regions;
    store.destination_places = result.store.destination_places;
    await persistStore(store);
    const catalog = buildDestinationScopeCatalogResponse(store, { lang: requestLang(req) });
    const homepageAssets = await regeneratePublicHomepageAssets("destination_scope_destination_delete", {
      destination: normalizeText(destination).toUpperCase()
    });
    sendJson(res, 200, { deleted: true, catalog, homepage_assets: homepageAssets });
  }

  async function handleDeleteDestinationRegion(req, res, [regionId]) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const store = await readStore();
    if (!(await assertLocationCanBeDeleted(store, regionId, res))) return;
    const result = deleteDestinationRegion(store, regionId);
    if (!result.ok) {
      sendJson(res, /still has/i.test(result.error || "") ? 409 : 404, { error: result.error });
      return;
    }
    store.destination_regions = result.store.destination_regions;
    store.destination_places = result.store.destination_places;
    await persistStore(store);
    const catalog = buildDestinationScopeCatalogResponse(store, { lang: requestLang(req) });
    const homepageAssets = await regeneratePublicHomepageAssets("destination_scope_region_delete", {
      region_id: result.region.id,
      destination: result.region.destination
    });
    sendJson(res, 200, { deleted: true, catalog, homepage_assets: homepageAssets });
  }

  async function handleDeleteDestinationPlace(req, res, [placeId]) {
    const principal = getPrincipal(req);
    if (!canEditTours(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const store = await readStore();
    if (!(await assertLocationCanBeDeleted(store, placeId, res))) return;
    const result = deleteDestinationPlace(store, placeId);
    if (!result.ok) {
      sendJson(res, 404, { error: result.error });
      return;
    }
    store.destination_places = result.store.destination_places;
    await persistStore(store);
    const catalog = buildDestinationScopeCatalogResponse(store, { lang: requestLang(req) });
    const homepageAssets = await regeneratePublicHomepageAssets("destination_scope_place_delete", {
      place_id: result.place.id,
      region_id: result.place.region_id
    });
    sendJson(res, 200, { deleted: true, catalog, homepage_assets: homepageAssets });
  }

  return {
    handleListDestinationScopeCatalog,
    handleCreateDestinationScopeDestination,
    handleCreateDestinationRegion,
    handleCreateDestinationPlace,
    handleDeleteDestinationScopeDestination,
    handleDeleteDestinationRegion,
    handleDeleteDestinationPlace
  };
}
