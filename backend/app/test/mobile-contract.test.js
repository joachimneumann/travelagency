import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { PDFDocument as PDFLibDocument } from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTRACT_META_PATH = path.resolve(__dirname, "..", "..", "..", "api", "generated", "mobile-api.meta.json");
const TEST_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "travelagency-contract-test-"));
const STORE_PATH = path.join(TEST_DATA_DIR, "store.json");

process.env.KEYCLOAK_ENABLED = "true";
process.env.INSECURE_TEST_AUTH = "true";
process.env.KEYCLOAK_ALLOWED_ROLES = "atp_admin,atp_manager,atp_accountant,atp_staff";
process.env.KEYCLOAK_BASE_URL = "http://keycloak.test";
process.env.KEYCLOAK_REALM = "asiatravelplan";
process.env.KEYCLOAK_CLIENT_ID = "asiatravelplan-backend";
process.env.KEYCLOAK_ADMIN = "admin";
process.env.KEYCLOAK_ADMIN_PASSWORD = "admin";
process.env.MOBILE_MIN_SUPPORTED_APP_VERSION = "1.0.0";
process.env.MOBILE_LATEST_APP_VERSION = "1.0.0";
process.env.MOBILE_FORCE_UPDATE = "false";
process.env.BACKEND_DATA_DIR = TEST_DATA_DIR;
process.env.STORE_FILE = STORE_PATH;
process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH = "";
process.env.GOOGLE_IMPERSONATED_EMAIL = "";
process.env.OFFER_ACCEPTANCE_TOKEN_SECRET = "offer-acceptance-contract-test-secret";

const originalFetch = global.fetch;
const KEYCLOAK_USERS = [
  { id: "kc-admin", username: "admin", firstName: "Admin", lastName: "User", enabled: true },
  { id: "kc-joachim", username: "joachim", firstName: "Joachim", lastName: "Neumann", enabled: true },
  { id: "kc-staff", username: "staff", firstName: "Staff", lastName: "User", enabled: true },
  { id: "kc-accountant", username: "accountant", firstName: "Accountant", lastName: "User", enabled: true },
  { id: "kc-disabled", username: "disabled", firstName: "Disabled", lastName: "User", enabled: false }
];
const KEYCLOAK_ROLE_MAP = {
  "kc-admin": { realm: [], client: ["atp_admin"] },
  "kc-joachim": { realm: [], client: ["atp_manager"] },
  "kc-staff": { realm: [], client: ["atp_staff"] },
  "kc-accountant": { realm: [], client: ["atp_accountant"] },
  "kc-disabled": { realm: [], client: ["atp_staff"] }
};

global.fetch = async function mockedFetch(input, init = {}) {
  const url = typeof input === "string" ? input : input?.url || "";
  if (!String(url).startsWith("http://keycloak.test")) {
    return originalFetch(input, init);
  }

  if (url === "http://keycloak.test/realms/master/protocol/openid-connect/token") {
    return new Response(JSON.stringify({ access_token: "test-admin-token", expires_in: 300 }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  if (url === "http://keycloak.test/admin/realms/asiatravelplan/users?first=0&max=100") {
    return new Response(JSON.stringify(KEYCLOAK_USERS), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  if (url === "http://keycloak.test/admin/realms/asiatravelplan/clients?clientId=asiatravelplan-backend") {
    return new Response(JSON.stringify([{ id: "client-uuid", clientId: "asiatravelplan-backend" }]), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  const realmMatch = String(url).match(/^http:\/\/keycloak\.test\/admin\/realms\/asiatravelplan\/users\/([^/]+)\/role-mappings\/realm$/);
  if (realmMatch) {
    const userId = decodeURIComponent(realmMatch[1]);
    const roles = (KEYCLOAK_ROLE_MAP[userId]?.realm || []).map((name) => ({ name }));
    return new Response(JSON.stringify(roles), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  const clientMatch = String(url).match(/^http:\/\/keycloak\.test\/admin\/realms\/asiatravelplan\/users\/([^/]+)\/role-mappings\/clients\/client-uuid$/);
  if (clientMatch) {
    const userId = decodeURIComponent(clientMatch[1]);
    const roles = (KEYCLOAK_ROLE_MAP[userId]?.client || []).map((name) => ({ name }));
    return new Response(JSON.stringify(roles), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  const realmCompositeMatch = String(url).match(/^http:\/\/keycloak\.test\/admin\/realms\/asiatravelplan\/users\/([^/]+)\/role-mappings\/realm\/composite$/);
  if (realmCompositeMatch) {
    const userId = decodeURIComponent(realmCompositeMatch[1]);
    const roles = (KEYCLOAK_ROLE_MAP[userId]?.realm || []).map((name) => ({ name }));
    return new Response(JSON.stringify(roles), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  const clientCompositeMatch = String(url).match(/^http:\/\/keycloak\.test\/admin\/realms\/asiatravelplan\/users\/([^/]+)\/role-mappings\/clients\/client-uuid\/composite$/);
  if (clientCompositeMatch) {
    const userId = decodeURIComponent(clientCompositeMatch[1]);
    const roles = (KEYCLOAK_ROLE_MAP[userId]?.client || []).map((name) => ({ name }));
    return new Response(JSON.stringify(roles), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  const userMatch = String(url).match(/^http:\/\/keycloak\.test\/admin\/realms\/asiatravelplan\/users\/([^/]+)$/);
  if (userMatch) {
    const userId = decodeURIComponent(userMatch[1]);
    const user = KEYCLOAK_USERS.find((entry) => entry.id === userId);
    return new Response(JSON.stringify(user || null), {
      status: user ? 200 : 404,
      headers: { "content-type": "application/json" }
    });
  }

  return new Response("not mocked", { status: 404 });
};

const contractMeta = JSON.parse(await readFile(CONTRACT_META_PATH, "utf8"));
const { createBackendHandler } = await import("../src/server.js");
const handler = await createBackendHandler({ port: 8787 });
const HAS_MAGICK = spawnSync("magick", ["-version"], { stdio: "ignore" }).status === 0;
const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGUExURXqnx////yb9JEMAAAABYktHRAH/Ai3eAAAAB3RJTUUH6gMXCTo1ja6mZwAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyNi0wMy0yM1QwOTo1ODo1MyswMDowMLzSbEkAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjYtMDMtMjNUMDk6NTg6NTMrMDA6MDDNj9T1AAAAKHRFWHRkYXRlOnRpbWVzdGFtcAAyMDI2LTAzLTIzVDA5OjU4OjUzKzAwOjAwmpr1KgAAAApJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=";

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
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      sink.body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk || "");
      callback();
    }
  });
  const headerStore = new Map();
  sink.statusCode = 200;
  sink.body = "";
  sink.headersSent = false;
  sink.headerStore = headerStore;
  sink.setHeader = function setHeader(name, value) {
    headerStore.set(String(name).toLowerCase(), value);
  };
  sink.getHeader = function getHeader(name) {
    return headerStore.get(String(name).toLowerCase());
  };
  sink.writeHead = function writeHead(status, headerValues = {}) {
    sink.statusCode = status;
    sink.headersSent = true;
    for (const [name, value] of Object.entries(headerValues)) {
      sink.setHeader(name, value);
    }
  };
  const originalEnd = sink.end.bind(sink);
  sink.end = function end(chunk = "", encoding, callback) {
    if (chunk) {
      sink.body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    }
    sink.finished = true;
    return originalEnd("", encoding, callback);
  };
  return sink;
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

async function requestRaw(pathname, headers = {}, options = {}) {
  const method = options.method || "GET";
  const body = options.body === undefined
    ? ""
    : typeof options.body === "string"
      ? options.body
      : JSON.stringify(options.body);
  const req = createMockRequest({
    method,
    url: pathname,
    headers: body ? { "content-type": "application/json", ...headers } : headers,
    body
  });
  const res = createMockResponse();
  await handler(req, res);
  if (!res.writableFinished) {
    await once(res, "finish");
  }
  return {
    status: res.statusCode,
    headers: Object.fromEntries(res.headerStore.entries()),
    body: res.body
  };
}

async function createPdfBase64(pageSizes) {
  const document = await PDFLibDocument.create();
  for (const size of Array.isArray(pageSizes) ? pageSizes : []) {
    const width = Number(Array.isArray(size) ? size[0] : 0) || 0;
    const height = Number(Array.isArray(size) ? size[1] : 0) || 0;
    document.addPage([width, height]);
  }
  const bytes = await document.save();
  return Buffer.from(bytes).toString("base64");
}

async function createPdfBase64WithText(pageSizes, label = "Attachment page") {
  const document = await PDFLibDocument.create();
  for (const [index, size] of (Array.isArray(pageSizes) ? pageSizes : []).entries()) {
    const width = Number(Array.isArray(size) ? size[0] : 0) || 0;
    const height = Number(Array.isArray(size) ? size[1] : 0) || 0;
    const page = document.addPage([width, height]);
    page.drawText(`${label} ${index + 1}`, { x: 36, y: height - 56, size: 14 });
  }
  const bytes = await document.save();
  return Buffer.from(bytes).toString("base64");
}

function decodePdfHexText(body) {
  return Array.from(String(body || "").matchAll(/<([0-9A-Fa-f]+)>/g))
    .map((match) => String(match[1] || ""))
    .filter((hex) => hex.length >= 2 && hex.length % 2 === 0)
    .map((hex) => Buffer.from(hex, "hex").toString("latin1"))
    .join(" ");
}

function decodePdfUtf16Text(buffer) {
  const source = Buffer.isBuffer(buffer)
    ? buffer.toString("latin1")
    : Buffer.from(String(buffer || ""), "latin1").toString("latin1");
  return Array.from(source.matchAll(/(?:\x00[\x09\x0A\x0D\x20-\x7E]){3,}/g))
    .map((match) => String(match[0] || "").replace(/\x00/g, ""))
    .join(" ");
}

function decodePdfEmbeddedText(buffer) {
  const rawBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer || ""), "latin1");
  return [
    decodePdfHexText(rawBuffer.toString("latin1")),
    decodePdfUtf16Text(rawBuffer)
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeExtractedPdfText(text) {
  return String(text || "").replace(/\s+/g, "");
}

function apiHeaders(roles = "atp_admin", username = "joachim", sub = "kc-joachim") {
  return {
    "x-test-roles": roles,
    "x-test-username": username,
    "x-test-sub": sub
  };
}

function assertISODateLike(value, label) {
  assert.equal(typeof value, "string", `${label} should be a string`);
  assert.ok(/\d{4}-\d{2}-\d{2}T/.test(value), `${label} should look like an ISO timestamp`);
}

async function resetStore() {
  await mkdir(TEST_DATA_DIR, { recursive: true });
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
  return await createPublicBooking();
}

async function createPublicBooking(overrides = {}) {
  const result = await requestJson(endpointPath("public_bookings"), {}, {
    method: "POST",
    body: {
      name: "Test User",
      email: "test@example.com",
      phone_number: "+15551234567",
      preferred_language: "en",
      preferred_currency: "USD",
      destinations: ["Vietnam"],
      travel_style: ["Culture"],
      number_of_travelers: 2,
      notes: "Seeded from contract test",
      ...overrides
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
  assert.equal(typeof booking.travel_plan_revision, "number");
  assert.equal(typeof booking.travel_plan, "object");
  assert.ok(Array.isArray(booking.travel_plan.days));
  assert.ok(Array.isArray(booking.travel_plan.offer_component_links));
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

test("public booking discovery-call request can be created without destinations or travel styles", async () => {
  await resetStore();
  const result = await requestJson(endpointPath("public_bookings"), {}, {
    method: "POST",
    body: {
      name: "Discovery Caller",
      email: "caller@example.com",
      preferred_language: "en",
      preferred_currency: "USD",
      destinations: [],
      travel_style: [],
      booking_name: "",
      tour_id: "",
      notes: "No tour selected yet"
    }
  });

  assert.equal(result.status, 201);
  assertBookingShape(result.body.booking);
  assert.deepEqual(result.body.booking.destinations, []);
  assert.deepEqual(result.body.booking.travel_styles, []);
  assert.equal(result.body.booking.persons.length, 1);
  assert.equal(result.body.booking.persons[0].name, "Discovery Caller");
});

test("booking detail, activities, and invoices conform to the mobile contract", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const detailResult = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailResult.status, 200);
  assert.deepEqual(Object.keys(detailResult.body).sort(), ["booking"]);
  assertBookingShape(detailResult.body.booking);
  assert.equal(detailResult.body.booking.id, bookingId);
  assert.equal(detailResult.body.booking.generated_offer_email_enabled, false);

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

});

test("booking offer patch preserves selected currency", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailBefore.status, 200);
  const booking = detailBefore.body.booking;
  const offerCurrency = booking.offer?.currency || booking.preferred_currency || booking.pricing?.currency || "USD";
  const offerRevision = booking.offer_revision;
  assert.equal(typeof offerRevision, "number");

  const currentOffer = booking.offer;
  assert.equal(typeof currentOffer, "object");

  const patchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: offerRevision,
        offer: currentOffer
      }
    }
  );
  assert.equal(patchResult.status, 200);
  assert.equal(patchResult.body.booking.offer.currency, offerCurrency);
  assert.equal(patchResult.body.unchanged, true);
  assert.ok(Array.isArray(patchResult.body.booking.offer.components));
  assert.equal(typeof patchResult.body.booking.offer.totals.gross_amount_cents, "number");
  const offer_revision_after_patch = patchResult.body.booking.offer_revision;

  const mismatchCurrency = offerCurrency === "USD" ? "VND" : "USD";
  const conversionResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: offer_revision_after_patch,
        offer: {
          ...currentOffer,
          currency: mismatchCurrency,
          components: []
        }
      }
    }
  );
  assert.equal(conversionResult.status, 200);
  assert.equal(conversionResult.body.booking.offer.currency, mismatchCurrency);
  assert.equal(typeof conversionResult.body.booking.offer.total_price_cents, "number");

  const detailAfter = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailAfter.status, 200);
  assert.equal(detailAfter.body.booking.offer.currency, mismatchCurrency);
});

test("booking offer patch rejects currency change once offer is sent", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingRecord = store.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingRecord);
  bookingRecord.offer = {
    ...(bookingRecord.offer || {}),
    status: "OFFER_SENT",
    currency: "USD"
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailBefore.status, 200);
  assert.equal(detailBefore.body.booking.offer.status, "OFFER_SENT");

  const patchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: detailBefore.body.booking.offer_revision,
        offer: {
          ...detailBefore.body.booking.offer,
          currency: "VND"
        }
      }
    }
  );
  assert.equal(patchResult.status, 409);
  assert.match(String(patchResult.body.error || ""), /currency/i);
});

test("booking offer patch persists added offer components", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailBefore.status, 200);
  const booking = detailBefore.body.booking;

  const patchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: booking.offer_revision,
        offer: {
          ...booking.offer,
          currency: booking.preferred_currency,
          components: [
            {
              id: "offer_component_room_1",
              category: "ACCOMMODATION",
              label: "Accommodation",
              details: "Hotel room",
              quantity: 2,
              unit_amount_cents: 15000,
              tax_rate_basis_points: 1000,
              currency: booking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );

  assert.equal(patchResult.status, 200);
  assert.equal(patchResult.body.booking.offer.components.length, 1);
  assert.equal(patchResult.body.booking.offer.components[0].details, "Hotel room");
  assert.equal(patchResult.body.booking.offer.components[0].quantity, 2);
  assert.equal(patchResult.body.booking.offer.total_price_cents > 0, true);

  const detailAfter = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailAfter.status, 200);
  assert.equal(detailAfter.body.booking.offer.components.length, 1);
  assert.equal(detailAfter.body.booking.offer.components[0].details, "Hotel room");
});

test("booking offer patch preserves trip-relative payment-term due types", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailBefore.status, 200);
  const booking = detailBefore.body.booking;

  const patchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: booking.offer_revision,
        offer: {
          ...booking.offer,
          currency: booking.preferred_currency,
          payment_terms: {
            currency: booking.preferred_currency,
            basis_total_amount_cents: booking.offer.total_price_cents || 0,
            lines: [
              {
                id: "payment_term_deposit_1",
                kind: "DEPOSIT",
                label: "Deposit",
                sequence: 1,
                amount_spec: {
                  mode: "PERCENTAGE_OF_OFFER_TOTAL",
                  percentage_basis_points: 3000
                },
                due_rule: {
                  type: "DAYS_AFTER_TRIP_START",
                  days: 3
                }
              },
              {
                id: "payment_term_final_1",
                kind: "FINAL_BALANCE",
                label: "Final payment",
                sequence: 2,
                amount_spec: {
                  mode: "REMAINING_BALANCE"
                },
                due_rule: {
                  type: "DAYS_AFTER_TRIP_END",
                  days: 5
                }
              }
            ]
          },
          components: [
            {
              id: "offer_component_room_1",
              category: "ACCOMMODATION",
              label: "Accommodation",
              details: "Hotel room",
              quantity: 2,
              unit_amount_cents: 15000,
              tax_rate_basis_points: 1000,
              currency: booking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );

  assert.equal(patchResult.status, 200);
  assert.equal(patchResult.body.booking.offer.payment_terms.lines[0].due_rule.type, "DAYS_AFTER_TRIP_START");
  assert.equal(patchResult.body.booking.offer.payment_terms.lines[0].due_rule.days, 3);
  assert.equal(patchResult.body.booking.offer.payment_terms.lines[1].due_rule.type, "DAYS_AFTER_TRIP_END");
  assert.equal(patchResult.body.booking.offer.payment_terms.lines[1].due_rule.days, 5);

  const detailAfter = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailAfter.status, 200);
  assert.equal(detailAfter.body.booking.offer.payment_terms.lines[0].due_rule.type, "DAYS_AFTER_TRIP_START");
  assert.equal(detailAfter.body.booking.offer.payment_terms.lines[1].due_rule.type, "DAYS_AFTER_TRIP_END");
});

test("booking offer patch normalizes installment numbering by installment ordinal", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailBefore.status, 200);
  const booking = detailBefore.body.booking;

  const patchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: booking.offer_revision,
        offer: {
          ...booking.offer,
          currency: booking.preferred_currency,
          payment_terms: {
            currency: booking.preferred_currency,
            lines: [
              {
                id: "payment_term_deposit_numbering",
                kind: "DEPOSIT",
                label: "Deposit",
                sequence: 1,
                amount_spec: {
                  mode: "FIXED_AMOUNT",
                  fixed_amount_cents: 10000
                },
                due_rule: {
                  type: "ON_ACCEPTANCE"
                }
              },
              {
                id: "payment_term_installment_numbering",
                kind: "INSTALLMENT",
                label: "Installment 2",
                sequence: 2,
                amount_spec: {
                  mode: "FIXED_AMOUNT",
                  fixed_amount_cents: 5000
                },
                due_rule: {
                  type: "DAYS_AFTER_ACCEPTANCE",
                  days: 30
                }
              },
              {
                id: "payment_term_final_numbering",
                kind: "FINAL_BALANCE",
                label: "Final payment",
                sequence: 3,
                amount_spec: {
                  mode: "REMAINING_BALANCE"
                },
                due_rule: {
                  type: "DAYS_BEFORE_TRIP_START",
                  days: 7
                }
              }
            ]
          },
          components: [
            {
              id: "offer_component_installment_numbering_1",
              category: "OTHER",
              label: "Service",
              details: "Numbering check",
              quantity: 1,
              unit_amount_cents: 30000,
              tax_rate_basis_points: 1000,
              currency: booking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );

  assert.equal(patchResult.status, 200);
  assert.equal(patchResult.body.booking.offer.payment_terms.lines[1].label, "Installment 1");

  const detailAfter = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailAfter.status, 200);
  assert.equal(detailAfter.body.booking.offer.payment_terms.lines[1].label, "Installment 1");
});

test("booking offer patch persists component removal", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const addResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        offer: {
          ...createdBooking.offer,
          currency: createdBooking.preferred_currency,
          components: [
            {
              id: "offer_component_room_1",
              category: "ACCOMMODATION",
              label: "Accommodation",
              details: "Hotel room",
              quantity: 2,
              unit_amount_cents: 15000,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );

  assert.equal(addResult.status, 200);
  assert.equal(addResult.body.booking.offer.components.length, 1);

  const removeResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: addResult.body.booking.offer_revision,
        offer: {
          ...addResult.body.booking.offer,
          components: []
        }
      }
    }
  );

  assert.equal(removeResult.status, 200);
  assert.equal(removeResult.body.booking.offer.components.length, 0);

  const detailAfter = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailAfter.status, 200);
  assert.equal(detailAfter.body.booking.offer.components.length, 0);
});

test("booking offer patch rejects discounts_credits components", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const patchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        offer: {
          ...createdBooking.offer,
          currency: createdBooking.preferred_currency,
          components: [
            {
              id: "offer_component_discount_1",
              category: "DISCOUNTS_CREDITS",
              label: "Discount / credit",
              details: "Promo discount",
              quantity: 2,
              unit_amount_cents: 100,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );

  assert.equal(patchResult.status, 422);
  assert.match(String(patchResult.body.error || ""), /discounts_credits/i);
});

test("booking offer patch accepts an explicit offer discount with a reason", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const patchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        offer: {
          ...createdBooking.offer,
          currency: createdBooking.preferred_currency,
          components: [
            {
              id: "offer_component_transport_1",
              category: "TRANSPORTATION",
              label: "Transportation",
              details: "Airport transfer",
              quantity: 1,
              unit_amount_cents: 10000,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ],
          discount: {
            reason: "Loyalty discount",
            amount_cents: 500,
            currency: createdBooking.preferred_currency
          }
        }
      }
    }
  );

  assert.equal(patchResult.status, 200);
  assert.equal(patchResult.body.booking.offer.components.length, 1);
  assert.equal(patchResult.body.booking.offer.discount.reason, "Loyalty discount");
  assert.equal(patchResult.body.booking.offer.discount.amount_cents, 500);
  assert.equal(patchResult.body.booking.offer.total_price_cents, 10500);
  assert.equal(patchResult.body.booking.offer.quotation_summary.grand_total_amount_cents, 10500);

  const detailAfter = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailAfter.status, 200);
  assert.equal(detailAfter.body.booking.offer.discount.reason, "Loyalty discount");
  assert.equal(detailAfter.body.booking.offer.total_price_cents, 10500);
});

test("booking travel plan patch persists days, links, and derived financial coverage", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const offerPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        offer: {
          ...createdBooking.offer,
          currency: createdBooking.preferred_currency,
          components: [
            {
              id: "offer_component_transfer_1",
              category: "TRANSPORTATION",
              label: "Transportation",
              details: "Airport transfer",
              quantity: 1,
              unit_amount_cents: 2500,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            },
            {
              id: "offer_component_room_1",
              category: "ACCOMMODATION",
              label: "Accommodation",
              details: "First hotel night",
              quantity: 1,
              unit_amount_cents: 15000,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 1
            }
          ]
        }
      }
    }
  );
  assert.equal(offerPatchResult.status, 200);

  const travelPlanPatchResult = await requestJson(
    endpointPath("booking_travel_plan").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: createdBooking.travel_plan_revision,
        travel_plan: {
          days: [
            {
              id: "travel_plan_day_1",
              day_number: 1,
              title: "Arrival",
              overnight_location: "Hoi An",
              items: [
                {
                  id: "travel_plan_item_1",
                  timing_kind: "point",
                  time_point: "19:00",
                  kind: "transport",
                  title: "Airport transfer",
                  financial_coverage_status: "not_covered"
                },
                {
                  id: "travel_plan_item_2",
                  timing_kind: "range",
                  start_time: "14:00",
                  end_time: "15:00",
                  kind: "accommodation",
                  title: "Hotel check-in",
                  financial_coverage_status: "not_covered"
                },
                {
                  id: "travel_plan_item_3",
                  timing_kind: "label",
                  time_label: "Evening",
                  kind: "free_time",
                  title: "Explore the old town"
                }
              ]
            }
          ],
          offer_component_links: [
            {
              id: "travel_plan_offer_link_1",
              travel_plan_item_id: "travel_plan_item_1",
              offer_component_id: "offer_component_transfer_1",
              coverage_type: "partial"
            },
            {
              id: "travel_plan_offer_link_2",
              travel_plan_item_id: "travel_plan_item_2",
              offer_component_id: "offer_component_room_1",
              coverage_type: "full"
            }
          ]
        }
      }
    }
  );
  assert.equal(travelPlanPatchResult.status, 200);
  assert.equal(travelPlanPatchResult.body.booking.travel_plan_revision, 1);
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days.length, 1);
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.offer_component_links.length, 2);
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days[0].items[0].timing_kind, "point");
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days[0].items[0].time_point, "19:00");
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days[0].items[0].time_label, null);
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days[0].items[1].timing_kind, "range");
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days[0].items[1].start_time, "14:00");
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days[0].items[1].end_time, "15:00");
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days[0].items[2].timing_kind, "label");
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days[0].items[2].time_label, "Evening");
  assert.equal(
    travelPlanPatchResult.body.booking.travel_plan.days[0].items[0].financial_coverage_status,
    "partially_covered"
  );
  assert.equal(
    travelPlanPatchResult.body.booking.travel_plan.days[0].items[1].financial_coverage_status,
    "covered"
  );
  assert.equal(
    travelPlanPatchResult.body.booking.travel_plan.days[0].items[2].financial_coverage_status,
    "not_applicable"
  );

  const detailAfter = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailAfter.status, 200);
  assert.equal(detailAfter.body.booking.travel_plan.days[0].title, "Arrival");
  assert.equal(
    detailAfter.body.booking.travel_plan.days[0].items[0].financial_coverage_status,
    "partially_covered"
  );
  assert.equal(detailAfter.body.booking.travel_plan.days[0].items[0].time_point, "19:00");

  const activitiesAfter = await requestJson(
    endpointPath("booking_activities").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(activitiesAfter.status, 200);
  assert.ok(
    activitiesAfter.body.activities.some((activity) => activity.type === "TRAVEL_PLAN_UPDATED"),
    "Expected TRAVEL_PLAN_UPDATED activity after saving a travel plan"
  );
});

test("booking travel plan patch rejects stale revisions", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const firstPatch = await requestJson(
    endpointPath("booking_travel_plan").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: createdBooking.travel_plan_revision,
        travel_plan: {
          days: [
            {
              id: "travel_plan_day_1",
              day_number: 1,
              title: "Arrival",
              items: []
            }
          ],
          offer_component_links: []
        }
      }
    }
  );
  assert.equal(firstPatch.status, 200);

  const stalePatch = await requestJson(
    endpointPath("booking_travel_plan").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: createdBooking.travel_plan_revision,
        travel_plan: {
          days: [
            {
              id: "travel_plan_day_1",
              day_number: 1,
              title: "Arrival",
              items: []
            }
          ],
          offer_component_links: []
        }
      }
    }
  );
  assert.equal(stalePatch.status, 409);
  assert.equal(stalePatch.body.code, "BOOKING_REVISION_MISMATCH");
});

test("booking travel plan patch rejects invalid items and unknown offer links", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const missingTitleResult = await requestJson(
    endpointPath("booking_travel_plan").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: createdBooking.travel_plan_revision,
        travel_plan: {
          days: [
            {
              id: "travel_plan_day_1",
              day_number: 1,
              title: "Arrival",
              items: [
                {
                  id: "travel_plan_item_1",
                  kind: "transport",
                  title: ""
                }
              ]
            }
          ],
          offer_component_links: []
        }
      }
    }
  );
  assert.equal(missingTitleResult.status, 422);
  assert.match(String(missingTitleResult.body.error || ""), /title is required/i);

  const missingPointTimeResult = await requestJson(
    endpointPath("booking_travel_plan").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: createdBooking.travel_plan_revision,
        travel_plan: {
          days: [
            {
              id: "travel_plan_day_1",
              day_number: 1,
              title: "Arrival",
              items: [
                {
                  id: "travel_plan_item_1",
                  timing_kind: "point",
                  kind: "transport",
                  title: "Airport transfer"
                }
              ]
            }
          ],
          offer_component_links: []
        }
      }
    }
  );
  assert.equal(missingPointTimeResult.status, 422);
  assert.match(String(missingPointTimeResult.body.error || ""), /time point/i);

  const invalidLinkResult = await requestJson(
    endpointPath("booking_travel_plan").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: createdBooking.travel_plan_revision,
        travel_plan: {
          days: [
            {
              id: "travel_plan_day_1",
              day_number: 1,
              title: "Arrival",
              items: [
                {
                  id: "travel_plan_item_1",
                  kind: "transport",
                  title: "Airport transfer"
                }
              ]
            }
          ],
          offer_component_links: [
            {
              id: "travel_plan_offer_link_1",
              travel_plan_item_id: "travel_plan_item_1",
              offer_component_id: "offer_component_missing",
              coverage_type: "full"
            }
          ]
        }
      }
    }
  );
  assert.equal(invalidLinkResult.status, 422);
  assert.match(String(invalidLinkResult.body.error || ""), /unknown offer component/i);
});

test("travel plan items can be searched and imported from another booking", async () => {
  const sourceBooking = await createSeedBooking();
  const targetBooking = await createPublicBooking({
    name: "Target User",
    email: "target@example.com"
  });

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const sourceRecord = store.bookings.find((item) => item.id === sourceBooking.id);
  const targetRecord = store.bookings.find((item) => item.id === targetBooking.id);
  assert.ok(sourceRecord);
  assert.ok(targetRecord);

  sourceRecord.travel_plan = {
    days: [
      {
        id: "source_day_1",
        day_number: 1,
        date: "2026-04-01",
        title: "Arrival",
        overnight_location: "Hoi An",
        items: [
          {
            id: "source_item_1",
            timing_kind: "label",
            time_label: "Afternoon",
            kind: "accommodation",
            title: "Boutique hotel check-in",
            details: "Private transfer and riverside hotel check-in.",
            location: "Hoi An",
            financial_note: "",
            images: [
              {
                id: "source_item_image_1",
                storage_path: "/public/v1/booking-images/source/item-1.webp",
                sort_order: 0,
                is_primary: true,
                is_customer_visible: true,
                created_at: "2026-03-21T00:00:00Z"
              }
            ]
          }
        ],
        notes: ""
      }
    ],
    offer_component_links: []
  };
  targetRecord.travel_plan = {
    days: [
      {
        id: "target_day_1",
        day_number: 1,
        date: "2026-05-10",
        title: "Start",
        overnight_location: "Da Nang",
        items: [],
        notes: ""
      }
    ],
    offer_component_links: []
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const searchResult = await requestJson(
    `${endpointPath("travel_plan_item_search")}?q=boutique&item_kind=accommodation`,
    apiHeaders()
  );
  assert.equal(searchResult.status, 200);
  assert.equal(typeof searchResult.body.total, "number");
  assert.ok(Array.isArray(searchResult.body.items));
  const foundItem = searchResult.body.items.find((item) => item.source_booking_id === sourceBooking.id);
  assert.ok(foundItem, "Expected imported item to appear in search results");
  assert.equal(foundItem.item_id, "source_item_1");
  assert.equal(foundItem.item_kind, "accommodation");
  assert.equal(foundItem.thumbnail_url, "/public/v1/booking-images/source/item-1.webp");

  const importResult = await requestJson(
    endpointPath("booking_travel_plan_item_import")
      .replace("{booking_id}", targetBooking.id)
      .replace("{day_id}", "target_day_1"),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_travel_plan_revision: targetBooking.travel_plan_revision,
        source_booking_id: sourceBooking.id,
        source_item_id: "source_item_1",
        include_images: true,
        include_customer_visible_images_only: false,
        include_notes: true,
        include_translations: true,
        include_offer_links: false
      }
    }
  );
  assert.equal(importResult.status, 200);
  assert.equal(importResult.body.booking.travel_plan.days[0].items.length, 1);
  const importedItem = importResult.body.booking.travel_plan.days[0].items[0];
  assert.equal(importedItem.title, "Boutique hotel check-in");
  assert.equal(importedItem.copied_from.source_booking_id, sourceBooking.id);
  assert.equal(importedItem.copied_from.source_item_id, "source_item_1");
  assert.equal(importedItem.images.length, 1);
  assert.notEqual(importedItem.images[0].id, "source_item_image_1");
  assert.equal(importedItem.images[0].storage_path, "/public/v1/booking-images/source/item-1.webp");
});

test("travel plan item images can be reordered and deleted", async () => {
  const booking = await createSeedBooking();

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingRecord = store.bookings.find((item) => item.id === booking.id);
  assert.ok(bookingRecord);
  bookingRecord.travel_plan = {
    days: [
      {
        id: "travel_day_1",
        day_number: 1,
        date: "2026-04-02",
        title: "Arrival",
        overnight_location: "Hue",
        items: [
          {
            id: "travel_item_1",
            timing_kind: "label",
            time_label: "Morning",
            kind: "activity",
            title: "Citadel visit",
            details: "Guided walk",
            location: "Hue",
            financial_note: "",
            images: [
              {
                id: "item_image_a",
                storage_path: "/public/v1/booking-images/a.webp",
                sort_order: 0,
                is_primary: true,
                is_customer_visible: true
              },
              {
                id: "item_image_b",
                storage_path: "/public/v1/booking-images/b.webp",
                sort_order: 1,
                is_primary: false,
                is_customer_visible: true
              }
            ]
          }
        ],
        notes: ""
      }
    ],
    offer_component_links: []
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const reorderResult = await requestJson(
    endpointPath("booking_travel_plan_item_image_reorder")
      .replace("{booking_id}", booking.id)
      .replace("{day_id}", "travel_day_1")
      .replace("{item_id}", "travel_item_1"),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: booking.travel_plan_revision,
        image_ids: ["item_image_b", "item_image_a"]
      }
    }
  );
  assert.equal(reorderResult.status, 200);
  const reorderedImages = reorderResult.body.booking.travel_plan.days[0].items[0].images;
  assert.deepEqual(reorderedImages.map((image) => image.id), ["item_image_b", "item_image_a"]);
  assert.equal(reorderedImages[0].is_primary, true);
  assert.equal(reorderedImages[1].is_primary, false);

  const deleteResult = await requestJson(
    endpointPath("booking_travel_plan_item_image_delete")
      .replace("{booking_id}", booking.id)
      .replace("{day_id}", "travel_day_1")
      .replace("{item_id}", "travel_item_1")
      .replace("{image_id}", "item_image_b"),
    apiHeaders(),
    {
      method: "DELETE",
      body: {
        expected_travel_plan_revision: reorderResult.body.booking.travel_plan_revision
      }
    }
  );
  assert.equal(deleteResult.status, 200);
  const remainingImages = deleteResult.body.booking.travel_plan.days[0].items[0].images;
  assert.equal(remainingImages.length, 1);
  assert.equal(remainingImages[0].id, "item_image_a");
  assert.equal(remainingImages[0].is_primary, true);
});

test("travel plan item images can be uploaded", { skip: !HAS_MAGICK }, async () => {
  const booking = await createSeedBooking();

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingRecord = store.bookings.find((item) => item.id === booking.id);
  assert.ok(bookingRecord);
  bookingRecord.travel_plan = {
    days: [
      {
        id: "travel_day_upload_1",
        day_number: 1,
        date: "2026-04-03",
        title: "Upload day",
        overnight_location: "Hanoi",
        items: [
          {
            id: "travel_item_upload_1",
            timing_kind: "label",
            time_label: "Anytime",
            kind: "activity",
            title: "Photo item",
            details: "",
            location: "Hanoi",
            financial_note: "",
            images: []
          }
        ],
        notes: ""
      }
    ],
    offer_component_links: []
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const uploadResult = await requestJson(
    endpointPath("booking_travel_plan_item_image_upload")
      .replace("{booking_id}", booking.id)
      .replace("{day_id}", "travel_day_upload_1")
      .replace("{item_id}", "travel_item_upload_1"),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_travel_plan_revision: booking.travel_plan_revision,
        filename: "item.png",
        data_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAACYktHRAAB3YoTpAAAAAd0SU1FB+oDCgU5NQ3qg4IAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjYtMDMtMTBUMDU6NTc6NTMrMDA6MDCtMWFJAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDI2LTAzLTEwVDA1OjU3OjUzKzAwOjAw3GzZ9QAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyNi0wMy0xMFQwNTo1Nzo1MyswMDowMIt5+CoAAAAKSURBVAjXY2gAAACCAIHdQ2r0AAAAAElFTkSuQmCC"
      }
    }
  );
  assert.equal(uploadResult.status, 200);
  const uploadedImages = uploadResult.body.booking.travel_plan.days[0].items[0].images;
  assert.equal(uploadedImages.length, 1);
  assert.match(String(uploadedImages[0].storage_path || ""), /^\/public\/v1\/booking-images\//);
  assert.equal(uploadedImages[0].is_primary, true);
});

test("travel plan PDF attachments reject non-A4 uploads and append to travel-plan and generated-offer PDFs", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const travelPlanPatchResult = await requestJson(
    endpointPath("booking_travel_plan").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: createdBooking.travel_plan_revision,
        travel_plan: {
          days: [
            {
              id: "travel_plan_day_attachment_1",
              day_number: 1,
              title: "Arrival",
              overnight_location: "Hoi An",
              items: [
                {
                  id: "travel_plan_item_attachment_1",
                  timing_kind: "label",
                  time_label: "Afternoon",
                  kind: "accommodation",
                  title: "Riverside hotel check-in",
                  details: "Private transfer and hotel arrival.",
                  location: "Hoi An",
                  financial_coverage_status: "not_covered"
                }
              ]
            }
          ],
          offer_component_links: []
        }
      }
    }
  );
  assert.equal(travelPlanPatchResult.status, 200);

  const offerPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        offer: {
          ...createdBooking.offer,
          currency: createdBooking.preferred_currency,
          components: [
            {
              id: "offer_component_attachment_1",
              category: "ACCOMMODATION",
              label: "Accommodation",
              details: "Hotel room",
              quantity: 1,
              unit_amount_cents: 15000,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );
  assert.equal(offerPatchResult.status, 200);

  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: offerPatchResult.body.booking.offer_revision,
        comment: "Attachment merge check"
      }
    }
  );
  assert.equal(generateResult.status, 201);
  const generatedOffer = generateResult.body.booking.generated_offers[0];

  const travelPlanPdfPath = path.join(TEST_DATA_DIR, "generated_offers", `travel-plan-${bookingId}.pdf`);
  const generatedOfferPdfPath = path.join(TEST_DATA_DIR, "generated_offers", `${generatedOffer.id}.pdf`);

  const initialTravelPlanPdf = await requestRaw(
    endpointPath("booking_travel_plan_pdf").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(initialTravelPlanPdf.status, 200);
  const initialTravelPlanPdfDoc = await PDFLibDocument.load(await readFile(travelPlanPdfPath));
  const initialTravelPlanPageCount = initialTravelPlanPdfDoc.getPageCount();

  const initialGeneratedOfferPdf = await requestRaw(
    endpointPath("booking_generated_offer_pdf")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", generatedOffer.id),
    apiHeaders()
  );
  assert.equal(initialGeneratedOfferPdf.status, 200);
  const initialGeneratedOfferPdfDoc = await PDFLibDocument.load(await readFile(generatedOfferPdfPath));
  const initialGeneratedOfferPageCount = initialGeneratedOfferPdfDoc.getPageCount();

  const letterUploadResult = await requestJson(
    endpointPath("booking_travel_plan_attachment_upload").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_travel_plan_revision: travelPlanPatchResult.body.booking.travel_plan_revision,
        filename: "letter-appendix.pdf",
        mime_type: "application/pdf",
        data_base64: await createPdfBase64([[612, 792]])
      }
    }
  );
  assert.equal(letterUploadResult.status, 422);
  assert.match(String(letterUploadResult.body.error || ""), /A4 page layout/i);

  const uploadResult = await requestJson(
    endpointPath("booking_travel_plan_attachment_upload").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_travel_plan_revision: travelPlanPatchResult.body.booking.travel_plan_revision,
        filename: "appendix-a4.pdf",
        mime_type: "application/pdf",
        data_base64: await createPdfBase64WithText([[595.275591, 841.889764]])
      }
    }
  );
  assert.equal(uploadResult.status, 200);
  assert.equal(uploadResult.body.booking.travel_plan.attachments.length, 1);
  assert.equal(uploadResult.body.booking.travel_plan.attachments[0].page_count, 1);

  const mergedTravelPlanPdf = await requestRaw(
    endpointPath("booking_travel_plan_pdf").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(mergedTravelPlanPdf.status, 200);
  const mergedTravelPlanPdfDoc = await PDFLibDocument.load(await readFile(travelPlanPdfPath));
  assert.equal(mergedTravelPlanPdfDoc.getPageCount(), initialTravelPlanPageCount + 1);

  const mergedGeneratedOfferPdf = await requestRaw(
    endpointPath("booking_generated_offer_pdf")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", generatedOffer.id),
    apiHeaders()
  );
  assert.equal(mergedGeneratedOfferPdf.status, 200);
  const mergedGeneratedOfferPdfDoc = await PDFLibDocument.load(await readFile(generatedOfferPdfPath));
  assert.equal(mergedGeneratedOfferPdfDoc.getPageCount(), initialGeneratedOfferPageCount + 1);
});

test("suppliers can be created and updated, and travel plan supplier references are validated", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const createSupplierResult = await requestJson(
    endpointPath("supplier_create"),
    apiHeaders(),
    {
      method: "POST",
      body: {
        name: "Hoi An Riverside Hotel",
        contact: "Lan Nguyen",
        emergency_phone: "+84 123456789",
        email: "ops@riverside.example",
        country: "Vietnam",
        category: "hotel"
      }
    }
  );
  assert.equal(createSupplierResult.status, 201);
  const supplierId = createSupplierResult.body.supplier.id;
  assert.equal(createSupplierResult.body.supplier.name, "Hoi An Riverside Hotel");
  assert.equal(createSupplierResult.body.supplier.category, "hotel");

  const listSuppliersResult = await requestJson(
    endpointPath("suppliers"),
    apiHeaders()
  );
  assert.equal(listSuppliersResult.status, 200);
  assert.equal(listSuppliersResult.body.total, 1);
  assert.equal(listSuppliersResult.body.items[0].id, supplierId);

  const patchSupplierResult = await requestJson(
    endpointPath("supplier_update").replace("{supplier_id}", supplierId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        email: "operations@riverside.example",
        emergency_phone: "+84 987654321"
      }
    }
  );
  assert.equal(patchSupplierResult.status, 200);
  assert.equal(patchSupplierResult.body.supplier.email, "operations@riverside.example");
  assert.equal(patchSupplierResult.body.supplier.emergency_phone, "+84 987654321");

  const validTravelPlanPatchResult = await requestJson(
    endpointPath("booking_travel_plan").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: createdBooking.travel_plan_revision,
        travel_plan: {
          days: [
            {
              id: "travel_plan_day_1",
              day_number: 1,
              title: "Arrival",
              items: [
                {
                  id: "travel_plan_item_1",
                  kind: "accommodation",
                  title: "Hotel check-in",
                  supplier_id: supplierId
                }
              ]
            }
          ],
          offer_component_links: []
        }
      }
    }
  );
  assert.equal(validTravelPlanPatchResult.status, 200);
  assert.equal(
    validTravelPlanPatchResult.body.booking.travel_plan.days[0].items[0].supplier_id,
    supplierId
  );

  const invalidTravelPlanPatchResult = await requestJson(
    endpointPath("booking_travel_plan").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: validTravelPlanPatchResult.body.booking.travel_plan_revision,
        travel_plan: {
          days: [
            {
              id: "travel_plan_day_1",
              day_number: 1,
              title: "Arrival",
              items: [
                {
                  id: "travel_plan_item_1",
                  kind: "accommodation",
                  title: "Hotel check-in",
                  supplier_id: "supplier_missing"
                }
              ]
            }
          ],
          offer_component_links: []
        }
      }
    }
  );
  assert.equal(invalidTravelPlanPatchResult.status, 422);
  assert.match(String(invalidTravelPlanPatchResult.body.error || ""), /unknown supplier/i);
});

test("booking generated offers store immutable snapshots", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const offerPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        offer: {
          ...createdBooking.offer,
          currency: createdBooking.preferred_currency,
          components: [
            {
              id: "offer_component_room_1",
              category: "ACCOMMODATION",
              label: "Accommodation",
              details: "Hotel room",
              quantity: 2,
              unit_amount_cents: 15000,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );
  assert.equal(offerPatchResult.status, 200);

  const travelPlanPatchResult = await requestJson(
    endpointPath("booking_travel_plan").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: createdBooking.travel_plan_revision,
        travel_plan: {
          days: [
            {
              id: "travel_plan_day_1",
              day_number: 1,
              date: "2026-04-10",
              title: "Arrival in Hoi An",
              overnight_location: "Hoi An",
              items: [
                {
                  id: "travel_plan_item_1",
                  timing_kind: "point",
                  time_point: "2026-04-10T19:00",
                  kind: "transport",
                  title: "Airport transfer",
                  details: "Private transfer from Da Nang airport to the hotel in Hoi An."
                },
                {
                  id: "travel_plan_item_2",
                  timing_kind: "label",
                  time_label: "Evening",
                  kind: "accommodation",
                  title: "Hotel check-in",
                  location: "Hoi An"
                }
              ]
            }
          ],
          offer_component_links: [
            {
              id: "travel_plan_offer_link_1",
              travel_plan_item_id: "travel_plan_item_2",
              offer_component_id: "offer_component_room_1",
              coverage_type: "full"
            }
          ]
        }
      }
    }
  );
  assert.equal(travelPlanPatchResult.status, 200);

  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: offerPatchResult.body.booking.offer_revision,
        comment: "First customer offer"
      }
    }
  );
  assert.equal(generateResult.status, 201);
  assert.ok(Array.isArray(generateResult.body.booking.generated_offers));
  assert.equal(generateResult.body.booking.generated_offers.length, 1);
  const generatedOffer = generateResult.body.booking.generated_offers[0];
  assert.equal(generatedOffer.comment, "First customer offer");
  assert.equal(generatedOffer.version, 1);
  assert.equal(generatedOffer.offer.components.length, 1);
  assert.equal(generatedOffer.offer.components[0].details, "Hotel room");
  assert.equal(generatedOffer.travel_plan.days.length, 1);
  assert.equal(generatedOffer.travel_plan.days[0].title, "Arrival in Hoi An");
  assert.equal(generatedOffer.travel_plan.days[0].items[0].title, "Airport transfer");
  assert.match(generatedOffer.filename, /^ATP offer \d{4}-\d{2}-\d{2}\.pdf$/);
  assert.equal(typeof generatedOffer.pdf_url, "string");
  assert.equal("pdf_frozen_at" in generatedOffer, false);
  assert.equal("pdf_sha256" in generatedOffer, false);

  const secondOfferPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: generateResult.body.booking.offer_revision,
        offer: {
          ...generateResult.body.booking.offer,
          components: [
            {
              id: "offer_component_room_1",
              category: "ACCOMMODATION",
              label: "Accommodation",
              details: "Updated hotel room",
              quantity: 3,
              unit_amount_cents: 18000,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );
  assert.equal(secondOfferPatchResult.status, 200);

  const secondTravelPlanPatchResult = await requestJson(
    endpointPath("booking_travel_plan").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: travelPlanPatchResult.body.booking.travel_plan_revision,
        travel_plan: {
          days: [
            {
              id: "travel_plan_day_1",
              day_number: 1,
              date: "2026-04-10",
              title: "Updated arrival plan",
              overnight_location: "Hoi An",
              items: [
                {
                  id: "travel_plan_item_1",
                  timing_kind: "point",
                  time_point: "2026-04-10T20:00",
                  kind: "transport",
                  title: "Updated airport transfer"
                }
              ]
            }
          ],
          offer_component_links: []
        }
      }
    }
  );
  assert.equal(secondTravelPlanPatchResult.status, 200);

  const detailAfter = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailAfter.status, 200);
  assert.equal(detailAfter.body.booking.generated_offers.length, 1);
  assert.equal(detailAfter.body.booking.generated_offers[0].offer.components[0].details, "Hotel room");
  assert.equal(detailAfter.body.booking.generated_offers[0].travel_plan.days[0].title, "Arrival in Hoi An");
  assert.equal(detailAfter.body.booking.generated_offers[0].travel_plan.days[0].items[0].title, "Airport transfer");
  assert.equal(detailAfter.body.booking.offer.components[0].details, "Updated hotel room");
  assert.equal(detailAfter.body.booking.travel_plan.days[0].title, "Updated arrival plan");
  assert.equal(detailAfter.body.booking.travel_plan.days[0].items[0].title, "Updated airport transfer");
});

test("booking detail normalizes generated-offer travel plan snapshots against the frozen offer snapshot", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const offerPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        offer: {
          ...createdBooking.offer,
          currency: createdBooking.preferred_currency,
          components: [
            {
              id: "offer_component_room_1",
              category: "ACCOMMODATION",
              label: "Accommodation",
              details: "Hotel room",
              quantity: 1,
              unit_amount_cents: 12000,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );
  assert.equal(offerPatchResult.status, 200);

  const travelPlanPatchResult = await requestJson(
    endpointPath("booking_travel_plan").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: createdBooking.travel_plan_revision,
        travel_plan: {
          days: [
            {
              id: "travel_plan_day_1",
              day_number: 1,
              title: "Arrival",
              items: [
                {
                  id: "travel_plan_item_1",
                  kind: "accommodation",
                  title: "Hotel check-in"
                }
              ]
            }
          ],
          offer_component_links: [
            {
              id: "travel_plan_offer_link_1",
              travel_plan_item_id: "travel_plan_item_1",
              offer_component_id: "offer_component_room_1",
              coverage_type: "full"
            }
          ]
        }
      }
    }
  );
  assert.equal(travelPlanPatchResult.status, 200);

  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: offerPatchResult.body.booking.offer_revision,
        comment: "Snapshot coverage check"
      }
    }
  );
  assert.equal(generateResult.status, 201);
  const generatedOfferId = generateResult.body.booking.generated_offers[0].id;

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingRecord = store.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingRecord);
  const generatedOfferRecord = bookingRecord.generated_offers.find((item) => item.id === generatedOfferId);
  assert.ok(generatedOfferRecord);
  assert.equal(Object.prototype.hasOwnProperty.call(generatedOfferRecord, "payment_terms"), false);
  delete generatedOfferRecord.travel_plan.days[0].items[0].financial_coverage_status;
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const detailResult = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailResult.status, 200);
  assert.equal(
    detailResult.body.booking.generated_offers[0].travel_plan.days[0].items[0].financial_coverage_status,
    "covered"
  );
});

test("contract metadata exposes the generated offer gmail draft endpoint", async () => {
  assert.equal(
    endpointPath("booking_generated_offer_gmail_draft"),
    "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/gmail-draft"
  );
});

test("contract metadata exposes the public generated offer acceptance endpoint", async () => {
  assert.equal(
    endpointPath("public_generated_offer_accept"),
    "/public/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/accept"
  );
});

test("contract metadata exposes the public generated offer access endpoints", async () => {
  assert.equal(
    endpointPath("public_generated_offer_access"),
    "/public/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/access"
  );
  assert.equal(
    endpointPath("public_generated_offer_pdf"),
    "/public/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/pdf"
  );
});

test("contract metadata exposes the booking travel plan pdf endpoint", async () => {
  assert.equal(
    endpointPath("booking_travel_plan_pdf"),
    "/api/v1/bookings/{booking_id}/travel-plan/pdf"
  );
});

test("booking travel plan pdf endpoint returns itinerary content without travelers, offers, or internal financial notes", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingRecord = store.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingRecord);

  bookingRecord.persons = [{
    ...(Array.isArray(bookingRecord.persons) && bookingRecord.persons[0] ? bookingRecord.persons[0] : {}),
    id: "booking_person_pdf_marker",
    name: "PersonMarker731",
    roles: ["traveler"]
  }];
  bookingRecord.offer = {
    ...(bookingRecord.offer || {}),
    currency: bookingRecord.preferred_currency || "USD",
    components: [{
      id: "offer_component_pdf_marker",
      category: "TRANSPORTATION",
      label: "OfferMarker731",
      details: "OfferMarker731",
      quantity: 1,
      unit_amount_cents: 12345,
      tax_rate_basis_points: 1000,
      currency: bookingRecord.preferred_currency || "USD",
      notes: null,
      sort_order: 0
    }]
  };
  bookingRecord.travel_plan = {
    days: [{
      id: "travel_plan_day_pdf_marker",
      day_number: 1,
      date: "2026-03-20",
      title: "PublicDayMarker731",
      notes: "PublicDayNote731",
      overnight_location: "Hoi An",
      items: [{
        id: "travel_plan_item_pdf_marker",
        timing_kind: "point",
        time_point: "2026-03-20T14:00",
        kind: "activity",
        title: "PublicItemMarker731",
        location: "Hoi An",
        details: "PublicDetailsMarker731",
        financial_note: "FinanceMarker731",
        images: []
      }]
    }],
    offer_component_links: []
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const pdfResult = await requestRaw(
    `${endpointPath("booking_travel_plan_pdf").replace("{booking_id}", bookingId)}?lang=en`,
    apiHeaders()
  );
  assert.equal(pdfResult.status, 200);
  assert.equal(pdfResult.headers["content-type"], "application/pdf");
  assert.match(String(pdfResult.headers["content-disposition"] || ""), /ATP travel plan .*\.pdf/);
  assert.match(pdfResult.body, /%PDF-/);
  const decodedText = normalizeExtractedPdfText(decodePdfHexText(pdfResult.body));
  assert.match(decodedText, /PublicDayMarker731/);
  assert.match(decodedText, /PublicDayNote731/);
  assert.match(decodedText, /PublicItemMarker731/);
  assert.match(decodedText, /PublicDetailsMarker731/);
  assert.match(decodedText, /Wewouldbehappytohearfromyou\./);
  assert.doesNotMatch(decodedText, /PersonMarker731/);
  assert.doesNotMatch(decodedText, /OfferMarker731/);
  assert.doesNotMatch(decodedText, /FinanceMarker731/);
  assert.doesNotMatch(decodedText, /Preparedforyourrequesteditineraryin/);
  assert.doesNotMatch(decodedText, /Whoistraveling/);
});

test("booking travel plan pdf includes the assigned ATP guide section with relevant experience", async () => {
  const createdBooking = await createSeedBooking({
    destinations: ["Vietnam", "Laos"],
    travel_style: ["Wellness", "Culture"]
  });
  const bookingId = createdBooking.id;

  const detailBefore = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailBefore.status, 200);

  const assignResult = await requestJson(
    endpointPath("booking_owner").replace("{booking_id}", bookingId),
    apiHeaders("atp_admin", "admin", "kc-admin"),
    {
      method: "PATCH",
      body: {
        expected_core_revision: detailBefore.body.booking.core_revision,
        assigned_keycloak_user_id: "kc-joachim",
        actor: "admin"
      }
    }
  );
  assert.equal(assignResult.status, 200);

  const pdfResult = await requestRaw(
    `${endpointPath("booking_travel_plan_pdf").replace("{booking_id}", bookingId)}?lang=en`,
    apiHeaders()
  );
  assert.equal(pdfResult.status, 200);
  const decodedText = normalizeExtractedPdfText(decodePdfHexText(pdfResult.body));
  assert.match(decodedText, /YourATPguide/);
  assert.match(decodedText, /JoachimNeumann/);
  assert.match(decodedText, /Languages:DE·EN·VI|Languages:DEENVI/);
  assert.match(decodedText, /CentralVietnamwellnesspacing|GentleCambodiaandLaosjourneys|Cross-borderhandoverplanning/);
});

test("booking generated offer pdf endpoint returns a pdf file", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const offerPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        offer: {
          ...createdBooking.offer,
          currency: createdBooking.preferred_currency,
          components: [
            {
              id: "offer_component_transfer_1",
              category: "TRANSPORTATION",
              label: "Transportation",
              details: "Airport transfer",
              quantity: 1,
              unit_amount_cents: 2500,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );
  assert.equal(offerPatchResult.status, 200);

  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: offerPatchResult.body.booking.offer_revision,
        comment: "PDF generation check"
      }
    }
  );
  assert.equal(generateResult.status, 201);
  const generatedOffer = generateResult.body.booking.generated_offers[0];

  const pdfResult = await requestRaw(
    endpointPath("booking_generated_offer_pdf")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", generatedOffer.id),
    apiHeaders()
  );
  assert.equal(pdfResult.status, 200);
  assert.equal(pdfResult.headers["content-type"], "application/pdf");
  assert.match(String(pdfResult.headers["content-disposition"] || ""), /ATP offer \d{4}-\d{2}-\d{2}\.pdf/);
  assert.match(pdfResult.body, /%PDF-/);
});

test("booking generated offer pdf wiring includes the assigned ATP guide section", async () => {
  const createdBooking = await createSeedBooking({
    destinations: ["Thailand"],
    travel_style: ["Wellness", "Beach"]
  });
  const bookingId = createdBooking.id;

  const detailBefore = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailBefore.status, 200);

  const assignResult = await requestJson(
    endpointPath("booking_owner").replace("{booking_id}", bookingId),
    apiHeaders("atp_admin", "admin", "kc-admin"),
    {
      method: "PATCH",
      body: {
        expected_core_revision: detailBefore.body.booking.core_revision,
        assigned_keycloak_user_id: "kc-staff",
        actor: "admin"
      }
    }
  );
  assert.equal(assignResult.status, 200);
  assert.equal(assignResult.body.booking.assigned_atp_staff.username, "staff");

  const offerPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: assignResult.body.booking.offer_revision,
        offer: {
          ...assignResult.body.booking.offer,
          currency: assignResult.body.booking.preferred_currency,
          components: [
            {
              id: "offer_component_wellness_pdf_marker",
              category: "ACTIVITIES",
              label: "WellnessMarker",
              details: "SpaMarker",
              quantity: 1,
              unit_amount_cents: 25000,
              tax_rate_basis_points: 1000,
              currency: assignResult.body.booking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );
  assert.equal(offerPatchResult.status, 200);

  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: offerPatchResult.body.booking.offer_revision,
        comment: "Guide PDF section check"
      }
    }
  );
  assert.equal(generateResult.status, 201);
  assert.equal(generateResult.body.booking.assigned_atp_staff.username, "staff");
  const generatedOffer = generateResult.body.booking.generated_offers[0];

  const pdfResult = await requestRaw(
    endpointPath("booking_generated_offer_pdf")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", generatedOffer.id),
    apiHeaders()
  );
  assert.equal(pdfResult.status, 200);
  assert.equal(pdfResult.headers["content-type"], "application/pdf");
  assert.match(String(pdfResult.headers["content-disposition"] || ""), /ATP offer \d{4}-\d{2}-\d{2}\.pdf/);
  const source = await readFile(path.join(__dirname, "..", "src", "lib", "offer_pdf.js"), "utf8");
  assert.match(source, /resolveAtpGuidePdfContext/);
  assert.match(source, /drawGuideSection\(doc, y, fonts, lang, guideContext, guidePhoto\)/);
});

test("booking generated offer pdf endpoint serves the frozen artifact without re-rendering", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const offerPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        offer: {
          ...createdBooking.offer,
          currency: createdBooking.preferred_currency,
          components: [
            {
              id: "offer_component_transfer_1",
              category: "TRANSPORTATION",
              label: "Transportation",
              details: "Airport transfer",
              quantity: 1,
              unit_amount_cents: 2500,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );
  assert.equal(offerPatchResult.status, 200);

  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: offerPatchResult.body.booking.offer_revision,
        comment: "Frozen PDF check"
      }
    }
  );
  assert.equal(generateResult.status, 201);
  const generatedOffer = generateResult.body.booking.generated_offers[0];
  const pdfPath = path.join(TEST_DATA_DIR, "generated_offers", `${generatedOffer.id}.pdf`);
  const initialStats = await stat(pdfPath);

  await new Promise((resolve) => setTimeout(resolve, 25));

  const secondOfferPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: generateResult.body.booking.offer_revision,
        offer: {
          ...generateResult.body.booking.offer,
          components: [
            {
              id: "offer_component_transfer_1",
              category: "TRANSPORTATION",
              label: "Transportation",
              details: "Updated airport transfer",
              quantity: 2,
              unit_amount_cents: 4200,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );
  assert.equal(secondOfferPatchResult.status, 200);

  const pdfResult = await requestRaw(
    endpointPath("booking_generated_offer_pdf")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", generatedOffer.id),
    apiHeaders()
  );
  assert.equal(pdfResult.status, 200);
  assert.equal(pdfResult.headers["content-type"], "application/pdf");

  const finalStats = await stat(pdfPath);
  assert.equal(finalStats.mtimeMs, initialStats.mtimeMs);
  assert.equal(finalStats.size, initialStats.size);
});

test("booking generated offers support comment update and delete", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const offerPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        offer: {
          ...createdBooking.offer,
          currency: createdBooking.preferred_currency,
          components: [
            {
              id: "offer_component_daytrip_1",
              category: "ACTIVITY",
              label: "Activity",
              details: "Day trip",
              quantity: 1,
              unit_amount_cents: 5000,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );
  assert.equal(offerPatchResult.status, 200);

  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: offerPatchResult.body.booking.offer_revision,
        comment: "Initial note"
      }
    }
  );
  assert.equal(generateResult.status, 201);
  const generatedOffer = generateResult.body.booking.generated_offers[0];

  const updateResult = await requestJson(
    endpointPath("booking_generated_offer_update")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", generatedOffer.id),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: generateResult.body.booking.offer_revision,
        comment: "Updated note"
      }
    }
  );
  assert.equal(updateResult.status, 200);
  assert.equal(updateResult.body.booking.generated_offers[0].comment, "Updated note");

  const deleteResult = await requestJson(
    endpointPath("booking_generated_offer_delete")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", generatedOffer.id),
    apiHeaders(),
    {
      method: "DELETE",
      body: {
        expected_offer_revision: updateResult.body.booking.offer_revision
      }
    }
  );
  assert.equal(deleteResult.status, 200);
  assert.equal(deleteResult.body.booking.generated_offers.length, 0);
});

test("public generated offer acceptance finalizes the frozen offer and stores the booking pointer", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const offerPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        offer: {
          ...createdBooking.offer,
          currency: createdBooking.preferred_currency,
          payment_terms: {
            currency: createdBooking.preferred_currency,
            lines: [
              {
                id: "payment_term_acceptance_deposit",
                kind: "DEPOSIT",
                label: "Deposit",
                sequence: 1,
                amount_spec: {
                  mode: "FIXED_AMOUNT",
                  fixed_amount_cents: 3300
                },
                due_rule: {
                  type: "ON_ACCEPTANCE"
                }
              },
              {
                id: "payment_term_acceptance_final",
                kind: "FINAL_BALANCE",
                label: "Final payment",
                sequence: 2,
                amount_spec: {
                  mode: "REMAINING_BALANCE"
                },
                due_rule: {
                  type: "DAYS_AFTER_ACCEPTANCE",
                  days: 14
                }
              }
            ]
          },
          components: [
            {
              id: "offer_component_acceptance_1",
              category: "ACCOMMODATION",
              label: "Accommodation",
              details: "Accepted hotel room",
              quantity: 1,
              unit_amount_cents: 12000,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );
  assert.equal(offerPatchResult.status, 200);

  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: offerPatchResult.body.booking.offer_revision,
        comment: "Acceptance flow offer"
      }
    }
  );
  assert.equal(generateResult.status, 201);
  const generatedOffer = generateResult.body.booking.generated_offers[0];
  const generatedOfferId = generatedOffer.id;
  assert.equal(typeof generatedOffer.public_acceptance_token, "string");
  assert.ok(generatedOffer.public_acceptance_token.length > 20);

  const otpRequiredResult = await requestJson(
    endpointPath("public_generated_offer_accept")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", generatedOfferId),
    {},
    {
      method: "POST",
      body: {
        acceptance_token: generatedOffer.public_acceptance_token,
        accepted_by_name: "Test User",
        language: "en"
      }
    }
  );
  assert.equal(otpRequiredResult.status, 422);
  assert.match(String(otpRequiredResult.body.error || ""), /requires otp verification/i);

  const storeBeforeLegacyAccept = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingBeforeLegacyAccept = storeBeforeLegacyAccept.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingBeforeLegacyAccept);
  delete bookingBeforeLegacyAccept.generated_offers[0].acceptance_route;
  await writeFile(STORE_PATH, `${JSON.stringify(storeBeforeLegacyAccept, null, 2)}\n`, "utf8");

  const acceptResult = await requestJson(
    endpointPath("public_generated_offer_accept")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", generatedOfferId),
    {},
    {
      method: "POST",
      body: {
        acceptance_token: generatedOffer.public_acceptance_token,
        accepted_by_name: "Test User",
        language: "en"
      }
    }
  );
  assert.equal(acceptResult.status, 200);
  assert.equal(acceptResult.body.accepted, true);
  assert.equal(acceptResult.body.status, "ACCEPTED");
  assert.equal(acceptResult.body.acceptance.method, "PORTAL_CLICK");
  assert.equal(typeof acceptResult.body.acceptance.accepted_by_name, "undefined");
  assert.equal(typeof acceptResult.body.acceptance.accepted_by_email, "undefined");
  assert.equal(typeof acceptResult.body.acceptance.offer_pdf_sha256, "undefined");
  assert.equal(typeof acceptResult.body.acceptance.offer_snapshot_sha256, "undefined");

  const detailResult = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailResult.status, 200);
  assert.equal(detailResult.body.booking.accepted_generated_offer_id, generatedOfferId);
  assert.equal(detailResult.body.booking.generated_offers[0].acceptance.method, "PORTAL_CLICK");
  assert.equal(detailResult.body.booking.generated_offers[0].acceptance.accepted_by_name, "Test User");
  assert.equal(detailResult.body.booking.generated_offers[0].acceptance.accepted_by_email, "test@example.com");
  assert.equal(detailResult.body.booking.generated_offers[0].acceptance.offer_pdf_sha256.length, 64);
  assert.equal(detailResult.body.booking.generated_offers[0].acceptance.offer_snapshot_sha256.length, 64);
  const acceptedDateOnly = detailResult.body.booking.generated_offers[0].acceptance.accepted_at.slice(0, 10);
  const finalDueDate = new Date(`${acceptedDateOnly}T00:00:00.000Z`);
  finalDueDate.setUTCDate(finalDueDate.getUTCDate() + 14);
  assert.equal(detailResult.body.booking.pricing_revision, 1);
  assert.equal(detailResult.body.booking.pricing.agreed_net_amount_cents, 13200);
  assert.equal(detailResult.body.booking.pricing.payments.length, 2);
  assert.equal(detailResult.body.booking.pricing.payments[0].label, "Deposit");
  assert.equal(detailResult.body.booking.pricing.payments[0].due_date, acceptedDateOnly);
  assert.equal(detailResult.body.booking.pricing.payments[0].net_amount_cents, 3300);
  assert.equal(detailResult.body.booking.pricing.payments[0].status, "PENDING");
  assert.equal(detailResult.body.booking.pricing.payments[1].label, "Final payment");
  assert.equal(detailResult.body.booking.pricing.payments[1].due_date, finalDueDate.toISOString().slice(0, 10));
  assert.equal(detailResult.body.booking.pricing.payments[1].net_amount_cents, 9900);
  assert.equal(detailResult.body.booking.pricing.payments[1].status, "PENDING");

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingRecord = store.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingRecord);
  assert.equal(bookingRecord.accepted_generated_offer_id, generatedOfferId);
  assert.equal(bookingRecord.generated_offers[0].acceptance.accepted_by_name, "Test User");
  assert.equal(bookingRecord.pricing.payments.length, 2);
});

test("public generated offer acceptance enforces uniqueness per booking", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const firstOfferPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        offer: {
          ...createdBooking.offer,
          currency: createdBooking.preferred_currency,
          components: [
            {
              id: "offer_component_acceptance_first",
              category: "ACCOMMODATION",
              label: "Accommodation",
              details: "First offer room",
              quantity: 1,
              unit_amount_cents: 10000,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );
  assert.equal(firstOfferPatchResult.status, 200);

  const firstGenerateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: firstOfferPatchResult.body.booking.offer_revision,
        comment: "First offer"
      }
    }
  );
  assert.equal(firstGenerateResult.status, 201);
  const firstGeneratedOffer = firstGenerateResult.body.booking.generated_offers[0];
  const firstGeneratedOfferId = firstGeneratedOffer.id;
  assert.equal(typeof firstGeneratedOffer.public_acceptance_token, "string");

  const secondOfferPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: firstGenerateResult.body.booking.offer_revision,
        offer: {
          ...firstGenerateResult.body.booking.offer,
          components: [
            {
              id: "offer_component_acceptance_second",
              category: "TRANSPORTATION",
              label: "Transportation",
              details: "Second offer transfer",
              quantity: 1,
              unit_amount_cents: 18000,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );
  assert.equal(secondOfferPatchResult.status, 200);

  const secondGenerateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: secondOfferPatchResult.body.booking.offer_revision,
        comment: "Second offer"
      }
    }
  );
  assert.equal(secondGenerateResult.status, 201);
  assert.equal(secondGenerateResult.body.booking.generated_offers.length, 2);
  const secondGeneratedOffer = secondGenerateResult.body.booking.generated_offers[1];
  const secondGeneratedOfferId = secondGeneratedOffer.id;
  assert.equal(typeof secondGeneratedOffer.public_acceptance_token, "string");

  const storeBeforeLegacyUniqueness = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingBeforeLegacyUniqueness = storeBeforeLegacyUniqueness.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingBeforeLegacyUniqueness);
  delete bookingBeforeLegacyUniqueness.generated_offers[0].acceptance_route;
  delete bookingBeforeLegacyUniqueness.generated_offers[1].acceptance_route;
  await writeFile(STORE_PATH, `${JSON.stringify(storeBeforeLegacyUniqueness, null, 2)}\n`, "utf8");

  const firstAcceptResult = await requestJson(
    endpointPath("public_generated_offer_accept")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", firstGeneratedOfferId),
    {},
    {
      method: "POST",
      body: {
        acceptance_token: firstGeneratedOffer.public_acceptance_token,
        accepted_by_name: "Test User"
      }
    }
  );
  assert.equal(firstAcceptResult.status, 200);
  assert.equal(firstAcceptResult.body.accepted, true);

  const secondAcceptResult = await requestJson(
    endpointPath("public_generated_offer_accept")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", secondGeneratedOfferId),
    {},
    {
      method: "POST",
      body: {
        acceptance_token: secondGeneratedOffer.public_acceptance_token,
        accepted_by_name: "Test User"
      }
    }
  );
  assert.equal(secondAcceptResult.status, 409);
  assert.match(String(secondAcceptResult.body.error || ""), /already been accepted/i);
});

test("generated offer creation persists deposit-payment acceptance routes in authenticated read models", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const detailBefore = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailBefore.status, 200);

  const offerPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: detailBefore.body.booking.offer_revision,
        offer: {
          ...detailBefore.body.booking.offer,
          currency: createdBooking.preferred_currency,
          payment_terms: {
            currency: createdBooking.preferred_currency,
            basis_total_amount_cents: detailBefore.body.booking.offer.total_price_cents || 0,
            lines: [
              {
                id: "payment_term_deposit_acceptance",
                kind: "DEPOSIT",
                label: "Deposit",
                sequence: 1,
                amount_spec: {
                  mode: "PERCENTAGE_OF_OFFER_TOTAL",
                  percentage_basis_points: 3000
                },
                due_rule: {
                  type: "ON_ACCEPTANCE"
                }
              },
              {
                id: "payment_term_final_acceptance",
                kind: "FINAL_BALANCE",
                label: "Final payment",
                sequence: 2,
                amount_spec: {
                  mode: "REMAINING_BALANCE"
                },
                due_rule: {
                  type: "DAYS_BEFORE_TRIP_START",
                  days: 7
                }
              }
            ]
          },
          components: [
            {
              id: "offer_component_acceptance_route_1",
              category: "ACCOMMODATION",
              label: "Accommodation",
              details: "Deposit acceptance route room",
              quantity: 1,
              unit_amount_cents: 15000,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );
  assert.equal(offerPatchResult.status, 200);

  const depositLine = offerPatchResult.body.booking.offer.payment_terms.lines[0];
  assert.equal(depositLine.kind, "DEPOSIT");

  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: offerPatchResult.body.booking.offer_revision,
        comment: "Deposit acceptance route",
        acceptance_route: {
          mode: "DEPOSIT_PAYMENT",
          deposit_rule: {
            payment_term_line_id: depositLine.id
          }
        }
      }
    }
  );
  assert.equal(generateResult.status, 201);
  const generatedOffer = generateResult.body.booking.generated_offers[0];
  assert.equal(generatedOffer.acceptance_route.mode, "DEPOSIT_PAYMENT");
  assert.equal(generatedOffer.acceptance_route.status, "AWAITING_PAYMENT");
  assert.equal(generatedOffer.acceptance_route.deposit_rule.payment_term_line_id, depositLine.id);
  assert.equal(generatedOffer.acceptance_route.deposit_rule.payment_term_label, depositLine.label);
  assert.equal(generatedOffer.acceptance_route.deposit_rule.required_amount_cents, depositLine.resolved_amount_cents);
  assert.equal(generatedOffer.acceptance_route.deposit_rule.currency, createdBooking.preferred_currency);
  assert.equal(generatedOffer.payment_terms.lines.length, 2);
  assert.equal(typeof generatedOffer.public_acceptance_token, "string");

  const detailAfter = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailAfter.status, 200);
  assert.equal(detailAfter.body.booking.generated_offers[0].acceptance_route.mode, "DEPOSIT_PAYMENT");
  assert.equal(detailAfter.body.booking.generated_offers[0].acceptance_route.status, "AWAITING_PAYMENT");
  assert.equal(
    detailAfter.body.booking.generated_offers[0].acceptance_route.deposit_rule.payment_term_line_id,
    depositLine.id
  );
});

test("booking detail persists expired generated-offer route status instead of deriving it in the read model", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        comment: "Expiry status persistence"
      }
    }
  );
  assert.equal(generateResult.status, 201);
  const generatedOfferId = generateResult.body.booking.generated_offers[0].id;

  const storeBefore = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingBefore = storeBefore.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingBefore);
  const generatedOfferBefore = bookingBefore.generated_offers.find((item) => item.id === generatedOfferId);
  assert.ok(generatedOfferBefore?.acceptance_route);
  generatedOfferBefore.acceptance_route.status = "OPEN";
  generatedOfferBefore.acceptance_route.expires_at = "2020-01-01T00:00:00.000Z";
  await writeFile(STORE_PATH, `${JSON.stringify(storeBefore, null, 2)}\n`, "utf8");

  const detailResult = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailResult.status, 200);
  assert.equal(detailResult.body.booking.generated_offers[0].acceptance_route.status, "EXPIRED");

  const storeAfter = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingAfter = storeAfter.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingAfter);
  const generatedOfferAfter = bookingAfter.generated_offers.find((item) => item.id === generatedOfferId);
  assert.equal(generatedOfferAfter?.acceptance_route?.status, "EXPIRED");
});

test("booking detail repairs missing OTP acceptance token state for generated offers", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        comment: "OTP token repair"
      }
    }
  );
  assert.equal(generateResult.status, 201);
  const generatedOfferId = generateResult.body.booking.generated_offers[0].id;
  assert.equal(generateResult.body.booking.generated_offers[0].acceptance_route.mode, "OTP");
  assert.equal(typeof generateResult.body.booking.generated_offers[0].public_acceptance_token, "string");

  const storeBefore = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingBefore = storeBefore.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingBefore);
  const generatedOfferBefore = bookingBefore.generated_offers.find((item) => item.id === generatedOfferId);
  assert.ok(generatedOfferBefore);
  delete generatedOfferBefore.acceptance_token_nonce;
  delete generatedOfferBefore.acceptance_token_created_at;
  delete generatedOfferBefore.acceptance_token_expires_at;
  await writeFile(STORE_PATH, `${JSON.stringify(storeBefore, null, 2)}\n`, "utf8");

  const detailResult = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailResult.status, 200);
  assert.equal(typeof detailResult.body.booking.generated_offers[0].public_acceptance_token, "string");
  assert.ok(detailResult.body.booking.generated_offers[0].public_acceptance_token.length > 20);

  const storeAfter = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingAfter = storeAfter.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingAfter);
  const generatedOfferAfter = bookingAfter.generated_offers.find((item) => item.id === generatedOfferId);
  assert.equal(typeof generatedOfferAfter?.acceptance_token_nonce, "string");
  assert.ok(generatedOfferAfter.acceptance_token_nonce.length > 20);
  assertISODateLike(generatedOfferAfter?.acceptance_token_created_at, "generated offer repaired acceptance_token_created_at");
  assertISODateLike(generatedOfferAfter?.acceptance_token_expires_at, "generated offer repaired acceptance_token_expires_at");
});

test("public generated offer access exposes deposit acceptance route and blocks OTP acceptance", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const detailBefore = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailBefore.status, 200);

  const offerPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: detailBefore.body.booking.offer_revision,
        offer: {
          ...detailBefore.body.booking.offer,
          currency: createdBooking.preferred_currency,
          payment_terms: {
            currency: createdBooking.preferred_currency,
            basis_total_amount_cents: detailBefore.body.booking.offer.total_price_cents || 0,
            lines: [
              {
                id: "payment_term_deposit_public_access",
                kind: "DEPOSIT",
                label: "Deposit",
                sequence: 1,
                amount_spec: {
                  mode: "FIXED_AMOUNT",
                  fixed_amount_cents: 12000
                },
                due_rule: {
                  type: "ON_ACCEPTANCE"
                }
              },
              {
                id: "payment_term_final_public_access",
                kind: "FINAL_BALANCE",
                label: "Final payment",
                sequence: 2,
                amount_spec: {
                  mode: "REMAINING_BALANCE"
                },
                due_rule: {
                  type: "DAYS_BEFORE_TRIP_START",
                  days: 10
                }
              }
            ]
          },
          components: [
            {
              id: "offer_component_public_access_route_1",
              category: "OTHER",
              label: "Other",
              details: "Deposit-based acceptance",
              quantity: 1,
              unit_amount_cents: 18000,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );
  assert.equal(offerPatchResult.status, 200);

  const depositLine = offerPatchResult.body.booking.offer.payment_terms.lines[0];
  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: offerPatchResult.body.booking.offer_revision,
        comment: "Deposit-based public acceptance",
        acceptance_route: {
          mode: "DEPOSIT_PAYMENT",
          deposit_rule: {
            payment_term_line_id: depositLine.id
          }
        }
      }
    }
  );
  assert.equal(generateResult.status, 201);
  const generatedOffer = generateResult.body.booking.generated_offers[0];

  const accessResult = await requestJson(
    `${endpointPath("public_generated_offer_access")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", generatedOffer.id)}?token=${encodeURIComponent(generatedOffer.public_acceptance_token)}`,
    {}
  );
  assert.equal(accessResult.status, 200);
  assert.equal(accessResult.body.accepted, false);
  assert.equal(accessResult.body.acceptance_route.mode, "DEPOSIT_PAYMENT");
  assert.equal(accessResult.body.acceptance_route.status, "AWAITING_PAYMENT");
  assert.equal(accessResult.body.acceptance_route.deposit_rule.payment_term_label, depositLine.label);
  assert.equal(accessResult.body.acceptance_route.deposit_rule.required_amount_cents, depositLine.resolved_amount_cents);
  assert.equal(accessResult.body.acceptance_route.deposit_rule.currency, createdBooking.preferred_currency);
  assert.equal(accessResult.body.payment_terms.lines.length, 2);
  assert.equal(accessResult.body.acceptance, undefined);

  const acceptResult = await requestJson(
    endpointPath("public_generated_offer_accept")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", generatedOffer.id),
    {},
    {
      method: "POST",
      body: {
        acceptance_token: generatedOffer.public_acceptance_token,
        accepted_by_name: "Deposit User",
        accepted_by_email: "deposit@example.com"
      }
    }
  );
  assert.equal(acceptResult.status, 409);
  assert.match(String(acceptResult.body.error || ""), /deposit payment/i);
});

test("public generated offer access and public pdf require a valid acceptance token", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const offerPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        offer: {
          ...createdBooking.offer,
          currency: createdBooking.preferred_currency,
          components: [
            {
              id: "offer_component_public_access",
              category: "OTHER",
              label: "Other",
              details: "Public acceptance access",
              quantity: 1,
              unit_amount_cents: 9900,
              tax_rate_basis_points: 1000,
              currency: createdBooking.preferred_currency,
              notes: null,
              sort_order: 0
            }
          ]
        }
      }
    }
  );
  assert.equal(offerPatchResult.status, 200);

  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: offerPatchResult.body.booking.offer_revision,
        comment: "Public acceptance access"
      }
    }
  );
  assert.equal(generateResult.status, 201);
  const generatedOffer = generateResult.body.booking.generated_offers[0];

  const accessResult = await requestJson(
    `${endpointPath("public_generated_offer_access")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", generatedOffer.id)}?token=${encodeURIComponent(generatedOffer.public_acceptance_token)}`,
    {}
  );
  assert.equal(accessResult.status, 200);
  assert.equal(accessResult.body.booking_id, bookingId);
  assert.equal(accessResult.body.generated_offer_id, generatedOffer.id);
  assert.equal(accessResult.body.accepted, false);
  assert.match(String(accessResult.body.pdf_url || ""), /\/public\/v1\/bookings\//);

  const invalidAccessResult = await requestJson(
    `${endpointPath("public_generated_offer_access")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", generatedOffer.id)}?token=invalid-token`,
    {}
  );
  assert.equal(invalidAccessResult.status, 403);

  const publicPdfResult = await requestRaw(
    `${endpointPath("public_generated_offer_pdf")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", generatedOffer.id)}?token=${encodeURIComponent(generatedOffer.public_acceptance_token)}`,
    {}
  );
  assert.equal(publicPdfResult.status, 200);
  assert.equal(publicPdfResult.headers["content-type"], "application/pdf");
  assert.match(publicPdfResult.body, /%PDF-/);
});

test("public traveler details access and update use a signed temporary link without OTP", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const detailResult = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailResult.status, 200);
  assert.equal(detailResult.body.booking.public_traveler_details_token, undefined);
  const travelers = detailResult.body.booking.persons.filter((person) => Array.isArray(person.roles) && person.roles.includes("traveler"));
  const traveler = travelers[0];
  assert.ok(traveler, "expected a traveler person on the booking");
  const travelerNumber = travelers.findIndex((person) => person.id === traveler.id) + 1;

  const linkPath = endpointPath("booking_person_traveler_details_link")
    .replace("{booking_id}", bookingId)
    .replace("{person_id}", traveler.id);
  const linkResult = await requestJson(linkPath, apiHeaders(), {
    method: "POST"
  });
  assert.equal(linkResult.status, 200);
  assert.equal(linkResult.body.booking_id, bookingId);
  assert.equal(linkResult.body.person_id, traveler.id);
  assert.equal(typeof linkResult.body.traveler_details_token, "string");
  assert.ok(linkResult.body.traveler_details_token.length > 10);
  assertISODateLike(
    linkResult.body.traveler_details_expires_at,
    "traveler_details_expires_at"
  );

  const accessPath = endpointPath("public_traveler_details_access")
    .replace("{booking_id}", bookingId)
    .replace("{person_id}", traveler.id);
  const accessResult = await requestJson(
    `${accessPath}?token=${encodeURIComponent(linkResult.body.traveler_details_token)}`,
    {}
  );
  assert.equal(accessResult.status, 200);
  assert.equal(accessResult.headers["cache-control"], "private, max-age=0, no-store");
  assert.equal(accessResult.body.booking_id, bookingId);
  assert.equal(accessResult.body.person_id, traveler.id);
  assert.equal(accessResult.body.traveler_number, travelerNumber);
  assert.equal(accessResult.body.person.name, "Test User");
  assert.deepEqual(accessResult.body.person.emails, ["test@example.com"]);
  assert.deepEqual(accessResult.body.person.phone_numbers, ["+15551234567"]);
  assert.equal(accessResult.body.person.preferred_language, "en");
  assert.equal(accessResult.body.person.date_of_birth, undefined);
  assert.equal(accessResult.body.privacy_notice, undefined);

  const updatePath = endpointPath("public_traveler_details_update")
    .replace("{booking_id}", bookingId)
    .replace("{person_id}", traveler.id);
  const updateResult = await requestJson(
    `${updatePath}?token=${encodeURIComponent(linkResult.body.traveler_details_token)}`,
    {},
    {
      method: "PATCH",
      body: {
        person: {
          id: traveler.id,
          name: "Test User",
          emails: ["traveler@example.com"],
          phone_numbers: [],
          preferred_language: "de",
          date_of_birth: "1988-04-12",
          nationality: "VN",
          address: {
            line_1: "12 Lotus Street",
            city: "Hoi An",
            country_code: "VN"
          },
          documents: [
            {
              document_type: "passport",
              holder_name: "Test User",
              document_number: "P1234567",
              issuing_country: "VN",
              issued_on: "2020-01-01",
              expires_on: "2030-01-01"
            }
          ]
        }
      }
    }
  );
  assert.equal(updateResult.status, 200);
  assert.equal(updateResult.headers["cache-control"], "private, max-age=0, no-store");
  assertISODateLike(updateResult.body.saved_at, "public traveler details saved_at");
  assert.equal(updateResult.body.traveler_number, travelerNumber);
  assert.equal(updateResult.body.person.name, "Test User");
  assert.deepEqual(updateResult.body.person.emails, ["traveler@example.com"]);
  assert.deepEqual(updateResult.body.person.address, {
    line_1: "12 Lotus Street",
    city: "Hoi An",
    country_code: "VN"
  });
  assert.equal(updateResult.body.privacy_notice, undefined);

  const detailAfter = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailAfter.status, 200);
  const travelerAfter = detailAfter.body.booking.persons.find((person) => person.id === traveler.id);
  assert.ok(travelerAfter);
  assert.deepEqual(travelerAfter.emails, ["traveler@example.com"]);
  assert.equal(travelerAfter.phone_numbers, undefined);
  assert.equal(travelerAfter.preferred_language, "de");
  assert.equal(travelerAfter.date_of_birth, "1988-04-12");
  assert.equal(travelerAfter.nationality, "VN");
  assert.equal(travelerAfter.address.line_1, "12 Lotus Street");
  assert.equal(travelerAfter.address.city, "Hoi An");
  assert.equal(travelerAfter.address.country_code, "VN");
  assert.equal(travelerAfter.documents.length, 1);
  assert.equal(travelerAfter.documents[0].document_number, "P1234567");

  const accessAfterResult = await requestJson(
    `${accessPath}?token=${encodeURIComponent(linkResult.body.traveler_details_token)}`,
    {}
  );
  assert.equal(accessAfterResult.status, 200);
  assert.equal(accessAfterResult.body.traveler_number, travelerNumber);
  assert.equal(accessAfterResult.body.person.name, "Test User");
  assert.deepEqual(accessAfterResult.body.person.emails, ["traveler@example.com"]);
  assert.deepEqual(accessAfterResult.body.person.address, {
    line_1: "12 Lotus Street",
    city: "Hoi An",
    country_code: "VN"
  });
  assert.equal(accessAfterResult.body.person.documents.length, 1);
  assert.equal(accessAfterResult.body.person.documents[0].document_number, "P1234567");
  assert.equal(accessAfterResult.body.privacy_notice, undefined);

  const invalidAccessResult = await requestJson(`${accessPath}?token=invalid-token`, {});
  assert.equal(invalidAccessResult.status, 401);
});

test("booking name and persons endpoints update the booking", async () => {
  const createdBooking = await createSeedBooking();
  const booking_id = createdBooking.id;

  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailBefore.status, 200);
  const bookingBefore = detailBefore.body.booking;
  const core_revision = bookingBefore.core_revision;
  const persons_revision = bookingBefore.persons_revision;
  const original_person = bookingBefore.persons[0];
  assert.equal(typeof original_person.id, "string");

  const nameResult = await requestJson(
    endpointPath("booking_name").replace("{booking_id}", booking_id),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_core_revision: core_revision,
        name: "Vietnam Expeditions",
        actor: "joachim"
      }
    }
  );
  assert.equal(nameResult.status, 200);
  assert.equal(nameResult.body.booking.name, "Vietnam Expeditions");
  const detailAfterName = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailAfterName.status, 200);
  const persons_revision_after_name = detailAfterName.body.booking.persons_revision;

  const personUpdateResult = await requestJson(
    endpointPath("booking_person_update")
      .replace("{booking_id}", booking_id)
      .replace("{person_id}", original_person.id),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_persons_revision: persons_revision_after_name,
        person: {
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
        actor: "joachim"
      }
    }
  );
  assert.equal(personUpdateResult.status, 200);
  assert.deepEqual(personUpdateResult.body.booking.persons[0].roles, ["primary_contact", "decision_maker"]);
  const updatedPassport = personUpdateResult.body.booking.persons[0].documents.find((document) => document.document_type === "passport");
  assert.ok(updatedPassport);
  assert.equal(updatedPassport.holder_name, "Test User");
  assert.equal(updatedPassport.issued_on, "2023-05-01");

  const personCreateResult = await requestJson(
    endpointPath("booking_person_create").replace("{booking_id}", booking_id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_persons_revision: personUpdateResult.body.booking.persons_revision,
        person: {
          id: `${booking_id}_traveler_2`,
          name: "Traveler Two",
          roles: ["traveler"],
          emails: ["traveler2@example.com"],
          phone_numbers: ["+15557654321"]
        },
        actor: "joachim"
      }
    }
  );
  assert.equal(personCreateResult.status, 201);
  assert.equal(personCreateResult.body.booking.persons.length, 2);
  assert.equal(personCreateResult.body.booking.persons[1].name, "Traveler Two");
  const detailAfterPersons = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailAfterPersons.status, 200);
  assert.equal(detailAfterPersons.body.booking.persons[0].documents[0].document_number, "C01X9981");
});

test("booking activity create uses the core revision", async () => {
  const createdBooking = await createSeedBooking();
  const booking_id = createdBooking.id;

  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailBefore.status, 200);
  const core_revision = detailBefore.body.booking.core_revision;

  const createResult = await requestJson(
    endpointPath("booking_activity_create").replace("{booking_id}", booking_id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_core_revision: core_revision,
        type: "BOOKING_UPDATED",
        detail: "Manual activity",
        actor: "joachim"
      }
    }
  );
  assert.equal(createResult.status, 201);
  assert.equal(createResult.body.activity.type, "BOOKING_UPDATED");
  assert.equal(createResult.body.booking.core_revision, core_revision + 1);
});

test("booking chat stays on one canonical booking and exposes related bookings", async () => {
  await resetStore();

  const firstBookingResult = await requestJson(endpointPath("public_bookings"), {}, {
    method: "POST",
    body: {
      name: "Joachim",
      email: "joachim@example.com",
      phone_number: "+84337942446",
      preferred_language: "en",
      preferred_currency: "USD",
      destinations: ["Vietnam"],
      travel_style: ["Culture"],
      number_of_travelers: 1,
      booking_name: "Vietnam Journey"
    }
  });
  assert.equal(firstBookingResult.status, 201);

  const secondBookingResult = await requestJson(endpointPath("public_bookings"), {}, {
    method: "POST",
    body: {
      name: "Joachim",
      email: "joachim@example.com",
      phone_number: "+84337942446",
      preferred_language: "en",
      preferred_currency: "USD",
      destinations: ["Laos"],
      travel_style: ["Grand Expeditions"],
      number_of_travelers: 1,
      booking_name: "Laos Journey"
    }
  });
  assert.equal(secondBookingResult.status, 201);

  const firstBookingId = firstBookingResult.body.booking.id;
  const secondBookingId = secondBookingResult.body.booking.id;

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  store.chat_channel_accounts.push({
    id: "chatacct_whatsapp",
    channel: "whatsapp",
    external_account_id: "wa_phone",
    name: "WhatsApp",
    metadata: {},
    created_at: "2026-03-11T00:00:00.000Z",
    updated_at: "2026-03-11T00:00:00.000Z"
  });
  store.chat_conversations.push({
    id: "chatconv_primary",
    channel: "whatsapp",
    channel_account_id: "chatacct_whatsapp",
    external_conversation_id: "84337942446",
    external_contact_id: "84337942446",
    booking_id: firstBookingId,
    latest_preview: "Hello from WhatsApp",
    last_event_at: "2026-03-11T10:00:00.000Z",
    created_at: "2026-03-11T10:00:00.000Z",
    updated_at: "2026-03-11T10:00:00.000Z"
  });
  store.chat_events.push({
    id: "chatevt_primary",
    conversation_id: "chatconv_primary",
    channel: "whatsapp",
    event_type: "message",
    direction: "inbound",
    external_message_id: "wamid.1",
    external_status: null,
    sender_display: "Joachim",
    sender_contact: "84337942446",
    text_preview: "Hello from WhatsApp",
    sent_at: "2026-03-11T10:00:00.000Z",
    received_at: "2026-03-11T10:00:01.000Z",
    payload_json: {},
    created_at: "2026-03-11T10:00:01.000Z"
  });
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const primaryChatResult = await requestJson(
    endpointPath("booking_chat").replace("{booking_id}", firstBookingId),
    apiHeaders()
  );
  assert.equal(primaryChatResult.status, 200);
  assert.equal(primaryChatResult.body.conversations.length, 1);
  assert.equal(primaryChatResult.body.conversations[0].booking_id, firstBookingId);
  assert.deepEqual(
    primaryChatResult.body.conversations[0].related_bookings.map((booking) => booking.booking_id),
    [secondBookingId]
  );

  const secondaryChatResult = await requestJson(
    endpointPath("booking_chat").replace("{booking_id}", secondBookingId),
    apiHeaders()
  );
  assert.equal(secondaryChatResult.status, 200);
  assert.equal(secondaryChatResult.body.conversations.length, 0);
  assert.equal(secondaryChatResult.body.items.length, 0);
});

test("booking chat ignores stale deleted booking ids and rematches by phone", async () => {
  await resetStore();

  const bookingResult = await requestJson(endpointPath("public_bookings"), {}, {
    method: "POST",
    body: {
      name: "Joachim",
      email: "joachim@example.com",
      phone_number: "+84337942446",
      preferred_language: "en",
      preferred_currency: "USD",
      destinations: ["Vietnam"],
      travel_style: ["Grand Expeditions"],
      number_of_travelers: 2,
      booking_name: "Vietnam Journey"
    }
  });
  assert.equal(bookingResult.status, 201);
  const bookingId = bookingResult.body.booking.id;

  const detailResult = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailResult.status, 200);
  const booking = detailResult.body.booking;
  const personsRevision = booking.persons_revision;

  const createPersonResult = await requestJson(
    endpointPath("booking_person_create").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_persons_revision: personsRevision,
        person: {
          name: "Van Nguyen",
          phone_numbers: ["+84387451111"],
          roles: ["traveler"]
        },
        actor: "joachim"
      }
    }
  );
  assert.equal(createPersonResult.status, 201);

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  store.chat_channel_accounts.push({
    id: "chatacct_whatsapp",
    channel: "whatsapp",
    external_account_id: "wa_phone",
    name: "WhatsApp",
    metadata: {},
    created_at: "2026-03-12T00:00:00.000Z",
    updated_at: "2026-03-12T00:00:00.000Z"
  });
  store.chat_conversations.push({
    id: "chatconv_stale",
    channel: "whatsapp",
    channel_account_id: "chatacct_whatsapp",
    external_conversation_id: "84387451111",
    external_contact_id: "84387451111",
    booking_id: "booking_deleted_old_reference",
    latest_preview: "Hello from WhatsApp",
    last_event_at: "2026-03-12T10:00:00.000Z",
    created_at: "2026-03-12T10:00:00.000Z",
    updated_at: "2026-03-12T10:00:00.000Z"
  });
  store.chat_events.push({
    id: "chatevt_stale",
    conversation_id: "chatconv_stale",
    channel: "whatsapp",
    event_type: "message",
    direction: "inbound",
    external_message_id: "wamid.stale",
    external_status: null,
    sender_display: "Van Nguyen",
    sender_contact: "84387451111",
    text_preview: "Hello from WhatsApp",
    sent_at: "2026-03-12T10:00:00.000Z",
    received_at: "2026-03-12T10:00:01.000Z",
    payload_json: {},
    created_at: "2026-03-12T10:00:01.000Z"
  });
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const chatResult = await requestJson(
    endpointPath("booking_chat").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(chatResult.status, 200);
  assert.equal(chatResult.body.conversations.length, 1);
  assert.equal(chatResult.body.conversations[0].booking_id, bookingId);
  assert.equal(chatResult.body.items.length, 1);
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
  const persons_revision = bookingBefore.persons_revision;
  const original_person = bookingBefore.persons[0];

  const photoResult = await requestJson(
    endpointPath("booking_person_photo")
      .replace("{booking_id}", booking_id)
      .replace("{person_id}", original_person.id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_persons_revision: persons_revision,
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

test("booking person document picture endpoint stores separate passport and ID card images when ImageMagick is available", async (t) => {
  if (!HAS_MAGICK) {
    t.skip("ImageMagick `magick` is not installed in this environment.");
    return;
  }

  const createdBooking = await createSeedBooking();
  const booking_id = createdBooking.id;
  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailBefore.status, 200);
  const bookingBefore = detailBefore.body.booking;
  const original_person = bookingBefore.persons[0];

  const passportResult = await requestJson(
    endpointPath("booking_person_document_picture")
      .replace("{booking_id}", booking_id)
      .replace("{person_id}", original_person.id)
      .replace("{document_type}", "passport"),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_persons_revision: bookingBefore.persons_revision,
        filename: "passport.png",
        data_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAACYktHRAAB3YoTpAAAAAd0SU1FB+oDCgU5NQ3qg4IAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjYtMDMtMTBUMDU6NTc6NTMrMDA6MDCtMWFJAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDI2LTAzLTEwVDA1OjU3OjUzKzAwOjAw3GzZ9QAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyNi0wMy0xMFQwNTo1Nzo1MyswMDowMIt5+CoAAAAKSURBVAjXY2gAAACCAIHdQ2r0AAAAAElFTkSuQmCC",
        actor: "joachim"
      }
    }
  );
  assert.equal(passportResult.status, 200);
  const passportDocument = passportResult.body.booking.persons[0].documents.find((document) => document.document_type === "passport");
  assert.equal(typeof passportDocument?.document_picture_ref, "string");
  assert.ok(passportDocument.document_picture_ref.includes("/public/v1/booking-person-photos/"));

  const idCardResult = await requestJson(
    endpointPath("booking_person_document_picture")
      .replace("{booking_id}", booking_id)
      .replace("{person_id}", original_person.id)
      .replace("{document_type}", "national_id"),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_persons_revision: passportResult.body.booking.persons_revision,
        filename: "id-card.png",
        data_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAACYktHRAAB3YoTpAAAAAd0SU1FB+oDCgU5NQ3qg4IAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjYtMDMtMTBUMDU6NTc6NTMrMDA6MDCtMWFJAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDI2LTAzLTEwVDA1OjU3OjUzKzAwOjAw3GzZ9QAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyNi0wMy0xMFQwNTo1Nzo1MyswMDowMIt5+CoAAAAKSURBVAjXY2gAAACCAIHdQ2r0AAAAAElFTkSuQmCC",
        actor: "joachim"
      }
    }
  );
  assert.equal(idCardResult.status, 200);
  const idCardDocument = idCardResult.body.booking.persons[0].documents.find((document) => document.document_type === "national_id");
  assert.equal(typeof idCardDocument?.document_picture_ref, "string");
  assert.ok(idCardDocument.document_picture_ref.includes("/public/v1/booking-person-photos/"));
});

test("booking invoice create/update and offer exchange-rates endpoints work", async () => {
  const createdBooking = await createSeedBooking();
  const booking_id = createdBooking.id;

  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailBefore.status, 200);
  const invoices_revision = detailBefore.body.booking.invoices_revision;

  const invoiceCreateResult = await requestJson(
    endpointPath("booking_invoice_create").replace("{booking_id}", booking_id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_invoices_revision: invoices_revision,
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
  const invoices_revision_after_create = invoiceCreateResult.body.booking.invoices_revision;

  const invoiceUpdateResult = await requestJson(
    endpointPath("booking_invoice_update")
      .replace("{booking_id}", booking_id)
      .replace("{invoice_id}", invoice_id),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_invoices_revision: invoices_revision_after_create,
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

test("booking invoice patch rejects currency change once invoice is sent", async () => {
  const createdBooking = await createSeedBooking();
  const booking_id = createdBooking.id;

  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailBefore.status, 200);

  const invoiceCreateResult = await requestJson(
    endpointPath("booking_invoice_create").replace("{booking_id}", booking_id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_invoices_revision: detailBefore.body.booking.invoices_revision,
        invoice_number: "ATP-LOCK-001",
        currency: "USD",
        title: "Lock test",
        components: [
          {
            description: "Planning fee",
            quantity: 1,
            unit_amount_cents: 10000
          }
        ]
      }
    }
  );
  assert.equal(invoiceCreateResult.status, 201);
  const invoice_id = invoiceCreateResult.body.invoice.id;

  const sentResult = await requestJson(
    endpointPath("booking_invoice_update")
      .replace("{booking_id}", booking_id)
      .replace("{invoice_id}", invoice_id),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_invoices_revision: invoiceCreateResult.body.booking.invoices_revision,
        sent_to_recipient: true
      }
    }
  );
  assert.equal(sentResult.status, 200);
  assert.equal(sentResult.body.invoice.status, "INVOICE_SENT");

  const lockedResult = await requestJson(
    endpointPath("booking_invoice_update")
      .replace("{booking_id}", booking_id)
      .replace("{invoice_id}", invoice_id),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_invoices_revision: sentResult.body.booking.invoices_revision,
        currency: "VND"
      }
    }
  );
  assert.equal(lockedResult.status, 409);
  assert.match(String(lockedResult.body.error || ""), /currency/i);
});

test("keycloak users endpoint lists assignable users from keycloak directory", async () => {
  const result = await requestJson(endpointPath("keycloak_users"), apiHeaders("atp_admin", "admin", "kc-admin"));
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.items));
  assert.deepEqual(
    result.body.items.map((item) => item.username),
    ["accountant", "admin", "joachim", "staff"]
  );
  assert.ok(result.body.items.every((item) => item.active === true));
  const admin = result.body.items.find((item) => item.username === "admin");
  assert.deepEqual(admin.realm_roles, []);
  assert.deepEqual(admin.client_roles, ["atp_admin"]);
  assert.equal(admin.staff_profile.username, "admin");
  assert.ok(Array.isArray(admin.staff_profile.languages));
  assert.ok(Array.isArray(admin.staff_profile.destinations));
  assert.ok(String(admin.staff_profile.picture_ref || "").includes("/public/v1/atp-staff-photos/admin.svg"));
  const accountant = result.body.items.find((item) => item.username === "accountant");
  assert.deepEqual(accountant.realm_roles, []);
  assert.deepEqual(accountant.client_roles, ["atp_accountant"]);
  assert.equal(accountant.staff_profile.username, "accountant");
});

test("admin can update ATP staff profile details while non-admin cannot", async () => {
  const profilePath = endpointPath("keycloak_user_staff_profile_update").replace("{username}", "joachim");

  const forbiddenResult = await requestJson(
    profilePath,
    apiHeaders("atp_manager", "joachim", "kc-joachim"),
    {
      method: "PATCH",
      body: {
        languages: ["de", "en"],
        destinations: ["VN"],
        experiences: [{
          title: "Manager should not write this",
          summary: "This write should be rejected."
        }]
      }
    }
  );
  assert.equal(forbiddenResult.status, 403);

  const updateResult = await requestJson(
    profilePath,
    apiHeaders("atp_admin", "admin", "kc-admin"),
    {
      method: "PATCH",
      body: {
        languages: ["de", "en", "vi"],
        destinations: ["VN", "LA"],
        experiences: [{
          title: "Quiet wellness pacing",
          summary: "Shapes calm Southeast Asia routes with realistic transfer windows and recovery time between highlights."
        }]
      }
    }
  );
  assert.equal(updateResult.status, 200);
  assert.equal(updateResult.body.user.username, "joachim");
  assert.deepEqual(updateResult.body.user.staff_profile.languages, ["de", "en", "vi"]);
  assert.deepEqual(updateResult.body.user.staff_profile.destinations, ["VN", "LA"]);
  assert.equal(updateResult.body.user.staff_profile.experiences.length, 1);
  assert.equal(updateResult.body.user.staff_profile.experiences[0].title, "Quiet wellness pacing");
  assert.equal(updateResult.body.user.staff_profile.experiences[0].countries, undefined);
  assert.equal(updateResult.body.user.staff_profile.experiences[0].travel_styles, undefined);

  const listResult = await requestJson(endpointPath("keycloak_users"), apiHeaders("atp_admin", "admin", "kc-admin"));
  const updated = listResult.body.items.find((item) => item.username === "joachim");
  assert.equal(updated.staff_profile.experiences[0].title, "Quiet wellness pacing");
});

test("admin can upload and reset ATP staff profile pictures", { skip: !HAS_MAGICK }, async () => {
  const picturePath = endpointPath("keycloak_user_staff_profile_picture_upload").replace("{username}", "joachim");

  const uploadResult = await requestJson(
    picturePath,
    apiHeaders("atp_admin", "admin", "kc-admin"),
    {
      method: "POST",
      body: {
        filename: "joachim.png",
        mime_type: "image/png",
        data_base64: TINY_PNG_BASE64
      }
    }
  );
  assert.equal(uploadResult.status, 200);
  assert.match(String(uploadResult.body.user.staff_profile.picture_ref || ""), /joachim\.webp$/);

  const uploadedPhotoPath = path.join(TEST_DATA_DIR, "atp_staff_photos", "joachim.webp");
  const uploadedPhotoStat = await stat(uploadedPhotoPath);
  assert.ok(uploadedPhotoStat.size > 0);

  const deleteResult = await requestJson(
    endpointPath("keycloak_user_staff_profile_picture_delete").replace("{username}", "joachim"),
    apiHeaders("atp_admin", "admin", "kc-admin"),
    { method: "DELETE" }
  );
  assert.equal(deleteResult.status, 200);
  assert.match(String(deleteResult.body.user.staff_profile.picture_ref || ""), /joachim\.svg$/);
});

test("assigned staff only sees their own bookings while admin sees all", async () => {
  const createdBooking = await createSeedBooking();
  const booking_id = createdBooking.id;

  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailBefore.status, 200);

  const assignResult = await requestJson(
    endpointPath("booking_owner").replace("{booking_id}", booking_id),
    apiHeaders("atp_admin", "admin", "kc-admin"),
    {
      method: "PATCH",
      body: {
        expected_core_revision: detailBefore.body.booking.core_revision,
        assigned_keycloak_user_id: "kc-staff",
        actor: "admin"
      }
    }
  );
  assert.equal(assignResult.status, 200);
  assert.equal(assignResult.body.booking.assigned_keycloak_user_id, "kc-staff");
  assert.equal(assignResult.body.booking.assigned_atp_staff.username, "staff");
  assert.equal(assignResult.body.booking.assigned_atp_staff.name, "Staff User");

  const adminList = await requestJson(`${endpointPath("bookings")}?page=1&page_size=10&sort=created_at_desc`, apiHeaders("atp_admin", "admin", "kc-admin"));
  assert.equal(adminList.status, 200);
  assert.equal(adminList.body.items.length, 1);
  assert.equal(adminList.body.items[0].assigned_keycloak_user_label, "Staff User");

  const staffList = await requestJson(
    `${endpointPath("bookings")}?page=1&page_size=10&sort=created_at_desc`,
    apiHeaders("atp_staff", "staff", "kc-staff")
  );
  assert.equal(staffList.status, 200);
  assert.equal(staffList.body.items.length, 1);
  assert.equal(staffList.body.items[0].id, booking_id);
  assert.equal(staffList.body.items[0].assigned_keycloak_user_label, "Staff User");

  const otherStaffList = await requestJson(
    `${endpointPath("bookings")}?page=1&page_size=10&sort=created_at_desc`,
    apiHeaders("atp_staff", "other-staff", "kc-other-staff")
  );
  assert.equal(otherStaffList.status, 200);
  assert.equal(otherStaffList.body.items.length, 0);
});

test("accountant is read-only everywhere", async () => {
  const createdBooking = await createSeedBooking();
  const booking_id = createdBooking.id;
  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailBefore.status, 200);

  const detailAsAccountant = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", booking_id),
    apiHeaders("atp_accountant", "accountant", "kc-accountant")
  );
  assert.equal(detailAsAccountant.status, 200);

  const noteResult = await requestJson(
    endpointPath("booking_notes").replace("{booking_id}", booking_id),
    apiHeaders("atp_accountant", "accountant", "kc-accountant"),
    {
      method: "PATCH",
      body: {
        expected_notes_revision: detailBefore.body.booking.notes_revision,
        notes: "Accountant note",
        actor: "accountant"
      }
    }
  );
  assert.equal(noteResult.status, 403);

  const milestoneResult = await requestJson(
    endpointPath("booking_milestone_action").replace("{booking_id}", booking_id),
    apiHeaders("atp_accountant", "accountant", "kc-accountant"),
    {
      method: "POST",
      body: {
        expected_core_revision: detailBefore.body.booking.core_revision,
        action: "TRAVEL_PLAN_SENT",
        actor: "accountant"
      }
    }
  );
  assert.equal(milestoneResult.status, 403);
});

test("booking milestone actions keep timestamps and derive stage from the last saved action", async () => {
  const createdBooking = await createSeedBooking();
  const booking_id = createdBooking.id;
  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailBefore.status, 200);

  const travelPlanSentResult = await requestJson(
    endpointPath("booking_milestone_action").replace("{booking_id}", booking_id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_core_revision: detailBefore.body.booking.core_revision,
        action: "TRAVEL_PLAN_SENT",
        actor: "joachim"
      }
    }
  );
  assert.equal(travelPlanSentResult.status, 200);
  assert.equal(travelPlanSentResult.body.booking.stage, "QUALIFIED");
  assert.equal(travelPlanSentResult.body.booking.last_action, "TRAVEL_PLAN_SENT");
  assert.match(String(travelPlanSentResult.body.booking.last_action_at || ""), /T/);
  assert.match(String(travelPlanSentResult.body.booking.milestones?.travel_plan_sent_at || ""), /T/);

  const offerSentResult = await requestJson(
    endpointPath("booking_milestone_action").replace("{booking_id}", booking_id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_core_revision: travelPlanSentResult.body.booking.core_revision,
        action: "OFFER_SENT",
        actor: "joachim"
      }
    }
  );
  assert.equal(offerSentResult.status, 200);
  assert.equal(offerSentResult.body.booking.stage, "PROPOSAL_SENT");
  assert.equal(offerSentResult.body.booking.last_action, "OFFER_SENT");
  assert.match(String(offerSentResult.body.booking.last_action_at || ""), /T/);
  assert.match(String(offerSentResult.body.booking.milestones?.offer_sent_at || ""), /T/);
  assert.match(String(offerSentResult.body.booking.milestones?.travel_plan_sent_at || ""), /T/);

  const travelPlanSentAgainResult = await requestJson(
    endpointPath("booking_milestone_action").replace("{booking_id}", booking_id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_core_revision: offerSentResult.body.booking.core_revision,
        action: "TRAVEL_PLAN_SENT",
        actor: "joachim"
      }
    }
  );
  assert.equal(travelPlanSentAgainResult.status, 200);
  assert.equal(travelPlanSentAgainResult.body.booking.stage, "QUALIFIED");
  assert.equal(travelPlanSentAgainResult.body.booking.last_action, "TRAVEL_PLAN_SENT");
  assert.match(String(travelPlanSentAgainResult.body.booking.milestones?.offer_sent_at || ""), /T/);
  assert.match(String(travelPlanSentAgainResult.body.booking.milestones?.travel_plan_sent_at || ""), /T/);

  const resetToNewResult = await requestJson(
    endpointPath("booking_milestone_action").replace("{booking_id}", booking_id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_core_revision: travelPlanSentAgainResult.body.booking.core_revision,
        action: "NEW",
        actor: "joachim"
      }
    }
  );
  assert.equal(resetToNewResult.status, 200);
  assert.equal(resetToNewResult.body.booking.stage, "NEW");
  assert.equal(resetToNewResult.body.booking.last_action, "NEW_BOOKING");
  assert.match(String(resetToNewResult.body.booking.milestones?.new_booking_at || ""), /T/);
});

test("blank-name booking persons roundtrip without synthetic traveler names", async () => {
  const createdBooking = await createSeedBooking();
  const booking_id = createdBooking.id;
  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailBefore.status, 200);

  const createResult = await requestJson(
    endpointPath("booking_person_create").replace("{booking_id}", booking_id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_persons_revision: detailBefore.body.booking.persons_revision,
        person: {
          name: "",
          roles: ["traveler"],
          phone_numbers: ["+84999999999"]
        },
        actor: "joachim"
      }
    }
  );
  assert.equal(createResult.status, 201);
  const createdPerson = createResult.body.booking.persons.find((person) => person.phone_numbers?.includes("+84999999999"));
  assert.ok(createdPerson);
  assert.equal(createdPerson.name, "");

  const detailAfter = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailAfter.status, 200);
  const persistedPerson = detailAfter.body.booking.persons.find((person) => person.id === createdPerson.id);
  assert.ok(persistedPerson);
  assert.equal(persistedPerson.name, "");
});
