#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const DEFAULT_TOURS_DIR = "content/tours";
const DEFAULT_CATALOG_PATH = "content/tours/destinations.json";
const DEFAULT_CACHE_PATH = "tmp/tour_day_location_geocode_cache.json";
const DEFAULT_COUNTRY = "Vietnam";
const DEFAULT_DESTINATION = "VN";
const DEFAULT_MIN_SCORE = 0.7;
const GEOCODE_DELAY_MS = 1100;

const EDGE_STOP_WORDS = new Set([
  "and",
  "arrival",
  "around",
  "broad",
  "classic",
  "compact",
  "concise",
  "day",
  "departure",
  "drop",
  "dropoff",
  "drop-off",
  "eight",
  "eight-day",
  "escape",
  "farewell",
  "focused",
  "from",
  "heritage",
  "history",
  "icons",
  "imperial",
  "in",
  "into",
  "markets",
  "night",
  "pickup",
  "return",
  "road",
  "route",
  "shopping",
  "southern",
  "streets",
  "the",
  "through",
  "to",
  "welcome",
  "with",
]);

const SKIP_PHRASES = new Set([
  "airport",
  "airport farewell",
  "airport transfer",
  "arrival",
  "arrival and road",
  "beach",
  "bridge",
  "bun quay",
  "church",
  "classic cruise",
  "coast",
  "coffee",
  "coconut",
  "crafts",
  "day",
  "departure",
  "dragon",
  "farewell",
  "gardens",
  "gardens and coffee",
  "heritage day",
  "history and streets",
  "icons and markets",
  "islands",
  "market",
  "markets",
  "marble",
  "night market",
  "overnight stay",
  "prison",
  "return",
  "road",
  "route",
  "royal sites",
  "shopping",
  "southern vietnam route",
  "streets",
  "temples",
  "vietnam",
]);

const ALIAS_OVERRIDES = new Map([
  ["bana hill", "Ba Na Hills"],
  ["bana hills", "Ba Na Hills"],
  ["dang nang", "Da Nang"],
  ["ha long", "Halong Bay"],
  ["ha long bay", "Halong Bay"],
  ["ha noi", "Hanoi"],
  ["hoan kiem", "Hoan Kiem Lake"],
  ["imperial hue", "Hue"],
  ["imperial citadel", "Hue Imperial City"],
  ["love bridge", "Love Bridge Da Nang"],
  ["marble caves", "Marble Mountains"],
  ["marble mountains", "Marble Mountains"],
  ["son tra", "Son Tra Peninsula"],
  ["son tra peninsula", "Son Tra Peninsula"],
]);

const GEOCODE_ALIASES = new Map([
  ["ba den mountain", ["Nui Ba Den", "Ba Den, Tay Ninh"]],
  ["bai dinh", ["Bai Dinh", "Bai Dinh Pagoda"]],
  ["ben thanh", ["Ben Thanh Market"]],
  ["cat cat village", ["Cat Cat Village, Sa Pa"]],
  ["coconut forest", ["Bay Mau Coconut Forest, Hoi An"]],
  ["cu chi", ["Cu Chi", "Cu Chi Tunnels"]],
  ["da lat", ["Da Lat", "Dalat"]],
  ["dong ba market", ["Dong Ba Market, Hue"]],
  ["dragon bridge", ["Dragon Bridge, Da Nang"]],
  ["fansipan", ["Fansipan, Sa Pa"]],
  ["grand world", ["Grand World Phu Quoc"]],
  ["hang mua", ["Hang Mua", "Hang Mua, Ninh Binh"]],
  ["hoa lu", ["Hoa Lu", "Hoa Lu Ancient Capital"]],
  ["hoan kiem lake", ["Ho Hoan Kiem", "Hoan Kiem Lake, Hanoi"]],
  ["lang co bay", ["Lang Co Bay", "Lang Co, Phu Loc"]],
  ["langbiang", ["Nui Lang Biang", "Langbiang Mountain, Da Lat"]],
  ["marble mountains", ["Ngu Hanh Son", "Ngu Hanh Son, Da Nang"]],
  ["mui ne", ["Mui Ne", "Mui Ne, Phan Thiet"]],
  ["my tho", ["My Tho, Tien Giang"]],
  ["nha trang", ["Nha Trang", "Nha Trang, Khanh Hoa"]],
  ["o quy ho pass", ["O Quy Ho", "O Quy Ho Pass, Sa Pa"]],
  ["old quarter", ["Hanoi Old Quarter"]],
  ["saigon", ["Ho Chi Minh", "Ho Chi Minh City"]],
  ["son tra peninsula", ["Son Tra", "Son Tra Peninsula, Da Nang", "Son Tra, Da Nang"]],
  ["sunset town", ["Sun Premier Village Primavera", "Sunset Town Phu Quoc"]],
  ["thien mu", ["Thien Mu Pagoda, Hue"]],
  ["trang an", ["Trang An", "Trang An, Ninh Binh"]],
  ["truc lam", ["Truc Lam Da Lat", "Truc Lam Monastery, Da Lat"]],
  ["tuyet tinh coc", ["Tuyet Tinh Coc, Ninh Binh", "Am Tien Cave, Ninh Binh"]],
  ["vinwonders", ["VinWonders Phu Quoc"]],
]);

const REGION_BY_LATITUDE = [
  { code: "north", minLatitude: 18 },
  { code: "central", minLatitude: 13 },
  { code: "south", minLatitude: -Infinity },
];

function printUsage() {
  console.log(`Usage: node scripts/content/backfill_tour_day_primary_locations.mjs [options]

Backfills travel_plan.days[].primary_location_id from day titles.

Options:
  --write                    Write tour JSON and destination catalog changes.
  --dry-run                  Preview changes only. This is the default.
  --overwrite                Replace existing primary_location_id values.
  --no-geocode               Only match existing catalog places; do not call geocoding.
  --repo-root <path>         Repository root. Default: ${DEFAULT_REPO_ROOT}
  --tours-dir <path>         Tours directory. Default: ${DEFAULT_TOURS_DIR}
  --catalog <path>           Destination catalog path. Default: ${DEFAULT_CATALOG_PATH}
  --cache <path>             Geocode cache path. Default: ${DEFAULT_CACHE_PATH}
  --country <name>           Geocode country suffix. Default: ${DEFAULT_COUNTRY}
  --destination <code>       Destination code for new places. Default: ${DEFAULT_DESTINATION}
  --min-score <number>       Minimum geocode confidence. Default: ${DEFAULT_MIN_SCORE}
  --limit <number>           Stop after scanning this many days.
  --json                     Print the report as JSON.
  --help                     Show this help.
`);
}

function parseArgs(argv) {
  const options = {
    write: false,
    overwrite: false,
    geocode: true,
    repoRoot: DEFAULT_REPO_ROOT,
    toursDir: DEFAULT_TOURS_DIR,
    catalogPath: DEFAULT_CATALOG_PATH,
    cachePath: DEFAULT_CACHE_PATH,
    country: DEFAULT_COUNTRY,
    destination: DEFAULT_DESTINATION,
    minScore: DEFAULT_MIN_SCORE,
    limit: null,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const readValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      index += 1;
      return value;
    };

    if (arg === "--write") options.write = true;
    else if (arg === "--dry-run") options.write = false;
    else if (arg === "--overwrite") options.overwrite = true;
    else if (arg === "--no-geocode") options.geocode = false;
    else if (arg === "--repo-root") options.repoRoot = path.resolve(readValue());
    else if (arg === "--tours-dir") options.toursDir = readValue();
    else if (arg === "--catalog") options.catalogPath = readValue();
    else if (arg === "--cache") options.cachePath = readValue();
    else if (arg === "--country") options.country = readValue();
    else if (arg === "--destination") options.destination = readValue();
    else if (arg === "--min-score") options.minScore = Number(readValue());
    else if (arg === "--limit") options.limit = Number.parseInt(readValue(), 10);
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (!Number.isFinite(options.minScore) || options.minScore < 0 || options.minScore > 1) {
    throw new Error("--min-score must be a number from 0 to 1");
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }

  return options;
}

function resolveFromRoot(repoRoot, value) {
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (fallback !== null && error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function slugify(value) {
  return normalizeText(value).replace(/\s+/g, "-");
}

function hashShort(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 8);
}

function roundCoord(value) {
  return Math.round(Number(value) * 1_000_000) / 1_000_000;
}

function titleCase(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((part) => {
      if (!part) return part;
      if (/^[A-Z]{2,}$/.test(part)) return part;
      return `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`;
    })
    .join(" ");
}

function isVietnameseCoordinate(latitude, longitude) {
  return latitude >= 8 && latitude <= 24 && longitude >= 102 && longitude <= 110.5;
}

function regionForCoordinate(catalogIndex, latitude) {
  for (const rule of REGION_BY_LATITUDE) {
    if (latitude >= rule.minLatitude) {
      const region = catalogIndex.regionByCode.get(rule.code);
      if (region) return region;
    }
  }
  return catalogIndex.regions[0] || null;
}

function addAlias(aliasMap, alias, place) {
  const normalized = normalizeText(alias);
  if (!normalized || normalized.length < 3) return;
  const current = aliasMap.get(normalized);
  if (!current || String(place.name || "").length > String(current.name || "").length) {
    aliasMap.set(normalized, place);
  }
}

function buildCatalogIndex(catalog) {
  const regions = Array.isArray(catalog.destination_regions)
    ? catalog.destination_regions
    : (Array.isArray(catalog.destination_areas) ? catalog.destination_areas : []);
  const places = Array.isArray(catalog.destination_places) ? catalog.destination_places : [];
  const regionByCode = new Map(regions.map((region) => [normalizeText(region.code), region]));
  const placeById = new Map(places.map((place) => [String(place.id), place]));
  const placeByCode = new Map(places.map((place) => [normalizeText(place.code), place]));
  const placeByName = new Map();
  const aliasMap = new Map();

  for (const place of places) {
    addAlias(aliasMap, place.name, place);
    addAlias(aliasMap, place.code, place);
    if (place.code) addAlias(aliasMap, String(place.code).replace(/[-_]+/g, " "), place);

    const normalizedName = normalizeText(place.name);
    if (normalizedName) placeByName.set(normalizedName, place);
  }

  for (const [alias, canonical] of ALIAS_OVERRIDES.entries()) {
    const canonicalPlace = aliasMap.get(normalizeText(canonical));
    if (canonicalPlace) aliasMap.set(normalizeText(alias), canonicalPlace);
  }

  return { regions, regionByCode, places, placeById, placeByCode, placeByName, aliasMap };
}

function findExistingPlaceMentions(title, catalogIndex) {
  const normalizedTitle = ` ${normalizeText(title)} `;
  const matches = [];

  for (const [alias, place] of catalogIndex.aliasMap.entries()) {
    const paddedAlias = ` ${alias} `;
    const position = normalizedTitle.indexOf(paddedAlias);
    if (position === -1) continue;
    matches.push({
      source: "catalog",
      label: place.name,
      normalized: normalizeText(place.name),
      place,
      position,
      score: 1,
    });
  }

  return dedupeMatches(matches)
    .sort((a, b) => a.position - b.position || b.normalized.length - a.normalized.length);
}

function dedupeMatches(matches) {
  const seen = new Set();
  const result = [];
  for (const match of matches) {
    const key = match.place?.id || match.normalized;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(match);
  }
  return result;
}

function cleanupCandidate(value) {
  let candidate = String(value || "")
    .replace(/[()]/g, " ")
    .replace(/[’']/g, "")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let parts = candidate.split(/\s+/);
  while (parts.length && EDGE_STOP_WORDS.has(normalizeText(parts[0]))) parts = parts.slice(1);
  while (parts.length && EDGE_STOP_WORDS.has(normalizeText(parts.at(-1)))) parts = parts.slice(0, -1);
  candidate = parts.join(" ").trim();

  const normalized = normalizeText(candidate);
  if (!normalized || normalized.length < 3) return "";
  if (SKIP_PHRASES.has(normalized)) return "";
  if (normalized.split(" ").length > 5) return "";
  if (/^(and|to|from|with|in)$/.test(normalized)) return "";

  return ALIAS_OVERRIDES.get(normalized) || titleCase(candidate);
}

function extractCandidates(title) {
  const candidates = [];
  const push = (raw, position = -1) => {
    const label = cleanupCandidate(raw);
    if (!label) return;
    const normalized = normalizeText(label);
    if (!normalized || candidates.some((item) => item.normalized === normalized)) return;
    candidates.push({ label, normalized, position });
  };

  const splitParts = String(title || "")
    .replace(/[–—]/g, "-")
    .split(/\s+-\s+|\s*-\s*|,|:|\/|\s+(?:to|and|with|through|via|from|into|around|in)\s+/i);

  for (const part of splitParts) {
    const position = String(title || "").toLowerCase().indexOf(String(part || "").toLowerCase());
    push(part, position);
  }

  const capitalized = String(title || "").match(
    /\b[A-ZÀ-ỴĐ][A-Za-zÀ-ỹĐđ'’]*(?:\s+[A-ZÀ-ỴĐ][A-Za-zÀ-ỹĐđ'’]*){0,4}/g,
  ) || [];
  for (const phrase of capitalized) {
    push(phrase, String(title || "").indexOf(phrase));
  }

  return candidates.sort((a, b) => a.position - b.position || b.normalized.length - a.normalized.length);
}

function buildTourGeocodeContext(tour, catalogIndex) {
  const matches = findExistingPlaceMentions(tour?.title || "", catalogIndex);
  return matches.length === 1 ? matches[0].place.name : "";
}

async function readTourFiles(toursDir) {
  const entries = await readdir(toursDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(toursDir, entry.name, "tour.json");
    try {
      const tour = await readJson(filePath);
      files.push({ id: entry.name, filePath, tour });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return files.sort((a, b) => a.id.localeCompare(b.id));
}

async function loadCache(cachePath) {
  const cache = await readJson(cachePath, {});
  return cache && typeof cache === "object" && !Array.isArray(cache) ? cache : {};
}

async function saveCache(cachePath, cache) {
  await writeJson(cachePath, cache);
}

async function delay(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function geocodeLabels(candidate) {
  const normalized = normalizeText(candidate);
  const aliases = GEOCODE_ALIASES.get(normalized) || [];
  return (aliases.length ? aliases : [candidate]).filter(Boolean);
}

function geocodeCacheKey(candidate, context, country) {
  return normalizeText(`${candidate}, ${context || ""}, ${country}`);
}

function geocodeQueries(candidate, context, country) {
  const contextText = String(context || "").trim();
  const queries = [];
  for (const label of geocodeLabels(candidate)) {
    const normalizedLabel = normalizeText(label);
    const normalizedContext = normalizeText(contextText);
    const query = contextText && !normalizedLabel.includes(normalizedContext)
      ? `${label}, ${contextText}, ${country}`
      : `${label}, ${country}`;
    if (!queries.some((item) => normalizeText(item) === normalizeText(query))) queries.push(query);
  }
  return queries;
}

function scoreGeocodeResult(candidate, result) {
  const latitude = Number(result?.lat);
  const longitude = Number(result?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return 0;

  const address = result?.address || {};
  const inVietnam = normalizeText(address.country_code) === "vn"
    || normalizeText(address.country) === "vietnam"
    || isVietnameseCoordinate(latitude, longitude);
  if (!inVietnam) return 0;

  const resultText = normalizeText([
    result?.name,
    result?.display_name,
    address.city,
    address.town,
    address.village,
    address.hamlet,
    address.county,
    address.state,
  ].filter(Boolean).join(" "));

  const hasCuratedAliases = (GEOCODE_ALIASES.get(normalizeText(candidate)) || []).length > 0;
  const tokenScore = geocodeLabels(candidate).reduce((best, label) => {
    const labelText = normalizeText(label);
    if (labelText && resultText.includes(labelText)) return Math.max(best, 1);

    const tokens = labelText.split(" ").filter((token) => token.length > 2);
    const matchedTokens = tokens.filter((token) => resultText.includes(token)).length;
    const score = tokens.length ? (matchedTokens / tokens.length) * (hasCuratedAliases ? 1 : 0.55) : 0;
    return Math.max(best, score);
  }, 0);
  const classScore = ["place", "boundary", "natural", "tourism", "waterway", "leisure"].includes(result?.class) ? 0.12 : 0;
  const typeScore = [
    "administrative",
    "attraction",
    "city",
    "island",
    "mountain",
    "peak",
    "province",
    "town",
    "village",
    "water",
  ].includes(result?.type) ? 0.1 : 0;
  const importanceScore = Math.min(Number(result?.importance || 0), 1) * 0.18;

  return Math.min(1, 0.35 + (tokenScore * 0.35) + classScore + typeScore + importanceScore);
}

async function geocodeCandidate(candidate, context, options, cache) {
  const key = geocodeCacheKey(candidate, context, options.country);
  if (Object.hasOwn(cache, key)) return cache[key];

  const ranked = [];
  const queries = geocodeQueries(candidate, context, options.country);
  for (const query of queries) {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
    });
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "AsiaTravelPlanContentMigration/1.0 (https://asiatravelplan.com)",
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding failed for "${candidate}": ${response.status} ${response.statusText}`);
    }

    const results = await response.json();
    ranked.push(...(Array.isArray(results) ? results : [])
      .map((result) => ({ query, result, score: scoreGeocodeResult(candidate, result) })));
    await delay(GEOCODE_DELAY_MS);
  }

  ranked.sort((a, b) => b.score - a.score);
  const best = ranked[0] || null;
  const value = best ? {
    score: best.score,
    query: best.query,
    result: best.result,
    queried_at: new Date().toISOString(),
  } : {
    score: 0,
    query: queries[0] || null,
    result: null,
    queried_at: new Date().toISOString(),
  };

  cache[key] = value;
  return value;
}

function makePlaceId(name, catalogIndex) {
  const base = `place_${slugify(name).replace(/-/g, "_")}`;
  if (!catalogIndex.placeById.has(base)) return base;

  const existing = catalogIndex.placeById.get(base);
  if (normalizeText(existing?.name) === normalizeText(name)) return base;
  return `${base}_${hashShort(name)}`;
}

function makeNewPlace(candidate, geocodeValue, catalogIndex, options, now) {
  const result = geocodeValue.result;
  const latitude = roundCoord(result.lat);
  const longitude = roundCoord(result.lon);
  const region = regionForCoordinate(catalogIndex, latitude);
  if (!region) throw new Error(`No destination region is available for ${candidate}`);

  const name = titleCase(candidate);
  const existingByName = catalogIndex.placeByName.get(normalizeText(name));
  if (existingByName) return existingByName;

  const code = slugify(name);
  const existingByCode = catalogIndex.placeByCode.get(normalizeText(code));
  if (existingByCode) return existingByCode;

  return {
    id: makePlaceId(name, catalogIndex),
    destination: normalizeText(region.destination) || normalizeText(options.destination) || DEFAULT_DESTINATION,
    region_id: region.id,
    code,
    name,
    latitude,
    longitude,
    sort_order: 100,
    is_active: true,
    created_at: now,
    updated_at: now,
    _created_by_backfill: true,
  };
}

function registerNewPlace(place, catalog, catalogIndex) {
  const cleanPlace = { ...place };
  delete cleanPlace._created_by_backfill;

  catalog.destination_places = Array.isArray(catalog.destination_places) ? catalog.destination_places : [];
  catalog.destination_places.push(cleanPlace);

  catalogIndex.places.push(cleanPlace);
  catalogIndex.placeById.set(cleanPlace.id, cleanPlace);
  catalogIndex.placeByCode.set(normalizeText(cleanPlace.code), cleanPlace);
  catalogIndex.placeByName.set(normalizeText(cleanPlace.name), cleanPlace);
  addAlias(catalogIndex.aliasMap, cleanPlace.name, cleanPlace);
  addAlias(catalogIndex.aliasMap, cleanPlace.code, cleanPlace);

  return cleanPlace;
}

async function resolveDayLocation(day, tourContext, catalog, catalogIndex, options, cache, now) {
  const title = String(day?.title || "").trim();
  if (!title) return { status: "unresolved", reason: "missing_title", candidates: [] };

  const matches = findExistingPlaceMentions(title, catalogIndex);
  const candidates = extractCandidates(title);
  const accepted = [...matches];
  const rejected = [];
  const created = [];

  for (const candidate of candidates) {
    if (accepted.some((item) => item.normalized === candidate.normalized)) continue;

    const aliasPlace = catalogIndex.aliasMap.get(candidate.normalized);
    if (aliasPlace) {
      accepted.push({
        source: "catalog",
        label: aliasPlace.name,
        normalized: normalizeText(aliasPlace.name),
        place: aliasPlace,
        position: candidate.position,
        score: 1,
      });
      continue;
    }

    if (!options.geocode) {
      rejected.push({ label: candidate.label, reason: "geocode_disabled" });
      continue;
    }

    const geocodeValue = await geocodeCandidate(candidate.label, tourContext, options, cache);
    if (!geocodeValue.result || geocodeValue.score < options.minScore) {
      rejected.push({
        label: candidate.label,
        reason: "low_geocode_score",
        score: geocodeValue.score,
        query: geocodeValue.query,
        display_name: geocodeValue.result?.display_name || null,
      });
      continue;
    }

    const place = makeNewPlace(candidate.label, geocodeValue, catalogIndex, options, now);
    const catalogPlace = catalogIndex.placeById.has(place.id) ? place : registerNewPlace(place, catalog, catalogIndex);
    if (place._created_by_backfill) created.push(catalogPlace);

    accepted.push({
      source: "geocode",
      label: candidate.label,
      normalized: candidate.normalized,
      place: catalogPlace,
      position: candidate.position,
      score: geocodeValue.score,
      query: geocodeValue.query,
      display_name: geocodeValue.result.display_name,
    });
  }

  const choices = dedupeMatches(accepted)
    .sort((a, b) => a.position - b.position || b.score - a.score || b.normalized.length - a.normalized.length);
  const primary = choices[0] || null;
  if (!primary) {
    return { status: "unresolved", reason: "no_location_match", candidates, rejected, created };
  }

  return {
    status: "assigned",
    primary,
    candidates,
    choices,
    rejected,
    created,
  };
}

function makeDayReference(tourFile, day) {
  const dayLabel = day?.day_number ? `day ${day.day_number}` : `day ${day?.id || "?"}`;
  return `${tourFile.id} ${dayLabel}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const toursDir = resolveFromRoot(options.repoRoot, options.toursDir);
  const catalogPath = resolveFromRoot(options.repoRoot, options.catalogPath);
  const cachePath = resolveFromRoot(options.repoRoot, options.cachePath);
  const catalog = await readJson(catalogPath);
  const catalogIndex = buildCatalogIndex(catalog);
  const cache = options.geocode ? await loadCache(cachePath) : {};
  const tourFiles = await readTourFiles(toursDir);
  const now = new Date().toISOString();

  const report = {
    mode: options.write ? "write" : "dry-run",
    tours_scanned: tourFiles.length,
    days_scanned: 0,
    days_assigned: 0,
    days_skipped_existing_primary: 0,
    days_unresolved: 0,
    catalog_places_before: catalogIndex.places.length,
    catalog_places_created: 0,
    catalog_places_after: null,
    geocode_enabled: options.geocode,
    min_score: options.minScore,
    assignments: [],
    created_places: [],
    unresolved: [],
  };

  const dirtyTourFiles = new Set();
  let shouldStop = false;

  for (const tourFile of tourFiles) {
    const tourContext = buildTourGeocodeContext(tourFile.tour, catalogIndex);
    const days = Array.isArray(tourFile.tour?.travel_plan?.days) ? tourFile.tour.travel_plan.days : [];
    for (const day of days) {
      if (shouldStop) break;
      report.days_scanned += 1;
      if (options.limit && report.days_scanned >= options.limit) shouldStop = true;

      const existingPrimary = String(day?.primary_location_id || "").trim();
      if (existingPrimary && !options.overwrite) {
        report.days_skipped_existing_primary += 1;
        continue;
      }

      const resolution = await resolveDayLocation(day, tourContext, catalog, catalogIndex, options, cache, now);
      if (resolution.status !== "assigned") {
        report.days_unresolved += 1;
        report.unresolved.push({
          day: makeDayReference(tourFile, day),
          title: day?.title || "",
          reason: resolution.reason,
          candidates: (resolution.candidates || []).map((candidate) => candidate.label),
          rejected: resolution.rejected || [],
        });
        continue;
      }

      const createdPlaces = resolution.created || [];
      report.catalog_places_created += createdPlaces.length;
      for (const place of createdPlaces) {
        if (!report.created_places.some((item) => item.id === place.id)) {
          report.created_places.push({
            id: place.id,
            name: place.name,
            region_id: place.region_id,
            latitude: place.latitude,
            longitude: place.longitude,
          });
        }
      }

      const primaryId = resolution.primary.place.id;
      report.days_assigned += 1;
      report.assignments.push({
        day: makeDayReference(tourFile, day),
        title: day.title,
        primary_location_id: primaryId,
        primary_location_name: resolution.primary.place.name,
        source: resolution.primary.source,
        score: resolution.primary.score,
        other_matches: resolution.choices.slice(1).map((choice) => ({
          id: choice.place.id,
          name: choice.place.name,
          source: choice.source,
          score: choice.score,
          query: choice.query,
        })),
        query: resolution.primary.query,
      });

      if (options.write) {
        day.primary_location_id = primaryId;
        dirtyTourFiles.add(tourFile.filePath);
      }
    }
    if (shouldStop) break;
  }

  report.catalog_places_after = (catalog.destination_places || []).length;

  if (options.write) {
    for (const tourFile of tourFiles) {
      if (dirtyTourFiles.has(tourFile.filePath)) await writeJson(tourFile.filePath, tourFile.tour);
    }
    if (report.catalog_places_created > 0) await writeJson(catalogPath, catalog);
    if (options.geocode) await saveCache(cachePath, cache);
  } else if (options.geocode) {
    await saveCache(cachePath, cache);
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Tour day primary location backfill ${report.mode} report`);
  console.log(`Tours scanned: ${report.tours_scanned}`);
  console.log(`Days scanned: ${report.days_scanned}`);
  console.log(`Days assigned: ${report.days_assigned}`);
  console.log(`Days skipped with existing primary: ${report.days_skipped_existing_primary}`);
  console.log(`Days unresolved: ${report.days_unresolved}`);
  console.log(`Catalog places before: ${report.catalog_places_before}`);
  console.log(`Catalog places created: ${report.catalog_places_created}`);
  console.log(`Catalog places after: ${report.catalog_places_after}`);
  console.log(`Geocode enabled: ${report.geocode_enabled}`);

  if (report.created_places.length) {
    console.log("\nCreated places:");
    for (const place of report.created_places.slice(0, 30)) {
      console.log(`- ${place.id}: ${place.name} (${place.latitude}, ${place.longitude})`);
    }
    if (report.created_places.length > 30) {
      console.log(`- ... ${report.created_places.length - 30} more`);
    }
  }

  if (report.assignments.length) {
    console.log("\nFirst assignments:");
    for (const item of report.assignments.slice(0, 30)) {
      const score = Number.isFinite(item.score) ? ` score ${item.score.toFixed(2)}` : "";
      console.log(`- ${item.day}: ${item.title} -> ${item.primary_location_name} (${item.primary_location_id}, ${item.source}${score})`);
    }
    if (report.assignments.length > 30) {
      console.log(`- ... ${report.assignments.length - 30} more`);
    }
  }

  if (report.unresolved.length) {
    console.log("\nFirst unresolved days:");
    for (const item of report.unresolved.slice(0, 30)) {
      const candidates = item.candidates.length ? ` candidates: ${item.candidates.join(", ")}` : "";
      console.log(`- ${item.day}: ${item.title} (${item.reason})${candidates}`);
    }
    if (report.unresolved.length > 30) {
      console.log(`- ... ${report.unresolved.length - 30} more`);
    }
  }

  if (!options.write) {
    console.log("\nDry-run only. Pass --write to update tour JSON and destination catalog files.");
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
