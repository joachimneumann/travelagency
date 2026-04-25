#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function normalizeText(value) {
  return String(value ?? "").trim();
}

function stripVersionSuffix(value) {
  const normalized = normalizeText(value);
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return normalized.replace(/[?#].*$/, "");
}

function normalizeTourPicture(value, tourId) {
  const normalized = stripVersionSuffix(value);
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;

  const publicPrefix = "/public/v1/tour-images/";
  const relativePath = normalized.startsWith(publicPrefix)
    ? normalized.slice(publicPrefix.length).replace(/^\/+/, "")
    : normalized.replace(/^\/+/, "");
  if (!relativePath) return "";

  const normalizedTourId = normalizeText(tourId);
  const scopedRelativePath = normalizedTourId && !relativePath.includes("/")
    ? `${normalizedTourId}/${relativePath}`
    : relativePath;
  return `${publicPrefix}${scopedRelativePath}`;
}

async function migrateTourJson(filePath) {
  const source = await readFile(filePath, "utf8");
  const tour = JSON.parse(source);
  const tourId = normalizeText(tour.id) || path.basename(path.dirname(filePath));
  const rawPictures = [
    tour.image,
    ...(Array.isArray(tour.pictures) ? tour.pictures : [])
  ];
  const pictures = Array.from(
    new Set(rawPictures.map((value) => normalizeTourPicture(value, tourId)).filter(Boolean))
  );

  const hadImage = Object.prototype.hasOwnProperty.call(tour, "image");
  const previousPictures = Array.isArray(tour.pictures)
    ? tour.pictures.map((value) => normalizeTourPicture(value, tourId)).filter(Boolean)
    : [];
  tour.pictures = pictures;
  delete tour.image;

  const changed = hadImage
    || JSON.stringify(previousPictures) !== JSON.stringify(pictures);
  if (changed) {
    await writeFile(filePath, `${JSON.stringify(tour, null, 2)}\n`, "utf8");
  }
  return {
    changed,
    hadImage,
    pictureCount: pictures.length
  };
}

async function main() {
  const toursRoot = path.resolve(process.argv[2] || "content/tours");
  const entries = await readdir(toursRoot, { withFileTypes: true });
  let changedCount = 0;
  let legacyImageCount = 0;
  let tourCount = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const tourJsonPath = path.join(toursRoot, entry.name, "tour.json");
    let result;
    try {
      result = await migrateTourJson(tourJsonPath);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    tourCount += 1;
    if (result.changed) changedCount += 1;
    if (result.hadImage) legacyImageCount += 1;
  }

  console.log(JSON.stringify({
    toursRoot,
    tourCount,
    changedCount,
    legacyImageCount
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
