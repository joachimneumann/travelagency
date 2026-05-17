export function matrixMarketingTourHref(tourId) {
  const normalizedTourId = String(tourId ?? "").trim();
  return normalizedTourId ? `/marketing_tour.html?id=${encodeURIComponent(normalizedTourId)}` : "/marketing_tour.html";
}

export function renderMatrixHeaderActions({ visibilityControl = "" } = {}) {
  return `<div class="header-actions">
        ${visibilityControl}
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

    .matrix-marketing-tour-click {
      color: inherit;
      cursor: pointer;
      text-decoration: none;
    }

    .matrix-marketing-tour-click:hover {
      color: var(--accent);
      text-decoration: underline;
    }

    .matrix-marketing-tour-click img {
      cursor: pointer;
    }

    .matrix-tour-link[aria-disabled="true"],
    .matrix-marketing-tour-click[aria-disabled="true"] {
      cursor: wait;
      opacity: 0.65;
    }
`;

export const matrixPageControlScript = `
    (() => {
      const marketingTourLinks = Array.from(document.querySelectorAll("[data-open-marketing-tour]"));
      if (!marketingTourLinks.length) return;

      const responseMessage = async (response) => {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const payload = await response.json().catch(() => null);
          const error = String(payload?.error || "").trim();
          const detail = String(payload?.detail || "").trim();
          if (error && detail && detail !== error) {
            const separator = /[.!?]$/.test(error) ? " " : ": ";
            return error + separator + detail;
          }
          return error || detail || response.statusText || "Request failed.";
        }
        const text = await response.text().catch(() => "");
        return text.trim() || response.statusText || "Request failed.";
      };

      const loginUrl = () => {
        const url = new URL("/auth/login", window.location.origin);
        url.searchParams.set("return_to", window.location.href);
        return url.toString();
      };

      const redirectToLogin = () => {
        window.location.assign(loginUrl());
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
          try {
            if (!(await isLoggedIn())) {
              redirectToLogin();
              return;
            }

            window.open(link.href, "_blank", "noopener");
          } catch (error) {
            console.warn("Could not open marketing tour from matrix page.", error);
            redirectToLogin();
          } finally {
            link.removeAttribute("aria-disabled");
          }
        });
      });
    })();
`;
