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

      updateButton.addEventListener("click", async () => {
        updateButton.disabled = true;
        updateButton.textContent = "Updating...";
        setStatus("Publishing matrices...");

        try {
          const response = await fetch("/api/v1/tour-matrices/publish", {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Accept": "application/json"
            }
          });

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
