import test from "node:test";
import assert from "node:assert/strict";
import { createAtpStaffHandlers } from "../src/http/handlers/atp_staff.js";

test("public ATP staff team endpoint returns merged public profiles", async () => {
  const calls = [];
  const handlers = createAtpStaffHandlers({
    getPrincipal: () => null,
    canViewAtpStaffProfiles: () => true,
    canEditAtpStaffProfiles: () => false,
    readBodyJson: async () => ({}),
    sendJson: (_res, status, body, headers = {}) => {
      calls.push({ status, body, headers });
    },
    listPublicAtpStaffProfiles: async () => [{
      username: "joachim",
      name: "Joachim Neumann",
      full_name: "Joachim Neumann",
      team_order: 1,
      appears_in_team_web_page: true,
      picture_ref: "/content/atp_staff/photos/joachim.webp",
      languages: ["en"],
      position: "Founder",
      position_i18n: [{ lang: "en", value: "Founder" }],
      description: "Profile",
      description_i18n: [{ lang: "en", value: "Profile" }]
    }],
    buildAtpStaffDirectoryEntryByUsername: async () => null,
    updateAtpStaffProfileByUsername: async () => null,
    setAtpStaffPictureRefByUsername: async () => null,
    resetAtpStaffPictureByUsername: async () => null,
    repoRoot: process.cwd(),
    translateEntries: async () => ({}),
    translateEntriesWithMeta: async () => ({ entries: {} }),
    execFile: () => {},
    mkdir: async () => {},
    writeFile: async () => {},
    rm: async () => {},
    TEMP_UPLOAD_DIR: "/tmp",
    ATP_STAFF_PHOTOS_DIR: "/tmp",
    resolveAtpStaffPhotoDiskPath: () => null,
    sendFileWithCache: async () => {},
    randomUUID: () => "uuid"
  });

  await handlers.handleListPublicAtpStaffProfiles({}, {});

  assert.equal(calls.length, 1);
  assert.equal(calls[0].status, 200);
  assert.equal(calls[0].body.total, 1);
  assert.equal(calls[0].body.items[0].username, "joachim");
  assert.equal(calls[0].body.items[0].team_order, 1);
  assert.equal(calls[0].body.items[0].position, "Founder");
  assert.equal(calls[0].headers["Cache-Control"], "no-store");
});
