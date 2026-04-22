import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
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
const STANDARD_TOURS_DIR = path.resolve(__dirname, "..", "..", "..", "content", "standard_tours");

process.env.KEYCLOAK_ENABLED = "true";
process.env.INSECURE_TEST_AUTH = "true";
process.env.KEYCLOAK_ALLOWED_ROLES = "atp_admin,atp_manager,atp_accountant,atp_staff,atp_tour_editor";
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
process.env.ATP_STAFF_PROFILES_PATH = path.join(TEST_DATA_DIR, "content", "atp_staff", "staff.json");
process.env.ATP_STAFF_PHOTOS_DIR = path.join(TEST_DATA_DIR, "content", "atp_staff", "photos");
process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH = "";
process.env.GOOGLE_IMPERSONATED_EMAIL = "";
process.env.TRAVELER_DETAILS_TOKEN_SECRET = "traveler-details-contract-test-secret";

const originalFetch = global.fetch;
const KEYCLOAK_USERS = [
  { id: "kc-admin", username: "admin", firstName: "Admin", lastName: "User", enabled: true },
  { id: "kc-joachim", username: "joachim", firstName: "Joachim", lastName: "Neumann", enabled: true },
  { id: "kc-staff", username: "staff", firstName: "Staff", lastName: "User", enabled: true },
  { id: "kc-tour-editor", username: "tour-editor", firstName: "Tour", lastName: "Editor", enabled: true },
  { id: "kc-accountant", username: "accountant", firstName: "Accountant", lastName: "User", enabled: true },
  { id: "kc-disabled", username: "disabled", firstName: "Disabled", lastName: "User", enabled: false }
];
const KEYCLOAK_ROLE_MAP = {
  "kc-admin": { realm: [], client: ["atp_admin"] },
  "kc-joachim": { realm: [], client: ["atp_admin", "atp_staff"] },
  "kc-staff": { realm: [], client: ["atp_staff"] },
  "kc-tour-editor": { realm: [], client: ["atp_tour_editor"] },
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

test.after(async () => {
  global.fetch = originalFetch;
  await rm(TEST_DATA_DIR, { recursive: true, force: true });
});

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
    payment_documents: [],
    chat_channel_accounts: [],
    chat_conversations: [],
    chat_events: []
  }, null, 2)}\n`, "utf8");
}

async function removeStandardToursByTitlePrefix(prefix) {
  const normalizedPrefix = String(prefix || "").trim();
  if (!normalizedPrefix) return;
  const entries = await readdir(STANDARD_TOURS_DIR, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry?.isDirectory?.()) continue;
    const standardTourPath = path.join(STANDARD_TOURS_DIR, entry.name, "standard_tour.json");
    let parsed = null;
    try {
      parsed = JSON.parse(await readFile(standardTourPath, "utf8"));
    } catch {
      continue;
    }
    const title = String(parsed?.title || "").trim();
    if (!title.startsWith(normalizedPrefix)) continue;
    await rm(path.join(STANDARD_TOURS_DIR, entry.name), { recursive: true, force: true });
  }
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

function buildTripOfferDraft(baseOffer, currency, amountCents, overrides = {}) {
  return {
    ...(baseOffer || {}),
    currency,
    offer_detail_level_internal: "trip",
    offer_detail_level_visible: "trip",
    trip_price_internal: {
      label: "Trip total",
      amount_cents: amountCents,
      tax_rate_basis_points: 0,
      currency
    },
    days_internal: [],
    ...(overrides || {})
  };
}

function buildDayOfferDraft(baseOffer, currency, dayAmounts, overrides = {}) {
  return {
    ...(baseOffer || {}),
    currency,
    offer_detail_level_internal: "day",
    offer_detail_level_visible: "day",
    trip_price_internal: null,
    days_internal: (Array.isArray(dayAmounts) ? dayAmounts : []).map((amountCents, index) => ({
      id: `offer_day_internal_${index + 1}`,
      day_number: index + 1,
      label: `Day ${index + 1}`,
      amount_cents: amountCents,
      tax_rate_basis_points: 0,
      currency,
      sort_order: index
    })),
    ...(overrides || {})
  };
}

async function deleteBookingForTest(bookingId) {
  if (!bookingId) return;
  const detailResult = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  if (detailResult.status !== 200) return;

  const deleteResult = await requestJson(
    endpointPath("booking_delete").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "DELETE",
      body: {
        expected_core_revision: detailResult.body.booking.core_revision
      }
    }
  );
  assert.equal(deleteResult.status, 200);
}

async function cloneBookingForTest(bookingId, body = {}) {
  return await requestJson(
    `/api/v1/bookings/${encodeURIComponent(bookingId)}/clone`,
    apiHeaders(),
    {
      method: "POST",
      body
    }
  );
}

async function createBackendBookingForTest(body = {}, headers = apiHeaders()) {
  return await requestJson("/api/v1/bookings", headers, {
    method: "POST",
    body
  });
}

async function deleteTourForTest(tourId) {
  if (!tourId) return;
  const deleteResult = await requestJson(
    endpointPath("tour_delete").replace("{tour_id}", tourId),
    apiHeaders("atp_tour_editor", "tour-editor", "kc-tour-editor"),
    { method: "DELETE" }
  );
  assert.equal(deleteResult.status, 200);
}

function assertBookingShape(booking) {
  assert.equal(typeof booking.id, "string");
  assert.ok(Array.isArray(booking.persons));
  assert.ok(booking.persons.length > 0);
  assert.equal(typeof booking.persons[0].id, "string");
  assert.equal(typeof booking.persons[0].name, "string");
  assert.ok(Array.isArray(booking.persons[0].roles));
  assert.equal(typeof booking.preferred_currency, "string");
  assert.ok(Array.isArray(booking.travel_styles));
  assert.equal(typeof booking.offer, "object");
  assert.equal(typeof booking.offer.offer_detail_level_internal, "string");
  assert.equal(typeof booking.offer.offer_detail_level_visible, "string");
  assert.ok(booking.offer.trip_price_internal == null || typeof booking.offer.trip_price_internal === "object");
  assert.ok(Array.isArray(booking.offer.days_internal));
  assert.ok(Array.isArray(booking.offer.additional_items));
  assert.equal(typeof booking.offer.visible_pricing, "object");
  assert.equal(typeof booking.offer.visible_pricing.detail_level, "string");
  assert.equal(typeof booking.offer.visible_pricing.derivable, "boolean");
  assert.ok(Array.isArray(booking.offer.visible_pricing.days));
  assert.ok(booking.offer.visible_pricing.trip_price == null || typeof booking.offer.visible_pricing.trip_price === "object");
  assert.ok(Array.isArray(booking.offer.visible_pricing.additional_items));
  assert.equal(typeof booking.travel_plan_revision, "number");
  assert.equal(typeof booking.travel_plan, "object");
  assert.ok(Array.isArray(booking.travel_plan.destinations));
  assert.ok(Array.isArray(booking.travel_plan.days));
  if (booking.created_at) assertISODateLike(booking.created_at, "booking.created_at");
  if (booking.updated_at) assertISODateLike(booking.updated_at, "booking.updated_at");
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

test("booking clone endpoint applies the shared clone policy and can include travelers", async () => {
  const createdBooking = await createPublicBooking({
    name: "Original booking",
    preferred_language: "de",
    preferred_currency: "USD",
    destinations: ["Vietnam", "Cambodia"],
    travel_style: ["Culture", "Food"],
    notes: "Original note"
  });

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingRecord = store.bookings.find((booking) => booking.id === createdBooking.id);
  bookingRecord.assigned_keycloak_user_id = "kc-staff";
  bookingRecord.source_channel = "website";
  bookingRecord.referral_kind = "atp_staff";
  bookingRecord.referral_label = "Joachim";
  bookingRecord.referral_staff_user_id = "kc-staff";
  bookingRecord.accepted_offer_snapshot = { total_price_cents: 12300 };
  bookingRecord.accepted_travel_plan_snapshot = { days: [{ id: "old_day_1" }] };
  bookingRecord.accepted_offer_artifact_ref = "generated_offer_1";
  bookingRecord.accepted_travel_plan_artifact_ref = "travel_plan_pdf_1";
  bookingRecord.accepted_deposit_amount_cents = 3300;
  bookingRecord.accepted_deposit_currency = "USD";
  bookingRecord.deposit_received_at = "2026-03-25T09:15:00.000Z";
  bookingRecord.travel_plan = {
    destinations: ["VN", "KH"],
    days: [
      {
        id: "travel_day_1",
        day_number: 1,
        title: "Arrival",
        services: [
          {
            id: "travel_service_1",
            title: "Airport pickup",
            image: {
              id: "travel_image_1",
              storage_path: "booking_images/source/service.webp",
              sort_order: 0
            }
          }
        ]
      }
    ],
    attachments: [
      {
        id: "attachment_1",
        filename: "voucher.pdf",
        storage_path: "booking_source/voucher.pdf",
        page_count: 1,
        sort_order: 0
      }
    ]
  };
  bookingRecord.offer = {
    currency: "USD",
    status: "OFFER_SENT",
    offer_detail_level_internal: "day",
    offer_detail_level_visible: "day",
    category_rules: [{ category: "OTHER", tax_rate_basis_points: 0 }],
    days_internal: [{
      id: "offer_day_internal_1",
      day_number: 1,
      label: "Day 1",
      amount_cents: 10000,
      tax_rate_basis_points: 0,
      currency: "USD"
    }],
    additional_items: [],
    totals: {
      net_amount_cents: 10000,
      tax_amount_cents: 0,
      gross_amount_cents: 10000,
      total_price_cents: 10000,
      items_count: 1
    },
    quotation_summary: {
      tax_included: true,
      subtotal_net_amount_cents: 10000,
      total_tax_amount_cents: 0,
      grand_total_amount_cents: 10000,
      tax_breakdown: []
    },
    total_price_cents: 10000
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const cloneWithoutTravelers = await cloneBookingForTest(createdBooking.id, {
    expected_core_revision: bookingRecord.core_revision,
    name: "Cloned without travelers"
  });
  assert.equal(cloneWithoutTravelers.status, 201);
  assert.equal(cloneWithoutTravelers.body.booking.name, "Cloned without travelers");
  assert.equal(cloneWithoutTravelers.body.booking.assigned_keycloak_user_id, null);
  assert.deepEqual(cloneWithoutTravelers.body.booking.persons, []);
  assert.equal(cloneWithoutTravelers.body.booking.customer_language, "de");
  assert.deepEqual(cloneWithoutTravelers.body.booking.travel_plan.destinations, ["VN", "KH"]);
  assert.deepEqual(cloneWithoutTravelers.body.booking.travel_styles, ["culture", "gastronomic-experiences"]);
  assert.equal(cloneWithoutTravelers.body.booking.source_channel, null);
  assert.equal(cloneWithoutTravelers.body.booking.referral_kind, null);
  assert.deepEqual(cloneWithoutTravelers.body.booking.accepted_record, { available: false });
  assert.equal(cloneWithoutTravelers.body.booking.travel_plan.days[0].services[0].image.storage_path, "booking_images/source/service.webp");
  assert.equal(cloneWithoutTravelers.body.booking.travel_plan.attachments[0].storage_path, "booking_source/voucher.pdf");
  assert.equal(cloneWithoutTravelers.body.booking.web_form_submission.booking_name, "Cloned without travelers");
  assert.equal(cloneWithoutTravelers.body.booking.web_form_submission.notes, `cloned from ${createdBooking.id}`);
  assert.equal(cloneWithoutTravelers.body.booking.web_form_submission.name, undefined);
  assert.equal(cloneWithoutTravelers.body.booking.web_form_submission.email, undefined);
  assert.equal(cloneWithoutTravelers.body.booking.web_form_submission.phone_number, undefined);

  const cloneWithTravelers = await cloneBookingForTest(createdBooking.id, {
    expected_core_revision: bookingRecord.core_revision,
    name: "Cloned with travelers",
    include_travelers: true
  });
  assert.equal(cloneWithTravelers.status, 201);
  assert.equal(cloneWithTravelers.body.booking.persons.length, 1);
  assert.equal(cloneWithTravelers.body.booking.persons[0].name, "Original booking");
  assert.equal(cloneWithTravelers.body.booking.persons[0].roles.includes("primary_contact"), true);
});

test("backend booking create endpoint creates an internal booking and assigns staff creators to themselves", async () => {
  await resetStore();

  const result = await createBackendBookingForTest({
    name: "Kuala Lumpur Family Planning",
    preferred_language: "ms",
    preferred_currency: "USD",
    destinations: ["MY", "SG"],
    travel_styles: ["culture", "family-friendly"],
    primary_contact_name: "Aina Rahman",
    primary_contact_email: "aina@example.com",
    primary_contact_phone_number: "+60123456789",
    number_of_travelers: 4
  }, apiHeaders("atp_staff", "staff", "kc-staff"));

  assert.equal(result.status, 201);
  assert.equal(result.body.booking.name, "Kuala Lumpur Family Planning");
  assert.equal(result.body.booking.customer_language, "ms");
  assert.equal(result.body.booking.preferred_currency, "USD");
  assert.deepEqual(result.body.booking.travel_plan.destinations, ["MY", "SG"]);
  assert.deepEqual(result.body.booking.travel_styles, ["culture", "family-friendly"]);
  assert.equal(result.body.booking.assigned_keycloak_user_id, "kc-staff");
  assert.equal(result.body.booking.web_form_submission, undefined);
  assert.equal(result.body.booking.persons.length, 1);
  assert.equal(result.body.booking.persons[0].name, "Aina Rahman");
  assert.deepEqual(result.body.booking.persons[0].emails, ["aina@example.com"]);
  assert.deepEqual(result.body.booking.persons[0].phone_numbers, ["+60123456789"]);

  const activitiesResult = await requestJson(
    endpointPath("booking_activities").replace("{booking_id}", result.body.booking.id),
    apiHeaders("atp_staff", "staff", "kc-staff")
  );
  assert.equal(activitiesResult.status, 200);
  assert.match(
    activitiesResult.body.activities[0].detail,
    /Booking created in backend/,
    "Internal booking creation should leave a backend activity trail"
  );
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
  assert.deepEqual(result.body.booking.travel_plan.destinations, []);
  assert.deepEqual(result.body.booking.travel_styles, []);
  assert.equal(result.body.booking.persons.length, 1);
  assert.equal(result.body.booking.persons[0].name, "Discovery Caller");
});

test("booking detail, activities, and payment documents conform to the mobile contract", async () => {
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

  const paymentDocumentsResult = await requestJson(
    endpointPath("booking_payment_documents").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(paymentDocumentsResult.status, 200);
  assert.ok(Array.isArray(paymentDocumentsResult.body.items));
  assert.equal(typeof paymentDocumentsResult.body.total, "number");

});

test("booking offer patch preserves selected currency", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailBefore.status, 200);
  const booking = detailBefore.body.booking;
  const offerCurrency = booking.offer?.currency || booking.preferred_currency || "USD";
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
          currency: mismatchCurrency
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

test("booking offer patch persists internal trip detail level with additional items", async () => {
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
          offer_detail_level_internal: "trip",
          offer_detail_level_visible: "trip",
          trip_price_internal: {
            label: "Trip total",
            amount_cents: 50000,
            tax_rate_basis_points: 1000,
            currency: booking.preferred_currency,
            notes: "Main trip total"
          },
          days_internal: [],
          additional_items: [
            {
              id: "offer_additional_airport_pickup",
              label: "Airport pickup",
              quantity: 1,
              unit_amount_cents: 10000,
              tax_rate_basis_points: 1000,
              currency: booking.preferred_currency,
              notes: "Arrival transfer",
              sort_order: 0
            }
          ]
        }
      }
    }
  );

  assert.equal(patchResult.status, 200);
  assert.equal(patchResult.body.booking.offer.offer_detail_level_internal, "trip");
  assert.equal(patchResult.body.booking.offer.offer_detail_level_visible, "trip");
  assert.equal(patchResult.body.booking.offer.days_internal.length, 0);
  assert.equal(patchResult.body.booking.offer.additional_items.length, 1);
  assert.equal(patchResult.body.booking.offer.trip_price_internal.amount_cents, 50000);
  assert.equal(patchResult.body.booking.offer.total_price_cents, 66000);
  assert.equal(patchResult.body.booking.offer.visible_pricing.detail_level, "trip");
  assert.equal(patchResult.body.booking.offer.visible_pricing.derivable, true);
  assert.equal(patchResult.body.booking.offer.visible_pricing.trip_price.amount_cents, 50000);
  assert.equal(patchResult.body.booking.offer.visible_pricing.additional_items.length, 1);
});

test("booking offer patch treats explicit day internal detail level as authoritative and preserves adjustments", async () => {
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
          offer_detail_level_internal: "day",
          offer_detail_level_visible: "day",
          trip_price_internal: {
            label: "Old trip total",
            amount_cents: 888888,
            tax_rate_basis_points: 1000,
            currency: createdBooking.preferred_currency
          },
          days_internal: [
            {
              id: "offer_day_internal_1",
              day_number: 1,
              label: "Day 1",
              amount_cents: 10000,
              tax_rate_basis_points: 0,
              currency: createdBooking.preferred_currency
            },
            {
              id: "offer_day_internal_2",
              day_number: 2,
              label: "Day 2",
              amount_cents: 15000,
              tax_rate_basis_points: 0,
              currency: createdBooking.preferred_currency
            }
          ],
          additional_items: [
            {
              id: "offer_additional_keep_1",
              label: "Existing surcharge",
              quantity: 1,
              unit_amount_cents: 5000,
              tax_rate_basis_points: 0,
              currency: createdBooking.preferred_currency,
              sort_order: 0
            }
          ],
          discount: {
            reason: "Keep this discount",
            amount_cents: 2000,
            currency: createdBooking.preferred_currency
          }
        }
      }
    }
  );

  assert.equal(patchResult.status, 200);
  assert.equal(patchResult.body.booking.offer.offer_detail_level_internal, "day");
  assert.equal(patchResult.body.booking.offer.days_internal.length, 2);
  assert.equal(patchResult.body.booking.offer.days_internal[0].amount_cents, 10000);
  assert.equal(patchResult.body.booking.offer.days_internal[1].amount_cents, 15000);
  assert.equal(patchResult.body.booking.offer.additional_items.length, 1);
  assert.equal(patchResult.body.booking.offer.additional_items[0].unit_amount_cents, 5000);
  assert.equal(patchResult.body.booking.offer.discounts.length, 1);
  assert.equal(patchResult.body.booking.offer.discounts[0].amount_cents, 2000);
  assert.equal(patchResult.body.booking.offer.total_price_cents, 28000);
});

test("booking offer patch rejects visible detail level more specific than internal detail level", async () => {
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
          offer_detail_level_internal: "trip",
          offer_detail_level_visible: "day",
          trip_price_internal: {
            label: "Trip total",
            amount_cents: 25000,
            tax_rate_basis_points: 1000,
            currency: booking.preferred_currency
          },
          days_internal: [],
          additional_items: []
        }
      }
    }
  );

  assert.equal(patchResult.status, 422);
  assert.match(String(patchResult.body.error || ""), /visible offer detail level/i);
});

test("booking offer read model preserves visible day projection from internal days", async () => {
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
          ...buildDayOfferDraft(booking.offer, booking.preferred_currency, [10000, 20000]),
          additional_items: [
            {
              id: "offer_additional_item_1",
              label: "VIP support",
              quantity: 1,
              unit_amount_cents: 3000,
              tax_rate_basis_points: 1000,
              currency: booking.preferred_currency,
              sort_order: 0
            }
          ]
        }
      }
    }
  );

  assert.equal(patchResult.status, 200);
  assert.equal(patchResult.body.booking.offer.visible_pricing.detail_level, "day");
  assert.equal(patchResult.body.booking.offer.visible_pricing.derivable, true);
  assert.equal(patchResult.body.booking.offer.visible_pricing.days.length, 2);
  assert.equal(patchResult.body.booking.offer.visible_pricing.days[0].day_number, 1);
  assert.equal(patchResult.body.booking.offer.visible_pricing.days[0].amount_cents, 10000);
  assert.equal(patchResult.body.booking.offer.visible_pricing.days[1].day_number, 2);
  assert.equal(patchResult.body.booking.offer.visible_pricing.days[1].amount_cents, 20000);
  assert.equal(patchResult.body.booking.offer.visible_pricing.additional_items.length, 1);
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
          offer_detail_level_internal: "trip",
          offer_detail_level_visible: "trip",
          trip_price_internal: {
            label: "Trip total",
            amount_cents: 33000,
            tax_rate_basis_points: 0,
            currency: booking.preferred_currency
          },
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
          }
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
          offer_detail_level_internal: "trip",
          offer_detail_level_visible: "trip",
          trip_price_internal: {
            label: "Trip total",
            amount_cents: 30000,
            tax_rate_basis_points: 0,
            currency: booking.preferred_currency
          },
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
          }
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

test("booking offer patch accepts multiple offer discounts with reasons", async () => {
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
          offer_detail_level_internal: "trip",
          offer_detail_level_visible: "trip",
          trip_price_internal: {
            label: "Trip total",
            amount_cents: 11000,
            tax_rate_basis_points: 0,
            currency: createdBooking.preferred_currency
          },
          discounts: [
            {
              id: "offer_discount_loyalty",
              reason: "Loyalty discount",
              amount_cents: 500,
              currency: createdBooking.preferred_currency,
              sort_order: 0
            },
            {
              id: "offer_discount_flash_sale",
              reason: "Flash sale discount",
              amount_cents: 300,
              currency: createdBooking.preferred_currency,
              sort_order: 1
            }
          ]
        }
      }
    }
  );

  assert.equal(patchResult.status, 200);
  assert.equal(patchResult.body.booking.offer.discounts.length, 2);
  assert.equal(patchResult.body.booking.offer.discounts[0].reason, "Loyalty discount");
  assert.equal(patchResult.body.booking.offer.discounts[0].amount_cents, 500);
  assert.equal(patchResult.body.booking.offer.discounts[1].reason, "Flash sale discount");
  assert.equal(patchResult.body.booking.offer.discounts[1].amount_cents, 300);
  assert.equal(patchResult.body.booking.offer.total_price_cents, 10200);
  assert.equal(patchResult.body.booking.offer.quotation_summary.grand_total_amount_cents, 10200);

  const detailAfter = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailAfter.status, 200);
  assert.equal(detailAfter.body.booking.offer.discounts.length, 2);
  assert.equal(detailAfter.body.booking.offer.discounts[0].reason, "Loyalty discount");
  assert.equal(detailAfter.body.booking.offer.total_price_cents, 10200);
});

test("booking offer patch drops zero-amount surcharges and discounts", async () => {
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
          offer_detail_level_internal: "trip",
          offer_detail_level_visible: "trip",
          trip_price_internal: {
            label: "Trip total",
            amount_cents: 10000,
            tax_rate_basis_points: 0,
            currency: createdBooking.preferred_currency
          },
          additional_items: [
            {
              id: "offer_additional_drop_zero",
              label: "Zero surcharge",
              quantity: 1,
              unit_amount_cents: 0,
              tax_rate_basis_points: 0,
              currency: createdBooking.preferred_currency,
              sort_order: 0
            },
            {
              id: "offer_additional_keep",
              label: "Keep surcharge",
              quantity: 1,
              unit_amount_cents: 500,
              tax_rate_basis_points: 0,
              currency: createdBooking.preferred_currency,
              sort_order: 1
            }
          ],
          discounts: [
            {
              id: "offer_discount_drop_zero",
              reason: "Zero discount",
              amount_cents: 0,
              currency: createdBooking.preferred_currency,
              sort_order: 0
            },
            {
              id: "offer_discount_keep",
              reason: "Keep discount",
              amount_cents: 200,
              currency: createdBooking.preferred_currency,
              sort_order: 1
            }
          ]
        }
      }
    }
  );

  assert.equal(patchResult.status, 200);
  assert.equal(patchResult.body.booking.offer.additional_items.length, 1);
  assert.equal(patchResult.body.booking.offer.additional_items[0].id, "offer_additional_keep");
  assert.equal(patchResult.body.booking.offer.discounts.length, 1);
  assert.equal(patchResult.body.booking.offer.discounts[0].id, "offer_discount_keep");
  assert.equal(patchResult.body.booking.offer.total_price_cents, 10300);

  const detailAfter = await requestJson(endpointPath("booking_detail").replace("{booking_id}", bookingId), apiHeaders());
  assert.equal(detailAfter.status, 200);
  assert.equal(detailAfter.body.booking.offer.additional_items.length, 1);
  assert.equal(detailAfter.body.booking.offer.additional_items[0].id, "offer_additional_keep");
  assert.equal(detailAfter.body.booking.offer.discounts.length, 1);
  assert.equal(detailAfter.body.booking.offer.discounts[0].id, "offer_discount_keep");
});

test("booking travel plan patch persists days and services", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const offerPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        offer: buildTripOfferDraft(createdBooking.offer, createdBooking.preferred_currency, 19250)
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
              services: [
                {
                  id: "travel_plan_service_1",
                  timing_kind: "point",
                  time_point: "19:00",
                  kind: "transport",
                  title: "Airport transfer"
                },
                {
                  id: "travel_plan_service_2",
                  timing_kind: "range",
                  start_time: "14:00",
                  end_time: "15:00",
                  kind: "accommodation",
                  title: "Hotel check-in"
                },
                {
                  id: "travel_plan_service_3",
                  timing_kind: "label",
                  time_label: "Evening",
                  kind: "free_time",
                  title: "Explore the old town"
                },
                {
                  id: "travel_plan_service_4",
                  timing_kind: "label",
                  time_label: "2 days",
                  kind: "activity",
                  title: "Mountain hiking"
                }
              ]
            }
          ]
        }
      }
    }
  );
  assert.equal(travelPlanPatchResult.status, 200);
  assert.equal(travelPlanPatchResult.body.booking.travel_plan_revision, 1);
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days.length, 1);
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days[0].services[0].timing_kind, "point");
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days[0].services[0].time_point, "19:00");
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days[0].services[0].time_label, null);
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days[0].services[1].timing_kind, "range");
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days[0].services[1].start_time, "14:00");
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days[0].services[1].end_time, "15:00");
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days[0].services[2].timing_kind, "label");
  assert.equal(travelPlanPatchResult.body.booking.travel_plan.days[0].services[2].time_label, "Evening");
  const detailAfter = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailAfter.status, 200);
  assert.equal(detailAfter.body.booking.travel_plan.days[0].title, "Arrival");
  assert.equal(detailAfter.body.booking.travel_plan.days[0].services[0].time_point, "19:00");

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
              services: []
            }
          ]
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
              services: []
            }
          ]
        }
      }
    }
  );
  assert.equal(stalePatch.status, 409);
  assert.equal(stalePatch.body.code, "BOOKING_REVISION_MISMATCH");
});

test("booking travel plan patch allows blank service titles and still rejects invalid items", async () => {
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
              services: [
                {
                  id: "travel_plan_service_1",
                  kind: "transport",
                  title: ""
                }
              ]
            }
          ]
        }
      }
    }
  );
  assert.equal(missingTitleResult.status, 200);
  assert.equal(missingTitleResult.body.booking.travel_plan.days[0].services[0].title, "");
  const nextTravelPlanRevision = missingTitleResult.body.booking.travel_plan_revision;

  const missingPointTimeResult = await requestJson(
    endpointPath("booking_travel_plan").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: nextTravelPlanRevision,
        travel_plan: {
          days: [
            {
              id: "travel_plan_day_1",
              day_number: 1,
              title: "Arrival",
              services: [
                {
                  id: "travel_plan_service_1",
                  timing_kind: "point",
                  kind: "transport",
                  title: "Airport transfer"
                }
              ]
            }
          ]
        }
      }
    }
  );
  assert.equal(missingPointTimeResult.status, 422);
  assert.match(String(missingPointTimeResult.body.error || ""), /time point/i);

});

test("services can be searched and imported from another booking", async () => {
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
        services: [
          {
            id: "source_item_1",
            timing_kind: "label",
            time_label: "Afternoon",
            kind: "accommodation",
            title: "Boutique hotel check-in",
            details: "Private transfer and riverside hotel check-in.",
            location: "Hoi An",
            image: {
              id: "source_item_image_1",
              storage_path: "/public/v1/booking-images/source/item-1.webp",
              sort_order: 0,
              is_primary: true,
              is_customer_visible: true,
              created_at: "2026-03-21T00:00:00Z"
            }
          }
        ],
        notes: ""
      }
    ]
  };
  targetRecord.travel_plan = {
    days: [
      {
        id: "target_day_1",
        day_number: 1,
        date: "2026-05-10",
        title: "Start",
        overnight_location: "Da Nang",
        services: [],
        notes: ""
      }
    ]
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const searchResult = await requestJson(
    `${endpointPath("travel_plan_service_search")}?q=boutique&service_kind=accommodation`,
    apiHeaders()
  );
  assert.equal(searchResult.status, 200);
  assert.equal(typeof searchResult.body.total, "number");
  assert.ok(Array.isArray(searchResult.body.items));
  const foundItem = searchResult.body.items.find((item) => item.source_booking_id === sourceBooking.id);
  assert.ok(foundItem, "Expected imported item to appear in search results");
  assert.equal(foundItem.service_id, "source_item_1");
  assert.equal(foundItem.service_kind, "accommodation");
  assert.equal(foundItem.thumbnail_url, "/public/v1/booking-images/source/item-1.webp");

  const importResult = await requestJson(
    endpointPath("booking_travel_plan_service_import")
      .replace("{booking_id}", targetBooking.id)
      .replace("{day_id}", "target_day_1"),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_travel_plan_revision: targetBooking.travel_plan_revision,
        source_booking_id: sourceBooking.id,
        source_service_id: "source_item_1",
        include_images: true,
        include_customer_visible_images_only: false,
        include_notes: true,
        include_translations: true,
        include_offer_links: false
      }
    }
  );
  assert.equal(importResult.status, 200);
  assert.equal(importResult.body.booking.travel_plan.days[0].services.length, 1);
  const importedItem = importResult.body.booking.travel_plan.days[0].services[0];
  assert.equal(importedItem.title, "Boutique hotel check-in");
  assert.equal(importedItem.copied_from.source_booking_id, sourceBooking.id);
  assert.equal(importedItem.copied_from.source_service_id, "source_item_1");
  assert.ok(importedItem.image);
  assert.notEqual(importedItem.image.id, "source_item_image_1");
  assert.equal(importedItem.image.storage_path, "/public/v1/booking-images/source/item-1.webp");
});

test("days can be searched and imported from another booking with cleared timing and detached financial coverage", async () => {
  const sourceBooking = await createSeedBooking();
  const targetBooking = await createPublicBooking({
    name: "Day Target User",
    email: "day-target@example.com"
  });

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const sourceRecord = store.bookings.find((item) => item.id === sourceBooking.id);
  const targetRecord = store.bookings.find((item) => item.id === targetBooking.id);
  assert.ok(sourceRecord);
  assert.ok(targetRecord);

  sourceRecord.travel_plan = {
    days: [
      {
        id: "source_day_copy_1",
        day_number: 1,
        date: "2026-06-03",
        title: "Waterfall day",
        title_i18n: { en: "Waterfall day", de: "Wasserfalltag" },
        overnight_location: "Hue",
        overnight_location_i18n: { en: "Hue", de: "Hue" },
        services: [
          {
            id: "source_day_service_1",
            timing_kind: "point",
            time_label: "",
            time_label_i18n: {},
            time_point: "2026-06-03T08:30:00.000Z",
            kind: "activity",
            title: "Canyon walk",
            title_i18n: { en: "Canyon walk", de: "Canyon-Wanderung" },
            details: "Guided hike",
            details_i18n: { en: "Guided hike", de: "Gefuhrte Wanderung" },
            location: "Bach Ma",
            location_i18n: { en: "Bach Ma", de: "Bach Ma" },
            image: {
              id: "source_day_service_image_1",
              storage_path: "/public/v1/booking-images/source/day-service-1.webp",
              sort_order: 0,
              is_primary: true,
              is_customer_visible: true,
              created_at: "2026-03-21T00:00:00Z"
            }
          }
        ],
        notes: "Bring water",
        notes_i18n: { en: "Bring water", de: "Wasser mitbringen" }
      }
    ]
  };
  targetRecord.travel_plan = {
    days: [
      {
        id: "target_day_copy_1",
        day_number: 1,
        date: "2026-06-10",
        title: "Arrival",
        overnight_location: "Da Nang",
        services: [],
        notes: ""
      }
    ]
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const searchResult = await requestJson(
    `${endpointPath("travel_plan_day_search")}?q=waterfall`,
    apiHeaders()
  );
  assert.equal(searchResult.status, 200);
  assert.equal(typeof searchResult.body.total, "number");
  assert.ok(Array.isArray(searchResult.body.items));
  const foundDay = searchResult.body.items.find((item) => item.source_booking_id === sourceBooking.id);
  assert.ok(foundDay, "Expected imported day to appear in search results");
  assert.equal(foundDay.day_id, "source_day_copy_1");
  assert.equal(foundDay.service_count, 1);
  assert.equal(foundDay.thumbnail_url, "/public/v1/booking-images/source/day-service-1.webp");

  const importResult = await requestJson(
    endpointPath("booking_travel_plan_day_import").replace("{booking_id}", targetBooking.id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_travel_plan_revision: targetBooking.travel_plan_revision,
        source_booking_id: sourceBooking.id,
        source_day_id: "source_day_copy_1",
        include_images: true,
        include_customer_visible_images_only: false,
        include_notes: true,
        include_translations: true
      }
    }
  );
  assert.equal(importResult.status, 200);
  assert.equal(importResult.body.booking.travel_plan.days.length, 2);
  const importedDay = importResult.body.booking.travel_plan.days[1];
  assert.equal(importedDay.date, "2026-06-11");
  assert.equal(importedDay.title, "Waterfall day");
  assert.deepEqual(importedDay.title_i18n, { en: "Waterfall day", de: "Wasserfalltag" });
  assert.deepEqual(importedDay.notes_i18n, { en: "Bring water", de: "Wasser mitbringen" });
  assert.equal(importedDay.copied_from.source_booking_id, sourceBooking.id);
  assert.equal(importedDay.copied_from.source_day_id, "source_day_copy_1");
  const importedService = importedDay.services[0];
  assert.equal(importedService.title, "Canyon walk");
  assert.deepEqual(importedService.title_i18n, { en: "Canyon walk", de: "Canyon-Wanderung" });
  assert.equal(importedService.time_point, null);
  assert.equal(importedService.start_time, null);
  assert.equal(importedService.end_time, null);
  assert.equal(importedService.copied_from.source_booking_id, sourceBooking.id);
  assert.equal(importedService.copied_from.source_day_id, "source_day_copy_1");
  assert.equal(importedService.copied_from.source_service_id, "source_day_service_1");
  assert.ok(importedService.image);
  assert.notEqual(importedService.image.id, "source_day_service_image_1");
  assert.equal(importedService.image.storage_path, "/public/v1/booking-images/source/day-service-1.webp");
});

test("travel plans can be searched and appended from another booking with grouped provenance", async () => {
  const sourceBooking = await createSeedBooking();
  const targetBooking = await createPublicBooking({
    name: "Plan Target User",
    email: "plan-target@example.com"
  });

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const sourceRecord = store.bookings.find((item) => item.id === sourceBooking.id);
  const targetRecord = store.bookings.find((item) => item.id === targetBooking.id);
  assert.ok(sourceRecord);
  assert.ok(targetRecord);

  sourceRecord.travel_plan = {
    days: [
      {
        id: "source_plan_day_1",
        day_number: 1,
        date: "2026-07-01",
        title: "Arrival day",
        overnight_location: "Hue",
        services: [
          {
            id: "source_plan_service_1",
            timing_kind: "point",
            time_label: "",
            time_label_i18n: {},
            time_point: "2026-07-01T09:30",
            kind: "transport",
            title: "Airport pickup",
            title_i18n: { en: "Airport pickup", de: "Flughafenabholung" },
            details: "Private transfer",
            details_i18n: { en: "Private transfer", de: "Privater Transfer" },
            location: "Hue Airport",
            location_i18n: { en: "Hue Airport", de: "Flughafen Hue" },
            image: {
              id: "source_plan_service_image_1",
              storage_path: "/public/v1/booking-images/source/plan-service-1.webp",
              sort_order: 0,
              is_primary: true,
              is_customer_visible: true,
              created_at: "2026-03-21T00:00:00Z"
            }
          }
        ],
        notes: "Lantern welcome dinner",
        notes_i18n: { en: "Lantern welcome dinner", de: "Laternen-Abendessen" }
      },
      {
        id: "source_plan_day_2",
        day_number: 2,
        date: "2026-07-03",
        title: "Cave day",
        overnight_location: "Phong Nha",
        services: [
          {
            id: "source_plan_service_2",
            timing_kind: "range",
            time_label: "",
            time_label_i18n: {},
            start_time: "2026-07-03T08:00",
            end_time: "2026-07-03T11:30",
            kind: "activity",
            title: "Lantern cave walk",
            details: "Guided cave visit",
            location: "Phong Nha"
          }
        ],
        notes: "Bring water"
      }
    ],
    attachments: [
      {
        id: "source_plan_attachment_1",
        filename: "source-attachment.pdf",
        storage_path: "/tmp/source-attachment.pdf",
        page_count: 2,
        sort_order: 0,
        created_at: "2026-03-21T00:00:00Z"
      }
    ]
  };
  sourceRecord.pdf_personalization = {
    travel_plan: {
      subtitle: "Source subtitle marker",
      subtitle_i18n: {
        en: "Source subtitle marker",
        de: "Quelluntertitel Marker"
      },
      welcome: "Source welcome marker",
      children_policy: "Source children policy marker",
      whats_not_included: "Source exclusions marker",
      closing: "Source closing marker",
      include_who_is_traveling: true
    }
  };
  targetRecord.travel_plan = {
    days: [
      {
        id: "target_plan_day_1",
        day_number: 1,
        date: "2026-07-10",
        title: "Target arrival",
        overnight_location: "Da Nang",
        services: [],
        notes: ""
      }
    ],
    attachments: []
  };
  targetRecord.pdf_personalization = {
    travel_plan: {
      subtitle: "Target subtitle marker"
    },
    offer: {
      closing: "Offer personalization should stay on the target booking."
    }
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const searchResult = await requestJson(
    `${endpointPath("travel_plan_search")}?q=lantern`,
    apiHeaders()
  );
  assert.equal(searchResult.status, 200);
  assert.equal(typeof searchResult.body.total, "number");
  assert.ok(Array.isArray(searchResult.body.items));
  const foundPlan = searchResult.body.items.find((item) => item.source_booking_id === sourceBooking.id);
  assert.ok(foundPlan, "Expected imported travel plan to appear in search results");
  assert.equal(foundPlan.day_count, 2);
  assert.equal(foundPlan.service_count, 2);
  assert.equal(foundPlan.first_date, "2026-07-01");
  assert.equal(foundPlan.last_date, "2026-07-03");
  assert.equal(foundPlan.thumbnail_url, "/public/v1/booking-images/source/plan-service-1.webp");

  const importResult = await requestJson(
    endpointPath("booking_travel_plan_import").replace("{booking_id}", targetBooking.id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_travel_plan_revision: targetBooking.travel_plan_revision,
        source_booking_id: sourceBooking.id,
        include_images: true,
        include_customer_visible_images_only: false,
        include_notes: true,
        include_translations: true
      }
    }
  );

  assert.equal(importResult.status, 200);
  assert.equal(importResult.body.booking.travel_plan.days.length, 3);
  assert.equal(importResult.body.booking.travel_plan.attachments.length, 0);
  assert.equal(importResult.body.booking.pdf_personalization.travel_plan.subtitle, "Source subtitle marker");
  assert.equal(importResult.body.booking.pdf_personalization.travel_plan.subtitle_i18n.de, "Quelluntertitel Marker");
  assert.equal(importResult.body.booking.pdf_personalization.travel_plan.welcome, "Source welcome marker");
  assert.equal(importResult.body.booking.pdf_personalization.travel_plan.children_policy, "Source children policy marker");
  assert.equal(importResult.body.booking.pdf_personalization.travel_plan.whats_not_included, "Source exclusions marker");
  assert.equal(importResult.body.booking.pdf_personalization.travel_plan.closing, "Source closing marker");
  assert.equal(importResult.body.booking.pdf_personalization.travel_plan.include_who_is_traveling, true);
  assert.equal(
    importResult.body.booking.pdf_personalization.offer.closing,
    "Offer personalization should stay on the target booking."
  );

  const importedDays = importResult.body.booking.travel_plan.days.slice(1);
  assert.equal(importedDays[0].date, "2026-07-11");
  assert.equal(importedDays[1].date, "2026-07-13");
  assert.equal(importedDays[0].copied_from.source_booking_id, sourceBooking.id);
  assert.equal(importedDays[0].copied_from.source_day_id, "source_plan_day_1");
  assert.equal(importedDays[1].copied_from.source_day_id, "source_plan_day_2");
  assert.ok(importedDays[0].copied_from.import_batch_id);
  assert.equal(importedDays[1].copied_from.import_batch_id, importedDays[0].copied_from.import_batch_id);

  const importedFirstService = importedDays[0].services[0];
  const importedSecondService = importedDays[1].services[0];
  assert.equal(importedFirstService.time_point, "2026-07-11T09:30");
  assert.equal(importedSecondService.start_time, "2026-07-13T08:00");
  assert.equal(importedSecondService.end_time, "2026-07-13T11:30");
  assert.equal(importedFirstService.copied_from.source_service_id, "source_plan_service_1");
  assert.equal(importedSecondService.copied_from.source_service_id, "source_plan_service_2");
  assert.equal(importedFirstService.copied_from.import_batch_id, importedDays[0].copied_from.import_batch_id);
  assert.equal(importedSecondService.copied_from.import_batch_id, importedDays[0].copied_from.import_batch_id);
  assert.ok(importedFirstService.image);
  assert.notEqual(importedFirstService.image.id, "source_plan_service_image_1");
  assert.equal(importedFirstService.image.storage_path, "/public/v1/booking-images/source/plan-service-1.webp");
});

test("staff can search and import travel plan library content from other staff bookings into their own booking", async () => {
  const sourceBooking = await createSeedBooking();
  const targetBooking = await createPublicBooking({
    name: "Staff Target User",
    email: "staff-target@example.com"
  });

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const sourceRecord = store.bookings.find((item) => item.id === sourceBooking.id);
  const targetRecord = store.bookings.find((item) => item.id === targetBooking.id);
  assert.ok(sourceRecord);
  assert.ok(targetRecord);

  sourceRecord.assigned_keycloak_user_id = "kc-joachim";
  targetRecord.assigned_keycloak_user_id = "kc-staff";
  sourceRecord.travel_plan = {
    days: [
      {
        id: "shared_source_day_1",
        day_number: 1,
        date: "2026-08-03",
        title: "Shared market day",
        overnight_location: "Hoi An",
        services: [
          {
            id: "shared_source_service_1",
            timing_kind: "label",
            time_label: "Morning",
            kind: "activity",
            title: "Lantern workshop",
            details: "Hands-on lantern making with local artisans.",
            location: "Hoi An Ancient Town",
            image: {
              id: "shared_source_service_image_1",
              storage_path: "/public/v1/booking-images/source/shared-service-1.webp",
              sort_order: 0,
              is_primary: true,
              is_customer_visible: true,
              created_at: "2026-03-21T00:00:00Z"
            }
          }
        ],
        notes: "Great fit for family travelers"
      }
    ]
  };
  sourceRecord.pdf_personalization = {
    travel_plan: {
      subtitle: "Shared subtitle marker"
    }
  };
  targetRecord.travel_plan = {
    days: [
      {
        id: "staff_target_day_1",
        day_number: 1,
        date: "2026-08-10",
        title: "Staff target arrival",
        overnight_location: "Da Nang",
        services: [],
        notes: ""
      }
    ],
    attachments: []
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const staffHeaders = apiHeaders("atp_staff", "staff", "kc-staff");

  const planSearchResult = await requestJson(
    `${endpointPath("travel_plan_search")}?q=lantern`,
    staffHeaders
  );
  assert.equal(planSearchResult.status, 200);
  assert.ok(planSearchResult.body.items.some((item) => item.source_booking_id === sourceBooking.id));

  const daySearchResult = await requestJson(
    `${endpointPath("travel_plan_day_search")}?q=market`,
    staffHeaders
  );
  assert.equal(daySearchResult.status, 200);
  assert.ok(daySearchResult.body.items.some((item) => item.source_booking_id === sourceBooking.id));

  const serviceSearchResult = await requestJson(
    `${endpointPath("travel_plan_service_search")}?q=lantern&service_kind=activity`,
    staffHeaders
  );
  assert.equal(serviceSearchResult.status, 200);
  assert.ok(serviceSearchResult.body.items.some((item) => item.source_booking_id === sourceBooking.id));

  const serviceImportResult = await requestJson(
    endpointPath("booking_travel_plan_service_import")
      .replace("{booking_id}", targetBooking.id)
      .replace("{day_id}", "staff_target_day_1"),
    staffHeaders,
    {
      method: "POST",
      body: {
        expected_travel_plan_revision: targetBooking.travel_plan_revision,
        source_booking_id: sourceBooking.id,
        source_service_id: "shared_source_service_1",
        include_images: true,
        include_customer_visible_images_only: false,
        include_notes: true,
        include_translations: true
      }
    }
  );
  assert.equal(serviceImportResult.status, 200);
  assert.equal(serviceImportResult.body.booking.travel_plan.days[0].services[0].copied_from.source_booking_id, sourceBooking.id);

  const targetAfterServiceImport = serviceImportResult.body.booking;

  const dayImportResult = await requestJson(
    endpointPath("booking_travel_plan_day_import").replace("{booking_id}", targetBooking.id),
    staffHeaders,
    {
      method: "POST",
      body: {
        expected_travel_plan_revision: targetAfterServiceImport.travel_plan_revision,
        source_booking_id: sourceBooking.id,
        source_day_id: "shared_source_day_1",
        include_images: true,
        include_customer_visible_images_only: false,
        include_notes: true,
        include_translations: true
      }
    }
  );
  assert.equal(dayImportResult.status, 200);
  assert.equal(dayImportResult.body.booking.travel_plan.days[1].copied_from.source_booking_id, sourceBooking.id);

  const targetAfterDayImport = dayImportResult.body.booking;

  const planImportResult = await requestJson(
    endpointPath("booking_travel_plan_import").replace("{booking_id}", targetBooking.id),
    staffHeaders,
    {
      method: "POST",
      body: {
        expected_travel_plan_revision: targetAfterDayImport.travel_plan_revision,
        source_booking_id: sourceBooking.id,
        include_images: true,
        include_customer_visible_images_only: false,
        include_notes: true,
        include_translations: true
      }
    }
  );
  assert.equal(planImportResult.status, 200);
  assert.equal(planImportResult.body.booking.travel_plan.days.length, 3);
  assert.equal(planImportResult.body.booking.pdf_personalization.travel_plan.subtitle, "Shared subtitle marker");
});

test("standard tour apply copies the travel plan without storing extra standard-tour metadata", async () => {
  await removeStandardToursByTitlePrefix("Standard tour copy marker");
  const sourceBooking = await createSeedBooking();
  const targetBooking = await createPublicBooking({
    name: "Standard Tour Target User",
    email: "standard-tour-target@example.com"
  });
  const standardTourTitle = `Standard tour copy marker ${sourceBooking.id}`;
  try {
    const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
    const sourceRecord = store.bookings.find((item) => item.id === sourceBooking.id);
    const targetRecord = store.bookings.find((item) => item.id === targetBooking.id);
    assert.ok(sourceRecord);
    assert.ok(targetRecord);

    sourceRecord.travel_plan = {
      days: [
        {
          id: "standard_tour_source_day_1",
          day_number: 1,
          date: "2026-08-01",
          title: "Standard tour day marker",
          overnight_location: "Siem Reap",
          services: [
            {
              id: "standard_tour_source_service_1",
              timing_kind: "label",
              time_label: "Morning",
              kind: "activity",
              title: "Standard tour service marker",
              details: "Standard tour service details",
              location: "Siem Reap"
            }
          ],
          notes: ""
        }
      ]
    };
    targetRecord.travel_plan = {
      days: [
        {
          id: "standard_tour_target_day_1",
          day_number: 1,
          date: "2026-08-10",
          title: "Old target day",
          overnight_location: "Da Nang",
          services: [],
          notes: ""
        }
      ]
    };
    targetRecord.pdf_personalization = {
      travel_plan: {
        subtitle: "Old target subtitle"
      },
      offer: {
        closing: "Target offer closing marker"
      }
    };
    await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

    const standardTourCreateResult = await requestJson(
      endpointPath("standard_tour_create"),
      apiHeaders(),
      {
        method: "POST",
        body: {
          title: standardTourTitle,
          travel_plan: sourceRecord.travel_plan
        }
      }
    );
    assert.equal(standardTourCreateResult.status, 201);
    assert.equal(standardTourCreateResult.body.standard_tour.title, standardTourTitle);
    assert.deepEqual(standardTourCreateResult.body.standard_tour.destinations, []);
    assert.ok(standardTourCreateResult.body.standard_tour.travel_plan);
    assert.ok(!("source_booking_id" in standardTourCreateResult.body.standard_tour));
    assert.ok(!("description" in standardTourCreateResult.body.standard_tour));
    assert.ok(!("created_at" in standardTourCreateResult.body.standard_tour));
    assert.ok(!("updated_at" in standardTourCreateResult.body.standard_tour));

    const applyResult = await requestJson(
      endpointPath("booking_standard_tour_apply")
        .replace("{booking_id}", targetBooking.id)
        .replace("{standard_tour_id}", standardTourCreateResult.body.standard_tour.id),
      apiHeaders(),
      {
        method: "POST",
        body: {
          expected_travel_plan_revision: targetBooking.travel_plan_revision
        }
      }
    );
    assert.equal(applyResult.status, 200);
    assert.equal(applyResult.body.booking.travel_plan.days.length, 1);
    assert.equal(applyResult.body.booking.travel_plan.days[0].title, "Standard tour day marker");
    assert.equal(applyResult.body.booking.travel_plan.days[0].services[0].title, "Standard tour service marker");
    assert.equal(applyResult.body.booking.pdf_personalization.travel_plan.subtitle, "Old target subtitle");
    assert.equal(applyResult.body.booking.pdf_personalization.offer.closing, "Target offer closing marker");
  } finally {
    await removeStandardToursByTitlePrefix("Standard tour copy marker");
  }
});

test("standard tour titles must be unique", async () => {
  const sourceBooking = await createSeedBooking();
  const primaryTitle = `Summer Escape ${sourceBooking.id}`;
  const secondaryTitle = `Mekong Explorer ${sourceBooking.id}`;

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const sourceRecord = store.bookings.find((item) => item.id === sourceBooking.id);
  assert.ok(sourceRecord);
  sourceRecord.travel_plan = {
    days: [
      {
        id: "duplicate_title_day_1",
        day_number: 1,
        date: "2026-08-15",
        title: "Duplicate title source day",
        overnight_location: "Bangkok",
        services: [],
        notes: ""
      }
    ]
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const firstCreateResult = await requestJson(
    endpointPath("standard_tour_create"),
    apiHeaders(),
    {
      method: "POST",
      body: {
        title: primaryTitle,
        travel_plan: sourceRecord.travel_plan
      }
    }
  );
  assert.equal(firstCreateResult.status, 201);

  const secondCreateResult = await requestJson(
    endpointPath("standard_tour_create"),
    apiHeaders(),
    {
      method: "POST",
      body: {
        title: secondaryTitle,
        travel_plan: sourceRecord.travel_plan
      }
    }
  );
  assert.equal(secondCreateResult.status, 201);

  const duplicateCreateResult = await requestJson(
    endpointPath("standard_tour_create"),
    apiHeaders(),
    {
      method: "POST",
      body: {
        title: `  ${primaryTitle.toLowerCase()}  `,
        travel_plan: sourceRecord.travel_plan
      }
    }
  );
  assert.equal(duplicateCreateResult.status, 409);
  assert.equal(duplicateCreateResult.body.error, "A standard tour with this title already exists.");

  const duplicatePatchResult = await requestJson(
    endpointPath("standard_tour_update").replace("{standard_tour_id}", secondCreateResult.body.standard_tour.id),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        title: primaryTitle.toUpperCase()
      }
    }
  );
  assert.equal(duplicatePatchResult.status, 409);
  assert.equal(duplicatePatchResult.body.error, "A standard tour with this title already exists.");
});

test("service image can be deleted", async () => {
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
        services: [
          {
            id: "travel_item_1",
            timing_kind: "label",
            time_label: "Morning",
            kind: "activity",
            title: "Citadel visit",
            details: "Guided walk",
            location: "Hue",
            image: {
              id: "item_image_a",
              storage_path: "/public/v1/booking-images/a.webp",
              sort_order: 0,
              is_primary: true,
              is_customer_visible: true
            }
          }
        ],
        notes: ""
      }
    ]
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const deleteResult = await requestJson(
    endpointPath("booking_travel_plan_service_image_delete")
      .replace("{booking_id}", booking.id)
      .replace("{day_id}", "travel_day_1")
      .replace("{service_id}", "travel_item_1"),
    apiHeaders(),
    {
      method: "DELETE",
      body: {
        expected_travel_plan_revision: booking.travel_plan_revision
      }
    }
  );
  assert.equal(deleteResult.status, 200);
  assert.equal(deleteResult.body.booking.travel_plan.days[0].services[0].image, null);
});

test("service image upload keeps exactly one image", { skip: !HAS_MAGICK }, async () => {
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
        services: [
          {
            id: "travel_item_upload_1",
            timing_kind: "label",
            time_label: "Anytime",
            kind: "activity",
            title: "Photo item",
            details: "",
            location: "Hanoi",
            image: {
              id: "travel_item_upload_image_1",
              storage_path: "/public/v1/booking-images/old.webp",
              sort_order: 0,
              is_primary: true,
              is_customer_visible: true
            }
          }
        ],
        notes: ""
      }
    ]
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const uploadResult = await requestJson(
    endpointPath("booking_travel_plan_service_image_upload")
      .replace("{booking_id}", booking.id)
      .replace("{day_id}", "travel_day_upload_1")
      .replace("{service_id}", "travel_item_upload_1"),
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
  const uploadedImage = uploadResult.body.booking.travel_plan.days[0].services[0].image;
  assert.ok(uploadedImage);
  assert.notEqual(uploadedImage.id, "travel_item_upload_image_1");
  assert.match(String(uploadedImage.storage_path || ""), /^\/public\/v1\/booking-images\//);
  assert.equal(uploadedImage.is_primary, true);
});

test("travel plan PDF attachments normalize non-A4 uploads and append to travel-plan and generated-offer PDFs", async () => {
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
              services: [
                {
                  id: "travel_plan_service_attachment_1",
                  timing_kind: "label",
                  time_label: "Afternoon",
                  kind: "accommodation",
                  title: "Riverside hotel check-in",
                  details: "Private transfer and hotel arrival.",
                  location: "Hoi An"
                }
              ]
            }
          ]
        }
      }
    }
  );
  if (travelPlanPatchResult.status !== 200) {
    throw new Error(`deposit-freeze travelPlanPatchResult: ${JSON.stringify(travelPlanPatchResult.body)}`);
  }
  assert.equal(travelPlanPatchResult.status, 200);

  const offerPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        offer: buildTripOfferDraft(createdBooking.offer, createdBooking.preferred_currency, 16500)
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

  const generatedOfferPdfPath = path.join(TEST_DATA_DIR, "pdfs", "generated_offers", `${generatedOffer.id}.pdf`);

  const initialTravelPlanPdfCreate = await requestJson(
    endpointPath("booking_travel_plan_pdf_create").replace("{booking_id}", bookingId),
    apiHeaders()
    ,
    {
      method: "POST",
      body: {
        expected_travel_plan_revision: travelPlanPatchResult.body.booking.travel_plan_revision,
        lang: "en"
      }
    }
  );
  assert.equal(initialTravelPlanPdfCreate.status, 201);
  const initialTravelPlanArtifact = initialTravelPlanPdfCreate.body.artifact;
  assert.match(
    String(initialTravelPlanArtifact.filename || ""),
    /Asia Travel Plan \d{4}-\d{2}-\d{2}-1\.pdf/,
    "The first generated travel-plan PDF of the day should use the numbered Asia Travel Plan filename"
  );
  const travelPlanPdfPath = path.join(TEST_DATA_DIR, "pdfs", "travel_plans", bookingId, `${initialTravelPlanArtifact.id}.pdf`);
  const initialTravelPlanPdfDoc = await PDFLibDocument.load(await readFile(travelPlanPdfPath));
  const initialTravelPlanPageCount = initialTravelPlanPdfDoc.getPageCount();

  const bookingAfterInitialTravelPlanPdf = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(bookingAfterInitialTravelPlanPdf.status, 200);
  assert.equal(bookingAfterInitialTravelPlanPdf.body.booking.travel_plan_pdfs.length, 1);
  assert.match(
    String(bookingAfterInitialTravelPlanPdf.body.booking.travel_plan_pdfs[0].filename || ""),
    /Asia Travel Plan \d{4}-\d{2}-\d{2}-1\.pdf/,
    "Booking detail should list the first persisted travel-plan PDF artifact"
  );

  const previewTravelPlanPdf = await requestRaw(
    `${endpointPath("booking_travel_plan_pdf").replace("{booking_id}", bookingId)}?lang=en&preview=1`,
    apiHeaders()
  );
  assert.equal(previewTravelPlanPdf.status, 200);
  assert.match(
    String(previewTravelPlanPdf.headers["content-disposition"] || ""),
    /Asia Travel Plan \d{4}-\d{2}-\d{2}\.pdf/,
    "Preview travel-plan PDFs should use the base Asia Travel Plan filename without persisting a numbered artifact"
  );

  const bookingAfterPreviewTravelPlanPdf = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(bookingAfterPreviewTravelPlanPdf.status, 200);
  assert.equal(
    bookingAfterPreviewTravelPlanPdf.body.booking.travel_plan_pdfs.length,
    1,
    "Preview travel-plan PDFs should not create stored travel-plan PDF rows"
  );

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
  assert.equal(letterUploadResult.status, 200);
  assert.equal(letterUploadResult.body.booking.travel_plan.attachments.length, 1);
  assert.equal(letterUploadResult.body.booking.travel_plan.attachments[0].page_count, 1);

  const normalizedLetterAttachmentId = letterUploadResult.body.booking.travel_plan.attachments[0].id;
  const normalizedLetterAttachmentPdfResult = await requestRaw(
    endpointPath("booking_travel_plan_attachment_pdf")
      .replace("{booking_id}", bookingId)
      .replace("{attachment_id}", normalizedLetterAttachmentId),
    apiHeaders()
  );
  assert.equal(normalizedLetterAttachmentPdfResult.status, 200);
  const normalizedLetterStoragePath = String(letterUploadResult.body.booking.travel_plan.attachments[0].storage_path || "");
  const normalizedLetterAttachmentPdf = await PDFLibDocument.load(
    await readFile(path.join(TEST_DATA_DIR, "pdfs", "attachments", normalizedLetterStoragePath))
  );
  assert.equal(normalizedLetterAttachmentPdf.getPageCount(), 1);
  {
    const [page] = normalizedLetterAttachmentPdf.getPages();
    assert.ok(Math.abs(page.getWidth() - 595.275591) < 0.1);
    assert.ok(Math.abs(page.getHeight() - 841.889764) < 0.1);
  }

  const uploadResult = await requestJson(
    endpointPath("booking_travel_plan_attachment_upload").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_travel_plan_revision: letterUploadResult.body.booking.travel_plan_revision,
        filename: "appendix-a4.pdf",
        mime_type: "application/pdf",
        data_base64: await createPdfBase64WithText([[595.275591, 841.889764]])
      }
    }
  );
  assert.equal(uploadResult.status, 200);
  assert.equal(uploadResult.body.booking.travel_plan.attachments.length, 2);
  assert.equal(uploadResult.body.booking.travel_plan.attachments[1].page_count, 1);

  const attachmentId = uploadResult.body.booking.travel_plan.attachments[1].id;
  const attachmentPdfResult = await requestRaw(
    endpointPath("booking_travel_plan_attachment_pdf")
      .replace("{booking_id}", bookingId)
      .replace("{attachment_id}", attachmentId),
    apiHeaders()
  );
  assert.equal(attachmentPdfResult.status, 200);
  assert.match(
    String(attachmentPdfResult.headers["content-disposition"] || ""),
    /appendix-a4\.pdf/,
    "Travel-plan attachment PDF downloads should serve the stored appendix inline"
  );

  const mergedTravelPlanPdfCreate = await requestJson(
    endpointPath("booking_travel_plan_pdf_create").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_travel_plan_revision: uploadResult.body.booking.travel_plan_revision,
        lang: "en",
        comment: "Travel plan note"
      }
    }
  );
  assert.equal(mergedTravelPlanPdfCreate.status, 201);
  const mergedTravelPlanArtifact = mergedTravelPlanPdfCreate.body.artifact;
  assert.match(
    String(mergedTravelPlanArtifact.filename || ""),
    /Asia Travel Plan \d{4}-\d{2}-\d{2}-2\.pdf/,
    "A second generated travel-plan PDF on the same day should increment the filename suffix"
  );
  const mergedTravelPlanPdfDoc = await PDFLibDocument.load(
    await readFile(path.join(TEST_DATA_DIR, "pdfs", "travel_plans", bookingId, `${mergedTravelPlanArtifact.id}.pdf`))
  );
  assert.equal(mergedTravelPlanPdfDoc.getPageCount(), initialTravelPlanPageCount + 2);

  const bookingAfterMergedTravelPlanPdf = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(bookingAfterMergedTravelPlanPdf.status, 200);
  assert.equal(bookingAfterMergedTravelPlanPdf.body.booking.travel_plan_pdfs.length, 2);
  assert.match(
    String(bookingAfterMergedTravelPlanPdf.body.booking.travel_plan_pdfs[0].pdf_url || ""),
    /\/travel-plan\/pdfs\/[^/]+\/pdf$/,
    "Persisted travel-plan PDF rows should point to a specific stored artifact"
  );
  const persistedTravelPlanPdf = await requestRaw(
    String(bookingAfterMergedTravelPlanPdf.body.booking.travel_plan_pdfs[0].pdf_url || "").replace("http://localhost", ""),
    apiHeaders()
  );
  assert.equal(persistedTravelPlanPdf.status, 200);
  const persistedTravelPlanPdfRow = bookingAfterMergedTravelPlanPdf.body.booking.travel_plan_pdfs[0];
  const persistedTravelPlanPdfId = String(persistedTravelPlanPdfRow.id || "");
  assert.equal(
    persistedTravelPlanPdfRow.sent_to_customer,
    false,
    "Newly generated travel-plan PDFs should default to not sent to customer"
  );
  assert.equal(
    persistedTravelPlanPdfRow.comment,
    "Travel plan note",
    "Travel-plan PDF rows should persist the optional PDF comment"
  );

  const updateTravelPlanPdfCommentResult = await requestJson(
    endpointPath("booking_travel_plan_pdf_update")
      .replace("{booking_id}", bookingId)
      .replace("{artifact_id}", persistedTravelPlanPdfId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: bookingAfterMergedTravelPlanPdf.body.booking.travel_plan_revision,
        comment: "Updated travel plan note"
      }
    }
  );
  assert.equal(updateTravelPlanPdfCommentResult.status, 200);
  assert.equal(
    updateTravelPlanPdfCommentResult.body.booking.travel_plan_pdfs.find((item) => item.id === persistedTravelPlanPdfId)?.comment,
    "Updated travel plan note",
    "Travel-plan PDF rows should allow updating the persisted PDF comment after creation"
  );

  const markTravelPlanPdfSentResult = await requestJson(
    endpointPath("booking_travel_plan_pdf_update")
      .replace("{booking_id}", bookingId)
      .replace("{artifact_id}", persistedTravelPlanPdfId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: updateTravelPlanPdfCommentResult.body.booking.travel_plan_revision,
        sent_to_customer: true
      }
    }
  );
  assert.equal(markTravelPlanPdfSentResult.status, 200);
  assert.equal(
    markTravelPlanPdfSentResult.body.booking.travel_plan_pdfs.find((item) => item.id === persistedTravelPlanPdfId)?.sent_to_customer,
    true,
    "Travel-plan PDF rows should persist the sent-to-customer flag"
  );
  assert.equal(
    markTravelPlanPdfSentResult.body.booking.travel_plan_pdfs.find((item) => item.id === persistedTravelPlanPdfId)?.comment,
    "Updated travel plan note",
    "Travel-plan PDF sent-state updates should preserve the stored PDF comment"
  );

  const rejectSentTravelPlanPdfDeleteResult = await requestJson(
    endpointPath("booking_travel_plan_pdf_delete")
      .replace("{booking_id}", bookingId)
      .replace("{artifact_id}", persistedTravelPlanPdfId),
    apiHeaders(),
    {
      method: "DELETE",
      body: {
        expected_travel_plan_revision: markTravelPlanPdfSentResult.body.booking.travel_plan_revision
      }
    }
  );
  assert.equal(rejectSentTravelPlanPdfDeleteResult.status, 422);
  assert.match(
    String(rejectSentTravelPlanPdfDeleteResult.body.error || ""),
    /sent to customer/i,
    "Deleting a sent travel-plan PDF should be rejected"
  );

  const unmarkTravelPlanPdfSentResult = await requestJson(
    endpointPath("booking_travel_plan_pdf_update")
      .replace("{booking_id}", bookingId)
      .replace("{artifact_id}", persistedTravelPlanPdfId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_travel_plan_revision: markTravelPlanPdfSentResult.body.booking.travel_plan_revision,
        sent_to_customer: false
      }
    }
  );
  assert.equal(unmarkTravelPlanPdfSentResult.status, 200);
  assert.equal(
    unmarkTravelPlanPdfSentResult.body.booking.travel_plan_pdfs.find((item) => item.id === persistedTravelPlanPdfId)?.sent_to_customer,
    false
  );

  const deleteTravelPlanPdfResult = await requestJson(
    endpointPath("booking_travel_plan_pdf_delete")
      .replace("{booking_id}", bookingId)
      .replace("{artifact_id}", persistedTravelPlanPdfId),
    apiHeaders(),
    {
      method: "DELETE",
      body: {
        expected_travel_plan_revision: unmarkTravelPlanPdfSentResult.body.booking.travel_plan_revision
      }
    }
  );
  assert.equal(deleteTravelPlanPdfResult.status, 200);
  assert.equal(deleteTravelPlanPdfResult.body.booking.travel_plan_pdfs.length, 1);
  assert.equal(
    deleteTravelPlanPdfResult.body.booking.travel_plan_pdfs.some((item) => item.id === persistedTravelPlanPdfId),
    false,
    "Deleting an unsent travel-plan PDF should remove it from booking detail"
  );

  const mergedGeneratedOfferPdf = await requestRaw(
    endpointPath("booking_generated_offer_pdf")
      .replace("{booking_id}", bookingId)
      .replace("{generated_offer_id}", generatedOffer.id),
    apiHeaders()
  );
  assert.equal(mergedGeneratedOfferPdf.status, 200);
  const mergedGeneratedOfferPdfDoc = await PDFLibDocument.load(await readFile(generatedOfferPdfPath));
  assert.equal(mergedGeneratedOfferPdfDoc.getPageCount(), initialGeneratedOfferPageCount + 2);
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
        offer: buildTripOfferDraft(createdBooking.offer, createdBooking.preferred_currency, 30000)
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
              services: [
                {
                  id: "travel_plan_service_1",
                  timing_kind: "point",
                  time_point: "2026-04-10T19:00",
                  kind: "transport",
                  title: "Airport transfer",
                  details: "Private transfer from Da Nang airport to the hotel in Hoi An."
                },
                {
                  id: "travel_plan_service_2",
                  timing_kind: "label",
                  time_label: "Evening",
                  kind: "accommodation",
                  title: "Hotel check-in",
                  location: "Hoi An"
                }
              ]
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
  assert.equal(generatedOffer.offer.trip_price_internal.amount_cents, 30000);
  assert.equal(generatedOffer.travel_plan.days.length, 1);
  assert.equal(generatedOffer.travel_plan.days[0].title, "Arrival in Hoi An");
  assert.equal(generatedOffer.travel_plan.days[0].services[0].title, "Airport transfer");
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
        offer: buildTripOfferDraft(generateResult.body.booking.offer, createdBooking.preferred_currency, 54000)
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
              services: [
                {
                  id: "travel_plan_service_1",
                  timing_kind: "point",
                  time_point: "2026-04-10T20:00",
                  kind: "transport",
                  title: "Updated airport transfer"
                }
              ]
            }
          ]
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
  assert.equal(detailAfter.body.booking.generated_offers[0].offer.trip_price_internal.amount_cents, 30000);
  assert.equal(detailAfter.body.booking.generated_offers[0].travel_plan.days[0].title, "Arrival in Hoi An");
  assert.equal(detailAfter.body.booking.generated_offers[0].travel_plan.days[0].services[0].title, "Airport transfer");
  assert.equal(detailAfter.body.booking.offer.trip_price_internal.amount_cents, 54000);
  assert.equal(detailAfter.body.booking.travel_plan.days[0].title, "Updated arrival plan");
  assert.equal(detailAfter.body.booking.travel_plan.days[0].services[0].title, "Updated airport transfer");
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
        offer: buildTripOfferDraft(createdBooking.offer, createdBooking.preferred_currency, 12000)
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
              services: [
                {
                  id: "travel_plan_service_1",
                  kind: "accommodation",
                  title: "Hotel check-in"
                }
              ]
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
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const detailResult = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailResult.status, 200);
  assert.deepEqual(
    detailResult.body.booking.generated_offers[0].travel_plan.days[0].services[0],
    generatedOfferRecord.travel_plan.days[0].services[0]
  );
});

test("contract metadata exposes the generated offer gmail draft endpoint", async () => {
  assert.equal(
    endpointPath("booking_generated_offer_gmail_draft"),
    "/api/v1/bookings/{booking_id}/generated-offers/{generated_offer_id}/gmail-draft"
  );
});

test("contract metadata no longer exposes public generated offer access endpoints", async () => {
  assert.equal(
    contractMeta.endpoints.some((endpoint) => endpoint.key === "public_generated_offer_access"),
    false
  );
  assert.equal(
    contractMeta.endpoints.some((endpoint) => endpoint.key === "public_generated_offer_pdf"),
    false
  );
});

test("contract metadata exposes the booking travel plan pdf endpoint", async () => {
  assert.equal(
    endpointPath("booking_travel_plan_pdf"),
    "/api/v1/bookings/{booking_id}/travel-plan/pdf"
  );
  assert.equal(
    endpointPath("booking_travel_plan_pdf_create"),
    "/api/v1/bookings/{booking_id}/travel-plan/pdfs"
  );
  assert.equal(
    endpointPath("booking_travel_plan_pdf_artifact_pdf"),
    "/api/v1/bookings/{booking_id}/travel-plan/pdfs/{artifact_id}/pdf"
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
      services: [{
        id: "travel_plan_service_pdf_marker",
        timing_kind: "point",
        time_point: "2026-03-20T14:00",
        kind: "activity",
        title: "PublicItemMarker731",
        location: "Hoi An",
        details: "PublicDetailsMarker731",
        images: []
      }]
    }]
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const pdfResult = await requestRaw(
    `${endpointPath("booking_travel_plan_pdf").replace("{booking_id}", bookingId)}?lang=en`,
    apiHeaders()
  );
  assert.equal(pdfResult.status, 200);
  assert.equal(pdfResult.headers["content-type"], "application/pdf");
  assert.match(
    String(pdfResult.headers["content-disposition"] || ""),
    /Asia Travel Plan \d{4}-\d{2}-\d{2}(?:-[A-Za-z0-9-]+)?\.pdf/
  );
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

test("booking travel plan pdf includes the assigned ATP guide section with the guide short description", async () => {
  const createdBooking = await createSeedBooking({
    destinations: ["Vietnam", "Laos"],
    travel_style: ["Wellness", "Culture"]
  });
  const bookingId = createdBooking.id;
  const guideProfileUpdatePath = endpointPath("keycloak_user_staff_profile_update").replace("{username}", "joachim");
  const guideName = "Joachim";
  const guideFriendlyShortName = "Joachim";
  const guideShortDescription = "Specializes in soft-paced Southeast Asia itineraries with a strong eye for comfort.";

  const detailBefore = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailBefore.status, 200);

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingRecord = store.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingRecord);
  bookingRecord.travel_plan = {
    days: [{
      id: "travel_plan_day_guide_order_1",
      day_number: 1,
      date: "2026-03-20",
      title: "GuideOrderDayMarker",
      services: [{
        id: "travel_plan_service_guide_order_1",
        kind: "activity",
        title: "GuideOrderServiceMarker",
        images: []
      }]
    }]
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const guideProfileUpdateResult = await requestJson(
    guideProfileUpdatePath,
    apiHeaders("atp_admin", "admin", "kc-admin"),
    {
      method: "PATCH",
      body: {
        name: guideName,
        friendly_short_name: guideFriendlyShortName,
        languages: ["de", "en", "vi"],
        short_description: guideShortDescription,
        short_description_i18n: [{ lang: "en", value: guideShortDescription }]
      }
    }
  );
  assert.equal(guideProfileUpdateResult.status, 200);

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
  assert.match(decodedText, /OurteammemberJoachimwillassistyou/);
  assert.match(
    decodedText,
    /Specializesinsoft-pacedSoutheastAsiaitineraries/
  );
  assert.ok(
    decodedText.indexOf("OurteammemberJoachimwillassistyou") < decodedText.indexOf("GuideOrderDayMarker"),
    "Expected the guide section title on the first page before the travel plan day section"
  );
  assert.ok(
    decodedText.indexOf("Specializesinsoft-pacedSoutheastAsiaitineraries") < decodedText.indexOf("GuideOrderDayMarker"),
    "Expected the detailed guide card body to move with the guide section before the travel plan day section"
  );
  assert.doesNotMatch(decodedText, /JoachimfromAsiaTravelPlanwillkeepthisroutecomfortableandwellpacedforyou/);
  assert.doesNotMatch(decodedText, /Languages:DE·EN·VI|Languages:DEENVI/);
});

test("booking travel plan pdf renders personalized copy and accommodation line", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingRecord = store.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingRecord);

  bookingRecord.travel_plan = {
    ...(bookingRecord.travel_plan || {}),
    destinations: ["VN", "KH"]
  };
  bookingRecord.pdf_personalization = {
    travel_plan: {
      subtitle: "12 days in Vietnam and Cambodia",
      subtitle_i18n: {
        en: "12 days in Vietnam and Cambodia"
      },
      welcome: "This is your current travel plan.",
      welcome_i18n: {
        en: "This is your current travel plan."
      },
      closing: "We would be happy to refine anything together.",
      closing_i18n: {
        en: "We would be happy to refine anything together."
      },
      include_who_is_traveling: true
    }
  };
  bookingRecord.persons = [
    {
      id: "booking_person_traveler_pdf_1",
      name: "Traveler Marker One",
      roles: ["traveler", "primary_contact"]
    },
    {
      id: "booking_person_traveler_pdf_2",
      name: "Traveler Marker Two",
      roles: ["traveler"]
    }
  ];
  bookingRecord.travel_plan = {
    days: [{
      id: "travel_plan_day_personalized_1",
      day_number: 1,
      date: "2026-03-20",
      title: "Arrival day",
      overnight_location: "Hoi An",
      services: [
        {
          id: "travel_plan_service_hotel_1",
          kind: "accommodation",
          title: "Lantern Boutique Hotel"
        },
        {
          id: "travel_plan_service_activity_1",
          kind: "activity",
          title: "Airport transfer",
          details: "Private transfer to the hotel",
          images: []
        }
      ]
    }]
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  const pdfResult = await requestRaw(
    `${endpointPath("booking_travel_plan_pdf").replace("{booking_id}", bookingId)}?lang=en`,
    apiHeaders()
  );
  assert.equal(pdfResult.status, 200);
  const decodedText = normalizeExtractedPdfText(decodePdfHexText(pdfResult.body));
  assert.match(decodedText, /12daysinVietnamandCambodia/);
  assert.match(decodedText, /Thisisyourcurrenttravelplan\./);
  assert.match(decodedText, /Youwillstayat:LanternBoutiqueHotel/);
  assert.match(decodedText, /Whoistraveling/);
  assert.match(decodedText, /TravelerMarkerOne/);
  assert.match(decodedText, /TravelerMarkerTwo/);
  assert.ok(
    decodedText.indexOf("Arrivalday") < decodedText.indexOf("Whoistraveling"),
    "Expected traveler list after the travel plan section"
  );
  assert.match(decodedText, /Wewouldbehappytorefineanythingtogether\./);
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

test("booking generated offer pdf renders customer-visible day pricing while keeping additional items visible", async () => {
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
          ...buildDayOfferDraft(createdBooking.offer, createdBooking.preferred_currency, [12000, 8000]),
          additional_items: [
            {
              id: "offer_additional_item_visible_pdf",
              label: "VisibleAddonMarkerGamma",
              details: "VisibleAddonMarkerDelta",
              quantity: 1,
              unit_amount_cents: 1500,
              tax_rate_basis_points: 0,
              currency: createdBooking.preferred_currency,
              sort_order: 0
            }
          ]
        }
      }
    }
  );
  assert.equal(offerPatchResult.status, 200);
  assert.equal(offerPatchResult.body.booking.offer.visible_pricing.detail_level, "day");

  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: offerPatchResult.body.booking.offer_revision,
        comment: "Visible pricing PDF check"
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
  assert.match(pdfResult.body, /%PDF-/);
  assert.equal(generatedOffer.offer.visible_pricing.detail_level, "day");
  assert.equal(generatedOffer.offer.visible_pricing.derivable, true);
  assert.equal(generatedOffer.offer.visible_pricing.days.length, 2);
  assert.equal(generatedOffer.offer.visible_pricing.additional_items.length, 1);
  const source = await readFile(path.join(__dirname, "..", "src", "lib", "offer_pdf.js"), "utf8");
  assert.match(source, /visible_pricing/);
  assert.match(source, /buildOfferTableRows/);
  assert.match(source, /additional_items/);
});

test("booking generated offer pdf wiring keeps the commercial summary before the detailed appendix", async () => {
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

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingRecord = store.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingRecord);
  bookingRecord.travel_plan = {
    days: [{
      id: "travel_plan_day_offer_guide_order_1",
      day_number: 1,
      date: "2026-03-21",
      title: "OfferGuideOrderDayMarker",
      services: [{
        id: "travel_plan_service_offer_guide_order_1",
        kind: "activity",
        title: "OfferGuideOrderServiceMarker",
        images: []
      }]
    }]
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

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
        comment: "Offer PDF structure check"
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
  assert.ok(
    source.indexOf("y = drawOfferItinerarySummary(doc, generatedOffer, booking, y, fonts, lang);")
      < source.indexOf("y = drawOfferTable(doc, generatedOffer, y, renderMoney, fonts, lang);"),
    "Expected the offer PDF writer to render the short itinerary summary before the financial overview"
  );
  assert.ok(
    source.indexOf("y = drawPaymentTerms(doc, generatedOffer, y, renderMoney, fonts, lang);")
      < source.indexOf("y = drawBankDetails(doc, companyProfile, y, fonts, lang);"),
    "Expected the offer PDF writer to render bank details after payment terms"
  );
  assert.ok(
    source.indexOf("y = drawClosing(doc, y, fonts, lang, generatedOffer, renderMoney, {")
      < source.indexOf("y = drawOfferDetailedTravelPlanAppendix(doc, generatedOffer, booking, y, fonts, lang, itemThumbnailMap);"),
    "Expected the detailed travel-plan appendix to be rendered after the commercial offer sections"
  );
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
  const pdfPath = path.join(TEST_DATA_DIR, "pdfs", "generated_offers", `${generatedOffer.id}.pdf`);
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

test("booking generated offers no longer persist management confirmation metadata", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const storeBeforeGenerate = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingBeforeGenerate = storeBeforeGenerate.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingBeforeGenerate);
  bookingBeforeGenerate.assigned_keycloak_user_id = "kc-joachim";
  bookingBeforeGenerate.assigned_keycloak_user_label = "Joachim";
  await writeFile(STORE_PATH, `${JSON.stringify(storeBeforeGenerate, null, 2)}\n`, "utf8");

  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        comment: "Management approval"
      }
    }
  );
  assert.equal(generateResult.status, 201);
  const generatedOffer = generateResult.body.booking.generated_offers[0];
  assert.equal(generatedOffer.management_approver_atp_staff_id, undefined);
  assert.equal(generatedOffer.management_approver_label, undefined);
  assert.equal(generatedOffer.booking_confirmation, undefined);
  assert.equal(generatedOffer.customer_confirmation_flow, undefined);
  assert.equal(generatedOffer.public_booking_confirmation_token, undefined);
});

test("deposit receipt freezes the accepted customer record and keeps it stable after later offer edits", async () => {
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
            basis_total_amount_cents: 13200,
            lines: [
              {
                id: "payment_term_frozen_deposit",
                kind: "DEPOSIT",
                label: "Deposit",
                sequence: 1,
                amount_spec: {
                  mode: "FIXED_AMOUNT",
                  fixed_amount_cents: 3300
                },
                due_rule: {
                  type: "DAYS_AFTER_ACCEPTANCE",
                  days: 0
                }
              },
              {
                id: "payment_term_frozen_final",
                kind: "FINAL_BALANCE",
                label: "Final payment",
                sequence: 2,
                amount_spec: {
                  mode: "REMAINING_BALANCE"
                },
                due_rule: {
                  type: "DAYS_BEFORE_TRIP_START",
                  days: 14
                }
              }
            ]
          },
          components: [
            {
              id: "offer_component_frozen_service_1",
              category: "ACCOMMODATION",
              label: "Accommodation",
              details: "Accepted resort stay",
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
        expected_travel_plan_revision: offerPatchResult.body.booking.travel_plan_revision,
        travel_plan: {
          days: [
            {
              id: "travel_plan_day_frozen_1",
              day_number: 1,
              date: "2026-04-10",
              title: "Arrival day",
              overnight_location: "Hoi An",
              services: [
                {
                  id: "travel_plan_service_frozen_1",
                  timing_kind: "point",
                  time_point: "2026-04-10T18:30",
                  kind: "transport",
                  title: "Airport pickup",
                  details: "Private airport pickup."
                },
                {
                  id: "travel_plan_service_frozen_2",
                  timing_kind: "label",
                  time_label: "Evening",
                  kind: "accommodation",
                  title: "Resort check-in",
                  location: "Hoi An"
                }
              ]
            }
          ]
        }
      }
    }
  );
  assert.equal(travelPlanPatchResult.status, 200);

  const firstPaymentRequestResult = await requestJson(
    endpointPath("booking_payment_document_create").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_payment_documents_revision: travelPlanPatchResult.body.booking.payment_documents_revision,
        payment_id: "payment_term_frozen_deposit",
        document_kind: "PAYMENT_REQUEST",
        lang: "en",
        content_lang: "en",
        source_lang: "en"
      }
    }
  );
  assert.equal(firstPaymentRequestResult.status, 201, JSON.stringify(firstPaymentRequestResult.body));

  const depositReceivedAt = "2026-04-10T09:15:00.000Z";

  const depositReceiptResult = await requestJson(
    endpointPath("booking_payment_document_create").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_payment_documents_revision: firstPaymentRequestResult.body.booking.payment_documents_revision,
        payment_id: "payment_term_frozen_deposit",
        document_kind: "PAYMENT_CONFIRMATION",
        lang: "en",
        content_lang: "en",
        source_lang: "en",
        payment_received_at: depositReceivedAt,
        payment_confirmed_by_atp_staff_id: "kc-joachim",
        payment_reference: "BANK-REF-001"
      }
    }
  );
  assert.equal(depositReceiptResult.status, 201);
  assert.equal(depositReceiptResult.body.booking.deposit_received_at, depositReceivedAt);
  assert.equal(depositReceiptResult.body.booking.deposit_confirmed_by_atp_staff_id, "kc-joachim");
  assert.equal(
    depositReceiptResult.body.booking.payment_documents_revision,
    firstPaymentRequestResult.body.booking.payment_documents_revision + 1
  );
  assert.equal(depositReceiptResult.body.booking.core_revision, firstPaymentRequestResult.body.booking.core_revision + 1);
  assert.equal(depositReceiptResult.body.booking.accepted_record.available, true);
  assert.equal(depositReceiptResult.body.booking.accepted_record.deposit_received_at, depositReceivedAt);
  assert.equal(depositReceiptResult.body.booking.accepted_record.deposit_confirmed_by_atp_staff_id, "kc-joachim");
  assert.equal(depositReceiptResult.body.booking.accepted_record.deposit_confirmed_by_label, "Joachim");
  assert.equal(depositReceiptResult.body.booking.accepted_record.accepted_deposit_amount_cents, 3300);
  assert.equal(depositReceiptResult.body.booking.accepted_record.accepted_deposit_currency, createdBooking.preferred_currency);
  assert.equal(depositReceiptResult.body.booking.accepted_record.accepted_deposit_reference, "BANK-REF-001");
  assert.equal(
    depositReceiptResult.body.booking.accepted_record.payment_terms.lines[0].resolved_amount_cents,
    3300
  );
  assert.equal(
    depositReceiptResult.body.booking.accepted_record.travel_plan.days[0].services[0].title,
    "Airport pickup"
  );

  const storeAfterReceipt = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const mutableBookingRecord = storeAfterReceipt.bookings.find((item) => item.id === bookingId);
  assert.ok(mutableBookingRecord);
  mutableBookingRecord.offer.payment_terms.lines[0].label = "Changed after deposit receipt";
  mutableBookingRecord.offer.payment_terms.lines[0].amount_spec.fixed_amount_cents = 4400;
  await writeFile(STORE_PATH, `${JSON.stringify(storeAfterReceipt, null, 2)}\n`, "utf8");

  const detailAfterMutation = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailAfterMutation.status, 200);
  assert.equal(
    detailAfterMutation.body.booking.offer.payment_terms.lines[0].label,
    "Changed after deposit receipt"
  );
  assert.equal(
    detailAfterMutation.body.booking.accepted_record.accepted_deposit_amount_cents,
    3300
  );
  assert.equal(
    detailAfterMutation.body.booking.accepted_record.payment_terms.lines[0].label,
    "Deposit"
  );
  assert.equal(
    detailAfterMutation.body.booking.accepted_record.travel_plan.days[0].services[0].title,
    "Airport pickup"
  );

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingRecord = store.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingRecord);
  assert.equal(bookingRecord.deposit_received_at, depositReceivedAt);
  assert.equal(bookingRecord.deposit_confirmed_by_atp_staff_id, "kc-joachim");
  assert.equal(bookingRecord.accepted_deposit_reference, "BANK-REF-001");
  assert.equal(bookingRecord.accepted_payment_terms_snapshot.lines[0].id, "payment_term_frozen_deposit");
  assert.equal(bookingRecord.accepted_travel_plan_snapshot.days[0].services[0].title, "Airport pickup");
});

test("multiple generated offers can coexist without confirmation state", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const storeBeforeGenerate = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingBeforeGenerate = storeBeforeGenerate.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingBeforeGenerate);
  bookingBeforeGenerate.assigned_keycloak_user_id = "kc-joachim";
  bookingBeforeGenerate.assigned_keycloak_user_label = "Joachim";
  await writeFile(STORE_PATH, `${JSON.stringify(storeBeforeGenerate, null, 2)}\n`, "utf8");

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
  assert.equal(firstGeneratedOfferId.length > 0, true);
  assert.equal(secondGenerateResult.body.booking.generated_offers[0].booking_confirmation, undefined);
  assert.equal(secondGenerateResult.body.booking.generated_offers[1].booking_confirmation, undefined);
  assert.equal(secondGenerateResult.body.booking.generated_offers[0].management_approver_atp_staff_id, undefined);
  assert.equal(secondGenerateResult.body.booking.generated_offers[1].management_approver_atp_staff_id, undefined);
});

test("generated offer creation no longer exposes public confirmation flow state", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: createdBooking.offer_revision,
        comment: "No public confirmation flow"
      }
    }
  );
  assert.equal(generateResult.status, 201);
  assert.equal(generateResult.body.booking.generated_offers[0].customer_confirmation_flow, undefined);
  assert.equal(generateResult.body.booking.generated_offers[0].public_booking_confirmation_token, undefined);
  assert.equal(generateResult.body.booking.generated_offers[0].public_booking_confirmation_expires_at, undefined);
});

test("public traveler details access and update use a signed temporary link", async () => {
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
  const publicDocumentPicturePath = `/public/v1/bookings/${encodeURIComponent(bookingId)}/persons/${encodeURIComponent(traveler.id)}/documents/{document_type}/picture`;
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
          hotel_room_smoker: true,
          hotel_room_sharing_ok: false,
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
  assert.equal(updateResult.body.person.hotel_room_smoker, true);
  assert.equal(updateResult.body.person.hotel_room_sharing_ok, false);
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
  assert.equal(travelerAfter.hotel_room_smoker, true);
  assert.equal(travelerAfter.hotel_room_sharing_ok, false);
  assert.equal(travelerAfter.date_of_birth, "1988-04-12");
  assert.equal(travelerAfter.nationality, "VN");
  assert.equal(travelerAfter.address.line_1, "12 Lotus Street");
  assert.equal(travelerAfter.address.city, "Hoi An");
  assert.equal(travelerAfter.address.country_code, "VN");
  assert.equal(travelerAfter.documents.length, 1);
  assert.equal(travelerAfter.documents[0].document_number, "P1234567");

  const partialUpdateResult = await requestJson(
    `${updatePath}?token=${encodeURIComponent(linkResult.body.traveler_details_token)}`,
    {},
    {
      method: "PATCH",
      body: {
        person: {
          id: traveler.id,
          name: "Test User",
          emails: ["traveler+partial@example.com"],
          preferred_language: "fr",
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
  assert.equal(partialUpdateResult.status, 200);
  assert.equal(partialUpdateResult.body.person.hotel_room_smoker, true);
  assert.equal(partialUpdateResult.body.person.hotel_room_sharing_ok, false);

  const detailAfterPartial = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailAfterPartial.status, 200);
  const travelerAfterPartial = detailAfterPartial.body.booking.persons.find((person) => person.id === traveler.id);
  assert.ok(travelerAfterPartial);
  assert.deepEqual(travelerAfterPartial.emails, ["traveler+partial@example.com"]);
  assert.equal(travelerAfterPartial.preferred_language, "fr");
  assert.equal(travelerAfterPartial.hotel_room_smoker, true);
  assert.equal(travelerAfterPartial.hotel_room_sharing_ok, false);

  const accessAfterResult = await requestJson(
    `${accessPath}?token=${encodeURIComponent(linkResult.body.traveler_details_token)}`,
    {}
  );
  assert.equal(accessAfterResult.status, 200);
  assert.equal(accessAfterResult.body.traveler_number, travelerNumber);
  assert.equal(accessAfterResult.body.person.name, "Test User");
  assert.deepEqual(accessAfterResult.body.person.emails, ["traveler+partial@example.com"]);
  assert.equal(accessAfterResult.body.person.hotel_room_smoker, true);
  assert.equal(accessAfterResult.body.person.hotel_room_sharing_ok, false);
  assert.deepEqual(accessAfterResult.body.person.address, {
    line_1: "12 Lotus Street",
    city: "Hoi An",
    country_code: "VN"
  });
  assert.equal(accessAfterResult.body.person.documents.length, 1);
  assert.equal(accessAfterResult.body.person.documents[0].document_number, "P1234567");
  assert.equal(accessAfterResult.body.privacy_notice, undefined);

  if (HAS_MAGICK) {
    const uploadResult = await requestJson(
      `${publicDocumentPicturePath.replace("{document_type}", "passport")}?token=${encodeURIComponent(linkResult.body.traveler_details_token)}`,
      {},
      {
        method: "POST",
        body: {
          filename: "passport.png",
          data_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAACYktHRAAB3YoTpAAAAAd0SU1FB+oDCgU5NQ3qg4IAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjYtMDMtMTBUMDU6NTc6NTMrMDA6MDCtMWFJAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDI2LTAzLTEwVDA1OjU3OjUzKzAwOjAw3GzZ9QAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyNi0wMy0xMFQwNTo1Nzo1MyswMDowMIt5+CoAAAAKSURBVAjXY2gAAACCAIHdQ2r0AAAAAElFTkSuQmCC"
        }
      }
    );
    assert.equal(uploadResult.status, 200);
    const uploadedPassport = uploadResult.body.person.documents.find((document) => document.document_type === "passport");
    assert.ok(Array.isArray(uploadedPassport?.document_picture_refs));
    assert.equal(uploadedPassport.document_picture_refs.length, 1);
    assert.ok(uploadedPassport.document_picture_refs[0].includes("/public/v1/booking-person-photos/"));

    const secondUploadResult = await requestJson(
      `${publicDocumentPicturePath.replace("{document_type}", "passport")}?token=${encodeURIComponent(linkResult.body.traveler_details_token)}`,
      {},
      {
        method: "POST",
        body: {
          filename: "passport-2.png",
          data_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAACYktHRAAB3YoTpAAAAAd0SU1FB+oDCgU5NQ3qg4IAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjYtMDMtMTBUMDU6NTc6NTMrMDA6MDCtMWFJAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDI2LTAzLTEwVDA1OjU3OjUzKzAwOjAw3GzZ9QAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyNi0wMy0xMFQwNTo1Nzo1MyswMDowMIt5+CoAAAAKSURBVAjXY2gAAACCAIHdQ2r0AAAAAElFTkSuQmCC"
        }
      }
    );
    assert.equal(secondUploadResult.status, 200);
    const updatedPassport = secondUploadResult.body.person.documents.find((document) => document.document_type === "passport");
    assert.ok(Array.isArray(updatedPassport?.document_picture_refs));
    assert.equal(updatedPassport.document_picture_refs.length, 2);
  }

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

test("booking source update persists trip context and pdf personalization", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const detailBefore = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailBefore.status, 200);

  const sourceUpdateResult = await requestJson(
    endpointPath("booking_source").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "PATCH",
      body: {
        expected_core_revision: detailBefore.body.booking.core_revision,
        source_channel: "website",
        referral_kind: "none",
        destinations: ["VN", "KH"],
        travel_styles: ["adventure", "culture"],
        pdf_personalization: {
          travel_plan: {
            subtitle: "12 days in Vietnam and Cambodia",
            subtitle_i18n: {
              en: "12 days in Vietnam and Cambodia",
              de: "12 Tage in Vietnam und Kambodscha"
            },
            welcome: "This is your current travel plan.",
            welcome_i18n: {
              en: "This is your current travel plan.",
              de: "Dies ist Ihr aktueller Reiseplan."
            },
            include_who_is_traveling: true
          },
          offer: {
            children_policy: "Children policy marker for the offer.",
            children_policy_i18n: {
              en: "Children policy marker for the offer.",
              de: "Kinderregel Marker fuer das Angebot."
            },
            whats_not_included: "Offer exclusions marker for flights and visas.",
            whats_not_included_i18n: {
              en: "Offer exclusions marker for flights and visas.",
              de: "Angebotsausschluesse Marker fuer Fluege und Visa."
            },
            closing: "We would be happy to refine anything together.",
            closing_i18n: {
              en: "We would be happy to refine anything together.",
              de: "Wir verfeinern alles gern gemeinsam mit Ihnen."
            },
            include_cancellation_policy: false,
            include_who_is_traveling: false
          }
        },
        actor: "joachim"
      }
    }
  );
  assert.equal(sourceUpdateResult.status, 200);
  assert.deepEqual(sourceUpdateResult.body.booking.travel_plan.destinations, ["VN", "KH"]);
  assert.deepEqual(sourceUpdateResult.body.booking.travel_styles, ["grand-expeditions", "culture"]);
  assert.equal(
    sourceUpdateResult.body.booking.pdf_personalization.travel_plan.subtitle,
    "12 days in Vietnam and Cambodia"
  );
  assert.equal(
    sourceUpdateResult.body.booking.pdf_personalization.offer.closing,
    "We would be happy to refine anything together."
  );
  assert.equal(
    sourceUpdateResult.body.booking.pdf_personalization.offer.children_policy,
    "Children policy marker for the offer."
  );
  assert.equal(
    sourceUpdateResult.body.booking.pdf_personalization.offer.whats_not_included,
    "Offer exclusions marker for flights and visas."
  );
  assert.equal(
    sourceUpdateResult.body.booking.pdf_personalization.offer.include_cancellation_policy,
    false
  );
  assert.equal(
    sourceUpdateResult.body.booking.pdf_personalization.travel_plan.subtitle_i18n.de,
    "12 Tage in Vietnam und Kambodscha"
  );
  assert.equal(
    sourceUpdateResult.body.booking.pdf_personalization.travel_plan.include_who_is_traveling,
    true
  );
  assert.equal(
    sourceUpdateResult.body.booking.pdf_personalization.offer.include_who_is_traveling,
    false
  );

  const detailAfter = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailAfter.status, 200);
  assert.deepEqual(detailAfter.body.booking.travel_plan.destinations, ["VN", "KH"]);
  assert.deepEqual(detailAfter.body.booking.travel_styles, ["grand-expeditions", "culture"]);
  assert.equal(
    detailAfter.body.booking.pdf_personalization.travel_plan.welcome,
    "This is your current travel plan."
  );
  assert.equal(
    detailAfter.body.booking.pdf_personalization.travel_plan.welcome_i18n.de,
    "Dies ist Ihr aktueller Reiseplan."
  );
  assert.equal(
    detailAfter.body.booking.pdf_personalization.travel_plan.include_who_is_traveling,
    true
  );
  assert.equal(
    detailAfter.body.booking.pdf_personalization.offer.children_policy_i18n.de,
    "Kinderregel Marker fuer das Angebot."
  );
  assert.equal(
    detailAfter.body.booking.pdf_personalization.offer.whats_not_included_i18n.de,
    "Angebotsausschluesse Marker fuer Fluege und Visa."
  );
  assert.equal(
    detailAfter.body.booking.pdf_personalization.offer.include_cancellation_policy,
    false
  );
  assert.equal(
    detailAfter.body.booking.pdf_personalization.offer.include_who_is_traveling,
    false
  );
  assert.equal(
    detailAfter.body.booking.pdf_personalization.offer.closing_i18n.de,
    "Wir verfeinern alles gern gemeinsam mit Ihnen."
  );
});

test("booking generated offer pdf accepts personalized children policy and exclusions", async () => {
  const createdBooking = await createSeedBooking();
  const bookingId = createdBooking.id;

  const store = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingRecord = store.bookings.find((item) => item.id === bookingId);
  assert.ok(bookingRecord);
  bookingRecord.pdf_personalization = {
    ...(bookingRecord.pdf_personalization || {}),
    offer: {
      ...(bookingRecord.pdf_personalization?.offer || {}),
      children_policy: "ChildrenPolicyMarker under 6 share existing bedding.",
      children_policy_i18n: {
        en: "ChildrenPolicyMarker under 6 share existing bedding."
      },
      whats_not_included: "ExclusionsMarker international flights visas and personal expenses.",
      whats_not_included_i18n: {
        en: "ExclusionsMarker international flights visas and personal expenses."
      },
      include_cancellation_policy: false
    }
  };
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");

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
              id: "offer_component_personalized_pdf_1",
              category: "ACTIVITIES",
              label: "OfferPdfMarker",
              details: "PersonalizedOfferPdfMarker",
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

  const generateResult = await requestJson(
    endpointPath("booking_generate_offer").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: offerPatchResult.body.booking.offer_revision,
        comment: "Offer personalization PDF check"
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
  assert.match(pdfResult.body, /%PDF-/);
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
      phone_number: "+84354999192",
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
      phone_number: "+84354999192",
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
    external_conversation_id: "84354999192",
    external_contact_id: "84354999192",
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
    sender_contact: "84354999192",
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
      phone_number: "+84354999192",
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
  assert.ok(Array.isArray(passportDocument?.document_picture_refs));
  assert.equal(passportDocument.document_picture_refs.length, 1);
  assert.ok(passportDocument.document_picture_refs[0].includes("/public/v1/booking-person-photos/"));

  const passportSecondResult = await requestJson(
    endpointPath("booking_person_document_picture")
      .replace("{booking_id}", booking_id)
      .replace("{person_id}", original_person.id)
      .replace("{document_type}", "passport"),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_persons_revision: passportResult.body.booking.persons_revision,
        filename: "passport-2.png",
        data_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAACYktHRAAB3YoTpAAAAAd0SU1FB+oDCgU5NQ3qg4IAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjYtMDMtMTBUMDU6NTc6NTMrMDA6MDCtMWFJAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDI2LTAzLTEwVDA1OjU3OjUzKzAwOjAw3GzZ9QAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyNi0wMy0xMFQwNTo1Nzo1MyswMDowMIt5+CoAAAAKSURBVAjXY2gAAACCAIHdQ2r0AAAAAElFTkSuQmCC",
        actor: "joachim"
      }
    }
  );
  assert.equal(passportSecondResult.status, 200);
  const passportDocumentAfterSecondUpload = passportSecondResult.body.booking.persons[0].documents.find((document) => document.document_type === "passport");
  assert.ok(Array.isArray(passportDocumentAfterSecondUpload?.document_picture_refs));
  assert.equal(passportDocumentAfterSecondUpload.document_picture_refs.length, 2);

  const idCardResult = await requestJson(
    endpointPath("booking_person_document_picture")
      .replace("{booking_id}", booking_id)
      .replace("{person_id}", original_person.id)
      .replace("{document_type}", "national_id"),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_persons_revision: passportSecondResult.body.booking.persons_revision,
        filename: "id-card.png",
        data_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAACYktHRAAB3YoTpAAAAAd0SU1FB+oDCgU5NQ3qg4IAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjYtMDMtMTBUMDU6NTc6NTMrMDA6MDCtMWFJAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDI2LTAzLTEwVDA1OjU3OjUzKzAwOjAw3GzZ9QAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyNi0wMy0xMFQwNTo1Nzo1MyswMDowMIt5+CoAAAAKSURBVAjXY2gAAACCAIHdQ2r0AAAAAElFTkSuQmCC",
        actor: "joachim"
      }
    }
  );
  assert.equal(idCardResult.status, 200);
  const idCardDocument = idCardResult.body.booking.persons[0].documents.find((document) => document.document_type === "national_id");
  assert.ok(Array.isArray(idCardDocument?.document_picture_refs));
  assert.equal(idCardDocument.document_picture_refs.length, 1);
  assert.ok(idCardDocument.document_picture_refs[0].includes("/public/v1/booking-person-photos/"));
});

test("offer exchange-rates endpoint works", async () => {
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

test("booking payment document create supports payment-linked request and confirmation PDFs", async () => {
  await resetStore();
  const createdBooking = await createPublicBooking({ preferred_currency: "EUR" });
  const booking_id = createdBooking.id;

  const storeBeforeGenerate = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const bookingBeforeGenerate = storeBeforeGenerate.bookings.find((item) => item.id === booking_id);
  assert.ok(bookingBeforeGenerate);
  bookingBeforeGenerate.assigned_keycloak_user_id = "kc-joachim";
  bookingBeforeGenerate.assigned_keycloak_user_label = "Joachim";
  await writeFile(STORE_PATH, `${JSON.stringify(storeBeforeGenerate, null, 2)}\n`, "utf8");

  const detailBefore = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailBefore.status, 200);

  const offerPatchResult = await requestJson(
    endpointPath("booking_offer").replace("{booking_id}", booking_id),
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
            lines: [
              {
                id: "payment_term_docs_deposit",
                kind: "DEPOSIT",
                label: "Deposit",
                sequence: 1,
                amount_spec: {
                  mode: "FIXED_AMOUNT",
                  fixed_amount_cents: 9000
                },
                due_rule: {
                  type: "ON_ACCEPTANCE"
                }
              },
              {
                id: "payment_term_docs_installment",
                kind: "INSTALLMENT",
                label: "Installment 1",
                sequence: 2,
                amount_spec: {
                  mode: "FIXED_AMOUNT",
                  fixed_amount_cents: 7000
                },
                due_rule: {
                  type: "DAYS_AFTER_ACCEPTANCE",
                  days: 30
                }
              },
              {
                id: "payment_term_docs_final",
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
              id: "offer_component_payment_docs_1",
              category: "OTHER",
              label: "Main service",
              details: "Payment document coverage",
              quantity: 1,
              unit_amount_cents: 30000,
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
    endpointPath("booking_generate_offer").replace("{booking_id}", booking_id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_offer_revision: offerPatchResult.body.booking.offer_revision,
        comment: "Payment documents"
      }
    }
  );
  assert.equal(generateResult.status, 201);

  const firstPaymentRequestResult = await requestJson(
    endpointPath("booking_payment_document_create").replace("{booking_id}", booking_id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_payment_documents_revision: generateResult.body.booking.payment_documents_revision,
        payment_id: "payment_term_docs_deposit",
        document_kind: "PAYMENT_REQUEST",
        lang: "en",
        content_lang: "en",
        source_lang: "en"
      }
    }
  );
  assert.equal(firstPaymentRequestResult.status, 201, JSON.stringify(firstPaymentRequestResult.body));

  const depositReceivedAt = "2026-04-10T09:15:00.000Z";

  const depositReceiptResult = await requestJson(
    endpointPath("booking_payment_document_create").replace("{booking_id}", booking_id),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_payment_documents_revision: firstPaymentRequestResult.body.booking.payment_documents_revision,
        payment_id: "payment_term_docs_deposit",
        document_kind: "PAYMENT_CONFIRMATION",
        lang: "en",
        content_lang: "en",
        source_lang: "en",
        payment_received_at: depositReceivedAt,
        payment_confirmed_by_atp_staff_id: "kc-joachim",
        payment_reference: "BANK-REF-DOCS"
      }
    }
  );
  assert.equal(depositReceiptResult.status, 201);

  let paymentDocumentsRevision = depositReceiptResult.body.booking.payment_documents_revision;
  async function createPaymentDocument({
    payment_id,
    document_kind,
    pdf_personalization,
    payment_received_at,
    payment_confirmed_by_atp_staff_id,
    payment_reference
  }) {
    const result = await requestJson(
      endpointPath("booking_payment_document_create").replace("{booking_id}", booking_id),
      apiHeaders(),
      {
        method: "POST",
        body: {
          expected_payment_documents_revision: paymentDocumentsRevision,
          payment_id,
          document_kind,
          lang: "en",
          content_lang: "en",
          source_lang: "en",
          pdf_personalization,
          payment_received_at,
          payment_confirmed_by_atp_staff_id,
          payment_reference
        }
      }
    );
    paymentDocumentsRevision = result.body?.booking?.payment_documents_revision ?? paymentDocumentsRevision;
    return result;
  }

  const depositRequestResult = await createPaymentDocument({
    payment_id: "payment_term_docs_deposit",
    document_kind: "PAYMENT_REQUEST",
    pdf_personalization: {
      include_welcome: true,
      welcome: "We would be thrilled if you book this tour with us. Please pay the deposit to confirm your booking",
      include_closing: true,
      closing: "Best regards,\nYour Asia Travel Plan team."
    }
  });
  assert.equal(depositRequestResult.status, 201);
  assert.equal(depositRequestResult.body.document.document_kind, "PAYMENT_REQUEST");
  assert.equal(depositRequestResult.body.document.payment_kind, "DEPOSIT");
  assert.equal(depositRequestResult.body.document.payment_id, "payment_term_docs_deposit");
  assert.equal(depositRequestResult.body.document.currency, createdBooking.preferred_currency);
  assert.equal(depositRequestResult.body.document.total_amount_cents, 9000);
  assert.equal(
    depositRequestResult.body.document.intro,
    "We would be thrilled if you book this tour with us. Please pay the deposit to confirm your booking"
  );
  assert.equal(
    depositRequestResult.body.booking.pdf_personalization.payment_request_deposit.welcome,
    "We would be thrilled if you book this tour with us. Please pay the deposit to confirm your booking"
  );

  const installmentRequestResult = await createPaymentDocument({
    payment_id: "payment_term_docs_installment",
    document_kind: "PAYMENT_REQUEST",
    pdf_personalization: {
      include_subtitle: true,
      subtitle: "Installment request subtitle",
      include_welcome: true,
      welcome: "Please settle the installment payment.",
      include_closing: true,
      closing: "Thank you for arranging the installment."
    }
  });
  assert.equal(installmentRequestResult.status, 201);
  assert.equal(installmentRequestResult.body.document.document_kind, "PAYMENT_REQUEST");
  assert.equal(installmentRequestResult.body.document.payment_kind, "INSTALLMENT");
  assert.equal(installmentRequestResult.body.document.payment_id, "payment_term_docs_installment");
  assert.equal(installmentRequestResult.body.document.currency, createdBooking.preferred_currency);
  assert.equal(installmentRequestResult.body.document.total_amount_cents, 7000);
  assert.equal(installmentRequestResult.body.document.subtitle, "Installment request subtitle");
  assert.equal(
    installmentRequestResult.body.booking.pdf_personalization.payment_request_installment.subtitle,
    "Installment request subtitle"
  );

  const installmentConfirmationResult = await createPaymentDocument({
    payment_id: "payment_term_docs_installment",
    document_kind: "PAYMENT_CONFIRMATION",
    payment_received_at: "2026-04-01T00:00:00.000Z",
    payment_confirmed_by_atp_staff_id: "kc-joachim",
    payment_reference: "INSTALLMENT-REF-001",
    pdf_personalization: {
      include_subtitle: true,
      subtitle: "Installment confirmation subtitle",
      include_welcome: true,
      welcome: "We confirm receipt of your installment payment.",
      include_closing: true,
      closing: "Thank you for your installment payment."
    }
  });
  assert.equal(installmentConfirmationResult.status, 201);
  assert.equal(installmentConfirmationResult.body.document.document_kind, "PAYMENT_CONFIRMATION");
  assert.equal(installmentConfirmationResult.body.document.payment_kind, "INSTALLMENT");
  assert.equal(installmentConfirmationResult.body.document.currency, createdBooking.preferred_currency);
  assert.equal(installmentConfirmationResult.body.document.total_amount_cents, 7000);
  assert.equal(installmentConfirmationResult.body.document.payment_received_at, "2026-04-01T00:00:00.000Z");
  assert.equal(
    installmentConfirmationResult.body.booking.pdf_personalization.payment_confirmation_installment.subtitle,
    "Installment confirmation subtitle"
  );

  const finalRequestResult = await createPaymentDocument({
    payment_id: "payment_term_docs_final",
    document_kind: "PAYMENT_REQUEST",
    pdf_personalization: {
      include_subtitle: true,
      subtitle: "Final request subtitle",
      include_welcome: true,
      welcome: "Please arrange the final payment.",
      include_closing: true,
      closing: "Thank you for preparing the final payment."
    }
  });
  assert.equal(finalRequestResult.status, 201, JSON.stringify(finalRequestResult.body));
  assert.equal(finalRequestResult.body.document.document_kind, "PAYMENT_REQUEST");
  assert.equal(finalRequestResult.body.document.payment_kind, "FINAL_BALANCE");
  assert.equal(finalRequestResult.body.document.currency, createdBooking.preferred_currency);
  assert.equal(finalRequestResult.body.document.total_amount_cents, 17000);
  assert.equal(
    finalRequestResult.body.booking.pdf_personalization.payment_request_final.subtitle,
    "Final request subtitle"
  );

  const finalConfirmationResult = await createPaymentDocument({
    payment_id: "payment_term_docs_final",
    document_kind: "PAYMENT_CONFIRMATION",
    payment_received_at: "2026-04-12T00:00:00.000Z",
    payment_confirmed_by_atp_staff_id: "kc-joachim",
    payment_reference: "FINAL-REF-001",
    pdf_personalization: {
      include_subtitle: true,
      subtitle: "Final confirmation subtitle",
      include_welcome: true,
      welcome: "We confirm the final payment has been received.",
      include_closing: true,
      closing: "Thank you for completing the payment."
    }
  });
  assert.equal(finalConfirmationResult.status, 201);
  assert.equal(finalConfirmationResult.body.document.document_kind, "PAYMENT_CONFIRMATION");
  assert.equal(finalConfirmationResult.body.document.payment_kind, "FINAL_BALANCE");
  assert.equal(finalConfirmationResult.body.document.currency, createdBooking.preferred_currency);
  assert.equal(finalConfirmationResult.body.document.total_amount_cents, 17000);
  assert.equal(finalConfirmationResult.body.document.payment_received_at, "2026-04-12T00:00:00.000Z");
  assert.equal(
    finalConfirmationResult.body.booking.pdf_personalization.payment_confirmation_final.subtitle,
    "Final confirmation subtitle"
  );
});

test("first payment request freezes the accepted commercial snapshot before a receipt is recorded", async () => {
  await resetStore();
  const createdBooking = await createPublicBooking({ preferred_currency: "EUR" });
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
          ...buildTripOfferDraft(detailBefore.body.booking.offer, createdBooking.preferred_currency, 24000),
          payment_terms: {
            currency: createdBooking.preferred_currency,
            lines: [
              {
                id: "payment_term_first_request_deposit",
                kind: "DEPOSIT",
                label: "Deposit",
                sequence: 1,
                amount_spec: {
                  mode: "FIXED_AMOUNT",
                  fixed_amount_cents: 8000
                },
                due_rule: {
                  type: "ON_ACCEPTANCE"
                }
              },
              {
                id: "payment_term_first_request_final",
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
          }
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
        expected_travel_plan_revision: offerPatchResult.body.booking.travel_plan_revision,
        travel_plan: {
          days: [
            {
              id: "travel_plan_day_first_request",
              day_number: 1,
              title: "Arrival",
              overnight_location: "Hoi An",
              services: [
                {
                  id: "travel_plan_service_first_request",
                  timing_kind: "point",
                  time_point: "19:00",
                  kind: "transport",
                  title: "Original airport pickup"
                }
              ]
            }
          ]
        }
      }
    }
  );
  assert.equal(travelPlanPatchResult.status, 200);

  const firstPaymentRequestResult = await requestJson(
    endpointPath("booking_payment_document_create").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_payment_documents_revision: travelPlanPatchResult.body.booking.payment_documents_revision,
        payment_id: "payment_term_first_request_deposit",
        document_kind: "PAYMENT_REQUEST",
        lang: "en",
        content_lang: "en",
        source_lang: "en"
      }
    }
  );
  assert.equal(firstPaymentRequestResult.status, 201, JSON.stringify(firstPaymentRequestResult.body));
  assert.equal(firstPaymentRequestResult.body.document.currency, createdBooking.preferred_currency);
  assert.equal(firstPaymentRequestResult.body.document.total_amount_cents, 8000);
  assert.equal(firstPaymentRequestResult.body.booking.accepted_record.available, true);
  assert.equal(firstPaymentRequestResult.body.booking.accepted_record.payment_terms.lines[0].label, "Deposit");
  assert.equal(
    firstPaymentRequestResult.body.booking.accepted_record.travel_plan.days[0].services[0].title,
    "Original airport pickup"
  );

  const storeAfterFirstRequest = JSON.parse(await readFile(STORE_PATH, "utf8"));
  const mutableBookingRecord = storeAfterFirstRequest.bookings.find((item) => item.id === bookingId);
  assert.ok(mutableBookingRecord);
  mutableBookingRecord.offer.payment_terms.lines[0].label = "Changed after first request";
  mutableBookingRecord.travel_plan.days[0].services[0].title = "Changed airport pickup";
  await writeFile(STORE_PATH, `${JSON.stringify(storeAfterFirstRequest, null, 2)}\n`, "utf8");

  const detailAfterMutation = await requestJson(
    endpointPath("booking_detail").replace("{booking_id}", bookingId),
    apiHeaders()
  );
  assert.equal(detailAfterMutation.status, 200);
  assert.equal(detailAfterMutation.body.booking.offer.payment_terms.lines[0].label, "Changed after first request");
  assert.equal(detailAfterMutation.body.booking.accepted_record.payment_terms.lines[0].label, "Deposit");
  assert.equal(
    detailAfterMutation.body.booking.accepted_record.travel_plan.days[0].services[0].title,
    "Original airport pickup"
  );

  const receiptConfirmationResult = await requestJson(
    endpointPath("booking_payment_document_create").replace("{booking_id}", bookingId),
    apiHeaders(),
    {
      method: "POST",
      body: {
        expected_payment_documents_revision: detailAfterMutation.body.booking.payment_documents_revision,
        payment_id: "payment_term_first_request_deposit",
        document_kind: "PAYMENT_CONFIRMATION",
        lang: "en",
        content_lang: "en",
        source_lang: "en",
        payment_received_at: "2026-05-01T08:00:00.000Z",
        payment_confirmed_by_atp_staff_id: "kc-joachim",
        payment_reference: "FIRST-REQ-REF-001"
      }
    }
  );
  assert.equal(receiptConfirmationResult.status, 201, JSON.stringify(receiptConfirmationResult.body));
  assert.equal(receiptConfirmationResult.body.booking.accepted_record.accepted_deposit_currency, createdBooking.preferred_currency);
});

test("keycloak users endpoint lists assignable users from keycloak directory", async () => {
  const result = await requestJson(endpointPath("keycloak_users"), apiHeaders("atp_admin", "admin", "kc-admin"));
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.items));
  assert.deepEqual(
    result.body.items.map((item) => item.username),
    ["joachim", "staff"]
  );
  assert.ok(result.body.items.every((item) => item.active === true));
  const joachim = result.body.items.find((item) => item.username === "joachim");
  assert.deepEqual(joachim.realm_roles, []);
  assert.deepEqual(joachim.client_roles, ["atp_admin", "atp_staff"]);
  assert.equal(joachim.name, "Joachim Neumann");
  const staff = result.body.items.find((item) => item.username === "staff");
  assert.deepEqual(staff.realm_roles, []);
  assert.deepEqual(staff.client_roles, ["atp_staff"]);
  assert.equal(staff.name, "Staff User");
});

test("staff profiles endpoint lists all keycloak users with ATP roles", async () => {
  const result = await requestJson(endpointPath("staff_profiles"), apiHeaders("atp_admin", "admin", "kc-admin"));
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.items));
  assert.deepEqual(
    result.body.items.map((item) => item.username),
    ["accountant", "admin", "joachim", "staff", "tour-editor"]
  );
  const admin = result.body.items.find((item) => item.username === "admin");
  assert.deepEqual(admin.client_roles, ["atp_admin"]);
  const accountant = result.body.items.find((item) => item.username === "accountant");
  assert.deepEqual(accountant.client_roles, ["atp_accountant"]);
  const tourEditor = result.body.items.find((item) => item.username === "tour-editor");
  assert.deepEqual(tourEditor.client_roles, ["atp_tour_editor"]);
});

test("admin can update ATP staff profile details while non-admin cannot", async () => {
  const profilePath = endpointPath("keycloak_user_staff_profile_update").replace("{username}", "joachim");
  const shortDescriptionEn = "Shapes calm Southeast Asia routes with realistic transfer windows and recovery time between highlights.";
  const shortDescriptionDe = "Plant ruhige Südostasien-Routen mit realistischen Transferzeiten und Erholungsphasen zwischen den Höhepunkten.";
  const name = "Joachim";
  const friendlyShortName = "Joachim";
  const teamOrder = 3;

  const forbiddenResult = await requestJson(
    profilePath,
    apiHeaders("atp_manager", "joachim", "kc-joachim"),
    {
      method: "PATCH",
      body: {
        languages: ["de", "en"],
        destinations: ["VN"],
        short_description_i18n: [{
          lang: "en",
          value: "This write should be rejected."
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
        name,
        friendly_short_name: friendlyShortName,
        team_order: teamOrder,
        languages: ["de", "en", "vi"],
        destinations: ["VN", "LA"],
        short_description_i18n: [
          {
            lang: "en",
            value: shortDescriptionEn
          },
          {
            lang: "de",
            value: shortDescriptionDe
          }
        ]
      }
    }
  );
  assert.equal(updateResult.status, 200);
  assert.equal(updateResult.body.user.username, "joachim");
  assert.equal(updateResult.body.user.staff_profile.name, name);
  assert.equal(updateResult.body.user.staff_profile.friendly_short_name, friendlyShortName);
  assert.equal(updateResult.body.user.staff_profile.team_order, teamOrder);
  assert.deepEqual(updateResult.body.user.staff_profile.languages, ["de", "en", "vi"]);
  assert.deepEqual(updateResult.body.user.staff_profile.destinations, ["VN", "LA"]);
  assert.equal(updateResult.body.user.staff_profile.short_description, shortDescriptionEn);
  assert.ok(Array.isArray(updateResult.body.user.staff_profile.short_description_i18n));
  assert.equal(
    updateResult.body.user.staff_profile.short_description_i18n.find((entry) => entry.lang === "en")?.value,
    shortDescriptionEn
  );
  assert.equal(
    updateResult.body.user.staff_profile.short_description_i18n.find((entry) => entry.lang === "de")?.value,
    shortDescriptionDe
  );

  const listResult = await requestJson(endpointPath("keycloak_users"), apiHeaders("atp_admin", "admin", "kc-admin"));
  const updated = listResult.body.items.find((item) => item.username === "joachim");
  assert.equal(updated.name, "Joachim Neumann");
  assert.equal(updated.staff_profile, undefined);
});

test("public ATP staff team endpoint respects manual team order and supports clearing it", async () => {
  const adminHeaders = apiHeaders("atp_admin", "admin", "kc-admin");
  const joachimProfilePath = endpointPath("keycloak_user_staff_profile_update").replace("{username}", "joachim");
  const staffProfilePath = endpointPath("keycloak_user_staff_profile_update").replace("{username}", "staff");
  const publicTeamPath = endpointPath("public_atp_staff_team");

  const joachimUpdate = await requestJson(
    joachimProfilePath,
    adminHeaders,
    {
      method: "PATCH",
      body: {
        languages: ["de", "en"],
        team_order: 2
      }
    }
  );
  assert.equal(joachimUpdate.status, 200);
  assert.equal(joachimUpdate.body.user.staff_profile.team_order, 2);

  const staffUpdate = await requestJson(
    staffProfilePath,
    adminHeaders,
    {
      method: "PATCH",
      body: {
        languages: ["en", "vi"],
        team_order: 1
      }
    }
  );
  assert.equal(staffUpdate.status, 200);
  assert.equal(staffUpdate.body.user.staff_profile.team_order, 1);

  const orderedTeam = await requestJson(publicTeamPath);
  assert.equal(orderedTeam.status, 200);
  const orderedUsernames = orderedTeam.body.items.map((item) => item.username);
  assert.ok(orderedUsernames.indexOf("staff") >= 0);
  assert.ok(orderedUsernames.indexOf("joachim") >= 0);
  assert.ok(orderedUsernames.indexOf("staff") < orderedUsernames.indexOf("joachim"));

  const clearedStaffOrder = await requestJson(
    staffProfilePath,
    adminHeaders,
    {
      method: "PATCH",
      body: {
        languages: ["en", "vi"],
        team_order: null
      }
    }
  );
  assert.equal(clearedStaffOrder.status, 200);
  assert.equal(clearedStaffOrder.body.user.staff_profile.team_order, undefined);

  const teamAfterClear = await requestJson(publicTeamPath);
  assert.equal(teamAfterClear.status, 200);
  const usernamesAfterClear = teamAfterClear.body.items.map((item) => item.username);
  assert.ok(usernamesAfterClear.indexOf("joachim") >= 0);
  assert.ok(usernamesAfterClear.indexOf("staff") >= 0);
  assert.ok(usernamesAfterClear.indexOf("joachim") < usernamesAfterClear.indexOf("staff"));
});

test("admin can translate ATP staff profile text from English to Malay", async () => {
  const translatePath = endpointPath("keycloak_user_staff_profile_translate_fields").replace("{username}", "joachim");
  const previousFetch = global.fetch;
  global.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (String(url).startsWith("https://translate.googleapis.com/translate_a/single?")) {
      const parsed = new URL(String(url));
      assert.equal(parsed.searchParams.get("sl"), "en");
      assert.equal(parsed.searchParams.get("tl"), "ms");
      return new Response(JSON.stringify([[
        ["Perancang perjalanan Asia Tenggara yang tenang", null, null, null]
      ]]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (String(url) === "https://api.openai.com/v1/responses") {
      const payload = JSON.parse(String(init?.body || "{}"));
      assert.equal(payload.model, String(process.env.OPENAI_TRANSLATION_MODEL || process.env.OPENAI_MODEL || "gpt-4.1").trim());
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          value: "Perancang perjalanan Asia Tenggara yang tenang"
        })
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return previousFetch(input, init);
  };

  try {
    const translateResult = await requestJson(
      translatePath,
      apiHeaders("atp_admin", "admin", "kc-admin"),
      {
        method: "POST",
        body: {
          source_lang: "English",
          target_lang: "Malay",
          entries: [{
            key: "value",
            value: "Calm Southeast Asia trip planner"
          }]
        }
      }
    );

    assert.equal(translateResult.status, 200);
    assert.equal(translateResult.body.source_lang, "en");
    assert.equal(translateResult.body.target_lang, "ms");
    assert.match(
      String(translateResult.headers["x-atp-translation-provider-label"] || ""),
      /^(Google Translate|OpenAI \(.+\))$/,
      "Staff translation responses should expose the translation provider label"
    );
    assert.equal(
      translateResult.body.entries.find((entry) => entry.key === "value")?.value,
      "Perancang perjalanan Asia Tenggara yang tenang"
    );
  } finally {
    global.fetch = previousFetch;
  }
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
  assert.match(
    String(uploadResult.body.user.staff_profile.picture_ref || ""),
    /joachim\.webp(?:\?v=\d+)?$/
  );

  const uploadedPhotoPath = path.join(TEST_DATA_DIR, "content", "atp_staff", "photos", "joachim.webp");
  const uploadedPhotoStat = await stat(uploadedPhotoPath);
  assert.ok(uploadedPhotoStat.size > 0);

  const deleteResult = await requestJson(
    endpointPath("keycloak_user_staff_profile_picture_delete").replace("{username}", "joachim"),
    apiHeaders("atp_admin", "admin", "kc-admin"),
    { method: "DELETE" }
  );
  assert.equal(deleteResult.status, 200);
  assert.match(
    String(deleteResult.body.user.staff_profile.picture_ref || ""),
    /joachim\.svg(?:\?v=\d+)?$/
  );
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
  assert.equal(assignResult.body.booking.assigned_atp_staff.name, "Staff");

  const detailAfterAssign = await requestJson(endpointPath("booking_detail").replace("{booking_id}", booking_id), apiHeaders());
  assert.equal(detailAfterAssign.status, 200);

  const adminAssignAttempt = await requestJson(
    endpointPath("booking_owner").replace("{booking_id}", booking_id),
    apiHeaders("atp_admin", "admin", "kc-admin"),
    {
      method: "PATCH",
      body: {
        expected_core_revision: detailAfterAssign.body.booking.core_revision,
        assigned_keycloak_user_id: "kc-admin",
        actor: "admin"
      }
    }
  );
  assert.equal(adminAssignAttempt.status, 422);
  assert.match(String(adminAssignAttempt.body.error || ""), /not found or inactive/i);

  const adminList = await requestJson(`${endpointPath("bookings")}?page=1&page_size=10&sort=created_at_desc`, apiHeaders("atp_admin", "admin", "kc-admin"));
  assert.equal(adminList.status, 200);
  assert.equal(adminList.body.items.length, 1);
  assert.equal(adminList.body.items[0].assigned_keycloak_user_label, "Staff");

  const staffList = await requestJson(
    `${endpointPath("bookings")}?page=1&page_size=10&sort=created_at_desc`,
    apiHeaders("atp_staff", "staff", "kc-staff")
  );
  assert.equal(staffList.status, 200);
  assert.equal(staffList.body.items.length, 1);
  assert.equal(staffList.body.items[0].id, booking_id);
  assert.equal(staffList.body.items[0].assigned_keycloak_user_label, "Staff");

  const otherStaffList = await requestJson(
    `${endpointPath("bookings")}?page=1&page_size=10&sort=created_at_desc`,
    apiHeaders("atp_staff", "other-staff", "kc-other-staff")
  );
  assert.equal(otherStaffList.status, 200);
  assert.equal(otherStaffList.body.items.length, 0);
});

test("tour editor can manage tours while staff cannot access tour endpoints", async () => {
  const createResult = await requestJson(
    endpointPath("tour_create"),
    apiHeaders("atp_tour_editor", "tour-editor", "kc-tour-editor"),
    {
      method: "POST",
      body: {
        title: "Tour editor access test",
        destinations: ["vietnam"],
        styles: ["culture"],
        short_description: "Editor-created tour",
        priority: 42
      }
    }
  );
  assert.equal(createResult.status, 201);
  const tourId = createResult.body.tour.id;

  const editorList = await requestJson(
    `${endpointPath("tours")}?page=1&page_size=20&sort=updated_at_desc`,
    apiHeaders("atp_tour_editor", "tour-editor", "kc-tour-editor")
  );
  assert.equal(editorList.status, 200);
  assert.ok(editorList.body.items.some((tour) => tour.id === tourId));

  const editorDetail = await requestJson(
    endpointPath("tour_detail").replace("{tour_id}", tourId),
    apiHeaders("atp_tour_editor", "tour-editor", "kc-tour-editor")
  );
  assert.equal(editorDetail.status, 200);
  assert.equal(editorDetail.body.tour.title, "Tour editor access test");

  const updateResult = await requestJson(
    endpointPath("tour_update").replace("{tour_id}", tourId),
    apiHeaders("atp_tour_editor", "tour-editor", "kc-tour-editor"),
    {
      method: "PATCH",
      body: {
        short_description: "Updated by the tour editor"
      }
    }
  );
  assert.equal(updateResult.status, 200);
  assert.equal(updateResult.body.tour.short_description, "Updated by the tour editor");

  const deleteResult = await requestJson(
    endpointPath("tour_delete").replace("{tour_id}", tourId),
    apiHeaders("atp_tour_editor", "tour-editor", "kc-tour-editor"),
    { method: "DELETE" }
  );
  assert.equal(deleteResult.status, 200);
  assert.equal(deleteResult.body.deleted, true);
  assert.equal(deleteResult.body.tour_id, tourId);
  await assert.rejects(() => stat(path.join(TEST_DATA_DIR, "tours", tourId)));

  const deletedDetail = await requestJson(
    endpointPath("tour_detail").replace("{tour_id}", tourId),
    apiHeaders("atp_tour_editor", "tour-editor", "kc-tour-editor")
  );
  assert.equal(deletedDetail.status, 404);

  const staffList = await requestJson(
    `${endpointPath("tours")}?page=1&page_size=20&sort=updated_at_desc`,
    apiHeaders("atp_staff", "staff", "kc-staff")
  );
  assert.equal(staffList.status, 403);

  const staffDetail = await requestJson(
    endpointPath("tour_detail").replace("{tour_id}", tourId),
    apiHeaders("atp_staff", "staff", "kc-staff")
  );
  assert.equal(staffDetail.status, 403);
});

test("admin and tour editor can manage country emergency references while staff cannot access them", async () => {
  const editorList = await requestJson(
    endpointPath("country_reference_info"),
    apiHeaders("atp_tour_editor", "tour-editor", "kc-tour-editor")
  );
  assert.equal(editorList.status, 200);
  assert.ok(Array.isArray(editorList.body.items));
  assert.deepEqual(
    editorList.body.items.map((item) => item.country).sort(),
    ["KH", "LA", "TH", "VN"]
  );

  const updatedItems = editorList.body.items.map((item) => (
    item.country === "VN"
      ? {
        ...item,
        practical_tips: ["Keep a local SIM or roaming enabled for urgent coordination."],
        emergency_contacts: [
          { label: "Police", phone: "113" },
          { label: "Ambulance", phone: "115", note: "Public ambulance service" }
        ]
      }
      : item
  ));

  const editorUpdate = await requestJson(
    endpointPath("country_reference_info_update"),
    apiHeaders("atp_tour_editor", "tour-editor", "kc-tour-editor"),
    {
      method: "PATCH",
      body: {
        items: updatedItems
      }
    }
  );
  assert.equal(editorUpdate.status, 200);

  const vietnam = editorUpdate.body.items.find((item) => item.country === "VN");
  assert.ok(vietnam);
  assert.deepEqual(vietnam.practical_tips, ["Keep a local SIM or roaming enabled for urgent coordination."]);
  assert.equal(vietnam.emergency_contacts.length, 2);
  assert.equal(vietnam.emergency_contacts[1].note, "Public ambulance service");
  assert.ok(vietnam.updated_at);

  const adminList = await requestJson(
    endpointPath("country_reference_info"),
    apiHeaders("atp_admin", "admin", "kc-admin")
  );
  assert.equal(adminList.status, 200);
  assert.deepEqual(
    adminList.body.items.find((item) => item.country === "VN")?.practical_tips,
    ["Keep a local SIM or roaming enabled for urgent coordination."]
  );

  const staffList = await requestJson(
    endpointPath("country_reference_info"),
    apiHeaders("atp_staff", "staff", "kc-staff")
  );
  assert.equal(staffList.status, 403);
});

test("public tours only expose destinations published on webpage and hide unpublished-only tours", async () => {
  const editorHeaders = apiHeaders("atp_tour_editor", "tour-editor", "kc-tour-editor");
  const countryReferencePath = endpointPath("country_reference_info");
  const countryReferenceUpdatePath = endpointPath("country_reference_info_update");
  let originalCountryItems = [];
  let visibleTourId = "";
  let hiddenTourId = "";

  try {
    const currentCountryReference = await requestJson(countryReferencePath, editorHeaders);
    assert.equal(currentCountryReference.status, 200);
    originalCountryItems = Array.isArray(currentCountryReference.body.items) ? currentCountryReference.body.items : [];

    const publishedOnlyVietnam = originalCountryItems.map((item) => ({
      ...item,
      published_on_webpage: item.country === "VN"
    }));
    const updateCountryReference = await requestJson(
      countryReferenceUpdatePath,
      editorHeaders,
      {
        method: "PATCH",
        body: {
          items: publishedOnlyVietnam
        }
      }
    );
    assert.equal(updateCountryReference.status, 200);

    const visibleTourResult = await requestJson(
      endpointPath("tour_create"),
      editorHeaders,
      {
        method: "POST",
        body: {
          title: "Public Vietnam destination visibility test",
          destinations: ["vietnam"],
          styles: ["culture"],
          short_description: "Visible public test tour"
        }
      }
    );
    assert.equal(visibleTourResult.status, 201);
    visibleTourId = visibleTourResult.body.tour.id;

    const hiddenTourResult = await requestJson(
      endpointPath("tour_create"),
      editorHeaders,
      {
        method: "POST",
        body: {
          title: "Public Laos destination visibility test",
          destinations: ["laos"],
          styles: ["culture"],
          short_description: "Hidden public test tour"
        }
      }
    );
    assert.equal(hiddenTourResult.status, 201);
    hiddenTourId = hiddenTourResult.body.tour.id;

    const publicTours = await requestJson(`${endpointPath("public_tours")}?lang=en`);
    assert.equal(publicTours.status, 200);
    assert.equal(publicTours.headers["cache-control"], "no-store");
    assert.equal(publicTours.headers.etag, undefined);
    assert.deepEqual(
      publicTours.body.available_destinations.map((item) => String(item?.code || item || "").toLowerCase()).filter(Boolean),
      ["vietnam"]
    );
    assert.ok(publicTours.body.items.some((item) => item.id === visibleTourId));
    assert.ok(!publicTours.body.items.some((item) => item.id === hiddenTourId));
    assert.ok(
      publicTours.body.items.every((item) => !(Array.isArray(item?.destination_codes) ? item.destination_codes : []).includes("laos"))
    );

    const publicLaosTours = await requestJson(`${endpointPath("public_tours")}?lang=en&destination=laos`);
    assert.equal(publicLaosTours.status, 200);
    assert.equal(publicLaosTours.body.items.length, 0);

    const publicVietnamTours = await requestJson(`${endpointPath("public_tours")}?lang=en&destination=vietnam`);
    assert.equal(publicVietnamTours.status, 200);
    assert.ok(publicVietnamTours.body.items.some((item) => item.id === visibleTourId));
  } finally {
    await deleteTourForTest(hiddenTourId);
    await deleteTourForTest(visibleTourId);
    if (originalCountryItems.length) {
      const restoreCountryReference = await requestJson(
        countryReferenceUpdatePath,
        editorHeaders,
        {
          method: "PATCH",
          body: {
            items: originalCountryItems
          }
        }
      );
      assert.equal(restoreCountryReference.status, 200);
    }
  }
});

test("tour delete is blocked while bookings still reference the tour", async () => {
  let tourId = "";
  let bookingId = "";
  try {
    const createResult = await requestJson(
      endpointPath("tour_create"),
      apiHeaders("atp_tour_editor", "tour-editor", "kc-tour-editor"),
      {
        method: "POST",
      body: {
        title: "Tour delete guard test",
        destinations: ["vietnam"],
        styles: ["culture"],
        short_description: "Tour kept by booking reference"
      }
      }
    );
    assert.equal(createResult.status, 201);
    tourId = createResult.body.tour.id;

    const booking = await createPublicBooking({
      tour_id: tourId,
      notes: "This booking references a created tour."
    });
    bookingId = booking.id;
    assert.equal(booking.web_form_submission?.tour_id, tourId);

    const deleteResult = await requestJson(
      endpointPath("tour_delete").replace("{tour_id}", tourId),
      apiHeaders("atp_tour_editor", "tour-editor", "kc-tour-editor"),
      { method: "DELETE" }
    );
    assert.equal(deleteResult.status, 409);
    assert.match(String(deleteResult.body.error || ""), /referenced by bookings/i);

    const detailResult = await requestJson(
      endpointPath("tour_detail").replace("{tour_id}", tourId),
      apiHeaders("atp_tour_editor", "tour-editor", "kc-tour-editor")
    );
    assert.equal(detailResult.status, 200);
  } finally {
    await deleteBookingForTest(bookingId);
    await deleteTourForTest(tourId);
  }
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

  const paymentDocumentResult = await requestJson(
    endpointPath("booking_payment_document_create").replace("{booking_id}", booking_id),
    apiHeaders("atp_accountant", "accountant", "kc-accountant"),
    {
      method: "POST",
      body: {
        expected_payment_documents_revision: detailBefore.body.booking.payment_documents_revision,
        payment_id: "payment_term_accountant_check",
        document_kind: "PAYMENT_REQUEST",
        lang: "en",
        content_lang: "en",
        source_lang: "en",
        actor: "accountant"
      }
    }
  );
  assert.equal(paymentDocumentResult.status, 403);
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
