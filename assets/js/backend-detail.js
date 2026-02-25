const qs = new URLSearchParams(window.location.search);
const apiBase = (window.CHAPTER2_API_BASE || "").replace(/\/$/, "");

const state = {
  type: qs.get("type") || "lead",
  id: qs.get("id") || "",
  user: qs.get("user") || "admin",
  token: qs.get("api_token") || localStorage.getItem("chapter2_api_token") || "dev-secret-token"
};

const els = {
  homeLink: document.getElementById("backendHomeLink"),
  title: document.getElementById("detailTitle"),
  subtitle: document.getElementById("detailSubTitle"),
  error: document.getElementById("detailError"),
  json: document.getElementById("detailJson"),
  relatedTitle: document.getElementById("relatedTitle"),
  relatedTable: document.getElementById("relatedTable"),
  back: document.getElementById("backToBackend")
};

init();

function init() {
  localStorage.setItem("chapter2_api_token", state.token);

  if (els.homeLink) {
    const homeParams = new URLSearchParams({ user: state.user, api_token: state.token });
    els.homeLink.href = `backend.html?${homeParams.toString()}`;
  }

  if (els.back) {
    const backParams = new URLSearchParams({ user: state.user, api_token: state.token });
    els.back.href = `backend.html?${backParams.toString()}`;
  }

  if (!state.id) {
    showError("Missing record id.");
    return;
  }

  if (state.type === "customer") {
    loadCustomer();
    return;
  }

  loadLead();
}

async function loadLead() {
  const leadPayload = await fetchApi(`/api/v1/leads/${encodeURIComponent(state.id)}`);
  if (!leadPayload) return;

  if (els.title) els.title.textContent = `Lead ${state.id}`;
  if (els.subtitle) {
    els.subtitle.textContent = `Customer: ${leadPayload.lead?.customer_id || "-"} | Stage: ${leadPayload.lead?.stage || "-"}`;
  }
  if (els.json) {
    els.json.textContent = JSON.stringify(leadPayload, null, 2);
  }

  const activitiesPayload = await fetchApi(`/api/v1/leads/${encodeURIComponent(state.id)}/activities`);
  if (!activitiesPayload) return;

  if (els.relatedTitle) els.relatedTitle.textContent = "Activities";
  const header = `<thead><tr><th>Time</th><th>Type</th><th>Actor</th><th>Detail</th></tr></thead>`;
  const rows = (activitiesPayload.items || [])
    .map(
      (activity) => `<tr>
      <td>${escapeHtml(activity.created_at || "-")}</td>
      <td>${escapeHtml(activity.type || "-")}</td>
      <td>${escapeHtml(activity.actor || "-")}</td>
      <td>${escapeHtml(activity.detail || "-")}</td>
    </tr>`
    )
    .join("");

  const body = rows || `<tr><td colspan="4">No activities</td></tr>`;
  if (els.relatedTable) {
    els.relatedTable.innerHTML = `${header}<tbody>${body}</tbody>`;
  }
}

async function loadCustomer() {
  const payload = await fetchApi(`/api/v1/customers/${encodeURIComponent(state.id)}`);
  if (!payload) return;

  if (els.title) els.title.textContent = `Customer ${state.id}`;
  if (els.subtitle) {
    els.subtitle.textContent = `${payload.customer?.name || "-"} | ${payload.customer?.email || "-"}`;
  }
  if (els.json) {
    els.json.textContent = JSON.stringify(payload.customer || {}, null, 2);
  }

  if (els.relatedTitle) els.relatedTitle.textContent = "Related Leads";
  const header = `<thead><tr><th>Lead ID</th><th>Stage</th><th>Destination</th><th>Style</th><th>Owner</th><th>Created</th></tr></thead>`;
  const rows = (payload.leads || [])
    .map((lead) => {
      const detailHref = buildDetailHref("lead", lead.id);
      return `<tr>
      <td><a href="${escapeHtml(detailHref)}">${escapeHtml(lead.id)}</a></td>
      <td>${escapeHtml(lead.stage || "-")}</td>
      <td>${escapeHtml(lead.destination || "-")}</td>
      <td>${escapeHtml(lead.style || "-")}</td>
      <td>${escapeHtml(lead.owner_name || "Unassigned")}</td>
      <td>${escapeHtml(lead.created_at || "-")}</td>
    </tr>`;
    })
    .join("");

  const body = rows || `<tr><td colspan="6">No related leads</td></tr>`;
  if (els.relatedTable) {
    els.relatedTable.innerHTML = `${header}<tbody>${body}</tbody>`;
  }
}

async function fetchApi(path) {
  try {
    const response = await fetch(`${apiBase}${path}`, {
      headers: {
        Authorization: `Bearer ${state.token}`
      }
    });
    const payload = await response.json();
    if (!response.ok) {
      showError(payload.error || "Request failed");
      return null;
    }
    return payload;
  } catch (error) {
    showError("Could not connect to backend API.");
    console.error(error);
    return null;
  }
}

function buildDetailHref(type, id) {
  const params = new URLSearchParams({
    type,
    id,
    user: state.user,
    api_token: state.token
  });
  return `backend-detail.html?${params.toString()}`;
}

function showError(message) {
  if (!els.error) return;
  els.error.textContent = message;
  els.error.classList.add("show");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
