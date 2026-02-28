import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import { createAuth } from "./auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(APP_ROOT, "data", "store.json");
const TOURS_DIR = path.join(APP_ROOT, "data", "tours");
const INVOICES_DIR = path.join(APP_ROOT, "data", "invoices");
const TEMP_UPLOAD_DIR = path.join(APP_ROOT, "data", "tmp");
const STAFF_PATH = path.join(APP_ROOT, "config", "staff.json");
const LOGO_PNG_PATH = path.resolve(APP_ROOT, "..", "..", "assets", "img", "logo-asiatravelplan.png");
const PORT = Number(process.env.PORT || 8787);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const execFile = promisify(execFileCb);
const COMPANY_PROFILE = {
  name: "AsiaTravelPlan",
  website: "asiatravelplan.com",
  address: "alley 378 Cua Dai, 550000 Hoi An, Vietnam",
  whatsapp: "+84 337942446",
  email: "info@asiatravelplan.com"
};

const STAGES = {
  NEW: "NEW",
  QUALIFIED: "QUALIFIED",
  PROPOSAL_SENT: "PROPOSAL_SENT",
  NEGOTIATION: "NEGOTIATION",
  INVOICE_SENT: "INVOICE_SENT",
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
  WON: "WON",
  LOST: "LOST",
  POST_TRIP: "POST_TRIP"
};

const STAGE_ORDER = [
  STAGES.NEW,
  STAGES.QUALIFIED,
  STAGES.PROPOSAL_SENT,
  STAGES.NEGOTIATION,
  STAGES.INVOICE_SENT,
  STAGES.PAYMENT_RECEIVED,
  STAGES.WON,
  STAGES.LOST,
  STAGES.POST_TRIP
];

const ALLOWED_STAGE_TRANSITIONS = {
  [STAGES.NEW]: STAGE_ORDER,
  [STAGES.QUALIFIED]: STAGE_ORDER,
  [STAGES.PROPOSAL_SENT]: STAGE_ORDER,
  [STAGES.NEGOTIATION]: STAGE_ORDER,
  [STAGES.INVOICE_SENT]: STAGE_ORDER,
  [STAGES.PAYMENT_RECEIVED]: STAGE_ORDER,
  [STAGES.WON]: STAGE_ORDER,
  [STAGES.LOST]: STAGE_ORDER,
  [STAGES.POST_TRIP]: STAGE_ORDER
};

const SLA_HOURS = {
  [STAGES.NEW]: 2,
  [STAGES.QUALIFIED]: 8,
  [STAGES.PROPOSAL_SENT]: 24,
  [STAGES.NEGOTIATION]: 48,
  [STAGES.INVOICE_SENT]: 24,
  [STAGES.PAYMENT_RECEIVED]: 0,
  [STAGES.WON]: 24,
  [STAGES.LOST]: 0,
  [STAGES.POST_TRIP]: 0
};

let writeQueue = Promise.resolve();
const auth = createAuth({ port: PORT });

const routes = [
  ...auth.routes,
  { method: "GET", pattern: /^\/health$/, handler: handleHealth },
  { method: "GET", pattern: /^\/public\/v1\/tours$/, handler: handlePublicListTours },
  { method: "GET", pattern: /^\/public\/v1\/tour-images\/(.+)$/, handler: handlePublicTourImage },
  { method: "POST", pattern: /^\/public\/v1\/leads$/, handler: handleCreateLead },
  { method: "GET", pattern: /^\/api\/v1\/leads$/, handler: handleListLeads },
  { method: "GET", pattern: /^\/api\/v1\/leads\/([^/]+)$/, handler: handleGetLead },
  { method: "PATCH", pattern: /^\/api\/v1\/leads\/([^/]+)\/stage$/, handler: handlePatchLeadStage },
  { method: "PATCH", pattern: /^\/api\/v1\/leads\/([^/]+)\/owner$/, handler: handlePatchLeadOwner },
  { method: "GET", pattern: /^\/api\/v1\/leads\/([^/]+)\/activities$/, handler: handleListActivities },
  { method: "POST", pattern: /^\/api\/v1\/leads\/([^/]+)\/activities$/, handler: handleCreateActivity },
  { method: "GET", pattern: /^\/api\/v1\/leads\/([^/]+)\/invoices$/, handler: handleListLeadInvoices },
  { method: "POST", pattern: /^\/api\/v1\/leads\/([^/]+)\/invoices$/, handler: handleCreateLeadInvoice },
  { method: "PATCH", pattern: /^\/api\/v1\/leads\/([^/]+)\/invoices\/([^/]+)$/, handler: handlePatchLeadInvoice },
  { method: "GET", pattern: /^\/api\/v1\/invoices\/([^/]+)\/pdf$/, handler: handleGetInvoicePdf },
  { method: "GET", pattern: /^\/api\/v1\/customers$/, handler: handleListCustomers },
  { method: "GET", pattern: /^\/api\/v1\/customers\/([^/]+)$/, handler: handleGetCustomer },
  { method: "GET", pattern: /^\/api\/v1\/staff$/, handler: handleListStaff },
  { method: "GET", pattern: /^\/api\/v1\/tours$/, handler: handleListTours },
  { method: "GET", pattern: /^\/api\/v1\/tours\/([^/]+)$/, handler: handleGetTour },
  { method: "POST", pattern: /^\/api\/v1\/tours$/, handler: handleCreateTour },
  { method: "PATCH", pattern: /^\/api\/v1\/tours\/([^/]+)$/, handler: handlePatchTour },
  { method: "POST", pattern: /^\/api\/v1\/tours\/([^/]+)\/image$/, handler: handleUploadTourImage },
  { method: "GET", pattern: /^\/admin$/, handler: handleAdminHome },
  { method: "GET", pattern: /^\/admin\/customers$/, handler: handleAdminCustomersPage },
  { method: "GET", pattern: /^\/admin\/customers\/([^/]+)$/, handler: handleAdminCustomerDetailPage },
  { method: "GET", pattern: /^\/admin\/leads$/, handler: handleAdminLeadsPage },
  { method: "GET", pattern: /^\/admin\/leads\/([^/]+)$/, handler: handleAdminLeadDetailPage }
];

await ensureStorage();

createServer(async (req, res) => {
  try {
    auth.pruneState();
    withCors(req, res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const requestUrl = new URL(req.url, "http://localhost");
    const pathname = requestUrl.pathname;

    if (pathname.startsWith("/admin") && auth.isKeycloakEnabled()) {
      if (!auth.hasSession(req)) {
        const returnTo = `${pathname}${requestUrl.search || ""}`;
        redirect(res, auth.getLoginRedirect(returnTo));
        return;
      }
    }

    if (pathname.startsWith("/api/v1/")) {
      const authz = await auth.authorizeApiRequest(req, requestUrl);
      if (!authz.ok) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
    }

    for (const route of routes) {
      if (route.method !== req.method) continue;
      const match = pathname.match(route.pattern);
      if (!match) continue;
      const params = match.slice(1);
      await route.handler(req, res, params);
      return;
    }

    if (pathname.startsWith("/api/")) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    sendBackendNotFound(res, pathname);
  } catch (error) {
    sendJson(res, 500, { error: "Internal server error", detail: String(error?.message || error) });
  }
}).listen(PORT, () => {
  console.log(`AsiaTravelPlan backend listening on http://localhost:${PORT}`);
});

async function ensureStorage() {
  await mkdir(TOURS_DIR, { recursive: true });
  await mkdir(INVOICES_DIR, { recursive: true });
  await mkdir(TEMP_UPLOAD_DIR, { recursive: true });
}

function withCors(req, res) {
  const requestOrigin = normalizeText(req.headers.origin);
  const allowedOrigins = String(CORS_ORIGIN || "*")
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
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...extraHeaders });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function sendBackendNotFound(res, pathname = "") {
  const backHref = pathname.startsWith("/admin") ? "/admin" : "/";
  const backLabel = pathname.startsWith("/admin") ? "Back to backend" : "Back to website";

  sendHtml(
    res,
    404,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Not Found | AsiaTravelPlan Backend</title>
    <style>
      :root {
        --ink: #163040;
        --muted: #5b6c78;
        --line: #d7e0e6;
        --paper: #f4f7f8;
        --white: #ffffff;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        min-height: 100vh;
        font-family: "Segoe UI", "Avenir Next", "Helvetica Neue", Arial, sans-serif;
        color: var(--ink);
        background: linear-gradient(180deg, #f7fafb 0%, #eef3f5 100%);
        display: grid;
        place-items: center;
        padding: 1.5rem;
      }
      .panel {
        width: min(760px, 100%);
        background: rgba(255,255,255,0.92);
        border: 1px solid var(--line);
        border-radius: 24px;
        box-shadow: 0 18px 48px rgba(22, 48, 64, 0.10);
        padding: 2.5rem;
      }
      .eyebrow {
        margin: 0 0 0.75rem;
        font-size: 0.8rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
      }
      h1 {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3.2rem);
        line-height: 0.98;
      }
      .lead {
        margin: 1rem 0 0;
        max-width: 34ch;
        color: var(--muted);
        line-height: 1.6;
      }
      .contact {
        margin: 1.25rem 0 0;
        padding: 0.95rem 1rem;
        background: var(--paper);
        border-left: 4px solid var(--ink);
        font-weight: 600;
      }
      .actions {
        display: flex;
        gap: 0.8rem;
        flex-wrap: wrap;
        margin-top: 1.5rem;
      }
      .btn {
        text-decoration: none;
        border-radius: 999px;
        padding: 0.8rem 1.15rem;
        border: 1px solid var(--ink);
        color: var(--ink);
      }
      .btn-primary {
        background: var(--ink);
        color: var(--white);
      }
      .meta {
        margin-top: 1.25rem;
        color: var(--muted);
        font-size: 0.92rem;
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <p class="eyebrow">Backend 404</p>
      <h1>Page not found</h1>
      <p class="lead">The backend route you requested does not exist or is no longer available.</p>
      <p class="contact">please contact Joachim</p>
      <div class="actions">
        <a class="btn btn-primary" href="${escapeHtml(backHref)}">${escapeHtml(backLabel)}</a>
        <a class="btn" href="mailto:info@asiatravelplan.com">Email us</a>
      </div>
      <p class="meta">Requested path: <code>${escapeHtml(pathname || "/")}</code></p>
    </main>
  </body>
</html>`
  );
}

function getMimeTypeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".avif") return "image/avif";
  return "application/octet-stream";
}

async function sendFileWithCache(req, res, filePath, cacheControl) {
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
      ETag: etag
    });
    res.end();
    return;
  }

  res.writeHead(200, {
    "Content-Type": getMimeTypeFromExt(filePath),
    "Cache-Control": cacheControl,
    ETag: etag,
    "Content-Length": String(fileStats.size)
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

async function readBodyJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  return JSON.parse(text);
}

async function readStore() {
  const raw = await readFile(DATA_PATH, "utf8");
  const parsed = JSON.parse(raw);
  parsed.customers ||= [];
  parsed.leads ||= [];
  parsed.activities ||= [];
  parsed.invoices ||= [];
  return parsed;
}

async function persistStore(store) {
  writeQueue = writeQueue.then(async () => {
    const next = `${JSON.stringify(store, null, 2)}\n`;
    await writeFile(DATA_PATH, next, "utf8");
  });
  await writeQueue;
}

async function readTours() {
  const items = [];
  const entries = await readdir(TOURS_DIR, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const tourPath = path.join(TOURS_DIR, entry.name, "tour.json");
    try {
      const raw = await readFile(tourPath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && normalizeText(parsed.id)) {
        items.push(parsed);
      }
    } catch {
      // Ignore unreadable tour folders.
    }
  }

  return items;
}

function tourFolderPath(tourId) {
  return path.join(TOURS_DIR, tourId);
}

function tourJsonPath(tourId) {
  return path.join(tourFolderPath(tourId), "tour.json");
}

async function persistTour(tour) {
  writeQueue = writeQueue.then(async () => {
    const id = normalizeText(tour?.id);
    if (!id) throw new Error("Tour id is required");
    await mkdir(tourFolderPath(id), { recursive: true });
    await writeFile(tourJsonPath(id), `${JSON.stringify(tour, null, 2)}\n`, "utf8");
  });
  await writeQueue;
}

async function loadStaff() {
  const raw = await readFile(STAFF_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

function normalizeText(value) {
  return String(value || "").trim();
}

function safeInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeFloat(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function computeSlaDueAt(stage, from = new Date()) {
  const hours = SLA_HOURS[stage] ?? 0;
  if (!hours) return null;
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function safeCurrency(value) {
  const normalized = normalizeText(value).toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "USD";
}

function safeAmountCents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded > 0 ? rounded : null;
}

function formatMoney(amountCents, currency) {
  const amount = Number(amountCents || 0) / 100;
  const code = safeCurrency(currency);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

function normalizeInvoiceItems(value) {
  const input = Array.isArray(value) ? value : [];
  return input
    .map((item) => {
      const description = normalizeText(item?.description);
      const quantity = Math.max(1, safeInt(item?.quantity) || 1);
      const unitAmountCents = safeAmountCents(item?.unit_amount_cents);
      if (!description || !unitAmountCents) return null;
      return {
        id: normalizeText(item?.id) || `inv_item_${randomUUID()}`,
        description,
        quantity,
        unit_amount_cents: unitAmountCents,
        total_amount_cents: unitAmountCents * quantity
      };
    })
    .filter(Boolean);
}

function computeInvoiceTotal(items) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + (safeAmountCents(item?.total_amount_cents) || 0), 0);
}

function safeVatPercentage(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function nextInvoiceNumber(store) {
  const max = (store.invoices || []).reduce((acc, invoice) => {
    const match = String(invoice.invoice_number || "").match(/^ATP-(\d+)$/);
    if (!match) return acc;
    const n = Number(match[1]);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `ATP-${String(max + 1).padStart(6, "0")}`;
}

function invoicePdfPath(invoiceId, version) {
  return path.join(INVOICES_DIR, `${invoiceId}-v${version}.pdf`);
}

let cachedLogoImagePromise = null;

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePngRgba(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) {
    throw new Error("Unsupported PNG signature");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.subarray(offset, offset + 4).toString("ascii");
    offset += 4;
    const data = buffer.subarray(offset, offset + length);
    offset += length;
    offset += 4;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error("Only 8-bit RGBA PNG logos are supported");
  }

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const rgba = Buffer.alloc(width * height * bytesPerPixel);
  let inOffset = 0;
  let outOffset = 0;
  let previousRow = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inOffset];
    inOffset += 1;
    const row = Buffer.from(inflated.subarray(inOffset, inOffset + stride));
    inOffset += stride;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previousRow[x] || 0;
      const upLeft = x >= bytesPerPixel ? previousRow[x - bytesPerPixel] || 0 : 0;

      if (filter === 1) row[x] = (row[x] + left) & 0xff;
      else if (filter === 2) row[x] = (row[x] + up) & 0xff;
      else if (filter === 3) row[x] = (row[x] + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) row[x] = (row[x] + paethPredictor(left, up, upLeft)) & 0xff;
    }

    row.copy(rgba, outOffset);
    outOffset += stride;
    previousRow = row;
  }

  return { width, height, rgba };
}

async function getLogoPdfImageData() {
  if (!cachedLogoImagePromise) {
    cachedLogoImagePromise = readFile(LOGO_PNG_PATH).then((buffer) => {
      const { width, height, rgba } = decodePngRgba(buffer);
      const rgb = Buffer.alloc(width * height * 3);
      const alpha = Buffer.alloc(width * height);
      for (let src = 0, rgbOffset = 0, alphaOffset = 0; src < rgba.length; src += 4) {
        rgb[rgbOffset] = rgba[src];
        rgb[rgbOffset + 1] = rgba[src + 1];
        rgb[rgbOffset + 2] = rgba[src + 2];
        alpha[alphaOffset] = rgba[src + 3];
        rgbOffset += 3;
        alphaOffset += 1;
      }
      return {
        width,
        height,
        rgb: deflateSync(rgb),
        alpha: deflateSync(alpha)
      };
    });
  }

  return cachedLogoImagePromise;
}

function wrapPdfText(value, maxCharsPerLine, maxLines) {
  const words = String(value || "-").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ["-"];
  const lines = [];
  let current = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (next.length <= maxCharsPerLine) {
      current = next;
      continue;
    }
    lines.push(current);
    current = words[i];
    if (lines.length >= maxLines - 1) break;
  }

  if (lines.length < maxLines) lines.push(current);
  if (lines.length > maxLines) return lines.slice(0, maxLines);
  if (lines.length === maxLines && words.length > 1) {
    const used = lines.join(" ").split(/\s+/).length;
    if (used < words.length) {
      const last = lines[maxLines - 1];
      lines[maxLines - 1] = `${last.slice(0, Math.max(0, maxCharsPerLine - 1)).trim()}...`;
    }
  }
  return lines;
}

function buildPdfBuffer(objects) {
  const chunks = [Buffer.from("%PDF-1.4\n", "utf8")];
  const offsets = [0];
  let offset = chunks[0].length;

  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(offset);
    const header = Buffer.from(`${i + 1} 0 obj\n`, "utf8");
    const footer = Buffer.from("\nendobj\n", "utf8");
    const body = Buffer.isBuffer(objects[i]) ? objects[i] : Buffer.from(objects[i], "utf8");
    chunks.push(header, body, footer);
    offset += header.length + body.length + footer.length;
  }

  const xrefStart = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "utf8"));
  return Buffer.concat(chunks);
}

function escapePdfText(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function abbreviateLeadId(value) {
  const text = normalizeText(value);
  if (!text) return "-";
  if (text.length <= 13) return text;
  return `${text.slice(0, 13)}...`;
}

function buildInvoicePdfBuffer(invoice, customer, lead, logoImage) {
  const currency = safeCurrency(invoice.currency);
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const subtotalCents = safeAmountCents(invoice.subtotal_amount_cents) ?? computeInvoiceTotal(items);
  const vatPercentage = safeVatPercentage(invoice.vat_percentage);
  const vatAmountCents = safeAmountCents(invoice.vat_amount_cents) ?? Math.round(subtotalCents * (vatPercentage / 100));
  const totalCents = safeAmountCents(invoice.total_amount_cents) ?? subtotalCents + vatAmountCents;
  const totalMoney = formatMoney(totalCents, currency);
  const dueMoney = formatMoney(invoice.due_amount_cents || invoice.total_amount_cents, currency);

  const line = (x1, y1, x2, y2) => `${x1} ${y1} m ${x2} ${y2} l S`;
  const rectFill = (x, y, w, h) => `${x} ${y} ${w} ${h} re f`;
  const rectStroke = (x, y, w, h) => `${x} ${y} ${w} ${h} re S`;
  const textAt = (x, y, size, value) => `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(value)}) Tj ET`;
  const imageAt = (x, y, w, h) => `q ${w} 0 0 ${h} ${x} ${y} cm /ImLogo Do Q`;

  const ops = [];

  // Header.
  ops.push("1 1 1 rg");
  ops.push(rectFill(0, 724, 595, 118));
  ops.push("0.12 0.18 0.22 rg");
  ops.push(imageAt(40, 742, 58, 58));
  ops.push(textAt(112, 786, 18, COMPANY_PROFILE.name));
  ops.push("0.35 0.42 0.47 rg");
  ops.push(textAt(112, 770, 9, "Southeast Asia Travel"));
  ops.push("0.12 0.18 0.22 rg");
  ops.push(textAt(472, 786, 12, "INVOICE"));
  ops.push("0.35 0.42 0.47 rg");
  ops.push(textAt(414, 769, 9, `Invoice Number: ${invoice.invoice_number || "-"}`));
  ops.push(textAt(434, 754, 9, `Issue Date: ${invoice.issue_date || "-"}`));
  ops.push(textAt(435, 739, 9, `Due Date: ${invoice.due_date || "-"}`));
  ops.push("0.88 0.90 0.92 rg");
  ops.push(line(40, 730, 555, 730));

  // Contact / bill-to cards.
  ops.push("0.97 0.98 0.99 rg");
  ops.push(rectFill(40, 640, 250, 72));
  ops.push(rectFill(305, 640, 250, 72));
  ops.push("0.82 0.85 0.88 RG");
  ops.push("1 w");
  ops.push(rectStroke(40, 640, 250, 72));
  ops.push(rectStroke(305, 640, 250, 72));
  ops.push("0.35 0.42 0.47 rg");
  ops.push(textAt(52, 691, 10, "From"));
  ops.push(textAt(317, 691, 10, "Bill To"));
  ops.push("0.12 0.18 0.22 rg");
  ops.push(textAt(52, 674, 11, COMPANY_PROFILE.name));
  ops.push(textAt(52, 658, 9, COMPANY_PROFILE.address));
  ops.push(textAt(52, 644, 9, `${COMPANY_PROFILE.email} | ${COMPANY_PROFILE.whatsapp}`));
  ops.push(textAt(317, 674, 11, normalizeText(customer?.name) || "-"));
  ops.push(textAt(317, 658, 9, normalizeEmail(customer?.email) || "-"));

  // Items table header.
  const tableTop = 596;
  ops.push("0.82 0.85 0.88 RG");
  ops.push(rectStroke(40, tableTop, 515, 26));
  ops.push("0.93 0.95 0.96 rg");
  ops.push(rectFill(40, tableTop, 515, 26));
  ops.push("0.12 0.18 0.22 rg");
  ops.push(textAt(48, tableTop + 10, 9, "Description"));
  ops.push(textAt(352, tableTop + 10, 9, "Qty"));
  ops.push(textAt(410, tableTop + 10, 9, "Unit"));
  ops.push(textAt(485, tableTop + 10, 9, "Total"));

  // Table rows.
  let rowY = tableTop - 24;
  const rowHeight = 24;
  const maxRows = 16;
  for (let i = 0; i < Math.min(items.length, maxRows); i += 1) {
    const item = items[i];
    ops.push("0.86 0.88 0.90 RG");
    ops.push(rectStroke(40, rowY, 515, rowHeight));
    ops.push("0.12 0.18 0.22 rg");
    const descLines = wrapPdfText(normalizeText(item.description) || "-", 42, 2);
    ops.push(textAt(48, rowY + 11, 9, descLines[0] || "-"));
    if (descLines[1]) ops.push(textAt(48, rowY + 2, 9, descLines[1]));
    ops.push(textAt(356, rowY + 7, 9, String(item.quantity || 1)));
    ops.push(textAt(408, rowY + 7, 9, formatMoney(item.unit_amount_cents, currency)));
    ops.push(textAt(476, rowY + 7, 9, formatMoney(item.total_amount_cents, currency)));
    rowY -= rowHeight;
  }

  // Notes and totals blocks.
  const sectionTop = Math.max(160, rowY - 18);
  const notesY = sectionTop - 74;
  const totalsY = sectionTop - 96;
  const notesLines = wrapPdfText(normalizeText(invoice.notes) || "-", 44, 3);

  ops.push("1 1 1 rg");
  ops.push(rectFill(40, notesY, 285, 74));
  ops.push("0.82 0.85 0.88 RG");
  ops.push(rectStroke(40, notesY, 285, 74));
  ops.push("0.35 0.42 0.47 rg");
  ops.push(textAt(52, notesY + 54, 10, "Notes"));
  ops.push("0.12 0.18 0.22 rg");
  notesLines.forEach((lineText, index) => {
    ops.push(textAt(52, notesY + 36 - index * 14, 9, lineText));
  });

  ops.push("0.97 0.98 0.99 rg");
  ops.push(rectFill(345, totalsY, 210, 96));
  ops.push("0.82 0.85 0.88 RG");
  ops.push(rectStroke(345, totalsY, 210, 96));
  ops.push("0.12 0.18 0.22 rg");
  ops.push(textAt(357, totalsY + 72, 10, `Subtotal: ${formatMoney(subtotalCents, currency)}`));
  ops.push(textAt(357, totalsY + 56, 10, `VAT (${vatPercentage.toFixed(2)}%): ${formatMoney(vatAmountCents, currency)}`));
  ops.push(textAt(357, totalsY + 40, 11, `Total: ${totalMoney}`));
  ops.push(textAt(357, totalsY + 24, 10, `Due now: ${dueMoney}`));
  ops.push("0.35 0.42 0.47 rg");
  ops.push(textAt(357, totalsY + 10, 9, `Currency: ${currency}`));

  ops.push("0.62 0.67 0.72 RG");
  ops.push(textAt(40, 42, 8, `Generated ${new Date().toISOString()} | ${COMPANY_PROFILE.website}`));
  ops.push(line(40, 52, 555, 52));

  const content = Buffer.from(ops.join("\n"), "utf8");
  const rgbStream = Buffer.concat([
    Buffer.from(
      `<< /Type /XObject /Subtype /Image /Width ${logoImage.width} /Height ${logoImage.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask 6 0 R /Length ${logoImage.rgb.length} >>\nstream\n`,
      "utf8"
    ),
    logoImage.rgb,
    Buffer.from("\nendstream", "utf8")
  ]);
  const alphaStream = Buffer.concat([
    Buffer.from(
      `<< /Type /XObject /Subtype /Image /Width ${logoImage.width} /Height ${logoImage.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${logoImage.alpha.length} >>\nstream\n`,
      "utf8"
    ),
    logoImage.alpha,
    Buffer.from("\nendstream", "utf8")
  ]);
  const contentStream = Buffer.from(`<< /Length ${content.length} >>\nstream\n${content.toString("utf8")}\nendstream`, "utf8");

  return buildPdfBuffer([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> /XObject << /ImLogo 5 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    rgbStream,
    alphaStream,
    contentStream
  ]);
}

async function writeInvoicePdf(invoice, customer, lead) {
  await mkdir(INVOICES_DIR, { recursive: true });
  const logoImage = await getLogoPdfImageData();
  const pdf = buildInvoicePdfBuffer(invoice, customer, lead, logoImage);
  await writeFile(invoicePdfPath(invoice.id, invoice.version), pdf);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }
  const text = normalizeText(value);
  if (!text) return [];
  return text
    .split(",")
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function normalizeHighlights(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }
  const text = normalizeText(value);
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

function tourDestinationCountries(tour) {
  const fromArray = Array.isArray(tour?.destinationCountries) ? tour.destinationCountries : [];
  return Array.from(new Set(fromArray.map((value) => normalizeText(value)).filter(Boolean)));
}

function toTourImagePublicUrl(imageValue) {
  const text = normalizeText(imageValue);
  if (!text) return "";
  if (text.startsWith("http://") || text.startsWith("https://")) return text;
  if (text.startsWith("/public/v1/tour-images/")) return text;
  if (text.startsWith("/")) return text;
  return `/public/v1/tour-images/${text}`;
}

function normalizeTourForRead(tour) {
  const destinationCountries = tourDestinationCountries(tour);
  const image = toTourImagePublicUrl(tour.image);
  return {
    ...tour,
    destinationCountries,
    image
  };
}

function collectTourOptions(tours) {
  const destinations = Array.from(
    new Set(tours.flatMap((tour) => tourDestinationCountries(tour)).map((value) => normalizeText(value)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const styles = Array.from(
    new Set(
      tours
        .flatMap((tour) => (Array.isArray(tour.styles) ? tour.styles : []))
        .map((style) => normalizeText(style))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  return { destinations, styles };
}

function resolveTourImageDiskPath(relativePath) {
  const decoded = decodeURIComponent(normalizeText(relativePath));
  if (!decoded || decoded.includes("\0")) return "";
  const normalized = path.posix.normalize(decoded.replaceAll("\\", "/")).replace(/^\/+/, "");
  if (!normalized || normalized.startsWith("..") || normalized.includes("/../")) return "";
  const absolute = path.resolve(TOURS_DIR, normalized);
  if (!absolute.startsWith(TOURS_DIR)) return "";
  return absolute;
}

function levenshtein(a, b) {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  const prev = new Array(t.length + 1);
  const curr = new Array(t.length + 1);

  for (let j = 0; j <= t.length; j += 1) prev[j] = j;

  for (let i = 1; i <= s.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= t.length; j += 1) prev[j] = curr[j];
  }

  return curr[t.length];
}

function chooseOwner(staffList, leads, destination, language) {
  const activeStaff = staffList.filter((s) => s.active);
  const normalizedDestination = normalizeText(destination);
  const normalizedLanguage = normalizeText(language);

  let candidates = activeStaff.filter((staff) => {
    const destinationMatch = staff.destinations?.includes(normalizedDestination);
    const languageMatch = !normalizedLanguage || staff.languages?.includes(normalizedLanguage);
    return destinationMatch && languageMatch;
  });

  if (!candidates.length) {
    candidates = activeStaff.filter((staff) => {
      const destinationMatch = staff.destinations?.includes(normalizedDestination);
      return destinationMatch;
    });
  }

  if (!candidates.length) candidates = activeStaff;
  if (!candidates.length) return null;

  const openStages = new Set([STAGES.NEW, STAGES.QUALIFIED, STAGES.PROPOSAL_SENT, STAGES.NEGOTIATION, STAGES.WON]);

  const byLoad = candidates
    .map((staff) => {
      const load = leads.filter((lead) => lead.owner_id === staff.id && openStages.has(lead.stage)).length;
      return { staff, load };
    })
    .sort((a, b) => a.load - b.load || a.staff.name.localeCompare(b.staff.name));

  return byLoad[0].staff;
}

function findMatchingCustomer(customers, candidate) {
  const email = normalizeEmail(candidate.email);
  const phone = normalizePhone(candidate.phone);
  const name = normalizeText(candidate.name);

  if (email) {
    const byEmail = customers.find((c) => normalizeEmail(c.email) === email);
    if (byEmail) return byEmail;
  }

  if (phone) {
    const byPhone = customers.find((c) => normalizePhone(c.phone) === phone);
    if (byPhone) return byPhone;
  }

  if (name.length >= 4) {
    const byName = customers.find((c) => {
      const cName = normalizeText(c.name);
      if (!cName) return false;
      const distance = levenshtein(name, cName);
      return distance <= 2;
    });
    if (byName) return byName;
  }

  return null;
}

function validateLeadInput(payload) {
  const required = ["name", "email", "destination", "style", "travelMonth", "travelers", "duration"];
  const missing = required.filter((key) => !normalizeText(payload[key]));
  if (missing.length) {
    return { ok: false, error: `Missing required fields: ${missing.join(", ")}` };
  }

  const email = normalizeEmail(payload.email);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) return { ok: false, error: "Invalid email" };

  const travelers = safeInt(payload.travelers);
  if (!travelers || travelers < 1 || travelers > 30) {
    return { ok: false, error: "Travelers must be between 1 and 30" };
  }

  return { ok: true };
}

function addActivity(store, leadId, type, actor, detail) {
  const activity = {
    id: `act_${randomUUID()}`,
    lead_id: leadId,
    type,
    actor: actor || "system",
    detail: detail || "",
    created_at: nowIso()
  };
  store.activities.push(activity);
  return activity;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeStageFilter(value) {
  const stage = normalizeText(value).toUpperCase();
  return STAGE_ORDER.includes(stage) ? stage : "";
}

function getLeadCustomerLookup(store) {
  return new Map(store.customers.map((customer) => [customer.id, customer]));
}

function filterAndSortLeads(store, query) {
  const stage = normalizeStageFilter(query.get("stage"));
  const ownerId = normalizeText(query.get("owner_id"));
  const search = normalizeText(query.get("search")).toLowerCase();
  const sort = normalizeText(query.get("sort")) || "created_at_desc";
  const customersById = getLeadCustomerLookup(store);

  const filtered = store.leads.filter((lead) => {
    if (stage && lead.stage !== stage) return false;
    if (ownerId && lead.owner_id !== ownerId) return false;
    if (!search) return true;

    const customer = customersById.get(lead.customer_id);
    const haystack = [
      lead.id,
      lead.destination,
      lead.style,
      lead.owner_name,
      lead.notes,
      customer?.name,
      customer?.email
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "created_at_asc":
        return a.created_at.localeCompare(b.created_at);
      case "updated_at_desc":
        return b.updated_at.localeCompare(a.updated_at);
      case "sla_due_at_asc":
        return String(a.sla_due_at || "9999-12-31T23:59:59.999Z").localeCompare(
          String(b.sla_due_at || "9999-12-31T23:59:59.999Z")
        );
      case "sla_due_at_desc":
        return String(b.sla_due_at || "").localeCompare(String(a.sla_due_at || ""));
      case "created_at_desc":
      default:
        return b.created_at.localeCompare(a.created_at);
    }
  });

  return {
    items: sorted,
    filters: { stage: stage || null, owner_id: ownerId || null, search: search || null },
    sort
  };
}

function paginate(items, query) {
  const page = clamp(safeInt(query.get("page")) || 1, 1, 100000);
  const pageSize = clamp(safeInt(query.get("page_size")) || 25, 1, 100);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const offset = (page - 1) * pageSize;

  return {
    items: items.slice(offset, offset + pageSize),
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages
  };
}

async function handleHealth(_req, res) {
  sendJson(res, 200, {
    ok: true,
    service: "asiatravelplan-backend",
    stage_values: STAGE_ORDER,
    timestamp: nowIso()
  });
}

async function handleCreateLead(req, res) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const check = validateLeadInput(payload);
  if (!check.ok) {
    sendJson(res, 422, { error: check.error });
    return;
  }

  const store = await readStore();
  const staff = await loadStaff();
  const idempotencyKey = normalizeText(req.headers["idempotency-key"]);

  if (idempotencyKey) {
    const existingByKey = store.leads.find((lead) => lead.idempotency_key === idempotencyKey);
    if (existingByKey) {
      sendJson(res, 200, {
        lead_id: existingByKey.id,
        customer_id: existingByKey.customer_id,
        status: "accepted",
        deduplicated: true,
        message: "Lead already captured with this idempotency key"
      });
      return;
    }
  }

  const customerMatch = findMatchingCustomer(store.customers, payload);
  let customer;

  if (customerMatch) {
    customer = {
      ...customerMatch,
      name: normalizeText(payload.name) || customerMatch.name,
      email: normalizeEmail(payload.email) || customerMatch.email,
      phone: normalizePhone(payload.phone) || customerMatch.phone,
      language: normalizeText(payload.language) || customerMatch.language,
      updated_at: nowIso()
    };
    const idx = store.customers.findIndex((c) => c.id === customer.id);
    store.customers[idx] = customer;
  } else {
    customer = {
      id: `cust_${randomUUID()}`,
      name: normalizeText(payload.name),
      email: normalizeEmail(payload.email),
      phone: normalizePhone(payload.phone),
      language: normalizeText(payload.language) || "English",
      created_at: nowIso(),
      updated_at: nowIso(),
      tags: []
    };
    store.customers.push(customer);
  }

  const owner = chooseOwner(staff, store.leads, payload.destination, payload.language);
  const lead = {
    id: `lead_${randomUUID()}`,
    customer_id: customer.id,
    stage: STAGES.NEW,
    owner_id: owner?.id || null,
    owner_name: owner?.name || null,
    sla_due_at: computeSlaDueAt(STAGES.NEW),
    destination: normalizeText(payload.destination),
    style: normalizeText(payload.style),
    travel_month: normalizeText(payload.travelMonth),
    travelers: safeInt(payload.travelers),
    duration: normalizeText(payload.duration),
    budget: normalizeText(payload.budget),
    notes: normalizeText(payload.notes),
    source: {
      page_url: normalizeText(payload.pageUrl),
      utm_source: normalizeText(payload.utm_source),
      utm_medium: normalizeText(payload.utm_medium),
      utm_campaign: normalizeText(payload.utm_campaign),
      referrer: normalizeText(payload.referrer)
    },
    idempotency_key: idempotencyKey || null,
    created_at: nowIso(),
    updated_at: nowIso()
  };

  store.leads.push(lead);
  addActivity(store, lead.id, "LEAD_CREATED", "public_api", "Lead created from website form");
  if (lead.owner_id) {
    addActivity(store, lead.id, "OWNER_ASSIGNED", "system", `Assigned to ${lead.owner_name}`);
  }

  await persistStore(store);

  sendJson(res, 201, {
    lead_id: lead.id,
    customer_id: customer.id,
    status: "accepted",
    deduplicated: Boolean(customerMatch),
    owner: lead.owner_name,
    sla_due_at: lead.sla_due_at,
    next_step_message: "Thanks, we will contact you with route options within 48-72h."
  });
}

async function handleListLeads(req, res) {
  const store = await readStore();
  const requestUrl = new URL(req.url, "http://localhost");
  const { items: filtered, filters, sort } = filterAndSortLeads(store, requestUrl.searchParams);
  const paged = paginate(filtered, requestUrl.searchParams);
  sendJson(res, 200, {
    items: paged.items,
    total: paged.total,
    page: paged.page,
    page_size: paged.page_size,
    total_pages: paged.total_pages,
    filters,
    sort
  });
}

async function handleGetLead(_req, res, [leadId]) {
  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }

  const customer = store.customers.find((item) => item.id === lead.customer_id) || null;
  sendJson(res, 200, { lead, customer });
}

async function handlePatchLeadStage(req, res, [leadId]) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const nextStage = normalizeText(payload.stage).toUpperCase();
  if (!STAGE_ORDER.includes(nextStage)) {
    sendJson(res, 422, { error: "Invalid stage" });
    return;
  }

  const actor = normalizeText(payload.actor) || "staff";
  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }

  const allowed = ALLOWED_STAGE_TRANSITIONS[lead.stage] || [];
  if (!allowed.includes(nextStage)) {
    sendJson(res, 409, { error: `Transition ${lead.stage} -> ${nextStage} is not allowed` });
    return;
  }

  lead.stage = nextStage;
  lead.sla_due_at = computeSlaDueAt(nextStage);
  lead.updated_at = nowIso();

  addActivity(store, lead.id, "STAGE_CHANGED", actor, `Stage updated to ${nextStage}`);
  await persistStore(store);

  sendJson(res, 200, { lead });
}

async function handlePatchLeadOwner(req, res, [leadId]) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const ownerIdRaw = normalizeText(payload.owner_id);
  const actor = normalizeText(payload.actor) || "staff";
  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }

  if (!ownerIdRaw) {
    lead.owner_id = null;
    lead.owner_name = null;
    lead.updated_at = nowIso();
    addActivity(store, lead.id, "OWNER_CHANGED", actor, "Owner unassigned");
    await persistStore(store);
    sendJson(res, 200, { lead });
    return;
  }

  const staff = await loadStaff();
  const owner = staff.find((member) => member.id === ownerIdRaw && member.active);
  if (!owner) {
    sendJson(res, 422, { error: "Owner not found or inactive" });
    return;
  }

  lead.owner_id = owner.id;
  lead.owner_name = owner.name;
  lead.updated_at = nowIso();
  addActivity(store, lead.id, "OWNER_CHANGED", actor, `Owner set to ${owner.name}`);
  await persistStore(store);

  sendJson(res, 200, { lead });
}

async function handleListActivities(_req, res, [leadId]) {
  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }

  const items = store.activities
    .filter((activity) => activity.lead_id === leadId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  sendJson(res, 200, { items, total: items.length });
}

async function handleCreateActivity(req, res, [leadId]) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const type = normalizeText(payload.type).toUpperCase();
  const actor = normalizeText(payload.actor) || "staff";
  const detail = normalizeText(payload.detail);

  if (!type) {
    sendJson(res, 422, { error: "type is required" });
    return;
  }

  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }

  const activity = addActivity(store, lead.id, type, actor, detail);
  lead.updated_at = nowIso();
  await persistStore(store);

  sendJson(res, 201, { activity });
}

function buildInvoiceReadModel(invoice) {
  return {
    ...invoice,
    sent_to_customer: Boolean(invoice.sent_to_customer),
    sent_to_customer_at: invoice.sent_to_customer_at || null,
    pdf_url: `/api/v1/invoices/${encodeURIComponent(invoice.id)}/pdf`
  };
}

async function handleListLeadInvoices(_req, res, [leadId]) {
  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }

  const items = [...store.invoices]
    .filter((invoice) => invoice.lead_id === leadId)
    .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")))
    .map(buildInvoiceReadModel);
  sendJson(res, 200, { items, total: items.length });
}

async function handleCreateLeadInvoice(req, res, [leadId]) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }
  const customer = store.customers.find((item) => item.id === lead.customer_id);
  if (!customer) {
    sendJson(res, 422, { error: "Lead customer not found" });
    return;
  }

  const items = normalizeInvoiceItems(payload.items);
  if (!items.length) {
    sendJson(res, 422, { error: "At least one invoice item is required" });
    return;
  }

  const now = nowIso();
  const totalAmountCents = computeInvoiceTotal(items);
  const dueAmountCents = safeAmountCents(payload.due_amount_cents) ?? totalAmountCents;
  const invoice = {
    id: `inv_${randomUUID()}`,
    lead_id: leadId,
    customer_id: customer.id,
    invoice_number: normalizeText(payload.invoice_number) || nextInvoiceNumber(store),
    version: 1,
    status: "DRAFT",
    currency: safeCurrency(payload.currency),
    issue_date: normalizeText(payload.issue_date) || now.slice(0, 10),
    due_date: normalizeText(payload.due_date) || null,
    title: normalizeText(payload.title) || `Invoice for ${normalizeText(customer.name) || "customer"}`,
    notes: normalizeText(payload.notes),
    sent_to_customer: false,
    sent_to_customer_at: null,
    items,
    total_amount_cents: totalAmountCents,
    due_amount_cents: dueAmountCents,
    created_at: now,
    updated_at: now
  };

  await writeInvoicePdf(invoice, customer, lead);
  store.invoices.push(invoice);
  await persistStore(store);
  sendJson(res, 201, { invoice: buildInvoiceReadModel(invoice) });
}

async function handlePatchLeadInvoice(req, res, [leadId, invoiceId]) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const store = await readStore();
  const lead = store.leads.find((item) => item.id === leadId);
  if (!lead) {
    sendJson(res, 404, { error: "Lead not found" });
    return;
  }
  const customer = store.customers.find((item) => item.id === lead.customer_id);
  if (!customer) {
    sendJson(res, 422, { error: "Lead customer not found" });
    return;
  }
  const invoice = store.invoices.find((item) => item.id === invoiceId && item.lead_id === leadId);
  if (!invoice) {
    sendJson(res, 404, { error: "Invoice not found" });
    return;
  }

  const items = payload.items ? normalizeInvoiceItems(payload.items) : invoice.items;
  if (!items.length) {
    sendJson(res, 422, { error: "At least one invoice item is required" });
    return;
  }

  const isContentUpdate =
    payload.invoice_number !== undefined ||
    payload.currency !== undefined ||
    payload.issue_date !== undefined ||
    payload.due_date !== undefined ||
    payload.title !== undefined ||
    payload.notes !== undefined ||
    payload.items !== undefined ||
    payload.due_amount_cents !== undefined;

  if (payload.sent_to_customer !== undefined) {
    const sent = Boolean(payload.sent_to_customer);
    invoice.sent_to_customer = sent;
    invoice.sent_to_customer_at = sent ? invoice.sent_to_customer_at || nowIso() : null;
    if (invoice.status !== "PAID") {
      invoice.status = sent ? "INVOICE_SENT" : "DRAFT";
    }
  }

  if (isContentUpdate) {
    const totalAmountCents = computeInvoiceTotal(items);
    const dueAmountCents = safeAmountCents(payload.due_amount_cents) ?? totalAmountCents;
    if (payload.invoice_number !== undefined) {
      invoice.invoice_number = normalizeText(payload.invoice_number) || invoice.invoice_number;
    }
    if (payload.currency !== undefined) {
      invoice.currency = safeCurrency(payload.currency || invoice.currency);
    }
    if (payload.issue_date !== undefined) {
      invoice.issue_date = normalizeText(payload.issue_date) || invoice.issue_date;
    }
    if (payload.due_date !== undefined) {
      invoice.due_date = normalizeText(payload.due_date) || null;
    }
    if (payload.title !== undefined) {
      invoice.title = normalizeText(payload.title) || invoice.title;
    }
    if (payload.notes !== undefined) {
      invoice.notes = normalizeText(payload.notes);
    }
    invoice.items = items;
    invoice.total_amount_cents = totalAmountCents;
    invoice.due_amount_cents = dueAmountCents;
    invoice.version = Number(invoice.version || 1) + 1;
    await writeInvoicePdf(invoice, customer, lead);
  }
  invoice.updated_at = nowIso();

  await persistStore(store);
  sendJson(res, 200, { invoice: buildInvoiceReadModel(invoice) });
}

async function handleGetInvoicePdf(req, res, [invoiceId]) {
  const store = await readStore();
  const invoice = store.invoices.find((item) => item.id === invoiceId);
  if (!invoice) {
    sendJson(res, 404, { error: "Invoice not found" });
    return;
  }
  const lead = store.leads.find((item) => item.id === invoice.lead_id) || null;
  const customer = store.customers.find((item) => item.id === invoice.customer_id) || null;
  const pdfPath = invoicePdfPath(invoice.id, invoice.version);
  // Always regenerate so PDF styling/content updates are reflected immediately.
  await writeInvoicePdf(invoice, customer, lead);
  res.setHeader("Content-Disposition", `inline; filename=\"${invoice.invoice_number || invoice.id}.pdf\"`);
  await sendFileWithCache(req, res, pdfPath, "private, max-age=0, no-store");
}

async function handleListCustomers(req, res) {
  const store = await readStore();
  const requestUrl = new URL(req.url, "http://localhost");
  const search = normalizeText(requestUrl.searchParams.get("search")).toLowerCase();
  const pageQuery = requestUrl.searchParams;
  const filtered = [...store.customers]
    .filter((customer) => {
      if (!search) return true;
      const haystack = [customer.name, customer.email, customer.phone, customer.language].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) =>
      String(b.created_at || b.updated_at || "").localeCompare(String(a.created_at || a.updated_at || ""))
    );
  const paged = paginate(filtered, pageQuery);
  sendJson(res, 200, {
    items: paged.items,
    total: paged.total,
    page: paged.page,
    page_size: paged.page_size,
    total_pages: paged.total_pages
  });
}

async function handleGetCustomer(_req, res, [customerId]) {
  const store = await readStore();
  const customer = store.customers.find((item) => item.id === customerId);
  if (!customer) {
    sendJson(res, 404, { error: "Customer not found" });
    return;
  }

  const leads = store.leads
    .filter((lead) => lead.customer_id === customer.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  sendJson(res, 200, { customer, leads });
}

async function handleListStaff(req, res) {
  const requestUrl = new URL(req.url, "http://localhost");
  const onlyActive = normalizeText(requestUrl.searchParams.get("active")) !== "false";
  const staff = await loadStaff();
  const items = staff
    .filter((member) => (onlyActive ? member.active : true))
    .map((member) => ({
      id: member.id,
      name: member.name,
      active: Boolean(member.active),
      destinations: Array.isArray(member.destinations) ? member.destinations : [],
      languages: Array.isArray(member.languages) ? member.languages : []
    }))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  sendJson(res, 200, { items, total: items.length });
}

function buildTourPayload(payload, { existing = null, isCreate = false } = {}) {
  const next = existing ? { ...existing } : {};

  if (isCreate || payload.id !== undefined) next.id = normalizeText(payload.id);
  if (isCreate || payload.title !== undefined) next.title = normalizeText(payload.title);
  if (payload.shortDescription !== undefined) next.shortDescription = normalizeText(payload.shortDescription);
  if (isCreate || payload.destinationCountries !== undefined) {
    const destinationCountries = normalizeStringArray(payload.destinationCountries);
    next.destinationCountries = destinationCountries;
  }
  if (isCreate || payload.styles !== undefined) next.styles = normalizeStringArray(payload.styles);
  if (payload.image !== undefined) next.image = toTourImagePublicUrl(payload.image);
  if (payload.seasonality !== undefined) next.seasonality = normalizeText(payload.seasonality);
  if (payload.highlights !== undefined || isCreate) next.highlights = normalizeHighlights(payload.highlights);

  if (payload.priority !== undefined || isCreate) {
    const priority = safeInt(payload.priority);
    next.priority = priority === null ? 50 : priority;
  }
  if (payload.durationDays !== undefined || isCreate) {
    const durationDays = safeInt(payload.durationDays);
    next.durationDays = durationDays === null ? 0 : durationDays;
  }
  if (payload.priceFrom !== undefined || isCreate) {
    const priceFrom = safeInt(payload.priceFrom);
    next.priceFrom = priceFrom === null ? 0 : priceFrom;
  }
  if (payload.rating !== undefined || isCreate) {
    const rating = safeFloat(payload.rating);
    next.rating = rating === null ? 0 : rating;
  }

  return next;
}

function validateTourInput(tour, { isCreate = false } = {}) {
  if (isCreate && !tour.title) return "title is required";
  if (isCreate && !tourDestinationCountries(tour).length) return "destinationCountries is required";
  if (isCreate && (!Array.isArray(tour.styles) || !tour.styles.length)) return "styles is required";
  return "";
}

function filterAndSortTours(tours, query) {
  const search = normalizeText(query.get("search")).toLowerCase();
  const destination = normalizeText(query.get("destination"));
  const style = normalizeText(query.get("style"));
  const sort = normalizeText(query.get("sort")) || "updated_at_desc";

  const filtered = tours.filter((tour) => {
    const destinationMatch = !destination || tourDestinationCountries(tour).includes(destination);
    const styleMatch = !style || (Array.isArray(tour.styles) && tour.styles.includes(style));
    if (!destinationMatch || !styleMatch) return false;
    if (!search) return true;
    const haystack = [
      tour.id,
      tour.title,
      tour.shortDescription,
      ...tourDestinationCountries(tour),
      ...(Array.isArray(tour.highlights) ? tour.highlights : []),
      ...(Array.isArray(tour.styles) ? tour.styles : [])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });

  const items = [...filtered].sort((a, b) => {
    if (sort === "title_asc") return String(a.title || "").localeCompare(String(b.title || ""));
    return String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""));
  });

  return {
    items,
    sort,
    filters: {
      destination: destination || null,
      style: style || null,
      search: search || null
    }
  };
}

async function handlePublicListTours(req, res) {
  const tours = await readTours();
  const requestUrl = new URL(req.url, "http://localhost");
  const destination = normalizeText(requestUrl.searchParams.get("destination"));
  const style = normalizeText(requestUrl.searchParams.get("style"));
  const offset = Math.max(0, safeInt(requestUrl.searchParams.get("offset")) || 0);
  const limit = clamp(safeInt(requestUrl.searchParams.get("limit")) || tours.length || 1000, 1, 5000);

  const filtered = tours.filter((tour) => {
    const destinationMatch = !destination || tourDestinationCountries(tour).includes(destination);
    const styleMatch = !style || (Array.isArray(tour.styles) && tour.styles.includes(style));
    return destinationMatch && styleMatch;
  });

  const sorted = [...filtered].sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  const items = sorted.slice(offset, offset + limit).map(normalizeTourForRead);
  const payload = { items, total: filtered.length, offset, limit };
  const payloadText = JSON.stringify(payload);
  const etag = `W/"${createHash("sha1").update(payloadText).digest("hex")}"`;
  const ifNoneMatch = normalizeText(req.headers["if-none-match"]);

  const cacheHeaders = {
    "Cache-Control": "public, max-age=120, stale-while-revalidate=600, must-revalidate",
    ETag: etag
  };

  if (ifNoneMatch === etag) {
    res.writeHead(304, cacheHeaders);
    res.end();
    return;
  }

  sendJson(res, 200, payload, cacheHeaders);
}

async function handleListTours(req, res) {
  const tours = await readTours();
  const requestUrl = new URL(req.url, "http://localhost");
  const { items: filtered, sort, filters } = filterAndSortTours(tours, requestUrl.searchParams);
  const paged = paginate(filtered, requestUrl.searchParams);
  const options = collectTourOptions(tours);
  sendJson(res, 200, {
    items: paged.items.map(normalizeTourForRead),
    total: paged.total,
    page: paged.page,
    page_size: paged.page_size,
    total_pages: paged.total_pages,
    sort,
    filters,
    available_destinations: options.destinations,
    available_styles: options.styles
  });
}

async function handleGetTour(_req, res, [tourId]) {
  const tours = await readTours();
  const tour = tours.find((item) => item.id === tourId);
  if (!tour) {
    sendJson(res, 404, { error: "Tour not found" });
    return;
  }
  const options = collectTourOptions(tours);
  sendJson(res, 200, {
    tour: normalizeTourForRead(tour),
    options: {
      destinations: options.destinations,
      styles: options.styles
    }
  });
}

async function handleCreateTour(req, res) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const now = nowIso();
  const tour = buildTourPayload(payload, { isCreate: true });
  tour.id = `tour_${randomUUID()}`;
  tour.image = toTourImagePublicUrl(tour.image);
  tour.created_at = now;
  tour.updated_at = now;

  const validationError = validateTourInput(tour, { isCreate: true });
  if (validationError) {
    sendJson(res, 422, { error: validationError });
    return;
  }

  await persistTour(tour);
  sendJson(res, 201, { tour: normalizeTourForRead(tour) });
}

async function handlePatchTour(req, res, [tourId]) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const tours = await readTours();
  const index = tours.findIndex((item) => item.id === tourId);
  if (index < 0) {
    sendJson(res, 404, { error: "Tour not found" });
    return;
  }

  const current = tours[index];
  const idChange = normalizeText(payload.id);
  if (idChange && idChange !== tourId) {
    sendJson(res, 422, { error: "Tour id cannot be changed" });
    return;
  }

  const updated = buildTourPayload(payload, { existing: current, isCreate: false });
  updated.updated_at = nowIso();

  const validationError = validateTourInput(updated, { isCreate: false });
  if (validationError) {
    sendJson(res, 422, { error: validationError });
    return;
  }

  tours[index] = updated;
  await persistTour(updated);
  sendJson(res, 200, { tour: normalizeTourForRead(updated) });
}

async function handlePublicTourImage(req, res, [rawRelativePath]) {
  const absolutePath = resolveTourImageDiskPath(rawRelativePath);
  if (!absolutePath) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }
  await sendFileWithCache(req, res, absolutePath, "public, max-age=31536000, immutable");
}

async function processTourImageToWebp(inputPath, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await execFile("magick", [
    inputPath,
    "-auto-orient",
    "-resize",
    "1000x1000>",
    "-strip",
    "-quality",
    "82",
    outputPath
  ]);
}

async function handleUploadTourImage(req, res, [tourId]) {
  let payload;
  try {
    payload = await readBodyJson(req);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON payload" });
    return;
  }

  const filename = normalizeText(payload.filename) || `${tourId}.upload`;
  const base64 = normalizeText(payload.data_base64);
  if (!base64) {
    sendJson(res, 422, { error: "data_base64 is required" });
    return;
  }

  const tours = await readTours();
  const index = tours.findIndex((item) => item.id === tourId);
  if (index < 0) {
    sendJson(res, 404, { error: "Tour not found" });
    return;
  }

  const now = nowIso();
  const sourceBuffer = Buffer.from(base64, "base64");
  if (!sourceBuffer.length) {
    sendJson(res, 422, { error: "Invalid base64 image payload" });
    return;
  }

  const tempInputPath = path.join(TEMP_UPLOAD_DIR, `${tourId}-${randomUUID()}${path.extname(filename) || ".upload"}`);
  const outputName = `${tourId}.webp`;
  const outputRelativePath = `${tourId}/${outputName}`;
  const outputPath = path.join(TOURS_DIR, outputRelativePath);

  try {
    await writeFile(tempInputPath, sourceBuffer);
    await processTourImageToWebp(tempInputPath, outputPath);
  } catch (error) {
    sendJson(res, 500, { error: "Image conversion failed", detail: String(error?.message || error) });
    return;
  } finally {
    await rm(tempInputPath, { force: true });
  }

  const publicPath = `/public/v1/tour-images/${outputRelativePath}`;
  const updated = {
    ...tours[index],
    image: publicPath,
    updated_at: now
  };
  tours[index] = updated;
  await persistTour(updated);

  sendJson(res, 200, { tour: normalizeTourForRead(updated) });
}

async function handleAdminHome(req, res) {
  sendHtml(
    res,
    200,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AsiaTravelPlan Admin</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    a { color: #004f7a; }
  </style>
</head>
<body>
  <h1>AsiaTravelPlan Admin</h1>
  <ul>
    <li><a href="/admin/leads">Lead pipeline view</a></li>
    <li><a href="/admin/customers">Customers UI</a></li>
    <li>Customers API: <a href="/api/v1/customers"><code>/api/v1/customers</code></a></li>
    <li>Tours API: <a href="/api/v1/tours"><code>/api/v1/tours</code></a></li>
  </ul>
</body>
</html>`
  );
}

async function handleAdminCustomersPage(req, res) {
  const store = await readStore();
  const requestUrl = new URL(req.url, "http://localhost");
  const params = requestUrl.searchParams;
  const search = normalizeText(params.get("search")).toLowerCase();
  const pageSize = String(clamp(safeInt(params.get("page_size")) || 25, 1, 100));

  const filtered = [...store.customers]
    .filter((customer) => {
      if (!search) return true;
      const haystack = [customer.id, customer.name, customer.email, customer.phone, customer.language]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const paged = paginate(filtered, params);

  const customerLeadsCount = new Map();
  for (const lead of store.leads) {
    customerLeadsCount.set(lead.customer_id, (customerLeadsCount.get(lead.customer_id) || 0) + 1);
  }

  const detailBaseQuery = new URLSearchParams(params);
  detailBaseQuery.delete("page");
  const detailQuery = detailBaseQuery.toString();

  const rows = paged.items
    .map((customer) => {
      const customerHref = `/admin/customers/${encodeURIComponent(customer.id)}${detailQuery ? `?${detailQuery}` : ""}`;
      return `<tr>
        <td><a href="${escapeHtml(customerHref)}">${escapeHtml(customer.id)}</a></td>
        <td>${escapeHtml(customer.name || "-")}</td>
        <td>${escapeHtml(customer.email || "-")}</td>
        <td>${escapeHtml(customer.phone || "-")}</td>
        <td>${escapeHtml(customer.language || "-")}</td>
        <td>${customerLeadsCount.get(customer.id) || 0}</td>
        <td>${escapeHtml(customer.updated_at || "-")}</td>
      </tr>`;
    })
    .join("\n");

  function pageLink(targetPage) {
    const next = new URLSearchParams(params);
    next.set("page", String(targetPage));
    return `/admin/customers?${next.toString()}`;
  }

  const prevLink = paged.page > 1 ? `<a href="${escapeHtml(pageLink(paged.page - 1))}">Previous</a>` : "";
  const nextLink =
    paged.page < paged.total_pages ? `<a href="${escapeHtml(pageLink(paged.page + 1))}">Next</a>` : "";

  const leadsHref = "/admin/leads";
  const homeHref = "/admin";

  sendHtml(
    res,
    200,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Customers</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    form { display: grid; grid-template-columns: 1fr 180px auto; gap: 0.5rem; align-items: end; margin-bottom: 1rem; }
    input, select, button { padding: 0.45rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
    th { background: #f6f6f6; }
    .pager, .links { display: flex; gap: 1rem; margin-top: 1rem; align-items: center; }
  </style>
</head>
<body>
  <h1>Customers</h1>
  <p>Total customers (all): ${store.customers.length}</p>
  <p>Total customers (filtered): ${paged.total}</p>
  <div class="links">
    <a href="${escapeHtml(homeHref)}">Admin home</a>
    <a href="${escapeHtml(leadsHref)}">Lead pipeline</a>
  </div>
  <form method="get" action="/admin/customers">
    <label>Search
      <input type="text" name="search" value="${escapeHtml(params.get("search") || "")}" placeholder="id, name, email, phone..." />
    </label>
    <label>Page size
      <select name="page_size">
        <option value="10"${pageSize === "10" ? " selected" : ""}>10</option>
        <option value="25"${pageSize === "25" ? " selected" : ""}>25</option>
        <option value="50"${pageSize === "50" ? " selected" : ""}>50</option>
      </select>
    </label>
    <button type="submit">Apply</button>
  </form>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Email</th>
        <th>Phone</th>
        <th>Language</th>
        <th>Leads</th>
        <th>Updated</th>
      </tr>
    </thead>
    <tbody>
      ${rows || "<tr><td colspan='7'>No customers found</td></tr>"}
    </tbody>
  </table>
  <div class="pager">
    <span>Page ${paged.page} / ${paged.total_pages}</span>
    ${prevLink}
    ${nextLink}
  </div>
</body>
</html>`
  );
}

async function handleAdminLeadsPage(req, res) {
  const store = await readStore();
  const requestUrl = new URL(req.url, "http://localhost");
  const filtered = filterAndSortLeads(store, requestUrl.searchParams);
  const paged = paginate(filtered.items, requestUrl.searchParams);
  const params = requestUrl.searchParams;
  const stageValue = normalizeStageFilter(params.get("stage"));
  const searchValue = normalizeText(params.get("search"));
  const pageSizeValue = String(paged.page_size);
  const sortValue = filtered.sort;

  const detailBaseQuery = new URLSearchParams(params);
  detailBaseQuery.delete("page");
  const detailQuery = detailBaseQuery.toString();

  const rows = paged.items
    .map((lead) => {
      const href = `/admin/leads/${encodeURIComponent(lead.id)}${detailQuery ? `?${detailQuery}` : ""}`;
      return `<tr>
        <td><a href="${escapeHtml(href)}">${escapeHtml(lead.id)}</a></td>
        <td>${escapeHtml(lead.stage)}</td>
        <td>${escapeHtml(lead.destination)}</td>
        <td>${escapeHtml(lead.style)}</td>
        <td>${escapeHtml(lead.owner_name || "Unassigned")}</td>
        <td>${escapeHtml(lead.sla_due_at || "-")}</td>
      </tr>`;
    })
    .join("\n");

  const stageOptions = [`<option value="">All stages</option>`]
    .concat(
      STAGE_ORDER.map((stage) => {
        const selected = stage === stageValue ? " selected" : "";
        return `<option value="${stage}"${selected}>${stage}</option>`;
      })
    )
    .join("\n");

  const sortOptions = [
    { value: "created_at_desc", label: "Newest first" },
    { value: "created_at_asc", label: "Oldest first" },
    { value: "updated_at_desc", label: "Recently updated" },
    { value: "sla_due_at_asc", label: "SLA due soonest" },
    { value: "sla_due_at_desc", label: "SLA due latest" }
  ]
    .map((option) => {
      const selected = option.value === sortValue ? " selected" : "";
      return `<option value="${option.value}"${selected}>${option.label}</option>`;
    })
    .join("\n");

  function pageLink(targetPage) {
    const next = new URLSearchParams(params);
    next.set("page", String(targetPage));
    return `/admin/leads?${next.toString()}`;
  }

  const prevLink = paged.page > 1 ? `<a href="${escapeHtml(pageLink(paged.page - 1))}">Previous</a>` : "";
  const nextLink =
    paged.page < paged.total_pages ? `<a href="${escapeHtml(pageLink(paged.page + 1))}">Next</a>` : "";
  const customersHref = "/admin/customers";
  const homeHref = "/admin";

  sendHtml(
    res,
    200,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Lead Pipeline</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    form { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 0.5rem; align-items: end; margin-bottom: 1rem; }
    input, select, button { padding: 0.45rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
    th { background: #f6f6f6; }
    .pager { display: flex; gap: 1rem; margin-top: 1rem; align-items: center; }
  </style>
</head>
<body>
  <h1>Lead Pipeline</h1>
  <p><a href="${escapeHtml(homeHref)}">Admin home</a> | <a href="${escapeHtml(customersHref)}">Customers UI</a></p>
  <p>Total leads (all): ${store.leads.length}</p>
  <p>Total leads (filtered): ${paged.total}</p>
  <form method="get" action="/admin/leads">
    <label>Stage
      <select name="stage">${stageOptions}</select>
    </label>
    <label>Search
      <input type="text" name="search" value="${escapeHtml(searchValue)}" placeholder="name, email, destination..." />
    </label>
    <label>Sort
      <select name="sort">${sortOptions}</select>
    </label>
    <label>Page size
      <select name="page_size">
        <option value="10"${pageSizeValue === "10" ? " selected" : ""}>10</option>
        <option value="25"${pageSizeValue === "25" ? " selected" : ""}>25</option>
        <option value="50"${pageSizeValue === "50" ? " selected" : ""}>50</option>
      </select>
    </label>
    <button type="submit">Apply</button>
  </form>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Stage</th>
        <th>Destination</th>
        <th>Style</th>
        <th>Owner</th>
        <th>SLA Due</th>
      </tr>
    </thead>
    <tbody>
      ${rows || "<tr><td colspan='6'>No leads yet</td></tr>"}
    </tbody>
  </table>
  <div class="pager">
    <span>Page ${paged.page} / ${paged.total_pages}</span>
    ${prevLink}
    ${nextLink}
  </div>
  <p><a href="/admin">Back</a></p>
</body>
</html>`
  );
}

async function handleAdminCustomerDetailPage(req, res, [customerId]) {
  const store = await readStore();
  const requestUrl = new URL(req.url, "http://localhost");
  const backQuery = requestUrl.searchParams.toString();
  const customer = store.customers.find((item) => item.id === customerId);

  if (!customer) {
    sendHtml(
      res,
      404,
      `<h1>Customer not found</h1><p><a href='/admin/customers${backQuery ? `?${escapeHtml(backQuery)}` : ""}'>Back</a></p>`
    );
    return;
  }

  const relatedLeads = store.leads
    .filter((lead) => lead.customer_id === customer.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const leadRows = relatedLeads
    .map((lead) => {
      const href = `/admin/leads/${encodeURIComponent(lead.id)}${backQuery ? `?${backQuery}` : ""}`;
      return `<tr>
        <td><a href="${escapeHtml(href)}">${escapeHtml(lead.id)}</a></td>
        <td>${escapeHtml(lead.stage)}</td>
        <td>${escapeHtml(lead.destination)}</td>
        <td>${escapeHtml(lead.style)}</td>
        <td>${escapeHtml(lead.owner_name || "Unassigned")}</td>
        <td>${escapeHtml(lead.created_at)}</td>
      </tr>`;
    })
    .join("\n");

  sendHtml(
    res,
    200,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(customer.id)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; max-width: 980px; }
    pre { background: #f6f6f6; padding: 1rem; overflow: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
    th { background: #f6f6f6; }
  </style>
</head>
<body>
  <h1>Customer ${escapeHtml(customer.id)}</h1>
  <p><a href="/admin/customers${backQuery ? `?${escapeHtml(backQuery)}` : ""}">Back to customers</a></p>
  <h2>Profile</h2>
  <pre>${escapeHtml(JSON.stringify(customer, null, 2))}</pre>

  <h2>Related Leads (${relatedLeads.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Lead ID</th>
        <th>Stage</th>
        <th>Destination</th>
        <th>Style</th>
        <th>Owner</th>
        <th>Created</th>
      </tr>
    </thead>
    <tbody>
      ${leadRows || "<tr><td colspan='6'>No related leads</td></tr>"}
    </tbody>
  </table>
</body>
</html>`
  );
}

async function handleAdminLeadDetailPage(req, res, [leadId]) {
  const store = await readStore();
  const staff = await loadStaff();
  const requestUrl = new URL(req.url, "http://localhost");
  const backQuery = requestUrl.searchParams.toString();
  const lead = store.leads.find((item) => item.id === leadId);

  if (!lead) {
    sendHtml(
      res,
      404,
      `<h1>Lead not found</h1><p><a href='/admin/leads${backQuery ? `?${escapeHtml(backQuery)}` : ""}'>Back</a></p>`
    );
    return;
  }

  const customer = store.customers.find((item) => item.id === lead.customer_id) || null;
  const activities = store.activities
    .filter((item) => item.lead_id === lead.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const activityRows = activities
    .map((item) => `<li><strong>${escapeHtml(item.created_at)}</strong> [${escapeHtml(item.type)}] ${escapeHtml(item.detail)} (${escapeHtml(item.actor)})</li>`)
    .join("\n");

  const stageOptions = STAGE_ORDER.map((stage) => `<option value="${stage}">${stage}</option>`).join("\n");
  const ownerOptions = [`<option value="">Unassigned</option>`]
    .concat(
      staff
        .filter((member) => member.active)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((member) => `<option value="${escapeHtml(member.id)}">${escapeHtml(member.name)}</option>`)
    )
    .join("\n");

  sendHtml(
    res,
    200,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(lead.id)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; max-width: 900px; }
    pre { background: #f6f6f6; padding: 1rem; overflow: auto; }
    input, textarea, select, button { width: 100%; margin: 0.25rem 0 0.75rem; padding: 0.5rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  </style>
</head>
<body>
  <h1>Lead ${escapeHtml(lead.id)}</h1>
  <p>Stage: <strong>${escapeHtml(lead.stage)}</strong></p>
  <p>Owner: <strong>${escapeHtml(lead.owner_name || "Unassigned")}</strong></p>

  <div class="grid">
    <section>
      <h2>Lead</h2>
      <pre>${escapeHtml(JSON.stringify(lead, null, 2))}</pre>
    </section>
    <section>
      <h2>Customer</h2>
      <pre>${escapeHtml(JSON.stringify(customer, null, 2))}</pre>
    </section>
  </div>

  <section>
    <h2>Activities</h2>
    <ul>${activityRows || "<li>No activities</li>"}</ul>
  </section>

  <section>
    <h2>Quick updates</h2>
    <label>Set Owner</label>
    <select id="ownerSelect">${ownerOptions}</select>
    <button id="ownerBtn" type="button">Update Owner</button>

    <label>Change Stage</label>
    <select id="stageSelect">${stageOptions}</select>
    <button id="stageBtn" type="button">Update Stage</button>

    <label>Add Note</label>
    <textarea id="note" rows="4" placeholder="Call notes, qualification details, customer preferences..."></textarea>
    <button id="noteBtn" type="button">Add Activity</button>
  </section>

  <p><a href="/admin/leads${backQuery ? `?${escapeHtml(backQuery)}` : ""}">Back to pipeline</a></p>

  <script>
    const leadId = ${JSON.stringify(lead.id)};
    const currentStage = ${JSON.stringify(lead.stage)};
    const currentOwnerId = ${JSON.stringify(lead.owner_id || "")};
    document.getElementById("stageSelect").value = currentStage;
    document.getElementById("ownerSelect").value = currentOwnerId;

    async function updateStage() {
      const stage = document.getElementById("stageSelect").value;
      const response = await fetch('/api/v1/leads/' + leadId + '/stage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage, actor: 'admin_ui' })
      });
      const payload = await response.json();
      if (!response.ok) {
        alert(payload.error || 'Failed to update stage');
        return;
      }
      window.location.reload();
    }

    async function updateOwner() {
      const owner_id = document.getElementById("ownerSelect").value;
      const response = await fetch('/api/v1/leads/' + leadId + '/owner', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_id, actor: 'admin_ui' })
      });
      const payload = await response.json();
      if (!response.ok) {
        alert(payload.error || 'Failed to update owner');
        return;
      }
      window.location.reload();
    }

    async function addNote() {
      const detail = document.getElementById("note").value.trim();
      if (!detail) return;
      const response = await fetch('/api/v1/leads/' + leadId + '/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'NOTE', detail, actor: 'admin_ui' })
      });
      const payload = await response.json();
      if (!response.ok) {
        alert(payload.error || 'Failed to add note');
        return;
      }
      window.location.reload();
    }

    document.getElementById("stageBtn").addEventListener("click", updateStage);
    document.getElementById("ownerBtn").addEventListener("click", updateOwner);
    document.getElementById("noteBtn").addEventListener("click", addNote);
  </script>
</body>
</html>`
  );
}
