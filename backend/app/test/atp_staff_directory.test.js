import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { createAtpStaffDirectory } from "../src/lib/atp_staff_directory.js";

function buildDirectory(rootDir, options = {}) {
  const dataPath = path.join(rootDir, "content", "atp_staff", "staff.json");
  const photosDir = path.join(rootDir, "content", "atp_staff", "photos");
  const keycloakUsersSnapshotPath = path.join(rootDir, "content", "atp_staff", "keycloak_users.json");
  const writeQueueRef = { current: Promise.resolve() };
  const allowedUsers = Array.isArray(options.allowedUsers) ? options.allowedUsers : [];
  const assignableUsers = Array.isArray(options.assignableUsers) ? options.assignableUsers : allowedUsers;
  const keycloakDirectory = {
    async listAllowedUsers() {
      return allowedUsers;
    },
    async listAssignableUsers() {
      return assignableUsers;
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
      staffRoleNames: Array.isArray(options.staffRoleNames) ? options.staffRoleNames : []
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

test("ATP staff response profiles version picture refs from the photo mtime", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "travelagency-atp-staff-version-"));
  try {
    const ctx = buildDirectory(rootDir, {
      allowedUsers: [{
        id: "kc-joachim",
        username: "joachim",
        name: "Joachim Neumann"
      }]
    });
    await mkdir(path.dirname(ctx.dataPath), { recursive: true });
    await mkdir(ctx.photosDir, { recursive: true });
    await writeFile(ctx.dataPath, `${JSON.stringify({
      staff: {
        joachim: {
          name: "Joachim Neumann",
          picture: "joachim.webp"
        }
      }
    }, null, 2)}\n`, "utf8");

    const photoPath = path.join(ctx.photosDir, "joachim.webp");
    await writeFile(photoPath, "first-version", "utf8");
    await utimes(photoPath, new Date("2026-04-13T10:00:00.000Z"), new Date("2026-04-13T10:00:00.000Z"));

    const firstEntry = await ctx.directory.buildDirectoryEntryForUsername("joachim");
    const firstRef = String(firstEntry?.staff_profile?.picture_ref || "");
    assert.match(firstRef, /^\/public\/v1\/atp-staff-photos\/joachim\.webp\?v=\d+$/);

    await writeFile(photoPath, "second-version", "utf8");
    await utimes(photoPath, new Date("2026-04-13T10:05:00.000Z"), new Date("2026-04-13T10:05:00.000Z"));

    const secondEntry = await ctx.directory.buildDirectoryEntryForUsername("joachim");
    const secondRef = String(secondEntry?.staff_profile?.picture_ref || "");
    assert.match(secondRef, /^\/public\/v1\/atp-staff-photos\/joachim\.webp\?v=\d+$/);
    assert.notEqual(secondRef, firstRef);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("ATP staff sync writes the Keycloak first name into the stored name field", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "travelagency-atp-staff-sync-"));
  try {
    const ctx = buildDirectory(rootDir, {
      allowedUsers: [{
        id: "kc-joachim",
        username: "joachim",
        first_name: "Joachim",
        name: "Joachim Neumann"
      }]
    });
    await mkdir(path.dirname(ctx.dataPath), { recursive: true });
    await mkdir(ctx.photosDir, { recursive: true });
    await writeFile(ctx.dataPath, `${JSON.stringify({
      staff: {
        joachim: {
          name: "Joachim Neumann",
          friendly_short_name: "Joe",
          languages: ["en"],
          appears_in_team_web_page: true
        }
      }
    }, null, 2)}\n`, "utf8");

    const items = await ctx.directory.syncProfilesFromKeycloak();
    const stored = JSON.parse(await readFile(ctx.dataPath, "utf8"));

    assert.equal(items[0]?.name, "Joachim");
    assert.equal(stored.staff.joachim.name, "Joachim");
    assert.equal(stored.staff.joachim.friendly_short_name, "Joe");
    assert.equal("full_name" in stored.staff.joachim, false);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
