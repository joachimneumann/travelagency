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
