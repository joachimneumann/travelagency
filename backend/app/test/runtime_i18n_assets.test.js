import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { generateRuntimeI18nFromSnapshots } from "../../../scripts/i18n/build_runtime_i18n.mjs";

function hash(value) {
  return createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function snapshotItem({ domain, section, subsection, audience, lang, key, sourceText, targetText }) {
  return {
    source_ref: `${domain}:${key}`,
    key,
    domain,
    section,
    subsection,
    audience,
    required: true,
    source_lang: "en",
    target_lang: lang,
    source_text: sourceText,
    source_hash: hash(sourceText),
    target_text: targetText,
    target_hash: hash(targetText),
    origin: "machine",
    freshness_state: "current",
    publish_state: "published",
    review_state: "reviewed",
    updated_at: "2026-05-02T00:00:00.000Z"
  };
}

async function createRuntimeI18nFixture() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "runtime-i18n-"));
  const frontendSource = {
    "nav.contact": "Contact",
    "tour.card.plan_trip": "Plan this trip"
  };
  const backendSource = {
    "booking.note_title": "Booking note",
    "booking.source_channel.option.phone_call": "Phone call"
  };
  const frontendItems = Object.entries(frontendSource).map(([key, sourceText]) => snapshotItem({
    domain: "frontend",
    section: "customers",
    subsection: "frontend-static",
    audience: "customer",
    lang: "vi",
    key,
    sourceText,
    targetText: key === "nav.contact" ? "Lien he" : "Len ke hoach chuyen di nay"
  }));
  const backendItems = Object.entries(backendSource).map(([key, sourceText]) => snapshotItem({
    domain: "backend",
    section: "staff",
    subsection: "backend-ui",
    audience: "staff",
    lang: "vi",
    key,
    sourceText,
    targetText: key === "booking.note_title" ? "Ghi chu booking" : "Cuoc goi dien thoai"
  }));

  await writeJson(path.join(repoRoot, "frontend", "data", "generated", "i18n", "source", "frontend", "en.json"), frontendSource);
  await writeJson(path.join(repoRoot, "frontend", "data", "generated", "i18n", "source", "backend", "en.json"), backendSource);
  await writeJson(path.join(repoRoot, "frontend", "data", "i18n", "frontend", "fr.json"), { stale: "stale" });
  await writeJson(path.join(repoRoot, "frontend", "data", "i18n", "frontend_meta", "fr.json"), { stale: {} });
  await writeJson(path.join(repoRoot, "frontend", "data", "i18n", "backend", "vi.meta.json"), { stale: {} });

  await writeJson(path.join(repoRoot, "content", "translations", "manifest.json"), {
    schema: "translation-snapshot/v1",
    schema_version: 1,
    published_at: "2026-05-02T00:00:00.000Z",
    staff_languages: ["vi"],
    customer_languages: ["vi"],
    total_items: frontendItems.length + backendItems.length,
    sections: [
      {
        domain: "frontend",
        label: "Customer-facing UI",
        section: "customers",
        subsection: "frontend-static",
        audience: "customer",
        source_lang: "en",
        target_lang: "vi",
        item_count: frontendItems.length,
        file: "customers/frontend-static.vi.json"
      },
      {
        domain: "backend",
        label: "Backend terms for staff",
        section: "staff",
        subsection: "backend-ui",
        audience: "staff",
        source_lang: "en",
        target_lang: "vi",
        item_count: backendItems.length,
        file: "staff/backend-ui.vi.json"
      }
    ]
  });
  await writeJson(path.join(repoRoot, "content", "translations", "customers", "frontend-static.vi.json"), {
    schema: "translation-snapshot/v1",
    domain: "frontend",
    section: "customers",
    subsection: "frontend-static",
    audience: "customer",
    source_lang: "en",
    target_lang: "vi",
    item_count: frontendItems.length,
    items: frontendItems
  });
  await writeJson(path.join(repoRoot, "content", "translations", "staff", "backend-ui.vi.json"), {
    schema: "translation-snapshot/v1",
    domain: "backend",
    section: "staff",
    subsection: "backend-ui",
    audience: "staff",
    source_lang: "en",
    target_lang: "vi",
    item_count: backendItems.length,
    items: backendItems
  });

  return { repoRoot, frontendSource, backendSource };
}

test("runtime i18n generator writes dictionaries and metadata from published snapshots", async () => {
  const { repoRoot, frontendSource, backendSource } = await createRuntimeI18nFixture();

  const summary = await generateRuntimeI18nFromSnapshots({ repoRoot, quiet: true });

  assert.equal(summary.built.length, 2);
  assert.equal(await exists(path.join(repoRoot, "frontend", "data", "i18n", "frontend", "fr.json")), false);
  assert.equal(await exists(path.join(repoRoot, "frontend", "data", "i18n", "frontend_meta", "fr.json")), false);

  const frontendVi = JSON.parse(await readFile(path.join(repoRoot, "frontend", "data", "i18n", "frontend", "vi.json"), "utf8"));
  const frontendMeta = JSON.parse(await readFile(path.join(repoRoot, "frontend", "data", "i18n", "frontend_meta", "vi.json"), "utf8"));
  const backendVi = JSON.parse(await readFile(path.join(repoRoot, "frontend", "data", "i18n", "backend", "vi.json"), "utf8"));
  const backendMeta = JSON.parse(await readFile(path.join(repoRoot, "frontend", "data", "i18n", "backend", "vi.meta.json"), "utf8"));

  assert.deepEqual(Object.keys(frontendVi), Object.keys(frontendSource));
  assert.equal(frontendVi["tour.card.plan_trip"], "Len ke hoach chuyen di nay");
  assert.equal(frontendMeta["tour.card.plan_trip"].source_hash, hash(frontendSource["tour.card.plan_trip"]));
  assert.deepEqual(Object.keys(backendVi), Object.keys(backendSource));
  assert.equal(backendVi["booking.source_channel.option.phone_call"], "Cuoc goi dien thoai");
  assert.equal(backendMeta["booking.source_channel.option.phone_call"].source_hash, hash(backendSource["booking.source_channel.option.phone_call"]));
});

test("runtime i18n generator preserves protected-term-only strings from snapshots", async () => {
  const { repoRoot } = await createRuntimeI18nFixture();
  const sourcePath = path.join(repoRoot, "frontend", "data", "generated", "i18n", "source", "frontend", "en.json");
  const snapshotPath = path.join(repoRoot, "content", "translations", "customers", "frontend-static.vi.json");
  const manifestPath = path.join(repoRoot, "content", "translations", "manifest.json");
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  source["backend.button_full"] = "AsiaTravelPlan Backend";
  snapshot.items.push(snapshotItem({
    domain: "frontend",
    section: "customers",
    subsection: "frontend-static",
    audience: "customer",
    lang: "vi",
    key: "backend.button_full",
    sourceText: "AsiaTravelPlan Backend",
    targetText: "Phần cuối của Kế hoạch Du lịch Châu Á"
  }));
  snapshot.item_count = snapshot.items.length;
  manifest.sections[0].item_count = snapshot.items.length;
  manifest.total_items += 1;
  await writeJson(sourcePath, source);
  await writeJson(snapshotPath, snapshot);
  await writeJson(manifestPath, manifest);
  await writeJson(path.join(repoRoot, "content", "translations", "translation_protected_terms.json"), {
    items: ["AsiaTravelPlan", "backend"],
    updated_at: null
  });

  await generateRuntimeI18nFromSnapshots({ repoRoot, quiet: true });

  const frontendVi = JSON.parse(await readFile(path.join(repoRoot, "frontend", "data", "i18n", "frontend", "vi.json"), "utf8"));
  assert.equal(frontendVi["backend.button_full"], "AsiaTravelPlan Backend");
});

test("runtime i18n check validates snapshots without writing generated files", async () => {
  const { repoRoot } = await createRuntimeI18nFixture();
  await generateRuntimeI18nFromSnapshots({ repoRoot, check: true, quiet: true });

  assert.equal(await exists(path.join(repoRoot, "frontend", "data", "i18n", "frontend", "vi.json")), false);
  assert.equal(await exists(path.join(repoRoot, "frontend", "data", "i18n", "backend", "vi.json")), false);
});

test("runtime i18n generator rejects stale snapshot sources", async () => {
  const { repoRoot } = await createRuntimeI18nFixture();
  const snapshotPath = path.join(repoRoot, "content", "translations", "customers", "frontend-static.vi.json");
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  snapshot.items[0].source_text = "Old contact";
  snapshot.items[0].source_hash = hash("Old contact");
  await writeJson(snapshotPath, snapshot);

  await assert.rejects(
    () => generateRuntimeI18nFromSnapshots({ repoRoot, quiet: true }),
    /stale source_text/
  );
});

test("runtime i18n generator ignores retired frontend keys left in published snapshots", async () => {
  const { repoRoot } = await createRuntimeI18nFixture();
  const sourcePath = path.join(repoRoot, "frontend", "data", "generated", "i18n", "source", "frontend", "en.json");
  const snapshotPath = path.join(repoRoot, "content", "translations", "customers", "frontend-static.vi.json");
  const manifestPath = path.join(repoRoot, "content", "translations", "manifest.json");
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  delete source["footer.brand_title"];
  snapshot.items.push(snapshotItem({
    domain: "frontend",
    section: "customers",
    subsection: "frontend-static",
    audience: "customer",
    lang: "vi",
    key: "footer.brand_title",
    sourceText: "AsiaTravelPlan",
    targetText: "AsiaTravelPlan"
  }));
  snapshot.item_count = snapshot.items.length;
  manifest.sections[0].item_count = snapshot.items.length;
  manifest.total_items += 1;

  await writeJson(sourcePath, source);
  await writeJson(snapshotPath, snapshot);
  await writeJson(manifestPath, manifest);
  await generateRuntimeI18nFromSnapshots({ repoRoot, quiet: true });

  const frontendVi = JSON.parse(await readFile(path.join(repoRoot, "frontend", "data", "i18n", "frontend", "vi.json"), "utf8"));
  assert.equal(Object.hasOwn(frontendVi, "footer.brand_title"), false);
});
