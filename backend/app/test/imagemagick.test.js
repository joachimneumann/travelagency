import test from "node:test";
import assert from "node:assert/strict";
import { execImageMagick } from "../src/lib/imagemagick.js";

test("execImageMagick falls back to convert when magick is not installed", async () => {
  const calls = [];
  const result = await execImageMagick(async (command, args) => {
    calls.push({ command, args });
    if (command === "magick") {
      const error = new Error("spawn magick ENOENT");
      error.code = "ENOENT";
      throw error;
    }
    return { command, args };
  }, ["input.png", "output.webp"]);

  assert.deepEqual(calls.map((entry) => entry.command), ["magick", "convert"]);
  assert.equal(result.command, "convert");
});

test("execImageMagick keeps the original conversion error when magick exists but the conversion fails", async () => {
  await assert.rejects(
    () => execImageMagick(async () => {
      throw new Error("magick: unable to open image");
    }, ["input.png", "output.webp"]),
    /unable to open image/i
  );
});
