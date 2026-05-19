import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

test("sendFileWithCache resolves after the response stream finishes", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "http-helper-send-file-"));
  try {
    const filePath = path.join(tempDir, "sample.pdf");
    await writeFile(filePath, Buffer.alloc(64 * 1024, 7));
    const { sendFileWithCache } = createHttpHelpers({ corsOrigin: "*" });
    const req = requestFromChunks([], {});
    const chunks = [];
    class DelayedResponse extends Writable {
      constructor() {
        super();
        this.headers = {};
        this.headersSent = false;
        this.statusCode = 0;
      }

      writeHead(status, headers = {}) {
        this.statusCode = status;
        this.headers = { ...this.headers, ...headers };
        this.headersSent = true;
      }

      _write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        setTimeout(callback, 25);
      }
    }

    const res = new DelayedResponse();
    let resolved = false;
    const sending = sendFileWithCache(req, res, filePath, "private, no-store")
      .then(() => {
        resolved = true;
      });
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(resolved, false);
    await sending;
    assert.equal(resolved, true);
    assert.equal(res.statusCode, 200);
    assert.equal(Buffer.concat(chunks).length, 64 * 1024);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
