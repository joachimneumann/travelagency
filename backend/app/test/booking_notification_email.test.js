import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBookingNotificationEmail,
  createBookingNotificationEmailService
} from "../src/lib/booking_notification_email.js";
import { createZohoMailApiClient } from "../src/lib/zoho_mail_api.js";

function sampleBooking() {
  return {
    id: "booking_123",
    name: "Hoi An family trip",
    customer_language: "en",
    preferred_currency: "USD",
    created_at: "2026-04-26T09:00:00.000Z",
    web_form_submission: {
      booking_name: "Hoi An family trip",
      submitted_at: "2026-04-26T09:00:00.000Z",
      name: "Ada Customer",
      email: "ada@example.com",
      phone_number: "+84999999999",
      destinations: ["VN", "KH"],
      travel_style: ["culture", "food"],
      travel_month: "2026-08",
      number_of_travelers: 4,
      travel_duration_days_min: 7,
      travel_duration_days_max: 10,
      budget_lower_usd: 2000,
      budget_upper_usd: 3000,
      preferred_language: "en",
      preferred_currency: "USD",
      tour_id: "tour_abc",
      page_url: "https://asiatravelplan.com/tour.html",
      referrer: "https://example.com",
      utm_source: "newsletter",
      notes: "Please include easy cycling."
    }
  };
}

test("booking notification email includes submitted booking details", () => {
  const email = buildBookingNotificationEmail({
    booking: sampleBooking(),
    recipientEmail: "booking@asiatravelplan.com",
    logoUrl: "https://asiatravelplan.com/assets/generated/runtime/brand-logo.png",
    backendBaseUrl: "https://asiatravelplan.com"
  });

  assert.equal(email.subject, "New booking: Hoi An family trip");
  assert.match(email.htmlBody, /<img[^>]+Asia Travel Plan/);
  assert.match(email.htmlBody, /https:\/\/asiatravelplan\.com\/assets\/generated\/runtime\/brand-logo\.png/);
  assert.match(email.htmlBody, /https:\/\/asiatravelplan\.com\/booking\.html\?id=booking_123/);
  assert.match(email.htmlBody, /Open booking in backend/);
  assert.match(email.htmlBody, /Ada Customer/);
  assert.match(email.htmlBody, /ada@example\.com/);
  assert.match(email.htmlBody, /VN, KH/);
  assert.match(email.htmlBody, /7 - 10 days/);
  assert.match(email.htmlBody, /USD 2000 - 3000/);
  assert.match(email.htmlBody, /booking@asiatravelplan\.com/);
  assert.doesNotMatch(email.htmlBody, /Booking ID/);
  assert.doesNotMatch(email.htmlBody, /Tour ID/);
  assert.doesNotMatch(email.htmlBody, /Page URL/);
  assert.doesNotMatch(email.htmlBody, /Referrer/);
  assert.doesNotMatch(email.htmlBody, /UTM/);
  assert.doesNotMatch(email.htmlBody, /IP country/);
});

test("booking notification email omits blank submitted fields", () => {
  const booking = sampleBooking();
  booking.web_form_submission.phone_number = "";
  booking.web_form_submission.travel_style = [];
  booking.web_form_submission.notes = "";
  booking.notes = "";

  const email = buildBookingNotificationEmail({
    booking,
    recipientEmail: "booking@asiatravelplan.com"
  });

  assert.doesNotMatch(email.htmlBody, />Phone</);
  assert.doesNotMatch(email.htmlBody, />Travel style</);
  assert.doesNotMatch(email.htmlBody, />Notes</);
  assert.doesNotMatch(email.htmlBody, />Message</);
});

test("booking notification service sends through configured Zoho Mail API client", async () => {
  const calls = [];
  const service = createBookingNotificationEmailService({
    config: {
      enabled: true,
      recipientEmail: "booking@asiatravelplan.com",
      fromEmail: "noreply@asiatravelplan.com",
      logoUrl: "https://asiatravelplan.com/assets/generated/runtime/brand-logo.png",
      backendBaseUrl: "https://asiatravelplan.com",
      zoho: {
        accountsBaseUrl: "https://accounts.zoho.com",
        mailApiBaseUrl: "https://mail.zoho.com",
        clientId: "zoho-client-id",
        clientSecret: "zoho-client-secret",
        refreshToken: "zoho-refresh-token",
        accountId: "3042681000000008002"
      }
    },
    mailClientFactory: (clientConfig) => ({
      async sendMessage(payload) {
        calls.push({ clientConfig, payload });
        return { messageId: "message_123" };
      }
    })
  });

  const result = await service.notifyBookingCreated(sampleBooking());

  assert.deepEqual(result, { sent: true, messageId: "message_123" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].clientConfig.accountsBaseUrl, "https://accounts.zoho.com");
  assert.equal(calls[0].clientConfig.mailApiBaseUrl, "https://mail.zoho.com");
  assert.equal(calls[0].clientConfig.clientId, "zoho-client-id");
  assert.equal(calls[0].clientConfig.clientSecret, "zoho-client-secret");
  assert.equal(calls[0].clientConfig.refreshToken, "zoho-refresh-token");
  assert.equal(calls[0].clientConfig.accountId, "3042681000000008002");
  assert.equal(calls[0].clientConfig.fromEmail, "noreply@asiatravelplan.com");
  assert.equal(calls[0].payload.to, "booking@asiatravelplan.com");
  assert.equal(calls[0].payload.subject, "New booking: Hoi An family trip");
  assert.match(calls[0].payload.htmlBody, /Open booking in backend/);
});

test("booking notification service skips when disabled or Zoho Mail API config is missing", async () => {
  const loggerMessages = [];
  const disabled = createBookingNotificationEmailService({
    config: { enabled: false },
    mailClientFactory: () => {
      throw new Error("should not create client");
    }
  });

  assert.deepEqual(await disabled.notifyBookingCreated(sampleBooking()), {
    sent: false,
    skipped: "disabled"
  });

  const missingConfig = createBookingNotificationEmailService({
    config: { enabled: true, recipientEmail: "booking@asiatravelplan.com" },
    logger: {
      warn(message) {
        loggerMessages.push(message);
      }
    },
    mailClientFactory: () => {
      throw new Error("should not create client");
    }
  });

  assert.deepEqual(await missingConfig.notifyBookingCreated(sampleBooking()), {
    sent: false,
    skipped: "missing_zoho_config"
  });
  assert.equal(loggerMessages.length, 1);
});

test("Zoho Mail API client refreshes OAuth token and sends HTML email", async () => {
  const calls = [];
  const client = createZohoMailApiClient({
    accountsBaseUrl: "https://accounts.zoho.com",
    mailApiBaseUrl: "https://mail.zoho.com",
    clientId: "zoho-client-id",
    clientSecret: "zoho-client-secret",
    refreshToken: "zoho-refresh-token",
    accountId: "3042681000000008002",
    fromEmail: "noreply@asiatravelplan.com",
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).startsWith("https://accounts.zoho.com/oauth/v2/token")) {
        return new Response(JSON.stringify({
          access_token: "access-token-123",
          expires_in: 3600
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        status: { code: 200, description: "success" },
        data: { messageId: "1726208416259127700" }
      }), { status: 200 });
    }
  });

  const result = await client.sendMessage({
    to: "booking@asiatravelplan.com",
    subject: "New booking: Hoi An family trip",
    htmlBody: "<p>Hello</p>"
  });

  assert.deepEqual(result, { messageId: "1726208416259127700" });
  assert.equal(calls.length, 2);
  const tokenUrl = new URL(calls[0].url);
  assert.equal(tokenUrl.pathname, "/oauth/v2/token");
  assert.equal(tokenUrl.searchParams.get("grant_type"), "refresh_token");
  assert.equal(tokenUrl.searchParams.get("client_id"), "zoho-client-id");
  assert.equal(tokenUrl.searchParams.get("client_secret"), "zoho-client-secret");
  assert.equal(tokenUrl.searchParams.get("refresh_token"), "zoho-refresh-token");
  assert.equal(calls[1].url, "https://mail.zoho.com/api/accounts/3042681000000008002/messages");
  assert.equal(calls[1].options.headers.Authorization, "Zoho-oauthtoken access-token-123");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    fromAddress: "noreply@asiatravelplan.com",
    toAddress: "booking@asiatravelplan.com",
    subject: "New booking: Hoi An family trip",
    content: "<p>Hello</p>",
    mailFormat: "html",
    encoding: "UTF-8"
  });
});
