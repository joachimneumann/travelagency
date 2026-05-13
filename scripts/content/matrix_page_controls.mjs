export function matrixMarketingTourHref(tourId) {
  const normalizedTourId = String(tourId ?? "").trim();
  return normalizedTourId ? `/marketing_tour.html?id=${encodeURIComponent(normalizedTourId)}` : "/marketing_tour.html";
}

export function renderMatrixHeaderActions({ visibilityControl = "" } = {}) {
  return `<div class="header-actions">
        ${visibilityControl}
        <button class="matrix-update" type="button" data-update-matrices>Update</button>
        <span class="matrix-update-status" data-update-matrices-status role="status" aria-live="polite" hidden></span>
      </div>`;
}

export const matrixPageControlStyles = `
    .header-actions {
      align-items: flex-start;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }

    .matrix-update {
      background: var(--accent);
      border: 1px solid var(--accent);
      color: #ffffff;
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      min-height: 34px;
      padding: 6px 10px;
      white-space: nowrap;
    }

    .matrix-update:hover {
      background: #115e59;
      border-color: #115e59;
    }

    .matrix-tour-link {
      align-items: center;
      border: 1px solid var(--line);
      color: var(--accent);
      display: inline-flex;
      font-size: 12px;
      font-weight: 700;
      margin-top: 8px;
      min-height: 28px;
      padding: 4px 8px;
      text-decoration: none;
      white-space: nowrap;
    }

    .matrix-tour-link:hover {
      background: #edf5f2;
      border-color: var(--accent);
    }

    .matrix-tour-link[aria-disabled="true"] {
      cursor: wait;
      opacity: 0.65;
    }

    .matrix-update:disabled {
      cursor: wait;
      opacity: 0.7;
    }

    .matrix-update[hidden],
    .matrix-update-status[hidden] {
      display: none;
    }

    .matrix-update-status {
      color: var(--muted);
      font-size: 12px;
      max-width: 260px;
      min-height: 34px;
      overflow-wrap: anywhere;
      padding-top: 8px;
    }

    .matrix-update-status.is-error {
      color: #b91c1c;
      font-weight: 700;
    }

    .matrix-update-status.is-success {
      color: var(--accent);
      font-weight: 700;
    }
`;

export const matrixPageControlScript = `
    (() => {
      const updateButton = document.querySelector("[data-update-matrices]");
      const updateStatus = document.querySelector("[data-update-matrices-status]");
      if (!updateButton || !updateStatus) return;
      const marketingTourLinks = Array.from(document.querySelectorAll("[data-open-marketing-tour]"));

      const setStatus = (message, state = "") => {
        updateStatus.hidden = !message;
        updateStatus.textContent = message;
        updateStatus.classList.toggle("is-error", state === "error");
        updateStatus.classList.toggle("is-success", state === "success");
      };

      const responseMessage = async (response) => {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const payload = await response.json().catch(() => null);
          return payload?.error || payload?.detail || response.statusText || "Update failed.";
        }
        const text = await response.text().catch(() => "");
        return text.trim() || response.statusText || "Update failed.";
      };

      const loginUrl = () => {
        const url = new URL("/auth/login", window.location.origin);
        url.searchParams.set("return_to", window.location.href);
        return url.toString();
      };

      const redirectToLogin = () => {
        setStatus("Sign in required. Redirecting...", "error");
        window.setTimeout(() => window.location.assign(loginUrl()), 450);
      };

      const authMeUrl = () => new URL("/auth/me", window.location.href).toString();

      const isLoggedIn = async () => {
        const response = await fetch(authMeUrl(), {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Accept": "application/json"
          }
        });
        if (response.status === 401) return false;
        if (!response.ok) throw new Error(await responseMessage(response));
        const payload = await response.json().catch(() => null);
        return payload?.authenticated === true;
      };

      marketingTourLinks.forEach((link) => {
        link.addEventListener("click", async (event) => {
          event.preventDefault();
          if (link.getAttribute("aria-disabled") === "true") return;

          link.setAttribute("aria-disabled", "true");
          setStatus("");
          try {
            if (!(await isLoggedIn())) {
              setStatus("not logged in", "error");
              return;
            }

            window.open(link.href, "_blank", "noopener");
          } catch {
            setStatus("not logged in", "error");
          } finally {
            link.removeAttribute("aria-disabled");
          }
        });
      });

      updateButton.addEventListener("click", async () => {
        updateButton.disabled = true;
        updateButton.textContent = "Updating...";
        setStatus("Publishing matrices...");

        try {
          const response = await fetch("/api/v1/tour-matrices/publish", {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            headers: {
              "Accept": "application/json"
            }
          });

          if (response.status === 401) {
            redirectToLogin();
            return;
          }

          if (!response.ok) {
            throw new Error(await responseMessage(response));
          }

          setStatus("Updated. Reloading...", "success");
          window.setTimeout(() => window.location.reload(), 900);
        } catch (error) {
          updateButton.disabled = false;
          updateButton.textContent = "Update";
          setStatus(error?.message || "Update failed.", "error");
        }
      });
    })();
`;
