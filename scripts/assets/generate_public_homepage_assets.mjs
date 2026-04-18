import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createTourHelpers } from "../../backend/app/src/domain/tours_support.js";
import {
  normalizeTourDestinationCode,
  normalizeTourLang
} from "../../backend/app/src/domain/tour_catalog_i18n.js";
import {
  normalizeLocalizedTextMap,
  resolveLocalizedText
} from "../../backend/app/src/domain/booking_content_i18n.js";
import { normalizeDisplayLineBreaks, normalizeText } from "../../backend/app/src/lib/text.js";
import {
  DESTINATION_COUNTRY_CODES,
  DESTINATION_COUNTRY_TO_TOUR_DESTINATION_CODE
} from "../../shared/js/destination_country_codes.js";
import { FRONTEND_LANGUAGE_CODES } from "../../shared/generated/language_catalog.js";

const ROOT_DIR = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const CONTENT_ROOT = path.join(ROOT_DIR, "content");
const FRONTEND_I18N_DIR = path.join(ROOT_DIR, "frontend", "data", "i18n", "frontend");
const TOURS_ROOT = path.join(CONTENT_ROOT, "tours");
const ATP_STAFF_ROOT = path.join(CONTENT_ROOT, "atp_staff");
const ATP_STAFF_PHOTOS_ROOT = path.join(ATP_STAFF_ROOT, "photos");
const COUNTRY_REFERENCE_INFO_PATH = path.join(CONTENT_ROOT, "country_reference_info.json");
const GENERATED_HOMEPAGE_DATA_DIR = path.join(ROOT_DIR, "frontend", "data", "generated", "homepage");
const GENERATED_HOMEPAGE_ASSETS_DIR = path.join(ROOT_DIR, "assets", "generated", "homepage");
const FRONTEND_DATA_DIR = normalizeText(process.env.PUBLIC_HOMEPAGE_FRONTEND_DATA_DIR) || GENERATED_HOMEPAGE_DATA_DIR;
const HOMEPAGE_ASSETS_DIR = normalizeText(process.env.PUBLIC_HOMEPAGE_ASSETS_DIR) || GENERATED_HOMEPAGE_ASSETS_DIR;
const TOUR_OUTPUT_DIR = path.join(HOMEPAGE_ASSETS_DIR, "tours");
const TEAM_OUTPUT_DIR = path.join(HOMEPAGE_ASSETS_DIR, "team");
const TEAM_OUTPUT_FILE = path.join(FRONTEND_DATA_DIR, "public-team.json");
const HOMEPAGE_COPY_GLOBAL_PATH = path.join(FRONTEND_DATA_DIR, "public-homepage-copy.global.js");
const HOMEPAGE_INITIAL_BUNDLE_PATH = path.join(FRONTEND_DATA_DIR, "public-homepage-main.bundle.js");
const TOUR_FILE_PREFIX = "public-tours.";
const TOUR_FILE_SUFFIX = ".json";
const ALLOWED_ASSET_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const HOMEPAGE_TOUR_IMAGE_SIZE = 720;
const HOMEPAGE_TOUR_IMAGE_QUALITY = 68;
const SHARP_MODULE_URL = pathToFileURL(path.join(ROOT_DIR, "backend", "app", "node_modules", "sharp", "lib", "index.js")).href;
let sharpModulePromise = null;

function safeInt(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function jsonWithTrailingNewline(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function versionTokenForContent(value) {
  return createHash("sha1").update(String(value ?? ""), "utf8").digest("hex").slice(0, 12);
}

function buildVersionedGeneratedDataUrl(filename, version, { publicPrefix = "/frontend/data/generated/homepage" } = {}) {
  const normalizedFilename = normalizeText(filename);
  if (!normalizedFilename) return "";
  const baseUrl = `${String(publicPrefix || "").replace(/\/+$/, "")}/${encodeURIComponent(normalizedFilename)}`;
  const normalizedVersion = normalizeText(version);
  return normalizedVersion ? `${baseUrl}?v=${encodeURIComponent(normalizedVersion)}` : baseUrl;
}

function interpolateTemplate(template, vars) {
  return String(template ?? "").replace(/\{([^{}]+)\}/g, (match, key) => {
    const normalizedKey = String(key ?? "").trim();
    return Object.prototype.hasOwnProperty.call(vars || {}, normalizedKey)
      ? String(vars[normalizedKey])
      : match;
  });
}

function formatLocalizedList(values, lang) {
  const items = (Array.isArray(values) ? values : []).map((value) => normalizeText(value)).filter(Boolean);
  if (!items.length) return "";
  try {
    return new Intl.ListFormat(normalizeTourLang(lang), {
      style: "long",
      type: "conjunction"
    }).format(items);
  } catch {
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
  }
}

async function readJson(filePath, { fallback = null } = {}) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT" && fallback !== null) return fallback;
    throw error;
  }
}

async function listDirectoryEntries(directoryPath) {
  try {
    return await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function ensureDirectory(directoryPath) {
  await mkdir(directoryPath, { recursive: true });
}

async function cleanGeneratedFrontendData(frontendDataDir) {
  await ensureDirectory(frontendDataDir);
  const entries = await listDirectoryEntries(frontendDataDir);
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const entryName = entry.name;
    if (
      entryName === "public-team.json"
      || entryName === path.basename(HOMEPAGE_COPY_GLOBAL_PATH)
      || entryName === "public-homepage-copy.manifest.json"
      || entryName === path.basename(HOMEPAGE_INITIAL_BUNDLE_PATH)
      || (entryName.startsWith(TOUR_FILE_PREFIX) && entryName.endsWith(TOUR_FILE_SUFFIX))
    ) {
      await rm(path.join(frontendDataDir, entryName), { force: true });
    }
  }
}

async function cleanGeneratedAssetDir(directoryPath) {
  await rm(directoryPath, { recursive: true, force: true });
  await ensureDirectory(directoryPath);
}

function isAllowedAssetFile(filename) {
  return ALLOWED_ASSET_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

async function copyAllowedFiles(sourceDir, destinationDir, { exclude = new Set() } = {}) {
  await ensureDirectory(destinationDir);
  const entries = await listDirectoryEntries(sourceDir);
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (exclude.has(entry.name)) continue;
    if (!isAllowedAssetFile(entry.name)) continue;
    await copyFile(path.join(sourceDir, entry.name), path.join(destinationDir, entry.name));
  }
}

function isRasterAssetFile(filename) {
  const ext = path.extname(String(filename || "")).toLowerCase();
  return Boolean(ext && ext !== ".svg" && ALLOWED_ASSET_EXTENSIONS.has(ext));
}

async function loadSharp() {
  if (!sharpModulePromise) {
    sharpModulePromise = import(SHARP_MODULE_URL).then((module) => module.default || module);
  }
  return sharpModulePromise;
}

async function generateHomepageTourAssets(sourceDir, destinationDir) {
  await ensureDirectory(destinationDir);
  const entries = await listDirectoryEntries(sourceDir);
  const generatedPathBySourceName = new Map();

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!isAllowedAssetFile(entry.name)) continue;

    const sourcePath = path.join(sourceDir, entry.name);
    if (!isRasterAssetFile(entry.name)) {
      const destinationPath = path.join(destinationDir, entry.name);
      await copyFile(sourcePath, destinationPath);
      generatedPathBySourceName.set(entry.name, entry.name);
      continue;
    }

    const outputName = `${path.parse(entry.name).name}.webp`;
    const destinationPath = path.join(destinationDir, outputName);
    const sharp = await loadSharp();
    await sharp(sourcePath, { failOn: "none" })
      .rotate()
      .resize(HOMEPAGE_TOUR_IMAGE_SIZE, HOMEPAGE_TOUR_IMAGE_SIZE, {
        fit: "cover",
        position: "centre",
        withoutEnlargement: true
      })
      .webp({
        quality: HOMEPAGE_TOUR_IMAGE_QUALITY,
        effort: 5
      })
      .toFile(destinationPath);
    generatedPathBySourceName.set(entry.name, outputName);
  }

  return generatedPathBySourceName;
}

function visiblePublishedDestinationCodes(countryReferencePayload) {
  const publishedCountryCodes = new Set(DESTINATION_COUNTRY_CODES);
  for (const item of Array.isArray(countryReferencePayload?.items) ? countryReferencePayload.items : []) {
    const countryCode = normalizeText(item?.country).toUpperCase();
    if (!countryCode) continue;
    if (item?.published_on_webpage === false) publishedCountryCodes.delete(countryCode);
    else publishedCountryCodes.add(countryCode);
  }
  return new Set(
    Array.from(publishedCountryCodes)
      .map((countryCode) => normalizeTourDestinationCode(DESTINATION_COUNTRY_TO_TOUR_DESTINATION_CODE[countryCode]))
      .filter(Boolean)
  );
}

function normalizeTourForPublicHomepage(tour, publishedDestinationCodes, { normalizeTourForStorage, tourDestinationCodes }) {
  const stored = normalizeTourForStorage(tour);
  const visibleDestinations = tourDestinationCodes(stored).filter((code) => publishedDestinationCodes.has(code));
  if (!visibleDestinations.length) return null;
  return {
    ...stored,
    destinations: visibleDestinations
  };
}

function extractTourAssetRelativePath(imagePath, tourId) {
  const normalized = normalizeText(imagePath);
  if (!normalized) return "";
  const withoutQuery = normalized.split("?")[0];
  const publicPrefix = "/public/v1/tour-images/";
  const staticPrefixes = ["/assets/generated/homepage/tours/", "/assets/tours/"];
  if (withoutQuery.startsWith(publicPrefix)) {
    return withoutQuery.slice(publicPrefix.length).replace(/^\/+/, "");
  }
  for (const staticPrefix of staticPrefixes) {
    if (withoutQuery.startsWith(staticPrefix)) {
      return withoutQuery.slice(staticPrefix.length).replace(/^\/+/, "");
    }
  }
  if (/^https?:\/\//i.test(withoutQuery)) return withoutQuery;
  const normalizedTourId = normalizeText(tourId);
  if (!normalizedTourId) return "";
  const bareValue = withoutQuery.replace(/^\/+/, "");
  if (bareValue.startsWith(`${normalizedTourId}/`)) return bareValue;
  if (isAllowedAssetFile(bareValue)) return `${normalizedTourId}/${path.basename(bareValue)}`;
  return "";
}

async function versionedStaticAssetPath(relativePath, outputRoot, { publicPrefix = "", version = "" } = {}) {
  const normalizedRelativePath = String(relativePath || "").replace(/^\/+/, "");
  if (!normalizedRelativePath || /^https?:\/\//i.test(normalizedRelativePath)) return normalizedRelativePath;
  const outputPath = path.join(outputRoot, normalizedRelativePath);
  try {
    await stat(outputPath);
  } catch {
    throw new Error(`Missing generated asset: ${normalizedRelativePath}`);
  }
  const queryValue = normalizeText(version);
  const normalizedPrefix = `/${String(publicPrefix || "").replace(/^\/+/, "").replace(/\/+$/, "")}`;
  const publicPath = `${normalizedPrefix}/${normalizedRelativePath}`;
  return queryValue
    ? `${publicPath}?v=${encodeURIComponent(queryValue)}`
    : publicPath;
}

async function buildHeroTitleByLang({
  publicTours,
  collectTourOptions,
  frontendI18nDir = FRONTEND_I18N_DIR,
  languages = FRONTEND_LANGUAGE_CODES
} = {}) {
  const result = {};
  for (const lang of languages) {
    const normalizedLang = normalizeTourLang(lang);
    const dictionary = await readJson(path.join(frontendI18nDir, `${normalizedLang}.json`), {});
    const options = collectTourOptions(publicTours, { lang: normalizedLang });
    const destinationLabels = (Array.isArray(options?.destinations) ? options.destinations : [])
      .map((option) => normalizeText(option?.label || option?.code || option))
      .filter(Boolean);
    const defaultTitle = normalizeText(dictionary["hero.title"]);
    const titleTemplate = normalizeText(dictionary["hero.title_with_destinations"]) || defaultTitle || "Private holidays in {destinations}";
    result[normalizedLang] = destinationLabels.length
      ? interpolateTemplate(titleTemplate, {
        destinations: formatLocalizedList(destinationLabels, normalizedLang)
      })
      : defaultTitle;
  }
  return result;
}

async function writeHomepageCopyGlobalScript(outputPath, value) {
  await ensureDirectory(path.dirname(outputPath));
  const source = [
    "// Generated by scripts/assets/generate_public_homepage_assets.mjs.",
    "// Do not edit by hand.",
    `window.ASIATRAVELPLAN_PUBLIC_HOMEPAGE_COPY = Object.freeze(${JSON.stringify(value, null, 2)});`,
    ""
  ].join("\n");
  await writeFile(outputPath, source, "utf8");
  return {
    version: versionTokenForContent(source)
  };
}

async function writeHomepageInitialBundleScript(outputPath) {
  await ensureDirectory(path.dirname(outputPath));
  const [mainSource, toursSource] = await Promise.all([
    readFile(path.join(ROOT_DIR, "frontend", "scripts", "main.js"), "utf8"),
    readFile(path.join(ROOT_DIR, "frontend", "scripts", "main_tours.js"), "utf8")
  ]);

  const bundlePrelude = [
    "// Generated by scripts/assets/generate_public_homepage_assets.mjs.",
    "// Do not edit by hand.",
    "function normalizeText(value) {",
    "  return String(value || \"\").trim();",
    "}",
    "",
    "function logBrowserConsoleError(message, details = {}, error = null) {",
    "  const payload = details && typeof details === \"object\" ? { ...details } : { details };",
    "  if (error) {",
    "    payload.error_name = error?.name || null;",
    "    payload.error_message = error?.message || String(error);",
    "    if (error?.stack) payload.error_stack = error.stack;",
    "    console.error(message, payload, error);",
    "    return;",
    "  }",
    "  console.error(message, payload);",
    "}",
    "",
    "const FRONTEND_LANGUAGE_CODES = Array.isArray(window.ASIATRAVELPLAN_LANGUAGE_CATALOG?.frontendLanguageCodes)",
    "  ? window.ASIATRAVELPLAN_LANGUAGE_CATALOG.frontendLanguageCodes",
    "  : [\"en\"];",
    "",
    "function normalizeLanguageCode(value, { allowedCodes = FRONTEND_LANGUAGE_CODES, fallback = \"en\" } = {}) {",
    "  const normalized = String(value || \"\").trim().toLowerCase();",
    "  const allowed = Array.isArray(allowedCodes) && allowedCodes.length ? allowedCodes : [fallback];",
    "  if (allowed.includes(normalized)) return normalized;",
    "  const catalogLanguages = Array.isArray(window.ASIATRAVELPLAN_LANGUAGE_CATALOG?.languages)",
    "    ? window.ASIATRAVELPLAN_LANGUAGE_CATALOG.languages",
    "    : [];",
    "  for (const language of catalogLanguages) {",
    "    const aliases = Array.isArray(language?.aliases) ? language.aliases : [];",
    "    if (aliases.some((alias) => String(alias || \"\").trim().toLowerCase() === normalized)) {",
    "      const resolved = String(language?.code || \"\").trim().toLowerCase();",
    "      if (allowed.includes(resolved)) return resolved;",
    "    }",
    "  }",
    "  return allowed.includes(fallback) ? fallback : (allowed[0] || \"en\");",
    "}",
    ""
  ].join("\n");

  const transformedToursSource = toursSource
    .replace(
      'import { normalizeText } from "../../shared/js/text.js";\nimport {\n  FRONTEND_LANGUAGE_CODES,\n  normalizeLanguageCode\n} from "../../shared/generated/language_catalog.js";\n\n',
      ""
    )
    .replace("export function createFrontendToursController", "function createFrontendToursController");

  const transformedMainSource = mainSource
    .replace(
      'import { normalizeText } from "../../shared/js/text.js";\nimport { logBrowserConsoleError } from "./shared/api.js";\nimport { createFrontendToursController } from "./main_tours.js";\n\n',
      ""
    )
    .replaceAll('import("./main_booking_form_options.js")', 'import("/frontend/scripts/main_booking_form_options.js")')
    .replaceAll('import("../Generated/API/generated_APIRequestFactory.js")', 'import("/frontend/Generated/API/generated_APIRequestFactory.js")')
    .replaceAll('import("../Generated/API/generated_APIModels.js")', 'import("/frontend/Generated/API/generated_APIModels.js")')
    .replaceAll('import("./shared/auth.js")', 'import("/frontend/scripts/shared/auth.js")');

  const bundleSource = [
    bundlePrelude,
    transformedToursSource,
    "",
    transformedMainSource,
    ""
  ].join("\n");

  await writeFile(outputPath, bundleSource, "utf8");
  return {
    version: versionTokenForContent(bundleSource)
  };
}

async function generateTourAssets({
  toursRoot = TOURS_ROOT,
  outputRoot = TOUR_OUTPUT_DIR,
  frontendDataDir = FRONTEND_DATA_DIR,
  countryReferenceInfoPath = COUNTRY_REFERENCE_INFO_PATH,
  frontendI18nDir = FRONTEND_I18N_DIR,
  languages = FRONTEND_LANGUAGE_CODES
} = {}) {
  const tourHelpers = createTourHelpers({ toursDir: toursRoot, safeInt });
  const {
    collectTourOptions,
    normalizeTourForRead,
    normalizeTourForStorage,
    tourDestinationCodes
  } = tourHelpers;

  await cleanGeneratedAssetDir(outputRoot);
  const tourDirectories = (await listDirectoryEntries(toursRoot)).filter((entry) => entry.isDirectory());
  const tours = [];
  const generatedTourAssetPaths = new Map();

  for (const entry of tourDirectories) {
    const tourDir = path.join(toursRoot, entry.name);
    const tourPath = path.join(tourDir, "tour.json");
    let parsedTour;
    try {
      parsedTour = await readJson(tourPath);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw new Error(`Could not parse ${tourPath}: ${error?.message || error}`);
    }
    const normalizedTour = normalizeTourForStorage(parsedTour);
    if (!normalizeText(normalizedTour?.id)) {
      throw new Error(`Tour at ${tourPath} is missing an id.`);
    }
    const generatedPaths = await generateHomepageTourAssets(tourDir, path.join(outputRoot, normalizedTour.id));
    for (const [sourceName, generatedName] of generatedPaths.entries()) {
      generatedTourAssetPaths.set(`${normalizedTour.id}/${sourceName}`, `${normalizedTour.id}/${generatedName}`);
    }
    tours.push(normalizedTour);
  }

  const ids = tours.map((tour) => normalizeText(tour.id));
  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate tour ids found while generating public homepage assets.");
  }

  const countryReferencePayload = await readJson(countryReferenceInfoPath, { fallback: { items: [] } });
  const publishedDestinationCodes = visiblePublishedDestinationCodes(countryReferencePayload);
  const publicTours = tours
    .map((tour) => normalizeTourForPublicHomepage(tour, publishedDestinationCodes, {
      normalizeTourForStorage,
      tourDestinationCodes
    }))
    .filter(Boolean);
  const sortedPublicTours = [...publicTours].sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0));
  const assetUrlsByLang = {};

  for (const lang of languages) {
    const normalizedLang = normalizeTourLang(lang);
    const localizedItems = [];
    for (const tour of sortedPublicTours) {
      const readModel = normalizeTourForRead(tour, { lang: normalizedLang });
      const pictureCandidates = Array.isArray(readModel.pictures) && readModel.pictures.length
        ? readModel.pictures
        : [readModel.image];
      const pictures = [];
      for (const picture of pictureCandidates) {
        const assetRelativePath = extractTourAssetRelativePath(picture, readModel.id);
        const generatedAssetRelativePath = generatedTourAssetPaths.get(assetRelativePath) || assetRelativePath;
        if (!generatedAssetRelativePath) continue;
        pictures.push(
          await versionedStaticAssetPath(generatedAssetRelativePath, outputRoot, {
            publicPrefix: "/assets/generated/homepage/tours",
            version: normalizeText(readModel.updated_at || readModel.created_at)
          })
        );
      }
      const image = pictures[0] || "/assets/img/marketing_tours.png";
      localizedItems.push({
        ...readModel,
        pictures,
        image
      });
    }
    const options = collectTourOptions(publicTours, { lang: normalizedLang });
    const payload = {
      items: localizedItems,
      available_destinations: options.destinations,
      available_styles: options.styles,
      pagination: {
        page: 1,
        page_size: localizedItems.length,
        total_items: localizedItems.length,
        total_pages: 1
      }
    };
    const filename = `${TOUR_FILE_PREFIX}${normalizedLang}${TOUR_FILE_SUFFIX}`;
    const outputPath = path.join(frontendDataDir, filename);
    const payloadSource = jsonWithTrailingNewline(payload);
    const payloadVersion = versionTokenForContent(payloadSource);
    await writeFile(outputPath, payloadSource, "utf8");
    assetUrlsByLang[normalizedLang] = buildVersionedGeneratedDataUrl(filename, payloadVersion);
  }

  const heroTitleByLang = await buildHeroTitleByLang({
    publicTours,
    collectTourOptions,
    frontendI18nDir,
    languages
  });

  return {
    count: publicTours.length,
    languages: languages.map((lang) => normalizeTourLang(lang)),
    heroTitleByLang,
    assetUrlsByLang
  };
}

function preferredPictureFilenameForStaff(username, photosDir) {
  const normalizedUsername = normalizeText(username).toLowerCase();
  if (!normalizedUsername) return "";
  const preferredCandidates = [`${normalizedUsername}.webp`, `${normalizedUsername}.svg`];
  return preferredCandidates.find((candidate) => isAllowedAssetFile(candidate) && path.resolve(photosDir, candidate)) || "";
}

function normalizePictureFilename(rawValue, username) {
  const normalized = normalizeText(rawValue);
  if (!normalized) return "";
  const staticMatch = normalized.match(/\/content\/atp_staff\/photos\/([^/?#]+)$/i);
  const legacyPublicMatch = normalized.match(/\/public\/v1\/atp-staff-photos\/([^/?#]+)$/i);
  const staticAssetMatch = normalized.match(/\/assets\/(?:generated\/homepage\/)?team\/([^/?#]+)$/i);
  const candidate = staticMatch
    ? decodeURIComponent(staticMatch[1])
    : legacyPublicMatch
      ? decodeURIComponent(legacyPublicMatch[1])
      : staticAssetMatch
        ? decodeURIComponent(staticAssetMatch[1])
        : path.basename(normalized);
  const normalizedCandidate = normalizeText(candidate);
  if (!normalizedCandidate) return "";
  const normalizedUsername = normalizeText(username).toLowerCase();
  if (normalizedCandidate === `${normalizedUsername}.svg`) return normalizedCandidate;
  return normalizedCandidate;
}

async function resolveStaffPictureFilename(profile, username, photosDir) {
  const normalizedUsername = normalizeText(username).toLowerCase();
  const explicitFilename = normalizePictureFilename(profile?.picture ?? profile?.picture_ref, normalizedUsername);
  const candidates = explicitFilename
    ? [explicitFilename]
    : [`${normalizedUsername}.webp`, `${normalizedUsername}.svg`];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!isAllowedAssetFile(candidate)) continue;
    try {
      await stat(path.join(photosDir, candidate));
      return candidate;
    } catch {
      // try next
    }
  }
  return "";
}

function localizedEntriesFromMap(value, normalizer = (text) => normalizeText(text)) {
  return Object.entries(normalizeLocalizedTextMap(value, "en"))
    .map(([lang, text]) => ({ lang, value: normalizer(text) }))
    .filter((entry) => Boolean(entry.lang && entry.value));
}

function sortPublicProfiles(items) {
  return [...items].sort((left, right) => {
    const leftTeamOrder = safeInt(left?.team_order);
    const rightTeamOrder = safeInt(right?.team_order);
    if (leftTeamOrder !== null && rightTeamOrder !== null && leftTeamOrder !== rightTeamOrder) {
      return leftTeamOrder - rightTeamOrder;
    }
    if (leftTeamOrder !== null) return -1;
    if (rightTeamOrder !== null) return 1;
    const leftName = normalizeText(left?.name) || normalizeText(left?.full_name) || normalizeText(left?.username);
    const rightName = normalizeText(right?.name) || normalizeText(right?.full_name) || normalizeText(right?.username);
    const byName = leftName.localeCompare(rightName);
    if (byName !== 0) return byName;
    return normalizeText(left?.username).localeCompare(normalizeText(right?.username));
  });
}

async function generateTeamAssets({
  staffRoot = ATP_STAFF_ROOT,
  photosRoot = ATP_STAFF_PHOTOS_ROOT,
  outputRoot = TEAM_OUTPUT_DIR,
  outputFile = TEAM_OUTPUT_FILE
} = {}) {
  await cleanGeneratedAssetDir(outputRoot);
  await copyAllowedFiles(photosRoot, outputRoot);

  const staffPayload = await readJson(path.join(staffRoot, "staff.json"), { fallback: { staff: {} } });
  const staffMap = staffPayload && typeof staffPayload?.staff === "object" && !Array.isArray(staffPayload.staff)
    ? staffPayload.staff
    : {};
  const items = [];

  for (const [rawUsername, rawProfile] of Object.entries(staffMap)) {
    const username = normalizeText(rawProfile?.username || rawUsername).toLowerCase();
    if (!username) continue;
    const appearsInTeamWebPage = rawProfile?.appears_in_team_web_page !== false;
    if (!appearsInTeamWebPage) continue;

    const pictureFilename = await resolveStaffPictureFilename(rawProfile, username, photosRoot);
    if (!pictureFilename) {
      throw new Error(`Public staff profile "${username}" is missing a usable picture file in ${photosRoot}.`);
    }
    const pictureStats = await stat(path.join(outputRoot, pictureFilename));
    const pictureRef = `/assets/generated/homepage/team/${encodeURIComponent(pictureFilename)}?v=${encodeURIComponent(String(Math.trunc(pictureStats.mtimeMs)))}`;
    const positionMap = normalizeLocalizedTextMap(rawProfile?.position_i18n ?? rawProfile?.position, "en");
    const descriptionMap = normalizeLocalizedTextMap(rawProfile?.description_i18n ?? rawProfile?.description, "en");
    const shortDescriptionMap = normalizeLocalizedTextMap(rawProfile?.short_description_i18n ?? rawProfile?.short_description, "en");

    items.push({
      username,
      full_name: normalizeText(rawProfile?.full_name) || normalizeText(rawProfile?.name) || username,
      picture_ref: pictureRef,
      position: resolveLocalizedText(positionMap, "en", ""),
      position_i18n: localizedEntriesFromMap(positionMap),
      description: normalizeDisplayLineBreaks(resolveLocalizedText(descriptionMap, "en", "")),
      description_i18n: localizedEntriesFromMap(descriptionMap, (text) => normalizeDisplayLineBreaks(text)),
      short_description: normalizeDisplayLineBreaks(resolveLocalizedText(shortDescriptionMap, "en", "")),
      short_description_i18n: localizedEntriesFromMap(shortDescriptionMap, (text) => normalizeDisplayLineBreaks(text))
    });
  }

  const sortedItems = sortPublicProfiles(items);
  const payload = {
    items: sortedItems,
    total: sortedItems.length
  };
  const payloadSource = jsonWithTrailingNewline(payload);
  const payloadVersion = versionTokenForContent(payloadSource);
  await writeFile(outputFile, payloadSource, "utf8");

  return {
    count: sortedItems.length,
    assetUrl: buildVersionedGeneratedDataUrl(path.basename(outputFile), payloadVersion)
  };
}

export async function generatePublicHomepageAssets({
  toursRoot = TOURS_ROOT,
  staffRoot = ATP_STAFF_ROOT,
  countryReferenceInfoPath = COUNTRY_REFERENCE_INFO_PATH,
  frontendDataDir = FRONTEND_DATA_DIR,
  tourOutputDir = TOUR_OUTPUT_DIR,
  teamOutputDir = TEAM_OUTPUT_DIR,
  frontendI18nDir = FRONTEND_I18N_DIR,
  homepageCopyGlobalPath = HOMEPAGE_COPY_GLOBAL_PATH,
  homepageInitialBundlePath = "",
  languages = FRONTEND_LANGUAGE_CODES
} = {}) {
  const resolvedHomepageInitialBundlePath = normalizeText(homepageInitialBundlePath)
    || path.join(frontendDataDir, path.basename(HOMEPAGE_INITIAL_BUNDLE_PATH));
  await cleanGeneratedFrontendData(frontendDataDir);
  const tours = await generateTourAssets({
    toursRoot,
    outputRoot: tourOutputDir,
    frontendDataDir,
    countryReferenceInfoPath,
    frontendI18nDir,
    languages
  });
  const team = await generateTeamAssets({
    staffRoot,
    photosRoot: path.join(staffRoot, "photos"),
    outputRoot: teamOutputDir,
    outputFile: path.join(frontendDataDir, "public-team.json")
  });
  const homepageCopy = await writeHomepageCopyGlobalScript(homepageCopyGlobalPath, {
    heroTitleByLang: tours.heroTitleByLang,
    assetUrls: {
      toursByLang: tours.assetUrlsByLang,
      team: team.assetUrl
    }
  });
  await writeHomepageInitialBundleScript(resolvedHomepageInitialBundlePath);
  return { tours, team };
}

async function runCli() {
  const result = await generatePublicHomepageAssets();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await runCli();
}
