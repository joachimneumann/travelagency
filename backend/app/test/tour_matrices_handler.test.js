import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createTourMatrixHandlers } from "../src/http/handlers/tour_matrices.js";

function createResponseCapture() {
  const calls = [];
  return {
    calls,
    sendJson: (_res, status, payload) => {
      calls.push({ status, payload });
    }
  };
}

test("tour matrix publish handler runs the staging matrix publish script from the repo root", async () => {
  const previousOutputDir = process.env.TOUR_MATRIX_OUTPUT_DIR;
  delete process.env.TOUR_MATRIX_OUTPUT_DIR;
  const response = createResponseCapture();
  const execCalls = [];
  const handlers = createTourMatrixHandlers({
    sendJson: response.sendJson,
    getPrincipal: () => ({ roles: ["atp_tour_editor"] }),
    canPublishTourMatrices: () => true,
    execFile: async (...args) => {
      execCalls.push(args);
      return { stdout: "published", stderr: "" };
    },
    path,
    repoRoot: "/srv/asiatravelplan-staging",
    nowIso: () => "2026-05-13T00:00:00.000Z"
  });

  try {
    await handlers.handlePublishTourMatrices({}, {});
  } finally {
    if (previousOutputDir === undefined) {
      delete process.env.TOUR_MATRIX_OUTPUT_DIR;
    } else {
      process.env.TOUR_MATRIX_OUTPUT_DIR = previousOutputDir;
    }
  }

  assert.equal(response.calls[0].status, 200);
  assert.equal(response.calls[0].payload.ok, true);
  assert.equal(response.calls[0].payload.stdout, "published");
  assert.equal(execCalls[0][0], "bash");
  assert.deepEqual(execCalls[0][1], ["/srv/asiatravelplan-staging/scripts/content/publish_matrices/create_staging_tour_matrices.sh"]);
  assert.equal(execCalls[0][2].cwd, "/srv/asiatravelplan-staging");
  assert.equal(execCalls[0][2].env.TOUR_MATRIX_OUTPUT_DIR, "/srv/asiatravelplan-staging");
});

test("tour matrix publish handler honors TOUR_MATRIX_OUTPUT_DIR for host-published files", async () => {
  const previousOutputDir = process.env.TOUR_MATRIX_OUTPUT_DIR;
  process.env.TOUR_MATRIX_OUTPUT_DIR = "/srv/matrix-pages";
  const response = createResponseCapture();
  const execCalls = [];
  const handlers = createTourMatrixHandlers({
    sendJson: response.sendJson,
    getPrincipal: () => ({ roles: ["atp_tour_editor"] }),
    canPublishTourMatrices: () => true,
    execFile: async (...args) => {
      execCalls.push(args);
      return { stdout: "published", stderr: "" };
    },
    path,
    repoRoot: "/srv/asiatravelplan-staging",
    nowIso: () => "2026-05-13T00:00:00.000Z"
  });

  try {
    await handlers.handlePublishTourMatrices({}, {});
  } finally {
    if (previousOutputDir === undefined) {
      delete process.env.TOUR_MATRIX_OUTPUT_DIR;
    } else {
      process.env.TOUR_MATRIX_OUTPUT_DIR = previousOutputDir;
    }
  }

  assert.equal(response.calls[0].status, 200);
  assert.equal(execCalls[0][2].cwd, "/srv/asiatravelplan-staging");
  assert.equal(execCalls[0][2].env.TOUR_MATRIX_OUTPUT_DIR, "/srv/matrix-pages");
});

test("tour matrix publish handler rejects concurrent publish runs", async () => {
  const response = createResponseCapture();
  let releasePublish;
  const handlers = createTourMatrixHandlers({
    sendJson: response.sendJson,
    getPrincipal: () => ({ roles: ["atp_tour_editor"] }),
    canPublishTourMatrices: () => true,
    execFile: () => new Promise((resolve) => {
      releasePublish = () => resolve({ stdout: "published", stderr: "" });
    }),
    path,
    repoRoot: "/srv/asiatravelplan-staging",
    nowIso: () => "2026-05-13T00:00:00.000Z"
  });

  const firstPublish = handlers.handlePublishTourMatrices({}, {});
  await handlers.handlePublishTourMatrices({}, {});
  releasePublish();
  await firstPublish;

  assert.equal(response.calls[0].status, 409);
  assert.equal(response.calls[0].payload.code, "TOUR_MATRICES_PUBLISH_RUNNING");
  assert.equal(response.calls[1].status, 200);
});

test("tour matrix publish handler requires publish permission", async () => {
  const response = createResponseCapture();
  const handlers = createTourMatrixHandlers({
    sendJson: response.sendJson,
    getPrincipal: () => null,
    canPublishTourMatrices: () => false,
    execFile: async () => {
      throw new Error("should not run");
    },
    path,
    repoRoot: "/srv/asiatravelplan-staging",
    nowIso: () => "2026-05-13T00:00:00.000Z"
  });

  await handlers.handlePublishTourMatrices({}, {});

  assert.deepEqual(response.calls, [{ status: 403, payload: { error: "Forbidden" } }]);
});
