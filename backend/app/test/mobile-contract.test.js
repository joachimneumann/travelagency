import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONTRACT_META_PATH = path.resolve(__dirname, "..", "..", "..", "contracts", "generated", "mobile-api.meta.json");

process.env.KEYCLOAK_ENABLED = "true";
process.env.INSECURE_TEST_AUTH = "true";
process.env.KEYCLOAK_ALLOWED_ROLES = "atp_admin,atp_manager,atp_accountant,atp_staff";
process.env.MOBILE_MIN_SUPPORTED_APP_VERSION = "1.0.0";
process.env.MOBILE_LATEST_APP_VERSION = "1.0.0";
process.env.MOBILE_FORCE_UPDATE = "false";

const contractMeta = JSON.parse(await readFile(CONTRACT_META_PATH, "utf8"));
const { createBackendHandler } = await import("../src/server.js");
const handler = await createBackendHandler({ port: 8787 });

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

async function requestJson(pathname, headers = {}) {
  const req = createMockRequest({ url: pathname, headers });
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

function assertBookingShape(booking) {
  assert.equal(typeof booking.id, "string");
  assert.equal(typeof booking.customer_id, "string");
  assert.ok(contractMeta.stages.includes(booking.stage), `Unexpected booking stage: ${booking.stage}`);
  if (booking.created_at) assertISODateLike(booking.created_at, "booking.created_at");
  if (booking.updated_at) assertISODateLike(booking.updated_at, "booking.updated_at");
}

test("public mobile bootstrap matches contract metadata", async () => {
  const result = await requestJson(contractMeta.paths.mobile_bootstrap);
  assert.equal(result.status, 200);
  assert.equal(result.body.api.contract_version, contractMeta.contract_version);
  assert.equal(result.body.app.min_supported_version, "1.0.0");
  assert.equal(result.body.app.latest_version, "1.0.0");
  assert.equal(result.body.app.force_update, false);
  assert.deepEqual(result.body.features, {
    bookings: true,
    customers: false,
    tours: false
  });
});

test("bookings list response conforms to the mobile contract", async () => {
  const result = await requestJson(`${contractMeta.paths.bookings}?page=1&page_size=10&sort=created_at_desc`, apiHeaders());
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.items));
  assert.equal(typeof result.body.page, "number");
  assert.equal(typeof result.body.page_size, "number");
  assert.equal(typeof result.body.total, "number");
  assert.equal(typeof result.body.total_pages, "number");
  assert.ok(result.body.items.length > 0, "Seed data should contain at least one booking");
  assertBookingShape(result.body.items[0]);
});

test("booking detail, activities, invoices, and staff responses conform to the mobile contract", async () => {
  const listResult = await requestJson(`${contractMeta.paths.bookings}?page=1&page_size=1&sort=created_at_desc`, apiHeaders());
  const bookingID = listResult.body.items[0].id;

  const detailResult = await requestJson(contractMeta.paths.booking_detail.replace("{bookingId}", bookingID), apiHeaders());
  assert.equal(detailResult.status, 200);
  assertBookingShape(detailResult.body.booking);
  assert.equal(detailResult.body.booking.id, bookingID);
  assert.ok(detailResult.body.customer === null || typeof detailResult.body.customer === "object");

  const activitiesResult = await requestJson(contractMeta.paths.booking_activities.replace("{bookingId}", bookingID), apiHeaders());
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

  const invoicesResult = await requestJson(contractMeta.paths.booking_invoices.replace("{bookingId}", bookingID), apiHeaders());
  assert.equal(invoicesResult.status, 200);
  assert.ok(Array.isArray(invoicesResult.body.items));
  assert.equal(typeof invoicesResult.body.total, "number");

  const staffResult = await requestJson(`${contractMeta.paths.staff}?active=true`, apiHeaders());
  assert.equal(staffResult.status, 200);
  assert.ok(Array.isArray(staffResult.body.items));
  assert.equal(typeof staffResult.body.total, "number");
});
