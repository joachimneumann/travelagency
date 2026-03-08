import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(APP_ROOT, "data", "store.json");
const ATP_STAFF_PATH = path.join(APP_ROOT, "config", "atp_staff.json");

const STAGES = ["NEW", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST", "POST_TRIP"];

const DESTINATIONS = ["Vietnam", "Thailand", "Cambodia", "Laos"];
const STYLES = ["Adventure", "Culture", "Family", "Food", "Luxury", "Beach", "Budget"];
const LANGUAGES = ["English", "Vietnamese", "French", "German", "Spanish"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
const DURATIONS = ["5-7 days", "7-10 days", "10-14 days", "14-18 days"];
const BUDGETS = ["$1500-$2500", "$2500-$3500", "$3500-$5000", "$5000+"];

const FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Sam", "Chris", "Riley", "Jamie", "Morgan", "Casey", "Robin"];
const LAST_NAMES = ["Nguyen", "Tran", "Smith", "Garcia", "Lee", "Brown", "Martin", "Wilson", "Khan", "Patel"];

function parseCountArg(argv) {
  const idx = argv.indexOf("--count");
  if (idx === -1) return 30;
  const raw = Number(argv[idx + 1]);
  if (!Number.isFinite(raw)) return 30;
  return Math.max(1, Math.min(500, Math.floor(raw)));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function nowMinusHours(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function buildEmail(name, i) {
  const base = name.toLowerCase().replace(/\s+/g, ".");
  return `${base}.${i}@example.com`;
}

function stageServiceLevelAgreement(stage, fromIso) {
  const map = {
    NEW: 2,
    QUALIFIED: 8,
    PROPOSAL_SENT: 24,
    NEGOTIATION: 48,
    WON: 24,
    LOST: 0,
    POST_TRIP: 0
  };
  const hours = map[stage] || 0;
  if (!hours) return null;
  return new Date(new Date(fromIso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

async function readJson(p) {
  const raw = await readFile(p, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const count = parseCountArg(process.argv);
  const store = await readJson(DATA_PATH);
  const atp_staff = await readJson(ATP_STAFF_PATH);
  const activeAtpStaff = atp_staff.filter((s) => s.active);

  store.clients ||= [];
  store.customers ||= [];
  store.bookings ||= [];
  store.activities ||= [];

  for (let i = 0; i < count; i += 1) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const name = `${firstName} ${lastName}`;
    const email = buildEmail(name, i + 1);
    const phoneNumber = `+1${randomInt(2000000000, 9999999999)}`;
    const preferredLanguage = pick(LANGUAGES);
    const destination = [pick(DESTINATIONS)];
    const style = [pick(STYLES)];
    const stage = pick(STAGES);
    const createdAt = nowMinusHours(randomInt(2, 24 * 40));
    const updatedAt = new Date(new Date(createdAt).getTime() + randomInt(1, 120) * 60 * 1000).toISOString();
    const owner = activeAtpStaff.length ? activeAtpStaff[i % activeAtpStaff.length] : null;

    const client = {
      id: `client_${randomUUID()}`,
      client_type: "customer"
    };
    const customer = {
      client_id: client.id,
      name,
      email,
      phone_number: phoneNumber,
      preferred_language: preferredLanguage,
      created_at: createdAt,
      updated_at: updatedAt
    };
    store.clients.push(client);
    store.customers.push(customer);

    const booking = {
      id: `booking_${randomUUID()}`,
      client_id: client.id,
      client_type: "customer",
      client_display_name: customer.name,
      client_primary_phone_number: customer.phone_number,
      client_primary_email: customer.email,
      stage,
      atp_staff: owner?.id || null,
      atp_staff_name: owner?.name || null,
      service_level_agreement_due_at: stageServiceLevelAgreement(stage, updatedAt),
      destination,
      style,
      travel_month: pick(MONTHS),
      number_of_travelers: randomInt(1, 6),
      duration: pick(DURATIONS),
      budget: pick(BUDGETS),
      notes: "Seeded test booking",
      source: {
        page_url: "https://asiatravelplan.com/",
        utm_source: "seed",
        utm_medium: "script",
        utm_campaign: "milestone_1",
        referrer: "https://example.com"
      },
      idempotency_key: null,
      created_at: createdAt,
      updated_at: updatedAt
    };
    store.bookings.push(booking);

    store.activities.push(
      {
        id: `act_${randomUUID()}`,
        booking_id: booking.id,
        type: "BOOKING_CREATED",
        actor: "seed_script",
        detail: "Seeded booking created",
        created_at: createdAt
      },
      {
        id: `act_${randomUUID()}`,
        booking_id: booking.id,
        type: "NOTE",
        actor: "seed_script",
        detail: `Traveler interested in ${style[0].toLowerCase()} itinerary in ${destination[0]}`,
        created_at: updatedAt
      }
    );
  }

  await writeFile(DATA_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  console.log(`Seed complete: +${count} clients, +${count} customers, +${count} bookings, +${count * 2} activities`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
