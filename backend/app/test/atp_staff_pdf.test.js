import test from "node:test";
import assert from "node:assert/strict";

import { resolveAtpGuidePdfContext } from "../src/lib/atp_staff_pdf.js";

test("resolveAtpGuidePdfContext strips cache-busting query params from picture_ref URLs", async () => {
  const profile = await resolveAtpGuidePdfContext({
    booking: {
      assigned_keycloak_user_id: "kc-joachim"
    },
    resolveAssignedAtpStaffProfile: async () => ({
      username: "joachim",
      picture_ref: "/public/v1/atp-staff-photos/joachim.webp?v=1713075073000",
      full_name: "Joachim Neumann",
      friendly_short_name: "Joachim"
    }),
    resolveAtpStaffPhotoDiskPath: (relativePath) => `/photos/${relativePath}`
  });

  assert.equal(profile?.photoDiskPath, "/photos/joachim.webp");
});
