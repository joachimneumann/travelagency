import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");

test("tour content matrix renders red missing content warnings in generated language pages", async (t) => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "tour-content-matrix-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));

  const toursDir = path.join(rootDir, "tours");
  const tourVariantsDir = path.join(rootDir, "tour_variants");
  const translationsDir = path.join(rootDir, "translations");
  const tourDir = path.join(toursDir, "tour_missing_content");
  await mkdir(tourDir, { recursive: true });
  await mkdir(tourVariantsDir, { recursive: true });
  await mkdir(path.join(translationsDir, "customers"), { recursive: true });

  await writeFile(path.join(tourDir, "tour.json"), `${JSON.stringify({
    id: "tour_missing_content",
    title: "Warning coverage tour",
    published_on_webpage: true,
    travel_plan: {
      days: [
        {
          id: "day_missing_content",
          day_number: 1,
          title: "",
          notes: "",
          services: [
            {
              id: "service_missing_content",
              title: "",
              details: ""
            }
          ]
        }
      ]
    }
  }, null, 2)}\n`);

  await writeFile(path.join(translationsDir, "customers", "marketing-tours.vi.json"), "{\"items\":[]}\n");
  await writeFile(path.join(translationsDir, "customers", "marketing-tours.ja.json"), "{\"items\":[]}\n");

  const scriptPath = path.join(repoRoot, "scripts", "content", "publish_matrices", "create_tour_content_matrix.mjs");
  for (const language of ["english", "vietnamese", "japanese"]) {
    const outputPath = path.join(rootDir, `content_matrix_${language}.html`);
    await execFileAsync(process.execPath, [
      scriptPath,
      language,
      "--tours",
      toursDir,
      "--tour-variants",
      tourVariantsDir,
      "--translations",
      translationsDir,
      "--output",
      outputPath
    ], { cwd: repoRoot });

    const html = await readFile(outputPath, "utf8");
    assert.match(html, /\.content-warning \{[\s\S]*color: rgb\(255, 0, 0\);[\s\S]*font-weight: 700;/);
    assert.match(html, /Missing day title/);
    assert.match(html, /Missing day detail/);
    assert.match(html, /Missing service title/);
    assert.match(html, /Missing service detail/);
  }
});
