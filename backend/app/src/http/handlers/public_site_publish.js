function errorStatus(error) {
  const status = Number(error?.status || error?.statusCode || 500);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}

function errorPayload(error) {
  return {
    error: String(error?.message || error || "Public-site publish failed."),
    ...(error?.code ? { code: String(error.code) } : {}),
    ...(Array.isArray(error?.details) ? { details: error.details } : {})
  };
}

export function createPublicSitePublishHandlers({
  sendJson,
  getPrincipal,
  canPublishPublicSite,
  publicSitePublishService
}) {
  function canAccess(req) {
    return typeof canPublishPublicSite === "function" && canPublishPublicSite(getPrincipal(req));
  }

  function rejectForbidden(res) {
    sendJson(res, 403, { error: "Forbidden" });
  }

  async function handleGetPublicSitePublishStatus(req, res) {
    if (!canAccess(req)) {
      rejectForbidden(res);
      return;
    }
    try {
      sendJson(res, 200, await publicSitePublishService.getStatus());
    } catch (error) {
      sendJson(res, errorStatus(error), errorPayload(error));
    }
  }

  async function handleStartPublicSitePublish(req, res) {
    if (!canAccess(req)) {
      rejectForbidden(res);
      return;
    }
    try {
      const job = publicSitePublishService.startPublish();
      sendJson(res, 202, { job });
    } catch (error) {
      sendJson(res, errorStatus(error), errorPayload(error));
    }
  }

  async function handleGetPublicSitePublishJob(req, res, [jobId]) {
    if (!canAccess(req)) {
      rejectForbidden(res);
      return;
    }
    try {
      sendJson(res, 200, { job: publicSitePublishService.getJob(jobId) });
    } catch (error) {
      sendJson(res, errorStatus(error), errorPayload(error));
    }
  }

  return {
    handleGetPublicSitePublishStatus,
    handleStartPublicSitePublish,
    handleGetPublicSitePublishJob
  };
}
