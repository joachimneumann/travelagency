#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeStoredBookingRecord } from "../src/lib/booking_persons.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const DEFAULT_STORE_PATH = path.join(APP_ROOT, "data", "store.json");
const STORE_PATH = process.env.STORE_PATH || DEFAULT_STORE_PATH;

function nowStamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate())
  ].join("") + "_" + [pad(date.getUTCHours()), pad(date.getUTCMinutes()), pad(date.getUTCSeconds())].join("");
}

async function main() {
  const raw = await fs.readFile(STORE_PATH, "utf8");
  const store = JSON.parse(raw);
  const bookings = Array.isArray(store.bookings) ? store.bookings : [];

  const normalizedStore = {
    ...store,
    bookings: bookings.map((booking) => normalizeStoredBookingRecord(booking, store))
  };

  const backupPath = `${STORE_PATH}.bak_${nowStamp()}`;
  await fs.copyFile(STORE_PATH, backupPath);
  await fs.writeFile(STORE_PATH, `${JSON.stringify(normalizedStore, null, 2)}\n`, "utf8");

  const migratedCount = normalizedStore.bookings.filter((booking) => Array.isArray(booking.persons) && booking.persons.length > 0).length;
  console.log(`Migrated ${migratedCount}/${normalizedStore.bookings.length} bookings to include booking persons. Backup: ${path.basename(backupPath)}`);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
