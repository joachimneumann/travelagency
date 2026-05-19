function defaultEscapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function previewWindowMarkup(title, message, escapeHtml) {
  return `
    <head>
      <title>${escapeHtml(title)}</title>
      <style>
        :root {
          color-scheme: light;
        }
        body {
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          background: rgba(245, 241, 232, 0.78);
          backdrop-filter: blur(3px);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .pdf-preview-window__panel {
          min-width: min(28rem, calc(100vw - 3rem));
          max-width: 32rem;
          display: grid;
          justify-items: center;
          gap: 0.9rem;
          padding: 1.45rem 1.6rem;
          border: 1px solid rgba(202, 191, 173, 0.9);
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 24px 48px rgba(24, 35, 52, 0.16);
          text-align: center;
        }
        .pdf-preview-window__spinner {
          width: 2.2rem;
          height: 2.2rem;
          border: 3px solid rgba(202, 191, 173, 0.9);
          border-top-color: rgba(84, 93, 105, 1);
          border-radius: 999px;
          animation: pdf-preview-window-spin 0.8s linear infinite;
        }
        .pdf-preview-window__text {
          color: rgba(35, 52, 73, 1);
          font-size: 1rem;
          font-weight: 600;
        }
        .pdf-preview-window__text--error {
          color: #9e2a2b;
        }
        @keyframes pdf-preview-window-spin {
          to { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="pdf-preview-window__panel" role="status" aria-live="polite">
        <span class="pdf-preview-window__spinner" aria-hidden="true"></span>
        <span class="pdf-preview-window__text">${escapeHtml(message)}</span>
      </div>
    </body>
  `;
}

export function openPdfPreviewWindow({
  title,
  loadingMessage,
  escapeHtml = defaultEscapeHtml
} = {}) {
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) return null;
  previewWindow.document.title = title;
  previewWindow.document.documentElement.innerHTML = previewWindowMarkup(title, loadingMessage, escapeHtml);
  return previewWindow;
}

export function showPdfPreviewError(previewWindow, message, {
  title = "Preview PDF",
  escapeHtml = defaultEscapeHtml
} = {}) {
  if (!previewWindow || previewWindow.closed) return;
  previewWindow.document.title = title;
  previewWindow.document.documentElement.innerHTML = previewWindowMarkup(title, message, escapeHtml);
  const spinner = previewWindow.document.querySelector(".pdf-preview-window__spinner");
  const text = previewWindow.document.querySelector(".pdf-preview-window__text");
  if (spinner) spinner.hidden = true;
  if (text) text.classList.add("pdf-preview-window__text--error");
}

async function responseErrorMessage(response, fallbackMessage) {
  const text = await response.text().catch(() => "");
  if (!text) return fallbackMessage;
  try {
    const payload = JSON.parse(text);
    return String(payload?.detail || payload?.error || fallbackMessage).trim() || fallbackMessage;
  } catch {
    return text.trim() || fallbackMessage;
  }
}

export async function fetchAndShowPdfPreview({
  url,
  title = "Preview PDF",
  loadingMessage = "Generating PDF. Please wait.",
  errorMessage = "Could not preview PDF.",
  escapeHtml = defaultEscapeHtml,
  fetchImpl = window.fetch.bind(window),
  onPopupBlocked = null,
  onError = null
} = {}) {
  const previewWindow = openPdfPreviewWindow({ title, loadingMessage, escapeHtml });
  if (!previewWindow) {
    onPopupBlocked?.();
    return false;
  }

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/pdf"
      }
    });
    if (!response.ok) {
      throw new Error(await responseErrorMessage(response, errorMessage));
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    previewWindow.location.replace(blobUrl);
    previewWindow.addEventListener?.("beforeunload", () => URL.revokeObjectURL(blobUrl), { once: true });
    return true;
  } catch (error) {
    const message = String(error?.message || errorMessage);
    showPdfPreviewError(previewWindow, message, { title, escapeHtml });
    onError?.(error);
    return false;
  }
}
