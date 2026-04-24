import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { inlineTheme } from "../lib/style_tokens.js";
import { escapeHtml, normalizeText } from "../lib/text.js";

const DEFAULT_JSON_BODY_MAX_BYTES = 5 * 1024 * 1024;

function payloadTooLargeError(maxBytes) {
  const error = new Error(`Request body exceeds ${maxBytes} bytes.`);
  error.statusCode = 413;
  error.code = "PAYLOAD_TOO_LARGE";
  return error;
}

export function createHttpHelpers({ corsOrigin }) {
  function withCors(req, res) {
    const requestOrigin = normalizeText(req.headers.origin);
    const allowedOrigins = String(corsOrigin || "*")
      .split(",")
      .map((value) => normalizeText(value))
      .filter(Boolean);
    const allowAny = allowedOrigins.includes("*");
    const allowThisOrigin = allowAny
      ? requestOrigin || "*"
      : allowedOrigins.includes(requestOrigin)
        ? requestOrigin
        : allowedOrigins[0] || "";

    if (allowThisOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowThisOrigin);
    }
    if (requestOrigin) {
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key, Authorization, X-Requested-With");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  }

  function redirect(res, location) {
    res.writeHead(302, { Location: location });
    res.end();
  }

  function appendSetCookie(res, cookieValue) {
    const previous = res.getHeader("Set-Cookie");
    if (!previous) {
      res.setHeader("Set-Cookie", [cookieValue]);
      return;
    }
    const list = Array.isArray(previous) ? previous : [String(previous)];
    list.push(cookieValue);
    res.setHeader("Set-Cookie", list);
  }

  function sendJson(res, status, payload, extraHeaders = {}) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...extraHeaders });
    res.end(JSON.stringify(payload));
  }

  function sendHtml(res, status, html, extraHeaders = {}) {
    res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...extraHeaders });
    res.end(html);
  }

  function sendBackendNotFound(res, pathname) {
    const safePath = normalizeText(pathname) || "/";
    const backHref = safePath.startsWith("/backend") || safePath.startsWith("/bookings") ? "/bookings.html" : "/";
    const backLabel = safePath.startsWith("/backend") ? "Back to backend" : "Back to website";
    sendHtml(
      res,
      404,
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Page not found | AsiaTravelPlan</title>
      <style>
      :root {
        --ink: ${inlineTheme.ink};
        --muted: ${inlineTheme.muted};
        --line: ${inlineTheme.line};
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        font-family: "Segoe UI", "Avenir Next", "Helvetica Neue", Arial, sans-serif;
        color: var(--ink);
        background: linear-gradient(180deg, ${inlineTheme.bgStart} 0%, ${inlineTheme.bgEnd} 100%);
      }
      main {
        width: min(560px, 100%);
        background: ${inlineTheme.cardBg};
        border: 1px solid ${inlineTheme.cardBorder};
        border-radius: 20px;
        box-shadow: ${inlineTheme.shadow};
        padding: 2rem;
      }
      h1 { margin: 0 0 0.75rem; font-size: 1.8rem; }
      p { margin: 0 0 1rem; color: var(--muted); }
      .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1.5rem; }
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0.8rem 1rem;
        border-radius: 12px;
        border: 1px solid var(--line);
        color: var(--ink);
        text-decoration: none;
        font-weight: 600;
        background: ${inlineTheme.buttonText};
      }
      .btn-primary {
        background: ${inlineTheme.buttonBg};
        border-color: ${inlineTheme.buttonBg};
        color: ${inlineTheme.buttonText};
      }
      code {
        background: ${inlineTheme.codeBg};
        border-radius: 8px;
        padding: 0.15rem 0.35rem;
      }
      .meta { margin-top: 1.5rem; font-size: 0.95rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>Page not found</h1>
      <p class="booking">The backend route you requested does not exist or is no longer available.</p>
      <p class="contact">please contact Joachim</p>
      <div class="actions">
        <a class="btn btn-primary" href="${escapeHtml(backHref)}">${escapeHtml(backLabel)}</a>
        <a class="btn" href="mailto:info@asiatravelplan.com">Email us</a>
      </div>
      <p class="meta">Requested path: <code>${escapeHtml(safePath)}</code></p>
    </main>
  </body>
</html>`
    );
  }

  function getMimeTypeFromExt(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".pdf") return "application/pdf";
    if (ext === ".svg") return "image/svg+xml";
    if (ext === ".webp") return "image/webp";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".png") return "image/png";
    if (ext === ".avif") return "image/avif";
    return "application/octet-stream";
  }

  async function sendFileWithCache(req, res, filePath, cacheControl, extraHeaders = {}) {
    let fileStats;
    try {
      fileStats = await stat(filePath);
    } catch {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    if (!fileStats.isFile()) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    const etag = `W/"${fileStats.size}-${Number(fileStats.mtimeMs)}"`;
    const ifNoneMatch = normalizeText(req.headers["if-none-match"]);
    if (ifNoneMatch === etag) {
      res.writeHead(304, {
        "Cache-Control": cacheControl,
        ETag: etag,
        ...extraHeaders
      });
      res.end();
      return;
    }

    res.writeHead(200, {
      "Content-Type": getMimeTypeFromExt(filePath),
      "Cache-Control": cacheControl,
      ETag: etag,
      "Content-Length": String(fileStats.size),
      ...extraHeaders
    });

    const stream = createReadStream(filePath);
    stream.on("error", () => {
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Unable to read file" });
      } else {
        res.end();
      }
    });
    stream.pipe(res);
  }

  async function readBodyBuffer(req, options = {}) {
    const configuredMax = Number(options?.maxBytes ?? DEFAULT_JSON_BODY_MAX_BYTES);
    const maxBytes = Number.isFinite(configuredMax) && configuredMax > 0
      ? configuredMax
      : DEFAULT_JSON_BODY_MAX_BYTES;
    const contentLength = Number(req.headers?.["content-length"] || 0);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw payloadTooLargeError(maxBytes);
    }

    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > maxBytes) {
        throw payloadTooLargeError(maxBytes);
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks);
  }

  async function readBodyText(req, options = {}) {
    const buffer = await readBodyBuffer(req, options);
    return buffer.toString("utf8").trim();
  }

  async function readBodyJson(req, options = {}) {
    const text = await readBodyText(req, options);
    if (!text) return {};
    return JSON.parse(text);
  }

  return {
    withCors,
    redirect,
    appendSetCookie,
    sendJson,
    sendHtml,
    sendBackendNotFound,
    getMimeTypeFromExt,
    sendFileWithCache,
    readBodyBuffer,
    readBodyText,
    readBodyJson
  };
}
