import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAtpStaffHandlers } from "../src/http/handlers/atp_staff.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

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
      name: "Joachim",
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
    repoRoot,
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
  assert.equal(calls[0].body.items[0].name, "Joachim");
  assert.equal(calls[0].body.items[0].team_order, 1);
  assert.equal(calls[0].body.items[0].position, "Founder");
  assert.equal(calls[0].headers["Cache-Control"], "no-store");
});

test("staff profile updates mark homepage assets dirty without regenerating", async () => {
  const responses = [];
  const execCalls = [];
  const handlers = createAtpStaffHandlers({
    getPrincipal: () => ({ username: "admin" }),
    canViewAtpStaffProfiles: () => true,
    canEditAtpStaffProfiles: () => true,
    readBodyJson: async () => ({ languages: ["en"] }),
    sendJson: (_res, status, body, headers = {}) => {
      responses.push({ status, body, headers });
    },
    listAtpStaffDirectoryEntries: async () => [],
    listPublicAtpStaffProfiles: async () => [],
    buildAtpStaffDirectoryEntryByUsername: async () => ({ username: "vic" }),
    updateAtpStaffProfileByUsername: async (username) => ({ username, languages: ["en"] }),
    setAtpStaffPictureRefByUsername: async () => null,
    resetAtpStaffPictureByUsername: async () => null,
    repoRoot,
    translateEntries: async () => ({}),
    translateEntriesWithMeta: async () => ({ entries: {} }),
    execFile: async (...args) => {
      execCalls.push(args);
    },
    mkdir: async () => {},
    writeFile: async () => {},
    rm: async () => {},
    TEMP_UPLOAD_DIR: "/tmp/uploads",
    ATP_STAFF_ROOT: "/tmp/atp_staff",
    ATP_STAFF_PROFILES_PATH: "/tmp/atp_staff/staff.json",
    ATP_STAFF_PHOTOS_DIR: "/tmp/atp_staff/photos",
    resolveAtpStaffPhotoDiskPath: () => null,
    sendFileWithCache: async () => {},
    randomUUID: () => "uuid"
  });

  await handlers.handlePatchAtpStaffProfile({}, {}, ["vic"]);

  assert.equal(responses.length, 1);
  assert.equal(responses[0].status, 200);
  assert.deepEqual(responses[0].body.homepage_assets, {
    ok: true,
    dirty: true,
    reason: "staff_profile_patch",
    username: "vic"
  });
  assert.equal(execCalls.length, 0);
});

test("staff profile picture upload converts to 400px-wide WebP", async () => {
  const responses = [];
  const execCalls = [];
  const writtenFiles = [];
  const removedFiles = [];
  const handlers = createAtpStaffHandlers({
    getPrincipal: () => ({ username: "admin" }),
    canViewAtpStaffProfiles: () => true,
    canEditAtpStaffProfiles: () => true,
    readBodyJson: async () => ({
      filename: "Vic Portrait.png",
      mime_type: "image/png",
      data_base64: Buffer.from("image-bytes").toString("base64")
    }),
    sendJson: (_res, status, body, headers = {}) => {
      responses.push({ status, body, headers });
    },
    listAtpStaffDirectoryEntries: async () => [],
    listPublicAtpStaffProfiles: async () => [],
    buildAtpStaffDirectoryEntryByUsername: async () => ({ username: "vic" }),
    updateAtpStaffProfileByUsername: async () => null,
    setAtpStaffPictureRefByUsername: async (username, pictureRef) => ({
      username,
      staff_profile: { picture_ref: pictureRef }
    }),
    resetAtpStaffPictureByUsername: async () => null,
    repoRoot,
    translateEntries: async () => ({}),
    translateEntriesWithMeta: async () => ({ entries: {} }),
    execFile: async (...args) => {
      execCalls.push(args);
    },
    mkdir: async () => {},
    writeFile: async (filePath, buffer) => {
      writtenFiles.push({ filePath, buffer });
    },
    rm: async (filePath) => {
      removedFiles.push(filePath);
    },
    TEMP_UPLOAD_DIR: "/tmp/uploads",
    ATP_STAFF_ROOT: "/tmp/atp_staff",
    ATP_STAFF_PROFILES_PATH: "/tmp/atp_staff/staff.json",
    ATP_STAFF_PHOTOS_DIR: "/tmp/atp_staff/photos",
    resolveAtpStaffPhotoDiskPath: () => null,
    sendFileWithCache: async () => {},
    randomUUID: () => "uuid"
  });

  await handlers.handleUploadAtpStaffPhoto({}, {}, ["vic"]);

  assert.equal(responses.length, 1);
  assert.equal(responses[0].status, 200);
  assert.equal(responses[0].body.user.staff_profile.picture_ref, "/content/atp_staff/photos/vic.webp");
  assert.deepEqual(responses[0].body.homepage_assets, {
    ok: true,
    dirty: true,
    reason: "staff_photo_upload",
    username: "vic"
  });
  assert.equal(writtenFiles.length, 1);
  assert.equal(removedFiles.length, 1);
  assert.equal(execCalls.length, 1);
  assert.equal(execCalls[0][0], "magick");
  assert.deepEqual(execCalls[0][1].slice(1), [
    "-auto-orient",
    "-resize",
    "400x",
    "-strip",
    "-quality",
    "84",
    "/tmp/atp_staff/photos/vic.webp"
  ]);
});
