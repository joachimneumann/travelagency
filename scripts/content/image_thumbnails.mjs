import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const require = createRequire(import.meta.url);

let sharpModule;

function loadSharp() {
  if (sharpModule) return sharpModule;

  try {
    sharpModule = require("sharp");
    return sharpModule;
  } catch (error) {
    try {
      sharpModule = require(path.join(repoRoot, "backend", "app", "node_modules", "sharp"));
      return sharpModule;
    } catch {
      throw new Error(
        `Unable to load sharp. Run "npm install" in backend/app before generating tour matrix thumbnails. Original error: ${error.message}`
      );
    }
  }
}

export async function writeImageThumbnail(sourcePath, outputPath, { maxSize = 300 } = {}) {
  const sharp = loadSharp();
  await sharp(sourcePath)
    .rotate()
    .resize({
      width: maxSize,
      height: maxSize,
      fit: "inside",
      withoutEnlargement: true
    })
    .toFile(outputPath);
}
