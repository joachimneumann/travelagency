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
  "KEYCLOAK_ALLOWED_TOKEN_CLIENT_IDS"
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
        jwks_uri: `${issuer}/protocol/openid-connect/certs`
      }));
      return;
    }
    if (req.url === "/realms/asiatravelplan/protocol/openid-connect/certs") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(jwks));
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
