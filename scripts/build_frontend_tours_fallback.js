#!/usr/bin/env node
/*
  Build static frontend tour fallback JSON from backend tour data.

  Default paths:
  - Input:  backend/app/data/tours/<tour_id>/tour.json
  - Output: data/tours_fallback_data.jspn
*/

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const toursRoot = path.join(rootDir, 'backend', 'app', 'data', 'tours');
const outPath = path.join(rootDir, 'data', 'tours_fallback_data.jspn');
const fallbackImagesDirRel = path.join('assets', 'img', 'tours_fallback_images');
const fallbackImagesDirAbs = path.join(rootDir, fallbackImagesDirRel);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function localAssetPathFromLegacyId(legacyId) {
  const value = String(legacyId || '').trim();
  if (!value.startsWith('trip-')) return '';

  const parts = value.slice(5).split('-');
  if (parts.length < 3) return '';

  const country = String(parts.shift() || '').toLowerCase();
  const style = String(parts.shift() || '').toLowerCase();
  const variantHyphen = parts.join('-').toLowerCase();
  const variantUnderscore = variantHyphen.replace(/-/g, '_');

  const candidates = [
    `assets/tours/${country}/${style}/${country}-${style}-${variantUnderscore}.webp`,
    `assets/tours/${country}/${style}/${country}-${style}-${variantHyphen}.webp`
  ];

  for (const relPath of candidates) {
    if (fs.existsSync(path.join(rootDir, relPath))) {
      return relPath;
    }
  }

  return '';
}

function findSourceImageAbsolutePath(rawTour, tourDirAbs) {
  const imageValue = String(rawTour.image || '').trim();
  const candidates = [];

  // Existing static image path in frontend repo.
  if (imageValue.startsWith('assets/')) {
    candidates.push(path.join(rootDir, imageValue));
  } else if (imageValue.startsWith('/assets/')) {
    candidates.push(path.join(rootDir, imageValue.slice(1)));
  }

  // Legacy mapped path.
  const legacyLocal = localAssetPathFromLegacyId(rawTour.legacy_id);
  if (legacyLocal) {
    candidates.push(path.join(rootDir, legacyLocal));
  }

  // Backend API-style path: /public/v1/tour-images/<tour_id>/<file.webp>
  if (imageValue.startsWith('/public/v1/tour-images/') || imageValue.startsWith('public/v1/tour-images/')) {
    const fileName = path.basename(imageValue);
    if (fileName) {
      candidates.push(path.join(tourDirAbs, fileName));
    }
  }

  // Conventional backend hero file names.
  if (rawTour.id) {
    candidates.push(path.join(tourDirAbs, `${rawTour.id}.webp`));
  }
  candidates.push(path.join(tourDirAbs, 'hero.webp'));

  // Any .webp in the backend tour folder as last resort.
  try {
    const webps = fs.readdirSync(tourDirAbs).filter((name) => name.toLowerCase().endsWith('.webp'));
    for (const file of webps) candidates.push(path.join(tourDirAbs, file));
  } catch {
    // ignore directory read issues
  }

  for (const absPath of candidates) {
    if (absPath && fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
      return absPath;
    }
  }
  return '';
}

function copyTourImageToFallback(rawTour, tourDirAbs) {
  const sourceAbsPath = findSourceImageAbsolutePath(rawTour, tourDirAbs);
  if (!sourceAbsPath || !rawTour.id) return '';

  fs.mkdirSync(fallbackImagesDirAbs, { recursive: true });
  const titleSlug = slugify(rawTour.title) || 'tour';
  const targetFileName = `${titleSlug}.webp`;
  const targetAbsPath = path.join(fallbackImagesDirAbs, targetFileName);
  fs.copyFileSync(sourceAbsPath, targetAbsPath);
  return path.join(fallbackImagesDirRel, targetFileName).replace(/\\/g, '/');
}

function normalizeTour(tour, fallbackImagePath) {
  return {
    id: String(tour.id || ''),
    title: String(tour.title || ''),
    shortDescription: String(tour.shortDescription || ''),
    destinationCountries: asArray(tour.destinationCountries).map((v) => String(v || '').trim()).filter(Boolean),
    styles: asArray(tour.styles).map((v) => String(v || '').trim()).filter(Boolean),
    priority: asNumber(tour.priority, 50),
    durationDays: asNumber(tour.durationDays, 0),
    priceFrom: asNumber(tour.priceFrom, 0),
    image: String(fallbackImagePath || ''),
    highlights: asArray(tour.highlights).map((v) => String(v || '').trim()).filter(Boolean),
    seasonality: String(tour.seasonality || ''),
    rating: Number.isFinite(tour.rating) ? tour.rating : null,
    legacy_id: tour.legacy_id ? String(tour.legacy_id) : null,
    updated_at: tour.updated_at ? String(tour.updated_at) : null
  };
}

function validateTourForFallback(tour) {
  const reasons = [];

  if (!tour.id) reasons.push("missing id");
  if (!tour.title) reasons.push("missing title");
  if (!tour.shortDescription) reasons.push("missing shortDescription");
  if (!Array.isArray(tour.destinationCountries) || tour.destinationCountries.length === 0) {
    reasons.push("missing destinationCountries");
  }
  if (!Array.isArray(tour.styles) || tour.styles.length === 0) {
    reasons.push("missing styles");
  }
  if (!Number.isFinite(tour.durationDays) || tour.durationDays <= 0) {
    reasons.push("invalid durationDays");
  }
  if (!Number.isFinite(tour.priceFrom) || tour.priceFrom <= 0) {
    reasons.push("invalid priceFrom");
  }
  if (!tour.image) {
    reasons.push("missing image");
  } else if (!tour.image.startsWith("assets/img/tours_fallback_images/")) {
    reasons.push(`image is outside assets/img/tours_fallback_images: ${tour.image}`);
  } else if (tour.image.startsWith("assets/")) {
    const imageOnDisk = path.join(rootDir, tour.image);
    if (!fs.existsSync(imageOnDisk)) {
      reasons.push(`image file not found: ${tour.image}`);
    }
  }

  return reasons;
}

function main() {
  if (!fs.existsSync(toursRoot)) {
    console.error(`Error: tours folder not found: ${toursRoot}`);
    process.exit(1);
  }

  fs.mkdirSync(fallbackImagesDirAbs, { recursive: true });
  for (const name of fs.readdirSync(fallbackImagesDirAbs)) {
    if (!name.toLowerCase().endsWith('.webp')) continue;
    fs.rmSync(path.join(fallbackImagesDirAbs, name), { force: true });
  }

  const dirs = fs
    .readdirSync(toursRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const items = [];
  const warnings = [];
  const usedFallbackImageNames = new Map();

  for (const dirName of dirs) {
    const tourDirAbs = path.join(toursRoot, dirName);
    const tourFile = path.join(toursRoot, dirName, 'tour.json');
    if (!fs.existsSync(tourFile)) continue;

    let tour;
    try {
      tour = readJson(tourFile);
    } catch (error) {
      warnings.push(`Invalid JSON skipped: ${tourFile} (${error.message})`);
      continue;
    }

    const titleSlug = slugify(tour.title) || "tour";
    const fallbackImageName = `${titleSlug}.webp`;
    if (usedFallbackImageNames.has(fallbackImageName)) {
      const priorTourId = usedFallbackImageNames.get(fallbackImageName);
      warnings.push(
        `Excluded ${tour.id || dirName}: duplicate fallback image name '${fallbackImageName}' also used by ${priorTourId}`
      );
      continue;
    }

    const fallbackImagePath = copyTourImageToFallback(tour, tourDirAbs);
    const normalized = normalizeTour(tour, fallbackImagePath);
    const reasons = validateTourForFallback(normalized);
    if (reasons.length) {
      warnings.push(`Excluded ${normalized.id || dirName}: ${reasons.join(", ")}`);
      continue;
    }

    usedFallbackImageNames.set(fallbackImageName, normalized.id || dirName);
    items.push(normalized);
  }

  items.sort((a, b) => {
    const dateA = String(a.updated_at || '');
    const dateB = String(b.updated_at || '');
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return a.id.localeCompare(b.id);
  });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(items, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${items.length} tours to ${outPath}`);
  if (warnings.length) {
    console.log(`Warnings (${warnings.length}):`);
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }
}

main();
