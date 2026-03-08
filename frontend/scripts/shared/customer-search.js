import {
  escapeHtml,
  formatDateTime,
  normalizeText
} from "./backend-common.js";
import { buildCustomerHref } from "./backend-links.js";

export async function fetchCustomerSearchPage({ fetchApi, page = 1, pageSize = 10, search = "" }) {
  const query = normalizeText(search);
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize)
  });
  if (query) params.set("search", query);
  return fetchApi(`/api/v1/customers?${params.toString()}`);
}

export function renderCustomerTable({
  tableEl,
  items,
  mode = "browse",
  emptyMessage = "No customers found",
  actionLabel = "Select",
  actionColumnFirst = false,
  isActionDisabled = () => false
}) {
  if (!tableEl) return;
  const safeItems = Array.isArray(items) ? items : [];
  const header = mode === "select"
    ? (actionColumnFirst
      ? `<thead><tr><th></th><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Language</th></tr></thead>`
      : `<thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Language</th><th></th></tr></thead>`)
    : `<thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Language</th><th>Updated</th></tr></thead>`;

  const rows = safeItems
    .map((customer) => {
      const customerId = normalizeText(customer.client_id || customer.id);
      const customerHref = buildCustomerHref(customerId);
      const actionCell = mode === "select"
        ? `<button class="btn btn-ghost btn-sm" type="button" data-customer-select="${escapeHtml(customerId)}" ${isActionDisabled(customer) ? "disabled" : ""}>${escapeHtml(actionLabel)}</button>`
        : escapeHtml(formatDateTime(customer.updated_at));
      const baseCells = [
        `<td><a href="${escapeHtml(customerHref)}">${escapeHtml(shortId(customerId))}</a></td>`,
        `<td>${escapeHtml(customer.name || "-")}</td>`,
        `<td>${escapeHtml(customer.email || "-")}</td>`,
        `<td>${escapeHtml(customer.phone_number || "-")}</td>`,
        `<td>${escapeHtml(customer.preferred_language || "-")}</td>`
      ];
      if (mode === "select") {
        const cells = actionColumnFirst
          ? [`<td>${actionCell}</td>`, ...baseCells]
          : [...baseCells, `<td>${actionCell}</td>`];
        return `<tr>${cells.join("")}</tr>`;
      }
      return `<tr>${baseCells.join("")}<td>${actionCell}</td></tr>`;
    })
    .join("");

  const body = rows || `<tr><td colspan="6">${escapeHtml(emptyMessage)}</td></tr>`;
  tableEl.innerHTML = `${header}<tbody>${body}</tbody>`;
}

function shortId(value) {
  const text = normalizeText(value);
  return text ? text.slice(-6) : "-";
}
