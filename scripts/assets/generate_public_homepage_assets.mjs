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
const FRONTEND_PAGES_DIR = path.join(ROOT_DIR, "frontend", "pages");
const FRONTEND_I18N_DIR = path.join(ROOT_DIR, "frontend", "data", "i18n", "frontend");
const TOURS_ROOT = path.join(CONTENT_ROOT, "tours");
const ATP_STAFF_ROOT = path.join(CONTENT_ROOT, "atp_staff");
const ATP_STAFF_PHOTOS_ROOT = path.join(ATP_STAFF_ROOT, "photos");
const COUNTRY_REFERENCE_INFO_PATH = path.join(CONTENT_ROOT, "country_reference_info.json");
const GENERATED_HOMEPAGE_DATA_DIR = path.join(ROOT_DIR, "frontend", "data", "generated", "homepage");
const GENERATED_HOMEPAGE_ASSETS_DIR = path.join(ROOT_DIR, "assets", "generated", "homepage");
const FRONTEND_DATA_DIR = GENERATED_HOMEPAGE_DATA_DIR;
const TOUR_OUTPUT_DIR = path.join(GENERATED_HOMEPAGE_ASSETS_DIR, "tours");
const TEAM_OUTPUT_DIR = path.join(GENERATED_HOMEPAGE_ASSETS_DIR, "team");
const TEAM_OUTPUT_FILE = path.join(FRONTEND_DATA_DIR, "public-team.json");
const HOMEPAGE_HTML_PATH = path.join(FRONTEND_PAGES_DIR, "index.html");
const HOMEPAGE_COPY_GLOBAL_PATH = path.join(FRONTEND_DATA_DIR, "public-homepage-copy.global.js");
const HOMEPAGE_COPY_GLOBAL_FILENAME = path.basename(HOMEPAGE_COPY_GLOBAL_PATH);
const TOUR_FILE_PREFIX = "public-tours.";
const TOUR_FILE_SUFFIX = ".json";
const ALLOWED_ASSET_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
      || entryName === HOMEPAGE_COPY_GLOBAL_FILENAME
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

async function updateHomepageHtmlFallback(htmlPath, { heroTitle, homepageCopyScriptVersion = "" } = {}) {
  const normalizedTitle = normalizeText(heroTitle);
  const html = await readFile(htmlPath, "utf8");
  let nextHtml = html;
  if (normalizedTitle) {
    const markerPattern = /(<h1\s+id="heroTitle"[^>]*>)([\s\S]*?)(<\/h1>)/;
    if (!markerPattern.test(nextHtml)) {
      throw new Error(`Could not find heroTitle heading in ${htmlPath}.`);
    }
    nextHtml = nextHtml.replace(markerPattern, (_, openTag, _currentText, closeTag) => {
      return `${openTag}${escapeHtml(normalizedTitle)}${closeTag}`;
    });
  }
  const normalizedScriptVersion = normalizeText(homepageCopyScriptVersion);
  if (normalizedScriptVersion) {
    const scriptPattern = /(<script\s+src="\/frontend\/data\/generated\/homepage\/public-homepage-copy\.global\.js)(?:\?v=[^"]*)?("><\/script>)/;
    if (!scriptPattern.test(nextHtml)) {
      throw new Error(`Could not find public homepage copy script tag in ${htmlPath}.`);
    }
    nextHtml = nextHtml.replace(
      scriptPattern,
      `$1?v=${encodeURIComponent(normalizedScriptVersion)}$2`
    );
  }
  await writeFile(htmlPath, nextHtml, "utf8");
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
    await copyAllowedFiles(tourDir, path.join(outputRoot, normalizedTour.id), {
      exclude: new Set(["tour.json"])
    });
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
      const assetRelativePath = extractTourAssetRelativePath(readModel.image, readModel.id);
      const image = assetRelativePath
        ? await versionedStaticAssetPath(assetRelativePath, outputRoot, {
          publicPrefix: "/assets/generated/homepage/tours",
          version: normalizeText(readModel.updated_at || readModel.created_at)
        })
        : "/assets/img/marketing_tours.png";
      localizedItems.push({
        ...readModel,
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
  homepageHtmlPath = HOMEPAGE_HTML_PATH,
  languages = FRONTEND_LANGUAGE_CODES
} = {}) {
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
  await updateHomepageHtmlFallback(homepageHtmlPath, {
    heroTitle: tours.heroTitleByLang.en || "",
    homepageCopyScriptVersion: homepageCopy.version
  });
  return { tours, team };
}

async function runCli() {
  const result = await generatePublicHomepageAssets();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await runCli();
}
