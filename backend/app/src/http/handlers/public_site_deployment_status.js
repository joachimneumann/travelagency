function sendError(sendJson, res, error) {
  sendJson(res, 500, {
    error: String(error?.message || "Public-site deployment status failed."),
    code: "PUBLIC_SITE_DEPLOYMENT_STATUS_ERROR"
  });
}

export function createPublicSiteDeploymentStatusHandlers({
  sendJson,
  getPrincipal,
  canReadPublicSiteDeploymentStatus,
  publicSiteDeploymentStatusService
}) {
  function canAccess(req) {
    return typeof canReadPublicSiteDeploymentStatus === "function"
      && canReadPublicSiteDeploymentStatus(getPrincipal(req));
  }

  async function handleGetPublicSiteDeploymentStatus(req, res) {
    if (!canAccess(req)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    try {
      sendJson(res, 200, await publicSiteDeploymentStatusService.getStatus());
    } catch (error) {
      sendError(sendJson, res, error);
    }
  }

  return {
    handleGetPublicSiteDeploymentStatus
  };
}
