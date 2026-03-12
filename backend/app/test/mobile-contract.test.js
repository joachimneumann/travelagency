import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

test("booking detail, activities, and invoices conform to the mobile contract", async () => {
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

});

test("booking offer patch enforces preferred currency", async () => {
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
  assert.equal(conversionResult.body.booking.offer.currency, offerCurrency);
  assert.equal(typeof conversionResult.body.booking.offer.total_price_cents, "number");
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
        name: "Vietnam Adventure Journey",
        actor: "joachim"
      }
    }
  );
  assert.equal(nameResult.status, 200);
  assert.equal(nameResult.body.booking.name, "Vietnam Adventure Journey");
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
      preferred_language: "English",
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
      preferred_language: "English",
      preferred_currency: "USD",
      destinations: ["Laos"],
      travel_style: ["Adventure"],
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

test("keycloak users endpoint lists assignable users from keycloak directory", async () => {
  const result = await requestJson(endpointPath("keycloak_users"), apiHeaders("atp_admin", "admin", "kc-admin"));
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.items));
  assert.deepEqual(
    result.body.items.map((item) => item.username),
    ["accountant", "admin", "joachim", "staff"]
  );
  assert.ok(result.body.items.every((item) => item.active === true));
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

  const adminList = await requestJson(`${endpointPath("bookings")}?page=1&page_size=10&sort=created_at_desc`, apiHeaders("atp_admin", "admin", "kc-admin"));
  assert.equal(adminList.status, 200);
  assert.equal(adminList.body.items.length, 1);

  const staffList = await requestJson(
    `${endpointPath("bookings")}?page=1&page_size=10&sort=created_at_desc`,
    apiHeaders("atp_staff", "staff", "kc-staff")
  );
  assert.equal(staffList.status, 200);
  assert.equal(staffList.body.items.length, 1);
  assert.equal(staffList.body.items[0].id, booking_id);

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

  const stageResult = await requestJson(
    endpointPath("booking_stage").replace("{booking_id}", booking_id),
    apiHeaders("atp_accountant", "accountant", "kc-accountant"),
    {
      method: "PATCH",
      body: {
        expected_core_revision: detailBefore.body.booking.core_revision,
        stage: "QUALIFIED",
        actor: "accountant"
      }
    }
  );
  assert.equal(stageResult.status, 403);
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
