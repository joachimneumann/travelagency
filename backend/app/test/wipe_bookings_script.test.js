import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { wipeBookingsData } from "../scripts/wipe_bookings.js";

test("wipe bookings script clears booking-owned store collections and artifacts", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "travelagency-wipe-bookings-"));
  const dataDir = path.join(rootDir, "data");
  const storePath = path.join(dataDir, "store.json");
  const artifactDirs = [
    path.join(dataDir, "pdfs", "invoices"),
    path.join(dataDir, "pdfs", "generated_offers"),
    path.join(dataDir, "pdfs", "travel_plans"),
    path.join(dataDir, "pdfs", "attachments"),
    path.join(dataDir, "booking_images"),
    path.join(dataDir, "booking_person_photos"),
    path.join(dataDir, "tmp", "travel_plan_previews"),
    path.join(dataDir, "invoices"),
    path.join(dataDir, "generated_offers"),
    path.join(dataDir, "booking_travel_plan_attachments")
  ];

  try {
    await mkdir(dataDir, { recursive: true });
    for (const directory of artifactDirs) {
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, "stale.txt"), "stale\n", "utf8");
    }

    await writeFile(storePath, `${JSON.stringify({
      bookings: [{ id: "booking_1" }],
      suppliers: [{ id: "supplier_1" }],
      activities: [{ id: "activity_1", booking_id: "booking_1" }],
      invoices: [{ id: "invoice_1", booking_id: "booking_1" }],
      chat_channel_accounts: [{ id: "acct_1", channel: "whatsapp" }],
      chat_conversations: [{ id: "conv_1", booking_id: "booking_1" }],
      chat_events: [{ id: "evt_1", conversation_id: "conv_1" }],
      booking_confirmation_challenges: [{ id: "challenge_1", booking_id: "booking_1" }],
      extra_metadata: { keep: true }
    }, null, 2)}\n`, "utf8");

    const result = await wipeBookingsData({
      storePath,
      dataDir,
      yes: true
    });

    assert.equal(result.summary.bookings, 1);
    assert.equal(result.summary.activities, 1);
    assert.equal(result.summary.invoices, 1);
    assert.equal(result.summary.chat_conversations, 1);
    assert.equal(result.summary.chat_events, 1);
    assert.equal(result.summary.booking_confirmation_challenges, 1);

    const persisted = JSON.parse(await readFile(storePath, "utf8"));
    assert.deepEqual(persisted.bookings, []);
    assert.deepEqual(persisted.activities, []);
    assert.deepEqual(persisted.invoices, []);
    assert.deepEqual(persisted.chat_conversations, []);
    assert.deepEqual(persisted.chat_events, []);
    assert.deepEqual(persisted.booking_confirmation_challenges, []);
    assert.deepEqual(persisted.suppliers, [{ id: "supplier_1" }]);
    assert.deepEqual(persisted.chat_channel_accounts, [{ id: "acct_1", channel: "whatsapp" }]);
    assert.deepEqual(persisted.extra_metadata, { keep: true });

    for (const directory of artifactDirs) {
      const entries = await readFile(path.join(directory, "stale.txt"), "utf8").then(
        () => ["stale.txt"],
        () => []
      );
      assert.deepEqual(entries, []);
    }
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
