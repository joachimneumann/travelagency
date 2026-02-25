import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const DATA_PATH = path.join(APP_ROOT, "data", "store.json");
const STAFF_PATH = path.join(APP_ROOT, "config", "staff.json");
const PORT = Number(process.env.PORT || 8787);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || "change-me-local";

const STAGES = {
  NEW: "NEW",
  QUALIFIED: "QUALIFIED",
  PROPOSAL_SENT: "PROPOSAL_SENT",
  NEGOTIATION: "NEGOTIATION",
  WON: "WON",
  LOST: "LOST",
  POST_TRIP: "POST_TRIP"
};

const STAGE_ORDER = [
  STAGES.NEW,
  STAGES.QUALIFIED,
  STAGES.PROPOSAL_SENT,
  STAGES.NEGOTIATION,
  STAGES.WON,
  STAGES.LOST,
  STAGES.POST_TRIP
];

const ALLOWED_STAGE_TRANSITIONS = {
  [STAGES.NEW]: [STAGES.QUALIFIED, STAGES.LOST],
  [STAGES.QUALIFIED]: [STAGES.PROPOSAL_SENT, STAGES.LOST],
  [STAGES.PROPOSAL_SENT]: [STAGES.NEGOTIATION, STAGES.WON, STAGES.LOST],
  [STAGES.NEGOTIATION]: [STAGES.WON, STAGES.LOST],
  [STAGES.WON]: [STAGES.POST_TRIP],
  [STAGES.LOST]: [],
  [STAGES.POST_TRIP]: []
};

const SLA_HOURS = {
  [STAGES.NEW]: 2,
  [STAGES.QUALIFIED]: 8,
  [STAGES.PROPOSAL_SENT]: 24,
  [STAGES.NEGOTIATION]: 48,
  [STAGES.WON]: 24,
  [STAGES.LOST]: 0,
  [STAGES.POST_TRIP]: 0
};

let writeQueue = Promise.resolve();

const routes = [
  { method: "GET", pattern: /^\/health$/, handler: handleHealth },
  { method: "POST", pattern: /^\/public\/v1\/leads$/, handler: handleCreateLead },
  { method: "GET", pattern: /^\/api\/v1\/leads$/, handler: handleListLeads },
  { method: "GET", pattern: /^\/api\/v1\/leads\/([^/]+)$/, handler: handleGetLead },
  { method: "PATCH", pattern: /^\/api\/v1\/leads\/([^/]+)\/stage$/, handler: handlePatchLeadStage },
  { method: "PATCH", pattern: /^\/api\/v1\/leads\/([^/]+)\/owner$/, handler: handlePatchLeadOwner },
  { method: "GET", pattern: /^\/api\/v1\/leads\/([^/]+)\/activities$/, handler: handleListActivities },
  { method: "POST", pattern: /^\/api\/v1\/leads\/([^/]+)\/activities$/, handler: handleCreateActivity },
  { method: "GET", pattern: /^\/api\/v1\/customers$/, handler: handleListCustomers },
  { method: "GET", pattern: /^\/api\/v1\/customers\/([^/]+)$/, handler: handleGetCustomer },
  { method: "GET", pattern: /^\/admin$/, handler: handleAdminHome },
  { method: "GET", pattern: /^\/admin\/customers$/, handler: handleAdminCustomersPage },
  { method: "GET", pattern: /^\/admin\/customers\/([^/]+)$/, handler: handleAdminCustomerDetailPage },
  { method: "GET", pattern: /^\/admin\/leads$/, handler: handleAdminLeadsPage },
  { method: "GET", pattern: /^\/admin\/leads\/([^/]+)$/, handler: handleAdminLeadDetailPage }
];

createServer(async (req, res) => {
  try {
    withCors(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const requestUrl = new URL(req.url, "http://localhost");
    const pathname = requestUrl.pathname;

    if (pathname.startsWith("/api/v1/") && !isAuthorizedAdminRequest(req, requestUrl)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    for (const route of routes) {
      if (route.method !== req.method) continue;
      const match = pathname.match(route.pattern);
      if (!match) continue;
      const params = match.slice(1);
      await route.handler(req, res, params);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: "Internal server error", detail: String(error?.message || error) });
  }
}).listen(PORT, () => {
  console.log(`Chapter2 backend listening on http://localhost:${PORT}`);
});

function withCors(res) {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
}

function isAuthorizedAdminRequest(req, requestUrl) {
  const authHeader = normalizeText(req.headers.authorization);
  const bearerPrefix = "Bearer ";
  const headerToken = authHeader.startsWith(bearerPrefix) ? authHeader.slice(bearerPrefix.length).trim() : "";
  const queryToken = normalizeText(requestUrl.searchParams.get("api_token"));
  const candidateToken = headerToken || queryToken;
  return candidateToken && candidateToken === ADMIN_API_TOKEN;
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
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
  return parsed;
}

async function persistStore(store) {
  writeQueue = writeQueue.then(async () => {
    const next = `${JSON.stringify(store, null, 2)}\n`;
    await writeFile(DATA_PATH, next, "utf8");
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

function computeSlaDueAt(stage, from = new Date()) {
  const hours = SLA_HOURS[stage] ?? 0;
  if (!hours) return null;
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
    service: "chapter2-backend",
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

async function handleAdminHome(req, res) {
  const requestUrl = new URL(req.url, "http://localhost");
  const token = normalizeText(requestUrl.searchParams.get("api_token"));
  const tokenHint = token || "YOUR_ADMIN_API_TOKEN";
  const leadsHref = token ? `/admin/leads?api_token=${encodeURIComponent(token)}` : "/admin/leads";
  const customersUiHref = token ? `/admin/customers?api_token=${encodeURIComponent(token)}` : "/admin/customers";
  const customersHref = token ? `/api/v1/customers?api_token=${encodeURIComponent(token)}` : "/api/v1/customers";

  sendHtml(
    res,
    200,
    `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Chapter2 Admin</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; }
    a { color: #004f7a; }
  </style>
</head>
<body>
  <h1>Chapter2 Admin</h1>
  <p>Use <code>?api_token=${escapeHtml(tokenHint)}</code> in admin URLs so UI actions can call protected APIs.</p>
  <ul>
    <li><a href="${escapeHtml(leadsHref)}">Lead pipeline view</a></li>
    <li><a href="${escapeHtml(customersUiHref)}">Customers UI</a></li>
    <li>Customers API: <a href="${escapeHtml(customersHref)}"><code>${escapeHtml(customersHref)}</code></a></li>
  </ul>
</body>
</html>`
  );
}

async function handleAdminCustomersPage(req, res) {
  const store = await readStore();
  const requestUrl = new URL(req.url, "http://localhost");
  const params = requestUrl.searchParams;
  const token = normalizeText(params.get("api_token"));
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

  const leadsHref = token ? `/admin/leads?api_token=${encodeURIComponent(token)}` : "/admin/leads";
  const homeHref = token ? `/admin?api_token=${encodeURIComponent(token)}` : "/admin";

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
    <input type="hidden" name="api_token" value="${escapeHtml(token)}" />
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
  const token = normalizeText(params.get("api_token"));
  const customersHref = token ? `/admin/customers?api_token=${encodeURIComponent(token)}` : "/admin/customers";
  const homeHref = token ? `/admin?api_token=${encodeURIComponent(token)}` : "/admin";

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
    const params = new URLSearchParams(window.location.search);
    const apiToken = params.get("api_token") || "";
    document.getElementById("stageSelect").value = currentStage;
    document.getElementById("ownerSelect").value = currentOwnerId;

    function authHeaders(extra = {}) {
      const headers = { ...extra };
      if (apiToken) headers.Authorization = "Bearer " + apiToken;
      return headers;
    }

    async function updateStage() {
      const stage = document.getElementById("stageSelect").value;
      const response = await fetch('/api/v1/leads/' + leadId + '/stage', {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
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
        headers: authHeaders({ 'Content-Type': 'application/json' }),
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
        headers: authHeaders({ 'Content-Type': 'application/json' }),
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
