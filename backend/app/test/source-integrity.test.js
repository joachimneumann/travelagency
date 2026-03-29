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
    "saveCoreEdits",
    "saveNoteEdits",
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
    /renderTravelerLanguageOptions\(traveler\.preferred_language\)[\s\S]*renderCountryOptions\(traveler\.nationality, "Select nationality"\)/,
    "Public traveler-details form should render dropdowns for preferred language and nationality"
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
    personsSource,
    /bookingPersonDocumentPictureRequest[\s\S]*\[\s*"passport",\s*"national_id"\s*\][\s\S]*data-document-picture-upload/,
    "Booking persons module should upload document images through the dedicated booking person document-picture endpoint"
  );
  assert.match(
    bookingStyles,
    /\.booking-person-modal__document-picture-preview \{[\s\S]*min-height: 180px;[\s\S]*border: 1px dashed var\(--line-cool-alpha\);/,
    "Booking person modal should style the document image preview area as a dedicated upload surface"
  );
});

test("booking page scrolls only inside the content region below the sticky control bar", async () => {
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
    /\.booking-detail-page \{\s*[\s\S]*overflow: hidden;[\s\S]*grid-template-rows: auto minmax\(0, 1fr\);/,
    "The booking page should lock the page layout to the viewport instead of scrolling the full document"
  );
  assert.match(
    bookingStyles,
    /\.booking-detail-page \.section > \.container \{\s*[\s\S]*grid-template-rows: auto auto auto minmax\(0, 1fr\);/,
    "The booking container should reserve dedicated rows above and below the sticky control bar"
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
    /\.booking-detail-page \.booking-detail-page__scroll \{\s*[\s\S]*overflow: auto;[\s\S]*-ms-overflow-style: none;[\s\S]*scrollbar-width: none;[\s\S]*padding: 0 0 2rem;/,
    "The booking content below the sticky bar should scroll inside its own region without showing a native scrollbar"
  );
  assert.match(
    bookingStyles,
    /\.booking-detail-page \.booking-detail-page__scroll::\-webkit\-scrollbar \{\s*[\s\S]*display: none;/,
    "The booking scroll region should hide WebKit scrollbars"
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
    /travel-plan-grid travel-plan-grid--item-kind[\s\S]*booking\.travel_plan\.kind_label[\s\S]*travel-plan-grid[\s\S]*booking\.travel_plan\.item_title[\s\S]*booking\.location/,
    "Service editing should still show kind first, with title and location below it"
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
    /\.travel-plan-grid--item-kind \{[\s\S]*grid-template-columns: minmax\(220px, 280px\);/,
    "Travel plan styles should keep the kind selector on its own row above title and location"
  );
});

test("accommodation services expose a day-count helper and create linked copy days", async () => {
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

  assert.match(
    modelSource,
    /accommodation_days\?:\s+>=1 & <=100 & int/,
    "The travel-plan item model should persist an optional accommodation day count"
  );
  assert.match(
    openApiSource,
    /BookingTravelPlanService:[\s\S]*accommodation_days:[\s\S]*type: integer[\s\S]*minimum: 1[\s\S]*maximum: 100/,
    "The generated OpenAPI schema should expose the accommodation day count on travel-plan items"
  );
  assert.match(
    generatedApiModelsSource,
    /schemaField\(\{"name":"accommodation_days","required":false,"wireName":"accommodation_days"\}, SHARED_FIELD_DEFS\.FIELD_17\)/,
    "The generated API models should include accommodation_days on BookingTravelPlanService"
  );
  assert.match(
    travelPlanHelpersSource,
    /function normalizeAccommodationDays\(value, kind\)[\s\S]*normalizeItemKind\(kind\) !== "accommodation"[\s\S]*return parsed >= 1 && parsed <= 100 \? parsed : null;/,
    "Travel-plan draft helpers should normalize the accommodation day count only for accommodation items"
  );
  assert.match(
    domainSource,
    /function normalizeAccommodationDays\(value, kind\)[\s\S]*normalizeItemKind\(kind\) !== "accommodation"[\s\S]*return parsed >= 1 && parsed <= 100 \? parsed : null;/,
    "Backend travel-plan normalization should persist the accommodation day count with the same range"
  );
  assert.match(
    validationSource,
    /code:\s*"accommodation_days_invalid"[\s\S]*Accommodation days must be between 1 and 100\./,
    "Travel-plan validation should reject invalid accommodation day counts with structured metadata"
  );
  assert.match(
    travelPlanSource,
    /function canCreateAccommodationDays\(item\)[\s\S]*normalizeAccommodationDays\(item\?\.accommodation_days\)[\s\S]*> 1/,
    "Accommodation travel-plan items should derive Create days enablement from the day count"
  );
  assert.match(
    travelPlanSource,
    /function syncAccommodationCreateDaysButtonStates\(\)[\s\S]*createDaysButton\.disabled = !isEnabled;/,
    "Travel-plan editing should include a live sync helper for accommodation Create days button state"
  );
  assert.match(
    travelPlanSource,
    /data-travel-plan-service-field="accommodation_days"[\s\S]*data-travel-plan-create-days="[^"]*"[\s\S]*type="button"\$\{createDaysEnabled \? "" : " disabled"\}/,
    "Accommodation travel-plan items should render the Create days button disabled until the day-count prerequisite is met"
  );
  assert.match(
    travelPlanSource,
    /els\.travel_plan_editor\.addEventListener\("input"[\s\S]*syncAccommodationCreateDaysButtonStates\(\);[\s\S]*els\.travel_plan_editor\.addEventListener\("change"[\s\S]*syncAccommodationCreateDaysButtonStates\(\);/,
    "Accommodation Create days enablement should resync during render and while editing the item"
  );
  assert.doesNotMatch(
    travelPlanSource,
    /create_days_title_required|if \(!String\(sourceItem\?\.title \|\| ""\)\.trim\(\)\)/,
    "Create days should not require a service title"
  );
  assert.match(
    travelPlanSource,
    /generatedDay\.title = createGeneratedDayTitle\(generatedDayNumber\);[\s\S]*cloneTravelPlanServiceForGeneratedDay\(sourceItem\)[\s\S]*days\.splice\(sourceDayIndex \+ 1, 0, \.\.\.generatedDays\);/,
    "Create days should insert generated days after the source day and clone the accommodation item into each one"
  );
  assert.match(
    travelPlanStyles,
    /\.travel-plan-grid--item-kind-accommodation \{[\s\S]*grid-template-columns: minmax\(220px, 280px\) minmax\(160px, 220px\) auto;/,
    "Accommodation travel-plan items should reserve a dedicated row layout for the day-count field and Create days button"
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
    /data-travel-plan-preview-image="[^"]*"[\s\S]*data-travel-plan-preview-src="[^"]*"[\s\S]*data-travel-plan-preview-alt="[^"]*"/,
    "Travel plan image cards should expose preview metadata for the full-size modal"
  );
  assert.match(
    travelPlanImagesSource,
    /travel-plan-image-card__preview[\s\S]*travel-plan-image-card__badge travel-plan-image-card__badge--overlay[\s\S]*travel-plan-image-card__badge travel-plan-image-card__badge--muted travel-plan-image-card__badge--overlay-start/,
    "Travel plan image badges should render as overlays on the image itself without a separate meta row"
  );
  assert.match(
    travelPlanSource,
    /data-travel-plan-preview-image[\s\S]*openTravelPlanImagePreview\(/,
    "Travel plan click handling should open the full-size image preview modal"
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
    /\.travel-plan-image-card \{[\s\S]*width: min\(100%, 240px\);[\s\S]*\.travel-plan-image-card__preview \{[\s\S]*width: 220px;[\s\S]*height: 220px;[\s\S]*\.travel-plan-image-card__actions \{[\s\S]*justify-content: center;/,
    "Inline travel plan image previews should render inside a compact fixed-size card"
  );
  assert.match(
    travelPlanStyles,
    /\.travel-plan-image-card__preview \{[\s\S]*position: relative;[\s\S]*\.travel-plan-image-card__badge--overlay \{[\s\S]*top: 0.55rem;[\s\S]*right: 0.55rem;[\s\S]*\.travel-plan-image-card__badge--overlay-start \{[\s\S]*top: 0.55rem;[\s\S]*left: 0.55rem;/,
    "Travel plan image badges should be positioned as inline preview overlays instead of using a meta row"
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
  const openApiPath = path.resolve(__dirname, "..", "..", "..", "api", "generated", "openapi.yaml");
  const travelPlanSource = await readFile(travelPlanScriptPath, "utf8");
  const bookingPageSource = await readFile(bookingPageScriptPath, "utf8");
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
    /travel-plan-footer__new-day[\s\S]*data-travel-plan-add-day[\s\S]*travel-plan-footer__separator[\s\S]*travel-plan-footer__existing-pdfs[\s\S]*travel-plan-footer__create-pdf[\s\S]*data-travel-plan-create-pdf[\s\S]*travel-plan-footer__attachments/,
    "The travel-plan footer should render the requested stacked order: New day, separator, existing travel-plan PDFs, Create PDF, then appended PDFs"
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
    /function previewTravelPlanPdf\(\)[\s\S]*bookingTravelPlanPdfRequest\([\s\S]*query:\s*\{\s*lang:\s*bookingContentLang\(\)\s*\}/,
    "Previewing a travel-plan PDF should use the preview GET request with the current booking content language"
  );
  assert.match(
    bookingPageSource,
    /const hintId = String\(element\.dataset\.cleanStateHintId \|\| ""\)\.trim\(\);[\s\S]*hintNode\.textContent = blocked \? message : "";/,
    "The booking page should populate clean-state hints for any gated action, not only generated offers"
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
    /booking\.travel_plan\.sent_to_customer[\s\S]*data-travel-plan-pdf-sent[\s\S]*data-travel-plan-delete-pdf/,
    "The travel-plan PDF table should render the sent-to-customer checkbox and delete action"
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

test("travel-plan PDF removes the old hero subtitle and badge, adds a section title, and suggests the new download filename", async () => {
  const travelPlanPdfPath = path.resolve(__dirname, "..", "src", "lib", "travel_plan_pdf.js");
  const bookingTravelPlanHandlerPath = path.resolve(__dirname, "..", "src", "http", "handlers", "booking_travel_plan.js");
  const [travelPlanPdfSource, bookingTravelPlanHandlerSource] = await Promise.all([
    readFile(travelPlanPdfPath, "utf8"),
    readFile(bookingTravelPlanHandlerPath, "utf8")
  ]);

  assert.match(
    travelPlanPdfSource,
    /function travelPlanSectionTitle\(lang\)[\s\S]*pdfT\(lang,\s*"travel_plan\.pdf_subtitle",\s*"Travel plan overview"\)/,
    "Travel-plan PDFs should define a dedicated itinerary section heading"
  );
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
  assert.match(
    travelPlanPdfSource,
    /text\(travelPlanSectionTitle\(lang\), PAGE_MARGIN, y,/,
    "Travel-plan PDFs should render a standalone section heading above the first itinerary day"
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

test("offer component editor does not expose discounts_credits as a selectable category", async () => {
  const offersModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offers.js");
  const offersSource = await readFile(offersModulePath, "utf8");

  assert.match(
    offersSource,
    /const OFFER_COMPONENT_CATEGORIES = OFFER_CATEGORIES\.filter\(\(category\) => category\.code !== "DISCOUNTS_CREDITS"\);/,
    "Offer component rows should not allow discounts_credits because that creates negative sellable line items"
  );
});

test("offer detail level select uses literal detail level values instead of currency normalization", async () => {
  const offersModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offers.js");
  const offersSource = await readFile(offersModulePath, "utf8");

  assert.match(
    offersSource,
    /function populateOfferDetailLevelSelect\(select, selectedValue, \{ disableFinerThan = null \} = \{\}\) \{[\s\S]*select\.innerHTML = html;[\s\S]*select\.value = normalizedSelected;/,
    "Offer detail level selects should keep the literal component/day/trip value after rendering options"
  );
  assert.doesNotMatch(
    offersSource,
    /function populateOfferDetailLevelSelect[\s\S]*setSelectValue\(select, normalizedSelected\)/,
    "Offer detail level selects must not use the currency-only select helper because it injects USD for unknown values"
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
  const coreModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "core.js");
  const bookingPageDataModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking_page_data.js");
  const bookingPageLanguageModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking_page_language.js");
  const bookingHandlersModulePath = path.resolve(__dirname, "..", "..", "..", "backend", "app", "src", "http", "handlers", "bookings.js");
  const [bookingSource, i18nSource, coreSource, bookingPageDataSource, bookingPageLanguageSource, bookingHandlersSource] = await Promise.all([
    readFile(bookingPagePath, "utf8"),
    readFile(bookingI18nPath, "utf8"),
    readFile(coreModulePath, "utf8"),
    readFile(bookingPageDataModulePath, "utf8"),
    readFile(bookingPageLanguageModulePath, "utf8"),
    readFile(bookingHandlersModulePath, "utf8")
  ]);

  assert.doesNotMatch(
    bookingSource,
    /id="booking_editing_language_field"/,
    "booking.html should no longer render a separate editing-language field once the top-right ATP staff language owns that choice"
  );
  assert.match(
    i18nSource,
    /export function bookingEditingLang\(fallback = DEFAULT_BOOKING_EDITING_LANG\) \{[\s\S]*window\.backendI18n\?\.getLang/,
    "Booking i18n helpers should derive the ATP staff source language from the active backend language selector"
  );
  assert.match(
    bookingPageDataSource,
    /async function syncBookingEditingLanguageToSelectedStaffLanguage\(bookingPayload\) \{[\s\S]*bookingEditingLang\("en"\)[\s\S]*bookingEditingLanguageRequest/,
    "Booking load should sync the backend editing-language field from the selected top-right ATP staff language"
  );
  assert.match(
    bookingPageDataSource,
    /const effectiveBookingPayload = await syncBookingEditingLanguageToSelectedStaffLanguage\(bookingPayload\);[\s\S]*applyBookingPayload\(effectiveBookingPayload,\s*\{\s*forceDraftReset:\s*true\s*\}\);/,
    "Booking page loads should apply the post-sync payload so downstream translation status and source branches follow the selected staff language"
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
    bookingHandlersSource,
    /return \{[\s\S]*handlePatchBookingCustomerLanguage,[\s\S]*handlePatchBookingEditingLanguage,[\s\S]*handlePatchBookingSource,/,
    "Booking handler composition should expose the editing-language patch handler once the route is declared"
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
    /applyBookingPayload\(effectiveBookingPayload,\s*\{\s*forceDraftReset:\s*true\s*\}\);/,
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
    /function getTravelPlanNormalizationOptions\(\) \{[\s\S]*sourceLang:\s*bookingEditingLang\(\)/,
    "Travel-plan normalization should derive its source language from the selected ATP staff language in the top-right selector"
  );
  assert.match(
    travelPlanHelpersSource,
    /export function normalizeTravelPlanDraft\(plan, offerComponents = \[\], options = \{\}\) \{[\s\S]*const sourceLang = normalizeBookingEditingLang\([\s\S]*bookingEditingLang\("en"\)[\s\S]*resolveLocalizedEditorText\(rawDay\.title_i18n \?\? rawDay\.title, sourceLang, ""\)/,
    "Travel-plan helper normalization should accept an explicit source language and otherwise fall back to the selected ATP staff language"
  );
});

test("generated offer actions are gated behind a clean page state", async () => {
  const bookingPagePath = path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "booking.html");
  const offersModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offer_generated_offers.js");
  const bookingSource = await readFile(bookingPagePath, "utf8");
  const offersSource = await readFile(offersModulePath, "utf8");

  assert.match(
    bookingSource,
    /id="generate_offer_btn"[^>]*data-requires-clean-state/,
    "The new-offer button should be disabled until pending page edits are saved or discarded"
  );
  assert.match(
    offersSource,
    /data-generated-offer-edit-comment="[^"]+"[^>]*data-requires-clean-state[\s\S]*data-generated-offer-delete="[^"]+"[^>]*data-requires-clean-state/,
    "Generated-offer comment edit and delete controls should be disabled while the page is dirty"
  );
  assert.match(
    offersSource,
    /ensureOfferCleanState/,
    "Generated-offer actions should call the explicit clean-state guard before mutating generated offers"
  );
});

test("persons and travel plan editors no longer autosave from local interactions", async () => {
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
  assert.doesNotMatch(
    travelPlanImagesSource,
    /bookingTravelPlanServiceImageDeleteRequest/,
    "Travel plan image removal should stay in the local draft until the page save bar is used"
  );
  assert.match(
    travelPlanImagesSource,
    /function removeTravelPlanServiceImage\(dayId, itemId, imageId\)\s*\{[\s\S]*syncTravelPlanDraftFromDom\?\.\(\);[\s\S]*item\.images = nextImages;[\s\S]*renderTravelPlanPanel\?\.\(\);/,
    "Removing a travel plan image should mutate the local draft and rerender instead of persisting immediately"
  );
  assert.doesNotMatch(
    travelPlanImagesSource,
    /data-travel-plan-remove-image="\$\{escapeHtml\(image\.id\)\}"[\s\S]*data-requires-clean-state/,
    "Travel plan image removal should remain available while the page has other unsaved edits"
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

test("travel-plan module preserves add/remove/reorder and offer-link editing helpers", async () => {
  const travelPlanModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
  const travelPlanHelpersPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_helpers.js");
  const generatedCatalogsPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "generated_catalogs.js");
  const source = await readFile(travelPlanModulePath, "utf8");
  const helperSource = await readFile(travelPlanHelpersPath, "utf8");
  const generatedCatalogs = await import(`${pathToFileURL(generatedCatalogsPath).href}?test=${Date.now()}`);

  for (const helperName of ["addDay", "removeDay", "addItem", "removeItem", "moveItem", "addLink", "removeLink"]) {
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

test("backend list pages have dedicated entrypoints and are served by caddy", async () => {
  const frontendRoot = path.resolve(__dirname, "..", "..", "..", "frontend");
  const deployRoot = path.resolve(__dirname, "..", "..", "..", "deploy");
  const backendHtml = await readFile(path.join(frontendRoot, "pages", "backend.html"), "utf8");
  const toursHtml = await readFile(path.join(frontendRoot, "pages", "tours.html"), "utf8");
  const settingsHtml = await readFile(path.join(frontendRoot, "pages", "settings.html"), "utf8");
  const localCaddy = await readFile(path.join(deployRoot, "Caddyfile.local"), "utf8");
  const stagingCaddy = await readFile(path.join(deployRoot, "Caddyfile"), "utf8");

  assert.match(
    backendHtml,
    /frontend\/scripts\/pages\/booking_list\.js/,
    "backend.html should mount the bookings page script"
  );
  assert.match(
    toursHtml,
    /frontend\/scripts\/pages\/tours_list\.js/,
    "tours.html should mount the tours page script"
  );
  assert.match(
    settingsHtml,
    /frontend\/scripts\/pages\/settings_list\.js/,
    "settings.html should mount the settings page script"
  );

  for (const source of [localCaddy, stagingCaddy]) {
    assert.match(source, /\/backend\.html/, "Caddy should serve backend.html");
    assert.match(source, /\/tours\.html/, "Caddy should serve tours.html");
    assert.match(source, /\/settings\.html/, "Caddy should serve settings.html");
  }
  assert.match(
    stagingCaddy,
    /import staging_html_no_cache_headers[\s\S]*import staging_static_cache_headers/,
    "Staging should scope no-cache headers to HTML entry pages while enabling short-lived caching for static assets"
  );
  assert.match(
    stagingCaddy,
    /@staging_static path \/assets\/\* \/frontend\/scripts\/\* \/frontend\/data\/\* \/shared\/\* \/site\.webmanifest/,
    "Staging should explicitly mark frontend scripts, dictionaries, shared bundles, and assets as cacheable static files"
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
    /const toursRequest = publicToursRequest\({[\s\S]*query: \{ lang: currentFrontendLang\(\) \}[\s\S]*const response = await fetch\(toursRequest\.url\);/,
    "Homepage tour loading should stop forcing uncached cache-busted requests on every language change"
  );
  assert.doesNotMatch(
    mainToursSource,
    /tripsRequestVersion|cache:\s*"no-store"/,
    "Homepage tour loading should not carry a per-load version cache buster or no-store fetch mode"
  );
});

test("runtime links use direct tours and settings pages instead of backend section query routes", async () => {
  const filesToScan = [
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking_list.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tours_list.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "settings_list.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "tour.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "shared", "nav.js"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "tours.html"),
    path.resolve(__dirname, "..", "..", "..", "frontend", "pages", "settings.html")
  ];

  for (const filePath of filesToScan) {
    const source = await readFile(filePath, "utf8");
    assert.doesNotMatch(
      source,
      /backend\.html\?section=(tours|settings)/,
      `${path.basename(filePath)} should not hard-code backend section query routes for tours/settings`
    );
    assert.doesNotMatch(
      source,
      /withBackendLang\(\s*"\/backend\.html"\s*,\s*\{\s*section\s*:\s*"(tours|settings)"/,
      `${path.basename(filePath)} should not build tours/settings routes through backend.html`
    );
  }
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
