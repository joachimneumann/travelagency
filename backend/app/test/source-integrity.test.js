import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);

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
  const syncScriptPath = path.join(repoRoot, "scripts", "sync_backend_i18n.mjs");
  const startLocalBackendPath = path.join(repoRoot, "scripts", "start_local_backend.sh");
  const startLocalBackendSource = await readFile(startLocalBackendPath, "utf8");

  await execFileAsync(process.execPath, [syncScriptPath, "check"], { cwd: repoRoot });

  assert.match(
    startLocalBackendSource,
    /BACKEND_I18N_STRICT="\$\{BACKEND_I18N_STRICT:-1\}"/,
    "Local backend startup should enable strict backend i18n checking by default"
  );
  assert.match(
    startLocalBackendSource,
    /node "\$sync_script" check/,
    "Local backend startup should run the backend i18n sync check before booting"
  );
});

test("translate wrapper covers backend and frontend i18n sync scripts", async () => {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const frontendSyncScriptPath = path.join(repoRoot, "scripts", "sync_frontend_i18n.mjs");
  const translateScriptPath = path.join(repoRoot, "scripts", "translate");
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
    "savePricing",
    "handleOfferCurrencyChange",
    "addOfferPricingRow",
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
  assert.doesNotMatch(bookingSource, /id="invoice_create_btn"/, "Invoice form should no longer expose a local save button");
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

test("backend startup writes back legacy generated-offer confirmation fields before serving requests", async () => {
  const serverPath = path.resolve(__dirname, "..", "src", "server.js");
  const confirmationDomainPath = path.resolve(__dirname, "..", "src", "domain", "booking_confirmation.js");
  const serverSource = await readFile(serverPath, "utf8");
  const confirmationDomainSource = await readFile(confirmationDomainPath, "utf8");

  assert.match(
    confirmationDomainSource,
    /function migratePersistedGeneratedOfferBookingConfirmationState\(generatedOffer\) \{[\s\S]*customer_confirmation_flow[\s\S]*acceptance_route[\s\S]*booking_confirmation_token_nonce/,
    "Generated-offer confirmation migration should rewrite legacy route and token field names into the current persisted shape"
  );
  assert.match(
    serverSource,
    /backfillGeneratedOfferBookingConfirmationState\(startupStore,[\s\S]*persistStore\(startupStore\)/,
    "Backend startup should persist legacy generated-offer confirmation field migrations before serving requests"
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

test("booking person gender enum stays in sync across model and generated contracts", async () => {
  const modelEnumPath = path.resolve(__dirname, "..", "..", "..", "model", "enums", "booking_person_gender.cue");
  const modelEntityPath = path.resolve(__dirname, "..", "..", "..", "model", "entities", "booking_person.cue");
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
  assert.match(
    bookingSource,
    /id="generate_offer_dirty_hint" class="micro booking-inline-status booking-generated-offers-actions__hint"/,
    "The booking page should render the generated-offer dirty hint with a dedicated hint class"
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
  assert.match(
    bookingStyles,
    /\.booking-detail-page \.booking-generated-offers-actions \{\s*[\s\S]*display: grid;[\s\S]*justify-items: center;[\s\S]*gap: 0\.35rem;/,
    "The generated-offer action block should stack the clean-state hint below the button"
  );
  assert.match(
    bookingStyles,
    /\.booking-detail-page \.booking-generated-offers-actions__hint \{\s*[\s\S]*display: block;[\s\S]*margin: 0;[\s\S]*color: var\(--error-text-strong\);[\s\S]*text-align: center;/,
    "The generated-offer clean-state hint should render as centered red helper text under the button"
  );
});

test("booking page uses the dirty bar as the only red dirty-state surface", async () => {
  const bookingPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const bookingStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking.css");
  const bookingSource = await readFile(bookingPageScriptPath, "utf8");
  const bookingStyles = await readFile(bookingStylesPath, "utf8");

  assert.doesNotMatch(
    bookingSource,
    /setDirtySurface\(/,
    "Booking sections should no longer be painted as red dirty surfaces"
  );
  assert.match(
    bookingSource,
    /dirtyBar\.classList\.toggle\("booking-dirty-bar--dirty", isDirty\);/,
    "The page-level dirty bar should own the visual dirty state"
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

test("booking dirty bar stays visible while clean and reports save or discard progress", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const bookingPageSource = await readFile(bookingPagePath, "utf8");
  const bookingSource = await readFile(bookingPageScriptPath, "utf8");

  assert.match(
    bookingSource,
    /els\.dirtyBar\.hidden = false;/,
    "The sticky dirty bar should stay visible even when there are no unsaved edits"
  );
  assert.match(
    bookingSource,
    /const isBusy = isSaving \|\| isDiscarding;[\s\S]*?els\.saveEditsBtn\.disabled = isBusy \|\| !isDirty;[\s\S]*?els\.discardEditsBtn\.disabled = isBusy \|\| !isDirty;/,
    "Both dirty-bar buttons should be disabled while the page is clean or busy"
  );
  assert.match(
    bookingSource,
    /backendT\("booking\.page_save\.saving", "Saving edits\.\.\."\)[\s\S]*backendT\("booking\.page_discard\.running", "Discarding edits\.\.\."\)[\s\S]*backendT\("booking\.page_save\.saved", "All edits saved"\)[\s\S]*backendT\("booking\.page_discard\.saved", "All edits reverted"\)/,
    "The dirty bar should expose explicit save and discard progress and completion text"
  );
  assert.match(
    bookingSource,
    /els\.dirtyBarSummary\.textContent = isDirty[\s\S]*\?\s*backendT\("booking\.page_save\.summary", "Changed sections: \{sections\}", \{ sections: labels\.join\(", "\) \}\)[\s\S]*:\s*"";/,
    "The clean dirty-bar state should not repeat the title text in the summary line"
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
    "booking_confirmation_panel",
    "pricing_panel",
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

test("payments uses pricing_panel as the standalone collapsible section", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingPageSource = await readFile(bookingPagePath, "utf8");

  assert.match(
    bookingPageSource,
    /<section id="pricing_panel" class="booking-section">/,
    "Payments should use pricing_panel itself as the collapsible section wrapper"
  );
  assert.doesNotMatch(
    bookingPageSource,
    /id="payments_workspace"|id="payments_workspace_summary"|id="payments_workspace_title"/,
    "The redundant payments workspace wrapper and heading should be removed"
  );
});

test("payments removes the standalone invoice panel and renders request/confirmation PDF subsections per milestone", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const pricingScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "pricing.js");
  const [bookingPageSource, pricingScriptSource] = await Promise.all([
    readFile(bookingPagePath, "utf8"),
    readFile(pricingScriptPath, "utf8")
  ]);

  assert.doesNotMatch(
    bookingPageSource,
    /id="invoice_panel"/,
    "The old standalone invoice editor should be removed from the Payments section"
  );
  assert.match(
    pricingScriptSource,
    /function paymentRequestSectionMarkup[\s\S]*booking-payment-document--request[\s\S]*PAYMENT_DOCUMENT_KIND_REQUEST/,
    "The pricing module should render a dedicated payment-request subsection for each non-deposit milestone"
  );
  assert.match(
    pricingScriptSource,
    /function paymentConfirmationSectionMarkup[\s\S]*booking-payment-document--confirmation[\s\S]*data-payment-record-received[\s\S]*PAYMENT_DOCUMENT_KIND_CONFIRMATION/,
    "The pricing module should render a dedicated payment-confirmation subsection with receipt logic for each non-deposit milestone"
  );
});

test("booking page replaces the stage dropdown with a derived status block and milestone actions", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingCorePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "core.js");
  const bookingPageSource = await readFile(bookingPagePath, "utf8");
  const bookingCoreSource = await readFile(bookingCorePath, "utf8");

  assert.doesNotMatch(
    bookingPageSource,
    /id="booking_stage_select"/,
    "Booking page should no longer expose a manual stage dropdown"
  );
  assert.match(
    bookingPageSource,
    /id="booking_milestone_actions"[\s\S]*id="booking_last_action_detail"/,
    "Booking page should render milestone action buttons and a last-action line in place of the old stage select"
  );
  assert.doesNotMatch(
    bookingPageSource,
    /id="booking_status_summary"|data-i18n-id="booking\.status_label"/,
    "Booking page should no longer render the old booking-status title or summary block"
  );
  assert.doesNotMatch(
    bookingCoreSource,
    /bookingStageRequest|stageSelect/,
    "Booking core should no longer save a manual stage selection from the booking page"
  );
  assert.match(
    bookingCoreSource,
    /function recordBookingMilestoneAction\(actionKey\) \{[\s\S]*ensureCoreDraft\(\)\.milestone_action_key = normalizedAction;[\s\S]*updateCoreDirtyState\(\);[\s\S]*renderActionControls\(\);/,
    "Booking core should treat milestone changes as local draft edits until page save"
  );
  assert.match(
    bookingCoreSource,
    /async function saveCoreEdits\(\) \{[\s\S]*bookingCustomerLanguageRequest[\s\S]*bookingMilestoneActionRequest/,
    "Booking core should persist both customer-language and milestone draft changes through the page save flow"
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
  const bookingStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking.css");
  const bookingStyles = await readFile(bookingStylesPath, "utf8");
  assert.match(
    bookingStyles,
    /\.booking-milestone-actions__btn--current \{\s*[\s\S]*border-color: var\(--success-line\);[\s\S]*background: var\(--success-surface-alpha\);[\s\S]*color: var\(--success-text-strong\);/,
    "The active booking milestone button should use the shared success-green styling"
  );
});

test("booking page records deposit receipt from the payments section instead of a top milestone action", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingCorePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "core.js");
  const pricingModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "pricing.js");
  const bookingPageSource = await readFile(bookingPagePath, "utf8");
  const bookingCoreSource = await readFile(bookingCorePath, "utf8");
  const pricingSource = await readFile(pricingModulePath, "utf8");

  assert.match(
    bookingPageSource,
    /id="pricing_deposit_controls"[\s\S]*id="pricing_deposit_received_at_input"[\s\S]*id="pricing_deposit_confirmed_by_select"[\s\S]*id="pricing_deposit_reference_input"/,
    "Payments section should expose dedicated deposit receipt inputs"
  );
  assert.match(
    bookingCoreSource,
    /actions: \["NEW_BOOKING", "TRAVEL_PLAN_SENT", "OFFER_SENT", "NEGOTIATION_STARTED", "DEPOSIT_REQUEST_SENT"\][\s\S]*actions: \["IN_PROGRESS", "TRIP_COMPLETED"\][\s\S]*actions: \["BOOKING_LOST"\]/,
    "Top milestone controls should no longer render a Deposit received action"
  );
  assert.doesNotMatch(
    bookingCoreSource,
    /actions: \[[^\]]*DEPOSIT_RECEIVED[^\]]*\]/,
    "Deposit received should stay out of the visible top milestone rows"
  );
  assert.match(
    pricingSource,
    /function collectDepositReceiptPayload\(\) \{[\s\S]*deposit_received_at[\s\S]*deposit_confirmed_by_atp_staff_id[\s\S]*deposit_reference[\s\S]*\}/,
    "Pricing module should collect deposit receipt details from the payments section"
  );
  assert.match(
    pricingSource,
    /async function savePricing\(\) \{[\s\S]*collectDepositReceiptPayload\(\)[\s\S]*deposit_receipt: depositReceipt/,
    "Pricing save should persist deposit receipt details through the pricing endpoint"
  );
});

test("payments overview groups fully paid milestones into a single collapsible block", async () => {
  const pricingModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "pricing.js");
  const bookingCssPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking.css");
  const pricingSource = await readFile(pricingModulePath, "utf8");
  const bookingCssSource = await readFile(bookingCssPath, "utf8");

  assert.match(
    pricingSource,
    /class="booking-collapsible booking-flow-paid-group"[\s\S]*data-payments-paid-summary[\s\S]*bookingT\("booking\.pricing\.summary_fully_paid", "Fully paid"\)/,
    "Pricing overview should render fully paid milestones inside one collapsible paid-payments group"
  );
  assert.match(
    bookingCssSource,
    /\.booking-detail-page \.booking-flow-paid-group[\s\S]*\.booking-detail-page \.booking-flow-paid-group__items/,
    "Payments stylesheet should style the grouped fully paid collapsible block"
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
  const travelPlanScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
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
  const modelPath = path.resolve(__dirname, "..", "..", "..", "model", "entities", "travel_plan.cue");
  const travelPlanScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
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
  const travelPlanScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
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
  const travelPlanScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
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
    /travel-plan-footer__action-rows[\s\S]*data-travel-plan-add-day[\s\S]*els\.travel_plan_pdf_workspace[\s\S]*travel-plan-footer__workspace[\s\S]*travel-plan-footer__preview[\s\S]*data-travel-plan-preview-pdf[\s\S]*travel-plan-footer__content[\s\S]*travel-plan-footer__existing-pdfs[\s\S]*data-travel-plan-create-pdf[\s\S]*travel-plan-footer__attachments/,
    "The travel-plan UI should keep day actions in the footer while rendering preview, existing PDFs, create action, and attachments inside the dedicated Travel plan PDF workspace"
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
  const travelPlanScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
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
  const travelPlanScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
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
  const bookingModelPath = path.resolve(__dirname, "..", "..", "..", "model", "entities", "booking.cue");
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
    /--travelplan_day_surface:\s*rgb\(182,\s*208,\s*233\);[\s\S]*#travel_plan_pdf_panel \.booking-section__head \{[\s\S]*background: var\(--travelplan_day_surface\);[\s\S]*#travel_plan_pdf_panel \.booking-collapsible\[data-booking-pdf-panel\] \{[\s\S]*background: var\(--travelplan_day_surface\);[\s\S]*#travel_plan_pdf_panel \.booking-collapsible\[data-booking-pdf-panel\] \.booking-collapsible__head,[\s\S]*#travel_plan_pdf_panel \.booking-collapsible\[data-booking-pdf-panel\] \.booking-collapsible__summary,[\s\S]*#travel_plan_pdf_panel \.booking-collapsible\[data-booking-pdf-panel\] \.booking-collapsible__body \{[\s\S]*background: var\(--travelplan_day_surface\);[\s\S]*#travel_plan_pdf_panel \.booking-collapsible\[data-booking-pdf-panel\] \.booking-collapsible__summary \{[\s\S]*color: var\(--text-black\);[\s\S]*font-weight: var\(--font-weight-bold\);[\s\S]*#travel_plan_pdf_panel \.booking-collapsible\[data-booking-pdf-panel\] \.booking-collapsible__summary::after \{[\s\S]*color: var\(--text-black\);/,
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
  const bookingModelPath = path.resolve(__dirname, "..", "..", "..", "model", "entities", "booking.cue");
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
  assert.match(
    bookingPageSource,
    /id="offer_pdf_personalization_panel"[\s\S]*id="generated_offers_overview"/,
    "booking.html should keep a dedicated Offer personalization container before the generated offers overview"
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
    /const renderToggle = \(mount, scope, config\) => \{[\s\S]*data-booking-pdf-toggle="\$\{scope\}\.\$\{config\.field\}"/,
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
    /draft\.pdf_personalization = Object\.fromEntries\([\s\S]*BOOKING_PDF_PERSONALIZATION_PANELS\.map/,
    "booking core should persist localized Offer fields through the shared panel config"
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

test("booking confirmation PDF personalization lives inside the Deposit payment article and drives booking confirmation PDFs", async () => {
  const bookingModelPath = path.resolve(__dirname, "..", "..", "..", "model", "entities", "booking.cue");
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const bookingPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const bookingCorePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "core.js");
  const pdfPanelModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "pdf_personalization_panel.js");
  const bookingPdfPersonalizationPath = path.resolve(__dirname, "..", "src", "lib", "booking_pdf_personalization.js");
  const bookingConfirmationPdfPath = path.resolve(__dirname, "..", "src", "lib", "booking_confirmation_pdf.js");
  const [
    bookingModelSource,
    bookingPageSource,
    bookingPageScriptSource,
    bookingCoreSource,
    pdfPanelModuleSource,
    personalizationSource,
    bookingConfirmationPdfSource
  ] = await Promise.all([
    readFile(bookingModelPath, "utf8"),
    readFile(bookingPagePath, "utf8"),
    readFile(bookingPageScriptPath, "utf8"),
    readFile(bookingCorePath, "utf8"),
    readFile(pdfPanelModulePath, "utf8"),
    readFile(bookingPdfPersonalizationPath, "utf8"),
    readFile(bookingConfirmationPdfPath, "utf8")
  ]);

  assert.match(
    bookingModelSource,
    /booking_confirmation\?:\s+#BookingPdfPersonalizationScoped/,
    "Booking PDF personalization should model a dedicated booking-confirmation scope"
  );
  assert.match(
    bookingPageSource,
    /id="payment_deposit_section"[\s\S]*id="payments_booking_confirmation_card"[\s\S]*id="booking_confirmation_pdfs_table"[\s\S]*id="booking_confirmation_pdf_personalization_panel"[\s\S]*id="create_booking_confirmation_btn"/,
    "The Deposit payment article should group the deposit logic, confirmation PDFs, personalization panel, and create action"
  );
  assert.match(
    bookingPageScriptSource,
    /bookingConfirmationPdfPersonalizationPanel[\s\S]*renderBookingPdfPersonalizationPanels\(els\)[\s\S]*resolveBookingPdfPersonalizationElements\(document\)/,
    "booking page script should render and resolve the reusable booking-confirmation PDF personalization panel"
  );
  assert.match(
    bookingPageScriptSource,
    /\[els\.travelPlanPdfPersonalizationPanel, els\.offerPdfPersonalizationPanel, els\.bookingConfirmationPdfPersonalizationPanel\]/,
    "booking page script should wire core dirty tracking to the booking-confirmation PDF personalization panel"
  );
  assert.match(
    pdfPanelModuleSource,
    /scope:\s*"booking_confirmation"[\s\S]*field:\s*"subtitle"[\s\S]*field:\s*"welcome"[\s\S]*field:\s*"closing"/,
    "The reusable PDF personalization panel config should define booking-confirmation subtitle, welcome, and closing fields"
  );
  assert.match(
    bookingCoreSource,
    /booking_confirmation:\s*\{\s*subtitle:\s*bookingConfirmationSubtitle\.text[\s\S]*include_closing:\s*resolvePdfTextFieldEnabled\(bookingConfirmation, "booking_confirmation", "closing", bookingConfirmationClosing\)/,
    "booking core should normalize the booking-confirmation personalization branch"
  );
  assert.match(
    personalizationSource,
    /PDF_TEXT_FIELD_CONFIG[\s\S]*booking_confirmation:\s*Object\.freeze\(\{[\s\S]*welcome:\s*Object\.freeze\(\{[\s\S]*closing:\s*Object\.freeze\(\{[\s\S]*normalizeBookingPdfPersonalization[\s\S]*PDF_PERSONALIZATION_SCOPES/,
    "backend PDF personalization should preserve the booking-confirmation personalization branch"
  );
  assert.match(
    bookingConfirmationPdfSource,
    /resolveBookingConfirmationSubtitleText[\s\S]*resolveBookingConfirmationWelcomeText[\s\S]*resolveBookingConfirmationClosingText[\s\S]*const subtitleText = resolveBookingConfirmationSubtitleText[\s\S]*const welcomeText = resolveBookingConfirmationWelcomeText[\s\S]*const closingText = resolveBookingConfirmationClosingText/,
    "booking_confirmation_pdf.js should resolve booking-confirmation subtitle, welcome, and closing text from the personalization scope"
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
    "offer.payment_terms_title"
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
});

test("staging PDF font stack includes Japanese and Chinese smoke coverage paths", async () => {
  const dockerfilePath = path.resolve(__dirname, "..", "..", "..", "backend", "Dockerfile.staging");
  const resolverPath = path.resolve(__dirname, "..", "src", "lib", "pdf_font_resolver.js");
  const offerPdfPath = path.resolve(__dirname, "..", "src", "lib", "offer_pdf.js");
  const travelPlanPdfPath = path.resolve(__dirname, "..", "src", "lib", "travel_plan_pdf.js");
  const invoicePdfPath = path.resolve(__dirname, "..", "src", "lib", "invoice_pdf.js");
  const [dockerfileSource, resolverSource, offerPdfSource, travelPlanPdfSource, invoicePdfSource] = await Promise.all([
    readFile(dockerfilePath, "utf8"),
    readFile(resolverPath, "utf8"),
    readFile(offerPdfPath, "utf8"),
    readFile(travelPlanPdfPath, "utf8"),
    readFile(invoicePdfPath, "utf8")
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
    [invoicePdfSource, "Invoice PDFs"]
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

test("invoice PDFs can read shared company bank details from runtime config", async () => {
  const runtimeConfigPath = path.resolve(__dirname, "..", "src", "config", "runtime.js");
  const invoicePdfPath = path.resolve(__dirname, "..", "src", "lib", "invoice_pdf.js");
  const [runtimeConfigSource, invoicePdfSource] = await Promise.all([
    readFile(runtimeConfigPath, "utf8"),
    readFile(invoicePdfPath, "utf8")
  ]);

  assert.match(
    runtimeConfigSource,
    /COMPANY_PROFILE = Object\.freeze\(\{[\s\S]*bankDetails:\s*Object\.freeze\(\{[\s\S]*accountHolder:[\s\S]*bankName:[\s\S]*accountNumber:[\s\S]*branch:[\s\S]*swiftCode:/,
    "Runtime config should expose a shared company bank-details block for invoice rendering"
  );
  assert.match(
    invoicePdfSource,
    /function companyProfileHeaderLines\(companyProfile\) \{[\s\S]*companyProfile\.bankDetails[\s\S]*Account holder:[\s\S]*Account number:[\s\S]*SWIFT:/,
    "Invoice PDF generation should render company bank details from the shared runtime company profile"
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
  const travelPlanModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
  const [bookingSource, travelPlanSource] = await Promise.all([
    readFile(bookingPageScriptPath, "utf8"),
    readFile(travelPlanModulePath, "utf8")
  ]);

  assert.match(
    bookingSource,
    /async function savePageEdits\(\)\s*\{[\s\S]*?saveCoreEdits\(\)[\s\S]*?saveNoteEdits\(\)[\s\S]*?personsModule\.saveAllPersonDrafts\(\)[\s\S]*?saveOffer\(\)[\s\S]*?travelPlanModule\.saveTravelPlan\(\)[\s\S]*?savePricing\(\)[\s\S]*?createInvoice\(\)[\s\S]*?state\.pendingSavedCustomerLanguage[\s\S]*?loadBookingPage\(\)/,
    "Page save should orchestrate the existing booking section endpoints in order"
  );
  assert.match(
    travelPlanSource,
    /async function persistTravelPlan\(\)\s*\{[\s\S]*?if \(!state\.travelPlanDirty\) \{[\s\S]*?syncTravelPlanDraftFromDom\(\);[\s\S]*?updateTravelPlanDirtyState\(\);[\s\S]*?if \(!state\.travelPlanDirty\) \{[\s\S]*?return true;/,
    "Travel-plan persistence should resync dirty state from the DOM and treat a clean result as a no-op instead of blocking page save"
  );
});

test("booking page derives ATP staff source language from the top-right backend language", async () => {
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
    "booking.html should no longer render a separate editing-language field once the top-right ATP staff language owns that choice"
  );
  assert.match(
    i18nSource,
    /export function bookingSourceLang\(fallback = DEFAULT_BOOKING_SOURCE_LANG\) \{[\s\S]*window\.backendI18n\?\.getLang/,
    "Booking i18n helpers should derive the ATP staff source language from the active backend language selector"
  );
  assert.match(
    bookingPageDataSource,
    /fetchApi\(withBookingContentLang\(bookingDetailRequest\(\{[\s\S]*applyBookingPayload\(bookingPayload,\s*\{\s*forceDraftReset:\s*true\s*\}\);/,
    "Booking page loads should request booking detail with booking language query semantics and apply that payload directly"
  );
  assert.doesNotMatch(
    bookingPageDataSource,
    /syncBookingEditingLanguageToSelectedStaffLanguage|bookingSourceLanguageRequest/,
    "Booking page load should not mutate persisted booking state just to mirror the current ATP staff source language"
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
  const travelPlanModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
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
    "Travel-plan normalization should derive its source language from the selected ATP staff language in the top-right selector"
  );
  assert.match(
    travelPlanHelpersSource,
    /export function normalizeTravelPlanDraft\(plan, options = \{\}\) \{[\s\S]*const sourceLang = normalizeBookingSourceLang\([\s\S]*bookingSourceLang\("en"\)[\s\S]*resolveLocalizedEditorText\(rawDay\.title_i18n \?\? rawDay\.title, sourceLang, ""\)/,
    "Travel-plan helper normalization should accept an explicit source language and otherwise fall back to the selected ATP staff language"
  );
});

test("generated offer actions are gated behind a clean page state", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const offersModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offer_generated_offers.js");
  const pricingModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "pricing.js");
  const bookingSource = await readFile(bookingPagePath, "utf8");
  const offersSource = await readFile(offersModulePath, "utf8");
  const pricingSource = await readFile(pricingModulePath, "utf8");

  assert.match(
    bookingSource,
    /id="generate_offer_btn"[^>]*data-requires-clean-state/,
    "The new-offer button should be disabled until pending page edits are saved or discarded"
  );
  assert.match(
    offersSource,
    /data-generated-offer-save-comment="[^"]+"[^>]*data-requires-clean-state[\s\S]*data-generated-offer-delete="[^"]+"[^>]*data-requires-clean-state/,
    "Generated-offer comment save and delete controls should be disabled while the page is dirty"
  );
  assert.match(
    offersSource,
    /ensureOfferCleanState/,
    "Generated-offer actions should call the explicit clean-state guard before mutating generated offers"
  );
  assert.match(
    offersSource,
    /customer_confirmation_flow/,
    "Generated-offer creation should use the renamed customer confirmation flow field"
  );
  assert.match(
    bookingSource,
    /id="pricing_management_approval_btn"/,
    "The Payments section should expose the dedicated management approval action next to the deposit receipt action"
  );
  assert.match(
    pricingSource,
    /confirm_as_management:\s*true/,
    "Management confirmation should be triggered from the Payments module"
  );
  assert.doesNotMatch(
    offersSource,
    /generated-offers-col-route|data-generated-offer-copy-link|data-generated-offer-email-draft|data-generated-offer-confirm-management/,
    "The generated-offers table should no longer render the Route column or its related management and link actions"
  );
  assert.doesNotMatch(
    offersSource,
    /window\.prompt\(bookingT\("booking\.offer\.comment_prompt"/,
    "Generating a new offer should no longer interrupt ATP staff with a comment prompt popup"
  );
});

test("persons and travel plan editors no longer autosave from local interactions while service image changes use clean-state mutations", async () => {
  const personsModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "persons.js");
  const travelPlanModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
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
    /bookingTravelPlanServiceImageDeleteRequest[\s\S]*function removeTravelPlanServiceImage\(dayId, itemId, imageId\)\s*\{[\s\S]*ensureTravelPlanReadyForMutation\(\)[\s\S]*bookingTravelPlanServiceImageDeleteRequest\([\s\S]*applyTravelPlanMutationBooking\(result\.booking,\s*\{\s*preserveCollapsedState:\s*true\s*\}\)[\s\S]*loadActivities\(\)/,
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

test("generated offer email action is gated by the booking capability flag", async () => {
  const offersModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offer_generated_offers.js");
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

test("booking stage catalogs no longer expose the legacy Won stage", async () => {
  const modelPath = path.resolve(__dirname, "..", "..", "..", "model", "enums", "booking_stage.cue");
  const runtimePath = path.resolve(__dirname, "..", "src", "config", "runtime.js");
  const openApiPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "openapi.yaml");
  const mobileMetaPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "mobile-api.meta.json");
  const generatedBookingPath = path.resolve(__dirname, "..", "..", "..", "shared", "generated-contract", "Models", "generated_Booking.js");
  const generatedSchemaRuntimePath = path.resolve(__dirname, "..", "..", "..", "shared", "generated-contract", "Models", "generated_SchemaRuntime.js");
  const enI18nPath = path.resolve(__dirname, "..", "..", "..", "frontend", "data", "i18n", "backend", "en.json");
  const viI18nPath = path.resolve(__dirname, "..", "..", "..", "frontend", "data", "i18n", "backend", "vi.json");

  const [
    modelSource,
    runtimeSource,
    openApiSource,
    mobileMetaSource,
    generatedBookingSource,
    generatedSchemaRuntimeSource,
    enI18nSource,
    viI18nSource
  ] = await Promise.all([
    readFile(modelPath, "utf8"),
    readFile(runtimePath, "utf8"),
    readFile(openApiPath, "utf8"),
    readFile(mobileMetaPath, "utf8"),
    readFile(generatedBookingPath, "utf8"),
    readFile(generatedSchemaRuntimePath, "utf8"),
    readFile(enI18nPath, "utf8"),
    readFile(viI18nPath, "utf8")
  ]);

  assert.doesNotMatch(modelSource, /"WON"/, "The booking stage model should not include Won");
  assert.doesNotMatch(runtimeSource, /\[STAGES\.WON\]/, "Runtime SLA mapping should not include Won");
  assert.doesNotMatch(openApiSource, /\bWON\b/, "Generated OpenAPI should not include Won");
  assert.doesNotMatch(mobileMetaSource, /"code": "WON"/, "Mobile bootstrap metadata should not include Won");
  assert.doesNotMatch(generatedBookingSource, /"WON"/, "Generated booking stage list should not include Won");
  assert.doesNotMatch(generatedSchemaRuntimeSource, /"WON"/, "Generated schema runtime should not include Won");
  assert.doesNotMatch(enI18nSource, /"booking\.stage\.won"/, "English backend i18n should not expose Won");
  assert.doesNotMatch(viI18nSource, /"booking\.stage\.won"/, "Vietnamese backend i18n should not expose Won");
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
  const travelPlanModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
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
  const travelPlanModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
  const travelPlanHelpersPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_helpers.js");
  const generatedCatalogsPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "generated_catalogs.js");
  const source = await readFile(travelPlanModulePath, "utf8");
  const helperSource = await readFile(travelPlanHelpersPath, "utf8");
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
    /function renderTravelPlanLocalizedField\(\{[\s\S]*sourceValue = ""[\s\S]*renderLocalizedStackedField\(\{[\s\S]*sourceValue,/,
    "travel_plan.js should forward localized sourceValue into the shared localized field renderer"
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

test("travel-plan service image subtitle stays wired across model, API, backend, and UI", async () => {
  const modelPath = path.resolve(__dirname, "..", "..", "..", "model", "entities", "travel_plan.cue");
  const openApiPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "openapi.yaml");
  const backendPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "domain", "travel_plan.js");
  const helperPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_helpers.js");
  const uiPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
  const [modelSource, openApiSource, backendSource, helperSource, uiSource] = await Promise.all([
    readFile(modelPath, "utf8"),
    readFile(openApiPath, "utf8"),
    readFile(backendPath, "utf8"),
    readFile(helperPath, "utf8"),
    readFile(uiPath, "utf8")
  ]);

  assert.match(
    modelSource,
    /image_subtitle\?:\s+string/,
    "The travel-plan service model should expose an optional image subtitle field"
  );
  assert.match(
    openApiSource,
    /image_subtitle:\n\s+type: string\n\s+nullable: true/,
    "The OpenAPI contract should expose the optional travel-plan service image subtitle"
  );
  assert.match(
    backendSource,
    /image_subtitle: normalizeOptionalText\(rawItem\.image_subtitle\) \|\| null/,
    "The backend travel-plan normalizer should persist the service image subtitle"
  );
  assert.match(
    helperSource,
    /image_subtitle: ""[\s\S]*image_subtitle: normalizeOptionalText\(rawItem\.image_subtitle\)/,
    "The frontend travel-plan helpers should seed and normalize the service image subtitle"
  );
  assert.match(
    uiSource,
    /data-travel-plan-service-field="image_subtitle"[\s\S]*item\.image_subtitle = String\(itemNode\.querySelector\('\[data-travel-plan-service-field="image_subtitle"\]'\)\?\.value \|\| ""\)\.trim\(\);/,
    "The travel-plan editor should render and save the service image subtitle field"
  );
});

test("travel-plan day date presets stay wired across model, API, backend, and UI", async () => {
  const modelPath = path.resolve(__dirname, "..", "..", "..", "model", "entities", "travel_plan.cue");
  const openApiPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "openapi.yaml");
  const backendPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "domain", "travel_plan.js");
  const helperPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_helpers.js");
  const uiPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
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
    /const renderToggle = \(mount, scope, config\) => \{[\s\S]*data-booking-pdf-toggle="\$\{scope\}\.\$\{config\.field\}"/,
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
  const tourPageHtmlPath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "marketing_tour.html");
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
    /id="tour_localized_content_editor"/,
    "Tour page should render the combined localized title and description editor mount"
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
  assert.match(
    tourSource,
    /els\.imageUpload\.addEventListener\("change", \(\) => \{[\s\S]*setPendingHeroImagePreview\(file\);[\s\S]*renderHeroImage\(\);[\s\S]*tour\.status\.selected_image/,
    "Tour page should preview a newly selected hero image immediately before save"
  );
  assert.match(
    tourSource,
    /function setPendingHeroImagePreview\(file\) \{[\s\S]*URL\.createObjectURL\(file\)/,
    "Tour page should stage a temporary object URL for the selected hero image"
  );
});

test("tour read models version public image URLs so immutable caching still refreshes after uploads", async () => {
  const toursSupportPath = path.resolve(__dirname, "..", "src", "domain", "tours_support.js");
  const toursHandlerPath = path.resolve(__dirname, "..", "src", "http", "handlers", "tours.js");
  const [toursSupportSource, toursHandlerSource] = await Promise.all([
    readFile(toursSupportPath, "utf8"),
    readFile(toursHandlerPath, "utf8")
  ]);

  assert.match(
    toursHandlerSource,
    /sendFileWithCache\(req, res, absolutePath, "public, max-age=31536000, immutable"\)/,
    "Public tour images should keep the long-lived immutable cache headers"
  );
  assert.match(
    toursSupportSource,
    /function withAssetVersion\(value, version\) \{[\s\S]*searchParams\.set\("v", normalizedVersion\)/,
    "Tour support should append a version query parameter for cache busting"
  );
  assert.match(
    toursSupportSource,
    /image:\s*withAssetVersion\([\s\S]*toTourImagePublicUrl\(stored\.image\)[\s\S]*stored\.updated_at \|\| stored\.created_at/,
    "Tour read models should version returned image URLs with the tour update timestamp"
  );
});

test("tour page uses the active backend language as the localized editor source", async () => {
  const tourPageModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tour.js");
  const backendEnI18nPath = path.resolve(__dirname, "..", "..", "..", "frontend", "data", "i18n", "backend", "en.json");
  const backendViI18nPath = path.resolve(__dirname, "..", "..", "..", "frontend", "data", "i18n", "backend", "vi.json");
  const [tourSource, backendEnI18n, backendViI18n] = await Promise.all([
    readFile(tourPageModulePath, "utf8"),
    readFile(backendEnI18nPath, "utf8"),
    readFile(backendViI18nPath, "utf8")
  ]);

  assert.match(
    tourSource,
    /function currentTourEditingLang\(\)\s*\{[\s\S]*currentBackendLang\(\)/,
    "Tour page should derive its editing source from the current backend language selector"
  );
  assert.match(
    tourSource,
    /const sourceLang = currentTourEditingLang\(\);[\s\S]*source_lang: sourceLang/,
    "Tour field translation requests should send the active backend language as the source language"
  );
  assert.doesNotMatch(
    tourSource,
    /source_lang:\s*"en"/,
    "Tour field translation requests must not hard-code English as the source language"
  );
  assert.match(
    tourSource,
    /orderedTourTextLanguages\(\)\.map\([\s\S]*tour\.translation\.translate_one/,
    "Tour localized editors should rebuild their translation buttons from the active editing language"
  );
  assert.match(
    tourSource,
    /const secondaryLang = editingLang === "vi" \? "en" : "vi";[\s\S]*tourLanguageShortLabel\(left\?\.code\)\.localeCompare/,
    "Tour localized editors should place the EN\/VI pair first and sort the remaining languages alphabetically"
  );
  assert.match(
    backendEnI18n,
    /"tour\.translation\.translate_one": "\{source\} → \{target\}"/,
    "English backend strings should provide the dynamic tour translation button label"
  );
  assert.match(
    backendViI18n,
    /"tour\.translation\.translate_one": "\{source\} → \{target\}"/,
    "Vietnamese backend strings should provide the dynamic tour translation button label"
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

test("settings page staff table shows separate realm and client Keycloak roles", async () => {
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
    /<th class="backend-table-align-right">\$\{escapeHtml\(backendT\("backend\.table\.active", "Active"\)\)\}<\/th>/,
    "Settings user table should include an Active header column"
  );
  assert.match(
    source,
    /formatKeycloakRoleList\(getDisplayedKeycloakRoles\(user\)\)/,
    "Settings user table should display the combined realm and client roles in the Roles column"
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
  assert.match(
    html,
    /id="staffEditorPanel"/,
    "Settings page should expose the ATP staff editor panel"
  );
  assert.match(
    html,
    /id="staffEditorFullName"[\s\S]*id="staffEditorFriendlyShortName"[\s\S]*id="staffEditorTeamOrder"/,
    "Settings page should expose editable ATP staff full-name, friendly-short-name, and team-order fields"
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
    /full_name:\s*normalizeText\(state\.editor\?\.fullName\)[\s\S]*friendly_short_name:\s*normalizeText\(state\.editor\?\.friendlyShortName\)[\s\S]*team_order:\s*teamOrder\.isSet \? teamOrder\.value : null/,
    "Settings page should send the ATP staff full-name, friendly-short-name, and team-order fields when saving the profile"
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
    /export function resolveAtpStaffFullName\(profile\)[\s\S]*profile\?\.full_name/,
    "ATP staff PDF helpers should read the dedicated staff-profile full name"
  );
  assert.doesNotMatch(
    atpStaffPdfSource,
    /resolveAtpStaffFullName\(profile\)[\s\S]*profile\?\.name|resolveAtpStaffFriendlyShortName\(profile\)[\s\S]*profile\?\.name/,
    "ATP staff PDF helpers should not fall back to the raw Keycloak name in the PDFs"
  );
  assert.match(
    offerPdfSource,
    /resolveAtpStaffFullName[\s\S]*resolveAtpGuideIntroName/,
    "Offer PDFs should use the ATP staff full name in the title and the friendly short name through the guide intro helper"
  );
  assert.match(
    travelPlanPdfSource,
    /resolveAtpStaffFullName[\s\S]*resolveAtpGuideIntroName/,
    "Travel-plan PDFs should use the ATP staff full name in the title and the friendly short name through the guide intro helper"
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
    /#BookingTravelPlanTranslateRequest:\s*\{[\s\S]*source_lang:\s+enums\.\#LanguageCode[\s\S]*target_lang:\s+enums\.\#LanguageCode/,
    "The authored travel-plan translate request model should require source_lang and target_lang"
  );
  assert.match(
    normalizedIrSource,
    /name:\s+"BookingTravelPlanTranslateRequest"[\s\S]*\{name: "source_lang", kind: "enum", typeName: "LanguageCode", required: true\}[\s\S]*\{name: "target_lang", kind: "enum", typeName: "LanguageCode", required: true\}/,
    "The normalized API IR should keep source_lang and target_lang for travel-plan translation"
  );
  assert.match(
    openApiSource,
    /BookingTravelPlanTranslateRequest:[\s\S]*required:[\s\S]*- source_lang[\s\S]*- target_lang[\s\S]*properties:[\s\S]*source_lang:[\s\S]*target_lang:/,
    "The generated OpenAPI schema should require source_lang and target_lang for travel-plan translation"
  );
  const generatedSchemaBlock = generatedModelsSource.match(
    /export const BOOKING_TRAVEL_PLAN_TRANSLATE_REQUEST_SCHEMA = \{[\s\S]*?\n\s*\};/
  )?.[0] || "";
  assert.match(
    generatedSchemaBlock,
    /"name":"source_lang"[\s\S]*"name":"target_lang"/,
    "The shared runtime validator should accept source_lang and target_lang for travel-plan translation"
  );
  assert.equal(
    generatedSchemaBlock.includes('"name":"lang"'),
    false,
    "The shared runtime validator should not keep the legacy lang-only travel-plan translation schema"
  );
});

test("backend list pages have dedicated entrypoints and are served by caddy", async () => {
  const frontendRoot = path.resolve(__dirname, "..", "..", "..", "frontend");
  const deployRoot = path.resolve(__dirname, "..", "..", "..", "deploy");
  const bookingsHtml = await readFile(path.join(frontendRoot, "pages", "bookings.html"), "utf8");
  const marketingToursHtml = await readFile(path.join(frontendRoot, "pages", "marketing_tours.html"), "utf8");
  const standardTravelPlansHtml = await readFile(path.join(frontendRoot, "pages", "standard-travel-plans.html"), "utf8");
  const standardTravelPlanHtml = await readFile(path.join(frontendRoot, "pages", "standard-travel-plan.html"), "utf8");
  const settingsHtml = await readFile(path.join(frontendRoot, "pages", "settings.html"), "utf8");
  const emergencyHtml = await readFile(path.join(frontendRoot, "pages", "emergency.html"), "utf8");
  const localCaddy = await readFile(path.join(deployRoot, "Caddyfile.local"), "utf8");
  const stagingCaddy = await readFile(path.join(deployRoot, "Caddyfile"), "utf8");

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
    standardTravelPlansHtml,
    /frontend\/scripts\/pages\/standard_travel_plans\.js/,
    "standard-travel-plans.html should mount the standard travel plans page script"
  );
  assert.match(
    standardTravelPlanHtml,
    /frontend\/scripts\/pages\/standard_travel_plan\.js/,
    "standard-travel-plan.html should mount the standard travel plan detail page script"
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

  for (const source of [localCaddy, stagingCaddy]) {
    assert.match(source, /\/bookings\.html/, "Caddy should serve bookings.html");
    assert.match(source, /\/backend\.html/, "Caddy should keep redirecting legacy backend.html");
    assert.match(source, /\/marketing_tours\.html/, "Caddy should serve marketing_tours.html");
    assert.match(source, /\/tours\.html/, "Caddy should keep redirecting legacy tours.html");
    assert.match(source, /\/marketing_tour\.html/, "Caddy should serve marketing_tour.html");
    assert.match(source, /\/tour\.html/, "Caddy should keep redirecting legacy tour.html");
    assert.match(source, /\/standard-travel-plans\.html/, "Caddy should serve standard-travel-plans.html");
    assert.match(source, /\/standard-travel-plan\.html/, "Caddy should serve standard-travel-plan.html");
    assert.match(source, /\/settings\.html/, "Caddy should serve settings.html");
    assert.match(source, /\/emergency\.html/, "Caddy should serve emergency.html");
  }
  assert.match(
    stagingCaddy,
    /import staging_html_no_cache_headers[\s\S]*import staging_static_cache_headers/,
    "Staging should scope no-cache headers to HTML entry pages while enabling short-lived caching for static assets"
  );
  assert.match(
    stagingCaddy,
    /@staging_static path \/assets\/\* \/frontend\/scripts\/\* \/frontend\/data\/\* \/frontend\/Generated\/\* \/shared\/\* \/site\.webmanifest/,
    "Staging should explicitly mark frontend scripts, dictionaries, generated bundles, shared bundles, and assets as cacheable static files"
  );
  assert.doesNotMatch(
    stagingCaddy,
    /staging\.asiatravelplan\.com \{[\s\S]*import staging_cache_headers/,
    "Staging should no longer apply a global no-store policy to every response"
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
    /async function init\(\)[\s\S]*scheduleDeferredAuthStatusLoad\(\)[\s\S]*scheduleDeferredTourImagePrewarm\(state\.trips\)/,
    "Homepage init should defer auth status loading and tour image prewarming instead of doing them on the first critical render"
  );
  assert.match(
    mainSource,
    /async function handleFrontendLanguageChanged\(\)[\s\S]*refreshLocalizedBookingFormOptions\(\)[\s\S]*loadTrips\(\)[\s\S]*populateFilterOptions\(\)[\s\S]*applyFilters\(\)/,
    "Homepage language refresh should reload localized tours and rerender filter-driven content without a full navigation"
  );
  assert.match(
    mainSource,
    /async function handleFrontendLanguageChanged\(\)[\s\S]*scheduleDeferredTourImagePrewarm\(state\.trips\)[\s\S]*renderFormStep\(\)/,
    "Homepage language refresh should requeue image prewarming after the localized tour list is refreshed"
  );
  assert.match(
    bookingFormOptionsSource,
    /function refreshLocalizedBookingFormOptions\(\)[\s\S]*populateGeneratedWebFormOptions\(\)[\s\S]*renderBudgetOptions\([\s\S]*populateTravelMonthSelects\(\)/,
    "Booking form option helpers should expose a localized refresh path for the in-place homepage language switch"
  );
  assert.match(
    mainToursSource,
    /const toursRequest = publicToursRequest\({[\s\S]*query: \{ lang: currentFrontendLang\(\) \}[\s\S]*const response = await fetch\(toursRequest\.url, \{ cache: "no-store" \}\);/,
    "Homepage tour loading should explicitly bypass browser caches so published destination changes show up immediately after reload"
  );
  assert.doesNotMatch(
    mainToursSource,
    /toursCacheKey|getCachedTours|setCachedTours|tripsRequestVersion/,
    "Homepage tour loading should no longer keep a localStorage-backed tours cache or a request-version cache buster"
  );
});

test("homepage tour cards clamp long descriptions and open the shared detail popup", async () => {
  const mainToursPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "main_tours.js");
  const homepagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "index.html");
  const siteCssPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "site.css");
  const [mainToursSource, homepageSource, siteCssSource] = await Promise.all([
    readFile(mainToursPath, "utf8"),
    readFile(homepagePath, "utf8"),
    readFile(siteCssPath, "utf8")
  ]);

  assert.match(
    homepageSource,
    /id="tourDescriptionDetail"/,
    "Homepage should expose a dedicated overlay mount for expanded tour descriptions"
  );
  assert.match(
    mainToursSource,
    /data-tour-desc-toggle[\s\S]*data-tour-desc-trip-id[\s\S]*syncTourDescriptionToggles\(\)/,
    "Tour cards should render a conditional more button for clamped descriptions"
  );
  assert.match(
    mainToursSource,
    /function renderTourDescriptionDetail\(\) \{[\s\S]*team-detail[\s\S]*team-detail__name[\s\S]*team-detail__body/,
    "Expanded tour descriptions should reuse the shared homepage detail popup shell"
  );
  assert.match(
    siteCssSource,
    /\.tour-desc \{[\s\S]*-webkit-line-clamp: 4;[\s\S]*min-height: calc\(1\.55em \* 4\);/,
    "Tour descriptions should clamp to a fixed-height preview so cards stay aligned"
  );
});

test("homepage hero title follows published destinations and only hides the destination picker when one destination remains", async () => {
  const mainToursPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "main_tours.js");
  const homepagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "index.html");
  const frontendEnI18nPath = path.resolve(__dirname, "..", "..", "..", "frontend", "data", "i18n", "frontend", "en.json");
  const siteCssPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "site.css");
  const [mainToursSource, homepageSource, frontendEnI18nSource, siteCssSource] = await Promise.all([
    readFile(mainToursPath, "utf8"),
    readFile(homepagePath, "utf8"),
    readFile(frontendEnI18nPath, "utf8"),
    readFile(siteCssPath, "utf8")
  ]);

  assert.match(
    homepageSource,
    /id="heroTitle"[\s\S]*id="navDestinationWrap" class="select-wrap" hidden/,
    "Homepage hero should expose a dedicated title mount and keep the destination dropdown hidden in the hero markup"
  );
  assert.match(
    frontendEnI18nSource,
    /"hero\.title_with_destinations": "Private holidays in \{destinations\}"/,
    "Frontend hero copy should expose a destination-aware title template"
  );
  assert.match(
    mainToursSource,
    /function formatLocalizedList\([\s\S]*new Intl\.ListFormat\([\s\S]*type: "conjunction"/,
    "Homepage hero titles should format the published destination labels as a locale-aware list"
  );
  assert.match(
    mainToursSource,
    /function updateHeroTitle\(\) \{[\s\S]*filterOptionList\("destination"\)\.map\(\(option\) => option\.label\)[\s\S]*frontendT\("hero\.title_with_destinations", "Private holidays in \{destinations\}"/,
    "Homepage hero title should derive its visible country list from the published destination options returned by the tours payload"
  );
  assert.match(
    mainToursSource,
    /function shouldShowHeroDestinationFilter\(destinations = filterOptionList\("destination"\)\) \{[\s\S]*return destinations\.length > 1;[\s\S]*function normalizeActiveFiltersFromOptions\(\) \{[\s\S]*state\.filters\.dest = shouldShowHeroDestinationFilter\(\)\s*\?[\s\S]*normalizeSelectionToCodes\(state\.filters\.dest, "destination", \{ allowUnknown: false \}\)[\s\S]*:\s*\[\];[\s\S]*state\.filters\.style = normalizeSelectionToCodes\(state\.filters\.style, "style", \{ allowUnknown: false \}\);/,
    "Homepage should only keep destination filters when the hero destination dropdown is actually visible"
  );
  assert.match(
    mainToursSource,
    /const destinationFilterWrap = els\.navDestinationWrap;[\s\S]*const showDestinationFilter = shouldShowHeroDestinationFilter\(destinations\);[\s\S]*destinationFilterWrap\.hidden = !showDestinationFilter;[\s\S]*els\.navDestinationPanel\.hidden = true;/,
    "Homepage filter rendering should hide the whole destination picker in the hero whenever only one published destination remains"
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
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "standard_travel_plans.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "standard_travel_plan.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "settings_list.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "emergency.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tour.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "nav.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "marketing_tours.html"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "standard-travel-plans.html"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "standard-travel-plan.html"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "settings.html"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "emergency.html")
  ];

  for (const filePath of filesToScan) {
    const source = await readFile(filePath, "utf8");
    assert.doesNotMatch(
      source,
      /backend\.html\?section=(tours|standard-travel-plans|settings|emergency)/,
      `${path.basename(filePath)} should not hard-code backend section query routes for tours/standard-travel-plans/settings/emergency`
    );
    assert.doesNotMatch(
      source,
      /withBackendLang\(\s*"\/(backend|bookings)\.html"\s*,\s*\{\s*section\s*:\s*"(tours|standard-travel-plans|settings|emergency)"/,
      `${path.basename(filePath)} should not build tours/standard-travel-plans/settings/emergency routes through the bookings entry page`
    );
  }
});

test("travel plan templates are wired through backend navigation, routes, and booking apply actions", async () => {
  const navPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "nav.js");
  const pagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "standard-travel-plans.html");
  const pageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "standard_travel_plans.js");
  const detailScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "standard_travel_plan.js");
  const bookingLibraryPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_service_library.js");
  const bookingTravelPlanPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
  const routesPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "http", "routes.js");
  const handlersPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "http", "handlers", "travel_plan_templates.js");
  const domainPath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "domain", "travel_plan_templates.js");
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

  assert.match(navSource, /standard-travel-plans\.html/, "Backend nav should link to the dedicated standard travel plans page");
  assert.match(navSource, /const canReadStandardTravelPlans = hasAnyRole\(resolvedRoles, "atp_tour_editor"\);/, "Backend nav should only show standard travel plans to atp_tour_editor users");
  assert.match(pageSource, /id="standardTravelPlansTable"/, "The standard travel plans page should expose the templates table");
  assert.match(pageScriptSource, /\/api\/v1\/travel-plan-templates/, "The standard travel plans page should load templates from the dedicated backend endpoint");
  assert.match(pageScriptSource, /const DESTINATION_COUNTRY_CODES = Object\.freeze\(\["VN", "TH", "KH", "LA"\]\)/, "The standard travel plans UI should limit destinations to the four supported country codes");
  assert.match(pageScriptSource, /expectedRolesAnyOf:\s*\[ROLES\.TOUR_EDITOR\]/, "The standard travel plans list page should require the atp_tour_editor role");
  assert.match(detailScriptSource, /expectedRolesAnyOf:\s*\[ROLES\.TOUR_EDITOR\]/, "The standard travel plan detail page should require the atp_tour_editor role");
  assert.match(bookingLibrarySource, /bookingTravelPlanTemplateApplyRequest/, "The booking travel-plan library should apply standard travel plans through the dedicated endpoint");
  assert.doesNotMatch(bookingLibrarySource, /status:\s*"published"/, "The booking travel-plan library should not filter standard travel plans by status");
  assert.match(bookingTravelPlanSource, /data-travel-plan-open-template-import/, "The booking travel-plan footer should expose a standard travel plan action");
  assert.match(routesSource, /\/api\/v1\/travel-plan-templates/, "HTTP routes should include the standard travel plan endpoints");
  assert.doesNotMatch(handlersSource, /Only published travel plan templates can be applied/, "Template apply handler should not enforce template status");
  assert.match(domainSource, /enumValueSetFor\("CountryCode"\)[\s\S]*normalizeText\(value\)\.toUpperCase\(\)[\s\S]*COUNTRY_CODE_SET\.has\(value\)/, "Template destination normalization should store CountryCode values instead of tour destination slugs");
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

test("staging backend bakes dependencies into the image and mounts only writable data roots", async () => {
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  const dockerfilePath = path.join(repoRoot, "backend", "Dockerfile.staging");
  const composePath = path.join(repoRoot, "docker-compose.staging.yml");
  const updateStagingPath = path.join(repoRoot, "scripts", "update_staging.sh");
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
    /- \.\/backend\/app\/data:\/srv\/backend\/app\/data[\s\S]*- \.\/content:\/srv\/content/,
    "Staging backend should mount only the writable backend data and content roots"
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
  const pricingModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "pricing.js");
  const financeHandlerPath = path.resolve(__dirname, "..", "src", "http", "handlers", "booking_finance.js");
  const pricingSource = await readFile(pricingModulePath, "utf8");
  const financeSource = await readFile(financeHandlerPath, "utf8");

  assert.doesNotMatch(pricingSource, /\[offer-exchange-debug\]/, "frontend offer exchange debug logs should be removed");
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
