const MAX_OUTPUT_LENGTH = 16000;

function trimCommandOutput(value) {
  const text = String(value || "").trim();
  if (text.length <= MAX_OUTPUT_LENGTH) return text;
  return `${text.slice(0, MAX_OUTPUT_LENGTH)}\n[output truncated]`;
}

function commandOutput(value) {
  const stdout = trimCommandOutput(value?.stdout);
  const stderr = trimCommandOutput(value?.stderr);
  return {
    ...(stdout ? { stdout } : {}),
    ...(stderr ? { stderr } : {})
  };
}

export function createTourMatrixHandlers({
  sendJson,
  getPrincipal,
  canPublishTourMatrices,
  execFile,
  path,
  repoRoot,
  nowIso
}) {
  let activePublish = null;

  function canAccess(req) {
    return typeof canPublishTourMatrices === "function" && canPublishTourMatrices(getPrincipal(req));
  }

  function currentTime() {
    return typeof nowIso === "function" ? nowIso() : new Date().toISOString();
  }

  async function runPublishScript() {
    const root = path.resolve(repoRoot || process.cwd());
    const scriptPath = path.join(root, "scripts", "content", "create_staging_tour_matrices.sh");
    const outputDir = String(process.env.TOUR_MATRIX_OUTPUT_DIR || root);
    return execFile("bash", [scriptPath], {
      cwd: root,
      env: {
        ...process.env,
        TOUR_MATRIX_OUTPUT_DIR: outputDir
      },
      maxBuffer: 8 * 1024 * 1024
    });
  }

  async function handlePublishTourMatrices(req, res) {
    if (!canAccess(req)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    if (activePublish) {
      sendJson(res, 409, {
        error: "Tour matrix publish is already running.",
        code: "TOUR_MATRICES_PUBLISH_RUNNING",
        started_at: activePublish.startedAt
      });
      return;
    }

    const startedAt = currentTime();
    const publishPromise = runPublishScript();
    activePublish = { promise: publishPromise, startedAt };

    try {
      const result = await publishPromise;
      sendJson(res, 200, {
        ok: true,
        started_at: startedAt,
        finished_at: currentTime(),
        ...commandOutput(result)
      });
    } catch (error) {
      sendJson(res, 500, {
        error: "Tour matrix publish failed.",
        code: "TOUR_MATRICES_PUBLISH_FAILED",
        detail: String(error?.message || error || "Unknown error"),
        ...commandOutput(error)
      });
    } finally {
      if (activePublish?.promise === publishPromise) {
        activePublish = null;
      }
    }
  }

  return {
    handlePublishTourMatrices
  };
}
