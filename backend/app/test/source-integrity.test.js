import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function topLevelFunctionDeclarations(filePath) {
  const source = await readFile(filePath, "utf8");
  const lines = source.split("\n");
  let depth = 0;
  const names = [];
  for (const line of lines) {
    const match = line.match(/^\s{2}function\s+([A-Za-z0-9_]+)\s*\(/);
    if (depth === 1 && match) {
      names.push(match[1]);
    }
    for (const char of line) {
      if (char === "{") depth += 1;
      if (char === "}") depth = Math.max(0, depth - 1);
    }
  }
  return names;
}

async function moduleLevelFunctionDeclarations(filePath) {
  const source = await readFile(filePath, "utf8");
  const lines = source.split("\n");
  let depth = 0;
  const names = [];
  for (const line of lines) {
    const match = line.match(/^(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/);
    if (depth === 0 && match) {
      names.push(match[1]);
    }
    for (const char of line) {
      if (char === "{") depth += 1;
      if (char === "}") depth = Math.max(0, depth - 1);
    }
  }
  return names;
}

async function importedBindings(filePath) {
  const source = await readFile(filePath, "utf8");
  const bindings = [];
  const importBlocks = source.matchAll(/import\s+([\s\S]*?)\s+from\s+["'][^"']+["'];/g);
  for (const match of importBlocks) {
    const clause = String(match[1] || "").trim();
    if (!clause) continue;
    if (clause.startsWith("{")) {
      const inner = clause.replace(/^\{\s*|\s*\}$/g, "");
      for (const part of inner.split(",")) {
        const token = part.trim();
        if (!token) continue;
        const aliasMatch = token.match(/^(.*?)\s+as\s+([A-Za-z0-9_$]+)$/);
        if (aliasMatch) {
          bindings.push(aliasMatch[2]);
          continue;
        }
        const bareMatch = token.match(/^([A-Za-z0-9_$]+)$/);
        if (bareMatch) bindings.push(bareMatch[1]);
      }
      continue;
    }
    const defaultAndMaybeNamespace = clause.split(",").map((part) => part.trim()).filter(Boolean);
    if (defaultAndMaybeNamespace[0] && /^[A-Za-z0-9_$]+$/.test(defaultAndMaybeNamespace[0])) {
      bindings.push(defaultAndMaybeNamespace[0]);
    }
    if (defaultAndMaybeNamespace[1]) {
      const namespaceMatch = defaultAndMaybeNamespace[1].match(/^\*\s+as\s+([A-Za-z0-9_$]+)$/);
      if (namespaceMatch) bindings.push(namespaceMatch[1]);
    }
  }
  return bindings;
}

async function openApiPathOperations(filePath) {
  const source = await readFile(filePath, "utf8");
  const lines = source.split("\n");
  const operations = [];
  let inPaths = false;
  let currentPath = null;

  for (const line of lines) {
    if (!inPaths) {
      if (line.trim() === "paths:") {
        inPaths = true;
      }
      continue;
    }

    if (/^\S/.test(line) && !line.startsWith("paths:")) break;

    const pathMatch = line.match(/^  "?(\/[^"]+)"?:\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      continue;
    }

    const methodMatch = currentPath ? line.match(/^    (get|post|patch|put|delete):\s*$/) : null;
    if (methodMatch) {
      operations.push(`${methodMatch[1].toUpperCase()} ${currentPath}`);
    }
  }

  return operations.sort();
}

test("booking handlers do not contain duplicate top-level helper declarations", async () => {
  const filePath = path.resolve(__dirname, "..", "src", "http", "handlers", "bookings.js");
  const names = await topLevelFunctionDeclarations(filePath);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  assert.deepEqual(duplicates, []);
});

test("booking page keeps critical init handlers wired to real local functions", async () => {
  const filePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const names = await moduleLevelFunctionDeclarations(filePath);
  const required = [
    "loadActivities",
    "saveOwner",
    "saveStage",
    "saveNote",
    "updateNoteSaveButtonState",
    "savePricing",
    "handleOfferCurrencyChange",
    "addOfferComponent",
    "saveOffer",
    "updatePricingDirtyState",
    "loadInvoices",
    "onInvoiceSelectChange",
    "renderInvoiceMoneyLabels",
    "createInvoice",
    "updateInvoiceDirtyState",
    "renderTravelPlanPanel"
  ];
  for (const name of required) {
    assert.ok(
      names.includes(name),
      `Expected booking.js to define ${name} because init/module wiring references it`
    );
  }
});

test("booking page does not declare duplicate imported bindings", async () => {
  const filePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const names = await importedBindings(filePath);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  assert.deepEqual(
    duplicates,
    [],
    "Duplicate imported bindings in booking.js cause browser SyntaxError before the page can run"
  );
});

test("offer row removal triggers an immediate save in the offers module", async () => {
  const filePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offers.js");
  const source = await readFile(filePath, "utf8");
  assert.match(
    source,
    /data-offer-remove-component[\s\S]*?renderOfferComponentsTable\(\);[\s\S]*?await saveOffer\(\);/,
    "Removing an offer row should persist immediately instead of staying only in the local draft"
  );
});

test("offer editor uses autosave instead of an explicit update button", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const offersModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offers.js");
  const bookingSource = await readFile(bookingPagePath, "utf8");
  const offersSource = await readFile(offersModulePath, "utf8");

  assert.doesNotMatch(
    bookingSource,
    /id="offer_save_btn"/,
    "Offer UI should not expose a manual update button"
  );
  assert.match(
    offersSource,
    /data-offer-component-quantity[\s\S]*?addEventListener\("input",[\s\S]*?syncOfferInputTotals\(\)/,
    "Offer quantity changes should update totals live"
  );
  assert.match(
    offersSource,
    /function scheduleOfferAutosave\(/,
    "Offer editor should persist through autosave"
  );
});

test("offer component editor does not expose discounts_credits as a selectable category", async () => {
  const offersModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offers.js");
  const offersSource = await readFile(offersModulePath, "utf8");

  assert.match(
    offersSource,
    /const OFFER_COMPONENT_CATEGORIES = OFFER_CATEGORIES\.filter\(\(category\) => category\.code !== "DISCOUNTS_CREDITS"\);/,
    "Offer component rows should not allow discounts_credits because that creates negative sellable line items"
  );
});

test("generate offer waits for pending offer autosave before POSTing", async () => {
  const offersModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offers.js");
  const offersSource = await readFile(offersModulePath, "utf8");

  assert.match(
    offersSource,
    /async function handleGenerateOffer\(\)\s*\{[\s\S]*?await flushOfferAutosave\(\)[\s\S]*?bookingGenerateOfferRequest/,
    "Generating an offer PDF should flush pending offer autosave so it uses the latest offer_revision"
  );
  assert.match(
    offersSource,
    /expected_offer_revision:\s*getBookingRevision\("offer_revision"\)/,
    "Generating an offer PDF should send the current offer revision field, not pass the whole booking object"
  );
});

test("generated offer comment and delete actions flush pending offer autosave", async () => {
  const offersModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offers.js");
  const offersSource = await readFile(offersModulePath, "utf8");

  assert.match(
    offersSource,
    /async function saveGeneratedOfferComment\([\s\S]*?await flushOfferAutosave\(\)/,
    "Generated-offer comment updates should wait for pending offer autosave before using offer_revision"
  );
  assert.match(
    offersSource,
    /async function deleteGeneratedOffer\([\s\S]*?await flushOfferAutosave\(\)/,
    "Generated-offer deletion should wait for pending offer autosave before using offer_revision"
  );
});

test("generated offer email action is gated by the booking capability flag", async () => {
  const offersModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offers.js");
  const offersSource = await readFile(offersModulePath, "utf8");

  assert.match(
    offersSource,
    /const emailActionEnabled = canEdit && Boolean\(state\.booking\?\.generated_offer_email_enabled\);/,
    "Generated-offer email action should only render when the backend exposes Gmail-draft capability"
  );
});

test("runtime config resolves relative Gmail service-account paths from the repo root", async () => {
  const runtimeConfigPath = path.resolve(__dirname, "..", "src", "config", "runtime.js");
  const source = await readFile(runtimeConfigPath, "utf8");

  assert.match(
    source,
    /const REPO_ROOT = path\.resolve\(APP_ROOT, "\.\.", "\.\."\);/,
    "runtime.js should derive the repository root for config-path resolution"
  );
  assert.match(
    source,
    /function resolveConfigPathFromRepoRoot\(rawPath\)/,
    "runtime.js should normalize relative config paths through a dedicated helper"
  );
  assert.match(
    source,
    /return path\.resolve\(REPO_ROOT, normalized\);/,
    "Relative Gmail config paths should resolve from the repository root instead of the backend app cwd"
  );
  assert.match(
    source,
    /serviceAccountJsonPath: resolveConfigPathFromRepoRoot\(normalizeText\(process\.env\.GOOGLE_SERVICE_ACCOUNT_JSON_PATH \|\| ""\)\)/,
    "Gmail draft config should use repo-root-relative path resolution"
  );
});

test("contract route definitions stay in sync with generated OpenAPI", async () => {
  const routesPath = path.resolve(__dirname, "..", "src", "http", "routes.js");
  const openApiPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "openapi.yaml");
  const routesModule = await import(`${pathToFileURL(routesPath).href}?test=${Date.now()}`);

  const expected = routesModule.CONTRACT_ROUTE_DEFINITIONS
    .map((route) => `${route.method} ${route.path}`)
    .sort();
  const actual = await openApiPathOperations(openApiPath);

  assert.deepEqual(
    actual,
    expected,
    "Modeled/generated API routes must match the runtime contract route definitions exactly"
  );
});

test("booking init awaits page load and handles async init failures", async () => {
  const bookingPageModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const source = await readFile(bookingPageModulePath, "utf8");

  assert.match(
    source,
    /async function init\(\)\s*\{[\s\S]*?await loadBookingPage\(\);[\s\S]*?\n\}/,
    "Booking init should await the async page load instead of dropping the promise"
  );
  assert.match(
    source,
    /void init\(\)\.catch\(\(error\) => \{/,
    "Booking module should own async init failures with a catch handler"
  );
});

test("booking page wires the dedicated travel-plan module and section", async () => {
  const bookingPageModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const travelPlanModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
  const moduleSource = await readFile(bookingPageModulePath, "utf8");
  const pageSource = await readFile(bookingPagePath, "utf8");
  const travelPlanSource = await readFile(travelPlanModulePath, "utf8");

  assert.match(
    moduleSource,
    /import \{ createBookingTravelPlanModule \} from "\.\.\/booking\/travel_plan\.js"/,
    "booking.js should import the dedicated travel-plan module"
  );
  assert.match(
    moduleSource,
    /const travelPlanModule = createBookingTravelPlanModule\(/,
    "booking.js should instantiate the dedicated travel-plan module"
  );
  assert.match(
    moduleSource,
    /travelPlanModule\.bindEvents\(\);/,
    "booking.js should bind travel-plan events during init"
  );
  assert.match(
    moduleSource,
    /travelPlanModule\.applyBookingPayload\(\);/,
    "booking.js should apply booking payload into the travel-plan module"
  );
  assert.match(
    moduleSource,
    /renderTravelPlanPanel\(\);[\s\S]*?renderOfferPanel\(\);/,
    "booking.js should render Travel plan before the Offer section"
  );
  assert.match(
    pageSource,
    /id="travel_plan_panel"[\s\S]*id="offer_panel"/,
    "booking.html should place the Travel plan section before the Offer section"
  );
  assert.match(
    travelPlanSource,
    /bookingTravelPlanRequest/,
    "travel_plan.js should use the generated bookingTravelPlanRequest factory"
  );
  assert.match(
    travelPlanSource,
    /expected_travel_plan_revision:\s*getBookingRevision\("travel_plan_revision"\)/,
    "travel-plan saves should use the travel_plan_revision optimistic-lock field"
  );
  assert.match(
    travelPlanSource,
    /fetchBookingMutation\(request\.url,/,
    "travel-plan saves should call fetchBookingMutation with the generated request.url"
  );
});

test("travel-plan module preserves add/remove/reorder and offer-link editing helpers", async () => {
  const travelPlanModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
  const travelPlanHelpersPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_helpers.js");
  const generatedCatalogsPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "generated_catalogs.js");
  const source = await readFile(travelPlanModulePath, "utf8");
  const helperSource = await readFile(travelPlanHelpersPath, "utf8");
  const generatedCatalogs = await import(`${pathToFileURL(generatedCatalogsPath).href}?test=${Date.now()}`);

  for (const helperName of ["addDay", "removeDay", "addSegment", "removeSegment", "moveSegment", "addLink", "removeLink"]) {
    assert.match(
      source,
      new RegExp(`function ${helperName}\\(`),
      `travel_plan.js should define ${helperName} for travel-plan editing`
    );
  }
  assert.match(
    source,
    /TRAVEL_PLAN_TIMING_KIND_OPTIONS/,
    "travel_plan.js should render timing kinds from the shared helper constant"
  );
  assert.match(
    source,
    /data-travel-plan-segment-field="timing_kind"/,
    "travel_plan.js should render a timing mode selector for each segment"
  );
  assert.match(
    source,
    /data-travel-plan-segment-field="time_point_date"/,
    "travel_plan.js should render a date input for point timing mode"
  );
  assert.match(
    source,
    /data-travel-plan-segment-field="time_point_time"/,
    "travel_plan.js should render a 5-minute time selector for point timing mode"
  );
  assert.match(
    source,
    /data-travel-plan-segment-field="start_time_date"/,
    "travel_plan.js should render a start-date input for range timing mode"
  );
  assert.match(
    source,
    /data-travel-plan-segment-field="start_time_time"/,
    "travel_plan.js should render a start-time selector for range timing mode"
  );
  assert.match(
    source,
    /data-travel-plan-segment-field="end_time_date"/,
    "travel_plan.js should render an end-date input for range timing mode"
  );
  assert.match(
    source,
    /data-travel-plan-segment-field="end_time_time"/,
    "travel_plan.js should render an end-time selector for range timing mode"
  );
  assert.match(
    source,
    /for \(let minute = 0; minute < 60; minute \+= 5\)/,
    "travel_plan.js should offer 5-minute time increments instead of free one-minute entry"
  );
  assert.doesNotMatch(
    source,
    /type="datetime-local"/,
    "travel_plan.js should no longer rely on datetime-local inputs for timing mode selection"
  );
  assert.equal(
    generatedCatalogs.TRAVEL_PLAN_TIMING_KIND_OPTIONS.length,
    3,
    "Generated Travel plan timing options should stay populated from the schema runtime"
  );
  assert.deepEqual(
    generatedCatalogs.TRAVEL_PLAN_TIMING_KIND_OPTIONS.map((option) => option.value),
    ["label", "point", "range"]
  );
});

test("tour page reads month options from the generated catalogs layer", async () => {
  const tourPageModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tour.js");
  const tourPageHtmlPath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "tour.html");
  const generatedCatalogsPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "generated_catalogs.js");
  const tourSource = await readFile(tourPageModulePath, "utf8");
  const tourHtml = await readFile(tourPageHtmlPath, "utf8");
  const generatedCatalogs = await import(`${pathToFileURL(generatedCatalogsPath).href}?test=${Date.now()}`);

  assert.match(
    tourSource,
    /import\s+\{\s*MONTH_CODE_CATALOG\s*\}\s+from\s+"..\/shared\/generated_catalogs\.js"/,
    "Tour page should source month options from generated_catalogs.js, not the generated Aux model file"
  );
  assert.deepEqual(
    generatedCatalogs.MONTH_CODE_CATALOG,
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
  );
  assert.match(
    tourSource,
    /function normalizeText\(value\)\s*\{\s*return String\(value \?\? ""\)\.trim\(\);\s*\}/,
    "Tour page should define its local normalizeText helper because create-mode state uses it at module initialization time"
  );
  assert.match(
    tourHtml,
    /id="tour_title_edit_btn"/,
    "Tour page should expose the header pen button for inline title editing"
  );
  assert.doesNotMatch(
    tourHtml,
    /id="tour_titleInput"/,
    "Tour page should no longer render the old form title text field"
  );
});

test("settings page staff table shows separate realm and client Keycloak roles", async () => {
  const backendPageModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking_list.js");
  const siteCssPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "site.css");
  const source = await readFile(backendPageModulePath, "utf8");
  const css = await readFile(siteCssPath, "utf8");

  assert.match(
    source,
    /keycloak-roles-col">.*backendT\("backend\.table\.roles", "Roles"\).*backend-table-align-right">.*backendT\("backend\.table\.active", "Active"\)/,
    "Settings user table should include a Roles column"
  );
  assert.match(
    source,
    /formatKeycloakRoleList\(user\?\.client_roles\)/,
    "Settings user table should display client roles in the Roles column"
  );
  assert.doesNotMatch(
    source,
    /<strong>Client:<\/strong>|<strong>Realm:<\/strong>/,
    "Settings user table should not render realm/client labels in the Roles column"
  );
  assert.match(
    css,
    /\.backend-table th\.keycloak-roles-col,\s*\.backend-table td\.keycloak-roles-col\s*\{\s*text-align:\s*right;/,
    "Settings roles column should right-align the header and cell content"
  );
});

test("contract tests use an isolated temp store instead of the runtime store.json", async () => {
  const contractTestPath = path.resolve(__dirname, "mobile-contract.test.js");
  const source = await readFile(contractTestPath, "utf8");

  assert.match(
    source,
    /const TEST_DATA_DIR = await mkdtemp\(path\.join\(os\.tmpdir\(\), "travelagency-contract-test-"\)\);/,
    "Contract tests should create a temporary data directory"
  );
  assert.match(
    source,
    /const STORE_PATH = path\.join\(TEST_DATA_DIR, "store\.json"\);/,
    "Contract tests should write to a temp store path"
  );
  assert.match(
    source,
    /process\.env\.BACKEND_DATA_DIR = TEST_DATA_DIR;/,
    "Contract tests should override BACKEND_DATA_DIR"
  );
  assert.match(
    source,
    /process\.env\.STORE_FILE = STORE_PATH;/,
    "Contract tests should override STORE_FILE"
  );
  assert.doesNotMatch(
    source,
    /backend\/app\/data\/store\.json/,
    "Contract tests must not reference the real runtime store.json directly"
  );
});

test("staging bootstrap does not seed legacy customer store data", async () => {
  const filePath = path.resolve(__dirname, "..", "..", "..", "scripts", "update_staging.sh");
  const source = await readFile(filePath, "utf8");

  assert.ok(!source.includes('"customers"'), "update_staging.sh should not bootstrap legacy customers collection");
  assert.match(
    source,
    /printf '\{\}\\n' > backend\/app\/data\/store\.json/,
    "update_staging.sh should bootstrap an empty JSON store"
  );
});

test("generator no longer emits legacy ATPStaff model outputs or SourceAttribution booking types", async () => {
  const filePath = path.resolve(__dirname, "..", "..", "..", "tools", "generator", "generate_mobile_contract_artifacts.rb");
  const source = await readFile(filePath, "utf8");

  assert.doesNotMatch(
    source,
    /generated_ATPStaff\.js' =>/,
    "generator should not emit generated_ATPStaff.js anymore"
  );
  assert.doesNotMatch(
    source,
    /generated_ATPStaff\.swift' =>/,
    "generator should not emit generated_ATPStaff.swift anymore"
  );
  assert.doesNotMatch(
    source,
    /SourceAttribution/,
    "generator should not reference removed SourceAttribution types"
  );
});

test("offer exchange paths do not keep temporary debug logging", async () => {
  const pricingModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "pricing.js");
  const financeHandlerPath = path.resolve(__dirname, "..", "src", "http", "handlers", "booking_finance.js");
  const pricingSource = await readFile(pricingModulePath, "utf8");
  const financeSource = await readFile(financeHandlerPath, "utf8");

  assert.doesNotMatch(pricingSource, /\[offer-exchange-debug\]/, "frontend offer exchange debug logs should be removed");
  assert.doesNotMatch(financeSource, /\[offer-exchange-debug backend\]/, "backend offer exchange debug logs should be removed");
});
