import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { generateKeyPairSync } from "node:crypto";
import { createGmailDraftsClient } from "../src/lib/gmail_drafts.js";
import { createBookingFinanceHandlers } from "../src/http/handlers/booking_finance.js";
import { createBookingConfirmationHandlers } from "../src/http/handlers/booking_confirmation.js";

function decodeBase64Url(value) {
  const padded = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  const base64 = remainder ? padded + "=".repeat(4 - remainder) : padded;
  return Buffer.from(base64, "base64").toString("utf8");
}

function decodeMimeHtmlPart(rawMime) {
  const match = String(rawMime || "").match(
    /Content-Type: text\/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--/
  );
  if (!match) {
    throw new Error("Could not find HTML MIME part.");
  }
  const base64 = match[1].replace(/\s+/g, "");
  return Buffer.from(base64, "base64").toString("utf8");
}

async function createServiceAccountFixture(prefix = "gmail-drafts-test-") {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const serviceAccountPath = path.join(tempDir, "service-account.json");
  await writeFile(
    serviceAccountPath,
    JSON.stringify(
      {
        type: "service_account",
        client_email: "asiatravelplan-gmail-drafts@example.iam.gserviceaccount.com",
        private_key: privateKeyPem
      },
      null,
      2
    ),
    "utf8"
  );
  return { tempDir, serviceAccountPath };
}

function createGoogleFetchStub(fetchCalls, draftId = "draft-abc123", messageId = "message-abc123") {
  return async (url, init = {}) => {
    fetchCalls.push({ url: String(url), init });
    if (String(url) === "https://oauth2.googleapis.com/token") {
      return {
        ok: true,
        async json() {
          return { access_token: "token-123" };
        }
      };
    }
    if (String(url) === "https://gmail.googleapis.com/gmail/v1/users/me/drafts") {
      return {
        ok: true,
        async json() {
          return { id: draftId };
        }
      };
    }
    if (String(url) === "https://gmail.googleapis.com/gmail/v1/users/me/messages/send") {
      return {
        ok: true,
        async json() {
          return { id: messageId };
        }
      };
    }
    throw new Error(`Unexpected fetch call to ${url}`);
  };
}

test("gmail drafts client exchanges token and creates draft with pdf attachment", async () => {
  const { tempDir, serviceAccountPath } = await createServiceAccountFixture();
  try {
    const fetchCalls = [];
    const fetchImpl = createGoogleFetchStub(fetchCalls);

    const gmailDrafts = createGmailDraftsClient({
      serviceAccountJsonPath: serviceAccountPath,
      impersonatedEmail: "info@asiatravelplan.com",
      fetchImpl
    });

    const result = await gmailDrafts.createDraft({
      to: "traveler@example.com",
      subject: "Your Asia Travel Plan offer",
      greeting: "Hello",
      intro: "Please find your offer attached.",
      footer: "The Asia Travel Plan Team",
      fromName: "Asia Travel Plan",
      attachments: [
        {
          filename: "ATP-offer-2026-03-13-v1.pdf",
          contentType: "application/pdf",
          content: Buffer.from("%PDF-1.4 draft pdf content", "utf8")
        }
      ]
    });

    assert.equal(fetchCalls.length, 2);
    assert.equal(fetchCalls[0].url, "https://oauth2.googleapis.com/token");
    assert.equal(fetchCalls[1].url, "https://gmail.googleapis.com/gmail/v1/users/me/drafts");
    assert.equal(result.draftId, "draft-abc123");
    assert.equal(result.gmailDraftUrl, "https://mail.google.com/mail/u/0/#drafts");

    const tokenBody = String(fetchCalls[0].init.body);
    assert.match(tokenBody, /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer/);

    const draftPayload = JSON.parse(fetchCalls[1].init.body);
    const rawMime = decodeBase64Url(draftPayload.message.raw);
    assert.match(rawMime, /From: Asia Travel Plan <info@asiatravelplan\.com>/);
    assert.match(rawMime, /To: traveler@example\.com/);
    assert.match(rawMime, /Subject: Your Asia Travel Plan offer/);
    assert.match(rawMime, /Content-Type: multipart\/mixed/);
    assert.match(rawMime, /Content-Type: text\/html; charset="UTF-8"/);
    assert.match(rawMime, /Content-Type: application\/pdf; name="ATP-offer-2026-03-13-v1\.pdf"/);
    assert.match(rawMime, /Content-Disposition: attachment; filename="ATP-offer-2026-03-13-v1\.pdf"/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("gmail drafts client can send an HTML email message", async () => {
  const { tempDir, serviceAccountPath } = await createServiceAccountFixture("gmail-send-test-");
  try {
    const fetchCalls = [];
    const fetchImpl = createGoogleFetchStub(fetchCalls, "draft-unused", "message-123");

    const gmailDrafts = createGmailDraftsClient({
      serviceAccountJsonPath: serviceAccountPath,
      impersonatedEmail: "info@asiatravelplan.com",
      fetchImpl
    });

    const result = await gmailDrafts.sendMessage({
      to: "traveler@example.com",
      subject: "Your booking confirmation code",
      greeting: "Hello",
      intro: "Use code 123456.",
      footer: "Asia Travel Plan",
      fromName: "Asia Travel Plan"
    });

    assert.equal(fetchCalls.length, 2);
    assert.equal(fetchCalls[1].url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    assert.equal(result.messageId, "message-123");

    const sendPayload = JSON.parse(fetchCalls[1].init.body);
    const rawMime = decodeBase64Url(sendPayload.raw);
    const htmlBody = decodeMimeHtmlPart(rawMime);
    assert.match(rawMime, /Subject: Your booking confirmation code/);
    assert.match(rawMime, /To: traveler@example\.com/);
    assert.match(htmlBody, /Use code 123456\./);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("gmail draft handler returns success when activity persistence fails after draft creation", async () => {
  const { tempDir, serviceAccountPath } = await createServiceAccountFixture("gmail-draft-handler-test-");
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;
  const fetchCalls = [];
  const pdfPath = path.join(tempDir, "generated-offer.pdf");
  try {
    global.fetch = createGoogleFetchStub(fetchCalls, "draft-handler-123");
    console.error = () => {};

    const store = {
      bookings: [
        {
          id: "booking_1",
          name: "Vietnam discovery",
          web_form_submission: {
            email: "traveler@example.com",
            booking_name: "Vietnam discovery"
          },
          generated_offers: [
            {
              id: "generated_offer_1",
              filename: "ATP offer 2026-03-13.pdf"
            }
          ]
        }
      ],
      activities: []
    };

    const responses = [];
    const handlers = createBookingFinanceHandlers({
      readBodyJson: async () => ({ actor: "joachim" }),
      sendJson: (_res, status, payload) => {
        responses.push({ status, payload });
      },
      readStore: async () => store,
      getPrincipal: () => ({ sub: "kc-joachim" }),
      canEditBooking: () => true,
      normalizeText: (value) => (typeof value === "string" ? value.trim() : ""),
      nowIso: () => "2026-03-13T12:00:00.000Z",
      BASE_CURRENCY: "USD",
      addActivity: (targetStore, bookingId, type, actor, detail) => {
        targetStore.activities.push({
          id: `activity_${targetStore.activities.length + 1}`,
          booking_id: bookingId,
          type,
          actor,
          detail,
          created_at: "2026-03-13T12:00:00.000Z"
        });
      },
      actorLabel: (_principal, actor) => actor,
      persistStore: async () => {
        throw new Error("disk full");
      },
      assertExpectedRevision: async () => true,
      buildBookingDetailResponse: async () => ({ booking: store.bookings[0] }),
      incrementBookingRevision: () => {},
      validateBookingPricingInput: () => ({ ok: true }),
      convertBookingPricingToBaseCurrency: async () => ({}),
      normalizeBookingPricing: () => ({}),
      validateBookingOfferInput: () => ({ ok: true }),
      convertBookingOfferToBaseCurrency: async () => ({}),
      normalizeBookingOffer: () => ({}),
      normalizeBookingTravelPlan: (travelPlan) => travelPlan || { days: [], offer_component_links: [] },
      formatMoney: () => "",
      validateOfferExchangeRequest: () => ({ ok: true }),
      resolveExchangeRateWithFallback: async () => ({ rate: 1 }),
      convertOfferLineAmountForCurrency: (component) => component,
      randomUUID: () => "uuid_1",
      writeGeneratedOfferPdf: async () => {
        await writeFile(pdfPath, "%PDF-1.4 draft pdf content", "utf8");
      },
      generatedOfferPdfPath: () => pdfPath,
      gmailDraftsConfig: {
        serviceAccountJsonPath: serviceAccountPath,
        impersonatedEmail: "info@asiatravelplan.com"
      },
      getBookingContactProfile: () => ({
        email: "traveler@example.com",
        name: "Alex Traveler"
      }),
      normalizeGeneratedOfferSnapshot: (generatedOffer) => generatedOffer,
      ensureFrozenGeneratedOfferPdf: async () => {
        await writeFile(pdfPath, "%PDF-1.4 draft pdf content", "utf8");
        return { pdfPath, sha256: "a".repeat(64) };
      },
      rm: async () => {},
      canAccessBooking: () => true,
      sendFileWithCache: async () => {}
    });

    await handlers.handleCreateGeneratedOfferGmailDraft({}, {}, ["booking_1", "generated_offer_1"]);

    assert.equal(fetchCalls.length, 2);
    assert.equal(responses.length, 1);
    assert.equal(responses[0].status, 200);
    assert.equal(responses[0].payload.draft_id, "draft-handler-123");
    assert.equal(responses[0].payload.generated_offer_id, "generated_offer_1");
    assert.equal(responses[0].payload.recipient_email, "traveler@example.com");
    assert.equal(responses[0].payload.activity_logged, false);
    assert.match(String(responses[0].payload.warning || ""), /could not be recorded/i);
    assert.equal(store.activities.length, 1);
    assert.equal(store.activities[0].type, "OFFER_EMAIL_DRAFT_CREATED");
  } finally {
    global.fetch = originalFetch;
    console.error = originalConsoleError;
    await rm(tempDir, { recursive: true, force: true });
  }
});
