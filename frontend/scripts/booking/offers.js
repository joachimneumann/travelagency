import { GENERATED_OFFER_CATEGORIES as GENERATED_OFFER_CATEGORY_LIST } from "../../Generated/Models/generated_Booking.js";
import {
  bookingGenerateOfferRequest,
  bookingGeneratedOfferDeleteRequest,
  bookingGeneratedOfferGmailDraftRequest,
  bookingGeneratedOfferUpdateRequest,
  bookingOfferRequest,
  offerExchangeRatesRequest
} from "../../Generated/API/generated_APIRequestFactory.js?v=741a535307b3";
import {
  formatMoneyDisplay,
  formatMoneyInputValue,
  getCurrencyDefinitions,
  isWholeUnitCurrency,
  normalizeCurrencyCode,
  parseMoneyInputValue,
  setSelectValue
} from "./pricing.js?v=741a535307b3";

const DEFAULT_OFFER_TAX_RATE_BASIS_POINTS = 1000;
const GMAIL_TAB_NAME = "asiatravelplan_gmail_drafts";
let gmailWindowHandle = null;

function acquireGmailWindow() {
  if (gmailWindowHandle && !gmailWindowHandle.closed) {
    return { windowRef: gmailWindowHandle, openedNewWindow: false };
  }
  const windowRef = window.open("about:blank", GMAIL_TAB_NAME);
  if (!windowRef) {
    return { windowRef: null, openedNewWindow: false };
  }
  gmailWindowHandle = windowRef;
  try {
    windowRef.opener = null;
  } catch {
    // Ignore browsers that disallow modifying opener on a fresh tab.
  }
  return { windowRef, openedNewWindow: true };
}

const OFFER_CATEGORIES = GENERATED_OFFER_CATEGORY_LIST.map((code) => ({
  code,
  label: code
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}));

const OFFER_COMPONENT_CATEGORIES = OFFER_CATEGORIES.filter((category) => category.code !== "DISCOUNTS_CREDITS");

export function createBookingOfferModule(ctx) {
  const {
    state,
    els,
    apiOrigin,
    fetchApi,
    fetchBookingMutation,
    getBookingRevision,
    renderBookingHeader,
    renderBookingData,
    loadActivities,
    escapeHtml,
    setBookingSectionDirty
  } = ctx;

  let offerAutosaveTimer = null;
  let offerAutosaveInFlight = false;
  let offerAutosavePending = false;
  let offerAutosavePromise = null;
  let offerPendingRowIndexes = new Set();
  let offerTotalPending = false;

  function normalizeOfferStatus(value) {
    const normalized = String(value || "").trim().toUpperCase();
    return ["DRAFT", "APPROVED", "OFFER_SENT"].includes(normalized) ? normalized : "DRAFT";
  }

  function isOfferCurrencyEditable() {
    return state.permissions.canEditBooking && normalizeOfferStatus(state.offerDraft?.status || state.booking?.offer?.status) === "DRAFT";
  }

  function debugOffer(step, payload = undefined) {
    void step;
    void payload;
    // Temporary offer debug logging kept commented for quick re-enable during pricing investigations.
    // try {
    //   if (payload === undefined) {
    //     console.log(`[offer-debug] ${step}`);
    //   } else {
    //     console.log(`[offer-debug] ${step}`, payload);
    //   }
    // } catch {
    //   // ignore debug serialization failures
    // }
  }

  function setOfferStatus(message) {
    if (!els.offer_status) return;
    els.offer_status.textContent = message;
  }

  function clearOfferStatus() {
    setOfferStatus("");
  }

  function updateOfferPanelSummary(totalCents, currency) {
    if (!els.offer_panel_summary_text) return;
    els.offer_panel_summary_text.textContent = `Offer ${formatMoneyDisplay(totalCents, currency)}`;
  }

  function setOfferSaveEnabled(enabled) {
    setBookingSectionDirty("offer", Boolean(enabled) && state.permissions.canEditBooking);
  }

  function formatGeneratedOfferDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function defaultOfferCategoryRules() {
    return OFFER_CATEGORIES.map((category) => ({
      category: category.code,
      tax_rate_basis_points: DEFAULT_OFFER_TAX_RATE_BASIS_POINTS
    }));
  }

  function cloneOffer(offer) {
    const source = offer && typeof offer === "object" ? offer : {};
    const categoryRulesByCode = new Map(
      (Array.isArray(source.category_rules) ? source.category_rules : []).map((rule) => [
        String(rule?.category || "").toUpperCase(),
        {
          category: String(rule?.category || "").toUpperCase(),
          tax_rate_basis_points: Number(rule?.tax_rate_basis_points ?? DEFAULT_OFFER_TAX_RATE_BASIS_POINTS)
        }
      ])
    );

    const category_rules = OFFER_CATEGORIES.map((category) => {
      const existing = categoryRulesByCode.get(category.code);
      return {
        category: category.code,
        tax_rate_basis_points:
          Number.isFinite(Number(existing?.tax_rate_basis_points))
            ? Math.max(0, Math.round(Number(existing.tax_rate_basis_points)))
            : DEFAULT_OFFER_TAX_RATE_BASIS_POINTS
      };
    });

    const sourceComponents = Array.isArray(source.components) ? source.components : [];

    return {
      status: normalizeOfferStatus(source.status),
      currency: normalizeCurrencyCode(source.currency || state.booking?.preferred_currency || "USD"),
      category_rules,
      components: sourceComponents.map((component, index) => ({
        id: String(component?.id || ""),
        category: normalizeOfferCategory(component?.category),
        label: String(component?.label || ""),
        details: String(component?.details || component?.description || ""),
        quantity: Math.max(1, Number(component?.quantity || 1)),
        unit_amount_cents: Math.max(0, Number(component?.unit_amount_cents || 0)),
        tax_rate_basis_points: Number.isFinite(Number(component?.tax_rate_basis_points))
          ? Math.max(0, Math.round(Number(component.tax_rate_basis_points)))
          : DEFAULT_OFFER_TAX_RATE_BASIS_POINTS,
        currency: normalizeCurrencyCode(component?.currency || source.currency || state.booking?.preferred_currency || "USD"),
        notes: String(component?.notes || ""),
        sort_order: Number.isFinite(Number(component?.sort_order)) ? Number(component.sort_order) : index
      })),
      totals: source.totals || {
        net_amount_cents: 0,
        tax_amount_cents: 0,
        gross_amount_cents: 0,
        components_count: 0
      }
    };
  }

  function normalizeOfferCategory(value) {
    const normalized = String(value || "").trim().toUpperCase();
    return OFFER_CATEGORIES.some((category) => category.code === normalized) ? normalized : "OTHER";
  }

  function offerCategoryLabel(code) {
    return OFFER_CATEGORIES.find((entry) => entry.code === normalizeOfferCategory(code))?.label || "Other";
  }

  function offerCategorySign(code) {
    return normalizeOfferCategory(code) === "DISCOUNTS_CREDITS" ? -1 : 1;
  }

  function getOfferCategoryTaxRateBasisPoints(category) {
    const normalizedCategory = normalizeOfferCategory(category);
    const rule = Array.isArray(state.offerDraft?.category_rules)
      ? state.offerDraft.category_rules.find((componentRule) => normalizeOfferCategory(componentRule?.category) === normalizedCategory)
      : null;
    const basisPoints = Number(rule?.tax_rate_basis_points ?? DEFAULT_OFFER_TAX_RATE_BASIS_POINTS);
    return Number.isFinite(basisPoints) ? Math.max(0, Math.round(basisPoints)) : DEFAULT_OFFER_TAX_RATE_BASIS_POINTS;
  }

  function computeOfferComponentLineTotals(component) {
    const sign = offerCategorySign(component?.category);
    const quantity = Math.max(1, Number(component?.quantity || 1));
    const unitAmount = Math.max(0, Number(component?.unit_amount_cents || 0));
    const taxBasisPoints = Math.max(0, Number(component?.tax_rate_basis_points || 0));
    const net_amount_cents = sign * quantity * unitAmount;
    const tax_amount_cents = sign * Math.round((quantity * unitAmount * taxBasisPoints) / 10000);
    return {
      net_amount_cents,
      tax_amount_cents,
      gross_amount_cents: net_amount_cents + tax_amount_cents
    };
  }

  function computeOfferDraftTotalsFromComponents(components) {
    const normalizedComponents = Array.isArray(components) ? components : [];
    let net_amount_cents = 0;
    let tax_amount_cents = 0;
    for (const component of normalizedComponents) {
      const line = computeOfferComponentLineTotals(component);
      net_amount_cents += line.net_amount_cents;
      tax_amount_cents += line.tax_amount_cents;
    }
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    return {
      currency,
      net_amount_cents,
      tax_amount_cents,
      gross_amount_cents: net_amount_cents + tax_amount_cents,
      components_count: normalizedComponents.length
    };
  }

  function resolveOfferTotalCents() {
    const explicitTotal = Number(state.offerDraft?.total_price_cents);
    if (Number.isFinite(explicitTotal)) {
      return Math.round(explicitTotal);
    }
    const offerComponents = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [];
    const offerTotals = computeOfferDraftTotalsFromComponents(offerComponents);
    return offerTotals?.gross_amount_cents || 0;
  }

  function readOfferDraftComponentsForRender() {
    const rows = Array.from(document.querySelectorAll("[data-offer-component-details]"));
    const fallbackComponents = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [];
    if (!rows.length) {
      return fallbackComponents;
    }
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    return rows.map((_, index) => {
      const category = normalizeOfferCategory(state.offerDraft?.components?.[index]?.category || "OTHER");
      const details = String(document.querySelector(`[data-offer-component-details="${index}"]`)?.value || "").trim();
      const quantityRaw = Number(document.querySelector(`[data-offer-component-quantity="${index}"]`)?.value || "1");
      const unitAmountRaw = document.querySelector(`[data-offer-component-unit="${index}"]`)?.value || "0";
      const quantity = Number.isFinite(quantityRaw) && quantityRaw >= 1 ? Math.round(quantityRaw) : 1;
      const unitAmount = parseMoneyInputValue(unitAmountRaw, currency);
      const fallbackComponent = fallbackComponents[index] || {};
      return {
        id: String(fallbackComponent.id || ""),
        category,
        label: String(fallbackComponent.label || ""),
        details: details || null,
        quantity,
        unit_amount_cents:
          Number.isFinite(unitAmount) && unitAmount >= 0
            ? Math.round(unitAmount)
            : Math.max(0, Number(fallbackComponent.unit_amount_cents || 0)),
        tax_rate_basis_points: Number.isFinite(Number(fallbackComponent.tax_rate_basis_points))
          ? Math.max(0, Math.round(Number(fallbackComponent.tax_rate_basis_points)))
          : getOfferCategoryTaxRateBasisPoints(category),
        currency,
        notes: String(fallbackComponent.notes || ""),
        sort_order: fallbackComponent.sort_order ?? index
      };
    });
  }

  async function applyOfferBookingResponse(response, { reloadActivities = false } = {}) {
    if (!response?.booking) return false;
    state.booking = response.booking;
    renderBookingHeader();
    renderBookingData();
    renderOfferPanel();
    if (reloadActivities) {
      await loadActivities();
    }
    return true;
  }

  function addOfferComponent() {
    if (!state.permissions.canEditBooking || !state.offerDraft) return;
    const category = normalizeOfferCategory("OTHER");
    debugOffer("add component:start", {
      booking_id: state.booking?.id || "",
      normalized_category: category,
      components_before: Array.isArray(state.offerDraft?.components) ? state.offerDraft.components.length : 0
    });
    state.offerDraft.components.push({
      id: "",
      category,
      label: "",
      details: "",
      quantity: 1,
      unit_amount_cents: 0,
      tax_rate_basis_points: getOfferCategoryTaxRateBasisPoints(category),
      currency: state.offerDraft.currency,
      notes: "",
      sort_order: state.offerDraft.components.length
    });
    debugOffer("add component:after push", {
      components: state.offerDraft.components.map((component) => ({
        id: component.id,
        category: component.category,
        details: component.details,
        quantity: component.quantity,
        unit_amount_cents: component.unit_amount_cents
      }))
    });
    setOfferSaveEnabled(true);
    renderOfferComponentsTable();
  }

  function renderOfferPanel() {
    if (!els.offer_panel || !state.booking) return;
    const offer = cloneOffer(state.booking.offer || {});
    state.offerDraft = offer;
    offerPendingRowIndexes = new Set();
    offerTotalPending = false;
    debugOffer("render panel", {
      booking_id: state.booking.id,
      offer: {
        currency: offer.currency,
        components: offer.components.map((component) => ({
          id: component.id,
          category: component.category,
          details: component.details,
          quantity: component.quantity,
          unit_amount_cents: component.unit_amount_cents
        }))
      }
    });
    const currency = normalizeCurrencyCode(offer.currency || state.booking.preferred_currency || "USD");
    state.offerDraft.currency = currency;

    if (els.offer_currency_input) {
      setSelectValue(els.offer_currency_input, currency);
      els.offer_currency_input.disabled = !isOfferCurrencyEditable();
    }
    updateOfferCurrencyHint(currency);
    updateOfferPanelSummary(resolveOfferTotalCents(), currency);
    setOfferSaveEnabled(false);

    renderOfferComponentsTable();
    renderGeneratedOffersTable();
    clearOfferStatus();
  }

  function renderGeneratedOffersTable() {
    if (!els.generated_offers_table) return;
    const items = Array.isArray(state.booking?.generated_offers) ? state.booking.generated_offers : [];
    const canEdit = state.permissions.canEditBooking;
    const actionHeader = canEdit ? '<th class="generated-offers-col-actions"></th>' : "";
    const rows = items.length
      ? items
        .slice()
        .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))
        .map((item) => {
          const pdfUrl = String(item.pdf_url || "").trim();
          return `<tr>
          <td class="generated-offers-col-link">${pdfUrl ? `<a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener">PDF</a>` : "-"}</td>
          <td class="generated-offers-col-email">${canEdit
            ? `<button class="btn btn-ghost" type="button" data-generated-offer-email="${escapeHtml(item.id)}">email</button>`
            : "-"}</td>
          <td class="generated-offers-col-total">${escapeHtml(formatMoneyDisplay(item.total_price_cents || 0, item.currency || state.offerDraft?.currency || "USD"))}</td>
          <td class="generated-offers-col-date">${escapeHtml(formatGeneratedOfferDate(item.created_at))}</td>
          <td class="generated-offers-col-comment">${canEdit
            ? `<textarea id="generated_offer_comment_${escapeHtml(item.id)}" name="generated_offer_comment_${escapeHtml(item.id)}" data-generated-offer-comment="${escapeHtml(item.id)}" rows="1">${escapeHtml(item.comment || "")}</textarea>`
            : (escapeHtml(item.comment || "") || "-")}</td>
          ${canEdit
            ? `<td class="generated-offers-col-actions"><button class="btn btn-ghost offer-remove-btn" type="button" data-generated-offer-delete="${escapeHtml(item.id)}" title="Delete generated offer" aria-label="Delete generated offer">×</button></td>`
            : ""}
        </tr>`;
        })
        .join("")
      : `<tr><td colspan="${canEdit ? 6 : 5}">No generated offers yet</td></tr>`;
    els.generated_offers_table.innerHTML = `<thead><tr><th class="generated-offers-col-link">PDF</th><th class="generated-offers-col-email">Email</th><th class="generated-offers-col-total">Total</th><th class="generated-offers-col-date">Date</th><th>Comments</th>${actionHeader}</tr></thead><tbody>${rows}</tbody>`;

    if (canEdit) {
      els.generated_offers_table.querySelectorAll("[data-generated-offer-comment]").forEach((input) => {
        input.addEventListener("change", () => {
          void saveGeneratedOfferComment(input.getAttribute("data-generated-offer-comment"), input.value);
        });
      });
      els.generated_offers_table.querySelectorAll("[data-generated-offer-delete]").forEach((button) => {
        button.addEventListener("click", () => {
          void deleteGeneratedOffer(button.getAttribute("data-generated-offer-delete"));
        });
      });
      els.generated_offers_table.querySelectorAll("[data-generated-offer-email]").forEach((button) => {
        button.addEventListener("click", () => {
          void createGeneratedOfferGmailDraft(button.getAttribute("data-generated-offer-email"));
        });
      });
    }

    if (els.generate_offer_btn) {
      els.generate_offer_btn.style.display = state.permissions.canEditBooking ? "" : "none";
      els.generate_offer_btn.onclick = state.permissions.canEditBooking ? () => {
        void handleGenerateOffer();
      } : null;
    }
  }

  async function saveGeneratedOfferComment(generatedOfferId, value) {
    if (!state.permissions.canEditBooking || !state.booking?.id || !generatedOfferId) return;
    const request = bookingGeneratedOfferUpdateRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        generated_offer_id: generatedOfferId
      }
    });
    const response = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_offer_revision: getBookingRevision("offer_revision"),
        comment: String(value || "").trim() || null
      }
    });
    if (await applyOfferBookingResponse(response)) return;
    if (!response) return;
    setOfferStatus(response?.detail || response?.error || "Could not update generated offer comment.");
  }

  async function deleteGeneratedOffer(generatedOfferId) {
    if (!state.permissions.canEditBooking || !state.booking?.id || !generatedOfferId) return;
    if (!window.confirm("Delete this generated offer?")) return;
    const request = bookingGeneratedOfferDeleteRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        generated_offer_id: generatedOfferId
      }
    });
    const response = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_offer_revision: getBookingRevision("offer_revision")
      }
    });
    if (await applyOfferBookingResponse(response)) return;
    if (!response) return;
    setOfferStatus(response?.detail || response?.error || "Could not delete generated offer.");
  }

  async function createGeneratedOfferGmailDraft(generatedOfferId) {
    if (!state.permissions.canEditBooking || !state.booking?.id || !generatedOfferId) return;
    const { windowRef: draftWindow, openedNewWindow } = acquireGmailWindow();
    setOfferStatus("Creating Gmail draft...");
    const request = bookingGeneratedOfferGmailDraftRequest({
      baseURL: apiOrigin,
      params: {
        booking_id: state.booking.id,
        generated_offer_id: generatedOfferId
      }
    });
    const response = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        actor: state.user || null
      }
    });
    if (response?.gmail_draft_url) {
      if (draftWindow) {
        draftWindow.location = response.gmail_draft_url;
        setOfferStatus(response.warning || "");
        return;
      }
      const fallbackTab = window.open(response.gmail_draft_url, GMAIL_TAB_NAME);
      if (fallbackTab) {
        gmailWindowHandle = fallbackTab;
        try {
          fallbackTab.opener = null;
        } catch {
          // Ignore browsers that disallow modifying opener on a fresh tab.
        }
        setOfferStatus(response.warning || "");
        return;
      }
      setOfferStatus("Gmail draft created, but your browser blocked opening a new tab. Allow pop-ups and try again.");
      return;
    }
    if (draftWindow && openedNewWindow) {
      draftWindow.close();
      gmailWindowHandle = null;
    }
    if (!response) {
      setOfferStatus("");
      return;
    }
    setOfferStatus(response?.detail || response?.error || "Could not create Gmail draft.");
  }

  async function handleGenerateOffer() {
    if (!state.permissions.canEditBooking || !state.booking?.id) return;
    await flushOfferAutosave();
    const request = bookingGenerateOfferRequest({
      baseURL: apiOrigin,
      params: { booking_id: state.booking.id }
    });
    const commentInput = window.prompt("Comment for this generated offer (optional):", "");
    if (commentInput === null) return;
    const normalizedComment = String(commentInput || "").trim();
    setOfferStatus("Generating offer PDF...");
    const response = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_offer_revision: getBookingRevision("offer_revision"),
        comment: normalizedComment || null
      }
    });
    if (await applyOfferBookingResponse(response, { reloadActivities: true })) {
      clearOfferStatus();
      return;
    }
    if (!response) {
      setOfferStatus("");
      return;
    }
    setOfferStatus(response?.detail || response?.error || "Could not generate offer PDF.");
  }

  async function flushOfferAutosave() {
    if (offerAutosaveTimer) {
      window.clearTimeout(offerAutosaveTimer);
      offerAutosaveTimer = null;
      await saveOffer();
      return;
    }
    if (offerAutosaveInFlight && offerAutosavePromise) {
      await offerAutosavePromise;
      return;
    }
    if (offerAutosavePending) {
      offerAutosavePending = false;
      await saveOffer();
    }
  }

  function renderOfferComponentsTable() {
    if (!els.offer_components_table) return;
    const readOnly = !state.permissions.canEditBooking;
    const showActionsCol = !readOnly;
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const offerComponents = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [];
    const showDualPrice = true;
    const priceHeaders = showDualPrice
      ? `<th class="offer-col-price-single">Single</th><th class="offer-col-price-total">Total (incl. tax)</th>`
      : `<th class="offer-col-price-total">Total (${escapeHtml(currency)})</th>`;
    const actionHeader = showActionsCol ? '<th class="offer-col-actions"></th>' : "";
    const header = `<thead><tr><th class="offer-col-category">Offer category</th><th class="offer-col-details">Offer details</th><th class="offer-col-qty">Quantity</th>${priceHeaders}${actionHeader}</tr></thead>`;
    const rows = offerComponents
      .map((component, index) => {
        const category = normalizeOfferCategory(component.category || "OTHER");
        const quantity = Math.max(1, Number(component.quantity || 1));
        const unitAmount = Math.max(0, Number(component.unit_amount_cents || 0));
        const rawLineTotal = computeOfferComponentLineTotals(component).gross_amount_cents;
        const componentTotalText = formatMoneyDisplay(Math.round(rawLineTotal), currency);
        const removeButton = showActionsCol
          ? `<button class="btn btn-ghost offer-remove-btn" type="button" data-offer-remove-component="${index}" title="Remove offer component" aria-label="Remove offer component">×</button>`
          : "";
        const singleInput = `<input id="offer_component_unit_${index}" name="offer_component_unit_${index}" data-offer-component-unit="${index}" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(unitAmount, currency))}" ${readOnly ? "disabled" : ""} />`;
        const categorySelect = `<select id="offer_component_category_${index}" name="offer_component_category_${index}" data-offer-component-category="${index}" ${readOnly ? "disabled" : ""}>${OFFER_COMPONENT_CATEGORIES.map((option) => `<option value="${escapeHtml(option.code)}" ${option.code === category ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select>`;
        const totalPriceCell = showDualPrice
          ? `<td class="offer-col-price-total"><div class="offer-total-cell"><span class="offer-price-value" data-offer-component-total="${index}">${escapeHtml(componentTotalText)}</span></div></td>`
          : `<td class="offer-col-price-total"><div class="offer-total-cell"><span class="offer-price-value" data-offer-component-total="${index}">${escapeHtml(componentTotalText)}</span></div></td>`;
        const unitInputCell = showDualPrice ? `<td class="offer-col-price-single">${singleInput}</td>` : "";
        const actionCell = showActionsCol ? `<td class="offer-col-actions">${removeButton}</td>` : "";
        const priceCells = showDualPrice ? `${unitInputCell}${totalPriceCell}` : totalPriceCell;
        return `<tr>
      <td class="offer-col-category">
        <div>${categorySelect}</div>
      </td>
      <td class="offer-col-details"><textarea id="offer_component_details_${index}" name="offer_component_details_${index}" data-offer-component-details="${index}" rows="1" ${readOnly ? "disabled" : ""}>${escapeHtml(component.details || component.description || "")}</textarea></td>
      <td class="offer-col-qty"><input id="offer_component_quantity_${index}" name="offer_component_quantity_${index}" data-offer-component-quantity="${index}" type="number" min="1" step="1" value="${escapeHtml(String(quantity))}" ${readOnly ? "disabled" : ""} /></td>
      ${priceCells}${actionCell}
    </tr>`;
      })
      .join("");
    const offerTotalValue = formatMoneyDisplay(resolveOfferTotalCents(), currency);
    updateOfferPanelSummary(resolveOfferTotalCents(), currency);
    const addButtonCell = !readOnly
      ? `<td class="offer-col-category"></td><td class="offer-add-cell"><button class="btn btn-ghost booking-offer-add-btn" type="button" data-offer-add-component>new</button></td>`
      : `<td class="offer-col-category"></td><td class="offer-col-details"></td>`;
    const totalLabelCols = `<td colspan="2" class="offer-total-merged"><div class="offer-total-sum"><strong class="offer-total-label">Total:</strong></div></td>`;
    const totalValueCol = `<td class="offer-col-price-total offer-total-final"><div class="offer-total-cell"><strong class="offer-price-value offer-total-value">${escapeHtml(offerTotalValue)}</strong></div></td>`;
    const totalRow = `<tr class="offer-total-row">${addButtonCell}${totalLabelCols}${totalValueCol}${showActionsCol ? '<td class="offer-col-actions"></td>' : ""}</tr>`;
    els.offer_components_table.innerHTML = `${header}<tbody>${rows}${totalRow}</tbody>`;

    if (!readOnly) {
      const syncOfferInputTotals = () => {
        state.offerDraft.components = readOfferDraftComponentsForRender();
        state.offerDraft.total_price_cents = null;
        setOfferSaveEnabled(true);
        updateOfferTotalsInDom();
      };
      const syncOfferAndAutosave = () => {
        syncOfferInputTotals();
        scheduleOfferAutosave();
      };
      els.offer_components_table.querySelectorAll("[data-offer-remove-component]").forEach((button) => {
        button.addEventListener("click", async () => {
          const index = Number(button.getAttribute("data-offer-remove-component"));
          const component = state.offerDraft.components[index];
          const categoryLabel = offerCategoryLabel(component?.category);
          const detailsLabel = String(component?.details || component?.description || "").trim() || "No details";
          const totalLabel = formatMoneyDisplay(
            computeOfferComponentLineTotals(component).gross_amount_cents,
            currency
          );
          const confirmationMessage = [
            "Remove this offer component?",
            "",
            `Category: ${categoryLabel}`,
            `Details: ${detailsLabel}`,
            `Total: ${totalLabel}`
          ].join("\n");
          if (!window.confirm(confirmationMessage)) {
            return;
          }
          state.offerDraft.components.splice(index, 1);
          setOfferSaveEnabled(true);
          renderOfferComponentsTable();
          await saveOffer();
        });
      });
      els.offer_components_table.querySelectorAll("[data-offer-component-category]").forEach((input) => {
        input.addEventListener("change", syncOfferAndAutosave);
      });
      els.offer_components_table.querySelectorAll("[data-offer-component-details]").forEach((input) => {
        input.addEventListener("change", syncOfferAndAutosave);
      });
      els.offer_components_table.querySelectorAll("[data-offer-component-quantity], [data-offer-component-unit]").forEach((input) => {
        input.addEventListener("input", () => {
          const index = Number(
            input.getAttribute("data-offer-component-quantity")
            || input.getAttribute("data-offer-component-unit")
            || "-1"
          );
          if (index >= 0) {
            offerPendingRowIndexes.add(index);
            offerTotalPending = true;
          }
          syncOfferInputTotals();
        });
        input.addEventListener("change", syncOfferAndAutosave);
      });
      els.offer_components_table.querySelectorAll("[data-offer-add-component]").forEach((button) => {
        button.addEventListener("click", addOfferComponent);
      });
    }
  }

  function updateOfferTotalsInDom() {
    const currency = normalizeCurrencyCode(state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    const components = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [];
    components.forEach((component, index) => {
      const totalNode = document.querySelector(`[data-offer-component-total="${index}"]`);
      if (!totalNode) return;
      if (offerPendingRowIndexes.has(index)) {
        totalNode.textContent = formatPendingMoneyDisplay(currency);
        return;
      }
      const total = computeOfferComponentLineTotals(component).gross_amount_cents;
      totalNode.textContent = formatMoneyDisplay(Math.round(total), currency);
    });
    const totalValueNode = document.querySelector(".offer-total-value");
    if (totalValueNode) {
      totalValueNode.textContent = `${offerTotalPending ? formatPendingMoneyDisplay(currency) : formatMoneyDisplay(resolveOfferTotalCents(), currency)}`;
    }
  }

  function scheduleOfferAutosave() {
    if (!state.permissions.canEditBooking) return;
    if (offerAutosaveInFlight) {
      offerAutosavePending = true;
      return;
    }
    if (offerAutosaveTimer) window.clearTimeout(offerAutosaveTimer);
    offerAutosaveTimer = window.setTimeout(() => {
      offerAutosaveTimer = null;
      void saveOffer();
    }, 350);
  }

  function collectOfferCategoryRules() {
    const defaults = defaultOfferCategoryRules();
    const byCategory = new Map(
      (Array.isArray(state.offerDraft?.category_rules) ? state.offerDraft.category_rules : []).map((rule) => [
        normalizeOfferCategory(rule?.category),
        rule
      ])
    );
    return OFFER_CATEGORIES.map((category) => {
      const override = byCategory.get(category.code);
      const raw = override?.tax_rate_basis_points;
      const taxRateBasisPoints = Number.isFinite(Number(raw))
        ? Math.max(0, Math.round(Number(raw)))
        : defaults.find((entry) => entry.category === category.code)?.tax_rate_basis_points || DEFAULT_OFFER_TAX_RATE_BASIS_POINTS;
      return {
        category: category.code,
        tax_rate_basis_points: taxRateBasisPoints
      };
    });
  }

  function collectOfferComponents({ throwOnError = true } = {}) {
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const rows = Array.from(document.querySelectorAll("[data-offer-component-details]"));
    const components = [];
    for (const input of rows) {
      const index = Number(input.getAttribute("data-offer-component-details"));
      const category = normalizeOfferCategory(document.querySelector(`[data-offer-component-category="${index}"]`)?.value || "OTHER");
      const details = String(document.querySelector(`[data-offer-component-details="${index}"]`)?.value || "").trim();
      const quantity = Number(document.querySelector(`[data-offer-component-quantity="${index}"]`)?.value || "1");
      const unitAmount = parseMoneyInputValue(document.querySelector(`[data-offer-component-unit="${index}"]`)?.value || "0", currency);
      const label = String(offerCategoryLabel(category)).trim();
      const notes = String(state.offerDraft?.components[index]?.notes || "").trim();
      if (!category) {
        if (throwOnError) throw new Error(`Offer component ${index + 1} requires a category.`);
        continue;
      }
      if (!Number.isFinite(quantity) || quantity < 1) {
        if (throwOnError) throw new Error(`Offer component ${index + 1} quantity must be at least 1.`);
        continue;
      }
      if (!Number.isFinite(unitAmount) || unitAmount < 0) {
        if (throwOnError) throw new Error(`Offer component ${index + 1} requires a valid non-negative unit amount.`);
        continue;
      }
      components.push({
        id: state.offerDraft.components[index]?.id || "",
        category,
        label,
        details: details || null,
        quantity: Math.round(quantity),
        unit_amount_cents: Math.round(unitAmount),
        tax_rate_basis_points: getOfferCategoryTaxRateBasisPoints(category),
        currency,
        notes: notes || null,
        sort_order: index
      });
    }
    debugOffer("collect components", {
      booking_id: state.booking?.id || "",
      currency,
      components: components.map((component) => ({
        id: component.id,
        category: component.category,
        details: component.details,
        quantity: component.quantity,
        unit_amount_cents: component.unit_amount_cents,
        tax_rate_basis_points: component.tax_rate_basis_points
      }))
    });
    return components;
  }

  function collectOfferPayload() {
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const category_rules = collectOfferCategoryRules();
    const components = collectOfferComponents();
    const payload = {
      status: normalizeOfferStatus(state.offerDraft.status || state.booking?.offer?.status),
      currency,
      category_rules,
      components
    };
    debugOffer("collect payload", payload);
    return payload;
  }

  async function convertOfferComponentsInBackend(currentCurrency, nextCurrency, components) {
    const request = offerExchangeRatesRequest({ baseURL: apiOrigin });
    const requestBody = {
      from_currency: currentCurrency,
      to_currency: nextCurrency,
      components: components.map((component, index) => ({
        id: component.id || `component_${index}`,
        unit_amount_cents: Number(component.unit_amount_cents || 0),
        category: component.category || "OTHER",
        quantity: Number(component.quantity || 1),
        tax_rate_basis_points: Number(component.tax_rate_basis_points || 1000)
      }))
    };
    const response = await fetchApi(request.url, {
      method: request.method,
      body: requestBody
    });

    const convertedComponentsRaw = Array.isArray(response?.converted_components) ? response.converted_components : null;
    if (!response || !Array.isArray(convertedComponentsRaw)) {
      throw new Error(response?.detail || response?.error || "Offer exchange failed.");
    }
    return {
      convertedComponents: convertedComponentsRaw.map((component, index) => ({
        id: component.id || `component_${index}`,
        unit_amount_cents: Math.max(0, Number(component.unit_amount_cents) || 0),
        line_total_amount_cents: Number.isFinite(Number(component.line_total_amount_cents))
          ? Number(component.line_total_amount_cents)
          : Number(component.line_gross_amount_cents) || 0
      })),
      totalPriceCents: Number.isFinite(Number(response.total_price_cents))
        ? Number(response.total_price_cents)
        : null
    };
  }

  async function handleOfferCurrencyChange() {
    if (!state.booking || !state.offerDraft || !els.offer_currency_input) return;
    if (!isOfferCurrencyEditable()) {
      setSelectValue(els.offer_currency_input, normalizeCurrencyCode(state.offerDraft.currency || "USD"));
      return;
    }

    const nextCurrency = normalizeCurrencyCode(els.offer_currency_input.value);
    const currentCurrency = normalizeCurrencyCode(state.offerDraft.currency || state.booking.preferred_currency || "USD");
    if (!nextCurrency || nextCurrency === currentCurrency) {
      setSelectValue(els.offer_currency_input, currentCurrency);
      return;
    }

    let components;
    try {
      components = collectOfferComponents({ throwOnError: true });
    } catch (error) {
      setOfferStatus(String(error?.message || error));
      setSelectValue(els.offer_currency_input, currentCurrency);
      return;
    }

    const restoreSelectState = () => {
      if (els.offer_currency_input) {
        els.offer_currency_input.disabled = false;
      }
    };
    if (els.offer_currency_input) {
      els.offer_currency_input.disabled = true;
    }
    setOfferStatus("Converting prices...");
    try {
      const converted = await convertOfferComponentsInBackend(currentCurrency, nextCurrency, components);
      const convertedComponents = converted.convertedComponents;
      state.offerDraft.currency = nextCurrency;
      state.offerDraft.components = components.map((component, index) => {
        const convertedComponent = convertedComponents[index] || {};
        return {
          ...component,
          unit_amount_cents:
            Number.isFinite(convertedComponent.unit_amount_cents) && convertedComponent.unit_amount_cents >= 0
              ? convertedComponent.unit_amount_cents
              : component.unit_amount_cents,
          line_total_amount_cents: Number.isFinite(convertedComponent.line_total_amount_cents)
            ? convertedComponent.line_total_amount_cents
            : component.line_total_amount_cents,
          currency: nextCurrency
        };
      });
      if (Number.isFinite(Number(converted.totalPriceCents))) {
        state.offerDraft.total_price_cents = Math.round(Number(converted.totalPriceCents));
      }
      setOfferSaveEnabled(true);
    } catch (error) {
      setOfferStatus(`Exchange rate lookup failed: ${error?.message || error}`);
      restoreSelectState();
      setSelectValue(els.offer_currency_input, currentCurrency);
      return;
    }
    restoreSelectState();
    setOfferStatus("");
    updateOfferCurrencyHint(nextCurrency);
    renderOfferComponentsTable();
    scheduleOfferAutosave();
  }

  function updateOfferCurrencyHint(selectedCurrency) {
    if (!els.offer_currency_hint) return;
    const preferredCurrency = normalizeCurrencyCode(state.booking?.web_form_submission?.preferred_currency || "");
    const currentCurrency = normalizeCurrencyCode(selectedCurrency || state.offerDraft?.currency || state.booking?.preferred_currency || "USD");
    if (!preferredCurrency || preferredCurrency === currentCurrency) {
      els.offer_currency_hint.textContent = "";
      els.offer_currency_hint.hidden = true;
      return;
    }
    els.offer_currency_hint.textContent = `(${preferredCurrency} was preferred in web submission)`;
    els.offer_currency_hint.hidden = false;
  }

  async function saveOffer() {
    if (!state.booking || !state.permissions.canEditBooking) return;
    if (offerAutosaveInFlight) {
      offerAutosavePending = true;
      return offerAutosavePromise;
    }
    clearOfferStatus();
    let offer;
    try {
      offer = collectOfferPayload();
    } catch (error) {
      setOfferStatus(String(error?.message || error));
      return;
    }
    debugOffer("save:start", {
      booking_id: state.booking.id,
      expected_offer_revision: getBookingRevision("offer_revision"),
      offer
    });

    const request = bookingOfferRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    offerAutosaveInFlight = true;
    const runSave = async () => {
      let result;
      try {
        result = await fetchBookingMutation(request.url, {
          method: request.method,
          body: {
            expected_offer_revision: getBookingRevision("offer_revision"),
            offer,
            actor: state.user
          }
        });
      } finally {
        offerAutosaveInFlight = false;
      }
      debugOffer("save:response", result?.booking
        ? {
            unchanged: Boolean(result?.unchanged),
            offer_revision: result.booking.offer_revision,
            offer: {
              currency: result.booking.offer?.currency,
              components: Array.isArray(result.booking.offer?.components)
                ? result.booking.offer.components.map((component) => ({
                    id: component.id,
                    category: component.category,
                    details: component.details,
                    quantity: component.quantity,
                    unit_amount_cents: component.unit_amount_cents
                  }))
                : []
            }
          }
        : result);

      if (!result?.booking) {
        offerPendingRowIndexes = new Set();
        offerTotalPending = false;
        updateOfferTotalsInDom();
        return result;
      }

      await applyOfferBookingResponse(result, { reloadActivities: true });
      setOfferSaveEnabled(false);
      if (offerAutosavePending) {
        offerAutosavePending = false;
        scheduleOfferAutosave();
      }
      return result;
    };
    offerAutosavePromise = runSave();
    const result = await offerAutosavePromise;
    offerAutosavePromise = null;
    debugOffer("save:response", result?.booking
      ? {
          unchanged: Boolean(result?.unchanged),
          offer_revision: result.booking.offer_revision,
          offer: {
            currency: result.booking.offer?.currency,
            components: Array.isArray(result.booking.offer?.components)
              ? result.booking.offer.components.map((component) => ({
                  id: component.id,
                  category: component.category,
                  details: component.details,
                  quantity: component.quantity,
                  unit_amount_cents: component.unit_amount_cents
                }))
              : []
          }
        }
      : result);

    return result;
  }

  return {
    renderOfferPanel,
    addOfferComponent,
    handleOfferCurrencyChange,
    saveOffer
  };
}

function formatPendingMoneyDisplay(currency) {
  const code = normalizeCurrencyCode(currency);
  const definitions = getCurrencyDefinitions();
  const definition = definitions[code] || definitions.USD || { symbol: code };
  const symbol = definition.symbol || code;
  return `${symbol} -.--`;
}
