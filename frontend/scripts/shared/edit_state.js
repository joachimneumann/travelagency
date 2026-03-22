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

  function setCleanSnapshot(snapshot = "") {
    cleanSnapshot = String(snapshot ?? "");
    const isDirty = Boolean(isEnabled()) && readSnapshot() !== cleanSnapshot;
    onDirtyChange(isDirty);
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
    setCleanSnapshot,
    refresh,
    setDirty
  };
}
