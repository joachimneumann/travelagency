import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

function travelPlanEditorCorePath() {
  return path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "travel_plan_editor_core.js");
}

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

test("backend ui i18n sync script passes and local backend startup is strict by default", async () => {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const syncScriptPath = path.join(repoRoot, "scripts", "i18n", "sync_backend_i18n.mjs");
  const startLocalBackendPath = path.join(repoRoot, "scripts", "local", "start_local_backend.sh");
  const localKeycloakClientPath = path.join(repoRoot, "scripts", "keycloak", "bootstrap_local_keycloak_backend_client.sh");
  const sharedKeycloakClientPath = path.join(repoRoot, "scripts", "keycloak", "bootstrap_keycloak_backend_realm.sh");
  const [startLocalBackendSource, localKeycloakClientSource, sharedKeycloakClientSource] = await Promise.all([
    readFile(startLocalBackendPath, "utf8"),
    readFile(localKeycloakClientPath, "utf8"),
    readFile(sharedKeycloakClientPath, "utf8")
  ]);

  await execFileAsync(process.execPath, [syncScriptPath, "check"], { cwd: repoRoot });

  assert.match(
    startLocalBackendSource,
    /BACKEND_I18N_STRICT="\$\{BACKEND_I18N_STRICT:-1\}"/,
    "Local backend startup should enable strict backend i18n checking by default"
  );
  assert.match(
    startLocalBackendSource,
    /load_repo_env "\$ROOT_DIR"/,
    "Local backend startup should load repository env before applying defaults"
  );
  assert.match(
    startLocalBackendSource,
    /run_local_i18n_preflight "\$ROOT_DIR"/,
    "Local backend startup should run the backend i18n sync check before booting"
  );
  assert.match(
    startLocalBackendSource,
    /TRAVELER_DETAILS_TOKEN_SECRET="\$\{TRAVELER_DETAILS_TOKEN_SECRET:-local-traveler-details-token-secret\}"/,
    "Local backend startup should provide a default traveler-details token secret for local link generation"
  );
  assert.doesNotMatch(
    startLocalBackendSource,
    /\.zshrc/,
    "Local backend startup should not depend on user shell startup files"
  );
  assert.match(
    localKeycloakClientSource,
    /"directAccessGrantsEnabled": True/,
    "Local Keycloak should allow the backend-local quick-login password grant"
  );
  assert.match(
    sharedKeycloakClientSource,
    /"directAccessGrantsEnabled": False/,
    "Shared staging/production Keycloak bootstrap should keep password grants disabled"
  );
});

test("translate wrapper covers backend and frontend i18n sync scripts", async () => {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const frontendSyncScriptPath = path.join(repoRoot, "scripts", "i18n", "sync_frontend_i18n.mjs");
  const translateScriptPath = path.join(repoRoot, "scripts", "i18n", "translate");
  const translateScriptSource = await readFile(translateScriptPath, "utf8");

  await execFileAsync(process.execPath, [frontendSyncScriptPath, "check"], { cwd: repoRoot });

  assert.match(
    translateScriptSource,
    /BACKEND_SYNC_SCRIPT=.*sync_backend_i18n\.mjs/,
    "Translate wrapper should keep the backend sync script wired"
  );
  assert.match(
    translateScriptSource,
    /FRONTEND_SYNC_SCRIPT=.*sync_frontend_i18n\.mjs/,
    "Translate wrapper should keep the frontend sync script wired"
  );
  assert.match(
    translateScriptSource,
    /node "\$BACKEND_SYNC_SCRIPT" translate --target vi[\s\S]*node "\$FRONTEND_SYNC_SCRIPT" translate/,
    "Translate update should run backend and frontend syncs in sequence"
  );
  assert.match(
    translateScriptSource,
    /node "\$BACKEND_SYNC_SCRIPT" check --target vi[\s\S]*node "\$FRONTEND_SYNC_SCRIPT" check/,
    "Translate check should validate backend and frontend sync state"
  );
});

test("booking page keeps critical init handlers wired to real local functions", async () => {
  const filePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const names = await moduleLevelFunctionDeclarations(filePath);
  const required = [
    "loadActivities",
    "saveCoreEdits",
    "saveNoteEdits",
    "updateNoteSaveButtonState",
    "handleOfferCurrencyChange",
    "addOfferPricingRow",
    "saveOffer",
    "loadPaymentDocuments",
    "renderPricingPanel",
    "savePageEdits",
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

test("booking page uses a page-level dirty bar instead of local section save buttons", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingSource = await readFile(bookingPagePath, "utf8");

  assert.match(
    bookingSource,
    /id="booking_dirty_bar"[\s\S]*?id="booking_discard_edits_btn"[\s\S]*?id="booking_save_edits_btn"[\s\S]*?id="backToBackend"/,
    "Booking UI should expose one sticky page-level control bar with discard, save, and close actions"
  );
  assert.doesNotMatch(bookingSource, /booking-detail-page__topbar/, "Booking page should not render a separate close-button topbar");
  assert.doesNotMatch(bookingSource, /id="booking_note_save_btn"/, "Booking notes should no longer expose a local update button");
  assert.doesNotMatch(bookingSource, /id="pricing_save_btn"/, "Pricing should no longer expose a local save button");
  assert.doesNotMatch(bookingSource, /id="invoice_create_btn"/, "Payment documents should no longer expose the removed invoice save button");
});

test("travel plan and payment PDFs share the same workspace helper", async () => {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const travelPlanPath = travelPlanEditorCorePath();
  const paymentFlowPath = path.join(repoRoot, "frontend", "scripts", "booking", "payment_flow.js");
  const helperPath = path.join(repoRoot, "frontend", "scripts", "booking", "pdf_workspace.js");
  const [travelPlanSource, paymentFlowSource, helperSource] = await Promise.all([
    readFile(travelPlanPath, "utf8"),
    readFile(paymentFlowPath, "utf8"),
    readFile(helperPath, "utf8")
  ]);

  assert.match(
    helperSource,
    /export function buildBookingPdfWorkspaceMarkup\(/,
    "PDF workspace helper should expose the shared Travel-plan layout builder"
  );
  assert.match(
    helperSource,
    /export function buildBookingPdfDocumentSectionMarkup\(/,
    "PDF workspace helper should also expose the shared PDF document-section builder"
  );
  assert.match(
    travelPlanSource,
    /buildBookingPdfWorkspaceMarkup\(/,
    "Travel plan PDF workspace should render through the shared workspace helper"
  );
  assert.match(
    paymentFlowSource,
    /buildBookingPdfWorkspaceMarkup\([\s\S]*buildBookingPdfDocumentSectionMarkup\(/,
    "Payment request and receipt sections should render through the shared workspace helpers"
  );
});

test("discovery-call bookings without a selected tour use a neutral fallback image instead of a fake tour id", async () => {
  const bookingCorePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "core.js");
  const bookingListPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking_list.js");
  const runtimePath = path.resolve(__dirname, "..", "src", "config", "runtime.js");
  const bookingCoreSource = await readFile(bookingCorePath, "utf8");
  const bookingListSource = await readFile(bookingListPath, "utf8");
  const runtimeSource = await readFile(runtimePath, "utf8");

  assert.match(
    bookingCoreSource,
    /const DISCOVERY_CALL_FALLBACK_IMAGE = "assets\/img\/happy_tourists\.webp";[\s\S]*if \(shouldUseDiscoveryCallFallbackImage\(state\.booking\)\) \{[\s\S]*els\.heroImage\.src = DISCOVERY_CALL_FALLBACK_IMAGE;/,
    "Booking detail should use a neutral fallback image for public discovery-call bookings that have no selected tour"
  );
  assert.match(
    bookingCoreSource,
    /function shouldUseDiscoveryCallFallbackImage\(booking\) \{[\s\S]*web_form_submission\?\.tour_id[\s\S]*web_form_submission\?\.page_url[\s\S]*\}/,
    "Booking detail should detect discovery-call bookings by the public form payload and absence of a selected tour"
  );
  assert.match(
    bookingListSource,
    /const isDiscoveryCallWithoutTour = !imageRef && !tourId && Boolean\(normalizeText\(booking\?\.web_form_submission\?\.page_url\)\);[\s\S]*assets\/img\/happy_tourists\.webp/,
    "Booking list thumbnails should use the same neutral fallback image for discovery-call bookings without a selected tour"
  );
  assert.match(
    runtimeSource,
    /FALLBACK_BOOKING_IMAGE_PATH = path\.resolve\(APP_ROOT, "\.\.", "\.\.", "assets", "img", "happy_tourists\.webp"\);/,
    "PDF generation should use the same neutral fallback image path when a booking has no selected tour image"
  );
});

test("backend startup backfills missing booking persons and the frontend reads only persisted persons", async () => {
  const serverPath = path.resolve(__dirname, "..", "src", "server.js");
  const storeUtilsPath = path.resolve(__dirname, "..", "src", "lib", "store_utils.js");
  const frontendHelperPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "booking_persons.js");
  const serverSource = await readFile(serverPath, "utf8");
  const storeUtilsSource = await readFile(storeUtilsPath, "utf8");
  const frontendHelperSource = await readFile(frontendHelperPath, "utf8");

  assert.match(
    storeUtilsSource,
    /__bookingPersonsWritebackNeeded/,
    "Store reads should mark when persisted bookings need a persons backfill writeback"
  );
  assert.match(
    serverSource,
    /startupStore\.__bookingPersonsWritebackNeeded === true[\s\S]*persistStore\(startupStore\)/,
    "Backend startup should persist booking-person backfills before serving requests"
  );
  assert.doesNotMatch(
    frontendHelperSource,
    /buildFallbackSubmissionPerson|web_form_submission/,
    "Frontend booking person helpers should rely on persisted booking.persons instead of synthesizing a fallback contact"
  );
});

test("backend startup writes back legacy offers with explicit offer detail level fields", async () => {
  const serverPath = path.resolve(__dirname, "..", "src", "server.js");
  const storeUtilsPath = path.resolve(__dirname, "..", "src", "lib", "store_utils.js");
  const serverSource = await readFile(serverPath, "utf8");
  const storeUtilsSource = await readFile(storeUtilsPath, "utf8");

  assert.match(
    storeUtilsSource,
    /let bookingOfferWritebackNeeded = false;[\s\S]*const rawOffer = booking\?\.offer && typeof booking\.offer === "object" \? booking\.offer : null;[\s\S]*const normalizedOffer = normalizeBookingOffer\(normalizedBooking\.offer, getBookingPreferredCurrency\(normalizedBooking\)\);[\s\S]*if \(rawOffer && JSON\.stringify\(rawOffer\) !== JSON\.stringify\(normalizedOffer\)\) \{[\s\S]*bookingOfferWritebackNeeded = true;[\s\S]*\}[\s\S]*__bookingOfferWritebackNeeded/,
    "Store reads should mark legacy offers for a one-time writeback when normalization adds the explicit offer detail level shape"
  );
  assert.match(
    serverSource,
    /startupStore\.__bookingOfferWritebackNeeded === true[\s\S]*persistStore\(startupStore\)/,
    "Backend startup should persist legacy-offer writebacks before serving requests"
  );
});

test("backend startup prunes legacy generated-offer confirmation fields before serving requests", async () => {
  const serverPath = path.resolve(__dirname, "..", "src", "server.js");
  const cleanupDomainPath = path.resolve(__dirname, "..", "src", "domain", "generated_offer_cleanup.js");
  const serverSource = await readFile(serverPath, "utf8");
  const cleanupDomainSource = await readFile(cleanupDomainPath, "utf8");

  assert.match(
    cleanupDomainSource,
    /function cleanupGeneratedOffer\(generatedOffer\) \{[\s\S]*booking_confirmation[\s\S]*customer_confirmation_flow[\s\S]*public_booking_confirmation_token/,
    "Generated-offer cleanup should strip obsolete confirmation fields from persisted offers"
  );
  assert.match(
    serverSource,
    /const prunedLegacyGeneratedOfferState = pruneLegacyGeneratedOfferState\(startupStore\);[\s\S]*prunedLegacyGeneratedOfferState[\s\S]*persistStore\(startupStore\)/,
    "Backend startup should persist legacy generated-offer cleanup before serving requests"
  );
});

test("country reference info lives under content and startup migrates the legacy runtime file", async () => {
  const runtimePath = path.resolve(__dirname, "..", "src", "config", "runtime.js");
  const serverPath = path.resolve(__dirname, "..", "src", "server.js");
  const [runtimeSource, serverSource] = await Promise.all([
    readFile(runtimePath, "utf8"),
    readFile(serverPath, "utf8")
  ]);

  assert.match(
    runtimeSource,
    /LEGACY_COUNTRY_REFERENCE_INFO_PATH = path\.join\(DATA_ROOT, "country_reference_info\.json"\);[\s\S]*COUNTRY_REFERENCE_INFO_PATH = resolveConfigPathFromRepoRoot\([\s\S]*path\.join\("content", "country_reference_info\.json"\)/,
    "Country reference info should now live under content while still keeping the old runtime path as a migration source"
  );
  assert.match(
    serverSource,
    /moveFileIfNeeded\(RUNTIME_PATHS\.legacyCountryReferenceInfoPath, RUNTIME_PATHS\.countryReferenceInfoPath\);/,
    "Backend startup should move the legacy country reference file into content before serving requests"
  );
});

test("backend startup removes legacy tour highlights from persisted tour records before serving requests", async () => {
  const serverPath = path.resolve(__dirname, "..", "src", "server.js");
  const toursSupportPath = path.resolve(__dirname, "..", "src", "domain", "tours_support.js");
  const serverSource = await readFile(serverPath, "utf8");
  const toursSupportSource = await readFile(toursSupportPath, "utf8");

  assert.match(
    toursSupportSource,
    /export function migratePersistedTourState\(tour\) \{[\s\S]*"highlights" in tour[\s\S]*delete tour\.highlights;/,
    "Tour migration should strip legacy highlights from persisted tour records"
  );
  assert.match(
    serverSource,
    /async function backfillPersistedTourState\(\) \{[\s\S]*readTours\(\)[\s\S]*migratePersistedTourState\(tour\)[\s\S]*persistTour\(services\.tourHelpers\.normalizeTourForStorage\(tour\)\)[\s\S]*\}[\s\S]*await backfillPersistedTourState\(\);/,
    "Backend startup should write back tour migrations before serving requests"
  );
});

test("booking page initial customer language prefers the saved booking customer language", async () => {
  const bookingPageLanguagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking_page_language.js");
  const source = await readFile(bookingPageLanguagePath, "utf8");

  assert.match(
    source,
    /function resolveSubmissionCustomerLanguage\(booking\) \{[\s\S]*const submissionPreferredLanguage = normalizeText\(booking\?\.web_form_submission\?\.preferred_language\);[\s\S]*const customerLanguage = normalizeText\(booking\?\.customer_language\);[\s\S]*if \(customerLanguage\) \{[\s\S]*return normalizeBookingContentLang\(customerLanguage\);[\s\S]*return normalizeBookingContentLang\(submissionPreferredLanguage \|\| "en"\);[\s\S]*\}/,
    "Initial booking-page language should prefer the saved booking customer-language value before falling back to the original web-form language"
  );
  assert.match(
    source,
    /function syncContentLanguageSelector\(\) \{[\s\S]*state\.coreDraft\?\.customer_language[\s\S]*state\.booking\?\.customer_language[\s\S]*state\.booking\?\.web_form_submission\?\.preferred_language/,
    "Booking page language selector should reflect the local customer-language draft first and fall back to the saved booking value"
  );
  assert.match(
    source,
    /function renderContentLanguageMenu\(\) \{[\s\S]*els\.contentLanguageSelect\?\.value[\s\S]*state\.coreDraft\?\.customer_language[\s\S]*state\.booking\?\.customer_language/,
    "The visible customer-language menu should render from the current draft or select value instead of snapping back to the persisted language"
  );
});

test("booking person modal exposes traveler-details link actions and the public form page", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const travelerDetailsPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "traveler-details.html");
  const bookingScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const personsScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "persons.js");
  const travelerDetailsScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "traveler_details.js");
  const bookingSource = await readFile(bookingPagePath, "utf8");
  const travelerDetailsPage = await readFile(travelerDetailsPagePath, "utf8");
  const bookingScript = await readFile(bookingScriptPath, "utf8");
  const personsScript = await readFile(personsScriptPath, "utf8");
  const travelerDetailsScript = await readFile(travelerDetailsScriptPath, "utf8");

  assert.match(
    bookingSource,
    /id="booking_person_modal_name"[\s\S]*id="booking_person_modal_public_actions_mount"[\s\S]*id="booking_person_modal_discard_btn"[\s\S]*id="booking_person_modal_save_btn"/,
    "Booking person modal should place the traveler-details action mount below the traveler name field and expose local traveler save and discard actions"
  );
  assert.doesNotMatch(
    bookingSource,
    /id="booking_person_modal_traveler_details_copy_btn"/,
    "Booking page template should not hard-code the traveler-details copy button"
  );
  assert.match(
    personsScript,
    /function renderTravelerDetailsLinkActions\(\)[\s\S]*booking_person_modal_traveler_details_copy_btn[\s\S]*booking\.traveler_details\.save_and_copy_link/,
    "Person modal module should render the traveler-details copy action inside the person detail view and support a save-and-copy label when the traveler is dirty"
  );
  assert.doesNotMatch(
    personsScript,
    /booking_person_modal_traveler_details_email_btn|booking_person_modal_traveler_details_whatsapp_btn/,
    "Person modal module should no longer render email or WhatsApp traveler-details actions"
  );
  assert.doesNotMatch(
    personsScript,
    /function renderTravelerDetailsLinkActions\(\)[\s\S]*data-requires-clean-state/,
    "Person modal module should not gate the traveler-details link action behind the page-wide clean-state guard"
  );
  assert.match(
    personsScript,
    /function updatePersonModalActionControls\([\s\S]*booking\.persons\.unsaved_changes[\s\S]*function discardPersonDraftChanges\([\s\S]*function saveActivePersonDraft\(/,
    "Person modal module should expose local traveler save and discard controls with their own dirty-state messaging"
  );
  assert.match(
    travelerDetailsPage,
    /id="traveler_details_intro">This information helps us prepare your journey smoothly\. If you prefer, you can also provide it later, at the beginning of your trip\. The link to this page expires in 24 hours to protect your privacy\.<\/p>[\s\S]*id="traveler_details_form"[\s\S]*id="traveler_details_list"[\s\S]*id="traveler_details_actions"[\s\S]*id="traveler_details_save_btn"[\s\S]*id="traveler_details_status"/,
    "Public traveler-details page should render the new non-blocking intro copy plus the dedicated single-person form and movable save action"
  );
  assert.doesNotMatch(
    travelerDetailsPage,
    /traveler_details_summary/,
    "Public traveler-details page should not render the booking, traveler, or link-expiry summary block"
  );
  assert.doesNotMatch(
    travelerDetailsPage,
    /traveler_details_privacy_notice/,
    "Public traveler-details page should no longer render the prior-data privacy warning"
  );
  assert.doesNotMatch(
    travelerDetailsPage,
    /type="file"/,
    "Public traveler-details page should not expose backend-only document image upload inputs"
  );
  const siteStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "site.css");
  const siteStyles = await readFile(siteStylesPath, "utf8");
  assert.match(
    travelerDetailsScript,
    /buildEndpointPath\(pathname\) \{\s+return `\/public\/v1\/bookings\/\$\{encodeURIComponent\(state\.bookingId\)\}\/persons\/\$\{encodeURIComponent\(state\.personId\)\}\$\{pathname\}`;/,
    "Public traveler-details page should target the person-specific public traveler-details endpoint"
  );
  assert.match(
    travelerDetailsScript,
    /body: \{\s+person: buildTravelerPayload\(state\.traveler\)\s+\}/,
    "Public traveler-details page should save a single traveler payload through the public traveler-details update endpoint"
  );
  assert.doesNotMatch(
    travelerDetailsScript,
    /function summaryRows\(|renderSummary\(|booking_name \|\| access\.booking_id|Link expires|Traveler", state\.traveler\.name/,
    "Public traveler-details page should no longer render booking, traveler, or link-expiry summary text"
  );
  assert.doesNotMatch(
    travelerDetailsScript,
    /<h3 class="traveler-details-document__title">Address<\/h3>|<h3 class="traveler-details-document__title">Travel Document<\/h3>/,
    "Public traveler-details page should no longer show visible Address or Travel Document section titles"
  );
  assert.match(
    travelerDetailsScript,
    /const bookingName = normalizeText\(access\?\.booking_name\);[\s\S]*const travelerNumber = Number\(access\?\.traveler_number\);[\s\S]*const heading = `Traveler \$\{travelerNumber\}: \$\{bookingName\}`;[\s\S]*els\.title\.textContent = heading;[\s\S]*document\.title = `\$\{heading\} \| AsiaTravelPlan`;/,
    "Public traveler-details page should use the traveler number plus booking name as the visible main heading when available"
  );
  assert.match(
    travelerDetailsScript,
    /<label for="traveler_expires_on">Expires on<\/label>[\s\S]*data-document-field="expires_on"[\s\S]*traveler-details-document__checkbox-wrap[\s\S]*No expiration date/,
    "Public traveler-details page should place the no-expiration checkbox directly below the expiry-date picker"
  );
  assert.match(
    travelerDetailsScript,
    /renderTravelerLanguageOptions\(traveler\.preferred_language\)[\s\S]*renderCountryOptions\(traveler\.nationality, "Select nationality"\)[\s\S]*renderTravelerGenderOptions\(traveler\.gender\)/,
    "Public traveler-details form should render dropdowns for preferred language, nationality, and gender"
  );
  assert.match(
    travelerDetailsScript,
    /gender: normalizeTravelerGender\(traveler\.gender\)[\s\S]*state\.traveler\[field\] = normalizeTravelerGender\(target\.value\)/,
    "Public traveler-details form should normalize and persist the traveler gender enum"
  );
  assert.match(
    travelerDetailsScript,
    /TRAVELER_DETAILS_TRANSLATIONS = Object\.freeze\(\{[\s\S]*gender: "Gender"[\s\S]*gender: "Giới tính"[\s\S]*function travelerDetailsT\(key, fallback\)[\s\S]*travelerDetailsT\("gender_placeholder", "Select gender"\)[\s\S]*travelerDetailsT\("gender", "Gender"\)/,
    "Public traveler-details form should localize the gender field and options for the traveler language"
  );
  assert.match(
    travelerDetailsScript,
    /const supportsNationalId = travelerSupportsNationalId\(traveler\);[\s\S]*traveler-details-document__section[\s\S]*supportsNationalId \? `[\s\S]*data-document-switch="passport"[\s\S]*data-document-switch="national_id"[\s\S]*` : ""/,
    "Public traveler-details form should only expose the ID-card switch for Vietnamese travelers"
  );
  assert.match(
    travelerDetailsScript,
    /const supportsNoExpirationDate = documentType === "national_id";[\s\S]*supportsNoExpirationDate && document\.no_expiration_date[\s\S]*supportsNoExpirationDate \? `[\s\S]*No expiration date[\s\S]*traveler-details-document__checkbox--placeholder/,
    "Public traveler-details form should only expose the no-expiration control for ID cards while reserving the same layout slot for passports"
  );
  assert.match(
    travelerDetailsScript,
    /const documentSectionLabel = supportsNationalId \? "Travel document" : "Passport";[\s\S]*<label>\$\{escapeHtml\(documentSectionLabel\)\}<\/label>/,
    "Public traveler-details form should relabel the document section to Passport for non-Vietnamese travelers"
  );
  assert.match(
    travelerDetailsScript,
    /requestJson\(`\/documents\/\$\{encodeURIComponent\(documentType\)\}\/picture`, \{[\s\S]*method: "POST"[\s\S]*data_base64: await fileToBase64\(file\)/,
    "Public traveler-details page should upload the active passport or ID image through the public document-picture endpoint"
  );
  assert.match(
    travelerDetailsScript,
    /<select id="traveler_issuing_country"[\s\S]*renderCountryOptions\(document\.issuing_country, "Select issuing country"\)/,
    "Public traveler-details form should render issuing country as a country dropdown"
  );
  assert.match(
    travelerDetailsScript,
    /<select id="traveler_country_code"[\s\S]*renderCountryOptions\(traveler\.address\.country_code, "Select country"\)/,
    "Public traveler-details form should render address country code as a country dropdown"
  );
  assert.match(
    siteStyles,
    /\.booking-person-modal__document-switch \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*background: var\(--surface-disabled-tint\);[\s\S]*\.booking-person-modal__document-switch-btn\.is-active \{/,
    "Public traveler-details page should style the travel document switch like the backend person modal"
  );
  assert.match(
    siteStyles,
    /\.traveler-details-card__grid \{[\s\S]*gap: 0\.85rem 1rem;[\s\S]*align-items: start;[\s\S]*\.traveler-details-card__grid \.field \{[\s\S]*align-content: start;[\s\S]*\.traveler-details-document__checkbox--placeholder \{[\s\S]*visibility: hidden;[\s\S]*\.traveler-details-document__checkbox-wrap \{[\s\S]*margin-top: 10px;[\s\S]*min-height: 1\.75rem;[\s\S]*\.traveler-details-actions \{[\s\S]*justify-content: flex-start;/,
    "Public traveler-details page should keep document fields top-aligned, reserve a stable checkbox slot below the expiry field, and left-align the submit action"
  );
  assert.match(
    siteStyles,
    /\.traveler-details-document__title \{[\s\S]*min-height: 1\.5rem;/,
    "Public traveler-details page should preserve section spacing even when the document titles are visually removed"
  );
});

test("booking person modal exposes separate passport and ID card document image uploads", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const personsScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "persons.js");
  const bookingStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking.css");
  const bookingPageSource = await readFile(bookingPagePath, "utf8");
  const personsSource = await readFile(personsScriptPath, "utf8");
  const bookingStyles = await readFile(bookingStylesPath, "utf8");

  assert.match(
    bookingPageSource,
    /booking_person_modal_passport_picture_upload_btn[\s\S]*booking_person_modal_passport_picture_input[\s\S]*booking_person_modal_national_id_picture_upload_btn[\s\S]*booking_person_modal_national_id_picture_input/,
    "Booking person modal should expose separate upload controls for passport and ID card images"
  );
  assert.match(
    bookingPageSource,
    /booking_person_modal_date_of_birth[\s\S]*booking_person_modal_gender[\s\S]*booking_person_modal_nationality/,
    "Booking person modal should place the gender selector alongside date of birth and nationality"
  );
  assert.match(
    personsSource,
    /bookingPersonDocumentPictureRequest[\s\S]*\[\s*"passport",\s*"national_id"\s*\][\s\S]*data-document-picture-upload/,
    "Booking persons module should upload document images through the dedicated booking person document-picture endpoint"
  );
  assert.match(
    personsSource,
    /BOOKING_PERSON_GENDER_OPTIONS[\s\S]*"male"[\s\S]*"female"[\s\S]*"other"[\s\S]*"prefer_not_to_say"[\s\S]*function renderPersonGenderOptions\(/,
    "Booking persons module should render and persist the booking-person gender enum through the modal draft"
  );
  assert.ok(
    personsSource.includes('booking.gender.placeholder'),
    "Booking persons module should use the gender placeholder translation key"
  );
  assert.ok(
    personsSource.includes('els.personModalGender.innerHTML = renderPersonGenderOptions(draft.gender);')
    && personsSource.includes('els.personModalGender.value = normalizePersonGender(draft.gender) || "";'),
    "Booking persons module should bind the gender selector into the person modal"
  );
  assert.ok(
    personsSource.includes('gender: normalizePersonGender(person.gender),')
    && personsSource.includes('gender: normalizePersonGender(draft?.gender) || undefined,'),
    "Booking persons module should normalize gender on draft load and include it in the persisted person payload"
  );
  assert.match(
    personsSource,
    /const VIETNAM_COUNTRY_CODE = "VN";[\s\S]*function personSupportsNationalId\(draft\) \{[\s\S]*normalizeText\(draft\?\.nationality\)\.toUpperCase\(\) === VIETNAM_COUNTRY_CODE[\s\S]*function resolveActivePersonDocumentType\([\s\S]*personSupportsNationalId\(draft\)[\s\S]*"national_id"[\s\S]*button\.hidden = !isSupported;/,
    "Booking person modal should only expose the ID-card switch when the traveler's nationality is Vietnam"
  );
  assert.match(
    bookingStyles,
    /\.booking-person-modal__document-picture-preview \{[\s\S]*min-height: 180px;[\s\S]*border: 1px dashed var\(--line-cool-alpha\);/,
    "Booking person modal should style the document image preview area as a dedicated upload surface"
  );
});

test("person document payloads preserve stored timestamps so the persons section stays clean after load", async () => {
  const personHelpersPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "person_helpers.js");
  const personHelpersSource = await readFile(personHelpersPath, "utf8");

  assert.match(
    personHelpersSource,
    /function buildDocumentPayloadFromDraft[\s\S]*created_at: normalizeText\(normalized\.created_at\) \|\| timestamp,[\s\S]*updated_at: normalizeText\(normalized\.updated_at\) \|\| normalizeText\(normalized\.created_at\) \|\| timestamp/,
    "Person document payload serialization should preserve stored timestamps instead of generating a new updated_at value on every snapshot"
  );
});

test("booking persons snapshot logic uses a stable timestamp seed instead of generating fresh timestamps on load", async () => {
  const personsPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "persons.js");
  const personsSource = await readFile(personsPath, "utf8");

  assert.match(
    personsSource,
    /function resolveStablePersonTimestamp\(booking = state\.booking\)\s*\{[\s\S]*booking\?\.updated_at[\s\S]*booking\?\.created_at[\s\S]*DEFAULT_PERSON_TIMESTAMP[\s\S]*\}/,
    "Booking persons snapshots should derive fallback timestamps from stable booking metadata"
  );
  assert.match(
    personsSource,
    /function normalizePersonConsentRecord\([\s\S]*const timestamp = normalizeText\(fallbackTimestamp\) \|\| DEFAULT_PERSON_TIMESTAMP;/,
    "Consent normalization should reuse a stable fallback timestamp instead of new Date() during snapshot comparisons"
  );
  assert.match(
    personsSource,
    /function buildPersonPayloadFromDraft\([\s\S]*const timestampSeed = normalizeText\(options\?\.timestampSeed\) \|\| resolveStablePersonTimestamp\(options\?\.booking\);[\s\S]*buildPersonConsentPayloads\([\s\S]*timestampSeed[\s\S]*buildDocumentPayloadFromDraft\(\{[\s\S]*created_at: normalizeText\(document\?\.created_at\) \|\| timestampSeed,[\s\S]*updated_at: normalizeText\(document\?\.updated_at\) \|\| normalizeText\(document\?\.created_at\) \|\| timestampSeed/,
    "Person payload serialization should feed a stable timestamp seed into consent and document payloads"
  );
});

test("booking person gender enum stays in sync across model and generated contracts", async () => {
  const modelEnumPath = path.resolve(__dirname, "..", "..", "..", "model", "enums", "booking_person_gender.cue");
  const modelEntityPath = path.resolve(__dirname, "..", "..", "..", "model", "database", "booking_person.cue");
  const normalizedIrPath = path.resolve(__dirname, "..", "..", "..", "model", "ir", "normalized.cue");
  const openapiPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "openapi.yaml");
  const schemaRuntimePath = path.resolve(__dirname, "..", "..", "..", "shared", "generated-contract", "Models", "generated_SchemaRuntime.js");
  const generatedBookingPath = path.resolve(__dirname, "..", "..", "..", "shared", "generated-contract", "Models", "generated_Booking.js");
  const modelEnum = await readFile(modelEnumPath, "utf8");
  const modelEntity = await readFile(modelEntityPath, "utf8");
  const normalizedIr = await readFile(normalizedIrPath, "utf8");
  const openapi = await readFile(openapiPath, "utf8");
  const schemaRuntime = await readFile(schemaRuntimePath, "utf8");
  const generatedBooking = await readFile(generatedBookingPath, "utf8");

  assert.match(
    modelEnum,
    /BookingPersonGenderCatalog:\s*\[[\s\S]*"male"[\s\S]*"female"[\s\S]*"other"[\s\S]*"prefer_not_to_say"[\s\S]*#BookingPersonGender: or\(BookingPersonGenderCatalog\)/,
    "Model should define the BookingPersonGender enum catalog"
  );
  assert.match(
    modelEntity,
    /date_of_birth\?:\s+common\.\#DateOnly[\s\S]*gender\?:\s+enums\.\#BookingPersonGender[\s\S]*nationality\?:\s+enums\.\#CountryCode/,
    "BookingPerson entity should include the gender enum between date of birth and nationality"
  );
  assert.match(
    normalizedIr,
    /BookingPersonGender: \{catalog: "bookingPersonGenders"\}[\s\S]*\{name: "gender", kind: "enum", typeName: "BookingPersonGender", required: false\}/,
    "Normalized IR should expose BookingPersonGender and the BookingPerson.gender field"
  );
  assert.match(
    openapi,
    /BookingPersonGender:[\s\S]*enum:[\s\S]*- male[\s\S]*- female[\s\S]*- other[\s\S]*- prefer_not_to_say[\s\S]*BookingPerson:[\s\S]*gender:[\s\S]*"\$ref": "#\/components\/schemas\/BookingPersonGender"/,
    "OpenAPI should expose the BookingPersonGender enum and the BookingPerson.gender property"
  );
  assert.match(
    schemaRuntime,
    /"typeName": "BookingPersonGender"[\s\S]*"male"[\s\S]*"female"[\s\S]*"other"[\s\S]*"prefer_not_to_say"/,
    "Generated schema runtime should expose BookingPersonGender as a shared enum field"
  );
  assert.match(
    generatedBooking,
    /schemaField\(\{"name":"date_of_birth"[\s\S]*schemaField\(\{"name":"gender","required":false,"wireName":"gender"\}, SHARED_FIELD_DEFS\.FIELD_\d+\)[\s\S]*schemaField\(\{"name":"nationality"/,
    "Generated booking schema should include the gender field in BookingPerson"
  );
});

test("booking persons section summary shows traveler count with traveler names", async () => {
  const personsScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "persons.js");
  const personsSource = await readFile(personsScriptPath, "utf8");

  assert.match(
    personsSource,
    /function renderPersonsSectionSummary\(target, travelerCount\) \{[\s\S]*getAbbreviatedPersonName\(name\)[\s\S]*booking\.persons\.traveling_summary_one[\s\S]*people: travelerNames \|\| bookingT\("booking\.persons\.this_person", "this person"\)/,
    "Booking persons section summary should render traveler names inside the localized summary title"
  );
  assert.doesNotMatch(
    personsSource,
    /function renderPersonsSectionSummary\(target, travelerCount\) \{[\s\S]*booking-persons-summary__passport[\s\S]*\}/,
    "Booking persons section summary should no longer render the passport subtitle"
  );
});

test("booking page scrolls across the full main-content section while keeping the sticky control bar layout", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking.css");
  const bookingSource = await readFile(bookingPagePath, "utf8");
  const bookingStyles = await readFile(bookingStylesPath, "utf8");

  assert.match(
    bookingSource,
    /class="booking-detail-page__scroll"/,
    "Booking markup should wrap everything below the sticky bar in a dedicated scroll region"
  );
  assert.match(
    bookingSource,
    /class="booking-detail-page__bar-top-gap"/,
    "Booking markup should include a dedicated top gap element above the sticky control bar"
  );
  assert.match(
    bookingSource,
    /class="booking-detail-page__bar-gap"/,
    "Booking markup should include a dedicated gap element below the sticky control bar"
  );
  assert.doesNotMatch(
    bookingSource,
    /id="generate_offer_dirty_hint"|booking-generated-offers-actions__hint/,
    "The booking page should no longer render the removed standalone generated-offer dirty hint"
  );
  assert.match(
    bookingStyles,
    /\.booking-detail-page \{\s*[\s\S]*height: 100dvh;[\s\S]*overflow-x: hidden;[\s\S]*overflow-y: hidden;[\s\S]*grid-template-rows: auto minmax\(0, 1fr\);/,
    "The booking page should lock the viewport and reserve the remaining height for the main content section"
  );
  assert.match(
    bookingStyles,
    /\.booking-detail-page #main-content > \.section \{\s*[\s\S]*display: grid;[\s\S]*grid-template-rows: auto auto auto minmax\(0, 1fr\);[\s\S]*overflow: hidden;[\s\S]*padding: 0 0 1rem;/,
    "The booking section should reserve dedicated non-scrolling rows above a scrollable content track"
  );
  assert.match(
    bookingStyles,
    /\.booking-detail-page \.section > \.container \{\s*[\s\S]*display: contents;/,
    "The booking container should flatten into the section grid so the dirty-bar row stays outside the scroll track"
  );
  assert.match(
    bookingStyles,
    /\.booking-detail-page \.booking-detail-page__bar-top-gap \{\s*[\s\S]*height: 1rem;/,
    "The booking page should render a fixed 1rem gap above the sticky control bar"
  );
  assert.match(
    bookingStyles,
    /\.booking-detail-page \.booking-detail-page__bar-gap \{\s*[\s\S]*height: 1rem;/,
    "The booking page should render a fixed 1rem gap below the sticky control bar"
  );
  assert.match(
    bookingStyles,
    /\.booking-detail-page \.booking-detail-page__scroll \{\s*[\s\S]*overflow: auto;[\s\S]*overscroll-behavior: contain;[\s\S]*-ms-overflow-style: none;[\s\S]*scrollbar-width: none;[\s\S]*padding: 0 0 2rem;/,
    "The booking content track should scroll while the dirty-bar row stays outside that scroll region"
  );
  assert.match(
    bookingStyles,
    /\.booking-detail-page \.booking-detail-page__scroll::\-webkit\-scrollbar \{\s*[\s\S]*display: none;/,
    "The booking content scroll track should hide WebKit scrollbars"
  );
  assert.match(
    bookingStyles,
    /\.booking-detail-page :is\(\.booking-dirty-bar-row, \.booking-page-shell\) \{\s*[\s\S]*width: min\(100%, 1080px\);[\s\S]*margin-inline: auto;/,
    "The dirty-bar row and booking content should stay centered within the shared detail-page width"
  );
  assert.doesNotMatch(
    bookingStyles,
    /\.booking-detail-page \.booking-generated-offers-actions(?:__hint)? \{/,
    "The booking page styles should no longer keep dead standalone generated-offer action styles"
  );
});

test("booking page uses the dirty bar as the only red dirty-state surface", async () => {
  const bookingPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const dirtyBarControllerPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "booking_style_dirty_bar.js");
  const bookingStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking.css");
  const [bookingSource, dirtyBarControllerSource, bookingStyles] = await Promise.all([
    readFile(bookingPageScriptPath, "utf8"),
    readFile(dirtyBarControllerPath, "utf8"),
    readFile(bookingStylesPath, "utf8")
  ]);

  assert.doesNotMatch(
    bookingSource,
    /setDirtySurface\(/,
    "Booking sections should no longer be painted as red dirty surfaces"
  );
  assert.match(
    dirtyBarControllerSource,
    /dirtyBar\.classList\.toggle\("booking-dirty-bar--dirty", isDirty\);/,
    "The page-level dirty bar should only use the red dirty state for unsaved edits"
  );
  assert.match(
    bookingStyles,
    /\.booking-detail-page \.booking-dirty-bar\.booking-dirty-bar--dirty \{/,
    "Booking styles should define a dedicated dirty-state background for the page-level dirty bar"
  );
  assert.match(
    bookingStyles,
    /\.booking-detail-page \.booking-text-field--internal:focus-visible,[\s\S]*\.booking-detail-page \.field textarea\.booking-text-field--internal:focus-visible \{[\s\S]*outline: 0;[\s\S]*border-color: var\(--text-muted-strong\);[\s\S]*box-shadow: inset 0 0 0 1px var\(--text-muted-strong\);/,
    "Booking-page ATP-internal fields should use a gray focused border that stays inside the field bounds"
  );
});

test("booking and marketing-tour translation collapsibles expose incomplete state and clean dirty-bar pills", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const bookingTravelPlanModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "travel_plan_editor_core.js");
  const tourPageHtmlPath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "marketing_tour.html");
  const tourPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tour.js");
  const collapsibleStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "components", "backend-collapsible.css");
  const bookingStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking.css");
  const englishTranslationsPath = path.resolve(__dirname, "..", "..", "..", "frontend", "data", "i18n", "backend", "en.json");
  const [
    bookingPageSource,
    bookingScriptSource,
    bookingTravelPlanSource,
    tourPageSource,
    tourScriptSource,
    collapsibleStyles,
    bookingStyles,
    englishTranslations
  ] = await Promise.all([
    readFile(bookingPagePath, "utf8"),
    readFile(bookingPageScriptPath, "utf8"),
    readFile(bookingTravelPlanModulePath, "utf8"),
    readFile(tourPageHtmlPath, "utf8"),
    readFile(tourPageScriptPath, "utf8"),
    readFile(collapsibleStylesPath, "utf8"),
    readFile(bookingStylesPath, "utf8"),
    readFile(englishTranslationsPath, "utf8")
  ]);

  assert.match(
    bookingPageSource,
    /id="travel_plan_translation_summary"[\s\S]*data-translation-summary-title data-i18n-id="booking\.translation\.section_title">Translations/,
    "Booking translation summary should expose a stable title mount with the complete-state label"
  );
  assert.match(
    tourPageSource,
    /id="tour_travel_plan_translation_summary"[\s\S]*data-translation-summary-title data-i18n-id="tour\.travel_plan_translation\.section_title">Translations/,
    "Marketing-tour translation summary should expose the same complete-state label"
  );
  assert.match(
    tourPageSource,
    /id="tour_dirty_bar_title"[\s\S]*id="tour_dirty_bar_summary"/,
    "Marketing-tour dirty bar should expose a visible copy area for translation notices"
  );
  assert.match(
    bookingScriptSource,
    /travel_plan_translation_summary: document\.getElementById\("travel_plan_translation_summary"\)/,
    "Booking page should wire the translation summary button"
  );
  assert.match(
    tourScriptSource,
    /travelPlanTranslationSummary: document\.getElementById\("tour_travel_plan_translation_summary"\)/,
    "Marketing-tour page should wire the translation summary button"
  );
  assert.match(
    bookingTravelPlanSource,
    /function setTravelPlanTranslationSummaryState\(isIncomplete\)[\s\S]*updatePageDirtyBar\(\)[\s\S]*booking\.translation\.section_title_incomplete[\s\S]*Translation: incomplete[\s\S]*booking-section__summary--translation-incomplete[\s\S]*setTravelPlanTranslationSummaryState\(isTranslationIncompleteStatus\(summary\.status\)\)/,
    "Booking travel-plan translation review should mark incomplete translations in the collapsible title and dirty bar"
  );
  assert.match(
    bookingScriptSource,
    /function dirtyBarNoticeLabels\(\)[\s\S]*hasIncompleteTravelPlanTranslation[\s\S]*booking\.translation\.section_title_incomplete/,
    "Booking dirty bar should include the incomplete translation notice"
  );
  assert.match(
    tourScriptSource,
    /TRAVEL_PLAN_TRANSLATION_INCOMPLETE_STATUSES = new Set\(\["missing", "partial", "stale"\]\)[\s\S]*function renderTourDirtyBar\(\)[\s\S]*booking-dirty-bar--dirty", isDirty\)[\s\S]*booking-dirty-bar__notice-pill[\s\S]*tour\.travel_plan_translation\.section_title_incomplete[\s\S]*summaries\.some\(\(\{ summary \}\) => isTravelPlanTranslationIncompleteStatus\(summary\.status\)\)/,
    "Marketing-tour translation review should mark missing, partial, and stale translations as incomplete without making the dirty bar red by itself"
  );
  assert.match(
    tourScriptSource,
    /function travelPlanTranslationStatus\(plan, targetLang\)[\s\S]*const hasSourceHash = Boolean\(normalizeText\(meta\?\.source_hash\)\);[\s\S]*const stale = translatedFields > 0 && \([\s\S]*hasSourceHash && meta\.source_hash !== sourceHash[\s\S]*!hasSourceHash && targetLang !== TRAVEL_PLAN_SOURCE_LANG/,
    "Marketing-tour Translate should treat translated travel-plan content without source metadata as outdated instead of skipping it"
  );
  assert.match(
    collapsibleStyles,
    /\.booking-section__summary--translation-incomplete \{[\s\S]*border: 1\.5px solid #ff6f55;[\s\S]*background: rgba\(255, 240, 236, 0\.98\);[\s\S]*box-shadow: 0 0 0 1px rgba\(255, 111, 85, 0\.14\);[\s\S]*color: var\(--error-text-strong\);/,
    "Incomplete translation summaries should reuse the dirty-bar red treatment"
  );
  assert.match(
    bookingStyles,
    /\.booking-detail-page \.booking-dirty-bar__notice-pill \{[\s\S]*border-radius: 999px;[\s\S]*background: rgba\(255, 240, 236, 0\.98\);[\s\S]*color: var\(--error-text-strong\);[\s\S]*padding: 0\.18rem 0\.48rem;/,
    "Incomplete translation dirty-bar notices should render as light-red pills"
  );
  assert.match(
    englishTranslations,
    /"booking\.translation\.section_title": "Translations"[\s\S]*"booking\.translation\.section_title_incomplete": "Translation: incomplete"[\s\S]*"tour\.travel_plan_translation\.section_title": "Translations"[\s\S]*"tour\.travel_plan_translation\.section_title_incomplete": "Translation: incomplete"/,
    "Backend i18n should define the complete and incomplete translation titles"
  );
});

test("booking dirty bar stays visible while clean and reports save or discard progress", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const dirtyBarControllerPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "booking_style_dirty_bar.js");
  const [bookingPageSource, bookingSource, dirtyBarControllerSource] = await Promise.all([
    readFile(bookingPagePath, "utf8"),
    readFile(bookingPageScriptPath, "utf8"),
    readFile(dirtyBarControllerPath, "utf8")
  ]);

  assert.match(
    dirtyBarControllerSource,
    /els\.dirtyBar\.hidden = false;/,
    "The sticky dirty bar should stay visible even when there are no unsaved edits"
  );
  assert.match(
    dirtyBarControllerSource,
    /const isBusy = isSaving \|\| isDiscarding;[\s\S]*?els\.saveEditsBtn\.disabled = isBusy \|\| !isDirty;[\s\S]*?els\.discardEditsBtn\.disabled = isBusy \|\| !isDirty;/,
    "Both dirty-bar buttons should be disabled while the page is clean or busy"
  );
  assert.match(
    dirtyBarControllerSource,
    /backendT\("booking\.page_save\.saving", "Saving edits\.\.\."\)[\s\S]*backendT\("booking\.page_discard\.running", "Discarding edits\.\.\."\)[\s\S]*backendT\("booking\.page_save\.saved", "All edits saved"\)[\s\S]*backendT\("booking\.page_discard\.saved", "All edits reverted"\)/,
    "The dirty bar should expose explicit save and discard progress and completion text"
  );
  assert.match(
    dirtyBarControllerSource,
    /const summaryParts = \[\];[\s\S]*if \(isDirty\) \{[\s\S]*booking\.page_save\.summary[\s\S]*document\.createElement\("span"\)[\s\S]*booking-dirty-bar__notice-pill/,
    "The dirty-bar summary should show changed sections and non-dirty notices as pills without repeating the title"
  );
  assert.match(
    bookingPageSource,
    /id="booking_dirty_bar_summary"><\/span>/,
    "The booking page should not seed a duplicate clean-state summary in the initial markup"
  );
  assert.match(
    bookingPageSource,
    /id="booking_save_error_hint"/,
    "The booking page should expose a dedicated save-error hint beside the page save button"
  );
  assert.match(
    bookingSource,
    /saveErrorHint: document\.getElementById\("booking_save_error_hint"\)/,
    "The booking page should wire the dedicated save-error hint element"
  );
});

test("booking page orders the visible sections in the requested workflow sequence", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingPageSource = await readFile(bookingPagePath, "utf8");
  const orderedIds = [
    "booking_actions_panel",
    "booking_note_panel",
    "travel_plan_panel",
    "persons_editor_panel",
    "offer_panel",
    "offer_payment_terms_panel",
    "payments_workspace",
    "activities_panel",
    "booking_data_view"
  ];
  const positions = orderedIds.map((id) => bookingPageSource.indexOf(`id="${id}"`));

  positions.forEach((position, index) => {
    assert.notStrictEqual(
      position,
      -1,
      `Booking page should contain ${orderedIds[index]}`
    );
  });

  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(
      positions[index] > positions[index - 1],
      `${orderedIds[index - 1]} should appear before ${orderedIds[index]}`
    );
  }
});

test("booking page removes the standalone proposal PDFs section", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingPageSource = await readFile(bookingPagePath, "utf8");

  assert.doesNotMatch(
    bookingPageSource,
    /id="booking_confirmation_panel"|id="booking_confirmation_panel_summary"|id="generated_offers_table"|id="generate_offer_btn"/,
    "Proposal PDFs should no longer render as a standalone booking section"
  );
});

test("payments use a shared workspace root for payment-step sections only", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingPageSource = await readFile(bookingPagePath, "utf8");

  assert.match(
    bookingPageSource,
    /id="payments_workspace"[\s\S]*id="payment_flow_sections"/,
    "Payments should keep the shared workspace root for payment-step sections"
  );
  assert.doesNotMatch(
    bookingPageSource,
    /id="pricing_panel"|id="pricing_panel_summary"|id="pricing_summary_table"|id="pricing_adjustments_table"|id="pricing_payments_table"/,
    "Payments should no longer render a standalone pricing summary section"
  );
});

test("payments removes the standalone payment-document panel and renders request/receipt subsections per payment", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const paymentFlowPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "payment_flow.js");
  const [bookingPageSource, paymentFlowSource] = await Promise.all([
    readFile(bookingPagePath, "utf8"),
    readFile(paymentFlowPath, "utf8")
  ]);

  assert.doesNotMatch(
    bookingPageSource,
    /id="invoice_panel"/,
    "The old standalone payment-document editor should be removed from the Payments section"
  );
  assert.match(
    bookingPageSource,
    /id="payments_workspace"[\s\S]*id="payment_flow_sections"/,
    "Payments should expose a dedicated per-payment flow container outside the pricing summary section"
  );
  assert.match(
    paymentFlowSource,
    /function paymentStageMarkup[\s\S]*class="booking-section booking-payment-step-panel"[\s\S]*PAYMENT_DOCUMENT_KIND_REQUEST/,
    "The payment-flow module should render each payment as its own booking section with a payment-request subsection"
  );
  assert.doesNotMatch(
    paymentFlowSource,
    /function paymentStageMarkup[\s\S]*class="booking-section booking-payment-step-panel is-open"/,
    "Payment-step panels should start collapsed instead of rendering open by default"
  );
  assert.match(
    paymentFlowSource,
    /function paymentStageMarkup[\s\S]*PAYMENT_DOCUMENT_KIND_CONFIRMATION/,
    "The payment-flow module should render a dedicated customer-receipt subsection inside each payment section"
  );
  assert.match(
    paymentFlowSource,
    /booking-payment-receipt__amount-display[\s\S]*data-payment-received-at[\s\S]*data-payment-confirmed-by[\s\S]*data-payment-reference/,
    "The payment-flow module should render a display-only received amount plus the receipt detail controls inside each payment section"
  );
  assert.match(
    paymentFlowSource,
    /const hasAnyValue = Boolean\(\s*receivedAt\s*\|\|\s*confirmedByAtpStaffId\s*\|\|\s*reference\s*\);/,
    "Receipt validation should only treat actual receipt-detail fields as proof that receipt details were entered"
  );
});

test("payment pdf creation blocks until offer payment terms are saved and derives payments from current terms", async () => {
  const paymentFlowPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "payment_flow.js");
  const paymentFlowSource = await readFile(paymentFlowPath, "utf8");
  assert.match(
    paymentFlowSource,
    /function hasPendingOfferChanges\(\) \{[\s\S]*state\.dirty\.offer \|\| state\.dirty\.payment_terms/,
    "Payment PDF creation should block until the offer and payment terms are saved"
  );
  assert.match(
    paymentFlowSource,
    /function persistedPaymentById\(paymentId\) \{[\s\S]*currentPaymentLines\(\)\.find/,
    "Payment PDF creation should derive selectable payments directly from the current payment-term lines"
  );
});

test("payment pdf previews stream transient preview files instead of storing payment documents", async () => {
  const paymentFlowPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "payment_flow.js");
  const paymentDocumentHandlerPath = path.resolve(__dirname, "..", "src", "http", "handlers", "booking_payment_documents.js");
  const paymentDocumentPdfPath = path.resolve(__dirname, "..", "src", "lib", "payment_document_pdf.js");
  const [paymentFlowSource, paymentDocumentHandlerSource, paymentDocumentPdfSource] = await Promise.all([
    readFile(paymentFlowPath, "utf8"),
    readFile(paymentDocumentHandlerPath, "utf8"),
    readFile(paymentDocumentPdfPath, "utf8")
  ]);
  assert.match(
    paymentFlowSource,
    /query:\s*\{[\s\S]*preview:\s*"1"[\s\S]*\}[\s\S]*await previewLinkedPaymentDocument\(/,
    "Payment-flow preview should call the payment-document create route in preview mode instead of creating a stored payment document"
  );
  assert.match(
    paymentDocumentHandlerSource,
    /function requestPreviewMode\(req\) \{[\s\S]*searchParams\.get\("preview"\) === "1"[\s\S]*paymentDocumentPreviewTempOutputPath[\s\S]*sendFileWithCache[\s\S]*await rm\(renderedPath, \{ force: true \}\)/,
    "Payment-document handler should render preview PDFs through a temp file path and delete the preview file after streaming it"
  );
  assert.match(
    paymentDocumentPdfSource,
    /function drawPreviewWatermark\(doc, fonts, text = "Preview"\)[\s\S]*drawPreviewWatermark\(doc, fonts, previewWatermarkText\)/,
    "Payment-document preview PDFs should watermark each page"
  );
  assert.match(
    paymentDocumentHandlerSource,
    /document_number:\s*preview \? "PREVIEW" :/,
    "Payment-document preview PDFs should render PREVIEW as the document number"
  );
});

test("deposit payment requests use a dedicated personalization scope and friendly deposit copy", async () => {
  const bookingModelPath = path.resolve(__dirname, "..", "..", "..", "model", "database", "booking.cue");
  const paymentFlowPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "payment_flow.js");
  const personalizationPath = path.resolve(__dirname, "..", "src", "lib", "booking_pdf_personalization.js");
  const paymentDocumentHandlerPath = path.resolve(__dirname, "..", "src", "http", "handlers", "booking_payment_documents.js");
  const paymentDocumentPdfPath = path.resolve(__dirname, "..", "src", "lib", "payment_document_pdf.js");
  const [bookingModelSource, paymentFlowSource, personalizationSource, paymentDocumentHandlerSource, paymentDocumentPdfSource] = await Promise.all([
    readFile(bookingModelPath, "utf8"),
    readFile(paymentFlowPath, "utf8"),
    readFile(personalizationPath, "utf8"),
    readFile(paymentDocumentHandlerPath, "utf8"),
    readFile(paymentDocumentPdfPath, "utf8")
  ]);
  assert.match(
    bookingModelSource,
    /payment_request_deposit\?:\s+#BookingPdfPersonalizationScoped/,
    "Booking PDF personalization should model a dedicated deposit payment-request scope"
  );
  assert.match(
    paymentFlowSource,
    /payment_request_deposit: Object\.freeze\([\s\S]*Deposit request welcome[\s\S]*if \(kind === "DEPOSIT"\) return "payment_request_deposit";/,
    "Deposit request PDFs should use a dedicated payment_request_deposit personalization scope in the payment-flow UI"
  );
  assert.match(
    personalizationSource,
    /payment_request_deposit: Object\.freeze\([\s\S]*welcome:[\s\S]*closing:/,
    "Booking PDF personalization should normalize a dedicated deposit request branch"
  );
  assert.match(
    paymentDocumentHandlerSource,
    /documentKind === "PAYMENT_REQUEST" && paymentKind === "DEPOSIT"[\s\S]*"We would be thrilled if you book this tour with us\. Please pay the deposit to confirm your booking"/,
    "Deposit request documents should resolve a dedicated scope and the friendly deposit-request intro copy"
  );
  assert.match(
    paymentDocumentPdfSource,
    /function isDepositPaymentRequestDocument\(document\)[\s\S]*drawDepositPaymentSchedule[\s\S]*Please find your travel plan at the end of this PDF\.[\s\S]*drawTravelPlanDaysSection/,
    "Deposit request PDFs should render a friendly first page and then continue with the travel plan section"
  );
});

test("payment document classification prefers accepted payment terms once a commercial snapshot exists", async () => {
  const paymentDocumentHandlerPath = path.resolve(__dirname, "..", "src", "http", "handlers", "booking_payment_documents.js");
  const financeHandlerPath = path.resolve(__dirname, "..", "src", "http", "handlers", "booking_finance.js");
  const paymentFlowPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "payment_flow.js");
  const [paymentDocumentHandlerSource, financeHandlerSource, paymentFlowSource] = await Promise.all([
    readFile(paymentDocumentHandlerPath, "utf8"),
    readFile(financeHandlerPath, "utf8"),
    readFile(paymentFlowPath, "utf8")
  ]);

  assert.match(
    paymentDocumentHandlerSource,
    /function bookingPaymentTerms\(booking\) \{[\s\S]*accepted_record\?\.payment_terms[\s\S]*accepted_payment_terms_snapshot[\s\S]*booking\?\.offer\?\.payment_terms/s,
    "Payment-linked documents should classify payment kinds from the accepted payment terms before the live offer"
  );
  assert.match(
    financeHandlerSource,
    /function bookingPaymentTerms\(booking\) \{[\s\S]*accepted_payment_terms_snapshot[\s\S]*booking\?\.offer\?\.payment_terms/s,
    "Receipt freezing should identify the deposit line from the accepted payment terms before the live offer"
  );
  assert.match(
    paymentFlowSource,
    /function currentOfferPaymentTerms\(\) \{[\s\S]*accepted_record\?\.payment_terms[\s\S]*accepted_payment_terms_snapshot[\s\S]*draftTerms[\s\S]*state\.booking\?\.offer\?\.payment_terms/s,
    "The payment-flow UI should classify payment rows from accepted payment terms before draft or live offer terms"
  );
});

test("saving proposal payment terms rerenders payment-step sections without a full page reload", async () => {
  const bookingPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const offerModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offers.js");
  const [bookingPageScriptSource, offerModuleSource] = await Promise.all([
    readFile(bookingPageScriptPath, "utf8"),
    readFile(offerModulePath, "utf8")
  ]);

  assert.match(
    bookingPageScriptSource,
    /const offerModule = createBookingOfferModule\(\{[\s\S]*renderPricingPanel,[\s\S]*\}\);/,
    "The booking page should give the offer module access to the payment-workspace renderer"
  );
  assert.match(
    offerModuleSource,
    /async function applyOfferBookingResponse[\s\S]*renderOfferPanel\(\);[\s\S]*renderPricingPanel\?\.\(\{ markDerivedChangesDirty: true \}\);/,
    "Saving the offer/payment plan should rerender payment-step sections and mark derived payment changes dirty without a page refresh"
  );
});

test("offer payment terms keep add-deposit and add-installment controls above final payment", async () => {
  const paymentTermsPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offer_payment_terms.js");
  const paymentTermsStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "site.css");
  const offerPricingPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offer_pricing.js");
  const paymentTermsSource = await readFile(paymentTermsPath, "utf8");
  const paymentTermsStylesSource = await readFile(paymentTermsStylesPath, "utf8");
  const offerPricingSource = await readFile(offerPricingPath, "utf8");

  assert.match(
    paymentTermsSource,
    /const editableRows = \[\s*depositRows \|\| renderOfferPaymentTermAddRow\("deposit",[\s\S]*installmentRows,[\s\S]*renderOfferPaymentTermAddRow\("installment",[\s\S]*\]\.filter\(Boolean\)\.join\(""\);/,
    "Editable payment terms should render add-deposit first, then add-installment, with final payment shown only in the summary"
  );
  assert.match(
    paymentTermsSource,
    /if \(action === "deposit"\) \{[\s\S]*const hasDeposit = currentLines\.some\(\(line\) => normalizeOfferPaymentTermKindValue\(line\?\.kind\) === "DEPOSIT"\);[\s\S]*if \(hasDeposit\) return;[\s\S]*nextLines\.splice\(0,\s*0,\s*createDefaultOfferPaymentDepositLine\(1\)\);/,
    "Adding a deposit should replace the add-deposit row with a single deposit line"
  );
  assert.match(
    paymentTermsSource,
    /\.filter\(\(line\) => normalizeOfferPaymentTermKindValue\(line\?\.kind\) !== "FINAL_BALANCE"\)/,
    "The table body should not render a duplicate final-payment line above the summary"
  );
  assert.doesNotMatch(
    paymentTermsSource,
    /data-offer-payment-term-kind=/,
    "Editable payment terms should not render a leftmost kind dropdown for deposit or installment rows"
  );
  assert.doesNotMatch(
    paymentTermsSource,
    /data-offer-payment-term-label=/,
    "Editable payment terms should render deposit and installment labels as plain text instead of editable fields"
  );
  assert.doesNotMatch(
    paymentTermsStylesSource,
    /\.backend-table \.offer-payment-term-col-label \{\s*width:/,
    "Payment-plan label column should not keep a fixed width that pushes the amount-mode dropdown too far right"
  );
  assert.match(
    paymentTermsStylesSource,
    /\.offer-payment-terms__due-editor \{\s*display: flex;[\s\S]*flex-wrap: nowrap;/,
    "Payment-plan due editors should keep the due-type dropdown and days input on the same row"
  );
  assert.match(
    paymentTermsSource,
    /function validateOfferPaymentTermsTotal\(paymentTerms = state\.offerDraft\?\.payment_terms\)[\s\S]*scheduledAmountCents[\s\S]*basisTotalAmountCents/,
    "Payment terms should expose a shared validator that detects deposits and installments exceeding the offer total"
  );
  assert.match(
    paymentTermsSource,
    /renderOfferPaymentTermsValidationMarkup\(validateOfferPaymentTermsTotal\(displayTerms\)\)/,
    "Payment-plan total validation should render its error message directly inside the payment plan section"
  );
  assert.match(
    offerPricingSource,
    /const paymentTermsTotalError = paymentTermsModule\.validateOfferPaymentTermsTotal\(paymentTermsDraft\);[\s\S]*throw new Error\(paymentTermsTotalError\);/,
    "Offer save should block when deposit and installment amounts exceed the offer total"
  );
});

test("payment-flow PDF editors reuse the shared booking PDF panel helpers and styles", async () => {
  const paymentFlowPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "payment_flow.js");
  const pdfPanelModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "pdf_personalization_panel.js");
  const pdfWorkspaceModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "pdf_workspace.js");
  const bookingStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking.css");
  const bookingTravelPlanStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking-travel-plan.css");
  const [paymentFlowSource, pdfPanelModuleSource, pdfWorkspaceModuleSource, bookingStylesSource, bookingTravelPlanStyles] = await Promise.all([
    readFile(paymentFlowPath, "utf8"),
    readFile(pdfPanelModulePath, "utf8"),
    readFile(pdfWorkspaceModulePath, "utf8"),
    readFile(bookingStylesPath, "utf8"),
    readFile(bookingTravelPlanStylesPath, "utf8")
  ]);

  assert.match(
    paymentFlowSource,
    /import\s*\{[\s\S]*buildBookingCollapsibleSectionMarkup,[\s\S]*buildBookingPdfToggleFieldMarkup[\s\S]*\}\s*from "\.\/pdf_personalization_panel\.js";/,
    "Payment-flow PDF sections should import the shared booking PDF panel builders"
  );
  assert.match(
    pdfPanelModuleSource,
    /export function buildBookingCollapsibleSectionMarkup\(/,
    "The shared PDF personalization module should export the shared collapsible-section builder"
  );
  assert.match(
    pdfPanelModuleSource,
    /export function buildBookingPdfToggleFieldMarkup\(/,
    "The shared PDF personalization module should export the shared toggle-field builder"
  );
  assert.match(
    paymentFlowSource,
    /function paymentDocumentPersonalizationPanelMarkup[\s\S]*buildBookingPdfToggleFieldMarkup\([\s\S]*buildBookingCollapsibleSectionMarkup\([\s\S]*bookingPdfPanel:\s*"travel_plan"/,
    "Payment-flow personalization panels should reuse the shared booking PDF field and section markup"
  );
  assert.doesNotMatch(
    paymentFlowSource,
    /function paymentDocumentPersonalizationPanelMarkup[\s\S]*className:\s*"is-open"/,
    "Payment-flow PDF texts should start collapsed like the Travel plan PDF personalization panel"
  );
  assert.match(
    paymentFlowSource,
    /import\s*\{[\s\S]*buildBookingPdfDocumentSectionMarkup,[\s\S]*buildBookingPdfWorkspaceMarkup[\s\S]*\}\s*from "\.\/pdf_workspace\.js";/,
    "Payment-flow PDF sections should import the shared workspace and section builders"
  );
  assert.match(
    pdfWorkspaceModuleSource,
    /export function buildBookingPdfDocumentSectionMarkup\(/,
    "The shared PDF workspace module should export the shared document-section builder"
  );
  assert.match(
    paymentFlowSource,
    /function paymentDocumentSectionMarkup[\s\S]*buildBookingPdfDocumentSectionMarkup\([\s\S]*paymentDocumentPersonalizationPanelMarkup[\s\S]*paymentDocumentWorkspaceMarkup/,
    "Payment-flow request and receipt wrappers should reuse the shared PDF document-section builder"
  );
  assert.match(
    paymentFlowSource,
    /function paymentConfirmationDisabledReason\([\s\S]*hasRecordedReceipt[\s\S]*Fill in Payment received before working with the Customer receipt PDF\./,
    "Customer receipt sections should stay disabled until the payment-received fields are complete"
  );
  assert.match(
    paymentFlowSource,
    /function paymentReceiptFieldValues\([\s\S]*const hasAnyValue = Boolean\([\s\S]*receivedAt[\s\S]*confirmedByAtpStaffId[\s\S]*reference[\s\S]*return \{[\s\S]*hasRecordedReceipt[\s\S]*received_at[\s\S]*confirmed_by_atp_staff_id[\s\S]*reference/,
    "Payment receipt parsing should only read receipt metadata fields from each payment section"
  );
  assert.match(
    paymentFlowSource,
    /id="payment_received_amount_\$\{escapeHtml\(paymentId\)\}"[\s\S]*class="booking-payment-receipt__amount-display"[\s\S]*aria-readonly="true"/,
    "The Payment received amount should render as a non-editable display value"
  );
  assert.match(
    bookingStylesSource,
    /\.booking-detail-page \.booking-payment-receipt__amount-display \{[\s\S]*color: var\(--text-muted-strong\);[\s\S]*font-weight: var\(--booking-font-weight-bold\);[\s\S]*pointer-events: none;/,
    "The Payment received amount display should stay bold, gray, and non-clickable"
  );
  assert.match(
    paymentFlowSource,
    /function createPaymentDocument[\s\S]*documentKind === PAYMENT_DOCUMENT_KIND_CONFIRMATION[\s\S]*paymentConfirmationDisabledReason\(payment\)[\s\S]*setPaymentSectionState\(paymentId, sectionKind, disabledReason, "info"\)/,
    "Customer receipt preview and create actions should short-circuit before posting when payment receipt data is incomplete"
  );
  assert.match(
    bookingTravelPlanStyles,
    /#travel_plan_pdf_panel \.booking-collapsible\[data-booking-pdf-panel="travel_plan"\],[\s\S]*\.booking-pdf-document-section \.booking-collapsible\[data-booking-pdf-panel="travel_plan"\] \{[\s\S]*background: var\(--travelplan_day_surface\);/,
    "Payment-flow PDF texts should reuse the Travel plan PDF personalization panel theme selectors"
  );
  assert.match(
    bookingStylesSource,
    /\.booking-detail-page \.booking-pdf-document-section\.is-disabled \{[\s\S]*background: rgba\(248, 250, 252, 0\.92\);/,
    "Disabled customer receipt sections should have a dedicated muted surface treatment"
  );
});

test("booking page removes the stage and milestone control layer", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingCorePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "core.js");
  const bookingPageSource = await readFile(bookingPagePath, "utf8");
  const bookingCoreSource = await readFile(bookingCorePath, "utf8");

  assert.doesNotMatch(
    bookingPageSource,
    /id="booking_stage_select"/,
    "Booking page should no longer expose a manual stage dropdown"
  );
  assert.doesNotMatch(
    bookingPageSource,
    /id="booking_milestone_actions"|id="booking_last_action_detail"|id="booking_flow_tracker"|id="booking_flow_next_step"|data-i18n-id="booking\.status_label"/,
    "Booking page should no longer render milestone buttons, last-action copy, or next-step tracking"
  );
  assert.doesNotMatch(
    bookingCoreSource,
    /bookingStageRequest|stageSelect|bookingMilestoneActionRequest|recordBookingMilestoneAction|milestone_action_key/,
    "Booking core should no longer persist stage or milestone actions from the booking page"
  );
  assert.match(
    bookingCoreSource,
    /function resolveAtpStaffDisplayName\(user, fallbackProfile = null\)[\s\S]*fallbackProfile\?\.full_name[\s\S]*user\?\.full_name[\s\S]*displayKeycloakUser\(user\)/,
    "Booking core should prefer booking-level ATP staff names before falling back to raw Keycloak display names"
  );
  assert.match(
    bookingCoreSource,
    /knownOwners\.values\(\)\]\.map\(\(user\) => `<option value="\$\{escapeHtml\(user\.id\)\}">\$\{escapeHtml\(resolveAtpStaffDisplayName\(user\) \|\| user\.id\)\}<\/option>`\)/,
    "Booking assignee options should render ATP staff full names in the booking owner dropdown"
  );
  assert.match(
    bookingCoreSource,
    /if \(selectedReferralStaffId && !knownReferralStaff\.has\(selectedReferralStaffId\)\) \{[\s\S]*knownReferralStaff\.set\(selectedReferralStaffId,[\s\S]*els\.referralStaffSelect\.value = selectedReferralStaffId;/,
    "Booking core should preserve the saved referral ATP-staff selection even when that user is missing from the loaded assignment directory"
  );
});

test("booking page records payment receipts through the payment-document payload", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const paymentFlowPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "payment_flow.js");
  const bookingPageSource = await readFile(bookingPagePath, "utf8");
  const paymentFlowSource = await readFile(paymentFlowPath, "utf8");

  assert.doesNotMatch(
    bookingPageSource,
    /id="pricing_deposit_controls"|id="pricing_deposit_received_at_input"|id="pricing_deposit_confirmed_by_select"|id="pricing_deposit_reference_input"/,
    "Payments should no longer expose a dedicated deposit-only receipt strip"
  );
  assert.match(
    paymentFlowSource,
    /function paymentReceiptFieldValues\(payment, \{ strict = true \} = \{\}\)[\s\S]*received_at[\s\S]*confirmed_by_atp_staff_id[\s\S]*reference/,
    "Payment-flow module should collect receipt details directly from each payment section"
  );
  assert.match(
    paymentFlowSource,
    /function paymentDocumentPayload\(payment, documentKind, pdfPersonalization, options = \{\}\) \{[\s\S]*expected_payment_documents_revision:[\s\S]*payment_received_at:[\s\S]*payment_confirmed_by_atp_staff_id:[\s\S]*payment_reference:/,
    "Payment document creation should send receipt details in the payment-document create payload"
  );
  assert.doesNotMatch(
    paymentFlowSource,
    /deposit_receipt|collectDepositReceiptPayload/,
    "Payment flow should no longer use the old deposit-receipt helper payload"
  );
});

test("payments no longer depend on the old flow-state helper module", async () => {
  const paymentFlowPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "payment_flow.js");
  const paymentFlowSource = await readFile(paymentFlowPath, "utf8");

  assert.doesNotMatch(
    paymentFlowSource,
    /payment_flow_state|derivePaymentFlowState|booking-flow-paid-group|summary_fully_paid/,
    "Payment flow should render payment sections directly without the old flow-state grouping logic"
  );
});

test("booking page top control row keeps staff and customer language visually aligned", async () => {
  const bookingStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking.css");
  const bookingStyles = await readFile(bookingStylesPath, "utf8");

  assert.match(
    bookingStyles,
    /#booking_actions_panel \.backend-controls \{\s*[\s\S]*align-items: start;/,
    "The booking top control row should align fields from the top so the labels share the same vertical position"
  );
  assert.match(
    bookingStyles,
    /#booking_actions_panel \.booking-content-language-field \{\s*[\s\S]*gap: 0\.35rem;/,
    "The booking customer-language field should use the same label-to-control gap as the neighboring fields"
  );
  assert.match(
    bookingStyles,
    /#booking_actions_panel \.lang-menu-trigger \{\s*[\s\S]*justify-content: center;[\s\S]*padding: 0\.68rem 0\.9rem;/,
    "The booking customer-language trigger should match the booking control height scale and center its contents"
  );
});

test("service titles remain optional across save validation and UI state", async () => {
  const travelPlanScriptPath = travelPlanEditorCorePath();
  const travelPlanValidationPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_validation.js");
  const bookingStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking.css");
  const travelPlanStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking-travel-plan.css");
  const travelPlanSource = await readFile(travelPlanScriptPath, "utf8");
  const validationSource = await readFile(travelPlanValidationPath, "utf8");
  const bookingStyles = await readFile(bookingStylesPath, "utf8");
  const travelPlanStyles = await readFile(travelPlanStylesPath, "utf8");

  assert.doesNotMatch(
    travelPlanSource,
    /travel-plan-service-title-input--required|item_title_action_error|syncTravelPlanRequiredTitleStates/,
    "Travel plan editing should not keep the old required-title error state or save hook"
  );
  assert.match(
    travelPlanSource,
    /booking\.travel_plan\.item_title[\s\S]*(booking\.travel_plan\.item_notes|booking\.travel_plan\.item_details)[\s\S]*booking\.travel_plan\.kind_label[\s\S]*(booking\.location|booking\.travel_plan\.location_optional)/,
    "Service editing should keep title and details ahead of kind and location in the service overview"
  );
  assert.doesNotMatch(
    validationSource,
    /item_title_required|Service title is required/,
    "Travel plan validation should not reject missing service titles"
  );
  assert.doesNotMatch(
    bookingStyles,
    /travel-plan-service-title-input--required/,
    "The booking page should not style travel plan titles as required"
  );
  assert.match(
    travelPlanStyles,
    /\.travel-plan-service__overview \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/,
    "Travel plan styles should keep the service fields and image editor in a balanced two-column layout"
  );
  assert.match(
    travelPlanStyles,
    /#travel_plan_panel \.booking-section__summary \{[\s\S]*font-weight: var\(--font-weight-bold\);[\s\S]*#travel_plan_panel :is\([\s\S]*\.travel-plan-day__head h3,[\s\S]*\.travel-plan-service__collapsed-title[\s\S]*\) \{[\s\S]*font-weight: var\(--font-weight-regular\);/,
    "The Travel plan section header should be bold while the day and service headings remain regular-weight"
  );
  assert.match(
    travelPlanStyles,
    /#travel_plan_panel \.travel-plan-service__body \{[\s\S]*font-weight: var\(--font-weight-regular\);[\s\S]*#travel_plan_panel \.travel-plan-service__body :is\([\s\S]*\.field label,[\s\S]*\.field \.field-label,[\s\S]*\.travel-plan-images__title-wrap h4,[\s\S]*\.travel-plan-links__head h4,[\s\S]*\.travel-plan-images__hero-remove,[\s\S]*\.travel-plan-coverage-badge[\s\S]*\) \{[\s\S]*font-weight: inherit;/,
    "Travel plan service contents should keep labels, titles, and badges at regular weight"
  );
});

test("travel-plan services are single-day only across model, API, backend, and UI", async () => {
  const modelPath = path.resolve(__dirname, "..", "..", "..", "model", "database", "travel_plan.cue");
  const travelPlanScriptPath = travelPlanEditorCorePath();
  const travelPlanHelpersPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_helpers.js");
  const travelPlanValidationPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_validation.js");
  const travelPlanDomainPath = path.resolve(__dirname, "..", "src", "domain", "travel_plan.js");
  const travelPlanStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking-travel-plan.css");
  const openApiPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "openapi.yaml");
  const generatedApiModelsPath = path.resolve(__dirname, "..", "..", "..", "shared", "generated-contract", "API", "generated_APIModels.js");
  const [
    modelSource,
    travelPlanSource,
    travelPlanHelpersSource,
    validationSource,
    domainSource,
    travelPlanStyles,
    openApiSource,
    generatedApiModelsSource
  ] = await Promise.all([
    readFile(modelPath, "utf8"),
    readFile(travelPlanScriptPath, "utf8"),
    readFile(travelPlanHelpersPath, "utf8"),
    readFile(travelPlanValidationPath, "utf8"),
    readFile(travelPlanDomainPath, "utf8"),
    readFile(travelPlanStylesPath, "utf8"),
    readFile(openApiPath, "utf8"),
    readFile(generatedApiModelsPath, "utf8")
  ]);

  assert.doesNotMatch(
    modelSource,
    /duration_days|accommodation_days/,
    "The travel-plan service model should no longer expose a multi-day duration field"
  );
  assert.doesNotMatch(
    openApiSource,
    /BookingTravelPlanService:[\s\S]*duration_days:/,
    "The generated OpenAPI schema should no longer expose service duration days"
  );
  assert.doesNotMatch(
    generatedApiModelsSource,
    /schemaField\(\{"name":"duration_days","required":false,"wireName":"duration_days"\}, SHARED_FIELD_DEFS\.FIELD_17\)/,
    "The generated API models should no longer include duration_days on BookingTravelPlanService"
  );
  assert.doesNotMatch(
    travelPlanHelpersSource,
    /duration_days|accommodation_days|resolveDurationDays|normalizeDurationDays/,
    "Travel-plan draft helpers should no longer normalize multi-day duration fields"
  );
  assert.doesNotMatch(
    domainSource,
    /duration_days|accommodation_days|resolveDurationDays|normalizeDurationDays/,
    "Backend travel-plan normalization should no longer persist service duration days"
  );
  assert.doesNotMatch(
    validationSource,
    /duration_days_invalid|Duration days must be between 1 and 100\./,
    "Travel-plan validation should no longer contain multi-day duration errors"
  );
  assert.doesNotMatch(
    travelPlanSource,
    /data-travel-plan-service-field="multi_day"|data-travel-plan-service-field="duration_days"|data-travel-plan-create-days=|createServiceSpanDays|syncDurationCreateDaysButtonStates|createGeneratedDayTitle|cloneTravelPlanServiceForGeneratedDay/,
    "Travel-plan editing should no longer expose the multi-day controls or Create days workflow"
  );
  assert.doesNotMatch(
    travelPlanStyles,
    /travel-plan-service__duration|travel-plan-service__create-days-btn|travel-plan-service__multi-day-toggle/,
    "Travel-plan styles should no longer reserve space for duration controls or Create days"
  );
});

test("travel plan images cap inline previews and open in a full-size modal", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const travelPlanScriptPath = travelPlanEditorCorePath();
  const travelPlanImagesModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_images.js");
  const coreModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "core.js");
  const travelPlanStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking-travel-plan.css");
  const bookingPageSource = await readFile(bookingPagePath, "utf8");
  const travelPlanSource = await readFile(travelPlanScriptPath, "utf8");
  const travelPlanImagesSource = await readFile(travelPlanImagesModulePath, "utf8");
  const coreSource = await readFile(coreModulePath, "utf8");
  const travelPlanStyles = await readFile(travelPlanStylesPath, "utf8");

  assert.match(
    bookingPageSource,
    /id="travel_plan_image_preview_modal"[\s\S]*id="travel_plan_image_preview_close_btn"[\s\S]*id="travel_plan_image_preview_image"/,
    "The booking page should include a dedicated modal for full-size travel plan image previews"
  );
  assert.match(
    travelPlanImagesSource,
    /class="travel-plan-images__hero-button"[\s\S]*data-travel-plan-add-image="[^"]*"[\s\S]*class="travel-plan-images__hero-image"/,
    "Travel plan services should render a single top-right hero image button for adding or replacing the service image"
  );
  assert.match(
    travelPlanImagesSource,
    /class="travel-plan-images__hero-remove"[\s\S]*data-travel-plan-remove-image="[^"]*"[\s\S]*data-travel-plan-day-id="[^"]*"[\s\S]*data-travel-plan-service-id="[^"]*"[\s\S]*data-requires-clean-state/,
    "Travel plan services should render a clean-state-gated remove action directly on the hero image frame"
  );
  assert.match(
    travelPlanImagesSource,
    /function openTravelPlanImagePreview\(src, alt = ""\)[\s\S]*modal\.hidden = false;[\s\S]*function bindTravelPlanImagePreviewModal\(\)[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);/,
    "The travel plan image module should manage opening and closing the preview modal"
  );
  assert.match(
    coreSource,
    /if \(els\.travelPlanImagePreviewModal\?\.hidden === false\) return;/,
    "Booking-level Escape handling should not close the booking while the travel plan image preview is open"
  );
  assert.match(
    travelPlanStyles,
    /\.travel-plan-images__hero-frame \{[\s\S]*width: min\(100%, 18rem\);[\s\S]*\.travel-plan-images__hero-button \{[\s\S]*width: 100%;[\s\S]*aspect-ratio: 1 \/ 1;[\s\S]*\.travel-plan-images__hero-image \{[\s\S]*width: 100%;[\s\S]*height: 100%;[\s\S]*object-fit: contain;/,
    "The travel plan hero image should use a single fixed frame and contain-fit the uploaded image without cropping"
  );
  assert.doesNotMatch(
    travelPlanImagesSource,
    /travel-plan-images__list|travel-plan-image-card__preview/,
    "Travel plan services should no longer render a duplicate image card or primary badge row beneath the hero image"
  );
  assert.match(
    travelPlanStyles,
    /\.travel-plan-image-preview-modal__image \{[\s\S]*max-width:[\s\S]*max-height:/,
    "The full-size preview modal should render the clicked image in an unconstrained overlay view"
  );
});

test("travel plan footer exposes clean-state-gated preview and create actions backed by dedicated contract pdf endpoints", async () => {
  const travelPlanScriptPath = travelPlanEditorCorePath();
  const bookingPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const bookingTravelPlanStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking-travel-plan.css");
  const openApiPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "openapi.yaml");
  const [travelPlanSource, bookingPageSource, bookingTravelPlanStyles] = await Promise.all([
    readFile(travelPlanScriptPath, "utf8"),
    readFile(bookingPageScriptPath, "utf8"),
    readFile(bookingTravelPlanStylesPath, "utf8")
  ]);
  const operations = await openApiPathOperations(openApiPath);

  assert.ok(
    operations.includes("GET /api/v1/bookings/{booking_id}/travel-plan/pdf"),
    "The API contract should expose a dedicated preview endpoint for booking travel-plan PDFs"
  );
  assert.ok(
    operations.includes("POST /api/v1/bookings/{booking_id}/travel-plan/pdfs"),
    "The API contract should expose a dedicated create endpoint for persisted travel-plan PDF artifacts"
  );
  assert.match(
    travelPlanSource,
    /bookingTravelPlanPdfRequest[\s\S]*bookingTravelPlanPdfCreateRequest/,
    "travel_plan.js should build both preview and persisted travel-plan PDF requests from the generated request factory"
  );
  assert.match(
    travelPlanSource,
    /data-travel-plan-create-pdf[\s\S]*data-requires-clean-state[\s\S]*data-clean-state-hint-id="travel_plan_pdf_dirty_hint"/,
    "The travel-plan footer should render a PDF action that is blocked while the page is dirty"
  );
  assert.match(
    travelPlanSource,
    /travel-plan-footer__action-rows[\s\S]*data-travel-plan-add-day[\s\S]*els\.travel_plan_pdf_workspace[\s\S]*buildBookingPdfWorkspaceMarkup\(\{[\s\S]*data-travel-plan-preview-pdf[\s\S]*documentsMarkup:[\s\S]*renderTravelPlanPdfsTable\(\)[\s\S]*data-travel-plan-create-pdf[\s\S]*attachmentsMarkup:[\s\S]*renderTravelPlanAttachments/,
    "The travel-plan UI should keep day actions in the footer while rendering preview, existing PDFs, create action, and attachments through the dedicated shared PDF workspace"
  );
  assert.doesNotMatch(
    travelPlanSource,
    /data-travel-plan-create-pdf[\s\S]*disabled/,
    "The travel-plan footer should not hard-disable the Create PDF action during render because clean-state gating handles that transient state"
  );
  assert.match(
    travelPlanSource,
    /function openTravelPlanPdf\(\)[\s\S]*bookingTravelPlanPdfCreateRequest\([\s\S]*lang:\s*bookingContentLang\(\)/,
    "Persisting a travel-plan PDF should use the current booking content language through the dedicated create request"
  );
  assert.match(
    travelPlanSource,
    /function previewTravelPlanPdf\(\)[\s\S]*bookingTravelPlanPdfRequest\([\s\S]*query:\s*bookingLanguageQuery\(\)/,
    "Previewing a travel-plan PDF should use the preview GET request with explicit booking content/source language query parameters"
  );
  assert.match(
    bookingTravelPlanStyles,
    /\.booking-detail-page \.booking-offer-add-btn\.travel-plan-pdf-btn \{[\s\S]*color: var\(--text-black\);[\s\S]*font-weight: var\(--font-weight-regular\);[\s\S]*\.booking-detail-page \.booking-offer-add-btn\.travel-plan-pdf-btn:hover,[\s\S]*\.booking-detail-page \.booking-offer-add-btn\.travel-plan-pdf-btn:focus-visible \{[\s\S]*color: var\(--text-black\);/,
    "The Travel plan PDF action buttons should use black regular-weight text across their default and hover states"
  );
  assert.match(
    bookingTravelPlanStyles,
    /\.booking-detail-page \.travel-plan-day-add-btn--service \{[\s\S]*color: var\(--text-black\);[\s\S]*\.booking-detail-page \.travel-plan-day-add-btn--service:hover:not\(\[disabled\]\),[\s\S]*\.booking-detail-page \.travel-plan-day-add-btn--service:focus-visible:not\(\[disabled\]\) \{[\s\S]*color: var\(--text-black\);/,
    "The Travel plan service action buttons should use black text across their default and hover states"
  );
  assert.match(
    bookingTravelPlanStyles,
    /\.booking-detail-page \.travel-plan-add-day-btn \{[\s\S]*color: var\(--text-black\);[\s\S]*\.booking-detail-page \.travel-plan-add-day-btn:hover,[\s\S]*\.booking-detail-page \.travel-plan-add-day-btn:focus-visible \{[\s\S]*color: var\(--text-black\);/,
    "The Travel plan new-day button should use black text across its default and hover states"
  );
  assert.match(
    bookingTravelPlanStyles,
    /\.booking-detail-page \.travel-plan-day-add-btn--day-copy \{[\s\S]*color: var\(--text-black\);[\s\S]*\.booking-detail-page \.travel-plan-day-add-btn--day-copy:hover:not\(\[disabled\]\),[\s\S]*\.booking-detail-page \.travel-plan-day-add-btn--day-copy:focus-visible:not\(\[disabled\]\) \{[\s\S]*color: var\(--text-black\);/,
    "The Travel plan day-append buttons should use black text across their default and hover states"
  );
  assert.match(
    bookingTravelPlanStyles,
    /#travel_plan_panel \.btn \{[\s\S]*font-weight: var\(--font-weight-regular\);/,
    "The main Travel plan panel buttons should use regular-weight text"
  );
  assert.match(
    bookingPageSource,
    /const hintId = String\(element\.dataset\.cleanStateHintId \|\| ""\)\.trim\(\);[\s\S]*hintNode\.textContent = blocked \? message : "";/,
    "The booking page should populate clean-state hints for any gated action, not only generated offers"
  );
});

test("travel plan editor warns in the console when the new-day controls never render", async () => {
  const travelPlanScriptPath = travelPlanEditorCorePath();
  const travelPlanSource = await readFile(travelPlanScriptPath, "utf8");

  assert.match(
    travelPlanSource,
    /function warnIfTravelPlanControlsMissing\(reason = "renderTravelPlanPanel"\) \{[\s\S]*querySelectorAll\("\[data-travel-plan-add-day\]"\)[\s\S]*console\.warn\("\[booking-travel-plan\] Expected new-day controls are missing after render\."/,
    "Travel plan rendering should warn in the browser console when the add-day controls are missing from the injected editor markup"
  );
  assert.match(
    travelPlanSource,
    /scheduleTravelPlanControlsDiagnostic\("renderTravelPlanPanel"\)/,
    "Travel plan rendering should run the missing-controls diagnostic immediately after each render"
  );
  assert.match(
    travelPlanSource,
    /warnIfTravelPlanControlsMissing\("post-load-watchdog"\)/,
    "Travel plan binding should keep a delayed watchdog so staging surfaces missing controls even when the editor stays empty after page load"
  );
});

test("travel plan footer exposes additional PDF attachment controls and contract routes", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const travelPlanScriptPath = travelPlanEditorCorePath();
  const travelPlanAttachmentsScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_attachments.js");
  const openApiPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "openapi.yaml");
  const [bookingPageSource, travelPlanSource, travelPlanAttachmentsSource] = await Promise.all([
    readFile(bookingPagePath, "utf8"),
    readFile(travelPlanScriptPath, "utf8"),
    readFile(travelPlanAttachmentsScriptPath, "utf8")
  ]);
  const operations = await openApiPathOperations(openApiPath);

  assert.ok(
    operations.includes("GET /api/v1/bookings/{booking_id}/travel-plan/attachments/{attachment_id}/pdf"),
    "The API contract should expose a travel-plan PDF attachment download endpoint"
  );
  assert.ok(
    operations.includes("POST /api/v1/bookings/{booking_id}/travel-plan/attachments"),
    "The API contract should expose a travel-plan PDF attachment upload endpoint"
  );
  assert.ok(
    operations.includes("DELETE /api/v1/bookings/{booking_id}/travel-plan/attachments/{attachment_id}"),
    "The API contract should expose a travel-plan PDF attachment delete endpoint"
  );
  assert.match(
    bookingPageSource,
    /id="travel_plan_attachment_input" type="file" accept="application\/pdf,.pdf" multiple hidden/,
    "booking.html should include a hidden PDF picker for travel-plan attachments"
  );
  assert.match(
    travelPlanSource,
    /travelPlanAttachmentsModule\.renderTravelPlanAttachments\(state\.travelPlanDraft\)/,
    "travel_plan.js should render the additional PDF attachment block in the footer"
  );
  assert.match(
    travelPlanAttachmentsSource,
    /data-travel-plan-upload-attachments[\s\S]*data-clean-state-hint-id="travel_plan_attachments_dirty_hint"/,
    "The travel-plan attachment upload action should be gated behind a clean page state"
  );
  assert.match(
    travelPlanAttachmentsSource,
    /data-travel-plan-delete-attachment/,
    "The travel-plan footer should allow removing uploaded PDF attachments"
  );
  assert.match(
    travelPlanAttachmentsSource,
    /href="\$\{escapeHtml\(resolveAttachmentPdfUrl\(attachment\.id\)\)\}"/,
    "The appended PDF filename should render as a clickable link"
  );
});

test("travel plan PDF table exposes sent and delete controls backed by dedicated contract routes", async () => {
  const travelPlanPdfsScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_pdfs.js");
  const openApiPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "openapi.yaml");
  const [travelPlanPdfsSource, operations] = await Promise.all([
    readFile(travelPlanPdfsScriptPath, "utf8"),
    openApiPathOperations(openApiPath)
  ]);

  assert.ok(
    operations.includes("PATCH /api/v1/bookings/{booking_id}/travel-plan/pdfs/{artifact_id}"),
    "The API contract should expose a travel-plan PDF sent-state update endpoint"
  );
  assert.ok(
    operations.includes("GET /api/v1/bookings/{booking_id}/travel-plan/pdfs/{artifact_id}/pdf"),
    "The API contract should expose a dedicated stored travel-plan PDF download endpoint"
  );
  assert.ok(
    operations.includes("DELETE /api/v1/bookings/{booking_id}/travel-plan/pdfs/{artifact_id}"),
    "The API contract should expose a travel-plan PDF delete endpoint"
  );
  assert.match(
    travelPlanPdfsSource,
    /bookingTravelPlanPdfUpdateRequest[\s\S]*bookingTravelPlanPdfDeleteRequest/,
    "Travel-plan PDF mutations should be built from the generated request factory"
  );
  assert.match(
    travelPlanPdfsSource,
    /booking\.comments[\s\S]*booking\.travel_plan\.sent_to_customer[\s\S]*data-travel-plan-pdf-comment-input[\s\S]*data-travel-plan-pdf-save-comment[\s\S]*data-travel-plan-pdf-sent[\s\S]*data-travel-plan-delete-pdf/,
    "The travel-plan PDF table should render inline comment editing alongside the sent-to-customer checkbox and delete action"
  );
});

test("booking danger zone exposes clone controls before delete", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const routesPath = path.resolve(__dirname, "..", "src", "http", "routes.js");
  const [bookingPageSource, bookingPageScriptSource, routesSource] = await Promise.all([
    readFile(bookingPagePath, "utf8"),
    readFile(bookingPageScriptPath, "utf8"),
    readFile(routesPath, "utf8")
  ]);

  assert.match(
    bookingPageSource,
    /id="booking_clone_title_input"[\s\S]*id="booking_clone_include_travelers_input"[\s\S]*id="booking_clone_btn"[\s\S]*id="booking_delete_btn"/,
    "booking.html should expose clone controls in the danger zone before the delete button"
  );
  assert.match(
    bookingPageScriptSource,
    /cloneTitleInput[\s\S]*cloneIncludeTravelersInput[\s\S]*cloneBtn[\s\S]*addEventListener\("click", cloneBooking\)/,
    "booking page script should wire the clone danger-zone controls"
  );
  assert.match(
    routesSource,
    /POST", path: "\/api\/v1\/bookings\/\{booking_id\}\/clone", handlerKey: "handleCloneBooking"/,
    "The booking routes should expose a clone endpoint"
  );
});

test("travel-plan PDF personalization exposes children policy and exclusions fields and renders them before the closing block", async () => {
  const bookingModelPath = path.resolve(__dirname, "..", "..", "..", "model", "database", "booking.cue");
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const bookingCorePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "core.js");
  const pdfPanelModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "pdf_personalization_panel.js");
  const bookingTravelPlanStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking-travel-plan.css");
  const travelPlanPdfPath = path.resolve(__dirname, "..", "src", "lib", "travel_plan_pdf.js");
  const [bookingModelSource, bookingPageSource, bookingPageScriptSource, bookingCoreSource, pdfPanelModuleSource, bookingTravelPlanStyles, travelPlanPdfSource] = await Promise.all([
    readFile(bookingModelPath, "utf8"),
    readFile(bookingPagePath, "utf8"),
    readFile(bookingPageScriptPath, "utf8"),
    readFile(bookingCorePath, "utf8"),
    readFile(pdfPanelModulePath, "utf8"),
    readFile(bookingTravelPlanStylesPath, "utf8"),
    readFile(travelPlanPdfPath, "utf8")
  ]);

  assert.match(
    bookingModelSource,
    /children_policy\?:\s+string[\s\S]*children_policy_i18n\?:\s+\[string\]: string[\s\S]*whats_not_included\?:\s+string[\s\S]*whats_not_included_i18n\?:\s+\[string\]: string/,
    "Booking PDF personalization should model children's policy and exclusions text with localized maps"
  );
  assert.match(
    bookingPageSource,
    /id="travel_plan_pdf_personalization_panel"[\s\S]*id="travel_plan_pdf_workspace"/,
    "booking.html should keep a dedicated travel-plan PDF personalization container right above the PDF workspace"
  );
  assert.doesNotMatch(
    bookingPageSource,
    /id="booking_pdf_travel_plan_children_policy_mount"/,
    "booking.html should not hand-copy the travel-plan PDF field mounts once the reusable panel renderer owns them"
  );
  assert.match(
    bookingPageScriptSource,
    /travelPlanPdfPersonalizationPanel[\s\S]*renderBookingPdfPersonalizationPanels\(els\)[\s\S]*resolveBookingPdfPersonalizationElements\(document\)/,
    "booking page script should render and then resolve the reusable PDF personalization panels"
  );
  assert.match(
    pdfPanelModuleSource,
    /scope:\s*"travel_plan"[\s\S]*field:\s*"subtitle"[\s\S]*field:\s*"children_policy"[\s\S]*field:\s*"whats_not_included"[\s\S]*field:\s*"closing"/,
    "The reusable PDF personalization panel config should define the travel-plan children policy, exclusions, and closing fields in order"
  );
  assert.doesNotMatch(
    pdfPanelModuleSource,
    /mountId:\s*"[^"]*travel[_-]plan[^"]*subtitle[^"]*"/,
    "The reusable PDF personalization panel should no longer assign the legacy travel-plan subtitle mount id"
  );
  assert.match(
    bookingTravelPlanStyles,
    /--travelplan_day_surface:\s*rgb\(182,\s*208,\s*233\);[\s\S]*#travel_plan_pdf_panel \.booking-section__head \{[\s\S]*background: var\(--travelplan_day_surface\);[\s\S]*#travel_plan_pdf_panel \.booking-collapsible\[data-booking-pdf-panel="travel_plan"\],[\s\S]*\.booking-pdf-document-section \.booking-collapsible\[data-booking-pdf-panel="travel_plan"\] \{[\s\S]*background: var\(--travelplan_day_surface\);[\s\S]*#travel_plan_pdf_panel \.booking-collapsible\[data-booking-pdf-panel="travel_plan"\] > \.booking-collapsible__head,[\s\S]*#travel_plan_pdf_panel \.booking-collapsible\[data-booking-pdf-panel="travel_plan"\] > \.booking-collapsible__head > \.booking-collapsible__summary,[\s\S]*#travel_plan_pdf_panel \.booking-collapsible\[data-booking-pdf-panel="travel_plan"\] > \.booking-collapsible__body,[\s\S]*\.booking-pdf-document-section \.booking-collapsible\[data-booking-pdf-panel="travel_plan"\] > \.booking-collapsible__head,[\s\S]*\.booking-pdf-document-section \.booking-collapsible\[data-booking-pdf-panel="travel_plan"\] > \.booking-collapsible__head > \.booking-collapsible__summary,[\s\S]*\.booking-pdf-document-section \.booking-collapsible\[data-booking-pdf-panel="travel_plan"\] > \.booking-collapsible__body \{[\s\S]*background: var\(--travelplan_day_surface\);[\s\S]*#travel_plan_pdf_panel \.booking-collapsible\[data-booking-pdf-panel="travel_plan"\] > \.booking-collapsible__head > \.booking-collapsible__summary,[\s\S]*\.booking-pdf-document-section \.booking-collapsible\[data-booking-pdf-panel="travel_plan"\] > \.booking-collapsible__head > \.booking-collapsible__summary \{[\s\S]*color: var\(--text-black\);[\s\S]*font-weight: var\(--font-weight-bold\);[\s\S]*#travel_plan_pdf_panel \.booking-collapsible\[data-booking-pdf-panel="travel_plan"\] > \.booking-collapsible__head > \.booking-collapsible__summary::after,[\s\S]*\.booking-pdf-document-section \.booking-collapsible\[data-booking-pdf-panel="travel_plan"\] > \.booking-collapsible__head > \.booking-collapsible__summary::after \{[\s\S]*color: var\(--text-black\);/,
    "The Travel plan PDF texts panel should use the same opaque light blue surface as the Travel plan PDF section header with black bold summary text"
  );
  assert.match(
    bookingCoreSource,
    /BOOKING_PDF_PERSONALIZATION_PANELS\.forEach\([\s\S]*panelConfig\.scope[\s\S]*item\.field/,
    "booking core UI should iterate over the shared PDF personalization panel config"
  );
  assert.match(
    bookingCoreSource,
    /function buildPdfPersonalizationBranchDraft\(scope, existingBranch = \{\}\) \{[\s\S]*readLocalizedBookingPdfField\(scope, item\.field/ ,
    "booking core dirty tracking should persist PDF personalization fields through the shared branch builder"
  );
  assert.match(
    travelPlanPdfSource,
    /resolveTravelPlanChildrenPolicyText[\s\S]*resolveTravelPlanWhatsNotIncludedText[\s\S]*pdfT\(lang, "travel_plan\.children_policy_title", "Children's Policy"\)[\s\S]*pdfT\(lang, "travel_plan\.whats_not_included_title", "What's not included"\)[\s\S]*closingText/,
    "travel_plan_pdf.js should resolve and render the new titled sections before the closing block"
  );
});

test("offer PDF personalization exposes a cancellation-policy toggle and renders the fixed section before the closing block", async () => {
  const bookingModelPath = path.resolve(__dirname, "..", "..", "..", "model", "database", "booking.cue");
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const bookingCorePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "core.js");
  const pdfPanelModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "pdf_personalization_panel.js");
  const bookingPdfPersonalizationPath = path.resolve(__dirname, "..", "src", "lib", "booking_pdf_personalization.js");
  const offerPdfPath = path.resolve(__dirname, "..", "src", "lib", "offer_pdf.js");
  const [bookingModelSource, bookingPageSource, bookingPageScriptSource, bookingCoreSource, pdfPanelModuleSource, personalizationSource, offerPdfSource] = await Promise.all([
    readFile(bookingModelPath, "utf8"),
    readFile(bookingPagePath, "utf8"),
    readFile(bookingPageScriptPath, "utf8"),
    readFile(bookingCorePath, "utf8"),
    readFile(pdfPanelModulePath, "utf8"),
    readFile(bookingPdfPersonalizationPath, "utf8"),
    readFile(offerPdfPath, "utf8")
  ]);

  assert.match(
    bookingModelSource,
    /include_cancellation_policy\?: bool/,
    "Booking PDF personalization should model the fixed cancellation-policy toggle"
  );
  assert.doesNotMatch(
    bookingPageSource,
    /id="offer_pdf_personalization_panel"|id="generated_offers_overview"/,
    "booking.html should not render the removed standalone Offer PDF controls"
  );
  assert.doesNotMatch(
    bookingPageSource,
    /id="booking_pdf_offer_welcome_mount"/,
    "booking.html should not hand-copy the Offer PDF field mounts once the reusable panel renderer owns them"
  );
  assert.match(
    bookingPageScriptSource,
    /offerPdfPersonalizationPanel[\s\S]*renderBookingPdfPersonalizationPanels\(els\)[\s\S]*resolveBookingPdfPersonalizationElements\(document\)/,
    "booking page script should render and resolve the reusable Offer PDF personalization panel"
  );
  assert.match(
    pdfPanelModuleSource,
    /scope:\s*"offer"[\s\S]*field:\s*"welcome"[\s\S]*field:\s*"children_policy"[\s\S]*field:\s*"whats_not_included"[\s\S]*field:\s*"include_cancellation_policy"[\s\S]*field:\s*"closing"/,
    "The reusable PDF personalization panel config should define the Offer fields and toggle in order"
  );
  assert.match(
    bookingCoreSource,
    /include_cancellation_policy:\s*offer\.include_cancellation_policy !== false/,
    "booking core should normalize the Offer cancellation-policy toggle"
  );
  assert.match(
    bookingCoreSource,
    /const renderToggle = \(mount, scope, config\) => \{[\s\S]*mount\.innerHTML = buildBookingPdfToggleMarkup\([\s\S]*dataAttributeName: "booking-pdf-toggle"[\s\S]*dataAttributeValue: `\$\{scope\}\.\$\{config\.field\}`/,
    "booking core should render Offer toggles through the shared checkbox renderer"
  );
  assert.match(
    bookingCoreSource,
    /config\.previewKey === "offer_cancellation_policy"/,
    "booking core should keep the shared preview hook for the Offer cancellation-policy toggle"
  );
  assert.match(
    bookingCoreSource,
    /children_policy:\s*offerChildrenPolicy\.text[\s\S]*whats_not_included:\s*offerWhatsNotIncluded\.text/s,
    "booking core should normalize the Offer children-policy and exclusion text fields"
  );
  assert.match(
    bookingCoreSource,
    /function readManagedPdfPersonalizationDraft\(value\) \{[\s\S]*BOOKING_PDF_PERSONALIZATION_PANELS\.forEach\([\s\S]*buildPdfPersonalizationBranchDraft\(/,
    "booking core should persist localized Offer fields through the shared panel config without dropping unrelated PDF branches"
  );
  assert.match(
    bookingCoreSource,
    /pdf_personalization:\s*JSON\.stringify\(normalizeManagedPdfPersonalization\(values\.pdf_personalization\)\)/,
    "booking core dirty tracking should compare only the proposal-managed PDF personalization scopes"
  );
  assert.match(
    bookingCoreSource,
    /const nextPdfPersonalization = mergeManagedPdfPersonalization\([\s\S]*latestBooking\.pdf_personalization[\s\S]*draft\.pdf_personalization[\s\S]*\);/,
    "booking core saves should merge proposal PDF edits into the latest booking PDF personalization payload"
  );
  assert.match(
    personalizationSource,
    /include_cancellation_policy:\s*offerIncludeCancellationPolicy/,
    "backend PDF personalization should preserve the Offer cancellation-policy toggle"
  );
  assert.match(
    personalizationSource,
    /offer: Object\.freeze\(\{[\s\S]*children_policy: Object\.freeze\([\s\S]*whats_not_included: Object\.freeze\([\s\S]*for \(const field of Object\.keys\(fieldConfigs\)\) \{[\s\S]*normalizedBranch\[field\] = normalizedField\.text;[\s\S]*normalizedBranch\[`include_\$\{field\}`\] = resolvePdfTextFieldEnabled\(branch, scope, field, normalizedField\);/s,
    "backend PDF personalization should preserve the Offer children-policy and exclusion fields through the shared field-config loop"
  );
  assert.match(
    offerPdfSource,
    /resolveOfferChildrenPolicyText[\s\S]*resolveOfferWhatsNotIncludedText[\s\S]*resolveOfferCancellationPolicyTravelerCount[\s\S]*resolveOfferCancellationPolicySection[\s\S]*resolveOfferCancellationPolicyTitle[\s\S]*pdfT\(lang, "offer\.cancellation_policy_title", "Cancellation policy"\)[\s\S]*resolveOfferCancellationPolicyText[\s\S]*offer\.children_policy_title[\s\S]*offer\.whats_not_included_title[\s\S]*buildClosingBody/s,
    "offer_pdf.js should resolve Offer children-policy and exclusion text alongside the fixed cancellation-policy section before the closing body"
  );
});

test("deposit payment confirmation PDF personalization lives inside the payment flow and uses the renamed scope", async () => {
  const bookingModelPath = path.resolve(__dirname, "..", "..", "..", "model", "database", "booking.cue");
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const bookingCorePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "core.js");
  const pdfPanelModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "pdf_personalization_panel.js");
  const bookingPdfPersonalizationPath = path.resolve(__dirname, "..", "src", "lib", "booking_pdf_personalization.js");
  const [
    bookingModelSource,
    bookingPageSource,
    bookingPageScriptSource,
    bookingCoreSource,
    pdfPanelModuleSource,
    personalizationSource
  ] = await Promise.all([
    readFile(bookingModelPath, "utf8"),
    readFile(bookingPagePath, "utf8"),
    readFile(bookingPageScriptPath, "utf8"),
    readFile(bookingCorePath, "utf8"),
    readFile(pdfPanelModulePath, "utf8"),
    readFile(bookingPdfPersonalizationPath, "utf8")
  ]);

  assert.match(
    bookingModelSource,
    /payment_confirmation_deposit\?:\s+#BookingPdfPersonalizationScoped/,
    "Booking PDF personalization should model a dedicated deposit payment-confirmation scope"
  );
  assert.match(
    bookingPageSource,
    /id="payment_flow_sections"/,
    "The booking page should expose the new payment-flow mount for request and receipt sections"
  );
  assert.doesNotMatch(
    bookingPageSource,
    /id="payment_deposit_section"|id="payments_booking_confirmation_card"|id="booking_confirmation_pdfs_table"|id="booking_confirmation_pdf_personalization_panel"|id="create_booking_confirmation_btn"/,
    "The old standalone deposit and booking-confirmation payment widgets should be removed"
  );
  assert.match(
    bookingPageScriptSource,
    /renderBookingPdfPersonalizationPanels\(els\)[\s\S]*resolveBookingPdfPersonalizationElements\(document\)/,
    "booking page script should render and resolve the reusable PDF personalization panels"
  );
  assert.doesNotMatch(
    bookingPageScriptSource,
    /bookingConfirmationPdfPersonalizationPanel|pdfBookingConfirmationSubtitleMount|pdfBookingConfirmationReference/,
    "booking page script should no longer keep standalone booking-confirmation panel references"
  );
  assert.match(
    bookingPageScriptSource,
    /\[els\.travelPlanPdfPersonalizationPanel,\s*els\.offerPdfPersonalizationPanel\]/,
    "booking page script should keep dirty tracking wired only to the static travel-plan and offer PDF panels"
  );
  assert.match(
    pdfPanelModuleSource,
    /scope:\s*"payment_confirmation_deposit"[\s\S]*field:\s*"subtitle"[\s\S]*field:\s*"welcome"[\s\S]*field:\s*"closing"/,
    "The reusable PDF personalization panel config should define deposit payment-confirmation subtitle, welcome, and closing fields"
  );
  assert.match(
    bookingCoreSource,
    /payment_confirmation_deposit:\s*\{\s*subtitle:\s*paymentConfirmationDepositSubtitle\.text[\s\S]*include_closing:\s*resolvePdfTextFieldEnabled\(paymentConfirmationDeposit, "payment_confirmation_deposit", "closing", paymentConfirmationDepositClosing\)/,
    "booking core should normalize the deposit payment-confirmation personalization branch"
  );
  assert.doesNotMatch(
    personalizationSource,
    /raw\?\.booking_confirmation/,
    "backend PDF personalization should no longer accept the removed booking-confirmation alias"
  );
  assert.doesNotMatch(
    bookingCoreSource,
    /raw\.booking_confirmation/,
    "booking core should no longer normalize the removed booking-confirmation alias"
  );
});

test("backend bookings page exposes an internal create-booking modal backed by a protected API route", async () => {
  const bookingListPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "bookings.html");
  const bookingListScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking_list.js");
  const routesPath = path.resolve(__dirname, "..", "src", "http", "routes.js");
  const openApiPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "openapi.yaml");
  const [pageSource, scriptSource, routesSource, operations] = await Promise.all([
    readFile(bookingListPagePath, "utf8"),
    readFile(bookingListScriptPath, "utf8"),
    readFile(routesPath, "utf8"),
    openApiPathOperations(openApiPath)
  ]);

  assert.match(
    pageSource,
    /id="bookingCreateOpenBtn"[\s\S]*id="bookingCreateModal"[\s\S]*id="bookingCreateTitleInput"[\s\S]*id="bookingCreateSubmitBtn"/,
    "bookings.html should expose create-booking controls and the modal form"
  );
  assert.match(
    scriptSource,
    /bookingCreateOpenBtn[\s\S]*function openCreateBookingModal\(\)[\s\S]*function createBackendBooking\(\)[\s\S]*fetchApi\("\/api\/v1\/bookings"/,
    "booking_list.js should wire the internal create-booking modal to the protected bookings API"
  );
  assert.match(
    routesSource,
    /POST", path: "\/api\/v1\/bookings", handlerKey: "handleCreateBackendBooking"/,
    "The booking routes should expose a protected backend booking-create endpoint"
  );
  assert.ok(
    operations.includes("POST /api/v1/bookings"),
    "The OpenAPI contract should expose the protected backend booking-create endpoint"
  );
});

test("offer and travel-plan PDFs use exact A4 point dimensions instead of PDFKit's rounded preset", async () => {
  const offerPdfPath = path.resolve(__dirname, "..", "src", "lib", "offer_pdf.js");
  const travelPlanPdfPath = path.resolve(__dirname, "..", "src", "lib", "travel_plan_pdf.js");
  const [offerPdfSource, travelPlanPdfSource] = await Promise.all([
    readFile(offerPdfPath, "utf8"),
    readFile(travelPlanPdfPath, "utf8")
  ]);

  const exactA4Pattern = /const MM_TO_POINTS = 72 \/ 25\.4;[\s\S]*const PAGE_SIZE = Object\.freeze\(\[210 \* MM_TO_POINTS, 297 \* MM_TO_POINTS\]\);/;

  assert.match(
    offerPdfSource,
    exactA4Pattern,
    "Offer PDFs should use exact A4 point dimensions instead of the rounded PDFKit preset"
  );
  assert.doesNotMatch(
    offerPdfSource,
    /const PAGE_SIZE = "A4";/,
    "Offer PDFs should not use PDFKit's built-in rounded A4 preset"
  );
  assert.match(
    travelPlanPdfSource,
    exactA4Pattern,
    "Travel-plan PDFs should use exact A4 point dimensions instead of the rounded PDFKit preset"
  );
  assert.doesNotMatch(
    travelPlanPdfSource,
    /const PAGE_SIZE = "A4";/,
    "Travel-plan PDFs should not use PDFKit's built-in rounded A4 preset"
  );
});

test("offer and travel-plan PDF closing letters mention appended attachments before the signoff", async () => {
  const offerPdfPath = path.resolve(__dirname, "..", "src", "lib", "offer_pdf.js");
  const travelPlanPdfPath = path.resolve(__dirname, "..", "src", "lib", "travel_plan_pdf.js");
  const [offerPdfSource, travelPlanPdfSource] = await Promise.all([
    readFile(offerPdfPath, "utf8"),
    readFile(travelPlanPdfPath, "utf8")
  ]);

  assert.match(
    offerPdfSource,
    /Please also find the attached additional PDF(?:s)? at the end of this document\./,
    "Offer PDFs should mention appended PDF attachments in the closing letter before the signoff"
  );
  assert.match(
    travelPlanPdfSource,
    /Please also find the attached additional PDF(?:s)? at the end of this document\./,
    "Travel-plan PDFs should mention appended PDF attachments in the closing letter before the signoff"
  );
});

test("offer and travel-plan PDFs route Arabic text blocks through the shared RTL alignment helpers", async () => {
  const pdfI18nPath = path.resolve(__dirname, "..", "src", "lib", "pdf_i18n.js");
  const offerPdfPath = path.resolve(__dirname, "..", "src", "lib", "offer_pdf.js");
  const travelPlanPdfPath = path.resolve(__dirname, "..", "src", "lib", "travel_plan_pdf.js");
  const [pdfI18nSource, offerPdfSource, travelPlanPdfSource] = await Promise.all([
    readFile(pdfI18nPath, "utf8"),
    readFile(offerPdfPath, "utf8"),
    readFile(travelPlanPdfPath, "utf8")
  ]);

  assert.match(
    pdfI18nSource,
    /const RTL_PDF_LANGS = new Set\(\["ar"\]\);[\s\S]*export function pdfTextAlign\(lang, fallback = "left"\)/,
    "PDF i18n helpers should define Arabic as an RTL PDF language and expose a shared text-alignment helper"
  );
  assert.match(
    offerPdfSource,
    /import \{[\s\S]*pdfTextAlign,[\s\S]*pdfTextOptions,[\s\S]*\} from "\.\/pdf_i18n\.js";/,
    "Offer PDFs should import the shared RTL alignment helpers"
  );
  assert.match(
    travelPlanPdfSource,
    /import \{[\s\S]*pdfTextAlign,[\s\S]*pdfTextOptions,[\s\S]*\} from "\.\/pdf_i18n\.js";/,
    "Travel-plan PDFs should import the shared RTL alignment helpers"
  );
  assert.match(
    offerPdfSource,
    /drawHero[\s\S]*align: pdfTextAlign\(lang\)[\s\S]*drawClosing[\s\S]*pdfTextOptions\(lang,/,
    "Offer PDFs should right-align RTL hero and closing copy through the shared helper"
  );
  assert.match(
    travelPlanPdfSource,
    /drawTravelPlanHero[\s\S]*pdfTextOptions\(lang,[\s\S]*drawClosing[\s\S]*align: pdfTextAlign\(lang\)/,
    "Travel-plan PDFs should right-align RTL hero and closing copy through the shared helper"
  );
});

test("offer and travel-plan PDFs localize guide, pricing summary, and payment-term labels across the PDF dictionary", async () => {
  const pdfI18nPath = path.resolve(__dirname, "..", "src", "lib", "pdf_i18n.js");
  const offerPdfPath = path.resolve(__dirname, "..", "src", "lib", "offer_pdf.js");
  const travelPlanPdfPath = path.resolve(__dirname, "..", "src", "lib", "travel_plan_pdf.js");
  const [pdfI18nSource, offerPdfSource, travelPlanPdfSource] = await Promise.all([
    readFile(pdfI18nPath, "utf8"),
    readFile(offerPdfPath, "utf8"),
    readFile(travelPlanPdfPath, "utf8")
  ]);

  const localeBlockCount = (pdfI18nSource.match(/^\s{2}"[a-z]{2}": Object\.freeze\(\{/gm) || []).length;
  assert.ok(localeBlockCount >= 15, "Expected the PDF i18n dictionary to define the supported language blocks");

  const keyOccurrenceCount = (key) => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (pdfI18nSource.match(new RegExp(`"${escapedKey}":`, "g")) || []).length;
  };

  for (const key of [
    "guide.section_title_named",
    "guide.section_title_fallback",
    "offer.trip_label",
    "offer.trip_total",
    "offer.additional_item",
    "offer.discount",
    "offer.tax_rate",
    "offer.quotation_tax_summary",
    "offer.payment_terms_title",
    "travel_plan.default_welcome_styles",
    "travel_plan.default_welcome"
  ]) {
    assert.equal(
      keyOccurrenceCount(key),
      localeBlockCount,
      `Expected ${key} to be translated in every PDF locale block`
    );
  }

  assert.match(
    offerPdfSource,
    /function isSyntheticTripTotalLabel\(value\)/,
    "Offer PDFs should recognize synthetic English trip-total labels so they can be replaced at render time"
  );
  assert.match(
    offerPdfSource,
    /!isSyntheticAdditionalItemLabel\(item\??\.label\)/,
    "Offer PDFs should avoid printing synthetic English additional-item labels in the customer-facing details column"
  );
  assert.match(
    travelPlanPdfSource,
    /pdfT\(lang,\s*"guide\.section_title_named",\s*"Our team member \{name\} will assist you"/,
    "Travel-plan PDFs should source the guide heading from the localized PDF dictionary"
  );
  assert.match(
    travelPlanPdfSource,
    /pdfT\(\s*lang,\s*"travel_plan\.default_welcome_styles"[\s\S]*pdfT\(\s*lang,\s*"travel_plan\.default_welcome"/,
    "Travel-plan PDFs should source default welcome text from the localized PDF dictionary"
  );
});

test("staging PDF font stack includes Japanese and Chinese smoke coverage paths", async () => {
  const dockerfilePath = path.resolve(__dirname, "..", "..", "..", "backend", "Dockerfile.staging");
  const resolverPath = path.resolve(__dirname, "..", "src", "lib", "pdf_font_resolver.js");
  const offerPdfPath = path.resolve(__dirname, "..", "src", "lib", "offer_pdf.js");
  const travelPlanPdfPath = path.resolve(__dirname, "..", "src", "lib", "travel_plan_pdf.js");
  const paymentDocumentPdfPath = path.resolve(__dirname, "..", "src", "lib", "payment_document_pdf.js");
  const [dockerfileSource, resolverSource, offerPdfSource, travelPlanPdfSource, paymentDocumentPdfSource] = await Promise.all([
    readFile(dockerfilePath, "utf8"),
    readFile(resolverPath, "utf8"),
    readFile(offerPdfPath, "utf8"),
    readFile(travelPlanPdfPath, "utf8"),
    readFile(paymentDocumentPdfPath, "utf8")
  ]);

  assert.match(
    dockerfileSource,
    /NotoSansCJKjp-Regular\.ttf[\s\S]*NotoSansCJKjp-Bold\.ttf[\s\S]*NotoSansCJKsc-Regular\.ttf[\s\S]*NotoSansCJKsc-Bold\.ttf/,
    "The staging image should extract dedicated Japanese and Simplified Chinese CJK font faces"
  );
  assert.match(
    resolverSource,
    /const LANGUAGE_FONT_PRIORITY_MARKERS = Object\.freeze\(\{[\s\S]*ja:\s*\["notosanscjkjp-"\][\s\S]*zh:\s*\["notosanscjksc-"\]/,
    "The PDF font resolver should prioritize language-matching Japanese and Chinese CJK faces"
  );

  for (const [source, label] of [
    [offerPdfSource, "Offer PDFs"],
    [travelPlanPdfSource, "Travel-plan PDFs"],
    [paymentDocumentPdfSource, "Payment-document PDFs"]
  ]) {
    assert.match(
      source,
      /NotoSansCJKjp-Regular\.ttf[\s\S]*NotoSansCJKsc-Regular\.ttf[\s\S]*NotoSansCJKkr-Regular\.ttf/,
      `${label} should include staging candidates for Japanese, Chinese, and Korean regular fonts`
    );
    assert.match(
      source,
      /NotoSansCJKjp-Bold\.ttf[\s\S]*NotoSansCJKsc-Bold\.ttf[\s\S]*NotoSansCJKkr-Bold\.ttf/,
      `${label} should include staging candidates for Japanese, Chinese, and Korean bold fonts`
    );
  }
});

test("payment-document PDFs keep the header focused on company contact details instead of bank account lines", async () => {
  const runtimeConfigPath = path.resolve(__dirname, "..", "src", "config", "runtime.js");
  const paymentDocumentPdfPath = path.resolve(__dirname, "..", "src", "lib", "payment_document_pdf.js");
  const companyHeaderPath = path.resolve(__dirname, "..", "src", "lib", "pdf_company_header.js");
  const [runtimeConfigSource, paymentDocumentPdfSource, companyHeaderSource] = await Promise.all([
    readFile(runtimeConfigPath, "utf8"),
    readFile(paymentDocumentPdfPath, "utf8"),
    readFile(companyHeaderPath, "utf8")
  ]);

  assert.match(
    runtimeConfigSource,
    /COMPANY_PROFILE = Object\.freeze\(\{[\s\S]*bankDetails:\s*Object\.freeze\(\{[\s\S]*accountHolder:[\s\S]*bankName:[\s\S]*accountNumber:[\s\S]*branch:[\s\S]*swiftCode:/,
    "Runtime config should continue exposing the shared company bank-details block"
  );
  assert.match(
    paymentDocumentPdfSource,
    /import \{ drawPdfCompanyHeader \} from "\.\/pdf_company_header\.js";[\s\S]*drawPdfCompanyHeader\(doc, \{/,
    "Payment-document PDF generation should reuse the shared company header helper"
  );
  assert.match(
    companyHeaderSource,
    /const addressText = profile\.address \|\| ""[\s\S]*pdfT\(lang, "header\.whatsapp", "WhatsApp"\)[\s\S]*pdfT\(lang, "header\.email", "Email"\)[\s\S]*profile\.website \|\| ""/,
    "The shared company header helper should keep the header limited to company contact details"
  );
  assert.doesNotMatch(
    companyHeaderSource,
    /Account holder:|Account number:|SWIFT:|Branch:|Bank:/,
    "The shared company header helper should no longer include bank-account lines"
  );
});

test("offer PDFs render a short itinerary summary, bank details, and a detailed travel-plan appendix", async () => {
  const offerPdfPath = path.resolve(__dirname, "..", "src", "lib", "offer_pdf.js");
  const offerPdfSource = await readFile(offerPdfPath, "utf8");

  assert.match(
    offerPdfSource,
    /function drawOfferItinerarySummary\(doc, generatedOffer, booking, startY, fonts, lang\) \{[\s\S]*resolveOfferDaySummary\(day, lang\)/,
    "Offer PDFs should summarize the itinerary with compact per-day rows instead of reusing the full travel-plan section in the main commercial flow"
  );
  assert.match(
    offerPdfSource,
    /function drawBankDetails\(doc, companyProfile, startY, fonts, lang\) \{[\s\S]*resolveCompanyBankDetailRows\(companyProfile, lang\)/,
    "Offer PDFs should expose a dedicated bank-details section sourced from the shared company profile"
  );
  assert.match(
    offerPdfSource,
    /function drawOfferDetailedTravelPlanAppendix\(doc, generatedOffer, booking, startY, fonts, lang, itemThumbnailMap\) \{[\s\S]*drawTravelPlanDaysSection\(/,
    "Offer PDFs should append the detailed travel plan as a separate appendix section"
  );
});

test("travel-plan PDF removes the old hero subtitle and in-body section title, and suggests the new download filename", async () => {
  const travelPlanPdfPath = path.resolve(__dirname, "..", "src", "lib", "travel_plan_pdf.js");
  const bookingTravelPlanHandlerPath = path.resolve(__dirname, "..", "src", "http", "handlers", "booking_travel_plan.js");
  const [travelPlanPdfSource, bookingTravelPlanHandlerSource] = await Promise.all([
    readFile(travelPlanPdfPath, "utf8"),
    readFile(bookingTravelPlanHandlerPath, "utf8")
  ]);

  assert.doesNotMatch(
    travelPlanPdfSource,
    /travel_plan\.section_title|fallback = normalizedLang === "de" \? "Reiseplan" : "Travel plan"/,
    "Travel-plan PDFs should not bypass the localized PDF subtitle copy with a hardcoded Travel plan fallback"
  );
  assert.doesNotMatch(
    travelPlanPdfSource,
    /drawTravelPlanHero[\s\S]*travel_plan\.pdf_subtitle[\s\S]*travel_plan\.pdf_badge/,
    "Travel-plan hero rendering should no longer show the old subtitle and badge labels"
  );
  assert.doesNotMatch(
    travelPlanPdfSource,
    /function drawTravelPlanSectionTitle\(|text\(travelPlanSectionTitle\(lang\), PAGE_MARGIN, y,/,
    "Travel-plan PDFs should not render a standalone in-body section heading above the first itinerary day"
  );
  assert.match(
    bookingTravelPlanHandlerSource,
    /function buildTravelPlanDownloadFilename\(nowValue = nowIso\(\), rawSuffix = ""\)/,
    "Travel-plan PDF download responses should build the new date-based filename"
  );
  assert.match(
    bookingTravelPlanHandlerSource,
    /Asia Travel Plan \$\{datePart\}\$\{normalizedSuffix \? `-\$\{normalizedSuffix\}` : ""\}\.pdf/,
    "Travel-plan PDF download filenames should use the Asia Travel Plan YYYY-MM-DD pattern with an optional suffix"
  );
});

test("offer detail level options only expose trip and day", async () => {
  const offersModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offers.js");
  const offersSource = await readFile(offersModulePath, "utf8");

  assert.match(
    offersSource,
    /const OFFER_DETAIL_LEVEL_OPTIONS = Object\.freeze\(\[\s*\{ value: "day", label: "Per day" \},\s*\{ value: "trip", label: "Per trip" \}\s*\]\);/,
    "Offer detail level controls should only expose the supported trip/day modes"
  );
});

test("offer detail level select uses literal detail level values instead of currency normalization", async () => {
  const offersModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offers.js");
  const offersSource = await readFile(offersModulePath, "utf8");

  assert.match(
    offersSource,
    /function populateOfferDetailLevelSelect\(select, selectedValue, \{ disableFinerThan = null \} = \{\}\) \{[\s\S]*select\.innerHTML = html;[\s\S]*select\.value = normalizedSelected;/,
    "Offer detail level selects should keep the literal day/trip value after rendering options"
  );
  assert.doesNotMatch(
    offersSource,
    /function populateOfferDetailLevelSelect[\s\S]*setSelectValue\(select, normalizedSelected\)/,
    "Offer detail level selects must not use the currency-only select helper because it injects USD for unknown values"
  );
});

test("switching offer detail level back to trip folds synthetic carry-over surcharge into the trip total", async () => {
  const offerPricingModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offer_pricing.js");
  const source = await readFile(offerPricingModulePath, "utf8");

  assert.match(
    source,
    /function isSyntheticCarryOverAdditionalItem\(item\) \{[\s\S]*carry-over surcharge[\s\S]*carry over surcharge/,
    "Offer pricing should explicitly recognize the synthetic carry-over surcharge rows created by the destructive detail-level switch"
  );
  assert.match(
    source,
    /if \(toDetailLevel === "trip"\) \{[\s\S]*foldedCarryOverGross[\s\S]*amount_cents: currentMainGross \+ foldedCarryOverGross[\s\S]*additional_items = existingAdditionalItems\.filter\(\(item\) => !isSyntheticCarryOverAdditionalItem\(item\)\)/,
    "Switching back to trip should fold any synthetic carry-over surcharge into the trip total instead of keeping it as a separate adjustment row"
  );
});

test("offer editor preserves explicit zero tax rates and keeps zero-tax rows out of the summary", async () => {
  const offerPricingModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offer_pricing.js");
  const source = await readFile(offerPricingModulePath, "utf8");

  assert.match(
    source,
    /function readOfferTaxRateBasisPointsInput\(input, fallback = defaultOfferTaxRateBasisPoints\) \{[\s\S]*if \(!rawValue\) return normalizeOfferTaxRateBasisPoints\(fallback, defaultOfferTaxRateBasisPoints\);[\s\S]*Number\(rawValue\) \* 100/,
    "Offer tax inputs should preserve an explicit 0 while still falling back when the field is blank"
  );
  assert.match(
    source,
    /tax_rate_basis_points: readOfferTaxRateBasisPointsInput\(taxInput, fallback\.tax_rate_basis_points\)/,
    "Offer draft readers should reuse the zero-preserving tax parser for trip, day, and additional-item tax rates"
  );
  assert.match(
    source,
    /summary\.tax_breakdown[\s\S]*filter\(\(bucket\) => Number\(bucket\?\.tax_amount_cents \|\| 0\) !== 0\)/,
    "Offer quotation summaries should omit tax rows entirely when the computed tax amount is zero"
  );
});

test("booking page save orchestrates dirty sections through existing section endpoints", async () => {
  const bookingPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const travelPlanModulePath = travelPlanEditorCorePath();
  const [bookingSource, travelPlanSource] = await Promise.all([
    readFile(bookingPageScriptPath, "utf8"),
    readFile(travelPlanModulePath, "utf8")
  ]);

  assert.match(
    bookingSource,
    /async function savePageEdits\(\)\s*\{[\s\S]*?saveCoreEdits\(\)[\s\S]*?saveNoteEdits\(\)[\s\S]*?personsModule\.saveAllPersonDrafts\(\)[\s\S]*?saveOffer\(\)[\s\S]*?travelPlanModule\.saveTravelPlan\(\)[\s\S]*?state\.pendingSavedCustomerLanguage[\s\S]*?loadBookingPage\(\)/,
    "Page save should orchestrate the existing booking section endpoints in order"
  );
  assert.match(
    travelPlanSource,
    /async function persistTravelPlan\(\)\s*\{[\s\S]*?if \(!state\.travelPlanDirty\) \{[\s\S]*?syncTravelPlanDraftFromDom\(\);[\s\S]*?updateTravelPlanDirtyState\(\);[\s\S]*?if \(!state\.travelPlanDirty\) \{[\s\S]*?return true;/,
    "Travel-plan persistence should resync dirty state from the DOM and treat a clean result as a no-op instead of blocking page save"
  );
});

test("marketing tour travel-plan form save prunes empty services and days without pruning image-upload pre-saves", async () => {
  const travelPlanModulePath = travelPlanEditorCorePath();
  const tourTravelPlanAdapterPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tour_travel_plan_adapter.js");
  const [travelPlanSource, adapterSource] = await Promise.all([
    readFile(travelPlanModulePath, "utf8"),
    readFile(tourTravelPlanAdapterPath, "utf8")
  ]);

  assert.match(
    adapterSource,
    /features:\s*\{[\s\S]*pruneEmptyTravelPlanContentOnCollect: true[\s\S]*\}/,
    "Marketing tour travel-plan saves should opt into pruning blank day/service rows"
  );
  assert.match(
    adapterSource,
    /function expectedTourUpdatedAtPayload\([\s\S]*expected_updated_at: expectedUpdatedAt[\s\S]*buildTourTravelPlanSaveRequest[\s\S]*\.\.\.expectedTourUpdatedAtPayload\(requestState\)/,
    "Marketing-tour travel-plan section saves should include the loaded tour timestamp for optimistic conflict detection"
  );
  assert.match(
    travelPlanSource,
    /function pruneEmptyTravelPlanContent\(plan\) \{[\s\S]*filter\(travelPlanServiceHasContent\)[\s\S]*filter\(travelPlanDayHasContent\)[\s\S]*day_number: dayIndex \+ 1/,
    "The travel-plan collector should remove empty services, remove empty days, and renumber kept days"
  );
  assert.match(
    travelPlanSource,
    /function collectTravelPlanPayload\(\{\s*focusFirstInvalid = true,\s*pruneEmptyContent = pruneEmptyTravelPlanContentOnCollect\s*\} = \{\}\) \{[\s\S]*const travelPlanPayload = buildTravelPlanPayload\(state\.travelPlanDraft, \{ pruneEmptyContent \}\);/,
    "Only collected page-save payloads should receive the marketing-tour pruning option"
  );
  assert.match(
    travelPlanSource,
    /async function persistTravelPlan\(\) \{[\s\S]*const travelPlanPayload = buildTravelPlanPayload\(\);/,
    "Internal travel-plan pre-saves should keep blank rows so image upload can save the target service before attaching the file"
  );
});

test("booking page keeps English as the fixed booking source language while still sending explicit language query params", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingI18nPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "i18n.js");
  const bookingPageDataModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking_page_data.js");
  const bookingPageLanguageModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking_page_language.js");
  const bookingHandlersModulePath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "http", "handlers", "bookings.js");
  const routesModulePath = path.resolve(__dirname, "..", "src", "http", "routes.js");
  const [bookingSource, i18nSource, bookingPageDataSource, bookingPageLanguageSource, bookingHandlersSource, routesSource] = await Promise.all([
    readFile(bookingPagePath, "utf8"),
    readFile(bookingI18nPath, "utf8"),
    readFile(bookingPageDataModulePath, "utf8"),
    readFile(bookingPageLanguageModulePath, "utf8"),
    readFile(bookingHandlersModulePath, "utf8"),
    readFile(routesModulePath, "utf8")
  ]);

  assert.doesNotMatch(
    bookingSource,
    /id="booking_editing_language_field"/,
    "booking.html should no longer render a separate editing-language field once booking source language is fixed to English"
  );
  assert.match(
    i18nSource,
    /export function bookingSourceLang\(fallback = DEFAULT_BOOKING_SOURCE_LANG\) \{\s*return normalizeBookingSourceLang\(fallback \|\| DEFAULT_BOOKING_SOURCE_LANG\);\s*\}/,
    "Booking i18n helpers should keep English as the fixed booking customer-content source language"
  );
  assert.doesNotMatch(
    i18nSource,
    /export function bookingSourceLang\(fallback = DEFAULT_BOOKING_SOURCE_LANG\) \{[\s\S]*window\.backendI18n\?\.getLang/,
    "Booking source helpers should not derive customer-content source language from the active backend chrome language"
  );
  assert.match(
    bookingPageDataSource,
    /fetchApi\(withBookingContentLang\(bookingDetailRequest\(\{[\s\S]*applyBookingPayload\(bookingPayload,\s*\{\s*forceDraftReset:\s*true\s*\}\);/,
    "Booking page loads should request booking detail with booking language query semantics and apply that payload directly"
  );
  assert.doesNotMatch(
    bookingPageDataSource,
    /syncBookingEditingLanguageToSelectedStaffLanguage|bookingSourceLanguageRequest/,
    "Booking page load should not mutate persisted booking state just to mirror any backend chrome language"
  );
  assert.match(
    bookingPageDataSource,
    /state\.lastMutationError = \{[\s\S]*status: response\.status[\s\S]*payload/,
    "Booking mutation requests should retain the last HTTP error metadata for compatibility and diagnostics"
  );
  assert.doesNotMatch(
    bookingPageLanguageSource,
    /resolveSubmissionEditingLanguage|populateEditingLanguageSelect|syncEditingLanguageSelector|handleEditingLanguageChange/,
    "The booking page language controller should no longer manage a separate editing-language selector"
  );
  assert.match(
    bookingPageLanguageSource,
    /function withBookingContentLang\(pathname, params = \{\}\) \{[\s\S]*bookingLanguageQuery\(\{[\s\S]*url\.searchParams\.set\("content_lang", query\.content_lang\);[\s\S]*url\.searchParams\.set\("source_lang", query\.source_lang\);/,
    "Booking API URLs should carry explicit content and source language query parameters instead of overloading `lang`"
  );
  assert.doesNotMatch(
    bookingHandlersSource,
    /handlePatchBookingEditingLanguage/,
    "Booking handler composition should no longer expose the removed editing-language patch handler"
  );
  assert.doesNotMatch(
    routesSource,
    /\/editing-language/,
    "The booking editing-language route should be removed from the backend route table"
  );
});

test("booking source and referral labels are routed through backend i18n", async () => {
  const bookingCorePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "core.js");
  const englishTranslationsPath = path.resolve(__dirname, "..", "..", "..", "frontend", "data", "i18n", "backend", "en.json");
  const vietnameseTranslationsPath = path.resolve(__dirname, "..", "..", "..", "frontend", "data", "i18n", "backend", "vi.json");
  const [coreSource, englishTranslations, vietnameseTranslations] = await Promise.all([
    readFile(bookingCorePath, "utf8"),
    readFile(englishTranslationsPath, "utf8"),
    readFile(vietnameseTranslationsPath, "utf8")
  ]);

  assert.match(
    coreSource,
    /const BOOKING_SOURCE_CHANNEL_OPTIONS = Object\.freeze\(\[[\s\S]*labelKey: "booking\.source_channel\.option\.website"[\s\S]*els\.sourceChannelSelect\.innerHTML = BOOKING_SOURCE_CHANNEL_OPTIONS[\s\S]*bookingT\(option\.labelKey,\s*option\.labelFallback\)/,
    "Booking source-channel options should render through backend i18n instead of hard-coded English labels"
  );
  assert.match(
    coreSource,
    /const BOOKING_REFERRAL_KIND_OPTIONS = Object\.freeze\(\[[\s\S]*labelKey: "booking\.referral\.kind\.other_customer"[\s\S]*els\.referralKindSelect\.innerHTML = BOOKING_REFERRAL_KIND_OPTIONS[\s\S]*bookingT\(option\.labelKey,\s*option\.labelFallback\)/,
    "Booking referral-kind options should render through backend i18n instead of hard-coded English labels"
  );
  assert.match(
    englishTranslations,
    /"booking\.referral\.customer_name": "Customer name"[\s\S]*"booking\.referral\.kind\.b2b_partner": "B2B partner"[\s\S]*"booking\.source_channel\.option\.facebook_messenger": "Facebook Messenger"/,
    "English booking translations should define the source-channel and referral labels used by the booking page"
  );
  assert.match(
    vietnameseTranslations,
    /"booking\.note_title": "Ghi chú booking \(nội bộ ATP\)"[\s\S]*"booking\.referral\.customer_name": "Tên khách hàng"[\s\S]*"booking\.source_channel\.option\.phone_call": "Cuộc gọi điện thoại"/,
    "Vietnamese booking translations should localize ATP-internal labels and booking source/referral labels"
  );
});

test("full booking reloads force-reset core drafts so discard restores saved values", async () => {
  const bookingPageDataModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking_page_data.js");
  const coreModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "core.js");
  const bookingPageDataSource = await readFile(bookingPageDataModulePath, "utf8");
  const coreSource = await readFile(coreModulePath, "utf8");

  assert.match(
    bookingPageDataSource,
    /applyBookingPayload\(bookingPayload,\s*\{\s*forceDraftReset:\s*true\s*\}\);/,
    "A full booking reload should force-reset local drafts from the freshly fetched backend payload"
  );
  assert.match(
    coreSource,
    /function applyBookingPayload\(payload = \{\}, options = \{\}\)\s*\{[\s\S]*?syncCoreDraftFromBooking\(\{\s*force:\s*options\.forceDraftReset === true\s*\}\);/,
    "The core booking module should accept a forced draft reset so discard restores saved booking details and notes"
  );
});

test("offer editor persists only through explicit page save", async () => {
  const offerSavePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offer_save.js");
  const offerSaveSource = await readFile(offerSavePath, "utf8");

  assert.doesNotMatch(
    offerSaveSource,
    /createQueuedAutosaveController/,
    "Offer save controller should no longer depend on a queued autosave helper"
  );
  assert.match(
    offerSaveSource,
    /async function saveOffer\(\)\s*\{\s*return await persistOffer\(\);\s*\}/,
    "Offer drafts should only persist through the explicit save path"
  );
});

test("booking page logs reload-time dirty diagnostics and core comparisons ignore inactive referral fields", async () => {
  const bookingPageModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const coreModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "core.js");
  const travelPlanModulePath = travelPlanEditorCorePath();
  const travelPlanHelpersModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_helpers.js");
  const [bookingPageSource, coreSource, travelPlanSource, travelPlanHelpersSource] = await Promise.all([
    readFile(bookingPageModulePath, "utf8"),
    readFile(coreModulePath, "utf8"),
    readFile(travelPlanModulePath, "utf8"),
    readFile(travelPlanHelpersModulePath, "utf8")
  ]);

  assert.match(
    bookingPageSource,
    /function setBookingSectionDirty\(sectionKey,\s*isDirty,\s*diagnostic = undefined\)/,
    "The booking page should accept optional section dirty diagnostics from child modules"
  );
  assert.match(
    bookingPageSource,
    /\[booking-dirty\] Booking page loaded with unsaved state after refresh\./,
    "The booking page should log a reload-specific dirty summary when a fresh load still comes back dirty"
  );
  assert.match(
    coreSource,
    /function normalizeCoreComparableState\(values = \{\}\) \{[\s\S]*referralKind === "b2b_partner" \|\| referralKind === "other_customer"[\s\S]*referralKind === "atp_staff"/,
    "Core dirty comparisons should clear irrelevant referral fields so stale backend-only values do not manufacture a dirty state"
  );
  assert.match(
    travelPlanSource,
    /reason: "travel_plan_snapshot_mismatch"/,
    "Travel-plan dirty diagnostics should include a concrete snapshot mismatch reason for reload debugging"
  );
  assert.match(
    travelPlanSource,
    /function getTravelPlanNormalizationOptions\(\) \{[\s\S]*sourceLang:\s*bookingSourceLang\(\)/,
    "Travel-plan normalization should use the fixed English booking source language"
  );
  assert.match(
    travelPlanHelpersSource,
    /function normalizeDraftLocalizedPayload\(source, field, sourceLang, targetLang\) \{[\s\S]*mergeDualLocalizedPayload\(existingValue, sourceValue, localizedValue, targetLang, sourceLang\)[\s\S]*export function normalizeTravelPlanDraft\(plan, options = \{\}\) \{[\s\S]*const sourceLang = normalizeBookingSourceLang\([\s\S]*bookingSourceLang\("en"\)[\s\S]*const titleField = normalizeDraftLocalizedPayload\(rawDay, "title", sourceLang, targetLang\)/,
    "Travel-plan helper normalization should accept an explicit source language, fall back to the fixed English booking source language, and preserve localized maps"
  );
});

test("standalone generated offer controls are removed from the booking page", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const offersModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offers.js");
  const bookingSource = await readFile(bookingPagePath, "utf8");
  const offersSource = await readFile(offersModulePath, "utf8");

  assert.doesNotMatch(
    bookingSource,
    /id="generate_offer_btn"|id="generate_offer_dirty_hint"|data-generated-offer-save-comment=|data-generated-offer-delete=|data-generated-offer-email=|booking-generated-offers-actions__hint/,
    "The removed standalone generated-offer controls should no longer render in booking.html"
  );
  assert.doesNotMatch(
    bookingSource,
    /id="pricing_management_approval_btn"/,
    "The Payments section should no longer expose the old management-approval action"
  );
  assert.doesNotMatch(
    offersSource,
    /offer_generated_offers/,
    "The standalone generated-offer module should no longer be wired into the offer page"
  );
});

test("persons and travel plan editors no longer autosave from local interactions while service image changes use clean-state mutations", async () => {
  const personsModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "persons.js");
  const travelPlanModulePath = travelPlanEditorCorePath();
  const travelPlanImagesModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_images.js");
  const personsSource = await readFile(personsModulePath, "utf8");
  const travelPlanSource = await readFile(travelPlanModulePath, "utf8");
  const travelPlanImagesSource = await readFile(travelPlanImagesModulePath, "utf8");

  assert.doesNotMatch(
    personsSource,
    /createQueuedAutosaveController|await savePersonDrafts\(draft\.id\)/,
    "Person drafts should stay local until the page save bar is used"
  );
  assert.doesNotMatch(
    travelPlanSource,
    /createQueuedAutosaveController|scheduleTravelPlanAutosave/,
    "Travel plan edits should stay local until the page save bar is used"
  );
  assert.match(
    travelPlanImagesSource,
    /bookingTravelPlanServiceImageDeleteRequest[\s\S]*function removeTravelPlanServiceImage\(dayId, itemId, imageId\)\s*\{[\s\S]*ensureTravelPlanReadyForMutation\(\)[\s\S]*createServiceImageDeleteRequest\([\s\S]*applyTravelPlanMutationBooking\(result\.booking,\s*\{\s*preserveCollapsedState:\s*true\s*\}\)[\s\S]*loadActivities\(\)/,
    "Removing a travel plan image should use the dedicated delete endpoint, refresh persisted booking state, and keep the editor collapse state stable"
  );
  assert.match(
    travelPlanImagesSource,
    /bookingTravelPlanServiceImageUploadRequest[\s\S]*applyTravelPlanMutationBooking\(result\.booking,\s*\{\s*preserveCollapsedState:\s*true\s*\}\)/,
    "Uploading a travel plan image should also preserve the current service collapse state"
  );
  assert.match(
    travelPlanImagesSource,
    /data-travel-plan-remove-image="\$\{escapeHtml\(image\.id\)\}"[\s\S]*data-requires-clean-state/,
    "Travel plan image removal should be blocked while the page has other unsaved edits"
  );
});

test("offer page no longer wires standalone generated-offer email actions", async () => {
  const offersModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offers.js");
  const offersSource = await readFile(offersModulePath, "utf8");

  assert.doesNotMatch(
    offersSource,
    /generated_offer_email_enabled/,
    "The offer page should not render or gate removed standalone generated-offer email actions"
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

test("booking stage artifacts are removed from the model and generated contract", async () => {
  const modelPath = path.resolve(__dirname, "..", "..", "..", "model", "root.cue");
  const runtimePath = path.resolve(__dirname, "..", "src", "config", "runtime.js");
  const openApiPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "openapi.yaml");
  const mobileMetaPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "mobile-api.meta.json");
  const generatedBookingPath = path.resolve(__dirname, "..", "..", "..", "shared", "generated-contract", "Models", "generated_Booking.js");
  const generatedSchemaRuntimePath = path.resolve(__dirname, "..", "..", "..", "shared", "generated-contract", "Models", "generated_SchemaRuntime.js");

  const [
    modelSource,
    runtimeSource,
    openApiSource,
    mobileMetaSource,
    generatedBookingSource,
    generatedSchemaRuntimeSource
  ] = await Promise.all([
    readFile(modelPath, "utf8"),
    readFile(runtimePath, "utf8"),
    readFile(openApiPath, "utf8"),
    readFile(mobileMetaPath, "utf8"),
    readFile(generatedBookingPath, "utf8"),
    readFile(generatedSchemaRuntimePath, "utf8")
  ]);

  assert.doesNotMatch(modelSource, /BookingStage|BookingMilestoneActionRequest/, "The model root should not export stage or milestone-action types");
  assert.doesNotMatch(runtimeSource, /computeServiceLevelAgreementDueAt/, "Runtime config should no longer ship stage-derived SLA helpers");
  assert.doesNotMatch(openApiSource, /BookingStage|BookingMilestoneActionRequest|\/milestone-actions/, "Generated OpenAPI should not expose stage or milestone-action artifacts");
  assert.doesNotMatch(mobileMetaSource, /"stages"\s*:/, "Mobile bootstrap metadata should drop the legacy stages catalog entirely");
  assert.doesNotMatch(generatedBookingSource, /BookingStage|BookingMilestones|GENERATED_BOOKING_STAGES/, "Generated booking models should not reference booking stages or milestones");
  assert.doesNotMatch(generatedSchemaRuntimeSource, /BookingStage|BookingMilestones|BookingMilestoneAction/, "Generated schema runtime should not register booking stage artifacts");
});

test("booking read models and backend startup strip legacy stage persistence fields", async () => {
  const bookingViewsPath = path.resolve(__dirname, "..", "src", "domain", "booking_views.js");
  const serverPath = path.resolve(__dirname, "..", "src", "server.js");
  const [bookingViewsSource, serverSource] = await Promise.all([
    readFile(bookingViewsPath, "utf8"),
    readFile(serverPath, "utf8")
  ]);

  assert.match(
    bookingViewsSource,
    /stage:\s*_legacyStage,[\s\S]*milestones:\s*_legacyMilestones,[\s\S]*last_action:\s*_legacyLastAction,[\s\S]*last_action_at:\s*_legacyLastActionAt,[\s\S]*service_level_agreement_due_at:\s*_legacyServiceLevelAgreementDueAt,[\s\S]*\.\.\.normalizedBooking/,
    "Booking read models should drop legacy stage persistence fields before spreading the normalized booking payload"
  );
  assert.match(
    serverSource,
    /function pruneLegacyBookingState\(store\) \{[\s\S]*delete booking\.stage;[\s\S]*delete booking\.milestones;[\s\S]*delete booking\.last_action;[\s\S]*delete booking\.last_action_at;[\s\S]*delete booking\.service_level_agreement_due_at;[\s\S]*\}[\s\S]*const prunedLegacyBookingState = pruneLegacyBookingState\(startupStore\);[\s\S]*\|\| prunedLegacyBookingState[\s\S]*persistStore\(startupStore\)/,
    "Backend startup should prune persisted legacy booking stage fields before serving requests"
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
  const bookingPageDataModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking_page_data.js");
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const travelPlanModulePath = travelPlanEditorCorePath();
  const moduleSource = await readFile(bookingPageModulePath, "utf8");
  const dataModuleSource = await readFile(bookingPageDataModulePath, "utf8");
  const pageSource = await readFile(bookingPagePath, "utf8");
  const travelPlanSource = await readFile(travelPlanModulePath, "utf8");

  assert.match(
    moduleSource,
    /import \{ createBookingTravelPlanModule \} from "\.\.\/booking\/travel_plan\.js"/,
    "booking.js should import the dedicated travel-plan module"
  );
  assert.match(
    moduleSource,
    /let travelPlanModule = null;[\s\S]*travelPlanModule = createBookingTravelPlanModule\(/,
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
    dataModuleSource,
    /renderTravelPlanPanel\(\);[\s\S]*?renderOfferPanel\(\);/,
    "booking_page_data.js should render Travel plan before the Offer section"
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

test("travel-plan module preserves add/remove/reorder editing helpers", async () => {
  const travelPlanModulePath = travelPlanEditorCorePath();
  const travelPlanHelpersPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_helpers.js");
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const generatedCatalogsPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "generated_catalogs.js");
  const [source, helperSource, bookingPageSource] = await Promise.all([
    readFile(travelPlanModulePath, "utf8"),
    readFile(travelPlanHelpersPath, "utf8"),
    readFile(bookingPagePath, "utf8")
  ]);
  const generatedCatalogs = await import(`${pathToFileURL(generatedCatalogsPath).href}?test=${Date.now()}`);

  for (const helperName of ["addDay", "removeDay", "addItem", "removeItem", "moveItem"]) {
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
    /data-travel-plan-service-field="timing_kind"/,
    "travel_plan.js should render a timing mode selector for each item"
  );
  assert.match(
    source,
    /data-travel-plan-service-field="time_point_date"/,
    "travel_plan.js should render a date input for point timing mode"
  );
  assert.match(
    source,
    /data-travel-plan-service-field="time_point_time"/,
    "travel_plan.js should render a 5-minute time selector for point timing mode"
  );
  assert.match(
    source,
    /data-travel-plan-service-field="start_time_date"/,
    "travel_plan.js should render a start-date input for range timing mode"
  );
  assert.match(
    source,
    /data-travel-plan-service-field="start_time_time"/,
    "travel_plan.js should render a start-time selector for range timing mode"
  );
  assert.match(
    source,
    /data-travel-plan-service-field="end_time_date"/,
    "travel_plan.js should render an end-date input for range timing mode"
  );
  assert.match(
    source,
    /data-travel-plan-service-field="end_time_time"/,
    "travel_plan.js should render an end-time selector for range timing mode"
  );
  assert.match(
    source,
    /function suggestedNextTravelPlanDayDate\(dayIndex\)[\s\S]*data-travel-plan-apply-next-day[\s\S]*booking\.travel_plan\.next_day/,
    "travel_plan.js should offer a next-day suggestion button when a blank day follows a dated day"
  );
  assert.match(
    source,
    /for \(let minute = 0; minute < 60; minute \+= 5\)/,
    "travel_plan.js should offer 5-minute time increments instead of free one-minute entry"
  );
  assert.match(
    source,
    /function renderTravelPlanLocalizedField\(\{[\s\S]*sourceValue = ""[\s\S]*renderLocalizedStackedField\(\{[\s\S]*targetLang: bookingSourceLang\(\),[\s\S]*translateEnabled: false,[\s\S]*sourceValue,/,
    "booking travel-plan editor fields should render only the English source fields without inline translation controls"
  );
  assert.match(
    source,
    /if \(!localizedInput\) \{[\s\S]*normalizeLocalizedEditorMap\(existingValue, sourceLang\)[\s\S]*nextMap\[sourceLang\] = sourceValue/,
    "travel-plan DOM sync should preserve review-panel translations when inline target fields are absent"
  );
  assert.doesNotMatch(
    bookingPageSource,
    /travel_plan_translate_all_btn/,
    "booking.html should not expose the old inline Translate everything travel-plan button"
  );
  assert.doesNotMatch(
    source,
    /type="datetime-local"/,
    "travel_plan.js should no longer rely on datetime-local inputs for timing mode selection"
  );
  assert.equal(
    generatedCatalogs.TRAVEL_PLAN_TIMING_KIND_OPTIONS.length,
    4,
    "Generated Travel plan timing options should stay populated from the schema runtime"
  );
  assert.deepEqual(
    generatedCatalogs.TRAVEL_PLAN_TIMING_KIND_OPTIONS.map((option) => option.value),
    ["label", "not_applicable", "point", "range"]
  );
  assert.match(
    helperSource,
    /option\.value === "not_applicable"[\s\S]*"Not applicable"/,
    "Travel-plan timing helper labels should localize the not_applicable timing mode"
  );
  assert.match(
    source,
    /timingKind === "not_applicable"[\s\S]*booking\.travel_plan\.timing_kind\.not_applicable/,
    "travel_plan.js should render and summarize the not_applicable timing mode"
  );
});

test("travel-plan service image text stays wired across model, API, backend, translation review, and UI", async () => {
  const modelPath = path.resolve(__dirname, "..", "..", "..", "model", "database", "travel_plan.cue");
  const openApiPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "openapi.yaml");
  const backendPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "domain", "travel_plan.js");
  const translationPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "domain", "booking_translation.js");
  const helperPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_helpers.js");
  const uiPath = travelPlanEditorCorePath();
  const tourUiPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tour.js");
  const [modelSource, openApiSource, backendSource, translationSource, helperSource, uiSource, tourUiSource] = await Promise.all([
    readFile(modelPath, "utf8"),
    readFile(openApiPath, "utf8"),
    readFile(backendPath, "utf8"),
    readFile(translationPath, "utf8"),
    readFile(helperPath, "utf8"),
    readFile(uiPath, "utf8"),
    readFile(tourUiPath, "utf8")
  ]);

  assert.match(
    modelSource,
    /image_subtitle\?:\s+string/,
    "The travel-plan service model should expose an optional image subtitle field"
  );
  assert.match(
    modelSource,
    /image_subtitle_i18n\?:\s+\[string\]:\s+string/,
    "The travel-plan service model should expose localized image subtitles"
  );
  assert.match(
    modelSource,
    /caption_i18n\?:\s+\[string\]:\s+string[\s\S]*alt_text_i18n\?:\s+\[string\]:\s+string/,
    "The travel-plan service image model should expose localized caption and alt text"
  );
  assert.match(
    openApiSource,
    /image_subtitle:\n\s+type: string\n\s+nullable: true/,
    "The OpenAPI contract should expose the optional travel-plan service image subtitle"
  );
  assert.match(
    openApiSource,
    /image_subtitle_i18n:\n\s+type: object\n\s+additionalProperties:\n\s+type: string\n\s+nullable: true/,
    "The OpenAPI contract should expose localized travel-plan service image subtitles"
  );
  assert.match(
    openApiSource,
    /caption_i18n:\n\s+type: object\n\s+additionalProperties:\n\s+type: string\n\s+nullable: true[\s\S]*alt_text_i18n:\n\s+type: object\n\s+additionalProperties:\n\s+type: string\n\s+nullable: true/,
    "The OpenAPI contract should expose localized travel-plan service image caption and alt text"
  );
  assert.match(
    backendSource,
    /normalizeTravelPlanLocalizedField\(rawItem\?\.image_subtitle_i18n,\s*rawItem\?\.image_subtitle/,
    "The backend travel-plan normalizer should read localized service image subtitles"
  );
  assert.match(
    backendSource,
    /image_subtitle:\s+imageSubtitleField\.text \|\| null,[\s\S]*image_subtitle_i18n:\s+imageSubtitleField\.map/,
    "The backend travel-plan normalizer should persist localized service image subtitles"
  );
  assert.match(
    backendSource,
    /const captionField = normalizeTravelPlanLocalizedField\(rawImage\.caption_i18n,\s*rawImage\.caption,\s*options\);[\s\S]*const altTextField = normalizeTravelPlanLocalizedField\(rawImage\.alt_text_i18n,\s*rawImage\.alt_text,\s*options\);[\s\S]*caption_i18n:\s+captionField\.map,[\s\S]*alt_text_i18n:\s+altTextField\.map/,
    "The backend travel-plan normalizer should persist localized service image caption and alt text"
  );
  assert.match(
    translationSource,
    /key:\s+`travel_plan\.\$\{dayId\}\.\$\{itemId\}\.image_subtitle`[\s\S]*mapField:\s+"image_subtitle_i18n"[\s\S]*plainField:\s+"image_subtitle"/,
    "The backend translation collector should include service image subtitles"
  );
  assert.match(
    translationSource,
    /key:\s+`travel_plan\.\$\{dayId\}\.\$\{itemId\}\.image\.caption`[\s\S]*mapField:\s+"caption_i18n"[\s\S]*plainField:\s+"caption"[\s\S]*key:\s+`travel_plan\.\$\{dayId\}\.\$\{itemId\}\.image\.alt_text`[\s\S]*mapField:\s+"alt_text_i18n"[\s\S]*plainField:\s+"alt_text"/,
    "The backend translation collector should include service image caption and alt text"
  );
  assert.match(
    helperSource,
    /image_subtitle:\s+""[\s\S]*image_subtitle_i18n:\s+\{\}/,
    "The frontend travel-plan helpers should seed localized service image subtitles"
  );
  assert.match(
    helperSource,
    /const imageSubtitleField = normalizeDraftLocalizedPayload\(rawItem,\s+"image_subtitle",\s+sourceLang,\s+targetLang\)/,
    "The frontend travel-plan helpers should normalize localized service image subtitles"
  );
  assert.match(
    helperSource,
    /image_subtitle:\s+imageSubtitleField\.text,[\s\S]*image_subtitle_i18n:\s+imageSubtitleField\.map/,
    "The frontend travel-plan helpers should persist localized service image subtitles"
  );
  assert.match(
    helperSource,
    /const captionField = normalizeDraftLocalizedPayload\(rawImage,\s+"caption",\s+sourceLang,\s+targetLang\);[\s\S]*const altTextField = normalizeDraftLocalizedPayload\(rawImage,\s+"alt_text",\s+sourceLang,\s+targetLang\);[\s\S]*caption_i18n:\s+captionField\.map,[\s\S]*alt_text_i18n:\s+altTextField\.map/,
    "The frontend travel-plan helpers should normalize localized service image caption and alt text"
  );
  assert.match(
    uiSource,
    /field:\s+"image_subtitle"[\s\S]*item\.image_subtitle_i18n = itemImageSubtitle\.map/,
    "The travel-plan editor should render and save localized service image subtitles"
  );
  assert.match(
    uiSource,
    /mapField:\s+"image_subtitle_i18n"[\s\S]*plainField:\s+"image_subtitle"[\s\S]*key:\s+`travel_plan\.\$\{dayId\}\.\$\{serviceId\}\.image_subtitle`/,
    "The booking frontend translation review should include service image subtitles"
  );
  assert.match(
    uiSource,
    /mapField:\s+"caption_i18n"[\s\S]*plainField:\s+"caption"[\s\S]*key:\s+`travel_plan\.\$\{dayId\}\.\$\{serviceId\}\.image\.caption`[\s\S]*mapField:\s+"alt_text_i18n"[\s\S]*plainField:\s+"alt_text"[\s\S]*key:\s+`travel_plan\.\$\{dayId\}\.\$\{serviceId\}\.image\.alt_text`/,
    "The booking frontend translation review should include service image caption and alt text"
  );
  assert.match(
    tourUiSource,
    /mapField:\s+"image_subtitle_i18n"[\s\S]*plainField:\s+"image_subtitle"[\s\S]*key:\s+`travel_plan\.\$\{dayId\}\.\$\{serviceId\}\.image_subtitle`/,
    "The marketing-tour frontend translation review should include service image subtitles"
  );
  assert.match(
    tourUiSource,
    /mapField:\s+"caption_i18n"[\s\S]*plainField:\s+"caption"[\s\S]*key:\s+`travel_plan\.\$\{dayId\}\.\$\{serviceId\}\.image\.caption`[\s\S]*mapField:\s+"alt_text_i18n"[\s\S]*plainField:\s+"alt_text"[\s\S]*key:\s+`travel_plan\.\$\{dayId\}\.\$\{serviceId\}\.image\.alt_text`/,
    "The marketing-tour frontend translation review should include service image caption and alt text"
  );
});

test("travel-plan day date presets stay wired across model, API, backend, and UI", async () => {
  const modelPath = path.resolve(__dirname, "..", "..", "..", "model", "database", "travel_plan.cue");
  const openApiPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "openapi.yaml");
  const backendPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "domain", "travel_plan.js");
  const helperPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_helpers.js");
  const uiPath = travelPlanEditorCorePath();
  const travelPlanStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking-travel-plan.css");
  const [modelSource, openApiSource, backendSource, helperSource, uiSource, travelPlanStyles] = await Promise.all([
    readFile(modelPath, "utf8"),
    readFile(openApiPath, "utf8"),
    readFile(backendPath, "utf8"),
    readFile(helperPath, "utf8"),
    readFile(uiPath, "utf8"),
    readFile(travelPlanStylesPath, "utf8")
  ]);

  assert.match(
    modelSource,
    /date_string\?:\s+string/,
    "The travel-plan day model should expose an optional date_string field for preset labels"
  );
  assert.match(
    openApiSource,
    /BookingTravelPlanDay:[\s\S]*date_string:\n\s+type: string\n\s+nullable: true/,
    "The OpenAPI contract should expose the optional travel-plan day date_string"
  );
  assert.match(
    backendSource,
    /date_string: normalizedDate \? null : normalizeOptionalText\(day\?\.date_string\)/,
    "The backend travel-plan normalizer should persist the optional day date_string when no concrete date is set"
  );
  assert.match(
    helperSource,
    /date_string: normalizedDate \? "" : normalizeOptionalText\(rawDay\.date_string\)/,
    "The frontend travel-plan helper should normalize the optional day date_string"
  );
  assert.match(
    uiSource,
    /data-travel-plan-day-field="date_string"|data-travel-plan-set-date-string/,
    "The booking travel-plan UI should expose the day date preset controls and hidden date_string field"
  );
  assert.match(
    travelPlanStyles,
    /\.booking-detail-page \.travel-plan-day__date-shortcut\.is-active \{[\s\S]*color: var\(--text-black\);/,
    "The active travel-plan day date preset should use black text"
  );
});

test("travel plan PDF personalization exposes and persists traveler-list toggles for both PDF types", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingCorePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "core.js");
  const pdfPanelModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "pdf_personalization_panel.js");
  const bookingPdfPersonalizationPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "lib", "booking_pdf_personalization.js");
  const travelPlanPdfPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "lib", "travel_plan_pdf.js");
  const [pageSource, coreSource, pdfPanelModuleSource, personalizationSource, travelPlanPdfSource] = await Promise.all([
    readFile(bookingPagePath, "utf8"),
    readFile(bookingCorePath, "utf8"),
    readFile(pdfPanelModulePath, "utf8"),
    readFile(bookingPdfPersonalizationPath, "utf8"),
    readFile(travelPlanPdfPath, "utf8")
  ]);

  assert.doesNotMatch(
    pageSource,
    /id="booking_pdf_travel_plan_include_who_is_traveling_mount"/,
    "booking.html should not hand-copy the Travel plan PDF traveler-list toggle mount"
  );
  assert.doesNotMatch(
    pageSource,
    /id="booking_pdf_offer_include_who_is_traveling_mount"/,
    "booking.html should not hand-copy the Offer PDF traveler-list toggle mount"
  );
  assert.match(
    pdfPanelModuleSource,
    /scope:\s*"travel_plan"[\s\S]*field:\s*"include_who_is_traveling"[\s\S]*scope:\s*"offer"[\s\S]*field:\s*"include_who_is_traveling"/,
    "The reusable PDF personalization panel config should define traveler-list toggles for both PDF types"
  );
  assert.match(
    coreSource,
    /include_who_is_traveling:\s*travelPlan\.include_who_is_traveling === true/,
    "booking core should normalize the Travel plan PDF traveler-list toggle"
  );
  assert.match(
    coreSource,
    /include_who_is_traveling:\s*offer\.include_who_is_traveling !== false/,
    "booking core should normalize the Offer PDF traveler-list toggle"
  );
  assert.match(
    coreSource,
    /const renderToggle = \(mount, scope, config\) => \{[\s\S]*mount\.innerHTML = buildBookingPdfToggleMarkup\([\s\S]*dataAttributeName: "booking-pdf-toggle"[\s\S]*dataAttributeValue: `\$\{scope\}\.\$\{config\.field\}`/,
    "booking core should render traveler-list toggles through the shared checkbox renderer"
  );
  assert.match(
    personalizationSource,
    /include_who_is_traveling:\s*offerIncludeWhoIsTraveling/,
    "backend PDF personalization should preserve the Offer traveler-list toggle"
  );
  assert.match(
    travelPlanPdfSource,
    /include_who_is_traveling === true[\s\S]*drawPdfTravelersSection/,
    "travel_plan_pdf.js should render the traveler list only when the toggle is enabled"
  );
  assert.match(
    coreSource,
    /const checked = config\.defaultChecked === true[\s\S]*branch\?\.\[config\.field\] !== false[\s\S]*branch\?\.\[config\.field\] === true/,
    "booking core should preserve both default-on and default-off checkbox behavior in the shared toggle renderer"
  );
});

test("tour page reads month options from the generated catalogs layer", async () => {
  const tourPageModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tour.js");
  const tourTravelPlanAdapterPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tour_travel_plan_adapter.js");
  const tourPageHtmlPath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "marketing_tour.html");
  const toursListHtmlPath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "marketing_tours.html");
  const toursListModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tours_list.js");
  const generatedCatalogsPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "generated_catalogs.js");
  const travelPlanCorePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "travel_plan_editor_core.js");
  const [tourSource, tourTravelPlanAdapterSource, tourHtml, toursListHtml, toursListSource, travelPlanCoreSource] = await Promise.all([
    readFile(tourPageModulePath, "utf8"),
    readFile(tourTravelPlanAdapterPath, "utf8"),
    readFile(tourPageHtmlPath, "utf8"),
    readFile(toursListHtmlPath, "utf8"),
    readFile(toursListModulePath, "utf8"),
    readFile(travelPlanCorePath, "utf8")
  ]);
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
    /id="tour_localized_content_editor"/,
    "Tour page should render the combined localized title and description editor mount"
  );
  assert.match(
    tourHtml,
    /id="tour_formStatus"/,
    "Tour page should render the save-status mount that tour.js writes validation and save feedback into"
  );
  assert.match(
    tourHtml,
    /<div class="field full">\s*<span class="field-label" data-i18n-id="tour\.styles_label">Tour Styles/,
    "Tour styles should span the full editor width"
  );
  assert.match(
    tourHtml,
    /id="tour_style_choices"[\s\S]*id="tour_destination_scope_editor"[\s\S]*id="tour_priority"/,
    "Tour destination/area/place controls should render below tour styles and above priority"
  );
  assert.match(
    tourSource,
    /travel_plan_destination_scope_editor: document\.getElementById\("tour_destination_scope_editor"\)/,
    "Tour page should wire the external route-scope editor mount"
  );
  assert.match(
    travelPlanCoreSource,
    /function usesExternalDestinationScopeEditor\(\)[\s\S]*travel_plan_destination_scope_editor[\s\S]*els\.travel_plan_editor/,
    "The shared travel-plan editor should support rendering destination scope outside the travel-plan day list"
  );
  assert.match(
    tourTravelPlanAdapterSource,
    /destinationScopeCreate:\s*false/,
    "Marketing-tour detail should only select existing destination-scope catalog entries"
  );
  assert.match(
    toursListHtml,
    /id="toursPagination"[\s\S]*id="tourDestinationCatalogPanel"/,
    "The marketing tours list should place the destinations catalog manager at the bottom"
  );
  assert.doesNotMatch(
    toursListHtml,
    /id="toursDestination"/,
    "The marketing tours list should not keep the old destination dropdown"
  );
  assert.match(
    toursListHtml,
    /id="toursDestinationScopeFilter"/,
    "The marketing tours list should render the structured destination/area/place filter"
  );
  assert.match(
    toursListSource,
    /destinationScopeAreaCreateRequest[\s\S]*destinationScopeCatalogRequest[\s\S]*destinationScopeDestinationCreateRequest[\s\S]*destinationScopePlaceCreateRequest[\s\S]*data-destination-filter/,
    "The marketing tours list should manage destinations, areas, and places through the destination-scope APIs"
  );
  assert.doesNotMatch(
    tourHtml,
    /id="tour_title_edit_btn"/,
    "Tour page should no longer render the inline header pen button"
  );
  assert.doesNotMatch(
    tourHtml,
    /id="tour_title_input"/,
    "Tour page should no longer render the old header title input"
  );
  assert.doesNotMatch(
    tourHtml,
    /tour_picture_list|tour_add_picture_btn|tour_picture_upload/,
    "Tour page should no longer render the standalone tour picture editor"
  );
  assert.doesNotMatch(
    tourSource,
    /pictureUpload|createPendingPictureDraftItem|renderTourPictures|tourPictureUploadRequest|tourPictureDeleteRequest/,
    "Tour page should no longer stage or persist standalone tour pictures"
  );
  assert.match(
    tourTravelPlanAdapterSource,
    /tourCardImageSelection:\s*true/,
    "Marketing-tour travel-plan editor should enable service-image selection for tour cards"
  );
  assert.match(
    tourSource,
    /function buildTourSaveValidationMessage\([\s\S]*showError\(validationMessage\);[\s\S]*setStatus\(validationMessage\);/,
    "Tour save validation should show a visible blocking reason instead of failing silently"
  );
  assert.match(
    tourSource,
    /expectedUpdatedAt = normalizeText\(state\.tour\?\.updated_at\);[\s\S]*payload\.expected_updated_at = expectedUpdatedAt;/,
    "Existing marketing-tour saves should send the timestamp loaded by the editor for optimistic conflict detection"
  );
  assert.match(
    tourSource,
    /function staleTourUpdateMessage\(\)[\s\S]*This tour was updated by someone else\. Reload before saving\./,
    "Marketing-tour saves should define a specific stale-edit message"
  );
  assert.match(
    tourSource,
    /response\?\.status === 409 && payload\?\.code === "TOUR_REVISION_MISMATCH"[\s\S]*staleTourUpdateMessage\(\)/,
    "Marketing-tour saves should show a specific stale-edit message on revision conflicts"
  );
});

test("tour card images are selected from travel-plan service images", async () => {
  const toursSupportPath = path.resolve(__dirname, "..", "src", "domain", "tours_support.js");
  const toursHandlerPath = path.resolve(__dirname, "..", "src", "http", "handlers", "tours.js");
  const travelPlanModelPath = path.resolve(__dirname, "..", "..", "..", "model", "database", "travel_plan.cue");
  const homepageGeneratorPath = path.resolve(__dirname, "..", "..", "..", "scripts", "assets", "generate_public_homepage_assets.mjs");
  const [toursSupportSource, toursHandlerSource, travelPlanModelSource, homepageGeneratorSource] = await Promise.all([
    readFile(toursSupportPath, "utf8"),
    readFile(toursHandlerPath, "utf8"),
    readFile(travelPlanModelPath, "utf8"),
    readFile(homepageGeneratorPath, "utf8")
  ]);

  assert.match(
    toursHandlerSource,
    /sendFileWithCache\(req, res, absolutePath, "public, max-age=31536000, immutable"\)/,
    "Public tour images should keep the long-lived immutable cache headers"
  );
  assert.match(
    travelPlanModelSource,
    /include_in_travel_tour_card\?: bool/,
    "Travel-plan service images should expose the tour-card inclusion flag"
  );
  assert.match(
    homepageGeneratorSource,
    /function selectedTravelTourCardImagePaths\(travelPlan\)[\s\S]*include_in_travel_tour_card !== true[\s\S]*const pictures = selectedTravelTourCardImagePaths\(travelPlan\)/,
    "Public homepage generation should derive tour-card pictures from selected service images"
  );
  assert.match(
    toursSupportSource,
    /delete next\.pictures;[\s\S]*delete next\.image;/,
    "Tour storage normalization should remove legacy tour-level picture fields"
  );
});

test("tour page keeps website content translations in the English-source review panel", async () => {
  const tourPageModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tour.js");
  const siteStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "site.css");
  const englishTranslationsPath = path.resolve(__dirname, "..", "..", "..", "frontend", "data", "i18n", "backend", "en.json");
  const [tourSource, siteStyles, englishTranslations] = await Promise.all([
    readFile(tourPageModulePath, "utf8"),
    readFile(siteStylesPath, "utf8"),
    readFile(englishTranslationsPath, "utf8")
  ]);

  assert.match(
    tourSource,
    /const TOUR_TRANSLATION_SOURCE_LANG = "en";/,
    "Marketing-tour website content should use English as the fixed translation source"
  );
  assert.match(
    tourSource,
    /const TOUR_DESCRIPTION_MAX_LENGTH = 170;/,
    "Marketing-tour English website descriptions should use the 170-character source limit"
  );
  assert.match(
    tourSource,
    /function normalizeTourShortDescriptionMap\(value, fallbackValue = ""\) \{[\s\S]*normalized\[TOUR_TRANSLATION_SOURCE_LANG\] = truncateTourSourceDescription\(normalized\[TOUR_TRANSLATION_SOURCE_LANG\]\)/,
    "Loading an existing marketing tour should truncate only the English source description"
  );
  assert.match(
    tourSource,
    /function renderLocalizedTourContentEditor\(\)\s*\{[\s\S]*const lang = TOUR_TRANSLATION_SOURCE_LANG;/,
    "The visible website title and description editor should render only the English source fields"
  );
  assert.match(
    tourSource,
    /data-tour-i18n-field="short_description_i18n"[\s\S]*maxlength="\$\{TOUR_DESCRIPTION_MAX_LENGTH\}"/,
    "The visible English source description textarea should prevent entering more than 170 characters"
  );
  assert.match(
    tourSource,
    /function shouldShowTourContentSourceCue\(\) \{[\s\S]*normalizeTourTextLang\(currentBackendLang\(\)\) === "vi";[\s\S]*\}/,
    "Vietnamese backend users should see the English source cue in front of website content source fields"
  );
  assert.doesNotMatch(
    tourSource,
    /headerCodeMarkup|tour-localized-group__code--inline/,
    "The website content editor should not render an inline EN marker after the Tour Title and description label"
  );
  assert.match(
    tourSource,
    /const sourceCueMarkup = showSourceCue[\s\S]*localized-pair__code tour-localized-content__source-code/,
    "The website content editor should keep field-level EN source cues for Vietnamese backend users"
  );
  assert.match(
    tourSource,
    /<div class="\$\{fieldClass\}">\s*\$\{sourceCueMarkup\}[\s\S]*data-tour-i18n-field="title_i18n"[\s\S]*<div class="\$\{fieldClass\}">\s*\$\{sourceCueMarkup\}[\s\S]*data-tour-i18n-field="short_description_i18n"/,
    "The visible tour title and description editor should render the source cue in front of both English source fields"
  );
  assert.match(
    siteStyles,
    /\.tour-localized-group__code--inline[\s\S]*\.tour-localized-group--content \.tour-localized-group__row \{[\s\S]*grid-template-columns: minmax\(0, 1fr\);[\s\S]*\.tour-localized-group--content \.tour-localized-group__header \{[\s\S]*padding-left: 0;/,
    "The marketing-tour content editor should keep the outer content row single-column"
  );
  assert.match(
    siteStyles,
    /\.tour-localized-content__field--source-code \{[\s\S]*grid-template-columns: 1\.35rem minmax\(0, 1fr\);/,
    "The Vietnamese backend source cue should reuse the same language-code column width as travel-plan day and service fields"
  );
  assert.match(
    englishTranslations,
    /"tour\.content_label": "Tour Title and description"/,
    "The marketing-tour content label should use the requested copy"
  );
  assert.match(
    tourSource,
    /key: "website\.title"[\s\S]*key: "website\.short_description"/,
    "The translation review field collector should include website title and description"
  );
  assert.match(
    tourSource,
    /requestTourTranslation\(targetLang, sourceEntries, \{\s*sourceLang: TRAVEL_PLAN_SOURCE_LANG\s*\}\)/,
    "Review-panel translation requests should explicitly translate from the English source language"
  );
  assert.match(
    tourSource,
    /function readLocalizedFields\(field,[\s\S]*normalizeLocalizedTextMap\(state\.localizedContent\?\.\[field\]/,
    "Saving should preserve translated website fields that are edited in the review panel instead of visible source inputs"
  );
});

test("travel style catalog stays generated from config and exposed through the generated schema helpers", async () => {
  const configPath = path.resolve(__dirname, "..", "..", "..", "config", "tour_style_catalog.json");
  const generatedCatalogPath = path.resolve(__dirname, "..", "..", "..", "shared", "generated", "tour_style_catalog.js");
  const generatedCatalogsPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "generated_catalogs.js");
  const source = JSON.parse(await readFile(configPath, "utf8"));
  const generatedCatalog = await import(`${pathToFileURL(generatedCatalogPath).href}?test=${Date.now()}`);
  const generatedCatalogs = await import(`${pathToFileURL(generatedCatalogsPath).href}?test=${Date.now()}`);

  assert.deepEqual(
    generatedCatalog.TOUR_STYLE_CODES,
    source.map((entry) => entry.code),
    "Generated tour style codes should stay in sync with config/tour_style_catalog.json"
  );
  assert.ok(
    generatedCatalogs.TOUR_STYLE_CODE_OPTIONS.some((option) => option.value === "wellness" && option.label === "Wellness"),
    "Generated schema helpers should expose the travel style enum options for frontend/admin use"
  );
});

test("settings page staff table shows combined Keycloak roles and status pills", async () => {
  const settingsPageModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "settings_list.js");
  const settingsPageHtmlPath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "settings.html");
  const siteCssPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "site.css");
  const source = await readFile(settingsPageModulePath, "utf8");
  const html = await readFile(settingsPageHtmlPath, "utf8");
  const css = await readFile(siteCssPath, "utf8");

  assert.match(
    source,
    /<th class="keycloak-roles-col">\$\{escapeHtml\(backendT\("backend\.table\.roles", "Roles"\)\)\}<\/th>/,
    "Settings user table should include a Roles header column"
  );
  assert.match(
    source,
    /<th class="settings-staff-table__status-col">\$\{escapeHtml\(backendT\("backend\.table\.status", "Status"\)\)\}<\/th>/,
    "Settings user table should include a Status header column"
  );
  assert.match(
    source,
    /<td class="keycloak-roles-col">\$\{formatKeycloakRolesCell\(staff\)\}<\/td>/,
    "Settings user table should display the combined realm and client roles in the Roles column"
  );
  assert.match(
    source,
    /function formatKeycloakRolesCell\(user\) \{[\s\S]*escapeHtml\(formatKeycloakRoleList\(getDisplayedKeycloakRoles\(user\)\)\)/,
    "Settings user table should render the combined Keycloak roles as a comma-separated escaped string"
  );
  assert.doesNotMatch(
    source,
    /<strong>Client:<\/strong>|<strong>Realm:<\/strong>|join\("<br>"\)/,
    "Settings user table should not render realm/client labels or line-break-separated roles in the Roles column"
  );
  assert.match(
    css,
    /\.backend-table th\.keycloak-roles-col,\s*\.backend-table td\.keycloak-roles-col\s*\{\s*text-align:\s*right;/,
    "Settings roles column should right-align the header and cell content"
  );
  assert.match(
    html,
    /id="staffEditorPanel"/,
    "Settings page should expose the ATP staff editor panel"
  );
  assert.match(
    html,
    /id="staffEditorNameValue"[\s\S]*id="staffEditorFriendlyShortName"[\s\S]*id="staffEditorTeamOrder"/,
    "Settings page should expose the read-only ATP staff name plus editable friendly-short-name and team-order fields"
  );
  assert.match(
    html,
    /id="staffEditorSaveBtn"[^>]*disabled/,
    "Settings page should render the ATP staff save button disabled by default until the profile is dirty"
  );
  assert.match(
    source,
    /keycloakUserStaffProfileUpdateRequest|keycloakUserStaffProfilePictureUploadRequest|keycloakUserStaffProfilePictureDeleteRequest/,
    "Settings page should use the generated ATP staff profile edit endpoints"
  );
  assert.match(
    source,
    /name:\s*normalizeText\(state\.editor\?\.name\)[\s\S]*friendly_short_name:\s*normalizeText\(state\.editor\?\.friendlyShortName\)[\s\S]*team_order:\s*teamOrder\.value/,
    "Settings page should send the ATP staff name, friendly-short-name, and team-order fields when saving the profile"
  );
  assert.match(
    source,
    /function isEditorDirty\(\)[\s\S]*editorHasPendingPhoto\(\)[\s\S]*normalizeEditorProfile\(state\.editor\)[\s\S]*normalizeEditorProfile\(cloneEditorProfile\(user\)\)/,
    "Settings page should treat a pending ATP staff photo as dirty in addition to normal profile field changes"
  );
  assert.match(
    source,
    /function updateEditorSaveButtonState\(\)[\s\S]*els\.staffEditorSaveBtn\.disabled = !state\.permissions\.canEditStaffProfiles[\s\S]*\|\| !getSelectedUser\(\)[\s\S]*\|\| !isEditorDirty\(\)[\s\S]*\|\| state\.editorSaving;/,
    "Settings page should disable the ATP staff save button while the profile is clean or already saving"
  );
  assert.match(
    source,
    /async function handleStaffPhotoSelected\(event\) \{[\s\S]*state\.editor\.pendingPhoto = \{[\s\S]*dataBase64:[\s\S]*renderEditor\(\);/,
    "Selecting an ATP staff picture should stage a local photo draft and rerender the preview instead of uploading immediately"
  );
  assert.match(
    source,
    /async function saveSelectedStaffProfile\(\) \{[\s\S]*pendingPhoto\?\.dataBase64[\s\S]*keycloakUserStaffProfilePictureUploadRequest[\s\S]*applyUpdatedUser\(latestUser\);/,
    "Saving an ATP staff profile should upload any pending staged photo through the generated picture-upload endpoint"
  );
});

test("settings page staff translation follows the active backend source language", async () => {
  const settingsPageModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "settings_list.js");
  const source = await readFile(settingsPageModulePath, "utf8");

  assert.match(
    source,
    /function currentStaffSourceLang\(\) \{[\s\S]*window\.backendI18n\?\.getLang/,
    "Settings translation helpers should derive ATP staff source language from the active backend language selector"
  );
  assert.match(
    source,
    /function qualificationLanguageOptionsForEditor\(\) \{[\s\S]*const pairedLang = sourceLang === "vi" \? "en" : "vi";[\s\S]*localeCompare/,
    "Settings localized editors should place the EN\/VI pair first and sort remaining languages alphabetically"
  );
  assert.doesNotMatch(
    source,
    /source_lang:\s*"en"/,
    "Settings field translation requests must not hard-code English as the source language"
  );
  assert.match(
    source,
    /function translateAllButtonLabel\(\) \{[\s\S]*"\{source\} → ALL"/,
    "Settings translation controls should render the translate-all button from the active source language label"
  );
});

test("settings page hosts destination publication controls while emergency no longer renders that checkbox", async () => {
  const settingsPageModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "settings_list.js");
  const settingsPageHtmlPath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "settings.html");
  const emergencyPageModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "emergency.js");
  const toursPageModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tours_list.js");
  const navPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "nav.js");
  const [settingsSource, settingsHtml, emergencySource, toursSource, navSource] = await Promise.all([
    readFile(settingsPageModulePath, "utf8"),
    readFile(settingsPageHtmlPath, "utf8"),
    readFile(emergencyPageModulePath, "utf8"),
    readFile(toursPageModulePath, "utf8"),
    readFile(navPath, "utf8")
  ]);

  assert.match(
    settingsHtml,
    /id="websiteDestinationPublicationPanel"[\s\S]*id="websiteDestinationPublicationStatus"[\s\S]*id="websiteDestinationPublicationSaveBtn"[\s\S]*id="websiteDestinationPublicationList"/,
    "Settings page should expose a dedicated website destination publication section with status, save action, and checkbox list mounts"
  );
  assert.match(
    settingsHtml,
    /id="translationRulesPanel"[\s\S]*id="translationRulesStatus"[\s\S]*id="translationRulesAddBtn"[\s\S]*id="translationRulesSaveBtn"[\s\S]*id="translationRulesTable"/,
    "Settings page should expose a global translation overrides section with status, add/save actions, and a table mount"
  );
  assert.match(
    settingsHtml,
    /id="settingsObservabilityPanel"[\s\S]*id="settingsObservabilityStatus"[\s\S]*id="settingsObservabilityRefreshBtn"[\s\S]*id="settingsLoggedInUsers"[\s\S]*id="settingsLastChangedBooking"/,
    "Settings page should expose a backend activity section with a refresh action and mounts for active sessions plus the latest booking change"
  );
  assert.match(
    settingsSource,
    /countryReferenceInfoRequest|countryReferenceInfoUpdateRequest/,
    "Settings page should use the generated country-reference API requests for website destination publication"
  );
  assert.match(
    settingsSource,
    /settingsTranslationRulesRequest|settingsTranslationRulesUpdateRequest/,
    "Settings page should use the generated translation-rules API requests for the global overrides table"
  );
  assert.match(
    settingsSource,
    /canReadObservability:\s*roles\.includes\(ROLES\.ADMIN\)[\s\S]*loadObservability\(\)/,
    "Settings page should gate backend activity behind the admin-only observability permission"
  );
  assert.match(
    settingsSource,
    /\/api\/v1\/settings\/observability/,
    "Settings page should fetch the settings observability endpoint for backend activity"
  );
  assert.match(
    settingsSource,
    /canReadStaffProfiles:\s*roles\.includes\(ROLES\.ADMIN\)[\s\S]*canEditStaffProfiles:\s*roles\.includes\(ROLES\.ADMIN\)[\s\S]*canReadWebsiteDestinationPublication:\s*roles\.includes\(ROLES\.ADMIN\)[\s\S]*canEditWebsiteDestinationPublication:\s*roles\.includes\(ROLES\.ADMIN\)[\s\S]*canReadTranslationRules:\s*roles\.includes\(ROLES\.ADMIN\)[\s\S]*canEditTranslationRules:\s*roles\.includes\(ROLES\.ADMIN\)[\s\S]*canReadEmergency:\s*roles\.includes\(ROLES\.ADMIN\)[\s\S]*canEditEmergency:\s*roles\.includes\(ROLES\.ADMIN\)[\s\S]*canReadSettings:\s*roles\.includes\(ROLES\.ADMIN\)[\s\S]*expectedRolesAnyOf:\s*\[ROLES\.ADMIN\]/,
    "Settings page should now be admin-only, including the website destination publication section"
  );
  assert.match(
    settingsSource,
    /async function saveWebsiteDestinationPublication\(\) \{[\s\S]*published_on_webpage:[\s\S]*countryReferenceInfoUpdateRequest/,
    "Settings page should save the published-on-webpage flags through the country-reference update route"
  );
  assert.match(
    settingsSource,
    /async function saveTranslationRules\(\) \{[\s\S]*settingsTranslationRulesUpdateRequest[\s\S]*items:\s*cloneTranslationRules\(state\.translationRulesDraftItems\)/,
    "Settings page should save the global translation overrides through the translation-rules update route"
  );
  assert.match(
    navSource,
    /normalizedSection === "settings"[\s\S]*\? "settings\.html"[\s\S]*normalizedSection === "emergency"[\s\S]*\? "settings\.html"[\s\S]*const canReadTours = hasAnyRole\(resolvedRoles, "atp_admin", "atp_accountant", "atp_tour_editor"\);[\s\S]*const canReadSettings = hasAnyRole\(resolvedRoles, "atp_admin"\);/,
    "Backend nav should keep Marketing Tours readable for tour editors while routing Emergency through the admin-only Settings area"
  );
  assert.match(
    toursSource,
    /canReadTours:\s*hasAnyRoleInList\(roles,\s*ROLES\.ADMIN,\s*ROLES\.ACCOUNTANT,\s*ROLES\.TOUR_EDITOR\)[\s\S]*expectedRolesAnyOf:\s*\[ROLES\.ADMIN,\s*ROLES\.ACCOUNTANT,\s*ROLES\.TOUR_EDITOR\]/,
    "Marketing tours should remain readable for atp_tour_editor users"
  );
  assert.doesNotMatch(
    emergencySource,
    /data-emergency-published-on-webpage/,
    "Emergency page should no longer render the published-on-webpage checkbox"
  );
  assert.match(
    emergencySource,
    /published_on_webpage:\s*previousItem\?\.published_on_webpage !== false/,
    "Emergency page should preserve the existing publication flag when saving practical tips and emergency contacts"
  );
});

test("offer and travel-plan PDFs prefer ATP staff full and friendly names in the guide section", async () => {
  const atpStaffPdfPath = path.resolve(__dirname, "..", "src", "lib", "atp_staff_pdf.js");
  const offerPdfPath = path.resolve(__dirname, "..", "src", "lib", "offer_pdf.js");
  const travelPlanPdfPath = path.resolve(__dirname, "..", "src", "lib", "travel_plan_pdf.js");
  const [atpStaffPdfSource, offerPdfSource, travelPlanPdfSource] = await Promise.all([
    readFile(atpStaffPdfPath, "utf8"),
    readFile(offerPdfPath, "utf8"),
    readFile(travelPlanPdfPath, "utf8")
  ]);

  assert.match(
    atpStaffPdfSource,
    /export function resolveAtpStaffFullName\(profile\)[\s\S]*profile\?\.name/,
    "ATP staff PDF helpers should read the ATP staff profile name field"
  );
  assert.doesNotMatch(
    atpStaffPdfSource,
    /resolveAtpStaffFullName\(profile\)[\s\S]*profile\?\.full_name/,
    "ATP staff PDF helpers should no longer depend on the removed full_name field"
  );
  assert.match(
    offerPdfSource,
    /resolveAtpStaffFullName[\s\S]*resolveAtpGuideIntroName/,
    "Offer PDFs should use the ATP staff full name in the title and the friendly short name through the guide intro helper"
  );
  assert.match(
    travelPlanPdfSource,
    /resolveAtpGuideIntroName[\s\S]*resolveAtpStaffFullName/,
    "Travel-plan PDFs should prefer the ATP staff short name in the title and still fall back to the full name when needed"
  );
  assert.doesNotMatch(
    offerPdfSource,
    /guide\.languages|languageLabels/,
    "Offer PDFs should no longer list ATP guide languages in the guide section"
  );
  assert.doesNotMatch(
    offerPdfSource,
    /heightOfString\(guideFriendlyShortName|text\(guideFriendlyShortName/,
    "Offer PDFs should not render a separate ATP guide short-name subtitle line"
  );
  assert.doesNotMatch(
    travelPlanPdfSource,
    /guide\.languages|languageLabels/,
    "Travel-plan PDFs should no longer list ATP guide languages in the guide section"
  );
  assert.doesNotMatch(
    travelPlanPdfSource,
    /measureTextHeight\(doc,\s*guideFriendlyShortName|text\(guideFriendlyShortName/,
    "Travel-plan PDFs should not render a separate ATP guide short-name subtitle line"
  );
});

test("shared travel-plan PDF headers reserve height for wrapped day titles before metadata rows", async () => {
  const travelPlanSectionPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "lib", "pdf_travel_plan_section.js");
  const source = await readFile(travelPlanSectionPath, "utf8");

  assert.match(
    source,
    /const titleHeight = measureTextHeight\(doc, titleText,[\s\S]*const dateHeight = dateLabel[\s\S]*let nextY = y \+ Math\.max\(titleHeight, dateHeight\) \+ 4;/,
    "The shared travel-plan PDF day header should reserve space for wrapped titles before rendering overnight or accommodation rows"
  );
});

test("shared travel-plan PDF item layout falls back to full-width cards when only one item fits", async () => {
  const travelPlanSectionPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "lib", "pdf_travel_plan_section.js");
  const source = await readFile(travelPlanSectionPath, "utf8");

  assert.match(
    source,
    /function layoutTravelPlanItemsForFullWidthPage\(/,
    "The shared travel-plan PDF renderer should define a full-width fallback packer"
  );
  assert.match(
    source,
    /if \(countTravelPlanLayoutItems\(pageLayout\) === 1\) \{[\s\S]*layoutTravelPlanItemsForFullWidthPage\(/,
    "The shared travel-plan PDF renderer should repack single-card pages as full-width layouts"
  );
  assert.match(
    source,
    /if \(pageLayout\.mode === "stack"\) \{[\s\S]*drawTravelPlanItemStack\(/,
    "The shared travel-plan PDF renderer should draw the full-width fallback stack when selected"
  );
});

test("shared travel-plan PDF packer balances image cards across both columns when possible", async () => {
  const travelPlanSectionPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "lib", "pdf_travel_plan_section.js");
  const source = await readFile(travelPlanSectionPath, "utf8");

  assert.match(
    source,
    /const imageCounts = \{ left: 0, right: 0 \};[\s\S]*let lastImageColumn = null;[\s\S]*function choosePreferredColumnForImage\(\) \{[\s\S]*imageCounts\.left !== imageCounts\.right[\s\S]*lastImageColumn === "left"[\s\S]*lastImageColumn === "right"/,
    "The shared travel-plan PDF packer should track image-card balance and alternate image placement when both columns can accept the next image"
  );
  assert.match(
    source,
    /const preferredKey = entry\?\.kind === "image"[\s\S]*choosePreferredColumnForImage\(\)[\s\S]*if \(entry\?\.kind === "image"\) \{[\s\S]*imageCounts\[targetKey\] \+= 1;[\s\S]*lastImageColumn = targetKey;/,
    "The shared travel-plan PDF packer should apply the balancing preference only to image cards and remember where each image landed"
  );
});

test("shared travel-plan PDF continuation pages do not repeat the current day header", async () => {
  const travelPlanSectionPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "lib", "pdf_travel_plan_section.js");
  const source = await readFile(travelPlanSectionPath, "utf8");

  assert.doesNotMatch(
    source,
    /if \(remainingItems\.length\) \{[\s\S]*drawTravelPlanDayHeader\(/,
    "The shared travel-plan PDF renderer should not redraw the current day header on continuation pages"
  );
});

test("shared travel-plan PDF item packing defers oversized cards instead of drawing them cut off", async () => {
  const travelPlanSectionPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "lib", "pdf_travel_plan_section.js");
  const source = await readFile(travelPlanSectionPath, "utf8");

  assert.doesNotMatch(
    source,
    /\|\| \(!columns\.left\.length && !columns\.right\.length\)/,
    "The shared travel-plan PDF column packer should not force the first item onto a page when it does not fit"
  );
  assert.doesNotMatch(
    source,
    /projectedHeight > availableHeight && entries\.length/,
    "The shared travel-plan PDF full-width packer should not force the first item onto a page when it does not fit"
  );
  assert.match(
    source,
    /if \(!countTravelPlanLayoutItems\(pageLayout\)\) \{[\s\S]*addContinuationPage\(\);[\s\S]*continue;/,
    "The shared travel-plan PDF renderer should move oversized cards to the next page instead of drawing them cut off"
  );
});

test("shared travel-plan PDF uses text-only service cards with interleaved standalone image cards", async () => {
  const travelPlanSectionPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "lib", "pdf_travel_plan_section.js");
  const source = await readFile(travelPlanSectionPath, "utf8");
  const itemBoxHeightSource = source.match(/function itemBoxHeight\([\s\S]*?return Math\.max\(88, ITEM_CARD_PADDING \+ textHeight \+ ITEM_CARD_PADDING\);\n\}/)?.[0] || "";

  assert.ok(
    itemBoxHeightSource,
    "The shared travel-plan PDF source should expose the text-only service card height calculator"
  );
  assert.match(
    source,
    /function buildTravelPlanDayLayoutEntries\(day, itemThumbnailMap\)[\s\S]*\{ kind: "service", item \}[\s\S]*\{ kind: "image", item, thumbnail \}/,
    "The shared travel-plan PDF renderer should build each day's flow from standalone service and image entries"
  );
  assert.match(
    source,
    /function drawTravelPlanItemCard\([\s\S]*if \(entry\?\.kind === "image" && entry\.thumbnail\?\.buffer\) \{/,
    "The shared travel-plan PDF renderer should draw image entries as standalone floating cards"
  );
  assert.match(
    source,
    /let remainingItems = buildTravelPlanDayLayoutEntries\(day, itemThumbnailMap\);/,
    "The shared travel-plan PDF renderer should interleave image cards directly into each day's page flow"
  );
});

test("offer PDF omits the quotation tax summary and uses a plain total label when tax is zero", async () => {
  const offerPdfPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "lib", "offer_pdf.js");
  const source = await readFile(offerPdfPath, "utf8");

  assert.match(
    source,
    /const hasTaxSummary = Number\(quotationSummary\?\.total_tax_amount_cents \|\| 0\) !== 0;[\s\S]*const totalLabel = hasTaxSummary[\s\S]*pdfT\(lang, "offer\.table\.total", "Total"\)/,
    "Offer PDFs should switch the offer-details total row to the plain Total label when the quotation has no tax"
  );
  assert.match(
    source,
    /if \(!hasTaxSummary\) \{\s*return y \+ 10;\s*\}/,
    "Offer PDFs should skip the quotation tax summary block entirely when the quotation has no tax"
  );
});

test("offer PDF keeps offer details and payment terms together when they fit instead of forcing dedicated pages", async () => {
  const offerPdfPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "lib", "offer_pdf.js");
  const source = await readFile(offerPdfPath, "utf8");

  assert.match(
    source,
    /function keepSectionTogetherIfPossible\([\s\S]*if \(estimatedHeight > getSinglePageContentCapacity\(doc\)\) return currentY;[\s\S]*return ensureSpace\(doc, currentY, estimatedHeight, headerRedraw\);/,
    "Offer PDFs should expose a helper that keeps a section together only when the full section can fit on one page"
  );
  assert.match(
    source,
    /y = keepSectionTogetherIfPossible\(doc, y, estimateOfferTableHeight\(doc, generatedOffer, renderMoney, fonts, lang\)\);\s*y = drawOfferTable\(doc, generatedOffer, y, renderMoney, fonts, lang\);/,
    "Offer details should only move to a new page when the entire section would not fit in the remaining space"
  );
  assert.match(
    source,
    /y = keepSectionTogetherIfPossible\(doc, y, estimatePaymentTermsHeight\(doc, generatedOffer, renderMoney, fonts, lang\)\);\s*y = drawPaymentTerms\(doc, generatedOffer, y, renderMoney, fonts, lang\);/,
    "Payment terms should only move to a new page when the entire section would not fit in the remaining space"
  );
  assert.doesNotMatch(
    source,
    /y = startSectionOnNewPage\(doc\);\s*y = drawOfferTable\(doc, generatedOffer, y, renderMoney, fonts, lang\);/,
    "Offer PDFs should no longer force Offer details onto a dedicated new page"
  );
  assert.doesNotMatch(
    source,
    /y = startSectionOnNewPage\(doc\);\s*y = drawPaymentTerms\(doc, generatedOffer, y, renderMoney, fonts, lang\);/,
    "Offer PDFs should no longer force Payment terms onto a dedicated new page"
  );
});

test("offer PDF keeps the closing letter and signoff together when they fit on one page", async () => {
  const offerPdfPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "lib", "offer_pdf.js");
  const source = await readFile(offerPdfPath, "utf8");

  assert.match(
    source,
    /function estimateClosingHeight\([\s\S]*buildClosingBody\(generatedOffer, formatMoneyValue, lang\)[\s\S]*offer\.closing_regards[\s\S]*offer\.closing_team/s,
    "Offer PDFs should estimate the full closing block height, including the signoff"
  );
  assert.match(
    source,
    /y = keepSectionTogetherIfPossible\(\s*doc,\s*y \+ 18,\s*estimateClosingHeight\(doc, fonts, lang, generatedOffer, renderMoney, attachmentPaths\.length\)\s*\);\s*y = drawClosing\(doc, y, fonts, lang, generatedOffer, renderMoney, attachmentPaths\.length\);/s,
    "Offer PDFs should keep the closing body and signoff together when the entire block can fit on the current page"
  );
  assert.doesNotMatch(
    source,
    /y = ensureSpace\(doc, y, 90\);\s*y = drawClosing\(doc, y \+ 18, fonts, lang, generatedOffer, renderMoney, attachmentPaths\.length\);/,
    "Offer PDFs should no longer rely on a fixed 90-point spacer before drawing the closing block"
  );
});

test("booking travel-plan translate contract accepts explicit source and target languages", async () => {
  const requestsCuePath = path.resolve(__dirname, "..", "..", "..", "model", "api", "requests.cue");
  const normalizedIrPath = path.resolve(__dirname, "..", "..", "..", "model", "ir", "normalized.cue");
  const openApiPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "openapi.yaml");
  const generatedModelsPath = path.resolve(__dirname, "..", "..", "..", "shared", "generated-contract", "API", "generated_APIModels.js");
  const [requestsCueSource, normalizedIrSource, openApiSource, generatedModelsSource] = await Promise.all([
    readFile(requestsCuePath, "utf8"),
    readFile(normalizedIrPath, "utf8"),
    readFile(openApiPath, "utf8"),
    readFile(generatedModelsPath, "utf8")
  ]);

  assert.match(
    requestsCueSource,
    /#BookingTravelPlanTranslateRequest:\s*\{[\s\S]*source_lang:\s+enums\.\#LanguageCode[\s\S]*target_lang:\s+enums\.\#LanguageCode[\s\S]*translation_profile\?:\s+string/,
    "The authored travel-plan translate request model should require source_lang and target_lang and allow translation_profile"
  );
  assert.match(
    normalizedIrSource,
    /name:\s+"BookingTravelPlanTranslateRequest"[\s\S]*\{name: "source_lang", kind: "enum", typeName: "LanguageCode", required: true\}[\s\S]*\{name: "target_lang", kind: "enum", typeName: "LanguageCode", required: true\}[\s\S]*\{name: "translation_profile", kind: "scalar", typeName: "string", required: false\}/,
    "The normalized API IR should keep source_lang, target_lang, and translation_profile for travel-plan translation"
  );
  assert.match(
    openApiSource,
    /BookingTravelPlanTranslateRequest:[\s\S]*required:[\s\S]*- source_lang[\s\S]*- target_lang[\s\S]*properties:[\s\S]*source_lang:[\s\S]*target_lang:[\s\S]*translation_profile:/,
    "The generated OpenAPI schema should require source_lang and target_lang and expose translation_profile for travel-plan translation"
  );
  const generatedSchemaBlock = generatedModelsSource.match(
    /export const BOOKING_TRAVEL_PLAN_TRANSLATE_REQUEST_SCHEMA = \{[\s\S]*?\n\s*\};/
  )?.[0] || "";
  assert.match(
    generatedSchemaBlock,
    /"name":"source_lang"[\s\S]*"name":"target_lang"[\s\S]*"name":"translation_profile"/,
    "The shared runtime validator should accept source_lang, target_lang, and translation_profile for travel-plan translation"
  );
  assert.equal(
    generatedSchemaBlock.includes('"name":"lang"'),
    false,
    "The shared runtime validator should not keep the legacy lang-only travel-plan translation schema"
  );
});

test("frontend translation requests send explicit translation profiles", async () => {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const [
    tourSource,
    localizedEditorSource,
    travelPlanEditorSource,
    settingsSource
  ] = await Promise.all([
    readFile(path.join(repoRoot, "frontend", "scripts", "pages", "tour.js"), "utf8"),
    readFile(path.join(repoRoot, "frontend", "scripts", "booking", "localized_editor.js"), "utf8"),
    readFile(path.join(repoRoot, "frontend", "scripts", "shared", "travel_plan_editor_core.js"), "utf8"),
    readFile(path.join(repoRoot, "frontend", "scripts", "pages", "settings_list.js"), "utf8")
  ]);

  assert.match(
    tourSource,
    /const translationProfile = normalizeText\(options\?\.translationProfile \|\| "marketing_trip_copy"\) \|\| "marketing_trip_copy";[\s\S]*translation_profile: translationProfile/,
    "Tour translation requests should default to the marketing_trip_copy profile"
  );
  assert.match(
    localizedEditorSource,
    /translationProfile = "customer_travel_plan"[\s\S]*translation_profile: normalizedTranslationProfile/,
    "Booking field translation requests should default to the customer_travel_plan profile"
  );
  assert.match(
    travelPlanEditorSource,
    /bookingTravelPlanTranslateRequest\(\{[\s\S]*translation_profile: "customer_travel_plan"/,
    "Full travel-plan translation requests should send the customer_travel_plan profile"
  );
  assert.match(
    settingsSource,
    /keycloakUserStaffProfileTranslateFieldsRequest\(\{[\s\S]*translation_profile: "staff_profile"/,
    "Staff profile translation requests should send the staff_profile profile"
  );
});

test("backend list pages have dedicated entrypoints and are served by caddy", async () => {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const frontendRoot = path.resolve(__dirname, "..", "..", "..", "frontend");
  const deployRoot = path.resolve(__dirname, "..", "..", "..", "deploy-config");
  const [
    bookingsHtml,
    bookingHtml,
    emergencyHtml,
    indexHtml,
    localhostDiagnosticsSource,
    marketingTourHtml,
    marketingToursHtml,
    privacyHtml,
    settingsHtml,
    standardTourHtml,
    standardToursHtml,
    travelerDetailsHtml,
    localCaddy,
    stagingCaddy,
    robotsSource,
    sitemapSource,
    runtimeBrandLogoScript,
    localFrontendScript,
    stagingFrontendScript,
    updateStagingScript,
    productionFrontendScript,
    updateProductionScript,
    publicHomepageAssetsScript
  ] = await Promise.all([
    readFile(path.join(frontendRoot, "pages", "bookings.html"), "utf8"),
    readFile(path.join(frontendRoot, "pages", "booking.html"), "utf8"),
    readFile(path.join(frontendRoot, "pages", "emergency.html"), "utf8"),
    readFile(path.join(frontendRoot, "pages", "index.html"), "utf8"),
    readFile(path.join(frontendRoot, "scripts", "shared", "localhost_diagnostics.js"), "utf8"),
    readFile(path.join(frontendRoot, "pages", "marketing_tour.html"), "utf8"),
    readFile(path.join(frontendRoot, "pages", "marketing_tours.html"), "utf8"),
    readFile(path.join(frontendRoot, "pages", "privacy.html"), "utf8"),
    readFile(path.join(frontendRoot, "pages", "settings.html"), "utf8"),
    readFile(path.join(frontendRoot, "pages", "standard-tour.html"), "utf8"),
    readFile(path.join(frontendRoot, "pages", "standard-tours.html"), "utf8"),
    readFile(path.join(frontendRoot, "pages", "traveler-details.html"), "utf8"),
    readFile(path.join(deployRoot, "Caddyfile.local"), "utf8"),
    readFile(path.join(deployRoot, "Caddyfile"), "utf8"),
    readFile(path.join(repoRoot, "robots.txt"), "utf8"),
    readFile(path.join(repoRoot, "sitemap.xml"), "utf8"),
    readFile(path.join(repoRoot, "scripts", "assets", "prepare_runtime_brand_logo.sh"), "utf8"),
    readFile(path.join(repoRoot, "scripts", "local", "start_local_frontend.sh"), "utf8"),
    readFile(path.join(repoRoot, "scripts", "staging", "deploy_staging_frontend.sh"), "utf8"),
    readFile(path.join(repoRoot, "scripts", "deploy", "update_staging.sh"), "utf8"),
    readFile(path.join(repoRoot, "scripts", "production", "deploy_production_frontend.sh"), "utf8"),
    readFile(path.join(repoRoot, "scripts", "deploy", "update_production.sh"), "utf8"),
    readFile(path.join(repoRoot, "scripts", "lib", "public_homepage_assets.sh"), "utf8")
  ]);

  assert.match(
    bookingsHtml,
    /frontend\/scripts\/pages\/booking_list\.js/,
    "bookings.html should mount the bookings page script"
  );
  assert.match(
    marketingToursHtml,
    /frontend\/scripts\/pages\/tours_list\.js/,
    "marketing_tours.html should mount the tours page script"
  );
  assert.match(
    standardToursHtml,
    /frontend\/scripts\/pages\/standard_tours\.js/,
    "standard-tours.html should mount the standard tours page script"
  );
  assert.match(
    standardTourHtml,
    /frontend\/scripts\/pages\/standard_tour\.js/,
    "standard-tour.html should mount the standard tour detail page script"
  );
  assert.match(
    settingsHtml,
    /frontend\/scripts\/pages\/settings_list\.js/,
    "settings.html should mount the settings page script"
  );
  assert.match(
    emergencyHtml,
    /frontend\/scripts\/pages\/emergency\.js/,
    "emergency.html should mount the emergency page script"
  );
  for (const source of [
    bookingsHtml,
    bookingHtml,
    emergencyHtml,
    indexHtml,
    marketingTourHtml,
    marketingToursHtml,
    privacyHtml,
    settingsHtml,
    standardTourHtml,
    standardToursHtml,
    travelerDetailsHtml
  ]) {
    assert.match(
      source,
      /\/assets\/generated\/runtime\/brand-logo\.png/,
      "Frontend entry pages should read the top-left brand logo from the generated runtime asset path"
    );
  }
  assert.match(
    runtimeBrandLogoScript,
    /TARGET_DIR="\$ROOT_DIR\/assets\/generated\/runtime"[\s\S]*TARGET_PATH="\$TARGET_DIR\/brand-logo\.png"/,
    "The runtime brand logo helper should write to the generated runtime logo path"
  );
  assert.match(
    runtimeBrandLogoScript,
    /production\)[\s\S]*SOURCE_PATH="\$ROOT_DIR\/assets\/img\/logo-asiatravelplan\.png"/,
    "The runtime brand logo helper should use the production PNG for production deploys"
  );
  assert.match(
    runtimeBrandLogoScript,
    /staging\)[\s\S]*SOURCE_PATH="\$ROOT_DIR\/assets\/img\/staging\.png"/,
    "The runtime brand logo helper should use staging.png for staging deploys"
  );
  assert.match(
    runtimeBrandLogoScript,
    /local\)[\s\S]*SOURCE_PATH="\$ROOT_DIR\/assets\/img\/local\.png"/,
    "The runtime brand logo helper should use local.png for local deploys"
  );
  assert.match(
    localFrontendScript,
    /prepare_runtime_brand_logo[\s\S]*"\$RUNTIME_BRAND_LOGO_PREPARER" local/,
    "Local frontend startup should prepare the local runtime logo before serving the site"
  );
  assert.match(
    stagingFrontendScript,
    /prepare_runtime_brand_logo\.sh" staging/,
    "Staging frontend asset deploys should prepare the staging runtime logo"
  );
  assert.match(
    updateStagingScript,
    /prepare_runtime_brand_logo\(\)[\s\S]*"\$RUNTIME_BRAND_LOGO_PREPARER" staging[\s\S]*prepare_runtime_brand_logo[\s\S]*generate_public_homepage_assets/,
    "Staging deploys should prepare the staging runtime logo before regenerating frontend assets"
  );
  assert.match(
    productionFrontendScript,
    /prepare_runtime_brand_logo\.sh" production/,
    "Production frontend asset deploys should prepare the production runtime logo"
  );
  assert.match(
    updateProductionScript,
    /prepare_runtime_brand_logo\(\)[\s\S]*"\$RUNTIME_BRAND_LOGO_PREPARER" production[\s\S]*prepare_runtime_brand_logo[\s\S]*generate_public_homepage_assets/,
    "Production deploys should prepare the production runtime logo before regenerating frontend assets"
  );
  assert.match(
    publicHomepageAssetsScript,
    /PUBLIC_HOMEPAGE_ASSET_GENERATOR_QUIET=1[\s\S]*>\s*"\$command_log_path" 2>&1[\s\S]*Generated static homepage assets\. Full generation output:/,
    "Homepage asset deploy helper should suppress generator stdout on successful deploys while preserving logs"
  );
  for (const deployScript of [
    localFrontendScript,
    stagingFrontendScript,
    updateStagingScript,
    productionFrontendScript,
    updateProductionScript
  ]) {
    assert.match(
      deployScript,
      /source "\$ROOT_DIR\/scripts\/lib\/public_homepage_assets\.sh"[\s\S]*run_public_homepage_asset_generator_quiet/,
      "Frontend/deploy scripts should run homepage generation through the quiet deploy helper"
    );
  }
  for (const deployScript of [
    stagingFrontendScript,
    updateStagingScript,
    productionFrontendScript,
    updateProductionScript
  ]) {
    assert.doesNotMatch(
      deployScript,
      /node "\$ROOT_DIR\/scripts\/assets\/generate_public_homepage_assets\.mjs"/,
      "Deploy scripts should not call the noisy homepage asset generator directly"
    );
  }
  assert.match(
    updateProductionScript,
    /dump_startup_diagnostics\(\)[\s\S]*logs --tail 200 keycloak[\s\S]*logs --tail 200 postgres[\s\S]*dump_startup_diagnostics "\$compose_up_exit_code"/,
    "Production deploys should dump Keycloak and Postgres logs when compose startup fails"
  );

  for (const source of [localCaddy, stagingCaddy]) {
    assert.match(source, /\/bookings\.html/, "Caddy should serve bookings.html");
    assert.match(source, /\/backend\.html/, "Caddy should keep redirecting legacy backend.html");
    assert.match(source, /\/marketing_tours\.html/, "Caddy should serve marketing_tours.html");
    assert.match(source, /\/tours\.html/, "Caddy should keep redirecting legacy tours.html");
    assert.match(source, /\/marketing_tour\.html/, "Caddy should serve marketing_tour.html");
    assert.match(source, /\/tour\.html/, "Caddy should keep redirecting legacy tour.html");
    assert.match(source, /\/standard-tours\.html/, "Caddy should serve standard-tours.html");
    assert.match(source, /\/standard-tour\.html/, "Caddy should serve standard-tour.html");
    assert.match(source, /\/settings\.html/, "Caddy should serve settings.html");
    assert.match(source, /\/emergency\.html/, "Caddy should serve emergency.html");
  }
  assert.match(
    robotsSource,
    /Disallow: \/api\/[\s\S]*Disallow: \/auth\/[\s\S]*Disallow: \/bookings\.html[\s\S]*Disallow: \/settings\.html[\s\S]*Disallow: \/traveler-details\.html[\s\S]*Sitemap: https:\/\/asiatravelplan\.com\/sitemap\.xml/,
    "Production robots.txt should point crawlers at the sitemap while excluding backend, auth, API, and traveler-detail URLs"
  );
  assert.match(
    sitemapSource,
    /<loc>https:\/\/asiatravelplan\.com\/<\/loc>[\s\S]*<loc>https:\/\/asiatravelplan\.com\/privacy\.html<\/loc>/,
    "Tracked fallback sitemap should include stable public pages when the generated sitemap is unavailable"
  );
  assert.doesNotMatch(
    sitemapSource,
    /bookings\.html|settings\.html|traveler-details\.html/,
    "Tracked fallback sitemap should not expose private or noindex pages"
  );
  assert.match(
    stagingCaddy,
    /Content-Security-Policy "default-src 'self';[\s\S]*object-src 'none';[\s\S]*frame-ancestors 'self';[\s\S]*script-src 'self' 'unsafe-inline';[\s\S]*style-src 'self' 'unsafe-inline';[\s\S]*img-src 'self' data: blob:;[\s\S]*connect-src 'self';[\s\S]*upgrade-insecure-requests"/,
    "Shared Caddy security headers should publish a CSP that limits resource origins while allowing current inline bootstraps"
  );
  assert.match(
    stagingCaddy,
    /Permissions-Policy "accelerometer=\(\), autoplay=\(self\), camera=\(\), display-capture=\(\), encrypted-media=\(\), fullscreen=\(self\), geolocation=\(\), gyroscope=\(\), magnetometer=\(\), microphone=\(\), midi=\(\), payment=\(\), publickey-credentials-get=\(\), screen-wake-lock=\(\), usb=\(\), web-share=\(\), xr-spatial-tracking=\(\)"/,
    "Shared Caddy security headers should disable browser capabilities the site does not use"
  );
  assert.match(
    localCaddy,
    /Content-Security-Policy "default-src 'self';[\s\S]*Permissions-Policy "accelerometer=\(\), autoplay=\(self\), camera=\(\)[\s\S]*import local_security_headers/,
    "Local Caddy should apply the same CSP and Permissions-Policy coverage for development"
  );
  assert.match(
    localCaddy,
    /@backend path \/health \/auth\/\* \/api\/\* \/public\/v1\/\* \/integrations\/\*/,
    "Local Caddy should proxy /health so localhost diagnostics can probe the backend without violating CSP"
  );
  assert.doesNotMatch(
    localCaddy,
    /upgrade-insecure-requests/,
    "Local CSP should not force HTTP development assets to HTTPS"
  );
  assert.match(
    localhostDiagnosticsSource,
    /new URL\("\/health", window\.location\.origin\)/,
    "Localhost diagnostics should probe the backend through the same-origin /health path so local CSP stays strict"
  );
  assert.match(
    localhostDiagnosticsSource,
    /attributeValue\(target, "data-src"\)[\s\S]*attributeValue\(target, "poster"\)/,
    "Localhost diagnostics should surface deferred media URLs so local resource failures identify the failing asset"
  );
  const systemHandlersSource = await readFile(path.resolve(__dirname, "..", "src", "http", "handlers", "system.js"), "utf8");
  const tourPageSource = await readFile(path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tour.js"), "utf8");
  const travelPlanEditorCoreSource = await readFile(travelPlanEditorCorePath(), "utf8");
  assert.match(
    systemHandlersSource,
    /translation:\s*publicTranslationRuntimeInfo\(\)/,
    "Health responses should expose translation runtime info so the frontend can label the active translator"
  );
  assert.match(
    travelPlanEditorCoreSource,
    /fetchApiJson\("\/health",[\s\S]*booking\.translation\.translating_current_overlay",[\s\S]*using \{translator\}/,
    "Booking travel-plan overlays should load translation runtime info and show the active translator in the wait message"
  );
  assert.match(
    tourPageSource,
    /TOUR_TRANSLATION_PROVIDER_DISPLAY = "google"[\s\S]*tour\.travel_plan_translation\.translating_current_overlay",[\s\S]*using \{translator\}/,
    "Marketing tour overlays should identify the Google translation provider in the wait message"
  );
  assert.match(
    stagingCaddy,
    /import staging_html_no_cache_headers[\s\S]*import staging_static_cache_headers/,
    "Staging should scope no-cache headers to HTML entry pages while enabling short-lived caching for static assets"
  );
  assert.match(
    stagingCaddy,
    /@staging_static \{[\s\S]*path \/assets\/\* \/frontend\/scripts\/\* \/frontend\/data\/\* \/frontend\/Generated\/\* \/shared\/\* \/site\.webmanifest[\s\S]*not path \/frontend\/data\/generated\/homepage\/\*/,
    "Staging should cache static frontend files while excluding generated homepage data from the static cache"
  );
  assert.match(
    stagingCaddy,
    /@production_static \{[\s\S]*path \/assets\/\* \/frontend\/scripts\/\* \/frontend\/data\/\* \/frontend\/Generated\/\* \/shared\/\* \/site\.webmanifest \/robots\.txt \/sitemap\.xml[\s\S]*not path \/frontend\/data\/generated\/homepage\/\*[\s\S]*not path \/assets\/fonts\/\* \/assets\/generated\/homepage\/\* \/assets\/generated\/reels\/\*/,
    "Production should cache static frontend files while excluding generated homepage data from the static cache"
  );
  assert.match(
    stagingCaddy,
    /@production_immutable_static \{[\s\S]*path \/assets\/fonts\/\* \/assets\/generated\/homepage\/\* \/assets\/generated\/reels\/\*[\s\S]*header @production_immutable_static Cache-Control "public, max-age=31536000, immutable"/,
    "Production should use long immutable caching for versioned generated assets and fonts"
  );
  assert.match(
    stagingCaddy,
    /@staging_generated_homepage path \/frontend\/data\/generated\/homepage\/\*[\s\S]*Cache-Control "public, max-age=60, stale-while-revalidate=300"/,
    "Staging generated homepage data should use a short public cache instead of bypassing browser caches"
  );
  assert.match(
    stagingCaddy,
    /@production_generated_homepage path \/frontend\/data\/generated\/homepage\/\*[\s\S]*Cache-Control "public, max-age=60, stale-while-revalidate=300"/,
    "Production generated homepage data should use a short public cache instead of bypassing browser caches"
  );
  assert.match(
    stagingCaddy,
    /production_private_noindex_headers[\s\S]*path \/app-home\.html \/bookings\.html \/booking\.html \/persons\.html \/marketing_tour\.html \/marketing_tours\.html \/standard-tours\.html \/standard-tour\.html \/settings\.html \/emergency\.html \/traveler-details\.html \/auth\/\* \/api\/\* \/integrations\/\* \/keycloak\/\*[\s\S]*X-Robots-Tag "noindex, nofollow, noarchive"[\s\S]*import production_private_noindex_headers/,
    "Production Caddy should send an X-Robots-Tag noindex header on private or utility routes"
  );
  assert.doesNotMatch(
    stagingCaddy,
    /no-store, no-cache, must-revalidate|Pragma "no-cache"|Expires "0"/,
    "Caddy cache headers should allow normal cache storage and revalidation instead of legacy no-store directives"
  );
  assert.doesNotMatch(
    stagingCaddy,
    /staging\.asiatravelplan\.com \{[\s\S]*import staging_cache_headers/,
    "Staging should no longer apply a global no-store policy to every response"
  );
  assert.doesNotMatch(
    stagingCaddy,
    new RegExp([
      "root \\* /place",
      `holder|${["placeholder", "assets"].join("-")}|production-`,
      "access"
    ].join("")),
    "Production Caddy should not serve the retired placeholder or reference the temporary production access check"
  );
  assert.doesNotMatch(
    stagingCaddy,
    /@staging_logo path \/assets\/img\/logo-asiatravelplan\.svg|rewrite \* \/assets\/img\/staging\.png/,
    "Staging Caddy should not own top-left logo swapping now that deploy scripts prepare the runtime logo"
  );
  assert.match(
    stagingCaddy,
    /path \/ \/index\.html[\s\S]*try_files \/frontend\/data\/generated\/homepage\/index\.html \/frontend\/pages\/index\.html/,
    "Caddy should serve the deploy-generated homepage HTML with a tracked template fallback"
  );
  assert.match(
    stagingCaddy,
    /path \/sitemap\.xml[\s\S]*try_files \/frontend\/data\/generated\/homepage\/sitemap\.xml \/sitemap\.xml/,
    "Caddy should serve the deploy-generated sitemap with the tracked sitemap as a fallback"
  );
  assert.match(
    stagingCaddy,
    /path \/destinations \/destinations\/\* \/travel-styles \/travel-styles\/\* \/tours \/tours\/\*[\s\S]*try_files \/frontend\/data\/generated\/homepage\/seo\{path\}\.html =404/,
    "Caddy should expose generated SEO pages for destinations, travel styles, and tours"
  );
  assert.match(
    stagingCaddy,
    /@production_backend_html_pages path \/bookings\.html[\s\S]*forward_auth @production_backend_html_pages host\.docker\.internal:8788 \{[\s\S]*uri \/backend-access\/check[\s\S]*respond 404/,
    "Production Caddy should protect backend HTML pages with backend-access forward auth and end unmatched paths with 404"
  );
});

test("frontend language switching updates the homepage in place instead of forcing a full page reload", async () => {
  const frontendI18nPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "frontend_i18n.js");
  const mainPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "main.js");
  const mainToursPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "main_tours.js");
  const bookingFormOptionsPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "main_booking_form_options.js");
  const [frontendI18nSource, mainSource, mainToursSource, bookingFormOptionsSource] = await Promise.all([
    readFile(frontendI18nPath, "utf8"),
    readFile(mainPath, "utf8"),
    readFile(mainToursPath, "utf8"),
    readFile(bookingFormOptionsPath, "utf8")
  ]);

  assert.match(
    frontendI18nSource,
    /async function switchLanguage\(nextLang,[\s\S]*window\.history\.replaceState[\s\S]*frontend-i18n-changed/,
    "Frontend i18n should switch languages in place, update the URL, and emit a change event"
  );
  assert.doesNotMatch(
    frontendI18nSource,
    /panel\.querySelectorAll\('\[data-lang-option\]'\)[\s\S]*window\.location\.href = url\.toString\(\)/,
    "Frontend language menu should no longer navigate the whole page on option click"
  );
  assert.match(
    mainSource,
    /window\.addEventListener\("frontend-i18n-changed", \(\) => \{[\s\S]*handleFrontendLanguageChanged\(\)/,
    "Homepage boot should listen for frontend language changes and refresh localized data in place"
  );
  assert.match(
    mainSource,
    /function scheduleDeferredTask\(task,[\s\S]*requestIdleCallback[\s\S]*setTimeout/,
    "Homepage should defer non-critical language-switch follow-up work via idle time or a short timeout fallback"
  );
  assert.match(
    mainSource,
    /async function init\(\)[\s\S]*applyWebsiteAuthState\(\{ authenticated: false, user: "", known: false \}\);[\s\S]*primeBackendLoginFromCache\(\);[\s\S]*revealBackendLogin\(\);[\s\S]*void loadWebsiteAuthStatus\(\);[\s\S]*setupTourSectionImagePrewarm\(\)/,
    "Homepage init should paint the backend login button immediately, refresh auth in the background, and wait for the tours section before prewarming more tour images"
  );
  assert.match(
    mainSource,
    /function setupTourSectionImagePrewarm\(\) \{[\s\S]*new IntersectionObserver[\s\S]*triggerTourSectionImagePrewarm\(\)[\s\S]*observer\.observe\(els\.toursSection\)/,
    "Homepage should prewarm more tour images only after the tours section becomes visible"
  );
  assert.match(
    mainSource,
    /function setupBackendLogin\(\) \{[\s\S]*pointerenter[\s\S]*focus[\s\S]*touchstart[\s\S]*if \(!state\.authStatusKnown\) \{[\s\S]*await loadWebsiteAuthStatus\(\);[\s\S]*navigateToBackendDestination\(\);/,
    "Homepage backend login clicks should wait for a pending auth status load before choosing the backend or login destination"
  );
  assert.match(
    mainSource,
    /const WEBSITE_AUTH_CACHE_KEY = "asiatravelplan_backend_auth_me_v1";[\s\S]*function primeBackendLoginFromCache\(\)[\s\S]*applyWebsiteAuthState\(\{ authenticated: true, user, known: false \}\);[\s\S]*authStatusLoadPromise = \(async \(\) => \{[\s\S]*return authStatusLoadPromise;/,
    "Homepage should restore a cached backend user label immediately and return the live auth-status promise"
  );
  assert.doesNotMatch(
    mainSource,
    new RegExp(`${["shouldLoadWebsiteAuthStatus", "OnInit"].join("")}|/${["app", "home"].join("-")}\\.html`),
    "Homepage should not contain the retired authenticated app-home route"
  );
  assert.doesNotMatch(
    mainSource,
    /scheduleDeferredAuthStatusLoad\(\)|scheduleDeferredTask\(\(\) => \{\s*void loadWebsiteAuthStatus\(\)/,
    "Homepage should refresh website auth status directly instead of hiding it behind an idle callback"
  );
  assert.match(
    mainSource,
    /event\.metaKey && isLocalFrontend\(\)[\s\S]*quick_login:\s+"1"/,
    "Homepage brand-logo Command-click should keep the quick-login shortcut for local development"
  );
  assert.doesNotMatch(
    mainSource,
    /staging\.asiatravelplan\.com[\s\S]{0,300}quick_login|quick_login[\s\S]{0,300}staging\.asiatravelplan\.com|login_hint|quick_login_user/,
    "Homepage brand-logo behavior should not expose staging quick-login shortcuts or static quick-login users"
  );
  assert.match(
    mainSource,
    /async function handleFrontendLanguageChanged\(\)[\s\S]*refreshLocalizedBookingFormOptions\(\)[\s\S]*loadTrips\(\)[\s\S]*populateFilterOptions\(\)[\s\S]*applyFilters\(\)/,
    "Homepage language refresh should reload localized tours and rerender filter-driven content without a full navigation"
  );
  assert.match(
    mainSource,
    /function publicTeamDataUrl\(\) \{[\s\S]*generatedHomepageAssetUrls\(\)\?\.team[\s\S]*async function loadTeamMembers\(\{ force = false \} = \{\}\) \{[\s\S]*fetch\(dataUrl, \{ cache: "default" \}\)/,
    "Homepage team loading should read the generated versioned team payload URL and allow normal browser caching"
  );
  assert.match(
    mainSource,
    /async function handleFrontendLanguageChanged\(\)[\s\S]*applyFilters\(\)[\s\S]*tourSectionPrewarmTriggered = false;[\s\S]*renderFormStep\(\)/,
    "Homepage language refresh should reset the tours-section prewarm state after the localized tour list is refreshed"
  );
  assert.match(
    bookingFormOptionsSource,
    /function refreshLocalizedBookingFormOptions\(\)[\s\S]*populateGeneratedWebFormOptions\(\)[\s\S]*renderBudgetOptions\([\s\S]*populateTravelMonthSelects\(\)/,
    "Booking form option helpers should expose a localized refresh path for the in-place homepage language switch"
  );
  assert.match(
    mainToursSource,
    /function publicToursDataUrl\(lang\) \{[\s\S]*generatedTourAssetUrlsByLang\(\)\?\.\[normalizedLang\][\s\S]*async function loadTrips\(\) \{[\s\S]*const lang = normalizeFrontendTourLang\(currentFrontendLang\(\)\);[\s\S]*fetch\(publicToursDataUrl\(lang\), \{ cache: "no-store" \}\)/,
    "Homepage tour loading should use generated versioned per-language URLs and bypass browser cache"
  );
  assert.match(
    mainToursSource,
    /const loading = index === 0 \? "eager" : "lazy";[\s\S]*const fetchpriority = "auto";/,
    "Homepage tour cards should avoid marking multiple below-the-fold images as high priority"
  );
  assert.doesNotMatch(
    mainToursSource,
    /toursCacheKey|getCachedTours|setCachedTours|tripsRequestVersion/,
    "Homepage tour loading should no longer keep a localStorage-backed tours cache or a request-version cache buster"
  );
  assert.doesNotMatch(
    mainSource,
    /\/public\/v1\/team/,
    "Homepage source should no longer fetch the public team payload from the backend"
  );
  assert.doesNotMatch(
    mainToursSource,
    /\/public\/v1\/tours/,
    "Homepage tours source should no longer fetch tour payloads from the backend"
  );
});

test("homepage tour details keep English travel-plan source ahead of translation fallbacks", async () => {
  const mainToursPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "main_tours.js");
  const mainToursSource = await readFile(mainToursPath, "utf8");

  assert.match(
    mainToursSource,
    /function resolveTravelPlanLocalizedValue\(sourceValue, i18nValue, lang = state\.lang\)/,
    "Homepage tours should use the travel-plan-specific localization resolver"
  );
  assert.match(
    mainToursSource,
    /if \(normalizedLang === "en"\) \{[\s\S]*return sourceEnglishText \|\| i18nEnglishText;/,
    "Homepage tours should prefer the authored English source when English is selected"
  );
  assert.match(
    mainToursSource,
    /return resolveExplicitLocalizedFrontendText\(i18nValue, normalizedLang\)[\s\S]*\|\| resolveTravelPlanSourceText\(sourceValue, normalizedLang\)[\s\S]*\|\| sourceEnglishText/,
    "Homepage tours should fall back to English source before arbitrary translated values"
  );
  assert.doesNotMatch(
    mainToursSource,
    /resolveLocalizedFrontendText\(i18nValue, state\.lang\)[\s\S]{0,160}\|\| resolveLocalizedFrontendText\(source\[fieldName\], state\.lang\)/,
    "Homepage tours should not resolve *_i18n maps before English source for travel-plan fields"
  );
});

test("homepage tour cards use fixed-height text areas without an inline more link", async () => {
  const mainToursPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "main_tours.js");
  const homepagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "index.html");
  const siteCssPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "site.css");
  const [mainToursSource, homepageSource, siteCssSource] = await Promise.all([
    readFile(mainToursPath, "utf8"),
    readFile(homepagePath, "utf8"),
    readFile(siteCssPath, "utf8")
  ]);

  assert.doesNotMatch(
    homepageSource,
    /id="tourDescriptionDetail"/,
    "Homepage should not keep the old inline-description detail overlay after removing the more link"
  );
  assert.doesNotMatch(
    mainToursSource,
    /data-tour-desc-toggle|syncTourDescriptionToggles|function renderTourDescriptionDetail|tour\.card\.more/,
    "Tour cards should no longer render the old inline more link for clamped descriptions"
  );
  assert.match(
    siteCssSource,
    /\.tour-desc \{[\s\S]*-webkit-line-clamp: var\(--tour-card-desc-lines\);[\s\S]*min-height: calc\(1em \* var\(--tour-card-desc-line-height\) \* var\(--tour-card-desc-lines\)\);/,
    "Tour descriptions should clamp to a fixed-height preview so cards stay aligned"
  );
  assert.match(
    siteCssSource,
    /\.tour-body \{[\s\S]*grid-template-rows: auto auto auto 1fr auto auto;[\s\S]*\.tour-desc-wrap \{[\s\S]*min-height: calc\(1em \* var\(--tour-card-desc-line-height\) \* var\(--tour-card-desc-lines\)\);/,
    "Tour card text rows should reserve the same title, description, and tag heights before the action buttons"
  );
  assert.match(
    mainToursSource,
    /function formatTourDurationSuffix\(trip\) \{[\s\S]*const normalizedLang = normalizeFrontendTourLang\(currentFrontendLang\(\)\);[\s\S]*if \(normalizedLang === "vi"\) \{[\s\S]*return `\$\{dayCount\}N\$\{Math\.max\(0, dayCount - 1\)\}Đ`;[\s\S]*return `\$\{dayCount\}D\$\{Math\.max\(0, dayCount - 1\)\}N`;/,
    "Tour card duration suffixes should localize day/night abbreviations for Vietnamese"
  );
  assert.match(
    mainToursSource,
    /const openingTourColumnIndexes = new Map\(\)[\s\S]*data-tour-card-id="\$\{escapeAttr\(tripId\)\}"[\s\S]*function captureTourCardRects\(\)[\s\S]*function animateTourGridLayout\(previousRects, \{ excludedTripIds = \[\] \} = \{\}\)[\s\S]*if \(excludedIds\.has\(tripId\)\) return;/,
    "Show more/show less should capture and animate tour-card grid movement before expanding details"
  );
  assert.match(
    mainToursSource,
    /function animateExpandedTourCardToLeft\(row\)[\s\S]*currentColumn <= 1[\s\S]*row\.style\.setProperty\("--tour-details-column", "1"\)[\s\S]*duration: TOUR_GRID_LAYOUT_TRANSITION_MS/,
    "The expanded card should animate to the left column after sibling cards move, unless it is already left"
  );
  assert.match(
    mainToursSource,
    /const sidePanelClass = columnCount > 1[\s\S]*tour-details-row--side-panel tour-details-row--columns-\$\{columnCount\}[\s\S]*tour-details-row--attached[\s\S]*class="tour-details-row\$\{sidePanelClass\}"/,
    "Multi-column expanded tour rows should switch to the side-panel layout and attach the details panel when the card is already left-aligned"
  );
  assert.match(
    mainToursSource,
    /function stickyHeaderBottomOffset\(\)[\s\S]*document\.querySelector\("\.header"\)[\s\S]*function scrollTourCardFullyVisible\(tripId,[\s\S]*visibleTop = stickyHeaderBottomOffset\(\) \+ TOUR_CARD_SCROLL_MARGIN_PX[\s\S]*rect\.height > availableHeight \|\| rect\.top < visibleTop[\s\S]*rect\.bottom > visibleBottom/,
    "Show more should account for the sticky header and scroll the selected card fully into the visible viewport when needed"
  );
  assert.match(
    mainToursSource,
    /async function animateTourDetailsOpen\(tripId\)[\s\S]*const previousRects = captureTourCardRects\(\)[\s\S]*const previousMediaSnapshots = captureTourCardMediaSnapshots\(\)[\s\S]*const initialColumnIndex = tourGridColumnIndexForTrip\(tripId\)[\s\S]*renderVisibleTrips\(\);[\s\S]*applyTourCardMediaSnapshots\(previousMediaSnapshots\);[\s\S]*await Promise\.all\(\[\s*animateTourGridLayout\(previousRects, \{ excludedTripIds: \[tripId\] \}\),\s*animateExpandedTourCardToLeft\(row\)\s*\]\);[\s\S]*openingTourColumnIndexes\.delete\(tripId\);[\s\S]*await scrollTourCardFullyVisible\(tripId\);[\s\S]*const opensSideways = row\.classList\.contains\("tour-details-row--side-panel"\);[\s\S]*await animateTourDetailsRowHeight\(row, opensSideways \? collapsedHeight : expandedHeight, "open"\);[\s\S]*clearTourDetailsRowAnimation\(row, \{ preserveHeight: opensSideways \}\)/,
    "Opening a tour should keep card media visible, move sibling cards and the selected card left together, ensure it is visible, then expand sideways when space exists"
  );
  assert.match(
    mainToursSource,
    /function createOutgoingTourDetailsGhost\(row\)[\s\S]*const ghost = panel\.cloneNode\(true\)[\s\S]*position: "fixed"[\s\S]*function animateOutgoingTourDetailsGhost\(ghostState\)[\s\S]*async function animateTourDetailsClose\(tripId\)[\s\S]*const previousRects = captureTourCardRects\(\)[\s\S]*const previousMediaSnapshots = captureTourCardMediaSnapshots\(\)[\s\S]*const outgoingDetailsGhost = createOutgoingTourDetailsGhost\(row\)[\s\S]*renderVisibleTrips\(\);[\s\S]*applyTourCardMediaSnapshots\(previousMediaSnapshots\);[\s\S]*await Promise\.all\(\[\s*animateOutgoingTourDetailsGhost\(outgoingDetailsGhost\),\s*animateTourGridLayout\(previousRects\)\s*\]\)/,
    "Closing a tour should keep card media visible, animate a closing details ghost, and move sibling cards back into the row at the same time"
  );
  assert.match(
    siteCssSource,
    /\.tour-details-row \{[\s\S]*grid-template-columns: repeat\(var\(--tour-grid-columns, 3\), minmax\(0, 1fr\)\);[\s\S]*column-gap: 1\.5rem;[\s\S]*row-gap: 0;[\s\S]*transition:[\s\S]*height 0\.64s[\s\S]*\.tour-details-row--side-panel \.tour-details-row__shell \{[\s\S]*grid-column: 1 \/ -1;[\s\S]*grid-template-columns: repeat\(var\(--tour-grid-columns, 3\), minmax\(0, 1fr\)\);[\s\S]*\.tour-details-row--side-panel \.tour-details-row__shell > \.tour-card \{[\s\S]*grid-column: var\(--tour-details-column, 1\);[\s\S]*\.tour-details-row--side-panel \.tour-details-row__panel \{[\s\S]*grid-column: 2 \/ -1;/,
    "Expanded tour details should keep the selected card at the normal tour-card grid width and expand details into the right-side grid space"
  );
  assert.match(
    siteCssSource,
    /\.tour-details-row--side-panel\.tour-details-row--attached \.tour-details-row__shell \{[\s\S]*column-gap: 0;[\s\S]*\.tour-details-row--side-panel\.tour-details-row--attached\.tour-details-row--columns-2 \.tour-details-row__shell \{[\s\S]*grid-template-columns: calc\(\(100% - 1\.5rem\) \/ 2\) minmax\(0, 1fr\);[\s\S]*\.tour-details-row--side-panel\.tour-details-row--attached\.tour-details-row--columns-3 \.tour-details-row__shell \{[\s\S]*grid-template-columns: calc\(\(100% - 3rem\) \/ 3\) minmax\(0, 1fr\);/,
    "Attached side-panel tour details should remove the gutter while keeping the card track at the normal tour-card width"
  );
});

test("homepage TravelAgency structured data mirrors footer contact details", async () => {
  const homepagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "index.html");
  const runtimeConfigPath = path.resolve(__dirname, "..", "src", "config", "runtime.js");
  const [homepageSource, runtimeConfigSource] = await Promise.all([
    readFile(homepagePath, "utf8"),
    readFile(runtimeConfigPath, "utf8")
  ]);

  const jsonLdBlocks = Array.from(homepageSource.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g))
    .map((match) => JSON.parse(match[1]));
  const travelAgencySchema = jsonLdBlocks.find((schema) => schema?.["@type"] === "TravelAgency");
  const faqSchema = jsonLdBlocks.find((schema) => schema?.["@type"] === "FAQPage");
  const footerPhone = homepageSource.match(/data-i18n-id="footer\.whatsapp">WhatsApp:\s*([^<]+)/)?.[1];
  const footerEmail = homepageSource.match(/data-i18n-id="footer\.email">Email:\s*([^<]+)/)?.[1];
  const footerFacebookUrl = homepageSource.match(/<a href="([^"]+)"[^>]*data-i18n-id="footer\.facebook"/)?.[1];
  const licenseNumber = runtimeConfigSource.match(/licenseNumber:\s*"([^"]+)"/)?.[1];

  assert.ok(travelAgencySchema, "Homepage should publish TravelAgency JSON-LD");
  assert.equal(travelAgencySchema.telephone, footerPhone);
  assert.equal(travelAgencySchema.email, footerEmail);
  assert.equal(travelAgencySchema.contactPoint?.[0]?.telephone, footerPhone);
  assert.equal(travelAgencySchema.contactPoint?.[0]?.email, footerEmail);
  assert.equal(travelAgencySchema.contactPoint?.[0]?.url, "https://wa.me/84354999192");
  assert.equal(travelAgencySchema.identifier?.value, licenseNumber);
  assert.ok(travelAgencySchema.sameAs?.includes(footerFacebookUrl), "TravelAgency schema should include the footer Facebook URL");
  assert.deepEqual(
    travelAgencySchema.address,
    [
      {
        "@type": "PostalAddress",
        name: "Head office in Hội An",
        streetAddress: "378/51 Cửa Đại",
        addressLocality: "Hội An Đông",
        addressRegion: "Đà Nẵng",
        addressCountry: "VN"
      },
      {
        "@type": "PostalAddress",
        name: "Office in Hà Nội",
        streetAddress: "59 Đ. Lạc Long Quân",
        addressLocality: "Nghĩa Đô",
        postalCode: "100000",
        addressRegion: "Hà Nội",
        addressCountry: "VN"
      }
    ]
  );
  assert.doesNotMatch(JSON.stringify(travelAgencySchema), /Ho Chi Minh City|\+84-90-000-0000/);
  assert.ok(faqSchema, "Homepage should publish FAQPage JSON-LD for visible FAQ content");
  assert.ok(
    faqSchema.mainEntity?.length >= 8,
    "Homepage FAQPage schema should cover the public planning and booking questions"
  );
  assert.ok(
    faqSchema.mainEntity?.some((item) => item.name === "How do I book a tour?" && item.acceptedAnswer?.text?.includes("Fast response within 2 hours")),
    "Homepage FAQPage schema should include the visible booking answer"
  );
});

test("homepage hero title follows published destinations and keeps the destination button visible", async () => {
  const mainToursPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "main_tours.js");
  const homepagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "index.html");
  const frontendEnI18nPath = path.resolve(__dirname, "..", "..", "..", "frontend", "data", "i18n", "frontend", "en.json");
  const frontendI18nScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "frontend_i18n.js");
  const siteCssPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "site.css");
  const desktopHeroVideoPath = path.resolve(__dirname, "..", "..", "..", "assets", "video", "rice field.mp4");
  const mobileHeroVideoPath = path.resolve(__dirname, "..", "..", "..", "assets", "video", "rice field-mobile.mp4");
  const [
    mainToursSource,
    homepageSource,
    frontendEnI18nSource,
    frontendI18nScriptSource,
    siteCssSource,
    desktopHeroVideo,
    mobileHeroVideo
  ] = await Promise.all([
    readFile(mainToursPath, "utf8"),
    readFile(homepagePath, "utf8"),
    readFile(frontendEnI18nPath, "utf8"),
    readFile(frontendI18nScriptPath, "utf8"),
    readFile(siteCssPath, "utf8"),
    stat(desktopHeroVideoPath),
    stat(mobileHeroVideoPath)
  ]);

  assert.match(
    homepageSource,
    /id="heroTitle"[\s\S]*class="filter-menu--hero__filters"[\s\S]*id="navStyleTrigger"[\s\S]*id="navDestinationWrap" class="select-wrap"[\s\S]*id="navDestinationSummary" data-i18n-id="filters\.all_destinations">All destinations[\s\S]*class="filter-menu--hero__cta"[\s\S]*id="viewToursBtn"/,
    "Homepage hero should expose a dedicated title mount, keep the style and destination controls on the left, and move the tour CTA into its right-side group"
  );
  assert.match(
    homepageSource,
    /<link rel="stylesheet" href="\/shared\/css\/tokens\.css" \/>[\s\S]*<link rel="stylesheet" href="\/shared\/css\/site-home-critical\.css" \/>[\s\S]*<link rel="stylesheet" href="\/shared\/css\/pages\/home-critical\.css" \/>[\s\S]*<link rel="preload" href="\/shared\/css\/site-home-deferred\.css" as="style"[\s\S]*<link rel="preload" href="\/shared\/css\/pages\/home-deferred\.css" as="style"/,
    "Homepage should link the real shared CSS assets directly instead of routing critical and deferred styles through import wrappers"
  );
  assert.doesNotMatch(
    homepageSource,
    /<script[^>]+src="\/frontend\/scripts\/shared\/localhost_diagnostics\.js"/,
    "Homepage should not request localhost diagnostics in production"
  );
  assert.match(
    homepageSource,
    /<source data-src="\/assets\/video\/rice field-mobile\.mp4" media="\(max-width: 760px\)" type="video\/mp4" \/>\s*<source data-src="\/assets\/video\/rice field\.mp4" type="video\/mp4" \/>[\s\S]*const findHeroVideoSource = \(\) => heroVideoSources\.find[\s\S]*window\.matchMedia\(media\)\.matches[\s\S]*attachVideoSource\(\)[\s\S]*window\.addEventListener\("load", startPlayback, \{ once: true \}\)/,
    "Homepage should keep hero MP4s out of the initial request graph and attach a mobile-specific source on small screens"
  );
  assert.ok(
    mobileHeroVideo.size < desktopHeroVideo.size / 3,
    "Mobile hero MP4 should be materially smaller than the desktop hero MP4"
  );
  assert.match(
    homepageSource,
    /<script defer src="\/shared\/generated\/language_catalog\.global\.js"><\/script>[\s\S]*<script defer src="\/frontend\/data\/generated\/homepage\/public-homepage-copy\.global\.js"><\/script>[\s\S]*<script defer src="\/frontend\/scripts\/shared\/frontend_i18n\.js"><\/script>[\s\S]*<script defer src="\/frontend\/data\/generated\/homepage\/public-homepage-main\.bundle\.js"><\/script>/,
    "Homepage boot should use ordered deferred scripts so the browser can fetch i18n and main bundle assets in parallel"
  );
  assert.doesNotMatch(
    homepageSource,
    /const loadScript = \(src, \{ type = "text\/javascript" \} = \{\}\) => new Promise/,
    "Homepage should no longer append the main bundle through a sequential inline script loader"
  );
  assert.match(
    frontendEnI18nSource,
    /"hero\.title_with_destinations": "Private holidays in \{destinations\}"/,
    "Frontend hero copy should expose a destination-aware title template"
  );
  assert.match(
    frontendI18nScriptSource,
    /function generatedTranslationOverride\(id\) \{[\s\S]*'hero\.title': GENERATED_HOMEPAGE_COPY\?\.heroTitleByLang[\s\S]*'meta\.home_title': GENERATED_HOMEPAGE_COPY\?\.metaTitleByLang[\s\S]*'meta\.home_description': GENERATED_HOMEPAGE_COPY\?\.metaDescriptionByLang[\s\S]*normalizeText\(generatedById\[state\.lang\]\)/,
    "Homepage hero and metadata promises should come from the deploy-generated homepage copy"
  );
  assert.match(
    mainToursSource,
    /function shouldShowHeroDestinationFilter\(\) \{[\s\S]*return true;[\s\S]*function normalizeDestinationScopeFilterFromOptions\(\) \{[\s\S]*state\.filters\.area = area;[\s\S]*state\.filters\.place = place;[\s\S]*function normalizeActiveFiltersFromOptions\(\) \{[\s\S]*normalizeDestinationScopeFilterFromOptions\(\);[\s\S]*state\.filters\.style = normalizeSelectionToCodes\(state\.filters\.style, "style", \{ allowUnknown: false \}\);[\s\S]*function selectedDestinationScopeLabel\(\) \{[\s\S]*labels\.join\(" · "\)[\s\S]*frontendT\("filters\.all_destinations", "All destinations"\)/,
    "Homepage should keep the hero destination button visible and preserve valid destination, area, and place filters"
  );
  assert.match(
    mainToursSource,
    /const destinationFilterWrap = els\.navDestinationWrap;[\s\S]*const showDestinationFilter = shouldShowHeroDestinationFilter\(\);[\s\S]*destinationFilterWrap\.hidden = !showDestinationFilter;[\s\S]*els\.navDestinationPanel\.hidden = true;/,
    "Homepage filter rendering should keep the destination picker visible while still resetting the closed panel state"
  );
  assert.match(
    siteCssSource,
    /\.select-wrap\[hidden\]\s*\{[\s\S]*display:\s*none;/,
    "Hidden select wrappers should stay hidden even though the base select-wrap class uses display:flex"
  );
});

test("runtime links use direct tours and settings pages instead of backend section query routes", async () => {
  const filesToScan = [
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking_list.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tours_list.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "standard_tours.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "standard_tour.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "settings_list.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "emergency.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tour.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "nav.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "marketing_tours.html"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "standard-tours.html"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "standard-tour.html"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "settings.html"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "emergency.html")
  ];

  for (const filePath of filesToScan) {
    const source = await readFile(filePath, "utf8");
    assert.doesNotMatch(
      source,
      /backend\.html\?section=(tours|standard-tours|settings|emergency)/,
      `${path.basename(filePath)} should not hard-code backend section query routes for tours/standard-tours/settings/emergency`
    );
    assert.doesNotMatch(
      source,
      /withBackendLang\(\s*"\/(backend|bookings)\.html"\s*,\s*\{\s*section\s*:\s*"(tours|standard-tours|settings|emergency)"/,
      `${path.basename(filePath)} should not build tours/standard-tours/settings/emergency routes through the bookings entry page`
    );
  }
});

test("booking travel-plan templates apply marketing tours through the tour endpoints", async () => {
  const navPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "nav.js");
  const pagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "standard-tours.html");
  const pageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "standard_tours.js");
  const detailScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "standard_tour.js");
  const bookingLibraryPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_service_library.js");
  const bookingTravelPlanPath = travelPlanEditorCorePath();
  const routesPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "http", "routes.js");
  const handlersPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "http", "handlers", "standard_tours.js");
  const domainPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "domain", "standard_tours.js");
  const [
    navSource,
    pageSource,
    pageScriptSource,
    detailScriptSource,
    bookingLibrarySource,
    bookingTravelPlanSource,
    routesSource,
    handlersSource,
    domainSource
  ] = await Promise.all([
    readFile(navPath, "utf8"),
    readFile(pagePath, "utf8"),
    readFile(pageScriptPath, "utf8"),
    readFile(detailScriptPath, "utf8"),
    readFile(bookingLibraryPath, "utf8"),
    readFile(bookingTravelPlanPath, "utf8"),
    readFile(routesPath, "utf8"),
    readFile(handlersPath, "utf8"),
    readFile(domainPath, "utf8")
  ]);

  assert.match(navSource, /standard-tours\.html/, "Backend nav should link to the dedicated standard tours page");
  assert.match(navSource, /const canReadStandardTours = hasAnyRole\(resolvedRoles, "atp_tour_editor"\);/, "Backend nav should only show standard tours to atp_tour_editor users");
  assert.match(pageSource, /id="standardToursTable"/, "The standard tours page should expose the standard tours table");
  assert.match(pageScriptSource, /\/api\/v1\/standard-tours/, "The standard tours page should load standard tours from the dedicated backend endpoint");
  assert.match(pageScriptSource, /const DESTINATION_COUNTRY_CODES = Object\.freeze\(\["VN", "TH", "KH", "LA"\]\)/, "The standard tours UI should limit destinations to the four supported country codes");
  assert.match(pageScriptSource, /expectedRolesAnyOf:\s*\[ROLES\.TOUR_EDITOR\]/, "The standard tours list page should require the atp_tour_editor role");
  assert.match(detailScriptSource, /expectedRolesAnyOf:\s*\[ROLES\.TOUR_EDITOR\]/, "The standard tour detail page should require the atp_tour_editor role");
  assert.match(bookingLibrarySource, /bookingTourApplyRequest/, "The booking travel-plan library should apply marketing tours through the dedicated endpoint");
  assert.doesNotMatch(bookingLibrarySource, /bookingStandardTourApplyRequest/, "The booking travel-plan library should no longer apply standard tours from the booking editor");
  assert.match(bookingLibrarySource, /toursRequest\(/, "The booking travel-plan library should search marketing tours from the tours endpoint");
  assert.match(bookingTravelPlanSource, /data-travel-plan-open-tour-import/, "The booking travel-plan footer should expose a marketing tour action");
  assert.match(routesSource, /\/api\/v1\/bookings\/\{booking_id\}\/travel-plan\/tours\/\{tour_id\}\/apply/, "HTTP routes should include the marketing-tour apply endpoint");
  assert.match(routesSource, /\/api\/v1\/standard-tours/, "HTTP routes should include the standard tour endpoints");
  assert.doesNotMatch(handlersSource, /Only published standard tours can be applied/, "Standard tour apply handler should not enforce standard tour status");
  assert.match(domainSource, /enumValueSetFor\("CountryCode"\)[\s\S]*normalizeText\(value\)\.toUpperCase\(\)[\s\S]*COUNTRY_CODE_SET\.has\(value\)/, "Standard tour destination normalization should store CountryCode values instead of tour destination slugs");
});

test("marketing tour editor imports days and services only from other marketing tours", async () => {
  const marketingTourPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "marketing_tour.html");
  const tourAdapterPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tour_travel_plan_adapter.js");
  const tourPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tour.js");
  const travelPlanLibraryPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_service_library.js");
  const routesPath = path.resolve(__dirname, "..", "src", "http", "routes.js");
  const tourHandlersPath = path.resolve(__dirname, "..", "src", "http", "handlers", "tours.js");
  const [
    marketingTourPageSource,
    tourAdapterSource,
    tourPageScriptSource,
    travelPlanLibrarySource,
    routesSource,
    tourHandlersSource
  ] = await Promise.all([
    readFile(marketingTourPagePath, "utf8"),
    readFile(tourAdapterPath, "utf8"),
    readFile(tourPageScriptPath, "utf8"),
    readFile(travelPlanLibraryPath, "utf8"),
    readFile(routesPath, "utf8"),
    readFile(tourHandlersPath, "utf8")
  ]);

  assert.match(marketingTourPageSource, /id="travel_plan_service_library_modal"/, "Marketing tour page should include the reusable travel-plan library modal");
  assert.match(tourPageScriptSource, /travelPlanServiceLibraryModal:\s*document\.getElementById\("travel_plan_service_library_modal"\)/, "Marketing tour script should wire the travel-plan library modal");
  assert.match(tourAdapterSource, /tourTravelPlanDaySearchRequest/, "Marketing tour editor should search reusable days through tour endpoints");
  assert.match(tourAdapterSource, /tourTravelPlanServiceSearchRequest/, "Marketing tour editor should search reusable services through tour endpoints");
  assert.match(tourAdapterSource, /tourTravelPlanDayImportRequest/, "Marketing tour editor should import days through tour endpoints");
  assert.match(tourAdapterSource, /tourTravelPlanServiceImportRequest/, "Marketing tour editor should import services through tour endpoints");
  assert.match(tourAdapterSource, /travelPlanLibrarySource:\s*"marketing_tour"/, "Marketing tour editor should mark the library source as marketing tours");
  assert.match(tourAdapterSource, /dayImport:\s*true/, "Marketing tour editor should expose day import");
  assert.match(tourAdapterSource, /serviceImport:\s*true/, "Marketing tour editor should expose service import");
  assert.match(travelPlanLibrarySource, /buildTravelPlanDaySearchRequest/, "Shared library should accept entity-specific day search builders");
  assert.match(travelPlanLibrarySource, /buildTravelPlanServiceImportRequest/, "Shared library should accept entity-specific service import builders");
  assert.match(routesSource, /\/api\/v1\/tours\/travel-plan-days\/search/, "Routes should expose marketing tour day search");
  assert.match(routesSource, /\/api\/v1\/tours\/travel-plan-services\/search/, "Routes should expose marketing tour service search");
  assert.match(routesSource, /\/api\/v1\/tours\/\{tour_id\}\/travel-plan\/days\/import/, "Routes should expose marketing tour day import");
  assert.match(routesSource, /\/api\/v1\/tours\/\{tour_id\}\/travel-plan\/days\/\{day_id\}\/services\/import/, "Routes should expose marketing tour service import");
  assert.match(tourHandlersSource, /sourceTourId === tourId[\s\S]*Choose a day from another marketing tour/, "Day imports should reject the current marketing tour as a source");
  assert.match(tourHandlersSource, /sourceTourId === tourId[\s\S]*Choose a service from another marketing tour/, "Service imports should reject the current marketing tour as a source");
});

test("booking travel plan copies days and services from marketing tours only", async () => {
  const bookingPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const bookingImportHandlersPath = path.resolve(__dirname, "..", "src", "http", "handlers", "booking_travel_plan_import.js");
  const bookingHandlersPath = path.resolve(__dirname, "..", "src", "http", "handlers", "booking_travel_plan.js");
  const bookingsSourcePath = path.resolve(__dirname, "..", "src", "http", "handlers", "bookings.js");
  const clonerPath = path.resolve(__dirname, "..", "src", "http", "handlers", "marketing_tour_booking_travel_plan.js");
  const apiModelsPath = path.resolve(__dirname, "..", "..", "..", "shared", "generated-contract", "API", "generated_APIModels.js");
  const apiRequestFactoryPath = path.resolve(__dirname, "..", "..", "..", "shared", "generated-contract", "API", "generated_APIRequestFactory.js");
  const routesPath = path.resolve(__dirname, "..", "src", "http", "routes.js");
  const travelPlanLibraryPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_service_library.js");
  const [
    bookingPageScriptSource,
    bookingImportHandlersSource,
    bookingHandlersSource,
    bookingsSource,
    clonerSource,
    apiModelsSource,
    apiRequestFactorySource,
    routesSource,
    travelPlanLibrarySource
  ] = await Promise.all([
    readFile(bookingPageScriptPath, "utf8"),
    readFile(bookingImportHandlersPath, "utf8"),
    readFile(bookingHandlersPath, "utf8"),
    readFile(bookingsSourcePath, "utf8"),
    readFile(clonerPath, "utf8"),
    readFile(apiModelsPath, "utf8"),
    readFile(apiRequestFactoryPath, "utf8"),
    readFile(routesPath, "utf8"),
    readFile(travelPlanLibraryPath, "utf8")
  ]);

  assert.match(bookingPageScriptSource, /tourTravelPlanDaySearchRequest[\s\S]*tourTravelPlanServiceSearchRequest/, "Booking editor should search day and service libraries through marketing-tour endpoints");
  assert.match(bookingPageScriptSource, /buildBookingMarketingTourDayImportRequest[\s\S]*source_tour_id:\s*normalizedSourceTourId[\s\S]*buildBookingMarketingTourServiceImportRequest[\s\S]*source_tour_id:\s*normalizedSourceTourId/, "Booking editor should import selected marketing-tour days and services with source_tour_id");
  assert.match(bookingPageScriptSource, /travelPlanLibrarySource:\s*"marketing_tour"[\s\S]*dayImport:\s*true[\s\S]*tourImport:\s*false[\s\S]*serviceImport:\s*true/, "Booking travel plan should expose only day and service copy actions from the marketing-tour library");
  assert.doesNotMatch(bookingPageScriptSource, /planImport/, "Booking travel plan should not expose full booking travel-plan import");
  assert.match(bookingImportHandlersSource, /validateTravelPlanDayImportPayload[\s\S]*assertRequiredIdentifier\(value\.source_tour_id[\s\S]*validateTravelPlanServiceImportPayload[\s\S]*assertRequiredIdentifier\(value\.source_tour_id/, "Booking import handlers should require marketing-tour import sources");
  assert.doesNotMatch(bookingImportHandlersSource, /source_booking_id/, "Booking import handlers should not accept booking import sources");
  assert.match(bookingImportHandlersSource, /cloneMarketingTourServiceForBooking[\s\S]*Service imported from marketing tour[\s\S]*cloneMarketingTourDayForBooking[\s\S]*Day imported from marketing tour/, "Booking import handlers should clone selected marketing-tour services and days into booking travel plans");
  assert.match(bookingHandlersSource, /marketingTourBookingTravelPlanCloner/, "Booking travel-plan handlers should pass the marketing-tour cloner into import handlers");
  assert.match(bookingsSource, /marketingTourBookingTravelPlanCloner[\s\S]*createBookingTravelPlanHandlers/, "Booking handlers should construct and provide the marketing-tour cloner");
  assert.match(clonerSource, /cloneMarketingTourDayForBooking[\s\S]*cloneMarketingTourServiceForBooking[\s\S]*cloneMarketingTourTravelPlanForBooking/, "Marketing-tour booking cloner should expose single day and service clone helpers");
  assert.match(apiModelsSource, /TRAVEL_PLAN_DAY_IMPORT_REQUEST_SCHEMA[\s\S]*source_tour_id","required":true[\s\S]*source_day_id","required":true/, "Generated day import contract should require marketing-tour sources");
  assert.match(apiModelsSource, /TRAVEL_PLAN_SERVICE_IMPORT_REQUEST_SCHEMA[\s\S]*source_tour_id","required":true[\s\S]*source_service_id","required":true/, "Generated service import contract should require marketing-tour sources");
  assert.doesNotMatch(apiModelsSource, /TRAVEL_PLAN_DAY_IMPORT_REQUEST_SCHEMA[\s\S]{0,1200}source_booking_id/, "Generated day import contract should not expose booking import sources");
  assert.doesNotMatch(apiModelsSource, /TRAVEL_PLAN_SERVICE_IMPORT_REQUEST_SCHEMA[\s\S]{0,1200}source_booking_id/, "Generated service import contract should not expose booking import sources");
  assert.doesNotMatch(apiRequestFactorySource, /travelPlanDaySearchRequest|travelPlanServiceSearchRequest|travelPlanSearchRequest|bookingTravelPlanImportRequest/, "Generated request factory should not expose booking travel-plan library endpoints");
  assert.doesNotMatch(routesSource, /\/api\/v1\/travel-plan-days\/search|\/api\/v1\/travel-plan-services\/search|\/api\/v1\/travel-plan\/plans|\/api\/v1\/bookings\/\{booking_id\}\/travel-plan\/import/, "Routes should not expose booking travel-plan library endpoints");
  assert.doesNotMatch(travelPlanLibrarySource, /bookingTravelPlanImportRequest|travelPlanDaySearchRequest|travelPlanServiceSearchRequest|travelPlanSearchRequest|data-travel-plan-import-source-plan-booking|openTravelPlanLibrary/, "Shared library should not call booking travel-plan library endpoints");
});

test("travel plan library cards keep media separate from copy and actions", async () => {
  const travelPlanStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking-travel-plan.css");
  const travelPlanStyles = await readFile(travelPlanStylesPath, "utf8");

  assert.match(
    travelPlanStyles,
    /\.travel-plan-library-card \{[\s\S]*grid-template-columns: 140px minmax\(0, 1fr\);[\s\S]*grid-template-areas:\s*"media content"[\s\S]*"media actions";/,
    "Travel-plan library cards should keep thumbnails in a dedicated column while content and actions occupy separate grid areas"
  );
  assert.match(
    travelPlanStyles,
    /\.travel-plan-library-card__content \{[\s\S]*overflow: hidden;[\s\S]*\.travel-plan-library-card__content h3 \{[\s\S]*overflow-wrap: anywhere;[\s\S]*\.travel-plan-library-card__content p \{[\s\S]*overflow-wrap: anywhere;/,
    "Travel-plan library copy should wrap inside its own column instead of spilling across the thumbnail"
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
  const filePath = path.resolve(__dirname, "..", "..", "..", "scripts", "deploy", "update_staging.sh");
  const source = await readFile(filePath, "utf8");

  assert.ok(!source.includes('"customers"'), "update_staging.sh should not bootstrap legacy customers collection");
  assert.match(
    source,
    /printf '\{\}\\n' > backend\/app\/data\/store\.json/,
    "update_staging.sh should bootstrap an empty JSON store"
  );
});

test("staging backend bakes dependencies into the image and mounts only the writable runtime roots it updates", async () => {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const dockerfilePath = path.join(repoRoot, "backend", "Dockerfile.staging");
  const composePath = path.join(repoRoot, "docker-compose.staging.yml");
  const updateStagingPath = path.join(repoRoot, "scripts", "deploy", "update_staging.sh");
  const dockerIgnorePath = path.join(repoRoot, ".dockerignore");
  const [dockerfileSource, composeSource, updateStagingSource, dockerIgnoreSource] = await Promise.all([
    readFile(dockerfilePath, "utf8"),
    readFile(composePath, "utf8"),
    readFile(updateStagingPath, "utf8"),
    readFile(dockerIgnorePath, "utf8")
  ]);
  const backendComposeBlock = (composeSource.match(/\n  backend:\n[\s\S]*?(?=\n  keycloak:)/)?.[0] || "");

  assert.match(
    dockerfileSource,
    /COPY --chown=node:node backend\/app\/package\.json backend\/app\/package-lock\.json \.\/[\s\S]*RUN npm ci/,
    "Staging backend image should install backend dependencies during docker build"
  );
  assert.match(
    dockerfileSource,
    /COPY --chown=node:node \. \.[\s\S]*WORKDIR \/srv\/backend\/app[\s\S]*CMD \["node", "src\/server\.js"\]/,
    "Staging backend image should carry the repo snapshot and start the backend directly"
  );
  assert.match(
    backendComposeBlock,
    /user: "1000:1000"/,
    "Staging backend should run as the host-compatible non-root user"
  );
  assert.doesNotMatch(
    backendComposeBlock,
    /command:\s*sh -c "npm ci && npm start"/,
    "Staging backend should not reinstall dependencies on container startup"
  );
  assert.doesNotMatch(
    backendComposeBlock,
    /-\s*\.\/:\/srv\b/,
    "Staging backend should not bind-mount the whole repo at runtime"
  );
  assert.match(
    backendComposeBlock,
    /- \.\/backend\/app\/data:\/srv\/backend\/app\/data[\s\S]*- \.\/content:\/srv\/content[\s\S]*- \.\/frontend\/data\/generated\/homepage:\/srv\/frontend\/data\/generated\/homepage[\s\S]*- \.\/assets\/generated\/homepage:\/srv\/assets\/generated\/homepage/,
    "Staging backend should mount the writable backend data, content, and shared generated homepage roots"
  );
  assert.match(
    backendComposeBlock,
    /PUBLIC_HOMEPAGE_FRONTEND_DATA_DIR: \/srv\/frontend\/data\/generated\/homepage[\s\S]*PUBLIC_HOMEPAGE_ASSETS_DIR: \/srv\/assets\/generated\/homepage/,
    "Staging backend should point homepage generation at the same generated roots Caddy serves"
  );
  assert.match(
    updateStagingSource,
    /mkdir -p frontend\/data\/generated\/homepage assets\/generated\/homepage[\s\S]*generate_public_homepage_assets/,
    "Staging deploy should create the shared generated homepage roots before running the homepage asset generator"
  );
  assert.doesNotMatch(
    updateStagingSource,
    /npm ci >/,
    "Staging pre-deploy tests should rely on the baked image dependencies"
  );
  assert.match(
    dockerIgnoreSource,
    /\*\*\/node_modules/,
    "Docker builds should ignore host node_modules directories"
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
  const paymentFlowPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "payment_flow.js");
  const financeHandlerPath = path.resolve(__dirname, "..", "src", "http", "handlers", "booking_finance.js");
  const paymentFlowSource = await readFile(paymentFlowPath, "utf8");
  const financeSource = await readFile(financeHandlerPath, "utf8");

  assert.doesNotMatch(paymentFlowSource, /\[offer-exchange-debug\]/, "frontend offer exchange debug logs should be removed");
  assert.doesNotMatch(financeSource, /\[offer-exchange-debug backend\]/, "backend offer exchange debug logs should be removed");
});

test("website backend login goes directly to auth login instead of logout-to-login chaining", async () => {
  const mainPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "main.js");
  const mainSource = await readFile(mainPath, "utf8");

  assert.match(
    mainSource,
    /const loginUrl = `\$\{API_BASE_ORIGIN\}\/auth\/login\?\$\{loginParams\.toString\(\)\}`[\s\S]*window\.location\.href = loginUrl;/,
    "website backend login should navigate straight to auth/login with prompt=login"
  );
  assert.doesNotMatch(
    mainSource,
    /auth\/logout\?return_to=.*auth\/login/,
    "website backend login should not chain through auth/logout before auth/login"
  );
});

test("backend logout clears cached website auth state before navigation", async () => {
  const sharedAuthPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "auth.js");
  const sharedAuthSource = await readFile(sharedAuthPath, "utf8");

  assert.match(
    sharedAuthSource,
    /export function clearCachedAuthMe\(\) \{[\s\S]*window\.sessionStorage\.removeItem\(BACKEND_AUTH_CACHE_KEY\);/,
    "shared auth should expose a helper that clears the cached auth/me response"
  );
  assert.match(
    sharedAuthSource,
    /link\.addEventListener\("click", \(event\) => \{\s*clearCachedAuthMe\(\);[\s\S]*const targetHref/,
    "logout links should clear cached auth state before following the logout href"
  );
});

test("backend auth normalizes token roles and derives callback URLs from the active request origin", async () => {
  const authPath = path.resolve(__dirname, "..", "src", "auth.js");
  const authSource = await readFile(authPath, "utf8");

  assert.match(
    authSource,
    /RETURN_TO_ALLOWED_ORIGINS \|\| `http:\/\/localhost:8080,http:\/\/127\.0\.0\.1:8080,http:\/\/localhost:\$\{port\},http:\/\/127\.0\.0\.1:\$\{port\}`/,
    "auth.js should allow both localhost and 127.0.0.1 origins by default for local return_to values"
  );
  assert.match(
    authSource,
    /function resolveAuthRedirectUri\(req\)[\s\S]*new URL\("\/auth\/callback", requestOrigin\)\.toString\(\)/,
    "auth.js should derive the auth callback URL from the current request origin"
  );
  assert.match(
    authSource,
    /authRequests\.set\(state,\s*\{[\s\S]*redirect_uri:\s*redirectUri[\s\S]*created_at:\s*Date\.now\(\)/,
    "auth.js should persist the request-specific redirect URI in the auth request state"
  );
  assert.match(
    authSource,
    /function isLocalQuickLoginAllowed\(req\)[\s\S]*isLoopbackHost\(hostnameFromHostHeader\(req\.headers\.host\)\) && isLoopbackUrl\(cfg\.keycloakBaseUrl\)/,
    "auth.js should gate quick login to loopback requests against loopback Keycloak only"
  );
  assert.match(
    authSource,
    /grant_type:\s+"password"[\s\S]*username,[\s\S]*password,[\s\S]*client_secret:\s+cfg\.keycloakClientSecret/,
    "auth.js should implement local quick login as a backend-only password grant without static frontend credentials"
  );
  assert.doesNotMatch(
    authSource,
    /staging\.asiatravelplan\.com|login_hint/,
    "auth.js should not pass staging quick-login hints into Keycloak"
  );
  assert.match(
    authSource,
    /redirect_uri:\s*normalizeText\(requestState\.redirect_uri\) \|\| cfg\.keycloakRedirectUri/,
    "auth.js should use the stored request-specific redirect URI during the token exchange"
  );
  assert.match(
    authSource,
    /\.map\(\(role\) => normalizeText\(role\)\.toLowerCase\(\)\)/,
    "auth.js should normalize live token role names before permission checks"
  );
  assert.match(
    authSource,
    /function normalizeLogoutReturnTo\(value\)[\s\S]*isRootLikePath\(parsedRaw\.pathname\)[\s\S]*isRootLikePath\(parsedConfigured\.pathname\)[\s\S]*return configured;/,
    "auth.js should normalize root and index.html logout return URLs to the configured Keycloak post-logout redirect"
  );
  assert.match(
    authSource,
    /function sameLogoutOriginAlias\(left,\s*right\)[\s\S]*isLoopbackHost\(left\.hostname\)[\s\S]*isLoopbackHost\(right\.hostname\)/,
    "auth.js should treat localhost and 127.0.0.1 as equivalent loopback origins for logout redirect normalization"
  );
});
