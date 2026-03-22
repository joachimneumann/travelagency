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
    "booking_content_language_field",
    "booking_note_panel",
    "travel_plan_panel",
    "persons_editor_panel",
    "offer_panel",
    "offer_payment_terms_panel",
    "offer_acceptance_panel",
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

test("booking page top control row keeps staff, stage, and customer language visually aligned", async () => {
  const bookingStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking.css");
  const bookingStyles = await readFile(bookingStylesPath, "utf8");

  assert.match(
    bookingStyles,
    /#booking_actions_panel \.backend-controls \{\s*[\s\S]*align-items: start;/,
    "The booking top control row should align fields from the top so the three labels share the same vertical position"
  );
  assert.match(
    bookingStyles,
    /#booking_actions_panel \.booking-content-language-field \{\s*[\s\S]*gap: 0\.35rem;/,
    "The booking customer-language field should use the same label-to-control gap as the neighboring fields"
  );
  assert.match(
    bookingStyles,
    /#booking_actions_panel \.lang-menu-trigger \{\s*[\s\S]*padding: 0\.68rem 0\.9rem;[\s\S]*justify-content: center;/,
    "The booking customer-language trigger should match the booking control height scale and center its contents"
  );
});

test("travel plan item titles show a required state inline and drive a specific page-save error", async () => {
  const travelPlanScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan.js");
  const travelPlanValidationPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "travel_plan_validation.js");
  const bookingStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking.css");
  const travelPlanStylesPath = path.resolve(__dirname, "..", "..", "..", "shared", "css", "pages", "backend-booking-travel-plan.css");
  const travelPlanSource = await readFile(travelPlanScriptPath, "utf8");
  const validationSource = await readFile(travelPlanValidationPath, "utf8");
  const bookingStyles = await readFile(bookingStylesPath, "utf8");
  const travelPlanStyles = await readFile(travelPlanStylesPath, "utf8");

  assert.match(
    travelPlanSource,
    /querySelectorAll\('\[data-travel-plan-item-field="title"\]\[data-localized-lang="en"\]\[data-localized-role="source"\]'\)/,
    "Travel plan validation should target the English source title input for each travel plan item"
  );
  assert.match(
    travelPlanSource,
    /input\.classList\.toggle\("travel-plan-item-title-input--required", isEmpty\);[\s\S]*input\.placeholder = isEmpty \? requiredPlaceholder\(\) : "";/,
    "Empty travel plan item titles should render with a required-state class and placeholder"
  );
  assert.match(
    travelPlanSource,
    /setPageSaveActionError\?\.\(\s*bookingT\(\s*"booking\.travel_plan\.validation\.item_title_action_error",\s*"Travel plan item \{item\} on day \{day\} needs a title\."/,
    "Travel plan save should expose a specific page-save error when an item title is missing"
  );
  assert.match(
    travelPlanSource,
    /travel-plan-grid travel-plan-grid--item-kind[\s\S]*booking\.travel_plan\.kind_label[\s\S]*travel-plan-grid[\s\S]*booking\.travel_plan\.item_title[\s\S]*booking\.location/,
    "Travel plan item editing should show kind first, with title and location below it"
  );
  assert.match(
    validationSource,
    /code:\s*"item_title_required"[\s\S]*dayNumber[\s\S]*itemNumber/,
    "Travel plan validation should return structured metadata for missing item titles"
  );
  assert.match(
    bookingStyles,
    /\.booking-detail-page \.travel-plan-item-title-input--required[\s\S]*background: var\(--surface-error\);[\s\S]*border-color: var\(--line-error-strong\);/,
    "The booking page should render empty required travel plan titles with an error background"
  );
  assert.match(
    travelPlanStyles,
    /\.travel-plan-grid--item-kind \{[\s\S]*grid-template-columns: minmax\(220px, 280px\);/,
    "Travel plan styles should keep the kind selector on its own row above title and location"
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

test("offer component editor does not expose discounts_credits as a selectable category", async () => {
  const offersModulePath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "booking", "offers.js");
  const offersSource = await readFile(offersModulePath, "utf8");

  assert.match(
    offersSource,
    /const OFFER_COMPONENT_CATEGORIES = OFFER_CATEGORIES\.filter\(\(category\) => category\.code !== "DISCOUNTS_CREDITS"\);/,
    "Offer component rows should not allow discounts_credits because that creates negative sellable line items"
  );
});

test("booking page save orchestrates dirty sections through existing section endpoints", async () => {
  const bookingPageScriptPath = path.resolve(__dirname, "..", "..", "..", "frontend", "scripts", "pages", "booking.js");
  const bookingSource = await readFile(bookingPageScriptPath, "utf8");

  assert.match(
    bookingSource,
    /async function savePageEdits\(\)\s*\{[\s\S]*?saveCoreEdits\(\)[\s\S]*?saveNoteEdits\(\)[\s\S]*?personsModule\.saveAllPersonDrafts\(\)[\s\S]*?saveOffer\(\)[\s\S]*?travelPlanModule\.saveTravelPlan\(\)[\s\S]*?savePricing\(\)[\s\S]*?createInvoice\(\)/,
    "Page save should orchestrate the existing booking section endpoints in order"
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
    /bookingTravelPlanItemImageDeleteRequest/,
    "Travel plan image removal should stay in the local draft until the page save bar is used"
  );
  assert.match(
    travelPlanImagesSource,
    /function removeTravelPlanItemImage\(dayId, itemId, imageId\)\s*\{[\s\S]*syncTravelPlanDraftFromDom\?\.\(\);[\s\S]*item\.images = nextImages;[\s\S]*renderTravelPlanPanel\?\.\(\);/,
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
    /data-travel-plan-item-field="timing_kind"/,
    "travel_plan.js should render a timing mode selector for each item"
  );
  assert.match(
    source,
    /data-travel-plan-item-field="time_point_date"/,
    "travel_plan.js should render a date input for point timing mode"
  );
  assert.match(
    source,
    /data-travel-plan-item-field="time_point_time"/,
    "travel_plan.js should render a 5-minute time selector for point timing mode"
  );
  assert.match(
    source,
    /data-travel-plan-item-field="start_time_date"/,
    "travel_plan.js should render a start-date input for range timing mode"
  );
  assert.match(
    source,
    /data-travel-plan-item-field="start_time_time"/,
    "travel_plan.js should render a start-time selector for range timing mode"
  );
  assert.match(
    source,
    /data-travel-plan-item-field="end_time_date"/,
    "travel_plan.js should render an end-date input for range timing mode"
  );
  assert.match(
    source,
    /data-travel-plan-item-field="end_time_time"/,
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
