import { existsSync } from "node:fs";
import path from "node:path";
import {
  buildDestinationScopeCatalogResponse,
  createDestinationCatalogDestinationRecord,
  createDestinationAreaRecord,
  createDestinationPlaceRecord,
  upsertDestinationCatalogDestination,
  upsertDestinationArea,
  upsertDestinationPlace
} from "../../domain/destination_scope.js";

export function createDestinationScopeHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    persistStore,
    getPrincipal,
    canEditTours,
    normalizeText,
    nowIso,
    randomUUID,
    repoRoot,
    execFile,
    dataPath,
    toursDir
  } = deps;

  const PUBLIC_HOMEPAGE_ASSET_GENERATOR_CANDIDATES = Object.freeze([
    path.join(repoRoot, "scripts", "assets", "generate_public_homepage_assets.mjs"),
    path.join(repoRoot, "scripts", "generate_public_homepage_assets.mjs")
  ]);
  let publicHomepageAssetGenerationQueue = Promise.resolve();

  function buildPublicHomepageAssetGeneratorEnv() {
    const env = { ...process.env };
    const normalizedDataPath = normalizeText(dataPath);
    const normalizedToursDir = normalizeText(toursDir);
    if (normalizedDataPath) {
      env.STORE_FILE = normalizedDataPath;
      env.PUBLIC_HOMEPAGE_STORE_PATH = normalizedDataPath;
    }
    if (normalizedToursDir) {
      env.PUBLIC_HOMEPAGE_TOURS_ROOT = normalizedToursDir;
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

  function canReadDestinationScopeCatalog(principal) {
    return Boolean(principal);
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

  async function handleCreateDestinationArea(req, res) {
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
    const record = createDestinationAreaRecord(payload, { randomUUID, nowIso });
    if (!record.ok) {
      sendJson(res, 422, { error: record.error });
      return;
    }
    const result = upsertDestinationArea(store, record.area);
    if (!result.ok) {
      sendJson(res, 409, { error: result.error });
      return;
    }
    store.destination_areas = result.store.destination_areas;
    await persistStore(store);
    const catalog = buildDestinationScopeCatalogResponse(store, { lang: requestLang(req) });
    const homepageAssets = await regeneratePublicHomepageAssets("destination_scope_area_create", {
      area_id: result.area.id,
      destination: result.area.destination
    });
    sendJson(res, 201, {
      area: catalog.areas.find((area) => area.id === result.area.id) || result.area,
      catalog,
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
    await persistStore(store);
    const catalog = buildDestinationScopeCatalogResponse(store, { lang: requestLang(req) });
    const homepageAssets = await regeneratePublicHomepageAssets("destination_scope_destination_create", {
      destination: result.destination.code
    });
    sendJson(res, 201, {
      destination: catalog.destinations.find((destination) => destination.code === result.destination.code) || result.destination,
      catalog,
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
    await persistStore(store);
    const catalog = buildDestinationScopeCatalogResponse(store, { lang: requestLang(req) });
    const homepageAssets = await regeneratePublicHomepageAssets("destination_scope_place_create", {
      place_id: result.place.id,
      area_id: result.place.area_id
    });
    sendJson(res, 201, {
      place: catalog.places.find((place) => place.id === result.place.id) || result.place,
      catalog,
      homepage_assets: homepageAssets
    });
  }

  return {
    handleListDestinationScopeCatalog,
    handleCreateDestinationScopeDestination,
    handleCreateDestinationArea,
    handleCreateDestinationPlace
  };
}
