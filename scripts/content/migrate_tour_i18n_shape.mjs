#!/usr/bin/env node
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const defaultToursDir = path.join(repoRoot, "content", "tours");

function usage() {
  console.log(`Usage: node scripts/content/migrate_tour_i18n_shape.mjs [--dry-run] [TOURS_DIR]

Migrates tour JSON files to the strict source-plus-translation shape:
  field: English source string
  field_i18n: non-English translations only

Default TOURS_DIR: content/tours`);
}

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeLang(value) {
  return normalizeText(value).toLowerCase().replace(/_/g, "-");
}

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function localizedMap(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([lang, text]) => [normalizeLang(lang), normalizeText(text)])
      .filter(([lang, text]) => Boolean(lang && text))
  );
}

function mergeTranslationMaps(base, overlay, conflicts, pathLabel) {
  const next = { ...localizedMap(base) };
  for (const [lang, text] of Object.entries(localizedMap(overlay))) {
    if (lang === "en") continue;
    if (next[lang] && next[lang] !== text) {
      conflicts.push(`${pathLabel}.${lang}: conflicting translation values`);
      continue;
    }
    next[lang] = text;
  }
  return next;
}

function assignOptionalPlain(holder, field, value, previousValue) {
  const normalized = normalizeText(value);
  if (normalized) {
    holder[field] = normalized;
    return;
  }
  if (Object.prototype.hasOwnProperty.call(holder, field) && previousValue === null) {
    holder[field] = null;
    return;
  }
  if (Object.prototype.hasOwnProperty.call(holder, field) && previousValue === undefined) {
    delete holder[field];
  }
}

function migrateLocalizedPair(holder, plainField, i18nField, pathLabel, conflicts) {
  if (!isRecord(holder)) return false;
  const previousPlain = holder[plainField];
  const previousI18n = holder[i18nField];
  const hadPlain = Object.prototype.hasOwnProperty.call(holder, plainField);
  const hadI18n = Object.prototype.hasOwnProperty.call(holder, i18nField);
  let changed = false;
  let plainText = normalizeText(previousPlain);
  let translations = localizedMap(previousI18n);

  if (isRecord(previousPlain)) {
    const oldMap = localizedMap(previousPlain);
    const oldEnglish = normalizeText(oldMap.en);
    if (oldEnglish && plainText && oldEnglish !== plainText) {
      conflicts.push(`${pathLabel}: conflicting English source values`);
    }
    plainText = oldEnglish || plainText;
    translations = mergeTranslationMaps(translations, oldMap, conflicts, `${pathLabel}.${i18nField}`);
    changed = true;
  }

  const i18nEnglish = normalizeText(translations.en);
  if (i18nEnglish) {
    if (!plainText) {
      plainText = i18nEnglish;
    } else if (plainText !== i18nEnglish) {
      conflicts.push(`${pathLabel}: ${plainField} conflicts with ${i18nField}.en`);
    }
    delete translations.en;
    changed = true;
  }

  translations = Object.fromEntries(Object.entries(translations).filter(([lang]) => lang !== "en"));

  if (changed || hadPlain) {
    assignOptionalPlain(holder, plainField, plainText, previousPlain);
  }
  if (Object.keys(translations).length) {
    holder[i18nField] = translations;
  } else if (hadI18n) {
    holder[i18nField] = {};
  }
  return changed;
}

function migrateTravelPlan(travelPlan, conflicts) {
  if (!isRecord(travelPlan)) return;
  const days = Array.isArray(travelPlan.days) ? travelPlan.days : [];
  days.forEach((day, dayIndex) => {
    if (!isRecord(day)) return;
    const dayPath = `travel_plan.days[${dayIndex}]`;
    migrateLocalizedPair(day, "title", "title_i18n", `${dayPath}.title`, conflicts);
    migrateLocalizedPair(day, "overnight_location", "overnight_location_i18n", `${dayPath}.overnight_location`, conflicts);
    migrateLocalizedPair(day, "notes", "notes_i18n", `${dayPath}.notes`, conflicts);
    const services = Array.isArray(day.services) ? day.services : [];
    services.forEach((service, serviceIndex) => {
      if (!isRecord(service)) return;
      const servicePath = `${dayPath}.services[${serviceIndex}]`;
      migrateLocalizedPair(service, "time_label", "time_label_i18n", `${servicePath}.time_label`, conflicts);
      migrateLocalizedPair(service, "title", "title_i18n", `${servicePath}.title`, conflicts);
      migrateLocalizedPair(service, "details", "details_i18n", `${servicePath}.details`, conflicts);
      migrateLocalizedPair(service, "image_subtitle", "image_subtitle_i18n", `${servicePath}.image_subtitle`, conflicts);
      migrateLocalizedPair(service, "location", "location_i18n", `${servicePath}.location`, conflicts);
      if (isRecord(service.image)) {
        migrateLocalizedPair(service.image, "caption", "caption_i18n", `${servicePath}.image.caption`, conflicts);
        migrateLocalizedPair(service.image, "alt_text", "alt_text_i18n", `${servicePath}.image.alt_text`, conflicts);
      }
      if (Array.isArray(service.images)) {
        service.images.forEach((image, imageIndex) => {
          if (!isRecord(image)) return;
          migrateLocalizedPair(image, "caption", "caption_i18n", `${servicePath}.images[${imageIndex}].caption`, conflicts);
          migrateLocalizedPair(image, "alt_text", "alt_text_i18n", `${servicePath}.images[${imageIndex}].alt_text`, conflicts);
        });
      }
    });
  });
}

function migrateTour(tour, filePath) {
  const next = cloneJson(tour);
  const conflicts = [];
  migrateLocalizedPair(next, "title", "title_i18n", `${filePath}.title`, conflicts);
  migrateLocalizedPair(next, "short_description", "short_description_i18n", `${filePath}.short_description`, conflicts);
  migrateTravelPlan(next.travel_plan, conflicts);
  return {
    tour: next,
    conflicts,
    changed: JSON.stringify(next) !== JSON.stringify(tour)
  };
}

async function tourJsonPaths(toursDir) {
  const entries = await readdir(toursDir, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const tourPath = path.join(toursDir, entry.name, "tour.json");
    paths.push(tourPath);
  }
  return paths.sort();
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }
  const dryRun = args.includes("--dry-run");
  const positional = args.filter((arg) => arg !== "--dry-run");
  const toursDir = path.resolve(positional[0] || defaultToursDir);
  const files = await tourJsonPaths(toursDir);
  const results = [];

  for (const filePath of files) {
    const tour = JSON.parse(await readFile(filePath, "utf8"));
    results.push({ filePath, ...migrateTour(tour, path.relative(repoRoot, filePath)) });
  }

  const conflicts = results.flatMap((result) => result.conflicts.map((conflict) => `${result.filePath}: ${conflict}`));
  if (conflicts.length) {
    console.error(`Found ${conflicts.length} migration conflict(s). No files were written.`);
    conflicts.forEach((conflict) => console.error(`- ${conflict}`));
    process.exitCode = 1;
    return;
  }

  const changed = results.filter((result) => result.changed);
  if (!dryRun) {
    for (const result of changed) {
      await writeFile(result.filePath, `${JSON.stringify(result.tour, null, 2)}\n`);
    }
  }

  console.log(`${dryRun ? "Would migrate" : "Migrated"} ${changed.length} of ${files.length} tour file(s).`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
