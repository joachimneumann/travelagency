import {
  createApiFetcher,
  escapeHtml,
  formatDateTime,
  normalizeText
} from "./shared/backend-common.js";
import { buildBookingHref } from "./shared/backend-links.js";

const qs = new URLSearchParams(window.location.search);
const apiBase = (window.ASIATRAVELPLAN_API_BASE || "").replace(/\/$/, "");

const state = {
  bookings: [],
  people: [],
  search: normalizeText(qs.get("search"))
};

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  logoutLink: document.getElementById("backendLogoutLink"),
  userLabel: document.getElementById("backendUserLabel"),
  error: document.getElementById("peopleError"),
  search: document.getElementById("peopleSearch"),
  searchBtn: document.getElementById("peopleSearchBtn"),
  clearBtn: document.getElementById("peopleClearBtn"),
  countInfo: document.getElementById("peopleCountInfo"),
  table: document.getElementById("peopleTable")
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
  await loadPeople();
}

function bindControls() {
  if (els.searchBtn) {
    els.searchBtn.addEventListener("click", () => {
      state.search = normalizeText(els.search?.value);
      renderPeopleTable();
    });
  }
  if (els.clearBtn) {
    els.clearBtn.addEventListener("click", () => {
      state.search = "";
      if (els.search) els.search.value = "";
      renderPeopleTable();
    });
  }
  if (els.search) {
    els.search.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      state.search = normalizeText(els.search.value);
      renderPeopleTable();
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

async function loadPeople() {
  clearError();
  if (els.countInfo) els.countInfo.textContent = "Loading...";
  const bookings = await fetchAllBookings();
  if (!bookings) {
    if (els.countInfo) els.countInfo.textContent = "";
    return;
  }
  state.bookings = bookings;
  state.people = buildPeopleIndex(bookings);
  renderPeopleTable();
}

async function fetchAllBookings() {
  const items = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const payload = await fetchApi(`/api/v1/bookings?page=${page}&page_size=100&sort=updated_at_desc`);
    if (!payload) return null;
    items.push(...(Array.isArray(payload.items) ? payload.items : []));
    totalPages = Math.max(1, Number(payload.total_pages || 1));
    page += 1;
  }

  return items;
}

function buildPeopleIndex(bookings) {
  const byKey = new Map();

  for (const booking of Array.isArray(bookings) ? bookings : []) {
    for (const person of getPeopleFromBooking(booking)) {
      const key = buildPersonGroupKey(person, booking);
      const existing = byKey.get(key) || {
        key,
        name: person.name || "Unnamed person",
        emails: new Set(),
        phoneNumbers: new Set(),
        roles: new Set(),
        bookings: new Map(),
        updatedAt: booking.updated_at || booking.created_at || ""
      };

      if (!existing.name && person.name) existing.name = person.name;
      person.emails.forEach((value) => existing.emails.add(value));
      person.phone_numbers.forEach((value) => existing.phoneNumbers.add(value));
      person.roles.forEach((value) => existing.roles.add(value));
      existing.bookings.set(booking.id, {
        id: booking.id,
        label: buildBookingLabel(booking),
        updated_at: booking.updated_at || booking.created_at || ""
      });
      if (String(booking.updated_at || booking.created_at || "") > String(existing.updatedAt || "")) {
        existing.updatedAt = booking.updated_at || booking.created_at || "";
      }
      byKey.set(key, existing);
    }
  }

  return [...byKey.values()]
    .map((person) => ({
      ...person,
      emails: [...person.emails],
      phoneNumbers: [...person.phoneNumbers],
      roles: [...person.roles],
      bookings: [...person.bookings.values()].sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")))
    }))
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
}

function getPeopleFromBooking(booking) {
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
  return Array.from(
    new Set(
      [person?.email, ...(Array.isArray(person?.emails) ? person.emails : [])]
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
  );
}

function collectPhoneNumbers(person) {
  return Array.from(
    new Set(
      [person?.phone_number, person?.phone, ...(Array.isArray(person?.phone_numbers) ? person.phone_numbers : [])]
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
  );
}

function normalizeStringList(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => normalizeText(value)).filter(Boolean)));
}

function buildPersonGroupKey(person, booking) {
  const emailKey = [...person.emails].sort().join("|");
  if (emailKey) return `email:${emailKey}`;
  const phoneKey = [...person.phone_numbers].sort().join("|");
  if (phoneKey) return `phone:${phoneKey}`;
  const nameKey = normalizeText(person.name).toLowerCase();
  if (nameKey) return `name:${nameKey}`;
  return `booking:${normalizeText(booking?.id)}:person:${normalizeText(person.id)}`;
}

function buildBookingLabel(booking) {
  const destination = Array.isArray(booking?.destination) ? booking.destination.join(", ") : normalizeText(booking?.destination);
  return destination ? `${booking.id} (${destination})` : String(booking?.id || "-");
}

function getFilteredPeople() {
  const query = normalizeText(state.search).toLowerCase();
  if (!query) return state.people;
  return state.people.filter((person) => {
    const haystack = [
      person.name,
      ...person.emails,
      ...person.phoneNumbers,
      ...person.roles,
      ...person.bookings.map((booking) => booking.label)
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

function renderPeopleTable() {
  const query = normalizeText(state.search);
  const filtered = getFilteredPeople();
  const totalPeople = state.people.length;
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
    els.countInfo.textContent = `${filtered.length} of ${totalPeople} people across ${totalBookings} bookings`;
  }

  if (!els.table) return;
  const header = "<thead><tr><th>Name</th><th>Contact</th><th>Roles</th><th>Related bookings</th><th>Updated</th></tr></thead>";
  const rows = filtered
    .map((person) => {
      const contact = []
        .concat(person.emails.length ? [`Email: ${escapeHtml(person.emails.join(", "))}`] : [])
        .concat(person.phoneNumbers.length ? [`Phone: ${escapeHtml(person.phoneNumbers.join(", "))}`] : [])
        .join("<br />");
      const bookingLinks = person.bookings
        .map((booking) => `<a href="${escapeHtml(buildBookingHref(booking.id))}">${escapeHtml(booking.label)}</a>`)
        .join("<br />");
      return `<tr>
        <td>${escapeHtml(person.name || "-")}</td>
        <td>${contact || "-"}</td>
        <td>${escapeHtml(person.roles.join(", ") || "-")}</td>
        <td>${bookingLinks || "-"}</td>
        <td>${escapeHtml(formatDateTime(person.updatedAt))}</td>
      </tr>`;
    })
    .join("");
  const body = rows || '<tr><td colspan="5">No matching people</td></tr>';
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
