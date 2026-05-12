#!/usr/bin/env node
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const defaultToursDir = path.join(repoRoot, "content", "tours");
const defaultCatalogPath = path.join(defaultToursDir, "destinations.json");
const defaultHighlightManifestPath = path.join(repoRoot, "assets", "img", "experience-highlights", "manifest.json");
const defaultOutputPath = "/tmp/tour-meta/index.html";

function printUsage() {
  console.log(`Usage: scripts/content/create_tour_meta.mjs [options]

Creates a static HTML matrix of tour metadata.
Rows are tours. Columns are tour name and one column per itinerary day with title, location, and highlight.
Experience highlight images are copied into an img/ folder next to the HTML file.

Options:
  --tours DIR                  Tours directory. Default: content/tours
  --catalog FILE               Destination catalog. Default: content/tours/destinations.json
  --highlight-manifest FILE    Experience highlight manifest. Default: assets/img/experience-highlights/manifest.json
  --output FILE                HTML output path. Default: /tmp/tour-meta/index.html
  --help                       Show this help.`);
}

function parseArgs(argv) {
  const options = {
    toursDir: defaultToursDir,
    catalogPath: defaultCatalogPath,
    highlightManifestPath: defaultHighlightManifestPath,
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

    if (arg === "--catalog") {
      const value = argv[++index];
      if (!value) throw new Error("--catalog requires a file path.");
      options.catalogPath = path.resolve(value);
      continue;
    }

    if (arg === "--highlight-manifest") {
      const value = argv[++index];
      if (!value) throw new Error("--highlight-manifest requires a file path.");
      options.highlightManifestPath = path.resolve(value);
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

function normalizeId(value) {
  return normalizeText(value);
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

function localizedTitle(item) {
  return normalizeText(item?.title_i18n?.en) || normalizeText(item?.title) || normalizeText(item?.id);
}

function buildHighlightCatalog(manifest) {
  const catalog = new Map();
  for (const item of Array.isArray(manifest) ? manifest : []) {
    const id = normalizeId(item?.id);
    const image = normalizeText(item?.image);
    if (!id) continue;
    catalog.set(id, {
      id,
      title: localizedTitle(item) || id,
      image
    });
  }
  return catalog;
}

function buildPlaceCatalog(catalog) {
  const places = new Map();
  for (const place of Array.isArray(catalog?.destination_places) ? catalog.destination_places : []) {
    const id = normalizeId(place?.id);
    if (!id) continue;
    places.set(id, {
      id,
      code: normalizeText(place?.code),
      name: normalizeText(place?.name || place?.label || place?.code || id),
      latitude: place?.latitude,
      longitude: place?.longitude
    });
  }
  return places;
}

function addUnique(output, seen, value) {
  const normalized = normalizeId(value);
  if (!normalized || seen.has(normalized)) return;
  seen.add(normalized);
  output.push(normalized);
}

function collectDayLocations(day, placeCatalog) {
  const ids = [];
  const seen = new Set();
  addUnique(ids, seen, day?.primary_location_id);
  addUnique(ids, seen, day?.secondary_location_id);

  return ids.map((id) => ({
    id,
    place: placeCatalog.get(id) || null
  }));
}

function normalizeDayNumber(day, index) {
  const parsed = Number(day?.day_number);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return index + 1;
}

function getDayTitle(day, dayNumber) {
  return normalizeText(day?.title_i18n?.en) || normalizeText(day?.title) || `Day ${dayNumber}`;
}

function getSelectedDayHighlight(day, highlightCatalog) {
  const id = (Array.isArray(day?.experience_highlight_ids) ? day.experience_highlight_ids : [])
    .map((value) => normalizeId(value))
    .find(Boolean);
  if (!id) return null;

  const catalogItem = highlightCatalog.get(id);
  return {
    id,
    title: catalogItem?.title || id,
    image: catalogItem?.image || "",
    known: highlightCatalog.has(id),
    url: ""
  };
}

function collectDays(tourJson, highlightCatalog, placeCatalog) {
  return (Array.isArray(tourJson?.travel_plan?.days) ? tourJson.travel_plan.days : [])
    .map((day, index) => {
      const dayNumber = normalizeDayNumber(day, index);
      return {
        dayNumber,
        title: getDayTitle(day, dayNumber),
        highlight: getSelectedDayHighlight(day, highlightCatalog),
        locations: collectDayLocations(day, placeCatalog)
      };
    })
    .sort((left, right) => left.dayNumber - right.dayNumber);
}

async function readTour(tourDir, dirent, highlightCatalog, placeCatalog) {
  const tourId = dirent.name;
  const tourJsonPath = path.join(tourDir, "tour.json");
  if (!(await pathExists(tourJsonPath))) return null;

  const tourJson = await readJson(tourJsonPath);

  return {
    id: tourId,
    title: getEnglishTitle(tourJson, tourId),
    published: isPublishedOnWebpage(tourJson),
    days: collectDays(tourJson, highlightCatalog, placeCatalog)
  };
}

function compareTours(left, right) {
  if (left.published !== right.published) return left.published ? -1 : 1;
  return naturalCompare(left.title, right.title);
}

async function readTours(toursDir, highlightCatalog, placeCatalog) {
  const entries = await readdir(toursDir, { withFileTypes: true });
  const tourDirs = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .sort((left, right) => naturalCompare(left.name, right.name));

  const tours = [];
  for (const dirent of tourDirs) {
    const tour = await readTour(path.join(toursDir, dirent.name), dirent, highlightCatalog, placeCatalog);
    if (tour) tours.push(tour);
  }

  return tours.sort(compareTours);
}

function toRelativeUrl(filePath) {
  return filePath.split(path.sep).map(encodeURIComponent).join("/");
}

async function copyHighlightImagesForOutput({ tours, highlightManifestPath, outputPath }) {
  const outputDir = path.dirname(outputPath);
  const imageOutputDir = path.join(outputDir, "img", "experience-highlights");
  const highlightSourceDir = path.dirname(highlightManifestPath);
  const usedImages = new Set();
  const copiedImages = new Set();

  await mkdir(outputDir, { recursive: true });
  await rm(imageOutputDir, { recursive: true, force: true });
  await mkdir(imageOutputDir, { recursive: true });

  for (const tour of tours) {
    for (const highlight of tour.days.map((day) => day.highlight).filter(Boolean)) {
      if (!highlight.image) continue;
      usedImages.add(highlight.image);
    }
  }

  for (const image of usedImages) {
    const sourcePath = path.join(highlightSourceDir, image);
    const outputRelativePath = path.join("img", "experience-highlights", image);
    const outputImagePath = path.join(outputDir, outputRelativePath);
    if (!(await pathExists(sourcePath))) continue;
    await mkdir(path.dirname(outputImagePath), { recursive: true });
    await copyFile(sourcePath, outputImagePath);
    copiedImages.add(image);
  }

  for (const tour of tours) {
    for (const highlight of tour.days.map((day) => day.highlight).filter(Boolean)) {
      highlight.url = highlight.image && copiedImages.has(highlight.image)
        ? toRelativeUrl(path.join("img", "experience-highlights", highlight.image))
        : "";
    }
  }
}

function hasLatLong(place) {
  return Number.isFinite(Number(place?.latitude)) && Number.isFinite(Number(place?.longitude));
}

function googleMapsUrl(place) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${place.latitude},${place.longitude}`)}`;
}

function renderDayLocations(locations) {
  if (!locations.length) return '<div class="day-locations-slot"></div>';

  return `<div class="day-locations-slot">
          <div class="day-location-list">
          ${locations.map(({ id, place }) => {
            if (!place) {
              return `<div class="day-location is-missing">
                <div class="location-title">${escapeHtml(id)}</div>
                <div class="item-id">Not found in destination catalog</div>
              </div>`;
            }

            const name = escapeHtml(place.name);
            const coordinates = hasLatLong(place) ? `${place.latitude}, ${place.longitude}` : "No latitude/longitude";
            const title = hasLatLong(place)
              ? `<a href="${escapeAttr(googleMapsUrl(place))}" target="_blank" rel="noopener">${name}</a>`
              : name;

            return `<div class="day-location">
              <div class="location-title">${title}</div>
              <div class="item-id">${escapeHtml(coordinates)}</div>
            </div>`;
          }).join("")}
          </div>
        </div>`;
}

function renderDayHighlight(highlight) {
  if (!highlight) return '<div class="day-highlight-slot"></div>';

  const title = escapeHtml(highlight.title);
  const image = highlight.url
    ? `<img src="${escapeAttr(highlight.url)}" alt="${title}" loading="lazy">`
    : '<div class="missing-image">No image</div>';

  return `<div class="day-highlight-slot">
          <div class="day-highlight${highlight.known ? "" : " is-missing"}">
          ${image}
          <div>
            <div class="highlight-title">${title}</div>
            <div class="item-id">${escapeHtml(highlight.id)}</div>
          </div>
          </div>
        </div>`;
}

function renderDayCell(day) {
  if (!day) return '<td class="empty-cell"></td>';

  return `<td class="day-cell">
        <div class="day-cell-inner">
          <div class="day-title-slot">
            <div class="day-title">${escapeHtml(day.title)}</div>
          </div>
          ${renderDayLocations(day.locations)}
          ${renderDayHighlight(day.highlight)}
        </div>
      </td>`;
}

function renderHtml({ tours, toursDir, catalogPath, highlightManifestPath, outputPath }) {
  const maxDayNumber = tours.reduce((max, tour) => Math.max(max, ...tour.days.map((day) => day.dayNumber), 0), 0);
  const dayHeaderCells = Array.from({ length: maxDayNumber }, (_, index) => `<th>Day ${index + 1}</th>`).join("");
  const selectedHighlightCount = tours.reduce((total, tour) => total + tour.days.filter((day) => day.highlight).length, 0);
  const dayLocationCount = tours.reduce((total, tour) => total + tour.days.reduce((dayTotal, day) => dayTotal + day.locations.length, 0), 0);
  const publishedTourCount = tours.filter((tour) => tour.published).length;
  const unpublishedTourCount = tours.length - publishedTourCount;
  const visibilityControl = unpublishedTourCount
    ? `<button class="publication-toggle" type="button" data-toggle-unpublished data-show-label="Not published tours (${unpublishedTourCount})" data-hide-label="Hide not published tours" aria-pressed="false">Not published tours (${unpublishedTourCount})</button>`
    : "";
  const rows = tours
    .map((tour) => {
      const daysByNumber = new Map(tour.days.map((day) => [day.dayNumber, day]));
      const dayCells = Array.from({ length: maxDayNumber }, (_, index) => renderDayCell(daysByNumber.get(index + 1))).join("");
      return `<tr data-published="${tour.published ? "true" : "false"}">
      <th class="tour-cell" scope="row">
        <div class="tour-title">${escapeHtml(tour.title)}</div>
        <div class="publication-badge ${tour.published ? "is-published" : "is-unpublished"}">${tour.published ? "Show on web page" : "Not published"}</div>
        <div class="tour-id">${escapeHtml(tour.id)}</div>
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
  <title>Tour Meta Matrix</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f4;
      --surface: #ffffff;
      --text: #182321;
      --muted: #60716d;
      --line: #dbe3df;
      --accent: #0f766e;
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

    a {
      color: var(--accent);
      font-weight: 700;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
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
      width: 100%;
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
      min-width: 260px;
      max-width: 260px;
      padding: 12px;
      position: sticky;
      text-align: left;
      z-index: 2;
    }

    .tour-title,
    .highlight-title,
    .location-title {
      font-weight: 700;
    }

    .tour-title {
      margin-bottom: 4px;
    }

    .publication-badge {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .publication-badge.is-unpublished {
      color: var(--warning);
    }

    .day-title {
      font-weight: 700;
      max-width: 220px;
      overflow-wrap: anywhere;
    }

    .tour-id,
    .item-id {
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .day-cell {
      background: #ffffff;
      min-width: 240px;
      padding: 10px 12px;
    }

    .day-cell-inner {
      display: grid;
      gap: 8px;
    }

    .day-title-slot,
    .day-locations-slot {
      min-height: 0;
    }

    .day-location-list {
      display: grid;
      gap: 8px;
    }

    .day-highlight {
      align-items: center;
      border: 1px solid var(--line);
      display: grid;
      gap: 10px;
      grid-template-columns: 48px minmax(0, 1fr);
      min-height: 64px;
      padding: 7px;
    }

    .day-highlight img,
    .missing-image {
      background: #eef2f0;
      border: 1px solid var(--line);
      display: block;
      height: 48px;
      object-fit: contain;
      width: 48px;
    }

    .missing-image {
      color: var(--muted);
      display: grid;
      font-size: 10px;
      line-height: 1.1;
      place-items: center;
      text-align: center;
    }

    .day-location {
      border: 1px solid var(--line);
      min-height: 52px;
      padding: 8px 10px;
    }

    .is-missing {
      border-color: #f1d18a;
      color: var(--warning);
    }

    .empty-cell {
      background: #fafbf9;
      color: var(--muted);
      padding: 12px;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-row">
      <h1>Tour Meta Matrix</h1>
      ${visibilityControl}
    </div>
    <div class="meta">
      <span>${publishedTourCount} published tours</span>
      <span>${unpublishedTourCount} not published tours</span>
      <span>${maxDayNumber} day columns</span>
      <span>${selectedHighlightCount} selected day highlights</span>
      <span>${dayLocationCount} day locations</span>
      <span>Source: ${escapeHtml(toursDir)}</span>
      <span>Catalog: ${escapeHtml(catalogPath)}</span>
      <span>Highlights: ${escapeHtml(highlightManifestPath)}</span>
      <span>Output: ${escapeHtml(outputPath)}</span>
    </div>
  </header>
  <div class="matrix-wrap">
    <table>
      <thead>
        <tr>
          <th>Tour name</th>
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
      let alignmentFrame = 0;

      const alignRowSections = () => {
        document.querySelectorAll(".day-title-slot, .day-locations-slot").forEach((section) => {
          section.style.minHeight = "";
        });

        document.querySelectorAll("tbody tr").forEach((row) => {
          if (row.offsetParent === null) return;

          for (const selector of [".day-title-slot", ".day-locations-slot"]) {
            const sections = Array.from(row.querySelectorAll(selector));
            if (!sections.length) continue;

            const maxHeight = sections.reduce((max, section) => {
              return Math.max(max, Math.ceil(section.getBoundingClientRect().height));
            }, 0);

            sections.forEach((section) => {
              section.style.minHeight = maxHeight + "px";
            });
          }
        });
      };

      const scheduleAlignment = () => {
        window.cancelAnimationFrame(alignmentFrame);
        alignmentFrame = window.requestAnimationFrame(alignRowSections);
      };

      const button = document.querySelector("[data-toggle-unpublished]");
      if (button) {
        button.addEventListener("click", () => {
          const showing = document.body.classList.toggle("show-unpublished");
          button.setAttribute("aria-pressed", showing ? "true" : "false");
          button.textContent = showing ? button.dataset.hideLabel : button.dataset.showLabel;
          scheduleAlignment();
        });
      }

      window.addEventListener("load", scheduleAlignment);
      window.addEventListener("resize", scheduleAlignment);
      if (document.fonts) document.fonts.ready.then(scheduleAlignment);
      scheduleAlignment();
    })();
  </script>
</body>
</html>
`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [destinationCatalog, highlightManifest] = await Promise.all([
    readJson(options.catalogPath),
    readJson(options.highlightManifestPath)
  ]);
  const highlightCatalog = buildHighlightCatalog(highlightManifest);
  const placeCatalog = buildPlaceCatalog(destinationCatalog);
  const tours = await readTours(options.toursDir, highlightCatalog, placeCatalog);

  await copyHighlightImagesForOutput({
    tours,
    highlightManifestPath: options.highlightManifestPath,
    outputPath: options.outputPath
  });

  const html = renderHtml({
    tours,
    toursDir: options.toursDir,
    catalogPath: options.catalogPath,
    highlightManifestPath: options.highlightManifestPath,
    outputPath: options.outputPath
  });

  await writeFile(options.outputPath, html);
  console.log(`Wrote ${options.outputPath}`);
  console.log(`Copied highlight images to ${path.join(path.dirname(options.outputPath), "img", "experience-highlights")}`);
  console.log(`Included ${tours.length} tours, ${tours.reduce((total, tour) => total + tour.days.length, 0)} days, ${tours.reduce((total, tour) => total + tour.days.filter((day) => day.highlight).length, 0)} selected day highlights, and ${tours.reduce((total, tour) => total + tour.days.reduce((dayTotal, day) => dayTotal + day.locations.length, 0), 0)} day locations.`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
