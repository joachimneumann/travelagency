function isMissingExecutableError(error, command) {
  const detail = String(error?.message || error || "").toLowerCase();
  return error?.code === "ENOENT"
    || detail.includes(`spawn ${String(command).toLowerCase()} enoent`)
    || detail.includes(`${String(command).toLowerCase()}: not found`)
    || detail.includes(`${String(command).toLowerCase()}: command not found`);
}

export async function execImageMagick(execFile, args = []) {
  try {
    return await execFile("magick", args);
  } catch (error) {
    if (!isMissingExecutableError(error, "magick")) {
      throw error;
    }
    return execFile("convert", args);
  }
}
