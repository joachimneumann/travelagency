#!/usr/bin/env node
import { execFile as execFileCallback } from "node:child_process";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const defaultToursDir = path.join(repoRoot, "content", "tours");
const defaultOutputPath = "/tmp/tour-photo-matrix/index.html";
const imageExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);

function printUsage() {
  console.log(`Usage: scripts/content/create_tour_photo_matrix.mjs [options]

Creates a static HTML matrix of photos found below each content/tours/* subfolder.
Images are copied into an img/ folder next to the HTML file and referenced with relative paths.
Before creating the matrix, unused images in content/tours/*/travel-plan-services are deleted.

Options:
  --tours DIR                              Tours directory. Default: content/tours
  --output FILE                            HTML output path. Default: /tmp/tour-photo-matrix/index.html
  --zip FILE                               Zip output path. Default: /tmp/tour-photo-matrix.zip
  --no-zip                                 Do not create a zip archive
  --no-delete-unused-service-photos        Keep unused travel-plan service photos
  --dry-run-delete-unused-service-photos   Report unused travel-plan service photos without deleting them
  --help                                   Show this help.`);
}

function getDefaultZipPath(outputPath) {
  const outputDir = path.dirname(outputPath);
  return `${outputDir}.zip`;
}

function parseArgs(argv) {
  const options = {
    toursDir: defaultToursDir,
    outputPath: defaultOutputPath,
    zipPath: null,
    createZip: true,
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

    if (arg === "--zip") {
      const value = argv[++index];
      if (!value) throw new Error("--zip requires a file path.");
      options.zipPath = path.resolve(value);
      continue;
    }

    if (arg === "--no-zip") {
      options.createZip = false;
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

  if (options.createZip && !options.zipPath) {
    options.zipPath = getDefaultZipPath(options.outputPath);
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

async function readTour(tourDir, dirent) {
  const tourId = dirent.name;
  const tourJsonPath = path.join(tourDir, "tour.json");
  const images = await listImageFiles(tourDir, { includeImagesInCurrentDir: false });
  let title = tourId;

  if (await pathExists(tourJsonPath)) {
    const tourJson = await readJson(tourJsonPath);
    title = getEnglishTitle(tourJson, tourId);
  }

  return {
    id: tourId,
    title,
    images
  };
}

async function readTours(toursDir) {
  const tourDirs = await getTourDirents(toursDir);
  const tours = [];
  for (const dirent of tourDirs) {
    const tour = await readTour(path.join(toursDir, dirent.name), dirent);
    if (tour.images.length > 0) tours.push(tour);
  }

  return tours.sort((left, right) => naturalCompare(left.title, right.title));
}

function toRelativeUrl(filePath) {
  return filePath.split(path.sep).map(encodeURIComponent).join("/");
}

async function copyImagesForOutput({ tours, toursDir, outputPath }) {
  const outputDir = path.dirname(outputPath);
  const imageOutputDir = path.join(outputDir, "img");
  await mkdir(outputDir, { recursive: true });
  await rm(imageOutputDir, { recursive: true, force: true });

  for (const tour of tours) {
    const copiedImages = [];

    for (const imagePath of tour.images) {
      const sourceRelativePath = path.relative(toursDir, imagePath);
      const outputRelativePath = path.join("img", sourceRelativePath);
      const copiedImagePath = path.join(outputDir, outputRelativePath);

      await mkdir(path.dirname(copiedImagePath), { recursive: true });
      await copyFile(imagePath, copiedImagePath);
      copiedImages.push({
        fileName: path.basename(imagePath),
        sourceRelativePath,
        url: toRelativeUrl(outputRelativePath)
      });
    }

    tour.images = copiedImages;
  }
}

function isMissingExecutableError(error) {
  return error?.code === "ENOENT";
}

function quotePowerShellString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function createZipWithPowerShell({ outputPath, zipPath }) {
  const outputDir = path.dirname(outputPath);
  const outputFileName = path.basename(outputPath);
  const commands = process.platform === "win32"
    ? ["powershell.exe", "powershell", "pwsh"]
    : ["pwsh", "powershell"];
  const script = [
    "$ErrorActionPreference = 'Stop';",
    `Set-Location -LiteralPath ${quotePowerShellString(outputDir)};`,
    `Compress-Archive -LiteralPath @(${quotePowerShellString(outputFileName)}, ${quotePowerShellString("img")}) -DestinationPath ${quotePowerShellString(zipPath)} -Force;`
  ].join(" ");

  for (const command of commands) {
    try {
      await execFile(command, ["-NoProfile", "-Command", script]);
      return true;
    } catch (error) {
      if (isMissingExecutableError(error)) continue;
      throw error;
    }
  }

  return false;
}

async function createZipArchive({ outputPath, zipPath }) {
  const outputDir = path.dirname(outputPath);
  const outputFileName = path.basename(outputPath);
  await rm(zipPath, { force: true });

  try {
    await execFile("zip", ["-qr", zipPath, outputFileName, "img"], { cwd: outputDir });
    return;
  } catch (error) {
    if (!isMissingExecutableError(error)) throw error;
  }

  if (await createZipWithPowerShell({ outputPath, zipPath })) return;

  throw new Error("Could not create zip archive. Install zip or PowerShell.");
}

function renderImageCell(image) {
  return `<td class="photo-cell">
        <a href="${escapeHtml(image.url)}" target="_blank" rel="noopener">
          <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.sourceRelativePath)}" loading="lazy">
        </a>
        <div class="file-name" title="${escapeHtml(image.sourceRelativePath)}">${escapeHtml(image.fileName)}</div>
      </td>`;
}

function renderHtml({ tours, toursDir, outputPath }) {
  const maxImages = tours.reduce((max, tour) => Math.max(max, tour.images.length), 0);
  const imageCount = tours.reduce((total, tour) => total + tour.images.length, 0);
  const headerCells = Array.from({ length: maxImages }, (_, index) => `<th>Photo ${index + 1}</th>`).join("");
  const rows = tours
    .map((tour) => {
      const imageCells = tour.images.map((image) => renderImageCell(image)).join("");
      const emptyCells = Array.from({ length: maxImages - tour.images.length }, () => '<td class="empty-cell"></td>').join("");

      return `<tr>
      <th class="tour-cell" scope="row">
        <div class="tour-title">${escapeHtml(tour.title)}</div>
        <div class="tour-id">${escapeHtml(tour.id)}</div>
        <div class="photo-count">${tour.images.length} photos</div>
      </th>
      ${imageCells}${emptyCells}
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

    .meta {
      color: var(--muted);
      display: flex;
      flex-wrap: wrap;
      gap: 10px 18px;
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

    .tour-id,
    .photo-count,
    .file-name {
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
      object-fit: contain;
      width: 200px;
    }

    .file-name {
      margin-top: 6px;
      max-width: 200px;
    }

    .empty-cell {
      background: #fafbf9;
      min-width: 224px;
    }
  </style>
</head>
<body>
  <header>
    <h1>Tour Photo Matrix</h1>
    <div class="meta">
      <span>${tours.length} tours</span>
      <span>${imageCount} photos</span>
      <span>Source: ${escapeHtml(toursDir)}</span>
      <span>Output: ${escapeHtml(outputPath)}</span>
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
  await copyImagesForOutput({
    tours,
    toursDir: options.toursDir,
    outputPath: options.outputPath
  });
  const html = renderHtml({
    tours,
    toursDir: options.toursDir,
    outputPath: options.outputPath
  });

  await writeFile(options.outputPath, html);
  if (options.createZip) {
    await createZipArchive({
      outputPath: options.outputPath,
      zipPath: options.zipPath
    });
  }
  console.log(`Wrote ${options.outputPath}`);
  console.log(`Copied images to ${path.join(path.dirname(options.outputPath), "img")}`);
  if (options.createZip) console.log(`Wrote ${options.zipPath}`);
  if (cleanup) {
    const action = cleanup.dryRun ? "Would delete" : "Deleted";
    console.log(`${action} ${cleanup.unusedPhotos.length} unused travel-plan service photos.`);
  }
  console.log(`Included ${tours.length} tours and ${tours.reduce((total, tour) => total + tour.images.length, 0)} photos.`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
