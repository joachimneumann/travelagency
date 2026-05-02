#!/usr/bin/env node
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { CUSTOMER_CONTENT_LANGUAGES } from "../../shared/generated/language_catalog.js";
import {
  COMPANY_PROFILE,
  FALLBACK_BOOKING_IMAGE_PATH
} from "../../backend/app/src/config/runtime.js";
import { createTourHelpers } from "../../backend/app/src/domain/tours_support.js";
import { createTravelPlanHelpers } from "../../backend/app/src/domain/travel_plan.js";
import { createMarketingTourOnePagerPdfWriter } from "../../backend/app/src/lib/marketing_tour_one_pager_pdf.js";
import { escapeHtml, normalizeText } from "../../backend/app/src/lib/text.js";

const execFile = promisify(execFileCallback);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const toursDir = path.join(repoRoot, "content", "tours");
const translationsSnapshotDir = path.join(repoRoot, "content", "translations");
const defaultOutputDir = path.join(repoRoot, "content", "one-pagers");
const flagTokensPath = path.join(repoRoot, "shared", "css", "tokens.css");
const experienceHighlightsManifestPath = path.join(repoRoot, "assets", "img", "experience-highlights", "manifest.json");
const googleSitesBaseUrl = "https://sites.google.com";
const googleAccount = "info@asiatravelplan.com";
const onePagerFrameImageCount = 5;
const minOnePagerImageCount = 2;
const onePagerExperienceHighlightCount = 4;
const onePagerWebImageWidth = 600;
const onePagerWebImageQuality = 82;
const publicTourImagePrefix = "/public/v1/tour-images/";
const tourImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const preferredPdfColumnLanguages = Object.freeze(["en", "vi"]);
const preferredPdfColumnLanguageSet = new Set(preferredPdfColumnLanguages);
const defaultPdfColumnLanguages = Object.freeze(
  prioritizePdfColumnLanguages(CUSTOMER_CONTENT_LANGUAGES.map((language) => language.code))
);

function printUsage() {
  console.log(`Usage: scripts/content/create_all_one-pagers.sh [N_tours] [N_languages] [options]

Examples:
  scripts/content/create_all_one-pagers.sh
  scripts/content/create_all_one-pagers.sh 5 3
  scripts/content/create_all_one-pagers.sh --languages en,vi --limit 2

Options:
  --output DIR              Output directory. Default: content/one-pagers
  --languages LIST          Comma-separated language codes. Default: all customer languages, EN and VI first
  --tour TOUR_ID            Render one tour only. Can be repeated.
  --limit N                 Render only the first N tours after filtering.
  --image-dpi N             PDF-to-image resolution before web preview resize. Default: 144
  --no-clean                Keep existing output files.
  --open-google-sites       Open Google Sites after generation.
  --help                    Show this help.

Generated files:
  <output>/pdfs/<tour-id>/<lang>.pdf
  <output>/images/<tour-id>/<lang>.jpg
  <output>/index.html
  <output>/manifest.json

Only tours with at least ${minOnePagerImageCount} usable one-pager images are rendered.`);
}

function parseLimitArg(value, label) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isInteger(parsed) || parsed < 0 || String(parsed) !== String(value).trim()) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = {
    outputDir: defaultOutputDir,
    languages: [...defaultPdfColumnLanguages],
    tours: new Set(),
    limit: 0,
    imageDpi: 144,
    clean: true,
    openGoogleSites: false
  };
  const positionals = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (!arg.startsWith("-")) {
      positionals.push(arg);
      continue;
    }
    if (arg === "--output") {
      options.outputDir = path.resolve(String(argv[++index] || ""));
      continue;
    }
    if (arg === "--languages") {
      options.languages = String(argv[++index] || "")
        .split(",")
        .map((value) => normalizeLanguageCode(value))
        .filter(Boolean);
      continue;
    }
    if (arg === "--tour") {
      const tourId = normalizeText(argv[++index]);
      if (tourId) options.tours.add(tourId);
      continue;
    }
    if (arg === "--limit") {
      options.limit = Math.max(0, Number.parseInt(String(argv[++index] || "0"), 10) || 0);
      continue;
    }
    if (arg === "--image-dpi") {
      options.imageDpi = Math.max(72, Number.parseInt(String(argv[++index] || "144"), 10) || 144);
      continue;
    }
    if (arg === "--no-clean") {
      options.clean = false;
      continue;
    }
    if (arg === "--open-google-sites") {
      options.openGoogleSites = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (positionals.length > 2) {
    throw new Error("Expected at most two positional arguments: N_tours N_languages.");
  }
  if (positionals[0] !== undefined) {
    options.limit = parseLimitArg(positionals[0], "N_tours");
  }
  options.languages = prioritizePdfColumnLanguages(options.languages);
  if (positionals[1] !== undefined) {
    const languageLimit = parseLimitArg(positionals[1], "N_languages");
    if (languageLimit) {
      options.languages = options.languages.slice(0, languageLimit);
    }
  }
  if (!options.languages.length) {
    throw new Error("No languages selected.");
  }
  return options;
}

function normalizeLanguageCode(value) {
  return normalizeText(value).toLowerCase();
}

function prioritizePdfColumnLanguages(languages) {
  const seen = new Set();
  const normalizedLanguages = [];
  for (const language of Array.isArray(languages) ? languages : []) {
    const code = normalizeLanguageCode(language);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    normalizedLanguages.push(code);
  }
  return [
    ...preferredPdfColumnLanguages.filter((code) => seen.has(code)),
    ...normalizedLanguages.filter((code) => !preferredPdfColumnLanguageSet.has(code))
  ];
}

function safeInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function slug(value) {
  return normalizeText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "item";
}

function relativeUrl(fromFile, targetFile) {
  return path.relative(path.dirname(fromFile), targetFile).split(path.sep).map(encodeURIComponent).join("/");
}

function textOrNull(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function serviceImageLabel(service, fallback = "Tour") {
  return textOrNull(service?.title) || textOrNull(service?.location) || fallback;
}

function normalizeTourImageStoragePath(storagePath) {
  const normalized = textOrNull(storagePath);
  if (!normalized) return "";
  if (normalized.startsWith(publicTourImagePrefix)) {
    return normalized.slice(publicTourImagePrefix.length).replace(/^\/+/, "");
  }
  return normalized.replace(/^\/+/, "");
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function commandExists(command) {
  try {
    await execFile(command === "magick" ? "magick" : "which", command === "magick" ? ["-version"] : [command]);
    return true;
  } catch {
    return false;
  }
}

async function convertPdfToWebJpg(pdfPath, jpgPath, { dpi, width }) {
  const withoutExtension = jpgPath.replace(/\.jpe?g$/i, "");
  if (await commandExists("pdftoppm")) {
    try {
      await execFile("pdftoppm", [
        "-jpeg",
        "-jpegopt",
        `quality=${onePagerWebImageQuality},optimize=y`,
        "-singlefile",
        "-r",
        String(dpi),
        "-scale-to-x",
        String(width),
        "-scale-to-y",
        "-1",
        pdfPath,
        withoutExtension
      ]);
      return;
    } catch (error) {
      await rm(jpgPath, { force: true });
      if (!(await commandExists("magick"))) throw error;
    }
  }
  if (await commandExists("magick")) {
    await execFile("magick", [
      "-density",
      String(dpi),
      `${pdfPath}[0]`,
      "-resize",
      `${width}x`,
      "-background",
      "white",
      "-alpha",
      "remove",
      "-alpha",
      "off",
      "-strip",
      "-quality",
      String(onePagerWebImageQuality),
      jpgPath
    ]);
    return;
  }
  throw new Error("Could not convert PDF to JPG. Install poppler (pdftoppm) or ImageMagick (magick).");
}

async function readTours() {
  const entries = await readdir(toursDir, { withFileTypes: true });
  const tours = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("tour_")) continue;
    const tourPath = path.join(toursDir, entry.name, "tour.json");
    try {
      const tour = JSON.parse(await readFile(tourPath, "utf8"));
      tours.push({ id: entry.name, ...tour, __dir: entry.name });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return tours;
}

function translationSourceKey(sourceText) {
  return createHash("sha256").update(normalizeText(sourceText), "utf8").digest("hex");
}

async function loadPublishedMarketingTourTranslations(languages) {
  const mapsByLang = new Map();
  const uniqueLanguages = Array.from(new Set(
    (Array.isArray(languages) ? languages : [])
      .map((lang) => normalizeLanguageCode(lang))
      .filter((lang) => lang && lang !== "en")
  ));
  await Promise.all(uniqueLanguages.map(async (lang) => {
    const snapshotPath = path.join(translationsSnapshotDir, "customers", `marketing-tours.${lang}.json`);
    const entries = new Map();
    try {
      const payload = JSON.parse(await readFile(snapshotPath, "utf8"));
      for (const item of Array.isArray(payload?.items) ? payload.items : []) {
        const sourceText = normalizeText(item?.source_text);
        const targetText = normalizeText(item?.target_text);
        if (!sourceText || !targetText) continue;
        entries.set(translationSourceKey(sourceText), targetText);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    mapsByLang.set(lang, entries);
  }));
  return mapsByLang;
}

function localizedObjectText(value, lang) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? normalizeText(value[normalizeLanguageCode(lang)])
    : "";
}

function fallbackSourceText(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? normalizeText(value.en)
    : normalizeText(value);
}

function sourceTextFromLocalizedValue(value, fallback = "") {
  const fallbackText = fallbackSourceText(fallback);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return normalizeText(value.en) || fallbackText;
  }
  return normalizeText(value) || fallbackText;
}

function publishedTranslationForSource(translations, sourceText) {
  const normalizedSource = normalizeText(sourceText);
  if (!normalizedSource || !(translations instanceof Map)) return "";
  return normalizeText(translations.get(translationSourceKey(normalizedSource)));
}

function cloneJson(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function applyPublishedTranslationToLocalizedMap(holder, fieldName, lang, translations) {
  if (!holder || typeof holder !== "object" || Array.isArray(holder)) return false;
  const normalizedLang = normalizeLanguageCode(lang);
  const existingValue = holder[fieldName];
  const sourceText = sourceTextFromLocalizedValue(existingValue);
  if (!sourceText) return false;
  const targetText = publishedTranslationForSource(translations, sourceText);
  if (!targetText) return false;
  if (localizedObjectText(existingValue, normalizedLang) === targetText) return false;
  holder[fieldName] = {
    ...(existingValue && typeof existingValue === "object" && !Array.isArray(existingValue)
      ? existingValue
      : { en: sourceText }),
    [normalizedLang]: targetText
  };
  return true;
}

function applyPublishedTranslationToLocalizedPair(holder, plainField, i18nField, lang, translations) {
  if (!holder || typeof holder !== "object" || Array.isArray(holder)) return false;
  const normalizedLang = normalizeLanguageCode(lang);
  const i18nValue = holder[i18nField];
  const sourceText = sourceTextFromLocalizedValue(i18nValue, holder[plainField]);
  if (!sourceText) return false;
  const targetText = publishedTranslationForSource(translations, sourceText);
  if (!targetText) return false;
  if (localizedObjectText(i18nValue, normalizedLang) === targetText) return false;
  holder[i18nField] = {
    ...(i18nValue && typeof i18nValue === "object" && !Array.isArray(i18nValue)
      ? i18nValue
      : {}),
    [normalizedLang]: targetText
  };
  return true;
}

function applyPublishedTranslationsToTravelPlanImage(image, lang, translations) {
  if (!image || typeof image !== "object" || Array.isArray(image)) return false;
  let changed = false;
  changed = applyPublishedTranslationToLocalizedPair(image, "caption", "caption_i18n", lang, translations) || changed;
  changed = applyPublishedTranslationToLocalizedPair(image, "alt_text", "alt_text_i18n", lang, translations) || changed;
  return changed;
}

function applyPublishedTranslationsToTravelPlan(travelPlan, lang, translations) {
  if (!travelPlan || typeof travelPlan !== "object" || Array.isArray(travelPlan)) return false;
  let changed = false;
  for (const day of Array.isArray(travelPlan.days) ? travelPlan.days : []) {
    if (!day || typeof day !== "object" || Array.isArray(day)) continue;
    changed = applyPublishedTranslationToLocalizedPair(day, "title", "title_i18n", lang, translations) || changed;
    changed = applyPublishedTranslationToLocalizedPair(day, "overnight_location", "overnight_location_i18n", lang, translations) || changed;
    changed = applyPublishedTranslationToLocalizedPair(day, "notes", "notes_i18n", lang, translations) || changed;

    for (const service of Array.isArray(day.services) ? day.services : []) {
      if (!service || typeof service !== "object" || Array.isArray(service)) continue;
      changed = applyPublishedTranslationToLocalizedPair(service, "time_label", "time_label_i18n", lang, translations) || changed;
      changed = applyPublishedTranslationToLocalizedPair(service, "title", "title_i18n", lang, translations) || changed;
      changed = applyPublishedTranslationToLocalizedPair(service, "details", "details_i18n", lang, translations) || changed;
      changed = applyPublishedTranslationToLocalizedPair(service, "location", "location_i18n", lang, translations) || changed;
      changed = applyPublishedTranslationToLocalizedPair(service, "image_subtitle", "image_subtitle_i18n", lang, translations) || changed;
      changed = applyPublishedTranslationsToTravelPlanImage(service.image, lang, translations) || changed;
      for (const image of Array.isArray(service.images) ? service.images : []) {
        changed = applyPublishedTranslationsToTravelPlanImage(image, lang, translations) || changed;
      }
    }
  }
  return changed;
}

function applyPublishedMarketingTourTranslations(tour, lang, translations) {
  const normalizedLang = normalizeLanguageCode(lang);
  if (normalizedLang === "en" || !(translations instanceof Map) || translations.size === 0) return tour;
  const next = cloneJson(tour);
  let changed = false;
  changed = applyPublishedTranslationToLocalizedMap(next, "title", normalizedLang, translations) || changed;
  changed = applyPublishedTranslationToLocalizedMap(next, "short_description", normalizedLang, translations) || changed;
  changed = applyPublishedTranslationsToTravelPlan(next.travel_plan, normalizedLang, translations) || changed;
  return changed ? next : tour;
}

async function readExperienceHighlightIds() {
  const raw = await readFile(experienceHighlightsManifestPath, "utf8");
  const parsed = JSON.parse(raw);
  const seen = new Set();
  return (Array.isArray(parsed) ? parsed : [])
    .map((item) => textOrNull(item?.id))
    .filter((id) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function deterministicShuffle(items, seed) {
  return [...items]
    .map((item) => ({
      item,
      rank: createHash("sha256").update(`${seed}:${typeof item === "string" ? item : item?.storage_path || JSON.stringify(item)}`).digest("hex")
    }))
    .sort((left, right) => left.rank.localeCompare(right.rank))
    .map(({ item }) => item);
}

function uniqueImageEntries(entries) {
  const seen = new Set();
  const output = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    const storagePath = textOrNull(entry?.storage_path);
    if (!storagePath || seen.has(storagePath)) continue;
    seen.add(storagePath);
    output.push({ ...entry, storage_path: storagePath });
  }
  return output;
}

async function filterExistingImages(entries, resolveTourImageDiskPath = null) {
  const uniqueEntries = uniqueImageEntries(entries);
  if (!resolveTourImageDiskPath) return uniqueEntries;
  const existingEntries = [];
  for (const entry of uniqueEntries) {
    const diskPath = resolveTourImageDiskPath(entry.storage_path);
    if (await fileExists(diskPath)) {
      existingEntries.push(entry);
    }
  }
  return existingEntries;
}

function collectVisibleTravelPlanImages(travelPlan) {
  const images = [];
  for (const day of Array.isArray(travelPlan?.days) ? travelPlan.days : []) {
    for (const service of Array.isArray(day?.services) ? day.services : []) {
      const image = service?.image && typeof service.image === "object" && !Array.isArray(service.image)
        ? service.image
        : null;
      const id = textOrNull(image?.id);
      const storagePath = normalizeTourImageStoragePath(image?.storage_path);
      if (storagePath && image?.is_customer_visible !== false && !images.some((entry) => entry.storage_path === storagePath)) {
        images.push({
          id,
          storage_path: storagePath,
          label: serviceImageLabel(service)
        });
      }
    }
  }
  return images;
}

async function collectTourDirectoryImages(tourId, fallbackLabel = "Tour") {
  let entries = [];
  try {
    entries = await readdir(path.join(toursDir, tourId), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && tourImageExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => ({
      id: `one-pager-random-${createHash("sha1").update(entry.name).digest("hex").slice(0, 12)}`,
      storage_path: `${tourId}/${entry.name}`,
      label: fallbackLabel
    }));
}

function onePagerSelectionIds(rawTravelPlan) {
  const hero = textOrNull(rawTravelPlan?.one_pager_hero_image_id);
  const ids = Array.isArray(rawTravelPlan?.one_pager_image_ids)
    ? rawTravelPlan.one_pager_image_ids.map((value) => textOrNull(value)).filter(Boolean)
    : [];
  const seen = new Set();
  return [hero, ...ids].filter((id) => {
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function onePagerExperienceHighlightIds(rawTravelPlan) {
  const seen = new Set();
  return (Array.isArray(rawTravelPlan?.one_pager_experience_highlight_ids)
    ? rawTravelPlan.one_pager_experience_highlight_ids
    : [])
    .map((value) => textOrNull(value))
    .filter((id) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, onePagerExperienceHighlightCount);
}

async function prepareScriptFrameImages(tour, rawTravelPlan, seed, { resolveTourImageDiskPath = null } = {}) {
  const fallbackLabel = textOrNull(tour?.title) || "Tour";
  const serviceImages = await filterExistingImages(collectVisibleTravelPlanImages(tour.travel_plan), resolveTourImageDiskPath);
  const directoryImages = await filterExistingImages(await collectTourDirectoryImages(tour.id, fallbackLabel), resolveTourImageDiskPath);
  const serviceImagesById = new Map(serviceImages.filter((entry) => entry.id).map((entry) => [entry.id, entry]));
  const selectedImages = onePagerSelectionIds(rawTravelPlan)
    .map((imageId) => serviceImagesById.get(imageId))
    .filter(Boolean)
    .slice(0, onePagerFrameImageCount);
  const selectedStoragePaths = new Set(selectedImages.map((entry) => entry.storage_path));
  const randomServiceImages = deterministicShuffle(
    serviceImages.filter((entry) => !selectedStoragePaths.has(entry.storage_path)),
    `${seed}:services`
  );
  const randomDirectoryImages = deterministicShuffle(
    directoryImages.filter((entry) => !selectedStoragePaths.has(entry.storage_path)),
    `${seed}:directory`
  );
  return uniqueImageEntries([
    ...selectedImages,
    ...randomServiceImages,
    ...randomDirectoryImages
  ]).slice(0, onePagerFrameImageCount);
}

async function applyScriptFrameImages(tour, rawTravelPlan, seed, { resolveTourImageDiskPath = null } = {}) {
  const frameImages = await prepareScriptFrameImages(tour, rawTravelPlan, seed, { resolveTourImageDiskPath });
  if (!frameImages.length) {
    return { tour, fillerImagesApplied: false, frameImageCount: 0, selectedImageCount: 0 };
  }
  const selectedImageIds = new Set(onePagerSelectionIds(rawTravelPlan));
  const selectedImageCount = frameImages.filter((entry) => selectedImageIds.has(entry.id)).length;
  return {
    tour: {
      ...tour,
      travel_plan: {
        ...tour.travel_plan,
        __one_pager_frame_images: frameImages
      }
    },
    fillerImagesApplied: frameImages.length > selectedImageCount,
    frameImageCount: frameImages.length,
    selectedImageCount
  };
}

function applyScriptExperienceHighlights(tour, rawTravelPlan, seed, availableHighlightIds) {
  const selectedHighlightIds = onePagerExperienceHighlightIds(rawTravelPlan);
  if (selectedHighlightIds.length || availableHighlightIds.length < onePagerExperienceHighlightCount) {
    return {
      tour,
      randomExperienceHighlightsApplied: false,
      selectedExperienceHighlightCount: selectedHighlightIds.length,
      selectedExperienceHighlightIds: selectedHighlightIds
    };
  }
  const randomHighlightIds = deterministicShuffle(availableHighlightIds, seed).slice(0, onePagerExperienceHighlightCount);
  return {
    tour: {
      ...tour,
      travel_plan: {
        ...tour.travel_plan,
        one_pager_experience_highlight_ids: randomHighlightIds
      }
    },
    randomExperienceHighlightsApplied: true,
    selectedExperienceHighlightCount: randomHighlightIds.length,
    selectedExperienceHighlightIds: randomHighlightIds
  };
}

function tourTitleForSort(tourHelpers, tour) {
  return tourHelpers.resolveLocalizedText(tour?.title, "en") || normalizeText(tour?.id);
}

function unquoteCssUrl(value) {
  const trimmed = normalizeText(value);
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function buildFlagDataUrls(languages) {
  let tokens = "";
  try {
    tokens = await readFile(flagTokensPath, "utf8");
  } catch {
    return new Map();
  }
  const languageMeta = new Map(CUSTOMER_CONTENT_LANGUAGES.map((language) => [language.code, language]));
  const flagDataUrls = new Map();
  for (const lang of languages) {
    const flagClass = languageMeta.get(lang)?.flagClass || `flag-${lang}`;
    const variableName = flagClass.replace(/^flag-/, "--flag-");
    const variableMatch = tokens.match(new RegExp(`${variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*url\\(([^;]+)\\);`));
    if (!variableMatch) continue;
    flagDataUrls.set(lang, unquoteCssUrl(variableMatch[1]));
  }
  return flagDataUrls;
}

function buildMatrixHtml({ outputDir, rows, languages, generatedAt, flagDataUrls }) {
  const indexPath = path.join(outputDir, "index.html");
  const languageLabels = new Map(CUSTOMER_CONTENT_LANGUAGES.map((language) => [language.code, language.shortLabel || language.nativeLabel || language.code.toUpperCase()]));
  const languageFlags = new Map(CUSTOMER_CONTENT_LANGUAGES.map((language) => [language.code, language.flagClass || `flag-${language.code}`]));
  const headerCells = languages.map((lang) => {
    const label = languageLabels.get(lang) || lang.toUpperCase();
    const flagClass = languageFlags.get(lang) || `flag-${lang}`;
    const flagDataUrl = flagDataUrls?.get(lang);
    const flagHtml = flagDataUrl
      ? `<img class="lang-flag" src="${escapeHtml(flagDataUrl)}" alt="">`
      : `<span class="lang-flag ${escapeHtml(flagClass)}" aria-hidden="true"></span>`;
    return `<th>
        <span class="lang-heading">
          ${flagHtml}
          <span>${escapeHtml(label)}</span>
        </span>
      </th>`;
  }).join("");
  const bodyRows = rows.map((row) => {
    const cells = languages.map((lang) => {
      const artifact = row.artifacts.find((item) => item.lang === lang);
      if (!artifact) return "<td class=\"missing\">-</td>";
      const imageUrl = relativeUrl(indexPath, artifact.imagePath);
      const pdfUrl = relativeUrl(indexPath, artifact.pdfPath);
      return `<td>
        <a class="preview-link" href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(row.title)} ${escapeHtml(lang)} one-pager" loading="lazy">
        </a>
      </td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AsiaTravelPlan one-pagers</title>
  <style>
    :root {
      color-scheme: light;
      --border: #d8e0dd;
      --header: #f4f7f4;
      --text: #15242a;
      --muted: #60717a;
      --surface: #ffffff;
      --preview-width: 440px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Arial, sans-serif;
      color: var(--text);
      background: #eef3ed;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 4;
      padding: 18px 24px;
      background: rgba(255, 255, 255, 0.96);
      border-bottom: 1px solid var(--border);
    }
    h1 {
      margin: 0 0 4px;
      font-size: 20px;
      line-height: 1.2;
    }
    .meta {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
    }
    main {
      padding: 18px 24px 32px;
    }
    .matrix-wrap {
      overflow: auto;
      max-height: calc(100vh - 110px);
      border: 1px solid var(--border);
      background: var(--surface);
    }
    table {
      width: max-content;
      border-collapse: separate;
      border-spacing: 0;
    }
    th, td {
      border-right: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      padding: 8px;
      vertical-align: top;
      background: var(--surface);
    }
    thead th {
      position: sticky;
      top: 0;
      z-index: 3;
      min-width: calc(var(--preview-width) + 16px);
      background: var(--header);
      font-size: 13px;
      text-align: center;
      white-space: nowrap;
    }
    .lang-heading {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .lang-flag {
      display: inline-block;
      width: 28px;
      height: 19px;
      border-radius: 4px;
      background-color: #ffffff;
      background-position: center;
      background-repeat: no-repeat;
      background-size: cover;
      border: 1px solid rgba(20, 37, 43, 0.22);
      box-shadow: 0 1px 3px rgba(20, 37, 43, 0.16);
      flex: 0 0 auto;
      object-fit: cover;
    }
    .preview-link {
      display: block;
      width: var(--preview-width);
    }
    .preview-link img {
      display: block;
      width: var(--preview-width);
      height: auto;
      border: 1px solid #cbd6d1;
      background: #f5f5f5;
    }
    .missing {
      text-align: center;
      color: var(--muted);
      min-width: calc(var(--preview-width) + 16px);
    }
  </style>
</head>
<body>
  <header>
    <h1>AsiaTravelPlan one-pagers</h1>
    <p class="meta">${rows.length} tours × ${languages.length} languages. Generated ${escapeHtml(generatedAt)}.</p>
  </header>
  <main>
    <div class="matrix-wrap">
      <table>
        <thead>
          <tr>${headerCells}</tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    </div>
  </main>
</body>
</html>
`;
}

async function openGoogleSites() {
  if (process.platform !== "darwin") return;
  await execFile("open", [`${googleSitesBaseUrl}/?authuser=${encodeURIComponent(googleAccount)}`]);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.clean) {
    await rm(options.outputDir, { recursive: true, force: true });
  }
  await mkdir(path.join(options.outputDir, "pdfs"), { recursive: true });
  await mkdir(path.join(options.outputDir, "images"), { recursive: true });

  const travelPlanHelpers = createTravelPlanHelpers();
  const tourHelpers = createTourHelpers({
    toursDir,
    safeInt,
    normalizeMarketingTourTravelPlan: travelPlanHelpers.normalizeMarketingTourTravelPlan
  });
  const writeOnePagerPdf = createMarketingTourOnePagerPdfWriter({
    resolveTourImageDiskPath: tourHelpers.resolveTourImageDiskPath,
    logoPath: path.join(repoRoot, "assets", "img", "logo-asiatravelplan.png"),
    fallbackImagePath: FALLBACK_BOOKING_IMAGE_PATH,
    experienceHighlightsManifestPath,
    companyProfile: COMPANY_PROFILE
  });
  const experienceHighlightIds = await readExperienceHighlightIds();
  if (experienceHighlightIds.length < onePagerExperienceHighlightCount) {
    throw new Error(`Expected at least ${onePagerExperienceHighlightCount} experience highlights in ${experienceHighlightsManifestPath}.`);
  }
  const publishedTranslationsByLang = await loadPublishedMarketingTourTranslations(options.languages);

  let tours = (await readTours())
    .map((tour) => tourHelpers.normalizeTourForStorage(tour))
    .sort((left, right) => tourTitleForSort(tourHelpers, left).localeCompare(tourTitleForSort(tourHelpers, right), "en", { sensitivity: "base" }));
  if (options.tours.size) {
    tours = tours.filter((tour) => options.tours.has(tour.id));
  }

  const skippedTours = [];
  const eligibleTours = [];
  for (const tour of tours) {
    const scriptFrameImages = await prepareScriptFrameImages(
      { ...tour, title: tourTitleForSort(tourHelpers, tour) },
      tour.travel_plan,
      `${tour.id}:eligibility`,
      { resolveTourImageDiskPath: tourHelpers.resolveTourImageDiskPath }
    );
    if (scriptFrameImages.length >= minOnePagerImageCount) {
      eligibleTours.push(tour);
    } else {
      skippedTours.push({
        id: tour.id,
        title: tourTitleForSort(tourHelpers, tour),
        usable_image_count: scriptFrameImages.length
      });
    }
  }
  tours = eligibleTours;
  if (options.limit) {
    tours = tours.slice(0, options.limit);
  }
  if (!tours.length) {
    throw new Error(`No tours found to render with at least ${minOnePagerImageCount} usable images.`);
  }
  if (skippedTours.length) {
    console.log(`Skipped ${skippedTours.length} tours with fewer than ${minOnePagerImageCount} usable images.`);
  }

  const generatedAt = new Date().toISOString();
  const manifest = {
    generated_at: generatedAt,
    output_dir: options.outputDir,
    languages: options.languages,
    min_one_pager_image_count: minOnePagerImageCount,
    skipped_tours: skippedTours,
    tours: []
  };
  const matrixRows = [];
  const total = tours.length * options.languages.length;
  let rendered = 0;

  for (const tour of tours) {
    const title = tourHelpers.resolveLocalizedText(tour.title, "en") || tour.id;
    const row = { id: tour.id, title, artifacts: [] };
    const manifestTour = { id: tour.id, title, artifacts: [] };
    for (const lang of options.languages) {
      rendered += 1;
      const publishedTranslations = publishedTranslationsByLang.get(normalizeLanguageCode(lang));
      const localizedTour = applyPublishedMarketingTourTranslations(tour, lang, publishedTranslations);
      const readModel = tourHelpers.normalizeTourForRead(localizedTour, { lang });
      const localizedTravelPlan = travelPlanHelpers.normalizeMarketingTourTravelPlan(localizedTour.travel_plan, {
        sourceLang: "en",
        contentLang: lang,
        flatLang: lang,
        flatMode: "localized",
        strictReferences: false
      });
      const selected = await applyScriptFrameImages(
        { ...readModel, travel_plan: localizedTravelPlan },
        tour.travel_plan,
        `${tour.id}:${lang}`,
        { resolveTourImageDiskPath: tourHelpers.resolveTourImageDiskPath }
      );
      const highlighted = applyScriptExperienceHighlights(
        selected.tour,
        tour.travel_plan,
        `${tour.id}:experience-highlights`,
        experienceHighlightIds
      );
      const tourDirName = slug(tour.id);
      const pdfDir = path.join(options.outputDir, "pdfs", tourDirName);
      const imageDir = path.join(options.outputDir, "images", tourDirName);
      await mkdir(pdfDir, { recursive: true });
      await mkdir(imageDir, { recursive: true });
      const pdfPath = path.join(pdfDir, `${lang}.pdf`);
      const imagePath = path.join(imageDir, `${lang}.jpg`);
      process.stdout.write(`[${rendered}/${total}] ${tour.id} ${lang}\n`);
      await writeOnePagerPdf(highlighted.tour, { lang, outputPath: pdfPath });
      await convertPdfToWebJpg(pdfPath, imagePath, {
        dpi: options.imageDpi,
        width: onePagerWebImageWidth
      });
      const artifact = {
        lang,
        pdfPath,
        imagePath,
        fillerImagesApplied: selected.fillerImagesApplied,
        frameImageCount: selected.frameImageCount,
        selectedImageCount: selected.selectedImageCount,
        randomExperienceHighlightsApplied: highlighted.randomExperienceHighlightsApplied,
        selectedExperienceHighlightCount: highlighted.selectedExperienceHighlightCount,
        selectedExperienceHighlightIds: highlighted.selectedExperienceHighlightIds
      };
      row.artifacts.push(artifact);
      manifestTour.artifacts.push({
        lang,
        pdf: path.relative(options.outputDir, pdfPath),
        image: path.relative(options.outputDir, imagePath),
        filler_images_applied: selected.fillerImagesApplied,
        frame_image_count: selected.frameImageCount,
        selected_image_count: selected.selectedImageCount,
        random_experience_highlights_applied: highlighted.randomExperienceHighlightsApplied,
        selected_experience_highlight_count: highlighted.selectedExperienceHighlightCount,
        selected_experience_highlight_ids: highlighted.selectedExperienceHighlightIds
      });
    }
    matrixRows.push(row);
    manifest.tours.push(manifestTour);
  }

  const matrixHtml = buildMatrixHtml({
    outputDir: options.outputDir,
    rows: matrixRows,
    languages: options.languages,
    generatedAt,
    flagDataUrls: await buildFlagDataUrls(options.languages)
  });
  const staleInstructionsPath = path.join(options.outputDir, "google-sites-instructions.html");
  await rm(staleInstructionsPath, { force: true });
  await writeFile(path.join(options.outputDir, "index.html"), matrixHtml, "utf8");
  await writeFile(path.join(options.outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  if (options.openGoogleSites) {
    await openGoogleSites();
  }

  console.log(`Done. Matrix page: ${path.join(options.outputDir, "index.html")}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
