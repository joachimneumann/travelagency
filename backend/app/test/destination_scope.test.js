import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDestinationScopeCatalogResponse,
  createDestinationCatalogDestinationRecord,
  createDestinationRegionRecord,
  createDestinationPlaceRecord,
  deleteDestinationCatalogDestination,
  deleteDestinationRegion,
  deleteDestinationPlace,
  deriveDestinationScopeFromTravelPlanLocations,
  destinationScopeDestinations,
  destinationScopeTourDestinations,
  ensureDestinationScopeCatalogI18n,
  mergeDestinationScopeWithTravelPlanLocations,
  normalizeDestinationScope,
  normalizeTravelPlanDestinationScope,
  upsertDestinationCatalogDestination,
  upsertDestinationRegion,
  upsertDestinationPlace,
  validateDestinationScopeAgainstCatalog,
  validateTravelPlanDayLocationIdsAgainstCatalog,
  withDerivedDestinationsFromScope
} from "../src/domain/destination_scope.js";

const fixedNow = "2026-04-27T00:00:00.000Z";

function idFactory(...ids) {
  const values = [...ids];
  return () => values.shift() || "fallback_id";
}

test("destination scope ignores legacy destination fields unless scope is explicit", () => {
  const scope = normalizeDestinationScope([
    { destination: "thailand" },
    { destination: "VN" },
    { destination: "vietnam" },
    { destination: "KH" }
  ]);

  assert.deepEqual(scope, [
    { destination: "VN", regions: [], places: [] },
    { destination: "TH", regions: [], places: [] },
    { destination: "KH", regions: [], places: [] }
  ]);
  assert.deepEqual(destinationScopeDestinations(scope), ["VN", "TH", "KH"]);
  assert.deepEqual(destinationScopeTourDestinations(scope), ["vietnam", "thailand", "cambodia"]);
  assert.deepEqual(
    normalizeTravelPlanDestinationScope({ destinations: ["vietnam"] }),
    []
  );
  assert.deepEqual(
    withDerivedDestinationsFromScope({ destinations: ["vietnam"] }).destinations,
    []
  );
  assert.deepEqual(
    withDerivedDestinationsFromScope({ destination_scope: [], destinations: [] }, ["Thailand"]).destinations,
    []
  );
});

test("destination region and place catalog validates selected scope", () => {
  let store = {};
  const regionRecord = createDestinationRegionRecord(
    { destination: "Vietnam", name: "Central" },
    { randomUUID: idFactory("region_uuid"), nowIso: () => fixedNow }
  );
  assert.equal(regionRecord.ok, true);

  const regionResult = upsertDestinationRegion(store, regionRecord.region);
  assert.equal(regionResult.ok, true);
  store = regionResult.store;

  const placeRecord = createDestinationPlaceRecord(
    { region_id: regionResult.region.id, name: "Hoi An", latitude: 15.8801, longitude: 108.338, map_zoom: 12 },
    store,
    { randomUUID: idFactory("place_uuid"), nowIso: () => fixedNow }
  );
  assert.equal(placeRecord.ok, true);

  const placeResult = upsertDestinationPlace(store, placeRecord.place);
  assert.equal(placeResult.ok, true);
  store = placeResult.store;

  const catalog = buildDestinationScopeCatalogResponse(store, { lang: "en" });
  assert.deepEqual(
    { code: catalog.destinations[0].code, label: catalog.destinations[0].label },
    { code: "VN", label: "Vietnam" }
  );
  assert.equal(catalog.regions[0].id, "region_region_uuid");
  assert.equal(catalog.regions[0].label, "Central");
  assert.equal(catalog.regions[0].latitude, undefined);
  assert.equal(catalog.regions[0].longitude, undefined);
  assert.equal(catalog.regions[0].map_zoom, undefined);
  assert.equal(catalog.places[0].id, "place_place_uuid");
  assert.equal(catalog.places[0].label, "Hoi An");
  assert.equal(catalog.places[0].latitude, 15.8801);
  assert.equal(catalog.places[0].longitude, 108.338);
  assert.equal(catalog.places[0].map_zoom, 12);

  const valid = validateDestinationScopeAgainstCatalog([
    {
      destination: "VN",
      places: [],
      regions: [
        {
          region_id: regionResult.region.id,
          places: [{ place_id: placeResult.place.id }]
        }
      ]
    }
  ], store);
  assert.equal(valid.ok, true);

  const invalid = validateDestinationScopeAgainstCatalog([
    {
      destination: "TH",
      regions: [{ region_id: regionResult.region.id, places: [] }]
    }
  ], store);
  assert.equal(invalid.ok, false);
  assert.match(invalid.error, /does not belong to destination TH/);
});

test("destination catalog can add missing supported destinations", () => {
  let store = {
    destination_scope_destinations: [
      { code: "VN", label: "Vietnam", sort_order: 0, is_active: true }
    ]
  };
  const destinationRecord = createDestinationCatalogDestinationRecord(
    { destination: "ID" },
    { nowIso: () => fixedNow }
  );
  assert.equal(destinationRecord.ok, true);

  const destinationResult = upsertDestinationCatalogDestination(store, destinationRecord.destination);
  assert.equal(destinationResult.ok, true);
  store = destinationResult.store;

  const catalog = buildDestinationScopeCatalogResponse(store, { lang: "en" });
  assert.deepEqual(
    catalog.destinations.map((destination) => ({ code: destination.code, label: destination.label })),
    [
      { code: "VN", label: "Vietnam" },
      { code: "ID", label: "Indonesia" }
    ]
  );

  const duplicate = upsertDestinationCatalogDestination(store, destinationRecord.destination);
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /already exists/);

  const invalidScope = validateDestinationScopeAgainstCatalog([{ destination: "KH", regions: [] }], store);
  assert.equal(invalidScope.ok, false);
  assert.match(invalidScope.error, /Unknown destination: KH/);
});

test("destination catalog deletes only empty places, regions, and destinations", () => {
  let store = {
    destination_scope_destinations: [
      { code: "VN", label: "Vietnam", sort_order: 0, is_active: true },
      { code: "TH", label: "Thailand", sort_order: 1, is_active: true }
    ],
    destination_regions: [
      { id: "region_central", destination: "VN", code: "central", name: "Central", sort_order: 0, is_active: true },
      { id: "region_north", destination: "VN", code: "north", name: "North", sort_order: 1, is_active: true },
      { id: "region_bangkok", destination: "TH", code: "bangkok", name: "Bangkok", sort_order: 0, is_active: true }
    ],
    destination_places: [
      { id: "place_hue", region_id: "region_central", code: "hue", name: "Hue", sort_order: 0, is_active: true },
      { id: "place_hanoi", region_id: "region_north", code: "hanoi", name: "Hanoi", sort_order: 0, is_active: true },
      { id: "place_sukhumvit", region_id: "region_bangkok", code: "sukhumvit", name: "Sukhumvit", sort_order: 0, is_active: true }
    ]
  };

  const placeResult = deleteDestinationPlace(store, "place_hue");
  assert.equal(placeResult.ok, true);
  store = placeResult.store;
  assert.equal(store.destination_places.some((place) => place.id === "place_hue"), false);
  assert.equal(store.destination_regions.some((region) => region.id === "region_central"), true);

  const regionWithPlacesResult = deleteDestinationRegion(store, "region_north");
  assert.equal(regionWithPlacesResult.ok, false);
  assert.match(regionWithPlacesResult.error, /still has places/);

  const destinationWithRegionsResult = deleteDestinationCatalogDestination(store, "TH");
  assert.equal(destinationWithRegionsResult.ok, false);
  assert.match(destinationWithRegionsResult.error, /still has regions/);

  const emptyRegionResult = deleteDestinationRegion(store, "region_central");
  assert.equal(emptyRegionResult.ok, true);
  store = emptyRegionResult.store;
  assert.equal(store.destination_regions.some((region) => region.id === "region_central"), false);

  const placeBeforeRegionResult = deleteDestinationPlace(store, "place_hanoi");
  assert.equal(placeBeforeRegionResult.ok, true);
  store = placeBeforeRegionResult.store;
  const regionResult = deleteDestinationRegion(store, "region_north");
  assert.equal(regionResult.ok, true);
  store = regionResult.store;
  assert.equal(store.destination_regions.some((region) => region.id === "region_north"), false);

  const thaiPlaceResult = deleteDestinationPlace(store, "place_sukhumvit");
  assert.equal(thaiPlaceResult.ok, true);
  store = thaiPlaceResult.store;
  const thaiRegionResult = deleteDestinationRegion(store, "region_bangkok");
  assert.equal(thaiRegionResult.ok, true);
  store = thaiRegionResult.store;
  const destinationResult = deleteDestinationCatalogDestination(store, "TH");
  assert.equal(destinationResult.ok, true);
  store = destinationResult.store;
  assert.equal(store.destination_scope_destinations.some((destination) => destination.code === "TH"), false);
});

test("travel plan day locations derive compatibility destination scope", () => {
  const store = {
    destination_scope_destinations: [
      { code: "VN", label: "Vietnam", sort_order: 0, is_active: true }
    ],
    destination_regions: [
      { id: "region_central", destination: "VN", name: "Central Vietnam", sort_order: 0, is_active: true }
    ],
    destination_places: [
      { id: "place_hoi_an", region_id: "region_central", name: "Hoi An", sort_order: 0, is_active: true }
    ]
  };
  const travelPlan = {
    days: [
      { primary_location_id: "region_central" },
      { primary_location_id: "place_hoi_an" }
    ]
  };

  assert.deepEqual(deriveDestinationScopeFromTravelPlanLocations(travelPlan, store), [
    {
      destination: "VN",
      places: [],
      regions: [
        {
          region_id: "region_central",
          places: [{ place_id: "place_hoi_an" }]
        }
      ]
    }
  ]);
  assert.deepEqual(
    mergeDestinationScopeWithTravelPlanLocations([{ destination: "VN", regions: [], places: [] }], travelPlan, store),
    [
      {
        destination: "VN",
        places: [],
        regions: [
          {
            region_id: "region_central",
            places: [{ place_id: "place_hoi_an" }]
          }
        ]
      }
    ]
  );
  assert.equal(validateTravelPlanDayLocationIdsAgainstCatalog(travelPlan, store).ok, true);
  assert.equal(validateTravelPlanDayLocationIdsAgainstCatalog({
    days: [{ primary_location_id: "place_missing" }]
  }, store).ok, false);
});

test("empty destination catalog is pre-populated with supported destinations", () => {
  const store = { destination_scope_destinations: [] };
  const catalog = buildDestinationScopeCatalogResponse(store, { lang: "en" });
  assert.deepEqual(
    catalog.destinations.map((destination) => ({ code: destination.code, label: destination.label })),
    [
      { code: "VN", label: "Vietnam" },
      { code: "TH", label: "Thailand" },
      { code: "KH", label: "Cambodia" },
      { code: "LA", label: "Laos" }
    ]
  );

  const regionRecord = createDestinationRegionRecord(
    { destination: "VN", name: "Central" },
    { randomUUID: idFactory("region_uuid"), nowIso: () => fixedNow }
  );
  assert.equal(regionRecord.ok, true);
  const regionResult = upsertDestinationRegion(store, regionRecord.region);
  assert.equal(regionResult.ok, true);
});

test("destination catalog labels use canonical base names", () => {
  const store = {
    destination_scope_destinations: [
      { code: "VN", label: "Vietnam", sort_order: 0, is_active: true }
    ],
    destination_regions: [
      {
        id: "region_central",
        destination: "VN",
        code: "central",
        name: "Central",
        sort_order: 0,
        is_active: true
      }
    ],
    destination_places: [
      {
        id: "place_hue",
        region_id: "region_central",
        code: "hue",
        name: "Hue",
        sort_order: 0,
        is_active: true
      }
    ]
  };

  const englishCatalog = buildDestinationScopeCatalogResponse(store, { lang: "en" });
  const germanCatalog = buildDestinationScopeCatalogResponse(store, { lang: "de" });
  const vietnameseCatalog = buildDestinationScopeCatalogResponse(store, { lang: "vi" });

  assert.equal(englishCatalog.regions[0].label, "Central");
  assert.equal(englishCatalog.places[0].label, "Hue");
  assert.equal(germanCatalog.regions[0].label, "Central");
  assert.equal(germanCatalog.places[0].label, "Hue");
  assert.equal(vietnameseCatalog.regions[0].label, "Central");
  assert.equal(vietnameseCatalog.places[0].label, "Hue");
});

test("destination catalog i18n cleanup strips legacy localized maps", async () => {
  const store = {
    destination_scope_destinations: [
      { code: "VN", label: "Vietnam", label_i18n: { vi: "Việt Nam" }, sort_order: 0, is_active: true }
    ],
    destination_regions: [
      {
        id: "region_central",
        destination: "VN",
        code: "central",
        name: "Central",
        name_i18n: { vi: "Miền Trung" },
        sort_order: 100,
        is_active: true
      }
    ],
    destination_places: [
      {
        id: "place_hoi_an",
        region_id: "region_central",
        code: "hoi-an",
        name: "Hoi An",
        name_i18n: { vi: "Hội An" },
        sort_order: 100,
        is_active: true
      }
    ]
  };
  const result = await ensureDestinationScopeCatalogI18n(store, {
    languages: ["en", "fr", "de"],
    nowIso: () => fixedNow,
    translateEntriesWithMeta: async (entries, lang) => {
      throw new Error(`Unexpected translation request for ${lang}`);
    }
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.translated, false);
  assert.equal(Object.hasOwn(result.store.destination_scope_destinations[0], "label_i18n"), false);
  assert.equal(Object.hasOwn(result.store.destination_regions[0], "name_i18n"), false);
  assert.equal(Object.hasOwn(result.store.destination_places[0], "name_i18n"), false);
});
