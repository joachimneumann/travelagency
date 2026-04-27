import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { createTourHelpers } from "../../backend/app/src/domain/tours_support.js";
import {
  buildDestinationScopeCatalogResponse,
  countryCodeToTourDestinationCode,
  filterDestinationScopeByTourDestinations
} from "../../backend/app/src/domain/destination_scope.js";
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
const CONTENT_ROOT = normalizeText(process.env.PUBLIC_HOMEPAGE_CONTENT_ROOT) || path.join(ROOT_DIR, "content");
const FRONTEND_I18N_DIR = path.join(ROOT_DIR, "frontend", "data", "i18n", "frontend");
const TOURS_ROOT = normalizeText(process.env.PUBLIC_HOMEPAGE_TOURS_ROOT) || path.join(CONTENT_ROOT, "tours");
const ATP_STAFF_ROOT = normalizeText(process.env.PUBLIC_HOMEPAGE_STAFF_ROOT) || path.join(CONTENT_ROOT, "atp_staff");
const ATP_STAFF_PROFILES_PATH = normalizeText(process.env.PUBLIC_HOMEPAGE_STAFF_PROFILES_PATH) || path.join(ATP_STAFF_ROOT, "staff.json");
const ATP_STAFF_PHOTOS_ROOT = normalizeText(process.env.PUBLIC_HOMEPAGE_STAFF_PHOTOS_DIR) || path.join(ATP_STAFF_ROOT, "photos");
const COUNTRY_REFERENCE_INFO_PATH = normalizeText(process.env.PUBLIC_HOMEPAGE_COUNTRY_REFERENCE_INFO_PATH) || path.join(CONTENT_ROOT, "country_reference_info.json");
const STORE_PATH = path.resolve(normalizeText(process.env.PUBLIC_HOMEPAGE_STORE_PATH || process.env.STORE_FILE) || path.join(ROOT_DIR, "backend", "app", "data", "store.json"));
const GENERATED_HOMEPAGE_DATA_DIR = path.join(ROOT_DIR, "frontend", "data", "generated", "homepage");
const GENERATED_HOMEPAGE_ASSETS_DIR = path.join(ROOT_DIR, "assets", "generated", "homepage");
const GENERATED_REELS_DATA_DIR = path.join(ROOT_DIR, "frontend", "data", "generated", "reels");
const GENERATED_REELS_ASSETS_DIR = path.join(ROOT_DIR, "assets", "generated", "reels");
const FRONTEND_DATA_DIR = normalizeText(process.env.PUBLIC_HOMEPAGE_FRONTEND_DATA_DIR) || GENERATED_HOMEPAGE_DATA_DIR;
const HOMEPAGE_ASSETS_DIR = normalizeText(process.env.PUBLIC_HOMEPAGE_ASSETS_DIR) || GENERATED_HOMEPAGE_ASSETS_DIR;
const TOUR_OUTPUT_DIR = path.join(HOMEPAGE_ASSETS_DIR, "tours");
const TEAM_OUTPUT_DIR = path.join(HOMEPAGE_ASSETS_DIR, "team");
const TEAM_OUTPUT_FILE = path.join(FRONTEND_DATA_DIR, "public-team.json");
const REELS_DATA_DIR = normalizeText(process.env.PUBLIC_REELS_FRONTEND_DATA_DIR) || GENERATED_REELS_DATA_DIR;
const REELS_ASSETS_DIR = normalizeText(process.env.PUBLIC_REELS_ASSETS_DIR) || GENERATED_REELS_ASSETS_DIR;
const REELS_MANIFEST_PATH = path.join(REELS_DATA_DIR, "public-reels.json");
const HOMEPAGE_COPY_GLOBAL_PATH = path.join(FRONTEND_DATA_DIR, "public-homepage-copy.global.js");
const HOMEPAGE_INITIAL_BUNDLE_PATH = path.join(FRONTEND_DATA_DIR, "public-homepage-main.bundle.js");
const HOMEPAGE_TEMPLATE_PATH = path.join(ROOT_DIR, "frontend", "pages", "index.html");
const HOMEPAGE_INDEX_PATH = path.join(FRONTEND_DATA_DIR, "index.html");
const SEO_OUTPUT_DIR = path.join(FRONTEND_DATA_DIR, "seo");
const SITEMAP_OUTPUT_PATH = path.join(FRONTEND_DATA_DIR, "sitemap.xml");
const DEFAULT_CLI_LOG_PATH = "/tmp/generate_public_homepage_assets.log";
const DEFAULT_TEAM_ORDER = 10;
const TOUR_FILE_PREFIX = "public-tours.";
const TOUR_FILE_SUFFIX = ".json";
const FOOTER_ALIGNED_TRAVEL_AGENCY_STRUCTURED_DATA = Object.freeze({
  "@id": "https://asiatravelplan.com/#travelagency",
  name: "AsiaTravelPlan",
  url: "https://asiatravelplan.com/",
  logo: "https://asiatravelplan.com/assets/img/logo-asiatravelplan.svg",
  image: "https://asiatravelplan.com/assets/video/rice%20field.webp",
  telephone: "+84 354999192",
  email: "info@asiatravelplan.com",
  identifier: Object.freeze({
    "@type": "PropertyValue",
    name: "License",
    value: "4001328591"
  }),
  address: Object.freeze([
    Object.freeze({
      "@type": "PostalAddress",
      name: "Head office in Hội An",
      streetAddress: "378/51 Cửa Đại",
      addressLocality: "Hội An Đông",
      addressRegion: "Đà Nẵng",
      addressCountry: "VN"
    }),
    Object.freeze({
      "@type": "PostalAddress",
      name: "Office in Hà Nội",
      streetAddress: "59 Đ. Lạc Long Quân",
      addressLocality: "Nghĩa Đô",
      postalCode: "100000",
      addressRegion: "Hà Nội",
      addressCountry: "VN"
    })
  ]),
  sameAs: Object.freeze([
    "https://www.facebook.com/people/Asiatravelplan/61586533685459/"
  ]),
  contactPoint: Object.freeze([
    Object.freeze({
      "@type": "ContactPoint",
      contactType: "travel support",
      telephone: "+84 354999192",
      email: "info@asiatravelplan.com",
      url: "https://wa.me/84354999192"
    })
  ])
});
const ALLOWED_ASSET_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const HOMEPAGE_TOUR_IMAGE_SIZE = 720;
const HOMEPAGE_TOUR_IMAGE_QUALITY = 68;
const REEL_POSTER_WIDTH = 720;
const backendAppRequire = createRequire(path.join(ROOT_DIR, "backend", "app", "package.json"));
const execFile = promisify(execFileCallback);
let sharpModulePromise = null;
let hasWarnedAboutMissingSharp = false;

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

function escapeHtmlText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value) {
  return escapeHtmlText(value)
    .replace(/"/g, "&quot;");
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugify(value, fallback = "page") {
  const slug = normalizeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || fallback;
}

function countryDisplayName(countryCode, lang) {
  const normalizedCountryCode = normalizeText(countryCode).toUpperCase();
  if (!normalizedCountryCode) return "";
  try {
    return normalizeText(new Intl.DisplayNames([normalizeTourLang(lang)], { type: "region" }).of(normalizedCountryCode))
      || normalizedCountryCode;
  } catch {
    return normalizedCountryCode;
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
    const entryName = entry.name;
    if (entry.isDirectory()) {
      if (entryName === path.basename(SEO_OUTPUT_DIR)) {
        await rm(path.join(frontendDataDir, entryName), { recursive: true, force: true });
      }
      continue;
    }
    if (!entry.isFile()) continue;
    if (
      entryName === "public-team.json"
      || entryName === path.basename(HOMEPAGE_INDEX_PATH)
      || entryName === path.basename(HOMEPAGE_COPY_GLOBAL_PATH)
      || entryName === "public-homepage-copy.manifest.json"
      || entryName === path.basename(HOMEPAGE_INITIAL_BUNDLE_PATH)
      || entryName === path.basename(SITEMAP_OUTPUT_PATH)
      || (entryName.startsWith(TOUR_FILE_PREFIX) && entryName.endsWith(TOUR_FILE_SUFFIX))
    ) {
      await rm(path.join(frontendDataDir, entryName), { force: true });
    }
  }
}

async function cleanGeneratedReelsData(reelsDataDir) {
  await ensureDirectory(reelsDataDir);
  const entries = await listDirectoryEntries(reelsDataDir);
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name === path.basename(REELS_MANIFEST_PATH)) {
      await rm(path.join(reelsDataDir, entry.name), { force: true });
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
    sharpModulePromise = (async () => {
      try {
        const sharpModulePath = backendAppRequire.resolve("sharp");
        const module = await import(pathToFileURL(sharpModulePath).href);
        return module.default || module;
      } catch (error) {
        if (!hasWarnedAboutMissingSharp) {
          hasWarnedAboutMissingSharp = true;
          console.warn(
            `[homepage-assets] sharp is unavailable (${String(error?.message || error)}). `
            + "Falling back to copying raster assets without resize/webp optimization."
          );
        }
        return null;
      }
    })();
  }
  return sharpModulePromise;
}

async function generateHomepageTourAssets(sourceDir, destinationDir) {
  await ensureDirectory(destinationDir);
  const generatedPathBySourceName = new Map();
  const sharp = await loadSharp();

  async function copyAssetsFromDirectory(currentSourceDir, relativeDir = "") {
    const entries = await listDirectoryEntries(currentSourceDir);
    for (const entry of entries) {
      const sourcePath = path.join(currentSourceDir, entry.name);
      const sourceRelativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        await copyAssetsFromDirectory(sourcePath, sourceRelativePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!isAllowedAssetFile(entry.name)) continue;

      const normalizedSourceRelativePath = sourceRelativePath.split(path.sep).join("/");
      if (!isRasterAssetFile(entry.name) || !sharp) {
        const destinationPath = path.join(destinationDir, sourceRelativePath);
        await ensureDirectory(path.dirname(destinationPath));
        await copyFile(sourcePath, destinationPath);
        generatedPathBySourceName.set(normalizedSourceRelativePath, normalizedSourceRelativePath);
        continue;
      }

      const outputRelativePath = path.join(relativeDir, `${path.parse(entry.name).name}.webp`);
      const normalizedOutputRelativePath = outputRelativePath.split(path.sep).join("/");
      const destinationPath = path.join(destinationDir, outputRelativePath);
      await ensureDirectory(path.dirname(destinationPath));
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
      generatedPathBySourceName.set(normalizedSourceRelativePath, normalizedOutputRelativePath);
    }
  }

  await copyAssetsFromDirectory(sourceDir);
  return generatedPathBySourceName;
}

function publishedDestinationCountryCodes(countryReferencePayload) {
  const publishedCountryCodes = new Set(DESTINATION_COUNTRY_CODES);
  for (const item of Array.isArray(countryReferencePayload?.items) ? countryReferencePayload.items : []) {
    const countryCode = normalizeText(item?.country).toUpperCase();
    if (!countryCode) continue;
    if (item?.published_on_webpage === false) publishedCountryCodes.delete(countryCode);
    else publishedCountryCodes.add(countryCode);
  }
  return DESTINATION_COUNTRY_CODES.filter((countryCode) => publishedCountryCodes.has(countryCode));
}

function destinationLabelsForCountryCodes(countryCodes, lang) {
  return (Array.isArray(countryCodes) ? countryCodes : [])
    .map((countryCode) => countryDisplayName(countryCode, lang))
    .filter(Boolean);
}

function visiblePublishedDestinationCodes(countryReferencePayload) {
  return new Set(
    publishedDestinationCountryCodes(countryReferencePayload)
      .map((countryCode) => normalizeTourDestinationCode(DESTINATION_COUNTRY_TO_TOUR_DESTINATION_CODE[countryCode]))
      .filter(Boolean)
  );
}

function publicDestinationScopeCatalog(store, destinationOptions, { lang = "en" } = {}) {
  const destinationSource = Array.isArray(store?.destination_scope_destinations)
    ? store.destination_scope_destinations
    : [];
  const synthesizedStore = {
    ...(store && typeof store === "object" && !Array.isArray(store) ? store : {}),
    destination_scope_destinations: destinationSource.length
      ? destinationSource
      : (Array.isArray(destinationOptions) ? destinationOptions : []).map((destination, index) => ({
        code: normalizeText(destination?.code || destination),
        label: normalizeText(destination?.label || destination?.code || destination),
        sort_order: index
      }))
  };
  const catalog = buildDestinationScopeCatalogResponse(synthesizedStore, { lang });
  const destinationCodes = new Set();
  const destinations = (Array.isArray(catalog.destinations) ? catalog.destinations : [])
    .map((destination) => {
      const countryCode = normalizeText(destination?.code).toUpperCase();
      const code = normalizeTourDestinationCode(countryCodeToTourDestinationCode(countryCode));
      if (!code) return null;
      destinationCodes.add(code);
      return {
        code,
        country_code: countryCode,
        label: normalizeText(destination?.label || destination?.name) || code
      };
    })
    .filter(Boolean);
  const areas = (Array.isArray(catalog.areas) ? catalog.areas : [])
    .map((area) => {
      const destination = normalizeTourDestinationCode(countryCodeToTourDestinationCode(area?.destination));
      const id = normalizeText(area?.id);
      if (!id || !destination || !destinationCodes.has(destination)) return null;
      return {
        id,
        destination,
        country_code: normalizeText(area?.destination).toUpperCase(),
        code: normalizeText(area?.code),
        label: normalizeText(area?.label || area?.name || area?.code) || id
      };
    })
    .filter(Boolean);
  const areaIds = new Set(areas.map((area) => area.id));
  const places = (Array.isArray(catalog.places) ? catalog.places : [])
    .map((place) => {
      const areaId = normalizeText(place?.area_id);
      const id = normalizeText(place?.id);
      if (!id || !areaId || !areaIds.has(areaId)) return null;
      return {
        id,
        area_id: areaId,
        code: normalizeText(place?.code),
        label: normalizeText(place?.label || place?.name || place?.code) || id
      };
    })
    .filter(Boolean);

  return { destinations, areas, places };
}

function normalizeTourForPublicHomepage(tour, publishedDestinationCodes, { normalizeTourForStorage, tourDestinationCodes }) {
  const stored = normalizeTourForStorage(tour);
  const visibleDestinations = tourDestinationCodes(stored).filter((code) => publishedDestinationCodes.has(code));
  if (!visibleDestinations.length) return null;
  const travelPlan = stored.travel_plan && typeof stored.travel_plan === "object" && !Array.isArray(stored.travel_plan)
    ? stored.travel_plan
    : {};
  return {
    ...stored,
    travel_plan: {
      ...travelPlan,
      destination_scope: filterDestinationScopeByTourDestinations(travelPlan.destination_scope, visibleDestinations)
    },
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

async function optionalVersionedStaticAssetPath(relativePath, outputRoot, options = {}) {
  try {
    return await versionedStaticAssetPath(relativePath, outputRoot, options);
  } catch (error) {
    if (!String(error?.message || "").startsWith("Missing generated asset:")) throw error;
    console.warn("[homepage-assets] Skipping missing generated tour image.", {
      relativePath: String(relativePath || "").replace(/^\/+/, ""),
      detail: String(error?.message || error)
    });
    return "";
  }
}

async function publicHomepageTourAssetUrl(imagePath, tourId, generatedTourAssetPaths, outputRoot, version) {
  const assetRelativePath = extractTourAssetRelativePath(imagePath, tourId);
  if (!assetRelativePath) return "";
  const generatedAssetRelativePath = generatedTourAssetPaths.get(assetRelativePath) || assetRelativePath;
  return optionalVersionedStaticAssetPath(generatedAssetRelativePath, outputRoot, {
    publicPrefix: "/assets/generated/homepage/tours",
    version
  });
}

async function publicHomepageTourImageRef(image, tourId, generatedTourAssetPaths, outputRoot, version) {
  if (!image) return null;
  if (typeof image === "string") {
    const imageUrl = await publicHomepageTourAssetUrl(image, tourId, generatedTourAssetPaths, outputRoot, version);
    return imageUrl ? { storage_path: imageUrl } : null;
  }
  if (typeof image !== "object" || Array.isArray(image)) return null;

  const sourcePath = normalizeText(image.storage_path || image.url || image.src);
  const imageUrl = await publicHomepageTourAssetUrl(sourcePath, tourId, generatedTourAssetPaths, outputRoot, version);
  return imageUrl
    ? {
        ...image,
        storage_path: imageUrl
      }
    : null;
}

async function publicHomepageTourService(service, tourId, generatedTourAssetPaths, outputRoot, version) {
  if (!service || typeof service !== "object" || Array.isArray(service)) return service;
  const next = { ...service };
  const image = await publicHomepageTourImageRef(next.image, tourId, generatedTourAssetPaths, outputRoot, version);
  if (image) next.image = image;
  else delete next.image;

  if (Array.isArray(next.images)) {
    const images = [];
    for (const item of next.images) {
      const imageItem = await publicHomepageTourImageRef(item, tourId, generatedTourAssetPaths, outputRoot, version);
      if (imageItem) images.push(imageItem);
    }
    if (images.length) next.images = images;
    else delete next.images;
  }
  return next;
}

async function publicHomepageTourTravelPlan(travelPlan, tourId, generatedTourAssetPaths, outputRoot, version) {
  if (!travelPlan || typeof travelPlan !== "object" || Array.isArray(travelPlan)) return travelPlan;
  const days = [];
  for (const day of Array.isArray(travelPlan.days) ? travelPlan.days : []) {
    if (!day || typeof day !== "object" || Array.isArray(day)) {
      days.push(day);
      continue;
    }
    const services = [];
    for (const service of Array.isArray(day.services) ? day.services : []) {
      services.push(await publicHomepageTourService(service, tourId, generatedTourAssetPaths, outputRoot, version));
    }
    days.push({
      ...day,
      services
    });
  }
  return {
    ...travelPlan,
    days
  };
}

async function buildHeroTitleByLang({
  publishedCountryCodes,
  frontendI18nDir = FRONTEND_I18N_DIR,
  languages = FRONTEND_LANGUAGE_CODES
} = {}) {
  const result = {};
  for (const lang of languages) {
    const normalizedLang = normalizeTourLang(lang);
    const dictionary = await readJson(path.join(frontendI18nDir, `${normalizedLang}.json`), {});
    const destinationLabels = destinationLabelsForCountryCodes(publishedCountryCodes, normalizedLang);
    const defaultTitle = normalizeText(dictionary["hero.title"]);
    const genericTitle = normalizeText(dictionary["hero.title_generic"]) || "Private Holidays in Southeast Asia";
    const titleTemplate = normalizeText(dictionary["hero.title_with_destinations"]) || defaultTitle || "Private holidays in {destinations}";
    result[normalizedLang] = destinationLabels.length
      ? interpolateTemplate(titleTemplate, {
        destinations: formatLocalizedList(destinationLabels, normalizedLang)
      })
      : genericTitle;
  }
  return result;
}

async function buildDestinationPromiseCopyByLang({
  publishedCountryCodes,
  frontendI18nDir = FRONTEND_I18N_DIR,
  languages = FRONTEND_LANGUAGE_CODES
} = {}) {
  const heroTitleByLang = await buildHeroTitleByLang({
    publishedCountryCodes,
    frontendI18nDir,
    languages
  });
  const metaTitleByLang = {};
  const metaDescriptionByLang = {};
  const destinationLabelsByLang = {};
  const allDestinationsSelected = publishedCountryCodes.length === DESTINATION_COUNTRY_CODES.length;

  for (const lang of languages) {
    const normalizedLang = normalizeTourLang(lang);
    const dictionary = await readJson(path.join(frontendI18nDir, `${normalizedLang}.json`), {});
    const destinationLabels = destinationLabelsForCountryCodes(publishedCountryCodes, normalizedLang);
    const destinationList = formatLocalizedList(destinationLabels, normalizedLang);
    const defaultTitle = normalizeText(dictionary["meta.home_title"]) || "AsiaTravelPlan | Custom Holidays";
    const defaultDescription = normalizeText(dictionary["meta.home_description"]);
    const heroTitle = normalizeText(heroTitleByLang[normalizedLang]);

    destinationLabelsByLang[normalizedLang] = destinationLabels;
    metaTitleByLang[normalizedLang] = allDestinationsSelected || !heroTitle
      ? defaultTitle
      : `AsiaTravelPlan | ${heroTitle}`;

    if (allDestinationsSelected && defaultDescription) {
      metaDescriptionByLang[normalizedLang] = defaultDescription;
    } else if (normalizedLang === "en" && destinationList) {
      metaDescriptionByLang[normalizedLang] = `Private holidays in ${destinationList} with clear pricing and local support. Book a free discovery call.`;
    } else {
      metaDescriptionByLang[normalizedLang] = heroTitle || defaultDescription || "Private tailor-made holidays with clear pricing and local support.";
    }
  }

  const englishDestinationLabels = destinationLabelsForCountryCodes(publishedCountryCodes, "en");
  const englishDestinationList = formatLocalizedList(englishDestinationLabels, "en");

  return {
    heroTitleByLang,
    metaTitleByLang,
    metaDescriptionByLang,
    destinationLabelsByLang,
    areaServed: englishDestinationLabels,
    travelAgencyDescription: englishDestinationList
      ? `Private travel agency in Vietnam creating custom holidays in ${englishDestinationList}.`
      : "Private travel agency in Vietnam creating custom holidays."
  };
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

function replaceHtmlAttribute(tag, attributeName, value) {
  const escapedValue = escapeHtmlAttribute(value);
  const attributePattern = new RegExp(`\\b${escapeRegExp(attributeName)}="[^"]*"`);
  if (attributePattern.test(tag)) {
    return tag.replace(attributePattern, `${attributeName}="${escapedValue}"`);
  }
  return tag.replace(/\/?>$/, (end) => ` ${attributeName}="${escapedValue}"${end}`);
}

function replaceTagAttributeByMarker(source, markerAttribute, markerValue, attributeName, value) {
  const markerPattern = new RegExp(
    `<[^>]+\\b${escapeRegExp(markerAttribute)}="${escapeRegExp(markerValue)}"[^>]*>`,
    "g"
  );
  return source.replace(markerPattern, (tag) => replaceHtmlAttribute(tag, attributeName, value));
}

function replaceHomepageStructuredData(source, copy) {
  return source.replace(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    (match, rawJson) => {
      let parsed;
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        return match;
      }
      if (parsed?.["@type"] !== "TravelAgency") return match;
      const next = {
        ...parsed,
        ...FOOTER_ALIGNED_TRAVEL_AGENCY_STRUCTURED_DATA,
        description: copy.travelAgencyDescription,
        areaServed: copy.areaServed
      };
      return [
        '    <script type="application/ld+json">',
        JSON.stringify(next, null, 6)
          .split("\n")
          .map((line) => `      ${line}`)
          .join("\n"),
        "    </script>"
      ].join("\n");
    }
  );
}

async function writeGeneratedHomepageHtml(templatePath, outputPath, copy) {
  const source = await readFile(templatePath, "utf8");
  const metaTitle = normalizeText(copy?.metaTitleByLang?.en) || "AsiaTravelPlan | Custom Holidays";
  const metaDescription = normalizeText(copy?.metaDescriptionByLang?.en)
    || "Private tailor-made holidays with clear pricing and local support.";
  const heroTitle = normalizeText(copy?.heroTitleByLang?.en) || "Private Holidays in Southeast Asia";

  let next = source
    .replace(/(<title\b[^>]*>)([\s\S]*?)(<\/title>)/, `$1${escapeHtmlText(metaTitle)}$3`)
    .replace(
      /(<h1\b(?=[^>]*\bid="heroTitle")[^>]*>)([\s\S]*?)(<\/h1>)/,
      `$1${escapeHtmlText(heroTitle)}$3`
    );

  next = replaceTagAttributeByMarker(next, "data-i18n-content-id", "meta.home_title", "content", metaTitle);
  next = replaceTagAttributeByMarker(next, "data-i18n-content-id", "meta.home_description", "content", metaDescription);
  next = replaceHomepageStructuredData(next, copy);

  await ensureDirectory(path.dirname(outputPath));
  await writeFile(outputPath, next, "utf8");
  return {
    version: versionTokenForContent(next)
  };
}

function canonicalUrl(pathname) {
  if (/^https?:\/\//i.test(String(pathname || ""))) return String(pathname);
  const normalizedPath = `/${String(pathname || "").replace(/^\/+/, "")}`;
  return `https://asiatravelplan.com${normalizedPath === "/" ? "/" : normalizedPath.replace(/\/+$/, "")}`;
}

function truncateSeoText(value, maxLength = 160) {
  const text = normalizeText(value).replace(/\s+/g, " ");
  const limit = Math.max(60, Number(maxLength) || 160);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trimEnd()}…`;
}

function tourSeoSlug(tour) {
  const id = normalizeText(tour?.id);
  const title = normalizeText(tour?.title) || id;
  const suffix = slugify(id.replace(/^tour[_-]?/i, ""), "tour").slice(0, 8);
  return `${slugify(title, "tour")}-${suffix}`;
}

function linkTag(href, label) {
  return `<a href="${escapeHtmlAttribute(href)}">${escapeHtmlText(label)}</a>`;
}

function seoPageShell({
  title,
  description,
  path: pagePath,
  heading,
  intro,
  image = "/assets/video/rice%20field.webp",
  body = "",
  schema = []
}) {
  const canonical = canonicalUrl(pagePath);
  const safeTitle = escapeHtmlText(title);
  const safeDescription = escapeHtmlAttribute(description);
  const defaultSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: canonical,
    isPartOf: {
      "@type": "WebSite",
      name: "AsiaTravelPlan",
      url: canonicalUrl("/")
    },
    publisher: {
      "@type": "TravelAgency",
      name: "AsiaTravelPlan",
      url: canonicalUrl("/")
    },
    primaryImageOfPage: canonicalUrl(image)
  };
  const schemas = [defaultSchema, ...(Array.isArray(schema) ? schema : [schema])]
    .filter(Boolean)
    .map((item) => `<script type="application/ld+json">${JSON.stringify(item)}</script>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <link rel="canonical" href="${escapeHtmlAttribute(canonical)}" />
    <meta property="og:title" content="${escapeHtmlAttribute(title)}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtmlAttribute(canonical)}" />
    <meta property="og:image" content="${escapeHtmlAttribute(canonicalUrl(image))}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtmlAttribute(title)}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${escapeHtmlAttribute(canonicalUrl(image))}" />
    <link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml" />
    <style>
      :root { color-scheme: light; --ink: #172026; --muted: #5d6b73; --line: #dfe7e8; --accent: #0d766e; --accent-strong: #0a5f59; --bg: #f6f8f7; }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: var(--ink); background: #fff; line-height: 1.6; }
      .topbar, .footer { background: #fff; border-bottom: 1px solid var(--line); }
      .footer { border-top: 1px solid var(--line); border-bottom: 0; }
      .wrap { width: min(1120px, calc(100% - 32px)); margin: 0 auto; }
      .topbar .wrap, .footer .wrap { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 18px 0; flex-wrap: wrap; }
      .brand { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); font-weight: 700; text-decoration: none; }
      .brand img { width: 132px; height: auto; display: block; }
      nav { display: flex; gap: 18px; flex-wrap: wrap; }
      nav a, .footer a { color: var(--accent-strong); text-decoration: none; font-weight: 700; }
      .hero { background: var(--bg); border-bottom: 1px solid var(--line); }
      .hero .wrap { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.8fr); gap: 32px; align-items: center; padding: 54px 0; }
      h1 { font-size: clamp(2rem, 5vw, 4rem); line-height: 1.05; margin: 0 0 18px; letter-spacing: 0; }
      h2 { font-size: clamp(1.5rem, 3vw, 2.2rem); line-height: 1.2; margin: 0 0 16px; letter-spacing: 0; }
      h3 { margin: 0 0 8px; line-height: 1.25; }
      p { margin: 0 0 16px; }
      .lede { font-size: 1.15rem; color: var(--muted); max-width: 68ch; }
      .hero img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 8px; }
      .section { padding: 44px 0; }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
      .card { border: 1px solid var(--line); border-radius: 8px; padding: 18px; background: #fff; min-width: 0; }
      .card img { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; border-radius: 6px; margin-bottom: 14px; }
      .meta { color: var(--muted); font-size: 0.94rem; }
      .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .tag { border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; font-size: 0.88rem; color: var(--muted); }
      .cta-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 22px; }
      .button { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 6px; text-decoration: none; font-weight: 700; }
      .button-primary { color: #fff; background: var(--accent-strong); }
      .button-secondary { color: var(--accent-strong); border: 1px solid var(--accent-strong); }
      @media (max-width: 820px) { .hero .wrap, .grid { grid-template-columns: 1fr; } }
    </style>
    ${schemas}
  </head>
  <body>
    <header class="topbar">
      <div class="wrap">
        <a class="brand" href="/"><img src="/assets/generated/runtime/brand-logo.png" alt="AsiaTravelPlan" width="165" height="68" /></a>
        <nav aria-label="SEO navigation">
          ${linkTag("/destinations", "Destinations")}
          ${linkTag("/travel-styles", "Travel styles")}
          ${linkTag("/tours", "Tours")}
          ${linkTag("/#contact", "Contact")}
        </nav>
      </div>
    </header>
    <main>
      <section class="hero">
        <div class="wrap">
          <div>
            <h1>${escapeHtmlText(heading)}</h1>
            <p class="lede">${escapeHtmlText(intro)}</p>
            <div class="cta-row">
              <a class="button button-primary" href="/#bookingModal">Plan your trip</a>
              <a class="button button-secondary" href="/#tours">View featured tours</a>
            </div>
          </div>
          <img src="${escapeHtmlAttribute(image)}" alt="" loading="eager" />
        </div>
      </section>
      ${body}
    </main>
    <footer class="footer">
      <div class="wrap">
        <p class="meta">AsiaTravelPlan plans tailor-made Southeast Asia journeys from Vietnam.</p>
        <p class="meta">${linkTag("mailto:info@asiatravelplan.com", "info@asiatravelplan.com")} · ${linkTag("https://wa.me/84354999192", "WhatsApp +84 354999192")}</p>
      </div>
    </footer>
  </body>
</html>
`;
}

function tourCardHtml(tour, { includeImage = true } = {}) {
  const title = normalizeText(tour?.title);
  const href = `/tours/${tourSeoSlug(tour)}`;
  const description = truncateSeoText(tour?.short_description, 150);
  const image = Array.isArray(tour?.pictures) ? normalizeText(tour.pictures[0]) : "";
  const tags = [
    ...(Array.isArray(tour?.destinations) ? tour.destinations : []),
    ...(Array.isArray(tour?.styles) ? tour.styles : [])
  ].map((tag) => `<span class="tag">${escapeHtmlText(tag)}</span>`).join("");
  return `<article class="card">
    ${includeImage && image ? `<a href="${escapeHtmlAttribute(href)}"><img src="${escapeHtmlAttribute(image)}" alt="${escapeHtmlAttribute(title)}" loading="lazy" /></a>` : ""}
    <h3>${linkTag(href, title)}</h3>
    ${description ? `<p class="meta">${escapeHtmlText(description)}</p>` : ""}
    ${tags ? `<div class="tags">${tags}</div>` : ""}
  </article>`;
}

function itemListSchema(items, mapper) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      ...mapper(item)
    }))
  };
}

function breadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path)
    }))
  };
}

async function writeSeoHtml(outputRoot, urlPath, html) {
  const relativePath = `${String(urlPath || "").replace(/^\/+/, "").replace(/\/+$/, "") || "index"}.html`;
  const outputPath = path.join(outputRoot, relativePath);
  await ensureDirectory(path.dirname(outputPath));
  await writeFile(outputPath, html, "utf8");
  return outputPath;
}

function sitemapXml(urlEntries) {
  const urls = urlEntries.map((entry) => {
    const parts = [
      "  <url>",
      `    <loc>${escapeXml(canonicalUrl(entry.path))}</loc>`
    ];
    if (entry.lastmod) parts.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
    if (entry.changefreq) parts.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
    if (entry.priority) parts.push(`    <priority>${escapeXml(entry.priority)}</priority>`);
    parts.push("  </url>");
    return parts.join("\n");
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

async function writeSeoSurfaceAssets({
  outputRoot = SEO_OUTPUT_DIR,
  sitemapOutputPath = SITEMAP_OUTPUT_PATH,
  payload,
  homepageCopy
} = {}) {
  await cleanGeneratedAssetDir(outputRoot);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const destinations = Array.isArray(payload?.available_destinations) ? payload.available_destinations : [];
  const styles = Array.isArray(payload?.available_styles) ? payload.available_styles : [];
  const sitemapEntries = [
    { path: "/", changefreq: "weekly", priority: "1.0" },
    { path: "/destinations", changefreq: "weekly", priority: "0.8" },
    { path: "/travel-styles", changefreq: "weekly", priority: "0.8" },
    { path: "/tours", changefreq: "weekly", priority: "0.9" },
    { path: "/privacy.html", changefreq: "yearly", priority: "0.3" }
  ];
  const defaultImage = "/assets/video/rice%20field.webp";

  const destinationCards = destinations.map((destination) => {
    const label = normalizeText(destination?.label || destination?.code);
    const code = normalizeText(destination?.code);
    const count = items.filter((tour) => Array.isArray(tour?.destination_codes) && tour.destination_codes.includes(code)).length;
    return `<article class="card"><h3>${linkTag(`/destinations/${slugify(code)}`, label)}</h3><p class="meta">${count} private tour${count === 1 ? "" : "s"} you can tailor.</p></article>`;
  }).join("");
  await writeSeoHtml(outputRoot, "/destinations", seoPageShell({
    title: "Private Travel Destinations | AsiaTravelPlan",
    description: "Browse the destinations currently published for private AsiaTravelPlan holidays.",
    path: "/destinations",
    heading: "Private travel destinations",
    intro: "Explore the destinations currently available on the public website and start from a route that can be tailored around your pace, hotels, guides, and budget.",
    image: defaultImage,
    body: `<section class="section"><div class="wrap"><div class="grid">${destinationCards}</div></div></section>`,
    schema: [
      breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Destinations", path: "/destinations" }]),
      itemListSchema(destinations, (destination) => ({
        name: normalizeText(destination?.label || destination?.code),
        url: canonicalUrl(`/destinations/${slugify(destination?.code)}`)
      }))
    ]
  }));

  const styleCards = styles.map((style) => {
    const label = normalizeText(style?.label || style?.code);
    const code = normalizeText(style?.code);
    const count = items.filter((tour) => Array.isArray(tour?.style_codes) && tour.style_codes.includes(code)).length;
    return `<article class="card"><h3>${linkTag(`/travel-styles/${slugify(code)}`, label)}</h3><p class="meta">${count} private tour${count === 1 ? "" : "s"} you can tailor.</p></article>`;
  }).join("");
  await writeSeoHtml(outputRoot, "/travel-styles", seoPageShell({
    title: "Private Travel Styles | AsiaTravelPlan",
    description: "Browse private AsiaTravelPlan holidays by travel style.",
    path: "/travel-styles",
    heading: "Private travel styles",
    intro: "Choose a travel style and use it as a starting point for a tailor-made route with local planning support.",
    image: defaultImage,
    body: `<section class="section"><div class="wrap"><div class="grid">${styleCards}</div></div></section>`,
    schema: [
      breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Travel styles", path: "/travel-styles" }]),
      itemListSchema(styles, (style) => ({
        name: normalizeText(style?.label || style?.code),
        url: canonicalUrl(`/travel-styles/${slugify(style?.code)}`)
      }))
    ]
  }));

  await writeSeoHtml(outputRoot, "/tours", seoPageShell({
    title: "Private Tours You Can Tailor | AsiaTravelPlan",
    description: "Browse private AsiaTravelPlan tours and use any route as a starting point for a tailor-made journey.",
    path: "/tours",
    heading: "Private tours you can tailor",
    intro: "Every route is a starting point. The planning team can adjust pace, hotels, transport, guides, activities, and budget.",
    image: defaultImage,
    body: `<section class="section"><div class="wrap"><div class="grid">${items.map((tour) => tourCardHtml(tour)).join("")}</div></div></section>`,
    schema: [
      breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Tours", path: "/tours" }]),
      itemListSchema(items, (tour) => ({
        name: normalizeText(tour?.title),
        url: canonicalUrl(`/tours/${tourSeoSlug(tour)}`)
      }))
    ]
  }));

  for (const destination of destinations) {
    const code = normalizeText(destination?.code);
    const label = normalizeText(destination?.label || code);
    const pathName = `/destinations/${slugify(code)}`;
    const matchingTours = items.filter((tour) => Array.isArray(tour?.destination_codes) && tour.destination_codes.includes(code));
    sitemapEntries.push({ path: pathName, changefreq: "weekly", priority: "0.8" });
    await writeSeoHtml(outputRoot, pathName, seoPageShell({
      title: `${label} Private Tours | AsiaTravelPlan`,
      description: `Private ${label} tours with clear pricing, tailored pacing, and local AsiaTravelPlan support.`,
      path: pathName,
      heading: `Private tours in ${label}`,
      intro: `Use these ${label} routes as starting points for a private journey shaped around your dates, comfort level, and travel style.`,
      image: normalizeText(matchingTours[0]?.pictures?.[0]) || defaultImage,
      body: `<section class="section"><div class="wrap"><h2>${escapeHtmlText(label)} tour ideas</h2><div class="grid">${matchingTours.map((tour) => tourCardHtml(tour)).join("")}</div></div></section>`,
      schema: [
        breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Destinations", path: "/destinations" }, { name: label, path: pathName }]),
        itemListSchema(matchingTours, (tour) => ({
          name: normalizeText(tour?.title),
          url: canonicalUrl(`/tours/${tourSeoSlug(tour)}`)
        }))
      ]
    }));
  }

  for (const style of styles) {
    const code = normalizeText(style?.code);
    const label = normalizeText(style?.label || code);
    const pathName = `/travel-styles/${slugify(code)}`;
    const matchingTours = items.filter((tour) => Array.isArray(tour?.style_codes) && tour.style_codes.includes(code));
    sitemapEntries.push({ path: pathName, changefreq: "weekly", priority: "0.7" });
    await writeSeoHtml(outputRoot, pathName, seoPageShell({
      title: `${label} Private Tours | AsiaTravelPlan`,
      description: `Private ${label.toLowerCase()} tours with tailored itineraries, clear pricing, and local support.`,
      path: pathName,
      heading: `${label} private tours`,
      intro: `Start with one of these ${label.toLowerCase()} routes, then adjust the hotels, activities, transfers, and pace with AsiaTravelPlan.`,
      image: normalizeText(matchingTours[0]?.pictures?.[0]) || defaultImage,
      body: `<section class="section"><div class="wrap"><h2>${escapeHtmlText(label)} tour ideas</h2><div class="grid">${matchingTours.map((tour) => tourCardHtml(tour)).join("")}</div></div></section>`,
      schema: [
        breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Travel styles", path: "/travel-styles" }, { name: label, path: pathName }]),
        itemListSchema(matchingTours, (tour) => ({
          name: normalizeText(tour?.title),
          url: canonicalUrl(`/tours/${tourSeoSlug(tour)}`)
        }))
      ]
    }));
  }

  for (const tour of items) {
    const slug = tourSeoSlug(tour);
    const pathName = `/tours/${slug}`;
    const title = normalizeText(tour?.title);
    const description = truncateSeoText(tour?.short_description || `${title} private tour by AsiaTravelPlan.`, 155);
    const image = normalizeText(tour?.pictures?.[0]) || defaultImage;
    const destinationLinks = (Array.isArray(tour?.destinations) ? tour.destinations : [])
      .map((label, index) => {
        const code = normalizeText(tour?.destination_codes?.[index]) || slugify(label);
        return linkTag(`/destinations/${slugify(code)}`, label);
      })
      .join(", ");
    const styleLinks = (Array.isArray(tour?.styles) ? tour.styles : [])
      .map((label, index) => {
        const code = normalizeText(tour?.style_codes?.[index]) || slugify(label);
        return linkTag(`/travel-styles/${slugify(code)}`, label);
      })
      .join(", ");
    const dayItems = Array.isArray(tour?.travel_plan?.days) ? tour.travel_plan.days : [];
    const dayList = dayItems.length
      ? `<section class="section"><div class="wrap"><h2>Route outline</h2><div class="grid">${dayItems.slice(0, 9).map((day, index) => `<article class="card"><h3>Day ${index + 1}${day?.title ? `: ${escapeHtmlText(day.title)}` : ""}</h3><p class="meta">${escapeHtmlText(truncateSeoText(day?.description || day?.summary || "", 150))}</p></article>`).join("")}</div></div></section>`
      : "";
    sitemapEntries.push({
      path: pathName,
      lastmod: normalizeText(tour?.updated_at || tour?.created_at).slice(0, 10),
      changefreq: "monthly",
      priority: "0.6"
    });
    await writeSeoHtml(outputRoot, pathName, seoPageShell({
      title: `${title} | AsiaTravelPlan`,
      description,
      path: pathName,
      heading: title,
      intro: description,
      image,
      body: `<section class="section"><div class="wrap"><h2>Tour snapshot</h2><div class="grid"><article class="card"><h3>Destinations</h3><p class="meta">${destinationLinks || "Tailor-made route"}</p></article><article class="card"><h3>Travel styles</h3><p class="meta">${styleLinks || "Private travel"}</p></article><article class="card"><h3>Planning</h3><p class="meta">Use this tour as a starting point and adapt it to your dates, pace, budget, hotels, and preferred activities.</p></article></div></div></section>${dayList}`,
      schema: [
        breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Tours", path: "/tours" }, { name: title, path: pathName }]),
        {
          "@context": "https://schema.org",
          "@type": "TouristTrip",
          name: title,
          description,
          image: canonicalUrl(image),
          url: canonicalUrl(pathName),
          provider: {
            "@type": "TravelAgency",
            name: "AsiaTravelPlan",
            url: canonicalUrl("/")
          },
          areaServed: homepageCopy?.areaServed || []
        }
      ]
    }));
  }

  await ensureDirectory(path.dirname(sitemapOutputPath));
  await writeFile(sitemapOutputPath, sitemapXml(sitemapEntries), "utf8");
  return {
    count: sitemapEntries.length,
    sitemapPath: sitemapOutputPath
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

function resolveTourReelSourcePath(tour, toursRoot = TOURS_ROOT) {
  const tourId = normalizeText(tour?.id);
  if (!tourId) return "";
  return path.join(toursRoot, tourId, "video.mp4");
}

async function extractReelPoster(sourcePath, posterPath) {
  await ensureDirectory(path.dirname(posterPath));
  await execFile("ffmpeg", [
    "-y",
    "-ss",
    "0.3",
    "-i",
    sourcePath,
    "-frames:v",
    "1",
    "-vf",
    `scale=${REEL_POSTER_WIDTH}:-2:flags=lanczos`,
    posterPath
  ]);
}

async function probeReelDurationSeconds(sourcePath) {
  const { stdout } = await execFile("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    sourcePath
  ]);
  const parsed = Number.parseFloat(String(stdout || "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

async function generateTourAssets({
  toursRoot = TOURS_ROOT,
  outputRoot = TOUR_OUTPUT_DIR,
  frontendDataDir = FRONTEND_DATA_DIR,
  countryReferenceInfoPath = COUNTRY_REFERENCE_INFO_PATH,
  storePath = STORE_PATH,
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
  const storePayload = await readJson(storePath, { fallback: {} });
  const publishedCountryCodes = publishedDestinationCountryCodes(countryReferencePayload);
  const publishedDestinationCodes = visiblePublishedDestinationCodes(countryReferencePayload);
  const publicTours = tours
    .map((tour) => normalizeTourForPublicHomepage(tour, publishedDestinationCodes, {
      normalizeTourForStorage,
      tourDestinationCodes
    }))
    .filter(Boolean);
  const sortedPublicTours = [...publicTours].sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0));
  const assetUrlsByLang = {};
  let seoPayload = null;

  for (const lang of languages) {
    const normalizedLang = normalizeTourLang(lang);
    const localizedItems = [];
    for (const tour of sortedPublicTours) {
      const readModel = normalizeTourForRead(tour, { lang: normalizedLang });
      const pictureCandidates = Array.isArray(readModel.pictures) && readModel.pictures.length
        ? readModel.pictures
        : [];
      const pictures = [];
      for (const picture of pictureCandidates) {
        const pictureUrl = await publicHomepageTourAssetUrl(
          picture,
          readModel.id,
          generatedTourAssetPaths,
          outputRoot,
          normalizeText(readModel.updated_at || readModel.created_at)
        );
        if (pictureUrl) pictures.push(pictureUrl);
      }
      const travelPlan = await publicHomepageTourTravelPlan(
        readModel.travel_plan,
        readModel.id,
        generatedTourAssetPaths,
        outputRoot,
        normalizeText(readModel.updated_at || readModel.created_at)
      );
      localizedItems.push({
        ...readModel,
        pictures,
        travel_plan: travelPlan
      });
    }
    const options = collectTourOptions(publicTours, { lang: normalizedLang });
    const destinationScopeCatalog = publicDestinationScopeCatalog(storePayload, options.destinations, { lang: normalizedLang });
    const payload = {
      items: localizedItems,
      available_destinations: options.destinations,
      available_destination_scope_catalog: destinationScopeCatalog,
      available_styles: options.styles,
      pagination: {
        page: 1,
        page_size: localizedItems.length,
        total_items: localizedItems.length,
        total_pages: 1
      }
    };
    if (normalizedLang === "en" || !seoPayload) {
      seoPayload = payload;
    }
    const filename = `${TOUR_FILE_PREFIX}${normalizedLang}${TOUR_FILE_SUFFIX}`;
    const outputPath = path.join(frontendDataDir, filename);
    const payloadSource = jsonWithTrailingNewline(payload);
    const payloadVersion = versionTokenForContent(payloadSource);
    await writeFile(outputPath, payloadSource, "utf8");
    assetUrlsByLang[normalizedLang] = buildVersionedGeneratedDataUrl(filename, payloadVersion);
  }

  const destinationPromiseCopy = await buildDestinationPromiseCopyByLang({
    publishedCountryCodes,
    frontendI18nDir,
    languages
  });

  return {
    count: publicTours.length,
    languages: languages.map((lang) => normalizeTourLang(lang)),
    publishedCountryCodes,
    destinationPromiseCopy,
    heroTitleByLang: destinationPromiseCopy.heroTitleByLang,
    seoPayload,
    assetUrlsByLang,
    publicTours: sortedPublicTours
  };
}

async function generateReelAssets({
  publicTours = [],
  toursRoot = TOURS_ROOT,
  outputRoot = REELS_ASSETS_DIR,
  reelsDataDir = REELS_DATA_DIR
} = {}) {
  await cleanGeneratedAssetDir(outputRoot);
  await cleanGeneratedReelsData(reelsDataDir);

  const items = [];
  for (const tour of Array.isArray(publicTours) ? publicTours : []) {
    const tourId = normalizeText(tour?.id);
    if (!tourId) continue;
    const sourcePath = resolveTourReelSourcePath(tour, toursRoot);
    try {
      const sourceStats = await stat(sourcePath);
      if (!sourceStats.isFile()) continue;
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    const videoRelativePath = path.join(tourId, "video.mp4");
    const posterRelativePath = path.join(tourId, "poster.jpg");
    const outputVideoPath = path.join(outputRoot, videoRelativePath);
    const outputPosterPath = path.join(outputRoot, posterRelativePath);
    await ensureDirectory(path.dirname(outputVideoPath));
    await copyFile(sourcePath, outputVideoPath);
    await extractReelPoster(outputVideoPath, outputPosterPath);

    const version = normalizeText(tour?.updated_at || tour?.created_at);
    items.push({
      tourId,
      videoUrl: await versionedStaticAssetPath(videoRelativePath, outputRoot, {
        publicPrefix: "/assets/generated/reels",
        version
      }),
      posterUrl: await versionedStaticAssetPath(posterRelativePath, outputRoot, {
        publicPrefix: "/assets/generated/reels",
        version
      }),
      duration: probeReelDurationSeconds(outputVideoPath)
    });
  }

  const resolvedItems = [];
  for (const item of items) {
    resolvedItems.push({
      ...item,
      duration: await item.duration
    });
  }

  const payload = {
    items: resolvedItems
  };
  const payloadSource = jsonWithTrailingNewline(payload);
  const payloadVersion = versionTokenForContent(payloadSource);
  await ensureDirectory(reelsDataDir);
  await writeFile(path.join(reelsDataDir, path.basename(REELS_MANIFEST_PATH)), payloadSource, "utf8");

  return {
    count: resolvedItems.length,
    assetUrl: buildVersionedGeneratedDataUrl(path.basename(REELS_MANIFEST_PATH), payloadVersion, {
      publicPrefix: "/frontend/data/generated/reels"
    })
  };
}

function normalizePictureFilename(rawValue) {
  const normalized = normalizeText(rawValue);
  if (!normalized) return "";
  const withoutCacheBuster = normalized.split(/[?#]/)[0];
  const staticMatch = withoutCacheBuster.match(/\/content\/atp_staff\/photos\/([^/?#]+)$/i);
  const legacyPublicMatch = withoutCacheBuster.match(/\/public\/v1\/atp-staff-photos\/([^/?#]+)$/i);
  const staticAssetMatch = withoutCacheBuster.match(/\/assets\/(?:generated\/homepage\/)?team\/([^/?#]+)$/i);
  const candidate = staticMatch
    ? decodeURIComponent(staticMatch[1])
    : legacyPublicMatch
      ? decodeURIComponent(legacyPublicMatch[1])
      : staticAssetMatch
        ? decodeURIComponent(staticAssetMatch[1])
        : path.basename(withoutCacheBuster);
  const normalizedCandidate = normalizeText(candidate);
  if (!normalizedCandidate) return "";
  return normalizedCandidate;
}

async function resolveStaffPictureFilename(profile, username, photosDir) {
  const normalizedUsername = normalizeText(username).toLowerCase();
  const explicitFilename = normalizePictureFilename(profile?.picture ?? profile?.picture_ref);
  const candidates = Array.from(new Set([explicitFilename, `${normalizedUsername}.webp`].filter(Boolean)));
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!isRasterAssetFile(candidate)) continue;
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
    const leftTeamOrder = safeInt(left?.team_order) ?? DEFAULT_TEAM_ORDER;
    const rightTeamOrder = safeInt(right?.team_order) ?? DEFAULT_TEAM_ORDER;
    if (leftTeamOrder !== rightTeamOrder) {
      return leftTeamOrder - rightTeamOrder;
    }
    const leftName = normalizeText(left?.name) || normalizeText(left?.username);
    const rightName = normalizeText(right?.name) || normalizeText(right?.username);
    const byName = leftName.localeCompare(rightName);
    if (byName !== 0) return byName;
    return normalizeText(left?.username).localeCompare(normalizeText(right?.username));
  });
}

async function generateTeamAssets({
  staffRoot = ATP_STAFF_ROOT,
  staffProfilesPath = "",
  photosRoot = ATP_STAFF_PHOTOS_ROOT,
  outputRoot = TEAM_OUTPUT_DIR,
  outputFile = TEAM_OUTPUT_FILE
} = {}) {
  await cleanGeneratedAssetDir(outputRoot);
  await copyAllowedFiles(photosRoot, outputRoot);

  const resolvedStaffProfilesPath = normalizeText(staffProfilesPath) || path.join(staffRoot, "staff.json");
  const staffPayload = await readJson(resolvedStaffProfilesPath, { fallback: { staff: {} } });
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
      name: normalizeText(rawProfile?.name) || username,
      team_order: safeInt(rawProfile?.team_order) ?? DEFAULT_TEAM_ORDER,
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
  staffProfilesPath = "",
  staffPhotosRoot = "",
  countryReferenceInfoPath = COUNTRY_REFERENCE_INFO_PATH,
  storePath = STORE_PATH,
  frontendDataDir = FRONTEND_DATA_DIR,
  tourOutputDir = TOUR_OUTPUT_DIR,
  teamOutputDir = TEAM_OUTPUT_DIR,
  reelsDataDir = "",
  reelOutputDir = "",
  frontendI18nDir = FRONTEND_I18N_DIR,
  homepageCopyGlobalPath = "",
  homepageInitialBundlePath = "",
  homepageTemplatePath = HOMEPAGE_TEMPLATE_PATH,
  homepageIndexPath = "",
  languages = FRONTEND_LANGUAGE_CODES
} = {}) {
  const resolvedHomepageInitialBundlePath = normalizeText(homepageInitialBundlePath)
    || path.join(frontendDataDir, path.basename(HOMEPAGE_INITIAL_BUNDLE_PATH));
  const resolvedHomepageIndexPath = normalizeText(homepageIndexPath)
    || path.join(frontendDataDir, path.basename(HOMEPAGE_INDEX_PATH));
  const resolvedHomepageCopyGlobalPath = normalizeText(homepageCopyGlobalPath)
    || path.join(frontendDataDir, path.basename(HOMEPAGE_COPY_GLOBAL_PATH));
  const resolvedReelsDataDir = normalizeText(reelsDataDir)
    || path.resolve(frontendDataDir, "..", "reels");
  const resolvedReelOutputDir = normalizeText(reelOutputDir)
    || path.resolve(tourOutputDir, "..", "..", "reels");
  const resolvedStaffProfilesPath = normalizeText(staffProfilesPath)
    || (staffRoot === ATP_STAFF_ROOT ? ATP_STAFF_PROFILES_PATH : path.join(staffRoot, "staff.json"));
  const resolvedStaffPhotosRoot = normalizeText(staffPhotosRoot)
    || (staffRoot === ATP_STAFF_ROOT ? ATP_STAFF_PHOTOS_ROOT : path.join(staffRoot, "photos"));
  await cleanGeneratedFrontendData(frontendDataDir);
  const tours = await generateTourAssets({
    toursRoot,
    outputRoot: tourOutputDir,
    frontendDataDir,
    countryReferenceInfoPath,
    storePath,
    frontendI18nDir,
    languages
  });
  const team = await generateTeamAssets({
    staffRoot,
    staffProfilesPath: resolvedStaffProfilesPath,
    photosRoot: resolvedStaffPhotosRoot,
    outputRoot: teamOutputDir,
    outputFile: path.join(frontendDataDir, "public-team.json")
  });
  const reels = await generateReelAssets({
    publicTours: tours.publicTours,
    toursRoot,
    outputRoot: resolvedReelOutputDir,
    reelsDataDir: resolvedReelsDataDir
  });
  const homepageCopyValue = {
    ...tours.destinationPromiseCopy,
    assetUrls: {
      toursByLang: tours.assetUrlsByLang,
      team: team.assetUrl,
      reels: reels.assetUrl
    }
  };
  const homepageCopy = await writeHomepageCopyGlobalScript(resolvedHomepageCopyGlobalPath, homepageCopyValue);
  const homepageHtml = await writeGeneratedHomepageHtml(homepageTemplatePath, resolvedHomepageIndexPath, homepageCopyValue);
  const seo = await writeSeoSurfaceAssets({
    outputRoot: path.join(frontendDataDir, path.basename(SEO_OUTPUT_DIR)),
    sitemapOutputPath: path.join(frontendDataDir, path.basename(SITEMAP_OUTPUT_PATH)),
    payload: tours.seoPayload,
    homepageCopy: homepageCopyValue
  });
  await writeHomepageInitialBundleScript(resolvedHomepageInitialBundlePath);
  return { tours, team, reels, homepageCopy, homepageHtml, seo };
}

async function runCli() {
  const result = await generatePublicHomepageAssets();
  const logPath = normalizeText(process.env.PUBLIC_HOMEPAGE_ASSET_GENERATOR_LOG) || DEFAULT_CLI_LOG_PATH;
  await ensureDirectory(path.dirname(logPath));
  await writeFile(logPath, `${JSON.stringify(result, null, 2)}\n`);
  if (process.env.PUBLIC_HOMEPAGE_ASSET_GENERATOR_QUIET === "1") return;
  process.stdout.write(
    `Generated public homepage assets: ${result.tours.count} tours, ${result.team.count} team members, ${result.reels.count} reels.\n`
    + `Full generation output: ${logPath}\n`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await runCli();
}
