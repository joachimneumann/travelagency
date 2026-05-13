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
const defaultOutputPath = "/tmp/tour-content-matrix/index.html";
const imageExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);

function printUsage() {
  console.log(`Usage: scripts/content/create_tour_content_matrix.mjs [options]

Creates a static HTML matrix of tour itinerary content.
Rows are tours. Columns are tour identity/content and one column per itinerary day.
Service images are copied into an img/content-matrix/ folder next to the HTML file.

Options:
  --tours DIR      Tours directory. Default: content/tours
  --output FILE    HTML output path. Default: /tmp/tour-content-matrix/index.html
  --help           Show this help.`);
}

function parseArgs(argv) {
  const options = {
    toursDir: defaultToursDir,
    outputPath: defaultOutputPath
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

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
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
  return String(value || "")
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
}

function stripUrlParts(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return normalized.split("?")[0].split("#")[0];
}

function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toRelativeUrl(filePath) {
  return filePath.split(path.sep).map(encodeURIComponent).join("/");
}

function isExternalUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function storagePathFromImage(image) {
  if (!image || typeof image !== "object" || Array.isArray(image)) return "";
  return normalizeText(image.storage_path || image.url || image.src || image.path);
}

function serviceImageRelativePathFromStoragePath(storagePath, currentTourId) {
  let relativePath = normalizeRelativePath(decodePath(stripUrlParts(storagePath)));
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

function buildImageRef(image, tourId, toursDir) {
  const storagePath = storagePathFromImage(image);
  if (!storagePath) return null;

  if (isExternalUrl(storagePath)) {
    return {
      storagePath,
      sourceRelativePath: "",
      sourcePath: "",
      fileName: path.basename(new URL(storagePath).pathname) || "image",
      url: storagePath,
      altText: normalizeText(image.alt_text) || normalizeText(image.caption),
      missing: false
    };
  }

  const sourceRelativePath = serviceImageRelativePathFromStoragePath(storagePath, tourId);
  if (!sourceRelativePath) return null;

  return {
    storagePath,
    sourceRelativePath,
    sourcePath: path.join(toursDir, sourceRelativePath),
    fileName: path.basename(sourceRelativePath),
    url: "",
    altText: normalizeText(image.alt_text) || normalizeText(image.caption),
    missing: false
  };
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

function collectServiceImages(service, tourId, toursDir) {
  const images = [];
  const seen = new Set();
  for (const candidate of imageCandidatesForService(service)) {
    const image = buildImageRef(candidate, tourId, toursDir);
    if (!image) continue;
    const key = image.sourceRelativePath || image.url;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    images.push(image);
  }
  return images;
}

function serviceTiming(service) {
  return [
    normalizeText(service?.time_label_i18n?.en) || normalizeText(service?.time_label),
    normalizeText(service?.start_time),
    normalizeText(service?.end_time) ? `- ${normalizeText(service.end_time)}` : ""
  ].filter(Boolean).join(" ");
}

function collectServices(day, tourId, toursDir) {
  return (Array.isArray(day?.services) ? day.services : [])
    .map((service, index) => ({
      id: normalizeText(service?.id),
      order: index + 1,
      title: localizedText(service, "title") || `Service ${index + 1}`,
      details: localizedText(service, "details"),
      location: localizedText(service, "location"),
      timing: serviceTiming(service),
      imageSubtitle: localizedText(service, "image_subtitle"),
      images: collectServiceImages(service, tourId, toursDir)
    }));
}

function normalizeDayNumber(day, index) {
  const parsed = Number(day?.day_number);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return index + 1;
}

function collectDays(tourJson, tourId, toursDir) {
  return (Array.isArray(tourJson?.travel_plan?.days) ? tourJson.travel_plan.days : [])
    .map((day, index) => {
      const dayNumber = normalizeDayNumber(day, index);
      return {
        id: normalizeText(day?.id),
        dayNumber,
        title: localizedText(day, "title") || `Day ${dayNumber}`,
        details: localizedText(day, "notes") || localizedText(day, "details") || localizedText(day, "description"),
        overnightLocation: localizedText(day, "overnight_location"),
        services: collectServices(day, tourId, toursDir)
      };
    })
    .sort((left, right) => left.dayNumber - right.dayNumber);
}

function getTourTitle(tourJson, tourId) {
  return localizedText(tourJson, "title") || localizedText(tourJson, "name") || tourId;
}

function getTourName(tourJson, tourId) {
  return localizedText(tourJson, "name") || tourId;
}

function getTourDescription(tourJson) {
  return localizedText(tourJson, "short_description")
    || localizedText(tourJson, "description")
    || localizedText(tourJson, "summary");
}

function isPublishedOnWebpage(tourJson) {
  return tourJson?.published_on_webpage === true;
}

async function readTour(tourDir, dirent, toursDir) {
  const tourId = dirent.name;
  const tourJsonPath = path.join(tourDir, "tour.json");
  if (!(await pathExists(tourJsonPath))) return null;

  const tourJson = await readJson(tourJsonPath);
  return {
    id: tourId,
    name: getTourName(tourJson, tourId),
    title: getTourTitle(tourJson, tourId),
    description: getTourDescription(tourJson),
    published: isPublishedOnWebpage(tourJson),
    days: collectDays(tourJson, tourId, toursDir)
  };
}

function compareTours(left, right) {
  if (left.published !== right.published) return left.published ? -1 : 1;
  return naturalCompare(left.title, right.title);
}

async function readTours(toursDir) {
  const entries = await readdir(toursDir, { withFileTypes: true });
  const tourDirs = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .sort((left, right) => naturalCompare(left.name, right.name));

  const tours = [];
  for (const dirent of tourDirs) {
    const tour = await readTour(path.join(toursDir, dirent.name), dirent, toursDir);
    if (tour) tours.push(tour);
  }

  return tours.sort(compareTours);
}

function iterImages(tours) {
  const images = [];
  for (const tour of tours) {
    for (const day of tour.days) {
      for (const service of day.services) {
        images.push(...service.images);
      }
    }
  }
  return images;
}

async function copyServiceImagesForOutput({ tours, outputPath }) {
  const outputDir = path.dirname(outputPath);
  const imageOutputDir = path.join(outputDir, "img", "content-matrix");
  const copied = new Set();

  await mkdir(outputDir, { recursive: true });
  await rm(imageOutputDir, { recursive: true, force: true });

  for (const image of iterImages(tours)) {
    if (!image.sourceRelativePath) continue;
    if (!(await pathExists(image.sourcePath))) {
      image.missing = true;
      continue;
    }

    const outputRelativePath = path.join("img", "content-matrix", serviceImageDerivativeRelativePath(image.sourceRelativePath, {
      variant: "matrix-thumb"
    }));
    const outputImagePath = path.join(outputDir, outputRelativePath);
    if (!copied.has(image.sourceRelativePath)) {
      await copyCachedServiceImageDerivative({
        sourcePath: image.sourcePath,
        sourceRelativePath: image.sourceRelativePath,
        outputPath: outputImagePath,
        variant: "matrix-thumb"
      });
      copied.add(image.sourceRelativePath);
    }
    image.url = toRelativeUrl(outputRelativePath);
  }
}

function matrixMarketingTourAnchor(href, markup, className = "matrix-marketing-tour-click") {
  return `<a class="${className}" href="${escapeAttr(href)}" target="_blank" rel="noopener" data-open-marketing-tour>${markup}</a>`;
}

function renderImage(image, marketingTourHref) {
  const label = image.altText || image.fileName || "Service image";
  if (image.url) {
    return matrixMarketingTourAnchor(marketingTourHref, `
              <img src="${escapeAttr(image.url)}" alt="${escapeAttr(label)}" loading="lazy">
            `, "service-image matrix-marketing-tour-click");
  }

  return matrixMarketingTourAnchor(marketingTourHref, `<span>${escapeHtml(image.missing ? "Missing image" : "No image")}</span>
            <small>${escapeHtml(image.fileName)}</small>`, "service-image is-missing matrix-marketing-tour-click");
}

function renderEmptyImage(marketingTourHref) {
  return matrixMarketingTourAnchor(marketingTourHref, "<span>No picture</span>", "service-image is-empty matrix-marketing-tour-click");
}

function renderService(service, marketingTourHref) {
  const details = service.details
    ? `<div class="service-details">${matrixMarketingTourAnchor(marketingTourHref, escapeHtml(service.details))}</div>`
    : "";
  const meta = [service.timing, service.location, service.imageSubtitle].filter(Boolean);
  const metaHtml = meta.length
    ? `<div class="service-meta">${meta.map((item) => `<span>${matrixMarketingTourAnchor(marketingTourHref, escapeHtml(item))}</span>`).join("")}</div>`
    : "";
  const imageHtml = service.images.length
    ? `<div class="service-images">${service.images.map((image) => renderImage(image, marketingTourHref)).join("")}</div>`
    : `<div class="service-images">${renderEmptyImage(marketingTourHref)}</div>`;

  return `<div class="service">
          <div class="service-heading">
            <span class="service-number">${service.order}</span>
            <span class="service-title">${matrixMarketingTourAnchor(marketingTourHref, escapeHtml(service.title))}</span>
          </div>
          ${metaHtml}
          ${details}
          ${imageHtml}
        </div>`;
}

function renderDayCell(days, marketingTourHref) {
  if (!days.length) return '<td class="empty-cell"></td>';

  return `<td class="day-cell">
        ${days.map((day) => {
          const details = day.details ? `<div class="day-details">${matrixMarketingTourAnchor(marketingTourHref, escapeHtml(day.details))}</div>` : "";
          const overnight = day.overnightLocation
            ? `<div class="day-overnight">${matrixMarketingTourAnchor(marketingTourHref, `Overnight: ${escapeHtml(day.overnightLocation)}`)}</div>`
            : "";
          const services = day.services.length
            ? day.services.map((service) => renderService(service, marketingTourHref)).join("")
            : `<div class="no-services">${matrixMarketingTourAnchor(marketingTourHref, "No services")}</div>`;

          return `<section class="day-section">
            <div class="day-title">${matrixMarketingTourAnchor(marketingTourHref, escapeHtml(day.title))}</div>
            ${details}
            ${overnight}
            <div class="services">${services}</div>
          </section>`;
        }).join("")}
      </td>`;
}

function renderHtml({ tours, toursDir, outputPath }) {
  const maxDayNumber = tours.reduce((max, tour) => Math.max(max, ...tour.days.map((day) => day.dayNumber), 0), 0);
  const serviceCount = tours.reduce((total, tour) => total + tour.days.reduce((dayTotal, day) => dayTotal + day.services.length, 0), 0);
  const imageCount = iterImages(tours).length;
  const publishedTourCount = tours.filter((tour) => tour.published).length;
  const unpublishedTourCount = tours.length - publishedTourCount;
  const dayHeaderCells = Array.from({ length: maxDayNumber }, (_, index) => `<th>Day ${index + 1}</th>`).join("");
  const visibilityControl = unpublishedTourCount
    ? `<button class="publication-toggle" type="button" data-toggle-unpublished data-show-label="Not published tours (${unpublishedTourCount})" data-hide-label="Hide not published tours" aria-pressed="false">Not published tours (${unpublishedTourCount})</button>`
    : "";
  const headerActions = renderMatrixHeaderActions({ visibilityControl });
  const rows = tours
    .map((tour) => {
      const marketingTourHref = matrixMarketingTourHref(tour.id);
      const daysByNumber = new Map();
      for (const day of tour.days) {
        const existing = daysByNumber.get(day.dayNumber) || [];
        existing.push(day);
        daysByNumber.set(day.dayNumber, existing);
      }
      const dayCells = Array.from({ length: maxDayNumber }, (_, index) => renderDayCell(daysByNumber.get(index + 1) || [], marketingTourHref)).join("");
      const description = tour.description ? `<div class="tour-description">${matrixMarketingTourAnchor(marketingTourHref, escapeHtml(tour.description))}</div>` : "";

      return `<tr data-published="${tour.published ? "true" : "false"}">
      <th class="tour-cell" scope="row">
        <div class="tour-name">${matrixMarketingTourAnchor(marketingTourHref, escapeHtml(tour.name))}</div>
        <div class="tour-title">${matrixMarketingTourAnchor(marketingTourHref, escapeHtml(tour.title))}</div>
        <div class="publication-badge ${tour.published ? "is-published" : "is-unpublished"}">${tour.published ? "Show on web page" : "Not published"}</div>
        ${description}
        <div class="tour-id">${matrixMarketingTourAnchor(marketingTourHref, escapeHtml(tour.id))}</div>
        <a class="matrix-tour-link" href="${escapeAttr(marketingTourHref)}" target="_blank" rel="noopener" data-open-marketing-tour>Open marketing tour</a>
      </th>
      ${dayCells}
    </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tour Content Matrix</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f4;
      --surface: #ffffff;
      --text: #182321;
      --muted: #60716d;
      --line: #dbe3df;
      --accent: #0f766e;
      --soft: #edf5f2;
      --warning: #a16207;
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

    .meta {
      color: var(--muted);
      display: flex;
      flex-wrap: wrap;
      gap: 10px 18px;
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
      height: calc(100vh - 86px);
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
      background: var(--soft);
      color: #29433e;
      font-size: 12px;
      font-weight: 700;
      padding: 8px 12px;
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
      min-width: 300px;
      max-width: 300px;
      padding: 12px;
      position: sticky;
      text-align: left;
      z-index: 2;
    }

    .tour-name,
    .day-title,
    .service-title {
      font-weight: 700;
    }

    .tour-title {
      color: #29433e;
      font-weight: 700;
      margin-top: 4px;
    }

    .publication-badge {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      margin-top: 4px;
    }

    .publication-badge.is-unpublished {
      color: var(--warning);
    }

    .tour-description,
    .day-details,
    .service-details {
      margin-top: 8px;
      overflow-wrap: anywhere;
      white-space: normal;
    }

    .tour-id,
    .service-meta,
    .day-overnight,
    .no-services {
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .tour-id {
      margin-top: 8px;
    }

    .day-cell {
      background: #ffffff;
      min-width: 360px;
      max-width: 420px;
      padding: 10px 12px;
    }

    .day-section + .day-section {
      border-top: 1px solid var(--line);
      margin-top: 12px;
      padding-top: 12px;
    }

    .day-title {
      font-size: 15px;
      margin-bottom: 8px;
      overflow-wrap: anywhere;
    }

    .day-overnight {
      margin-top: 6px;
    }

    .services {
      display: grid;
      gap: 10px;
      margin-top: 10px;
    }

    .service {
      border: 1px solid var(--line);
      padding: 9px;
    }

    .service-heading {
      align-items: flex-start;
      display: grid;
      gap: 8px;
      grid-template-columns: 24px minmax(0, 1fr);
    }

    .service-number {
      align-items: center;
      background: var(--soft);
      color: #29433e;
      display: inline-flex;
      font-size: 12px;
      font-weight: 700;
      height: 24px;
      justify-content: center;
      width: 24px;
    }

    .service-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 10px;
      margin: 6px 0 0 32px;
    }

    .service-images {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 9px;
    }

    .service-image {
      border: 1px solid var(--line);
      display: block;
      height: 90px;
      max-height: 300px;
      max-width: 300px;
      width: 120px;
    }

    .service-image img {
      background: #eef2f0;
      display: block;
      height: 88px;
      max-height: 300px;
      max-width: 300px;
      object-fit: contain;
      width: 118px;
    }

    .service-image.is-empty,
    .service-image.is-missing {
      align-items: center;
      background: #fafbf9;
      color: var(--muted);
      display: flex;
      flex-direction: column;
      font-size: 12px;
      justify-content: center;
      padding: 8px;
      text-align: center;
    }

    .service-image.is-missing {
      color: var(--warning);
    }

    .service-image small {
      display: block;
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    .empty-cell {
      background: #fafbf9;
      min-width: 360px;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-row">
      <h1>Tour Content Matrix</h1>
      ${headerActions}
    </div>
    <div class="meta">
      <span>${publishedTourCount} published tours</span>
      <span>${unpublishedTourCount} not published tours</span>
      <span>${maxDayNumber} day columns</span>
      <span>${serviceCount} services</span>
      <span>${imageCount} service pictures</span>
      <span>Source: ${escapeHtml(toursDir)}</span>
      <span>Output: ${escapeHtml(outputPath)}</span>
    </div>
  </header>
  <div class="matrix-wrap">
    <table>
      <thead>
        <tr>
          <th>Tour</th>
          ${dayHeaderCells}
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
  const tours = await readTours(options.toursDir);
  await copyServiceImagesForOutput({
    tours,
    outputPath: options.outputPath
  });
  const html = renderHtml({
    tours,
    toursDir: options.toursDir,
    outputPath: options.outputPath
  });

  await writeFile(options.outputPath, html);
  console.log(`Wrote ${options.outputPath}`);
  console.log(`Copied images to ${path.join(path.dirname(options.outputPath), "img", "content-matrix")}`);
  console.log(`Included ${tours.length} tours, ${tours.reduce((total, tour) => total + tour.days.length, 0)} days, and ${iterImages(tours).length} service pictures.`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
