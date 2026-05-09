#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

node --input-type=module - "$REPO_ROOT" "$@" <<'NODE'
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [, , repoRootArg, ...argv] = process.argv;

const DEFAULT_CATALOG_PATH = "content/tours/destinations.json";
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const GEOCODE_DELAY_MS = 1100;
const GEOCODE_USER_AGENT = "travelagency-lookup-destination-latlong/1.0";
const GEOCODE_QUERY_OVERRIDES = new Map([
  ["mui ne", ["Mui Ne, Phan Thiet, Binh Thuan, Vietnam"]]
]);
const GENERIC_REGION_NAMES = new Set(["north", "south", "central"]);

function printUsage() {
  console.log(`Usage: scripts/content/lookup_destination_latlong.sh <mode> [options]

Looks up missing latitude/longitude values for content/tours/destinations.json places.
Only destination_places are changed. Countries and regions are not geocoded.

Modes:
  --dry-run               Look up missing coordinates and show the result only.
  --write                 Look up missing coordinates and write them into destinations.json.
  --delete_all            Delete all latitude/longitude values from destination_places.

Options:
  --catalog <path>        Destination catalog. Default: ${DEFAULT_CATALOG_PATH}
  --json                  Print full report as JSON.
  --help                  Show this help.
`);
}

function parseArgs(args) {
  const options = {
    mode: "",
    catalogPath: DEFAULT_CATALOG_PATH,
    json: false,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const readValue = () => {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return value;
    };

    if (arg === "--dry-run" || arg === "--write" || arg === "--delete_all") {
      if (options.mode) throw new Error(`Only one mode may be used. Already saw ${options.mode}, then saw ${arg}`);
      options.mode = arg.slice(2);
    } else if (arg === "--catalog") options.catalogPath = readValue();
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function resolveFromRoot(repoRoot, value) {
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function displayText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function catalogCollections(catalog) {
  return {
    destinations: Array.isArray(catalog.destination_scope_destinations) ? catalog.destination_scope_destinations : [],
    regions: Array.isArray(catalog.destination_regions) ? catalog.destination_regions : [],
    places: Array.isArray(catalog.destination_places) ? catalog.destination_places : []
  };
}

function isMissingCoordinate(place) {
  return !Number.isFinite(Number(place?.latitude)) || !Number.isFinite(Number(place?.longitude));
}

function hasCoordinate(place) {
  return Object.hasOwn(place, "latitude") || Object.hasOwn(place, "longitude");
}

function placeName(place) {
  return displayText(place.name || place.label || place.code || place.id);
}

function normalizeCoordinate(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return Number(number.toFixed(5));
}

function uniqueValues(values) {
  return [...new Set(values.map(displayText).filter(Boolean))];
}

function geocodeQueriesForPlace(place, catalog) {
  const { destinations, regions } = catalogCollections(catalog);
  const regionById = new Map(regions.map((region) => [displayText(region.id), region]));
  const destinationByCode = new Map(destinations.map((destination) => [
    displayText(destination.code || destination.destination).toUpperCase(),
    destination
  ]));
  const destinationCode = displayText(place.destination).toUpperCase();
  const destination = destinationByCode.get(destinationCode);
  const region = regionById.get(displayText(place.region_id));

  const name = placeName(place);
  const rawRegionName = displayText(region?.name || region?.label || region?.code);
  const regionName = GENERIC_REGION_NAMES.has(normalizeText(rawRegionName)) ? "" : rawRegionName;
  const countryName = displayText(destination?.label || destination?.name || destination?.code || place.destination);
  const overrideQueries = [
    ...(GEOCODE_QUERY_OVERRIDES.get(normalizeText(place.code)) || []),
    ...(GEOCODE_QUERY_OVERRIDES.get(normalizeText(name)) || [])
  ];

  return uniqueValues([
    ...overrideQueries,
    [name, regionName, countryName].filter(Boolean).join(", "),
    [name, countryName].filter(Boolean).join(", "),
    name
  ]);
}

const sleep = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

let lastGeocodeRequestAt = 0;

async function fetchGeocodeResult(query) {
  const elapsedMs = Date.now() - lastGeocodeRequestAt;
  if (lastGeocodeRequestAt && elapsedMs < GEOCODE_DELAY_MS) await sleep(GEOCODE_DELAY_MS - elapsedMs);
  lastGeocodeRequestAt = Date.now();

  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("accept-language", "en");

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": GEOCODE_USER_AGENT
    }
  });

  if (!response.ok) throw new Error(`Nominatim returned HTTP ${response.status}`);

  const results = await response.json();
  const result = Array.isArray(results) ? results[0] : null;
  if (!result) return null;

  const latitude = normalizeCoordinate(result.lat, -90, 90);
  const longitude = normalizeCoordinate(result.lon, -180, 180);
  if (latitude === null || longitude === null) return null;

  return {
    latitude,
    longitude,
    display_name: displayText(result.display_name),
    osm_type: displayText(result.osm_type),
    osm_id: displayText(result.osm_id)
  };
}

async function lookupMissingCoordinates(catalog, { write = false } = {}) {
  const missingPlaces = catalogCollections(catalog).places.filter(isMissingCoordinate);
  const updates = [];
  const unresolved = [];

  for (const place of missingPlaces) {
    const queries = geocodeQueriesForPlace(place, catalog);
    let resolved = null;
    let resolvedQuery = "";
    let lastError = "";

    for (const query of queries) {
      try {
        resolved = await fetchGeocodeResult(query);
      } catch (error) {
        lastError = error?.message || String(error);
        break;
      }

      if (resolved) {
        resolvedQuery = query;
        break;
      }
    }

    if (!resolved) {
      unresolved.push({
        id: displayText(place.id),
        name: placeName(place),
        queries,
        error: lastError
      });
      continue;
    }

    const update = {
      id: displayText(place.id),
      name: placeName(place),
      query: resolvedQuery,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      display_name: resolved.display_name,
      osm_type: resolved.osm_type,
      osm_id: resolved.osm_id
    };
    updates.push(update);

    if (write) {
      place.latitude = resolved.latitude;
      place.longitude = resolved.longitude;
    }
  }

  return {
    mode: write ? "write" : "dry-run",
    places_scanned: catalogCollections(catalog).places.length,
    places_missing_coordinates: missingPlaces.length,
    coordinate_updates: updates,
    coordinate_unresolved: unresolved
  };
}

function deleteAllCoordinates(catalog) {
  const deleted = [];
  for (const place of catalogCollections(catalog).places) {
    if (!hasCoordinate(place)) continue;
    deleted.push({
      id: displayText(place.id),
      name: placeName(place),
      latitude: Number.isFinite(Number(place.latitude)) ? Number(place.latitude) : null,
      longitude: Number.isFinite(Number(place.longitude)) ? Number(place.longitude) : null
    });
    delete place.latitude;
    delete place.longitude;
  }

  return {
    mode: "delete_all",
    places_scanned: catalogCollections(catalog).places.length,
    coordinates_deleted: deleted
  };
}

function printLookupReport(report) {
  console.log(`Destination latitude/longitude ${report.mode} report`);
  console.log(`Places scanned: ${report.places_scanned}`);
  console.log(`Places missing coordinates: ${report.places_missing_coordinates}`);
  console.log(`Coordinate updates: ${report.coordinate_updates.length}`);
  console.log(`Coordinate unresolved: ${report.coordinate_unresolved.length}`);

  if (report.coordinate_updates.length) {
    console.log("\nCoordinate updates:");
    for (const item of report.coordinate_updates) {
      const source = item.display_name ? `; ${item.display_name}` : "";
      console.log(`- ${item.name}: ${item.latitude}, ${item.longitude}${source}`);
    }
  }

  if (report.coordinate_unresolved.length) {
    console.warn("\nCoordinate unresolved:");
    for (const item of report.coordinate_unresolved) {
      const reason = item.error ? ` (${item.error})` : "";
      console.warn(`- ${item.name}${reason}`);
    }
  }

  if (report.mode === "dry-run") console.log("\nDry-run only. Pass --write to update destinations.json.");
}

function printDeleteReport(report) {
  console.log("Destination latitude/longitude delete_all report");
  console.log(`Places scanned: ${report.places_scanned}`);
  console.log(`Coordinates deleted: ${report.coordinates_deleted.length}`);

  if (report.coordinates_deleted.length) {
    console.log("\nDeleted coordinates:");
    for (const item of report.coordinates_deleted) {
      console.log(`- ${item.name}: ${item.latitude ?? "missing"}, ${item.longitude ?? "missing"}`);
    }
  }
}

async function main() {
  const options = parseArgs(argv);
  if (options.help || argv.length === 0) {
    printUsage();
    return;
  }
  if (!options.mode) throw new Error("Missing mode. Use --dry-run, --write, or --delete_all.");

  const repoRoot = path.resolve(repoRootArg);
  const catalogPath = resolveFromRoot(repoRoot, options.catalogPath);
  const catalog = await readJson(catalogPath);

  const report = options.mode === "delete_all"
    ? deleteAllCoordinates(catalog)
    : await lookupMissingCoordinates(catalog, { write: options.mode === "write" });

  if (options.mode === "write" || options.mode === "delete_all") await writeJson(catalogPath, catalog);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (options.mode === "delete_all") printDeleteReport(report);
  else printLookupReport(report);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
NODE
