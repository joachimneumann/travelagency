import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(APP_ROOT, "data", "app-data.json");

const DESTINATIONS = ["Vietnam", "Thailand", "Cambodia", "Laos"];
const STYLES = ["Grand Expeditions", "Culture", "Family", "Gastronomic Experiences", "Luxury", "Beach", "Budget"];
const LANGUAGES = ["en", "vi", "fr", "de", "es"];
const CURRENCIES = ["USD", "EUR", "VND"];
const BUDGETS = [
  { lower: 1500, upper: 2500 },
  { lower: 2500, upper: 3500 },
  { lower: 3500, upper: 5000 },
  { lower: 5000, upper: null }
];
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

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function emptyStore(base = {}) {
  return {
    ...base,
    bookings: Array.isArray(base.bookings) ? base.bookings : [],
    activities: Array.isArray(base.activities) ? base.activities : [],
    payment_documents: Array.isArray(base.payment_documents) ? base.payment_documents : [],
    chat_channel_accounts: Array.isArray(base.chat_channel_accounts) ? base.chat_channel_accounts : [],
    chat_conversations: Array.isArray(base.chat_conversations) ? base.chat_conversations : [],
    chat_events: Array.isArray(base.chat_events) ? base.chat_events : []
  };
}

async function main() {
  const count = parseCountArg(process.argv);
  const store = emptyStore(await readJson(DATA_PATH));
  store.bookings = [];
  store.activities = [];
  store.payment_documents = [];

  for (let i = 0; i < count; i += 1) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const name = `${firstName} ${lastName}`;
    const email = buildEmail(name, i + 1);
    const phoneNumber = `+1${randomInt(2000000000, 9999999999)}`;
    const preferredLanguage = pick(LANGUAGES);
    const preferredCurrency = pick(CURRENCIES);
    const destinations = [pick(DESTINATIONS)];
    const travelStyles = [pick(STYLES)];
    const createdAt = nowMinusHours(randomInt(2, 24 * 40));
    const updatedAt = new Date(new Date(createdAt).getTime() + randomInt(1, 120) * 60 * 1000).toISOString();
    const budget = pick(BUDGETS);
    const travelersCount = randomInt(1, 6);
    const bookingId = `booking_${randomUUID()}`;

    const primaryPerson = {
      id: `${bookingId}_person_1`,
      name,
      emails: [email],
      phone_numbers: [phoneNumber],
      preferred_language: preferredLanguage,
      roles: ["primary_contact", "traveler"]
    };

    const extraPersons = Array.from({ length: Math.max(0, travelersCount - 1) }, (_, index) => {
      const travelerName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
      return {
        id: `${bookingId}_person_${index + 2}`,
        name: travelerName,
        emails: [buildEmail(travelerName, i + index + 100)],
        phone_numbers: [],
        preferred_language: preferredLanguage,
        roles: ["traveler"]
      };
    });

    const booking = {
      id: bookingId,
      assigned_keycloak_user_id: null,
      destinations,
      destination: destinations,
      travel_styles: travelStyles,
      style: travelStyles,
      travel_start_day: null,
      travel_end_day: null,
      number_of_travelers: travelersCount,
      preferred_currency: preferredCurrency,
      notes: "Seeded test booking",
      persons: [primaryPerson, ...extraPersons],
      web_form_submission: {
        destinations,
        travel_style: travelStyles,
        travel_month: null,
        number_of_travelers: travelersCount,
        preferred_currency: preferredCurrency,
        travel_duration_days_min: null,
        travel_duration_days_max: null,
        name,
        email,
        phone_number: phoneNumber,
        budget_lower_USD: budget.lower,
        budget_upper_USD: budget.upper,
        preferred_language: preferredLanguage,
        notes: "Seeded test booking",
        submittedAt: createdAt
      },
      pricing: {
        currency: preferredCurrency,
        payments: []
      },
      offer: {
        currency: preferredCurrency,
        category_rules: [
          { category: "ACCOMMODATION", tax_rate_basis_points: 1000 },
          { category: "TRANSPORTATION", tax_rate_basis_points: 1000 },
          { category: "TOURS_ACTIVITIES", tax_rate_basis_points: 1000 },
          { category: "GUIDE_SUPPORT_SERVICES", tax_rate_basis_points: 1000 },
          { category: "MEALS", tax_rate_basis_points: 1000 },
          { category: "FEES_TAXES", tax_rate_basis_points: 1000 },
          { category: "DISCOUNTS_CREDITS", tax_rate_basis_points: 1000 },
          { category: "OTHER", tax_rate_basis_points: 1000 }
        ],
        components: [],
        totals: {
          net_amount_cents: 0,
          tax_amount_cents: 0,
          gross_amount_cents: 0,
          total_price_cents: 0,
          items_count: 0
        },
        total_price_cents: 0
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
        detail: `Traveler interested in ${travelStyles[0].toLowerCase()} itinerary in ${destinations[0]}`,
        created_at: updatedAt
      }
    );
  }

  await writeFile(DATA_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  console.log(`Seed complete: +${count} bookings, +${count * 2} activities`);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
