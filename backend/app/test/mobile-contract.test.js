import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTRACT_META_PATH = path.resolve(__dirname, "..", "..", "..", "api", "generated", "mobile-api.meta.json");
const STORE_PATH = path.resolve(__dirname, "..", "data", "store.json");

process.env.KEYCLOAK_ENABLED = "true";
process.env.INSECURE_TEST_AUTH = "true";
process.env.KEYCLOAK_ALLOWED_ROLES = "atp_admin,atp_manager,atp_accountant,atp_staff";
process.env.MOBILE_MIN_SUPPORTED_APP_VERSION = "1.0.0";
process.env.MOBILE_LATEST_APP_VERSION = "1.0.0";
process.env.MOBILE_FORCE_UPDATE = "false";

const contractMeta = JSON.parse(await readFile(CONTRACT_META_PATH, "utf8"));
const { createBackendHandler } = await import("../src/server.js");
const handler = await createBackendHandler({ port: 8787 });
const HAS_MAGICK = spawnSync("magick", ["-version"], { stdio: "ignore" }).status === 0;

function endpointPath(key) {
  const endpoint = contractMeta.endpoints.find((candidate) => candidate.key === key);
  assert.ok(endpoint, `Missing endpoint metadata for ${key}`);
  return endpoint.path;
}

function createMockRequest({ method = "GET", url = "/", headers = {}, body = "" } = {}) {
  const stream = Readable.from(body ? [Buffer.from(body)] : []);
  stream.method = method;
  stream.url = url;
  stream.headers = headers;
  return stream;
}

function createMockResponse() {
  const headerStore = new Map();
  return {
    statusCode: 200,
    body: "",
    headersSent: false,
    headerStore,
    setHeader(name, value) {
      headerStore.set(String(name).toLowerCase(), value);
    },
    getHeader(name) {
      return headerStore.get(String(name).toLowerCase());
    },
    writeHead(status, headerValues = {}) {
      this.statusCode = status;
      this.headersSent = true;
      for (const [name, value] of Object.entries(headerValues)) {
        this.setHeader(name, value);
      }
    },
    end(chunk = "") {
      this.body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk || "");
      this.finished = true;
    }
  };
}

async function requestJson(pathname, headers = {}, options = {}) {
  const method = options.method || "GET";
  const body = options.body === undefined ? "" : JSON.stringify(options.body);
  const req = createMockRequest({
    method,
    url: pathname,
    headers: body ? { "content-type": "application/json", ...headers } : headers,
    body
  });
  const res = createMockResponse();
  await handler(req, res);
  return {
    status: res.statusCode,
    headers: Object.fromEntries(res.headerStore.entries()),
    body: res.body ? JSON.parse(res.body) : null
  };
}

function apiHeaders(roles = "atp_admin") {
  return {
    "x-test-roles": roles,
    "x-test-username": "joachim"
  };
}

function assertISODateLike(value, label) {
  assert.equal(typeof value, "string", `${label} should be a string`);
  assert.ok(/\d{4}-\d{2}-\d{2}T/.test(value), `${label} should look like an ISO timestamp`);
}

async function resetStore() {
  await writeFile(STORE_PATH, `${JSON.stringify({
    bookings: [],
    activities: [],
    invoices: [],
    chat_channel_accounts: [],
    chat_conversations: [],
    chat_events: []
  }, null, 2)}\n`, "utf8");
}

async function createSeedBooking() {
  await resetStore();
  const result = await requestJson(endpointPath("public_bookings"), {}, {
    method: "POST",
    body: {
      name: "Test User",
      email: "test@example.com",
      phone_number: "+15551234567",
      preferred_language: "English",
      preferred_currency: "USD",
      destinations: ["Vietnam"],
      travel_style: ["Culture"],
      number_of_travelers: 2,
      notes: "Seeded from contract test"
    }
  });
  assert.equal(result.status, 201);
  return result.body.booking;
}

function assertBookingShape(booking) {
  assert.equal(typeof booking.id, "string");
  assert.ok(catalogCodes(contractMeta.stages).includes(booking.stage), `Unexpected booking stage: ${booking.stage}`);
  assert.equal(typeof booking.pricing, "object");
  assert.equal(typeof booking.pricing.currency, "string");
  assert.equal(typeof booking.pricing.agreed_net_amount_cents, "number");
  assert.ok(Array.isArray(booking.pricing.adjustments));
  assert.ok(Array.isArray(booking.pricing.payments));
  assert.equal(typeof booking.pricing.summary, "object");
  assert.equal(typeof booking.pricing.summary.is_schedule_balanced, "boolean");
  assert.ok(Array.isArray(booking.persons));
  assert.ok(booking.persons.length > 0);
  assert.equal(typeof booking.persons[0].id, "string");
  assert.equal(typeof booking.persons[0].name, "string");
  assert.ok(Array.isArray(booking.persons[0].roles));
  assert.equal(typeof booking.preferred_currency, "string");
  assert.ok(Array.isArray(booking.destinations));
  assert.ok(Array.isArray(booking.travel_styles));
  if (booking.service_level_agreement_due_at) assertISODateLike(booking.service_level_agreement_due_at, "booking.service_level_agreement_due_at");
  if (booking.created_at) assertISODateLike(booking.created_at, "booking.created_at");
  if (booking.updated_at) assertISODateLike(booking.updated_at, "booking.updated_at");
}

function catalogCodes(items) {
  return items.map((item) => item.code);
}

test("public mobile bootstrap matches contract metadata", async () => {
  const result = await requestJson(endpointPath("mobile_bootstrap"));
  assert.equal(result.status, 200);
  assert.equal(result.body.api.contract_version, contractMeta.modelVersion);
  assert.equal(result.body.app.min_supported_version, "1.0.0");
  assert.equal(result.body.app.latest_version, "1.0.0");
  assert.equal(result.body.app.force_update, false);
  assert.deepEqual(result.body.features, {
    bookings: true,
    tours: false
  });
});

test("bookings list response conforms to the mobile contract", async () => {
  const createdBooking = await createSeedBooking();
  const result = await requestJson(`${endpointPath("bookings")}?page=1&page_size=10&sort=created_at_desc`, apiHeaders());
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.items));
  assert.equal(typeof result.body.pagination, "object");
  assert.equal(typeof result.body.pagination.page, "number");
  assert.equal(typeof result.body.pagination.page_size, "number");
  assert.equal(typeof result.body.pagination.total_items, "number");
  assert.equal(typeof result.body.pagination.total_pages, "number");
  assert.ok(result.body.items.length > 0, "Expected at least one booking");
  assert.equal(result.body.items[0].id, createdBooking.id);
  assertBookingShape(result.body.items[0]);
});

test("booking detail, activities, invoices, and atp_staff responses conform to the mobile contract", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const detailResult = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailResult.status, 200);
  assert.deepEqual(Object.keys(detailResult.body).sort(), ["booking"]);
  assertBookingShape(detailResult.body.booking);
  assert.equal(detailResult.body.booking.id, bookingId);

  const activitiesResult = await requestJson(endpointPath("booking_activities").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(activitiesResult.status, 200);
  assert.ok(Array.isArray(activitiesResult.body.activities));
  for (const activity of activitiesResult.body.activities) {
    assert.equal(typeof activity.id, "string");
    assert.equal(typeof activity.booking_id, "string");
    assert.equal(typeof activity.type, "string");
    assert.equal(typeof activity.detail, "string");
    assert.equal(typeof activity.actor, "string");
    assertISODateLike(activity.created_at, "activity.created_at");
  }

  const invoicesResult = await requestJson(endpointPath("booking_invoices").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(invoicesResult.status, 200);
  assert.ok(Array.isArray(invoicesResult.body.items));
  assert.equal(typeof invoicesResult.body.total, "number");

  const staffResult = await requestJson(`${endpointPath("atp_staff")}?active=true`, apiHeaders());
  assert.equal(staffResult.status, 200);
  assert.ok(Array.isArray(staffResult.body.items));
  assert.equal(typeof staffResult.body.total, "number");
  for (const member of staffResult.body.items) {
    assert.ok(Array.isArray(member.usernames));
    assert.ok(member.usernames.every((username) => typeof username === "string"));
  }
});

test("booking offer patch enforces preferred currency", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailBefore.status, 200);
  const booking = detailBefore.body.booking;
  const offerCurrency = booking.offer?.currency || booking.preferred_currency || booking.pricing?.currency || "USD";
  const bookingHash = booking.booking_hash;
  assert.equal(typeof bookingHash, "string");

  const currentOffer = booking.offer;
  assert.equal(typeof currentOffer, "object");

  const patchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        booking_hash: bookingHash,
        offer: currentOffer
      }
    }
  );
  assert.equal(patchResult.status, 200);
  assert.equal(patchResult.body.booking.offer.currency, offerCurrency);
  assert.equal(patchResult.body.unchanged, true);
  assert.ok(Array.isArray(patchResult.body.booking.offer.components));
  assert.equal(typeof patchResult.body.booking.offer.totals.gross_amount_cents, "number");

  const mismatchCurrency = offerCurrency === "USD" ? "VND" : "USD";
  const conversionResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        booking_hash: bookingHash,
        offer: {
          ...currentOffer,
          currency: mismatchCurrency,
          components: []
        }
      }
    }
  );
  assert.equal(conversionResult.status, 200);
  assert.equal(conversionResult.body.booking.offer.currency, offerCurrency);
  assert.equal(typeof conversionResult.body.booking.offer.total_price_cents, "number");
});

test("booking name and persons endpoints update the booking", async () => {
  const createdBooking = await createSeedBooking();
  const booking_id = createdBooking.id;

  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailBefore.status, 200);
  const bookingBefore = detailBefore.body.booking;
  const booking_hash = bookingBefore.booking_hash;
  const original_person = bookingBefore.persons[0];
  assert.equal(typeof original_person.id, "string");

  const nameResult = await requestJson(
    endpointPath("booking_name").replace("{booking_id}", booking_id),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        booking_hash,
        name: "Vietnam Adventure Journey",
        actor: "joachim"
      }
    }
  );
  assert.equal(nameResult.status, 200);
  assert.equal(nameResult.body.booking.name, "Vietnam Adventure Journey");
  const detailAfterName = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailAfterName.status, 200);
  const booking_hash_after_name = detailAfterName.body.booking.booking_hash;

  const personsPayload = [
    {
      ...original_person,
      roles: ["primary_contact", "decision_maker"],
      emails: ["planner@example.com"],
      date_of_birth: "1988-04-11",
      nationality: "DE",
      documents: [
        {
          id: `${original_person.id}_passport`,
          document_type: "passport",
          holder_name: "Test User",
          document_number: "C01X9981",
          issuing_country: "DE",
          issued_on: "2023-05-01",
          expires_on: "2033-05-01"
        }
      ]
    },
    {
      id: `${booking_id}_traveler_2`,
      name: "Traveler Two",
      roles: ["traveler"],
      emails: ["traveler2@example.com"],
      phone_numbers: ["+15557654321"]
    }
  ];
  const personsResult = await requestJson(
    endpointPath("booking_persons").replace("{booking_id}", booking_id),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        booking_hash: booking_hash_after_name,
        persons: personsPayload,
        actor: "joachim"
      }
    }
  );
  assert.equal(personsResult.status, 200);
  assert.equal(personsResult.body.booking.persons.length, 2);
  assert.deepEqual(personsResult.body.booking.persons[0].roles, ["primary_contact", "decision_maker"]);
  assert.equal(personsResult.body.booking.persons[0].documents[0].holder_name, "Test User");
  assert.equal(personsResult.body.booking.persons[0].documents[0].issued_on, "2023-05-01");
  assert.equal(personsResult.body.booking.persons[1].name, "Traveler Two");
  const detailAfterPersons = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailAfterPersons.status, 200);
  assert.equal(detailAfterPersons.body.booking.persons[0].documents[0].document_number, "C01X9981");
});

test("booking person photo endpoint updates the booking when ImageMagick is available", async (t) => {
  if (!HAS_MAGICK) {
    t.skip("ImageMagick `magick` is not installed in this environment.");
    return;
  }

  const createdBooking = await createSeedBooking();
  const booking_id = createdBooking.id;
  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailBefore.status, 200);
  const bookingBefore = detailBefore.body.booking;
  const booking_hash = bookingBefore.booking_hash;
  const original_person = bookingBefore.persons[0];

  const photoResult = await requestJson(
    endpointPath("booking_person_photo")
      .replace("{booking_id}", booking_id)
      .replace("{person_id}", original_person.id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        booking_hash,
        filename: "profile.png",
        data_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAACYktHRAAB3YoTpAAAAAd0SU1FB+oDCgU5NQ3qg4IAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjYtMDMtMTBUMDU6NTc6NTMrMDA6MDCtMWFJAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDI2LTAzLTEwVDA1OjU3OjUzKzAwOjAw3GzZ9QAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyNi0wMy0xMFQwNTo1Nzo1MyswMDowMIt5+CoAAAAKSURBVAjXY2gAAACCAIHdQ2r0AAAAAElFTkSuQmCC",
        actor: "joachim"
      }
    }
  );
  assert.equal(photoResult.status, 200);
  assert.equal(typeof photoResult.body.booking.persons[0].photo_ref, "string");
  assert.ok(photoResult.body.booking.persons[0].photo_ref.includes("/public/v1/booking-person-photos/"));
});

test("booking invoice create/update and offer exchange-rates endpoints work", async () => {
  const createdBooking = await createSeedBooking();
  const booking_id = createdBooking.id;

  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailBefore.status, 200);
  const booking_hash = detailBefore.body.booking.booking_hash;

  const invoiceCreateResult = await requestJson(
    endpointPath("booking_invoice_create").replace("{booking_id}", booking_id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        booking_hash,
        invoice_number: "ATP-TEST-001",
        currency: "USD",
        title: "Planning deposit",
        components: [
          {
            description: "Deposit",
            quantity: 2,
            unit_amount_cents: 25000
          }
        ],
        due_amount_cents: 50000
      }
    }
  );
  assert.equal(invoiceCreateResult.status, 201);
  assert.equal(invoiceCreateResult.body.invoice.invoice_number, "ATP-TEST-001");
  assert.equal(invoiceCreateResult.body.invoice.total_amount_cents, 50000);
  const invoice_id = invoiceCreateResult.body.invoice.id;
  assert.equal(typeof invoice_id, "string");
  const booking_hash_after_invoice_create = invoiceCreateResult.body.booking.booking_hash;

  const invoiceUpdateResult = await requestJson(
    endpointPath("booking_invoice_update")
      .replace("{booking_id}", booking_id)
      .replace("{invoice_id}", invoice_id),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        booking_hash: booking_hash_after_invoice_create,
        title: "Planning deposit updated",
        sent_to_recipient: true,
        components: [
          {
            description: "Deposit",
            quantity: 2,
            unit_amount_cents: 25000
          }
        ]
      }
    }
  );
  assert.equal(invoiceUpdateResult.status, 200);
  assert.equal(invoiceUpdateResult.body.invoice.title, "Planning deposit updated");
  assert.equal(invoiceUpdateResult.body.invoice.sent_to_recipient, true);

  const exchangeRatesResult = await requestJson(
    endpointPath("offer_exchange_rates"),
    apiHeaders(),
    {
      method: "POST",
      body: {
        from_currency: "USD",
        to_currency: "USD",
        components: [
          {
            id: "component_1",
            category: "OTHER",
            quantity: 2,
            unit_amount_cents: 25000,
            tax_rate_basis_points: 1000
          }
        ]
      }
    }
  );
  assert.equal(exchangeRatesResult.status, 200);
  assert.equal(exchangeRatesResult.body.from_currency, "USD");
  assert.equal(exchangeRatesResult.body.to_currency, "USD");
  assert.equal(exchangeRatesResult.body.exchange_rate, 1);
  assert.ok(Array.isArray(exchangeRatesResult.body.converted_components));
  assert.equal(exchangeRatesResult.body.converted_components.length, 1);
  assert.equal(typeof exchangeRatesResult.body.total_price_cents, "number");
});
