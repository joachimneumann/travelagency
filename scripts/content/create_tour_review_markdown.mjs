#!/usr/bin/env node
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const toursDir = path.join(repoRoot, "content", "tours");
const defaultOutputDir = toursDir;
const styleCatalogPath = path.join(repoRoot, "config", "tour_style_catalog.json");
const pdfFontDir = path.join(repoRoot, "content", "fonts");
const pdfMainFont = "NotoSerif-Regular.ttf";
const experienceHighlightsManifestPath = path.join(
  repoRoot,
  "assets",
  "img",
  "experience-highlights",
  "manifest.json"
);
const publicTourImagePrefix = "/public/v1/tour-images/";
const pdfImageWidth = "35%";
const missing = "missing";

function printUsage() {
  console.log(`Usage: scripts/content/create_tour_review_markdown.mjs [tour-id-or-path ...] [options]

Creates review files named review_{last 6 characters of tour ID}.md and .pdf.
Without a tour input, only tours with "published_on_webpage": true are converted.

Examples:
  scripts/content/create_tour_reviews.sh
  scripts/content/create_tour_reviews.sh tour_16531bfc-a60f-4128-9abe-2eada1f2d7d8
  scripts/content/create_tour_reviews.sh content/tours/tour_16531bfc-a60f-4128-9abe-2eada1f2d7d8/tour.json

Options:
  --tour TOUR_ID_OR_PATH    Convert one tour. Can be repeated.
  --output DIR              Output directory. Default: content/tours
  --help                    Show this help.`);
}

function parseArgs(argv) {
  const options = {
    outputDir: defaultOutputDir,
    tourInputs: []
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (arg === "--output") {
      const value = argv[++index];
      if (!value) throw new Error("--output requires a directory.");
      options.outputDir = path.resolve(value);
      continue;
    }
    if (arg === "--tour") {
      const value = argv[++index];
      if (!value) throw new Error("--tour requires a tour ID or path.");
      options.tourInputs.push(value);
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
    options.tourInputs.push(arg);
  }
  return options;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function textOrMissing(value) {
  const text = normalizeText(value);
  return text || missing;
}

function englishLocalizedText(value) {
  if (typeof value === "string") return textOrMissing(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return missing;
  return textOrMissing(value.en);
}

function englishField(primaryValue, fallbackValue = "") {
  const primary = typeof primaryValue === "string"
    ? normalizeText(primaryValue)
    : normalizeText(primaryValue?.en);
  if (primary) return primary;
  return textOrMissing(fallbackValue);
}

function optionalEnglishField(primaryValue, fallbackValue = "") {
  const primary = typeof primaryValue === "string"
    ? normalizeText(primaryValue)
    : normalizeText(primaryValue?.en);
  return primary || normalizeText(fallbackValue);
}

function singleLine(value) {
  return textOrMissing(value).replace(/\s+/g, " ");
}

function markdownText(value) {
  const text = textOrMissing(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
}

function escapeMarkdownInline(value) {
  return singleLine(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("`", "\\`");
}

function normalizeImageStoragePath(storagePath) {
  const value = normalizeText(storagePath);
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith(publicTourImagePrefix)) {
    return value.slice(publicTourImagePrefix.length).replace(/^\/+/, "");
  }
  if (value.startsWith("public/v1/tour-images/")) {
    return value.slice("public/v1/tour-images/".length).replace(/^\/+/, "");
  }
  return value.replace(/^\/+/, "");
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (fallback !== null) return fallback;
    throw new Error(`Could not read ${filePath}: ${error.message}`);
  }
}

async function commandExists(command) {
  try {
    await execFile("sh", ["-c", `command -v "$1" >/dev/null 2>&1`, "sh", command]);
    return true;
  } catch {
    return false;
  }
}

async function imageMagickCommand() {
  if (await commandExists("magick")) return "magick";
  if (await commandExists("convert")) return "convert";
  throw new Error("ImageMagick is required. Install a command named `magick` or `convert`.");
}

function shortTourId(tourId) {
  const id = normalizeText(tourId);
  return id ? id.slice(-6) : missing;
}

async function listTourJsonPaths(tourInputs) {
  if (tourInputs.length) {
    return tourInputs.map((input) => {
      const value = normalizeText(input);
      if (!value) throw new Error("Tour input cannot be empty.");
      const absolute = path.resolve(value);
      if (value.endsWith(".json")) return absolute;
      if (value.includes(path.sep) || value.startsWith(".")) return path.join(absolute, "tour.json");
      return path.join(toursDir, value, "tour.json");
    });
  }
  const entries = await readdir(toursDir, { withFileTypes: true });
  const tourJsonPaths = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("tour_"))
    .map((entry) => path.join(toursDir, entry.name, "tour.json"))
    .sort();
  const publishedTourJsonPaths = [];
  for (const tourJsonPath of tourJsonPaths) {
    const tour = await readJson(tourJsonPath, {});
    if (tour?.published_on_webpage === true) {
      publishedTourJsonPaths.push(tourJsonPath);
    }
  }
  return publishedTourJsonPaths;
}

function buildStyleLabelMap(styleCatalog) {
  const labels = new Map();
  for (const item of Array.isArray(styleCatalog) ? styleCatalog : []) {
    const code = normalizeText(item?.code);
    if (!code) continue;
    labels.set(code, normalizeText(item?.labels?.en) || code);
  }
  return labels;
}

function buildExperienceHighlightMap(manifest) {
  const highlights = new Map();
  for (const item of Array.isArray(manifest) ? manifest : []) {
    const id = normalizeText(item?.id);
    if (!id) continue;
    highlights.set(id, normalizeText(item?.title_i18n?.en) || normalizeText(item?.title) || id);
  }
  return highlights;
}

function travelPlanDays(tour) {
  return Array.isArray(tour?.travel_plan?.days) ? tour.travel_plan.days : [];
}

function collectImageCandidates(service) {
  const candidates = [];
  if (service?.image && typeof service.image === "object" && !Array.isArray(service.image)) {
    candidates.push(service.image);
  }
  if (Array.isArray(service?.images)) {
    candidates.push(...[...service.images].sort((left, right) => {
      return Number(left?.sort_order || 0) - Number(right?.sort_order || 0);
    }));
  }
  return candidates;
}

function collectTravelTourCardImages(tour) {
  const travelPlan = tour?.travel_plan || {};
  const selectedPrimaryId = normalizeText(travelPlan.tour_card_primary_image_id);
  const selectedImageIds = Array.from(new Set((Array.isArray(travelPlan.tour_card_image_ids)
    ? travelPlan.tour_card_image_ids
    : [])
    .map((value) => normalizeText(value))
    .filter(Boolean)));
  const entries = [];
  const seenPaths = new Set();

  for (const day of travelPlanDays(tour)) {
    for (const service of Array.isArray(day?.services) ? day.services : []) {
      for (const image of collectImageCandidates(service)) {
        if (!image || typeof image !== "object" || Array.isArray(image)) continue;
        if (image.include_in_travel_tour_card !== true || image.is_customer_visible === false) continue;
        const storagePath = normalizeImageStoragePath(image.storage_path || image.url || image.src || image.path);
        if (!storagePath || seenPaths.has(storagePath)) continue;
        seenPaths.add(storagePath);
        entries.push({
          id: normalizeText(image.id),
          image,
          storagePath,
          serviceTitle: englishField(service?.title_i18n, service?.title)
        });
      }
    }
  }

  const primaryIndex = selectedPrimaryId
    ? entries.findIndex((entry) => entry.id === selectedPrimaryId)
    : -1;
  if (primaryIndex > 0) {
    const [primaryEntry] = entries.splice(primaryIndex, 1);
    entries.unshift(primaryEntry);
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
  return entries;
}

function collectServiceImages(tour) {
  const entries = [];
  const seenPaths = new Set();
  for (const day of travelPlanDays(tour)) {
    const dayNumber = normalizeText(day?.day_number);
    for (const service of Array.isArray(day?.services) ? day.services : []) {
      const serviceTitle = englishField(service?.title_i18n, service?.title);
      for (const image of collectImageCandidates(service)) {
        if (!image || typeof image !== "object" || Array.isArray(image)) continue;
        if (image.is_customer_visible === false) continue;
        const storagePath = normalizeImageStoragePath(image.storage_path || image.url || image.src || image.path);
        if (!storagePath || seenPaths.has(storagePath)) continue;
        seenPaths.add(storagePath);
        entries.push({
          dayNumber,
          serviceTitle,
          storagePath
        });
      }
    }
  }
  return entries;
}

function styleLabels(tour, styleLabelMap) {
  return (Array.isArray(tour?.styles) ? tour.styles : [])
    .map((code) => normalizeText(code))
    .filter(Boolean)
    .map((code) => styleLabelMap.get(code) || code);
}

function selectedExperienceHighlights(tour, experienceHighlightMap) {
  const seen = new Set();
  return (Array.isArray(tour?.travel_plan?.one_pager_experience_highlight_ids)
    ? tour.travel_plan.one_pager_experience_highlight_ids
    : [])
    .map((id) => normalizeText(id))
    .filter((id) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((id) => ({
      id,
      title: experienceHighlightMap.get(id) || id
    }));
}

function markdownList(items, formatter = (item) => item) {
  if (!items.length) return `- ${missing}`;
  return items.map((item) => `- ${formatter(item)}`).join("\n");
}

function renderTextReviewMarkdown(tour, { styleLabelMap, experienceHighlightMap }) {
  const tourId = textOrMissing(tour?.id);
  const title = englishLocalizedText(tour?.title);
  const days = travelPlanDays(tour);
  const dayCount = days.length ? String(days.length) : missing;
  const description = englishLocalizedText(tour?.short_description);
  const lines = [];

  lines.push(`# Review: ${title}`);
  lines.push("");
  lines.push(`- Tour ID: \`${tourId}\``);
  lines.push(`- Title: ${title}`);
  lines.push(`- Number of days: ${dayCount}`);
  lines.push("");
  lines.push("## Tour description");
  lines.push("");
  lines.push(markdownText(description));
  lines.push("");
  lines.push("## Tour card images");
  lines.push("");
  const cardImages = collectTravelTourCardImages(tour);
  lines.push(markdownList(cardImages, (entry) => entry.serviceTitle));
  lines.push("");
  lines.push("## Travel styles");
  lines.push("");
  lines.push(markdownList(styleLabels(tour, styleLabelMap)));
  lines.push("");
  lines.push("## Experience highlights");
  lines.push("");
  lines.push(markdownList(
    selectedExperienceHighlights(tour, experienceHighlightMap),
    (item) => `${item.title} (\`${item.id}\`)`
  ));
  lines.push("");
  lines.push("## Itinerary");

  if (!days.length) {
    lines.push("");
    lines.push(missing);
  }

  days.forEach((day, dayIndex) => {
    const dayNumber = normalizeText(day?.day_number) || String(dayIndex + 1);
    const dayTitle = englishField(day?.title_i18n, day?.title);
    const dayDetails = textOrMissing(
      optionalEnglishField(day?.details_i18n, day?.details)
      || optionalEnglishField(day?.notes_i18n, day?.notes)
    );
    const services = Array.isArray(day?.services) ? day.services : [];

    lines.push("");
    lines.push(`### Day ${dayNumber}`);
    lines.push("");
    lines.push(`**Day title:** ${dayTitle}`);
    lines.push("");
    lines.push("**Day Details**");
    lines.push("");
    lines.push(markdownText(dayDetails));
    lines.push("");
    lines.push("#### Services");
    lines.push("");
    if (!services.length) {
      lines.push(missing);
      return;
    }

    services.forEach((service, serviceIndex) => {
      const serviceTitle = englishField(service?.title_i18n, service?.title);
      const serviceDetail = englishField(service?.details_i18n, service?.details);
      lines.push(`##### Service ${serviceIndex + 1}`);
      lines.push("");
      lines.push(`**Service Title:** ${serviceTitle}`);
      lines.push("");
      lines.push("**Service Detail**");
      lines.push("");
      lines.push(markdownText(serviceDetail));
      lines.push("");
    });
  });

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

function imageDiskPath(storagePath) {
  const normalized = normalizeImageStoragePath(storagePath);
  if (!normalized || /^https?:\/\//i.test(normalized)) return "";
  return path.join(toursDir, normalized);
}

function pandocImagePath(filePath) {
  return filePath.replaceAll("\\", "/").replaceAll(" ", "%20").replaceAll(")", "%29");
}

function renderImageReviewMarkdown(tour, imageEntries) {
  const title = englishLocalizedText(tour?.title);
  const lines = [
    "---",
    `title: "Image review: ${singleLine(title).replaceAll('"', '\\"')}"`,
    "geometry: margin=0.7in",
    "---",
    "",
    `# Image review: ${title}`,
    ""
  ];
  if (!imageEntries.length) {
    lines.push(missing);
  }
  imageEntries.forEach((entry, index) => {
    const prefix = entry.dayNumber ? `Day ${entry.dayNumber}: ` : "";
    lines.push(`## ${index + 1}. ${prefix}${entry.serviceTitle}`);
    lines.push("");
    lines.push(`![](${pandocImagePath(entry.pdfImagePath)}){width=${pdfImageWidth}}`);
    lines.push("");
  });
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n")}\n`;
}

async function preparePdfImageEntries(tour, tempDir) {
  const entries = [];
  const serviceImages = collectServiceImages(tour);
  const imageCommand = await imageMagickCommand();
  for (let index = 0; index < serviceImages.length; index += 1) {
    const entry = serviceImages[index];
    const sourcePath = imageDiskPath(entry.storagePath);
    if (!sourcePath) continue;
    const outputPath = path.join(tempDir, `image_${String(index + 1).padStart(3, "0")}.jpg`);
    await execFile(imageCommand, [
      sourcePath,
      "-auto-orient",
      "-resize",
      "1400x1400>",
      "-quality",
      "86",
      outputPath
    ]);
    entries.push({
      ...entry,
      pdfImagePath: outputPath
    });
  }
  return entries;
}

async function writeImageReviewPdf(tour, outputPath) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "tour-review-images-"));
  try {
    const imageEntries = await preparePdfImageEntries(tour, tempDir);
    const markdownPath = path.join(tempDir, "images.md");
    await writeFile(markdownPath, renderImageReviewMarkdown(tour, imageEntries), "utf8");
    await execFile("pandoc", [
      markdownPath,
      "--pdf-engine=xelatex",
      "-V",
      `mainfont=${pdfMainFont}`,
      "-V",
      `mainfontoptions=Path=${pdfFontDir}/`,
      "-o",
      outputPath
    ], { cwd: tempDir });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [styleCatalog, experienceHighlightsManifest, tourJsonPaths] = await Promise.all([
    readJson(styleCatalogPath, []),
    readJson(experienceHighlightsManifestPath, []),
    listTourJsonPaths(options.tourInputs)
  ]);
  const styleLabelMap = buildStyleLabelMap(styleCatalog);
  const experienceHighlightMap = buildExperienceHighlightMap(experienceHighlightsManifest);
  await mkdir(options.outputDir, { recursive: true });

  let writtenCount = 0;
  for (const tourJsonPath of tourJsonPaths) {
    const tour = await readJson(tourJsonPath);
    const tourId = normalizeText(tour?.id) || path.basename(path.dirname(tourJsonPath));
    if (!tourId) throw new Error(`Could not determine tour ID for ${tourJsonPath}.`);
    const fileId = shortTourId(tourId);
    const markdown = renderTextReviewMarkdown(tour, { styleLabelMap, experienceHighlightMap });
    const markdownPath = path.join(options.outputDir, `review_${fileId}.md`);
    const pdfPath = path.join(options.outputDir, `review_${fileId}.pdf`);
    await writeFile(markdownPath, markdown, "utf8");
    await writeImageReviewPdf(tour, pdfPath);
    writtenCount += 1;
    console.log(`Wrote ${path.relative(repoRoot, markdownPath)}`);
    console.log(`Wrote ${path.relative(repoRoot, pdfPath)}`);
  }
  console.log(`Done. Wrote ${writtenCount} review set${writtenCount === 1 ? "" : "s"}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
