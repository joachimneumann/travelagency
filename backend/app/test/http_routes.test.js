import test from "node:test";
import assert from "node:assert/strict";
import { buildApiRoutes } from "../src/http/routes.js";

test("buildApiRoutes materializes declared handlers when all handler keys are provided", () => {
  const handlers = new Proxy({}, {
    get: () => () => {}
  });

  const routes = buildApiRoutes({ handlers });
  assert.ok(Array.isArray(routes));
  assert.ok(routes.length > 0);
  assert.equal(routes.every((route) => typeof route.handler === "function"), true);
});

test("buildApiRoutes throws when a declared handler key is missing", () => {
  const handlers = new Proxy({}, {
    get: (_target, prop) => prop === "handlePatchBookingCustomerLanguage" ? undefined : () => {}
  });

  assert.throws(
    () => buildApiRoutes({ handlers }),
    /Missing route handler.*handlePatchBookingCustomerLanguage/
  );
});

test("buildApiRoutes includes the backend access check route", () => {
  const handlers = new Proxy({}, {
    get: () => () => {}
  });

  const routes = buildApiRoutes({ handlers });
  assert.equal(
    routes.some((route) => route.method === "GET" && route.pattern.test("/backend-access/check")),
    true
  );
});

test("buildApiRoutes includes the settings observability route", () => {
  const handlers = new Proxy({}, {
    get: () => () => {}
  });

  const routes = buildApiRoutes({ handlers });
  assert.equal(
    routes.some((route) => route.method === "GET" && route.pattern.test("/api/v1/settings/observability")),
    true
  );
});

test("buildApiRoutes includes tour reel video editor routes", () => {
  const handlers = new Proxy({}, {
    get: () => () => {}
  });

  const routes = buildApiRoutes({ handlers });
  const matches = (method) => routes.some((route) => route.method === method && route.pattern.test("/api/v1/tours/tour_alpha/video"));

  assert.equal(matches("GET"), true);
  assert.equal(matches("POST"), true);
  assert.equal(matches("DELETE"), true);
});
