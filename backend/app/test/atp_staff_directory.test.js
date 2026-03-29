import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createAtpStaffDirectory } from "../src/lib/atp_staff_directory.js";

function buildDirectory(rootDir) {
  const dataPath = path.join(rootDir, "content", "atp_staff", "staff.json");
  const photosDir = path.join(rootDir, "content", "atp_staff", "photos");
  const keycloakUsersSnapshotPath = path.join(rootDir, "content", "atp_staff", "keycloak_users.json");
  const writeQueueRef = { current: Promise.resolve() };
  const keycloakDirectory = {
    async listAllowedUsers() {
      return [];
    },
    async listAssignableUsers() {
      return [];
    }
  };

  return {
    dataPath,
    photosDir,
    writeQueueRef,
    directory: createAtpStaffDirectory({
      dataPath,
      photosDir,
      keycloakUsersSnapshotPath,
      keycloakDirectory,
      writeQueueRef,
      staffRoleNames: []
    })
  };
}

test("ATP staff profile reads wait for queued writes before reading from disk", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "travelagency-atp-staff-"));
  try {
    const ctx = buildDirectory(rootDir);
    await mkdir(path.dirname(ctx.dataPath), { recursive: true });
    await mkdir(ctx.photosDir, { recursive: true });
    await writeFile(ctx.dataPath, `${JSON.stringify({
      staff: {
        joachim: {
          name: "Joachim Neumann"
        }
      }
    }, null, 2)}\n`, "utf8");

    let releaseQueue = null;
    ctx.writeQueueRef.current = new Promise((resolve) => {
      releaseQueue = resolve;
    });

    const persistPromise = ctx.directory.persistProfiles({
      items: [
        {
          username: "ngoc",
          name: "Dao Van Ngoc",
          picture: "ngoc.webp",
          languages: [],
          appears_in_team_web_page: true
        }
      ]
    }, {
      reason: "test_wait_for_queued_write"
    });

    let readSettled = false;
    const readPromise = ctx.directory.readProfiles().then((payload) => {
      readSettled = true;
      return payload;
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(readSettled, false);

    releaseQueue();

    const payload = await readPromise;
    await persistPromise;
    assert.deepEqual(payload.items.map((profile) => profile.username), ["ngoc"]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("ATP staff ensureStorage does not overwrite profiles when the existing file cannot be parsed", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "travelagency-atp-staff-invalid-"));
  try {
    const ctx = buildDirectory(rootDir);
    await mkdir(path.dirname(ctx.dataPath), { recursive: true });
    await mkdir(ctx.photosDir, { recursive: true });
    const invalidJson = "{\"staff\":{\"joachim\":";
    await writeFile(ctx.dataPath, invalidJson, "utf8");

    await assert.rejects(
      ctx.directory.ensureStorage(),
      /Unexpected end of JSON input|JSON/
    );

    assert.equal(await readFile(ctx.dataPath, "utf8"), invalidJson);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
