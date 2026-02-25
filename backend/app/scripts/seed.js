import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(APP_ROOT, "data", "store.json");
const STAFF_PATH = path.join(APP_ROOT, "config", "staff.json");

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

function stageSla(stage, fromIso) {
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
  const staff = await readJson(STAFF_PATH);
  const activeStaff = staff.filter((s) => s.active);

  store.customers ||= [];
  store.leads ||= [];
  store.activities ||= [];

  for (let i = 0; i < count; i += 1) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const name = `${firstName} ${lastName}`;
    const email = buildEmail(name, i + 1);
    const phone = `+1${randomInt(2000000000, 9999999999)}`;
    const language = pick(LANGUAGES);
    const destination = pick(DESTINATIONS);
    const style = pick(STYLES);
    const stage = pick(STAGES);
    const createdAt = nowMinusHours(randomInt(2, 24 * 40));
    const updatedAt = new Date(new Date(createdAt).getTime() + randomInt(1, 120) * 60 * 1000).toISOString();
    const owner = activeStaff.length ? activeStaff[i % activeStaff.length] : null;

    const customer = {
      id: `cust_${randomUUID()}`,
      name,
      email,
      phone,
      language,
      created_at: createdAt,
      updated_at: updatedAt,
      tags: []
    };
    store.customers.push(customer);

    const lead = {
      id: `lead_${randomUUID()}`,
      customer_id: customer.id,
      stage,
      owner_id: owner?.id || null,
      owner_name: owner?.name || null,
      sla_due_at: stageSla(stage, updatedAt),
      destination,
      style,
      travel_month: pick(MONTHS),
      travelers: randomInt(1, 6),
      duration: pick(DURATIONS),
      budget: pick(BUDGETS),
      notes: "Seeded test lead",
      source: {
        page_url: "https://chapter2.live/",
        utm_source: "seed",
        utm_medium: "script",
        utm_campaign: "milestone_1",
        referrer: "https://example.com"
      },
      idempotency_key: null,
      created_at: createdAt,
      updated_at: updatedAt
    };
    store.leads.push(lead);

    store.activities.push(
      {
        id: `act_${randomUUID()}`,
        lead_id: lead.id,
        type: "LEAD_CREATED",
        actor: "seed_script",
        detail: "Seeded lead created",
        created_at: createdAt
      },
      {
        id: `act_${randomUUID()}`,
        lead_id: lead.id,
        type: "NOTE",
        actor: "seed_script",
        detail: `Customer interested in ${style.toLowerCase()} itinerary in ${destination}`,
        created_at: updatedAt
      }
    );
  }

  await writeFile(DATA_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  console.log(`Seed complete: +${count} customers, +${count} leads, +${count * 2} activities`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
