#!/usr/bin/env node
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  copyCachedServiceImageDerivative,
  serviceImageDerivativeRelativePath
} from "../lib/service_image_derivatives.mjs";
import {
  matrixMarketingTourHref,
  matrixPageControlScript,
  matrixPageControlStyles,
  renderMatrixHeaderActions
} from "./matrix_page_controls.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const defaultToursDir = path.join(repoRoot, "content", "tours");
const defaultOutputPath = "/tmp/tour-photo-matrix/index.html";
const imageExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);
const missingPhotoWarningImage = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" role="img" aria-label="Missing photo">
  <rect width="300" height="300" rx="18" fill="#fef2f2"/>
  <path d="M150 48 266 252H34L150 48Z" fill="#dc2626"/>
  <path d="M150 100v78" stroke="#fff" stroke-width="20" stroke-linecap="round"/>
  <circle cx="150" cy="216" r="12" fill="#fff"/>
  <text x="150" y="286" fill="#991b1b" font-family="Arial, sans-serif" font-size="22" font-weight="700" text-anchor="middle">Missing photo</text>
</svg>`)}`;

function printUsage() {
  console.log(`Usage: scripts/content/create_tour_photo_matrix.mjs [options]

Creates a static HTML matrix of itinerary services found in content/tours/*/tour.json.
Service images are copied into an img/ folder next to the HTML file and referenced with relative paths.
Before creating the matrix, unused images in content/tours/*/travel-plan-services are deleted.

Options:
  --tours DIR                              Tours directory. Default: content/tours
  --output FILE                            HTML output path. Default: /tmp/tour-photo-matrix/index.html
  --no-delete-unused-service-photos        Keep unused travel-plan service photos
  --dry-run-delete-unused-service-photos   Report unused travel-plan service photos without deleting them
  --help                                   Show this help.`);
}

function parseArgs(argv) {
  const options = {
    toursDir: defaultToursDir,
    outputPath: defaultOutputPath,
    deleteUnusedServicePhotos: true,
    dryRunDeleteUnusedServicePhotos: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--tours") {
      const value = argv[++index];
      if (!value) throw new Error("--tours requires a directory.");
      options.toursDir = path.resolve(value);
      continue;
    }

    if (arg === "--output") {
      const value = argv[++index];
      if (!value) throw new Error("--output requires a file path.");
      options.outputPath = path.resolve(value);
      continue;
    }

    if (arg === "--no-delete-unused-service-photos") {
      options.deleteUnusedServicePhotos = false;
      options.dryRunDeleteUnusedServicePhotos = false;
      continue;
    }

    if (arg === "--dry-run-delete-unused-service-photos") {
      options.deleteUnusedServicePhotos = true;
      options.dryRunDeleteUnusedServicePhotos = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function localizedText(item, field) {
  return normalizeText(item?.[`${field}_i18n`]?.en) || normalizeText(item?.[field]);
}

function naturalCompare(left, right) {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function normalizeRelativePath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^\/+/, "");
}

function stripUrlParts(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  let pathValue = normalized;
  if (/^https?:\/\//i.test(pathValue)) {
    try {
      pathValue = new URL(pathValue).pathname;
    } catch {
      return "";
    }
  }
  return pathValue.split("?")[0].split("#")[0];
}

function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function serviceImageRelativePathFromReference(value, currentTourId) {
  let relativePath = normalizeRelativePath(decodePath(stripUrlParts(value)));
  if (!relativePath) return "";

  for (const prefix of [
    "public/v1/tour-images/",
    "assets/generated/homepage/tours/",
    "assets/tours/"
  ]) {
    if (relativePath.startsWith(prefix)) {
      relativePath = relativePath.slice(prefix.length);
      break;
    }
  }

  const normalizedTourId = normalizeRelativePath(currentTourId);
  if (normalizedTourId && relativePath.startsWith("travel-plan-services/")) {
    relativePath = `${normalizedTourId}/${relativePath}`;
  }

  if (!/^tour_[^/]+\/travel-plan-services\/.+/i.test(relativePath)) return "";
  if (!imageExtensions.has(path.extname(relativePath).toLowerCase())) return "";
  return relativePath;
}

function collectServiceImageReferences(value, currentTourId, output) {
  if (typeof value === "string") {
    const relativePath = serviceImageRelativePathFromReference(value, currentTourId);
    if (relativePath) output.add(relativePath);
    return;
  }

  if (!value || typeof value !== "object") return;
  const values = Array.isArray(value) ? value : Object.values(value);
  for (const item of values) {
    collectServiceImageReferences(item, currentTourId, output);
  }
}

async function getTourDirents(toursDir) {
  const entries = await readdir(toursDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .sort((left, right) => naturalCompare(left.name, right.name));
}

async function collectReferencedServiceImagePaths(toursDir, tourDirs) {
  const referencedPaths = new Set();
  for (const dirent of tourDirs) {
    const tourJsonPath = path.join(toursDir, dirent.name, "tour.json");
    if (!(await pathExists(tourJsonPath))) continue;
    const tourJson = await readJson(tourJsonPath);
    collectServiceImageReferences(tourJson, dirent.name, referencedPaths);
  }
  return referencedPaths;
}

async function listTravelPlanServicePhotos(toursDir, tourDirent) {
  const servicePhotosDir = path.join(toursDir, tourDirent.name, "travel-plan-services");
  if (!(await pathExists(servicePhotosDir))) return [];
  return listImageFiles(servicePhotosDir);
}

async function deleteUnusedTravelPlanServicePhotos(toursDir, { dryRun = false } = {}) {
  const tourDirs = await getTourDirents(toursDir);
  const referencedPaths = await collectReferencedServiceImagePaths(toursDir, tourDirs);
  const unusedPhotos = [];

  for (const dirent of tourDirs) {
    const photos = await listTravelPlanServicePhotos(toursDir, dirent);
    for (const photoPath of photos) {
      const relativePath = normalizeRelativePath(path.relative(toursDir, photoPath));
      if (referencedPaths.has(relativePath)) continue;
      unusedPhotos.push({
        path: photoPath,
        relativePath
      });
    }
  }

  if (!dryRun) {
    for (const photo of unusedPhotos) {
      await rm(photo.path, { force: true });
    }
  }

  return {
    dryRun,
    unusedPhotos,
    referencedCount: referencedPaths.size
  };
}

async function listImageFiles(dir, { includeImagesInCurrentDir = true } = {}) {
  const entries = await readdir(dir, { withFileTypes: true });
  const imagePaths = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      imagePaths.push(...(await listImageFiles(entryPath)));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!includeImagesInCurrentDir) continue;
    if (imageExtensions.has(path.extname(entry.name).toLowerCase())) {
      imagePaths.push(entryPath);
    }
  }

  return imagePaths.sort(naturalCompare);
}

function getEnglishTitle(tourJson, tourId) {
  const candidates = [
    tourJson?.title,
    tourJson?.title_i18n?.en,
    tourJson?.name,
    tourJson?.name_i18n?.en
  ];
  const title = candidates.find((value) => typeof value === "string" && value.trim());
  return title?.trim() || tourId;
}

function isPublishedOnWebpage(tourJson) {
  return tourJson?.published_on_webpage === true;
}

function imageCandidatesForService(service) {
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

function normalizeDayNumber(day, index) {
  const parsed = Number(day?.day_number);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return index + 1;
}

function storagePathFromImage(image) {
  if (!image || typeof image !== "object" || Array.isArray(image)) return "";
  return normalizeText(image.storage_path || image.url || image.src || image.path);
}

function serviceImageFromCandidate(image, tourId, toursDir) {
  const sourceRelativePath = serviceImageRelativePathFromReference(storagePathFromImage(image), tourId);
  if (!sourceRelativePath) return null;

  return {
    fileName: path.basename(sourceRelativePath),
    sourceRelativePath,
    sourcePath: path.join(toursDir, sourceRelativePath),
    url: "",
    missing: false
  };
}

function selectedServiceImage(service, tourId, toursDir) {
  const seen = new Set();
  for (const candidate of imageCandidatesForService(service)) {
    const image = serviceImageFromCandidate(candidate, tourId, toursDir);
    if (!image || seen.has(image.sourceRelativePath)) continue;
    seen.add(image.sourceRelativePath);
    return image;
  }
  return null;
}

function collectServices(tourJson, tourId, toursDir) {
  const days = (Array.isArray(tourJson?.travel_plan?.days) ? tourJson.travel_plan.days : [])
    .map((day, index) => ({
      day,
      dayNumber: normalizeDayNumber(day, index),
      originalIndex: index
    }))
    .sort((left, right) => {
      if (left.dayNumber !== right.dayNumber) return left.dayNumber - right.dayNumber;
      return left.originalIndex - right.originalIndex;
    });

  const services = [];
  for (const { day, dayNumber } of days) {
    for (const service of Array.isArray(day?.services) ? day.services : []) {
      services.push({
        dayNumber,
        title: localizedText(service, "title") || "Untitled service",
        image: selectedServiceImage(service, tourId, toursDir)
      });
    }
  }

  return services;
}

async function readTour(tourDir, dirent) {
  const tourId = dirent.name;
  const tourJsonPath = path.join(tourDir, "tour.json");
  if (!(await pathExists(tourJsonPath))) return null;

  const tourJson = await readJson(tourJsonPath);

  return {
    id: tourId,
    title: getEnglishTitle(tourJson, tourId),
    published: isPublishedOnWebpage(tourJson),
    services: collectServices(tourJson, tourId, path.dirname(tourDir))
  };
}

function compareTours(left, right) {
  if (left.published !== right.published) return left.published ? -1 : 1;
  return naturalCompare(left.title, right.title);
}

async function readTours(toursDir) {
  const tourDirs = await getTourDirents(toursDir);
  const tours = [];
  for (const dirent of tourDirs) {
    const tour = await readTour(path.join(toursDir, dirent.name), dirent);
    if (tour) tours.push(tour);
  }

  return tours.sort(compareTours);
}

function toRelativeUrl(filePath) {
  return filePath.split(path.sep).map(encodeURIComponent).join("/");
}

async function copyServiceImagesForOutput({ tours, outputPath }) {
  const outputDir = path.dirname(outputPath);
  const imageOutputDir = path.join(outputDir, "img");
  const copiedImages = new Set();
  await mkdir(outputDir, { recursive: true });
  await rm(imageOutputDir, { recursive: true, force: true });

  for (const tour of tours) {
    for (const service of tour.services) {
      const image = service.image;
      if (!image) continue;
      if (!(await pathExists(image.sourcePath))) {
        image.missing = true;
        continue;
      }

      const sourceRelativePath = image.sourceRelativePath;
      const outputRelativePath = path.join("img", serviceImageDerivativeRelativePath(sourceRelativePath, {
        variant: "matrix-thumb"
      }));
      const copiedImagePath = path.join(outputDir, outputRelativePath);

      if (!copiedImages.has(sourceRelativePath)) {
        await copyCachedServiceImageDerivative({
          sourcePath: image.sourcePath,
          sourceRelativePath,
          outputPath: copiedImagePath,
          variant: "matrix-thumb"
        });
        copiedImages.add(sourceRelativePath);
      }
      image.url = toRelativeUrl(outputRelativePath);
    }
  }
}

function renderMissingPhoto(message) {
  return `<div class="missing-photo">
          <img src="${escapeHtml(missingPhotoWarningImage)}" alt="${escapeHtml(message)}" loading="lazy">
          <div class="missing-photo-label">${escapeHtml(message)}</div>
        </div>`;
}

function renderServiceCell(service) {
  const imageLabel = service.title;
  const imageHtml = service.image?.url
    ? `<a href="${escapeHtml(service.image.url)}" target="_blank" rel="noopener">
          <img src="${escapeHtml(service.image.url)}" alt="${escapeHtml(imageLabel)}" loading="lazy">
        </a>`
    : renderMissingPhoto(service.image?.missing ? "Photo file missing" : "No photo selected");

  return `<td class="photo-cell${service.image?.url ? "" : " is-missing-photo"}">
        ${imageHtml}
        <div class="service-title" title="${escapeHtml(service.title)}">${escapeHtml(service.title)}</div>
      </td>`;
}

function renderHtml({ tours }) {
  const maxServices = tours.reduce((max, tour) => Math.max(max, tour.services.length), 0);
  const unpublishedTourCount = tours.length - tours.filter((tour) => tour.published).length;
  const headerCells = Array.from({ length: maxServices }, (_, index) => `<th>Service ${index + 1}</th>`).join("");
  const visibilityControl = unpublishedTourCount
    ? `<button class="publication-toggle" type="button" data-toggle-unpublished data-show-label="Not published tours (${unpublishedTourCount})" data-hide-label="Hide not published tours" aria-pressed="false">Not published tours (${unpublishedTourCount})</button>`
    : "";
  const headerActions = renderMatrixHeaderActions({ visibilityControl });
  const rows = tours
    .map((tour) => {
      const serviceCells = tour.services.map((service) => renderServiceCell(service)).join("");
      const emptyCells = Array.from({ length: maxServices - tour.services.length }, () => '<td class="empty-cell"></td>').join("");
      const marketingTourHref = matrixMarketingTourHref(tour.id);

      return `<tr data-published="${tour.published ? "true" : "false"}">
      <th class="tour-cell" scope="row">
        <div class="tour-title">${escapeHtml(tour.title)}</div>
        <div class="publication-badge ${tour.published ? "is-published" : "is-unpublished"}">${tour.published ? "Show on web page" : "Not published"}</div>
        <div class="tour-id">${escapeHtml(tour.id)}</div>
        <div class="service-count">${tour.services.length} services</div>
        <a class="matrix-tour-link" href="${escapeHtml(marketingTourHref)}" target="_blank" rel="noopener" data-open-marketing-tour>Open marketing tour</a>
      </th>
      ${serviceCells}${emptyCells}
    </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tour Photo Matrix</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f4;
      --surface: #ffffff;
      --text: #182321;
      --muted: #60716d;
      --line: #dbe3df;
      --accent: #0f766e;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 14px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    header {
      padding: 18px 20px 14px;
      border-bottom: 1px solid var(--line);
      background: var(--surface);
      position: sticky;
      top: 0;
      z-index: 5;
    }

    h1 {
      margin: 0 0 6px;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0;
    }

    .header-row {
      align-items: flex-start;
      display: flex;
      gap: 12px;
      justify-content: space-between;
    }

${matrixPageControlStyles}

    .publication-toggle {
      background: #ffffff;
      border: 1px solid var(--line);
      color: #29433e;
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      min-height: 34px;
      padding: 6px 10px;
      white-space: nowrap;
    }

    .publication-toggle:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    body:not(.show-unpublished) tr[data-published="false"] {
      display: none;
    }

    .matrix-wrap {
      overflow: auto;
      height: calc(100vh - 66px);
    }

    table {
      border-collapse: separate;
      border-spacing: 0;
      min-width: max-content;
      background: var(--surface);
    }

    th,
    td {
      border-right: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }

    thead th {
      background: #edf5f2;
      color: #29433e;
      font-size: 12px;
      font-weight: 700;
      padding: 8px;
      position: sticky;
      top: 0;
      z-index: 3;
      text-align: left;
      white-space: nowrap;
    }

    thead th:first-child {
      left: 0;
      z-index: 4;
    }

    .tour-cell {
      background: #ffffff;
      left: 0;
      min-width: 260px;
      max-width: 260px;
      padding: 12px;
      position: sticky;
      text-align: left;
      z-index: 2;
    }

    .tour-title {
      font-weight: 700;
      margin-bottom: 4px;
    }

    .publication-badge {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .publication-badge.is-unpublished {
      color: #a16207;
    }

    .tour-id,
    .service-count {
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .photo-cell {
      background: #ffffff;
      min-width: 224px;
      padding: 10px 11px 8px;
    }

    .photo-cell a {
      display: block;
    }

    .photo-cell img {
      background: #eef2f0;
      border: 1px solid var(--line);
      display: block;
      height: 132px;
      max-height: 300px;
      max-width: 300px;
      object-fit: contain;
      width: 200px;
    }

    .is-missing-photo img {
      background: #fef2f2;
      border-color: #dc2626;
    }

    .missing-photo-label {
      color: #b91c1c;
      font-size: 12px;
      font-weight: 700;
      margin-top: 5px;
      max-width: 200px;
      overflow-wrap: anywhere;
    }

    .service-title {
      color: var(--text);
      font-size: 13px;
      font-weight: 700;
      margin-top: 7px;
      max-width: 200px;
      overflow-wrap: anywhere;
    }

    .empty-cell {
      background: #fafbf9;
      min-width: 224px;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-row">
      <h1>Tour Photo Matrix</h1>
      ${headerActions}
    </div>
  </header>
  <div class="matrix-wrap">
    <table>
      <thead>
        <tr>
          <th>Tour title</th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>
  <script>
    (() => {
      const button = document.querySelector("[data-toggle-unpublished]");
      if (!button) return;
      button.addEventListener("click", () => {
        const showing = document.body.classList.toggle("show-unpublished");
        button.setAttribute("aria-pressed", showing ? "true" : "false");
        button.textContent = showing ? button.dataset.hideLabel : button.dataset.showLabel;
      });
    })();
${matrixPageControlScript}
  </script>
</body>
</html>
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cleanup = options.deleteUnusedServicePhotos
    ? await deleteUnusedTravelPlanServicePhotos(options.toursDir, { dryRun: options.dryRunDeleteUnusedServicePhotos })
    : null;
  const tours = await readTours(options.toursDir);
  await copyServiceImagesForOutput({
    tours,
    outputPath: options.outputPath
  });
  const html = renderHtml({
    tours
  });

  await writeFile(options.outputPath, html);
  console.log(`Wrote ${options.outputPath}`);
  console.log(`Copied images to ${path.join(path.dirname(options.outputPath), "img")}`);
  if (cleanup) {
    const action = cleanup.dryRun ? "Would delete" : "Deleted";
    console.log(`${action} ${cleanup.unusedPhotos.length} unused travel-plan service photos.`);
  }
  const serviceCount = tours.reduce((total, tour) => total + tour.services.length, 0);
  const missingPhotoCount = tours.reduce((total, tour) => {
    return total + tour.services.filter((service) => !service.image?.url).length;
  }, 0);
  console.log(`Included ${tours.length} tours, ${serviceCount} services, and ${missingPhotoCount} services without photos.`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
