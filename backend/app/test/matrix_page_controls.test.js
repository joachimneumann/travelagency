import test from "node:test";
import assert from "node:assert/strict";
import {
  matrixMarketingTourHref,
  matrixPageControlScript,
  matrixPageControlStyles,
  renderMatrixHeaderActions
} from "../../../scripts/content/matrix_page_controls.mjs";

function snapshotGlobal(name) {
  return Object.prototype.hasOwnProperty.call(globalThis, name)
    ? { hasValue: true, value: globalThis[name] }
    : { hasValue: false, value: undefined };
}

function restoreGlobal(name, snapshot) {
  if (snapshot.hasValue) {
    globalThis[name] = snapshot.value;
  } else {
    delete globalThis[name];
  }
}

test("matrix page controls do not include in-page matrix update controls", () => {
  const headerActions = renderMatrixHeaderActions({
    visibilityControl: '<button class="publication-toggle" type="button">Not published tours</button>'
  });
  const combined = `${headerActions}\n${matrixPageControlStyles}\n${matrixPageControlScript}`;

  assert.match(combined, /publication-toggle/);
  assert.doesNotMatch(combined, /data-update-matrices/);
  assert.doesNotMatch(combined, /matrix-update/);
  assert.doesNotMatch(combined, /tour-matrices\/publish/);
});

test("matrix marketing tour links redirect to login when auth is missing", async () => {
  const documentSnapshot = snapshotGlobal("document");
  const windowSnapshot = snapshotGlobal("window");
  const fetchSnapshot = snapshotGlobal("fetch");

  const tourLinkListeners = new Map();
  const attributes = new Map();
  const tourLink = {
    href: "https://staging.asiatravelplan.com/marketing_tour.html?id=tour_alpha",
    addEventListener: (eventName, listener) => {
      tourLinkListeners.set(eventName, listener);
    },
    getAttribute: (name) => attributes.get(name) || null,
    setAttribute: (name, value) => {
      attributes.set(name, value);
    },
    removeAttribute: (name) => {
      attributes.delete(name);
    }
  };
  const fetchCalls = [];
  const assignedUrls = [];
  const openedUrls = [];

  globalThis.document = {
    querySelectorAll: (selector) => (selector === "[data-open-marketing-tour]" ? [tourLink] : [])
  };
  globalThis.window = {
    location: {
      href: "https://staging.asiatravelplan.com/photo_matrix.html",
      origin: "https://staging.asiatravelplan.com",
      assign: (url) => assignedUrls.push(url)
    },
    open: (...args) => openedUrls.push(args)
  };
  globalThis.fetch = async (...args) => {
    fetchCalls.push(args);
    return {
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: { get: () => "application/json" },
      json: async () => ({ authenticated: false }),
      text: async () => ""
    };
  };

  try {
    (0, eval)(matrixPageControlScript);
    const clickListener = tourLinkListeners.get("click");
    assert.equal(typeof clickListener, "function");
    await clickListener({ preventDefault: () => {} });
  } finally {
    restoreGlobal("document", documentSnapshot);
    restoreGlobal("window", windowSnapshot);
    restoreGlobal("fetch", fetchSnapshot);
  }

  assert.equal(fetchCalls[0][0], "https://staging.asiatravelplan.com/auth/me");
  assert.equal(fetchCalls[0][1].method, "GET");
  assert.equal(fetchCalls[0][1].credentials, "include");
  assert.equal(fetchCalls[0][1].cache, "no-store");
  assert.deepEqual(openedUrls, []);
  assert.equal(
    assignedUrls[0],
    "https://staging.asiatravelplan.com/auth/login?return_to=https%3A%2F%2Fstaging.asiatravelplan.com%2Fphoto_matrix.html"
  );
  assert.equal(attributes.has("aria-disabled"), false);
});

test("matrix marketing tour links open the matching marketing_tour page after auth succeeds", async () => {
  const documentSnapshot = snapshotGlobal("document");
  const windowSnapshot = snapshotGlobal("window");
  const fetchSnapshot = snapshotGlobal("fetch");

  const tourId = "tour_alpha";
  const tourHref = `https://staging.asiatravelplan.com${matrixMarketingTourHref(tourId)}`;
  const attributes = new Map();
  let tourClickListener = null;
  const tourLink = {
    href: tourHref,
    addEventListener: (eventName, listener) => {
      if (eventName === "click") tourClickListener = listener;
    },
    getAttribute: (name) => attributes.get(name) || null,
    setAttribute: (name, value) => {
      attributes.set(name, value);
    },
    removeAttribute: (name) => {
      attributes.delete(name);
    }
  };
  const openedUrls = [];

  globalThis.document = {
    querySelectorAll: (selector) => (selector === "[data-open-marketing-tour]" ? [tourLink] : [])
  };
  globalThis.window = {
    location: {
      href: "https://staging.asiatravelplan.com/content_matrix.html",
      origin: "https://staging.asiatravelplan.com"
    },
    open: (...args) => openedUrls.push(args)
  };
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => "application/json" },
    json: async () => ({ authenticated: true, user: { sub: "user_1" } }),
    text: async () => ""
  });

  try {
    (0, eval)(matrixPageControlScript);
    assert.equal(typeof tourClickListener, "function");
    await tourClickListener({ preventDefault: () => {} });
  } finally {
    restoreGlobal("document", documentSnapshot);
    restoreGlobal("window", windowSnapshot);
    restoreGlobal("fetch", fetchSnapshot);
  }

  assert.deepEqual(openedUrls, [[tourHref, "_blank", "noopener"]]);
  assert.equal(attributes.has("aria-disabled"), false);
});
