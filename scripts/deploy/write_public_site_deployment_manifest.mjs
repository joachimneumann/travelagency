#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writePublicSiteDeploymentManifest } from "../../backend/app/src/domain/public_site_deployment_status.js";

const ROOT_DIR = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

function usage() {
  console.log(`Usage:
  node scripts/deploy/write_public_site_deployment_manifest.mjs [--environment <name>]

Writes content/public-site-deployment-manifest.json with a hash of content/
metadata. The backend compares this deploy-time hash with the current content/
metadata to drive the red/green backend menu light.`);
}

function parseArgs(argv) {
  const options = {
    environment: process.env.PUBLIC_SITE_DEPLOYMENT_ENV || process.env.PUBLIC_SITE_RUNTIME_BRAND_ENV || ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--environment" || arg === "--env") {
      options.environment = argv[index + 1] || "";
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    process.exit(0);
  }

  const manifest = await writePublicSiteDeploymentManifest({
    repoRoot: ROOT_DIR,
    environment: options.environment
  });
  console.log(`Wrote public-site deployment manifest: hash=${manifest.content_metadata.hash} files=${manifest.content_metadata.file_count}`);
} catch (error) {
  console.error(error?.message || error);
  process.exit(1);
}
