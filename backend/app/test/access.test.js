import test from "node:test";
import assert from "node:assert/strict";
import { createAccessHelpers } from "../src/domain/access.js";

const APP_ROLES = Object.freeze({
  ADMIN: "atp_admin",
  MANAGER: "atp_manager",
  ACCOUNTANT: "atp_accountant",
  ATP_STAFF: "atp_staff",
  TOUR_EDITOR: "atp_tour_editor"
});

test("public-site deployment status can be read by every backend role", () => {
  const helpers = createAccessHelpers({
    auth: { getSessionPrincipal: () => null },
    appRoles: APP_ROLES
  });

  for (const role of Object.values(APP_ROLES)) {
    assert.equal(
      helpers.canReadPublicSiteDeploymentStatus({ roles: [role] }),
      true,
      role
    );
  }

  assert.equal(helpers.canReadPublicSiteDeploymentStatus({ roles: [] }), false);
});
