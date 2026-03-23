export function createAtpStaffHandlers(deps) {
  const {
    sendJson,
    sendFileWithCache,
    resolveAtpStaffPhotoDiskPath
  } = deps;

  async function handlePublicAtpStaffPhoto(req, res, [rawRelativePath]) {
    const absolutePath = resolveAtpStaffPhotoDiskPath(rawRelativePath);
    if (!absolutePath) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }
    await sendFileWithCache(req, res, absolutePath, "public, max-age=31536000, immutable");
  }

  return {
    handlePublicAtpStaffPhoto
  };
}
