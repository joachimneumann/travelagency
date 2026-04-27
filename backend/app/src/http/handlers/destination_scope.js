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
    randomUUID
  } = deps;

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
    sendJson(res, 201, {
      area: catalog.areas.find((area) => area.id === result.area.id) || result.area,
      catalog
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
    sendJson(res, 201, {
      destination: catalog.destinations.find((destination) => destination.code === result.destination.code) || result.destination,
      catalog
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
    sendJson(res, 201, {
      place: catalog.places.find((place) => place.id === result.place.id) || result.place,
      catalog
    });
  }

  return {
    handleListDestinationScopeCatalog,
    handleCreateDestinationScopeDestination,
    handleCreateDestinationArea,
    handleCreateDestinationPlace
  };
}
