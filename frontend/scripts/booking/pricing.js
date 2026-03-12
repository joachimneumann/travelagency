import {
  GENERATED_CURRENCIES,
  normalizeCurrencyCode as normalizeGeneratedCurrencyCode
} from "../../Generated/Models/generated_Currency.js";
import { GENERATED_OFFER_CATEGORIES as GENERATED_OFFER_CATEGORY_LIST } from "../../Generated/Models/generated_Booking.js";
import {
  bookingOfferRequest,
  bookingPricingRequest,
  offerExchangeRatesRequest
} from "../../Generated/API/generated_APIRequestFactory.js";

const DEFAULT_OFFER_TAX_RATE_BASIS_POINTS = 1000;

const OFFER_CATEGORIES = GENERATED_OFFER_CATEGORY_LIST.map((code) => ({
  code,
  label: code
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}));

export function getCurrencyDefinitions() {
  return GENERATED_CURRENCIES;
}

export function normalizeCurrencyCode(value) {
  return normalizeGeneratedCurrencyCode(value) || "USD";
}

function currencyDefinition(currency) {
  const code = normalizeCurrencyCode(currency);
  const definitions = getCurrencyDefinitions();
  const definition = definitions[code] || definitions.USD || { symbol: code, decimalPlaces: 2 };
  return {
    code,
    symbol: definition.symbol || code,
    decimalPlaces: Number.isFinite(Number(definition.decimal_places ?? definition.decimalPlaces))
      ? Number(definition.decimal_places ?? definition.decimalPlaces)
      : 2
  };
}

function currencyDecimalPlaces(currency) {
  return currencyDefinition(currency).decimalPlaces;
}

export function isWholeUnitCurrency(currency) {
  return currencyDecimalPlaces(currency) === 0;
}

export function populateCurrencySelect(selectEl) {
  if (!(selectEl instanceof HTMLSelectElement)) return;
  const definitions = getCurrencyDefinitions();
  const selectedValue = normalizeCurrencyCode(selectEl.value || "USD");
  selectEl.innerHTML = Object.keys(definitions)
    .map((code) => `<option value="${code}">${code}</option>`)
    .join("");
  selectEl.value = selectedValue;
}

export function populateOfferCategorySelect(selectEl, escapeHtml) {
  if (!(selectEl instanceof HTMLSelectElement)) return;
  const currentValue = String(selectEl.value || "").trim().toUpperCase();
  selectEl.innerHTML = [
    '<option value="" selected disabled>Category</option>',
    ...OFFER_CATEGORIES.map((category) => `<option value="${escapeHtml(category.code)}">${escapeHtml(category.label)}</option>`)
  ].join("");
  if (currentValue && OFFER_CATEGORIES.some((category) => category.code === currentValue)) {
    selectEl.value = currentValue;
  }
}

export function formatMoneyDisplay(value, currency) {
  const amount = Number(value || 0);
  const definition = currencyDefinition(currency);
  if (!Number.isFinite(amount)) return "-";
  const major = amount / 10 ** definition.decimalPlaces;
  return `${definition.symbol} ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: definition.decimalPlaces,
    maximumFractionDigits: definition.decimalPlaces,
    useGrouping: true
  }).format(major)}`;
}

export function formatMoneyInputValue(value, currency) {
  const amount = Number(value || 0);
  const definition = currencyDefinition(currency);
  if (!Number.isFinite(amount)) return "0";
  if (definition.decimalPlaces === 0) return String(Math.round(amount));
  return (amount / 10 ** definition.decimalPlaces).toFixed(definition.decimalPlaces);
}

export function parseMoneyInputValue(value, currency) {
  const definition = currencyDefinition(currency);
  const normalized = String(value || "0").trim().replace(",", ".");
  const amount = Number(normalized || "0");
  if (!Number.isFinite(amount)) return NaN;
  if (definition.decimalPlaces === 0) return Math.round(amount);
  return Math.round(amount * 10 ** definition.decimalPlaces);
}

export function setSelectValue(selectEl, rawValue) {
  if (!selectEl) return;
  const value = normalizeCurrencyCode(rawValue || "USD");
  const hasOption = Array.from(selectEl.options).some((option) => option.value === value);
  if (!hasOption) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  }
  selectEl.value = value;
}

export function createBookingPricingModule(ctx) {
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
    captureControlSnapshot,
    setBookingSectionDirty
  } = ctx;

  function setPricingStatus(message) {
    if (!els.pricing_status) return;
    els.pricing_status.textContent = message;
  }

  function clearPricingStatus() {
    setPricingStatus("");
  }

  function setOfferStatus(message) {
    if (!els.offer_status) return;
    els.offer_status.textContent = message;
  }

  function clearOfferStatus() {
    setOfferStatus("");
  }

  function setOfferSaveEnabled(enabled) {
    if (!els.offer_save_btn) return;
    els.offer_save_btn.disabled = !enabled || !state.permissions.canEditBooking;
    setBookingSectionDirty("offer", Boolean(enabled) && state.permissions.canEditBooking);
  }

  function updatePricingDirtyState() {
    const isDirty =
      state.permissions.canEditBooking &&
      captureControlSnapshot(els.pricing_panel) !== state.originalPricingSnapshot;
    setBookingSectionDirty("pricing", isDirty);
  }

  function markPricingSnapshotClean() {
    state.originalPricingSnapshot = captureControlSnapshot(els.pricing_panel);
    setBookingSectionDirty("pricing", false);
  }

  function defaultOfferCategoryRules() {
    return OFFER_CATEGORIES.map((category) => ({
      category: category.code,
      tax_rate_basis_points: DEFAULT_OFFER_TAX_RATE_BASIS_POINTS
    }));
  }

  function clonePricing(pricing) {
    return JSON.parse(
      JSON.stringify({
        currency: pricing.currency || "USD",
        agreed_net_amount_cents: pricing.agreed_net_amount_cents || 0,
        adjustments: Array.isArray(pricing.adjustments) ? pricing.adjustments : [],
        payments: Array.isArray(pricing.payments) ? pricing.payments : [],
        summary: pricing.summary || {}
      })
    );
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

  function renderPricingSummaryTable(pricing) {
    if (!els.pricing_summary_table) return;
    const summary = pricing.summary || {};
    const moneyRows = [
      ["agreed_net_amount", pricing.agreed_net_amount_cents],
      ["adjustments_delta", summary.adjustments_delta_cents],
      ["adjusted_net_amount", summary.adjusted_net_amount_cents],
      ["scheduled_net_amount", summary.scheduled_net_amount_cents],
      ["unscheduled_net_amount", summary.unscheduled_net_amount_cents],
      ["scheduled_tax_amount", summary.scheduled_tax_amount_cents],
      ["scheduled_gross_amount", summary.scheduled_gross_amount_cents],
      ["paid_gross_amount", summary.paid_gross_amount_cents],
      ["outstanding_gross_amount", summary.outstanding_gross_amount_cents]
    ]
      .filter(([, value]) => Number(value || 0) !== 0)
      .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(formatMoneyDisplay(value, pricing.currency))}</td></tr>`);
    const rows = []
      .concat(moneyRows)
      .concat(summary.is_schedule_balanced === false ? ['<tr><th>schedule_balanced</th><td>no</td></tr>'] : [])
      .join("");
    els.pricing_summary_table.innerHTML = `<tbody>${rows || '<tr><td colspan="2">No payment totals yet</td></tr>'}</tbody>`;
  }

  function addPricingAdjustmentRow() {
    state.pricingDraft.adjustments.push({
      id: "",
      type: "DISCOUNT",
      label: "",
      amount_cents: 0,
      notes: null
    });
    renderPricingAdjustmentsTable();
  }

  function removePricingAdjustmentRow(index) {
    state.pricingDraft.adjustments.splice(index, 1);
    renderPricingAdjustmentsTable();
  }

  function addPricingPaymentRow() {
    state.pricingDraft.payments.push({
      id: "",
      label: "",
      due_date: null,
      net_amount_cents: 0,
      tax_rate_basis_points: 0,
      status: "PENDING",
      paid_at: null,
      notes: null
    });
    renderPricingPaymentsTable();
  }

  function removePricingPaymentRow(index) {
    state.pricingDraft.payments.splice(index, 1);
    renderPricingPaymentsTable();
  }

  function renderPricingAdjustmentsTable() {
    if (!els.pricing_adjustments_table) return;
    const readOnly = !state.permissions.canEditBooking;
    const items = Array.isArray(state.pricingDraft.adjustments) ? state.pricingDraft.adjustments : [];
    const currency = normalizeCurrencyCode(state.pricingDraft.currency);
    const header = `<thead><tr><th>Label</th><th>Type</th><th>Amount (${escapeHtml(currency)})</th><th>Notes</th>${readOnly ? "" : "<th></th>"}</tr></thead>`;
    const rows = items
      .map((item, index) => `<tr>
      <td><input data-pricing-adjustment-label="${index}" type="text" value="${escapeHtml(item.label || "")}" ${readOnly ? "disabled" : ""} /></td>
      <td>
        <select data-pricing-adjustment-type="${index}" ${readOnly ? "disabled" : ""}>
          ${["DISCOUNT", "CREDIT", "SURCHARGE"].map((type) => `<option value="${type}" ${item.type === type ? "selected" : ""}>${type}</option>`).join("")}
        </select>
      </td>
      <td><input data-pricing-adjustment-amount="${index}" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(item.amount_cents || 0, currency))}" ${readOnly ? "disabled" : ""} /></td>
      <td><input data-pricing-adjustment-notes="${index}" type="text" value="${escapeHtml(item.notes || "")}" ${readOnly ? "disabled" : ""} /></td>
      ${readOnly ? "" : `<td><button class="btn btn-ghost" type="button" data-pricing-remove-adjustment="${index}">Remove</button></td>`}
    </tr>`)
      .join("");
    const addRow = readOnly ? "" : '<tr><td colspan="5"><button class="btn btn-ghost" type="button" data-pricing-add-adjustment>Add</button></td></tr>';
    const body = (rows || `<tr><td colspan="${readOnly ? 4 : 5}">No adjustments</td></tr>`) + addRow;
    els.pricing_adjustments_table.innerHTML = `${header}<tbody>${body}</tbody>`;
    if (!readOnly) {
      els.pricing_adjustments_table.querySelectorAll("[data-pricing-remove-adjustment]").forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number(button.getAttribute("data-pricing-remove-adjustment"));
          removePricingAdjustmentRow(index);
        });
      });
      els.pricing_adjustments_table.querySelector("[data-pricing-add-adjustment]")?.addEventListener("click", addPricingAdjustmentRow);
    }
  }

  function renderPricingPaymentsTable() {
    if (!els.pricing_payments_table) return;
    const readOnly = !state.permissions.canEditBooking;
    const items = Array.isArray(state.pricingDraft.payments) ? state.pricingDraft.payments : [];
    const currency = normalizeCurrencyCode(state.pricingDraft.currency);
    const header = `<thead><tr><th>Label</th><th>Due Date</th><th>Net (${escapeHtml(currency)})</th><th>Tax %</th><th>Status</th><th>Paid At</th><th>Notes</th>${readOnly ? "" : "<th></th>"}</tr></thead>`;
    const rows = items
      .map((item, index) => `<tr>
      <td><input data-pricing-payment-label="${index}" type="text" value="${escapeHtml(item.label || "")}" ${readOnly ? "disabled" : ""} /></td>
      <td><input data-pricing-payment-due-date="${index}" type="date" value="${escapeHtml(item.due_date || "")}" ${readOnly ? "disabled" : ""} /></td>
      <td><input data-pricing-payment-net="${index}" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(item.net_amount_cents || 0, currency))}" ${readOnly ? "disabled" : ""} /></td>
      <td><input data-pricing-payment-tax="${index}" type="number" min="0" max="100" step="0.01" value="${escapeHtml(formatTaxRatePercent(item.tax_rate_basis_points))}" ${readOnly ? "disabled" : ""} /></td>
      <td>
        <select data-pricing-payment-status="${index}" ${readOnly ? "disabled" : ""}>
          ${["PENDING", "PAID"].map((status) => `<option value="${status}" ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </td>
      <td><input data-pricing-payment-paid-at="${index}" type="datetime-local" value="${escapeHtml(normalizeDateTimeLocal(item.paid_at))}" ${readOnly ? "disabled" : ""} /></td>
      <td><input data-pricing-payment-notes="${index}" type="text" value="${escapeHtml(item.notes || "")}" ${readOnly ? "disabled" : ""} /></td>
      ${readOnly ? "" : `<td><button class="btn btn-ghost" type="button" data-pricing-remove-payment="${index}">Remove</button></td>`}
    </tr>`)
      .join("");
    const addRow = readOnly ? "" : '<tr><td colspan="8"><button class="btn btn-ghost" type="button" data-pricing-add-payment>Add</button></td></tr>';
    const body = (rows || `<tr><td colspan="${readOnly ? 7 : 8}">No payments scheduled</td></tr>`) + addRow;
    els.pricing_payments_table.innerHTML = `${header}<tbody>${body}</tbody>`;
    if (!readOnly) {
      els.pricing_payments_table.querySelectorAll("[data-pricing-remove-payment]").forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number(button.getAttribute("data-pricing-remove-payment"));
          removePricingPaymentRow(index);
        });
      });
      els.pricing_payments_table.querySelectorAll("[data-pricing-payment-status]").forEach((select) => {
        select.addEventListener("change", () => {
          const index = Number(select.getAttribute("data-pricing-payment-status"));
          const paidAtInput = document.querySelector(`[data-pricing-payment-paid-at="${index}"]`);
          if (String(select.value || "").toUpperCase() === "PAID" && paidAtInput && !paidAtInput.value) {
            paidAtInput.value = normalizeDateTimeLocal(new Date().toISOString());
          }
        });
      });
      els.pricing_payments_table.querySelector("[data-pricing-add-payment]")?.addEventListener("click", addPricingPaymentRow);
    }
  }

  function renderPricingPanel() {
    if (!els.pricing_panel || !state.booking) return;
    const pricing = clonePricing(state.booking.pricing || {});
    state.pricingDraft = pricing;
    const currency = normalizeCurrencyCode(pricing.currency);

    if (els.pricing_currency_input) {
      els.pricing_currency_input.value = currency;
      els.pricing_currency_input.disabled = !state.permissions.canEditBooking;
    }
    if (els.pricing_agreed_net_label) {
      els.pricing_agreed_net_label.textContent = `Agreed Net Amount (${currency})`;
    }
    if (els.pricing_agreed_net_input) {
      els.pricing_agreed_net_input.value = formatMoneyInputValue(pricing.agreed_net_amount_cents || 0, currency);
      els.pricing_agreed_net_input.disabled = !state.permissions.canEditBooking;
    }
    if (els.pricing_save_btn) els.pricing_save_btn.style.display = state.permissions.canEditBooking ? "" : "none";

    renderPricingSummaryTable(pricing);
    renderPricingAdjustmentsTable();
    renderPricingPaymentsTable();
    clearPricingStatus();
    markPricingSnapshotClean();
  }

  function addOfferComponentFromSelector() {
    if (!state.permissions.canEditBooking || !state.offerDraft) return;
    const selectedCategory = els.offer_component_category_select?.value || "";
    if (!selectedCategory) return;
    const category = normalizeOfferCategory(selectedCategory);
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
    setOfferSaveEnabled(true);
    renderOfferComponentsTable();
  }

  function renderOfferPanel() {
    if (!els.offer_panel || !state.booking) return;
    const offer = cloneOffer(state.booking.offer || {});
    state.offerDraft = offer;
    const currency = normalizeCurrencyCode(offer.currency || state.booking.preferred_currency || "USD");
    state.offerDraft.currency = currency;

    if (els.offer_currency_input) {
      setSelectValue(els.offer_currency_input, currency);
      els.offer_currency_input.disabled = !state.permissions.canEditBooking;
    }
    if (els.offer_component_category_select) {
      els.offer_component_category_select.disabled = !state.permissions.canEditBooking;
      if (state.permissions.canEditBooking) {
        els.offer_component_category_select.value = "";
      }
    }
    if (els.offer_add_component_btn) {
      els.offer_add_component_btn.style.display = state.permissions.canEditBooking ? "" : "none";
    }
    if (els.offer_save_btn) els.offer_save_btn.style.display = state.permissions.canEditBooking ? "" : "none";
    setOfferSaveEnabled(false);

    renderOfferComponentsTable();
    clearOfferStatus();
  }

  function renderOfferComponentsTable() {
    if (!els.offer_components_table) return;
    const readOnly = !state.permissions.canEditBooking;
    const showActionsCol = !readOnly;
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const offerComponents = Array.isArray(state.offerDraft?.components) ? state.offerDraft.components : [];
    const hasMultiQuantityComponent = offerComponents.some((component) => Math.max(1, Number(component?.quantity || 1)) !== 1);
    const showDualPrice = hasMultiQuantityComponent;
    const priceHeaders = showDualPrice
      ? `<th class="offer-col-price-single">PRICE (SINGLE, ${escapeHtml(currency)})</th><th class="offer-col-price-total">PRICE (with TAX, ${escapeHtml(currency)})</th>`
      : `<th class="offer-col-price-total">PRICE (with TAX, ${escapeHtml(currency)})</th>`;
    const actionHeader = showActionsCol ? '<th class="offer-col-actions"></th>' : "";
    const header = `<thead><tr><th class="offer-col-category">Category</th><th class="offer-col-details">Details</th><th class="offer-col-qty">Quantity</th>${priceHeaders}${actionHeader}</tr></thead>`;
    const rows = offerComponents
      .map((component, index) => {
        const quantity = Math.max(1, Number(component.quantity || 1));
        const unitAmount = Math.max(0, Number(component.unit_amount_cents || 0));
        const rawLineTotal = computeOfferComponentLineTotals(component).gross_amount_cents;
        const componentTotalText = formatMoneyDisplay(Math.round(rawLineTotal), currency);
        const taxRateBasisPoints = Number(component?.tax_rate_basis_points || 0);
        const taxLabel = `Tax: ${formatTaxRatePercent(taxRateBasisPoints)}%`;
        const removeButton = showActionsCol
          ? `<button class="btn btn-ghost offer-remove-btn" type="button" data-offer-remove-component="${index}" title="Remove offer component" aria-label="Remove offer component">×</button>`
          : "";
        const singleInput = `<input data-offer-component-unit="${index}" type="number" min="0" step="${isWholeUnitCurrency(currency) ? "1" : "0.01"}" value="${escapeHtml(formatMoneyInputValue(unitAmount, currency))}" ${readOnly ? "disabled" : ""} />`;
        const totalPriceCell = showDualPrice
          ? `<td class="offer-col-price-total"><div class="offer-total-cell"><span class="offer-price-value">${escapeHtml(componentTotalText)}</span></div></td>`
          : `<td class="offer-col-price-total"><div class="offer-total-cell"><span class="offer-price-value">${singleInput}</span></div></td>`;
        const unitInputCell = showDualPrice ? `<td class="offer-col-price-single">${singleInput}</td>` : "";
        const actionCell = showActionsCol ? `<td class="offer-col-actions">${removeButton}</td>` : "";
        const priceCells = showDualPrice ? `${unitInputCell}${totalPriceCell}` : totalPriceCell;
        return `<tr>
      <td class="offer-col-category">
        <div>${escapeHtml(offerCategoryLabel(component.category))}</div>
        <div class="offer-category-tax">${escapeHtml(taxLabel)}</div>
      </td>
      <td class="offer-col-details"><textarea data-offer-component-details="${index}" rows="2" ${readOnly ? "disabled" : ""}>${escapeHtml(component.details || component.description || "")}</textarea></td>
      <td class="offer-col-qty"><input data-offer-component-quantity="${index}" type="number" min="1" step="1" value="${escapeHtml(String(quantity))}" ${readOnly ? "disabled" : ""} /></td>
      ${priceCells}${actionCell}
    </tr>`;
      })
      .join("");
    const offerTotalValue = formatMoneyDisplay(resolveOfferTotalCents(), currency);
    const columns = 3 + (showDualPrice ? 2 : 1) + (showActionsCol ? 1 : 0);
    const noRows = `<tr><td colspan="${columns}" style="padding-top:50px;padding-bottom:50px;">no components yet</td></tr>`;
    const totalAlignCols = 3 + (showDualPrice ? 1 : 0);
    const totalCellOffset = `<td colspan="${totalAlignCols}"></td>`;
    const totalRow = `<tr>${totalCellOffset}<td class="offer-col-price-total"><div class="offer-total-sum"><strong class="offer-total-value">Total with Tax: ${escapeHtml(offerTotalValue)}</strong></div></td>${showActionsCol ? '<td class="offer-col-actions"></td>' : ""}</tr>`;
    const body = rows || noRows;
    els.offer_components_table.innerHTML = `${header}<tbody>${body}</tbody>`;
    if (els.offer_components_total_table) {
      els.offer_components_total_table.innerHTML = `<tbody>${totalRow}</tbody>`;
    } else {
      els.offer_components_table.insertAdjacentHTML("beforeend", `<tbody>${totalRow}</tbody>`);
    }

    if (!readOnly) {
      const syncOfferInputTotals = () => {
        state.offerDraft.components = readOfferDraftComponentsForRender();
        state.offerDraft.total_price_cents = null;
        setOfferSaveEnabled(true);
        renderOfferComponentsTable();
      };
      els.offer_components_table.querySelectorAll("[data-offer-remove-component]").forEach((button) => {
        button.addEventListener("click", () => {
          const index = Number(button.getAttribute("data-offer-remove-component"));
          if (!window.confirm("Remove this offer component?")) {
            return;
          }
          state.offerDraft.components.splice(index, 1);
          setOfferSaveEnabled(true);
          renderOfferComponentsTable();
        });
      });
      els.offer_components_table.querySelectorAll("[data-offer-component-details], [data-offer-component-quantity], [data-offer-component-unit]").forEach((input) => {
        input.addEventListener("change", syncOfferInputTotals);
      });
    }
  }

  function collectPricingPayload() {
    const currency = normalizeCurrencyCode(els.pricing_currency_input?.value || "USD");
    const agreedNet = parseMoneyInputValue(els.pricing_agreed_net_input?.value || "0", currency);
    if (!currency) throw new Error("Currency is required.");
    if (!Number.isFinite(agreedNet) || agreedNet < 0) throw new Error("Agreed net amount must be zero or positive.");

    const adjustments = Array.from(document.querySelectorAll("[data-pricing-adjustment-label]")).map((input) => {
      const index = Number(input.getAttribute("data-pricing-adjustment-label"));
      const type = String(document.querySelector(`[data-pricing-adjustment-type="${index}"]`)?.value || "DISCOUNT").trim().toUpperCase();
      const label = String(document.querySelector(`[data-pricing-adjustment-label="${index}"]`)?.value || "").trim();
      const amount = parseMoneyInputValue(document.querySelector(`[data-pricing-adjustment-amount="${index}"]`)?.value || "0", currency);
      const notes = String(document.querySelector(`[data-pricing-adjustment-notes="${index}"]`)?.value || "").trim();
      if (!label) throw new Error(`Adjustment ${index + 1} requires a label.`);
      if (!["DISCOUNT", "CREDIT", "SURCHARGE"].includes(type)) throw new Error(`Adjustment ${index + 1} has an invalid type.`);
      if (!Number.isFinite(amount) || amount < 0) throw new Error(`Adjustment ${index + 1} requires a valid non-negative amount.`);
      return {
        id: state.pricingDraft.adjustments[index]?.id || "",
        type,
        label,
        amount_cents: Math.round(amount),
        notes: notes || null
      };
    });

    const payments = Array.from(document.querySelectorAll("[data-pricing-payment-label]")).map((input) => {
      const index = Number(input.getAttribute("data-pricing-payment-label"));
      const label = String(document.querySelector(`[data-pricing-payment-label="${index}"]`)?.value || "").trim();
      const dueDate = String(document.querySelector(`[data-pricing-payment-due-date="${index}"]`)?.value || "").trim();
      const netAmount = parseMoneyInputValue(document.querySelector(`[data-pricing-payment-net="${index}"]`)?.value || "0", currency);
      const taxPercent = Number(document.querySelector(`[data-pricing-payment-tax="${index}"]`)?.value || "0");
      const status = String(document.querySelector(`[data-pricing-payment-status="${index}"]`)?.value || "PENDING").trim().toUpperCase();
      const paidAtInputValue = document.querySelector(`[data-pricing-payment-paid-at="${index}"]`)?.value || "";
      const paidAt = normalizeLocalDateTimeToIso(
        paidAtInputValue || (status === "PAID" ? normalizeDateTimeLocal(new Date().toISOString()) : "")
      );
      const notes = String(document.querySelector(`[data-pricing-payment-notes="${index}"]`)?.value || "").trim();
      if (!label) throw new Error(`Payment ${index + 1} requires a label.`);
      if (!Number.isFinite(netAmount) || netAmount < 0) throw new Error(`Payment ${index + 1} requires a valid non-negative net amount.`);
      if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) throw new Error(`Payment ${index + 1} requires a tax rate between 0 and 100.`);
      if (!["PENDING", "PAID"].includes(status)) throw new Error(`Payment ${index + 1} has an invalid status.`);
      if (status === "PAID" && !paidAt) throw new Error(`Payment ${index + 1} needs a paid time when marked paid.`);
      return {
        id: state.pricingDraft.payments[index]?.id || "",
        label,
        due_date: dueDate || null,
        net_amount_cents: Math.round(netAmount),
        tax_rate_basis_points: Math.round(taxPercent * 100),
        status,
        paid_at: paidAt || null,
        notes: notes || null
      };
    });

    return {
      currency,
      agreed_net_amount_cents: Math.round(agreedNet),
      adjustments,
      payments
    };
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
      const category = normalizeOfferCategory(state.offerDraft?.components[index]?.category || "OTHER");
      const details = String(document.querySelector(`[data-offer-component-details="${index}"]`)?.value || "").trim();
      const quantity = Number(document.querySelector(`[data-offer-component-quantity="${index}"]`)?.value || "1");
      const unitAmount = parseMoneyInputValue(document.querySelector(`[data-offer-component-unit="${index}"]`)?.value || "0", currency);
      const label = String(offerCategoryLabel(category)).trim();
      const notes = String(state.offerDraft?.components[index]?.notes || "").trim();
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
    return components;
  }

  function collectOfferPayload() {
    const currency = normalizeCurrencyCode(state.offerDraft.currency || state.booking?.preferred_currency || "USD");
    const category_rules = collectOfferCategoryRules();
    const components = collectOfferComponents();
    return {
      currency,
      category_rules,
      components
    };
  }

  async function convertOfferComponentsInBackend(currentCurrency, nextCurrency, components) {
    const request = offerExchangeRatesRequest({ baseURL: apiOrigin });
    const response = await fetchApi(request.url, {
      method: request.method,
      body: {
        from_currency: currentCurrency,
        to_currency: nextCurrency,
        components: components.map((component, index) => ({
          id: component.id || `component_${index}`,
          unit_amount_cents: Number(component.unit_amount_cents || 0),
          category: component.category || "OTHER",
          quantity: Number(component.quantity || 1),
          tax_rate_basis_points: Number(component.tax_rate_basis_points || 1000)
        }))
      }
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
    if (!state.permissions.canEditBooking) {
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
    renderOfferComponentsTable();
  }

  async function savePricing() {
    if (!state.booking || !state.permissions.canEditBooking) return;
    clearPricingStatus();
    let pricing;
    try {
      pricing = collectPricingPayload();
    } catch (error) {
      setPricingStatus(String(error?.message || error));
      return;
    }

    const request = bookingPricingRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_pricing_revision: getBookingRevision("pricing_revision"),
        pricing,
        actor: state.user
      }
    });
    if (!result?.booking) return;
    state.booking = result.booking;
    renderBookingHeader();
    renderBookingData();
    renderPricingPanel();
    await loadActivities();
  }

  async function saveOffer() {
    if (!state.booking || !state.permissions.canEditBooking) return;
    clearOfferStatus();
    let offer;
    try {
      offer = collectOfferPayload();
    } catch (error) {
      setOfferStatus(String(error?.message || error));
      return;
    }

    const request = bookingOfferRequest({ baseURL: apiOrigin, params: { booking_id: state.booking.id } });
    const result = await fetchBookingMutation(request.url, {
      method: request.method,
      body: {
        expected_offer_revision: getBookingRevision("offer_revision"),
        offer,
        actor: state.user
      }
    });

    if (!result?.booking) {
      return;
    }

    state.booking = result.booking;
    renderBookingHeader();
    renderBookingData();
    renderOfferPanel();
    setOfferSaveEnabled(false);
    await loadActivities();
  }

  return {
    updatePricingDirtyState,
    markPricingSnapshotClean,
    renderPricingPanel,
    renderOfferPanel,
    addOfferComponentFromSelector,
    handleOfferCurrencyChange,
    savePricing,
    saveOffer
  };
}

function normalizeDateTimeLocal(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function formatTaxRatePercent(value) {
  const basisPoints = Number(value || 0);
  if (!Number.isFinite(basisPoints)) return "0";
  return (basisPoints / 100).toFixed(2).replace(/\\.00$/, "");
}
