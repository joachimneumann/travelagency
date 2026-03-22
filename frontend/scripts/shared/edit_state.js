export function createSnapshotDirtyTracker({
  captureSnapshot,
  isEnabled = () => true,
  onDirtyChange = () => {}
} = {}) {
  let cleanSnapshot = "";

  function readSnapshot() {
    if (typeof captureSnapshot !== "function") return "";
    return String(captureSnapshot() ?? "");
  }

  function markClean() {
    cleanSnapshot = readSnapshot();
    onDirtyChange(false);
    return cleanSnapshot;
  }

  function refresh() {
    const isDirty = Boolean(isEnabled()) && readSnapshot() !== cleanSnapshot;
    onDirtyChange(isDirty);
    return isDirty;
  }

  function setDirty(isDirty) {
    onDirtyChange(Boolean(isDirty));
    return Boolean(isDirty);
  }

  function getCleanSnapshot() {
    return cleanSnapshot;
  }

  return {
    getCleanSnapshot,
    markClean,
    refresh,
    setDirty
  };
}

export function createQueuedAutosaveController({
  delayMs = 350,
  isEnabled = () => true,
  save
} = {}) {
  let timerId = null;
  let inFlight = false;
  let pending = false;
  let inFlightPromise = null;
  let lastArgs = [];

  function clearTimer() {
    if (timerId) {
      window.clearTimeout(timerId);
      timerId = null;
    }
  }

  function clear() {
    clearTimer();
    pending = false;
  }

  async function runSaveCycle(args) {
    inFlight = true;
    const currentPromise = Promise.resolve().then(() => save(...args));
    inFlightPromise = currentPromise;

    let result;
    try {
      result = await currentPromise;
    } finally {
      inFlight = false;
      if (inFlightPromise === currentPromise) {
        inFlightPromise = null;
      }
    }

    if (pending) {
      pending = false;
      return await runNow();
    }

    return result;
  }

  async function runNow(...args) {
    if (args.length) lastArgs = args;
    if (!isEnabled()) return true;

    clearTimer();

    if (inFlight) {
      pending = true;
      return inFlightPromise ?? true;
    }

    return await runSaveCycle(lastArgs);
  }

  function schedule(...args) {
    if (args.length) lastArgs = args;
    if (!isEnabled()) return;

    if (inFlight) {
      pending = true;
      return;
    }

    clearTimer();
    timerId = window.setTimeout(() => {
      timerId = null;
      void runNow();
    }, delayMs);
  }

  async function flush(...args) {
    return await runNow(...args);
  }

  return {
    clear,
    flush,
    runNow,
    schedule
  };
}
