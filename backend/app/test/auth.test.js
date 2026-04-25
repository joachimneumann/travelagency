import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { createAuth } from "../src/auth.js";

const AUTH_ENV_KEYS = [
  "KEYCLOAK_ENABLED",
  "KEYCLOAK_BASE_URL",
  "KEYCLOAK_REALM",
  "KEYCLOAK_CLIENT_ID",
  "KEYCLOAK_CLIENT_SECRET",
  "KEYCLOAK_ALLOWED_ROLES",
  "KEYCLOAK_ALLOWED_TOKEN_CLIENT_IDS",
  "LOCAL_QUICK_LOGIN_ENABLED",
  "LOCAL_QUICK_LOGIN_USER",
  "LOCAL_QUICK_LOGIN_PASSWORD",
  "LOCAL_KEYCLOAK_STAFF_PASSWORD"
];

let authContextCounter = 0;

async function withKeycloakAuthContext(fn) {
  const previousEnv = Object.fromEntries(AUTH_ENV_KEYS.map((key) => [key, process.env[key]]));
  authContextCounter += 1;
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  const kid = `test-key-${authContextCounter}`;
  const jwks = {
    keys: [{
      ...publicJwk,
      kid,
      alg: "RS256",
      use: "sig"
    }]
  };

  const server = createServer((req, res) => {
    if (req.url === "/realms/asiatravelplan/.well-known/openid-configuration") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        issuer,
        jwks_uri: `${issuer}/protocol/openid-connect/certs`,
        authorization_endpoint: `${issuer}/protocol/openid-connect/auth`,
        token_endpoint: `${issuer}/protocol/openid-connect/token`
      }));
      return;
    }
    if (req.url === "/realms/asiatravelplan/protocol/openid-connect/certs") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(jwks));
      return;
    }
    if (req.url === "/realms/asiatravelplan/protocol/openid-connect/token" && req.method === "POST") {
      let body = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", async () => {
        const params = new URLSearchParams(body);
        if (
          params.get("grant_type") === "password" &&
          params.get("username") === "joachim" &&
          params.get("password") === "atp" &&
          params.get("client_id") === "asiatravelplan-backend" &&
          params.get("client_secret") === "secret"
        ) {
          const accessToken = await signToken({ aud: "asiatravelplan-backend", azp: "asiatravelplan-backend" });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            access_token: accessToken,
            refresh_token: "refresh-token",
            token_type: "Bearer"
          }));
          return;
        }
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_grant" }));
      });
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const keycloakBaseUrl = `http://127.0.0.1:${server.address().port}`;
  const issuer = `${keycloakBaseUrl}/realms/asiatravelplan`;

  process.env.KEYCLOAK_ENABLED = "true";
  process.env.KEYCLOAK_BASE_URL = keycloakBaseUrl;
  process.env.KEYCLOAK_REALM = "asiatravelplan";
  process.env.KEYCLOAK_CLIENT_ID = "asiatravelplan-backend";
  process.env.KEYCLOAK_CLIENT_SECRET = "secret";
  process.env.KEYCLOAK_ALLOWED_ROLES = "atp_staff";
  process.env.KEYCLOAK_ALLOWED_TOKEN_CLIENT_IDS = "asiatravelplan-backend";

  async function signToken(claims) {
    return await new SignJWT({
      name: "Staff User",
      preferred_username: "staff",
      realm_access: { roles: ["atp_staff"] },
      ...claims
    })
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer(issuer)
      .setSubject("staff-user")
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(privateKey);
  }

  try {
    return await fn({ signToken });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function invokeAuthRoute(auth, path, { host = "localhost:8787" } = {}) {
  const requestUrl = new URL(path, "http://localhost");
  const route = auth.routes.find((entry) => entry.method === "GET" && entry.pattern.test(requestUrl.pathname));
  assert.ok(route, `Missing auth route for ${requestUrl.pathname}`);

  return await new Promise((resolve, reject) => {
    const headers = new Map();
    const res = {
      statusCode: 200,
      body: "",
      setHeader(name, value) {
        headers.set(String(name).toLowerCase(), value);
      },
      getHeader(name) {
        return headers.get(String(name).toLowerCase());
      },
      writeHead(status, values = {}) {
        this.statusCode = status;
        for (const [name, value] of Object.entries(values)) {
          this.setHeader(name, value);
        }
      },
      end(body = "") {
        this.body = String(body || "");
        resolve({
          statusCode: this.statusCode,
          headers: Object.fromEntries(headers.entries()),
          body: this.body
        });
      }
    };
    Promise.resolve(route.handler({
      url: path,
      headers: { host },
      socket: {}
    }, res)).catch(reject);
  });
}

test("bearer auth rejects valid realm tokens issued for another client", async () => {
  await withKeycloakAuthContext(async ({ signToken }) => {
    const auth = createAuth({ port: 8787 });
    const token = await signToken({ aud: "other-client", azp: "other-client" });

    const result = await auth.authorizeApiRequest({
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(result.ok, false);
  });
});

test("bearer auth accepts role-bearing tokens issued for an allowed client", async () => {
  await withKeycloakAuthContext(async ({ signToken }) => {
    const auth = createAuth({ port: 8787 });
    const token = await signToken({ aud: "asiatravelplan-backend", azp: "asiatravelplan-ios" });

    const result = await auth.authorizeApiRequest({
      headers: { authorization: `Bearer ${token}` }
    });

    assert.equal(result.ok, true);
    assert.equal(result.principal.preferred_username, "staff");
  });
});

test("local quick login creates a session only for loopback requests", async () => {
  await withKeycloakAuthContext(async () => {
    process.env.LOCAL_QUICK_LOGIN_USER = "joachim";
    process.env.LOCAL_QUICK_LOGIN_PASSWORD = "atp";
    const auth = createAuth({ port: 8787 });

    const localResult = await invokeAuthRoute(
      auth,
      "/auth/login?quick_login=1&return_to=%2Fbookings.html",
      { host: "localhost:8787" }
    );
    assert.equal(localResult.statusCode, 302);
    assert.equal(localResult.headers.location, "/bookings.html");
    assert.match(String(localResult.headers["set-cookie"] || ""), /asiatravelplan_session=/);

    const nonLocalResult = await invokeAuthRoute(
      auth,
      "/auth/login?quick_login=1&return_to=%2Fbookings.html",
      { host: "staging.asiatravelplan.com" }
    );
    assert.equal(nonLocalResult.statusCode, 302);
    assert.match(nonLocalResult.headers.location, /\/realms\/asiatravelplan\/protocol\/openid-connect\/auth/);
    assert.doesNotMatch(nonLocalResult.headers.location, /quick_login|login_hint/);
    assert.equal(nonLocalResult.headers["set-cookie"], undefined);
  });
});
