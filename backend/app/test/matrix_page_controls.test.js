import test from "node:test";
import assert from "node:assert/strict";
import {
  matrixMarketingTourHref,
  matrixPageControlScript
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

test("matrix page update checks login before publishing matrices", async () => {
  const documentSnapshot = snapshotGlobal("document");
  const windowSnapshot = snapshotGlobal("window");
  const fetchSnapshot = snapshotGlobal("fetch");

  const listeners = new Map();
  const updateButton = {
    disabled: false,
    textContent: "Update",
    addEventListener: (eventName, listener) => {
      listeners.set(eventName, listener);
    }
  };
  const statusClasses = new Map();
  const updateStatus = {
    hidden: true,
    textContent: "",
    classList: {
      toggle: (className, isActive) => {
        statusClasses.set(className, isActive);
      }
    }
  };
  const fetchCalls = [];
  const assignedUrls = [];

  globalThis.document = {
    querySelector: (selector) => {
      if (selector === "[data-update-matrices]") return updateButton;
      if (selector === "[data-update-matrices-status]") return updateStatus;
      return null;
    },
    querySelectorAll: () => []
  };
  globalThis.window = {
    location: {
      origin: "https://staging.asiatravelplan.com",
      href: "https://staging.asiatravelplan.com/photo_matrix.html",
      assign: (url) => assignedUrls.push(url)
    },
    setTimeout: (callback) => {
      callback();
      return 1;
    }
  };
  globalThis.fetch = async (...args) => {
    fetchCalls.push(args);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => "application/json" },
      json: async () => ({ authenticated: false }),
      text: async () => ""
    };
  };

  try {
    (0, eval)(matrixPageControlScript);
    const clickListener = listeners.get("click");
    assert.equal(typeof clickListener, "function");
    await clickListener();
  } finally {
    restoreGlobal("document", documentSnapshot);
    restoreGlobal("window", windowSnapshot);
    restoreGlobal("fetch", fetchSnapshot);
  }

  assert.equal(fetchCalls[0][0], "https://staging.asiatravelplan.com/auth/me");
  assert.equal(fetchCalls[0][1].method, "GET");
  assert.equal(fetchCalls[0][1].credentials, "include");
  assert.equal(fetchCalls[0][1].cache, "no-store");
  assert.equal(fetchCalls.length, 1);
  assert.equal(updateStatus.hidden, false);
  assert.equal(updateStatus.textContent, "Sign in required. Redirecting...");
  assert.equal(statusClasses.get("is-error"), true);
  assert.equal(
    assignedUrls[0],
    "https://staging.asiatravelplan.com/auth/login?return_to=https%3A%2F%2Fstaging.asiatravelplan.com%2Fphoto_matrix.html"
  );
});

test("matrix page update surfaces matrix publish failure details", async () => {
  const documentSnapshot = snapshotGlobal("document");
  const windowSnapshot = snapshotGlobal("window");
  const fetchSnapshot = snapshotGlobal("fetch");

  const listeners = new Map();
  const updateButton = {
    disabled: false,
    textContent: "Update",
    addEventListener: (eventName, listener) => {
      listeners.set(eventName, listener);
    }
  };
  const statusClasses = new Map();
  const updateStatus = {
    hidden: true,
    textContent: "",
    classList: {
      toggle: (className, isActive) => {
        statusClasses.set(className, isActive);
      }
    }
  };
  const fetchCalls = [];

  globalThis.document = {
    querySelector: (selector) => {
      if (selector === "[data-update-matrices]") return updateButton;
      if (selector === "[data-update-matrices-status]") return updateStatus;
      return null;
    },
    querySelectorAll: () => []
  };
  globalThis.window = {
    location: {
      origin: "https://staging.asiatravelplan.com",
      href: "https://staging.asiatravelplan.com/content_matrix.html"
    }
  };
  globalThis.fetch = async (...args) => {
    fetchCalls.push(args);
    if (String(args[0]).endsWith("/auth/me")) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: { get: () => "application/json" },
        json: async () => ({ authenticated: true, user: { sub: "user_1" } }),
        text: async () => ""
      };
    }
    return {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      headers: { get: () => "application/json" },
      json: async () => ({
        error: "Tour matrix publish failed.",
        detail: "Tour matrix output directory is not writable by uid 1000:gid 1000: /srv/matrix-pages"
      }),
      text: async () => ""
    };
  };

  try {
    (0, eval)(matrixPageControlScript);
    const clickListener = listeners.get("click");
    assert.equal(typeof clickListener, "function");
    await clickListener();
  } finally {
    restoreGlobal("document", documentSnapshot);
    restoreGlobal("window", windowSnapshot);
    restoreGlobal("fetch", fetchSnapshot);
  }

  assert.equal(fetchCalls[0][0], "https://staging.asiatravelplan.com/auth/me");
  assert.equal(fetchCalls[1][0], "/api/v1/tour-matrices/publish");
  assert.equal(fetchCalls[1][1].method, "POST");
  assert.equal(updateButton.disabled, false);
  assert.equal(updateButton.textContent, "Update");
  assert.equal(
    updateStatus.textContent,
    "Tour matrix publish failed. Tour matrix output directory is not writable by uid 1000:gid 1000: /srv/matrix-pages"
  );
  assert.equal(statusClasses.get("is-error"), true);
});

test("matrix marketing tour links show not logged on instead of opening when auth is missing", async () => {
  const documentSnapshot = snapshotGlobal("document");
  const windowSnapshot = snapshotGlobal("window");
  const fetchSnapshot = snapshotGlobal("fetch");

  const updateListeners = new Map();
  const tourLinkListeners = new Map();
  const updateButton = {
    disabled: false,
    textContent: "Update",
    addEventListener: (eventName, listener) => {
      updateListeners.set(eventName, listener);
    }
  };
  const statusClasses = new Map();
  const updateStatus = {
    hidden: true,
    textContent: "",
    classList: {
      toggle: (className, isActive) => {
        statusClasses.set(className, isActive);
      }
    }
  };
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
  const openedUrls = [];

  globalThis.document = {
    querySelector: (selector) => {
      if (selector === "[data-update-matrices]") return updateButton;
      if (selector === "[data-update-matrices-status]") return updateStatus;
      return null;
    },
    querySelectorAll: (selector) => (selector === "[data-open-marketing-tour]" ? [tourLink] : [])
  };
  globalThis.window = {
    location: {
      href: "https://staging.asiatravelplan.com/photo_matrix.html",
      origin: "https://staging.asiatravelplan.com"
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
  assert.equal(updateStatus.hidden, false);
  assert.equal(updateStatus.textContent, "not logged on");
  assert.equal(statusClasses.get("is-error"), true);
  assert.deepEqual(openedUrls, []);
  assert.equal(attributes.has("aria-disabled"), false);
});

test("matrix marketing tour links open the matching marketing_tour page after auth succeeds", async () => {
  const documentSnapshot = snapshotGlobal("document");
  const windowSnapshot = snapshotGlobal("window");
  const fetchSnapshot = snapshotGlobal("fetch");

  const tourId = "tour_alpha";
  const tourHref = `https://staging.asiatravelplan.com${matrixMarketingTourHref(tourId)}`;
  const updateButton = {
    addEventListener: () => {}
  };
  const updateStatus = {
    hidden: true,
    textContent: "",
    classList: {
      toggle: () => {}
    }
  };
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
    querySelector: (selector) => {
      if (selector === "[data-update-matrices]") return updateButton;
      if (selector === "[data-update-matrices-status]") return updateStatus;
      return null;
    },
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
