import path from "node:path";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { validateTranslationEntriesRequest } from "../../../Generated/API/generated_APIModels.js";
import { normalizeText } from "../../lib/text.js";
import { enumValueSetFor } from "../../lib/generated_catalogs.js";
import { execImageMagick } from "../../lib/imagemagick.js";
import { normalizeLanguageCode as normalizeCatalogLanguageCode } from "../../../../../shared/generated/language_catalog.js";

const LANGUAGE_CODE_SET = enumValueSetFor("LanguageCode");
const COUNTRY_CODE_SET = enumValueSetFor("CountryCode");

function normalizeLanguageCodes(items) {
  return Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => normalizeCatalogLanguageCode(item, { fallback: "" }))
        .filter((item) => item && LANGUAGE_CODE_SET.has(item))
    )
  );
}

function normalizeCountryCodes(items) {
  return Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => normalizeText(item).toUpperCase())
        .filter((item) => item && COUNTRY_CODE_SET.has(item))
    )
  );
}

function normalizeLanguageCode(value, fallback = "en") {
  const normalized = normalizeCatalogLanguageCode(value, { fallback });
  return normalized && LANGUAGE_CODE_SET.has(normalized) ? normalized : fallback;
}

function translationEntriesToObject(entries) {
  return Object.fromEntries(
    (Array.isArray(entries) ? entries : [])
      .map((entry) => [normalizeText(entry?.key), normalizeText(entry?.value)])
      .filter(([key, value]) => Boolean(key && value))
  );
}

function translationEntriesFromObject(entries) {
  return Object.entries(entries || {})
    .map(([key, value]) => ({ key: normalizeText(key), value: normalizeText(value) }))
    .filter((entry) => Boolean(entry.key && entry.value));
}

function normalizeQualificationEntries(items) {
  return Array.from(
    new Map(
      (Array.isArray(items) ? items : [])
        .map((entry) => [normalizeLanguageCode(entry?.lang, ""), normalizeText(entry?.value)])
        .filter(([lang, value]) => Boolean(lang && value && LANGUAGE_CODE_SET.has(lang)))
    ).entries()
  ).map(([lang, value]) => ({ lang, value }));
}

function buildUserResponse(user) {
  return { user };
}

async function fileExists(filePath) {
  if (!filePath) return false;
  try {
    const fileStats = await stat(filePath);
    return fileStats.isFile();
  } catch {
    return false;
  }
}

export function createAtpStaffHandlers(deps) {
  const {
    getPrincipal,
    canViewAtpStaffProfiles,
    canEditAtpStaffProfiles,
    readBodyJson,
    sendJson,
    listAtpStaffDirectoryEntries,
    listPublicAtpStaffProfiles,
    buildAtpStaffDirectoryEntryByUsername,
    updateAtpStaffProfileByUsername,
    setAtpStaffPictureRefByUsername,
    resetAtpStaffPictureByUsername,
    repoRoot,
    translateEntries,
    translateEntriesWithMeta,
    execFile,
    mkdir,
    writeFile,
    rm,
    TEMP_UPLOAD_DIR,
    ATP_STAFF_PHOTOS_DIR,
    resolveAtpStaffPhotoDiskPath,
    sendFileWithCache,
    randomUUID
  } = deps;

  const PUBLIC_HOMEPAGE_ASSET_GENERATOR_CANDIDATES = Object.freeze([
    path.join(repoRoot, "scripts", "assets", "generate_public_homepage_assets.mjs"),
    path.join(repoRoot, "scripts", "generate_public_homepage_assets.mjs")
  ]);
  let publicHomepageAssetGenerationQueue = Promise.resolve();

  async function regeneratePublicHomepageAssets(reason, details = {}) {
    const task = async () => {
      const generatorPath = PUBLIC_HOMEPAGE_ASSET_GENERATOR_CANDIDATES.find((candidate) => existsSync(candidate));
      if (!generatorPath) {
        throw new Error("Could not find generate_public_homepage_assets.mjs in expected script locations.");
      }
      await execFile(process.execPath, [generatorPath], {
        cwd: repoRoot
      });
    };

    publicHomepageAssetGenerationQueue = publicHomepageAssetGenerationQueue.then(task, task);

    try {
      await publicHomepageAssetGenerationQueue;
      return { ok: true };
    } catch (error) {
      const message = String(error?.stderr || error?.message || error || "Static homepage asset generation failed.");
      console.error("[backend-public-homepage-assets] Generation failed.", {
        reason,
        ...details,
        error: message
      });
      return {
        ok: false,
        error: message
      };
    }
  }

  async function handleListAtpStaffDirectoryEntries(req, res) {
    const principal = getPrincipal(req);
    if (!canViewAtpStaffProfiles(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }
    try {
      const items = await listAtpStaffDirectoryEntries();
      sendJson(res, 200, {
        items,
        total: items.length
      });
    } catch (error) {
      sendJson(res, 500, { error: String(error?.message || error || "Could not load ATP staff profiles") });
    }
  }

  async function handleListPublicAtpStaffProfiles(_req, res) {
    try {
      const items = await listPublicAtpStaffProfiles();
      sendJson(res, 200, {
        items,
        total: items.length
      }, {
        "Cache-Control": "no-store"
      });
    } catch (error) {
      sendJson(res, 500, { error: String(error?.message || error || "Could not load ATP staff team") });
    }
  }

  async function handlePublicAtpStaffPhoto(req, res, [rawRelativePath]) {
    const normalizedRelativePath = normalizeText(rawRelativePath).replace(/^\/+/, "");
    const resolvedPath = resolveAtpStaffPhotoDiskPath(normalizedRelativePath);
    const basenamePath = normalizedRelativePath ? path.basename(normalizedRelativePath) : "";
    const directPath = basenamePath ? path.resolve(ATP_STAFF_PHOTOS_DIR, basenamePath) : "";
    const candidatePaths = Array.from(new Set([resolvedPath, directPath].filter(Boolean)));
    const existingPath = (await Promise.all(candidatePaths.map(async (candidatePath) => (
      (await fileExists(candidatePath)) ? candidatePath : null
    )))).find(Boolean);

    if (!existingPath) {
      console.warn("[backend-atp-staff] Staff photo not found.", {
        request_url: req?.url || "",
        raw_relative_path: rawRelativePath,
        normalized_relative_path: normalizedRelativePath,
        resolved_path: resolvedPath,
        direct_path: directPath,
        photos_dir: ATP_STAFF_PHOTOS_DIR
      });
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    await sendFileWithCache(req, res, existingPath, "public, max-age=31536000, immutable");
  }

  async function handlePatchAtpStaffProfile(req, res, [rawUsername]) {
    const principal = getPrincipal(req);
    if (!canEditAtpStaffProfiles(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    const languages = normalizeLanguageCodes(payload?.languages ?? payload?.spoken_languages);
    if (!languages.length) {
      sendJson(res, 422, { error: "languages must contain at least one valid language code" });
      return;
    }
    const destinations = Array.isArray(payload?.destinations) ? normalizeCountryCodes(payload.destinations) : undefined;
    const name = payload?.name !== undefined ? normalizeText(payload.name) : undefined;
    const position = payload?.position !== undefined ? normalizeText(payload.position) : undefined;
    const positionI18n = Array.isArray(payload?.position_i18n)
      ? normalizeQualificationEntries(payload.position_i18n)
      : undefined;
    if (Array.isArray(payload?.position_i18n) && positionI18n.length !== payload.position_i18n.filter(Boolean).length) {
      sendJson(res, 422, { error: "Each position translation requires a valid language code and non-empty text" });
      return;
    }
    const friendlyShortName = payload?.friendly_short_name !== undefined ? normalizeText(payload.friendly_short_name) : undefined;
    let teamOrder;
    if (payload?.team_order !== undefined) {
      if (payload.team_order === null) {
        teamOrder = null;
      } else if (typeof payload.team_order !== "number" || !Number.isInteger(payload.team_order) || !Number.isFinite(payload.team_order)) {
        sendJson(res, 422, { error: "team_order must be an integer" });
        return;
      } else {
        teamOrder = payload.team_order;
      }
    }
    if (payload?.appears_in_team_web_page !== undefined && typeof payload.appears_in_team_web_page !== "boolean") {
      sendJson(res, 422, { error: "appears_in_team_web_page must be a boolean" });
      return;
    }
    const appearsInTeamWebPage = payload?.appears_in_team_web_page !== undefined
      ? payload.appears_in_team_web_page === true
      : undefined;

    const description = payload?.description !== undefined ? normalizeText(payload.description) : undefined;
    const descriptionI18n = Array.isArray(payload?.description_i18n)
      ? normalizeQualificationEntries(payload.description_i18n)
      : undefined;
    if (Array.isArray(payload?.description_i18n) && descriptionI18n.length !== payload.description_i18n.filter(Boolean).length) {
      sendJson(res, 422, { error: "Each description translation requires a valid language code and non-empty text" });
      return;
    }
    const shortDescription = payload?.short_description !== undefined ? normalizeText(payload.short_description) : undefined;
    const shortDescriptionI18n = Array.isArray(payload?.short_description_i18n)
      ? normalizeQualificationEntries(payload.short_description_i18n)
      : undefined;
    if (Array.isArray(payload?.short_description_i18n)
      && shortDescriptionI18n.length !== payload.short_description_i18n.filter(Boolean).length) {
      sendJson(res, 422, { error: "Each short description translation requires a valid language code and non-empty text" });
      return;
    }

    const updated = await updateAtpStaffProfileByUsername(username, {
      languages,
      destinations,
      name,
      position,
      position_i18n: positionI18n,
      friendly_short_name: friendlyShortName,
      team_order: teamOrder,
      appears_in_team_web_page: appearsInTeamWebPage,
      description,
      description_i18n: descriptionI18n,
      short_description: shortDescription,
      short_description_i18n: shortDescriptionI18n
    });
    if (!updated) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    const homepageAssets = await regeneratePublicHomepageAssets("staff_profile_patch", { username });
    sendJson(res, 200, {
      ...buildUserResponse(updated),
      homepage_assets: homepageAssets
    });
  }

  async function handleTranslateAtpStaffProfileFields(req, res, [rawUsername]) {
    const principal = getPrincipal(req);
    if (!canEditAtpStaffProfiles(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    let payload;
    try {
      payload = await readBodyJson(req);
      validateTranslationEntriesRequest(payload);
    } catch (error) {
      sendJson(res, 400, { error: String(error?.message || "Invalid JSON payload") });
      return;
    }

    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    const existing = await buildAtpStaffDirectoryEntryByUsername(username);
    if (!existing) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    const sourceLang = normalizeLanguageCode(payload.source_lang, "en");
    const targetLang = normalizeLanguageCode(payload.target_lang, "en");
    const entries = translationEntriesToObject(payload.entries);
    if (!Object.keys(entries).length) {
      sendJson(res, 422, { error: "At least one source field is required." });
      return;
    }

    if (sourceLang === targetLang) {
      sendJson(res, 200, {
        source_lang: sourceLang,
        target_lang: targetLang,
        entries: translationEntriesFromObject(entries)
      });
      return;
    }

    try {
      const translationResult = translateEntriesWithMeta
        ? await translateEntriesWithMeta(entries, targetLang, {
            sourceLangCode: sourceLang,
            domain: "ATP staff profile text",
            allowGoogleFallback: true
          })
        : {
            entries: await translateEntries(entries, targetLang, {
              sourceLangCode: sourceLang,
              domain: "ATP staff profile text",
              allowGoogleFallback: true
            }),
            provider: null
          };
      const translatedEntries = translationResult?.entries || {};
      sendJson(res, 200, {
        source_lang: sourceLang,
        target_lang: targetLang,
        entries: translationEntriesFromObject(translatedEntries)
      }, {
        ...(normalizeText(translationResult?.provider?.kind) ? { "X-ATP-Translation-Provider": normalizeText(translationResult.provider.kind) } : {}),
        ...(normalizeText(translationResult?.provider?.label) ? { "X-ATP-Translation-Provider-Label": normalizeText(translationResult.provider.label) } : {})
      });
    } catch (error) {
      if (error?.code === "TRANSLATION_NOT_CONFIGURED") {
        sendJson(res, 503, { error: String(error.message || "Translation provider is not configured.") });
        return;
      }
      if (error?.code === "TRANSLATION_INVALID_RESPONSE" || error?.code === "TRANSLATION_REQUEST_FAILED") {
        sendJson(res, 502, { error: String(error.message || "Translation request failed.") });
        return;
      }
      sendJson(res, 500, { error: String(error?.message || error || "Translation failed.") });
    }
  }

  async function processAtpStaffPhotoToWebp(inputPath, outputPath) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await execImageMagick(execFile, [
      inputPath,
      "-auto-orient",
      "-resize",
      "1000x1000>",
      "-strip",
      "-quality",
      "84",
      outputPath
    ]);
  }

  async function handleUploadAtpStaffPhoto(req, res, [rawUsername]) {
    const principal = getPrincipal(req);
    if (!canEditAtpStaffProfiles(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    let payload;
    try {
      payload = await readBodyJson(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    const existing = await buildAtpStaffDirectoryEntryByUsername(username);
    if (!existing) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    const filename = normalizeText(payload?.filename) || `${username}.upload`;
    const base64 = normalizeText(payload?.data_base64);
    if (!base64) {
      sendJson(res, 422, { error: "data_base64 is required" });
      return;
    }

    const sourceBuffer = Buffer.from(base64, "base64");
    if (!sourceBuffer.length) {
      sendJson(res, 422, { error: "Invalid base64 image payload" });
      return;
    }

    const tempInputPath = path.join(TEMP_UPLOAD_DIR, `${username}-${randomUUID()}${path.extname(filename) || ".upload"}`);
    const outputName = `${username}.webp`;
    const outputPath = path.join(ATP_STAFF_PHOTOS_DIR, outputName);

    try {
      await mkdir(TEMP_UPLOAD_DIR, { recursive: true });
      await writeFile(tempInputPath, sourceBuffer);
      await processAtpStaffPhotoToWebp(tempInputPath, outputPath);
    } catch (error) {
      sendJson(res, 500, { error: "Image conversion failed", detail: String(error?.message || error) });
      return;
    } finally {
      await rm(tempInputPath, { force: true });
    }

    const updated = await setAtpStaffPictureRefByUsername(username, `/content/atp_staff/photos/${outputName}`);
    if (!updated) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    const homepageAssets = await regeneratePublicHomepageAssets("staff_photo_upload", { username });
    sendJson(res, 200, {
      ...buildUserResponse(updated),
      homepage_assets: homepageAssets
    });
  }

  async function handleDeleteAtpStaffPhoto(req, res, [rawUsername]) {
    const principal = getPrincipal(req);
    if (!canEditAtpStaffProfiles(principal)) {
      sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    const username = normalizeText(rawUsername).toLowerCase();
    if (!username) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    const existing = await buildAtpStaffDirectoryEntryByUsername(username);
    if (!existing) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    await rm(path.join(ATP_STAFF_PHOTOS_DIR, `${username}.webp`), { force: true });
    const updated = await resetAtpStaffPictureByUsername(username);
    if (!updated) {
      sendJson(res, 404, { error: "Keycloak user not found" });
      return;
    }

    const homepageAssets = await regeneratePublicHomepageAssets("staff_photo_delete", { username });
    sendJson(res, 200, {
      ...buildUserResponse(updated),
      homepage_assets: homepageAssets
    });
  }

  return {
    handleListAtpStaffDirectoryEntries,
    handleListPublicAtpStaffProfiles,
    handlePublicAtpStaffPhoto,
    handlePatchAtpStaffProfile,
    handleTranslateAtpStaffProfileFields,
    handleUploadAtpStaffPhoto,
    handleDeleteAtpStaffPhoto
  };
}
