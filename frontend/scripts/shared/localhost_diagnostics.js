(function localhostDiagnosticsBootstrap() {
  const host = String(window.location.hostname || "").trim().toLowerCase();
  if (host !== "localhost" && host !== "127.0.0.1") return;
  if (window.__ATP_LOCALHOST_DIAGNOSTICS_INSTALLED__ === true) return;
  window.__ATP_LOCALHOST_DIAGNOSTICS_INSTALLED__ = true;

  const PREFIX = "[localhost-diagnostics]";
  const apiBase = String(window.ASIATRAVELPLAN_API_BASE || window.location.origin).replace(/\/$/, "");
  const configuredHealthProbeUrl = String(window.ASIATRAVELPLAN_HEALTH_PROBE_URL || "").trim();
  const healthProbeUrl = (() => {
    if (configuredHealthProbeUrl) {
      try {
        return new URL(configuredHealthProbeUrl, window.location.origin).toString();
      } catch {
        return configuredHealthProbeUrl;
      }
    }
    try {
      return new URL("/health", window.location.origin).toString();
    } catch {
      return `${window.location.protocol}//${host}/health`;
    }
  })();

  function snapshot(extra = {}) {
    return {
      location_href: window.location.href,
      location_origin: window.location.origin,
      api_base: apiBase,
      health_probe_url: healthProbeUrl,
      navigator_on_line: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
      document_ready_state: document.readyState,
      timestamp: new Date().toISOString(),
      ...extra
    };
  }

  function info(message, extra = {}) {
    console.info(`${PREFIX} ${message}`, snapshot(extra));
  }

  function warn(message, extra = {}) {
    console.warn(`${PREFIX} ${message}`, snapshot(extra));
  }

  function error(message, extra = {}, err = null) {
    const payload = snapshot(extra);
    if (err) {
      payload.error_name = err?.name || null;
      payload.error_message = err?.message || String(err);
      if (err?.stack) payload.error_stack = err.stack;
      console.error(`${PREFIX} ${message}`, payload, err);
      return;
    }
    console.error(`${PREFIX} ${message}`, payload);
  }

  function safeReason(reason) {
    if (reason instanceof Error) return reason.message;
    if (typeof reason === "string") return reason;
    if (reason && typeof reason === "object") {
      try {
        return JSON.stringify(reason);
      } catch {
        return String(reason);
      }
    }
    return String(reason);
  }

  function firstNonEmptyString(values = []) {
    for (const value of values) {
      if (typeof value !== "string") continue;
      const normalized = value.trim();
      if (normalized) return normalized;
    }
    return "";
  }

  function attributeValue(target, name) {
    if (!target || typeof target.getAttribute !== "function") return "";
    return String(target.getAttribute(name) || "").trim();
  }

  function resourceDetails(target) {
    const resourceUrl = firstNonEmptyString([
      typeof target?.currentSrc === "string" ? target.currentSrc : "",
      typeof target?.src === "string" ? target.src : "",
      typeof target?.href === "string" ? target.href : "",
      attributeValue(target, "src"),
      attributeValue(target, "href"),
      attributeValue(target, "data-src"),
      attributeValue(target, "poster"),
      attributeValue(target, "srcset").split(",")[0]?.trim().split(/\s+/)[0] || ""
    ]);
    return {
      resource_url: resourceUrl,
      data_src: attributeValue(target, "data-src"),
      poster: attributeValue(target, "poster")
    };
  }

  async function probeBackendHealth() {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = window.setTimeout(() => controller?.abort(), 2500);
    info("probing backend health", { health_url: healthProbeUrl });
    try {
      const response = await fetch(healthProbeUrl, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        signal: controller?.signal
      });
      const bodyText = await response.text().catch(() => "");
      if (!response.ok) {
        warn("backend health probe returned a non-OK response", {
          health_url: healthProbeUrl,
          status: response.status,
          status_text: response.statusText,
          response_preview: bodyText.slice(0, 200)
        });
        return;
      }
      info("backend health probe succeeded", {
        health_url: healthProbeUrl,
        status: response.status,
        response_preview: bodyText.slice(0, 200)
      });
    } catch (err) {
      error("backend health probe failed", {
        health_url: healthProbeUrl,
        likely_cause: "The local frontend server or its /health backend proxy may not be reachable on localhost."
      }, err);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  window.__ATP_LOCALHOST_DIAGNOSTICS_LOG__ = { info, warn, error, snapshot };

  info("head bootstrap", {
    user_agent: navigator.userAgent,
    cookie_enabled: Boolean(navigator.cookieEnabled)
  });

  document.addEventListener("DOMContentLoaded", () => {
    info("DOMContentLoaded");
    void probeBackendHealth();
  }, { once: true });

  window.addEventListener("load", () => {
    info("window load");
  }, { once: true });

  window.setTimeout(() => {
    if (document.readyState !== "complete") {
      warn("page still not fully loaded after 4 seconds");
    }
  }, 4000);

  window.addEventListener("online", () => {
    info("browser reported online");
  });

  window.addEventListener("offline", () => {
    warn("browser reported offline");
  });

  window.addEventListener("error", (event) => {
    const target = event.target;
    if (target && target !== window) {
      error("resource failed to load", {
        tag_name: String(target.tagName || "").toLowerCase(),
        ...resourceDetails(target)
      });
      return;
    }
    error("uncaught error reached window", {
      message: event.message || "",
      source: event.filename || "",
      line: Number(event.lineno || 0),
      column: Number(event.colno || 0)
    }, event.error || null);
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    error("unhandled promise rejection", {
      rejection_reason: safeReason(reason)
    }, reason instanceof Error ? reason : null);
  });
})();
