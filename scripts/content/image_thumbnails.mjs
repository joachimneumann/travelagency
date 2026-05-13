import { writeServiceImageDerivative } from "../lib/service_image_derivatives.mjs";

export async function writeImageThumbnail(sourcePath, outputPath, { maxSize = 300 } = {}) {
  await writeServiceImageDerivative(sourcePath, outputPath, {
    variant: "matrix-thumb",
    overrides: {
      width: maxSize,
      height: maxSize,
      fit: "inside"
    }
  });
}
