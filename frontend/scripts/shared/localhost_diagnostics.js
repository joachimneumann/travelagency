(function localhostDiagnosticsBootstrap() {
  const host = String(window.location.hostname || "").trim().toLowerCase();
  if (host !== "localhost" && host !== "127.0.0.1") return;
  if (window.__ATP_LOCALHOST_DIAGNOSTICS_INSTALLED__ === true) return;
  window.__ATP_LOCALHOST_DIAGNOSTICS_INSTALLED__ = true;

  const PREFIX = "[localhost-diagnostics]";
  const apiBase = String(window.ASIATRAVELPLAN_API_BASE || window.location.origin).replace(/\/$/, "");
  const localBackendPort = String(window.ASIATRAVELPLAN_LOCAL_BACKEND_PORT || "8787").trim() || "8787";
  const healthProbeBase = (() => {
    try {
      const url = new URL(apiBase || window.location.origin, window.location.origin);
      url.port = localBackendPort;
      return url.origin;
    } catch {
      return `${window.location.protocol}//${host}:${localBackendPort}`;
    }
  })();

  function snapshot(extra = {}) {
    return {
      location_href: window.location.href,
      location_origin: window.location.origin,
      api_base: apiBase,
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

  async function probeBackendHealth() {
    const healthUrl = `${healthProbeBase}/health`;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = window.setTimeout(() => controller?.abort(), 2500);
    info("probing backend health", { health_url: healthUrl });
    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        signal: controller?.signal
      });
      const bodyText = await response.text().catch(() => "");
      if (!response.ok) {
        warn("backend health probe returned a non-OK response", {
          health_url: healthUrl,
          status: response.status,
          status_text: response.statusText,
          response_preview: bodyText.slice(0, 200)
        });
        return;
      }
      info("backend health probe succeeded", {
        health_url: healthUrl,
        status: response.status,
        response_preview: bodyText.slice(0, 200)
      });
    } catch (err) {
      error("backend health probe failed", {
        health_url: healthUrl,
        likely_cause: "The local frontend server or backend proxy may not be reachable on localhost."
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
        resource_url: String(target.currentSrc || target.src || target.href || "")
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
