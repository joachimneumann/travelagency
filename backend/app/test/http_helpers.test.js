import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createHttpHelpers } from "../src/http/http_helpers.js";

function requestFromChunks(chunks, headers = {}) {
  const req = Readable.from(chunks);
  req.headers = headers;
  return req;
}

test("readBodyJson rejects requests over the configured content-length limit", async () => {
  const { readBodyJson } = createHttpHelpers({ corsOrigin: "*" });
  await assert.rejects(
    () => readBodyJson(requestFromChunks(["{}"], { "content-length": "20" }), { maxBytes: 4 }),
    (error) => error?.statusCode === 413 && error?.code === "PAYLOAD_TOO_LARGE"
  );
});

test("readBodyJson rejects streamed bodies that exceed the configured limit", async () => {
  const { readBodyJson } = createHttpHelpers({ corsOrigin: "*" });
  await assert.rejects(
    () => readBodyJson(requestFromChunks(["{\"a\":", "\"12345\"}"]), { maxBytes: 8 }),
    (error) => error?.statusCode === 413 && error?.code === "PAYLOAD_TOO_LARGE"
  );
});
