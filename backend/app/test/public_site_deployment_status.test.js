import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createPublicSiteDeploymentStatusService,
  writePublicSiteDeploymentManifest
} from "../src/domain/public_site_deployment_status.js";

async function createTempRepo() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "public-site-deployment-"));
  await mkdir(path.join(repoRoot, "content", "tours"), { recursive: true });
  return repoRoot;
}

test("public-site deployment status compares current content metadata to the deploy manifest", async () => {
  const repoRoot = await createTempRepo();
  try {
    await writeFile(path.join(repoRoot, "content", "tours", "tour-alpha.json"), "{}", "utf8");
    const manifest = await writePublicSiteDeploymentManifest({
      repoRoot,
      environment: "test",
      nowIso: () => "2026-05-18T00:00:00.000Z"
    });
    assert.equal(manifest.schema, "public-site-deployment/v1");

    const service = createPublicSiteDeploymentStatusService({
      repoRoot,
      nowIso: () => "2026-05-18T00:01:00.000Z"
    });
    const clean = await service.getStatus();
    assert.equal(clean.clean, true);
    assert.equal(clean.dirty, false);
    assert.equal(clean.deployed_hash, clean.current_hash);

    await writeFile(path.join(repoRoot, "content", "tours", "tour-beta.json"), "{}", "utf8");
    const dirty = await service.getStatus();
    assert.equal(dirty.clean, false);
    assert.equal(dirty.dirty, true);
    assert.notEqual(dirty.deployed_hash, dirty.current_hash);

    const manifestPayload = JSON.parse(await readFile(path.join(repoRoot, "content", "public-site-deployment-manifest.json"), "utf8"));
    assert.equal(manifestPayload.content_metadata.hash, clean.current_hash);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});
