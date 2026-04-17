import test from "node:test";
import assert from "node:assert/strict";
import { createStagingAccessHandlers } from "../src/http/staging_access.js";

function createHandlers(overrides = {}) {
  const redirects = [];
  const handlers = createStagingAccessHandlers({
    enabled: true,
    password: "atp",
    cookieSecret: "cookie-secret",
    speedBypassToken: "speed-secret",
    cookieName: "staging_access",
    maxAgeSeconds: 3600,
    redirect: (_res, location) => {
      redirects.push(location);
    },
    appendSetCookie: () => {},
    sendJson: () => {},
    sendHtml: () => {},
    readBodyText: async () => "",
    ...overrides
  });
  return { handlers, redirects };
}

function createResponseRecorder() {
  return {
    statusCode: null,
    ended: false,
    writeHead(statusCode) {
      this.statusCode = statusCode;
    },
    end() {
      this.ended = true;
    }
  };
}

test("staging access speed bypass allows the homepage root with the matching token", async () => {
  const { handlers, redirects } = createHandlers();
  const res = createResponseRecorder();

  await handlers.handleStagingAccessCheck(
    { headers: { "x-forwarded-uri": "/?test_speed=speed-secret" } },
    res
  );

  assert.equal(res.statusCode, 204);
  assert.equal(res.ended, true);
  assert.deepEqual(redirects, []);
});

test("staging access speed bypass allows /index.html with the matching token", async () => {
  const { handlers, redirects } = createHandlers();
  const res = createResponseRecorder();

  await handlers.handleStagingAccessCheck(
    { headers: { "x-forwarded-uri": "/index.html?test_speed=speed-secret" } },
    res
  );

  assert.equal(res.statusCode, 204);
  assert.equal(res.ended, true);
  assert.deepEqual(redirects, []);
});

test("staging access speed bypass does not unlock other staging pages", async () => {
  const { handlers, redirects } = createHandlers();
  const res = createResponseRecorder();

  await handlers.handleStagingAccessCheck(
    { headers: { "x-forwarded-uri": "/bookings.html?test_speed=speed-secret" } },
    res
  );

  assert.equal(res.statusCode, null);
  assert.equal(res.ended, false);
  assert.deepEqual(redirects, ["/staging-access/login?return_to=%2Fbookings.html%3Ftest_speed%3Dspeed-secret"]);
});

test("staging access speed bypass requires the configured token", async () => {
  const { handlers, redirects } = createHandlers();
  const res = createResponseRecorder();

  await handlers.handleStagingAccessCheck(
    { headers: { "x-forwarded-uri": "/?test_speed=wrong-token" } },
    res
  );

  assert.equal(res.statusCode, null);
  assert.equal(res.ended, false);
  assert.deepEqual(redirects, ["/staging-access/login?return_to=%2F%3Ftest_speed%3Dwrong-token"]);
});

test("staging access speed bypass is disabled when no token is configured", async () => {
  const { handlers, redirects } = createHandlers({ speedBypassToken: "" });
  const res = createResponseRecorder();

  await handlers.handleStagingAccessCheck(
    { headers: { "x-forwarded-uri": "/?test_speed=speed-secret" } },
    res
  );

  assert.equal(res.statusCode, null);
  assert.equal(res.ended, false);
  assert.deepEqual(redirects, ["/staging-access/login?return_to=%2F%3Ftest_speed%3Dspeed-secret"]);
});
