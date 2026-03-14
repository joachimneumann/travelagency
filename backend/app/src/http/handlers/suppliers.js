export function createSupplierHandlers(deps) {
  const {
    readBodyJson,
    sendJson,
    readStore,
    persistStore,
    normalizeText,
    normalizeEmail,
    getPrincipal,
    canReadSuppliers,
    canEditSuppliers,
    randomUUID
  } = deps;

  function normalizeOptionalText(value) {
    const normalized = normalizeText(value);
    return normalized || null;
  }

  function normalizeSupplier(rawSupplier, { existing = null, isCreate = false } = {}) {
    const next = existing ? { ...existing } : {};
    if (isCreate || rawSupplier.name !== undefined) next.name = normalizeText(rawSupplier.name);
    if (isCreate || rawSupplier.contact !== undefined) next.contact = normalizeOptionalText(rawSupplier.contact);
    if (isCreate || rawSupplier.emergency_phone !== undefined) {
      next.emergency_phone = normalizeOptionalText(rawSupplier.emergency_phone);
    }
    if (isCreate || rawSupplier.email !== undefined) next.email = normalizeEmail(rawSupplier.email) || null;
    if (isCreate || rawSupplier.country !== undefined) next.country = normalizeOptionalText(rawSupplier.country);
    if (isCreate || rawSupplier.category !== undefined) next.category = normalizeText(rawSupplier.category).toLowerCase() || null;
    return next;
  }

  function validateSupplier(supplier) {
    if (!normalizeText(supplier?.name)) return "Supplier name is required.";
    if (!normalizeText(supplier?.category)) return "Supplier category is required.";
    return "";
  }

  function sortSuppliers(items) {
    return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
      const leftName = String(left?.name || "");
      const rightName = String(right?.name || "");
      return leftName.localeCompare(rightName);
    });
  }

  async function handleListSuppliers(req, res) {
    const principal = getPrincipal(req);
    if (!canReadSuppliers(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const store = await readStore();
    const items = sortSuppliers(store.suppliers).map((supplier) => normalizeSupplier(supplier, { existing: supplier }));
    sendJson(res, 200, {
      items,
      total: items.length
    });
  }

  async function handleGetSupplier(req, res, [supplierId]) {
    const principal = getPrincipal(req);
    if (!canReadSuppliers(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    const store = await readStore();
    const supplier = (Array.isArray(store.suppliers) ? store.suppliers : []).find((item) => item.id === supplierId);
    if (!supplier) {
      sendJson(res, 404, { error: "Supplier not found" });
      return;
    }
    sendJson(res, 200, {
      supplier: normalizeSupplier(supplier, { existing: supplier })
    });
  }

  async function handleCreateSupplier(req, res) {
    const principal = getPrincipal(req);
    if (!canEditSuppliers(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const store = await readStore();
    const supplier = normalizeSupplier(payload, { isCreate: true });
    supplier.id = `supplier_${randomUUID()}`;
    const validationError = validateSupplier(supplier);
    if (validationError) {
      sendJson(res, 422, { error: validationError });
      return;
    }
    store.suppliers = [...(Array.isArray(store.suppliers) ? store.suppliers : []), supplier];
    await persistStore(store);
    sendJson(res, 201, { supplier });
  }

  async function handlePatchSupplier(req, res, [supplierId]) {
    const principal = getPrincipal(req);
    if (!canEditSuppliers(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    let payload;
    try {
      payload = await readBodyJson(req);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const store = await readStore();
    const suppliers = Array.isArray(store.suppliers) ? [...store.suppliers] : [];
    const supplierIndex = suppliers.findIndex((item) => item.id === supplierId);
    if (supplierIndex < 0) {
      sendJson(res, 404, { error: "Supplier not found" });
      return;
    }
    const supplier = normalizeSupplier(payload, { existing: suppliers[supplierIndex] });
    supplier.id = suppliers[supplierIndex].id;
    const validationError = validateSupplier(supplier);
    if (validationError) {
      sendJson(res, 422, { error: validationError });
      return;
    }
    suppliers[supplierIndex] = supplier;
    store.suppliers = suppliers;
    await persistStore(store);
    sendJson(res, 200, { supplier });
  }

  return {
    handleListSuppliers,
    handleGetSupplier,
    handleCreateSupplier,
    handlePatchSupplier
  };
}
