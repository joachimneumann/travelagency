import {
  createApiFetcher,
  escapeHtml,
  formatDateTime,
  normalizeText
} from "../shared/api.js?v=39d62af7c93f";
import { buildBookingHref } from "../shared/links.js?v=39d62af7c93f";

const qs = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");

const state = {
  bookings: [],
  persons: [],
  search: normalizeText(qs.get("search"))
};

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  error: document.getElementById("personsError"),
  search: document.getElementById("personsSearch"),
  searchBtn: document.getElementById("personsSearchBtn"),
  clearBtn: document.getElementById("personsClearBtn"),
  countInfo: document.getElementById("personsCountInfo"),
  table: document.getElementById("personsTable")
};

const fetchApi = createApiFetcher({
  apiBase,
  onError: (message) => showError(message)
});

init();

async function init() {
  if (els.homeLink) els.homeLink.href = "backend.html";
  if (els.logoutLink) {
    const returnTo = `${window.location.origin}/index.html`;
    els.logoutLink.href = `${apiBase}/auth/logout?return_to=${encodeURIComponent(returnTo)}`;
  }
  if (els.search) els.search.value = state.search;
  bindControls();
  await loadAuthStatus();
  await loadPersons();
}

function bindControls() {
  if (els.searchBtn) {
    els.searchBtn.addEventListener("click", () => {
      state.search = normalizeText(els.search?.value);
      renderPersonsTable();
    });
  }
  if (els.clearBtn) {
    els.clearBtn.addEventListener("click", () => {
      state.search = "";
      if (els.search) els.search.value = "";
      renderPersonsTable();
    });
  }
  if (els.search) {
    els.search.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      state.search = normalizeText(els.search.value);
      renderPersonsTable();
    });
  }
}

async function loadAuthStatus() {
  try {
    const response = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
    const payload = await response.json();
    if (!response.ok || !payload?.authenticated) {
      if (els.userLabel) els.userLabel.textContent = "";
      return;
    }
    const user = payload.user?.preferred_username || payload.user?.email || payload.user?.sub || "";
    if (els.userLabel) els.userLabel.textContent = user || "";
  } catch {
    if (els.userLabel) els.userLabel.textContent = "";
  }
}

async function loadPersons() {
  clearError();
  if (els.countInfo) els.countInfo.textContent = "Loading...";
  const bookings = await fetchAllBookings();
  if (!bookings) {
    if (els.countInfo) els.countInfo.textContent = "";
    return;
  }
  state.bookings = bookings;
  state.persons = buildPersonsList(bookings);
  renderPersonsTable();
}

async function fetchAllBookings() {
  const items = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const payload = await fetchApi(`/api/v1/bookings?page=${page}&page_size=100&sort=updated_at_desc`);
    if (!payload) return null;
    items.push(...(Array.isArray(payload.items) ? payload.items : []));
    totalPages = Math.max(1, Number(payload.pagination?.total_pages || 1));
    page += 1;
  }

  return items;
}

function buildPersonsList(bookings) {
  return (Array.isArray(bookings) ? bookings : [])
    .flatMap((booking) =>
      getPersonsFromBooking(booking).map((person) => ({
        key: `${normalizeText(booking?.id)}:${normalizeText(person.id)}`,
        booking_id: booking.id,
        booking_label: buildBookingLabel(booking),
        name: person.name || "Unnamed person",
        emails: person.emails,
        phone_numbers: person.phone_numbers,
        roles: person.roles,
        updated_at: booking.updated_at || booking.created_at || ""
      }))
    )
    .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")));
}

function getPersonsFromBooking(booking) {
  const persons = Array.isArray(booking?.persons) ? booking.persons : [];
  const normalizedPersons = persons
    .filter((person) => person && typeof person === "object" && !Array.isArray(person))
    .map((person, index) => ({
      id: normalizeText(person.id) || `${booking?.id || "booking"}_person_${index + 1}`,
      name: normalizeText(person.name) || "",
      emails: collectEmails(person),
      phone_numbers: collectPhoneNumbers(person),
      roles: normalizeStringList(person.roles)
    }))
    .filter((person) => person.name || person.emails.length || person.phone_numbers.length);

  if (normalizedPersons.length) return normalizedPersons;

  const submitted = {
    name: normalizeText(booking?.web_form_submission?.name) || "",
    emails: normalizeText(booking?.web_form_submission?.email) ? [normalizeText(booking.web_form_submission.email)] : [],
    phone_numbers: normalizeText(booking?.web_form_submission?.phone_number)
      ? [normalizeText(booking.web_form_submission.phone_number)]
      : [],
    roles: ["primary_contact"]
  };
  return submitted.name || submitted.emails.length || submitted.phone_numbers.length ? [submitted] : [];
}

function collectEmails(person) {
  return Array.from(new Set((Array.isArray(person?.emails) ? person.emails : []).map((value) => normalizeText(value)).filter(Boolean)));
}

function collectPhoneNumbers(person) {
  return Array.from(new Set((Array.isArray(person?.phone_numbers) ? person.phone_numbers : []).map((value) => normalizeText(value)).filter(Boolean)));
}

function normalizeStringList(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => normalizeText(value)).filter(Boolean)));
}

function buildBookingLabel(booking) {
  return normalizeText(booking?.name) || normalizeText(booking?.id) || "-";
}

function getFilteredPersons() {
  const query = normalizeText(state.search).toLowerCase();
  if (!query) return state.persons;
  return state.persons.filter((person) => {
    const haystack = [
      person.name,
      ...person.emails,
      ...person.phone_numbers,
      ...person.roles,
      person.booking_label
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

function renderPersonsTable() {
  const query = normalizeText(state.search);
  const filtered = getFilteredPersons();
  const totalPersons = state.persons.length;
  const totalBookings = state.bookings.length;

  const params = new URLSearchParams(window.location.search);
  if (query) {
    params.set("search", query);
  } else {
    params.delete("search");
  }
  const nextQuery = params.toString();
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
  window.history.replaceState({}, "", nextUrl);

  if (els.countInfo) {
    els.countInfo.textContent = `${filtered.length} of ${totalPersons} persons across ${totalBookings} bookings`;
  }

  if (!els.table) return;
  const header = "<thead><tr><th>Name</th><th>Contact</th><th>Roles</th><th>Related bookings</th><th>Updated</th></tr></thead>";
  const rows = filtered
    .map((person) => {
      const contact = []
        .concat(person.emails.length ? [`Email: ${escapeHtml(person.emails.join(", "))}`] : [])
        .concat(person.phone_numbers.length ? [`Phone: ${escapeHtml(person.phone_numbers.join(", "))}`] : [])
        .join("<br />");
      return `<tr>
        <td>${escapeHtml(person.name || "-")}</td>
        <td>${contact || "-"}</td>
        <td>${escapeHtml(person.roles.join(", ") || "-")}</td>
        <td><a href="${escapeHtml(buildBookingHref(person.booking_id))}">${escapeHtml(person.booking_label)}</a></td>
        <td>${escapeHtml(formatDateTime(person.updated_at))}</td>
      </tr>`;
    })
    .join("");
  const body = rows || '<tr><td colspan="5">No matching persons</td></tr>';
  els.table.innerHTML = `${header}<tbody>${body}</tbody>`;
}

function showError(message) {
  if (!els.error) return;
  els.error.textContent = message;
  els.error.classList.add("show");
}

function clearError() {
  if (!els.error) return;
  els.error.textContent = "";
  els.error.classList.remove("show");
}
