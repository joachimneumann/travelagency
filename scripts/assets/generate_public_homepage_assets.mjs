import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { createTravelPlanHelpers } from "../../backend/app/src/domain/travel_plan.js";
import { createTourHelpers } from "../../backend/app/src/domain/tours_support.js";
import { createTourVariantHelpers } from "../../backend/app/src/domain/tour_variants.js";
import {
  buildDestinationScopeCatalogResponse,
  countryCodeToTourDestinationCode,
  destinationScopeTourDestinations,
  filterDestinationScopeByTourDestinations,
  mergeDestinationScopeWithTravelPlanLocations
} from "../../backend/app/src/domain/destination_scope.js";
import { selectTourExperienceHighlightIds } from "../../backend/app/src/domain/tour_metadata.js";
import {
  normalizeTourDestinationCode,
  normalizeTourLang
} from "../../backend/app/src/domain/tour_catalog_i18n.js";
import {
  applyMarketingTourTranslations,
  loadPublishedMarketingTourTranslations
} from "../../backend/app/src/domain/marketing_tour_translations.js";
import {
  createTranslationPhraseOverrideIndex,
  resolveTranslationPhraseOverride
} from "../../backend/app/src/lib/translation_phrase_overrides.js";
import {
  normalizeLocalizedTextMap,
  resolveLocalizedText
} from "../../backend/app/src/domain/booking_content_i18n.js";
import { PUBLIC_TOUR_PDF_CACHE_DIR } from "../../backend/app/src/config/runtime.js";
import { normalizeDisplayLineBreaks, normalizeText } from "../../backend/app/src/lib/text.js";
import {
  DESTINATION_COUNTRY_CODES,
  TOUR_DESTINATION_TO_COUNTRY_CODE
} from "../../shared/js/destination_country_codes.js";
import { FRONTEND_LANGUAGE_CODES } from "../../shared/generated/language_catalog.js";
import {
  serviceImageDerivativeRelativePath,
  writeServiceImageDerivative
} from "../lib/service_image_derivatives.mjs";

const ROOT_DIR = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const CONTENT_ROOT = normalizeText(process.env.PUBLIC_HOMEPAGE_CONTENT_ROOT) || path.join(ROOT_DIR, "content");
const PUBLIC_TOUR_PDF_CACHE_ROOT = normalizeText(
  process.env.PUBLIC_HOMEPAGE_PUBLIC_TOUR_PDF_CACHE_DIR
  || process.env.PUBLIC_TOUR_PDF_CACHE_DIR
) || PUBLIC_TOUR_PDF_CACHE_DIR;
const FRONTEND_I18N_DIR = path.join(ROOT_DIR, "frontend", "data", "i18n", "frontend");
const TOURS_ROOT = normalizeText(
  process.env.PUBLIC_HOMEPAGE_TOURS_ROOT
  || process.env.TOURS_DIR
  || process.env.TOURS_ROOT
) || path.join(CONTENT_ROOT, "tours");
const TOUR_VARIANTS_ROOT = normalizeText(
  process.env.PUBLIC_HOMEPAGE_TOUR_VARIANTS_ROOT
  || process.env.TOUR_VARIANTS_DIR
  || process.env.TOUR_VARIANTS_ROOT
) || path.join(CONTENT_ROOT, "tour_variants");
const ATP_STAFF_ROOT = normalizeText(process.env.PUBLIC_HOMEPAGE_STAFF_ROOT) || path.join(CONTENT_ROOT, "atp_staff");
const ATP_STAFF_PROFILES_PATH = normalizeText(process.env.PUBLIC_HOMEPAGE_STAFF_PROFILES_PATH) || path.join(ATP_STAFF_ROOT, "staff.json");
const ATP_STAFF_PHOTOS_ROOT = normalizeText(process.env.PUBLIC_HOMEPAGE_STAFF_PHOTOS_DIR) || path.join(ATP_STAFF_ROOT, "photos");
const COUNTRY_REFERENCE_INFO_PATH = normalizeText(process.env.PUBLIC_HOMEPAGE_COUNTRY_REFERENCE_INFO_PATH) || path.join(CONTENT_ROOT, "country_reference_info.json");
const DESTINATION_CATALOG_PATH = path.resolve(
  normalizeText(process.env.PUBLIC_HOMEPAGE_DESTINATION_CATALOG_PATH || process.env.TOUR_DESTINATIONS_PATH)
    || path.join(TOURS_ROOT, "destinations.json")
);
const TRANSLATIONS_SNAPSHOT_DIR = path.resolve(
  normalizeText(process.env.PUBLIC_HOMEPAGE_TRANSLATIONS_SNAPSHOT_DIR || process.env.TRANSLATIONS_SNAPSHOT_DIR)
    || path.join(CONTENT_ROOT, "translations")
);
const TRANSLATION_PHRASE_OVERRIDES_PATH = path.resolve(
  normalizeText(process.env.PUBLIC_HOMEPAGE_TRANSLATION_PHRASE_OVERRIDES_PATH || process.env.TRANSLATION_PHRASE_OVERRIDES_PATH)
    || path.join(ROOT_DIR, "config", "i18n", "translation_phrase_overrides.json")
);
const ONE_PAGERS_MANIFEST_PATH = path.resolve(
  normalizeText(process.env.PUBLIC_HOMEPAGE_ONE_PAGERS_MANIFEST_PATH || process.env.ONE_PAGERS_MANIFEST_PATH)
    || path.join(CONTENT_ROOT, "one-pagers", "manifest.json")
);
const ONE_PAGERS_PUBLIC_BASE_PATH = normalizeText(process.env.PUBLIC_HOMEPAGE_ONE_PAGERS_PUBLIC_BASE_PATH) || "/content/one-pagers";
const EXPERIENCE_HIGHLIGHTS_MANIFEST_PATH = path.join(ROOT_DIR, "assets", "img", "experience-highlights", "manifest.json");
const EXPERIENCE_HIGHLIGHTS_PUBLIC_BASE_PATH = "/assets/img/experience-highlights";
const EXPERIENCE_HIGHLIGHT_LIMIT = 4;
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
const TOUR_DESTINATIONS_FILE_PREFIX = "public-tour-destinations.";
const TOUR_DESTINATIONS_FILE_SUFFIX = ".json";
const DESTINATION_TRANSLATION_DOMAIN = "destination-scope-catalog";
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
    "https://www.facebook.com/asiatravelplan",
    "https://www.instagram.com/asia_travel.plan",
    "https://www.tiktok.com/@asia.travel.plan"
  ]),
  contactPoint: Object.freeze([
    Object.freeze({
      "@type": "ContactPoint",
      contactType: "travel support",
      telephone: "+84 354999192",
      email: "info@asiatravelplan.com"
    })
  ])
});
const ALLOWED_ASSET_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
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

function buildPublicPath(basePath, relativePath) {
  const normalizedBasePath = `/${normalizeText(basePath).replace(/^\/+|\/+$/g, "")}`;
  const normalizedRelativePath = normalizeText(relativePath).replace(/^\/+/, "");
  if (!normalizedRelativePath) return "";
  return `${normalizedBasePath}/${normalizedRelativePath.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function normalizeExperienceHighlightManifestItem(item, index) {
  const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  const image = normalizeText(source.image);
  const id = normalizeText(source.id) || image.replace(/\.[^.]+$/, "") || `highlight_${index + 1}`;
  if (!id || !image) return null;
  const title_i18n = normalizeLocalizedTextMap(source.title_i18n || source.title || {}, "en");
  const title = normalizeText(resolveLocalizedText(title_i18n, "en", "")) || normalizeText(source.title) || id;
  return {
    id,
    title,
    title_i18n,
    image,
    image_src: buildPublicPath(EXPERIENCE_HIGHLIGHTS_PUBLIC_BASE_PATH, image)
  };
}

async function loadExperienceHighlightCatalog(manifestPath = EXPERIENCE_HIGHLIGHTS_MANIFEST_PATH) {
  const payload = await readJson(manifestPath, { fallback: [] });
  const seen = new Set();
  return (Array.isArray(payload) ? payload : [])
    .map((item, index) => normalizeExperienceHighlightManifestItem(item, index))
    .filter((item) => {
      if (!item?.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

function normalizeOnePagerArtifactItem(item) {
  const source = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  const lang = normalizeTourLang(source.lang);
  const pdf = normalizeText(source.pdf);
  if (!lang || !pdf) return null;
  const selectedExperienceHighlightIds = (Array.isArray(source.selected_experience_highlight_ids)
    ? source.selected_experience_highlight_ids
    : [])
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .slice(0, EXPERIENCE_HIGHLIGHT_LIMIT);
  return {
    lang,
    pdf,
    selectedExperienceHighlightIds
  };
}

async function loadOnePagerArtifacts(manifestPath = ONE_PAGERS_MANIFEST_PATH) {
  const payload = await readJson(manifestPath, { fallback: { tours: [] } });
  const byTourId = new Map();
  for (const tour of Array.isArray(payload?.tours) ? payload.tours : []) {
    const tourId = normalizeText(tour?.id);
    if (!tourId) continue;
    const artifactsByLang = new Map();
    for (const artifact of Array.isArray(tour?.artifacts) ? tour.artifacts : []) {
      const normalizedArtifact = normalizeOnePagerArtifactItem(artifact);
      if (normalizedArtifact) artifactsByLang.set(normalizedArtifact.lang, normalizedArtifact);
    }
    if (artifactsByLang.size) byTourId.set(tourId, artifactsByLang);
  }
  return byTourId;
}

function onePagerArtifactForLang(artifactsByTourId, tourId, lang) {
  const artifactsByLang = artifactsByTourId instanceof Map ? artifactsByTourId.get(normalizeText(tourId)) : null;
  if (!(artifactsByLang instanceof Map)) return null;
  const normalizedLang = normalizeTourLang(lang);
  return artifactsByLang.get(normalizedLang) || artifactsByLang.get("en") || Array.from(artifactsByLang.values())[0] || null;
}

function localizedExperienceHighlightItem(item, lang) {
  if (!item) return null;
  const title = normalizeText(resolveLocalizedText(item.title_i18n, lang, item.title)) || item.title;
  if (!title || !item.image_src) return null;
  return {
    id: item.id,
    title,
    image_src: item.image_src
  };
}

function publicOnePagerExperienceHighlightSelection(highlightIds, catalog, lang) {
  const catalogById = new Map((Array.isArray(catalog) ? catalog : []).map((item) => [item.id, item]));
  const seen = new Set();
  const selectedIds = (Array.isArray(highlightIds) ? highlightIds : [])
    .map((value) => normalizeText(value))
    .filter((id) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .filter((id) => catalogById.has(id))
    .slice(0, EXPERIENCE_HIGHLIGHT_LIMIT);
  return {
    ids: selectedIds,
    items: selectedIds
      .map((id) => localizedExperienceHighlightItem(catalogById.get(id), lang))
      .filter(Boolean)
  };
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
      || (entryName.startsWith(TOUR_DESTINATIONS_FILE_PREFIX) && entryName.endsWith(TOUR_DESTINATIONS_FILE_SUFFIX))
      || (entryName.startsWith("public-tour-details.") && entryName.endsWith(".json"))
    ) {
      await rm(path.join(frontendDataDir, entryName), { force: true });
    }
  }
}

async function clearPublicTourPdfCache(cacheDir) {
  const normalizedCacheDir = normalizeText(cacheDir);
  if (!normalizedCacheDir) return;
  await rm(normalizedCacheDir, { recursive: true, force: true });
  await ensureDirectory(normalizedCacheDir);
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

function isTourRootAssetRelativePath(relativePath, tourId) {
  const normalizedTourId = normalizeText(tourId);
  const normalizedPath = normalizeText(relativePath).split("?")[0].replace(/^\/+/, "");
  if (!normalizedTourId || !normalizedPath) return false;
  const parts = normalizedPath.split("/").filter(Boolean);
  return parts.length === 2 && parts[0] === normalizedTourId && isAllowedAssetFile(parts[1]);
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
  const generatedThumbnailPathBySourceName = new Map();
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
      if (!relativeDir) continue;

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
      await writeServiceImageDerivative(sourcePath, destinationPath, {
        variant: "homepage-card",
        sharp
      });
      generatedPathBySourceName.set(normalizedSourceRelativePath, normalizedOutputRelativePath);

      const thumbnailRelativePath = serviceImageDerivativeRelativePath(normalizedSourceRelativePath, {
        variant: "customizer-thumb"
      });
      if (thumbnailRelativePath) {
        const destinationThumbnailPath = path.join(destinationDir, thumbnailRelativePath);
        await writeServiceImageDerivative(sourcePath, destinationThumbnailPath, {
          variant: "customizer-thumb",
          sharp
        });
        generatedThumbnailPathBySourceName.set(
          normalizedSourceRelativePath,
          thumbnailRelativePath.split(path.sep).join("/")
        );
      }
    }
  }

  await copyAssetsFromDirectory(sourceDir);
  return {
    assets: generatedPathBySourceName,
    thumbnails: generatedThumbnailPathBySourceName
  };
}

function destinationLabelsForCountryCodes(countryCodes, lang) {
  return (Array.isArray(countryCodes) ? countryCodes : [])
    .map((countryCode) => countryDisplayName(countryCode, lang))
    .filter(Boolean);
}

function publicTourCountryCodes(publicTours) {
  const countryCodes = new Set();
  for (const tour of Array.isArray(publicTours) ? publicTours : []) {
    for (const destination of Array.isArray(tour?.destinations) ? tour.destinations : []) {
      const countryCode = TOUR_DESTINATION_TO_COUNTRY_CODE[normalizeTourDestinationCode(destination)]
        || normalizeText(destination).toUpperCase();
      if (DESTINATION_COUNTRY_CODES.includes(countryCode)) {
        countryCodes.add(countryCode);
      }
    }
  }
  return DESTINATION_COUNTRY_CODES.filter((countryCode) => countryCodes.has(countryCode));
}

function catalogDestinationTourCode(destination) {
  const rawCode = normalizeText(destination?.code || destination);
  if (!rawCode) return "";
  return normalizeTourDestinationCode(rawCode)
    || normalizeText(countryCodeToTourDestinationCode(rawCode)).toLowerCase();
}

function destinationCatalogTourDestinationCodes(destinationCatalogPayload) {
  return new Set(
    (Array.isArray(destinationCatalogPayload?.destination_scope_destinations)
      ? destinationCatalogPayload.destination_scope_destinations
      : [])
      .map(catalogDestinationTourCode)
      .filter(Boolean)
  );
}

function assertTourDestinationsListedInCatalog(tours, destinationCatalogPayload, {
  destinationCatalogPath = ""
} = {}) {
  const allowedDestinations = destinationCatalogTourDestinationCodes(destinationCatalogPayload);
  const rawPlaceDestinationById = new Map(
    (Array.isArray(destinationCatalogPayload?.destination_places) ? destinationCatalogPayload.destination_places : [])
      .map((place) => [normalizeText(place?.id), normalizeTourDestinationCode(countryCodeToTourDestinationCode(place?.destination))])
      .filter(([placeId, destination]) => placeId && destination)
  );
  const missingByTour = [];
  for (const tour of Array.isArray(tours) ? tours : []) {
    const destinationScope = mergeDestinationScopeWithTravelPlanLocations([], tour?.travel_plan, destinationCatalogPayload);
    const referencedLocationDestinations = [];
    for (const day of Array.isArray(tour?.travel_plan?.days) ? tour.travel_plan.days : []) {
      for (const locationId of [day?.primary_location_id, day?.secondary_location_id]) {
        const destination = rawPlaceDestinationById.get(normalizeText(locationId));
        if (destination) referencedLocationDestinations.push(destination);
      }
    }
    const missingCodes = [
      ...destinationScopeTourDestinations(destinationScope),
      ...referencedLocationDestinations
    ]
      .filter((code) => code && !allowedDestinations.has(code));
    if (missingCodes.length) {
      missingByTour.push(`${normalizeText(tour?.id) || "(missing id)"}: ${Array.from(new Set(missingCodes)).join(", ")}`);
    }
  }
  if (!missingByTour.length) return;

  const catalogLabel = normalizeText(destinationCatalogPath)
    ? path.relative(ROOT_DIR, destinationCatalogPath)
    : "the tour destination catalog";
  throw new Error(
    "Cannot generate public homepage assets because some tours use destinations that are not listed in "
      + `${catalogLabel}: ${missingByTour.join("; ")}.`
  );
}

function publicTourDestinationScopeFilters(tours) {
  const destinationCodes = new Set();
  const regionIds = new Set();
  const placeIds = new Set();
  for (const tour of Array.isArray(tours) ? tours : []) {
    const scope = Array.isArray(tour?.travel_plan?.destination_scope)
      ? tour.travel_plan.destination_scope
      : [];
    for (const entry of scope) {
      const destinationCode = normalizeTourDestinationCode(countryCodeToTourDestinationCode(entry?.destination));
      if (destinationCode) destinationCodes.add(destinationCode);
      for (const region of Array.isArray(entry?.regions) ? entry.regions : []) {
        const regionId = normalizeText(region?.region_id || region?.id);
        if (regionId) regionIds.add(regionId);
        for (const place of Array.isArray(region?.places) ? region.places : []) {
          const placeId = normalizeText(place?.place_id || place?.id);
          if (placeId) placeIds.add(placeId);
        }
      }
      for (const place of Array.isArray(entry?.places) ? entry.places : []) {
        const placeId = normalizeText(place?.place_id || place?.id);
        if (placeId) placeIds.add(placeId);
      }
    }
  }
  return { destinationCodes, regionIds, placeIds };
}

function publicDestinationScopeCatalog(store, destinationOptions, { lang = "en", scopeFilters = null } = {}) {
  const hasDestinationOptions = Array.isArray(destinationOptions);
  const scopedDestinationCodes = scopeFilters?.destinationCodes instanceof Set ? scopeFilters.destinationCodes : null;
  const scopedRegionIds = scopeFilters?.regionIds instanceof Set ? scopeFilters.regionIds : null;
  const scopedPlaceIds = scopeFilters?.placeIds instanceof Set ? scopeFilters.placeIds : null;
  const allowedDestinationCodes = scopedDestinationCodes || new Set(
    (hasDestinationOptions ? destinationOptions : [])
      .map((destination) => normalizeTourDestinationCode(destination?.code || destination))
      .filter(Boolean)
  );
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
      if ((hasDestinationOptions || scopedDestinationCodes) && !allowedDestinationCodes.has(code)) return null;
      destinationCodes.add(code);
      return {
        code,
        country_code: countryCode,
        label: normalizeText(destination?.label || destination?.name) || code
      };
    })
    .filter(Boolean);
  const regions = (Array.isArray(catalog.regions) ? catalog.regions : [])
    .map((region) => {
      const destination = normalizeTourDestinationCode(countryCodeToTourDestinationCode(region?.destination));
      const id = normalizeText(region?.id);
      if (!id || !destination || !destinationCodes.has(destination)) return null;
      if (scopedRegionIds && !scopedRegionIds.has(id)) return null;
      return {
        id,
        destination,
        country_code: normalizeText(region?.destination).toUpperCase(),
        code: normalizeText(region?.code),
        label: normalizeText(region?.label || region?.name || region?.code) || id
      };
    })
    .filter(Boolean);
  const regionIds = new Set(regions.map((region) => region.id));
  const places = (Array.isArray(catalog.places) ? catalog.places : [])
    .map((place) => {
      const regionId = normalizeText(place?.region_id);
      const destination = normalizeTourDestinationCode(countryCodeToTourDestinationCode(place?.destination));
      const id = normalizeText(place?.id);
      if (!id || !destination || !destinationCodes.has(destination) || (regionId && !regionIds.has(regionId))) return null;
      if (scopedPlaceIds && !scopedPlaceIds.has(id)) return null;
      return {
        id,
        destination,
        country_code: normalizeText(place?.destination).toUpperCase(),
        ...(regionId ? { region_id: regionId } : {}),
        code: normalizeText(place?.code),
        label: normalizeText(place?.label || place?.name || place?.code) || id,
        ...(Number.isFinite(Number(place?.latitude)) ? { latitude: Number(place.latitude) } : {}),
        ...(Number.isFinite(Number(place?.longitude)) ? { longitude: Number(place.longitude) } : {})
      };
    })
    .filter(Boolean);

  return { destinations, regions, places };
}

function snapshotItems(payload) {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.items) ? payload.items : [];
}

function destinationTranslationKeyFromSourceRef(value) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  const prefix = `${DESTINATION_TRANSLATION_DOMAIN}:`;
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
}

async function loadTranslationPhraseOverrideIndex(phraseOverridesPath) {
  const normalizedPath = normalizeText(phraseOverridesPath);
  if (!normalizedPath) return createTranslationPhraseOverrideIndex({ items: [] });
  return createTranslationPhraseOverrideIndex(await readJson(normalizedPath, { fallback: { items: [] } }));
}

async function loadPublishedDestinationScopeCatalogTranslations(translationsSnapshotDir, languages, phraseOverridesPath = "") {
  const mapsByLang = new Map();
  const root = normalizeText(translationsSnapshotDir);
  const phraseOverrideIndex = await loadTranslationPhraseOverrideIndex(phraseOverridesPath);
  const uniqueLanguages = Array.from(new Set(
    (Array.isArray(languages) ? languages : [])
      .map((lang) => normalizeTourLang(lang))
      .filter((lang) => lang && lang !== "en")
  ));

  await Promise.all(uniqueLanguages.map(async (lang) => {
    const byKey = new Map();
    const bySource = new Map();
    if (root) {
      const snapshotPath = path.join(root, "customers", `tour-destinations.${lang}.json`);
      const payload = await readJson(snapshotPath, { fallback: { items: [] } });
      for (const item of snapshotItems(payload)) {
        const targetText = normalizeText(item?.target_text);
        if (!targetText) continue;
        const key = normalizeText(item?.key) || destinationTranslationKeyFromSourceRef(item?.source_ref);
        const sourceText = normalizeText(item?.source_text);
        if (key) byKey.set(key, targetText);
        if (sourceText) bySource.set(sourceText, targetText);
      }
    }
    mapsByLang.set(lang, { lang, byKey, bySource, phraseOverrideIndex });
  }));
  return mapsByLang;
}

function destinationCatalogTranslation(translations, key, sourceText) {
  if (!translations || typeof translations !== "object") return "";
  const normalizedKey = normalizeText(key);
  const normalizedSource = normalizeText(sourceText);
  const phraseOverride = normalizedSource
    ? resolveTranslationPhraseOverride(translations.phraseOverrideIndex, {
        target_lang: translations.lang,
        source_phrase: normalizedSource
      })
    : null;
  return normalizeText(
    normalizeText(phraseOverride?.target_phrase)
    || (normalizedKey && translations.byKey instanceof Map ? translations.byKey.get(normalizedKey) : "")
    || (normalizedSource && translations.bySource instanceof Map ? translations.bySource.get(normalizedSource) : "")
  );
}

function applyDestinationScopeCatalogTranslations(catalog, lang, translationsByLang) {
  const normalizedLang = normalizeTourLang(lang);
  if (!normalizedLang || normalizedLang === "en") return catalog;
  const translations = translationsByLang instanceof Map ? translationsByLang.get(normalizedLang) : null;
  if (!translations) return catalog;
  return {
    destinations: (Array.isArray(catalog?.destinations) ? catalog.destinations : []).map((destination) => {
      const countryCode = normalizeText(destination?.country_code).toUpperCase();
      const translated = destinationCatalogTranslation(
        translations,
        countryCode ? `destination.${countryCode}.label` : "",
        destination?.label
      );
      return translated ? { ...destination, label: translated } : destination;
    }),
    regions: (Array.isArray(catalog?.regions) ? catalog.regions : []).map((region) => {
      const id = normalizeText(region?.id);
      const translated = destinationCatalogTranslation(
        translations,
        id ? `region.${id}.name` : "",
        region?.label
      );
      return translated ? { ...region, label: translated } : region;
    }),
    places: (Array.isArray(catalog?.places) ? catalog.places : []).map((place) => {
      const id = normalizeText(place?.id);
      const translated = destinationCatalogTranslation(
        translations,
        id ? `place.${id}.name` : "",
        place?.label
      );
      return translated ? { ...place, label: translated } : place;
    })
  };
}

function normalizeTourForPublicHomepage(tour, { normalizeTourForStorage, destinationCatalogPayload }) {
  const stored = normalizeTourForStorage(tour);
  if (stored.published_on_webpage === false) return null;
  const travelPlan = stored.travel_plan && typeof stored.travel_plan === "object" && !Array.isArray(stored.travel_plan)
    ? stored.travel_plan
    : {};
  const destination_scope = mergeDestinationScopeWithTravelPlanLocations(
    [],
    travelPlan,
    destinationCatalogPayload
  );
  const visibleDestinations = destinationScopeTourDestinations(destination_scope);
  if (!visibleDestinations.length) return null;
  return {
    ...stored,
    travel_plan: {
      ...travelPlan,
      destination_scope: filterDestinationScopeByTourDestinations(destination_scope, visibleDestinations)
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
  const firstSegment = bareValue.split("/").filter(Boolean)[0] || "";
  if (firstSegment.startsWith("tour_") && bareValue.includes("/")) return bareValue;
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
  if (isTourRootAssetRelativePath(assetRelativePath, tourId)) return "";
  const generatedAssetRelativePath = generatedTourAssetPaths.get(assetRelativePath) || assetRelativePath;
  return optionalVersionedStaticAssetPath(generatedAssetRelativePath, outputRoot, {
    publicPrefix: "/assets/generated/homepage/tours",
    version
  });
}

async function publicHomepageTourThumbnailUrl(imagePath, tourId, generatedTourThumbnailAssetPaths, outputRoot, version) {
  const assetRelativePath = extractTourAssetRelativePath(imagePath, tourId);
  if (!assetRelativePath) return "";
  if (isTourRootAssetRelativePath(assetRelativePath, tourId)) return "";
  const generatedThumbnailRelativePath = generatedTourThumbnailAssetPaths.get(assetRelativePath);
  if (!generatedThumbnailRelativePath) return "";
  return optionalVersionedStaticAssetPath(generatedThumbnailRelativePath, outputRoot, {
    publicPrefix: "/assets/generated/homepage/tours",
    version
  });
}

async function publicHomepageTourImageRef(
  image,
  tourId,
  generatedTourAssetPaths,
  generatedTourThumbnailAssetPaths,
  outputRoot,
  version
) {
  if (!image) return null;
  if (typeof image === "string") {
    const imageUrl = await publicHomepageTourAssetUrl(image, tourId, generatedTourAssetPaths, outputRoot, version);
    const thumbnailUrl = await publicHomepageTourThumbnailUrl(
      image,
      tourId,
      generatedTourThumbnailAssetPaths,
      outputRoot,
      version
    );
    return imageUrl
      ? {
          storage_path: imageUrl,
          ...(thumbnailUrl ? { thumbnail_storage_path: thumbnailUrl } : {})
        }
      : null;
  }
  if (typeof image !== "object" || Array.isArray(image)) return null;

  const sourcePath = normalizeText(image.storage_path || image.url || image.src);
  const imageUrl = await publicHomepageTourAssetUrl(sourcePath, tourId, generatedTourAssetPaths, outputRoot, version);
  const thumbnailUrl = await publicHomepageTourThumbnailUrl(
    sourcePath,
    tourId,
    generatedTourThumbnailAssetPaths,
    outputRoot,
    version
  );
  const { thumbnail_storage_path: _thumbnailStoragePath, ...imagePayload } = image;
  return imageUrl
    ? {
        ...imagePayload,
        storage_path: imageUrl,
        ...(thumbnailUrl ? { thumbnail_storage_path: thumbnailUrl } : {})
      }
    : null;
}

async function publicHomepageTourService(
  service,
  tourId,
  generatedTourAssetPaths,
  generatedTourThumbnailAssetPaths,
  outputRoot,
  version
) {
  if (!service || typeof service !== "object" || Array.isArray(service)) return service;
  const next = { ...service };
  const image = await publicHomepageTourImageRef(
    next.image,
    tourId,
    generatedTourAssetPaths,
    generatedTourThumbnailAssetPaths,
    outputRoot,
    version
  );
  if (image) next.image = image;
  else delete next.image;

  if (Array.isArray(next.images)) {
    const images = [];
    for (const item of next.images) {
      const imageItem = await publicHomepageTourImageRef(
        item,
        tourId,
        generatedTourAssetPaths,
        generatedTourThumbnailAssetPaths,
        outputRoot,
        version
      );
      if (imageItem) images.push(imageItem);
    }
    if (images.length) next.images = images;
    else delete next.images;
  }
  return next;
}

async function publicHomepageTourTravelPlan(
  travelPlan,
  tourId,
  generatedTourAssetPaths,
  generatedTourThumbnailAssetPaths,
  outputRoot,
  version
) {
  if (!travelPlan || typeof travelPlan !== "object" || Array.isArray(travelPlan)) return travelPlan;
  async function renderPublicTourService(service) {
    return publicHomepageTourService(
      service,
      tourId,
      generatedTourAssetPaths,
      generatedTourThumbnailAssetPaths,
      outputRoot,
      version
    );
  }
  const days = [];
  for (const day of Array.isArray(travelPlan.days) ? travelPlan.days : []) {
    if (!day || typeof day !== "object" || Array.isArray(day)) {
      days.push(day);
      continue;
    }
    const daySourceTourId = normalizeText(day.source_tour_id) || tourId;
    const services = [];
    for (const service of Array.isArray(day.services) ? day.services : []) {
      services.push(await publicHomepageTourService(
        service,
        daySourceTourId,
        generatedTourAssetPaths,
        generatedTourThumbnailAssetPaths,
        outputRoot,
        version
      ));
    }
    days.push({
      ...day,
      services
    });
  }
  const boundaryLogistics = travelPlan.boundary_logistics && typeof travelPlan.boundary_logistics === "object" && !Array.isArray(travelPlan.boundary_logistics)
    ? Object.fromEntries(await Promise.all(Object.entries(travelPlan.boundary_logistics).map(async ([boundaryKind, service]) => ([
        boundaryKind,
        service && typeof service === "object" && !Array.isArray(service)
          ? await renderPublicTourService(service)
          : service
      ]))))
    : null;
  return {
    ...travelPlan,
    ...(boundaryLogistics ? { boundary_logistics: boundaryLogistics } : {}),
    days
  };
}

function publicHomepageTourListItem(readModel, travelPlan, pictures, detailsUrl, seoSlug = "") {
  const {
    image: _image,
    travel_plan: _travelPlan,
    ...listItem
  } = readModel || {};
  const days = Array.isArray(travelPlan?.days) ? travelPlan.days : [];
  return {
    ...listItem,
    seo_slug: normalizeText(seoSlug) || tourSeoSlug(readModel),
    pictures,
    destination_scope: Array.isArray(travelPlan?.destination_scope) ? travelPlan.destination_scope : [],
    travel_plan_day_count: days.length,
    has_travel_plan_details: days.length > 0,
    travel_plan_details_url: detailsUrl
  };
}

function selectedTravelTourCardImagePaths(travelPlan) {
  const selectedImageIds = Array.from(new Set((Array.isArray(travelPlan?.tour_card_image_ids) ? travelPlan.tour_card_image_ids : [])
    .map((value) => normalizeText(value))
    .filter(Boolean)));
  const entries = [];
  const seen = new Set();
  for (const day of Array.isArray(travelPlan?.days) ? travelPlan.days : []) {
    for (const service of Array.isArray(day?.services) ? day.services : []) {
      const candidates = [
        service?.image,
        ...(Array.isArray(service?.images)
          ? [...service.images].sort((left, right) => Number(left?.sort_order || 0) - Number(right?.sort_order || 0))
          : [])
      ];
      for (const image of candidates) {
        if (!image || typeof image !== "object" || Array.isArray(image)) continue;
        if (image.include_in_travel_tour_card !== true || image.is_customer_visible === false) continue;
        const storagePath = normalizeText(image.storage_path || image.url || image.src || image.path);
        if (!storagePath || seen.has(storagePath)) continue;
        seen.add(storagePath);
        entries.push({
          id: normalizeText(image.id),
          storagePath
        });
      }
    }
  }
  if (selectedImageIds.length) {
    entries.sort((left, right) => {
      const leftIndex = selectedImageIds.indexOf(left.id);
      const rightIndex = selectedImageIds.indexOf(right.id);
      const normalizedLeftIndex = leftIndex >= 0 ? leftIndex : Number.MAX_SAFE_INTEGER;
      const normalizedRightIndex = rightIndex >= 0 ? rightIndex : Number.MAX_SAFE_INTEGER;
      return normalizedLeftIndex - normalizedRightIndex;
    });
  }
  return entries.map((entry) => entry.storagePath);
}

async function buildHeroTitleByLang({
  publishedCountryCodes,
  frontendI18nDir = FRONTEND_I18N_DIR,
  languages = FRONTEND_LANGUAGE_CODES
} = {}) {
  const result = {};
  for (const lang of languages) {
    const normalizedLang = normalizeTourLang(lang);
    const dictionary = await readJson(path.join(frontendI18nDir, `${normalizedLang}.json`), { fallback: {} });
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
    const dictionary = await readJson(path.join(frontendI18nDir, `${normalizedLang}.json`), { fallback: {} });
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
    regionServed: englishDestinationLabels,
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
        regionServed: copy.regionServed
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

async function writeGeneratedHomepageHtml(templatePath, outputPath, copy, { homepageBundleVersion = "" } = {}) {
  const source = await readFile(templatePath, "utf8");
  const metaTitle = normalizeText(copy?.metaTitleByLang?.en) || "AsiaTravelPlan | Custom Holidays";
  const metaDescription = normalizeText(copy?.metaDescriptionByLang?.en)
    || "Private tailor-made holidays with clear pricing and local support.";
  const heroTitle = normalizeText(copy?.heroTitleByLang?.en) || "Private Holidays in Southeast Asia";
  const homepageBundleUrl = buildVersionedGeneratedDataUrl("public-homepage-main.bundle.js", homepageBundleVersion);

  let next = source
    .replace(/(<title\b[^>]*>)([\s\S]*?)(<\/title>)/, `$1${escapeHtmlText(metaTitle)}$3`)
    .replace(
      /(<h1\b(?=[^>]*\bid="heroTitle")[^>]*>)([\s\S]*?)(<\/h1>)/,
      `$1${escapeHtmlText(heroTitle)}$3`
    )
    .replace(
      /\/frontend\/data\/generated\/homepage\/public-homepage-main\.bundle\.js(?:\?v=[^"']*)?/g,
      homepageBundleUrl
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
  const explicitSlug = slugify(tour?.seo_slug, "");
  if (explicitSlug) return explicitSlug;
  const id = normalizeText(tour?.id);
  const title = normalizeText(tour?.title) || id;
  const suffix = slugify(id.replace(/^tour[_-]?/i, ""), "tour").slice(0, 8);
  return `${slugify(title, "tour")}-${suffix}`;
}

function storedTourSeoSlug(tour) {
  const explicitSlug = slugify(tour?.seo_slug, "");
  if (explicitSlug) return explicitSlug;
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
    <link rel="icon" href="/assets/img/favicon-32.png" sizes="32x32" type="image/png" />
    <link rel="icon" href="/assets/img/favicon-16.png" sizes="16x16" type="image/png" />
    <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png" sizes="180x180" />
    <script>
      {
        const hostname = window.location.hostname;
        const isPrivateNetworkHost = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname);
        const isLocalEnvironment = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname) || isPrivateNetworkHost;
        const isStagingEnvironment = hostname === "staging.asiatravelplan.com";
        const environmentIcon = isLocalEnvironment
          ? { href: "/assets/img/local.small.png", sizes: "200x200" }
          : isStagingEnvironment
            ? { href: "/assets/img/staging.small.png", sizes: "150x150" }
            : null;
        const environmentAppleTouchIcon = isLocalEnvironment
          ? { href: "/assets/img/local-home-screen-icon.png", sizes: "180x180" }
          : isStagingEnvironment
            ? { href: "/assets/img/staging-home-screen-icon.png", sizes: "180x180" }
            : null;
        if (environmentIcon) {
          document.querySelector('link[rel="icon"][sizes="32x32"]')?.setAttribute("href", environmentIcon.href);
          document.querySelector('link[rel="icon"][sizes="16x16"]')?.setAttribute("href", environmentIcon.href);
        }
        if (environmentAppleTouchIcon) {
          const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
          appleTouchIcon?.setAttribute("href", environmentAppleTouchIcon.href);
          appleTouchIcon?.setAttribute("sizes", environmentAppleTouchIcon.sizes);
        }
      }
    </script>
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
        <p class="meta">${linkTag("mailto:info@asiatravelplan.com", "info@asiatravelplan.com")} · ${linkTag("tel:+84354999192", "+84 354999192")}</p>
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
          regionServed: homepageCopy?.regionServed || []
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

function stripStaticImports(source, moduleSpecifiers) {
  return moduleSpecifiers.reduce((nextSource, moduleSpecifier) => {
    const escapedSpecifier = escapeRegExp(moduleSpecifier);
    return nextSource.replace(
      new RegExp(`^import\\s+(?:[^'"]|\\n)*?from\\s+["']${escapedSpecifier}["'];\\s*\\n?`, "gm"),
      ""
    );
  }, String(source || ""));
}

function localizeModuleExports(source) {
  return String(source || "")
    .replace(/^\s*export\s+\{[\s\S]*?\};?\s*$/gm, "")
    .replace(/\bexport\s+(?=(?:async\s+)?function\b|const\b|let\b|var\b|class\b)/g, "");
}

async function writeHomepageInitialBundleScript(outputPath) {
  await ensureDirectory(path.dirname(outputPath));
  const [mainSource, toursSource, tourCustomizeSource] = await Promise.all([
    readFile(path.join(ROOT_DIR, "frontend", "scripts", "main.js"), "utf8"),
    readFile(path.join(ROOT_DIR, "frontend", "scripts", "main_tours.js"), "utf8"),
    readFile(path.join(ROOT_DIR, "frontend", "scripts", "tour_customize.js"), "utf8")
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

  const transformedTourCustomizeSource = localizeModuleExports(tourCustomizeSource);

  const transformedToursSource = localizeModuleExports(stripStaticImports(toursSource, [
    "../../shared/js/text.js",
    "../../shared/generated/language_catalog.js",
    "./tour_customize.js"
  ]));

  const transformedMainSource = stripStaticImports(mainSource, [
    "../../shared/js/text.js",
    "./shared/api.js",
    "./main_tours.js"
  ])
    .replaceAll('import("./main_booking_form_options.js")', 'import("/frontend/scripts/main_booking_form_options.js")')
    .replaceAll('import("../Generated/API/generated_APIRequestFactory.js")', 'import("/frontend/Generated/API/generated_APIRequestFactory.js")')
    .replaceAll('import("../Generated/API/generated_APIModels.js")', 'import("/frontend/Generated/API/generated_APIModels.js")')
    .replaceAll('import("./shared/auth.js")', 'import("/frontend/scripts/shared/auth.js")');

  const bundleSource = [
    bundlePrelude,
    transformedTourCustomizeSource,
    "",
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
  tourVariantsRoot = TOUR_VARIANTS_ROOT,
  outputRoot = TOUR_OUTPUT_DIR,
  frontendDataDir = FRONTEND_DATA_DIR,
  countryReferenceInfoPath = COUNTRY_REFERENCE_INFO_PATH,
  destinationCatalogPath = "",
  onePagersManifestPath = ONE_PAGERS_MANIFEST_PATH,
  translationsSnapshotDir = TRANSLATIONS_SNAPSHOT_DIR,
  translationPhraseOverridesPath = TRANSLATION_PHRASE_OVERRIDES_PATH,
  frontendI18nDir = FRONTEND_I18N_DIR,
  languages = FRONTEND_LANGUAGE_CODES
} = {}) {
  const resolvedDestinationCatalogPath = normalizeText(destinationCatalogPath)
    || (toursRoot === TOURS_ROOT ? DESTINATION_CATALOG_PATH : path.join(toursRoot, "destinations.json"));
  const { normalizeMarketingTourTravelPlan } = createTravelPlanHelpers();
  const { composeTravelPlanForPresentation } = createTravelPlanHelpers();
  const tourHelpers = createTourHelpers({ toursDir: toursRoot, safeInt, normalizeMarketingTourTravelPlan });
  const {
    collectTourOptions,
    normalizeTourForRead,
    normalizeTourForStorage,
    canPublishTourOnWebpage
  } = tourHelpers;
  const tourVariantHelpers = createTourVariantHelpers({
    safeInt,
    randomUUID: () => "",
    normalizeMarketingTourTravelPlan,
    normalizeTourForRead,
    normalizeTourForStorage,
    canPublishTourOnWebpage
  });

  const tourDirectories = (await listDirectoryEntries(toursRoot)).filter((entry) => entry.isDirectory());
  const tourVariantDirectories = (await listDirectoryEntries(tourVariantsRoot)).filter((entry) => entry.isDirectory());
  const tours = [];
  const tourVariants = [];
  const tourRecords = [];
  const generatedTourAssetPaths = new Map();
  const generatedTourThumbnailAssetPaths = new Map();

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
    tours.push(normalizedTour);
    tourRecords.push({ tour: normalizedTour, tourDir });
  }

  for (const entry of tourVariantDirectories) {
    const tourVariantPath = path.join(tourVariantsRoot, entry.name, "tour_variant.json");
    let parsedTourVariant;
    try {
      parsedTourVariant = await readJson(tourVariantPath);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw new Error(`Could not parse ${tourVariantPath}: ${error?.message || error}`);
    }
    const normalizedTourVariant = tourVariantHelpers.normalizeTourVariantForStorage(parsedTourVariant);
    if (!normalizeText(normalizedTourVariant?.id)) {
      throw new Error(`Tour Variant at ${tourVariantPath} is missing an id.`);
    }
    tourVariants.push(normalizedTourVariant);
  }

  const ids = tours.map((tour) => normalizeText(tour.id));
  if (new Set(ids).size !== ids.length) {
    throw new Error("Duplicate tour ids found while generating public homepage assets.");
  }
  const tourVariantIds = tourVariants.map((tourVariant) => normalizeText(tourVariant.id));
  if (new Set([...ids, ...tourVariantIds]).size !== ids.length + tourVariantIds.length) {
    throw new Error("Duplicate tour or Tour Variant ids found while generating public homepage assets.");
  }

  const destinationCatalogPayload = await readJson(resolvedDestinationCatalogPath, { fallback: {} });
  assertTourDestinationsListedInCatalog(tours, destinationCatalogPayload, {
    destinationCatalogPath: resolvedDestinationCatalogPath
  });

  await cleanGeneratedAssetDir(outputRoot);
  for (const { tour, tourDir } of tourRecords) {
    const generatedPaths = await generateHomepageTourAssets(tourDir, path.join(outputRoot, tour.id));
    for (const [sourceName, generatedName] of generatedPaths.assets.entries()) {
      generatedTourAssetPaths.set(`${tour.id}/${sourceName}`, `${tour.id}/${generatedName}`);
    }
    for (const [sourceName, generatedName] of generatedPaths.thumbnails.entries()) {
      generatedTourThumbnailAssetPaths.set(`${tour.id}/${sourceName}`, `${tour.id}/${generatedName}`);
    }
  }

  const storePayload = destinationCatalogPayload && typeof destinationCatalogPayload === "object" && !Array.isArray(destinationCatalogPayload)
    ? destinationCatalogPayload
    : {};
  const publicTours = tours
    .map((tour) => normalizeTourForPublicHomepage(tour, {
      normalizeTourForStorage,
      destinationCatalogPayload: storePayload
    }))
    .filter(Boolean);
  const publicTourVariants = tourVariants
    .filter((tourVariant) => tourVariant.published_on_webpage === true)
    .filter((tourVariant) => {
      const publication = tourVariantHelpers.validateTourVariantPublication(tourVariant, tours);
      if (!publication.ok) {
        console.warn("[homepage-assets] Skipping Tour Variant that cannot be published.", {
          id: tourVariant.id,
          issues: publication.issues
        });
        return false;
      }
      return true;
    })
    .map((tourVariant) => tourVariantHelpers.resolveTourVariantToTour(tourVariant, tours, { publicOnly: true }))
    .map((tour) => normalizeTourForPublicHomepage(tour, {
      normalizeTourForStorage,
      destinationCatalogPayload: storePayload
    }))
    .filter(Boolean);
  const allPublicTours = [
    ...publicTours,
    ...publicTourVariants
  ];
  const sortedPublicTours = [...allPublicTours].sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0));
  const publishedCountryCodes = publicTourCountryCodes(sortedPublicTours);
  const destinationScopeFilters = publicTourDestinationScopeFilters(sortedPublicTours);
  const publishedMarketingTourTranslations = await loadPublishedMarketingTourTranslations(translationsSnapshotDir, languages, {
    phraseOverridesPath: translationPhraseOverridesPath
  });
  const publishedDestinationScopeTranslations = await loadPublishedDestinationScopeCatalogTranslations(
    translationsSnapshotDir,
    languages,
    translationPhraseOverridesPath
  );
  const onePagerArtifactsByTourId = await loadOnePagerArtifacts(onePagersManifestPath);
  const experienceHighlightCatalog = await loadExperienceHighlightCatalog();
  const assetUrlsByLang = {};
  const destinationAssetUrlsByLang = {};
  let seoPayload = null;

  for (const lang of languages) {
    const normalizedLang = normalizeTourLang(lang);
    const publishedTranslations = publishedMarketingTourTranslations.get(normalizedLang) || new Map();
    const localizedItems = [];
    const localizedSeoItems = [];
    for (const tour of sortedPublicTours) {
      const seoSlug = storedTourSeoSlug(tour);
      const localizedTour = applyMarketingTourTranslations(tour, normalizedLang, publishedTranslations);
      const readModelBase = normalizeTourForRead(localizedTour, { lang: normalizedLang });
      const destinationCodes = Array.isArray(tour?.destinations) ? tour.destinations.map((value) => normalizeText(value)).filter(Boolean) : [];
      const derivedTravelPlan = {
        ...(readModelBase.travel_plan && typeof readModelBase.travel_plan === "object" && !Array.isArray(readModelBase.travel_plan) ? readModelBase.travel_plan : {}),
        destination_scope: Array.isArray(tour?.travel_plan?.destination_scope) ? tour.travel_plan.destination_scope : []
      };
      const readModel = {
        ...readModelBase,
        destination_codes: destinationCodes,
        destinations: destinationCodes.map((code) => (
          countryDisplayName(TOUR_DESTINATION_TO_COUNTRY_CODE[normalizeTourDestinationCode(code)] || code, normalizedLang) || code
        )),
        travel_plan: derivedTravelPlan
      };
      const travelPlan = await publicHomepageTourTravelPlan(
        readModel.travel_plan,
        readModel.id,
        generatedTourAssetPaths,
        generatedTourThumbnailAssetPaths,
        outputRoot,
        normalizeText(readModel.updated_at || readModel.created_at)
      );
      const pictures = selectedTravelTourCardImagePaths(travelPlan);
      const presentationTravelPlan = composeTravelPlanForPresentation(travelPlan);
      const onePagerArtifact = onePagerArtifactForLang(onePagerArtifactsByTourId, readModel.id, normalizedLang);
      const onePagerExperienceHighlightIds = selectTourExperienceHighlightIds(readModel.travel_plan, experienceHighlightCatalog, {
        seed: readModel.id
      });
      const onePagerExperienceHighlightSelection = publicOnePagerExperienceHighlightSelection(
        onePagerExperienceHighlightIds,
        experienceHighlightCatalog,
        normalizedLang
      );
      const onePagerPdfUrl = onePagerArtifact?.pdf
        ? buildPublicPath(ONE_PAGERS_PUBLIC_BASE_PATH, onePagerArtifact.pdf)
        : "";
      const detailPayload = {
        id: readModel.id,
        title: readModel.title,
        travel_plan: travelPlan,
        ...(onePagerPdfUrl ? { one_pager_pdf_url: onePagerPdfUrl } : {}),
        ...(onePagerExperienceHighlightSelection.items.length ? { one_pager_experience_highlights: onePagerExperienceHighlightSelection.items } : {})
      };
      const detailFilename = `public-tour-details.${normalizedLang}.${readModel.id}.json`;
      const detailOutputPath = path.join(frontendDataDir, detailFilename);
      const detailSource = jsonWithTrailingNewline(detailPayload);
      const detailVersion = versionTokenForContent(detailSource);
      await writeFile(detailOutputPath, detailSource, "utf8");
      const detailsUrl = buildVersionedGeneratedDataUrl(detailFilename, detailVersion);
      localizedItems.push(publicHomepageTourListItem(readModel, presentationTravelPlan, pictures, detailsUrl, seoSlug));
      localizedSeoItems.push({
        ...readModel,
        seo_slug: seoSlug,
        pictures,
        travel_plan: presentationTravelPlan
      });
    }
    const options = collectTourOptions(allPublicTours, { lang: normalizedLang });
    const availableDestinations = Array.from(new Set(allPublicTours.flatMap((tour) => (
      Array.isArray(tour?.destinations) ? tour.destinations : []
    ))))
      .map((code) => ({ code, label: countryDisplayName(TOUR_DESTINATION_TO_COUNTRY_CODE[normalizeTourDestinationCode(code)] || code, normalizedLang) || code }));
    const destinationScopeCatalog = applyDestinationScopeCatalogTranslations(publicDestinationScopeCatalog(storePayload, availableDestinations, {
      lang: normalizedLang,
      scopeFilters: destinationScopeFilters
    }), normalizedLang, publishedDestinationScopeTranslations);
    const destinationFilename = `${TOUR_DESTINATIONS_FILE_PREFIX}${normalizedLang}${TOUR_DESTINATIONS_FILE_SUFFIX}`;
    const destinationPayload = {
      available_destination_scope_catalog: destinationScopeCatalog
    };
    const destinationSource = jsonWithTrailingNewline(destinationPayload);
    const destinationVersion = versionTokenForContent(destinationSource);
    await writeFile(path.join(frontendDataDir, destinationFilename), destinationSource, "utf8");
    destinationAssetUrlsByLang[normalizedLang] = buildVersionedGeneratedDataUrl(destinationFilename, destinationVersion);

    const payload = {
      items: localizedItems,
      available_destinations: availableDestinations,
      available_styles: options.styles,
      pagination: {
        page: 1,
        page_size: localizedItems.length,
        total_items: localizedItems.length,
        total_pages: 1
      }
    };
    if (normalizedLang === "en" || !seoPayload) {
      seoPayload = {
        ...payload,
        items: localizedSeoItems
      };
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
    count: allPublicTours.length,
    languages: languages.map((lang) => normalizeTourLang(lang)),
    publishedCountryCodes,
    destinationPromiseCopy,
    heroTitleByLang: destinationPromiseCopy.heroTitleByLang,
    seoPayload,
    assetUrlsByLang,
    destinationAssetUrlsByLang,
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
  tourVariantsRoot = "",
  staffRoot = ATP_STAFF_ROOT,
  staffProfilesPath = "",
  staffPhotosRoot = "",
  countryReferenceInfoPath = COUNTRY_REFERENCE_INFO_PATH,
  destinationCatalogPath = "",
  onePagersManifestPath = "",
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
  translationsSnapshotDir = "",
  translationPhraseOverridesPath = "",
  publicTourPdfCacheDir = "",
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
  const resolvedDestinationCatalogPath = normalizeText(destinationCatalogPath)
    || (toursRoot === TOURS_ROOT ? DESTINATION_CATALOG_PATH : path.join(toursRoot, "destinations.json"));
  const resolvedTourVariantsRoot = normalizeText(tourVariantsRoot)
    || (toursRoot === TOURS_ROOT ? TOUR_VARIANTS_ROOT : path.join(path.dirname(toursRoot), "tour_variants"));
  const resolvedOnePagersManifestPath = normalizeText(onePagersManifestPath)
    || (toursRoot === TOURS_ROOT ? ONE_PAGERS_MANIFEST_PATH : path.join(path.dirname(toursRoot), "one-pagers", "manifest.json"));
  const resolvedTranslationsSnapshotDir = normalizeText(translationsSnapshotDir)
    || (toursRoot === TOURS_ROOT ? TRANSLATIONS_SNAPSHOT_DIR : path.join(path.dirname(toursRoot), "translations"));
  const resolvedTranslationPhraseOverridesPath = normalizeText(translationPhraseOverridesPath)
    || (toursRoot === TOURS_ROOT
      ? TRANSLATION_PHRASE_OVERRIDES_PATH
      : path.join(path.dirname(path.dirname(toursRoot)), "config", "i18n", "translation_phrase_overrides.json"));
  await clearPublicTourPdfCache(publicTourPdfCacheDir);
  await cleanGeneratedFrontendData(frontendDataDir);
  const tours = await generateTourAssets({
    toursRoot,
    tourVariantsRoot: resolvedTourVariantsRoot,
    outputRoot: tourOutputDir,
    frontendDataDir,
    countryReferenceInfoPath,
    destinationCatalogPath: resolvedDestinationCatalogPath,
    onePagersManifestPath: resolvedOnePagersManifestPath,
    translationsSnapshotDir: resolvedTranslationsSnapshotDir,
    translationPhraseOverridesPath: resolvedTranslationPhraseOverridesPath,
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
      tourDestinationsByLang: tours.destinationAssetUrlsByLang,
      team: team.assetUrl,
      reels: reels.assetUrl
    }
  };
  const homepageCopy = await writeHomepageCopyGlobalScript(resolvedHomepageCopyGlobalPath, homepageCopyValue);
  const homepageInitialBundle = await writeHomepageInitialBundleScript(resolvedHomepageInitialBundlePath);
  const homepageHtml = await writeGeneratedHomepageHtml(homepageTemplatePath, resolvedHomepageIndexPath, homepageCopyValue, {
    homepageBundleVersion: homepageInitialBundle.version
  });
  const seo = await writeSeoSurfaceAssets({
    outputRoot: path.join(frontendDataDir, path.basename(SEO_OUTPUT_DIR)),
    sitemapOutputPath: path.join(frontendDataDir, path.basename(SITEMAP_OUTPUT_PATH)),
    payload: tours.seoPayload,
    homepageCopy: homepageCopyValue
  });
  return { tours, team, reels, homepageCopy, homepageInitialBundle, homepageHtml, seo };
}

async function runCli() {
  const result = await generatePublicHomepageAssets({
    publicTourPdfCacheDir: PUBLIC_TOUR_PDF_CACHE_ROOT
  });
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
