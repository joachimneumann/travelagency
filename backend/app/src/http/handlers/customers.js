import {
  CUSTOMER_CONSENT_CREATE_REQUEST_SCHEMA,
  CUSTOMER_PHOTO_UPLOAD_REQUEST_SCHEMA,
  CUSTOMER_UPDATE_REQUEST_SCHEMA
} from "../../../Generated/API/generated_APIModels.js";

const CUSTOMER_UPDATE_FIELDS = new Set(
  CUSTOMER_UPDATE_REQUEST_SCHEMA.fields
    .map((field) => field.name)
    .filter((name) => name && name !== "id" && name !== "customer_hash")
);

const CUSTOMER_UPDATE_FIELDS_BY_NAME = Object.fromEntries(
  CUSTOMER_UPDATE_REQUEST_SCHEMA.fields.map((field) => [field.name, field])
);

const CUSTOMER_UPDATE_DATE_FIELDS = new Set(
  CUSTOMER_UPDATE_REQUEST_SCHEMA.fields
    .filter((field) => field.format === "date" || field.format === "date-time")
    .map((field) => field.name)
);

const CUSTOMER_CONSENT_FIELDS = Object.fromEntries(
  CUSTOMER_CONSENT_CREATE_REQUEST_SCHEMA.fields.map((field) => [field.name, field])
);

const CUSTOMER_CONSENT_TYPES = new Set(CUSTOMER_CONSENT_FIELDS.consent_type?.enumValues || []);
const CUSTOMER_CONSENT_STATUSES = new Set(CUSTOMER_CONSENT_FIELDS.status?.enumValues || []);

function normalizeTextValue(value) {
  return String(value ?? "").trim();
}

function normalizeEvidenceUpload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const filename = normalizeTextValue(value.filename);
  const data_base64 = normalizeTextValue(value.data_base64);
  const mime_type = normalizeTextValue(value.mime_type).toLowerCase() || "application/octet-stream";
  if (!filename || !data_base64) return null;
  return { filename, data_base64, mime_type };
}

function normalizeCustomerConsentCreate(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const consentType = normalizeTextValue(payload.consent_type);
  const status = normalizeTextValue(payload.status);
  if (!CUSTOMER_CONSENT_TYPES.has(consentType) || !CUSTOMER_CONSENT_STATUSES.has(status)) {
    return null;
  }
  return {
    consent_type: consentType,
    status,
    captured_via: normalizeTextValue(payload.captured_via) || null,
    captured_at: normalizeTextValue(payload.captured_at) || null,
    evidence_ref: normalizeTextValue(payload.evidence_ref) || null,
    evidence_upload: normalizeEvidenceUpload(payload.evidence_upload)
  };
}

function normalizeCustomerPatch(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const patch = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (!CUSTOMER_UPDATE_FIELDS.has(key) || key === "id") return;
    const field = CUSTOMER_UPDATE_FIELDS_BY_NAME[key];
    const normalizedValue = normalizeTextValue(value);

    if (CUSTOMER_UPDATE_DATE_FIELDS.has(key)) {
      patch[key] = normalizedValue;
      return;
    }

    if (field?.kind === "enum") {
      const allowedValues = Array.isArray(field.enumValues) ? new Set(field.enumValues) : null;
      if (normalizedValue && allowedValues && !allowedValues.has(normalizedValue)) return;
      patch[key] = normalizedValue;
      return;
    }

    patch[key] = normalizedValue;
  });

  return patch;
}

function applyCustomerPatch(customer, patch = {}) {
  Object.entries(patch).forEach(([key, value]) => {
    customer[key] = value;
  });
  if (Object.prototype.hasOwnProperty.call(patch, "name")) {
    customer.name = patch.name || customer.name || "";
  }
}

export function createCustomerHandlers(deps) {
  const {
    getPrincipal,
    canReadCustomers,
    sendJson,
    readStore,
    normalizeText,
    paginate,
    buildPaginatedListResponse,
    buildBookingReadModel,
    canViewAtpStaffDirectory,
    loadAtpStaff,
    staffUsernames,
    canManageAtpStaff,
    readBodyJson,
    normalizeStringArray,
    persistAtpStaff,
    randomUUID,
    persistStore,
    nowIso,
    computeClientHash,
    computeCustomerHash,
    computeTravelGroupHash,
    mkdir,
    path,
    writeFile,
    stat,
    sendFileWithCache,
    CONSENT_EVIDENCE_DIR,
    CUSTOMER_PHOTOS_DIR
  } = deps;

  const defaultEvidenceExtension = (mimeType) => {
    if (mimeType === "application/pdf") return ".pdf";
    if (mimeType === "image/jpeg") return ".jpg";
    if (mimeType === "image/png") return ".png";
    if (mimeType === "image/webp") return ".webp";
    return ".bin";
  };

  const buildCustomerReadModel = (customer) => ({
    ...customer,
    customer_hash: computeCustomerHash(customer),
    name: normalizeText(customer?.name) || "",
    photo_ref: normalizeText(customer?.photo_ref) || null,
    title: normalizeText(customer?.title) || null,
    phone_number: normalizeText(customer?.phone_number) || null,
    preferred_language: normalizeText(customer?.preferred_language) || null
  });

  const buildClientReadModel = (client, customer = null, group = null) => ({
    ...client,
    client_hash: computeClientHash(client),
    display_name: normalizeText(customer?.name || group?.group_name) || "",
    primary_phone_number: normalizeText(customer?.phone_number) || null,
    primary_email: normalizeText(customer?.email) || null
  });

  const buildTravelGroupReadModel = (group, store) => {
    const members = (Array.isArray(store?.travel_group_members) ? store.travel_group_members : [])
      .filter((member) => member.travel_group_id === group.id)
      .sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
    return {
      ...group,
      group_name: normalizeText(group?.group_name) || "",
      notes: normalizeText(group?.notes) || null,
      travel_group_hash: computeTravelGroupHash(group, members)
    };
  };

  const assertMatchingCustomerHash = async (payload, customer, client, res) => {
    const requestHash = normalizeTextValue(payload?.customer_hash);
    const currentHash = computeCustomerHash(customer);
    if (!requestHash || requestHash !== currentHash) {
      sendJson(res, 409, {
        error: "Customer changed in backend",
        detail: "The customer has changed in the backend. The data has been refreshed. Your changes are lost. Please do them again.",
        code: "CUSTOMER_HASH_MISMATCH",
        client: buildClientReadModel(client, customer, null),
        customer: buildCustomerReadModel(customer)
      });
      return false;
    }
    return true;
  };

  const persistConsentEvidenceFile = async (customerClientId, consentId, upload) => {
    const extension = path.extname(upload.filename) || defaultEvidenceExtension(upload.mime_type);
    const consentDir = path.join(CONSENT_EVIDENCE_DIR, customerClientId, consentId);
    await mkdir(consentDir, { recursive: true });
    const outputName = `evidence${extension}`;
    const outputPath = path.join(consentDir, outputName);
    const sourceBuffer = Buffer.from(upload.data_base64, "base64");
    if (!sourceBuffer.length) throw new Error("Empty evidence payload");
    await writeFile(outputPath, sourceBuffer);
    return `/public/v1/customer-consent-evidence/${customerClientId}/${consentId}/${outputName}`;
  };

  const persistCustomerPhotoFile = async (customerClientId, upload) => {
    const extension = path.extname(upload.filename) || defaultEvidenceExtension(upload.mime_type);
    const customerDir = path.join(CUSTOMER_PHOTOS_DIR, customerClientId);
    await mkdir(customerDir, { recursive: true });
    const outputName = `photo${extension}`;
    const outputPath = path.join(customerDir, outputName);
    const sourceBuffer = Buffer.from(upload.data_base64, "base64");
    if (!sourceBuffer.length) throw new Error("Empty photo payload");
    await writeFile(outputPath, sourceBuffer);
    return `/public/v1/customer-photos/${customerClientId}/${outputName}`;
  };

  const handlePublicConsentEvidence = async (req, res, [relativePath]) => {
    const normalizedPath = String(relativePath || "")
      .split("/")
      .filter(Boolean)
      .filter((segment) => segment !== "." && segment !== "..")
      .join("/");
    if (!normalizedPath) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    const filePath = path.join(CONSENT_EVIDENCE_DIR, normalizedPath);
    try {
      const fileInfo = await stat(filePath);
      if (!fileInfo.isFile()) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }
    } catch {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    await sendFileWithCache(req, res, filePath, "public, max-age=300");
  };

  const handlePublicCustomerPhoto = async (req, res, [relativePath]) => {
    const normalizedPath = String(relativePath || "")
      .split("/")
      .filter(Boolean)
      .filter((segment) => segment !== "." && segment !== "..")
      .join("/");
    if (!normalizedPath) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    const filePath = path.join(CUSTOMER_PHOTOS_DIR, normalizedPath);
    try {
      const fileInfo = await stat(filePath);
      if (!fileInfo.isFile()) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }
    } catch {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    await sendFileWithCache(req, res, filePath, "public, max-age=300");
  };

  async function handleListCustomers(req, res) {
    const principal = getPrincipal(req);
    if (!canReadCustomers(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const store = await readStore();
    const requestUrl = new URL(req.url, "http://localhost");
    const search = normalizeText(requestUrl.searchParams.get("search")).toLowerCase();
    const pageQuery = requestUrl.searchParams;

    const filtered = [...(store.customers || [])]
      .map((customer) => buildCustomerReadModel(customer))
      .filter((customer) => {
        if (!search) return true;
        const haystack = [
          customer.name,
          customer.email,
          customer.phone_number,
          customer.preferred_language
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) =>
        String(b.created_at || b.updated_at || "").localeCompare(String(a.created_at || a.updated_at || ""))
      );
    const paged = paginate(filtered, pageQuery);
    sendJson(res, 200, buildPaginatedListResponse(paged));
  }

  async function handleGetCustomer(req, res, [customerClientId]) {
    const principal = getPrincipal(req);
    if (!canReadCustomers(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const store = await readStore();
    const customer = (store.customers || []).find((item) => item.client_id === customerClientId);
    const client = (store.clients || []).find((item) => item.id === customerClientId);
    if (!customer || !client) {
      sendJson(res, 404, { error: "Customer not found" });
      return;
    }

    const bookings = await Promise.all(
      (store.bookings || [])
        .filter((booking) => booking.client_id === customer.client_id)
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
        .map(async (booking) => await buildBookingReadModel(booking))
    );

    const consents = (Array.isArray(store.customer_consents) ? store.customer_consents : [])
      .filter((consent) => consent.customer_client_id === customer.client_id)
      .sort((a, b) => String(b.captured_at || "").localeCompare(String(a.captured_at || "")));
    const documents = (Array.isArray(store.customer_documents) ? store.customer_documents : [])
      .filter((document) => document.customer_client_id === customer.client_id)
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    const travelGroupMembers = (Array.isArray(store.travel_group_members) ? store.travel_group_members : [])
      .filter((member) => member.customer_client_id === customer.client_id)
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    const relatedTravelGroupIds = new Set(
      travelGroupMembers.map((member) => normalizeText(member.travel_group_id)).filter(Boolean)
    );
    const travelGroups = (Array.isArray(store.travel_groups) ? store.travel_groups : [])
      .filter((group) => relatedTravelGroupIds.has(normalizeText(group.id)))
      .map((group) => buildTravelGroupReadModel(group, store))
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));

    sendJson(res, 200, {
      client: buildClientReadModel(client, customer, null),
      customer: buildCustomerReadModel(customer),
      bookings,
      consents,
      documents,
      travelGroups,
      travelGroupMembers
    });
  }

  async function handlePatchCustomer(req, res, [customerClientId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const principal = getPrincipal(req);
    if (!canReadCustomers(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const store = await readStore();
    const customer = (store.customers || []).find((item) => item.client_id === customerClientId);
    const client = (store.clients || []).find((item) => item.id === customerClientId);
    if (!customer || !client) {
      sendJson(res, 404, { error: "Customer not found" });
      return;
    }
    if (!(await assertMatchingCustomerHash(payload, customer, client, res))) return;

    const patch = normalizeCustomerPatch(payload);
    if (!patch || !Object.keys(patch).length) {
      sendJson(res, 422, { error: "No valid fields to update" });
      return;
    }

    applyCustomerPatch(customer, patch);
    customer.updated_at = nowIso();
    client.client_hash = computeClientHash(client);

    await persistStore(store);
    sendJson(res, 200, {
      client: buildClientReadModel(client, customer, null),
      customer: buildCustomerReadModel(customer)
    });
  }

  async function handleCreateCustomerConsent(req, res, [customerClientId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const principal = getPrincipal(req);
    if (!canReadCustomers(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const store = await readStore();
    const customer = (store.customers || []).find((item) => item.client_id === customerClientId);
    const client = (store.clients || []).find((item) => item.id === customerClientId);
    if (!customer || !client) {
      sendJson(res, 404, { error: "Customer not found" });
      return;
    }
    if (!(await assertMatchingCustomerHash(payload, customer, client, res))) return;

    const consent = normalizeCustomerConsentCreate(payload);
    if (!consent) {
      sendJson(res, 422, { error: "Invalid consent payload" });
      return;
    }

    if (!Array.isArray(store.customer_consents)) {
      store.customer_consents = [];
    }

    const timestamp = nowIso();
    const created = {
      id: `perscons_${randomUUID()}`,
      customer_client_id: customer.client_id,
      consent_type: consent.consent_type,
      status: consent.status,
      captured_via: consent.captured_via,
      captured_at: consent.captured_at || timestamp,
      evidence_ref: null,
      updated_at: timestamp
    };

    if (consent.evidence_upload) {
      try {
        created.evidence_ref = await persistConsentEvidenceFile(customer.client_id, created.id, consent.evidence_upload);
      } catch (error) {
        console.error("persistConsentEvidenceFile failed", error);
        created.evidence_ref = null;
      }
    } else if (consent.evidence_ref) {
      created.evidence_ref = consent.evidence_ref;
    }

    store.customer_consents.unshift(created);
    customer.updated_at = timestamp;
    await persistStore(store);
    sendJson(res, 201, {
      client: buildClientReadModel(client, customer, null),
      customer: buildCustomerReadModel(customer),
      consent: created
    });
  }

  async function handleUploadCustomerPhoto(req, res, [customerClientId]) {
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const principal = getPrincipal(req);
    if (!canReadCustomers(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const store = await readStore();
    const customer = (store.customers || []).find((item) => item.client_id === customerClientId);
    const client = (store.clients || []).find((item) => item.id === customerClientId);
    if (!customer || !client) {
      sendJson(res, 404, { error: "Customer not found" });
      return;
    }
    if (!(await assertMatchingCustomerHash(payload, customer, client, res))) return;

    const uploadFieldName =
      CUSTOMER_PHOTO_UPLOAD_REQUEST_SCHEMA.fields.find((field) => field.name === "photo_upload")?.name ||
      CUSTOMER_PHOTO_UPLOAD_REQUEST_SCHEMA.fields.find((field) => field.name === "photo")?.name ||
      "photo_upload";
    const upload = normalizeEvidenceUpload(payload[uploadFieldName]);
    if (!upload) {
      sendJson(res, 422, { error: "Invalid customer photo payload" });
      return;
    }

    try {
      customer.photo_ref = await persistCustomerPhotoFile(customer.client_id, upload);
    } catch (error) {
      sendJson(res, 422, { error: "Could not store customer photo", detail: error?.message || "Unknown error" });
      return;
    }

    customer.updated_at = nowIso();
    await persistStore(store);
    sendJson(res, 200, {
      client: buildClientReadModel(client, customer, null),
      customer: buildCustomerReadModel(customer)
    });
  }

  async function handleListAtpStaff(req, res) {
    const principal = getPrincipal(req);
    if (!canViewAtpStaffDirectory(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const requestUrl = new URL(req.url, "http://localhost");
    const onlyActive = normalizeText(requestUrl.searchParams.get("active")) !== "false";
    const atp_staff = await loadAtpStaff();
    const items = atp_staff
      .filter((member) => (onlyActive ? member.active : true))
      .map((member) => ({
        id: member.id,
        name: member.name,
        active: Boolean(member.active),
        usernames: staffUsernames(member),
        destinations: Array.isArray(member.destinations) ? member.destinations : [],
        languages: Array.isArray(member.languages) ? member.languages : []
      }))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    sendJson(res, 200, { items, total: items.length });
  }

  async function handleCreateAtpStaff(req, res) {
    const principal = getPrincipal(req);
    if (!canManageAtpStaff(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const name = normalizeText(payload.name);
    const usernames = Array.from(
      new Set(
        (Array.isArray(payload.usernames) ? payload.usernames : String(payload.usernames || "").split(","))
          .map((value) => normalizeText(value).toLowerCase())
          .filter(Boolean)
      )
    );
    const destinations = normalizeStringArray(payload.destinations);
    const languages = normalizeStringArray(payload.languages);

    if (!name) {
      sendJson(res, 422, { error: "name is required" });
      return;
    }
    if (!usernames.length) {
      sendJson(res, 422, { error: "at least one username is required" });
      return;
    }

    const atp_staff = await loadAtpStaff();
    const usernameSet = new Set(usernames);
    const duplicate = atp_staff.find((member) => {
      const existing = new Set(staffUsernames(member));
      return Array.from(usernameSet).some((username) => existing.has(username));
    });
    if (duplicate) {
      sendJson(res, 409, { error: `username already in use by ${duplicate.name}` });
      return;
    }

    const member = {
      id: `staff_${randomUUID()}`,
      name,
      active: payload.active !== false,
      usernames,
      destinations,
      languages
    };

    atp_staff.push(member);
    await persistAtpStaff(atp_staff);
    sendJson(res, 201, {
      atp_staff: {
        id: member.id,
        name: member.name,
        active: member.active,
        usernames: member.usernames,
        destinations: member.destinations,
        languages: member.languages
      }
    });
  }

  return {
    handleListCustomers,
    handleGetCustomer,
    handlePatchCustomer,
    handleUploadCustomerPhoto,
    handleCreateCustomerConsent,
    handlePublicCustomerPhoto,
    handlePublicConsentEvidence,
    handleListAtpStaff,
    handleCreateAtpStaff
  };
}
