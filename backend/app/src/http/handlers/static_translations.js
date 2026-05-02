function sendError(sendJson, res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const payload = {
    error: String(error?.message || "Request failed"),
    code: error?.code || "STATIC_TRANSLATION_ERROR"
  };
  if (Array.isArray(error?.details)) payload.details = error.details;
  sendJson(res, status, payload);
}

export function createStaticTranslationHandlers({
  readBodyJson,
  sendJson,
  getPrincipal,
  canReadSettings,
  staticTranslationService,
  staticTranslationApplyJobs,
  writesEnabled = true
}) {
  function canAccess(req) {
    return canReadSettings(getPrincipal(req));
  }

  function rejectForbidden(res) {
    sendJson(res, 403, { error: "Forbidden" });
  }

  function rejectWritesDisabled(res) {
    sendJson(res, 403, {
      error: "Manual translation override editing is disabled in this environment.",
      code: "STATIC_TRANSLATION_WRITES_DISABLED"
    });
  }

  async function handleListStaticTranslationDomains(req, res) {
    if (!canAccess(req)) {
      rejectForbidden(res);
      return;
    }
    sendJson(res, 200, {
      domains: staticTranslationService.listDomains(),
      permissions: {
        can_write: writesEnabled !== false
      }
    });
  }

  async function handleListStaticTranslationLanguages(req, res, params = []) {
    if (!canAccess(req)) {
      rejectForbidden(res);
      return;
    }
    try {
      sendJson(res, 200, staticTranslationService.listLanguages(params[0]));
    } catch (error) {
      sendError(sendJson, res, error);
    }
  }

  async function handleGetStaticTranslationStatus(req, res) {
    if (!canAccess(req)) {
      rejectForbidden(res);
      return;
    }
    try {
      sendJson(res, 200, await staticTranslationService.getStatusSummary());
    } catch (error) {
      sendError(sendJson, res, error);
    }
  }

  async function handleGetStaticTranslationLanguageState(req, res, params = []) {
    if (!canAccess(req)) {
      rejectForbidden(res);
      return;
    }
    try {
      const payload = await staticTranslationService.getLanguageState(params[0], params[1]);
      sendJson(res, 200, payload);
    } catch (error) {
      sendError(sendJson, res, error);
    }
  }

  async function handlePatchStaticTranslationOverrides(req, res, params = []) {
    if (!canAccess(req)) {
      rejectForbidden(res);
      return;
    }
    if (writesEnabled === false) {
      rejectWritesDisabled(res);
      return;
    }
    try {
      const payload = await readBodyJson(req);
      const saved = await staticTranslationService.patchOverrides(params[0], params[1], payload);
      sendJson(res, 200, saved);
    } catch (error) {
      sendError(sendJson, res, error);
    }
  }

  async function handleDeleteStaticTranslationCache(req, res, params = []) {
    if (!canAccess(req)) {
      rejectForbidden(res);
      return;
    }
    if (writesEnabled === false) {
      rejectWritesDisabled(res);
      return;
    }
    try {
      const payload = await readBodyJson(req).catch(() => ({}));
      const saved = await staticTranslationService.deleteCache(
        params[0],
        params[1],
        decodeURIComponent(params[2] || ""),
        payload
      );
      sendJson(res, 200, saved);
    } catch (error) {
      sendError(sendJson, res, error);
    }
  }

  async function handleStartStaticTranslationApply(req, res) {
    if (!canAccess(req)) {
      rejectForbidden(res);
      return;
    }
    if (writesEnabled === false) {
      rejectWritesDisabled(res);
      return;
    }
    try {
      const job = await staticTranslationApplyJobs.startApply();
      sendJson(res, 202, { job });
    } catch (error) {
      sendError(sendJson, res, error);
    }
  }

  async function handleStartStaticTranslationPublish(req, res) {
    if (!canAccess(req)) {
      rejectForbidden(res);
      return;
    }
    if (writesEnabled === false) {
      rejectWritesDisabled(res);
      return;
    }
    try {
      const job = await staticTranslationApplyJobs.startPublish();
      sendJson(res, 202, { job });
    } catch (error) {
      sendError(sendJson, res, error);
    }
  }

  async function handleStartStaticTranslationRetranslate(req, res) {
    if (!canAccess(req)) {
      rejectForbidden(res);
      return;
    }
    if (writesEnabled === false) {
      rejectWritesDisabled(res);
      return;
    }
    try {
      const payload = await readBodyJson(req);
      const job = staticTranslationApplyJobs.startRetranslate(payload);
      sendJson(res, 202, { job });
    } catch (error) {
      sendError(sendJson, res, error);
    }
  }

  async function handleGetStaticTranslationApplyJob(req, res, params = []) {
    if (!canAccess(req)) {
      rejectForbidden(res);
      return;
    }
    try {
      sendJson(res, 200, { job: staticTranslationApplyJobs.getJob(params[0]) });
    } catch (error) {
      sendError(sendJson, res, error);
    }
  }

  return {
    handleListStaticTranslationDomains,
    handleListStaticTranslationLanguages,
    handleGetStaticTranslationStatus,
    handleGetStaticTranslationLanguageState,
    handlePatchStaticTranslationOverrides,
    handleDeleteStaticTranslationCache,
    handleStartStaticTranslationApply,
    handleStartStaticTranslationPublish,
    handleStartStaticTranslationRetranslate,
    handleGetStaticTranslationApplyJob
  };
}
