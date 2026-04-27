import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDestinationScopeCatalogResponse,
  createDestinationCatalogDestinationRecord,
  createDestinationAreaRecord,
  createDestinationPlaceRecord,
  destinationScopeDestinations,
  destinationScopeTourDestinations,
  normalizeDestinationScope,
  normalizeTravelPlanDestinationScope,
  upsertDestinationCatalogDestination,
  upsertDestinationArea,
  upsertDestinationPlace,
  validateDestinationScopeAgainstCatalog,
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
    { destination: "VN", areas: [] },
    { destination: "TH", areas: [] },
    { destination: "KH", areas: [] }
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

test("destination area and place catalog validates selected scope", () => {
  let store = {};
  const areaRecord = createDestinationAreaRecord(
    { destination: "Vietnam", name: "Central" },
    { randomUUID: idFactory("area_uuid"), nowIso: () => fixedNow }
  );
  assert.equal(areaRecord.ok, true);

  const areaResult = upsertDestinationArea(store, areaRecord.area);
  assert.equal(areaResult.ok, true);
  store = areaResult.store;

  const placeRecord = createDestinationPlaceRecord(
    { area_id: areaResult.area.id, name: "Hoi An" },
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
  assert.equal(catalog.areas[0].id, "area_area_uuid");
  assert.equal(catalog.areas[0].label, "Central");
  assert.equal(catalog.places[0].id, "place_place_uuid");
  assert.equal(catalog.places[0].label, "Hoi An");

  const valid = validateDestinationScopeAgainstCatalog([
    {
      destination: "VN",
      areas: [
        {
          area_id: areaResult.area.id,
          places: [{ place_id: placeResult.place.id }]
        }
      ]
    }
  ], store);
  assert.equal(valid.ok, true);

  const thailandRecord = createDestinationCatalogDestinationRecord(
    { destination: "TH" },
    { nowIso: () => fixedNow }
  );
  assert.equal(thailandRecord.ok, true);
  const thailandResult = upsertDestinationCatalogDestination(store, thailandRecord.destination);
  assert.equal(thailandResult.ok, true);
  store = thailandResult.store;

  const invalid = validateDestinationScopeAgainstCatalog([
    {
      destination: "TH",
      areas: [{ area_id: areaResult.area.id, places: [] }]
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

  const invalidScope = validateDestinationScopeAgainstCatalog([{ destination: "KH", areas: [] }], store);
  assert.equal(invalidScope.ok, false);
  assert.match(invalidScope.error, /Unknown destination: KH/);
});

test("empty destination catalog is pre-populated with Vietnam", () => {
  const store = { destination_scope_destinations: [] };
  const catalog = buildDestinationScopeCatalogResponse(store, { lang: "en" });
  assert.deepEqual(
    catalog.destinations.map((destination) => ({ code: destination.code, label: destination.label })),
    [{ code: "VN", label: "Vietnam" }]
  );

  const areaRecord = createDestinationAreaRecord(
    { destination: "VN", name: "Central" },
    { randomUUID: idFactory("area_uuid"), nowIso: () => fixedNow }
  );
  assert.equal(areaRecord.ok, true);
  const areaResult = upsertDestinationArea(store, areaRecord.area);
  assert.equal(areaResult.ok, true);
});
