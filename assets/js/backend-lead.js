const qs = new URLSearchParams(window.location.search);
const apiBase = (window.CHAPTER2_API_BASE || "").replace(/\/$/, "");

const STAGES = ["NEW", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST", "POST_TRIP"];

const state = {
  type: qs.get("type") || "lead",
  id: qs.get("id") || "",
  user: qs.get("user") || "admin",
  lead: null,
  customer: null,
  staff: []
};

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  back: document.getElementById("backToBackend"),
  logoutLink: document.getElementById("backendLogoutLink"),
  title: document.getElementById("detailTitle"),
  subtitle: document.getElementById("detailSubTitle"),
  error: document.getElementById("detailError"),
  leadDataView: document.getElementById("leadDataView"),
  actionsPanel: document.getElementById("leadActionsPanel"),
  ownerSelect: document.getElementById("leadOwnerSelect"),
  ownerSaveBtn: document.getElementById("leadOwnerSaveBtn"),
  stageSelect: document.getElementById("leadStageSelect"),
  stageSaveBtn: document.getElementById("leadStageSaveBtn"),
  noteInput: document.getElementById("leadNoteInput"),
  noteSaveBtn: document.getElementById("leadNoteSaveBtn"),
  actionStatus: document.getElementById("leadActionStatus"),
  activitiesTable: document.getElementById("activitiesTable")
};

init();

function init() {
  const backParams = new URLSearchParams({ user: state.user });
  const backHref = `backend.html?${backParams.toString()}`;

  if (els.homeLink) els.homeLink.href = backHref;
  if (els.back) els.back.href = backHref;
  if (els.logoutLink) {
    const returnTo = `${window.location.origin}/index.html`;
    els.logoutLink.href = `${apiBase}/auth/logout?global=true&return_to=${encodeURIComponent(returnTo)}`;
  }

  if (els.ownerSaveBtn) els.ownerSaveBtn.addEventListener("click", saveOwner);
  if (els.stageSaveBtn) els.stageSaveBtn.addEventListener("click", saveStage);
  if (els.noteSaveBtn) els.noteSaveBtn.addEventListener("click", addNote);

  if (!state.id) {
    showError("Missing record id.");
    return;
  }

  if (state.type === "customer") {
    if (els.actionsPanel) els.actionsPanel.style.display = "none";
    loadCustomer();
    return;
  }

  loadLeadPage();
}

async function loadLeadPage() {
  clearStatus();
  const [leadPayload, staffPayload] = await Promise.all([
    fetchApi(`/api/v1/leads/${encodeURIComponent(state.id)}`),
    fetchApi(`/api/v1/staff?active=true`)
  ]);
  if (!leadPayload) return;

  state.lead = leadPayload.lead || null;
  state.customer = leadPayload.customer || null;
  state.staff = Array.isArray(staffPayload?.items) ? staffPayload.items : [];

  renderLeadHeader();
  renderLeadData();
  renderActionControls();
  await loadActivities();
}

async function loadCustomer() {
  const payload = await fetchApi(`/api/v1/customers/${encodeURIComponent(state.id)}`);
  if (!payload) return;

  if (els.title) els.title.textContent = payload.customer?.name || `Customer ${state.id}`;
  if (els.subtitle) els.subtitle.textContent = payload.customer?.email || "Customer detail";

  const sections = [
    {
      title: "Customer",
      entries: toEntries(payload.customer || {})
    },
    {
      title: "Related Leads",
      entries: [{ key: "count", value: String((payload.leads || []).length) }]
    }
  ];
  renderSections(sections);

  renderActivitiesTable([]);
  if (els.activitiesTable) {
    els.activitiesTable.innerHTML =
      '<thead><tr><th>Lead ID</th><th>Stage</th><th>Destination</th><th>Style</th><th>Owner</th><th>Created</th></tr></thead>' +
      `<tbody>${(payload.leads || [])
        .map((lead) => {
          const href = buildLeadHref(lead.id);
          return `<tr>
          <td><a href="${escapeHtml(href)}">${escapeHtml(shortId(lead.id))}</a></td>
          <td>${escapeHtml(lead.stage || "-")}</td>
          <td>${escapeHtml(lead.destination || "-")}</td>
          <td>${escapeHtml(lead.style || "-")}</td>
          <td>${escapeHtml(lead.owner_name || "Unassigned")}</td>
          <td>${escapeHtml(formatDateTime(lead.created_at))}</td>
        </tr>`;
        })
        .join("") || '<tr><td colspan="6">No related leads</td></tr>'}</tbody>`;
  }
}

function renderLeadHeader() {
  if (!state.lead) return;
  if (els.title) els.title.textContent = `Lead ${shortId(state.lead.id)}`;
  if (els.subtitle) {
    const customerText = state.customer?.name || state.lead.customer_id || "-";
    els.subtitle.textContent = `${customerText} | ${state.lead.stage || "-"}`;
  }
}

function renderLeadData() {
  if (!state.lead) return;
  const lead = state.lead;
  const sections = [
    {
      title: "Lead",
      entries: [
        ["id", lead.id],
        ["stage", lead.stage],
        ["owner", lead.owner_name || "Unassigned"],
        ["destination", lead.destination],
        ["style", lead.style],
        ["travel_month", lead.travel_month],
        ["travelers", lead.travelers],
        ["duration", lead.duration],
        ["budget", lead.budget],
        ["sla_due_at", formatDateTime(lead.sla_due_at)],
        ["created_at", formatDateTime(lead.created_at)],
        ["updated_at", formatDateTime(lead.updated_at)]
      ]
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => ({ key, value: String(value ?? "-") }))
    },
    {
      title: "Customer",
      entries: toEntries(state.customer || {})
    },
    {
      title: "Source",
      entries: toEntries(lead.source || {})
    }
  ];

  renderSections(sections);
}

function renderSections(sections) {
  if (!els.leadDataView) return;
  const html = sections
    .map((section) => {
      const rows = (section.entries || [])
        .map((entry) => {
          return `<tr><th>${escapeHtml(entry.key)}</th><td>${escapeHtml(String(entry.value || "-"))}</td></tr>`;
        })
        .join("");
      return `
        <div style="margin-bottom: 0.9rem;">
          <h3 style="margin: 0 0 0.4rem; font-size: 0.98rem;">${escapeHtml(section.title)}</h3>
          <div class="backend-table-wrap">
            <table class="backend-table"><tbody>${rows || '<tr><td colspan="2">-</td></tr>'}</tbody></table>
          </div>
        </div>
      `;
    })
    .join("");
  els.leadDataView.innerHTML = html;
}

function renderActionControls() {
  if (!state.lead) return;

  if (els.stageSelect) {
    const options = STAGES.map((stage) => `<option value="${escapeHtml(stage)}">${escapeHtml(stage)}</option>`).join("");
    els.stageSelect.innerHTML = options;
    els.stageSelect.value = state.lead.stage || STAGES[0];
  }

  if (els.ownerSelect) {
    const options = ['<option value="">Unassigned</option>']
      .concat((state.staff || []).map((staff) => `<option value="${escapeHtml(staff.id)}">${escapeHtml(staff.name)}</option>`))
      .join("");
    els.ownerSelect.innerHTML = options;
    els.ownerSelect.value = state.lead.owner_id || "";
  }
}

async function saveOwner() {
  if (!state.lead || !els.ownerSelect) return;
  const result = await fetchApi(`/api/v1/leads/${encodeURIComponent(state.lead.id)}/owner`, {
    method: "PATCH",
    body: {
      owner_id: els.ownerSelect.value || null,
      actor: state.user
    }
  });
  if (!result?.lead) return;
  state.lead = result.lead;
  renderLeadHeader();
  renderLeadData();
  setStatus("Owner updated.");
  await loadActivities();
}

async function saveStage() {
  if (!state.lead || !els.stageSelect) return;
  const result = await fetchApi(`/api/v1/leads/${encodeURIComponent(state.lead.id)}/stage`, {
    method: "PATCH",
    body: {
      stage: els.stageSelect.value,
      actor: state.user
    }
  });
  if (!result?.lead) return;
  state.lead = result.lead;
  renderLeadHeader();
  renderLeadData();
  setStatus("Stage updated.");
  await loadActivities();
}

async function addNote() {
  if (!state.lead || !els.noteInput) return;
  const text = String(els.noteInput.value || "").trim();
  if (!text) {
    setStatus("Please enter a note.");
    return;
  }

  const result = await fetchApi(`/api/v1/leads/${encodeURIComponent(state.lead.id)}/activities`, {
    method: "POST",
    body: {
      type: "NOTE",
      actor: state.user,
      detail: text
    }
  });
  if (!result?.activity) return;

  els.noteInput.value = "";
  setStatus("Note added.");
  await loadActivities();
}

async function loadActivities() {
  if (!state.lead) return;
  const payload = await fetchApi(`/api/v1/leads/${encodeURIComponent(state.lead.id)}/activities`);
  if (!payload) return;
  renderActivitiesTable(payload.items || []);
}

function renderActivitiesTable(items) {
  if (!els.activitiesTable) return;
  const header = `<thead><tr><th>Time</th><th>Type</th><th>Actor</th><th>Detail</th></tr></thead>`;
  const rows = items
    .map(
      (activity) => `<tr>
      <td>${escapeHtml(formatDateTime(activity.created_at))}</td>
      <td>${escapeHtml(activity.type || "-")}</td>
      <td>${escapeHtml(activity.actor || "-")}</td>
      <td>${escapeHtml(activity.detail || "-")}</td>
    </tr>`
    )
    .join("");

  const body = rows || '<tr><td colspan="4">No activities</td></tr>';
  els.activitiesTable.innerHTML = `${header}<tbody>${body}</tbody>`;
}

function toEntries(obj) {
  return Object.entries(obj || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => ({
      key,
      value: Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value)
    }));
}

async function fetchApi(path, options = {}) {
  const method = options.method || "GET";
  const body = options.body;

  try {
    const response = await fetch(`${apiBase}${path}`, {
      method,
      credentials: "include",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    const payload = await response.json();
    if (!response.ok) {
      showError(payload.error || "Request failed");
      return null;
    }

    clearError();
    return payload;
  } catch (error) {
    showError("Could not connect to backend API.");
    console.error(error);
    return null;
  }
}

function buildLeadHref(id) {
  const params = new URLSearchParams({ type: "lead", id, user: state.user });
  return `backend-lead.html?${params.toString()}`;
}

function setStatus(message) {
  if (!els.actionStatus) return;
  els.actionStatus.textContent = message;
}

function clearStatus() {
  setStatus("");
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

function shortId(value) {
  const id = String(value || "");
  return id.length > 6 ? id.slice(-6) : id;
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
