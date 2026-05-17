import test from "node:test";
import assert from "node:assert/strict";
import { createKeycloakUserHandlers } from "../src/http/handlers/keycloak_users.js";

test("keycloak users endpoint returns a warning and cached users when live directory lookup fails", async () => {
  const calls = [];
  const handlers = createKeycloakUserHandlers({
    getPrincipal: () => ({ roles: ["atp_admin"] }),
    canViewKeycloakUsers: () => true,
    listAssignableUsers: async () => {
      throw new Error("Keycloak directory request timed out after 2500ms for https://auth-staging.example/admin");
    },
    listCachedAssignableUsers: async () => [{
      id: "kc-joachim",
      username: "joachim",
      name: "Joachim Neumann",
      active: true,
      realm_roles: [],
      client_roles: ["atp_staff"]
    }],
    keycloakDisplayName: (user) => user?.name || user?.username || "",
    sendJson: (_res, status, body) => {
      calls.push({ status, body });
    }
  });

  await handlers.handleListKeycloakUsers({}, {});

  assert.equal(calls.length, 1);
  assert.equal(calls[0].status, 200);
  assert.equal(calls[0].body.unavailable, true);
  assert.equal(calls[0].body.stale, true);
  assert.match(String(calls[0].body.warning || ""), /Keycloak user directory unavailable/i);
  assert.match(String(calls[0].body.warning || ""), /Showing cached users/i);
  assert.equal(calls[0].body.total, 1);
  assert.equal(calls[0].body.items[0].username, "joachim");
  assert.equal(calls[0].body.items[0].name, "Joachim Neumann");
  assert.deepEqual(calls[0].body.items[0].client_roles, ["atp_staff"]);
});

test("keycloak users endpoint can prefer cached users without a live directory lookup", async () => {
  const calls = [];
  let liveDirectoryCalls = 0;
  const handlers = createKeycloakUserHandlers({
    getPrincipal: () => ({ roles: ["atp_admin"] }),
    canViewKeycloakUsers: () => true,
    listAssignableUsers: async () => {
      liveDirectoryCalls += 1;
      return [];
    },
    listCachedAssignableUsers: async () => [{
      id: "kc-amelie",
      username: "amelie",
      name: "Amelie Duong",
      active: true,
      realm_roles: [],
      client_roles: ["atp_staff"]
    }],
    keycloakDisplayName: (user) => user?.name || user?.username || "",
    sendJson: (_res, status, body) => {
      calls.push({ status, body });
    }
  });

  await handlers.handleListKeycloakUsers({ url: "/api/keycloak-users?prefer_cache=1" }, {});

  assert.equal(liveDirectoryCalls, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].status, 200);
  assert.equal(calls[0].body.cached, true);
  assert.equal(calls[0].body.stale, true);
  assert.equal(calls[0].body.total, 1);
  assert.equal(calls[0].body.items[0].username, "amelie");
});
